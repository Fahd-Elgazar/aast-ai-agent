# Entrypoint Analysis
**AAST AI Agent — Runtime Request Lifecycle and Execution Trace**

This document traces the complete end-to-end execution path of user queries, starting from the client browser interface down to the backend routing, databases, external services, and context-fusing LLM layers.

---

## 1. Complete Request-Response Lifecycle Trace

```text
User Request
  │
  ▼
[1] Frontend (React UI)
  │   - Captures user text or audio stream
  │   - Dispatches POST request to `/api/chatbot/chat`
  ▼
[2] Express Orchestrator Backend (`orchestrator.js`)
  │   - Initializes or loads conversation state (via `conversationService.js`)
  │   - Normalizes text via `academicQueryNormalizer.js`
  │   - Scans against `config/goldenPathRegistry.js` for instant matches
  ▼
[3] Brain Router (`services/brainRouter.js`)
  │   - Detects intent using heuristic checks and routing rules
  │   - Routes to the appropriate processing pipeline (Vector RAG, GraphRAG, DSS, or Casual)
  │
  ├─► [4a] GraphRAG Path
  │     - Queries Neo4j database (Port 7687) using `db/neo4j.js`
  │     - Resolves structural relationships (departments, majors) via `services/neo4jcontext.js`
  │
  ├─► [4b] Traditional Python RAG Path
  │     - Node `ragService.js` makes HTTP POST to Python Retriever (Port 8001)
  │     - Python retriever queries Qdrant Vector DB (Port 6333) for semantic matching policy blocks
  │
  └─► [4c] DSS Path
        - Node `decisionService.js` calls FastAPI DSS microservice (Port 8005)
        - FastAPI queries SQLite database (`dev.db`) for fees, tracks, and distance metrics
        - Performs numeric normalization, tuition calculation, and returns JSON structure
  │
  ▼
[5] Context Fusion (`services/fusionService.js`)
  │   - Fuses Neo4j context, Qdrant vectors, and DSS recommendations into an augmented prompt
  ▼
[6] LLM Synthesis Gateway (`services/geminiService.js` / `services/ollamaService.js`)
  │   - Calls Google Gemini API (Primary model)
  │   - If rate limits/failures occur, `modelFailoverManager.js` shifts load to local Ollama (Gemma/Llama)
  ▼
[7] Post-Processing & Output Formatter (`services/responseFormatter.js` / `conversationalHumanizer.js`)
  │   - Reformats Markdown structures and sanitizes text
  │   - Adapts responses to casual Egyptian student tone (if humanize mode triggered)
  ▼
Frontend Client (Receives finalized answer, updates chat dashboard)
```

---

## 2. Component Role Descriptions

### 2.1 React Frontend
*   **Location:** `aast-ai-agent-main/frontend/src/`
*   **Key Entrypoints:**
    *   `src/components/pages/AdvisorPage.tsx` (Advising chatbot interface)
    *   `src/components/GraphVisualizer.tsx` (Interactive Neo4j relation graph)
    *   `src/services/backendService.ts` (API connector using Axios)

### 2.2 Express Orchestrator
*   **Location:** `aast-ai-agent-main/backend/orchestrator.js`
*   **Endpoints exposed:**
    *   `POST /api/chatbot/chat` $\rightarrow$ Routes to primary chatbot engine
    *   `POST /api/decision/recommend` $\rightarrow$ Connects to DSS endpoints
    *   `GET /api/health/check` $\rightarrow$ Evaluates sub-system connectivity

### 2.3 Brain Router
*   **Location:** `aast-ai-agent-main/backend/services/brainRouter.js`
*   **Logic:** Determines query paths based on rule-matching. If a user asks for "tuition fees" or "admission criteria", the request is routed to DSS. If the user asks for "prerequisites" or "faculty staff relations", the request is routed to GraphRAG. If the query concerns general policy, it is routed to Python RAG.

### 2.4 GraphRAG
*   **Location:** `aast-ai-agent-main/backend/services/neo4jcontext.js`
*   **Logic:** Queries Neo4j using Cypher statements to extract relationships between faculties, departments, and course tracks, translating Graph tables into structured conversational context.

### 2.5 Traditional Python RAG
*   **Location:** `aast-ai-agent-main/backend/rag_system/`
*   **Entrypoints:**
    *   `phase3_retriever.py` (Exposes FastAPI vector search endpoints)
    *   `phase4_llm_answer_engine.py` (Local Python text generator wrapper)

### 2.6 Decision Support System (DSS)
*   **Location:** `college-decision-system-backend/app/main.py`
*   **Entrypoints:**
    *   `app/api/v1/routers/decisions.py` (Processes recommendations)
    *   `app/api/v1/routers/voice.py` (Handles incoming voice transcription requests)
