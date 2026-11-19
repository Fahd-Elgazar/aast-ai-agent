# Phase cards and acceptance evidence

Each phase has one accountable lead. In P0 and P5 both people must participate and attest independently. Task estimates cover execution. Cross-review allowance is in the master strategy. Each phase PR includes the named code or documentation, local test changes, commands, fixture fingerprints and review decision. New paths below are proposed outputs on the signed phase branches.

## P0 · Reproducible baseline and contract freeze

**Joint checkpoint led by Mohammed Hassan (Codex).** Resolve source, cleanup and profile drift before either developer changes behavior. Start BASE immediately after plan approval. Machine 2 can read the plan and check tools while waiting for the review ref.

Entry requires Mohammed’s approval to start P0. Only the baseline review materials and signed examples change in this phase. Exit when both accounts can reproduce and approve a cleaned, isolated reference run.

### BASE · Mohammed Hassan · 1.5 engineer-days

Verify both machines can fetch the published source. Arrange private transfer of the five-file patch by checksum and record the synthetic replay digest, approved evidence fixture rights, model IDs, dependency advisories, capacity and disposable deployment profile.

| Field | Agreement |
|---|---|
| Finding | Version drift / D-01,D-02 |
| Entry | Plan approved by Mohammed |
| Existing files eligible for change | Read-only source review |
| Proposed files to create | `research/conversation-baseline/profile.json`, `research/conversation-baseline/replay.json` |
| Implementation and acceptance evidence | Both machines can fetch the same clean parent and read the review diff and synthetic case pack. Shared mounts, published ports and model/dataset substitutions are ruled out by inspecting resolved settings locally. |
| Verification procedures | BASELINE in [test gates](06_TESTING_AND_ACCEPTANCE_GATES.md) |
| Main risk | The public snapshot excludes unpublished ancestry. Future recovery must use reviewed patches, and authorized evidence fixtures must match on both machines. |
| Reversal | Withdraw the proposed ref from consideration and keep development gated on the last agreed identity. |
| Reviewer | Teammate |

### AUDIT · Teammate · 1.5 engineer-days

Independently review five cleanup diffs on machine 2. Inspect exports, call sites and dependency usage. Run paired clean/cleaned checks and identify authoritative synthetic passage and edge controls.

| Field | Agreement |
|---|---|
| Finding | C00–C03 / D-02,D-03 |
| Entry | BASE |
| Existing files eligible for change | Read-only source review |
| Proposed files to create | `research/conversation-baseline/cleanup-review.md` |
| Implementation and acceptance evidence | Five signed dispositions with before/after blob IDs, commands and outcomes. Each positive fixture has a known ID/version, each missing administrative fact is labeled. Any overlapping or behavioral hunk blocks acceptance. |
| Verification procedures | BASELINE, NATIVE in [test gates](06_TESTING_AND_ACCEPTANCE_GATES.md) |
| Main risk | A green historical smoke used the July image. Line-ending changes can obscure the true patch. |
| Reversal | Request a corrected cleanup-only review from the owner. Keep the original patch intact. |
| Reviewer | Mohammed Hassan |

### FREEZE · Mohammed Hassan · 2 engineer-days

Lead the joint freeze. Build and smoke the reviewed cleaned baseline on a disposable full stack. Agree producer/consumer examples, latency profile, absence semantics, synthetic export limits, and tests. Record the verified GitHub baseline and both reviewers’ acceptance in the freeze evidence.

| Field | Agreement |
|---|---|
| Finding | Release parity / D-01,D-04,D-05 |
| Entry | AUDIT |
| Existing files eligible for change | Read-only source review |
| Proposed files to create | `research/conversation-baseline/freeze.md`, `evaluation/contracts/retrieval/advisor-v1.examples.json` |
| Implementation and acceptance evidence | Both sign the exact cleaned source, image identity, fixture hashes, contract examples and baseline smoke evidence. Record a parity run on both machines for native checks. Source and data authorization must cover both accounts. |
| Verification procedures | BASELINE, NATIVE, STACK, CONTRACT in [test gates](06_TESTING_AND_ACCEPTANCE_GATES.md) |
| Main risk | A mutable image tag or missing evidence pack makes later regression results uninterpretable. |
| Reversal | Keep the last verified image and reschedule after correcting the baseline profile. |
| Reviewer | Teammate |

