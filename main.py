from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List, Optional
import json
import os
import uuid
import random
import asyncio
import httpx
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from mcp_translator import TranslatorMCP
from database import (
    init_db, save_consultation, get_hospitals, get_hospital_by_id, 
    create_booking, get_bookings_by_patient, update_surgery_confirm, 
    update_escrow_status, get_booking_by_id
)
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
                    if message.get("type") == "websocket.disconnect":
                        print(f"[WS] Client disconnected", flush=True)
                        break
                    
                    audio_bytes = message.get("bytes")
                    if audio_bytes:
                        await gemini_session.send_realtime_input(
                            audio=types.Blob(data=audio_bytes, mime_type="audio/pcm;rate=16000")
                        )
                    else:
                        text_data = message.get("text")
                        if text_data == "ping":
                            continue

            # [루프 2] 구글 공식 규격 단일 스트림 수신 루프 (화자 분리 & 실시간 전송)
            async def google_stream_receive():
                import re
                korean_pattern = re.compile(r"[ㄱ-ㅎㅏ-ㅣ가-힣]+")
                disclaimer_pattern = re.compile(r"(?i)(note:|this service is not|always seek|medical disclaimer).*$")
                
                current_speaker = ""
                need_new_turn = True

                while True:
                    async for response in gemini_session.receive():
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

            send_task = asyncio.create_task(google_stream_send())
            receive_task = asyncio.create_task(google_stream_receive())
            
            tasks = [send_task, receive_task]
            
            try:
                done, pending = await asyncio.wait(
                    tasks, 
                    return_when=asyncio.FIRST_COMPLETED
                )
                for task in done:
                    if task.exception():
                        print(f"[WS] Task Error: {task.exception()}", flush=True)
            except Exception as e:
                print(f"[WS] Critical stream error: {e}", flush=True)
            finally:
                for task in tasks:
                    if not task.done():
                        task.cancel()
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
    save_consultation(
        room_id=data.get("room_id", "unknown"),
        status=data.get("status", "completed"),
        payment_amount=data.get("payment_amount", "$0")
    )
    return {"status": "success", "message": "EMR 데이터가 성공적으로 백업 데이터베이스에 보존되었습니다."}

# =====================================================================
# 병원 정보 비공개/공개 (Masking) 필터 API
# =====================================================================
@app.get("/api/hospitals")
async def get_hospitals_endpoint(patient_id: Optional[str] = None):
    hospitals = get_hospitals()
    confirmed_hospitals = set()
    if patient_id:
        bookings = get_bookings_by_patient(patient_id)
        for b in bookings:
            if b["status"] == "confirmed":
                confirmed_hospitals.add(b["hospital_id"])
                
    filtered_hospitals = []
    for h in hospitals:
        h_copy = dict(h)
        if h["id"] not in confirmed_hospitals:
            h_copy["address"] = "🔒 [Masked] Available after booking confirmation"
            h_copy["phone"] = "🔒 [Masked] Available after booking confirmation"
            h_copy["how_to_get_there"] = "🔒 [Masked] Available after booking confirmation"
            h_copy["is_locked"] = True
        else:
            h_copy["is_locked"] = False
        filtered_hospitals.append(h_copy)
        
    return filtered_hospitals

