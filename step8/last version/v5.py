"""
Ultra Fetcher V5 — Hybrid AAST crawler (fixed, headful Playwright)
- Headful Playwright (HEADLESS=False)
- Strong canonicalization
- Filter out bogus `ser` values
- Controlled Playwright network enqueuing (only known API patterns)
- Max-visited / max-queue guard to avoid runaway
- Saves html/, api/, files/, calls/, json/

Place this file and combined_seeds.json in the same folder, then run:
    python ultra_fetcher_v5_fixed_headful.py

Notes:
- HEADLESS is set to False because you requested option 2 (see pages while crawling).
- Tune MAX_VISITED and MAX_QUEUE to match your machine capacity.
"""

import asyncio
import json
import re
import time
import hashlib
from pathlib import Path
from typing import List, Dict, Optional, Set, Tuple

import aiohttp
from aiohttp import ClientTimeout
from urllib.parse import urlparse, parse_qs, urljoin
from playwright.async_api import async_playwright, TimeoutError as PWTimeout
from bs4 import BeautifulSoup

# =========================
# CONFIG (Hybrid mode)
# =========================

BASE_DIR = Path(__file__).resolve().parent
SEEDS_FILE = BASE_DIR / "combined_seeds.json"

HTTP_WORKERS = 40               # number of async workers
PLAYWRIGHT_CONCURRENCY = 6      # simultaneous Playwright pages
HTTP_TIMEOUT = 20               # seconds
MAX_RETRIES = 3
RETRY_BACKOFF = 1.5             # backoff multiplier
MAX_DEPTH = 4                   # deeper than 2 to reach APIs
ALLOWED_HOST = "aast.edu"


HEADLESS = True 

# Guards to prevent runaway
MAX_VISITED = 20000    # absolute upper bound on visited URLs (tunable)
MAX_QUEUE = 200000     # maximum queue size; beyond this the crawler will stop enqueueing new items

# Output folders (timestamped)
TS = time.strftime("%Y%m%d_%H%M%S")
OUT_BASE = BASE_DIR / f"aast_v5_output_{TS}"
OUT_HTML = OUT_BASE / "html"


OUT_API = OUT_BASE / "api" 

OUT_FILES = OUT_BASE / "files"
OUT_JSON = OUT_BASE / "json"
OUT_CALLS = OUT_BASE / "calls"  # network call logs
OUT_CACHE = OUT_BASE / ".ultra_cache_v5.json"

for p in (OUT_BASE, OUT_HTML, OUT_API, OUT_FILES, OUT_JSON, OUT_CALLS):
    p.mkdir(parents=True, exist_ok=True)

# =========================
# UTILS
# =========================

_invalid_fn = re.compile(r'[<>:"/\\|?*\n\r]')

def clean_name(url: str, suffix: str = "") -> str:
    """Create a safe filename from URL."""
    s = url.replace("https://", "").replace("http://", "")
    s = _invalid_fn.sub("_", s)
    if suffix:
        s = f"{s[:200]}_{suffix}"
    return s[:250]


def safe_write_text(path: Path, text: str) -> str:
    """Write text with unique filename if already exists."""
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


def safe_write_bytes(path: Path, data: bytes) -> str:
    """Write bytes with unique filename if already exists."""
    if path.exists():
        base = path.stem
        ext = path.suffix
        for i in range(1, 1000):
            candidate = path.with_name(f"{base}_{i}{ext}")
            if not candidate.exists():
                path = candidate
                break
    path.write_bytes(data)
    return str(path)


def compute_hash(text: str) -> str:
    return hashlib.sha256((text or "").encode("utf8", "ignore")).hexdigest()

def canonicalize_url(u: str) -> str:
    """
    SAFE canonicalizer:
    - keeps ALL query parameters (no whitelisting)
    - forces https
    - strips URL fragments (#)
    - removes trailing slashes in path only
    - does NOT modify numeric or alphanumeric IDs
    """
    try:
        u = u.strip()
        if not u:
            return u

        # remove fragments (#section)
        u = u.split("#")[0]

        p = urlparse(u)

        # always https
        scheme = "https"
        host = p.netloc.lower()

        # normalized path (no trailing slash unless root)
        path = p.path
        if path != "/":
            path = path.rstrip("/")

        # keep ALL query parameters exactly as they are
        query = p.query.strip()

        url = f"{scheme}://{host}{path}"
        if query:
            url += f"?{query}"

        return url

    except Exception:
        return u.strip()


