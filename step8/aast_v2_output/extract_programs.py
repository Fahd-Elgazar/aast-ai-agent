import os
import re
import csv
from pathlib import Path
from bs4 import BeautifulSoup
import pandas as pd

# ====== CONFIG ======
HTML_FOLDER = "html"                     # the folder containing all HTML pages
CLASSIFIED_CSV = "html_classification_results.csv"
OUTPUT_CSV = "programs_extracted.csv"


# ====== SIMPLE CLEANER ======
def clean_text(x):
    if not x:
        return ""
    x = re.sub(r"\s+", " ", x)
    return x.strip()


# ====== EXTRACT PROGRAM DATA FROM HTML ======
def extract_program_from_html(html):
    soup = BeautifulSoup(html, "html.parser")

    # ---- Program Title ----
    title = ""
    if soup.find("h1"):
        title = clean_text(soup.find("h1").get_text())
    elif soup.find("title"):
        title = clean_text(soup.find("title").get_text())
    else:
        title = ""

    # ---- Description ----
    desc = ""
    desc_block = soup.find("div", class_=re.compile("description|program|about", re.I))
    if desc_block:
        desc = clean_text(desc_block.get_text())
    else:
        # fallback: first long paragraph
        paras = soup.find_all("p")
        if paras:
            desc = clean_text(max(paras, key=lambda p: len(p.get_text())).get_text())

    # ---- Degree / Level ----
    degree = ""
    degree_patterns = [
        "bachelor", "masters", "phd",
        "undergraduate", "postgraduate",
        "بكالوريوس", "ماجستير", "دكتوراه"
    ]

    text = soup.get_text(" ", strip=True).lower()
    for d in degree_patterns:
        if d in text:
            degree = d
            break

    # ---- Courses List ----
    courses = []
    ul_tags = soup.find_all("ul")
    for ul in ul_tags:
        li_texts = [clean_text(li.get_text()) for li in ul.find_all("li")]
        if len(li_texts) >= 3:     # at least 3 courses
            courses.extend(li_texts)

    courses = list(dict.fromkeys(courses))  # remove duplicates

    # ---- Department / College / Unit ID ----
    dept = ""
    college = ""
    unit_id = ""

    # URL clues
    meta_url = soup.find("meta", {"property": "og:url"})
    if meta_url:
        url = meta_url.get("content", "")
    else:
        url = ""

    # Extract unit_id from URL
    m = re.search(r"unit_id=(\d+)", url)
    if m:
        unit_id = m.group(1)

    # Department by scanning headings
    for h in soup.find_all(["h2", "h3"]):
        txt = h.get_text().lower()
        if "department" in txt or "قسم" in txt:
            dept = clean_text(h.get_text())
            break

    # College name if present in header
    header = soup.find("div", class_=re.compile("college|faculty|unit", re.I))
    if header:
        college = clean_text(header.get_text())

    # fallback for college
    if "college" in url:
        m2 = re.search(r"colleges/([^/]+)/", url)
        if m2:
            college = m2.group(1).replace("-", " ").title()

    return {
        "title": title,
        "degree": degree,
        "description": desc,
        "department": dept,
        "college": college,
        "unit_id": unit_id,
        "courses": " | ".join(courses)
    }


# ====== MAIN ======
def run():
    df = pd.read_csv(CLASSIFIED_CSV)

    # Take only program pages
    program_files = df[df["label"] == "program"]["file"].tolist()

    extracted = []

    for fp in program_files:
        fp = Path(fp)
        if not fp.exists():
            continue

        html = fp.read_text(encoding="utf-8", errors="ignore")
        data = extract_program_from_html(html)

        data["file"] = str(fp)
        extracted.append(data)


    pd.DataFrame(extracted).to_csv(OUTPUT_CSV, index=False, encoding="utf-8")

    print("✔ Program extraction completed.")
    print("Saved to:", OUTPUT_CSV)
    print("Total programs extracted:", len(extracted))


if __name__ == "__main__":
    run()
