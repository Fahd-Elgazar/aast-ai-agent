# AAST AI Academic Advisor

An evidence-grounded academic advising platform that combines a Neo4j knowledge graph, Qdrant semantic retrieval, deterministic routing, and a program-decision service behind a React interface.

## Capabilities

- Course, instructor, syllabus, and academic-policy questions
- Hybrid knowledge-graph and retrieval-augmented answers
- Evidence-bound scholarship and regulation responses
- Program recommendations with explainable scoring
- Persistent conversation history
- Optional local Ollama, Gemini-backed synthesis, and voice input

## Architecture

| Service | Technology | Port |
|---|---|---:|
| Web interface | React, TypeScript, Vite, Nginx | 5173 |
| Advisor API | Node.js, Express | 8004 |
| Decision API | FastAPI, SQLAlchemy | 8005 |
| RAG retriever | FastAPI, BGE-M3 | 8001 |
| RAG answer service | FastAPI | 8002 |
| Knowledge graph | Neo4j | 7474 / 7687 |
| Vector database | Qdrant | 6333 |

All published ports bind to localhost by default.

## Repository layout

```text
.
├── aast-ai-agent-main/
│   ├── backend/             # Advisor API and RAG services
│   └── frontend/            # React web application
├── college-decision-system-backend/
│   └── app/                 # Program-decision API
├── launcher/                # Windows lifecycle scripts
├── docker-compose.yml
└── starter.bat
```

## Requirements

- Docker Desktop with Compose
- At least 8 GB RAM available to Docker
- Ollama reachable from Docker when local model synthesis is enabled
- `gemma4:e2b` and `tinyllama:latest`, or equivalent configured models

## Configuration

Create local environment files; never commit them:

```powershell
Copy-Item .env.docker.example .env
Copy-Item aast-ai-agent-main\backend\.env.example aast-ai-agent-main\backend\.env
Copy-Item aast-ai-agent-main\frontend\.env.example aast-ai-agent-main\frontend\.env
Copy-Item college-decision-system-backend\.env.example college-decision-system-backend\.env
```

Replace all `replace-with-*` values. The Compose and application internal secrets must match.

## Run

```powershell
docker compose up -d --build
docker compose ps
```

Open:

- Application: `http://127.0.0.1:5173`
- Health: `http://127.0.0.1:8004/health`

Stop the stack with:

```powershell
docker compose down
```

Existing Windows launchers remain available:

```powershell
.\starter.bat full
.\starter.bat status
.\starter.bat stop
```

## Validation

```powershell
Push-Location aast-ai-agent-main\frontend
npm ci
npm run lint
npm run build
Pop-Location

Push-Location aast-ai-agent-main\backend
npm ci
npm run test:routing
Pop-Location

Push-Location college-decision-system-backend
python -m pip install -r requirements-dev.txt
python -m pytest -q
Pop-Location
```

## Data and safety

Runtime databases, model caches, scraped source archives, generated reports, credentials, and local recovery material are deliberately excluded from the production tree. Neo4j, Qdrant, conversation, and decision data live in Docker volumes. Whisper and decision-side Gemini dependencies are optional and are not installed in the default production image.

Answers are designed to distinguish verified evidence from missing information. Academic decisions should still be confirmed through official university channels.
