# AAST AI Platform Production Hardening Guide

This guide documents the stabilization patch set for the local multi-service AI platform. It preserves:

- Primary model: `gemma4:e2b`
- Backup model: `tinyllama:latest`
- Retrieval model: `BAAI/bge-m3`
- Qdrant, Neo4j, Whisper, Torch, decision backend, frontend framework, routing, memory, RAG, and voice architecture

The changes are operational hardening only: lazy loading, queue safety, sequential startup, memory budgets, and telemetry.

## Migration Guide

1. Pull or keep the patched files in place.
2. Copy new environment variables from `aast-ai-agent-main/backend/.env.example` into your active `.env` files.
3. Start the platform with `start_full_project.bat` or `launcher/start_platform.ps1`.
4. Confirm:
   - `http://localhost:8004/health/enterprise`
   - `http://localhost:8005/health`
   - `http://localhost:8001/health`
   - `http://localhost:5173`

No data migration is required. No model names or databases changed.

## Deployment Guide

Recommended local boot order:

1. Ollama, then wait for `/api/tags`.
2. Qdrant, then wait for `/collections`.
3. Neo4j readiness check.
4. Decision API with `VOICE_ENABLED=true`; Whisper remains deferred.
5. Orchestrator backend.
6. RAG retriever with `RAG_EMBEDDING_INIT_MODE=lazy`; BGE-M3 remains deferred.
7. Vite frontend with `NODE_OPTIONS=--max-old-space-size=4096`.

Recommended memory defaults:

```env
GEMMA_MAX_ACTIVE_REQUESTS=1
GEMMA_QUEUE_MAX_DEPTH=24
GEMMA_WARM_POOL_INTERVAL_MS=420000
GEMMA_WARM_POOL_TIMEOUT_MS=8000
RAG_EMBEDDING_INIT_MODE=lazy
RAG_EMBED_BATCH_SIZE=4
RAG_TORCH_NUM_THREADS=1
RAG_LOW_CPU_MEM_USAGE=true
VOICE_ENABLED=true
VOICE_DEVICE=cpu
NODE_OPTIONS=--max-old-space-size=4096
```

## Local Machine Optimization

- Keep Windows pagefile system-managed or set a custom maximum at least 1.5x installed RAM.
- On 16 GB RAM, prefer a 24-32 GB maximum pagefile for local all-service development.
- On 32 GB RAM, prefer a 32-48 GB maximum pagefile when running Ollama, Qdrant, Neo4j, Vite, BGE-M3, and Whisper together.
- Start from the launcher instead of opening every service manually.
- Keep Docker Desktop, Ollama, and Neo4j running before heavy test traffic.
- Avoid running multiple Vite dev servers while Gemma is generating.
- Leave `RAG_EMBEDDING_DYNAMIC_QUANTIZE=false` unless you explicitly want to test opt-in CPU memory reduction.

## Health Telemetry Map

Primary dashboard:

```text
GET http://localhost:8004/health/enterprise
```

Expected resource fields:

- Gemma: `services.ollama.gemmaTelemetry`, `gemma_queue_depth`, `warm_pool_active`, `gemma_memory_pressure`, `startup_readiness_phase`.
- RAG: `services.rag.retriever.embedding.loaded`, `services.rag.retriever.memory`, `services.rag.telemetry`, `readiness.bge_m3_deferred`.
- Voice: `services.decisionApi.voice.whisper_loaded`, `voice.enabled`, `voice.whisper_model`, `readiness.voice_deferred`.
- Frontend: `frontend.node_options`, `frontend.vite_guidance`.
- Process RSS: `memory.process.rss_mb`, `heap_used_mb`, `heap_total_mb`.
- Bottlenecks: `diagnostics.recommendations`.

Component health endpoints:

```text
GET http://localhost:8005/health
GET http://localhost:8001/health
GET http://localhost:11434/api/tags
GET http://localhost:6333/collections
```

## Rollback Safety

These changes are config-driven. To roll back behavior without reverting code:

- Set `RAG_EMBEDDING_INIT_MODE=eager` to restore eager BGE-M3 load.
- Set `GEMMA_WARM_POOL_INTERVAL_MS=240000` and `GEMMA_WARM_POOL_TIMEOUT_MS=12000` to restore the previous warm cadence.
- Start the decision API with `VOICE_ENABLED=true`; route behavior is unchanged, Whisper still loads only on use.
- Run frontend with plain `npx vite` if you want to bypass the heap wrapper.

Full code rollback is also safe because no schema, collection, model, or route contract was removed.

## Production Notes

- Keep one Uvicorn worker for the RAG retriever on constrained Windows machines. Multiple workers duplicate the BGE-M3 model in memory.
- Keep one Uvicorn worker for the decision backend if voice is enabled. Multiple workers can duplicate Whisper after first use.
- Use `GEMMA_MAX_ACTIVE_REQUESTS=1` for local reliability; raise only after measuring Ollama RSS and timeout behavior.
- Keep `MODEL_PRELOAD_STAGGER_MS` enabled so primary and backup probes do not collide during boot.
- Treat first RAG and first voice request latency as warmup latency; subsequent calls should be used for steady-state benchmarking.

## Validation Checklist

- `node --check` passes for backend files changed in this patch.
- `python -m py_compile` passes for decision voice/settings/main files.
- `python -m py_compile rag_system/phase3_retriever.py embed_server_rag.py` passes.
- `npm run build` in `aast-ai-agent-main/frontend` completes or reports only pre-existing TypeScript issues.
- `/health/enterprise` shows Gemma queue depth, memory pressure, warm pool state, RAG state, voice state, startup phase, and recommendations.
- First text chat succeeds after Ollama readiness.
- First RAG query may be slower, then subsequent RAG queries reuse the BGE-M3 singleton.
- First voice request may be slower, then subsequent voice requests reuse the Whisper singleton.

## Resource Benchmarking Checklist

Measure before and after with the same machine load:

- Idle RSS after full launcher boot.
- Ollama RSS before and after first Gemma request.
- Backend RSS and heap used from `/health/enterprise`.
- RAG retriever RSS before first search and after first search.
- Time to first RAG search, then average of the next 5 searches.
- Decision API RSS before first voice request and after first voice request.
- Time to first voice transcription, then average of the next 3 transcriptions.
- Vite startup time and peak Node memory during `npm run dev`.
- Gemma queue depth during 3 simultaneous chat requests.
- Number of HTTP 500s, timeouts, queue overflows, and failovers during a 20-request smoke run.