def is_internal(url: str) -> bool:
    try:
        p = urlparse(url)
        host = p.netloc.lower()
        return ("aast.edu" in host) or (host == "")
    except:
        return False

# =========================
# SEEDS
# =========================

def load_seeds() -> List[str]:
    if not SEEDS_FILE.exists():
        print(f"[ERROR] Seeds file not found: {SEEDS_FILE}")
        return []
    raw = json.loads(SEEDS_FILE.read_text(encoding="utf8"))
    seeds: List[str] = []
    if isinstance(raw, list):
        for u in raw:
            if isinstance(u, str) and u.strip():
                seeds.append(u.strip())
    else:
        print("[WARN] combined_seeds.json is not a list; ignoring.")
    final = []
    seen = set()
    for s in seeds:
        if not is_internal(s):
            continue
        c = canonicalize_url(s)
        if c not in seen:
            seen.add(c)
            final.append(c)
    print(f"[SEEDS] Loaded {len(final)} canonical internal seeds.")
    return final

# =========================
# PAGE TYPE DETECTION & API HELPERS
# =========================

def detect_page_type(url: str) -> str:
    low = url.lower()
    if "contenttemp" in low and "page_id" in low:
        return "contenttemp"
    if "contenttempsub" in low and "page_id" in low and "unit_id" in low:
        return "contenttempsub"
    if "programtemp" in low and "program_id" in low:
        return "programtemp"
    if "cv.php" in low or ("cv" in low and "ser=" in low):
        return "cv"
    if "stafftemp" in low or ("staff" in low and "unit_id" in low):
        return "staff"
    if "news-details" in low:
        return "news_details"
    if "event-details" in low:
        return "event_details"
    if "pdf_retreivefile" in low or "pdf_retreivefilenew" in low or "retreivefile" in low:
        return "pdf_retrieve"
    if "retreiveonepic" in low:
        return "image_endpoint"
    if re.search(r"\.pdf($|\?)", low):
        return "pdf"
    if re.search(r"\.(png|jpe?g|gif)(?:$|\?)", low):
        return "image"
    if "getdata/" in low or "getpagecontent2021" in low or "getprogramdata2021" in low or "getcvnew" in low:
        return "direct_api"
    return "html"


import re
from typing import Optional

def contenttemp_api_for(url: str) -> Optional[str]:
    if "page_id" not in url:
        return None

    # FIXED REGEX: escaped quotes properly
    m = re.search(r"page_id=([0-9]+)", url)

    if not m:
        return None

    pid = m.group(1)
    return f"https://aast.edu/getData/getPageContent2021.php?page_id={pid}"

def contenttempsub_api_for(url: str) -> Optional[str]:
    try:
        qs = parse_qs(urlparse(url).query)
        unit = qs.get("unit_id", [None])[0]
        page = qs.get("page_id", [None])[0]
        if unit and page and unit.isdigit() and page.isdigit():
            return f"https://aast.edu/getData/getPageContentItems2021.php?unit_id={unit}&page_id={page}"
    except Exception:
        pass
    return None


def programtemp_api_for(url: str) -> Optional[str]:
    try:
        qs = parse_qs(urlparse(url).query)
        prog = qs.get("program_id", [None])[0]
        unit = qs.get("unit_id", [None])[0]
        if prog and prog.isdigit():
            if unit and unit.isdigit():
                return f"https://aast.edu/getData/getProgramData2021.php?program_id={prog}&unit_id={unit}"
            return f"https://aast.edu/getData/getProgramData2021.php?program_id={prog}"
    except Exception:
        pass
    return None


    # Empirical valid range for AAST CV pages
def cv_api_for(url: str) -> Optional[str]:
    if "ser=" not in url:
        return None

    m = re.search(r"ser=([0-9]+)", url)
    if not m:
        return None

    ser = int(m.group(1))

    # allow all plausible CV numbers
    if not (1 <= ser <= 999999):
        return None

    return f"https://aast.edu/getData/getCvNew.php?ser={ser}"


