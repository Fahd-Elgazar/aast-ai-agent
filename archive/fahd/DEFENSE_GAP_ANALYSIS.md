# Defense Gap Analysis

This document identifies the critical architectural weaknesses, missing layers, and presentation vulnerabilities in the original FAD package. 

## 1. Missing Architectural Layers
- **Data Ingestion Layer**: The system magically queries Qdrant and Neo4j without explaining how data gets there. This is a fatal gap. Without `phase1_data_refiner.py` and `phase2_qdrant_ingestion.py`, the system is a black box.
- **API Gateway/Ingress Layer**: There is no mention of Nginx or load balancing. In a production system, an Orchestrator should not be directly exposed to the internet.

## 2. Missing Runtime Explanations
- **Conflict Resolution (The Hybrid Problem)**: `fusionService.js` merges Graph facts and RAG context, but there is no explicit documentation on *how* conflicts are resolved if Neo4j contradicts Qdrant. Professors will attack this.
- **Database Connection Pooling**: Querying Neo4j via `neo4jcontext.js` without explaining `db/neo4j.js` session management leaves the system open to attacks on concurrency and connection exhaustion.

## 3. Missing Engineering Tradeoffs
- **Heuristic Routing vs. LLM Routing**: `brainRouter.js` relies on `academicAliases.js` (Regex/Rules) instead of an LLM. While faster and cheaper, it is rigid. This tradeoff (Speed/Cost vs. Flexibility) was not defended.
- **Stateful vs. Stateless Memory**: `persistenceLayer.js` and `conversationService.js` imply stateful memory. If this is stored locally, it prevents horizontal scaling of the Orchestrator. 

## 4. Missing Reliability Discussions
- **Data Staleness**: The Circuit Breaker handles LLM API failures, but what handles Neo4j/Qdrant connection failures? The presentation assumed the databases are perfectly reliable.

## 5. Missing Scalability Discussions
- **Vector Search Bottlenecks**: As the Qdrant database grows, how does semantic search latency scale?
- **Orchestrator Concurrency**: Node.js is single-threaded. Making parallel calls to Python and Neo4j is non-blocking, but heavy JSON parsing in `fusionService.js` could block the event loop.

## 6. Missing Explainability Discussions
- **Confidence Score Provenance**: `responseFormatter.js` provides a confidence score, but how is that score mathematically derived? Is it the Qdrant cosine similarity, or an LLM logit, or a heuristic? If you cannot explain the math behind the confidence score, the explainability layer is a facade.

## 7. Missing Data Lifecycle Discussions
- **Ontology Updates**: When a new major is added, does the Neo4j graph update automatically?
- **Vector Invalidation**: When a policy changes, how do you delete the old vectors from Qdrant?
