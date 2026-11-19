# Dependency-Ordered Workstreams

## Execution graph

```text
Truthful data/config contract
  -> data-aware readiness
  -> clean build/deployment and recovery proof

Truthful Decision contract
  -> Node/API adapter semantics
  -> frontend error/empty semantics

Shared request deadline
  -> cancellation and capacity retention
  -> admission/load validation

Exact entity and final route arbitration
  -> retrieval acceptance and grounding
  -> canonical evidence/citations/confidence
  -> answer completeness and conversation continuity

All independent fixes
  -> integration gate
  -> fresh-volume Docker test
  -> failure-path matrix
  -> new audit and issue-ledger reconciliation
```

## Workstream A — Decision truth contract

**Issues:** historical HC-04, HC-07, HH-12; active M-007.

**Root cause:** Ranking, explanation, Node normalization, and frontend fallback
layers independently invent or reinterpret recommendation data.

**Owned files:**

- `college-decision-system-backend/app/application/use_cases/recommend_programs.py`
- Decision schemas/router/readiness tests needed for the contract
- `aast-ai-agent-main/backend/services/decisionService.js`
- `aast-ai-agent-main/backend/routes/decision.js`
- `aast-ai-agent-main/frontend/src/decision/**`
- `aast-ai-agent-main/frontend/src/services/decisionApi.ts`

**First acceptance:** One ranking-weight source of truth; no fabricated
recommendations, alternatives, fees, scores, pros, risks, or roadmaps; truthful
HTTP/error/empty semantics; focused Python, Node, and frontend tests.

**Isolation:** Dedicated worktree and branch. Must not modify orchestrator,
RAG/KG, chat frontend, Compose, or the master ledger.

## Workstream B — RAG evidence and readiness

**Issues:** H-004, CQ-09, CQ-10, CQ-14 through CQ-16, CQ-19, historical HC-05,
HC-06, HH-03, HH-07, HH-08, HH-22, HM-09 through HM-11.

**Root cause:** Corpus/build inputs are private and undefined, readiness is
connectivity-oriented, and evidence/citation schemas diverge across layers.

**Owned files:**

- `aast-ai-agent-main/backend/rag_system/**`
- `aast-ai-agent-main/backend/services/ragService.js`
- RAG-focused tests and benchmark fixtures
- `aast-ai-agent-main/backend/rag_system/Dockerfile.retriever`

**First acceptance:** Build does not blindly require an absent ignored asset;
startup/readiness truthfully identifies a missing configured collection or
empty data; current rerank/abstention tests are an executable gate; no model or
corpus claims are invented.

**Isolation:** Dedicated worktree and branch. Must not modify orchestrator,
Unified Answer, frontend, Decision system, root Compose, or the master ledger.

## Workstream C — Frontend request correctness

**Issues:** H-001 frontend half, historical HH-13, HM-16, truthful error UI.

**Root cause:** Requests are not consistently correlated to the currently
selected conversation/profile, cancellation is local and incomplete, and
local history is unbounded.

**Owned files:**

- `aast-ai-agent-main/frontend/src/components/pages/AdvisorPage.tsx`
- `aast-ai-agent-main/frontend/src/components/ConversationHistorySidebar.tsx`
- `aast-ai-agent-main/frontend/src/services/httpClient.ts`
- `agentService.ts`, `backendService.ts`, and `conversationsApi.ts`
- focused frontend tests

**First acceptance:** A response cannot be appended to the wrong conversation;
superseded requests are cancelled/ignored; timeout/error UI is truthful; local
history has an explicit safe bound.

**Isolation:** Dedicated worktree and branch. Must not modify Decision UI,
backend, RAG/KG, infrastructure, or the master ledger.

## Workstream D — Node integration, routing, grounding, memory

**Issues:** UQ-001, H-001/H-002, H-006, CQ-02 through CQ-08, CQ-11 through
CQ-18, CQ-20, historical HC-02/HC-09, HH-01/HH-02/HH-04 through HH-06,
HH-08/HH-10/HH-11, HM-03/HM-07.

**Root cause:** One central request has multiple bypasses, deadlines, evidence
shapes, confidence transformations, and persistence exits.

**Owned files:**

- `aast-ai-agent-main/backend/orchestrator.js`
- Brain Router, health probes, bounded semaphores, conversation services,
  academic normalization/aliases, Neo4j context, Unified Answer, grounding,
  Fusion, response formatting, and their tests

**First acceptance:** No static factual success after failed retrieval; fast
truthful Calculus evidence gap; one propagated request deadline/abort contract;
canonical route/evidence/citation shapes; confidence derived from grounding;
empty answers persisted; no null timeout fallback.

**Isolation:** Single integration owner. These files are intentionally excluded
from every other initial worktree.

## Workstream E — Infrastructure, persistence, CI, and failure gates

**Issues:** H-004/H-007 through H-012, M-005/M-006/M-008 through M-014,
M-017/M-018/M-020, historical HC-05/HC-06, HH-09/HH-14/HH-16 through HH-25,
HM-04/HM-05/HM-12 through HM-15/HM-17/HM-21.

This begins only after the service contracts above are frozen. It owns root
Compose/appliance/launcher/config/CI/docs and verifies fresh build context,
fresh volumes, startup ordering, data readiness, restart behavior, persistence,
security boundaries, admission, and the complete failure matrix.

## Deferred/non-blocking items

Cosmetic refactoring, service decomposition, frontend bundle optimization,
external observability products, and general architecture modernization do not
precede runtime truth and reproducibility. Existing deferred ledger items stay
deferred unless a blocking dependency is proven.

