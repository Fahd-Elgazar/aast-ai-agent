# Handoff from Mohammed to the teammate

We traced a recurring error in the AAST advisor. It can identify Data Science correctly and still replace the student’s Machine Learning question with a careers question. The July diagnostic recorded 25 conversations and 125 turns. Our August source tree already includes some later evidence and readiness checks. We will measure changes on a cleaned, agreed revision.

**Read the planning branch first.**

```powershell
git clone --single-branch --branch plan/conversation-two-developer https://github.com/Fahd-Elgazar/aast-ai-agent.git advisor-plan
```

Open [the Claude Code prompt](08_CLAUDE_CODE_TEAMMATE_IMPLEMENTATION_PROMPT.md) in `research/TWO_DEVELOPER_IMPLEMENTATION/`. It is ready to paste. The [Mohammed prompt](09_CODEX_MOHAMMED_IMPLEMENTATION_PROMPT.md) covers the other lane.

**Mohammed:** approve or revise the six-phase plan, then identify the authorized common code repository. Supply its URL, canonical source SHA, separately approved cleanup review ref, five normalized blob pairs, and the synthetic input/profile fingerprints. The planning branch starts from public main, 61 commits behind the integrated source. The latter needs separate distribution approval.

**Teammate:** clone the reading branch, verify access and tool versions, and wait for the exact source/ref before reviewing the five cleanup files. Return one independent verdict per file with tests, then sign the baseline and contract examples. Report a missing source or fixture by ID. Do not start from the public reading copy.

**How we divide six phases:** P0 is a joint baseline/contract gate led by Mohammed. P1 (Mohammed) produces ordered turn plans while P2 (teammate) builds typed graph/document evidence against the same examples. Once both land, P3 (Mohammed) wires grounded replies, style and cancellation while P4 (teammate) qualifies real evidence and failure behavior. P5 is the joint candidate, 125-turn replay and rollback decision. One writer per file; the other developer reviews each phase.

Start feature branches only from the signed P0 integration SHA after independent cleanup review, matching fixture access, cleaned-source full-stack smoke and contract freeze. Communicate branch, SHA, task ID, affected interface, commands and blocking case in the phase PR.
