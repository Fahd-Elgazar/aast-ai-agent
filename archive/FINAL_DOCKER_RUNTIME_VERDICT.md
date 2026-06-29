# Final Docker Runtime Verdict

Generated: 2026-06-20 14:27:15 +03:00

## Answers
| Question | Answer | Evidence |
|---|---|---|
| Are these containers from C:\AI_AGENT? | YES for the aast-ai-agent-* stack | Compose labels show project aast-ai-agent, working dir C:\AI_AGENT, config file C:\AI_AGENT\docker-compose.yml |
| Is the backend running the latest source code? | NO | Backend is stopped; no source bind mount; container /app/orchestrator.js and package.json hashes differ from host; runtimeMode.js missing in container |
| Are the Gemma Primary changes active at runtime? | NO | Backend is stopped; container env lacks SINGLE_GEMMA_GENERATION_MODE and GEMINI_BACKUP_ENABLED; image lacks config/runtimeMode.js |
| Which containers must be rebuilt? | backend, frontend, decision-api, rag-answer; rag-retriever recommended if shared rag_system context should be consistent | Project-built images are stale or stale-risk versus source timestamps/hashes |
| Which containers must be recreated? | backend definitely; frontend, decision-api, rag-answer after rebuild; rag-retriever if rebuilt; backend also needs recreate to pick up current env flags | Existing backend container env does not match rendered Compose config |
| Can benchmarking begin now? | NO | Backend unavailable; metrics unavailable; Gemma runtime changes not active |

## Current AAST Runtime State
- Running: aast-ai-agent-decision-api-1, aast-ai-agent-qdrant-1, aast-ai-agent-rag-answer-1
- Healthy: decision-api, qdrant
- Unhealthy: rag-answer
- Stopped: backend, frontend, rag-retriever, neo4j

## Safe Next Operational Direction
No action was taken during this audit. Before benchmarking, rebuild stale project images and recreate affected containers so image content and container env match C:\AI_AGENT\docker-compose.yml and C:\AI_AGENT\aast-ai-agent-main.
