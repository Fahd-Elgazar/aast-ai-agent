# Image Freshness Report

Generated: 2026-06-20 14:27:15 +03:00

## Method
Compared Docker image creation dates, current source modification times, container/source hashes where directly available, and source mount mode. Because source is not bind-mounted, any source change after image build requires rebuild/recreate before it can be active.

| Service | Image | Image Created | Latest Relevant Source Evidence | Verdict | Evidence |
|---|---|---|---|---|---|
| backend | aast-ai-agent/backend:local | 2026-06-17 18:16:54 +0300 | backend source files modified 2026-06-20 13:47; host/container hashes differ; runtimeMode.js missing in container | STALE | baked image, no bind mount |
| frontend | aast-ai-agent/frontend:local | 2026-05-23 17:18:54 +0300 | frontend source files modified 2026-05-24/25 after image build | STALE | baked nginx image, no bind mount |
| decision-api | aast-ai-agent/decision-api:local | 2026-05-23 17:40:39 +0300 | decision source and env modified 2026-06-20 13:41/13:42 | STALE | baked image, no source bind mount |
| rag-retriever | aast-ai-agent/rag-retriever:local | 2026-06-17 20:23:31 +0300 | shared rag_system file phase4_llm_answer_engine.py modified 2026-06-20; retriever own phase3_retriever.py not newer in observed list | PARTIAL/STALE RISK | image not refreshed after shared context changed; rebuild safest if context is shared |
| rag-answer | aast-ai-agent/rag-answer:local | 2026-05-23 17:48:34 +0300 | phase4_llm_answer_engine.py modified 2026-06-20 13:36 | STALE | baked image, no bind mount |
| neo4j | neo4j:5.26-community | official image | no project source code baked | UP TO DATE / NOT APPLICABLE | service code is external official image; data volume only |
| qdrant | qdrant/qdrant:v1.12.5 | official image | no project source code baked | UP TO DATE / NOT APPLICABLE | service code is external official image; data volume only |

## Overall
Project-built service images are not current with the source tree. Backend is definitively stale by content hash, not only timestamp.
