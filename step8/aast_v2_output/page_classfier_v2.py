import argparse
import re
import csv
from pathlib import Path
from bs4 import BeautifulSoup

# ==========================
#   HARD CONDITIONS (MUST)
# ==========================
REQUIRED_URL_PATTERNS = [
    r"programtemp\.php",
    r"program_id=\d+"
]

# ==========================
#   REQUIRED PAGE STRUCTURE
# ==========================
REQUIRED_SECTIONS = [
    "overview",
    "program description",
    "career",
    "admission",
    "courses",
    "structure",
    "accreditation"
]

# Keywords that *appear only* in real programs
PROGRAM_UNIQUE_PATTERNS = [
    r"\d+\s*crs",         # 144 CRs
    r"credit hours",       # Credit hours
    r"terms",              # 8 Terms
    r"degree",             # Degree: Bachelor
    r"bachelor",  
    r"master",
    r"phd",
    r"program educational objectives",
    r"student outcomes"
]


# ==========================
#   CHECK FUNCTIONS
# ==========================

def soup_from_html(raw):
    return BeautifulSoup(raw, "html.parser")

def is_program_url(path_str):
    path_str = path_str.lower()
    for pat in REQUIRED_URL_PATTERNS:
        if not re.search(pat, path_str):
            return False
    return True


def has_required_sections(soup):
    text = soup.get_text(" ", strip=True).lower()

    found = 0
    for sec in REQUIRED_SECTIONS:
        if sec in text:
            found += 1

    # Must match at least 2 sections
    return found >= 2


def contains_program_indicators(soup):
    text = soup.get_text(" ", strip=True).lower()

    for pat in PROGRAM_UNIQUE_PATTERNS:
        if re.search(pat, text):
            return True
    return False


def has_program_h1(soup):
    h1 = soup.find("h1")
    if not h1:
        return False

    h1txt = h1.get_text("").lower()

    # Examples:
    # "bachelor of computer science - 144 crs"
    if "bachelor" in h1txt or "master" in h1txt or "phd" in h1txt:
        return True

    if "cr" in h1txt:
        return True
    
    return False


# ==========================
#   MAIN PROGRAM CLASSIFIER
# ==========================

def classify_program_page(path):
    raw = path.read_text(encoding="utf-8", errors="ignore")
    soup = soup_from_html(raw)

    # CONDITION 1: URL pattern must match
    if not is_program_url(str(path)):
        return False, ["fail:url"]

    # CONDITION 2: Page must have program structure sections
    if not has_required_sections(soup):
        return False, ["fail:sections"]

    # CONDITION 3: Must contain program indicators (Degree, CRs, Terms)
    if not contains_program_indicators(soup):
        return False, ["fail:indicators"]

    # CONDITION 4: Must have a proper program H1 title
    if not has_program_h1(soup):
        return False, ["fail:h1"]

    return True, ["ok:all_rules_passed"]


def run_classifier(html_folder, out_file):
    html_folder = Path(html_folder)
    files = list(html_folder.rglob("*.html"))

    rows = []
    count_programs = 0

    for fp in files:
        is_prog, reasons = classify_program_page(fp)
        if is_prog:
            label = "program"
            count_programs += 1
        else:
            label = "not_program"

        rows.append({
            "file": str(fp),
            "label": label,
            "reasons": "|".join(reasons)
        })

    # Write CSV
    with open(out_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["file","label","reasons"])
        writer.writeheader()
        writer.writerows(rows)

    print("\n=========================")
    print("Program Classifier V3 DONE")
    print("=========================")
    print("Output saved to:", out_file)
    print("Detected REAL program pages:", count_programs)
    print("Total scanned:", len(files))


# ==========================
#   CLI
# ==========================

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--html", default="html", help="HTML folder path")
    p.add_argument("--out", default="program_v3_results.csv", help="Output CSV file")
    args = p.parse_args()

    run_classifier(args.html, args.out)
