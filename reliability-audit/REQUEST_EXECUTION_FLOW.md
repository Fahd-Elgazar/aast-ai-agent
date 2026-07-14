# REQUEST_EXECUTION_FLOW.md

Full execution trace of `POST /api/chatbot/query` in `aast-ai-agent-main/backend/orchestrator.js`. Every step cites the code. **Branch points that can change per-request for the same input are marked ⚠.**

---

## 1. End-to-end execution graph

```
Frontend (agentService.ts → httpClient.ts)
        │  { query, cid }
        ▼
Express /api/chatbot/query                                   orchestrator.js:591
        │
        ├─ res.json is monkey-patched  ⚠(async humanizer wrapper)   :601-671
        │
        ├─ validate query                                          :676-679
        ├─ normalizeAcademicQuery(query)                           :683  (academicQueryNormalizer.js)
        ├─ conversationId = cid || makeConversationId()            :695
        ├─ convo = await getConversation(cid)   ⚠ loads prior state :710
        │
        ├─ detectMetaConversationIntent  → return CONVERSATION_META :717  [deterministic exit]
        ├─ pushTurn(user)                                          :799
        ├─ detectLightConversationalIntent → CONVERSATION_LIGHT    :904  [deterministic exit]
        ├─ resolveFollowUpReference  ⚠ uses conversationMemory     :925  (may rewrite `query`)
        ├─ classifyGoldenQuery(query) → goldenMatch                :965
        ├─ detectAcademicMultiIntents(query)                       :977
        ├─ isDemoGraphQuery → DEMO_GRAPH                           :988  [deterministic exit]
        ├─ checkGreeting / searchFAQ → GREETING/FAQ                :1017-1044 [deterministic exit]
        │
        ├─ INTENT CLASSIFICATION                                   :1047-1098
        │     golden→ / followup→ / multiIntent→ / ontology→ /
        │     program→ / factual→ / numeric→ / else extractDynamicIntent ⚠(LLM if enabled)
        │
        ├─ checkSubsystemHealth()  ⚠⚠ 15s-cached, can flap        :1153  (healthProbes.js)
        ├─ brainRouter.analyzeQuery(query,intent,{lastRoute}) ⚠    :1157  (brainRouter.js:845)
        ├─ brainRouter.determineBestRoute(analysis, health) ⚠⚠     :1163  (brainRouter.js:1059)
        │
        ├─ ~14 deterministic route-override gates                  :1184-1270
        ├─ convo.lastRoute = route ; saveConversation             :1275-1276  ⚠ persists state
        │
        ▼   route ∈ { KG_DIRECT, KG_ONLY, RAG_DIRECT, RAG_ONLY,
                       HYBRID_KG_RAG, DECISION_ENGINE, CAREER_ENGINE, LLM_FALLBACK }
        │
        ├─ golden cache lookup ⚠ (returns frozen payload)          :1919-1930
        ├─ multi-intent deterministic merge branch                 :1996-2166
        │
        ├─ ROUTE EXECUTION (Section 4 below)                       :2168-2807
        │
        ├─ ontology KG lock deterministic response                 :2809-2860
        ├─ LLM_FALLBACK Gemma call ⚠ (skipped in single-gen mode)  :2863-2923
        ├─ UNIFIED SYNTHESIS  ⚠⚠ generateUnifiedAnswer            :3054-3070  (unifiedAnswerService.js:2303)
        │     └─ on failure → fusionService.fuse ⚠                 :3124
        ├─ evidence enrichment (KG/RAG/decision)                   :3159-3206
        ├─ recordAssistantTurn (pushTurn + memory update)          :3208
        ├─ setGoldenCachedPayload ⚠ (freezes result)              :3223
        └─ res.json(responseFormatter.format(...))                :3243
                 │
                 ▼  res.json override runs
             shouldHumanizeResponseBody?                          conversationalHumanizer.js:303
                 ├─ humanizerEnabled=false → deterministic expand  :340
                 └─ humanizerEnabled=true  → Gemini rewrite ⚠temp  :357
```

