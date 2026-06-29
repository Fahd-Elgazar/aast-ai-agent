# Runtime Validation Report

Generated: 2026-06-25T23:09:16.2024333+03:00
Workspace: C:\AI_AGENT
Startup method used: `docker compose up -d --build` from `C:\AI_AGENT`.

## Startup Result

- Docker Desktop was initially unavailable; launching Docker Desktop brought the Linux engine online.
- `docker compose up -d --build` exit code: 0.
- Evidence log: `C:\AI_AGENT\runtime_validation_tmp\remote_ollama_runtime\docker-compose-up-build.log`.
- Service state evidence: `C:\AI_AGENT\runtime_validation_tmp\remote_ollama_runtime\docker-compose-ps.json`.

## Service Status

| Validation item | Result | Evidence |
|---|---|---|
| Backend starts successfully | PASS | `aast-ai-agent-backend-1` running and healthy on `127.0.0.1:8004`. |
| Retriever starts successfully | PASS | `aast-ai-agent-rag-retriever-1` running and healthy on `127.0.0.1:8001`. |
| Decision API starts successfully | PASS | `aast-ai-agent-decision-api-1` running and healthy on `127.0.0.1:8005`. |
| Frontend starts successfully | PASS | `aast-ai-agent-frontend-1` running and healthy on `127.0.0.1:5173`. |
| No service crashes | PASS | `docker compose ps --format json` shows all Compose services running/healthy. |
| Remote Ollama endpoint injected | PASS | backend and rag-answer container env both show `OLLAMA_BASE_URL=http://192.168.100.16:11434`. |
| No remote Ollama connection errors | PASS/PARTIAL | No connection refused/DNS errors observed; remote `/api/tags` succeeds, but remote generation returns HTTP 500. |
| No unresolved active localhost:11434 references | PASS/PARTIAL | Active runtime config/source scan is clean; remaining matches are documentation/diagram/generated or backup/report evidence. |

## Container Env Proof

```text
backend OLLAMA_BASE_URL=http://192.168.100.16:11434
rag-answer OLLAMA_BASE_URL=http://192.168.100.16:11434
backend PRIMARY_MODEL=gemma4:e2b
backend RAG_RETRIEVER_URL=http://rag-retriever:8001
```

## Host Health Probes

| Probe | URL | Status | Duration ms |
|---|---|---:|---:|
| backend /health | `http://127.0.0.1:8004/health` | 200 | 246 |
| backend /api/health | `http://127.0.0.1:8004/api/health` | 200 | 92 |
| rag-retriever /health | `http://127.0.0.1:8001/health` | 200 | 73 |
| rag-answer /health | `http://127.0.0.1:8002/health` | 200 | 63 |
| decision-api /health | `http://127.0.0.1:8005/health` | 200 | 35 |
| frontend / | `http://127.0.0.1:5173/` | 200 | 23 |

## Captured Warnings And Errors

- Backend logs prove remote endpoint usage: `tags_url` and `base_url` are `http://192.168.100.16:11434`.
- Backend startup warning: remote `gemma4:e2b` preload failed with `Ollama probe returned HTTP 500`.
- Backend startup warning: remote `tinyllama:latest` backup model is missing. This was not changed because model names must not be altered.
- Decision API warning: `google.generativeai` package is deprecated; this is pre-existing and not related to Ollama migration.
- RAG retriever warning: Hugging Face `resume_download` deprecation; service remains healthy.
- No stack traces or container crashes observed in the captured tail logs.

## Runtime Verdict

- Service runtime: PASS.
- Remote Ollama generation readiness: FAIL, because the remote `gemma4:e2b` runner returns HTTP 500.
- Overall runtime validation: PARTIAL.

