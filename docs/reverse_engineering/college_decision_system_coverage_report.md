# College Decision System Backend — Phase 4 Coverage Report

This document reports the file-by-file audit coverage status for the **College Decision System Backend** (`college-decision-system-backend`) FastAPI subsystem.

---

## 1. Discovered Python Files Accounting Matrix

The following table accounts for every single Python file discovered in the repository, ensuring zero-hallucination audits.

| # | File Path | Lines | Status | Reason for Skip | Document Reference |
| :--- | :--- | :---: | :---: | :--- | :--- |
| 1 | `audit_db.py` | 32 | **Complete** | - | [08h_utilities_audit.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08h_utilities_audit.md) |
| 2 | `audit_repair_v2.py` | 1054 | **Complete** | - | [08h_utilities_audit.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08h_utilities_audit.md) |
| 3 | `check_db_debug.py` | 52 | **Complete** | - | [08h_utilities_audit.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08h_utilities_audit.md) |
| 4 | `explore_and_fix.py` | 74 | **Complete** | - | [08h_utilities_audit.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08h_utilities_audit.md) |
| 5 | `find_alamein.py` | 23 | **Complete** | - | [08h_utilities_audit.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08h_utilities_audit.md) |
| 6 | `force_fix_fees.py` | 76 | **Complete** | - | [08h_utilities_audit.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08h_utilities_audit.md) |
| 7 | `inspect_recs.py` | 28 | **Complete** | - | [08h_utilities_audit.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08h_utilities_audit.md) |
| 8 | `list_tables.py` | 14 | **Complete** | - | [08h_utilities_audit.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08h_utilities_audit.md) |
| 9 | `manage.py` | 68 | **Complete** | - | [08h_utilities_audit.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08h_utilities_audit.md) |
| 10 | `normalize_colleges_v2.py` | 898 | **Complete** | - | [08h_utilities_audit.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08h_utilities_audit.md) |
| 11 | `repair_batch_colleges_set2.py` | 475 | **Complete** | - | [08h_utilities_audit.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08h_utilities_audit.md) |
| 12 | `repair_engineering_colleges_v2.py` | 746 | **Complete** | - | [08h_utilities_audit.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08h_utilities_audit.md) |
| 13 | `repair_logistics_batch_only.py` | 414 | **Complete** | - | [08h_utilities_audit.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08h_utilities_audit.md) |
| 14 | `search_cai.py` | 20 | **Complete** | - | [08h_utilities_audit.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08h_utilities_audit.md) |
| 15 | `test_intent_greeting.py` | 41 | **Complete** | - | [08h_utilities_audit.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08h_utilities_audit.md) |
| 16 | `test_voice_endpoint.py` | 36 | **Complete** | - | [08h_utilities_audit.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08h_utilities_audit.md) |
| 17 | `test_webm_endpoint.py` | 50 | **Complete** | - | [08h_utilities_audit.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08h_utilities_audit.md) |
| 18 | `upgrade_normalized_v2.py` | 1079 | **Complete** | - | [08h_utilities_audit.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08h_utilities_audit.md) |
| 19 | `alembic/env.py` | 86 | **Complete** | - | [08g_migrations_audit.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08g_migrations_audit.md) |
| 20 | `alembic/versions/1c26e9f9d3c2_add_chat_messages_table.py` | 52 | **Complete** | - | [08g_migrations_audit.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08g_migrations_audit.md) |
| 21 | `alembic/versions/377dbfa7c09e_add_students_table.py` | 40 | **Complete** | - | [08g_migrations_audit.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08g_migrations_audit.md) |
| 22 | `alembic/versions/3d6b8e491c76_initial_schema.py` | 84 | **Complete** | - | [08g_migrations_audit.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08g_migrations_audit.md) |
| 23 | `alembic/versions/41d5ba5c5a79_add_min_percentage_and_allowed_tracks_.py` | 32 | **Complete** | - | [08g_migrations_audit.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08g_migrations_audit.md) |
| 24 | `alembic/versions/4a4dbd1d4c6c_add_program_fees.py` | 29 | **Complete** | - | [08g_migrations_audit.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08g_migrations_audit.md) |
| 25 | `alembic/versions/9c8a6d1f4b2a_add_decision_dataset_schema.py` | 454 | **Complete** | - | [08g_migrations_audit.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08g_migrations_audit.md) |
| 26 | `alembic/versions/c1e7a9d42f51_add_decision_fee_schema.py` | 344 | **Complete** | - | [08g_migrations_audit.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08g_migrations_audit.md) |
| 27 | `alembic/versions/e6f3d9a8b1c2_add_runtime_integrity_indexes.py` | 43 | **Complete** | - | [08g_migrations_audit.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08g_migrations_audit.md) |
| 28 | `alembic/versions/f4c2d7e9b3a1_drop_legacy_mvp_tables.py` | 98 | **Complete** | - | [08g_migrations_audit.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08g_migrations_audit.md) |
| 29 | `app/main.py` | 51 | **Complete** | - | [08_decision_engine.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08_decision_engine.md) |
| 30 | `app/api/__init__.py` | 0 | **Complete** | Namespace container | [08e_api_contracts.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08e_api_contracts.md) |
| 31 | `app/api/v1/__init__.py` | 0 | **Complete** | Namespace container | [08e_api_contracts.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08e_api_contracts.md) |
| 32 | `app/api/v1/dependencies/security.py` | 16 | **Complete** | - | [08e_api_contracts.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08e_api_contracts.md) |
| 33 | `app/api/v1/routers/admin.py` | 45 | **Complete** | - | [08e_api_contracts.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08e_api_contracts.md) |
| 34 | `app/api/v1/routers/chat.py` | 58 | **Complete** | - | [08e_api_contracts.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08e_api_contracts.md) |
| 35 | `app/api/v1/routers/decisions.py` | 120 | **Complete** | - | [08e_api_contracts.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08e_api_contracts.md) |
| 36 | `app/api/v1/routers/students.py` | 27 | **Complete** | - | [08e_api_contracts.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08e_api_contracts.md) |
| 37 | `app/api/v1/routers/voice.py` | 241 | **Complete** | - | [08e_api_contracts.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08e_api_contracts.md) |
| 38 | `app/api/v1/routers/__init__.py` | 0 | **Complete** | Namespace container | [08e_api_contracts.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08e_api_contracts.md) |
| 39 | `app/api/v1/schemas/agent_decision.py` | 52 | **Complete** | - | [08f_validation_layer.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08f_validation_layer.md) |
| 40 | `app/api/v1/schemas/chat.py` | 14 | **Complete** | - | [08f_validation_layer.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08f_validation_layer.md) |
| 41 | `app/api/v1/schemas/decision.py` | 436 | **Complete** | - | [08f_validation_layer.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08f_validation_layer.md) |
| 42 | `app/api/v1/schemas/normalization.py` | 182 | **Complete** | - | [08f_validation_layer.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08f_validation_layer.md) |
| 43 | `app/api/v1/schemas/student.py` | 35 | **Complete** | - | [08f_validation_layer.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08f_validation_layer.md) |
| 44 | `app/api/v1/schemas/__init__.py` | 0 | **Complete** | Namespace container | [08f_validation_layer.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08f_validation_layer.md) |
| 45 | `app/application/__init__.py` | 0 | **Complete** | Namespace container | [08_decision_engine.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08_decision_engine.md) |
| 46 | `app/application/dto/decision_dto.py` | 0 | **Complete** | Unused boilerplate | [08a_domain_model.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08a_domain_model.md) |
| 47 | `app/application/dto/student_dto.py` | 0 | **Complete** | Unused boilerplate | [08a_domain_model.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08a_domain_model.md) |
| 48 | `app/application/dto/__init__.py` | 0 | **Complete** | Namespace container | [08a_domain_model.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08a_domain_model.md) |
| 49 | `app/application/ports/__init__.py` | 0 | **Complete** | Namespace container | [08_decision_engine.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08_decision_engine.md) |
| 50 | `app/application/services/agent_service.py` | 385 | **Complete** | - | [08c_recommendation_pipeline.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08c_recommendation_pipeline.md) |
| 51 | `app/application/services/decision_numeric_normalizer.py` | 54 | **Complete** | - | [08b_business_rules.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08b_business_rules.md) |
| 52 | `app/application/services/fee_category_resolver.py` | 287 | **Complete** | - | [08b_business_rules.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08b_business_rules.md) |
| 53 | `app/application/services/ingestion_service.py` | 203 | **Complete** | - | [08b_business_rules.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08b_business_rules.md) |
| 54 | `app/application/services/interest_expansion_service.py` | 135 | **Complete** | - | [08c_recommendation_pipeline.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08c_recommendation_pipeline.md) |
| 55 | `app/application/services/speech_service.py` | 244 | **Complete** | - | [08b_business_rules.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08b_business_rules.md) |
| 56 | `app/application/services/training_intensity_deriver.py` | 123 | **Complete** | - | [08b_business_rules.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08b_business_rules.md) |
| 57 | `app/application/services/tuition_calculator.py` | 277 | **Complete** | - | [08b_business_rules.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08b_business_rules.md) |
| 58 | `app/application/services/__init__.py` | 12 | **Complete** | - | [08b_business_rules.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08b_business_rules.md) |
| 59 | `app/application/use_cases/recommend_programs.py` | 1251 | **Complete** | - | [08c_recommendation_pipeline.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08c_recommendation_pipeline.md) |
| 60 | `app/application/use_cases/__init__.py` | 0 | **Complete** | Namespace container | [08c_recommendation_pipeline.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08c_recommendation_pipeline.md) |
| 61 | `app/config/settings.py` | 52 | **Complete** | - | [08_decision_engine.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08_decision_engine.md) |
| 62 | `app/config/__init__.py` | 0 | **Complete** | Namespace container | [08_decision_engine.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08_decision_engine.md) |
| 63 | `app/core/constants.py` | 0 | **Complete** | Placeholder | [08_decision_engine.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08_decision_engine.md) |
| 64 | `app/core/logging.py` | 0 | **Complete** | Placeholder | [08_decision_engine.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08_decision_engine.md) |
| 65 | `app/core/__init__.py` | 0 | **Complete** | Namespace container | [08_decision_engine.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08_decision_engine.md) |
| 66 | `app/domain/__init__.py` | 0 | **Complete** | Namespace container | [08a_domain_model.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08a_domain_model.md) |
| 67 | `app/domain/entities/decision_schema.py` | 104 | **Complete** | - | [08d_database_schema.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08d_database_schema.md) |
| 68 | `app/domain/entities/__init__.py` | 0 | **Complete** | Namespace container | [08d_database_schema.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08d_database_schema.md) |
| 69 | `app/domain/risks/__init__.py` | 0 | **Complete** | Namespace container | [08c_recommendation_pipeline.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08c_recommendation_pipeline.md) |
| 70 | `app/domain/rules/__init__.py` | 0 | **Complete** | Namespace container | [08b_business_rules.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08b_business_rules.md) |
| 71 | `app/domain/scoring/__init__.py` | 0 | **Complete** | Namespace container | [08c_recommendation_pipeline.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08c_recommendation_pipeline.md) |
| 72 | `app/domain/value_objects/distance.py` | 0 | **Complete** | Placeholder | [08a_domain_model.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08a_domain_model.md) |
| 73 | `app/domain/value_objects/fee_category.py` | 0 | **Complete** | Placeholder | [08a_domain_model.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08a_domain_model.md) |
| 74 | `app/domain/value_objects/score.py` | 0 | **Complete** | Placeholder | [08a_domain_model.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08a_domain_model.md) |
| 75 | `app/domain/value_objects/__init__.py` | 0 | **Complete** | Namespace container | [08a_domain_model.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08a_domain_model.md) |
| 76 | `app/infrastructure/__init__.py` | 0 | **Complete** | Namespace container | [08d_database_schema.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08d_database_schema.md) |
| 77 | `app/infrastructure/ai/__init__.py` | 0 | **Complete** | Namespace container | [08c_recommendation_pipeline.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08c_recommendation_pipeline.md) |
| 78 | `app/infrastructure/db/integrity.py` | 431 | **Complete** | - | [08d_database_schema.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08d_database_schema.md) |
| 79 | `app/infrastructure/db/session.py` | 41 | **Complete** | - | [08_decision_engine.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08_decision_engine.md) |
| 80 | `app/infrastructure/db/__init__.py` | 0 | **Complete** | Namespace container | [08d_database_schema.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08d_database_schema.md) |
| 81 | `app/infrastructure/db/models/chat_message.py` | 16 | **Complete** | - | [08a_domain_model.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08a_domain_model.md) |
| 82 | `app/infrastructure/db/models/decision_college.py` | 443 | **Complete** | - | [08a_domain_model.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08a_domain_model.md) |
| 83 | `app/infrastructure/db/models/decision_common.py` | 70 | **Complete** | - | [08a_domain_model.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08a_domain_model.md) |
| 84 | `app/infrastructure/db/models/decision_fee.py` | 283 | **Complete** | - | [08a_domain_model.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08a_domain_model.md) |
| 85 | `app/infrastructure/db/models/decision_program.py` | 239 | **Complete** | - | [08a_domain_model.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08a_domain_model.md) |
| 86 | `app/infrastructure/db/models/decision_scholarship.py` | 54 | **Complete** | - | [08a_domain_model.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08a_domain_model.md) |
| 87 | `app/infrastructure/db/models/__init__.py` | 67 | **Complete** | - | [08a_domain_model.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08a_domain_model.md) |
| 88 | `app/infrastructure/db/repositories/chat_repo.py` | 40 | **Complete** | - | [08d_database_schema.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08d_database_schema.md) |
| 89 | `app/infrastructure/db/repositories/decision_college_repo.py` | 63 | **Complete** | - | [08d_database_schema.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08d_database_schema.md) |
| 90 | `app/infrastructure/db/repositories/decision_fee_repo.py` | 1021 | **Complete** | - | [08d_database_schema.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08d_database_schema.md) |
| 91 | `app/infrastructure/db/repositories/decision_program_repo.py` | 152 | **Complete** | - | [08d_database_schema.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08d_database_schema.md) |
| 92 | `app/infrastructure/db/repositories/__init__.py` | 9 | **Complete** | - | [08d_database_schema.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08d_database_schema.md) |
| 93 | `app/schema/decision_schema.py` | 27 | **Complete** | - | [08d_database_schema.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08d_database_schema.md) |
| 94 | `app/schema/load_decision_schema.py` | 17 | **Complete** | - | [08d_database_schema.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08d_database_schema.md) |
| 95 | `app/schema/normalize_colleges.py` | 1036 | **Complete** | - | [08d_database_schema.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08d_database_schema.md) |
| 96 | `app/schema/__init__.py` | 4 | **Complete** | - | [08d_database_schema.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08d_database_schema.md) |
| 97 | `scripts/audit_decision_db_integrity.py` | 83 | **Complete** | - | [08h_utilities_audit.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08h_utilities_audit.md) |
| 98 | `scripts/ingest_fees_json.py` | 722 | **Complete** | - | [08h_utilities_audit.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08h_utilities_audit.md) |
| 99 | `scripts/ingest_normalized_colleges_v2.py` | 1304 | **Complete** | - | [08h_utilities_audit.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08h_utilities_audit.md) |
| 100 | `scripts/normalize_colleges.py` | 98 | **Complete** | - | [08h_utilities_audit.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08h_utilities_audit.md) |
| 101 | `scripts/run_delivery_checks.py` | 108 | **Complete** | - | [08h_utilities_audit.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08h_utilities_audit.md) |
| 102 | `scripts/__init__.py` | 1 | **Complete** | - | [08h_utilities_audit.md](file:///c:/Users/mh978/Downloads/AI_AGENT/docs/reverse_engineering/08h_utilities_audit.md) |
| 103 | `tests/run_tests.py` | 3 | **Skipped** | Local test runner helper. | - |
| 104 | `tests/run_tests_all.py` | 4 | **Skipped** | Complete local test suite runner. | - |
| 105 | `tests/test_database_integrity.py` | 269 | **Skipped** | Database integrity test assertions. | - |
| 106 | `tests/test_db_integrity_enforcement.py` | 31 | **Skipped** | DB enforcement test assertions. | - |
| 107 | `tests/test_decision_data_completeness.py` | 499 | **Skipped** | Pipeline completeness test assertions. | - |
| 108 | `tests/test_etl_ingestion.py` | 67 | **Skipped** | Ingest test assertions. | - |
| 109 | `tests/test_fee_system_hardening.py` | 535 | **Skipped** | Fee calculation test assertions. | - |
| 110 | `tests/test_normalization_smoke.py` | 33 | **Skipped** | Smoke validation test assertions. | - |
| 111 | `tests/test_recommendation_endpoint.py` | 161 | **Skipped** | API routing integration test assertions. | - |
| 112 | `tests/test_system_health.py` | 158 | **Skipped** | App health check endpoint test assertions. | - |
| 113 | `tests/__init__.py` | 0 | **Skipped** | Tests package placeholder. | - |

---

## 2. Summary Accounting Metrics

* **Python Files Discovered**: 113
* **Python Files Audited**: 102
* **Python Files Skipped**: 11
* **Coverage Percentage (by File Count)**: **90.27%** (102 Audited Files / 113 Total Files)
* **Required Audit Scope Coverage**: **100.00%** (102 Audited Files / 102 Required Files)
* **Coverage Percentage (by Lines of Code)**: **90.71%** (17,175 Audited Lines / 18,935 Total Lines)
* **Required Audit Scope Lines Coverage**: **100.00%** (17,175 Audited Lines / 17,175 Required Lines)

---

## 3. Skipped Files Catalog

The following 11 files (Group E: Tests) are excluded from detailed code analysis:

```
tests/run_tests.py
tests/run_tests_all.py
tests/test_database_integrity.py
tests/test_db_integrity_enforcement.py
tests/test_decision_data_completeness.py
tests/test_etl_ingestion.py
tests/test_fee_system_hardening.py
tests/test_normalization_smoke.py
tests/test_recommendation_endpoint.py
tests/test_system_health.py
tests/__init__.py
```
