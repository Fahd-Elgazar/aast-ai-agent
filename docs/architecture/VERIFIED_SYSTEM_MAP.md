# VERIFIED_SYSTEM_MAP.md

This map is limited to behavior verified from the inspected code, imports, configuration, Docker files, and runtime call paths.

# 1. Verified Technologies

## Primary backend runtime

- Node.js 20 is used for the backend container (`aast-ai-agent-main/backend/Dockerfile`).
- The backend package is an ES module package (`aast-ai-agent-main/backend/package.json`, `"type": "module"`).
- Express is used for HTTP routing in `orchestrator.js`, `routes/conversations.js`, `routes/decision.js`, `routes/health.js`, and legacy route files.
- `cors`, `body-parser`, and `dotenv` are imported by the backend runtime.
- `neo4j-driver` is used by `db/neo4j.js`.
- `node-fetch` is used by `decisionService.js`, `geminiService.js`, `neo4jcontext.js`, `healthProbes.js`, and `routes/health.js`.
- `axios` and `axios-retry` are used by `ragService.js`.
- `fs`, `path`, and JSON files are used for conversation and decision memory persistence.
- `chalk`, `boxen`, and `cli-table3` are used by local logging/metrics display code.

## AI and retrieval services

- Ollama is called through HTTP:
  - `neo4jcontext.js` calls `/api/embeddings` with model `nomic-embed-text`.
  - `ollamaService.js` is used by `orchestrator.js`, `unifiedAnswerService.js`, `decisionService.js`, and `neo4jcontext.js` through `generateStableResponse` or `callOllama`.
- Gemini is called through `geminiService.js` using Google Generative Language API URL defaults and `GEMINI_API_KEY` configuration.
- Neo4j vector indexes are queried through Cypher in `neo4jcontext.js` using `CALL db.index.vector.queryNodes(...)`.
- The RAG retriever is a Python FastAPI service (`rag_system/phase3_retriever.py`) using `qdrant-client`, `sentence-transformers`, and Qdrant.
- The RAG answer engine is a Python FastAPI service (`rag_system/phase4_llm_answer_engine.py`) using `requests`, `tenacity`, and Ollama `/api/generate`.
- `BAAI/bge-m3` is the verified sentence-transformer model used by `phase3_retriever.py`.

## Deployment/runtime composition

- `docker-compose.yml` defines these services: `frontend`, `backend`, `decision-api`, `rag-retriever`, `rag-answer`, `qdrant`, and `neo4j`.
- The backend Docker command is `npm run start:orchestrator`, which starts `orchestrator.js`.
- The decision API container runs `uvicorn app.main:app --host 0.0.0.0 --port 8005`.
- The RAG retriever container runs `uvicorn phase3_retriever:app --host 0.0.0.0 --port 8001`.
- The RAG answer container runs `uvicorn phase4_llm_answer_engine:app --host 0.0.0.0 --port 8002`.

## Present but not primary orchestrator runtime

- `mongoose`, `mysql2`, and `meilisearch` are implemented in legacy `index.js` modes and legacy route files.
- `redis` and `@qdrant/js-client-rest` are present in `package.json` but no active backend JS import was found in the inspected code.
- A vector-store artifact in `knowledgeGraphService.js` imports `chromadb`; that file begins with a TODO saying it appears unused and no primary runtime import was found.

# 2. Verified Runtime Services

## `orchestrator.js`

- Responsibility: primary Express API runtime for the academic advisor backend.
- Started by: backend Dockerfile via `npm run start:orchestrator`; package script maps this to `node --max-old-space-size=3072 orchestrator.js`.
- Imports:
  - API routers: `routes/chatbot.js`, `routes/decision.js`, `routes/conversations.js`, `routes/health.js`.
  - Retrieval: `fetchNeo4jContext`, `convertToGraphData`, `ragService`.
  - Routing/synthesis: `brainRouter`, `fusionService`, `generateUnifiedAnswer`.
  - Memory: conversation service functions and decision memory functions.
  - Reliability/health: `modelFailoverManager`, `gemmaWarmService`, `checkSubsystemHealth`, `timeoutWrapper`.
  - Formatting: `responseFormatter`.
  - Gemini environment validation: `validateGeminiEnvironment`.
