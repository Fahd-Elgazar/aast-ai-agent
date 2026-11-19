# Test procedures and acceptance gates

Use these gate keys in the task matrix and phase PRs. Paths and package commands were checked against the August source. Commands below are for future execution in clean developer clones with disposable data. Run each command separately and stop on failure. Record pass, fail or blocked for every required command. A skipped suite or a healthy July appliance cannot satisfy an August gate.

## BASELINE and NATIVE

From repository root record `git rev-parse HEAD`, `git status --short`, lockfile hashes, Python package resolutions, Docker client/daemon and Compose versions, image ID plus OCI revision, and `ollama list` (pin full model digest in profile). Record approved corpus/fixture checksums, graph schema/edge snapshot, Qdrant collection, vector dimension, embedding revision, reranker version, SQLite migration head, device, capacity, model flags and warm state. Keep secrets local. Use fresh node_modules via `npm ci` in each JS package. Use a separate Python environment for retriever and Decision. Install from the respective tracked requirements and capture resolved versions; floating ranges can differ. Archive before/after cleanup gate results independently.

**Backend** · from `aast-ai-agent-main/backend`:

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

**Frontend** · from `aast-ai-agent-main/frontend`: run `npm test`, `npm run lint`, `node ./node_modules/typescript/bin/tsc --noEmit --project tsconfig.app.json` and `npm run build`.

**Python** · in `aast-ai-agent-main/backend/rag_system` run `python -m pytest -p no:cacheprovider -q test_phase3_retriever.py test_rag_readiness.py`. In `college-decision-system-backend`, install its dev requirements in its own environment and run `python scripts/run_delivery_checks.py` against hermetic stores.

## Targeted suites and required assertions

| Key | Existing entry points (names below are relative to backend/testing unless stated) | Add or exercise these cases, with the owning phase |
|---|---|---|
| AUTH | test:auth, test:auth-provisioning, test:admin-proxy, test:decision | Request without valid session, denied foreign CID, two users, legacy sessions, genuine Decision form, forbidden admin and allowed authorized fixture read. |
| TRACE | conversationalIntelligence.test.js, test:health | Trace on/off parity for a fast path, partial, skipped retrieval, failed provider and cancellation. Join resolve → classify → route → retrieve → select → verify → generate/format → persist by one server request ID. |
| STATE | demoConversationMemory.test.js, demoConversationFollowup.test.js, conversationalIntelligence.test.js | S-A01 ordinal/compare, S-B04 correction/next week, S-D03/3 week, fresh CID, ambiguous pair, topic switch/return, reload persisted old state and concurrent same-CID writes. |
| ROUTE | test:routing, test:golden-cache, test:decision | E02 graph sequence vs genuine recommendation, F04 weather vs true recall, D04 calendar, F01 bilingual teaching, E03 same-family split, D03 mixed-source split. Check requested/effective route plus reason. |
| KG | test:kg, retrievalEntityAlignment.test.js | Directed HAS_COURSE and RECOMMENDED_AFTER with distinct formal prerequisite control. Reverse, wrong entity, nearby semantic hit and true absent relationship must fail eligibility. General open-ended retrieval stays useful. |
| RAG | Python suite above, directRagGroundingContract.test.js | Seed synthetic calendar and scholarship eligibility with fixed IDs, dates/versions and known content. Test recall before rank, acceptance after rank and final Node selection. Wrong term, neighboring policy, eligibility offered as an application step and missing deadline must fail. |
| EVIDENCE | fusionEvidenceContract.test.js, groundingVerification.test.js, directRagGroundingContract.test.js | Hybrid, direct and previously verified source challenge; require claim → selected ID → actual approved passage/edge. Cover repeated ID, incompatible authority/version, no sources and history-only. |
| CONTRACT | P0 examples plus conversationalIntelligence.test.js, retrievalEntityAlignment.test.js, fusionEvidenceContract.test.js and directRagGroundingContract.test.js | Each owner tests a real producer against saved examples and the consumer against a fake peer. At each join use real modules and compare outputs including missing/old fields, order, part IDs and rejection reasons. |
| PUBLIC | directRagGroundingContract.test.js, fallbackTruthContract.test.js, full frontend suite above | Test public HTTP envelope on direct, static, hybrid, interactive and fallback paths, then verify React citation rendering, graph, old envelopes, late response, navigation and reopen. |
| VOICE | demoConversationAnswer.test.js, fallbackTruthContract.test.js | Blind-review B01/4, B03/2, E01/4 for requested why/rephrase/example, useful brevity and citation-preserving meaning. Both reviewers mark all three fulfilled. Compare repeated refusal/suffix counts on identical prompts; require fewer generic refusals than matched baseline when present and zero newly fabricated claims. |
| FAULT | test:health, test:kg, fallbackTruthContract.test.js, Python suite and real adapter checks on fixtures | Inject queue delay, slow model, graph timeout, empty/unavailable vector, provider failure, breaker open and browser disconnect. Assert counts before/after deadline, no late memory write or re-enqueue, bounded drain, truthful partial answer; do not retry an aborted/non-idempotent call. |

