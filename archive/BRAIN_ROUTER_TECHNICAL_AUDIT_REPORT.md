# Brain Router Technical Audit Report

Scope: read-only engineering and thesis-defense audit of the Brain Router and its direct routing ecosystem in `C:\AI_AGENT\aast-ai-agent-main\backend`.

No source code was modified. This report is based on current source inspection plus one read-only in-process routing calibration run.

## Evidence Base

- Brain Router core: `services/brainRouter.js`
- Orchestration layer: `orchestrator.js`
- RAG subsystem: `services/ragService.js`
- KG subsystem: `services/neo4jcontext.js`
- Unified synthesis: `services/unifiedAnswerService.js`
- Calibration config: `config/routingCalibration.js`
- Golden path registry: `config/goldenPathRegistry.js`
- Alias registry: `services/academicAliases.js`
- Response envelope: `services/responseFormatter.js`
- Routing tests/artifacts: `testing/routingPrecisionCalibration.test.js`, `testing/route_accuracy_report.json`, `testing/golden_path_benchmark_report.json`

Important root note: the active files audited are under `C:\AI_AGENT\aast-ai-agent-main\backend`. Secondary copies exist under `C:\AI_AGENT\fahd\src_files` and nested frontend paths, but they were not treated as authoritative.

## Phase 1 - Architecture Understanding

### 1. Routing Philosophy

The architecture is not an LLM router. It is an explainable deterministic and score-based routing stack. The Brain Router fuses lexical dictionaries, regex patterns, academic aliases, upstream intent hints, RAG semantic categories, conversation history, golden-path matches, and subsystem health into a route decision.

Evidence:
- Route universe is explicit: `KG_DIRECT`, `KG_ONLY`, `RAG_DIRECT`, `RAG_ONLY`, `HYBRID_KG_RAG`, `DECISION_ENGINE`, `CAREER_ENGINE`, `FAQ`, `LLM_FALLBACK` in `brainRouter.js:37-47`.
- Router weights and thresholds are hard-coded plus environment-tunable in `brainRouter.js:315-343` and `routingCalibration.js:11-22`.
- Orchestrator adds pre-router and post-router route control in `orchestrator.js:700-779`, `orchestrator.js:1131-1145`, and `orchestrator.js:1163-1239`.

Architectural reality: Brain Router is central but not sovereign. Conversation gates, greeting/FAQ gates, golden path logic, ontology locks, and multi-intent handling can bypass or override the Brain Router.

### 2. Signal Fusion Strategy

The router uses additive scoring:
- Lexical KG/RAG/decision/career/FAQ dictionaries: `brainRouter.js:111-306`.
- Academic alias matching: `brainRouter.js:79-106` using aliases from `academicAliases.js:254-525`.
- Feature extraction for curriculum, person, leadership, prerequisite, facility, track, policy, campus, scholarship, fees, GPA, comparison, advisory, planning, conversational intent: `brainRouter.js:539-697`.
- RAG category boost via `ragService.detectQueryCategory()`: `brainRouter.js:859-869`, implemented in `ragService.js:1099-1157`.
- Intent boost from upstream classifier: `brainRouter.js:871-873`, `brainRouter.js:1491-1525`.
- Historical route continuity boost: `brainRouter.js:756-758`, `brainRouter.js:1532-1555`.
- Golden path route lock: `brainRouter.js:768-833`, `brainRouter.js:1117-1188`.

The design is explainable but highly rule-heavy.

### 3. Confidence Calculation Strategy

Confidence is an operational routing score, not a statistically calibrated probability.

Evidence:
- Raw signals are normalized against manually chosen theoretical maxima and scaled by 1.5: `brainRouter.js:363-383`.
- Deterministic RAG path returns fixed `0.96`: `brainRouter.js:1248-1251`.
- Deterministic KG path returns fixed `0.99`: `brainRouter.js:1260-1266`.
- Unified answer confidence is clamped by route class: hybrid and decision/career routes are forced into `0.70-0.89`; general/fallback routes are forced into lower bands: `unifiedAnswerService.js:1757-1772`.

Defense position: call this a calibrated routing score only if you have validation data. Do not call it a probability.

### 4. Hybrid Routing Logic

Hybrid is selected when KG and RAG scores both cross the hybrid threshold or when feature calibration forces hybrid for academic-policy intersections.