- Called by: Node process startup.
- Runtime role:
  - Initializes Express middleware.
  - Requires `INTERNAL_SECRET_KEY`.
  - Validates Gemini configuration at startup.
  - Connects Neo4j through `connectNeo4j()`.
  - Loads conversations through `loadConversations()`.
  - Mounts API routes.
  - Handles `POST /api/chatbot/query`.
  - Waits for LLM startup orchestration through `modelFailoverManager.waitForStartupCompletion()`.
  - Starts `gemmaWarmService`.

## `services/brainRouter.js`

- Responsibility: computes routing signals and selects a route.
- Imported by: `orchestrator.js`; also imported by a routing calibration test.
- Imports: `ragService`, `ROUTING_CALIBRATION`, `ACADEMIC_ALIAS_GROUPS`, `ONTOLOGY_NON_PERSON_CATEGORIES`, and golden path registry helpers.
- Called by:
  - `orchestrator.js` calls `brainRouter.analyzeQuery(...)`.
  - `orchestrator.js` calls `brainRouter.determineBestRoute(...)`.
- Runtime role:
  - Scores KG, RAG, hybrid, decision, career, FAQ, and direct KG/RAG signals.
  - Applies category boosts from `ragService.detectQueryCategory(...)`.
  - Applies intent, alias, historical route, deterministic policy, and ambiguity logic.
  - Returns route, confidence, reasoning, fallback chain, required services, thresholds, and telemetry.

## `services/unifiedAnswerService.js`

- Responsibility: final answer synthesis and response contract construction after retrieval.
- Imported by: `orchestrator.js`.
- Imports: `generateStableResponse`, `getLastGenerationMetadata`, `getOllamaRuntimeStatus`, `generateGeminiSynthesis`, `isGeminiTimeoutError`, `convertToGraphData`, `LLM_CONFIG`, and `getGemmaTelemetrySnapshot`.
- Called by: `orchestrator.js` calls `generateUnifiedAnswer(...)`.
- Runtime role:
  - Builds FAQ, KG, decision, and RAG context blocks.
  - Builds a final synthesis prompt with conversation history and lightweight memory.
  - Applies evidence absence and confidence gates before LLM synthesis.
  - Uses Gemini first through `generateGeminiSynthesis(...)`.
  - Falls back to deterministic context or Ollama if Gemini fails.
  - Sanitizes model output and repairs truncated responses.
  - Returns a structured result with answer, route, confidence, sources, used facts, missing information, graph, reasoning, and metadata.

## `services/neo4jcontext.js`

- Responsibility: Neo4j graph retrieval and graph response normalization.
- Imported by: `orchestrator.js`, `unifiedAnswerService.js`.
- Imports: `getSession`, `node-fetch`, `logger`, metrics helpers, `generateStableResponse`, and `expandAcademicQuery`.
- Called by:
  - `orchestrator.js` calls `fetchNeo4jContext(...)`.
  - `orchestrator.js` and `unifiedAnswerService.js` call/use `convertToGraphData(...)`.
- Runtime role:
  - Creates embeddings through Ollama `/api/embeddings`.
  - Selects retrieval intent and vector indexes.
  - Runs deterministic curriculum and ontology aggregation paths when detected.
  - Runs Neo4j vector retrieval and Cypher relationship expansion for other intents.
  - Applies threshold/index fallback logic.
  - Returns arrays with non-enumerable metadata such as `answer`, `confidence`, `deterministic`, and `metadata`.

## `services/ragService.js`

- Responsibility: Node HTTP gateway to the Python RAG retriever and answer services.
- Imported by: `orchestrator.js`, `services/brainRouter.js`, `services/healthProbes.js`, `routes/health.js`.
- Imports: `axios`, `axios-retry`, and `dotenv`.
- Called by:
  - `orchestrator.js` calls `ragService.search(...)`.
  - `brainRouter.js` calls `ragService.detectQueryCategory(...)`.
  - health code calls `ragService.healthCheck()`.
- Runtime role:
  - Detects query category.
  - Expands and simplifies queries.
  - Executes multi-pass retrieval:
    - pass 1: expanded query to retriever.
    - pass 2: simplified query with deeper retrieval.
    - pass 3: answer engine fallback.
  - Normalizes retriever and answer-engine responses into a canonical envelope.
  - Maintains RAG telemetry, endpoint registry, synthetic probes, retries, and a local RAG circuit breaker.

## `services/conversationService.js`

