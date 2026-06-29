# Target Structure Proposal
**AAST AI Agent — Repository Directory Organization Baseline**

This proposal maps out the clean, target directory layout for the AAST AI Agent project, establishing clear modular boundaries between runtime domains, static datasets, and experimental archives.

---

## 1. Proposed Repository Architecture Layout

This structure represents the ideal clean separation of frontend, backend core, Python RAG engines, FastAPI Decision Support Services (DSS), documentation, dataset assets, and archived pipelines:

```text
AI_AGENT/
├── frontend/                                   # React client SPA (React, Vite, TS)
├── backend/                                    # Express orchestrator backend core
│   ├── config/                                 # Heuristic configurations and calibrators
│   ├── db/                                     # Database connectors (Neo4j, MeiliSearch)
│   ├── middleware/                             # Express authorization and parsing handlers
│   ├── models/                                 # Legacy Mongoose database schemas
│   ├── monitoring/                             # Analytics and telemetry logging modules
│   ├── routes/                                 # REST controller route mappings
│   ├── services/                               # Core business rules, fusions, routing
│   └── tests/                                  # Integration and smoke tests
│
├── graphrag/                                   # GraphRAG configurations and tools
│   └── research/                               # Offline embedding engines and taggers
│
├── college-decision-system-backend/            # Python FastAPI DSS microservice
│   ├── app/                                    # Domain logic, repositories, and routers
│   ├── alembic/                                # Relational schema database migrations
│   ├── scripts/                                # Database seeding and repair routines
│   └── tests/                                  # Pytest validation suites
│
├── docs/                                       # Repository documentation directory
│   ├── architecture/                           # System diagrams and baselines
│   ├── api/                                    # Endpoint schema specifications
│   ├── deployment/                             # Dockerization and port bindings
│   ├── development/                            # Developer setup guidelines
│   ├── reports/                                # Performance audits and final verdicts
│   └── archive/                                # Deprecated documentation storage
│
├── data/                                       # Static datasets and scraper caches
│   ├── datasets/                               # Seed data JSON indexes
│   ├── scraping/                               # Off-line scraping tools and step8 logs
│   └── relationship/                           # Offline Neo4j graph analysis files
│
└── archive/                                    # Inactive legacy prototypes
    └── multimodal/                             # Archived vision/LLaVA pipeline wrappers
```

---

## 2. Module Separation Boundaries

To ensure runtime safety, the boundaries between modules are defined as follows:

1.  **Frontend Boundary:** The React app communicates with the backend solely via HTTP calls to the Port 8004 API. It has no direct database or file-system access.
2.  **Backend Core Boundary:** The Express server acts as the primary runtime coordinator. It communicates with Neo4j using Bolt, with Qdrant via the Python RAG Retriever, and with the DSS microservice using HTTP.
3.  **DSS Boundary:** The FastAPI DSS module is entirely self-contained, importing nothing from Node.js, and running its own relational SQLite database.
4.  **Python RAG Boundary:** The retrieval engines are run on independent ports, querying Qdrant and returning chunk outputs, decoupled from the core Express orchestrator.
