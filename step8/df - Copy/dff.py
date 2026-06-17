import os
import re
import json
import pandas as pd

# ============================
# CONFIG
# ============================

INPUT_PATH = r"C:\Users\mh978\Downloads\aast_scrape_final\df\clean_unified_dataset.json"
OUTPUT_FOLDER = r"C:\Users\mh978\Downloads\aast_scrape_final\df"
OUTPUT_CSV = os.path.join(OUTPUT_FOLDER, "structured_master_clean.csv")

os.makedirs(OUTPUT_FOLDER, exist_ok=True)

def safe(x):
    return x if isinstance(x, str) else ""

# ----------------------------
# Degree patterns
# ----------------------------
DEGREE_PATTERNS = [
    r"Bachelor", r"B\.?Sc", r"BSc", r"BEng", r"B\.?Eng", 
    r"Master", r"M\.?Sc", r"MSc", r"MBA", 
    r"Ph\.?D", r"Doctorate", r"Diploma"
]
DEGREE_RE = re.compile("|".join(DEGREE_PATTERNS), flags=re.I)

# ----------------------------
# Duration patterns
# ----------------------------
DURATION_PATTERNS = [
    r"(\d{1,2})\s*terms",
    r"(\d{1,2})\s*term",
    r"(\d{1,2})\s*years",
    r"(\d{1,2})\s*year"
]
DURATION_RE = re.compile("|".join(DURATION_PATTERNS), flags=re.I)

# ----------------------------------------
# CAMPUS LIST (very accurate)
# ----------------------------------------
CAMPUSES = [
    "Alexandria", "Abu Kir", "Miami", "Heliopolis", 
    "Dokki", "Port Said", "Smart Village", "El Alamein",
    "Alamein", "South Valley", "Aswan", "Latakia", "Cairo"
]
CAMPUS_RE = re.compile("|".join(CAMPUSES), flags=re.I)

# ----------------------------------------
# PROGRAM CUES
# ----------------------------------------
PROGRAM_CUES = ["bachelor", "master", "phd", "program", "degree", "diploma"]


# Load file
print("Loading JSON:", INPUT_PATH)
with open(INPUT_PATH, "r", encoding="utf-8") as f:
    data = json.load(f)

print("Total records:", len(data))

rows = []

for rec in data:
    title = safe(rec.get("title"))
    text = safe(rec.get("text"))
    
    # Skip empty pages
    if not title and not text:
        continue
       # Detect program pages
    if any(c in text.lower() for c in PROGRAM_CUES):

        # College name extracted from title
        college_name = title.split("|")[0].split("-")[0].strip()

        # Program name (fallback to title)
        program_name = title.strip()

        # Degree detection
        deg_match = DEGREE_RE.search(text)
        degree = deg_match.group(0) if deg_match else ""

        # Duration detection (safe)
        dur_match = DURATION_RE.search(text)
        duration_terms = ""

        if dur_match:
            # safely get the first numeric value from regex groups
            num = next((g for g in dur_match.groups() if g and g.isdigit()), None)

            if num:
                token = dur_match.group(0).lower()

                if "term" in token:
                    duration_terms = int(num)
                elif "year" in token:
                    duration_terms = int(num) * 2
                else:
                    duration_terms = ""
            else:
                duration_terms = ""
        else:
            duration_terms = ""

        # Campus detection
        campus_matches = CAMPUS_RE.findall(text)
        campus = ", ".join(sorted(set([c.strip() for c in campus_matches]))) if campus_matches else ""

        # College ID
        college_id = "".join(e for e in college_name.upper() if e.isalnum())[:8]

        # Append row
        rows.append({
            "college_name": college_name,
            "campus": campus,
            "program_name": program_name,
            "degree": degree,
            "duration_terms": duration_terms,
            "college_id": college_id
        })

        
        # Campus
        campus_matches = CAMPUS_RE.findall(text)
        campus = ", ".join(sorted(set([x.strip() for x in campus_matches]))) if campus_matches else ""
        
        # Create college_id
        college_id = "".join(e for e in college_name.upper() if e.isalnum())[:8]
        
        rows.append({
            "college_name": college_name,
            "campus": campus,
            "program_name": program_name,
            "degree": degree,
            "duration_terms": duration_terms,
            "college_id": college_id
        })


df = pd.DataFrame(rows)

# Remove duplicates
df = df.drop_duplicates(subset=["college_name", "program_name"])

# Save
df.to_csv(OUTPUT_CSV, index=False)
print("\nSaved:", OUTPUT_CSV)

print("\nPreview:\n", df.head(12))
print("\nRows:", len(df))
