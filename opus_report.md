# 🏛️ OPUS SYSTEM AUDIT REPORT
### AAST AI Agent Platform — Full Technical Review
**Audited by:** Senior AI Systems Architect  
**Date:** April 19, 2026  
**Project Path:** `C:\Users\mh978\Downloads\AI_AGENT`  
**Audit Scope:** Node.js Orchestrator · FastAPI Decision System · React Frontend

---

## 1. SYSTEM OVERVIEW

This platform is a **multi-service AI advisory system** for AAST University students. Its core purpose is to help students select academic programs by combining:

- **Knowledge Graph Q&A** (via Neo4j + Ollama LLM)
- **AI-powered college recommendation** (via FastAPI + Gemini 2.5 Flash)
- **A voice-capable chat UI** (React + Vite + TailwindCSS)
- **Admin panel** for program constraint management

The system spans **two independently runnable backends**, **five frontend page modules**, and **a shared SQLite database** for decision data — making it a genuinely non-trivial distributed architecture for its stage of development.

---

## 2. ARCHITECTURE DIAGRAM (TEXT-BASED)

```
┌─────────────────────────────────────────────────────────────┐
│                     REACT FRONTEND                          │
│  (Vite + TypeScript + TailwindCSS + React Router v7)       │
│                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ AdvisorPage │  │ DecisionPage │  │ AdminDashboard   │  │
│  │ (RAG Chat + │  │ (Form-based  │  │ (Program config  │  │
│  │  D3 Graph)  │  │  Recommen-   │  │  edit via REST)  │  │
│  └──────┬──────┘  │  dations)    │  └────────┬─────────┘  │
│         │         └──────┬───────┘           │             │
│         │                │                   │             │
│  ┌──────▼────────────────▼───────────────────▼──────────┐  │
│  │              agentService.ts / backendService.ts      │  │
│  │   USE_MOCK = true ← ⚠️ HARDCODED                    │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────┬──────────────────────────┬────────────┘
                     │                          │
      /api/chatbot/query                /api/v1/* (all routes)
                     │                          │
┌────────────────────▼──────────┐  ┌────────────▼────────────┐
│   NODE.JS ORCHESTRATOR        │  │  FASTAPI DECISION SYSTEM │
│   orchestrator.js : 8000      │  │  main.py : 8000 ⚠️       │
│                               │  │                          │
│  ┌────────────────────────┐   │  │  /api/v1/decisions/      │
│  │  1. Greeting Check     │   │  │    recommend             │
│  │  2. Ollama Intent LLM  │   │  │  /api/v1/chat/message    │
│  │  3. Decision Router    │───┼──┤  /api/v1/admin/programs  │
│  │  4. Neo4j RAG          │   │  │  /api/v1/students/       │
│  │  5. FAQ Fallback       │   │  │  /api/v1/voice/          │
│  │  6. Ollama LLM Gen     │   │  │                          │
│  └────────────────────────┘   │  │  AgentService            │
│                               │  │  (Gemini 2.5 Flash +     │
│  In-Memory Session Store      │  │   Function Calling)      │
│  Map<cid, conversation>       │  │                          │
│                               │  │  SQLite: dev.db          │
│  decisionService.js           │  │  decision_* schema       │
│  Map<cid, studentProfile>     │  │                          │
└───────────────────────────────┘  └──────────────────────────┘
         │                                    │
         ▼                                    ▼
┌─────────────────┐               ┌─────────────────────────┐
│ Ollama (local)  │               │ Google Gemini 2.5 Flash  │
│ llama3.2:3b     │               │ (Function Calling API)   │
│ nomic-embed-text│               └─────────────────────────┘
└────────┬────────┘
         │
┌────────▼────────┐
│ Neo4j Knowledge │
│ Graph           │
│ (Vector Index + │
│  Relationship   │
│  Traversal)     │
└─────────────────┘
```

---

## 3. DATA FLOW — REQUEST LIFECYCLE

