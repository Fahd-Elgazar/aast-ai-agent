# WOW Demo Questions

These are proposed live-demo questions grounded in the audited workspace. They are not passing-result claims until run live and logged.

| Demo Type | Required | Generated |
|---|---:|---:|
| KG | 30 | 30 |
| RAG | 30 | 30 |
| Hybrid | 30 | 30 |
| Decision | 20 | 20 |

## KG Demos

### KG-01

**Question:** Which facility is available to College of Artificial Intelligence?

**Expected Route:** KG_DIRECT

**Expected Source:** backend/data/clean_graph.json (HAS_FACILITY: College of Artificial Intelligence -> Robotics Lab)

**Expected Answer Summary:** College of Artificial Intelligence has facility Robotics Lab.

**Why This Is Impressive:** Shows deterministic graph grounding with an auditable relationship.

### KG-02

**Question:** Which facility is available to College of Artificial Intelligence?

**Expected Route:** KG_DIRECT

**Expected Source:** backend/data/clean_graph.json (HAS_FACILITY: College of Artificial Intelligence -> Virtual Reality Lab)

**Expected Answer Summary:** College of Artificial Intelligence has facility Virtual Reality Lab.

**Why This Is Impressive:** Shows deterministic graph grounding with an auditable relationship.

### KG-03

**Question:** Which facility is available to College of Artificial Intelligence?

**Expected Route:** KG_DIRECT

**Expected Source:** backend/data/clean_graph.json (HAS_FACILITY: College of Artificial Intelligence -> IoT Lab)

**Expected Answer Summary:** College of Artificial Intelligence has facility IoT Lab.

**Why This Is Impressive:** Shows deterministic graph grounding with an auditable relationship.

### KG-04

**Question:** Which facility is available to College of Artificial Intelligence?

**Expected Route:** KG_DIRECT

**Expected Source:** backend/data/clean_graph.json (HAS_FACILITY: College of Artificial Intelligence -> Basic Electronic Lab)

**Expected Answer Summary:** College of Artificial Intelligence has facility Basic Electronic Lab.

**Why This Is Impressive:** Shows deterministic graph grounding with an auditable relationship.

### KG-05

**Question:** Which facility is available to College of Artificial Intelligence?

**Expected Route:** KG_DIRECT

**Expected Source:** backend/data/clean_graph.json (HAS_FACILITY: College of Artificial Intelligence -> Physics Lab)

**Expected Answer Summary:** College of Artificial Intelligence has facility Physics Lab.

**Why This Is Impressive:** Shows deterministic graph grounding with an auditable relationship.

### KG-06

**Question:** Which facility is available to College of Artificial Intelligence?

**Expected Route:** KG_DIRECT

**Expected Source:** backend/data/clean_graph.json (HAS_FACILITY: College of Artificial Intelligence -> General Purpose Computers Lab)

**Expected Answer Summary:** College of Artificial Intelligence has facility General Purpose Computers Lab.

**Why This Is Impressive:** Shows deterministic graph grounding with an auditable relationship.

### KG-07

**Question:** Which facility is available to College of Artificial Intelligence?

**Expected Route:** KG_DIRECT

**Expected Source:** backend/data/clean_graph.json (HAS_FACILITY: College of Artificial Intelligence -> UV (Un-Manned Vehicle))

**Expected Answer Summary:** College of Artificial Intelligence has facility UV (Un-Manned Vehicle).

**Why This Is Impressive:** Shows deterministic graph grounding with an auditable relationship.

### KG-08

**Question:** Which facility is available to College of Artificial Intelligence?

**Expected Route:** KG_DIRECT

**Expected Source:** backend/data/clean_graph.json (HAS_FACILITY: College of Artificial Intelligence -> Embedded Systems)

**Expected Answer Summary:** College of Artificial Intelligence has facility Embedded Systems.

**Why This Is Impressive:** Shows deterministic graph grounding with an auditable relationship.

### KG-09

**Question:** Which facility is available to College of Artificial Intelligence?

**Expected Route:** KG_DIRECT

**Expected Source:** backend/data/clean_graph.json (HAS_FACILITY: College of Artificial Intelligence -> Basic IoT (Internet of Things))

**Expected Answer Summary:** College of Artificial Intelligence has facility Basic IoT (Internet of Things).

**Why This Is Impressive:** Shows deterministic graph grounding with an auditable relationship.

### KG-10

**Question:** Which facility is available to College of Artificial Intelligence?

**Expected Route:** KG_DIRECT

**Expected Source:** backend/data/clean_graph.json (HAS_FACILITY: College of Artificial Intelligence -> Workstations Lab)

**Expected Answer Summary:** College of Artificial Intelligence has facility Workstations Lab.

**Why This Is Impressive:** Shows deterministic graph grounding with an auditable relationship.

### KG-11

**Question:** Which policy does College of Artificial Intelligence follow?

**Expected Route:** KG_DIRECT

**Expected Source:** backend/data/clean_graph.json (FOLLOWS_POLICY: College of Artificial Intelligence -> Course Passing Criteria)

**Expected Answer Summary:** College of Artificial Intelligence follows Course Passing Criteria.

**Why This Is Impressive:** Shows deterministic graph grounding with an auditable relationship.

### KG-12

**Question:** Which grading system does College of Artificial Intelligence use?

**Expected Route:** KG_DIRECT

**Expected Source:** backend/data/clean_graph.json (USES_GRADING_SYSTEM: College of Artificial Intelligence -> AAST Grading System (Pre-2023))

**Expected Answer Summary:** College of Artificial Intelligence uses AAST Grading System (Pre-2023).

**Why This Is Impressive:** Shows deterministic graph grounding with an auditable relationship.

### KG-13

**Question:** Which grading system does College of Artificial Intelligence use?

**Expected Route:** KG_DIRECT

**Expected Source:** backend/data/clean_graph.json (USES_GRADING_SYSTEM: College of Artificial Intelligence -> AAST Grading System (From 2023))

**Expected Answer Summary:** College of Artificial Intelligence uses AAST Grading System (From 2023).

**Why This Is Impressive:** Shows deterministic graph grounding with an auditable relationship.

### KG-14

**Question:** Who teaches Time Series?

**Expected Route:** KG_DIRECT

**Expected Source:** backend/data/clean_graph.json (TEACHES: College of Artificial Intelligence -> Time Series)

**Expected Answer Summary:** College of Artificial Intelligence teaches Time Series.

**Why This Is Impressive:** Shows deterministic graph grounding with an auditable relationship.

### KG-15

**Question:** Which policy query does College of Artificial Intelligence support?

**Expected Route:** KG_DIRECT

**Expected Source:** backend/data/clean_graph.json (SUPPORTS_POLICY_QUERY: College of Artificial Intelligence -> Tuition and Fees Pathway)

**Expected Answer Summary:** College of Artificial Intelligence supports policy query Tuition and Fees Pathway.

**Why This Is Impressive:** Shows deterministic graph grounding with an auditable relationship.

### KG-16

**Question:** Which policy query does College of Artificial Intelligence support?

**Expected Route:** KG_DIRECT

**Expected Source:** backend/data/clean_graph.json (SUPPORTS_POLICY_QUERY: College of Artificial Intelligence -> Scholarship Pathway)

**Expected Answer Summary:** College of Artificial Intelligence supports policy query Scholarship Pathway.

**Why This Is Impressive:** Shows deterministic graph grounding with an auditable relationship.

### KG-17

**Question:** Which policy query does College of Artificial Intelligence support?

