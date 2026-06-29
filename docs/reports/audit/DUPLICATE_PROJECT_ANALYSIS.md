# Duplicate Project Analysis: AAST Academic AI Agent

This document lists all historical snapshots, experimental copies, duplicates, and backup files found in the workspace root. Per final instructions, these are listed here for analysis and will **not** be moved or archived during Phase 1.

---

## 1. Nested Frontend Duplicates (High Density)

During our audit of the frontend module (`aast-ai-agent-main/frontend/`), we discovered multiple recursive nested folders that duplicate other root project folders. This typically occurs due to accidental Git clone paths or drag-and-drop operations:

| Duplicate Folder Path | Duplicates Root Directory | Size / Content Description |
| :--- | :--- | :--- |
| `aast-ai-agent-main/frontend/aast-ai-agent-main/` | `aast-ai-agent-main/` | Contains another full copy of `backend/`, `frontend-test/`, dumps, and javascript replace utilities. |
| `aast-ai-agent-main/frontend/frontend/` | `aast-ai-agent-main/frontend/` | Duplicate copy of the React/Vite frontend source codes, packages, and config. |
| `aast-ai-agent-main/frontend/college-decision-system-backend/`| `college-decision-system-backend/`| Unused copy of the FastAPI DSS microservice codebase. |
| `aast-ai-agent-main/frontend/multimodal/` | `multimodal/` | Unused copy of the experimental multimodal reasoning pipeline. |

*Note: These nested folders inside the frontend are completely isolated and are not referenced by the active Vite dev server.*

---

## 2. Scraping and Dataset Duplicates (`step8/`)

The `step8` folder, which houses playwright crawlers and data normalization pipelines, contains several backup snapshots and duplicates:

| Folder / File Path | Status / Purpose | Relationship |
| :--- | :--- | :--- |
| `step8/adv_scraping - Copy/` | Duplicate folder | Copy of playwright scraper directory `step8/adv_scraping/`. |
| `step8/datasets - Copy/` | Duplicate folder | Copy of datasets directory `step8/datasets/`. |
| `step8/df - Copy/` | Duplicate folder | Copy of Pandas DataFrame dumps directory `step8/df/`. |
| `step8/last version/` | Experimental snapshot | Snapshot of crawler outputs and scraping results. |
| `step8/last version - Copy/` | Duplicate folder | Copy of the `last version/` snapshot. |
| `step8/normalized_college_v2 - Copy/` | Duplicate folder | Copy of normalized college data parser. |

---

## 3. Documentation Duplicates

Scattered master documentation files exist across multiple folders, creating redundancies:

*   **MASTER_TECHNICAL_DOCUMENTATION.md**:
    *   Path A: Project root `c:\Users\mh978\Downloads\AI_AGENT\MASTER_TECHNICAL_DOCUMENTATION.md`
    *   Path B: `doc/MASTER_TECHNICAL_DOCUMENTATION.md`
    *   Path C: `book/MASTER_TECHNICAL_DOCUMENTATION.md`
*   **AAST_AI_Agent_Architecture_Sequence_Diagrams.md**:
    *   Path A: `book/AAST_AI_Agent_Architecture_Sequence_Diagrams.md`
    *   Path B: `college-decision-system-backend/docs/AAST_AI_Agent_Architecture_Sequence_Diagrams.md`
*   **CONDENSED_RUNTIME_TRACE.md**:
    *   Path A: `book/CONDENSED_RUNTIME_TRACE.md`
    *   Path B: `college-decision-system-backend/docs/CONDENSED_RUNTIME_TRACE.md`
*   **VERIFIED_SYSTEM_MAP.md**:
    *   Path A: `book/VERIFIED_SYSTEM_MAP.md`
    *   Path B: `college-decision-system-backend/docs/VERIFIED_SYSTEM_MAP.md`

---

## 4. Compressed Archives & Backup Dumps

The following single-file backups were detected:

*   `aast-ai-agent-main/frontend.7z`: Large 18MB compressed archive containing frontend source and assets.
*   `college-decision-system-backend/dev.db.bak`: Backup snapshot of the SQLite database.
*   `college-decision-system-backend/tmp_malformed_test.db`: Temporary test DB.
*   `aast-ai-agent-main/neo4j-data.dump`, `neo4j-data-new.dump`, `new4j-data2.dump`: Neo4j database dumps in the main subfolder.
*   `relationship/backup_pre_phase4b.json`: Pre-patch snapshot JSON of graph nodes.
