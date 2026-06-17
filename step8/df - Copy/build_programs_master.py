#!/usr/bin/env python3
"""
extract_programs_by_id.py

Robust multi-source program extractor (API + HTML + meta) for AAST dataset.

Outputs:
 final_dataset/programs_master_v2.csv

Fields:
 college_name, campus, program_name, degree, duration_terms, college_id, unit_id, program_id, source_hint
"""

import os
import re
import json
from pathlib import Path
from unicodedata import normalize
import pandas as pd

# ----------------- CONFIG -----------------
BASE = Path(r"C:\Users\mh978\Downloads\aast_scrape_final")
DF_FOLDER = BASE / "df"
STEP8 = BASE / "step8" / "aast_v2_output"

CLEAN_JSON = DF_FOLDER / "clean_unified_dataset.json"
API_FOLDER = STEP8 / "api"
HTML_FOLDER = STEP8 / "html"
META_JSON = STEP8 / "json" / "meta.json"
RESULTS_JSON = STEP8 / "json" / "results.json"

OUTPUT_FOLDER = DF_FOLDER / "final_dataset"
OUTPUT_FOLDER.mkdir(parents=True, exist_ok=True)
OUTPUT_CSV = OUTPUT_FOLDER / "programs_master_v2.csv"

# ----------------- Regex helpers -----------------
PROG_ID_RE = re.compile(r"program_id\D*(\d{1,8})", flags=re.I)
UNIT_ID_RE = re.compile(r"unit_id\D*(\d{1,8})", flags=re.I)
GETPROGRAM_API_RE = re.compile(r"getProgramData2021\.php.*program_id[=\&]?(\d+).*unit_id[=\&]?(\d+)?", flags=re.I)

DEGREE_RE = re.compile(r"\b(Bachelor|B\.?Sc|BSc|BEng|Master|M\.?Sc|MSc|MBA|Ph\.?D|Doctorate|Diploma)\b", flags=re.I)
DURATION_RE = re.compile(r"(\d{1,2})\s*(terms|term|years|year)", flags=re.I)

CAMPUSES = [
    "Alexandria", "Abu Kir", "Miami", "Heliopolis", "Dokki", "Port Said",
    "Smart Village", "El Alamein", "Alamein", "South Valley", "Aswan", "Latakia", "Cairo"
]
CAMPUS_RE = re.compile("|".join(re.escape(x) for x in CAMPUSES), flags=re.I)

# ----------------- Utility functions -----------------
def safe_str(x):
    return x if isinstance(x, str) else ""

def slugify(s):
    s = safe_str(s)
    s = s.strip().lower()
    s = normalize('NFKD', s)
    s = re.sub(r'[^\w\s-]', '', s)
    s = re.sub(r'[\s_-]+', '_', s)
    return s.strip('_')[:40].upper()

def normalize_degree(raw):
    if not raw: 
        return ""
    m = DEGREE_RE.search(raw)
    if not m:
        return ""
    tok = m.group(1).lower()
    if 'bach' in tok or 'b.sc' in raw.lower() or 'bsc' in raw.lower():
        return "Bachelor"
    if 'master' in tok or 'msc' in raw.lower() or 'mba' in raw.lower():
        return "Master"
    if 'ph' in tok or 'doctor' in tok:
        return "PhD"
    if 'diploma' in tok:
        return "Diploma"
    return tok.title()

def find_duration_terms(text):
    if not text:
        return ""
    m = DURATION_RE.search(text)
    if not m:
        return ""
    num = int(m.group(1))
    unit = m.group(2).lower()
    if "term" in unit:
        return num
    if "year" in unit:
        return num * 2
    return num

# ----------------- Load meta & results (if exist) -----------------
meta = {}
results = {}
if META_JSON.exists():
    try:
        meta = json.loads(META_JSON.read_text(encoding="utf-8"))
        print("Loaded meta.json")
    except Exception as e:
        print("Failed to parse meta.json:", e)
else:
    print("meta.json not found:", META_JSON)

if RESULTS_JSON.exists():
    try:
        results = json.loads(RESULTS_JSON.read_text(encoding="utf-8"))
        print("Loaded results.json")
    except Exception as e:
        print("Failed to parse results.json:", e)
else:
    print("results.json not found:", RESULTS_JSON)

# ----------------- Index helper from clean_unified_dataset.json -----------------
index_by_source = {}
if CLEAN_JSON.exists():
    try:
        with open(CLEAN_JSON, "r", encoding="utf-8") as fh:
            records = json.load(fh)
        for rec in records:
            src = safe_str(rec.get("source")).replace("\\","/")
            index_by_source.setdefault(src, []).append(rec)
        print("Loaded clean_unified_dataset.json records:", len(records))
    except Exception as e:
        print("Failed to load clean_unified_dataset.json:", e)
        records = []
