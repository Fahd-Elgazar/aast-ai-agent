<div align="center">

# Explainable Hybrid GraphRAG Academic AI Platform
## Architecture & System Sequence Documentation
</div>
<div style="page-break-after: always;"></div>

## Table of Contents

1. [Introduction](#1-introduction)
2. [System Context](#2-system-context)
3. [Architectural Overview](#3-architectural-overview)
4. [Sequence Diagrams](#4-sequence-diagrams)
   - [Diagram 1: High Level System Flow](#diagram-1--high-level-system-flow)
   - [Diagram 2: Detailed Query Lifecycle](#diagram-2--detailed-query-lifecycle)
   - [Diagram 3: Hybrid GraphRAG Flow](#diagram-3--hybrid-graphrag-flow)
   - [Diagram 4: Failover & Reliability Flow](#diagram-4--failover--reliability-flow)
   - [Diagram 5: Conversation Memory Flow](#diagram-5--conversation-memory-flow)
5. [Engineering Notes](#5-engineering-notes)
6. [Reliability & Failover Notes](#6-reliability--failover-notes)
7. [Architectural Observations](#7-architectural-observations)
8. [Conclusion](#8-conclusion)

<div style="page-break-after: always;"></div>

---

## 1. Introduction

This document provides a rigorous, deep-technical architectural analysis of the Explainable Hybrid GraphRAG Academic AI Platform. It captures the true system flows, orchestrations, fallback chains, and retrieval topologies implemented in the production codebase.

The system goes far beyond a simple Large Language Model (LLM) wrapper; it is a highly distributed AI orchestration platform featuring intelligent heuristic and semantic routing, strict concurrency controls, cascading failovers, memory management, and deterministic observability layers.

---

## 2. System Context

The platform is designed to provide authoritative, grounded, and academically verified answers to students and faculty. To achieve this safely, it employs several key subsystems:

- **Intelligent Brain Router**: A multi-signal heuristic and semantic router that assigns queries to the optimal processing path.
- **Hybrid GraphRAG Fusion**: Parallel retrieval across Neo4j Knowledge Graphs and Vector RAG, merged dynamically to prevent hallucination.
- **Enterprise Reliability**: Circuit breakers, semaphores for concurrent connections (LLM, Neo4j, RAG), and multi-tier model failovers (e.g., Gemini to Ollama).
- **Conversational Explainability**: Every response includes telemetry detailing the exact route, confidence score, and bypassed sub-systems.
- **Memory & Humanization**: Lightweight conversation memory and an egress post-processing humanizer for grounded empathy.

---

## 3. Architectural Overview

The core orchestrator (`orchestrator.js`) coordinates incoming traffic by immediately applying query normalization and executing fast pre-routing bypass checks (Greetings, Meta-Intents, FAQs). 

If a query requires semantic understanding, the platform extracts intents using a local LLM (with strict time budgets and LRU caching), then routes the signal through the Brain Router. The execution phase utilizes concurrency-safe retrievals against graph and vector databases, fusing results before passing them to the Unified Answer Engine (UAE). Finally, the Humanization middleware enriches the response before delivery.

<div style="page-break-after: always;"></div>

---

## 4. Sequence Diagrams

### Diagram 1 — High Level System Flow

**Purpose:** Executive-level architecture understanding showing the broad request-response lifecycle from the user to the foundational AI layers.

```mermaid
sequenceDiagram
    autonumber

    actor User

    participant Frontend as Client API
    participant Orch as Orchestrator (/query)
    participant Router as Brain Router
    participant KG as Neo4j Graph
    participant RAG as Vector DB
    participant UAE as Unified Answer Engine
    participant Human as Humanizer

    User->>Frontend: Academic Query
    Frontend->>Orch: POST /api/chatbot/query

    rect rgb(245,245,245)
        Note over Orch,Router: 1. Pre-Processing & Routing

        Orch->>Orch: Normalize Query & Retrieve Memory
        Orch->>Router: determineBestRoute(query, intent, memory)
        Router-->>Orch: Route (HYBRID_KG_RAG)
    end

    rect rgb(235,245,235)
        Note over Orch,RAG: 2. Retrieval Phase

        par Concurrent Retrieval
            Orch->>KG: fetchNeo4jContext() (via Semaphore)
            KG-->>Orch: Graph Entities & Relationships
        and
            Orch->>RAG: fetchRagContext() (via Semaphore)
            RAG-->>Orch: Semantic Chunks
        end
    end

    rect rgb(235,235,250)
        Note over Orch,UAE: 3. Synthesis Phase

        Orch->>UAE: generateUnifiedAnswer(fused_context)
        UAE-->>Orch: Grounded Answer
    end

    rect rgb(245,235,245)
        Note over Orch,Human: 4. Formatting & Delivery

        Orch->>Human: humanizeGroundedAnswer()
        Human-->>Orch: Empathetic Enriched Answer

        Orch->>Frontend: Formatted JSON + Telemetry
    end

    Frontend->>User: Final Response
```

<div style="page-break-after: always;"></div>

### Diagram 2 — Detailed Query Lifecycle

**Purpose:** Deep technical lifecycle analysis detailing normalization, fallback logic, deterministic overrides, and observability.

```mermaid
sequenceDiagram
    autonumber
    participant Client
    participant Orch as Orchestrator
    participant Ollama as Ollama (Intent)
    participant Router as Brain Router
    participant Health as Health Probes
    participant Memory as Conv. Service
    participant UAE as Unified Engine (Gemini)
    
    Client->>Orch: Query: "What are the prerequisites for AI?"
    Orch->>Orch: normalizeAcademicQuery()
    Orch->>Memory: getConversation(cid)
    
    Note over Orch: Pre-Routing Bypass Checks
    Orch->>Orch: checkGreeting() / searchFAQ() / Meta Intents
    
    alt Needs Semantic Understanding
        Orch->>Ollama: extractDynamicIntent() (with timeout budget)
        Ollama-->>Orch: { intent: "PREREQUISITE", entities: ["AI"] }
        
        Orch->>Health: checkSubsystemHealth()
        Health-->>Orch: Subsystem Status
        
        Orch->>Router: analyzeQuery(intent, health, normalization)
        Router->>Router: compute signal weights (KG, RAG, Hybrid)
        Router-->>Orch: Route Assigned: KG_DIRECT
        
        Note over Orch: Execution based on assigned route
        Orch->>Orch: fetchNeo4jContext()
        Orch->>UAE: generateUnifiedAnswer(kg_context)
        
        alt Primary Model Failure (Gemini)
            UAE--xOrch: Timeout / 503
            Note over Orch,UAE: Circuit Breaker Activated
            Orch->>Ollama: Fallback Synthesis
            Ollama-->>Orch: Degraded Mode Answer
        end
        
        UAE-->>Orch: Final Synthesized Answer
    end
    
    Orch->>Memory: updateConversationMemoryFromTurn()
    Orch->>Orch: writeRoutingAudit() & incrementMetrics()
    Orch->>Client: 200 OK (Formatted Payload)
```

<div style="page-break-after: always;"></div>

### Diagram 3 — Hybrid GraphRAG Flow

**Purpose:** Show hybrid retrieval orchestration, detailing how semantic search and graph traversal merge synchronously.

```mermaid
sequenceDiagram
    autonumber
    participant Orch as Orchestrator
    participant KG as Neo4j Graph
    participant RAG as Vector DB (Qdrant/Milvus)
    participant Fusion as Fusion Service
    participant UAE as Unified Engine
    
    Note over Orch: Route assigned: HYBRID_KG_RAG
    
    par Wait on Semaphores
        Orch->>Orch: neo4jSemaphore.acquire()
        Orch->>Orch: ragSemaphore.acquire()
    end
    
    par Parallel Data Fetch
        Orch->>KG: fetchNeo4jContext()
        KG-->>Orch: Structural nodes, Relationships, Aliases
        
        Orch->>RAG: fetchRagContext()
        RAG-->>Orch: Semantic text chunks, Policy docs
    end
    
    par Release Semaphores
        Orch->>Orch: neo4jSemaphore.release()
        Orch->>Orch: ragSemaphore.release()
    end
    
    Orch->>Fusion: fuseContext(kgData, ragData)
    Note over Fusion: Resolves conflicts, eliminates redundancies, boosts overlapping entities
    Fusion-->>Orch: Unified Knowledge Context
    
    Orch->>UAE: generateUnifiedAnswer(Unified Knowledge Context)
    UAE-->>Orch: Grounded Answer with Citations
```

<div style="page-break-after: always;"></div>

### Diagram 4 — Failover & Reliability Flow

**Purpose:** Document the enterprise reliability engineering, demonstrating multi-tier fallback.

```mermaid
sequenceDiagram
    autonumber
    participant Orch as Orchestrator
    participant Failover as ModelFailoverManager
    participant Gemini as Gemini API
    participant Gemma as Local Gemma (Ollama)
    
    Orch->>Failover: executeWithFailover(payload)
    
    Note over Failover: Check Circuit State
    alt Circuit OPEN
        Failover-->>Orch: Route immediately to Local Gemma
    else Circuit CLOSED / HALF_OPEN
        Failover->>Gemini: Attempt Primary Generation (Timeout: X ms)
        
        alt Success
            Gemini-->>Failover: Generated Text
        else Timeout / API Error
            Gemini--xFailover: 503 / Timeout
            Note over Failover: Register Failure in CircuitStateManager
            Failover->>Gemma: Execute Fallback Request
            Gemma-->>Failover: Degraded Generation
        end
    end
    
    Failover-->>Orch: Final Payload (Flags: degraded=true/false)
    Note over Orch: Audit Log captures Fallback triggers
```

<div style="page-break-after: always;"></div>

### Diagram 5 — Conversation Memory Flow

**Purpose:** Show conversational persistence architecture and follow-up reference resolution.

```mermaid
sequenceDiagram
    autonumber
    participant User
    participant Orch as Orchestrator
    participant Priority as Conv. Priority
    participant Memory as Conv. Service
    participant Disk as Persistence (JSON/Redis)
    
    User->>Orch: "What are the prerequisites for it?"
    
    Orch->>Memory: getConversationMemory(cid)
    Memory-->>Orch: { lastIntent: "PROGRAM", lastSubject: "Machine Learning" }
    
    Orch->>Priority: resolveFollowUpReference("...for it?", memory)
    Note over Priority: Identifies pronoun "it" maps to "Machine Learning"
    
    Priority-->>Orch: { resolved: true, resolvedQuery: "What are the prerequisites for Machine Learning?" }
    
    Orch->>Orch: Proceed with Routing using resolved query
    Note over Orch: Brain Router processes resolved query
    
    Orch->>User: "The prerequisites for Machine Learning are..."
    
    Orch->>Memory: updateConversationMemoryFromTurn(newContext)
    Memory->>Disk: saveConversation(cid)
```
