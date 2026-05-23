# AAST AI Agent Platform — Master Technical Report

> **Document Classification:** Production-Grade Architecture Specification  
> **Version:** 3.0 — Phase 8 Explainability Contract  
> **Codebase Scale:** ~37,500 files | ~15,000+ lines of handcrafted service logic  
> **Architecture Class:** Hybrid GraphRAG Autonomous Academic Super-Agent

---

## 1. Executive Summary

The AAST AI Agent Platform is a **multi-layered, hybrid-retrieval academic intelligence system** that autonomously routes student queries through a deterministic signal-fusion engine to produce explainable, citation-backed academic advisory responses. Unlike conventional chatbot architectures that rely on a single LLM endpoint, this platform implements a **six-route agentic brain** with enterprise-grade circuit breakers, pairwise contradiction detection, and deterministic fallback chains that guarantee zero-hallucination responses even under total LLM failure.

The system integrates:
- **Neo4j Knowledge Graph** — 100+ academic entities with TEACHES, HAS_PREREQUISITE, DEAN_OF, and HAS_COURSE relationships
- **ChromaDB/Qdrant RAG Pipeline** — Multi-pass semantic retrieval with academic synonym expansion and reranking
- **Local LLM Infrastructure** — Gemma 4 primary with TinyLlama failover, managed by a full circuit breaker state machine
- **Decision Intelligence Engine** — Rule-based major recommendation with profile validation and career roadmap generation
- **React + D3.js Frontend** — Interactive force-directed graph explorer with real-time entity inspection

### Key Engineering Differentiators

| Capability | Implementation |
|---|---|
| **Deterministic Routing** | 9-signal weighted fusion with golden path registry (14 pre-validated query patterns) |
| **Zero-Hallucination Guarantee** | `buildDeterministicHybridAnswer()` synthesizes from structured facts only when LLM is unreliable |
| **Circuit Breaker State Machine** | 6-state FSM (WAITING_FOR_OLLAMA → CLOSED → PRIMARY_COLD → DEGRADED → HALF_OPEN → OPEN) |
| **Pairwise Contradiction Detection** | Cross-source evidence conflict resolution (GPA_THRESHOLD_MISMATCH, PREREQUISITE_CONFLICT, etc.) |
| **Explainability Contract** | Every response includes `used_facts[]`, `missing_information[]`, `graph{nodes[], links[]}` |
| **Session Memory Persistence** | JSON-backed LRU/TTL conversation store with debounced disk writes |
| **Warm Pool Management** | Background LLM keep-alive probes with memory-pressure-aware scheduling |

---

## 2. System Architecture Overview