- Responsibility: persistent chat conversation storage and lightweight conversation memory.
- Imported by: `orchestrator.js`.
- Used by: `routes/conversations.js` through an API object injected by `orchestrator.js`.
- Imports: `path`, `crypto`, `fileURLToPath`, `createJsonPersistence`, `titleGenerator`, and `logger`.
- Called by:
  - Startup: `loadConversations()`.
  - Request handling: `getConversation(...)`, `pushTurn(...)`, `getConversationContext(...)`, `getConversationMemory(...)`, `updateConversationMemoryFromTurn(...)`, `saveConversation(...)`.
  - Conversation API route: list/create/get/rename/pin/delete through injected functions.
- Runtime role:
  - Stores conversations in memory and persists them to JSON.
  - Adds system/user/assistant messages.
  - Keeps `lastRoute` and lightweight memory fields.
  - Supports conversation listing, title generation, pinning, renaming, and deletion.

## `services/persistenceLayer.js`

- Responsibility: reusable JSON file persistence helper.
- Imported by: `conversationService.js`.
- Imports: `fs`, `path`, and `logger`.
- Called by: `conversationService.js` through `createJsonPersistence(...)`.
- Runtime role:
  - Ensures storage directory exists.
  - Loads JSON or default state.
  - Schedules debounced writes.
  - Writes via temp file then rename.
  - Exposes persistence status.

## `services/circuitStateManager.js`

- Responsibility: LLM circuit state machine.
- Imported by: `services/modelFailoverManager.js`.
- Imports: none.
- Called by: `modelFailoverManager.js` methods record primary/backup successes, failures, backup activation, startup readiness, and recovery probes.
- Runtime role:
  - Tracks states: `WAITING_FOR_OLLAMA`, `PRIMARY_COLD`, `CLOSED`, `DEGRADED`, `OPEN`, `HALF_OPEN`.
  - Tracks primary failures, backup failures, total failures, backup activations, failover count, recovery success, and transition timestamps.
  - Controls whether primary traffic is allowed, backup should be used, and primary probing should occur.

## `services/responseFormatter.js`

- Responsibility: normalized API response envelope.
- Imported by: `orchestrator.js`.
- Imports: none.
- Called by: `orchestrator.js` through `format(...)`, `formatInteractive(...)`, `formatStatic(...)`, and `formatErrorFallback(...)`.
- Runtime role:
  - Normalizes routes and sources.
  - Adds trace metadata including request id, route, degraded services, subsystem health, latency, routing confidence, response tier, query normalization, and route diagnostics.
  - Ensures output includes answer, final_answer, route, confidence, used_facts, missing_information, graph, sources, explainability, citations, reasoning, cid, conversationId, and requestId.

## `services/decisionService.js`

- Responsibility: Node wrapper for decision recommendations, local decision memory, career roadmap generation, and major comparison.
- Imported by: `orchestrator.js`, `routes/decision.js`, `routes/health.js`, `services/healthProbes.js`.
- Imports: `node-fetch`, `dotenv`, `fs`, `path`, and `callOllama`.
- Called by:
  - `orchestrator.js` calls `getRecommendation(...)`, `getUserMemory(...)`, `updateUserMemory(...)`, `deleteUserMemory(...)`, `buildCareerRoadmap(...)`, and `compareMajors(...)`.
  - `routes/decision.js` calls `getRecommendation(...)`.
  - health code calls `getDecisionMemoryStatus()`.
- Runtime role:
  - Loads/saves decision memory from `decision_memory.json`.
  - Extracts profile data from text using rule-based JSON parsing and optional Ollama extraction.
  - Calls the Python decision API endpoint `/api/v1/decisions/recommend` with `X-Internal-Secret`.
  - Builds local career roadmaps.
  - Handles comparison logic without calling the Python API.
  - Returns fallback objects on decision API errors.

## `services/geminiService.js`

- Responsibility: Gemini HTTP client for synthesis/humanization.
- Imported by: `orchestrator.js`, `services/unifiedAnswerService.js`, `services/conversationalHumanizer.js`.
- Imports: `node-fetch`.
- Called by:
  - `orchestrator.js` calls `validateGeminiEnvironment(...)` during startup.
  - `unifiedAnswerService.js` calls `generateGeminiSynthesis(...)`.
  - `conversationalHumanizer.js` calls `generateGeminiSynthesis(...)`.
