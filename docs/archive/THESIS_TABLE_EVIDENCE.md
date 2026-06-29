# Thesis Table Evidence
**AAST AI Agent — Tabular Evidence Sources**

This report documents the exact source files and validation datasets for table candidates to be included in the graduation project book.

---

## 1. Discovered Table Evidence

### 1.1 System Network Ports Table
*   **Source File:** `PRODUCTION_SYSTEM_MAP.md`
*   **Validation Source:** `aast-ai-agent-main/backend/services/healthProbes.js`
*   **Purpose:** Maps active port allocations and bindings.

### 1.2 File-system Classifications Table
*   **Source File:** `FILE_CLASSIFICATION_REPORT.md`
*   **Validation Source:** Git repository structure status.
*   **Purpose:** Differentiates production core files from legacy adapters.

### 1.3 Latency Timings Profile Table
*   **Source File:** `PERFORMANCE_REVIEW_REPORT.md`
*   **Validation Source:** `aast-ai-agent-main/backend/testing/latency_report.json`
*   **Purpose:** Documents service-level timings (GraphRAG, Vector RAG, DSS, Gemini API, Ollama).

### 1.4 Intent Router Accuracy Benchmarks Table
*   **Source File:** `aast-ai-agent-main/backend/testing/benchmark_summary.md`
*   **Validation Source:** `aast-ai-agent-main/backend/testing/route_accuracy_report.json`
*   **Purpose:** Documents brain router accuracy across different user intents.

### 1.5 Database Schema Matrix Table
*   **Source File:** `college-decision-system-backend/app/infrastructure/db/session.py` / `aast-ai-agent-main/backend/db/neo4j.js`
*   **Validation Source:** Active SQLite ER schema and Neo4j node metadata.
*   **Purpose:** Contrasts SQLite relational models against Neo4j Cypher relations.
