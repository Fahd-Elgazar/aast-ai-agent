# AAST AI Agent Platform — Component-Level System Description

> **Scope:** Exhaustive per-module technical specification for all 25+ backend services and 13+ frontend components.

---

## I. Core Pipeline Components

### 1. Orchestrator (`orchestrator.js` — 1,715 lines)

**Purpose:** Central traffic controller for the entire agent platform. Receives all user-facing HTTP requests and routes them through the 8-stage deterministic pipeline.

**Key Endpoints:**
- `POST /api/graph/ask` — Primary advisor endpoint (golden path → brain router → fusion → response)
- `POST /api/chatbot/query` — Legacy query endpoint (maintained for backward compatibility)
- `GET /api/health` — System health aggregation endpoint
- `POST /api/conversations/*` — Conversation CRUD operations

**Critical Functions:**
- **Query normalization** via `academicQueryNormalizer.js`
- **Semaphore-controlled concurrency** for parallel KG/RAG/LLM calls
- **Session context injection** from `conversationService.js`
- **Timeout wrapping** via `healthProbes.js` for each subsystem call
- **Route telemetry recording** via `metrics.js`

**Dependencies:** brainRouter, fusionService, ragService, neo4jcontext, ollamaService, unifiedAnswerService, decisionService, conversationService, responseFormatter, goldenPathRegistry, healthProbes, metrics, logger

---

### 2. Response Formatter (`responseFormatter.js` — 244 lines)

**Purpose:** Guarantees every API response conforms to the Phase 8 Universal Explainability Contract.

**Output Envelope:**
```typescript
{
  answer: string;
  final_answer: string;
  route: NormalizedRoute;
  confidence: number;        // 0.0–1.0, auto-normalized
  used_facts: string[];
  missing_information: string[];
  graph: { nodes: Node[], links: Link[] };
  source: string;
  sources: string[];
  explainability: object;
  citations: string[];
  reasoning: string;
  metadata: { trace: TraceData };
  cid: string;
  requestId: string;
}
```

**Format Methods:**
| Method | Use Case |
|---|---|
| `format()` | Standard fusion-backed responses |
| `formatInteractive()` | Decision engine profile collection prompts |
| `formatStatic()` | FAQ and greeting responses |
| `formatErrorFallback()` | Degraded/fatal fallback responses |

**Route Normalization Map:** HYBRID, KG_DIRECT, RAG_DIRECT, KG, RAG, DECISION, CAREER, FAQ, INTERACTIVE, LLM

---

## II. Routing & Classification Components

### 3. Brain Router (`brainRouter.js` — 1,258 lines)

**Purpose:** Enterprise-grade semantic query classifier replacing shallow if/else matching.

**Class: `BrainRouter`**

| Method | Purpose | Complexity |
|---|---|---|
| `analyzeQuery()` | Master analysis entry point — combines all signal sources | High |
| `classifyQuestionFeatures()` | 20+ feature extraction (person, teaching, prereq, scholarship, GPA, program, comparison, advisory, planning) | High |
| `detectRoutingSignals()` | Lexical dictionary matching across 5 domains (KG, RAG, Decision, Career, FAQ) | Medium |
| `normalizeSignals()` | Theoretical-max normalization to prevent domain bias | Medium |
| `detectAmbiguity()` | Top-2 route proximity analysis | Medium |
| `applyFeatureCalibration()` | Multi-factor signal adjustment based on entity confidence, aliases, hybrid triggers | High |
| `applyGoldenPathCalibration()` | Golden path signal override with route locking | Medium |
| `isDeterministicAcademicQuery()` | 20+ regex patterns for factual academic queries | Low |
| `classifyDeterministicPolicyQuery()` | 8-domain policy pattern matching with score aggregation | Medium |
| `recordRouteMetrics()` | Real-time analytics recording | Low |

**Signal Dictionary:**
- KG signals: 68 tokens (courses, faculty, departments, institution-specific terms)
- RAG signals: 45 tokens (policies, regulations, fees, scholarships, admissions)
- Decision signals: 13 tokens (recommend, compare, advise)
- Career signals: 13 tokens (career, roadmap, job, salary)
- FAQ signals: 12 tokens (location, contact, wifi)

---

### 4. Golden Path Registry (`goldenPathRegistry.js` — 540 lines)

**Purpose:** Pre-validated query pattern matching with deterministic routing and static fallback payloads.

**Exports:**
- `classifyGoldenQuery(query)` — Returns golden match or null
- `extractGoldenEntities(match, query)` — Entity extraction from matched patterns
- `parseComparisonEntities(query)` — Major-vs-major entity parsing
- `buildGoldenFallbackPayload(match)` — Static response with pre-computed graph
- `getGoldenPrewarmQueries()` — Cache prewarm query list

**Fallback Payloads:** Each golden path includes pre-computed `{ answer, confidence, facts[], graph{nodes[], links[]} }` for use when the live KG doesn't return a stronger result.

---

### 5. Academic Aliases (`academicAliases.js` — 316 lines)

**Purpose:** Maps surface-form variations to canonical academic entity names.

