import os
import base64
import json
import time
from datetime import datetime
from cryptography.fernet import Fernet

# Optional import of boto3 for real AWS integration
try:
    import boto3
    from botocore.exceptions import ClientError
    BOTO3_AVAILABLE = True
except ImportError:
    BOTO3_AVAILABLE = False

# Configuration to switch between real AWS and Local Simulation
# Set USE_REAL_AWS=true and AWS_DEFAULT_REGION=us-east-1 in your environment to use real AWS.
USE_REAL_AWS = os.getenv("USE_REAL_AWS", "false").lower() == "true"

# Ensure local directories for S3 and secrets exist (for local mock storage)
S3_VAULT_DIR = os.path.join(os.path.dirname(__file__), ".s3_vault")
SECRETS_FILE = os.path.join(os.path.dirname(__file__), ".aws_secrets.json")
os.makedirs(S3_VAULT_DIR, exist_ok=True)

# Generate a master key for our simulated AWS KMS Service
KMS_MASTER_KEY_FILE = os.path.join(os.path.dirname(__file__), ".kms_master.key")
if not os.path.exists(KMS_MASTER_KEY_FILE):
    master_key = Fernet.generate_key()
    with open(KMS_MASTER_KEY_FILE, "wb") as f:
        f.write(master_key)
else:
    with open(KMS_MASTER_KEY_FILE, "rb") as f:
        master_key = f.read()

kms_fernet = Fernet(master_key)

# Global list to hold AWS Logs for our live terminal console
aws_logs = []

def log_aws_call(service, operation, parameters, response_payload, real_aws=False):
    log_id = f"log-{int(time.time() * 1000)}-{os.urandom(2).hex()}"
    log_entry = {
        "id": log_id,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "service": f"{service} (AWS Real)" if real_aws else service,
        "operation": operation,
        "parameters": sanitize_payload(parameters),
        "response_payload": sanitize_payload(response_payload),
        "status": "SUCCESS"
    }
    aws_logs.append(log_entry)
    if len(aws_logs) > 200:
        aws_logs.pop(0)
    return log_entry

def sanitize_payload(obj):
    """Deep copy and sanitize binary or sensitive fields for display in logs."""
    if isinstance(obj, bytes):
        try:
            return obj.decode('utf-8')
        except UnicodeDecodeError:
            return f"<Binary Data: {len(obj)} bytes>"
    elif isinstance(obj, dict):
        sanitized = {}
        for k, v in obj.items():
            if k in ["Plaintext", "SecretString", "password", "api_key", "secret_key"]:
                if isinstance(v, str):
                    sanitized[k] = f"[{k.upper()}_REDACTED] (Prefix: {v[:6]}...)"
                else:
                    sanitized[k] = f"[{k.upper()}_REDACTED]"
            else:
                sanitized[k] = sanitize_payload(v)
        return sanitized
    elif isinstance(obj, list):
        return [sanitize_payload(x) for x in obj]
    return obj


