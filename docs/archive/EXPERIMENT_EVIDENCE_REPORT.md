# Experiment Evidence Report
**AAST AI Agent — Empirical Verification Evidence**

This report catalogs the testing scripts and output logs in the repository that prove system accuracy, routing correctness, latency, and fault tolerance.

---

## 1. Empirical Verification Evidence

### 1.1 Intent Routing Classification Accuracy
*   **Proof Path:** `aast-ai-agent-main/backend/testing/routeBenchmark.js` & `route_accuracy_report.json`
*   **Evidence:** Test script running mock queries against `brainRouter.js` and logging success/failure ratios.

### 1.2 System Latency Profile
*   **Proof Path:** `aast-ai-agent-main/backend/testing/latencyBenchmark.js` & `latency_report.json`
*   **Evidence:** Test wrapper mapping timings for GraphRAG Neo4j queries, Qdrant vector scans, and LLM text generation.

### 1.3 LLM Failover & Resiliency
*   **Proof Path:** `aast-ai-agent-main/backend/testing/failureSimulation.js` & `failure_simulation_report.json`
*   **Evidence:** PM2 process manager timings verifying seamless switch to local Ollama (Gemma) instances.

### 1.4 DSS Tuition Rules Correctness
*   **Proof Path:** `college-decision-system-backend/tests/test_fee_system_hardening.py`
*   **Evidence:** Asserts tuition calculation output matched predefined student database invoices.

### 1.5 Database Validation
*   **Proof Path:** `college-decision-system-backend/tests/test_database_integrity.py` & `docs/reports/graph_metrics_phase4b.md`
*   **Evidence:** Exposes relational integrity check models in DSS and verifies Neo4j schema node consistency.
