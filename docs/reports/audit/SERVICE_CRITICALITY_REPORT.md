# Service Criticality Report: AAST Academic AI Agent

This report assigns a service criticality rating (**Critical**, **High**, **Medium**, **Low**) to every active backend service and helper inside the Express orchestrator.

---

## 1. Criticality Classification Matrix

| Service File | Criticality | Operational Impact | Dependencies |
| :--- | :--- | :--- | :--- |
| **orchestrator.js** | **Critical** | Single point of entry. Express server hosting ports. Failure offline is total system blackout. | `routes/*`, `services/*`, `db/*` |
| **brainRouter.js** | **Critical** | Core semantic router directing traffic to KG, RAG, FAQ, DSS, or chat. Failures break queries. | `config/goldenPathRegistry.js` |
| **unifiedAnswerService.js**| **Critical** | Single final answer synthesis layer integrating KG, RAG, FAQ, and DSS. | `ollamaService.js`, `geminiService.js` |
| **ragService.js** | **Critical** | Gateway to VectorRAG retriever and answer engine services. | RAG Retriever (8001), RAG Answer (8002) |
| **neo4jcontext.js** | **Critical** | Connects to Bolt driver to pull graph nodes and relations context. | `db/neo4j.js` |
| **conversationService.js** | **Critical** | Manages session contexts, memory history turns, and pinning. | `persistenceLayer.js` |
| **decisionService.js** | **Critical** | Normalizes student grades, extracts parameters, and calls FastAPI DSS. | FastAPI DSS (8005) |
| **circuitStateManager.js** | **High** | Protects Express threads. Flips breaker to prevent hangs on offline services. | None |
| **modelFailoverManager.js** | **High** | Orchestrates routing from local Ollama to cloud Gemini if local LLM fails. | `ollamaService.js`, `geminiService.js` |
| **ollamaService.js** | **High** | Handles local model chat generation pipelines and queues. | Local Ollama API (11434) |
| **conversationalHumanizer.js**| **High** | Restructures raw database schema tables into smooth readable answers. | `modelFailoverManager.js` |
| **academicQueryNormalizer.js**| **High** | Fixes syntax typos and resolves common academic aliases. | `services/academicAliases.js` |
| **logger.js** | **High** | Central Winston logger daemon writing chat audits. | Local file system |
| **metrics.js** | **High** | Registers system statistics (latencies, counts). | None |
| **healthProbes.js** | **High** | Probes active service listeners to feed breaker managers. | `db/neo4j.js`, `decisionService.js`, `ragService.js` |
| **persistenceLayer.js** | **Medium** | Debounces JSON storage updates to disk. | Node FS modules |
| **gemmaWarmService.js** | **Medium** | Pre-warms the local model on startup to speed up first query. | `ollamaService.js` |
| **gemmaRequestLimiter.js** | **Medium** | Limits concurrent local LLM execution. | None |
| **conversationMetaIntent.js**| **Medium** | Processes meta commands like "forget my profile". | None |
| **conversationPriority.js** | **Medium** | Resolves follow-up query pronouns and priorities. | None |
| **academicAliases.js** | **Medium** | Dictionary containing aliases. | None |
| **demoGraphService.js** | **Medium** | Formats schema nodes list. | None |
| **responseFormatter.js** | **Medium** | Cleans output strings. | None |
| **healthMonitor.js** | **Low** | Periodically checks diagnostics advice. | `healthProbes.js` |
| **titleGenerator.js** | **Low** | Automatically creates names for chat sessions. | `modelFailoverManager.js` |
| **gemmaTelemetryService.js**| **Low** | Logs GPU telemetry metrics. | None |
| **neo4jService.js** | **Legacy** | Unused placeholder. | None |

---

## 2. Definitions and Impact Level Criteria

1.  **Critical**: Subsystems whose absence makes the application completely unusable. Cannot execute any chatbot or recommendation query.
2.  **High**: Core wrappers that ensure stability, model execution, failovers, and request queueing. Absence causes severe latency, crashes, or unhumanized output.
3.  **Medium**: Utility services providing performance optimizations (e.g. pre-warming), disk savings (e.g. debounced writing), and semantic aliases mapping. Absence degrades but does not halt core queries.
4.  **Low**: Optional features (session titles generation, diagnostic recommendations, telemetry logging). Absence has zero user-facing impact.
