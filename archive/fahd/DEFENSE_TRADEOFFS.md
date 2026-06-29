# Engineering Tradeoffs (Defense Arsenal)

When professors attack your design, use these tradeoff justifications. Never claim your architecture is "perfect." Engineering is about choosing the right compromises.

## 1. Why Hybrid GraphRAG instead of pure RAG?
* **Decision**: Fusing Neo4j with Qdrant.
* **Alternatives**: Pure Vector RAG (Qdrant only).
* **Pros**: Graph provides absolute, deterministic truth for structured data (prerequisites). RAG provides semantic flexibility for unstructured data (policies).
* **Cons**: Massive increase in architectural complexity, latency, and maintenance overhead.
* **Defense Answer**: "Pure RAG suffers from semantic blending—it cannot reliably traverse a 5-deep prerequisite chain because vector proximity does not equal logical dependency. GraphRAG guarantees 100% accuracy on structural rules, while RAG handles the nuance."

## 2. Why Neo4j instead of a Relational Database (SQL)?
* **Decision**: Using a Graph Database for academic rules.
* **Alternatives**: PostgreSQL with recursive CTEs.
* **Pros**: Native traversal of complex N-deep relationships; highly visual mapping; flexible schema.
* **Cons**: Steeper learning curve; specialized query language (Cypher).
* **Defense Answer**: "Academic prerequisites are inherently graph-structured. Querying 'what courses are unlocked if I pass X' requires recursive JOINs in SQL which degrade exponentially in performance. Neo4j executes this in constant time."

## 3. Why Brain Router (Heuristics) instead of LLM Routing?
* **Decision**: Using regex and aliases (`academicAliases.js`) to route queries.
* **Alternatives**: Sending every query to an LLM to ask "Is this a graph or vector question?"
* **Pros**: Zero latency, zero cost, 100% deterministic routing.
* **Cons**: Brittle; cannot understand highly obfuscated edge cases.
* **Defense Answer**: "Using an LLM for routing adds 500ms-1s of latency and token costs before the query is even processed. For an academic advisor where intents are highly constrained (courses, policies, schedules), a heuristic rules engine provides a superior, instant UX."

## 4. Why Qdrant instead of Keyword Search (Elasticsearch)?
* **Decision**: Using vector embeddings for retrieval.
* **Alternatives**: BM25 keyword matching (Elasticsearch).
* **Pros**: Understands semantic intent ("failing a class" = "probation").
* **Cons**: Embedding generation adds latency and complexity.
* **Defense Answer**: "Students rarely use the exact vocabulary found in legal university policy documents. Keyword search fails when synonyms are used. Qdrant allows us to retrieve policies based on semantic meaning, drastically improving retrieval recall."

## 5. Why deterministic routing instead of always Hybrid?
* **Decision**: Brain Router can pick Graph-Only or RAG-Only instead of always querying both.
* **Alternatives**: Always query both Neo4j and Qdrant.
* **Pros**: Saves latency and context window space.
* **Cons**: Risk of missing context if intent is misclassified.
* **Defense Answer**: "Fusing irrelevant RAG context into a pure prerequisite question distracts the LLM and causes hallucinations. By isolating routes, we ensure the LLM only receives data relevant to the strict intent."

## 6. Why Gemini Primary and Ollama Fallback?
* **Decision**: Cloud LLM as primary, Local LLM as fallback.
* **Alternatives**: 100% Cloud or 100% Local.
* **Pros**: Cloud gives high reasoning capability and speed. Local gives 100% uptime and privacy.
* **Cons**: Maintaining two separate prompt schemas and handling model loading latency.
* **Defense Answer**: "University services require high reliability. Cloud APIs fail or rate-limit. Our Circuit Breaker guarantees that if Google goes down, the local Ollama instance keeps the advising center operational, prioritizing resilience over maximum reasoning capability."

## 7. Why Circuit Breaker?
* **Decision**: Implementing a 6-state failover system.
* **Alternatives**: Simple `try-catch` blocks.
* **Pros**: Prevents cascading failures and endless timeout loops.
* **Cons**: High implementation complexity.
* **Defense Answer**: "A simple try-catch forces the user to wait for a 10-second timeout on every single request when the primary is down. A Circuit Breaker 'opens' the circuit and fails fast, instantly routing to the fallback, ensuring a seamless user experience during an outage."

## 8. Why Conversation Memory?
* **Decision**: `conversationService.js` tracking multi-turn intent.
* **Alternatives**: Stateless requests where the user must repeat context.
* **Pros**: Natural human-like UX; supports follow-up questions ("What if I take it next semester?").
* **Cons**: Requires state management and persistent storage.
* **Defense Answer**: "Academic advising is inherently a dialogue, not a single search query. Without memory to resolve pronouns and implicit subjects, the user experience degrades to a glorified search bar."

## 9. Why Explainability Layer?
* **Decision**: Explicitly surfacing confidence scores and graph nodes to the UI.
* **Alternatives**: Just returning the LLM text.
* **Pros**: Builds trust; allows humans to verify AI claims.
* **Cons**: Requires complex metadata passing from backend to frontend.
* **Defense Answer**: "In an academic setting, a hallucinated prerequisite can delay graduation by a year. Trust is paramount. The explainability layer ensures the student can verify the exact catalog source, shifting the AI from a 'black box oracle' to a 'verifiable assistant.'"
