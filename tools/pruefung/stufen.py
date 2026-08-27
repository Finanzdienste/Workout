"""Lässt sich der Bodyweight-Fehler senken, ohne die Ausgewogenheit aufzugeben?

Idee: gleich ausgewogene Lösungen als gleichwertig behandeln (Stufen) und
innerhalb einer Stufe die nehmen, die den Bodyweight-Modus besser trifft.
"""
import importlib.util, json, pathlib, random, statistics, sys

sys.argv = ['build-plan.py', 'standard']
spec = importlib.util.spec_from_file_location('bp', str(pathlib.Path(__file__).resolve().parent.parent / 'build-plan.py'))
bp = importlib.util.module_from_spec(spec); spec.loader.exec_module(bp)
meta = json.loads(bp.META.read_text(encoding='utf-8'))
shares = {k: v['dbShares'] for k, v in meta.items()}
bp.BW_SHARES.update({k: v['bwShares'] for k, v in meta.items()})
ids = list(shares); groups = sorted({m for sh in shares.values() for m in sh})
weeks, rnd = 21, random.Random(12345)
values = [0] + [v for v in range(bp.PER_EX_WEEK[0]*weeks, bp.PER_EX_WEEK[1]*weeks+1) if v % bp.GRAIN == 0]

def balance(sol):
    mean = sum(sol.values()) / len(sol)
    return (min(sol.values()) == 0, sum((v-mean)**2 for v in sol.values()), sorted(sol.items()))

for nr, block in enumerate(bp.parts(ids, shares, groups), 1):
    found = bp.exact(block, shares, weeks, values, bp.EXACT_LIMIT, rnd)
    if not found: continue
    streu = sorted(balance(s)[1] for s in found)
    print(f'\nBlock {nr} ({len(block)} Übungen, {len(found)} Lösungen)')
    print(f'  Streuung der Ausgewogenheit: {streu[0]:.0f} … {streu[len(streu)//2]:.0f} … {streu[-1]:.0f}')
    ohne = sorted(found, key=balance)[:bp.SCREEN]
    print(f'  bisher: bw {min(bp.bw_fehler(s,weeks) for s in ohne):.3f}'
          f'–{max(bp.bw_fehler(s,weeks) for s in ohne):.3f}, '
          f'Ausgewogenheit {balance(ohne[0])[1]:.0f}–{balance(ohne[-1])[1]:.0f}')
    for stufe in (50, 200, 500, 1000, 2000):
        srt = sorted(found, key=lambda s: (balance(s)[0], round(balance(s)[1]/stufe),
                                           bp.bw_fehler(s, weeks), balance(s)[1]))[:bp.SCREEN]
        bw = [bp.bw_fehler(s, weeks) for s in srt]
        bal = [balance(s)[1] for s in srt]
        print(f'  Stufe {stufe:>5}: bw {min(bw):.3f}–{max(bw):.3f}, '
              f'Ausgewogenheit {min(bal):.0f}–{max(bal):.0f}')
