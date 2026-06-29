# GRAPH COVERAGE AUDIT

Date: 2026-06-23
Workspace: C:\AI_AGENT
Graph export: C:/AI_AGENT/full_graph.json
Neo4j context builder: C:/AI_AGENT/aast-ai-agent-main/backend/services/neo4jcontext.js

## Auditor Verdict

PARTIAL. neo4jContext.js has broad structural coverage of the Neo4j graph: all exported relationship types appear in Cypher, relationship allow-lists, or traversal logic, and every non-generic domain label is reachable either explicitly or implicitly. It does not fully represent the actual graph because relationship properties are not projected into context, many node properties never affect matching or fact text, and Course -> Course IS_SAME_ENTITY edges do not contribute to course context.

Key proof points:
- Parsed 144 node rows and 252 relationship rows from full_graph.json with 0 malformed rows.
- Found 25 labels, 38 relationship types, 64 node property keys, and 14 relationship property keys.
- returnProjection in neo4jContext.js returns node props through `{.*, embedding: null}`, but returns only `type(rel)` and endpoint labels/names for relationships; relationship property maps are absent.
- `IS_SAME_ENTITY` is used for person duplicate expansion, but it is not part of the general academic relation allow-list and Course -> Course equivalence edges are not emitted as context facts.

## Phase 1 - Graph Inventory

### Label Inventory
| Label | Count |
| --- | --- |
| Entity | 117 |
| Course | 42 |
| Person | 17 |
| Professor | 14 |
| CareerRole | 12 |
| Facility | 10 |
| Role | 10 |
| FacilityComponent | 6 |
| Track | 6 |
| CourseSyllabus | 4 |
| Policy | 3 |
| Specialization | 3 |
| GovernanceUnit | 2 |
| GradingSystem | 2 |
| PartnerInstitution | 2 |
| Program | 2 |
| Accreditation | 1 |
| Campus | 1 |
| College | 1 |
| Degree | 1 |
| Department | 1 |
| GradingPolicy | 1 |
| QualityUnit | 1 |
| Scholarship | 1 |
| TeachingStaff | 1 |

### Relationship Inventory
| Relationship Type | Count |
| --- | --- |
| HAS_COURSE | 37 |
| TEACHES | 22 |
| ACTS_AS | 21 |
| HAS_ROLE | 17 |
| WORKS_IN | 17 |
| PART_OF_TRACK | 14 |
| LEADS_TO | 13 |
| CAREER_ALIGNMENT | 12 |
| BELONGS_TO | 10 |
| HAS_FACILITY | 10 |
| IS_SAME_ENTITY | 7 |
| CONTAINS_COMPONENT | 6 |
| MANAGES | 6 |
| RECOMMENDED_AFTER | 6 |
| HAS_SYLLABUS | 5 |
| HEAD_OF | 5 |
| SPECIALIZES_IN | 5 |
| HAS_PREREQUISITE | 4 |
| HAS_ADMIN | 3 |
| HAS_SPECIALIZATION | 3 |
| SUPPORTS_POLICY_QUERY | 3 |
| COMPARES_WITH | 2 |
| HAS_ADVISING_PATHWAY | 2 |
| HAS_GOVERNANCE_BODY | 2 |
| HAS_PARTNER_INSTITUTION | 2 |
| HAS_SCHOLARSHIP | 2 |
| HAS_SCHOLARSHIP_POLICY | 2 |
| HAS_TUITION_PATHWAY | 2 |
| INCLUDES_PROGRAM | 2 |
| USES_GRADING_SYSTEM | 2 |
| ADMINISTERS | 1 |
| DEAN_OF | 1 |
| FOLLOWS_POLICY | 1 |
| HAS_ACCREDITATION | 1 |
| HAS_DEPARTMENT | 1 |
| HAS_UNIT | 1 |
| HOSTS | 1 |
| OFFERS | 1 |

