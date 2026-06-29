# Validation Matrix: Reorganization Testing Guidelines

This document maps out the validation checks and test commands that must be run after the completion of each migration batch to ensure system stability and zero regressions.

---

## 1. Local Package Verification Steps

The following standard package checks must be run in the `aast-ai-agent-main/backend/` and `aast-ai-agent-main/frontend/` directories:

| Step | Command | Directory | Purpose |
| :--- | :--- | :--- | :--- |
| **1. Install Check** | `npm install` | Backend & Frontend | Validates package locks and dependencies. |
| **2. Build Check** | `npm run build` | Frontend | Verifies TypeScript build compilation. |
| **3. Lint Check** | `npm run lint` | Backend & Frontend | Catches static syntax issues and pathing warnings. |
| **4. Test Check** | `npm run test:routing` | Backend | Runs the routing calibration tests. |
| **5. E2E Check** | `node tests/e2e_test.js` | Backend | Validates end-to-end connectivity. |

---

## 2. Active Services Startup Checks

To ensure services boot correctly, run the launcher diagnostics mode command:
```powershell
.\starter.bat demo --diagnostics
```

Ensure the following processes bind successfully:
*   **Vite Frontend UI**: Port `5173` (test via HTTP GET `http://127.0.0.1:5173`)
*   **Express Orchestrator**: Port `8004` (test via HTTP GET `http://127.0.0.1:8004/health`)
*   **FastAPI DSS**: Port `8005` (test via HTTP GET `http://127.0.0.1:8005/health`)
*   **FastAPI RAG Retriever**: Port `8001` (test via HTTP GET `http://127.0.0.1:8001/health`)

---

## 3. Subsystem Integration & Connectivity Checks

After starting the platform, execute these checks to verify internal integrations:

### 3.1 Neo4j Graph DB Connectivity
Verify that the orchestrator is connected to Neo4j Bolt port 7687:
*   **Endpoint Probe**: GET `http://127.0.0.1:8004/health`
*   **Expected JSON output**:
    `services.neo4j.ok === true`

### 3.2 Ollama Local LLM Connectivity
Verify that Ollama responds and has the primary model loaded:
*   **Endpoint Probe**: GET `http://127.0.0.1:11434/api/tags`
*   **Expected JSON output**:
    Contains the model name matching `PRIMARY_MODEL` (e.g. `gemma4:e2b`).

### 3.3 Google Gemini API Connectivity
Verify that the fallback environment key is verified:
*   Check the console logs of the orchestrator for:
    `[Gemini] Environment verified successfully.`

### 3.4 VectorRAG Retrieval Checks
Probe the RAG retriever with a test payload:
*   **Command**:
    ```bash
    curl -X POST http://127.0.0.1:8001/search -H "Content-Type: application/json" -d "{\"query\": \"admission requirements\", \"top_k\": 1}"
    ```
*   **Expected Response**: Returns a list of matched document chunks from Qdrant.

### 3.5 GraphRAG Retrieval Checks
Validate that the brain router correctly fetches graph context from Neo4j:
*   **Command**: Run the golden check benchmark:
    ```bash
    npm run benchmark:golden
    ```
*   **Expected Response**: The routing analysis shows `KG` as the selected route.

### 3.6 DSS Recommendation Endpoint Validation
Verify that the FastAPI microservice successfully runs score-matching against SQLite `dev.db`:
*   **Command**:
    ```bash
    curl -X POST http://127.0.0.1:8005/api/v1/decisions/recommend -H "Content-Type: application/json" -H "X-Internal-Secret: your-secret-key-here" -d "{\"student_profile\": {\"certificate_type\": \"thanawya_amma_math\", \"high_school_percentage\": 85, \"budget\": 40000, \"track_type\": \"scientific\"}, \"preferences\": {\"interests\": [\"coding\"]}}"
    ```
*   **Expected Response**: Returns a JSON recommendation listing matching majors and a confidence score.
