import os
import json
import re
from pathlib import Path
from bs4 import BeautifulSoup
import pandas as pd


###########################################
# CONFIG
###########################################

BASE_FOLDER = Path("aast_v5_output_20251129_220740")   # <<< CHANGE IF NEEDED
HTML_FOLDER = BASE_FOLDER / "html"
API_FOLDER = BASE_FOLDER / "api"
CALLS_FOLDER = BASE_FOLDER / "calls"
RESULTS_JSON = BASE_FOLDER / "json" / "results.json"

OUT_JSON = BASE_FOLDER / "dataset_v2.json"
OUT_XLSX = BASE_FOLDER / "dataset_v2.xlsx"


###########################################
# HELPERS
###########################################

def clean_text(txt):
    if not txt:
        return ""
    txt = re.sub(r"\s+", " ", txt)
    return txt.strip()


def detect_page_type(html):
    """Simple heuristic classifier"""
    h = html.lower()

    if "event-details" in h:
        return "event_details"

    if "news-details" in h:
        return "news_details"

    if "program" in h and "course" in h:
        return "program"

    if "cv" in h and "staff" in h:
        return "cv"

    if "events" in h and "unit_id" in h:
        return "events_index"

    if "<table" in h:
        return "table_page"

    return "generic"


def extract_event_items(soup):
    items = []

    for card in soup.select(".event-block, .news-block, .item-block"):
        title = clean_text(card.get_text(" ", strip=True))
        link = card.find("a")
        link = link["href"] if link and link.get("href") else None

        items.append({
            "title": title,
            "link": link
        })

    return items


def extract_generic_text(soup):
    text = soup.get_text(" ", strip=True)
    text = clean_text(text)
    return text[:5000]   # limit to 5k chars


###########################################
# MAIN PROCESSOR
###########################################

def process_html(path):
    try:
        html = Path(path).read_text(encoding="utf-8", errors="ignore")
    except:
        return None

    soup = BeautifulSoup(html, "lxml")
    ptype = detect_page_type(html)

    output = {"page_type": ptype}

    if ptype == "events_index":
        output["events"] = extract_event_items(soup)

    elif ptype == "event_details":
        title = soup.find("h1")
        desc = extract_generic_text(soup)
        output["title"] = clean_text(title.get_text() if title else "")
        output["description"] = desc

    elif ptype == "news_details":
        title = soup.find("h1")
        output["title"] = clean_text(title.get_text() if title else "")
        output["content"] = extract_generic_text(soup)

    else:
        output["raw_text"] = extract_generic_text(soup)

    return output


def process_api(path):
    try:
        txt = Path(path).read_text(encoding="utf-8", errors="ignore")
        return json.loads(txt)
    except:
        return None


###########################################
# RUN EXTRACTION
###########################################

def run_phase5():
    print("=== PHASE 5: dataset_v2 Extractor ===")

    if not RESULTS_JSON.exists():
        print("ERROR: results.json not found.")
        return

    raw_entries = json.loads(RESULTS_JSON.read_text(encoding="utf-8"))
    print(f"[LOADED] {len(raw_entries)} crawler records")

    records = []

    for row in raw_entries:
        url = row.get("url")
        path = row.get("path")
        status = row.get("status")

        record = {
            "url": url,
            "canonical": row.get("canonical"),
            "status": status,
            "path": path,
            "extract": None,
        }

        # -----------------------------------------------
        # HTML Extraction
        # -----------------------------------------------
        if status in ("http_saved", "pw_saved"):
            if path and Path(path).exists():
                rec = process_html(path)
                record["extract"] = rec

        # -----------------------------------------------
        # API Extraction
        # -----------------------------------------------
        if status == "saved" and "api" in path.lower():
            if path and Path(path).exists():
                rec = process_api(path)
                record["extract"] = rec

        records.append(record)

    print(f"[DONE] Extracted {len(records)} entries")

    ###############################################
    # SAVE FINAL DATASET (JSON + EXCEL)
    ###############################################

    print("[SAVE] Writing dataset_v2.json")
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)

    print("[SAVE] Writing dataset_v2.xlsx")
    df = pd.DataFrame(records)
    df["extract"] = df["extract"].apply(lambda x: json.dumps(x, ensure_ascii=False))
    df.to_excel(OUT_XLSX, index=False)

    print("\n=== COMPLETE ===")
    print("JSON :", OUT_JSON)
    print("Excel:", OUT_XLSX)


###########################################
# ENTRY POINT
###########################################

if __name__ == "__main__":
    run_phase5()