### 2.1 Service Topology

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND LAYER                               │
│  React 19 + TypeScript + Vite + D3-Force + Framer Motion           │
│  ┌──────────┐ ┌──────────────┐ ┌───────────────┐ ┌──────────────┐ │
│  │LoginPage │ │AdvisorPage   │ │GraphVisualizer│ │DecisionPage  │ │
│  │          │ │(Chat + Graph)│ │(575 lines)    │ │(Career Recs) │ │
│  └──────────┘ └──────┬───────┘ └───────┬───────┘ └──────────────┘ │
│                      │                 │                            │
│              backendService.ts ────────┘                            │
│              (normalizeGraph, normalizeDecision)                    │
└──────────────────────┬─────────────────────────────────────────────┘
                       │ POST /api/graph/ask
                       │ POST /api/chatbot/query
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     ORCHESTRATOR (Port 8004)                        │
│                     orchestrator.js — 1,715 lines                   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ REQUEST PIPELINE                                             │   │
│  │ 1. Query Normalization (academicQueryNormalizer.js)          │   │
│  │ 2. Greeting/FAQ Detection (greetings.js, faqService.js)     │   │
│  │ 3. Golden Path Classification (goldenPathRegistry.js)       │   │
│  │ 4. Brain Router Signal Fusion (brainRouter.js — 1,258 loc)  │   │
│  │ 5. Concurrent Subsystem Dispatch (semaphore-controlled)     │   │
│  │ 6. Fusion Service (fusionService.js — 610 loc)              │   │
│  │ 7. Unified Answer Synthesis (unifiedAnswerService — 1,890)  │   │
│  │ 8. Response Formatter (responseFormatter.js — 244 loc)      │   │
│  └─────────────────────────────────────────────────────────────┘   │
└──────────────┬───────────┬──────────────┬──────────────┬───────────┘
               │           │              │              │
    ┌──────────▼──┐  ┌─────▼──────┐ ┌────▼─────┐ ┌─────▼──────────┐
    │  Neo4j KG   │  │ChromaDB/   │ │ Ollama   │ │ Decision       │
    │  (bolt://   │  │Qdrant RAG  │ │ LLM      │ │ Engine         │
    │  7687)      │  │(8001)      │ │ (11434)  │ │ (Internal)     │
    │             │  │            │ │          │ │                │
    │ 100+ nodes  │  │ Policy     │ │ Gemma4   │ │ Major Compare  │
    │ TEACHES     │  │ Documents  │ │ TinyLlama│ │ Career Roadmap │
    │ HAS_PREREQ  │  │ Handbooks  │ │ Circuit  │ │ Profile Valid. │
    │ DEAN_OF     │  │ Regs       │ │ Breaker  │ │ Memory Store   │
    └─────────────┘  └────────────┘ └──────────┘ └────────────────┘
```

### 2.2 Request Processing Pipeline

Every user query traverses an **8-stage deterministic pipeline**:

```
User Query
    │
    ▼
[1] academicQueryNormalizer.js
    │  Whitespace normalization, Arabic transliteration,
    │  abbreviation expansion (AI→Artificial Intelligence)
    ▼
[2] greetings.js + faqService.js
    │  Deterministic greeting/FAQ pattern match
    │  (short-circuits pipeline if matched)
    ▼
[3] goldenPathRegistry.js
    │  14 pre-validated regex patterns with priority scoring
    │  Golden matches lock route with ≥0.92 confidence
    ▼
[4] brainRouter.js — analyzeQuery()
    │  9-signal weighted fusion engine:
    │  ├── Lexical signals (single/phrase/compound)
    │  ├── Pattern signals (course/hybrid/decision/career)
    │  ├── Alias resolution (316 academic aliases)
    │  ├── RAG category detection
    │  ├── Intent boost calibration
    │  ├── Feature calibration (entity/specificity/ambiguity)
    │  ├── Deterministic policy classification
    │  ├── Hybrid candidate detection
    │  └── Ambiguity detection + signal normalization
    ▼
[5] Concurrent Subsystem Dispatch
    │  Semaphore-controlled parallel calls:
    │  ├── Neo4j KG retrieval (neo4jcontext.js — 1,273 loc)
    │  ├── RAG retrieval (ragService.js — 1,796 loc)
    │  └── Decision/Career engine (decisionService.js — 650 loc)
    ▼
[6] fusionService.js — fuse()
    │  Multi-source evidence pipeline:
    │  ├── Evidence ingestion (KG, RAG, Decision, Career, FAQ, LLM)
    │  ├── SHA-256 deduplication
    │  ├── Dynamic priority ranking by query context
    │  ├── Token budget enforcement (max 8 evidence, 3 per source)
    │  ├── Pairwise contradiction detection
    │  └── Confidence aggregation
    ▼
[7] unifiedAnswerService.js — 1,890 lines
    │  Final synthesis layer:
    │  ├── LLM-grounded synthesis (when available)
    │  ├── Deterministic hybrid fallback (when LLM fails)
    │  └── Source attribution + fact extraction
    ▼
[8] responseFormatter.js
    │  Universal explainability envelope:
    │  { answer, confidence, used_facts[], missing_information[],
    │    graph{nodes[], links[]}, sources[], explainability{},
    │    citations[], reasoning, metadata{trace{}} }
    ▼
  Client Response
