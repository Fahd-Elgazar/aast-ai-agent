# Full Infrastructure Recovery Audit

Generated: 2026-06-22T02:22:00+03:00  
Authoritative workspace: `C:\AI_AGENT`  
Evidence directory: `C:\AI_AGENT\runtime_validation_tmp\full_recovery_20260622-013716`  
Fresh backup directory: `C:\AI_AGENT\docker_volume_backups\20260622-013716`

## Executive Summary

System Ready: NO  
Confidence: 90%

The canonical Docker stack was recovered from `C:\AI_AGENT\docker-compose.yml`, and all seven canonical services are currently healthy: `frontend`, `backend`, `decision-api`, `neo4j`, `qdrant`, `rag-retriever`, and `rag-answer`.

Qdrant is valid and contains the expected production collection `aast_academic_rag_production` with 184 points and 1024-dimensional vectors. The RAG retriever and decision/career engines are reachable and returned controlled results.

The original Neo4j graph was not recovered. Every Neo4j candidate failed the required isolated validation gates. Production Neo4j currently has 0 nodes, 0 relationships, no labels, and no relationship types. No candidate was promoted to production.

Chat history storage was audited before any persistence patch. No active chat-history failure was reproduced. Backend routes, frontend conversation API calls, backend file persistence, and the `backend_data` volume all passed runtime verification. No storage patch was applied.

The final readiness blocker is Neo4j graph integrity. Graph-dependent queries either fail safely, return no verified curriculum information, or rely on controlled/static fallbacks instead of recovered production graph evidence.

## Command And Evidence Ledger

All detailed command output is stored in `C:\AI_AGENT\runtime_validation_tmp\full_recovery_20260622-013716`.

Key evidence files:

| Evidence | File |
|---|---|
| Git status baseline | `git-status.txt` |
| Canonical compose rendering | `docker-compose-config.txt` |
| Compose status baseline | `docker-compose-ps-a.txt` |
| Container labels baseline | `docker-inspect-labels.txt` |
| Host listeners baseline | `host-listeners.txt` |
| Neo4j baseline count | `neo4j-baseline-counts.txt` |
| Volume backup log | `volume-backup.log` |
| Backup inventory | `backup-inventory.txt` |
| Neo4j candidate logs | `neo4j-candidate-validation.txt`, `neo4j-dump-candidate-validation.txt` |
| Neo4j final candidate summary | `neo4j-candidate-summary-final.txt` |
| Qdrant validation | `qdrant-production-verification.txt` |
| Canonical stack recreate | `canonical-stack-up.txt` |
| Runtime wiring | `runtime-wiring-validation.txt`, `final-health-and-runtime.json` |
| Final Docker status | `final-docker-ps.txt` |
| Final compose labels | `final-compose-labels.txt`, `final-compose-labels.json` |
| Final Neo4j exact queries | `final-neo4j-exact-queries.txt` |
| Final query tests | `final-query-*.json`, `final-query-clean-summary.txt` |
| Chat history runtime validation | `chat-history-validation.txt`, `conversation-volume-node-check-after.txt` |
| Chat API compatibility audit | `chat-api-compatibility-final.txt`, `frontend-bundle-api-string-check.txt` |

Representative command classes executed and recorded:

- `git status --short`
- `docker compose -f C:\AI_AGENT\docker-compose.yml config`
- `docker compose -f C:\AI_AGENT\docker-compose.yml ps -a`
- `docker inspect` for compose labels and canonical working directory
- Host listener checks for exposed ports
- Read-only Docker volume tar backups into `C:\AI_AGENT\docker_volume_backups\20260622-013716`
- Isolated Neo4j candidate container restores using temporary volumes and non-production containers
- Required Neo4j Cypher validation queries:
  - `MATCH (n) RETURN count(n);`
  - `MATCH ()-[r]->() RETURN count(r);`
  - `CALL db.labels();`
  - `CALL db.relationshipTypes();`
- `docker compose -f C:\AI_AGENT\docker-compose.yml up -d --force-recreate --no-deps qdrant`
- `docker compose -f C:\AI_AGENT\docker-compose.yml up -d --force-recreate`
- Health probes for backend, decision API, RAG retriever, RAG answer, Qdrant, frontend, and Ollama
- Backend conversation create/send/retrieve/restart/retrieve checks
- Direct Qdrant search against the RAG retriever
- Controlled backend GraphRAG, RAG, decision, and career queries

