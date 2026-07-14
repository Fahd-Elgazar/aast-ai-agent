# LinkedIn Caption Draft

I built my graduation project around one question:

How can an academic AI assistant answer students with evidence, not guesses?

My project is an Explainable Hybrid GraphRAG Academic Platform, implemented as the AAST AI Academic Advisor.

The system combines:

- A Node.js orchestration layer with an explicit Brain Router
- Neo4j for academic graph facts and relationships
- Qdrant with BAAI/bge-m3 retrieval for policy evidence
- A FastAPI Decision Support Engine for program recommendations
- Persistent conversation memory for follow-up questions
- Gemma through Ollama for synthesis, with Gemini backup and deterministic fallback paths

The core idea is simple: not every question should use the same retrieval path.

The Brain Router decides whether a query needs graph facts, policy retrieval, both together, decision support, FAQ handling, or fallback synthesis. The final answer layer then uses only verified context and returns source-aware fields such as used facts, graph payloads, and missing information.

#GraphRAG #RAG #KnowledgeGraph #Neo4j #Qdrant #FastAPI #NodeJS #AcademicAI #GraduationProject #ExplainableAI
