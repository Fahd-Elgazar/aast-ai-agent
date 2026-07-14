# Advisor API

The production entry point is `orchestrator.js`. It coordinates deterministic routing, Neo4j context, Qdrant retrieval, program recommendations, conversation persistence, and optional model synthesis.

## Commands

```powershell
npm ci
npm start
npm run test:routing
```

Copy `.env.example` to `.env` and replace the required placeholders before starting outside Docker.
