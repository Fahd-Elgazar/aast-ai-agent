# External Dependency Report: AAST Academic AI Agent

This document details the external services, databases, vector stores, cloud APIs, and environment variables relied on by the platform, listing the exact files and modules that depend on them.

---

## 1. External Services and Databases

| Dependency Name | Connection Details | Dependent Modules | Purpose |
| :--- | :--- | :--- | :--- |
| **Neo4j Graph Database** | Bolt protocol (`bolt://localhost:7687`) | `db/neo4j.js`<br>`services/neo4jcontext.js`<br>`services/demoGraphService.js`<br>`fix_db.js`<br>`embed_nodes.py`<br>`ner_service.py` | Holds structured knowledge graphs of academic rules, course codes, prerequisites, and faculty data. |
| **Qdrant Vector DB** | HTTP REST (`http://localhost:6333`) | `rag_system/phase3_retriever.py` | Vector store containing embedded academic policy document chunks for retrieval. |
| **Ollama Local LLM** | HTTP API (`http://localhost:11434`) | `services/ollamaService.js`<br>`services/gemmaWarmService.js`<br>`services/gemmaTelemetryService.js`<br>`services/unifiedAnswerService.js`<br>`services/decisionService.js`<br>`embed_nodes.py` | Runs the local primary model (`gemma4:e2b` or similar) and embeddings model (`nomic-embed-text`) locally. |
| **Google Gemini API** | HTTPS REST (`generativelanguage.googleapis.com`) | `services/geminiService.js`<br>`services/modelFailoverManager.js` | Cloud LLM provider serving as the high-availability backup option if Ollama fails. |
| **FastAPI DSS Subsystem**| HTTP API (`http://localhost:8005`) | `services/decisionService.js`<br>`routes/decision.js` | Evaluates grade thresholds, budget bounds, and tracks from SQLite database. |
| **MongoDB** | MongoDB Protocol (`mongodb://127.0.0.1:27017/authDB`) | `index.js` (Legacy)<br>`routes/auth.js` (Legacy)<br>`models/User.js` (Legacy) | Relied on by legacy authentication servers. **Not active** in `orchestrator.js` runtime. |
| **MySQL / MeiliSearch** | SQL / HTTP | `db/mysql.js` (Legacy)<br>`db/meili.js` (Legacy) | Legacy storage. **Not active** in `orchestrator.js` runtime. |

---

## 2. Key Environment Variables & Code Dependencies

| Env Variable Name | Default / Example Value | Dependent Files | Purpose |
| :--- | :--- | :--- | :--- |
| `INTERNAL_SECRET_KEY` | `[REQUIRED]` | `orchestrator.js`<br>`services/decisionService.js` | Secures inter-service communications between orchestrator and FastAPI DSS. |
| `NEO4J_URI` / `USER` / `PASSWORD` | `bolt://127.0.0.1:7687` | `db/neo4j.js`<br>`embed_nodes.py`<br>`ner_service.py` | Credentials for the Neo4j instance. |
| `NEO4J_DATABASE` | `neo4j` | `db/neo4j.js`<br>`services/neo4jcontext.js` | Selects which Neo4j database to query. |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | `services/ollamaService.js`<br>`launcher/start_platform.ps1` | URL for Ollama local service API. |
| `PRIMARY_MODEL` | `gemma4:e2b` | `services/ollamaService.js` | Model name loaded in Ollama. |
| `GEMINI_API_KEY` | `[REQUIRED_FOR_FAILOVER]` | `services/geminiService.js` | Secret key for cloud Google Gemini APIs. |
| `DECISION_API_URL` | `http://127.0.0.1:8005` | `services/decisionService.js`<br>`routes/health.js` | Port endpoint for the FastAPI decision microservice. |
| `RAG_BASE_URL` / `RAG_RETRIEVER_URL`| `http://127.0.0.1:8001` | `services/ragService.js`<br>`routes/health.js` | Port endpoint for the FastAPI retriever microservice. |
| `RAG_ANSWER_URL` | `http://127.0.0.1:8002` | `services/ragService.js`<br>`routes/health.js` | Port endpoint for the FastAPI answer engine. |
| `JWT_SECRET` | `secret` | `routes/auth.js` (Legacy) | Secret token key for signing user sessions. |
| `RAG_CB_FAILURE_THRESHOLD` | `5` | `launcher/start_platform.ps1` | Circuit breaker failure limits. |
| `RAG_CB_COOLDOWN_MS` | `15000` | `launcher/start_platform.ps1` | Circuit breaker cooldown timers. |
