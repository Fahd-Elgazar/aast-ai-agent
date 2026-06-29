# Ollama Connectivity Report

Generated: 2026-06-25T23:03:40.5170055+03:00
Endpoint: http://192.168.100.16:11434

## GET /api/tags

- Result: HTTP 200 in 152 ms
- HTTP 200 verified: True
- `gemma4:e2b` exists: True
- `nomic-embed-text` exists: True
- Models returned: gemma4:e2b, nomic-embed-text:latest

## POST /api/generate

- Request body: `{"prompt":"Hello","model":"gemma4:e2b","stream":false}`
- Result: FAILED in 12749 ms: The remote server returned an error: (500) Internal Server Error.
- Error: The remote server returned an error: (500) Internal Server Error.

## POST /api/embeddings

- Request body: `{"prompt":"Computer Science","model":"nomic-embed-text"}`
- Result: HTTP 200 in 3760 ms
- Embedding length: 768
- First five values: 0.9690757989883423, 0.7007849216461182, -2.7752792835235596, -1.2729642391204834, 0.8061092495918274

## Verdict

- Connectivity verdict: FAIL


## Raw Generate Replay Evidence

A curl replay using a JSON body file confirmed the generation failure was not PowerShell JSON quoting.

```text
{"error":"llama-server process has terminated: exit status 0xc0000409: The system detected an overrun of a stack-based buffer in this application. This overrun could potentially allow a malicious user to gain control of this application.: GGML_ASSERT(n_inputs \u003c GGML_SCHED_MAX_S"}
HTTP_STATUS:500
TIME_TOTAL:12.514766

```
