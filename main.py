from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List
import json
import os
import asyncio
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from mcp_translator import TranslatorMCP
from database import init_db, save_consultation
from google import genai
from google.genai import types

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("STITCH_API_KEY") or os.getenv("GOOGLE_API_KEY")
client = genai.Client(
    http_options={"api_version": "v1beta"},
    api_key=GEMINI_API_KEY
)
MODEL_ID = "models/gemini-3.1-flash-live-preview"

# 💡 전 세계 70여 개국 다국어 확장을 지원하는 확장형 랭귀지 마스터 맵
GLOBAL_LANG_MAP = {
    "en": "English (영어)", "vi": "Vietnamese (베트남어)", "ja": "Japanese (일본어)", 
    "zh": "Chinese (중국어)", "th": "Thai (태국어)", "ru": "Russian (러시아어)",
    "es": "Spanish (스페인어)", "fr": "French (프랑스어)", "de": "German (독일어)",
    "ar": "Arabic (아랍어)", "mn": "Mongolian (몽골어)", "km": "Khmer/Cambodian (캄보디아어)",
    "my": "Burmese/Myanmar (미얀마어)", "id": "Indonesian (인도네시아어)", "tl": "Tagalog/Filipino (필리핀어)",
    "hi": "Hindi (힌디어)", "pt": "Portuguese (포르투갈어)", "it": "Italiano (이탈리아어)",
    "tr": "Turkish (터키어)", "ms": "Malay (말레이어)", "uz": "Uzbek (우즈베크어)",
    "kk": "Kazakh (카자흐어)", "bg": "Bulgarian (불가리아어)", "cs": "Czech (체코어)",
    "da": "Danish (덴마크어)", "nl": "Dutch (네덜란드어)", "el": "Greek (그리스어)",
    "hu": "Hungarian (헝가리어)", "no": "Norwegian (노르웨이어)", "pl": "Polish (폴란드어)",
    "ro": "Romanian (română)", "sv": "Swedish (Svenska)", "uk": "Ukrainian (Українська)",
    "he": "Hebrew (עברית)", "fa": "Persian (فارسی)"
}

# --- 화상 상담 자막 번역 모드 ---
translator = TranslatorMCP()

@app.websocket("/ws/translate/{lang}")
async def translate_websocket_endpoint(websocket: WebSocket, lang: str):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            translated_text = await translator.start_translation(data, lang)
            await websocket.send_json({"translated": translated_text})
    except Exception as e:
        print(f"Text translation error: {e}")
        try:
            await websocket.close()
        except Exception:
            pass