class MockKMSClient:
    def __init__(self):
        self.key_arn = os.getenv("KMS_KEY_ARN", "arn:aws:kms:us-east-1:123456789012:key/hr-pii-encryption")
        if USE_REAL_AWS and BOTO3_AVAILABLE:
            self.client = boto3.client("kms")
        else:
            self.client = None

    def generate_data_key(self, KeyId, KeySpec='AES_256'):
        if USE_REAL_AWS and self.client:
            try:
                # Real AWS KMS generate_data_key API call
                response = self.client.generate_data_key(KeyId=KeyId, KeySpec=KeySpec)
                # Raw bytes need to be returned
                result = {
                    "Plaintext": response["Plaintext"], # bytes
                    "CiphertextBlob": response["CiphertextBlob"], # bytes
                    "KeyId": response["KeyId"]
                }
                # Log the real AWS KMS transaction
                log_aws_call(
                    service="KMS",
                    operation="GenerateDataKey",
                    parameters={"KeyId": KeyId, "KeySpec": KeySpec},
                    response_payload={
                        "KeyId": response["KeyId"],
                        "Plaintext": base64.b64encode(response["Plaintext"]).decode('utf-8'),
                        "CiphertextBlob": base64.b64encode(response["CiphertextBlob"]).decode('utf-8')
                    },
                    real_aws=True
                )
                return result
            except Exception as e:
                print(f"Real AWS KMS Error: {e}")
                raise e
        
        # Fallback to Mock KMS client
        raw_data_key = Fernet.generate_key()
        encrypted_data_key = kms_fernet.encrypt(raw_data_key)
        response = {
            "Plaintext": raw_data_key,
            "CiphertextBlob": encrypted_data_key,
            "KeyId": self.key_arn
        }
        log_aws_call(
            service="KMS",
            operation="GenerateDataKey",
            parameters={"KeyId": KeyId, "KeySpec": KeySpec},
            response_payload={
                "KeyId": self.key_arn,
                "Plaintext": raw_data_key.decode('utf-8'),
                "CiphertextBlob": encrypted_data_key.decode('utf-8')
            }
        )
        return response

    def decrypt(self, CiphertextBlob):
        if isinstance(CiphertextBlob, str):
            CiphertextBlob = CiphertextBlob.encode('utf-8')

        if USE_REAL_AWS and self.client:
            try:
                # Real AWS KMS decrypt API call. AWS decrypt expects raw bytes
                # Since we store ciphertext in DB as base64 string, we decode it first
                raw_ciphertext = base64.b64decode(CiphertextBlob)
                response = self.client.decrypt(CiphertextBlob=raw_ciphertext)
                result = {
                    "Plaintext": response["Plaintext"], # bytes
                    "KeyId": response["KeyId"]
                }
                log_aws_call(
                    service="KMS",
                    operation="Decrypt",
                    parameters={"CiphertextBlobLength": len(CiphertextBlob)},
                    response_payload={
                        "KeyId": response["KeyId"],
                        "Plaintext": base64.b64encode(response["Plaintext"]).decode('utf-8')
                    },
                    real_aws=True
                )
                return result
            except Exception as e:
                print(f"Real AWS KMS Decrypt Error: {e}")
                raise e

        # Mock KMS Decrypt Fallback
        try:
            decrypted_data_key = kms_fernet.decrypt(CiphertextBlob)
            response = {
                "Plaintext": decrypted_data_key,
                "KeyId": self.key_arn
            }
            log_aws_call(
                service="KMS",
                operation="Decrypt",
                parameters={"CiphertextBlobLength": len(CiphertextBlob)},
                response_payload={
                    "KeyId": self.key_arn,
                    "Plaintext": decrypted_data_key.decode('utf-8')
                }
            )
            return response
        except Exception as e:
            raise ValueError(f"Decrypt failed: {str(e)}")


