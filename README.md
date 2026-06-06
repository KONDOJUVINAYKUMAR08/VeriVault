# 🔒 VeriVault: Secure Candidate & Vendor Background Vault

**VeriVault** is a modern, security-first monolithic SaaS application designed to solve a critical, high-risk enterprise business problem: **the exposure and mishandling of high-risk Personally Identifiable Information (PII) during external vendor and contractor onboarding.**

This application is built with a **React (Vite + Tailwind CSS)** frontend and a **FastAPI (Python)** backend. It integrates simulated versions of **AWS Key Management Service (KMS)**, **AWS Secrets Manager**, and **AWS S3** to model enterprise-grade cloud security best practices natively, complete with an **Interactive AWS Live Log Console** and a **Tamper-Evident Security Audit Ledger**.

---

## 🎯 The Real-World Business Problem

When companies onboard external vendors or contractors, they must collect highly sensitive credentials:
1. **National IDs/Social Security Numbers (SSN)** for identity checks.
2. **Bank Account Details** for direct deposit payments.
3. **Scanned Passports/Driver's Licenses** as verification proof.

### The Security Vulnerability:
In many organizations, HR personnel and hiring managers store these files in unsecured storage, email attachments, local downloads, or shared drives. If an HR employee's laptop or account is compromised, this unencrypted high-risk PII is exposed to hackers, resulting in heavy regulatory fines (GDPR, CCPA), identity theft, and corporate liability.

---

## 🛡️ The VeriVault Solution (Architectural Design)

VeriVault solves this by enforcing **on-demand access** with strict cloud security safeguards:

1. **AWS KMS (Envelope Encryption at Application Level)**:
   * Sensitive fields (SSN, Bank routing info) are **never stored in plaintext** in the database.
   * When a profile is submitted, the backend calls `kms:GenerateDataKey`. This returns a *plaintext data key* and an *encrypted data key (ciphertext key)*.
   * The backend encrypts the PII locally using the plaintext data key, **destroys the plaintext key from memory**, and stores the ciphertext data key alongside the encrypted payload in the database.
   * To view the PII, an authorized HR Admin triggers an active `kms:Decrypt` operation on-the-fly, which is logged for regulatory compliance.

2. **AWS S3 (SSE-KMS Bucket default Encryption & Presigned URLs)**:
   * Uploaded identity documents are stored in S3, encrypted at rest using S3 default Server-Side Encryption with Customer Managed Keys (`SSE-KMS`).
   * Instead of exposing direct public URLs to files, the admin panel requests a **60-second S3 Presigned URL** (`s3:GeneratePresignedUrl`) on-demand. This URL securely expires and validates requests via signatures.

3. **AWS Secrets Manager (Dynamic Credentials Retrieval & External Webhooks)**:
   * External system API keys (e.g., identity verification services, screening agencies) are stored securely in Secrets Manager.
   * When triggering background verifications, the backend queries `secretsmanager:GetSecretValue` on-the-fly, securely connects to the service, and avoids any hardcoded configuration environment parameters.

---

## 🕹️ Interactive Features for Testing

To make this app an incredible educational case study, we have built-in:
* **AWS Cloud Operations Console**: A real-time terminal window pinned to the right side of the screen. As you click buttons or submit profiles, it prints the exact AWS SDK (`boto3`) parameters, operations, and JSON payloads. You can click on any operation to **inspect requests & responses**!
* **Compliance Audit Ledger**: A read-only compliance table storing administrative events (who decrypted which candidate, generated S3 URLs, IP addresses) in a structured local SQLite table.

---

## 📁 Workspace Structure

```bash
├── backend/
│   ├── app.py             # FastAPI Monolithic Entrypoint & S3 proxy
│   ├── aws_mock.py        # Robust Cryptographic AWS Client Simulator
│   ├── database.py        # SQLite Candidates database & Compliance Ledger
│   └── requirements.txt   # Backend dependency list
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # Complete React SPA (Onboarding form, HR Admin, SOC)
│   │   ├── main.jsx       # React Bootstrap
│   │   └── index.css      # Custom reset styles
│   ├── index.html         # Tailwind and font config
│   └── package.json       # React dependencies (lucide-react, etc.)
├── run_app.sh             # Automatic executable startup script
└── README.md              # Project Documentation
```

---

## 🚀 How to Run the Application

You can spin up the entire monolithic stack with one command!

```bash
./run_app.sh
```

### What this script does:
1. Installs the backend python requirements (`fastapi`, `uvicorn`, `cryptography`, etc.).
2. Downloads Node dependencies and compiles the React application into optimized static assets (`npm run build`).
3. Starts the unified FastAPI server which runs on **`http://localhost:8000`**, serving both the API routing and the React interface.

---

## 🛠️ Security Verification Guide

1. **Verify Encryption at Rest**:
   * Open the candidate list.
   * Try checking the SQLite database (`backend/verivault.db`) directly or viewing candidate details. You will see that the SSN and Bank accounts are stored as high-entropy cryptograms (Fernet AES payload), alongside their S3 encrypted file blobs under `backend/.s3_vault/`.
2. **Inspect AWS Logs**:
   * Open the right sidebar console.
   * Complete the onboarding form, then return to the HR Dashboard. You'll see the exact sequence of `kms:GenerateDataKey` and `s3:PutObject` calls.
   * Inspect payloads to view how the data key is exchanged!
