# Integrated Fixes

This document records only reviewed fixes present on `unified-platform`.
Analysis, proposed patches, passing branch-local tests, or an agent's `done`
message are not sufficient.

## Truthful degraded outcomes

- Issue mapping: historical HC-02, HC-04, HM-07; CQ-20.
- Before: a golden-query match could emit named academic facts after KG/RAG or
  fatal failure; Decision timeout could recommend three static majors; null
  Unified Answer output could be dereferenced; KG/RAG empty exits were not
  persisted as assistant turns.
- After: static golden payload construction is disabled, Decision failure states
  explicitly say no recommendation was produced, the partial-evidence path is
  null-safe, and truthful KG/RAG evidence gaps are stored in conversation
  history and typed memory.
- Files: golden-path registry, orchestrator, and a dedicated fallback truth
  regression test.
- Verification: fallback truth contract, golden-cache policy, routing
  calibration, dean answer contract, conversation memory, grounding, retrieval
  alignment, and Node syntax all pass.
- Limitation: the legacy fallback prose remains attached to registry entries as
  unreachable historical metadata. It cannot be converted into a runtime
  payload by the exported compatibility function.

## Exact course sequencing evidence gap

- Issue mapping: UQ-001 data/retrieval half, H-006, M-003, CQ-05, CQ-08,
  CQ-13, and CQ-18.
- Before: natural variants of “after Calculus I” could enter the interactive
  major-recommendation flow or a slow semantic/LLM path; exact retrieval did not
  recognize Calculus and could fall through to embeddings after failing to find
  the requested relation.
- After: Calculus I and II resolve to their deployed graph IDs, course-sequence
  framing routes deterministically to KG, and a missing aligned
  `RECOMMENDED_AFTER` relation terminates as a zero-evidence exact result without
  an embedding/model call. No Calculus I/II order is asserted.
- Verification: four previously failing wording variants now calibrate to KG;
  exact entity/relation tests pass 26/26; follow-up, answer, fallback, and
  grounding regressions pass.
- Limitation: this is intentionally an evidence-gap result until an official,
  provenance-backed curriculum source establishes a sequence relation. Live
  end-to-end timing must be recertified after the integrated appliance rebuild.

## Direct RAG grounding and citation contract

- Issue mapping: CQ-05, CQ-06, CQ-09, CQ-14 through CQ-16, and historical
  HC-09/HH-03/HH-08.
- Before: direct RAG could bypass final grounding when any answer string or two
  weak sources existed; route confidence was floored into user confidence; its
  citations lacked evidence IDs and were all discarded by response formatting.
- After: direct bypass requires readable evidence plus a retriever/reranker
  relevance score of at least 0.45; answer-service text is checked/recomposed
  against evidence; final confidence is based on evidence score and grounding;
  stable evidence IDs and canonical citation fields survive formatting.
- Verification: direct-RAG policy rejects weak multi-source/answer-only cases,
  rejects unreadable high-score evidence, accepts relevant readable evidence,
  and preserves grounded citation ID/category/score. Grounding, dean-answer,
  retrieval-alignment, syntax, and diff gates pass.
- Limitation: live Qdrant source metadata and browser rendering require
  integrated appliance recertification.

## Unified route and Fusion evidence adapters

- Issue mapping: CQ-06, CQ-14, CQ-15, CQ-16, and historical HH-08.
- Before: Unified Answer treated `KG_DIRECT` and `RAG_DIRECT` as unknown
  fallback routes, then labeled KG-only, RAG-only, and FAQ-only synthesis as
  `GENERAL`; Fusion serialized the orchestrator's KG evidence object and treated
  the RAG envelope itself as a passage, losing readable evidence and citations.
- After: direct aliases select the corresponding KG/RAG evidence policy,
  external explainability reports the actual KG/RAG/FAQ source class, Fusion
  reads KG `evidence`, flattens RAG `results`, drops empty envelopes, and emits
  stable citation objects accepted by the response formatter.
- Files: Unified Answer, Fusion Service, and a focused contract test.
- Verification: 4/4 adapter cases pass together with direct-RAG grounding,
  grounding verification, and the 11-turn dean answer contract.
