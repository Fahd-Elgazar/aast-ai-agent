# Repository and runtime audit

**Stage A · 19 November 2026**

| Evidence | Observation | Qualification |
|---|---|---|
| `git rev-parse --show-toplevel HEAD` | the source worktree at `6367b0df91f208e518fb7e04cd7c81bdb82b9ae4`, branch `unified-platform`. Artifacts are under the open materials workspace the separate audit workspace. | Integrated source authority. The open materials folder is outside this checkout. |
| `git --no-optional-locks status --short --branch` | 48 pre-existing modified tracked Markdown files, 10 untracked documentation items, one a PDF. No tracked implementation edits at start. | Preserve all existing paths. No branch switch, commit or reset. |
| `git worktree list` and `git for-each-ref` | Older private tree at `3e2f0100`, July integration at `8a2cb60a`, and separate August conversation `70a7652e`, cancellation `5e144b7d`, admission `8a9ea398`, dependencies `fb1dc366`, frontend `5a8d857a`, Decision `b3ee4fec` and RAG `789e6264`. Local remote-tracking `origin/main` is `3e2f0100`. | No claim that these refs exist on the other machine. Decision/RAG patches already transferred in part. Local branch reconciliation record |
| `git log -9` | `6367b0df` Qdrant volume lock, `54a41fe8` readiness, `80aa3b5c` private corpus prep, `05a63fb5` explicit ingestion, `e9885eb3` Decision envelope, `75a2d7b3` and `f133c052` RAG readiness, `04a3fd39` env templates, `12423829` release notes. All dated 9 August. | Demo tags `demo-phase-0.5-approved-20260725` and `demo-safety-freeze-20260725` recorded. |
| `docker version`, `docker compose version` | CLI and daemon 28.5.1, Compose 2.40.0-desktop.1. July appliance running and reporting healthy. | Previous WSL VHDX failure is historical. Current discovery succeeded without repairs or restart. |
| Selected `docker inspect` fields | Appliance image `aast-ai-agent/appliance:local`, ID `sha256:13b75b6fd0ed9c841d121e4d35ce96e883e18be9e3d12031b9b6af732ac08257`, OCI revision `4a38cf5f9969e893cf04a39e1306a74cc8fbe939`. One host loopback frontend port 5173, Compose default network and 11 mounted volumes. | Live runtime differs from integrated source. Container inspection used an allowlist with no environment or volume host paths published. |
| Hardware | 12 logical processors, 15.23 GiB installed RAM, about 1,007 MiB free, about 2,333 MiB free on C:, RTX 4050 with 6,141 MiB total and 2,437 MiB free at measurement. Appliance used 1.594 GiB of its 3.824 GiB allocation. | Sequential diagnostic traffic. No second heavy stack or model download. |
| Native environment | Node 22.21.0, npm 10.9.4, Python 3.10.10. Local dependencies exist for integrated frontend/backend. No Claude CLI was found via `Get-Command`. | Independent Claude review is a teammate handoff. No executed review is attributed to Claude in this run. |

## Topology and health

The running appliance is a single Docker container whose Supervisor units run all seven local components. Its effective port bindings were read from Docker. Separate Decision containers also run on this host. The advisor health probe points at the **internal** Decision process, so these should be treated as distinct deployments. Ollama is configured outside the supervised processes and is reached by the advisor’s provider health probe. Public and internal host/secret values are excluded.

| Component | Local appliance observation | Role, dependencies and startup |
|---|---|---|
| Nginx and React | Supervisor `nginx RUNNING`, root HTTP 200 on port 5173. | Serves built UI and proxies advisor requests to internal Express port 8004. Standalone compose declares frontend dependency on backend. |
| Express advisor | Supervisor `backend RUNNING`, proxied `/api/health` 200 and `ok=true`. | Routes advisor requests, auth, conversations and Decision proxies. Startup waits for Decision and RAG readiness. Hardness of a dependency varies by route. |
| Neo4j | Supervisor `neo4j RUNNING`, internal browser endpoint 7474 returned 200, advisor’s KG health returned OK. | Bolt on internal port 7687. Graph data, import, logs and plugins have dedicated mounts. Graph-backed answers depend on evidence and index readiness. |
| Qdrant | Supervisor `qdrant RUNNING`, internal `/readyz` on port 6333 returned 200. | Persistence is a mounted storage volume. Retriever startup waits for Qdrant. The standalone manifest pins v1.12.5. |
| Retriever | Supervisor `rag-retriever RUNNING`, internal port 8001 `/health` 200, advisor `rag.ok=true`. | FastAPI plus BGE-M3 and Qdrant. Retriever maintains initialization/readiness logic and persists model caches in dedicated volumes. |
| RAG answer | Supervisor `rag-answer RUNNING`, internal port 8002 `/health` 200. | Deployable separate answer service. Its presence alone cannot prove use by the main advisor query. Depends on retriever. |
| Decision API | Supervisor `decision-api RUNNING`, internal port 8005 `/health` 200 and advisor probe OK. Separate host port 8000 also gave 200. | FastAPI with SQLite-backed catalogs, its own persistence and optional voice resources. Platform route only needs it for Decision behavior. |
| Ollama | Advisor `ollama.ok=true`. No Supervisor model unit. | Model connectivity and circuit details surface in advisor health. Default integrated model is `gemma4:e2b` and effective provider is route-dependent. |
| Redis | No service in either checked-in main Compose manifest. | Advisor uses in-process intent/golden caches plus file-backed conversation state. |

