# Dockerization Plan

This Docker pass preserves the existing service boundaries, ports, APIs, and startup responsibilities. Ollama remains outside Docker on the Windows host.

## Phase 1 - Folder Structure

```text
AI_AGENT/
  docker-compose.yml
  .env.docker.example
  DOCKERIZATION.md
  aast-ai-agent-main/
    frontend/
      Dockerfile
      .dockerignore
      nginx.conf
    backend/
      Dockerfile
      .dockerignore
      rag_system/
        Dockerfile.retriever
        Dockerfile.answer
        .dockerignore
        requirements.retriever.txt
        requirements.answer.txt
  college-decision-system-backend/
    Dockerfile
    .dockerignore
```

## Phase 1 - Networking Strategy

Compose creates one bridge network: `ai-agent-net`.

Containers talk to each other by service name:

```text
frontend -> backend:8004 through nginx /api proxy
backend -> decision-api:8005
backend -> rag-retriever:8001
backend -> rag-answer:8002
backend -> neo4j:7687
rag-retriever -> qdrant:6333
rag-answer -> rag-retriever:8001
backend/rag-answer -> host.docker.internal:11434 for host Ollama
```

Host ports are bound to `127.0.0.1` to preserve local access without exposing them on the LAN:

```text
5173 frontend
8004 backend orchestrator
8005 decision API
8001 RAG retriever
8002 RAG answer engine
6333 Qdrant
7474 Neo4j HTTP
7687 Neo4j Bolt
```

## Phase 1 - Volume Strategy

Named volumes preserve runtime state:

```text
qdrant_data              Qdrant vector storage
neo4j_data               Neo4j graph data
neo4j_logs               Neo4j logs
neo4j_import             Neo4j import directory
neo4j_plugins            Neo4j plugins
decision_data            seeded SQLite dev.db and voice temp files
decision_whisper_cache   Whisper model cache
backend_logs             orchestrator logs
backend_data             orchestrator conversation data mount point
rag_hf_cache             Hugging Face model cache
rag_torch_cache          Torch cache
```

The decision API seeds `/app/runtime/dev.db` from the image copy of `dev.db` only when the volume does not already contain a database.

## Phase 2 - Dockerfiles

Implemented:

```text
aast-ai-agent-main/frontend/Dockerfile
aast-ai-agent-main/backend/Dockerfile
college-decision-system-backend/Dockerfile
aast-ai-agent-main/backend/rag_system/Dockerfile.retriever
aast-ai-agent-main/backend/rag_system/Dockerfile.answer
```

The frontend builds React/Vite and serves static assets through nginx on port `5173`. nginx proxies `/api` to `backend:8004`.

The backend runs the existing command:

```powershell
npm run start:orchestrator
```

The Python services run:

```powershell
uvicorn app.main:app --host 0.0.0.0 --port 8005
uvicorn phase3_retriever:app --host 0.0.0.0 --port 8001
uvicorn phase4_llm_answer_engine:app --host 0.0.0.0 --port 8002
```

## Phase 3 - Required Env Changes

For Docker, use service names instead of loopback addresses:

```env
DECISION_API_URL=http://decision-api:8005
RAG_BASE_URL=http://rag-retriever:8001
RAG_RETRIEVER_URL=http://rag-retriever:8001
RAG_ANSWER_URL=http://rag-answer:8002
NEO4J_URI=bolt://neo4j:7687
QDRANT_HOST=qdrant
QDRANT_PORT=6333
OLLAMA_BASE_URL=http://host.docker.internal:11434
VITE_API_BASE=/api
DATABASE_URL=sqlite:////app/runtime/dev.db
```

`phase3_retriever.py` and `phase2_qdrant_ingestion.py` now read Qdrant settings from environment variables.

Do not commit real secrets. Use `.env.docker.example` as the template for Compose substitution values.

## Phase 3 - Host Ollama Access

Ollama stays on Windows. Containers reach it at:

```text
http://host.docker.internal:11434
```

Verify on Windows:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:11434/api/tags
```

If containers cannot reach Ollama, restart Ollama with a host binding that Docker Desktop can access:

```powershell
$env:OLLAMA_HOST="0.0.0.0:11434"
ollama serve
```

Only use that binding on a trusted machine/network.

## Phase 4 - Startup

Stop local services that already occupy Docker-managed ports. On this machine, ports `6333`, `7474`, and `7687` were already listening during verification.

Check ports:

```powershell
Get-NetTCPConnection -LocalPort 5173,6333,7474,7687,8001,8002,8004,8005 -State Listen -ErrorAction SilentlyContinue
```

Build:

```powershell
docker compose build
```

Start:

```powershell
docker compose up -d
```

For a fresh Qdrant volume, seed the vector collection after Qdrant is healthy:

```powershell
docker compose run --rm rag-retriever python phase2_qdrant_ingestion.py --input cleaned_chunked_cai_production_v4.json --force-rebuild
```

View logs:

```powershell
docker compose logs -f backend
docker compose logs -f rag-retriever
docker compose logs -f rag-answer
```

Stop:

```powershell
docker compose down
```

Stop and delete volumes only when you intentionally want to erase Dockerized databases:

```powershell
docker compose down -v
```

## Phase 4 - Verification

Health endpoints:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:5173/
Invoke-WebRequest -UseBasicParsing http://localhost:8004/health
Invoke-WebRequest -UseBasicParsing http://localhost:8005/health
Invoke-WebRequest -UseBasicParsing http://localhost:8001/health
Invoke-WebRequest -UseBasicParsing http://localhost:8002/health
Invoke-WebRequest -UseBasicParsing http://localhost:6333/healthz
Invoke-WebRequest -UseBasicParsing http://localhost:7474/
```

Compose health:

```powershell
docker compose ps
```

Functional smoke test:

```powershell
Invoke-RestMethod -Method Post http://localhost:8004/api/chatbot/query -ContentType "application/json" -Body '{"query":"What are admission requirements?","cid":"docker-smoke"}'
```

Checklist:

```text
[ ] Ollama host returns /api/tags
[ ] Qdrant container healthy
[ ] Qdrant collection ingested for fresh volumes
[ ] Neo4j container healthy and graph data imported/restored
[ ] Decision API /health returns ok
[ ] RAG retriever /health returns healthy
[ ] RAG answer /health returns healthy
[ ] Backend /health returns 200
[ ] Frontend loads on localhost:5173
[ ] Chat endpoint returns a non-error response
```

## Phase 5 - Windows Caveats

Port conflicts are common when migrating incrementally. If local Neo4j/Qdrant are still running, Compose cannot bind `7474`, `7687`, or `6333`.

Docker named volumes are not normal Windows folders. Inspect through Docker commands, not Explorer paths.

Neo4j persistence warning: changing `NEO4J_AUTH`, database name, or major Neo4j versions against an existing `neo4j_data` volume can prevent startup. Back up before deleting or reusing graph volumes.

Qdrant persistence warning: a fresh `qdrant_data` volume has no collection. Run the ingestion command once, or restore an existing Qdrant snapshot/volume.

Ollama caveat: `localhost` inside a container means the container itself. Use `host.docker.internal` for Windows-host Ollama.

Vite/HMR caveat: this Dockerfile serves a production build through nginx. For active Vite HMR development, use the existing local frontend dev workflow or add a separate dev override later; do not mix HMR assumptions into this production-style Compose file.
