import os
import re
import csv
from pathlib import Path
from bs4 import BeautifulSoup
import pandas as pd

# =======================
# CONFIG
# =======================
HTML_FOLDER = "html"
CLASSIFICATION_FILE = "html_classification_results.csv"
OUTPUT_FILE = "extracted_useful_data.csv"


# =============================================================
# HELPER FUNCTIONS
# =============================================================
def clean(x):
    if not x:
        return ""
    x = re.sub(r"\s+", " ", x)
    return x.strip()


def get_soup(path):
    html = Path(path).read_text(encoding="utf-8", errors="ignore")
    return BeautifulSoup(html, "html.parser")


# =============================================================
# EXTRACTORS FOR EACH PAGE TYPE
# =============================================================

def extract_college(soup):
    title = soup.find("h1") or soup.find("title")
    title = clean(title.get_text()) if title else ""

    desc = ""
    big_p = soup.find_all("p")
    if big_p:
        desc = clean(max(big_p, key=lambda p: len(p.get_text())).get_text())

    return {
        "title": title,
        "description": desc,
        "type_specific": "college"
    }


def extract_department(soup):
    title = ""
    if soup.find("h1"):
        title = clean(soup.find("h1").get_text())
    elif soup.find("h2"):
        title = clean(soup.find("h2").get_text())

    desc = ""
    p_tags = soup.find_all("p")
    if p_tags:
        desc = clean(max(p_tags, key=lambda p: len(p.get_text())).get_text())

    return {
        "title": title,
        "description": desc,
        "type_specific": "department"
    }


def extract_staff(soup):
    name = soup.find("h1") or soup.find("h2")
    name = clean(name.get_text()) if name else ""

    role = ""
    if soup.find("h3"):
        role = clean(soup.find("h3").get_text())

    email = ""
    links = soup.find_all("a")
    for a in links:
        if "@" in a.get_text():
            email = clean(a.get_text())
            break

    return {
        "name": name,
        "role": role,
        "email": email,
        "type_specific": "staff"
    }


def extract_news(soup):
    title = soup.find("h1") or soup.find("h2")
    title = clean(title.get_text()) if title else ""

    date = ""
    date_tag = soup.find(text=re.compile(r"\d{4}|\d{2}-\d{2}-\d{4}"))
    if date_tag:
        date = clean(date_tag)

    content = ""
    p_tags = soup.find_all("p")
    if p_tags:
        content = clean(" ".join([p.get_text() for p in p_tags]))

    return {
        "title": title,
        "date": date,
        "content": content,
        "type_specific": "news"
    }


def extract_event(soup):
    title = soup.find("h1") or soup.find("h2")
    title = clean(title.get_text()) if title else ""

    date = ""
    match = soup.find(text=re.compile(r"\d{4}|\d{2}-\d{2}-\d{4}"))
    if match:
        date = clean(match)

    details = ""
    p_tags = soup.find_all("p")
    if p_tags:
        details = clean(" ".join([p.get_text() for p in p_tags]))

    return {
        "title": title,
        "date": date,
        "details": details,
        "type_specific": "event"
    }


def extract_announcement(soup):
    title = soup.find("h1") or soup.find("h2")
    title = clean(title.get_text()) if title else ""

    content = ""
    p_tags = soup.find_all("p")
    if p_tags:
        content = clean(" ".join([p.get_text() for p in p_tags]))

    return {
        "title": title,
        "content": content,
        "type_specific": "announcement"
    }


# =============================================================
# MAIN UNIVERSAL EXTRACTOR
# =============================================================

def extract_page(row):
    file_path = row["file"]
    label = row["label"]

    soup = get_soup(file_path)

    if label == "college":
        return extract_college(soup)

    elif label == "department":
        return extract_department(soup)

    elif label == "staff":
        return extract_staff(soup)

    elif label == "news":
        return extract_news(soup)

    elif label == "event":
        return extract_event(soup)

    elif label == "announcement":
        return extract_announcement(soup)

    else:
        return None


# =============================================================
# RUN
# =============================================================

def run():
    df = pd.read_csv(CLASSIFICATION_FILE)
    df = df[df["label"] != "useless"]  # ignore useless

    extracted_rows = []

    for _, row in df.iterrows():
        result = extract_page(row)
        if result:
            result["file"] = row["file"]
            result["label"] = row["label"]
            extracted_rows.append(result)

    output_df = pd.DataFrame(extracted_rows)
    output_df.to_csv(OUTPUT_FILE, index=False, encoding="utf-8")

    print("Extraction Completed!")
    print("Saved to:", OUTPUT_FILE)


if __name__ == "__main__":
    run()
