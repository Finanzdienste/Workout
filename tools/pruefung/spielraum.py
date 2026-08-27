"""Wie viel Spielraum hat der Bodyweight-Fehler unter den exakten Lösungen?

Nicht raten: die Kandidaten des Generators selbst durchrechnen.
"""
import importlib.util, json, pathlib, random, sys

sys.argv = ['build-plan.py', sys.argv[1] if len(sys.argv) > 1 else 'standard']
spec = importlib.util.spec_from_file_location('bp', str(pathlib.Path(__file__).resolve().parent.parent / 'build-plan.py'))
bp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bp)          # main() läuft nicht, steht hinter __main__

meta = json.loads(bp.META.read_text(encoding='utf-8'))
shares = {k: v['dbShares'] for k, v in meta.items()}
bp.BW_SHARES.update({k: v['bwShares'] for k, v in meta.items()})
ids = list(shares)
groups = sorted({m for sh in shares.values() for m in sh})
weeks = int(sys.argv[2]) if len(sys.argv) > 2 else 21
rnd = random.Random(12345)

values = [0] + [v for v in range(bp.PER_EX_WEEK[0] * weeks, bp.PER_EX_WEEK[1] * weeks + 1)
                if v % bp.GRAIN == 0]
for block in bp.parts(ids, shares, groups):
    found = bp.exact(block, shares, weeks, values, bp.EXACT_LIMIT, rnd)
    if not found:
        print('kein exakter Block'); continue
    def balance(sol):
        mean = sum(sol.values()) / len(sol)
        return (min(sol.values()) == 0, sum((v - mean) ** 2 for v in sol.values()), sorted(sol.items()))
    found.sort(key=balance)
    top = found[:bp.SCREEN]
    fehler = [bp.bw_fehler(s, weeks) for s in top]
    alle = [bp.bw_fehler(s, weeks) for s in found]
    print(f'Block mit {len(block)} Übungen, {len(found)} exakte Lösungen')
    print(f'  bw-Fehler unter den {len(top)} gescreenten: {min(fehler):.3f} – {max(fehler):.3f}'
          f'  (verschiedene Werte: {len(set(fehler))})')
    print(f'  bw-Fehler unter allen {len(alle)}:          {min(alle):.3f} – {max(alle):.3f}')
