# Gemma Runtime Verification

Generated: 2026-06-20 14:27:15 +03:00

## Requested Checks
| Check | Result | Evidence |
|---|---|---|
| Backend container running | NO | aast-ai-agent-backend-1 status is exited, exit code 1 |
| runtimeMode.js exists inside backend container | NO | docker cp aast-ai-agent-backend-1:/app/config/runtimeMode.js failed: file not found |
| SINGLE_GEMMA_GENERATION_MODE=true in backend container env | NO | docker inspect backend env does not contain SINGLE_GEMMA_GENERATION_MODE |
| GEMINI_BACKUP_ENABLED=true in backend container env | NO | docker inspect backend env does not contain GEMINI_BACKUP_ENABLED |
| Current rendered Compose has those flags | YES | docker compose -f C:\AI_AGENT\docker-compose.yml config renders both flags as true |
| Current runtime uses Gemma Primary + Gemini Backup | NO / NOT ACTIVE | Backend is stopped and existing container lacks the new runtime mode file and env flags |

## Important Distinction
The current source and rendered Compose config contain the Gemma Primary / Gemini Backup changes. The existing backend container does not. Docker metadata proves the container was created before those runtime flags were applied to the container environment, and the image filesystem lacks config/runtimeMode.js.

## Model Env Actually Present In Existing Backend Container
- PRIMARY_MODEL=gemma4:e2b
- BACKUP_MODEL=tinyllama:latest
- GEMINI_BACKUP_ENABLED: absent
- SINGLE_GEMMA_GENERATION_MODE: absent
- GEMINI_MODEL: absent

## Verdict
Gemma Primary changes are not active at runtime in the current backend container.
