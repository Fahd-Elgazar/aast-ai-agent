# Migration Plan: AAST Academic AI Agent Reorganization

This document outlines the exact move mappings for files and directories into the target clean architecture structure. **No operations will be executed until this plan receives formal approval.**

---

## 1. Subproject Level Reorganization

| Path / Module | Action | Suggested Destination | Rationale |
| :--- | :--- | :--- | :--- |
| `aast-ai-agent-main/frontend/` | Move Root | `frontend/` | Standardized root folder. |
| `college-decision-system-backend/`| Keep Isolated | `college-decision-system-backend/` | Production microservice. Retains its own deployable structure, separate from the Node backend. |
| `aast-ai-agent-main/backend/rag_system/` | Move Root | `graphrag/rag_system/` | Group Python RAG Retriever/Answer services together. |

---

## 2. Core Backend File Movements (`aast-ai-agent-main/backend/` to `project/`)

The Express orchestrator backend will be reorganized as follows:

### 2.1 API & Routing Layer
*   `backend/routes/auth.js` ──► `backend/routes/auth.js` (or `archive/auth.js` if authenticated user DB is deactivated)
*   `backend/routes/chatbot.js` ──► `backend/routes/chatbot.js`
*   `backend/routes/decision.js` ──► `backend/routes/decision.js`
*   `backend/routes/conversations.js` ──► `backend/routes/conversations.js`
*   `backend/routes/graph.js` ──► `backend/routes/graph.js`
*   `backend/routes/health.js` ──► `backend/routes/health.js`
*   `backend/middleware/authMiddleware.js` ──► `backend/middleware/authMiddleware.js`

### 2.2 Core Orchestration, Routing & Conversation
*   `backend/orchestrator.js` ──► `core/orchestrator/orchestrator.js`
*   `backend/services/brainRouter.js` ──► `core/routing/brainRouter.js`
*   `backend/services/academicQueryNormalizer.js` ──► `core/routing/academicQueryNormalizer.js`
*   `backend/services/academicAliases.js` ──► `core/routing/academicAliases.js`
*   `backend/faqService.js` ──► `core/routing/faqService.js`
*   `backend/greetings.js` ──► `core/conversation/greetings.js`
*   `backend/services/conversationService.js` ──► `core/conversation/conversationService.js`
*   `backend/services/titleGenerator.js` ──► `core/conversation/titleGenerator.js`
*   `backend/services/conversationMetaIntent.js` ──► `core/conversation/conversationMetaIntent.js`
*   `backend/services/conversationPriority.js` ──► `core/conversation/conversationPriority.js`

### 2.3 AI Layer (LLM, Synthesis, Decision, Career)
*   `backend/services/ollamaService.js` ──► `ai/llm/ollamaService.js`
*   `backend/services/ollamaReadinessService.js` ──► `ai/llm/ollamaReadinessService.js`
*   `backend/services/geminiService.js` ──► `ai/llm/geminiService.js`
*   `backend/services/modelFailoverManager.js` ──► `ai/llm/modelFailoverManager.js`
*   `backend/services/gemmaWarmService.js` ──► `ai/llm/gemmaWarmService.js`
*   `backend/services/unifiedAnswerService.js` ──► `ai/synthesis/unifiedAnswerService.js`
*   `backend/services/conversationalHumanizer.js` ──► `ai/synthesis/conversationalHumanizer.js`
*   `backend/services/responseFormatter.js` ──► `ai/synthesis/responseFormatter.js`
*   `backend/services/decisionService.js` ──► `ai/decision_engine/decisionService.js`

### 2.4 GraphRAG Layer
*   `backend/db/neo4j.js` ──► `graphrag/neo4j/neo4j.js`
*   `backend/services/neo4jcontext.js` ──► `graphrag/graph_retrieval/neo4jcontext.js`
*   `backend/services/demoGraphService.js` ──► `graphrag/graph_retrieval/demoGraphService.js`
*   `backend/services/ragService.js` ──► `graphrag/rag/ragService.js`
*   `backend/services/fusionService.js` ──► `graphrag/fusion/fusionService.js`
*   `backend/embed_nodes.py` ──► `graphrag/neo4j/embed_nodes.py`
*   `backend/fix_db.js` ──► `graphrag/neo4j/fix_db.js`

### 2.5 Infrastructure Layer (Persistence, Breakers, Monitoring, Config)
*   `backend/services/persistenceLayer.js` ──► `infrastructure/persistence/persistenceLayer.js`
*   `backend/services/circuitStateManager.js` ──► `infrastructure/circuit_breaker/circuitStateManager.js`
*   `backend/services/gemmaRequestLimiter.js` ──► `infrastructure/circuit_breaker/gemmaRequestLimiter.js`
*   `backend/services/logger.js` ──► `infrastructure/persistence/logger.js`
*   `backend/services/metrics.js` ──► `infrastructure/monitoring/metrics.js`
*   `backend/services/healthMonitor.js` ──► `infrastructure/monitoring/healthMonitor.js`
*   `backend/services/healthProbes.js` ──► `infrastructure/monitoring/healthProbes.js`
*   `backend/monitoring/metricsService.js` ──► `infrastructure/monitoring/metricsService.js`
*   `backend/services/gemmaTelemetryService.js` ──► `infrastructure/monitoring/gemmaTelemetryService.js`
*   `backend/config/goldenPathRegistry.js` ──► `infrastructure/config/goldenPathRegistry.js`
*   `backend/config/llmConfig.js` ──► `infrastructure/config/llmConfig.js`
*   `backend/config/routingCalibration.js` ──► `infrastructure/config/routingCalibration.js`
*   `backend/config/routingRules.json` ──► `infrastructure/config/routingRules.json`

### 2.6 Data Subfolders
*   `colleges/` ──► `data/datasets/colleges/`
*   `step8/` ──► `data/scraping/` (scrapers, databases, raw graduates outputs)

### 2.7 Dead Code / Archive Candidates (To `archive/` Folder)
*   `backend/index.js` ──► `archive/index.js` (Legacy Express starter)
*   `backend/db/mysql.js` ──► `archive/db/mysql.js` (Legacy helper)
*   `backend/db/meili.js` ──► `archive/db/meili.js` (Legacy helper)
*   `backend/models/User.js` ──► `archive/models/User.js` (Legacy Mongo user model)
*   `backend/knowledgeGraphService.js` ──► `archive/services/knowledgeGraphService.js` (Legacy Chroma helper)
*   `backend/schema.js` ──► `archive/db/schema.js` (Legacy schema)
*   `backend/services/neo4jService.js` ──► `archive/services/neo4jService.js` (Empty placeholder)
*   `backend/embed_server_rag.py` ──► `archive/rag/embed_server_rag.py` (Unused server)
*   `backend/ner_service.py` ──► `archive/rag/ner_service.py` (Unused server)
*   `multimodal/` ──► `archive/multimodal/` (Research folder)
*   `relationship/` ──► `archive/relationship/` (Research/patch folder)
