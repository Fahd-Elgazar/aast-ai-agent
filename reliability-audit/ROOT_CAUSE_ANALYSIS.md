# ROOT_CAUSE_ANALYSIS.md

Each finding below follows the requested template. **Probability** = likelihood this mechanism is a real contributor to the observed "same question, different result" symptom, given the code as written. All claims are backed by file:line evidence; uncertain links are marked **[INFERENCE]**.

Symptom mapping (from the brief):
- *returns nothing / "I don't know"* → RC-01, RC-02, RC-03, RC-06, RC-08
- *routes incorrectly* → RC-01, RC-04, RC-05
- *times out* → RC-03, RC-06, RC-09, RC-10
- *ignores available data* → RC-01, RC-02, RC-07
- *behaves differently (wording/quality)* → RC-08, RC-11, RC-12, RC-13

---

## RC-01 — Health-probe cache flapping changes the route for identical queries
**Risk: CRITICAL. Probability: 90%.**

**Description.** `checkSubsystemHealth()` returns a module-level snapshot `cachedHealth` refreshed at most every 15 s, and force-reset to **all-false** if older than 60 s (`healthProbes.js:24-27, 85-94`). This snapshot (`health.kg/rag/decision/career/faq/llm`) gates nearly every branch of `brainRouter.determineBestRoute` (`brainRouter.js:1064-1408`) and the orchestrator's KG-empty→RAG escalation (`orchestrator.js:2308`).

**Why it causes intermittent behavior.** Between two identical asks, the health snapshot can differ because (a) it lands in a new 15 s window whose probes momentarily timed out, or (b) more than 60 s elapsed (a natural demo pause while the presenter talks), which **resets every subsystem to `false`** before re-probing; if any probe then times out, that subsystem is reported down and stays down for the next 15 s. A subsystem seen as "down" reroutes the query (e.g., HYBRID→KG_ONLY, KG golden→RAG_DIRECT, RAG→LLM_FALLBACK), producing a different — often worse — answer.

**Evidence.** `healthProbes.js:76-193`. Probe timeouts: KG 2000 ms, RAG `RAG_HEALTH_TIMEOUT_MS` (demo **800 ms**), LLM 2000 ms. Router consumption: `brainRouter.js:1064-1071` and every `health.*` check thereafter.

**Files/functions.** `healthProbes.js::checkSubsystemHealth`, `getCachedSubsystemHealth`; `brainRouter.js::determineBestRoute`; `orchestrator.js:1153`.

**Execution path.** request → `checkSubsystemHealth({})` → possibly stale/flapped `cachedHealth` → `determineBestRoute(analysis, health)` → route.

**Reproduce.** Ask a HYBRID/RAG query, wait >60 s, ask again while the RAG or Neo4j probe is momentarily slow (or, in demo mode, RAG is simply down). Route/answer differs.

**Verify.** Log the exact `healthStatus` object used per request next to the chosen route (see `LOGGING_GAP_ANALYSIS.md#LG-01`) and diff across identical asks. Watch `health_probe_failures_*` counters (`healthProbes.js:179-184`).

**Impact on demo.** High. Pauses between questions are the norm in a live demo, and the 60 s reset makes the *first question after a pause* the most likely to misroute.

---

