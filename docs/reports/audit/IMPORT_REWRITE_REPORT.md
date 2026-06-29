# Import Rewrite Report: Reorganization Mapping

This report lists the relative import paths that must be updated for every proposed file movement. In compliance with Phase 2 constraints, **no files will be moved and no imports will be modified at this time.**

---

## 1. Reorganization Import Map

### 1.1 `backend/db/neo4j.js`
*   **Current Path**: `aast-ai-agent-main/backend/db/neo4j.js`
*   **Target Path**: `graphrag/neo4j/neo4j.js`
*   **Imports To Update**:
    *   Change: `import { ... } from "./db/neo4j.js"` ──► `import { ... } from "../../graphrag/neo4j/neo4j.js"`
*   **Files Affected**:
    *   `aast-ai-agent-main/backend/orchestrator.js`
    *   `aast-ai-agent-main/backend/routes/health.js`
    *   `aast-ai-agent-main/backend/services/neo4jcontext.js`
    *   `aast-ai-agent-main/backend/fix_db.js`
*   **Risk Level**: **Medium** (Core graph database handle).

### 1.2 `backend/services/persistenceLayer.js`
*   **Current Path**: `aast-ai-agent-main/backend/services/persistenceLayer.js`
*   **Target Path**: `infrastructure/persistence/persistenceLayer.js`
*   **Imports To Update**:
    *   Change: `import { ... } from "./persistenceLayer.js"` ──► `import { ... } from "../../infrastructure/persistence/persistenceLayer.js"`
*   **Files Affected**:
    *   `aast-ai-agent-main/backend/services/conversationService.js`
*   **Risk Level**: **Low** (Isolated module call).

### 1.3 `backend/services/circuitStateManager.js`
*   **Current Path**: `aast-ai-agent-main/backend/services/circuitStateManager.js`
*   **Target Path**: `infrastructure/circuit_breaker/circuitStateManager.js`
*   **Imports To Update**:
    *   Change: `import { ... } from "./circuitStateManager.js"` ──► `import { ... } from "../../infrastructure/circuit_breaker/circuitStateManager.js"`
*   **Files Affected**:
    *   `aast-ai-agent-main/backend/services/modelFailoverManager.js`
*   **Risk Level**: **Low** (Protects LLM calls).

### 1.4 `backend/services/metrics.js`
*   **Current Path**: `aast-ai-agent-main/backend/services/metrics.js`
*   **Target Path**: `infrastructure/monitoring/metrics.js`
*   **Imports To Update**:
    *   Change: `import { ... } from "./services/metrics.js"` ──► `import { ... } from "../../infrastructure/monitoring/metrics.js"`
*   **Files Affected**:
    *   `aast-ai-agent-main/backend/orchestrator.js`
    *   `aast-ai-agent-main/backend/routes/health.js`
    *   `aast-ai-agent-main/backend/services/unifiedAnswerService.js`
    *   `aast-ai-agent-main/backend/services/modelFailoverManager.js`
    *   `aast-ai-agent-main/backend/services/ragService.js`
*   **Risk Level**: **High** (Multiple critical files record statistics).

### 1.5 `backend/services/logger.js`
*   **Current Path**: `aast-ai-agent-main/backend/services/logger.js`
*   **Target Path**: `infrastructure/persistence/logger.js` (or `infrastructure/monitoring/logger.js`)
*   **Imports To Update**:
    *   Change: `import { ... } from "./services/logger.js"` ──► `import { ... } from "../../infrastructure/persistence/logger.js"`
*   **Files Affected**:
    *   `aast-ai-agent-main/backend/orchestrator.js`
    *   `aast-ai-agent-main/backend/routes/health.js`
    *   `aast-ai-agent-main/backend/services/conversationService.js`
    *   `aast-ai-agent-main/backend/services/modelFailoverManager.js`
    *   `aast-ai-agent-main/backend/services/unifiedAnswerService.js`
    *   `aast-ai-agent-main/backend/services/persistenceLayer.js`
*   **Risk Level**: **Medium** (Used in catch block logging).

### 1.6 `backend/services/gemmaRequestLimiter.js`
*   **Current Path**: `aast-ai-agent-main/backend/services/gemmaRequestLimiter.js`
*   **Target Path**: `infrastructure/circuit_breaker/gemmaRequestLimiter.js`
*   **Imports To Update**:
    *   Change: `import { ... } from "./gemmaRequestLimiter.js"` ──► `import { ... } from "../../infrastructure/circuit_breaker/gemmaRequestLimiter.js"`
*   **Files Affected**:
    *   `aast-ai-agent-main/backend/services/ollamaService.js`
*   **Risk Level**: **Low**.

### 1.7 `backend/services/academicAliases.js`
*   **Current Path**: `aast-ai-agent-main/backend/services/academicAliases.js`
*   **Target Path**: `core/routing/academicAliases.js`
*   **Imports To Update**:
    *   Change: `import { ... } from "./academicAliases.js"` ──► `import { ... } from "../../core/routing/academicAliases.js"`
