# SYSTEM_ARCHITECTURE_ANALYSIS.md

**Audit type:** Production reliability / intermittent-behavior investigation
**Scope:** Whole platform, read-only. No code was modified.
**Date:** 2026-07-13
**Method:** Direct source reading with file:line evidence. Where a conclusion is uncertain it is marked **[INFERENCE]**.

---

## 1. Executive summary of the architecture

This is a **hybrid academic-advisor platform** built from four independently-launched processes plus three external data stores, orchestrated by a single Node.js Express service. The Express "orchestrator" is the brain: every chat turn enters through `POST /api/chatbot/query` and is routed — via a rules+signals **Brain Router** and a large chain of deterministic overrides — into one of several retrieval/answer engines (Knowledge Graph, RAG, Decision, Career, FAQ, or LLM fallback), then optionally through an **LLM synthesis** layer and an optional **Gemini humanizer**.

The system was **deliberately hardened toward determinism**: by default (see `config/runtimeMode.js` and `.env.example`) the LLM intent classifier is **off**, single-generation mode is **on**, graph refinement / RAG answer-engine / humanizer are **off**. In that default posture, the "golden" and deterministic KG/RAG paths bypass the LLM entirely and are pure string assembly.

**The intermittent behavior therefore does not come primarily from LLM randomness.** It comes from **which route is selected** and **whether each subsystem is considered available at the moment of the request** — both of which depend on mutable, time-windowed, and conversation-scoped state. See `ROOT_CAUSE_ANALYSIS.md`.

---

## 2. Process / deployment topology

Launched by `launcher/start_platform.ps1` (modes: `quick`, `demo` [default], `full`).

| Component | Tech | Port | Started in mode | Evidence |
|---|---|---|---|---|
| Frontend | React (Vite dev server) | 5173 | all | `start_platform.ps1:1040` |
| **Orchestrator** | Node.js / Express (ESM) | 8004 | all | `orchestrator.js:80`, `start_platform.ps1:1029` |
| Decision API | FastAPI (Python) | 8005 | demo, full | `start_platform.ps1:1016`, `college-decision-system-backend/app/main.py` |
| RAG Retriever | FastAPI (Python) + Qdrant | 8001 | **full only** | `start_platform.ps1:985` |
| RAG Answer Engine | FastAPI (Python) | 8002 | **full only** | `start_platform.ps1:1000` |
| Qdrant | Docker container `qdrant_prod` | 6333 | **full only** | `start_platform.ps1:509` |
| Neo4j | Bolt (external, manual) | 7687 | demo, full (port-checked, not started) | `start_platform.ps1:968` |
| Ollama | local runtime | 11434 | demo, full (auto-started) | `start_platform.ps1:555` |

### 2.1 Critical topology fact
**In `demo` mode (the default), the entire RAG stack — Qdrant, retriever (8001), answer engine (8002) — is never started** (`start_platform.ps1:971` guards them behind `$Mode -eq "full"`). Any query the router sends to `RAG_DIRECT` / `RAG_ONLY` / `HYBRID_KG_RAG` will find nothing listening on 8001. See `ROOT_CAUSE_ANALYSIS.md#RC-02`.

---

## 3. Subsystem inventory (orchestrator internal services)

All under `aast-ai-agent-main/backend/services/` unless noted.

| Subsystem | File | Role |
|---|---|---|
| Orchestrator entry | `orchestrator.js` (3358 lines) | HTTP handler, routing overrides, pipeline execution, fallbacks, golden cache |
| Brain Router | `brainRouter.js` (1561) | Signal scoring → route + fallback chain; health-gated |
| Routing calibration | `config/routingCalibration.js` | Thresholds/boosts (env-overridable) |
| Golden Path Registry | `config/goldenPathRegistry.js` (539) | Hard-coded showcase query → route locks + static fallbacks |
| Runtime mode | `config/runtimeMode.js` | Feature flags (intent LLM, humanizer, single-gen, etc.) |
| KG context | `services/neo4jcontext.js` (3411) | Cypher retrieval, **Ollama embeddings**, fact selection |
| Neo4j driver | `db/neo4j.js` | Singleton driver + lazy reconnect |
| RAG service | `services/ragService.js` (2206) | Multi-pass HTTP retrieval to 8001/8002 + **its own circuit breaker** |
| Decision service | `services/decisionService.js` (879) | HTTP to FastAPI 8005 + local rule fallbacks |
| Unified Answer | `services/unifiedAnswerService.js` (2821) | LLM synthesis (Gemma→Gemini→deterministic), confidence gating |
| Fusion service | `services/fusionService.js` (700) | Secondary synthesis fallback |
| Ollama service | `services/ollamaService.js` (980) | Gemma calls, retries, prompt budget, memory-pressure sampling |
| Model failover mgr | `services/modelFailoverManager.js` (620) | Circuit breaker, primary/backup routing, warmup |
| Gemma queue | `services/gemmaRequestLimiter.js` (130) | **Single-slot** concurrency limiter + queue |
| Gemma telemetry | `services/gemmaTelemetryService.js` (296) | Memory-pressure snapshots that drive sampling |
| Gemini service | `services/geminiService.js` (256) | Cloud backup synthesis + humanizer backend |
| Health probes | `services/healthProbes.js` (193) | **15s-cached** subsystem health used by router |
| Health monitor | `services/healthMonitor.js` (477) | Background health aggregation |
| Conversation svc | `services/conversationService.js` (765) | Per-cid memory, `lastRoute`, disk persistence |
| Conversation priority | `services/conversationPriority.js` (368) | Light intent, follow-up resolution, multi-intent |
| Conversation meta | `services/conversationMetaIntent.js` (415) | "What did I ask" style local answers |
| Humanizer | `services/conversationalHumanizer.js` (401) | Deterministic expansion + optional Gemini rewrite |
| Academic normalizer | `services/academicQueryNormalizer.js` (385) | Spelling/alias normalization of the raw query |
| Response formatter | `services/responseFormatter.js` (266) | Final envelope shape |
| Metrics / logger | `services/metrics.js`, `services/logger.js` | Counters + structured logs |