Evidence:
- Hybrid candidate if `kg_score` and `rag_score` exceed `HYBRID_TRIGGER`, unless deterministic policy logic supersedes it: `brainRouter.js:911-922`.
- Forced hybrid for requirements, scholarship, policy-program, course-policy, comparison-policy, and semantic ambiguity triggers: `brainRouter.js:632-694`, `brainRouter.js:726-754`.
- Route decision requires KG and RAG health; otherwise it degrades to one side: `brainRouter.js:1293-1316`.
- Orchestrator executes KG and RAG in parallel for hybrid: `orchestrator.js:2591-2600`.

### 5. Deterministic Routing Logic

Deterministic routing exists at several layers:
- Deterministic academic KG patterns: `brainRouter.js:453-493`.
- Deterministic policy RAG patterns: `brainRouter.js:501-536`.
- Golden path locking: `goldenPathRegistry.js:193-392`, `brainRouter.js:1117-1188`.
- Ontology KG lock: `brainRouter.js:1191-1215` and `orchestrator.js:1215-1234`.
- Post-router direct entity locks: `orchestrator.js:1176-1204`.
- KG deterministic synthesis without LLM: `neo4jcontext.js:3393-3408`.
- Deterministic KG response bypass in orchestrator: `orchestrator.js:2348-2445`.
- Deterministic RAG response bypass: `orchestrator.js:2516-2587`.

This is a major strength for factual academic QA.

### 6. Ambiguity Handling

Ambiguity is handled by comparing the top two normalized route scores. If the difference is within `ROUTE_AMBIGUITY_MARGIN`, ambiguity is flagged and fallback chains are expanded.

Evidence:
- Ambiguity margin logic: `brainRouter.js:391-413`.
- Fallback-chain expansion on ambiguity: `brainRouter.js:1410-1428`.

Weakness: ambiguity is score-gap based only. It does not use entropy, uncertainty calibration, disagreement among retrieval systems, or benchmark-derived thresholds.

### 7. Golden Path Handling

Golden paths are hard-coded showcase flows with priority, category, route, execution policy, cacheability, timeout, entities, regex patterns, and optional static fallback.

Evidence:
- Priority table: `goldenPathRegistry.js:11-22`.
- Registered golden queries: Hany profile, Hany teaches NLP, quality unit, AI prerequisites, AI vs Cybersecurity, best major, AI career roadmap, vice dean, dean, modules, course prerequisites: `goldenPathRegistry.js:193-392`.
- Classifier returns confidence from priority: `goldenPathRegistry.js:406-432`.
- Static fallback payload builder: `goldenPathRegistry.js:479-513`.
- Orchestrator caches golden responses: `orchestrator.js:139-175`, `orchestrator.js:1898-1908`.

This is good for defense demos. It is dangerous if presented as general intelligence.

### 8. Conversation-Aware Routing

Conversation awareness exists before and inside the router:
- Meta conversation intent can bypass all heavy routing: `orchestrator.js:700-779`.
- Light conversational intent can return local response: `orchestrator.js:888-907`.
- Follow-up references are resolved before routing: `orchestrator.js:909-947`.
- `lastRoute` is passed into Brain Router for context boost: `orchestrator.js:1136-1140`, `brainRouter.js:756-758`.
- Curriculum carry-over can reuse last curriculum course for week follow-ups: `orchestrator.js:1303-1358`.

This is a strong user-experience feature, but it also means route decisions are stateful and harder to reproduce.

### 9. Curriculum Routing

Curriculum has a special KG path:
- Brain Router detects curriculum terms and ontology intent: `brainRouter.js:59-63`, `brainRouter.js:551-552`.
- Orchestrator locks `CURRICULUM` to `KG_DIRECT`: `orchestrator.js:1163-1174`.
- KG subsystem has deterministic curriculum retrieval and no-information fallback: `neo4jcontext.js:3229-3260`; `orchestrator.js:2166-2231`.

This is thesis-defensible because curriculum data is structured and should not be hallucinated.

### 10. KG vs RAG Separation Strategy

Intended separation:
- KG handles structured entities and relationships: courses, prerequisites, professors, roles, departments, ontology categories.
- RAG handles unstructured policies: GPA, admission, tuition, transfer, scholarships, regulations, registration.
- Hybrid handles intersections.

Evidence:
- KG dictionaries include courses, faculty, ontology, curriculum, facilities: `brainRouter.js:111-202`.
- RAG dictionaries include policy, admission, fees, scholarships, transfer, regulations: `brainRouter.js:207-290`.
- RAG uses multi-pass retrieval and source reranking: `ragService.js:546-718`, `ragService.js:1182-1240`.
- Neo4j uses exact keyword, vector index, deterministic aggregation, and graph response metadata: `neo4jcontext.js:3191-3455`.