else:
    print("clean_unified_dataset.json not found at", CLEAN_JSON)
    records = []

# ----------------- Scan API folder for program_id occurrences -----------------
program_index = {}   # program_id -> list of candidate artifacts

def add_program_candidate(pid, unit_id=None, source=None, json_obj=None, raw_text=None):
    pid = str(pid)
    entry = program_index.setdefault(pid, {"program_id": pid, "unit_ids": set(), "sources": [], "jsons": [], "raw_texts": []})
    if unit_id:
        entry["unit_ids"].add(str(unit_id))
    if source:
        entry["sources"].append(str(source))
    if json_obj:
        entry["jsons"].append(json_obj)
    if raw_text:
        entry["raw_texts"].append(str(raw_text)[:10000])

# scan API files (JSON/text) for program_id patterns
if API_FOLDER.exists():
    api_files = list(API_FOLDER.glob("**/*"))
    print("Scanning API folder files:", len(api_files))
    for p in api_files:
        try:
            txt = p.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        # direct JSON parse attempt
        parsed_json = None
        try:
            parsed_json = json.loads(txt)
        except Exception:
            # try to find JSON blob
            m = re.search(r"(\{[\s\S]{20,}\})", txt)
            if m:
                try:
                    parsed_json = json.loads(m.group(1))
                except Exception:
                    parsed_json = None
        # If parsed_json and contains program_id in keys
        if isinstance(parsed_json, dict):
            # search for program_id key anywhere
            def walk_for_keys(obj):
                found = []
                if isinstance(obj, dict):
                    for k,v in obj.items():
                        if "program_id" in k.lower() or "programid" in k.lower():
                            found.append((k,v))
                        elif isinstance(v, (dict,list)):
                            found.extend(walk_for_keys(v))
                elif isinstance(obj, list):
                    for it in obj:
                        found.extend(walk_for_keys(it))
                return found
            fk = walk_for_keys(parsed_json)
            if fk:
                # take all found ids
                for k,v in fk:
                    try:
                        pid = int(v)
                    except Exception:
                        continue
                    # try also to get unit_id if present
                    unit = None
                    if isinstance(parsed_json.get("unit_id", None), (int,str)):
                        unit = parsed_json.get("unit_id")
                    add_program_candidate(pid, unit_id=unit, source=p, json_obj=parsed_json, raw_text=txt)
                continue
        # fallback: regex based program_id detection in API filename or content
        m = PROG_ID_RE.search(txt) or PROG_ID_RE.search(str(p.name)) or GETPROGRAM_API_RE.search(txt)
        if m:
            pid = m.group(1)
            # also try to find unit_id
            u = None
            mu = UNIT_ID_RE.search(txt)
            if mu:
                u = mu.group(1)
            add_program_candidate(pid, unit_id=u, source=p, raw_text=txt)
else:
    print("API folder not found:", API_FOLDER)

print("Program IDs discovered from API area:", len(program_index))

# ----------------- Scan HTML files for program pages (fallback) -----------------
if HTML_FOLDER.exists():
    html_files = list(HTML_FOLDER.glob("**/*.html")) + list(HTML_FOLDER.glob("**/*.htm"))
    print("Scanning HTML files:", len(html_files))
    for p in html_files:
        try:
            txt = p.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        # find program_id in the html file name or content
        m = PROG_ID_RE.search(txt) or PROG_ID_RE.search(p.name) or GETPROGRAM_API_RE.search(txt)
        if m:
            pid = m.group(1)
            # try unit_id
            mu = UNIT_ID_RE.search(txt)
            u = mu.group(1) if mu else None
            add_program_candidate(pid, unit_id=u, source=p, raw_text=txt)
        else:
            # also detect programtemp.php links with program_id in content
            if "programtemp.php" in txt or "programs-courses_program.php" in txt or "programs-courses" in str(p).lower():
                # try to extract program_id from surrounding script tags or links
                ms = re.findall(r"program_id\D*(\d+)", txt)
                for pid in ms:
                    mu = re.search(r"unit_id\D*(\d+)", txt)
                    u = mu.group(1) if mu else None
                    add_program_candidate(pid, unit_id=u, source=p, raw_text=txt)
else:
    print("HTML folder not found:", HTML_FOLDER)

print("Program index size after HTML scan:", len(program_index))