## P1 · Turn planning, memory and routing

**Lead: Mohammed Hassan (Codex).** Preserve the student’s present question from session load through route choice. Run beside P2. Use agreed adapter doubles. Mohammed serializes all orchestrator, memory and routing changes.

Entry requires P0. Keep the optional legacy single-question adapter until both lanes pass. Exit when real ordered plans satisfy reference fixtures and old callers retain their behavior.

### TRACE · Mohammed Hassan · 1.5 engineer-days

Emit bounded stage outcomes at the request boundary for normal, bypass, partial and early-return paths. Supply an optional sink to adapters. Compare trace-on and trace-off behavior.

| Field | Agreement |
|---|---|
| Finding | R04,R05,R07,R09 · D03/1, B02/2 |
| Entry | FREEZE |
| Existing files eligible for change | `aast-ai-agent-main/backend/orchestrator.js`, `aast-ai-agent-main/backend/services/logger.js`, `aast-ai-agent-main/backend/services/metrics.js`, `aast-ai-agent-main/backend/testing/conversationalIntelligence.test.js` |
| Proposed files to create | None required |
| Implementation and acceptance evidence | One server UUID per synthetic turn, a ran/skipped/unavailable/error outcome for each required stage, identical answers and CID semantics with tracing disabled, and no sensitive exported fields. |
| Verification procedures | TRACE, AUTH in [test gates](06_TESTING_AND_ACCEPTANCE_GATES.md) |
| Main risk | Early returns omit stages or double-log completed requests. |
| Reversal | Revert the sink/wiring commit and keep request IDs and response structure. |
| Reviewer | Teammate |

### STATE · Mohammed Hassan · 3.5 engineer-days

Fill only missing referents. Honor explicit subject, predicate, week, comparison order and format. Persist confirmed corrections, pending clarification and prior verified claim IDs per owner. Normalize older records and serialize same-CID writes.

| Field | Agreement |
|---|---|
| Finding | R01,R02 · A01/2,/4, B04/4, D03/3 |
| Entry | TRACE |
| Existing files eligible for change | `aast-ai-agent-main/backend/services/conversationPriority.js`, `aast-ai-agent-main/backend/testing/demoConversationFollowup.test.js`, `aast-ai-agent-main/backend/testing/conversationalIntelligence.test.js`, `aast-ai-agent-main/backend/services/conversationService.js`, `aast-ai-agent-main/backend/services/persistenceLayer.js`, `aast-ai-agent-main/backend/testing/demoConversationMemory.test.js`, `aast-ai-agent-main/backend/testing/authIsolation.test.js` |
| Proposed files to create | None required |
| Implementation and acceptance evidence | A01/2 compares or clarifies, A01/4 keeps Data Science and Machine Learning, B04/4 requests Cognitive Computing week 5, D03/3 retains week 3. Owner isolation, restart, stale target, concurrent turns and old-format records pass. |
| Verification procedures | STATE, AUTH in [test gates](06_TESTING_AND_ACCEPTANCE_GATES.md) |
| Main risk | Inherited topic overrides an explicit relation or reopening a legacy CID leaks a previous owner. |
| Reversal | Revert readers/writers as a pair, keeping optional stored fields ignorable by the old reader. |
| Reviewer | Teammate |

### PLAN · Mohammed Hassan · 3.5 engineer-days

Build ordered clauses before per-part classification. Apply scoped golden/meta/Decision gates per clause and retain requested/effective route, reason and budget. Fence cached answers by material constraints. Use frozen fake adapters until the integration join.

