# Benchmark Execution Report

Generated: 2026-06-25T23:19:12.5522784+03:00
Workspace: C:\AI_AGENT
Benchmark package: C:\AI_AGENT\aast-ai-agent-main\backend\testing
Target API: http://127.0.0.1:8004/api/chatbot/query

## Executed Suites

| Suite | Command | Exit | Duration ms | Log |
|---|---|---:|---:|---|
| route | `node testing/routeBenchmark.js` | 0 | 106697 | `C:\AI_AGENT\runtime_validation_tmp\remote_ollama_benchmarks\route.log` |
| retrieval | `node testing/retrievalBenchmark.js` | 0 | 24935 | `C:\AI_AGENT\runtime_validation_tmp\remote_ollama_benchmarks\retrieval.log` |
| latency | `node testing/latencyBenchmark.js` | 0 | 9142 | `C:\AI_AGENT\runtime_validation_tmp\remote_ollama_benchmarks\latency.log` |
| golden_path | `node testing/goldenPathBenchmark.js --repeats=1` | 1 | 21328 | `C:\AI_AGENT\runtime_validation_tmp\remote_ollama_benchmarks\golden_path.log` |
| summary | `node testing/generateBenchmarkSummary.js` | 1 | 180 | `C:\AI_AGENT\runtime_validation_tmp\remote_ollama_benchmarks\summary.log` |
| hallucination | `node testing/hallucinationTest.js` | 0 | 48767 | `C:\AI_AGENT\runtime_validation_tmp\remote_ollama_benchmarks\hallucination.log` |
| failure_simulation | `node testing/failureSimulation.js` | 0 | 4972 | `C:\AI_AGENT\runtime_validation_tmp\remote_ollama_benchmarks\failure_simulation.log` |
| frontend_contract | `node testing/frontendContractTest.js` | 0 | 11509 | `C:\AI_AGENT\runtime_validation_tmp\remote_ollama_benchmarks\frontend_contract.log` |
| summary_after_extra_suites | `node testing/generateBenchmarkSummary.js` | 1 | 517 | `C:\AI_AGENT\runtime_validation_tmp\remote_ollama_benchmarks\summary_after_extra_suites.log` |

## Metrics

| Area | Metric | Value |
|---|---|---:|
| Routing | total queries | 35 |
| Routing | route accuracy percent | 48.57 |
| Routing | misroute percent | 51.43 |
| Routing | hybrid precision percent | 40.00 |
| Routing | average latency ms | 3041 |
| Routing | worst latency ms | 15375 |
| Retrieval | KG precision percent | 0.00 |
| Retrieval | RAG recall percent | 14.29 |
| Retrieval | hybrid full success percent | 0.00 |
| Retrieval | benchmark integrity score | 5.14 |
| Retrieval | network failures | 0 |
| Retrieval | orchestrator failures | 0 |
| Latency | network failures | 0 |
| Latency | timeout failures | 0 |
| Latency HYBRID | avg/p95/max ms | 682/737/737 |
| Latency DECISION | avg/p95/max ms | 85/85/85 |
| Latency CAREER | avg/p95/max ms | 8/8/8 |
| Latency LLM | avg/p95/max ms | 225/686/694 |
| Latency INTERACTIVE | avg/p95/max ms | 9/9/9 |
| Golden path E2E | passed queries | 10/11 |
| Golden path E2E | failed queries | 1 |
| Hallucination/security | hallucination rate percent | 36.11 |
| Hallucination/security | prompt injection success rate | 0.00% |
| Hallucination/security | safe refusal rate | 63.89% |
| Failure simulation | graceful degradation rate | 100.00% |
| Failure simulation | catastrophic failure rate | 0.00% |
| Frontend contract | contract success rate | 22.86% |
| Frontend contract | frontend break risk | 0.00% |

## Failed Cases Collected

- Route misroutes: 18 cases in `route_accuracy_report.json`.
- Retrieval failures: 18 cases in `retrieval_report.json`.
- Golden path failures: 1 case(s) in `golden_path_benchmark_report.json`.
- Hallucination/security failures: 13 cases in `hallucination_report.json`.
- Frontend contract failures: 27 cases in `frontend_contract_report.json`.
- Failure simulation catastrophic failures: 0.00%.

### Golden Path Failed Case