- Limitation: this repairs the fallback adapter boundary; live browser evidence
  rendering remains pending the integrated appliance rebuild.

### Independent review correction

- Review rejected the first adapter commit because direct route identity still
  collapsed, source/reasoning builders did not understand KG/RAG routes,
  positional citation IDs collided, top-level RAG provenance was ignored, and
  empty Fusion input was counted as success.
- The corrected contract preserves `KG_DIRECT`/`RAG_DIRECT`, derives direct
  confidence from evidence rather than a route floor, emits aligned sources and
  reasoning, hashes actual source plus evidence when no ID exists, accepts the
  live top-level RAG shape, structures Decision/Career/FAQ provenance, and
  returns a truthful zero-evidence failure without incrementing success metrics.

## Retained capacity after stage timeout

- Issue mapping: H-002, H-007, M-016, and historical HH-04.
- Before: RAG and fallback-LLM semaphore slots were released when the outer
  timeout wrapper returned, even if the protected network/model work continued.
  Repeated timeouts could therefore exceed the configured concurrency limit.
- After: acquisition is bounded by the same stage deadline and the semaphore
  lease remains held until the real operation settles. A timeout may degrade the
  caller response, but it cannot falsely advertise capacity while abandoned
  work is active.
- Verification: the reliability gate proves a caller timeout leaves the slot
  active until a controlled deferred operation resolves; all RAG and fallback
  LLM orchestrator call sites use the retained-lease helper.
- Limitation: this retains capacity safely but does not yet propagate client
  cancellation into every downstream operation.

## Decision truth contract and integration boundary

- Issue mapping: M-007; historical HC-04, HC-07, HC-08, HC-09, HH-12, and
  HM-01.
- Before: ranking weights and displayed contributions disagreed; the Node
  adapter and UI synthesized alternatives, fees, scores, pros, risks,
  roadmaps, and next steps; malformed or contradictory upstream results could
  become success; response-body stalls escaped the timeout; the orchestrator
  treated `no_results` as a named recommendation with fallback confidence.
- After: one immutable weight table drives ranking and contribution display;
  empty results are explicit; Python schemas reject extra input; Node validates
  status, identity, score bounds, fee truth, and score arithmetic; the full
  response body stays inside the deadline; frontend cards render only complete
  upstream records; the orchestrator accepts only `success + ok` evidence and
  never estimates a comparison or confidence.
- Independent review: the first two-commit branch was rejected for six concrete
  truth/deadline/test defects. Commit `f418d02f` corrected them and the full
  branch was approved. The integration boundary was then tightened in
  `bb878dd7` and is under an additional combined review.
- Verification: Decision Node contract, frontend Decision truth test, frontend
  lint/build, and the hermetic Python delivery gate (44 tests, migrations,
  integrity audit, and smoke cases) pass.
- Limitation: a real private-corpus/Neo4j comparison is not substituted for an
  unsupported Decision comparison; the system abstains instead of estimating.

## Frontend conversation and response-deadline correctness

- Issue mapping: H-001 frontend half; historical HH-13 and HM-16.
- Before: a first-response conversation load could replace citations/graph
  state, late requests could mutate a newly selected conversation, Decision
  typed/voice turns did not reliably reuse the response CID, local fallback
  history was unbounded, and several HTTP helpers stopped timing at headers.
- After: request tokens are correlated to the originating conversation;
  superseded loads and advisor requests are cancelled/ignored; first CID
  adoption defers exactly one automatic history reload; typed and voice paths
  share the exact CID; local fallback history retains 200 messages; every
  production response-body consumer remains under its timeout.
- Independent review: the initial and first correction commits were rejected
  for state replacement and unbounded body consumption. Commit `fccef11b`
  completed the body-deadline contract and the full branch was approved before
  integration.
- Verification: executable frontend correctness suite 9/9, frontend Decision
  truth test, lint, production build, and a source-wide unsafe-call guard pass.
- Limitation: the 55-second browser deadline is an interim ceiling until the
  backend, proxy, and downstream services share one propagated deadline.

Each entry must include:

- issue IDs and root cause;
- behavior before and after;
- files changed;
- regression tests added;
- independent review result;
- integration commit;
- live or failure-path verification where applicable;
- remaining limitations.
