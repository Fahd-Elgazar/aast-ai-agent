import os

registry_path = r"C:\AI_AGENT\DOCUMENT_REGISTRY.md"
out_dir = r"C:\AI_AGENT\final_book"
out_path = os.path.join(out_dir, "FINAL_EVIDENCE_REPOSITORY.md")

os.makedirs(out_dir, exist_ok=True)

with open(registry_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

selected = []
excluded = 0

exclude_keywords = [
    "migration", "backup", "duplicate", "temporary", "reorganization", 
    "obsolete", "execution", "git"
]

include_keywords = [
    "architecture", "implementation", "behavior", "api", "deployment", 
    "security", "evaluation", "evidence", "truth", "verified", 
    "technical", "docker", "system", "engine", "router", "database", "template"
]

for line in lines:
    if line.startswith("| `"):
        parts = [p.strip() for p in line.split("|")]
        if len(parts) >= 8:
            path = parts[1].strip("`")
            title = parts[2]
            purpose = parts[3]
            topics = parts[4]
            confidence = parts[5]
            last_mod = parts[6]
            trust = parts[7]
            
            path_lower = path.lower()
            title_lower = title.lower()
            
            # Ensure it is not in the exclude list
            if any(k in path_lower or k in title_lower for k in exclude_keywords):
                excluded += 1
                continue
            
            # Ensure it matches the select criteria
            if any(k in path_lower or k in title_lower for k in include_keywords):
                chapters = "Relevant Chapters"
                if "template" in path_lower: chapters = "All Chapters (Formatting)"
                elif "architecture" in path_lower or "engine" in path_lower or "router" in path_lower: chapters = "Architecture, Design"
                elif "api" in path_lower: chapters = "Implementation, Interfaces"
                elif "deployment" in path_lower or "docker" in path_lower: chapters = "Deployment"
                elif "evaluation" in path_lower or "report" in path_lower or "metrics" in path_lower: chapters = "Evaluation, Results"
                elif "security" in path_lower: chapters = "Security"
                elif "truth" in path_lower or "verified" in path_lower: chapters = "System Truth, Verification"
                else: chapters = "Core System Chapters"
                
                selected.append({
                    "path": path,
                    "title": title,
                    "reason": "Contributes to architecture, implementation, deployment, or system truth.",
                    "trust": trust,
                    "topics": topics,
                    "chapters": chapters
                })
            else:
                excluded += 1

with open(out_path, "w", encoding="utf-8") as f:
    f.write("# FINAL EVIDENCE REPOSITORY\n\n")
    f.write("Curated evidence repository for the graduation project book.\n\n")
    
    for doc in selected:
        f.write(f"### {doc['title']}\n")
        f.write(f"* **Original Path**: `{doc['path']}`\n")
        f.write(f"* **Reason Selected**: {doc['reason']}\n")
        f.write(f"* **Trust Level**: {doc['trust']}\n")
        f.write(f"* **Topics Covered**: {doc['topics']}\n")
        f.write(f"* **Chapters Using It**: {doc['chapters']}\n\n")

print(f"Selected: {len(selected)}")
print(f"Excluded: {excluded}")
