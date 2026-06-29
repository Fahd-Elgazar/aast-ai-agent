# Docker Remote Gemma Audit

Audit date: 2026-06-21  
Repository root: `C:\AI_AGENT`  
Branch observed: current checked-out branch, `recovery-baseline`  
Mode: read-only audit.

## Question

Can Backend remain on Machine A while Ollama runs on Machine B?

## Answer

YES for the current Docker Compose architecture, if the backend container receives `OLLAMA_BASE_URL=http://REMOTE_IP:11434` and Machine B is reachable from Docker containers on Machine A.

NOT PROVEN live, because no actual remote Machine B endpoint was tested in this audit.

PARTIAL for "Gemma only", because the same `OLLAMA_BASE_URL` is also used by KG embeddings.

## Docker Evidence

### Backend

`docker-compose.yml` evidence:

- `docker-compose.yml:26-30` backend build context is `./aast-ai-agent-main/backend`.
- `docker-compose.yml:31-32` backend loads `./aast-ai-agent-main/backend/.env`.
- `docker-compose.yml:33-56` then sets explicit backend environment values.
- `docker-compose.yml:41` sets `OLLAMA_BASE_URL: ${OLLAMA_BASE_URL:-http://host.docker.internal:11434}`.
- `docker-compose.yml:44` sets `PRIMARY_MODEL: ${PRIMARY_MODEL:-gemma4:e2b}`.
- `docker-compose.yml:68-69` adds `host.docker.internal:host-gateway`.
- `docker-compose.yml:80-81` attaches backend to `ai-agent-net`.

Rendered/running runtime evidence:

- Running backend env showed `OLLAMA_BASE_URL=http://host.docker.internal:11434`.
- Running backend env showed `PRIMARY_MODEL=gemma4:e2b`.
- Running backend env showed `BACKUP_MODEL=tinyllama:latest`.

Interpretation:

- Current live Docker target is host-local Ollama, not remote.
- The Compose file is parameterized, so a remote URL can be injected through Compose interpolation.
- Changing `aast-ai-agent-main\backend\.env` alone is not proven sufficient for Docker Compose, because `docker-compose.yml:41` is explicit `environment`, and rendered Compose currently overrides the service `env_file` value.

### RAG Answer

`docker-compose.yml` evidence:

- `docker-compose.yml:147-151` rag-answer build context is `./aast-ai-agent-main/backend/rag_system`.
- `docker-compose.yml:153` sets `RAG_RETRIEVER_URL=http://rag-retriever:8001`.
- `docker-compose.yml:154` sets `OLLAMA_BASE_URL: ${OLLAMA_BASE_URL:-http://host.docker.internal:11434}`.
- `docker-compose.yml:155` sets `RAG_ANSWER_ENGINE_ENABLED=false` by default.
- `docker-compose.yml:156` sets `RAG_ANSWER_MODEL=gemma4:e2b`.
- `docker-compose.yml:165-166` adds `host.docker.internal:host-gateway`.

Rendered/running runtime evidence:

- Running rag-answer env showed `OLLAMA_BASE_URL=http://host.docker.internal:11434`.
- Running rag-answer env showed `RAG_ANSWER_ENGINE_ENABLED=false`.
- Running rag-answer env showed `RAG_ANSWER_MODEL=gemma4:e2b`.

Interpretation:

- RAG Answer would follow the same remote `OLLAMA_BASE_URL` if generation is enabled.
- Current runtime does not generate through RAG Answer because answer engine is disabled.

### Other Services

Backend service discovery remains internal to Machine A:

- `DECISION_API_URL=http://decision-api:8005`
- `RAG_BASE_URL=http://rag-retriever:8001`
- `RAG_RETRIEVER_URL=http://rag-retriever:8001`
- `RAG_ANSWER_URL=http://rag-answer:8002`
- `NEO4J_URI=bolt://neo4j:7687`
- `QDRANT_HOST=qdrant`

Ports are bound to `127.0.0.1` on Machine A:

- Frontend: `127.0.0.1:5173`
- Backend: `127.0.0.1:8004`
- Decision API: `127.0.0.1:8005`
- RAG Retriever: `127.0.0.1:8001`
- RAG Answer: `127.0.0.1:8002`
- Qdrant: `127.0.0.1:6333`
- Neo4j: `127.0.0.1:7474` and `127.0.0.1:7687`

Interpretation:

- These port bindings restrict inbound host exposure; they do not prevent outbound HTTP from backend/rag-answer containers to `http://REMOTE_IP:11434`.
- Docker bridge networking does not require the remote Ollama to be a Compose service.
- `host.docker.internal` is only the current host-local shortcut; a literal remote IP would bypass that hostname assumption.

## Service Discovery Audit

| Dependency | Current Compose target | Affected by moving Ollama? | Evidence |
|---|---|---:|---|
| Backend -> Decision API | `http://decision-api:8005` | No | `docker-compose.yml:37` |
| Backend -> RAG Retriever | `http://rag-retriever:8001` | No | `docker-compose.yml:38-39` |
| Backend -> RAG Answer | `http://rag-answer:8002` | No | `docker-compose.yml:40` |
| Backend -> Neo4j | `bolt://neo4j:7687` | No | `docker-compose.yml:51` |
| RAG Retriever -> Qdrant | `qdrant:6333` | No | `docker-compose.yml:117-118` |
| Backend -> Ollama | `${OLLAMA_BASE_URL}` | Yes | `docker-compose.yml:41` |
| RAG Answer -> Ollama | `${OLLAMA_BASE_URL}` | Yes if enabled | `docker-compose.yml:154` |

## Hostname Assumptions

Current host-local assumption:

- `host.docker.internal` is added for backend and rag-answer.
- Current rendered/running env points to `http://host.docker.internal:11434`.

Remote-compatible path:

- A literal `http://REMOTE_IP:11434` does not depend on Docker service discovery.
- It depends on network reachability from backend/rag-answer containers to Machine B.

NOT PROVEN:

- Firewall rules on Machine B.
- Ollama bind address on Machine B.
- Machine B availability from Docker Desktop networking.
- Remote `/api/tags`, `/api/generate`, and `/api/embeddings` behavior.

## Docker Verdict

Backend can remain on Machine A while Ollama runs on Machine B: YES by Docker configuration and code path.

The current live Docker configuration is not yet remote: it points to `host.docker.internal`.

Changing only the Compose interpolation value for `OLLAMA_BASE_URL` would redirect both backend and rag-answer Ollama HTTP traffic, but it would also redirect KG embeddings to Machine B.
