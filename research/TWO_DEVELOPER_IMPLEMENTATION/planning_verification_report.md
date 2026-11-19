# Planning verification and baseline record

**19 November 2026.** This report covers source and configuration inspection, audit reconciliation and planning checks. Product implementation, a new cleanup deployment and the historical benchmark were outside this run.

The sections below record the original planning inspection. The [final baseline](14_FINAL_REPOSITORY_BASELINE.md) and [plan validation](15_FINAL_PLAN_VALIDATION_REPORT.md) record synchronization and current test results.

## Authority and Git state

The open materials directory contains the audit and an empty/unusable Git directory. Git discovery there returned “not a git repository.” The authoritative linked checkout is `C:/AI_AGENT_WORKTREES/unified-platform`. It is on branch `unified-platform` at `6367b0df91f208e518fb7e04cd7c81bdb82b9ae4`. The index matched HEAD (zero staged paths). Status showed 53 modified tracked files (48 Markdown plus the five source paths below), and 10 untracked documentation files (nine Markdown and one PDF). That matches the audit's final inventory and patch digests. The audit itself is outside that source tree. The untracked release checklist, reconciliation notes and handoff files are unsuitable as baseline dependencies for a teammate clone. Use the planning pack and new, reviewed phase evidence.

Remote discovery via `git ls-remote --symref origin HEAD 'refs/heads/*'` and `gh repo view` identified public `Fahd-Elgazar/aast-ai-agent`, two pre-existing branch heads, main as default, and WRITE access. Both heads pointed to `3e2f0100254a0d20a9e81b52d28c127d612f9dc1`, the merge base with August. The integrated source has 61 additional commits (264 differing paths). GitHub reported main unprotected. Worktree refs are not remotely transferable by name. A separate planning worktree was created at the published parent so the branch can publish only the authorized plan. The original source/index and cleanup are outside that operation.

| Other local branch(es) at inspection | Tip(s) | Consequence |
|---|---|---|
| reliability-hardening / master | 3e2f0100 / e8db9cc2 | Public snapshot and an older local branch; neither is the implementation base. |
| demo-safety-baseline-20260725 / demo-wow/integration | 753789c5 / 8a2cb60a | Historical comparison only. |
| claude/demo-wow / codex/demo-wow | d19955ee / 35cd4252 | Separate July lane histories. Preserve both. |
| stabilize/conversation-routing | 70a7652e | Nine unique patch IDs against August. Inspect behavior per owner, especially R01, which persisted at that tip. |
| stabilize/request-cancellation / stabilize/admission-control | 5e144b7d / 8a9ea398 | Review relevant diffs in GRAPH, DOC and BUDGET. Select only after fault tests. |
| stabilize/dependency-security / stabilize/frontend-correctness | fb1dc366 / 5a8d857a | Compare locks and UI state/response behavior. Do not replay entire branches. |
| stabilize/decision-truth / stabilize/rag-readiness | b3ee4fec / 789e6264 | git cherry HEAD reports three and two equivalent patches respectively. Verify existing gates before changing code. |

## Unstaged cleanup fingerprint

The five working files match every manifest after-SHA-256. The scoped diff totals five insertions and 272 deletions; the hunk boundaries match C00–C03. For portability use Git-filtered blob IDs across machines; raw hashes can differ with checkout EOLs. The table identifies code for later independent review without including or publishing a patch.

| Group and path | Parent blob | Cleaned blob | Observed change |
|---|---|---|---|
| C00 · `aast-ai-agent-main/backend/orchestrator.js` | `10d0ee2aaf4cb97b0efd58e996d4a4d56136af6a` | `31856fa48cca6894b67bc1d9bceb66ef55931dfb` | Remove unused getSession import binding, preserve connectNeo4j. |
| C01 · `aast-ai-agent-main/backend/services/neo4jcontext.js` | `dbb66a04b800d40bb84d779cabfe1f8622e2d709` | `3a9d40af5a53047fcb8e3542da65687d1941b14d` | Remove private uncalled formatter, unused refinement local and unused constant. |
| C02 · `aast-ai-agent-main/backend/services/decisionService.js` | `9a684b575a414d7ecd1407a9d9a264342223b18e` | `31e52926a7f764ad4e3898303ec39a5222485ed9` | Remove six private unreachable career heuristics and the heading directly preceding them. Keep buildCareerRoadmap and all exports. |
| C03 · `aast-ai-agent-main/backend/rag_system/phase3_retriever.py` | `c61d513551f9b2f98461e8e15ea490554d921d95` | `d1b2a374c3d5946cc0d4ae43730732928c23c962` | Remove the unused exception aliases in search and benchmark handlers. |
| C03 · `aast-ai-agent-main/backend/rag_system/phase4_llm_answer_engine.py` | `7076c565dd33f43c7e3e678920d5600a012162a7` | `738f8abbb80a6e6554a843670ea89c579f8cb5ef` | Remove unused HTTPException import and unused exception alias in answer handler. |

