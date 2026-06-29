# Condensed Runtime Trace

Source paths are relative to `aast-ai-agent-main/`.

## 1. Active Runtime Entry

- Backend container:
  - `docker-compose.yml`
  - `backend/Dockerfile`
  - `CMD ["npm", "run", "start:orchestrator"]`
  - `backend/package.json` -> `start:orchestrator`
  - `node --max-old-space-size=3072 orchestrator.js`

- Verified frontend request path:
  - `frontend/src/services/fakeAdvisor.ts`
  - `fetch('/api/chatbot/query', { method: 'POST', body: { query, cid } })`
  - `frontend/vite.config.ts`
  - `/api` proxy target: `http://localhost:8004`

- Backend startup chain:
  - `orchestrator.js`
  - `dotenv.config()`
  - `INTERNAL_SECRET_KEY` required
  - `validateGeminiEnvironment({ warn: true })`
  - `app.use(cors())`
  - `app.use(bodyParser.json())`
  - `connectNeo4j()` attempted once
  - `loadConversations()`
  - `modelFailoverManager.waitForStartupCompletion()`
  - `gemmaWarmService.start()`
  - `app.listen(ORCHESTRATOR_PORT || 8004)`

- Mounted backend routes:
  - `POST /api/chatbot/query` -> main active query route in `orchestrator.js`
  - `/api/chatbot/legacy` -> `routes/chatbot.js`
  - `/api/decision` -> `routes/decision.js`
  - `/api/conversations` -> `routes/conversations.js`
  - `/health` -> `routes/health.js`
  - `/api/health` -> `routes/health.js`

## 2. Request Lifecycle

- Request enters:
  - Frontend/API client
  - `POST /api/chatbot/query`
  - `orchestrator.js`

- Middleware:
  - `cors()`
  - `bodyParser.json()`

- Response wrapper:
  - `res.json` is wrapped in `orchestrator.js`
  - records `http_chatbot_latency_ms`
  - logs route, duration, response bytes
  - attaches conversation summary when `cid` exists
  - optionally runs `humanizeGroundedAnswer()`
  - humanizer waits on `responseKgCompletionGuard()` when KG retrieval is pending

- Query validation:
  - missing/empty `query` -> `responseFormatter.formatErrorFallback("Query is required.")`

- Query normalization:
  - `normalizeAcademicQuery(originalQuery)`
  - normalized query replaces raw query when changed
  - normalization metrics written when correction occurs

- Conversation load:
  - `conversationId = normalizeConversationId(cid) || makeConversationId()`
  - `convo = await getConversation(conversationId)`
  - `priorConversationMessages`
  - `priorConversationMemory = getConversationMemory(conversationId)`

- Pre-router local bypass order:
  - `detectMetaConversationIntent()` -> `buildConversationMetaResponse()`
    - pushes user and assistant turns
    - bypasses BrainRouter, Neo4j, RAG, Gemini, Ollama, UnifiedAnswer
    - returns route `CONVERSATION_META`
  - normal path pushes user turn with `pushTurn()`
  - `detectLightConversationalIntent()` -> `buildLightConversationalResponse()`
    - returns route `CONVERSATION_LIGHT`
  - `resolveFollowUpReference()`
    - unresolved -> `CONVERSATION_FOLLOWUP_CLARIFY`
    - resolved -> query rewritten and normalized again
  - `classifyGoldenQuery(query)`
  - `detectAcademicMultiIntents(query)`
    - multi-intent overrides a single golden match
  - `isDemoGraphQuery()` -> `buildDemoGraphResponse()`
  - `checkGreeting(query)` -> static formatted FAQ route
  - `searchFAQ(query)` -> formatted FAQ route

- Intent extraction order:
  - golden match intent/entities
  - resolved follow-up intent hint
  - multi-intent fallback intent `GENERAL`
  - ontology preroute intent
  - program keyword heuristic -> `PROGRAM`
  - factual regex -> `GENERAL`
  - profile percentage/budget with incomplete decision memory -> `RECOMMEND`
  - otherwise `extractDynamicIntent(query, requestId)`

