# Model Failover Audit

Audit date: 2026-06-21  
Repository root audited: `C:\AI_AGENT`  
Branch observed: `recovery-baseline`  
Mode: read-only. No code, config, Docker, package, image, or database changes were made.

## Executive Finding

The production model chain is configured as:

1. Deterministic bypass where evidence/rules are sufficient.
2. Gemma primary via Ollama for unified final synthesis.
3. Gemini backup from `unifiedAnswerService` after Gemma failure.
4. Deterministic fallback if Gemini is unavailable or invalid.

The Ollama-local backup model (`tinyllama:latest`) exists in config, but unified final synthesis calls Gemma with `allowBackup=false`. That means `tinyllama` is not the real final-answer backup for the main unified synthesis path. Gemini is.

## Primary User-Facing Entry Point

Source: `C:\AI_AGENT\aast-ai-agent-main\backend\orchestrator.js`

- Route: `POST /api/chatbot/query`
- Request body fields: `query`, `cid`
- Main route families observed in code: `KG_DIRECT`, `KG_ONLY`, `RAG_DIRECT`, `RAG_ONLY`, `HYBRID_KG_RAG`, `DECISION_ENGINE`, `CAREER_ENGINE`, `LLM_FALLBACK`
- Final synthesis handoff: `generateUnifiedAnswer(...)`
- Humanizer path is present but live-disabled with `GEMINI_HUMANIZER_ENABLED=false`.
- Intent extraction LLM path is present but live-disabled with `LLM_INTENT_ENABLED=false`.

## Unified Final Synthesis

Source: `C:\AI_AGENT\aast-ai-agent-main\backend\services\unifiedAnswerService.js`

Functions:

- `generateUnifiedAnswer()`
- `runFinalSynthesis()`
- `runOllamaSynthesis()`

Model path:

- `runFinalSynthesis()` logs Gemma synthesis active and calls `runOllamaSynthesis(... allowBackup:false)`.
- `runOllamaSynthesis()` calls `generateStableResponse()` with model `PRIMARY_MODEL` / `OLLAMA_MODEL`, live `gemma4:e2b`.
- If Gemma fails, `runFinalSynthesis()` records the failure reason and calls `generateGeminiSynthesis()`.
- If Gemini succeeds, metadata returns `synthesis_provider=gemini_backup` and `gemma_primary_used=false`.
- If Gemini fails, deterministic fallback is returned and `deterministic_fallback_total` is incremented.

Timeouts:

- Live primary synthesis timeout: `PRIMARY_TIMEOUT_MS=60000`.
- Live synthesis deadline: `SYNTHESIS_DEADLINE_MS=60000`.
- Live cold start timeout: `PRIMARY_COLD_START_TIMEOUT_MS=90000`.
- Live Gemini synthesis timeout: `GEMINI_SYNTHESIS_TIMEOUT_MS=7000`.

Retry logic:

- Live `PRIMARY_RETRY_LIMIT=0`.
- Live `BACKUP_RETRY_LIMIT=0`.
- Unified synthesis does not retry Gemini locally.

Queue limits:

- Gemma calls enter `GemmaRequestLimiter`.
- Live `GEMMA_MAX_ACTIVE_REQUESTS=1`.
- Live `GEMMA_QUEUE_MAX_DEPTH=2`.
- Live `GEMMA_QUEUE_TIMEOUT_MS=8000`.

Breaker logic:

- `ollamaService` consults `modelFailoverManager` before generation.
- In `PRIMARY_COLD`, Gemma is still considered available for user traffic.
- Unified synthesis does not allow Ollama-local backup takeover because `allowBackup=false`.

## Ollama/Gemma Call Inventory

### Central Ollama Generation

Source: `C:\AI_AGENT\aast-ai-agent-main\backend\services\ollamaService.js`

Functions:

- `generateStableResponse()`
- `generateWithRetries()`

Calls:

- POST to Ollama generation endpoint through the centralized Ollama client.
- Primary model live value: `gemma4:e2b`.
- Backup model live value: `tinyllama:latest`, but only used when `allowBackup=true` and failover rules permit.

Timeouts:

- Primary: `PRIMARY_TIMEOUT_MS=60000`.
- Cold start: `PRIMARY_COLD_START_TIMEOUT_MS=90000`.
- Backup: `BACKUP_TIMEOUT_MS` from config if backup path is used.

Retry logic:

- Primary retry limit live: `0`.
- Backup retry limit live: `0`.
- Errors are classified as retryable/non-retryable and circuit-eligible/non-circuit-eligible.

Queue limits:

- All Gemma generation goes through `gemmaRequestLimiter.run()`.
- Live active limit: 1.
- Live pending queue depth: 2.
- Live queue timeout: 8 seconds.

Breaker logic:

- `modelFailoverManager.getInitialRoute()` decides primary/backup/none.
- `recordFailure` and error classification decide whether primary failure affects the circuit.
- Local backup requires `allowBackup=true`, a circuit-eligible failure, and threshold/failover conditions.
- Unified final synthesis uses `allowBackup=false`, so local backup is suppressed there.

### Health Monitor Ollama Probes

Source: `C:\AI_AGENT\aast-ai-agent-main\backend\services\healthMonitor.js`

Functions:

- `checkTags()`
- `validateModelInstallations()`
- `probeModel()`
- `preloadModels()`

Calls:

- `/api/tags` for availability/install checks.
- `/api/generate` for one-token generation probes and startup preload.

Timeouts:

- Tags timeout from health config.
- Startup preload timeout live path observed at cold-start scale.

Retry logic:

- Not the same retry path as user generation.
- Startup preload records model health but does not increment Gemma request counters.

Queue limits:

- Health probes do not use `GemmaRequestLimiter`.

Breaker logic:

- Failed primary preload can mark `PRIMARY_COLD`.
- Tags success alone can still leave health reporting model availability even if generation is broken.

### KG Embedding Calls

Source: `C:\AI_AGENT\aast-ai-agent-main\backend\services\neo4jcontext.js`

Function:

- Ollama embeddings helper for KG retrieval.

Calls:

- Ollama `/api/embeddings`.
- Model: `nomic-embed-text`.

Timeouts:

- Default embedding timeout: 30000 ms unless overridden.

Retry logic:

- Default max attempts: 2 unless overridden.

Queue limits:

- No Gemma queue; this is embedding traffic, not Gemma generation.

Breaker logic:

- No central Gemma circuit breaker for embedding calls.

### KG Graph Refine and Safe Reformat

Source: `C:\AI_AGENT\aast-ai-agent-main\backend\services\neo4jcontext.js`

Functions:

- Graph refine path.
- Safe reformat path.

Calls:

- Both can call `generateStableResponse()` and therefore Gemma/Ollama.

Live state:

- `KG_GRAPH_REFINE_ENABLED=false`.
- `KG_SAFE_REFORMAT_ENABLED=false`.
- `SINGLE_GEMMA_GENERATION_MODE=true`.

Timeouts and retry:

- Refine/reformat have bounded short timeouts and low attempts in code, but are live-disabled.

Breaker logic:

- If enabled, they go through central Ollama service behavior.

### Decision Extraction Ollama Path

Source: `C:\AI_AGENT\aast-ai-agent-main\backend\services\decisionService.js`

Function:

- LLM fallback extraction for profile data.

Calls:

- Internal `callOllama()` path.

Live state:

- `DECISION_LLM_EXTRACTION_ENABLED=false`.
- `SINGLE_GEMMA_GENERATION_MODE=true`.
- Therefore disabled in the observed runtime.

Timeouts:

- Code path uses a 12000 ms Ollama timeout, an 18000 ms deadline, and a 60000 ms outer wrapper.

Retry logic:

- Not observed live because disabled.

Queue limits:

- Not active live.

Breaker logic:

- Not active live.

### Gemma Warm Service

Source: `C:\AI_AGENT\aast-ai-agent-main\backend\services\gemmaWarmService.js`

Function:

- Warm-pool preflight/warm response behavior.

Live state:

- `GEMMA_WARM_POOL_ENABLED=false`.
- Service records inactive state and does not warm Gemma.

Calls if enabled:

- `generateStableResponse()` with `allowBackup=false` and `recordFailure=false`.

Timeouts:

- Warm-pool timeout from config.

Retry logic:

- Uses central Ollama path but health-like failure recording.

Queue limits:

- Would use central generation path if enabled.

Breaker logic:

- `recordFailure=false` means warm failures are not equivalent to user-traffic circuit failures.

### Python RAG Answer Engine

Source: `C:\AI_AGENT\aast-ai-agent-main\backend\rag_system\phase4_llm_answer_engine.py`

Function:

- RAG answer generation service.

Calls:

- Ollama `/api/generate` using `RAG_ANSWER_MODEL` / `OLLAMA_RAG_MODEL` / `PRIMARY_MODEL` fallback.

Live state:

- `RAG_ANSWER_ENGINE_ENABLED=false`.
- Therefore the service returns retrieval-only behavior and does not generate with Ollama.

Timeouts:

- Configured request timeout in code; live generation disabled.

Retry logic:

- No active generation retry observed.

Queue limits:

- No GemmaRequestLimiter; Python service is separate.

Breaker logic:

- No shared Node model failover breaker.

## Gemini Call Inventory

### Gemini Backup Synthesis

Source: `C:\AI_AGENT\aast-ai-agent-main\backend\services\geminiService.js`

Function:

- `generateGeminiSynthesis()`

Caller:

- `runFinalSynthesis()` in `unifiedAnswerService.js`.

Model:

- Live `GEMINI_MODEL=gemini-2.5-flash`.

Timeout:

- Live `GEMINI_SYNTHESIS_TIMEOUT_MS=7000`.

Retry logic:

- No local retry loop in the service.
- Errors are categorized, but `runFinalSynthesis()` either accepts success or falls to deterministic fallback.

Queue limits:

- No queue limiter observed for Gemini.

Breaker logic:

- Not part of `modelFailoverManager`.
- Counted through `gemini_fallback_total` only when Gemini backup succeeds in final synthesis.

### Gemini Humanizer

Source: `C:\AI_AGENT\aast-ai-agent-main\backend\services\conversationalHumanizer.js`

Function:

- `humanizeGroundedAnswer()`

Live state:

- `GEMINI_HUMANIZER_ENABLED=false`.
- Humanizer is skipped.

Timeout/retry/breaker:

- If enabled, calls `generateGeminiSynthesis()` and validates output; live-disabled.

### Decision API Gemini

Sources:

- `C:\AI_AGENT\college-decision-system-backend\app\application\services\agent_service.py`
- `C:\AI_AGENT\college-decision-system-backend\app\application\services\speech_service.py`

Live state:

- `DECISION_GEMINI_ENABLED=false`.
- `VOICE_ENABLED=false`.
- Decision API Gemini paths are not active in the observed compose runtime.

## Failover Chain Proven by Live Probe

The forced backend unified-synthesis probe produced this chain:

1. Primary configured as `gemma4:e2b`.
2. Startup preload failed for Gemma and set breaker state to `PRIMARY_COLD`.
3. Final synthesis attempted Gemma anyway because `PRIMARY_COLD` still allows primary traffic.
4. Gemma failed with `Ollama returned empty response`.
5. Local Ollama backup was not activated because unified final synthesis used `allowBackup=false`.
6. Gemini backup succeeded and produced the final answer.

Final model-owner verdict:

- Configured primary: Gemma.
- Intended code backup for final synthesis: Gemini.
- Effective answer-producing model when current Gemma generation fails: Gemini.