**Structure:** Groups with `{ canonical, aliases[], category }` where categories include `faculty_person`, `faculty_role`, `course`, `department`.

**Usage:** The `matchAliasSignals()` function in brainRouter performs longest-match-first alias resolution, boosting KG routing confidence for recognized entities.

---

### 6. Academic Query Normalizer (`academicQueryNormalizer.js` — 183 lines)

**Purpose:** Pre-processing layer for query text standardization.

**Operations:**
1. Whitespace collapsing and trimming
2. Arabic transliteration handling
3. Abbreviation expansion (AI → Artificial Intelligence, NLP → Natural Language Processing)
4. Case normalization for entity matching
5. Special character sanitization

---

### 7. Routing Calibration (`routingCalibration.js` — ~50 lines)

**Purpose:** Externalized threshold configuration for brain router tuning.

**Key Parameters:**
- `kgConfidenceThreshold` — Minimum score for KG_ONLY routing
- `llmFallbackThreshold` — Below this, route to LLM
- `hybridConfidenceThreshold` — Trigger threshold for hybrid candidate detection
- `ambiguityMargin` — Maximum delta between top-2 routes before ambiguity activates
- `personAliasBoost` — Weight for named entity resolution (0.58)
- `requirementsHybridBoost` — Hybrid boost for requirements queries
- `scholarshipHybridBoost` — Hybrid boost for scholarship queries
- `historicalRouteBoost` — Session context continuity weight

---

## III. Retrieval Engine Components

### 8. Neo4j Context Service (`neo4jcontext.js` — 1,273 lines)

**Purpose:** Generates and executes Cypher queries against the academic knowledge graph.

**Key Functions:**
| Function | Purpose |
|---|---|
| `fetchNeo4jContext(query, intent, entities)` | Master retrieval dispatcher |
| `buildTeachingCypher()` | Person-Course TEACHES relationship queries |
| `buildPrerequisiteCypher()` | Course dependency chain traversal |
| `buildLeadershipCypher()` | Dean/Vice-Dean role resolution |
| `buildProgramCypher()` | Major-module-course hierarchy |
| `convertToGraphData()` | Neo4j records → `{nodes[], links[]}` |

**Confidence Scoring:** Each result carries a confidence score based on:
- Match type (exact name > fuzzy > partial)
- Relationship proximity (direct > 2-hop > 3-hop)
- Entity specificity (course code > general term)

---

### 9. RAG Service (`ragService.js` — 1,796 lines)

**Purpose:** Multi-pass semantic retrieval engine for academic policy documents.

**Pipeline:**
1. `detectQueryCategory(query)` — 8-domain weighted scoring
2. `expandAcademicSynonyms(query)` — Domain-specific synonym generation
3. Primary search pass with original query
4. Synonym-expanded fallback pass (if primary returns insufficient results)
5. Confidence reranking based on category alignment
6. Source file citation extraction

**Policy Domains:** GPA, Transfer, Probation, Scholarship, Admission, Tuition, Regulation, Academic Calendar

---

### 10. Unified Answer Service (`unifiedAnswerService.js` — 1,890 lines)

**Purpose:** Final synthesis layer that integrates retrieval results into coherent academic advisory responses.

**Critical Function: `buildDeterministicHybridAnswer()`**

This function is the platform's **zero-hallucination guarantee**. When LLM inference is unreliable (timeout, circuit breaker open, memory pressure critical), it synthesizes responses purely from structured facts:

```
Input:  { kg_facts[], rag_facts[], route, confidence }
Output: { answer, used_facts[], graph{}, confidence }
```

No LLM is involved. The response is constructed from verified institutional data only.

**Synthesis Modes:**
1. **LLM-Grounded** — Full LLM synthesis with fact injection and source attribution
2. **Deterministic Hybrid** — Fact-only synthesis, no LLM
3. **Golden Path Static** — Pre-computed response from registry
4. **Safe Advisory Fallback** — Context-aware "contact the office" guidance

---

### 11. Decision Service (`decisionService.js` — 650 lines)

**Purpose:** Rule-based academic decision support with persistent student profiles.

**Key Functions:**
| Function | Purpose |
|---|---|
| `getRecommendation(profile)` | Multi-factor major recommendation |
| `compareMajors(major1, major2)` | Side-by-side comparison |
| `buildCareerRoadmap(major)` | Skill-path and industry demand mapping |
| `getUserMemory(sessionId)` | Retrieve persistent student context |
| `updateUserMemory(sessionId, data)` | Update career preferences |
| `deleteUserMemory(sessionId)` | Session cleanup |

**Score Breakdown Factors:**
- Interest alignment (weight varies by profile completeness)
- Affordability assessment
- Employment outlook / market demand
- Location preference matching
- Career flexibility scoring
- Certificate compatibility
- Data completeness penalty

---

## IV. LLM Infrastructure Components

### 12. Ollama Service (`ollamaService.js` — 847 lines)

**Purpose:** Centralized LLM inference interface with budget-aware prompting and retry resilience.

**Key Function: `generateStableResponse()`**

```
Input:  { model, prompt, options, budget }
Output: { text, model_used, latency_ms, retries }
```

