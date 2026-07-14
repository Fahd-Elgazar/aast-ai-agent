# CHANGELOG

## 2026-07-14 — Production reliability hardening (audit remediation session)

Implements the fix plan from `reliability-audit/RECOMMENDED_FIX_ORDER.md`. Every item
maps to a root cause (RC-xx) in `reliability-audit/ROOT_CAUSE_ANALYSIS.md` and a
logging gap (LG-xx) in `reliability-audit/LOGGING_GAP_ANALYSIS.md`.
**External behavior (API routes, response schemas, Brain Router interface,
Conversation API) is unchanged** except where explicitly noted as additive.

### Reliability & determinism

- **RC-01 / F1.2 — Sticky last-known-good health with hysteresis**
  (`backend/services/healthProbes.js`, rewritten)
  - Removed the 60s "reset everything to false" staleness rule that made the
    first question after a demo pause route against an all-down snapshot.
  - A subsystem is now marked UP after one successful probe but DOWN only after
    `HEALTH_FAILURE_THRESHOLD` (default 2) consecutive failed cycles.
  - Probe timeouts now count as explicit failures (previously they silently
    kept the last known value, which would have let a hung subsystem stay
    "healthy" forever once the staleness reset was removed).
  - Concurrent health refreshes are deduped into a single probe cycle.
  - New: `getHealthCacheAge()` export; `[HEALTH_TRANSITION]` log on state flips.

- **RC-08 / F1.1 — Golden cache can no longer freeze degraded answers**
  (`backend/orchestrator.js`)
  - `setGoldenCachedPayload` now rejects payloads marked `degraded` or carrying
    `explainability.fallback_reason` (the marker every static golden fallback
    carries). Previously a golden query asked during a transient outage froze
    its degraded answer for the full 10-minute TTL.
  - Synthesis results produced while `degraded_services` is non-empty are also
    excluded (partial hybrid evidence must not be frozen).
  - New metrics/logs: `golden_cache_degraded_write_skipped`,
    `[GOLDEN_CACHE]` / `[GOLDEN_CACHE_WRITE]` (LG-06).

- **RC-03, RC-06 / F1.4 — KG route timeout is now enforced**
  (`backend/orchestrator.js`)
  - `kgTimeoutMs` was computed and logged but never applied; a cold
    `nomic-embed-text` load could stall KG requests 30–60s. `runNeo4jRetrieval`
    now races the retrieval against the budget, degrades cleanly to the
    existing KG_TIMEOUT path, and authoritatively abandons the attempt (late
    results are logged, never resurrected into the response).
  - Non-golden KG default budget set to 12s (`KG_ROUTE_TIMEOUT_MS` overrides);
    golden budgets unchanged.
  - The Neo4j semaphore slot is held until the underlying query actually
    settles, so abandoned queries cannot oversubscribe Neo4j.
  - Audit refinement (evidence): `fetchNeo4jContext` already caught embed
    exceptions internally (`KG_EXCEPTION` empty response), so RC-03's
    "fatal fallback" claim applied only partially — the unbounded stall was
    the real exposure, and it is now bounded.

- **RC-04 / F3.2 — Conversation history can no longer flip routing**
  (`backend/orchestrator.js`)
  - The historical-route boost (`convo.lastRoute`) is now passed to the Brain
    Router only when a follow-up reference was actually detected in the query.
    Unrelated prior questions no longer bias route selection.
    (Brain Router interface unchanged; it simply receives `lastRoute: null`
    for non-follow-ups.)

- **RC-07 / F3.1 — RAG health signal agrees with the circuit breaker**
  (`backend/services/ragService.js`, `backend/services/healthProbes.js`)
  - New `ragService.getCircuitBreakerStatus()`; the health probe reports RAG
    unhealthy while the breaker is OPEN and inside its cooldown, so the router
    stops sending work that `search()` would instantly reject. After cooldown
    the probe reports healthy again so traffic resumes and drives HALF_OPEN
    recovery.

- **RC-12 / F3.4 — Deterministic synthesis mode (default ON)**
  (`backend/config/runtimeMode.js`, `backend/services/unifiedAnswerService.js`,
  `backend/orchestrator.js`)
  - New flag `DETERMINISTIC_SYNTHESIS` (default `true`): all LLM synthesis
    (unified answer profiles 0.10–0.18 and the LLM fallback 0.08) samples at
    temperature 0, so an identical prompt yields identical output.
    Set `DETERMINISTIC_SYNTHESIS=false` to restore the previous profiles.

- **RC-15 / F3.5 — Per-conversation mutex**
  (`backend/orchestrator.js`)
  - Requests sharing a `cid` are serialized (`withConversationLock`); the
    handler was extracted to `handleChatbotQuery` for this. Concurrent turns
    can no longer interleave mutations of the shared conversation object
    (`lastRoute`, `lastCurriculumCourse`, message order). Different
    conversations still execute fully in parallel.

- **Readiness §2 / F1.5 — Dangerous defaults removed**
  (`backend/config/llmConfig.js`)
  - `OLLAMA_BASE_URL` default changed from the hard-coded LAN IP
    `http://192.168.1.7:11434` to `http://127.0.0.1:11434`, with a loud startup
    warning when a non-local host is configured.

