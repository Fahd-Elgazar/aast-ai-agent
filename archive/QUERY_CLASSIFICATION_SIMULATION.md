# Query Classification Simulation

Repository: `C:\AI_AGENT`
Branch: `recovery-baseline`
Mode: offline simulation, no source code changes.

## Method

I ran an offline route simulation against the current `brainRouter.js` with all subsystems marked healthy. This did not call the live API, Neo4j, Qdrant, Gemma, or Gemini.

Current Route means the route returned by the current route decision layer under healthy-service assumptions. It does not include later retrieval emptiness, model failures, or response humanization.

Proposed Route means the intended three-category classification contract:

- `ACADEMIC_POLICY`: evidence required. Use RAG, KG, or verified institutional documents. Refuse if evidence is unavailable.
- `ACADEMIC_KNOWLEDGE`: evidence not required. Use Gemma primary, Gemini backup. Do not require university evidence.
- `ACADEMIC_ADVISING`: evidence preferred, not required. Try RAG/KG first; if missing, answer with LLM and append advisory disclaimer.

## Measurement Summary

Sample size: 104 queries.

Current likely category mismatch: 55 / 104.

Final proposed classifier target after policy-first guard:

- False Policy Classification: 0
- False Knowledge Classification: 0
- False Advising Classification: 0

Important blocker found during simulation:

- A provisional classifier incorrectly treated `What is the policy for changing major?` and `What is the maximum credit-hour load allowed?` as conceptual knowledge because of `what is` phrasing.
- Required safety correction: explicit `policy`, `allowed`, `minimum`, `maximum`, `requirements`, `rules`, `deadline`, `eligible`, `can`, `when`, and `how many` must override conceptual phrasing when a policy-domain term is present.

## Simulation Table

