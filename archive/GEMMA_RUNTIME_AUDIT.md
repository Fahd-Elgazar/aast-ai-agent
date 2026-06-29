# Gemma Runtime Audit

Audit date: 2026-06-21  
Repository root audited: `C:\AI_AGENT`  
Branch observed: `recovery-baseline`  
Mode: read-only production runtime audit. No source, config, Docker image, package, or database changes were made.

## Executive Verdict

Gemma is configured as the primary model (`gemma4:e2b`) and the unified synthesis layer attempts it when final synthesis is reached. Current live evidence does not prove that Gemma is serving real production HTTP answers. Direct Gemma generation failed, and a forced backend unified-synthesis probe showed Gemma being attempted under `PRIMARY_COLD`, failing with an empty/500 response, and Gemini producing the final answer as `synthesis_provider=gemini_backup`.

For the sampled production HTTP traffic, all requests bypassed model synthesis through deterministic, clarification, or empty-evidence paths. Therefore the main backend metrics remained at `gemma_requests_total=0` and `gemini_fallback_total=0` for those sampled HTTP requests.

## Runtime Baseline

Live stack evidence from `docker compose -f C:\AI_AGENT\docker-compose.yml ps`:

- Project: `aast-ai-agent`
- Backend image: `aast-ai-agent/backend:local`
- Backend port: `127.0.0.1:8004->8004`
- Backend container status: running but Docker healthcheck reported unhealthy.
- Backend `/health` showed Ollama reachable but overall health false because Neo4j driver was not initialized.
- RAG answer service was running with answer generation disabled.

Backend runtime environment from `docker compose config`:

- `PRIMARY_MODEL=gemma4:e2b`
- `BACKUP_MODEL=tinyllama:latest`
- `GEMINI_BACKUP_ENABLED=true`
- `GEMINI_MODEL=gemini-2.5-flash`
- `OLLAMA_BASE_URL=http://host.docker.internal:11434`
- `PRIMARY_TIMEOUT_MS=60000`
- `SYNTHESIS_TIMEOUT_MS=60000`
- `SYNTHESIS_DEADLINE_MS=60000`
- `PRIMARY_COLD_START_TIMEOUT_MS=90000`
- `PRIMARY_RETRY_LIMIT=0`
- `BACKUP_RETRY_LIMIT=0`
- `PRIMARY_MAX_FAILURES=3`
- `GEMMA_MAX_ACTIVE_REQUESTS=1`
- `GEMMA_QUEUE_MAX_DEPTH=2`
- `GEMMA_QUEUE_TIMEOUT_MS=8000`
- `GEMMA_WARM_POOL_ENABLED=false`
- `SINGLE_GEMMA_GENERATION_MODE=true`
- `LLM_INTENT_ENABLED=false`
- `KG_GRAPH_REFINE_ENABLED=false`
- `KG_SAFE_REFORMAT_ENABLED=false`
- `RAG_ANSWER_ENGINE_ENABLED=false`
- `DECISION_LLM_EXTRACTION_ENABLED=false`
- `GEMINI_HUMANIZER_ENABLED=false`
- `STARTUP_PRELOAD_ENABLED=true`
- `PERIODIC_HEALTH_ENABLED=true`

Secrets such as `GEMINI_API_KEY` were present but are intentionally not reproduced.

## Direct Ollama/Gemma Evidence

Direct Ollama inventory showed the required models installed:

- `gemma4:e2b`
- `gemma4:e4b`
- `tinyllama:latest`
- `nomic-embed-text:latest`
- `llava:latest`

Direct `tinyllama:latest` generation succeeded.

Direct `gemma4:e2b` generation failed with runner-level evidence:

- `llama-server process no longer running: exit status 0xc0000409`
- Windows reported a stack-based buffer overrun.
- Ollama runner reported `CUDA error: shared object initialization failed`.

This proves that model installation is not the same as successful Gemma generation in the current host/runtime state.

## Backend Unified-Synthesis Probe

A read-only `docker exec` probe in the running backend container imported backend services and invoked `generateUnifiedAnswer()` with synthetic verified RAG evidence so that final synthesis could be reached without modifying source or database state.

Observed startup state in that process:

- `/api/tags` succeeded.
- `gemma4:e2b` was installed.
- Startup preload for `gemma4:e2b` failed with `Ollama probe returned HTTP 500`.
- Startup preload for `tinyllama:latest` succeeded.
- Circuit state became `PRIMARY_COLD`.
- `active_runtime_model` still reported `gemma4:e2b`.
- `primary_cold_start_pending=true`.
- `preload_warning=true`.

Observed final synthesis:

- `runFinalSynthesis()` attempted Gemma first.
- `ollamaService` logged a primary cold-start live retry with timeout `90000`.
- Gemma failed with `Ollama returned empty response`.
- `allowBackup=false` prevented the Ollama-local backup path from taking over.
- `unifiedAnswerService` invoked Gemini backup.
- Gemini returned a final answer.

Result metadata from the probe:

- `model=gemini-2.5-flash`
- `synthesis_provider=gemini_backup`
- `gemma_primary_used=false`
- `gemini_backup_used=true`
- `primary_model=gemma4:e2b`
- `backup_model=tinyllama:latest`
- `breaker_state=PRIMARY_COLD`
- `primary_failures=1`
- `failover_active=false`

This is direct proof of the reported contradiction: the runtime can report Gemma as the configured and active primary while the actual final answer comes from Gemini backup.

## Production HTTP Probe Evidence

Three production-style calls were sent to `POST /api/chatbot/query` on the running backend. All were read-only normal query calls.

Observed outcomes:

- Decision/golden-path major recommendation returned deterministic rule-engine output with `llm_bypassed=true` and `unified_answer_bypassed=true`.
- Ambiguous academic-planning query returned a conversation clarification and bypassed Neo4j, RAG, Gemini, Ollama, and unified synthesis.
- Policy/support query was route-locked into a KG/curriculum path; Neo4j driver was not initialized, so it returned deterministic missing-evidence behavior with LLM bypass.

Metrics after those HTTP probes:

- `http_chatbot_query_total=3`
- `http_chatbot_success_total=3`
- `gemma_requests_total=0`
- `gemma_success_total=0`
- `gemma_failure_total=0`
- `gemma_timeout_total=0`
- `gemini_fallback_total=0`
- `deterministic_fallback_total=0`

This does not prove Gemma is healthy. It proves the sampled production HTTP paths did not reach the final model synthesis layer.

## End-to-End Route Flow

### KG_DIRECT

Execution path:

- Entry: `C:\AI_AGENT\aast-ai-agent-main\backend\orchestrator.js`, `POST /api/chatbot/query`.
- Brain/router classification locks to `KG_DIRECT` for strong KG/curriculum aliases.
- KG retrieval uses `fetchNeo4jContext()`.
- In this live stack, Neo4j driver initialization failure can force deterministic empty-evidence behavior.

Synthesis path:

- Strong direct KG answers can return deterministic output before unified synthesis.
- Clarification and empty-KG paths also bypass unified synthesis.
- If KG evidence falls through to synthesis, `generateUnifiedAnswer()` receives KG context and normalizes route handling.

Model path:

- Deterministic KG direct paths use no Gemma/Gemini.
- If unified synthesis is reached, Gemma primary is attempted by `runFinalSynthesis()` through `runOllamaSynthesis()`.

Failover path:

- Gemma failure is caught by `runFinalSynthesis()`.
- Gemini backup is invoked when `GEMINI_BACKUP_ENABLED=true`.
- If Gemini fails or is disabled, deterministic fallback is returned.

### KG_ONLY

Execution path:

- Entry: `orchestrator.js` chatbot query route.
- KG route uses Neo4j context retrieval.
- Empty or unclear KG results can terminate deterministically.

Synthesis path:

- Deterministic KG shortcuts bypass synthesis.
- Otherwise `generateUnifiedAnswer()` receives KG evidence with route `KG_ONLY`.

Model path:

- Unified final synthesis attempts Gemma primary.
- Gemini is not first in code; it is invoked only after Gemma failure in `runFinalSynthesis()`.

Failover path:

- Gemma failure -> Gemini backup -> deterministic fallback.
- Ollama-local backup (`tinyllama`) is not used in unified final synthesis because `allowBackup=false`.

### RAG_DIRECT

Execution path:

- Entry: `orchestrator.js`.
- RAG search path is selected for direct policy/official-document style queries.
- RAG service retrieves passages from the RAG retriever/Qdrant path.

Synthesis path:

- Strong direct RAG evidence can be formatted deterministically and returned with `Ollama Calls: 0`.
- Empty RAG evidence returns deterministic fallback.
- Non-direct RAG evidence can pass to unified synthesis.

Model path:

- Direct deterministic RAG uses no model.
- Unified synthesis uses Gemma first, then Gemini backup on Gemma failure.

Failover path:

- Gemma failure -> Gemini backup -> deterministic fallback.

### RAG_ONLY

Execution path:

- Entry: `orchestrator.js`.
- RAG retrieval runs without KG synthesis as the primary evidence source.
- RAG answer-engine generation is disabled live (`RAG_ANSWER_ENGINE_ENABLED=false`), so the Python RAG answer service does not generate answers with Ollama.

Synthesis path:

- Empty evidence returns deterministic missing-evidence output.
- Strong policy evidence may return deterministic output.
- Otherwise final synthesis goes through `generateUnifiedAnswer()`.

Model path:

- Unified synthesis attempts `gemma4:e2b`.
- Current forced probe of this route showed Gemma failure and Gemini success.

Failover path:

- Gemma primary failure -> Gemini backup.
- Gemini failure -> deterministic fallback.

### HYBRID_KG_RAG

Execution path:

- Entry: `orchestrator.js`.
- KG and RAG evidence are gathered and combined.
- If both evidence sources are empty, the route can degrade toward `LLM_FALLBACK` or deterministic missing-evidence behavior.

Synthesis path:

- Golden/direct multi-source paths may bypass LLM.
- Otherwise `generateUnifiedAnswer()` receives both KG and RAG evidence and resolves the route to hybrid synthesis.

Model path:

- Gemma primary is attempted when final synthesis is reached.
- Gemini backup is used only after Gemma failure.

Failover path:

- Gemma -> Gemini -> deterministic fallback.

### DECISION_ENGINE

Execution path:

- Entry: `orchestrator.js`.
- Decision/rule-engine logic handles major recommendation and eligibility-style requests.
- Live `DECISION_LLM_EXTRACTION_ENABLED=false`; decision LLM extraction is disabled.
- Decision API Gemini is disabled in compose (`DECISION_GEMINI_ENABLED=false`).

Synthesis path:

- Golden decision paths return deterministic decision output and bypass unified synthesis.
- Non-golden decision evidence can be passed to `generateUnifiedAnswer()` as decision context.

Model path:

- Deterministic decision paths use no model.
- Unified decision synthesis uses Gemma first, then Gemini backup if Gemma fails.

Failover path:

- Gemma -> Gemini -> deterministic fallback.

### CAREER_ENGINE

Execution path:

- Entry: `orchestrator.js`.
- Career rule handling builds deterministic career/roadmap evidence.

Synthesis path:

- Golden career paths can bypass final synthesis.
- Otherwise career context can be passed to unified synthesis.

Model path:

- Deterministic career paths use no model.
- Unified synthesis uses Gemma first.

Failover path:

- Gemma -> Gemini -> deterministic fallback.

### LLM_FALLBACK

Execution path:

- Entry: `orchestrator.js`.
- Used when route classification or evidence retrieval cannot ground the request in KG/RAG/decision/career paths.
- In live single-Gemma mode, the pre-synthesis Gemma fallback generation is bypassed to enforce the one-Gemma-generation policy.

Synthesis path:

- If there is no verified evidence, `generateUnifiedAnswer()` can return deterministic fallback before model synthesis.
- If final synthesis is reached with evidence, the same unified final synthesis chain applies.

Model path:

- Gemma primary is attempted only when final synthesis is reached.
- Gemini backup is invoked only after Gemma primary failure.

Failover path:

- Gemma -> Gemini -> deterministic fallback.
- If no verified context exists, deterministic fallback may occur before any model call.

## Bottom Line

Gemma is the configured primary model and is attempted by the intended unified synthesis chain. In the live state observed during this audit, direct Gemma generation failed and backend unified synthesis failed over to Gemini. Therefore Gemma is not proven to be serving real production answers; Gemini is effectively the answer-producing model for unified synthesis whenever Gemma fails and Gemini backup is enabled.
