#!/usr/bin/env python3
"""
recover_all_apis.py

- Scans existing calls/*.calls.json from OUT_BASE
- Extracts API URLs
- Predicts common API ID ranges (configurable)
- Fetches all candidate APIs (JSON and binary)
- Detects Content-Type and saves files with appropriate extension:
    api/json/  -> .json
    api/html/  -> .html
    api/files/ -> images / pdfs / others
- Updates and reuses .ultra_cache_v5.json from the output folder
- Writes canonical_api_matrix.json mapping canonical_url -> saved_path + metadata

Usage: place next to your OUT_BASE folder and run.
"""

import asyncio
import json
import re
from pathlib import Path
from urllib.parse import urlparse, parse_qs
import aiohttp
from aiohttp import ClientTimeout

# ========== CONFIG ==========
OUT_BASE = Path("aast_v5_output_20251129_220740")   # <--- your folder
CALLS_DIR = OUT_BASE / "calls"
API_DIR = OUT_BASE / "api"
API_JSON_DIR = API_DIR / "json"      # structured JSON responses
API_HTML_DIR = API_DIR / "html"      # endpoints returning HTML
API_FILES_DIR = OUT_BASE / "files"   # binary files (images, pdfs, docs)
CACHE_FILE = OUT_BASE / ".ultra_cache_v5.json"
CANONICAL_MATRIX = OUT_BASE / "canonical_api_matrix.json"

# Predictive ID ranges (tune these if you want)
RANGES = {
    "program_id": (1, 2000),
    "page_id": (1, 8000),
    "unit_id": (1, 500),
    "ser": (1, 120000)
}

# Concurrency/timeout
CONCURRENCY = 20
HTTP_TIMEOUT = 20
MAX_RETRIES = 3
RETRY_BACKOFF = 1.3

# Content-type -> extension mapping fallback
CONTENT_MAP = {
    "application/json": ".json",
    "text/json": ".json",
    "application/javascript": ".json",
    "text/html": ".html",
    "text/plain": ".txt",
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
}

# Unexpected but acceptable API path substrings to include
API_PATTERNS = [
    "getdata", "getpagecontent2021", "getprogramdata2021", "getcvnew",
    "getpagecontentitems2021", "retreiveonepic", "retreivegallerypic", "pdf_retreivefile"
]

# ========== Utilities ==========
_invalid_fn = re.compile(r'[<>:"/\\|?*\n\r]')

def clean_name(url: str, suffix: str = "") -> str:
    s = url.replace("https://", "").replace("http://", "")
    s = _invalid_fn.sub("_", s)
    if suffix:
        s = f"{s[:200]}_{suffix}"
    return s[:250]

def canonicalize_api_url(u: str) -> str:
    """Keep only important query params for canonicalization."""
    try:
        u = u.strip()
        if not u:
            return u
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
                    if re.fullmatch(r"\d+", v):
                        parts.append(f"{k}={v}")
        q = "&".join(parts)
        res = f"{scheme}://{host}{path}" + (f"?{q}" if q else "")
        return res
    except:
        return u

def looks_like_api(u: str) -> bool:
    if not u:
        return False
    low = u.lower()
    return any(p in low for p in API_PATTERNS)

def is_internal(u: str) -> bool:
    try:
        p = urlparse(u)
        h = p.netloc.lower()
        return "aast.edu" in h or h == ""
    except:
        return False

# ========== Gather URLs from calls/ ==========
def gather_urls_from_calls(calls_dir: Path) -> set:
    urls = set()
    if not calls_dir.exists():
        return urls
    for f in sorted(calls_dir.glob("*.calls.json")):
        try:
            txt = f.read_text(encoding="utf8", errors="ignore")
            data = json.loads(txt)
        except Exception:
            txt = f.read_text(encoding="utf8", errors="ignore")
            for m in re.finditer(r'https?://[^\s\'"<>]+', txt):
                urls.add(m.group(0))
            continue

        if isinstance(data, list):
            for e in data:
                if not isinstance(e, dict):
                    continue
                u = e.get("url")
                if u:
                    urls.add(u.strip())
                # also inspect sample text
                s = e.get("sample")
                if isinstance(s, str):
                    for m in re.finditer(r'https?://[^\s\'"<>]+', s):
                        urls.add(m.group(0))
        elif isinstance(data, dict):
            for v in data.values():
                if isinstance(v, list):
                    for e in v:
                        if isinstance(e, dict) and e.get("url"):
                            urls.add(e.get("url").strip())
    return urls

# ========== Predictive candidate generation ==========
def generate_predictive_urls() -> set:
    candidates = set()
    # program_id
    start, end = RANGES["program_id"]
    for pid in range(start, end + 1):
        candidates.add(f"https://www.aast.edu/getData/getProgramData2021.php?program_id={pid}")
    # page_id
    start, end = RANGES["page_id"]
    for pid in range(start, end + 1):
        candidates.add(f"https://www.aast.edu/getData/getPageContent2021.php?page_id={pid}")
    # unit/page combos (small subset to avoid explosion) - we do unit range small
    ustart, uend = 1, min(RANGES["unit_id"][1], 100)  # limit units to 100 by default
    pstart, pend = 1, 300  # limited page range per unit to avoid explosion (tune if needed)
    for unit in range(ustart, uend + 1):
        for page in range(pstart, pend + 1):
            candidates.add(f"https://www.aast.edu/getData/getPageContentItems2021.php?unit_id={unit}&page_id={page}")
    # cv ser
    sstart, send = RANGES["ser"]
    step = 50  # sample every 50 to reduce total; adjust if you want exhaustive
    for s in range(sstart, send + 1, step):
        candidates.add(f"https://www.aast.edu/getData/getCvNew.php?ser={s}")
    # attachments / gallery heuristics (we will also rely on calls logs)
    return candidates

