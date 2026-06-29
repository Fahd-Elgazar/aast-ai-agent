# Risk Report: AAST Academic AI Agent Reorganization

This document outlines the architectural, operational, and development risks associated with reorganizing the AAST Academic AI Agent codebase into the target folder structure.

---

## 1. Migration Risk Analysis

Reorganizing a production system from a flat/dispersed layout to a layered structure introduces several critical vectors of failure. Below is an evaluation of these risks:

### 1.1 Import Path Breaking (High Risk)
*   **Description**: File movements will break all relative ES module import statements (e.g., `import { connectNeo4j } from "./db/neo4j.js"`).
*   **Impact**: Runtime application crashes immediately upon startup or during specific API calls.
*   **Mitigation**: A complete file movement map must be generated (Phase 2). All files affected by a move must have their relative import depths (e.g., `../` vs. `../../`) recalculated and rewritten.

### 1.2 Configuration Env Variable Resolution (Medium Risk)
*   **Description**: Some modules use `process.cwd()` or relative paths to resolve configuration files (like `.env`, `data/faq.json`, `decision_memory.json`, or sqlite `dev.db`).
*   **Impact**: Moving execution scripts to other subdirectories can shift the resolved `process.cwd()`, causing files to be missing at runtime.
*   **Mitigation**: Ensure path resolution inside files uses `path.resolve(path.dirname(import.meta.url))` or absolute path mappings anchored at the main package root, not ad-hoc relative resolutions.

### 1.3 Service Breakage & Circuit Breaker Cascades (Medium Risk)
*   **Description**: If a service like the RAG Retriever or FastAPI DSS fails to start or responds slowly due to path issues or package errors, the circuit breaker state machine (`circuitStateManager.js`) will flip to `OPEN`.
*   **Impact**: Cascading failovers will occur. The orchestrator will route requests to fallback services or return fallback messages, hiding the root cause of the error.
*   **Mitigation**: Run diagnostics mode (`.\starter.bat demo --diagnostics`) before fully opening the platform. This validates port listening status and health endpoints directly without activating circuit breaker logic.

### 1.4 Docker & Deployment Context Disruption (High Risk)
*   **Description**: The codebase contains `Dockerfile`s in `backend/`, `frontend/`, and `rag_system/`. Reorganizing directories changes the Docker build context.
*   **Impact**: `docker build` commands will fail because paths referenced in `COPY` commands no longer exist in the expected build context.
*   **Mitigation**: Re-map `Dockerfile` copy commands and verify the `docker-compose.yml` context directories after any folder reorganizations.

---

## 2. Circuit Breaker & Health Probing Analysis

The platform is protected against cascading dependencies by a system of probes and breakers:

```
[ Incoming Request ] ──► [ Breaker State Check ]
                              │
                    ┌─────────┴─────────┐
                 [CLOSED]             [OPEN]
                    │                   │
             (Attempt Service)          ▼
                    │           [Serve Fallback Payload]
             (Success/Failure?)
                    │
            ┌───────┴───────┐
         [OK]             [FAIL]
            │               │
      (Reset Counter)   (Increment Failure)
                            │
                     (Failure > Limit?)
                            │
                            ▼
                     [Trip to OPEN]
```

### Active Configurations (From `start_platform.ps1` Envs):
*   **RAG Failure Threshold**: `RAG_CB_FAILURE_THRESHOLD = 5` (fails after 5 consecutive errors).
*   **RAG Cooldown Period**: `RAG_CB_COOLDOWN_MS = 15000` (breaker stays open for 15 seconds before transitioning to HALF-OPEN to test recovery).
*   **Health Timeout**: `RAG_HEALTH_TIMEOUT_MS = 800` (quick check prevents blocking the orchestrator).

---

## 3. Safe Migration Checklist (Phase 2 & 3)

To ensure zero downtime and zero regressions during file movements, the following sequence must be obeyed:

1.  **Backup**: Duplicate the entire workspace before starting any operations (`zip` or `tar`).
2.  **Incremental Movement**: Move files one layer at a time (e.g., first move helper services, then routes, then config).
3.  **Refactor Imports**: Immediately edit import paths inside the moved file and all caller files.
4.  **Lint Check**: Run `npm run lint` or compilation tests.
5.  **Dry Run**: Start the backend in isolation to verify the Express server binds to port 8004.
6.  **Full Startup Validation**: Run `starter.bat demo` and check the health endpoints.
7.  **Golden Query Check**: Execute the benchmark test query to verify routing.
