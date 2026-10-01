#!/usr/bin/env python3
"""
Wer einen Plan neu einspielt, legt den ausgelieferten nach tools/plan-vorher/.

Ändert sich der Fingerabdruck eines Plans (`stand`, siehe lies_plan() in
tools/build-data.py), schreibt die App beim nächsten Laden jede angefangene
Einheit fest (planWechsel() in js/app.js). Ganz geht das nur mit dem Plan
davor – aus dem Protokoll allein kannte sie am 29.09. von einer angefangenen
Cut-Einheit nur das erste Paar:

    „Heute nur zwei Übungen?"

Seit v216 bettet tools/build-data.py deshalb tools/plan-vorher/<variante>.json
ein ('standard' für tools/plan.json). Dass die Datei beim nächsten neuen Plan
auch dort liegt, stand nur im README, und niemand prüfte es. Eine veraltete
hilft dabei so wenig wie keine: Die App nimmt den Plan davor nur, wenn sein
Stand genau der ist, von dem der Wechsel kommt – also der ausgelieferte.

Verglichen wird deshalb wie bei der Versionspflicht mit einem Stand, der schon
ausgeliefert ist:

    python3 tools/pruefung/plan-vorher.py                # gegen origin/main
    python3 tools/pruefung/plan-vorher.py <commit>       # gegen diesen

Lokal zählt auch, was noch nicht committet ist. Gibt es den Vergleichsstand
nicht (flacher Klon, erster Push), wird nichts geprüft und das gesagt. Eine
Variante, die es dort noch nicht gab, hat keinen Plan davor. Verglichen wird
der Fingerabdruck, nicht die Datei: Verschobene Termine ändern nichts an dem,
was hinter einer Nummer steht, und verlangen nichts.
"""
import hashlib
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent


def git(*args, check=True):
    r = subprocess.run(['git', *args], capture_output=True, text=True, cwd=ROOT)
    if check and r.returncode:
        raise RuntimeError(r.stderr.strip())
    return r


def stand(text):
    # Genau der aus lies_plan() in tools/build-data.py – die Nummer entsteht
    # dort aus der Reihenfolge, Termine gehen nicht ein. Rechnete das Tor
    # anders, verglich es etwas, das die App nie vergleicht.
    roh = json.loads(text)
    inhalt = ';'.join(f'{n}:' + ','.join(i['id'] for i in o['ex'])
                      for n, o in enumerate(roh['plan'], 1))
    return hashlib.sha256(inhalt.encode()).hexdigest()[:12]


def plaene():
    """Variante → Plandatei, wie tools/build-data.py sie findet."""
    alle = {'standard': 'tools/plan.json'}
    for pfad in sorted((ROOT / 'tools').glob('plan-*.json')):
        alle[pfad.stem[len('plan-'):]] = f'tools/{pfad.name}'
    return {v: p for v, p in alle.items() if (ROOT / p).exists()}


def main():
    basis = sys.argv[1] if len(sys.argv) > 1 else 'origin/main'
    da = not re.fullmatch(r'0+', basis) and git(
        'rev-parse', '--verify', '--quiet', basis + '^{commit}', check=False).returncode == 0
    if not da:
        print(f'– Plan davor: kein Vergleichsstand ({basis}), nichts geprüft')
        return 0
    gut, fehlt = [], []
    for variante, pfad in plaene().items():
        alt = git('show', f'{basis}:{pfad}', check=False)
        if alt.returncode:
            continue   # neue Variante: ausgeliefert war noch keine
        war, ist = stand(alt.stdout), stand((ROOT / pfad).read_text(encoding='utf-8'))
        if war == ist:
            continue
        ablage = f'tools/plan-vorher/{variante}.json'
        liegt = (stand((ROOT / ablage).read_text(encoding='utf-8'))
                 if (ROOT / ablage).exists() else None)
        if liegt == war:
            gut.append(f'{variante} {war} → {ist}')
        else:
            fehlt.append((pfad, ablage, war, ist, liegt))
    if fehlt:
        print(f'✗ Plan davor: neuer Stand, aber der ausgelieferte Plan liegt nicht in '
              f'tools/plan-vorher/ (gegen {basis}).')
        for pfad, ablage, war, ist, liegt in fehlt:
            print(f'    {pfad}: {war} → {ist}; {ablage} '
                  + (f'hat {liegt}' if liegt else 'fehlt'))
        print('  Ohne ihn schreibt die App eine angefangene Einheit nur aus dem Protokoll fest – '
              'am 29.09. waren das zwei von vier Übungen. Den ausgelieferten dorthin holen und neu bauen:')
        for pfad, ablage, *_ in fehlt:
            print(f'    git show {basis}:{pfad} > {ablage}')
        print('    python3 tools/build-data.py && python3 tools/build-single.py')
        return 1
    if not gut:
        print(f'✓ Plan davor: kein Plan mit neuem Stand (gegen {basis})')
        return 0
    print(f'✓ Plan davor: {", ".join(gut)} – der ausgelieferte liegt in tools/plan-vorher/')
    return 0


if __name__ == '__main__':
    sys.exit(main())