| Field | Agreement |
|---|---|
| Finding | R03,R09 · E02/1, F04/1, E03/1, D03/1 |
| Entry | STATE |
| Existing files eligible for change | `aast-ai-agent-main/backend/orchestrator.js`, `aast-ai-agent-main/backend/services/brainRouter.js`, `aast-ai-agent-main/backend/services/conversationMetaIntent.js`, `aast-ai-agent-main/backend/config/goldenPathRegistry.js`, `aast-ai-agent-main/backend/testing/routingPrecisionCalibration.test.js`, `aast-ai-agent-main/backend/services/conversationPriority.js`, `aast-ai-agent-main/backend/testing/conversationalIntelligence.test.js`, `aast-ai-agent-main/backend/services/goldenCachePolicy.js` |
| Proposed files to create | None required |
| Implementation and acceptance evidence | E03/1 produces independent course/week pairs in order. D03/1 keeps document and syllabus scopes. E02/1 uses sequence evidence, F04/1 exits unsupported, F01/4 preserves teaching intent. Positive advising, FAQ and recall still work. |
| Verification procedures | ROUTE, STATE in [test gates](06_TESTING_AND_ACCEPTANCE_GATES.md) |
| Main risk | Shared orchestrator early exits, golden hits and hybrid fallback can bypass the plan. |
| Reversal | Revert the planner wiring and scoped rule changes together after dependents are disabled. |
| Reviewer | Teammate |

## P2 · Retrieval and evidence adjudication

**Lead: Teammate (Claude Code).** Return typed evidence, source gaps and claim support for each ordered part. Run beside P1. Graph and document work have no technical dependency on each other, but one teammate schedules them serially. Complete both before adjudication.

Entry requires P0. Keep existing single-part entry points, direct-RAG checks, schemas and index layouts. Exit when real adapters and judge satisfy the same fixtures that P1 consumes.

### GRAPH · Teammate · 3 engineer-days

Adapt exact and semantic graph retrieval to the frozen part and execution options. Match target, relation and direction, carry rejection/status events, bound queries and close sessions on abort. Preserve broad general queries and graph visualization.

| Field | Agreement |
|---|---|
| Finding | R04,R07 · C02/2, E02/1, D02/1 |
| Entry | FREEZE |
| Existing files eligible for change | `aast-ai-agent-main/backend/services/neo4jcontext.js`, `aast-ai-agent-main/backend/testing/kgReliability.test.js`, `aast-ai-agent-main/backend/testing/retrievalEntityAlignment.test.js` |
| Proposed files to create | None required |
| Implementation and acceptance evidence | Positive typed edge preserves direction and ID. Reject reversed/adjoining entities, semantic substitutes for an exact miss, and prerequisites inferred from RECOMMENDED_AFTER. Empty and timed-out retrieval produce distinct results. |
| Verification procedures | KG, FAULT in [test gates](06_TESTING_AND_ACCEPTANCE_GATES.md) |
| Main risk | A graph label can be both a course and a program. Broad suppression could drop valid discovery results. |
| Reversal | Revert the part-aware graph adapter, preserving the fixture failure and prior schema. |
| Reviewer | Mohammed Hassan |

### DOC · Teammate · 3 engineer-days

Keep /search defaults. Carry part scope through Node capability discovery, Python recall, ranking, eligibility and bounded fallback. Propagate budget/abort where supported and cap in-flight synchronous work. Record stable passage, authority and version or reason for absence.

| Field | Agreement |
|---|---|
| Finding | R04,R07,R09 · D02/1, D04/1, B04/4 |
| Entry | FREEZE |
| Existing files eligible for change | `aast-ai-agent-main/backend/services/ragService.js`, `aast-ai-agent-main/backend/rag_system/phase3_retriever.py`, `aast-ai-agent-main/backend/rag_system/test_phase3_retriever.py`, `aast-ai-agent-main/backend/rag_system/test_rag_readiness.py` |
| Proposed files to create | None required |
| Implementation and acceptance evidence | D04 calendar and D02 eligibility positives retain approved passage IDs. Procedure/deadline requests abstain without a matching source. Wrong-topic or wrong-week passages fail. Abort cancels queued retries and capability probes. |
| Verification procedures | RAG, FAULT in [test gates](06_TESTING_AND_ACCEPTANCE_GATES.md) |
| Main risk | A score or exact title alone can admit the wrong record. Synchronous embedding can outlive a canceled HTTP call. |
| Reversal | Revert Node/Python adapter changes together without reindexing or touching stored vectors. |
| Reviewer | Mohammed Hassan |

### JUDGE · Teammate · 3 engineer-days

