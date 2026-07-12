from google import genai
import os
from dotenv import load_dotenv

load_dotenv()

# API 키 설정 (환경 변수 사용 권장)
api_key = os.getenv("STITCH_API_KEY") or os.getenv("GOOGLE_API_KEY")

class TranslatorMCP:
    def __init__(self):
        self.client = genai.Client(api_key=api_key)
        self.model = "gemini-3.5-flash"

    async def start_translation(self, text, target_lang):
        prompt = f"""You are a live medical translator.
The user spoke in either Korean or {target_lang}.
However, due to a browser Speech-to-Text limitation, foreign languages might be transcribed phonetically in Korean characters (e.g. '하우 알 유' -> 'How are you', or '마이 네임 이즈' -> 'My name is').
1. Determine if the original spoken language was likely Korean or {target_lang}.
2. If it was Korean, translate it to {target_lang}.
3. If it was {target_lang} (even if written phonetically in Korean), translate it to Korean.
Output ONLY the final translated text, without any explanations, alternatives, or greetings.
Input Text: {text}
"""
        response = await self.client.aio.models.generate_content(
            model=self.model,
            contents=prompt
        )
        return response.text
