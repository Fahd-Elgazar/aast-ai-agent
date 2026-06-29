# AAST AI Agent Platform — Architectural Diagrams

> **Format:** Mermaid diagrams derived from source code analysis  
> **Coverage:** 10 architectural views from system topology to data flow

---

## Diagram 1: System Topology — Service Dependencies

```mermaid
graph TB
    subgraph Frontend["Frontend Layer (Port 5173)"]
        LP["LoginPage"]
        AP["AdvisorPage"]
        GV["GraphVisualizer"]
        DP["DecisionPage"]
        CS["ConversationSidebar"]
        BS["backendService.ts"]
    end

    subgraph Orchestrator["Orchestrator (Port 8004)"]
        ORC["orchestrator.js<br/>1,715 lines"]
        RF["responseFormatter.js"]
    end

    subgraph BrainLayer["Routing Intelligence"]
        BR["brainRouter.js<br/>1,258 lines"]
        GP["goldenPathRegistry.js"]
        AA["academicAliases.js"]
        AQN["academicQueryNormalizer.js"]
        RC["routingCalibration.js"]
    end

    subgraph RetrievalLayer["Retrieval Engines"]
        N4J["neo4jcontext.js<br/>1,273 lines"]
        RAG["ragService.js<br/>1,796 lines"]
        DEC["decisionService.js<br/>650 lines"]
        UAS["unifiedAnswerService.js<br/>1,890 lines"]
        FS["fusionService.js<br/>610 lines"]
    end

    subgraph LLMLayer["LLM Infrastructure"]
        OS["ollamaService.js<br/>847 lines"]
        MFM["modelFailoverManager.js"]
        CSM["circuitStateManager.js"]
        GTS["gemmaTelemetryService.js"]
        GRL["gemmaRequestLimiter.js"]
        GWS["gemmaWarmService.js"]
        HM["healthMonitor.js"]
        ORS["ollamaReadinessService.js"]
    end

    subgraph StateLayer["Persistence & State"]
        CVS["conversationService.js"]
        PL["persistenceLayer.js"]
        TG["titleGenerator.js"]
    end

    subgraph External["External Services"]
        NEO[("Neo4j<br/>Port 7687")]
        CHROMA[("ChromaDB<br/>Port 8001")]
        OLLAMA[("Ollama<br/>Port 11434")]
    end

    BS -->|"POST /api/graph/ask"| ORC
    ORC --> AQN
    ORC --> BR
    BR --> GP
    BR --> AA
    BR --> RC
    BR --> RAG
    ORC --> N4J
    ORC --> RAG
    ORC --> DEC
    ORC --> FS
    ORC --> UAS
    ORC --> OS
    ORC --> RF
    ORC --> CVS
    CVS --> PL
    CVS --> TG
    N4J --> NEO
    RAG --> CHROMA
    OS --> MFM
    MFM --> CSM
    MFM --> HM
    MFM --> ORS
    MFM --> GTS
    OS --> GRL
    OS --> GWS
    OS --> OLLAMA
    HM --> OLLAMA
```

---

## Diagram 2: Request Processing Pipeline — Sequence Diagram

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant ORC as Orchestrator
    participant AQN as QueryNormalizer
    participant GP as GoldenPath
    participant BR as BrainRouter
    participant N4J as Neo4j KG
    participant RAG as RAG Service
    participant FS as FusionService
    participant UAS as UnifiedAnswer
    participant OS as OllamaService
    participant RF as ResponseFormatter
    participant CVS as ConversationService

    U->>FE: Submit question
    FE->>ORC: POST /api/graph/ask
    
    ORC->>CVS: getConversation(cid)
    CVS-->>ORC: session context
    
    ORC->>AQN: normalizeAcademicQuery(query)
    AQN-->>ORC: normalized query
    
    Note over ORC: Check greetings & FAQ
    
    ORC->>GP: classifyGoldenQuery(query)
    GP-->>ORC: golden match or null
    
    ORC->>BR: analyzeQuery(query, intent, context)
    BR->>BR: detectRoutingSignals()
    BR->>BR: classifyQuestionFeatures()
    BR->>BR: normalizeSignals()
    BR->>BR: detectAmbiguity()
    BR-->>ORC: route decision + confidence

    par Concurrent Subsystem Dispatch
        ORC->>N4J: fetchNeo4jContext()
        ORC->>RAG: search()
    end
    
    N4J-->>ORC: KG results + graph
    RAG-->>ORC: RAG results + citations

    ORC->>FS: fuse(query, route, results)
    FS->>FS: deduplicateEvidence()
    FS->>FS: rankEvidence()
    FS->>FS: detectEvidenceConflicts()
    FS->>FS: computeFinalConfidence()
    FS-->>ORC: fusion envelope

    ORC->>UAS: generateUnifiedAnswer()
    
    alt LLM Available
        UAS->>OS: generateStableResponse()
        OS-->>UAS: LLM synthesis
    else LLM Unavailable
        UAS->>UAS: buildDeterministicHybridAnswer()
    end
    
    UAS-->>ORC: unified response

    ORC->>RF: format(payload, cid, requestId)
    RF-->>ORC: explainability envelope

    ORC->>CVS: pushTurn(cid, "user", query)
    ORC->>CVS: pushTurn(cid, "assistant", answer)
    
    ORC-->>FE: JSON response
    FE-->>U: Display answer + graph
