# Dependency Graph: AAST Academic AI Agent Backend

This report details the import dependencies, dynamic runtime calls, and database links for the core files in the main orchestrator backend.

---

## 1. File Dependency Map

Below is a flat representation of the primary orchestrator files and their immediate dependencies:

*   **orchestrator.js**
    ├─► `routes/chatbot.js`
    ├─► `routes/decision.js`
    ├─► `routes/conversations.js`
    ├─► `routes/health.js`
    ├─► `faqService.js`
    ├─► `greetings.js`
    ├─► `services/neo4jcontext.js`
    ├─► `db/neo4j.js`
    ├─► `services/decisionService.js`
    ├─► `services/metrics.js`
    ├─► `services/logger.js`
    ├─► `services/unifiedAnswerService.js`
    ├─► `services/geminiService.js`
    ├─► `services/modelFailoverManager.js`
    ├─► `services/ollamaService.js`
    ├─► `services/gemmaWarmService.js`
    ├─► `services/academicQueryNormalizer.js`
    ├─► `services/conversationService.js`
    ├─► `services/brainRouter.js`
    ├─► `services/fusionService.js`
    ├─► `services/ragService.js`
    ├─► `services/healthProbes.js`
    ├─► `services/responseFormatter.js`
    ├─► `services/demoGraphService.js`
    ├─► `services/conversationalHumanizer.js`
    ├─► `services/conversationMetaIntent.js`
    ├─► `services/conversationPriority.js`
    └─► `config/goldenPathRegistry.js`

*   **routes/decision.js**
    └─► `services/decisionService.js`

*   **routes/conversations.js**
    └─► `services/conversationService.js`

*   **routes/health.js**
    ├─► `db/neo4j.js`
    ├─► `services/decisionService.js`
    ├─► `services/metrics.js`
    ├─► `services/logger.js`
    ├─► `services/ollamaService.js`
    └─► `services/ragService.js`

*   **services/brainRouter.js**
    └─► `config/goldenPathRegistry.js`

*   **services/unifiedAnswerService.js**
    ├─► `services/logger.js`
    ├─► `services/metrics.js`
    ├─► `services/modelFailoverManager.js`
    ├─► `services/geminiService.js`
    └─► `services/ollamaService.js`

*   **services/decisionService.js**
    ├─► `services/ollamaService.js`
    └─► `services/decisionService.js` (Self builds roadmap)

*   **services/ragService.js**
    └─► `services/metrics.js`

*   **services/neo4jcontext.js**
    └─► `db/neo4j.js`

*   **services/conversationService.js**
    ├─► `services/logger.js`
    ├─► `services/persistenceLayer.js`
    ├─► `services/titleGenerator.js`
    └─► `services/modelFailoverManager.js`

*   **services/modelFailoverManager.js**
    ├─► `services/logger.js`
    ├─► `services/metrics.js`
    ├─► `services/ollamaService.js`
    ├─► `services/geminiService.js`
    └─► `services/circuitStateManager.js`

*   **services/conversationalHumanizer.js**
    └─► `services/modelFailoverManager.js`

*   **services/conversationPriority.js**
    └─► `services/academicQueryNormalizer.js`

*   **services/conversationMetaIntent.js**
    └─► `services/conversationService.js`

*   **services/gemmaWarmService.js**
    └─► `services/ollamaService.js`

*   **config/goldenPathRegistry.js**
    └─► `services/academicQueryNormalizer.js`

---

## 2. Shared Database Connection Layer
*   **db/neo4j.js**
    └─► `neo4j-driver` (npm library connecting to Bolt protocol port 7687)
*   **db/mysql.js** (Legacy)
    └─► `mysql2` (npm library)
*   **db/meili.js** (Legacy)
    └─► `meilisearch` (npm library)
