# Combined Backend (Neo4j + MySQL + MeiliSearch)

## Structure
- db/mysql.js        - MySQL pool helper
- db/neo4j.js        - Neo4j driver + session helper
- db/meili.js        - MeiliSearch client
- routes/auth.js     - authentication (MySQL)
- routes/graph.js    - graph queries (Neo4j)
- routes/search.js   - search + indexing (MeiliSearch)
- index.js           - main Express server

## Setup
1. Copy `.env.example` to `.env` and fill credentials.
2. Install dependencies:
