# Implementation Evidence Report
**AAST AI Agent — Code Implementation Proof**

This report lists the exact source file paths and code definitions proving the active implementation of the platform's core subsystems.

---

## 1. Subsystem Implementation Proofs

### 1.1 React Frontend
*   **Proof Path:** `aast-ai-agent-main/frontend/package.json` & `aast-ai-agent-main/frontend/src/App.tsx`
*   **Code Evidence:** imports React router links and exposes advising pages dashboard components.

### 1.2 Express Orchestrator Backend
*   **Proof Path:** `aast-ai-agent-main/backend/orchestrator.js`
*   **Code Evidence:** Binds Express server on Port 8004 and initializes chatbot routes.

### 1.3 GraphRAG (Neo4j Connection)
*   **Proof Path:** `aast-ai-agent-main/backend/db/neo4j.js`
*   **Code Evidence:** Imports `neo4j-driver`, configures a shared driver session, and exports `connectNeo4j()` and `getSession()`.

### 1.4 Traditional Vector RAG
*   **Proof Path:** `aast-ai-agent-main/backend/rag_system/phase3_retriever.py`
*   **Code Evidence:** Exposes FastAPI router endpoint running `qdrant_client.query()` searches.

### 1.5 Decision Support System (DSS)
*   **Proof Path:** `college-decision-system-backend/app/main.py`
*   **Code Evidence:** Exposes FastAPI router endpoints for tuition calculators and admissions rules.

### 1.6 LLM Integration Layer
*   **Proof Path:** `aast-ai-agent-main/backend/services/geminiService.js` & `ollamaService.js`
*   **Code Evidence:** Imports Google Generative AI libraries and maps Ollama endpoint API requests.

### 1.7 Context Fusion Layer
*   **Proof Path:** `aast-ai-agent-main/backend/services/fusionService.js`
*   **Code Evidence:** Defines context assembly functions structure mapping graphs, vectors, and DSS inputs.

### 1.8 Intent Routing Layer
*   **Proof Path:** `aast-ai-agent-main/backend/services/brainRouter.js`
*   **Code Evidence:** Defines intent categories (GraphRAG, Vector RAG, DSS, Casual) and performs keyword classification checks.

### 1.9 Monitoring & Logging Layer
*   **Proof Path:** `aast-ai-agent-main/backend/services/logger.js` & `services/metrics.js`
*   **Code Evidence:** Configures Winston logging transports and Prometheus telemetry client libraries.
