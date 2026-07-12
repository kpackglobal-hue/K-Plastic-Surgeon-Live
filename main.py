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

    # 💡 닥터로서의 추가 잡담이나 상담을 100% 원천 차단하고 번역만 하도록 극도로 단호하게 봉인한 지침
    SYSTEM_INSTRUCTION = f"""
    You are a professional, universal real-time medical translator between Korean and {target_lang_name}.
    - Your ONLY role is to translate Korean speech into {target_lang_name}, and {target_lang_name} speech into Korean.
    - You must NOT act as a doctor, you must NOT answer any doctor consultation questions by yourself, and you must NOT chat or add conversational replies.
    - Output ONLY the exact translated counterpart speech. Do NOT add any extra commentary, greetings, or conversational response.
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

            # [루프 1] 마이크 오디오 전송
            async def google_stream_send():
                try:
                    while True:
                        audio_bytes = await websocket.receive_bytes()
                        await gemini_session.send_realtime_input(
                            audio=types.Blob(data=audio_bytes, mime_type="audio/pcm")
                        )
                except WebSocketDisconnect:
                    print(f"[WS] Connection closed for {target_lang_name}", flush=True)
                except Exception as e:
                    print(f"Send loop error: {e}", flush=True)

            # [루프 2] 구글 공식 규격 단일 스트림 수신 루프 (화자 분리 & 실시간 전송)
            async def google_stream_receive():
                try:
                    import re
                    # 한글 판별용 정규식 패턴 (ㄱ-ㅎ, ㅏ-ㅣ, 가-힣)
                    korean_pattern = re.compile(r"[ㄱ-ㅎㅏ-ㅣ가-힣]+")
                    
                    current_speaker = ""
                    need_new_turn = True

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
                            
                except WebSocketDisconnect:
                    print(f"[WS] Connection closed for {target_lang_name}", flush=True)
                except Exception as e:
                    print(f"Receive loop error: {e}", flush=True)

            await asyncio.gather(google_stream_send(), google_stream_receive())

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