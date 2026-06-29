# DATA PIPELINE EVIDENCE REPORT

This report validates the technical concepts related to data collection, scraping, cleaning, normalization, ingestion, and database population using the newly verified source documents (`data.md`, `step8/adv_playwright.py`, `step8/normalize_and_store.py`, and `AASTMT_Report (2).pdf`).

---

## 1. Verified Concepts Matrix

### Data Acquisition
* **Evidence Source**: `C:\AI_AGENT\data.md` (Slide 61, Slide 64) and `C:\AI_AGENT\AASTMT_Report (2).pdf` (Section 4 & 5)
* **Supporting Excerpts**: 
  - "Output Structure: api/ -> intercepted API responses, html/ -> fully rendered DOM after JS, json/ -> cleaned structured responses, files/ -> PDFs and attachments. Key Point: We store everything before cleaning to ensure traceability." (Slide 61, `data.md`)
  - "Static scraping -> insufficient. API-only scraping -> unreliable. JavaScript rendering -> mandatory. Manual discovery -> unavoidable." (Slide 57, `data.md`)
* **Confidence Level**: HIGH
* **Recommended Chapter**: Chapter Four (Proposed Model)

### Data Collection
* **Evidence Source**: `C:\AI_AGENT\AASTMT_Report (2).pdf` (Section 3) and `C:\AI_AGENT\data.md` (Slide 63)
* **Supporting Excerpts**:
  - "The project explicitly targets every type of information available on the AAST website, including: Campuses, Colleges, Departments, Programs, Courses, Tuition fees, Grading systems, Admission requirements, Transfer regulations, Academic bylaws, Staff pages, PDFs and attachments, Administrative pages." (Section 3, `AASTMT_Report (2).pdf`)
* **Confidence Level**: HIGH
* **Recommended Chapter**: Chapter Four (Proposed Model)

### Data Scraping
* **Evidence Source**: `C:\AI_AGENT\step8\adv_playwright.py` (Lines 31-36, 160-235), `C:\AI_AGENT\data.md` (Slide 53, 54, 56, 57, 60), and `C:\AI_AGENT\AASTMT_Report (2).pdf` (Section 4 & 5)
* **Supporting Excerpts**:
  - "PLAYWRIGHT_CONCURRENCY = 6... CONCURRENT_WORKERS = 40" (Lines 31-32, `adv_playwright.py`)
  - "Tool Selection: Selenium vs Playwright... Speed & stability... Playwright: Faster. AJAX handling... Playwright: Built-In. Network interception... Playwright: Strong." (Slide 60, `data.md`)
  - "Crawlers without full browser automation are blind." (Section 4.2, `AASTMT_Report (2).pdf`)
* **Confidence Level**: HIGH
* **Recommended Chapter**: Chapter Four (Proposed Model)

### Data Ingestion Pipeline
* **Evidence Source**: `C:\AI_AGENT\data.md` (Slide 64, 73, 75) and `C:\AI_AGENT\AASTMT_Report (2).pdf` (Section 5, 7, 9)
* **Supporting Excerpts**:
  - "Knowledge Graph Construction Pipeline: Data cleaning -> Candidate sentence extraction -> LLM Fact Proposal (Ollama) -> Fact Selection -> Semantic Validation -> Neo4j Knowledge Graph" (Slide 73, `data.md`)
  - "RAG Pipeline (Step-by-Step)... 4. Chroma vector database construction... 7. Context filtering... 8. Context injection into LLM" (Section 7, `AASTMT_Report (2).pdf`)
* **Confidence Level**: HIGH
* **Recommended Chapter**: Chapter Four (Proposed Model)

### Data Cleaning
* **Evidence Source**: `C:\AI_AGENT\step8\normalize_and_store.py` (Lines 71-78), `C:\AI_AGENT\data.md` (Slide 63, 64), and `C:\AI_AGENT\AASTMT_Report (2).pdf` (Section 4.4, 5)
* **Supporting Excerpts**:
  - "Raw AAST website data is highly noisy and inconsistent... Cleaning was mandatory, not optional" (Slide 63, `data.md`)
  - "def clean_text(html): soup = BeautifulSoup(html, 'lxml') for tag in soup(['script','style','noscript']): tag.decompose() text = soup.get_text(' ', strip=True)" (Lines 71-75, `normalize_and_store.py`)
  - "High-Level Data Cleaning Pipeline: Raw Scraped Data -> Hard Filtering & Safety Checks -> Template & Navigation Removal -> Page-Specific Content Extraction -> Content Validation & Refinement -> Semantic Deduplication -> Semantic Structuring -> Final Clean Output JSON Lines" (Slide 64, `data.md`)
