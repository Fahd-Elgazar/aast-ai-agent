# Master Conflict Audit
**AAST AI Agent — Consolidated Document Consistency Audit**

This audit report cross-references all generated documentation files against the authoritative baselines to identify and resolve contradictions regarding ports, databases, entrypoints, and runtime flows.

---

## 1. Discovered Contradictions and Conflicts

### 1.1 Port Conflicts
*   **Conflict:** Older files (`docs/reports/audit/PRODUCTION_SYSTEM_MAP.md`) list ports 5000 (SQL mode), 5001 (Neo4j mode), and 5002 (MeiliSearch mode). Newer files standardise on Port 8004 (Express Orchestrator), Port 8001 (RAG Retriever), Port 8002 (RAG Answer), and Port 8005 (FastAPI DSS).
*   **Authoritative Resolution:** Port 8004 is the single authoritative port for the Express Orchestrator backend gateway. Ports 5000–5002 represent historical monolithic settings and must not be used.

### 1.2 Database Active Classifications
*   **Conflict:** `docs/architecture/VERIFIED_SYSTEM_MAP.md` lists MySQL and MongoDB as active production databases. Later audits (`FILE_CLASSIFICATION_REPORT.md` and `SYSTEM_CONTEXT_MAP_V2.md`) classify them as legacied MVP adapters.
*   **Authoritative Resolution:** SQLite (`dev.db` inside DSS) and Neo4j (GraphRAG) are the active databases. MongoDB and MySQL are legacy adapters bypassed by the production runtime.

### 1.3 Active Server Entrypoint
*   **Conflict:** Early readmes (`aast-ai-agent-main/backend/README.md`) reference `index.js` as the server startup file. Production files (`orchestrator.js` and Docker files) use `orchestrator.js` as the sole startup file.
*   **Authoritative Resolution:** `orchestrator.js` is the active production gateway. `index.js` is legacied.

### 1.4 Qdrant Connection Path
*   **Conflict:** Early diagrams list Qdrant as a direct database connection for the Express orchestrator. `SYSTEM_CONTEXT_MAP_V2.md` clarifies that Qdrant is connected indirectly via the Python retriever microservice on Port 8001.
*   **Authoritative Resolution:** Document the indirect connection flow. Node.js backend has zero direct database imports from Qdrant libraries.

---

## 2. Validation Status
**PASS**. All conflicts have been identified and resolved through the authoritative resolution rules defined above.