No `docker compose down -v`, Docker prune, or production volume delete operation was run.

## Backup Audit

Fresh volume backup directory:

`C:\AI_AGENT\docker_volume_backups\20260622-013716`

Backed up files:

| Backup file | Size bytes |
|---|---:|
| `aast-ai-agent_backend_data.tgz` | 35897 |
| `aast-ai-agent_backend_logs.tgz` | 12753 |
| `aast-ai-agent_decision_data.tgz` | 202769 |
| `aast-ai-agent_decision_whisper_cache.tgz` | 87 |
| `aast-ai-agent_neo4j_data.tgz` | 545451 |
| `aast-ai-agent_neo4j_import.tgz` | 89 |
| `aast-ai-agent_neo4j_logs.tgz` | 196913 |
| `aast-ai-agent_neo4j_plugins.tgz` | 87 |
| `aast-ai-agent_qdrant_data.tgz` | 2124314 |
| `aast-ai-agent_rag_hf_cache.tgz` | 2661459233 |
| `aast-ai-agent_rag_torch_cache.tgz` | 87 |

Backup result: PASS

## Docker Audit

Canonical compose file:

`C:\AI_AGENT\docker-compose.yml`

Canonical services:

- `frontend`
- `backend`
- `decision-api`
- `neo4j`
- `qdrant`
- `rag-retriever`
- `rag-answer`

Final Docker status:

| Service | Final status |
|---|---|
| `frontend` | Up, healthy |
| `backend` | Up, healthy |
| `decision-api` | Up, healthy |
| `neo4j` | Up, healthy |
| `qdrant` | Up, healthy |
| `rag-retriever` | Up, healthy |
| `rag-answer` | Up, healthy |

Final compose label proof:

Every final container reported:

- `com.docker.compose.project.config_files=C:\AI_AGENT\docker-compose.yml`
- `com.docker.compose.project.working_dir=C:\AI_AGENT`

Docker audit result: PASS

## Neo4j Audit

Production Neo4j final exact query results:

```text
QUERY: MATCH (n) RETURN count(n);
count(n)
0

QUERY: MATCH ()-[r]->() RETURN count(r);
count(r)
0

QUERY: CALL db.labels();

QUERY: CALL db.relationshipTypes();
```

Required promotion gates:

- Node count > 100
- Relationship count > 100
- Labels include `Course`
- Labels include `Professor`
- Labels include `Facility`
- Labels include `Program`
- Relationship types exist

Final production gate result: FAIL

Candidate validation was performed in isolated temporary Neo4j containers and temporary volumes. The production volume `aast-ai-agent_neo4j_data` was not mounted during candidate testing.

Candidate decisions:

| Candidate | Type | Result | Reason |
|---|---|---|---|
| `C:\AI_AGENT\docker_volume_backups\20260622-013716\aast-ai-agent_neo4j_data.tgz` | Tar volume backup | REJECT | 0 nodes, 0 relationships, missing required labels, no relationship types |
| `C:\AI_AGENT\docker_volume_backups\20260620-144003\neo4j_data.tgz` | Tar volume backup | REJECT | 0 nodes, 0 relationships, missing required labels, no relationship types |
| `C:\AI_AGENT\aast-ai-agent-main\neo4j-data-new.dump` | Neo4j dump | REJECT | `load_failed_block_format_unavailable_in_community` |
| `C:\AI_AGENT\aast-ai-agent-main\neo4j-data.dump` | Neo4j dump | REJECT | `load_failed_block_format_unavailable_in_community` |
| `C:\AI_AGENT\aast-ai-agent-main\new4j-data2.dump` | Neo4j dump | REJECT | `load_failed_block_format_unavailable_in_community` |

Promotion performed: NO

Original graph recovery: Not Proven

Neo4j audit result: FAIL

## Qdrant Audit

Qdrant collection:

`aast_academic_rag_production`

Final collection evidence:

- Status: `green`
- Optimizer status: `ok`
- Points count: 184
- Vector size: 1024
- Distance: `Cosine`
- Payload indexes present for `source`, `quality_score`, `category`, `program_level`, `document_type`, and `priority`

Direct RAG retriever query:

`POST http://127.0.0.1:8001/search` with query `GPA probation`

Result:

- `results_count`: 2
- `avg_confidence`: 0.844
- `retrieval_confidence_level`: `HIGH`
- Top result: `Conditioned Pass Repeat Rule`
- Collection source: `CAI_rag3_cleaned.json`

