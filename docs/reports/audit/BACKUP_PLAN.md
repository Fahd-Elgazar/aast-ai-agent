# Backup Plan: Codebase Migration Safeguards

This document defines the git branch strategies, backup commands, rollback commands, and high-risk breaking vectors for the reorganization execution phase.

---

## 1. Git Branch Strategy

To ensure zero downtime and absolute safety, the migration must be done on an isolated branch with clean local backups:

1.  **Stash Existing Changes**: Ensure there are no uncommitted local changes before beginning.
    ```bash
    git stash -u
    ```
2.  **Create Recovery Tag**: Tag the current production master state so we have a permanent anchor.
    ```bash
    git tag -a pre-migration-checkpoint -m "AAST platform state before reorganization migration"
    ```
3.  **Create Migration Branch**: Create and switch to a dedicated branch for file moves.
    ```bash
    git checkout -b feature/system-reorganization
    ```

---

## 2. Hard Copy Recovery Procedure

If git operations fail or local files become corrupted, a complete offline physical copy must be made at the root directory level.

### Backup Command (Before Reorganization):
Run from PowerShell at the workspace root directory:
```powershell
# Copy the active directories to a safe local backup folder
Copy-Item -Path ".\aast-ai-agent-main" -Destination ".\aast-ai-agent-main_BAK" -Recurse -Force
Copy-Item -Path ".\colleges" -Destination ".\colleges_BAK" -Recurse -Force
Copy-Item -Path ".\step8" -Destination ".\step8_BAK" -Recurse -Force
```

---

## 3. Rollback Commands

In the event of an error during any execution batch, execution **must stop immediately**. The following commands restore the workspace to its pre-batch state:

### Git Rollback Command:
```bash
# Force reset all changes on the current branch and clean untracked directories
git reset --hard HEAD
git clean -fd
```

### Manual Rollback Command (If git fails):
```powershell
# Restore from physical backups
Remove-Item -Path ".\aast-ai-agent-main" -Recurse -Force
Remove-Item -Path ".\colleges" -Recurse -Force
Remove-Item -Path ".\step8" -Recurse -Force

Move-Item -Path ".\aast-ai-agent-main_BAK" -Destination ".\aast-ai-agent-main"
Move-Item -Path ".\colleges_BAK" -Destination ".\colleges"
Move-Item -Path ".\step8_BAK" -Destination ".\step8"
```

---

## 4. Files Most Likely to Break (High-Risk Targets)

Reorganizing paths is highly likely to disrupt the following files:

1.  **`aast-ai-agent-main/backend/orchestrator.js`**
    *   *Why*: Central hub importing almost all services. Any single path typo in its imports breaks server boot.
2.  **`aast-ai-agent-main/backend/services/metrics.js`**
    *   *Why*: Imported by multiple modules across RAG, LLM, and Routing. A path shift can cause compilation failures across multiple services.
3.  **`aast-ai-agent-main/backend/services/persistenceLayer.js`**
    *   *Why*: Resolves persistent disk storage files using relative paths. Moving this file can break session saving if the resolved paths shift.
4.  **`aast-ai-agent-main/backend/db/neo4j.js`**
    *   *Why*: Holds the Bolt connection singleton. Moving it can cause duplicate driver instances to be spawned, causing connection leaks in Neo4j.