# ----------------- Use meta.json / results / unified index to map unit_id -> college or helpful hints -----------------
unit_to_college_hint = {}
# meta.json often has items with unit_id/unit_name mapping - attempt to parse
def try_extract_unit_mapping(j):
    if not isinstance(j, dict):
        return
    # heuristic: look for keys that indicate units or colleges
    for k,v in j.items():
        if isinstance(v, list):
            for it in v:
                if isinstance(it, dict):
                    if "unit_id" in it and ("title" in it or "name" in it):
                        uid = str(it.get("unit_id"))
                        name = it.get("title") or it.get("name")
                        unit_to_college_hint[uid] = safe_str(name)

try:
    try_extract_unit_mapping(meta)
except Exception:
    pass

# search results index for unit_id or program hints
if isinstance(results, dict):
    for k,v in results.items():
        if isinstance(v, dict):
            url = safe_str(v.get("url") or v.get("path") or v.get("source") or "")
            title = safe_str(v.get("title") or v.get("name") or "")
            # try unit_id in url
            mu = UNIT_ID_RE.search(url)
            if mu:
                unit_to_college_hint[mu.group(1)] = title

# also look into clean_unified_dataset index_by_source for any unit->college hints
for src, recs in index_by_source.items():
    for rec in recs:
        if rec and isinstance(rec, dict):
            t = safe_str(rec.get("title",""))
            txt = safe_str(rec.get("text",""))
            mu = UNIT_ID_RE.search(t) or UNIT_ID_RE.search(txt)
            if mu:
                unit_to_college_hint[mu.group(1)] = t or txt[:120]

print("Unit->college hints collected:", len(unit_to_college_hint))

# ----------------- Build final rows by merging API -> HTML -> meta information -----------------
rows = []
seen_keys = set()

