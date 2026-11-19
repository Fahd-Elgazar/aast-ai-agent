# Private RAG Corpus Contract

Institutional corpus data is not part of the source tree or either RAG image.
The only supported input is an explicit read-only bind mount.

From this directory, set the absolute path to the official refined corpus:

```powershell
$env:RAG_PRIVATE_CORPUS_PATH = 'C:\secure\aast-corpus.json'
```

Run the non-mutating preflight first. It validates the full schema, every point
ID, content fields, quality values, tags, and all generated embedding vectors:

```powershell
docker compose -f compose.private-corpus.yml run --rm rag-corpus-preflight
```

Only after preflight passes, run the one-shot ingestion against a reachable
Qdrant host. The default is `host.docker.internal:6333`; override
`RAG_INGEST_QDRANT_HOST` and `RAG_INGEST_QDRANT_PORT` when required:

```powershell
docker compose -f compose.private-corpus.yml run --rm rag-corpus-ingest
```

The default ingestion refuses to overwrite an existing collection. An explicit
destructive rebuild requires the operator to repeat the same mounted input and
add the flag deliberately:

```powershell
docker compose -f compose.private-corpus.yml run --rm rag-corpus-ingest --force-rebuild
```

The ingestion container is one-shot and closes its Qdrant/model resources on
exit. Retriever `/health` remains non-ready until the collection is green,
Cosine/1024-dimensional, optimizer-clean, non-empty, and passes its bounded
payload smoke check.