def detect_api_for(url: str) -> Optional[str]:
    t = detect_page_type(url)
    if t == "contenttemp":
        return contenttemp_api_for(url)
    if t == "contenttempsub":
        return contenttempsub_api_for(url)
    if t == "programtemp":
        return programtemp_api_for(url)
    if t == "cv":
        return cv_api_for(url)
    return None

# =========================
# CACHE
# =========================

def load_cache() -> Dict:
    if OUT_CACHE.exists():
        try:
            data = json.loads(OUT_CACHE.read_text(encoding="utf8"))
            if "_hashes" not in data:
                data["_hashes"] = {}
            return data
        except Exception:
            return {"_hashes": {}}
    return {"_hashes": {}}


def save_cache(cache: Dict):
    OUT_CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf8")

# =========================
# HTTP HELPERS
# =========================

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


async def aio_get_bytes(session: aiohttp.ClientSession, url: str, timeout=HTTP_TIMEOUT):
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            async with session.get(url, timeout=ClientTimeout(total=timeout)) as resp:
                content = await resp.read()
                return resp.status, content, dict(resp.headers)
        except Exception as e:
            if attempt == MAX_RETRIES:
                return None, None, {"error": str(e)}
            await asyncio.sleep(RETRY_BACKOFF * attempt)
    return None, None, {"error": "unknown"}

# =========================
# LINK + ID EXTRACTION
# =========================

def extract_links_from_html(html: str, base: str) -> Set[str]:
    urls: Set[str] = set()

    # Parse HTML safely
    try:
        soup = BeautifulSoup(html, "lxml")
    except Exception:
        soup = BeautifulSoup(html, "html.parser")

    # Extract normal <a href="..."> links
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if (
            not href
            or href == "#"
            or href.lower().startswith("javascript:")
            or href.lower().startswith("mailto:")
        ):
            continue

        full = urljoin(base, href)

        if is_internal(full):
            urls.add(full.split("#")[0])   # remove anchors

    # Extract API URLs from <script> tags
    for script in soup.find_all("script"):
        txt = (script.string or "") + " " + (script.get_text() or "")

        # FIXED REGEX (escape \n and \s properly)
        pattern = r"https?://[^\s'\"<>]+getData[^\s'\"<>]*"

        for m in re.findall(pattern, txt):
            urls.add(m.strip())

    return urls

# =========================
# FILE DOWNLOADER
# =========================

async def download_file(session: aiohttp.ClientSession, url: str, cache: Dict) -> Dict:
    can = canonicalize_url(url)
    if can in cache:
        return {"url": url, "status": "cached", "path": cache[can]}
    st, content, headers = await aio_get_bytes(session, url)
    if st and content:
        ct = headers.get("Content-Type", "").lower()
        ext = ""
        if "pdf" in ct or url.lower().endswith(".pdf"):
            ext = ".pdf"
        elif "jpeg" in ct or url.lower().endswith(".jpg") or url.lower().endswith(".jpeg"):
            ext = ".jpg"
        elif "png" in ct or url.lower().endswith(".png"):
            ext = ".png"
        elif "gif" in ct or url.lower().endswith(".gif"):
            ext = ".gif"
        else:
            parsed = urlparse(url)
            fn = Path(parsed.path).name
            if "." in fn:
                ext = "." + fn.split(".")[-1]
        fname = clean_name(url, "file") + (ext or "")
        path = OUT_FILES / fname
        saved = safe_write_bytes(path, content)
        cache[can] = saved
        save_cache(cache)
        return {"url": url, "status": "saved", "path": saved, "code": st}
    return {"url": url, "status": "failed", "error": "no_content"}

# =========================
# API FETCH
# =========================

async def fetch_api(session: aiohttp.ClientSession, api_url: str, cache: Dict) -> Dict:
    can = canonicalize_url(api_url)
    if can in cache:
        return {"api": api_url, "status": "cached", "path": cache[can]}
    st, text, headers = await aio_get_text(session, api_url)
    if st and text:
        fname = clean_name(api_url, "api") + ".json"
        path = OUT_API / fname
        saved = safe_write_text(path, text)
        cache[can] = saved
        save_cache(cache)
        return {"api": api_url, "status": "saved", "path": saved, "code": st}
    return {"api": api_url, "status": "failed"}