*   **Files Affected**:
    *   `aast-ai-agent-main/backend/services/academicQueryNormalizer.js`
*   **Risk Level**: **Low**.

### 1.8 `backend/services/titleGenerator.js`
*   **Current Path**: `aast-ai-agent-main/backend/services/titleGenerator.js`
*   **Target Path**: `core/conversation/titleGenerator.js`
*   **Imports To Update**:
    *   Change: `import { ... } from "./titleGenerator.js"` ──► `import { ... } from "../../core/conversation/titleGenerator.js"`
*   **Files Affected**:
    *   `aast-ai-agent-main/backend/services/conversationService.js`
*   **Risk Level**: **Low**.

### 1.9 `backend/services/gemmaWarmService.js`
*   **Current Path**: `aast-ai-agent-main/backend/services/gemmaWarmService.js`
*   **Target Path**: `ai/llm/gemmaWarmService.js`
*   **Imports To Update**:
    *   Change: `import { ... } from "./services/gemmaWarmService.js"` ──► `import { ... } from "../../ai/llm/gemmaWarmService.js"`
*   **Files Affected**:
    *   `aast-ai-agent-main/backend/orchestrator.js`
*   **Risk Level**: **Low**.

### 1.10 `backend/services/ollamaReadinessService.js`
*   **Current Path**: `aast-ai-agent-main/backend/services/ollamaReadinessService.js`
*   **Target Path**: `ai/llm/ollamaReadinessService.js`
*   **Imports To Update**:
    *   Change: `import { ... } from "./ollamaReadinessService.js"` ──► `import { ... } from "../../ai/llm/ollamaReadinessService.js"`
*   **Files Affected**:
    *   `aast-ai-agent-main/backend/services/ollamaService.js`
*   **Risk Level**: **Low**.

### 1.11 `backend/services/demoGraphService.js`
*   **Current Path**: `aast-ai-agent-main/backend/services/demoGraphService.js`
*   **Target Path**: `graphrag/graph_retrieval/demoGraphService.js`
*   **Imports To Update**:
    *   Change: `import { ... } from "./services/demoGraphService.js"` ──► `import { ... } from "../../graphrag/graph_retrieval/demoGraphService.js"`
*   **Files Affected**:
    *   `aast-ai-agent-main/backend/orchestrator.js`
*   **Risk Level**: **Low**.

### 1.12 `backend/config/goldenPathRegistry.js`
*   **Current Path**: `aast-ai-agent-main/backend/config/goldenPathRegistry.js`
*   **Target Path**: `infrastructure/config/goldenPathRegistry.js`
*   **Imports To Update**:
    *   Change: `import { ... } from "./config/goldenPathRegistry.js"` ──► `import { ... } from "../../infrastructure/config/goldenPathRegistry.js"`
*   **Files Affected**:
    *   `aast-ai-agent-main/backend/orchestrator.js`
*   **Risk Level**: **Low**.

### 1.13 `backend/greetings.js`
*   **Current Path**: `aast-ai-agent-main/backend/greetings.js`
*   **Target Path**: `core/conversation/greetings.js`
*   **Imports To Update**:
    *   Change: `import { ... } from "./greetings.js"` ──► `import { ... } from "../../core/conversation/greetings.js"`
*   **Files Affected**:
    *   `aast-ai-agent-main/backend/orchestrator.js`
*   **Risk Level**: **Low**.

### 1.14 `backend/faqService.js`
*   **Current Path**: `aast-ai-agent-main/backend/faqService.js`
*   **Target Path**: `core/routing/faqService.js`
*   **Imports To Update**:
    *   Change: `import { ... } from "./faqService.js"` ──► `import { ... } from "../../core/routing/faqService.js"`
*   **Files Affected**:
    *   `aast-ai-agent-main/backend/orchestrator.js`
*   **Risk Level**: **Low**.

### 1.15 `backend/fix_db.js`
*   **Current Path**: `aast-ai-agent-main/backend/fix_db.js`
*   **Target Path**: `graphrag/neo4j/fix_db.js`
*   **Imports To Update**:
    *   Change: `import { ... } from "./db/neo4j.js"` ──► `import { ... } from "./neo4j.js"` (internal relative change)
*   **Files Affected**:
    *   `aast-ai-agent-main/backend/fix_db.js`
*   **Risk Level**: **Low**.

### 1.16 `backend/embed_nodes.py`
*   **Current Path**: `aast-ai-agent-main/backend/embed_nodes.py`
*   **Target Path**: `graphrag/neo4j/embed_nodes.py`
*   **Imports To Update**:
    *   Python relative imports or env paths check.
*   **Files Affected**: None.
*   **Risk Level**: **Low**.