### Graph Schema Map
| Relationship | Source Label | Target Label | Count |
| --- | --- | --- | --- |
| ACTS_AS | Person | Role | 17 |
| ACTS_AS | Professor | Role | 4 |
| ADMINISTERS | Person | College | 1 |
| BELONGS_TO | Department | College | 1 |
| BELONGS_TO | GovernanceUnit | College | 1 |
| BELONGS_TO | Policy | College | 3 |
| BELONGS_TO | Program | College | 2 |
| BELONGS_TO | Program | Department | 2 |
| BELONGS_TO | QualityUnit | College | 1 |
| CAREER_ALIGNMENT | Course | CareerRole | 4 |
| CAREER_ALIGNMENT | Track | CareerRole | 8 |
| COMPARES_WITH | Program | Track | 1 |
| COMPARES_WITH | Track | Track | 1 |
| CONTAINS_COMPONENT | Facility | FacilityComponent | 6 |
| DEAN_OF | Person | College | 1 |
| FOLLOWS_POLICY | College | GradingPolicy | 1 |
| HAS_ACCREDITATION | College | Accreditation | 1 |
| HAS_ADMIN | Person | GovernanceUnit | 3 |
| HAS_ADVISING_PATHWAY | Program | Policy | 2 |
| HAS_COURSE | Program | Course | 32 |
| HAS_COURSE | Specialization | Course | 5 |
| HAS_DEPARTMENT | College | Department | 1 |
| HAS_FACILITY | College | Facility | 10 |
| HAS_GOVERNANCE_BODY | College | GovernanceUnit | 2 |
| HAS_PARTNER_INSTITUTION | College | PartnerInstitution | 2 |
| HAS_PREREQUISITE | Course | Course | 4 |
| HAS_ROLE | Person | Role | 17 |
| HAS_SCHOLARSHIP | Program | Scholarship | 2 |
| HAS_SCHOLARSHIP_POLICY | Program | Policy | 2 |
| HAS_SPECIALIZATION | Program | Specialization | 3 |
| HAS_SYLLABUS | Course | CourseSyllabus | 5 |
| HAS_TUITION_PATHWAY | Program | Policy | 2 |
| HAS_UNIT | College | QualityUnit | 1 |
| HEAD_OF | Person | Department | 1 |
| HEAD_OF | Person | GovernanceUnit | 2 |
| HEAD_OF | Person | QualityUnit | 1 |
| HEAD_OF | Professor | QualityUnit | 1 |
| HOSTS | Campus | College | 1 |
| INCLUDES_PROGRAM | Degree | Program | 2 |
| IS_SAME_ENTITY | Course | Course | 2 |
| IS_SAME_ENTITY | Person | Professor | 4 |
| IS_SAME_ENTITY | Professor | Professor | 1 |
| LEADS_TO | Program | CareerRole | 8 |
| LEADS_TO | Track | CareerRole | 5 |
| MANAGES | GovernanceUnit | Program | 2 |
| MANAGES | Person | GovernanceUnit | 2 |
| MANAGES | Person | QualityUnit | 1 |
| MANAGES | Professor | QualityUnit | 1 |
| OFFERS | College | Degree | 1 |
| PART_OF_TRACK | Course | Track | 14 |
| RECOMMENDED_AFTER | Course | Course | 6 |
| SPECIALIZES_IN | Program | Track | 5 |
| SUPPORTS_POLICY_QUERY | College | Policy | 3 |
| TEACHES | College | Course | 1 |
| TEACHES | Professor | Course | 20 |
| TEACHES | Professor | Facility | 1 |
| USES_GRADING_SYSTEM | College | GradingSystem | 2 |
| WORKS_IN | Person | College | 16 |
| WORKS_IN | Professor | College | 1 |

## Phase 2 - Neo4j Context Audit

### Covered Labels
Explicitly queried labels:
- Campus
- College
- Course
- CourseSyllabus
- Department
- Facility
- FacilityComponent
- GovernanceUnit
- GradingPolicy
- GradingSystem
- PartnerInstitution
- Person
- Policy
- Professor
- Program
- QualityUnit
- Scholarship
- Specialization
- TeachingStaff
- Track

Implicitly reachable labels with no explicit label filter:
- Accreditation (1 node(s), 1 with embedding)
- CareerRole (12 node(s), 8 with embedding)
- Degree (1 node(s), 0 with embedding)
- Role (10 node(s), 0 with embedding)

### Ignored Labels
- Entity as a standalone semantic label. It is a generic secondary label on 117 nodes, but context projection uses the first label and no query targets Entity.

