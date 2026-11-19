# Two-developer work split

**Stage H · one owner and one reviewer for every task**

| Developer | Initial action | Accountable paths |
|---|---|---|
| Developer 1 · Codex, primary machine | Open T-00 and prepare exact canonical base and uncommitted cleanup patch for review. Start T-01 after the profile contract is recorded. | `aast-ai-agent-main/backend/orchestrator.js`, priority/meta/memory/router, auth/persistence, response envelope, frontend, runtime orchestration, CI and final verification. |
| Developer 2 · Claude Code, second machine | After T-00 resolves an exact copy, begin T-02 independent cleanup review and prepare evidence fixtures. Review T-01/T-10 trace and planner contract. | `aast-ai-agent-main/backend/services/neo4jcontext.js`, `ragService.js`, `fusionService.js`, `directRagEvidencePolicy.js`, grounded evidence contract/support and Python retrieval tests while owned. |

[Task-by-task responsibility matrix](implementation_tasks.json) lists owner and reviewer, exact file paths, interface change, dependencies, acceptance criteria, exact tests and integer merge sequence for every task. The [human-readable roadmap](16_MASTER_IMPLEMENTATION_ROADMAP.md) summarizes order. Claude Code was unavailable on the primary machine. This handoff assigns the review to the second developer.

## Parallel lanes and shared edits

- After T-00, D1 owns T-01 instrumentation and D2 owns T-02 read-only review and separately staged fixtures. D2 can formalize positive/negative adapter fixtures while D1 implements T-10/T-11. T-30/T-31 implementation can work against the reviewed draft interface only when file ownership is disjoint. T-21 plan freeze gates integration.
- Keep `orchestrator.js`, `conversationPriority.js`, `brainRouter.js` and `persistenceLayer.js` single-writer across all D1 tasks. Order T-01 → T-10 → T-11 → T-20 → T-21. D2 reviews boundary changes without editing them.
- D2 owns evidence sources and schemas for T-30/T-31/T-40. At the T-40 freeze D1 reviews `EvidenceItem`, `Adjudication` and fallback reason names. T-41 begins after the freeze. `directRagGroundingContract.test.js` remains owned by D1 during T-41. D2 uses it read-only during T-02/T-31/T-40.
- T-61 can collect cases during T-41/T-50 if its fixture/test paths are disjoint. It merges after T-60. Treat reused test fixtures as locked with an announced owner until a written handoff.
- The integration owner is D1. Both developers acknowledge three checkpoints in order. First the base and trace agreement, then QueryPlan/routing with both adapters, then adjudication, public response and release acceptance. D1 controls T-70 Compose/CI changes and promotions. D2 reviews each shared change first.

## Two-machine contract

- Canonical base is the `unified-platform` branch at `6367b0df91f208e518fb7e04cd7c81bdb82b9ae4` with C00–C03 reviewed as a separate patch. Self-check with `git rev-parse HEAD` and the five hashes. Create separate task branches or worktrees after the two machines can resolve the agreed base. Keep the pre-existing local docs out of task diffs. No assumption that remote-tracking refs or local branches are accessible from machine 2.
- Preferred Windows profile is `docker-compose.appliance.yml` with checked-in names-only config and pinned image label for any runtime replay. Native and standalone profiles are useful for isolated gates. Capture OS, Docker and Compose, Node/npm/Python, GPU/VRAM, free disk, model availability, embedding identity, profile flags, dataset fingerprint and health. Plaintext secrets and env values are supplied locally.
- Run against separate temporary database/store namespaces plus synthetic fixtures. Use fixture IDs and hashes across machines. Never point either developer’s test profile at shared writable production data. Replay against the same snapshot for comparisons. Report unavailable live data separately from fixture results.
- Before each merge queue handoff give the base, branch and task ID, affected paths, contract diff, exact commands, status and known failure, synthetic artifacts and rollback diff. Reviewer checks dependency order, downstream compatibility and exact source test. After merge rerun downstream gate and record the integrated SHA. [Baseline and risk](19_OPEN_DECISIONS_AND_BLOCKERS.md)