### Path A: General University Q&A (RAG)
```
User types question
  → AdvisorPage.sendMessage()
    → agentService.askAgent()
      → backendService.sendMessageToBackend()
        ⚠️ USE_MOCK=true → returns MOCK DATA (real backend not touched)
        [In production intent] → POST /api/chatbot/query
          → orchestrator.js
            → checkGreeting() [early exit]
            → extractDynamicIntent() [Ollama 5s timeout]
            → if RECOMMEND → getRecommendation() → FastAPI
            → fetchNeo4jContext() [vector similarity]
            → fetchEntitiesFromNeo4j() [entity match]
            → searchFAQ() [keyword fallback]
            → Ollama LLM generate() [5s timeout]
          ← { answer, source, cid, requestId }
        ← normalizeAdvisorResponse()
      ← { answer, source, decision, graph }
    ← { answer, source, decision, graph, action? }
  ← renders ChatMessage + DecisionCard
```

### Path B: Decision/Recommendation (Direct)
```
User opens /decision
  → DecisionPage.fetchRecommendations()
    → POST http://localhost:8000/api/v1/decisions/recommend
      → decisions.py router
        → verify_internal_secret() ← Dependency
        → RecommendProgramsUseCase.execute()
          → fee resolution, scoring, interest matching
        ← AgentRecommendResponseSchema
      ← { recommended_major, confidence, reason, warnings }
    ← renders CollegeCard grid
```

### Path C: Decision Chat (Voice capable)
```
User opens /decision/chat (ChatPage.tsx)
  → POST http://localhost:8000/api/v1/chat/message
    → chat.py router
      → AgentService.process_message()
        → Gemini 2.5 Flash (function calling)
          → triggers get_recommendations tool
          → executes RecommendProgramsUseCase
          → returns NL explanation + recommendations[]
        ← { reply, recommendations[] }
    ← renders CollegeCard inline in chat
```

---

## 4. INTEGRATION STATUS

| Integration Point | Status | Notes |
|---|---|---|
| Decision System → FastAPI `/recommend` | ✅ Wired | orchestrator.js calls decisionService, which calls FastAPI |
| Decision System Memory (per-session) | ✅ Implemented | `decisionMemory` Map with `deepMerge` |
| Intent → Decision routing | ✅ Working | `extractDynamicIntent` + `DECISION_INTENTS` list |
| Intent → RAG routing | ✅ Working | Falls through to Neo4j context path |
| Frontend → Node.js Orchestrator | ❌ DISABLED | `USE_MOCK = true` in `backendService.ts` — ALL traffic goes to mock |
| Frontend AdvisorPage → Real backend | ❌ BROKEN | Hits mock, never reaches port 8000 |
| Frontend DecisionPage → FastAPI | ✅ DIRECT | Bypasses Node.js; hits port 8000 directly |
| ChatPage → FastAPI `/chat/message` | ✅ DIRECT | Uses Gemini for NL; bypasses Node.js entirely |
| AdminDashboard → FastAPI `/admin/` | ✅ DIRECT | Works when backend is running |
| StudentContext → Decision form | ✅ Wired | `useStudent()` hook + `DecisionForm` updates profile |
| StudentContext → ChatPage | ❌ UNUSED | `useStudent()` import is commented out in ChatPage.tsx |
| GraphVisualizer ← real Neo4j data | ❌ NEVER POPULATED | Graph data only comes from mock; RAG context not converted to graph |
| Voice (VoiceRecorder) → FastAPI | ✅ DIRECT | `/api/v1/voice/` endpoint exists |
| Neo4j vector index | ✅ Functional | node_embedding_index used correctly |
| FAQ Service | ✅ Functional | Keyword + tag match, read at startup |
| Legacy chatbot route | ⚠️ DEAD CODE | Returns hardcoded string; no real function |
| Conversation memory pruning | ✅ Working | 12-turn window with system prompt preservation |

---

## 5. CRITICAL ISSUES