- Runtime role:
  - Reads Gemini API key/model/base URL/timeout from environment.
  - Builds generation config.
  - Calls Gemini `:generateContent`.
  - Converts timeout, HTTP, missing-key, empty-response, and request errors into typed Gemini errors eligible for fallback.

## `services/academicAliases.js`

- Responsibility: static academic alias and vocabulary exports.
- Imported by: `services/brainRouter.js`, `services/academicQueryNormalizer.js`.
- Imports: none.
- Runtime role:
  - Exports curriculum terms, ontology alias groups, ontology expansion rules, non-person ontology categories, exact entity aliases, academic alias groups, domain vocabulary, and course formatting vocabulary.
  - `brainRouter.js` builds alias lookup from `ACADEMIC_ALIAS_GROUPS`.
  - `academicQueryNormalizer.js` uses alias groups for query normalization.

## Python RAG services

- `rag_system/phase3_retriever.py`
  - Responsibility: FastAPI retrieval service backed by Qdrant.
  - Runtime role: exposes `/`, `/search`, `/health`, `/warmup`, `/benchmark`; embeds queries with `BAAI/bge-m3`; searches Qdrant collection `aast_academic_rag_production` by default.
- `rag_system/phase4_llm_answer_engine.py`
  - Responsibility: FastAPI grounded answer service.
  - Runtime role: exposes `/`, `/answer`, `/health`, `/benchmark`; calls retriever `/search`; calls Ollama `/api/generate`; validates retrieval and answer confidence.

## Python decision API service

- `college-decision-system-backend/app/main.py`
  - Responsibility: FastAPI decision API.
  - Runtime role: includes routers under `/api/v1`; exposes `/health`; decision route `/api/v1/decisions/recommend` is called by `decisionService.js`.

# 3. Verified Databases

## Neo4j

- Status: active in primary orchestrator runtime.
- Purpose: graph-backed academic facts, ontology entities, curriculum/syllabus retrieval, faculty/course/program relationships, and graph visualization data.
- Where used:
  - `db/neo4j.js` creates the driver and sessions.
  - `orchestrator.js` initializes connection and calls graph retrieval.
  - `neo4jcontext.js` performs retrieval.
  - `routes/health.js` and `healthProbes.js` run health checks.
  - `routes/graph.js` is a legacy/manual Neo4j route module.
- Docker: `docker-compose.yml` defines `neo4j:5.26-community` on ports 7474 and 7687.

## Qdrant

- Status: active for RAG vector retrieval.
- Purpose: vector store for the Python RAG retriever.
- Where used:
  - `phase3_retriever.py` creates `QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)`.
  - `phase3_retriever.py` searches collection `RAG_COLLECTION_NAME`, defaulting to `aast_academic_rag_production`.
  - `docker-compose.yml` defines `qdrant/qdrant:v1.12.5` on port 6333.
- Files using it: `rag_system/phase3_retriever.py`, `rag_system/Dockerfile.retriever`, `docker-compose.yml`.

## SQLite through SQLAlchemy

- Status: active for the Python decision API container.
- Purpose: decision data used by the recommendation API.
- Where used:
  - `docker-compose.yml` sets `DATABASE_URL=sqlite:////app/runtime/dev.db`.
  - `college-decision-system-backend/Dockerfile` copies `dev.db` into `/app/runtime/dev.db` if needed.
  - `app/infrastructure/db/session.py` creates the SQLAlchemy engine from `settings.DATABASE_URL`.
  - `app/api/v1/routers/decisions.py` creates `SessionLocal()` for recommendations.

## JSON file persistence

- Status: active local persistence.
- Purpose:
  - Conversation history and lightweight memory: `services/conversationService.js`.
  - Decision/profile memory: `services/decisionService.js`.
- Files:
  - Conversations: `CONVERSATIONS_FILE` or `aast-ai-agent-main/backend/data/conversations.json`.
  - Decision memory: `process.cwd()/decision_memory.json`.

## MongoDB / MySQL / MeiliSearch

- Status: implemented only in legacy/non-primary backend paths.
- MongoDB:
  - `index.js` connects to `mongodb://127.0.0.1:27017/authDB`.
  - `routes/auth.js` uses `models/User.js`.
  - `orchestrator.js` does not mount auth routes.