```

---

## Diagram 3: Brain Router — Signal Fusion Flowchart

```mermaid
flowchart TB
    Q["Input Query"] --> NORM["Normalize Query"]
    NORM --> GOLDEN{"Golden Path<br/>Match?"}
    
    GOLDEN -->|Yes| LOCK["Lock Route<br/>confidence ≥ 0.92"]
    GOLDEN -->|No| FEAT["Extract Question<br/>Features (20+)"]
    
    FEAT --> SIGNALS["Detect Routing<br/>Signals (5 domains)"]
    SIGNALS --> ALIAS["Match Academic<br/>Aliases (316 entries)"]
    ALIAS --> CATEG["RAG Category<br/>Detection"]
    
    CATEG --> INTENT["Apply Intent<br/>Boost"]
    INTENT --> CALIB["Feature<br/>Calibration"]
    
    CALIB --> POLICY{"Deterministic<br/>Policy Query?"}
    POLICY -->|Yes| RAG_LOCK["Boost RAG<br/>Score +1.10"]
    POLICY -->|No| HYBRID{"Hybrid<br/>Candidate?"}
    
    HYBRID -->|Yes| HYB_BOOST["Boost Hybrid<br/>Score +0.40"]
    HYBRID -->|No| NORMALIZE["Normalize<br/>All Signals"]
    
    RAG_LOCK --> NORMALIZE
    HYB_BOOST --> NORMALIZE
    
    NORMALIZE --> AMB{"Ambiguity<br/>Detected?<br/>(diff ≤ 0.08)"}
    
    AMB -->|"KG+RAG close"| PREFER_HYB["Prefer<br/>HYBRID_KG_RAG"]
    AMB -->|No| SELECT["Select Highest<br/>Scoring Route"]
    
    LOCK --> ROUTE["Final Route<br/>Decision"]
    PREFER_HYB --> ROUTE
    SELECT --> ROUTE
    
    ROUTE --> KG["KG_DIRECT"]
    ROUTE --> RAG_R["RAG_DIRECT"]
    ROUTE --> HKR["HYBRID_KG_RAG"]
    ROUTE --> DE["DECISION_ENGINE"]
    ROUTE --> CE["CAREER_ENGINE"]
    ROUTE --> LLM["LLM_FALLBACK"]
```

---

## Diagram 4: Circuit Breaker — State Machine Diagram

```mermaid
stateDiagram-v2
    [*] --> WAITING_FOR_OLLAMA: System Start
    
    WAITING_FOR_OLLAMA --> CLOSED: ollama_ready
    WAITING_FOR_OLLAMA --> OPEN: startup_ollama_unavailable
    
    CLOSED --> DEGRADED: primary_failure_threshold\n(3 failures)
    CLOSED --> PRIMARY_COLD: startup_primary_preload_failed
    
    PRIMARY_COLD --> CLOSED: primary_runtime_success
    PRIMARY_COLD --> DEGRADED: primary_failure_threshold
    
    DEGRADED --> HALF_OPEN: scheduled_recovery_probe\n(every 30s)
    DEGRADED --> OPEN: backup_failure_threshold
    
    HALF_OPEN --> CLOSED: primary_recovery_success\n(2 consecutive)
    HALF_OPEN --> DEGRADED: primary_probe_failed
    HALF_OPEN --> OPEN: backup_failure_threshold
    
    OPEN --> DEGRADED: backup_recovered
    OPEN --> HALF_OPEN: half_open_interval_elapsed

    note right of CLOSED: Primary model active\nAll systems nominal
    note right of DEGRADED: Using backup model\nPrimary being probed
    note right of OPEN: All models failed\nDeterministic fallback only
    note left of PRIMARY_COLD: Primary installed but\npreload failed\nFirst request retries cold start
