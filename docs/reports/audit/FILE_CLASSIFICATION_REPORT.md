# File Classification Report: AAST Academic AI Agent

This report classifies every top-level folder and critical backend script in the repository. Classifications adhere to the Principal Architect safety rules: any candidate for archiving must have a verified confidence score, and files with uncertain usage are labeled `REVIEW_REQUIRED`.

---

## 1. Top-Level Folder Classification

| Directory Path | Classification | Purpose | Reference Traced |
| :--- | :--- | :--- | :--- |
| `aast-ai-agent-main/` | **PRODUCTION** | Contains the core React frontend and Express orchestrator backend. | Started by `start_platform.ps1` |
| `college-decision-system-backend/` | **PRODUCTION / DECISION_ENGINE** | Independent FastAPI microservice evaluating student profiles and providing career/major recommendations. | Port `8005` in `start_platform.ps1` |
| `launcher/` | **SUPPORTING** | Houses PowerShell scripts (`start_platform.ps1`, `stop_platform.ps1`) to orchestrate startup, dependencies, env variables, and diagnostics. | Called by `starter.bat` |
| `colleges/` | **DATASET** | Contains JSON files (`CCIT_HELIOPOLIS.json`, `PHARM_ABUKIR.json`) detailing specific academic requirements. | Input datasets for college matching. |
| `diagrams/` | **SUPPORTING / DOCUMENTATION** | Architectural diagrams and image files mapping database relationships and runtime logic. | Developer references. |
| `book/` | **DOCUMENTATION** | Contains systemic diagrams, trace guides, and sequence diagrams. | Developer references. |
| `doc/` & `docs/` | **DOCUMENTATION** | scattered documentation files (.md, .pdf, .docx, .txt). | Scanned in documentation audit. |
| `multimodal/` | **RESEARCH / EXPERIMENT** | Prototyping code for vision and reasoning pipelines (independent Python app). | Not referenced by launcher or backend. |
| `relationship/` | **RESEARCH / LEGACY** | Neo4j database relationship analyzers and patching scripts from Phase 4b. | Diagnostic files, not run at startup. |
| `step8/` | **DATASET / SCRAPER** | Scrapers (Playwright), crawlers, raw graduated student records, and SQLite databases (`aast_normalized.db`). | Used for scraping and preparing input files. |

---

## 2. Main Backend File Classifications (`aast-ai-agent-main/backend/`)

Every Javascript/Python file under the main backend folder is classified below:

| File Name | Suggested Category | Current Path | Confidence | Reason & Runtime References |
| :--- | :--- | :--- | :--- | :--- |
| `orchestrator.js` | **PRODUCTION / ENTRYPOINT** | `backend/orchestrator.js` | `100%` | Primary backend server starting Express on port 8004. |
| `index.js` | **LEGACY / REVIEW_REQUIRED** | `backend/index.js` | `95%` | Legacy server for starting DB servers in isolation. Has MongoDB connection. |
| `greetings.js` | **PRODUCTION / CONVERSATION** | `backend/greetings.js` | `100%` | Processes quick greeting intents. Imported in `orchestrator.js`. |
| `faqService.js` | **PRODUCTION / RETRIEVAL** | `backend/faqService.js` | `100%` | Performs exact and keyword matches against local `faq.json`. |
| `knowledgeGraphService.js` | **ARCHIVE_CANDIDATE** | `backend/knowledgeGraphService.js` | `99%` | Legacy Chroma-based KG search wrapper. No imports exist in code. |
| `schema.js` | **ARCHIVE_CANDIDATE** | `backend/schema.js` | `99%` | Legacy Drizzle schema for MySQL. No imports exist. |
| `fix_db.js` | **GRAPHRAG_MAINTENANCE** | `backend/fix_db.js` | `100%` | DB patching utility for Neo4j "TEACHES" relationships. Maintenance pipeline. |
| `embed_nodes.py` | **GRAPHRAG_MAINTENANCE** | `backend/embed_nodes.py` | `100%` | Batch script loading Neo4j text and updating node embeddings. Maintenance pipeline. |
| `embed_server_rag.py` | **RESEARCH_UTILITY** | `backend/embed_server_rag.py` | `99%` | Preflight or research utility for verifying BGE-M3 model performance. |
| `ner_service.py` | **RESEARCH_UTILITY** | `backend/ner_service.py` | `99%` | Preflight or research utility for verifying entity extraction schemas. |

---

## 3. Main Backend Services Classifications (`aast-ai-agent-main/backend/services/`)