**Expected Route:** KG_DIRECT

**Expected Source:** backend/data/clean_graph.json (SUPPORTS_POLICY_QUERY: College of Artificial Intelligence -> Academic Advising Pathway)

**Expected Answer Summary:** College of Artificial Intelligence supports policy query Academic Advising Pathway.

**Why This Is Impressive:** Shows deterministic graph grounding with an auditable relationship.

### KG-18

**Question:** What component is listed inside Robotics Lab?

**Expected Route:** KG_DIRECT

**Expected Source:** backend/data/clean_graph.json (CONTAINS_COMPONENT: Robotics Lab -> Dobot Magician)

**Expected Answer Summary:** Robotics Lab contains Dobot Magician.

**Why This Is Impressive:** Shows deterministic graph grounding with an auditable relationship.

### KG-19

**Question:** What component is listed inside Robotics Lab?

**Expected Route:** KG_DIRECT

**Expected Source:** backend/data/clean_graph.json (CONTAINS_COMPONENT: Robotics Lab -> Go Drone Classroom)

**Expected Answer Summary:** Robotics Lab contains Go Drone Classroom.

**Why This Is Impressive:** Shows deterministic graph grounding with an auditable relationship.

### KG-20

**Question:** What component is listed inside Robotics Lab?

**Expected Route:** KG_DIRECT

**Expected Source:** backend/data/clean_graph.json (CONTAINS_COMPONENT: Robotics Lab -> Temi Robot)

**Expected Answer Summary:** Robotics Lab contains Temi Robot.

**Why This Is Impressive:** Shows deterministic graph grounding with an auditable relationship.

### KG-21

**Question:** What component is listed inside Robotics Lab?

**Expected Route:** KG_DIRECT

**Expected Source:** backend/data/clean_graph.json (CONTAINS_COMPONENT: Robotics Lab -> Yanshee Robot)

**Expected Answer Summary:** Robotics Lab contains Yanshee Robot.

**Why This Is Impressive:** Shows deterministic graph grounding with an auditable relationship.

### KG-22

**Question:** What component is listed inside Robotics Lab?

**Expected Route:** KG_DIRECT

**Expected Source:** backend/data/clean_graph.json (CONTAINS_COMPONENT: Robotics Lab -> VR Ricoh Camera)

**Expected Answer Summary:** Robotics Lab contains VR Ricoh Camera.

**Why This Is Impressive:** Shows deterministic graph grounding with an auditable relationship.

### KG-23

**Question:** What component is listed inside Robotics Lab?

**Expected Route:** KG_DIRECT

**Expected Source:** backend/data/clean_graph.json (CONTAINS_COMPONENT: Robotics Lab -> NAO v6 Humanoid Robot)

**Expected Answer Summary:** Robotics Lab contains NAO v6 Humanoid Robot.

**Why This Is Impressive:** Shows deterministic graph grounding with an auditable relationship.

### KG-24

**Question:** Which specialization is listed under Intelligent Systems?

**Expected Route:** KG_DIRECT

**Expected Source:** backend/data/clean_graph.json (HAS_SPECIALIZATION: Intelligent Systems -> Intelligent Systems)

**Expected Answer Summary:** Intelligent Systems has specialization Intelligent Systems.

**Why This Is Impressive:** Shows deterministic graph grounding with an auditable relationship.

### KG-25

**Question:** Which specialization is listed under Intelligent Systems?

**Expected Route:** KG_DIRECT

**Expected Source:** backend/data/clean_graph.json (HAS_SPECIALIZATION: Intelligent Systems -> Robotics)

**Expected Answer Summary:** Intelligent Systems has specialization Robotics.

**Why This Is Impressive:** Shows deterministic graph grounding with an auditable relationship.

### KG-26

**Question:** What is the has scholarship relationship between Intelligent Systems and Excellence Scholarship?

**Expected Route:** KG_DIRECT

**Expected Source:** backend/data/clean_graph.json (HAS_SCHOLARSHIP: Intelligent Systems -> Excellence Scholarship)

**Expected Answer Summary:** Intelligent Systems has scholarship Excellence Scholarship.

**Why This Is Impressive:** Shows deterministic graph grounding with an auditable relationship.

### KG-27

**Question:** Which program includes Machine Learning?

**Expected Route:** KG_DIRECT

**Expected Source:** backend/data/clean_graph.json (HAS_COURSE: Intelligent Systems -> Machine Learning)

**Expected Answer Summary:** Intelligent Systems includes the course Machine Learning.

**Why This Is Impressive:** Shows deterministic graph grounding with an auditable relationship.

### KG-28

**Question:** Which program includes Deep Learning?

**Expected Route:** KG_DIRECT

**Expected Source:** backend/data/clean_graph.json (HAS_COURSE: Intelligent Systems -> Deep Learning)

**Expected Answer Summary:** Intelligent Systems includes the course Deep Learning.

**Why This Is Impressive:** Shows deterministic graph grounding with an auditable relationship.

### KG-29

**Question:** Which program includes Fundamentals of AI?

**Expected Route:** KG_DIRECT

**Expected Source:** backend/data/clean_graph.json (HAS_COURSE: Intelligent Systems -> Fundamentals of AI)

**Expected Answer Summary:** Intelligent Systems includes the course Fundamentals of AI.

**Why This Is Impressive:** Shows deterministic graph grounding with an auditable relationship.

### KG-30

**Question:** Which program includes Linear Algebra?

**Expected Route:** KG_DIRECT

**Expected Source:** backend/data/clean_graph.json (HAS_COURSE: Intelligent Systems -> Linear Algebra)

**Expected Answer Summary:** Intelligent Systems includes the course Linear Algebra.

**Why This Is Impressive:** Shows deterministic graph grounding with an auditable relationship.

## RAG Demos

### RAG-01

**Question:** What does the CAI policy corpus say about ai_application_areas?

**Expected Route:** RAG_DIRECT

**Expected Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (5e597281bb41d77062ca3c6e7311ffd4; institutional/ai_application_areas; AI Application Areas)

**Expected Answer Summary:** and integrate the actions of human with digital systems to be able to reduce labor costs as well as prevent human error;

**Why This Is Impressive:** Shows document-grounded policy retrieval.

### RAG-02

**Question:** What does the CAI policy corpus say about dean's_study_advice?

**Expected Route:** RAG_DIRECT

**Expected Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (21983774bc55d342fd9264b1427ae4b6; institutional/dean's_study_advice; Dean's Study Advice)

**Expected Answer Summary:** Here are some advice to you: Study regularly throughout the semester for all your classes;

**Why This Is Impressive:** Shows document-grounded policy retrieval.

### RAG-03

**Question:** What does the CAI policy corpus say about accreditation_and_membership?

**Expected Route:** RAG_DIRECT

**Expected Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (f3705cfb85f058b7a521c10b1ab728f3; academic_policies/accreditation_and_membership; Accreditation and Membership)

**Expected Answer Summary:** The College of Artificial Intelligence (CAI) is accredited by the Supreme Council of Universities in Egypt

**Why This Is Impressive:** Shows document-grounded policy retrieval.

### RAG-04

**Question:** What does the CAI policy corpus say about accreditation_and_membership?

**Expected Route:** RAG_DIRECT

**Expected Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (ffb8317467615c64c4b051bac88f42df; academic_policies/accreditation_and_membership; Accreditation and Membership)

**Expected Answer Summary:** and is a member of the Arab Network for Quality Assurance in Higher Education

