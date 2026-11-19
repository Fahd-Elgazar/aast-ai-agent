# Master implementation roadmap

**Stage G · 15 implementation tasks across eight phases**

Start with T-00. T-01 and independent T-02 review follow on the agreed base. P0 work protects explicit student intent, routing scope, retrieval eligibility and citations. Stabilize those contracts before changing phrasing or releasing a candidate. Estimates total 36.5 engineer-days and exclude waiting for assets, approvals and external dependencies. The ordered task records include exact likely paths, public/internal contract, acceptance, tests, owners and rollback. [Machine-readable tasks](implementation_tasks.json) · [Architecture](15_TARGET_ARCHITECTURE.md)

| Phase | Entry and exit gate |
|---|---|
| 0 · Stabilization | T-00 pins both machines, toolchain and approved data profile. T-01 covers the diagnostic stages, and T-02 independently reviews cleanup and fixture identities. Freeze request/trace fields before adapters depend on them. |
| 1 · Context and memory | T-10 makes explicit fields win against history. T-11 keeps session rehydration, owner isolation and return-to-topic behavior stable. Exit on A01, B04 and D03 plus legacy-state cases. |
| 2 · Intent and arbitration | T-20 adds scoped golden/meta rules. T-21 preserves ordered same-family and mixed-source parts. Freeze v1 QueryPlan before integrating new adapter paths. |
| 3 · Retrieval | T-30 typed graph recall and T-31 document eligibility. Start positive controls and isolated adapter tests early. Integrate after the QueryPlan freeze. Exit on named evidence or precise reason in both lanes. |
| 4 · Grounded evidence and replies | T-40 adjudicates scoped evidence. Freeze adjudication before T-41 exposure and client handling. Exit on positive, missing and conflicting fixtures with correct provenance. |
| 5 · Natural interaction | T-50 transforms verified context for why, examples and rephrase, and styles localized gap messages. Gate on fact/citation equivalence and reduced repeated templates. |
| 6 · Reliability and regression | T-60 bounds cancellation, fallback and queue. T-61 brings independent negative fixture acceptance. Keep T-60 orchestration changes serialized with T-41/T-50. Gate on equivalent profile comparisons and controlled failures. |
| 7 · Integration and release | T-70 executes an exact-revision candidate, independent review and rollback drill. Release is contingent on known-good digest, compatible data and owner sign-off. |

| Task | Owner | Prerequisites | Days | Risk | First acceptance check |
|---|---|---|---:|---|---|
| T-00 | D1 · Codex | Baseline record | 1 | medium | Both machines report exact commit, profile, toolchain, model identities and dataset fingerprint or a specific declared input gap. |
| T-01 | D1 · Codex | T-00 | 2 | medium | All required stages are represented on 100% of synthetic turns by ran/skipped/unavailable/error events keyed by one request ID. |
| T-02 | D2 · Claude Code | T-00 | 1 | medium | Five-file cleanup review documents reference/contract evidence and exact revision. |
| T-10 | D1 · Codex | T-01 | 3 | high | A01/4 preserves Data Science and Machine Learning relation. |
| T-11 | D1 · Codex | T-10 | 2.5 | high | Latest explicit correction wins through next turn. |
| T-20 | D1 · Codex | T-11, T-02 | 3 | high | E02/1 bypasses career Decision and retains exact graph relation. |
| T-21 | D1 · Codex | T-20 | 2.5 | high | E03/1 produces two distinct scoped plans in original order. |
| T-30 | D2 · Claude Code | T-02, T-01 | 3 | high | Positive fixtures preserve direction and distinction between HAS_COURSE, RECOMMENDED_AFTER and formal prerequisite. |
| T-31 | D2 · Claude Code | T-30 | 3 | high | Known calendar and scholarship eligibility fixture passage IDs are recallable for their own questions. |
| T-40 | D2 · Claude Code | T-21, T-31 | 3 | high | Direct RAG policy claim has usable citation or localized gap. |
| T-41 | D1 · Codex | T-40 | 2.5 | high | Every fixture policy claim is attributable to an actual selected passage. |
| T-50 | D1 · Codex | T-41 | 3 | medium | The three named follow-ups address the requested transformation with support retained. |
| T-60 | D1 · Codex | T-21, T-01 | 3 | high | Fixture deadline yields declared fallback and stops downstream work after cancellation. |
| T-61 | D2 · Claude Code | T-40, T-02 | 2 | medium | Every P0 retrieval/grounding root has both a positive and a negative assertion. |
| T-70 | D1 · Codex | T-50, T-60, T-61, T-41 | 2 | high | All required gates in report 18 verified on recorded source/image/data/model fingerprints. |

One merge queue observes the order listed above. Only disjoint paths and reviewed interfaces may proceed in parallel. Review can unblock an interface before implementation merges. Limit first release scope to the covered fixes and preserve route/API compatibility for existing callers. [Two-developer coordination](17_TWO_DEVELOPER_WORK_SPLIT.md) · [Gates](18_TESTING_AND_REGRESSION_STRATEGY.md) · [Decisions](19_OPEN_DECISIONS_AND_BLOCKERS.md)
