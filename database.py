import sqlite3
import os

DB_FILE = "consultations.db"

def init_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # consultations 테이블 (기존 유지)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS consultations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_id TEXT NOT NULL,
            status TEXT NOT NULL,
            payment_amount TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # hospitals 테이블 추가
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS hospitals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            address TEXT NOT NULL,
            phone TEXT NOT NULL,
            how_to_get_there TEXT
        )
    """)
    
    # bookings 테이블 추가
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id TEXT NOT NULL,
            hospital_id INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            payment_amount TEXT,
            webrtc_room_id TEXT,
            escrow_status TEXT DEFAULT 'none', -- none, held, settled_patient, settled_hospital
            surgery_confirmed INTEGER DEFAULT 0, -- 0: 미확정, 1: 확정
            appointment_date TEXT,
            consultation_type TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(hospital_id) REFERENCES hospitals(id)
        )
    """)

    # users 테이블 추가
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name TEXT NOT NULL
        )
    """)

    # patient_ai_images 테이블 추가
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS patient_ai_images (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id TEXT NOT NULL,
            room_id TEXT,
            image_url TEXT NOT NULL,
            prompt TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(patient_id) REFERENCES users(id)
        )
    """)
    
    # 초기 병원 데이터 삽입 (없을 경우만)
    cursor.execute("SELECT COUNT(*) FROM hospitals")
    if cursor.fetchone()[0] == 0:
        hospitals_data = [
            ("K-Top Plastic Surgery", "Seoul Gangnam-daero 420, 5th Floor", "+82-2-1234-5678", "Take Exit 11 of Gangnam Station, walk 100m straight."),
            ("Seoul Elegance Plastic Surgery", "Seoul Seocho-daero 397, 12th Floor", "+82-2-9876-5432", "Take Exit 9 of Gangnam Station, walk 50m straight.")
        ]
        cursor.executemany("""
            INSERT INTO hospitals (name, address, phone, how_to_get_there)
            VALUES (?, ?, ?, ?)
        """, hospitals_data)

    # 초기 데모 사용자 데이터 삽입 (없을 경우만)
    cursor.execute("SELECT COUNT(*) FROM users WHERE email = 'patient@kpsl.com'")
    if cursor.fetchone()[0] == 0:
        cursor.execute("""
            INSERT INTO users (id, email, password, name)
            VALUES ('patient_123', 'patient@kpsl.com', 'password123', 'Sarah Connor')
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

# 추가 헬퍼 함수들
def get_hospitals():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM hospitals")
    hospitals = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return hospitals

def get_hospital_by_id(hospital_id: int):
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM hospitals WHERE id = ?", (hospital_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def create_booking(patient_id: str, hospital_id: int, payment_amount: str, webrtc_room_id: str, appointment_date: str = None, consultation_type: str = None):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO bookings (patient_id, hospital_id, status, payment_amount, webrtc_room_id, escrow_status, appointment_date, consultation_type)
        VALUES (?, ?, 'confirmed', ?, ?, 'held', ?, ?)
    """, (patient_id, hospital_id, payment_amount, webrtc_room_id, appointment_date, consultation_type))
    booking_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return booking_id

def get_bookings_by_patient(patient_id: str):
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    # 병원 이름 조인하여 가져옴
    cursor.execute("""
        SELECT b.*, h.name as hospital_name, h.address, h.phone, h.how_to_get_there 
        FROM bookings b
        JOIN hospitals h ON b.hospital_id = h.id
        WHERE b.patient_id = ?
    """, (patient_id,))
    bookings = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return bookings

def update_surgery_confirm(booking_id: int, confirmed: int):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE bookings SET surgery_confirmed = ? WHERE id = ?
    """, (confirmed, booking_id))
    conn.commit()
    conn.close()

def update_escrow_status(booking_id: int, status: str):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE bookings SET escrow_status = ? WHERE id = ?
    """, (status, booking_id))
    conn.commit()
    conn.close()

def get_booking_by_id(booking_id: int):
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("""
        SELECT b.*, h.name as hospital_name, h.address, h.phone, h.how_to_get_there 
        FROM bookings b
        JOIN hospitals h ON b.hospital_id = h.id
        WHERE b.id = ?
    """, (booking_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

