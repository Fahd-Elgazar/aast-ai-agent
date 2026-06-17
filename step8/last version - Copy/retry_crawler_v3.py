"""
retry_crawler_v3.py
-------------------------------------
Advanced retrial crawler for broken AAST pages.

Features:
- Reads broken_pages.json from dataset_v2
- Retries HTML + API pages separately
- 3 retry attempts per URL
- Playwright DOM-based scraping + scroll + hover
- Fallback HTTP GET for non-JS pages
- Saves results into recovery_output/
- No UnboundLocalError issues
- Clean JSON logs
"""

import asyncio
import json
import time
from pathlib import Path
from urllib.parse import urlparse

import aiohttp
from playwright.async_api import async_playwright, TimeoutError as PWTimeout
from bs4 import BeautifulSoup

# --------------------------------------
# CONFIG
# --------------------------------------

BASE_DIR = Path(__file__).resolve().parent
DATASET_DIR = BASE_DIR / "dataset_v2"
BROKEN_JSON = DATASET_DIR / "broken_pages.json"

OUT = BASE_DIR / "recovery_output"
OUT_HTML = OUT / "html"
OUT_CALLS = OUT / "calls"
OUT_JSON = OUT / "json"

for p in [OUT, OUT_HTML, OUT_CALLS, OUT_JSON]:
    p.mkdir(parents=True, exist_ok=True)

MAX_RETRIES = 3
HEADLESS = True  # change to False if you want to view browser
TIMEOUT = 25000

# --------------------------------------
# HELPERS
# --------------------------------------

def clean_filename(url: str, suffix: str):
    parsed = urlparse(url)
    base = parsed.netloc.replace(".", "_") + parsed.path.replace("/", "_")
    if parsed.query:
        base += "_" + parsed.query.replace("=", "_").replace("&", "_")
    return f"{base[:200]}_{suffix}.html"


def save_text(path: Path, text: str):
    path.write_text(text, encoding="utf8")
    return str(path)


def save_json(path: Path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf8")


async def http_fallback(url: str):
    """Try normal HTTP GET."""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=10) as resp:
                txt = await resp.text(errors="ignore")
                return resp.status, txt
    except Exception:
        return None, None


# --------------------------------------
# PLAYWRIGHT SCRAPER
# --------------------------------------

async def fetch_with_playwright(url: str, browser):
    """Full DOM rendering + scroll + hover + network logs."""

    page = await browser.new_page()
    page.set_default_timeout(TIMEOUT)
    calls_log = []

    # Log every network request
    page.on("request", lambda req: calls_log.append(
        {"type": "request", "url": req.url, "method": req.method}
    ))

    async def handle_response(resp):
        try:
            calls_log.append({
                "type": "response",
                "url": resp.url,
                "status": resp.status,
                "content_type": resp.headers.get("content-type", "")
            })
        except Exception:
            pass

    page.on("response", lambda r: asyncio.create_task(handle_response(r)))

    try:
        await page.goto(url, wait_until="domcontentloaded")

        # Hover menus
        try:
            for li in await page.query_selector_all("nav li, .menu li, .navbar li"):
                await li.hover()
                await page.wait_for_timeout(60)
        except Exception:
            pass

        # Scroll
        await page.evaluate("""
            async () => {
                for (let i = 0; i < 4; i++) {
                    window.scrollBy(0, window.innerHeight * 0.8);
                    await new Promise(r => setTimeout(r, 200));
                }
            }
        """)

        await page.wait_for_timeout(800)
        html = await page.content()

        await page.close()

        return {"status": "success", "html": html, "calls": calls_log}

    except Exception as e:
        try:
            await page.close()
        except Exception:
            pass
        return {"status": "error", "html": None, "calls": [], "error": str(e)}


# --------------------------------------
# RETRY LOGIC
# --------------------------------------

async def retry_one(url: str, browser):
    """Retry a single broken URL."""
    print(f"\n[RETRY] {url}")

    last_error = None

    for attempt in range(1, MAX_RETRIES + 1):
        print(f"[TRY {attempt}] {url}")

        # --- Playwright attempt ---
        result = await fetch_with_playwright(url, browser)

        if result["status"] == "success":
            print(f"[OK] Success after attempt {attempt}")

            # Save HTML
            html_name = clean_filename(url, f"retry")
            html_path = OUT_HTML / html_name
            save_text(html_path, result["html"])

            # Save calls log
            calls_name = clean_filename(url, "calls").replace(".html", ".json")
            save_json(OUT_CALLS / calls_name, result["calls"])

            return {
                "url": url,
                "status": "success",
                "attempt": attempt,
                "html": str(html_path),
                "calls": str(OUT_CALLS / calls_name),
            }

        last_error = result.get("error") or "Unknown playwright error"
        print(f"[ERR] Playwright failed: {last_error}")

        # --- Fallback ---
        print("[FALLBACK] Trying normal HTTP GET...")
        code, txt = await http_fallback(url)

        if code and txt and len(txt) > 50:
            print(f"[OK] HTTP fallback worked at attempt {attempt}")

            html_name = clean_filename(url, f"http_fallback")
            html_path = OUT_HTML / html_name
            save_text(html_path, txt)

            return {
                "url": url,
                "status": "fallback_success",
                "attempt": attempt,
                "html": str(html_path),
                "calls": None
            }

    return {
        "url": url,
        "status": "failed",
        "error": last_error or "unknown",
        "attempts": MAX_RETRIES
    }


# --------------------------------------
# MAIN
# --------------------------------------

async def main():
    print("[START] retry_crawler_v3")

    if not BROKEN_JSON.exists():
        print("[ERROR] broken_pages.json not found!")
        return

    broken = json.loads(BROKEN_JSON.read_text())
    urls = [row["url"] for row in broken]
    print(f"[LOAD] {len(urls)} broken URLs loaded")

    results = []

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=HEADLESS)

        for url in urls:
            res = await retry_one(url, browser)
            results.append(res)

        await browser.close()

    save_json(OUT_JSON / "retry_results.json", results)
    print("[DONE] Saved retry_results.json")


if __name__ == "__main__":
    asyncio.run(main())
