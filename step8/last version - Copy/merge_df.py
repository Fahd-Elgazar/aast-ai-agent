import json
import os
import hashlib
from urllib.parse import urlparse, urlunparse

# ===============================
# INPUT PATHS (your real paths)
# ===============================
path_v2 = r"C:\Users\mh978\Downloads\aast_scrape_final\last version\aast_v5_output_20251129_220740\dataset_v2.json"
path_clean = r"C:\Users\mh978\Downloads\aast_scrape_final\step8\clean_unified_dataset.json"
path_normalized = r"C:\Users\mh978\Downloads\aast_scrape_final\step8\aast_normalized.jsonl"

# ===============================
# OUTPUT PATH
# ===============================
output_path = r"C:\Users\mh978\Downloads\aast_scrape_final\final df\rag_dataset.jsonl"

os.makedirs(os.path.dirname(output_path), exist_ok=True)


# ===============================
# URL Normalization Helper
# ===============================
def normalize_url(url):
    if not url or not isinstance(url, str):
        return None
    try:
        p = urlparse(url.strip())
        scheme = p.scheme or "https"
        netloc = p.netloc.lower()
        path = p.path or "/"
        if netloc.endswith(":80"):
            netloc = netloc[:-3]
        return urlunparse((scheme, netloc, path.rstrip("/"), "", "", ""))
    except:
        return url.strip()


def make_id(url):
    return hashlib.sha1(url.encode("utf-8")).hexdigest()


# ===============================
# Storage
# ===============================
records = {}  # normalized_url -> entry


def add_entry(url, title, content, source, metadata=None):
    if not url:
        return
    n_url = normalize_url(url)
    if not n_url:
        return

    rec = records.get(n_url, {
        "id": make_id(n_url),
        "url": n_url,
        "title": None,
        "content": None,
        "sources": [],
        "metadata": {}
    })

    # fill title
    if title and not rec["title"]:
        rec["title"] = str(title).strip()

    # fill content
    if content and not rec["content"]:
        rec["content"] = " ".join(str(content).split())

    # record source
    if source not in rec["sources"]:
        rec["sources"].append(source)

    # merge metadata
    if metadata and isinstance(metadata, dict):
        for k, v in metadata.items():
            if k not in rec["metadata"]:
                rec["metadata"][k] = v

    records[n_url] = rec


# ===============================
# 1) Load clean_unified_dataset.json (highest priority)
# ===============================
print("[1] Loading CLEAN dataset...")

if os.path.exists(path_clean):
    with open(path_clean, "r", encoding="utf-8") as f:
        data = json.load(f)

    if isinstance(data, list):
        entries = data
    elif isinstance(data, dict):
        entries = data.get("pages", data)
        if isinstance(entries, dict):
            entries = [entries]
    else:
        entries = []

    for e in entries:
        url = e.get("url") or e.get("canonical") or e.get("source") or e.get("path")
        title = e.get("title") or e.get("name")
        content = (
            e.get("text") or
            e.get("content") or
            e.get("raw_text") or
            e.get("extract") or
            e.get("extract_text")
        )
        if isinstance(content, dict) and "raw_text" in content:
            content = content["raw_text"]

        add_entry(url, title, content, "clean_unified", metadata=e)

else:
    print("❌ clean_unified_dataset.json not found.")


# ===============================
# 2) Load aast_normalized.jsonl (2nd priority)
# ===============================
print("[2] Loading NORMALIZED dataset...")

if os.path.exists(path_normalized):
    with open(path_normalized, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                j = json.loads(line)
            except:
                continue

            url = j.get("url") or j.get("canonical") or j.get("source")
            title = j.get("title") or j.get("name")
            content = j.get("content") or j.get("text") or j.get("raw_text")

            add_entry(url, title, content, "aast_normalized", metadata=j)

else:
    print("❌ aast_normalized.jsonl not found.")


# ===============================
# 3) Load dataset_v2.json (fallback content)
# ===============================
print("[3] Loading RAW v2 dataset...")

if os.path.exists(path_v2):
    with open(path_v2, "r", encoding="utf-8") as f:
        data = json.load(f)

    pages = []
    if isinstance(data, dict) and isinstance(data.get("pages"), list):
        pages = data["pages"]
    elif isinstance(data, list):
        pages = data

    for e in pages:
        url = e.get("url") or e.get("canonical")
        title = e.get("title")
        extract = e.get("extract")
        content = None
        if isinstance(extract, dict) and "raw_text" in extract:
            content = extract["raw_text"]

        add_entry(url, title, content, "dataset_v2", metadata=e)

else:
    print("❌ dataset_v2.json not found.")


# ===============================
# SAVE JSONL
# ===============================
print("[4] Saving final RAG dataset...")

with open(output_path, "w", encoding="utf-8") as out:
    for rec in records.values():
        out.write(json.dumps(rec, ensure_ascii=False) + "\n")

print("\n====================================")
print("✅ DONE! RAG dataset created at:")
print(output_path)
print("Total unique pages:", len(records))
print("====================================")
