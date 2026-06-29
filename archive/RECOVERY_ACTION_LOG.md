# Production Recovery Action Log

Canonical root: `C:\AI_AGENT`

Excluded roots: `C:\Users\mh978\Downloads\AI_AGENT*`

Recovery backup directory: `C:\AI_AGENT\backups\production_recovery_20260622-030748`

## Actions

- 2026-06-22 03:07: Verified canonical root exists at `C:\AI_AGENT`.
- 2026-06-22 03:07: Created timestamped recovery backup directory `C:\AI_AGENT\backups\production_recovery_20260622-030748`.
- 2026-06-22 03:07: Ensured Neo4j pre-restore backup directory exists at `C:\AI_AGENT\backups\neo4j_before_restore`.
- 2026-06-22 03:08: Captured git status from `C:\AI_AGENT`; worktree already contained many modified/untracked/deleted files before recovery work.
- 2026-06-22 03:08: Backed up root `docker-compose.yml`, `full_graph.cypher`, and `full_graph.json` into the timestamped recovery backup directory.
- 2026-06-22 03:09: Backed up nested backend/frontend files from `C:\AI_AGENT\aast-ai-agent-main`.
- 2026-06-22 03:09: Rendered Compose configuration from `C:\AI_AGENT`; build contexts point to canonical `C:\AI_AGENT` paths.
- 2026-06-22 03:09: Listed Docker containers; AAST containers were stopped at audit start.
- 2026-06-22 03:09: Started read-only Docker volume tar backups for all AAST named volumes.
- 2026-06-22 03:14: Completed AAST named-volume archives under `C:\AI_AGENT\backups\production_recovery_20260622-030748\volume_archives`.
- 2026-06-22 03:14: Completed Neo4j-specific pre-restore volume archives under `C:\AI_AGENT\backups\neo4j_before_restore\20260622-030748`.
- 2026-06-22 03:15: Attempted read-only offline `neo4j-admin database dump`; Neo4j image failed before dump because it attempted ownership changes on read-only mounts.
- 2026-06-22 03:15: Started Docker Neo4j only with `docker compose up -d neo4j`.
- 2026-06-22 03:16: Verified Docker Neo4j health reached `running healthy`.
- 2026-06-22 03:16: Recorded pre-restore Cypher probes: `0` nodes, `0` relationships, no labels, no relationship types, no user constraints.
- 2026-06-22 03:17: Copied `C:\AI_AGENT\full_graph.cypher` into Docker Neo4j import volume as `/var/lib/neo4j/import/full_graph_20260622-0316.cypher`.
- 2026-06-22 03:17: Imported `full_graph.cypher` with `cypher-shell`; command exited successfully.
- 2026-06-22 03:17: Verified restored Docker Neo4j counts: `144` nodes and `252` relationships.
- 2026-06-22 03:17: Verified required labels exist: `Professor`, `Course`, `Program`, `Department`, `College`, `Facility`, `Degree`, `CareerRole`, `GovernanceUnit`, `Policy`.
- 2026-06-22 03:18: Started Docker Qdrant with `docker compose up -d qdrant`; health reached `running healthy`.
- 2026-06-22 03:18: Verified Qdrant collection `aast_academic_rag_production` exists with `184` points, vector size `1024`, and a sampled vector length of `1024`.
- 2026-06-22 03:20: Started remaining services (`decision-api`, `rag-retriever`, `rag-answer`, `backend`, `frontend`); all containers reached healthy status.
- 2026-06-22 03:20: Verified backend `/health` returned `ok: true`; Neo4j, RAG, and Decision API healthy. Logged Gemma primary startup probe warning: `Ollama probe returned HTTP 500`, breaker `PRIMARY_COLD`, backup `tinyllama:latest` healthy.
- 2026-06-22 03:21: Ran required query suite; app-level KG retrieval failed for several queries despite restored graph facts.
- 2026-06-22 03:23: Verified direct Neo4j facts exist for NLP teaching, Machine Learning prerequisites, Deep Learning prerequisites, and Intelligent Systems courses.
- 2026-06-22 03:24: Identified missing Neo4j vector indexes expected by backend (`node_embedding_index`, `course_index`, `professor_embedding_index`, `staff_embedding_index`, `program_embedding_index`).
- 2026-06-22 03:24: Created missing Neo4j vector indexes with `IF NOT EXISTS` using 768-dimensional `embedding` properties; all vector indexes reached `ONLINE` at 100% population.
