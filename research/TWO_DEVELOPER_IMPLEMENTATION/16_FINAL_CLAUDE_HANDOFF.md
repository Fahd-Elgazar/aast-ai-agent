# Handoff to Mohammed's teammate

Clone `integration/latest-project-baseline` in `Fahd-Elgazar/aast-ai-agent`. Confirm source commit `1ffc196b402cad48b0fea7c952d1d7584fce2d05` per the prompt. The integration branch carries the updated planning documentation over that pinned source. [Verified source](https://github.com/Fahd-Elgazar/aast-ai-agent/tree/1ffc196b402cad48b0fea7c952d1d7584fce2d05)

**First action.** Open [FINAL_CLAUDE_CODE_TEAMMATE_PROMPT.md](FINAL_CLAUDE_CODE_TEAMMATE_PROMPT.md), confirm the source, check the toolchain and obtain Mohammed’s separate cleanup patch. Report a missing patch, SHA mismatch, missing fixture identity, advisory disposition, or repository permissions in the P0 review. Repository read is public. Your account's branch-write permission has not been tested by Mohammed’s account.

1. **P0 / AUDIT.** Use a disposable checkout. Verify the five hashes and review every hunk, compare pre/post native results, and record one decision per file. Send the report for Mohammed’s review. Mohammed makes the cleanup commit only following the recorded acceptance.
2. **P2 / GRAPH, DOC, JUDGE.** Start `claude/p2-evidence` after P0 acceptance and both signatures on the contracts. Deliver directed, scoped evidence and stable provenance. Open a phase PR into `integration/latest-project-baseline`.
3. **P4 / CASES, QUALIFY.** Start `claude/p4-qualification` after the real producer-consumer join. Add independent evidence/fault checks on your test paths and open the reviewed phase PR.
4. **P5 / SIGNOFF.** Review the exact candidate, all relevant gates and rollback. Return a signed recommendation to Mohammed before release approval.

Mohammed owns request/session, router, orchestrator, public response, React, CI, and final integration. Coordinate contract changes with both reviewers and preserve one writer per file. [Task ownership](02_TASK_OWNERSHIP_MATRIX.md) · [Verification and release sequence](07_INTEGRATION_AND_RELEASE_PLAN.md)
