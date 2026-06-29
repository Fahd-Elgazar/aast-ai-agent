# Current Runtime Architecture

Date: 2026-06-20

Scope: single-machine deployment only. No Kubernetes, cloud, or multi-machine assumptions are used.

## Verification Status

- Active compose authority: `C:\AI_AGENT\docker-compose.yml`.
- Backend container entrypoint: `aast-ai-agent-main/backend/Dockerfile:15` runs `npm run start:orchestrator`, and `aast-ai-agent-main/backend/package.json:7` runs `node --max-old-space-size=3072 orchestrator.js`.
- Local Ollama model list was checked. Installed local generation models include `gemma4:e2b`, `gemma4:e4b`, `tinyllama:latest`, and `llava:latest`; `nomic-embed-text:latest` is installed for embeddings. The exact requested model name `gemma3:e2b` was not present.
- Live Docker container state was not proven because Docker Desktop engine pipe was unavailable from this session. `docker compose config` was valid, so this architecture is based on compose plus source code.

## Active Services

The active compose stack is single machine:

- Frontend: `frontend`, port `127.0.0.1:5173`.
- Node Orchestrator: `backend`, port `127.0.0.1:8004`.
- Decision API: `decision-api`, port `127.0.0.1:8005`.
- RAG Retriever: `rag-retriever`, port `127.0.0.1:8001`.
- RAG Answer service: `rag-answer`, port `127.0.0.1:8002`, but generation is disabled by `RAG_ANSWER_ENGINE_ENABLED=false`.
- Qdrant: `qdrant`, port `127.0.0.1:6333`.
- Neo4j: `neo4j`, ports `127.0.0.1:7474` and `127.0.0.1:7687`.
- Ollama: host service at `OLLAMA_BASE_URL`, referenced by backend and RAG answer.

Compose evidence:

- Backend service and env file: `docker-compose.yml:26-45`.
- Backend dependencies on Decision API, RAG, Neo4j: `docker-compose.yml:48-56`.
- RAG retriever service and Qdrant dependency: `docker-compose.yml:102-122`.
- RAG answer generation flag: `docker-compose.yml:138-146`.
- Neo4j memory settings: `docker-compose.yml:187-191`.

## Route Inventory

### Node Orchestrator

Mounted in `aast-ai-agent-main/backend/orchestrator.js`:

- `POST /api/chatbot/query`: main user chat route, `orchestrator.js:575`.
- `/api/chatbot/legacy`: legacy chatbot router, `orchestrator.js:210`; route implementation `routes/chatbot.js:25`.
- `/api/decision`: Node decision proxy, `orchestrator.js:211`; `POST /api/decision/recommend` in `routes/decision.js:35`.
- `/api/conversations`: conversation memory CRUD, `orchestrator.js:228`; implementation includes list, create, get, patch, delete in `routes/conversations.js`.
- `/health` and `/api/health`: health router, `orchestrator.js:279-280`.
- `/health/enterprise` and `/api/health/enterprise`: enterprise health view, `routes/health.js:286`.
- `/health/metrics` and `/api/health/metrics`: metrics snapshot, `routes/health.js:304`.

### Decision API

Mounted in `college-decision-system-backend/app/main.py`:

- `GET /health`: system health, `main.py:37`.
- `POST /api/v1/students/evaluate`: schema validation, `students.py`.
- `POST /api/v1/decisions/recommend`: deterministic recommendation engine, `decisions.py`.
- `POST /api/v1/chat/message`: Gemini chat route, now disabled by config unless `DECISION_GEMINI_ENABLED=true`.
- `GET /api/v1/admin/programs` and `PUT /api/v1/admin/programs/{program_id}`: admin program data, `admin.py`.
- Voice routes are mounted only when `VOICE_ENABLED=true`; current examples set it false. Mount gate is `main.py:31-34`.

### RAG Services

RAG Retriever, `aast-ai-agent-main/backend/rag_system/phase3_retriever.py`:

- `GET /`
- `POST /search`
- `GET /health`
- `POST /warmup`
- `GET /benchmark`