```

---

## 3. Routing Intelligence — The Brain Router

### 3.1 Signal Fusion Architecture

The `BrainRouter` class (1,258 lines) implements a **multi-signal weighted scoring engine** that replaces naive if/else routing with enterprise-grade semantic classification.

**Six Target Routes:**

| Route | Priority | Trigger Condition |
|---|---|---|
| `KG_DIRECT` | 100 | Faculty, teaching, prerequisites, course structure queries |
| `RAG_DIRECT` | 90 | Policy, regulation, scholarship, admission queries |
| `HYBRID_KG_RAG` | 80 | Cross-domain queries requiring both structural + policy data |
| `DECISION_ENGINE` | 70 | Major comparison, recommendation, what-if analysis |
| `CAREER_ENGINE` | 68 | Career roadmaps, job market, skill planning |
| `LLM_FALLBACK` | 5 | Conversational queries with no academic signal |

**Signal Weight Matrix:**

```javascript
signalWeights = {
    lexical_single:              0.20,  // Single-token dictionary match
    lexical_phrase:              0.35,  // Multi-word phrase match
    pattern_course:              0.40,  // Course code regex detection
    pattern_hybrid_base:         0.50,  // Hybrid trigger pattern
    hybrid_boost:                0.40,  // Synergistic KG+RAG boost
    category_boost:              0.40,  // RAG category detection boost
    intent_boost:                0.30,  // Pre-classified intent alignment
    deterministic_policy_boost:  1.10,  // Policy query lock (highest weight)
    person_alias_boost:          0.58,  // Named entity resolution
    base_llm:                    0.10   // Minimum LLM floor
}


### 3.3 Ambiguity Detection

When the top-2 route scores differ by less than the `ambiguityMargin` threshold (0.08), the router activates **ambiguity resolution**:

```javascript
detectAmbiguity(sortedSignals) {
    const diff = top1[1] - top2[1];
    if (diff <= ambiguityMargin && top1[1] > 0.2) {
        ambiguity_detected = true;
        // If KG and RAG are the top-2 contenders, prefer HYBRID
        if (topKeys.includes('kg_score') && topKeys.includes('rag_score')) {
            prefer_hybrid = true;
        }
    }
}
```

---

## 4. LLM Infrastructure — Model Failover System

### 4.1 Circuit Breaker State Machine

The `CircuitStateManager` (259 lines) implements a **6-state finite state machine** for LLM availability management:

```
                    ┌─────────────────────┐
                    │  WAITING_FOR_OLLAMA  │ ← Initial state (startup)
                    └──────────┬──────────┘
                               │ ollama_ready
                               ▼
                    ┌──────────────────────┐
              ┌────►│       CLOSED         │◄────────────────┐
              │     │  (Primary available) │                  │
              │     └──────────┬───────────┘                  │
              │                │ primary_failure_threshold    │
              │                ▼                              │
              │     ┌──────────────────────┐                  │
              │     │      DEGRADED        │                  │
              │     │  (Using backup)      │                  │
              │     └──────────┬───────────┘                  │
              │                │ half_open_interval           │
              │                ▼                              │
              │     ┌──────────────────────┐    recovery      │
              │     │      HALF_OPEN       │────success───────┘
              │     │  (Probing primary)   │
              │     └──────────┬───────────┘
              │                │ backup_failure_threshold
              │                ▼
              │     ┌──────────────────────┐
              │     │        OPEN          │
              │     │   (All models down)  │
              │     └──────────────────────┘
              │
              │     ┌──────────────────────┐
              └─────│    PRIMARY_COLD      │
                    │ (Preload failed,     │
                    │  primary on standby) │
                    └──────────────────────┘
```

**Configuration Parameters (from `llmConfig.js`):**

| Parameter | Value | Purpose |
|---|---|---|
| `primaryMaxFailures` | 3 | Failures before DEGRADED transition |
| `backupMaxFailures` | 1 | Backup failures before OPEN |
| `breakerThreshold` | 5 | Total failures before OPEN |
| `halfOpenIntervalMs` | 30,000 | Recovery probe interval |
| `recoverySuccessThreshold` | 2 | Consecutive probe successes for CLOSED |
| `healthProbeIntervalMs` | 30,000 | Background health check interval |

### 4.2 Gemma Telemetry & Memory Pressure

The `gemmaTelemetryService.js` (263 lines) provides real-time LLM resource monitoring:

- **Memory Pressure Levels:** HIGH (>6144MB RSS), CRITICAL (>8192MB RSS)
- **Queue Management:** Max depth 24, timeout 25s, single-concurrency gate
- **Context Window:** 4096 tokens default, 512 minimum, dynamic reduction under pressure
- **Generation Budgets:** Light (128), Intent (96), Synthesis (420), Heavy (320), Max (512)
- **Warm Pool:** Background keep-alive every 7 minutes with jitter, skips when queue busy or memory high

---

## 5. Knowledge Retrieval Subsystems

### 5.1 Neo4j Knowledge Graph (neo4jcontext.js — 1,273 lines)

Implements **vector-aware Cypher query generation** with confidence-scored retrieval:

- **Teaching Queries:** `MATCH (p:Person)-[:TEACHES]->(c:Course)` with fuzzy name matching
- **Prerequisite Chains:** Recursive `HAS_PREREQUISITE` traversal with depth limiting
- **Leadership Lookups:** `DEAN_OF`, `VICE_DEAN_OF`, role-to-department resolution
- **Program Structure:** `HAS_COURSE`, `BELONGS_TO` major-module-course hierarchy
- **Confidence Scoring:** Each KG result carries a computed confidence (0.0–1.0) based on match type and relationship proximity

### 5.2 RAG Pipeline (ragService.js — 1,796 lines)

Implements a **multi-pass retrieval strategy** for policy document search:

1. **Category Detection** — Weighted keyword scoring across 8 policy domains
2. **Academic Synonym Expansion** — Query augmentation with domain-specific terminology
3. **Multi-Pass Search** — Primary search + synonym-expanded fallback search
4. **Reranking** — Confidence recalibration based on source freshness and category alignment
5. **Source Attribution** — Document-level citation extraction for explainability

### 5.3 Decision Intelligence Engine (decisionService.js — 650 lines)

- **Major Recommendation:** Multi-factor scoring (interest alignment, affordability, employment outlook, location preference, career flexibility, certificate compatibility)
- **Major Comparison:** Side-by-side analysis with pros/cons and career trajectory mapping
- **Career Roadmap:** Skill-path generation with industry demand assessment
- **Session Memory:** Persistent student profiles with conversation-scoped career context

---

## 6. Evidence Fusion & Contradiction Resolution

### 6.1 Fusion Pipeline (fusionService.js — 610 lines)

The `FusionService` implements an **8-stage evidence processing pipeline**:

1. **Multi-Source Ingestion** — Normalize KG, RAG, Decision, Career, FAQ, LLM results
2. **SHA-256 Deduplication** — Content fingerprinting with metadata-aware merging
3. **Dynamic Priority Ranking** — Context-aware source weighting (Policy→RAG first, Curriculum→KG first)
4. **Token Budget Enforcement** — Max 8 total evidence items, 3 per source type
5. **Pairwise Contradiction Detection** — Cross-source semantic conflict analysis
6. **Conflict Resolution** — Route-aware governance (RAG overrides KG for policy, KG overrides RAG for curriculum)
7. **Confidence Aggregation** — Weighted formula: `(route_confidence × 0.4) + (evidence_confidence × 0.6) - ambiguity - contradictions`
8. **Hybrid Response Synthesis** — Narrative generation with source-aware templating

### 6.2 Contradiction Types