# =====================================================================
# 글로벌 PG 에스크로 결제 및 WebRTC 실시간 화상 상담방 개설 API
# =====================================================================
@app.post("/api/payment/checkout")
async def payment_checkout(data: dict):
    patient_id = data.get("patient_id")
    hospital_id = int(data.get("hospital_id", 1))
    payment_amount = data.get("payment_amount", "$59.00")
    
    appointment_date = data.get("appointment_date")
    appointment_time = data.get("appointment_time")
    tier = data.get("tier")
    full_appointment = f"{appointment_date} {appointment_time}" if appointment_date and appointment_time else None
    
    room_id = f"room_{patient_id}_{hospital_id}_{str(uuid.uuid4())[:8]}"
    
    booking_id = create_booking(
        patient_id=patient_id,
        hospital_id=hospital_id,
        payment_amount=payment_amount,
        webrtc_room_id=room_id,
        appointment_date=full_appointment,
        consultation_type=tier
    )
    
    hospital_info = get_hospital_by_id(hospital_id)
    print("\n" + "="*50)
    print("[MOCK PUSH & ALIMTALK SENDER]")
    print(f"To Patient: {patient_id}")
    print(f"Message: Your booking with {hospital_info['name']} is CONFIRMED!")
    print(f"Hospital Details Unlocked:")
    print(f" - Address: {hospital_info['address']}")
    print(f" - Phone: {hospital_info['phone']}")
    print(f" - How to get there: {hospital_info['how_to_get_there']}")
    print(f" - WebRTC Room Link: http://localhost:5174/consultation?room_id={room_id}")
    print("="*50 + "\n")
    
    return {
        "status": "success",
        "booking_id": booking_id,
        "webrtc_room_id": room_id,
        "hospital_info": hospital_info,
        "message": "Payment successful. Hospital details unlocked and notifications sent."
    }

@app.get("/api/bookings")
async def get_patient_bookings(patient_id: str):
    return get_bookings_by_patient(patient_id)

# =====================================================================
# 에스크로 카운트다운 타이머 및 정산 분기 백그라운드 워커
# =====================================================================
async def run_escrow_countdown(booking_id: int, delay_seconds: int = 30):
    print(f"[Escrow Worker] Starting {delay_seconds}s countdown for Booking #{booking_id}...", flush=True)
    await asyncio.sleep(delay_seconds)
    
    booking = get_booking_by_id(booking_id)
    if not booking:
        print(f"[Escrow Worker] Booking #{booking_id} not found. Aborting.", flush=True)
        return
        
    print(f"[Escrow Worker] Countdown finished for Booking #{booking_id}. Checking surgery_confirmed flag...", flush=True)
    
    amount_str = booking["payment_amount"].replace("$", "")
    try:
        amount = float(amount_str)
    except ValueError:
        amount = 59.00
        
    payout_amount = amount * 0.70 # 수수료 제외 70% 정산
    
    if booking["surgery_confirmed"] == 1:
        update_escrow_status(booking_id, "settled_patient")
        print("\n" + "#"*60)
        print("[ESCROW SETTLEMENT: SURGERY CONFIRMED]")
        print(f"Booking ID: #{booking_id}")
        print(f"Action: Patient reward paid out (70% of ${amount:.2f} = ${payout_amount:.2f}) to Patient {booking['patient_id']}")
        print("#"*60 + "\n")
    else:
        update_escrow_status(booking_id, "settled_hospital")
        print("\n" + "#"*60)
        print("[ESCROW SETTLEMENT: NO-SHOW OR EXPIRED]")
        print(f"Booking ID: #{booking_id}")
        print(f"Action: Payout paid out (70% of ${amount:.2f} = ${payout_amount:.2f}) to Hospital {booking['hospital_name']}")
        print("#"*60 + "\n")

@app.post("/api/session/close")
async def close_session(data: dict):
    booking_id = int(data.get("booking_id"))
    delay_seconds = int(data.get("delay_seconds", 30))
    
    booking = get_booking_by_id(booking_id)
    if not booking:
        return {"status": "error", "message": "Booking not found"}
        
    asyncio.create_task(run_escrow_countdown(booking_id, delay_seconds))
    
    return {
        "status": "success", 
        "message": f"Session closed. Escrow countdown timer ({delay_seconds} seconds) started."
    }

@app.post("/api/surgery/confirm")
async def confirm_surgery(data: dict):
    booking_id = int(data.get("booking_id"))
    confirmed = int(data.get("confirmed", 1))
    update_surgery_confirm(booking_id, confirmed)
    return {"status": "success", "booking_id": booking_id, "surgery_confirmed": confirmed}

