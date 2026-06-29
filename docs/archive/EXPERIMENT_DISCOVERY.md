# Experiment Discovery
**AAST AI Agent — Completed Experiments and Benchmarks**

This report lists the system experiments already performed, documenting their available results and highlighting gaps where data is still needed for Chapter 5 (Evaluation).

---

## 1. Documented Experiments

### 1.1 Intent Routing Evaluation
*   **Source:** `aast-ai-agent-main/backend/testing/routeBenchmark.js`, `route_accuracy_report.json`.
*   **Available Results:** Accuracy rates under different queries, validating that requests are correctly directed to DSS, GraphRAG, or Vector RAG.
*   **Missing Results:** Routing performance compared against standard classification models (like GPT-3.5 or BERT).

### 1.2 System Latency Performance Evaluation
*   **Source:** `aast-ai-agent-main/backend/testing/latencyBenchmark.js`, `latency_report.json`.
*   **Available Results:** Processing times for Neo4j lookups, Qdrant vector scans, and LLM text generation.
*   **Missing Results:** Concurrency stress tests assessing response timings under heavy multi-user loads.

### 1.3 LLM Failover & Resiliency Evaluation
*   **Source:** `aast-ai-agent-main/backend/testing/failureSimulation.js`, `failure_simulation_report.json`.
*   **Available Results:** Time taken to transition to backup local Ollama (Gemma) instances when Gemini limits are hit.
*   **Missing Results:** Long-term offline stability statistics.

### 1.4 DSS Tuition Rules Validation
*   **Source:** `college-decision-system-backend/tests/test_fee_system_hardening.py`.
*   **Available Results:** Confirms that calculated fee rates match predefined student database invoices.
*   **Missing Results:** Scalability tests under complex multi-college configurations.
