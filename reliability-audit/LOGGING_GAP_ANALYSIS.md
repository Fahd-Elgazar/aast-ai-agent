# LOGGING_GAP_ANALYSIS.md

Goal: if a failure occurs mid-demo, can the current logs tell us **exactly** where and why? Below: what exists, what's missing, and the precise log lines to add for full per-request observability. (This is a spec — no code was changed.)

---

## 1. What already exists (good)

- Per-request start/finish with route, latency, size: `orchestrator.js:607-613`.
- Routing audit JSONL (`logs/routing-audit.jsonl`) with `initial_route`, `final_route`, `route_reasoning`, `fallback_triggers`, `failure_diagnostics`, `degraded_services`: `orchestrator.js:192-202, 748-762, 1883-1899`.
- Normalization trace embedded in every response: `orchestrator.js:686-693`.
- Ollama structured JSON logs (attempt, timeout, error_type, breaker_state): `ollamaService.js:410-438, 480-491`.
- Health-failure counters: `healthProbes.js:179-184`.
- RAG per-pass and circuit-breaker transition logs: `ragService.js:838-924`.

**The core gap:** these are scattered across services with **no shared correlation id**, and the *inputs that determined routing* (the health snapshot, lastRoute, confidence, cache-hit) are not logged **together at the decision point**. So you can see *that* a route was chosen, but not reconstruct *why it differed from last time*.

---

## 2. Critical missing logs (add these)

### LG-01 — Health snapshot actually used for routing
- **File / function:** `orchestrator.js` / `app.post("/api/chatbot/query")`
- **Location:** immediately after `const healthStatus = await checkSubsystemHealth(...)` (line ~1153).
- **Variables:** `requestId`, `conversationId`, `healthStatus` (all six flags), `healthCacheAgeMs` (expose from healthProbes), `goldenMatch?.id`.
- **Exact message:** `[HEALTH_SNAPSHOT][${requestId}] cid=${conversationId} kg=${healthStatus.kg} rag=${healthStatus.rag} decision=${healthStatus.decision} career=${healthStatus.career} faq=${healthStatus.faq} llm=${healthStatus.llm} cacheAgeMs=${healthCacheAgeMs} golden=${goldenMatch?.id||"none"}`
- **Purpose:** Directly proves RC-01 (health flapping) by letting you diff the exact snapshot across two identical asks.

### LG-02 — Decision inputs vs output at the routing point
- **File / function:** `orchestrator.js`, after `determineBestRoute` + all overrides (line ~1272).
- **Variables:** `initialRoute`, final `route`, `routeOverrideReasons`, `routingDecision.confidence`, `analysisPayload.signals` (top-2), `intentKeyword`, `convo.lastRoute` (pre-write).
- **Exact message:** `[ROUTE_DECISION][${requestId}] intent=${intentKeyword} lastRoute=${priorLastRoute} initial=${initialRoute} final=${route} conf=${routingDecision.confidence} overrides=[${routeOverrideReasons.join(",")}] topSignals=${JSON.stringify(top2Signals)}`
- **Purpose:** Ties RC-04/RC-05 to a concrete before/after; shows when an override or `lastRoute` flipped the route.

### LG-03 — Historical-route influence
- **File / function:** `brainRouter.js` / `_applyContextBoost` (line ~1532) and `analyzeQuery` return.
- **Variables:** `context.lastRoute`, `contextBoost`, affected signal name+delta.
- **Exact message:** `[BRAIN_ROUTER][CONTEXT_BOOST] lastRoute=${last} boost=${contextBoost} appliedTo=${signalKey}`
- **Purpose:** Confirms/【excludes】RC-04 as the cause of a specific misroute.

### LG-04 — Embedding call outcome on the KG path
- **File / function:** `neo4jcontext.js` / `fetchNeo4jContext` around `embed()` (line ~3207).
- **Variables:** `requestId`, `detectedIntent`, `embedDurationMs`, `embedOk` (bool), model residency if available.
- **Exact message:** `[KG_EMBED][${requestId}] intent=${detectedIntent} ok=${embedOk} durationMs=${embedDurationMs} model=nomic-embed-text`
- **Purpose:** Proves RC-03 (embed cold-start/absence) when a KG query returns empty or stalls.

