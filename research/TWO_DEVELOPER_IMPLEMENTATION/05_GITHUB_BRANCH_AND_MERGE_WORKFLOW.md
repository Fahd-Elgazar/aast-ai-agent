# GitHub workflow for two machines

The configured remote is `https://github.com/Fahd-Elgazar/aast-ai-agent.git`. GitHub reported public visibility, WRITE for the inspecting account, default branch `main`, and no branch protection on main. The published `main` and `reliability-hardening` both pointed to `3e2f0100254a0d20a9e81b52d28c127d612f9dc1` before this operation. The planning branch is `plan/conversation-two-developer`, a docs-only child of that public revision. Treat it as a reading copy. Never branch implementation from that old tree. Both developers must use the same approved code repository for implementation PRs.

## Read the plan on machine 2

```powershell
git clone --single-branch --branch plan/conversation-two-developer https://github.com/Fahd-Elgazar/aast-ai-agent.git advisor-plan
git -C advisor-plan rev-parse HEAD
git -C advisor-plan diff --name-status 3e2f0100254a0d20a9e81b52d28c127d612f9dc1 HEAD
```

Compare the first output with the published planning SHA. Every added path must be in the planning directory. The [verification record](planning_verification_report.md) describes what was verified.

## Establish the implementation remote and baseline

1. Mohammed selects one authorized common GitHub code repository and verifies both accounts' read/write and review access. Prefer a private implementation repository if the source/history requires restricted distribution. If the intended eventual stable branch is in the public repository, crossing that visibility boundary requires a separately reviewed publishable source/history. Confirm the intended stable target before starting code PRs.
2. Start the separate source handoff from the exact August parent `6367b0df91f208e518fb7e04cd7c81bdb82b9ae4`. Inspect history, tracked content, environment files, private corpora and model assets before explicitly authorizing **any** transfer. A public branch from that parent would publish all missing ancestors. A private repository also requires source-distribution authorization. If the exact parent cannot be shared, stop BASE until both approve a sanitized source-equivalent commit with a tracked-tree difference manifest and repeat the baseline tests there.
3. In the approved code repository Mohammed supplies a separate cleanup-only review ref with an explicit five-path diff against the approved parent. The teammate fetches both and compares normalized Git blob IDs, raw hashes where EOLs match, documented exports and paired tests. Record approvals on the review. Only after separate authorization admit the reviewed cleanup commit to the code baseline. Unrelated docs/untracked files never enter that commit.
4. Create `integration/conversation-v1` in that repository at the approved cleaned SHA and bring in the planning commit as a **reviewed docs-only import** on a short P0 setup branch. Merge it via reviewed PR after inspecting the path list. No merge of public/main history is necessary. Stage the P0 profile, synthetic fixture manifest, contract examples and actual gate results on the P0 phase PR. A test-only restricted fixture bundle can be provided by an approved internal location keyed by SHA-256; do not publish it to the planning branch.
5. Both record the integrated P0 SHA as the immutable starting point of P1/P2. Maintain separate identities for original source, cleanup, baseline docs/fixtures and built OCI image. A candidate cannot inherit the July image just because its tag is convenient.

Commands below are **future**, after approval. Run in a new clean clone. Supply reviewed values when prompted. Stop on any nonzero exit, unexpected file, URL, access policy or SHA mismatch.

```powershell
$codeUrl = Read-Host 'Approved shared code repository URL'
$cleanSha = Read-Host 'Full reviewed cleaned source SHA'
git clone $codeUrl advisor-code
Set-Location advisor-code
git fetch origin
git cat-file -e "$cleanSha^{commit}"
git switch -c integration/conversation-v1 $cleanSha
git push -u origin integration/conversation-v1
git switch -c codex/p0-baseline
git fetch https://github.com/Fahd-Elgazar/aast-ai-agent.git refs/heads/plan/conversation-two-developer
$planSha = git rev-parse FETCH_HEAD
git diff --name-status 3e2f0100254a0d20a9e81b52d28c127d612f9dc1 $planSha
```

To transplant the current planning snapshot including any verification-only follow-up commits, restore only the documentation directory into the clean P0 setup branch, then stage the explicit filenames from the verification inventory individually. Inspect any existing destination first. If the paths already exist, review differences and reconcile before importing.

```powershell
git ls-tree -r --name-only HEAD -- research/TWO_DEVELOPER_IMPLEMENTATION
# Continue only for an empty destination after verifying the allowlist.
git restore --source=$planSha --worktree -- research/TWO_DEVELOPER_IMPLEMENTATION
$planFiles = git diff --diff-filter=A --name-only 3e2f0100254a0d20a9e81b52d28c127d612f9dc1 $planSha -- research/TWO_DEVELOPER_IMPLEMENTATION
# Compare every entry to the published inventory before staging.
git add -- $planFiles
git diff --cached --name-status
git diff --cached --check
git commit -m "docs(P0): import approved collaboration plan"
git push -u origin codex/p0-baseline
```

Open the documentation-import PR into integration. For the P0 phase itself use a fresh `codex/p0-freeze` branch from the documentation-bearing integration head. The teammate contributes the independent review artifact on a short teammate-owned branch into that phase branch. Both acknowledge the complete P0 exit before integration accepts it. During the initial bootstrap, BASE/AUDIT may use signed review attachments in the approved code repo prior to the cleaned branch existing. Transfer those records into P0 by their owner. The shared v1 examples are tracked with the P0 phase.