```json
{
    "id":  "golden_hany_profile",
    "category":  "faculty_profile",
    "query":  "Who is Hany Hanafy?",
    "expected_route":  "KG_DIRECT",
    "total_runs":  1,
    "pass":  false,
    "no_crash_rate":  "100.00%",
    "route_stability_rate":  "0.00%",
    "route_counts":  {
                         "LLM_FALLBACK":  1
                     },
    "avg_latency_ms":  16085,
    "p50_latency_ms":  16085,
    "p95_latency_ms":  16085,
    "max_latency_ms":  16085,
    "preferred_latency_pass_rate":  "0.00%",
    "graph_payload_stable":  true,
    "graph_fingerprint_count":  1,
    "failures":  [
                     {
                         "status":  200,
                         "ok":  true,
                         "latency_ms":  16085,
                         "route":  "LLM",
                         "confidence":  0.69,
                         "answer_chars":  157,
                         "graph_nodes":  0,
                         "graph_links":  0,
                         "graph_fingerprint":  "{\"nodes\":[],\"links\":[]}",
                         "response_tier":  "DEGRADED_SUCCESS",
                         "degraded_services":  [
                                                   "KG_EMPTY"
                                               ],
                         "fallback_triggers":  [
                                                   "KG_EMPTY_RAG_ESCALATION"
                                               ]
                     }
                 ],
    "slow_runs":  [
                      {
                          "status":  200,
                          "ok":  true,
                          "latency_ms":  16085,
                          "route":  "LLM",
                          "confidence":  0.69,
                          "answer_chars":  157,
                          "graph_nodes":  0,
                          "graph_links":  0,
                          "graph_fingerprint":  "{\"nodes\":[],\"links\":[]}",
                          "response_tier":  "DEGRADED_SUCCESS",
                          "degraded_services":  [
                                                    "KG_EMPTY"
                                                ],
                          "fallback_triggers":  [
                                                    "KG_EMPTY_RAG_ESCALATION"
                                                ]
                      }
                  ]
}
```

### Route Misroute Examples

```json
[
    {
        "query_id":  "Q_KG_05",
        "expected":  "KG_ONLY",
        "predicted":  "LLM_FALLBACK",
        "confidence":  0.69
    },
    {
        "query_id":  "Q_RAG_01",
        "expected":  "RAG_ONLY",
        "predicted":  "KG_ONLY",
        "confidence":  0.98
    },
    {
        "query_id":  "Q_RAG_02",
        "expected":  "RAG_ONLY",
        "predicted":  "HYBRID_KG_RAG",
        "confidence":  0.89
    },
    {
        "query_id":  "Q_RAG_03",
        "expected":  "RAG_ONLY",
        "predicted":  "KG_ONLY",
        "confidence":  0.98
    },
    {
        "query_id":  "Q_RAG_04",
        "expected":  "RAG_ONLY",
        "predicted":  "LLM_FALLBACK",
        "confidence":  0.69
    },
    {
        "query_id":  "Q_RAG_05",
        "expected":  "RAG_ONLY",
        "predicted":  "KG_ONLY",
        "confidence":  0.98
    },
    {
        "query_id":  "Q_RAG_07",
        "expected":  "RAG_ONLY",
        "predicted":  "KG_ONLY",
        "confidence":  0.98
    },
    {
        "query_id":  "Q_HYB_02",
        "expected":  "HYBRID_KG_RAG",
        "predicted":  "KG_ONLY",
        "confidence":  0.98
    },
    {
        "query_id":  "Q_HYB_04",
        "expected":  "HYBRID_KG_RAG",
        "predicted":  "KG_ONLY",
        "confidence":  0.98
    },
    {
        "query_id":  "Q_HYB_05",
        "expected":  "HYBRID_KG_RAG",
        "predicted":  "LLM_FALLBACK",
        "confidence":  0.509
    },
    {
        "query_id":  "Q_DEC_02",
        "expected":  "DECISION_ENGINE",
        "predicted":  "HYBRID_KG_RAG",
        "confidence":  0.89
    },
    {
        "query_id":  "Q_DEC_03",
        "expected":  "DECISION_ENGINE",
        "predicted":  "KG_ONLY",
        "confidence":  0.98
    },
    {
        "query_id":  "Q_CAR_02",
        "expected":  "CAREER_ENGINE",
        "predicted":  "KG_ONLY",
        "confidence":  0.98
    },
    {
        "query_id":  "Q_CAR_04",
        "expected":  "CAREER_ENGINE",
        "predicted":  "LLM_FALLBACK",
        "confidence":  0.375
    },
    {
        "query_id":  "Q_FAQ_01",
        "expected":  "FAQ",
        "predicted":  "LLM_FALLBACK",
        "confidence":  0.69
    },
    {
        "query_id":  "Q_FAQ_02",
        "expected":  "FAQ",
        "predicted":  "RAG_ONLY",
        "confidence":  0.96
    },
    {
        "query_id":  "Q_FAQ_03",
        "expected":  "FAQ",
        "predicted":  "RAG_ONLY",
        "confidence":  0.96
    },
    {
        "query_id":  "Q_FAQ_04",
        "expected":  "FAQ",
        "predicted":  "LLM_FALLBACK",
        "confidence":  0.375
    }
]
```

