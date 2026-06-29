# Gemma Runtime Validation

Generated: 2026-06-20 14:44:34 +03:00

## Result
PARTIAL / NOT ACTIVE. The rebuilt backend container contains the latest Gemma runtime files and environment flags, but the backend process crashes before it can serve health or metrics endpoints. Therefore Gemma Primary and Gemini Backup are configured in the container, but not proven active in a running backend service.

## File Check
/app/config/runtimeMode.js exists in the rebuilt backend container and was copied successfully to C:\AI_AGENT\runtime_validation_tmp\runtimeMode.js.

``text


Algorithm : SHA256
Hash      : 8EA80E107C6A984E05D2DC58572D6156615C1A9FF9D00AB986C9DD9FBF8D9B6C
Path      : C:\AI_AGENT\runtime_validation_tmp\runtimeMode.js




``

## Environment Flags In Backend Container
``text

OLLAMA_BASE_URL=http://host.docker.internal:11434
GEMINI_BACKUP_ENABLED=true
BACKUP_MODEL=tinyllama:latest
RAG_ANSWER_ENGINE_ENABLED=false
GEMINI_MODEL=gemini-2.5-flash
PRIMARY_MODEL=gemma4:e2b
SINGLE_GEMMA_GENERATION_MODE=true



``

## Runtime Activation Check
- SINGLE_GEMMA_GENERATION_MODE=true: PASS
- GEMINI_BACKUP_ENABLED=true: PASS
- PRIMARY_MODEL=gemma4:e2b: PASS
- GEMINI_MODEL=gemini-2.5-flash: PASS
- Backend /health/metrics: FAIL, backend connection closes/restarts
- Gemma Primary active at runtime: NOT PROVEN because backend crashes before serving
- Gemini Backup active at runtime: NOT PROVEN because backend crashes before serving