**Why This Is Impressive:** Shows document-grounded policy retrieval.

### RAG-05

**Question:** What does the CAI policy corpus say about educational_quality_commitment?

**Expected Route:** RAG_DIRECT

**Expected Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (1ba9bec96ea734a2602a9652b89417e1; academic_policies/educational_quality_commitment; Educational Quality Commitment)

**Expected Answer Summary:** and continuously improving its programs to meet the needs of students

**Why This Is Impressive:** Shows document-grounded policy retrieval.

### RAG-06

**Question:** What does the CAI policy corpus say about internal_and_external_evaluations?

**Expected Route:** RAG_DIRECT

**Expected Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (44329014f0bb44c28c33130b922991d5; academic_policies/internal_and_external_evaluations; Internal and External Evaluations)

**Expected Answer Summary:** CAI regularly undergoes internal and external evaluations to ensure that it meets the quality standards set by accrediting bodies

**Why This Is Impressive:** Shows document-grounded policy retrieval.

### RAG-07

**Question:** What does the CAI policy corpus say about ai_labs_and_learning?

**Expected Route:** RAG_DIRECT

**Expected Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (c9ca72142cc87cc8d5a4821759be5e7a; institutional/ai_labs_and_learning; AI Labs and Learning)

**Expected Answer Summary:** and applications. These labs include: The College of Artificial Intelligence offers to the staff

**Why This Is Impressive:** Shows document-grounded policy retrieval.

### RAG-08

**Question:** What does the CAI policy corpus say about ai_labs_and_learning?

**Expected Route:** RAG_DIRECT

**Expected Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (3b86419a99c0599de54947c310d27dbb; institutional/ai_labs_and_learning; AI Labs and Learning)

**Expected Answer Summary:** and students a combination of basic labs as well as state-of-art research labs.

**Why This Is Impressive:** Shows document-grounded policy retrieval.

### RAG-09

**Question:** What does the CAI policy corpus say about basic_ai_labs?

**Expected Route:** RAG_DIRECT

**Expected Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (258d388de8d2c48e45b68c8c225e1f97; institutional/basic_ai_labs; Basic AI Labs)

**Expected Answer Summary:** The basic labs include: Computer Lab, Data Science Lab,

**Why This Is Impressive:** Shows document-grounded policy retrieval.

### RAG-10

**Question:** What does the CAI policy corpus say about research_ai_labs?

**Expected Route:** RAG_DIRECT

**Expected Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (56ab523ac0c6fbf60497ef700c47f68e; institutional/research_ai_labs; Research AI Labs)

**Expected Answer Summary:** The research labs include: Natural Language Processing Lab,

**Why This Is Impressive:** Shows document-grounded policy retrieval.

### RAG-11

**Question:** What does the CAI policy corpus say about lab_hardware_and_software?

**Expected Route:** RAG_DIRECT

**Expected Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (703cc970d827de63739e757d2fae33e3; institutional/lab_hardware_and_software; Lab Hardware and Software)

**Expected Answer Summary:** These labs are equipped with the latest hardware

**Why This Is Impressive:** Shows document-grounded policy retrieval.

### RAG-12

**Question:** What does the CAI policy corpus say about accredited_summer_studies?

**Expected Route:** RAG_DIRECT

**Expected Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (45732073764a4cf9565f39e280c97ef4; academic_programs/accredited_summer_studies; Accredited Summer Studies)

**Expected Answer Summary:** Offering accredited summer studies for the students of the College of Artificial Intelligence

**Why This Is Impressive:** Shows document-grounded policy retrieval.

### RAG-13

**Question:** What does the CAI policy corpus say about teaching_participation?

**Expected Route:** RAG_DIRECT

**Expected Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (bfb4027cba35270b095791bf103fe4e7; academic_programs/teaching_participation; Teaching Participation)

**Expected Answer Summary:** Participation in the courses teaching activities both Face to Face Education

**Why This Is Impressive:** Shows document-grounded policy retrieval.

### RAG-14

**Question:** What does the CAI policy corpus say about optional_uclan_summer_courses?

**Expected Route:** RAG_DIRECT

**Expected Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (ada0596af8dc3bab5a9beea4623ce348; academic_programs/optional_uclan_summer_courses; Optional UClan Summer Courses)

**Expected Answer Summary:** Availability of accredited courses at the University of Central Lancashire during the summer semester,

**Why This Is Impressive:** Shows document-grounded policy retrieval.

### RAG-15

**Question:** What does the CAI policy corpus say about optional_uclan_summer_courses?

**Expected Route:** RAG_DIRECT

**Expected Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (9bdeb734932bc01bf99fea1c2d143e3e; academic_programs/optional_uclan_summer_courses; Optional UClan Summer Courses)

**Expected Answer Summary:** in which students of the College of Artificial Intelligence can enroll on an optional basis

**Why This Is Impressive:** Shows document-grounded policy retrieval.

### RAG-16

**Question:** What does the CAI policy corpus say about undergraduate_admission_requirements?

**Expected Route:** RAG_DIRECT

**Expected Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (b783fbd4fb54cb3352734b9250562069; admissions_registration/undergraduate_admission_requirements; Undergraduate Admission Requirements)

**Expected Answer Summary:** Students must meet the following admission requirements: Completion of secondary education certificate

**Why This Is Impressive:** Shows document-grounded policy retrieval.

### RAG-17

**Question:** What does the CAI policy corpus say about undergraduate_admission_requirements?

**Expected Route:** RAG_DIRECT

**Expected Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (81289e0e3b8882abec68210e52c77727; admissions_registration/undergraduate_admission_requirements; Undergraduate Admission Requirements)

**Expected Answer Summary:** (Math section or Science Section) or equivalent certificates.

**Why This Is Impressive:** Shows document-grounded policy retrieval.

### RAG-18

**Question:** What does the CAI policy corpus say about undergraduate_admission_requirements?

**Expected Route:** RAG_DIRECT

**Expected Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (1521a01e1f408b771ee6ad64b46b283e; admissions_registration/undergraduate_admission_requirements; Undergraduate Admission Requirements)

**Expected Answer Summary:** Meeting the minimum score required to join the college which is announced

**Why This Is Impressive:** Shows document-grounded policy retrieval.

### RAG-19

**Question:** What does the CAI policy corpus say about undergraduate_admission_requirements?

**Expected Route:** RAG_DIRECT

**Expected Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (4babccacf0502e406ae693290a2ab8f1; admissions_registration/undergraduate_admission_requirements; Undergraduate Admission Requirements)

**Expected Answer Summary:** before the beginning of each semester, in light of the minimum score mandated by AASTMT,

**Why This Is Impressive:** Shows document-grounded policy retrieval.

### RAG-20

**Question:** What does the CAI policy corpus say about undergraduate_admission_requirements?

**Expected Route:** RAG_DIRECT

**Expected Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (76368d2f22f3bc01385c9d6eaca2a401; admissions_registration/undergraduate_admission_requirements; Undergraduate Admission Requirements)

**Expected Answer Summary:** as well as the annually announced terms, regulations

**Why This Is Impressive:** Shows document-grounded policy retrieval.

### RAG-21

**Question:** What does the CAI policy corpus say about undergraduate_admission_requirements?

**Expected Route:** RAG_DIRECT

**Expected Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (388044f3e983c7f7074b7261c7aad62a; admissions_registration/undergraduate_admission_requirements; Undergraduate Admission Requirements)

**Expected Answer Summary:** and qualifying courses per certificate as specified by the AASTMT Supreme Council of Education Affairs.