## Runtime and dependencies

| Read-only inspection | Observation and implication |
|---|---|
| Running appliance | Docker CLI/daemon 28.5.1 and Compose 2.40.0-desktop.1. Container reported healthy. Image ID `sha256:13b75b6fd0ed9c841d121e4d35ce96e883e18be9e3d12031b9b6af732ac08257`, inspected OCI source `4a38cf5f9969e893cf04a39e1306a74cc8fbe939`. Other cached tags do not establish what served a request. |
| Compose services | Standalone resolves frontend, backend, decision-api, rag-retriever, rag-answer, qdrant and neo4j. Appliance resolves one supervised container; Ollama is external. Separate standalone Decision containers also run. Qdrant v1.12.5 local image ID begins 05fecce7dce4; Neo4j 5.26-community begins 0b5d3ab6ec1b. Do not attribute those standalone images to the supervised appliance. |
| Capacity and isolation | Current sample about 12.4 GiB free disk and 4 GiB available host RAM, higher than the audit sample. Capacity for a second fixture image, volumes and warmed model still needs measurement. Config pins container name, eleven named volumes and a local env file. Validate all names on a dedicated daemon/VM or a complete isolated override. |
| Client/server runtime | Local Node 22.21.0/npm 10.9.4. Frontend React 19, locked Vite 8.1.3; backend locked Express 4.22.2, Neo4j driver and Axios. Each JS package has its own lockfile. Run npm ci in clean checkouts. Keep existing HTTP/timeout semantics during integration. |
| Python | Default Python 3.10.10, installed 3.11.9. Host 3.10 reports pytest 9.0.2, FastAPI 0.128.0, qdrant-client 1.17.1, sentence-transformers 5.2.3. Retriever requirements specify FastAPI 0.111.0, qdrant-client 1.9.1 and sentence-transformers 3.0.1. Reproduce from service-specific environments. A green native test against the host interpreter does not identify the production dependency set. Decision uses Alembic and dev requirements with looser bounds. |
| Models and data | Local Ollama list showed gemma4:e2b (2cf98652fdc6), tinyllama:latest (2644915ede35) and nomic-embed-text:latest (0a109f422b47). These are installed short identities. Integrated default generation is Gemma, configurable Gemini backup, LLM intent and Gemini humanization disabled by default. Per-turn provider use is unverified. KG semantic search uses a separate embedding space. Python retriever expects BAAI/bge-m3, 1024 dimensions, cosine and readiness payload fields. Neo4j graph snapshot, Qdrant payload/collection version, model revisions, Decision SQLite catalog and owner-scoped chat persistence must be pinned or isolated. The historical 184-point collection is evidence about July only. |
| CI | One tracked .github/workflows/ci.yml. Push/PR frontend job on Node 20 runs lint/build; backend job on Node 20 runs health, KG, topology, auth, admin proxy, golden cache and routing; Decision job on Python 3.11 runs hermetic delivery. Frontend behavioral tests include Node type stripping, while existing CI only builds/lints. Pin a compatible exact Node for the expanded suite. Add missing focused tests, RAG, Decision truth and cross-lane contract gates or require recorded external results until CI covers them. No deployed-candidate validation job found. |

## Diagnostic and source reconciliation

Reviewed the master report, reports 01–19, the cleanup and task manifests, synthetic scenario definitions, recorded turn rows and failure catalog. Recounted 25 scenarios, 125 submitted turns, 125 unique server IDs, 25 CIDs, zero CID changes, 523 operational events and 31 routing-audit entries. Dispositions were 89 partial/fail, 30 consistent, five appropriate limitations and one unresolved. These are targeted observations. Lack of candidate traces precludes assigning every July loss to vector scoring. Native before/after cleanup checks in the audit are historical results. They are not fresh exact-revision full-stack evidence.

