# Local Dependency Audit

Audit date: 2026-06-21  
Repository root: `C:\AI_AGENT`  
Branch observed: current checked-out branch, `recovery-baseline`  
Mode: read-only audit.

## Classification Key

- `SAFE`: Evidence shows no blocker for remote Ollama in the current Docker production path.
- `WARNING`: Does not block the current Docker production path, but can mislead observability, local launch, offline scripts, or optional features.
- `BLOCKER`: Breaks the stated "Gemma on remote machine through OLLAMA_BASE_URL only" architecture unless the finding is handled by runtime config or remote model availability.

## Findings

| Classification | Finding | Evidence | Runtime meaning |
|---|---|---|---|
| SAFE | Central backend generation does not read local model files directly. | `ollamaService.js:369-380` posts to `LLM_CONFIG.generateUrl`; `llmConfig.js:46-59` derives that URL from `OLLAMA_BASE_URL`. | Gemma generation can be remote over HTTP. |
| SAFE | No Machine A Docker service has a GPU runtime requirement in Compose. | Dockerfiles use Node/Python/NGINX/Neo4j/Qdrant images; `Dockerfile.retriever:14` installs `torch==2.3.1+cpu`; Compose has no `deploy.resources.reservations.devices` or NVIDIA runtime. | Machine A services can remain CPU-only by current config. |
| SAFE | RAG retriever is configured CPU-only. | `docker-compose.yml:121` sets `RAG_EMBEDDING_DEVICE=${RAG_EMBEDDING_DEVICE:-cpu}`; running container showed `RAG_EMBEDDING_DEVICE=cpu`; `phase3_retriever.py:41-48` defaults to CPU. | Moving Gemma does not move RAG retrieval GPU work because there is no RAG GPU work in current runtime. |
| SAFE | Local cache volumes are not Gemma model storage. | `docker-compose.yml:100` decision Whisper cache; `docker-compose.yml:135-136` Hugging Face/Torch caches; Qdrant/Neo4j volumes are separate. | These caches stay on Machine A and do not require local Gemma/Ollama. |
| WARNING | Backend `.env` still points to localhost. | `aast-ai-agent-main\backend\.env:27` has `OLLAMA_BASE_URL=http://localhost:11434`. | Current Docker Compose overrides this with explicit `environment`, but non-Compose starts can still point to local Ollama. |
| WARNING | Backend `.env.example` still documents localhost. | `aast-ai-agent-main\backend\.env.example:24` has `OLLAMA_BASE_URL=http://localhost:11434`. | Documentation/template can mislead runtime setup, but it does not control the current running container. |
| WARNING | `llmConfig.js` fallback is localhost. | `llmConfig.js:46-49` falls back to `http://localhost:11434` only if env is absent. | Safe when Docker env is set; local Node runs without env will use local Ollama. |
| WARNING | Docker current default targets host-local Ollama. | `docker-compose.yml:41` and `154` default to `http://host.docker.internal:11434`; running containers currently show that value. | Remote migration requires the Compose interpolation source to set `OLLAMA_BASE_URL`; current live state is not remote. |
| BLOCKER | KG embeddings share `OLLAMA_BASE_URL` and require `nomic-embed-text`. | `neo4jcontext.js:27-35` posts to `${OLLAMA_BASE_URL}/api/embeddings` with model `nomic-embed-text`. | If `OLLAMA_BASE_URL` moves to Machine B and Machine B has only `gemma4:e2b`, KG semantic retrieval can fail. |
| WARNING | Offline Neo4j embedding script hardcodes local Ollama. | `embed_nodes.py:13-17` uses `http://localhost:11434/api/embeddings`, model `nomic-embed-text`. | Not part of the current Compose runtime, but rerunning this script after migration would still depend on Machine A local Ollama. |
| WARNING | Gemma telemetry is local-process based. | `gemmaTelemetryService.js:5` watches process names `ollama`, `ollama_llama_server`, `llama-server`; `:177-260` uses `tasklist` or `ps`; `:100-110` adds local Ollama RSS into memory pressure. | Remote Ollama memory/GPU pressure will not be measured from Machine A. Generation still works over HTTP, but telemetry and memory-pressure decisions become incomplete. |
| BLOCKER | Non-Docker launcher rewrites Ollama URL to localhost. | `launcher\start_platform.ps1:746` sets `OLLAMA_BASE_URL` to `http://localhost:11434`; `:555-588`, `:600-633`, and `:937` also assume local `11434`. | If this launcher is used for production instead of Docker Compose, changing only Compose `OLLAMA_BASE_URL` is insufficient. |
| WARNING | Multimodal Gemma helper hardcodes localhost. | `multimodal\reasoning\gemma_client.py:3-4` and `aast-ai-agent-main\frontend\multimodal\reasoning\gemma_client.py:3-4`. | Not proven active in the Docker stack; optional multimodal helper would still require local Ollama. |
| WARNING | LLaVA helper hardcodes localhost. | `multimodal\vision\llava_client.py:4-5` and mirrored frontend file. | Not Gemma-specific and not proven active in Docker; still a local Ollama assumption. |
| WARNING | Old/mirrored frontend backend copy has hardcoded localhost references. | Search found `aast-ai-agent-main\frontend\aast-ai-agent-main\backend\...` hardcoded local Ollama. | Not the active Compose backend context, but a repository-local copy could mislead audits or manual runs. |
| WARNING | `replace.js` hardcodes local Ollama. | `aast-ai-agent-main\replace.js:124,200`. | Not active production runtime evidence. |
| SAFE | Ollama CUDA strings are only error classification in backend code. | `ollamaService.js:113-126` classifies messages containing `cuda`, `runner`, or memory errors. | Machine A backend does not load CUDA artifacts; it only interprets remote/local Ollama error text. |

## Local Filesystem / Cache / Manifest Result

No active production generation path was found that reads local Ollama model manifests, local Ollama storage, or local model cache folders directly. The active generation path uses the Ollama HTTP API.

This conclusion is limited to source code and Docker configuration. The actual model files for `gemma4:e2b`, `tinyllama:latest`, and `nomic-embed-text` live inside whichever Ollama instance `OLLAMA_BASE_URL` points to. Their presence on Machine B is a runtime fact outside this repository and was not proven by a live remote probe.

## Bottom Line

Local Gemma filesystem/GPU coupling is not present in the main Docker generation path. The blockers are configuration/path coupling, not source-level model-file coupling:

- `BLOCKER`: KG embeddings require `nomic-embed-text` on the remote Ollama endpoint if `OLLAMA_BASE_URL` is moved.
- `BLOCKER`: `launcher\start_platform.ps1` forces local Ollama for launcher-based operation.
- `WARNING`: local memory telemetry becomes incomplete after remote migration.
