# Book Source Lock
**AAST AI Agent — Thesis Chapter Sourcing Guidelines**

This report defines the allowed and forbidden sources for compiling each chapter of the graduation project book.

---

## 1. Chapter Sourcing Rules

### 1.1 Chapter 1: Introduction & Problem Statement
*   **Preferred Source:** `docs/architecture/AAST_AGENT_SYSTEM_DOCS.md`
*   **Allowed Sources:** `docs/architecture/MASTER_PROJECT_BANK.md`.
*   **Forbidden Sources:** Early audits in `docs/reports/audit/`.

### 1.2 Chapter 2: Literature Review & Related Work
*   **Preferred Source:** `LITERATURE_REVIEW_DISCOVERY.md` & `RELATED_WORK_DISCOVERY.md`.
*   **Allowed Sources:** `PROJECT_NOVELTY_DISCOVERY.md`.
*   **Forbidden Sources:** Legacy `index.js` or `mysql.js` code documentation.

### 1.3 Chapter 3: System Analysis & Design
*   **Preferred Source:** `docs/architecture/MASTER_TECHNICAL_DOCUMENTATION.md` & `SYSTEM_CONTEXT_MAP_V2.md`.
*   **Allowed Sources:** `PRODUCTION_SYSTEM_MAP.md` (root), `docs/diagrams/diagram.png`.
*   **Forbidden Sources:** Early `SYSTEM_CONTEXT_MAP.md` (V1), `docs/reports/audit/PRODUCTION_SYSTEM_MAP.md` (which lists outdated ports).

### 1.4 Chapter 4: Implementation Details
*   **Preferred Source:** `docs/reverse_engineering/` files (`04_orchestrator.md` through `17_persistence_layer.md`).
*   **Allowed Sources:** `docs/diagrams/AAST_AI_Agent_Sequence_Diagrams.md`, `IMPLEMENTATION_EVIDENCE_REPORT.md`.
*   **Forbidden Sources:** Duplicate nested backups inside `frontend/`.

### 1.5 Chapter 5: Evaluation & Benchmarks
*   **Preferred Source:** `docs/reports/04_PERFORMANCE_ANALYSIS.md` & `docs/reverse_engineering/ACCURACY_VALIDATION_REPORT.md`.
*   **Allowed Sources:** `EXPERIMENT_EVIDENCE_REPORT.md`, `testing/benchmark_summary.md`.
*   **Forbidden Sources:** Early batch validation files inside `docs/reports/audit/` (such as `BATCH1_VALIDATION_REPORT.md`).