| Service File | Suggested Category | Confidence | Purpose / Dependencies |
| :--- | :--- | :--- | :--- |
| `brainRouter.js` | **PRODUCTION / CORE_ORCHESTRATION** | `100%` | Central semantic intent router. Core coordinator. |
| `unifiedAnswerService.js`| **PRODUCTION / AI_LAYER** | `100%` | Synthesizes response from KG, RAG, DSS, FAQ, and LLM templates. |
| `ragService.js` | **PRODUCTION / RAG_LAYER** | `100%` | Calls retriever (8001) and answer (8002) endpoints. |
| `neo4jcontext.js` | **PRODUCTION / NEO4J_LAYER** | `100%` | Retrieves context from Neo4j Bolt driver. |
| `decisionService.js` | **PRODUCTION / DECISION_LAYER** | `100%` | Communicates with FastAPI DSS on port 8005 and validates profiles. |
| `conversationService.js` | **PRODUCTION / CONVERSATION_LAYER**| `100%` | Manages active conversation turns, summarizing, and pinning. |
| `circuitStateManager.js` | **PRODUCTION / INFRASTRUCTURE** | `100%` | Implements state machine for service breakers (e.g. Ollama/RAG). |
| `persistenceLayer.js` | **PRODUCTION / INFRASTRUCTURE** | `100%` | Implements debounced JSON writing utilities. |
| `metrics.js` | **PRODUCTION / MONITORING** | `100%` | Registers Prometheus-like metrics snapshots. |
| `logger.js` | **PRODUCTION / INFRASTRUCTURE** | `100%` | Centralized Winston logger utility. |
| `healthProbes.js` | **PRODUCTION / MONITORING** | `100%` | Probes system endpoints to prevent cascading failures. |
| `fusionService.js` | **PRODUCTION / RAG_LAYER** | `100%` | Integrates and ranks GraphRAG + VectorRAG candidates. |
| `geminiService.js` | **PRODUCTION / AI_LAYER** | `100%` | Manages Cloud Google Gemini API requests. |
| `ollamaService.js` | **PRODUCTION / AI_LAYER** | `100%` | Orchestrates local Ollama generation requests and model queues. |
| `modelFailoverManager.js`| **PRODUCTION / AI_LAYER** | `100%` | Controls failovers from Ollama to Gemini. |
| `conversationalHumanizer.js`| **PRODUCTION / AI_LAYER** | `100%` | Grounded answer formatter utilizing LLMs for natural speech. |
| `conversationMetaIntent.js`| **PRODUCTION / CONVERSATION_LAYER**| `100%` | Detects metalogic intents (e.g. "clear memory"). |
| `conversationPriority.js` | **PRODUCTION / CONVERSATION_LAYER**| `100%` | Parses follow-ups and priority scoring. |
| `academicQueryNormalizer.js`| **PRODUCTION / CORE_ORCHESTRATION**| `100%` | Text normalizer cleaning common academic typos/aliases. |
| `academicAliases.js` | **PRODUCTION / CORE_ORCHESTRATION**| `100%` | Predefined dictionary mapping CCIT, AAST, departments. |
| `gemmaWarmService.js` | **PRODUCTION / AI_LAYER** | `100%` | Pre-warms the local model in memory to reduce TTFT. |
| `gemmaTelemetryService.js`| **PRODUCTION / MONITORING** | `100%` | Collects local GPU context, latency, and tokens metrics. |
| `gemmaRequestLimiter.js` | **PRODUCTION / INFRASTRUCTURE** | `100%` | Prevents local CPU/GPU choke via active request queues. |
| `demoGraphService.js` | **PRODUCTION / NEO4J_LAYER** | `100%` | Pre-renders graph structure metadata. |
| `healthMonitor.js` | **PRODUCTION / MONITORING** | `100%` | Central daemon triggering diagnostic reviews. |
| `titleGenerator.js` | **PRODUCTION / CONVERSATION_LAYER**| `100%` | Generates short titles for chat sessions. |
| `responseFormatter.js` | **PRODUCTION / CORE_ORCHESTRATION**| `100%` | Cleans up markdown, bold characters, and links. |
| `neo4jService.js` | **ARCHIVE_CANDIDATE** | `99%` | Empty (0 bytes) file in services folder. Unused. |

---

## 4. GraphRAG Shared Infrastructure Classifications (`aast-ai-agent-main/backend/db/`)

| File Name | Suggested Category | Current Path | Confidence | Reason & Runtime References |
| :--- | :--- | :--- | :--- | :--- |
| `neo4j.js` | **GRAPHRAG_CORE_INFRASTRUCTURE** | `db/neo4j.js` | `100%` | Connects to Bolt protocol port 7687. Shared GraphRAG infrastructure dependency. |
| `mysql.js` | **REVIEW_REQUIRED** | `db/mysql.js` | `95%` | Legacy MySQL database pool. |
| `meili.js` | **REVIEW_REQUIRED** | `db/meili.js` | `95%` | Legacy MeiliSearch client wrapper. |
