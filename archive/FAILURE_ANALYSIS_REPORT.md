# Failure Analysis Report

Generated: 2026-06-25T23:20:25.7144758+03:00
Workspace: C:\AI_AGENT

## Executive Verdict

- Migration/configuration: PASS. Active runtime services use `http://192.168.100.16:11434`.
- Final readiness blocker: remote `gemma4:e2b` generation fails inside the remote Ollama runner with HTTP 500.
- Benchmark status: FAIL/PARTIAL. Benchmark suites ran, but several metrics failed and summary generation has a harness code defect.

## Failure Classification

| Failure | Evidence | Classification | Root cause | Safe fix attempted/result | Remediation |
|---|---|---|---|---|---|
| Remote Gemma generation fails | `OLLAMA_CONNECTIVITY_REPORT.md`; raw replay: `llama-server process has terminated`, Windows `0xc0000409`, `GGML_ASSERT` | Model issue / remote Ollama runtime issue | Remote Ollama can list `gemma4:e2b`, but generation crashes inside remote llama-server | No repo fix possible; endpoint config verified; no model name change allowed | On friend machine: update Ollama, update GPU driver/runtime, repull `gemma4:e2b`, test `ollama run gemma4:e2b Hello`, consider CPU/offload settings if Windows GPU runner keeps crashing |
| Remote backup model missing | Backend logs: `BACKUP_MISSING_DEGRADED`, `missing_models:[tinyllama:latest]` | Model issue | Remote endpoint has `gemma4:e2b` and `nomic-embed-text:latest`, not `tinyllama:latest` | Not fixed because requested model names must not change and target validation only required gemma/nomic | If backup behavior is required, run `ollama pull tinyllama:latest` on the remote machine |
| Benchmark summary generation fails | `summary.log` and `summary_after_extra_suites.log`: `ReferenceError: generateBenchmarkSummary is not defined` | Code defect in benchmark harness | `generateBenchmarkSummary.js` defines `generateMarkdown()` but calls `generateBenchmarkSummary()` | Not fixed; code defect is outside allowed safe fixes and would alter benchmark harness | Minimal future fix: change final call to `generateMarkdown();`; does not change scoring, but requires explicit approval |
| Retrieval KG/RAG metrics fail | `retrieval_report.json`: KG precision `0.00`, RAG recall `14.29`, integrity `5.14` | Retrieval issue / benchmark contract issue | Current responses use source labels like `KG_DIRECT`/`RAG_DIRECT`, while benchmark checks for exact `KG`/`RAG`; hybrid also degrades to single-source/fallback | Not fixed; changing source labels or benchmark scoring is prohibited | Decide whether contract should accept `KG_DIRECT`/`RAG_DIRECT`; if yes, update benchmark contract with approval; otherwise adjust runtime source labels consistently |
| Route benchmark fails | `route_accuracy_report.json`: route accuracy `48.57`, misroute `51.43` | Retrieval issue / routing issue / benchmark expectation drift | RAG, hybrid, FAQ, decision, and career queries often route to KG, hybrid, or fallback instead of expected route | Not fixed; route algorithm and benchmark expectations are out of allowed safe-fix scope | Audit failed query expectations vs current router taxonomy before any routing/scoring change |
| Golden path fails one query | `golden_path_benchmark_report.json`: `golden_hany_profile` routed to `LLM`, degraded `KG_EMPTY`, latency 16085 ms | Retrieval issue / data issue | KG lookup for Hany profile returned empty and escalated to fallback | Not fixed; data/routing changes are not safe config fixes | Verify Neo4j entity/alias data for Hany Hanafy and golden registry mapping before data repair |
| Hallucination/security benchmark fails | `hallucination_report.json`: hallucination rate `36.11%`, failures across fake policy/entity/rule/course/scholarship prompts | Retrieval/data/code behavior issue | System answers some unsupported adversarial prompts with confidence instead of refusing | Not fixed; requires answer-validation/prompt/retrieval behavior changes, which are prohibited here | Add/repair refusal/grounding policy only in a dedicated approved quality task |
| Frontend contract benchmark fails | `frontend_contract_report.json`: contract success `22.86%`, invalid enum issues for `KG_DIRECT`/`RAG_DIRECT` | Code defect / contract drift | Contract validator allows `KG`/`RAG`, but current API emits `KG_DIRECT`/`RAG_DIRECT` | Not fixed; would alter benchmark/frontend contract | Align frontend contract enum with current API or normalize API route/source values with approval |
| Decision benchmark standalone runner missing | Search found no standalone `decisionBenchmark` runner; decision cases exist in shared benchmarks | Benchmark package gap | Decision behavior is covered by decision-labeled cases, but not a separate suite | No safe fix needed | If required, create a dedicated decision benchmark in a separate approved task |

## Failure Counts From Current Run

- Route misroutes: 18 / 35.
- Retrieval failures collected: 18.
- Golden path failures: 1 / 11.
- Hallucination/security failures: 13 / 36.
- Frontend contract failures: 27 / 35.
- Failure simulation catastrophic failures: 0 / 4.

## Safe Fixes Performed

- Replaced active Ollama endpoint values/defaults with `http://192.168.100.16:11434`.
- Started Docker Desktop after initial Docker engine unavailability.
- Rebuilt/recreated the Compose stack with `docker compose up -d --build`.
- Verified container env for backend and rag-answer.
- Did not change prompts, model names, routes, scoring, benchmark questions, retrieval algorithms, or business logic.

## Unresolved Blockers

1. Remote `gemma4:e2b` generation must pass on the friend machine before final readiness can pass.
2. Benchmark summary harness has a code defect and cannot regenerate `benchmark_summary.md` without a code patch.
3. Benchmark route/source contracts and current runtime enums are misaligned (`KG`/`RAG` vs `KG_DIRECT`/`RAG_DIRECT`).
4. Retrieval/routing/data quality failures remain outside safe migration scope.