### 🔴 CRITICAL #1 — Mock Mode Permanently On
**File:** `frontend/src/services/backendService.ts`, line 5  
```ts
const USE_MOCK = true;
```
This is the single most impactful bug in the entire project. Every message from `AdvisorPage` goes to `mockResponse()`. The real Node.js Orchestrator at port 8000 is never called. The frontend behaves as if the AI is responding, but it is not. The user will never see Neo4j graph data, real intent classification, or real RAG responses through this path.

**Fix:** `const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';`  
Add `VITE_USE_MOCK=false` to `.env`

---

### 🔴 CRITICAL #2 — Port Collision: Both Backends on Port 8000
**File:** `orchestrator.js` line 22 and `college-decision-system-backend` (Uvicorn default: 8000)

The Node.js orchestrator listens on port 8000. The FastAPI decision system also runs on port 8000. They **cannot both run simultaneously**. Since `DecisionPage.tsx` and `ChatPage.tsx` call port 8000 directly for FastAPI routes, and the orchestrator also occupies port 8000, only one can win.

Looking at `decisionService.js` line 238:
```js
const response = await fetch(`${API_URL}/api/v1/decisions/recommend`, ...);
// API_URL defaults to http://127.0.0.1:8005
```
The Node.js-side service correctly targets port **8005**, but the `.env` in college-decision-system-backend shows it was configured for 8005. However, the **frontend pages bypass this** and still call `http://localhost:8000/api/v1/*` hardcoded.

**Fix:** Standardize: FastAPI on 8005. Frontend pages must point to `VITE_DECISION_API_URL` env variable, not hardcoded localhost:8000.

---

### 🔴 CRITICAL #3 — Missing `node-fetch` Timeout in `ollamaService.js`
**File:** `backend/services/ollamaService.js`  
```js
export async function callOllama(prompt, model = "llama3.2:3b-instruct-q4_K_M") {
  const res = await fetch("http://localhost:11434/api/generate", {
    // ❌ NO AbortController, NO timeout
  });
```
`callOllama` is used inside `extractProfileData` (the LLM fallback path) which is called from `getRecommendation`. If Ollama is slow/down, this call **hangs indefinitely**, blocking the entire async request pipeline. The orchestrator's own Ollama calls have 5s timeouts, but this service function does not.

**Fix:** Add AbortController with 8–10s timeout to `callOllama`.

---

### 🔴 CRITICAL #4 — `getRecommendation()` Called with Wrong Signature in `decision.js` Route
**File:** `backend/routes/decision.js`, line 112  
```js
const recommendationResult = await getRecommendation(studentProfile, preferences);
```
**But the actual function signature in `decisionService.js` is:**
```js
export async function getRecommendation(input) { ... }
// Expects: { text, memory, cid } OR a studentProfile-shaped object
```
When called from the route handler, it receives `studentProfile` object as `input`, and `preferences` is silently ignored. The function then enters the `else` branch (`studentProfile = input`), sets `preferences = input.preferences || {}`, which will be empty because preferences was the *second argument*. This is a **data corruption bug** — preferences (interests, career_goals) are always empty when called via the HTTP decision route.

---

### 🔴 CRITICAL #5 — Decision Route Security Check is Applied Internally But Not on FastAPI
**File:** `backend/routes/decision.js`, line 49  
The Node.js decision route checks `x-internal-secret`, but this route (`/api/decision/recommend`) is exposed to anyone who can reach port 8000. More critically, `DecisionPage.tsx` calls the FastAPI `/api/v1/decisions/recommend` directly from the **browser**, which means the `X-Internal-Secret` header is sent from client-side JavaScript — making it trivially extractable by any user with DevTools.

---

### 🟠 HIGH #6 — FAQ Service Crashes at Startup If `data/faq.json` Missing
**File:** `backend/faqService.js`, line 5  
```js
const faqData = JSON.parse(fs.readFileSync(faqPath, "utf-8"));
```
This is a synchronous read at module load time. If the file is missing or malformed, **the entire orchestrator crashes before it starts**. No try/catch, no fallback empty array.

---