## Backend Crash Evidence
``text
docker :         ^
At line:25 char:16
+ ... ckendLogs = docker logs --tail 120 aast-ai-agent-backend-1 2>&1 | Out ...
+                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (        ^:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 

Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'cli-table3' imported from /app/services/metrics.js
    at packageResolve (node:internal/modules/esm/resolve:873:9)
    at moduleResolve (node:internal/modules/esm/resolve:946:18)
    at defaultResolve (node:internal/modules/esm/resolve:1188:11)
    at ModuleLoader.defaultResolve (node:internal/modules/esm/loader:708:12)
    at #cachedDefaultResolve (node:internal/modules/esm/loader:657:25)
    at ModuleLoader.resolve (node:internal/modules/esm/loader:640:38)
    at ModuleLoader.getModuleJobForImport (node:internal/modules/esm/loader:264:38)
    at ModuleJob._link (node:internal/modules/esm/module_job:168:49) {
  code: 'ERR_MODULE_NOT_FOUND'
}

Node.js v20.20.2
node:internal/modules/esm/resolve:873
  throw new ERR_MODULE_NOT_FOUND(packageName, fileURLToPath(base), null);
        ^

Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'cli-table3' imported from /app/services/metrics.js
    at packageResolve (node:internal/modules/esm/resolve:873:9)
    at moduleResolve (node:internal/modules/esm/resolve:946:18)
    at defaultResolve (node:internal/modules/esm/resolve:1188:11)
    at ModuleLoader.defaultResolve (node:internal/modules/esm/loader:708:12)

> aast-backend-combined@1.0.0 start:orchestrator
> node --max-old-space-size=3072 orchestrator.js

    at #cachedDefaultResolve (node:internal/modules/esm/loader:657:25)
    at ModuleLoader.resolve (node:internal/modules/esm/loader:640:38)
    at ModuleLoader.getModuleJobForImport (node:internal/modules/esm/loader:264:38)
    at ModuleJob._link (node:internal/modules/esm/module_job:168:49) {

  code: 'ERR_MODULE_NOT_FOUND'
}

Node.js v20.20.2
node:internal/modules/esm/resolve:873
  throw new ERR_MODULE_NOT_FOUND(packageName, fileURLToPath(base), null);
        ^

Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'cli-table3' imported from /app/services/metrics.js
> aast-backend-combined@1.0.0 start:orchestrator
> node --max-old-space-size=3072 orchestrator.js

    at packageResolve (node:internal/modules/esm/resolve:873:9)
    at moduleResolve (node:internal/modules/esm/resolve:946:18)
    at defaultResolve (node:internal/modules/esm/resolve:1188:11)
    at ModuleLoader.defaultResolve (node:internal/modules/esm/loader:708:12)
    at #cachedDefaultResolve (node:internal/modules/esm/loader:657:25)
    at ModuleLoader.resolve (node:internal/modules/esm/loader:640:38)
    at ModuleLoader.getModuleJobForImport (node:internal/modules/esm/loader:264:38)
    at ModuleJob._link (node:internal/modules/esm/module_job:168:49) {
  code: 'ERR_MODULE_NOT_FOUND'
}

Node.js v20.20.2
node:internal/modules/esm/resolve:873
  throw new ERR_MODULE_NOT_FOUND(packageName, fileURLToPath(base), null);
        ^

Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'cli-table3' imported from /app/services/metrics.js
    at packageResolve (node:internal/modules/esm/resolve:873:9)
    at moduleResolve (node:internal/modules/esm/resolve:946:18)
    at defaultResolve (node:internal/modules/esm/resolve:1188:11)
    at ModuleLoader.defaultResolve (node:internal/modules/esm/loader:708:12)
    at #cachedDefaultResolve (node:internal/modules/esm/loader:657:25)
    at ModuleLoader.resolve (node:internal/modules/esm/loader:640:38)
    at ModuleLoader.getModuleJobForImport (node:internal/modules/esm/loader:264:38)
    at ModuleJob._link (node:internal/modules/esm/module_job:168:49) {
  code: 'ERR_MODULE_NOT_FOUND'
}

Node.js v20.20.2
node:internal/modules/esm/resolve:873

> aast-backend-combined@1.0.0 start:orchestrator
> node --max-old-space-size=3072 orchestrator.js


> aast-backend-combined@1.0.0 start:orchestrator
> node --max-old-space-size=3072 orchestrator.js

  throw new ERR_MODULE_NOT_FOUND(packageName, fileURLToPath(base), null);
        ^

Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'cli-table3' imported from /app/services/metrics.js

> aast-backend-combined@1.0.0 start:orchestrator
> node --max-old-space-size=3072 orchestrator.js

    at packageResolve (node:internal/modules/esm/resolve:873:9)
    at moduleResolve (node:internal/modules/esm/resolve:946:18)
    at defaultResolve (node:internal/modules/esm/resolve:1188:11)
    at ModuleLoader.defaultResolve (node:internal/modules/esm/loader:708:12)
    at #cachedDefaultResolve (node:internal/modules/esm/loader:657:25)
    at ModuleLoader.resolve (node:internal/modules/esm/loader:640:38)
    at ModuleLoader.getModuleJobForImport (node:internal/modules/esm/loader:264:38)
    at ModuleJob._link (node:internal/modules/esm/module_job:168:49) {
  code: 'ERR_MODULE_NOT_FOUND'
}

Node.js v20.20.2
node:internal/modules/esm/resolve:873
  throw new ERR_MODULE_NOT_FOUND(packageName, fileURLToPath(base), null);
        ^

Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'cli-table3' imported from /app/services/metrics.js
    at packageResolve (node:internal/modules/esm/resolve:873:9)
    at moduleResolve (node:internal/modules/esm/resolve:946:18)
    at defaultResolve (node:internal/modules/esm/resolve:1188:11)
    at ModuleLoader.defaultResolve (node:internal/modules/esm/loader:708:12)
    at #cachedDefaultResolve (node:internal/modules/esm/loader:657:25)
    at ModuleLoader.resolve (node:internal/modules/esm/loader:640:38)
    at ModuleLoader.getModuleJobForImport (node:internal/modules/esm/loader:264:38)
    at ModuleJob._link (node:internal/modules/esm/module_job:168:49) {
  code: 'ERR_MODULE_NOT_FOUND'
}

Node.js v20.20.2

``

## Dependency Evidence
``text
No cli-table3 entry found in backend package.json or package-lock.json.
``