class MockS3Client:
    def __init__(self):
        self.kms_client = MockKMSClient()
        if USE_REAL_AWS and BOTO3_AVAILABLE:
            self.client = boto3.client("s3")
        else:
            self.client = None

    def put_object(self, Bucket, Key, Body, ContentType=None, ServerSideEncryption=None, SSEKMSKeyId=None):
        if USE_REAL_AWS and self.client:
            try:
                # Real AWS S3 PutObject with SSE-KMS Encryption at rest!
                kwargs = {
                    "Bucket": Bucket,
                    "Key": Key,
                    "Body": Body,
                    "ContentType": ContentType
                }
                if ServerSideEncryption:
                    kwargs["ServerSideEncryption"] = ServerSideEncryption
                if SSEKMSKeyId:
                    kwargs["SSEKMSKeyId"] = SSEKMSKeyId
                
                response = self.client.put_object(**kwargs)
                log_aws_call(
                    service="S3",
                    operation="PutObject",
                    parameters={
                        "Bucket": Bucket,
                        "Key": Key,
                        "ContentType": ContentType,
                        "ServerSideEncryption": ServerSideEncryption,
                        "SSEKMSKeyId": SSEKMSKeyId,
                        "PayloadSize": len(Body)
                    },
                    response_payload=response,
                    real_aws=True
                )
                return {"Status": "SUCCESS"}
            except Exception as e:
                print(f"Real AWS S3 PutObject Error: {e}")
                raise e

        # Mock S3 PutObject Fallback
        bucket_dir = os.path.join(S3_VAULT_DIR, Bucket)
        os.makedirs(bucket_dir, exist_ok=True)
        file_path = os.path.join(bucket_dir, Key)

        is_encrypted = False
        encrypted_metadata = {}
        
        if ServerSideEncryption == "aws:kms" and SSEKMSKeyId:
            is_encrypted = True
            kms_res = self.kms_client.generate_data_key(KeyId=SSEKMSKeyId)
            plaintext_key = kms_res["Plaintext"]
            ciphertext_key = kms_res["CiphertextBlob"]
            
            object_fernet = Fernet(plaintext_key)
            if isinstance(Body, str):
                Body = Body.encode('utf-8')
            encrypted_body = object_fernet.encrypt(Body)
            
            with open(file_path, "wb") as f:
                f.write(encrypted_body)
                
            meta_path = file_path + ".metadata"
            encrypted_metadata = {
                "encrypted": True,
                "sse": "aws:kms",
                "sse_kms_key_id": SSEKMSKeyId,
                "ciphertext_key": ciphertext_key.decode('utf-8'),
                "content_type": ContentType or "application/octet-stream"
            }
            with open(meta_path, "w") as f:
                json.dump(encrypted_metadata, f)
        else:
            if isinstance(Body, str):
                Body = Body.encode('utf-8')
            with open(file_path, "wb") as f:
                f.write(Body)
                
            meta_path = file_path + ".metadata"
            encrypted_metadata = {
                "encrypted": False,
                "content_type": ContentType or "application/octet-stream"
            }
            with open(meta_path, "w") as f:
                json.dump(encrypted_metadata, f)

        log_aws_call(
            service="S3",
            operation="PutObject",
            parameters={
                "Bucket": Bucket,
                "Key": Key,
                "ContentType": ContentType,
                "ServerSideEncryption": ServerSideEncryption,
                "SSEKMSKeyId": SSEKMSKeyId,
                "PayloadSize": len(Body)
            },
            response_payload={
                "ETag": f'"{os.urandom(16).hex()}"',
                "ServerSideEncryption": ServerSideEncryption,
                "SSEKMSKeyId": SSEKMSKeyId,
                "Metadata": encrypted_metadata
            }
        )
        return {"Status": "SUCCESS"}

    def get_object(self, Bucket, Key):
        if USE_REAL_AWS and self.client:
            try:
                # Real AWS S3 GetObject call
                response = self.client.get_object(Bucket=Bucket, Key=Key)
                data = response["Body"].read()
                log_aws_call(
                    service="S3",
                    operation="GetObject",
                    parameters={"Bucket": Bucket, "Key": Key},
                    response_payload={
                        "ContentType": response.get("ContentType"),
                        "ContentLength": len(data),
                        "SSEApplied": response.get("ServerSideEncryption", "None")
                    },
                    real_aws=True
                )
                return {
                    "Body": data,
                    "ContentType": response.get("ContentType", "application/octet-stream")
                }
            except Exception as e:
                print(f"Real AWS S3 GetObject Error: {e}")
                raise e

        # Mock S3 GetObject Fallback
        file_path = os.path.join(S3_VAULT_DIR, Bucket, Key)
        meta_path = file_path + ".metadata"
        
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"NoSuchKey: Key {Key} not found in bucket {Bucket}.")
            
        with open(file_path, "rb") as f:
            data = f.read()
            
        content_type = "application/octet-stream"
        
        if os.path.exists(meta_path):
            with open(meta_path, "r") as f:
                meta = json.load(f)
            content_type = meta.get("content_type", content_type)
            
            if meta.get("encrypted") and meta.get("sse") == "aws:kms":
                ciphertext_key = meta.get("ciphertext_key")
                kms_res = self.kms_client.decrypt(CiphertextBlob=ciphertext_key)
                plaintext_key = kms_res["Plaintext"]
                
                object_fernet = Fernet(plaintext_key)
                data = object_fernet.decrypt(data)
                
        log_aws_call(
            service="S3",
            operation="GetObject",
            parameters={"Bucket": Bucket, "Key": Key},
            response_payload={
                "ContentType": content_type,
                "ContentLength": len(data),
                "SSEApplied": "aws:kms" if os.path.exists(meta_path) and meta.get("encrypted") else "None"
            }
        )
        
        return {
            "Body": data,
            "ContentType": content_type
        }

    def generate_presigned_url(self, ClientMethod, Params, ExpiresIn=60):
        if USE_REAL_AWS and self.client:
            try:
                # Real AWS S3 Presigned URL Generation!
                url = self.client.generate_presigned_url(
                    ClientMethod=ClientMethod,
                    Params=Params,
                    ExpiresIn=ExpiresIn
                )
                log_aws_call(
                    service="S3",
                    operation="GeneratePresignedUrl",
                    parameters={
                        "ClientMethod": ClientMethod,
                        "Params": Params,
                        "ExpiresIn": ExpiresIn
                    },
                    response_payload={"PresignedUrl": url},
                    real_aws=True
                )
                return url
            except Exception as e:
                print(f"Real AWS S3 generate_presigned_url Error: {e}")
                raise e

        # Mock S3 Presigned URL Fallback
        bucket = Params.get("Bucket")
        key = Params.get("Key")
        timestamp = int(time.time())
        token_payload = f"{bucket}:{key}:{timestamp}:{ExpiresIn}"
        sig = base64.b64encode(kms_fernet.encrypt(token_payload.encode('utf-8'))).decode('utf-8')
        presigned_url = f"/api/s3/presigned/{bucket}/{key}?token={sig}&expires={timestamp + ExpiresIn}"
        
        log_aws_call(
            service="S3",
            operation="GeneratePresignedUrl",
            parameters={
                "ClientMethod": ClientMethod,
                "Params": Params,
                "ExpiresIn": ExpiresIn
            },
            response_payload={"PresignedUrl": presigned_url}
        )
        return presigned_url


