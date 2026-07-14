# RECOMMENDED_FIX_ORDER.md

Prioritized remediation plan. **These are proposals only — no code was changed as part of this audit.** Each item lists Priority, Difficulty, Estimated time, Risk, and whether it is *Safe to apply before the live demo*. Ordering optimizes for **maximum determinism gain per unit risk**.

Legend — Difficulty: T(rivial)/S(mall)/M(edium)/L(arge). "Safe pre-demo": ✅ low-regression / ⚠ test first / ❌ do after demo.

---

## Tier 0 — Do first: operational, zero-code (removes most intermittency today)

### F0.1 — Launch in `full` mode (or explicitly disable RAG routing) so RAG isn't a silent dead-end
Addresses **RC-02**. Priority P0 · Difficulty T · Time 5 min · Risk none · Safe ✅.
Run `-Mode full`, verify 8001/8002/6333 healthy. If you must run `demo`, restrict the script to KG/decision/golden questions.

### F0.2 — Pull + warm `nomic-embed-text`; keep models warm
Addresses **RC-03, RC-10**. P0 · T · 10 min · Risk none · Safe ✅.
`ollama pull nomic-embed-text`, run one embedding call, and send a query every ~5 min so `keep_alive` never unloads.

### F0.3 — Start from a clean conversation + fresh backend (clears in-memory caches)
Addresses **RC-04, RC-08**. P0 · T · 2 min · Risk none · Safe ✅.
New `cid` (or clear `backend/data/conversations.json`), restart backend before the session, then pre-warm every scripted question so golden answers freeze in a *good* state.

### F0.4 — Keep the health cache warm; keep it single-user during scripted parts
Addresses **RC-01, RC-09**. P0 · T · during demo · Risk none · Safe ✅.
Query every 30–45 s to avoid the 60 s health reset; don't let two people synthesize at once.

> Tier 0 alone converts most "sometimes nothing" into "consistently good" for a rehearsed demo. Tiers 1–2 make it robust to human pacing and safe for audience interaction.

---

## Tier 1 — Small, high-value code fixes (recommended before a high-stakes demo)

### F1.1 — Do **not** cache degraded/static golden fallbacks
Addresses **RC-08** (highest "sticky bad answer" risk). Priority P0 · Difficulty S · Time ~1–2 h · Risk low · Safe ⚠ (test golden queries after).
Guard every `setGoldenCachedPayload(goldenMatch, goldenFallback)` at `orchestrator.js:2335, 2509, 2677, 2873` (and the fatal path) so only **verified, non-degraded** payloads are cached. Simplest: add `if (!payload.degraded && !payload.explainability?.golden_cache_hit && responseTier.startsWith("DETERMINISTIC")) setGoldenCachedPayload(...)`. Prevents a bad first ask from freezing for 10 min.

### F1.2 — Make health "sticky last-known-good" and remove the 60 s all-false reset
Addresses **RC-01** (highest overall). P0 · S · ~2–3 h · Risk medium · Safe ⚠.
In `healthProbes.js:90-94`, do **not** reset all subsystems to `false` on staleness; instead keep the last known value and only downgrade a subsystem after **N consecutive** failed probes (hysteresis). Also serve last-known-good while a refresh is in flight rather than blocking. This removes the "first question after a pause misroutes" failure. Test: confirm a genuinely-down subsystem still eventually reads `false`.

### F1.3 — Verify + prewarm the embed model in the launcher
Addresses **RC-03**. P0 · S · ~1 h · Risk low · Safe ✅.
In `start_platform.ps1`: add `nomic-embed-text` to `Test-OllamaModel`, and add an `Invoke-OllamaEmbedWarmup` mirroring `Invoke-OllamaPrewarm` (`:623`) that POSTs to `/api/embeddings`. Fails loudly if the embed model is missing.

### F1.4 — Add a KG-route timeout with deterministic fallback
Addresses **RC-03, RC-06** (KG stalls). P1 · S · ~1 h · Risk low · Safe ⚠.
Wrap `runNeo4jRetrieval` in the KG branch (`orchestrator.js:2173`) in `timeoutWrapper(..., kgTimeoutMs, null)` like the RAG branch, so a slow embed degrades cleanly instead of stalling. `kgTimeoutMs` is already computed at `:1971` but unused on this path.

### F1.5 — Fail-fast / fix the dangerous Ollama URL default
Addresses **readiness §2**. P1 · T · ~30 min · Risk low · Safe ✅.
Change the JS default `http://192.168.1.7:11434` (`llmConfig.js:48`) to `http://127.0.0.1:11434`, and have the launcher assert `OLLAMA_BASE_URL` is loopback. Prevents a misconfigured run from silently targeting a stray host.