---

## 4. External dependencies (hard runtime requirements)

1. **Neo4j** (bolt 7687) — every KG route. Must be started manually and populated. `db/neo4j.js:11`.
2. **Ollama generation model** `gemma4:e2b` (11434) — every LLM synthesis + intent (if enabled). `config/llmConfig.js:51`.
3. **Ollama embedding model** `nomic-embed-text` (11434) — **every KG semantic (vector) retrieval** for GENERAL and non-aggregation PERSON/TEACHING intents. `neo4jcontext.js:16-38`. This dependency is **not checked or warmed by the launcher** (`start_platform.ps1:600` only tests the primary generation model).
4. **Qdrant + RAG FastAPI** (6333/8001/8002) — every RAG route. Only present in `full` mode.
5. **Decision FastAPI** (8005) — DECISION_ENGINE route + decision health probe. `decisionService.js`, `healthProbes.js:59`.
6. **Gemini API** (cloud) — backup synthesis + humanizer, if enabled. Requires `GEMINI_API_KEY`.

---

## 5. Configuration surface (why the same code behaves differently)

There is **no committed `.env`** — only `.env.example`. Effective configuration comes from:
1. Launcher `Apply-ModeEnvironment` (`start_platform.ps1:741-840`) which sets process env vars per mode, **or**
2. A hand-created `backend/.env` (read by `dotenv` in `llmConfig.js:3`, `runtimeMode.js:3`), **or**
3. **JS hard-coded fallbacks** when neither provides a value.

The JS fallbacks diverge sharply from both `.env.example` and the launcher — most dangerously `OLLAMA_BASE_URL` defaults to the hard-coded LAN IP `http://192.168.1.7:11434` (`llmConfig.js:46-49`). If the orchestrator is ever started **without** the launcher and **without** a `.env`, every LLM/embedding call targets a specific machine that may not exist on the demo network. See `PRODUCTION_READINESS_REPORT.md`.

The launcher `demo` profile is the intended demo config. Key demo values: single Gemma active slot (`GEMMA_MAX_ACTIVE_REQUESTS` unset → default **1**), 20 s LLM/RAG timeouts, RAG stack **absent**, `keep_alive=15m`, warm pool on.

---

## 6. Data stores

- **Neo4j** — the knowledge graph (faculty, courses, prerequisites, curriculum, ontology). Source of truth for KG routes.
- **Qdrant** — vector store for RAG policy documents (`rag_system/cleaned_chunked_cai_production_v4.json` ingested by `phase2_qdrant_ingestion.py`).
- **SQLite** — Decision API persistence (`college-decision-system-backend/app/infrastructure/db/`).
- **`data/conversations.json`** — disk-persisted conversation memory (per-cid `messages`, `lastRoute`, `conversationMemory`, `lastCurriculumCourse`). Written debounced (`conversationService.js:29`, `persistenceLayer.js`). Persists **across restarts**, so stale routing state survives restarts.
- **In-memory caches** (all module-level, all lost on restart): `goldenResponseCache` (10 min TTL), `intentCache` (5 min TTL), `neo4jCache`, `cachedHealth` (15 s), RAG circuit-breaker state, Gemma failover/breaker state, Gemma memory-pressure snapshot.

---

## 7. Determinism posture by route (default demo config)

| Route | LLM used? | Deterministic? | Main variability source |
|---|---|---|---|
| GREETING / FAQ / CONVERSATION_* / META | No | Yes | none |
| Golden KG_DIRECT (cacheable) | No | Yes *once cached* | **golden cache poisoning**, KG availability at first ask |
| KG_DIRECT / KG_ONLY (deterministic bypass) | No | Mostly | **embedding availability**, health gate, empty-result variance |
| RAG_DIRECT / RAG_ONLY | No (direct) / synthesis (indirect) | Partly | **RAG stack absent in demo**, circuit breaker |
| HYBRID_KG_RAG | Synthesis | No | Gemma temp, memory pressure, partial failures |
| DECISION / CAREER | Synthesis (unless golden rule bypass) | Partly | Decision API health, timeouts |
| LLM_FALLBACK | Synthesis | No | reached only when signals/health collapse |

The key insight for the whole audit: **route selection is the dominant lever**, and route selection is a function of `(query, intent, convo.lastRoute, live health snapshot, golden-path match)` — three of which are non-stationary. See `REQUEST_EXECUTION_FLOW.md` and `ROOT_CAUSE_ANALYSIS.md`.
