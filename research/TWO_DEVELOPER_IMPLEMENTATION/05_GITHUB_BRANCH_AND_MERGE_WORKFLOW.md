# GitHub workflow for two machines

Use `Fahd-Elgazar/aast-ai-agent` and `integration/latest-project-baseline`. The screened source commit is `1ffc196b402cad48b0fea7c952d1d7584fce2d05`. The historical plan remains at `b79a5e76a6fa35a8e983d9d33f5378639f2f86f6` on `plan/conversation-two-developer`. Use the active integration branch for the current source and plan. [Verified baseline](https://github.com/Fahd-Elgazar/aast-ai-agent/tree/1ffc196b402cad48b0fea7c952d1d7584fce2d05)

```powershell
git clone --single-branch --branch integration/latest-project-baseline https://github.com/Fahd-Elgazar/aast-ai-agent.git advisor
Set-Location advisor
$sourceSha = '1ffc196b402cad48b0fea7c952d1d7584fce2d05'
git merge-base --is-ancestor $sourceSha HEAD
# Exit code 0 confirms that the pinned source is present.
git diff --exit-code $sourceSha HEAD -- . ':(exclude)research/TWO_DEVELOPER_IMPLEMENTATION/**'
# Exit code 0 confirms the initial documentation-only follow-up.
```

Later reviewed implementation PRs advance integration. For those phases inspect the approved phase-entry SHA instead of requiring an unchanged initial source tree. Fetch the exact agreed SHA. If only public read access is available, work locally and arrange write access or a fork for the PR.

## P0 and cleanup

Mohammed records the synchronized SHA and shares the separate pending patch through an approved private channel. The teammate creates a disposable worktree at the pinned source to compare native checks before and after `git apply --check --index <patch>` and `git apply --index <patch>`. Verify the five normalized blob pairs and the patch checksum in the [baseline report](14_FINAL_REPOSITORY_BASELINE.md). Keep edits in that worktree separate from the review report branch. Do not publish the review patch, a provisional source change, local stores, or private corpus data.

Put AUDIT findings on `claude/p0-cleanup-review` from the synchronized integration tip and submit the report for Mohammed's review. Use the AUDIT path in the [ownership matrix](02_TASK_OWNERSHIP_MATRIX.md). If the provisional cleanup is accepted, Mohammed applies only the approved patch on a short reviewed P0 branch, adds profile and contract evidence, and merges the complete P0 gate. An unapproved behavioral hunk stays out and returns to its owner. Both record the merged P0 entry SHA to start P1/P2.

## Phase branches

| Phase | Branch | Entry | Reviewer |
|---|---|---|---|
| P0 review | claude/p0-cleanup-review | Synchronized integration tip | Mohammed |
| P0 freeze | codex/p0-freeze | Synchronized integration plus reviewed AUDIT | Teammate |
| P1 | codex/p1-turn-plan | Signed P0 integration SHA | Teammate |
| P2 | claude/p2-evidence | Same signed P0 SHA | Mohammed |
| P3 | codex/p3-replies | Both P1/P2 complete and real-interface join passes | Teammate |
| P4 | claude/p4-qualification | Same P1/P2 join | Mohammed |
| P5 | codex/p5-candidate | Both P3/P4 complete | Teammate, including independent SIGNOFF |

Create branches from the verified integration head with `git fetch origin` and `git switch -c <phase-branch> origin/integration/latest-project-baseline`. Check the SHA against its entry gate. Commit selected paths with `type(TASK-ID): description` and push your own branch. Open the PR using `gh pr create --base integration/latest-project-baseline --head <phase-branch> --body-file <review-note>` or the GitHub UI after confirming the target. A PR records base and tested SHAs, tasks, scope, contract examples, fixture/model IDs, actual test results, rollback and any blocker. Keep each phase atomic. Mohammed queues merges and records the resulting SHA. P5 sign-off is attached to that phase before promotion approval.

For a contract edit, notify both developers first. The registered writer updates an example and the version or compatibility expectation. The other developer checks the producer and consumer cases. Resolve conflicts by file owner after a normal integration merge. Re-run both boundary suites before updating approval. No force-push, direct default-branch updates or broad staging. Use reviewed phase revert PRs in reverse dependency order and reverify the candidate. A stable release requires explicit maintainer approval and a tested image/digest.
