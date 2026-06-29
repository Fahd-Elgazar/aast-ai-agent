# Architecture Layer Mapping for Presentation

This document maps the graduation presentation layers directly to the physical codebase files located in the `FAD/src_files` directory.

## Layer 1: User Interface Layer
**Files**:
- `App.tsx`
- `Dashboard.tsx`
- `backendService.ts`

**Purpose**:
Provides the user-facing interaction layer. Handles rendering the chat window, sending HTTP requests to the backend, and managing client-side routing and visual state.

## Layer 2: Orchestration Layer
**Primary File**:
- `orchestrator.js`

**Responsibilities**:
- Request lifecycle management
- Subsystem initialization
- Broad system coordination and pipeline management

## Layer 3: Intelligence Layer
**Primary Files**:
- `brainRouter.js`
- `academicAliases.js`

**Responsibilities**:
- User intent detection
- Query normalization and ontology mapping
- Hybrid routing decisions (Graph vs. RAG vs. Hybrid)

## Layer 4: Knowledge Layer
**Primary Files**:
- `neo4jcontext.js`
- (Neo4j Graph Database Service)

**Responsibilities**:
- Knowledge Graph traversal
- Retrieval of structured academic facts (prerequisites, credits, degree requirements)
- Enforcement of ontology relationships

## Layer 5: Retrieval Layer
**Primary Files**:
- `ragService.js`
- `app.py`
- `phase3_retriever.py`
- (Qdrant Vector Database)

**Responsibilities**:
- Semantic similarity search
- Vector retrieval of unstructured documents (policies, syllabi)
- Context acquisition for non-deterministic queries

## Layer 6: Answer Generation Layer
**Primary Files**:
- `unifiedAnswerService.js`
- `fusionService.js`
- `geminiService.js`

**Responsibilities**:
- Fusing structured KG data with unstructured RAG text
- Synthesizing the final grounded answer via LLM
- Mitigating hallucination through strict context injection

## Supporting Layer A: Memory Layer
**Files**:
- `conversationService.js`
- `conversationPriority.js`
- `persistenceLayer.js`

**Responsibilities**:
- Resolving follow-up queries
- Handling multi-intent conversations
- Maintaining durable session state

## Supporting Layer B: Reliability Layer
**Files**:
- `circuitStateManager.js`
- `modelFailoverManager.js`

**Responsibilities**:
- Guaranteeing fault tolerance via the Circuit Breaker pattern
- Triggering automatic model failover upon degradation or failure
- Service resilience and self-healing mechanisms

## Supporting Layer C: Explainability Layer
**Files**:
- `responseFormatter.js`
- `GraphView.tsx`

**Responsibilities**:
- Final API response shaping with sources and confidence scores
- Visual rendering of the retrieved graph context in the UI
- Ensuring the AI's reasoning is transparent to the user
