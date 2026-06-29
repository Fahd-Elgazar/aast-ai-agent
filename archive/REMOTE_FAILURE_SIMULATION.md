# Remote Failure Simulation

Audit date: 2026-06-21  
Repository root: `C:\AI_AGENT`  
Branch observed: current checked-out branch, `recovery-baseline`  
Mode: read-only audit. No code or runtime state was changed.

## Simulation Basis

This is a source/config/runtime-config simulation only. No remote Machine B endpoint was used.

Evidence used:

- `llmConfig.js:46-59` builds Ollama URLs from `OLLAMA_BASE_URL`.
- `ollamaService.js:369-407` sends generation requests and treats empty responses as failures.
- `ollamaService.js:445-634` handles retry, metrics, timeouts, and circuit failure recording.
- `ollamaService.js:747-889` rejects open/waiting circuits or attempts primary generation.
- `unifiedAnswerService.js:488-638` falls back Gemma -> Gemini -> deterministic context fallback.
- `healthMonitor.js:168-220` checks `/api/tags`.
- `healthMonitor.js:305-383` probes `/api/generate`.
- `modelFailoverManager.js:321-353` chooses primary/backup/none.
- `circuitStateManager.js:65-76` treats `PRIMARY_COLD` as primary-available and `DEGRADED/HALF_OPEN` as backup-use states.
- `neo4jcontext.js:27-35` uses `${OLLAMA_BASE_URL}/api/embeddings` for KG embeddings.

## Case A: Remote Ollama Healthy

Expected route:

- Deterministic routes still bypass Ollama.
- Unified synthesis routes call remote `/api/generate` through `OLLAMA_BASE_URL`.
- KG embedding routes call remote `/api/embeddings` through `OLLAMA_BASE_URL`.
- RAG retrieval stays local to Machine A and Qdrant.

Expected fallback:

- No fallback if remote Gemma generation succeeds.
- Gemini backup remains available after Gemma failure.

Expected user impact:

- Normal answer behavior plus network latency.
- KG semantic retrieval succeeds only if remote Ollama has `nomic-embed-text`.

Architecture impact:

- Machine A keeps all services except Ollama/Gemma.
- Machine B must serve all Ollama API calls that share `OLLAMA_BASE_URL`.

Evidence status:

- Source/config supports this.
- Live remote success is NOT PROVEN.

## Case B: Remote Ollama Unavailable

Expected route:

- Startup readiness waits for Ollama through `/api/tags`.
- If unreachable, readiness can remain waiting or validation can mark `CRITICAL_OLLAMA_UNAVAILABLE`.
- Runtime generation calls can throw `LLM_WAITING_FOR_OLLAMA` or `LLM_CIRCUIT_OPEN`.

Expected fallback:

- Deterministic bypass routes still work if they do not need KG embeddings.
- Unified synthesis catches Gemma failure and uses Gemini backup when enabled.
- If Gemini fails or is disabled, deterministic fallback is used when available.
- KG semantic retrieval can fail because embeddings also use remote Ollama.

Expected user impact:

- Deterministic/golden routes may continue.
- KG semantic paths can degrade or fail.
- Unified synthesis can become Gemini-produced.
- If both remote Ollama and Gemini fail, user receives deterministic insufficient-evidence/fallback behavior.

Architecture impact:

- Backend remains up if its own service dependencies are healthy, but LLM readiness/health reports degraded/open/waiting.
- Neo4j and Qdrant storage are unaffected.

Evidence status:

- Source/config supports this.
- Exact live user-visible response depends on route and evidence; NOT PROVEN for every query.

## Case C: Gemma Unavailable

Expected route:

- If remote `/api/tags` does not list `gemma4:e2b`, startup validation marks primary missing.
- If backup is listed, the circuit can enter degraded behavior.
- If neither primary nor backup is listed, circuit can open.
- If Gemma is listed but generation fails, the primary failure path is used.

Expected fallback:

- Unified final synthesis: Gemma failure -> Gemini backup -> deterministic fallback.
- Local Ollama backup only participates when failover routing selects backup or `allowBackup` permits fallback; final synthesis explicitly calls with `allowBackup=false`.

Expected user impact:

