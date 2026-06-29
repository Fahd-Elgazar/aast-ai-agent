import os
from pathlib import Path
import shutil

BASE = Path('.')
MOVES = [
    ('DOCKERIZATION.md', 'docs/deployment/DOCKERIZATION.md'),
    ('MASTER_PROJECT_BANK.md', 'docs/architecture/MASTER_PROJECT_BANK.md'),
    ('MASTER_TECHNICAL_DOCUMENTATION.md', 'docs/architecture/MASTER_TECHNICAL_DOCUMENTATION.md'),
    ('academic_ai_engineer_portfolio.md', 'docs/research/academic_ai_engineer_portfolio.md'),
    ('cv.md', 'docs/archive/cv.md'),
    ('cv.pdf', 'docs/archive/cv.pdf'),
    ('diagram.md', 'docs/diagrams/diagram.md'),
    ('diagram.html', 'docs/diagrams/diagram.html'),
    ('diagram.png', 'docs/diagrams/diagram.png'),
    ('diagram.jpeg', 'docs/diagrams/diagram.jpeg'),
    ('diagram.pdf', 'docs/diagrams/diagram.pdf'),
    ('doc/MASTER_TECHNICAL_DOCUMENTATION.md', 'docs/archive/MASTER_TECHNICAL_DOCUMENTATION_doc_duplicate.md'),
    ('book/03_ARCHITECTURAL_DIAGRAMS.md', 'docs/diagrams/03_ARCHITECTURAL_DIAGRAMS.md'),
    ('book/04_PERFORMANCE_ANALYSIS.md', 'docs/reports/04_PERFORMANCE_ANALYSIS.md'),
    ('book/AAST_AI_Agent_Architecture_Sequence_Diagrams.md', 'docs/diagrams/AAST_AI_Agent_Architecture_Sequence_Diagrams.md'),
    ('book/CONDENSED_RUNTIME_TRACE.md', 'docs/architecture/CONDENSED_RUNTIME_TRACE.md'),
    ('book/INTERNAL_TEAM_DOCUMENTATION.md', 'docs/development/INTERNAL_TEAM_DOCUMENTATION.md'),
    ('book/INTERNAL_TEAM_DOCUMENTATION.pdf', 'docs/development/INTERNAL_TEAM_DOCUMENTATION.pdf'),
    ('book/MASTER_TECHNICAL_DOCUMENTATION.md', 'docs/archive/MASTER_TECHNICAL_DOCUMENTATION_duplicate.md'),
    ('book/VERIFIED_SYSTEM_MAP.md', 'docs/architecture/VERIFIED_SYSTEM_MAP.md'),
    ('college-decision-system-backend/SECURITY_SCRUB_GUIDE.md', 'docs/development/SECURITY_SCRUB_GUIDE.md'),
    ('college-decision-system-backend/SEMANTIC_TAGGING_GUIDE.md', 'docs/development/SEMANTIC_TAGGING_GUIDE.md'),
    ('college-decision-system-backend/docs/AAST_AI_Agent_Architecture_Sequence_Diagrams.md', 'docs/archive/Sequence_Diagrams_duplicate.md'),
    ('college-decision-system-backend/docs/CONDENSED_RUNTIME_TRACE.md', 'docs/archive/CONDENSED_RUNTIME_TRACE_duplicate.md'),
    ('college-decision-system-backend/docs/VERIFIED_SYSTEM_MAP.md', 'docs/archive/VERIFIED_SYSTEM_MAP_duplicate.md'),
    ('college-decision-system-backend/docs/demo_examples.md', 'docs/api/decision_examples.md'),
    ('aast-ai-agent-main/docs/01_MASTER_TECHNICAL_REPORT.md', 'docs/reports/01_MASTER_TECHNICAL_REPORT.md'),
    ('aast-ai-agent-main/docs/02_COMPONENT_SYSTEM_DESCRIPTION.md', 'docs/architecture/02_COMPONENT_SYSTEM_DESCRIPTION.md'),
    ('aast-ai-agent-main/docs/03_ARCHITECTURAL_DIAGRAMS.md', 'docs/archive/03_ARCHITECTURAL_DIAGRAMS_duplicate.md'),
    ('aast-ai-agent-main/docs/04_PERFORMANCE_ANALYSIS.md', 'docs/archive/04_PERFORMANCE_ANALYSIS_duplicate.md'),
    ('relationship/graph_metrics_phase4b.md', 'docs/reports/graph_metrics_phase4b.md'),
    ('aast-ai-agent-main/AAST_AGENT_SYSTEM_DOCS.md', 'docs/architecture/AAST_AGENT_SYSTEM_DOCS.md'),
]

moved = []
skipped = []
missing = []
conflicts = []

for src_rel, dst_rel in MOVES:
    src = BASE / src_rel
    dst = BASE / dst_rel
    if not src.exists():
        missing.append(src_rel)
        continue
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists():
        if dst.resolve() == src.resolve():
            skipped.append(src_rel)
            continue
        conflicts.append((src_rel, dst_rel))
        continue
    shutil.move(str(src), str(dst))
    moved.append((src_rel, dst_rel))

# Remove empty directories if fully moved
for candidate in ['book', 'doc', 'college-decision-system-backend/docs', 'aast-ai-agent-main/docs']:
    path = BASE / candidate
    if path.exists() and path.is_dir():
        try:
            if not any(path.rglob('*')):
                path.rmdir()
                print('REMOVED EMPTY DIR', candidate)
        except Exception:
            pass

print('MOVED', len(moved), 'files')
for src, dst in moved:
    print('  ', src, '->', dst)
print('SKIPPED', len(skipped))
for src in skipped:
    print('  ', src)
print('MISSING', len(missing))
for src in missing:
    print('  ', src)
print('CONFLICTS', len(conflicts))
for src, dst in conflicts:
    print('  ', src, '->', dst)
