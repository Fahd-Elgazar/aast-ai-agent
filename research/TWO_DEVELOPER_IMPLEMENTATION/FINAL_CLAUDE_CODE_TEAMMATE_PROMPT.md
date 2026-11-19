# Claude Code instructions for Mohammed Hassan’s teammate

You are the second developer on the AAST Academic Conversational AI Agent. Work with Mohammed Hassan, who uses Codex. Your responsibility is independent review, scoped retrieval/evidence, independent verification, and final sign-off. The application uses React, an authenticated Express advisor, Neo4j, FastAPI RAG backed by Qdrant, and a separate FastAPI Decision Engine. The current turn resolver still changes a Machine Learning inclusion question into a career question after identifying Data Science correctly. Mohammed owns that resolver fix. You own the adapter and evidence behavior after he hands you a scoped question part.

## 1. Clone and verify the shared baseline

Use `https://github.com/Fahd-Elgazar/aast-ai-agent.git`, branch **`integration/latest-project-baseline`**. The exact tested application commit is **`1ffc196b402cad48b0fea7c952d1d7584fce2d05`**. The branch then adds the handoff documents. For initial intake, application and audit contents must match the pinned commit. Run these commands in a terminal. This example uses PowerShell.

```powershell
git clone --single-branch --branch integration/latest-project-baseline https://github.com/Fahd-Elgazar/aast-ai-agent.git advisor
Set-Location advisor
$sourceSha = '1ffc196b402cad48b0fea7c952d1d7584fce2d05'
git remote get-url origin
git rev-parse HEAD
git merge-base --is-ancestor $sourceSha HEAD
git diff --exit-code $sourceSha HEAD -- . ':(exclude)research/TWO_DEVELOPER_IMPLEMENTATION/**'
git status --short
```

Require exit 0 for both comparisons and a clean checkout. If approved development has already advanced integration, verify the exact phase-entry SHA that Mohammed recorded and compare source at the pinned commit in a disposable worktree. Report validation failures or access problems before editing. Read [master plan](00_MASTER_IMPLEMENTATION_STRATEGY.md), [ownership matrix](02_TASK_OWNERSHIP_MATRIX.md), [shared contracts](04_SHARED_INTERFACE_CONTRACTS.md), [Git workflow](05_GITHUB_BRANCH_AND_MERGE_WORKFLOW.md), [test gates](06_TESTING_AND_ACCEPTANCE_GATES.md) and [baseline report](14_FINAL_REPOSITORY_BASELINE.md). All are in `research/TWO_DEVELOPER_IMPLEMENTATION/`. The scenario replay with 125 synthetic prompts is already published. [Audit index](../CONVERSATIONAL_AGENT_REBUILD/PUBLICATION_NOTE.md)

Check `node --version`, `npm --version`, `python --version`, `docker version`, and `docker compose version`. Mohammed's native checks used Node 22.21.0, npm 10.9.4 and Python 3.10.10. Use locked manifests and isolated Python environments. Record model/revision, graph/vector/Decision fixtures and Docker image identity for any stack check. Parse all three Compose files before use. Use isolated volumes, ports and credentials. The running July appliance is historical evidence. Store no fixture secrets, accounts, raw outputs, local databases or institutional corpus in a public commit. Bring the published dependency-audit results to P0 review.

## 2. First assignment, independent cleanup review

Mohammed supplies the exact five-file patch privately. Expected SHA-256 is `1d347439e67559f409dd272c6373dd09e5f4f0f335ef5553cb2c045652237c94`. Compare the [cleanup manifest](../CONVERSATIONAL_AGENT_REBUILD/cleanup_manifest.json) and the normalized before/after Git blob IDs in the [planning verification report](planning_verification_report.md). The synchronized source has the before blobs. The patch remains provisional.

