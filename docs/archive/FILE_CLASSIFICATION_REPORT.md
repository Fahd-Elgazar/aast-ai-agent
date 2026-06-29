# File Classification Report
**AAST AI Agent — Repository Asset Classifications**

This report classifies all major directories and files in the project workspace based on their runtime status, dependencies, and roles in the production environment.

---

## 1. Classification Categories

The files are classified under the following categories:
*   **`PRODUCTION`**: Active files running on the live Express node server.
*   **`PRODUCTION_MICROSERVICE`**: Deployable microservices running in isolated environments.
*   **`PRODUCTION_GRAPHRAG`**: Active graph-based grounding modules.
*   **`PRODUCTION_RAG`**: Active vector-based policy retrieval modules.
*   **`SUPPORTING`**: Essential infrastructure adapters (logging, metrics, testing).
*   **`DATA`**: Static assets, database dumps, datasets, and scraping exports.
*   **`DOCUMENTATION`**: Markdown and PDF documentation files.
*   **`EXPERIMENT` / `RESEARCH`**: Legacy prototypes, testing utilities, and offline analysis tools.
*   **`LEGACY`**: Unused code from older phases of the project.
*   **`REVIEW_REQUIRED`**: Files requiring further review or containing duplicate data backups.

---

## 2. File and Directory Classifications

### 2.1 Core Orchestration Backend (`aast-ai-agent-main/backend/`)
*   `orchestrator.js` $\rightarrow$ **`PRODUCTION`**
    *   *Reasoning:* Main production server entry point. Configures Express server on Port 8004, manages CORS/middleware, and orchestrates the chatbot logic.
*   `services/brainRouter.js` $\rightarrow$ **`PRODUCTION`**
    *   *Reasoning:* Central intent classifier. Routes incoming requests to appropriate services.
*   `services/unifiedAnswerService.js` $\rightarrow$ **`PRODUCTION`**
    *   *Reasoning:* Core synthesis service combining GraphRAG and vector RAG contexts.
*   `services/conversationService.js` $\rightarrow$ **`PRODUCTION`**
    *   *Reasoning:* Manages conversational history operations (creating, saving, retrieving session logs).
*   `services/neo4jcontext.js` $\rightarrow$ **`PRODUCTION`**
    *   *Reasoning:* Fetches neighborhood context graphs from Neo4j database using active session connections.
*   `services/ragService.js` $\dots$ **`PRODUCTION`**
    *   *Reasoning:* Handles HTTP query communication to the Python RAG retriever.
*   `services/responseFormatter.js` $\rightarrow$ **`PRODUCTION`**
    *   *Reasoning:* Cleans up and structures LLM responses.
*   `services/decisionService.js` $\rightarrow$ **`PRODUCTION`**
    *   *Reasoning:* Bridge to DSS endpoints.
*   `services/persistenceLayer.js` $\rightarrow$ **`PRODUCTION`**
    *   *Reasoning:* Binds file-based conversation logging.
*   `services/logger.js` & `services/metrics.js` $\rightarrow$ **`SUPPORTING`**
    *   *Reasoning:* Active run-time infrastructure logging and metrics collector modules.
*   `db/neo4j.js` $\rightarrow$ **`PRODUCTION_GRAPHRAG`**
    *   *Reasoning:* Binds active Bolt driver connections to Neo4j.
*   `index.js` $\rightarrow$ **`LEGACY`**
    *   *Reasoning:* Monolithic backend entry point. Has been fully replaced by `orchestrator.js`.
*   `db/mysql.js` & `routes/mysql.js` $\rightarrow$ **`LEGACY`**
    *   *Reasoning:* Bypassed MySQL connection pool and associated query routes.
*   `routes/auth.js` & `models/User.js` $\rightarrow$ **`LEGACY`**
    *   *Reasoning:* Legacy MongoDB auth endpoints and schemas, bypassed in production.

### 2.2 Decision Support System (`college-decision-system-backend/`)
*   `college-decision-system-backend/` $\rightarrow$ **`PRODUCTION_MICROSERVICE`**
    *   *Reasoning:* Contains the FastAPI application, uvicorn startup configurations, alembic databases, SQLite DB, and testing suites. Must remain isolated as an independent production container.

### 2.3 Traditional RAG System (`aast-ai-agent-main/backend/rag_system/`)
*   `rag_system/phase3_retriever.py` $\rightarrow$ **`PRODUCTION_RAG`**
    *   *Reasoning:* The active FastAPI server running Python-based similarity searches on Qdrant.
*   `rag_system/phase4_llm_answer_engine.py` $\rightarrow$ **`PRODUCTION_RAG`**
    *   *Reasoning:* Production-critical Python script synthesizing vector-grounded text.

### 2.4 Frontend Dashboard (`aast-ai-agent-main/frontend/`)
*   `frontend/` $\rightarrow$ **`PRODUCTION`**
    *   *Reasoning:* The main React client SPA interface.

### 2.5 Data & Documentation
*   `data/` $\rightarrow$ **`DATA`**
    *   *Reasoning:* Contains static college datasets, scrapers, and offline Neo4j relationship outputs.
*   `docs/` $\rightarrow$ **`DOCUMENTATION`**
    *   *Reasoning:* Houses system documentation files.
*   `archive/` $\rightarrow$ **`ARCHIVE`**
    *   *Reasoning:* Storage for deactivated experimental multimodal pipelines.

### 2.6 Duplicates and Research Files
*   `graphrag/research/embed_server_rag.py` $\rightarrow$ **`RESEARCH` / `SUPPORTING`**
    *   *Reasoning:* Offline utility script for generating node embeddings and checking semantic similarities.
*   `graphrag/research/ner_service.py` $\rightarrow$ **`RESEARCH` / `SUPPORTING`**
    *   *Reasoning:* Offline Entity Recognition (NER) testing utility.
*   `aast-ai-agent-main/frontend/aast-ai-agent-main/` $\rightarrow$ **`REVIEW_REQUIRED`**
    *   *Reasoning:* Duplicate backup copy of the repository nested inside the frontend folder.
*   `aast-ai-agent-main/frontend/college-decision-system-backend/` $\rightarrow$ **`REVIEW_REQUIRED`**
    *   *Reasoning:* Duplicate backup copy of the FastAPI DSS microservice nested inside the frontend folder.