### Covered Relationships
- ACTS_AS (21 edge(s))
- ADMINISTERS (1 edge(s))
- BELONGS_TO (10 edge(s))
- CAREER_ALIGNMENT (12 edge(s))
- COMPARES_WITH (2 edge(s))
- CONTAINS_COMPONENT (6 edge(s))
- DEAN_OF (1 edge(s))
- FOLLOWS_POLICY (1 edge(s))
- HAS_ACCREDITATION (1 edge(s))
- HAS_ADMIN (3 edge(s))
- HAS_ADVISING_PATHWAY (2 edge(s))
- HAS_COURSE (37 edge(s))
- HAS_DEPARTMENT (1 edge(s))
- HAS_FACILITY (10 edge(s))
- HAS_GOVERNANCE_BODY (2 edge(s))
- HAS_PARTNER_INSTITUTION (2 edge(s))
- HAS_PREREQUISITE (4 edge(s))
- HAS_ROLE (17 edge(s))
- HAS_SCHOLARSHIP (2 edge(s))
- HAS_SCHOLARSHIP_POLICY (2 edge(s))
- HAS_SPECIALIZATION (3 edge(s))
- HAS_SYLLABUS (5 edge(s))
- HAS_TUITION_PATHWAY (2 edge(s))
- HAS_UNIT (1 edge(s))
- HEAD_OF (5 edge(s))
- HOSTS (1 edge(s))
- INCLUDES_PROGRAM (2 edge(s))
- IS_SAME_ENTITY (7 edge(s))
- LEADS_TO (13 edge(s))
- MANAGES (6 edge(s))
- OFFERS (1 edge(s))
- PART_OF_TRACK (14 edge(s))
- RECOMMENDED_AFTER (6 edge(s))
- SPECIALIZES_IN (5 edge(s))
- SUPPORTS_POLICY_QUERY (3 edge(s))
- TEACHES (22 edge(s))
- USES_GRADING_SYSTEM (2 edge(s))
- WORKS_IN (17 edge(s))

### Ignored Relationships
- None at relationship-type level. Every exported relationship type appears in neo4jContext.js.

Schema-level exception: Course -> Course IS_SAME_ENTITY exists but does not contribute to course context generation. See Phase 3.

### Covered Properties
Context-generating node properties referenced by matching, vector retrieval, curriculum parsing, fact text, or person summaries:
- applicability
- course_code
- credits
- dean
- degree_name
- description
- embedding
- facility_type
- full_name
- location_code
- mission
- name
- policy_type
- role
- schedule
- scope
- title
- track_type
- vice_dean
- vision

Payload-extracted node properties: all node properties on matched primary/related nodes are returned in `props` or `relatedProps` through `{.*, embedding: null}`. `embedding` is used for vector retrieval but stripped/nullified in returned context.

Relationship properties extracted: None proven. The context builder emits relationship type and endpoints, not `properties(rel)`.

### Ignored Properties
Node properties not semantically referenced by name in context generation, although they may ride inside `props` if their node is returned:
- academic_year
- campus_id_raw
- canonical_id
- city
- college_id_raw
- country
- data_source_type
- degree_abbrev
- demo_hidden
- difficulty
- discipline
- established_year
- excellent_range
- good_range
- id
- level
- location_codes
- math_intensity
- max_final_exam_score
- max_total_score
- min_final_exam_score
- min_gpa
- min_total_score
- pass_range
- phase4b_canonical
- phase4b_canonical_id
- phase4b_created
- phase4b_enriched_name
- phase4b_enriched_role
- phase4b_enriched_title
- phase4b_fragment_repaired
- phase4b_identity_hardened
- phase4b_patch_id
- phase4b_status
- positioning
- practical_intensity
- program_id_raw
- programming_intensity
- self_learning_dependency
- study_duration_years
- summer_applicable
- theoretical_intensity
- transfer_students_allowed
- very_good_range

Relationship properties never projected into context:
- alignment (12 occurrence(s))
- confidence (54 occurrence(s))
- created_by (137 occurrence(s))
- curriculum_bucket (37 occurrence(s))
- curriculum_role (14 occurrence(s))
- data_source_type (149 occurrence(s))
- instructor (1 occurrence(s))
- lab_assistant (16 occurrence(s))
- patched_at (137 occurrence(s))
- phase4b_patch_id (137 occurrence(s))
- phase4b_rewired_from (4 occurrence(s))
- query_family (3 occurrence(s))
- reason (15 occurrence(s))
- scope (1 occurrence(s))

## Phase 3 - Relationship Gap Analysis

Strict missing relationship/schema pairs:
| Relationship | Source Label | Target Label | Count | Impact | Priority |
| --- | --- | --- | --- | --- | --- |
| IS_SAME_ENTITY | Course | Course | 2 | Course equivalence/canonical duplicate edges do not contribute to course context. IS_SAME_ENTITY is used only for person-profile expansion, and the general traversal allow-list does not include it. | MEDIUM |

