"""
Ultra Fetcher v2 — Parallel AAST fetcher
- Input: discovery_seeds_links.json (JSON list of URLs)
- Output: ./aast_v2_output/{html,json,files}/ and a cache file .ultra_cache.json
"""

import asyncio
import json
import os
import re
import time
from pathlib import Path
from typing import List
import aiohttp
from aiohttp import ClientTimeout
from playwright.async_api import async_playwright, TimeoutError as PWTimeout
from tqdm.asyncio import tqdm_asyncio  # progress
# If tqdm.asyncio import fails, fallback to simple prints (tqdm recommended)


# ----------------------------
# Config                        
# ----------------------------
INPUT_FILE = "discovery_seed_links.json"
OUTDIR = Path("aast_v2_output")
OUTDIR_HTML = OUTDIR / "html"
OUTDIR_JSON = OUTDIR / "json"
OUTDIR_FILES = OUTDIR / "files"
CACHE_FILE = Path(".ultra_cache_v2.json")

CONCURRENT_WORKERS = 40         # number of total async workers fetching URLs
PLAYWRIGHT_CONCURRENCY = 6      # number of simultaneous Playwright pages
HTTP_TIMEOUT = 15               # seconds for aiohttp requests
MAX_RETRIES = 3
RETRY_BACKOFF = 1.5             # multiplier
BATCH_SIZE = 500                # how many URLs per run chunk (to avoid huge memory spikes)

# ensure folders
OUTDIR_HTML.mkdir(parents=True, exist_ok=True)
OUTDIR_JSON.mkdir(parents=True, exist_ok=True)
OUTDIR_FILES.mkdir(parents=True, exist_ok=True)


# ----------------------------
# Helpers: detection + filename sanitation
# ----------------------------
def detect_page_type(url: str) -> str:
    if "contenttemp.php" in url and "page_id=" in url:
        return "contenttemp"
    if "contenttempsub.php" in url and "page_id=" in url and "unit_id=" in url:
        return "contenttempsub"
    if "programtemp.php" in url and "program_id=" in url:
        return "programtemp"
    if "cv.php?ser=" in url:
        return "cv"
    if "stafftemp.php" in url:
        return "staff"
    if "news-details.php" in url:
        return "news_details"
    if "event-details.php" in url:
        return "event_details"
    if "gallery/index.php" in url:
        return "gallery"
    if "retreiveOnePICNew.php" in url or "retreiveOnePICStaff.php" in url or "retreiveOnePIC" in url:
        return "image"
    if re.search(r"\.pdf($|\?)", url.lower()):
        return "pdf"
    return "html"


_invalid_fn = re.compile(r'[<>:"/\\|?*\n\r]')

def clean_name(url: str) -> str:
    s = url.replace("https://", "").replace("http://", "")
    s = _invalid_fn.sub("_", s)
    if len(s) > 220: s = s[:220]
    return s


# ----------------------------
# Cache
# ----------------------------
def load_cache():
    if CACHE_FILE.exists():
        try:
            return json.loads(CACHE_FILE.read_text(encoding="utf8"))
        except:
            return {}
    return {}

def save_cache(cache: dict):
    CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf8")


# ----------------------------
# Fetch helpers
# ----------------------------
async def aio_get_text(session: aiohttp.ClientSession, url: str, timeout=HTTP_TIMEOUT):
    for attempt in range(1, MAX_RETRIES+1):
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
    for attempt in range(1, MAX_RETRIES+1):
        try:
            async with session.get(url, timeout=ClientTimeout(total=timeout)) as resp:
                content = await resp.read()
                return resp.status, content, dict(resp.headers)
        except Exception as e:
            if attempt == MAX_RETRIES:
                return None, None, {"error": str(e)}
            await asyncio.sleep(RETRY_BACKOFF * attempt)
    return None, None, {"error": "unknown"}


# ----------------------------
# Specific AAST API helpers
# ----------------------------
def contenttemp_api_for(url: str) -> str:
    page_id = url.split("page_id=")[-1].split("&")[0]
    return f"https://aast.edu/getData/getPageContent2021.php?page_id={page_id}"

