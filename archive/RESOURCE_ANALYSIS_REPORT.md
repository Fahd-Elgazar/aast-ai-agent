# Resource Analysis Report

Date: 2026-06-20

Target machine:

- RTX 4050 Laptop GPU.
- 6GB VRAM.
- 16GB RAM.
- Single machine only.

## Model Name Finding

The request names `Gemma3:e2b`.

The current code and env configure `PRIMARY_MODEL=gemma4:e2b`, `.env.example:25`, and local `ollama list` confirmed `gemma4:e2b` is installed at about 7.2 GB. The exact local name `gemma3:e2b` was not present.

This report therefore evaluates the actual configured model: `gemma4:e2b`. If a separate `gemma3:e2b` is installed later, set `PRIMARY_MODEL=gemma3:e2b` and rerun a warmup/health pass.

## Estimated Resource Use

| Component | RAM Estimate | VRAM Estimate | CPU Estimate | Notes |
|---|---:|---:|---:|---|
| Node Orchestrator | 300 MB to 1.5 GB typical, up to configured heap | 0 | Low to medium | Docker env allows Node heap up to 4096 MB; package start uses 3072 MB. |
| Neo4j | 1.2 GB to 2.2 GB | 0 | Low to medium | Compose sets heap 512 MB to 1 GB and pagecache 512 MB. |
| Qdrant | 300 MB to 1.2 GB | 0 | Low | Depends on collection size and mmap/cache behavior. |
| RAG Retriever | 1.5 GB to 3.5 GB after model load | 0 | Medium to high on first search | CPU BAAI/bge-m3 embedding path, one thread in compose. |
| RAG Answer | 150 MB to 500 MB when generation disabled | 0 | Low | Generation disabled; retrieval-only compatibility remains. |
| Decision API | 200 MB to 600 MB | 0 | Low | Voice disabled in defense; Whisper would add CPU/RAM if enabled. |
| Ollama + Gemma | 4 GB to 9 GB system RAM depending offload | 3.5 GB to 6GB+ VRAM pressure | High during generation | Actual model artifact is about 7.2 GB; full GPU residency is not guaranteed on 6GB VRAM. |
| nomic-embed-text | 300 MB to 700 MB | Usually 0 | Low to medium | Used by Neo4j vector retrieval through Ollama embeddings. |

## Safety Verdict For RTX 4050 6GB / 16GB RAM

`gemma4:e2b` is conditionally safe as primary, not unconditionally safe.

Safe when all are true:

- Only one Gemma generation runs at a time.
- No graph refine, RAG answer, intent LLM, reformatter, humanizer, or decision LLM calls compete with final synthesis.
- Context is capped at 3072 and prompt budget around 2600.
- Queue depth is small.
- Retry count is zero.
- Voice/Whisper is disabled.
- RAG embeddings stay CPU-limited.
- Browser tabs, IDEs, and background GPU workloads are minimized during defense.

Unsafe or unstable when:

- Multiple generations stack in one request.
- Context is raised back to 4096+.
- Warm pool runs during user questions.
- RAG answer engine generates with the same model.
- Voice/Whisper is enabled alongside the main stack.
- Docker/WSL memory is constrained below the real needs of Neo4j, Qdrant, RAG, and Ollama.

## Technical Justification

The model artifact is larger than available VRAM, and runtime KV cache plus CUDA overhead can push memory above the model size. Ollama may partially offload to CPU/RAM, which can work but increases latency and variance. On a 16GB RAM machine already running Neo4j, Qdrant, RAG, Node, and Decision API, the reliability strategy must be load reduction, not scaling.

The implemented config matches that strategy:

- `GEMMA_MAX_ACTIVE_REQUESTS=1`.
- `GEMMA_QUEUE_MAX_DEPTH=2`.
- `GEMMA_QUEUE_TIMEOUT_MS=8000`.
- `GEMMA_NUM_CTX=3072`.
- `GEMMA_WARM_POOL_ENABLED=false`.
- `PRIMARY_RETRY_LIMIT=0`.

## Resource Verdict

Gemma as primary is acceptable for graduation defense if the current one-generation policy remains active. It is not safe to enable additional Gemma-based refinement layers on this hardware.
