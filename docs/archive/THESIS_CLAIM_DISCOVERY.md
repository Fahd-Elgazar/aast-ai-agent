# Thesis Claim Discovery
**AAST AI Agent — Core Thesis Claims Discovery**

This report catalogs all major technical and architectural claims that will appear in the graduation project book, establishing the baseline for evidence mapping.

---

## 1. Discovered Thesis Claims

*   **Claim 1: GraphRAG Integration:** The system uses knowledge graphs to ground advising responses.
*   **Claim 2: Neo4j Usage:** Neo4j acts as the active graph database for structural relationships (faculties, departments, course prerequisites).
*   **Claim 3: Traditional Vector RAG:** A traditional passage retrieval pipeline handles unstructured policy manuals.
*   **Claim 4: Qdrant Usage:** Qdrant is the active vector database of the traditional RAG subsystem.
*   **Claim 5: Hybrid Context Fusion:** Structured relational data, unstructured policy passages, and DSS fee calculations are merged into a single optimized prompt context.
*   **Claim 6: Heuristic Intent Routing:** A local router classifies user queries dynamically to optimize server costs and response times.
*   **Claim 7: Decision Support System (DSS):** A dedicated Expert DSS microservice handles deterministic fee calculations and admissions criteria.
*   **Claim 8: Explainable AI (XAI):** The client interface visually maps relation paths from Neo4j to explain chatbot decisions.
*   **Claim 9: Resilient Circuit Breakers:** Event-loop circuit breakers protect Node Express gateway services from microservice timeouts.
*   **Claim 10: Model Failovers:** The backend transitions requests to local Ollama (Gemma) instances when cloud Gemini API limits are hit.
*   **Claim 11: Decoupled Microservices:** The application follows a clean, port-isolated multi-tier microservice architecture.
*   **Claim 12: React Frontend Dashboard:** An advisor dashboard client is fully operational.
*   **Claim 13: FastAPI Services:** Python FastAPI hosts the Decision Support System APIs.
*   **Claim 14: Evaluation & Benchmarking:** Benchmark testing suites evaluate latency, accuracy, and route correctness.
