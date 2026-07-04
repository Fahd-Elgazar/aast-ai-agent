# RAG and Codebase Recovery Report

Date: 2026-07-04 (Africa/Cairo)

## Outcome

- Canonical recovered workspace: `C:\AI_AGENT`
- Safety backup: `C:\AI_AGENT_SAFETY_BACKUP_20260704-155858`
- Recovery branch: `recovery/docker-preserved-20260704`
- Last implementation commit: `f7bf3fd8`
- All seven `aast-ai-agent` Docker services are healthy.
- The exact regression query, `how to apply merit scolarship?`, returns HTTP 200 through route `HYBRID`, source `RAG_DIRECT`, confidence `0.89`, in 3.249 seconds in the final proof.
- No database or user-data volume was reset, deleted, or re-ingested.

## Root cause

The scholarship record was present in Qdrant. Retrieval failed because the BGE-M3 embedding model was lazy-loaded on CPU with one thread while the backend allowed only 20 seconds. Real searches took about 23-50 seconds, timed out, and three timeouts opened the shared RAG circuit breaker. The health check still appeared healthy because it checked Qdrant connectivity but did not require the embedding model to be loaded.

The exact query was then blocked from RAG, while the knowledge graph had no matching application-step record, producing `Insufficient verified academic evidence`.

## Changes

1. Load and warm BGE-M3 during retriever startup.
2. Require the embedding model to be loaded before RAG reports healthy.
3. Use four CPU threads for embedding and increase RAG cold/warm timeout budgets.
4. Disable synthetic health searches by default so health probes cannot poison the production circuit breaker.
5. Preserve scholarship intent during query simplification instead of rewriting `apply` as generic admission requirements.
6. Add scholarship-specific fallback retrieval.
7. Build a deterministic, evidence-bound partial answer for scholarship application questions. It reports the verified eligibility criteria and explicitly says that the records do not contain submission steps.
8. Bypass Gemini/Gemma for this deterministic answer so rate limits or slow generation cannot turn a successful retrieval into another timeout.

## Final verification

- Backend health: HTTP 200.
- RAG status: `HEALTHY`.
- Retriever embedding: `BAAI/bge-m3`, eager, loaded, four threads.
- RAG circuit breaker: `CLOSED`, zero failures.
- Qdrant collection: `aast_academic_rag_production`, green, 184 points, vector size 1024.
- Neo4j: 144 nodes and 254 relationships.
- Direct warm retriever tests: approximately 0.14-0.18 seconds.
- Five repeated end-to-end scholarship regression tests passed.
- Final exact-query proof: 3.249 seconds.
- NLP teacher, Mobile Computing teacher, NLP syllabus, and contextual week-four questions were regression-tested.
- Promoted container copies of `ragService.js`, `unifiedAnswerService.js`, `orchestrator.js`, `queryShape.js`, and `phase3_retriever.py` match the recovered source by normalized SHA-256.
- JavaScript syntax and Git whitespace checks passed.

## Codebase recovery status

| Area | Status | Evidence |
|---|---|---|
| Backend | Recovered and proven | Newer Docker runtime files were reconciled into Git; promoted runtime matches source. |
| RAG retriever | Fixed and proven | Source/runtime match; exact query and repeated retrieval tests pass. |
| RAG answer service | Recovered | Preserved source archive and rollback image exist. |
| Decision API | Recovered and proven | 102 of 102 common Python files match the preserved Docker source. |
| Neo4j and Qdrant | Preserved and proven | Verified volume archives plus healthy live services. |
| Frontend runtime | Preserved and healthy | Exact live image and compiled `dist` archive are saved. |
| Frontend latest source parity | PARTIAL / Not Proven | GitHub source builds successfully, but the rebuilt JavaScript bundle is not identical to the live Docker bundle. The known-good live frontend was not replaced. |

The Docker stack is now launched from `C:\AI_AGENT\docker-compose.yml`. The recovered Git branch is based on the remote branch `origin/codex/github-backup-20260629-pre-gemini-test`, but the recovery branch is currently local-only. GitHub publication was not bypassed because GitHub CLI is not installed.

## Recovery commits

