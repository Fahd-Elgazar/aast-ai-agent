# Post Migration Audit

Date: 2026-06-20

## Verification Commands Run

- Node syntax checks passed for changed backend modules.
- Python bytecode compilation passed for changed Python modules.
- `docker compose config` passed.
- `ollama list` was checked and confirmed `gemma4:e2b` and `nomic-embed-text:latest` are installed.

Live container health was not checked because Docker Desktop engine was unavailable from this session.

## Audit Answers

Gemma Primary = YES.

Evidence:

- Final synthesis starts with Gemma: `unifiedAnswerService.js:499-520`.
- Gemma metadata is emitted: `unifiedAnswerService.js:2440`.

Gemini Backup = YES.

Evidence:

- Gemini is called only after Gemma failure: `unifiedAnswerService.js:555-566`.
- Gemini backup metadata is emitted: `unifiedAnswerService.js:2442`.

Maximum Gemma Calls Per Request = 1.

Evidence:

- Single-generation policy enabled by default: `runtimeMode.js:16`.
- Final synthesis has one Gemma primary call.
- Intent, graph refine, RAG answer, decision extraction, pre-synthesis fallback, humanizer, and warm pool are disabled by default.
- Primary retry limit is zero: `llmConfig.js:216`.

Expected Success Rate = 88% to 92% after warmup.

This is an engineering estimate, not a measured live benchmark. It assumes:

- Docker containers are rebuilt and running.
- Ollama is running.
- `gemma4:e2b` is available.
- Neo4j, Qdrant, and RAG retriever are healthy.
- Defense-mode flags remain active.

Remaining Bottlenecks:

- Docker Desktop availability and container freshness.
- Ollama cold start.
- `gemma4:e2b` memory pressure on 6GB VRAM.
- RAG retriever first-query lazy model load.
- Neo4j/Qdrant startup health.
- Gemini backup dependency on network/API availability.

## Final Score

Score: 86 / 100.

Why not higher:

- Live containers were not inspectable in this session.
- The configured installed model is `gemma4:e2b`, not exact `gemma3:e2b`.
- 6GB VRAM remains a hard constraint.
- RAG retriever first-load latency can still affect the first question.

Why the score is strong:

- Final synthesis is now Gemma primary.
- Gemini is backup only.
- Deterministic fallback exists.
- Maximum Gemma generation count is reduced to 1.
- Metrics were added for Gemma, fallback, queue, latency, and success/failure rate.
- Defense-mode settings are explicit and source-backed.
