import json
import logging
import os
import re
import shutil
import subprocess
import threading
import time
from typing import Optional

from pydantic import BaseModel, ValidationError

from app.config.settings import settings

logger = logging.getLogger(__name__)

GREETING_REPLY_AR = (
    "\u0623\u0647\u0644\u0627\u064b \u0628\u0643! \u0623\u0646\u0627 "
    "\u0645\u0633\u0627\u0639\u062f \u0627\u0644\u0623\u0643\u0627\u062f\u064a\u0645\u064a\u0629 "
    "\u0627\u0644\u0630\u0643\u064a\u060c \u0642\u0648\u0644\u064a "
    "\u062d\u0627\u0628\u0628 \u062a\u062f\u0631\u0633 \u0625\u064a\u0647 "
    "\u0623\u0648 \u0645\u062c\u0645\u0648\u0639\u0643 \u0643\u0627\u0645 "
    "\u0639\u0634\u0627\u0646 \u0623\u0633\u0627\u0639\u062f\u0643\u061f"
)
IRRELEVANT_REPLY_AR = (
    "\u0639\u0641\u0648\u0627\u064b\u060c \u0644\u0645 \u0623\u0641\u0647\u0645 "
    "\u0637\u0644\u0628\u0643. \u0647\u0644 \u062a\u0648\u062f "
    "\u0627\u0644\u0627\u0633\u062a\u0641\u0633\u0627\u0631 \u0639\u0646 "
    "\u0627\u0644\u0643\u0644\u064a\u0627\u062a \u0627\u0644\u0645\u062a\u0627\u062d\u0629\u061f"
)


class ExtractedProfile(BaseModel):
    intent: str
    reply_message: Optional[str] = None
    student_gpa: Optional[float] = None
    interested_majors: list[str] = []
    preferred_location: Optional[str] = None
    constraints: Optional[str] = None


