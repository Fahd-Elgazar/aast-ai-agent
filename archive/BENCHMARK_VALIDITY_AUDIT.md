# Benchmark Validity Audit

Scope: benchmark validity only. This audit does not audit the system and does not modify routing logic.

Source benchmark report: `C:\AI_AGENT\aast-ai-agent-main\backend\testing\route_accuracy_report.json`

Failed benchmark queries audited: `18`

## Definitions

- Real routing error: the expected route is still valid and the actual route does not match the query's required reasoning path.
- Outdated benchmark expectation: the expected route is too narrow or no longer matches the current intended route taxonomy, even if the answer quality still needs separate review.
- Answer correct: the returned answer directly answers the user query with relevant academic content. Prompt leakage, generic fallback text, unrelated facts, or missing required information are counted incorrect.

## Metrics

Original benchmark route accuracy: `17/35 = 48.57%`

Outdated benchmark expectations found: `3/18 failed queries`

Benchmark Drift Percentage:

- Failed-query drift: `3/18 = 16.67%`
- Whole-benchmark drift: `3/35 = 8.57%`

True Route Accuracy after benchmark-drift adjustment: `20/35 = 57.14%`

Answer Accuracy on failed-query replay:

- Strict correct: `1/18 = 5.56%`
- Partial/relevant but incomplete: `1/18 = 5.56%`
- Incorrect: `16/18 = 88.89%`

Conclusion: benchmark drift exists, but it explains only a minority of failures. Most failed benchmark rows are still real runtime route/retrieval/answer-quality failures, not outdated expectations.

## Failed Query Review

| ID | Query | Expected | Actual | Answer correct? | Expectation outdated? | Cause |
|---|---|---|---|---|---|---|
| Q_KG_05 | List all courses related to Machine Learning. | KG_ONLY | LLM_FALLBACK | No | No | Real failure |
| Q_RAG_01 | What is the policy for academic probation? | RAG_ONLY | KG_ONLY | No | No | Real failure |
| Q_RAG_02 | How can I apply for a merit scholarship? | RAG_ONLY | HYBRID_KG_RAG | Partial | Yes | Benchmark drift plus partial answer |
| Q_RAG_03 | What are the transfer policies for international students? | RAG_ONLY | KG_ONLY | No | No | Real failure |
| Q_RAG_04 | How much is the tuition fee for the upcoming semester? | RAG_ONLY | LLM_FALLBACK | No | No | Real failure |
| Q_RAG_05 | What are the late registration rules? | RAG_ONLY | KG_ONLY | No | No | Real failure |
| Q_RAG_07 | Explain the attendance regulation policy. | RAG_ONLY | KG_ONLY | No | No | Real failure |
| Q_HYB_02 | I am on academic probation, can I still take AI 301 prerequisites? | HYBRID_KG_RAG | KG_ONLY | No | No | Real failure |
| Q_HYB_04 | What is the GPA required for the Software Engineering track? | HYBRID_KG_RAG | KG_ONLY | No | No | Real failure |
| Q_HYB_05 | Can international transfer students register for Data Structures? | HYBRID_KG_RAG | LLM_FALLBACK | No | No | Real failure |
| Q_DEC_02 | Compare Computer Science with Artificial Intelligence. | DECISION_ENGINE | HYBRID_KG_RAG | No | Yes | Benchmark drift, but answer failed |
| Q_DEC_03 | I love math and coding, which specialization fits me best? | DECISION_ENGINE | KG_ONLY | No | No | Real failure |
| Q_CAR_02 | What jobs can I get if I study Natural Language Processing? | CAREER_ENGINE | KG_ONLY | No | No | Real failure |
| Q_CAR_04 | What does a data scientist do post-graduation? | CAREER_ENGINE | LLM_FALLBACK | No | No | Real failure |
| Q_FAQ_01 | Where is the admissions office located? | FAQ | LLM_FALLBACK | No | No | Real failure |
| Q_FAQ_02 | What are the working hours for student affairs? | FAQ | RAG_ONLY | No | No | Real failure |
| Q_FAQ_03 | When is the deadline to pay tuition? | FAQ | RAG_ONLY | Yes | Yes | Benchmark drift |
| Q_FAQ_04 | How can I contact the IT support desk? | FAQ | LLM_FALLBACK | No | No | Real failure |

## Actual Answers

### Q_KG_05

Query: `List all courses related to Machine Learning.`

Expected route: `KG_ONLY`

Actual route: `LLM_FALLBACK`

Actual answer: `To assist the student in answering their question, please follow these guidelines: STRICT RULES YOU MUST FOLLOW AT ALL TIMES: ... If the provided context does not contain enough information to answer the question confidently, respond with exactly: "I don't have enough verified information to answer that fully.`

Correct: No

Outdated expectation: No

### Q_RAG_01

Query: `What is the policy for academic probation?`

Expected route: `RAG_ONLY`

Actual route: `KG_ONLY`

Actual answer: `College of Artificial Intelligence follows Course Passing Criteria. I can also help with office information or related courses if that information is available.`

Correct: No

Outdated expectation: No

### Q_RAG_02

Query: `How can I apply for a merit scholarship?`

Expected route: `RAG_ONLY`

Actual route: `HYBRID_KG_RAG`

Actual answer: `To apply for a merit scholarship, you must meet the following admissions requirements: completion of secondary education certificate, completed admissions application form, and financial plan... AAST academic regulations: To qualify, a student must maintain a GPA of at least 3.4...`

Correct: Partial