Sources: `docker-compose.yml:4–252`, `docker-compose.appliance.yml:4–115`, `appliance/nginx.conf:26,35`, `appliance/run-service.sh:29–41`, `appliance/supervisord.conf:18–106`. Startup gate verification is read-only. Container units share one appliance image ID, so there is no separate runtime Docker tag per process. The app health checks and internal readiness probes complement process status. [Actual architecture](02_ACTUAL_ARCHITECTURE_AND_DATAFLOW.md)

## Source layout and baseline

- React client, lockfile and scripts are at `aast-ai-agent-main/frontend`. Node orchestrator, package lock, API/service code and engineering tests are at `aast-ai-agent-main/backend`. Python refinement, ingest, retriever and answer engines are at `backend/rag_system`.
- FastAPI application, Alembic, delivery gate and fixtures are at `college-decision-system-backend`. `appliance`, `launcher` and root Compose manifests cover two deployment topologies. `.env.docker.example` and both services’ *.example files define documented keys. `.github/workflows/ci.yml` wires Node and Python jobs.
- `evaluation/contracts/retrieval` defines evidence/schema artifacts. `project_management`, `reliability-audit` and `docs/stabilization` preserve diagrams, tests and operational history. VR is documented externally in thesis/deck materials. No client connector was identified in the integrated production tree. Avoid inferring runtime use from historical documentation.
- Native Node and React gates, Python RAG checks and the hermetic Decision delivery checks passed before and after the scoped cleanup. [Cleanup verification](14_CLEANUP_VERIFICATION_REPORT.md). Live application outputs are captured separately against the July OCI revision. The new suite is a targeted advisor diagnostic. The historical 470-query study is outside its scope.

## Recoverable branch work

`git cherry HEAD <ref>` compared patch IDs as of the integrated baseline. A unique patch ID is an inventory lead. It cannot prove semantic changes are absent from integrated or subsequent squashed commits.

| Branch | Patch comparison | Recovery guidance |
|---|---|---|
| `stabilize/conversation-routing` | Nine unique patches. They cover health arbitration, follow-ups, entity collision, scholarship meaning, context deduplication, graph chains, unhealthy split branches and adversarial corrections. | T-10, T-20, T-21, T-30 and T-31 review by file/behavior. R01 persists on the branch tip. |
| `stabilize/request-cancellation` and `stabilize/admission-control` | Two plus one unique patches. Cancellation `f99d7eeb` and `5e144b7d`, admission `8a9ea398`. | T-60 checks client abandon, capability probes and fixture capacity together before selecting changes. |
| `stabilize/dependency-security` | One unique patch `fb1dc366`. | T-00 compares manifests and lockfiles before proposing separate dependency work. |
| `stabilize/frontend-correctness` | Two unique plus one equivalent. State and response consumption `f2468ded`, `5a8d857a`. | T-11/T-41 review only applicable browser behavior, then use test cases to confirm material differences. |
| `stabilize/decision-truth` and `stabilize/rag-readiness` | Three and two equivalent patches respectively, zero unique by patch ID. | T-02 starts on integrated truth/readiness tests. Branch replay would duplicate equivalent patches. |

Local worktree and branch references were identified and left in place. No commit status on either developer's remote has been inferred. [Work split](17_TWO_DEVELOPER_WORK_SPLIT.md) · [Open decisions](19_OPEN_DECISIONS_AND_BLOCKERS.md)
