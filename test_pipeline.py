import requests
import time
import sys

BASE_URL = "http://localhost:8000"

def run_test():
    print("="*60)
    print("🚀 [K-Plastic Surgeon Live] Pipeline Integration Test Start")
    print("="*60)
    
    # 1. 병원 정보 마스킹 상태 검증 (예약 전)
    print("\n[Test 1] Fetching hospitals before booking...")
    res = requests.get(f"{BASE_URL}/api/hospitals")
    hospitals = res.json()
    for h in hospitals:
        print(f"Hospital: {h['name']}")
        print(f" - Address (Masked?): {h['address']}")
        print(f" - Phone (Masked?): {h['phone']}")
        
    # 2. 글로벌 에스크로 결제 & WebRTC 상담방 개설 요청
    print("\n[Test 2] Booking & Escrow Payment Checkout for Hospital #1...")
    payload = {
        "patient_id": "patient_123",
        "hospital_id": 1,
        "payment_amount": "$59.00"
    }
    res = requests.post(f"{BASE_URL}/api/payment/checkout", json=payload)
    checkout_data = res.json()
    print("Checkout Response:", checkout_data)
    booking_id = checkout_data["booking_id"]
    webrtc_room = checkout_data["webrtc_room_id"]
    
    # 3. 예약 확정 후 병원 정보 마스킹 해제 검증
    print("\n[Test 3] Fetching hospitals after booking (unmasked)...")
    res = requests.get(f"{BASE_URL}/api/hospitals?patient_id=patient_123")
    hospitals_unmasked = res.json()
    for h in hospitals_unmasked:
        print(f"Hospital: {h['name']}")
        print(f" - Address: {h['address']}")
        print(f" - Phone: {h['phone']}")
        print(f" - Unlock Status (is_locked): {h['is_locked']}")
        
    # 4. 의사에 의한 수술 확정 플래그 세팅
    print("\n[Test 4] Setting Surgery Confirmed Flag to ON...")
    payload_confirm = {
        "booking_id": booking_id,
        "confirmed": 1
    }
    res = requests.post(f"{BASE_URL}/api/surgery/confirm", json=payload_confirm)
    print("Confirm Response:", res.json())
    
    # 5. 상담 종료 및 에스크로 카운트다운 타이머(시연용 3초) 트리거
    print("\n[Test 5] Closing consultation room and triggering escrow countdown (3s)...")
    payload_close = {
        "booking_id": booking_id,
        "delay_seconds": 3
    }
    res = requests.post(f"{BASE_URL}/api/session/close", json=payload_close)
    print("Close Session Response:", res.json())
    
    print("\nWaiting 4 seconds for escrow countdown worker to finish...")
    time.sleep(4)
    
    # 6. 최종 에스크로 정산 결과 조회 (환자 리워드 70% 정산 여부 검증)
    print("\n[Test 6] Verifying Escrow Settlement Status...")
    res = requests.get(f"{BASE_URL}/api/bookings?patient_id=patient_123")
    bookings = res.json()
    for b in bookings:
        if b["id"] == booking_id:
            print(f"Booking ID: #{b['id']}")
            print(f" - Escrow Status (Expected: settled_patient): {b['escrow_status']}")
            print(f" - Surgery Confirmed (Expected: 1): {b['surgery_confirmed']}")
            if b["escrow_status"] == "settled_patient":
                print("\n🎉 INTEGRATION TEST SUCCESSFUL! 🎉")
            else:
                print("\n❌ INTEGRATION TEST FAILED! ❌")

if __name__ == "__main__":
    run_test()
