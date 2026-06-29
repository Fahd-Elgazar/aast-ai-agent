# Literature Review Discovery
**AAST AI Agent — Academic Research & Concepts Mapping**

This report lists the core AI methods, architectures, algorithms, and frameworks used in the project, mapping their implementations to source code and documentation, and outlining academic references and search keywords required for compilation.

---

## 1. Discovered Research Topics

### 1.1 GraphRAG & Knowledge Graph Grounding
*   **Code Locations:** `aast-ai-agent-main/backend/services/neo4jcontext.js`, `db/neo4j.js`
*   **Documentation Locations:** `docs/architecture/MASTER_TECHNICAL_DOCUMENTATION.md`, `docs/reverse_engineering/07_neo4j_engine.md`
*   **Importance:** Resolves relational fact retrieval (e.g., department hierarchies, course prerequisites) by mapping Cypher-queries to structured graph nodes. This prevents the typical hallucinations associated with purely vector-based text retrievers.
*   **Requires Academic References:** Yes.
*   **Suggested Search Keywords:** "Knowledge Graph grounding LLMs", "GraphRAG architectures", "graph database retrieval augmented generation", "Cypher query generation LLMs".

### 1.2 Traditional Retrieval-Augmented Generation & Vector Databases
*   **Code Locations:** `aast-ai-agent-main/backend/services/ragService.js`, `rag_system/phase3_retriever.py`, `rag_system/phase4_llm_answer_engine.py`
*   **Documentation Locations:** `docs/reverse_engineering/06_rag_engine.md`
*   **Importance:** Indexes unstructured document directories (rules, regulations, CAI manuals) using semantic embeddings, enabling fast cosine-similarity chunk lookup.
*   **Requires Academic References:** Yes.
*   **Suggested Search Keywords:** "Vector database similarity search", "dense passage retrieval", "Qdrant vector embeddings", "unstructured text grounding".

### 1.3 Context Fusion & Hybrid RAG Aggregation
*   **Code Locations:** `aast-ai-agent-main/backend/services/fusionService.js`, `services/unifiedAnswerService.js`
*   **Documentation Locations:** `docs/reverse_engineering/11_unified_answer_service.md`
*   **Importance:** Merges heterogeneous data outputs (structured Neo4j lists, unstructured Qdrant vectors, and DSS rule calculations) into a single optimized prompt context before sending it to the LLM.
*   **Requires Academic References:** Yes.
*   **Suggested Search Keywords:** "hybrid RAG context fusion", "multi-source prompt context augmentation", "prompt engineering context aggregation", "information retrieval fusion".

### 1.4 Agentic Intent Classification & Semantic Routing
*   **Code Locations:** `aast-ai-agent-main/backend/services/brainRouter.js`, `config/goldenPathRegistry.js`
*   **Documentation Locations:** `docs/reverse_engineering/05_brain_router.md`
*   **Importance:** Classifies query intents dynamically on startup using heuristics and routing rules, directing tasks to specialized processing pathways (DSS rule engines, GraphRAG queries, or casual chat loops) to save latency and cost.
*   **Requires Academic References:** Yes.
*   **Suggested Search Keywords:** "semantic query routing", "agentic intent classification", "large language model routers", "heuristics in multi-agent routing".

### 1.5 Decision Support Systems (DSS) & Automated Rule Engines
*   **Code Locations:** `college-decision-system-backend/app/` (APIs, repositories, use cases)
*   **Documentation Locations:** `docs/reverse_engineering/08_decision_engine.md`, `08b_business_rules.md`
*   **Importance:** Computes deterministic criteria (admission points, GPA scoring, credit transfer maps, tuition pricing) where probabilistic LLMs are prone to arithmetic errors.
*   **Requires Academic References:** Yes.
*   **Suggested Search Keywords:** "knowledge-based decision support systems", "automated rule engines in higher education", "hybrid neuro-symbolic AI systems", "rules-based calculations in advising".

### 1.6 Explainable AI (XAI) & Interactive Graph Visualizations
*   **Code Locations:** `aast-ai-agent-main/frontend/src/components/GraphVisualizer.tsx` (D3/Three.js module)
*   **Documentation Locations:** `docs/diagrams/diagram.md`, `docs/diagrams/AAST_AI_Agent_Sequence_Diagrams.md`
*   **Importance:** Visually plots graph nodes and relations directly in the frontend advisor client, helping administrators verify recommendation pathways.
*   **Requires Academic References:** Yes.
*   **Suggested Search Keywords:** "explainable AI using knowledge graphs", "visual interface for graph databases", "D3 graph visualization usability", "cognitive mapping in academic advising".

### 1.7 Microservice Fault Tolerance & Circuit Breakers
*   **Code Locations:** `aast-ai-agent-main/backend/services/circuitStateManager.js`, `services/modelFailoverManager.js`
*   **Documentation Locations:** `docs/reverse_engineering/15_failover_system.md`, `16_circuit_breaker.md`
*   **Importance:** Isolates failing cloud components (e.g. Gemini rate limits) or database timeouts using state machines, immediately routing requests to fallback components (local Ollama/Gemma) to prevent system-wide lockups.
*   **Requires Academic References:** Yes.
*   **Suggested Search Keywords:** "circuit breaker pattern in microservices", "distributed model failovers", "resilience in large language model pipelines", "fault-tolerant AI gateway architectures".
