# AAST_AGENT_SYSTEM_DOCS.md

## Project Overview
The AAST AI Agent is a full-stack application designed to provide an intelligent chatbot and graph visualization interface for AAST University data. It integrates Neo4j graph database, Meilisearch for vector search, ChromaDB for RAG, and Ollama for LLM inference, with a React frontend using D3.js for visualizations. The architecture is hybrid, combining Node.js for orchestration, Python FastAPI services for AI/ML tasks, and multiple databases for data persistence and retrieval.

## 1. Core Infrastructure Audit

### Data Layer
- **Neo4j Database**: Primary graph database using dumps (`neo4j-data-new.dump`, etc.) for university knowledge graph. Nodes represent entities like Courses, Students, Colleges; relationships model connections (e.g., HAS_ADMIN, ENROLLED_IN).
- **Connection Details**: `backend/db/neo4j.js` uses neo4j-driver to connect via Bolt protocol to `bolt://localhost:7687`, targeting database `neo4j-data-new`. Environment variables control credentials; defaults include user "neo4j" and password "password" (security risk).
- **Session Management**: `getSession()` creates sessions with forced database selection. Supports vector indexing via `node_embedding_index` for similarity search.
- **MySQL Integration**: `backend/db/mysql.js` (not read, but referenced) handles relational data, e.g., user authentication. Schema in `schema.js` defines `users` table with id, username, password, role.

### Search & Vector
- **Meilisearch**: Full-text search engine with data in `backend/data.ms` (auth/, tasks/, etc.). `backend/db/meili.js` connects via host env var, optional API key. Used for indexing university documents/content.
- **ChromaDB**: Vector database for RAG pipeline, running on localhost:8001. `ragService.js` queries for semantic retrieval of documents with scores.
- **Embedding Services**: `embed_server.py` (FastAPI) generates embeddings using SentenceTransformer (BAAI/bge-m3). `embed_nodes.py` preprocesses Neo4j nodes into embeddings stored in graph.

### Hybrid Backend
- **Node.js Main Server**: `backend/index.js` runs Express server on port 5000 (mode-dependent: neo=5001, sql=5000, meili=5002). Modes isolate services: Neo4j for graph, MySQL for auth, Meili for search.
- **Orchestrator Service**: `orchestrator.js` (port 8000) handles advanced AI workflows: intent classification, entity extraction, context aggregation from multiple sources.
- **Python Microservices**:
  - `ner_service.py`: FastAPI on port 8001 (conflicts with ChromaDB?), extracts entities from queries by matching against Neo4j entities.
  - `embed_server.py`: FastAPI for embedding generation.
- **Dependencies**: Backend uses chromadb, meilisearch, neo4j-driver, axios for HTTP calls. Frontend: React 19, D3.js for graphs, TailwindCSS for styling.
- **Interaction**: Node.js routes handle HTTP, delegate AI tasks to Python via HTTP (e.g., fetch to localhost:8001 for embeddings/NER). Orchestrator integrates Ollama (localhost:11434) for LLM.

## 2. RAG & AI Pipeline

### Context Retrieval
- **ragService.js**: ChromaDB client queries vector DB for top-k documents based on query embedding, returning doc, distance, metadata.
- **ollamaService.js**: Direct API calls to Ollama for text generation using "llama3.2:3b-instruct-q4_K_M".
- **Graph Context**: `services/neo4jcontext.js` performs vector similarity search on Neo4j's `node_embedding_index`, filters by intent (e.g., DEAN, PREREQUISITE), expands relations, humanizes triples (e.g., "Person is administrator of College").
- **FAQ & Greetings**: `faqService.js` searches static `data/faq.json` by keywords/tags. `greetings.js` detects simple greetings for canned responses.

### Data Preparation
- **embed_nodes.py**: Loads Neo4j nodes, builds context strings from labels/properties, embeds via Ollama "nomic-embed-text", batches writes to Neo4j.
- **Entity Loading**: `ner_service.py` preloads entities from Neo4j for partial matching.

