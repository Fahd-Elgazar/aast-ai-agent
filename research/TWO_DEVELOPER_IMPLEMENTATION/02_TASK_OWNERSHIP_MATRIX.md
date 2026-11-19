# Task ownership and roadmap reconciliation

| Task | Phase | Accountable | Reviewer | Task days | Depends on | Checks |
|---|---|---|---|---:|---|---|
| BASE | P0 | Mohammed Hassan | Teammate | 1.5 | Approval | BASELINE |
| AUDIT | P0 | Teammate | Mohammed Hassan | 1.5 | BASE | BASELINE NATIVE |
| FREEZE | P0 | Mohammed Hassan | Teammate | 2 | AUDIT | BASELINE NATIVE STACK CONTRACT |
| TRACE | P1 | Mohammed Hassan | Teammate | 1.5 | FREEZE | TRACE AUTH |
| STATE | P1 | Mohammed Hassan | Teammate | 3.5 | TRACE | STATE AUTH |
| PLAN | P1 | Mohammed Hassan | Teammate | 3.5 | STATE | ROUTE STATE |
| GRAPH | P2 | Teammate | Mohammed Hassan | 3 | FREEZE | KG FAULT |
| DOC | P2 | Teammate | Mohammed Hassan | 3 | FREEZE | RAG FAULT |
| JUDGE | P2 | Teammate | Mohammed Hassan | 3 | GRAPH, DOC | EVIDENCE CONTRACT |
| BIND | P3 | Mohammed Hassan | Teammate | 2.5 | PLAN, JUDGE | PUBLIC EVIDENCE STATE |
| VOICE | P3 | Mohammed Hassan | Teammate | 2 | BIND | VOICE PUBLIC |
| BUDGET | P3 | Mohammed Hassan | Teammate | 2.5 | VOICE | FAULT PUBLIC |
| CASES | P4 | Teammate | Mohammed Hassan | 2.5 | PLAN, JUDGE | CONTRACT KG RAG EVIDENCE |
| QUALIFY | P4 | Teammate | Mohammed Hassan | 2 | CASES | FAULT EVIDENCE |
| CANDIDATE | P5 | Mohammed Hassan | Teammate | 2 | BUDGET, QUALIFY | NATIVE STACK REPLAY FAULT |
| SIGNOFF | P5 | Teammate | Mohammed Hassan | 1.5 | CANDIDATE | REPLAY STACK |

## Disposition of the 15 audit tasks

| Old task | New accountable tasks | Change to scope, dependencies or conflict exposure |
|---|---|---|
| T-00 | BASE, FREEZE | Preserve source/profile inventory, add explicit remote reachability, cleaned-source build, baseline rollback and two-host verification before behavior work. |
| T-01 | FREEZE, TRACE | Freeze the trace vocabulary in P0. Put actual emitters on the appropriate side of the adapter boundary. TRACE remains responsible for whole-turn stage accounting. |
| T-02 | AUDIT | Keep independent review apart from source authorship. Pair each approved evidence fixture with an ID or explicit absence. |
| T-10 | STATE | Combine rewrite and storage acceptance so the correct subject cannot disappear one turn after a successful correction. |
| T-11 | STATE | Keep owner binding, normalize legacy state and add concurrent-turn/restart cases to the same STATE task. |
| T-20 | PLAN | Place all early golden/meta gates and final arbitration with the owner of the part planner and orchestrator. |
| T-21 | PLAN | Decompose before classification. Share fixtures before implementation, then run real producer/consumer handshake after P1 and P2. |
| T-30 | GRAPH | Retain exact graph helpers, add directed eligibility, scope and adapter-side budgeting. Graph and document tasks can start from the same freeze. |
| T-31 | DOC | Remove the technical graph prerequisite. Python already returns rejection/abstention counts. Test recall, eligibility and Node reranking separately. |
| T-40 | JUDGE | Reuse existing fusion/grounding schemas and methods. Integrate against a frozen sample plan without waiting for finished planner code. |
| T-41 | BIND | Explicitly include browser response adoption and all direct/early replies. Keep the shared direct-RAG contract test with Mohammed. |
| T-50 | VOICE | Keep meta dispatcher and generator with the presenter. Rephrase operates on previously supported claims, with bilingual and brevity controls. |
| T-60 | GRAPH, DOC, BUDGET, QUALIFY | Split adapter cancellation (GRAPH/DOC) from request lifecycle (BUDGET) and independent fault injection (QUALIFY). This avoids last-minute cross-owner edits. |
| T-61 | CASES, QUALIFY | Move independent negative controls into P4 as soon as both lower layers merge. Candidate-level checks still wait for the real public layer. |
| T-70 | FREEZE, CANDIDATE, SIGNOFF | Move baseline full-stack verification earlier. Keep actual source/digest release and rollback drill in P5 with independent sign-off. |