for pid, info in sorted(program_index.items(), key=lambda x: int(x[0])):
    program_id = pid
    unit_ids = sorted(info["unit_ids"])
    jsons = info.get("jsons", [])
    raw_texts = info.get("raw_texts", [])
    sources = info.get("sources", [])

    # Attempt 1: get canonical fields from API JSON objects (highest priority)
    program_name = ""
    degree = ""
    duration_terms = ""
    college_name = ""
    campus = ""
    unit_id = unit_ids[0] if unit_ids else ""

    # Inspect JSONs for structured keys
    extracted = False
    for j in jsons + raw_texts:
        # j may be dict or string
        if isinstance(j, dict):
            payload = j
        else:
            # if string try to parse again if looks like JSON
            try:
                payload = json.loads(j)
            except Exception:
                payload = None

        if isinstance(payload, dict):
            # common keys: 'program_name', 'name', 'title', 'program_title', 'degree', 'study_plan', 'duration', 'years'
            # try multiple nested places
            def get_any(d, keys):
                for k in keys:
                    if k in d and d[k]:
                        return d[k]
                return None

            # flatten a bit
            name = get_any(payload, ["program_name","programTitle","program_title","title","name"])
            if name:
                program_name = safe_str(name)

            # degree/duration
            dval = get_any(payload, ["degree","level","certificate","award"])
            if dval:
                degree = normalize_degree(safe_str(dval))
            # try duration fields
            dur = get_any(payload, ["duration_terms","duration","years","study_duration"])
            if dur:
                try:
                    duration_terms = int(dur)
                except Exception:
                    # if text like "4 years" -> parse
                    duration_terms = find_duration_terms(safe_str(dur))
            # try unit / college mapping in payload
            uid = get_any(payload, ["unit_id","unitId","unit"])
            if uid:
                unit_id = str(uid)
            # campus
            # sometimes payload contains 'campus' or 'location'
            cval = get_any(payload, ["campus","location","campuses","camp_name"])
            if cval:
                if isinstance(cval, (list,tuple)):
                    campus = ", ".join([safe_str(x) for x in cval if x])
                else:
                    campus = safe_str(cval)
            # if we've at least program name, consider extracted
            if program_name:
                extracted = True
                break

    # Attempt 2: if we didn't get program_name from API, inspect raw_texts for title/h1 or pattern
    if not program_name:
        for txt in raw_texts + sources:
            s = safe_str(txt)
            # try to find <h1> or <title>
            m = re.search(r"<h1[^>]*>([^<]{3,200})</h1>", s, flags=re.I|re.S)
            if m:
                program_name = m.group(1).strip()
                break
            m2 = re.search(r"<title[^>]*>([^<]{3,200})</title>", s, flags=re.I|re.S)
            if m2:
                program_name = m2.group(1).strip()
                break
            # try "Program: NAME" patterns
            m3 = re.search(r"Program(?:\:|\s)\s*([A-Z][\w \-&]{3,200})", s)
            if m3:
                program_name = m3.group(1).strip()
                break

    # Attempt 3: fallback to searching unified dataset index_by_source for a matching source record
    if not program_name:
        for src in sources:
            k = str(src).replace("\\","/")
            recs = index_by_source.get(k)
            if recs:
                for r in recs:
                    if r and isinstance(r, dict):
                        t = safe_str(r.get("title",""))
                        if t and len(t) > 3 and "program" in t.lower() or DEGREE_RE.search(t):
                            program_name = t
                            break
            if program_name:
                break

    # Attempt 4: if still empty, set placeholder name
    if not program_name:
        program_name = f"Program {program_id}"

    # Degree fallback: try to detect from program_name or raw_texts
    if not degree:
        degree = normalize_degree(program_name) or normalize_degree(" ".join(raw_texts[:3]))

    # duration fallback
    if not duration_terms:
        duration_terms = find_duration_terms(" ".join(raw_texts[:3])) or ""

    # college_name: use unit_id->meta hints -> else look for college text in any source string
    if unit_id and unit_id in unit_to_college_hint:
        college_name = unit_to_college_hint[unit_id]
    if not college_name:
        # inspect sources text for "College of ..." or "College of X"
        combined = " ".join([safe_str(x) for x in raw_texts + sources])[:8000]
        mcol = re.search(r"(College of [A-Za-z &\-/]{3,80})", combined, flags=re.I)
        if mcol:
            college_name = mcol.group(1).strip()
    if not college_name:
        # try to see if any result/meta entry mentions the parent college
        for s in sources:
            sst = safe_str(s)
            if "colleges" in sst.lower():
                # try to extract folder segment after 'colleges'
                parts = sst.split("/")
                if "colleges" in parts:
                    try:
                        idx = parts.index("colleges")
                        candidate = parts[idx+1] if idx+1 < len(parts) else ""
                        if candidate:
                            college_name = candidate.replace("-", " ").replace("_", " ").title()
                            break
                    except Exception:
                        pass
    if not college_name:
        college_name = "AASTMT (unspecified)"

    # campus fallback from combined raw_texts
    if not campus:
        combined_text = " ".join(raw_texts + sources)
        cms = CAMPUS_RE.findall(combined_text)
        campus = ", ".join(sorted(set(cms))) if cms else ""

    # college_id canonical
    college_id = slugify(college_name)[:12]

    # dedup key: program_id (canonical)
    key = ("pid", program_id)
    if key in seen_keys:
        continue
    seen_keys.add(key)

    # append final row
    rows.append({
        "college_name": college_name,
        "campus": campus,
        "program_name": program_name,
        "degree": degree,
        "duration_terms": duration_terms,
        "college_id": college_id,
        "unit_id": unit_id,
        "program_id": program_id,
        "source_hint": ";".join([str(s) for s in (sources[:6] or [])])[:10000]
    })

print("Total program_id rows collected:", len(rows))

# ----------------- Postprocess: filter obvious noise, normalize durations & degrees ---------------
def looks_like_noise(r):
    pn = safe_str(r.get("program_name","")).lower()
    if any(x in pn for x in ["about", "news", "events", "admission", "login", "apply", "contact", "calendar", "policy", "privacy", "lab", "utilization"]):
        return True
    return False

rows = [r for r in rows if not looks_like_noise(r)]

# normalize degree names and infer duration defaults
for r in rows:
    if not r.get("degree"):
        r["degree"] = ""
    r["degree"] = normalize_degree(r["degree"]) or ""
    if not r.get("duration_terms"):
        # infer defaults
        if "bachelor" in r["degree"].lower():
            r["duration_terms"] = 8
        elif "master" in r["degree"].lower():
            r["duration_terms"] = 4
        elif "phd" in r["degree"].lower():
            r["duration_terms"] = 8
        else:
            r["duration_terms"] = ""

# Save to CSV
df = pd.DataFrame(rows)
if df.empty:
    print("No program rows found. Exiting.")
else:
    # reorder columns
    cols = ["college_name","campus","program_name","degree","duration_terms","college_id","unit_id","program_id","source_hint"]
    df = df[cols]
    df.to_csv(OUTPUT_CSV, index=False, encoding="utf-8")
    print("Saved CSV:", OUTPUT_CSV)
    print("\nPreview (first 20 rows):\n")
    print(df.head(20).to_string(index=False))
    print("\nTotal program rows saved:", len(df))

# Done