```

---

## Diagram 5: Evidence Fusion Pipeline

```mermaid
flowchart LR
    subgraph Sources["Raw Evidence Sources"]
        KG["KG Results<br/>officiality: 1.0"]
        RAG_S["RAG Results<br/>officiality: 0.9"]
        DEC_S["Decision<br/>officiality: 0.8"]
        CAR["Career<br/>officiality: 0.7"]
        FAQ_S["FAQ<br/>officiality: 1.0"]
        LLM_S["LLM<br/>officiality: 0.1"]
    end

    subgraph Pipeline["Fusion Pipeline"]
        INGEST["1. Multi-Source<br/>Ingestion"]
        DEDUP["2. SHA-256<br/>Deduplication"]
        RANK["3. Dynamic Priority<br/>Ranking"]
        BUDGET["4. Token Budget<br/>(max 8 items)"]
        CONTRA["5. Pairwise<br/>Contradiction"]
        RESOLVE["6. Conflict<br/>Resolution"]
        CONF["7. Confidence<br/>Aggregation"]
        SYNTH["8. Hybrid Response<br/>Synthesis"]
    end

    subgraph Output["Fusion Envelope"]
        ANS["final_answer"]
        CITE["citations[]"]
        META["metadata{}"]
    end

    KG --> INGEST
    RAG_S --> INGEST
    DEC_S --> INGEST
    CAR --> INGEST
    FAQ_S --> INGEST
    LLM_S --> INGEST
    
    INGEST --> DEDUP --> RANK --> BUDGET --> CONTRA --> RESOLVE --> CONF --> SYNTH
    SYNTH --> ANS
    SYNTH --> CITE
    SYNTH --> META
```

---

## Diagram 6: Golden Path Decision Tree

```mermaid
flowchart TB
    Q["Incoming Query"] --> NORM["Normalize<br/>(AI→Artificial Intelligence)"]
    NORM --> MATCH{"Pattern Match<br/>14 Registry Entries"}
    
    MATCH -->|"priority 100"| FP["Faculty Profile<br/>KG_DIRECT"]
    MATCH -->|"priority 100"| FT["Faculty Teaching<br/>KG_DIRECT"]
    MATCH -->|"priority 98"| CP["Course Prerequisites<br/>KG_DIRECT"]
    MATCH -->|"priority 98"| VD["Vice Dean<br/>KG_DIRECT"]
    MATCH -->|"priority 97"| QU["Quality Unit Head<br/>KG_DIRECT"]
    MATCH -->|"priority 95"| DN["Dean Lookup<br/>KG_DIRECT"]
    MATCH -->|"priority 94"| MC["Major Comparison<br/>DECISION_ENGINE"]
    MATCH -->|"priority 93"| PM["Program Modules<br/>KG_DIRECT"]
    MATCH -->|"priority 92"| MR["Major Recommend<br/>DECISION_ENGINE"]
    MATCH -->|"priority 91"| CR["Career Roadmap<br/>CAREER_ENGINE"]
    MATCH -->|"No match"| BRAIN["Brain Router<br/>Signal Fusion"]

    FP --> LIVE{"Live KG<br/>Returns Data?"}
    LIVE -->|Yes| USE_LIVE["Use Live Response<br/>confidence: dynamic"]
    LIVE -->|No| FALLBACK["Use Static Fallback<br/>confidence: 0.72-0.92"]
```

---

## Diagram 7: Conversation Lifecycle

```mermaid
sequenceDiagram
    participant Client
    participant ORC as Orchestrator
    participant CVS as ConversationService
    participant PL as PersistenceLayer
    participant TG as TitleGenerator

    Client->>ORC: Request (cid or null)
    ORC->>CVS: getConversation(cid)
    
    alt CID exists
        CVS-->>ORC: existing conversation
    else New session
        CVS->>CVS: makeConversationId()
        CVS->>CVS: buildFreshConversation()
        Note over CVS: System prompt injected
        CVS-->>ORC: new conversation
    end

    ORC->>CVS: pushTurn(cid, "user", query)
    CVS->>TG: generateConversationTitle(query)
    TG-->>CVS: auto-generated title
    
    Note over ORC: Process query through pipeline
    
    ORC->>CVS: pushTurn(cid, "assistant", answer)
    CVS->>PL: scheduleSave(conversations)
    
    Note over PL: Debounced write (500ms)
    PL->>PL: Write to conversations.json
