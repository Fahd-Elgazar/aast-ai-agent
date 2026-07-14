# Source Architecture Evidence

The visuals use repository-relative evidence only.

## Official names

- `README.md`: `AAST AI Academic Advisor`
- `aast-ai-agent-main/backend/services/unifiedAnswerService.js`: `AAST Explainable Hybrid GraphRAG Academic Advisor`
- `aast-ai-agent-main/backend/services/brainRouter.js`: `AAST Explainable Hybrid Academic Super-Agent`

## Services

- `docker-compose.yml`: `frontend`, `backend`, `decision-api`, `rag-retriever`, `rag-answer`, `qdrant`, `neo4j`
- `aast-ai-agent-main/backend/README.md`: production entry point is `orchestrator.js`

## API flow

- `aast-ai-agent-main/backend/orchestrator.js`: `POST /api/chatbot/query`
- `aast-ai-agent-main/backend/orchestrator.js`: query normalization, conversation memory, subsystem health, Brain Router, route execution, unified synthesis, response enrichment

## Brain Router

- `aast-ai-agent-main/backend/services/brainRouter.js`: routes include `KG_DIRECT`, `KG_ONLY`, `RAG_DIRECT`, `RAG_ONLY`, `HYBRID_KG_RAG`, `DECISION_ENGINE`, `CAREER_ENGINE`, `FAQ`, and `LLM_FALLBACK`

## Memory

- `aast-ai-agent-main/backend/services/conversationService.js`: persistent conversation JSON, `lastRoute`, `conversationMemory`, recent subjects
- `aast-ai-agent-main/backend/services/decisionService.js`: decision-side session memory

## Retrieval

- `aast-ai-agent-main/backend/services/neo4jcontext.js`: Neo4j context retrieval and graph response construction
- `aast-ai-agent-main/backend/rag_system/phase3_retriever.py`: Qdrant collection `aast_academic_rag_production`, embedding model `BAAI/bge-m3`, `/search`, `/health`
- `aast-ai-agent-main/backend/services/ragService.js`: multi-pass RAG search and optional answer-engine fallback

## LLM

- `aast-ai-agent-main/backend/services/unifiedAnswerService.js`: final synthesis from Neo4j, RAG, FAQ, and Decision contexts
- `aast-ai-agent-main/backend/config/llmConfig.js`: default primary model `gemma4:e2b`, backup model `tinyllama:latest`
- `aast-ai-agent-main/backend/services/geminiService.js`: default Gemini model `gemini-2.5-flash`

## Decision Support

- `college-decision-system-backend/app/main.py`: FastAPI decision application
- `college-decision-system-backend/app/api/v1/routers/decisions.py`: `/api/v1/decisions/recommend`
- `college-decision-system-backend/app/api/v1/dependencies/security.py`: `X-Internal-Secret`
