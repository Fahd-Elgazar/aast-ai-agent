# Pipeline Dependency Report: Supporting Scripts Audit

This report evaluates the build-time, deployment-time, maintenance-time, dataset preparation, and knowledge graph generation roles for the following supporting scripts:
*   `embed_nodes.py`
*   `embed_server_rag.py`
*   `ner_service.py`
*   `fix_db.js`
*   `db/neo4j.js`

---

## 1. Script Usage Matrix

| Script Name | Suggested Category | Maintenance-Time | KG Generation / Traversal |
| :--- | :--- | :--- | :--- |
| **embed_nodes.py** | `GRAPHRAG_MAINTENANCE` | **High** | **High** |
| **fix_db.js** | `GRAPHRAG_MAINTENANCE` | **High** | **High** |
| **db/neo4j.js** | `GRAPHRAG_CORE_INFRASTRUCTURE` | Low | **High** (Shared core GraphRAG dependency) |
| **embed_server_rag.py**| `RESEARCH_UTILITY` | Low | None |
| **ner_service.py** | `RESEARCH_UTILITY` | Low | Low |

---

## 2. Detailed Pipeline Role Analysis

### 2.1 `embed_nodes.py` (GRAPHRAG_MAINTENANCE)
*   **Maintenance-time usage**: **High**. Populates the `embedding` fields of existing Neo4j nodes. Run whenever the GraphRAG schema is populated or updated with new courses, academic criteria, or faculty records.
*   **Knowledge graph generation usage**: **High**. Creates the vector metrics required for proximity/cosine similarity matches on graph elements.

### 2.2 `fix_db.js` (GRAPHRAG_MAINTENANCE)
*   **Maintenance-time usage**: **High**. A database-repair script running on a maintenance window to patch structural connections in the graph (e.g. merging `TEACHES` relationships).
*   **Knowledge graph generation usage**: **High**. Ensures graph database integrity which is essential for correct graph query traversals by the Node orchestrator.

### 2.3 `db/neo4j.js` (GRAPHRAG_CORE_INFRASTRUCTURE)
*   **Operational Role**: **High** (Shared Core Dependency). Instantiates and exposes the Bolt driver session singleton.
*   **Knowledge graph retrieval usage**: **High**. Directly accessed by the `neo4jcontext.js` service to run Cypher query traversals at runtime.

### 2.4 `embed_server_rag.py` (RESEARCH_UTILITY)
*   **Operational Role**: **Low**. A standalone FastAPI server for verifying SentenceTransformer models.
*   **Reorganization verdict**: Keep as utility reference; do not delete.

### 2.5 `ner_service.py` (RESEARCH_UTILITY)
*   **Operational Role**: **Low**. An experimental Named Entity Recognition matching service.
*   **Reorganization verdict**: Keep as utility reference.
