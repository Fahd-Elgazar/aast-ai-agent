# Phase 3 Execution Plan: Reorganization Batches

This execution plan outlines the file movements, import rewrites, validation, and rollback strategies for each migration batch. **No file movements will be executed until this plan receives formal approval.**

---

## Batch 1: Documentation Reorganization
*   **Batch Number**: 1
*   **Files To Move**: All scattered system manuals, design specs, PDFs, and image diagrams.
*   **Source Paths**:
    *   Root: `DOCKERIZATION.md`, `MASTER_PROJECT_BANK.md`, `MASTER_TECHNICAL_DOCUMENTATION.md`, `academic_ai_engineer_portfolio.md`, `cv.md`, `cv.pdf`, `diagram.*`.
    *   `book/`: All files.
    *   `doc/MASTER_TECHNICAL_DOCUMENTATION.md`
    *   `college-decision-system-backend/SECURITY_SCRUB_GUIDE.md`, `SEMANTIC_TAGGING_GUIDE.md`.
    *   `college-decision-system-backend/docs/*`
    *   `aast-ai-agent-main/docs/*`
    *   `relationship/graph_metrics_phase4b.md`
    *   `aast-ai-agent-main/AAST_AGENT_SYSTEM_DOCS.md`
*   **Target Paths**: Layered directories inside `docs/` (`architecture/`, `api/`, `deployment/`, `development/`, `reports/`, `diagrams/`, `research/`, `archive/`).
*   **Import Rewrites**: None (zero code imports exist for documentation files).
*   **Validation Commands**: Validate folder structure using file existence checks.
*   **Rollback Plan**: Restore documents to original paths from the backup branch.
*   **Estimated Risk**: **Zero Risk**.

---

## Batch 2: Non-Runtime Support Files
*   **Batch Number**: 2
*   **Files To Move**: Data folders, scraping tools, and offline processing research utilities.
*   **Source Paths**:
    *   Root: `colleges/` and `step8/`
    *   `aast-ai-agent-main/backend/embed_server_rag.py`
    *   `aast-ai-agent-main/backend/ner_service.py`
*   **Target Paths**:
    *   `colleges/` ──► `data/datasets/colleges/`
    *   `step8/` ──► `data/scraping/`
    *   `embed_server_rag.py` ──► `graphrag/neo4j/embed_server_rag.py`
    *   `ner_service.py` ──► `graphrag/graph_retrieval/ner_service.py`
*   **Import Rewrites**: None (no active codebase modules import these files).
*   **Validation Commands**: Check directories; run `python -m py_compile` on moved python files.
*   **Rollback Plan**: Delete moved directories and check out original folders from the git backup branch.
*   **Estimated Risk**: **Low Risk**.

---

## Batch 3: Infrastructure Files
*   **Batch Number**: 3
*   **Files To Move**: Configuration layers, Winston logger, circuit breakers, and telemetry probes.
*   **Source Paths**:
    *   `aast-ai-agent-main/backend/services/logger.js`
    *   `aast-ai-agent-main/backend/services/persistenceLayer.js`
    *   `aast-ai-agent-main/backend/services/circuitStateManager.js`
    *   `aast-ai-agent-main/backend/services/gemmaRequestLimiter.js`
    *   `aast-ai-agent-main/backend/services/metrics.js`
    *   `aast-ai-agent-main/backend/services/healthProbes.js`
    *   `aast-ai-agent-main/backend/services/healthMonitor.js`
    *   `aast-ai-agent-main/backend/config/llmConfig.js`, `routingCalibration.js`, `routingRules.json`
*   **Target Paths**: `infrastructure/persistence/`, `infrastructure/circuit_breaker/`, `infrastructure/monitoring/`, `infrastructure/config/`.
*   **Import Rewrites**: Rewrite relative imports inside all affected files according to `IMPORT_REWRITE_REPORT.md` (e.g. `logger.js` imports, `persistenceLayer.js` imports inside `conversationService.js`).
*   **Validation Commands**: Run `npm run lint` and `npm run build` in the backend root directory.
*   **Rollback Plan**: Roll back changes via git command: `git checkout -f && git clean -fd`.
*   **Estimated Risk**: **Medium Risk** (requires careful rewrite of config paths in `orchestrator.js`).

---

## Batch 4: Low-Risk & Supporting Services
*   **Batch Number**: 4
*   **Files To Move**: Typo normalizers, alias dictionary, formatting wrappers, and chat session generators.
*   **Source Paths**:
    *   `services/academicAliases.js`, `academicQueryNormalizer.js`, `titleGenerator.js`, `conversationMetaIntent.js`, `conversationPriority.js`, `demoGraphService.js`, `responseFormatter.js`, `gemmaWarmService.js`, `gemmaTelemetryService.js`, `ollamaReadinessService.js`, `faqService.js`, `greetings.js`
*   **Target Paths**: `core/routing/`, `core/conversation/`, `infrastructure/monitoring/`, `ai/llm/`, `ai/synthesis/`.
*   **Import Rewrites**: Re-map relative imports in `orchestrator.js` and other callers.
*   **Validation Commands**: `npm run lint` and startup diagnostics.
*   **Rollback Plan**: Roll back changes via git rollback branch.
*   **Estimated Risk**: **Medium Risk**.

---

## Batch 5: Core Backend Services
*   **Batch Number**: 5
*   **Files To Move**: Core synthesis and scoring engines.
*   **Source Paths**: `services/ollamaService.js`, `geminiService.js`, `modelFailoverManager.js`, `conversationalHumanizer.js`, `decisionService.js`, `fusionService.js`.
*   **Target Paths**: `ai/llm/`, `ai/synthesis/`, `ai/decision_engine/`, `graphrag/fusion/`.
*   **Import Rewrites**: Re-map critical LLM references and decision endpoints.
*   **Validation Commands**: Full local system preflight health queries.
*   **Rollback Plan**: Branch rollback reset.
*   **Estimated Risk**: **High Risk**.

---

## Batch 6: Protected Core & GraphRAG Services (FINAL MIGRATION BATCH)
*   **Batch Number**: 6
*   **Files To Move**: Core semantic routes, database drivers, and the main Express server entry point.
*   **Source Paths**:
    *   `services/conversationService.js`
    *   `services/neo4jcontext.js`
    *   `services/ragService.js`
    *   `services/unifiedAnswerService.js`
    *   `services/brainRouter.js`
    *   `backend/orchestrator.js`
    *   `backend/db/neo4j.js` (**GraphRAG Core Infrastructure**)
    *   `backend/fix_db.js` (**GraphRAG Maintenance**)
    *   `backend/embed_nodes.py` (**GraphRAG Maintenance**)
*   **Target Paths**:
    *   `core/conversation/conversationService.js`
    *   `graphrag/graph_retrieval/neo4jcontext.js`
    *   `graphrag/rag/ragService.js`
    *   `ai/synthesis/unifiedAnswerService.js`
    *   `core/routing/brainRouter.js`
    *   `core/orchestrator/orchestrator.js`
    *   `graphrag/neo4j/neo4j.js`
    *   `graphrag/neo4j/fix_db.js`
    *   `graphrag/neo4j/embed_nodes.py`
*   **Import Rewrites**: Re-map main Express route endpoints, database singletons, and orchestrator service initializations.
*   **Validation Commands**: Central golden check benchmark queries validation.
*   **Rollback Plan**: Full system branch rollback.
*   **Estimated Risk**: **High Risk**.
