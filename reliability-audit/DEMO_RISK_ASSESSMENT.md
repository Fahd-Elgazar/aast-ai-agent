# DEMO_RISK_ASSESSMENT.md

Purpose: what can go wrong **in front of professors and guests**, ranked by demo impact, with a pre-flight checklist and a "if it breaks live" runbook. Reliability is the priority; nothing here requires code changes (a companion code-fix plan is in `RECOMMENDED_FIX_ORDER.md`).

---

## 1. Top demo risks (impact × likelihood)

| # | Scenario | Trigger | Likely on stage? | Mitigation (operational) |
|---|---|---|---|---|
| D1 | A showcase golden query answers *degraded* and keeps doing so for 10 min | First ask hit a cold embed model / health flap; result frozen by golden cache (RC-08) | **High** if you don't warm first | Warm every golden query **before** the audience arrives; restart backend to clear cache if a bad answer got frozen |
| D2 | Policy question ("min GPA?", "scholarship rules?") returns "I couldn't find…" | RAG stack not running in demo mode (RC-02) | **High** if launched `demo` | Launch **`full`** mode and confirm 8001/8002/6333 healthy, OR pre-script only KG/decision questions |
| D3 | First KG question after a pause stalls or returns empty | embed/Gemma unloaded after 15 min idle → cold start (RC-03, RC-10) | **High** during long talks | Keep traffic warm (warm pool + a background ping every ~5 min); don't idle >10 min |
| D4 | Same question routes differently than in rehearsal | health cache flapped / >60 s since last request reset health (RC-01) | **Medium-High** | Send a warm-up query right before each demo segment; keep questions flowing |
| D5 | Second simultaneous tester's query times out | single Gemma slot serializes synthesis (RC-09) | **Medium** if audience tries it | Keep it single-user during the scripted portion; invite audience only for deterministic KG/golden questions |
| D6 | Backend disappears mid-demo | uncaught exception exits process, no auto-restart (RC-15 / readiness §6) | **Low-Medium** | Run backend under a restart supervisor; keep a warm second terminal ready |
| D7 | Wording of an answer changes between asks | synthesis temperature / humanizer (RC-12, RC-13) | **Medium** | Prefer deterministic KG/golden questions for the "look how consistent it is" moment; keep `GEMINI_HUMANIZER_ENABLED=false` |
| D8 | Everything points at a dead LAN IP | started without launcher/.env → `192.168.1.7` default (readiness §2) | **Low** if launcher used | Always start via `start_platform.ps1`; verify Ollama URL is `127.0.0.1` |

---

## 2. Which questions are SAFE vs RISKY for a live demo

**Safest (LLM-free, deterministic once warm):**
- Golden KG queries in `goldenPathRegistry.js` (dean, "who teaches X", prerequisites, head of quality unit) — *provided they are pre-warmed so the golden cache holds a good answer*.
- Greetings, FAQ hits, "what did I ask earlier" (meta) — fully deterministic, no retrieval.
- Ontology KG (facilities, tracks, partner institutions, governance, campus, curriculum weeks) — deterministic Cypher, **no embedding** for aggregation/curriculum queries.

**Medium risk:**
- General KG questions that use the **embedding** vector path (open-ended "what modules…") — depend on `nomic-embed-text` residency.
- Decision/comparison questions — depend on the Decision API (8005) being healthy within 800 ms–1.2 s health probe.

**Highest risk (avoid unless `full` mode is verified healthy):**
- Policy/regulation questions (GPA, probation, scholarship, admission, transfer) — need the RAG stack, which is **off in demo mode**.
- Anything that reliably routes to HYBRID synthesis — most exposed to temperature, memory pressure, and partial-failure degradation.

---

## 3. Pre-flight checklist (run 15 min before the demo)

1. **Mode:** launch with `.\launcher\start_platform.ps1 -Mode full` (so RAG exists) unless the script is entirely KG/decision.
2. **Env sanity:** confirm `OLLAMA_BASE_URL` resolves to `127.0.0.1:11434`; confirm `INTERNAL_SECRET_KEY` set; confirm `GEMINI_HUMANIZER_ENABLED=false`.
3. **Models present & warm:**
   - `ollama list` shows `gemma4:e2b` **and** `nomic-embed-text`.
   - `ollama pull nomic-embed-text` if missing, then run one embedding warm call.
   - Confirm launcher "LLM prewarm" = READY.
4. **Data:** Neo4j up on 7687 and populated; (full mode) Qdrant collection ingested; RAG `/health` = healthy on 8001/8002.
5. **Clean state:** start a **fresh conversation id** (or clear `backend/data/conversations.json`) so no stale `lastRoute`/memory biases the first turn (RC-04); this also clears the golden cache (it's in-memory, so a backend restart clears it).
6. **Warm the script:** run every planned question once, verify each returns the intended route/answer, and confirm the golden ones show `cache_hit` on the second ask (good answer frozen).
7. **Health steady-state:** send a query every ~30–45 s during setup so the health cache never hits the 60 s reset (RC-01).
8. **Watch the audit log:** `Get-Content logs\routing-audit.jsonl -Wait` to see `final_route`, `degraded_services` live.

---

## 4. If it breaks live (runbook)

- **A golden query returns a degraded/short answer:** it's cache-frozen. Ask a different question, then **restart the backend** (`npm run start:orchestrator`) to clear the in-memory golden cache, re-warm, resume. (Do this during a natural pause.)
- **"I couldn't find verified policy evidence":** RAG is down/absent. Pivot to a KG or decision question; don't retry the policy question.
- **Long stall on a KG question:** embed model cold. Wait it out once (it warms), or pivot to an ontology/golden KG question that doesn't embed.
- **Answer wording changed:** harmless (temperature). Say "the model phrases it naturally each time; the facts are graph-verified" — and lean on deterministic golden questions for the consistency claim.
- **Backend unresponsive:** it may have exited on an uncaught exception. Restart it; the frontend reconnects.

---

## 5. Residual risk after operational mitigations only

Even with a perfect pre-flight, **RC-01 (health flap after >60 s idle) and RC-08 (golden cache freeze) can still surface** because they are code behaviors, not operator errors. To make the demo *robust to human pacing* (long professor questions, tangents), the code-level fixes in `RECOMMENDED_FIX_ORDER.md` (sticky last-known-good health, and not caching degraded golden payloads) are strongly recommended before a high-stakes session.