### 🟠 HIGH #7 — Conversation Memory is Pure In-Memory (Process-Scoped Only)
**File:** `backend/orchestrator.js`, line 66  
```js
const conversations = new Map();
```
Every server restart destroys conversation history. Any crash means users lose context mid-conversation. There is no Redis, database, or file persistence. This is fine for development but is a single-node, single-process limitation with zero fault tolerance.

---

### 🟠 HIGH #8 — `agentService.ts` Has Logic Race Condition
**File:** `frontend/src/services/agentService.ts`  
```ts
const response = await sendMessageToBackend(input);  // Always called

if (isDecision) {
  return {
    answer: "Here is your personalized recommendation 👇",
    decision: response.decision || mockDecisionData,  // Uses mockDecisionData as fallback
  };
}
```
The backend is *always* called regardless of `isDecision`, but then the answer is **overridden** unconditionally with a hardcoded string. The real `response.answer` from the backend is discarded. Even if the backend returns a better message, the user always sees "Here is your personalized recommendation 👇". Also, `mockDecisionData` is a hardcoded constant that overrides any real decision if `response.decision` is null.

---

### 🟠 HIGH #9 — `CORS allow_origins=["*"]` in FastAPI with `allow_credentials=True`
**File:** `college-decision-system-backend/app/main.py`  
```python
CORSMiddleware(allow_origins=["*"], allow_credentials=True, ...)
```
This is an invalid CORS configuration. The CORS spec prohibits `allow_credentials=True` when `allow_origins=["*"]`. Any browser using `fetch` with credentials will reject this. Modern browsers will log a CORS error and block the request.

---

### 🟡 MEDIUM #10 — DecisionPage Component Export Name Mismatch
**File:** `frontend/src/decision/pages/DecisionPage.tsx`, line 11  
```tsx
export default function DashboardPage() {   // ← WRONG NAME
```
The component is exported as `DashboardPage` but the file is `DecisionPage.tsx` and it's imported as `DecisionPage`. This causes confusion and will break code completion, testing, and React DevTools identity. It's a cosmetic bug but defeats TypeScript's purpose.

---

### 🟡 MEDIUM #11 — index.js (Legacy Entry Point) Starts Without Orchestrator
**File:** `backend/index.js`  
The old entry point starts separate "mode" servers (neo/sql/meili) on different ports. `orchestrator.js` is the **actual production entry** with decision routing, but isn't called from `index.js`. There is no unified startup script or `docker-compose.yml`. The system requires manually starting 4+ processes:
1. Ollama
2. Neo4j
3. Node.js orchestrator (`node orchestrator.js`)
4. Python FastAPI `uvicorn app.main:app --port 8005`
5. Frontend `npm run dev`

No documentation, shell script, or process manager exists for this.

---

### 🟡 MEDIUM #12 — `react` and `react-dom` Listed as Dependencies in Backend `package.json`
**File:** `aast-ai-agent-main/backend/package.json`  
```json
"react": "^19.2.0",
"react-dom": "^19.2.0"
```
These have absolutely no business being in a Node.js Express backend. `vite` is also listed as a backend devDependency. This inflates `node_modules` by ~50MB and is a sign of accidental contamination.

---

### 🟡 MEDIUM #13 — FAQ Keyword Matching Is Fragile and Low Precision
**File:** `backend/faqService.js`, line 12  
```js
if (q.includes(item.question.toLowerCase().split(" ")[0])) {
```
This matches only the **first word** of each FAQ question. For a question like "What are the admission requirements?", it only checks if the query contains "what". This will produce false positives for almost anything and spam irrelevant FAQ hits.

---

### 🟡 MEDIUM #14 — `ffmpeg.exe` (79MB) Committed to Git Repository
**File:** `college-decision-system-backend/ffmpeg.exe` (79,826,272 bytes)  
A full binary is committed to source control. This makes the repo ~80MB heavier, slows clones, and should be an installation prerequisite or managed via a package, not committed.

---

## 6. PART 4: SYSTEM DESIGN EVALUATION