Outdated expectation: Yes. Scholarship queries can legitimately combine admission/application facts and financial-policy facts; `RAG_ONLY` is too narrow.

### Q_RAG_03

Query: `What are the transfer policies for international students?`

Expected route: `RAG_ONLY`

Actual route: `KG_ONLY`

Actual answer: `College of Artificial Intelligence follows Course Passing Criteria. I can also help with office information or related courses if that information is available.`

Correct: No

Outdated expectation: No

### Q_RAG_04

Query: `How much is the tuition fee for the upcoming semester?`

Expected route: `RAG_ONLY`

Actual route: `LLM_FALLBACK`

Actual answer: `To assist students with accurate, trustworthy, and professional academic guidance, you must follow these strict rules...`

Correct: No

Outdated expectation: No

### Q_RAG_05

Query: `What are the late registration rules?`

Expected route: `RAG_ONLY`

Actual route: `KG_ONLY`

Actual answer: `College of Artificial Intelligence uses AAST Grading System (Pre-2023). College of Artificial Intelligence uses AAST Grading System (From 2023).`

Correct: No

Outdated expectation: No

### Q_RAG_07

Query: `Explain the attendance regulation policy.`

Expected route: `RAG_ONLY`

Actual route: `KG_ONLY`

Actual answer: `College of Artificial Intelligence follows Course Passing Criteria. I can also help with office information or related courses if that information is available.`

Correct: No

Outdated expectation: No

### Q_HYB_02

Query: `I am on academic probation, can I still take AI 301 prerequisites?`

Expected route: `HYBRID_KG_RAG`

Actual route: `KG_ONLY`

Actual answer: `Physics. Hany Hanafy Mahmoud Said teaches Cognitive Computing and Natural Language Processing. College of Artificial Int is taught by Ahmed Attia.`

Correct: No

Outdated expectation: No

### Q_HYB_04

Query: `What is the GPA required for the Software Engineering track?`

Expected route: `HYBRID_KG_RAG`

Actual route: `KG_ONLY`

Actual answer: `Data Science specializes in Data Science. Intelligent Systems specializes in Intelligent Systems. Intelligent Systems specializes in Robotics...`

Correct: No

Outdated expectation: No

### Q_HYB_05

Query: `Can international transfer students register for Data Structures?`

Expected route: `HYBRID_KG_RAG`

Actual route: `LLM_FALLBACK`

Actual answer: `To assist you with your student query, please follow these guidelines: STRICT RULES YOU MUST FOLLOW AT ALL TIMES...`

Correct: No

Outdated expectation: No

### Q_DEC_02

Query: `Compare Computer Science with Artificial Intelligence.`

Expected route: `DECISION_ENGINE`

Actual route: `HYBRID_KG_RAG`

Actual answer: `To assist the student in answering their question, you must follow these strict rules... AAST academic regulations: and Information Technology, Artificial Intelligence, Computer Engineering, and the Computer Science division...`

Correct: No

Outdated expectation: Yes. A factual comparison between two academic programs can be a hybrid KG/RAG comparison; `DECISION_ENGINE` should be reserved for recommendation/choice workflows with user preferences.

### Q_DEC_03

Query: `I love math and coding, which specialization fits me best?`

Expected route: `DECISION_ENGINE`

Actual route: `KG_ONLY`

Actual answer: `Data Science specializes in Data Science. Intelligent Systems specializes in Intelligent Systems. Intelligent Systems specializes in Robotics...`

Correct: No

Outdated expectation: No

### Q_CAR_02

Query: `What jobs can I get if I study Natural Language Processing?`

Expected route: `CAREER_ENGINE`

Actual route: `KG_ONLY`

Actual answer: `Intelligent Systems specializes in Natural Language Processing. I can also help with office information or related courses if that information is available.`

Correct: No

Outdated expectation: No

### Q_CAR_04

Query: `What does a data scientist do post-graduation?`

Expected route: `CAREER_ENGINE`

Actual route: `LLM_FALLBACK`

Actual answer: `To assist the student in answering their question, you must follow strict rules and guidelines outlined above...`

Correct: No

Outdated expectation: No

### Q_FAQ_01

Query: `Where is the admissions office located?`

Expected route: `FAQ`

Actual route: `LLM_FALLBACK`

Actual answer: `To assist students with accurate, trustworthy, and professional academic guidance, you must follow strict rules outlined below...`

Correct: No

Outdated expectation: No

### Q_FAQ_02

Query: `What are the working hours for student affairs?`

Expected route: `FAQ`

Actual route: `RAG_ONLY`

Actual answer: `Behavioral or ethical offenses are reviewed by the Student Affairs Committee. Underachievement is triggered if a student completes less than 50% of required credits.`

Correct: No

Outdated expectation: No

### Q_FAQ_03

Query: `When is the deadline to pay tuition?`

Expected route: `FAQ`

Actual route: `RAG_ONLY`

Actual answer: `Failure to pay tuition fees on time will result in the student's registration being cancelled. Fees for each course must be paid at the start of every semester.`

Correct: Yes

Outdated expectation: Yes. This is a policy/financial-regulation lookup rather than a static FAQ-only query.

### Q_FAQ_04

Query: `How can I contact the IT support desk?`

Expected route: `FAQ`

Actual route: `LLM_FALLBACK`

Actual answer: `To assist you with your student query, here is a response to your question in a clear and concise manner that follows the provided context. STRICT RULES YOU MUST FOLLOW AT ALL TIMES...`

Correct: No

Outdated expectation: No
