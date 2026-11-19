# Current Architecture State

## Request path

```text
React/Vite browser (5173)
  -> Nginx /api proxy
  -> Node/Express advisor API (8004)
     -> JWT and owner-scoped conversation lock
     -> normalization, safety/meta handling, follow-up rewriting
     -> intent classification and Brain Router
     -> post-router policy locks
     -> Neo4j KG / Qdrant RAG / Decision API / career / local LLM
     -> direct answer or Unified Answer/Fusion
     -> grounding, citations, formatting, persistence
  -> browser rendering and local conversation history
```

## Components

| Component | Current responsibility | Important state/risk |
|---|---|---|
| Frontend | Chat, decision UI, auth, history, citations | 20 s request deadline; chat and decision requests can race with UI state changes. |
| Node orchestrator | Authentication, route arbitration, service calls, synthesis, formatting | Large central integration surface; several bypasses and post-router locks; no shared request deadline. |
| Brain Router | Selects KG, RAG, hybrid, decision, FAQ, or LLM | Route confidence is incorrectly reused as evidence confidence in several paths. |
| Conversation memory | Owner-scoped turns and typed verified state | In-process map with debounced JSON persistence; unbounded retention and weak corrupt-file recovery. |
| Neo4j KG | Exact/deterministic facts and semantic graph retrieval | Exact aliases cover only curated entities; readiness proves connectivity, not required data. |
| RAG retriever | BGE-M3 embedding, Qdrant search, metadata reranking, acceptance gate | Configured collection/data readiness is not enforced; direct RAG can bypass final grounding. |
| RAG answer service | Optional retrieval-answer synthesis | Runtime topology and Compose disagree about whether it is required. |
| Unified Answer | Evidence fusion, synthesis, grounding, confidence, final answer | Direct-route identity and evidence shapes drift; some confidence floors exceed evidence support. |
| Local LLM | Gemma primary through Ollama; TinyLlama backup | Backend/model timeouts exceed browser deadline; request cancellation is not end-to-end. |
| Gemini | Optional backup in standard Compose | Standard Compose enables it by default; conversation context can leave the host without a frozen privacy policy. |
| Decision system | FastAPI, SQLAlchemy, SQLite recommendation engine | Ranking and displayed score weights disagree; Node/UI synthesize missing recommendation data. |
| Health/circuit/cache | Process-local probes, breakers, queues, caches | Aggregate health is not data-aware and excludes required RAG capability. |
| Appliance | Single-container supervised deployment | Existing image is healthy but relies on private build inputs and populated inherited volumes. |

## Runtime modes

`quick`, `demo`, and `full` are declared in
`backend/config/runtimeTopology.json`. The current default is `full`. Startup
authority is split among runtime JSON, environment defaults, `starter.bat`, the
PowerShell launcher, standard Compose, and appliance Compose. Documentation
describing demo mode as RAG-disabled is stale.

## Truth boundaries that must be preserved

1. A named academic fact is not verified merely because it came from a static
   fallback or exact-question registry.
2. Route-selection confidence is not evidence confidence.
3. HTTP 200 or process liveness is not academic-data readiness.
4. A relation between two known entities cannot be inferred from co-membership
   in a program.
5. The Decision UI must not manufacture a recommendation, score, fee,
   alternative, or roadmap when the API fails or omits a field.
6. Empty retrieval must persist a truthful assistant turn and must not be
   silently converted into plausible academic advice.

## Known integration defects after Phase 1

### Critical

- Static named academic fallbacks can be returned after KG/RAG failure without
  live evidence or citations.
- Decision score explanations conflict with ranking weights, and both Node and
  the frontend can fabricate missing recommendation fields.
- A clean checkout cannot build the RAG/appliance images or bootstrap required
  academic data; readiness can still appear green on empty stores.

### High

- Browser, KG, RAG, synthesis, and LLM deadlines conflict; timeout wrappers do
  not cancel underlying work.
- Direct RAG accepts evidence too permissively, can bypass final grounding, and
  loses all citations in response formatting because citation IDs are absent.
- Post-router locks can override a health-aware route.
- Fusion receives incompatible KG and RAG evidence shapes; direct route IDs can
  degrade into LLM fallback policy.
- Aggregate health excludes required RAG data readiness; Decision and KG health
  are connectivity-only.
- CI omits committed conversation, grounding, retriever, failure, and
  integration suites.
- Guest issuance and persisted conversations are unbounded; UI requests can
  append stale responses after the selected conversation/profile changes.

## Constraints for stabilization

- Do not invent institutional data.
- Do not use the untracked engineering-audit PDF as a build input.
- Do not redesign the architecture or split services.
- Keep `orchestrator.js`, Unified Answer, routing/health core, and the issue
  ledger under one integration owner to avoid semantic conflicts.
- Every fix needs a failing reproduction, focused verification, regression
  coverage, independent review, and an evidence update.