---

## 2. Async boundaries, timeouts, and concurrency primitives

| Primitive | Where | Notes |
|---|---|---|
| `timeoutWrapper(promise, ms, fallback)` | `healthProbes.js:48` | Resolves to `fallback` (usually `null`) on timeout. **Does not cancel** the underlying work — it just stops waiting. |
| Semaphores: `llmSemaphore(≤MAX_CONCURRENT_LLM)`, `neo4jSemaphore`, `ragSemaphore` | `orchestrator.js:451-471` | Demo: LLM=2, NEO4J=6, RAG=2. Acquired **before** timeout starts. |
| Gemma single-slot queue | `gemmaRequestLimiter.js:40-101` | `maxActiveRequests` default **1**; queue depth demo 8; `queueTimeoutMs` 10 s. Overflow → `GEMMA_QUEUE_OVERFLOW`. |
| `AbortController` | `ollamaService.js:365`, `neo4jcontext.js:22`, `healthProbes.js:61` | Per fetch; aborts on timeout only. |
| Circuit breakers | RAG: `ragService.js:833`; Ollama: `modelFailoverManager.js` | Module-level singleton state, time-based recovery. |
| `Promise.allSettled` | HYBRID: `orchestrator.js:2613`; health: `healthProbes.js:97` | Partial-failure tolerant. |

### 2.1 KG path has no orchestrator-level timeout ⚠
In the `KG_ONLY`/`KG_DIRECT` branch, `runNeo4jRetrieval()` is awaited **without** `timeoutWrapper` (`orchestrator.js:2173`). So KG latency is bounded only by the embedding call's own `EMBED_TIMEOUT_MS` (default **30000**, ×2 attempts) plus Neo4j query time. RAG/HYBRID/DECISION paths **do** use `timeoutWrapper`. This asymmetry means a slow embedding produces an unbounded-feeling KG stall rather than a clean degraded fallback.

---

## 3. The three non-stationary inputs to routing

For a fixed user string, the route is a function of:

1. **`intentKeyword`** — usually deterministic (default `LLM_INTENT_ENABLED=false`, `orchestrator.js:482`), but if LLM intent is enabled it can time out and downgrade to `GENERAL` (`orchestrator.js:579`) and is cached 5 min (`:476`).
2. **`convo.lastRoute`** — the previous turn's route, fed into `analyzeQuery` (`orchestrator.js:1161`) and applied as `historicalRouteBoost` (`brainRouter.js:756`, `1532`). ⚠ Same question, different previous turn ⇒ different score ⇒ possibly different route.
3. **`healthStatus`** — a 15-second-cached snapshot (`healthProbes.js:85`) that gates almost every route decision in `determineBestRoute` (`brainRouter.js:1064-1408`). ⚠ This is the single largest source of "same question routes differently."

---

## 4. Per-route execution detail

### 4.1 KG_ONLY / KG_DIRECT (`orchestrator.js:2170-2467`)
1. Resolve KG intent, curriculum carryover ⚠ (uses `convo.lastCurriculumCourse`) `:2171-2172`.
2. `runNeo4jRetrieval` → `fetchNeo4jContext` (`neo4jcontext.js:3083`):
   - CURRICULUM / ontology-aggregation → deterministic Cypher, **no embedding** `:3127-3198`.
   - else → `embed(query)` via Ollama `nomic-embed-text` ⚠ then vector Cypher `:3207-3215`.
   - semantic fallback pass if 0 records `:3218-3230`.
   - 0 selected facts → `NO_RESULT_MESSAGE`, confidence 0 `:3257-3273`.
3. Empty KG + RAG fallback allowed + `health.rag` → escalate to RAG_ONLY `:2305-2322` ⚠ (in demo `health.rag=false` so this is blocked → "I couldn't find…").
4. Empty KG + golden → static golden fallback, **cached** `:2326-2337`.
5. Deterministic bypass → build answer from facts, confidence forced ≥0.98, **no LLM** `:2370-2467`.

