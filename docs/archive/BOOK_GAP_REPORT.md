# Book Gap Report
**AAST AI Agent — Graduation Project Book Content Gaps**

This report identifies the missing academic, research, and engineering sections in the repository's documentation that must be written before finalizing the graduation project book.

---

## 1. Missing Content & Research Gaps

### 1.1 Academic Literature Review
*   *Gap:* No formal literature review analyzing GraphRAG architectures vs. traditional Vector RAG models, intent classification algorithms, or decision support algorithms.
*   *Required Content:* A dedicated chapter surveying recent research papers on knowledge graph grounding, hybrid semantic routing, and failover designs.

### 1.2 Formal Citations & Bibliography
*   *Gap:* Academic references (Neo4j drivers, Qdrant client, Gemini APIs, FastAPI frameworks, and LLaVA/Gemma models) are discussed informally but lack standard academic citations (e.g., IEEE/APA style) and a bibliography section.
*   *Required Content:* Compile a structured list of academic references and citations for the graduation project book.

### 1.3 Feasibility, Sustainability, & Business Model
*   *Gap:* The documentation covers technical execution but lacks graduation project chapters analyzing feasibility, deployment costing, user personas, sustainability, and market applicability.
*   *Required Content:* Write sections covering operational costs, target user profiles, maintenance parameters, and project value propositions.

### 1.4 User Study Evaluation & Usability Figures
*   *Gap:* The repository contains system benchmarking reports (latency tests and accuracy tests), but lacks subjective evaluations like user satisfaction surveys, student advising feedback charts, or usability metrics.
*   *Required Content:* Document a user study evaluating advisor interaction accuracy and compile charts visualizing user ratings.

---

## 2. Recommended Figures and Visuals to Add
*   **System Deployment Topology:** A diagram showing the Docker network layout, port bindings, and microservice container separations.
*   **Database Schema UML Map:** A unified UML ER-diagram representing the SQLite relational models and their links to the Neo4j Cypher schemas.
*   **LLM Failover State Transition Diagram:** A state-machine diagram showing how requests failover from Gemini to Ollama (Gemma) and return to normal operation.