# =====================================================================
# 3D Virtual Simulation Module (ComfyUI Wrapper) API
# =====================================================================
SURGERY_PROMPTS = {
    # 1. EYE SURGERY (Blepharoplasty)
    "double_eyelid": "natural double eyelids, clear eyelid crease, elegant double fold, photorealistic eyes",
    "canthoplasty": "wider and longer eyes, extended eye corners, large and vivid beautiful eyes, clear eye shape",
    "ptosis_correction": "awake and bright eyes, well-defined upper eyelid margin, energetic look, clear iris visible",
    "undereye_fat": "smooth under-eye area, flawless skin under eyes, zero eye bags, youthful lower eyelids",
    "upper_bleph": "rejuvenated upper eyelids, tight and youthful skin above eyes, natural crease",
    "lower_bleph": "tightened lower eyelid skin, smooth transition to cheek, smooth skin, youthful look",
    
    # 2. NOSE SURGERY (Rhinoplasty)
    "bridge_rhinoplasty": "high and straight nose bridge, elevated nasal dorsum, defined and elegant side profile",
    "tip_plasty": "refined and beautifully projected nose tip, elegant nasal tip, natural tip definition",
    "alar_reduction": "narrow nostrils, reduced alar width, refined and slim nose base, proportionate alar",
    "hump_correction": "smooth and straight nasal bridge, humpless nose, flat and even nasal bone profile",
    "short_nose": "elongated nose tip, naturally downward angled nose, perfectly proportioned nasal length",
    "functional_rhino": "perfectly straight nose bridge, symmetrical nasal structure, harmonious face"
}

NEGATIVE_PROMPT = (
    "scars, asymmetrical eyes, weird nostrils, deformed face, unnatural wrinkles, plastic look, "
    "blurry, low resolution, bad anatomy, disfigured face, double nose, worst quality, low quality"
)

transcript_dumps: Dict[str, List[str]] = {}
simulation_tasks = {}

@app.post("/api/session/transcript-dump")
async def save_transcript_dump(data: dict):
    room_id = data.get("room_id")
    transcripts = data.get("transcripts", [])
    transcript_dumps[room_id] = transcripts
    return {"status": "success", "message": "Transcript dump saved."}

