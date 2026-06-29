# Safe Deployment Guide

Generated: 2026-06-20 14:39:44 +03:00

## Safety Rule
This deployment preserves Neo4j data, Qdrant data, and Docker named volumes. No volume deletion is allowed.

## Before-State Captured
- Compose state captured from docker compose ps -a.
- Volume inventory captured from docker volume ls --filter name=aast-ai-agent.
- Rendered compose config written to C:\AI_AGENT\compose.rendered.before-deploy.txt.

Current compose state:
``text
NAME                            IMAGE                               COMMAND                  SERVICE         CREATED      STATUS                        PORTS
aast-ai-agent-backend-1         aast-ai-agent/backend:local         "docker-entrypoint.s…"   backend         2 days ago   Exited (1) 33 minutes ago     
aast-ai-agent-decision-api-1    aast-ai-agent/decision-api:local    "sh -c 'if [ ! -f /a…"   decision-api    2 days ago   Up 26 minutes (healthy)       127.0.0.1:8005->8005/tcp
aast-ai-agent-frontend-1        aast-ai-agent/frontend:local        "/docker-entrypoint.…"   frontend        2 days ago   Exited (0) 33 minutes ago     
aast-ai-agent-neo4j-1           neo4j:5.26-community                "tini -g -- /startup…"   neo4j           2 days ago   Exited (137) 33 minutes ago   
aast-ai-agent-qdrant-1          qdrant/qdrant:v1.12.5               "./entrypoint.sh"        qdrant          2 days ago   Up 26 minutes (healthy)       127.0.0.1:6333->6333/tcp
aast-ai-agent-rag-answer-1      aast-ai-agent/rag-answer:local      "uvicorn phase4_llm_…"   rag-answer      2 days ago   Up 26 minutes (unhealthy)     127.0.0.1:8002->8002/tcp
aast-ai-agent-rag-retriever-1   aast-ai-agent/rag-retriever:local   "uvicorn phase3_retr…"   rag-retriever   2 days ago   Exited (137) 33 minutes ago   

``

Current volume inventory:
``text
DRIVER    VOLUME NAME
local     aast-ai-agent_backend_data
local     aast-ai-agent_backend_logs
local     aast-ai-agent_decision_data
local     aast-ai-agent_decision_whisper_cache
local     aast-ai-agent_neo4j_data
local     aast-ai-agent_neo4j_import
local     aast-ai-agent_neo4j_logs
local     aast-ai-agent_neo4j_plugins
local     aast-ai-agent_qdrant_data
local     aast-ai-agent_rag_hf_cache
local     aast-ai-agent_rag_torch_cache

``

## Backup Commands
``powershell
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = "C:\AI_AGENT\docker_volume_backups\$stamp"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

docker run --rm -v aast-ai-agent_neo4j_data:/data:ro -v "${backupDir}:/backup" alpine tar czf /backup/neo4j_data.tgz -C /data .
docker run --rm -v aast-ai-agent_qdrant_data:/data:ro -v "${backupDir}:/backup" alpine tar czf /backup/qdrant_data.tgz -C /data .
docker run --rm -v aast-ai-agent_backend_data:/data:ro -v "${backupDir}:/backup" alpine tar czf /backup/backend_data.tgz -C /data .
docker run --rm -v aast-ai-agent_decision_data:/data:ro -v "${backupDir}:/backup" alpine tar czf /backup/decision_data.tgz -C /data .
``

## Deployment Commands
``powershell
Set-Location C:\AI_AGENT

docker compose -f C:\AI_AGENT\docker-compose.yml build backend frontend decision-api rag-answer rag-retriever

docker compose -f C:\AI_AGENT\docker-compose.yml up -d --no-deps --force-recreate qdrant neo4j
docker compose -f C:\AI_AGENT\docker-compose.yml up -d --no-deps --force-recreate decision-api
docker compose -f C:\AI_AGENT\docker-compose.yml up -d --no-deps --force-recreate rag-retriever
docker compose -f C:\AI_AGENT\docker-compose.yml up -d --no-deps --force-recreate rag-answer
docker compose -f C:\AI_AGENT\docker-compose.yml up -d --no-deps --force-recreate backend
docker compose -f C:\AI_AGENT\docker-compose.yml up -d --no-deps --force-recreate frontend
``

## Actual Backup And Deployment Result - 2026-06-20 14:44:34 +03:00
- Backup directory: $backupDir
- Data volumes were not deleted.
- Partial deployment completed for rebuilt backend/decision/rag services, but backend is crash-looping and Neo4j/frontend remain blocked.
