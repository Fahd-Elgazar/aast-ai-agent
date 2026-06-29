# Infrastructure Runtime Dependency Report
**AAST AI Agent System Restructuring**

This report evaluates runtime dependencies, startup pathways, call frequencies, and failure impacts for the critical backend infrastructure files located under `aast-ai-agent-main/backend/services/`.

---

## 1. Summary Matrix

| Infrastructure File | Direct Imports | Transitive Imports | Startup Path? | Est. Call Frequency | Failure Impact | Recom. Batch | Safe to Move? | Confidence |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **logger.js** | 5 | 2 | **YES** | Extremely High | Critical | Batch 5 / 6 | **NO** | 98% |
| **metrics.js** | 4 | 2 | **YES** | High | High | Batch 5 | **NO** | 98% |
| **persistenceLayer.js** | 1 | 1 | **YES** | Medium-High | Critical | Batch 6 | **NO** | 99% |
| **circuitStateManager.js** | 1 | 10 | **YES** | Very High | Critical | Batch 5 | **NO** | 99% |
| **healthMonitor.js** | 1 | 10 | **YES** | High | High | Batch 5 | **NO** | 99% |
| **healthProbes.js** | 1 | 0 | **YES** | Medium | Medium | Batch 4 | **NO** | 97% |
| **gemmaTelemetryService.js** | 5 | 7 | **YES** | Very High | High | Batch 5 | **NO** | 98% |

---

## 2. Detailed File Analysis

### logger.js
* **Direct Imports Count:** `5` (`orchestrator.js`, `routes/health.js`, `services/conversationService.js`, `services/neo4jcontext.js`, `services/persistenceLayer.js`)
* **Transitive Imports Count:** `2` (`index.js`, `services/unifiedAnswerService.js`)
* **Startup Path Involvement:** **YES**. Standard logger is loaded on boot to output initialization statuses, service check logs, port configurations, and runtime warnings.
* **Runtime Call Frequency:** **Extremely High**. Invoked on every API call, exception catch block, logging event, database query execution, and debugging checkpoint.
* **Failure Impact:** **CRITICAL**. A bug in formatting or writing streams would immediately crash the Node.js event loop or leave the system completely unmonitored.
* **Rollback Complexity:** **Low-Medium** (Requires rewriting paths in 5 direct consumer files).
* **Recommended Migration Batch:** Batch 5 (Core backend services / Shared infrastructure) or Batch 6 (Protected core services).
* **Safe to Move?** **NO**. It is imported directly by protected core files (`orchestrator.js`, `neo4jcontext.js`, `conversationService.js`).

---

### metrics.js
* **Direct Imports Count:** `4` (`orchestrator.js`, `routes/health.js`, `services/healthProbes.js`, `services/neo4jcontext.js`)
* **Transitive Imports Count:** `2` (`index.js`, `services/unifiedAnswerService.js`)
* **Startup Path Involvement:** **YES**. Registers prometheus/system metric structures during startup sequence.
* **Runtime Call Frequency:** **High**. Records API latency metrics, query route distributions, model token counts, and hit counters.
* **Failure Impact:** **HIGH**. Failure to record metrics will crash API routes or cause telemetry reporting errors.
* **Rollback Complexity:** **Low-Medium**.
* **Recommended Migration Batch:** Batch 5 (Shared infrastructure).
* **Safe to Move?** **NO**. Tied directly to `orchestrator.js` and `neo4jcontext.js`.

---

### persistenceLayer.js
* **Direct Imports Count:** `1` (`services/conversationService.js`)
* **Transitive Imports Count:** `1` (`orchestrator.js`)
* **Startup Path Involvement:** **YES** (Transitively through `conversationService.js` on initialization).
* **Runtime Call Frequency:** **Medium-High**. Reads/writes conversation history files to disk on each message exchange.
* **Failure Impact:** **CRITICAL**. Disables conversation history lookups, rendering the chat system stateless and breaking thread context.
* **Rollback Complexity:** **Medium** (Tied to disk path writes and file locking).
* **Recommended Migration Batch:** Batch 6 (Protected core services).
* **Safe to Move?** **NO**. Coupled to the protected `conversationService.js`.

