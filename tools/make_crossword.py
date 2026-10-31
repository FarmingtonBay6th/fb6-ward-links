#!/usr/bin/env python3
"""Build a weekly Sunday Crossword from a word/clue list.

  python3 tools/make_crossword.py data/crossword/source/2026-11-01.json [--trials 4000] [--seed 1]

Input: {"date","title","subtitle","size","entries":[[ANSWER, clue], ...]}
Output: data/crossword/<date>.json (grid + numbered clues) and data/crossword/index.json (latest).
Every run is verified: each across/down run of 2+ letters must be exactly one listed answer,
numbering follows standard crossword rules, and the grid is fully connected.
"""
import json, random, re, sys, os, argparse
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def place_all(words, N, rnd, core=()):
    g = {}; placed = []
    def ok(w, r, c, d):
        dr, dc = (0, 1) if d == 'A' else (1, 0)
        er, ec = r + dr*(len(w)-1), c + dc*(len(w)-1)
        if min(r, c) < 0 or er >= N or ec >= N: return -1
        if (r-dr, c-dc) in g or (er+dr, ec+dc) in g: return -1
        x = 0
        for i, ch in enumerate(w):
            rr, cc = r+dr*i, c+dc*i
            if (rr, cc) in g:
                if g[(rr, cc)][0] != ch or d in g[(rr, cc)][1]: return -1
                x += 1
            else:
                if (rr+dc, cc+dr) in g or (rr-dc, cc-dr) in g: return -1
        return x
    def put(w, r, c, d, clue):
        dr, dc = (0, 1) if d == 'A' else (1, 0)
        for i, ch in enumerate(w):
            k = (r+dr*i, c+dc*i); g.setdefault(k, [ch, set()])[1].add(d)
        placed.append((w, r, c, d, clue))
    ws = sorted(words, key=lambda e: -len(e[0]) - (8 if e[0] in core else 0) + rnd.random()*3)
    first = ws[0]; put(first[0], N//2, (N-len(first[0]))//2, 'A', first[1])
    rest = ws[1:]
    while rest:
        cands = []
        for wi, (w, clue) in enumerate(rest):
            for (r, c), (ch, _) in list(g.items()):
                for i, wc in enumerate(w):
                    if wc != ch: continue
                    for d in 'AD':
                        rr, cc = (r, c-i) if d == 'A' else (r-i, c)
                        x = ok(w, rr, cc, d)
                        if x > 0: cands.append((x*10 + len(w) + (12 if w in core else 0) + rnd.random()*6, wi, rr, cc, d))
        if not cands: break
        _, wi, rr, cc, d = max(cands)
        w, clue = rest.pop(wi); put(w, rr, cc, d, clue)
    return placed, g

def number(placed, N):
    cells = {}
    for w, r, c, d, _ in placed:
        for i, ch in enumerate(w):
            cells[(r+(i if d=='D' else 0), c+(i if d=='A' else 0))] = ch
    grid = [[cells.get((r, c), '#') for c in range(N)] for r in range(N)]
    nums, n, runs = {}, 0, []
    for r in range(N):
        for c in range(N):
            if grid[r][c] == '#': continue
            sa = (c == 0 or grid[r][c-1] == '#') and c+1 < N and grid[r][c+1] != '#'
            sd = (r == 0 or grid[r-1][c] == '#') and r+1 < N and grid[r+1][c] != '#'
            if sa or sd:
                n += 1; nums[(r, c)] = n
                for d, s in (('A', sa), ('D', sd)):
                    if not s: continue
                    w = ''; rr, cc = r, c
                    while rr < N and cc < N and grid[rr][cc] != '#':
                        w += grid[rr][cc]; rr, cc = (rr, cc+1) if d == 'A' else (rr+1, cc)
                    runs.append((n, d, r, c, w))
    return grid, nums, runs

def verify(placed, grid, runs, N):
    byword = {(w, r, c, d): clue for w, r, c, d, clue in placed}
    assert len(runs) == len(placed), f'{len(runs)} runs vs {len(placed)} answers'
    for n, d, r, c, w in runs:
        assert (w, r, c, d) in byword, f'unlisted run {n}{d} {w}'
    letters = {(r, c) for r in range(N) for c in range(N) if grid[r][c] != '#'}
    seen, st = set(), [next(iter(letters))]
    while st:
        p = st.pop()
        if p in seen or p not in letters: continue
        seen.add(p); r, c = p; st += [(r+1, c), (r-1, c), (r, c+1), (r, c-1)]
    assert seen == letters, 'grid not connected'

def crop(placed, N):
    rs = [r + (len(w)-1 if d == 'D' else 0) for w, r, c, d, _ in placed] + [r for w, r, c, d, _ in placed]
    cs = [c + (len(w)-1 if d == 'A' else 0) for w, r, c, d, _ in placed] + [c for w, r, c, d, _ in placed]
    r0, c0 = min(rs), min(cs)
    return [(w, r-r0, c-c0, d, cl) for w, r, c, d, cl in placed], max(max(rs)-r0, max(cs)-c0)+1

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('src'); ap.add_argument('--trials', type=int, default=400); ap.add_argument('--seed', type=int, default=1)
    a = ap.parse_args(); S = json.load(open(a.src)); N = S.get('size', 13)
    words = [(re.sub('[^A-Z]', '', e[0].upper()), e[1]) for e in S['entries']]
    core = {re.sub('[^A-Z]', '', e[0].upper()) for e in S['entries'] if len(e) > 2 and e[2]}
    assert len({w for w, _ in words}) == len(words), 'duplicate answer'
    rnd = random.Random(a.seed); best = None
    for _ in range(a.trials):
        placed, g = place_all(words, N, rnd, core)
        x = sum(1 for v in g.values() if len(v[1]) == 2)
        score = (sum(p[0] in core for p in placed), len(placed), x)
        if not best or score > best[0]: best = (score, placed)
    placed, M = crop(best[1], N)
    grid, nums, runs = number(placed, M)
    verify(placed, grid, runs, M)
    clue = {(w, r, c, d): cl for w, r, c, d, cl in placed}
    out = {k: S[k] for k in ('date', 'title', 'subtitle')}
    out.update(rows=M, cols=M, grid=[''.join(row) for row in grid],
               across=[{'n': n, 'row': r, 'col': c, 'answer': w, 'clue': clue[(w, r, c, 'A')]} for n, d, r, c, w in runs if d == 'A'],
               down=[{'n': n, 'row': r, 'col': c, 'answer': w, 'clue': clue[(w, r, c, 'D')]} for n, d, r, c, w in runs if d == 'D'])
    left = [w for w, _ in words if w not in {p[0] for p in placed}]
    os.makedirs(f'{R}/data/crossword', exist_ok=True)
    json.dump(out, open(f'{R}/data/crossword/{S["date"]}.json', 'w'), ensure_ascii=False, indent=1)
    json.dump({'latest': S['date']}, open(f'{R}/data/crossword/index.json', 'w'))
    print(f'{M}x{M}, {len(placed)}/{len(words)} answers, {best[0][2]} crossings, {best[0][0]}/{len(core)} core; verified OK')
    if left: print('not placed:', ', '.join(left))
    print('\n'.join(out['grid']))
main()