## STACK and REPLAY

1. Inspect `docker compose -f docker-compose.yml config --no-interpolate --services` and `docker compose -f docker-compose.appliance.yml config --no-interpolate --services`. Before launching an isolated fixture stack inspect the resolved **names only** for every container, port, bind and named volume. The appliance pins 11 volume names, a container name and an image tag. A project name alone does not isolate them. Use a dedicated VM/daemon or an override for every shared resource, a distinct image tag, available port and fixture-only stores. Verify capacity for image + data + model before building. Record version and checksum for any staged authorized fixtures, give both machines read access, and verify test operations cannot reach production writes.
2. Build from the actual candidate tree; record Git SHA, tree status, build parameters, resulting image ID/digest and inspected OCI revision. If current packaging omits revision, supply a build label and verify it on the image. Warm the agreed model. Smoke frontend root, proxied /api/health, Neo4j HTTP and typed read, Qdrant /readyz plus known passage, retriever /health and /search, optional answer service /health, and internal Decision /health plus hermetic role/decision cases. Probe through the same authenticated advisor entry the client uses. Test graph rendering, positive golden/FAQ and legitimate dean/academic queries.
3. BASE/FREEZE prepares a versioned synthetic pack derived from the audit's **actual submitted prompts** (adaptive choices included), expected goals, case/turn IDs, known positives/negatives and allowed gaps. Store its checksum and permitted acquisition mechanism on the approved baseline. Reconstruct it on both machines before starting. P0 captures matched baseline behavior and timing. P5 runs one fixed replay of 25 fresh owned sessions × 5 turns on the candidate. Carry forward only the returned CID per owner; obtain a new request ID each turn. A separately marked adaptive exploration can help diagnosis and must not replace fixed turns. Never run the historical 470-query study for these gates.
4. Record all 125 expected rows, including blocked cases. Use pass/partial/fail/warranted limitation/blocked and record raw counts per family, case IDs and stage/reason; never silently drop a timeout. Require 25 stable CIDs, 125 distinct request IDs for processed requests, zero owner leaks, zero unexpected 5xx, zero fabricated requirements, all named P0 assertions green and no previously passing case newly failing without resolution. Every factual institutional claim has selected evidence or is removed with a localized limitation. Two reviewers independently score the P0 and style cases, reconcile disagreements against the evidence and record the decision.
5. For timing use identical hardware, corpus, model digest, model warm-up and concurrency (one user plus one agreed parallel load). Compare median/p95/max, timeouts, fallbacks and queued/in-flight work. Proposed gate: warmed p95 ≤ 1.10 × matched baseline, zero extra post-abort calls and no unbounded background work. Freeze repetition count, sample and tolerance in P0. The July median 302 ms, p95 3,290 ms and max 31,696 ms are context only. Absent verified data, missing matched measurements or inconclusive rollback blocks a release claim.
6. Record fixture hashes, profiled model identity, exact commands, exit codes, timings, reviewers and candidate SHA/digest in the P5 report. Run previous-digest health plus a three-turn same-CID smoke on its compatible snapshot. Record restoration time and evidence. Both must approve promotion.