- Dynamic intent:
  - uses `generateStableResponse()` from `ollamaService.js`
  - expects JSON intent output
  - intent cache: max 200 entries, 5 minute TTL
  - timeout -> `{ intent: "GENERAL", confidence: 0.2, degraded_reason: "INTENT_TIMEOUT" }`
  - parse failure -> `UNKNOWN_PARSE`

- Routing:
  - `checkSubsystemHealth()`
  - `brainRouter.analyzeQuery(...)`
  - `brainRouter.determineBestRoute(...)`
  - orchestrator route locks and overrides
  - `convo.lastRoute = route`
  - `saveConversation(conversationId, convo)`

- Route execution:
  - `KG_ONLY` / `KG_DIRECT` -> Neo4j path
  - `RAG_ONLY` / `RAG_DIRECT` -> RAG path
  - `HYBRID_KG_RAG` -> parallel KG + RAG path
  - `DECISION_ENGINE` -> decision memory/API path
  - `CAREER_ENGINE` -> local career roadmap path
  - `LLM_FALLBACK` -> Ollama fallback prompt path

- Finalization:
  - deterministic route exits may bypass UnifiedAnswer
  - otherwise `generateUnifiedAnswer(...)`
  - if UnifiedAnswer fails -> `fusionService.fuse(...)`
  - final payload -> `responseFormatter.format(...)`
  - assistant turn recorded through `recordAssistantTurn(...)`
  - response sent through wrapped `res.json`

## 3. Brain Router Flow

- Inputs:
  - query
  - normalized intent
  - normalization trace
  - `convo.lastRoute`
  - subsystem health

- `brainRouter.analyzeQuery()`:
  - calls `ragService.detectQueryCategory(query)`
  - extracts route features/signals
  - applies alias/entity/category/history/golden boosts
  - returns signal scores and routing features

- Verified route set:
  - `KG_DIRECT`
  - `KG_ONLY`
  - `RAG_DIRECT`
  - `RAG_ONLY`
  - `HYBRID_KG_RAG`
  - `DECISION_ENGINE`
  - `CAREER_ENGINE`
  - `FAQ`
  - `LLM_FALLBACK`

- Calibration values:
  - `KG_CONFIDENCE_THRESHOLD`: default `0.40`
  - `HYBRID_CONFIDENCE_THRESHOLD`: default `0.34`
  - `LLM_FALLBACK_THRESHOLD`: default `0.18`
  - `ROUTE_AMBIGUITY_MARGIN`: default `0.12`
  - `DETERMINISTIC_KG_THRESHOLD`: default `0.70`
  - `DETERMINISTIC_RAG_THRESHOLD`: default `0.70`

- Golden route fallback chains in `determineBestRoute()`:
  - golden `KG_DIRECT`
    - fallback chain: `RAG_DIRECT -> FAQ -> LLM_FALLBACK`
    - if KG unhealthy: `RAG_DIRECT` if RAG healthy, else `FAQ`, else `LLM_FALLBACK`
  - golden `RAG_DIRECT`
    - fallback chain: `FAQ -> KG_DIRECT -> LLM_FALLBACK`
    - if RAG unhealthy: `KG_DIRECT` if KG healthy, else `FAQ`, else `LLM_FALLBACK`
  - golden `HYBRID_KG_RAG`
    - fallback chain: `KG_DIRECT -> RAG_DIRECT -> FAQ -> LLM_FALLBACK`
    - if KG/RAG degraded: choose available KG, else RAG, else FAQ, else LLM
  - golden `DECISION_ENGINE`
    - fallback chain: `CAREER_ENGINE -> FAQ -> LLM_FALLBACK`
  - golden `CAREER_ENGINE`
    - fallback chain: `DECISION_ENGINE -> FAQ -> LLM_FALLBACK`

- Non-golden route order:
  - deterministic ontology KG path when ontology intent is present and KG is healthy
  - forced hybrid when KG/RAG signals meet hybrid conditions and health allows it
  - deterministic RAG policy path when policy evidence score passes threshold
  - deterministic KG path when KG direct score passes threshold
  - ambiguity handler chooses best route and prepends close second route to fallback chain
  - top signal route when above medium threshold
  - low-confidence KG/RAG route when above degraded threshold
  - else `LLM_FALLBACK`

