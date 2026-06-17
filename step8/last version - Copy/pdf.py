import json
import os
import requests

PDF_DIR = "pdfs"
os.makedirs(PDF_DIR, exist_ok=True)

with open("master_dataset.json", "r", encoding="utf-8") as f:
    data = json.load(f)

pdf_urls = []

for page in data["pages"]:
    if "pdf" in page["url"].lower():
        pdf_urls.append(page["url"])

results = []

for url in pdf_urls:
    try:
        print(f"Downloading: {url}")

        r = requests.get(url, timeout=30)
        r.raise_for_status()

        fname = url.split("/")[-1]
        path = os.path.join(PDF_DIR, fname)

        with open(path, "wb") as f:
            f.write(r.content)

        results.append({"url": url, "status": "downloaded", "path": path})
    except Exception as e:
        results.append({"url": url, "status": "failed", "error": str(e)})
        print(f"Failed: {url} ({e})")

with open("pdf_download_results.json", "w") as f:
    json.dump({"results": results}, f, indent=2)
