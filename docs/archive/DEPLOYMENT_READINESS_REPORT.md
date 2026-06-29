# Deployment Readiness Report
**AAST AI Agent — DevOps, Containers, and Deployment Audit**

This report analyzes the platform's deployment mechanisms, including container structures, environment configurations, startup scripts, health monitoring, and data recovery strategies, highlighting key deployment risks.

---

## 1. Deployment Subsystem Analysis

### 1.1 Docker & Compose Configurations
*   **Current State:** The system utilizes multi-container setups via `docker-compose.yml` to spin up services, including Qdrant, Neo4j, and Python retriever/synthesis wrappers.
*   **Risks:**
    *   Dockerfiles lack multi-stage configurations, resulting in large build sizes.
    *   Containers run processes as root, posing security risks in shared hosting environments.
    *   Build layers do not optimize caching for `package.json` and `requirements.txt`, slowing down deployment times.

### 1.2 Environment & Secrets Management
*   **Current State:** Environment configurations are parsed from local `.env` files.
*   **Risks:**
    *   API keys (Gemini, Neo4j password, SQLite paths) are stored in clear text.
    *   Lack of environment verification scripts at gateway startup, which can lead to runtime crashes if critical variables (e.g., `INTERNAL_SECRET_KEY`) are missing.

### 1.3 Startup Orchestration
*   **Current State:** PM2 and PowerShell/Batch files (`start_full_project.bat`, `start_platform.ps1`) handle local orchestration.
*   **Risks:**
    *   No systemd daemon configuration to auto-restart the services on host machine reboots.
    *   No startup sequence locking. Services are launched concurrently, meaning the Express orchestrator can start before Neo4j or Qdrant databases are fully initialized and listening on their ports.

### 1.4 Health Probes & Auto-Healing
*   **Current State:** Node.js backend exposes `/api/health` checking database connectivity.
*   **Risks:**
    *   Docker Compose does not integrate these health probes directly into container healthchecks, meaning unhealthy containers will not auto-heal or auto-restart.

### 1.5 Backup and Recovery Strategies
*   **Current State:** Local dumps exist (`neo4j-data.dump`, `dev.db.bak`).
*   **Risks:**
    *   No automated cron jobs to schedule daily database dumps.
    *   No off-site backup storage configuration, leaving data vulnerable to host filesystem failures.

---

## 2. Hardening Roadmap for Deployment

1.  **Multi-Stage Dockerfiles:** Introduce multi-stage builds for the frontend React app (using Nginx) and the Node.js backend to reduce container size.
2.  **Add Container Healthchecks:** Update `docker-compose.yml` with health check rules to restart containers when services fail to respond.
3.  **Strict Startup Sequence:** Configure `depends_on` conditions inside Docker Compose to block node backend boot until databases pass port readiness checks.
4.  **Auto-Backup Cron Job:** Implement a daily cron backup job to compress SQLite and Neo4j schemas and store them in a secure storage bucket.
