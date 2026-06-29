# Book Conflict Report
**AAST AI Agent — Documentation Contradictions and Conflicts Audit**

This report analyzes contradictory statements regarding architecture, runtime ports, database active classifications, and components discovered across different documents in the repository.

---

## 1. Discovered Conflicts

### 1.1 Conflict 1: MySQL Database Classification
*   **File A:** `docs/architecture/VERIFIED_SYSTEM_MAP.md`
    *   *Claim:* "MySQL Database: Stores user credentials and student profiling indexes in production."
*   **File B:** `docs/reports/audit/FILE_CLASSIFICATION_REPORT.md` & `SYSTEM_CONTEXT_MAP_V2.md`
    *   *Claim:* MySQL is classified as `LEGACY`/`DEPRECATED`. The orchestrator uses local JSON files and SQLite, with zero imports from `db/mysql.js`.
*   **Conflict Description:** File A lists MySQL as a core production database, while File B confirms it is legacy, bypassed, and unused by the runtime orchestrator.
*   **Severity:** **Medium**
*   **Confidence:** **High** (Verified code imports confirm MySQL is legacy and bypassed).

### 1.2 Conflict 2: Active Backend Entrypoint
*   **File A:** `aast-ai-agent-main/backend/README.md`
    *   *Claim:* Shows `index.js` as the main server startup file (run with modes: `node index.js neo`, etc.).
*   **File B:** `docs/architecture/VERIFIED_SYSTEM_MAP.md` & `orchestrator.js`
    *   *Claim:* `orchestrator.js` is the main entry point running on Port 8004.
*   **Conflict Description:** Discrepancy regarding which JS module is the active backend API gateway launcher.
*   **Severity:** **High**
*   **Confidence:** **High** (Dockerfiles and pm2 files run `orchestrator.js`).

### 1.3 Conflict 3: Active Backend Ports
*   **File A:** `docs/reports/audit/PRODUCTION_SYSTEM_MAP.md`
    *   *Claim:* Lists Port `5000` (SQL mode), Port `5001` (Neo4j mode), and Port `5002` (MeiliSearch mode) as the active Express ports.
*   **File B:** `PRODUCTION_SYSTEM_MAP.md` (root version)
    *   *Claim:* Lists Port `8004` (Express Orchestrator), Port `8001` (RAG Retriever), Port `8002` (RAG Answer), and Port `8005` (FastAPI DSS).
*   **Conflict Description:** Inconsistent documentation of active port mappings. Ports 5000–5002 represent the legacy MVP modes of the early monolithic setup, whereas Port 8004 is the live orchestrator port.
*   **Severity:** **Medium**
*   **Confidence:** **High**

### 1.4 Conflict 4: Qdrant Database Production Role
*   **File A:** `docs/architecture/VERIFIED_SYSTEM_MAP.md`
    *   *Claim:* Qdrant is active production database for traditional vector RAG.
*   **File B:** `SYSTEM_CONTEXT_MAP_V2.md`
    *   *Claim:* Express orchestrator does not connect to Qdrant directly; it is classed as an internal planned/optional backend component.
*   **Conflict Description:** Divergence in defining Qdrant's connection layout. Node.js backend connects to the Python RAG retriever server over HTTP REST on Port 8001, which then calls Qdrant. Node.js has no direct connection to Qdrant.
*   **Severity:** **Medium**
*   **Confidence:** **High**
