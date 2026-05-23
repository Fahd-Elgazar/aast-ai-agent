# Phase 3 Golden Path Hardening

## Golden Path Audit

The demo-critical scenarios are registered in `config/goldenPathRegistry.js`.

| Scenario | Registry id | Locked route | Execution policy |
| --- | --- | --- | --- |
| Who is Hany Hanafy? | `golden_hany_profile` | `KG_DIRECT` | `DIRECT_NEO4J` |
| What does Hany Hanafy teach? | `golden_hany_teaches` | `KG_DIRECT` | `DIRECT_NEO4J` |
| Who is head of quality unit? | `golden_head_quality_unit` | `KG_DIRECT` | `DIRECT_NEO4J` |
| What are AI prerequisites? | `golden_ai_prerequisites` | `KG_DIRECT` | `DIRECT_NEO4J` |
| Compare AI vs Cybersecurity | `golden_ai_vs_cybersecurity` | `DECISION_ENGINE` | `RULE_ENGINE` |
| Recommend best major | `golden_best_major` | `DECISION_ENGINE` | `RULE_ENGINE` |
| Career roadmap for AI | `golden_ai_career_roadmap` | `CAREER_ENGINE` | `RULE_ENGINE` |
| Vice dean of AI | `golden_vice_dean_ai` | `KG_DIRECT` | `DIRECT_NEO4J` |
| Dean of department | `golden_dean_department` | `KG_DIRECT` | `DIRECT_NEO4J` |
| Modules in major | `golden_modules_major` | `KG_DIRECT` | `DIRECT_NEO4J` |
| Prerequisites for course | `golden_course_prerequisites` | `KG_DIRECT` | `DIRECT_NEO4J` |

## Routing Architecture Upgrades

- `brainRouter.js` now applies golden-path calibration after generic signals, so registry policy is the final authority for demo paths.
- Priority order is explicit: `KG_DIRECT` / `DIRECT_NEO4J`, then `RAG_DIRECT`, `DETERMINISTIC_HYBRID`, `RULE_ENGINE`, `FAQ`, and only then `LLM_FALLBACK`.
- Golden routes bypass LLM intent classification in `orchestrator.js`.
- Golden KG/RAG calls use shorter demo timeouts and fall back to controlled deterministic payloads.
- Route diagnostics now include `golden_path`, fallback triggers, route priority, and cache status.
- Routing audit events are written to `logs/routing-audit.jsonl`.

## Entity Priority Logic

Entity routing is defined in `ENTITY_PRIORITY_TABLE`:

- Professors, courses, roles, departments, and majors route to `KG_DIRECT`.
- Policy entities route to `RAG_DIRECT`.
- Comparison, recommendation, and career entities route to deterministic rule engines.

## Failure Safety

- KG timeout or empty result on a golden KG query returns a professional golden fallback payload instead of a dead-end message.
- RAG timeout or empty result on a golden RAG query uses the same controlled fallback pattern.
- Hybrid total failure no longer escalates to a risky LLM chain for golden paths when a static fallback exists.
- Golden decision comparison does not require profile data.
- Golden career roadmap can run without prior conversation memory.
- Fatal errors on golden queries return a deterministic golden fallback response with trace metadata.

## Performance Tools

Run cache prewarming before demos:

```bash
npm run prewarm:golden
```

Run 50 repeated runs per golden query:

```bash
npm run benchmark:golden
```

Override repeats:

```bash
node testing/goldenPathBenchmark.js --repeats=10
```

Reports:

- `testing/golden_prewarm_report.json`
- `testing/golden_path_benchmark_report.json`

Current offline routing validation:

- 11 registry entries.
- 23 golden query variants.
- 1,150 repeated BrainRouter control-plane decisions.
- 100% deterministic route stability in the local offline sweep.

## Validation Checklist

- `npm run test:routing`
- `npm run prewarm:golden` with the platform running
- `npm run benchmark:golden` with `GOLDEN_BENCHMARK_REPEATS=50`
- Stop Neo4j and confirm golden KG queries return controlled fallback payloads.
- Stop RAG and confirm golden policy/hybrid routes degrade without HTTP failure.
- Stop/overload Ollama and confirm golden KG, decision, and career paths still avoid LLM.
- Inspect frontend graph panels for stable `nodes` and `links` arrays.
- Confirm no golden response says `system busy`.

## Freeze Recommendation

Freeze the golden registry for live demos after the benchmark report shows:

- 100% no-crash rate.
- 100% route-stability rate or approved deterministic degradation.
- p95 latency under 3000 ms after prewarming.
- Stable graph fingerprint for each golden query.
- No golden route uses `LLM_FALLBACK` unless every deterministic service and fallback is unavailable.
