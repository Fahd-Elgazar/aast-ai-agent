import requests

OLLAMA_URL = "http://192.168.1.7:11434/api/generate"
MODEL = "gemma4:e2b"

def refine_description(text):
    prompt = f"""
You are an intelligent multimodal AI assistant.

Analyze the following image description and convert it into structured JSON.

Rules:
- Be general (not specific to cars or any domain)
- Extract meaningful information
- No extra text, ONLY JSON

Format:
{{
  "objects": [],
  "scene": "",
  "actions": [],
  "attributes": [],
  "description": ""
}}

Description:
{text}
"""

    response = requests.post(
        OLLAMA_URL,
        json={
            "model": MODEL,
            "prompt": prompt,
            "stream": False
        }
    )

    if response.status_code != 200:
        raise Exception(f"Gemma error: {response.text}")

    return response.json()["response"]
