# Final Remote Gemma Verdict

Audit date: 2026-06-21  
Repository root: `C:\AI_AGENT`  
Branch observed: current checked-out branch, `recovery-baseline`  
Mode: read-only audit.

## Final Verdict

Remote Gemma migration readiness: PARTIAL.

The active Docker backend can call remote Ollama through `OLLAMA_BASE_URL`. However, the current architecture does not isolate Gemma generation from all other Ollama usage. The same `OLLAMA_BASE_URL` is also used for KG embeddings with `nomic-embed-text`. Therefore, moving only `gemma4:e2b` to Machine B is not fully proven safe. Moving the Ollama endpoint to Machine B is code-compatible if Machine B serves every Ollama model the active paths need.

## 1. Can Gemma be moved to a remote machine?

PARTIAL.

Evidence for YES:

- `docker-compose.yml:41` parameterizes backend `OLLAMA_BASE_URL`.
- `llmConfig.js:46-59` builds `/api/generate` and `/api/tags` from `OLLAMA_BASE_URL`.
- `ollamaService.js:369-380` sends generation requests to that configured URL.
- `unifiedAnswerService.js:423-456` reaches Gemma through `ollamaService`.

Evidence for PARTIAL:

- `neo4jcontext.js:27-35` uses the same `OLLAMA_BASE_URL` for `/api/embeddings` with `nomic-embed-text`.
- Machine B target list names Ollama and `gemma4:e2b`, but not `nomic-embed-text`.

Conclusion:

Gemma generation can move. The full current architecture is only proven safe if the remote Ollama endpoint also supports the embedding model used by KG retrieval.

## 2. Can Machine A continue running all services?

YES, for the Docker Compose services.

Evidence:

- Compose keeps backend, frontend, Neo4j, Qdrant, decision-api, rag-retriever, and rag-answer as local services.
- Internal service URLs remain Docker service names: `decision-api`, `rag-retriever`, `rag-answer`, `neo4j`, and `qdrant`.
- No service has GPU device configuration in Compose.
- RAG retriever is CPU configured and running with `RAG_EMBEDDING_DEVICE=cpu`.

NOT PROVEN:

- Actual network reachability from Machine A Docker containers to a real Machine B endpoint.

## 3. Will Neo4j/Qdrant be affected?

Neo4j service: NO direct service/storage impact proven.  
Qdrant service: NO direct service/storage impact proven.  
KG semantic retrieval over Neo4j: PARTIAL.

Evidence:

- Neo4j remains `bolt://neo4j:7687`.
- Qdrant remains `qdrant:6333`.
- `neo4jcontext.js:27-35` calls remote/local Ollama embeddings through `OLLAMA_BASE_URL`.

Conclusion:

Neo4j and Qdrant containers can stay on Machine A. Knowledge retrieval that depends on Ollama embeddings can be affected unless remote Ollama serves `nomic-embed-text`.

## 4. Will RAG retrieval be affected?

NO for the RAG Retriever service.

Evidence:

- `phase3_retriever.py:41-48` uses `BAAI/bge-m3`, CPU device by env.
- `Dockerfile.retriever:14` installs CPU-only PyTorch.
- Running rag-retriever env showed `RAG_EMBEDDING_DEVICE=cpu`.
- `docker-compose.yml:117-121` points retriever to local Qdrant and CPU embedding device.

RAG Answer generation:

- Current runtime: not affected because `RAG_ANSWER_ENGINE_ENABLED=false`.
- If enabled, it uses `OLLAMA_BASE_URL` and would call Machine B.

## 5. Will Decision API be affected?

NO direct effect proven.

Evidence:

- Decision API Compose env has `DECISION_GEMINI_ENABLED=false`.
- Backend decision LLM extraction is disabled by `DECISION_LLM_EXTRACTION_ENABLED=false`.
- Decision API URL remains `http://decision-api:8005`.

Conditional:

- If backend decision LLM extraction is enabled later, it routes through central `ollamaService`, so it would use remote `OLLAMA_BASE_URL`.

## 6. Will Query Classification be affected?

NO for the current runtime.

Evidence:

- Running backend env has `LLM_INTENT_ENABLED=false`.
- `orchestrator.js:500-514` shows the optional LLM intent path would use `generateStableResponse()` and `PRIMARY_MODEL`, but this path is disabled live.

Conditional:

- If LLM intent is enabled later, query classification would depend on remote Ollama.