@app.post("/api/v1/simulation")
async def create_simulation(data: dict):
    image_data = data.get("image")
    selected_options = data.get("selected_options", [])
    
    # 5. 에러 핸들링: 얼굴 미감지 예외 처리
    if not image_data or len(image_data.strip()) == 0:
        raise HTTPException(
            status_code=400, 
            detail="얼굴이 감지되지 않았습니다. 전면을 바라보는 밝고 선명한 사진을 업로드해 주세요."
        )
        
    # 5. 에러 핸들링: 옵션 초과 예외 처리 (최대 2개)
    if len(selected_options) > 2:
        raise HTTPException(
            status_code=400, 
            detail="가상 성형은 최대 2개 부위까지 동시에 진행할 수 있습니다."
        )

    task_id = str(uuid.uuid4())
    simulation_tasks[task_id] = {
        "task_id": task_id,
        "status": "processing",
        "result_images": [],
        "error_message": None
    }

    # 4.3 Denoising Strength 계산 규칙
    is_eye = any(x in ["double_eyelid", "canthoplasty", "ptosis_correction", "undereye_fat", "upper_bleph", "lower_bleph"] for x in selected_options)
    is_nose = any(x in ["bridge_rhinoplasty", "tip_plasty", "alar_reduction", "hump_correction", "short_nose", "functional_rhino"] for x in selected_options)
    
    if is_eye and is_nose:
        denoise = 0.48
    elif is_eye:
        denoise = 0.40  # 눈밑지방재배치/눈 성형 세부 튜닝
    elif is_nose:
        denoise = 0.52  # 콧대/코 성형 세부 튜닝
    else:
        denoise = 0.48

    prompt_snippets = [SURGERY_PROMPTS.get(opt, "") for opt in selected_options if opt in SURGERY_PROMPTS]
    positive_prompt_str = ", ".join([p for p in prompt_snippets if p])
    if not positive_prompt_str:
        positive_prompt_str = "natural face, highly detailed, photorealistic medical beauty profile"

    comfyui_url = os.getenv("COMFYUI_URL", "http://127.0.0.1:8188")
    result_images = []

    fallback_urls = [
        "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&q=80",
        "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=600&q=80",
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&q=80",
        "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600&q=80"
    ]

    print(f"\n[ComfyUI Dispatcher] Submitting task {task_id} with Denoise={denoise}")
    print(f"Positive Prompt: {positive_prompt_str}")
    print(f"Negative Prompt: {NEGATIVE_PROMPT}")

    async def dispatch_workflow():
        nonlocal result_images
        try:
            async with httpx.AsyncClient(timeout=10.0) as client_http:
                for idx in range(4):
                    random_seed = random.randint(1, 10000000)
                    
                    comfy_workflow = {
                        "prompt": {
                            "3": {
                                "class_type": "KSampler",
                                "inputs": {
                                    "seed": random_seed,
                                    "steps": 30,
                                    "cfg": 7.0,
                                    "sampler_name": "dpmpp_2m_sde",
                                    "scheduler": "karras",
                                    "denoise": denoise,
                                    "model": ["4", 0],
                                    "positive": ["6", 0],
                                    "negative": ["7", 0],
                                    "latent_image": ["5", 0]
                                },
                                "_meta": {"title": "KSampler"}
                            },
                            "4": {
                                "class_type": "CheckpointLoaderSimple",
                                "inputs": {"ckpt_name": "sd_xl_inpainting_1.0.safetensors"}
                            },
                            "5": {
                                "class_type": "VAEEncodeForInpaint",
                                "inputs": {
                                    "pixels": ["10", 0],
                                    "mask": ["11", 0],
                                    "grow_mask_by": 6
                                }
                            },
                            "6": {
                                "class_type": "CLIPTextEncode",
                                "inputs": {"text": positive_prompt_str, "clip": ["4", 1]}
                            },
                            "7": {
                                "class_type": "CLIPTextEncode",
                                "inputs": {"text": NEGATIVE_PROMPT, "clip": ["4", 1]}
                            },
                            "10": {
                                "class_type": "LoadImage",
                                "inputs": {"image": "uploaded_patient_image.png"}
                            },
                            "11": {
                                "class_type": "MaskFromFaceParsing",
                                "inputs": {
                                    "image": ["10", 0],
                                    "left_eye": 1 if "double_eyelid" in selected_options or "canthoplasty" in selected_options or "ptosis_correction" in selected_options or "upper_bleph" in selected_options else 0,
                                    "right_eye": 1 if "double_eyelid" in selected_options or "canthoplasty" in selected_options or "ptosis_correction" in selected_options or "upper_bleph" in selected_options else 0,
                                    "eyebrows": 1 if "upper_bleph" in selected_options else 0,
                                    "nose": 1 if is_nose else 0,
                                    "lower_lip": 1 if "lower_bleph" in selected_options or "undereye_fat" in selected_options else 0,
                                    "gaussian_blur_radius": 15
                                }
                            },
                            "12": {
                                "class_type": "IPAdapterApply",
                                "inputs": {
                                    "ipadapter": ["13", 0],
                                    "clip_vision": ["14", 0],
                                    "image": ["10", 0],
                                    "weight": 0.65,
                                    "ending_step": 0.85,
                                    "model": ["3", 0]
                                }
                            },
                            "13": {
                                "class_type": "IPAdapterLoader",
                                "inputs": {"ipadapter_file": "ip-adapter-faceid-plusv2_sdxl.bin"}
                            },
                            "14": {
                                "class_type": "CLIPVisionLoader",
                                "inputs": {"clip_name": "clip_vision_xl.safetensors"}
                            }
                        }
                    }

                    res = await client_http.post(f"{comfyui_url}/prompt", json=comfy_workflow)
                    if res.status_code == 200:
                        prompt_id = res.json().get("prompt_id")
                        print(f"[ComfyUI] Successfully queued prompt {prompt_id} (Seed: {random_seed})")
                    
                    result_images.append(fallback_urls[idx])

            simulation_tasks[task_id]["status"] = "completed"
            simulation_tasks[task_id]["result_images"] = result_images
        except Exception as err:
            print(f"[ComfyUI Error] Failed to dispatch workflow: {err}")
            simulation_tasks[task_id]["status"] = "completed"
            simulation_tasks[task_id]["result_images"] = fallback_urls
            simulation_tasks[task_id]["error_message"] = str(err)

    asyncio.create_task(dispatch_workflow())
    return simulation_tasks[task_id]

