# Repository Recovery Plan
**Reorganization Batches 1 & 2**

This recovery plan provides exact instructions and Git commands to reverse all changes made during Batches 1 and 2, restoring the repository to its exact pre-migration state.

---

## 1. Overview of Changes to Revert

To undo the organization changes, we must:
1. Restore all tracked files that were moved (represented as deletions in Git status).
2. Remove all newly created directories and files that are untracked (`docs/`, `data/`, `graphrag/`).
3. Revert any local node_modules changes if desired (optional, since they are ignored by Git).

---

## 2. Recovery Commands

Execute the following commands sequentially in the repository root directory (`c:\Users\mh978\Downloads\AI_AGENT`):

### Step 1: Restore Tracked Files
To restore all original files that were moved (deleted from their original tracked locations):
```bash
git restore .
```
*(Alternative for older Git versions)*:
```bash
git checkout -- .
```

### Step 2: Remove Newly Created Migration Folders
To delete all untracked files and directories created under `docs/`, `data/`, and `graphrag/`:
```bash
git clean -fd
```
> [!WARNING]
> Running `git clean -fd` will delete all untracked files and directories in the workspace. If you have created any other untracked scratch files that you wish to keep, move them out of the workspace before running this command.

---

## 3. Restored Files Inventory

Executing the recovery commands will restore the following files to their original paths:

1. `DOCKERIZATION.md` (root)
2. `aast-ai-agent-main/AAST_AGENT_SYSTEM_DOCS.md`
3. `aast-ai-agent-main/backend/embed_server_rag.py`
4. `aast-ai-agent-main/backend/ner_service.py`
5. `aast-ai-agent-main/docs/01_MASTER_TECHNICAL_REPORT.md`
6. `aast-ai-agent-main/docs/02_COMPONENT_SYSTEM_DESCRIPTION.md`
7. `aast-ai-agent-main/docs/03_ARCHITECTURAL_DIAGRAMS.md`
8. `aast-ai-agent-main/docs/04_PERFORMANCE_ANALYSIS.md`
9. `college-decision-system-backend/SECURITY_SCRUB_GUIDE.md`
10. `college-decision-system-backend/SEMANTIC_TAGGING_GUIDE.md`
11. `college-decision-system-backend/docs/demo_examples.md`
12. `relationship/graph_metrics_phase4b.md`

And it will delete:
* The `docs/` folder (along with all generated markdown audit reports).
* The `data/` folder (restoring `colleges` and `step8` to their untracked locations if they were untracked originally, or deleting them if clean is run).
* The `graphrag/` folder.

---

## 4. Expected Restored State
* **Working Directory:** The workspace will be completely identical to the initial checkout baseline.
* **Git Status:** `nothing to commit, working tree clean` (or showing only original untracked user files).