### LG-05 — KG empty-result reason
- **File / function:** `neo4jcontext.js` / `fetchNeo4jContext` at the `selectedFacts.length === 0` branch (line ~3257).
- **Variables:** `requestId`, `detectedIntent`, `records.length`, `usedThreshold`, `usedIndexName`, `semanticFallbackUsed`, `failure_reason`.
- **Exact message:** `[KG_EMPTY][${requestId}] intent=${detectedIntent} rawRecords=${records.length} threshold=${usedThreshold} index=${usedIndexName} semFallback=${semanticFallbackUsed} reason=NO_SELECTED_FACTS`
- **Purpose:** Distinguishes "graph has no data" from "retrieval/embedding failed" for the same query (RC-03 vs genuine gap).

### LG-06 — Golden cache read/write
- **File / function:** `orchestrator.js` / `getGoldenCachedPayload` (line ~159) and `setGoldenCachedPayload` (line ~175).
- **Variables:** `goldenMatch.id`, cache key, hit/miss, `ageMs`, `wasDegraded` (whether the payload being stored is a degraded/static fallback).
- **Exact messages:**
  - read: `[GOLDEN_CACHE][${requestId}] id=${goldenMatch.id} hit=${!!entry} ageMs=${ageMs}`
  - write: `[GOLDEN_CACHE_WRITE][${requestId}] id=${goldenMatch.id} degraded=${wasDegraded} tier=${responseTier}`
- **Purpose:** Directly exposes RC-08 — shows when a degraded answer is being frozen for 10 minutes.

### LG-07 — Timeout-degradation attribution
- **File / function:** `healthProbes.js` / `timeoutWrapper` (line ~48) — add an optional `label` param logged on timeout; call sites in `orchestrator.js` pass a label.
- **Variables:** `label` (e.g., `RAG_SEARCH`, `UNIFIED_SYNTHESIS`, `DECISION`), `ms`, elapsed.
- **Exact message:** `[TIMEOUT_DEGRADE][${requestId}] stage=${label} budgetMs=${ms} → fallback`
- **Purpose:** Attributes RC-06/RC-09/RC-10 to the exact stage that abandoned the request.

### LG-08 — Gemma queue wait/overflow at request scope
- **File / function:** `gemmaRequestLimiter.js` / `acquire` (lines 64, 74) — already logs `gemma_queue_wait_complete` in ollamaService but not overflow with requestId.
- **Variables:** `requestId`, `active`, `queue.length`, `maxActive`, `maxQueueDepth`.
- **Exact message:** `[GEMMA_QUEUE][${requestId}] active=${active} pending=${queue.length} maxActive=${maxActive} result=${OVERFLOW|QUEUED|IMMEDIATE}`
- **Purpose:** Proves RC-09 under concurrency.

### LG-09 — Unified synthesis provider + confidence gate
- **File / function:** `unifiedAnswerService.js` / `generateUnifiedAnswer` at the gates (lines 2339, 2360) and after synthesis (line 2577).
- **Variables:** `retrievalConfidence`, gate outcome, `synthesisProvider` (gemma/gemini/deterministic), `memory_pressure`.
- **Exact message:** `[UNIFIED][${requestId}] conf=${retrievalConfidence} gate=${gateOutcome} provider=${synthesisProvider} pressure=${pressureLevel} tempUsed=${inferenceOptions.temperature}`
- **Purpose:** Explains RC-11/RC-12 and low-confidence "insufficient data" outputs.

---

## 3. Correlation-id gap (foundational)

- **Problem:** `requestId = Date.now()` in the orchestrator (`orchestrator.js:592`) is not propagated to RAG (its own ids), Decision API, or Ollama beyond a prefix; and it can collide (RC-15).
- **Fix (spec):** generate `const traceId = crypto.randomUUID()` per request, pass it in the JSON body / an `x-trace-id` header to RAG (`ragService.search`), Decision (`decisionService`), and as the `requestId` to Ollama/embeddings. Log `traceId` in every service line.
- **Purpose:** Lets you follow one question across all five processes — currently impossible.

---

## 4. Suggested single "why did this differ" line

Add one consolidated line at response completion that captures the full hidden-state vector (from `INTERMITTENT_FAILURE_REPORT.md#4`):

```
[REQ_EXPLAIN][${traceId}] cid=${cid} normQ="${normalized_query}" lastRoute=${priorLastRoute}
  route=${route} conf=${confidence} health={kg,rag,dec,car,faq,llm}
  golden=${goldenId}/cache=${cacheHit} ragBreaker=${ragCbState} model=${activeModel}/warm=${warm}
  pressure=${pressure} queue=${queueDepth} provider=${synthesisProvider} tier=${responseTier}
```

With this one line, any "same question, different answer" incident is diagnosable from a single grep, because it records every non-stationary input that could have changed the outcome.
