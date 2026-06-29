# BENCHMARK COVERAGE REPORT

Date: 2026-06-24
Graph: C:\AI_AGENT\full_graph.json
Benchmark folder: C:\AI_AGENT\aast-ai-agent-main\backend\testing

## Phase 1 - Current Benchmark Inventory

Question Count: 35

Expected answers: Not present in the discovered benchmark files. Current files define queries, expected routes, and route behavior expectations; they do not define answer-level gold labels.

### Coverage By Category
| Category | Question Count |
| --- | --- |
| Knowledge Graph | 7 |
| RAG Policy | 7 |
| Hybrid KG+RAG | 5 |
| Career | 4 |
| Decision | 4 |
| FAQ | 4 |
| LLM Fallback | 4 |

### Current Questions
| Query ID | Category | Expected Route | Question |
| --- | --- | --- | --- |
| Q_KG_01 | Knowledge Graph | KG_ONLY | Who is the dean of the computing faculty? |
| Q_KG_02 | Knowledge Graph | KG_ONLY | What are the prerequisites for AI 301? |
| Q_KG_03 | Knowledge Graph | KG_ONLY | Which professors teach Data Structures? |
| Q_KG_04 | Knowledge Graph | KG_ONLY | What tracks are available in the Computer Science curriculum? |
| Q_KG_05 | Knowledge Graph | KG_ONLY | List all courses related to Machine Learning. |
| Q_KG_06 | Knowledge Graph | KG_ONLY | Who teaches Database Systems? |
| Q_KG_07 | Knowledge Graph | KG_ONLY | Is Math 101 a prerequisite for Physics 201? |
| Q_RAG_01 | RAG Policy | RAG_ONLY | What is the policy for academic probation? |
| Q_RAG_02 | RAG Policy | RAG_ONLY | How can I apply for a merit scholarship? |
| Q_RAG_03 | RAG Policy | RAG_ONLY | What are the transfer policies for international students? |
| Q_RAG_04 | RAG Policy | RAG_ONLY | How much is the tuition fee for the upcoming semester? |
| Q_RAG_05 | RAG Policy | RAG_ONLY | What are the late registration rules? |
| Q_RAG_06 | RAG Policy | RAG_ONLY | What is the minimum GPA to stay enrolled? |
| Q_RAG_07 | RAG Policy | RAG_ONLY | Explain the attendance regulation policy. |
| Q_HYB_01 | Hybrid KG+RAG | HYBRID_KG_RAG | If I transfer to the AI track, do my GPA requirements change? |
| Q_HYB_02 | Hybrid KG+RAG | HYBRID_KG_RAG | I am on academic probation, can I still take AI 301 prerequisites? |
| Q_HYB_03 | Hybrid KG+RAG | HYBRID_KG_RAG | Does the engineering dean approve scholarship applications for late registration? |
| Q_HYB_04 | Hybrid KG+RAG | HYBRID_KG_RAG | What is the GPA required for the Software Engineering track? |
| Q_HYB_05 | Hybrid KG+RAG | HYBRID_KG_RAG | Can international transfer students register for Data Structures? |
| Q_DEC_01 | Decision | DECISION_ENGINE | I have an 85% in high school and a budget of 50000, what major should I choose? |
| Q_DEC_02 | Decision | DECISION_ENGINE | Compare Computer Science with Artificial Intelligence. |
| Q_DEC_03 | Decision | DECISION_ENGINE | I love math and coding, which specialization fits me best? |
| Q_DEC_04 | Decision | DECISION_ENGINE | Which major is better for someone interested in robotics, CS or Mechatronics? |
| Q_CAR_01 | Career | CAREER_ENGINE | How do I become a Machine Learning Engineer? |
| Q_CAR_02 | Career | CAREER_ENGINE | What jobs can I get if I study Natural Language Processing? |
| Q_CAR_03 | Career | CAREER_ENGINE | What is the roadmap for a career in AI? |
| Q_CAR_04 | Career | CAREER_ENGINE | What does a data scientist do post-graduation? |
| Q_FAQ_01 | FAQ | FAQ | Where is the admissions office located? |
| Q_FAQ_02 | FAQ | FAQ | What are the working hours for student affairs? |
| Q_FAQ_03 | FAQ | FAQ | When is the deadline to pay tuition? |
| Q_FAQ_04 | FAQ | FAQ | How can I contact the IT support desk? |
| Q_LLM_01 | LLM Fallback | LLM_FALLBACK | I'm feeling unmotivated to study, any advice? |
| Q_LLM_02 | LLM Fallback | LLM_FALLBACK | What is your favorite color? |
| Q_LLM_03 | LLM Fallback | LLM_FALLBACK | Can you summarize the plot of Lord of the Rings? |
| Q_LLM_04 | LLM Fallback | LLM_FALLBACK | Write a python script for a calculator. |

