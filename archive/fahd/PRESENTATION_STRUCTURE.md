# Graduation Project Presentation Structure

This flow optimizes for a professional defense, introducing the problem, describing the innovative solution layer-by-layer, demonstrating it, and concluding with impact.

## 1. Problem Statement
**Objective**: Hook the audience by defining the current friction in academic advising.
**Key Talking Points**: Advising is manual, inconsistent, and overwhelmed by complex prerequisite chains and institutional knowledge.
**Suggested Diagram**: A frustrated student drowning in academic policy PDFs and scattered catalogs.
**Time**: 1 min

## 2. Existing Problems in Traditional Academic Advising
**Objective**: Detail why humans and traditional databases struggle.
**Key Talking Points**: Hard to compute impact of failing a prerequisite; advisors cannot memorize thousands of regulations; manual mapping is error-prone.
**Suggested Diagram**: Flowchart showing bottlenecks in human-led advising queues.
**Time**: 1.5 mins

## 3. Research Gap
**Objective**: Show why generic AI (like ChatGPT) fails here.
**Key Talking Points**: Standard LLMs hallucinate courses and policies; they lack structured institutional memory and real-time path validation.
**Suggested Diagram**: Generic LLM giving wrong prerequisites vs. reality.
**Time**: 1 min

## 4. Proposed Solution
**Objective**: Introduce the Explainable Hybrid GraphRAG Academic Advisor platform.
**Key Talking Points**: An AI agent combining the deterministic accuracy of a Knowledge Graph with the semantic reasoning of Retrieval-Augmented Generation.
**Suggested Diagram**: High-level Venn diagram of KG + RAG = Hybrid GraphRAG.
**Time**: 1 min

## 5. System Architecture
**Objective**: Provide a bird's-eye view of the technical implementation.
**Key Talking Points**: Microservices design, Node.js Orchestrator, Python RAG engine, React Frontend.
**Suggested Diagram**: Full System Container and Network Diagram.
**Time**: 2 mins

## 6. Service Orchestration Layer
**Objective**: Explain how requests are managed.
**Key Talking Points**: The `orchestrator.js` hub; request lifecycle; managing parallel sub-services without rigid "multi-agent" overhead.
**Suggested Diagram**: Central node (Orchestrator) with spokes connecting to other layers.
**Time**: 1.5 mins

## 7. Hybrid GraphRAG Approach
**Objective**: Dive into the core innovation.
**Key Talking Points**: Why Hybrid? KG gives absolute truth (prereqs), RAG gives context (syllabi, policies).
**Suggested Diagram**: Query splitting into KG path and Vector DB path, then merging.
**Time**: 2 mins

## 8. Intelligence Layer (Brain Router)
**Objective**: Explain the decision-making core.
**Key Talking Points**: Intent detection; how it decides if a query needs pure Graph, pure Vector, or Hybrid execution based on academic aliases.
**Suggested Diagram**: Decision tree originating from the Brain Router.
**Time**: 2 mins

## 9. Knowledge Layer
**Objective**: Show the structured brain.
**Key Talking Points**: Neo4j implementation; ontology mapping; strict prerequisite chain traversal.
**Suggested Diagram**: Sample Neo4j graph with Student -> enrolled_in -> Course -> requires -> Prerequisite.
**Time**: 1.5 mins

## 10. Retrieval Layer
**Objective**: Show the unstructured brain.
**Key Talking Points**: Python FastAPI microservice; Qdrant vector database; semantic context acquisition for policies.
**Suggested Diagram**: Text chunking, embedding, and vector space matching.
**Time**: 1.5 mins

## 11. Answer Generation Layer
**Objective**: How the context becomes an answer.
**Key Talking Points**: Context fusion; LLM synthesis (`geminiService.js`); ensuring grounded, hallucination-free output.
**Suggested Diagram**: Prompt template receiving [Graph Facts] + [RAG Chunks] -> Final Output.
**Time**: 1.5 mins

## 12. Memory Layer
**Objective**: Explain statefulness.
**Key Talking Points**: Follow-up query resolution; multi-intent tracking; persistence across sessions.
**Suggested Diagram**: Timeline showing User Query 1 -> Memory Update -> User Query 2 (Context Aware).
**Time**: 1.5 mins

## 13. Reliability and Failover
**Objective**: Prove enterprise readiness.
**Key Talking Points**: The Circuit Breaker state machine (6 states); automatic failover from primary cloud LLM to secondary models to guarantee uptime.
**Suggested Diagram**: State machine diagram (Closed -> Degraded -> Open -> Half-Open).
**Time**: 2 mins

## 14. Explainability
**Objective**: Show why users can trust the system.
**Key Talking Points**: Response formatting; surfacing confidence scores and exact source citations directly to the UI.
**Suggested Diagram**: UI mockup pointing out the "Sources" and "Confidence Score" panels alongside the Graph Visualizer.
**Time**: 2 mins

## 15. System Workflow
**Objective**: Walk through a complete query lifecycle.
**Key Talking Points**: Tying all previous layers together in a single rapid trace.
**Suggested Diagram**: Animated sequence diagram from User -> Orchestrator -> Brain -> KG/RAG -> Fusion -> Output.
**Time**: 2 mins

## 16. Demo Scenario
**Objective**: Prove it works live.
**Key Talking Points**: A complex scenario (e.g., "I failed Math 101, how does this affect my graduation in CS?").
**Suggested Diagram**: Live Demo or Video Recording.
**Time**: 4 mins

## 17. Results
**Objective**: Share metrics and validation.
**Key Talking Points**: Accuracy improvements over standard LLMs; response time latencies; successful failover demonstrations.
**Suggested Diagram**: Bar charts comparing Base LLM vs. Hybrid GraphRAG accuracy.
**Time**: 1 min

## 18. Contributions & Future Work
**Objective**: Conclude the defense.
**Key Talking Points**: Summary of technical achievements; future extensions (e.g., automated course registration, predictive failure analytics).
**Suggested Diagram**: Bulleted list.
**Time**: 1 min
