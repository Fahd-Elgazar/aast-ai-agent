# Book Source Inventory
**AAST AI Agent — Graduation Project Documentation Inventory**

This inventory lists all markdown reports, Word files, PDFs, and diagrams in the repository that can serve as primary sources for compiling the graduation project book.

---

## 1. Inventory Checklist

| Document Path | File Type | Category | Purpose | Useful Rating |
| :--- | :---: | :---: | :--- | :---: |
| `docs/architecture/MASTER_TECHNICAL_DOCUMENTATION.md` | Markdown | Architecture | Comprehensive developer roadmap and blueprint. | **High** |
| `docs/architecture/VERIFIED_SYSTEM_MAP.md` | Markdown | Architecture | Service ports, databases, and dependencies details. | **High** |
| `docs/architecture/CONDENSED_RUNTIME_TRACE.md` | Markdown | Trace | Step-by-step trace of request processing. | **High** |
| `docs/architecture/AAST_AGENT_SYSTEM_DOCS.md` | Markdown | Architecture | Original system description and core modules details. | **High** |
| `docs/diagrams/AAST_AI_Agent_Sequence_Diagrams.md` | Markdown | Diagrams | Visual sequence diagrams representing system endpoints. | **High** |
| `docs/reports/01_MASTER_TECHNICAL_REPORT.md` | Markdown | Report | Comprehensive audit of system databases and ports. | **High** |
| `docs/reports/04_PERFORMANCE_ANALYSIS.md` | Markdown | Performance | In-depth analysis of LLM failovers and latencies. | **High** |
| `docs/reports/final_verdict_aast_ai_agent (1).docx` | Word | Report | External verification report on security and performance. | **High** |
| `docs/reports/graph_metrics_phase4b.md` | Markdown | GraphRAG | Metric details on Neo4j nodes and Cypher patches. | **High** |
| `docs/research/academic_ai_engineer_portfolio.md` | Markdown | Research | Career alignment, AI engineer portfolios, and research topics. | **Medium** |
| `docs/deployment/DOCKERIZATION.md` | Markdown | Deployment | Container setups and environment configs. | **Medium** |
| `docs/development/INTERNAL_TEAM_DOCUMENTATION.md` | Markdown | Manual | Internal guidelines for developers and contributors. | **Medium** |
| `docs/development/SECURITY_SCRUB_GUIDE.md` | Markdown | Security | Guidelines for secrets management and sanitization. | **Medium** |
| `docs/development/SEMANTIC_TAGGING_GUIDE.md` | Markdown | Standards | Guidelines for tagging and course metadata mappings. | **Medium** |
| `docs/reverse_engineering/04_orchestrator.md` | Markdown | Code Audit | In-depth breakdown of `orchestrator.js` logic and methods. | **High** |
| `docs/reverse_engineering/05_brain_router.md` | Markdown | Code Audit | Logic flow for query classification and heuristic routing. | **High** |
| `docs/reverse_engineering/06_rag_engine.md` | Markdown | Code Audit | Analysis of Python retrieve and answer APIs. | **High** |
| `docs/reverse_engineering/07_neo4j_engine.md` | Markdown | Code Audit | Database structure, node mappings, and Cypher helper audits. | **High** |
| `docs/reverse_engineering/08_decision_engine.md` | Markdown | Code Audit | FastAPI DSS business rules and recommends flow. | **High** |
| `docs/reverse_engineering/08a_domain_model.md` | Markdown | Code Audit | DSS domain entities, scoring schemas, and validations. | **High** |
| `docs/reverse_engineering/08b_business_rules.md` | Markdown | Code Audit | Program fee calculations and admission constraints. | **High** |
| `docs/reverse_engineering/08c_recommendation_pipeline.md`| Markdown | Code Audit | Recommendation filtering, sorting, and scoring logs. | **High** |
| `docs/reverse_engineering/08d_database_schema.md` | Markdown | Code Audit | Relational schema definitions and SQLAlchemy structures. | **High** |
| `docs/reverse_engineering/08e_api_contracts.md` | Markdown | Code Audit | DSS API schema contracts and voice processing routes. | **High** |
| `docs/reverse_engineering/08g_migrations_audit.md` | Markdown | Code Audit | Alembic database migrations history. | **High** |
| `docs/reverse_engineering/09_conversation_system.md` | Markdown | Code Audit | Session managers and memory prioritization. | **High** |
| `docs/reverse_engineering/11_unified_answer_service.md` | Markdown | Code Audit | Merging and synthesis engines code breakdown. | **High** |
| `docs/reverse_engineering/15_failover_system.md` | Markdown | Code Audit | Failover handlers, retry buffers, and backup Ollama. | **High** |
| `docs/reverse_engineering/16_circuit_breaker.md` | Markdown | Code Audit | Node state machines and gateway protection filters. | **High** |
| `docs/reverse_engineering/ACCURACY_VALIDATION_REPORT.md` | Markdown | Evaluation | Benchmarks evaluating LLM accuracy and hallucinations. | **High** |
| `docs/reverse_engineering/college_decision_system_inventory.md`| Markdown | Inventory | Inventory of FastAPI DSS files and classes. | **Medium** |
| `aast-ai-agent-main/backend/testing/benchmark_summary.md`| Markdown | Evaluation | Results of golden path benchmarks. | **High** |
| `docs/diagrams/diagram.png` (and `.jpeg`, `.pdf`) | Images | Diagrams | Visual architecture maps. | **High** |
| `docs/reports/audit/` (24 files) | Markdown | Audits | Step-by-step logs of previous cleanup batches. | **Medium** |
| Root Directory Technical Audits (18 files) | Markdown | Audits | Reorganization plan documents and freeze logs. | **Medium** |

---

## 2. Core Material Summaries

*   **`MASTER_TECHNICAL_DOCUMENTATION.md`:** Establishes the authoritative architectural baseline. Documents component relationships, ports table, failover paths, and fusion algorithms. Extremely useful for Chapter 3 (System Design).
*   **Reverse Engineering Folders (`docs/reverse_engineering/`)**: Breaking down raw source code files (e.g. `04_orchestrator.md` through `17_persistence_layer.md`) into class mappings, interfaces, and parameter details. Directly useful for Chapter 4 (Implementation).
*   **Accuracy and Latency Reports (`docs/reverse_engineering/ACCURACY_VALIDATION_REPORT.md`, `04_performance_analysis.md`)**: Provide charts, timings, and hallucination scores. Directly useful for Chapter 5 (Evaluation and Benchmarking).
