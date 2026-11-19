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
