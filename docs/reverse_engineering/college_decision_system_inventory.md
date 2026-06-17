# College Decision System Backend Inventory & Discovery

This document records the repository discovery and itemized counts for the **College Decision System Backend** (`college-decision-system-backend`) to evaluate subsystem complexity and determine document splitting boundaries.

---

## 1. Subsystem Component Counts

### A. Python Files
There are **110 Python files** in the `college-decision-system-backend` directory:
- **Core application code (`app/`)**: 45 implementation files (excluding `__init__.py` and caches).
- **Scripts & ETL tools (`scripts/` / Root)**: 18 script files.
- **Alembic database migrations (`alembic/`)**: 10 files (9 versions + 1 environment config).
- **Automated test suite (`tests/`)**: 37 test scripts.

### B. FastAPI Routes
There are **8 active API routes** registered on the FastAPI application:
1. `POST /api/v1/students/evaluate` (Validates and echoes student profile)
2. `POST /api/v1/decisions/recommend` (Runs recommendation matching for AI Agent)
3. `POST /api/v1/chat/message` (Processes interactive chat sessions with history)
4. `GET /api/v1/voice-health` (Exposes voice transcription engine status)
5. `POST /api/v1/voice-entry` (Transcribes audio stream and recommends major)
6. `GET /api/v1/admin/programs` (Queries all programs from SQL database)
7. `PUT /api/v1/admin/programs/{program_id}` (Updates specific program percentage/fees/tracks)
8. `GET /health` (Exposes global health checks and speech configurations)

### C. SQLAlchemy Database Models
There are **28 SQLAlchemy database models** mapped to relational tables and schemas under `app/infrastructure/db/models/`:
- **College Models (`decision_college.py`)**: `DecisionCollegeModel`, `DecisionAcceptedCertificateModel`, `DecisionAdmissionRequirementModel`, `DecisionCollegeAccreditationModel`, `DecisionCollegeFacilityModel`, `DecisionCollegeLeadershipModel`, `DecisionCollegeLevelProfileModel`, `DecisionCollegeMobilityModel`, `DecisionCollegeMobilityItemModel`, `DecisionCollegeResearchFocusModel`, `DecisionCollegeSourceModel`, `DecisionTrainingAndPracticeModel`.
- **Program Models (`decision_program.py`)**: `DecisionProgramModel`, `DecisionProgramTraitModel`, `DecisionProgramDecisionProfileModel`, `DecisionProgramCareerPathModel`, `DecisionEmploymentOutlookModel`.
- **Fee Models (`decision_fee.py`)**: `DecisionFeeDefinitionModel`, `DecisionFeeAmountModel`, `DecisionFeeCategoryRuleModel`, `DecisionFeeRuleThresholdModel`, `DecisionFeeRuleCollegeModel`, `DecisionFeeAdditionalFeeModel`, `DecisionFeeGlobalPolicyModel`, `DecisionFeeItemModel`.
- **Scholarship Models (`decision_scholarship.py`)**: `DecisionScholarshipModel`, `DecisionScholarshipEligibilityModel`.
- **Chat History Models (`chat_message.py`)**: `ChatMessageModel`.

### D. Pydantic Schemas
There are **34 Pydantic validation schemas** declared under `app/api/v1/schemas/`:
- **Agent Decision schemas**: `StudentProfileSchema`, `PreferencesSchema`, `AgentRecommendRequestSchema`, `AgentRecommendResponseSchema`.
- **Chat schemas**: `ChatRequestSchema`, `ChatResponseSchema`.
- **Decision schemas**: `RecommendProgramsRequestSchema`, `FeeLineItemSchema`, `FeeDetailsSchema`, `DecisionDataCompletenessSchema`, `ProgramRecommendationSchema`, `RecommendProgramsResponseSchema`.
- **Normalization schemas**: `BaseNormalization`, `OfficialDataSchema`, `DecisionSupportSchema`, `QualityCheckSchema`, `CollegeLocationSchema`, `CollegeEstablishmentSchema`, `CollegeOverviewSchema`, `CollegeAccreditationSchema`, `StandardizedFeeSchema`, `CollegeAdmissionSchema`, `DecisionCollegeProfileSchema`, `DecisionProgramProfileSchema`, `DecisionProgramCareerPathSchema`, `DecisionProgramTraitSchema`, `DecisionEmploymentOutlookSchema`, `StandardizedProgramSchema`, `CollegeDegreesProgramsSchema`, `CollegeStudentRegulationsSchema`, `CollegeTrainingPracticeSchema`, `NormalizationSourceSchema`, `NormalizationEntitySchema`.
- **Student schemas**: `StudentInputSchema`.

