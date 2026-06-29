# Decision Support System - Reverse Engineering Worklog

This worklog records the step-by-step reverse engineering process and findings for the College Decision Support System.

---

## 1. Analysis of [main.py](file:///C:/AI_AGENT/college-decision-system-backend/app/main.py)

* **File Purpose**: Main application entry point for the FastAPI server, initializing configuration, middleware, routers, and system health checks.
* **Dependencies**:
  - `fastapi` (FastAPI, CORSMiddleware)
  - `app.api.v1.routers` (`admin`, `chat`, `decisions`, `students`, and conditionally `voice`)
  - `app.application.services.speech_service` (`get_voice_runtime_status`)
  - `app.config.settings` (`settings`)
* **Inputs**: FastAPI application startup events, HTTP requests.
* **Outputs**: Initialized FastAPI instance, `/health` response.
* **Internal Logic**:
  - Creates the application instance via `create_app()`.
  - Attaches `CORSMiddleware` configured to allow localhost/127.0.0.1 on port 5173 (commonly frontend developers' Vite server).
  - Conditionally imports and registers `/voice` router if `settings.VOICE_ENABLED` is true.
  - Mounts default health-check endpoint at `/health` returning API status, voice runtime status, and startup flags.
* **Business Logic**: Determines whether speech services (Whisper, ffmpeg routing) are enabled in the environment.
* **Decision Logic**: None (purely routing and setup).
* **Observations**: Uses a conditional import pattern for `voice` router, allowing the application to start up even if Whisper/ffmpeg dependencies are not present, which is useful when voice services are disabled.

---

## 2. Analysis of [settings.py](file:///C:/AI_AGENT/college-decision-system-backend/app/config/settings.py)

* **File Purpose**: Defines the application settings schema and loads environment configuration values from `.env` or the environment variables using Pydantic Settings.
* **Dependencies**:
  - `pydantic` (`SecretStr`, `field_validator`)
  - `pydantic_settings` (`BaseSettings`, `SettingsConfigDict`)
* **Inputs**: `.env` file, environment variables.
* **Outputs**: Typed configurations in the `settings` object.
* **Internal Logic**:
  - Declares settings class `Settings` inheriting from `BaseSettings`.
  - Configures `SettingsConfigDict` to load from `.env`, case-insensitive, ignoring extra properties.
  - Defines fields: `APP_NAME`, `DEBUG`, `HOST`, `PORT`, `DATABASE_URL`, `GEMINI_API_KEY` (SecretStr), `DECISION_GEMINI_ENABLED`, `INTERNAL_SECRET_KEY` (SecretStr), `VOICE_ENABLED`, `VOICE_WHISPER_MODEL`, `VOICE_DEVICE`, `VOICE_TEMP_DIR`, `VOICE_MAX_UPLOAD_MB`, `VOICE_FFMPEG_LOCAL_COPY`.
  - Uses `field_validator` for `DEBUG` to handle string representations of truthy/falsy values (like "development", "prod", "on", "off").
* **Business Logic**: Dictates whether LLM decisions (Gemini) are enabled, voice processing limits (max upload, device, temp dir), and db location.
* **Decision Logic**: None.
* **Observations**: Employs `SecretStr` for `GEMINI_API_KEY` and `INTERNAL_SECRET_KEY` to prevent accidental logging or printing of API keys in trace logs.

---

## 3. Analysis of Database Models ([decision_common.py](file:///C:/AI_AGENT/college-decision-system-backend/app/infrastructure/db/models/decision_common.py))

* **File Purpose**: Defines the database schema using SQLAlchemy ORM for college decision data, fee category rules, scholarships, and chat logging.
* **Dependencies**:
  - `sqlalchemy` (orm, validates, relationship, types, types.TypeDecorator)
  - `decimal`, `datetime`
  - `app.infrastructure.db.session` (`Base`)
  - `app.infrastructure.db.models.decision_common` (`SafeNumeric`, `validate_allowed_value`, `DecisionTimestampMixin`)
* **Inputs**: Python model definition properties, database row fields.
* **Outputs**: SQLAlchemy model classes.
* **Internal Logic**:
  - **[decision_common.py](file:///C:/AI_AGENT/college-decision-system-backend/app/infrastructure/db/models/decision_common.py)**:
    - Defines [SafeNumeric](file:///C:/AI_AGENT/college-decision-system-backend/app/infrastructure/db/models/decision_common.py#L39), a custom `TypeDecorator` wrapping SQLAlchemy `Numeric`. Its `result_processor` catches database exceptions (e.g. malformed or invalid SQLite decimal values) and safely falls back to stripping the string and constructing a `Decimal`, preventing runtime crashes when loading dirty data.
    - Defines `DecisionTimestampMixin` with `created_at` and `updated_at` timestamps.
    - Defines `validate_allowed_value` helper to check and raise `ValueError` for restricted ENUM-like sets.
  - **[decision_college.py](file:///C:/AI_AGENT/college-decision-system-backend/app/infrastructure/db/models/decision_college.py)**:
    - [DecisionCollegeModel](file:///C:/AI_AGENT/college-decision-system-backend/app/infrastructure/db/models/decision_college.py#L20): Primary entity for colleges. Columns include `id`, `schema_version`, `entity_type`, `college_name`, `city`, `country`, `branch`, `year_established`, etc. Has one-to-one or one-to-many relationships to leadership entries, programs, level profiles, training & practice, admission requirements, accreditations, facilities, research focus items, and mobility.
    - `DecisionCollegeLevelProfileModel`: Numerical ratings for college-level indicators like `theoretical_depth`, `math_intensity`, `practical_intensity`, `field_work_intensity`, `egypt_employability_score`, `international_employability_score`, etc.
    - `DecisionAdmissionRequirementModel` & `DecisionAcceptedCertificateModel`: Requirements for admissions, lists of certificates allowed.
    - `DecisionCollegeAccreditationModel` & `DecisionCollegeMobilityModel`: Tracks college accreditations (scopes: national/international) and student exchange mobility items.
  - **[decision_program.py](file:///C:/AI_AGENT/college-decision-system-backend/app/infrastructure/db/models/decision_program.py)**:
    - [DecisionProgramModel](file:///C:/AI_AGENT/college-decision-system-backend/app/infrastructure/db/models/decision_program.py#L21): College programs, containing `program_name`, `program_family`, `degree_type`, `study_duration_years`, `min_percentage` (admission cut-off), [allowed_tracks](file:///C:/AI_AGENT/college-decision-system-backend/app/infrastructure/db/models/decision_program.py#L51) (e.g., "Scientific/Mathematical", "Scientific/Science", "Literature"), `program_fees`.
    - [DecisionProgramDecisionProfileModel](file:///C:/AI_AGENT/college-decision-system-backend/app/infrastructure/db/models/decision_program.py#L89): Focus weight indicators (0.0 to 10.0 scale) for specific fields like `ai_focus`, `data_focus`, `software_focus`, `security_focus`, `hardware_focus`, `math_intensity`, `programming_intensity`, `field_work_intensity`, etc.
    - `DecisionEmploymentOutlookModel`: Tracks employability levels and scores in Egypt vs. international markets.
  - **[decision_fee.py](file:///C:/AI_AGENT/college-decision-system-backend/app/infrastructure/db/models/decision_fee.py)**:
    - [DecisionFeeItemModel](file:///C:/AI_AGENT/college-decision-system-backend/app/infrastructure/db/models/decision_fee.py#L30): Raw/mapped fee records. Links to [DecisionCollegeModel](file:///C:/AI_AGENT/college-decision-system-backend/app/infrastructure/db/models/decision_college.py#L20) and [DecisionProgramModel](file:///C:/AI_AGENT/college-decision-system-backend/app/infrastructure/db/models/decision_program.py#L21) via foreign keys `source_college_match_id` and `source_program_match_id`.
    - [DecisionFeeAmountModel](file:///C:/AI_AGENT/college-decision-system-backend/app/infrastructure/db/models/decision_fee.py#L91): Stores tuition amounts based on `student_group` (`supportive_states`, `other_states`) and `fee_category` (`A`, `B`, `C`).
    - `DecisionFeeCategoryRuleModel`: Defines score ranges/thresholds per certificate type and student group to resolve which fee category (A, B, or C) a student falls into.
  - **[decision_scholarship.py](file:///C:/AI_AGENT/college-decision-system-backend/app/infrastructure/db/models/decision_scholarship.py)**:
    - `DecisionScholarshipModel` and `DecisionScholarshipEligibilityModel` defining scholarship schemes and their criteria.
  - **[chat_message.py](file:///C:/AI_AGENT/college-decision-system-backend/app/infrastructure/db/models/chat_message.py)**:
    - `ChatMessageModel`: Simple log structure for recording chat conversations (`session_id`, `role`, `content`, `tool_calls` as JSON).
* **Business Logic**: Encapsulates entity constraints, field definitions, and schema relationships representing the college structure.
* **Decision Logic**: [SafeNumeric](file:///C:/AI_AGENT/college-decision-system-backend/app/infrastructure/db/models/decision_common.py#L39) allows the system to remain resilient to malformed database values by returning string conversions instead of crashing.
* **Observations**: High usage of Pydantic-like validations via SQLAlchemy `@validates` and explicit domain restrictions (e.g., `ACCREDITATION_SCOPES`, `FEE_CATEGORY_VALUES`).

---

## 4. Analysis of Database Integrity safeguards ([integrity.py](file:///C:/AI_AGENT/college-decision-system-backend/app/infrastructure/db/integrity.py))

* **File Purpose**: Provides diagnostic scripts and metadata-level SQL queries to verify database consistency, index presence, and schema drift.
* **Dependencies**:
  - `sqlalchemy` (`inspect`, `text`, `Engine`, `Session`)
  - `app.infrastructure.db.session` (`Base`)
* **Inputs**: Active database connections and sessions.
* **Outputs**: Diagnostic dict logs of orphans, duplicates, mapping gaps, index status, and schema drift.
* **Internal Logic**:
  - Defines `INTEGRITY_COUNT_QUERIES`: Raw SQL queries running left-joins to detect orphan records (e.g., programs missing college, career paths missing program, fee amounts missing fee item).
  - Defines `DUPLICATE_COUNT_QUERIES`: SQL grouping queries to count duplicate keys (e.g., duplicate program names in the same college, duplicate fee categories per rule).
  - Defines `MAPPING_GAP_QUERIES`: Identifies unlinked raw fee college IDs, unlinked raw fee program names, rules missing categories (< 3 categories), and mismatching program/college assignments.
  - Defines `collect_decision_schema_drift()`: Compares database inspector table metadata against SQLAlchemy ORM model definitions to find missing tables, missing/extra columns, and missing runtime indexes.
* **Business Logic**: Standardized schema verification and audit logic to identify quality gaps in raw/ingested data.
* **Decision Logic**: None.
* **Observations**: This is a critical quality control module used by ingestion scripts and admin dashboards to ensure data completeness before run-time decisions are served.

---

## 5. Analysis of Repository Layer (`app/infrastructure/db/repositories/`)

* **File Purpose**: Data access objects encapsulating query logic for colleges, programs, chat logs, and complex fee resolutions.
* **Dependencies**:
  - `sqlalchemy.orm` (`Session`, `joinedload`, `selectinload`)
  - `difflib` (`SequenceMatcher`), `re`, `unicodedata`
  - `app.infrastructure.db.models.*`
* **Inputs**: Query variables (IDs, strings, percentages, tracks, groups).
* **Outputs**: Mapped database models, structured matching results (`EffectiveFeeResult`, `FeeCategoryResolution`).
* **Internal Logic**:
  - **[chat_repo.py](file:///C:/AI_AGENT/college-decision-system-backend/app/infrastructure/db/repositories/chat_repo.py)**:
    - Fetches recent messages descending by time, then reverses them to preserve chronological ordering for the LLM history.
  - **[decision_college_repo.py](file:///C:/AI_AGENT/college-decision-system-backend/app/infrastructure/db/repositories/decision_college_repo.py)**:
    - Basic query methods. `get_with_training_and_admission` performs deep joins on level profiles, training, and admissions.
  - **[decision_program_repo.py](file:///C:/AI_AGENT/college-decision-system-backend/app/infrastructure/db/repositories/decision_program_repo.py)**:
    - `search_candidates`: Employs dynamic queries to filter program offerings. Can match against tokenized patterns of `program_name`, `program_family`, `summary`, `differentiation_notes`, and `college_name` combined with location/branch filters.
  - **[decision_fee_repo.py](file:///C:/AI_AGENT/college-decision-system-backend/app/infrastructure/db/repositories/decision_fee_repo.py)**:
    - Extremely sophisticated text normalization, matching, and rule resolution engine.
    - `normalize_lookup_text`: Translates characters to ASCII, removes punctuation/parentheticals, and maps common synonyms (e.g., "pharm d" -> "doctor of pharmacy").
    - `raw_aliases_for_decision_college`: Matches raw ingestion text (like `CET_ABUKIR`) to standard college IDs (`ENGINEERING_AND_TECHNOLOGY`).
    - `score_fee_program_match`: Splits program names, computes intersection over union (IoU) of tokens, awards a `subset_bonus` (0.12) if one is a subset of the other, and blends it with `SequenceMatcher.ratio()`. Returns a matching score [0, 1].
    - `resolve_fee_category_for_student`: Resolves the fee category rule based on certificate type, student group, and college. Finds which category threshold rule (min/max percentage range) the student's high school percentage falls into.
    - `get_effective_fee_for_program`: Performs a ranked selection of candidate fee items:
      1. Tries direct program matches (`source_scope` = "program_direct").
      2. Tries inferred program matches using the fuzzy string score (threshold >= 0.88). Warns if matches are ambiguous.
      3. Falls back to conservative college-level default items (`source_scope` = "college_fallback").
      - Computes tuition amounts and aggregates recurring/one-time additional fees.
* **Business Logic**: Realizes student-group fee tier resolution (supportive vs other states) and scholarship-like category rules (A, B, C categories based on score cutoffs).
* **Decision Logic**:
  - Fuzzy threshold for program matching: `score >= 0.88`.
  - Tie-breaking: If two program candidates are within `0.03` matching score, they are declared ambiguous and skipped, reverting to college fallback.
  - Fallback average calculation: Computes branch-level or college-level average tuition if no matches are found.
* **Observations**: This repository implements most of the custom lookup and validation logic directly, making it the transactional core of the fee system.

---

## 6. Analysis of Core Decision and Scoring Use Cases ([recommend_programs.py](file:///C:/AI_AGENT/college-decision-system-backend/app/application/use_cases/recommend_programs.py))

* **File Purpose**: Orchestrates the program recommendation workflow. Evaluates student requirements, applies hard rules (gatekeeper filters), computes weighted scoring, calculates missing data penalties, maps confidence levels, and formats response explanations.
* **Dependencies**:
  - `json`, `re`, `unicodedata`
  - `thefuzz` (`process`)
  - `app.application.services.*` (`DecisionNumericNormalizer`, `FeeCategoryResolver`, `TrainingIntensityDeriver`, `TuitionCalculator`, `InterestExpansionService`)
  - `app.infrastructure.db.repositories.*`
* **Inputs**: `RecommendProgramsRequest` containing `certificate_type`, `high_school_percentage`, `student_group`, `budget`, `preferred_branch`, `preferred_city`, `interests`, `track_type`, `max_results`, `min_results`.
* **Outputs**: `RecommendProgramsResult` containing `total_candidates_considered`, `recommendations` list, and `excluded_programs` list.
* **Internal Logic**:
  - **Candidate Selection & Constraint Relaxation**:
    - Executes an initial strict query on `program_repository.search_candidates` filtering by preferred city and branch.
    - If the number of candidates is less than `min_results`, the geographical constraints are dropped (relaxed) to avoid empty results.
  - **Gatekeeper Hard Filters**:
    1. **Min Percentage Cut-off**: If `student.high_school_percentage` < `program.min_percentage`, the candidate is excluded.
    2. **Allowed Tracks validation**: Program tracks (e.g. Science, Math, Literature) are checked. A fuzzy match (via `thefuzz.process.extractOne` with threshold 80) is run between the request `track_type` and the program's [allowed_tracks](file:///C:/AI_AGENT/college-decision-system-backend/app/infrastructure/db/models/decision_program.py#L51) (deserialized from a JSON list in the database). If it fails, the candidate is excluded.
    3. **Track-based Compatibility Restrictions** ([_is_track_compatible](file:///C:/AI_AGENT/college-decision-system-backend/app/application/use_cases/recommend_programs.py#L1204)):
       - If certificate type is Egyptian (Thanaweya Amma):
         - **Science Track (علوم)**: Blocked from joining any program in an Engineering college (contains "engineering" or "cet_" in college ID/name).
         - **Math Track (رياضة)**: Blocked from joining Medical colleges (Pharmacy/Medicine/Dentistry, i.e., contains "pharmacy", "pharm_", "dentistry", "dent_", "medicine", "med_").
         - **Literature Track (أدبي)**:
           - Blocked from forbidden program families: `AI_FAMILY`, `CS_FAMILY`, `CYBERSEC_FAMILY`, `DATA_FAMILY`, `IS_FAMILY`, `SOFTWARE_FAMILY`, `ENGINEERING_FAMILY`, `HEALTHCARE_FAMILY`.
           - Blocked from forbidden colleges: `ccit`, `cet`, `pharm`, `dent`, `med`, `cai` in ID or name.
           - Blocked from forbidden program keywords: "artificial intelligence", "intelligent systems", "computer science", "cybersecurity", "software engineering", "engineering", "medicine", "pharmacy", "dentistry".
  - **Interest Alignment Score**:
    - Calls [InterestExpansionService](file:///C:/AI_AGENT/college-decision-system-backend/app/application/services/interest_expansion_service.py#L7) to resolve interests.
    - Matches interests against searchable text (program name, family, summary, traits, career roles).
    - Checks profile-based interest fields. If the candidate matches only on profile fields but not in text, the score is capped by `PROFILE_ONLY_CAPS` (e.g. 0.35 for engineering).
    - If the final interest score is `< 0.5`, the program is discarded.
  - **Scoring Formulas**:
    - **Raw Weighted Score**:
      $$Score_{weighted} = (Score_{interest} \times 0.60) + (Score_{affordability} \times 0.20) + (Score_{employment} \times 0.10) + (Score_{location} \times 0.05) + (Score_{flexibility} \times 0.025) + (Score_{admission} \times 0.025)$$
    - **Missing Data Penalty** ($P_{missing}$):
      - Base penalty contributions:
        - No program profile: +0.05
        - No training data: +0.10
        - No employment data: +0.05
        - No admission data: +0.05
        - Tuition unavailable: +0.30
        - Branch fallback: +0.15
        - College fallback or used college fallback: +0.05
        - Fee data incomplete: +0.10
      - Age dampener: If the program was created in the last 30 days, the penalty is halved ($P_{missing} = P_{missing} \times 0.5$).
    - **Final Score**:
      $$Score_{final} = \max(0.0, Score_{weighted} - P_{missing}) \times 100$$
  - **Response Breakdown Mismatch (Code Drift)**:
    - The actual final score is calculated using weights `0.60, 0.20, 0.10, 0.05, 0.025, 0.025`.
    - However, the [_build_score_breakdown](file:///C:/AI_AGENT/college-decision-system-backend/app/application/use_cases/recommend_programs.py#L1035) method returns visual contributions using a different set of weights:
      - Interest Alignment Contribution = `interest_score * 0.32`
      - Affordability Contribution = `affordability_score * 0.28`
      - Employment Outlook Contribution = `employment_score * 0.20`
      - Location Preference Contribution = `location_score * 0.10`
      - Career Flexibility Contribution = `flexibility_score * 0.05`
      - Certificate Compatibility Contribution = `admission_score * 0.05`
      - Total sum of contributions = `0.32 + 0.28 + 0.20 + 0.10 + 0.05 + 0.05 = 1.00`.
      - *This represents an architectural inconsistency between the mathematical ranking score and the breakdown displayed to clients.*
  - **Confidence Level Mapping**:
    - High confidence: $P_{missing} == 0.0$
    - Medium confidence: $0.0 < P_{missing} \le 0.15$
    - Low confidence: $P_{missing} > 0.15$
  - **Match Type Categorization**:
    - `Exact`: Budget is affordable or unknown, location is matched strictly, and budget is not a stretch.
    - `Stretch`: Budget status is "stretch" (i.e. tuition is between budget and 1.15 * budget).
    - `Partial`: Stated location preference was missed (due to location constraint relaxation).
    - `Alternative`: Budget status is not affordable.
* **Business Logic**: Implements the official AAST admission gates, curriculum constraints, and affordability checks.
* **Decision Logic**: Contains the primary scoring weights and gatekeepers.

---

## 7. Analysis of Ingestion, Normalization and Helper Services (`app/application/services/`)

* **File Purpose**: Provides backend services for interest expansion, fee category resolution, speech-to-text integration, tuition calculation, and data ingestion.
* **Dependencies**:
  - `thefuzz`, `google-generativeai`, `imageio_ffmpeg`, `openai-whisper`
  - `app.infrastructure.db.models.*`, `app.infrastructure.db.repositories.*`
* **Internal Logic**:
  - **[interest_expansion_service.py](file:///C:/AI_AGENT/college-decision-system-backend/app/application/services/interest_expansion_service.py)**:
    - Maps user interest words to 10 canonical groups (`ai`, `business`, `engineering`, `cybersecurity`, `software`, `healthcare`, `design`, `law`, `language`, `logistics`).
    - Synonyms are expanded using `SEARCH_ALIASES`.
    - `canonicalize` checks exact alias mappings, then token subsets, and falls back to fuzzy matching (token sort ratio threshold 75).
    - Multi-word matching is evaluated using `fuzz.partial_ratio` (threshold 85).
  - **[fee_category_resolver.py](file:///C:/AI_AGENT/college-decision-system-backend/app/application/services/fee_category_resolver.py)**:
    - Resolves a student's high school percentage into a fee category tier (A, B, or C).
    - Normalizes `certificate_type` into `egyptian_secondary_or_nile_or_stem_or_azhar` or `equivalent_certificates`.
    - Fallback: If no category rule is matched, it computes average college-level or branch-level fees as fallbacks.
  - **[tuition_calculator.py](file:///C:/AI_AGENT/college-decision-system-backend/app/application/services/tuition_calculator.py)**:
    - Pulls effective tuition from the repository. Calculates total recurring costs and maps one-time or unknown frequency fees.
  - **[training_intensity_deriver.py](file:///C:/AI_AGENT/college-decision-system-backend/app/application/services/training_intensity_deriver.py)**:
    - Gathers 5 signals: program's `lab_intensity` and `field_work_intensity` (from profile), plus college's `mandatory_training`, `industry_training`, and `field_or_sea_training` (boolean flags converted to 10 if True, else 0).
    - Imputes missing signals with a neutral score of `5.0`.
    - Returns the arithmetic average of the 5 signals. Ranges: `< 3.5` -> low, `< 6.5` -> medium, else high.
  - **[speech_service.py](file:///C:/AI_AGENT/college-decision-system-backend/app/application/services/speech_service.py)**:
    - Converts uploaded audio files to `16kHz`, mono `WAV` via `imageio_ffmpeg` executable.
    - Feeds WAV file to a lazy-loaded `whisper` model on the host CPU/GPU.
    - Feeds transcription to Gemini (`gemini-2.5-flash`) for intent classification (`greeting`, `data_entry`, `irrelevant`) and profile extraction. If Gemini is disabled, it runs a local regex-based deterministic parser.
  - **[agent_service.py](file:///C:/AI_AGENT/college-decision-system-backend/app/application/services/agent_service.py)**:
    - Conversational wrapper around Gemini. Incorporates `get_recommendations` tool calling.
    - Implements conversation history context mapping.
    - Prepares summary responses for the LLM to humanize.

---

## 8. Analysis of API Router Endpoints and Controllers (`app/api/v1/routers/`)

* **File Purpose**: FastAPI endpoints routing student evaluations, admin panel updates, chat messages, recommendations, and voice inputs.
* **Dependencies**:
  - `fastapi` (`APIRouter`, `UploadFile`, `File`, `Depends`)
  - `app.api.v1.dependencies.security` (`verify_internal_secret`)
  - `app.api.v1.schemas.*`
* **API endpoints**:
  1. **`POST /api/v1/students/evaluate`**: Utility endpoint that validates student payload structure and echoes it back.
  2. **`POST /api/v1/decisions/recommend`**: Primary recommendation endpoint.
     - Protected by [verify_internal_secret](file:///C:/AI_AGENT/college-decision-system-backend/app/api/v1/dependencies/security.py#L5) dependency (requires header `X-Internal-Secret` matching environment `INTERNAL_SECRET_KEY` unless running in testing/delivery checks environments).
     - Resolves recommendations via [RecommendProgramsUseCase](file:///C:/AI_AGENT/college-decision-system-backend/app/application/use_cases/recommend_programs.py#L157).
     - Supports two request schemas: `RecommendProgramsRequestSchema` (standard frontend recommendation form) or `AgentRecommendRequestSchema` (structured query for the orchestrator AI agent).
  3. **`POST /api/v1/chat/message`**: Conversational chat gateway. Feeds chat query to [AgentService](file:///C:/AI_AGENT/college-decision-system-backend/app/application/services/agent_service.py#L23) and returns conversational replies alongside structured recommendation models.
  4. **`GET /api/v1/voice/voice-health`**: Checks speech engine status (Whisper loading time, CPU device, count of transcriptions).
  5. **`POST /api/v1/voice/voice-entry`**: Accepts audio uploads (max size `VOICE_MAX_UPLOAD_MB`). Transcribes audio, extracts profile parameters, and returns recommendations.
  6. **`GET /api/v1/admin/programs`**: Lists all ingested programs with min percentage score, fees, and tracks.
  7. **`PUT /api/v1/admin/programs/{program_id}`**: Administrative endpoint to update a program's requirements.
