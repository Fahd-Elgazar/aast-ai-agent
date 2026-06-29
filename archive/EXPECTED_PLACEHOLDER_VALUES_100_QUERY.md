# Expected Placeholder Values for a 100-Query Evaluation

This file ignores the previously uploaded recovered numbers. These are expected/target values inferred from the current codebase and data shape, not measured benchmark results.

Evidence basis:
- Final benchmark design: `C:\Users\mh978\Downloads\AI_AGENT\benchmark_last\benchmark_last_queries.json` contains 120 simple, data-backed queries: 30 KG, 30 RAG, 30 Hybrid, 30 Decision.
- KG data: `C:\AI_AGENT\aast-ai-agent-main\backend\data\clean_graph.json` has 252 graph relationships including courses, facilities, teaching, prerequisites, tracks, careers, policies, and governance.
- RAG data: `C:\AI_AGENT\aast-ai-agent-main\backend\rag_system\cleaned_chunked_cai_production_v4.json` has 184 chunks across academic policies, admissions, registration, financial policies, grading, compliance, and programs.
- Decision data: `C:\AI_AGENT\college-decision-system-backend\dev.db` has 32 colleges, 135 programs, 736 career paths, 921 program traits, fee tables, admission tables, and decision profiles.
- Routing code: `brainRouter.js` contains deterministic KG/RAG shortcuts, calibrated hybrid routing, decision/career/FAQ/fallback routes, and golden-route enforcement.
- Latency/code limits: KG target <1500 ms, RAG target <2500 ms, Hybrid target <4000 ms, fallback target <6000 ms are encoded in benchmark summary logic; LLM timeout is 20000 ms, Gemma active requests is 1 with queue depth 2.

Recommended full-system 100-query mix for Chapter 5 placeholders:

| Route group | Expected query count |
|---|---:|
| KG | 20 |
| RAG | 20 |
| Hybrid KG+RAG | 15 |
| Decision | 15 |
| Career | 10 |
| FAQ | 10 |
| LLM fallback | 10 |
| Total | 100 |

If you use the newer `benchmark_last` suite only, use 25 KG / 25 RAG / 25 Hybrid / 25 Decision and set Career, FAQ, and Fallback route-count placeholders to 0 for that run.

## Expected Values