Spot checks of August entry points covered frontend askAgent/AdvisorPage, public formatting and citation defaults, Express handleChatbotQuery, resolveFollowUpReference, owner-scoped memory normalization, per-intent splitting, router and early returns, graph exact/alignment helpers, Python SearchRequest/rank_gate_select, Node ragService.search, FusionService.fuse, grounding schemas, generateUnifiedAnswer and Decision delivery. Path references in this pack describe the integrated source; public planning main does not contain the full August tree. Files designated “proposed” are future deliverables and are not prerequisites for reading the prompts. The current tracked Decision/RAG improvements, exact-match helpers and grounding machinery narrow the new implementation scope. No generic rewrite or additional dead-code deletion is assigned.

## Plan consistency checks

The validation procedure parses both JSON files, checks unique task IDs, one primary owner per file and task, reviewer separation, complete legacy mapping, acyclic dependencies, concordance with the standalone diagram, effort totals and all existing write paths at the canonical commit. It also checks relative planning links, byte-equivalence of both prompt-name variants, complete output inventory and the docs-only Git diff. Mermaid is rendered independently. Publication is verified by matching the remote ref and the fetched commit tree; the final delivery records the published SHA.

| Challenge | Resolution or open gate |
|---|---|
| Shared files under two writers? | Direct-RAG test is Mohammed's even when the teammate runs it. Schema files belong to the teammate. Protected integration/Compose/CI have one writer. |
| Can work really overlap? | Two waves have disjoint paths and signed mocks. GRAPH/DOC are technically independent but share one person. P0 and P5 require joint evidence. |
| Is the handoff self-contained? | Both prompts include context, own task IDs, file limits, tests, Git and blocker protocol. P0 provisions approved fixtures and both code accounts. No untracked local document is needed. |
| Could passing July tests or missing data hide a release failure? | Require cleaned baseline and candidate on identical profile; missing positive controls, identity mismatch, unsupported claims and rollback failures block acceptance. |
| Could evaluation duplicate existing work? | Test the integrated helper before changing it; keep a passing original positive as regression. Match all 15 audit tasks to the new execution units. Preserve specialty routes and earlier user edits. |
| Is the split balanced? | Serial central-file writes remain with Mohammed; teammate owns complete evidence path, adapter fault behavior and independent verification. Review overhead is budgeted separately. |

**Local validation result:** passed. Parsed 16 unique work items and 19 directed dependency edges, reconciled all 15 legacy tasks, verified one writer across 58 paths and compared existing paths to the 468 tracked files at the canonical commit. Both JSON files, relative document links, prompt assignments, prompt aliases and both 17-file copies passed. All 89 catalog failures joined to their recorded turn/request IDs. Mermaid CLI rendered the standalone graph as SVG. Rechecked source index and cleanup hashes after creating the isolated planning worktree.

## Planning artifact allowlist

Both unnumbered prompt files are exact copies of their numbered deliverables so either requested filename can be pasted directly.

- `00_MASTER_IMPLEMENTATION_STRATEGY.md`
- `01_PHASE_BREAKDOWN_AND_OWNERSHIP.md`
- `02_TASK_OWNERSHIP_MATRIX.md`
- `03_DEPENDENCY_AND_PARALLELIZATION_PLAN.md`
- `04_SHARED_INTERFACE_CONTRACTS.md`
- `05_GITHUB_BRANCH_AND_MERGE_WORKFLOW.md`
- `06_TESTING_AND_ACCEPTANCE_GATES.md`
- `07_INTEGRATION_AND_RELEASE_PLAN.md`
- `08_CLAUDE_CODE_TEAMMATE_IMPLEMENTATION_PROMPT.md`
- `09_CODEX_MOHAMMED_IMPLEMENTATION_PROMPT.md`
- `10_INITIAL_ACTIONS_FOR_BOTH_DEVELOPERS.md`
- `CLAUDE_CODE_TEAMMATE_IMPLEMENTATION_PROMPT.md`
- `CODEX_MOHAMMED_IMPLEMENTATION_PROMPT.md`
- `dependency_graph.mmd`
- `implementation_plan.json`
- `planning_verification_report.md`
- `task_ownership.json`
