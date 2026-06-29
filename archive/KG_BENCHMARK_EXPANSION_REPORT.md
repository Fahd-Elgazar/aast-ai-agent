# KG BENCHMARK EXPANSION REPORT

Date: 2026-06-24
Graph: C:\AI_AGENT\full_graph.json
Benchmark folder: C:\AI_AGENT\aast-ai-agent-main\backend\testing
Expanded benchmark: C:\AI_AGENT\aast-ai-agent-main\backend\testing\kg_benchmark_expanded.json
Expanded execution report: C:\AI_AGENT\aast-ai-agent-main\backend\testing\kg_benchmark_expanded_report.json

## Executive Verdict

PARTIAL EXECUTION. The benchmark expansion was created successfully from real graph facts and executed through the same HTTP answer surface as the existing benchmark. The live execution environment was degraded: the orchestrator health endpoints returned HTTP 503 during the run, and expanded benchmark responses repeatedly reported subsystem_health kg=false and rag=false. Therefore the 0% expanded accuracy should be read as a runtime retrieval availability failure, not as a clean measurement of question quality.

## Original Benchmark Size

| Metric | Value |
| --- | --- |
| Original benchmark questions | 35 |
| Original route accuracy after rerun | 37.14% |
| Original misroute percent after rerun | 62.86% |
| Original retrieval benchmark integrity score | 1.71 |
| Original KG precision metric | 0.00% |
| Original RAG recall metric | 0.00% |
| Original average latency | 32 ms |

## Expanded Benchmark Size

| Metric | Value |
| --- | --- |
| Expanded benchmark questions | 100 |
| Added questions | 100 |
| Easy / Medium / Hard | 20 / 30 / 50 |
| Expanded categories | 15 |
| Expanded relationship types referenced | 32 |
| Expanded domain labels referenced | 22 |

## Coverage Increase

| Coverage Metric | Before | After | Delta |
| --- | --- | --- | --- |
| Question count | 35 | 100 | +65 |
| Domain label class coverage | 5/24 (20.83%) | 22/24 (91.67%) | +70.84 pp |
| Relationship type coverage | 16/38 (42.11%) | 32/38 (84.21%) | +42.10 pp |
| Answer-level expected labels | Not present | 100 generated expected answers | +100 answer gold labels |
| Difficulty coverage | Not labeled | 20 Easy, 30 Medium, 50 Hard | Added difficulty stratification |

## Accuracy Before And After

| Metric | Original Benchmark | Expanded Benchmark | Interpretation |
| --- | --- | --- | --- |
| Accuracy | 37.14% route accuracy | 0% answer/evidence accuracy | Different metric surfaces; expanded benchmark requires answer/evidence match. |
| Precision | Not available as answer precision in original files | 33.33% | Low-confidence evidence token precision under degraded runtime. |
| Recall | Not available as answer recall in original files | 0.45% | Almost no expected graph atoms recovered. |
| F1 | Not available as answer F1 in original files | 0.89% | Collapsed because recall is near zero. |
| Coverage | Route/source coverage only | 5% graph evidence hit rate | Only 5/100 expanded rows returned any graph/fact evidence. |
| Average retrieval time | 32 ms original retrieval run | 64 ms expanded run | Fast failures caused by unavailable KG/RAG services. |

## Per Category Accuracy
| Category | Total | Passed | Failed | Accuracy | Avg Latency ms |
| --- | --- | --- | --- | --- | --- |
| Partnerships | 20 | 0 | 20 | 0% | 151 |
| Multi-Hop Career | 12 | 0 | 12 | 0% | 31 |
| Faculty | 11 | 0 | 11 | 0% | 13 |
| Course Planning | 10 | 0 | 10 | 0% | 31 |
| Career | 8 | 0 | 8 | 0% | 30 |
| Facilities | 8 | 0 | 8 | 0% | 23 |
| Policies | 8 | 0 | 8 | 0% | 109 |
| Governance | 6 | 0 | 6 | 0% | 73 |
| Curriculum | 4 | 0 | 4 | 0% | 6 |
| Scholarships | 4 | 0 | 4 | 0% | 51 |
| Programs | 3 | 0 | 3 | 0% | 13 |
| Comparison | 2 | 0 | 2 | 0% | 12 |
| Specializations | 2 | 0 | 2 | 0% | 84 |
| Accreditation | 1 | 0 | 1 | 0% | 264 |
| Campus | 1 | 0 | 1 | 0% | 91 |