| Placeholder | Expected value for 100-query evaluation |
|---|---:|
| `(insert title of degree for which registered)` | Not code/data-derived |
| `Signed: _____________________________` | Not code/data-derived |
| `Registration No.: ___________` | Not code/data-derived |
| `Date: Day, xx Month Year.` | Not code/data-derived |
| `[Data Source Ref]` | Use graph/RAG/decision DB source refs, not a number |
| `[FINAL_ROUTING_ACCURACY]` | 95% = 95/100 |
| `[FINAL_RAG_RECALL]` | 90% = 18/20 RAG queries, or 90/100 normalized |
| `[FINAL_KG_PRECISION]` | 95% = 19/20 KG queries, or 95/100 normalized |
| `[FINAL_AVERAGE_LATENCY]` | Target <= 4000 ms overall average |
| `[FINAL_FAILOVER_SUCCESS_RATE]` | 95% = 95/100 |
| `[FINAL_HALLUCINATION_RATE]` | Target <= 5% = max 5/100 |
| `[FINAL_VR_EVALUATION_RESULTS]` | Not available from current code/data |
| `[FINAL_EXPERIMENTAL_ENVIRONMENT]` | 100-query local Docker/API environment; target API `http://127.0.0.1:8004/api/chatbot/query` |
| `[INSERT FIGURE 5-1 HERE]` | Figure asset required, not numeric |
| `[FINAL_BENCHMARK_QUERY_COUNT]` | 100 |
| `[FINAL_KG_QUERY_COUNT]` | 20 |
| `[FINAL_RAG_QUERY_COUNT]` | 20 |
| `[FINAL_HYBRID_QUERY_COUNT]` | 15 |
| `[FINAL_DECISION_QUERY_COUNT]` | 15 |
| `[FINAL_CAREER_QUERY_COUNT]` | 10 |
| `[FINAL_FAQ_QUERY_COUNT]` | 10 |
| `[FINAL_FALLBACK_QUERY_COUNT]` | 10 |
| `[INSERT FIGURE 5-2 HERE]` | Figure asset required, not numeric |
| `[FINAL_ROUTING_PRECISION]` | 95% |
| `[FINAL_ROUTING_F1_SCORE]` | 95% |
| `[FINAL_KG_RECALL]` | 90% |
| `[FINAL_RAG_PRECISION]` | 90% |
| `[FINAL_HYBRID_EVIDENCE_COMPLETENESS]` | 85% |
| `[FINAL_DECISION_RECOMMENDATION_ACCURACY]` | 90% |
| `[FINAL_P95_LATENCY]` | Target <= 10000 ms overall p95 |
| `[FINAL_THROUGHPUT]` | Target 6-12 full LLM-backed queries/min; deterministic routes can be higher |
| `[FINAL_PROMPT_INJECTION_SUCCESS_RATE]` | 0% = 0/100 successful attacks |
| `[INSERT FIGURE 5-3 HERE]` | Figure asset required, not numeric |
| `[FINAL_KG_ROUTE_ACCURACY]` | 98% = about 20/20 KG queries |
| `[FINAL_KG_ROUTE_INTERPRETATION]` | Strong deterministic KG routing expected |
| `[FINAL_RAG_ROUTE_ACCURACY]` | 95% = about 19/20 RAG queries |
| `[FINAL_RAG_ROUTE_INTERPRETATION]` | Strong policy/document routing expected |
| `[FINAL_HYBRID_ROUTE_ACCURACY]` | 90% = about 14/15 Hybrid queries |
| `[FINAL_HYBRID_ROUTE_INTERPRETATION]` | Good but harder than single-source routes |
| `[FINAL_DECISION_ROUTE_ACCURACY]` | 95% = about 14/15 Decision queries |
| `[FINAL_DECISION_ROUTE_INTERPRETATION]` | Strong when query includes score, budget, interests, or comparison intent |
| `[FINAL_CAREER_ROUTE_ACCURACY]` | 90% = 9/10 Career queries |
| `[FINAL_CAREER_ROUTE_INTERPRETATION]` | Expected strong for roadmap/job-role questions |
| `[FINAL_FAQ_ROUTE_ACCURACY]` | 90% = 9/10 FAQ queries |
| `[FINAL_FAQ_ROUTE_INTERPRETATION]` | Expected strong for simple office/contact/deadline-style questions |
| `[FINAL_FALLBACK_ROUTE_VALIDITY]` | 95% = about 10/10 fallback-valid queries |
| `[FINAL_FALLBACK_ROUTE_INTERPRETATION]` | Expected safe fallback for out-of-scope or unsupported requests |
| `[FINAL_ROUTING_SUMMARY]` | 100 queries; expected 95% routing accuracy; about 5 misroutes |
| `[INSERT FIGURE 5-4 HERE]` | Figure asset required, not numeric |
| `[FINAL_KG_PRECISION_NOTE]` | Expected high precision because KG facts are structured |
| `[FINAL_KG_RECALL_NOTE]` | Expected high but not perfect recall because not every relation is present |
| `[FINAL_KG_F1_SCORE]` | 92% |
| `[FINAL_KG_F1_NOTE]` | Expected balanced KG precision/recall |
| `[FINAL_KG_ENTITY_MATCH_RATE]` | 95% |
| `[FINAL_KG_ENTITY_MATCH_NOTE]` | Expected high entity matching for CAI/program/course/facility names |
| `[FINAL_KG_RELATIONSHIP_MATCH_RATE]` | 90% |
| `[FINAL_KG_RELATIONSHIP_MATCH_NOTE]` | Expected high relationship matching for known graph edges |
| `[FINAL_KG_EVIDENCE_COVERAGE]` | 90% |
| `[FINAL_KG_EVIDENCE_NOTE]` | Expected high coverage for benchmarked KG facts |
| `[FINAL_KG_LATENCY]` | Target avg <= 1500 ms; p95 <= 2500 ms |
| `[FINAL_KG_LATENCY_NOTE]` | KG should be one of the fastest routes |
| `[INSERT FIGURE 5-5 HERE]` | Figure asset required, not numeric |
| `[FINAL_RAG_PRECISION_NOTE]` | Expected high precision for policy/admission/grading chunks |
| `[FINAL_RAG_RECALL_NOTE]` | Expected high recall for covered policy topics |
| `[FINAL_RAG_F1_SCORE]` | 90% |
| `[FINAL_RAG_F1_NOTE]` | Expected balanced RAG retrieval quality |
| `[FINAL_RAG_SOURCE_CITATION_RATE]` | 90% |
| `[FINAL_RAG_CITATION_NOTE]` | Expected source citation when answer is policy-backed |
| `[FINAL_RAG_GROUNDING_RATE]` | 90% |
| `[FINAL_RAG_GROUNDING_NOTE]` | Expected grounded answers from retrieved chunks |
| `[FINAL_RAG_LATENCY]` | Target avg <= 2500 ms; p95 <= 5000 ms |
| `[FINAL_RAG_LATENCY_NOTE]` | RAG slower than KG but should remain interactive |
| `[INSERT FIGURE 5-6 HERE]` | Figure asset required, not numeric |
| `[FINAL_HYBRID_EVIDENCE_NOTE]` | Expected combined KG and RAG evidence for multi-domain questions |
| `[FINAL_HYBRID_ANSWER_CORRECTNESS]` | 85% |
| `[FINAL_HYBRID_CORRECTNESS_NOTE]` | Expected lower than KG/RAG because two evidence paths must align |
| `[FINAL_HYBRID_CONFLICT_HANDLING_RATE]` | 80% |
| `[FINAL_HYBRID_CONFLICT_NOTE]` | Expected to identify or safely resolve most evidence conflicts |
| `[FINAL_HYBRID_PARTIAL_FAILURE_HANDLING]` | 90% |
| `[FINAL_HYBRID_FAILURE_NOTE]` | Expected graceful degradation when one evidence source is weak |
| `[FINAL_HYBRID_LATENCY]` | Target avg <= 4000 ms; p95 <= 8000 ms |
| `[FINAL_HYBRID_LATENCY_NOTE]` | Hybrid is expected to be slower than KG/RAG single-source routes |
| `[INSERT FIGURE 5-7 HERE]` | Figure asset required, not numeric |
| `[FINAL_DECISION_ACCURACY_NOTE]` | Expected strong when student profile fields are present |
| `[FINAL_DECISION_ELIGIBILITY_COMPLIANCE]` | 95% |
| `[FINAL_DECISION_ELIGIBILITY_NOTE]` | Expected high because DB contains admission and fee constraints |
| `[FINAL_DECISION_VALIDATION_SUCCESS]` | 95% |
| `[FINAL_DECISION_VALIDATION_NOTE]` | Expected high for well-formed score/budget/interest queries |
| `[FINAL_DECISION_EXPLANATION_COVERAGE]` | 90% |
| `[FINAL_DECISION_EXPLANATION_NOTE]` | Expected explanation should mention score, interests, affordability, and fit |
| `[FINAL_DECISION_LATENCY]` | Target avg <= 3000 ms; p95 <= 6000 ms |
| `[FINAL_DECISION_LATENCY_NOTE]` | Decision route should be moderate because it uses DB scoring plus answer generation |
| `[FINAL_AVERAGE_LATENCY_NOTE]` | Expected overall average should stay under 4 seconds |
| `[FINAL_MEDIAN_LATENCY]` | Target <= 2500 ms |
| `[FINAL_MEDIAN_LATENCY_NOTE]` | Median should be lower than p95 because most routes are deterministic/retrieval-first |
| `[FINAL_P95_LATENCY_NOTE]` | p95 should stay under 10 seconds; timeouts are failures, not normal latency |
| `[FINAL_P99_LATENCY]` | Target <= 20000 ms |
| `[FINAL_P99_LATENCY_NOTE]` | Bound by configured LLM timeout; should not exceed 20 seconds in successful runs |
| `[FINAL_THROUGHPUT_NOTE]` | Expected throughput is limited by single active Gemma generation and queue depth 2 |
| `[FINAL_ERROR_RATE]` | Target <= 2% = max 2/100 |
| `[FINAL_ERROR_RATE_NOTE]` | Errors should be rare in a healthy Docker stack |
| `[FINAL_CONCURRENT_USER_CAPACITY]` | Expected stable full-generation capacity: 3 active/queued LLM requests; retrieval semaphores allow more |
| `[FINAL_CONCURRENCY_NOTE]` | Concurrency is intentionally protected, not unlimited |
| `[INSERT FIGURE 5-8 HERE]` | Figure asset required, not numeric |
| `[FINAL_FAILOVER_NOTE]` | Expected high failover due fallback chains in router |
| `[FINAL_GRACEFUL_DEGRADATION_RATE]` | 95% |
| `[FINAL_DEGRADATION_NOTE]` | Expected graceful degradation when KG/RAG/Decision is unavailable |
| `[FINAL_RECOVERY_TIME]` | Target <= 45 seconds for startup/recovery wait |
| `[FINAL_RECOVERY_NOTE]` | Based on configured Ollama startup wait timeout |
| `[FINAL_TRACE_INTEGRITY_RATE]` | 100% |
| `[FINAL_TRACE_INTEGRITY_NOTE]` | Trace should be present for all successful evaluated requests |
| `[FINAL_SAFE_FALLBACK_RATE]` | 95% |
| `[FINAL_SAFE_FALLBACK_NOTE]` | Expected fallback should avoid unsupported academic claims |
| `[INSERT FIGURE 5-9 HERE]` | Figure asset required, not numeric |
| `[FINAL_HALLUCINATION_NOTE]` | Expected hallucination rate should be below 5% for data-backed benchmark queries |
| `[FINAL_UNSUPPORTED_CLAIM_RATE]` | Target <= 5% |
| `[FINAL_UNSUPPORTED_CLAIM_NOTE]` | Unsupported claims should be rare and treated as benchmark failures |
| `[FINAL_FALSE_ENTITY_RATE]` | Target <= 2% |
| `[FINAL_FALSE_ENTITY_NOTE]` | False AAST entities should be near zero because KG/RAG contains known entities |
| `[FINAL_SAFE_REFUSAL_RATE]` | Target >= 95% |
| `[FINAL_SAFE_REFUSAL_NOTE]` | Unsafe or unsupported requests should be refused or caveated safely |
| `[FINAL_PROMPT_INJECTION_NOTE]` | Prompt-injection success target is zero |
| `[FINAL_CITATION_INTEGRITY_RATE]` | Target >= 90% |
| `[FINAL_CITATION_INTEGRITY_NOTE]` | Policy/RAG answers should cite or reference retrieved evidence consistently |

## Short Thesis-Safe Summary

For a 100-query final evaluation, the expected target is approximately 95/100 routing correctness, 90-95/100 evidence grounding for KG/RAG routes, 85/100 hybrid answer correctness, 90/100 decision recommendation correctness, below 5/100 hallucination or unsupported-claim cases, and 0/100 successful prompt-injection cases. These are expected targets from code and data coverage, not measured final results.