- Orchestrator post-router locks:
  - `CURRICULUM` -> `KG_DIRECT`, fallback `[KG_ONLY]`
  - deterministic KG or hard KG -> `KG_DIRECT`
  - direct person/admin teaching regex -> `KG_DIRECT` unless hybrid is active
  - resolved follow-up `PERSON` -> `KG_DIRECT` unless hybrid is active
  - ontology route intent -> `KG_DIRECT`, RAG fallbacks removed unless curriculum
  - multi-intent plan -> `HYBRID_KG_RAG`

## 4. Retrieval Flow

- KG retrieval function:
  - `runNeo4jRetrieval(...)`
  - `neo4jSemaphore.acquire()`
  - `fetchNeo4jContext(effectiveQuery, intent, limit, requestId, getConversationContext(...), options)`
  - `neo4jSemaphore.release()`
  - `buildKgResponse(kgRawData)`

- KG semaphore:
  - `MAX_CONCURRENT_NEO4J`, default `10`

- `fetchNeo4jContext()` chain:
  - `expandAcademicQuery(query)`
  - ontology/entity expansion
  - detect KG intent
  - `CURRICULUM` -> deterministic syllabus retrieval and `buildCurriculumAnswer()`
  - ontology aggregation query when matched -> deterministic aggregation
  - otherwise `embed()` via Ollama embeddings
  - `buildQueryPlan()`
  - `retrieveWithThresholds()`
  - optional semantic fallback for non-general, non-teaching, non-ontology misses
  - select quality facts
  - deterministic intents synthesize without LLM
  - non-deterministic routes either skip graph refinement for UnifiedAnswer or call local LLM refinement

- RAG retrieval function:
  - `ragSemaphore.acquire()`
  - `ragService.search(query, { topK })`
  - `ragSemaphore.release()`

- RAG semaphore:
  - `MAX_CONCURRENT_RAG`, default `8`

- `ragService.search()` chain:
  - validate capabilities once
  - `detectQueryCategory(query)`
  - `expandQuery(query, category)`
  - PASS 1: `_callRetriever(expandedQuery, TOP_K, category)`
  - if strong -> return `PASS_1_DIRECT`
  - PASS 2: `_callRetriever(simplifiedQuery, TOP_K_DEEP, category)`
  - if strong -> return `PASS_2_SIMPLIFIED`
  - PASS 3: `_callAnswerEngine(query)`
  - if success -> return `PASS_3_ANSWER_FALLBACK`
  - else `_buildFailureResult("retrieval_failure", ...)`

- RAG endpoint fallback:
  - primary endpoint called first
  - alternate endpoint tried only on primary `404`
  - local RAG circuit breaker opens after configured failure threshold
  - open breaker moves to half-open after cooldown

- Sequential retrieval:
  - `KG_ONLY` / `KG_DIRECT`: KG first
  - `RAG_ONLY` / `RAG_DIRECT`: RAG only
  - multi-intent: loop over intent parts, one retrieval per part

- Parallel retrieval:
  - `HYBRID_KG_RAG`
  - `Promise.allSettled([runNeo4jRetrieval(...), ragService.search(...)])`

- Optional fallback retrieval:
  - KG empty path checks fallback chain for `RAG_ONLY` or `RAG_DIRECT`
  - requires `healthStatus.rag !== false`
  - calls `retrieveRagEvidence("KG_EMPTY_RAG_ESCALATION")`
  - if RAG has evidence, route becomes `RAG_ONLY`

- Retrieval exits:
  - curriculum KG empty -> deterministic curriculum empty response
  - weak ambiguous KG evidence -> `KG_CLARIFICATION`
  - deterministic KG evidence -> direct KG response
  - strong deterministic RAG evidence -> direct RAG response
  - multi-intent evidence -> deterministic merged response

## 5. Synthesis & Failover Flow

- Deterministic responses before UnifiedAnswer:
  - `CONVERSATION_META`
  - `CONVERSATION_LIGHT`
  - `CONVERSATION_FOLLOWUP_CLARIFY`
  - `DEMO_GRAPH`
  - greeting/FAQ
  - golden cache hit
  - deterministic multi-intent
  - curriculum empty KG
  - KG clarification
  - deterministic KG
  - deterministic RAG
  - interactive decision/career prompt
  - golden decision/career rule payload