### Startup & recovery

- **RC-03 / F1.3 — Embedding model verified and prewarmed at launch**
  (`launcher/start_platform.ps1`)
  - The launcher now checks that `nomic-embed-text` is installed and prewarms
    it via `/api/embeddings` (it previously only handled the generation model,
    leaving the KG path's hidden hard dependency cold or missing).

- **F3.6 — Backend restart supervisor**
  (`launcher/run_supervised.cmd` new, `launcher/start_platform.ps1`)
  - The orchestrator exits on `uncaughtException` by design; the launcher now
    runs it under a restart-on-exit supervisor (3s backoff, capped at 25
    restarts) so a single crash no longer ends the session.

- **Deterministic secret bootstrap**
  (`launcher/start_platform.ps1`)
  - A missing `INTERNAL_SECRET_KEY` no longer aborts preflight: the launcher
    generates one and persists it to `backend/.env` (duplicated check blocks
    consolidated into `Ensure-BackendSecret`).

### Observability (LOGGING_GAP_ANALYSIS.md implementation)

- **Trace ID (F2.1)** — `requestId` is now `crypto.randomUUID()` (was
  `Date.now()`, which collided within a millisecond). Propagated to RAG as an
  `x-trace-id` header via `ragService.search(query, { traceId })` →
  `requestWithRetry`. Response schema unchanged in shape (`requestId` remains
  an opaque value; the frontend does not consume it).
- **LG-01** `[HEALTH_SNAPSHOT]` — the exact health flags + cache age used for
  each request's routing.
- **LG-02** `[ROUTE_DECISION]` — intent, whether lastRoute was applied,
  initial vs final route, confidence, override reasons, top-2 signals.
- **LG-03** Brain Router `CONTEXT_BOOST` log whenever historical-route bias is
  applied.
- **LG-04/LG-05** `[KG_EMBED]`, `[KG_EMPTY]`, `[KG_EXCEPTION]` — embedding
  outcome/latency and empty-result attribution in `neo4jcontext.js`.
- **LG-06** `[GOLDEN_CACHE]` / `[GOLDEN_CACHE_WRITE]` read/write/skip events.
- **LG-07** `timeoutWrapper(promise, ms, fallback, label)` — timeouts and
  swallowed errors now log `[TIMEOUT_DEGRADE] stage=<label>` at every labeled
  call site (RAG route/hybrid/fallback/multi-intent, decision, career,
  LLM fallback, unified synthesis, fusion fallback, KG retrieval, health
  probes). Signature change is backward compatible.
- **LG-08** `[GEMMA_QUEUE] result=OVERFLOW` with request id, active/pending
  depth in `gemmaRequestLimiter.js`.
- **LG-09** `pipeline_complete` in `unifiedAnswerService.js` now records
  temperature, top_p, deterministic flag, retrieval confidence, degraded state.
- **REQ_EXPLAIN** — one consolidated per-response line (cid, route, tier,
  confidence, degraded services, health snapshot, latency) so any
  "same question, different answer" incident is a single grep.

### Tests

- `backend/testing/normalizationSmoke.js` — fixed a stale expansion assertion
  that predated `detectExactOntologyEntity` (exact ontology entities such as
  "robotics lab" intentionally bypass generic expansion; verified as intended
  behavior, not a production bug). Added a non-exact expansion contract case.
  **This test failed on the pre-change baseline; it now passes.**

### Verification performed

- `node --check` on all nine modified backend files: pass.
- Routing regression `npm run test:routing`: **23/23** before and after every
  change batch (no routing behavior drift for non-follow-up queries).
- `normalizationSmoke.js`: pass (was failing pre-session).
- Import/behavior micro-tests: `timeoutWrapper` timeout/success/error paths,
  `getHealthCacheAge`, `getCircuitBreakerStatus` shape,
  `deterministicSynthesis` default.
- PowerShell parser validation of `start_platform.ps1`: no syntax errors.
- Live boot smoke on isolated port 18004 with Neo4j down:
  clean start, greeting route 200, 3 concurrent same-cid requests all 200
  (serialized by mutex), KG query degraded gracefully to the deterministic
  empty-evidence answer with UUID trace id; `HEALTH_SNAPSHOT`,
  `ROUTE_DECISION`, `REQ_EXPLAIN`, `HEALTH_TRANSITION` all observed firing;
  identical repeated requests produced identical route decisions.

### Deferred (documented, not regressions)

- RC-02 (RAG stack absent in `demo` launcher mode) is operational: run
  `-Mode full` for policy questions, or accept deterministic degradation
  (which is now stable thanks to health hysteresis).
- RC-09 (single Gemma slot) intentionally unchanged — raising
  `GEMMA_MAX_ACTIVE_REQUESTS` requires host-RAM validation.
- RC-11 (memory-pressure adaptive sampling) retained as a stability guard;
  its effects are now logged (LG-09).
- RC-13 (Gemini humanizer variance) remains config-gated off by default.
