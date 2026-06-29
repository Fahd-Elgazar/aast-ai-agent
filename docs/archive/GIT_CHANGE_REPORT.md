# Git Change Report
**Reorganization Batches 1 & 2**

This report documents the current status of the Git repository, listing tracked changes, branch configurations, untracked directories, and commit history.

---

## 1. Branch Configuration

* **Current Branch:** `feature/system-reorganization`
* **Parent Branch:** `main` (or baseline workspace state)
* **Commits Created:** **None** (No commits have been created; all changes are currently in the working tree).

---

## 2. File Status Inventory

### Staged Files
* **None**. No files have been staged for commit (`git add` has not been executed).

### Modified Files (Tracked)
There are no modified files. The only changes to tracked files are **deletions** corresponding to files that were moved to their target directories:

* `deleted:    DOCKERIZATION.md`
* `deleted:    aast-ai-agent-main/AAST_AGENT_SYSTEM_DOCS.md`
* `deleted:    aast-ai-agent-main/backend/embed_server_rag.py`
* `deleted:    aast-ai-agent-main/backend/ner_service.py`
* `deleted:    aast-ai-agent-main/docs/01_MASTER_TECHNICAL_REPORT.md`
* `deleted:    aast-ai-agent-main/docs/02_COMPONENT_SYSTEM_DESCRIPTION.md`
* `deleted:    aast-ai-agent-main/docs/03_ARCHITECTURAL_DIAGRAMS.md`
* `deleted:    aast-ai-agent-main/docs/04_PERFORMANCE_ANALYSIS.md`
* `deleted:    college-decision-system-backend/SECURITY_SCRUB_GUIDE.md`
* `deleted:    college-decision-system-backend/SEMANTIC_TAGGING_GUIDE.md`
* `deleted:    college-decision-system-backend/docs/demo_examples.md`
* `deleted:    relationship/graph_metrics_phase4b.md`

### Untracked Files & Folders
The newly moved files are located in three central folders created during the migration:

1. **`docs/`**: Centralized documentation folder containing architectural guides, reports, diagram source files, and audits.
2. **`data/`**: Relocated datasets (`colleges/`) and scraping resources (`step8/`).
3. **`graphrag/`**: Relocated research utility python scripts (`embed_server_rag.py` and `ner_service.py`).

---

## 3. Command Output: Git Status

The raw output of running `git status` in the repository root:

```text
On branch feature/system-reorganization
Changes not staged for commit:
  (use "git add/rm <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
	deleted:    DOCKERIZATION.md
	deleted:    aast-ai-agent-main/AAST_AGENT_SYSTEM_DOCS.md
	deleted:    aast-ai-agent-main/backend/embed_server_rag.py
	deleted:    aast-ai-agent-main/backend/ner_service.py
	deleted:    aast-ai-agent-main/docs/01_MASTER_TECHNICAL_REPORT.md
	deleted:    aast-ai-agent-main/docs/02_COMPONENT_SYSTEM_DESCRIPTION.md
	deleted:    aast-ai-agent-main/docs/03_ARCHITECTURAL_DIAGRAMS.md
	deleted:    aast-ai-agent-main/docs/04_PERFORMANCE_ANALYSIS.md
	deleted:    college-decision-system-backend/SECURITY_SCRUB_GUIDE.md
	deleted:    college-decision-system-backend/SEMANTIC_TAGGING_GUIDE.md
	deleted:    college-decision-system-backend/docs/demo_examples.md
	deleted:    relationship/graph_metrics_phase4b.md

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	data/
	docs/
	graphrag/
```
