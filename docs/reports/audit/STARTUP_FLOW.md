# Startup and Request Flow: AAST Academic AI Agent

This document traces the complete request processing flow from user input on the frontend to the final response generation, mapping out how subsystems interact.

---

## 1. Request Execution Lifecycle

```
[ User Input ]
      │
      ▼
[ React Frontend UI ] ────(HTTP POST: query, session id)────► [ Express Orchestrator ] (Port 8004)
                                                                    │
                                                                    ├─► (Write Audit Log / Check Memory)
                                                                    │
                                                                    ▼
                                                            [ Router (Express) ]
                                                                    │
                                                                    ├─► chatbotRouter
                                                                    └─► decisionRouter
                                                                    │
                                                                    ▼
                                                           [ Brain Router (AI) ]
                                                                    │
                    ┌───────────────────────┼───────────────────────┼───────────────────────┐
                    ▼                       ▼                       ▼                       ▼
            [ Greeting Intent ]      [ GraphRAG (KG) ]       [ VectorRAG (RAG) ]      [ Decision Subsystem ]
                    │                       │                       │                       │
             (greetings.js)        (neo4jcontext.js)         (ragService.js)        (decisionService.js)
                    │                       │                       │                       │
                    │                (Query Neo4j DB)       (Query Port 8001)        (Query Port 8005)
                    │                       │                       │                       │
                    │                       │                       ▼                       ▼
                    │                       │                 [ Qdrant DB ]           [ SQLite dev.db ]
                    │                       │                       │                       │
                    └───────────────────────┼───────────────────────┴───────────────────────┘
                                            │
                                            ▼
                                [ Context Accumulator ]
                                            │
                                            ▼
                                [ Answer Synthesis Layer ] (unifiedAnswerService.js)
                                            │
                                            ▼
                               [ Model Failover Manager ]
                                            │
                                     (Query LLM Engine)
                                            │
                                    ┌───────┴───────┐
                                    ▼               ▼
                            [ Local Ollama ]   [ Cloud Gemini ]
                            (Port 11434)        (API Failover)
                                    │               │
                                    └───────┬───────┘
                                            │
                                            ▼
                                [ Conversational Humanizer ] (conversationalHumanizer.js)
                                            │
                                            ▼
                                [ Response Formatter ] (responseFormatter.js)
                                            │
                                            ▼
[ Rendered Chat Answer ] ◄──────────(JSON Response)─────────── [ Express Server Output ]
```

---

## 2. Step-by-Step Flow Trace

### Step 1: User Request
*   The student enters a question, e.g. *"I scored 82% in Thanawya Amma math track. What CCIT programs fit my score and budget?"*
*   The Vite React frontend dispatches an HTTP POST payload containing the query, `cid` (conversation session ID), and memory options to `/api/chatbot/query` on port 8004.

### Step 2: Backend Orchestrator Entry
*   Express processes the request. The Winston daemon (`logger.js`) records the incoming query.
*   Session history is loaded from disk (or memory cache) via `conversationService.js` to preserve context.

### Step 3: Semantic Routing
*   The query is passed to `brainRouter.js`.
*   The router matches the query against pre-defined rules in `config/goldenPathRegistry.js` (Golden Path check).
*   If no golden path matches, the router evaluates if the query is a light greeting (e.g. "hi"), a session command (e.g. "forget me"), or a domain query.
*   Domain queries are classified as `KG` (Graph Database structural questions), `RAG` (Vector policy questions), `DECISION` (profile analysis), or `HYBRID`.

### Step 4: Subsystem Execution & Context Harvesting
*   **GraphRAG (KG)**: `neo4jcontext.js` builds a parameterized Cypher query (e.g., seeking courses taught by a professor or program paths). It queries Neo4j Bolt port 7687 and accumulates the returned node/edge attributes.
*   **VectorRAG (RAG)**: `ragService.js` calls the Python RAG Retriever (`http://127.0.0.1:8001/search`). The retriever uses `BAAI/bge-m3` to embed the query and fetches matching policy chunks from the Qdrant database (port 6333).
*   **Decision System (DSS)**: If academic eligibility is queried, the orchestrator triggers `decisionService.js`. If the student profile is incomplete, it invokes Ollama to parse the user query for scores/budgets. Once complete, it calls the FastAPI decision service (`http://127.0.0.1:8005/api/v1/decisions/recommend`). The FastAPI DSS queries SQLite `dev.db` to match scores and tuition fees, returning a ranked recommendation list.

### Step 5: Answer Synthesis
*   All context (graph facts, vector policies, recommendation lists) is merged by `fusionService.js`.
*   `unifiedAnswerService.js` constructs the prompt template.
*   The prompt is sent to `modelFailoverManager.js`. It attempts to call local Ollama (`http://localhost:11434`) using the primary model `gemma4:e2b`.
*   If Ollama is overloaded (queue depth exceeded) or throws a timeout, the failover manager catches the exception and routes the prompt to the cloud Google Gemini API to ensure a response is generated.

### Step 6: Formatting & Delivery
*   The raw LLM output is passed to `conversationalHumanizer.js` which verifies that the answer is grounded in the retrieved facts and formats it as polite, professional prose.
*   `responseFormatter.js` strips malformed markdown and verifies link schemes.
*   The Express server returns a JSON payload. The client UI receives the payload and renders the markdown response.
