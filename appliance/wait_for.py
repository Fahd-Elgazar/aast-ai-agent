#!/usr/bin/env python3
from __future__ import annotations

import argparse
import socket
import sys
import time
import urllib.error
import urllib.request


def wait_for_tcp(host: str, port: int, timeout: float) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with socket.create_connection((host, port), timeout=2):
                return True
        except OSError:
            time.sleep(1)
    return False


def wait_for_http(url: str, timeout: float) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=5) as response:
                if 200 <= response.status < 500:
                    return True
        except (OSError, urllib.error.URLError):
            pass
        time.sleep(2)
    return False


def main() -> int:
    parser = argparse.ArgumentParser()
    target = parser.add_mutually_exclusive_group(required=True)
    target.add_argument("--http")
    target.add_argument("--tcp", nargs=2, metavar=("HOST", "PORT"))
    parser.add_argument("--timeout", type=float, default=120)
    args = parser.parse_args()

    if args.http:
        ready = wait_for_http(args.http, args.timeout)
        label = args.http
    else:
        host, raw_port = args.tcp
        ready = wait_for_tcp(host, int(raw_port), args.timeout)
        label = f"{host}:{raw_port}"

    if not ready:
        print(f"Dependency did not become ready within {args.timeout:.0f}s: {label}", file=sys.stderr)
        return 1
    print(f"Dependency ready: {label}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