def contenttempsub_api_for(url: str):
    m = re.search(r"unit_id=(\d+).*page_id=(\d+)", url)
    if not m: return None
    unit, page = m.groups()
    return f"https://aast.edu/getData/getPageContentItems2021.php?unit_id={unit}&page_id={page}"

def programtemp_api_for(url: str):
    m = re.search(r"program_id=(\d+).*unit_id=(\d+)", url)
    if not m: return None
    prog, unit = m.groups()
    return f"https://aast.edu/getData/getProgramData2021.php?program_id={prog}&unit_id={unit}"

def cv_api_for(url: str):
    ser = url.split("ser=")[-1].split("&")[0]
    return f"https://aast.edu/getData/getCvNew.php?ser={ser}"


# ----------------------------
# Worker
# ----------------------------
async def process_url(url: str, session: aiohttp.ClientSession, pw_sem: asyncio.Semaphore, pw_browser, cache: dict):
    url = url.strip()
    if not url:
        return None

    if url in cache:
        # already fetched
        return {"url": url, "status": "cached", "path": cache[url]}

    ptype = detect_page_type(url)
    saved = None

    try:
        if ptype == "contenttemp":
            api = contenttemp_api_for(url)
            status, text, headers = await aio_get_text(session, api)
            if status:
                fname = f"content_{api.split('=')[-1]}.json"
                path = OUTDIR_JSON / clean_name(fname)
                path.write_text(text or "", encoding="utf8")
                saved = str(path)
                cache[url] = saved

        elif ptype == "contenttempsub":
            api = contenttempsub_api_for(url)
            if api:
                status, text, headers = await aio_get_text(session, api)
                if status:
                    fname = f"subcontent_{clean_name(url)}.json"
                    path = OUTDIR_JSON / clean_name(fname)
                    path.write_text(text or "", encoding="utf8")
                    saved = str(path)
                    cache[url] = saved

        elif ptype == "programtemp":
            api = programtemp_api_for(url)
            if api:
                status, text, headers = await aio_get_text(session, api)
                if status:
                    fname = f"program_{clean_name(url)}.json"
                    path = OUTDIR_JSON / clean_name(fname)
                    path.write_text(text or "", encoding="utf8")
                    saved = str(path)
                    cache[url] = saved

        elif ptype == "cv":
            api = cv_api_for(url)
            status, text, headers = await aio_get_text(session, api)
            if status:
                fname = f"cv_{clean_name(url)}.json"
                path = OUTDIR_JSON / clean_name(fname)
                path.write_text(text or "", encoding="utf8")
                saved = str(path)
                cache[url] = saved

        elif ptype in ("image", "pdf"):
            st, content, headers = await aio_get_bytes(session, url)
            if st and content:
                fname = clean_name(url)
                path = OUTDIR_FILES / fname
                path.write_bytes(content)
                saved = str(path)
                cache[url] = saved

        elif ptype in ("news_details", "event_details", "gallery"):
            # render with playwright (JS-heavy)
            async with pw_sem:
                page = await pw_browser.new_page()
                try:
                    await page.goto(url, wait_until="domcontentloaded", timeout=25000)
                    await page.wait_for_timeout(2500)
                    # attempt minor interactions
                    try:
                        await page.locator("button, a, li").first.click(timeout=1000)
                    except:
                        pass
                    html = await page.content()
                    fname = f"pw_{clean_name(url)}.html"
                    path = OUTDIR_HTML / clean_name(fname)
                    path.write_text(html or "", encoding="utf8")
                    saved = str(path)
                    cache[url] = saved
                except PWTimeout as e:
                    # fallback to aiohttp GET
                    st, text, headers = await aio_get_text(session, url)
                    if st:
                        path = OUTDIR_HTML / clean_name(f"fallback_{url}.html")
                        path.write_text(text or "", encoding="utf8")
                        saved = str(path)
                        cache[url] = saved
                finally:
                    await page.close()

        else:
            # default HTML: try a lightweight GET first
            st, text, headers = await aio_get_text(session, url)
            if st and text and len(text) > 200:
                path = OUTDIR_HTML / clean_name(f"plain_{url}.html")
                path.write_text(text or "", encoding="utf8")
                saved = str(path)
                cache[url] = saved
            else:
                # use Playwright for heavy JS
                async with pw_sem:
                    page = await pw_browser.new_page()
                    try:
                        await page.goto(url, wait_until="domcontentloaded", timeout=20000)
                        await page.wait_for_timeout(2000)
                        html = await page.content()
                        path = OUTDIR_HTML / clean_name(f"pw_{url}.html")
                        path.write_text(html or "", encoding="utf8")
                        saved = str(path)
                        cache[url] = saved
                    except PWTimeout:
                        saved = None
                    finally:
                        await page.close()

    except Exception as e:
        saved = None

    return {"url": url, "status": "saved" if saved else "fail", "path": saved}