### F1.6 — Commit an authoritative demo `.env`
Addresses **config drift**. P1 · T · ~30 min · Risk low · Safe ✅.
Provide `backend/.env` (real secret, `127.0.0.1` URLs, demo timeouts, humanizer off, single-gen on) so behavior no longer depends on which config layer wins.

---

## Tier 2 — Observability (do before or alongside Tier 1; makes everything else diagnosable)

### F2.1 — Add a per-request correlation id propagated to all services
Addresses **RC-15, diagnosis**. P1 · M · ~3–4 h · Risk low · Safe ✅.
Replace `requestId = Date.now()` (`orchestrator.js:592`) with `crypto.randomUUID()`; pass it to RAG/Decision/Ollama and log it everywhere.

### F2.2 — Add the decision-point + health-snapshot logs (LG-01, LG-02, LG-06, LG-09)
Addresses **all RCs (attribution)**. P1 · S · ~2–3 h · Risk none · Safe ✅.
Implement the log lines specified in `LOGGING_GAP_ANALYSIS.md`. Zero behavior change; turns future incidents into a single grep.

---

## Tier 3 — Structural hardening (after the demo)

### F3.1 — Unify RAG availability signal with its circuit breaker
Addresses **RC-07**. P2 · M · ~3 h · Risk medium · Safe ❌.
Make `health.rag` reflect the breaker state (or have the router consult the breaker), so the router never sends work to an open-breaker RAG.

### F3.2 — Reduce/￮ratchet-down the `lastRoute` bias, or scope it to true follow-ups
Addresses **RC-04**. P2 · S · ~2 h · Risk medium · Safe ❌.
Set `ROUTE_HISTORY_BOOST=0` for the demo, or only apply it when a follow-up reference was actually resolved (`followUpResolution.resolved`). Test routing regression suite (`testing/routeBenchmark.js`).

### F3.3 — Increase Gemma concurrency or pre-serialize intent/synthesis
Addresses **RC-09**. P2 · M · ~3 h · Risk medium (memory) · Safe ❌.
Raise `GEMMA_MAX_ACTIVE_REQUESTS` to 2 only if host RAM allows (watch `GEMMA_MEMORY_*`), or keep 1 and document single-user demo.

### F3.4 — Make synthesis deterministic for demo (temperature 0) on factual routes
Addresses **RC-12, RC-11**. P2 · S · ~2 h · Risk low-medium · Safe ⚠.
For KG/RAG/GENERAL synthesis, set temperature 0 and `top_p` low in `unifiedAnswerService.js:198-205` (behind a `DEMO_DETERMINISTIC=true` flag) so wording stops drifting. Validate answers still read naturally.

### F3.5 — Guard against same-cid concurrent mutation
Addresses **RC-15**. P3 · M · ~4 h · Risk medium · Safe ❌.
Per-cid async mutex around the read-modify-write of `convo` in the handler, or operate on a clone and merge.

### F3.6 — Auto-restart supervisor for the backend
Addresses **readiness §6**. P3 · S · ~1 h · Risk low · Safe ✅.
Wrap `npm run start:orchestrator` in a supervisor (pm2/nssm/loop) so an uncaught exception self-heals.

---

## Recommended execution order for a demo next week

1. **Today:** Tier 0 (F0.1–F0.4) — operational, no code, removes the bulk of intermittency.
2. **This week, low-risk code:** F1.1 (golden cache), F1.3 (embed prewarm), F1.5 (URL default), F1.6 (.env), F2.1–F2.2 (observability). All ✅/⚠, high value.
3. **If time + testing available:** F1.2 (sticky health) and F1.4 (KG timeout) — the two that make the demo robust to pacing.
4. **After the demo:** Tier 3 structural items.

**Do-not-touch-before-demo (❌):** RAG/health-breaker unification, lastRoute bias removal, concurrency increase, cid mutex — all carry routing-regression risk and need the benchmark suite (`testing/routeBenchmark.js`, `testing/goldenPathBenchmark.js`) run first.

---

## Verification hooks already in the repo

Use these to validate any fix without guessing:
- `testing/goldenPathBenchmark.js`, `testing/routeBenchmark.js`, `testing/routingPrecisionCalibration.test.js` — route determinism.
- `testing/latencyBenchmark.js`, `testing/prewarmGoldenQueries.js` — warm-state latency.
- `logs/routing-audit.jsonl` — per-request route + degradation, already emitted.
- `GET /health` / `/api/health` — subsystem + cache status (`routes/health.js`).