### 4.2 RAG_ONLY / RAG_DIRECT (`orchestrator.js:2469-2611`)
`ragSemaphore.acquire()` → `timeoutWrapper(ragService.search(query), ragTimeoutMs)` `:2471`.
- `null` (timeout / breaker open) → `RAG_TIMEOUT`, empty results `:2473-2476`.
- empty → golden static fallback or "no verified policy evidence" `:2497-2535`.
- strong evidence + RAG_DIRECT → deterministic policy payload, **no LLM** `:2537-2609`.
- In demo mode 8001 is down → search fails/breaker opens → this route almost always degrades.

### 4.3 HYBRID_KG_RAG (`orchestrator.js:2612-2690`)
`Promise.allSettled([KG, RAG])`. KG failure and RAG failure each recorded independently. Total failure + golden → static fallback; else → downgrade to `LLM_FALLBACK` `:2666-2689`.

### 4.4 DECISION_ENGINE (`orchestrator.js:2691-2783`)
Parses `%`, budget, `k` from the query ⚠(regex), reads/writes `getUserMemory(cid)`, calls `getRecommendation` (HTTP to 8005) with `timeoutWrapper(decisionTimeoutMs)`; empty → demo-safe static text `:2771-2781`.

### 4.5 CAREER_ENGINE (`orchestrator.js:2784-2807`)
`buildCareerRoadmap` (local, `timeoutWrapper`).

### 4.6 LLM_FALLBACK (`orchestrator.js:2863-2923`)
Skipped entirely under `singleGemmaGenerationMode` (default true) `:2895`; otherwise one Gemma call at temp 0.08.

### 4.7 Unified synthesis (all non-deterministic exits) (`orchestrator.js:3046-3138`)
`generateUnifiedAnswer` (`unifiedAnswerService.js:2303`):
- total evidence absence → deterministic "insufficient evidence" `:2339`.
- `retrievalConfidence < 0.25` → `INSUFFICIENT_DATA_PHRASE` ⚠ `:2360`.
- `0.25 ≤ conf < 0.40` → degraded, temperature clamped to ≤0.10 `:2504`.
- memory pressure critical + big prompt → deterministic fallback `:2458`.
- else Gemma synthesis (route temp 0.10–0.18) → Gemini backup → deterministic fallback `:2540`.
On any throw → `fusionService.fuse` (`:3124`) → static backstop (`:3300`).

---

## 5. Response post-processing (always runs)

The patched `res.json` (`orchestrator.js:601`) calls `humanizeGroundedAnswer` **after** the KG completion guard:
- `humanizerEnabled=false` (default): only deterministic `applyGroundedConversationalExpansion` (string rewrites) `conversationalHumanizer.js:156-208`.
- `humanizerEnabled=true`: Gemini rewrite at **temperature 0.2** on **every eligible answer**, including deterministic KG answers ⚠ `:357-368`. Rewrite can be rejected by `validateHumanizedAnswer` → falls back to expansion, so wording varies run-to-run and pass/fail-to-rewrite varies.

`recordAssistantTurn` stores the **pre-humanized** grounded answer in conversation memory, while the user sees the **post-humanized** text — a persistent divergence between memory and display.

---

## 6. Startup sequence (affects the first minutes of a demo)

`orchestrator.js` top-level `await` (ESM):
1. `connectNeo4j()` (guarded by `global.neo4jInitialized`) `:208`.
2. `loadConversations()` `:233`.
3. `modelFailoverManager.waitForStartupCompletion()` (waits for Ollama readiness) `:3331`.
4. `gemmaWarmService.start()` `:3345`.
5. `app.listen(PORT)` `:3355`.

Because `app.listen` is last and step 3 waits for Ollama, the server can accept traffic only after LLM readiness resolves; but **health cache `cachedHealth` still starts all-`false`** (`healthProbes.js:24`) and the **first non-golden request** triggers the first real probe cycle. Requests in the first ~15 s can therefore route against stale/false health. See `ROOT_CAUSE_ANALYSIS.md#RC-01`.