Adapt existing fusion, direct-RAG and sentence verifier to accept scoped items. Select by part, authority and version, deduplicate stable IDs within scope, and carry conflict, rejection and claim-to-ID mappings. Build against shared contract examples before the real planner arrives.

| Field | Agreement |
|---|---|
| Finding | R04,R05,R09 · D01/1, F03/1, D03/1 |
| Entry | GRAPH + DOC |
| Existing files eligible for change | `aast-ai-agent-main/backend/services/fusionService.js`, `aast-ai-agent-main/backend/services/directRagEvidencePolicy.js`, `aast-ai-agent-main/backend/services/groundingVerificationService.js`, `evaluation/contracts/retrieval/entity-evidence.schema.json`, `evaluation/contracts/retrieval/grounding-result.schema.json`, `aast-ai-agent-main/backend/testing/fusionEvidenceContract.test.js`, `aast-ai-agent-main/backend/testing/groundingVerification.test.js` |
| Proposed files to create | None required |
| Implementation and acceptance evidence | A complete, missing and conflicting part survive independently. Every supported institutional sentence cites selected evidence from its part. History and score alone cannot support facts. Existing single-part and legacy callers pass. |
| Verification procedures | EVIDENCE, CONTRACT in [test gates](06_TESTING_AND_ACCEPTANCE_GATES.md) |
| Main risk | Existing exact-evidence source enum describes retrieval method. Changing it to a KG/RAG lane breaks consumers. |
| Reversal | Revert the wrapper/verifier changes after any dependent public formatter is reversed. |
| Reviewer | Mohammed Hassan |

## P3 · Grounded replies and request lifecycle

**Lead: Mohammed Hassan (Codex).** Carry accepted facts to all reply paths, keep style faithful and bound work after abandonment. Run beside P4. Only Mohammed edits request, provider lifecycle and public rendering. Sequence all central file edits.

Entry requires P1 and P2. The part-aware adapter must work under both registered profiles. Exit when actual advisor and browser pass grounded reply, cancellation and backward-compatibility tests.

### BIND · Mohammed Hassan · 2.5 engineer-days

Wire actual planner to both adapters, adjudicator, deterministic exits, fallback and React. Bind supported claims and localized gaps before response formatting. Adopt CID and evidence safely across navigation/reload.

| Field | Agreement |
|---|---|
| Finding | R05,R09 · D01/1, F03/4, D03/1 |
| Entry | PLAN + JUDGE |
| Existing files eligible for change | `aast-ai-agent-main/backend/orchestrator.js`, `aast-ai-agent-main/backend/services/responseFormatter.js`, `aast-ai-agent-main/frontend/src/components/ChatMessage.tsx`, `aast-ai-agent-main/frontend/src/types.ts`, `aast-ai-agent-main/backend/testing/directRagGroundingContract.test.js`, `aast-ai-agent-main/frontend/src/components/pages/AdvisorPage.tsx`, `aast-ai-agent-main/frontend/testing/frontendCorrectness.test.ts` |
| Proposed files to create | None required |
| Implementation and acceptance evidence | D01/1, F03/1, F03/4 and D03/1 produce attributable claims or a localized gap. Older envelopes still display, empty citations stay empty, and late replies cannot overwrite a new session. |
| Verification procedures | PUBLIC, EVIDENCE, STATE in [test gates](06_TESTING_AND_ACCEPTANCE_GATES.md) |
| Main risk | A correct backend citation can disappear in normalization, CID adoption or history reload. |
| Reversal | Revert public rendering and bridge commits first. Keep readable optional storage fields. |
| Reviewer | Teammate |

### VOICE · Mohammed Hassan · 2 engineer-days

Distinguish recall, rephrase, why and example. Shape only prior verified material, preserve evidence, use requested language/length, and give one scoped clarification if needed. Gate all model and deterministic replies.

