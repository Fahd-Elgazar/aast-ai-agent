# Surgical Merge Plan

Canonical repository: `C:\AI_AGENT`
Secondary workspace: `C:\Users\mh978\Downloads\AI_AGENT n`

## Merge Blocks

| Source file | Source lines | Destination file | Destination lines | Classification | Reason |
| --- | ---: | --- | ---: | --- | --- |
| `docker-compose.yml` | 42-44, 47-52 | `docker-compose.yml` | after backend `OLLAMA_BASE_URL` | SAFE_TO_MERGE | Enables runtime mode, Gemini backup, primary Gemma model, and longer LLM deadlines in canonical Docker. |
| `backend/services/runtimeMode.js` | 11-39 | `backend/config/runtimeMode.js` | after runtimeMode object | SAFE_TO_MERGE | Add status/helper exports while preserving A's richer config object and dotenv loading. |
| `backend/services/runtimeMode.js` | 27-39 | `backend/services/runtimeMode.js` | new file | SAFE_TO_MERGE | Compatibility adapter that re-exports canonical runtime helpers from `../config/runtimeMode.js`. |
| `backend/routes/health.js` | 38-70, 299-300, 341-342 | `backend/routes/health.js` | adapted around imports, metrics payload, `/metrics` route | SAFE_TO_MERGE | Exposes runtime mode and flattened Gemma/Gemini/fallback counters while preserving A import paths and health gates. |
| `backend/rag_system/requirements.retriever.txt` | 8-9 | `backend/rag_system/requirements.retriever.txt` | append after `psutil==5.9.8` | SAFE_TO_MERGE | Adds retriever compatibility dependencies. |
| `backend/package.json` | dependency lines for `cli-table3`, `node-fetch` | `backend/package.json` | dependencies section | SAFE_TO_MERGE | Canonical source imports these packages directly; Docker `npm ci` must install them. |
| `backend/package-lock.json` | lockfile dependency graph | `backend/package-lock.json` | regenerate from accepted package.json delta | SAFE_TO_MERGE | Required for reproducible Docker/backend builds. |

## Blocks Not Moved

| Source file | Source lines | Classification | Reason |
| --- | ---: | --- | --- |
| `docker-compose.yml` | 45-46 | OPTIONAL | `GEMMA_NUM_CTX=512` and `GEMMA_NUM_BATCH=16` override A's current runtime defaults; leave to explicit tuning. |
| `docker-compose.yml` | 154-155 | DO_NOT_MERGE | Would remove `RAG_ANSWER_ENGINE_ENABLED` and change RAG answer model to `tinyllama`. |
| `backend/routes/health.js` | 3, 5-6 | DO_NOT_MERGE | B's `../src/...` import paths are from a different branch layout. |
| `backend/services/conversationalHumanizer.js` | 1-2, 323-337 | OPTIONAL / DO_NOT_MERGE | Explicit single-mode skip is optional; replacing canonical boolean config with raw env string parsing is rejected. |
| `backend/services/unifiedAnswerService.js` | 47-57, 497-685, metadata edits | DO_NOT_MERGE | Introduces path rewrites, Gemini-first behavior outside single mode, and removes deterministic metrics. |
| `backend/services/ollamaService.js` | import rewrites and metric removals | DO_NOT_MERGE | Path rewrites incompatible; metric removals violate required metrics preservation. |
| `backend/services/ollamaService.js` | provider logs and Gemma4 options | OPTIONAL | Useful but not necessary for this safe-only migration pass. |

## Execution Order

1. Patch `runtimeMode.js` helpers and adapter.
2. Patch health/metrics exposure.
3. Patch Docker compose backend env defaults, preserving RAG answer settings.
4. Patch retriever requirements.
5. Patch package dependencies and regenerate lockfile.
6. Run validation and Docker image proof from `C:\AI_AGENT` only.