- MySQL:
  - `db/mysql.js` creates a `mysql2` pool.
  - `routes/mysql.js` exposes `/students`.
  - Primary `orchestrator.js` does not import `db/mysql.js` or mount `routes/mysql.js`.
- MeiliSearch:
  - `db/meili.js` creates a MeiliSearch client.
  - `routes/search.js` exposes `/add` and `/q`.
  - Primary `orchestrator.js` does not import `db/meili.js` or mount `routes/search.js`.

# 4. Verified Request Lifecycle

## Main chat endpoint

1. Request enters `POST /api/chatbot/query` in `orchestrator.js`.
2. `res.json` is wrapped to record response latency/size and optionally run the Gemini humanizer through `humanizeGroundedAnswer(...)` if `shouldHumanizeResponseBody(...)` allows it.
3. The body must contain a non-empty string `query`; otherwise `responseFormatter.formatErrorFallback(...)` returns a 400 response.
4. The query is normalized through `normalizeAcademicQuery(...)`.
5. A conversation id is normalized or generated.
6. `getConversation(...)` loads or creates the conversation.
7. Prior messages and lightweight conversation memory are read.
8. Pre-router local handlers run:
   - conversation meta intent.
   - light conversational intent.
   - follow-up reference resolution.
   - demo graph query.
   - greeting check.
   - FAQ search.
9. If no local handler returns, intent data is selected through golden path, follow-up/multi-intent heuristics, ontology/profile heuristics, or dynamic Ollama intent extraction.
10. `checkSubsystemHealth(...)` gathers cached/active subsystem health.
11. `brainRouter.analyzeQuery(...)` builds route signals.
12. `brainRouter.determineBestRoute(...)` selects a route.
13. `orchestrator.js` may apply route locks/overrides for curriculum, deterministic KG, ontology facts, follow-up person references, or multi-intent queries.
14. Retrieval/engine execution runs based on selected route:
   - KG route: `fetchNeo4jContext(...)`.
   - RAG route: `ragService.search(...)`.
   - Hybrid route: KG and RAG are launched through `Promise.allSettled(...)`.
   - Decision route: local memory extraction and `getRecommendation(...)` or `compareMajors(...)`.
   - Career route: `buildCareerRoadmap(...)`.
   - LLM fallback route: `generateStableResponse(...)`.
15. Deterministic bypasses may return before unified synthesis:
   - conversation/greeting/FAQ.
   - deterministic multi-intent merge.
   - deterministic KG direct answer.
   - deterministic RAG direct answer.
   - ontology KG route lock.
   - interactive prompt for missing decision data.
16. If synthesis is needed, `generateUnifiedAnswer(...)` receives query, route, confidence, KG/RAG/FAQ/decision context, recent history, and conversation memory.
17. If `generateUnifiedAnswer(...)` fails validation or throws, `fusionService.fuse(...)` is attempted.
18. Final payload is enriched with KG/RAG/decision/career facts as applicable.
19. `recordAssistantTurn(...)` stores assistant output and updates lightweight conversation memory.
20. `responseFormatter.format(...)` produces the returned API envelope.

## Other API routes mounted by `orchestrator.js`

- `/api/chatbot/legacy`
  - Mounted from `routes/chatbot.js`.
  - `POST /query` logs and echoes `Backend received: "..."`
- `/api/decision`
  - Mounted from `routes/decision.js`.
  - `POST /recommend` validates `studentProfile` and `preferences`, then calls `getRecommendation(...)`.
- `/api/conversations`
  - Mounted from `routes/conversations.js`.
  - Routes: `GET /`, `POST /`, `GET /:cid`, `PATCH /:cid`, `PATCH /:cid/title`, `PATCH /:cid/pin`, `DELETE /:cid`.
- `/health` and `/api/health`
  - Mounted from `routes/health.js`.
  - Routes: `GET /`, `GET /enterprise`, `GET /metrics`.

# 5. Verified Routing Logic

## Route names

`brainRouter.js` defines these routes:

- `KG_DIRECT`
- `KG_ONLY`
- `RAG_DIRECT`
- `RAG_ONLY`
- `HYBRID_KG_RAG`
- `DECISION_ENGINE`
- `CAREER_ENGINE`
- `FAQ`
- `LLM_FALLBACK`

`orchestrator.js` also emits local/bypass route labels:

