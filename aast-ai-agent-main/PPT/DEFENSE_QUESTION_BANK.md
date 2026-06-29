# Defense Question Bank

Canonical root: `C:\AI_AGENT\aast-ai-agent-main`.

Total questions generated: 150. Required minimum: more than 120, with 20 Easy, 30 Medium, 40 Hard, and 30 Killer questions. Every item includes Question, Expected Answer, Evidence Source, Code Reference, and Defense Tip.

## A. Easy Questions

### Q001 - Easy

**Question:** What is the main API route?

**Expected Answer:** The main route is POST /api/chatbot/query.

**Evidence Source:** backend/orchestrator.js:575

**Code Reference:** backend/orchestrator.js:575

**Defense Tip:** Say the route and file first.

### Q002 - Easy

**Question:** Which class owns routing?

**Expected Answer:** BrainRouter owns query analysis and route selection.

**Evidence Source:** backend/services/brainRouter.js:312

**Code Reference:** backend/services/brainRouter.js:312

**Defense Tip:** Use exact class name.

### Q003 - Easy

**Question:** Where is KG retrieval implemented?

**Expected Answer:** fetchNeo4jContext in neo4jcontext.js is the KG entry point.

**Evidence Source:** backend/services/neo4jcontext.js:3191-3459

**Code Reference:** backend/services/neo4jcontext.js:3191-3459

**Defense Tip:** Name the function.

### Q004 - Easy

**Question:** Where is RAG retrieval implemented?

**Expected Answer:** ragService.search implements RAG retrieval.

**Evidence Source:** backend/services/ragService.js:558-718

**Code Reference:** backend/services/ragService.js:558-718

**Defense Tip:** Mention multi-pass retrieval if asked.

### Q005 - Easy

**Question:** Where is decision advising implemented?

**Expected Answer:** decisionService.getRecommendation implements the decision workflow.

**Evidence Source:** backend/services/decisionService.js:632-819

**Code Reference:** backend/services/decisionService.js:632-819

**Defense Tip:** Separate it from RAG.

### Q006 - Easy

**Question:** What normalizes response output?

**Expected Answer:** responseFormatter.format normalizes route, confidence, sources, graph, used facts, and metadata.

**Evidence Source:** backend/services/responseFormatter.js:30-96

**Code Reference:** backend/services/responseFormatter.js:30-96

**Defense Tip:** Tie it to explainability.

### Q007 - Easy

**Question:** What does HYBRID_KG_RAG mean?

**Expected Answer:** It combines structured KG facts with RAG policy text.

**Evidence Source:** backend/services/brainRouter.js:37-47

**Code Reference:** backend/services/brainRouter.js:37-47

**Defense Tip:** Give a course plus policy example.

### Q008 - Easy

**Question:** Is the current benchmark publication ready?

**Expected Answer:** No. Current reports show weak route and retrieval metrics.

**Evidence Source:** backend/testing/route_accuracy_report.json; backend/testing/retrieval_report.json

**Code Reference:** backend/testing/route_accuracy_report.json; backend/testing/retrieval_report.json

**Defense Tip:** Answer no first.

### Q009 - Easy

**Question:** What is the strongest contribution?

**Expected Answer:** Source-aware routing before generation with inspectable evidence outputs.

**Evidence Source:** backend/services/brainRouter.js:1059-1452; backend/services/responseFormatter.js:30-96

**Code Reference:** backend/services/brainRouter.js:1059-1452; backend/services/responseFormatter.js:30-96

**Defense Tip:** Avoid hype.

### Q010 - Easy

**Question:** What is the honest readiness verdict?

**Expected Answer:** PARTIAL. Architecture is strong, validation evidence is not final.

**Evidence Source:** backend/testing/route_accuracy_report.json; backend/testing/retrieval_report.json; backend/testing/golden_path_benchmark_report.json

**Code Reference:** backend/testing/route_accuracy_report.json; backend/testing/retrieval_report.json; backend/testing/golden_path_benchmark_report.json

**Defense Tip:** Use PARTIAL clearly.

### Q011 - Easy

**Question:** What is the main API route?

**Expected Answer:** The main route is POST /api/chatbot/query.

**Evidence Source:** backend/orchestrator.js:575

**Code Reference:** backend/orchestrator.js:575

**Defense Tip:** Say the route and file first.

### Q012 - Easy

**Question:** Which class owns routing?

**Expected Answer:** BrainRouter owns query analysis and route selection.

**Evidence Source:** backend/services/brainRouter.js:312

**Code Reference:** backend/services/brainRouter.js:312

**Defense Tip:** Use exact class name.

### Q013 - Easy

**Question:** Where is KG retrieval implemented?

**Expected Answer:** fetchNeo4jContext in neo4jcontext.js is the KG entry point.

**Evidence Source:** backend/services/neo4jcontext.js:3191-3459

**Code Reference:** backend/services/neo4jcontext.js:3191-3459

**Defense Tip:** Name the function.

### Q014 - Easy

**Question:** Where is RAG retrieval implemented?

**Expected Answer:** ragService.search implements RAG retrieval.

**Evidence Source:** backend/services/ragService.js:558-718

**Code Reference:** backend/services/ragService.js:558-718

**Defense Tip:** Mention multi-pass retrieval if asked.

### Q015 - Easy

**Question:** Where is decision advising implemented?

**Expected Answer:** decisionService.getRecommendation implements the decision workflow.

**Evidence Source:** backend/services/decisionService.js:632-819

**Code Reference:** backend/services/decisionService.js:632-819

**Defense Tip:** Separate it from RAG.

### Q016 - Easy

**Question:** What normalizes response output?

**Expected Answer:** responseFormatter.format normalizes route, confidence, sources, graph, used facts, and metadata.

**Evidence Source:** backend/services/responseFormatter.js:30-96

**Code Reference:** backend/services/responseFormatter.js:30-96

**Defense Tip:** Tie it to explainability.

### Q017 - Easy

**Question:** What does HYBRID_KG_RAG mean?

**Expected Answer:** It combines structured KG facts with RAG policy text.

**Evidence Source:** backend/services/brainRouter.js:37-47

**Code Reference:** backend/services/brainRouter.js:37-47

**Defense Tip:** Give a course plus policy example.

### Q018 - Easy

**Question:** Is the current benchmark publication ready?

**Expected Answer:** No. Current reports show weak route and retrieval metrics.

**Evidence Source:** backend/testing/route_accuracy_report.json; backend/testing/retrieval_report.json

**Code Reference:** backend/testing/route_accuracy_report.json; backend/testing/retrieval_report.json

**Defense Tip:** Answer no first.

### Q019 - Easy

**Question:** What is the strongest contribution?

**Expected Answer:** Source-aware routing before generation with inspectable evidence outputs.

**Evidence Source:** backend/services/brainRouter.js:1059-1452; backend/services/responseFormatter.js:30-96

**Code Reference:** backend/services/brainRouter.js:1059-1452; backend/services/responseFormatter.js:30-96

**Defense Tip:** Avoid hype.

### Q020 - Easy

**Question:** What is the honest readiness verdict?

**Expected Answer:** PARTIAL. Architecture is strong, validation evidence is not final.

**Evidence Source:** backend/testing/route_accuracy_report.json; backend/testing/retrieval_report.json; backend/testing/golden_path_benchmark_report.json

**Code Reference:** backend/testing/route_accuracy_report.json; backend/testing/retrieval_report.json; backend/testing/golden_path_benchmark_report.json

**Defense Tip:** Use PARTIAL clearly.

## B. Medium Questions

### Q021 - Medium

**Question:** Which facility is available to College of Artificial Intelligence?

**Expected Answer:** College of Artificial Intelligence has facility Robotics Lab.

**Evidence Source:** backend/data/clean_graph.json (HAS_FACILITY: College of Artificial Intelligence -> Robotics Lab)

**Code Reference:** backend/data/clean_graph.json (HAS_FACILITY: College of Artificial Intelligence -> Robotics Lab)

**Defense Tip:** Answer only the supported graph fact.

### Q022 - Medium

**Question:** Which facility is available to College of Artificial Intelligence?

**Expected Answer:** College of Artificial Intelligence has facility Virtual Reality Lab.

**Evidence Source:** backend/data/clean_graph.json (HAS_FACILITY: College of Artificial Intelligence -> Virtual Reality Lab)

**Code Reference:** backend/data/clean_graph.json (HAS_FACILITY: College of Artificial Intelligence -> Virtual Reality Lab)

**Defense Tip:** Answer only the supported graph fact.

### Q023 - Medium

**Question:** Which facility is available to College of Artificial Intelligence?

**Expected Answer:** College of Artificial Intelligence has facility IoT Lab.

**Evidence Source:** backend/data/clean_graph.json (HAS_FACILITY: College of Artificial Intelligence -> IoT Lab)

