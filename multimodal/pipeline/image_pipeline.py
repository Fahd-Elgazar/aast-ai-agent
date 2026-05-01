from vision.llava_client import describe_image
from reasoning.gemma_client import refine_description
from vision.scene_classifier import detect_scene_type
from vision.dynamic_prompt import get_prompt
import json


def clean_json_response(text):
    if not text:
        return ""

    text = text.strip()

    # remove markdown blocks ```json ... ```
    if "```" in text:
        parts = text.split("```")
        if len(parts) >= 2:
            text = parts[1]

    text = text.strip()

    # remove leading 'json' if exists
    if text.lower().startswith("json"):
        text = text[4:].strip()

    # remove any leading junk before first {
    if "{" in text:
        text = text[text.index("{"):]

    # remove any trailing junk after last }
    if "}" in text:
        text = text[:text.rindex("}") + 1]

    return text.strip()

# ✅ parse آمن
def safe_json_parse(text):
    try:
        return json.loads(text)
    except Exception:
        return {
            "error": "Invalid JSON",
            "raw_output": text
        }


def analyze_image(image_bytes):

    # 1️⃣ detect scene type
    scene_type = detect_scene_type(image_bytes)

    # 2️⃣ dynamic prompt
    prompt = get_prompt(scene_type)

    # 3️⃣ vision (LLaVA)
    raw_desc = describe_image(image_bytes, prompt)

    # 4️⃣ reasoning (Gemma)
    structured_text = refine_description(raw_desc)

    # 5️⃣ clean output
    cleaned_text = clean_json_response(structured_text)

    # 6️⃣ parse JSON
    structured_json = safe_json_parse(cleaned_text)

    return {
        "scene_type": scene_type,
        "raw": raw_desc,
        "structured": structured_json,
        "enhanced": structured_text   # optional for debugging
    }