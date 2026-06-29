# Related Work Discovery
**AAST AI Agent — Academic Context and Comparison Candidates**

This document identifies the primary research areas represented by the AAST AI Agent platform, outlines candidate categories for comparison, and maps potential evaluation metrics for academic review.

---

## 1. Discovered Research Areas & Comparison Categories

### 1.1 Research Area: GraphRAG & Knowledge Graph QA
*   **Purpose in Project:** Relational fact retrieval (departments, course constraints) using Cypher mappings.
*   **Potential Comparison Categories:**
    *   Microsoft GraphRAG (global/local text summarizations on graphs).
    *   Text-to-Cypher systems (Neo4j semantic wrappers).
    *   Hybrid Graph-augmented LLM architectures.
    *   Knowledge Graph Question Answering (KGQA) benchmarks.

### 1.2 Research Area: Traditional Vector RAG
*   **Purpose in Project:** Semantic search over CAI unstructured policy documents.
*   **Potential Comparison Categories:**
    *   Standard Vector RAG frameworks (LlamaIndex / LangChain document retrievers).
    *   Qdrant/Pinecone dense passage vector indexers.
    *   Single-source context window prompt augmentation.

### 1.3 Research Area: Hybrid Retrieval & Context Fusion
*   **Purpose in Project:** Merging unstructured vectors, structured graph relationships, and DSS calculations.
*   **Potential Comparison Categories:**
    *   Multi-source hybrid retrievers (LangChain Hybrid Search).
    *   Reciprocal Rank Fusion (RRF) algorithms.
    *   Heterogeneous prompt context consolidators.

### 1.4 Research Area: Agentic Intent Routing
*   **Purpose in Project:** Categorizing queries to direct tasks to specialized backend adapters.
*   **Potential Comparison Categories:**
    *   Open-source semantic routing packages (e.g., Semantic Router).
    *   LangChain Router Chain / LLM-based prompt classifiers.
    *   Heuristic and rule-based query classifiers.

### 1.5 Research Area: Advising Decision Support Systems (DSS)
*   **Purpose in Project:** Rules-based tuition calculations, GPA tracking, and course transfers.
*   **Potential Comparison Categories:**
    *   Classic Academic Decision Support Systems (ADSS).
    *   Rules-based expert advising systems.
    *   Educational recommender pipelines.

### 1.6 Research Area: Fault-Tolerant AI Gateways
*   **Purpose in Project:** Model failover routines (Gemini to Ollama) and circuit breaker protection filters.
*   **Potential Comparison Categories:**
    *   Microservice resiliency patterns (Netflix Hystrix, Polly).
    *   Self-healing LLM gateways.
    *   Fault-tolerant distributed AI orchestration layers.

---

## 2. Evaluation Metrics Matrix

The following table maps discovered research areas to possible benchmarking dimensions for comparison:

| Research Area | Potential Comparison Metrics | Reason for Metric Choice |
| :--- | :--- | :--- |
| **GraphRAG & KGQA** | Cypher parsing accuracy, Retrieval latency, Hallucination rate | Measures correctness of relationship mapping and database load speed. |
| **Traditional RAG** | Retrieval recall/precision, Context window size, Storage overhead | Evaluates text chunk accuracy and index file footprint. |
| **Context Fusion** | Context compilation speed, Prompt token count, Event-loop blocking | Evaluates performance overhead of merging multiple inputs. |
| **Intent Routing** | Routing precision, Router classification latency, Cost savings | Verifies router accuracy and API token cost optimization. |
| **Advising DSS** | Calculation accuracy, Course transfer relevance, Database lock rate | Assesses mathematical logic stability and credit recommendation utility. |
| **Resilient Gateways** | Service recovery timing, Fault-tolerance rate, Failover lag | Measures platform uptime and transition delay under rate limits. |