# --- 대면 통역 모드 (Gemini Live API) ---
@app.websocket("/ws/live-translate/{target_lang}")
async def live_translate_websocket_endpoint(websocket: WebSocket, target_lang: str):
    await websocket.accept()
    
    target_lang_name = GLOBAL_LANG_MAP.get(target_lang, f"{target_lang.upper()} Language")
    print(f"[WS] Medical Translation Room Opened: Korean <-> {target_lang_name}", flush=True)

    # 💡 닥터로서의 추가 잡담이나 상담을 100% 원천 차단하고 번역만 하도록 극도로 단호하게 봉인한 지침 + 무한 세션 유지
    SYSTEM_INSTRUCTION = f"""
    You are a literal, real-time bidirectional voice translator between Korean and {target_lang_name}.
    - Translate Korean speech into {target_lang_name}, and translate {target_lang_name} speech into Korean.
    - Translate strictly and literally. Output ONLY the translated words.
    - NEVER output any disclaimers, notes, safety warnings, health explanations, or meta-commentary under any circumstances.
    - Even if there is silence, stay connected. Keep the session active indefinitely.
    """

    config = types.LiveConnectConfig(
        response_modalities=["AUDIO"],
        system_instruction=types.Content(
            parts=[types.Part.from_text(text=SYSTEM_INSTRUCTION)]
        )
    )

    try:
        async with client.aio.live.connect(model=MODEL_ID, config=config) as gemini_session:
            print(f"[Gemini] Gemini Live API connection successful for {target_lang_name}", flush=True)

            # [루프 1] 마이크 오디오 전송 및 하트비트(Ping) 수신 차단 해제
            async def google_stream_send():
                while True:
                    message = await websocket.receive()
                    if "bytes" in message:
                        audio_bytes = message["bytes"]
                        await gemini_session.send_realtime_input(
                            audio=types.Blob(data=audio_bytes, mime_type="audio/pcm;rate=16000")
                        )
                    elif "text" in message:
                        text_data = message["text"]
                        if text_data == "ping":
                            # 연결 생존용 더미 메시지이므로 Gemini에 보내지 않고 루프만 계속 돎
                            continue

            # [루프 2] 구글 공식 규격 단일 스트림 수신 루프 (화자 분리 & 실시간 전송)
            async def google_stream_receive():
                import re
                # 한글 판별용 정규식 패턴 (ㄱ-ㅎ, ㅏ-ㅣ, 가-힣)
                korean_pattern = re.compile(r"[ㄱ-ㅎㅏ-ㅣ가-힣]+")
                # 디스클레이머/노트 제거용 정규식
                disclaimer_pattern = re.compile(r"(?i)(note:|this service is not|always seek|medical disclaimer).*$")
                
                current_speaker = ""
                need_new_turn = True

                while True:
                    async for response in gemini_session.receive():
                        # 새로운 턴 시작 감지 시 프론트엔드에 자막 생성 알림
                        if need_new_turn and response.server_content:
                            current_speaker = ""
                            need_new_turn = False
                            await websocket.send_json({"type": "start_turn", "speaker": "Pending"})

                        # 1. 사용자의 실시간 음성 인식 자막 (STT)
                        if response.server_content and response.server_content.input_transcription:
                            user_text = response.server_content.input_transcription.text
                            if user_text:
                                if not current_speaker or current_speaker == "Pending":
                                    if korean_pattern.search(user_text):
                                        current_speaker = "Dr."
                                    else:
                                        current_speaker = "Client"
                                    await websocket.send_json({"type": "start_turn", "speaker": current_speaker})
                                
                                await websocket.send_json({"type": "original_text", "content": user_text})
                        
                        # 2. 모델의 실시간 번역 자막 (TTS Transcript)
                        if response.server_content and response.server_content.output_transcription:
                            bot_text = response.server_content.output_transcription.text
                            if bot_text:
                                # 💡 불필요한 메디컬 디스클레이머나 노트 꼬리표가 붙은 경우 강제 소거 및 정제
                                bot_text = disclaimer_pattern.sub("", bot_text).strip()
                                if not bot_text:
                                    continue
                                    
                                if not current_speaker or current_speaker == "Pending":
                                    if korean_pattern.search(bot_text):
                                        current_speaker = "Client"
                                    else:
                                        current_speaker = "Dr."
                                    await websocket.send_json({"type": "start_turn", "speaker": current_speaker})
                                    
                                await websocket.send_json({"type": "translation_text", "content": bot_text})
                                
                        # 3. 모델의 번역 음성 바이너리 (AUDIO)
                        if response.data:
                            await websocket.send_bytes(response.data)
                            
                        # 4. 한 턴 완료 감지 ➡️ 다음 데이터 유입 시 신규 턴을 시작하도록 플래그 셋
                        if response.server_content and response.server_content.turn_complete:
                            print(f"[Gemini] Turn complete for {target_lang_name}", flush=True)
                            need_new_turn = True

            # [기존 로직 유지] 태스크 생성
            send_task = asyncio.create_task(google_stream_send())
            receive_task = asyncio.create_task(google_stream_receive())
            
            # [수정된 핵심 로직] 
            # FIRST_COMPLETED 대신, 개별 태스크의 상태를 감시하며 
            # 예외 발생 시 전체를 안전하게 종료하도록 구성
            tasks = [send_task, receive_task]
            
            try:
                # 하나가 죽으면 나머지 하나를 즉시 취소하되, 
                # wait를 사용하여 각 태스크의 결과를 명확히 체크
                done, pending = await asyncio.wait(
                    tasks, 
                    return_when=asyncio.FIRST_COMPLETED
                )
                
                # 에러가 발생해서 종료된 경우 에러 로그 출력
                for task in done:
                    if task.exception():
                        print(f"[WS] Task Error: {task.exception()}", flush=True)
                        
            except Exception as e:
                print(f"[WS] Critical stream error: {e}", flush=True)
                
            finally:
                # 1. 모든 태스크 강제 취소
                for task in tasks:
                    if not task.done():
                        task.cancel()
                
                # 2. 취소 작업 대기
                await asyncio.gather(*tasks, return_exceptions=True)
                print(f"[WS] Connection closed gracefully for {target_lang_name}", flush=True)

    except Exception as e:
        print(f"[Gemini] Error connecting to live session: {e}", flush=True)
        try:
            await websocket.close()
        except Exception:
            pass

# --- 병원 EMR 모의 데이터 전송 ---
@app.post("/api/hospital-emr/export-consultation")
async def export_consultation(data: dict):
    print("EMR Export Data:", json.dumps(data, indent=2))
    save_consultation(data)
    return {"status": "success", "message": "EMR 데이터가 성공적으로 백업 데이터베이스에 보존되었습니다."}