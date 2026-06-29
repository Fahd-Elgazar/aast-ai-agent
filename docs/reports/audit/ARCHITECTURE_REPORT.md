# Architecture Report: AAST Academic AI Agent Platform

This document describes the architecture of the AAST Academic AI Agent, mapping its subsystems, communication protocols, and execution routes.

---

## 1. System Topology & Architecture Style

The platform implements a **Hybrid Semantic Orchestrator & Microservices Architecture**. The system operates as a hub-and-spoke model, where a central Node.js orchestrator routes client messages, compiles context, handles failovers, and calls specialized microservices and databases.

```
       [ React Frontend ] (Port 5173)
               │ (HTTP / JSON)
               ▼
   [ Node.js Orchestrator Backend ] (Port 8004)
        ├── [ Neo4j DB ] (Port 7687 Bolt - GraphRAG context)
        ├── [ Local JSON Storage ] (Debounced Persistence)
        │
        ├── (HTTP / JSON)
        ├──────► [ FastAPI DSS Subsystem ] (Port 8005 - Student Recommendations)
        │
        ├── (HTTP / JSON)
        ├──────► [ FastAPI RAG Retriever ] (Port 8001) ──► [ Qdrant Vector DB ] (Port 6333)
        │
        ├── (HTTP / JSON)
        ├──────► [ FastAPI RAG Answer Engine ] (Port 8002)
        │
        └── (HTTP / JSON)
               ├─► [ Ollama Service ] (Port 11434 Local LLM)
               └─► [ Google Gemini API ] (Cloud LLM Failover)
```

---

## 2. Component Directory Breakdown

1.  **React Frontend** (`aast-ai-agent-main/frontend/`): Client UI providing chat capabilities, session tracking, memory controls, and forms for student grade submissions.
2.  **Node.js Orchestrator** (`aast-ai-agent-main/backend/`): Central semantic router. Parses query intents, invokes GraphRAG (Neo4j), calls VectorRAG services, manages conversation histories, implements circuit breakers, and calls the Decision Support System.
3.  **FastAPI RAG Retriever** (`aast-ai-agent-main/backend/rag_system/`): Loads the `BAAI/bge-m3` embedding model inside a Python runtime. Embeds queries and conducts hybrid vector searches against Qdrant.
4.  **FastAPI RAG Answer Engine** (`aast-ai-agent-main/backend/rag_system/`): Receives retriever contexts and executes LLM generation prompts.
5.  **FastAPI Decision Support Subservice** (`college-decision-system-backend/`): Independent microservice containing SQLite database schemas and recommendation logic based on academic eligibility criteria.

---

## 3. Decision Support System (DSS) Architecture

The **Decision Support System (DSS)** is an active production subsystem deployed as an independent microservice (`college-decision-system-backend`). It acts as the core scoring and eligibility engine for student placement.

### 3.1 Platform Integration & API Communication
The Node.js orchestrator communicates with the DSS using HTTP POST requests. 
*   **Target Endpoint**: `${DECISION_API_URL}/api/v1/decisions/recommend` (typically resolved to `http://127.0.0.1:8005/api/v1/decisions/recommend`).
*   **Security Protocol**: Handled via custom header authentication:
    `X-Internal-Secret: [INTERNAL_SECRET_KEY]`
*   **Failure Protection**: Calls are governed by `decisionService.js` which wraps requests in a configurable retry block with custom timeouts (`DECISION_API_TIMEOUT_MS` defaulting to 7000ms).

### 3.2 Request and Response Payloads
The payload sent from the orchestrator is normalized using strict filters before transmission:

**Request Body**:
```json
{
  "student_profile": {
    "certificate_type": "thanawya_amma_math",
    "high_school_percentage": 87.5,
    "budget": 45000,
    "track_type": "scientific"
  },
  "preferences": {
    "interests": ["artificial intelligence", "programming"],
    "career_goals": ["software engineer", "researcher"]
  }
}
```

**Response Body**:
```json
{
  "success": true,
  "recommended_major": "Artificial Intelligence",
  "confidence": 92,
  "top_recommendations": [
    { "major": "Artificial Intelligence", "score": 92 },
    { "major": "Computer Science", "score": 88 },
    { "major": "Software Engineering", "score": 85 }
  ],
  "reason": "High school percentage exceeds the 85% threshold, and profile shows deep interest in AI logic.",
  "warnings": [],
  "pros": ["Strong job market", "Aligns with programming interests"],
  "cons_and_risks": ["Demanding mathematics coursework"],
  "alternatives": ["Computer Science", "Information Technology"]
}
```

### 3.3 Core Flows inside DSS

```
   [User query/profile]
           │
           ▼
   [Profile Extraction] (Rule-based Regex OR Ollama LLM extraction)
           │
     (Has grades & budget?) ──No──► [Prompt user for missing details]
           │
          Yes
           ▼
   [Data Normalization] (Academic tracks, certificate types, lowercase trim)
           │
           ▼
   [FastAPI Eligibility Validation] (Evaluates budget and score thresholds in SQLite)
           │
           ▼
   [FastAPI recommendation engine] (Scores candidate majors using weights)
           │
           ▼
   [Reject List Check] (Swaps recommendation with alternatives if major was previously rejected)
           │
           ▼
   [Dynamic Career Roadmap Generation] (Builds learning timeline, skills, and market demand)
           │
           ▼
    [Final Response]
```

#### 3.3.1 User Profiling Flow
1.  **Extraction**: The orchestrator receives natural language inputs (e.g. *"I scored 85% in Thanawya Amma math track and want to study coding"*).
2.  **Parsing**: `decisionService.js` attempts to extract profile parameters via regex pattern matching. If regex matching fails, it issues an LLM fallback call (`DECISION_EXTRACTION` task routed to Ollama).
3.  **Completion Guard**: If `high_school_percentage` or `budget` is missing, the orchestrator returns `is_missing_data: true` listing the needed items, short-circuiting the API call to save resources.
4.  **State Save**: Validated states are merged into `decision_memory.json` using debounced persistence.

#### 3.3.2 Recommendation & Eligibility Flow
1.  **FastAPI Matching**: The microservice matches normalized student profiles against requirements stored in the database.
2.  **Track Eligibility**: Literary tracks are filtered out of scientific majors (like CCIT engineering paths).
3.  **Score and Budget Checks**: Only programs whose minimum entry score is $\le$ the student's percentage and whose fee structures are $\le$ the student's budget are considered.
4.  **Rank & Sort**: Candidates are ranked by score matching weight and returned to the orchestrator.

#### 3.3.3 Career Recommendation Flow
Once the recommended major is decided:
1.  **Skills Selection**: `decisionService.js` calls `buildCareerRoadmap()` to map the recommended path to specific skills (e.g. *"AI"* maps to Python, Machine Learning, Neural Networks).
2.  **Learning Steps**: Individual skills map to targeted learning steps via `skills_map` (e.g. *"Python"* maps to "Python Syntax Basics", "Data Structures", "OOP").
3.  **Roadmap Compilation**: The final output includes a timeline (Years 1-2, Years 3-4, Post-Graduation) alongside MENA job market trends.