- Gemini can become the effective answer-producing model for unified synthesis.
- Deterministic routes still work.
- If KG embeddings remain available, KG retrieval may still work. If remote Ollama lacks `nomic-embed-text`, KG semantic retrieval can fail independently of Gemma.

Architecture impact:

- Machine A services remain separated.
- Model readiness and response metadata may show primary failure/degraded/cold/open states.

Evidence status:

- Source supports this.
- Actual remote Gemma availability on Machine B is NOT PROVEN.

## Case D: Gemma Timeout

Expected route:

- Generation calls use primary/synthesis deadlines from config.
- Current running backend env includes `PRIMARY_TIMEOUT_MS=60000`, `SYNTHESIS_TIMEOUT_MS=60000`, `SYNTHESIS_DEADLINE_MS=60000`, `PRIMARY_COLD_START_TIMEOUT_MS=90000`.
- Health model probe default is shorter unless overridden by preload/recovery settings.

Expected fallback:

- Timeout is classified as retryable and circuit-eligible.
- Gemma timeout increments Gemma failure/timeout metrics if the counted generation path is reached.
- Unified synthesis falls to Gemini backup after Gemma failure.
- If Gemini fails, deterministic context fallback is used when available.

Expected user impact:

- Slow response before fallback, bounded by the relevant timeout/deadline.
- Route-level wrapper timeouts can return null/fallback before deeper model work completes.

Architecture impact:

- Repeated timeouts can accumulate primary failures and push circuit toward degraded/open behavior.

Evidence status:

- Source/config supports this.
- Exact latency at remote RTT and remote model load is NOT PROVEN.

## Case E: Network Latency 500 ms

Expected route:

- `/api/tags`, `/api/generate`, and `/api/embeddings` still route to remote Ollama.

Expected fallback:

- No fallback purely from 500 ms network latency if remote processing remains inside configured timeouts.

Expected user impact:

- Added latency per Ollama call.
- KG embedding latency increases because embeddings use the same remote endpoint.
- Final synthesis latency increases by at least one remote round trip plus remote model time.

Architecture impact:

- Compatible with current 30 s embedding timeout and 60 s generation deadlines, based on config.

Evidence status:

- Source/config supports tolerance.
- Live remote latency behavior is NOT PROVEN.

## Case F: Network Latency 2000 ms

Expected route:

- Same remote routes as Case E.

Expected fallback:

- Generation may still remain within 60 s synthesis deadlines if remote model runtime is not slow.
- Health `/api/tags` checks may be closer to timeout budgets because default health timeout is shorter than generation timeout.
- KG embeddings can still fit within 30000 ms if remote processing is stable.

Expected user impact:

- Noticeable user-facing delay.
- Multiple sequential remote calls can compound delay.
- Startup/readiness may be more fragile around short health probes.

Architecture impact:

- Still code-compatible, but operational success is NOT PROVEN without testing the real network.

Evidence status:

- Source/config does not prove failure at 2000 ms.
- Source/config does not prove success at 2000 ms.
- Final classification: NOT PROVEN.

## Simulation Summary

| Case | Expected route | Expected fallback | User impact | Architecture impact |
|---|---|---|---|---|
| A Remote healthy | Remote `/api/generate`; remote `/api/embeddings`; local RAG/Neo4j/Qdrant | None if Gemma succeeds | Normal plus latency | Compatible if remote has required models |
| B Remote unavailable | Ollama readiness/generation fail; deterministic routes may bypass | Gemini backup, then deterministic fallback | LLM synthesis degrades; KG embeddings can fail | Machine A services remain but LLM health degraded |
| C Gemma unavailable | Primary missing/failing | Gemini backup; possible local backup only by failover state/rules | Gemini-produced synthesis or fallback | Primary readiness degraded/open/cold |
| D Gemma timeout | Primary request times out | Gemini backup, then deterministic fallback | Slow answer before fallback | Repeated failures affect breaker |
| E 500 ms latency | Same routes | Usually none by config | Added latency | Compatible by source/config, live NOT PROVEN |
| F 2000 ms latency | Same routes | Possible health fragility; generation may still fit | Significant latency | NOT PROVEN without real network |