- `CONVERSATION_META`
- `CONVERSATION_LIGHT`
- `CONVERSATION_FOLLOWUP_CLARIFY`
- `DEMO_GRAPH`
- `KG_CLARIFICATION`
- `INTERACTIVE`
- `FATAL_FALLBACK`

## Calibration values

Verified defaults from `config/routingCalibration.js`:

- KG confidence threshold: `0.40`
- Hybrid confidence threshold: `0.34`
- LLM fallback/degraded threshold: `0.18`
- Person alias boost: `0.22`
- Requirements hybrid boost: `0.26`
- Scholarship hybrid boost: `0.34`
- Ambiguity margin: `0.12`
- Historical route boost: `0.06`
- Deterministic KG threshold: `0.70`
- Deterministic RAG threshold: `0.70`

## Pre-router routing conditions in `orchestrator.js`

- Meta conversation intent is handled before BrainRouter and bypasses Neo4j, RAG, Gemini, Ollama, and unified synthesis.
- Light conversational intent is handled locally before retrieval.
- Unresolved follow-up references can return a clarification route.
- Resolved follow-up references rewrite the query before routing.
- Demo graph queries use `demoGraphService`.
- Greetings use `checkGreeting(...)`.
- FAQ hits use `searchFAQ(...)`.

## Golden path logic

- `config/goldenPathRegistry.js` contains 11 registered golden paths.
- Verified golden path routes in registry summary:
  - `KG_DIRECT`: 8 entries.
  - `DECISION_ENGINE`: 2 entries.
  - `CAREER_ENGINE`: 1 entry.
- `brainRouter.js` enforces golden route policy, with health-aware degradation for KG/RAG/hybrid routes.
- `orchestrator.js` can cache golden responses and return static golden fallback payloads when the selected route fails.

## BrainRouter route selection

- Golden path match is evaluated first in `determineBestRoute(...)`.
- Ontology KG intents (`FACILITY`, `TRACK`, `PARTNER_INSTITUTION`, `GOVERNANCE`, `POLICY`, `CAMPUS`, `CURRICULUM`) route to `KG_DIRECT` when KG is healthy and hybrid is not forced.
- Forced hybrid routes to `HYBRID_KG_RAG` only when both KG and RAG are healthy.
- Strong deterministic policy evidence routes to `RAG_DIRECT` when RAG direct score meets threshold and RAG is healthy.
- Deterministic KG score routes to `KG_DIRECT` when KG direct score meets threshold and KG is healthy.
- Hybrid is selected when KG and RAG scores meet the hybrid threshold and the query is hybrid/ambiguous enough.
- Otherwise the top signal selects among decision, career, KG, RAG, or FAQ when its score meets the medium threshold.
- Low-confidence KG or RAG can still route to `KG_ONLY` or `RAG_ONLY` if the score is at least the degraded threshold and the subsystem is healthy.
- If all usable signals fail, route becomes `LLM_FALLBACK`.
- Ambiguity expands fallback chain and can add the second-best route.

## Orchestrator route overrides and fallback conditions

- Curriculum and selected ontology facts lock to `KG_DIRECT` and remove RAG escalation for those cases.
- Deterministic KG route can bypass unified synthesis.
- Deterministic RAG policy route can bypass unified synthesis.
- Empty KG results can escalate to RAG only if the fallback chain includes RAG and RAG is healthy.
- Empty RAG results can return a verified no-policy-evidence response or golden static fallback.
- Hybrid retrieval uses `Promise.allSettled(...)`; partial failures are recorded as degraded services.
- Hybrid total failure can downgrade to `LLM_FALLBACK` or golden static fallback.
- Decision route asks for missing high school percentage and/or budget before calling the decision API.
- Career route can use existing memory or inferred AI-related interests; otherwise it can ask the user to start with a recommendation.

# 6. Verified Memory Logic

## Conversation memory

- Stored by `conversationService.js`.
- Storage path: `CONVERSATIONS_FILE` or `aast-ai-agent-main/backend/data/conversations.json`.
- Persistence helper: `createJsonPersistence(...)` in `persistenceLayer.js`.
- Load timing: `orchestrator.js` calls `loadConversations()` during startup.
- Flush timing: `orchestrator.js` calls `flushConversations()` on `SIGINT` and `SIGTERM`.
- Write behavior:
  - Debounced by default to 500 ms.
  - Temp file is written and renamed by `persistenceLayer.js`.
