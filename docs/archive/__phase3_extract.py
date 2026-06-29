import os
from collections import Counter

PHASE3_OUTPUT = 'doc/book/AUTHORITATIVE_SOURCE_REGISTRY_PHASE3.md'


def classify(path):
    p = path.replace('\\', '/')
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
    if 'last version - copy' in lower or 'last version' in lower and 'data/scraping/step8' in lower:
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

counts = Counter(item[3] for item in inventory)

phase3_sources = [item for item in inventory if item[3] in {'TIER 1', 'TIER 2'}]
review_candidates = [item for item in inventory if item[3] == 'TIER 3' and (
    item[0].startswith('BOOK_') or item[0].startswith('doc/book/07_appendices/') or 'PHASE3_EXECUTION_PLAN.md' in item[0])]
archive_files = [item for item in inventory if item[3] == 'TIER 4']

with open(PHASE3_OUTPUT, 'w', encoding='utf-8') as out:
    out.write('# Phase 3 Authoritative Source Registry\n')
    out.write('## Active source extraction and review candidate registry\n\n')
    out.write('### Summary\n')
    out.write(f'- Total documents processed: {len(inventory)}\n')
    for tier in ['TIER 1', 'TIER 2', 'TIER 3', 'TIER 4']:
        out.write(f'- {tier}: {counts[tier]} files\n')
    out.write(f'- Active Phase 3 source set: {len(phase3_sources)} files\n')
    out.write(f'- Manual review candidates: {len(review_candidates)} files\n')
    out.write(f'- Archive/obsolete candidates: {len(archive_files)} files\n\n')

    out.write('### Phase 3 Extraction Rules\n')
    out.write('- `Active source set`: TIER 1 and TIER 2 documents retained for thesis evidence and implementation validation.\n')
    out.write('- `Manual review candidates`: TIER 3 root-level book reports and Phase 3 plan documents requiring human confirmation.\n')
    out.write('- `Archive/obsolete candidates`: TIER 4 documents not required for current thesis evidence or system validation.\n\n')

    out.write('### Active Phase 3 Source Set (Sample)\n')
    for path, ext, mtime, tier, reason in phase3_sources[:40]:
        out.write(f'- `{path}` | {tier} | {reason}\n')
    out.write('\n')

    out.write('### Manual Review Candidates\n')
    if review_candidates:
        for path, ext, mtime, tier, reason in review_candidates:
            out.write(f'- `{path}` | {tier} | {reason}\n')
    else:
        out.write('- None identified in the current inventory.\n')
    out.write('\n')

    out.write('### Archive / Obsolete Candidates (Sample)\n')
    for path, ext, mtime, tier, reason in archive_files[:20]:
        out.write(f'- `{path}` | {tier} | {reason}\n')
    out.write('\n')

    out.write('## Full Registry\n')
    out.write('| Document Source | File Type | Last Modified | Tier | Justification |\n')
    out.write('|---|---|---|---|---|\n')
    for path, ext, mtime, tier, reason in inventory:
        out.write(f'| `{path}` | {ext} | {mtime} | {tier} | {reason} |\n')

print('WROTE', len(inventory), 'records to', PHASE3_OUTPUT)
print('ACTIVE SOURCES', len(phase3_sources))
print('REVIEW CANDIDATES', len(review_candidates))
print('ARCHIVE CANDIDATES', len(archive_files))
