# Project Novelty Discovery
**AAST AI Agent — Core Architectural Innovations Discovery**

This report identifies unique architectural combinations, potential innovation areas, and academic contribution candidates represented by the AAST AI Agent platform design.

---

## 1. Novel Component Combinations

### 1.1 Double-Grounding: GraphRAG + Traditional Vector RAG
*   **Combination Details:** The platform integrates structured entity relations (faculties, departments, and prerequisites in Neo4j) with unstructured bylaws text (in Qdrant) concurrently.
*   **Innovation Area:** Developing a hybrid grounding protocol that addresses both hierarchical structural contexts and raw policy lookups in a single advising loop.

### 1.2 Neuro-Symbolic advising: GraphRAG + Deterministic DSS
*   **Combination Details:** Feeds mathematical calculations (such as dynamic tuition rates and credit hours transfers from FastAPI DSS SQLite) alongside relational graphs (from Neo4j) to the LLM prompt context.
*   **Innovation Area:** Hybrid Neuro-Symbolic advising architectures, which use deterministic expert databases (DSS) to correct probabilistic LLM reasoning errors in advising.

### 1.3 Explainable Advising: Hybrid Contexts + D3 Interactive Mapping
*   **Combination Details:** Connects double-grounded RAG prompt responses with live graph pathway visuals rendered in the client interface.
*   **Innovation Area:** Visual Explainable AI (XAI) systems for student advisors, helping users map and audit LLM advice visually.

### 1.4 Resilient Edge: Gateway Circuit Breakers + Local Ollama Failover
*   **Combination Details:** Combines Node.js circuit breakers with local model hot-standby failovers (routing failed cloud API calls instantly to local Gemma/Ollama instances).
*   **Innovation Area:** Designing highly available, self-healing, locally-deployable advising portals for academic institutions with high privacy constraints.

---

## 2. Potential Academic Contributions
*   **Contribution 1:** A conceptual framework for a dual-grounding advising agent that integrates structured university regulations with unstructured text.
*   **Contribution 2:** An empirical evaluation of hybrid semantic routing, demonstrating how local heuristic routers optimize server costs and response times.
*   **Contribution 3:** A case study on explainable GraphRAG interfaces, detailing how visual relational maps improve advising outcomes.
