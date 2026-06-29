# Review Validation Report: Reorganization Audit

This report validates every conclusion and proposed file classification in the `FILE_CLASSIFICATION_REPORT.md`, `DUPLICATE_PROJECT_ANALYSIS.md`, and `MIGRATION_PLAN.md`. It applies the strict **Archive Safety Rule**: any candidate for archiving must have verified zero references across runtime, imports, startup scripts, and deployments.

---

## 1. Archive Candidate Safety Audits

Below is the verified audit trace for every proposed archive candidate. Any file that fails the strict zero-reference check is downgraded to `REVIEW_REQUIRED`.

### 1.1 `backend/knowledgeGraphService.js`
*   **File**: `aast-ai-agent-main/backend/knowledgeGraphService.js`
*   **Reason**: Chroma-based vector retriever wrapper for Knowledge Graph. Replaced by direct Neo4j Bolt driver queries in `neo4jcontext.js`.
*   **Import References**: None (verified via grep search).
*   **Runtime References**: None.
*   **Startup References**: None.
*   **Deployment References**: None.
*   **Archive Confidence**: `99%` (Definitely safe to archive).

### 1.2 `backend/schema.js`
*   **File**: `aast-ai-agent-main/backend/schema.js`
*   **Reason**: MySQL Drizzle schema definition. Unused in the active Express orchestrator.
*   **Import References**: None (verified via grep search).
*   **Runtime References**: None.
*   **Startup References**: None.
*   **Deployment References**: None.
*   **Archive Confidence**: `99%` (Definitely safe to archive).

### 1.3 `backend/services/neo4jService.js`
*   **File**: `aast-ai-agent-main/backend/services/neo4jService.js`
*   **Reason**: Completely empty (0 bytes) helper placeholder in the services directory.
*   **Import References**: None (verified via grep search).
*   **Runtime References**: None.
*   **Startup References**: None.
*   **Deployment References**: None.
*   **Archive Confidence**: `99%` (Definitely safe to archive).

### 1.4 `backend/services/decisionService.txt`
*   **File**: `aast-ai-agent-main/backend/services/decisionService.txt`
*   **Reason**: Older prototype/backup text file containing a subset of `decisionService.js` logic.
*   **Import References**: None.
*   **Runtime References**: None.
*   **Startup References**: None.
*   **Deployment References**: None.
*   **Archive Confidence**: `99%` (Definitely safe to archive).

---

## 2. Research Utility Classifications

In compliance with Phase 2 requirements, the following files are designated as **RESEARCH_UTILITY** instead of archive candidates. While not actively imported by the Express orchestrator, they provide valuable local validation functions:

### 2.1 `backend/embed_server_rag.py`
*   **File**: `aast-ai-agent-main/backend/embed_server_rag.py`
*   **Reason**: Preflight or research utility for verifying BGE-M3 model performance.
*   **Status**: `RESEARCH_UTILITY` (Do not archive. Safe to move to `graphrag/neo4j/` or `graphrag/rag_system/` as reference).

### 2.2 `backend/ner_service.py`
*   **File**: `aast-ai-agent-main/backend/ner_service.py`
*   **Reason**: Preflight or research utility for verifying named entity extraction models and regex overlaps.
*   **Status**: `RESEARCH_UTILITY` (Do not archive. Safe to move to `graphrag/graph_retrieval/` or similar reference).

---

## 3. Downgrades to REVIEW_REQUIRED (Archiving Safety Violations)

The files below were originally candidates for archiving but are downgraded due to active references:

### 3.1 `backend/index.js`
*   **File**: `aast-ai-agent-main/backend/index.js`
*   **Reason for Downgrade**: The active launcher (`start_platform.ps1`) bypasses this file in favor of `orchestrator.js`. However, `index.js` is still linked to multiple core `package.json` scripts:
    *   `"start": "node index.js"`
    *   `"dev": "nodemon index.js"`
    *   `"neo": "nodemon index.js neo"`
    *   `"sql": "nodemon index.js sql"`
    *   `"meili": "nodemon index.js meili"`
*   **Status**: `REVIEW_REQUIRED` (Do not archive. Keep in project root or update the scripts block first).

### 3.2 `backend/db/mysql.js` & `backend/db/meili.js`
*   **Files**: `aast-ai-agent-main/backend/db/mysql.js` and `db/meili.js`
*   **Reason for Downgrade**: Unused by the orchestrator. However, they are actively imported by `backend/index.js`.
*   **Status**: `REVIEW_REQUIRED` (Keep in place until `index.js` is resolved).

### 3.3 `backend/routes/mysql.js` & `backend/routes/search.js`
*   **Files**: `aast-ai-agent-main/backend/routes/mysql.js` and `routes/search.js`
*   **Reason for Downgrade**: Unused by the orchestrator. However, they are actively imported by `backend/index.js`.
*   **Status**: `REVIEW_REQUIRED`.

### 3.4 `backend/models/User.js` & `backend/routes/auth.js`
*   **Files**: `aast-ai-agent-main/backend/models/User.js` and `routes/auth.js`
*   **Reason for Downgrade**: `routes/auth.js` is referenced by `index.js` and imports `models/User.js`.
*   **Status**: `REVIEW_REQUIRED`.

---

## 4. Validation of Reorganization Conclusions

### 4.1 Validation of `FILE_CLASSIFICATION_REPORT.md`
*   **Conclusion**: Subprojects like the frontend and FastAPI DSS are correctly classified as **PRODUCTION** and kept independent.
*   **Verdict**: **Valid**. The microservice architecture separation between Node and FastAPI must be preserved.

### 4.2 Validation of `DUPLICATE_PROJECT_ANALYSIS.md`
*   **Conclusion**: Identified nested recursive directories inside `frontend/` (like `frontend/frontend`) and playwright copies inside `step8/`.
*   **Verdict**: **Valid**. These nested directories are safe to delete *after* complete validation of Phase 2, but must not be touched during Phase 1.

### 4.3 Validation of `MIGRATION_PLAN.md`
*   **Conclusion**: Maps files to a clean layered folder structure.
*   **Verdict**: **Valid**, provided the migration-protected core files (`orchestrator.js`, `brainRouter.js`, and `unifiedAnswerService.js`) are withheld from the initial move batch.
