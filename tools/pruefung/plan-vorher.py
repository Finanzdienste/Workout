#!/usr/bin/env python3
"""
Wer einen Plan neu einspielt, legt den ausgelieferten nach tools/plan-vorher/.

Ändert sich der Fingerabdruck eines Plans (`stand`, siehe lies_plan() in
tools/build-data.py), schreibt die App beim nächsten Laden jede angefangene
Einheit fest (planWechsel() in js/app.js). Ganz geht das nur mit dem Plan
davor – aus dem Protokoll allein kannte sie am 29.09. von einer angefangenen
Cut-Einheit nur das erste Paar:

    „Heute nur zwei Übungen?"

Seit v216 bettet tools/build-data.py deshalb die ausgelieferten Pläne aus
tools/plan-vorher/ ein ('standard' für tools/plan.json). Dass der Plan beim
nächsten neuen auch dort liegt, stand nur im README, und niemand prüfte es.
Eine veraltete Datei hilft dabei so wenig wie keine: Die App nimmt einen
früheren Plan nur, wenn sein Stand genau der ist, von dem der Wechsel kommt –
also der ausgelieferte.

Bis zum 03.10. war das eine Datei je Variante, und jeder neue Plan
überschrieb den vorigen. Wer eine Fassung übersprungen hatte, lief unter einem
Stand, den die App nicht mehr kannte – beim Cut e06a62 stand eine angefangene
Einheit danach wieder mit dem ersten Paar da. Jetzt ist es eine Kette:
tools/plan-vorher/<variante>/<stand>.json, je ausgeliefertem Stand eine Datei,
und das Tor prüft dreierlei:

    - Hat ein Plan einen neuen Stand, liegt der ausgelieferte in der Kette.
    - Was im Vergleichsstand in der Kette lag, liegt dort noch – sie wird nur
      länger (auch gegen die eine Datei von früher verglichen).
    - Jede Datei heißt wie ihr Stand.

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


def ablage_in(basis):
    """Variante → {Stand: Pfad} – was im Vergleichsstand in tools/plan-vorher/ lag.

    Beide Formen: die Kette (<variante>/<stand>.json) und die eine Datei je
    Variante (<variante>.json), wie sie bis zur Kette dort lag. Der
    Vergleichsstand kann noch aus dieser Zeit sein.
    """
    alle = {}
    r = git('ls-tree', '-r', '--name-only', basis, '--', 'tools/plan-vorher/', check=False)
    for pfad in r.stdout.split():
        teile = pathlib.PurePosixPath(pfad).parts[2:]
        if not pfad.endswith('.json') or not 1 <= len(teile) <= 2:
            continue
        variante = teile[0] if len(teile) == 2 else teile[0][:-len('.json')]
        alle.setdefault(variante, {})[stand(git('show', f'{basis}:{pfad}').stdout)] = pfad
    return alle


def kette(variante):
    """(Stand, Datei) je Glied der Kette einer Variante, wie sie jetzt daliegt."""
    ordner = ROOT / 'tools' / 'plan-vorher' / variante
    if not ordner.is_dir():
        return []
    return [(stand(p.read_text(encoding='utf-8')), p) for p in sorted(ordner.glob('*.json'))]


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
    gut, fehlt, falsch, weg = [], [], [], []
    lag = ablage_in(basis)
    for variante, pfad in plaene().items():
        glieder = kette(variante)
        jetzt = {s for s, _ in glieder}
        # Eine Datei unter fremdem Namen: tools/build-data.py hielte an, aber
        # erst beim Bauen, und hier steht dazu, wie sie heißen muss.
        falsch += [(p, s) for s, p in glieder if p.stem != s]
        # Die Kette wird nur länger. Jeder Stand darin war auf einem Handy, und
        # wer ihn zuletzt hatte, braucht ihn beim nächsten Öffnen – auch nach
        # drei übersprungenen Fassungen. So ist am 03.10. der Cut e06a62
        # verschwunden: Der neue Plan davor überschrieb ihn.
        weg += [(variante, s, p) for s, p in sorted(lag.get(variante, {}).items()) if s not in jetzt]
        alt = git('show', f'{basis}:{pfad}', check=False)
        if alt.returncode:
            continue   # neue Variante: ausgeliefert war noch keine
        war, ist = stand(alt.stdout), stand((ROOT / pfad).read_text(encoding='utf-8'))
        if war == ist:
            continue
        if war in jetzt:
            gut.append(f'{variante} {war} → {ist}')
        else:
            fehlt.append((pfad, variante, war, ist))
    if falsch:
        print('✗ Plan davor: Datei und Stand passen nicht zusammen – der Dateiname ist der Stand:')
        for p, s in falsch:
            print(f'    {p.relative_to(ROOT)} hat den Stand {s}')
    if weg:
        print(f'✗ Plan davor: Aus der Kette in tools/plan-vorher/ fehlt, was dort schon lag (gegen {name}).')
        print('  Wer zuletzt unter diesem Stand trainiert hat, bekommt eine angefangene Einheit sonst wieder '
              'nur aus dem Protokoll festgeschrieben. Zurückholen:')
        for variante, s, p in weg:
            print(f'    mkdir -p tools/plan-vorher/{variante}')
            print(f'    git show {basis}:{p} > tools/plan-vorher/{variante}/{s}.json')
    if fehlt:
        print(f'✗ Plan davor: neuer Stand, aber der ausgelieferte Plan liegt nicht in '
              f'tools/plan-vorher/ (gegen {name}).')
        for pfad, variante, war, ist in fehlt:
            print(f'    {pfad}: {war} → {ist}; tools/plan-vorher/{variante}/{war}.json fehlt')
        print('  Ohne ihn schreibt die App eine angefangene Einheit nur aus dem Protokoll fest – '
              'am 29.09. waren das zwei von vier Übungen. Den ausgelieferten dazulegen und neu bauen:')
        for pfad, variante, war, _ in fehlt:
            print(f'    mkdir -p tools/plan-vorher/{variante}')
            print(f'    git show {basis}:{pfad} > tools/plan-vorher/{variante}/{war}.json')
    if weg or fehlt:
        print('    python3 tools/build-data.py && python3 tools/build-single.py')
    if falsch or weg or fehlt:
        return 1
    if not gut:
        print(f'✓ Plan davor: kein Plan mit neuem Stand (gegen {name})')
        return 0
    print(f'✓ Plan davor: {", ".join(gut)} – der ausgelieferte liegt in tools/plan-vorher/ '
          f'(gegen {name})')
    return 0


if __name__ == '__main__':
    sys.exit(main())
