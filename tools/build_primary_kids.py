"""Refresh Primary children (FIRST NAMES ONLY) in data/primary-classes.json from an LCR Attendance Rolls text export.
Usage: python3 tools/build_primary_kids.py /workspace/callings/lcr_primary_classes.txt
Go-by names live in data/primary-classes.json "overrides" (key = LCR "Last, First Middle", value = first name to show)."""
import json, sys
SRC = sys.argv[1]; DATA = 'data/primary-classes.json'
TAB = {'Nursery': 'nursery', 'Sunbeam': 'sunbeam-ctr-4', 'CTR 4': 'sunbeam-ctr-4', 'CTR 5': 'ctr-5', 'CTR 6': 'ctr-6',
       'Valiant 7': 'valiant-7', 'Valiant 8': 'valiant-8', 'Valiant 9': 'valiant-9', 'Valiant 10': 'valiant-10'}
BLOCK = ('justin huff', 'cody sorenson')
d = json.load(open(DATA)); ov = d.setdefault('overrides', {})
kids = {}
for line in open(SRC):
    if line.startswith('#') or ':' not in line: continue
    cls, names = line.split(':', 1); tab = TAB[cls.strip()]
    for full in filter(None, (n.strip() for n in names.split(';'))):
        assert not any(b in full.lower() for b in BLOCK), full
        first = ov.get(full) or full.split(',', 1)[1].split()[0]
        kids.setdefault(tab, []).append(first)
for c in d['classes']:
    if c['id'] in kids: c['children'] = sorted(kids[c['id']], reverse=True)
json.dump(d, open(DATA, 'w'), indent=2, ensure_ascii=False); open(DATA, 'a').write('\n')
for c in d['classes']: print(c['id'], len(c.get('children') or []))