### Pipeline Flow
1. Query received via `/api/chatbot/query` (legacy) or orchestrator.
2. Greeting/FAQ check for quick responses.
3. Intent extraction: Ollama classifies query (e.g., "DEAN").
4. Entity extraction: Python service matches query words to graph entities.
5. Context aggregation: Neo4j vector search + relations + ChromaDB docs.
6. LLM generation: Ollama prompted with context, rules (only use provided info, no invention).
7. Response with text and optional graph update (nodes/links).

## 3. Frontend & User Flow

### Backend Communication
- **fakeAdvisor.ts**: Primary service for advisor queries, posts to `/api/chatbot/query` with query and conversation ID (cid). Returns responseText.
- **backendService.ts**: Defined but unused in current flow; designed for `/graph/ask` with graph updates, expects text and graph (nodes/links).
- **Routes**:
  - `routes/chatbot.js`: Legacy `/query` endpoint, logs to `logs/chat.log`, returns static "Backend received" (placeholder).
  - `routes/graph.js`: Graph endpoints: `/courses`, `/student/:id`, `/entity` (multi-entity expansion), debug routes.
  - No `/ask` endpoint implemented, breaking intended flow.

### Graph Visualization
- **GraphVisualizer.tsx**: D3.js force-directed graph with nodes (circles: gold for group 1, blue variants), links with glow filters. Supports drag, collision detection. Data: nodes with id/label/group, links with source/target/value.

### App Flow
- **App.tsx**: Authentication: student login (full dashboard) or guest (advisor only). Uses localStorage for token.
- **Dashboard.tsx**: Tabs (HOME, ADVISOR, COURSES, RESULTS). Chat interface with messages, input. Uses `sendMessageToAdvisor` for queries, updates graph on response.
- **GuestAdvisorPage.tsx**: Simplified layout for guests, embeds AdvisorPage (assumed similar to dashboard chat).
- **Types**: Interfaces for User (name/major/id/avatar), ChatMessage (id/role/text/timestamp/hasGraph), GraphData (nodes/links/cypherQuery).

## 4. Quality & Security Check

### Issues Identified
- **Missing Endpoint**: `/graph/ask` in `backendService.ts` not implemented; current flow uses legacy `/api/chatbot/query` without graph updates.
- **Hardcoded Credentials**: Neo4j defaults "neo4j"/"password"; Meili API key optional but empty default.
- **Service Conflicts**: ChromaDB and NER service both on port 8001.
- **Incomplete Integration**: Orchestrator.js advanced logic not connected to main server; multiple entry points.
- **Error Handling**: Basic try-catch; no retries, logging inconsistent.
- **Unused Code**: backendService.ts not used; AdvisorPage.tsx missing?
- **Security**: No input validation, potential injection in Cypher queries.

### Recommendations
- Implement `/graph/ask` integrating orchestrator logic.
- Resolve port conflicts (e.g., move NER to 8002).
- Enforce env vars, remove defaults.
- Add input sanitization, rate limiting.
- Consolidate to single backend, use backendService.ts.
- Add tests for services, e2e for flows.

## Data Flow: User Query to AI Response

1. **User Input**: Query in Dashboard.tsx or GuestAdvisorPage.tsx chat input.
2. **API Call**: `sendMessageToAdvisor()` posts to `http://localhost:5000/api/chatbot/query` with query and cid.
3. **Backend Processing**: (Legacy route) logs query, returns static response. (Intended: orchestrator.js logic)
   - Greeting/FAQ check.
   - Intent via Ollama.
   - Entities via Python NER.
   - Context: Neo4j vector + relations + ChromaDB.
   - LLM with context.
4. **Response**: responseText (and graphUpdate if implemented).
5. **UI Update**: Message added to chat, graph updated if hasGraph.