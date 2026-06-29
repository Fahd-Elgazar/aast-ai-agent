import os
import datetime

root_dir = r'C:\AI_AGENT'
output_dir = r'C:\AI_AGENT\doc 2\conflict_audit'
os.makedirs(output_dir, exist_ok=True)
output_file = os.path.join(output_dir, 'DOCUMENT_INVENTORY.md')

md_files = []
for dirpath, _, filenames in os.walk(root_dir):
    if 'node_modules' in dirpath or '.git' in dirpath:
        continue
    for f in filenames:
        if f.endswith('.md') or f.endswith('.txt') or f.endswith('.pdf') or f.endswith('.docx') or f.endswith('.pptx'):
            full_path = os.path.join(dirpath, f)
            rel_path = os.path.relpath(full_path, root_dir)
            size = os.path.getsize(full_path)
            mtime = os.path.getmtime(full_path)
            dt = datetime.datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M:%S')
            
            # Simple heuristics for classification
            purpose = "UNKNOWN"
            if 'diagram' in rel_path.lower(): purpose = "ARCHITECTURE/DIAGRAM"
            elif 'audit' in rel_path.lower(): purpose = "AUDIT_REPORT"
            elif 'golden_book' in rel_path.lower(): purpose = "VERIFIED_THESIS_SOURCE"
            elif 'archive' in rel_path.lower(): purpose = "ARCHIVE/OBSOLETE"
            elif 'book' in rel_path.lower(): purpose = "THESIS_BOOK_DRAFT"
            elif 'docs\reports' in rel_path.lower(): purpose = "REPORT"
            elif 'docs\architecture' in rel_path.lower(): purpose = "ARCHITECTURE_DOC"
            elif 'docs\reverse_engineering' in rel_path.lower(): purpose = "REVERSE_ENGINEERING_DOC"
            else: purpose = "GENERAL_DOCUMENTATION"
            
            dup_indicator = "YES" if "duplicate" in f.lower() else "NO"
            
            md_files.append({
                "filename": f,
                "path": rel_path,
                "purpose": purpose,
                "date": dt,
                "size": size,
                "duplicate": dup_indicator
            })

md_files.sort(key=lambda x: x['path'])

with open(output_file, 'w', encoding='utf-8') as out:
    out.write("# DOCUMENT INVENTORY\n\n")
    out.write(f"Total Documents Scanned: {len(md_files)}\n\n")
    out.write("| Filename | Path | Estimated Purpose | Last Modified | Size (bytes) | Is Duplicate |\n")
    out.write("|---|---|---|---|---|---|\n")
    for doc in md_files:
        out.write(f"| {doc['filename']} | {doc['path']} | {doc['purpose']} | {doc['date']} | {doc['size']} | {doc['duplicate']} |\n")

print(f"Inventory written to {output_file} with {len(md_files)} records.")