### Scalability — Score: 3/10
- **In-memory session state** in orchestrator: dies on restart, prevents horizontal scaling
- **In-memory decision memory**: same problem. No Redis/external store
- **SQLite for production DB**: not horizontally scalable. Each FastAPI instance uses its own file
- The Gemini API call in AgentService is synchronous (FastAPI route is not `async def`); this blocks a worker thread per request during LLM streaming
- No message queue, no worker pools, no load balancer config
- Ollama on localhost means the entire LLM inference capacity is one machine

### Modularity — Score: 7/10
The best-designed layer in the project. The FastAPI backend uses a clean layered architecture:
- `api/v1/routers/` → HTTP layer
- `application/use_cases/` → business logic
- `application/services/` → domain services (fee resolver, tuition calculator, etc.)
- `infrastructure/db/repositories/` → data access
- The Node.js side is less modular — `orchestrator.js` is a single 363-line file combining routing, LLM calls, and session management

### Maintainability — Score: 5/10
- Good: TypeScript on frontend with clear interfaces in `types.ts`
- Good: FastAPI Pydantic schemas enforce contracts
- Bad: `USE_MOCK = true` hardcoded constant will be forgotten and shipped to production
- Bad: Multiple duplicate `.txt` files beside `.js` files (e.g., `decisionService.txt`)
- Bad: No unit tests for the Node.js orchestrator at all
- Bad: 30+ Python utility scripts at the root of the decision system that are one-off data repair scripts — these should have been removed or moved to `scripts/`
- Bad: No `.env.example` for the Node.js backend

### Performance — Score: 5/10
- ✅ 5s AbortController timeouts on Ollama calls (intent + generation)
- ✅ Session TTL (3h) with conversation pruning (12 turns)
- ❌ Two sequential Ollama calls per request (intent classification + generation) with no caching
- ❌ `extractProfileData` in decisionService has no timeout (blocks indefinitely)
- ❌ FastAPI routes use `db = SessionLocal()` without connection pooling or `Depends(get_db)` pattern, creating a new DB connection per request
- ❌ Neo4j graph traversal result can contain massive `props` objects with no field whitelist
- ❌ The `DecisionPage` fires an API call on every profile change with only a 500ms debounce — rapid typing in form fields causes chattering

### Error Handling — Score: 6/10
- ✅ AbortError specifically caught for Ollama timeouts
- ✅ Neo4j errors return empty array (non-fatal)
- ✅ Frontend `sendMessageToBackend` catches and displays errors
- ✅ AgentService wraps all processing in try/except with graceful reply
- ❌ `faqService.js` crashes at startup with no error boundary
- ❌ `ollamaService.js` has zero error handling
- ❌ `decision.js` route catches errors but returns HTTP 200 for all failures (makes error detection impossible for callers)
- ❌ FastAPI `chat.py` raises HTTPException 500 on any internal error, leaking internal error messages to clients

---

## 7. PART 5: MEMORY SYSTEM REVIEW

### Conversation Memory (orchestrator.js)
```
Map<cid, { messages[], lastActive }>
TTL: 3 hours | Window: 12 turns | System prompt preserved
```
**Assessment:** Functionally correct for single-node deployment. The pruning logic at line 93-97 preserves the system message and trims to the last 12 turns — that is correctly implemented. The `makeId()` function at line 51 uses only 6 hex characters (24 bits), giving only ~16 million unique values before collision probability becomes significant. For a production system, use `crypto.randomUUID()`.

**Critical Flaw:** The system prompt is pushed again into the conversation on every RAG request (line 314: `pushTurn(convo, "system", systemPrompt)`). This means the conversation array accumulates multiple system prompts over time, polluting the context window passed to Ollama. This degrades LLM response quality over multi-turn conversations.

### Decision Memory (decisionService.js)
```
Map<cid, { studentProfile, preferences }>
deepMerge() → safeMerge()
```
**Assessment:** The `deepMerge` function (lines 24-40) is correctly implemented for nested objects. The `safeMerge` function (lines 174-182) is a shallower variant that only skips `null`/`undefined` values — this is appropriate for the profile update context.

