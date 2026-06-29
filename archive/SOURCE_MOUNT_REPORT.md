# Source Mount Report

Generated: 2026-06-20 14:25:39 +03:00

## Finding
No `aast-ai-agent` service bind-mounts live application source code from `C:\AI_AGENT\aast-ai-agent-main`. Application code is baked into images. Volumes are only for data, logs, or caches.

| Service | Container | Source Mode | Exact Code/Data Path | Bind Mounts | Named Volumes |
|---|---|---|---|---|---|
| backend | aast-ai-agent-backend-1 | B: baked Docker image code | C:\AI_AGENT\aast-ai-agent-main\backend -> /app at image build | none | aast-ai-agent_backend_logs:/app/logs<br>aast-ai-agent_backend_data:/app/data |
| decision-api | aast-ai-agent-decision-api-1 | B: baked Docker image code | C:\AI_AGENT\college-decision-system-backend -> /app at image build | none | aast-ai-agent_decision_data:/app/runtime<br>aast-ai-agent_decision_whisper_cache:/root/.cache/whisper |
| frontend | aast-ai-agent-frontend-1 | B: baked Docker image code | C:\AI_AGENT\aast-ai-agent-main\frontend -> compiled into nginx image at image build | none | none |
| neo4j | aast-ai-agent-neo4j-1 | B: baked Docker image code | official image only; project volumes for data/log/import/plugins | none | aast-ai-agent_neo4j_data:/data<br>aast-ai-agent_neo4j_logs:/logs<br>aast-ai-agent_neo4j_plugins:/plugins<br>aast-ai-agent_neo4j_import:/var/lib/neo4j/import |
| qdrant | aast-ai-agent-qdrant-1 | B: baked Docker image code | official image only; project volume for /qdrant/storage | none | aast-ai-agent_qdrant_data:/qdrant/storage |
| rag-answer | aast-ai-agent-rag-answer-1 | B: baked Docker image code | C:\AI_AGENT\aast-ai-agent-main\backend\rag_system -> /app at image build | none | none |
| rag-retriever | aast-ai-agent-rag-retriever-1 | B: baked Docker image code | C:\AI_AGENT\aast-ai-agent-main\backend\rag_system -> /app at image build | none | aast-ai-agent_rag_hf_cache:/root/.cache/huggingface<br>aast-ai-agent_rag_torch_cache:/root/.cache/torch |
