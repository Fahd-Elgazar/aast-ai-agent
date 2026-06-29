# Rebuild Plan

Generated: 2026-06-20 14:39:44 +03:00

## Classification
| Service | Action | Reason |
|---|---|---|
| backend | rebuild + recreate | stale image; latest source contains runtimeMode.js and Gemma mode changes absent from existing container |
| frontend | rebuild + recreate | built application bundle is baked into image |
| decision-api | rebuild + recreate | project source/env changed after image build; source is baked into image |
| rag-answer | rebuild + recreate | rag_system source changed; source is baked into image |
| rag-retriever | rebuild + recreate | shared rag_system context changed; source is baked into image |
| neo4j | recreate/restart only | official image; persistent data in named volumes |
| qdrant | recreate/restart only | official image; persistent data in named volume |

## Exact Commands
``powershell
Set-Location C:\AI_AGENT

docker compose -f C:\AI_AGENT\docker-compose.yml build backend frontend decision-api rag-answer rag-retriever
docker compose -f C:\AI_AGENT\docker-compose.yml up -d --no-deps --force-recreate qdrant neo4j
docker compose -f C:\AI_AGENT\docker-compose.yml up -d --no-deps --force-recreate decision-api rag-retriever rag-answer backend frontend
``

## Prohibited Commands
Do not run docker compose down -v, docker volume rm, docker system prune --volumes, or any command that deletes named volumes.

## Actual Execution Result - 2026-06-20 14:44:34 +03:00
- Volume backups completed at: $backupDir
- Rebuild succeeded for: backend, decision-api, rag-answer, rag-retriever.
- Rebuild failed for: frontend.
- Recreate succeeded for: qdrant, decision-api, rag-retriever, rag-answer, backend.
- Recreate failed for: neo4j due host port conflict on 127.0.0.1:7687.
- Frontend was not recreated because its latest image did not build.