Weakness: separation is leaky. Terms like `policy`, `gpa`, `requirements`, `scholarship`, and `curriculum` appear in overlapping route logic. The router compensates with deterministic policy and hybrid boosts, but this is manual calibration, not a clean ontology boundary.

### 11. Fallback Hierarchy

Fallback hierarchy is layered:
- Golden paths degrade based on subsystem health: `brainRouter.js:1124-1160`.
- Deterministic KG and RAG have fallback chains: `brainRouter.js:1248-1268`.
- KG empty can escalate to RAG if allowed: `orchestrator.js:2282-2300`.
- Golden KG/RAG/HYBRID failures can use static fallback payloads: `orchestrator.js:2303-2316`, `orchestrator.js:2476-2490`, `orchestrator.js:2644-2658`.
- Unified synthesis falls back to FusionService: `orchestrator.js:3095-3117`.
- UnifiedAnswer has deterministic empty-context and confidence guards: `unifiedAnswerService.js:2181-2223`.
- Final fatal fallback exists in orchestrator: `orchestrator.js:3224-3300`.

This is robust but complex.

### 12. Explainability Strategy

Explainability is strong at the envelope level:
- Brain Router returns reasoning, fallback chain, thresholds, telemetry, alias expansions, golden path metadata: `brainRouter.js:1073-1115`.
- Orchestrator injects route diagnostics with initial/final route, threshold use, fallback triggers, conversation priority, golden path, locked intent: `orchestrator.js:1269-1301`.
- UnifiedAnswer returns used facts, missing information, graph, sources, metadata, and reasoning: `unifiedAnswerService.js:1974-2075`.
- Response formatter normalizes route, confidence, used facts, missing information, graph, sources, and route diagnostics: `responseFormatter.js:30-90`.

Weakness: the explanation is sometimes post-hoc. Because the orchestrator can override the router after `determineBestRoute()`, the route explanation may describe the Brain Router decision plus later mutations.

## Routing Flow Diagram

```text
User Query
  -> Input validation and academic normalization
  -> Conversation meta/light/follow-up gate
      -> may return local answer and bypass Brain Router, KG, RAG, LLM
  -> Golden path classification
  -> Multi-intent detection
      -> may override single golden path
  -> Greeting / FAQ pre-routing
      -> may return before Brain Router
  -> Intent classification / ontology pre-route hint
  -> Subsystem health probe
  -> BrainRouter.analyzeQuery()
      -> lexical dictionaries
      -> academic alias matching
      -> feature classification
      -> RAG category boost
      -> intent/history boost
      -> deterministic policy classifier
      -> deterministic KG classifier
      -> golden path calibration
      -> normalized route scores
  -> BrainRouter.determineBestRoute()
      -> golden route enforcement
      -> ontology KG enforcement
      -> forced hybrid
      -> deterministic RAG shortcut
      -> deterministic KG shortcut
      -> ambiguity detection
      -> best route and fallback chain
  -> Orchestrator route locks
      -> curriculum lock
      -> direct entity lock
      -> ontology lock
      -> multi-intent hybrid lock
  -> Subsystem execution
      -> KG direct / KG only
      -> RAG direct / RAG only
      -> Hybrid KG+RAG parallel
      -> Decision engine
      -> Career engine
      -> LLM fallback
  -> Deterministic bypass checks
      -> KG_DIRECT/RAG_DIRECT may bypass unified synthesis
  -> UnifiedAnswer synthesis or FusionService fallback
  -> ResponseFormatter envelope
  -> User Response with route diagnostics, facts, graph, sources, missing information
```

## Phase 2 - Strength Analysis

