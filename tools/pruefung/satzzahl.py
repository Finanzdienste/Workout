"""Wie viele Sätze je Auftritt gehen überhaupt auf – und was wird daraus?

Geprüft wird nur der schnelle Teil (die Gleichungen). Das Verteilen auf Wochen
und Tage dauert eine halbe Stunde je Variante; es lohnt erst, wenn feststeht,
dass es überhaupt eine exakte Lösung gibt.
"""
import importlib.util, json, pathlib, random, sys

sys.argv = ['build-plan.py', 'standard']
spec = importlib.util.spec_from_file_location('bp', str(pathlib.Path(__file__).resolve().parent.parent / 'build-plan.py'))
bp = importlib.util.module_from_spec(spec); spec.loader.exec_module(bp)
meta = json.loads(bp.META.read_text(encoding='utf-8'))
shares = {k: v['dbShares'] for k, v in meta.items()}
bp.BW_SHARES.update({k: v['bwShares'] for k, v in meta.items()})
ids = list(shares)
groups = sorted({m for sh in shares.values() for m in sh})

def geht(ziele, grain, wochen=range(21, 41)):
    bp.TARGET.clear(); bp.TARGET.update(ziele)
    bp.GOAL.clear()
    bp.GOAL.update({m: (None if t is None else t * bp.UNIT) for m, t in ziele.items()})
    for w in wochen:
        rnd = random.Random(7)
        werte = [0] + [v for v in range(bp.PER_EX_WEEK[0]*w, bp.PER_EX_WEEK[1]*w+1) if v % grain == 0]
        if all(bp.exact(b, shares, w, werte, 200, rnd) for b in bp.parts(ids, shares, groups)):
            return w
    return None

for name in ('standard', 'cut', 'bbp', 'oberkoerper'):
    ziele = bp.VARIANTEN[name]['ziele']
    bp.CAP = bp.VARIANTEN[name]['cap']
    bp.CAP_U = bp.CAP * bp.UNIT
    zeile = f'{name:<13}'
    for grain in (3, 4, 5, 6):
        w = geht(dict(ziele), grain)
        # Einheiten je Woche = 4; Übungen je Einheit ~ Wochensätze / (4 · Sätze je Auftritt)
        gesamt = sum(t for t in ziele.values() if t)   # grobe Näherung
        zeile += f'  {grain}er: ' + (f'{w} Wo.' if w else '  –   ')
    print(zeile)