### Retrieval Failure Examples

```json
[
    {
        "query_id":  "Q_KG_01",
        "expected":  "KG",
        "got":  [
                    "KG_DIRECT"
                ],
        "issue":  "Missing KG source"
    },
    {
        "query_id":  "Q_KG_02",
        "expected":  "KG",
        "got":  [
                    "KG_DIRECT"
                ],
        "issue":  "Missing KG source"
    },
    {
        "query_id":  "Q_KG_03",
        "expected":  "KG",
        "got":  [
                    "KG_DIRECT"
                ],
        "issue":  "Missing KG source"
    },
    {
        "query_id":  "Q_KG_04",
        "expected":  "KG",
        "got":  [
                    "KG_DIRECT"
                ],
        "issue":  "Missing KG source"
    },
    {
        "query_id":  "Q_KG_05",
        "expected":  "KG",
        "got":  [
                    "KG_DIRECT"
                ],
        "issue":  "Missing KG source"
    },
    {
        "query_id":  "Q_KG_06",
        "expected":  "KG",
        "got":  [
                    "KG_DIRECT"
                ],
        "issue":  "Missing KG source"
    },
    {
        "query_id":  "Q_KG_07",
        "expected":  "KG",
        "got":  [
                    "KG_DIRECT"
                ],
        "issue":  "Missing KG source"
    },
    {
        "query_id":  "Q_RAG_01",
        "expected":  "RAG",
        "got":  [
                    "KG_DIRECT"
                ],
        "issue":  "Missing RAG source"
    },
    {
        "query_id":  "Q_RAG_02",
        "expected":  "RAG",
        "got":  [
                    "KG_DIRECT",
                    "RAG_DIRECT"
                ],
        "issue":  "Missing RAG source"
    },
    {
        "query_id":  "Q_RAG_03",
        "expected":  "RAG",
        "got":  [
                    "KG_DIRECT"
                ],
        "issue":  "Missing RAG source"
    },
    {
        "query_id":  "Q_RAG_04",
        "expected":  "RAG",
        "got":  [
                    "RAG_DIRECT"
                ],
        "issue":  "Missing RAG source"
    },
    {
        "query_id":  "Q_RAG_05",
        "expected":  "RAG",
        "got":  [
                    "KG_DIRECT"
                ],
        "issue":  "Missing RAG source"
    },
    {
        "query_id":  "Q_RAG_07",
        "expected":  "RAG",
        "got":  [
                    "KG_DIRECT"
                ],
        "issue":  "Missing RAG source"
    },
    {
        "query_id":  "Q_HYB_01",
        "expected":  "HYBRID",
        "got":  [
                    "RAG_DIRECT"
                ],
        "issue":  "Hybrid degradation to fallback"
    },
    {
        "query_id":  "Q_HYB_02",
        "expected":  "HYBRID",
        "got":  [
                    "KG_DIRECT"
                ],
        "issue":  "Hybrid degradation to fallback"
    },
    {
        "query_id":  "Q_HYB_03",
        "expected":  "HYBRID",
        "got":  [
                    "RAG_DIRECT"
                ],
        "issue":  "Hybrid degradation to fallback"
    },
    {
        "query_id":  "Q_HYB_04",
        "expected":  "HYBRID",
        "got":  [
                    "KG_DIRECT"
                ],
        "issue":  "Hybrid degradation to fallback"
    },
    {
        "query_id":  "Q_HYB_05",
        "expected":  "HYBRID",
        "got":  [
                    "RAG_DIRECT"
                ],
        "issue":  "Hybrid degradation to fallback"
    }
]
```

## Notes

- `kg_benchmark_expanded_report.json` is the latest KG expanded report artifact, but no executable runner for `kg_benchmark_expanded.json` was found in the benchmark package. KG behavior was exercised by route, retrieval, latency, and golden-path suites.
- No standalone decision benchmark runner was found. Decision-labeled cases were exercised through route, retrieval, latency, failure simulation, and golden-path suites.
- `generateBenchmarkSummary.js` failed twice with `ReferenceError: generateBenchmarkSummary is not defined`; the file defines `generateMarkdown()` but calls `generateBenchmarkSummary()`.
- Benchmark results are current as of this run; `benchmark_summary.md` was not regenerated because the summary generator failed.

## Benchmark Verdict

- Benchmark execution: PARTIAL. Designed suites ran and generated JSON reports, except benchmark summary generation failed due a harness code defect.
- Benchmark success: FAIL. Route, retrieval, golden path, hallucination/security, and frontend contract metrics have failing thresholds/cases.