```

---

## Diagram 8: Frontend Component Hierarchy

```mermaid
graph TB
    APP["App.tsx<br/>Routes + Auth State"]
    
    APP --> LP["LoginPage<br/>116 lines"]
    APP --> DASH["Dashboard<br/>78 lines"]
    APP --> GUEST["GuestAdvisorPage<br/>39 lines"]
    APP --> DPAG["DecisionPage"]
    APP --> CPAG["ChatPage"]
    APP --> ADMIN["AdminDashboard"]
    
    DASH --> HOME["HomePage"]
    DASH --> ADVP["AdvisorPage"]
    DASH --> CRSP["CoursesPage"]
    DASH --> RESP["ResultsPage"]
    
    ADVP --> CHAT["ChatMessage<br/>80 lines"]
    ADVP --> SIDEBAR["ConversationSidebar<br/>260 lines"]
    ADVP --> GVZ["GraphVisualizer<br/>575 lines"]
    
    GVZ --> GSRCH["GraphSearch<br/>87 lines"]
    GVZ --> GCNTRL["GraphControls<br/>172 lines"]
    GVZ --> GVIEW["GraphView<br/>382 lines"]
    GVZ --> GLEG["GraphLegend<br/>211 lines"]
    GVZ --> GDET["GraphNodeDetails<br/>217 lines"]
    
    GVIEW --> GUTIL["graphUtils.ts<br/>683 lines"]
    
    subgraph Services["Frontend Services"]
        BS["backendService.ts<br/>256 lines"]
        CA["conversationsApi.ts"]
        DA["decisionApi.ts"]
        AS["agentService.ts"]
    end
    
    ADVP --> BS
    SIDEBAR --> CA
    DPAG --> DA
```

---

## Diagram 9: Deployment Topology

```mermaid
graph TB
    subgraph Client["Client Browser"]
        REACT["React 19 SPA<br/>Vite Dev Server :5173"]
    end

    subgraph NodeJS["Node.js Runtime"]
        API["Express API Server<br/>Port 8000"]
        ORCH["Orchestrator<br/>Port 8004<br/>--max-old-space-size=3072"]
    end

    subgraph Docker["Docker Containers"]
        NEO["Neo4j 5.x<br/>Bolt :7687<br/>HTTP :7474"]
    end

    subgraph Python["Python Services"]
        CHROMA["ChromaDB / RAG<br/>Port 8001"]
        NER["NER Service<br/>FastAPI"]
    end

    subgraph SystemService["System Services"]
        OLLAMA["Ollama LLM Server<br/>Port 11434<br/>Gemma4 + TinyLlama"]
    end

    subgraph Storage["Persistent Storage"]
        CONVJSON[("conversations.json")]
        MEMJSON[("decision_memory.json")]
        LOGS[("logs/*.log")]
    end

    REACT -->|HTTP| API
    REACT -->|HTTP| ORCH
    ORCH --> NEO
    ORCH --> CHROMA
    ORCH --> OLLAMA
    ORCH --> CONVJSON
    ORCH --> MEMJSON
    ORCH --> LOGS
    API --> NEO
```

---

## Diagram 10: Data Flow Architecture

```mermaid
flowchart TB
    USER["Student Query"] --> NORMALIZE["Query Normalization<br/>+ Alias Resolution"]
    
    NORMALIZE --> ROUTE{"Route<br/>Classification"}
    
    ROUTE -->|KG_DIRECT| KG_FLOW["Neo4j Cypher<br/>Execution"]
    ROUTE -->|RAG_DIRECT| RAG_FLOW["ChromaDB<br/>Semantic Search"]
    ROUTE -->|HYBRID| BOTH["Parallel KG + RAG"]
    ROUTE -->|DECISION| DEC_FLOW["Rule Engine<br/>Profile Validation"]
    ROUTE -->|CAREER| CAR_FLOW["Career Roadmap<br/>Generation"]
    ROUTE -->|LLM_FALLBACK| LLM_FLOW["Ollama<br/>General Response"]
    
    KG_FLOW --> EVIDENCE["Evidence Pool"]
    RAG_FLOW --> EVIDENCE
    BOTH --> EVIDENCE
    DEC_FLOW --> EVIDENCE
    CAR_FLOW --> EVIDENCE
    LLM_FLOW --> EVIDENCE
    
    EVIDENCE --> FUSION["Fusion Service<br/>Dedup + Rank +<br/>Contradiction Check"]
    
    FUSION --> SYNTH{"LLM<br/>Available?"}
    
    SYNTH -->|Yes| LLM_SYNTH["LLM-Grounded<br/>Synthesis"]
    SYNTH -->|No| DET_SYNTH["Deterministic<br/>Fact Synthesis"]
    
    LLM_SYNTH --> FORMAT["Response<br/>Formatter"]
    DET_SYNTH --> FORMAT
    
    FORMAT --> ENVELOPE["Explainability<br/>Envelope"]
    
    ENVELOPE --> GRAPH_VIZ["Graph<br/>Visualization"]
    ENVELOPE --> TEXT_ANS["Text<br/>Answer"]
    ENVELOPE --> SOURCES["Source<br/>Attribution"]
    ENVELOPE --> CONF["Confidence<br/>Score"]
```

---

*All diagrams are derived directly from source code analysis of the AAST AI Agent Platform codebase. Render using any Mermaid-compatible viewer.*
