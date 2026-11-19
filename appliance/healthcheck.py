#!/usr/bin/env python3
from __future__ import annotations

import json
import socket
import subprocess
import sys
import urllib.error
import urllib.request


HTTP_TARGETS = {
    "frontend": "http://127.0.0.1:5173/",
    "backend": "http://127.0.0.1:8004/health",
    "decision": "http://127.0.0.1:8005/health",
    "rag_retriever": "http://127.0.0.1:8001/health",
    "rag_answer": "http://127.0.0.1:8002/health",
    "qdrant": "http://127.0.0.1:6333/",
}


def check_http(url: str) -> str | None:
    try:
        with urllib.request.urlopen(url, timeout=6) as response:
            if 200 <= response.status < 500:
                return None
            return f"HTTP {response.status}"
    except (OSError, urllib.error.URLError) as exc:
        return str(exc)


def main() -> int:
    failures: dict[str, str] = {}

    for name, url in HTTP_TARGETS.items():
        error = check_http(url)
        if error:
            failures[name] = error

    try:
        with socket.create_connection(("127.0.0.1", 7687), timeout=5):
            pass
    except OSError as exc:
        failures["neo4j"] = str(exc)

    try:
        result = subprocess.run(
            ["/usr/bin/supervisorctl", "status"],
            check=False,
            capture_output=True,
            text=True,
            timeout=8,
        )
        if result.returncode != 0:
            failures["supervisor"] = result.stderr.strip() or f"exit {result.returncode}"
        else:
            unhealthy = [line for line in result.stdout.splitlines() if " RUNNING " not in line]
            if unhealthy:
                failures["processes"] = "; ".join(unhealthy)
    except (OSError, subprocess.SubprocessError) as exc:
        failures["supervisor"] = str(exc)

    print(json.dumps({"status": "healthy" if not failures else "unhealthy", "failures": failures}))
    return 0 if not failures else 1


if __name__ == "__main__":
    raise SystemExit(main())

