# Synthetic conversation replay

This published replay records the 125 synthetic prompts actually submitted to the July appliance in 25 sessions. It keeps the adaptive branch selected in that run. Historical disposition and timing support engineering diagnosis. The full server responses, retrieved passages, account-scoped IDs and logs are retained in the local audit.

| Case / turn | Submitted prompt | Expected behavior | Historical route |
|---|---|---|---|
| S-A01/1 | Which bachelor programs does the College of Artificial Intelligence offer at El Alamein? | List the verified programs | KG_DIRECT |
| S-A01/2 | Which of the two focuses more on data? | Compare their evidenced focus | LLM |
| S-A01/3 | What careers can the first one lead to? | Bind ordinal to the presented order or clarify | KG_DIRECT |
| S-A01/4 | Does the other one include Machine Learning? | Use the other program or clarify | KG_DIRECT |
| S-A01/5 | Summarize the difference in two simple sentences. | Summarize only verified differences | LLM |
| S-A02/1 | What college does the El Alamein campus host in the graph? | Scope the campus | KG_DIRECT |
| S-A02/2 | What degree does that college offer? | Resolve college | KG |
| S-A02/3 | Which programs are part of that degree? | Resolve the degree | LLM |
| S-A02/4 | Does it have labs? | Clarify college versus degree | KG_DIRECT |
| S-A02/5 | Tell me more about one lab you can verify. | Name a supported facility | CONVERSATION |
| S-A03/1 | I’m new to the College of Artificial Intelligence. Can you explain my program options simply? | Ground options and keep tone simple | KG_DIRECT |
| S-A03/2 | What is the difference between Intelligent Systems and Data Science? | Use graph for comparison | KG_DIRECT |
| S-A03/3 | What about the one focused on building AI systems? | Resolve relevant program | KG_DIRECT |
| S-A03/4 | Does it include Machine Learning? | Bind course relation to program | KG_DIRECT |
| S-A03/5 | Why does the course matter for someone starting out? | Explain conceptually without inventing requirements | LLM |
| S-A04/1 | Who teaches Natural Language Processing? | Use course-teacher edge | KG_DIRECT |
| S-A04/2 | Does he teach any other courses? | Resolve prior person | KG_DIRECT |
| S-A04/3 | Who is the dean of the College of Artificial Intelligence? | Switch to dean role | KG_DIRECT |
| S-A04/4 | Back to the NLP teacher, what else does he do at the college? | Restore the NLP teacher | KG_DIRECT |
| S-A04/5 | Which part came from the graph? | Expose supporting edge or acknowledge limitation | LLM |
| S-B01/1 | Which prerequisites are listed for Machine Learning? | Use recorded prerequisite relations | KG_DIRECT |
| S-B01/2 | Why are those helpful? | Explain their preparation value | KG_DIRECT |
| S-B01/3 | What about the first one? | Honor displayed ordering or clarify | KG_DIRECT |
| S-B01/4 | Can you give me a simple example? | Label example as illustrative | LLM |
| S-B01/5 | Which part can you confirm from an official academic source, and what information is missing? | Identify supported and missing parts | LLM |
| S-B02/1 | Compare the recorded topics of NLP and Cognitive Computing. | Keep two courses distinct | KG_DIRECT |
| S-B02/2 | Does it have prerequisites? | Clarify if both are plausible | LLM |
| S-B02/3 | I mean Natural Language Processing. | Apply clarification to pending prerequisite request | KG_DIRECT |
| S-B02/4 | What about Cognitive Computing? | Transfer only the requested relation | KG_DIRECT |
| S-B02/5 | What evidence supports that? | Attribute or abstain | LLM |
| S-B03/1 | What does week 3 of Cognitive Computing cover? | Retrieve correct week | KG_DIRECT |
| S-B03/2 | Could you rephrase that without bullets? | Preserve fact and change format | LLM |
| S-B03/3 | Could you give me an example of that idea? | Keep concept in scope | LLM |
| S-B03/4 | And week 4? | Use same course, change week | KG_DIRECT |
| S-B03/5 | Which part can you confirm from an official academic source, and what information is missing? | Identify supported and missing parts | LLM |
| S-B04/1 | Tell me about the NLP syllabus. | Retrieve NLP | KG_DIRECT |
| S-B04/2 | What happens in week 4? | Carry NLP scope | KG_DIRECT |
| S-B04/3 | Sorry, I meant week 4 of Cognitive Computing. | Replace NLP with Cognitive Computing | KG_DIRECT |
| S-B04/4 | And the week after that? | Resolve week 5 in corrected course | KG_DIRECT |
| S-B04/5 | Can you show where the course and week came from? | Provide correct claim-level evidence | KG_DIRECT |
| S-C01/1 | What careers can Intelligent Systems lead to? | Use graph facts | KG_DIRECT |
| S-C01/2 | And Data Science? | Inherit career relation while switching subject | KG_DIRECT |
| S-C01/3 | Which of the first program’s courses is related to working with language? | Resolve first program or clarify | KG_DIRECT |
| S-C01/4 | Who teaches that course? | Resolve sourced course | CONVERSATION |
| S-C01/5 | What's a practical next step for exploring that pathway? | Give conditional next step | KG |
| S-C02/1 | What course is recommended after Machine Learning for studying language technology? | Use graph sequence with correct relation | KG_DIRECT |
| S-C02/2 | Is that required, or just suggested? | Distinguish requirement | HYBRID |
| S-C02/3 | What are the prerequisites for Machine Learning itself? | Switch to ML and prerequisites | KG_DIRECT |
| S-C02/4 | Why are those relevant to an AI career? | Explain relation without inventing eligibility | KG_DIRECT |
| S-C02/5 | Which relation supports the recommendation? | Name traced relation | LLM |
| S-C03/1 | I like building AI systems. Compare Intelligent Systems with Data Science for me. | Compare programs grounded in evidence | KG_DIRECT |
| S-C03/2 | What careers can the better fit lead to? | Preserve caveated fit or ask | KG |
| S-C03/3 | Does that one include Machine Learning? | Bind selected program | KG_DIRECT |
| S-C03/4 | I’m more interested in working with data now. | Update preference | LLM |
| S-C03/5 | Which part can you confirm from an official academic source, and what information is missing? | Identify supported and missing parts | LLM |
| S-C04/1 | Can you recommend a program for someone who enjoys machine learning? | Ask missing profile or qualify | INTERACTIVE |
| S-C04/2 | I’m comparing AI and Cybersecurity. I prefer technical work. | Keep alternatives without invented fees | LLM |
| S-C04/3 | What information about me do you need? | Request relevant fields | LLM |
| S-C04/4 | Can you explain the recommendation factors before I give grades or budget? | Explain constraints and ranking factors | INTERACTIVE |
| S-C04/5 | Can you separate eligibility from fit? | Preserve distinction | HYBRID |
| S-D01/1 | What GPA threshold is stated for academic probation? | Retrieve supported policy threshold | RAG_DIRECT |
| S-D01/2 | How is that GPA calculated? | Recover calculation | LLM |
| S-D01/3 | Why does the word below matter? | Explain strict inequality | LLM |
| S-D01/4 | What if I have exactly 2.0? | Avoid broader policy inference | LLM |
| S-D01/5 | Which part can you confirm from an official academic source, and what information is missing? | Identify supported and missing parts | LLM |
| S-D02/1 | How do I apply for the merit scholarship? | Distinguish steps and eligibility | HYBRID |
| S-D02/2 | What eligibility conditions do you actually have evidence for? | State sourced eligibility | HYBRID |
| S-D02/3 | Does that tell me where to submit the application? | Do not invent submission steps | LLM |
| S-D02/4 | What about the deadline? | Qualify or abstain on deadline | RAG |
| S-D02/5 | Which part can you confirm from an official academic source, and what information is missing? | Identify supported and missing parts | LLM |
| S-D03/1 | Does Mobile Computing have a recorded syllabus, and who issues the official academic calendar? | Cover both sourced intents | HYBRID |
| S-D03/2 | Which part came from the policy passage? | Identify policy part | KG_DIRECT |
| S-D03/3 | What about week 3 of that course? | Resolve Mobile Computing | KG |
| S-D03/4 | Can you repeat the calendar part in one sentence? | Recover only calendar part | LLM |
| S-D03/5 | Which part can you confirm from an official academic source, and what information is missing? | Identify supported and missing parts | LLM |
| S-D04/1 | Who issues the official academic calendar? | Use policy authority | KG |
| S-D04/2 | When does spring start according to the policy you have? | State only supported timing | KG_DIRECT |
| S-D04/3 | What about exact registration dates next year? | Abstain on unspecified future dates | RAG |
| S-D04/4 | Can you tell me how to find the current dates? | Point to current official source | CONVERSATION |
| S-D04/5 | Remind me who issues the calendar. | Restore authority | KG |
| S-D05/1 | How can I check the current tuition for an AAST program? | Clarify relevant scope | HYBRID |
| S-D05/2 | I mean an AI bachelor's program at El Alamein. | Narrow institution and program | KG_DIRECT |
| S-D05/3 | Can you give an exact price for next year? | No future quote without evidence | RAG |
| S-D05/4 | What financial eligibility information can you verify instead? | Give attributable alternatives or clarify | LLM |
| S-D05/5 | Which part can you confirm from an official academic source, and what information is missing? | Identify supported and missing parts | LLM |
| S-E01/1 | Which program includes Machine Learning, and what are its course code and credits? | Use program/IN221/credits evidence | KG_DIRECT |
| S-E01/2 | What must a student complete before taking it? | Resolve prerequisite scope | KG_DIRECT |
| S-E01/3 | Is Linear Algebra an actual prerequisite? | Confirm only recorded relation | KG_DIRECT |
| S-E01/4 | Could you say that in plain language for a first-year student? | Retain fact and simplify | CONVERSATION |
| S-E01/5 | What evidence do you have for the prerequisite? | Show linked evidence | KG_DIRECT |
| S-E02/1 | Does the graph recommend Computer Vision after Machine Learning? | Scope recommendation edge | INTERACTIVE |
| S-E02/2 | What about Natural Language Processing? | Apply same relation to NLP | KG_DIRECT |
| S-E02/3 | Which course is recommended after NLP? | Change anchor to NLP | KG_DIRECT |
| S-E02/4 | Does that mean an enforced prerequisite? | Avoid reading suggestion as requirement | CONVERSATION |
| S-E02/5 | Compare the two relation types in one sentence. | Explain distinction | INTERACTIVE |
| S-E03/1 | Compare week 3 of Cognitive Computing and week 4 of NLP. | Bind both course/week requests or clarify | KG_DIRECT |
| S-E03/2 | Explain the second one briefly. | Resolve ordinal | CONVERSATION |
| S-E03/3 | Now tell me when spring starts under the official calendar policy. | Switch to policy scope | KG_DIRECT |
| S-E03/4 | Back to the first course, what is the topic? | Return to earlier course/week or clarify | KG_DIRECT |
| S-E03/5 | Can you show the course and policy evidence separately? | Keep evidence distinct | KG_DIRECT |
| S-E04/1 | Which course covers transformers according to the saved syllabus? | Find grounded syllabus | KG_DIRECT |
| S-E04/2 | Who teaches it? | Resolve course | KG_DIRECT |
| S-E04/3 | What week is that topic taught? | Hold topic and course constant | CONVERSATION |
| S-E04/4 | Could you double-check whether you mean NLP or another course? | Check challenge against evidence | KG_DIRECT |
| S-E04/5 | Tell me the course name without restating the whole syllabus. | Be concise | KG_DIRECT |
| S-F01/1 | عايز أعرف برامج AI في العلمين، ايه الاختيارات؟ | Recognize bilingual campus/program | LLM |
| S-F01/2 | طب ال Data Science ده ايه؟ | Scope Data Science | KG_DIRECT |
| S-F01/3 | و careers بتاعته؟ | Inherit career relation | INTERACTIVE |
| S-F01/4 | طيب مين بيدرس NLP؟ | Switch to NLP instructor | KG_DIRECT |
| S-F01/5 | كنت بسأل ايه عن Data Science؟ | Recall relevant earlier context | KG_DIRECT |
| S-F02/1 | machin lernning prereqs? | Normalize typo or clarify | LLM |
| S-F02/2 | طيب هو له course code؟ | Resolve ML and course code | KG |
| S-F02/3 | what abt CV after it? | Clarify CV/sequence if needed | LLM |
| S-F02/4 | I mean Computer Vision, after Machine Learning. | Apply corrected intent | KG_DIRECT |
| S-F02/5 | متأكد؟ وريني المصدر | Respond with actual evidence | LLM |
| S-F03/1 | el GPA probation starts when? | Scope probation policy | RAG_DIRECT |
| S-F03/2 | طب لو exactly 2.0؟ | Respect threshold | LLM |
| S-F03/3 | مين dean بتاع AI؟ | Switch to dean | KG_DIRECT |
| S-F03/4 | طب ارجع لل probation، احسب ال GPA ازاي؟ | Return to GPA calculation | RAG_DIRECT |
| S-F03/5 | What specific graph fact or official university passage supports your last claim? | Provide actual evidence or qualify prior claim | LLM |
| S-F04/1 | Can you tell me tomorrow’s weather? | Avoid unsupported forecast | CONVERSATION |
| S-F04/2 | ok then who teaches NLP at the college? | Reset to academic domain | KG_DIRECT |
| S-F04/3 | and what about that? | Clarify missing attribute | LLM |
| S-F04/4 | I meant what else does the instructor teach? | Resolve prior teacher | KG_DIRECT |
| S-F04/5 | Actually back to the course, what is it about? | Return to original course scope | CONVERSATION |

[Replay JSONL](conversation_results.jsonl) · [Scenario definitions](conversation_scenarios.json) · [Turn analysis](05_TURN_LEVEL_FAILURE_ANALYSIS.md)