- `22bcc638` - Recover newer backend runtime from preserved Docker image
- `070f7a10` - Fix RAG readiness and scholarship retrieval
- `f7bf3fd8` - Bypass LLM for grounded scholarship application answers

Patch files for these commits are under:

`C:\AI_AGENT_SAFETY_BACKUP_20260704-155858\final_git_patches`

## Safety backups

Rollback image tags:

- `aast-ai-agent-recovery/backend:20260704-pre-rag-recovery`
- `aast-ai-agent-recovery/frontend:20260704-pre-rag-recovery`
- `aast-ai-agent-recovery/decision-api:20260704-pre-rag-recovery`
- `aast-ai-agent-recovery/rag-retriever:20260704-pre-rag-recovery`
- `aast-ai-agent-recovery/rag-answer:20260704-pre-rag-recovery`
- `aast-ai-agent-recovery/neo4j:20260704-pre-rag-recovery`
- `aast-ai-agent-recovery/qdrant:20260704-pre-rag-recovery`

Verified source archives:

| Archive | SHA-256 |
|---|---|
| `backend-source.tgz` | `C74EAA18794967C256F23D5817A2BFEC00865318785B7436D9845C2A7FEECCC4` |
| `decision-source.tgz` | `2906898F643162D6CFA69F60F3ED502EFCFEC14C45CB613543CA9065657C91B2` |
| `frontend-dist.tgz` | `86F7701D214841C8D5B35D620E7E45304CE65AC1097088AEE9C0AF08B9F013D8` |
| `rag-answer-source.tgz` | `EEFAF794A0EC66B8B0A1A5B5FE85DE9CEAB801921C9421F7170F6F665854356C` |
| `rag-retriever-source.tgz` | `1559F6D27F046237C5C298E57C5C8F30BFC3910D19F271A29F150B33CDD78086` |

Verified data-volume archives:

| Volume archive | SHA-256 |
|---|---|
| `aast-ai-agent_backend_data.tgz` | `C65B24F0456DD0A10FAA2E6ACFCAAC88C5536A1A1D861CBA7D68A62E214EE964` |
| `aast-ai-agent_backend_logs.tgz` | `CB7F4B90E98A69C1950B8ABF3E2CE69C8FF8B74A918239B7D3DECFE1079E4E76` |
| `aast-ai-agent_decision_data.tgz` | `F3346334F8C0CFBAD2EDF8CCC8A5A0250A2A4767D0DBC1E8EB36725D072B220F` |
| `aast-ai-agent_neo4j_data.tgz` | `F25CE49FD4D987AE2669DE39CE1231170050CB7C637C1BDDB370B4CC7020E2C5` |
| `aast-ai-agent_neo4j_import.tgz` | `D52DFC156489CB6EC13069B901FCBCC8E4F943D857B775133ED0DD3B8BC130ED` |
| `aast-ai-agent_neo4j_logs.tgz` | `DA0FFF2F48D32486E4E79F86BEC1528F5C365765892E2D38E46E13C28451B97B` |
| `aast-ai-agent_neo4j_plugins.tgz` | `41F937A271CA429A6299F94A4A09833B4C1C8CCF87F1371F0AF6DC991D5F9C10` |
| `aast-ai-agent_qdrant_data.tgz` | `2C7E956ACB10FC32F765B16BB6F39BAFC1A9A21DFD9BB4F51E56385078A47E1C` |

Recovered environment files are stored under `recovered_env` in the safety-backup directory and remain Git-ignored. Their contents are intentionally not recorded here.

## Rollback

The following restores the pre-fix backend and retriever images without touching data volumes:

```powershell
docker tag aast-ai-agent-recovery/backend:20260704-pre-rag-recovery aast-ai-agent/backend:local
docker tag aast-ai-agent-recovery/rag-retriever:20260704-pre-rag-recovery aast-ai-agent/rag-retriever:local
docker compose --project-directory C:\AI_AGENT --env-file C:\AI_AGENT\.env -f C:\AI_AGENT\docker-compose.yml up -d --no-deps --force-recreate rag-retriever backend
```

Do not delete `C:\AI_AGENT_SAFETY_BACKUP_20260704-155858` until the recovery branch has been pushed and independently backed up. The C drive had only about 3.3 GB free at final verification, so avoid large rebuilds or cache downloads until disk space is increased.
