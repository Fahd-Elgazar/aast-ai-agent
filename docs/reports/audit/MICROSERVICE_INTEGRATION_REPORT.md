# Microservice Integration Report: AAST Academic AI Agent

This report details the integration mechanism, endpoints, and runtime properties of the FastAPI Decision Support System (DSS) microservice within the Academic AI Agent Platform.

---

## 1. Subsystem Integration Overview

The FastAPI DSS (`college-decision-system-backend`) operates as an independent, decoupled microservice. It is designed to run in its own container or process space, separating the heavy decision logic, database validations, and voice processing from the main async Node.js orchestrator loop.

```
+------------------+                   +--------------------+                   +--------------------+
|  Vite Frontend   |                   |  Node Orchestrator |                   |    FastAPI DSS     |
+--------+---------+                   +---------+----------+                   +---------+----------+
         |                                       |                                        |
         |  POST /api/decision/recommend         |                                        |
         |-------------------------------------->|                                        |
         |                                       |  Normalize & Validate Inputs           |
         |                                       |-----------------------------           |
         |                                       |                             |          |
         |                                       |<----------------------------           |
         |                                       |                                        |
         |                                       |  POST /api/v1/decisions/recommend      |
         |                                       |  (X-Internal-Secret Header)            |
         |                                       |--------------------------------------->|
         |                                       |                                        |  Query dev.db (SQLite)
         |                                       |                                        |  Evaluate Major Match
         |                                       |                                        |-----------------------
         |                                       |                                        |                       |
         |                                       |                                        |<----------------------
         |                                       |                                        |
         |                                       |  JSON Response                         |
         |                                       |<---------------------------------------|
         |                                       |                                        |
         |                                       |  Inject Career Roadmap & Save Memory   |
         |                                       |-------------------------------------   |
         |                                       |                                     |  |
         |                                       |<------------------------------------   |
         |  JSON Response (Unified Recommendations)                                       |
         |<--------------------------------------|                                        |
```

---

## 2. API Communication Specification

### 2.1 Communication Protocol
*   **Mechanism**: Synchronous HTTP/1.1 REST over TCP.
*   **Data format**: `application/json` (UTF-8).
*   **Security Header**: `X-Internal-Secret: [INTERNAL_SECRET_KEY]` verified by FastAPI middleware.
*   **Service Endpoint**: `/api/v1/decisions/recommend` on Port `8005`.

### 2.2 Integration Endpoints

| Method | Path | Caller | Purpose |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/v1/decisions/recommend` | `decisionService.js` | Evaluates grades/track/budget and returns major suggestions. |
| **GET** | `/health` | `healthProbes.js` | Checks microservice availability and voice subsystem load. |
| **GET** | `/api/v1/students` | Main UI / Admin (Direct) | Retrieves student list (admin panel functionality). |
| **POST** | `/api/v1/voice/process` | Main UI / Audio (Direct) | Process voice inputs and translate speech to text. |

---

## 3. Runtime Dependencies & SQLite Database

*   **Database**: SQLite (`dev.db` located inside `college-decision-system-backend/dev.db`). Holds structured tables mapping academic requirements, fees, and program codes.
*   **Libraries**:
    *   `fastapi` & `uvicorn` (Web API hosting)
    *   `pydantic` & `pydantic-settings` (Config validation)
    *   `sqlalchemy` (ORM querying of SQLite)
    *   `alembic` (DB schema migrations)
*   **Optional Engine (Whisper)**: If `VOICE_ENABLED` is true, the system loads local torch-based audio transcription libraries.

---

## 4. Resilience and Failure Analysis

### 4.1 Can the main backend operate without the DSS?
**Yes.** The central Node.js orchestrator is designed to tolerate offline microservices.
If the FastAPI decision engine is offline or times out:
1.  The orchestrator does **not** crash.
2.  The `getRecommendation` function catches the HTTP error or abort timeout signal.
3.  It returns a clean fallback payload:
    `{ success: false, is_fallback: true, message: "Decision system unavailable" }`
4.  The chatbot UI displays a friendly message asking the user to try again later or consult an advisor directly.

### 4.2 Circuit Breaker & Health Probing
The Node.js backend implements an active circuit breaker via `circuitStateManager.js`. If requests to port 8005 fail consecutively above the threshold, the circuit flips to **OPEN**, short-circuiting calls to DSS and immediately serving fallback answers to preserve CPU/network threads.

---

## 5. System Service Classification

We classify all platform services into four layers:

### 5.1 Core Backend Services
*   `orchestrator.js` (Express Router & Context compiler)
*   `brainRouter.js` (Semantic routing engine)
*   `academicQueryNormalizer.js` (Lexical normalizer)

### 5.2 Microservices
*   `FastAPI DSS` (Recommendation scoring)
*   `FastAPI RAG Retriever` (Vector querying)
*   `FastAPI RAG Answer Engine` (Context synthesis)

### 5.3 External Services
*   `Ollama` (Local model server hosting `gemma4:e2b` and `nomic-embed-text`)
*   `Google Gemini API` (Cloud LLM fallback)
*   `Neo4j Desktop Database` (Bolt driver node storage)
*   `Qdrant Vector Database` (Docker instance storing policy embeddings)

### 5.4 Infrastructure Services
*   `circuitStateManager.js` (Circuit breaker state machines)
*   `persistenceLayer.js` (Debounced JSON file writes)
*   `logger.js` (Winston logger daemon)
*   `healthMonitor.js` / `healthProbes.js` (Active monitor daemon)
*   `metrics.js` (Subsystem telemetry counters)
