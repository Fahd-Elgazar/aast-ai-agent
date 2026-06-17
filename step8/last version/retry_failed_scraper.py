import json
import asyncio
from playwright.async_api import async_playwright
import random
import os
import time

RETRIES = 3
TIMEOUT = 60000  # 60 seconds
OUT_DIR = "retry_output"

os.makedirs(OUT_DIR, exist_ok=True)

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    "Mozilla/5.0 (X11; Linux x86_64)"
]

async def fetch_page(url, browser):
    for attempt in range(1, RETRIES + 1):
        try:
            context = await browser.new_context(
                user_agent=random.choice(USER_AGENTS)
            )
            page = await context.new_page()
            print(f"[TRY {attempt}] {url}")

            await page.goto(url, timeout=TIMEOUT, wait_until="domcontentloaded")

            fname = url.replace("https://", "").replace("http://", "")
            fname = fname.replace("/", "_").replace("?", "_").replace("&", "_")
            path = os.path.join(OUT_DIR, f"{fname}.html")

            html = await page.content()
            with open(path, "w", encoding="utf-8") as f:
                f.write(html)

            await context.close()
            print(f"[SUCCESS] {url}")
            return {"url": url, "status": "saved", "path": path}

        except Exception as e:
            print(f"[ERROR] Attempt {attempt} for {url}: {e}")
            await context.close()
            time.sleep(2)  # small delay before retry
    
    print(f"[FAILED] {url} after {RETRIES} attempts")
    return {"url": url, "status": "failed", "error": str(e)}

async def main():
    with open("failed_urls.json", "r") as f:
        urls = json.load(f)["failed_urls"]

    results = []

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)

        for url in urls:
            result = await fetch_page(url, browser)
            results.append(result)

        await browser.close()

    with open("retry_results.json", "w") as f:
        json.dump({"results": results}, f, indent=2)

asyncio.run(main())