Qdrant production volume was valid, so no Qdrant backup restore or re-ingest was performed.

Qdrant audit result: PASS

## Runtime Wiring Audit

Final health probes:

- Backend `/health`: `ok=true`
- Backend Neo4j connectivity: `ok=true`, but graph is empty
- Backend Ollama: `ok=true`, breaker `CLOSED`, active model `gemma4:e2b`
- Decision API `/health`: `status=ok`
- RAG retriever `/health`: `status=healthy`, `qdrant_connected=true`, embedding model `BAAI/bge-m3`
- RAG answer `/health`: `status=healthy`
- Frontend root: HTTP 200
- Ollama tags include `gemma4:e2b`, `gemma4:e4b`, `tinyllama:latest`, `nomic-embed-text:latest`, and `llava:latest`

Runtime mode:

- `runtimeModeLoaded=true`
- `singleGemmaGenerationMode=true`
- `geminiBackupEnabled=true`
- `ragAnswerEngineEnabled=false`
- `decisionLlmExtractionEnabled=false`
- `primaryModel=gemma4:e2b`
- `backupModel=tinyllama:latest`

Observed LLM behavior:

- Backend health showed Gemma primary healthy after restart.
- One controlled `NLP prerequisites?` query recorded `gemma_primary_failure_reason: Ollama returned empty response` and used `synthesis_provider=gemini_backup`.

Runtime wiring result: PARTIAL PASS

Reason: container wiring, RAG, Qdrant, decision API, frontend, and Ollama health pass; Neo4j connectivity exists but the production graph is empty.

## GraphRAG And End-To-End Validation

Controlled query summary:

| Query | Route | Evidence behavior | Result |
|---|---|---|---|
| `Who teaches NLP?` | `KG_DIRECT` | Neo4j returned no verified curriculum facts; graph nodes 0, links 0 | FAIL, safe insufficient-information answer |
| `NLP prerequisites?` | `LLM` with `RAG_DIRECT` source | Neo4j `KG_EMPTY`; RAG had 2 passages; synthesis provider `gemini_backup`; answer declared limited evidence | FAIL for KG prerequisite recovery; degraded RAG fallback |
| `Week 5 in NLP?` | `KG_DIRECT` | Neo4j returned no verified curriculum facts; graph nodes 0, links 0 | FAIL, safe insufficient-information answer |
| `Dean of College of AI?` | `KG_DIRECT` | Static golden fallback used because KG was empty; graph nodes 2, links 1 are fallback graph, not recovered production data | DEGRADED, not proof of recovered graph |
| `What happens under GPA probation?` | `RAG_DIRECT` | Qdrant/RAG returned policy evidence with confidence 0.96 | PASS for RAG retrieval |
| `What are NLP prerequisites and the GPA probation policy?` | `HYBRID` | RAG policy evidence returned, but missing information says no verified prerequisites KG evidence | PARTIAL, hybrid degraded by empty KG |
| Decision-engine profile query | `DECISION` | Deterministic decision route returned recommendation | PASS |
| `Career roadmap for AI` | `CAREER` | Deterministic career route returned roadmap | PASS |

End-to-end validation result: FAIL

Reason: required Neo4j retrieval and graph-dependent GraphRAG paths do not pass because the graph is empty.

## Chat History Audit

Files audited before any storage patch:

- `C:\AI_AGENT\aast-ai-agent-main\frontend\src\services\backendService.ts`
- `C:\AI_AGENT\aast-ai-agent-main\frontend\src\services\conversationsApi.ts`
- `C:\AI_AGENT\aast-ai-agent-main\backend\services\conversationService.js`
- `C:\AI_AGENT\aast-ai-agent-main\backend\routes\conversations.js`

Compatibility findings:

- `conversationsApi.ts` defaults to `http://localhost:8004/api` and uses `/conversations`, matching backend mount `/api/conversations`.
- `routes/conversations.js` exposes matching list, create, retrieve, title, pin, and delete routes.
- `orchestrator.js` mounts `app.use("/api/conversations", ...)` and `app.post("/api/chatbot/query", ...)`.
- `conversationService.js` persists to `process.env.CONVERSATIONS_FILE` or `../data/conversations.json`; in the backend container this is `/app/data/conversations.json`, backed by the `backend_data` volume.
- `AdvisorPage.tsx` stores the active conversation id in `advisor_active_conversation_id` and updates it from `response.cid || response.conversationId || response.conversation?.cid || activeCid`.
- Compose sets frontend `VITE_API_BASE: /api`.
- Production frontend bundle check found conversation and chatbot strings and no hard-coded `http://localhost:* /api` production API string.
- Source dev defaults in `agentService.ts`, `backendService.ts`, and `decisionApi.ts` still fall back to `http://localhost:8000/api` if `VITE_API_BASE` is unset. This is a dev-mode API mismatch risk, not the reproduced production failure.

