# Docker Reconciliation Report

Canonical build root: `C:\AI_AGENT`
Secondary workspace dependency: none.

## Build Command

```powershell
docker compose -f C:\AI_AGENT\docker-compose.yml build backend frontend decision-api rag-retriever rag-answer
```

Result: PASS. Docker reported all five images built:

- `aast-ai-agent/backend:local`
- `aast-ai-agent/frontend:local`
- `aast-ai-agent/decision-api:local`
- `aast-ai-agent/rag-retriever:local`
- `aast-ai-agent/rag-answer:local`

## Canonical Context Proof

`docker compose -f C:\AI_AGENT\docker-compose.yml config` renders build contexts under `C:\AI_AGENT` only:

- Backend: `C:\AI_AGENT\aast-ai-agent-main\backend`
- Frontend: `C:\AI_AGENT\aast-ai-agent-main\frontend`
- Decision API: `C:\AI_AGENT\college-decision-system-backend`
- RAG Retriever: `C:\AI_AGENT\aast-ai-agent-main\backend\rag_system`
- RAG Answer: `C:\AI_AGENT\aast-ai-agent-main\backend\rag_system`

No build context points to `C:\Users\mh978\Downloads\AI_AGENT n`.

## Image IDs

| Image | Image ID / digest | Created |
| --- | --- | --- |
| `aast-ai-agent/backend:local` | `sha256:2db5e0abf8d63b26c68a35a0c4be06ea6d6b25e02ce751b121df8dc0748c7eb7` | `2026-06-20T22:39:52Z` |
| `aast-ai-agent/frontend:local` | `sha256:8210a7950e400b514d3b75fca0bc9e1e8a455ca75615e63f470036601994017c` | `2026-06-20T22:35:18Z` |
| `aast-ai-agent/decision-api:local` | `sha256:a589a1c7d8087af55e9b47101b922042c7b645166a5a8f645776e0cee783afbe` | `2026-06-20T11:40:37Z` |
| `aast-ai-agent/rag-retriever:local` | `sha256:816a5354e2f2ccc227eb12c16b66e6b9432a5ee6a0d31cbac6cfed9dea49fe4a` | `2026-06-20T22:40:13Z` |
| `aast-ai-agent/rag-answer:local` | `sha256:df0bf7aeb1259d61cd78553f8b465bd09e9e9c2a852a59466310a6af8d434310` | `2026-06-20T11:40:28Z` |

Cached images still passed the compose build command from the canonical contexts above.

## Backend Image Verification

Command evidence:

```powershell
docker run --rm --entrypoint sh aast-ai-agent/backend:local -c "test -f /app/config/runtimeMode.js && test -f /app/services/runtimeMode.js && grep -q getRuntimeModeStatus /app/config/runtimeMode.js && grep -q buildRuntimeMetricsSnapshot /app/routes/health.js && grep -q gemini_fallback_total /app/routes/health.js && echo backend_runtime_metrics_files_present"
```

Result: PASS, output `backend_runtime_metrics_files_present`.

Runtime helper inside the backend image returned:

```json
{"runtimeModeLoaded":true,"singleGemmaGenerationMode":true,"geminiBackupEnabled":true,"primaryModel":"gemma4:e2b","backupModel":"tinyllama:latest"}
```

Dependency check inside the backend image:

```text
cli-table3@0.6.5
node-fetch@3.3.2
```

## RAG Retriever Image Verification

Command evidence:

```powershell
docker run --rm --entrypoint python aast-ai-agent/rag-retriever:local -c "import transformers, accelerate; print(transformers.__version__); print(accelerate.__version__)"
```

Result: PASS.

- `transformers=4.41.2`
- `accelerate=1.14.0`

## RAG Answer Image Verification

Command evidence:

```powershell
docker run --rm --entrypoint python aast-ai-agent/rag-answer:local -m py_compile /app/phase4_llm_answer_engine.py
```

Result: PASS.

## Decision API Image Verification

Command evidence:

```powershell
docker run --rm --entrypoint python aast-ai-agent/decision-api:local -m compileall -q /app/app
```

Result: PASS.

## Frontend Image Verification

Command evidence:

```powershell
docker run --rm --entrypoint sh aast-ai-agent/frontend:local -c "test -f /usr/share/nginx/html/index.html && test -d /usr/share/nginx/html/assets && echo frontend_assets_present"
```

Result: PASS, output `frontend_assets_present`.

## Docker Verdict

PASS. Docker images built from `C:\AI_AGENT` contain the accepted Gemma migration/runtime mode, metrics exposure, package dependencies, and RAG retriever dependency updates. No Docker proof depends on Workspace B.