Weak coverage that is not strictly missing:
| Relationship | Schema | Count | Reason |
| --- | --- | --- | --- |
| LEADS_TO | Program -> CareerRole | 8 | Covered by general traversal; dedicated TRACK builder only handles Track/Specialization -> CareerRole. Program career outcomes can be under-ranked for program recommendation queries. |
| CAREER_ALIGNMENT | Course -> CareerRole | 4 | Covered by general traversal; dedicated career branch focuses on Track/Specialization sources. Course-career explanations can be weak. |
| RECOMMENDED_AFTER | Course -> Course | 6 | Covered by general traversal and humanization, but not in prerequisite-specific fallback. Course sequencing can be missed in prerequisite-like questions. |
| HAS_ACCREDITATION | College -> Accreditation | 1 | Covered by general traversal and humanization, but no accreditation intent or aggregation path. |
| Relationship properties | All relationships | 717 | Relationship metadata is not projected, so confidence, reason, alignment, curriculum role, instructor, and provenance do not affect generated context. |

## Phase 4 - Reachability Analysis

| Label | Reachable | Reason |
| --- | --- | --- |
| Accreditation | YES, implicit | No explicit label filter, but reachable as a vector match or neighbor through covered relationship schema: HAS_ACCREDITATION(College->Accreditation). |
| Campus | YES | Explicitly referenced by label filters, label arrays, or typed Cypher patterns in neo4jContext.js. |
| CareerRole | YES, implicit | No explicit label filter, but reachable as a vector match or neighbor through covered relationship schema: CAREER_ALIGNMENT(Course->CareerRole), CAREER_ALIGNMENT(Track->CareerRole), LEADS_TO(Program->CareerRole), LEADS_TO(Track->CareerRole). |
| College | YES | Explicitly referenced by label filters, label arrays, or typed Cypher patterns in neo4jContext.js. |
| Course | YES | Explicitly referenced by label filters, label arrays, or typed Cypher patterns in neo4jContext.js. |
| CourseSyllabus | YES | Explicitly referenced by label filters, label arrays, or typed Cypher patterns in neo4jContext.js. |
| Degree | YES, implicit | No explicit label filter, but reachable as a vector match or neighbor through covered relationship schema: INCLUDES_PROGRAM(Degree->Program), OFFERS(College->Degree). |
| Department | YES | Explicitly referenced by label filters, label arrays, or typed Cypher patterns in neo4jContext.js. |
| Entity | NO as standalone label | Secondary generic label only. The builder projects labels(node)[0] and does not query Entity as a domain label. Nodes carrying Entity can still be reached through their primary labels. |
| Facility | YES | Explicitly referenced by label filters, label arrays, or typed Cypher patterns in neo4jContext.js. |
| FacilityComponent | YES | Explicitly referenced by label filters, label arrays, or typed Cypher patterns in neo4jContext.js. |
| GovernanceUnit | YES | Explicitly referenced by label filters, label arrays, or typed Cypher patterns in neo4jContext.js. |
| GradingPolicy | YES | Explicitly referenced by label filters, label arrays, or typed Cypher patterns in neo4jContext.js. |
| GradingSystem | YES | Explicitly referenced by label filters, label arrays, or typed Cypher patterns in neo4jContext.js. |
| PartnerInstitution | YES | Explicitly referenced by label filters, label arrays, or typed Cypher patterns in neo4jContext.js. |
| Person | YES | Explicitly referenced by label filters, label arrays, or typed Cypher patterns in neo4jContext.js. |
| Policy | YES | Explicitly referenced by label filters, label arrays, or typed Cypher patterns in neo4jContext.js. |
| Professor | YES | Explicitly referenced by label filters, label arrays, or typed Cypher patterns in neo4jContext.js. |
| Program | YES | Explicitly referenced by label filters, label arrays, or typed Cypher patterns in neo4jContext.js. |
| QualityUnit | YES | Explicitly referenced by label filters, label arrays, or typed Cypher patterns in neo4jContext.js. |
| Role | YES, implicit | No explicit label filter, but reachable as a vector match or neighbor through covered relationship schema: ACTS_AS(Person->Role), ACTS_AS(Professor->Role), HAS_ROLE(Person->Role). |
| Scholarship | YES | Explicitly referenced by label filters, label arrays, or typed Cypher patterns in neo4jContext.js. |
| Specialization | YES | Explicitly referenced by label filters, label arrays, or typed Cypher patterns in neo4jContext.js. |
| TeachingStaff | YES | Explicitly referenced by label filters, label arrays, or typed Cypher patterns in neo4jContext.js. |
| Track | YES | Explicitly referenced by label filters, label arrays, or typed Cypher patterns in neo4jContext.js. |

