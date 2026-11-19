# Student personas and conversation scenarios

**Stage C · 25 scenarios · five turns per conversation**

The diagnostic uses fresh authenticated guests and preserves the actual advisor conversation ID within each session. Scenarios use academic entities available in the saved exports and historical verified artifacts, with open-ended questions where missing or ambiguous evidence is the point. The suite does not assign facts to the student or generate a comparative paper metric. [Machine-readable schedule](conversation_scenarios.json) · [Architecture](02_ACTUAL_ARCHITECTURE_AND_DATAFLOW.md) · The underlying academic corpus and manuscript records are held separately

| Persona | Scenarios | Hypothesis exercised |
|---|---|---|
| A · New student | A01–A04 | Program and institution scope, relation reuse and clear explanations. |
| B · Curious student | B01–B04 | “Why”, short follow-up, ambiguity, correction and previous-week retrieval. |
| C · Career-oriented student | C01–C04 | Career/course relationships, preferences, recommendation boundaries and Decision. |
| D · Administrative student | D01–D05 | GPA, eligibility/application distinction, calendar, mixed retrieval, tuition freshness. |
| E · Technical AI student | E01–E04 | Curated prerequisites, recommended versus required, multiple course/week targets, NLP topic. |
| F · Informal bilingual student | F01–F04 | Arabic/English, typos, short turns, stale topic contamination and domain boundary. |

The first four turns establish and perturb context. On the fifth turn the simulated student continues the planned path when the prior result is usable, asks for the missing part or clarification when signaled, or asks for the source when substantive academic content carries no citation. Flags serve conversation control only. Reviewers score whether the system actually answered the academic task, resolved the subject and used attributable evidence. Fields with no runtime substitute are marked unavailable. [Transcripts](04_CONVERSATION_TRANSCRIPTS.md) · [Turn review](05_TURN_LEVEL_FAILURE_ANALYSIS.md)