**Issue 1 — Memory Never Cleared**: Decision memory has no TTL. A session can persist forever. This is a memory leak for long-running servers.

**Issue 2 — Memory and Conversation are Separate Stores**: The Node.js orchestrator maintains `conversations` Map keyed by `cid`. The decision service maintains `decisionMemory` Map keyed by `cid`. These are separate but share the same `cid` key — which is good design. However, the conversation memory has a 3h TTL; the decision memory has none. After 3 hours, a user gets a fresh conversation but their decision profile from hours ago is still in memory — potentially polluting a new session.

**Issue 3 — Missing Data Check Has Wrong Condition**: `decisionService.js` line 209:
```js
if (!studentProfile.high_school_percentage) {
```
This fails for a score of `0` (technically falsy, though rare). More importantly, it doesn't check all required fields — `certificate_type` and `budget` are also critical but missing the check defaults them to "unknown" and `0`, causing the recommendation engine to run with garbage defaults rather than asking for clarification.

**Issue 4 — Multi-turn Consistency**: The decision memory correctly accumulates data across turns via `updateUserMemory`. However, once a successful recommendation is made and stored, subsequent turns in the same session will re-use the stale stored profile even if the user changes their mind ("actually, my budget is higher"). The merge strategy keeps the new value (correct), but `safeMerge` skips null/undefined, so a user cannot "clear" a field they previously provided.

---

## 8. PART 6: FRONTEND ↔ BACKEND CONTRACT

### Contract Validation Table

| Field | Backend Produces | Frontend Expects | Status |
|---|---|---|---|
| `answer` | `string` | `string` | ✅ Match |
| `source` | `"greeting"` / `"faq"` / `"rag"` / `"decision"` / `"error"` | `string?` | ✅ Match |
| `cid` | `string` | not consumed – not passed back in next request | ❌ BUG |
| `decision.recommended_major` | `string` | `string` | ✅ Match |
| `decision.confidence` | `number` (0-100 or 0-1, inconsistent) | normalized to 0-100 by `normalizeConfidence()` | ⚠️ Edge case |
| `decision.reason` | `string` | `string` | ✅ Match |
| `decision.warnings` | `string[]` | `string[]` | ✅ Match |
| `graph` | never populated in RAG response | `GraphData \| null` | ❌ Always null from real backend |
| `requestId` | `number` (Date.now()) | not consumed by frontend | Unused |

### Critical Contract Breaks

**BUG: `cid` Not Sent Back on Subsequent Requests**  
The server generates and returns `cid` on first request. The frontend receives it but never stores it and never sends it back. Every request from the same browser session creates a **new** conversation ID, making multi-turn memory in the orchestrator completely useless. The `conversations` Map fills up with single-turn orphaned sessions.

In `backendService.ts` line 228:
```ts
const result = await post("/graph/ask", { question: message }, getToken());
//                                         ↑ No cid sent
```

**BUG: Confidence Normalization Inconsistency**  
The orchestrator outputs confidence like:
```js
const confidence = rec.confidence > 1 ? rec.confidence : rec.confidence * 100;
// orchestrator.js line 255-257
```
The frontend normalizes it again:
```ts
return raw > 1 ? Math.max(0, Math.min(raw, 100)) : Math.round(raw * 100);
// backendService.ts line 107
```
So if the backend sends `87` (already normalized), and it goes through both paths, the value is correct only by accident. If the FastAPI sends `0.87` it gets multiplied to `87` in orchestrator, then checked again in frontend. If FastAPI sends `87` and orchestrator skips multiply (>1), frontend gets `87` correctly. This dual-normalization is fragile and will break the moment the FastAPI response format changes.

