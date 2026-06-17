#!/usr/bin/env python3
"""
dataset_v2_builder.py

Phase 4 -> Phase 5 combined:
- Reads raw crawler output produced by Ultra Fetcher V5
  (folders: api/, html/, calls/, json/, files/, .ultra_cache_v5.json)
- Extracts structured information from API JSON and HTML fallback
- Cleans and normalizes data (IDs, whitespace, duplicates)
- Produces dataset_v2/ with:
    - master_dataset_v2.json
    - pages_v2.xlsx
    - api_v2.xlsx
    - content_v2.xlsx
    - relationships_v2.xlsx
    - attachments_v2.xlsx
    - report_v2.json

Usage:
    python dataset_v2_builder.py
    python dataset_v2_builder.py --raw /path/to/aast_v5_output_XXXX


"""

import argparse
import json
import re
import sys
import traceback
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple

# third-party libs
try:
    import pandas as pd
    from bs4 import BeautifulSoup
except Exception as e:
    print("Missing dependency. Install: pip install pandas openpyxl beautifulsoup4")
    raise

# -----------------------
# CONFIG (edit if needed)
# -----------------------
DEFAULT_RAW = "aast_v5_output_20251129_220740"  # change if your folder name differs
OUT_BASE = Path("dataset_v2")

# -----------------------
# UTILITIES
# -----------------------
def now_iso():
    return datetime.utcnow().isoformat() + "Z"

def safe_load_json(path: Path) -> Optional[Any]:
    try:
        return json.loads(path.read_text(encoding="utf8", errors="ignore"))
    except Exception:
        return None

def clean_space(s: Optional[str]) -> Optional[str]:
    if s is None:
        return None
    # normalize newlines and spaces; remove repeated whitespace
    out = re.sub(r'\s+', ' ', str(s)).strip()
    return out if out != "" else None

def extract_ids_from_url(url: str) -> Dict[str,str]:
    # parse common query params and return small map
    out = {}
    if not url:
        return out
    try:
        from urllib.parse import urlparse, parse_qs
        p = urlparse(url)
        qs = parse_qs(p.query, keep_blank_values=True)
        for k in ("unit_id", "page_id", "program_id", "ser", "id", "pid", "gallery_id"):
            v = qs.get(k)
            if v:
                out[k] = v[0]
    except Exception:
        pass
    return out

def safe_json_dumps(obj):
    try:
        return json.dumps(obj, ensure_ascii=False)
    except Exception:
        # fallback: stringify
        return json.dumps(str(obj), ensure_ascii=False)

# -----------------------
# LOADING RAW FILES
# -----------------------
def load_results_json(raw_folder: Path) -> List[Dict[str,Any]]:
    path = raw_folder / "json" / "results.json"
    if not path.exists():
        # try results_1.json etc.
        candidates = list((raw_folder / "json").glob("results*.json"))
        if candidates:
            path = candidates[0]
        else:
            raise FileNotFoundError(f"results.json not found under {raw_folder / 'json'}")
    r = safe_load_json(path)
    if not isinstance(r, list):
        raise ValueError("results.json must be a list of objects")
    return r

def list_api_files(raw_folder: Path) -> List[Path]:
    api_dir = raw_folder / "api"
    if not api_dir.exists():
        return []
    return sorted([p for p in api_dir.iterdir() if p.is_file() and p.suffix.lower() == ".json"])

def list_html_files(raw_folder: Path) -> List[Path]:
    html_dir = raw_folder / "html"
    if not html_dir.exists():
        return []
    return sorted([p for p in html_dir.rglob("*.html")])

def list_calls_files(raw_folder: Path) -> List[Path]:
    calls_dir = raw_folder / "calls"
    if not calls_dir.exists():
        return []
    return sorted([p for p in calls_dir.glob("*.calls.json")])

def list_files(raw_folder: Path) -> List[Path]:
    files_dir = raw_folder / "files"
    if not files_dir.exists():
        return []
    return sorted([p for p in files_dir.iterdir() if p.is_file()])