## 7. Will Knowledge Exploration be affected?

PARTIAL.

Evidence:

- Knowledge graph storage and Neo4j service remain local.
- KG semantic embedding calls use `${OLLAMA_BASE_URL}/api/embeddings`, model `nomic-embed-text`.
- Graph refine and safe reformat Gemma calls are live-disabled by `KG_GRAPH_REFINE_ENABLED=false`, `KG_SAFE_REFORMAT_ENABLED=false`, and single-Gemma mode.

Conclusion:

Knowledge exploration can be affected through embeddings, not through Neo4j storage. If remote Ollama lacks `nomic-embed-text`, semantic KG retrieval can fail or degrade.

## 8. What exact config changes are required?

Required for Docker Compose remote Ollama:

- The Compose interpolation value for `OLLAMA_BASE_URL` must become `http://REMOTE_IP:11434`.

Evidence:

- `docker-compose.yml:41` backend uses `${OLLAMA_BASE_URL:-http://host.docker.internal:11434}`.
- `docker-compose.yml:154` rag-answer uses the same interpolation.
- Root `C:\AI_AGENT\.env` is absent.
- `aast-ai-agent-main\backend\.env` contains `OLLAMA_BASE_URL=http://localhost:11434`, but rendered/running Compose currently overrides it with `host.docker.internal`.

Therefore:

- Changing only `aast-ai-agent-main\backend\.env` is NOT PROVEN sufficient for Docker Compose.
- The value must be supplied where Docker Compose interpolation reads it, such as the shell environment or a root Compose `.env` file.

Required remote model availability:

- `gemma4:e2b` for primary final synthesis.
- `nomic-embed-text` for KG embeddings if KG semantic retrieval is required.
- `tinyllama:latest` only if the configured Ollama backup model is expected to be available; missing backup is degraded/nonfatal when primary is installed, based on startup validation logic.

No config change required by evidence:

- Neo4j URI.
- Qdrant host/port.
- RAG Retriever device.
- Decision API URL.
- Frontend routing.

## 9. What exact risks remain?

| Risk | Status | Evidence |
|---|---|---|
| Remote Machine B reachability from Docker containers | NOT PROVEN | No remote endpoint was tested. |
| Remote Ollama bind/firewall allows Machine A access | NOT PROVEN | Outside repo/runtime config. |
| Remote `gemma4:e2b` generation succeeds | NOT PROVEN | Current audit did not test remote model generation. |
| Remote `nomic-embed-text` installed | NOT PROVEN | Required by `neo4jcontext.js:27-35`, not listed in target Machine B model list. |
| KG retrieval after `OLLAMA_BASE_URL` move | PARTIAL | Depends on remote embeddings. |
| RAG retrieval after move | LOW RISK by evidence | Uses CPU SentenceTransformer and Qdrant, not Ollama. |
| RAG Answer if enabled later | PARTIAL | It uses remote `OLLAMA_BASE_URL`; currently disabled. |
| Launcher-based startup | BLOCKER for remote without launcher changes | `launcher\start_platform.ps1:746` sets localhost. |
| Local process telemetry | WARNING | `gemmaTelemetryService` polls local `ollama`/`llama-server` processes, not remote machine memory. |
| Metrics/failover accuracy under network latency | PARTIAL | Timeouts and circuit exist, but real remote latency is untested. |

## 10. What is the probability of successful migration?

Code/config-only probability: 70%.

Live runtime probability with the actual Machine B: NOT PROVEN.

Reason for 70%:

- Positive evidence: active Docker backend and rag-answer Ollama calls are parameterized through `OLLAMA_BASE_URL`.
- Positive evidence: Machine A services do not require local GPU.
- Negative evidence: KG embeddings also move to remote Ollama and require `nomic-embed-text`.
- Negative evidence: current live Compose value is still `host.docker.internal`.
- Negative evidence: launcher and offline scripts still hardcode localhost.
- Unknown evidence: no live remote `/api/tags`, `/api/generate`, or `/api/embeddings` proof exists in this audit.

## Final Answer

Can Gemma be moved to a remote machine without breaking the current architecture?

PARTIAL.

It is safe by source/config evidence for backend Gemma generation to use remote Ollama through `OLLAMA_BASE_URL`. It is not fully proven safe for the whole current architecture unless the remote Ollama endpoint also supports the non-Gemma Ollama dependency used by KG embeddings: `nomic-embed-text`.

No recommendations were added. No fixes were applied.
