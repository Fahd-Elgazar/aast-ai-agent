import os, json, sqlite3, re, glob
from datetime import datetime
from bs4 import BeautifulSoup

# =======================
# CONFIG
# =======================

BASE = "aast_v2_output"
DB = "aast_normalized.db"
JSONL = "aast_normalized.jsonl"

PATH_HTML = f"{BASE}/html"
PATH_API = f"{BASE}/api"
PATH_FILES = f"{BASE}/files"
PATH_PLAYWRIGHT = f"{BASE}/playwright_captures"

STATIC_INDEX = f"{BASE}/static_index.json"
META_JSON = f"{BASE}/json/meta.json"
RESULTS_JSON = f"{BASE}/json/results.json"
RECORDS_JSONL = f"{BASE}/aast_records.jsonl"


# =======================
# DATABASE INIT
# =======================

conn = sqlite3.connect(DB)
c = conn.cursor()

c.execute("""
CREATE TABLE IF NOT EXISTS pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT,
    page_type TEXT,
    title TEXT,
    language TEXT,
    source TEXT,
    collected_at TEXT,
    raw_text TEXT,
    cleaned_text TEXT,
    json_data TEXT
)
""")

conn.commit()


# =======================
# HELPERS
# =======================

def read_file(path):
    if not os.path.exists(path): return ""
    try:
        return open(path, "r", encoding="utf8", errors="ignore").read()
    except:
        try:
            return open(path, "rb").read().decode("utf8", "ignore")
        except:
            return ""

def extract_title(html):
    if not html: return ""
    m = re.search(r"<title>(.*?)</title>", html, re.I|re.S)
    if m: return m.group(1).strip()
    soup = BeautifulSoup(html, "lxml")
    h1 = soup.find("h1")
    return h1.get_text(strip=True) if h1 else ""

def clean_text(html):
    soup = BeautifulSoup(html, "lxml")
    for tag in soup(["script","style","noscript"]): 
        tag.decompose()
    text = soup.get_text(" ", strip=True)
    text = re.sub(r"\s+", " ", text)
    return text[:5000]  # limit

def detect_language(text):
    if not text: return "unknown"
    arabic = re.findall(r"[\u0600-\u06FF]", text)
    return "ar" if len(arabic) > 30 else "en"


# =======================
# INGEST FUNCTION
# =======================

def ingest_record(url, page_type, source, raw_html, json_data=None):

    title = extract_title(raw_html)
    cleaned = clean_text(raw_html)
    lang = detect_language(cleaned)

    rec = {
        "url": url,
        "page_type": page_type,
        "title": title,
        "language": lang,
        "source": source,
        "collected_at": datetime.utcnow().isoformat()+"Z",
        "raw_text": raw_html[:20000],
        "cleaned_text": cleaned,
        "json_data": json.dumps(json_data, ensure_ascii=False) if json_data else None
    }

    c.execute("""INSERT INTO pages 
        (url,page_type,title,language,source,collected_at,raw_text,cleaned_text,json_data)
        VALUES (?,?,?,?,?,?,?,?,?)""",
        (rec["url"], rec["page_type"], rec["title"], rec["language"],
         rec["source"], rec["collected_at"], rec["raw_text"],
         rec["cleaned_text"], rec["json_data"])
    )
    conn.commit()

    return rec


# =======================
# 1) LOAD STATIC INDEX
# =======================

records_out = []

if os.path.exists(STATIC_INDEX):
    static_data = json.load(open(STATIC_INDEX,"r",encoding="utf8"))
    for p in static_data:
        html = read_file(p.get("file",""))
        rec = ingest_record(
            url=p.get("url"),
            page_type="static",
            source="static_index",
            raw_html=html
        )
        records_out.append(rec)


# =======================
# 2) LOAD META.JSON
# =======================

if os.path.exists(META_JSON):
    meta = json.load(open(META_JSON,"r",encoding="utf8"))
    for p in meta:
        html = read_file(p.get("raw_path",""))
        rec = ingest_record(
            url=p.get("url"),
            page_type=p.get("page_type","unknown"),
            source="meta.json",
            raw_html=html,
            json_data=p
        )
        records_out.append(rec)


# =======================
# 3) LOAD RESULTS.JSON
# =======================

if os.path.exists(RESULTS_JSON):
    results = json.load(open(RESULTS_JSON,"r",encoding="utf8"))
    for p in results:
        html = read_file(p.get("raw_path",""))
        rec = ingest_record(
            url=p.get("url"),
            page_type=p.get("page_type","unknown"),
            source="results.json",
            raw_html=html,
            json_data=p
        )
        records_out.append(rec)


# =======================
# 4) LOAD ALL HTML FILES
# =======================

html_files = glob.glob(f"{PATH_HTML}/**/*.html", recursive=True)
for fp in html_files:
    html = read_file(fp)
    rec = ingest_record(
        url=f"file:///{fp}",
        page_type="html",
        source="html",
        raw_html=html
    )
    records_out.append(rec)


# =======================
# 5) LOAD ALL API RESPONSES
# =======================

api_files = glob.glob(f"{PATH_API}/*.json")

for fp in api_files:
    try:
        # load json file safely
        with open(fp, "r", encoding="utf8", errors="ignore") as f:
            js = json.load(f)

        # Determine the URL field based on structure
        url = fp   # fallback default

        # Case 1: JSON is an object
        if isinstance(js, dict):
            url = js.get("url") or js.get("link") or fp

        # Case 2: JSON is a list (API returned multiple items)
        elif isinstance(js, list):
            # Some API lists contain objects with URLs inside
            if len(js) > 0 and isinstance(js[0], dict):
                url = js[0].get("url") or js[0].get("link") or fp
            else:
                url = fp

        # unknown type → fallback to file path
        else:
            url = fp

        # store record
        rec = ingest_record(
            url=url,
            page_type="api",
            source="api",
            raw_html="",   # API does not have HTML body
            json_data=js
        )

        records_out.append(rec)

    except Exception as e:
        print(f"[API ERROR] Could not load {fp}: {e}")


# =======================
# 6) LOAD AAST_RECORDS.JSONL
# =======================

if os.path.exists(RECORDS_JSONL):
    for line in open(RECORDS_JSONL,"r",encoding="utf8"):
        j = json.loads(line)
        html = read_file(j.get("raw_path",""))
        rec = ingest_record(
            url=j.get("url"),
            page_type=j.get("page_type","unknown"),
            source="records.jsonl",
            raw_html=html,
            json_data=j
        )
        records_out.append(rec)


# =======================
# WRITE JSONL OUTPUT
# =======================

with open(JSONL,"w",encoding="utf8") as out:
    for r in records_out:
        out.write(json.dumps(r, ensure_ascii=False) + "\n")


print("DONE NORMALIZATION V2")
print("Total stored records:", len(records_out))
conn.close()