**TYPE MISMATCH: DecisionPage Expected vs FastAPI Actual**  
`DecisionPage.tsx` calls `/api/v1/decisions/recommend` which returns `AgentRecommendResponseSchema`:
```
{ recommended_major, confidence, reason, score_breakdown, warnings }
```
But `DecisionPage` renders CollegeCard expecting:
```
{ program_name, college_name, score, match_type, confidence_level, 
  estimated_semester_fee, currency, fee_mode, affordability_label,
  score_breakdown, warnings }
```
These are **completely different schemas**. `DecisionPage` uses `response.data.recommendations` (array), but the agent endpoint returns a single top match — not an array. The `DecisionPage` is designed to call the **full** `/decisions/recommend` endpoint (which returns `recommendations[]`), not the agent endpoint.

---

## 9. PART 7: FINAL VERDICT

### System Level: **Intermediate → Upper Intermediate**

This is not a beginner project. There is genuine architectural thinking here: layered FastAPI with clean use-case separation, working Gemini function calling with real tool execution, Neo4j vector similarity search, multi-turn memory design, voice input/output capability. These are non-trivial pieces that someone clearly understood and built with care.

However, it is **not production-ready**, and in its current state the **main AI flow does not actually work** because of `USE_MOCK = true`.

---

### What Is DONE ✅

| Feature | Status |
|---|---|
| FastAPI Decision Engine with scoring, fee resolution, interest matching | ✅ Done |
| Gemini 2.5 Flash function calling integration | ✅ Done |
| Neo4j vector similarity RAG pipeline | ✅ Done |
| Multi-turn conversation memory (per-session) | ✅ Done |
| Decision memory with deep merge | ✅ Done |
| Intent classification via Ollama | ✅ Done |
| Greeting + FAQ + RAG + Decision routing pipeline | ✅ Done |
| Voice input/transcription (VoiceRecorder + Whisper endpoint) | ✅ Done |
| Admin panel for program gatekeeper rules | ✅ Done |
| D3.js knowledge graph visualizer | ✅ Done |
| CollegeCard component with full score breakdown | ✅ Done |
| StudentContext provider and profile state | ✅ Done |
| AbortController timeouts on Ollama | ✅ Done |
| ChatPage with direct Gemini-powered advisory | ✅ Done |

---

### What Is NOT DONE ❌

| Gap | Impact |
|---|---|
| `USE_MOCK = true` in production code | 🔴 Entire AdvisorPage is fake |
| `cid` not returned to backend between turns | 🔴 Multi-turn memory is broken |
| Port conflict (Node.js + FastAPI both on 8000) | 🔴 Both cannot run simultaneously |
| `ollamaService.js` has no timeout | 🔴 Can hang forever |
| Wrong `getRecommendation()` call signature in route | 🔴 Preferences always empty |
| DecisionPage schema mismatch with backend | 🟠 UI will break or show partial data |
| Graph data never populated from real RAG response | 🟠 GraphVisualizer always empty |
| No process manager / startup scripts | 🟠 Developer experience nightmare |
| No TTL on decision memory | 🟡 Memory leak |
| Multiple system prompts accumulating in conversation | 🟡 Degrades LLM quality over time |
| `ffmpeg.exe` in repo, dead scripts in root | 🟡 Maintainability |
| CORS credentials + wildcard misconfiguration | 🟠 Breaks credentials-based requests |
| No authentication on decision/admin routes from frontend | 🔴 Security |

---

## 10. TOP 5 MOST CRITICAL IMPROVEMENTS

### #1 — Turn Off Mock Mode and Fix Port Conflict (30 min fix)
```ts
// backendService.ts
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000/api";
```
```python
# Run FastAPI on 8005 consistently
# uvicorn app.main:app --port 8005
```
```ts
// DecisionPage.tsx, ChatPage.tsx, AdminDashboardPage.tsx
const DECISION_API_URL = import.meta.env.VITE_DECISION_API_URL || "http://localhost:8005";
```

### #2 — Fix `cid` Round-Trip for Multi-Turn Memory (1 hour)
```ts
// agentService.ts – store and send cid
let sessionCid: string | null = localStorage.getItem("agent_cid");

const result = await post("/chatbot/query", { question: message, cid: sessionCid });
if (result.cid) localStorage.setItem("agent_cid", result.cid);
```
Without this, the in-memory conversation store in orchestrator.js is completely wasted.

