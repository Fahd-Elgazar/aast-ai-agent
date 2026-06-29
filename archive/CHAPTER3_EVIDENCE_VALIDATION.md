# CHAPTER 3 EVIDENCE VALIDATION REPORT

This document validates the data-related subsections and terms within `chapter_03_project_terminology_final.md` against verified project evidence from `data.md`, `step8/`, and `AASTMT_Report (2).pdf`.

---

## 1. Subsection Validation

### 3.3.5 Document Chunking
* **Status**: **VERIFIED**
* **Evidence Source**: `AASTMT_Report (2).pdf` (Section 7, "RAG Pipeline (Step-by-Step) - 2. Semantic sentence-aware chunking") and `data.md` (Slide 75, "Scraping -> Cleaning -> Chunking -> Embeddings -> Vector DB")
* **Decision**: **KEEP**

### 3.3.6 Embedding Generation
* **Status**: **VERIFIED**
* **Evidence Source**: `AASTMT_Report (2).pdf` (Section 6.4, "Model: paraphrase-multilingual-MiniLM-L12-v2") and `data.md` (Slide 75, "Scraping -> Cleaning -> Chunking -> Embeddings -> Vector DB")
* **Decision**: **KEEP**

### 3.3.7 Knowledge Base
* **Status**: **VERIFIED**
* **Evidence Source**: `data.md` (Slide 64, "Transforming Noisy Web Pages into Clean, Structured, AI-Ready Knowledge") and `cv.md` ("transform raw university information into structured knowledge bases")
* **Decision**: **KEEP**

### 3.3.8 Qdrant
* **Status**: **VERIFIED**
* **Evidence Source**: `VERIFIED_SYSTEM_MAP.md` (Section 1, "Qdrant... The RAG retriever is a Python FastAPI service using qdrant-client... Qdrant... docker-compose.yml defines qdrant/qdrant:v1.12.5"). 
* **Note**: While `AASTMT_Report (2).pdf` and Slide 75 of `data.md` verify **ChromaDB** as the database used in the offline vector setup, the active runtime orchestrator is configured to interface with **Qdrant** for semantic policy search, making both valid databases in the project scope.
* **Decision**: **KEEP** (Exposes the dual vector store environment)

### 3.3.9 Data Acquisition
* **Status**: **VERIFIED**
* **Evidence Source**: `data.md` (Slide 61, "Key Point: We store everything before cleaning to ensure traceability") and `AASTMT_Report (2).pdf` (Section 4 & 5, "Step-by-step Scraping Solution")
* **Decision**: **KEEP**

### 3.3.10 Data Ingestion Pipeline
* **Status**: **VERIFIED**
* **Evidence Source**: `data.md` (Slide 73, "Knowledge Graph Construction Pipeline: Data cleaning -> Candidate sentence extraction -> LLM Fact Proposal (Ollama) -> Fact Selection -> Semantic Validation -> Neo4j Knowledge Graph") and `step8/normalize_and_store.py` (Ingestion from HTML and JSON files to SQLite)
* **Decision**: **KEEP**

### 3.3.11 Data Scraping
* **Status**: **VERIFIED**
* **Evidence Source**: `step8/adv_playwright.py` (Playwright async workers crawl dynamic pages and intercept APIs) and `data.md` (Slide 57, 60, "Tool Selection: Selenium vs Playwright")
* **Decision**: **KEEP**

---

## 2. Final Term Decisions

| Term | Status | Final Decision | Rationale |
| :--- | :--- | :--- | :--- |
| **Qdrant** | Verified | **KEEP** | Primary vector similarity search database utilized in the active RAG runtime environment. |
| **Data Acquisition** | Verified | **KEEP** | System process of capturing, downloading, and storing raw academic files and portals responses. |
| **Data Ingestion** | Verified | **KEEP** | Process of staging, normalizing, and inserting parsed documents into Neo4j and Qdrant/ChromaDB. |
| **Data Normalization** | Verified | **KEEP** | Standardization of raw HTML dumps and JSON structures into unified DB entities (pages table schema). |
| **Document Chunking** | Verified | **KEEP** | Semantic sentence-level partitioning of document text to preserve meaning during vector search. |
| **Embedding Generation** | Verified | **KEEP** | Transformation of text chunks into numerical vectors via paraphrase-multilingual-MiniLM-L12-v2. |
| **Knowledge Base** | Verified | **KEEP** | The unified collection of cleaned, clean facts and policies that ground LLM queries. |
| **Explainable AI (XAI)** | Verified | **KEEP** | The structural approach of formatting responses with traces, nodes, used facts, and citations to ensure transparency. |
| **Data Collection** | Verified | **KEEP** | Process of targeting and securing campuses, colleges, tuition fees, and bylaws data. |
| **Data Cleaning** | Verified | **KEEP** | Pipeline removing noisy tags, navigation templates, and redundant headers from pages. |
| **Knowledge Graph Population** | Verified | **KEEP** | Extracting clean sentences and LLM facts to populate Neo4j with validated nodes and relations. |
| **Vector Database Population** | Verified | **KEEP** | Ingesting embedded document chunks into ChromaDB/Qdrant databases. |
