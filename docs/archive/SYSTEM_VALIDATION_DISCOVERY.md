# System Validation Discovery
**AAST AI Agent — Platform Diagnostic and Validation Assets**

This report lists the diagnostic metrics, validation suites, and integration tests confirming the stability of the platform.

---

## 1. Discovered Validation Evidence

### 1.1 Health Probes & Endpoint Checking
*   **Path:** `aast-ai-agent-main/backend/routes/health.js`, `services/healthProbes.js`
*   **Purpose:** Exposes endpoints checking connectivity to Neo4j, traditional RAG APIs, and DSS instances, ensuring failovers are triggered when services go offline.

### 1.2 Frontend-Backend Contract Testing
*   **Path:** `aast-ai-agent-main/backend/testing/frontendContractTest.js`
*   **Purpose:** Verifies that Express gateway JSON response structures match the expectations of the React frontend, preventing UI crashes from data structure updates.

### 1.3 Decision Support System Constraints Validation
*   **Path:** `college-decision-system-backend/tests/test_database_integrity.py`
*   **Purpose:** Ensures relational integrity constraints, foreign key mappings, and credit-hour criteria match DSS settings on startup.

### 1.4 GraphRAG Schema Consistency
*   **Path:** `docs/reports/graph_metrics_phase4b.md`
*   **Purpose:** Verifies that Neo4j database node counts and faculty/course relations follow the defined Cypher schema.

### 1.5 Circuit Breaker Resilience Validation
*   **Path:** `aast-ai-agent-main/backend/testing/failureSimulation.js`
*   **Purpose:** Simulates database dropouts and API timeouts, verifying that Express circuit state machines successfully transition to "Open" and "Half-Open" states to protect system integrity.