**Features:**
- Token budget enforcement (light/intent/synthesis/heavy/fallback)
- Memory-pressure-dependent context window reduction
- Exponential backoff retry with overload-specific delay
- Request deadline enforcement (22s default)
- Cold-start detection and extended timeout (30s)

---

### 13. Model Failover Manager (`modelFailoverManager.js` — 536 lines)

**Purpose:** Orchestrates the full model lifecycle including startup validation, health monitoring, and failover routing.

**Lifecycle:**
1. `start()` → `runStartupSequence()`
2. `readinessService.waitForReady()` — Polls Ollama `/api/tags` endpoint
3. `validateStartupModels()` — Checks primary + backup model installation
4. `preloadValidatedStartupModels()` — Warms models into memory
5. `startBackgroundHealthLoops()` — Periodic health + recovery probes

**Runtime Flow:**
```
getInitialRoute(requestedModel)
  → breaker CLOSED?     → role: "primary",  model: gemma4
  → breaker DEGRADED?   → role: "backup",   model: tinyllama
  → breaker OPEN?       → role: "none",     model: null
```

---

### 14. Circuit State Manager (`circuitStateManager.js` — 259 lines)

**Purpose:** Pure state machine for LLM availability tracking. See Section 4.1 of Master Report for FSM diagram.

### 15. Gemma Telemetry Service (`gemmaTelemetryService.js` — 263 lines)

**Purpose:** Real-time resource monitoring for the primary Gemma model.

**Metrics:** Active requests, queue depth, memory pressure (RSS-based), context size, average generation latency, overload retries, warm pool status.

### 16. Gemma Request Limiter (`gemmaRequestLimiter.js` — 108 lines)

**Purpose:** Semaphore-based concurrency gate (max 1 active request) with queue overflow protection (max depth 24).

### 17. Gemma Warm Service (`gemmaWarmService.js` — 143 lines)

**Purpose:** Background keep-alive probe to prevent Gemma model eviction from memory.

### 18. Health Monitor (`healthMonitor.js` — 422 lines)

**Purpose:** Tag-based model availability verification and preload management.

### 19. Ollama Readiness Service (`ollamaReadinessService.js` — 172 lines)

**Purpose:** Startup readiness polling with configurable timeout and phase tracking.

**Phases:** `WAITING` → `STARTUP_VALIDATING_MODELS` → `STARTUP_PRELOADING_MODELS` → `READY`

---

## V. Persistence & State Components

### 20. Conversation Service (`conversationService.js` — 338 lines)

**Purpose:** Disk-persistent conversation store with debounced JSON serialization.

**Features:**
- Auto-generated conversation IDs (16-char hex)
- Message normalization (role, content, timestamp, ID)
- Context window management (`MAX_CONTEXT_TURNS` = 12)
- Title auto-generation from first user message
- Pin/rename/delete operations
- Search across title and message preview

### 21. Persistence Layer (`persistenceLayer.js` — 90 lines)

**Purpose:** Generic JSON file persistence with debounced writes to prevent disk thrashing.

### 22. Title Generator (`titleGenerator.js` — 79 lines)

**Purpose:** Automatic conversation title generation from user message content.

---

## VI. Observability Components

### 23. Logger (`logger.js` — 571 lines)
Category-scoped, security-sanitized, file-rotated structured logging. See Section 7.1 of Master Report.

### 24. Metrics (`metrics.js` — 191 lines)
Real-time counter aggregation for route distribution, confidence, and system health.

### 25. Health Probes (`healthProbes.js` — 170 lines)
Subsystem connectivity verification (Neo4j, Ollama, RAG) with configurable timeout wrapping.

---

## VII. Frontend Components

### 26. GraphVisualizer (`GraphVisualizer.tsx` — 575 lines)
Master graph explorer orchestrating search, controls, legend, node inspector, and fullscreen mode.

### 27. graphUtils (`graphUtils.ts` — 683 lines)
Graph data normalization, entity type classification (Person, Course, Major, College, Role, Policy), degree computation, and layout utilities.

### 28. GraphView (`GraphView.tsx` — 382 lines)
D3 force-directed simulation canvas with node coloring, link rendering, hover/select interactions.

### 29. GraphNodeDetails (`GraphNodeDetails.tsx` — 217 lines)
Entity inspector panel showing node properties, connected relationships, and navigation to linked entities.

### 30. GraphLegend (`GraphLegend.tsx` — 211 lines)
Dynamic type legend with toggle filtering and relationship focus highlighting.

### 31. ConversationHistorySidebar (`ConversationHistorySidebar.tsx` — 260 lines)
Multi-session conversation management with search, pin, rename, delete, and session switching.

### 32. backendService (`backendService.ts` — 256 lines)
Frontend API client with response normalization (graph, decision, confidence), local history fallback, and mock mode.

### 33. GraphControls (`GraphControls.tsx` — 172 lines)
Toolbar for zoom, fit, reset, physics toggle, label toggle, fullscreen, panel mode, legend mode, and inspector controls.

---

*This document provides exhaustive component-level specification for all modules in the AAST AI Agent Platform. Each entry maps directly to the source code files in the repository.*
