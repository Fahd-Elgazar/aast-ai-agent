# Testing and regression strategy

**Stage G–H · proposed future gates, with measured diagnostic baseline**

Use the existing 25-session suite as targeted advisor diagnostics. Each case has the observed user intent, expected evidence and revision metadata. Reuse it as a pinned regression corpus while keeping adaptive branches reproducible. Outcomes from the 470-query research evaluation serve a separate purpose. [Scenarios](conversation_scenarios.json) · [Synthetic replay manifest](conversation_results.jsonl) · [Baseline and cleanup gates](14_CLEANUP_VERIFICATION_REPORT.md)

## Exact pre-integration checks

| Layer | Commands from the indicated package |
|---|---|
| Node backend | Run `npm run test:health`, `test:kg`, `test:topology`, `test:auth`, `test:auth-provisioning`, `test:admin-proxy`, `test:golden-cache`, `test:routing` and `test:decision`. Run `node testing/<name>.test.js` for `conversationalIntelligence`, `demoConversationMemory`, `demoConversationFollowup`, `demoConversationAnswer`, `retrievalEntityAlignment`, `groundingVerification`, `fusionEvidenceContract`, `fallbackTruthContract` and `directRagGroundingContract`. `demoConversationAnswer` is a future gate in this list and was outside the cleanup rerun. |
| React frontend | `npm test`, `npm run lint`, `node ./node_modules/typescript/bin/tsc --noEmit --project tsconfig.app.json` and `npm run build` in the frontend root. Verify new/old envelopes, citations, deployed proxy, session navigation and admin/Decision boundaries. |
| RAG | `python -m pytest -p no:cacheprovider -q test_phase3_retriever.py test_rag_readiness.py` from `aast-ai-agent-main/backend/rag_system`. Check temporary search/store and no unsupported source substitution. |
| Decision | `python scripts/run_delivery_checks.py` from `college-decision-system-backend`. Require hermetic migration, API role/integrity and database smoke. |
| Container | On one exact-revision candidate with capacity reviewed, probe front door plus internal graph, vector, retriever, answer and Decision. Capture source SHA, OCI digest, fixture/data and model reference. Run a guest session, Decision, authorized role boundary in fixtures, and graph UI. |

## Promotion acceptance

| Gate | Measurement and initial threshold |
|---|---|
| Transport and scope | 25 diagnostic guests, stable owner CID on every submitted turn, no cross-owner state and no unexpected 5xx in normal runs. Log blocked turns as blocked rather than dropping them. |
| Resolution | A01/2,/4, B04/4 and D03/3 all preserve explicit subject/relation/time or return the intended clarification. Old session, ambiguous references and topic-change isolation pass. |
| Routing | E02/1 does not enter recommendation; F04/1 is out of domain. Supported major advice, prior-answer recall and admin allowed/forbidden controls pass. Compare requested and final route with reason. |
| Evidence | D01/1, F03/1,/4 and D03/1 yield claim-level citation or explicit localized gaps. D02/1 receives scholarship eligibility only when it answers a scoped question. Official calendar version, exact graph edge types and negative mismatch fixtures are verified. Block on any fabricated institutional requirement in the fixed replay. |
| Multi-part | E03/1 and D03/1 produce separate scoped parts in order. Track supported versus missing evidence on each. |
| Natural interaction | Two reviewers judge explanation, example, rephrase, short clarification and repeated replies in B01/B03/E01. Proposed pass requires all named grounded transformations to satisfy the request with no new unsupported facts. Compare the previously repeated template counts using the same prompts. |
| Timing and capacity | The July appliance diagnostic had median 302 ms, p95 3,290 ms and max 31,696 ms with uncontrolled warm/cold state. Future gate compares both revisions using the same workload, model warm-up and hardware at one user and documented concurrency. Report median, p95 and max and fallback/timeout counts. Initial proposal is no more than 10% p95 regression in the warmed matched replay, subject to D-05. |
| Reliability and privacy | Inject graph timeout, vector empty, slow generation, provider failure, circuit and disconnect in isolated fixtures. Record stage cancellation, no extra work after deadline, and bounded retry. Run synthetic-only exported logs through secret/path checks. |
| Release and reversal | Both developers approve the same recorded digest. Replaying a pinned prior image with compatible fixture data after rollback must restore health + a three-turn guest smoke. Preserve measured failure and rollback timing. |

Score each turn as pass, partial, fail, warranted limitation or blocked. Count by failure family and note the number of eligible examples; fixed-prompt replay documents comparability and adaptive turns document interaction. Two reviewers adjudicate P0 cases against exact evidence IDs. Run once per candidate and retry only a diagnosed, recoverable infrastructure error. Release conclusions require matching revision, snapshot and settings. [Roadmap](16_MASTER_IMPLEMENTATION_ROADMAP.md) · [Decision register](19_OPEN_DECISIONS_AND_BLOCKERS.md)
