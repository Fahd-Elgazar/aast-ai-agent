# Migration Risk Report
**AAST AI Agent — Safe Relocation Risk Assessment**

This report evaluates the risks associated with moving files or folders during reorganization, highlighting critical pathways where path modifications could compromise runtime stability.

---

## 1. Migration Risk Analysis Matrix

| Reorganization Target | Proposed Action | Risk Level | Rationale & Impact |
| :--- | :--- | :---: | :--- |
| **`orchestrator.js` & `services/`** | Relocate Node.js core | **CRITICAL** | Relocating these files would break PM2 configs, launch scripts, Docker copies, and hundreds of relative `import` statements across the Express ecosystem. |
| **`phase3_retriever.py`** | Move RAG scripts | **HIGH** | Breaks Python service entry points and start batch files (`start_full_project.bat`) that expect exact paths. |
| **`college-decision-system-backend/`**| Relocate FastAPI DSS | **CRITICAL** | DSS is an independent microservice. Merging or moving its container root would break virtual env bindings, alembic db locations, and independent deployment parameters. |
| **`index.js`, `routes/mysql.js`** | Move legacy adapters | **MEDIUM** | Although bypassed by the live orchestrator runtime, relocating these legacy files could break diagnostic tests or local sandbox scripts that import them. |
| **Loose root audits** | Relocate reports | **LOW** | Moving documentation has zero impact on active production, provided the files are not referenced by live tests. |
| **`relationship/`, `multimodal/`** | Move offline sandboxes | **LOW** | Relocating offline graph metrics and legacy vision scripts to `data/` and `archive/` does not impact runtime execution. |

---

## 2. Risk Mitigation & Freeze Strategy

*   **Runtime File Lock:** We recommend freezing all active JS and Python files in their current directories. No code file should be moved.
*   **Documentation Isolation:** Documentation and offline datasets are the only assets suitable for restructuring, as they have zero runtime side effects.
*   **Dependency Isolation:** PM2 configurations, `package.json`, and Docker paths must remain 100% frozen.