# ========== Async downloader ==========
async def aio_get(session, url, timeout=HTTP_TIMEOUT):
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            async with session.get(url, timeout=ClientTimeout(total=timeout)) as resp:
                content_type = resp.headers.get("Content-Type", "").lower()
                data = await resp.read()
                return resp.status, content_type, data
        except Exception as e:
            if attempt == MAX_RETRIES:
                return None, None, None
            await asyncio.sleep(RETRY_BACKOFF * attempt)
    return None, None, None

def choose_extension(content_type: str, url: str):
    if not content_type:
        # fallback by URL suffix
        parsed = urlparse(url)
        fn = Path(parsed.path).name
        if "." in fn:
            return "." + fn.split(".")[-1]
        return ".bin"
    for k, v in CONTENT_MAP.items():
        if k in content_type:
            return v
    # fallback: if image
    if "image/" in content_type:
        return "." + content_type.split("/")[1].split(";")[0]
    if "charset" in content_type:
        # possibly text/html
        if "html" in content_type:
            return ".html"
    return ".bin"

async def fetch_worker(session, sem, url, canonical, cache, matrix):
    async with sem:
        if canonical in cache:
            return {"status": "cached", "canonical": canonical, "path": cache[canonical]}
        st, ct, data = await aio_get(session, url)
        if st and data is not None:
            ext = choose_extension(ct, url)
            # route storage by type
            if ext == ".json":
                out_dir = API_JSON_DIR
            elif ext == ".html" or ext == ".htm":
                out_dir = API_HTML_DIR
            else:
                out_dir = API_FILES_DIR
            out_dir.mkdir(parents=True, exist_ok=True)
            fname = clean_name(url, "api") + ext
            path = out_dir / fname
            # save binary or text
            mode = "wb" if isinstance(data, (bytes, bytearray)) else "w"
            if isinstance(data, (bytes, bytearray)):
                path.write_bytes(data)
            else:
                path.write_text(data or "", encoding="utf8", errors="ignore")
            cache[canonical] = str(path)
            # record matrix entry
            matrix[canonical] = {"original_url": url, "saved_path": str(path), "status_code": st, "content_type": ct}
            return {"status": "saved", "canonical": canonical, "path": str(path)}
        return {"status": "failed", "canonical": canonical}

async def run_fetch_all(candidates, cache):
    timeout = ClientTimeout(total=HTTP_TIMEOUT)
    conn = aiohttp.TCPConnector(limit_per_host=10)
    sem = asyncio.Semaphore(CONCURRENCY)
    matrix = {}
    async with aiohttp.ClientSession(timeout=timeout, connector=conn) as session:
        tasks = []
        for canon, orig in candidates.items():
            if canon in cache:
                # record from cache for matrix (if path exists)
                matrix[canon] = {"original_url": orig, "saved_path": cache.get(canon), "status_code": None, "content_type": None}
                continue
            tasks.append(asyncio.create_task(fetch_worker(session, sem, orig, canon, cache, matrix)))
        if tasks:
            # gather in batches to avoid overloading
            for i in range(0, len(tasks), 200):
                batch = tasks[i:i+200]
                await asyncio.gather(*batch)
    return matrix

# ========== Main ==========
def load_cache():
    if CACHE_FILE.exists():
        try:
            return json.loads(CACHE_FILE.read_text(encoding="utf8"))
        except:
            return {"_hashes": {}}
    return {"_hashes": {}}

def save_cache(cache):
    try:
        CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf8")
    except Exception as e:
        print("[WARN] Could not save cache:", e)

def main():
    print("[START] API recovery (full). Using OUT_BASE:", OUT_BASE)
    API_JSON_DIR.mkdir(parents=True, exist_ok=True)
    API_HTML_DIR.mkdir(parents=True, exist_ok=True)
    API_FILES_DIR.mkdir(parents=True, exist_ok=True)

    cache = load_cache()
    if "_hashes" not in cache:
        cache.setdefault("_hashes", {})

    # gather discovered URLs from calls/
    discovered = gather_urls_from_calls(CALLS_DIR)
    print(f"[FOUND] {len(discovered)} raw URLs from calls logs.")

    # candidate mapping canonical -> representative original URL
    candidates = {}

    # pick discovered ones first
    for u in discovered:
        if not is_internal(u):
            continue
        if looks_like_api(u):
            c = canonicalize_api_url(u)
            candidates[c] = u

    print(f"[FILTERED] {len(candidates)} candidate APIs from calls logs.")

    # add predictive candidates
    predict = generate_predictive_urls()
    added = 0
    for u in predict:
        if not is_internal(u):
            continue
        c = canonicalize_api_url(u)
        if c not in candidates:
            candidates[c] = u
            added += 1
    print(f"[ADDED] {added} predictive candidate APIs. Total candidates: {len(candidates)}")

    # run async fetcher
    matrix = asyncio.run(run_fetch_all(candidates, cache))

    # merge matrix into file (include cached entries)
    try:
        existing = {}
        if CANONICAL_MATRIX.exists():
            existing = json.loads(CANONICAL_MATRIX.read_text(encoding="utf8"))
        existing.update(matrix)
        CANONICAL_MATRIX.write_text(json.dumps(existing, ensure_ascii=False, indent=2), encoding="utf8")
    except Exception as e:
        print("[WARN] Could not write canonical matrix:", e)

    save_cache(cache)
    print("[DONE] Recovery finished. Candidates fetched:", len(matrix))
    print("API JSON dir:", API_JSON_DIR)
    print("API HTML dir:", API_HTML_DIR)
    print("API binary files dir:", API_FILES_DIR)

if __name__ == "__main__":
    main()





