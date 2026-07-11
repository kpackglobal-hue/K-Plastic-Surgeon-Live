import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()

# API 키 설정 (환경 변수 사용 권장)
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

class TranslatorMCP:
    def __init__(self):
        self.model = genai.GenerativeModel("gemini-1.5-flash")

    async def start_translation(self, text, target_lang):
        prompt = f"당신은 성형외과 전문 통역사입니다. 다음 내용을 {target_lang}로 정확하게 번역하세요: {text}"
        # 동기 호출이지만 FastAPI websocket 안에서 블로킹되지 않으려면
        # asyncio.to_thread 등을 쓰거나 generate_content_async를 사용해야 할 수도 있습니다.
        # 여기서는 제공해주신 코드 원본을 유지합니다.
        response = self.model.generate_content(prompt)
        return response.text