**Why This Is Impressive:** Shows document-grounded policy retrieval.

### RAG-22

**Question:** What does the CAI policy corpus say about undergraduate_admission_requirements?

**Expected Route:** RAG_DIRECT

**Expected Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (a5433ad8287a319206bb1ead0cb08112; admissions_registration/undergraduate_admission_requirements; Undergraduate Admission Requirements)

**Expected Answer Summary:** Showing good conduct with no dishonoring judicial sentence issued against them.

**Why This Is Impressive:** Shows document-grounded policy retrieval.

### RAG-23

**Question:** What does the CAI policy corpus say about undergraduate_admission_requirements?

**Expected Route:** RAG_DIRECT

**Expected Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (678a96642d9c5f58cf9b7970e76431a3; admissions_registration/undergraduate_admission_requirements; Undergraduate Admission Requirements)

**Expected Answer Summary:** Submission of all required admission documents. Approval of delegating entities

**Why This Is Impressive:** Shows document-grounded policy retrieval.

### RAG-24

**Question:** What does the CAI policy corpus say about undergraduate_admission_requirements?

**Expected Route:** RAG_DIRECT

**Expected Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (bd2cb19a5b8bdbe4634ab65f43a3c87a; admissions_registration/undergraduate_admission_requirements; Undergraduate Admission Requirements)

**Expected Answer Summary:** in case of student’s delegation from any country

**Why This Is Impressive:** Shows document-grounded policy retrieval.

### RAG-25

**Question:** What does the CAI policy corpus say about undergraduate_admission_requirements?

**Expected Route:** RAG_DIRECT

**Expected Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (319393b64052058ce10954f351cce1ae; admissions_registration/undergraduate_admission_requirements; Undergraduate Admission Requirements)

**Expected Answer Summary:** or authority. Passing admission exams determined by AASTMT.

**Why This Is Impressive:** Shows document-grounded policy retrieval.

### RAG-26

**Question:** What does the CAI policy corpus say about credit_hour_definition?

**Expected Route:** RAG_DIRECT

**Expected Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (bc8c5e26bc1a155d68f73849cc0e12aa; admissions_registration/credit_hour_definition; Credit Hour Definition)

**Expected Answer Summary:** Credit Hours: A Credit Hour for every semester week

**Why This Is Impressive:** Shows document-grounded policy retrieval.

### RAG-27

**Question:** What does the CAI policy corpus say about credit_hour_definition?

**Expected Route:** RAG_DIRECT

**Expected Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (9593326abfa3b16adeda5db83bec4862; admissions_registration/credit_hour_definition; Credit Hour Definition)

**Expected Answer Summary:** (CH) is equivalent to one hour of theoretical study

**Why This Is Impressive:** Shows document-grounded policy retrieval.

### RAG-28

**Question:** What does the CAI policy corpus say about credit_hour_definition?

**Expected Route:** RAG_DIRECT

**Expected Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (22a11bf37f9a4387479229347e6b435f; admissions_registration/credit_hour_definition; Credit Hour Definition)

**Expected Answer Summary:** (50 minutes) , not less than two hours of practical

**Why This Is Impressive:** Shows document-grounded policy retrieval.

### RAG-29

**Question:** What does the CAI policy corpus say about credit_hour_definition?

**Expected Route:** RAG_DIRECT

**Expected Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (8c671a5689d05f59e89a34c5a882ad16; admissions_registration/credit_hour_definition; Credit Hour Definition)

**Expected Answer Summary:** or three hours of practical or applied work.

**Why This Is Impressive:** Shows document-grounded policy retrieval.

### RAG-30

**Question:** What does the CAI policy corpus say about semester_course_load?

**Expected Route:** RAG_DIRECT

**Expected Source:** backend/rag_system/cleaned_chunked_cai_production_v4.json (278335842bcc3c12379170e14d75702b; admissions_registration/semester_course_load; Semester Course Load)

**Expected Answer Summary:** The CH determines the course load a student is allowed to register for in each semester.

**Why This Is Impressive:** Shows document-grounded policy retrieval.

## Hybrid Demos

### Hybrid-01

**Question:** Use both sources: Which facility is available to College of Artificial Intelligence? Also summarize policy context for ai_application_areas.

**Expected Route:** HYBRID_KG_RAG

**Expected Source:** backend/data/clean_graph.json (HAS_FACILITY: College of Artificial Intelligence -> Robotics Lab) + backend/rag_system/cleaned_chunked_cai_production_v4.json (5e597281bb41d77062ca3c6e7311ffd4; institutional/ai_application_areas; AI Application Areas)

**Expected Answer Summary:** Structured fact: College of Artificial Intelligence has facility Robotics Lab. Policy context: and integrate the actions of human with digital systems to be able to reduce labor costs as well as prevent human error;

**Why This Is Impressive:** Shows the thesis idea: graph fact plus policy prose.

### Hybrid-02

**Question:** Use both sources: Which facility is available to College of Artificial Intelligence? Also summarize policy context for internal_and_external_evaluations.

**Expected Route:** HYBRID_KG_RAG

**Expected Source:** backend/data/clean_graph.json (HAS_FACILITY: College of Artificial Intelligence -> IoT Lab) + backend/rag_system/cleaned_chunked_cai_production_v4.json (44329014f0bb44c28c33130b922991d5; academic_policies/internal_and_external_evaluations; Internal and External Evaluations)

**Expected Answer Summary:** Structured fact: College of Artificial Intelligence has facility IoT Lab. Policy context: CAI regularly undergoes internal and external evaluations to ensure that it meets the quality standards set by accrediting bodies

**Why This Is Impressive:** Shows the thesis idea: graph fact plus policy prose.

### Hybrid-03

**Question:** Use both sources: Which facility is available to College of Artificial Intelligence? Also summarize policy context for lab_hardware_and_software.

**Expected Route:** HYBRID_KG_RAG

**Expected Source:** backend/data/clean_graph.json (HAS_FACILITY: College of Artificial Intelligence -> Physics Lab) + backend/rag_system/cleaned_chunked_cai_production_v4.json (703cc970d827de63739e757d2fae33e3; institutional/lab_hardware_and_software; Lab Hardware and Software)

**Expected Answer Summary:** Structured fact: College of Artificial Intelligence has facility Physics Lab. Policy context: These labs are equipped with the latest hardware

**Why This Is Impressive:** Shows the thesis idea: graph fact plus policy prose.

### Hybrid-04

**Question:** Use both sources: Which facility is available to College of Artificial Intelligence? Also summarize policy context for undergraduate_admission_requirements.

**Expected Route:** HYBRID_KG_RAG

**Expected Source:** backend/data/clean_graph.json (HAS_FACILITY: College of Artificial Intelligence -> UV (Un-Manned Vehicle)) + backend/rag_system/cleaned_chunked_cai_production_v4.json (b783fbd4fb54cb3352734b9250562069; admissions_registration/undergraduate_admission_requirements; Undergraduate Admission Requirements)

**Expected Answer Summary:** Structured fact: College of Artificial Intelligence has facility UV (Un-Manned Vehicle). Policy context: Students must meet the following admission requirements: Completion of secondary education certificate

**Why This Is Impressive:** Shows the thesis idea: graph fact plus policy prose.

### Hybrid-05

**Question:** Use both sources: Which facility is available to College of Artificial Intelligence? Also summarize policy context for undergraduate_admission_requirements.

**Expected Route:** HYBRID_KG_RAG

