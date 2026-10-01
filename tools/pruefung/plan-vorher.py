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

Verglichen wird deshalb mit einem Stand, der schon ausgeliefert ist:

    python3 tools/pruefung/plan-vorher.py                # gegen origin/main
    python3 tools/pruefung/plan-vorher.py <commit>       # gegen diesen
    python3 tools/pruefung/plan-vorher.py --ci           # in GitHub Actions

Lokal zählt auch, was noch nicht committet ist. Gibt es den Vergleichsstand
nicht (flacher Klon, oder 000… als Stand vor dem allerersten Push nach main),
wird nichts geprüft und das gesagt. Eine
Variante, die es dort noch nicht gab, hat keinen Plan davor. Verglichen wird
der Fingerabdruck, nicht die Datei: Verschobene Termine ändern nichts an dem,
was hinter einer Nummer steht, und verlangen nichts.

In CI ist der Vergleichsstand nicht einfach der vor dem Push, anders als bei
der Versionspflicht. Ausgeliefert wird nur main (GitHub Pages), und auf einem
Zweig ist der Stand vor dem zweiten Push einer, den nie jemand hatte. Gegen
ihn verlangte das Tor genau diesen Zwischenstand als Plan davor – und wer der
Meldung folgte, scheiterte danach am Pull-Request gegen main, weil keine
Ablage beide Prüfungen erfüllt. Mit --ci nimmt es deshalb den ausgelieferten:

    pull_request           die Basis des Pull-Requests (base.sha)
    Push nach main         den Stand vor dem Push (before)
    Push auf einen Zweig   den Abzweig von main (git merge-base origin/main HEAD)

Lokal bleibt es bei origin/main. Wer auf einem Zweig sitzt, der hinter
origin/main liegt, gibt den Abzweig selbst an:
`python3 tools/pruefung/plan-vorher.py $(git merge-base origin/main HEAD)`.
"""
import hashlib
import json
import os
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
# Der Zweig, den GitHub Pages ausliefert – nur was dort lag, hatte jemand auf
# dem Handy.
AUSGELIEFERT = 'main'


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


def basis_in_ci():
    """Der ausgelieferte Stand für diesen Lauf in GitHub Actions, und woher."""
    ereignis = os.environ.get('GITHUB_EVENT_NAME', '')
    daten = {}
    if os.environ.get('GITHUB_EVENT_PATH'):
        with open(os.environ['GITHUB_EVENT_PATH'], encoding='utf-8') as f:
            daten = json.load(f)
    if ereignis.startswith('pull_request'):
        # Nicht before: Bei „synchronize" ist das der vorige Kopf des Zweigs.
        return ((daten.get('pull_request') or {}).get('base') or {}).get('sha', ''), \
            'Basis des Pull-Requests'
    if os.environ.get('GITHUB_REF') == f'refs/heads/{AUSGELIEFERT}':
        return daten.get('before') or '', f'Stand vor dem Push nach {AUSGELIEFERT}'
    # Ein anderer Zweig als main – auch ein Lauf von Hand dort: Ausgeliefert
    # war, wovon er abzweigt. Ein Lauf von Hand auf main landet oben.
    # Braucht die ganze Geschichte und origin/main – fetch-depth: 0.
    r = git('merge-base', f'origin/{AUSGELIEFERT}', 'HEAD', check=False)
    return r.stdout.strip(), f'Abzweig von origin/{AUSGELIEFERT}'


def main():
    if sys.argv[1:] == ['--ci']:
        basis, woher = basis_in_ci()
        name = f'{basis[:12] or "–"}, {woher}'
    else:
        basis = sys.argv[1] if len(sys.argv) > 1 else 'origin/main'
        name = basis
    da = basis and not re.fullmatch(r'0+', basis) and git(
        'rev-parse', '--verify', '--quiet', basis + '^{commit}', check=False).returncode == 0
    if not da:
        print(f'– Plan davor: kein Vergleichsstand ({name}), nichts geprüft')
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
              f'tools/plan-vorher/ (gegen {name}).')
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
        print(f'✓ Plan davor: kein Plan mit neuem Stand (gegen {name})')
        return 0
    print(f'✓ Plan davor: {", ".join(gut)} – der ausgelieferte liegt in tools/plan-vorher/ '
          f'(gegen {name})')
    return 0


if __name__ == '__main__':
    sys.exit(main())
