# AAST conversational agent diagnosis and rebuild

**19 November 2026 · diagnosis, verified cleanup and implementation handoff**

The current advisor sometimes **answers a different question from the one the student asked**. A confirmed example is S-A01/4. The resolver correctly identified Data Science as “the other one,” replaced the question about Machine Learning with a careers question and activated the careers fast path. The same rewrite reproduced against the July appliance source, August integrated source and conversation-stabilization branch. Golden/meta rules, broad evidence selection and incomplete citations can compound these mistakes. [Root causes and reproductions](06_ROOT_CAUSE_ANALYSIS.md)

The July appliance completed **25 synthetic conversations and 125 turns** through its authenticated advisor endpoint, with 25 distinct conversation IDs and no changes within a session. Against their specific intended behaviors, 89 replies missed or partly missed the request, 30 were consistent, 5 appropriately limited the answer and 1 was inconclusive. This diagnostic surfaces failure modes for engineering. It does not estimate general assistant accuracy. [Transcripts](04_CONVERSATION_TRANSCRIPTS.md) · [Synthetic replay manifest](conversation_results.jsonl)

## Executive handoff

| Question | Finding or next action |
|---|---|
| 1 · Why it sounds robotic | Replies reuse generic refusals, policy suffixes, verbatim recall and long enumerations when students ask for plain language, an example or an explanation. Twelve turns used an exact generic refusal template. Routing and context failures contribute alongside formatting. [Response analysis](07_ROBOTIC_RESPONSE_ANALYSIS.md) |
| 2 · Why it fails with relevant data | It can replace a valid predicate during context resolution, choose a specialized route before checking scope or surface unrelated facts. The running Qdrant index had the official calendar and scholarship eligibility passages. Live replies still used graph or irrelevant evidence paths on representative questions. [Recall and routing](08_MEMORY_ROUTING_RETRIEVAL_ANALYSIS.md) |
| 3 · Highest-priority causes | R01/R02 explicit constraints and referents, R03 route scope, R04 evidence relevance, R05 attribution and R09 independent question parts. Keep R06 response style and R07 measured timeout under their own gates. [Per-turn analysis](05_TURN_LEVEL_FAILURE_ANALYSIS.md) |
| 4 · Duplicate or obsolete code | Exact duplicates in the scanned source/text types were empty package markers at distinct import paths. Earlier private Decision career heuristics and KG reformatting were uncalled. Multiple routing/answer paths have distinct live, optional or compatibility roles. [Inventory](10_DUPLICATE_AND_DEAD_CODE_INVENTORY.md) |
| 5 · Safe cleanup | Applied C00–C03 to five source files on `unified-platform` without staging or committing. Removed unused imports/locals and dead private helpers. Backend, frontend, RAG and Decision gates passed before and after. [Diff scope](13_CLEANUP_EXECUTION_LOG.md) · [Verification](14_CLEANUP_VERIFICATION_REPORT.md) |
| 6 · Deliberate retention | Kept golden/dean advisory, graph visualization, Decision and admin roles, optional RAG answer service, old CLI, compatibility exports, migration history and prior user edits. Retained uncertain candidates pending consumer confirmation. [Specialized paths](11_LEGACY_AND_DEAN_SPECIFIC_CODE_AUDIT.md) · [Configuration](12_DEPENDENCY_AND_CONFIGURATION_AUDIT.md) |
| 7 · Target architecture | Keep one authenticated advisor orchestrator. Resolve explicit intent into typed question parts, retrieve typed graph or authoritative document evidence, adjudicate by part, verify citations and then shape the response. Use one request ID, deadlines and stage trace. [Target architecture](15_TARGET_ARCHITECTURE.md) |
| 8 · Developer 1 first | Codex owns T-00 canonical revision and two-machine fixture profile, followed by T-01 stage trace. T-10 and T-11 protect current constraints, corrections and memory. [Task list](implementation_tasks.json) |
| 9 · Developer 2 first | The Claude Code teammate owns T-02 independent cleanup review and source/fixture audit. Then own the graph, document and evidence contract lane T-30/T-31/T-40. Claude Code review was not executed on this host. [Work split](17_TWO_DEVELOPER_WORK_SPLIT.md) |
| 10 · Sequential integration | Freeze trace, QueryPlan and evidence contracts. Then combine scoped route/part planning, retrieval, adjudication and public formatting in that order. Serialize central orchestrator/CI/Compose changes and run exact-revision verification at T-70. [Roadmap](16_MASTER_IMPLEMENTATION_ROADMAP.md) |
| 11 · Evidence of improvement | Replay the named failures under the same revision, data and model conditions. Require preserved explicit slots, scoped route and evidence, claim citations or explicit gaps, no cross-owner state and measured latency. [Regression gates](18_TESTING_AND_REGRESSION_STRATEGY.md) |
| 12 · Open or unverified | July runtime and August source are separate. Full-stack testing of the cleaned August source and independent teammate review remain release gates. Many July turns lack candidate-level traces, and several future administrative facts require authoritative data. [Observability gaps](09_OBSERVABILITY_GAPS.md) · [Decisions](19_OPEN_DECISIONS_AND_BLOCKERS.md) |

## Stage evidence

| Stage | Closed work |
|---|---|
| A–B | Recorded dirty-worktree baseline and both revision identities. Probed seven components. Traced normal entry and route-specific call paths. [Runtime](01_REPOSITORY_AND_RUNTIME_AUDIT.md) · [Architecture](02_ACTUAL_ARCHITECTURE_AND_DATAFLOW.md) |
| C–D | Defined six personas and 25 multi-turn scenarios, joined 523 allowlisted events to 125 request IDs in the local diagnostic and catalogued failure cases. [Scenario design](03_STUDENT_PERSONAS_AND_SCENARIOS.md) · [Case definitions](conversation_scenarios.json) · [Failure catalog](failure_catalog.json) |
| E–F | Dispositioned C00–C16 with risk and checks. Applied the five-file cleanup and verified scoped diff, source gates and live appliance smoke. [Manifest](cleanup_manifest.json) |
| G–H | Defined interfaces, exact paths, dependencies, acceptance, owner/reviewer, effort, rollback, isolated environment and integration gates for 15 tasks across eight phases. [Implementation roadmap](16_MASTER_IMPLEMENTATION_ROADMAP.md) · [Two-developer handoff](17_TWO_DEVELOPER_WORK_SPLIT.md) |

The accepted manuscript, conference records, datasets and historical evaluation artifacts were preserved. This engineering pass made no conversational behavior changes.
