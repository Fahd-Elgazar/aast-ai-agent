# api_fetcher_async_v3.py
import json
import os
import re
import asyncio
import aiohttp
from urllib.parse import urlparse, parse_qs

# ----------------- CONFIG -----------------
INPUT_FILE = r"C:\Users\mh978\Downloads\aast_scrape_final\step8\discovery_seed_links.json"
OUT_API = "aast_v2_output/api"
HEADERS = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AASTApiFetcher/3.0"}
TIMEOUT = 12
MAX_RETRIES = 3
CONCURRENT = 40  # number of parallel workers

os.makedirs(OUT_API, exist_ok=True)


# ----------------- API HELPERS -----------------
def get_contenttemp_api(url):
    if "page_id=" not in url:
        return None
    page = url.split("page_id=")[-1].split("&")[0]
    if not page.isdigit():
        return None
    return f"https://aast.edu/getData/getPageContent2021.php?page_id={page}"


def get_contenttempsub_api(url):
    qs = parse_qs(urlparse(url).query)
    if "unit_id" in qs and "page_id" in qs:
        unit = qs["unit_id"][0]
        page = qs["page_id"][0]
        if unit.isdigit() and page.isdigit():
            return f"https://aast.edu/getData/getPageContentItems2021.php?unit_id={unit}&page_id={page}"
    return None


def get_programtemp_api(url):
    qs = parse_qs(urlparse(url).query)
    if "program_id" in qs and "unit_id" in qs:
        prog = qs["program_id"][0]
        unit = qs["unit_id"][0]
        if prog.isdigit() and unit.isdigit():
            return f"https://aast.edu/getData/getProgramData2021.php?program_id={prog}&unit_id={unit}"
    return None


def get_cv_api(url):
    if "ser=" not in url:
        return None
    ser = url.split("ser=")[-1].split("&")[0]
    if not ser.isdigit():
        return None
    return f"https://aast.edu/getData/getCvNew.php?ser={ser}"


def detect_api(url):
    low = url.lower()

    api = None
    if "contenttemp.php" in low and "page_id=" in low:
        api = get_contenttemp_api(url)

    elif "contenttempsub.php" in low:
        api = get_contenttempsub_api(url)

    elif "programtemp.php" in low:
        api = get_programtemp_api(url)

    elif "cv.php" in low:
        api = get_cv_api(url)

    return api


# ----------------- ASYNC FETCH -----------------
async def fetch_api(session, api_url, source_url):
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            async with session.get(api_url, headers=HEADERS, timeout=TIMEOUT) as r:
                text = await r.text()
                return {
                    "url": api_url,
                    "source_page": source_url,
                    "status": r.status,
                    "content_type": r.headers.get("Content-Type", ""),
                    "text": text,
                }
        except Exception as e:
            if attempt == MAX_RETRIES:
                return {"url": api_url, "source_page": source_url, "error": str(e)}
            await asyncio.sleep(attempt * 1.5)

    return {"url": api_url, "source_page": source_url, "error": "Failed after retries"}


def sanitize_filename(name: str) -> str:
    return re.sub(r"[^0-9A-Za-z_.-]", "_", name)[:180]


# ----------------- WORKER -----------------
async def process_all(apis):
    results = []
    connector = aiohttp.TCPConnector(limit_per_host=20)

    async with aiohttp.ClientSession(connector=connector) as session:
        sem = asyncio.Semaphore(CONCURRENT)
        tasks = []

        async def worker(api_url, src):
            async with sem:
                print(f"Fetching: {api_url}")
                res = await fetch_api(session, api_url, src)
                results.append(res)

                fname = sanitize_filename(api_url) + ".json"
                with open(os.path.join(OUT_API, fname), "w", encoding="utf8") as f:
                    json.dump(res, f, indent=2, ensure_ascii=False)

        for api_url, src in apis.items():
            tasks.append(asyncio.create_task(worker(api_url, src)))

        await asyncio.gather(*tasks)

    return results


# ----------------- MAIN -----------------
def load_seed_urls():
    raw = json.load(open(INPUT_FILE, "r", encoding="utf8"))

    if isinstance(raw, dict) and "pages" in raw:
        urls = []
        for p in raw["pages"]:
            if "url" in p:
                urls.append(p["url"])
            if "links" in p:
                urls.extend(p["links"])
    else:
        urls = raw

    return list(set(urls))


async def main():
    seed_urls = load_seed_urls()
    print("[INFO] Total seed URLs:", len(seed_urls))

    detected = {}
    for u in seed_urls:
        api = detect_api(u)
        if api:
            detected[api] = u

    print("[INFO] APIs detected:", len(detected))

    results = await process_all(detected)

    with open(os.path.join(OUT_API, "api_index.json"), "w", encoding="utf8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    print("[DONE] All API responses saved to:", OUT_API)


if __name__ == "__main__":
    asyncio.run(main())
