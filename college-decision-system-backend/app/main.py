from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.routers import admin, chat, decisions, students
from app.application.services.speech_service import get_voice_runtime_status
from app.config.settings import settings


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version="1.0.0",
        description=(
            "Production-ready college recommendation API backed by the normalized "
            "decision_* schema, fee resolution, and decision-data completeness safeguards."
        ),
        debug=settings.DEBUG,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(students.router, prefix="/api/v1")
    app.include_router(decisions.router, prefix="/api/v1")
    app.include_router(chat.router, prefix="/api/v1")
    if settings.VOICE_ENABLED:
        from app.api.v1.routers import voice

        app.include_router(voice.router, prefix="/api/v1")
    app.include_router(admin.router, prefix="/api/v1")

    @app.get("/health", tags=["system"])
    def health_check():
        return {
            "status": "ok",
            "voice": get_voice_runtime_status(),
            "startup": {
                "voice_router_enabled": settings.VOICE_ENABLED,
                "whisper_lazy_load": True,
            },
        }

    return app


app = create_app()
