# Production System Map
**AAST AI Agent — System Infrastructure and Run-time Map**

This document describes the active services, execution environments, database connections, port maps, and startup scripts forming the production infrastructure of the AAST Academic AI Agent.

---

## 1. Active Services & Runtime Environments

The AAST AI Agent platform runs as a distributed system across several independent run-time modules:

1.  **Node.js Express Orchestrator Backend:**
    *   *Role:* The centralized API orchestrator. It handles intent classification, conversation management, query rewriting, context fusion, LLM failovers, and client interaction.
    *   *Path:* `aast-ai-agent-main/backend/`
    *   *Runtime:* Node.js (v18+)
2.  **React Frontend:**
    *   *Role:* Single-Page Application (SPA) dashboard containing chat interfaces, graph visualization components, and admissions advisors.
    *   *Path:* `aast-ai-agent-main/frontend/`
    *   *Runtime:* Web Browser (built via Vite / TypeScript)
3.  **FastAPI Decision Support System (DSS):**
    *   *Role:* Independent microservice calculating tuition fees, tracking matching credits, verifying admission rules, and running student profile recommendations.
    *   *Path:* `college-decision-system-backend/`
    *   *Runtime:* Python 3.10+ (Uvicorn)
4.  **Traditional Python RAG Retriever:**
    *   *Role:* Extracts CAI policy chunks from vector embeddings.
    *   *Path:* `aast-ai-agent-main/backend/rag_system/` (executes `phase3_retriever.py`)
    *   *Runtime:* Python 3.10+ (FastAPI)
5.  **Traditional Python RAG LLM Answer Engine:**
    *   *Role:* Synthesizes vector-grounded answers before Node.js post-processing.
    *   *Path:* `aast-ai-agent-main/backend/rag_system/` (executes `phase4_llm_answer_engine.py`)
    *   *Runtime:* Python 3.10+
6.  **Ollama Instance:**
    *   *Role:* Provides local offline LLM endpoints (Gemma/Llama) acting as failsafe backup models when cloud APIs fail.
    *   *Runtime:* Ollama Daemon

---

## 2. Active Databases

1.  **Neo4j Graph Database:**
    *   *Purpose:* Stores entity nodes (colleges, courses, tracks, departments) and their relations to ground GraphRAG operations.
    *   *Connection Protocol:* Bolt (`bolt://localhost:7687`)
2.  **Qdrant Vector Database:**
    *   *Purpose:* Stores vector embeddings representing cai policies for semantic retrieval.
    *   *Connection Protocol:* REST / gRPC (`http://localhost:6333`)
3.  **DSS SQLite Database (`dev.db`):**
    *   *Purpose:* Handles persistent relational state, program fees, admission rules, and student profiles for the FastAPI DSS microservice.
    *   *File Location:* `college-decision-system-backend/dev.db`

---

## 3. Network Port Allocations

| Service | Port | Protocol | Binding | Purpose |
| :--- | :--- | :---: | :--- | :--- |
| **Express Orchestrator** | `8004` | HTTP | `0.0.0.0` | Central gateway API |
| **FastAPI DSS** | `8005` | HTTP | `127.0.0.1` | Decision support engine |
| **Python RAG Retriever** | `8001` | HTTP | `127.0.0.1` | Vector similarity API |
| **Python RAG Answer** | `8002` | HTTP | `127.0.0.1` | Traditional RAG synthesis |
| **Qdrant Vector DB** | `6333` | HTTP | `127.0.0.1` | Vector database REST API |
| **Qdrant Vector DB** | `6334` | gRPC | `127.0.0.1` | Vector database gRPC channel |
| **Neo4j DB Bolt** | `7687` | Bolt | `0.0.0.0` | Graph database queries |
| **Neo4j DB Browser** | `7474` | HTTP | `0.0.0.0` | Neo4j administration UI |
| **Ollama API** | `11434` | HTTP | `127.0.0.1` | Offline LLM hosting |
| **React Frontend** | `5173` | HTTP | `0.0.0.0` | Client UI (development mode) |

---

## 4. Active Startup Scripts

*   `c:\Users\mh978\Downloads\AI_AGENT\start_full_project.bat` $\rightarrow$ Fires up the databases, RAG retrievers, Express backend, and FastAPI DSS in sequence.
*   `c:\Users\mh978\Downloads\AI_AGENT\starter.bat` $\rightarrow$ Alternate local startup sequence wrapper.
*   `c:\Users\mh978\Downloads\AI_AGENT\launcher\start_platform.ps1` $\rightarrow$ Central PowerShell coordinator starting PM2 runtimes and database health checks.
*   `c:\Users\mh978\Downloads\AI_AGENT\launcher\stop_platform.ps1` $\rightarrow$ PM2 process shutdown script.