**Code Reference:** backend/data/clean_graph.json (HAS_FACILITY: College of Artificial Intelligence -> IoT Lab)

**Defense Tip:** Answer only the supported graph fact.

### Q024 - Medium

**Question:** Which facility is available to College of Artificial Intelligence?

**Expected Answer:** College of Artificial Intelligence has facility Basic Electronic Lab.

**Evidence Source:** backend/data/clean_graph.json (HAS_FACILITY: College of Artificial Intelligence -> Basic Electronic Lab)

**Code Reference:** backend/data/clean_graph.json (HAS_FACILITY: College of Artificial Intelligence -> Basic Electronic Lab)

**Defense Tip:** Answer only the supported graph fact.

### Q025 - Medium

**Question:** Which facility is available to College of Artificial Intelligence?

**Expected Answer:** College of Artificial Intelligence has facility Physics Lab.

**Evidence Source:** backend/data/clean_graph.json (HAS_FACILITY: College of Artificial Intelligence -> Physics Lab)

**Code Reference:** backend/data/clean_graph.json (HAS_FACILITY: College of Artificial Intelligence -> Physics Lab)

**Defense Tip:** Answer only the supported graph fact.

### Q026 - Medium

**Question:** Which facility is available to College of Artificial Intelligence?

**Expected Answer:** College of Artificial Intelligence has facility General Purpose Computers Lab.

**Evidence Source:** backend/data/clean_graph.json (HAS_FACILITY: College of Artificial Intelligence -> General Purpose Computers Lab)

**Code Reference:** backend/data/clean_graph.json (HAS_FACILITY: College of Artificial Intelligence -> General Purpose Computers Lab)

**Defense Tip:** Answer only the supported graph fact.

### Q027 - Medium

**Question:** Which facility is available to College of Artificial Intelligence?

**Expected Answer:** College of Artificial Intelligence has facility UV (Un-Manned Vehicle).

**Evidence Source:** backend/data/clean_graph.json (HAS_FACILITY: College of Artificial Intelligence -> UV (Un-Manned Vehicle))

**Code Reference:** backend/data/clean_graph.json (HAS_FACILITY: College of Artificial Intelligence -> UV (Un-Manned Vehicle))

**Defense Tip:** Answer only the supported graph fact.

### Q028 - Medium

**Question:** Which facility is available to College of Artificial Intelligence?

**Expected Answer:** College of Artificial Intelligence has facility Embedded Systems.

**Evidence Source:** backend/data/clean_graph.json (HAS_FACILITY: College of Artificial Intelligence -> Embedded Systems)

**Code Reference:** backend/data/clean_graph.json (HAS_FACILITY: College of Artificial Intelligence -> Embedded Systems)

**Defense Tip:** Answer only the supported graph fact.

### Q029 - Medium

**Question:** Which facility is available to College of Artificial Intelligence?

**Expected Answer:** College of Artificial Intelligence has facility Basic IoT (Internet of Things).

**Evidence Source:** backend/data/clean_graph.json (HAS_FACILITY: College of Artificial Intelligence -> Basic IoT (Internet of Things))

**Code Reference:** backend/data/clean_graph.json (HAS_FACILITY: College of Artificial Intelligence -> Basic IoT (Internet of Things))

**Defense Tip:** Answer only the supported graph fact.

### Q030 - Medium

**Question:** Which facility is available to College of Artificial Intelligence?

**Expected Answer:** College of Artificial Intelligence has facility Workstations Lab.

**Evidence Source:** backend/data/clean_graph.json (HAS_FACILITY: College of Artificial Intelligence -> Workstations Lab)

**Code Reference:** backend/data/clean_graph.json (HAS_FACILITY: College of Artificial Intelligence -> Workstations Lab)

**Defense Tip:** Answer only the supported graph fact.

### Q031 - Medium

**Question:** Which policy does College of Artificial Intelligence follow?

**Expected Answer:** College of Artificial Intelligence follows Course Passing Criteria.

**Evidence Source:** backend/data/clean_graph.json (FOLLOWS_POLICY: College of Artificial Intelligence -> Course Passing Criteria)

**Code Reference:** backend/data/clean_graph.json (FOLLOWS_POLICY: College of Artificial Intelligence -> Course Passing Criteria)

**Defense Tip:** Answer only the supported graph fact.

### Q032 - Medium

**Question:** Which grading system does College of Artificial Intelligence use?

**Expected Answer:** College of Artificial Intelligence uses AAST Grading System (Pre-2023).

**Evidence Source:** backend/data/clean_graph.json (USES_GRADING_SYSTEM: College of Artificial Intelligence -> AAST Grading System (Pre-2023))

**Code Reference:** backend/data/clean_graph.json (USES_GRADING_SYSTEM: College of Artificial Intelligence -> AAST Grading System (Pre-2023))

**Defense Tip:** Answer only the supported graph fact.

### Q033 - Medium

**Question:** Which grading system does College of Artificial Intelligence use?

**Expected Answer:** College of Artificial Intelligence uses AAST Grading System (From 2023).

**Evidence Source:** backend/data/clean_graph.json (USES_GRADING_SYSTEM: College of Artificial Intelligence -> AAST Grading System (From 2023))

**Code Reference:** backend/data/clean_graph.json (USES_GRADING_SYSTEM: College of Artificial Intelligence -> AAST Grading System (From 2023))

**Defense Tip:** Answer only the supported graph fact.

### Q034 - Medium

**Question:** Who teaches Time Series?

**Expected Answer:** College of Artificial Intelligence teaches Time Series.

**Evidence Source:** backend/data/clean_graph.json (TEACHES: College of Artificial Intelligence -> Time Series)

**Code Reference:** backend/data/clean_graph.json (TEACHES: College of Artificial Intelligence -> Time Series)

**Defense Tip:** Answer only the supported graph fact.

### Q035 - Medium

**Question:** Which policy query does College of Artificial Intelligence support?

**Expected Answer:** College of Artificial Intelligence supports policy query Tuition and Fees Pathway.

**Evidence Source:** backend/data/clean_graph.json (SUPPORTS_POLICY_QUERY: College of Artificial Intelligence -> Tuition and Fees Pathway)

**Code Reference:** backend/data/clean_graph.json (SUPPORTS_POLICY_QUERY: College of Artificial Intelligence -> Tuition and Fees Pathway)

**Defense Tip:** Answer only the supported graph fact.

### Q036 - Medium

**Question:** What does the CAI policy corpus say about ai_application_areas?

**Expected Answer:** and integrate the actions of human with digital systems to be able to reduce labor costs as well as prevent human error;

**Evidence Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (5e597281bb41d77062ca3c6e7311ffd4; institutional/ai_application_areas; AI Application Areas)

**Code Reference:** backend/rag_system/cleaned_chunked_cai_production_v4.json (5e597281bb41d77062ca3c6e7311ffd4; institutional/ai_application_areas; AI Application Areas)

**Defense Tip:** Do not add policy conditions not present in the chunk.

### Q037 - Medium

**Question:** What does the CAI policy corpus say about dean's_study_advice?

**Expected Answer:** Here are some advice to you: Study regularly throughout the semester for all your classes;

**Evidence Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (21983774bc55d342fd9264b1427ae4b6; institutional/dean's_study_advice; Dean's Study Advice)

**Code Reference:** backend/rag_system/cleaned_chunked_cai_production_v4.json (21983774bc55d342fd9264b1427ae4b6; institutional/dean's_study_advice; Dean's Study Advice)

**Defense Tip:** Do not add policy conditions not present in the chunk.

### Q038 - Medium

**Question:** What does the CAI policy corpus say about accreditation_and_membership?

**Expected Answer:** The College of Artificial Intelligence (CAI) is accredited by the Supreme Council of Universities in Egypt

**Evidence Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (f3705cfb85f058b7a521c10b1ab728f3; academic_policies/accreditation_and_membership; Accreditation and Membership)

**Code Reference:** backend/rag_system/cleaned_chunked_cai_production_v4.json (f3705cfb85f058b7a521c10b1ab728f3; academic_policies/accreditation_and_membership; Accreditation and Membership)

**Defense Tip:** Do not add policy conditions not present in the chunk.

### Q039 - Medium

**Question:** What does the CAI policy corpus say about accreditation_and_membership?

**Expected Answer:** and is a member of the Arab Network for Quality Assurance in Higher Education

**Evidence Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (ffb8317467615c64c4b051bac88f42df; academic_policies/accreditation_and_membership; Accreditation and Membership)

**Code Reference:** backend/rag_system/cleaned_chunked_cai_production_v4.json (ffb8317467615c64c4b051bac88f42df; academic_policies/accreditation_and_membership; Accreditation and Membership)

**Defense Tip:** Do not add policy conditions not present in the chunk.

### Q040 - Medium

