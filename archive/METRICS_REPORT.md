# Metrics Report

Date: 2026-06-20

## Existing Metrics Path

Metrics are exposed through:

- `GET /health/metrics`
- `GET /api/health/metrics`

Evidence: `aast-ai-agent-main/backend/routes/health.js:304`.

## Added Metrics

Required metrics added in `aast-ai-agent-main/backend/services/metrics.js`:

- `gemma_requests_total`, `metrics.js:11`.
- `gemma_success_total`, `metrics.js:12`.
- `gemma_failure_total`, `metrics.js:13`.
- `gemma_timeout_total`, `metrics.js:14`.
- `gemini_fallback_total`, `metrics.js:15`.
- `deterministic_fallback_total`, `metrics.js:16`.
- `gemma_latency_ms`, `metrics.js:18`.
- `gemma_queue_depth`, `metrics.js:19`.
- `success_rate`, `metrics.js:141` and `metrics.js:157`.
- `failure_rate`, `metrics.js:142` and `metrics.js:158`.

## Instrumentation

Gemma generation metrics:

- Requests: `ollamaService.js:462-465`.
- Success: `ollamaService.js:533-534`.
- Failure: `ollamaService.js:586-587`.
- Timeout: `ollamaService.js:593`.
- Queue depth gauge: `gemmaRequestLimiter.js:36`.

Fallback metrics:

- Gemini backup success: `unifiedAnswerService.js:566`.
- Deterministic fallback: `unifiedAnswerService.js:531`, `unifiedAnswerService.js:610`, and later fallback paths.

Request success/failure rates:

- Main route increments total/success/failure metrics at `orchestrator.js:578-590`.
- Derived success and failure rates are emitted in `metrics.js:116-160`.

## Interpretation

Use these defense-mode indicators:

- `gemma_queue_depth` should normally be `0`.
- `gemma_failure_total` should remain low and should not increase on repeated golden queries.
- `gemma_timeout_total` should be `0` during the demo.
- `gemini_fallback_total` should be low; any increase means Gemma failed and backup saved the request.
- `deterministic_fallback_total` increasing is acceptable for no-evidence or safety cases, but not for normal known AAST questions.
- `success_rate` should be near `1.0` after warmup.
- `failure_rate` should be near `0.0`.

## Missing Runtime Proof

The metrics code is present and syntax-verified. Live metric values were not collected because the Docker engine was unavailable from this session.