# ----------------------------
# Runner
# ----------------------------
async def run_fetcher(urls: List[str]):
    cache = load_cache()
    to_fetch = [u for u in urls if u not in cache]

    print(f"[INFO] total urls: {len(urls)}  to_fetch: {len(to_fetch)}  cached: {len(cache)}")

    # use aiohttp session for API and file fetches
    timeout = ClientTimeout(total=HTTP_TIMEOUT)
    connector = aiohttp.TCPConnector(limit_per_host=20)
    async with aiohttp.ClientSession(timeout=timeout, connector=connector) as session:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True)
            # create a "browser" object with ability to open pages
            # we will use browser.new_page() protected by semaphore
            pw_sem = asyncio.Semaphore(PLAYWRIGHT_CONCURRENCY)

            # create worker tasks
            queue = asyncio.Queue()
            for u in to_fetch:
                await queue.put(u)

            results = []
            total = len(to_fetch)

            async def worker(worker_id: int):
                while not queue.empty():
                    url = await queue.get()
                    res = await process_url(url, session, pw_sem, browser, cache)
                    results.append(res)
                    # Progress print
                    print(f"[W{worker_id}] {len(results)}/{total} {res['status']} {res['url']}")
                    queue.task_done()

            workers = [asyncio.create_task(worker(i)) for i in range(CONCURRENT_WORKERS)]
            await queue.join()
            for w in workers:
                w.cancel()

            await browser.close()
    # persist cache and results
    save_cache(cache)
    meta = {
        "timestamp": time.time(),
        "total": len(urls),
        "fetched": len(results),
        "cached_count": len(cache)
    }
    (OUTDIR / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf8")
    (OUTDIR / "results.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf8")
    print("[DONE] saved outputs to", OUTDIR)


# ----------------------------
# Main entry
## ----------------------------
# Fixed Main entry (for your file format)
# ----------------------------
if __name__ == "__main__":
    INPUT_FILE = "discovery_seed_links.json"

    if not Path(INPUT_FILE).exists():
        print("Missing", INPUT_FILE)
        raise SystemExit(1)

    raw = json.loads(Path(INPUT_FILE).read_text(encoding="utf8"))

    # --- CASE 1: your format with "pages" ---
    if isinstance(raw, dict) and "pages" in raw:
        all_urls = []
        for p in raw["pages"]:
            if "url" in p:
                all_urls.append(p["url"])
            if "links" in p and isinstance(p["links"], list):
                all_urls.extend(p["links"])

    # --- CASE 2: already list of URLs ---
    elif isinstance(raw, list):
        all_urls = raw

    else:
        print("[ERROR] Unknown input JSON structure.")
        raise SystemExit(1)

    # remove duplicates
    all_urls = list(set(all_urls))

    print("[RUN] Total URLs:", len(all_urls))

    # Batched execution
    async def main():
        for i in range(0, len(all_urls), BATCH_SIZE):
            chunk = all_urls[i:i + BATCH_SIZE]
            print(f"[CHUNK] {i}..{i+len(chunk)-1}  (size={len(chunk)})")
            await run_fetcher(chunk)
            await asyncio.sleep(2)

    asyncio.run(main())
