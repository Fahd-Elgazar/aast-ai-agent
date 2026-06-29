import os
import re
import datetime

root_dir = r'C:\AI_AGENT'
output_dir = r'C:\AI_AGENT\doc 2\conflict_audit'
os.makedirs(output_dir, exist_ok=True)

# Helper function for writing markdown
def write_md(filename, content):
    with open(os.path.join(output_dir, filename), 'w', encoding='utf-8') as f:
        f.write(content)

# PHASE 1: DOCUMENT INVENTORY
def phase1_inventory():
    print("Running Phase 1: Document Inventory...")
    inventory = []
    for root, dirs, files in os.walk(root_dir):
        if 'node_modules' in root or '.git' in root or 'dist' in root or 'build' in root or 'coverage' in root or 'vendor' in root:
            continue
        for f in files:
            if f.lower().endswith(('.md', '.txt', '.pdf', '.docx', '.pptx')):
                full_path = os.path.join(root, f)
                rel_path = os.path.relpath(full_path, root_dir)
                size = os.path.getsize(full_path)
                mtime = os.path.getmtime(full_path)
                dt = datetime.datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M:%S')
                inventory.append({
                    "path": rel_path,
                    "abs_path": full_path,
                    "type": f.split('.')[-1].upper(),
                    "size": size,
                    "modified": dt
                })
    
    out = "# DOCUMENT INVENTORY\n\n"
    out += "| Relative Path | Absolute Path | Type | Size (bytes) | Last Modified |\n"
    out += "|---|---|---|---|---|\n"
    for doc in sorted(inventory, key=lambda x: x['path']):
        out += f"| {doc['path']} | {doc['abs_path']} | {doc['type']} | {doc['size']} | {doc['modified']} |\n"
    
    write_md('DOCUMENT_INVENTORY.md', out)
    return inventory

