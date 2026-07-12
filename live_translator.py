import os
import asyncio
from google import genai
from google.genai import types

MODEL = "models/gemini-3.1-flash-live-preview"

class LiveTranslatorSession:
    def __init__(self, target_lang, client_websocket):
        self.target_lang = target_lang
        self.client_websocket = client_websocket
        
        api_key = os.getenv("GEMINI_API_KEY", os.getenv("STITCH_API_KEY", os.getenv("GOOGLE_API_KEY")))
        
        self.client = genai.Client(
            http_options={"api_version": "v1beta"},
            api_key=api_key
        )
        self.config = types.LiveConnectConfig(
            response_modalities=["AUDIO"],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Zephyr")
                )
            ),
            system_instruction=types.Content(
                parts=[types.Part.from_text(text=f"""You are a professional, bidirectional real-time interpreter specializing in plastic surgery consultations for "K-Plastic Surgeon Live".
- If the input is in Korean, translate it into {self.target_lang}.
- If the input is in {self.target_lang}, translate it into Korean.
- Maintain a highly professional, clinical, authoritative, yet empathetic tone befitting an expert plastic surgeon. 
- Use precise medical and anatomical terminology where appropriate, ensuring the translated nuances match a formal clinical setting.
- Output ONLY the translated text and audio. Do not add your own commentary, explanations, or conversational responses.""")],
                role="user"
            ),
        )

    async def receive_from_gemini(self, session):
        try:
            while True:
                turn = session.receive()
                async for response in turn:
                    if response.data:
                        # Send audio bytes to the frontend
                        await self.client_websocket.send_bytes(response.data)
                    if response.text:
                        # Send text to frontend for display
                        # Sending text directly over websocket
                        await self.client_websocket.send_text(response.text)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            print(f"Error receiving from Gemini: {e}")

    async def run(self):
        try:
            async with self.client.aio.live.connect(model=MODEL, config=self.config) as session:
                gemini_receive_task = asyncio.create_task(self.receive_from_gemini(session))
                
                try:
                    # The main loop will read from client_websocket and send to Gemini
                    while True:
                        message = await self.client_websocket.receive()
                        if "bytes" in message:
                            # Send raw PCM audio to Gemini
                            await session.send(input={"data": message["bytes"], "mime_type": "audio/pcm"})
                        elif "text" in message:
                            # Send text to Gemini (e.g. for control or typing fallback)
                            await session.send(input=message["text"] or ".", end_of_turn=True)
                except Exception as e:
                    print(f"WebSocket closed or error: {e}")
                finally:
                    gemini_receive_task.cancel()
        except Exception as e:
            print(f"Failed to connect to Gemini Live: {e}")