# =========================
# CORE PER-URL PROCESSING
# =========================

async def process_url(
    url: str,
    depth: int,
    session: aiohttp.ClientSession,
    pw_sem: asyncio.Semaphore,
    browser,
    cache: Dict,
    seen_urls: Set[str],
    queue: "asyncio.Queue[Tuple[str,int]]",
    stats: Dict,
) -> Dict:
    url = url.strip()
    if not url:
        return {"url": url, "status": "empty"}
    can = canonicalize_url(url)

    # Stop if we've hit the global visited limit
    if stats.get("visited", 0) >= MAX_VISITED:
        return {"url": url, "status": "skipped_max_visited"}

    ptype = detect_page_type(url)

    # 1) Direct file endpoints
    if ptype in ("pdf", "image", "pdf_retrieve", "image_endpoint"):
        res = await download_file(session, url, cache)
        stats["visited"] = stats.get("visited", 0) + 1
        return {"url": url, "canonical": can, **res}

    # 2) Direct API endpoints (getData/...)
    if ptype == "direct_api":
        res = await fetch_api(session, url, cache)
        stats["visited"] = stats.get("visited", 0) + 1
        return {"url": url, "canonical": can, **res}

    saved = None

    # 3) Template-based API-first (contenttemp/programtemp/cv)
    api = detect_api_for(url)
    if api:
        # aggressively fetch API (but rely on cv_api_for filtering)
        try:
            res_api = await fetch_api(session, api, cache)
            # enqueue the API canonical URL for separate handling (small)
            cl = canonicalize_url(api)
            if cl not in seen_urls and queue.qsize() < MAX_QUEUE:
                seen_urls.add(cl)
                await queue.put((api, depth))
        except Exception:
            pass

    # 4) Try plain HTTP GET
    st, text, headers = await aio_get_text(session, url)
    if st and text and len(text) > 200 and "text/html" in str(headers.get("Content-Type", "")).lower():
        html_fname = clean_name(url, "plain") + ".html"
        path = OUT_HTML / html_fname
        saved = safe_write_text(path, text)
        # dedupe by content
        soup = BeautifulSoup(text, "lxml")
        for t in soup(["script", "style", "noscript"]):
            t.decompose()
        body_text = re.sub(r"\s+", " ", soup.get_text(" ", strip=True))[:20000]
        h = compute_hash(body_text)
        if h in cache.get("_hashes", {}):
            cache[can] = cache["_hashes"][h]
            try:
                Path(saved).unlink()
            except Exception:
                pass
            save_cache(cache)
            stats["visited"] = stats.get("visited", 0) + 1
            return {"url": url, "canonical": can, "status": "duplicate", "dup_of": cache["_hashes"][h]}
        cache.setdefault("_hashes", {})[h] = can
        cache[can] = saved
        save_cache(cache)

        # recursive discovery
        if depth < MAX_DEPTH and queue.qsize() < MAX_QUEUE:
            links = extract_links_from_html(text, url)
            for l in links:
                cl = canonicalize_url(l)
                if is_internal(cl) and cl not in seen_urls:
                    seen_urls.add(cl)
                    await queue.put((l, depth + 1))

        stats["visited"] = stats.get("visited", 0) + 1
        return {"url": url, "canonical": can, "status": "http_saved", "path": saved}

    # 5) Playwright fallback for JS-heavy pages
    async with pw_sem:
        page = await browser.new_page()
        calls_log = []

        # collect requests
        page.on("request", lambda req: calls_log.append({"type": "request", "url": req.url, "method": req.method}))

        async def on_response(resp):
            try:
                ct = resp.headers.get("content-type", "") or ""
                sample = None
                if any(x in ct for x in ("json", "text", "html")):
                    try:
                        sample = await resp.text()
                        if len(sample) > 50000:
                            sample = sample[:50000]
                    except Exception:
                        sample = None
                calls_log.append(
                    {
                        "type": "response",
                        "url": resp.url,
                        "status": resp.status,
                        "content_type": ct,
                        "sample": sample,
                    }
                )
            except Exception:
                calls_log.append({"type": "response_error"})

        page.on("response", lambda r: asyncio.create_task(on_response(r)))

        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            # some basic interactions
            try:
                nav_candidates = await page.query_selector_all("nav li, .menu li, .main-menu li, .navbar li")
                for li in nav_candidates[:20]:
                    try:
                        await li.hover()
                        await page.wait_for_timeout(80)
                    except Exception:
                        pass
            except Exception:
                pass

            for sel in [
                "button[aria-haspopup='true']",
                ".menu-toggle",
                ".dropdown-toggle",
                ".nav-toggle",
                "a[onclick]",
            ]:
                try:
                    els = await page.query_selector_all(sel)
                    for el in els[:8]:
                        try:
                            await el.click(timeout=800)
                            await page.wait_for_timeout(120)
                        except Exception:
                            pass
                except Exception:
                    pass

            await page.evaluate(
                """async () => {
                    for (let i = 0; i < 3; i++) {
                        window.scrollBy(0, window.innerHeight * 0.7);
                        await new Promise(r => setTimeout(r, 250));
                    }
                }"""
            )
            await page.wait_for_timeout(800)

            html = await page.content()
            html_fname = clean_name(url, "pw") + ".html"
            path = OUT_HTML / html_fname
            saved = safe_write_text(path, html)

            # save calls log (truncate samples to keep file sizes sane)
            CLIPPED = []
            for c in calls_log:
                if isinstance(c, dict) and c.get("sample"):
                    s = c["sample"]
                    if isinstance(s, str) and len(s) > 1500:
                        c = dict(c)
                        c["sample"] = s[:1500]
                CLIPPED.append(c)
            calls_fname = clean_name(url, "calls") + ".calls.json"
            safe_write_text(OUT_CALLS / calls_fname, json.dumps(CLIPPED, ensure_ascii=False))

            # dedupe
            soup2 = BeautifulSoup(html, "lxml")
            for t in soup2(["script", "style", "noscript"]):
                t.decompose()
            body_text2 = re.sub(r"\s+", " ", soup2.get_text(" ", strip=True))[:20000]
            h2 = compute_hash(body_text2)
            if h2 in cache.get("_hashes", {}):
                cache[can] = cache["_hashes"][h2]
                try:
                    Path(saved).unlink()
                except Exception:
                    pass
                await page.close()
                save_cache(cache)
                stats["visited"] = stats.get("visited", 0) + 1
                return {"url": url, "canonical": can, "status": "duplicate", "dup_of": cache["_hashes"][h2]}
            cache.setdefault("_hashes", {})[h2] = can
            cache[can] = saved
            save_cache(cache)

            # from network calls: enqueue APIs & files BUT WITH STRICT FILTERS
            if depth < MAX_DEPTH and queue.qsize() < MAX_QUEUE:
                for c in calls_log:
                    cu = c.get("url") if isinstance(c, dict) else None
                    if not cu:
                        continue
                    cu = cu.strip()
                    if not is_internal(cu):
                        continue
                    t2 = detect_page_type(cu)
                    # only enqueue items we explicitly want, and guard bogus ser values
                    if t2 in ("direct_api", "contenttemp", "contenttempsub", "programtemp", "cv"):
                        api_candidate = None
                        try:
                            api_candidate = detect_api_for(cu) or cu
                        except Exception:
                            api_candidate = cu
                        if not api_candidate:
                            continue
                        # sanity check: canonical form must not be extremely long
                        if len(api_candidate) > 1000:
                            continue
                        # canonicalize and test again
                        cl = canonicalize_url(api_candidate)
                        # extra filter: any ?ser= beyond bounds is ignored by cv_api_for already
                        if cl not in seen_urls:
                            seen_urls.add(cl)
                            await queue.put((api_candidate, depth + 1))
                    elif t2 in ("pdf", "pdf_retrieve", "image", "image_endpoint"):
                        cl = canonicalize_url(cu)
                        if cl not in seen_urls:
                            seen_urls.add(cl)
                            await queue.put((cu, depth + 1))

            # recursive links from rendered HTML
            if depth < MAX_DEPTH and queue.qsize() < MAX_QUEUE:
                links2 = extract_links_from_html(html, url)
                for l2 in links2:
                    cl2 = canonicalize_url(l2)
                    if is_internal(cl2) and cl2 not in seen_urls:
                        seen_urls.add(cl2)
                        await queue.put((l2, depth + 1))

            await page.close()
            stats["visited"] = stats.get("visited", 0) + 1
            return {"url": url, "canonical": can, "status": "pw_saved", "path": saved}

        except PWTimeout as e:
            try:
                await page.close()
            except Exception:
                pass
            stats["visited"] = stats.get("visited", 0) + 1
            return {"url": url, "canonical": can, "status": "timeout", "error": str(e)}

        except Exception as e:
            try:
                await page.close()
            except Exception:
                pass
            stats["visited"] = stats.get("visited", 0) + 1
            return {"url": url, "canonical": can, "status": "exception", "error": str(e)}