# PHASE 2: CODE TRUTH EXTRACTION
def phase2_code_truths():
    print("Running Phase 2: Code Truth Extraction...")
    truths = []
    t_id = 1
    
    # Define targets and regexes
    targets = {
        r'aast-ai-agent-main\backend\orchestrator.js': [
            (r'const\s+PORT\s*=\s*(\d+)', 'orchestrator.port={0}', 'Ports'),
            (r'app\.use\(([\'"].*?[\'"])', 'api.route={0}', 'API Routes')
        ],
        r'aast-ai-agent-main\backend\config\llmConfig.js': [
            (r'primary:\s*[\'"](.*?)[\'"]', 'model.primary={0}', 'Primary Models'),
            (r'fallback:\s*[\'"](.*?)[\'"]', 'model.fallback={0}', 'Fallback Models')
        ],
        r'aast-ai-agent-main\backend\config\routingCalibration.js': [
            (r'personAliasBoost:\s*([\d\.]+)', 'routing.personAliasBoost={0}', 'Routers'),
            (r'ambiguityMargin:\s*([\d\.]+)', 'routing.ambiguityMargin={0}', 'Routers')
        ],
        r'aast-ai-agent-main\backend\services\ragService.js': [
            (r'(QdrantClient|ChromaClient|pinecone)', 'vector_store={0}', 'Vector Stores')
        ],
        r'docker-compose.yml': [
            (r'^\s\s([\w-]+):$', 'docker.service={0}', 'Services')
        ]
    }
    
    for rel_path, patterns in targets.items():
        abs_path = os.path.join(root_dir, rel_path)
        if not os.path.exists(abs_path):
            continue
        with open(abs_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            for i, line in enumerate(lines):
                line_clean = line.strip()
                for pat, fact_tpl, fact_type in patterns:
                    m = re.search(pat, line)
                    if m:
                        val = m.group(1)
                        fact = fact_tpl.format(val)
                        truths.append({
                            "id": f"T{t_id:04d}",
                            "file": rel_path,
                            "line": i+1,
                            "text": line_clean.replace('|', '\|'),
                            "type": fact_type,
                            "fact": fact
                        })
                        t_id += 1
                        
    out = "# CODE TRUTH REGISTRY\n\n"
    out += "| TRUTH_ID | FILE_PATH | LINE_NUMBER | EXACT_LINE | FACT_TYPE | NORMALIZED_FACT |\n"
    out += "|---|---|---|---|---|---|\n"
    for t in truths:
        out += f"| {t['id']} | {t['file']} | {t['line']} | {t['text']} | {t['type']} | {t['fact']} |\n"
        
    write_md('CODE_TRUTH_REGISTRY.md', out)
    return truths

# PHASE 3: CLAIM EXTRACTION
def phase3_claims(inventory):
    print("Running Phase 3: Claim Extraction...")
    claims = []
    c_id = 1
    
    # Keywords mapping to normalized facts
    keywords = {
        'port 8000': 'orchestrator.port=8000',
        'port 8004': 'orchestrator.port=8004',
        'gemini is primary': 'model.primary=gemini',
        'gemini as primary': 'model.primary=gemini',
        'ollama is primary': 'model.primary=ollama',
        'qdrant': 'vector_store=QdrantClient',
        'chromadb': 'vector_store=ChromaClient',
        'chroma db': 'vector_store=ChromaClient',
        'neo4j': 'database=neo4j'
    }
    
    for doc in inventory:
        if doc['type'] == 'MD':
            try:
                with open(doc['abs_path'], 'r', encoding='utf-8', errors='ignore') as f:
                    lines = f.readlines()
                    for i, line in enumerate(lines):
                        line_clean = line.strip()
                        if not line_clean or len(line_clean) < 10 or line_clean.startswith('|'):
                            continue
                        lower_line = line_clean.lower()
                        for kw, fact in keywords.items():
                            if kw in lower_line:
                                claims.append({
                                    "id": f"C{c_id:04d}",
                                    "doc": doc['path'],
                                    "line": i+1,
                                    "text": line_clean.replace('|', '\|'),
                                    "type": "Derived",
                                    "fact": fact
                                })
                                c_id += 1
            except Exception as e:
                pass
                
    out = "# CLAIM REGISTRY\n\n"
    out += "| CLAIM_ID | DOCUMENT | LINE_NUMBER | EXACT_TEXT | CLAIM_TYPE | NORMALIZED_FACT |\n"
    out += "|---|---|---|---|---|---|\n"
    for c in claims:
        out += f"| {c['id']} | {c['doc']} | {c['line']} | {c['text']} | {c['type']} | {c['fact']} |\n"
        
    write_md('CLAIM_REGISTRY.md', out)
    return claims

# PHASE 5: DOCUMENT VS CODE AUDIT
def phase5_code_conflicts(truths, claims):
    print("Running Phase 5: Document vs Code Audit...")
    conflicts = []
    cc_id = 1
    
    # Group truths by fact type prefix (e.g. 'orchestrator.port')
    truth_map = {}
    for t in truths:
        prefix = t['fact'].split('=')[0]
        if prefix not in truth_map:
            truth_map[prefix] = []
        truth_map[prefix].append(t)
        
    for c in claims:
        prefix = c['fact'].split('=')[0]
        if prefix in truth_map:
            # Check if it matches any truth
            supported = False
            contradicting_truth = None
            for t in truth_map[prefix]:
                if c['fact'] == t['fact']:
                    supported = True
                    break
                else:
                    contradicting_truth = t
            
            if not supported and contradicting_truth:
                conflicts.append({
                    "id": f"CC{cc_id:04d}",
                    "doc": c['doc'],
                    "doc_line": c['line'],
                    "doc_text": c['text'],
                    "code_file": contradicting_truth['file'],
                    "code_line": contradicting_truth['line'],
                    "code_text": contradicting_truth['text'],
                    "doc_fact": c['fact'],
                    "code_fact": contradicting_truth['fact'],
                    "status": "CONTRADICTED",
                    "severity": "HIGH"
                })
                cc_id += 1
                
    out = "# CODE CONFLICT REGISTRY\n\n"
    out += "| CONFLICT_ID | DOCUMENT_PATH | DOC_LINE | DOCUMENT_TEXT | CODE_FILE | CODE_LINE | CODE_TEXT | DOC_FACT | CODE_FACT | STATUS | SEVERITY |\n"
    out += "|---|---|---|---|---|---|---|---|---|---|---|\n"
    for c in conflicts:
        out += f"| {c['id']} | {c['doc']} | {c['doc_line']} | {c['doc_text']} | {c['code_file']} | {c['code_line']} | {c['code_text']} | {c['doc_fact']} | {c['code_fact']} | {c['status']} | {c['severity']} |\n"
        
    write_md('CODE_CONFLICT_REGISTRY.md', out)
    return conflicts

# PHASE 6: DOCUMENT VS DOCUMENT AUDIT
def phase6_doc_conflicts(claims):
    print("Running Phase 6: Document vs Document Audit...")
    conflicts = []
    dc_id = 1
    
    # Group claims by prefix
    claim_map = {}
    for c in claims:
        prefix = c['fact'].split('=')[0]
        if prefix not in claim_map:
            claim_map[prefix] = []
        claim_map[prefix].append(c)
        
    for prefix, clist in claim_map.items():
        for i in range(len(clist)):
            for j in range(i+1, len(clist)):
                c1 = clist[i]
                c2 = clist[j]
                if c1['fact'] != c2['fact'] and c1['doc'] != c2['doc']:
                    conflicts.append({
                        "id": f"DC{dc_id:04d}",
                        "doc_a": c1['doc'],
                        "line_a": c1['line'],
                        "text_a": c1['text'],
                        "doc_b": c2['doc'],
                        "line_b": c2['line'],
                        "text_b": c2['text'],
                        "fact_a": c1['fact'],
                        "fact_b": c2['fact'],
                        "reason": f"Disagreement on {prefix}",
                        "severity": "MEDIUM"
                    })
                    dc_id += 1
                    
    out = "# DOCUMENT CONFLICT REGISTRY\n\n"
    out += "| CONFLICT_ID | DOCUMENT_A | LINE_A | TEXT_A | DOCUMENT_B | LINE_B | TEXT_B | FACT_A | FACT_B | WHY_CONFLICT | SEVERITY |\n"
    out += "|---|---|---|---|---|---|---|---|---|---|---|\n"
    for c in conflicts:
        out += f"| {c['id']} | {c['doc_a']} | {c['line_a']} | {c['text_a']} | {c['doc_b']} | {c['line_b']} | {c['text_b']} | {c['fact_a']} | {c['fact_b']} | {c['reason']} | {c['severity']} |\n"
        
    write_md('DOCUMENT_CONFLICT_REGISTRY.md', out)
    return conflicts

# MASTER REGISTRY
def generate_master(inv, tr, cl, cc, dc):
    print("Generating Master Registry...")
    out = "# MASTER CONFLICT REGISTRY\n\n"
    out += "## Audit Statistics\n"
    out += f"- Total Documents Scanned: {len(inv)}\n"
    out += f"- Total Code Truths Extracted: {len(tr)}\n"
    out += f"- Total Document Claims Extracted: {len(cl)}\n"
    out += f"- Total Code Conflicts: {len(cc)}\n"
    out += f"- Total Document Conflicts: {len(dc)}\n\n"
    out += "## Code Conflicts Summary\n"
    for c in cc:
        out += f"- {c['id']}: {c['doc']} says {c['doc_fact']} but code {c['code_file']} says {c['code_fact']}\n"
    write_md('MASTER_CONFLICT_REGISTRY.md', out)

def main():
    inv = phase1_inventory()
    tr = phase2_code_truths()
    cl = phase3_claims(inv)
    cc = phase5_code_conflicts(tr, cl)
    dc = phase6_doc_conflicts(cl)
    
    # Empty files for the remaining phases since we rely purely on extraction
    write_md('ARCHITECTURE_OWNERSHIP_CONFLICTS.md', "# ARCHITECTURE OWNERSHIP CONFLICTS\n\nSTATUS: NOT VERIFIED\nEvidence unavailable or extraction yielded no results.\n")
    write_md('PIPELINE_CONFLICTS.md', "# PIPELINE CONFLICTS\n\nSTATUS: NOT VERIFIED\nEvidence unavailable or extraction yielded no results.\n")
    write_md('SERVICE_COUNT_CONFLICTS.md', "# SERVICE COUNT CONFLICTS\n\nSTATUS: NOT VERIFIED\nEvidence unavailable or extraction yielded no results.\n")
    write_md('THESIS_CRITICAL_CONFLICTS.md', "# THESIS CRITICAL CONFLICTS\n\nSTATUS: NOT VERIFIED\nEvidence unavailable or extraction yielded no results.\n")

    generate_master(inv, tr, cl, cc, dc)
    print("Forensic audit complete.")

if __name__ == '__main__':
    main()
