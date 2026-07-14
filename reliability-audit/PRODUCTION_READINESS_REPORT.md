# PRODUCTION_READINESS_REPORT.md

Assessment of whether the platform is ready to be demonstrated live and reliably, based on the code as written. Verdict per dimension, with the concrete blocker.

---

## 0. Overall verdict

**Not yet demo-deterministic.** The engineering is sophisticated and clearly hardened toward determinism (LLM off by default on core paths, deterministic KG/RAG bypasses, golden registry). But **reliability is currently coupled to volatile runtime state** (health cache windows, model residency, circuit-breaker phase, golden cache freeze) and to **an operational assumption that does not hold in the default mode** (RAG stack running). With the targeted mitigations in `RECOMMENDED_FIX_ORDER.md`, it can be made demo-stable **without** architectural changes.

Readiness score by area (🟢 ready / 🟡 risky / 🔴 blocker):

| Area | State | Blocker |
|---|---|---|
| Routing determinism | 🟡 | health-gated + lastRoute bias (RC-01, RC-04) |
| Subsystem availability | 🔴 | RAG absent in demo (RC-02); embed model unmanaged (RC-03) |
| Caching correctness | 🔴 | golden cache freezes degraded answers (RC-08) |
| Timeout/degradation policy | 🟡 | silent null-degradation (RC-06); single Gemma slot (RC-09) |
| Config management | 🔴 | no committed `.env`; JS defaults point at a LAN IP (§2) |
| Observability | 🟡 | no correlation id; decision inputs not logged together (`LOGGING_GAP_ANALYSIS.md`) |
| Data readiness | 🟡 | Neo4j must be manually started + populated (§4) |
| Process resilience | 🟢 | uncaught-exception exit + supervisor restart (`orchestrator.js:103-106`) |
| Security hygiene | 🟡 | prompt sanitization present; secrets via env; see §6 |

---

## 1. Availability contract mismatch (top blocker)

The router assumes any of KG/RAG/DECISION/CAREER/FAQ may be present and gates on health, but the **demo launcher only guarantees Orchestrator + Decision + Ollama + Neo4j**. RAG is `full`-only (`start_platform.ps1:971`). Result: the router's RAG branches are dead-ends in the default mode, and policy questions degrade. Either (a) run `full` for the demo, or (b) explicitly force `health.rag=false` and route policy questions to a deterministic KG/FAQ answer so they degrade *gracefully and identically every time*.

---

## 2. Configuration management (blocker)

- **No `.env` is committed** — only `.env.example`. The orchestrator hard-requires `INTERNAL_SECRET_KEY` (`orchestrator.js:93-96`) so it will refuse to boot without *some* env source, but every other value silently falls back to JS defaults if neither the launcher nor a `.env` provides it.
- **Dangerous default:** `OLLAMA_BASE_URL` JS default is `http://192.168.1.7:11434` (`llmConfig.js:46-49`) and `neo4jcontext.js:10` defaults to `http://localhost:11434`. The launcher sets `127.0.0.1` (`start_platform.ps1:746`), so **only launcher-started runs are safe**. Any manual `node orchestrator.js` without env points LLM traffic at a stray LAN IP.
- **Config drift:** `.env.example` and the launcher disagree on several values (e.g., `PRIMARY_TIMEOUT_MS` 60000 vs 20000; `GEMMA_NUM_PREDICT_HEAVY` 320 vs JS 160). The *effective* config is whichever layer wins, which is easy to get wrong.
- **Recommendation:** commit a single authoritative `backend/.env` for the demo host (with real secret + `127.0.0.1` URLs + demo timeouts), and make the launcher fail loudly if `OLLAMA_BASE_URL` is not `127.0.0.1`/`localhost`.

---

## 3. Model readiness (blocker for KG)

- Launcher prewarms **only** `gemma4:e2b` (`start_platform.ps1:623-662`) and checks only that model (`Test-OllamaModel`, `:600`).
- KG semantic retrieval needs **`nomic-embed-text`** (`neo4jcontext.js:34`). It is neither verified nor warmed. If missing/cold, KG questions fail or stall (RC-03).
- **Recommendation:** add `ollama pull nomic-embed-text` to setup and a prewarm embedding probe in the launcher (mirroring `Invoke-OllamaPrewarm`), and add it to `Test-OllamaModel`.

---

## 4. Data readiness

- Neo4j is only **port-checked**, not started or validated for content (`start_platform.ps1:968`). An empty or partially-loaded graph makes KG queries return `NO_RESULT` deterministically-empty (RC-03/LG-05). Confirm the graph is loaded (`data/clean_graph.json` ingested) before the demo.
- Qdrant collection must be ingested (`phase2_qdrant_ingestion.py`) for `full` mode RAG to return anything.
- `data/conversations.json` persists across restarts; a polluted `lastRoute`/memory from testing can bias the *first* demo turn. **Recommendation:** start the demo from a clean conversation id (or clear the file) — see `DEMO_RISK_ASSESSMENT.md`.

---

## 5. Timeout & concurrency posture

- Demo timeouts are tight (synthesis/RAG 20 s; decision health 800 ms–1.2 s). Combined with the **single Gemma slot** (`GEMMA_MAX_ACTIVE_REQUESTS=1`) and no cancellation on timeout, concurrent asks degrade (RC-06/RC-09).
- KG path lacks an orchestrator-level timeout (`REQUEST_EXECUTION_FLOW.md#2.1`), so a slow embed can stall a KG request beyond the frontend's patience.
- **Recommendation:** keep the demo single-user, warm the models, and add a KG route timeout with a deterministic fallback.

---

## 6. Security / integrity (not the demo blocker, but noted)

- Prompt-injection sanitization exists (`orchestrator.js:316-330`) and jailbreak intent is classified to `REJECT` (`:348`). Good.
- Secrets are env-based; `INTERNAL_SECRET_KEY` is required. Ensure it is not committed and that the frontend/`httpClient.ts` supplies it correctly (the frontend added `httpClient.ts` and `config/` per git status — verify base URLs there match the launcher ports).
- `uncaughtException` exits the process (`orchestrator.js:103`) — good with a supervisor; but the launcher's `Start-ManagedCommand` does not auto-restart on crash, so an uncaught exception mid-demo takes the backend down until manually restarted. **Recommendation:** wrap `npm run start:orchestrator` in a restart-on-exit supervisor for the demo.

---

## 7. What is genuinely solid

- Layered deterministic fallbacks so the system rarely 500s to the user (fatal fallback returns a friendly 200, `orchestrator.js:3245-3321`).
- Golden registry gives curated, LLM-free answers for showcase queries (when not cache-poisoned).
- Extensive routing audit trail already written to `logs/routing-audit.jsonl`.
- Memory-pressure guards prevent OOM crashes under load (they trade quality for stability, which is the right call for a demo).

**Bottom line:** the system is well-built but its *stability is conditional*. Make the conditions guaranteed (RAG present or cleanly disabled, embed model warm, health sticky, golden cache not freezing degraded answers, clean conversation) and it becomes demo-deterministic.
