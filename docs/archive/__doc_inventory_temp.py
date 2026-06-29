import os, datetime, fnmatch
root = os.path.abspath('.')
patterns = ['*.md', '*.txt', '*.pdf', '*.docx', '*.svg', '*.png', '*.jpg', '*.jpeg', '*.drawio']
ignore_dirs = {'__pycache__', '.git', 'node_modules', 'venv', 'env', '.idea', 'archive', 'data/scraping', 'data/relationship', 'aast-ai-agent-main/frontend/college-decision-system-backend', 'aast-ai-agent-main/frontend/aast-ai-agent-main'}
files = []
for dirpath, dirnames, filenames in os.walk(root):
    rel = os.path.relpath(dirpath, root)
    if rel != '.' and any(part in ignore_dirs for part in rel.split(os.sep)):
        continue
    for pat in patterns:
        for name in fnmatch.filter(filenames, pat):
            path = os.path.join(dirpath, name)
            stat = os.stat(path)
            files.append((os.path.relpath(path, root).replace('\\', '/'), pat, datetime.datetime.fromtimestamp(stat.st_mtime).isoformat()))
files.sort(key=lambda x: x[0].lower())
with open('document_inventory.tsv', 'w', encoding='utf-8') as f:
    for path, pat, mt in files:
        f.write(f'{path}\t{pat}\t{mt}\n')
print('WROTE', len(files), 'RECORDS')