- Conversation object includes:
  - `cid`
  - title metadata
  - timestamps
  - pinned flag
  - messages
  - `lastRoute`
  - `conversationMemory`
- `conversationMemory` includes:
  - `lastTopic`
  - `lastEntity`
  - `lastIntent`
  - `recentSubjects`
  - `lastAssistantSummary`
- Memory update source:
  - `orchestrator.js` calls `updateConversationMemoryFromTurn(...)` after assistant responses.
  - The update is built from user query, normalized query, assistant answer, route/intent, entities, KG/RAG/FAQ/decision context, and used facts.
- Context retrieval:
  - `getConversationContext(cid, maxTurns)` returns the system message plus recent non-system turns.
  - `MAX_CONTEXT_TURNS` defaults to 12.
- Curriculum follow-up memory:
  - `orchestrator.js` stores `convo.lastCurriculumCourse` when a safe curriculum course is matched.
  - Week-only curriculum follow-ups can reuse this course if recent context confirms it.

## Decision/profile memory

- Stored by `decisionService.js`.
- Storage path: `process.cwd()/decision_memory.json`.
- Load timing: `initMemory()` is called at module import time.
- Write behavior:
  - Saves are scheduled with a 300 ms delay.
  - Data is written to a temp file and renamed.
- Memory object default includes:
  - `studentProfile`
  - `preferences`
  - `history`
  - `rejected_majors`
  - `liked_majors`
  - `last_recommendation`
  - `version`
- `updateUserMemory(...)` deep-merges updates and appends unique array values for history/rejected/liked majors.
- Maximum sessions: 1000; if exceeded, the first key is evicted.
- Conversation deletion calls `deleteUserMemory(...)` through the conversations router delete hook.

# 7. Verified Reliability Logic

## Startup and service health

- `orchestrator.js` starts even if initial Neo4j connection fails; individual queries then degrade through retrieval error handling.
- `orchestrator.js` waits for `modelFailoverManager.waitForStartupCompletion()` before starting the HTTP listener.
- `routes/health.js` checks Neo4j, Ollama runtime status, decision API `/health`, RAG health, process memory, decision memory status, cache status, and metrics.
- `healthProbes.js` caches subsystem health for 15 seconds and treats stale cache older than 60 seconds as needing refresh.

## Concurrency and timeouts

- `orchestrator.js` defines lightweight semaphores:
  - LLM: `MAX_CONCURRENT_LLM`, default 5.
  - Neo4j: `MAX_CONCURRENT_NEO4J`, default 10.
  - RAG: `MAX_CONCURRENT_RAG`, default 8.
- `timeoutWrapper(...)` is used for route-level timeouts and fallback values.
- Intent extraction uses configurable timeout/deadline and can return deterministic `GENERAL` with degraded reason `INTENT_TIMEOUT`.

## LLM circuit/failover

- `circuitStateManager.js` implements states for primary/backup model health.
- `modelFailoverManager.js` uses `CircuitStateManager`.
- Verified state transitions include:
  - waiting for Ollama during startup.
  - primary cold state after startup preload failure.
  - degraded state after primary failure threshold or backup activation.
  - open state after backup/all-model failure thresholds.
  - half-open state for recovery probing.
- `unifiedAnswerService.js` reports Ollama runtime metadata in synthesis output.

## RAG reliability

- `ragService.js` configures `axios-retry`.
- 4xx responses are not retried.
- Network/idempotent errors and 5xx responses are retried according to `RAG_MAX_RETRIES`.
- A local RAG circuit breaker tracks `CLOSED`, `OPEN`, and `HALF_OPEN`.
- Primary endpoint fallback to alternate endpoint only occurs on endpoint-not-found errors.
- Retriever cold start can use a longer timeout.
- RAG search never needs to throw to the orchestrator for ordinary retrieval failure; it returns a structured failure envelope.

## Neo4j retrieval reliability

- Embedding generation retries up to `EMBED_MAX_ATTEMPTS`, default 2.
- Missing vector index errors cause fallback index attempts.
- Non-general/non-teaching/non-ontology empty results can trigger semantic fallback.
- Retrieval errors return an empty graph response with failure reason `KG_EXCEPTION`.
- Sessions are closed in `finally`.

## Synthesis reliability