## Phase 5 - Context Loss Analysis

| Lost Information Category | Cause | Affected Query Types | Severity |
| --- | --- | --- | --- |
| Relationship confidence/provenance/reasoning | returnProjection emits type(rel) and endpoint labels/names but no relationship property map. | Any query using graph facts; especially decision, explainability, and RAG evidence ranking. | HIGH |
| Program/student fit attributes | math_intensity, programming_intensity, practical_intensity, theoretical_intensity, self_learning_dependency, study_duration_years, degree_abbrev, and similar fields are not preferred fact properties. | Program recommendation, college recommendation, student guidance. | HIGH |
| Course sequencing beyond prerequisites | RECOMMENDED_AFTER exists and is generally traversable, but prerequisite fallback only matches HAS_PREREQUISITE. | Course planning, prerequisite-like questions, semester sequencing. | MEDIUM |
| Course duplicate/canonical equivalence | Course -> Course IS_SAME_ENTITY edges exist but the only IS_SAME_ENTITY expansion is person-profile specific. | Course lookup, alias normalization, GraphRAG retrieval. | MEDIUM |
| Career outcomes from programs/courses | CareerRole label is implicit only; Program -> CareerRole and Course -> CareerRole paths rely mostly on general traversal. | Program recommendation, career guidance, explainability. | HIGH |
| Grading/admission/eligibility thresholds | min_gpa, transfer_students_allowed, summer_applicable, min/max total and final exam score ranges are not used in query filters or preferred facts. | Decision system, admissions-like guidance, policy answers. | HIGH |
| Campus geography and college positioning | city, country, established_year, positioning, campus_id_raw, and college_id_raw are payload-only or absent from preferred fact selection. | College recommendation, campus questions, explainability. | MEDIUM |
| Patch/provenance fields | phase4b and data_source_type fields are not semantically used. | Auditability and source confidence, not normal student-facing guidance. | LOW |

## Phase 6 - Recommendation Quality Impact

| Area | Score | Reasoning |
| --- | --- | --- |
| College Recommendation | 86 | Campus, college, facilities, governance, policy, accreditation, and partner institution edges are reachable. Score is reduced because campus geography, positioning, relationship confidence, and accreditation have weak/dedicated coverage. |
| Program Recommendation | 78 | Program-course-specialization-track coverage is strong, but program intensity fields and direct Program -> CareerRole outcomes are not first-class in program intent queries. |
| Decision System | 70 | Graph facts are available, but relationship confidence/reason and grading/admission threshold properties do not meaningfully enter context generation. |
| GraphRAG Retrieval | 84 | All relationship types are present in Cypher/traversal logic, and vector retrieval is broad. Retrieval quality is limited by generic traversal caps and non-projected relationship metadata. |
| Explainability | 72 | Facts can produce graph nodes and links, but link properties are absent and many node attributes never become explanatory text. |
| Student Guidance | 76 | Teaching, prerequisites, curriculum, facilities, policies, and tracks are covered. Sequencing, career guidance, fit metrics, and eligibility thresholds remain partial. |

## Phase 7 - Coverage Score

| Metric | Formula | Score |
| --- | --- | --- |
| Node Coverage % | 24/25 labels covered or reachable | 96% |
| Relationship Coverage % | 250/252 relationship instances covered by type/path; 2 schema-level missing instance(s) | 99.2% |
| Property Coverage % | 20/78 property classes affect context generation; relationship property coverage is 0/14 | 25.6% |
| Reachability % | 24/25 labels reachable as semantic labels | 96% |
| Overall Graph Coverage Score | Average of node, relationship, context-generating property, and reachability coverage | 79.2/100 (Acceptable) |

Secondary structural payload score: 93/100 if node properties carried through `props` are counted as covered even when they do not affect fact text or ranking. The auditor score above uses context-generating property coverage because the goal is whether neo4jContext.js represents the graph in generated context.

