import os, csv
from collections import Counter

def classify(path):
    p = path.replace('\\','/')
    lower = p.lower()
    basename = os.path.basename(p)
    if p.startswith('doc/book/01_authoritative_sources/'):
        return 'TIER 1', 'Located in authoritative sources registry folder.'
    if basename in {
        'architecture_baseline.md', 'system_context_map_v2.md', 'target_architecture_v3.md',
        'production_system_map.md', 'book_source_conflict_resolution.md', 'authoritative_source_registry.md',
        'book_source_mapping.md', 'book_source_inventory.md', 'book_source_lock.md', 'book_chapter_structure_discovery.md',
        'book_discovery_summary.md', 'book_duplicate_report.md', 'book_gap_report.md', 'book_final_readiness_report.md',
        'book_figure_discovery.md', 'book_table_discovery.md', 'book_appendix_discovery.md',
        'master_document_verdict.md', 'master_conflict_audit.md', 'report_inventory.md', 'report_duplication_audit.md',
        'missing_evidence_report.md', 'thesis_evidence_map.md', 'thesis_evidence_readiness.md', 'thesis_claim_discovery.md',
        'implementation_evidence_report.md', 'experiment_evidence_report.md', 'evaluation_readiness_report.md',
        'evaluation_metric_discovery.md', 'evaluation_gap_report.md', 'evaluation_asset_inventory.md',
        'book_source_conflict_resolution.md'
    }:
        return 'TIER 1', 'Root-level book or source registry document referenced by authoritative source hierarchy.'
    if lower.startswith('docs/reverse_engineering/'):
        return 'TIER 2', 'Reverse-engineering audit notes tied to code implementation.'
    if lower.startswith('docs/architecture/'):
        return 'TIER 2', 'Architecture documentation supporting system claims and design.'
    if lower.startswith('docs/reports/audit/'):
        return 'TIER 3', 'Audit batch logs marked as early or historical in source registry.'
    if lower.startswith('docs/reports/'):
        return 'TIER 2', 'Report files supporting implementation and technical claims.'
    if lower.startswith('doc/book/04_evidence/') or lower.startswith('doc/book/06_evaluation/') or lower.startswith('doc/book/05_related_work/'):
        return 'TIER 2', 'Evidence and evaluation documents supporting thesis claims.'
    if lower.startswith('doc/book/chapter_'):
        return 'TIER 2', 'Book chapter source files used in compilation and support.'
    if lower.startswith('doc/book/registry/'):
        return 'TIER 1', 'Book registry metadata used to map sources and figures.'
    if lower.startswith('docs/diagrams/') or lower.startswith('diagrams/') or lower.startswith('doc/book/02_figures/'):
        return 'TIER 2', 'Diagram and figure assets supporting architecture and evidence.'
    if lower.startswith('docs/development/'):
        return 'TIER 2', 'Development guides and internal documentation used for implementation evidence.'
    if lower.startswith('aast-ai-agent-main/backend/') or lower.startswith('aast-ai-agent-main/frontend/') or lower.startswith('college-decision-system-backend/'):
        if 'dist/' in lower or 'public/' in lower or '.pytest_cache' in lower:
            return 'TIER 4', 'Generated build assets or cache files in implementation subprojects.'
        return 'TIER 2', 'Implementation documentation from actual backend/frontend projects.'
    if lower.startswith('docs/archive/') or 'archive' in lower:
        return 'TIER 3', 'Legacy archive copies and historical copies of documentation.'
    if lower.startswith('data/scraping/') or lower.startswith('data/relationship/'):
        return 'TIER 4', 'Scraped data and relationship analysis artifacts not primary thesis documents.'
    if 'last version - copy' in lower or 'last version' in lower or 'copy' in lower and 'data/scraping/step8' in lower:
        return 'TIER 4', 'Duplicate or archived scraping artifacts from "last version" copies.'
    if lower.endswith('.pdf') and lower.startswith('docs/'):
        return 'TIER 2', 'PDF report in docs directory supporting evidence.'
    if lower.endswith('.md') and lower.startswith('doc/book/02_figures/'):
        return 'TIER 2', 'Figures registry in book content.'
    if lower.startswith('data/'):
        return 'TIER 4', 'Data artifacts outside documentation source scope.'
    return 'TIER 3', 'Default classification for documents not clearly authoritative or active supporting evidence.'

inventory = []
with open('document_inventory.tsv', encoding='utf-8') as f:
    for line in f:
        path, ext, mtime = line.rstrip('\n').split('\t')
        tier, reason = classify(path)
        inventory.append((path, ext, mtime, tier, reason))

counts = Counter(x[3] for x in inventory)
with open('doc/book/AUTHORITATIVE_SOURCE_REGISTRY_PHASE2.md', 'w', encoding='utf-8') as out:
    out.write('# Phase 2 Authoritative Source Registry\n')
    out.write('## Tier classification for repository documents\n\n')
    out.write('### Summary\n')
    for tier in ['TIER 1','TIER 2','TIER 3','TIER 4']:
        out.write(f'- {tier}: {counts[tier]} files\n')
    out.write('\n### Classification Rules\n')
    out.write('- `TIER 1`: root authoritative book/source registry documents and book metadata folders.\n')
    out.write('- `TIER 2`: active supporting architecture, audit, evidence, implementation docs, and book chapter sources.\n')
    out.write('- `TIER 3`: historical archives, legacy audit logs, and documents not marked as active sources.\n')
    out.write('- `TIER 4`: obsolete duplicates, generated build assets, cache files, scraped data artifacts, and raw external evidence.\n')
    out.write('\n### Sample Classifications\n')
    for tier in ['TIER 1', 'TIER 2', 'TIER 3', 'TIER 4']:
        out.write(f'#### {tier}\n')
        sample = [entry for entry in inventory if entry[3] == tier][:20]
        for path, ext, mtime, t, reason in sample:
            out.write(f'- `{path}` — {reason}\n')
        out.write('\n')
    out.write('## Full Registry\n')
    out.write('| Document Source | File Type | Last Modified | Tier | Justification |\n')
    out.write('|---|---|---|---|---|\n')
    for path, ext, mtime, tier, reason in inventory:
        out.write(f'| `{path}` | {ext} | {mtime} | {tier} | {reason} |\n')
print('WROTE', len(inventory), 'records to doc/book/AUTHORITATIVE_SOURCE_REGISTRY_PHASE2.md')
print('COUNTS', counts)
