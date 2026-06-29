# Gemma Primary Migration Report

Date: 2026-06-20

## Objective

Migrate final synthesis from:

`Gemini primary -> Gemma fallback`

to:

`Gemma primary -> Gemini backup -> deterministic fallback`

## Implementation Summary

### Runtime Mode

Added `aast-ai-agent-main/backend/config/runtimeMode.js`.

Default policy:

- Gemma single-generation mode enabled.
- Gemini backup enabled.
- LLM intent disabled.
- graph refine disabled.
- safe reformat disabled.
- RAG answer engine disabled.
- decision LLM extraction disabled.
- Gemini humanizer disabled.

Evidence: `runtimeMode.js:15-27`.

### Final Synthesis Migration

Changed `aast-ai-agent-main/backend/services/unifiedAnswerService.js`:

- Gemma primary starts first: `unifiedAnswerService.js:499-520`.
- Gemini is called only after Gemma failure: `unifiedAnswerService.js:555-566`.
- Deterministic fallback is returned when Gemini backup is disabled or fails and deterministic context exists: `unifiedAnswerService.js:531-541` and `unifiedAnswerService.js:610-620`.
- Response metadata now reports whether Gemma primary or Gemini backup was used: `unifiedAnswerService.js:2440-2444`.

### Ollama Backup Suppression

Final Gemma synthesis calls `generateStableResponse()` with `allowBackup=false`, so the local Ollama backup model does not create a second hidden local generation during the final synthesis path.

Evidence:

- `runOllamaSynthesis()` accepts `allowBackup=false`, `unifiedAnswerService.js:423-452`.
- `generateStableResponse()` honors `allowBackup`, `ollamaService.js:697`, `ollamaService.js:853-864`.

### Gemini Backup Metrics

`gemini_fallback_total` increments only when Gemini backup succeeds after Gemma failure.

Evidence: `unifiedAnswerService.js:555-566`.

### Deterministic Fallback Metrics

`deterministic_fallback_total` increments in deterministic fallback paths.

Evidence: `unifiedAnswerService.js:531`, `unifiedAnswerService.js:610`, `unifiedAnswerService.js:2183`, `unifiedAnswerService.js:2210`, `unifiedAnswerService.js:2313`, `unifiedAnswerService.js:2500`, `unifiedAnswerService.js:2531`.

## Config Changes

`aast-ai-agent-main/backend/.env.example` now documents:

- `SINGLE_GEMMA_GENERATION_MODE=true`, `.env.example:9`.
- `GEMINI_BACKUP_ENABLED=true`, `.env.example:10`.
- `PRIMARY_RETRY_LIMIT=0`, `.env.example:32`.
- `GEMMA_MAX_CONTEXT_TOKENS=2600`, `.env.example:61`.
- `GEMMA_NUM_CTX=3072`, `.env.example:65`.
- `GEMMA_QUEUE_MAX_DEPTH=2`, `.env.example:70`.
- `GEMMA_WARM_POOL_ENABLED=false`, `.env.example:84`.

## Migration Result

- Gemma primary: YES.
- Gemini backup: YES.
- Deterministic fallback: YES.
- Hidden Ollama backup in final synthesis: disabled.
- Maximum Gemma final-synthesis attempts: 1.

## Not Proven

Live container runtime was not validated because Docker Desktop engine was unavailable. `docker compose config` passed, but containers must be rebuilt/recreated for runtime activation.