### #3 — Fix `getRecommendation()` Call Signature Mismatch (15 min)
```js
// backend/routes/decision.js, line 112
// WRONG:
const recommendationResult = await getRecommendation(studentProfile, preferences);

// CORRECT:
const recommendationResult = await getRecommendation({
  studentProfile,
  preferences
});
```
And update `getRecommendation()` to handle the `{ studentProfile, preferences }` direct input shape.

### #4 — Add Timeout to `ollamaService.js` (15 min)
```js
export async function callOllama(prompt, model = "llama3.2:3b-instruct-q4_K_M", timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, stream: false }),
      signal: controller.signal
    });
    clearTimeout(timer);
    const data = await res.json();
    return data.response?.trim();
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") throw new Error("Ollama timeout");
    throw err;
  }
}
```

### #5 — Fix Accumulating System Prompts in Conversation (10 min)
```js
// orchestrator.js — instead of pushTurn for system prompt:
// Replace the existing system message rather than appending a new one
function updateSystemPrompt(convo, content) {
  const systemIdx = convo.messages.findIndex(m => m.role === "system");
  if (systemIdx >= 0) {
    convo.messages[systemIdx].content = content;
  } else {
    convo.messages.unshift({ role: "system", content });
  }
}
// Replace line 314:  pushTurn(convo, "system", systemPrompt);
// With:              updateSystemPrompt(convo, systemPrompt);
```

---

## 11. FINAL EVALUATION SCORECARD

| Dimension | Score | Comment |
|---|---|---|
| Architecture Design | 7/10 | Clean separation between Node.js orchestrator and FastAPI; good layering in Python |
| Integration Completeness | 4/10 | Mock mode disables the primary flow; cid not round-tripped |
| Code Quality | 5/10 | Good parts (TypeScript, Pydantic) undermined by critical bugs |
| System Design | 5/10 | In-memory state, no startup scripts, port collisions |
| Memory System | 6/10 | Correct design, implementation bugs in merging and TTL |
| Frontend ↔ Backend Contract | 4/10 | Schema mismatch, cid not sent, confidence dual-normalization |
| Security | 3/10 | Secrets in browser, wildcard CORS + credentials, no auth on admin |
| Error Handling | 6/10 | Good timeout discipline; fatal startup crash; HTTP 200 for all errors |
| Maintainability | 5/10 | Good: TypeScript + Pydantic. Bad: 30+ orphan scripts, no startup tooling |
| Overall | **5.0/10** | A strong Intermediate system. 5 targeted fixes make it 7/10. |

---

## 12. RECOMMENDED IMMEDIATE ACTION PLAN

**Day 1 (2–3 hours): Make the system actually work end-to-end**
1. Set `USE_MOCK = false` (or env-based)
2. Fix port: FastAPI on 8005, all frontend calls use env var
3. Fix `getRecommendation()` call signature
4. Fix `cid` round-trip in `agentService.ts`
5. Add timeout to `ollamaService.js`

**Day 2 (3–4 hours): Stability and correctness**
6. Fix accumulating system prompts
7. Wrap FAQ service in try/catch with empty fallback
8. Add decision memory TTL (match conversation TTL: 3h)
9. Fix CORS: specify allowed origins explicitly
10. Fix DecisionPage schema mismatch or switch to correct endpoint

**Day 3 (4–6 hours): Production hardening**
11. Write `start.sh` / `start.bat` to launch all services
12. Replace `makeId()` with `crypto.randomUUID()`
13. Remove `react`, `react-dom`, `vite` from backend `package.json`
14. `.gitignore` + remove `ffmpeg.exe` from repo (use `.gitignore`)
15. Move one-off Python repair scripts out of root into `scripts/archive/`
16. Fix the component export name in `DecisionPage.tsx`

---

*Report generated from direct static analysis of source code.*  
*No runtime execution was performed during this audit.*
```