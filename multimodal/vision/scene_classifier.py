from vision.llava_client import describe_image


def detect_scene_type(image_bytes):
    prompt = """
Classify the image into ONE of these categories:
- human
- object
- environment
- vehicle
- document
- screen

Only return the category name.
"""
    result = describe_image(image_bytes, prompt)
    return result.strip().lower()