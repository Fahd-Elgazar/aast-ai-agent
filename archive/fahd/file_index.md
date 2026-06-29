# FAD File Index

## Tier 1 — Core Runtime Architecture

### `orchestrator.js`
**Purpose**: The main backend server and API layer wrapper.
**Role**: Handles the request lifecycle, initialization of systems, system coordination, and pipeline management.
**Read Order**: 1
**Dependencies**: `brainRouter.js`, `conversationService.js`, routing files.

### `brainRouter.js`
**Purpose**: Core intelligence layer deciding how a query is fulfilled.
**Role**: Performs intent detection, route selection (RAG vs Graph vs Multi), and hybrid routing decisions.
**Read Order**: 2
**Dependencies**: `academicAliases.js`, `ragService.js`, `neo4jcontext.js`, `fusionService.js`.

### `neo4jcontext.js`
**Purpose**: Interface with the Neo4j Graph Database.
**Role**: Handles Knowledge Graph retrieval, querying structured academic facts, and ontology relationships.
**Read Order**: 3
**Dependencies**: Neo4j instance.

### `ragService.js`
**Purpose**: RAG orchestration and coordination layer.
**Role**: Delegates semantic search and vector retrieval to Python components.
**Read Order**: 4
**Dependencies**: Python RAG Engine (`phase3_retriever.py`).

### `fusionService.js`
**Purpose**: Merges structured and unstructured context.
**Role**: Fuses Knowledge Graph data with RAG context into a cohesive format for LLM consumption.
**Read Order**: 5
**Dependencies**: `neo4jcontext.js`, `ragService.js`.

### `unifiedAnswerService.js`
**Purpose**: The LLM context injection and generation engine.
**Role**: Conducts final context fusion and synthesizes the final grounded answer generation using the LLMs.
**Read Order**: 6
**Dependencies**: `geminiService.js`, `fusionService.js`, `responseFormatter.js`.

## Tier 2 — Conversation & Explainability

### `conversationService.js`
**Purpose**: Memory management and session persistence.
**Role**: Stores, updates, and fetches conversational context across interactions.
**Read Order**: 7
**Dependencies**: `persistenceLayer.js`.

### `conversationPriority.js`
**Purpose**: Conversation Intelligence Layer prior to routing.
**Role**: Manages follow-up query resolution, multi-intent handling, and context-aware routing preparation.
**Read Order**: 8
**Dependencies**: `conversationService.js`.

### `responseFormatter.js`
**Purpose**: Final response construction layer.
**Role**: Implements Explainability formatting, confidence formatting, source formatting, and final API shaping.
**Read Order**: 9
**Dependencies**: None

### `academicAliases.js`
**Purpose**: Semantic Understanding Layer utility.
**Role**: Academic entity normalization, alias resolution, and ontology category mapping.
**Read Order**: 10
**Dependencies**: None

## Tier 3 — Reliability & Recovery

### `modelFailoverManager.js`
**Purpose**: Monitors and handles AI model fallback strategies.
**Role**: Triggers circuit breakers if the primary LLM fails and falls back to a secondary local or cloud LLM.
**Read Order**: 11
**Dependencies**: `circuitStateManager.js`, `geminiService.js`.

### `circuitStateManager.js`
**Purpose**: Production Circuit Breaker state machine.
**Role**: Implements fault tolerance, recovery behavior, failover activation, and service resilience across 6 discrete states.
**Read Order**: 12
**Dependencies**: None

### `geminiService.js`
**Purpose**: Cloud LLM API driver.
**Role**: Invokes Gemini models for text generation tasks.
**Read Order**: 13
**Dependencies**: Google Generative AI SDK.

### `persistenceLayer.js`
**Purpose**: Disk/DB interaction wrapper for state memory.
**Role**: Ensures that user decisions and conversations are durably saved.
**Read Order**: 14
**Dependencies**: Filesystem/DB adapters.

## Python Retrieval Layer

### `app.py`
**Purpose**: FastAPI entry point for Python microservices.
**Role**: Handles incoming retrieval and RAG requests from the Node orchestrator.
**Read Order**: 15
**Dependencies**: `phase3_retriever.py`

### `phase3_retriever.py`
**Purpose**: Semantic search and vector retrieval.
**Role**: Connects to Qdrant to acquire semantic context based on embeddings.
**Read Order**: 16
**Dependencies**: Qdrant, sentence-transformers.

## Frontend Layer

### `App.tsx`
**Purpose**: React frontend application root.
**Role**: Handles frontend routing, state initialization, and component tree assembly.
**Read Order**: 17
**Dependencies**: React Router, Layouts.

### `backendService.ts`
**Purpose**: Frontend API wrapper.
**Role**: Acts as the interface between the frontend application and the backend orchestrator.
**Read Order**: 18
**Dependencies**: Axios/Fetch.

### `GraphView.tsx`
**Purpose**: Explainability UI.
**Role**: Renders the academic graph nodes and relationships visually.
**Read Order**: 19
**Dependencies**: React-force-graph or similar.

### `Dashboard.tsx`
**Purpose**: Main layout container.
**Role**: Wraps the chat interface and sidebars into a unified UI.
**Read Order**: 20
**Dependencies**: `GraphView.tsx`, Sidebar components.

## Infrastructure Layer

### `docker-compose.yml`
**Purpose**: Container orchestration specification.
**Role**: Defines the network, volumes, and deployment definitions for all services (Node, Python, Qdrant, Neo4j, Frontend).
**Read Order**: 21
**Dependencies**: Docker engine.