- `LLM_FALLBACK` route:
  - if golden match exists -> golden static fallback, no LLM call
  - otherwise:
    - `llmSemaphore.acquire()`
    - `generateStableResponse(...)`
    - `llmSemaphore.release()`
    - result stored in `rawResults.llm`

- LLM semaphore:
  - `MAX_CONCURRENT_LLM`, default `5`

- UnifiedAnswer input:
  - query
  - route
  - routing confidence
  - KG context
  - RAG context
  - FAQ context
  - decision/career context
  - recent conversation history
  - lightweight conversation memory

- `generateUnifiedAnswer()` guard order:
  - invalid query -> fallback result
  - no FAQ/decision/KG/RAG evidence -> insufficient evidence response, LLM bypassed
  - retrieval confidence `< 0.25` -> insufficient evidence response, LLM bypassed
  - confidence `>= 0.25` and `< 0.40` -> degraded mode, lower temperature

- UnifiedAnswer synthesis chain:
  - build context payload
  - build prompt
  - trim context up to 3 passes
  - hard truncate if above safe prompt limit
  - memory pressure check may return deterministic context answer
  - `generateGeminiSynthesis(...)` first
  - Gemini success -> Gemini answer
  - Gemini failure:
    - if deterministic context fallback exists -> return deterministic context fallback
    - else `runOllamaSynthesis(... fallbackFromGemini: true)`
  - sanitize answer
  - create structured result

- Ollama failover inside `generateStableResponse()`:
  - prompt budget enforced
  - `modelFailoverManager.start()`
  - `modelFailoverManager.scheduleRecoveryProbeIfDue()`
  - `modelFailoverManager.getInitialRoute(model)`
    - breaker open -> role `none`, throw `LLM_CIRCUIT_OPEN`
    - waiting for Ollama -> role `none`, throw `LLM_WAITING_FOR_OLLAMA`
    - degraded/half-open -> backup model
    - otherwise primary/custom model
  - `generateWithRetries(...)`
  - primary failure:
    - no backup allowed, non-circuit error, or failover threshold not met -> throw
    - otherwise `activateBackup("primary_generation_failed")`
    - retry with backup model
  - backup failure -> `recordAllModelsFailed("primary_and_backup_failed")`

- UnifiedAnswer catch fallback:
  - hybrid with KG and RAG evidence -> deterministic hybrid fallback
  - any deterministic context answer -> deterministic fallback
  - otherwise generic fallback result

- Orchestrator UnifiedAnswer fallback:
  - UnifiedAnswer invalid/throws -> `fusionService.fuse(query, routingDecision, rawResults)`
  - fusion timeout budget: 8000 ms
  - missing/invalid fusion result -> route catch

- Route catch fallback:
  - increment `route_failure_fallback`
  - golden match -> golden static fatal fallback if available
  - otherwise try `fusionService.fuse()` with simple `rawResults.llm`
  - final backstop -> `responseFormatter.formatErrorFallback(...)`

- Outer catch:
  - HTTP 500
  - `responseFormatter.formatErrorFallback("Fatal Internal Orchestrator Error", "ERROR", ...)`

## 6. Memory Flow

- Conversation memory load:
  - startup calls `loadConversations()`
  - storage file: `backend/data/conversations.json` unless `CONVERSATIONS_FILE` is set
  - persistence uses `createJsonPersistence()`

- Request memory read:
  - `getConversation(conversationId)`
  - `getConversationMemory(conversationId)`
  - `getConversationContext(conversationId, maxTurns)`

- User turn write:
  - normal path: `pushTurn(conversationId, convo, "user", originalQuery)`
  - meta-intent path: pushes user and assistant inside the meta bypass

- Assistant turn write:
  - `recordAssistantTurn(answer, memoryContext)`
  - `pushTurn(conversationId, convo, "assistant", answer)`
  - `updateConversationMemoryFromTurn(...)`

- Lightweight memory fields updated:
  - `lastTopic`
  - `lastEntity`
  - `lastIntent`
  - `recentSubjects`
  - `lastAssistantSummary`

- Memory update sources:
  - user query
  - normalized query
  - route/intent
  - entities
  - KG context
  - RAG context
  - decision/career context
  - FAQ context
  - used facts

