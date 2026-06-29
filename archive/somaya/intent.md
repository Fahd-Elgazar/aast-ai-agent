# Intent Classification System

## Purpose
The Intent Classification system analyzes a user's natural language query to understand their underlying goal before any data retrieval begins. It extracts the semantic intent and any specific entities mentioned.

## Why We Need Intent Classification
Without intent classification, the system would blindly search Neo4j databases or huge document stores for every simple query, like "Hello." This would cause slow responses, wasted computational power, and confusing answers. By knowing the intent first, the agent can route complex questions to the proper database and handle simple chatter instantly.

## Supported Intents

| Intent | Meaning |
|--------|---------|
| `GENERAL` | Standard factual questions, general information, or fallback chatter. |
| `RECOMMEND` | Seeking advice, suggestions, or "best fit" recommendations. |
| `CAREER_PATH_DETAIL` | Asking specifically about career outcomes, roadmaps, or jobs. |
| `COMPARISON` | Asking to contrast or compare two options or tracks. |
| `REJECT` | Jailbreak attempts, system prompt probing, or restricted requests. |

*(Note: The system also supports deterministic static intents like `PROGRAM`, `PREREQUISITE`, `TEACHING`, `ADMIN`, etc.)*

## Input
The intent classifier receives the raw User Query (String), a unique Request ID (Number) for tracing, and an `isRetry` flag indicating if this is a fallback attempt.

## Output Schema
The exact JSON structure mandated from the LLM:
```json
{
  "intent": "GENERAL | RECOMMEND | CAREER_PATH_DETAIL | COMPARISON | REJECT",
  "entities": ["..."],
  "confidence": 0.0
}
```

## Intent Classification Pipeline

```text
User Query
   |
   v
Step 1: Sanitization (sanitizePromptInput)
   |
   v
Step 2: Cache Lookup (intentCache.get) --> Return if Hit
   |
   v
Step 3: Prompt Construction
   |
   v
Step 4: Gemma Classification (generateStableResponse)
   |
   v
Step 5: JSON Validation (extractBalancedJSON)
   |
   v
Step 6: Cache Storage (intentCache.set)
   |
   v
Brain Router
```

## Step 1 — Query Sanitization
The system strips malicious or formatting elements from the user's input before processing. The `sanitizePromptInput` function removes Markdown code fences, XML wrapper tags (like `<system>`), Unicode zero-width whitespace, and role-override jailbreaks.

## Step 2 — Cache Lookup
Before querying the LLM, the sanitized query is checked against `intentCache`. 
- **TTL**: Configured by `INTENT_CACHE_TTL_MS`.
- **Maximum entries**: Capped by `INTENT_CACHE_MAX`.
- **Eviction Strategy**: LRU (Least Recently Used) style, where the oldest entries are evicted via a `while (intentCache.size > INTENT_CACHE_MAX)` loop when the limit is breached.

## Step 3 — Prompt Generation
The system constructs a prompt demanding strict JSON output. It provides clear rules to the LLM (e.g., if asking a factual question, use `GENERAL`; if asking what to study, use `RECOMMEND`) and injects the sanitized query. 

## Step 4 — Gemma Classification
The system uses the model defined by `OLLAMA_INTENT_MODEL` or defaults to `gemma4:e2b`. 
Generation is constrained mathematically to enforce deterministic outputs:
- **Temperature**: `0`
- **Top P**: `0.1`
- **Timeouts**: Strictly enforced by environment variables `INTENT_TIMEOUT_MS` and `INTENT_DEADLINE_MS` (typically 20,000ms).

## Step 5 — JSON Parsing
Because LLMs often hallucinate surrounding text, the `extractBalancedJSON` function is used. It scans the raw output to find the first `{` and the matching balanced `}`. It then parses this substring, ensuring `intent`, `entities`, and `confidence` fields exist.

## Step 6 — Cache Storage
Successfully parsed JSON results are stored in memory mapping the lowercased query to the extracted intent. The `pruneIntentCache()` function is called to ensure memory limits are not exceeded.

