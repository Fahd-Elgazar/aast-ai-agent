# Evaluation Metric Discovery
**AAST AI Agent — Runtime Performance & Accuracy Metrics**

This report lists the performance, accuracy, and availability metrics currently logged and monitored within the AAST AI Agent platform.

---

## 1. Discovered Metrics

### 1.1 Latency / Response Time
*   **Definition:** The time taken to process and synthesize a user chat query.
*   **Where it appears:** `aast-ai-agent-main/backend/testing/latencyBenchmark.js`, `services/metrics.js` (`recordDuration`).
*   **Measurement Method:** Measures performance timings (in milliseconds) at different stages (GraphRAG search, RAG API call, DSS calculation, LLM generation).
*   **Related Subsystem:** Node orchestrator, Python retriever, FastAPI DSS.

### 1.2 Intent Routing Classification Accuracy
*   **Definition:** The percentage of user queries correctly categorized into their target paths.
*   **Where it appears:** `aast-ai-agent-main/backend/testing/routeBenchmark.js`, `route_accuracy_report.json`.
*   **Measurement Method:** Runs test prompts against `brainRouter.js` and compares output categories against `expectedRoutes.json`.
*   **Related Subsystem:** Brain Router.

### 1.3 Groundedness / Hallucination Rate
*   **Definition:** Evaluates if LLM generated response tokens correspond strictly to retrieved context.
*   **Where it appears:** `docs/reverse_engineering/ACCURACY_VALIDATION_REPORT.md`, `testing/hallucinationTest.js`.
*   **Measurement Method:** Compares word overlap ratios between retrieved DB schemas/policies and output text blocks.
*   **Related Subsystem:** Unified Answer Service.

### 1.4 Failure Rate & Availability
*   **Definition:** The percentage of failed service calls or timeouts.
*   **Where it appears:** `aast-ai-agent-main/backend/services/circuitStateManager.js`.
*   **Measurement Method:** Tracks failure ratios within rolling time windows to trigger circuit state changes.
*   **Related Subsystem:** Backend Resiliency Gateways.

### 1.5 Tuition Calculation Accuracy
*   **Definition:** Programmatic fee calculations matching financial guidelines exactly.
*   **Where it appears:** `college-decision-system-backend/tests/test_fee_system_hardening.py`.
*   **Measurement Method:** Asserts that computed tuition matches preset values from historical student invoices.
*   **Related Subsystem:** FastAPI DSS microservice.