| Field | Agreement |
|---|---|
| Finding | R06 · B01/4, B03/2, E01/4 |
| Entry | BIND |
| Existing files eligible for change | `aast-ai-agent-main/backend/services/conversationMetaIntent.js`, `aast-ai-agent-main/backend/services/conversationalHumanizer.js`, `aast-ai-agent-main/backend/services/unifiedAnswerService.js`, `aast-ai-agent-main/frontend/src/components/ChatMessage.tsx`, `aast-ai-agent-main/backend/testing/demoConversationAnswer.test.js` |
| Proposed files to create | None required |
| Implementation and acceptance evidence | Two reviewers accept B01/4, B03/2 and E01/4 for the requested operation with equal supported claims and IDs. Repeated generic refusal count falls on matched cases while warranted limitations remain correct. |
| Verification procedures | VOICE, PUBLIC in [test gates](06_TESTING_AND_ACCEPTANCE_GATES.md) |
| Main risk | A fluent model can add a new rule or change uncertainty. |
| Reversal | Revert shaping independently and keep the citation bridge. |
| Reviewer | Teammate |

### BUDGET · Mohammed Hassan · 2.5 engineer-days

Apply one lifecycle deadline across browser, queue, router, graph/document and generation. Honor disconnect before persistence and retries, check breaker transitions and compare residual cancellation/admission branches by behavior. Agree explicit handling of non-interruptible work.

| Field | Agreement |
|---|---|
| Finding | R07 · B02/2, A02/2 |
| Entry | VOICE |
| Existing files eligible for change | `aast-ai-agent-main/backend/orchestrator.js`, `aast-ai-agent-main/backend/services/ollamaService.js`, `aast-ai-agent-main/backend/services/circuitStateManager.js`, `aast-ai-agent-main/backend/services/healthMonitor.js`, `aast-ai-agent-main/backend/config/runtimeMode.js`, `aast-ai-agent-main/backend/testing/healthReadiness.test.js`, `aast-ai-agent-main/frontend/src/services/agentService.ts`, `aast-ai-agent-main/frontend/src/services/httpClient.ts`, `aast-ai-agent-main/backend/testing/fallbackTruthContract.test.js` |
| Proposed files to create | None required |
| Implementation and acceptance evidence | On delay/disconnect no new work, retry or late write begins after abort. Abortable calls stop; any non-interruptible call drains within its declared bound with its result discarded. Partial truth, HTTP status and envelope stay consistent. Matched latency gate passes. |
| Verification procedures | FAULT, PUBLIC in [test gates](06_TESTING_AND_ACCEPTANCE_GATES.md) |
| Main risk | Promise timeout can leave work running or silently write stale memory. |
| Reversal | Revert orchestration policy and restore measured prior timeout settings in the isolated profile. |
| Reviewer | Teammate |

## P4 · Independent evidence and fault qualification

**Lead: Teammate (Claude Code).** Establish a test oracle across producer and consumer boundaries independent of the public presentation changes. Run beside P3 using integration-head planner and real evidence adapters with injected failures. Public end-to-end scoring waits for P5.

Entry requires P1 and P2. Only teammate-owned tests change. Production fixes go back to their owner. Exit when named positive and negative controls distinguish routing errors, evidence errors, true gaps and timeouts.

### CASES · Teammate · 2.5 engineer-days

Qualify both lane outputs at their real contract boundary with positive/negative, bilingual and conflicting-version fixtures. Detect true source absence independently from routing and ranking misses.

| Field | Agreement |
|---|---|
| Finding | R04,R05,R09 · E03/1, D03/1, F01/4 |
| Entry | PLAN + JUDGE |
| Existing files eligible for change | `aast-ai-agent-main/backend/testing/retrievalEntityAlignment.test.js`, `aast-ai-agent-main/backend/testing/fusionEvidenceContract.test.js`, `aast-ai-agent-main/backend/rag_system/test_phase3_retriever.py`, `aast-ai-agent-main/backend/rag_system/test_rag_readiness.py` |
| Proposed files to create | None required |
| Implementation and acceptance evidence | Every P0 evidence failure has a passing positive and a rejecting negative control. E03/D03 keep order, ID and provenance through the real planner and evaluator. Save fixture hashes and a per-part verdict. |
| Verification procedures | CONTRACT, KG, RAG, EVIDENCE in [test gates](06_TESTING_AND_ACCEPTANCE_GATES.md) |
| Main risk | Using the same selection heuristic to generate expectations makes the test circular. |
| Reversal | Restore last reviewed oracle only after independent evidence review. Keep failed cases recorded. |
| Reviewer | Mohammed Hassan |