RAG Answer, `aast-ai-agent-main/backend/rag_system/phase4_llm_answer_engine.py`:

- `GET /`
- `POST /answer`
- `GET /health`
- `GET /benchmark`

The RAG answer route is left available for compatibility, but generation is disabled unless `RAG_ANSWER_ENGINE_ENABLED=true`.

## Main User Request Flow

1. Frontend calls `POST /api/chatbot/query` on Node Orchestrator.
2. Orchestrator records request metrics at `orchestrator.js:578-590`.
3. Query normalization and deterministic routing run inside `orchestrator.js`.
4. Intent classification is deterministic by default. The LLM intent call exists but is bypassed unless `LLM_INTENT_ENABLED=true`, `orchestrator.js:466-500`.
5. Orchestrator may query:
   - Neo4j graph service through `services/neo4jcontext.js`.
   - RAG retriever through `services/ragService.js`.
   - Decision API through `services/decisionService.js`.
   - Conversation memory through the conversation service.
6. Graph refinement is bypassed in single-Gemma/defense mode, `orchestrator.js:1380-1400` and `neo4jcontext.js:89-110`.
7. RAG answer generation is bypassed by runtime mode. Retrieval-only search remains available, `ragService.js:641-675` and `ragService.js:736-747`.
8. Final answer synthesis runs in `services/unifiedAnswerService.js`:
   - Gemma primary via Ollama.
   - Gemini backup if Gemma fails and `GEMINI_BACKUP_ENABLED=true`.
   - Deterministic fallback if both LLM paths fail or policy requires it.

## LLM And Model Calls

### Gemma Generation Calls

- Final synthesis: `unifiedAnswerService.js:488-520`, current primary path.
- Intent extraction: `orchestrator.js:500`, currently disabled by `LLM_INTENT_ENABLED=false`.
- Graph refine: `neo4jcontext.js:110`, currently disabled by `KG_GRAPH_REFINE_ENABLED=false` and single-Gemma mode.
- Graph safe reformatter: `neo4jcontext.js:178`, currently disabled by `KG_SAFE_REFORMAT_ENABLED=false` and single-Gemma mode.
- Pre-synthesis LLM fallback: `orchestrator.js:2850`, currently bypassed by `SINGLE_GEMMA_GENERATION_MODE=true`.
- RAG answer engine: `phase4_llm_answer_engine.py`, currently retrieval-only unless `RAG_ANSWER_ENGINE_ENABLED=true`.
- Decision extraction fallback: `decisionService.js:261`, currently disabled by `DECISION_LLM_EXTRACTION_ENABLED=false`.
- Warm pool: `gemmaWarmService.js:106`, no longer enabled by default.

### Gemini Calls

- Final synthesis backup: `unifiedAnswerService.js:555-566`.
- Humanizer: `conversationalHumanizer.js:344`, currently disabled by `GEMINI_HUMANIZER_ENABLED=false`.
- Decision API chat: `agent_service.py:19`, `agent_service.py:100`, currently disabled by `DECISION_GEMINI_ENABLED=false` in environment examples.
- Decision API voice extraction: `speech_service.py:192-196`, currently disabled by `DECISION_GEMINI_ENABLED=false`; voice routes disabled by `VOICE_ENABLED=false`.

### Embedding Calls

- Neo4j vector retrieval calls Ollama `/api/embeddings` with `nomic-embed-text`, not Gemma generation: `neo4jcontext.js:15-33`.
- RAG retriever uses local BAAI/bge-m3 embeddings on CPU and Qdrant, not Gemma generation: `phase3_retriever.py`.

## Current Runtime Verdict

The architecture is now a single-machine, retrieval-first, one-Gemma-generation design:

`Frontend -> Node Orchestrator -> deterministic routing -> Neo4j/RAG/Decision retrieval -> Gemma final synthesis -> Gemini backup -> deterministic fallback`

The remaining high-risk live-runtime gap is not code structure; it is operational: Docker Desktop was not running/inspectable from this session, so live container health remains not proven.
