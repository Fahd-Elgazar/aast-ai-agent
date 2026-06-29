# Documentation Map: AAST Academic AI Agent

This document outlines the proposed target locations and statuses for all documentation files. In compliance with Phase 1 constraints, **no files will be moved or modified until this map receives explicit user approval.**

---

## 1. Documentation Reorganization Proposal

Scatter documentation files will be consolidated into the target structure:

`docs/`
├── `architecture/` (Architectural reports, trace maps, design decisions)
├── `api/` (API endpoints, payloads, contracts)
├── `deployment/` (Docker guides, environment setups)
├── `development/` (Scrub guides, coding rules, internal developer manuals)
├── `reports/` (Performance analyses, gap reports, audit reports)
├── `diagrams/` (All HTML/JPEG/PNG/Mermaid design diagrams)
├── `research/` (Graph metrics, experimental portfolios, research papers)
└── `archive/` (Duplicate files, legacy or obsolete guidelines)

---

## 2. Document Mapping Table

| Document Name | Original Location | Target Destination | Purpose | Status |
| :--- | :--- | :--- | :--- | :--- |
| **DOCKERIZATION.md** | Root | `docs/deployment/DOCKERIZATION.md` | Guide to run system under Docker. | **Active** |
| **MASTER_PROJECT_BANK.md** | Root | `docs/architecture/MASTER_PROJECT_BANK.md` | Core project requirements scope. | **Active** |
| **MASTER_TECHNICAL_DOCUMENTATION.md** | Root | `docs/architecture/MASTER_TECHNICAL_DOCUMENTATION.md` | High-level system technical specs. | **Active** |
| **MASTER_TECHNICAL_DOCUMENTATION.pdf**| Root | `docs/architecture/MASTER_TECHNICAL_DOCUMENTATION.pdf` | PDF version of the master specs. | **Active** |
| **academic_ai_engineer_portfolio.md**| Root | `docs/research/academic_ai_engineer_portfolio.md` | Developer portfolio & capabilities. | **Active** |
| **cv.md** / **cv.pdf** | Root | `docs/archive/cv.md` (and `.pdf`) | Professional resume assets. | **Legacy** |
| **diagram.html** / **diagram.png** etc.| Root | `docs/diagrams/` (preserve filenames) | System architecture visual maps. | **Active** |
| **03_ARCHITECTURAL_DIAGRAMS.md** | `book/` | `docs/diagrams/03_ARCHITECTURAL_DIAGRAMS.md` | Markdown architecture diagrams. | **Active** |
| **04_PERFORMANCE_ANALYSIS.md** | `book/` | `docs/reports/04_PERFORMANCE_ANALYSIS.md` | Performance and latency benchmarks. | **Active** |
| **AAST_AI_Agent_Architecture_Sequence_Diagrams.md** | `book/` | `docs/diagrams/AAST_AI_Agent_Sequence_Diagrams.md` | Mermaid sequence diagrams. | **Active** |
| **CONDENSED_RUNTIME_TRACE.md** | `book/` | `docs/architecture/CONDENSED_RUNTIME_TRACE.md` | Traces step-by-step query paths. | **Active** |
| **INTERNAL_TEAM_DOCUMENTATION.md** / **.pdf** | `book/` | `docs/development/INTERNAL_TEAM_DOCUMENTATION.md` / `.pdf` | Internal developer guidelines. | **Active** |
| **VERIFIED_SYSTEM_MAP.md** | `book/` | `docs/architecture/VERIFIED_SYSTEM_MAP.md` | Fully mapped endpoints/configurations.| **Active** |
| **MASTER_TECHNICAL_DOCUMENTATION.md** | `book/` & `doc/`| `docs/archive/MASTER_TECHNICAL_DOCUMENTATION_duplicate.md` | Duplicate copies of master specs. | **Archived** |
| **25 Reverse-Engineering files** | `docs/reverse_engineering/` | `docs/architecture/reverse_engineering/` (preserve paths) | In-depth subsystem analyses. | **Active** |
| **01_MASTER_TECHNICAL_REPORT.md** | `aast-ai-agent-main/docs/` | `docs/reports/01_MASTER_TECHNICAL_REPORT.md` | Combined technical audit overview. | **Active** |
| **02_COMPONENT_SYSTEM_DESCRIPTION.md**| `aast-ai-agent-main/docs/` | `docs/architecture/02_COMPONENT_SYSTEM_DESCRIPTION.md` | Service structure overview. | **Active** |
| **03_ARCHITECTURAL_DIAGRAMS.md** | `aast-ai-agent-main/docs/` | `docs/archive/03_ARCHITECTURAL_DIAGRAMS_duplicate.md` | Duplicate diagrams. | **Archived** |
| **04_PERFORMANCE_ANALYSIS.md** | `aast-ai-agent-main/docs/` | `docs/archive/04_PERFORMANCE_ANALYSIS_duplicate.md` | Duplicate performance reports. | **Archived** |
| **SECURITY_SCRUB_GUIDE.md** | `college-decision-system-backend/` | `docs/development/SECURITY_SCRUB_GUIDE.md` | Guidelines to clean sensitive DB data. | **Active** |
| **SEMANTIC_TAGGING_GUIDE.md** | `college-decision-system-backend/` | `docs/development/SEMANTIC_TAGGING_GUIDE.md` | Guidelines for academic tagging. | **Active** |
| **demo_examples.md** | `college-decision-system-backend/docs/` | `docs/api/decision_examples.md` | FastAPI call payload formats. | **Active** |
| **AAST_AI_Agent_Architecture_Sequence_Diagrams.md** (duplicate) | `college-decision-system-backend/docs/` | `docs/archive/Sequence_Diagrams_duplicate.md` | Duplicate sequences. | **Archived** |
| **CONDENSED_RUNTIME_TRACE.md** (duplicate)| `college-decision-system-backend/docs/` | `docs/archive/CONDENSED_RUNTIME_TRACE_duplicate.md` | Duplicate trace map. | **Archived** |
| **VERIFIED_SYSTEM_MAP.md** (duplicate) | `college-decision-system-backend/docs/` | `docs/archive/VERIFIED_SYSTEM_MAP_duplicate.md` | Duplicate system maps. | **Archived** |
| **graph_metrics_phase4b.md** | `relationship/` | `docs/reports/graph_metrics_phase4b.md` | Neo4j nodes and connections count. | **Active** |
| **AAST_AGENT_SYSTEM_DOCS.md** | `aast-ai-agent-main/` | `docs/architecture/AAST_AGENT_SYSTEM_DOCS.md` | Core rules and parameters. | **Active** |
