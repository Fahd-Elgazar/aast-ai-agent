# Decision API

FastAPI service for explainable college and program recommendations, tuition calculations, and optional voice input.

## Commands

```powershell
python -m pip install -r requirements-dev.txt
python -m pytest -q
python -m uvicorn app.main:app --host 0.0.0.0 --port 8005
```

Copy `.env.example` to `.env` and replace the internal secret before starting outside Docker.

Voice transcription and decision-side Gemini are optional because they add a large
PyTorch/Whisper dependency set. Install them only when needed:

```powershell
python -m pip install -r requirements-optional.txt
```

For an optional-feature Docker image, build with
`--build-arg INSTALL_OPTIONAL_AI=true`.
