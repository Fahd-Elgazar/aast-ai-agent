# Authoritative Source Registry
**AAST AI Agent — Documentation Source-of-Truth Hierarchy**

This registry establishes the hierarchical source-of-truth structure for all documentation in the repository to prevent the use of obsolete data during book compilation.

---

## 1. Documentation Source Hierarchy

### **Tier 1 (Authoritative Baseline)**
These files are the absolute sources of truth for architecture, ports, request lifecycles, and directory structures. They contain the finalized post-reorganization states:

1.  **`ARCHITECTURE_BASELINE.md`** $\rightarrow$ System overview, deployment ports, and architectural constraints.
2.  **`SYSTEM_CONTEXT_MAP_V2.md`** $\rightarrow$ Request lifecycles, database boundaries, and sequence metrics.
3.  **`TARGET_ARCHITECTURE_V3.md`** $\rightarrow$ Module boundaries and import guidelines.
4.  **`PRODUCTION_SYSTEM_MAP.md`** $\rightarrow$ Active ports, runtimes, database connections, and start scripts.
5.  **`BOOK_SOURCE_CONFLICT_RESOLUTION.md`** $\rightarrow$ Authoritative resolution rules for compiling the graduation book.

---

### **Tier 2 (Supporting Evidence)**
These files contain active logs, class parameters, code audits, and testing data supporting the baseline architecture:

1.  **`docs/reverse_engineering/04_orchestrator.md` through `17_persistence_layer.md`** $\rightarrow$ Direct code audit notes for backend JS files.
2.  **`THESIS_EVIDENCE_MAP.md` & `IMPLEMENTATION_EVIDENCE_REPORT.md`** $\rightarrow$ Direct mappings linking system claims to code file paths.
3.  **`EXPERIMENT_EVIDENCE_REPORT.md`** $\rightarrow$ Latency, accuracy, and failover test results.
4.  **`FINAL_PROJECT_STRUCTURE.md`** $\rightarrow$ Final clean directory tree.
5.  **`BOOK_SOURCE_MAPPING.md`** $\rightarrow$ Source-to-chapter maps.
6.  **`PERFORMANCE_REVIEW_REPORT.md` & `SECURITY_REVIEW_REPORT.md`** $\rightarrow$ Hardening audit data.

---

### **Tier 3 (Historical / Obsolete)**
These files are legacy drafts or early refactoring logs. They must **not** be used as sources for the graduation book:

1.  **`SYSTEM_CONTEXT_MAP.md`** (V1) $\rightarrow$ Replaced by V2.
2.  **`TARGET_ARCHITECTURE_V2.md`** $\rightarrow$ Replaced by V3.
3.  **`docs/reports/audit/`** (all early batch logs) $\rightarrow$ Contain outdated port mappings and MySQL settings.
4.  **`docs/archive/`** $\rightarrow$ Redundant copies of root files stored for history.
