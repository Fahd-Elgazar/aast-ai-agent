#!/usr/bin/env python3
"""
build_programs_master_v3.py
Robust builder for programs_master (V3).

Inputs (default paths used in your project logs):
 - step8/aast_v2_output/json/meta.json
 - step8/aast_v2_output/json/results.json
 - step8/aast_v2_output/json/clean_unified_dataset.json
 - step8/aast_v2_output/api/*.json
 - step8/aast_v2_output/html/*.html

Outputs:
 - final_dataset/programs_master_v3.csv

Features:
 - Reads API JSON program files and HTML snapshots.
 - Heuristics to detect college and campus.
 - Cleans campus strings to canonical campus names.
 - Prioritizes API authoritative values, falls back to HTML title/text.
 - Uses fuzzy matching (difflib) to match noisy college names to canonical names.
 - Robust to missing fields; lots of logging for diagnostics.
"""

import argparse
import json
import re
import sys
from pathlib import Path
from difflib import SequenceMatcher
from collections import defaultdict
from typing import List, Dict, Tuple, Optional

import pandas as pd
from bs4 import BeautifulSoup

# ---------------------------
# Config / Canonical lists
# ---------------------------

CANONICAL_CAMPUSES = [
    "Alexandria", "Cairo", "Smart Village", "El Alamein", "Heliopolis",
    "Port Said", "South Valley", "Aswan", "Latakia", "Dokki", "Heliopolis",
    "Alamein", "Elalamein"
]

# simplified canonical college name seeds (to map noisy text)
COLLEGE_NAME_SEEDS = [
    "College of Engineering", "College of Management", "College of Pharmacy",
    "College of Maritime Transport", "College of International Transport",
    "College of Language and Communication", "College of Artificial Intelligence",
    "College of Computing", "College of Fisheries", "College of Dentistry",
    "Graduate School of Business", "College of Law", "College of Art and Design",
    "College of Archeology", "College of Management & Technology",
    "College of Engineering & Technology"
]

def similar(a: str, b: str) -> float:
    return SequenceMatcher(None, (a or "").lower(), (b or "").lower()).ratio()

def best_seed_match(name: str, seeds: List[str]) -> Tuple[Optional[str], float]:
    """Return best matching seed and ratio or (None,0)."""
    if not name or not isinstance(name, str):
        return None, 0.0
    best = None
    best_score = 0.0
    for s in seeds:
        score = similar(name, s)
        if score > best_score:
            best_score = score
            best = s
    return best, best_score

# ---------------------------
# Utilities
# ---------------------------

