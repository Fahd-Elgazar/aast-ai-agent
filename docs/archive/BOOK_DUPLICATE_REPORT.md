# Book Duplicate Report
**AAST AI Agent — Documentation Duplication and Redundancy Audit**

This report identifies identical and highly similar documentation files residing in different folders within the repository, providing recommendations to resolve redundancies before final book packaging.

---

## 1. Document Duplications List

### 1.1 Root Directory Audits vs. `docs/archive/`
*   **Original File:** Root files (e.g., `EMPTY_DIRECTORY_REPORT.md`, `ENTRYPOINT_ANALYSIS.md`, `SYSTEM_CONTEXT_MAP_V2.md`, `ARCHITECTURE_BASELINE.md`, `TARGET_ARCHITECTURE_V3.md`, etc.).
*   **Duplicate File:** Copies residing under `docs/archive/` (e.g., `docs/archive/EMPTY_DIRECTORY_REPORT.md`, etc.).
*   **Similarity Estimate:** `100%` (Exact copy).
*   **Recommendation:** Keep the copies in `docs/archive/` as a record of migration batches. The duplicate markdown files in the root folder can be deleted once git history is finalized to prevent root directory clutter.

### 1.2 `Sequence_Diagrams_duplicate.md` vs. `AAST_AI_Agent_Sequence_Diagrams.md`
*   **Original File:** `docs/diagrams/AAST_AI_Agent_Sequence_Diagrams.md`
*   **Duplicate File:** `docs/archive/Sequence_Diagrams_duplicate.md`
*   **Similarity Estimate:** `100%` (Exact copy).
*   **Recommendation:** Delete the duplicate in `docs/archive/` and maintain the active copy in `docs/diagrams/`.

### 1.3 `VERIFIED_SYSTEM_MAP_duplicate.md` vs. `VERIFIED_SYSTEM_MAP.md`
*   **Original File:** `docs/architecture/VERIFIED_SYSTEM_MAP.md`
*   **Duplicate File:** `docs/archive/VERIFIED_SYSTEM_MAP_duplicate.md`
*   **Similarity Estimate:** `100%` (Exact copy).
*   **Recommendation:** Delete the duplicate in `docs/archive/` and maintain the copy in `docs/architecture/`.

### 1.4 `MASTER_TECHNICAL_DOCUMENTATION_duplicate.md` vs. `MASTER_TECHNICAL_DOCUMENTATION.md`
*   **Original File:** `docs/architecture/MASTER_TECHNICAL_DOCUMENTATION.md`
*   **Duplicate File:** `docs/archive/MASTER_TECHNICAL_DOCUMENTATION_duplicate.md` & `docs/archive/MASTER_TECHNICAL_DOCUMENTATION_doc_duplicate.md`
*   **Similarity Estimate:** `100%` (Exact copy).
*   **Recommendation:** Delete both duplicates in `docs/archive/` to prevent developer confusion.

### 1.5 Nested Backups (Frontend Directory)
*   **Original File:** `docs/architecture/AAST_AGENT_SYSTEM_DOCS.md`
*   **Duplicate File:** `aast-ai-agent-main/frontend/aast-ai-agent-main/AAST_AGENT_SYSTEM_DOCS.md`
*   **Similarity Estimate:** `100%` (Exact copy).
*   **Recommendation:** Delete the duplicate nested inside the frontend folders as it clutters the frontend workspace.
*   **Original File:** `docs/development/SECURITY_SCRUB_GUIDE.md` & `SEMANTIC_TAGGING_GUIDE.md`
*   **Duplicate File:** `aast-ai-agent-main/frontend/college-decision-system-backend/SECURITY_SCRUB_GUIDE.md` & `SEMANTIC_TAGGING_GUIDE.md`
*   **Similarity Estimate:** `100%` (Exact copy).
*   **Recommendation:** Delete these duplicates from the frontend folder; utilize the centralized docs instead.

---

## 2. Early Audits vs. Root Reports
*   **Original File:** Root audits (e.g., `PRODUCTION_SYSTEM_MAP.md`, `FILE_CLASSIFICATION_REPORT.md`, `ENTRYPOINT_ANALYSIS.md`).
*   **Duplicate File:** `docs/reports/audit/PRODUCTION_SYSTEM_MAP.md`, etc.
*   **Similarity Estimate:** `85% - 95%` (Early draft vs. final polished version).
*   **Recommendation:** Maintain both. The copies in `docs/reports/audit/` document the progression of the refactoring phases, while the root files are the finalized state.
