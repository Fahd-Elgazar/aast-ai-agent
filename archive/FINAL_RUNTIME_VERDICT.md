# Final Runtime Verdict

Audit date: 2026-06-21  
Repository root audited: `C:\AI_AGENT`  
Branch observed: `recovery-baseline`  
Mode: read-only. No code, config, Docker, package, image, or database changes were made.

## Final Answers

### 1. Is Gemma serving real production traffic?

No, not proven for the observed production HTTP traffic.

Gemma is configured as primary and is attempted when unified final synthesis is reached. But the sampled `POST /api/chatbot/query` requests bypassed model synthesis, and the direct/forced synthesis evidence showed Gemma failing rather than serving the final answer.

Direct evidence:

- Direct `gemma4:e2b` Ollama generation failed with runner/CUDA crash evidence.
- Backend forced unified synthesis attempted Gemma under `PRIMARY_COLD`.
- Gemma failed with `Ollama returned empty response`.
- Final response came from Gemini with `synthesis_provider=gemini_backup`.

### 2. Is Gemini acting as backup or primary?

In code, Gemini is backup.

In the current runtime state, Gemini is effectively acting as the real answer-producing model for unified final synthesis whenever Gemma generation fails.

This distinction matters:

- Configured primary: `gemma4:e2b`
- Code backup: `gemini-2.5-flash`
- Effective answer producer in the forced synthesis proof: Gemini

### 3. Why are metrics not moving?

Because the counted events did not occur in the main backend process for the sampled traffic.

Specific causes:

- The three production HTTP probes bypassed Gemma/Gemini synthesis.
- Direct Ollama host probes do not update backend metrics.
- Startup preload probes do not increment `gemma_requests_total`.
- The forced synthesis proof ran in a separate Node process, so its in-memory metrics were isolated from the serving backend process.
- Metrics are process-local Maps and reset on process restart.

Therefore `gemma_requests_total=0` does not prove Gemma is healthy or unused globally. It proves no counted Gemma generation occurred in the serving backend process for the observed request set.

### 4. What is the single safest runtime improvement?

Gate and label production primary readiness on a real Gemma generation probe, not `/api/tags` or installed-model presence.

The safest improvement is to require a successful one-token `gemma4:e2b` `/api/generate` probe before reporting Gemma as production-ready or treating it as the effective primary. If the generation probe fails, health and runtime metadata should clearly expose Gemma as unavailable/cold and Gemini as the active answer-producing fallback for synthesis.

This is safer than relying on `/api/tags`, because `/api/tags` can succeed while Gemma generation fails.

### 5. Risk score 0-100

Risk score: 74 / 100.

Reason:

- High risk: primary model status can be misleading because installed/configured Gemma is not the same as successful Gemma generation.
- High risk: current direct Gemma generation failed with runner/CUDA crash evidence.
- High risk: final synthesis can silently become Gemini-produced while local failover still reports inactive.
- Medium mitigating factor: deterministic bypasses and Gemini backup prevent total answer outage for some paths.
- Medium mitigating factor: the code has a clear fallback chain and bounded Gemma queueing.

## Final Determination

Gemma Primary is configured and attempted, but it is not proven to be serving real production answers in the current runtime state. Gemini Backup remains a backup by code design, but under the observed Gemma failure condition it is effectively the model producing unified final answers.

No fixes were applied.
