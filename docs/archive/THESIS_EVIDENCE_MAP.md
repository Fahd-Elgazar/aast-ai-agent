# Thesis Evidence Map
**AAST AI Agent — Traceable Evidence Matrix**

This report maps the core thesis claims to their exact source code, configuration, and documentation evidence.

---

## 1. Traceable Evidence Matrix

| Claim Name | Evidence Type | File Path | Description | Confidence |
| :--- | :--- | :--- | :--- | :---: |
| **Claim 1: GraphRAG** | Code | `aast-ai-agent-main/backend/services/neo4jcontext.js` | Retrieves neighborhood relational context maps from Neo4j. | **High** |
| **Claim 2: Neo4j** | Configuration | `aast-ai-agent-main/backend/db/neo4j.js` | Configures Bolt driver with host url, port, and credentials. | **High** |
| **Claim 3: Traditional RAG** | Code | `aast-ai-agent-main/backend/services/ragService.js` | Dispatches POST requests to the Python retriever API on Port 8001. | **High** |
| **Claim 4: Qdrant** | Code | `aast-ai-agent-main/backend/rag_system/phase3_retriever.py` | Imports `qdrant_client` and maps queries against vector indexes. | **High** |
| **Claim 5: Context Fusion** | Code | `aast-ai-agent-main/backend/services/fusionService.js` | Consolidates Neo4j nodes, Qdrant vectors, and DSS inputs into a prompt. | **High** |
| **Claim 6: Intent Router** | Code | `aast-ai-agent-main/backend/services/brainRouter.js` | Performs keyword weight classifications to route queries. | **High** |
| **Claim 7: DSS Microservice**| Code | `college-decision-system-backend/app/main.py` | Defines FastAPI routers for tuition calculations and admissions rules. | **High** |
| **Claim 8: Explainable AI** | Diagram/Code | `aast-ai-agent-main/frontend/src/components/GraphVisualizer.tsx` | D3 canvas drawing relational course maps. | **High** |
| **Claim 9: Circuit Breaker** | Code | `aast-ai-agent-main/backend/services/circuitStateManager.js` | Implements state machines tracking request failure rates. | **High** |
| **Claim 10: Model Failover**| Code | `aast-ai-agent-main/backend/services/modelFailoverManager.js` | Intercepts Gemini timeouts and routes requests to `ollamaService.js`. | **High** |
| **Claim 11: Decoupling** | Configuration | Root `docker-compose.yml` | Maps isolated containers and network ports. | **High** |
| **Claim 12: React Client** | Code | `aast-ai-agent-main/frontend/src/App.tsx` | Routes client advisor page dashboards. | **High** |
| **Claim 13: FastAPI** | Configuration | `college-decision-system-backend/requirements.txt` | Lists `fastapi` and `uvicorn` as core packages. | **High** |
| **Claim 14: Benchmarking** | Code/Report | `aast-ai-agent-main/backend/testing/benchmark_summary.md` | Logs Golden Queries routing and fallback test statistics. | **High** |