For each mapped task, the [phase cards](01_PHASE_BREAKDOWN_AND_OWNERSHIP.md) identify concrete implementation and test files, prerequisites, expected changes, risks and reversal. The [contracts](04_SHARED_INTERFACE_CONTRACTS.md) describe existing callers and required producer/consumer behavior. The same mapping is stored with the tasks in the JSON register.

## Single-writer file register

One name means one editor for the whole project. The other developer can read, run and review its tests. A PR that needs another owner's file requests a dependent owner change or a recorded transfer before any edit.

| Repository path | Writer | Tasks using that write permission |
|---|---|---|
| `.github/workflows/ci.yml` | Mohammed Hassan | CANDIDATE |
| `aast-ai-agent-main/backend/config/goldenPathRegistry.js` | Mohammed Hassan | PLAN |
| `aast-ai-agent-main/backend/config/runtimeMode.js` | Mohammed Hassan | BUDGET |
| `aast-ai-agent-main/backend/orchestrator.js` | Mohammed Hassan | TRACE, PLAN, BIND, BUDGET |
| `aast-ai-agent-main/backend/rag_system/phase3_retriever.py` | Teammate | DOC |
| `aast-ai-agent-main/backend/rag_system/test_phase3_retriever.py` | Teammate | DOC, CASES |
| `aast-ai-agent-main/backend/rag_system/test_rag_readiness.py` | Teammate | DOC, CASES |
| `aast-ai-agent-main/backend/services/brainRouter.js` | Mohammed Hassan | PLAN |
| `aast-ai-agent-main/backend/services/circuitStateManager.js` | Mohammed Hassan | BUDGET |
| `aast-ai-agent-main/backend/services/conversationMetaIntent.js` | Mohammed Hassan | PLAN, VOICE |
| `aast-ai-agent-main/backend/services/conversationPriority.js` | Mohammed Hassan | STATE, PLAN |
| `aast-ai-agent-main/backend/services/conversationService.js` | Mohammed Hassan | STATE |
| `aast-ai-agent-main/backend/services/conversationalHumanizer.js` | Mohammed Hassan | VOICE |
| `aast-ai-agent-main/backend/services/directRagEvidencePolicy.js` | Teammate | JUDGE |
| `aast-ai-agent-main/backend/services/fusionService.js` | Teammate | JUDGE |
| `aast-ai-agent-main/backend/services/goldenCachePolicy.js` | Mohammed Hassan | PLAN |
| `aast-ai-agent-main/backend/services/groundingVerificationService.js` | Teammate | JUDGE |
| `aast-ai-agent-main/backend/services/healthMonitor.js` | Mohammed Hassan | BUDGET |
| `aast-ai-agent-main/backend/services/logger.js` | Mohammed Hassan | TRACE |
| `aast-ai-agent-main/backend/services/metrics.js` | Mohammed Hassan | TRACE |
| `aast-ai-agent-main/backend/services/neo4jcontext.js` | Teammate | GRAPH |
| `aast-ai-agent-main/backend/services/ollamaService.js` | Mohammed Hassan | BUDGET |
| `aast-ai-agent-main/backend/services/persistenceLayer.js` | Mohammed Hassan | STATE |
| `aast-ai-agent-main/backend/services/ragService.js` | Teammate | DOC |
| `aast-ai-agent-main/backend/services/responseFormatter.js` | Mohammed Hassan | BIND |
| `aast-ai-agent-main/backend/services/unifiedAnswerService.js` | Mohammed Hassan | VOICE |
| `aast-ai-agent-main/backend/testing/authIsolation.test.js` | Mohammed Hassan | STATE |
| `aast-ai-agent-main/backend/testing/conversationalIntelligence.test.js` | Mohammed Hassan | TRACE, STATE, PLAN |
| `aast-ai-agent-main/backend/testing/demoConversationAnswer.test.js` | Mohammed Hassan | VOICE |
| `aast-ai-agent-main/backend/testing/demoConversationFollowup.test.js` | Mohammed Hassan | STATE |
| `aast-ai-agent-main/backend/testing/demoConversationMemory.test.js` | Mohammed Hassan | STATE |
| `aast-ai-agent-main/backend/testing/directRagGroundingContract.test.js` | Mohammed Hassan | BIND |
| `aast-ai-agent-main/backend/testing/fallbackTruthContract.test.js` | Mohammed Hassan | BUDGET |
| `aast-ai-agent-main/backend/testing/fusionEvidenceContract.test.js` | Teammate | JUDGE, CASES, QUALIFY |
| `aast-ai-agent-main/backend/testing/groundingVerification.test.js` | Teammate | JUDGE |
| `aast-ai-agent-main/backend/testing/healthReadiness.test.js` | Mohammed Hassan | BUDGET |
| `aast-ai-agent-main/backend/testing/kgReliability.test.js` | Teammate | GRAPH |
| `aast-ai-agent-main/backend/testing/retrievalEntityAlignment.test.js` | Teammate | GRAPH, CASES, QUALIFY |
| `aast-ai-agent-main/backend/testing/routingPrecisionCalibration.test.js` | Mohammed Hassan | PLAN |
| `aast-ai-agent-main/frontend/src/components/ChatMessage.tsx` | Mohammed Hassan | BIND, VOICE |
| `aast-ai-agent-main/frontend/src/components/pages/AdvisorPage.tsx` | Mohammed Hassan | BIND |
| `aast-ai-agent-main/frontend/src/services/agentService.ts` | Mohammed Hassan | BUDGET |
| `aast-ai-agent-main/frontend/src/services/httpClient.ts` | Mohammed Hassan | BUDGET |
| `aast-ai-agent-main/frontend/src/types.ts` | Mohammed Hassan | BIND |
| `aast-ai-agent-main/frontend/testing/frontendCorrectness.test.ts` | Mohammed Hassan | BIND |
| `appliance/Dockerfile` | Mohammed Hassan | CANDIDATE |
| `appliance/README.md` | Mohammed Hassan | CANDIDATE |
| `docker-compose.appliance.yml` | Mohammed Hassan | CANDIDATE |
| `docker-compose.yml` | Mohammed Hassan | CANDIDATE |
| `evaluation/contracts/retrieval/advisor-v1.examples.json` (proposed) | Mohammed Hassan | FREEZE |
| `evaluation/contracts/retrieval/entity-evidence.schema.json` | Teammate | JUDGE |
| `evaluation/contracts/retrieval/grounding-result.schema.json` | Teammate | JUDGE |
| `research/conversation-baseline/cleanup-review.md` (proposed) | Teammate | AUDIT |
| `research/conversation-baseline/freeze.md` (proposed) | Mohammed Hassan | FREEZE |
| `research/conversation-baseline/profile.json` (proposed) | Mohammed Hassan | BASE |
| `research/conversation-baseline/replay.json` (proposed) | Mohammed Hassan | BASE |
| `research/conversation-release/candidate.md` (proposed) | Mohammed Hassan | CANDIDATE |
| `research/conversation-release/independent-review.md` (proposed) | Teammate | SIGNOFF |

The cleanup paths are read-only during AUDIT. The separately approved clean patch has its own review process. The ownership list limits *future* writes. Existing unrelated Markdown edits, manuscript, historic assessments, classifier experiments, production data, ingestion/indexes, Decision schemas and role policy stay outside the change set.