**Expected Source:** backend/data/clean_graph.json (HAS_FACILITY: College of Artificial Intelligence -> Basic IoT (Internet of Things)) + backend/rag_system/cleaned_chunked_cai_production_v4.json (388044f3e983c7f7074b7261c7aad62a; admissions_registration/undergraduate_admission_requirements; Undergraduate Admission Requirements)

**Expected Answer Summary:** Structured fact: College of Artificial Intelligence has facility Basic IoT (Internet of Things). Policy context: and qualifying courses per certificate as specified by the AASTMT Supreme Council of Education Affairs.

**Why This Is Impressive:** Shows the thesis idea: graph fact plus policy prose.

### Hybrid-06

**Question:** Use both sources: Which policy does College of Artificial Intelligence follow? Also summarize policy context for credit_hour_definition.

**Expected Route:** HYBRID_KG_RAG

**Expected Source:** backend/data/clean_graph.json (FOLLOWS_POLICY: College of Artificial Intelligence -> Course Passing Criteria) + backend/rag_system/cleaned_chunked_cai_production_v4.json (bc8c5e26bc1a155d68f73849cc0e12aa; admissions_registration/credit_hour_definition; Credit Hour Definition)

**Expected Answer Summary:** Structured fact: College of Artificial Intelligence follows Course Passing Criteria. Policy context: Credit Hours: A Credit Hour for every semester week

**Why This Is Impressive:** Shows the thesis idea: graph fact plus policy prose.

### Hybrid-07

**Question:** Use both sources: Which grading system does College of Artificial Intelligence use? Also summarize policy context for semester_course_load.

**Expected Route:** HYBRID_KG_RAG

**Expected Source:** backend/data/clean_graph.json (USES_GRADING_SYSTEM: College of Artificial Intelligence -> AAST Grading System (From 2023)) + backend/rag_system/cleaned_chunked_cai_production_v4.json (6ff5fe8b10581d0b4e8729160397f2f0; admissions_registration/semester_course_load; Semester Course Load)

**Expected Answer Summary:** Structured fact: College of Artificial Intelligence uses AAST Grading System (From 2023). Policy context: and examination results. The educational load is usually between 12 CHs

**Why This Is Impressive:** Shows the thesis idea: graph fact plus policy prose.

### Hybrid-08

**Question:** Use both sources: Which policy query does College of Artificial Intelligence support? Also summarize policy context for external_transfer_requirements.

**Expected Route:** HYBRID_KG_RAG

**Expected Source:** backend/data/clean_graph.json (SUPPORTS_POLICY_QUERY: College of Artificial Intelligence -> Tuition and Fees Pathway) + backend/rag_system/cleaned_chunked_cai_production_v4.json (4dc6b83026054dbdd661d057b8e45324; admissions_registration/external_transfer_requirements; External Transfer Requirements)

**Expected Answer Summary:** Structured fact: College of Artificial Intelligence supports policy query Tuition and Fees Pathway. Policy context: and Registration Deanery according to the following: Transfer from Other Institutions:

**Why This Is Impressive:** Shows the thesis idea: graph fact plus policy prose.

### Hybrid-09

**Question:** Use both sources: Which policy query does College of Artificial Intelligence support? Also summarize policy context for external_transfer_requirements.

**Expected Route:** HYBRID_KG_RAG

**Expected Source:** backend/data/clean_graph.json (SUPPORTS_POLICY_QUERY: College of Artificial Intelligence -> Academic Advising Pathway) + backend/rag_system/cleaned_chunked_cai_production_v4.json (428a0d28eac3be9765673d28c980fc89; admissions_registration/external_transfer_requirements; External Transfer Requirements)

**Expected Answer Summary:** Structured fact: College of Artificial Intelligence supports policy query Academic Advising Pathway. Policy context: these are not calculated in the GPA but count toward graduation hours,

**Why This Is Impressive:** Shows the thesis idea: graph fact plus policy prose.

### Hybrid-10

**Question:** Use both sources: What component is listed inside Robotics Lab? Also summarize policy context for academic_year_structure.

**Expected Route:** HYBRID_KG_RAG

**Expected Source:** backend/data/clean_graph.json (CONTAINS_COMPONENT: Robotics Lab -> Go Drone Classroom) + backend/rag_system/cleaned_chunked_cai_production_v4.json (70271c5c08f788e9d6d6b6e3df5f8bb4; academic_programs/academic_year_structure; Academic Year Structure)

**Expected Answer Summary:** Structured fact: Robotics Lab contains Go Drone Classroom. Policy context: The academic year consists of two regular 15-week semesters

**Why This Is Impressive:** Shows the thesis idea: graph fact plus policy prose.

### Hybrid-11

**Question:** Use both sources: What component is listed inside Robotics Lab? Also summarize policy context for gpa_scale_calculation.

**Expected Route:** HYBRID_KG_RAG

**Expected Source:** backend/data/clean_graph.json (CONTAINS_COMPONENT: Robotics Lab -> Yanshee Robot) + backend/rag_system/cleaned_chunked_cai_production_v4.json (2fe276c7bb41f8df34343c238cd970ec; grading_policies/gpa_scale_calculation; GPA Scale Calculation)

**Expected Answer Summary:** Structured fact: Robotics Lab contains Yanshee Robot. Policy context: The Grade Point Average (GPA) is calculated on a scale of 0.0 to 4.0 by dividing total points achieved by total registered hours.

**Why This Is Impressive:** Shows the thesis idea: graph fact plus policy prose.

### Hybrid-12

**Question:** Use both sources: What component is listed inside Robotics Lab? Also summarize policy context for academic_advisor_support.

**Expected Route:** HYBRID_KG_RAG

**Expected Source:** backend/data/clean_graph.json (CONTAINS_COMPONENT: Robotics Lab -> NAO v6 Humanoid Robot) + backend/rag_system/cleaned_chunked_cai_production_v4.json (153374cc44eed9d2d4f374553e1b91a4; academic_policies/academic_advisor_support; Academic Advisor Support)

**Expected Answer Summary:** Structured fact: Robotics Lab contains NAO v6 Humanoid Robot. Policy context: Each student is assigned an Academic Advisor to assist with course selection

**Why This Is Impressive:** Shows the thesis idea: graph fact plus policy prose.

### Hybrid-13

**Question:** Use both sources: Which specialization is listed under Intelligent Systems? Also summarize policy context for failed_course_repeat_policy.

**Expected Route:** HYBRID_KG_RAG

**Expected Source:** backend/data/clean_graph.json (HAS_SPECIALIZATION: Intelligent Systems -> Robotics) + backend/rag_system/cleaned_chunked_cai_production_v4.json (17dc4e86eb79c3f7bfdf6ccdcf96986c; grading_policies/failed_course_repeat_policy; Failed Course Repeat Policy)

**Expected Answer Summary:** Structured fact: Intelligent Systems has specialization Robotics. Policy context: Students must repeat failed courses, with the maximum grade for success being 3.00

**Why This Is Impressive:** Shows the thesis idea: graph fact plus policy prose.

### Hybrid-14

**Question:** Use both sources: Which program includes Machine Learning? Also summarize policy context for incomplete_grade_deadline.

**Expected Route:** HYBRID_KG_RAG

**Expected Source:** backend/data/clean_graph.json (HAS_COURSE: Intelligent Systems -> Machine Learning) + backend/rag_system/cleaned_chunked_cai_production_v4.json (01b6c98a18f72e5c6434eea7cab21047; grading_policies/incomplete_grade_deadline; Incomplete Grade Deadline)

