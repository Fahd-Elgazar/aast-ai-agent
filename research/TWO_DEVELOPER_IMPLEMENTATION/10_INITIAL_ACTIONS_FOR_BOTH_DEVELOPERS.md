# Handoff from Mohammed to the teammate

We traced a recurring error in the AAST advisor. It can identify Data Science correctly and still replace the student’s Machine Learning question with a careers question. The July diagnostic recorded 25 conversations and 125 turns. Our August source tree already includes some later evidence and readiness checks. We will measure changes on a cleaned, agreed revision.

**Clone the synchronized integration branch.**

```powershell
git clone --single-branch --branch integration/latest-project-baseline https://github.com/Fahd-Elgazar/aast-ai-agent.git advisor
```

Open [the Claude Code prompt](FINAL_CLAUDE_CODE_TEAMMATE_PROMPT.md) in `research/TWO_DEVELOPER_IMPLEMENTATION/`. It is ready to paste. The [Mohammed prompt](09_CODEX_MOHAMMED_IMPLEMENTATION_PROMPT.md) covers the other lane.

**Mohammed:** confirm the exact source 1ffc196b402cad48b0fea7c952d1d7584fce2d05 with the teammate, privately supply the separate cleanup patch and agree the isolated fixture profile. Confirm write access or a fork PR route.

**Teammate:** confirm the source and tool versions, then review the exact five-file patch in a disposable checkout. Record one independent verdict per file with paired tests. Both developers sign the baseline and contract examples before starting feature work.

**How we divide six phases:** P0 is a joint baseline/contract gate led by Mohammed. P1 (Mohammed) produces ordered turn plans while P2 (teammate) builds typed graph/document evidence against the same examples. Once both land, P3 (Mohammed) wires grounded replies, style and cancellation while P4 (teammate) qualifies real evidence and failure behavior. P5 is the joint candidate, 125-turn replay and rollback decision. One writer per file; the other developer reviews each phase.

Start feature branches only from the signed P0 integration SHA after independent cleanup review, matching fixture access, cleaned-source full-stack smoke and contract freeze. Communicate branch, SHA, task ID, affected interface, commands and blocking case in the phase PR.