- `unifiedAnswerService.js` exits early on total evidence absence.
- Retrieval confidence below `0.25` bypasses LLM synthesis and returns insufficient evidence fallback.
- Confidence between `0.25` and `0.40` uses degraded mode with lower temperature.
- Gemini failure can fall back to deterministic context or Ollama.
- Output sanitization removes model self-reference/meta phrases and repairs truncated answers.
- Orchestrator falls back from UnifiedAnswer to `fusionService.fuse(...)`.
- Fatal orchestrator errors attempt golden static fallback, then fusion fallback, then formatted error fallback.

# 8. Verified Observability

- `logger.js` writes structured JSON log lines to daily log files under `LOG_DIR` or `logs`.
- `logger.js` also writes formatted console output and redacts metadata keys matching password/secret/token/authorization/api key patterns.
- `logger.js` rotates log files when file size exceeds `LOG_MAX_BYTES`, default 5 MB.
- `metrics.js` stores counters and timers in memory.
- `routes/health.js` exposes metrics through `GET /health/metrics` and `GET /api/health/metrics`.
- `orchestrator.js` records:
  - `http_chatbot_query_total`
  - `http_chatbot_latency_ms`
  - route-specific counters
  - normalization counters
  - retrieval/synthesis/fallback counters
- `orchestrator.js` writes chat audit events to `logs/chat.log`.
- `orchestrator.js` writes routing audit JSONL events to `logs/routing-audit.jsonl` unless `ROUTING_AUDIT_ENABLED=false`.
- `ragService.js` maintains internal telemetry for pass successes, failures, fallback count, average latency, endpoint registry, capabilities, circuit breaker, and synthetic probes.
- `routes/health.js` includes process memory and LLM runtime status in health payloads.
- No external metrics backend, tracing backend, APM service, or telemetry collector was verified in the inspected code.

# 9. Partial / Experimental / Disconnected Features

- `aast-ai-agent-main/backend/index.js`
  - Appears legacy from its file header comments.
  - Supports mode-based startup for `neo`, `sql`, and `meili`.
  - Default mode prints a message asking for a service mode and does not start the main orchestrator.
  - Not used by backend Dockerfile.

- Legacy auth/MongoDB path
  - `index.js` connects to MongoDB and mounts `/auth`.
  - `routes/auth.js` and `models/User.js` implement signup/login.
  - `orchestrator.js` does not mount `/auth`.
  - Partially integrated feature.

- Legacy MySQL path
  - `db/mysql.js` and `routes/mysql.js` exist.
  - Mounted only by legacy `index.js sql` mode.
  - No MySQL service is defined in top-level `docker-compose.yml`.
  - Partially integrated feature.

- Legacy MeiliSearch path
  - `db/meili.js` and `routes/search.js` exist.
  - Mounted only by legacy `index.js meili` mode.
  - No MeiliSearch service is defined in top-level `docker-compose.yml`.
  - Partially integrated feature.

- `knowledgeGraphService.js`
  - File imports `chromadb`.
  - File comment says it appears unused and asks to confirm before deletion.
  - No active primary runtime import was found.
  - Appears experimental or incomplete.

- Backend package dependencies with no verified primary runtime import
  - `redis`
  - `@qdrant/js-client-rest`
  - `@chroma-core/default-embed`
  - These were found in `package.json`/lock files but not as active primary backend JS imports.

- `rag_system/app.py`
  - Streamlit UI file exists in the RAG system.
  - Docker Compose starts `phase3_retriever.py` and `phase4_llm_answer_engine.py`, not the Streamlit app.
  - Partially integrated feature.

- `neo4jCache` in `orchestrator.js`
  - Declared and reported in cache status.
  - No verified active cache write path was found during current inspection.
  - Implementation detail not fully verified from current code inspection.

- `decisionService.compareMajors(...)`
  - Returns a comparison object before two later logging lines.
  - The later `console.timeEnd(...)` and `console.log(... result ...)` lines are unreachable after the return.
  - This does not block the returned comparison object but indicates incomplete cleanup.

- `ragService.search(query, { topK: ... })` call sites
  - `orchestrator.js` passes a second options argument.
  - `ragService.search` is defined as `async search(query)` and does not accept that argument.
  - The call still executes because JavaScript ignores extra arguments, but `topK` is not consumed by the current `search` signature.