**Expected Answer Summary:** Structured fact: Intelligent Systems includes the course Machine Learning. Policy context: 'Incomplete' grades must be resolved by the first week of the following semester,

**Why This Is Impressive:** Shows the thesis idea: graph fact plus policy prose.

### Hybrid-15

**Question:** Use both sources: Which program includes Fundamentals of AI? Also summarize policy context for scholarship_eligibility_criteria.

**Expected Route:** HYBRID_KG_RAG

**Expected Source:** backend/data/clean_graph.json (HAS_COURSE: Intelligent Systems -> Fundamentals of AI) + backend/rag_system/cleaned_chunked_cai_production_v4.json (72fbf043b10af32c7c42082b37f8f91d; academic_policies/scholarship_eligibility_criteria; Scholarship Eligibility Criteria)

**Expected Answer Summary:** Structured fact: Intelligent Systems includes the course Fundamentals of AI. Policy context: To qualify, a student must maintain a GPA of at least 3.4,

**Why This Is Impressive:** Shows the thesis idea: graph fact plus policy prose.

### Hybrid-16

**Question:** Use both sources: Which program includes ESP Foundation? Also summarize policy context for scholarship_tie_rules.

**Expected Route:** HYBRID_KG_RAG

**Expected Source:** backend/data/clean_graph.json (HAS_COURSE: Intelligent Systems -> ESP Foundation) + backend/rag_system/cleaned_chunked_cai_production_v4.json (5c6db9768baa5b8a213961ad82109968; academic_policies/scholarship_tie_rules; Scholarship Tie Rules)

**Expected Answer Summary:** Structured fact: Intelligent Systems includes the course ESP Foundation. Policy context: If multiple students have the same GPA, the

**Why This Is Impressive:** Shows the thesis idea: graph fact plus policy prose.

### Hybrid-17

**Question:** Use both sources: Which program includes Introduction to Computing? Also summarize policy context for scholarship_eligibility_for_transfer_students.

**Expected Route:** HYBRID_KG_RAG

**Expected Source:** backend/data/clean_graph.json (HAS_COURSE: Intelligent Systems -> Introduction to Computing) + backend/rag_system/cleaned_chunked_cai_production_v4.json (79c2a4a11d11a32a905f4afcce047967; academic_policies/scholarship_eligibility_for_transfer_students; Scholarship Eligibility for Transfer Students)

**Expected Answer Summary:** Structured fact: Intelligent Systems includes the course Introduction to Computing. Policy context: Transferred students from abroad or other institutions are only

**Why This Is Impressive:** Shows the thesis idea: graph fact plus policy prose.

### Hybrid-18

**Question:** Use both sources: Which program includes Discrete Mathematics? Also summarize policy context for lab_infrastructure_standards.

**Expected Route:** HYBRID_KG_RAG

**Expected Source:** backend/data/clean_graph.json (HAS_COURSE: Intelligent Systems -> Discrete Mathematics) + backend/rag_system/cleaned_chunked_cai_production_v4.json (29328885482e898253db7e0a2a74dc67; infrastructure/lab_infrastructure_standards; Lab Infrastructure Standards)

**Expected Answer Summary:** Structured fact: Intelligent Systems includes the course Discrete Mathematics. Policy context: Data Science, NLP, and Computer Vision) are equipped with the latest hardware

**Why This Is Impressive:** Shows the thesis idea: graph fact plus policy prose.

### Hybrid-19

**Question:** Use both sources: Which program includes Calculus II? Also summarize policy context for msc_study_at_the_college_of_artificial_intelligence.

**Expected Route:** HYBRID_KG_RAG

**Expected Source:** backend/data/clean_graph.json (HAS_COURSE: Intelligent Systems -> Calculus II) + backend/rag_system/cleaned_chunked_cai_production_v4.json (023d0bd7d1cc180cb7ed3f6dba1a95b7; postgraduate_programs/msc_study_at_the_college_of_artificial_intelligence; MSc Study at the College of Artificial Intelligence)

**Expected Answer Summary:** Structured fact: Intelligent Systems includes the course Calculus II. Policy context: Computer Vision, Robotics, Natural Language Processing (NLP) ,

**Why This Is Impressive:** Shows the thesis idea: graph fact plus policy prose.

### Hybrid-20

**Question:** Use both sources: Which program includes Physics? Also summarize policy context for msc_study_at_the_college_of_artificial_intelligence.

**Expected Route:** HYBRID_KG_RAG

**Expected Source:** backend/data/clean_graph.json (HAS_COURSE: Intelligent Systems -> Physics) + backend/rag_system/cleaned_chunked_cai_production_v4.json (4b6b98ee1f4a8c80352c2632e57bf21b; postgraduate_programs/msc_study_at_the_college_of_artificial_intelligence; MSc Study at the College of Artificial Intelligence)

**Expected Answer Summary:** Structured fact: Intelligent Systems includes the course Physics. Policy context: (or higher) Scopus or Web of Science indexed journal.

**Why This Is Impressive:** Shows the thesis idea: graph fact plus policy prose.

### Hybrid-21

**Question:** Use both sources: Which program includes Natural Language Processing? Also summarize policy context for msc_admission_checklist.

**Expected Route:** HYBRID_KG_RAG

**Expected Source:** backend/data/clean_graph.json (HAS_COURSE: Intelligent Systems -> Natural Language Processing) + backend/rag_system/cleaned_chunked_cai_production_v4.json (83e836ed5de6ff2b18490723549fb18a; admissions/msc_admission_checklist; MSc Admission Checklist)

**Expected Answer Summary:** Structured fact: Intelligent Systems includes the course Natural Language Processing. Policy context: (non-refundable) . 4. A clear copy of Passport

**Why This Is Impressive:** Shows the thesis idea: graph fact plus policy prose.

### Hybrid-22

**Question:** Use both sources: Which program includes Optimization Techniques? Also summarize policy context for msc_tuition_&_fees_framework.

**Expected Route:** HYBRID_KG_RAG

**Expected Source:** backend/data/clean_graph.json (HAS_COURSE: Intelligent Systems -> Optimization Techniques) + backend/rag_system/cleaned_chunked_cai_production_v4.json (ec9373925eb970ec488f715d2a7aa756; financial_policies/msc_tuition_&_fees_framework; MSc Tuition & Fees Framework)

**Expected Answer Summary:** Structured fact: Intelligent Systems includes the course Optimization Techniques. Policy context: either in full or per registered hour. Late payments result in registration cancellation

**Why This Is Impressive:** Shows the thesis idea: graph fact plus policy prose.

### Hybrid-23

**Question:** Use both sources: Which program includes Operating Systems? Also summarize policy context for msc_program_structure_and_academic_requirements.

**Expected Route:** HYBRID_KG_RAG

**Expected Source:** backend/data/clean_graph.json (HAS_COURSE: Intelligent Systems -> Operating Systems) + backend/rag_system/cleaned_chunked_cai_production_v4.json (b20af204dbe3a98078260f245f469000; academic_policies/msc_program_structure_and_academic_requirements; MSc Program Structure and Academic Requirements)

**Expected Answer Summary:** Structured fact: Intelligent Systems includes the course Operating Systems. Policy context: (6 hours) , 4 elective courses (12 hours)

**Why This Is Impressive:** Shows the thesis idea: graph fact plus policy prose.

### Hybrid-24

**Question:** Use both sources: Which program includes Mobile Computing? Also summarize policy context for msc_program_structure_and_academic_requirements.

**Expected Route:** HYBRID_KG_RAG

