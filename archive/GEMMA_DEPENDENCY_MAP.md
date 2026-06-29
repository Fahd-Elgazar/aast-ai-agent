# Gemma Dependency Map

Audit date: 2026-06-21  
Repository root: `C:\AI_AGENT`  
Branch observed: current checked-out branch, `recovery-baseline`  
Mode: read-only audit. No source, config, Docker, package, image, container, database, Qdrant, Neo4j, volume, branch, or commit changes were made.

## Verdict

The Docker production path is mostly remote-compatible through `OLLAMA_BASE_URL`, but `OLLAMA_BASE_URL` is not Gemma-only. It is shared by:

- Backend final Gemma synthesis.
- Backend optional intent, fallback, graph refine, and reformat paths.
- Backend KG embedding calls to `nomic-embed-text`.
- RAG Answer generation if `RAG_ANSWER_ENGINE_ENABLED=true`.
- RAG Answer Ollama health check if answer generation is enabled.

Therefore the remote target cannot be proven as "Gemma only" from the current code. If `OLLAMA_BASE_URL` is moved to Machine B, Machine B becomes the Ollama endpoint for both Gemma generation and KG embeddings.

## Active Runtime Configuration Evidence

Rendered/running Docker evidence:

- `docker-compose.yml:41` sets backend `OLLAMA_BASE_URL: ${OLLAMA_BASE_URL:-http://host.docker.internal:11434}`.
- `docker-compose.yml:154` sets rag-answer `OLLAMA_BASE_URL: ${OLLAMA_BASE_URL:-http://host.docker.internal:11434}`.
- Running backend container env showed `OLLAMA_BASE_URL=http://host.docker.internal:11434`.
- Running rag-answer container env showed `OLLAMA_BASE_URL=http://host.docker.internal:11434`.
- Running backend container env showed `PRIMARY_MODEL=gemma4:e2b`.
- Running backend container env showed `BACKUP_MODEL=tinyllama:latest`.
- Running rag-answer container env showed `RAG_ANSWER_MODEL=gemma4:e2b`.
- Running rag-answer container env showed `RAG_ANSWER_ENGINE_ENABLED=false`.
- Root `C:\AI_AGENT\.env` was not present.
- `aast-ai-agent-main\backend\.env:27` contains `OLLAMA_BASE_URL=http://localhost:11434`, but Compose explicit `environment` currently overrides the service `env_file` value.

## Dependency Table

