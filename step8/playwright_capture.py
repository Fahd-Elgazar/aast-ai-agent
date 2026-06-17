import asyncio
import json
import os
import re
from playwright.async_api import async_playwright

SEED_PAGES_FILE = "discovery_seed_links.json"
OUT_DIR = "playwright_captures"
os.makedirs(OUT_DIR, exist_ok=True)


def sanitize_filename(url):
    """Remove illegal characters for Windows filenames."""
    safe = re.sub(r'[<>:"/\\|?*]', "_", url)
    return safe[:200]


async def record_response(resp, calls):
    try:
        url = resp.url
        status = resp.status
        ct = resp.headers.get("content-type", "")
        sample = None
        if "json" in ct or "html" in ct or "text" in ct:
            try:
                body = await resp.text()
                sample = body[:10000]
            except:
                sample = None
        calls.append({
            "type": "response",
            "url": url,
            "status": status,
            "content_type": ct,
            "sample": sample
        })
    except Exception as e:
        calls.append({"error": str(e)})


async def render_page(context, url):
    page = await context.new_page()
    calls = []

    page.on("request", lambda req: calls.append({
        "type": "request",
        "url": req.url,
        "method": req.method,
        "post": req.post_data,
    }))
    page.on("response", lambda resp: asyncio.create_task(record_response(resp, calls)))

    for attempt in range(3):
        try:
            print(f"[OPEN ATTEMPT {attempt+1}] {url}")
            await page.goto(url, timeout=25000, wait_until="domcontentloaded")
            break
        except Exception as e:
            print(f"[RETRY] {url} → {e}")
            await asyncio.sleep(2)
    else:
        print(f"[FAIL] {url}")
        await page.close()
        return

    # Let JS load
    await page.wait_for_timeout(3500)

    # Scroll to trigger lazy content
    try:
        await page.evaluate("""
            async () => {
                for (let i=0;i<5;i++){
                    window.scrollBy(0, window.innerHeight/2);
                    await new Promise(r=>setTimeout(r,500));
                }
            }
        """)
    except:
        pass

    html = await page.content()

    safe_name = sanitize_filename(url)
    html_path = os.path.join(OUT_DIR, safe_name + ".html")
    json_path = html_path + ".calls.json"

    with open(html_path, "w", encoding="utf8") as f:
        f.write(html)

    with open(json_path, "w", encoding="utf8") as f:
        json.dump(calls, f, indent=2, ensure_ascii=False)

    print(f"[SAVED] {html_path}")

    await page.close()


async def run():
    with open(SEED_PAGES_FILE, "r", encoding="utf8") as f:
        data = json.load(f)

    seeds = [p["url"] for p in data["pages"]]
    print(f"[INFO] Loaded {len(seeds)} seeds")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()

        for url in seeds:
            await render_page(context, url)

        await browser.close()


if __name__ == "__main__":
    asyncio.run(run())
