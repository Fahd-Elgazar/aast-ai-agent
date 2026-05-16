# LLM Resilience Migration

This backend now keeps `gemma4:e2b` as the primary model and uses a local backup model when Gemma becomes unstable.

## Required Ollama Models

Pull the primary and backup models before starting production services:

```bash
ollama pull gemma4:e2b
ollama pull tinyllama:latest
```

`tinyllama:latest` is the configured lightweight backup. It remains a fallback only; `gemma4:e2b` stays the premium primary.

## Configuration

Copy `backend/.env.example` into your local `.env` if needed, then tune these values:

```bash
PRIMARY_MODEL=gemma4:e2b
BACKUP_MODEL=tinyllama:latest
PRIMARY_MAX_FAILURES=3
BACKUP_MAX_FAILURES=1
BREAKER_THRESHOLD=5
HALF_OPEN_INTERVAL_MS=30000
PRIMARY_RECOVERY_SUCCESSES=2
PRIMARY_RETRY_LIMIT=2
BACKUP_RETRY_LIMIT=1
PRIMARY_TIMEOUT_MS=12000
BACKUP_TIMEOUT_MS=10000
PRIMARY_COLD_START_TIMEOUT_MS=30000
MODEL_PRELOAD_TIMEOUT_MS=15000
OLLAMA_STARTUP_WAIT_ENABLED=true
OLLAMA_STARTUP_WAIT_TIMEOUT_MS=60000
OLLAMA_STARTUP_WAIT_INTERVAL_MS=2000
LLM_REQUEST_DEADLINE_MS=22000
GEMMA_MAX_CONTEXT_TOKENS=3500
GEMMA_NUM_CTX=4096
GEMMA_MAX_ACTIVE_REQUESTS=1
GEMMA_QUEUE_MAX_DEPTH=24
GEMMA_QUEUE_TIMEOUT_MS=25000
GEMMA_TEMPERATURE=0.15
GEMMA_TOP_P=0.80
GEMMA_REPEAT_PENALTY=1.16
GEMMA_NUM_PREDICT_SYNTHESIS=420
GEMMA_NUM_PREDICT_HEAVY=320
GEMMA_NUM_PREDICT_LIGHT=128
GEMMA_WARM_POOL_ENABLED=true
GEMMA_WARM_POOL_INTERVAL_MS=240000
GEMMA_MEMORY_HIGH_RSS_MB=6144
GEMMA_MEMORY_CRITICAL_RSS_MB=8192
```

## Runtime Behavior

- `PRIMARY_COLD`: Gemma is installed and remains preferred, but startup preload was unstable. The first live request gets a longer Gemma timeout.
- `WAITING_FOR_OLLAMA`: startup is waiting for `/api/tags`; model validation and preload have not run yet.
- `CLOSED`: Gemma handles normal traffic.
- `DEGRADED`: Gemma is unstable; backup model handles user traffic.
- `HALF_OPEN`: background Gemma probes are running; user traffic stays on backup.
- `OPEN`: both primary and backup failed; callers should use deterministic fallback.

Per-request warmup has been removed. Startup preload and periodic health probes keep models warm without adding latency to user requests.

Startup preload failure is non-fatal when Gemma is installed. A transient `ECONNRESET` during preload sets `primary_cold_start_pending=true` and keeps `active_runtime_model=gemma4:e2b`; it does not count as a runtime primary failure and does not activate TinyLlama.

TinyLlama activates only after real Gemma generation failures reach `PRIMARY_MAX_FAILURES`. A single startup preload failure or one failed live generation cycle below the threshold leaves Gemma as the active runtime model.

The Gemma request limiter serializes local Ollama inference by default with `GEMMA_MAX_ACTIVE_REQUESTS=1`. Extra requests wait in the Gemma queue before any failover decision is considered. Queue overflow and queue timeout are classified as overload, retried briefly, and do not increment Gemma runtime failure counters.

Synthesis prompts are capped against `GEMMA_MAX_CONTEXT_TOKENS`. Context is built and trimmed in priority order: FAQ direct answer, Knowledge Graph facts, Decision factors, then RAG passages. If the final prompt still exceeds the safe budget, lower-priority tail context is hard-truncated before Ollama sees it.

Route-level generation is bounded with lower temperature/top-p and dynamic `num_predict`. Heavy RAG or hybrid synthesis uses a smaller generation budget than normal synthesis, and high memory pressure reduces output length further.

The warm pool runs a one-token `hello` keepalive every `GEMMA_WARM_POOL_INTERVAL_MS` to keep `gemma4:e2b` resident without counting keepalive failures as user-facing runtime failures.