| Caller file | Callee file | Call chain | Runtime dependency | Local dependency | Remote dependency |
|---|---|---|---|---|---|
| `aast-ai-agent-main\backend\orchestrator.js:3001-3016` | `aast-ai-agent-main\backend\services\unifiedAnswerService.js:2145-2385` | Chatbot query -> unified synthesis | Verified evidence context and route metadata | Backend service on Machine A | None beyond HTTP to backend services |
| `unifiedAnswerService.js:423-456` | `aast-ai-agent-main\backend\services\ollamaService.js:737-955` | `runOllamaSynthesis()` -> `generateStableResponse()` | `PRIMARY_MODEL` defaults to `gemma4:e2b`; final synthesis passes `allowBackup=false` | Backend process and in-memory metrics | Remote `/api/generate` must accept the selected model |
| `ollamaService.js:356-407` | Remote Ollama HTTP API | `executeOllamaRequest()` -> `LLM_CONFIG.generateUrl` | `LLM_CONFIG.generateUrl = OLLAMA_BASE_URL + /api/generate` | No direct local model files are read by this path | `http://REMOTE_IP:11434/api/generate`, model `gemma4:e2b` |
| `ollamaService.js:445-634` | `gemmaRequestLimiter.js`, `modelFailoverManager.js` | Generation retry/metrics/failure accounting | Gemma queue, timeouts, retry limits, breaker state | Backend process state | Remote latency and remote generation failures affect breaker |
| `modelFailoverManager.js:112-177` | `healthMonitor.js` | Startup readiness and model validation | `/api/tags` and optional preload | Backend process state | Remote `/api/tags`; remote `/api/generate` for preload |
| `healthMonitor.js:168-220` | Remote Ollama HTTP API | `checkTags()` | `LLM_CONFIG.tagsUrl = OLLAMA_BASE_URL + /api/tags` | None | Remote `/api/tags` reachable inside configured timeout |
| `healthMonitor.js:305-383` | Remote Ollama HTTP API | `probeModel()` | one-token generation probe | None | Remote `/api/generate` for `gemma4:e2b` and backup model if validated |
| `orchestrator.js:500-514` | `ollamaService.js` | LLM intent extraction | Live-disabled by `LLM_INTENT_ENABLED=false` | Backend process | If enabled, remote `/api/generate` |
| `orchestrator.js:2841-2865` | `ollamaService.js` | LLM fallback pre-synthesis | Live-bypassed by `SINGLE_GEMMA_GENERATION_MODE=true` | Backend process | If enabled, remote `/api/generate` |
| `aast-ai-agent-main\backend\services\neo4jcontext.js:15-87` | Remote Ollama HTTP API | KG semantic embedding -> `/api/embeddings` | `OLLAMA_BASE_URL`, model `nomic-embed-text`, 2 attempts, 30000 ms timeout | Neo4j remains local on Machine A | Remote must provide `nomic-embed-text` if this path is used |
| `neo4jcontext.js:89-164` | `ollamaService.js` | KG graph refine | Live-disabled by `KG_GRAPH_REFINE_ENABLED=false` and single-Gemma mode | Backend process | If enabled, remote `/api/generate` |
| `neo4jcontext.js:166-230` | `ollamaService.js` | Safe reformat | Live-disabled by `KG_SAFE_REFORMAT_ENABLED=false` and single-Gemma mode | Backend process | If enabled, remote `/api/generate` |
| `aast-ai-agent-main\backend\services\decisionService.js:204+` | `ollamaService.js` | Decision extraction LLM fallback | Live-disabled by `DECISION_LLM_EXTRACTION_ENABLED=false` | Decision memory file under backend working dir | If enabled, remote `/api/generate` |
| `aast-ai-agent-main\backend\services\gemmaWarmService.js:105-123` | `ollamaService.js` | Gemma warm-pool keepalive | Live-disabled by `GEMMA_WARM_POOL_ENABLED=false` | Backend timer/telemetry only | If enabled, remote `/api/generate` |
| `aast-ai-agent-main\backend\rag_system\phase4_llm_answer_engine.py:36-46` | Remote Ollama HTTP API | RAG Answer config | `OLLAMA_BASE_URL`, `OLLAMA_URL`, `OLLAMA_TAGS_URL`, `RAG_ANSWER_MODEL` | RAG Answer container on Machine A | Remote `/api/generate` and `/api/tags` if answer engine enabled |
| `phase4_llm_answer_engine.py:198-223` | Remote Ollama HTTP API | RAG Answer generation | Live-disabled by `RAG_ANSWER_ENGINE_ENABLED=false` | Retriever remains local via `rag-retriever:8001` | If enabled, remote `/api/generate`, model `gemma4:e2b` |
| `phase4_llm_answer_engine.py:483-490` | Remote Ollama HTTP API | RAG Answer health | Only checks Ollama when answer engine enabled | None | Remote `/api/tags` if enabled |
| `aast-ai-agent-main\backend\embed_nodes.py:13-17` | Local hardcoded Ollama | Offline embedding script | Hardcoded `http://localhost:11434/api/embeddings`, model `nomic-embed-text` | Local Ollama required by this script | Remote not used unless code/config changes; this is not the running Compose service |
| `launcher\start_platform.ps1:555-588, 741-750` | Local Ollama / local services | Non-Docker launcher path | Defaults and writes `OLLAMA_BASE_URL=http://localhost:11434` | Local Ollama on Machine A | Remote not used by launcher unless launcher env behavior is changed |
| `multimodal\reasoning\gemma_client.py:3-4` | Local hardcoded Ollama | Multimodal helper | Hardcoded `http://localhost:11434/api/generate`, model `gemma4:e2b` | Local Ollama | Remote not used unless file changes |
| `aast-ai-agent-main\frontend\multimodal\reasoning\gemma_client.py:3-4` | Local hardcoded Ollama | Mirrored multimodal helper | Hardcoded `http://localhost:11434/api/generate`, model `gemma4:e2b` | Local Ollama | Remote not used unless file changes |
| `aast-ai-agent-main\replace.js:124,200` | Local hardcoded Ollama | Replacement/demo script | Hardcoded `http://localhost:11434/api/generate` | Local Ollama | Remote not used unless file changes |

## Call Chain Summary

Primary production synthesis:

`POST /api/chatbot/query` -> `orchestrator.js` -> `generateUnifiedAnswer()` -> `runFinalSynthesis()` -> `runOllamaSynthesis()` -> `generateStableResponse()` -> `executeOllamaRequest()` -> `${OLLAMA_BASE_URL}/api/generate`.

Model health/readiness:

`ollamaService` module startup -> `modelFailoverManager.start()` -> `OllamaReadinessService.waitForReady()` -> `HealthMonitor.checkTags()` -> `${OLLAMA_BASE_URL}/api/tags`; startup preload -> `HealthMonitor.probeModel()` -> `${OLLAMA_BASE_URL}/api/generate`.

KG semantic retrieval:

`orchestrator.js` -> `fetchNeo4jContext()` -> `neo4jcontext.embed()` -> `${OLLAMA_BASE_URL}/api/embeddings`, model `nomic-embed-text`.

RAG retrieval:

`orchestrator.js` -> `ragService` -> `rag-retriever:8001`; retriever uses local CPU SentenceTransformer and Qdrant, not Ollama.

RAG answer generation:

`rag-answer:8002` -> `phase4_llm_answer_engine.py` -> `${OLLAMA_BASE_URL}/api/generate`, but live `RAG_ANSWER_ENGINE_ENABLED=false`, so generation is bypassed.

## Dependency Conclusion

Changing `OLLAMA_BASE_URL` redirects the active backend and RAG Answer Ollama HTTP calls. It does not redirect hardcoded non-Docker scripts, and it also redirects KG embeddings to Machine B. The dependency map is therefore `PARTIAL` for "Gemma-only remote" and `YES` for "single remote Ollama endpoint" if the remote endpoint has all Ollama models required by active paths.