| Strength | Technical description | Why good engineering | Accuracy | Latency | Explainability | Defense |
|---|---|---|---:|---:|---:|---:|
| Deterministic KG routing | Factual academic/person/prerequisite/curriculum paths lock to KG (`brainRouter.js:1260-1272`, `orchestrator.js:1163-1174`) | Avoids hallucination for graph facts | 9 | 8 | 9 | 9 |
| Deterministic RAG policy routing | Strong policy terms lock to RAG (`brainRouter.js:1241-1257`) | Protects official rules from generic LLM answers | 8 | 7 | 8 | 8 |
| Multi-signal fusion | Combines dictionaries, aliases, RAG category, intent, history, golden paths (`brainRouter.js:845-960`) | Better than one regex layer | 8 | 6 | 7 | 8 |
| Academic alias resolution | Canonical aliases and typo variants (`academicAliases.js:254-525`) | Handles student wording variance | 8 | 8 | 7 | 8 |
| Golden path registry | Priority route policy and fallbacks (`goldenPathRegistry.js:193-392`) | Reliable thesis demo flows | 8 | 8 | 8 | 9 |
| Hybrid support | KG+RAG parallel execution for mixed queries (`orchestrator.js:2591-2600`) | Handles structured plus policy intersections | 8 | 5 | 8 | 8 |
| Conversation priority | Meta/light/follow-up gates before heavy routing (`orchestrator.js:700-947`) | Reduces unnecessary retrieval and improves UX | 7 | 9 | 7 | 7 |
| Curriculum KG lock | Curriculum routes use deterministic KG and safe no-info message (`orchestrator.js:2166-2231`) | Prevents syllabus hallucination | 9 | 7 | 9 | 9 |
| Health-aware degradation | Health probes and fallback chains (`healthProbes.js:76-184`, `brainRouter.js:1124-1160`) | Avoids hard crashes when a subsystem is down | 7 | 6 | 7 | 7 |
| RAG multi-pass retrieval | Expanded, simplified, answer-engine fallback (`ragService.js:546-718`) | Improves recall before giving up | 7 | 4 | 7 | 7 |
| Source reranking | Official/quality/priority/similarity/category reranker (`ragService.js:1182-1240`) | Reduces raw vector-order dependence | 7 | 6 | 7 | 7 |
| Response contract | Facts, missing info, graph, sources, route diagnostics (`unifiedAnswerService.js:1974-2075`, `responseFormatter.js:30-90`) | Makes answers inspectable | 8 | 6 | 9 | 9 |

## Phase 3 - Weakness Analysis

| Weakness | Severity | Root cause | Real-world impact | Defense committee risk | Production risk |
|---|---|---|---|---|---|
| Confidence is not statistically calibrated | HIGH | Manual thresholds, manual normalization, fixed `0.96/0.99`, clamped output confidence (`brainRouter.js:363-383`, `brainRouter.js:1248-1266`, `unifiedAnswerService.js:1757-1772`) | Users may overtrust a route | Committee can ask why these numbers are valid | Bad confidence can hide misroutes |
| Route authority is fragmented | HIGH | Pre-router gates and post-router overrides mutate final route (`orchestrator.js:700-779`, `orchestrator.js:1163-1239`) | Harder to debug why a route happened | Brain Router is not actually the only router | Regression risk when changing any layer |
| Rule and regex sprawl | HIGH | Huge dictionaries and regexes in router and registry (`brainRouter.js:111-306`, `goldenPathRegistry.js:193-392`) | Expansion to new domains becomes brittle | Committee can attack scalability | Maintenance cost grows quickly |
| Golden paths can mask data gaps | HIGH | Static fallbacks return controlled answers (`goldenPathRegistry.js:479-513`) | Demo can pass even when live KG/RAG is incomplete | If exposed, looks like hard-coded answers | Stale facts become production errors |
| Validation artifacts are weak/mixed | CRITICAL | HTTP benchmark reports `48.57%` route accuracy; golden benchmark has 10/11 passed with one KG golden failure and inconsistent pass semantics | Cannot claim production-level routing accuracy | This is the easiest attack point | Not production-ready without refreshed benchmark |
| KG/RAG separation is leaky | HIGH | Policy, GPA, requirements, curriculum terms appear in overlapping route logic (`brainRouter.js:111-290`, `brainRouter.js:501-536`) | False KG/RAG/hybrid route choices | Committee can ask for boundary definition | Misroutes on mixed academic queries |
| FAQ handling is not reliable as a router class | MEDIUM | FAQ is partly pre-router and partly Brain Router dominance gated (`orchestrator.js:1000-1028`, `brainRouter.js:1368-1384`) | FAQ questions often become RAG/LLM | FAQ precision artifact is 0% | Low impact, but noisy |
| Health checks may use cached or optimistic status | MEDIUM | Golden path uses fast/optimistic health check (`orchestrator.js:1131-1134`, `healthProbes.js:81-86`) | Route may trust stale health | Must defend as latency optimization | Wrong degradation path under failure |
| Latency can exceed demo targets | HIGH | KG/RAG/LLM paths can be slow; golden benchmark shows slow KG runs and route benchmark worst latency 22.8s | Poor user experience | Defense demo risk if live stack is slow | SLO failure |
| Test coverage is curated | MEDIUM | In-process calibration test has only 23 selected cases (`routingPrecisionCalibration.test.js:47-78`) | Does not prove general accuracy | Committee can ask about coverage | Hidden false positives/negatives |
| Explainability can be post-hoc | MEDIUM | Route diagnostics are assembled after router and overrides (`orchestrator.js:1269-1301`) | Explanation may not isolate root cause | Can confuse defense answers | Debugging complexity |
| No learned drift control | MEDIUM | Thresholds are env vars, not auto-calibrated from labeled failures (`routingCalibration.js:11-22`) | Changes in data/query distribution are manual | Committee can ask how drift is detected | Accuracy decays silently |

