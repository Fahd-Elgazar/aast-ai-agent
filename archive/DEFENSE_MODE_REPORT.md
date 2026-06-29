# Defense Mode Report

Date: 2026-06-20

## Objective

Create a defense-focused runtime profile for:

- Maximum reliability.
- Minimum latency.
- Minimum hallucination risk.
- Deterministic behavior.
- Single RTX 4050 machine constraints.

## Recommended DEFENSE_MODE Configuration

Set:

```env
DEFENSE_MODE=true
SINGLE_GEMMA_GENERATION_MODE=true
GEMINI_BACKUP_ENABLED=true
LLM_INTENT_ENABLED=false
KG_GRAPH_REFINE_ENABLED=false
KG_SAFE_REFORMAT_ENABLED=false
RAG_ANSWER_ENGINE_ENABLED=false
DECISION_LLM_EXTRACTION_ENABLED=false
GEMINI_HUMANIZER_ENABLED=false
PRIMARY_RETRY_LIMIT=0
GEMMA_MAX_ACTIVE_REQUESTS=1
GEMMA_QUEUE_MAX_DEPTH=2
GEMMA_QUEUE_TIMEOUT_MS=8000
GEMMA_MAX_CONTEXT_TOKENS=2600
GEMMA_NUM_CTX=3072
GEMMA_NUM_PREDICT_SYNTHESIS=220
GEMMA_WARM_POOL_ENABLED=false
DECISION_GEMINI_ENABLED=false
VOICE_ENABLED=false
```

Current defaults already implement the single-generation policy. `DEFENSE_MODE=true` should be used during the live defense to make the intent explicit.

## Services To Keep Enabled

- Frontend.
- Node Orchestrator.
- Neo4j.
- Qdrant.
- RAG Retriever.
- Decision API deterministic recommendation route.
- Ollama with primary Gemma model and `nomic-embed-text`.
- RAG Answer container may remain running for health compatibility, but generation must stay disabled.

## Services Or Features To Disable

- RAG answer generation.
- Graph refine LLM.
- Safe reformatter LLM.
- Intent-generation LLM.
- Pre-synthesis fallback LLM.
- Gemini humanizer.
- Decision API Gemini chat during defense.
- Voice subsystem.
- Whisper.
- Periodic Gemma warm pool.
- Extra local models or GPU workloads not needed for the demo.

## Route Simplification

### Keep

- `POST /api/chatbot/query`: main defense route.
- `GET /health`, `GET /api/health`, `GET /health/enterprise`, `GET /api/health/metrics`.
- `POST /api/decision/recommend`: deterministic decision route.
- `POST /api/v1/decisions/recommend`: internal deterministic decision API.
- RAG retriever `/search` and `/health`.

### Avoid During Defense

- `/api/v1/chat/message`: Gemini chat route.
- `/api/v1/voice-entry`: voice route.
- Direct RAG answer `/answer` as a generation route.
- Legacy or debug routes unless needed for diagnosis.

## Defense Query Flow

`User question -> deterministic route -> Neo4j and/or RAG retrieval -> one Gemma final synthesis -> Gemini backup only if Gemma fails -> deterministic fallback if both fail`

## Defense Readiness Checklist

1. Confirm `ollama list` includes the configured `PRIMARY_MODEL`.
2. Confirm `nomic-embed-text` exists.
3. Rebuild/recreate containers after changes.
4. Open `/api/health/metrics`.
5. Verify `gemma_queue_depth=0`.
6. Run two warmup questions before the demo.
7. Keep only needed applications open.
8. Do not enable voice during the defense.
9. Do not enable RAG answer generation during the defense.

## Defense Mode Verdict

Defense mode should prioritize retrieval and deterministic routing, then use exactly one Gemma synthesis call. That is the best stability profile for this hardware.