### QUALIFY · Teammate · 2 engineer-days

Independently inject adapter delay, unavailable versus empty sources, cancellation and provider degradation with fake clocks, fixed data and deterministic model outcomes. Prepare the blind scoring sheet and comparable latency protocol for the joined candidate.

| Field | Agreement |
|---|---|
| Finding | R04,R07 · D02/1, B02/2 |
| Entry | CASES |
| Existing files eligible for change | `aast-ai-agent-main/backend/testing/retrievalEntityAlignment.test.js`, `aast-ai-agent-main/backend/testing/fusionEvidenceContract.test.js` |
| Proposed files to create | None required |
| Implementation and acceptance evidence | Oracle distinguishes canceled from unavailable and true negative from dropped candidate. Positive, wrong-source, slow, mixed and bilingual controls all have expected IDs or explicit absence. The final public-stack verdict is reserved for P5. |
| Verification procedures | FAULT, EVIDENCE in [test gates](06_TESTING_AND_ACCEPTANCE_GATES.md) |
| Main risk | Live timing makes tests flaky or leaks a host-specific dependency. |
| Reversal | Revert defective fixture setup, retain reproducible failed assertions for the owner. |
| Reviewer | Mohammed Hassan |

## P5 · Integrated candidate and release decision

**Joint checkpoint led by Mohammed Hassan (Codex).** Verify the same candidate on both machines or on the agreed shared capacity host and demonstrate reversal. Joint checkpoint. Mohammed builds and queues merges. Teammate reviews independently. Both attest to one SHA and digest.

Entry requires P3 and P4. Retain the last verified digest and compatible fixture snapshot until promotion is accepted. Exit when accept only after native tests, integrated 125-turn replay, isolation and rollback pass.

### CANDIDATE · Mohammed Hassan · 2 engineer-days

As integration owner, merge completed lanes, close CI coverage gaps, build one exact candidate, run isolated stack gates and the fixed 25-session replay, and rehearse prior-digest rollback. Only change packaging if a verified gate requires it.

| Field | Agreement |
|---|---|
| Finding | Release parity / R01–R07,R09 |
| Entry | BUDGET + QUALIFY |
| Existing files eligible for change | `.github/workflows/ci.yml`, `appliance/Dockerfile`, `docker-compose.appliance.yml`, `docker-compose.yml`, `appliance/README.md` |
| Proposed files to create | `research/conversation-release/candidate.md` |
| Implementation and acceptance evidence | CI and native gates green at the integration head. Candidate label, image, data/model fingerprints, 125 turn records, latency comparison and rollback times recorded. All P0s closed; unexplained regression blocks promotion. |
| Verification procedures | NATIVE, STACK, REPLAY, FAULT in [test gates](06_TESTING_AND_ACCEPTANCE_GATES.md) |
| Main risk | Different index/model/hardware or volume reuse makes comparative scores invalid. |
| Reversal | Stop promotion, revert the whole failing phase via reviewed PR in reverse dependency order, and restore the last verified fixture-image pair. |
| Reviewer | Teammate |

### SIGNOFF · Teammate · 1.5 engineer-days

Independently verify the candidate SHA and digest, evidence links, negative cases, specialized routes, reviewer agreement and rollback on machine 2 or the agreed capacity host. Return a signed recommendation to Mohammed.

| Field | Agreement |
|---|---|
| Finding | Independent review / D-01,D-05 |
| Entry | CANDIDATE |
| Existing files eligible for change | Read-only source review |
| Proposed files to create | `research/conversation-release/independent-review.md` |
| Implementation and acceptance evidence | Two named reviewers record SHA/digest and complete dispositions. A rollback restores health and the three-turn smoke; stable promotion and tagging require separate maintainer authorization. |
| Verification procedures | REPLAY, STACK in [test gates](06_TESTING_AND_ACCEPTANCE_GATES.md) |
| Main risk | A green unit suite or successful July image can be mistaken for cleaned-source certification. |
| Reversal | Withhold sign-off and return the failing case and stage to its single owner. |
| Reviewer | Mohammed Hassan |
