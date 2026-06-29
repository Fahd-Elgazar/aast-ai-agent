# Phase 2 Precheck: Reorganization Batches

This precheck report groups files and modules into distinct risk tiers before executing Phase 2 movements.

---

## 1. Migration-Protected Core Files (UNSAFE FOR FIRST BATCH)

The following files are **migration-protected** and must **NOT** be moved in the initial migration batches. They define the platform entry points, primary semantic routers, or shared core GraphRAG database infrastructure/pipelines. They will be reorganized only after all supporting services have been relocated and verified:

*   `aast-ai-agent-main/backend/orchestrator.js` (Express Server Entrypoint)
*   `aast-ai-agent-main/backend/services/brainRouter.js` (Semantic Router)
*   `aast-ai-agent-main/backend/services/unifiedAnswerService.js` (Synthesis Layer)
*   `aast-ai-agent-main/backend/services/ragService.js` (RAG Bridge)
*   `aast-ai-agent-main/backend/services/neo4jcontext.js` (GraphRAG Context)
*   `aast-ai-agent-main/backend/services/conversationService.js` (Session Memory)
*   `aast-ai-agent-main/backend/db/neo4j.js` (**GraphRAG Core Infrastructure**)
*   `aast-ai-agent-main/backend/fix_db.js` (**GraphRAG Maintenance**)
*   `aast-ai-agent-main/backend/embed_nodes.py` (**GraphRAG Maintenance**)

---

## 2. Files Safe to Move (SUPPORTING SERVICES BATCH)

The files below are isolated helpers and services with no circular runtime entry point dependencies. They are safe to reorganize in the first migration batch, provided their caller imports in `orchestrator.js` are updated:

### 2.1 Configuration Layer (Target: `infrastructure/config/`)
*   `backend/config/llmConfig.js`
*   `backend/config/routingCalibration.js`
*   `backend/config/routingRules.json`

### 2.2 Persistence & Infrastructure (Target: `infrastructure/persistence/` or `infrastructure/circuit_breaker/`)
*   `backend/services/persistenceLayer.js`
*   `backend/services/circuitStateManager.js`
*   `backend/services/gemmaRequestLimiter.js`
*   `backend/services/logger.js`

### 2.3 Monitoring & Telemetry (Target: `infrastructure/monitoring/`)
*   `backend/services/metrics.js`
*   `backend/services/healthMonitor.js`
*   `backend/services/healthProbes.js`
*   `backend/monitoring/metricsService.js`
*   `backend/services/gemmaTelemetryService.js`

### 2.4 LLM Runtime Wrappers (Target: `ai/llm/` or `ai/synthesis/`)
*   `backend/services/gemmaWarmService.js`
*   `backend/services/ollamaReadinessService.js`
*   `backend/services/responseFormatter.js`

---

## 3. Files Requiring Manual Review / Postponed Moves

Reorganizing the following files requires checking active dependencies or adjusting configuration setups:

| File Name | Target Path | Reason for Postponement / Review |
| :--- | :--- | :--- |
| `backend/index.js` | `archive/index.js` | Referenced by multiple npm script entry points (`npm run dev`, `npm run neo`, etc.). Requires script edits in `package.json` before moving. |
| `backend/db/mysql.js` | `archive/db/mysql.js` | Referenced by `index.js`. |
| `backend/db/meili.js` | `archive/db/meili.js` | Referenced by `index.js`. |
| `backend/routes/mysql.js` | `archive/routes/mysql.js` | Referenced by `index.js`. |
| `backend/routes/search.js` | `archive/routes/search.js` | Referenced by `index.js`. |
| `backend/routes/auth.js` | `archive/routes/auth.js` | Referenced by `index.js` (depends on Mongo user schema). |
| `backend/models/User.js` | `archive/models/User.js` | Referenced by `routes/auth.js`. |
| `backend/schema.js` | `archive/db/schema.js` | Drizzle schema referencing MySQL. Unused in production. |
| `backend/knowledgeGraphService.js` | `archive/services/knowledgeGraphService.js` | Unused, but references legacy Chroma setup. |
| `backend/embed_server_rag.py` | `archive/rag/embed_server_rag.py` | Unused python server. |
| `backend/ner_service.py` | `archive/rag/ner_service.py` | Unused python server. |
| `backend/services/decisionService.txt` | `archive/services/decisionService.txt` | Backup text file. |
