"""
PHASE 4 — MASTER DATASET EXTRACTOR (JSON + EXCEL ONLY)
------------------------------------------------------
Creates:
    dataset/
        master_dataset.json
        pages_df.xlsx
        api_df.xlsx
        content_df.xlsx
        relationships_df.xlsx
        attachments_df.xlsx
"""

import json
import pandas as pd
from pathlib import Path
from bs4 import BeautifulSoup

# =========================================================
# CONFIG
# =========================================================

BASE_DIR = Path(__file__).resolve().parent
RAW_FOLDER = BASE_DIR / "aast_v5_output_20251129_220740"   # <-- adjust if needed

OUT_FOLDER = BASE_DIR / "dataset"
OUT_FOLDER.mkdir(exist_ok=True)

API_DIR = RAW_FOLDER / "api"
HTML_DIR = RAW_FOLDER / "html"
CALLS_DIR = RAW_FOLDER / "calls"
JSON_DIR = RAW_FOLDER / "json"
FILES_DIR = RAW_FOLDER / "files"

# =========================================================
# UTILS
# =========================================================

def load_json_file(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf8", errors="ignore"))
    except Exception:
        return None


def classify_api(api_json, file_name: str):
    name = file_name.lower()

    if "getpagecontent2021" in name:
        return "page_content"
    if "getpagecontentitems2021" in name:
        return "page_content_items"
    if "getprogramdata2021" in name:
        return "program"
    if "getcvnew" in name:
        return "staff_cv"
    if "gallery" in name:
        return "gallery"
    return "unknown"


# =========================================================
# STEP 1 — pages_df
# =========================================================

def build_pages_df():
    print("[1] Building pages_df...")

    results_file = JSON_DIR / "results.json"
    results = load_json_file(results_file)

    rows = []

    for r in results:
        rows.append({
            "url": r.get("url"),
            "canonical": r.get("canonical"),
            "status": r.get("status"),
            "path": r.get("path"),
            "error": r.get("error"),
            "dup_of": r.get("dup_of")
        })

    df = pd.DataFrame(rows).drop_duplicates()

    df.to_excel(OUT_FOLDER / "pages_df.xlsx", index=False)

    print("[1] pages_df saved.")
    return df


# =========================================================
# STEP 2 — api_df
# =========================================================

def build_api_df():
    print("[2] Building api_df...")

    rows = []
    for f in API_DIR.glob("*.json"):
        api_json = load_json_file(f)
        if api_json is None:
            continue

        rows.append({
            "api_file": f.name,
            "api_type": classify_api(api_json, f.name),
            "json_raw": json.dumps(api_json, ensure_ascii=False)
        })

    df = pd.DataFrame(rows)
    df.to_excel(OUT_FOLDER / "api_df.xlsx", index=False)

    print("[2] api_df saved.")
    return df


# =========================================================
# STEP 3 — content_df
# =========================================================

def extract_program(api_json):
    return {
        "program_name": api_json.get("program_name"),
        "program_id": api_json.get("program_id"),
        "unit_id": api_json.get("unit_id"),
        "description": api_json.get("program_description"),
        "courses_raw": json.dumps(api_json.get("courses"), ensure_ascii=False)
    }


def extract_page_content(api_json):
    return {
        "title": api_json.get("title"),
        "content": api_json.get("content")
    }


def extract_cv(api_json):
    return {
        "name": api_json.get("name_en") or api_json.get("name"),
        "email": api_json.get("email"),
        "position": api_json.get("position"),
        "ser": api_json.get("ser"),
    }


def build_content_df(api_df):
    print("[3] Building content_df...")

    rows = []

    for _, r in api_df.iterrows():
        api_raw = json.loads(r["json_raw"])
        api_type = r["api_type"]

        base = {"api_file": r["api_file"], "api_type": api_type}

        if api_type == "program":
            content = extract_program(api_raw)
        elif api_type in ["page_content", "page_content_items"]:
            content = extract_page_content(api_raw)
        elif api_type == "staff_cv":
            content = extract_cv(api_raw)
        else:
            content = {}

        rows.append({**base, **content})

    df = pd.DataFrame(rows)
    df.to_excel(OUT_FOLDER / "content_df.xlsx", index=False)

    print("[3] content_df saved.")
    return df


# =========================================================
# STEP 4 — relationships_df
# =========================================================

def build_relationships_df(content_df):
    print("[4] Building relationships_df...")

    rows = []

    for _, r in content_df.iterrows():
        if r["api_type"] != "program":
            continue

        if not isinstance(r.get("courses_raw"), str):
            continue

        try:
            courses = json.loads(r["courses_raw"])
            if isinstance(courses, list):
                for c in courses:
                    rows.append({
                        "program_id": r.get("program_id"),
                        "program_file": r["api_file"],
                        "course_name": c.get("course_name") if isinstance(c, dict) else c
                    })
        except:
            pass

    df = pd.DataFrame(rows)
    df.to_excel(OUT_FOLDER / "relationships_df.xlsx", index=False)

    print("[4] relationships_df saved.")
    return df


# =========================================================
# STEP 5 — attachments_df
# =========================================================

def build_attachments_df():
    print("[5] Building attachments_df...")

    rows = []
    for f in FILES_DIR.iterdir():
        if f.is_file():
            rows.append({
                "file": f.name,
                "size": f.stat().st_size,
                "path": str(f)
            })

    df = pd.DataFrame(rows)
    df.to_excel(OUT_FOLDER / "attachments_df.xlsx", index=False)

    print("[5] attachments_df saved.")
    return df


# =========================================================
# MASTER JSON (ALL DATA)
# =========================================================

def build_master_json(dfs):
    print("[6] Building master_dataset.json...")

    final = {
        "pages": dfs["pages"].to_dict(orient="records"),
        "apis": dfs["apis"].to_dict(orient="records"),
        "content": dfs["content"].to_dict(orient="records"),
        "relationships": dfs["relations"].to_dict(orient="records"),
        "attachments": dfs["attachments"].to_dict(orient="records")
    }

    (OUT_FOLDER / "master_dataset.json").write_text(
        json.dumps(final, ensure_ascii=False, indent=2),
        encoding="utf8"
    )

    print("[6] master_dataset.json saved.")


# =========================================================
# MAIN
# =========================================================

def main():
    print("=== PHASE 4: Extracting Structured Dataset (JSON + EXCEL ONLY) ===")

    pages_df = build_pages_df()
    api_df = build_api_df()
    content_df = build_content_df(api_df)
    relations_df = build_relationships_df(content_df)
    attachments_df = build_attachments_df()

    build_master_json({
        "pages": pages_df,
        "apis": api_df,
        "content": content_df,
        "relations": relations_df,
        "attachments": attachments_df
    })

    print("=== DONE. All files saved in /dataset ===")


if __name__ == "__main__":
    main()
