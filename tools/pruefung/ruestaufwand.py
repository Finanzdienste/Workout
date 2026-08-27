#!/usr/bin/env python3
"""Wie oft wird je Einheit auf- und umgebaut?

Gemessen an derselben Reihenfolge, die die App zeigt (ruestOrder inklusive der
Stufen-Regel), und mit derselben Zählung wie ruestHint(): Gerätewechsel ist ein
Aufbau, gleiches Gerät mit anderem Gewicht ein Umbau, gleiches Gerät mit
gleichem Gewicht kostet nichts.

    python3 ruestaufwand.py <planfile> [<planfile> ...]
"""
import json
import pathlib
import re
import statistics
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
EX = {e['id']: e for e in json.loads(
    re.search(r'export const EXERCISES = (\[.*?\n\]);', (ROOT / 'js/data.js').read_text(), re.S).group(1))}
FAM = {'barbell': 'lh', 'hipbar': 'lh', 'dumbbells': 'kh2',
       'goblet': 'kh1', 'onehand': 'kh1', 'plate': 'kh1', 'backpack': 'ruck'}


def setup(i):
    e = EX.get(i)
    if not e or e.get('equip') not in FAM or not e.get('weight'):
        return None
    return (FAM[e['equip']], e['weight'])


def direkt(i):
    return {m for m, v in EX[i]['db']['shares'].items() if v >= 0.5}


def tier(i):
    return EX[i].get('tier', 1)


def vorgezogen(l):
    for a in range(len(l)):
        for b in range(a + 1, len(l)):
            if tier(l[a]) > tier(l[b]) and direkt(l[a]) & direkt(l[b]):
                return (a, b)
    return None


def bauen(items, geladen, fest):
    platz = {}
    key = lambda g: (f'#{g[2]}' if g[2] in fest else g[1][0])
    for g in geladen:
        platz.setdefault(key(g), g[2])
    srt = sorted(geladen, key=lambda g: (platz[key(g)], -g[1][1], g[2]))
    out = list(items)
    for k, g in enumerate(geladen):
        out[g[2]] = srt[k][0]
    return out


def sortiere(items):
    """Die Reihenfolge der App: Geräte gruppiert, aber keine Isolation vorn."""
    geladen = [(x, setup(x), i) for i, x in enumerate(items) if setup(x)]
    if len(geladen) < 3:
        return list(items)
    fest = set()
    out = bauen(items, geladen, fest)
    for _ in range(len(geladen)):
        v = vorgezogen(out)
        if not v:
            break
        schwer = next((x for x in geladen if x[0] == out[v[1]]), None)
        kand = [out[v[0]], out[schwer[2]] if schwer else None, out[v[1]]]
        g = None
        for k in kand:
            g = next((x for x in geladen if x[0] == k and x[2] not in fest), None) if k else None
            if g:
                break
        if not g:
            break
        fest.add(g[2])
        out = bauen(items, geladen, fest)
    return out


def ruesten(items):
    vorher, auf, um, kg = None, 0, 0, 0
    for x in items:
        s = setup(x)
        if not s:
            continue
        if vorher is None or vorher[0] != s[0]:
            auf += 1
            kg += s[1]
        elif abs(vorher[1] - s[1]) > 0.01:
            um += 1
            kg += abs(s[1] - vorher[1])
        vorher = s
    return auf, um, kg


def miss(plan, faktor=1.0):
    ue, saetze, aufs, ums, kgs = [], [], [], [], []
    for e in plan:
        ids = sortiere([it['id'] for it in e['ex']])
        a, u, k = ruesten(ids)
        ue.append(len(ids))
        saetze.append(sum(max(1, round(it['sets'] * faktor)) for it in e['ex']))
        aufs.append(a)
        ums.append(u)
        kgs.append(k)
    return {
        'einheiten': len(plan),
        'ue': statistics.mean(ue), 'ue_min': min(ue), 'ue_max': max(ue),
        'saetze': statistics.mean(saetze),
        'ruest': statistics.mean([a + u for a, u in zip(aufs, ums)]),
        'kg': statistics.mean(kgs),
    }


def lies(quelle):
    if ':' in quelle:
        rev, pfad = quelle.split(':', 1)
        roh = subprocess.run(['git', 'show', f'{rev}:{pfad}'], cwd=ROOT,
                             capture_output=True, text=True).stdout
        return json.loads(roh)['plan']
    return json.load(open(ROOT / quelle))['plan']


print(f'{"Plan":<34}{"Einh.":>6}{"Übungen":>9}{"(min–max)":>11}{"Sätze":>7}{"Rüsten":>8}{"kg":>7}')
for q in sys.argv[1:]:
    m = miss(lies(q))
    spanne = f'{m["ue_min"]}-{m["ue_max"]}'
    print(f'{q:<34}{m["einheiten"]:>6}{m["ue"]:>9.2f}{spanne:>11}'
          f'{m["saetze"]:>7.1f}{m["ruest"]:>8.2f}{m["kg"]:>7.0f}')
