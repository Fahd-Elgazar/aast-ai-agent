import os
import re
import csv
from pathlib import Path
from collections import Counter, defaultdict

# ====== CONFIG ======
HTML_FOLDER = "html"  
OUTPUT_CSV = "html_classification_results.csv"

# ====== SIMPLE HTML → TEXT EXTRACTOR ======
def html_to_text(raw):
    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(raw, "html.parser")
        for s in soup(["script", "style", "noscript"]):
            s.decompose()
        text = soup.get_text(separator=" ", strip=True)
        return re.sub(r"\s+", " ", text).lower()
    except:
        # fallback (no beautifulsoup)
        raw = re.sub(r"(?s)<script.*?>.*?</script>", " ", raw, flags=re.I)
        raw = re.sub(r"(?s)<style.*?>.*?</style>", " ", raw, flags=re.I)
        raw = re.sub(r"<[^>]+>", " ", raw)
        return re.sub(r"\s+", " ", raw).lower()

# ====== KEYWORDS ======
KEYWORDS = {
    "college": ["college", "كلية", "faculty"],
    "department": ["department", "قسم", "academic department"],
    "program": ["program", "curriculum", "courses", "study plan", "programs & courses"],
    "staff": ["staff", "faculty member", "professor", "lecturer", "أعضاء هيئة التدريس"],
    "news": ["news", "latest news", "news details", "أخبار"],
    "event": ["event", "event details", "upcoming events", "فعاليات"],
    "announcement": ["announcement", "announcements", "notice", "إعلان", "اعلان"],
    "gallery": ["gallery", "album", "photos", "images"]
}

# ====== CLASSIFIER ======
def classify_text(text, filename):
    if len(text) < 60:
        return "useless"

    # keyword counts
    scores = {}
    for cls, kws in KEYWORDS.items():
        scores[cls] = sum(text.count(kw.lower()) for kw in kws)

    # filename hints (extra signal)
    fname = filename.lower()
    if "staff" in fname:
        scores["staff"] += 2
    if "dept" in fname or "department" in fname:
        scores["department"] += 2
    if "news" in fname:
        scores["news"] += 2
    if "event" in fname:
        scores["event"] += 2
    if "program" in fname:
        scores["program"] += 2
    if "gallery" in fname or "album" in fname:
        scores["gallery"] += 2

    # pick highest
    best_class = max(scores, key=scores.get)
    if scores[best_class] == 0:
        return "other"
    return best_class

# ====== MAIN ======
def run_classifier():
    html_dir = Path(HTML_FOLDER)
    html_files = list(html_dir.rglob("*.html"))

    results = []
    counter = Counter()

    for fp in html_files:
        try:
            raw = fp.read_text(encoding="utf-8", errors="ignore")
        except:
            raw = ""
        text = html_to_text(raw)
        cls = classify_text(text, fp.name)

        results.append({
            "file": str(fp),
            "label": cls,
            "text_length": len(text)
        })
        counter[cls] += 1

    # ===== SAVE CSV =====
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["file", "label", "text_length"])
        writer.writeheader()
        writer.writerows(results)

    print("\nClassification Completed!")
    print("Saved results to:", OUTPUT_CSV)
    print("\nSummary:")
    for cls, count in counter.items():
        print(f"{cls}: {count}")

# Run it
if __name__ == "__main__":
    run_classifier()