### Coverage By Node Label
| Label | Graph Count | Current Benchmark Mentions | Expanded Benchmark Mentions |
| --- | --- | --- | --- |
| Entity | 117 | 0 | 0 |
| Course | 42 | 5 | 52 |
| Person | 17 | 0 | 4 |
| Professor | 14 | 0 | 12 |
| CareerRole | 12 | 2 | 20 |
| Facility | 10 | 0 | 28 |
| Role | 10 | 2 | 0 |
| FacilityComponent | 6 | 0 | 1 |
| Track | 6 | 2 | 28 |
| CourseSyllabus | 4 | 0 | 4 |
| Policy | 3 | 0 | 7 |
| Specialization | 3 | 1 | 5 |
| GovernanceUnit | 2 | 0 | 4 |
| GradingSystem | 2 | 0 | 2 |
| PartnerInstitution | 2 | 0 | 20 |
| Program | 2 | 0 | 33 |
| Accreditation | 1 | 0 | 1 |
| Campus | 1 | 0 | 1 |
| College | 1 | 0 | 42 |
| Degree | 1 | 0 | 3 |
| Department | 1 | 0 | 1 |
| GradingPolicy | 1 | 0 | 2 |
| QualityUnit | 1 | 0 | 1 |
| Scholarship | 1 | 0 | 2 |
| TeachingStaff | 1 | 0 | 0 |

### Coverage By Relationship Type
| Relationship Type | Graph Count | Current Benchmark Mentions | Expanded Benchmark Mentions |
| --- | --- | --- | --- |
| HAS_COURSE | 37 | 2 | 19 |
| TEACHES | 22 | 2 | 11 |
| ACTS_AS | 21 | 0 | 0 |
| HAS_ROLE | 17 | 0 | 0 |
| WORKS_IN | 17 | 1 | 1 |
| PART_OF_TRACK | 14 | 3 | 20 |
| LEADS_TO | 13 | 2 | 12 |
| CAREER_ALIGNMENT | 12 | 2 | 8 |
| BELONGS_TO | 10 | 0 | 0 |
| HAS_FACILITY | 10 | 1 | 28 |
| IS_SAME_ENTITY | 7 | 0 | 0 |
| CONTAINS_COMPONENT | 6 | 0 | 1 |
| MANAGES | 6 | 0 | 1 |
| RECOMMENDED_AFTER | 6 | 0 | 8 |
| HAS_SYLLABUS | 5 | 0 | 4 |
| HEAD_OF | 5 | 0 | 4 |
| SPECIALIZES_IN | 5 | 0 | 5 |
| HAS_PREREQUISITE | 4 | 3 | 2 |
| HAS_ADMIN | 3 | 2 | 1 |
| HAS_SPECIALIZATION | 3 | 0 | 2 |
| SUPPORTS_POLICY_QUERY | 3 | 0 | 1 |
| COMPARES_WITH | 2 | 0 | 2 |
| HAS_ADVISING_PATHWAY | 2 | 0 | 2 |
| HAS_GOVERNANCE_BODY | 2 | 0 | 3 |
| HAS_PARTNER_INSTITUTION | 2 | 0 | 20 |
| HAS_SCHOLARSHIP | 2 | 2 | 2 |
| HAS_SCHOLARSHIP_POLICY | 2 | 2 | 2 |
| HAS_TUITION_PATHWAY | 2 | 3 | 2 |
| INCLUDES_PROGRAM | 2 | 2 | 2 |
| USES_GRADING_SYSTEM | 2 | 3 | 2 |
| ADMINISTERS | 1 | 0 | 0 |
| DEAN_OF | 1 | 2 | 0 |
| FOLLOWS_POLICY | 1 | 3 | 2 |
| HAS_ACCREDITATION | 1 | 0 | 1 |
| HAS_DEPARTMENT | 1 | 0 | 1 |
| HAS_UNIT | 1 | 0 | 1 |
| HOSTS | 1 | 0 | 1 |
| OFFERS | 1 | 0 | 2 |