---

### circuitStateManager.js
* **Direct Imports Count:** `1` (`services/modelFailoverManager.js`)
* **Transitive Imports Count:** `10` (`services/ollamaService.js`, `services/healthProbes.js`, `orchestrator.js`, `services/gemmaWarmService.js`, `routes/decision.js`, `services/neo4jcontext.js`, `routes/health.js`, `index.js`, `services/decisionService.js`, `services/unifiedAnswerService.js`)
* **Startup Path Involvement:** **YES**. Loaded transitively on start to set up LLM failover circuit limits.
* **Runtime Call Frequency:** **Very High**. Evaluated before and after every LLM generation task.
* **Failure Impact:** **CRITICAL**. Disables automated model failovers (switching from Ollama to Gemini or vice-versa), leading to timeout hangs on model offline events.
* **Rollback Complexity:** **High** (Maintains in-memory breaker state and status loops).
* **Recommended Migration Batch:** Batch 5 (Failover management infra).
* **Safe to Move?** **NO**. Tightly integrated with the entire core LLM query pipeline.

---

### healthMonitor.js
* **Direct Imports Count:** `1` (`services/modelFailoverManager.js`)
* **Transitive Imports Count:** `10` (Same as `circuitStateManager.js`)
* **Startup Path Involvement:** **YES**. Launches background server checking loops on start.
* **Runtime Call Frequency:** **High**. Runs periodic diagnostic pings against local services.
* **Failure Impact:** **HIGH**. Fails database/telemetry checking loops, breaking backend health reporting.
* **Rollback Complexity:** **High**.
* **Recommended Migration Batch:** Batch 5.
* **Safe to Move?** **NO**. Directly coupled with model failovers.

---

### healthProbes.js
* **Direct Imports Count:** `1` (`orchestrator.js`)
* **Transitive Imports Count:** `0`
* **Startup Path Involvement:** **YES**. Loaded directly in `orchestrator.js` to expose server sanity checks.
* **Runtime Call Frequency:** **Medium**. Invoked periodically by the system launcher or external ping checks.
* **Failure Impact:** **MEDIUM**. Health check endpoint returns false negatives, leading to deployment failures.
* **Rollback Complexity:** **Low**.
* **Recommended Migration Batch:** Batch 4 (Low-risk services).
* **Safe to Move?** **NO**. Imported directly by protected file `orchestrator.js`.

---

### gemmaTelemetryService.js
* **Direct Imports Count:** `5` (`services/gemmaRequestLimiter.js`, `services/gemmaWarmService.js`, `services/modelFailoverManager.js`, `services/ollamaService.js`, `services/unifiedAnswerService.js`)
* **Transitive Imports Count:** `7` (`services/healthProbes.js`, `orchestrator.js`, `routes/decision.js`, `services/neo4jcontext.js`, `routes/health.js`, `index.js`, `services/decisionService.js`)
* **Startup Path Involvement:** **YES**. Handles telemetry collection for prewarming and system warmup checks.
* **Runtime Call Frequency:** **Very High**. Logs performance stats and token usage metrics for all Gemma LLM executions.
* **Failure Impact:** **HIGH**. Telemetry graphs and token count tracking degrade, impacting rate limits.
* **Rollback Complexity:** **Medium-High**.
* **Recommended Migration Batch:** Batch 5 (Core backend services).
* **Safe to Move?** **NO**. Tightly coupled to `ollamaService.js` and `unifiedAnswerService.js`.

---

## 3. General Architecture Recommendation
None of these files are safe to move in early reorganization batches. Because they contain direct dependencies from `orchestrator.js`, `neo4jcontext.js`, and `unifiedAnswerService.js`, they must be treated as **migration-protected core infrastructure** and should only be relocated in the final batches (Batch 5 & 6) alongside the core rewrite batch.
