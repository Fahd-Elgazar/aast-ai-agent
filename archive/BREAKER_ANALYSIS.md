# Breaker Analysis

Audit date: 2026-06-21  
Repository root audited: `C:\AI_AGENT`  
Branch observed: `recovery-baseline`  
Mode: read-only. No code, config, Docker, package, image, or database changes were made.

## Question Investigated

Why can runtime report:

- `primaryModel=gemma4:e2b`

while responses show:

- `gemma_primary_used=false`
- `synthesis_provider=gemini_backup`
- `breaker_state=PRIMARY_COLD`

## Short Answer

Because `PRIMARY_COLD` is not treated as "primary unavailable." The failover manager still reports Gemma as the active runtime model and still routes a live primary attempt to Gemma. When that live attempt fails, `unifiedAnswerService` catches the Gemma failure and calls Gemini backup directly. The local Ollama backup model is not activated in final synthesis because `allowBackup=false`.

So the runtime can truthfully report "Gemma is configured and selected as primary" while the actual answer is produced by Gemini after the Gemma call fails.

## Component Roles

### `modelFailoverManager`

Source: `C:\AI_AGENT\aast-ai-agent-main\backend\services\modelFailoverManager.js`

Responsibilities:

- Starts the model readiness workflow.
- Validates Ollama `/api/tags`.
- Validates installed primary/backup model names.
- Runs startup preload through `healthMonitor`.
- Applies startup preload summary to the circuit.
- Decides initial runtime route for model calls.
- Exposes model status through health metadata.

Key behavior:

- Startup preload failure for primary can mark `PRIMARY_COLD`.
- `PRIMARY_COLD` still reports `active_runtime_model=gemma4:e2b`.
- `PRIMARY_COLD` still returns primary route for user generation attempts.
- `failover_active` remains false until degraded/backup activation conditions are met.

### `circuitStateManager`

Source: `C:\AI_AGENT\aast-ai-agent-main\backend\services\circuitStateManager.js`

Responsibilities:

- Owns circuit states such as `CLOSED`, `PRIMARY_COLD`, `DEGRADED`, `HALF_OPEN`, `OPEN`, and `WAITING_FOR_OLLAMA`.
- Tracks primary failures and backup activations.
- Controls state transitions after failure thresholds.

Key behavior:

- `isPrimaryAvailableForUserTraffic()` returns true for `CLOSED` and `PRIMARY_COLD`.
- `shouldUseBackup()` returns true only for `DEGRADED` or `HALF_OPEN`.
- `recordPrimaryFailure()` transitions to degraded only after `PRIMARY_MAX_FAILURES`.
- Live `PRIMARY_MAX_FAILURES=3`.
- A single Gemma failure in `PRIMARY_COLD` leaves state as `PRIMARY_COLD` with `primary_failures=1`.

### `healthMonitor`

Source: `C:\AI_AGENT\aast-ai-agent-main\backend\services\healthMonitor.js`

Responsibilities:

- `/api/tags` checks.
- Model installation validation.
- One-token generation probes.
- Startup preload summary.

Key behavior:

- `/api/tags` success proves model listing/availability, not generation success.
- `probeModel()` is the real generation health check.
- `preloadModels()` can set `primary_cold_start_pending=true` if primary generation preload fails.
- Startup health probes do not increment user Gemma request metrics.

Observed live behavior:

- Tags/model installation succeeded.
- Gemma startup preload failed.
- TinyLlama preload succeeded.
- Circuit was marked `PRIMARY_COLD`.

### `GemmaWarmService`

Source: `C:\AI_AGENT\aast-ai-agent-main\backend\services\gemmaWarmService.js`

Responsibilities:

- Optional warm-pool behavior.

Live behavior:

- Disabled by `GEMMA_WARM_POOL_ENABLED=false`.
- It is not keeping Gemma warm.
- It is not generating production answers.

If enabled:

- It would call Gemma with `allowBackup=false`.
- It uses `recordFailure=false`, so warm failures are not the same as user-traffic circuit failures.

### `GemmaRequestLimiter`

Source: `C:\AI_AGENT\aast-ai-agent-main\backend\services\gemmaRequestLimiter.js`

Responsibilities:

- Enforces bounded Gemma concurrency and queueing.

Live limits:

- `GEMMA_MAX_ACTIVE_REQUESTS=1`
- `GEMMA_QUEUE_MAX_DEPTH=2`
- `GEMMA_QUEUE_TIMEOUT_MS=8000`

Failure behavior:

- Queue overflow and queue timeout are marked non-circuit-eligible.
- Queue gauges are updated in memory.
- This limiter did not cause the observed Gemma failure; the forced probe showed a model response failure after the primary attempt.

## Exact Failure Sequence

1. Backend starts model readiness.
2. `healthMonitor.checkTags()` confirms Ollama is reachable.
3. `validateModelInstallations()` confirms `gemma4:e2b` and `tinyllama:latest` are installed.
4. Startup preload probes actual generation.
5. Gemma preload fails with HTTP 500 / empty generation behavior.
6. TinyLlama preload succeeds.
7. `modelFailoverManager.applyStartupPreloadSummary()` marks primary as cold.
8. Circuit state becomes `PRIMARY_COLD`.
9. Health/status still report `primaryModel=gemma4:e2b` and `active_runtime_model=gemma4:e2b`.
10. A final synthesis request reaches `runFinalSynthesis()`.
11. `runFinalSynthesis()` calls Gemma through `runOllamaSynthesis(... allowBackup:false)`.
12. `ollamaService` sees `PRIMARY_COLD` and tries a live primary cold-start request with the cold-start timeout.
13. Gemma returns failure/empty response.
14. `ollamaService` records the primary failure but stays below the failover threshold.
15. Because `allowBackup=false`, the Ollama-local backup model is not used.
16. `runFinalSynthesis()` catches Gemma failure and invokes `generateGeminiSynthesis()`.
17. Gemini succeeds.
18. Response metadata reports `gemma_primary_used=false`, `synthesis_provider=gemini_backup`, `breaker_state=PRIMARY_COLD`.

## Why Health Can Look Better Than Generation

The live `/health` endpoint can show Ollama as ok and model names as available because the health path gives weight to `/api/tags` and cached model availability. `/api/tags` does not prove `gemma4:e2b` can generate successfully.

After direct Gemma generation crashed the Ollama runner, health could still report stale or tag-based primary availability until a real generation probe or model failure path updated the primary health fields.

## Why Gemini Is Not Counted as Failover Active

`failover_active` belongs to the local model failover manager and circuit state. The successful Gemini backup path in `unifiedAnswerService` is a separate synthesis fallback, not the same as activating the local Ollama backup model.

Therefore this combination is expected under the current code:

- `synthesis_provider=gemini_backup`
- `llm_failover_active=false`
- `backup_activations=0`
- `failover_count=0`
- `breaker_state=PRIMARY_COLD`

## Cause Statement

The exact cause is a mismatch between configured/installed primary status and actual generation health:

- `gemma4:e2b` is installed and configured as primary.
- Real generation for `gemma4:e2b` failed in direct Ollama testing.
- Startup/preload generation failed and produced `PRIMARY_COLD`.
- `PRIMARY_COLD` still allows a live Gemma attempt and still reports Gemma as active runtime model.
- That live attempt fails.
- Unified synthesis then uses Gemini backup.

This is not evidence that Gemini is configured as primary in code. It is evidence that Gemini is effectively producing final answers when Gemma generation fails.