**Question:** What does the CAI policy corpus say about educational_quality_commitment?

**Expected Answer:** and continuously improving its programs to meet the needs of students

**Evidence Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (1ba9bec96ea734a2602a9652b89417e1; academic_policies/educational_quality_commitment; Educational Quality Commitment)

**Code Reference:** backend/rag_system/cleaned_chunked_cai_production_v4.json (1ba9bec96ea734a2602a9652b89417e1; academic_policies/educational_quality_commitment; Educational Quality Commitment)

**Defense Tip:** Do not add policy conditions not present in the chunk.

### Q041 - Medium

**Question:** What does the CAI policy corpus say about internal_and_external_evaluations?

**Expected Answer:** CAI regularly undergoes internal and external evaluations to ensure that it meets the quality standards set by accrediting bodies

**Evidence Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (44329014f0bb44c28c33130b922991d5; academic_policies/internal_and_external_evaluations; Internal and External Evaluations)

**Code Reference:** backend/rag_system/cleaned_chunked_cai_production_v4.json (44329014f0bb44c28c33130b922991d5; academic_policies/internal_and_external_evaluations; Internal and External Evaluations)

**Defense Tip:** Do not add policy conditions not present in the chunk.

### Q042 - Medium

**Question:** What does the CAI policy corpus say about ai_labs_and_learning?

**Expected Answer:** and applications. These labs include: The College of Artificial Intelligence offers to the staff

**Evidence Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (c9ca72142cc87cc8d5a4821759be5e7a; institutional/ai_labs_and_learning; AI Labs and Learning)

**Code Reference:** backend/rag_system/cleaned_chunked_cai_production_v4.json (c9ca72142cc87cc8d5a4821759be5e7a; institutional/ai_labs_and_learning; AI Labs and Learning)

**Defense Tip:** Do not add policy conditions not present in the chunk.

### Q043 - Medium

**Question:** What does the CAI policy corpus say about ai_labs_and_learning?

**Expected Answer:** and students a combination of basic labs as well as state-of-art research labs.

**Evidence Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (3b86419a99c0599de54947c310d27dbb; institutional/ai_labs_and_learning; AI Labs and Learning)

**Code Reference:** backend/rag_system/cleaned_chunked_cai_production_v4.json (3b86419a99c0599de54947c310d27dbb; institutional/ai_labs_and_learning; AI Labs and Learning)

**Defense Tip:** Do not add policy conditions not present in the chunk.

### Q044 - Medium

**Question:** What does the CAI policy corpus say about basic_ai_labs?

**Expected Answer:** The basic labs include: Computer Lab, Data Science Lab,

**Evidence Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (258d388de8d2c48e45b68c8c225e1f97; institutional/basic_ai_labs; Basic AI Labs)

**Code Reference:** backend/rag_system/cleaned_chunked_cai_production_v4.json (258d388de8d2c48e45b68c8c225e1f97; institutional/basic_ai_labs; Basic AI Labs)

**Defense Tip:** Do not add policy conditions not present in the chunk.

### Q045 - Medium

**Question:** What does the CAI policy corpus say about research_ai_labs?

**Expected Answer:** The research labs include: Natural Language Processing Lab,

**Evidence Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (56ab523ac0c6fbf60497ef700c47f68e; institutional/research_ai_labs; Research AI Labs)

**Code Reference:** backend/rag_system/cleaned_chunked_cai_production_v4.json (56ab523ac0c6fbf60497ef700c47f68e; institutional/research_ai_labs; Research AI Labs)

**Defense Tip:** Do not add policy conditions not present in the chunk.

### Q046 - Medium

**Question:** What does the CAI policy corpus say about lab_hardware_and_software?

**Expected Answer:** These labs are equipped with the latest hardware

**Evidence Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (703cc970d827de63739e757d2fae33e3; institutional/lab_hardware_and_software; Lab Hardware and Software)

**Code Reference:** backend/rag_system/cleaned_chunked_cai_production_v4.json (703cc970d827de63739e757d2fae33e3; institutional/lab_hardware_and_software; Lab Hardware and Software)

**Defense Tip:** Do not add policy conditions not present in the chunk.

### Q047 - Medium

**Question:** What does the CAI policy corpus say about accredited_summer_studies?

**Expected Answer:** Offering accredited summer studies for the students of the College of Artificial Intelligence

**Evidence Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (45732073764a4cf9565f39e280c97ef4; academic_programs/accredited_summer_studies; Accredited Summer Studies)

**Code Reference:** backend/rag_system/cleaned_chunked_cai_production_v4.json (45732073764a4cf9565f39e280c97ef4; academic_programs/accredited_summer_studies; Accredited Summer Studies)

**Defense Tip:** Do not add policy conditions not present in the chunk.

### Q048 - Medium

**Question:** What does the CAI policy corpus say about teaching_participation?

**Expected Answer:** Participation in the courses teaching activities both Face to Face Education

**Evidence Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (bfb4027cba35270b095791bf103fe4e7; academic_programs/teaching_participation; Teaching Participation)

**Code Reference:** backend/rag_system/cleaned_chunked_cai_production_v4.json (bfb4027cba35270b095791bf103fe4e7; academic_programs/teaching_participation; Teaching Participation)

**Defense Tip:** Do not add policy conditions not present in the chunk.

### Q049 - Medium

**Question:** What does the CAI policy corpus say about optional_uclan_summer_courses?

**Expected Answer:** Availability of accredited courses at the University of Central Lancashire during the summer semester,

**Evidence Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (ada0596af8dc3bab5a9beea4623ce348; academic_programs/optional_uclan_summer_courses; Optional UClan Summer Courses)

**Code Reference:** backend/rag_system/cleaned_chunked_cai_production_v4.json (ada0596af8dc3bab5a9beea4623ce348; academic_programs/optional_uclan_summer_courses; Optional UClan Summer Courses)

**Defense Tip:** Do not add policy conditions not present in the chunk.

### Q050 - Medium

**Question:** What does the CAI policy corpus say about optional_uclan_summer_courses?

**Expected Answer:** in which students of the College of Artificial Intelligence can enroll on an optional basis

**Evidence Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (9bdeb734932bc01bf99fea1c2d143e3e; academic_programs/optional_uclan_summer_courses; Optional UClan Summer Courses)

**Code Reference:** backend/rag_system/cleaned_chunked_cai_production_v4.json (9bdeb734932bc01bf99fea1c2d143e3e; academic_programs/optional_uclan_summer_courses; Optional UClan Summer Courses)

**Defense Tip:** Do not add policy conditions not present in the chunk.

## C. Hard Questions

### Q051 - Hard

**Question:** What does the CAI policy corpus say about undergraduate_admission_requirements?

**Expected Answer:** Students must meet the following admission requirements: Completion of secondary education certificate

**Evidence Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (b783fbd4fb54cb3352734b9250562069; admissions_registration/undergraduate_admission_requirements; Undergraduate Admission Requirements)

**Code Reference:** backend/rag_system/cleaned_chunked_cai_production_v4.json (b783fbd4fb54cb3352734b9250562069; admissions_registration/undergraduate_admission_requirements; Undergraduate Admission Requirements)

**Defense Tip:** Do not add policy conditions not present in the chunk.

### Q052 - Hard

**Question:** What does the CAI policy corpus say about undergraduate_admission_requirements?

**Expected Answer:** (Math section or Science Section) or equivalent certificates.

**Evidence Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (81289e0e3b8882abec68210e52c77727; admissions_registration/undergraduate_admission_requirements; Undergraduate Admission Requirements)

**Code Reference:** backend/rag_system/cleaned_chunked_cai_production_v4.json (81289e0e3b8882abec68210e52c77727; admissions_registration/undergraduate_admission_requirements; Undergraduate Admission Requirements)

**Defense Tip:** Do not add policy conditions not present in the chunk.

### Q053 - Hard

**Question:** What does the CAI policy corpus say about undergraduate_admission_requirements?

**Expected Answer:** Meeting the minimum score required to join the college which is announced

**Evidence Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (1521a01e1f408b771ee6ad64b46b283e; admissions_registration/undergraduate_admission_requirements; Undergraduate Admission Requirements)

**Code Reference:** backend/rag_system/cleaned_chunked_cai_production_v4.json (1521a01e1f408b771ee6ad64b46b283e; admissions_registration/undergraduate_admission_requirements; Undergraduate Admission Requirements)

**Defense Tip:** Do not add policy conditions not present in the chunk.

### Q054 - Hard

**Question:** What does the CAI policy corpus say about undergraduate_admission_requirements?

**Expected Answer:** before the beginning of each semester, in light of the minimum score mandated by AASTMT,

**Evidence Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (4babccacf0502e406ae693290a2ab8f1; admissions_registration/undergraduate_admission_requirements; Undergraduate Admission Requirements)

