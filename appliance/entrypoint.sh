#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${INTERNAL_SECRET_KEY:-}" ]]; then
  echo "INTERNAL_SECRET_KEY is required" >&2
  exit 78
fi
jwt_secret="${AUTH_JWT_SECRET:-}"
if [[ ${#jwt_secret} -lt 32 ]]; then
  echo "AUTH_JWT_SECRET must contain at least 32 characters" >&2
  exit 78
fi
if [[ -z "${NEO4J_AUTH:-}" || "${NEO4J_AUTH}" == "neo4j/" ]]; then
  echo "NEO4J_AUTH is required" >&2
  exit 78
fi

mkdir -p \
  /opt/aast/backend/logs \
  /opt/aast/decision/runtime/voice \
  /opt/qdrant/storage \
  /run/nginx \
  /var/log/supervisor

if [[ ! -f /opt/aast/decision/runtime/dev.db && -f /opt/aast/decision/dev.db ]]; then
  cp /opt/aast/decision/dev.db /opt/aast/decision/runtime/dev.db
fi

rm -f /var/lib/neo4j/run/neo4j.pid /run/nginx.pid /run/supervisord.pid /run/supervisor.sock

cd /opt/aast/decision
/opt/venvs/decision/bin/python scripts/bootstrap_database.py

echo "[APPLIANCE] Database ready; starting supervised project services." >&2
exec "$@"
