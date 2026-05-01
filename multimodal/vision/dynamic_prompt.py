def get_prompt(scene_type):

    if "vehicle" in scene_type:
        return """
Analyze the vehicle in the image.
Describe condition, visible issues, and surroundings.
Ignore UI.
"""

    elif "human" in scene_type:
        return """
Describe the person, actions, emotions, and context.
Ignore UI.
"""

    elif "document" in scene_type:
        return """
Extract and summarize the visible content.
"""

    elif "screen" in scene_type:
        return """
Describe what is displayed on the screen.
"""

    else:
        return """
Describe the real-world scene including objects, environment, and actions.
Ignore UI elements.
"""