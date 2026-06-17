#!/usr/bin/env python3
"""
recover_missing_apis.py

Recover API responses from existing Playwright call logs (calls/*.calls.json)
and save them into the api/ folder of an existing Ultra Fetcher V5 output.

Usage:
    Place this script next to the folder: aast_v5_output_20251129_220740
    Then run:
        python recover_missing_apis.py
"""

import asyncio
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse, parse_qs, urljoin

import aiohttp
from aiohttp import ClientTimeout

# ====== CONFIG -> edit only if you moved/renamed the output folder ======
OUT_BASE = Path("aast_v5_output_20251129_220740")  # <--- your folder name
CALLS_DIR = OUT_BASE / "calls"
API_DIR = OUT_BASE / "api"
CACHE_FILE = OUT_BASE / ".ultra_cache_v5.json"

# concurrency / timeouts
CONCURRENCY = 12
HTTP_TIMEOUT = 20
MAX_RETRIES = 3
RETRY_BACKOFF = 1.3

# =======================================================================
# Helpers: safe file writes, canonicalizer, filename cleaning
# =======================================================================

_invalid_fn = re.compile(r'[<>:"/\\|?*\n\r]')

def clean_name(url: str, suffix: str = "") -> str:
    s = url.replace("https://", "").replace("http://", "")
    s = _invalid_fn.sub("_", s)
    if suffix:
        s = f"{s[:200]}_{suffix}"
    return s[:250]

def safe_write_text(path: Path, text: str) -> str:
    if path.exists():
        base = path.stem
        ext = path.suffix
        for i in range(1, 1000):
            candidate = path.with_name(f"{base}_{i}{ext}")
            if not candidate.exists():
                path = candidate
                break
    path.write_text(text or "", encoding="utf8")
    return str(path)

def canonicalize_api_url(u: str) -> str:
    """
    Canonicalize API URLs by:
    - forcing https, normalizing host and path
    - keeping only important query params: page_id, program_id, unit_id, ser
    - sorting those params
    """
    try:
        u = u.strip()
        if not u:
            return u
        # remove fragments
        u = u.split("#")[0]
        p = urlparse(u)
        scheme = "https"
        host = p.netloc.lower()
        path = p.path.rstrip("/")
        qs = parse_qs(p.query, keep_blank_values=True)

        KEEP = ("page_id", "program_id", "unit_id", "ser")
        parts = []
        for k in sorted(qs.keys()):
            if k in KEEP:
                for v in sorted(qs[k]):
                    # keep numeric-looking values
                    if re.fullmatch(r"\d+", v):
                        parts.append(f"{k}={v}")
        q = "&".join(parts)
        res = f"{scheme}://{host}{path}" + (f"?{q}" if q else "")
        return res
    except Exception:
        return u

def is_internal(url: str) -> bool:
    try:
        p = urlparse(url)
        host = p.netloc.lower()
        return ("aast.edu" in host) or (host == "")
    except Exception:
        return False

def looks_like_api(url: str) -> bool:
    """
    Heuristic: returns True if URL likely points to an AAST API we want to save.
    """
    if not url:
        return False
    low = url.lower()
    # common API endpoints used on AAST
    if "getdata" in low or "getpagecontent2021" in low or "getprogramdata2021" in low or "getcvnew" in low or "getpagecontentitems2021" in low:
        return True
    # sometimes full path without getdata prefix
    if "getpagecontent" in low or "getprogramdata" in low or "getcv" in low:
        return True
    return False

# =======================================================================
# Read calls files and extract URLs
# =======================================================================