**Expected Source:** backend/data/clean_graph.json (HAS_COURSE: Intelligent Systems -> Mobile Computing) + backend/rag_system/cleaned_chunked_cai_production_v4.json (2da411c06ab484494c0858d11cb40cd7; academic_policies/msc_program_structure_and_academic_requirements; MSc Program Structure and Academic Requirements)

**Expected Answer Summary:** Structured fact: Intelligent Systems includes the course Mobile Computing. Policy context: Admission requires a minimum GPA of 2.40/4.00 (or 'Good' grade)

**Why This Is Impressive:** Shows the thesis idea: graph fact plus policy prose.

### Hybrid-25

**Question:** Use both sources: What career role can Intelligent Systems lead to? Also summarize policy context for graduation_requirements_and_academic_integrity.

**Expected Route:** HYBRID_KG_RAG

**Expected Source:** backend/data/clean_graph.json (LEADS_TO: Intelligent Systems -> Machine Learning Engineer) + backend/rag_system/cleaned_chunked_cai_production_v4.json (2af6e0045c814058a266e17a7ee3d398; compliance/graduation_requirements_and_academic_integrity; Graduation Requirements and Academic Integrity)

**Expected Answer Summary:** Structured fact: Intelligent Systems leads to Machine Learning Engineer. Policy context: with a minimum passing grade of 60% per course.

**Why This Is Impressive:** Shows the thesis idea: graph fact plus policy prose.

### Hybrid-26

**Question:** Use both sources: What career role can Intelligent Systems lead to? Also summarize policy context for program_description.

**Expected Route:** HYBRID_KG_RAG

**Expected Source:** backend/data/clean_graph.json (LEADS_TO: Intelligent Systems -> Research Engineer) + backend/rag_system/cleaned_chunked_cai_production_v4.json (9bfb80ef0d0646ea7eaf618d4cb0c4d0; postgraduate_programs/program_description; Program Description)

**Expected Answer Summary:** Structured fact: Intelligent Systems leads to Research Engineer. Policy context: The program is designed to equip graduate students with both foundational

**Why This Is Impressive:** Shows the thesis idea: graph fact plus policy prose.

### Hybrid-27

**Question:** Use both sources: What does Intelligent Systems specialize in? Also summarize policy context for admission_requirements.

**Expected Route:** HYBRID_KG_RAG

**Expected Source:** backend/data/clean_graph.json (SPECIALIZES_IN: Intelligent Systems -> AI Foundations) + backend/rag_system/cleaned_chunked_cai_production_v4.json (5a333e314ed48a35dde9f49163699b4d; admissions/admission_requirements; Admission Requirements)

**Expected Answer Summary:** Structured fact: Intelligent Systems specializes in AI Foundations. Policy context: Graduates of other Engineering or Science specializations may be admitted

**Why This Is Impressive:** Shows the thesis idea: graph fact plus policy prose.

### Hybrid-28

**Question:** Use both sources: What does Intelligent Systems specialize in? Also summarize policy context for official_documents_required_for_admission.

**Expected Route:** HYBRID_KG_RAG

**Expected Source:** backend/data/clean_graph.json (SPECIALIZES_IN: Intelligent Systems -> Cognitive Computing) + backend/rag_system/cleaned_chunked_cai_production_v4.json (c7176b92ae68f79bd0949001b1b448b8; admissions/official_documents_required_for_admission; Official Documents Required for Admission)

**Expected Answer Summary:** Structured fact: Intelligent Systems specializes in Cognitive Computing. Policy context: or university previously attended; a Grading Scale Explanation

**Why This Is Impressive:** Shows the thesis idea: graph fact plus policy prose.

### Hybrid-29

**Question:** Use both sources: What is the has scholarship policy relationship between Intelligent Systems and Scholarship Pathway? Also summarize policy context for official_documents_required_for_admission.

**Expected Route:** HYBRID_KG_RAG

**Expected Source:** backend/data/clean_graph.json (HAS_SCHOLARSHIP_POLICY: Intelligent Systems -> Scholarship Pathway) + backend/rag_system/cleaned_chunked_cai_production_v4.json (93d8ad9f2fa9d62806d2d1502bd9a64f; admissions/official_documents_required_for_admission; Official Documents Required for Admission)

**Expected Answer Summary:** Structured fact: Intelligent Systems has scholarship policy Scholarship Pathway. Policy context: if the applicant is sponsored or funded by a specific entity

**Why This Is Impressive:** Shows the thesis idea: graph fact plus policy prose.

### Hybrid-30

**Question:** Use both sources: Which specialization is listed under Data Science? Also summarize policy context for academic_structure_&_specializations.

**Expected Route:** HYBRID_KG_RAG

**Expected Source:** backend/data/clean_graph.json (HAS_SPECIALIZATION: Data Science -> Data Science) + backend/rag_system/cleaned_chunked_cai_production_v4.json (310da067322a2cd77b77a58844be259c; postgraduate_programs/academic_structure_&_specializations; Academic Structure & Specializations)

**Expected Answer Summary:** Structured fact: Data Science has specialization Data Science. Policy context: . Specializations include Natural Language Processing (NLP) ,

**Why This Is Impressive:** Shows the thesis idea: graph fact plus policy prose.

## Decision Demos

### Decision-01

**Question:** I have strong interest in AI, high score, and moderate budget. Which path should I consider?

**Expected Route:** DECISION_ENGINE

**Expected Source:** backend/services/decisionService.js:632-819; backend/services/decisionService.js:517-532; backend/services/decisionService.js:844-879

**Expected Answer Summary:** The engine should ask for missing profile fields, then recommend an AI-oriented path using score, budget, and interests.

**Why This Is Impressive:** Shows profile validation, comparison, memory-aware advising, or roadmap behavior.

### Decision-02

**Question:** Compare Intelligent Systems and Data Science for analytics and machine learning.

**Expected Route:** DECISION_ENGINE

**Expected Source:** backend/services/decisionService.js:632-819; backend/services/decisionService.js:517-532; backend/services/decisionService.js:844-879

**Expected Answer Summary:** The engine should compare tradeoffs and cite course/career alignment when available.

**Why This Is Impressive:** Shows profile validation, comparison, memory-aware advising, or roadmap behavior.

### Decision-03

**Question:** Build a career roadmap for natural language processing.

**Expected Route:** CAREER_ENGINE

**Expected Source:** backend/services/decisionService.js:632-819; backend/services/decisionService.js:517-532; backend/services/decisionService.js:844-879

**Expected Answer Summary:** The career engine should produce role, skills, and next steps from roadmap logic and evidence.

**Why This Is Impressive:** Shows profile validation, comparison, memory-aware advising, or roadmap behavior.

### Decision-04

**Question:** My score and budget are missing. Should the system make a final recommendation?

**Expected Route:** DECISION_ENGINE

**Expected Source:** backend/services/decisionService.js:632-819; backend/services/decisionService.js:517-532; backend/services/decisionService.js:844-879

**Expected Answer Summary:** No. It should ask clarifying questions before final recommendation.

**Why This Is Impressive:** Shows profile validation, comparison, memory-aware advising, or roadmap behavior.

### Decision-05

**Question:** I prefer robotics, embedded systems, and labs. Which CAI path should be explored?

**Expected Route:** DECISION_ENGINE

**Expected Source:** backend/services/decisionService.js:632-819; backend/services/decisionService.js:517-532; backend/services/decisionService.js:844-879

**Expected Answer Summary:** It should favor robotics-oriented evidence if profile constraints fit.