1. Create a disposable checkout using `git worktree add --detach ../advisor-cleanup-check 1ffc196b402cad48b0fea7c952d1d7584fce2d05`. In it run the native baseline checks before applying the patch. Confirm its checksum, e.g. `Get-FileHash -Algorithm SHA256 $patchFile`.
2. Run `git apply --check --index $patchFile`, inspect the hunk paths/exports/call sites, and apply with `git apply --index $patchFile` **only inside the disposable checkout**. Compare exactly five staged blob IDs and rerun the affected gates, plus RAG and Decision checks. Verify unchanged routing, initialization, errors, public output and graph/Decision evidence behavior. Stop on scope or SHA drift, live-data contact or a changed behavior. A successful apply check is not a review approval.
3. Record one disposition per file with the exact baseline, before/after blob IDs, scope, test commands, actual outcomes and caveats. Use the future AUDIT output path below. Commit only the review report on `claude/p0-cleanup-review` and submit it for Mohammed’s review. Keep provisional source edits out of any public branch. If the patch is missing or rejected, report the blocker and wait for an explicit P0 decision. Mohammed admits an accepted cleanup and records the signed P0 SHA.

## 3. Your permitted tasks and acceptance conditions

### P0 / AUDIT

Start after BASE. Independently review five cleanup diffs on machine 2. Inspect exports, call sites and dependency usage. Run paired clean/cleaned checks and identify authoritative synthetic passage and edge controls.

Proposed report to create:

- `research/conversation-baseline/cleanup-review.md`

**Acceptance.** Five signed dispositions with before/after blob IDs, commands and outcomes. Each positive fixture has a known ID/version, each missing administrative fact is labeled. Any overlapping or behavioral hunk blocks acceptance. Apply gates BASELINE, NATIVE.

### P2 / GRAPH

Start after FREEZE. Adapt exact and semantic graph retrieval to the frozen part and execution options. Match target, relation and direction, carry rejection/status events, bound queries and close sessions on abort. Preserve broad general queries and graph visualization.

Permitted source and test paths:

- `aast-ai-agent-main/backend/services/neo4jcontext.js`
- `aast-ai-agent-main/backend/testing/kgReliability.test.js`
- `aast-ai-agent-main/backend/testing/retrievalEntityAlignment.test.js`

**Acceptance.** Positive typed edge preserves direction and ID. Reject reversed/adjoining entities, semantic substitutes for an exact miss, and prerequisites inferred from RECOMMENDED_AFTER. Empty and timed-out retrieval produce distinct results. Apply gates KG, FAULT.

### P2 / DOC

Start after FREEZE. Keep /search defaults. Carry part scope through Node capability discovery, Python recall, ranking, eligibility and bounded fallback. Propagate budget/abort where supported and cap in-flight synchronous work. Record stable passage, authority and version or reason for absence.

Permitted source and test paths:

- `aast-ai-agent-main/backend/services/ragService.js`
- `aast-ai-agent-main/backend/rag_system/phase3_retriever.py`
- `aast-ai-agent-main/backend/rag_system/test_phase3_retriever.py`
- `aast-ai-agent-main/backend/rag_system/test_rag_readiness.py`

**Acceptance.** D04 calendar and D02 eligibility positives retain approved passage IDs. Procedure/deadline requests abstain without a matching source. Wrong-topic or wrong-week passages fail. Abort cancels queued retries and capability probes. Apply gates RAG, FAULT.

### P2 / JUDGE

Start after GRAPH and DOC. Adapt existing fusion, direct-RAG and sentence verifier to accept scoped items. Select by part, authority and version, deduplicate stable IDs within scope, and carry conflict, rejection and claim-to-ID mappings. Build against shared contract examples before the real planner arrives.

Permitted source and test paths:

- `aast-ai-agent-main/backend/services/fusionService.js`
- `aast-ai-agent-main/backend/services/directRagEvidencePolicy.js`
- `aast-ai-agent-main/backend/services/groundingVerificationService.js`
- `evaluation/contracts/retrieval/entity-evidence.schema.json`
- `evaluation/contracts/retrieval/grounding-result.schema.json`
- `aast-ai-agent-main/backend/testing/fusionEvidenceContract.test.js`
- `aast-ai-agent-main/backend/testing/groundingVerification.test.js`

**Acceptance.** A complete, missing and conflicting part survive independently. Every supported institutional sentence cites selected evidence from its part. History and score alone cannot support facts. Existing single-part and legacy callers pass. Apply gates EVIDENCE, CONTRACT.

### P4 / CASES

Start after PLAN and JUDGE. Qualify both lane outputs at their real contract boundary with positive/negative, bilingual and conflicting-version fixtures. Detect true source absence independently from routing and ranking misses.

Permitted source and test paths:

- `aast-ai-agent-main/backend/testing/retrievalEntityAlignment.test.js`
- `aast-ai-agent-main/backend/testing/fusionEvidenceContract.test.js`
- `aast-ai-agent-main/backend/rag_system/test_phase3_retriever.py`
- `aast-ai-agent-main/backend/rag_system/test_rag_readiness.py`

**Acceptance.** Every P0 evidence failure has a passing positive and a rejecting negative control. E03/D03 keep order, ID and provenance through the real planner and evaluator. Save fixture hashes and a per-part verdict. Apply gates CONTRACT, KG, RAG, EVIDENCE.

### P4 / QUALIFY

Start after CASES. Independently inject adapter delay, unavailable versus empty sources, cancellation and provider degradation with fake clocks, fixed data and deterministic model outcomes. Prepare the blind scoring sheet and comparable latency protocol for the joined candidate.

Permitted source and test paths:

- `aast-ai-agent-main/backend/testing/retrievalEntityAlignment.test.js`
- `aast-ai-agent-main/backend/testing/fusionEvidenceContract.test.js`

**Acceptance.** Oracle distinguishes canceled from unavailable and true negative from dropped candidate. Positive, wrong-source, slow, mixed and bilingual controls all have expected IDs or explicit absence. The final public-stack verdict is reserved for P5. Apply gates FAULT, EVIDENCE.

### P5 / SIGNOFF

Start after CANDIDATE. Independently verify the candidate SHA and digest, evidence links, negative cases, specialized routes, reviewer agreement and rollback on machine 2 or the agreed capacity host. Return a signed recommendation to Mohammed.

Proposed report to create:

- `research/conversation-release/independent-review.md`

**Acceptance.** Two named reviewers record SHA/digest and complete dispositions. A rollback restores health and the three-turn smoke; stable promotion and tagging require separate maintainer authorization. Apply gates REPLAY, STACK.

Start P2 only at the jointly signed P0 integration SHA. GRAPH and DOC can use the frozen examples independently and JUDGE consumes both. Start P4 only after P1/P2 pass the producer-consumer join. Wait for CANDIDATE before SIGNOFF. If a task is blocked, report the dependency, path, observed condition, commit and reproduction immediately via the team’s review channel.

## 4. Preserve both sides of the interface

- `fetchNeo4jContext(query, intent, limit, requestId, lastMessages, options)` and existing retrieval helpers preserve legacy facts, graph payload and method. Apply the signed part scope and remaining budget, validate entity/relationship/direction and keep absence, timeout and cancellation distinct.
- `ragService.search(query, options)` calls FastAPI `POST /search`. Preserve `query`, `top_k`, `category`, `program_level`, `priority_only` and their existing defaults/HTTP behavior. Keep candidate and rejection counts, abstention reason, stable source identifiers, and bounded cancellation. Keep positive calendar/eligibility controls separate from unauthorized or unsupported procedures.
- `fusionService.fuse(queryPayload, routeData, rawResults)`, direct-RAG policy and sentence grounding keep old callers viable. Use the dual-reviewed QueryPlan v1 example to preserve ordered part IDs from selection to claim support. Confirm true absence, conflicts, cancellation, wrong topic and wrong week with independent negatives. History alone cannot support a claim.
- Mohammed owns the public HTTP and response envelope, authentication, CID and memory, router and golden rules, lifecycle, unified answer, frontend, all Decision services, CI, Compose, locks and dependency changes. You may read those modules and run their tests. **Do not edit** those paths, including `aast-ai-agent-main/backend/orchestrator.js`, `services/conversationPriority.js`, `services/brainRouter.js`, `services/unifiedAnswerService.js`, `services/responseFormatter.js`, or `testing/directRagGroundingContract.test.js` within the backend. Let the registered writer make any cross-boundary change after both reviewers agree on version and tests.