**Code Reference:** backend/rag_system/cleaned_chunked_cai_production_v4.json (4babccacf0502e406ae693290a2ab8f1; admissions_registration/undergraduate_admission_requirements; Undergraduate Admission Requirements)

**Defense Tip:** Do not add policy conditions not present in the chunk.

### Q055 - Hard

**Question:** What does the CAI policy corpus say about undergraduate_admission_requirements?

**Expected Answer:** as well as the annually announced terms, regulations

**Evidence Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (76368d2f22f3bc01385c9d6eaca2a401; admissions_registration/undergraduate_admission_requirements; Undergraduate Admission Requirements)

**Code Reference:** backend/rag_system/cleaned_chunked_cai_production_v4.json (76368d2f22f3bc01385c9d6eaca2a401; admissions_registration/undergraduate_admission_requirements; Undergraduate Admission Requirements)

**Defense Tip:** Do not add policy conditions not present in the chunk.

### Q056 - Hard

**Question:** What does the CAI policy corpus say about undergraduate_admission_requirements?

**Expected Answer:** and qualifying courses per certificate as specified by the AASTMT Supreme Council of Education Affairs.

**Evidence Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (388044f3e983c7f7074b7261c7aad62a; admissions_registration/undergraduate_admission_requirements; Undergraduate Admission Requirements)

**Code Reference:** backend/rag_system/cleaned_chunked_cai_production_v4.json (388044f3e983c7f7074b7261c7aad62a; admissions_registration/undergraduate_admission_requirements; Undergraduate Admission Requirements)

**Defense Tip:** Do not add policy conditions not present in the chunk.

### Q057 - Hard

**Question:** What does the CAI policy corpus say about undergraduate_admission_requirements?

**Expected Answer:** Showing good conduct with no dishonoring judicial sentence issued against them.

**Evidence Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (a5433ad8287a319206bb1ead0cb08112; admissions_registration/undergraduate_admission_requirements; Undergraduate Admission Requirements)

**Code Reference:** backend/rag_system/cleaned_chunked_cai_production_v4.json (a5433ad8287a319206bb1ead0cb08112; admissions_registration/undergraduate_admission_requirements; Undergraduate Admission Requirements)

**Defense Tip:** Do not add policy conditions not present in the chunk.

### Q058 - Hard

**Question:** What does the CAI policy corpus say about undergraduate_admission_requirements?

**Expected Answer:** Submission of all required admission documents. Approval of delegating entities

**Evidence Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (678a96642d9c5f58cf9b7970e76431a3; admissions_registration/undergraduate_admission_requirements; Undergraduate Admission Requirements)

**Code Reference:** backend/rag_system/cleaned_chunked_cai_production_v4.json (678a96642d9c5f58cf9b7970e76431a3; admissions_registration/undergraduate_admission_requirements; Undergraduate Admission Requirements)

**Defense Tip:** Do not add policy conditions not present in the chunk.

### Q059 - Hard

**Question:** What does the CAI policy corpus say about undergraduate_admission_requirements?

**Expected Answer:** in case of student’s delegation from any country

**Evidence Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (bd2cb19a5b8bdbe4634ab65f43a3c87a; admissions_registration/undergraduate_admission_requirements; Undergraduate Admission Requirements)

**Code Reference:** backend/rag_system/cleaned_chunked_cai_production_v4.json (bd2cb19a5b8bdbe4634ab65f43a3c87a; admissions_registration/undergraduate_admission_requirements; Undergraduate Admission Requirements)

**Defense Tip:** Do not add policy conditions not present in the chunk.

### Q060 - Hard

**Question:** What does the CAI policy corpus say about undergraduate_admission_requirements?

**Expected Answer:** or authority. Passing admission exams determined by AASTMT.

**Evidence Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (319393b64052058ce10954f351cce1ae; admissions_registration/undergraduate_admission_requirements; Undergraduate Admission Requirements)

**Code Reference:** backend/rag_system/cleaned_chunked_cai_production_v4.json (319393b64052058ce10954f351cce1ae; admissions_registration/undergraduate_admission_requirements; Undergraduate Admission Requirements)

**Defense Tip:** Do not add policy conditions not present in the chunk.

### Q061 - Hard

**Question:** What does the CAI policy corpus say about credit_hour_definition?

**Expected Answer:** Credit Hours: A Credit Hour for every semester week

**Evidence Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (bc8c5e26bc1a155d68f73849cc0e12aa; admissions_registration/credit_hour_definition; Credit Hour Definition)

**Code Reference:** backend/rag_system/cleaned_chunked_cai_production_v4.json (bc8c5e26bc1a155d68f73849cc0e12aa; admissions_registration/credit_hour_definition; Credit Hour Definition)

**Defense Tip:** Do not add policy conditions not present in the chunk.

### Q062 - Hard

**Question:** What does the CAI policy corpus say about credit_hour_definition?

**Expected Answer:** (CH) is equivalent to one hour of theoretical study

**Evidence Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (9593326abfa3b16adeda5db83bec4862; admissions_registration/credit_hour_definition; Credit Hour Definition)

**Code Reference:** backend/rag_system/cleaned_chunked_cai_production_v4.json (9593326abfa3b16adeda5db83bec4862; admissions_registration/credit_hour_definition; Credit Hour Definition)

**Defense Tip:** Do not add policy conditions not present in the chunk.

### Q063 - Hard

**Question:** What does the CAI policy corpus say about credit_hour_definition?

**Expected Answer:** (50 minutes) , not less than two hours of practical

**Evidence Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (22a11bf37f9a4387479229347e6b435f; admissions_registration/credit_hour_definition; Credit Hour Definition)

**Code Reference:** backend/rag_system/cleaned_chunked_cai_production_v4.json (22a11bf37f9a4387479229347e6b435f; admissions_registration/credit_hour_definition; Credit Hour Definition)

**Defense Tip:** Do not add policy conditions not present in the chunk.

### Q064 - Hard

**Question:** What does the CAI policy corpus say about credit_hour_definition?

**Expected Answer:** or three hours of practical or applied work.

**Evidence Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (8c671a5689d05f59e89a34c5a882ad16; admissions_registration/credit_hour_definition; Credit Hour Definition)

**Code Reference:** backend/rag_system/cleaned_chunked_cai_production_v4.json (8c671a5689d05f59e89a34c5a882ad16; admissions_registration/credit_hour_definition; Credit Hour Definition)

**Defense Tip:** Do not add policy conditions not present in the chunk.

### Q065 - Hard

**Question:** What does the CAI policy corpus say about semester_course_load?

**Expected Answer:** The CH determines the course load a student is allowed to register for in each semester.

**Evidence Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (278335842bcc3c12379170e14d75702b; admissions_registration/semester_course_load; Semester Course Load)

**Code Reference:** backend/rag_system/cleaned_chunked_cai_production_v4.json (278335842bcc3c12379170e14d75702b; admissions_registration/semester_course_load; Semester Course Load)

**Defense Tip:** Do not add policy conditions not present in the chunk.

### Q066 - Hard

**Question:** What must be fixed before final metrics?

**Expected Answer:** Route/source labels, live KG indexes, live RAG index, golden path failure, and rerun reports.

**Evidence Source:** backend/testing/route_accuracy_report.json; backend/testing/retrieval_report.json; backend/testing/golden_path_benchmark_report.json

**Code Reference:** backend/testing/route_accuracy_report.json; backend/testing/retrieval_report.json; backend/testing/golden_path_benchmark_report.json

**Defense Tip:** Give the repair list.

### Q067 - Hard

**Question:** Why can a graph triple exist but live KG retrieval fail?

**Expected Answer:** Static data can exist while live Neo4j indexes, embeddings, aliases, or container state fail to retrieve it.

**Evidence Source:** backend/services/neo4jcontext.js:3191-3459

**Code Reference:** backend/services/neo4jcontext.js:3191-3459

**Defense Tip:** Separate data existence from runtime proof.

### Q068 - Hard

**Question:** Why can RAG recall be zero with many chunks?

**Expected Answer:** Corpus size does not prove retriever recall; endpoint health, indexing, labels, and evaluator expectations still matter.

**Evidence Source:** backend/services/ragService.js:558-718

**Code Reference:** backend/services/ragService.js:558-718

**Defense Tip:** Do not equate corpus size with recall.

### Q069 - Hard

**Question:** Why is KG_DIRECT versus KG_ONLY risky?

**Expected Answer:** A benchmark can score a correct KG answer wrong if expected route labels do not map to runtime route labels.

**Evidence Source:** backend/services/brainRouter.js:37-47; backend/services/responseFormatter.js:30-96

**Code Reference:** backend/services/brainRouter.js:37-47; backend/services/responseFormatter.js:30-96

**Defense Tip:** Call it a contract issue.

### Q070 - Hard

**Question:** What is the Hany golden-path risk?

