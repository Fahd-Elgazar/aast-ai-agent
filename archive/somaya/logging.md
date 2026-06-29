# Logging System

## Purpose
The logging system in our architecture is designed to capture, record, and persist the lifecycle of user interactions, system routing decisions, model execution times, errors, and overall system health for debugging, performance monitoring, and auditing.

## Why We Need Logging
Without logging, we would be blind in production. If a user complains about a slow response or a crashed request, we wouldn't know if the LLM timed out, if the Neo4j database failed, or if the system misunderstood the query intent. Logging gives us a verifiable trail to diagnose issues, track AI agent behavior, and monitor system performance.

## Logging Architecture

```text
User Request
   |
   v
Orchestrator (orchestrator.js)
   |
   +--> logToFile() -----> logs/chat.log (rotated at 5MB)
   |
   +--> logger.info() ---> logs/routing-audit.jsonl
   |
   +--> Metrics ---------> incrementMetric / recordDuration
   |
   +--> console logs ----> Standard output (debugging)
```

## Log Storage Locations

| File | Purpose | Evidence |
|------|---------|----------|
| `logs/chat.log` | Stores raw LLM responses, errors, timeouts, and user queries. | `orchestrator.js` (line 109: `const QUERY_LOG = ... "chat.log"`) |
| `logs/routing-audit.jsonl` | Records the step-by-step routing audit events for post-analysis. | `orchestrator.js` (line 110: `const ROUTING_AUDIT_LOG = ...`) |

## Main Logging Functions

| Function | File | Responsibility |
|----------|------|----------------|
| `logToFile(text)` | `orchestrator.js` | Appends text to `chat.log` with a timestamp and handles automatic file rotation based on size limits. |
| `logger.info(msg, meta)` | `services/logger.js`, `orchestrator.js` | Emits structured JSON logs containing metadata (e.g., latency, response size, route taken). |
| `incrementMetric(name)` | `services/metrics.js` | Tracks event counts (e.g., cache hits, timeouts, HTTP successes). |
| `recordDuration(name, ms)` | `services/metrics.js` | Tracks latency timings for system requests. |

## What Information Is Logged
- **Request ID** (e.g., `[Intent][169...]`)
- **Conversation ID** (e.g., `USER [session123]: query...`)
- **Latency** (`time=...ms`)
- **Route** (`route=RAG_ONLY`, `route=HYBRID`)
- **Errors** (`PARSE FAILURE`, `OLLAMA ERROR`)
- **Raw LLM Responses** (Raw tokens from Intent and Routing models)

## Logging Flow
1. **Request Start**: User query is received. The system logs the query and `conversationId`.
2. **Intent Extraction**: The raw LLM intent output is logged via `logToFile()`.
3. **Routing Decision**: The BrainRouter determines the subsystem, and metrics increment cache hits/misses.
4. **Retrieval**: Neo4j/RAG latencies are recorded using `recordDuration()`.
5. **Response Sent**: `logger.info("Chatbot response completed")` logs the request ID, route, durationMs, and responseBytes.

## Error Logging
- **Timeouts**: If Ollama takes too long, `logToFile("OLLAMA TIMEOUT")` is triggered.
- **Parsing Failures**: If the LLM generates invalid JSON, `logToFile("PARSE FAILURE")` is recorded.
- **LLM Failures**: If Ollama crashes, `logToFile("OLLAMA ERROR [...]: error message")` is recorded.
*(Evidence: `orchestrator.js`, lines 529-566)*

## Performance Logging
- **Latency Metrics**: Measured using `recordDuration("http_chatbot_latency_ms", duration)` and `recordDuration("gemma_latency_ms", latency)`.
- **Response Size**: Captured via `Buffer.byteLength` and logged as `responseBytes` upon completion.
- **Cache Metrics**: `incrementMetric("cache_hit")` and `incrementMetric("cache_miss")` track Intent and Golden path cache efficiency.

## Log Rotation
The `logToFile` function automatically handles rotation for `chat.log`. Before appending a new entry, it uses `fs.promises.stat` to check the file size. If the size exceeds `CHAT_LOG_MAX_BYTES` (default 5MB), it uses `fs.promises.rename` to archive the current log by appending the current `Date.now()` timestamp to the filename (e.g., `chat-169....log`). A new `chat.log` is then started.

## Strengths of Our Logging System
- **Automated Size-Based Rotation**: Prevents disk overflow by automatically archiving logs at 5MB.
- **Structured Metric Integration**: Separates unstructured debugging text from strict quantitative metrics (latencies/counts).
- **Explicit Timeout Tracking**: Captures exactly when and why the LLM aborted, rather than just returning a silent fallback.
- **Granular Request Tracing**: Prepends a unique `requestId` to logs, making asynchronous requests traceable across services.
- **Cache Hit Monitoring**: Actively logs cache misses vs hits to evaluate optimization effectiveness.

## Discussion Summary

"In our backend, the logging system acts as the black-box flight recorder for our AI agent. Every user query generates a unique Request ID that traces the entire execution path. We capture exactly how long the LLM took, which route the Brain Router selected, and how many bytes were sent back. 

To prevent our servers from running out of space, we built a custom auto-rotation mechanism that archives the raw `chat.log` file whenever it hits 5MB. 

Crucially, our logging strictly separates debugging information from structured metrics. While raw LLM outputs and parse errors are dumped into text files for debugging, latency numbers and cache hit ratios are tracked as structured metrics. This means if the LLM suddenly starts hallucinating invalid JSON or timing out, our logs will explicitly flag an `OLLAMA TIMEOUT` or `PARSE FAILURE`, allowing us to trace the exact cause of a degraded response instantly. Everything is automated, lightweight, and built directly into the orchestrator pipeline."

---

# Evidence Appendix

| Statement | File | Function | Evidence |
|-----------|------|----------|----------|
| `logs/chat.log` | `orchestrator.js` | Top-level | `const QUERY_LOG = path.join(LOG_DIR, "chat.log");` |
| `logs/routing-audit.jsonl` | `orchestrator.js` | Top-level | `const ROUTING_AUDIT_LOG = ...` |
| Log Rotation at 5MB | `orchestrator.js` | `logToFile` | `stats.size < Number(process.env.CHAT_LOG_MAX_BYTES \|\| 5 * 1024 * 1024)` |
| Performance latency logged | `orchestrator.js` | `sendBody` | `recordDuration("http_chatbot_latency_ms", duration);` |
| Error Timeouts logged | `orchestrator.js` | `extractDynamicIntent` | `logToFile(\`OLLAMA TIMEOUT [${requestId}] (Intent)\`);` |
| Parse Failure logged | `orchestrator.js` | `extractDynamicIntent` | `logToFile(\`[Intent][${requestId}] PARSE FAILURE\`);` |