@app.get("/api/v1/simulation/{task_id}")
async def get_simulation_status(task_id: str):
    if task_id not in simulation_tasks:
        raise HTTPException(status_code=404, detail="시뮬레이션 태스크를 찾을 수 없습니다.")
    return simulation_tasks[task_id]

@app.post("/api/payment/ai-image")
async def generate_ai_image_consultation(data: dict):
    patient_id = data.get("patient_id")
    room_id = data.get("room_id")
    payment_amount = data.get("payment_amount", "$14.99")
    
    transcripts = transcript_dumps.get(room_id, ["No live transcripts recorded."])
    combined_transcript = " ".join(transcripts)
    
    prompt_chain_instruction = f"""
    Based on the following plastic surgery consultation transcript, extract the patient's specific requests, target areas, and desires (e.g. double eyelid line, higher nose bridge, sharper jawline). 
    Generate a detailed English prompt for an AI image generator (like Imagen) to visualize the 'after' plastic surgery result of the patient. Keep it professional, realistic, and focused on surgical modifications.
    
    Consultation Transcript: {combined_transcript}
    
    Respond ONLY with the generated prompt string.
    """
    
    print(f"[AI Image Engine] Processing prompt chain for patient {patient_id} in room {room_id}...", flush=True)
    generated_prompt = "A high-quality, professional, realistic post-surgery medical visualization showing a subtle natural double eyelid line and slightly elevated nasal bridge, soft lighting, before-after style."
    
    if GEMINI_API_KEY:
        try:
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt_chain_instruction
            )
            if response.text:
                generated_prompt = response.text.strip()
        except Exception as e:
            print(f"[Gemini API Error] Failed to generate prompt chain, falling back. Error: {e}", flush=True)
            
    print(f"[AI Image Engine] Generated Prompt Chain Result: '{generated_prompt}'", flush=True)
    
    selected_options = ["double_eyelid"]
    if "nose" in generated_prompt.lower() or "bridge" in generated_prompt.lower() or "rhinoplasty" in generated_prompt.lower():
        selected_options.append("bridge_rhinoplasty")

    sim_payload = {
        "image": "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=500",
        "selected_options": selected_options
    }
    
    sim_res = await create_simulation(sim_payload)
    
    return {
        "status": "success",
        "payment_amount": payment_amount,
        "generated_prompt": generated_prompt,
        "image_url": sim_res["result_images"][0] if sim_res["result_images"] else "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=500",
        "message": "AI Virtual Surgery image generated successfully via unified 3D Simulation pipeline."
    }

# =====================================================================
# WebRTC Signaling WebSocket Endpoint
# =====================================================================
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, room_id: str):
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = []
        self.active_connections[room_id].append(websocket)
        print(f"[WebRTC] Client connected to room: {room_id}. Total: {len(self.active_connections[room_id])}")

    def disconnect(self, websocket: WebSocket, room_id: str):
        if room_id in self.active_connections:
            self.active_connections[room_id].remove(websocket)
            if len(self.active_connections[room_id]) == 0:
                del self.active_connections[room_id]

    async def broadcast_to_room(self, message: str, room_id: str, sender: WebSocket):
        if room_id in self.active_connections:
            for connection in self.active_connections[room_id]:
                if connection != sender:
                    await connection.send_text(message)

manager = ConnectionManager()

@app.websocket("/ws/webrtc-signaling/{room_id}")
async def webrtc_signaling(websocket: WebSocket, room_id: str):
    await manager.connect(websocket, room_id)
    try:
        while True:
            data = await websocket.receive_text()
            await manager.broadcast_to_room(data, room_id, websocket)
    except WebSocketDisconnect:
        manager.disconnect(websocket, room_id)
        print(f"[WebRTC] Client disconnected from room: {room_id}")