## 5. Exact native verification commands

From `aast-ai-agent-main/backend`, run `npm ci` and these scripts individually for P0 and integration. For P2/P4 always run the matching suites and the affected producer/consumer tests.

```text
npm run test:health
npm run test:kg
npm run test:topology
npm run test:auth
npm run test:auth-provisioning
npm run test:admin-proxy
npm run test:golden-cache
npm run test:routing
npm run test:decision
node testing/conversationalIntelligence.test.js
node testing/demoConversationMemory.test.js
node testing/demoConversationFollowup.test.js
node testing/demoConversationAnswer.test.js
node testing/retrievalEntityAlignment.test.js
node testing/groundingVerification.test.js
node testing/fusionEvidenceContract.test.js
node testing/fallbackTruthContract.test.js
node testing/directRagGroundingContract.test.js
```

- RAG, from `aast-ai-agent-main/backend/rag_system`: install the retriever requirements and pytest in its own environment, then run `python -m pytest -p no:cacheprovider -q test_phase3_retriever.py test_rag_readiness.py`.
- Decision, from `college-decision-system-backend`: install `requirements-dev.txt` in its own environment, then run `python scripts/run_delivery_checks.py`.
- Frontend, from `aast-ai-agent-main/frontend`: `npm ci`, `npm test`, `npm run lint`, `node ./node_modules/typescript/bin/tsc --noEmit --project tsconfig.app.json`, and `npm run build`.
- Compose parser from repository root: `docker compose -f docker-compose.yml config --no-interpolate --services`, `docker compose -f docker-compose.appliance.yml config --no-interpolate --services` and `docker compose -f aast-ai-agent-main/backend/rag_system/compose.private-corpus.yml config --no-interpolate --services`. Resolve every named volume and port before any isolated boot.
- For SIGNOFF, confirm the P5 candidate SHA/digest, both reviewers’ findings, all 125 result rows, grounded or explicitly limited replies, owner isolation, matched warmed latency, fault tests, and restoration of prior health and three-turn CID smoke. Any missing identity, repeated failure or failed rollback blocks sign-off.

## 6. Branch, commit and report

Use `claude/p0-cleanup-review`, `claude/p2-evidence`, or `claude/p4-qualification` from the corresponding verified integration head. Verify with `git fetch origin`, `git rev-parse origin/integration/latest-project-baseline`, and `git switch -c <phase-branch> origin/integration/latest-project-baseline`. Attach SIGNOFF to Mohammed’s candidate phase and submit the independent review artifact through the reviewed branch. Stage exact owned paths, run `git diff --cached --check`, and use commits named `type(TASK-ID): description`. Push only your phase branch and open a PR into `integration/latest-project-baseline`. For a fork, use upstream integration as the base and your fork's branch as head. Do not push directly to integration or main, force-push, deploy or amend someone else’s work.

Report the base and tested SHA, fixture/model IDs, task IDs, paths, exact commands, PASS/FAIL/NOT RUN/BLOCKED, new and existing negative controls, residual advisories, and rollback. Report blockers as soon as they are known. A phase is ready when Mohammed accepts the review, observed results match the contract, and all existing callers and paired suites pass.
