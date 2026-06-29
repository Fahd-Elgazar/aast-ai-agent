# Explainable Hybrid GraphRAG Academic Advisor
## System Reading Order

This guide is designed to help a new engineer understand the entire platform in 2-3 hours by following a logical progression through the system's architecture and request flow.

### Stage 1: High-Level Architecture
**Goal**: Understand the physical deployment and application root.
- **`docker-compose.yml`**: Review the services running (Node backend, Python microservice, Neo4j, Qdrant, Frontend).
- **`App.tsx` & `Dashboard.tsx`**: Understand the primary user interface layout.

### Stage 2: Request Flow
**Goal**: Follow a user query as it enters the system.
- **`orchestrator.js`**: See how incoming API requests are received, parsed, and logged.
- **`backendService.ts`**: See how the frontend sends requests to the orchestrator.

### Stage 3: Routing Logic
**Goal**: Understand how the system decides what to do with a query.
- **`academicAliases.js`**: Look at how queries are normalized and terms resolved before routing.
- **`conversationPriority.js`**: Observe how multi-intent follow-ups are handled using conversation history.
- **`brainRouter.js`**: Study the intelligence layer that evaluates the query and routes it to the Knowledge Graph, RAG, or Hybrid paths.

### Stage 4: Knowledge Graph Layer
**Goal**: Understand structural academic knowledge retrieval.
- **`neo4jcontext.js`**: Learn how the platform queries Neo4j for structured data, facts, and prerequisites.

### Stage 5: RAG Layer
**Goal**: Understand unstructured semantic retrieval.
- **`ragService.js`**: Review how the Node orchestrator calls the Python RAG engine.
- **`app.py` & `phase3_retriever.py`**: Trace the request into the Python microservice and see how vector similarity search runs against Qdrant.

### Stage 6: LLM Synthesis Layer
**Goal**: See how data is combined and generated into an answer.
- **`fusionService.js`**: Observe how graph relationships and RAG documents are merged.
- **`unifiedAnswerService.js`**: Read how the prompt is constructed and sent to the LLM.
- **`geminiService.js`**: The driver connecting to the actual cloud LLM model.

### Stage 7: Explainability Layer
**Goal**: Understand how the answer is shaped for the user to trust it.
- **`responseFormatter.js`**: See how confidence scores, metadata, and citation sources are appended to the response payload.
- **`GraphView.tsx`**: See how the structured explanation is visualized on the frontend.

### Stage 8: Memory Layer
**Goal**: Learn how session state persists.
- **`conversationService.js`**: Review conversation context management.
- **`persistenceLayer.js`**: See where and how the memory is physically stored.

### Stage 9: Reliability and Failover Layer
**Goal**: Understand the fault-tolerance guarantees.
- **`circuitStateManager.js`**: Study the 6-state circuit breaker pattern logic.
- **`modelFailoverManager.js`**: Understand how the system catches LLM timeouts/errors and rolls over to secondary models safely.
