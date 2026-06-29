# Book Table Discovery
**AAST AI Agent — Data-to-Table Formatting Mapping**

This report lists the data structures, network settings, and test metrics in the repository that are suitable for formatting as academic tables in the thesis chapters.

---

## 1. Discovered Tables

### 1.1 Table 1: System Network Ports Allocation
*   **Source Data:** `PRODUCTION_SYSTEM_MAP.md`
*   **Target Chapter:** Chapter 3 (System Design).
*   **Columns:** Service, Port, Protocol, Binding, Purpose.
*   **Reasoning:** Essential for outlining infrastructure bindings and internal microservice communication routes.

### 1.2 Table 2: File-system Classifications
*   **Source Data:** `FILE_CLASSIFICATION_REPORT.md`
*   **Target Chapter:** Chapter 4 (Implementation).
*   **Columns:** File Name, Absolute Path, Classification Category, Key Purpose.
*   **Reasoning:** Clearly indexes production runtime files versus legacy adapters and data assets.

### 1.3 Table 3: Average Latency Timings Profile
*   **Source Data:** `PERFORMANCE_REVIEW_REPORT.md` / `latency_report.json`
*   **Target Chapter:** Chapter 5 (Evaluation).
*   **Columns:** Processing Step, Average Latency, Network Protocol, Latency Risk.
*   **Reasoning:** Documents service-level latencies (GraphRAG, Vector RAG, DSS, Gemini API, Ollama failovers) to identify performance bottlenecks.

### 1.4 Table 4: Intent Router Accuracy Benchmarks
*   **Source Data:** `testing/benchmark_summary.md` / `route_accuracy_report.json`
*   **Target Chapter:** Chapter 5 (Evaluation).
*   **Columns:** Query Intent Class, Total Test Runs, Correct Routes, Classifier Accuracy (%).
*   **Reasoning:** Proves routing reliability, validating the brain router's accuracy across different user intents.

### 1.5 Table 5: Active Databases Schema Matrix
*   **Source Data:** `docs/reverse_engineering/08d_database_schema.md` / `07_neo4j_engine.md`
*   **Target Chapter:** Chapter 3 (System Design).
*   **Columns:** Database Type, Target Subsystem, Schema Engine, Key Relational Entities.
*   **Reasoning:** Contrasts the Neo4j GraphRAG schema structure against the relational SQLite schema used in the DSS microservice.
