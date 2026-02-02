import os
from dotenv import load_dotenv
import google.generativeai as genai
from pathlib import Path

# Load API Key
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)
api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    print("❌ Error: API Key not found!")
else:
    print(f"✅ Key found: {api_key[:5]}...")
    genai.configure(api_key=api_key)

    print("\n🔍 Checking available models...")
    try:
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                print(f"   - {m.name}")
    except Exception as e:
        print(f"❌ Error listing models: {e}")