## Phase 4 - Defense Committee Attack Simulation

1. Why rule-based routing instead of an LLM router? Expected answer: deterministic academic routing is explainable, reproducible, and safer for factual institutional data. Support: yes, `brainRouter.js` and orchestrator enforce deterministic paths.
2. Why these thresholds? Expected answer: env-tunable operational thresholds. Support: partial; `routingCalibration.js:11-22` exposes them, but no statistical calibration is proven.
3. Is confidence a probability? Expected answer: no, it is a route score. Support: yes if stated honestly; not supported if claimed as probability.
4. How do you validate routing accuracy? Expected answer: in-process calibration plus live route benchmarks. Support: partial; 23-case calibration passes, but HTTP route artifact is weak.
5. How do you prevent route drift? Expected answer: tests, benchmarks, route diagnostics, metrics. Support: partial; no automated drift learning.
6. Why golden paths? Expected answer: defense/demo critical paths with explicit route policy. Support: yes; but must disclose they are curated.
7. Could Gemini replace the router? Expected answer: no, Gemini can synthesize text but cannot replace deterministic evidence routing. Support: yes.
8. Why hybrid threshold 0.34? Expected answer: operational threshold for KG/RAG intersection. Support: partial; not empirically defended.
9. How is ambiguity measured? Expected answer: score gap within `ROUTE_AMBIGUITY_MARGIN`. Support: yes; simplistic.
10. What happens if KG is down? Expected answer: degrade to RAG/FAQ/LLM depending path. Support: yes.
11. What happens if RAG is down? Expected answer: degrade to KG or LLM depending path. Support: yes.
12. How do you separate KG and RAG? Expected answer: KG for structured graph facts, RAG for official policy text, hybrid for intersections. Support: partial because route terms overlap.
13. How do you avoid hallucination? Expected answer: deterministic KG/RAG bypass, evidence absence guards, missing-information fields. Support: yes.
14. How scalable is it to another college/domain? Expected answer: medium; registries and dictionaries must be extended. Support: weak.
15. How do you handle follow-up questions? Expected answer: conversation priority resolves references and passes last route. Support: yes.
16. Why not always hybrid? Expected answer: latency and noise; hybrid only when both KG/RAG signals are relevant. Support: yes.
17. How do you measure production readiness? Expected answer: route accuracy, latency, failures, fallback frequency, live health. Support: partial; artifacts show production is not proven.
18. Can committee reproduce results? Expected answer: yes for calibration test; live benchmark depends on running services/data. Support: partial.
19. What is the biggest false-positive risk? Expected answer: KG locks or golden paths can overroute broad policy questions. Support: yes.
20. What is the biggest false-negative risk? Expected answer: unseen wording not in aliases/regexes can fall to RAG/LLM. Support: yes.

## Phase 5 - Improvement Analysis

### Category A - Mandatory before production

1. Rebuild routing benchmark with current route semantics.
   - Benefit: defensible accuracy and confusion matrix.
   - Complexity: medium.
   - Risk: low.
   - Time: 1-2 days.

2. Separate route score from user-facing confidence.
   - Benefit: prevents false probability claims.
   - Complexity: medium.
   - Risk: medium because API fields may depend on `confidence`.
   - Time: 1-2 days.

3. Add a single authoritative route-decision record.
   - Benefit: explains pre-router, Brain Router, and post-router overrides cleanly.
   - Complexity: medium.
   - Risk: medium.
   - Time: 1 day.