class MockSecretsManagerClient:
    def __init__(self):
        self.default_secrets = {
            "verivault/production/database": {
                "host": "localhost",
                "database": "verivault_prod",
                "username": "admin_user",
                "password": "SuperSecretPassword123-KMS-Secured",
                "port": 5432
            },
            "verivault/external/background-check": {
                "agency_name": "Checkr Mock Service",
                "api_endpoint": "https://api.mock.checkr.com/v1",
                "api_key": "chk_live_8923a1bcd7e92ff003189a8",
                "webhook_secret": "whsec_2a798f02f9c"
            }
        }
        
        if not os.path.exists(SECRETS_FILE):
            with open(SECRETS_FILE, "w") as f:
                json.dump(self.default_secrets, f, indent=2)

        if USE_REAL_AWS and BOTO3_AVAILABLE:
            self.client = boto3.client("secretsmanager")
        else:
            self.client = None

    def _read_secrets(self):
        try:
            with open(SECRETS_FILE, "r") as f:
                return json.load(f)
        except Exception:
            return self.default_secrets

    def get_secret_value(self, SecretId):
        if USE_REAL_AWS and self.client:
            try:
                # Real AWS Secrets Manager API call!
                response = self.client.get_secret_value(SecretId=SecretId)
                secret_str = response["SecretString"]
                
                log_aws_call(
                    service="SecretsManager",
                    operation="GetSecretValue",
                    parameters={"SecretId": SecretId},
                    response_payload={
                        "ARN": response.get("ARN"),
                        "Name": response.get("Name"),
                        "SecretString": json.loads(secret_str)
                    },
                    real_aws=True
                )
                return response
            except Exception as e:
                print(f"Real AWS Secrets Manager Error: {e}")
                raise e

        # Mock Secrets Manager Fallback
        secrets = self._read_secrets()
        if SecretId not in secrets:
            raise ValueError(f"Secrets Manager can't find secret: {SecretId}")
            
        secret_data = secrets[SecretId]
        secret_string = json.dumps(secret_data)
        
        response = {
            "ARN": f"arn:aws:secretsmanager:us-east-1:123456789012:secret:{SecretId}-aBc12",
            "Name": SecretId,
            "SecretString": secret_string,
            "CreatedDate": datetime.utcnow().isoformat() + "Z"
        }
        
        log_aws_call(
            service="SecretsManager",
            operation="GetSecretValue",
            parameters={"SecretId": SecretId},
            response_payload={
                "ARN": response["ARN"],
                "Name": response["Name"],
                "SecretString": secret_data
            }
        )
        return response


# Global instances of our mock/hybrid clients, ready to be imported in the backend app!
kms_client = MockKMSClient()
s3_client = MockS3Client()
secrets_client = MockSecretsManagerClient()