## Phase 2 - Graph Statistics

| Metric | Value |
| --- | --- |
| Node label classes | 25 |
| Relationship types | 38 |
| Current label coverage | 5/24 (20.83%) |
| Expanded label coverage | 22/24 (91.67%) |
| Current relationship coverage | 16/38 (42.11%) |
| Expanded relationship coverage | 32/38 (84.21%) |

### Most Important Academic Paths Covered By Expanded Set
- Program -> HAS_COURSE -> Course: 19 generated references
- Course -> PART_OF_TRACK -> Track: 20 generated references
- Track/Program/Course -> career roles: 20 generated references
- Program -> HAS_SPECIALIZATION -> Specialization: 2 generated references
- College -> HAS_FACILITY -> Facility: 28 generated references
- College -> HAS_PARTNER_INSTITUTION -> PartnerInstitution: 20 generated references
- Policy/scholarship/grading relations: 12 generated references

## Phase 3 - Benchmark Gaps

| Gap Area | Graph Evidence | Current Coverage Risk |
| --- | --- | --- |
| Career outcomes | 25 career edges | Existing career questions are broad and not graph-fact-specific. |
| Facilities and components | 10 facility edges and 6 component edges | Current benchmark does not directly test lab/component traversal. |
| Governance | 14 governance/admin edges | Current benchmark mostly asks dean/admin route questions. |
| Scholarships and policy pathways | 8 pathway edges | Existing RAG questions are not anchored to KG policy nodes. |
| Accreditation | 1 accreditation edge | Not directly tested. |
| Specializations | 3 specialization edges plus 5 track specialization edges | Existing track questions do not test specialization-course paths. |
| Course sequencing | 6 recommended-after edges and 4 prerequisite edges | Prerequisite examples exist, but sequencing is under-tested. |
| Partnerships | 2 partner edges | Not directly tested. |
| Grading systems | 2 grading-system edges | RAG GPA questions exist, but KG grading-system nodes are under-tested. |

## Phase 4-6 - Expanded Benchmark Generation

Generated file: C:\AI_AGENT\aast-ai-agent-main\backend\testing\kg_benchmark_expanded.json
Generated question count: 100

### Generated Questions By Difficulty
| Difficulty | Count |
| --- | --- |
| Hard | 50 |
| Medium | 30 |
| Easy | 20 |

### Generated Questions By Category
| Category | Count |
| --- | --- |
| Partnerships | 20 |
| Multi-Hop Career | 12 |
| Faculty | 11 |
| Course Planning | 10 |
| Career | 8 |
| Facilities | 8 |
| Policies | 8 |
| Governance | 6 |
| Curriculum | 4 |
| Scholarships | 4 |
| Programs | 3 |
| Comparison | 2 |
| Specializations | 2 |
| Accreditation | 1 |
| Campus | 1 |

Deduplication: normalized generated questions were checked against existing benchmark questions, exact generated duplicates, and repeated answer patterns. Every generated row includes source_nodes and source_relationships derived from full_graph.json.