### E. Services
There are **8 application-level services** under `app/application/services/`:
1. `agent_service.py` (Coordinates chat agent dialogue and function calls)
2. `tuition_calculator.py` (Calculates course and semester tuition fees)
3. `fee_category_resolver.py` (Resolves dynamic student fee category rules)
4. `speech_service.py` (Handles audio processing and Whisper transcriber models)
5. `ingestion_service.py` (Ingests data dumps into the database)
6. `interest_expansion_service.py` (Expands student interests using synonyms)
7. `training_intensity_deriver.py` (Calculates course workload and intensity)
8. `decision_numeric_normalizer.py` (Normalizes grades and scoring variables)

### F. Repositories
There are **4 database repository layers** under `app/infrastructure/db/repositories/`:
1. `chat_repo.py` (ChatMessage queries and transaction management)
2. `decision_college_repo.py` (Queries college metadata and profiles)
3. `decision_program_repo.py` (Queries and filters academic programs)
4. `decision_fee_repo.py` (Handles fee category structures and rules)

### G. Domain Entities and Value Objects
There are **4 domain structures** under `app/domain/`:
- **Entities (`app/domain/entities/`)**: `decision_schema.py`
- **Value Objects (`app/domain/value_objects/`)**: `distance.py`, `fee_category.py`, `score.py`

### H. Alembic Migrations
There are **9 migration scripts** tracking database version schema evolutions inside `alembic/versions/`:
1. `3d6b8e491c76_initial_schema.py`
2. `9c8a6d1f4b2a_add_decision_dataset_schema.py`
3. `c1e7a9d42f51_add_decision_fee_schema.py`
4. `4a4dbd1d4c6c_add_program_fees.py`
5. `1c26e9f9d3c2_add_chat_messages_table.py`
6. `377dbfa7c09e_add_students_table.py`
7. `41d5ba5c5a79_add_min_percentage_and_allowed_tracks_.py`
8. `e6f3d9a8b1c2_add_runtime_integrity_indexes.py`
9. `f4c2d7e9b3a1_drop_legacy_mvp_tables.py`

---

## 2. Document Splitting Assessment

The subsystem complexity boundaries are defined as follows:
- **Python Files Limit**: 20 files (Current: **110 files** - *EXCEEDED*)
- **FastAPI Routes Limit**: 10 routes (Current: **8 routes** - *NOT EXCEEDED*)
- **Database Models Limit**: 5 models (Current: **28 models** - *EXCEEDED*)

### Decision
Because the Python file count (110) and database model count (28) significantly exceed the splitting thresholds, **a single documentation file is insufficient**. We will automatically split the documentation into the following 8 dedicated files to preserve strict reverse-engineering standards:
- `08_decision_engine.md` (System overview, core configuration, logging, and folders)
- `08a_domain_model.md` (SQLAlchemy models fields, constraints, relationships, indexes, foreign keys)
- `08b_business_rules.md` (Tuition calculations, fee resolutions, Normalizations, intensities)
- `08c_recommendation_pipeline.md` (use_cases/recommend_programs.py multi-stage filtering, scoring math, interest expansions)
- `08d_database_schema.md` (DDL mappings, composite indices, constraints, integrity checks)
- `08e_api_contracts.md` (FastAPI router definitions, paths, schemas, validations, dependencies)
- `08f_validation_layer.md` (Pydantic input/output validation, integrity safeguards)
- `08g_migrations_audit.md` (Alembic migration timeline, operations audits)
