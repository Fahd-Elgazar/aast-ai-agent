# Single-Container Demo Appliance

This appliance packages the seven services from `docker-compose.yml` into one Docker container:

- Nginx/frontend
- Node orchestrator
- Decision FastAPI service
- RAG retriever
- RAG answer service
- Qdrant
- Neo4j

Ollama remains a host dependency, matching the existing project architecture. The required `gemma4:e2b` and `nomic-embed-text` models must be installed and Ollama must listen on port `11434`.

## ICCTA 2026 multi-container setup

The conference launch uses the root `docker-compose.yml` with its own `aast-iccta-2026` project name, loopback ports and Docker volumes. The existing single-container appliance can stay running. Docker Compose uses pinned infrastructure digests and builds the application images from the checkout under explicit conference tags.

### Prerequisites

- Docker Desktop with the Docker Compose plugin, and Node.js 20.12 or later on the host. For a clean conference run, budget at least **16 GiB host RAM**, about **8 GiB available to Docker**, and **20 GiB free disk** for images and model caches. These are rehearsal planning minimums. Leave extra host RAM or GPU capacity if Ollama runs Gemma on the CPU. The preparation machine had about 1 GiB host RAM free and an existing 3.8 GiB Docker VM allocation.
- Host Ollama reachable by containers at `http://host.docker.internal:11434`. Windows Docker Desktop supplies this name. On Linux, the configured listener must accept the Docker bridge connection. Pull the exact models and compare their full digests to [profile.json](../research/conversation-baseline/profile.json):
  ```sh
  ollama pull gemma4:e2b
  ollama pull tinyllama:latest
  ollama pull nomic-embed-text:latest
  ```
- Accept access to the private fixture release from an authorized GitHub account. Download the **three** data files to a directory outside the code checkout. The public [profile](../research/conversation-baseline/profile.json) lists exact SHA-256 and size for each. The synthetic Decision seed is bundled as source. [Private fixture release](https://github.com/MohammedHssan11/aast-ai-agent-data/releases/tag/iccta-2026-fixtures-v1)

### Start and verify

PowerShell on Windows:

```powershell
.\scripts\load-fixtures.ps1 -DataDir 'D:\private\iccta-fixtures'
```

The Windows batch launchers also accept this explicit Docker mode:

```bat
starter.bat docker "D:\private\iccta-fixtures"
start_full_project.bat --docker "D:\private\iccta-fixtures"
```

POSIX shell:

```sh
./scripts/load-fixtures.sh --data-dir /absolute/path/to/iccta-fixtures
```

Supply the same absolute directory through `AAST_DATA_DIR` in an existing root `.env` if preferred. On its first successful preflight the launcher generates independent random local secrets in the ignored `.env.iccta.local`. For manual setup, the required names and safe examples are in [the root Compose template](../.env.docker.example) and [the standalone backend template](../aast-ai-agent-main/backend/.env.example). Each developer uses their own local secret values.

The launcher verifies the files, loads Neo4j before starting it, waits for Qdrant's readiness endpoint, restores and checks the collection against all 184 source chunks, and seeds the isolated Decision database with tracked synthetic fixtures. It warms the primary Ollama model and waits for application health before exercising three turns in one guest conversation. A restarting instance reuses verified data. The snapshot path is preferred because it preserves the vectors. If the snapshot file is unavailable, use `-Reingest` in PowerShell or `--reingest` in the shell with the original approved corpus. Re-ingestion uses the existing BGE-M3 pipeline.

Open `http://127.0.0.1:15173` after the smoke passes. Run the smoke again with `node scripts/smoke-stack.mjs`. The script prints pass or fail for each service and guest turn, without printing the guest token, request bodies or retrieved text. The generated env lists loopback ports. Choose unused ports there if needed. To stop just the conference services while retaining data:

```text
docker compose -p aast-iccta-2026 --env-file .env.iccta.local stop
```

The effective graph is a fresh dump from a graph and schema comparison against the mounted appliance on 22 November. The historic export identifier `6917538923245731855` identifies the `HAS_COURSE` relationship and the durable Machine Learning course key is `COURSE_IN221`. The three old dump filenames on Fahd’s PC have no verified equivalence. The Decision database uses synthetic fixtures for the Graph/RAG rehearsal, with Alembic head `4a4dbd1d4c6c`. Institutional recommendations require separate authorized data.

See [proposed demo prompts and release gates](../research/conversation-baseline/ICCTA_DEMO_REHEARSAL.md).

## Start

The appliance image does not contain the private institutional RAG corpus. For
a new `aast-ai-agent_qdrant_data` volume, run the reviewed preflight and
one-shot ingestion workflow before starting the appliance:

```powershell
.\appliance\prepare-private-corpus.ps1 `
    -CorpusPath 'C:\secure\official-aast-corpus.json'
```

The preparation script validates the complete corpus before starting an
isolated pinned Qdrant container, waits for readiness, ingests into the
appliance's `aast-ai-agent_qdrant_data` volume, and removes only that temporary
container. Stop the appliance and any root Qdrant container first; the script
fails closed and names every running container that still mounts the volume.
It does not require root application secrets. If a validated
collection already exists, do not ingest it again; the ingestion command
refuses replacement by default. The full private-corpus contract is documented in
`aast-ai-agent-main/backend/rag_system/PRIVATE_CORPUS.md`.

From PowerShell at the repository root:

```powershell
.\appliance\start-appliance.ps1
```

The script generates private local secrets and two random demo accounts on first run, stops the old seven-container project without deleting its volumes, builds the appliance, and waits for health. Open `http://127.0.0.1:5173`. Credentials are written to `appliance/demo-credentials.local`, which is ignored by Git.

Additional local competition students can be provisioned securely into the ignored `.env.appliance.local` file with `backend/scripts/provisionCompetitionUsers.js`. The tool accepts account secrets only through standard input and stores salted PBKDF2 hashes, never plaintext PINs. See the [backend environment template](../aast-ai-agent-main/backend/.env.example) and [account provisioning script](../aast-ai-agent-main/backend/scripts/provisionCompetitionUsers.js). Re-run the launcher with `-SkipBuild` after provisioning so the container receives the updated account list.

To start an image that has already been built without rebuilding it:

```powershell
.\appliance\start-appliance.ps1 -SkipBuild
```

`-BuildOnly` builds without starting. `-BuildOnly` and `-SkipBuild` cannot be combined.

## Stop

```powershell
.\appliance\stop-appliance.ps1
```

## Legacy image cleanup

Preview first:

```powershell
.\appliance\cleanup-legacy-images.ps1
```

After the appliance is healthy:

```powershell
.\appliance\cleanup-legacy-images.ps1 -Execute
```

The cleanup is deliberately limited to old AAST project image tags. It does not prune unrelated Docker images or delete any persistent volume.

## Scope

This is a demo appliance, not a recommended production topology. One container simplifies Docker Desktop and local demonstration, but it deliberately gives up per-service scaling, isolation, independent health/restart control, and rolling upgrades. The original multi-container Compose file remains the recoverable production-oriented layout.
