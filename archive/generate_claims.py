import os
import re

root_dir = r'C:\AI_AGENT'
output_file = r'C:\AI_AGENT\doc 2\conflict_audit\CLAIM_REGISTRY.md'

claims = []
claim_counter = 1

def add_claim(filepath, category, text, meaning):
    global claim_counter
    rel_path = os.path.relpath(filepath, root_dir)
    claims.append({
        "id": f"C{claim_counter:04d}",
        "doc": rel_path,
        "category": category,
        "text": text.strip().replace('|', '\|').replace('\n', ' '),
        "meaning": meaning.strip().replace('|', '\|').replace('\n', ' ')
    })
    claim_counter += 1

keywords = {
    "ARCHITECTURE": ["microservice", "monolith", "architecture", "component"],
    "MODEL": ["gemini", "gemma", "ollama", "llama", "llm", "model"],
    "SERVICE": ["service", "port ", "runs on", "orchestrator"],
    "ROUTING": ["router", "brain", "routing", "threshold", "personaliasboost", "ambiguitymargin"],
    "DATABASE": ["neo4j", "qdrant", "chroma", "mysql", "mongodb", "database"],
    "PIPELINE": ["pipeline", "rag", "retrieval", "graph"],
}

# Scan selected key docs
target_dirs = [
    os.path.join(root_dir, 'docs', 'architecture'),
    os.path.join(root_dir, 'docs', 'diagrams'),
    os.path.join(root_dir, 'docs', 'reports'),
    os.path.join(root_dir, 'docs', 'reports', 'audit'),
    os.path.join(root_dir, 'doc 2', 'golden_book')
]

for d in target_dirs:
    if not os.path.exists(d): continue
    for root, _, files in os.walk(d):
        for f in files:
            if f.endswith('.md'):
                filepath = os.path.join(root, f)
                with open(filepath, 'r', encoding='utf-8', errors='ignore') as file:
                    lines = file.readlines()
                    for line in lines:
                        lower_line = line.lower()
                        # Only grab substantive lines, not table borders or very short lines
                        if len(lower_line) < 20 or '|--' in lower_line: continue
                        
                        for cat, words in keywords.items():
                            for w in words:
                                if w in lower_line:
                                    # Very naive extraction
                                    meaning = f"Claims something about {w}"
                                    if "port " in lower_line:
                                        m = re.search(r'port (\d+)', lower_line)
                                        if m: meaning = f"Claims port is {m.group(1)}"
                                    elif "gemini" in lower_line and "primary" in lower_line:
                                        meaning = "Claims Gemini is primary model"
                                    elif "ollama" in lower_line and "primary" in lower_line:
                                        meaning = "Claims Ollama is primary model"
                                    elif "qdrant" in lower_line:
                                        meaning = "Claims Qdrant is used"
                                    elif "chroma" in lower_line:
                                        meaning = "Claims ChromaDB is used"
                                    elif "personaliasboost" in lower_line:
                                        meaning = "Claims personAliasBoost config value"
                                        
                                    add_claim(filepath, cat, line, meaning)
                                    break # Only one category per line to avoid duplication

with open(output_file, 'w', encoding='utf-8') as out:
    out.write("# CLAIM REGISTRY\n\n")
    out.write("| CLAIM_ID | DOCUMENT | CATEGORY | TEXT | NORMALIZED_MEANING |\n")
    out.write("|---|---|---|---|---|\n")
    for c in claims:
        out.write(f"| {c['id']} | {c['doc']} | {c['category']} | {c['text'][:150]}... | {c['meaning']} |\n")

print(f"Claim registry written to {output_file} with {len(claims)} records.")
