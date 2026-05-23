# Phase 4B Graph Metrics Report

- Generated at: `2026-05-17T10:49:46+00:00`
- Patch ID: `phase4b_20260517T104939Z`
- Database: `neo4j`
- Mode: `APPLIED`
- Integrity status: `PASS`

## Node Inventory

| Label | Count |
|---|---:|
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

## Relationship Inventory

| Type | Count |
|---|---:|
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

## Phase 4B Relationship Additions

| Type | Count |
|---|---:|
| ACTS_AS | 21 |
| HAS_ROLE | 17 |
| PART_OF_TRACK | 14 |
| CAREER_ALIGNMENT | 12 |
| BELONGS_TO | 10 |
| IS_SAME_ENTITY | 7 |
| MANAGES | 6 |
| RECOMMENDED_AFTER | 6 |
| LEADS_TO | 5 |
| SPECIALIZES_IN | 5 |
| WORKS_IN | 5 |
| HAS_PREREQUISITE | 3 |
| HEAD_OF | 3 |
| SUPPORTS_POLICY_QUERY | 3 |
| TEACHES | 3 |
| COMPARES_WITH | 2 |
| HAS_ADVISING_PATHWAY | 2 |
| HAS_COURSE | 2 |
| HAS_GOVERNANCE_BODY | 2 |
| HAS_SCHOLARSHIP_POLICY | 2 |
| HAS_TUITION_PATHWAY | 2 |
| ADMINISTERS | 1 |
| DEAN_OF | 1 |
| HAS_DEPARTMENT | 1 |
| HAS_SYLLABUS | 1 |
| HAS_UNIT | 1 |

## Duplicate And Split-Identity Audit

- Same-name duplicate clusters: `9`
- Weak course aliases detected: `2`
- Person/Professor split identities: `4`
- Admin fragments: `0`

## Demo Validation Suite

| Check | Success | Path Quality | Nodes | Links | Deterministic Ready | Evidence |
|---|---:|---|---:|---:|---:|---|
| Who is Hany Hanafy? | True | HIGH | 12 | 16 | True | Head of the Quality Unit at the College of Artificial Intelligence, El Alamein Branch |
| What does Hany Hanafy teach? | True | MEDIUM | 4 | 2 | True | Natural Language Processing; Cognitive Computing |
| Head of quality unit? | True | MEDIUM | 3 | 4 | True | Hany Hanafy Mahmoud Said -> Quality Unit |
| AI prerequisites? | True | HIGH | 8 | 5 | True | Machine Learning after Fundamentals of AI; Machine Learning after Linear Algebra; Deep Learning after Machine Learning; Computer Vision after Machine Learning |
| Compare AI vs Cybersecurity | True | HIGH | 16 | 17 | True | Intelligent Systems; Artificial Intelligence; AI Foundations; Cybersecurity |
| Career roadmap | True | HIGH | 10 | 10 | True | Intelligent Systems -> AI Engineer; Intelligent Systems -> Machine Learning Engineer; AI Foundations -> Machine Learning Engineer; Intelligent Systems -> Robotics Engineer |
| Tuition pathways | True | MEDIUM | 2 | 1 | True | Tuition and Fees Pathway |
| Scholarships | True | MEDIUM | 4 | 4 | True | Intelligent Systems -> Excellence Scholarship; Data Science -> Excellence Scholarship; Scholarship Pathway |
| Academic advising | True | MEDIUM | 4 | 3 | True | Academic Advising Pathway |

## Operational Notes

- Identity repair uses `IS_SAME_ENTITY` and `ACTS_AS`; it does not destructive-merge people.
- Weak course duplicates are isolated by default with `demo_hidden=true` and `canonical_id`.
- New governance, policy, and curriculum bridge records are tagged with `phase4b_patch_id`.
- `--delete-isolated-duplicates` is intentionally opt-in because it is destructive.

## Rollback

- Tagged rollback: `python phase4b_patch.py --rollback --apply --backup-file C:\Users\mh978\Downloads\AI_AGENT\backup_pre_phase4b.json`
- Full database restore, if required, should use the pre-patch backup exported before mutation.
