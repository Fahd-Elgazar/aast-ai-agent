import pandas as pd
import json
from pathlib import Path

# ============================
# CONFIG
# ============================

BASE_DIR = Path(__file__).resolve().parent
DATASET_DIR = BASE_DIR / "dataset_v2"

PAGES_XLSX = DATASET_DIR / "pages_v2.xlsx"
OUTPUT_JSON = DATASET_DIR / "broken_pages.json"
OUTPUT_XLSX = DATASET_DIR / "broken_pages.xlsx"

# ============================
# VALIDATION
# ============================

if not PAGES_XLSX.exists():
    print(f"[ERROR] Cannot find pages_df.xlsx at: {PAGES_XLSX}")
    exit(1)

print("[OK] Found pages_df.xlsx — loading...")

# ============================
# LOAD DATA
# ============================

df = pd.read_excel(PAGES_XLSX)

required_cols = {"url", "status", "error", "path"}

missing = required_cols - set(df.columns)
if missing:
    print(f"[ERROR] Missing required columns: {missing}")
    exit(1)

# ============================
# DETECT BROKEN PAGES
# ============================

print("[SCAN] Detecting broken pages...")

BROKEN_STATUSES = {
    "timeout",
    "exception",
    "failed",
    "http_404",
    "http_500",
    "error",
}

broken_df = df[
    (df["status"].isin(BROKEN_STATUSES)) |
    (df["error"].notna()) |
    (df["path"].isna())
]

print(f"[RESULT] Found {len(broken_df)} broken pages.")

# ============================
# SAVE RESULTS
# ============================

broken_list = broken_df.to_dict(orient="records")

with open(OUTPUT_JSON, "w", encoding="utf8") as f:
    json.dump(broken_list, f, ensure_ascii=False, indent=2)

broken_df.to_excel(OUTPUT_XLSX, index=False)

print("[DONE] Broken pages report generated.")
print(f"JSON:  {OUTPUT_JSON}")
print(f"Excel: {OUTPUT_XLSX}")
