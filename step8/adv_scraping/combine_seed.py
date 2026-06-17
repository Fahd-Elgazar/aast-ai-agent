# make_combined_seeds.py
import json
from pathlib import Path
from urllib.parse import urlparse, parse_qs
import re

BASE = Path(r"C:\Users\mh978\Downloads\aast_scrape_final\step8")
DISC = BASE / "discovery_seed_links.json"
ALL = BASE / "all_seeds_extracted.json"
OUT = BASE / "combined_seeds.json"

def canonicalize(u: str) -> str:
    u = u.strip()
    if not u: 
        return u
    # simple canonicalization: remove fragments, remove noise params, sort query
    p = urlparse(u)
    scheme = p.scheme or "https"
    host = p.netloc
    path = p.path.rstrip('/')
    qs = parse_qs(p.query, keep_blank_values=True)
    # remove noise
    for k in list(qs.keys()):
        if k.startswith("utm_") or k in ("print","lang","lnselect","session"):
            qs.pop(k, None)
    parts = []
    for k in sorted(qs.keys()):
        for v in sorted(qs[k]):
            parts.append(f"{k}={v}")
    q = "&".join(parts)
    return f"{scheme}://{host}{path}" + (f"?{q}" if q else "")

seeds = []
# load discovery format pages -> extract top-level url + links[] if present
if DISC.exists():
    try:
        raw = json.loads(DISC.read_text(encoding="utf8"))
        if isinstance(raw, dict) and "pages" in raw:
            for p in raw["pages"]:
                u = p.get("url")
                if u: seeds.append(u)
                for link in p.get("links", []) or []:
                    seeds.append(link)
    except Exception as e:
        print("Failed to load discovery:", e)

# load all_seeds_extracted (flat list)
if ALL.exists():
    try:
        raw = json.loads(ALL.read_text(encoding="utf8"))
        if isinstance(raw, list):
            seeds.extend(raw)
    except Exception as e:
        print("Failed to load all_seeds_extracted:", e)

# final cleanup: keep only internal aast.edu links, canonicalize, dedupe
final = []
seen = set()
for s in seeds:
    if not isinstance(s, str): continue
    s2 = canonicalize(s)
    if not s2: continue
    # only internal (aast.edu) - allow relative host too
    try:
        from urllib.parse import urlparse
        if "aast.edu" not in urlparse(s2).netloc:
            continue
    except:
        continue
    if s2 not in seen:
        seen.add(s2); final.append(s2)

Path(OUT).write_text(json.dumps(final, indent=2, ensure_ascii=False), encoding="utf8")
print(f"Combined seeds saved: {OUT} (count={len(final)})")
