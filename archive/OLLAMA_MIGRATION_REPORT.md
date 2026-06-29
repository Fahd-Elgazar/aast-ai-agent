# Ollama Migration Report

Generated: 2026-06-25T23:02:35.6418977+03:00
Workspace: C:\AI_AGENT
Target endpoint: http://192.168.100.16:11434

## Scope

- Modified only Ollama endpoint URL values/defaults.
- Did not change prompts, model names, service ports, business logic, Neo4j, Qdrant, FastAPI, backend, or frontend ports.
- Left historical archives, logs, generated artifacts, reports, and nested duplicate checkouts untouched.

## Backup Location

- Backup root: `C:\AI_AGENT\backups\remote_ollama_migration_20260625-230115`
- Manifest: `C:\AI_AGENT\backups\remote_ollama_migration_20260625-230115\backup_manifest.json`

| Source file | Backup file |
|---|---|
| C:\\AI_AGENT\\.env | C:\\AI_AGENT\\backups\\remote_ollama_migration_20260625-230115\\source_files\\.env |
| C:\\AI_AGENT\\.env.docker.example | C:\\AI_AGENT\\backups\\remote_ollama_migration_20260625-230115\\source_files\\.env.docker.example |
| C:\\AI_AGENT\\docker-compose.yml | C:\\AI_AGENT\\backups\\remote_ollama_migration_20260625-230115\\source_files\\docker-compose.yml |
| C:\\AI_AGENT\\aast-ai-agent-main\\backend\\.env | C:\\AI_AGENT\\backups\\remote_ollama_migration_20260625-230115\\source_files\\aast-ai-agent-main\\backend\\.env |
| C:\\AI_AGENT\\aast-ai-agent-main\\backend\\.env.example | C:\\AI_AGENT\\backups\\remote_ollama_migration_20260625-230115\\source_files\\aast-ai-agent-main\\backend\\.env.example |
| C:\\AI_AGENT\\aast-ai-agent-main\\backend\\config\\llmConfig.js | C:\\AI_AGENT\\backups\\remote_ollama_migration_20260625-230115\\source_files\\aast-ai-agent-main\\backend\\config\\llmConfig.js |
| C:\\AI_AGENT\\aast-ai-agent-main\\backend\\embed_nodes.py | C:\\AI_AGENT\\backups\\remote_ollama_migration_20260625-230115\\source_files\\aast-ai-agent-main\\backend\\embed_nodes.py |
| C:\\AI_AGENT\\aast-ai-agent-main\\backend\\rag_system\\phase4_llm_answer_engine.py | C:\\AI_AGENT\\backups\\remote_ollama_migration_20260625-230115\\source_files\\aast-ai-agent-main\\backend\\rag_system\\phase4_llm_answer_engine.py |
| C:\\AI_AGENT\\aast-ai-agent-main\\backend\\services\\neo4jcontext.js | C:\\AI_AGENT\\backups\\remote_ollama_migration_20260625-230115\\source_files\\aast-ai-agent-main\\backend\\services\\neo4jcontext.js |
| C:\\AI_AGENT\\aast-ai-agent-main\\frontend\\multimodal\\reasoning\\gemma_client.py | C:\\AI_AGENT\\backups\\remote_ollama_migration_20260625-230115\\source_files\\aast-ai-agent-main\\frontend\\multimodal\\reasoning\\gemma_client.py |
| C:\\AI_AGENT\\aast-ai-agent-main\\frontend\\multimodal\\vision\\llava_client.py | C:\\AI_AGENT\\backups\\remote_ollama_migration_20260625-230115\\source_files\\aast-ai-agent-main\\frontend\\multimodal\\vision\\llava_client.py |
| C:\\AI_AGENT\\aast-ai-agent-main\\replace.js | C:\\AI_AGENT\\backups\\remote_ollama_migration_20260625-230115\\source_files\\aast-ai-agent-main\\replace.js |
| C:\\AI_AGENT\\launcher\\start_platform.ps1 | C:\\AI_AGENT\\backups\\remote_ollama_migration_20260625-230115\\source_files\\launcher\\start_platform.ps1 |
| C:\\AI_AGENT\\multimodal\\reasoning\\gemma_client.py | C:\\AI_AGENT\\backups\\remote_ollama_migration_20260625-230115\\source_files\\multimodal\\reasoning\\gemma_client.py |
| C:\\AI_AGENT\\multimodal\\vision\\llava_client.py | C:\\AI_AGENT\\backups\\remote_ollama_migration_20260625-230115\\source_files\\multimodal\\vision\\llava_client.py |

## Modified Files And Exact Changes

| File | Exact endpoint replacement | Count |
|---|---|---:|
| C:\\AI_AGENT\\.env | `http://192.168.1.130:11434` -> `http://192.168.100.16:11434` | 1 |
| C:\\AI_AGENT\\.env.docker.example | `http://host.docker.internal:11434` -> `http://192.168.100.16:11434` | 1 |
| C:\\AI_AGENT\\docker-compose.yml | `http://host.docker.internal:11434` -> `http://192.168.100.16:11434` | 2 |
| C:\\AI_AGENT\\aast-ai-agent-main\\backend\\.env | `http://192.168.1.130:11434` -> `http://192.168.100.16:11434` | 1 |
| C:\\AI_AGENT\\aast-ai-agent-main\\backend\\.env.example | `http://localhost:11434` -> `http://192.168.100.16:11434` | 1 |
| C:\\AI_AGENT\\aast-ai-agent-main\\backend\\config\\llmConfig.js | `http://localhost:11434` -> `http://192.168.100.16:11434` | 1 |
| C:\\AI_AGENT\\aast-ai-agent-main\\backend\\embed_nodes.py | `http://localhost:11434` -> `http://192.168.100.16:11434` | 1 |
| C:\\AI_AGENT\\aast-ai-agent-main\\backend\\rag_system\\phase4_llm_answer_engine.py | `http://localhost:11434` -> `http://192.168.100.16:11434` | 1 |
| C:\\AI_AGENT\\aast-ai-agent-main\\backend\\services\\neo4jcontext.js | `http://localhost:11434` -> `http://192.168.100.16:11434` | 1 |
| C:\\AI_AGENT\\aast-ai-agent-main\\frontend\\multimodal\\reasoning\\gemma_client.py | `http://localhost:11434` -> `http://192.168.100.16:11434` | 1 |
| C:\\AI_AGENT\\aast-ai-agent-main\\frontend\\multimodal\\vision\\llava_client.py | `http://localhost:11434` -> `http://192.168.100.16:11434` | 1 |
| C:\\AI_AGENT\\aast-ai-agent-main\\replace.js | `http://localhost:11434` -> `http://192.168.100.16:11434` | 2 |
| C:\\AI_AGENT\\launcher\\start_platform.ps1 | `http://localhost:11434` -> `http://192.168.100.16:11434` | 5 |
| C:\\AI_AGENT\\multimodal\\reasoning\\gemma_client.py | `http://localhost:11434` -> `http://192.168.100.16:11434` | 1 |
| C:\\AI_AGENT\\multimodal\\vision\\llava_client.py | `http://localhost:11434` -> `http://192.168.100.16:11434` | 1 |

## Post-Edit Verification

- Edited-file scan for `localhost:11434`, `127.0.0.1:11434`, `host.docker.internal:11434`, and `192.168.1.130:11434`: no matches.
- Target endpoint appears in edited files at the expected endpoint/default assignment lines.
- `docker compose config` renders `OLLAMA_BASE_URL: http://192.168.100.16:11434` for both configured Ollama consumers.