class SpeechService:
    def __init__(self):
        self._model = None
        self._llm_model = None
        self._genai_configured = False
        self._ffmpeg_exe = None
        self._load_lock = threading.Lock()
        self._llm_lock = threading.Lock()
        self.whisper_loaded_at: Optional[float] = None
        self.whisper_load_seconds: Optional[float] = None
        self.whisper_last_error: Optional[str] = None
        self.transcription_count = 0
        self.last_transcription_seconds: Optional[float] = None

    @property
    def whisper_model(self):
        if self._model is not None:
            return self._model

        with self._load_lock:
            if self._model is not None:
                return self._model

            logger.info(
                "Lazy-loading Whisper %s on %s.",
                settings.VOICE_WHISPER_MODEL,
                settings.VOICE_DEVICE,
            )
            start = time.time()
            try:
                import whisper

                self._model = whisper.load_model(
                    settings.VOICE_WHISPER_MODEL,
                    device=settings.VOICE_DEVICE,
                )
                self.whisper_loaded_at = time.time()
                self.whisper_load_seconds = round(self.whisper_loaded_at - start, 3)
                self.whisper_last_error = None
            except Exception as exc:
                self.whisper_last_error = str(exc)
                logger.exception("Whisper lazy-load failed.")
                raise

        return self._model

    @property
    def llm_model(self):
        if not settings.DECISION_GEMINI_ENABLED:
            raise RuntimeError("Decision Gemini extraction is disabled.")

        if self._llm_model is not None:
            return self._llm_model

        with self._llm_lock:
            if self._llm_model is not None:
                return self._llm_model

            import google.generativeai as genai

            if settings.GEMINI_API_KEY and not self._genai_configured:
                genai.configure(api_key=settings.GEMINI_API_KEY.get_secret_value())
                self._genai_configured = True

            self._llm_model = genai.GenerativeModel(
                "gemini-2.5-flash",
                system_instruction=(
                    "You are an expert in information extraction and intention classification. "
                    "You will receive a transcript of a student talking. "
                    "First, determine the Intent:\n"
                    "- 'greeting': If the user is just saying hello, asking how you are, etc.\n"
                    "- 'data_entry': If the user is providing scores, majors, or asking for a recommendation.\n"
                    "- 'irrelevant': If the user says something totally unrelated.\n\n"
                    "Then, extract the following into a JSON object strictly:\n"
                    "1. 'intent': (string) 'greeting', 'data_entry', or 'irrelevant'.\n"
                    f"2. 'reply_message': If intent is 'greeting', output '{GREETING_REPLY_AR}'. "
                    f"If intent is 'irrelevant', output '{IRRELEVANT_REPLY_AR}'. "
                    "If intent is 'data_entry', make this null.\n"
                    "3. 'student_gpa': (float) try to parse it if they say 'three point eight' -> 3.8. "
                    "4. 'interested_majors': (list of strings) e.g. ['computer science', 'engineering']. "
                    "5. 'preferred_location': (string) like a city or region. "
                    "6. 'constraints': (string) any other constraints like budget or preferences. "
                    "If information is missing, use null or empty lists."
                ),
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                ),
            )

        return self._llm_model

    def _get_ffmpeg_exe(self) -> str:
        if self._ffmpeg_exe:
            return self._ffmpeg_exe

        import imageio_ffmpeg

        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        if settings.VOICE_FFMPEG_LOCAL_COPY:
            local_ffmpeg = os.path.join(os.getcwd(), "ffmpeg.exe")
            if not os.path.exists(local_ffmpeg):
                shutil.copy(ffmpeg_exe, local_ffmpeg)
            ffmpeg_exe = local_ffmpeg

        self._ffmpeg_exe = ffmpeg_exe
        return ffmpeg_exe

    def transcribe_audio(self, file_path: str) -> str:
        logger.info("Transcribing %s", file_path)
        start = time.time()

        wav_path = file_path + ".wav"
        try:
            subprocess.run(
                [
                    self._get_ffmpeg_exe(),
                    "-y",
                    "-i",
                    file_path,
                    "-ar",
                    "16000",
                    "-ac",
                    "1",
                    wav_path,
                ],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            logger.info("Converted audio specifically for Whisper: %s", wav_path)
        except Exception as exc:
            logger.error("Audio conversion failed: %s", exc)
            wav_path = file_path

        result = self.whisper_model.transcribe(wav_path)
        text = result.get("text", "").strip()
        logger.info("Transcription result: %s", text)

        self.transcription_count += 1
        self.last_transcription_seconds = round(time.time() - start, 3)

        if wav_path != file_path and os.path.exists(wav_path):
            os.remove(wav_path)

        return text

    def extract_profile(self, text: str) -> ExtractedProfile:
        if not text:
            raise ValueError("No text provided for extraction, audio might be unclear or empty.")

        if not settings.DECISION_GEMINI_ENABLED:
            return self._extract_profile_deterministic(text)

        logger.info("Extracting profile using Gemini")
        response = self.llm_model.generate_content(text)
        try:
            data = json.loads(response.text)
            profile = ExtractedProfile(**data)

            if profile.student_gpa is not None:
                if profile.student_gpa < 0 or profile.student_gpa > 100:
                    logger.warning("Unusual GPA extracted: %s", profile.student_gpa)

            return profile
        except (json.JSONDecodeError, ValidationError) as exc:
            logger.error("Failed to parse Gemini response: %s", response.text)
            raise ValueError(f"Could not extract valid profile: {exc}")

    def _extract_profile_deterministic(self, text: str) -> ExtractedProfile:
        normalized = text.lower()
        if re.search(r"\b(hi|hello|hey|salam|good morning|good evening)\b", normalized):
            return ExtractedProfile(intent="greeting", reply_message=GREETING_REPLY_AR)

        major_keywords = [
            "ai", "artificial intelligence", "computer science", "engineering",
            "business", "pharmacy", "dentistry", "medicine", "logistics"
        ]
        interested = [keyword for keyword in major_keywords if keyword in normalized]
        number_match = re.search(r"\b(\d{1,3}(?:\.\d+)?)\b", normalized)
        gpa = float(number_match.group(1)) if number_match else None

        if interested or gpa is not None or "recommend" in normalized or "study" in normalized:
            return ExtractedProfile(
                intent="data_entry",
                student_gpa=gpa,
                interested_majors=interested,
            )

        return ExtractedProfile(intent="irrelevant", reply_message=IRRELEVANT_REPLY_AR)

    def runtime_status(self) -> dict:
        return {
            "enabled": settings.VOICE_ENABLED,
            "whisper_model": settings.VOICE_WHISPER_MODEL,
            "device": settings.VOICE_DEVICE,
            "whisper_loaded": self._model is not None,
            "whisper_loaded_at": self.whisper_loaded_at,
            "whisper_load_seconds": self.whisper_load_seconds,
            "whisper_last_error": self.whisper_last_error,
            "llm_loaded": self._llm_model is not None,
            "ffmpeg_resolved": self._ffmpeg_exe is not None,
            "transcription_count": self.transcription_count,
            "last_transcription_seconds": self.last_transcription_seconds,
        }


_speech_service_instance: Optional[SpeechService] = None
_speech_service_lock = threading.Lock()


def get_speech_service() -> SpeechService:
    global _speech_service_instance

    if _speech_service_instance is None:
        with _speech_service_lock:
            if _speech_service_instance is None:
                _speech_service_instance = SpeechService()
    return _speech_service_instance


def get_voice_runtime_status() -> dict:
    if _speech_service_instance is None:
        return {
            "enabled": settings.VOICE_ENABLED,
            "whisper_model": settings.VOICE_WHISPER_MODEL,
            "device": settings.VOICE_DEVICE,
            "whisper_loaded": False,
            "llm_loaded": False,
            "status": "deferred",
        }

    return {**_speech_service_instance.runtime_status(), "status": "ready"}