| Type | Detection Logic |
|---|---|
| `GPA_THRESHOLD_MISMATCH` | Numeric GPA values differ by >0.05 across sources |
| `PREREQUISITE_CONFLICT` | One source says waived, another says required |
| `WAIVED_VS_REQUIRED` | Exemption vs mandatory conflict |
| `ALLOWED_VS_PROHIBITED` | Permission contradiction |
| `TRANSFER_ELIGIBILITY_CONTRADICTION` | Transfer policy conflicts |
| `SCHOLARSHIP_INCONSISTENCY` | Financial aid rule mismatches |
| `FEE_PAYMENT_CONTRADICTION` | Tuition/payment conflicts |
| `POLICY_DEADLINE_CONFLICT` | Temporal policy disagreements |

---

## 7. Observability & Operational Infrastructure

### 7.1 Structured Logging (logger.js — 571 lines)

- **Category-Scoped Loggers:** GRAPH, LLM, ROUTER, CACHE, AUDIT, SERVER
- **Security Sanitization:** Automatic `[REDACTED]` for password/secret/token/api-key fields
- **File Rotation:** Date-stamped log files with 5MB rotation threshold
- **Terminal Formatting:** Chalk-colored output with timestamp, level, category, and truncated metadata

### 7.2 Metrics Collection (metrics.js — 191 lines)

Real-time counters for:
- Route distribution (KG/RAG/Hybrid/Decision/Career/FAQ/LLM hits)
- Average routing confidence
- Ambiguity rate
- Contradiction frequency
- LLM failover activations
- Evidence processing throughput

### 7.3 Health Monitoring

- **Subsystem Health Probes** (`healthProbes.js`): Neo4j, Ollama, RAG connectivity checks
- **Model Health Monitor** (`healthMonitor.js` — 422 lines): Tag-based model availability verification
- **Ollama Readiness Service** (`ollamaReadinessService.js`): Startup wait with configurable timeout (60s default)

---

## 8. Frontend Architecture

### 8.1 Technology Stack
- **React 19** + TypeScript + Vite 7
- **D3-Force** for graph physics simulation
- **Framer Motion** for micro-animations
- **Lucide React** for icon system

### 8.2 Component Architecture

| Component | Lines | Responsibility |
|---|---|---|
| `GraphVisualizer.tsx` | 575 | Master graph explorer with search, controls, legend, inspector |
| `graphUtils.ts` | 683 | Graph normalization, type classification, layout utilities |
| `GraphView.tsx` | 382 | D3 force-directed canvas with node/link rendering |
| `ConversationHistorySidebar.tsx` | 260 | Multi-session conversation management |
| `GraphNodeDetails.tsx` | 217 | Entity inspector with relationship traversal |
| `GraphLegend.tsx` | 211 | Dynamic legend with type filtering and relationship focus |
| `GraphControls.tsx` | 172 | Zoom, physics, fullscreen, layout controls |
| `LoginPage.tsx` | 116 | Authentication with guest access mode |

### 8.3 Graph Explorer Features
- **Real-time entity rendering** with type-colored nodes (Person, Course, Major, College, Role, Policy)
- **Relationship filtering** by type (TEACHES, HAS_PREREQUISITE, DEAN_OF, HAS_COURSE)
- **Node collapse/expand** for complex graph simplification
- **Search with neighborhood expansion** — matching nodes + connected entities
- **Fullscreen mode** with ESC key dismissal
- **Inspector panel** with pin/auto-hide/collapse states persisted to localStorage

---

## 9. Security Architecture

| Layer | Implementation |
|---|---|
| **API Authentication** | JWT-based token validation via `jsonwebtoken` |
| **Internal Service Auth** | `INTERNAL_SECRET_KEY` environment variable for inter-service calls |
| **Log Sanitization** | Automatic redaction of sensitive fields (password, secret, token, api-key) |
| **Input Validation** | Conversation ID normalization (alphanumeric + limited special chars, max 128 chars) |
| **CORS Policy** | Configurable origin whitelist via Express CORS middleware |
| **Environment Isolation** | All credentials externalized to `.env` with `dotenv` |