Startup model validation is now gated by Ollama API readiness. The backend waits for `OLLAMA_STARTUP_WAIT_TIMEOUT_MS` before deciding Ollama is unavailable, so a slow Ollama boot no longer creates false missing-model or false `OPEN` startup state. During this gate, health state reports `startup_readiness_phase=WAITING_FOR_OLLAMA`.

If the backup model is missing, startup logs a warning and the backend still boots. If the primary model is missing, startup logs a critical readiness warning and the failover manager forces degraded or open behavior based on whether the backup is installed.

## Backup Policy

`gemma4:e2b` remains the true primary. The configured backup remains a safety net only and should not be promoted as the premium model. Do not replace, downgrade, or change the primary model when applying this stabilization profile.

## Observability

Structured logs now include:

- `primary_failures`
- `backup_activations`
- `breaker_state`
- `failover_count`
- `recovery_success`

The `/health` response also includes the active model, breaker state, primary health, backup health, and failover counters.

Additional readiness fields:

- `startupReadiness`
- `installedStatus`
- `missingModelWarnings`
- `recommendedCommands`
- `activeBackupModel`
- `truePrimaryModel`
- `activeRuntimeModel`
- `primaryColdStartPending`
- `preloadWarning`
- `startupPreloadStatus`
- `backupReady`
- `startupReadinessPhase`
- `ollamaReady`
- `ollamaWaitAttempts`
- `ollamaWaitDurationMs`
- `gemma_memory_pressure`
- `gemma_queue_depth`
- `gemma_context_size`
- `warm_pool_active`
- `avg_generation_latency`
- `overload_retries`

Example missing-backup remediation:

```bash
ollama pull tinyllama:latest
```

## Performance Notes

- Primary retries are capped by `PRIMARY_RETRY_LIMIT`.
- Backup retries are capped by `BACKUP_RETRY_LIMIT`.
- The first live Gemma request after a preload warning uses `PRIMARY_COLD_START_TIMEOUT_MS`.
- `OLLAMA_STARTUP_WAIT_*` settings affect startup only and add no per-request latency after readiness completes.
- `LLM_REQUEST_DEADLINE_MS` prevents long retry chains from creating 25s+ latency spikes.
- Keep `OLLAMA_KEEP_ALIVE=10m` or higher when memory allows to reduce reload churn.
- Use `PRIMARY_TIMEOUT_MS` and `BACKUP_TIMEOUT_MS` based on actual local hardware. Slower CPU-only hosts may need higher values, but increase `LLM_REQUEST_DEADLINE_MS` only deliberately.
- On Windows, set `NODE_OPTIONS=--max-old-space-size=4096` for the orchestrator when running large local contexts.
- Increase the Windows pagefile to at least system-managed or 1.5x physical RAM on memory-constrained hosts.
- Avoid running multiple local model servers, browser-heavy workloads, and vector ingestion jobs during production Gemma serving.
- Keep `GEMMA_MAX_ACTIVE_REQUESTS=1` on low-VRAM machines; raise to `2` only after observing stable queue depth, memory pressure, and latency.

## Testing Checklist

- Confirm `ollama list` includes `gemma4:e2b` and the configured backup.
- Start the backend while Ollama is stopped and verify logs show `readiness_wait_started`, retries, then `readiness_wait_failed` after the configured timeout.
- Start Ollama slowly and verify the backend remains in `WAITING_FOR_OLLAMA` until `/api/tags` succeeds.
- Start the backend and check logs for `ollama_service_initialized`.
- Call `/health` and verify `breakerState`, `activeModel`, `primary`, and `backup`.
- Simulate primary HTTP 500s until `PRIMARY_MAX_FAILURES` is reached and verify later responses use the backup model.
- Simulate both models failing and verify deterministic fallback is returned by `UnifiedAnswerService`.
- Restore Gemma and verify recovery probes move the breaker back to `CLOSED`.
- Run route checks for KG, RAG, FAQ, Decision, Hybrid, and LLM fallback paths.
- Send two simultaneous synthesis requests and verify `/health` reports `gemma_queue_depth > 0` while the second waits.
- Send an intentionally oversized RAG/hybrid prompt and verify `prompt_truncated` or `hard_truncated` appears in metadata, with KG/Decision context preserved ahead of RAG.
- Verify `warm_pool_active=true` and that warm pool failures do not increment `primary_failures`.

## Rollback Plan

1. Set `GEMMA_WARM_POOL_ENABLED=false` to disable background keepalive.
2. Set `GEMMA_MAX_ACTIVE_REQUESTS` back to the old concurrency target if queueing causes unacceptable latency.
3. Increase `GEMMA_MAX_CONTEXT_TOKENS` only if hardware has verified headroom.
4. Revert the stabilization commit if central Ollama routing causes regressions; no model files or data migrations are changed.
5. Keep `PRIMARY_MODEL=gemma4:e2b` during rollback unless explicitly performing a separate model migration.