Runtime chat persistence test:

- Created conversation via `POST /api/conversations`.
- CID: `5722323328da76e0`
- Sent `hello` through `POST /api/chatbot/query`.
- Sent follow-up `what was my previous question?`.
- Backend answered: `Your last question was: "hello"`.
- Restarted backend.
- Retrieved the same CID after restart.
- Message count after restart: 4 API-visible messages.
- Backend volume file `/app/data/conversations.json` exists and contains the CID.
- Node-based file check showed 5 stored messages including the system message.
- Final volume check showed `conversationCount=83`, `hasFinalValidation=true`, and `hasRestartTest=true`.

Failure classification:

- A) API mismatch: Not proven for production. Source contains a dev-mode default risk if `VITE_API_BASE` is unset.
- B) Persistence failure: Not proven. Persistence passed across backend restart.
- C) Volume issue: Not proven. `/app/data/conversations.json` persisted through `backend_data`.
- D) Frontend state bug: Not proven. Source active-CID logic is compatible with backend CID response fields.

Current chat history failure classification: Not reproduced / Not Proven

Storage patch applied: NO

Chat history audit result: PASS, with dev-mode API base risk noted.

## Repairs Performed

Runtime repairs and recovery actions performed:

- Created fresh backups of all named AAST Docker volumes before runtime repair.
- Recreated Qdrant from canonical compose after backup.
- Verified Qdrant production volume was valid; skipped Qdrant restore and re-ingest.
- Recreated the canonical seven-service stack from `C:\AI_AGENT\docker-compose.yml`.
- Restarted backend during the chat persistence test to verify volume-backed conversation recovery.
- Validated all Neo4j candidates in isolation and rejected all failures.

Code/storage changes performed:

- No application code patch was applied.
- No chat storage patch was applied.
- No Neo4j candidate was promoted.
- No production volume was deleted or pruned.

Report artifact created:

- `C:\AI_AGENT\FULL_INFRASTRUCTURE_RECOVERY_AUDIT.md`

## Remaining Risks

- Original Neo4j graph recovery is Not Proven.
- Production Neo4j has 0 nodes and 0 relationships.
- Required labels `Course`, `Professor`, `Facility`, and `Program` are absent.
- Relationship types are absent.
- The `.dump` candidates appear to require a Neo4j block format unavailable in the current `neo4j:5.26-community` loader path.
- GraphRAG can appear to answer some golden-path queries through controlled/static fallbacks; those answers are not proof that the production graph was recovered.
- Hybrid queries are degraded whenever they require KG evidence.
- Source dev-mode API defaults still include `http://localhost:8000/api` in some frontend services if `VITE_API_BASE` is unset.
- One controlled query used Gemini backup after Gemma returned an empty response, although backend health later reported Gemma primary healthy and breaker closed.

## Final Verdict

System Ready: NO

PASS:

- Backups completed before repair.
- Canonical Docker stack is healthy and labels point to `C:\AI_AGENT`.
- Qdrant production collection is present and valid.
- RAG retriever is connected to Qdrant and can retrieve policy vectors.
- Decision API is healthy and decision proxy works.
- Career engine deterministic route works.
- Chat history persists through backend restart.

FAIL:

- Neo4j original graph recovery failed.
- Production Neo4j graph is empty.
- Required graph labels and relationship types are absent.
- Graph-dependent GraphRAG tests fail or degrade.

Readiness blocker:

Restore a valid Neo4j graph candidate using a loader compatible with the dump format, or obtain a portable export from the original graph environment. Do not promote any future candidate unless it passes the same isolated-container gates:

```cypher
MATCH (n) RETURN count(n);
MATCH ()-[r]->() RETURN count(r);
CALL db.labels();
CALL db.relationshipTypes();
```

Required promotion result remains:

- Nodes > 100
- Relationships > 100
- Labels include `Course`, `Professor`, `Facility`, `Program`
- Relationship types exist

