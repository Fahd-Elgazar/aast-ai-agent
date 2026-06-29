import requests
import base64

OLLAMA_URL = "http://192.168.1.7:11434/api/generate"
MODEL = "llava:latest"  

def describe_image(image_bytes, prompt = """
You are a powerful vision-language AI.

Carefully analyze the image.

Focus ONLY on the real-world scene and ignore:
- any UI elements
- text overlays
- screens, borders, or interfaces

Describe the image in a clear and detailed way including:
- main objects
- environment or scene
- actions or interactions
- important visual details (colors, condition, relationships)

Be precise, objective, and avoid assumptions.
"""

):
    
    image_base64 = base64.b64encode(image_bytes).decode("utf-8")

    response = requests.post(
        OLLAMA_URL,
        json={
            "model": MODEL,
            "prompt": prompt,
            "images": [image_base64],  # ✅ مش hex
            "stream": False
        }
    )

    if response.status_code != 200:
        raise Exception(f"LLaVA error: {response.text}")

    return response.json()["response"]