def load_json_file(p: Path):
    if p is None:
        return None
    p = Path(p)
    if not p.exists():
        return None
    try:
        with p.open("r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"[WARN] Failed to load JSON {p}: {e}", file=sys.stderr)
        return None

def list_json_files(folder: Path):
    if folder is None:
        return []
    folder = Path(folder)
    if not folder.exists():
        return []
    return sorted([p for p in folder.glob("*.json")])

def parse_html_for_title_and_text(html_path: Path) -> Tuple[str, str]:
    """Return (title, cleaned_text) from an HTML snapshot."""
    try:
        txt = Path(html_path).read_text(encoding="utf-8", errors="ignore")
        soup = BeautifulSoup(txt, "html.parser")
        # title
        title_tag = soup.find("title")
        title = title_tag.get_text(strip=True) if title_tag else ""
        # main textual content: take body and collapse whitespace
        body = soup.body
        raw = body.get_text(separator=" ", strip=True) if body else soup.get_text(separator=" ", strip=True)
        # normalize whitespace
        cleaned = re.sub(r"\s+", " ", raw)
        return title, cleaned
    except Exception as e:
        return "", ""

def extract_program_meta_from_api(api_json: dict) -> Dict:
    """
    Expected shapes vary a lot. We'll try common fields:
    - program_id, unit_id, name/title, degree, duration_terms, college_name, campus
    """
    out = {}
    if not api_json:
        return out
    # try common keys
    for key in ['program_id', 'programId', 'id']:
        if key in api_json:
            out['program_id'] = str(api_json.get(key))
            break
    for key in ['unit_id', 'unitId', 'unit']:
        if key in api_json:
            out['unit_id'] = str(api_json.get(key))
            break
    # program name
    for key in ['program_name', 'name', 'title', 'ProgramName', 'programTitle']:
        if key in api_json:
            out['program_name'] = api_json.get(key)
            break
    # degree/duration
    if 'degree' in api_json:
        out['degree'] = api_json.get('degree')
    if 'duration_terms' in api_json:
        out['duration_terms'] = api_json.get('duration_terms')
    # sometimes content nested
    if 'data' in api_json and isinstance(api_json['data'], dict):
        nested = api_json['data']
        # override if missing
        out.setdefault('program_id', nested.get('program_id') or nested.get('id'))
        out.setdefault('unit_id', nested.get('unit_id'))
        out.setdefault('program_name', nested.get('name') or nested.get('title'))
        out.setdefault('degree', nested.get('degree'))
        out.setdefault('duration_terms', nested.get('duration_terms'))
    # fallback scanning for keys
    if not out.get('program_name'):
        # scan strings in json for likely title fields
        for v in api_json.values():
            if isinstance(v, str) and len(v) > 3 and len(v.split()) > 2:
                if 'program' in v.lower() or 'degree' in v.lower() or len(v) > 20:
                    out.setdefault('program_name', v)
    return out

def canonicalize_campus_list(raw: str) -> List[str]:
    """From a noisy string, return list of canonical campus names found."""
    if not raw:
        return []
    raw = str(raw)
    tokens = re.split(r"[,\|;/\-]+", raw)
    found = []
    for t in tokens:
        t = t.strip()
        # check direct tokens against canonical list
        for c in CANONICAL_CAMPUSES:
            if t.lower().find(c.lower()) != -1 or c.lower() in t.lower():
                if c not in found:
                    found.append(c)
        # also common fullwords like 'El Alamein' variations
        if t.lower() in ['elalamein', 'el alamein', 'alamein', 'el-alamein']:
            if 'El Alamein' not in found:
                found.append('El Alamein')
    return found

def candidate_college_from_path(path: str) -> Optional[str]:
    """Try to parse college name from path segments."""
    if not path:
        return None
    p = str(path)
    # common patterns: colleges_coe_alex, colleges_cmt_heliopolis, en_colleges_clc-cairo_
    m = re.search(r"colleges[_\-/]([A-Za-z0-9_-]+)", p, flags=re.I)
    if m:
        token = m.group(1).replace("_", " ").replace("-", " ").strip()
        token = token.title()
        return token
    # fallback: pick final filename w/o extension
    try:
        return Path(p).stem.replace("_", " ").replace("-", " ").title()
    except Exception:
        return None

# ---------------------------
# Main builder
# ---------------------------

def build_programs_master(
    base_dir: Path,
    html_dir: Path,
    api_dir: Path,
    out_csv: Path,
    meta_json_path: Path = None,
    results_json_path: Path = None,
    clean_unified_path: Path = None
):
    # load some helpful JSONs if available (meta, results...)
    meta = load_json_file(meta_json_path) if meta_json_path and Path(meta_json_path).exists() else {}
    results = load_json_file(results_json_path) if results_json_path and Path(results_json_path).exists() else {}
    clean_unified = load_json_file(clean_unified_path) if clean_unified_path and Path(clean_unified_path).exists() else {}

    print("Loaded meta:", bool(meta), "results:", bool(results), "clean_unified:", bool(clean_unified))
    print("Scanning API folder:", api_dir, "HTML folder:", html_dir)

    # 1) scan API JSONs for program entries
    api_files = list_json_files(api_dir)
    api_programs = {}
    for p in api_files:
        data = load_json_file(p)
        if not data:
            continue
        candidate = extract_program_meta_from_api(data)
        # try to detect program_id
        pid = candidate.get('program_id') or candidate.get('programId') or None
        if not pid:
            # sometimes the filename contains program_id
            m = re.search(r"program_id[_=]?(\d+)", p.name, flags=re.I)
            if m:
                pid = m.group(1)
        if pid:
            candidate['source_path'] = str(p)
            api_programs[str(pid)] = candidate

    print("Program IDs discovered from API area:", len(api_programs))

    # 2) scan HTML files and aggregate program hints
    html_files = sorted(Path(html_dir).glob("*.html")) if html_dir else []
    program_rows = []
    # helper dict to collect program->hints
    program_hints = defaultdict(lambda: {"pages": [], "paths": [], "titles": [], "texts": []})

    for hf in html_files:
        title, text = parse_html_for_title_and_text(hf)
        low = (title or "") + " " + (text or "")
        # try to find program_id in filename or content
        # patterns like program_id=NNN or program_id_NNN in file name/url
        m_fn = re.search(r"program_id[=_\-]?(\d+)", hf.name, flags=re.I)
        m_q = re.search(r"program_id[=&]?(\d+)", text, flags=re.I)
        potential_ids = set()
        if m_fn:
            potential_ids.add(m_fn.group(1))
        if m_q:
            potential_ids.add(m_q.group(1))
        # also try 'program ' followed by small number in content
        for m in re.finditer(r"\bprogram(?:\s|_)?(?:id|_id)?[:=\s]*([0-9]{2,6})\b", low, flags=re.I):
            potential_ids.add(m.group(1))
        # Add generic hint rows: sometimes a page describes a program without explicit id
        if potential_ids:
            for pid in potential_ids:
                program_hints[pid]["pages"].append(str(hf))
                program_hints[pid]["titles"].append(title)
                program_hints[pid]["texts"].append(text[:400])
                program_hints[pid]["paths"].append(str(hf))
        # fallback: scan for degree keywords & program-like titles
        if not potential_ids:
            # heuristics: titles that look like program names
            if title and (("program" in title.lower()) or ("engineering" in title.lower()) or ("bachelor" in title.lower()) or len(title.split())>3):
                # treat as 'no-id' program hint
                key = f"noid::{hf.stem}"
                program_hints[key]["pages"].append(str(hf))
                program_hints[key]["titles"].append(title)
                program_hints[key]["texts"].append(text[:400])
                program_hints[key]["paths"].append(str(hf))

    print("Program index size after HTML scan:", len(program_hints))

    # 3) combine API + HTML hints into program rows
    # We'll prioritize API fields but enrich from HTML.
    collected = []
    seen_prog_keys = set()

    # First, add API-known programs
    for pid, api_meta in api_programs.items():
        row = {
            "program_id": pid,
            "unit_id": api_meta.get("unit_id") or "",
            "program_name": api_meta.get("program_name") or "",
            "degree": api_meta.get("degree") or "",
            "duration_terms": api_meta.get("duration_terms") or "",
            "college_hint": api_meta.get("college_name") or None,
            "campus_hint": api_meta.get("campus") or None,
            "source_hints": api_meta.get("source_path") or ""
        }
        # add HTML hints if exist
        if pid in program_hints:
            h = program_hints[pid]
            row["html_titles"] = ";".join([t for t in h["titles"] if t])
            row["html_pages"] = ";".join(h["pages"])
            # try to use html title if program name missing
            if not row["program_name"] and h["titles"]:
                row["program_name"] = h["titles"][0]
            if not row["campus_hint"]:
                # attempt canonicalize combined pages texts
                combined_text = " ".join(h["texts"])
                row["campus_hint"] = ",".join(canonicalize_campus_list(combined_text))
        collected.append(row)
        seen_prog_keys.add(pid)

    # Next, add HTML-only hints (no program_id) - create synthetic program keys
    for key, hint in program_hints.items():
        if key.startswith("noid::"):
            # derive a program name from title
            prog_name = hint["titles"][0] if hint["titles"] else Path(hint["pages"][0]).stem
            row = {
                "program_id": None,
                "unit_id": None,
                "program_name": prog_name,
                "degree": None,
                "duration_terms": None,
                "college_hint": None,
                "campus_hint": ",".join(canonicalize_campus_list(" ".join(hint["texts"]))),
                "source_hints": ";".join(hint["pages"]),
                "html_titles": ";".join(hint["titles"]),
                "html_pages": ";".join(hint["pages"])
            }
            collected.append(row)

    print("Total program rows collected (raw):", len(collected))

    # 4) Normalization / cleaning stage
    cleaned_rows = []
    for r in collected:
        prog = {}
        prog['program_id'] = r.get('program_id')
        prog['unit_id'] = r.get('unit_id')
        # program_name cleanup
        pname = r.get('program_name') or ""
        # strip JSON-like noise
        pname = re.sub(r"\{.*\}", "", str(pname))
        pname = re.sub(r"\s+", " ", pname).strip(" -:;\n\t")
        prog['program_name'] = pname

        # degree
        prog['degree'] = r.get('degree') or ""

        # duration
        prog['duration_terms'] = r.get('duration_terms') or ""

        # build source_hint summary
        srcs = []
        if r.get('source_hints'):
            srcs.append(r['source_hints'])
        if r.get('html_pages'):
            srcs.append(r['html_pages'])
        prog['source_hint'] = ";".join(srcs)

        # campus canonicalization
        campus_raw = r.get('campus_hint') or ""
        canonical_camps = canonicalize_campus_list(campus_raw)
        prog['campus'] = ", ".join(canonical_camps) if canonical_camps else ""

        # college detection heuristics:
        college_candidate = r.get('college_hint') or ""
        # if not present, try to detect from html_titles or source_hint
        if not college_candidate:
            candidates_text = " ".join(filter(None, [r.get('html_titles',''), r.get('source_hints','')]))
            # try to extract "College of X" occurrences
            m = re.search(r"(College of [A-Za-z &0-9\-]+)", candidates_text, flags=re.I)
            if m:
                college_candidate = m.group(1).strip()
        # try candidate from source path fragments
        if not college_candidate and r.get('source_hints'):
            # try parse path segments
            seg = candidate_college_from_path(r['source_hints'])
            if seg:
                college_candidate = seg

        # fuzzy match to canonical seeds
        best_seed, score = best_seed_match(college_candidate or prog['program_name'], COLLEGE_NAME_SEEDS)
        if score > 0.5:
            # Use seed but try to keep specifics (e.g. "College of Engineering - Alexandria")
            prog['college'] = best_seed
        else:
            # fallback: use raw candidate or program_name parent
            prog['college'] = college_candidate or ""

        # keep original raw hints
        prog['raw_college_hint'] = r.get('college_hint') or ""
        prog['raw_campus_hint'] = campus_raw

        cleaned_rows.append(prog)

    df_out = pd.DataFrame(cleaned_rows)

    # 5) Deduplicate and prioritize: group by (program_name, college) and aggregate program_ids
    if df_out.empty:
        print("[WARN] No program rows to save.")
        df_out.to_csv(out_csv, index=False)
        return

    # unify program_id as first non-null
    def pick_first_nonnull(series):
        vals = [v for v in series if v and str(v).strip()]
        return vals[0] if vals else None

    grouped = df_out.groupby(['program_name', 'college'], dropna=False).agg({
        'program_id': lambda s: pick_first_nonnull(list(s)),
        'unit_id': lambda s: pick_first_nonnull(list(s)),
        'degree': lambda s: pick_first_nonnull(list(s)),
        'duration_terms': lambda s: pick_first_nonnull(list(s)),
        'campus': lambda s: ", ".join(sorted(set(sum([([c.strip() for c in (v.split(',') if v else [])]) for v in s], [])))),
        'source_hint': lambda s: ";".join(sorted(set([x for x in s if x]))),
        'raw_college_hint': lambda s: ";".join(sorted(set([x for x in s if x]))),
        'raw_campus_hint': lambda s: ";".join(sorted(set([x for x in s if x]))),
    }).reset_index()

    # renames & final columns
    grouped = grouped.rename(columns={
        'program_name': 'program_name',
        'college': 'college',
        'program_id': 'program_id',
        'unit_id': 'unit_id',
        'degree': 'degree',
        'duration_terms': 'duration_terms',
        'campus': 'campus',
        'source_hint': 'source_hint'
    })

    # final cleanup of campus string
    grouped['campus'] = grouped['campus'].apply(lambda s: ", ".join([x.strip() for x in re.split(r"[;,/]+", s) if x.strip()]))

    out_folder = out_csv.parent
    out_folder.mkdir(parents=True, exist_ok=True)
    grouped.to_csv(out_csv, index=False, encoding='utf-8')
    print("Saved CSV:", out_csv)
    print("Total program rows saved:", len(grouped))
    return grouped

# ---------------------------
# CLI
# ---------------------------

def main():
    parser = argparse.ArgumentParser(description="Build programs_master_v3.csv from AAST step8 output.")
    parser.add_argument(
        "--base",
        default="C:/Users/mh978/Downloads/aast_scrape_final/step8/aast_v2_output",
        help="Base folder path to aast_v2_output"
    )
    parser.add_argument("--html", default=None, help="HTML folder override (optional)")
    parser.add_argument("--api", default=None, help="API folder override (optional)")
    parser.add_argument("--meta", default=None, help="meta.json path (optional)")
    parser.add_argument("--results", default=None, help="results.json path (optional)")
    parser.add_argument("--clean_unified", default=None, help="clean_unified_dataset.json path (optional)")
    parser.add_argument(
        "--out",
        default="C:/Users/mh978/Downloads/aast_scrape_final/df/final_dataset/programs_master_v3.csv",
        help="Output CSV path"
    )

    args = parser.parse_args()

    # Convert everything to Path() safely
    base = Path(args.base)

    html_dir = Path(args.html) if args.html else base / "html"
    api_dir = Path(args.api) if args.api else base / "api"

    meta_path = Path(args.meta) if args.meta else base / "json" / "meta.json"
    results_path = Path(args.results) if args.results else base / "json" / "results.json"
    clean_unified_path = Path(args.clean_unified) if args.clean_unified else base / "json" / "clean_unified_dataset.json"

    out_csv = Path(args.out)

    # call builder
    build_programs_master(
        base,
        html_dir,
        api_dir,
        out_csv,
        meta_path,
        results_path,
        clean_unified_path
    )


if __name__ == "__main__":
    main()
