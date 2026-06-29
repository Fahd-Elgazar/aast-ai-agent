import os
import re

repo_path = r"C:\AI_AGENT\final_book\FINAL_EVIDENCE_REPOSITORY.md"

with open(repo_path, "r", encoding="utf-8") as f:
    content = f.read()

# Parse the documents
blocks = content.split("### ")[1:]
documents = []
for block in blocks:
    lines = block.strip().split("\n")
    title = lines[0].strip()
    path = ""
    reason = ""
    trust = ""
    topics = ""
    chapters = ""
    for line in lines[1:]:
        if line.startswith("* **Original Path**:"):
            path = line.split(":", 1)[1].strip(" `")
        elif line.startswith("* **Reason Selected**:"):
            reason = line.split(":", 1)[1].strip()
        elif line.startswith("* **Trust Level**:"):
            trust = line.split(":", 1)[1].strip()
        elif line.startswith("* **Topics Covered**:"):
            topics = line.split(":", 1)[1].strip()
        elif line.startswith("* **Chapters Using It**:"):
            chapters = line.split(":", 1)[1].strip()
    
    # Calculate score based on hierarchy
    path_lower = path.lower()
    score = 10
    if "docs\\reverse_engineering" in path_lower:
        score = 1
    elif "docs\\architecture" in path_lower:
        score = 2
    elif "docs\\deployment" in path_lower or "docs\\api" in path_lower or "docs\\development" in path_lower:
        score = 3
    elif "template" in path_lower:
        score = 4
    elif "doc 2\\golden_book" in path_lower:
        score = 5
    elif "doc 2" in path_lower:
        score = 6
    
    # Normalizing file names for deduplication
    filename = os.path.basename(path).lower()
    base_key = re.sub(r'^\d+[a-z]?_', '', filename)
    
    documents.append({
        "title": title,
        "path": path,
        "reason": reason,
        "trust": trust,
        "topics": topics,
        "chapters": chapters,
        "score": score,
        "base_key": base_key
    })

# Deduplicate
canonical = {}
for doc in documents:
    key = doc["base_key"]
    if key not in canonical:
        canonical[key] = [doc]
    else:
        canonical[key].append(doc)

final_set = []
dedup_log = []

for key, docs in canonical.items():
    docs.sort(key=lambda x: x["score"])
    best_doc = docs[0]
    
    final_set.append(best_doc)
    dups_removed = [d["path"] for d in docs[1:]]
    dedup_log.append({
        "canonical": best_doc,
        "duplicates": dups_removed
    })

# Hard limit 20-50, we remove score >= 5 (legacy doc 2 copies) if we have > 50
if len(final_set) > 50:
    final_set = [d for d in final_set if d["score"] < 5]

# If still > 50, remove score == 3
if len(final_set) > 50:
    final_set = [d for d in final_set if d["score"] < 3]

with open(r"C:\AI_AGENT\final_book\CANONICAL_EVIDENCE_REGISTRY.md", "w", encoding="utf-8") as f:
    f.write("# CANONICAL EVIDENCE REGISTRY\n\n")
    for log in dedup_log:
        doc = log["canonical"]
        f.write(f"### {doc['title']}\n")
        f.write(f"* **Canonical Document**: `{doc['path']}`\n")
        f.write(f"* **Duplicate Documents Removed**: {len(log['duplicates'])}\n")
        for dup in log['duplicates']:
            f.write(f"  * `{dup}`\n")
        reason_str = "Highest Authority Version (Source Code / Reverse Engineering / Architecture)"
        if doc['score'] == 4: reason_str = "Golden Book / Template"
        f.write(f"* **Reason Retained**: {reason_str}\n")
        f.write(f"* **Trust Level**: {doc['trust']}\n")
        f.write(f"* **Topics Covered**: {doc['topics']}\n\n")

with open(r"C:\AI_AGENT\final_book\FINAL_SOURCE_SET.md", "w", encoding="utf-8") as f:
    f.write("# FINAL SOURCE SET\n\n")
    f.write(f"Total documents: {len(final_set)}. This is the definitive set of documents to be used for thesis generation.\n\n")
    for doc in final_set:
        f.write(f"### {doc['title']}\n")
        f.write(f"* **Path**: `{doc['path']}`\n")
        f.write(f"* **Topics Covered**: {doc['topics']}\n")
        f.write(f"* **Chapters**: {doc['chapters']}\n\n")

print(f"Final Source Set size: {len(final_set)}")
