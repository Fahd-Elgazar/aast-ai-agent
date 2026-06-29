# Mandatory Defense Diagrams

To survive the defense, these 6 diagrams must be visually presented and technically accurate.

## Diagram 1: System Architecture Overview
**Type**: Deployment / Component Diagram
**Flow**:
```
User -> [Frontend UI (React)]
        |
        v
    [Nginx/Gateway]
        |
        v
[Node.js Orchestrator] -> [Memory (persistenceLayer)]
        |
[Brain Router]
   /        \
  v          v
[Neo4j]   [Python RAG API] -> [Qdrant]
  \          /
   v        v
[Fusion Service]
        |
[Unified Answer Service] -> [Primary LLM (Gemini)]
                            [Fallback LLM (Ollama)]
        |
[Explainability Formatter]
        |
        v
      User
```

## Diagram 2: Data Ingestion Architecture
**Type**: Data Flow Diagram
**Flow**:
```
[Raw Catalogs] -> (phase1_data_refiner.py) -> [Clean JSON] -> (Embedding Model) -> [Qdrant DB]

[Raw Prereq DB] -> (ETL Scripts) -> [Cypher Queries] -> [Neo4j Graph DB]
```

## Diagram 3: Brain Router Decision Tree
**Type**: Logical Flowchart
**Flow**:
```
[User Query] -> (Intent Detection via academicAliases.js)
                      |
        +-------------+-------------+-------------+
        |             |             |             |
   [Graph Intent] [RAG Intent] [Hybrid Intent] [Chat Intent]
        |             |             |             |
   (Neo4j Only) (Qdrant Only)  (Parallel Query) (LLM Only)
```

## Diagram 4: Hybrid Retrieval & Fusion
**Type**: Sequence / Data Transformation Diagram
**Flow**:
```
[Neo4j Facts: Course A requires B]     [Qdrant Context: Policy says B can be waived]
               \                                     /
                +--------> [Fusion Service] <--------+
                                |
                   (Conflict Resolution / Formatting)
                                |
             [Unified Context JSON Payload]
                                |
                [Unified Answer Service (LLM)]
                                |
             [Grounded Response with Citations]
```

## Diagram 5: Circuit Breaker State Machine
**Type**: State Diagram
**States & Transitions**:
- **CLOSED**: Normal operation. Routes to Gemini. (If failure count > threshold -> OPEN).
- **OPEN**: Primary is down. Fails fast. (After timeout -> HALF_OPEN).
- **HALF_OPEN**: Testing primary with 1 request. (If success -> CLOSED. If fail -> OPEN).
- **DEGRADED**: Primary is slow but working. Routes to Gemini but warns.
- **WAITING_FOR_OLLAMA**: Primary failed, secondary is spinning up.
- **PRIMARY_COLD**: Initial state before health checks.

## Diagram 6: End-to-End Sequence Diagram
**Type**: UML Sequence Diagram
**Flow**:
1. `User` sends message to `Frontend`.
2. `Frontend` posts to `Backend (Orchestrator)`.
3. `Orchestrator` fetches session from `Memory`.
4. `Orchestrator` calls `Brain Router`.
5. `Brain Router` calls `Neo4j` and `Qdrant` concurrently.
6. `Neo4j` returns nodes. `Qdrant` returns vectors.
7. `Fusion Service` merges data.
8. `Unified Answer Service` prompts `Gemini`.
9. `Gemini` streams response.
10. `Response Formatter` appends sources.
11. `Frontend` visualizes Graph and renders text.
