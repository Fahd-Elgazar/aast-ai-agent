# Hardware Dependency Report

Audit date: 2026-06-21  
Repository root: `C:\AI_AGENT`  
Branch observed: current checked-out branch, `recovery-baseline`  
Mode: read-only audit.

## Verdict

No current Machine A Docker service requires local GPU access.

The only GPU-relevant workload in the target architecture is Ollama/Gemma on Machine B. Even that is not expressed as a repository-level Docker dependency; it is an external Ollama runtime property.

## Service Hardware Table

| Service | GPU required? | GPU optional? | CPU only by current config? | Evidence |
|---|---:|---:|---:|---|
| Backend Orchestrator | No | No evidence | Yes | `backend\Dockerfile` uses `node:20-bookworm-slim`; Compose has no GPU device config; Gemma calls are HTTP through `OLLAMA_BASE_URL`. |
| Neo4j | No | No evidence | Yes | Compose uses `neo4j:5.26-community`, memory env only, no GPU runtime. |
| Qdrant | No | No evidence | Yes | Compose uses `qdrant/qdrant:v1.12.5`, no GPU runtime. |
| Decision API | No | No evidence | Yes | `college-decision-system-backend\Dockerfile` uses `python:3.11-slim`; Compose has `DECISION_GEMINI_ENABLED=false`; no Ollama/GPU device config. |
| RAG Retriever | No | Not in current image | Yes | `Dockerfile.retriever:14` installs `torch==2.3.1+cpu`; Compose sets `RAG_EMBEDDING_DEVICE=cpu`; running env confirmed `RAG_EMBEDDING_DEVICE=cpu`. |
| RAG Answer | No | No local GPU evidence | Yes | `Dockerfile.answer` is Python slim; live `RAG_ANSWER_ENGINE_ENABLED=false`; if enabled it calls Ollama over HTTP. |
| Frontend | No | No evidence | Yes | Frontend build uses Node and runtime NGINX; no GPU config. |
| Remote Ollama / Gemma on Machine B | Not proven by repo | Yes for performance, outside repo | Not proven | Ollama is not a Compose service in `docker-compose.yml`; hardware need depends on Machine B Ollama runtime and model behavior, not Machine A services. |

## Evidence Details

Dockerfiles:

- `aast-ai-agent-main\backend\Dockerfile:1-15` uses Node, no GPU packages.
- `aast-ai-agent-main\backend\rag_system\Dockerfile.retriever:14` installs CPU-only PyTorch from the CPU wheel index.
- `aast-ai-agent-main\backend\rag_system\Dockerfile.answer:1-15` uses Python slim and runs Uvicorn.
- `college-decision-system-backend\Dockerfile:1-21` uses Python slim and Uvicorn.
- `aast-ai-agent-main\frontend\Dockerfile:1-22` builds with Node and serves via NGINX.

Compose:

- `docker-compose.yml` contains no NVIDIA runtime, GPU device reservation, or CUDA service config.
- `docker-compose.yml:121` sets `RAG_EMBEDDING_DEVICE` default to CPU.
- `docker-compose.yml:127-128` sets CPU thread variables for RAG retriever.

Code:

- `phase3_retriever.py:41-48` defaults embedding device to CPU.
- `phase3_retriever.py:146-154` passes `device=EMBEDDING_DEVICE` to SentenceTransformer.
- `phase3_retriever.py:212-222` exposes the device in status.
- `ollamaService.js` only sends HTTP requests; it does not load a local GPU model.
- `ollamaService.js:113-126` only classifies `cuda` text as a possible remote/local Ollama error.

## Hardware Separation Conclusion

Machine A can continue running Backend, Neo4j, Qdrant, Decision API, RAG Retriever, RAG Answer, and Frontend without local GPU access under current Docker config.

Machine B must carry the Ollama model-serving burden for any models reached through `OLLAMA_BASE_URL`. From source evidence, that means at least `gemma4:e2b` for final synthesis and `nomic-embed-text` for KG embeddings if KG semantic retrieval is required.
