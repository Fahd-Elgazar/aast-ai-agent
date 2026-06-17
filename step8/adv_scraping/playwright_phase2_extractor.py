# playwright_phase2_recursive.py
import asyncio
import json
import random
import logging
from urllib.parse import urljoin, urlparse
from pathlib import Path
from playwright.async_api import async_playwright

###################################
# SETTINGS
###################################
ROOT_DOMAIN = "aast.edu"

SEEDS_FILE = "all_seeds_extracted.json"
START_URLS = json.load(open(SEEDS_FILE, "r", encoding="utf8"))

OUTPUT_FILE = "phase2_recursive_output.json"

CONCURRENCY = 3
SAFE_DELAY_MIN = 0.4
SAFE_DELAY_MAX = 1.1
TIMEOUT_MS = 40000
MAX_PAGES = None        # or number to limit recursive crawling depth


IGNORE_DOMAINS = [
    "360.aast.edu",
    "sheraton.aast.edu",
]

###################################
# HELPERS
###################################

def safe_host(url: str):
    try:
        host = urlparse(url).netloc.lower()
        if not host.endswith(ROOT_DOMAIN):
            return False
        for bad in IGNORE_DOMAINS:
            if bad in host:
                return False
        return True
    except:
        return False


def normalize(url: str):
    try:
        u = url.split("#")[0].strip()
        return u
    except:
        return url


###################################
# PAGE EXTRACTOR
###################################

async def extract_from_page(page, base_url):
    links = set()
    apis  = set()

    # Intercept ALL network requests
    def on_request(req):
        u = req.url.lower()
        if any(x in u for x in ["api", "ajax", "get", "program", "php?"]):
            apis.add(req.url)

    page.on("request", on_request)

    # Visit target page
    try:
        await page.goto(base_url, wait_until="networkidle", timeout=TIMEOUT_MS)
    except:
        return links, apis

    # 1) Expand dropdown menus via JS injection
    try:
        await page.evaluate("""
            document.querySelectorAll('.dropdown, .menu, nav li')
            .forEach(el => el.dispatchEvent(new Event('mouseenter', {bubbles: true})));
        """)
        await asyncio.sleep(1.2)
    except:
        pass

    # 2) Hover over any anchor inside nav menu
    try:
        nav_items = await page.query_selector_all("nav a, .menu a, .navbar a, header a")
        for it in nav_items:
            try:
                await it.hover()
                await asyncio.sleep(0.3)
                href = await it.get_attribute("href")
                if href:
                    full = urljoin(base_url, href)
                    if safe_host(full):
                        links.add(normalize(full))
            except:
                pass
    except:
        pass

    # 3) Click any dropdown-toggle items
    try:
        toggles = await page.query_selector_all(".dropdown-toggle, .has-submenu, .submenu-toggle")
        for t in toggles:
            try:
                await t.click()
                await asyncio.sleep(0.5)
            except:
                pass
    except:
        pass

    # 4) Scroll lazy-load
    try:
        for y in range(0, 5000, 500):
            await page.evaluate(f"window.scrollTo(0, {y})")
            await asyncio.sleep(0.25)
    except:
        pass

    # 5) Extract all anchors
    try:
        anchors = await page.query_selector_all("a[href]")
        for a in anchors:
            try:
                h = await a.get_attribute("href")
                if h:
                    full = urljoin(base_url, h)
                    if safe_host(full):
                        links.add(normalize(full))
            except:
                pass
    except:
        pass

    return links, apis


###################################
# WORKER
###################################

async def worker(playwright, queue, visited, global_links, global_apis):
    browser = await playwright.chromium.launch(headless=True)
    context = await browser.new_context(
        user_agent="AAST-Scraper-Playwright/3.0",
        java_script_enabled=True,
    )
    page = await context.new_page()

    while not queue.empty():
        url = await queue.get()

        if url in visited:
            queue.task_done()
            continue

        visited.add(url)

        # Random delay for anti-block
        await asyncio.sleep(random.uniform(SAFE_DELAY_MIN, SAFE_DELAY_MAX))

        print(f"[CRAWL] {url}")
        links, apis = await extract_from_page(page, url)

        # Update global link sets
        for l in links:
            if l not in visited:
                queue.put_nowait(l)
            global_links.add(l)

        for a in apis:
            global_apis.add(a)

        queue.task_done()

    await browser.close()


###################################
# MAIN
###################################

async def main():
    logging.basicConfig(level=logging.INFO)

    seeds = set(START_URLS)

    global_links = set()
    global_apis = set()
    visited = set()

    queue = asyncio.Queue()
    for s in seeds:
        queue.put_nowait(s)

    async with async_playwright() as p:
        workers = []
        for _ in range(CONCURRENCY):
            workers.append(asyncio.create_task(
                worker(p, queue, visited, global_links, global_apis)
            ))

        await queue.join()
        for w in workers:
            w.cancel()

    result = {
        "links_count": len(global_links),
        "apis_count": len(global_apis),
        "links": sorted(list(global_links)),
        "apis":  sorted(list(global_apis)),
    }

    Path(OUTPUT_FILE).write_text(
        json.dumps(result, indent=2, ensure_ascii=False),
        encoding="utf8"
    )

    print(f"\nDONE: {len(global_links)} links, {len(global_apis)} APIs extracted.")
    print(f"Saved to: {OUTPUT_FILE}")


if __name__ == "__main__":
    asyncio.run(main())
