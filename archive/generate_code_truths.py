import os
import re

root_dir = r'C:\AI_AGENT'
output_file = r'C:\AI_AGENT\doc 2\conflict_audit\CODE_TRUTH_REGISTRY.md'

truths = []
truth_counter = 1

def add_truth(filepath, line_snippet, fact, evidence):
    global truth_counter
    rel_path = os.path.relpath(filepath, root_dir)
    truths.append({
        "id": f"T{truth_counter:03d}",
        "file": rel_path,
        "line": line_snippet,
        "fact": fact,
        "evidence": evidence.strip().replace('|', '\|').replace('\n', ' <br> ')
    })
    truth_counter += 1

# 1. Orchestrator port & logic
orch_path = os.path.join(root_dir, 'aast-ai-agent-main', 'backend', 'orchestrator.js')
if os.path.exists(orch_path):
    with open(orch_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        for i, line in enumerate(lines):
            if 'const PORT' in line or 'listen(' in line:
                add_truth(orch_path, f"L{i+1}", "Orchestrator Port Assignment", line)
            if 'app.use(' in line and '/api/' in line:
                add_truth(orch_path, f"L{i+1}", "API Route Registration", line)

# 2. Configs (llmConfig, routingCalibration)
llm_config_path = os.path.join(root_dir, 'aast-ai-agent-main', 'backend', 'config', 'llmConfig.js')
if os.path.exists(llm_config_path):
    with open(llm_config_path, 'r', encoding='utf-8') as f:
        content = f.read()
        if 'failoverChain' in content or 'primary' in content:
            add_truth(llm_config_path, "Whole File", "LLM Configuration and Failover", "Primary Model / Failover configs exist in llmConfig.js")

routing_config_path = os.path.join(root_dir, 'aast-ai-agent-main', 'backend', 'config', 'routingCalibration.js')
if os.path.exists(routing_config_path):
    with open(routing_config_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        for i, line in enumerate(lines):
            if 'personAliasBoost' in line or 'ambiguityMargin' in line or 'threshold' in line.lower():
                add_truth(routing_config_path, f"L{i+1}", "Routing Threshold / Calibration", line)

# 3. Vector DB / Neo4j
neo4j_path = os.path.join(root_dir, 'aast-ai-agent-main', 'backend', 'db', 'neo4j.js')
if os.path.exists(neo4j_path):
    with open(neo4j_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        for i, line in enumerate(lines):
            if 'neo4j.driver' in line:
                add_truth(neo4j_path, f"L{i+1}", "Neo4j Driver Initialization", line)

rag_path = os.path.join(root_dir, 'aast-ai-agent-main', 'backend', 'services', 'ragService.js')
if os.path.exists(rag_path):
    with open(rag_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        for i, line in enumerate(lines):
            if 'Qdrant' in line or 'Chroma' in line or 'vector' in line.lower():
                add_truth(rag_path, f"L{i+1}", "Vector DB Usage", line)

# 4. LLM Services
gemini_path = os.path.join(root_dir, 'aast-ai-agent-main', 'backend', 'services', 'geminiService.js')
if os.path.exists(gemini_path):
    with open(gemini_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        for i, line in enumerate(lines):
            if 'model:' in line or 'GoogleGenerativeAI' in line:
                add_truth(gemini_path, f"L{i+1}", "Gemini Model Usage", line)

# 5. docker-compose.yml
docker_path = os.path.join(root_dir, 'docker-compose.yml')
if os.path.exists(docker_path):
    with open(docker_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        current_service = None
        for i, line in enumerate(lines):
            if line.startswith('  ') and not line.startswith('    ') and ':' in line:
                current_service = line.split(':')[0].strip()
                add_truth(docker_path, f"L{i+1}", "Docker Service Declared", current_service)
            if 'image:' in line and current_service:
                add_truth(docker_path, f"L{i+1}", f"Docker Image for {current_service}", line)
            if 'ports:' in line or ('-' in line and ':' in line and current_service):
                if re.search(r'\d+:\d+', line):
                    add_truth(docker_path, f"L{i+1}", f"Port Binding for {current_service}", line)

# 6. DSS Backend
dss_main_path = os.path.join(root_dir, 'college-decision-system-backend', 'app', 'main.py')
if os.path.exists(dss_main_path):
    with open(dss_main_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        for i, line in enumerate(lines):
            if '@app.' in line:
                add_truth(dss_main_path, f"L{i+1}", "DSS API Endpoint", line)

with open(output_file, 'w', encoding='utf-8') as out:
    out.write("# CODE TRUTH REGISTRY\n\n")
    out.write("| TRUTH_ID | FILE | LINE(S) | FACT | EVIDENCE |\n")
    out.write("|---|---|---|---|---|\n")
    for t in truths:
        out.write(f"| {t['id']} | {t['file']} | {t['line']} | {t['fact']} | {t['evidence']} |\n")

print(f"Code truths written to {output_file} with {len(truths)} records.")