4. Fix golden benchmark pass criteria and static-fallback labeling.
   - Benefit: stops demo/fallback success from being confused with live KG success.
   - Complexity: low.
   - Risk: low.
   - Time: 0.5-1 day.

5. Add latency SLO gates for KG/RAG/hybrid/golden routes.
   - Benefit: catches 7-22s demo failures.
   - Complexity: medium.
   - Risk: low.
   - Time: 1 day.

### Category B - Recommended improvements

1. Move route rules into a structured rule table with owners and test cases.
   - Benefit: reduces regex sprawl.
   - Complexity: medium.
   - Risk: medium.
   - Time: 2-4 days.

2. Add per-route evaluation sets for KG, RAG, hybrid, decision, career, FAQ, LLM fallback.
   - Benefit: targeted regression control.
   - Complexity: medium.
   - Risk: low.
   - Time: 2-3 days.

3. Add a shadow LLM router only for comparison, not control.
   - Benefit: identifies blind spots without risking deterministic behavior.
   - Complexity: medium.
   - Risk: low.
   - Time: 2 days.

4. Add route-drift dashboards from `routeDiagnostics`.
   - Benefit: production observability.
   - Complexity: medium.
   - Risk: low.
   - Time: 2-3 days.

### Category C - Research-grade future improvements

1. Train or tune a lightweight intent classifier using logged route outcomes.
   - Benefit: reduces manual regex dependence.
   - Complexity: high.
   - Risk: medium.
   - Time: 1-2 weeks.

2. Calibrate confidence with labeled data using Platt/isotonic calibration.
   - Benefit: defensible confidence values.
   - Complexity: high.
   - Risk: low-medium.
   - Time: 1 week.

3. Add retrieval disagreement/uncertainty scoring between KG and RAG.
   - Benefit: better ambiguity and hybrid decisions.
   - Complexity: high.
   - Risk: medium.
   - Time: 1-2 weeks.

4. Use active learning for misroutes.
   - Benefit: route improves from benchmark failures.
   - Complexity: high.
   - Risk: medium.
   - Time: 2+ weeks.

## Phase 6 - Should It Be Changed Now?

OPTION 2: MINOR SAFE IMPROVEMENTS ONLY.

Justification:
- Do not major-refactor the Brain Router before defense. It is deeply coupled to orchestrator overrides, KG/RAG execution, golden paths, response formatting, metrics, and test assumptions.
- The core architecture is defense-worthy if framed correctly: deterministic, evidence-first, route-explainable academic routing.
- The weak part is not the idea; it is the proof layer. Current route benchmark artifacts are not strong enough for production claims.
- Safe changes before defense should be limited to benchmark/report cleanup, terminology cleanup around confidence, and test evidence. Avoid changing route logic unless a specific failing defense query must be fixed.

## Phase 7 - Thesis Defense Score

- Architecture Quality: 8/10
- Engineering Quality: 7/10
- Explainability: 8/10
- Maintainability: 5/10
- Academic Value: 8/10
- Production Readiness: 5/10
- Defense Readiness: 7/10
- Overall: 71/100

Interpretation: strong thesis prototype, not production-proven. Good architecture story, weak empirical validation story.

## Phase 8 - Final Verdict

1. Biggest Strength: deterministic, explainable KG/RAG routing with explicit route diagnostics and LLM bypass for factual academic queries.
2. Biggest Weakness: confidence and accuracy are not empirically calibrated enough for production claims; current HTTP benchmark artifact reports only `48.57%` route accuracy.
3. Most Likely Defense Question: "Why should we trust your route confidence and thresholds?"
4. Most Important Future Upgrade: statistically calibrated route evaluation with a current labeled benchmark, drift tracking, and separate route-score versus answer-confidence semantics.
5. Whether to modify before defense: do not refactor. Make only minor, evidence-preserving improvements if time allows. The safest defense posture is: "This is an explainable deterministic academic router with curated golden-path hardening and ongoing calibration work, not a fully learned production router."

Hard verdict: defense-ready as an engineering prototype if you tell the truth. Not production-ready. Do not oversell the confidence numbers.

## Verification Performed

- Read-only source inspection across the requested router ecosystem.
- Ran `node testing/routingPrecisionCalibration.test.js` from `C:\AI_AGENT\aast-ai-agent-main\backend`.
- Result: passed 23 in-process route calibration cases.
- Current artifact warning: `testing\route_accuracy_report.json` reports `48.57%` route accuracy; this blocks any production-readiness claim until benchmark validity and route expectations are reconciled.
