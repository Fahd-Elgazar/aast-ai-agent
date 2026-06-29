# Remote Ollama Compatibility

Audit date: 2026-06-21  
Repository root: `C:\AI_AGENT`  
Branch observed: current checked-out branch, `recovery-baseline`  
Mode: read-only audit.

## Compatibility Answer

PARTIAL.

Changing only `OLLAMA_BASE_URL` is sufficient for the active Docker backend generation path to call a remote Ollama HTTP endpoint. It is not sufficient to prove the full architecture remains intact if Machine B hosts only `gemma4:e2b`, because the backend also uses the same `OLLAMA_BASE_URL` for `nomic-embed-text` embeddings in KG retrieval.

## Required Evidence By File

### `ollamaService.js`

Evidence:

- `ollamaService.js:369-380` sends generation requests to `LLM_CONFIG.generateUrl`.
- `llmConfig.js:46-59` builds `generateUrl` from `OLLAMA_BASE_URL`.
- `ollamaService.js:445-634` wraps the call in retry, queue, metrics, and breaker accounting.
- `ollamaService.js:737-955` chooses primary/backup route and calls `generateWithRetries()`.

Compatibility:

- Remote generation through `OLLAMA_BASE_URL`: YES.
- Hardcoded local host in generation path: NO.
- Direct local model-file dependency: NOT FOUND in this path.

### `unifiedAnswerService.js`

Evidence:

- `unifiedAnswerService.js:423-456` calls `generateStableResponse()` with the selected primary model.
- `unifiedAnswerService.js:488-638` attempts Gemma first, then Gemini backup, then deterministic fallback.
- `unifiedAnswerService.js:2366-2385` is the final synthesis step.
- `unifiedAnswerService.js:2433-2462` returns model/failover metadata.

Compatibility:

- Remote Gemma final synthesis: YES, through `ollamaService`.
- Local Ollama assumption: NO in active final synthesis code.
- Note: final synthesis passes `allowBackup=false`; Gemini backup is separate from local Ollama backup.

### `modelFailoverManager.js`

Evidence:

- `modelFailoverManager.js:112-177` starts readiness and startup validation.
- `modelFailoverManager.js:321-353` selects primary, backup, or none.
- `modelFailoverManager.js:356-373` allows backup only after failover rules.
- `modelFailoverManager.js:545-614` exposes active runtime model and health fields.

Compatibility:

- Remote Ollama readiness through `OLLAMA_BASE_URL`: YES, because it delegates to `HealthMonitor`.
- Hardcoded local host: NO.
- Remote risk: if remote `/api/tags` is slow or unreachable, startup can remain waiting/open.

### `healthMonitor.js`

Evidence:

- `healthMonitor.js:168-220` checks `${OLLAMA_BASE_URL}/api/tags`.
- `healthMonitor.js:222-303` validates installed primary and backup models from `/api/tags`.
- `healthMonitor.js:305-383` probes models through `${OLLAMA_BASE_URL}/api/generate`.
- `healthMonitor.js:385-457` preloads primary and backup models.

Compatibility:

- Remote `/api/tags` and `/api/generate`: YES.
- Hardcoded local host: NO.
- Remote requirement: remote Ollama must list required models. `gemma4:e2b` is required for primary; `tinyllama:latest` is configured as backup but missing backup is degraded/nonfatal when primary is installed.

### `runtimeMode.js`

Evidence:

- `runtimeMode.js:20-33` reads mode flags from env.
- `runtimeMode.js:39-46` reports primary/backup model from env.

Compatibility:

- Remote host dependency: NONE.
- It does not know where Ollama lives; it only reports model names and feature flags.

### `decisionService.js`

Evidence:

- `decisionService.js:5` imports `callOllama`.
- `decisionService.js:204+` has LLM extraction path.
- Running backend env has `DECISION_LLM_EXTRACTION_ENABLED=false`.
- Decision API compose env has `DECISION_GEMINI_ENABLED=false`.

Compatibility:

- Current runtime decision LLM extraction impact: NO active Gemma dependency.
- If enabled, it routes through central `ollamaService`, therefore remote-compatible through `OLLAMA_BASE_URL`.

### KG Services / `neo4jcontext.js`

Evidence:

- `neo4jcontext.js:9` reads `process.env.OLLAMA_BASE_URL || http://localhost:11434`.
- `neo4jcontext.js:27-35` calls `${OLLAMA_BASE_URL}/api/embeddings` with model `nomic-embed-text`.
- `neo4jcontext.js:110-129` graph-refine path can call Gemma via `generateStableResponse()`, but live flags disable it.
- `neo4jcontext.js:166-230` safe reformat can call Gemma via `generateStableResponse()`, but live flags disable it.

Compatibility:

- Remote through `OLLAMA_BASE_URL`: YES.
- Gemma-only remote: NO / PARTIAL.
- Evidence-based blocker: remote Ollama must provide `nomic-embed-text` for KG semantic embedding calls, not only `gemma4:e2b`.

### RAG Services

Evidence:

- `phase3_retriever.py:41-48` uses `BAAI/bge-m3` with `RAG_EMBEDDING_DEVICE=cpu`.
- Running rag-retriever env showed `RAG_EMBEDDING_DEVICE=cpu`.
- `Dockerfile.retriever:14` installs CPU-only PyTorch.
- `phase4_llm_answer_engine.py:36-46` derives Ollama generate/tags URLs from `OLLAMA_BASE_URL`.
- `phase4_llm_answer_engine.py:299-312` returns retrieval-only answer if `RAG_ANSWER_ENGINE_ENABLED=false`.
- Running rag-answer env showed `RAG_ANSWER_ENGINE_ENABLED=false`.

Compatibility:

- RAG retrieval: unaffected by remote Gemma.
- RAG answer generation: remote-compatible through `OLLAMA_BASE_URL` if enabled.
- Current runtime: RAG answer generation is disabled, so no active RAG Answer Gemma call.

## Hardcoded Local Assumptions Found

Active Docker production path:

- `llmConfig.js` and `neo4jcontext.js` have localhost fallbacks, but current Docker env sets `OLLAMA_BASE_URL`.
- No hardcoded local host was found in the active final synthesis generation call once env is set.

Non-Docker / optional / offline:

- `launcher\start_platform.ps1` sets `OLLAMA_BASE_URL=http://localhost:11434`.
- `embed_nodes.py` hardcodes `http://localhost:11434/api/embeddings`.
- Multimodal helpers hardcode `http://localhost:11434/api/generate`.
- Mirrored old backend files under `aast-ai-agent-main\frontend\aast-ai-agent-main` hardcode localhost.

## Final Compatibility Determination

PARTIAL.

Evidence supports remote Ollama for the Docker backend and RAG Answer HTTP paths through `OLLAMA_BASE_URL`. Evidence does not support the narrower claim that only Gemma can be moved while all other Ollama responsibilities stay local, because KG embeddings also use `OLLAMA_BASE_URL`.