# -----------------------
# API PARSING & CLASSIFICATION
# -----------------------
def classify_api_by_name(name: str) -> str:
    n = name.lower()
    if "getprogramdata2021" in n or "program" in n:
        return "program"
    if "getpagecontent2021" in n or "contenttemp" in n:
        return "page_content"
    if "getpagecontentitems2021" in n:
        return "page_content_items"
    if "getcvnew" in n or "cv" in n:
        return "staff_cv"
    if "retreiveonepic" in n or "retreivegallery" in n or "pic" in n:
        return "media"
    return "unknown"

def parse_api_json(path: Path) -> Tuple[str, Optional[Any]]:
    raw = safe_load_json(path)
    t = classify_api_by_name(path.name)
    return t, raw

# -----------------------
# HTML PARSING HELPERS
# -----------------------
def html_to_text(path: Path) -> str:
    try:
        txt = path.read_text(encoding="utf8", errors="ignore")
        soup = BeautifulSoup(txt, "lxml")
        # remove scripts/styles
        for s in soup(["script", "style", "noscript"]):
            s.decompose()
        return soup.get_text(" ", strip=True)
    except Exception:
        return ""

def parse_events_index_from_html(path: Path) -> Dict[str,Any]:
    # best-effort: parse list of events from HTML
    try:
        raw = path.read_text(encoding="utf8", errors="ignore")
        soup = BeautifulSoup(raw, "lxml")
        res = {"items":[]}
        # common pattern: event tiles with links
        anchors = soup.select("a[href*='event-details'], .event, .events-list a")
        seen = set()
        for a in anchors[:500]:
            href = a.get("href") or ""
            title = a.get_text(" ", strip=True)
            if not title:
                # maybe image alt or child
                title = a.find("img")["alt"] if a.find("img") and a.find("img").get("alt") else title
            if href and href not in seen:
                seen.add(href)
                res["items"].append({"title": clean_space(title), "href": href})
        # fallback: look for <li> items with dates
        if not res["items"]:
            for li in soup.select("li"):
                text = li.get_text(" ", strip=True)
                if len(text) > 30 and ("event" in text.lower() or "date" in text.lower()):
                    res["items"].append({"title": clean_space(text)})
        return res
    except Exception:
        return {"items":[]}

# -----------------------
# BUILD DATAFRAMES
# -----------------------
def build_pages_df(raw_folder: Path, results: List[Dict[str,Any]]) -> pd.DataFrame:
    rows = []
    for r in results:
        url = r.get("url")
        canonical = r.get("canonical") or url
        status = r.get("status")
        path = r.get("path")
        error = r.get("error")
        dup_of = r.get("dup_of")
        ids = extract_ids_from_url(url or "")
        rows.append({
            "url": url,
            "canonical": canonical,
            "status": status,
            "path": path,
            "error": clean_space(error) if isinstance(error, str) else error,
            "dup_of": dup_of,
            "ids": ids
        })
    df = pd.DataFrame(rows)
    # normalize: canonical unique index
    df["canonical"] = df["canonical"].apply(lambda x: clean_space(x) if x else x)
    df = df.drop_duplicates(subset=["url"])
    return df

def build_api_df(raw_folder: Path, api_files: List[Path]) -> pd.DataFrame:
    rows = []
    for p in api_files:
        api_type, parsed = parse_api_json(p)
        rows.append({
            "api_file": p.name,
            "path": str(p),
            "api_type": api_type,
            # store raw as string to keep excel-friendly
            "json_raw": safe_json_dumps(parsed) if parsed is not None else None,
            "parsed": parsed
        })
    df = pd.DataFrame(rows)
    # dedupe by path
    df = df.drop_duplicates(subset=["path"])
    return df

