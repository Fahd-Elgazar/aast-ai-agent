# Final Execution Plan
**Safe Reorganization & Cleanup Phase**

This plan outlines the final, safe reorganization operations authorized for execution. It targets non-runtime documentation, experimental code, and data archives, ensuring zero impact on active production microservices.

---

## 1. Relocation Checklists

### 1.1 Documentation Cleanup
Moving loose documents from the workspace root into centralized `docs/` directories based on content:

| Source Path | Target Destination | Classification |
| :--- | :--- | :---: |
| `final_verdict_aast_ai_agent (1).docx` | `docs/reports/final_verdict_aast_ai_agent (1).docx` | Report |
| `test.txt` | `docs/archive/test_queries.txt` | Query Sandbox |

---

### 1.2 Relationship Data Organization
Relocating the experimental graph database analysis workspace into the centralized `data/` store:

*   **Source Folder:** `relationship/`
*   **Target Folder:** `data/relationship/`
*   **Action:** Move the entire folder recursively, preserving files and subdirectories.

**Files to be relocated:**
*   `relationship/aast-advisor-graph-desktop.png` $\rightarrow$ `data/relationship/aast-advisor-graph-desktop.png`
*   `relationship/analyze_clean.py` $\rightarrow$ `data/relationship/analyze_clean.py`
*   `relationship/analyze_graph.py` $\rightarrow$ `data/relationship/analyze_graph.py`
*   `relationship/analyze_relationship.py` $\rightarrow$ `data/relationship/analyze_relationship.py`
*   `relationship/analyze_relationship2.py` $\rightarrow$ `data/relationship/analyze_relationship2.py`
*   `relationship/backup_pre_phase4b.json` $\rightarrow$ `data/relationship/backup_pre_phase4b.json`
*   `relationship/check_keys.py` $\rightarrow$ `data/relationship/check_keys.py`
*   `relationship/check_names.py` $\rightarrow$ `data/relationship/check_names.py`
*   `relationship/dump_nodes.py` $\rightarrow$ `data/relationship/dump_nodes.py`
*   `relationship/phase4b_patch.py` $\rightarrow$ `data/relationship/phase4b_patch.py`
*   `relationship/phase4b_patch_log.json` $\rightarrow$ `data/relationship/phase4b_patch_log.json`
*   `relationship/relationship.json` $\rightarrow$ `data/relationship/relationship.json`
*   `relationship/relationship_analysis.txt` $\rightarrow$ `data/relationship/relationship_analysis.txt`
*   `relationship/relationship_analysis_clean.txt` $\rightarrow$ `data/relationship/relationship_analysis_clean.txt`
*   `relationship/relationship_phase4b.json` $\rightarrow$ `data/relationship/relationship_phase4b.json`
*   `relationship/neo4j_query_table_data_2026-4-22 (2).json` $\rightarrow$ `data/relationship/neo4j_query_table_data_2026-4-22 (2).json`

---

### 1.3 Multimodal Archive
Relocating legacy vision model reasoning pipelines into the centralized `archive/` store:

*   **Source Folder:** `multimodal/`
*   **Target Folder:** `archive/multimodal/`
*   **Action:** Move the entire folder recursively, preserving all subdirectories and Pyc compiler artifacts without modification or renaming.

**Directories and Files to be relocated:**
*   `multimodal/app.py` $\rightarrow$ `archive/multimodal/app.py`
*   `multimodal/pipeline/` (and nested contents) $\rightarrow$ `archive/multimodal/pipeline/`
*   `multimodal/reasoning/` (and nested contents) $\rightarrow$ `archive/multimodal/reasoning/`
*   `multimodal/vision/` (and nested contents) $\rightarrow$ `archive/multimodal/vision/`

---

### 1.4 Empty Directory Cleanup
Pruning source folders that become empty *only* after files have been successfully relocated:

*   `relationship/` (To be removed after all contents are moved to `data/relationship/`).
*   `multimodal/` (To be removed after all contents are moved to `archive/multimodal/`).

---

## 2. Strictly Forbidden (Protected Baseline)
The following files and paths are migration-protected and will **not** be modified, renamed, moved, or deleted:
*   **Entry points & orchestration:** `orchestrator.js`, `brainRouter.js`, `unifiedAnswerService.js`, `conversationService.js`, `neo4jcontext.js`, `ragService.js`, `db/neo4j.js`.
*   **Infrastructure utilities:** `logger.js`, `metrics.js`, `persistenceLayer.js`, `circuitStateManager.js`, `healthMonitor.js`, `healthProbes.js`, `gemmaTelemetryService.js`.
*   **Python RAG & DSS APIs:** `phase3_retriever.py`, `phase4_llm_answer_engine.py`, `college-decision-system-backend/` app code.
*   **Deployment & Package Configuration:** `Dockerfiles`, `docker-compose.yml`, `package.json`, `package-lock.json`.

---

## 3. Verification & Execution Procedure
1.  Write `FINAL_EXECUTION_PLAN.md` to repository.
2.  Set a 10-second wait timer using the `schedule` tool.
3.  Re-verify existence of all listed source paths.
4.  Execute move operations via safe PowerShell commands.
5.  Generate outcome reports (`EMPTY_DIRECTORY_REPORT.md`, `FINAL_EXECUTION_AUDIT.md`, `FINAL_PROJECT_STRUCTURE.md`).
6.  Stop execution.