| # | Query | Current Route | Proposed Route | Risk | Expected Benefit |
|---:|---|---|---|---|---|
| 1 | What are the GPA probation rules at AAST? | KG_DIRECT (1) | ACADEMIC_POLICY | Policy may use KG before documents | Evidence-required refusal boundary |
| 2 | What is the minimum GPA to avoid probation? | RAG_DIRECT (0.96) | ACADEMIC_POLICY | Low | Evidence-required refusal boundary |
| 3 | Can a student on probation register for full credit hours? | RAG_ONLY (0.609) | ACADEMIC_POLICY | Low | Evidence-required refusal boundary |
| 4 | How many credit hours may I register in a regular semester? | HYBRID_KG_RAG (0.285) | ACADEMIC_POLICY | Policy precision depends on retrieved evidence | Evidence-required refusal boundary |
| 5 | What are the add and drop registration rules? | KG_DIRECT (1) | ACADEMIC_POLICY | Policy may use KG before documents | Evidence-required refusal boundary |
| 6 | What is the deadline for course withdrawal? | HYBRID_KG_RAG (0.35) | ACADEMIC_POLICY | Policy precision depends on retrieved evidence | Evidence-required refusal boundary |
| 7 | Can I withdraw from a course after the deadline? | HYBRID_KG_RAG (0.35) | ACADEMIC_POLICY | Policy precision depends on retrieved evidence | Evidence-required refusal boundary |
| 8 | What are the scholarship eligibility requirements? | HYBRID_KG_RAG (1) | ACADEMIC_POLICY | Policy precision depends on retrieved evidence | Evidence-required refusal boundary |
| 9 | Do scholarships require a minimum GPA? | HYBRID_KG_RAG (1) | ACADEMIC_POLICY | Policy precision depends on retrieved evidence | Evidence-required refusal boundary |
| 10 | What are transfer requirements between majors? | HYBRID_KG_RAG (1) | ACADEMIC_POLICY | Policy precision depends on retrieved evidence | Evidence-required refusal boundary |
| 11 | Can transferred credits count toward graduation? | KG_ONLY (0.568) | ACADEMIC_POLICY | Policy may use KG before documents | Evidence-required refusal boundary |
| 12 | What are the admission requirements for AI college? | KG_DIRECT (1) | ACADEMIC_POLICY | Policy may use KG before documents | Evidence-required refusal boundary |
| 13 | What documents are required for admission? | HYBRID_KG_RAG (1) | ACADEMIC_POLICY | Policy precision depends on retrieved evidence | Evidence-required refusal boundary |
| 14 | What is the grading policy for failed courses? | KG_DIRECT (1) | ACADEMIC_POLICY | Policy may use KG before documents | Evidence-required refusal boundary |
| 15 | What happens if I fail a required course? | HYBRID_KG_RAG (0.926) | ACADEMIC_POLICY | Policy precision depends on retrieved evidence | Evidence-required refusal boundary |
| 16 | Are attendance rules part of course grading? | KG_DIRECT (1) | ACADEMIC_POLICY | Policy may use KG before documents | Evidence-required refusal boundary |
| 17 | What are AAST academic regulations for repeated courses? | KG_DIRECT (1) | ACADEMIC_POLICY | Policy may use KG before documents | Evidence-required refusal boundary |
| 18 | Can I take extra credit hours if my GPA is high? | RAG_DIRECT (0.96) | ACADEMIC_POLICY | Low | Evidence-required refusal boundary |
| 19 | What are graduation credit hour requirements? | HYBRID_KG_RAG (1) | ACADEMIC_POLICY | Policy precision depends on retrieved evidence | Evidence-required refusal boundary |
| 20 | What is the policy for changing major? | KG_DIRECT (1) | ACADEMIC_POLICY | Policy may use KG before documents | Evidence-required refusal boundary |
| 21 | Can international students transfer credits? | RAG_ONLY (0.497) | ACADEMIC_POLICY | Low | Evidence-required refusal boundary |
| 22 | What is the rule for tuition late payment? | RAG_DIRECT (0.96) | ACADEMIC_POLICY | Low | Evidence-required refusal boundary |
| 23 | When can I register for next semester? | RAG_ONLY (0.497) | ACADEMIC_POLICY | Low | Evidence-required refusal boundary |
| 24 | What are the rules for academic dismissal? | KG_DIRECT (1) | ACADEMIC_POLICY | Policy may use KG before documents | Evidence-required refusal boundary |
| 25 | What does the student handbook say about probation? | RAG_DIRECT (0.96) | ACADEMIC_POLICY | Low | Evidence-required refusal boundary |
| 26 | Explain machine learning in simple terms | KG_ONLY (0.805) | ACADEMIC_KNOWLEDGE | Knowledge over-routed to evidence | Useful answer without university-document dependency |
| 27 | What is deep learning? | KG_ONLY (0.805) | ACADEMIC_KNOWLEDGE | Knowledge over-routed to evidence | Useful answer without university-document dependency |
| 28 | How do neural networks learn? | LLM_FALLBACK (0.15) | ACADEMIC_KNOWLEDGE | LLM fallback still hits evidence gate | Useful answer without university-document dependency |
| 29 | Explain backpropagation | LLM_FALLBACK (0.15) | ACADEMIC_KNOWLEDGE | LLM fallback still hits evidence gate | Useful answer without university-document dependency |
| 30 | What is supervised learning? | LLM_FALLBACK (0.15) | ACADEMIC_KNOWLEDGE | LLM fallback still hits evidence gate | Useful answer without university-document dependency |
| 31 | What is unsupervised learning? | LLM_FALLBACK (0.15) | ACADEMIC_KNOWLEDGE | LLM fallback still hits evidence gate | Useful answer without university-document dependency |
| 32 | What is reinforcement learning? | KG_ONLY (0.544) | ACADEMIC_KNOWLEDGE | Knowledge over-routed to evidence | Useful answer without university-document dependency |
| 33 | Explain natural language processing | KG_ONLY (0.805) | ACADEMIC_KNOWLEDGE | Knowledge over-routed to evidence | Useful answer without university-document dependency |
| 34 | What is computer vision? | KG_ONLY (0.805) | ACADEMIC_KNOWLEDGE | Knowledge over-routed to evidence | Useful answer without university-document dependency |
| 35 | What is a convolutional neural network? | LLM_FALLBACK (0.15) | ACADEMIC_KNOWLEDGE | LLM fallback still hits evidence gate | Useful answer without university-document dependency |
| 36 | What is a transformer model? | KG_DIRECT (1) | ACADEMIC_KNOWLEDGE | Knowledge over-routed to curriculum KG | Useful answer without university-document dependency |
| 37 | Explain attention mechanism | LLM_FALLBACK (0.15) | ACADEMIC_KNOWLEDGE | LLM fallback still hits evidence gate | Useful answer without university-document dependency |
| 38 | What is retrieval augmented generation? | LLM_FALLBACK (0.15) | ACADEMIC_KNOWLEDGE | LLM fallback still hits evidence gate | Useful answer without university-document dependency |
| 39 | Explain Python dictionaries | LLM_FALLBACK (0.15) | ACADEMIC_KNOWLEDGE | LLM fallback still hits evidence gate | Useful answer without university-document dependency |
| 40 | What is object oriented programming? | KG_ONLY (0.375) | ACADEMIC_KNOWLEDGE | Knowledge over-routed to evidence | Useful answer without university-document dependency |
| 41 | Explain recursion with an example | KG_ONLY (0.188) | ACADEMIC_KNOWLEDGE | Knowledge over-routed to evidence | Useful answer without university-document dependency |
| 42 | What is algorithm complexity? | LLM_FALLBACK (0.15) | ACADEMIC_KNOWLEDGE | LLM fallback still hits evidence gate | Useful answer without university-document dependency |
| 43 | Explain Big O notation | LLM_FALLBACK (0.15) | ACADEMIC_KNOWLEDGE | LLM fallback still hits evidence gate | Useful answer without university-document dependency |
| 44 | What is a database index? | LLM_FALLBACK (0.15) | ACADEMIC_KNOWLEDGE | LLM fallback still hits evidence gate | Useful answer without university-document dependency |
| 45 | What is software engineering? | KG_ONLY (0.805) | ACADEMIC_KNOWLEDGE | Knowledge over-routed to evidence | Useful answer without university-document dependency |
| 46 | Explain agile methodology | LLM_FALLBACK (0.15) | ACADEMIC_KNOWLEDGE | LLM fallback still hits evidence gate | Useful answer without university-document dependency |
| 47 | What is unit testing? | KG_ONLY (0.188) | ACADEMIC_KNOWLEDGE | Knowledge over-routed to evidence | Useful answer without university-document dependency |
| 48 | What is cloud computing? | KG_ONLY (0.544) | ACADEMIC_KNOWLEDGE | Knowledge over-routed to evidence | Useful answer without university-document dependency |
| 49 | Explain data mining | KG_ONLY (0.375) | ACADEMIC_KNOWLEDGE | Knowledge over-routed to evidence | Useful answer without university-document dependency |
| 50 | What is blockchain? | KG_ONLY (0.665) | ACADEMIC_KNOWLEDGE | Knowledge over-routed to evidence | Useful answer without university-document dependency |
| 51 | How can I improve my GPA this semester? | RAG_DIRECT (0.96) | ACADEMIC_ADVISING | Advice over-routed as policy | Evidence preferred, but practical guidance allowed |
| 52 | How should I study machine learning? | KG_ONLY (0.805) | ACADEMIC_ADVISING | Advice over-routed to evidence | Evidence preferred, but practical guidance allowed |
| 53 | Should I learn Python before deep learning? | KG_ONLY (0.805) | ACADEMIC_ADVISING | Advice over-routed to evidence | Evidence preferred, but practical guidance allowed |
| 54 | What skills do I need for computer vision? | KG_ONLY (0.805) | ACADEMIC_ADVISING | Advice over-routed to evidence | Evidence preferred, but practical guidance allowed |
| 55 | How can I prepare for NLP course? | KG_ONLY (1) | ACADEMIC_ADVISING | Advice over-routed to evidence | Evidence preferred, but practical guidance allowed |
| 56 | Should I choose data science or robotics? | KG_ONLY (1) | ACADEMIC_ADVISING | Advice over-routed to evidence | Evidence preferred, but practical guidance allowed |
| 57 | What is the best study plan for algorithms? | LLM_FALLBACK (0.3) | ACADEMIC_ADVISING | Needs advisory disclaimer and fallback path | Evidence preferred, but practical guidance allowed |
| 58 | How do I recover after failing a course? | KG_ONLY (0.813) | ACADEMIC_ADVISING | Advice over-routed to evidence | Evidence preferred, but practical guidance allowed |
| 59 | Should I withdraw from a difficult course? | KG_ONLY (0.813) | ACADEMIC_ADVISING | Advice over-routed to evidence | Evidence preferred, but practical guidance allowed |
| 60 | How can I balance credit hours and GPA? | RAG_DIRECT (0.96) | ACADEMIC_ADVISING | Advice over-routed as policy | Evidence preferred, but practical guidance allowed |
| 61 | Which track is better for AI jobs? | CAREER_ENGINE (1) | ACADEMIC_ADVISING | Low | Evidence preferred, but practical guidance allowed |
| 62 | What should I learn for a machine learning internship? | KG_ONLY (0.805) | ACADEMIC_ADVISING | Advice over-routed to evidence | Evidence preferred, but practical guidance allowed |
| 63 | How can I build a portfolio for computer vision? | KG_ONLY (0.805) | ACADEMIC_ADVISING | Advice over-routed to evidence | Evidence preferred, but practical guidance allowed |
| 64 | Should I focus on math before NLP? | KG_ONLY (0.69) | ACADEMIC_ADVISING | Advice over-routed to evidence | Evidence preferred, but practical guidance allowed |
| 65 | What roadmap should I follow for software engineering? | KG_ONLY (0.805) | ACADEMIC_ADVISING | Advice over-routed to evidence | Evidence preferred, but practical guidance allowed |
| 66 | How can I improve my programming skills? | KG_ONLY (0.375) | ACADEMIC_ADVISING | Advice over-routed to evidence | Evidence preferred, but practical guidance allowed |
| 67 | Should I take more credit hours next semester? | HYBRID_KG_RAG (0.285) | ACADEMIC_ADVISING | Advice blended with policy | Evidence preferred, but practical guidance allowed |
| 68 | How should I prepare for graduation project? | KG_ONLY (0.375) | ACADEMIC_ADVISING | Advice over-routed to evidence | Evidence preferred, but practical guidance allowed |
| 69 | What skills are useful for data science careers? | KG_ONLY (0.805) | ACADEMIC_ADVISING | Advice over-routed to evidence | Evidence preferred, but practical guidance allowed |
| 70 | How do I decide between AI and cybersecurity? | KG_ONLY (0.194) | ACADEMIC_ADVISING | Advice over-routed to evidence | Evidence preferred, but practical guidance allowed |
| 71 | What study habits help with deep learning? | KG_ONLY (0.805) | ACADEMIC_ADVISING | Advice over-routed to evidence | Evidence preferred, but practical guidance allowed |
| 72 | How can I plan my semester if my GPA is low? | RAG_DIRECT (0.96) | ACADEMIC_ADVISING | Advice over-routed as policy | Evidence preferred, but practical guidance allowed |
| 73 | Should I retake a course to improve my GPA? | HYBRID_KG_RAG (1) | ACADEMIC_ADVISING | Advice blended with policy | Evidence preferred, but practical guidance allowed |
| 74 | How do I prepare for a computer vision interview? | KG_ONLY (0.805) | ACADEMIC_ADVISING | Advice over-routed to evidence | Evidence preferred, but practical guidance allowed |
| 75 | What is the difference between admission requirements and transfer requirements? | HYBRID_KG_RAG (1) | ACADEMIC_POLICY | Policy comparison requires evidence | Evidence-required refusal boundary |
| 76 | Explain the concept of GPA | KG_DIRECT (1) | ACADEMIC_KNOWLEDGE | Concept over-routed to KG/policy | Useful answer without university-document dependency |
| 77 | How can I raise my GPA without overloading myself? | RAG_DIRECT (0.96) | ACADEMIC_ADVISING | Advice over-routed as policy | Evidence preferred, but practical guidance allowed |
| 78 | What are the university rules for overloading credit hours? | KG_DIRECT (1) | ACADEMIC_POLICY | Policy may use KG before documents | Evidence-required refusal boundary |
| 79 | What is a prerequisite in university courses? | KG_DIRECT (0.99) | ACADEMIC_KNOWLEDGE | Concept over-routed to KG | Useful answer without university-document dependency |
| 80 | Can I register for a course without its prerequisite? | HYBRID_KG_RAG (1) | ACADEMIC_POLICY | Policy precision depends on retrieved evidence | Evidence-required refusal boundary |
| 81 | How should I handle prerequisite gaps before machine learning? | KG_DIRECT (1) | ACADEMIC_ADVISING | Advice over-routed to KG | Evidence preferred, but practical guidance allowed |
| 82 | What is academic probation conceptually? | RAG_DIRECT (0.96) | ACADEMIC_KNOWLEDGE | Concept over-routed to policy | Useful answer without university-document dependency |
| 83 | What does AAST probation policy require? | KG_DIRECT (1) | ACADEMIC_POLICY | Policy may use KG before documents | Evidence-required refusal boundary |
| 84 | Should I talk to an advisor if I am near probation? | KG_DIRECT (0.99) | ACADEMIC_ADVISING | Advice over-routed to KG | Evidence preferred, but practical guidance allowed |
| 85 | What is a scholarship? | HYBRID_KG_RAG (1) | ACADEMIC_KNOWLEDGE | Concept over-routed to policy/evidence | Useful answer without university-document dependency |
| 86 | How can I improve my chance of getting a scholarship? | HYBRID_KG_RAG (1) | ACADEMIC_ADVISING | Advice blended with policy | Evidence preferred, but practical guidance allowed |
| 87 | What are official scholarship rules? | KG_DIRECT (1) | ACADEMIC_POLICY | Policy may use KG before documents | Evidence-required refusal boundary |
| 88 | Explain transfer learning in machine learning | HYBRID_KG_RAG (0.348) | ACADEMIC_KNOWLEDGE | Knowledge misread as policy transfer | Useful answer without university-document dependency |
| 89 | What are official transfer rules between colleges? | KG_DIRECT (1) | ACADEMIC_POLICY | Policy may use KG before documents | Evidence-required refusal boundary |
| 90 | Should I transfer from robotics to data science? | HYBRID_KG_RAG (0.423) | ACADEMIC_ADVISING | Advice blended with policy | Evidence preferred, but practical guidance allowed |
| 91 | What is registration in a university context? | RAG_ONLY (0.497) | ACADEMIC_KNOWLEDGE | Concept over-routed to RAG | Useful answer without university-document dependency |
| 92 | How should I plan registration for next semester? | RAG_ONLY (0.731) | ACADEMIC_ADVISING | Advice over-routed to RAG | Evidence preferred, but practical guidance allowed |
| 93 | What are official registration deadlines? | RAG_ONLY (0.731) | ACADEMIC_POLICY | Low | Evidence-required refusal boundary |
| 94 | Explain credit hours | HYBRID_KG_RAG (0.21) | ACADEMIC_KNOWLEDGE | Concept over-routed to evidence | Useful answer without university-document dependency |
| 95 | How many credit hours should I take with a part time job? | HYBRID_KG_RAG (0.21) | ACADEMIC_ADVISING | Advice blended with policy | Evidence preferred, but practical guidance allowed |
| 96 | What is the maximum credit-hour load allowed? | KG_ONLY (0.375) | ACADEMIC_POLICY | Policy may use KG before documents | Evidence-required refusal boundary |
| 97 | What is academic advising? | LLM_FALLBACK (0.2) | ACADEMIC_KNOWLEDGE | LLM fallback still hits evidence gate | Useful answer without university-document dependency |
| 98 | Give me advice for studying algorithms | LLM_FALLBACK (0.3) | ACADEMIC_ADVISING | Needs advisory disclaimer and fallback path | Evidence preferred, but practical guidance allowed |
| 99 | What are AAST withdrawal regulations? | KG_DIRECT (1) | ACADEMIC_POLICY | Policy may use KG before documents | Evidence-required refusal boundary |
| 100 | Explain the difference between NLP and computer vision | HYBRID_KG_RAG (1) | ACADEMIC_KNOWLEDGE | Knowledge over-routed to evidence | Useful answer without university-document dependency |
| 101 | Which should I study first, NLP or computer vision? | KG_ONLY (1) | ACADEMIC_ADVISING | Advice over-routed to evidence | Evidence preferred, but practical guidance allowed |
| 102 | What are official graduation regulations? | KG_DIRECT (1) | ACADEMIC_POLICY | Policy may use KG before documents | Evidence-required refusal boundary |
| 103 | What is a graduation project? | KG_ONLY (0.375) | ACADEMIC_KNOWLEDGE | Concept over-routed to KG | Useful answer without university-document dependency |
| 104 | How can I choose a graduation project topic? | KG_DIRECT (1) | ACADEMIC_ADVISING | Advice over-routed to KG | Evidence preferred, but practical guidance allowed |

## Interpretation

The improvement should not be implemented as a broad route rewrite.

The safe direction is an additive classification contract:

- policy: never open-LLM without verified evidence,
- knowledge: allow LLM answers without institutional evidence,
- advising: prefer evidence, then LLM with disclaimer.

The main production value is not changing all routes. It is preventing general academic knowledge from being trapped in evidence-required routes while preserving institutional policy refusal behavior.