def gather_urls_from_calls(calls_dir: Path) -> set:
    urls = set()
    if not calls_dir.exists():
        print(f"[ERROR] Calls folder not found: {calls_dir}")
        return urls
    files = sorted(calls_dir.glob("*.calls.json"))
    print(f"[FOUND] {len(files)} calls files to scan.")
    for f in files:
        try:
            raw = f.read_text(encoding="utf8", errors="ignore")
            data = json.loads(raw)
        except Exception:
            # try to be forgiving if the file is slightly broken
            try:
                # sometimes file contains many JSON objects; find "url" patterns
                txt = f.read_text(encoding="utf8", errors="ignore")
                for m in re.finditer(r'"url"\s*:\s*"([^"]+)"', txt):
                    urls.add(m.group(1))
                continue
            except:
                continue
        # data is expected to be a list of call dicts
        if isinstance(data, list):
            for entry in data:
                if not isinstance(entry, dict):
                    continue
                # entry can be 'request' or 'response' with 'url'
                u = entry.get("url") or entry.get("request") or None
                if not u:
                    # nested sample content may have 'url'
                    try:
                        if "sample" in entry and isinstance(entry["sample"], str):
                            for m in re.findall(r"https?://[^\s'\"<>]+", entry["sample"]):
                                urls.add(m.strip())
                    except:
                        pass
                    continue
                urls.add(u.strip())
        elif isinstance(data, dict):
            # some calls logs are dicts with nested lists
            for v in data.values():
                if isinstance(v, list):
                    for entry in v:
                        if isinstance(entry, dict):
                            u = entry.get("url")
                            if u:
                                urls.add(u.strip())
    return urls

# =======================================================================
# Async downloader
# =======================================================================

async def aio_get_text(session: aiohttp.ClientSession, url: str, timeout=HTTP_TIMEOUT):
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            async with session.get(url, timeout=ClientTimeout(total=timeout)) as resp:
                text = await resp.text(errors="ignore")
                return resp.status, text, dict(resp.headers)
        except Exception as e:
            if attempt == MAX_RETRIES:
                return None, None, {"error": str(e)}
            await asyncio.sleep(RETRY_BACKOFF * attempt)
    return None, None, {"error": "unknown"}

async def fetch_and_save(session: aiohttp.ClientSession, url: str, cache: dict, api_dir: Path):
    can = canonicalize_api_url(url)
    if can in cache:
        return {"url": url, "status": "cached", "path": cache[can]}
    st, text, headers = await aio_get_text(session, url)
    if st and text:
        fname = clean_name(url, "api") + ".json"
        path = api_dir / fname
        saved = safe_write_text(path, text)
        cache[can] = saved
        # flush minimal cache incrementally
        return {"url": url, "status": "saved", "path": saved, "code": st}
    return {"url": url, "status": "failed"}

# =======================================================================
# Main logic
# =======================================================================

async def main():
    # ensure folders exist
    API_DIR.mkdir(parents=True, exist_ok=True)

    # load existing cache if present
    cache = {}
    if CACHE_FILE.exists():
        try:
            cache = json.loads(CACHE_FILE.read_text(encoding="utf8"))
        except Exception:
            cache = {}
    if "_hashes" not in cache:
        cache.setdefault("_hashes", {})

    # gather URLs
    all_urls = gather_urls_from_calls(CALLS_DIR)
    print(f"[EXTRACTED] {len(all_urls)} raw URLs from calls logs.")

    # filter & canonicalize
    candidate_apis = {}
    for u in all_urls:
        if not u or not is_internal(u):
            continue
        if looks_like_api(u):
            # canonical form for dedupe
            c = canonicalize_api_url(u)
            candidate_apis[c] = u  # store original representative
    print(f"[FILTERED] {len(candidate_apis)} candidate API endpoints to fetch.")

    # prepare aiohttp session and tasks
    timeout = ClientTimeout(total=HTTP_TIMEOUT)
    conn = aiohttp.TCPConnector(limit_per_host=10)
    sem = asyncio.Semaphore(CONCURRENCY)

    async with aiohttp.ClientSession(timeout=timeout, connector=conn) as session:
        async def worker(canonical_url, original_url):
            async with sem:
                res = await fetch_and_save(session, original_url, cache, API_DIR)
                if res.get("status") == "saved":
                    # update on-disk cache incrementally
                    try:
                        CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf8")
                    except Exception:
                        pass
                print(f"[FETCH] {original_url} -> {res.get('status')}")

        tasks = []
        for c, orig in candidate_apis.items():
            # skip if already in cache
            if c in cache:
                print(f"[SKIP] cached {c}")
                continue
            tasks.append(asyncio.create_task(worker(c, orig)))

        if tasks:
            # gather with concurrency
            await asyncio.gather(*tasks)

    # final flush of cache
    try:
        CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf8")
    except Exception as e:
        print("[WARN] Could not write cache:", e)

    print("[DONE] API recovery complete.")
    print("Saved APIs into:", str(API_DIR.resolve()))

if __name__ == "__main__":
    asyncio.run(main())
