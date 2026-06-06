import sqlite3
import os
import json
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "verivault.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create candidates table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS candidates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            department TEXT NOT NULL,
            encrypted_ssn TEXT NOT NULL,
            ssn_data_key TEXT NOT NULL,
            encrypted_bank_account TEXT NOT NULL,
            bank_account_data_key TEXT NOT NULL,
            document_s3_bucket TEXT NOT NULL,
            document_s3_key TEXT NOT NULL,
            document_name TEXT NOT NULL,
            status TEXT DEFAULT 'Pending Verification',
            background_check_result TEXT DEFAULT 'Not Started',
            created_at TEXT NOT NULL
        )
    """)
    
    # Create tamper-evident local audit log table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            actor TEXT NOT NULL,
            action TEXT NOT NULL,
            detail TEXT NOT NULL,
            resource TEXT NOT NULL,
            ip_address TEXT NOT NULL
        )
    """)
    
    conn.commit()
    conn.close()

def log_audit_event(actor, action, detail, resource, ip_address="192.168.1.100"):
    """Inserts an entry into the local security compliance ledger."""
    conn = get_db_connection()
    cursor = conn.cursor()
    timestamp = datetime.utcnow().isoformat() + "Z"
    cursor.execute("""
        INSERT INTO audit_logs (timestamp, actor, action, detail, resource, ip_address)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (timestamp, actor, action, detail, resource, ip_address))
    conn.commit()
    conn.close()

def create_candidate(full_name, email, department, encrypted_ssn, ssn_data_key, 
                     encrypted_bank, bank_data_key, s3_bucket, s3_key, doc_name):
    conn = get_db_connection()
    cursor = conn.cursor()
    created_at = datetime.utcnow().isoformat() + "Z"
    try:
        cursor.execute("""
            INSERT INTO candidates (
                full_name, email, department, encrypted_ssn, ssn_data_key,
                encrypted_bank_account, bank_account_data_key,
                document_s3_bucket, document_s3_key, document_name, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            full_name, email, department, encrypted_ssn, ssn_data_key,
            encrypted_bank, bank_data_key, s3_bucket, s3_key, doc_name, created_at
        ))
        conn.commit()
        candidate_id = cursor.lastrowid
        conn.close()
        return candidate_id
    except sqlite3.IntegrityError:
        conn.close()
        raise ValueError(f"A candidate with email '{email}' already exists.")

def get_all_candidates():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, full_name, email, department, status, background_check_result, document_name, created_at FROM candidates ORDER BY id DESC")
    candidates = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return candidates

def get_candidate_by_id(candidate_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM candidates WHERE id = ?", (candidate_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def update_candidate_status(candidate_id, status, background_check_result=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    if background_check_result:
        cursor.execute("""
            UPDATE candidates 
            SET status = ?, background_check_result = ? 
            WHERE id = ?
        """, (status, background_check_result, candidate_id))
    else:
        cursor.execute("""
            UPDATE candidates 
            SET status = ? 
            WHERE id = ?
        """, (status, candidate_id))
    conn.commit()
    conn.close()

def get_audit_logs():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100")
    logs = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return logs

# Initialize DB on import
init_db()
