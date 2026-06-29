# Final Project Structure
**Authoritative Folder Layout Post-Reorganization**

This document illustrates the complete, clean directory structure of the repository following the successful execution of the safe cleanup operations.

```text
AI_AGENT/
├── .env.docker.example
├── .gitignore
├── ARCHITECTURE_BASELINE.md
├── DEPENDENCY_CHANGE_REPORT.md
├── DOCUMENTATION_MIGRATION_SUMMARY.md
├── EMPTY_DIRECTORY_REPORT.md
├── EXECUTION_AUDIT_REPORT.md
├── FINAL_EXECUTION_AUDIT.md
├── FINAL_EXECUTION_PLAN.md
├── FINAL_PROJECT_STRUCTURE.md
├── FINAL_REORGANIZATION_AUDIT.md
├── FRONTEND_BUILD_EVIDENCE.md
├── GIT_CHANGE_REPORT.md
├── INFRASTRUCTURE_RUNTIME_DEPENDENCY_REPORT.md
├── MOVED_FILE_VERIFICATION.md
├── POST_EXECUTION_VALIDATION.md
├── REPOSITORY_RECOVERY_PLAN.md
├── SYSTEM_CONTEXT_MAP.md
├── SYSTEM_CONTEXT_MAP_V2.md
├── TARGET_ARCHITECTURE_V2.md
├── TARGET_ARCHITECTURE_V3.md
├── aast-ai-agent-main/
│   ├── .gitignore
│   ├── backend/
│   │   ├── .dockerignore
│   │   ├── .env
│   │   ├── .env.example
│   │   ├── Dockerfile
│   │   ├── README.md
│   │   ├── config/
│   │   ├── data/
│   │   ├── db/
│   │   ├── docs/
│   │   ├── embed_nodes.py
│   │   ├── faqService.js
│   │   ├── fix_db.js
│   │   ├── greetings.js
│   │   ├── index.js
│   │   ├── knowledgeGraphService.js
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── monitoring/
│   │   ├── orchestrator.js
│   │   ├── package-lock.json
│   │   ├── package.json
│   │   ├── rag_system/
│   │   ├── routes/
│   │   ├── run_commands.txt
│   │   ├── schema.js
│   │   ├── services/
│   │   ├── testing/
│   │   └── tests/
│   ├── frontend/
│   │   ├── .dockerignore
│   │   ├── .env
│   │   ├── .gitignore
│   │   ├── Dockerfile
│   │   ├── README.md
│   │   ├── aast-ai-agent-main/
│   │   │   ├── backend/
│   │   │   │   ├── data/
│   │   │   │   ├── db/
│   │   │   │   ├── middleware/
│   │   │   │   ├── models/
│   │   │   │   ├── routes/
│   │   │   │   ├── services/
│   │   │   │   └── tests/
│   │   │   └── frontend-test/
│   │   │       └── src/
│   │   ├── college-decision-system-backend/
│   │   │   ├── alembic/
│   │   │   │   └── versions/
│   │   │   ├── app/
│   │   │   │   ├── api/
│   │   │   │   │   └── v1/
│   │   │   │   ├── application/
│   │   │   │   │   ├── dto/
│   │   │   │   │   ├── ports/
│   │   │   │   │   ├── services/
│   │   │   │   │   └── use_cases/
│   │   │   │   ├── config/
│   │   │   │   ├── core/
│   │   │   │   ├── domain/
│   │   │   │   │   ├── entities/
│   │   │   │   │   ├── risks/
│   │   │   │   │   ├── rules/
│   │   │   │   │   ├── scoring/
│   │   │   │   │   └── value_objects/
│   │   │   │   ├── infrastructure/
│   │   │   │   │   ├── ai/
│   │   │   │   │   └── db/
│   │   │   │   └── schema/
│   │   │   ├── docs/
│   │   │   ├── schema/
│   │   │   ├── scripts/
│   │   │   └── tests/
│   │   ├── eslint.config.js
│   │   ├── frontend/
│   │   │   ├── public/
│   │   │   └── src/
│   │   │       ├── auth/
│   │   │       ├── components/
│   │   │       │   ├── layout/
│   │   │       │   └── pages/
│   │   │       └── services/
│   │   ├── index.html
│   │   ├── multimodal/
│   │   │   ├── pipeline/
│   │   │   ├── reasoning/
│   │   │   └── vision/
│   │   ├── nginx.conf
│   │   ├── package-lock.json
│   │   ├── package.json
│   │   ├── postcss.config.cjs
│   │   ├── public/
│   │   ├── src/
│   │   │   ├── auth/
│   │   │   ├── components/
│   │   │   │   ├── layout/
│   │   │   │   └── pages/
│   │   │   ├── decision/
│   │   │   │   ├── components/
│   │   │   │   ├── context/
│   │   │   │   ├── layouts/
│   │   │   │   └── pages/
│   │   │   └── services/
│   │   ├── tailwind.config.js
│   │   ├── tsconfig.app.json
│   │   ├── tsconfig.json
│   │   ├── tsconfig.node.json
│   │   └── vite.config.ts
│   ├── frontend-test/
│   │   ├── index.html
│   │   ├── package-lock.json
│   │   ├── package.json
│   │   └── src/
│   └── replace.js
├── archive/
│   └── multimodal/
│       ├── app.py
│       ├── pipeline/
│       ├── reasoning/
│       └── vision/
├── college-decision-system-backend/
│   ├── .dockerignore
│   ├── .env
│   ├── .env.example
│   ├── .gitignore
│   ├── Dockerfile
│   ├── alembic/
│   │   ├── README
│   │   ├── env.py
│   │   ├── script.py.mako
│   │   └── versions/
│   ├── alembic.ini
│   ├── app/
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── dependencies/
│   │   │       ├── routers/
│   │   │       └── schemas/
│   │   ├── application/
│   │   │   ├── dto/
│   │   │   ├── ports/
│   │   │   ├── services/
│   │   │   └── use_cases/
│   │   ├── config/
│   │   ├── core/
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   ├── risks/
│   │   │   ├── rules/
│   │   │   ├── scoring/
│   │   │   └── value_objects/
│   │   ├── infrastructure/
│   │   │   ├── ai/
│   │   │   └── db/
│   │   │       ├── models/
│   │   │       └── repositories/
│   │   ├── main.py
│   │   └── schema/
│   ├── audit_db.py
│   ├── audit_repair_v2.py
│   ├── check_db_debug.py
│   ├── dev.db
│   ├── dev.db.bak
│   ├── explore_and_fix.py
│   ├── ffmpeg.exe.linux
│   ├── find_alamein.py
│   ├── force_fix_fees.py
│   ├── list_tables.py
│   ├── manage.py
│   ├── normalize_colleges_v2.py
│   ├── pyproject.toml
│   ├── repair_batch_colleges_set2.py
│   ├── repair_engineering_colleges_v2.py
│   ├── repair_logistics_batch_only.py
│   ├── requirements.txt
│   ├── schema/
│   │   └── decision_schema_v1.json
│   ├── scripts/
│   │   ├── __init__.py
│   │   ├── audit_decision_db_integrity.py
│   │   ├── ingest_fees_json.py
│   │   ├── ingest_normalized_colleges_v2.py
│   │   ├── normalize_colleges.py
│   │   └── run_delivery_checks.py
│   ├── search_cai.py
│   ├── test_intent_greeting.py
│   ├── test_student.webm
│   ├── test_voice_endpoint.py
│   ├── test_webm_endpoint.py
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── run_tests.py
│   │   ├── run_tests_all.py
│   │   ├── test_database_integrity.py
│   │   ├── test_db_integrity_enforcement.py
│   │   ├── test_decision_data_completeness.py
│   │   ├── test_etl_ingestion.py
│   │   ├── test_fee_system_hardening.py
│   │   ├── test_normalization_smoke.py
│   │   ├── test_recommendation_endpoint.py
│   │   └── test_system_health.py
│   ├── tmp_malformed_test.db
│   └── upgrade_normalized_v2.py
├── data/
│   ├── datasets/
│   │   └── colleges/
│   ├── relationship/
│   │   ├── aast-advisor-graph-desktop.png
│   │   ├── analyze_clean.py
│   │   ├── analyze_graph.py
│   │   ├── analyze_relationship.py
│   │   ├── analyze_relationship2.py
│   │   ├── backup_pre_phase4b.json
│   │   ├── check_keys.py
│   │   ├── check_names.py
│   │   ├── dump_nodes.py
│   │   ├── neo4j_query_table_data_2026-4-22 (2).json
│   │   ├── phase4b_patch.py
│   │   ├── phase4b_patch_log.json
│   │   ├── relationship.json
│   │   ├── relationship_analysis.txt
│   │   ├── relationship_analysis_clean.txt
│   │   └── relationship_phase4b.json
│   └── scraping/
│       └── step8/
│           ├── aast_v2_output/
│           │   ├── api/
│           │   ├── files/
│           │   ├── html/
│           │   └── json/
│           ├── adv_scraping/
│           ├── adv_scraping - Copy/
│           ├── data_graduation/
│           ├── datasets/
│           │   └── normalized_v4_2_20251125_183247/
│           │       ├── structured_v1/
│           │       └── structured_v1_cleaned/
│           ├── datasets - Copy/
│           │   └── normalized_v4_2_20251125_183247/
│           │       ├── structured_v1/
│           │       └── structured_v1_cleaned/
│           ├── df/
│           │   └── final_dataset/
│           ├── df - Copy/
│           │   └── final_dataset/
│           ├── last version/
│           │   ├── aast_v5_output_20251129_220740/
│           │   │   ├── api/
│           │   │   ├── calls/
│           │   │   ├── files/
│           │   │   ├── html/
│           │   │   └── json/
│           │   └── dataset/
│           ├── last version - Copy/
│           │   ├── aast_v5_output_20251129_220740/
│           │   │   ├── api/
│           │   │   ├── calls/
│           │   │   ├── files/
│           │   │   ├── html/
│           │   │   └── json/
│           │   └── dataset/
│           ├── normalized_college_v2 - Copy/
│           ├── playwright_captures/
│           └── static_pages/
├── diagrams/
│   ├── AAST_AI_Agent_Architecture_Sequence_Diagrams.md
│   └── AAST_AI_Agent_Architecture_Sequence_Diagrams.pdf
├── docker-compose.yml
├── docs/
│   ├── api/
│   │   └── decision_examples.md
│   ├── architecture/
│   │   ├── 02_COMPONENT_SYSTEM_DESCRIPTION.md
│   │   ├── AAST_AGENT_SYSTEM_DOCS.md
│   │   ├── CONDENSED_RUNTIME_TRACE.md
│   │   ├── MASTER_PROJECT_BANK.md
│   │   ├── MASTER_TECHNICAL_DOCUMENTATION.md
│   │   ├── MASTER_TECHNICAL_DOCUMENTATION.pdf
│   │   └── VERIFIED_SYSTEM_MAP.md
│   ├── archive/
│   │   ├── 03_ARCHITECTURAL_DIAGRAMS_duplicate.md
│   │   ├── 04_PERFORMANCE_ANALYSIS_duplicate.md
│   │   ├── CONDENSED_RUNTIME_TRACE_duplicate.md
│   │   ├── MASTER_TECHNICAL_DOCUMENTATION_doc_duplicate.md
│   │   ├── MASTER_TECHNICAL_DOCUMENTATION_duplicate.md
│   │   ├── Sequence_Diagrams_duplicate.md
│   │   ├── VERIFIED_SYSTEM_MAP_duplicate.md
│   │   ├── cv.md
│   │   ├── cv.pdf
│   │   └── test_queries.txt
│   ├── deployment/
│   │   └── DOCKERIZATION.md
│   ├── development/
│   │   ├── INTERNAL_TEAM_DOCUMENTATION.md
│   │   ├── INTERNAL_TEAM_DOCUMENTATION.pdf
│   │   ├── SECURITY_SCRUB_GUIDE.md
│   │   └── SEMANTIC_TAGGING_GUIDE.md
│   ├── diagrams/
│   │   ├── 03_ARCHITECTURAL_DIAGRAMS.md
│   │   ├── AAST_AI_Agent_Sequence_Diagrams.md
│   │   ├── diagram.html
│   │   ├── diagram.jpeg
│   │   ├── diagram.md
│   │   ├── diagram.pdf
│   │   └── diagram.png
│   ├── reports/
│   │   ├── 01_MASTER_TECHNICAL_REPORT.md
│   │   ├── 04_PERFORMANCE_ANALYSIS.md
│   │   ├── audit/
│   │   ├── final_verdict_aast_ai_agent (1).docx
│   │   └── graph_metrics_phase4b.md
│   ├── research/
│   │   └── academic_ai_engineer_portfolio.md
│   └── reverse_engineering/
│       ├── 00_audit_progress.md
│       ├── 04_orchestrator.md
│       ├── 05_brain_router.md
│       ├── 06_rag_engine.md
│       ├── 07_neo4j_engine.md
│       ├── 08_decision_engine.md
│       ├── 08a_domain_model.md
│       ├── 08b_business_rules.md
│       ├── 08c_recommendation_pipeline.md
│       ├── 08d_database_schema.md
│       ├── 08e_api_contracts.md
│       ├── 08f_validation_layer.md
│       ├── 08g_migrations_audit.md
│       ├── 08h_utilities_audit.md
│       ├── 09_conversation_system.md
│       ├── 10_memory_architecture.md
│       ├── 11_unified_answer_service.md
│       ├── 15_failover_system.md
│       ├── 16_circuit_breaker.md
│       ├── 17_persistence_layer.md
│       ├── ACCURACY_VALIDATION_REPORT.md
│       ├── AUDIT_COMPLIANCE_REPORT.md
│       ├── college_decision_system_coverage_report.md
│       ├── college_decision_system_inventory.md
│       └── phase4_gap_analysis.md
├── graphrag/
│   └── research/
│       ├── embed_server_rag.py
│       └── ner_service.py
├── launcher/
│   ├── start_platform.ps1
│   └── stop_platform.ps1
├── start_full_project.bat
├── starter.bat
└── stop_full_project.bat
```
