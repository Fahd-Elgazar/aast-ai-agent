# Production System Map: AAST Academic AI Agent

This document maps out the verified active production subsystems, services, databases, and configuration of the AAST Academic AI Agent platform. All details are traced directly from the runtime launcher (`launcher/start_platform.ps1`) and orchestrator imports (`orchestrator.js`).

---

## 1. Core Codebase Directory Structure

*   **Production Main Application**: `aast-ai-agent-main/`
    *   **Frontend Root**: `aast-ai-agent-main/frontend/`
        *   React/Vite TypeScript Application
    *   **Backend Root**: `aast-ai-agent-main/backend/`
        *   Express.js Orchestrator & Services
    *   **RAG Engine Root**: `aast-ai-agent-main/backend/rag_system/`
        *   FastAPI Retriever & LLM Answer Services
*   **Production Subsystem (DSS)**: `college-decision-system-backend/`
    *   FastAPI Decision Support Microservice (AI Recommendation Engine)

---

## 2. Active Services

| Service Name | Port | Directory Path | Command / Startup | Role |
| :--- | :--- | :--- | :--- | :--- |
| **Node.js Orchestrator** | `8004` | `aast-ai-agent-main/backend` | `npm run start:orchestrator` | Central router, coordinates RAG, GraphRAG, DSS, Ollama, and Gemini. |
| **Frontend UI** | `5173` | `aast-ai-agent-main/frontend` | `npm run dev:lowmem` | React/Vite web interface. |
| **Decision Support System (DSS)** | `8005` | `college-decision-system-backend` | `python -m uvicorn app.main:app` | FastAPI service evaluating grades, tracks, budgets, and career matches. |
| **RAG Retriever** | `8001` | `aast-ai-agent-main/backend/rag_system` | `python -m uvicorn phase3_retriever:app` | FastAPI service querying Qdrant vector store using lazy `BAAI/bge-m3`. |
| **RAG Answer Engine** | `8002` | `aast-ai-agent-main/backend/rag_system` | `python -m uvicorn phase4_llm_answer_engine:app` | FastAPI service synthesizing LLM answers using local Ollama model context. |

---

## 3. Active Databases & Vector Stores

*   **Neo4j Graph Database**:
    *   **Connection protocol**: Bolt (`bolt://localhost:7687`)
    *   **Role**: Stores academic structure (courses, departments, professors, requirements, prerequisites). Connected via `db/neo4j.js` and queried using Cypher.
    *   **Initialization**: Configured as a safe process-wide singleton inside `orchestrator.js`.
*   **Qdrant Vector Database**:
    *   **Connection protocol**: HTTP REST (`http://127.0.0.1:6333`)
    *   **Role**: Stores chunked academic rules, policy documents, and registry guidelines. Querying is managed by the `RAG Retriever` service.
    *   **Deployment**: Runs in Docker container `qdrant_prod`.
*   **Local JSON File System Store**:
    *   **Session Persistence**: Conversation histories and memories are written to disk using `persistenceLayer.js` debounced saves (saving to `data/conversations.json` and `decision_memory.json`).

---

## 4. Active RAG & GraphRAG Components

*   **RAG Retrieval Layer**:
    *   `ragService.js` (Backend): Connects to RAG Retriever (`http://127.0.0.1:8001`) and RAG Answer Engine (`http://127.0.0.1:8002`).
    *   `phase3_retriever.py` (RAG System): Performs hybrid search using BAAI/bge-m3 embeddings and queries Qdrant DB.
*   **GraphRAG Layer**:
    *   `neo4jcontext.js` (Backend): Queries Neo4j database using parameterized Cypher queries to extract graph-based context.
    *   `fusionService.js` (Backend): Merges retrieved context from GraphRAG (Neo4j) and VectorRAG (Qdrant) into a single prompt for LLM consumption.
    *   `brainRouter.js` (Backend): Decides whether to route the incoming query to KG (Graph), RAG (Vector), FAQ, DSS, or Light Conversational logic.

---

## 5. Active AI & LLM Components

*   **Ollama (Local LLM Runtime)**:
    *   **Connection Port**: `http://localhost:11434`
    *   **Primary Model**: `gemma4:e2b` or similar (configured via `PRIMARY_MODEL` env variable).
    *   **Service Wrapper**: `ollamaService.js` manages request queueing, telemetry, and failovers.
*   **Gemini API (Cloud LLM)**:
    *   **Service Wrapper**: `geminiService.js` validates environment credentials and provides fallback capabilities if Ollama/local-gemma fails.
*   **Model Failover Manager**:
    *   `modelFailoverManager.js` routes requests dynamically to backup local models or cloud Gemini APIs if the primary local engine fails or is overloaded.

---

## 6. Startup Scripts

*   `start_full_project.bat` (Root): Launches system in "full" mode by calling `starter.bat`.
*   `starter.bat` (Root): Command line parser forwarding options and modes (`demo`, `full`, `quick`) to PowerShell launcher.
*   `launcher/start_platform.ps1` (Launcher): The main preflight, orchestrator, and health probe controller. It sets up environment variables, launches Qdrant (docker), Ollama, RAG retriever/answer services, FastAPI DSS, Orchestrator backend, and Vite frontend, then performs a golden check query to validate readiness.