# =========================
# RUNNER
# =========================
async def run_crawler(seeds: List[str]):
    cache = load_cache()
    seen_urls: Set[str] = set(cache.keys())

    # init queue
    queue: asyncio.Queue[Tuple[str, int]] = asyncio.Queue()

    for s in seeds:
        c = canonicalize_url(s)
        if c not in seen_urls and is_internal(c):
            seen_urls.add(c)
            await queue.put((c, 0))

    timeout = ClientTimeout(total=HTTP_TIMEOUT)
    connector = aiohttp.TCPConnector(limit_per_host=20)

    results = []
    stats = {"visited": 0}

    # Start sessions
    async with aiohttp.ClientSession(timeout=timeout, connector=connector) as session:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=HEADLESS)
            pw_sem = asyncio.Semaphore(PLAYWRIGHT_CONCURRENCY)

            async def worker(worker_id: int):
                while True:
                    try:
                        url, depth = await queue.get()
                    except asyncio.CancelledError:
                        break
                    try:
                        if stats.get("visited", 0) >= MAX_VISITED:
                            print(f"[W{worker_id}] reached MAX_VISITED, skipping further work")
                            queue.task_done()
                            continue

                        res = await process_url(
                            url=url,
                            depth=depth,
                            session=session,
                            pw_sem=pw_sem,
                            browser=browser,
                            cache=cache,
                            seen_urls=seen_urls,
                            queue=queue,
                            stats=stats,
                        )
                        results.append(res)
                        print(f"[W{worker_id}] depth={depth} status={res.get('status')} url={url}")

                    except Exception as e:
                        print(f"[W{worker_id}] error on {url}: {e}")

                    finally:
                        queue.task_done()

            # start workers
            num_workers = min(HTTP_WORKERS, max(1, queue.qsize() + 4))
            workers = [asyncio.create_task(worker(i)) for i in range(num_workers)]

            try:
                # IMPORTANT: wait until queue is fully processed
                await queue.join()
            except KeyboardInterrupt:
                print("[CTRL-C] Stopping gracefully...")
            finally:
                # cancel workers after queue done
                for w in workers:
                    w.cancel()

                # WAIT FOR WORKERS TO FINISH - FIX FOR EMPTY RESULTS
                await asyncio.gather(*workers, return_exceptions=True)

                # close browser
                await browser.close()

    # save outputs
    meta = {
        "timestamp": time.time(),
        "seeds_count": len(seeds),
        "visited": len(results),
        "cache_entries": len(cache),
        "stats": stats,
    }

    safe_write_text(OUT_JSON / "meta.json", json.dumps(meta, ensure_ascii=False, indent=2))
    safe_write_text(OUT_JSON / "results.json", json.dumps(results, ensure_ascii=False, indent=2))
    save_cache(cache)

    print("[DONE] Crawl finished.")
    print("Output folder:", OUT_BASE)

# =========================
# MAIN
# =========================

def main():
    seeds = load_seeds()
    if not seeds:
        print("[ERROR] No seeds loaded. Put combined_seeds.json next to this script.")
        return
    print(f"[RUN] Total seeds: {len(seeds)}  (MAX_DEPTH={MAX_DEPTH}, HTTP_WORKERS={HTTP_WORKERS}, PW={PLAYWRIGHT_CONCURRENCY}, HEADLESS={HEADLESS})")
    asyncio.run(run_crawler(seeds))

if __name__ == "__main__":
    main()