* **Confidence Level**: HIGH
* **Recommended Chapter**: Chapter Four (Proposed Model)

### Data Normalization
* **Evidence Source**: `C:\AI_AGENT\step8\normalize_and_store.py` (Lines 31-44, 89-116) and `C:\AI_AGENT\AASTMT_Report (2).pdf` (Section 5)
* **Supporting Excerpts**:
  - "Phase 5 — Normalization. All content mapped into structured entities: campuses, colleges, programs, courses, fees, grading systems, admission rules." (Section 5, `AASTMT_Report (2).pdf`)
  - "CREATE TABLE IF NOT EXISTS pages (id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT, page_type TEXT, title TEXT, language TEXT, source TEXT, collected_at TEXT, raw_text TEXT, cleaned_text TEXT, json_data TEXT)" (Lines 31-44, `normalize_and_store.py`)
* **Confidence Level**: HIGH
* **Recommended Chapter**: Chapter Four (Proposed Model)

### Knowledge Graph Population
* **Evidence Source**: `C:\AI_AGENT\data.md` (Slide 73, 74) and `C:\AI_AGENT\AASTMT_Report (2).pdf` (Section 9)
* **Supporting Excerpts**:
  - "Knowledge Graph Construction Pipeline: Data cleaning -> Candidate sentence extraction -> LLM Fact Proposal (Ollama) -> Fact Selection -> Semantic Validation -> Neo4j Knowledge Graph" (Slide 73, `data.md`)
  - "9.2 KG Pipeline: 1. Data cleaning. 2. Candidate sentence extraction. 3. LLM proposes candidate facts. 4. Fact / Reject separation. 5. Hard semantic validation. 6. Neo4j insertion." (Section 9, `AASTMT_Report (2).pdf`)
* **Confidence Level**: HIGH
* **Recommended Chapter**: Chapter Four (Proposed Model)

### Vector Database Population
* **Evidence Source**: `C:\AI_AGENT\data.md` (Slide 75) and `C:\AI_AGENT\AASTMT_Report (2).pdf` (Section 7)
* **Supporting Excerpts**:
  - "Architecture Flow: Scraping -> Cleaning -> Chunking -> Embeddings -> Vector DB (ChromaDB) -> Knowledge Graph" (Slide 75, `data.md`)
  - "4. Chroma vector database construction" (Section 7, `AASTMT_Report (2).pdf`)
* **Confidence Level**: HIGH
* **Recommended Chapter**: Chapter Four (Proposed Model)

### Embedding Generation
* **Evidence Source**: `C:\AI_AGENT\data.md` (Slide 75) and `C:\AI_AGENT\AASTMT_Report (2).pdf` (Section 6, 7)
* **Supporting Excerpts**:
  - "Model: paraphrase-multilingual-MiniLM-L12-v2... Reasons: Highest semantic similarity, Strong Arabic-English alignment, Acceptable inference time, Fully local & deterministic." (Section 6.4, `AASTMT_Report (2).pdf`)
  - "3. Multilingual embedding generation" (Section 7, `AASTMT_Report (2).pdf`)
* **Confidence Level**: HIGH
* **Recommended Chapter**: Chapter Four (Proposed Model)

### Document Chunking
* **Evidence Source**: `C:\AI_AGENT\data.md` (Slide 75) and `C:\AI_AGENT\AASTMT_Report (2).pdf` (Section 7)
* **Supporting Excerpts**:
  - "2. Semantic sentence-aware chunking" (Section 7, `AASTMT_Report (2).pdf`)
  - "Scraping -> Cleaning -> Chunking -> Embeddings -> Vector DB..." (Slide 75, `data.md`)
* **Confidence Level**: HIGH
* **Recommended Chapter**: Chapter Four (Proposed Model)
