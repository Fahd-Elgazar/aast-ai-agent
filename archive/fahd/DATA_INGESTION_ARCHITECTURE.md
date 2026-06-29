# Data Ingestion Architecture (Layer 0)

A Retrieval-Augmented Generation system is only as good as its data pipeline. The Explainable Hybrid GraphRAG platform relies on a strict offline data ingestion architecture to populate its deterministic and semantic databases.

## 1. Semantic Ingestion Pipeline (Qdrant)

**Files Involved**: 
- `backend/rag_system/phase1_data_refiner.py`
- `backend/rag_system/phase2_qdrant_ingestion.py`

**Runtime Role**: Offline / Batch Process.

**Workflow**:
1. **Source Data**: Raw University catalogs, PDFs, and policy HTML files are collected.
2. **Cleaning & Refining (`phase1_data_refiner.py`)**: Data is stripped of noise, normalized, and converted into clean text or structured JSON.
3. **Chunking**: Large documents are broken down into semantically meaningful chunks (e.g., overlapping paragraphs) to ensure vector search retrieves targeted context.
4. **Embedding**: An embedding model (e.g., sentence-transformers) converts the text chunks into dense vector arrays.
5. **Ingestion (`phase2_qdrant_ingestion.py`)**: Vectors, along with their metadata (URL, page number, policy type), are upserted into the Qdrant Vector Database.

**Update Process**: Manual or cron-job triggered batch updates before a new academic semester. Old vectors must be explicitly overwritten or deleted based on metadata IDs.

## 2. Knowledge Graph Construction (Neo4j)

**Files Involved**: 
- `backend/embed_nodes.py`
- `backend/fix_db.js`
- `backend/db/neo4j.js`
- Cypher Import Scripts (e.g., `full_graph.cypher`)

**Runtime Role**: Offline / Batch Process.

**Workflow**:
1. **Source Data**: Structured university databases (CSVs, SQL dumps) containing Courses, Prerequisites, and Degree Plans.
2. **Transformation**: Mapping the relational data into a Graph Ontology (Nodes: `Course`, `Student`, `Major`. Edges: `REQUIRES`, `BELONGS_TO`).
3. **Graph Construction (`full_graph.cypher`)**: Using Cypher queries (`LOAD CSV`) or Python/Node scripts to generate the nodes and relationships in Neo4j.
4. **Node Embedding (`embed_nodes.py`)**: Optional generation of embeddings for graph nodes to allow hybrid vector-graph traversal.

**Update Process**: Graph updates must be transactional. Changing a prerequisite requires deleting the old `REQUIRES` edge and creating a new one to maintain absolute determinism.