**Expected Answer:** The golden report shows a named-profile failure, so that demo must not be used until fixed.

**Evidence Source:** backend/testing/golden_path_benchmark_report.json

**Code Reference:** backend/testing/golden_path_benchmark_report.json

**Defense Tip:** Name the failed class of query.

### Q071 - Hard

**Question:** Where can hallucination still enter?

**Expected Answer:** Unified synthesis, fallback LLM, and backup synthesis can still hallucinate if guardrails fail.

**Evidence Source:** backend/services/unifiedAnswerService.js:2145-2585; backend/services/unifiedAnswerService.js:1169-1200

**Code Reference:** backend/services/unifiedAnswerService.js:2145-2585; backend/services/unifiedAnswerService.js:1169-1200

**Defense Tip:** Acknowledge residual risk.

### Q072 - Hard

**Question:** Can the committee break the system?

**Expected Answer:** Yes, using failed golden paths, broad policy RAG questions, hybrid questions, route-label mismatch, or security questions.

**Evidence Source:** backend/testing/golden_path_benchmark_report.json; backend/testing/retrieval_report.json

**Code Reference:** backend/testing/golden_path_benchmark_report.json; backend/testing/retrieval_report.json

**Defense Tip:** Answer yes and explain.

### Q073 - Hard

**Question:** What should a no-evidence answer say?

**Expected Answer:** It should report insufficient information or NO EVIDENCE FOUND in audits, not invent facts.

**Evidence Source:** backend/services/unifiedAnswerService.js:1169-1200

**Code Reference:** backend/services/unifiedAnswerService.js:1169-1200

**Defense Tip:** This is the safest answer.

### Q074 - Hard

**Question:** What must be fixed before final metrics?

**Expected Answer:** Route/source labels, live KG indexes, live RAG index, golden path failure, and rerun reports.

**Evidence Source:** backend/testing/route_accuracy_report.json; backend/testing/retrieval_report.json; backend/testing/golden_path_benchmark_report.json

**Code Reference:** backend/testing/route_accuracy_report.json; backend/testing/retrieval_report.json; backend/testing/golden_path_benchmark_report.json

**Defense Tip:** Give the repair list.

### Q075 - Hard

**Question:** Why can a graph triple exist but live KG retrieval fail?

**Expected Answer:** Static data can exist while live Neo4j indexes, embeddings, aliases, or container state fail to retrieve it.

**Evidence Source:** backend/services/neo4jcontext.js:3191-3459

**Code Reference:** backend/services/neo4jcontext.js:3191-3459

**Defense Tip:** Separate data existence from runtime proof.

### Q076 - Hard

**Question:** Why can RAG recall be zero with many chunks?

**Expected Answer:** Corpus size does not prove retriever recall; endpoint health, indexing, labels, and evaluator expectations still matter.

**Evidence Source:** backend/services/ragService.js:558-718

**Code Reference:** backend/services/ragService.js:558-718

**Defense Tip:** Do not equate corpus size with recall.

### Q077 - Hard

**Question:** Why is KG_DIRECT versus KG_ONLY risky?

**Expected Answer:** A benchmark can score a correct KG answer wrong if expected route labels do not map to runtime route labels.

**Evidence Source:** backend/services/brainRouter.js:37-47; backend/services/responseFormatter.js:30-96

**Code Reference:** backend/services/brainRouter.js:37-47; backend/services/responseFormatter.js:30-96

**Defense Tip:** Call it a contract issue.

### Q078 - Hard

**Question:** What is the Hany golden-path risk?

**Expected Answer:** The golden report shows a named-profile failure, so that demo must not be used until fixed.

**Evidence Source:** backend/testing/golden_path_benchmark_report.json

**Code Reference:** backend/testing/golden_path_benchmark_report.json

**Defense Tip:** Name the failed class of query.

### Q079 - Hard

**Question:** Where can hallucination still enter?

**Expected Answer:** Unified synthesis, fallback LLM, and backup synthesis can still hallucinate if guardrails fail.

**Evidence Source:** backend/services/unifiedAnswerService.js:2145-2585; backend/services/unifiedAnswerService.js:1169-1200

**Code Reference:** backend/services/unifiedAnswerService.js:2145-2585; backend/services/unifiedAnswerService.js:1169-1200

**Defense Tip:** Acknowledge residual risk.

### Q080 - Hard

**Question:** Can the committee break the system?

**Expected Answer:** Yes, using failed golden paths, broad policy RAG questions, hybrid questions, route-label mismatch, or security questions.

**Evidence Source:** backend/testing/golden_path_benchmark_report.json; backend/testing/retrieval_report.json

**Code Reference:** backend/testing/golden_path_benchmark_report.json; backend/testing/retrieval_report.json

**Defense Tip:** Answer yes and explain.

### Q081 - Hard

**Question:** What should a no-evidence answer say?

**Expected Answer:** It should report insufficient information or NO EVIDENCE FOUND in audits, not invent facts.

**Evidence Source:** backend/services/unifiedAnswerService.js:1169-1200

**Code Reference:** backend/services/unifiedAnswerService.js:1169-1200

**Defense Tip:** This is the safest answer.

### Q082 - Hard

**Question:** What must be fixed before final metrics?

**Expected Answer:** Route/source labels, live KG indexes, live RAG index, golden path failure, and rerun reports.

**Evidence Source:** backend/testing/route_accuracy_report.json; backend/testing/retrieval_report.json; backend/testing/golden_path_benchmark_report.json

**Code Reference:** backend/testing/route_accuracy_report.json; backend/testing/retrieval_report.json; backend/testing/golden_path_benchmark_report.json

**Defense Tip:** Give the repair list.

### Q083 - Hard

**Question:** Why can a graph triple exist but live KG retrieval fail?

**Expected Answer:** Static data can exist while live Neo4j indexes, embeddings, aliases, or container state fail to retrieve it.

**Evidence Source:** backend/services/neo4jcontext.js:3191-3459

**Code Reference:** backend/services/neo4jcontext.js:3191-3459

**Defense Tip:** Separate data existence from runtime proof.

### Q084 - Hard

**Question:** Why can RAG recall be zero with many chunks?

**Expected Answer:** Corpus size does not prove retriever recall; endpoint health, indexing, labels, and evaluator expectations still matter.

**Evidence Source:** backend/services/ragService.js:558-718

**Code Reference:** backend/services/ragService.js:558-718

**Defense Tip:** Do not equate corpus size with recall.

### Q085 - Hard

**Question:** Why is KG_DIRECT versus KG_ONLY risky?

**Expected Answer:** A benchmark can score a correct KG answer wrong if expected route labels do not map to runtime route labels.

**Evidence Source:** backend/services/brainRouter.js:37-47; backend/services/responseFormatter.js:30-96

**Code Reference:** backend/services/brainRouter.js:37-47; backend/services/responseFormatter.js:30-96

**Defense Tip:** Call it a contract issue.

### Q086 - Hard

**Question:** What is the Hany golden-path risk?

**Expected Answer:** The golden report shows a named-profile failure, so that demo must not be used until fixed.

**Evidence Source:** backend/testing/golden_path_benchmark_report.json

**Code Reference:** backend/testing/golden_path_benchmark_report.json

**Defense Tip:** Name the failed class of query.

### Q087 - Hard

**Question:** Where can hallucination still enter?

**Expected Answer:** Unified synthesis, fallback LLM, and backup synthesis can still hallucinate if guardrails fail.

**Evidence Source:** backend/services/unifiedAnswerService.js:2145-2585; backend/services/unifiedAnswerService.js:1169-1200

**Code Reference:** backend/services/unifiedAnswerService.js:2145-2585; backend/services/unifiedAnswerService.js:1169-1200

**Defense Tip:** Acknowledge residual risk.

### Q088 - Hard

**Question:** Can the committee break the system?

**Expected Answer:** Yes, using failed golden paths, broad policy RAG questions, hybrid questions, route-label mismatch, or security questions.

**Evidence Source:** backend/testing/golden_path_benchmark_report.json; backend/testing/retrieval_report.json

**Code Reference:** backend/testing/golden_path_benchmark_report.json; backend/testing/retrieval_report.json

**Defense Tip:** Answer yes and explain.

### Q089 - Hard

**Question:** What should a no-evidence answer say?

**Expected Answer:** It should report insufficient information or NO EVIDENCE FOUND in audits, not invent facts.

**Evidence Source:** backend/services/unifiedAnswerService.js:1169-1200

**Code Reference:** backend/services/unifiedAnswerService.js:1169-1200

**Defense Tip:** This is the safest answer.

### Q090 - Hard

**Question:** What must be fixed before final metrics?

**Expected Answer:** Route/source labels, live KG indexes, live RAG index, golden path failure, and rerun reports.

**Evidence Source:** backend/testing/route_accuracy_report.json; backend/testing/retrieval_report.json; backend/testing/golden_path_benchmark_report.json

