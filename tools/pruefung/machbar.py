"""Geht ein Zielsatz überhaupt exakt auf? Nur die Gleichungen, nicht die Verteilung.

Der volle Lauf braucht eine halbe Stunde, davon entfällt fast alles auf das
Verteilen auf Wochen und Tage. Ob es überhaupt eine exakte Lösung gibt, steht
schon nach Sekunden fest – und genau daran scheitert eine Zielkombination.
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

def probiere(ziele, wochen=range(21, 33)):
    bp.TARGET.clear(); bp.TARGET.update(ziele)
    bp.GOAL.clear()
    bp.GOAL.update({m: (None if t is None else t * bp.UNIT) for m, t in ziele.items()})
    for w in wochen:
        rnd = random.Random(7)
        werte = [0] + [v for v in range(bp.PER_EX_WEEK[0]*w, bp.PER_EX_WEEK[1]*w+1) if v % bp.GRAIN == 0]
        ok = True
        for block in bp.parts(ids, shares, groups):
            if not bp.exact(block, shares, w, werte, 200, rnd):
                ok = False
                break
        if ok:
            return w
    return None

BASIS = {
    'chest': 7, 'lats': 7, 'sideDelts': 7, 'rearDelts': 7,
    'biceps': 7, 'triceps': 7, 'abs': 9,
    'frontDelts': None, 'traps': None,
    'glutes': 7, 'quads': 6, 'hamstringsHip': 5, 'hamstringsKnee': 3, 'calves': 6,
}
kandidaten = [
    ('wie eingetragen (hHip 5)', dict(BASIS)),
    ('hHip 6', {**BASIS, 'hamstringsHip': 6}),
    ('hHip 4', {**BASIS, 'hamstringsHip': 4}),
    ('hHip abgeleitet', {**BASIS, 'hamstringsHip': None}),
    ('hHip 5, glutes 8', {**BASIS, 'glutes': 8}),
    ('hHip 5, abs 8', {**BASIS, 'abs': 8}),
    ('hHip 5, rearDelts 6', {**BASIS, 'rearDelts': 6}),
    ('hHip 6, glutes 8', {**BASIS, 'hamstringsHip': 6, 'glutes': 8}),
]
for name, z in kandidaten:
    w = probiere(z)
    print(f'{name:<28} {"geht ab " + str(w) + " Wochen" if w else "KEINE exakte Lösung"}')