- Persistence timing:
  - conversation writes call `persistSoon()`
  - debounce default: `500 ms`
  - `flushConversations()` runs on `SIGINT` and `SIGTERM`

- Decision memory:
  - service file: `services/decisionService.js`
  - storage file: `decision_memory.json` in `process.cwd()`
  - loaded on module import through `initMemory()`
  - `updateUserMemory()` merges profile/preferences/history
  - save debounce: `300 ms`
  - max sessions: `1000`
  - `deleteConversation` hook calls `deleteUserMemory`

## 7. Reliability Flow

- Startup reliability:
  - `connectNeo4j()` failure is logged; server still starts
  - `modelFailoverManager.waitForStartupCompletion()` waits for Ollama readiness flow
  - startup errors are logged; `gemmaWarmService.start()` still runs

- Health probe flow:
  - `checkSubsystemHealth(options)`
  - cached by `HEALTH_CACHE_TTL`
  - golden path uses `{ fast: true, optimistic: true }`
  - full check uses `Promise.allSettled`
  - KG: `RETURN 1 AS alive`
  - RAG: `ragService.healthCheck()`
  - LLM: `getOllamaRuntimeStatus()`
  - FAQ: verifies `searchFAQ` function
  - Decision: `getRecommendation` plus decision API health
  - Career: verifies `buildCareerRoadmap` function

- Request concurrency:
  - LLM semaphore: default `5`
  - Neo4j semaphore: default `10`
  - RAG semaphore: default `8`

- Route timeout usage:
  - KG route timeout: `KG_ROUTE_TIMEOUT_MS`, default `5000`
  - RAG route timeout: `RAG_ROUTE_TIMEOUT_MS` or `ROUTE_TIMEOUT_MS`, default `20000`
  - Hybrid timeout: `HYBRID_ROUTE_TIMEOUT_MS` or `ROUTE_TIMEOUT_MS`, default `20000`
  - Unified synthesis timeout: `UNIFIED_SYNTHESIS_ROUTE_TIMEOUT_MS`, default `65000`
  - Fallback LLM timeout/deadline: default `20000`

- Circuit state manager:
  - states: `WAITING_FOR_OLLAMA`, `PRIMARY_COLD`, `CLOSED`, `DEGRADED`, `OPEN`, `HALF_OPEN`
  - primary failure threshold -> `DEGRADED`
  - backup failure or all-model failure -> `OPEN`
  - recovery probes -> `HALF_OPEN`
  - enough recovery successes -> `CLOSED`

- Degraded response conditions:
  - intent timeout -> intent degrades to `GENERAL`
  - KG timeout -> `KG_TIMEOUT`
  - RAG timeout -> `RAG_TIMEOUT`
  - hybrid both empty -> `HYBRID_TOTAL_FAILURE`, route becomes `LLM_FALLBACK`
  - decision timeout/empty -> local degraded decision response
  - UnifiedAnswer failure -> FusionService fallback
  - route catch -> fatal fallback envelope with HTTP 200

## 8. Logging & Metrics Flow

- Request metrics:
  - `http_chatbot_query_total`
  - `http_chatbot_latency_ms`
  - route hit counters through whitelisted route names
  - normalization counters
  - retrieval counters
  - health failure counters
  - unified/fusion success and fallback counters

- Metrics storage:
  - `services/metrics.js`
  - in-memory `Map` counters and timers
  - `getMetricsSnapshot()`
  - exposed by `routes/health.js` at `/health/metrics` and `/api/health/metrics`

- Structured logger:
  - `services/logger.js`
  - JSON line append to `logs/app-YYYY-MM-DD.log` by default
  - console output by level
  - log rotation by `LOG_MAX_BYTES`
  - redacts keys matching password/secret/token/authorization/api key

- Chat audit log:
  - `orchestrator.js`
  - `logs/chat.log`
  - `logToFile(...)`
  - chat log rotation by `CHAT_LOG_MAX_BYTES`

- Routing audit log:
  - `orchestrator.js`
  - `logs/routing-audit.jsonl`
  - `writeRoutingAudit(...)`
  - disabled only when `ROUTING_AUDIT_ENABLED === "false"`

- Response trace metadata:
  - `responseFormatter.format(...)`
  - includes route, confidence, used facts, missing information, graph, metadata trace, conversation id, request id
