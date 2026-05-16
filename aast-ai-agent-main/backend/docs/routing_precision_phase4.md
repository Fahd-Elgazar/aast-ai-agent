# Phase 4 Routing Precision Calibration

## Routing Audit

Current routing flow:

1. `orchestrator.js` normalizes the query with `academicQueryNormalizer`.
2. Intent is inferred by deterministic regex for factual/program queries or by the Gemma intent prompt.
3. `brainRouter.analyzeQuery` computes lexical KG/RAG/decision/career/FAQ scores.
4. `brainRouter.determineBestRoute` selects KG, RAG, hybrid, decision, career, FAQ, or LLM fallback.
5. `orchestrator.js` executes the selected subsystem and sends evidence to `unifiedAnswerService`, with `fusionService` as the synthesis fallback.
6. `responseFormatter` normalizes the response route and metadata contract.

Observed blind spots before this patch:

- The post-router safety lock in `orchestrator.js` could force `requirements` and prerequisite-like queries into `KG_DIRECT`, even when the router had enough policy/program signals for hybrid.
- `brainRouter` thresholds were hard-coded and mixed lexical, regex, and route-lock signals without exposing the exact threshold set used.
- Person/faculty aliases were sparse; short title variants such as `dr hany` and role variants such as `vice dean ai` depended too heavily on exact wording.
- `neo4jcontext.js` person retrieval required exact phrase/name equality after alias normalization, which could miss KG records that store names with titles or role text.
- Hybrid route telemetry did not expose enough detail about why hybrid was chosen, which aliases expanded, or why fallback escalation occurred.
- Existing route benchmark normalization compared frontend-normalized routes directly against internal routes, so `KG_DIRECT`/`RAG_DIRECT` could look like drift.

## Implemented Calibration

- Added config-driven routing thresholds in `config/routingCalibration.js`.
- Added multi-factor route features in `brainRouter`: entity confidence, alias confidence, query specificity, semantic ambiguity, question class, historical route continuity, and hybrid trigger reasons.
- Protected hybrid triggers for scholarship, requirements, policy/program intersections, course/policy intersections, and structured comparisons.
- Restricted the orchestrator KG safety lock to direct entity/leadership questions only.
- Added tiered KG-empty escalation to RAG before returning a no-evidence answer.
- Added route diagnostics to response metadata and explainability.
- Hardened person/faculty alias normalization in `academicAliases.js`.
- Relaxed person KG matching to allow title/name/role contains matches after exact phrase checks.
- Added offline deterministic route tests in `testing/routingPrecisionCalibration.test.js`.
- Updated live route benchmark canonicalization for direct routes.

## Config Additions

Use these values as the initial production baseline:

```env
KG_CONFIDENCE_THRESHOLD=0.40
HYBRID_CONFIDENCE_THRESHOLD=0.34
LLM_FALLBACK_THRESHOLD=0.18
PERSON_ALIAS_BOOST=0.22
REQUIREMENTS_HYBRID_BOOST=0.26
SCHOLARSHIP_HYBRID_BOOST=0.34
ROUTE_AMBIGUITY_MARGIN=0.12
ROUTE_HISTORY_BOOST=0.06
DETERMINISTIC_KG_THRESHOLD=0.70
DETERMINISTIC_RAG_THRESHOLD=0.70
```

## Migration Guide

1. Add the new environment variables or rely on the defaults in `config/routingCalibration.js`.
2. Restart the orchestrator so the threshold config is loaded.
3. Run `npm run test:routing` from `aast-ai-agent-main/backend`.
4. Start the platform and run the live benchmark with `node testing/routeBenchmark.js`.
5. Inspect `metadata.trace.route_diagnostics` in API responses for route, confidence, thresholds, alias expansions, hybrid trigger reasons, and fallback triggers.

## Rollback Instructions

1. Set conservative values to dampen the new boosts:

```env
PERSON_ALIAS_BOOST=0
REQUIREMENTS_HYBRID_BOOST=0
SCHOLARSHIP_HYBRID_BOOST=0
HYBRID_CONFIDENCE_THRESHOLD=0.50
KG_CONFIDENCE_THRESHOLD=0.38
LLM_FALLBACK_THRESHOLD=0.25
```

2. Restart the orchestrator.
3. If a full code rollback is needed, revert only these files:

- `config/routingCalibration.js`
- `services/brainRouter.js`
- `services/academicAliases.js`
- `services/neo4jcontext.js`
- `services/responseFormatter.js`
- `orchestrator.js`
- `testing/routingPrecisionCalibration.test.js`
- `testing/routeBenchmark.js`
- `.env.example`

## Benchmark Plan

Track:

- Route accuracy by class: KG, RAG, HYBRID, DECISION, CAREER, FAQ, LLM.
- Direct entity recall: `who is hany hanafy`, `dr hany`, `vice dean ai`, `dean computing`.
- Hybrid precision: scholarship, GPA, fees, requirements, and multi-domain comparisons.
- Fallback frequency: LLM fallback should stay low for factual academic queries.
- Empty KG escalation rate: KG-empty to RAG should be visible in `fallback_triggers`.
- Latency: offline route tests should remain sub-second; live hybrid should stay within existing KG/RAG timeout budgets.

Acceptance targets:

- 100% pass on `npm run test:routing`.
- No LLM fallback for direct faculty/course/leadership queries with healthy KG.
- Scholarship, fee, GPA, and requirements intersections route to hybrid when KG and RAG are healthy.
- Route diagnostics are present on all non-static orchestrator responses.
