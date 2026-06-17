#!/usr/bin/env python3
"""
fix_binary_outputs.py

Scans OUT_BASE/api (and subfolders) for files that look like binary (not valid JSON/text),
determine content type by magic bytes (basic sniff) or file header and move/rename to OUT_BASE/files
with correct extension.

Use after recover_all_apis.py if you see binary data saved as .json.
"""

import json
from pathlib import Path
import imghdr
import binascii

OUT_BASE = Path("aast_v5_output_20251129_220740")
API_DIR = OUT_BASE / "api"
FILES_DIR = OUT_BASE / "files"
FILES_DIR.mkdir(parents=True, exist_ok=True)

def looks_like_text(path: Path) -> bool:
    try:
        s = path.read_text(encoding="utf8", errors="ignore")
        # if contains many null bytes, it's binary
        if "\x00" in s:
            return False
        # if length small and many non-printable, assume binary
        nonprint = sum(1 for ch in s if ord(ch) < 32 and ch not in ("\n", "\r", "\t"))
        if nonprint / max(1, len(s)) > 0.15:
            return False
        return True
    except Exception:
        return False

def sniff_image_ext(path: Path):
    try:
        t = imghdr.what(str(path))
        if t:
            return "." + t
    except:
        pass
    # check for PDF
    try:
        b = path.read_bytes()[:8]
        if b.startswith(b"%PDF-"):
            return ".pdf"
    except:
        pass
    return None

def fix_files():
    moved = []
    for p in API_DIR.rglob("*"):
        if not p.is_file():
            continue
        # skip already correct types (json, html, jpg, png, pdf)
        if p.suffix.lower() in (".json", ".html", ".htm", ".txt", ".xml"):
            # check if actually binary
            if not looks_like_text(p):
                ext = sniff_image_ext(p)
                if not ext:
                    ext = ".bin"
                new_name = p.stem + ext
                dest = FILES_DIR / new_name
                i = 1
                while dest.exists():
                    dest = FILES_DIR / f"{p.stem}_{i}{ext}"
                    i += 1
                p.rename(dest)
                moved.append((str(p), str(dest)))
        else:
            # non-text extension but ensure consistent location
            if p.parent != FILES_DIR:
                dest = FILES_DIR / p.name
                i = 1
                while dest.exists():
                    dest = FILES_DIR / f"{p.stem}_{i}{p.suffix}"
                    i += 1
                p.rename(dest)
                moved.append((str(p), str(dest)))
    print(f"[FIXED] Moved {len(moved)} files to {FILES_DIR}")
    for a,b in moved[:50]:
        print(" -", a, "->", b)

if __name__ == "__main__":
    fix_files()