**Code Reference:** backend/testing/route_accuracy_report.json; backend/testing/retrieval_report.json; backend/testing/golden_path_benchmark_report.json

**Defense Tip:** Give the repair list.

## D. Killer Questions

### Q091 - Killer

**Question:** Why can a graph triple exist but live KG retrieval fail?

**Expected Answer:** Static data can exist while live Neo4j indexes, embeddings, aliases, or container state fail to retrieve it.

**Evidence Source:** backend/services/neo4jcontext.js:3191-3459

**Code Reference:** backend/services/neo4jcontext.js:3191-3459

**Defense Tip:** Separate data existence from runtime proof.

### Q092 - Killer

**Question:** Why can RAG recall be zero with many chunks?

**Expected Answer:** Corpus size does not prove retriever recall; endpoint health, indexing, labels, and evaluator expectations still matter.

**Evidence Source:** backend/services/ragService.js:558-718

**Code Reference:** backend/services/ragService.js:558-718

**Defense Tip:** Do not equate corpus size with recall.

### Q093 - Killer

**Question:** Why is KG_DIRECT versus KG_ONLY risky?

**Expected Answer:** A benchmark can score a correct KG answer wrong if expected route labels do not map to runtime route labels.

**Evidence Source:** backend/services/brainRouter.js:37-47; backend/services/responseFormatter.js:30-96

**Code Reference:** backend/services/brainRouter.js:37-47; backend/services/responseFormatter.js:30-96

**Defense Tip:** Call it a contract issue.

### Q094 - Killer

**Question:** What is the Hany golden-path risk?

**Expected Answer:** The golden report shows a named-profile failure, so that demo must not be used until fixed.

**Evidence Source:** backend/testing/golden_path_benchmark_report.json

**Code Reference:** backend/testing/golden_path_benchmark_report.json

**Defense Tip:** Name the failed class of query.

### Q095 - Killer

**Question:** Where can hallucination still enter?

**Expected Answer:** Unified synthesis, fallback LLM, and backup synthesis can still hallucinate if guardrails fail.

**Evidence Source:** backend/services/unifiedAnswerService.js:2145-2585; backend/services/unifiedAnswerService.js:1169-1200

**Code Reference:** backend/services/unifiedAnswerService.js:2145-2585; backend/services/unifiedAnswerService.js:1169-1200

**Defense Tip:** Acknowledge residual risk.

### Q096 - Killer

**Question:** Can the committee break the system?

**Expected Answer:** Yes, using failed golden paths, broad policy RAG questions, hybrid questions, route-label mismatch, or security questions.

**Evidence Source:** backend/testing/golden_path_benchmark_report.json; backend/testing/retrieval_report.json

**Code Reference:** backend/testing/golden_path_benchmark_report.json; backend/testing/retrieval_report.json

**Defense Tip:** Answer yes and explain.

### Q097 - Killer

**Question:** What should a no-evidence answer say?

**Expected Answer:** It should report insufficient information or NO EVIDENCE FOUND in audits, not invent facts.

**Evidence Source:** backend/services/unifiedAnswerService.js:1169-1200

**Code Reference:** backend/services/unifiedAnswerService.js:1169-1200

**Defense Tip:** This is the safest answer.

### Q098 - Killer

**Question:** What must be fixed before final metrics?

**Expected Answer:** Route/source labels, live KG indexes, live RAG index, golden path failure, and rerun reports.

**Evidence Source:** backend/testing/route_accuracy_report.json; backend/testing/retrieval_report.json; backend/testing/golden_path_benchmark_report.json

**Code Reference:** backend/testing/route_accuracy_report.json; backend/testing/retrieval_report.json; backend/testing/golden_path_benchmark_report.json

**Defense Tip:** Give the repair list.

### Q099 - Killer

**Question:** Why can a graph triple exist but live KG retrieval fail?

**Expected Answer:** Static data can exist while live Neo4j indexes, embeddings, aliases, or container state fail to retrieve it.

**Evidence Source:** backend/services/neo4jcontext.js:3191-3459

**Code Reference:** backend/services/neo4jcontext.js:3191-3459

**Defense Tip:** Separate data existence from runtime proof.

### Q100 - Killer

**Question:** Why can RAG recall be zero with many chunks?

**Expected Answer:** Corpus size does not prove retriever recall; endpoint health, indexing, labels, and evaluator expectations still matter.

**Evidence Source:** backend/services/ragService.js:558-718

**Code Reference:** backend/services/ragService.js:558-718

**Defense Tip:** Do not equate corpus size with recall.

### Q101 - Killer

**Question:** Why is KG_DIRECT versus KG_ONLY risky?

**Expected Answer:** A benchmark can score a correct KG answer wrong if expected route labels do not map to runtime route labels.

**Evidence Source:** backend/services/brainRouter.js:37-47; backend/services/responseFormatter.js:30-96

**Code Reference:** backend/services/brainRouter.js:37-47; backend/services/responseFormatter.js:30-96

**Defense Tip:** Call it a contract issue.

### Q102 - Killer

**Question:** What is the Hany golden-path risk?

**Expected Answer:** The golden report shows a named-profile failure, so that demo must not be used until fixed.

**Evidence Source:** backend/testing/golden_path_benchmark_report.json

**Code Reference:** backend/testing/golden_path_benchmark_report.json

**Defense Tip:** Name the failed class of query.

### Q103 - Killer

**Question:** Where can hallucination still enter?

**Expected Answer:** Unified synthesis, fallback LLM, and backup synthesis can still hallucinate if guardrails fail.

**Evidence Source:** backend/services/unifiedAnswerService.js:2145-2585; backend/services/unifiedAnswerService.js:1169-1200

**Code Reference:** backend/services/unifiedAnswerService.js:2145-2585; backend/services/unifiedAnswerService.js:1169-1200

**Defense Tip:** Acknowledge residual risk.

### Q104 - Killer

**Question:** Can the committee break the system?

**Expected Answer:** Yes, using failed golden paths, broad policy RAG questions, hybrid questions, route-label mismatch, or security questions.

**Evidence Source:** backend/testing/golden_path_benchmark_report.json; backend/testing/retrieval_report.json

**Code Reference:** backend/testing/golden_path_benchmark_report.json; backend/testing/retrieval_report.json

**Defense Tip:** Answer yes and explain.

### Q105 - Killer

**Question:** What should a no-evidence answer say?

**Expected Answer:** It should report insufficient information or NO EVIDENCE FOUND in audits, not invent facts.

**Evidence Source:** backend/services/unifiedAnswerService.js:1169-1200

**Code Reference:** backend/services/unifiedAnswerService.js:1169-1200

**Defense Tip:** This is the safest answer.

### Q106 - Killer

**Question:** What must be fixed before final metrics?

**Expected Answer:** Route/source labels, live KG indexes, live RAG index, golden path failure, and rerun reports.

**Evidence Source:** backend/testing/route_accuracy_report.json; backend/testing/retrieval_report.json; backend/testing/golden_path_benchmark_report.json

**Code Reference:** backend/testing/route_accuracy_report.json; backend/testing/retrieval_report.json; backend/testing/golden_path_benchmark_report.json

**Defense Tip:** Give the repair list.

### Q107 - Killer

**Question:** Why can a graph triple exist but live KG retrieval fail?

**Expected Answer:** Static data can exist while live Neo4j indexes, embeddings, aliases, or container state fail to retrieve it.

**Evidence Source:** backend/services/neo4jcontext.js:3191-3459

**Code Reference:** backend/services/neo4jcontext.js:3191-3459

**Defense Tip:** Separate data existence from runtime proof.

### Q108 - Killer

**Question:** Why can RAG recall be zero with many chunks?

**Expected Answer:** Corpus size does not prove retriever recall; endpoint health, indexing, labels, and evaluator expectations still matter.

**Evidence Source:** backend/services/ragService.js:558-718

**Code Reference:** backend/services/ragService.js:558-718

**Defense Tip:** Do not equate corpus size with recall.

### Q109 - Killer

**Question:** Why is KG_DIRECT versus KG_ONLY risky?

**Expected Answer:** A benchmark can score a correct KG answer wrong if expected route labels do not map to runtime route labels.

**Evidence Source:** backend/services/brainRouter.js:37-47; backend/services/responseFormatter.js:30-96

**Code Reference:** backend/services/brainRouter.js:37-47; backend/services/responseFormatter.js:30-96

**Defense Tip:** Call it a contract issue.

### Q110 - Killer

**Question:** What is the Hany golden-path risk?

**Expected Answer:** The golden report shows a named-profile failure, so that demo must not be used until fixed.

**Evidence Source:** backend/testing/golden_path_benchmark_report.json

**Code Reference:** backend/testing/golden_path_benchmark_report.json

