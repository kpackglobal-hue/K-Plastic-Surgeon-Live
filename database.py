import sqlite3
import os

DB_FILE = "consultations.db"

def init_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS consultations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_id TEXT NOT NULL,
            status TEXT NOT NULL,
            payment_amount TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

def save_consultation(room_id: str, status: str, payment_amount: str):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO consultations (room_id, status, payment_amount)
        VALUES (?, ?, ?)
    """, (room_id, status, payment_amount))
    conn.commit()
    conn.close()
