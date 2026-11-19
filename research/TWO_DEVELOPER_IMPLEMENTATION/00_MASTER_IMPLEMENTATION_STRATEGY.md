# Two-developer implementation strategy

**Recommendation for Mohammed Hassan and the teammate · 19 November 2026**

Use six phases with two joint decisions and two periods of independent implementation. Mohammed owns the authenticated advisor from session state through public response. The teammate owns the graph/document adapters, evidence adjudication and independent fixture qualification. The owner follows the call boundary and the files that must change together. Either coding tool can run the same tests.

| Order | Mohammed / Codex | Teammate / Claude Code | Exit |
|---|---|---|---|
| P0, joint, Mohammed accountable | Establish approved source/ref, isolated cleaned baseline and contract examples | Independently review five files and reproduce fixture/profile checks | Both sign the same revision and examples |
| P1 and P2 | P1 builds turn plans, state, scope and trace | P2 produces evidence and adjudication from frozen example plans | Both phase PRs green, real planner/adapter handshake |
| P3 and P4 | P3 wires every answer path, browser, grounded transformations and cancellation | P4 verifies cross-lane evidence and fault behavior | Both phase PRs green, fault and compatibility checks |
| P5, joint, Mohammed accountable | Build and verify candidate, lead rollback and release decision | Independently score and attest to that candidate | Two signatures, verified rollback and maintainer approval |

**Estimate:** 37.5 task engineer-days plus two days per person for cross-review and coordination, or **41.5 engineer-days**. Mohammed has 23 days including review; the teammate has 18.5. The central orchestrator, frontend and release binding make Mohammed's load heavier. The teammate takes adapter-side cancellation, fixture design and independent fault qualification to reduce contention. Approximate elapsed time is 26–30 working days with two available full-time developers, one capacity-qualified machine and prompt reviews. Access, unavailable datasets, model downloads and release approval can extend the calendar. Before review overhead, the resource-constrained path is P0 (5 days), slower of P1/P2 (9), slower of P3/P4 (7), P5 (3.5). A phase is a reviewable exit, not a sprint of fixed duration.

## Why this division

| Candidate | Independent work and balance | Integration, testing and conflicts | Elapsed estimate under the same staffing |
|---|---|---|---|
| Prior eight serial milestones | Old records assign 24.5 days to Codex and 12 to Claude before review. Separate context, intent and reply phases still edit the same orchestrator. | Fifteen-step queue delays graph/document work and independent fixtures. Strong issue-level tests, weak overlap if every listed merge is a prerequisite. | About 37–41 days if the queue is run sequentially; some design can overlap. |
| Four service tiers (baseline, Node vs Python/React, join, release) | Apparent language independence. Actual retrieval and scope arbitration both cross Node; React workload is smaller than the orchestrator. | Splits Node adapter from Python ranker and adjudication from answer caller. Both owners need the same routing/grounding test seam. Expensive late E2E diagnosis. | Roughly 28–35 days allowing rework at the join. |
| Risk-first vertical slices (one owner per failure family) | Independent case writing is easy; the P0 intent, source and attribution fixes all converge in early returns. | Competing orchestrator edits and duplicated fixtures. Individual cases can pass while combined parts regress. | Roughly 29–36 days including serialized integration. |
| Six phases, dependency and module ownership | Two disjoint implementation pairs. Fake producers/consumers unblock each developer at freeze. The join tests the real pair before response work. | One writer per tracked path, two explicit joins, one owner per task. Every issue has a local test and an integrated release gate. | 26–30 days, with assumptions above. |

These are planning estimates. The actual project exposes two expensive joins: plan-to-evidence and adjudication-to-user-visible behavior. Fewer checkpoints defer those failures to release. More checkpoints serialize changes that can already be tested together.

## What the plan is trying to fix

The July appliance served 125 turns across 25 synthetic conversations. In 89 turns the audit found a partial or missed request. S-A01/4 retained Data Science as the referent but replaced a Machine Learning question with a careers question. That rewrite reproduced on July, August and the conversation-routing tip. Stable conversation IDs locate this defect above transport. Evidence-selection failures need finer attribution: the existence of a calendar passage proves availability on the July snapshot, not the stage at which later turns lost it. Existing August eligibility, grounding and readiness checks are starting points. Reproduce each behavior on the cleaned baseline before modifying it. Preserve cases that already pass as regression tests and record the disposition.

## Decisions and blockers

| Decision | Accountable person | Required evidence and deadline |
|---|---|---|
| Use one authorized GitHub implementation repository for both machines | Mohammed | Public planning branch is documentation only. Select an access-controlled common code repository, or authorize a publishable equivalent baseline after reviewing its contents and history. Both accounts must fetch the identical approved SHA before P0 exits. |
| Admit the cleanup and distribute the synthetic inputs | Teammate reviews, Mohammed controls transport | Review exact five-file diff and hashes independently. Provide both accounts a versioned, authorized synthetic replay pack and isolated graph/document controls. Do not transfer private corpora, credentials, working stores or unreviewed history to the public remote. |
| Full-stack cleaned baseline vs July runtime | Mohammed | Before feature development, build cleaned source and record image, model and fixture fingerprints, reachable services, guest smoke and rollback reference. If either machine lacks capacity, reserve an isolated host for heavyweight tests and still run local contract checks on both. |
| Future fees, application procedure/deadline and calendar scope | Teammate | Fixture ground truth must identify authority and effective version. A missing source becomes a localized gap. A missing *positive control* blocks that test from passing. |
| Latency and public interface | Both sign; Mohammed records | Agree warmed concurrency, threshold, budget caps and optional fields before P1/P2. Default public envelope stays compatible. Audit timing is historical; benchmark candidate against the matched cleaned source. |
| Historical branches and legacy consumers | Per-file owner | Compare relevant patch IDs, symbols and regression cases. Treat Decision/RAG equivalents as already integrated until a failing test proves otherwise. Defer CLI/export/data migration and dependency upgrades outside these fixes. |

Start by opening the [two-machine action sheet](10_INITIAL_ACTIONS_FOR_BOTH_DEVELOPERS.md). Use the [phase cards](01_PHASE_BREAKDOWN_AND_OWNERSHIP.md), [task map](02_TASK_OWNERSHIP_MATRIX.md), [dependency plan](03_DEPENDENCY_AND_PARALLELIZATION_PLAN.md), [contract freeze](04_SHARED_INTERFACE_CONTRACTS.md), [Git workflow](05_GITHUB_BRANCH_AND_MERGE_WORKFLOW.md), [verification gates](06_TESTING_AND_ACCEPTANCE_GATES.md) and [release procedure](07_INTEGRATION_AND_RELEASE_PLAN.md) as the implementation agreement. The [inspection record](planning_verification_report.md) distinguishes observations from pending gates.