## Per Difficulty Accuracy
| Difficulty | Total | Passed | Failed | Accuracy | Avg Latency ms |
| --- | --- | --- | --- | --- | --- |
| Easy | 20 | 0 | 20 | 0% | 53 |
| Medium | 30 | 0 | 30 | 0% | 48 |
| Hard | 50 | 0 | 50 | 0% | 78 |

## Top Failure Categories
| Root Cause | Count | Share |
| --- | --- | --- |
| Missing Retrieval | 96 | 96.00% of failures |
| Prompt Failure | 4 | 4.00% of failures |

## Failure Analysis

Every failed expanded question is listed below. Actual answers are from the live run against the local orchestrator.

| ID | Category | Difficulty | Question | Expected Answer | Actual Answer | Root Cause |
| --- | --- | --- | --- | --- | --- | --- |
| KG_EXP_001 | Policies | Easy | Which policy does College of Artificial Intelligence follow? | College of Artificial Intelligence follows Course Passing Criteria. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_002 | Policies | Easy | Which grading system does College of Artificial Intelligence use? | College of Artificial Intelligence uses AAST Grading System (Pre-2023). | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_003 | Scholarships | Easy | Which scholarship is connected to Intelligent Systems? | Intelligent Systems has scholarship Excellence Scholarship. | Insufficient verified academic evidence was found for this query. | Missing Retrieval |
| KG_EXP_004 | Facilities | Easy | Which college has the Basic Electronic Lab facility? | College of Artificial Intelligence has the Basic Electronic Lab facility. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_005 | Facilities | Easy | Which college has the Physics Lab facility? | College of Artificial Intelligence has the Physics Lab facility. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_006 | Facilities | Easy | Which college has the General Purpose Computers Lab facility? | College of Artificial Intelligence has the General Purpose Computers Lab facility. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_007 | Facilities | Easy | Which college has the UV (Un-Manned Vehicle) facility? | College of Artificial Intelligence has the UV (Un-Manned Vehicle) facility. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_008 | Facilities | Easy | Which college has the Embedded Systems facility? | College of Artificial Intelligence has the Embedded Systems facility. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_009 | Facilities | Easy | Which college has the Basic IoT (Internet of Things) facility? | College of Artificial Intelligence has the Basic IoT (Internet of Things) facility. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_010 | Facilities | Easy | Which college has the Workstations Lab facility? | College of Artificial Intelligence has the Workstations Lab facility. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_011 | Scholarships | Easy | Which scholarship is connected to Data Science? | Data Science has scholarship Excellence Scholarship. | Insufficient verified academic evidence was found for this query. | Missing Retrieval |
| KG_EXP_012 | Accreditation | Easy | What accreditation is connected to College of Artificial Intelligence? | College of Artificial Intelligence has accreditation from Egyptian Supreme Council of Universities. | I couldn't find verified institutional policy evidence for this query. | Missing Retrieval |
| KG_EXP_013 | Campus | Easy | Which college does El Alamein Campus host? | El Alamein Campus hosts College of Artificial Intelligence. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_014 | Programs | Easy | Which degree does College of Artificial Intelligence offer? | College of Artificial Intelligence offers Bachelor of Science. | I couldn't find verified institutional policy evidence for this query. | Missing Retrieval |
| KG_EXP_015 | Faculty | Easy | Who teaches Robotics Design and Simulation? | Amr Nasr teaches Robotics Design and Simulation. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_016 | Faculty | Easy | Who teaches Swarm Intelligence? | Khaled Badran teaches Swarm Intelligence. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_017 | Faculty | Easy | Who teaches Block Chain? | Amira Elsaid teaches Block Chain. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_018 | Faculty | Easy | Who teaches Image Processing & Pattern Recognition? | Nihal Mabrouk teaches Image Processing & Pattern Recognition. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_019 | Faculty | Easy | Who teaches Statistics for Data Science? | Eman Elakabawy teaches Statistics for Data Science. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_020 | Faculty | Easy | Who teaches Ethics & Governance of AI? | Mohamed Talaat teaches Ethics & Governance of AI. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_021 | Policies | Medium | Which tuition pathway policy is connected to Intelligent Systems? | Intelligent Systems has tuition pathway Tuition and Fees Pathway. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_022 | Policies | Medium | Which tuition pathway policy is connected to Data Science? | Data Science has tuition pathway Tuition and Fees Pathway. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_023 | Scholarships | Medium | Which scholarship policy is connected to Intelligent Systems? | Intelligent Systems has scholarship policy Scholarship Pathway. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_024 | Scholarships | Medium | Which scholarship policy is connected to Data Science? | Data Science has scholarship policy Scholarship Pathway. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_025 | Policies | Medium | Which advising pathway is connected to Intelligent Systems? | Intelligent Systems has academic advising pathway Academic Advising Pathway. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_026 | Policies | Medium | Which advising pathway is connected to Data Science? | Data Science has academic advising pathway Academic Advising Pathway. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_027 | Policies | Medium | Which policy pathway does College of Artificial Intelligence support for queries? | College of Artificial Intelligence supports the Tuition and Fees Pathway policy pathway. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_028 | Curriculum | Medium | What syllabus schedule is attached to Data Mining? | Data Mining has syllabus information: [{"week": 1, "topic": "KDD & CRISP-DM", "lab_focus": "Mining project definition", "date": "2026-02-09"}, {"week": 2, "topic": "Problem understanding", "lab_focus": "Mining task for... | Your timetable is available on the AAST portal under Student Services. | Prompt Failure |
| KG_EXP_029 | Curriculum | Medium | What syllabus schedule is attached to Natural Language Processing? | Natural Language Processing has syllabus information: [{"week": 1, "topic": "Introduction to NLP (1)"}, {"week": 2, "topic": "Introduction to NLP (2)"}, {"week": 3, "topic": "NLP pipeline"}, {"week": 4, "topic": "Text Representation"}... | Your timetable is available on the AAST portal under Student Services. | Prompt Failure |
| KG_EXP_030 | Curriculum | Medium | What syllabus schedule is attached to Cognitive Computing? | Cognitive Computing has syllabus information: [{"week": 1, "topic": "The era of Cognitive Computing"}, {"week": 2, "topic": "Introduction to Natural Language Processing"}, {"week": 3, "topic": "Transformer (Text)"}, {"week": 4... | Your timetable is available on the AAST portal under Student Services. | Prompt Failure |
| KG_EXP_031 | Curriculum | Medium | What syllabus schedule is attached to Mobile Computing? | Mobile Computing has syllabus information: [{"week": 1, "topic": "Mobile AI Strategy Fundamentals", "date": "2026-02-11"}, {"week": 2, "topic": "Mobile app Concepts & architecture", "date": "2026-02-18"}, {"week": 3, "topic... | Your timetable is available on the AAST portal under Student Services. | Prompt Failure |
| KG_EXP_032 | Programs | Medium | Which program does Bachelor of Science include? | Bachelor of Science includes Intelligent Systems. | I couldn't find verified institutional policy evidence for this query. | Missing Retrieval |
| KG_EXP_033 | Course Planning | Medium | Which track contains Ethics & Governance of AI from Data Science? | Ethics & Governance of AI is included in Data Science and is part of the Artificial Intelligence track. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_034 | Course Planning | Medium | Which track contains Cognitive Computing from Robotics? | Cognitive Computing is included in Robotics and is part of the Cognitive Computing track. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_035 | Specializations | Medium | Which course belongs to the Robotics specialization in Intelligent Systems? | Fundamentals of Robotics belongs to the Robotics specialization in Intelligent Systems. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_036 | Career | Medium | What career role is connected to the Artificial Intelligence track in Intelligent Systems? | Intelligent Systems specializes in Artificial Intelligence, and Artificial Intelligence leads to or aligns with AI Engineer. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_037 | Career | Medium | What career role is connected to the AI Foundations track in Intelligent Systems? | Intelligent Systems specializes in AI Foundations, and AI Foundations leads to or aligns with Machine Learning Engineer. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_038 | Career | Medium | What career role is connected to the Natural Language Processing track in Intelligent Systems? | Intelligent Systems specializes in Natural Language Processing, and Natural Language Processing leads to or aligns with NLP Engineer. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_039 | Career | Medium | What career role is connected to the Cognitive Computing track in Intelligent Systems? | Intelligent Systems specializes in Cognitive Computing, and Cognitive Computing leads to or aligns with Cognitive AI Engineer. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_040 | Career | Medium | What career role is connected to the Data Science track in Data Science? | Data Science specializes in Data Science, and Data Science leads to or aligns with Data Scientist. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_041 | Facilities | Medium | Which component is inside the Robotics Lab facility at College of Artificial Intelligence? | Robotics Lab at College of Artificial Intelligence contains Dobot Magician. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_042 | Governance | Medium | How is CAI Governance connected to College of Artificial Intelligence governance? | College of Artificial Intelligence is connected to CAI Governance through HAS_GOVERNANCE_BODY, and CAI Governance is also connected through HEAD_OF with Ahmed Mohamed Mansour Khames Elshaer. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_043 | Governance | Medium | How is Program Governance connected to College of Artificial Intelligence governance? | College of Artificial Intelligence is connected to Program Governance through HAS_GOVERNANCE_BODY, and Program Governance is also connected through MANAGES with Intelligent Systems. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_044 | Governance | Medium | How is Quality Unit connected to College of Artificial Intelligence governance? | College of Artificial Intelligence is connected to Quality Unit through HAS_UNIT, and Quality Unit is also connected through HEAD_OF with Hany Hanafy Mahmoud Said. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_045 | Governance | Medium | How is Artificial Intelligence Department connected to College of Artificial Intelligence governance? | College of Artificial Intelligence is connected to Artificial Intelligence Department through HAS_DEPARTMENT, and Artificial Intelligence Department is also connected through HEAD_OF with Ahmed Mohamed Mansour Khames Elshaer. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_046 | Faculty | Medium | Which track is associated with a course taught by Osama Badawy? | Osama Badawy teaches Data Mining, and Data Mining is part of the Data Science track. | I couldn't find verified institutional policy evidence for this query. | Missing Retrieval |
| KG_EXP_047 | Faculty | Medium | Which track is associated with a course taught by Eman Elakabawy? | Eman Elakabawy teaches Statistics for Data Science, and Statistics for Data Science is part of the Data Science track. | I couldn't find verified institutional policy evidence for this query. | Missing Retrieval |
| KG_EXP_048 | Faculty | Medium | Which track is associated with a course taught by Mohamed Talaat? | Mohamed Talaat teaches Ethics & Governance of AI, and Ethics & Governance of AI is part of the Artificial Intelligence track. | I couldn't find verified institutional policy evidence for this query. | Missing Retrieval |
| KG_EXP_049 | Faculty | Medium | Which track is associated with a course taught by Somaya Ahmed? | Somaya Ahmed teaches Computer Vision, and Computer Vision is part of the AI Foundations track. | I couldn't find verified institutional policy evidence for this query. | Missing Retrieval |
| KG_EXP_050 | Faculty | Medium | Which track is associated with a course taught by Hany Hanafy Mahmoud Said? | Hany Hanafy Mahmoud Said teaches Natural Language Processing, and Natural Language Processing is part of the Natural Language Processing track. | I couldn't find verified institutional policy evidence for this query. | Missing Retrieval |
| KG_EXP_051 | Career | Hard | Which career role is aligned with a course in Intelligent Systems, and what is the course? | Intelligent Systems includes Deep Learning; Deep Learning aligns with the Machine Learning Engineer career role. | I couldn't find verified institutional policy evidence for this query. | Missing Retrieval |
| KG_EXP_052 | Career | Hard | Which career role is aligned with a course in Data Science, and what is the course? | Data Science includes Data Mining; Data Mining aligns with the Data Scientist career role. | I couldn't find verified institutional policy evidence for this query. | Missing Retrieval |
| KG_EXP_053 | Career | Hard | Which career role is aligned with a course in Robotics, and what is the course? | Robotics includes Cognitive Computing; Cognitive Computing aligns with the Cognitive AI Engineer career role. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_054 | Policies | Hard | Which policy and grading system are connected to College of Artificial Intelligence? | College of Artificial Intelligence follows Course Passing Criteria and uses AAST Grading System (Pre-2023). | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_055 | Governance | Hard | Who is connected to CAI Governance in College of Artificial Intelligence's governance graph? | College of Artificial Intelligence is connected to CAI Governance through HAS_GOVERNANCE_BODY; Ahmed Mohamed Mansour Khames Elshaer is connected to CAI Governance through HEAD_OF. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_056 | Multi-Hop Career | Hard | Starting from Intelligent Systems, which career role can be reached through Fundamentals of AI and the AI Foundations track? | Intelligent Systems includes Fundamentals of AI; Fundamentals of AI is part of AI Foundations; AI Foundations leads to or aligns with Machine Learning Engineer. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_057 | Multi-Hop Career | Hard | Starting from Intelligent Systems, which career role can be reached through Linear Algebra and the AI Foundations track? | Intelligent Systems includes Linear Algebra; Linear Algebra is part of AI Foundations; AI Foundations leads to or aligns with Machine Learning Engineer. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_058 | Multi-Hop Career | Hard | Starting from Intelligent Systems, which career role can be reached through Probability & Statistics and the AI Foundations track? | Intelligent Systems includes Probability & Statistics; Probability & Statistics is part of AI Foundations; AI Foundations leads to or aligns with Machine Learning Engineer. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_059 | Multi-Hop Career | Hard | Starting from Intelligent Systems, which career role can be reached through Computer Vision and the AI Foundations track? | Intelligent Systems includes Computer Vision; Computer Vision is part of AI Foundations; AI Foundations leads to or aligns with Machine Learning Engineer. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_060 | Multi-Hop Career | Hard | Starting from Intelligent Systems, which career role can be reached through Natural Language Processing and the Natural Language Processing track? | Intelligent Systems includes Natural Language Processing; Natural Language Processing is part of Natural Language Processing; Natural Language Processing leads to or aligns with NLP Engineer. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_061 | Multi-Hop Career | Hard | Starting from Data Science, which career role can be reached through Data Mining and the Data Science track? | Data Science includes Data Mining; Data Mining is part of Data Science; Data Science leads to or aligns with Data Scientist. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_062 | Multi-Hop Career | Hard | Starting from Data Science, which career role can be reached through Fundamentals of Data Science and the Data Science track? | Data Science includes Fundamentals of Data Science; Fundamentals of Data Science is part of Data Science; Data Science leads to or aligns with Data Scientist. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_063 | Multi-Hop Career | Hard | Starting from Data Science, which career role can be reached through Statistics for Data Science and the Data Science track? | Data Science includes Statistics for Data Science; Statistics for Data Science is part of Data Science; Data Science leads to or aligns with Data Scientist. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_064 | Multi-Hop Career | Hard | Starting from Data Science, which career role can be reached through Big Data Analytics and the Data Science track? | Data Science includes Big Data Analytics; Big Data Analytics is part of Data Science; Data Science leads to or aligns with Data Scientist. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_065 | Multi-Hop Career | Hard | Starting from Data Science, which career role can be reached through Information Retrieval & Search Engines and the Natural Language Processing track? | Data Science includes Information Retrieval & Search Engines; Information Retrieval & Search Engines is part of Natural Language Processing; Natural Language Processing leads to or aligns with NLP Engineer. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_066 | Multi-Hop Career | Hard | Starting from Data Science, which career role can be reached through Ethics & Governance of AI and the Artificial Intelligence track? | Data Science includes Ethics & Governance of AI; Ethics & Governance of AI is part of Artificial Intelligence; Artificial Intelligence leads to or aligns with AI Engineer. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_067 | Multi-Hop Career | Hard | Starting from Robotics, which career role can be reached through Cognitive Computing and the Cognitive Computing track? | Robotics includes Cognitive Computing; Cognitive Computing is part of Cognitive Computing; Cognitive Computing leads to or aligns with Cognitive AI Engineer. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_068 | Specializations | Hard | Which track is reached from Intelligent Systems through the Robotics specialization and Cognitive Computing? | Intelligent Systems has specialization Robotics; Robotics includes Cognitive Computing; Cognitive Computing is part of the Cognitive Computing track. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_069 | Comparison | Hard | What graph comparison exists between Intelligent Systems and Cybersecurity? | Intelligent Systems compares with Cybersecurity. | Insufficient verified academic evidence was found for this query. | Missing Retrieval |
| KG_EXP_070 | Comparison | Hard | What graph comparison exists between Artificial Intelligence and Cybersecurity? | Artificial Intelligence compares with Cybersecurity. | Comparison: Artificial Intelligence vs Cybersecurity Salary Outlook: In the Egyptian market, starting salaries for Artificial Intelligence and Cybersecurity are competitive, but specialized roles typically see a 15-20% premium over the first 3 years. Skills Overlap: Both fields share foundational problem-solving skills. However, Artificial Intelligence focuses more on specialized core logic, whereas Cybersecurity leans into parallel systems. | Missing Retrieval |
| KG_EXP_071 | Course Planning | Hard | For course planning, what should be taken before Data Mining? | Data Mining is recommended after Statistics for Data Science. | I couldn't find verified institutional policy evidence for this query. | Missing Retrieval |
| KG_EXP_072 | Course Planning | Hard | For course planning, what should be taken before Computer Vision? | Computer Vision is recommended after Machine Learning. | I couldn't find verified institutional policy evidence for this query. | Missing Retrieval |
| KG_EXP_073 | Course Planning | Hard | For course planning, what should be taken before Natural Language Processing? | Natural Language Processing is recommended after Machine Learning. | I couldn't find verified institutional policy evidence for this query. | Missing Retrieval |
| KG_EXP_074 | Course Planning | Hard | For course planning, what should be taken before Cognitive Computing? | Cognitive Computing is recommended after Natural Language Processing. | I couldn't find verified institutional policy evidence for this query. | Missing Retrieval |
| KG_EXP_075 | Course Planning | Hard | For course planning, what should be taken before Big Data Analytics? | Big Data Analytics is recommended after Data Mining. | I couldn't find verified institutional policy evidence for this query. | Missing Retrieval |
| KG_EXP_076 | Course Planning | Hard | For course planning, what should be taken before Information Retrieval & Search Engines? | Information Retrieval & Search Engines is recommended after Data Mining. | I couldn't find verified institutional policy evidence for this query. | Missing Retrieval |
| KG_EXP_077 | Course Planning | Hard | What prerequisite or sequencing evidence exists for Deep Learning? | Machine Learning is a prerequisite for Deep Learning. Also, Computer Vision is recommended after Machine Learning. | I couldn't find verified institutional policy evidence for this query. | Missing Retrieval |
| KG_EXP_078 | Course Planning | Hard | What prerequisite or sequencing evidence exists for Data Mining? | Fundamentals of Data Science is a prerequisite for Data Mining. Also, Data Mining is recommended after Statistics for Data Science. | I couldn't find verified institutional policy evidence for this query. | Missing Retrieval |
| KG_EXP_079 | Partnerships | Hard | Which college has both partner institution Autònoma University of Barcelona and facility Robotics Lab? | College of Artificial Intelligence has partner institution Autònoma University of Barcelona and has the Robotics Lab facility. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_080 | Partnerships | Hard | Which college has both partner institution Autònoma University of Barcelona and facility Virtual Reality Lab? | College of Artificial Intelligence has partner institution Autònoma University of Barcelona and has the Virtual Reality Lab facility. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_081 | Partnerships | Hard | Which college has both partner institution Autònoma University of Barcelona and facility IoT Lab? | College of Artificial Intelligence has partner institution Autònoma University of Barcelona and has the IoT Lab facility. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_082 | Partnerships | Hard | Which college has both partner institution Autònoma University of Barcelona and facility Basic Electronic Lab? | College of Artificial Intelligence has partner institution Autònoma University of Barcelona and has the Basic Electronic Lab facility. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_083 | Partnerships | Hard | Which college has both partner institution Autònoma University of Barcelona and facility Physics Lab? | College of Artificial Intelligence has partner institution Autònoma University of Barcelona and has the Physics Lab facility. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_084 | Partnerships | Hard | Which college has both partner institution Autònoma University of Barcelona and facility General Purpose Computers Lab? | College of Artificial Intelligence has partner institution Autònoma University of Barcelona and has the General Purpose Computers Lab facility. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_085 | Partnerships | Hard | Which college has both partner institution Autònoma University of Barcelona and facility UV (Un-Manned Vehicle)? | College of Artificial Intelligence has partner institution Autònoma University of Barcelona and has the UV (Un-Manned Vehicle) facility. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_086 | Partnerships | Hard | Which college has both partner institution Autònoma University of Barcelona and facility Embedded Systems? | College of Artificial Intelligence has partner institution Autònoma University of Barcelona and has the Embedded Systems facility. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_087 | Partnerships | Hard | Which college has both partner institution Autònoma University of Barcelona and facility Basic IoT (Internet of Things)? | College of Artificial Intelligence has partner institution Autònoma University of Barcelona and has the Basic IoT (Internet of Things) facility. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_088 | Partnerships | Hard | Which college has both partner institution Autònoma University of Barcelona and facility Workstations Lab? | College of Artificial Intelligence has partner institution Autònoma University of Barcelona and has the Workstations Lab facility. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_089 | Partnerships | Hard | Which college has both partner institution University of Central Lancashire (UCLan) and facility Robotics Lab? | College of Artificial Intelligence has partner institution University of Central Lancashire (UCLan) and has the Robotics Lab facility. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_090 | Partnerships | Hard | Which college has both partner institution University of Central Lancashire (UCLan) and facility Virtual Reality Lab? | College of Artificial Intelligence has partner institution University of Central Lancashire (UCLan) and has the Virtual Reality Lab facility. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_091 | Partnerships | Hard | Which college has both partner institution University of Central Lancashire (UCLan) and facility IoT Lab? | College of Artificial Intelligence has partner institution University of Central Lancashire (UCLan) and has the IoT Lab facility. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_092 | Partnerships | Hard | Which college has both partner institution University of Central Lancashire (UCLan) and facility Basic Electronic Lab? | College of Artificial Intelligence has partner institution University of Central Lancashire (UCLan) and has the Basic Electronic Lab facility. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_093 | Partnerships | Hard | Which college has both partner institution University of Central Lancashire (UCLan) and facility Physics Lab? | College of Artificial Intelligence has partner institution University of Central Lancashire (UCLan) and has the Physics Lab facility. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_094 | Partnerships | Hard | Which college has both partner institution University of Central Lancashire (UCLan) and facility General Purpose Computers Lab? | College of Artificial Intelligence has partner institution University of Central Lancashire (UCLan) and has the General Purpose Computers Lab facility. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_095 | Partnerships | Hard | Which college has both partner institution University of Central Lancashire (UCLan) and facility UV (Un-Manned Vehicle)? | College of Artificial Intelligence has partner institution University of Central Lancashire (UCLan) and has the UV (Un-Manned Vehicle) facility. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_096 | Partnerships | Hard | Which college has both partner institution University of Central Lancashire (UCLan) and facility Embedded Systems? | College of Artificial Intelligence has partner institution University of Central Lancashire (UCLan) and has the Embedded Systems facility. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_097 | Partnerships | Hard | Which college has both partner institution University of Central Lancashire (UCLan) and facility Basic IoT (Internet of Things)? | College of Artificial Intelligence has partner institution University of Central Lancashire (UCLan) and has the Basic IoT (Internet of Things) facility. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_098 | Partnerships | Hard | Which college has both partner institution University of Central Lancashire (UCLan) and facility Workstations Lab? | College of Artificial Intelligence has partner institution University of Central Lancashire (UCLan) and has the Workstations Lab facility. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |
| KG_EXP_099 | Programs | Hard | Which program can be reached from College of Artificial Intelligence through Bachelor of Science? | College of Artificial Intelligence offers Bachelor of Science, and Bachelor of Science includes Intelligent Systems. | I couldn't find verified institutional policy evidence for this query. | Missing Retrieval |
| KG_EXP_100 | Governance | Hard | What governance or administrative role does Ali Ali Mohamed Fahmy have, and where do they work? | Ali Ali Mohamed Fahmy is connected to CAI Governance through HAS_ADMIN and works in College of Artificial Intelligence. | I couldn't find verified knowledge graph evidence for this query. | Missing Retrieval |

## Recommendations

- Restore Neo4j availability on 127.0.0.1:7687 or run the Docker stack before treating expanded accuracy as a KG quality result.
- Restore RAG retriever availability on 127.0.0.1:8001 before rerunning hybrid/policy measurements.
- Normalize benchmark source labels: existing retrievalBenchmark expects KG/RAG but live responses often emit KG_DIRECT/RAG_DIRECT.
- Keep kg_benchmark_expanded.json as a graph-fact benchmark and rerun it after health endpoints return non-503 and subsystem_health reports kg=true.
- Add answer-level expected-answer support to the original benchmark if future comparisons should use Accuracy/Precision/Recall/F1 rather than route accuracy only.
- Use the expanded failures after a healthy rerun to separate real Missing Relationship Traversal from current Missing Retrieval noise.

## Files Produced

- C:\AI_AGENT\BENCHMARK_COVERAGE_REPORT.md
- C:\AI_AGENT\aast-ai-agent-main\backend\testing\kg_benchmark_expanded.json
- C:\AI_AGENT\aast-ai-agent-main\backend\testing\kg_benchmark_generation_stats.json
- C:\AI_AGENT\aast-ai-agent-main\backend\testing\kg_benchmark_expanded_report.json
- C:\AI_AGENT\KG_BENCHMARK_EXPANSION_REPORT.md