Interpretation: Acceptable structural graph reachability, but not full graph representation. The primary blocker is property-level loss, especially relationship properties.

## Phase 8 - Fix Plan

### Priority 1 Fixes
| Missing Node Label | Missing Relationship | Why It Matters | Example Cypher Pattern | Estimated Recommendation Impact |
| --- | --- | --- | --- | --- |
| All relationship-bearing labels | All relationship properties | Relationship confidence, reason, alignment, instructor, lab assistant, curriculum role, and provenance are currently lost. | MATCH (a)-[r:HAS_COURSE]->(b) RETURN a {.*, embedding:null} AS sourceProps, properties(r) AS relProps, b {.*, embedding:null} AS targetProps | High for decision quality and explainability. |
| CareerRole | Program-[:LEADS_TO]->CareerRole; Course-[:CAREER_ALIGNMENT]->CareerRole | Career outcomes are central to program recommendation and student guidance, but program/course career links are mostly generic traversal. | MATCH (p:Program)-[r:LEADS_TO]->(c:CareerRole) RETURN p, r, c | High for program recommendation and career guidance. |
| Course | Course-[:IS_SAME_ENTITY]-Course | Course equivalence exists in the graph but does not contribute to course retrieval or alias repair. | MATCH (c:Course)-[r:IS_SAME_ENTITY]-(alias:Course) RETURN c, r, alias | Medium for GraphRAG recall and course lookup correctness. |

### Priority 2 Fixes
| Missing Node Label | Missing Relationship | Why It Matters | Example Cypher Pattern | Estimated Recommendation Impact |
| --- | --- | --- | --- | --- |
| Program, Degree, Course | HAS_COURSE, INCLUDES_PROGRAM, PART_OF_TRACK | Program fit attributes and course difficulty/intensity fields should be verbalized for recommendations. | MATCH (p:Program)-[:HAS_COURSE]->(c:Course) RETURN p.math_intensity, p.programming_intensity, c.difficulty, c.credits | Medium-high for personalization and student fit. |
| Policy, GradingSystem, GradingPolicy | FOLLOWS_POLICY, USES_GRADING_SYSTEM, SUPPORTS_POLICY_QUERY | Threshold fields such as min_gpa and score ranges are not used in facts. | MATCH (college:College)-[r:USES_GRADING_SYSTEM]->(g:GradingSystem) RETURN g.min_total_score, g.min_final_exam_score, g.pass_range | High for decision/admission-like guidance. |
| Course | RECOMMENDED_AFTER | Sequencing edges should be included in prerequisite/course-planning intent, not only generic traversal. | MATCH (course:Course)-[r:RECOMMENDED_AFTER]->(prior:Course) RETURN course, r, prior | Medium for course planning. |

### Priority 3 Fixes
| Missing Node Label | Missing Relationship | Why It Matters | Example Cypher Pattern | Estimated Recommendation Impact |
| --- | --- | --- | --- | --- |
| College, Campus | HOSTS, HAS_ACCREDITATION | College positioning, city, country, and accreditation can improve college explanations. | MATCH (campus:Campus)-[:HOSTS]->(college:College)-[:HAS_ACCREDITATION]->(accreditation:Accreditation) RETURN campus.city, campus.country, college.positioning, accreditation.name | Medium for college recommendation explainability. |
| All labels | All patched relationships | Patch/provenance fields are useful for auditor-facing evidence but should not dominate student answers. | MATCH (a)-[r]->(b) WHERE r.phase4b_patch_id IS NOT NULL RETURN type(r), r.phase4b_patch_id, r.created_by | Low for student-facing recommendations; medium for auditability. |
| Role, Accreditation, Degree | HAS_ROLE, HAS_ACCREDITATION, OFFERS | These labels are reachable implicitly but have no explicit label-specific intent. | MATCH (n) WHERE any(label IN labels(n) WHERE label IN ["Role", "Accreditation", "Degree"]) RETURN n | Low-medium; mostly improves targeted questions. |

## Final Answer

Does neo4jContext.js fully represent the actual Neo4j graph?

NO - PARTIAL. Relationship-type coverage is almost complete and domain-label reachability is strong, but full graph representation is not proven because relationship properties are dropped, many node properties never participate in context generation, and Course -> Course equivalence edges are not used for course context.

Most important fixes: project relationship properties, add first-class career outcome traversal for Program/Course -> CareerRole, and expand course equivalence/sequencing handling.