**Why This Is Impressive:** Shows profile validation, comparison, memory-aware advising, or roadmap behavior.

### Decision-06

**Question:** I have strong interest in AI, high score, and moderate budget. Which path should I consider?

**Expected Route:** DECISION_ENGINE

**Expected Source:** backend/services/decisionService.js:632-819; backend/services/decisionService.js:517-532; backend/services/decisionService.js:844-879

**Expected Answer Summary:** The engine should ask for missing profile fields, then recommend an AI-oriented path using score, budget, and interests.

**Why This Is Impressive:** Shows profile validation, comparison, memory-aware advising, or roadmap behavior.

### Decision-07

**Question:** Compare Intelligent Systems and Data Science for analytics and machine learning.

**Expected Route:** DECISION_ENGINE

**Expected Source:** backend/services/decisionService.js:632-819; backend/services/decisionService.js:517-532; backend/services/decisionService.js:844-879

**Expected Answer Summary:** The engine should compare tradeoffs and cite course/career alignment when available.

**Why This Is Impressive:** Shows profile validation, comparison, memory-aware advising, or roadmap behavior.

### Decision-08

**Question:** Build a career roadmap for natural language processing.

**Expected Route:** CAREER_ENGINE

**Expected Source:** backend/services/decisionService.js:632-819; backend/services/decisionService.js:517-532; backend/services/decisionService.js:844-879

**Expected Answer Summary:** The career engine should produce role, skills, and next steps from roadmap logic and evidence.

**Why This Is Impressive:** Shows profile validation, comparison, memory-aware advising, or roadmap behavior.

### Decision-09

**Question:** My score and budget are missing. Should the system make a final recommendation?

**Expected Route:** DECISION_ENGINE

**Expected Source:** backend/services/decisionService.js:632-819; backend/services/decisionService.js:517-532; backend/services/decisionService.js:844-879

**Expected Answer Summary:** No. It should ask clarifying questions before final recommendation.

**Why This Is Impressive:** Shows profile validation, comparison, memory-aware advising, or roadmap behavior.

### Decision-10

**Question:** I prefer robotics, embedded systems, and labs. Which CAI path should be explored?

**Expected Route:** DECISION_ENGINE

**Expected Source:** backend/services/decisionService.js:632-819; backend/services/decisionService.js:517-532; backend/services/decisionService.js:844-879

**Expected Answer Summary:** It should favor robotics-oriented evidence if profile constraints fit.

**Why This Is Impressive:** Shows profile validation, comparison, memory-aware advising, or roadmap behavior.

### Decision-11

**Question:** I have strong interest in AI, high score, and moderate budget. Which path should I consider?

**Expected Route:** DECISION_ENGINE

**Expected Source:** backend/services/decisionService.js:632-819; backend/services/decisionService.js:517-532; backend/services/decisionService.js:844-879

**Expected Answer Summary:** The engine should ask for missing profile fields, then recommend an AI-oriented path using score, budget, and interests.

**Why This Is Impressive:** Shows profile validation, comparison, memory-aware advising, or roadmap behavior.

### Decision-12

**Question:** Compare Intelligent Systems and Data Science for analytics and machine learning.

**Expected Route:** DECISION_ENGINE

**Expected Source:** backend/services/decisionService.js:632-819; backend/services/decisionService.js:517-532; backend/services/decisionService.js:844-879

**Expected Answer Summary:** The engine should compare tradeoffs and cite course/career alignment when available.

**Why This Is Impressive:** Shows profile validation, comparison, memory-aware advising, or roadmap behavior.

### Decision-13

**Question:** Build a career roadmap for natural language processing.

**Expected Route:** CAREER_ENGINE

**Expected Source:** backend/services/decisionService.js:632-819; backend/services/decisionService.js:517-532; backend/services/decisionService.js:844-879

**Expected Answer Summary:** The career engine should produce role, skills, and next steps from roadmap logic and evidence.

**Why This Is Impressive:** Shows profile validation, comparison, memory-aware advising, or roadmap behavior.

### Decision-14

**Question:** My score and budget are missing. Should the system make a final recommendation?

**Expected Route:** DECISION_ENGINE

**Expected Source:** backend/services/decisionService.js:632-819; backend/services/decisionService.js:517-532; backend/services/decisionService.js:844-879

**Expected Answer Summary:** No. It should ask clarifying questions before final recommendation.

**Why This Is Impressive:** Shows profile validation, comparison, memory-aware advising, or roadmap behavior.

### Decision-15

**Question:** I prefer robotics, embedded systems, and labs. Which CAI path should be explored?

**Expected Route:** DECISION_ENGINE

**Expected Source:** backend/services/decisionService.js:632-819; backend/services/decisionService.js:517-532; backend/services/decisionService.js:844-879

**Expected Answer Summary:** It should favor robotics-oriented evidence if profile constraints fit.

**Why This Is Impressive:** Shows profile validation, comparison, memory-aware advising, or roadmap behavior.

### Decision-16

**Question:** I have strong interest in AI, high score, and moderate budget. Which path should I consider?

**Expected Route:** DECISION_ENGINE

**Expected Source:** backend/services/decisionService.js:632-819; backend/services/decisionService.js:517-532; backend/services/decisionService.js:844-879

**Expected Answer Summary:** The engine should ask for missing profile fields, then recommend an AI-oriented path using score, budget, and interests.

**Why This Is Impressive:** Shows profile validation, comparison, memory-aware advising, or roadmap behavior.

### Decision-17

**Question:** Compare Intelligent Systems and Data Science for analytics and machine learning.

**Expected Route:** DECISION_ENGINE

**Expected Source:** backend/services/decisionService.js:632-819; backend/services/decisionService.js:517-532; backend/services/decisionService.js:844-879

**Expected Answer Summary:** The engine should compare tradeoffs and cite course/career alignment when available.

**Why This Is Impressive:** Shows profile validation, comparison, memory-aware advising, or roadmap behavior.

### Decision-18

**Question:** Build a career roadmap for natural language processing.

**Expected Route:** CAREER_ENGINE

**Expected Source:** backend/services/decisionService.js:632-819; backend/services/decisionService.js:517-532; backend/services/decisionService.js:844-879

**Expected Answer Summary:** The career engine should produce role, skills, and next steps from roadmap logic and evidence.

**Why This Is Impressive:** Shows profile validation, comparison, memory-aware advising, or roadmap behavior.

### Decision-19

**Question:** My score and budget are missing. Should the system make a final recommendation?

**Expected Route:** DECISION_ENGINE

**Expected Source:** backend/services/decisionService.js:632-819; backend/services/decisionService.js:517-532; backend/services/decisionService.js:844-879

**Expected Answer Summary:** No. It should ask clarifying questions before final recommendation.

**Why This Is Impressive:** Shows profile validation, comparison, memory-aware advising, or roadmap behavior.

### Decision-20

**Question:** I prefer robotics, embedded systems, and labs. Which CAI path should be explored?

**Expected Route:** DECISION_ENGINE

**Expected Source:** backend/services/decisionService.js:632-819; backend/services/decisionService.js:517-532; backend/services/decisionService.js:844-879

**Expected Answer Summary:** It should favor robotics-oriented evidence if profile constraints fit.

**Why This Is Impressive:** Shows profile validation, comparison, memory-aware advising, or roadmap behavior.

## Demo Safety Rule

Run each question live before using it in defense. Capture route, confidence, sources, used_facts, graph metadata, latency, and logs.
