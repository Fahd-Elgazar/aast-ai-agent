import collections, os
inventory_path = 'document_inventory.tsv'
with open(inventory_path, encoding='utf-8') as f:
    rows = [line.strip().split('\t') for line in f if line.strip()]
files = [{'path': r[0], 'ext': r[1], 'mtime': r[2]} for r in rows]
per_ext = collections.Counter(f['ext'] for f in files)
per_dir = collections.Counter(os.path.dirname(f['path']) for f in files)
by_basename = collections.defaultdict(list)
for f in files:
    basename = os.path.basename(f['path'])
    by_basename[basename].append(f)
same_basename = {bn: lst for bn, lst in by_basename.items() if len(lst) > 1}
report_patterns = ['report', 'audit', 'discovery', 'inventory', 'map', 'schema', 'documentation', 'technical', 'analysis', 'docs']
report_files = [f for f in files if any(p in os.path.basename(f['path']).lower() for p in report_patterns)]
print('TOTAL_FILES', len(files))
print('EXT_COUNTS')
for ext, count in per_ext.most_common():
    print(ext, count)
print('TOP_DIRS')
for dirpath, count in per_dir.most_common(20):
    print(count, dirpath)
print('DUPLICATE_BASENAMES', len(same_basename))
for bn, lst in list(same_basename.items())[:40]:
    print('DUPE', bn, 'COUNT', len(lst))
    for p in lst:
        print('  ', p)
print('REPORT_FILE_COUNT', len(report_files))
for f in report_files[:40]:
    print('RPT', f['path'])
