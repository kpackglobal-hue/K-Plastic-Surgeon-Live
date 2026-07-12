import asyncio
import os
from dotenv import load_dotenv
from mcp_translator import TranslatorMCP

async def main():
    try:
        load_dotenv()
        t = TranslatorMCP()
        res = await t.start_translation('안녕하세요', 'en')
        print('Translation:', res)
    except Exception as e:
        print('Error:', e)

if __name__ == "__main__":
    asyncio.run(main())
