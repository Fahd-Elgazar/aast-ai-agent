# Benchmark Audit

## Verdict

**FAIL for publication-level benchmark claims. PARTIAL for internal debugging.**

The benchmark files are real and useful, but current reports do not support final defense metrics.

## Inventory

| File | Evidence |
|---|---|
| `backend/testing/benchmarkQueries.json` | 35 current route benchmark queries. |
| `backend/testing/expectedRoutes.json` | 35 expected route entries. |
| `backend/testing/route_accuracy_report.json` | Route accuracy report. |
| `backend/testing/retrieval_report.json` | KG/RAG/Hybrid retrieval report. |
| `backend/testing/golden_path_benchmark_report.json` | Golden-path demo report. |

## Current Scores Found

| Metric | Value |
|---|---:|
| Route accuracy percent | 37.14 |
| Misroute percent | 62.86 |
| Fallback frequency | 40.00 |
| Confidence realism | 34.29% |
| KG precision | 0.00 |
| KG empty hit | 57.14 |
| RAG recall | 0.00 |
| RAG citation precision | 0.00 |
| Hybrid full success | 0.00 |
| Hybrid total failure | 100.00 |
| Golden path passed | 10 |
| Golden path failed | 1 |

## Auditor Scores

| Dimension | Score / 100 | Rationale |
|---|---:|---|
| Current benchmark score quality | 32 | Reports exist, but current route and retrieval scores are weak. |
| Coverage score | 41 | Routes are represented, but coverage is too small and lacks adversarial/no-answer depth. |
| Difficulty score | 38 | The current primary benchmark is closer to a smoke test than a defense benchmark. |
| Defense readiness score | 25 | Current metrics cannot support final performance claims. |

## Findings

1. Route accuracy is too low for final defense claims. Evidence: `backend/testing/route_accuracy_report.json`.
2. Retrieval metrics are not defense safe. Evidence: `backend/testing/retrieval_report.json`.
3. Route/source label mismatch is a real risk because runtime routes include `KG_DIRECT` and `RAG_DIRECT`. Evidence: `backend/services/brainRouter.js:37-47`, `backend/services/responseFormatter.js:30-96`.
4. Golden path still has a failure. Evidence: `backend/testing/golden_path_benchmark_report.json`.
5. NO EVIDENCE FOUND for a full benchmark covering prompt injection, stale policy detection, malformed inputs, multilingual queries, typos, contradiction handling, concurrent load, and endpoint outages.

## Coverage Risks

| Risk | Verdict |
|---|---|
| Duplicate/trivial question risk | PRESENT |
| Invalid expected-route risk | PRESENT |
| Benchmark bias from protected golden paths | PRESENT |
| Missing no-answer/adversarial scenarios | HIGH |
| Data leakage through fallback payloads | PARTIAL |

## Expanded Benchmark Added

`PPT/BENCHMARK_EXPANDED_DEFENSE.json` contains 175 proposed questions: 50 KG, 50 RAG, 50 Hybrid, and 25 Decision/Career. It is a test plan, not a passing report.

## Required Fixes

1. Align expected routes with runtime routes.
2. Align validator source labels with `responseFormatter.js`.
3. Verify live Neo4j graph indexes.
4. Verify live RAG retriever index.
5. Fix the golden-path failure.
6. Rerun route, retrieval, and golden benchmarks.

## Final Benchmark Verdict

Current benchmark sufficient for internal debugging: YES.

Current benchmark sufficient for publication-level or final thesis-defense claims: NO.