def build_content_df(api_df: pd.DataFrame, html_files: List[Path]) -> pd.DataFrame:
    rows = []
    # from API sources
    for _, r in api_df.iterrows():
        api_type = r["api_type"]
        parsed = r["parsed"]
        base = {"api_file": r["api_file"], "api_type": api_type, "api_path": r["path"]}
        if api_type == "program" and isinstance(parsed, dict):
            # adaptive extraction
            name = parsed.get("program_name") or parsed.get("title") or parsed.get("name")
            pid = parsed.get("program_id") or parsed.get("id")
            unit = parsed.get("unit_id") or parsed.get("unit")
            description = parsed.get("program_description") or parsed.get("description") or parsed.get("content")
            courses = parsed.get("courses") or parsed.get("modules") or None
            rows.append({**base,
                         "program_id": pid,
                         "unit_id": unit,
                         "name": clean_space(name),
                         "description": clean_space(description),
                         "courses_raw": safe_json_dumps(courses) if courses is not None else None})
        elif api_type in ("page_content", "page_content_items") and isinstance(parsed, dict):
            title = parsed.get("title") or parsed.get("page_title") or None
            content = parsed.get("content") or parsed.get("html") or parsed.get("page_content") or None
            rows.append({**base, "page_title": clean_space(title), "page_content_raw": clean_space(content)})
        elif api_type == "staff_cv" and isinstance(parsed, dict):
            name = parsed.get("name_en") or parsed.get("name")
            ser = parsed.get("ser")
            email = parsed.get("email")
            pos = parsed.get("position")
            rows.append({**base, "staff_ser": ser, "staff_name": clean_space(name), "staff_email": email, "staff_position": clean_space(pos)})
        else:
            # unknown but keep raw
            rows.append({**base, "note": "unknown_api_type"})
    # fallback: extract some pages from HTML (events, lists)
    for html_path in html_files:
        try:
            rel = str(html_path)
            text = html_to_text(html_path)
            # heuristics to detect events list and event details
            if re.search(r"\bevent-details\b", rel) or "event-details" in text.lower() or "event" in rel.lower():
                parsed_ev = parse_events_index_from_html(html_path)
                rows.append({"api_file": None, "api_type": "html_events", "api_path": rel, "page_title": None, "page_content_raw": None, "events": parsed_ev})
        except Exception:
            pass
    df = pd.DataFrame(rows)
    # normalization: ensure columns exist
    expected = ["api_file", "api_type", "api_path", "program_id", "unit_id", "name", "description", "courses_raw",
                "page_title", "page_content_raw", "staff_ser", "staff_name", "staff_email", "staff_position", "note"]
    for col in expected:
        if col not in df.columns:
            df[col] = None
    return df

