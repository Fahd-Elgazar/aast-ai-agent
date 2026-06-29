# Book Source Conflict Resolution
**AAST AI Agent — Authoritative Source and Conflict Resolution Matrix**

This report resolves discrepancies between documentation versions, designating authoritative sources and flagging obsolete files to prevent errors during thesis compilation.

---

## 1. Authoritative vs. Obsolete Source Index

| Documentation Topic | Authoritative Sources (Use in Book) | Obsolete/Bypassed Sources (Do NOT Use) | Conflict Resolution Rule |
| :--- | :--- | :--- | :--- |
| **System Entry Point & Ports** | Root `PRODUCTION_SYSTEM_MAP.md` | `docs/reports/audit/PRODUCTION_SYSTEM_MAP.md`, `index.js`, `backend/README.md`. | Bypassed port mappings (5000–5002) and `index.js` startup flags are legacy. Standardize on Port 8004 and `orchestrator.js`. |
| **Database active Role** | `SYSTEM_CONTEXT_MAP_V2.md`, `db/neo4j.js`, `dev.db`. | `docs/architecture/VERIFIED_SYSTEM_MAP.md` (regarding MySQL). | MySQL is legacy and bypassed. Document SQLite (DSS) and Neo4j (GraphRAG) as active production databases, and classify MySQL/MongoDB as legacy MVP adapters. |
| **Data Flow** | `SYSTEM_CONTEXT_MAP_V2.md`, `ENTRYPOINT_ANALYSIS.md`. | Older context map versions in `docs/archive/`. | Follow the updated request flow: Frontend $\rightarrow$ Express Orchestrator $\rightarrow$ Brain Router $\rightarrow$ GraphRAG/DSS/Python RAG. |
| **System Reorganization**| `FINAL_EXECUTION_AUDIT.md`, `FINAL_PROJECT_STRUCTURE.md`. | `docs/reports/audit/` early batch files. | Focus on the final frozen directory layout as documented in the root audits. |

---

## 2. General Resolution Guidelines
1.  **Do not reference MySQL/MongoDB** as production dependencies. Clearly document them as legacy MVP adapters that have been bypassed in the active orchestrator backend.
2.  **Do not reference `index.js`** as the active server entrypoint. Document it as legacy code and utilize `orchestrator.js` as the sole production entrypoint.
3.  **Always consult the final root reports** for system benchmarks and classification lists rather than early drafts in `docs/reports/audit/`.
