# Migration Classification Report

Canonical repository: `C:\AI_AGENT`
Secondary workspace: `C:\Users\mh978\Downloads\AI_AGENT n`

## Classification Summary

| File | Change | Classification | Reason |
| --- | --- | --- | --- |
| `docker-compose.yml` | Add backend `SINGLE_GEMMA_GENERATION_MODE`, `GEMINI_BACKUP_ENABLED`, `PRIMARY_MODEL`, and LLM timeout env defaults | SAFE_TO_MERGE | Enables Gemma primary/Gemini backup/runtime deadlines inside canonical Docker without replacing services. |
| `docker-compose.yml` | Add B defaults `GEMMA_NUM_CTX=512`, `GEMMA_NUM_BATCH=16` | OPTIONAL | May reduce memory pressure, but it overrides A's current `llmConfig.js` defaults and can reduce answer quality/context. |
| `docker-compose.yml` | Remove `RAG_ANSWER_ENGINE_ENABLED` and change `RAG_ANSWER_MODEL` to `tinyllama` | DO_NOT_MERGE | Violates preservation of existing RAG answer configuration and changes model behavior. |
| `backend/services/runtimeMode.js` | Add runtime mode status/helpers while preserving A's `backend/config/runtimeMode.js` | SAFE_TO_MERGE | A already has richer runtime config; helpers are useful for health/status and compatibility if implemented as an adapter. |
| `backend/services/runtimeMode.js` | Replace A config/runtimeMode.js with B's narrower service file | DO_NOT_MERGE | Would remove defense/RAG/decision/graph/humanizer toggles that canonical code already uses. |
| `backend/routes/health.js` | Runtime mode in health payload and enriched `/metrics` snapshot | SAFE_TO_MERGE | Adds observability for Gemma/Gemini/deterministic fallback counters without changing health gates. |
| `backend/routes/health.js` | Import rewrites to `../src/...` | DO_NOT_MERGE | Workspace B branch moved files; canonical A does not use this tree. |
| `backend/services/conversationalHumanizer.js` | Skip humanizer during single Gemma generation mode | OPTIONAL | Canonical already disables humanizer by default via `runtimeMode.humanizerEnabled=false`; explicit single-mode skip is harmless if adapted. |
| `backend/services/conversationalHumanizer.js` | Replace runtimeMode.humanizerEnabled with raw string-only env check | DO_NOT_MERGE | Narrows boolean parsing and weakens A's canonical runtime config. |
| `backend/services/unifiedAnswerService.js` | Import rewrites to `../src/...` | DO_NOT_MERGE | Incompatible with A's canonical tree. |
| `backend/services/unifiedAnswerService.js` | B's non-single-mode Gemini-first with Ollama fallback branch | DO_NOT_MERGE | Conflicts with the objective that Gemma remains primary and Gemini is backup. |
| `backend/services/unifiedAnswerService.js` | Remove deterministic fallback metric increments | DO_NOT_MERGE | Would reduce required metrics fidelity. |
| `backend/services/unifiedAnswerService.js` | Keep A's existing Gemma-primary/Gemini-backup/deterministic fallback behavior | SAFE_TO_KEEP | A already implements the desired production migration behavior. |
| `backend/services/ollamaService.js` | Provider before/response/result logs and Gemma4 `think:false`/`stop` request options | OPTIONAL | Useful for runtime proof, but not required for correctness; can be added without path rewrites. |
| `backend/services/ollamaService.js` | Remove `recordDuration("gemma_latency_ms")` and narrow timeout counting | DO_NOT_MERGE | Violates required metrics preservation. |
| `backend/rag_system/requirements.retriever.txt` | Add `transformers==4.41.2` and `accelerate>=0.30` | SAFE_TO_MERGE | Matches retriever dependency compatibility need and does not alter app logic. |
| `backend/package.json` | Add `cli-table3` and direct `node-fetch` | SAFE_TO_MERGE | Canonical code imports these packages directly; declaring them fixes reproducible `npm ci`/Docker builds. |
| `backend/package-lock.json` | Regenerate for only the accepted dependency additions | SAFE_TO_MERGE | Required by `npm ci`; should not be copied blindly if package.json differs. |

## Final Classification

SAFE_TO_MERGE blocks only:

1. Backend compose env defaults for runtime mode, backup enablement, primary model, and longer deadlines.
2. Runtime mode status/helper functions implemented on top of A's richer runtime config.
3. Health/metrics observability adapted to A's current import paths.
4. Direct dependency declarations for `cli-table3` and `node-fetch` with regenerated lockfile.
5. Retriever dependencies `transformers==4.41.2` and `accelerate>=0.30`.

Explicitly rejected:

1. Any `../src/...` import rewrites from Workspace B.
2. Any RAG answer model/enablement changes from Workspace B.
3. Any Gemini-first final synthesis behavior.
4. Any metric removals, especially `gemma_latency_ms` and deterministic fallback counters.