def build_relationships_df(content_df: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for _, r in content_df.iterrows():
        if r.get("api_type") == "program" and r.get("courses_raw"):
            try:
                courses = json.loads(r["courses_raw"])
                if isinstance(courses, list):
                    for c in courses:
                        if isinstance(c, dict):
                            cname = c.get("course_name") or c.get("name") or None
                        else:
                            cname = c
                        rows.append({"program_id": r.get("program_id"), "program_name": r.get("name"), "course_name": clean_space(cname)})
            except Exception:
                continue
    return pd.DataFrame(rows)

def build_attachments_df(raw_folder: Path, files_list: List[Path]) -> pd.DataFrame:
    rows = []
    for p in files_list:
        try:
            rows.append({
                "file_name": p.name,
                "path": str(p),
                "size": p.stat().st_size
            })
        except Exception:
            pass
    return pd.DataFrame(rows)

# -----------------------
# CLEANING STEPS (on dataframes)
# -----------------------
def clean_pages_df(df: pd.DataFrame) -> pd.DataFrame:
    # normalize canonical and url, drop empty urls
    df = df.dropna(subset=["url"]).copy()
    df["url"] = df["url"].astype(str)
    df["canonical"] = df["canonical"].astype(str)
    df["status"] = df["status"].astype(str)
    # fill ids empty dicts
    df["ids"] = df["ids"].apply(lambda x: x if isinstance(x, dict) else {})
    return df

def clean_api_df(df: pd.DataFrame) -> pd.DataFrame:
    # remove entries with no json_raw
    df = df.copy()
    df = df[df["json_raw"].notnull()]
    # ensure string types for excel
    df["json_raw"] = df["json_raw"].astype(str)
    return df

def clean_content_df(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    # trim long description
    if "description" in df.columns:
        df["description"] = df["description"].apply(lambda s: clean_space(s) if isinstance(s, str) else s)
    # unify ids as strings
    for cid in ("program_id","unit_id","staff_ser"):
        if cid in df.columns:
            df[cid] = df[cid].apply(lambda v: str(v) if v is not None else None)
    return df

# -----------------------
# OUTPUT (excel + master json)
# -----------------------
def write_excel(df: pd.DataFrame, path: Path):
    try:
        df.to_excel(path, index=False)
    except Exception as e:
        # fallback: convert complex columns to string and retry
        for c in df.columns:
            if df[c].dtype == object:
                df[c] = df[c].apply(lambda x: safe_json_dumps(x) if not isinstance(x, (str, int, float)) else x)
        df.to_excel(path, index=False)

def write_master_json(out_path: Path, pages_df: pd.DataFrame, api_df: pd.DataFrame, content_df: pd.DataFrame,
                      rel_df: pd.DataFrame, attachments_df: pd.DataFrame, report: dict):
    master = {
        "meta": {
            "generated_at": now_iso(),
            "report": report
        },
        "pages": pages_df.to_dict(orient="records"),
        "apis": api_df.to_dict(orient="records"),
        "content": content_df.to_dict(orient="records"),
        "relationships": rel_df.to_dict(orient="records"),
        "attachments": attachments_df.to_dict(orient="records")
    }
    out_path.write_text(json.dumps(master, ensure_ascii=False, indent=2), encoding="utf8")

# -----------------------
# MAIN
# -----------------------
def build_dataset_v2(raw_folder: Path, out_base: Path):
    try:
        out_base.mkdir(parents=True, exist_ok=True)
        # load raw
        results = load_results_json(raw_folder)
        api_files = list_api_files(raw_folder)
        html_files = list_html_files(raw_folder)
        calls_files = list_calls_files(raw_folder)
        file_blobs = list_files(raw_folder)

        # build dfs
        pages_df = build_pages_df(raw_folder, results)
        api_df = build_api_df(raw_folder, api_files)
        content_df = build_content_df(api_df, html_files)
        rel_df = build_relationships_df(content_df)
        attachments_df = build_attachments_df(raw_folder, file_blobs)

        # cleaning
        pages_df = clean_pages_df(pages_df)
        api_df = clean_api_df(api_df)
        content_df = clean_content_df(content_df)

        # write outputs
        write_excel(pages_df, out_base / "pages_v2.xlsx")
        write_excel(api_df.drop(columns=["parsed"], errors="ignore"), out_base / "api_v2.xlsx")
        write_excel(content_df, out_base / "content_v2.xlsx")
        write_excel(rel_df, out_base / "relationships_v2.xlsx")
        write_excel(attachments_df, out_base / "attachments_v2.xlsx")

        # prepare report
        report = {
            "pages_count": len(pages_df),
            "api_files_count": len(api_files),
            "api_rows": len(api_df),
            "content_rows": len(content_df),
            "relationships": len(rel_df),
            "attachments": len(attachments_df),
            "html_files_count": len(html_files),
            "calls_files_count": len(calls_files)
        }
        # master json
        write_master_json(out_base / "master_dataset_v2.json", pages_df, api_df.drop(columns=["parsed"], errors="ignore"), content_df, rel_df, attachments_df, report)

        # write report json
        (out_base / "report_v2.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf8")

        print("Dataset_v2 build complete.")
        print("Outputs in:", str(out_base.resolve()))
        return report
    except Exception as e:
        print("Error building dataset_v2:", e)
        traceback.print_exc()
        raise

# -----------------------
# CLI handling
# -----------------------
def parse_args():
    p = argparse.ArgumentParser(description="Build dataset_v2 from Ultra Fetcher output")
    p.add_argument("--raw", type=str, default=DEFAULT_RAW, help="raw output folder name (default: %s)" % DEFAULT_RAW)
    p.add_argument("--out", type=str, default=str(OUT_BASE), help="output folder for dataset_v2 (default: dataset_v2)")
    return p.parse_args()

if __name__ == "__main__":
    args = parse_args()
    raw_folder = Path(args.raw)
    if not raw_folder.exists():
        print(f"Raw folder not found: {raw_folder}. Provide correct path with --raw")
        sys.exit(2)
    out_base = Path(args.out)
    r = build_dataset_v2(raw_folder, out_base)
    print("Report:", json.dumps(r, ensure_ascii=False, indent=2))
