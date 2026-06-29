# LLM Invocation Report

Date: 2026-06-20

## Current Policy

Default runtime mode is defined in `aast-ai-agent-main/backend/config/runtimeMode.js`:

- `SINGLE_GEMMA_GENERATION_MODE=true`, `runtimeMode.js:16`.
- `GEMINI_BACKUP_ENABLED=true`, `runtimeMode.js:21`.
- LLM intent, graph refine, safe reformat, RAG answer engine, decision LLM extraction, and humanizer are disabled by default, `runtimeMode.js:22-27`.

The `.env.example` mirrors this policy at `aast-ai-agent-main/backend/.env.example:8-16`.

## Gemma Invocation Sites

| Site | File | Current Default | Per-request Count |
|---|---|---:|---:|
| Final answer synthesis | `unifiedAnswerService.js:488-520` | Enabled | 1 |
| Intent extraction | `orchestrator.js:466-500` | Disabled | 0 |
| Graph refine | `neo4jcontext.js:89-110` | Disabled | 0 |
| Safe reformatter | `neo4jcontext.js:166-178` | Disabled | 0 |
| Pre-synthesis LLM fallback | `orchestrator.js:2841-2850` | Disabled | 0 |
| RAG answer generation | `ragService.js:641-675`, `phase4_llm_answer_engine.py:296-308` | Disabled | 0 |
| Decision profile extraction fallback | `decisionService.js:235-261` | Disabled | 0 |
| Gemma warm pool | `gemmaWarmService.js:106` | Disabled by default | 0 per user request |

## Gemini Invocation Sites

| Site | File | Current Default | Use |
|---|---|---:|---|
| Final synthesis backup | `unifiedAnswerService.js:555-566` | Enabled | Only after Gemma primary fails |
| Humanizer | `conversationalHumanizer.js:326-344` | Disabled | Optional style layer |
| Decision chat | `agent_service.py:19`, `agent_service.py:100` | Disabled in env examples | Direct Decision API chat |
| Voice extraction | `speech_service.py:192-196` | Disabled in env examples | Voice-to-profile extraction |

## Maximum Gemma Calls Per User Request

Before migration, the theoretical main-chat path could stack multiple local generations:

- Intent LLM: 1.
- Graph refine: up to 1 call site, with retry behavior inside generation.
- RAG answer fallback: 1.
- Pre-synthesis LLM fallback: 1.
- Final Ollama fallback after Gemini failure: 1.
- Decision extraction fallback on decision-profile text: 1.
- Safe reformatter if explicitly used: 1.

Code-location maximum before policy gating: up to 7 Gemma-capable generation locations across the request surface. A normal `/api/chatbot/query` path would not always execute all 7, but this explains intermittent overload on a 6GB GPU.

After migration and current defaults:

- Maximum Gemma generations for `POST /api/chatbot/query`: 1.
- Maximum Gemma retry attempts for that generation: 0 extra retries, because `PRIMARY_RETRY_LIMIT=0`, `llmConfig.js:216`.
- Maximum warm-pool generations per user request: 0; warm pool is disabled by default, `llmConfig.js:132` and `.env.example:84`.

## Final Count

Maximum Gemma calls per user request: 1.

This excludes non-generation embedding calls to `nomic-embed-text`, because those use Ollama `/api/embeddings` and do not load Gemma generation.
