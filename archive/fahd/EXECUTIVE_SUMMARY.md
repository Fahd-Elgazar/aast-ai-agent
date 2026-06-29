# Executive Summary: Explainable Hybrid GraphRAG Academic Advisor

The Explainable Hybrid GraphRAG Academic Advisor is an advanced, resilient AI platform designed to replace manual academic advising by combining the deterministic accuracy of a Knowledge Graph with the semantic understanding of Retrieval-Augmented Generation (RAG).

## Top 10 Most Important Files
1. **`orchestrator.js`**: The system hub that receives and manages all request lifecycles.
2. **`brainRouter.js`**: The intelligence engine that decides how to fulfill a query.
3. **`neo4jcontext.js`**: The structured data bridge for traversing academic prerequisite chains.
4. **`ragService.js`**: The unstructured data bridge for fetching academic policies.
5. **`phase3_retriever.py`**: The Python vector search engine querying Qdrant.
6. **`fusionService.js`**: The crucial layer where Graph facts and RAG context merge.
7. **`unifiedAnswerService.js`**: The LLM engine that writes the final grounded response.
8. **`circuitStateManager.js`**: The 6-state circuit breaker ensuring absolute reliability.
9. **`conversationPriority.js`**: The memory layer enabling context-aware follow-up queries.
10. **`responseFormatter.js`**: The explainability layer exposing confidence scores and citations.

## Top 10 Most Important Services
1. **Service Orchestration**: Coordinating API lifecycle and system health.
2. **Brain Routing**: Classifying intent and selecting data pathways.
3. **Knowledge Graph Retrieval (Neo4j)**: Fetching absolute truths and constraints.
4. **Semantic Retrieval (Qdrant)**: Finding relevant unstructured policies.
5. **Context Fusion**: Synthesizing dual-source data structures.
6. **LLM Synthesis (Gemini)**: Generating natural language output.
7. **Circuit Breaker State Management**: Handling fault tolerance natively.
8. **Model Failover**: Rolling over to secondary LLMs upon failure.
9. **Conversation Memory**: Resolving pronouns and ongoing context.
10. **Response Formatting**: Shaping metadata for the Explainable UI.

## Complete Request Flow
1. **User Input**: A student asks a question via the React Frontend (`App.tsx` -> `backendService.ts`).
2. **Orchestration**: The request hits the Node backend (`orchestrator.js`).
3. **Memory Prep**: The query is merged with past session context to resolve intents (`conversationPriority.js`).
4. **Routing**: The `brainRouter.js` analyzes the normalized query and selects a path (e.g., Hybrid).
5. **Parallel Retrieval**:
   - The system queries Neo4j for structured graphs (`neo4jcontext.js`).
   - The system calls the Python microservice to query Qdrant vectors (`ragService.js` -> `phase3_retriever.py`).
6. **Fusion**: Retrieved facts and text are merged into a unified prompt block (`fusionService.js`).
7. **Synthesis**: The primary LLM receives the prompt and generates a grounded answer (`unifiedAnswerService.js` / `geminiService.js`).
   - *Failover check*: If the primary LLM fails, the Circuit Breaker (`circuitStateManager.js`) triggers the Failover Manager to use a secondary model.
8. **Explainability Processing**: The raw answer is appended with source citations, node data, and confidence metrics (`responseFormatter.js`).
9. **Output**: The formatted JSON is sent back to the frontend, where `Dashboard.tsx` and `GraphView.tsx` render the answer alongside visual proof.

## System Architecture Summary
The platform employs a microservices architecture. A Node.js backend acts as the Orchestrator and Brain Router, communicating with a Neo4j Graph Database for structured knowledge and a Python/FastAPI microservice for unstructured RAG using Qdrant. A React frontend provides an Explainable UI, exposing the system's reasoning via interactive graph visualizations. The platform is highly resilient, featuring a robust 6-state Circuit Breaker and automated LLM failover.

## Recommended Presentation Order
1. Problem & Gap Analysis
2. Proposed Hybrid GraphRAG Solution
3. Layer-by-Layer Architecture Walkthrough
4. The Circuit Breaker / Reliability Guarantee
5. Explainable AI Principles
6. Demo & Results

## Recommended Demo Order
1. **Simple RAG Query**: Ask a policy question (e.g., "What is the probation policy?") to show vector retrieval and source citation.
2. **Simple Graph Query**: Ask a structural question (e.g., "What are the prerequisites for Data Structures?") to show Neo4j graph visualization.
3. **Complex Hybrid Query**: Ask an overlapping question (e.g., "I failed Math 101, how does this affect my academic standing and prerequisites?") to show the Brain Router fusing RAG and Graph data.
4. **Memory Follow-up**: Ask "What if I take it next semester instead?" to prove `conversationPriority.js` works.
5. **Explainability Showcase**: Highlight the citations and the visual graph to demonstrate how a student can "trust" the answer.