## Future cleanup transfer after separate authorization

Mohammed runs this only after the common code destination and transfer of the reviewed history are approved. From the dirty integrated checkout, use a new path outside it and an explicit pathspec. The current planning operation does not run these commands.

```powershell
$parentSha = '6367b0df91f208e518fb7e04cd7c81bdb82b9ae4'
$reviewDir = Read-Host 'New, unused absolute path for the isolated cleanup review checkout'
$patchFile = Join-Path ([IO.Path]::GetTempPath()) ("advisor-cleanup-" + [guid]::NewGuid() + ".patch")
$cleanupFiles = @(
  'aast-ai-agent-main/backend/orchestrator.js'
  'aast-ai-agent-main/backend/services/neo4jcontext.js'
  'aast-ai-agent-main/backend/services/decisionService.js'
  'aast-ai-agent-main/backend/rag_system/phase3_retriever.py'
  'aast-ai-agent-main/backend/rag_system/phase4_llm_answer_engine.py'
)
if ((git rev-parse HEAD) -ne $parentSha) { throw 'Source parent differs' }
if (Test-Path -LiteralPath $reviewDir) { throw 'Choose a new review checkout path' }
git diff --binary --output=$patchFile $parentSha -- $cleanupFiles
git worktree add -b review/conversation-cleanup $reviewDir $parentSha
git -C $reviewDir apply --check $patchFile
# Stop on any nonzero result. Compare the five changed paths/blobs with the verification table.
git -C $reviewDir apply $patchFile
git -C $reviewDir diff --stat
git -C $reviewDir add -- $cleanupFiles
git -C $reviewDir diff --cached --check
git -C $reviewDir diff --cached --name-status
```

After inspecting the staged five blobs, commit them in the review checkout with `git -C $reviewDir commit -m "chore(AUDIT): isolate cleanup candidate"`. The word “candidate” marks independent review as pending. To transfer, supply the explicitly approved code URL (the review checkout inherits the public origin), verify its identity and visibility, then push just `HEAD:refs/heads/review/conversation-cleanup` to that URL. Do not use an unqualified push. The accepted cleaned SHA is determined by the separate approval/merge. For a sanitized equivalent baseline, compare contents and obtain an equivalent reviewed patch and new digest table before using that ref.

On machine 2, in the approved repository after the ref is provided:

```powershell
git fetch origin refs/heads/review/conversation-cleanup
$reviewSha = git rev-parse FETCH_HEAD
git diff --name-status "$reviewSha^" $reviewSha
git rev-parse "$reviewSha^"
git ls-tree -r $reviewSha -- aast-ai-agent-main/backend
```

Compare parent and five blob IDs with the review table. Inspect each hunk and the exports/callers, run the paired gates, and record the independent result before FREEZE accepts the cleanup. Source transfer is a separate operation from publishing this planning branch.

## Development and integration queue

| Phase | Branch | Base and normal order | PR reviewer |
|---|---|---|---|
| P1 | codex/p1-turn-plan | integration after P0 | Teammate |
| P2 | claude/p2-evidence | same P0 SHA as P1 | Mohammed |
| P3 | codex/p3-replies | integration after both P1/P2 and handshake | Teammate |
| P4 | claude/p4-qualification | same joined SHA as P3 | Mohammed |
| P5 | codex/p5-candidate | integration after P3/P4 and handshake | Teammate, including independent sign-off |

Example on machine 2 for P2. Substitute the exact branch from this table for another phase. Use a normal clean clone in the approved repository, including its remote tracking refs.

```powershell
git fetch origin
git switch -c claude/p2-evidence origin/integration/conversation-v1
git rev-parse HEAD
# Compare to the signed phase entry SHA before editing.
git status --short
# Stage individual owned paths only.
git diff --cached --check
git diff --cached --name-only
# Commit convention: type(TASK-ID): tested change.
git push -u origin claude/p2-evidence
gh pr create --base integration/conversation-v1 --head claude/p2-evidence --title "P2: scoped evidence and adjudication" --body-file $reviewBodyFile
```

Set `$reviewBodyFile` to the path of a prepared review note outside the staged source. Each PR records phase/task/owner, base and tested SHAs, modified paths, example/contract diff, exact commands, fixture and model identities, results including negative tests, risks, reversal and remaining blockers. Draft task commits are fine on the owner's branch. A phase PR merges only when every task in it meets its exit. The author never approves their own phase. For joint phases, independently review the other person's contributions.

Before merging a second lane, fetch and merge the latest integration head into the feature branch with a regular merge. Rerun both boundary suites on the combined tree and record its SHA. Resolve a shared-file conflict with the registered writer and have the other developer rerun affected contracts. Never auto-select a whole side. A changed interface gets a reviewed example before new consumers land. Serialize merges, require green CI and named reviewer approval; use GitHub rulesets when maintainers can enable them, otherwise enforce via the merge queue and review record. Stable branches receive reviewed release PRs only. No direct stable pushes, force-pushes, broad staging or partial-phase merges.

Prefer one squash merge per completed phase, preserving task IDs and evidence links in the PR. Revert a phase with a new PR referencing that merge, rolling back consumers before producers. Tag the **approved tested release commit** only after stable-branch tests pass and a maintainer authorizes it, for example `advisor-conversation-v1.0.0`. Record its image digest and fixture profile. Tags and deployment are outside this planning operation.