## RC-02 — Demo mode never starts the RAG stack, so every policy/RAG route degrades
**Risk: CRITICAL. Probability: 85%** (certainty that RAG is down in demo mode: 100%; probability it's a *cause of the perceived inconsistency*: high, especially if the operator sometimes runs `full`).

**Description.** `start_platform.ps1` starts Qdrant/retriever/answer **only in `full` mode** (`:971` guard). In `demo` (default), nothing listens on 8001/8002/6333, yet `RAG_BASE_URL=http://127.0.0.1:8001` is still configured (`.env.example`, launcher `:748`).

**Why intermittent.** Two ways: (1) if the operator sometimes launches `full` and sometimes `demo`, the *same* policy question (GPA, scholarship, admission, transfer) is answered from real RAG once and from a degraded KG/LLM fallback the next time. (2) Within demo mode, RAG health is consistently false, so any query that *would* route to RAG is silently rerouted or answered "I couldn't find verified institutional policy evidence" (`orchestrator.js:2517`).

**Evidence.** `start_platform.ps1:971-1013` (RAG under `full` only); `orchestrator.js:2469-2535` (RAG route + empty guard).

**Files/functions.** launcher; `ragService.js::search/healthCheck`; `orchestrator.js` RAG branch.

**Reproduce.** Launch `demo`, ask "What is the minimum GPA to avoid academic probation?". Then launch `full` and ask the same. Compare.

**Verify.** `curl http://127.0.0.1:8001/health` in demo → connection refused. Router audit shows `RAG_UNHEALTHY_*` / `degraded_services: ["RAG_TIMEOUT"]`.

**Impact on demo.** High — policy questions are a natural thing for professors to ask.

---

## RC-03 — KG semantic retrieval hard-depends on the Ollama `nomic-embed-text` model, which is never verified or warmed
**Risk: CRITICAL. Probability: 70%.**

**Description.** For GENERAL and non-aggregation PERSON/TEACHING intents, `fetchNeo4jContext` calls `embed()` → `POST {OLLAMA_BASE_URL}/api/embeddings {model:"nomic-embed-text"}` (`neo4jcontext.js:16-38, 3207`). The launcher only checks/prewarms the **generation** model `gemma4:e2b` (`start_platform.ps1:600-621, 623-662`); `nomic-embed-text` is never listed, pulled, or warmed.

**Why intermittent.** (a) If the model is present but cold, the **first** embedding call blocks while Ollama loads it (competing with Gemma for memory) → slow → possibly no orchestrator-level timeout on the KG path (`REQUEST_EXECUTION_FLOW.md#2.1`) → long stall or empty. (b) If it is absent, `embed()` throws after 2 attempts (`neo4jcontext.js:87`), the KG branch rejects, and the request lands in the fatal-fallback catch (`orchestrator.js:3245`) → generic "systems temporarily unavailable." Whether the model is warm depends on prior traffic, so identical KG questions can succeed or fail.

**Evidence.** `neo4jcontext.js:16-88, 3206-3215`; `start_platform.ps1:600-662` (no embed-model handling).

**Reproduce.** With `nomic-embed-text` not pulled, ask a GENERAL KG question ("What modules are in the AI program?"). Then `ollama pull nomic-embed-text`, warm it, ask again.

**Verify.** Metrics `embedding.timeout`, `embedding.error`, `embedding.failed` (`neo4jcontext.js:67,75,86`). `ollama ps` to see whether the embed model is resident.

**Impact on demo.** High for the first KG question, and after any long idle if `keep_alive` unloaded the embed model.

---

## RC-04 — Conversation `lastRoute` biases routing (context contamination across turns)
**Risk: HIGH. Probability: 65%.**

**Description.** After each turn the chosen route is written to `convo.lastRoute` and persisted (`orchestrator.js:1275-1276`). On the next turn it is fed to `analyzeQuery({lastRoute})` (`:1161`) and applied as a `historicalRouteBoost` (default **0.06**) to that route's signal (`brainRouter.js:756-758, 1532-1554`).

**Why intermittent.** The *same* question yields a different signal ranking depending on what was asked immediately before it in the same conversation. Near a routing threshold or an ambiguity margin (`ROUTE_AMBIGUITY_MARGIN=0.12`), 0.06 is enough to flip the top route. Because testers usually reuse one conversation, "the same question" is really "the same question after different history," which looks non-deterministic.

**Evidence.** `brainRouter.js:756, 1410-1428, 1532`; `routingCalibration.js:19`; persisted in `conversationService.js` and reloaded on restart (`:389`).

**Reproduce.** In a fresh conversation ask question X → note route. In another conversation ask a strongly RAG/DECISION question first, then X → compare route.

**Verify.** Router audit log already records `initial_route` vs `final_route` and `route_reasoning` (`orchestrator.js:1290-1296`); add `historical_route` to it (`LOGGING_GAP_ANALYSIS.md#LG-03`).

**Impact on demo.** Medium-high; most visible when the presenter re-asks a question after unrelated ones.

---

## RC-05 — Golden-path + ~14 override gates create order-dependent, hard-to-predict routing
**Risk: HIGH. Probability: 55%.**

**Description.** Between `determineBestRoute` and execution there are ~14 sequential override gates (curriculum lock, deterministic-KG lock, direct-entity lock, resolved-followup lock, ontology lock, multi-intent merge, etc.) at `orchestrator.js:1184-1270`, plus mid-pipeline re-locks (`lockKgDirectRouteForSelectedOntologyFacts` at `:2255, 2626, 2809`). Several depend on retrieval *results* (e.g., ontology facts found) and on `goldenMatch`.

**Why intermittent.** Because some locks fire only when retrieval returns facts, and retrieval success itself varies (RC-01/02/03), the *effective* route for the same query can change after the fact. Combined with `classifyGoldenQuery` normalization sensitivity, small differences in the normalized string (RC-14) can toggle a golden match on/off (`orchestrator.js:965, 977-986`).

**Evidence.** `orchestrator.js:1141-1270, 2255-2257, 2626-2628, 2809-2860`.

**Reproduce.** Ask a query that sits between "curriculum" and "program" phrasing; vary word order slightly; observe route flips.

**Verify.** The `route_diagnostics.override_reasons` array is already populated (`orchestrator.js:1266-1268`); surface it in responses/logs.

**Impact on demo.** Medium; mainly affects edge-phrased questions.

---

## RC-06 — `timeoutWrapper` converts transient slowness into silent degradation
**Risk: HIGH. Probability: 70%.**

**Description.** `timeoutWrapper(promise, ms, fallback)` (`healthProbes.js:48-57`) resolves to `fallback` (almost always `null`) when the timer wins, and **does not cancel** the underlying request. Callers treat `null` as "subsystem failed" and degrade (`orchestrator.js:1942, 2473, 2620, 3069`).

**Why intermittent.** Under momentary load (GC pause, Gemma queue contention, cold model, disk write of `conversations.json`), a subsystem that would have returned a good answer at 6 s is abandoned at the timeout and the request degrades. The next identical ask, without the load spike, succeeds. Demo timeouts are tight (RAG/synthesis 20 s, decision health 800 ms–1.2 s).

**Evidence.** `healthProbes.js:48-57`; timeout budgets `orchestrator.js:1970-1984`; consumption `:2471, 2620, 3056-3070, 3124`.

**Reproduce.** Fire 3–4 synthesis-requiring queries concurrently (they serialize on the single Gemma slot, RC-09); some will hit the 20 s synthesis timeout and degrade.

**Verify.** Counters `unified_primary_fallback`, `*_TIMEOUT` entries in `degraded_services`, `gemma_timeout_total` (`ollamaService.js:594`).

**Impact on demo.** High if more than one person queries at once.

---

## RC-07 — RAG circuit breaker is decoupled from the health probe the router trusts
**Risk: HIGH. Probability: 55%** (given RAG is running, i.e., `full` mode).

**Description.** `ragService` keeps a **module-singleton** circuit breaker: opens after `CB_FAILURE_THRESHOLD` (default 3) failures, stays OPEN for `CB_COOLDOWN_MS` (default 20 s, `full` sets 15 s), then HALF_OPEN (`ragService.js:74-75, 833-936`). But the router's `health.rag` comes from `/health` pings that **bypass** the breaker (`healthProbes.js:115-131` → `ragService.healthCheck` → `_pingService`). So the router can believe RAG is healthy while `search()` immediately throws `CIRCUIT_BREAKER_OPEN`.

**Why intermittent.** After a brief RAG hiccup opens the breaker, the next ~15–20 s of RAG/HYBRID queries fail instantly and degrade, even though `/health` says healthy — then the breaker half-opens and recovers. Same question, opposite outcome, purely on breaker phase.

**Evidence.** `ragService.js:833-841` (breaker gate), `:920-925` (open transition), `healthProbes.js:115-131` (health path ignores breaker).

**Reproduce (full mode).** Momentarily stop the retriever to trip 3 failures, restart it; for the cooldown window RAG queries degrade while `/health` recovers first.

**Verify.** `telemetry.circuit_breaker.state` in `ragService.healthCheck()` report (`ragService.js:530`); compare to router's `health.rag`.

**Impact on demo.** Medium (full mode only), but produces confusing "it worked a second ago" moments.

---

## RC-08 — Golden response cache freezes the *first* outcome (including a degraded one) for 10 minutes
**Risk: HIGH. Probability: 60%.**

**Description.** For `cacheable` golden queries, the orchestrator caches the produced payload for `GOLDEN_CACHE_TTL_MS` (600000 = 10 min) and serves it verbatim to later identical asks (`orchestrator.js:150-190, 1919-1930`). Crucially, `setGoldenCachedPayload` is called not only on success but on **degraded static fallbacks** (`:2335, 2509, 2677, 2873`).

**Why intermittent.** If the *first* time a showcase golden query is asked a subsystem is momentarily down (embedding cold-start RC-03, health flap RC-01), a degraded static answer is cached and returned for the next 10 minutes — even after the subsystem recovers. Conversely a good first answer is frozen good. So the outcome depends entirely on the state at first ask, and it "sticks," which is exactly the reported "sometimes perfect, sometimes not, and it won't change."

**Evidence.** `orchestrator.js:154-190` (cache impl), `:1919-1930` (read), `:2335/2509/2677/2873` (writing degraded fallbacks), `:3223` (writing synthesis result). Cacheable golden entries: `goldenPathRegistry.js:199, 218, 236, 254, …`.

**Reproduce.** Start cold, immediately ask a cacheable golden KG query (e.g., "Who teaches …") before the embed model warms → degraded answer cached → keeps returning degraded for 10 min.

**Verify.** Look for `GOLDEN_CACHE_HIT` in `route_diagnostics.fallback_triggers` and `golden_path_cache_hit` metric (`orchestrator.js:1881, 1922`).

**Impact on demo.** High — golden queries are the demo showcase, and this makes a bad first impression persist.

---

## RC-09 — Single-slot Gemma queue serializes all synthesis; concurrency causes overflow/timeout
**Risk: MEDIUM-HIGH. Probability: 55%.**

**Description.** `gemmaRequestLimiter` allows `maxActiveRequests` concurrent Gemma calls — default **1**, and the demo profile does **not** override `GEMMA_MAX_ACTIVE_REQUESTS`, so it stays 1 (`llmConfig.js:88`, `start_platform.ps1:793-794` sets only queue depth). Extra calls queue (demo depth 8) up to `queueTimeoutMs` (10 s); overflow → `GEMMA_QUEUE_OVERFLOW` (`gemmaRequestLimiter.js:64-95`).

**Why intermittent.** A single request is fine, but two synthesis-needing questions in flight (two testers, or a rapid re-ask) serialize; the second waits behind the first and can exceed its 20 s synthesis deadline → degraded. Non-deterministic by arrival timing.

**Evidence.** `gemmaRequestLimiter.js:40-101`; `llmConfig.js:88-94`.

**Reproduce.** Send 3 HYBRID/GENERAL queries within ~1 s; observe queue waits and some degraded results.

**Verify.** Gauges `gemma_queue_depth`, `gemma_active_requests`; log lines `gemma_queue_wait_complete` (`ollamaService.js:506`).

**Impact on demo.** Medium; spikes if the audience is invited to try it simultaneously.

---

## RC-10 — Model keep-alive unload + cold-start after demo pauses
**Risk: MEDIUM. Probability: 50%.**

**Description.** `OLLAMA_KEEP_ALIVE` is `15m` in demo (`start_platform.ps1:767`). After 15 min idle, Ollama unloads Gemma (and the embed model). The next request pays a cold start; `PRIMARY_COLD_START_TIMEOUT_MS=22000` in demo but the synthesis **deadline** is 20 s (`start_platform.ps1:778, 781`), so a cold synthesis can exceed the deadline and degrade.

**Why intermittent.** Whether a model is resident depends on elapsed idle time and the warm pool's timing (`GEMMA_WARM_POOL_INTERVAL_MS=300000`, `:797`). Questions right after a long Q&A gap are the ones that stall.

**Evidence.** `start_platform.ps1:767, 778-782, 795-798`; cold-start logic `ollamaService.js:748-833`.

**Reproduce.** Idle >15 min, then ask a synthesis query.

**Verify.** `primary_cold_start_pending`, `primary_cold_start_live_retry` logs (`ollamaService.js:803`).

**Impact on demo.** Medium; classic "first question after the break failed."

---

## RC-11 — Gemma memory-pressure-adaptive sampling and prompt truncation
**Risk: MEDIUM. Probability: 45%.**

**Description.** `buildStableOptions` clamps temperature/top_p and shrinks `num_predict` based on live RSS pressure (`ollamaService.js:237-288`), and `enforcePromptBudget` hard-truncates the prompt under high pressure (`:290-330`). `unifiedAnswerService` also defers heavy synthesis to a deterministic answer under critical pressure (`:2458-2500`).

**Why intermittent.** The *same* prompt can be sampled with different temperature/length or truncated differently depending on process RSS at that instant, changing wording/length and occasionally the substance (truncated context). Pressure depends on prior load, GC, and the embed model being resident.

**Evidence.** `ollamaService.js:237-330`; `unifiedAnswerService.js:2457-2507`; thresholds `llmConfig.js:95-100`.

**Reproduce.** Drive load to raise RSS above `GEMMA_MEMORY_HIGH_RSS_MB`, compare answers.

**Verify.** Logs `prompt_budget_hard_truncated`, `memory_pressure_deferred_heavy_synthesis`, `gemma_memory_pressure` snapshots.

**Impact on demo.** Low-medium; mostly wording/length variance.

---

## RC-12 — LLM synthesis temperature is non-zero for HYBRID/GENERAL/RAG synthesis
**Risk: MEDIUM. Probability: 40%.**

**Description.** Route-adaptive inference options use temperature 0.10–0.18 (`unifiedAnswerService.js:198-205`). For any route that actually reaches synthesis (HYBRID, GENERAL, RAG_ONLY-indirect, DECISION/CAREER synthesis), the wording varies run-to-run; degraded mode clamps to ≤0.10 (`:2504`) but not to 0.

**Why intermittent.** Sampling is inherently stochastic; low temperature reduces but does not remove variation. Users perceive "different answer" even when the facts are identical.

**Evidence.** `unifiedAnswerService.js:186-215, 2503-2515`.

**Verify.** Ask the same HYBRID query repeatedly with a warm model and identical health; wording drifts.

**Impact on demo.** Low; facts stable, phrasing varies. Deterministic KG/RAG-direct/golden routes are unaffected.

---

## RC-13 — Optional Gemini humanizer rewrites *every* answer non-deterministically (if enabled)
**Risk: MEDIUM (config-gated). Probability: 35%** (only if `GEMINI_HUMANIZER_ENABLED=true`).

**Description.** When enabled, the patched `res.json` sends every eligible answer — **including deterministic KG answers** — to Gemini at temperature 0.2, then validates and may reject the rewrite (`conversationalHumanizer.js:320-395`). Rejection → falls back to the deterministic expansion.

**Why intermittent.** Cloud latency/availability + Gemini sampling + a pass/fail validation gate means the surface text of even "deterministic" answers changes between asks, and network failures intermittently fall back. Default is **off** (`runtimeMode.js:37`), so this only bites if the demo `.env` turns it on.

**Evidence.** `conversationalHumanizer.js:340-395`; `runtimeMode.js:37`; wrapper `orchestrator.js:626-668`.

**Verify.** `[GEMINI_HUMANIZER][HUMANIZER_*]` log lines; `metadata.humanizer` in responses.

**Impact on demo.** Medium if enabled (undermines the "deterministic" story); none if off.

---

## RC-14 — Query normalization / golden classification sensitivity
**Risk: LOW-MEDIUM. Probability: 30%.**

**Description.** `normalizeAcademicQuery` (fuzzy, env-tunable) can produce slightly different normalized strings for near-identical inputs (typos, spacing, unicode), and `classifyGoldenQuery` + multi-intent detection key off that string (`orchestrator.js:683, 965, 977`). A different normalization can toggle a golden match, a multi-intent split, or an ontology preroute.

**Why intermittent.** Two "same" questions that differ only in whitespace/casing/typo can take different deterministic branches. This is deterministic per exact byte string but looks random to a human typing.

**Evidence.** `academicQueryNormalizer.js`; `orchestrator.js:683-708, 965-986, 1060`.

**Verify.** `normalizationTrace` is already in every response (`orchestrator.js:686-693`); diff `normalized_query` across asks.

**Impact on demo.** Low; avoidable by using saved/prepared question text.

---

## RC-15 — Shared mutable conversation object + `requestId` collisions (concurrency hygiene)
**Risk: LOW. Probability: 20%.**

**Description.** (a) `getConversation` returns the **live** object from the `conversations` Map (`conversationService.js:80-92`); the handler mutates `convo.lastRoute`, `convo.lastCurriculumCourse` in place. Two concurrent requests on the same `cid` (double-submit, two tabs) interleave mutations. (b) `requestId = Date.now()` (`orchestrator.js:592`) collides for requests in the same millisecond, and `lastGenerationMetadata`/logs are keyed by it (`ollamaService.js:342-353`).

**Why intermittent.** Only under same-cid concurrency; causes cross-talk in route memory and garbled correlation in logs, making incidents hard to diagnose.

**Evidence.** `conversationService.js:76-146`; `orchestrator.js:592`.

**Verify.** Double-submit the same question on one cid; watch `lastRoute`/curriculum carryover cross-contaminate.

**Impact on demo.** Low, but raises debugging cost during the incident window.

---

## Cross-cutting note
RC-01, RC-02, RC-03, RC-08 together explain the *majority* of "sometimes nothing / sometimes perfect": route selection depends on flapping health, RAG is absent in demo, KG depends on an unmanaged embed model, and the first outcome gets frozen by the golden cache. Fixing those four converts most remaining variance into benign wording drift (RC-12).
