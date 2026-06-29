# Migration Batches: Reorganization Phases

This report outlines the proposed 6-batch migration plan, starting with zero-risk documentation moves and concluding with the migration-protected core orchestration and GraphRAG infrastructure files. In compliance with Phase 2 requirements, **no files will be moved or renamed at this time.**

---

## Batch 1: Documentation Consolidation
*   **Action**: Reorganize scattered system manuals, diagrams, and reports into the unified `docs/` tree.
*   **Risk**: **None** (zero impact on runtime code or execution).
*   **Files Included**:
    *   Root: `DOCKERIZATION.md`, `MASTER_PROJECT_BANK.md`, `MASTER_TECHNICAL_DOCUMENTATION.md`, `academic_ai_engineer_portfolio.md`, visual diagram files (`diagram.*`).
    *   `book/`: All files.
    *   `doc/MASTER_TECHNICAL_DOCUMENTATION.md`
    *   Subfolders docs: `aast-ai-agent-main/docs/` and `college-decision-system-backend/docs/`.
    *   Guides: `college-decision-system-backend/SECURITY_SCRUB_GUIDE.md`, `SEMANTIC_TAGGING_GUIDE.md`.
    *   Graph metrics: `relationship/graph_metrics_phase4b.md`.

---

## Batch 2: Non-Runtime Support Files
*   **Action**: Relocate non-critical data folders, scraping tools, and offline processing research utilities.
*   **Risk**: **Low** (modules are not active in main orchestrator execution loop).
*   **Files/Folders Included**:
    *   Folder: `colleges/` ──► `data/datasets/colleges/`
    *   Folder: `step8/` ──► `data/scraping/`
    *   Research Utility: `aast-ai-agent-main/backend/embed_server_rag.py` ──► `graphrag/neo4j/embed_server_rag.py` (reference utility)
    *   Research Utility: `aast-ai-agent-main/backend/ner_service.py` ──► `graphrag/graph_retrieval/ner_service.py` (reference utility)

---

## Batch 3: Infrastructure Files
*   **Action**: Reorganize configurations, logger daemons, breakers, and monitoring helper scripts.
*   **Risk**: **Low to Medium** (requires rewriting paths in orchestrator backend).
*   **Files Included**:
    *   Logger: `services/logger.js` ──► `infrastructure/persistence/logger.js`
    *   Persistence: `services/persistenceLayer.js` ──► `infrastructure/persistence/persistenceLayer.js`
    *   Breakers: `services/circuitStateManager.js` ──► `infrastructure/circuit_breaker/circuitStateManager.js`
    *   Queue limiters: `services/gemmaRequestLimiter.js` ──► `infrastructure/circuit_breaker/gemmaRequestLimiter.js`
    *   Metrics: `services/metrics.js` ──► `infrastructure/monitoring/metrics.js`
    *   Health probes: `services/healthProbes.js` ──► `infrastructure/monitoring/healthProbes.js`
    *   Health monitor: `services/healthMonitor.js` ──► `infrastructure/monitoring/healthMonitor.js`
    *   Config: `config/llmConfig.js`, `routingCalibration.js`, `routingRules.json` ──► `infrastructure/config/`

---

## Batch 4: Low-Risk & Supporting Services
*   **Action**: Reorganize supporting services that are not main entry points.
*   **Risk**: **Medium** (requires updating imports in both helpers and callers).
*   **Files Included**:
    *   `services/academicAliases.js` ──► `core/routing/academicAliases.js`
    *   `services/academicQueryNormalizer.js` ──► `core/routing/academicQueryNormalizer.js`
    *   `backend/greetings.js` ──► `core/conversation/greetings.js`
    *   `backend/faqService.js` ──► `core/routing/faqService.js`
    *   `services/titleGenerator.js` ──► `core/conversation/titleGenerator.js`
    *   `services/conversationMetaIntent.js` ──► `core/conversation/conversationMetaIntent.js`
    *   `services/conversationPriority.js` ──► `core/conversation/conversationPriority.js`
    *   `services/demoGraphService.js` ──► `graphrag/graph_retrieval/demoGraphService.js`
    *   `services/responseFormatter.js` ──► `ai/synthesis/responseFormatter.js`
    *   `services/gemmaWarmService.js` ──► `ai/llm/gemmaWarmService.js`
    *   `services/gemmaTelemetryService.js` ──► `infrastructure/monitoring/gemmaTelemetryService.js`
    *   `services/ollamaReadinessService.js` ──► `ai/llm/ollamaReadinessService.js`

---

## Batch 5: Core Backend Services
*   **Action**: Reorganize secondary core backend services.
*   **Risk**: **Medium to High**.
*   **Files Included**:
    *   `services/ollamaService.js` ──► `ai/llm/ollamaService.js`
    *   `services/geminiService.js` ──► `ai/llm/geminiService.js`
    *   `services/modelFailoverManager.js` ──► `ai/llm/modelFailoverManager.js`
    *   `services/conversationalHumanizer.js` ──► `ai/synthesis/conversationalHumanizer.js`
    *   `services/decisionService.js` ──► `ai/decision_engine/decisionService.js`
    *   `services/fusionService.js` ──► `graphrag/fusion/fusionService.js`

---

## Batch 6: Protected Core & GraphRAG Services (FINAL MIGRATION BATCH)
*   **Action**: Move the migration-protected files that define the platform entry points, primary semantic routers, and core shared GraphRAG infrastructure/maintenance files.
*   **Risk**: **High** (requires final end-to-end routing validation).
*   **Files Included**:
    *   `services/conversationService.js` ──► `core/conversation/conversationService.js`
    *   `services/neo4jcontext.js` ──► `graphrag/graph_retrieval/neo4jcontext.js`
    *   `services/ragService.js` ──► `graphrag/rag/ragService.js`
    *   `services/unifiedAnswerService.js` ──► `ai/synthesis/unifiedAnswerService.js`
    *   `services/brainRouter.js` ──► `core/routing/brainRouter.js`
    *   `backend/orchestrator.js` ──► `core/orchestrator/orchestrator.js`
    *   `backend/db/neo4j.js` ──► `graphrag/neo4j/neo4j.js` (**GraphRAG Core Infrastructure**)
    *   `backend/fix_db.js` ──► `graphrag/neo4j/fix_db.js` (**GraphRAG Maintenance**)
    *   `backend/embed_nodes.py` ──► `graphrag/neo4j/embed_nodes.py` (**GraphRAG Maintenance**)