**Defense Tip:** Name the failed class of query.

### Q111 - Killer

**Question:** Where can hallucination still enter?

**Expected Answer:** Unified synthesis, fallback LLM, and backup synthesis can still hallucinate if guardrails fail.

**Evidence Source:** backend/services/unifiedAnswerService.js:2145-2585; backend/services/unifiedAnswerService.js:1169-1200

**Code Reference:** backend/services/unifiedAnswerService.js:2145-2585; backend/services/unifiedAnswerService.js:1169-1200

**Defense Tip:** Acknowledge residual risk.

### Q112 - Killer

**Question:** Can the committee break the system?

**Expected Answer:** Yes, using failed golden paths, broad policy RAG questions, hybrid questions, route-label mismatch, or security questions.

**Evidence Source:** backend/testing/golden_path_benchmark_report.json; backend/testing/retrieval_report.json

**Code Reference:** backend/testing/golden_path_benchmark_report.json; backend/testing/retrieval_report.json

**Defense Tip:** Answer yes and explain.

### Q113 - Killer

**Question:** What should a no-evidence answer say?

**Expected Answer:** It should report insufficient information or NO EVIDENCE FOUND in audits, not invent facts.

**Evidence Source:** backend/services/unifiedAnswerService.js:1169-1200

**Code Reference:** backend/services/unifiedAnswerService.js:1169-1200

**Defense Tip:** This is the safest answer.

### Q114 - Killer

**Question:** What must be fixed before final metrics?

**Expected Answer:** Route/source labels, live KG indexes, live RAG index, golden path failure, and rerun reports.

**Evidence Source:** backend/testing/route_accuracy_report.json; backend/testing/retrieval_report.json; backend/testing/golden_path_benchmark_report.json

**Code Reference:** backend/testing/route_accuracy_report.json; backend/testing/retrieval_report.json; backend/testing/golden_path_benchmark_report.json

**Defense Tip:** Give the repair list.

### Q115 - Killer

**Question:** Why can a graph triple exist but live KG retrieval fail?

**Expected Answer:** Static data can exist while live Neo4j indexes, embeddings, aliases, or container state fail to retrieve it.

**Evidence Source:** backend/services/neo4jcontext.js:3191-3459

**Code Reference:** backend/services/neo4jcontext.js:3191-3459

**Defense Tip:** Separate data existence from runtime proof.

### Q116 - Killer

**Question:** Why can RAG recall be zero with many chunks?

**Expected Answer:** Corpus size does not prove retriever recall; endpoint health, indexing, labels, and evaluator expectations still matter.

**Evidence Source:** backend/services/ragService.js:558-718

**Code Reference:** backend/services/ragService.js:558-718

**Defense Tip:** Do not equate corpus size with recall.

### Q117 - Killer

**Question:** Why is KG_DIRECT versus KG_ONLY risky?

**Expected Answer:** A benchmark can score a correct KG answer wrong if expected route labels do not map to runtime route labels.

**Evidence Source:** backend/services/brainRouter.js:37-47; backend/services/responseFormatter.js:30-96

**Code Reference:** backend/services/brainRouter.js:37-47; backend/services/responseFormatter.js:30-96

**Defense Tip:** Call it a contract issue.

### Q118 - Killer

**Question:** What is the Hany golden-path risk?

**Expected Answer:** The golden report shows a named-profile failure, so that demo must not be used until fixed.

**Evidence Source:** backend/testing/golden_path_benchmark_report.json

**Code Reference:** backend/testing/golden_path_benchmark_report.json

**Defense Tip:** Name the failed class of query.

### Q119 - Killer

**Question:** Where can hallucination still enter?

**Expected Answer:** Unified synthesis, fallback LLM, and backup synthesis can still hallucinate if guardrails fail.

**Evidence Source:** backend/services/unifiedAnswerService.js:2145-2585; backend/services/unifiedAnswerService.js:1169-1200

**Code Reference:** backend/services/unifiedAnswerService.js:2145-2585; backend/services/unifiedAnswerService.js:1169-1200

**Defense Tip:** Acknowledge residual risk.

### Q120 - Killer

**Question:** Can the committee break the system?

**Expected Answer:** Yes, using failed golden paths, broad policy RAG questions, hybrid questions, route-label mismatch, or security questions.

**Evidence Source:** backend/testing/golden_path_benchmark_report.json; backend/testing/retrieval_report.json

**Code Reference:** backend/testing/golden_path_benchmark_report.json; backend/testing/retrieval_report.json

**Defense Tip:** Answer yes and explain.

## E. Architecture Questions

### Q121 - Architecture

**Question:** How does orchestrator separate routing from synthesis?

**Expected Answer:** BrainRouter selects routes; UnifiedAnswerService synthesizes after evidence collection.

**Evidence Source:** backend/orchestrator.js:1132-1301; backend/services/unifiedAnswerService.js:2145-2585

**Code Reference:** backend/orchestrator.js:1132-1301; backend/services/unifiedAnswerService.js:2145-2585

**Defense Tip:** Use subsystem boundaries.

### Q122 - Architecture

**Question:** How does orchestrator separate routing from synthesis?

**Expected Answer:** BrainRouter selects routes; UnifiedAnswerService synthesizes after evidence collection.

**Evidence Source:** backend/orchestrator.js:1132-1301; backend/services/unifiedAnswerService.js:2145-2585

**Code Reference:** backend/orchestrator.js:1132-1301; backend/services/unifiedAnswerService.js:2145-2585

**Defense Tip:** Use subsystem boundaries.

### Q123 - Architecture

**Question:** How does orchestrator separate routing from synthesis?

**Expected Answer:** BrainRouter selects routes; UnifiedAnswerService synthesizes after evidence collection.

**Evidence Source:** backend/orchestrator.js:1132-1301; backend/services/unifiedAnswerService.js:2145-2585

**Code Reference:** backend/orchestrator.js:1132-1301; backend/services/unifiedAnswerService.js:2145-2585

**Defense Tip:** Use subsystem boundaries.

## F. Knowledge Graph Questions

### Q124 - KG

**Question:** Which KG relationships are safest?

**Expected Answer:** TEACHES, HAS_COURSE, HAS_PREREQUISITE, HAS_FACILITY, CONTAINS_COMPONENT, PART_OF_TRACK, and governance relationships.

**Evidence Source:** backend/data/clean_graph.json

**Code Reference:** backend/data/clean_graph.json

**Defense Tip:** Use exact relationship names.

### Q125 - KG

**Question:** Which KG relationships are safest?

**Expected Answer:** TEACHES, HAS_COURSE, HAS_PREREQUISITE, HAS_FACILITY, CONTAINS_COMPONENT, PART_OF_TRACK, and governance relationships.

**Evidence Source:** backend/data/clean_graph.json

**Code Reference:** backend/data/clean_graph.json

**Defense Tip:** Use exact relationship names.

### Q126 - KG

**Question:** Which KG relationships are safest?

**Expected Answer:** TEACHES, HAS_COURSE, HAS_PREREQUISITE, HAS_FACILITY, CONTAINS_COMPONENT, PART_OF_TRACK, and governance relationships.

**Evidence Source:** backend/data/clean_graph.json

**Code Reference:** backend/data/clean_graph.json

**Defense Tip:** Use exact relationship names.

## G. RAG Questions

### Q127 - RAG

**Question:** Which policy areas are strongest in RAG?

**Expected Answer:** Admissions, scholarships, GPA, credit hours, semester load, transfer, tuition, MSc, compliance, and infrastructure.

**Evidence Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json

**Code Reference:** backend/rag_system/cleaned_chunked_cai_production_v4.json

**Defense Tip:** Use category evidence.

### Q128 - RAG

**Question:** Which policy areas are strongest in RAG?

**Expected Answer:** Admissions, scholarships, GPA, credit hours, semester load, transfer, tuition, MSc, compliance, and infrastructure.

**Evidence Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json

**Code Reference:** backend/rag_system/cleaned_chunked_cai_production_v4.json

**Defense Tip:** Use category evidence.

### Q129 - RAG

**Question:** Which policy areas are strongest in RAG?

**Expected Answer:** Admissions, scholarships, GPA, credit hours, semester load, transfer, tuition, MSc, compliance, and infrastructure.

**Evidence Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json

**Code Reference:** backend/rag_system/cleaned_chunked_cai_production_v4.json

**Defense Tip:** Use category evidence.

## H. Hybrid Questions

### Q130 - Hybrid

**Question:** What is the best hybrid demo?

**Expected Answer:** Ask for a structured course/program fact plus an admission, scholarship, GPA, or tuition policy condition.

**Evidence Source:** backend/data/clean_graph.json; backend/rag_system/cleaned_chunked_cai_production_v4.json

**Code Reference:** backend/data/clean_graph.json; backend/rag_system/cleaned_chunked_cai_production_v4.json

