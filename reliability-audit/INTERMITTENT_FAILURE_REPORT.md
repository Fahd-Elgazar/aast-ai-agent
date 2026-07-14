# INTERMITTENT_FAILURE_REPORT.md

Consolidated ranking of every identified cause of non-deterministic behavior, sorted by probability within severity band. IDs cross-reference `ROOT_CAUSE_ANALYSIS.md`.

---

## 1. Ranked table (all issues)

| Rank | ID | Title | Severity | Prob. | Symptom(s) produced | Config-gated? |
|---|---|---|---|---|---|---|
| 1 | RC-01 | Health-cache flapping → route changes | CRITICAL | 90% | misroute, ignores data, "I don't know" | always |
| 2 | RC-02 | RAG stack absent in demo mode | CRITICAL | 85% | ignores data, "I don't know", inconsistent vs full mode | demo mode |
| 3 | RC-03 | KG depends on unmanaged `nomic-embed-text` | CRITICAL | 70% | returns nothing, timeout, fatal fallback | always (KG semantic) |
| 4 | RC-06 | `timeoutWrapper` → silent degradation | HIGH | 70% | timeout, degraded answer | always |
| 5 | RC-04 | `lastRoute` biases routing | HIGH | 65% | misroute across turns | always |
| 6 | RC-08 | Golden cache freezes first (degraded) outcome | HIGH | 60% | "sticks" perfect-or-bad for 10 min | cacheable golden |
| 7 | RC-05 | Override-gate order dependence | HIGH | 55% | misroute on edge phrasing | always |
| 8 | RC-07 | RAG breaker decoupled from health probe | HIGH | 55% | "worked a second ago" degradation | full mode |
| 9 | RC-09 | Single-slot Gemma queue overflow/timeout | MED-HIGH | 55% | timeout under concurrency | always (synthesis) |
| 10 | RC-10 | keep-alive unload → cold-start stall | MEDIUM | 50% | timeout after pauses | always |
| 11 | RC-11 | Memory-pressure adaptive sampling/truncation | MEDIUM | 45% | different length/wording, truncated facts | synthesis |
| 12 | RC-12 | Non-zero synthesis temperature | MEDIUM | 40% | wording varies | synthesis routes |
| 13 | RC-13 | Gemini humanizer rewrites everything | MEDIUM | 35% | wording varies even on deterministic answers | humanizer on |
| 14 | RC-14 | Normalization/golden classification sensitivity | LOW-MED | 30% | branch toggles on typos/spacing | always |
| 15 | RC-15 | Shared convo object + requestId collisions | LOW | 20% | cross-talk under same-cid concurrency; log confusion | concurrency |

---

## 2. Severity bands (Phase 7 grouping)

**CRITICAL** (can produce empty/wrong answers on core demo questions): RC-01, RC-02, RC-03.
**HIGH** (frequent degradation / sticky bad outcomes / misroutes): RC-04, RC-05, RC-06, RC-07, RC-08.
**MEDIUM** (quality/latency variance, concurrency-triggered): RC-09, RC-10, RC-11, RC-12, RC-13.
**LOW** (edge/observability): RC-14, RC-15.

---

## 3. Symptom → most-likely cause matrix

| Observed symptom | Primary causes | Secondary |
|---|---|---|
| Returns nothing / empty | RC-03, RC-02 | RC-01, RC-06 |
| Returns "I don't know" / insufficient data | RC-01 (routes to LLM_FALLBACK/low-conf), RC-02 | RC-08 (cached bad), RC-06 |
| Routes incorrectly | RC-01, RC-04, RC-05 | RC-14 |
| Times out | RC-09, RC-06, RC-10 | RC-03 (embed cold) |
| Ignores available data | RC-02 (RAG down), RC-01 (health says down), RC-07 | RC-11 (truncation) |
| Behaves differently (wording/quality) | RC-12, RC-11 | RC-13, RC-08 |
| Perfect once, degraded later (or vice-versa) and "stuck" | RC-08 | RC-01, RC-07 |

---

## 4. Determinism state machine (why "same input" isn't the same)

For a fixed byte-identical query, the response is determined by this hidden state vector at request time:

```
S = ( normalized_query,               # RC-14
      convo.lastRoute,                 # RC-04  (per-cid, persisted)
      convo.lastCurriculumCourse,      # curriculum carryover
      conversationMemory.*,            # follow-up resolution
      cachedHealth snapshot,           # RC-01  (15s window, 60s reset)
      ragBreaker.state,                # RC-07  (full mode)
      ollamaBreaker.state / failover,  # backup model swap
      gemma memory-pressure level,     # RC-11
      gemma queue occupancy,           # RC-09
      model residency (warm/cold),     # RC-03/RC-10
      goldenResponseCache[key],        # RC-08  (10-min freeze)
      launcher mode (demo/full),       # RC-02
      humanizerEnabled )               # RC-13
```

Only the first element is under the user's control. Everything else is time-, load-, or history-dependent. **Determinism requires collapsing this vector**, which the fix plan (`RECOMMENDED_FIX_ORDER.md`) does by: pinning health to sticky/last-known-good, guaranteeing subsystem presence, warming the embed model, and neutralizing the golden cache / lastRoute biases for the demo.

---

## 5. Confidence & uncertainty statement

- RC-01, RC-02, RC-03, RC-08, RC-09 are **code-confirmed mechanisms** (the logic is present and reachable). Their *probability* reflects how often they actually fire during a demo, which depends on operational conditions we could not observe live.
- RC-07 depends on `full` mode being used. RC-13 depends on the humanizer flag. These are explicitly gated.
- No hidden `Math.random()` or unseeded RNG was found in the request path (searched). LLM temperature (RC-12) is the only intrinsic randomness, and it is small. **The dominant intermittency is architectural/stateful, not model randomness** — which is good news: it is fixable without touching model behavior.
