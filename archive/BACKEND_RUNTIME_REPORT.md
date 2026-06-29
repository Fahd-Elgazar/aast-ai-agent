# Backend Runtime Report

Generated: 2026-06-20 14:27:15 +03:00

## Runtime State
- Container: aast-ai-agent-backend-1
- Running: False
- Status: exited
- Exit code: 1
- Started: 2026-06-20T11:02:41.717285931Z
- Finished: 2026-06-20T11:06:44.56019462Z

## Entrypoint / CMD / Working Directory
- Working directory: /app
- Entrypoint: "docker-entrypoint.sh"
- CMD: ["npm","run","start:orchestrator"]
- package.json script in source: start:orchestrator = node --max-old-space-size=3072 orchestrator.js
- Dockerfile CMD in source: CMD ["npm", "run", "start:orchestrator"]

## Executed File Verdict
The configured runtime starts npm run start:orchestrator, which resolves to /app/orchestrator.js inside the image/container, not directly to a bind-mounted Windows file. The source equivalent is C:\AI_AGENT\aast-ai-agent-main\backend\orchestrator.js only if the image is fresh.

## Freshness Evidence For Backend Runtime File
- Host package hash: AFC592E7A721069F81381544DA580678F6E5D34011CB5253582752CB230B29AB
- Container package hash: E6F831E8D35DE7AC54581112F4D83DC9BEF0FD925150A0B220A45DE1A817F225
- Host orchestrator hash: 4A5B3A2397AEFF6CD25739E2866F032F62C9F47A9A62C78444AB30120FB6A77C
- Container orchestrator hash: 3041E3167A180083B79108ED168A058FA9A5A3DA01474454F40FC6786E2274A7
- Host config/runtimeMode.js hash: 8EA80E107C6A984E05D2DC58572D6156615C1A9FF9D00AB986C9DD9FBF8D9B6C
- Container /app/config/runtimeMode.js: missing (docker cp returned: file not found)

## Verdict
The backend is configured to execute /app/orchestrator.js, but the container is not running and its baked /app content does not match C:\AI_AGENT\aast-ai-agent-main\backend. It is not running the latest source code.
