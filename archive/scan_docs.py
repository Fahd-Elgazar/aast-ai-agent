import os
import glob
import time
from datetime import datetime

roots = [
    r"C:\AI_AGENT\docs",
    r"C:\AI_AGENT\doc 2",
    r"C:\AI_AGENT"
]

exclude_files = [
    "academic_ai_engineer_portfolio.md",
    "cv.md",
    "MASTER_PROJECT_BANK.md",
    "cv.pdf",
    "diagram.md"
]

include_exts = [".md", ".docx", ".pdf"]

def get_title(path):
    title = os.path.basename(path)
    if path.endswith(".md"):
        try:
            with open(path, 'r', encoding='utf-8') as f:
                for _ in range(5):
                    line = f.readline().strip()
                    if line.startswith("# "):
                        return line[2:].strip()
        except:
            pass
    return title

def guess_trust_ranking(path):
    path_lower = path.lower()
    if "template" in path_lower:
        return "Priority 2 (Golden Book)"
    elif "reverse_engineering" in path_lower or "verified" in path_lower:
        return "Priority 3 (Production Documentation)"
    elif "architecture" in path_lower or "technical" in path_lower:
        return "Priority 4 (Architecture Documentation)"
    elif "doc 2" in path_lower and "conflict" in path_lower:
        return "Priority 5 (Legacy Documentation)"
    return "Priority 3 (Production Documentation)"

def guess_purpose(path):
    path_lower = path.lower()
    if "template" in path_lower:
        return "Defines the academic formatting, required sections, and constraints for the final project book."
    elif "reverse_engineering" in path_lower:
        return "Module-level reverse engineering and system truth extraction."
    elif "conflict" in path_lower:
        return "Records detected conflicts between different documentation sources."
    elif "architecture" in path_lower:
        return "Describes system architecture, data flow, and components."
    elif "report" in path_lower or "verdict" in path_lower:
        return "Provides evaluation metrics, progress, or performance reports."
    return "Technical documentation and system reference."

docs = []
for root in roots:
    if root == r"C:\AI_AGENT":
        # Only do top level for root
        for f in os.listdir(root):
            path = os.path.join(root, f)
            if os.path.isfile(path) and any(f.endswith(ext) for ext in include_exts):
                if f not in exclude_files and "template" in f.lower(): # explicitly include template
                    docs.append(path)
    else:
        for dirpath, dirnames, filenames in os.walk(root):
            for f in filenames:
                if any(f.endswith(ext) for ext in include_exts) and f not in exclude_files:
                    docs.append(os.path.join(dirpath, f))

# Deduplicate
docs = list(set(docs))
docs.sort()

with open(r"C:\AI_AGENT\DOCUMENT_REGISTRY.md", "w", encoding="utf-8") as out:
    out.write("# DOCUMENT REGISTRY\n\n")
    out.write("This registry tracks all discovered documentation, templates, and evidence files. The dead files (cv, portfolio, project bank) have been removed.\n\n")
    out.write("| Path | Title | Purpose | Topics Covered | Confidence Level | Last Modified | Trust Ranking |\n")
    out.write("|---|---|---|---|---|---|---|\n")
    
    for path in docs:
        title = get_title(path)
        purpose = guess_purpose(path)
        trust = guess_trust_ranking(path)
        modified = datetime.fromtimestamp(os.path.getmtime(path)).strftime('%Y-%m-%d')
        topics = "System internals, APIs, architecture"
        if "template" in path.lower():
            topics = "Required chapters, sections, formatting"
            trust = "Priority 2 (Golden Book)"
        elif "api" in path.lower():
            topics = "API endpoints, contracts"
        
        out.write(f"| `{path}` | {title} | {purpose} | {topics} | High | {modified} | {trust} |\n")

print("Created DOCUMENT_REGISTRY.md with", len(docs), "documents.")
