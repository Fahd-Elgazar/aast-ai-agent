# Metrics Validation

Audit date: 2026-06-21  
Repository root audited: `C:\AI_AGENT`  
Branch observed: `recovery-baseline`  
Mode: read-only. No code, config, Docker, package, image, or database changes were made.

## Metrics Audited

- `gemma_requests_total`
- `gemma_success_total`
- `gemma_failure_total`
- `gemma_timeout_total`
- `gemini_fallback_total`
- `deterministic_fallback_total`

## Metrics Implementation

Source: `C:\AI_AGENT\aast-ai-agent-main\backend\services\metrics.js`

Implementation:

- Metrics are process-local in-memory Maps.
- Required counters are filled with zero in snapshots if absent.
- There is no persistence layer.
- Metrics reset on backend process restart or when a separate Node process imports its own module instance.

Exposure points:

- `C:\AI_AGENT\aast-ai-agent-main\backend\routes\health.js`
- `/health/metrics`
- `/health` embeds selected runtime/model health metadata and metric snapshots.

## Increment Points

### `gemma_requests_total`

Source: `C:\AI_AGENT\aast-ai-agent-main\backend\services\ollamaService.js`

Incremented when:

- `generateWithRetries()` is entered for a model name containing `gemma`.

Not incremented by:

- Direct host calls to Ollama.
- HealthMonitor startup preload probes.
- `/api/tags` checks.
- Deterministic route bypasses.
- Separate `docker exec node ...` processes relative to the main backend process metrics endpoint.

### `gemma_success_total`

Source: `ollamaService.js`

Incremented when:

- A Gemma generation request through `generateWithRetries()` succeeds.

Not incremented when:

- Gemma is only installed/listed.
- Startup preload succeeds outside the central user generation metric path.
- Deterministic route returns before model synthesis.

### `gemma_failure_total`

Source: `ollamaService.js`

Incremented when:

- A Gemma generation request through `generateWithRetries()` fails.

Not incremented when:

- The failure is from direct host `curl` outside backend.
- The failure is from `healthMonitor.probeModel()` startup preload.
- The failure occurs in a separate Node process not serving `/health/metrics`.

### `gemma_timeout_total`

Source: `ollamaService.js`

Incremented when:

- A Gemma generation failure is classified as timeout.

Observed forced-probe failure:

- The forced probe failed with `Ollama returned empty response`, not a timeout classification, so timeout behavior is not the explanation for zero timeout metrics in the main process.

### `gemini_fallback_total`

Source: `C:\AI_AGENT\aast-ai-agent-main\backend\services\unifiedAnswerService.js`

Incremented when:

- `runFinalSynthesis()` catches Gemma failure.
- Gemini backup is enabled.
- `generateGeminiSynthesis()` succeeds.

Not incremented when:

- A route bypasses unified final synthesis.
- Gemini humanizer is disabled or skipped.
- Decision API Gemini is disabled.
- A separate Node process performs the synthesis probe outside the main backend process.

### `deterministic_fallback_total`

Source: `unifiedAnswerService.js`

Incremented when:

- Unified synthesis returns deterministic fallback after empty evidence, low confidence, memory pressure, Gemma/Gemini failure, or final fallback conditions.

Important distinction:

- Many deterministic orchestrator/golden-path bypasses return before `generateUnifiedAnswer()` and therefore may not increment this unified-service fallback metric.

## Reset Points

Metrics reset when:

- Backend process restarts.
- Node module state is reloaded in a new process.
- A probe runs in a separate `docker exec node ...` process rather than the already-running backend process.

Metrics do not reset from:

- `/health/metrics` reads.
- Normal HTTP query reads.
- Direct Ollama host calls.

## Live Metrics Evidence

Before sampled HTTP probes, `/health/metrics` showed:

- `gemma_requests_total=0`
- `gemma_success_total=0`
- `gemma_failure_total=0`
- `gemma_timeout_total=0`
- `gemini_fallback_total=0`
- `deterministic_fallback_total=0`

After three `POST /api/chatbot/query` probes:

- `http_chatbot_query_total=3`
- `http_chatbot_success_total=3`
- `gemma_requests_total=0`
- `gemma_success_total=0`
- `gemma_failure_total=0`
- `gemma_timeout_total=0`
- `gemini_fallback_total=0`
- `deterministic_fallback_total=0`

Why those values did not move:

- Query 1 used deterministic decision/golden path and bypassed unified synthesis.
- Query 2 returned a conversation clarification and bypassed Ollama/Gemini.
- Query 3 hit KG/curriculum deterministic missing-evidence behavior after Neo4j driver failure and bypassed LLM.
- Direct host Ollama probes are invisible to backend process metrics.
- Startup preload probes are not counted as `gemma_requests_total`.
- Forced backend unified-synthesis probe ran in a separate Node process, so its in-memory metrics were not exposed by the already-running backend `/health/metrics` endpoint.

## Live vs Static Values

The required metrics are live process-local values, not static constants. However, their snapshot always includes zero defaults for required counters. A value of zero means no counted event occurred in that backend process since startup, not that the code lacks metric definitions.

Therefore the observed zero values are explainable and expected for the sampled traffic:

- Gemma direct host failure: outside backend metrics.
- Gemma startup preload failure: health-monitor path, not generation metric path.
- HTTP deterministic bypasses: no final synthesis.
- Forced synthesis proof: separate Node process, isolated metric Maps.

## Metrics Verdict

Metrics are not moving because production sampled HTTP traffic did not reach counted Gemma/Gemini synthesis paths, and the most relevant Gemma failure evidence came from direct Ollama or isolated-process probes that do not update the main backend metrics endpoint.

The metrics are live in-memory values, but the current exposure can make them appear static when traffic is mostly deterministic or when probes occur outside the serving Node process.
