from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from typing import Dict, List
import json
from contextlib import asynccontextmanager
from mcp_translator import TranslatorMCP
from database import init_db, save_consultation

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(lifespan=lifespan)
translator = TranslatorMCP()

# --- 화상 상담룸 (브로드캐스트 & 드로잉) ---
# 룸별로 연결된 클라이언트들을 저장할 딕셔너리
rooms: Dict[str, List[WebSocket]] = {}

@app.websocket("/ws/{room_id}")
async def room_websocket_endpoint(websocket: WebSocket, room_id: str):
    await websocket.accept()
    
    if room_id not in rooms:
        rooms[room_id] = []
    rooms[room_id].append(websocket)
    
    try:
        while True:
            # 드로잉 좌표 또는 번역 텍스트 등 수신
            data = await websocket.receive_json()
            
            # 방에 있는 상대방에게만 브로드캐스트 (나 제외)
            for client in rooms[room_id]:
                if client != websocket:
                    await client.send_json(data)
                    
    except WebSocketDisconnect:
        rooms[room_id].remove(websocket)
        if not rooms[room_id]:
            del rooms[room_id]

# --- 대면 통역 모드 (단일 클라이언트) ---
@app.websocket("/ws/translate/{lang}")
async def translate_websocket_endpoint(websocket: WebSocket, lang: str):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            translated_text = await translator.start_translation(data, lang)
            await websocket.send_json({"translated": translated_text})
    except Exception as e:
        print(f"Error: {e}")
        await websocket.close()

# --- API 엔드포인트 ---
@app.post("/api/end-consultation/{room_id}")
async def end_consultation(room_id: str):
    # 상담 종료 기록 (데이터베이스 저장 로직)
    save_consultation(room_id=room_id, status="완료", payment_amount="$14.99")
    print(f"상담 종료: Room {room_id} | 상태: 완료 | 결제 금액: $14.99")
    return {"status": "success", "message": "상담 기록이 저장되었습니다."}