---

## 10. Deployment & Operations

### 10.1 Service Ports

| Service | Port | Process |
|---|---|---|
| Frontend (Vite) | 5173 | `npm run dev` |
| Backend API | 8000 | `node index.js` |
| Orchestrator | 8004 | `node --max-old-space-size=3072 orchestrator.js` |
| Neo4j (Bolt) | 7687 | Docker container |
| Neo4j (HTTP) | 7474 | Docker container |
| ChromaDB/RAG | 8001 | Python service |
| Ollama LLM | 11434 | System service |

### 10.2 Automation Scripts
- `start_full_project.bat` — Sequential service startup with dependency validation
- `stop_full_project.bat` — Graceful shutdown with port cleanup

### 10.3 Memory Configuration
- Orchestrator: `--max-old-space-size=3072` (3GB Node.js heap)
- Gemma context: 4096 tokens default, auto-reduces under memory pressure
- Conversation persistence: Debounced writes (500ms) to prevent disk thrashing

---

## 11. Codebase Metrics

### 11.1 Backend Service Complexity

| Module | Lines | Architectural Role |
|---|---|---|
| `unifiedAnswerService.js` | 1,890 | Final synthesis + deterministic fallback |
| `ragService.js` | 1,796 | Multi-pass RAG retrieval engine |
| `orchestrator.js` | 1,715 | Central request pipeline + routing |
| `neo4jcontext.js` | 1,273 | KG query generation + confidence scoring |
| `brainRouter.js` | 1,258 | Signal fusion routing engine |
| `ollamaService.js` | 847 | LLM inference + retry + failover |
| `decisionService.js` | 650 | Decision engine + memory store |
| `fusionService.js` | 610 | Evidence fusion + contradiction detection |
| `logger.js` | 571 | Structured logging + file rotation |
| `modelFailoverManager.js` | 536 | Circuit breaker orchestration |
| **Total backend services** | **~12,500** | |

### 11.2 Frontend Component Complexity

| Module | Lines |
|---|---|
| `graphUtils.ts` | 683 |
| `GraphVisualizer.tsx` | 575 |
| `GraphView.tsx` | 382 |
| `ConversationHistorySidebar.tsx` | 260 |
| `backendService.ts` | 256 |
| **Total frontend core** | **~3,200** |

---

## 12. Innovation Assessment

### 12.1 Beyond Standard Chatbot Architecture

| Standard Chatbot | AAST AI Agent Platform |
|---|---|
| Single LLM endpoint | 6-route agentic brain with signal fusion |
| No retrieval grounding | Dual-retrieval (KG + RAG) with contradiction detection |
| Binary success/failure | 6-state circuit breaker with automatic recovery |
| Opaque responses | Full explainability contract (facts, sources, graph, confidence) |
| No session awareness | Persistent conversation memory with career context |
| Static responses | Dynamic graph visualization with entity inspection |
| No fallback strategy | 4-tier fallback: LLM → Deterministic Hybrid → Golden Path → Safe Advisory |

### 12.2 Research-Grade Contributions

1. **Hybrid GraphRAG Fusion** — Novel combination of structured KG traversal with unstructured document retrieval, unified through a weighted signal fusion engine
2. **Deterministic Policy Routing** — Academic domain-specific query classification that prevents policy questions from being diluted into hybrid or LLM paths
3. **Pairwise Contradiction Detection** — Cross-source evidence conflict analysis with domain-aware resolution strategies
4. **Golden Path Registry** — Pre-validated query pattern matching with static fallback payloads for guaranteed response quality
5. **Memory-Pressure-Aware LLM Management** — Dynamic context window adjustment and queue management based on real-time RSS telemetry

---

*This document represents the complete architectural specification of the AAST AI Agent Platform as of Phase 8 (Explainability Contract). The platform demonstrates production-grade engineering across retrieval, routing, synthesis, resilience, and observability domains.*