**Defense Tip:** Show both sources.

### Q131 - Hybrid

**Question:** What is the best hybrid demo?

**Expected Answer:** Ask for a structured course/program fact plus an admission, scholarship, GPA, or tuition policy condition.

**Evidence Source:** backend/data/clean_graph.json; backend/rag_system/cleaned_chunked_cai_production_v4.json

**Code Reference:** backend/data/clean_graph.json; backend/rag_system/cleaned_chunked_cai_production_v4.json

**Defense Tip:** Show both sources.

### Q132 - Hybrid

**Question:** What is the best hybrid demo?

**Expected Answer:** Ask for a structured course/program fact plus an admission, scholarship, GPA, or tuition policy condition.

**Evidence Source:** backend/data/clean_graph.json; backend/rag_system/cleaned_chunked_cai_production_v4.json

**Code Reference:** backend/data/clean_graph.json; backend/rag_system/cleaned_chunked_cai_production_v4.json

**Defense Tip:** Show both sources.

## I. Decision Engine Questions

### Q133 - Decision

**Question:** Why is advising safer than plain generation?

**Expected Answer:** The decision engine validates user profile fields and can ask for missing data before recommending.

**Evidence Source:** backend/services/decisionService.js:632-819

**Code Reference:** backend/services/decisionService.js:632-819

**Defense Tip:** Safety over fluency.

### Q134 - Decision

**Question:** Why is advising safer than plain generation?

**Expected Answer:** The decision engine validates user profile fields and can ask for missing data before recommending.

**Evidence Source:** backend/services/decisionService.js:632-819

**Code Reference:** backend/services/decisionService.js:632-819

**Defense Tip:** Safety over fluency.

### Q135 - Decision

**Question:** Why is advising safer than plain generation?

**Expected Answer:** The decision engine validates user profile fields and can ask for missing data before recommending.

**Evidence Source:** backend/services/decisionService.js:632-819

**Code Reference:** backend/services/decisionService.js:632-819

**Defense Tip:** Safety over fluency.

## J. Brain Router Questions

### Q136 - Brain Router

**Question:** Is BrainRouter production ready?

**Expected Answer:** PASS WITH RECOMMENDATIONS as architecture; PARTIAL as proven runtime reliability.

**Evidence Source:** backend/services/brainRouter.js:1059-1452; backend/testing/route_accuracy_report.json

**Code Reference:** backend/services/brainRouter.js:1059-1452; backend/testing/route_accuracy_report.json

**Defense Tip:** Give nuanced verdict.

### Q137 - Brain Router

**Question:** Is BrainRouter production ready?

**Expected Answer:** PASS WITH RECOMMENDATIONS as architecture; PARTIAL as proven runtime reliability.

**Evidence Source:** backend/services/brainRouter.js:1059-1452; backend/testing/route_accuracy_report.json

**Code Reference:** backend/services/brainRouter.js:1059-1452; backend/testing/route_accuracy_report.json

**Defense Tip:** Give nuanced verdict.

### Q138 - Brain Router

**Question:** Is BrainRouter production ready?

**Expected Answer:** PASS WITH RECOMMENDATIONS as architecture; PARTIAL as proven runtime reliability.

**Evidence Source:** backend/services/brainRouter.js:1059-1452; backend/testing/route_accuracy_report.json

**Code Reference:** backend/services/brainRouter.js:1059-1452; backend/testing/route_accuracy_report.json

**Defense Tip:** Give nuanced verdict.

## K. Deployment Questions

### Q139 - Deployment

**Question:** What must be checked before live defense?

**Expected Answer:** Canonical root, live endpoints, Neo4j indexes, retriever index, Ollama state, and fresh benchmark reports.

**Evidence Source:** backend/services/neo4jcontext.js:3191-3459; backend/services/ragService.js:558-718

**Code Reference:** backend/services/neo4jcontext.js:3191-3459; backend/services/ragService.js:558-718

**Defense Tip:** Use checklist language.

### Q140 - Deployment

**Question:** What must be checked before live defense?

**Expected Answer:** Canonical root, live endpoints, Neo4j indexes, retriever index, Ollama state, and fresh benchmark reports.

**Evidence Source:** backend/services/neo4jcontext.js:3191-3459; backend/services/ragService.js:558-718

**Code Reference:** backend/services/neo4jcontext.js:3191-3459; backend/services/ragService.js:558-718

**Defense Tip:** Use checklist language.

### Q141 - Deployment

**Question:** What must be checked before live defense?

**Expected Answer:** Canonical root, live endpoints, Neo4j indexes, retriever index, Ollama state, and fresh benchmark reports.

**Evidence Source:** backend/services/neo4jcontext.js:3191-3459; backend/services/ragService.js:558-718

**Code Reference:** backend/services/neo4jcontext.js:3191-3459; backend/services/ragService.js:558-718

**Defense Tip:** Use checklist language.

## L. Performance Questions

### Q142 - Performance

**Question:** What latency risks exist?

**Expected Answer:** Local LLM cold start, retriever timeout, hybrid parallel calls, and backup synthesis.

**Evidence Source:** backend/services/circuitStateManager.js:1-258; backend/services/ragService.js:1337-1510

**Code Reference:** backend/services/circuitStateManager.js:1-258; backend/services/ragService.js:1337-1510

**Defense Tip:** Mention mitigation.

### Q143 - Performance

**Question:** What latency risks exist?

**Expected Answer:** Local LLM cold start, retriever timeout, hybrid parallel calls, and backup synthesis.

**Evidence Source:** backend/services/circuitStateManager.js:1-258; backend/services/ragService.js:1337-1510

**Code Reference:** backend/services/circuitStateManager.js:1-258; backend/services/ragService.js:1337-1510

**Defense Tip:** Mention mitigation.

### Q144 - Performance

**Question:** What latency risks exist?

**Expected Answer:** Local LLM cold start, retriever timeout, hybrid parallel calls, and backup synthesis.

**Evidence Source:** backend/services/circuitStateManager.js:1-258; backend/services/ragService.js:1337-1510

**Code Reference:** backend/services/circuitStateManager.js:1-258; backend/services/ragService.js:1337-1510

**Defense Tip:** Mention mitigation.

## M. Security Questions

### Q145 - Security

**Question:** Is prompt-injection safety fully proven?

**Expected Answer:** NO EVIDENCE FOUND for a full prompt-injection benchmark in the audited package.

**Evidence Source:** backend/services/unifiedAnswerService.js:1169-1200; backend/testing/retrieval_report.json

**Code Reference:** backend/services/unifiedAnswerService.js:1169-1200; backend/testing/retrieval_report.json

**Defense Tip:** Do not overclaim.

### Q146 - Security

**Question:** Is prompt-injection safety fully proven?

**Expected Answer:** NO EVIDENCE FOUND for a full prompt-injection benchmark in the audited package.

**Evidence Source:** backend/services/unifiedAnswerService.js:1169-1200; backend/testing/retrieval_report.json

**Code Reference:** backend/services/unifiedAnswerService.js:1169-1200; backend/testing/retrieval_report.json

**Defense Tip:** Do not overclaim.

### Q147 - Security

**Question:** Is prompt-injection safety fully proven?

**Expected Answer:** NO EVIDENCE FOUND for a full prompt-injection benchmark in the audited package.

**Evidence Source:** backend/services/unifiedAnswerService.js:1169-1200; backend/testing/retrieval_report.json

**Code Reference:** backend/services/unifiedAnswerService.js:1169-1200; backend/testing/retrieval_report.json

**Defense Tip:** Do not overclaim.

## N. Thesis Integration Questions

### Q148 - Thesis

**Question:** What should Chapter 5 avoid?

**Expected Answer:** Unsupported high scores or publication-ready claims not proven by current reports.

**Evidence Source:** backend/testing/route_accuracy_report.json; backend/testing/retrieval_report.json

**Code Reference:** backend/testing/route_accuracy_report.json; backend/testing/retrieval_report.json

**Defense Tip:** Protect the thesis.

### Q149 - Thesis

**Question:** What should Chapter 5 avoid?

**Expected Answer:** Unsupported high scores or publication-ready claims not proven by current reports.

**Evidence Source:** backend/testing/route_accuracy_report.json; backend/testing/retrieval_report.json

**Code Reference:** backend/testing/route_accuracy_report.json; backend/testing/retrieval_report.json

**Defense Tip:** Protect the thesis.

### Q150 - Thesis

**Question:** What should Chapter 5 avoid?

**Expected Answer:** Unsupported high scores or publication-ready claims not proven by current reports.

**Evidence Source:** backend/testing/route_accuracy_report.json; backend/testing/retrieval_report.json

**Code Reference:** backend/testing/route_accuracy_report.json; backend/testing/retrieval_report.json

**Defense Tip:** Protect the thesis.