## Failure Handling
- **Timeout / Queue Overflow**: If Ollama times out (`GEMMA_QUEUE_TIMEOUT`), the system will retry if `INTENT_RETRY_LIMIT > 0`. Otherwise, it falls back to a safe deterministic `GENERAL` intent and flags `degraded_reason: "INTENT_TIMEOUT"`.
- **Invalid JSON**: If parsing fails entirely, it returns `UNKNOWN_PARSE`.
- **Queue Overflow**: Handles `GEMMA_QUEUE_OVERFLOW` identically to timeouts.

## Relationship with Brain Router
The classifier output is the lifeblood of the routing phase. Once the intent keyword and entities are extracted, they are packaged and sent to `brainRouter.analyzeQuery()`. The Brain Router uses this intent to decide if it should query the Neo4j knowledge graph, the vector database, or reply directly.

## Performance Optimizations
- **In-Memory Caching**: Identical queries bypass the LLM entirely, cutting latency to 0ms.
- **Sanitization**: Stripping whitespace and wrappers reduces context window token sizes.
- **Strict Timeouts**: Budgeted deadlines prevent hanging connections from freezing the chat application.
- **Temperature 0**: Forces the LLM to skip creative token generation, vastly speeding up generation time for structured JSON.

## Strengths of Our Intent System
- **Bulletproof Parsing**: Uses a custom balancing algorithm (`extractBalancedJSON`) to rescue valid JSON even if the LLM hallucinates markdown wrappers.
- **Self-Healing Fallbacks**: Automatically falls back to deterministic routing if the LLM crashes or times out, ensuring the user still gets a response.
- **Aggressive Sanitization**: Immune to common prompt-injection techniques like `<system>` wrappers or "ignore previous instructions".
- **Zero-Latency Repeat Queries**: Fast LRU in-memory caching guarantees O(1) response times for commonly asked intents.

## Discussion Summary

"In our architecture, Intent Classification acts as the intelligent receptionist for every user query. Before we waste expensive database queries or vector searches, we need to know exactly what the user is trying to achieve. 

We process the user query through a highly optimized pipeline. First, we aggressively sanitize the input to strip out malicious jailbreaks or XML tags. Then, we check an in-memory cache to see if we’ve processed this exact query recently, skipping the AI entirely if we have. If not, we ask a lightweight, fast Gemma model running at a zero temperature to guarantee a strict JSON output representing the user's intent—like `RECOMMEND` or `COMPARISON`.

Because LLMs can be unpredictable, we built robust safety nets. If the model hallucinates extra text, our `extractBalancedJSON` algorithm surgically extracts the valid payload. If the model crashes or times out, the system automatically falls back to a safe `GENERAL` route without crashing the application. Ultimately, this isolated intent payload is handed over to the Brain Router, which uses it to trigger the most efficient data retrieval path possible."

---

# Evidence Appendix

| Statement | File | Function | Evidence |
|-----------|------|----------|----------|
| Support for GENERAL, RECOMMEND, etc. | `orchestrator.js` | `extractDynamicIntent` | Prompt rules: `"intent": "GENERAL \| RECOMMEND \| CAREER_PATH_DETAIL \| COMPARISON \| REJECT"` |
| Cache LRU Eviction | `orchestrator.js` | `pruneIntentCache` | `while (intentCache.size > INTENT_CACHE_MAX) { intentCache.delete(intentCache.keys().next().value); }` |
| JSON Balancing Algorithm | `orchestrator.js` | `extractBalancedJSON` | Uses bracket counting `depth++`, `depth--` |
| Fallback on Timeout | `orchestrator.js` | `extractDynamicIntent` | `return { intent: "GENERAL", entities: [], confidence: 0.2, degraded_reason: "INTENT_TIMEOUT" };` |
| Query Sanitization rules | `orchestrator.js` | `sanitizePromptInput` | `.replace(/<system>\|<\/system>.../, "")` |
| Temperature set to 0 | `orchestrator.js` | `extractDynamicIntent` | `options: { temperature: 0, top_p: 0.1, repeat_penalty: 1.08, num_predict: 96 }` |
