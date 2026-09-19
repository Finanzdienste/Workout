#!/usr/bin/env python3
"""Verteilt die Übungen so auf die Trainingstage, dass jede Muskelgruppe über
den ganzen Plan im Schnitt exakt ihr Ziel aus TARGET an Sätzen pro Woche
bekommt – und keine über der Obergrenze CAP liegt.

    python3 tools/build-plan.py             # schreibt tools/plan.json
    python3 tools/build-plan.py --report    # nur rechnen und zeigen

Die Ziele sind nicht überall gleich: der Oberkörper steht am Limit, der
Unterkörper hält. Wer das anders gewichten will, ändert TARGET und lässt neu
rechnen; welche Ziele überhaupt zusammen erreichbar sind, sagt der Lauf selbst.
Eine Gruppe darf auch ohne Ziel bleiben (None) – dann ergibt sie sich aus den
übrigen und muss nur unter CAP bleiben.

Eine "Woche" sind hier WEEK aufeinanderfolgende Einheiten.

Warum das überhaupt gerechnet werden muss: die Übungen treffen die
Muskelgruppen nicht sauber getrennt, sondern anteilig. Ein Goblet Squat ist
voll Oberschenkel, gut zur Hälfte Gesäß, ein Drittel Bauch. Wer stur drei Sätze
je Übung verteilt, landet bei manchen Gruppen weit über und bei anderen weit
unter dem Ziel. Also wird die Satzzahl je Übung gesucht statt gesetzt.

**Ob ein Ziel überhaupt exakt erreichbar ist, ist eine Frage der Teilbarkeit.**
Solange Rücken und hintere Schulter dasselbe Ziel hatten und der Rücken nur aus
zwei Übungen kam – Rudern und Chin-ups, beide mit Anteil 1,0 –, musste die Zahl
der Wochen gerade sein. Die hintere Schulter hing an denselben zwei Übungen
plus Reverse Fly:

    hintere Schulter = 1,5·W + 0,2·Rudern + ReverseFly

Für 10·W bräuchte es ReverseFly = 8,5·W − 0,2·Rudern. Bei ungeradem W endet
8,5·W auf ,5, und 0,2·Rudern kann nur auf ,0 ,2 ,4 ,6 oder ,8 enden – das geht
nie auf. Inzwischen ist die Lage eine andere – drei Zugübungen statt zwei, und
mit festen Dreiersätzen bewegt sich alles in Dreierschritten –, aber die Art
der Bedingung bleibt dieselbe. Verlassen sollte man sich auf keine Faustregel:
Was zusammen aufgeht, sagt der Lauf selbst. Er sucht die erste Wochenzahl ab
WEEKS, für die alle Blöcke exakt aufgehen, und meldet für jede Gruppe, ob der
Schnitt getroffen wurde.

Gerechnet wird in drei Schritten:

  1. Plansummen.  Wie viele Sätze bekommt jede Übung über den ganzen Plan?
     Gesucht wird eine Lösung, die jede Zielgleichung exakt trifft und die
     Gruppen ohne Ziel unter CAP lässt – von vielen gefundenen die
     ausgewogenste, damit keine Übung fast verschwindet.
  2. Verteilung auf die Wochen.  Die Summen stehen fest; verschoben werden nur
     einzelne Sätze zwischen Wochen. Der Schnitt bleibt dabei zwangsläufig
     exakt, und gesucht wird die Verteilung, bei der die schlechteste einzelne
     Woche ihrem Ziel am nächsten liegt. Keine Übung weicht dabei um mehr als
     einen Auftritt von ihrem eigenen Wochenschnitt ab – siehe band().
  3. Aufteilung auf die Einheiten.  Jede Übung kommt ein- bis dreimal pro
     Woche vor, je zwei bis drei Sätze; alle Einheiten etwa gleich lang.

Die Anteile sind Schätzungen aus gängiger Trainingslehre, keine Messwerte: 1,0
heißt "dafür ist die Übung da", 0,5 "arbeitet spürbar mit". Wer sie anders
einschätzt, ändert exercise-meta.json und lässt neu rechnen.

Namen, Wiederholungen und die Fassung für unterwegs kommen aus der Excel,
sofern exercise-meta.json nichts Eigenes setzt – hier wird nur bestimmt, welche
Übung mit wie vielen Sätzen an welchem Tag steht.
"""

import collections
import datetime
import itertools
import json
import math
import pathlib
import os
import random
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
META = ROOT / 'tools' / 'exercise-meta.json'
DATA = ROOT / 'js' / 'data.js'
OUT = ROOT / 'tools' / 'plan.json'
# Aufruf mit dem Namen einer Variante schreibt tools/plan-<name>.json; ohne
# Angabe entsteht der ausgewogene Plan unter tools/plan.json.
VARIANTE = sys.argv[1] if len(sys.argv) > 1 else 'standard'

# Sätze je Muskelgruppe und Woche – zweite Fassung. Vorher stand im Oberkörper
# überall eine 10, weil das die selbst gesetzte Obergrenze war. Zwei Dinge
# sprachen dagegen:
#
#   * Bauch. Zehn Sätze pro Woche waren das teuerste Nichts im Plan – ein
#     sichtbarer Bauch ist eine Frage des Körperfetts, nicht der Crunches.
#     Erst standen hier fünf. Das war zu wenig, und zwar aus einem Grund,
#     den die Zahl verdeckt: Beim Bauch stecken 60 % des Ziels in
#     indirekten Anteilen – dem Halten bei Kniebeuge, Kreuzheben und Leg
#     Curl. Von fünf blieben zwei direkte Sätze übrig, an einem Tag der
#     Woche. Isometrisches Halten ist aber kein Ersatz für Beugen gegen
#     Widerstand. Neun ergeben rund sechs direkte Sätze auf zwei Tagen –
#     die einzige Gruppe, bei der das Ziel deutlich über dem liegt, was
#     tatsächlich direkt trainiert wird.
#   * Zehn Sätze sind nicht das Ende der Fahnenstange. Die Dosis-Wirkung
#     steigt bis etwa zwanzig Sätze je Muskel und Woche weiter, mit
#     abnehmendem Ertrag. Wer schnell zulegen will, liegt bei 14–16 näher am
#     Optimum als bei 10.
#
# **Die Schulter zählt getrennt.** "10 Sätze Schulter" waren nachgerechnet 8,1
# vordere und 3,7 seitliche: Jedes Drücken füttert die vordere mit, die
# seitliche hängt allein am Heben zur Seite – und sie ist die, die breit macht.
# Zusammengefasst verdeckte das Ziel genau diesen Unterschied. Die seitliche
# bekommt deshalb ein eigenes Ziel, die vordere gar keins: Sie ergibt sich aus
# dem Drücken und muss nur unter der Obergrenze bleiben, so wie der Nacken.
#
# Nicht überall dieselbe Zahl: Was den Oberkörper breit macht, bekommt am
# meisten, die Beine bleiben, wie sie waren. None heißt
# "kein Ziel" – die Gruppe kommt heraus, wie sie herauskommt, und muss nur
# unter CAP bleiben. Der Nacken ist so ein Fall: er hängt vollständig an
# Rudern, Chin-ups, Pull-ups, Reverse Fly und Seitheben und ist damit keine
# freie Größe mehr. Ein Ziel dafür macht das Gleichungssystem nur unlösbar oder
# erzwingt eine Verteilung, die anderswo schlechter ist.
#
# **Der Beinbeuger zählt getrennt.** Dieselbe Geschichte wie bei der Schulter,
# eine Etage tiefer: "6 Sätze Beinbeuger" waren nachgerechnet 2,3 aus
# Kniebeugung und 3,7 aus Hüftstreckung. Hip Thrust, Kreuzheben und jede
# Kniebeuge zahlen auf die Hüftseite ein – der kurze Kopf des Bizeps femoris
# kreuzt aber nur das Knie und bekommt daraus strukturell nichts. Am fertigen
# Plan gemessen stand der Leg Curl in 16 von 84 Einheiten, mit bis zu 28 Tagen
# dazwischen und fünf Wochen ganz ohne. Die Kniebeugung bekommt deshalb ein
# eigenes Ziel, die Hüftseite gar keins: Sie ergibt sich aus dem Rest und muss
# nur unter der Obergrenze bleiben, so wie die vordere Schulter und der Nacken.
# Drei Sätze sind dabei nicht wenig, sondern genau ein Auftritt pro Woche – bei
# festen Dreiersätzen die kleinste Zahl, die in *jeder* Woche vorkommt.
TARGET = {
    'chest': 10, 'lats': 10, 'sideDelts': 10, 'rearDelts': 8,
    'biceps': 10, 'triceps': 10, 'abs': 9,
    'frontDelts': None, 'traps': None, 'hamstringsHip': None,
    'glutes': 9, 'quads': 6, 'hamstringsKnee': 3, 'calves': 6,
}
CAP = 10                 # keine Gruppe darüber, indirekte Anteile eingerechnet

# Trainingsfokus: derselbe Generator, andere Wochenziele.
#
# Nicht jeder will dasselbe. Wer den Link weitergibt, gibt ihn an Menschen, die
# sich für Beine und Gesäß interessieren oder ausschließlich für den Oberkörper
# – und der Plan soll dann nicht "ausgewogen" heißen und trotzdem zehn Sätze
# Brust rechnen. Die Varianten gehen durch dieselbe Rechnung: exakte
# Wochensummen, 48 Stunden Erholung, gleichmäßige Verteilung. Nur die Zielzahlen
# unterscheiden sich – und damit ändert sich nichts an der Sorgfalt, nur an der
# Betonung.
#
# `cap` je Variante, weil die Obergrenze für den Nacken an der hinteren Schulter
# hängt: Wer den Rücken betont, treibt sie mit hoch, und eine 10 wäre dort
# unerfüllbar.
#
# **Termine je Woche = direkte Sätze ÷ 3.** Der Satz steht hier oben, weil er für
# jede Variante gilt und weil zwei von ihnen an ihm gescheitert sind. Er ist
# keine Faustregel, sondern eine Gleichung: Ein Auftritt hat immer drei Sätze,
# also braucht es für zwei Termine sechs *direkte* Sätze – wie hoch das Ziel auch
# steht. Das Ziel zählt aber *gewichtetes* Volumen, und bei Gruppen mit viel
# indirektem Zufluss (Bauch, hintere Schulter, Hüftstreckung) kommt der größere
# Teil davon nebenbei aus Kniebeuge, Kreuzheben und Rudern. Wer dort kürzt, muss
# das Ziel deshalb *anheben*, nicht senken – sonst sind die Wochensummen exakt
# getroffen und die Gruppe kommt trotzdem nur einmal in zwölf Tagen dran.
#
# Vier Varianten, nicht sechs. „Kurz und knapp" und „Beine ernst gemeint" sind
# weg – nicht weil sie kaputt waren (beide waren zuletzt nachgerechnet und in
# Ordnung), sondern weil sie neben den anderen keine eigene Antwort mehr gaben:
# „Kurz und knapp" wollte weniger Volumen bei gleicher Abdeckung, und genau das
# ist „Cut", nur ohne dessen Löcher bei Waden, Beinbeuger und Hüftstreckung.
# „Beine ernst gemeint" wollte Beine mit eigenem Ziel, und das ist
# „Bauch, Beine, Po". Wer sechs Pläne anbietet, von denen zwei Paare fast
# dasselbe meinen, verlangt eine Entscheidung, für die es keine Grundlage gibt.
# Für alle, die auf einer der beiden standen, leitet die App um – siehe
# FOKUS_ERSATZ in tools/build-data.py. Die Rechnungen dahinter stehen weiter im
# README, unter „Zwei Pläne, die es nicht mehr gibt".
VARIANTEN = {
    # „Ausgewogen" hieß der hier ein Jahr lang, und der Name beschrieb die
    # Rechnung statt den Zweck: Ausgewogen sind alle vier, das ist der Anspruch
    # des Generators und kein Merkmal. Wer hier landet, will aufbauen – die
    # anderen drei sind Defizit, Beine und Oberkörper.
    'standard': {
        'name': 'Aufbau',
        'ziele': TARGET,
        'cap': CAP,
    },
    # Der Unterkörper war hier nie das Problem – Gesäß 3,0 Termine die Woche,
    # Oberschenkel 2,8, Bauch 2,0. Kaputt war der Oberkörper, und zwar nach
    # demselben Muster wie bei „Kurz und knapp": Ziele exakt getroffen,
    # Frequenz im Keller.
    #
    #   hintere Schulter   3,1 direkte Sätze → 1,05 Termine, bis 12 Tage Abstand
    #   seitliche Schulter 4,7 direkte Sätze → 1,57 Termine, bis 10 Tage
    #   Trizepsstrecker    kam im ganzen Plan nicht vor
    #
    # **Die hintere Schulter braucht hier ein *höheres* Ziel als im
    # ausgewogenen Plan** – 8 gegen 8, also gleich viel, obwohl ringsum
    # gekürzt wird. Das sieht falsch aus und ist es nicht: Sie lebt zum guten
    # Teil vom Rudern, und dieser Plan rudert weniger (Rücken 7 statt 10). Wer
    # den Zufluss kürzt, muss das Ziel halten, sonst kürzt er doppelt. Dieselbe
    # Lehre wie beim Bauch, nur eine Etage höher.
    #
    # Trizeps 5 → 6 hält das Schulterdrücken im Plan; bei 5 fiel es ganz heraus
    # und die vordere Schulter auf 0,48 Termine. Bei 6 steht sie bei 1,05 –
    # weniger als die 1,62 von vorher, und das ist der Preis: Was die hintere
    # Schulter mehr bekommt, geht der vorderen ab. Von den drei Köpfen ist die
    # vordere der, der von jedem Drücken und jeder Liegestütze ohnehin etwas
    # abbekommt; die hintere ist der, den man vergisst.
    'bbp': {
        'name': 'Bauch, Beine, Po',
        'ziele': {
            'chest': 6, 'lats': 7, 'sideDelts': 7, 'rearDelts': 8,
            'biceps': 5, 'triceps': 6, 'abs': 12,
            'frontDelts': None, 'traps': None, 'hamstringsHip': None,
            'glutes': 15, 'quads': 12, 'hamstringsKnee': 6, 'calves': 9,
        },
        'cap': 12,
    },
    # Beine auf Erhalt – aber nicht die Hüftstreckung auf null.
    #
    # Mit Gesäß 3 fielen Kreuzheben, Hip Thrust, Split Squat und der einbeinige
    # Leg Curl komplett aus dem Plan: **kein einziger Hüftstreckungsreiz in 24
    # Wochen.** Für einen Oberkörperplan ist wenig Beinarbeit richtig, ein
    # halbes Jahr ohne das Bewegungsmuster ist etwas anderes – wer danach
    # wieder Kreuzheben will, fängt bei null an.
    #
    # Ein eigenes Ziel für die Hüftstreckung geht *nicht*: Nachgerechnet über
    # 36 Kombinationen aus Hüftstreckung 3–5, Gesäß 3–5 und Bauch 6–8 gibt es
    # zwischen 21 und 32 Wochen keine einzige exakte Lösung. Bei so wenig
    # Beinvolumen ist der Block überbestimmt, sobald eine Gleichung dazukommt.
    #
    # Also über das Gesäß: 3 → 6 bringt das Kreuzheben zurück und die
    # Hüftstreckung auf 1,21 Termine die Woche. Kostet drei Sätze die Woche.
    # Der Split Squat bleibt draußen – das Kniebeugemuster steht mit zwei
    # Goblet-Fassungen im Plan, das Hüftmuster stand mit gar nichts.
    'oberkoerper': {
        'name': 'Oberkörper',
        'ziele': {
            'chest': 12, 'lats': 12, 'sideDelts': 12, 'rearDelts': 9,
            'biceps': 12, 'triceps': 12, 'abs': 6,
            'frontDelts': None, 'traps': None, 'hamstringsHip': None,
            'glutes': 6, 'quads': 3, 'hamstringsKnee': 3, 'calves': 3,
        },
        'cap': 13,
    },
    # Weniger Volumen, gleiche Abdeckung – für Wochen im Kaloriendefizit.
    #
    # Im Defizit wird nicht aufgebaut, sondern gehalten, und gehalten wird über
    # die *Last*, nicht über das Volumen: Dieselben Gewichte weiter bewegen ist
    # der Hebel, zusätzliche Sätze kosten vor allem Erholung, die im Defizit
    # ohnehin knapp ist.
    #
    # Der Unterschied zum abgeschafften "Kurz und knapp" ist der entscheidende
    # und der Grund, warum dessen Nachfolger dieser Plan ist: Dort wurde überall
    # gekürzt, bis mehrere Gruppen bei einem Auftritt pro Woche landeten (die
    # Hüftstreckung bei 0,4 mit bis zu 30 Tagen Abstand, Hip Thrust fiel ganz
    # heraus). Hier bleibt die Frequenz stehen und nur die Satzzahl sinkt.
    #
    # **Ein Ziel von 6 heißt nicht zwei Auftritte pro Woche.** Das war der erste
    # Anlauf, und er ging schief: Das Ziel zählt *gewichtetes* Volumen, die
    # Frequenz hängt aber an den direkten Sätzen. Bei Ziel 6 kamen der Bauch auf
    # 1,0 Auftritte (10 Tage Abstand) und die hintere Schulter auf 1,4, weil ein
    # guter Teil ihres Volumens aus Kniebeugen und Rudern nebenbei anfällt.
    # Gruppen mit viel indirektem Zufluss brauchen deshalb ein *höheres* Ziel,
    # nicht trotz, sondern wegen der Kürzung:
    #
    #   * Bauch bleibt bei 9 wie im ausgewogenen Plan. Er kostet dort nur rund
    #     sechs direkte Sätze; der Rest ist Halten bei Kniebeuge und Kreuzheben.
    #   * Hintere Schulter auf 7 statt 6 – unter 7 kippt sie auf einen Auftritt.
    #   * Die Hüftstreckung bekommt ein eigenes Ziel (5, so viel wie sie im
    #     ausgewogenen Plan von selbst bekommt). Als abgeleitete Größe fiel sie
    #     auf 0,7 Auftritte mit 19 Tagen Abstand – dieselbe Stelle, an der auch
    #     "Kurz und knapp" bricht.
    #   * Gesäß 8 statt 7, und das ist keine Trainingsentscheidung, sondern
    #     Arithmetik: Mit Hüftstreckung 5 und Gesäß 7 geht zwischen 21 und 32
    #     Wochen keine exakte Lösung auf. Mit 8 geht sie ab 21. Was zusammen
    #     erreichbar ist, sagt der Lauf – hier hat er es gesagt.
    #
    # Die Beine stehen im ausgewogenen Plan schon auf Erhalt; sie noch weiter zu
    # senken hieße, unter den Erhalt zu gehen. Sie bleiben deshalb, wo sie sind.
    'cut': {
        'name': 'Cut',
        'ziele': {
            'chest': 7, 'lats': 7, 'sideDelts': 7, 'rearDelts': 7,
            'biceps': 7, 'triceps': 7, 'abs': 9,
            'frontDelts': None, 'traps': None,
            'glutes': 8, 'quads': 6, 'hamstringsHip': 5, 'hamstringsKnee': 3, 'calves': 6,
        },
        'cap': 10,
    },
}

if VARIANTE not in VARIANTEN:
    sys.exit(f'Unbekannte Variante {VARIANTE!r} – bekannt: {", ".join(VARIANTEN)}')
TARGET = VARIANTEN[VARIANTE]['ziele']
CAP = VARIANTEN[VARIANTE]['cap']
if VARIANTE != 'standard':
    OUT = ROOT / 'tools' / f'plan-{VARIANTE}.json'
#
# Die Obergrenze bindet in Wahrheit nur eine Gruppe: den Nacken. Er bekommt
# keinen einzigen eigenen Satz – kein Shrug, nichts –, sondern sammelt aus
# Rudern, Klimmzügen, Reverse Fly und Pull-Apart. Genau deshalb ist er teuer:
# Jede Übung, die Rücken oder hintere Schulter trainiert, lädt ihn mit. Bei
# hinterer Schulter 10 liegt sein rechnerisches Minimum bei 10,79 – eine
# Obergrenze von 10 wäre dort schlicht unerfüllbar. Mit 8 sinkt das Minimum auf
# 9,59, und es bleiben genug brauchbare Lösungen übrig. Das ist der Tausch:
# zwei Sätze hintere Schulter für einen Nacken unter zehn.
DIRECT = 0.5             # ab diesem Anteil gilt eine Übung als direkt für die Gruppe
REST_DAYS = 2            # so viele Tage Abstand, bevor eine Gruppe wieder direkt drankommt

# Trainingstage als Wochentage, 0 = Montag. Vorher ergaben sich die Termine aus
# dem Startdatum der Excel und einem gleichmäßigen Rhythmus – das war ein
# Nebenprodukt, keine Entscheidung. Hier steht sie ausdrücklich: Montag,
# Mittwoch, Freitag, Samstag. Der Ein-Tages-Abstand liegt damit auf Fr/Sa, der
# Sonntag bleibt frei. Wer anders kann, ändert die Zeile; die Erholungsregel
# rechnet mit den tatsächlichen Abständen und passt sich von selbst an.
DAYS = (0, 2, 4, 5)
WEEK = len(DAYS)         # Einheiten je Woche
WEEKS = 21               # Wochen im Plan – Vielfaches von GRAIN, siehe oben
# Sätze je Auftritt einer Übung. Gleicher Wert oben wie unten heißt: jede
# Übung steht immer mit derselben Satzzahl da. Das kostet Genauigkeit in der
# einzelnen Woche – die Satzzahl jeder Übung ist dann ein Vielfaches dieses
# Werts, und Gruppen, deren Übungen alle Anteil 1,0 haben (Brust, Rücken,
# Oberschenkel, Waden), können in einer Woche nur Vielfache davon bekommen.
#
# **Vier statt drei war einen Versuch wert und ist durchgefallen.** Dieselbe
# Wochenmenge auf vier Sätze je Auftritt verteilt braucht ein Drittel weniger
# Auftritte – aus 6,3 Übungen je Einheit wurden 4,8, und jede Übung weniger ist
# ein Gerät weniger. Am Beinplan nachgemessen sparte das aber nur **0,6
# Rüstvorgänge je Einheit** (3,67 -> 3,05), weil die Gerätegruppierung in der
# App den Löwenanteil schon vorher holt. Bezahlt hätte man es mit Frequenz:
# Gruppen unter zwei Auftritten pro Woche stiegen von einer auf sechs, die
# größte Lücke von 9 auf 14 Tage, die vordere Schulter fiel von 2,0 auf 1,0
# Auftritte. Eine halbe Minute Umbauzeit gegen zwei Wochen ohne Reiz ist kein
# Tausch, den man macht.
#
# Höher ginge es ohnehin nicht sinnvoll: Die Erfahrungsstufe skaliert diesen
# Wert mit (siehe satzZahl() in js/app.js), und bei fünf oder sechs stünden
# Fortgeschrittene bei sieben bis acht Sätzen derselben Übung am Stück.
# Über die Umgebung einstellbar, damit sich der Tausch zwischen Wochenbalance
# und Länge der Einheiten nachmessen lässt, ohne die Datei zu ändern – siehe
# APP weiter unten:  WK_PER_SET=2,3 python3 tools/build-plan.py cut --report
PER_SET = tuple(int(x) for x in os.environ.get('WK_PER_SET', '3,3').split(','))
# Körnung: Bei fester Satzzahl bewegt sich alles in Dreierschritten.
GRAIN = PER_SET[0] if PER_SET[0] == PER_SET[1] else 1
PER_WEEK = PER_SET[1] * WEEK   # mehr geht in einer Woche gar nicht

# Sätze je Übung und Woche, wenn sie überhaupt vorkommt. Ohne diese Schranken
# wählt die Suche gern Extreme: bei 21 Übungen kam eine Lösung heraus, in der
# Chin-ups mit 10 Sätzen pro Woche am Anschlag standen und das Rudern
# vollständig verschwand – rechnerisch exakt und als Plan unbrauchbar. Nach
# oben begrenzt heißt: keine Übung trägt eine Gruppe allein; nach unten: wer
# vorkommt, kommt regelmäßig vor. Gemeint ist damit die *Plansumme*: Sie bindet
# den Schnitt über alle Wochen, nicht die einzelne Woche – dafür sorgt band().
PER_EX_WEEK = (1, 9)
EXACT_LIMIT = 4000       # so viele Plansummen je Block reichen zur Auswahl
# Und so viele Knoten darf die Suche dafuer anfassen. Ohne diese Grenze hatte
# sie nur eine Obergrenze fuer die Funde und keine fuer die Arbeit - siehe
# exact().
#
# Die Zahl ist gemessen, nicht geschaetzt. Was die Laeufe wirklich brauchen,
# steht seither in jedem Bericht:
#
#     bbp             97 Tausend Knoten
#     oberkoerper      3,4 Millionen
#     cut            205 Millionen
#
# Zwischen der guenstigsten und der teuersten Variante liegen also drei
# Groessenordnungen. Eine halbe Milliarde laesst der teuersten das Doppelte
# Luft und bricht trotzdem nach gut einer Stunde ab statt nach zehn.
EXACT_NODES = int(os.environ.get('WK_NODES', 5 * 10 ** 8))
SCREEN = 50              # davon werden die besten probeweise verteilt
SCREEN_RESTARTS = 2      # Anläufe je Probe
SCREEN_ROUNDS = 90000    # Schritte je Probe
RESTARTS = 16            # Anläufe beim Verteilen auf die Wochen
SPREAD_ROUNDS = 400000   # Schritte je Anlauf
SPLITS = 2000            # Versuche je Woche für die Aufteilung

# Rüstzeit. Zwischen zwei Übungen steht in der Wohnung nicht die Pause, sondern
# der Umbau: Scheiben ab, andere drauf, Verschlüsse zu. Welche Geräte an einem
# Tag zusammenkommen, entscheidet sich hier – und die Aufteilung hat dabei
# echten Spielraum, weil das Wochenvolumen längst feststeht und nur noch die
# Verteilung auf die vier Tage offen ist. Übungen ohne Aufbau (Klimmzüge, Band,
# Bodyweight) zählen nicht mit, sie kosten nichts.
GERAET = {
    # Die SZ-Stange zaehlt hier wie die Langhantel, obwohl sie in der App eine
    # eigene Stange ist (RASTER/RUEST_FAM, eigenes Leergewicht). Fuer die
    # *Tagesaufteilung* geht es um etwas anderes: Wer an einem Tag eine Stange
    # laedt, hat die Scheiben ohnehin draussen – die zweite Stange ist ein
    # Wechsel, kein Aufbau. Und weil `equip` in diese Datei nur ueber GERAET
    # eingeht (eine einzige Stelle, siehe unten), bleibt die Eingabe des
    # Generators dadurch unveraendert: Die eingecheckten Plaene sind weiter die
    # ihrer Eingaben, ohne dass vier Laeufe zu je einer Viertelstunde noetig sind.
    'barbell': 'lh', 'hipbar': 'lh', 'szbar': 'lh',
    'dumbbells': 'kh2', 'goblet': 'kh1', 'onehand': 'kh1', 'plate': 'kh1',
    'backpack': 'ruck',
}

# Gerechnet wird durchweg in Zwanzigsteln eines Satzes: alle Anteile in
# exercise-meta.json sind Vielfache von 0,05, damit bleibt alles ganzzahlig und
# "exakt" heißt wirklich exakt und nicht "bis auf Rundungsfehler".
UNIT = 20
GOAL = {m: (None if t is None else t * UNIT) for m, t in TARGET.items()}
CAP_U = CAP * UNIT

LABEL = {
    'quads': 'Oberschenkel', 'glutes': 'Gesäß',
    'hamstringsKnee': 'Beinbeuger Knie', 'hamstringsHip': 'Beinbeuger Hüfte',
    'chest': 'Brust', 'lats': 'Rücken',
    'frontDelts': 'vord. Schulter', 'sideDelts': 'seitl. Schulter',
    'rearDelts': 'hint. Schulter', 'biceps': 'Bizeps', 'triceps': 'Trizeps',
    'abs': 'Bauch', 'calves': 'Waden', 'traps': 'Nacken',
}


# ------------------------------------------------------------------ #
# Termine
# ------------------------------------------------------------------ #

def dates(weeks):
    """Trainingstermine erzeugen: `weeks` Wochen à WEEK Einheiten.

    Die Wochentage stehen in DAYS. Losgelegt wird am ersten dieser Tage ab dem
    Startdatum der Excel – und zwar am *ersten* aus DAYS, damit jede Woche
    vollständig ist: die Volumenrechnung fasst je WEEK aufeinanderfolgende
    Einheiten zu einer Woche zusammen, und eine angebrochene erste Woche würde
    diese Blöcke gegen den Kalender verschieben.
    """
    # Das Startdatum steht im zuletzt erzeugten Plan. Früher wurde es aus
    # js/data.js gelesen – dort steht seit den Fokus-Varianten aber nur noch ein
    # Verweis (`export const PLAN = AKTIV.plan`), kein JSON mehr. tools/plan.json
    # ist ohnehin die Quelle, aus der js/data.js entsteht.
    quelle = ROOT / 'tools' / 'plan.json'
    if quelle.exists():
        start = datetime.date.fromisoformat(json.loads(quelle.read_text(encoding='utf-8'))['plan'][0]['date'])
    else:
        # Allererster Lauf: Dann gilt das Datum aus der Excel-Fassung von data.js.
        src = DATA.read_text(encoding='utf-8')
        treffer = re.search(r'"date":"(\d{4}-\d{2}-\d{2})"', src)
        start = datetime.date.fromisoformat(treffer.group(1))

    tage = sorted(DAYS)
    first = start
    while first.weekday() != tage[0]:
        first += datetime.timedelta(days=1)
    day = []
    for w in range(weeks):
        for d in tage:
            day.append(first + datetime.timedelta(days=7 * w + d - tage[0]))
    return day


# ------------------------------------------------------------------ #
# Volumen
# ------------------------------------------------------------------ #

class Volume:
    """Rechnet Satzzahlen in Muskelvolumen um – in Zwanzigsteln."""

    def __init__(self, shares, ids, groups):
        self.ids, self.groups = ids, groups
        self.s = [[round(shares[i].get(m, 0) * UNIT) for m in groups] for i in ids]

    def of(self, n):
        out = [0] * len(self.groups)
        for c, row in zip(n, self.s):
            if c:
                for g, v in enumerate(row):
                    if v:
                        out[g] += c * v
        return out


# ------------------------------------------------------------------ #
# Schritt 1: Plansummen, die exakt aufgehen
# ------------------------------------------------------------------ #

def parts(ids, shares, groups):
    """Übungen, die über eine Muskelgruppe zusammenhängen, gehören zusammen.

    Der Unterkörper teilt keine Gruppe mit dem Oberkörper und die Waden mit
    niemandem. Getrennt gerechnet zerfällt die Suche in drei kleine Probleme
    statt eines großen – das ist der Unterschied zwischen Sekunden und Stunden.
    """
    root = {i: i for i in ids}

    def find(x):
        while root[x] != x:
            root[x] = root[root[x]]
            x = root[x]
        return x

    for m in groups:
        hit = [i for i in ids if shares[i].get(m)]
        for i in hit[1:]:
            root[find(i)] = find(hit[0])
    out = {}
    for i in ids:
        out.setdefault(find(i), []).append(i)
    return list(out.values())


def capped(sol, shares, weeks):
    """Bleibt jede Gruppe ohne Ziel unter der Obergrenze?

    Für Gruppen mit Ziel erledigen das die Gleichungen. Für die anderen ist es
    die einzige Bedingung: höchstens CAP Sätze pro Woche, indirekte Anteile
    eingerechnet.
    """
    got = {}
    for i, n in sol.items():
        for m, s in shares[i].items():
            if GOAL.get(m) is None:
                got[m] = got.get(m, 0) + n * round(s * UNIT)
    return all(v <= CAP_U * weeks for v in got.values())


def bw_saetze(plan, weeks, lo=2, hi=4, budget=4000000, sammeln=400):
    """Eigene Satzzahlen für den Bodyweight-Modus – auf demselben Terminplan.

    Der Plan ist für die **Hantel-Fassung** exakt gerechnet. Ohne Zusatzlast
    trifft dieselbe Übung aber teils andere Muskeln: Der Goblet Squat hält den
    Bauch mit 0,35, seine Bodyweight-Fassung mit 0,20. Eine einzige Satzzahl
    kann nicht beide Gleichungssysteme treffen, und bis hierher hieß das: Der
    Bodyweight-Modus liegt eben daneben, im ausgewogenen Plan beim Bauch um
    0,59 Sätze die Woche.

    Das muss es aber nicht heißen, denn **die Satzzahl ist nicht die einzige
    freie Größe – sie ist bloß die einzige, die bisher festgenagelt war.** Wer
    Termine und Übungen stehen lässt und nur die Sätze je Auftritt zwischen
    zwei und vier variieren lässt, bekommt genug Spielraum, um auch das zweite
    System zu treffen. Die Einheit bleibt dieselbe Einheit, an denselben Tagen,
    mit denselben Übungen in derselben Reihenfolge – nur stehen bei manchen
    zwei oder vier Sätze statt drei.

    Warum nicht eins bis fünf: Ein einzelner Satz ist kein Reiz, und fünf
    ändern den Charakter der Einheit. Der engere Rahmen kostet in zwei von
    sechs Varianten die Exaktheit; was übrig bleibt, steht im Bericht.

    Zwei Verfahren nacheinander, weil keines allein reicht:

      1. **Tiefensuche** wie bei der Hantel-Rechnung, nur mit einer eigenen
         Wertemenge je Übung ([lo·Auftritte, hi·Auftritte]) und mit den Werten
         nahe der Dreierzahl zuerst. Findet sie eine exakte Lösung, ist die
         Sache erledigt. Sie kann aber lange suchen – deshalb ein Knotenbudget.
      2. **Abstieg** von der Dreierzahl aus, ±1 Satz je Schritt, immer der
         Schritt mit der größten Verbesserung. Er trifft nicht immer exakt,
         kommt aber überall nah heran und braucht Millisekunden.

    Zurück kommt {übung: Sätze über den ganzen Plan}.
    """
    auftritte = collections.Counter()
    for e in plan:
        for it in e['ex']:
            auftritte[it['id']] += 1
    ids = [i for i in auftritte]
    shares = {i: BW_SHARES.get(i, {}) for i in ids}
    groups = sorted({m for i in ids for m in shares[i]})
    # Gerechnet wird in Zwanzigsteln, wie überall sonst auch.
    ziel = {m: (GOAL[m] * weeks if GOAL.get(m) is not None else None) for m in groups}
    grenzen = {i: (lo * auftritte[i], hi * auftritte[i]) for i in ids}
    start = {i: 3 * auftritte[i] for i in ids}

    def summe(val):
        got = collections.Counter()
        for i, n in val.items():
            for m, a in shares[i].items():
                got[m] += n * round(a * UNIT)
        return got

    def fehler(val):
        """Summe der Quadrate über die Zielgruppen, in Sätzen je Woche."""
        got = summe(val)
        return sum(((got[m] - ziel[m]) / UNIT / weeks) ** 2
                   for m in groups if ziel[m] is not None)

    def haltbar(val):
        got = summe(val)
        return all(got[m] <= CAP_U * weeks for m in groups if ziel[m] is None)

    # ---- 1. Tiefensuche je Block ----------------------------------------
    erlaubt = {i: sorted(range(grenzen[i][0], grenzen[i][1] + 1),
                         key=lambda n, a=auftritte[i]: (abs(n - 3 * a), n))
               for i in ids}
    erlaubt_set = {i: set(v) for i, v in erlaubt.items()}
    gesamt, exakt = {}, True
    # Ob die Suche den Raum wirklich abgegrast hat oder am Budget abgebrochen
    # ist, ist der Unterschied zwischen "es gibt keine Lösung" und "ich habe
    # keine gefunden". Der gehört in den Bericht.
    vollstaendig = True
    for block in parts(ids, shares, groups):
        eqs = [(ziel[m], [(i, round(shares[i][m] * UNIT)) for i in block if shares[i].get(m)])
               for m in sorted({m for i in block for m in shares[i]}) if ziel[m] is not None]
        reihe = sorted(block, key=lambda i: len(erlaubt[i]))
        knoten = [0]
        gefunden = []

        def rec(val):
            if len(gefunden) >= sammeln or knoten[0] > budget:
                return
            knoten[0] += 1
            while True:
                wieder = False
                for goal, eq in eqs:
                    rest, offen = goal, []
                    for i, c in eq:
                        if i in val:
                            rest -= c * val[i]
                        else:
                            offen.append((i, c))
                    if not offen:
                        if rest:
                            return
                        continue
                    if len(offen) == 1:
                        i, c = offen[0]
                        if rest % c or rest // c not in erlaubt_set[i]:
                            return
                        val[i] = rest // c
                        wieder = True
                        continue
                    if rest % math.gcd(*[c for _, c in offen]):
                        return
                    if not (sum(c * grenzen[i][0] for i, c in offen) <= rest
                            <= sum(c * grenzen[i][1] for i, c in offen)):
                        return
                if not wieder:
                    break
            frei = [i for i in reihe if i not in val]
            if not frei:
                if haltbar(val):
                    gefunden.append(dict(val))
                return
            for n in erlaubt[frei[0]]:
                rec({**val, frei[0]: n})

        rec({})
        if knoten[0] > budget:
            vollstaendig = False
        if gefunden:
            # Unter den exakten die, die dem Hantel-Plan am nächsten kommt: Je
            # weniger Auftritte von drei Sätzen abweichen, desto weniger fällt
            # dem Trainierenden auf, dass er zwei Pläne vor sich hat.
            gefunden.sort(key=lambda v: (sum(abs(v[i] - start[i]) for i in v),
                                         max(abs(v[i] - start[i]) for i in v),
                                         sorted(v.items())))
            gesamt.update(gefunden[0])
        else:
            exakt = False
            gesamt.update({i: start[i] for i in block})

    if exakt:
        return gesamt, 0.0, True

    # ---- 2. Abstieg, wo die Suche nicht durchkam ------------------------
    val = dict(start)
    besser = True
    while besser:
        besser = False
        jetzt = fehler(val)
        bester = None
        for i in ids:
            for d in (-1, 1):
                n = val[i] + d
                if not (grenzen[i][0] <= n <= grenzen[i][1]):
                    continue
                probe = {**val, i: n}
                if not haltbar(probe):
                    continue
                f = fehler(probe)
                if f < jetzt - 1e-12 and (bester is None or f < bester[0]):
                    bester = (f, i, n)
        if bester:
            val[bester[1]] = bester[2]
            besser = True
    return val, fehler(val), vollstaendig


def bw_verteilen(plan, gesamt):
    """Die Plansumme je Übung auf ihre Auftritte verteilen.

    Möglichst gleichmäßig über den ganzen Plan: Bekommt eine Übung 80 Sätze auf
    24 Auftritte, sind das acht Auftritte mit vier und sechzehn mit drei – und
    die vier Sätze sollen sich über die Wochen verteilen, nicht am Anfang
    stapeln. Sonst schwankt das Wochenvolumen im Bodyweight-Modus stärker als
    im Hantel-Modus, obwohl der Schnitt stimmt.
    """
    auftritte = collections.Counter()
    for e in plan:
        for it in e['ex']:
            auftritte[it['id']] += 1
    gezaehlt = collections.Counter()
    for e in plan:
        for it in e['ex']:
            i = it['id']
            a, n = auftritte[i], gesamt[i]
            k = gezaehlt[i]
            # Der k-te Auftritt bekommt so viele Sätze, dass die Teilsummen der
            # idealen Verteilung n·(k+1)/a folgen – das streut die Ausreißer
            # von selbst gleichmäßig.
            it['bwSets'] = (n * (k + 1)) // a - (n * k) // a
            gezaehlt[i] += 1
    return plan


def nullbasis(block, shares, weeks):
    """Kurze ganzzahlige Vektoren, die jede Zielgleichung unverändert lassen.

    Addiert man einen davon auf eine exakte Lösung, kommt wieder eine exakte
    heraus – das ist die Definition. Interessant ist, *wie* sie aussehen: Der
    kürzeste tauscht einen Satz Crunches gegen einen Satz hängendes Knieheben,
    der nächste sitzendes gegen stehendes Seitheben. Übungen mit demselben
    Muskelprofil sind für die Gleichungen austauschbar, und genau das steht
    hier als Vektor. Sie sind nicht ausgedacht, sondern fallen aus der Rechnung
    heraus.

    **Warum das den Generator rettet.** Das System hat 31 Unbekannte und 10
    Gleichungen: 21 Übungen darf man frei wählen, die restlichen 10 sind damit
    bestimmt. Die Tiefensuche in exact() weiß das nicht – sie probiert alle 31
    durch und hofft, dass am Ende zehn Gleichungen aufgehen. Beim Aufbau-Plan
    lief sie dafür zehn Stunden ohne einen einzigen Fund. Von einer bekannten
    Lösung aus stehen mit diesen Vektoren in einer Sekunde über tausend da.

    **Ganzzahlig gerechnet, nicht hochskaliert**, und das ist der Unterschied
    zwischen einer Basis und einem Ausschnitt. Der erste Entwurf nahm die
    Vektoren der Zeilenstufenform über den Brüchen und multiplizierte jeden mit
    dem Hauptnenner. Das ergibt zwar lauter gültige Nullvektoren, aber nicht
    alle: Zwischen sz-Curls und Rucksack-Curls kam so nur ein Tausch im Block
    von siebzehn Sätzen heraus, und aus 39 Sätzen wird man mit Siebzehnerschritten
    nie null. Der Tausch eines einzelnen Satzes existiert – er lag nur nicht im
    aufgespannten Gitter.

    Gerechnet wird deshalb über die Hermite-Normalform: An die transponierte
    Matrix kommt die Einheitsmatrix, dann wird ganzzahlig eliminiert (Euklid
    statt Division). Zeilen, deren linker Teil zu null wird, tragen rechts einen
    Kern-Vektor – und diese Vektoren spannen das ganze Gitter auf, nicht nur
    einen Teil davon.
    """
    groups = [m for m in sorted({m for i in block for m in shares[i]})
              if GOAL.get(m) is not None]
    n, g = len(block), len(groups)
    # Zeile je Übung: links ihre Spalte aus A, rechts der Einheitsvektor.
    M = [[round(shares[i].get(m, 0) * UNIT) for m in groups]
         + [1 if k == c else 0 for k in range(n)]
         for c, i in enumerate(block)]

    zeile = 0
    for spalte in range(g):
        while True:
            nz = [r for r in range(zeile, n) if M[r][spalte]]
            if len(nz) <= 1:
                if nz:
                    M[zeile], M[nz[0]] = M[nz[0]], M[zeile]
                break
            # Der kleinste Eintrag räumt die anderen aus – der Euklidische
            # Algorithmus, nur auf ganzen Zeilen statt auf zwei Zahlen.
            p = min(nz, key=lambda r: abs(M[r][spalte]))
            for r in nz:
                if r == p:
                    continue
                q = M[r][spalte] // M[p][spalte]
                if q:
                    M[r] = [a - q * b for a, b in zip(M[r], M[p])]
        if any(M[r][spalte] for r in range(zeile, n)):
            zeile += 1

    basis = []
    for row in M:
        if any(row[:g]):
            continue
        v = row[g:]
        teiler = math.gcd(*[abs(x) for x in v if x]) or 1
        basis.append([x // teiler for x in v])

    # Kürzen: Ein Vektor, der zwei Sätze zwischen sechs Übungen verschiebt,
    # führt aus dem erlaubten Bereich heraus, bevor er irgendwo ankommt. Paarweise
    # Differenzen bringen die Basis auf die kurzen, dünn besetzten Vektoren
    # herunter – das ist keine echte Gitterreduktion, kostet aber nichts und
    # reicht: Was übrig bleibt, tauscht meist zwischen zwei oder drei Übungen.
    norm = lambda v: sum(x * x for x in v)          # noqa: E731
    for _ in range(60):
        besser = False
        for i in range(len(basis)):
            for j in range(len(basis)):
                if i == j:
                    continue
                for s in (1, -1):
                    kand = [a + s * b for a, b in zip(basis[i], basis[j])]
                    if any(kand) and norm(kand) < norm(basis[i]):
                        basis[i] = kand
                        besser = True
        if not besser:
            break
    basis.sort(key=norm)
    return basis


def freiraeumen(block, shares, weeks, values, rnd, start, verboten, schritte=2000000):
    """Eine exakte Lösung ohne die Notnagel-Übungen – ausgehend von einer mit.

    Der Fall ist echt und war der Anlass: Im ausgelieferten Cut stehen 39 Sätze
    Rucksack-Curls, im Oberkörper 174 Sätze improvisierter Übungen. `nurErsatz`
    hält sie aus künftigen Plänen heraus, aber der einzige Startpunkt, den es
    gibt, enthält sie – und ohne Startpunkt findet der Generator nichts.

    Also wird zuerst geräumt: dieselben Nullvektoren, nur mit einem Ziel statt
    ohne. Jeder Schritt, der die Sätze auf den verbotenen Übungen senkt, wird
    genommen; Schritte, die nichts ändern, mit kleiner Wahrscheinlichkeit, damit
    die Suche aus einer Ebene wieder herausfindet. Das geht, weil es zu jeder
    improvisierten Übung eine mit identischem Muskelprofil gibt – der kürzeste
    Nullvektor tauscht genau zwischen den beiden.

    **Zwei Dinge, an denen der erste Entwurf gescheitert ist**, beide gemessen
    am Cut und am Oberkörper:

      * *Unterwegs darf mehr erlaubt sein als am Ziel.* Die erlaubten Satzzahlen
        springen von 0 auf 21 – eine Übung steht entweder gar nicht im Plan oder
        mindestens einmal die Woche. Wer nur über erlaubte Zwischenstände läuft,
        kommt bis 21 und dort nicht weiter: Der nächste Dreierschritt wäre 18.
        Unterwegs zählt deshalb nur „Vielfaches der Körnung und nicht negativ";
        geprüft wird am Ende.
      * *Der letzte Sprung muss gezielt sein.* Von 21 auf 0 sind es sieben
        Schritte auf einmal. Deshalb wird zu einer verbotenen Übung gezielt der
        Vielfache gesucht, der sie genau auf null bringt, statt darauf zu hoffen.

    Kommt nichts heraus, ist das eine Antwort und kein Fehler: Dann gibt es zu
    diesen Zielen keine Lösung ohne die Notnägel, und das gehört gesagt statt
    umgangen.
    """
    erlaubt = set(values)
    deckel = max(values)
    basis = nullbasis(block, shares, weeks)
    kurz = basis[:max(8, len(basis) // 2)] or basis
    x = [start.get(i, 0) for i in block]
    weg = [k for k, i in enumerate(block) if i in verboten]
    last = lambda v: sum(v[k] for k in weg)          # noqa: E731
    # Unterwegs reicht „Vielfaches der Körnung, nicht negativ, nicht über dem
    # Deckel" – siehe oben. Am Ziel gilt wieder die volle Regel.
    frei = lambda v: all(0 <= w <= deckel and w % GRAIN == 0 for w in v)   # noqa: E731
    schritt = [k * GRAIN for k in (1, -1, 2, -2, 3, -3)]
    jetzt = last(x)
    for _ in range(schritte):
        if not jetzt and all(w in erlaubt for w in x):
            return dict(zip(block, x))
        # Jeder zehnte Schritt zielt: eine verbotene Übung ganz auf null.
        if jetzt and rnd.random() < 0.1:
            j = rnd.choice([k for k in weg if x[k]])
            treffer = [v for v in basis if v[j] and x[j] % v[j] == 0]
            if treffer:
                v = rnd.choice(treffer)
                kand = [a - (x[j] // v[j]) * b for a, b in zip(x, v)]
                if frei(kand) and last(kand) < jetzt:
                    x, jetzt = kand, last(kand)
                    continue
        v = kurz[rnd.randrange(len(kurz))]
        kand = [a + rnd.choice(schritt) * b for a, b in zip(x, v)]
        if not frei(kand):
            continue
        neu = last(kand)
        if neu < jetzt or (neu == jetzt and rnd.random() < 0.3):
            x, jetzt = kand, neu
    return None


def wandern(block, shares, weeks, values, limit, rnd, start, schritte=400000):
    """Von einer bekannten exakten Lösung aus durch den Nullraum laufen.

    Der Weg, nachdem drei andere gemessen gescheitert sind, und sie stehen hier,
    damit niemand sie noch einmal geht:

      * **Zufällig frei wählen, Rest ausrechnen.** 52.000 Versuche je Sekunde,
        in 200.000 kein Treffer – die zehn ausgerechneten Werte müssen alle
        gleichzeitig auf einem Vielfachen von drei im erlaubten Bereich landen.
      * **Viele kurze Anläufe der Tiefensuche.** 60 Anläufe à 300.000 Knoten,
        18 Millionen Knoten, kein Treffer. Der Zufall in exact() entscheidet nur
        Gleichstände in der Wertereihenfolge, nicht die Reihenfolge der Übungen.
      * **Die Untergrenze lockern** (auch 3 statt mindestens 21 Sätze je Übung,
        damit mehr Lösungen dicht liegen): je 3 Millionen Knoten für vier
        Lockerungen, kein Treffer.

    Was trägt, ist der Startpunkt. Von einer Lösung aus sind die Nachbarn fast
    alle wieder Lösungen; hier stehen nach einer Sekunde über tausend
    verschiedene da.

    **Der Preis, und er ist echt:** Der Generator braucht dafür eine Lösung, die
    er nicht selbst gefunden hat – den ausgelieferten Plan. Ändert sich ein
    Ziel, ist der keine Lösung mehr, und dann steht wieder nichts da. main()
    prüft das und sagt es; geraten wird nicht.
    """
    erlaubt = set(values)
    x = [start.get(i, 0) for i in block]
    basis = nullbasis(block, shares, weeks)
    if not basis:
        return [dict(zip(block, x))] if capped(dict(zip(block, x)), shares, weeks) else []

    # Nur die kürzesten Vektoren: Die langen führen fast immer aus dem erlaubten
    # Bereich heraus, jeder Versuch mit ihnen ist verworfene Arbeit.
    kurz = basis[:max(8, len(basis) // 2)]
    schritt = [k * GRAIN for k in (1, -1, 2, -2, 3, -3)]
    gefunden, reihe = {}, []
    if capped(dict(zip(block, x)), shares, weeks):
        gefunden[tuple(x)] = None
        reihe.append(dict(zip(block, x)))

    for _ in range(schritte):
        if len(reihe) >= limit:
            break
        v = kurz[rnd.randrange(len(kurz))]
        k = rnd.choice(schritt)
        kand = [a + k * b for a, b in zip(x, v)]
        if any(w not in erlaubt for w in kand):
            continue
        x = kand
        t = tuple(x)
        if t in gefunden:
            continue
        sol = dict(zip(block, x))
        gefunden[t] = None
        if capped(sol, shares, weeks):
            reihe.append(sol)
    return reihe


def exact(block, shares, weeks, values, limit, rnd, budget=EXACT_NODES):
    """Alle Satzzahlen eines Blocks, die jede Zielgruppe exakt treffen.

    Tiefensuche mit zwei Abkürzungen. Steht in einer Gleichung nur noch eine
    Übung offen, ist ihr Wert bestimmt – passt er nicht, ist der Ast tot.
    Stehen mehrere offen, muss der Rest durch den größten gemeinsamen Teiler
    ihrer Anteile teilbar sein; das schneidet den Baum früh ab, lange bevor
    unten etwas nicht aufginge.

    Gruppen ohne Ziel (GOAL[m] is None) bekommen keine Gleichung. Sie werden
    hinterher nur noch gegen CAP geprüft – siehe capped().

    **Dazu ein Knotenbudget**, und das ist keine Vorsicht auf Verdacht. Die
    Suche hatte eine Obergrenze für die *Funde* (`limit`) und keine für die
    *Arbeit*. Solange Lösungen dicht liegen, fällt das nicht auf – bei „Cut"
    stehen die viertausend nach einer knappen Stunde. Bei „Aufbau" mit seinen
    höheren Zielen liegen sie dünner: Derselbe Lauf hing zehn Stunden bei 100 %
    CPU in dieser Funktion, ohne eine einzige Zeile auszugeben. Ein Werkzeug,
    das entweder in einer Viertelstunde fertig ist oder nie, ist keines.

    Zurück kommen die gefundenen Lösungen und ob das Budget gereicht hat. Ein
    Abbruch ist kein Fehler: Die Auswahl in totals() nimmt ohnehin nur die
    besten SCREEN davon, und ob sie aus viertausend oder aus vierhundert
    ausgewählt hat, steht im Bericht.
    """
    groups = [m for m in sorted({m for i in block for m in shares[i]})
              if GOAL.get(m) is not None]
    eqs = [(GOAL[m] * weeks, [(i, round(shares[i][m] * UNIT)) for i in block if shares[i].get(m)])
           for m in groups]
    allowed = set(values)
    fair = PER_SET[1] * weeks     # drei Sätze pro Woche als neutraler Anker
    out = []
    knoten = 0

    def rec(val):
        nonlocal knoten
        knoten += 1
        if knoten > budget:
            return
        while True:
            again = False
            for goal, eq in eqs:
                rest, open_ = goal, []
                for i, c in eq:
                    if i in val:
                        rest -= c * val[i]
                    else:
                        open_.append((i, c))
                if not open_:
                    if rest:
                        return
                    continue
                if len(open_) == 1:
                    i, c = open_[0]
                    if rest % c or rest // c not in allowed:
                        return
                    val[i] = rest // c
                    again = True
                    continue
                g = math.gcd(*[c for _, c in open_])
                if rest % g or rest < 0 or rest > sum(c for _, c in open_) * max(values):
                    return
            if not again:
                break
        rest_ex = [i for i in block if i not in val]
        if not rest_ex:
            if capped(val, shares, weeks):
                out.append(dict(val))
            return
        tight = min((eq for _, eq in eqs if sum(1 for i, _ in eq if i not in val) > 1),
                    key=lambda eq: sum(1 for i, _ in eq if i not in val), default=None)
        pick = next(i for i, _ in tight if i not in val) if tight else rest_ex[0]
        # Erst die Werte nahe an einem ausgewogenen Anteil, dann die Ränder.
        # Die Tiefensuche findet ohnehin nur so viele Lösungen, wie das Limit
        # zulässt – dann sollen es die brauchbaren sein und nicht die, die
        # zufällig zuerst kommen. Der Zufall bleibt als Tiebreak, damit
        # verschiedene Läufe verschiedene Lösungen sehen.
        order = sorted(values, key=lambda v: (abs(v - fair), rnd.random()))
        for v in order:
            if len(out) >= limit:
                return
            rec({**val, pick: v})

    rec({})
    return out, (knoten <= budget, knoten)


# Die Bodyweight-Anteile. Sie stehen nicht in den Gleichungen – die rechnen mit
# den Hantel-Anteilen –, entscheiden aber unter den exakten Lösungen mit; siehe
# bw_fehler().
BW_SHARES = {}


def bw_fehler(sol, weeks):
    """Wie weit liegt der Bodyweight-Modus mit dieser Lösung daneben?

    Dieselbe Übung trifft in beiden Fassungen nicht genau dieselben Muskeln: Der
    Goblet Squat hält den Bauch mit 0,35, seine Bodyweight-Fassung mit 0,2, und
    aus dem Seitheben wird ein Überkopfdrücken. Eine Satzzahl kann deshalb nicht
    beide Gleichungssysteme exakt treffen – wohl aber das eine exakt und das
    andere so knapp wie möglich.

    Zurück kommt die Summe der quadrierten Abweichungen je Zielgruppe, grob
    gerundet: ein Kriterium für den Gleichstand, kein Grund, eine trainings-
    technisch bessere Lösung zu verwerfen. Deshalb steht es in `got` ganz hinten.
    """
    got = {}
    for i, n in sol.items():
        for m, anteil in BW_SHARES.get(i, {}).items():
            got[m] = got.get(m, 0) + n * anteil
    fehler = 0.0
    for m, summe in got.items():
        ziel = GOAL.get(m)
        # Nur die Gruppen, die dieser Block überhaupt bedient. Sonst zählte jede
        # Gruppe der *anderen* Blöcke als "um ihr ganzes Ziel verfehlt" mit –
        # eine Konstante, die den Vergleich nicht verfälscht, aber die Zahl
        # unlesbar macht.
        if ziel is None:
            continue
        fehler += (summe / weeks - ziel / UNIT) ** 2
    return round(fehler, 4)


def klumpen(sol, block, shares):
    """Wie sehr hängt eine Gruppe an einer einzigen Übung?

    Zurück kommt der größte Anteil, den eine Übung am Volumen *einer* Gruppe
    hat, grob gestuft. Das ist kein Schönheitspreis: Vorher standen 7,9 Sätze
    Reverse Fly pro Woche für die hintere Schulter und ein Zug-Verhältnis von
    7 zu 3 zwischen Klimmzug und Rudern – beides nicht entschieden, sondern
    zufällig so gewählt. Ein Reiz aus zwei Richtungen ist mehr wert als
    derselbe Reiz doppelt, und fällt eine Übung wegen einer Beschwerde aus,
    bleibt bei einer Klumpen-Lösung nichts übrig.

    Gestuft in Zwanzigsteln, damit winzige Unterschiede nicht die Reihenfolge
    umwerfen und die späteren Kriterien noch etwas zu sagen haben.
    """
    schlimmst = 0.0
    for m in {m for i in block for m in shares[i] if GOAL.get(m) is not None}:
        teile = [sol[i] * shares[i].get(m, 0) for i in block]
        ganz = sum(teile)
        if ganz:
            schlimmst = max(schlimmst, max(teile) / ganz)
    return round(schlimmst * 20)


def totals(ids, shares, groups, weeks, rnd, streng=True, start=None):
    """Sätze je Übung über den ganzen Plan, exakt 10·W für jede Gruppe.

    Exakt sind viele Lösungen; brauchbar sind es weniger. Erst werden die
    ausgewogensten vorsortiert – keine Übung, die ganz herausfällt, möglichst
    wenig Streuung –, dann wird für die vordersten kurz durchgerechnet, wie eng
    sich damit die einzelne Woche halten lässt. Das entscheidet.

    Der Unterschied ist nicht klein: 180 Sätze Rudern sehen ausgewogen aus,
    ergeben aber 9 pro Woche und damit in jeder Woche dieselben drei Auftritte
    – die Chin-ups müssten dann auf einen Satz pro Woche, was bei mindestens
    zwei Sätzen je Auftritt nicht geht, und der Rücken schwankt um einen ganzen
    Satz. 160 Sätze Rudern lassen sich dagegen sauber teilen.

    Die Blöcke hängen über keine Gruppe zusammen, also lässt sich das je Block
    getrennt beurteilen.

    **Woher die Lösungen kommen, hängt an `start`.** Liegt für einen Block eine
    bekannte Lösung vor, läuft wandern() von ihr aus durch den Nullraum; das ist
    der Weg, der beim Aufbau-Plan überhaupt erst wieder etwas findet. Sonst
    bleibt die Tiefensuche exact(), die ohne Vorlage auskommt – und bei den
    kleinen Blöcken (zwei Waden-Übungen, eine Gleichung) in Millisekunden fertig
    ist.
    """
    values = [0] + [v for v in range(PER_EX_WEEK[0] * weeks, PER_EX_WEEK[1] * weeks + 1)
                    if v % GRAIN == 0]
    total, variants, vollstaendig = {}, [], []
    for block in parts(ids, shares, groups):
        hat_start = start is not None and all(start.get(i, 0) in set(values) for i in block)
        if hat_start:
            gleich = [m for m in sorted({m for i in block for m in shares[i]})
                      if GOAL.get(m) is not None]
            passt = all(sum(round(shares[i].get(m, 0) * UNIT) * start.get(i, 0) for i in block)
                        == GOAL[m] * weeks for m in gleich)
            hat_start = passt
        if hat_start:
            found = wandern(block, shares, weeks, values, EXACT_LIMIT, rnd, start)
            ganz, knoten = True, None
        else:
            found, (ganz, knoten) = exact(block, shares, weeks, values, EXACT_LIMIT, rnd)
        vollstaendig.append((ganz, knoten))
        if not found:
            # Zwei sehr verschiedene Fälle, und sie auseinanderzuhalten ist der
            # Grund, warum exact() das Budget mit zurückgibt: Wer den Baum ganz
            # abgesucht hat und nichts fand, weiß, dass es für diese Wochenzahl
            # nichts gibt – der nächste Versuch mit einer Woche mehr ist dann
            # richtig. Wer nur aufgehört hat, weiß gar nichts, und eine Woche
            # mehr wäre eine Antwort auf eine Frage, die niemand gestellt hat.
            if not ganz:
                sys.exit(f'Das Knotenbudget ({EXACT_NODES}) war aufgebraucht, bevor für '
                         f'{weeks} Wochen eine einzige exakte Lösung dastand. Mehr Budget: '
                         f'WK_NODES=... python3 tools/build-plan.py ...')
            if streng:
                sys.exit(f'Keine exakte Lösung für {weeks} Wochen')
            return None, (None, None)
        variants.append(len(found))

        def balance(sol):
            mean = sum(sol.values()) / len(sol)
            return (min(sol.values()) == 0,
                    sum((v - mean) ** 2 for v in sol.values()),
                    sorted(sol.items()))

        found.sort(key=balance)
        vol = Volume(shares, block, sorted({m for i in block for m in shares[i]}))
        best = None
        for sol in found[:SCREEN]:
            _, (hart, auftritte, worst, aus) = spread([sol[i] for i in block], vol, weeks,
                                                      rnd, SCREEN_RESTARTS, SCREEN_ROUNDS)
            # Erst: keine Gruppe soll einen ganzen Satz danebenliegen. Dann:
            # keine Übung soll unter einen Satz pro Woche rutschen, ganz
            # herausfallen eingeschlossen. Dann: keine Gruppe soll an einer
            # einzigen Übung hängen. Dann die Länge der Einheiten, dann die
            # schlechteste Woche, dann die Ausnahmen von der Schranke.
            knapp = sum(1 for v in sol.values() if v < weeks)
            got = (hart, knapp, klumpen(sol, block, shares), auftritte, worst, aus,
                   min(sol.values()) == 0, bw_fehler(sol, weeks), balance(sol))
            if best is None or got < best[0]:
                best = (got, sol)
        total.update(best[1])
    return [total[i] for i in ids], (variants, vollstaendig)


# ------------------------------------------------------------------ #
# Schritt 2: Plansummen auf die Wochen verteilen
# ------------------------------------------------------------------ #

def start(total, weeks, rnd):
    """Erste Verteilung: in jeder Woche der Schnitt, der Rest zufällig verteilt.

    So breit wie möglich streuen: Auf wenige Wochen zu stapeln macht aus 40
    Sätzen zehnmal vier statt zwanzigmal zwei – und damit eine Gruppe, die jede
    zweite Woche um einen ganzen Satz danebenliegt. Breiter als die Schranke
    aus band() geht nicht, also fängt die Verteilung gleich dort an: überall
    der abgerundete Schnitt, und so viele zufällige Wochen bekommen einen
    Auftritt mehr, wie die Plansumme hergibt. Welche das sind, entscheidet
    danach der Suchlauf.
    """
    rows = []
    for t in total:
        lo, hi = band(t, weeks)
        row = [lo] * weeks
        if hi > lo:
            for w in rnd.sample(range(weeks), (t - lo * weeks) // GRAIN):
                row[w] = hi
        rows.append(row)
    return rows


HARD = 10 ** 9           # Zuschlag ab MAX_REL Abweichung
# Zuschlag je Auftritt einer Übung – die eine Schraube, an der Wochenbalance
# und Länge der Einheiten gegeneinander stehen.
#
#     „mach möglichst wenig Lücken im wochendurchschnitt und Abweichung je
#      Woche auch möglichst gering"
#
# Rechnerisch ist der Umtauschkurs genau bestimmt: Die Abweichungsstrafe ist
# (rel · REF)**4 mit REF = 10 · UNIT = 200. Ein zusätzlicher Auftritt kostet
# APP. Gleichstand herrscht dort, wo (rel · 200)**4 = APP ist:
#
#     APP = 2·10⁵   ->   rel ≈ 10,6 %
#     APP = 1·10⁵   ->   rel ≈  8,9 %
#     APP = 5·10⁴   ->   rel ≈  7,5 %
#
# Unterhalb dieser Grenze nimmt der Suchlauf die Abweichung hin, oberhalb kauft
# er sich mit einem Auftritt mehr heraus.
#
# **Nachgemessen ist der Hebel trotzdem stumpf.** Drei volle Läufe von „Cut"
# mit 5·10⁴, 1·10⁵ und 2·10⁵ endeten alle bei derselben schlechtesten Woche
# (29 % vom Ziel), denselben 27 benutzten Übungen und derselben Häufigkeit
# ganz oben; unterschiedlich waren nur Kleinigkeiten weiter unten in der Liste.
#
# Ein vierter Lauf mit vertauschter Rangfolge in spread() – erst Abweichung,
# dann Auftritte – änderte daran ebenfalls nichts: wieder 29 %, wieder 391
# Auftritte. Die Vermutung, die Rangfolge überstimme pen(), war falsch.
#
# **Die Grenze ist die Körnung.** Ein Auftritt hat drei Sätze, also bewegt sich
# jede Wochensumme in Dreierschritten. Eine Gruppe mit Ziel 7 bekommt 6 oder 9 –
# 14 % zu wenig oder 29 % zu viel. Genau 29 % misst der Bericht, und genau die
# Gruppen mit Ziel 7 stehen dort oben. Ein fünfter Lauf mit PER_SET=(2,3), also
# Körnung 1, kam auf 11 % schlechteste Woche – und auf 6,98 statt 4,65 Übungen
# je Einheit, bevor die Aufteilung auf die Tage überhaupt scheiterte. Das ist
# kein Tausch, den man macht: eine ruhigere Woche gegen anderthalb Übungen mehr
# an jedem Trainingstag.
#
# Die Wochenabweichung ist damit dort, wo sie bei Dreiersätzen hingehört. Wer
# sie kleiner haben will, muss die Ziele auf Vielfache von drei legen – also die
# Dosis ändern, nicht den Suchlauf.
#
# Über die Umgebung einstellbar, damit sich das nachmessen lässt, ohne die
# Datei zu ändern: WK_APP=50000 python3 tools/build-plan.py cut --report
APP = int(os.environ.get('WK_APP', 2 * 10 ** 5))
# Zuschlag je Woche, in der eine Übung aus ihrer Schranke fällt – siehe band().
# Zum Vergleich: Eine Gruppe mit Ziel 10, die in einer Woche drei Sätze
# danebenliegt, kostet 1,3·10⁷. Eine Ausnahme ist also teurer als fast jede
# Ungenauigkeit, aber billiger als HARD – die Schranke blockiert nie eine
# Lösung, sie macht sie nur unattraktiv. Die Zahl ist erprobt: Bei 10⁶ nahm der
# Lauf 40 Ausnahmen und der Trizepsstrecker fiel wieder fünf Wochen am Stück
# aus; bei 10⁸ blieben zwei Ausnahmen übrig, und die hintere Schulter lag in
# einer Woche 31 % daneben statt 25 %, weil das Pull-Apart die schwachen Wochen
# des Reverse Fly nicht mehr auffangen durfte.
BAND = 5 * 10 ** 6
# Zuschlag je Punkt Unregelmäßigkeit aus spacing(). Die Schranke sorgt dafür,
# dass eine Übung nicht stapelt; das hier sorgt dafür, dass ihre freien Wochen
# nicht zusammenliegen. Ohne diesen Zuschlag standen die zehn Pull-up-Wochen so
# beieinander, dass dazwischen 42 Tage lagen.
LUECKE = 2 * 10 ** 6
REF = 10 * UNIT          # Bezugsziel der relativen Strafe: zehn Sätze
# Ab welchem Anteil des Wochenziels eine Abweichung als grob gilt. Ein Drittel
# klingt viel und ist bei Dreierschritten das Mindeste: Eine Gruppe mit Ziel 6,
# deren Übungen alle voll auf sie gehen, kann in einer Woche nur 3, 6 oder 9
# Sätze bekommen – 9 sind bereits die Hälfte darüber. Enger gesetzt findet der
# Lauf für solche Gruppen gar keine Verteilung mehr.
MAX_REL = 0.5


def band(t, weeks):
    """Wochenwerte, die eine Übung annehmen darf: ihr Schnitt, ab- und aufgerundet.

    Der Schnitt einer Übung ist selten glatt – 60 Sätze Rudern auf 21 Wochen
    sind 2,86. Erlaubt sind dann die beiden Vielfachen der Körnung darum herum,
    hier 0 und 3: die Übung steht in zwanzig Wochen einmal da und in einer gar
    nicht. Ohne diese Schranke war dieselbe Plansumme auch als 0, 0, 0, 6, 6, 6
    zulässig – im Schnitt dasselbe, in Wirklichkeit drei Wochen ohne Rudern und
    danach doppelt so viel auf einmal. Genau das stand im Plan: drei Wochen ohne
    Rudern, neun ohne Trizepsstrecker, zwischen zwei Kreuzheben bis zu 37 Tage.

    Die Plansummen bleiben davon unberührt, der Schnitt also weiter exakt.
    Verschoben wird nur, *welche* Woche den einen Auftritt mehr bekommt.

    Die Schranke ist weich: Ein Schritt darüber oder darunter bleibt erlaubt und
    kostet BAND. Hart gesetzt wäre sie zu teuer – die schlechteste Woche rückte
    von 25 % auf 31 % vom Ziel ab, weil manche Gruppe ihre Schwankung nur
    ausgleichen kann, wenn eine Übung einmal doppelt vorkommt. So bleibt
    Regelmäßigkeit der Normalfall und wird nur dort aufgegeben, wo sie eine
    Gruppe wirklich danebenliegen lässt.
    """
    schritt = GRAIN * weeks
    return GRAIN * (t // schritt), GRAIN * -(-t // schritt)


def spacing(row, weeks):
    """Wie ungleichmäßig liegen die Auftritte einer Übung über die Wochen?

    Die Schranke aus band() verhindert, dass eine Übung sich in einer Woche
    stapelt – nicht aber, dass ihre freien Wochen zusammenliegen. Pull-ups
    kommen auf 30 Sätze, also zehn Auftritte in 21 Wochen; ob dazwischen
    gleichmäßig zwei Wochen liegen oder einmal sechs, ist der Schranke egal
    und dem Muskel nicht.

    Gemessen wird an den Abständen zwischen den belegten Wochen, die Ränder
    mitgezählt. Die Summe ihrer Quadrate ist genau dann am kleinsten, wenn alle
    Abstände gleich groß sind – ein Loch von sechs Wochen wiegt schwerer als
    drei Löcher von zwei.
    """
    at = [w for w, v in enumerate(row) if v]
    if not at:
        return 0
    gaps = [at[0] + 1] + [b - a for a, b in zip(at, at[1:])] + [weeks - at[-1]]
    return sum(g * g for g in gaps)


def visits(sets):
    """Wie oft eine Übung in der Woche auftaucht: so selten wie möglich.

    Bei höchstens drei Sätzen je Auftritt sind das aufgerundet ein Drittel –
    sechs Sätze als 3+3, sieben schon als 3+2+2.
    """
    return -(-sets // PER_SET[1])


def miss(x, goal):
    """Abweichung einer Gruppe in dieser Woche.

    Mit Ziel zählt jede Richtung. Ohne Ziel zählt nur, was über die Obergrenze
    hinausgeht – unterhalb ist jeder Wert gleich recht, sonst zöge die Strafe
    eine ungezielte Gruppe unnötig an eine Zahl, die niemand gesetzt hat.
    """
    return abs(x - goal) if goal is not None else max(0, x - CAP_U)


def pen(week_vol, week_sets, goals, bands):
    """Strafe einer Woche.

    Gewogen wird **im Verhältnis zum Ziel der Gruppe**, nicht in Sätzen. Ein
    Satz zu wenig ist bei den Waden (Ziel 4) ein Viertel des Wochenpensums, bei
    der Brust (Ziel 10) ein Zehntel – dieselbe Zahl, ein ganz anderer Verlust.
    Vorher zählte die absolute Abweichung, und das bevorzugte systematisch die
    großen Gruppen: Der Suchlauf holte sich zehn Zehntel bei der Brust, indem
    er den Waden einen ganzen Satz nahm.

    Bezugsgröße ist REF – ein Ziel von zehn Sätzen. Bei genau dieser Gruppe
    rechnet die Strafe wie vorher, darunter strenger, darüber milder.

    Gruppen ohne Ziel haben kein Verhältnis; für sie zählt weiter nur, was über
    die Obergrenze hinausgeht, gemessen an der Obergrenze.

    Dazu kommt die Regelmäßigkeit: Jede Übung, die in dieser Woche aus ihrer
    Schranke fällt, kostet BAND – siehe band().
    """
    out = APP * sum(visits(c) for c in week_sets if c)
    out += BAND * sum(1 for c, (lo, hi) in zip(week_sets, bands) if not lo <= c <= hi)
    for x, goal in zip(week_vol, goals):
        d = miss(x, goal)
        rel = d / (goal if goal else CAP_U)
        out += (rel * REF) ** 4 + (HARD if rel >= MAX_REL else 0)
    return out


def spread(total, vol, weeks, rnd, restarts, rounds):
    """Plansummen auf die Wochen verteilen.

    Verschoben werden nur Sätze zwischen Wochen – die Plansummen bleiben
    unberührt, der Schnitt also zwangsläufig exakt. Zu holen ist dreierlei:
    möglichst wenige Auftritte, also kurze Einheiten, möglichst kleine
    Abweichungen, und dass jede Übung regelmäßig vorkommt statt gestapelt.
    Die ersten beiden ziehen in dieselbe Richtung, solange die Satzzahl einer
    Übung durch drei teilbar ist – sechs Sätze sind zwei Auftritte, sieben
    schon drei. Das dritte kostet manchmal etwas vom zweiten; was es kosten
    darf, steht in BAND.
    """
    rows_s = vol.s
    goals = [GOAL.get(m) for m in vol.groups]
    bands = [band(t, weeks) for t in total]
    if any(hi > PER_WEEK for _, hi in bands):
        sys.exit('Eine Übung braucht mehr Sätze pro Woche, als PER_SET zulässt – '
                 'PER_EX_WEEK und PER_SET passen nicht zusammen.')

    def fits(i, v):
        # Ein Schritt über die Schranke hinaus bleibt erlaubt; er kostet in
        # pen() BAND. Zwei nicht – das wäre kein Ausgleich mehr, sondern der
        # Stapel, den die Schranke verhindern soll.
        lo, hi = bands[i]
        return (max(0, lo - GRAIN) <= v <= min(PER_WEEK, hi + GRAIN)
                and v % GRAIN == 0)

    best = None
    for run in range(restarts):
        rows = start(total, weeks, rnd)
        vols = [[sum(rows[i][w] * rows_s[i][g] for i in range(len(rows)))
                 for g in range(len(vol.groups))] for w in range(weeks)]
        col = [[row[w] for row in rows] for w in range(weeks)]
        sq = [pen(vols[w], col[w], goals, bands) for w in range(weeks)]
        # Die Strafe für die Wochen steht in sq, die für die Abstände je Übung
        # in sp: Ein Zug verschiebt nur eine Übung, also ist auch nur deren
        # Abstandsstrafe neu zu rechnen.
        sp = [LUECKE * spacing(row, weeks) for row in rows]
        # Der erste Anlauf glüht gar nicht aus, sondern schleift die
        # gleichmäßige Startverteilung nur nach. Die ist oft schon fast
        # richtig – 8 Sätze Rudern in jeder der 20 Wochen etwa –, und
        # Ausglühen zerlegt sie zuverlässig, ohne zurückzufinden.
        temp = 0.0 if run == 0 else 3e5 * (1 + run % 4)

        def move(i, u, v, d):
            """d Sätze der Übung i von Woche u nach v; neue Strafen zurück."""
            rows[i][u] -= d
            rows[i][v] += d
            col[u][i] -= d
            col[v][i] += d
            for g, c in enumerate(rows_s[i]):
                if c:
                    vols[u][g] -= d * c
                    vols[v][g] += d * c
            return (pen(vols[u], col[u], goals, bands),
                    pen(vols[v], col[v], goals, bands),
                    LUECKE * spacing(rows[i], weeks))

        for _ in range(rounds):
            temp *= 0.99995
            i = rnd.randrange(len(rows))
            u, v = rnd.randrange(weeks), rnd.randrange(weeks)
            if u == v or not rows[i][u]:
                continue
            # Ein Schritt der Körnung. Größere Sprünge braucht es nicht: Die
            # Schranke aus band() ist nur einen Auftritt breit, jeder größere
            # Zug landet also außerhalb, und was mehrere Schritte weit liegt,
            # erreicht der Suchlauf über mehrere Züge.
            d = GRAIN
            if not fits(i, rows[i][u] - d) or not fits(i, rows[i][v] + d):
                continue
            su, sv, si = move(i, u, v, d)
            delta = su + sv + si - sq[u] - sq[v] - sp[i]
            if delta <= 0 or rnd.random() < pow(2.718, -delta / max(temp, 1e-9)):
                sq[u], sq[v], sp[i] = su, sv, si
            else:
                move(i, u, v, -d)

        # Nachschliff: strikt bergab, bis kein einzelner Zug mehr etwas
        # bringt. Nach einem Treffer wird weitergescannt statt von vorn
        # angefangen – sonst kostet jede Verbesserung einen vollen Durchlauf,
        # und das sind bei 17 Übungen und 20 Wochen 27 000 Züge.
        moving = True
        while moving:
            moving = False
            for i in range(len(rows)):
                for u in range(weeks):
                    if not rows[i][u]:
                        continue
                    for v in range(weeks):
                        if u == v:
                            continue
                        d = GRAIN
                        if not fits(i, rows[i][u] - d) or not fits(i, rows[i][v] + d):
                            continue
                        su, sv, si = move(i, u, v, d)
                        if su + sv + si < sq[u] + sq[v] + sp[i]:
                            sq[u], sq[v], sp[i] = su, sv, si
                            moving = True
                            if not rows[i][u]:
                                break
                            continue
                        move(i, u, v, -d)

        # Zwischen den Anläufen zählt dieselbe Rangfolge wie in pen(): erst
        # grobe Abweichungen, dann Auftritte, dann die volle Liste – alles im
        # Verhältnis zum Ziel der jeweiligen Gruppe, nicht in Sätzen. Die
        # Ausnahmen von der Schranke entscheiden zuletzt: Innerhalb eines
        # Anlaufs wiegt pen() sie schon gegen die Genauigkeit ab, hier sollen
        # sie eine bessere Verteilung nicht mehr überstimmen.
        auftritte = sum(visits(c) for w in col for c in w if c)
        alle = sorted((miss(x, g) / (g if g else CAP_U)
                       for v in vols for x, g in zip(v, goals)), reverse=True)
        hart = sum(1 for x in alle if x >= MAX_REL)
        aus = sum(1 for w in col for c, (lo, hi) in zip(w, bands) if not lo <= c <= hi)
        eng = sum(spacing(row, weeks) for row in rows)
        got = (hart, auftritte, alle, aus, eng)
        if best is None or got < best[0]:
            best = (got, [list(c) for c in col], (hart, auftritte, alle, aus))
    _, per_week, (hart, auftritte, alle, aus) = best
    return per_week, (hart, auftritte, alle[0], aus)


# ------------------------------------------------------------------ #
# Schritt 3: eine Woche auf ihre Einheiten aufteilen
# ------------------------------------------------------------------ #

def chunks(sets, rnd, sessions):
    """Sätze einer Übung auf möglichst wenige Auftritte verteilen.

    Wenige Auftritte heißt kurze Einheiten: sechs Sätze als 3+3 füllen zwei
    Zeilen, als 2+2+2 drei. Nur die kürzesten Zerlegungen kommen infrage.
    """
    lo, hi = PER_SET
    options = []
    for parts in range(1, sessions + 1):
        for combo in itertools.combinations_with_replacement(range(lo, hi + 1), parts):
            if sum(combo) == sets:
                options.append(list(combo))
        if options:
            break
    if not options:
        return None
    pick = list(rnd.choice(options))
    rnd.shuffle(pick)
    return pick


def sides(ids, shares, total, groups):
    """Zwei Hälften des Körpers, die sich keine Übung teilen.

    Der Ein-Tages-Abstand lässt sich nicht wegplanen – vier Termine in sieben
    Tagen erzwingen ihn. Er lässt sich aber auf zwei Hälften legen: die Einheit
    davor nimmt nur die eine, die danach nur die andere. Damit hat jede Gruppe
    mindestens REST_DAYS Tage, ohne dass eine Einheit leer ausgeht.

    Die Hälften werden nicht von Hand gesetzt, sondern gerechnet. Übungen, die
    eine direkte Gruppe teilen, müssen zusammenbleiben – daraus ergeben sich
    Blöcke (Ziehen, Drücken, Beine, Bauch, Waden). Von allen Aufteilungen
    dieser Blöcke gewinnt die, bei der beide Hälften gleich viele Sätze haben:
    sonst wird eine der beiden Einheiten zum Rumpf.
    """
    root = {i: i for i in ids}

    def find(x):
        while root[x] != x:
            root[x] = root[root[x]]
            x = root[x]
        return x

    for m in groups:
        hit = [i for i in ids if shares[i].get(m, 0) >= DIRECT]
        for i in hit[1:]:
            root[find(i)] = find(hit[0])
    block = {}
    for i, t in zip(ids, total):
        block.setdefault(find(i), []).append((i, t))

    keys = list(block)
    saetze = [sum(t for _, t in block[k]) for k in keys]
    ganz = sum(saetze)
    best = None
    for mask in range(1 << len(keys)):
        a = sum(s for i, s in enumerate(saetze) if mask >> i & 1)
        got = (abs(2 * a - ganz), mask)
        if best is None or got < best:
            best = got
    _, mask = best
    half = [set(), set()]
    for i, k in enumerate(keys):
        seite = half[0] if mask >> i & 1 else half[1]
        for ex, _ in block[k]:
            seite |= direct_groups(ex, shares)
    return [frozenset(h) for h in half], best[0]


def clash(slot, dset, direkt, tight, prev):
    """Verletzt die Übung in dieser Einheit die Erholungsbedingung?

    Geprüft wird gegen beide Nachbarn: die zu kurz davorliegende Einheit des
    Blocks und, für die erste Einheit, die letzte der Vorwoche.
    """
    for a, b in tight:
        if slot == a and direkt[b] & dset:
            return True
        if slot == b and direkt[a] & dset:
            return True
    return slot == 0 and bool(prev & dset)


# Ab wie vielen Tagen ohne Reiz eine Gruppe im Tagesaufteiler etwas kostet.
#
# Acht Tage, und die Zahl ist nicht gegriffen: Bei vier Terminen in sieben Tagen
# ist eine Woche der natürliche Takt, in dem jede Gruppe wiederkommt. Alles
# darunter zu bestrafen hieße, den Aufteiler gegen die Wochenverteilung
# arbeiten zu lassen – die entscheidet, *wie viel* eine Gruppe je Woche
# bekommt, und manche bekommen eben nur einen Auftritt. Was darüber liegt, ist
# dagegen immer ein Platzierungsfehler: Die Gruppe kam in beiden Wochen vor,
# nur ganz am Rand. Siehe split().
MAX_LUECKE = 8


def direct_groups(ex, shares):
    """Muskelgruppen, für die eine Übung *da* ist – Anteil ab DIRECT.

    Die Trennung ist grob, aber sie ist die, um die es bei der Erholung geht:
    drei Sätze Kniebeugen sind für den Oberschenkel etwas anderes als der
    Bauchanteil derselben Sätze.
    """
    return frozenset(m for m, s in shares[ex].items() if s >= DIRECT)


def split(week, ids, shares, groups, sessions, rnd, tries, used, geraet, tight=(), prev=frozenset(),
          roles=None, zuletzt=None, termine=()):
    """Aufteilung mit möglichst gleich langen und gleich gemischten Einheiten.

    `used` sind die bereits vergebenen Zusammenstellungen; eine Wiederholung
    wiegt schwerer als jede Unwucht, sonst gleichen sich zwei Wochen an.

    `geraet` ordnet jeder Übung ihr Gerät zu (oder nichts) – daraus ergibt sich,
    wie oft an einem Tag umgebaut werden muss.

    `roles` gibt je Einheit vor, welche Muskelgruppen sie direkt treffen darf –
    darüber laufen die beiden Hälften aus sides(). Nur die Einheiten an einem
    zu kurzen Übergang bekommen eine Rolle, die übrigen bleiben frei.
    `tight` sind Paare von Einheiten dieses Blocks, die weniger als REST_DAYS
    Tage auseinanderliegen, `prev` die direkt trainierten Gruppen der Einheit
    unmittelbar davor, falls auch dieser Abstand zu kurz ist – beides als
    Rückversicherung, damit die Bedingung auch dann hält, wenn WEEK oder die
    Abstände einmal anders stehen.

    `zuletzt` sagt, an welchem Tag jede Gruppe zuletzt direkt drankam – aus den
    Wochen davor –, `termine` sind die Tage dieses Blocks. Ohne beides sah diese
    Funktion immer nur ihre eigene Woche: Sie verteilte knappe Gruppen sauber
    auf verschiedene Tage und merkte nicht, wenn dabei eine Gruppe ans Ende der
    einen und ans Ende der nächsten Woche rutschte. Im neu gerechneten Cut-Plan
    standen so elf Tage zwischen zwei Reizen für die hintere Schulter, bei einem
    Wochenschnitt, der exakt auf dem Ziel lag.

    Zurück kommt (Einheiten, Konflikte): Konflikte > 0 heißt, dass sich die
    Bedingung in dieser Woche nicht einhalten ließ.
    """
    target_sets = sum(week) / sessions
    # Welche Gruppen sind in dieser Woche knapp? Bei höchstens sechs direkten
    # Sätzen sind das zwei Auftritte, und dann entscheidet die Platzierung
    # darüber, ob die Gruppe an einem oder an zwei Tagen drankommt. Bei Brust
    # oder Rücken mit drei Auftritten ergibt sich die Streuung von selbst –
    # dort auf frische Tage zu drängen, schiebt nur Sätze auf ohnehin volle
    # Tage und zieht die Einheiten auseinander (16 bis 22 Sätze statt 18 bis 20).
    direkt_woche = collections.Counter()
    for k, ex in enumerate(ids):
        if week[k]:
            for m in direct_groups(ex, shares):
                direkt_woche[m] += week[k]
    knapp = {m for m, n in direkt_woche.items() if n <= 6}
    target_vol = {m: sum(week[k] * shares[ids[k]].get(m, 0) for k in range(len(ids))) / sessions
                  for m in groups}
    best = None
    # Erst mit Erholungsbedingung; findet sich damit keine Aufteilung, wird sie
    # für diese Woche fallen gelassen statt den Plan scheitern zu lassen.
    for streng in (True, False):
        for _ in range(tries):
            day = [[] for _ in range(sessions)]
            direkt = [set() for _ in range(sessions)]
            ok = True
            for k in sorted(range(len(ids)), key=lambda x: -week[x]):
                if not week[k]:
                    continue
                part = chunks(week[k], rnd, sessions)
                if part is None:
                    ok = False
                    break
                dset = direct_groups(ids[k], shares)
                # Zuerst ein Tag, an dem eine *knappe* Gruppe dieser Übung
                # noch nicht direkt drankam, dann der leerste. Ohne den ersten
                # Teil landeten die beiden Wadenübungen regelmäßig am selben
                # Tag: Jede für sich sucht nur den leersten Platz, und dass die
                # andere dieselbe Gruppe trifft, sieht sie nicht. Als reines
                # Auswahlkriterium reichte das nicht – unter 900
                # Zufallsversuchen war oft kein einziger dabei, der es besser
                # machte. Für *alle* Gruppen zu gelten war dagegen zu viel des
                # Guten; siehe `knapp` oben.
                eng_dset = dset & knapp
                free = sorted(range(sessions),
                              key=lambda s: (len(eng_dset & direkt[s]), len(day[s]),
                                             sum(x[1] for x in day[s]), rnd.random()))
                if streng:
                    free = [s for s in free
                            if (roles is None or roles[s] is None or dset <= roles[s])
                            and not clash(s, dset, direkt, tight, prev)]
                if len(free) < len(part):
                    ok = False
                    break
                for slot, sets in zip(free, part):
                    day[slot].append((ids[k], sets))
                    direkt[slot] |= dset
            if not ok:
                continue
            load = [sum(s for _, s in d) for d in day]
            imbalance = max(abs(x - target_sets) for x in load)
            mix = 0.0
            for d in day:
                v = dict.fromkeys(groups, 0.0)
                for ex, sets in d:
                    for m, share in shares[ex].items():
                        v[m] += sets * share
                mix += sum((v[m] - target_vol[m]) ** 2 for m in groups)
            count = max(len(d) for d in day) - min(len(d) for d in day)
            shape = [frozenset(ex for ex, _ in d) for d in day]
            doppelt = sum(1 for s in shape if s in used) + (len(set(shape)) < len(shape))
            # Wie viele Übungen die Woche hat, steht schon fest; hier geht es nur
            # noch darum, dass keine Einheit die längste wird.
            laengste = max(len(d) for d in day)
            # Was zweimal in der Woche vorkommt, gehört auf zwei Tage. Zweimal
            # pro Woche schlägt einmal bei gleicher Satzzahl – und ohne dieses
            # Kriterium landeten beide Auftritte gern am selben Tag: die Waden
            # in acht von zwanzig Wochen, der Bauch in jeder. Gezählt werden
            # nur Gruppen, die überhaupt zwei Auftritte haben; eine Gruppe mit
            # einem einzigen Zweiersatz kann nicht auf zwei Tage.
            tage, auftritte = {}, collections.Counter()
            for slot, d in enumerate(day):
                for ex, _ in d:
                    for m in direct_groups(ex, shares):
                        tage.setdefault(m, set()).add(slot)
                        auftritte[m] += 1
            selten = sum(1 for m, slots in tage.items()
                         if len(slots) < 2 <= auftritte[m])
            # Und wie lange war es her? `tage` sagt, an welchen Tagen dieses
            # Blocks eine Gruppe drankommt; `zuletzt` sagt, wann sie davor zum
            # letzten Mal dran war. Gezählt werden die Tage über MAX_LUECKE
            # hinaus, aufsummiert über alle Gruppen – nicht die Zahl der
            # Verstöße: Eine Gruppe mit vierzehn Tagen Pause wiegt schwerer als
            # zwei mit neun, und genau so soll die Suche auch entscheiden.
            luecke = 0
            if zuletzt and termine:
                for m, slots in tage.items():
                    vorher = zuletzt.get(m)
                    if vorher is None:
                        continue
                    abstand = (termine[min(slots)] - vorher).days
                    luecke += max(0, abstand - MAX_LUECKE)
            # Wie viele Geräte je Tag aufgebaut werden müssen. Zwei Übungen an
            # derselben Stange sind ein Aufbau, verteilt auf zwei Tage sind es
            # zwei – bei gleichem Volumen.
            #
            # Die Stelle in der Reihenfolge ist mit Bedacht gewählt: hinter der
            # Länge der Einheiten. Weiter vorn holt der Rüstaufwand zwar mehr
            # heraus (2,23 statt 2,52 Geräte je Einheit), aber die Einheiten
            # laufen dann auseinander – 12 bis 21 Sätze statt 15 bis 18. Eine
            # Einheit, die anderthalbmal so lang ist wie die nächste, ist der
            # schlechtere Tausch: Umgebaut wird zwischendurch, gewartet wird die
            # ganze Zeit.
            ruest = sum(len({geraet[ex] for ex, _ in d if geraet.get(ex)}) for d in day)
            # Die Lücke steht hinter `selten` und vor der Länge der Einheiten:
            # Sie ist derselbe Fehler wie eine Gruppe, die zweimal am selben Tag
            # steht – nur über die Wochengrenze hinweg – und wiegt damit
            # schwerer als eine Einheit, die eine Übung länger ist.
            got = (doppelt, selten, luecke, laengste, imbalance, ruest, count, round(mix, 6))
            if best is None or got < best[0]:
                best = (got, day, direkt)
        if best is not None:
            break
    if best is None:
        sys.exit('Keine Aufteilung gefunden – PER_SET/PER_WEEK prüfen.')
    _, day, direkt = best
    konflikte = sum(len(direkt[a] & direkt[b]) for a, b in tight)
    konflikte += len(prev & direkt[0]) if prev else 0
    used.update(frozenset(ex for ex, _ in d) for d in day)
    return day, direkt, konflikte


# ------------------------------------------------------------------ #

def startpunkt(meta, shares, groups, ids, rnd):
    """Der ausgelieferte Plan als Startpunkt für die Wanderung – oder None.

    **Das ist ein Umweg, und er steht hier offen statt versteckt.** Der
    Generator liest seine eigene letzte Ausgabe. Schön ist das nicht; die
    Alternative war, dass er gar nichts mehr findet – siehe wandern() für die
    drei gemessenen Fehlversuche.

    Gefährlich ist es nicht, und zwar aus einem Grund, der nachprüfbar ist: Der
    Startpunkt wird nicht geglaubt, sondern gegen die *heutigen* Gleichungen
    gerechnet (totals(), `passt`). Stimmt er nicht mehr – weil ein Ziel, ein
    Muskelanteil oder die Wochenzahl sich geändert hat –, wird er verworfen und
    es läuft wieder die Tiefensuche. Der alte Plan kann also nichts
    hereinschmuggeln, was die Ziele von heute nicht hergeben.

    Was er *nicht* kann: eine Lösung finden, wo es noch keine gibt. Wer ein Ziel
    ändert, steht wieder vor der Suche, die beim Aufbau-Plan zehn Stunden ohne
    Fund lief. Das ist die offene Stelle; sie ist kleiner als vorher, aber sie
    ist da.
    """
    if not OUT.exists():
        return None
    try:
        alt = json.loads(OUT.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return None
    ist = collections.Counter()
    for e in alt.get('plan', []):
        for it in e.get('ex', []):
            ist[it['id']] += it.get('sets', 0)
    if not ist:
        return None

    # Die Notnagel-Übungen stehen im alten Plan noch drin (Cut: 39 Sätze
    # Rucksack-Curls, Oberkörper: 174 Sätze improvisiert). Ohne Räumung wäre der
    # Startpunkt für den verkleinerten Katalog keine Lösung, und die Wanderung
    # käme nie in Gang.
    verboten = {k for k in shares if meta[k].get('nurErsatz')} & set(ist)
    if not verboten:
        return dict(ist)
    voll = list(ids) + sorted(verboten)
    values = [0] + [v for v in range(PER_EX_WEEK[0] * WEEKS, PER_EX_WEEK[1] * WEEKS + 1)
                    if v % GRAIN == 0]
    for block in parts(voll, shares, groups):
        if not (set(block) & verboten):
            continue
        frei = freiraeumen(block, shares, WEEKS, values, rnd, ist, verboten)
        if frei is None:
            print('   Notnagel-Übungen lassen sich aus dem alten Plan nicht '
                  'herausrechnen – ohne Startpunkt weiter')
            return None
        summe = sum(ist[i] for i in block if i in verboten)
        print(f'   Startpunkt geräumt: {summe} Sätze improvisierter Übungen '
              f'auf richtige umgelegt')
        ist.update({i: frei[i] - ist[i] for i in block})
    return dict(ist)


def main():
    meta = json.loads(META.read_text(encoding='utf-8'))
    shares = {k: v['dbShares'] for k, v in meta.items()}
    BW_SHARES.update({k: v['bwShares'] for k, v in meta.items()})
    # `nurErsatz` haelt vier Uebungen aus den Plaenen heraus, und das ist keine
    # Feinheit, sondern eine Entscheidung, die bisher nur als Fliesstext in
    # tools/pruefung/plan-eingaben.json stand:
    #
    #     "Wer Baender und Stange hat, soll sie benutzen - eine Wasserflasche
    #      ist der Notnagel und nicht die bessere Uebung."
    #
    # Seitheben mit zwei Flaschen, Curls und Rudern mit einem Rucksack: Sie
    # stehen im Katalog, weil ohne Baender und Klimmzugstange sonst ganze
    # Muskelgruppen leer ausgingen (js/vorrat.js tauscht auf sie). Fuer den
    # *Plan* sind sie schlechter als das, was sie ersetzen - weniger Last,
    # unhandlicher Griff, kein sauberer Gewichtsschritt.
    #
    # Ungeschrieben hielt die Regel nicht. Beim Neulauf vom 17.09. wanderten
    # sie in die Plaene: 39 Saetze Rucksack-Curls neben 39 Saetzen SZ-Curls im
    # Cut, 174 Saetze improvisierte Uebungen im Oberkoerper. Aufgefallen ist es
    # nicht der Pruefung, sondern beim Training - "Wieso soll ich Rucksack
    # Curls statt normalen curls machen?". Bei gleichen Muskelanteilen sieht
    # der Generator keinen Unterschied; er kann ihn nicht sehen, wenn ihm
    # niemand einen nennt.
    ids = [k for k in shares if not meta[k].get('nurErsatz')]
    groups = sorted({m for sh in shares.values() for m in sh})
    # Reihenfolge in der Einheit. Vorher war es die Summe aller Muskelanteile –
    # eine Hilfsgröße, die meistens stimmte und manchmal daneben lag: der Hip
    # Thrust (1,50) landete hinter dem Reverse Fly (1,60), eine schwere
    # Hüftstreckung also hinter einer Schulter-Isolation. Jetzt steht die
    # Einordnung als `tier` in exercise-meta.json, und innerhalb einer Stufe
    # kommt zuerst, was auf die höchsten Wochenziele einzahlt – die Prioritäten
    # stehen damit an genau einer Stelle, in TARGET.
    def rang(ex):
        ziele = [TARGET.get(m) or 0 for m, v in shares[ex].items() if v >= DIRECT]
        return (meta[ex]['tier'], -max(ziele or [0]), -sum(shares[ex].values()), ex)

    # Ob ein Ziel exakt erreichbar ist, hängt an der Teilbarkeit: Der Rücken
    # kommt aus drei Übungen mit Anteil 1,0, seine Plansumme ist bei
    # Dreierschritten also ein Vielfaches von drei – und muss Ziel·Wochen
    # treffen. Früher stand hier eine feste Regel ("Wochenzahl gerade"). Die
    # galt für eine bestimmte Kombination aus Zielen und Anteilen und wurde
    # falsch, sobald sich eine davon änderte. Jetzt probiert der Lauf, statt zu
    # raten: die erste Wochenzahl ab WEEKS, für die alle Blöcke aufgehen.
    # Gerät je Übung – ohne Gewicht ist nichts aufzubauen (Klimmzüge stehen mit
    # 0 kg im Rucksack, Band und Bodyweight ohnehin).
    geraet = {k: (GERAET.get(v['equip']) if v['dbWeight'] else None) for k, v in meta.items()}
    rnd = random.Random(7)
    vol = Volume(shares, ids, groups)
    start = startpunkt(meta, shares, groups, ids, rnd)
    for weeks in range(WEEKS, WEEKS + 12):
        total, (variants, vollstaendig) = totals(ids, shares, groups, weeks, rnd,
                                                 streng=False, start=start)
        if total is not None:
            break
    else:
        sys.exit(f'Keine exakte Lösung zwischen {WEEKS} und {WEEKS + 11} Wochen – '
                 'Ziele oder Anteile passen nicht zur Körnung.')
    if weeks != WEEKS:
        print(f'Wochenzahl auf {weeks} erhöht – mit {WEEKS} geht das Ziel nicht exakt auf')
    day = dates(weeks)
    print(f'exakte Plansummen: {"·".join(map(str, variants))} Lösungen je Block, '
          f'ausgewogenste gewählt ({min(total)}–{max(total)} Sätze je Übung)')
    print('   Knoten in der exakten Suche: '
          + ' · '.join('Nullraum' if n is None
                       else f'{n:,}'.replace(',', '.') + ('' if ganz else ' (Budget!)')
                       for ganz, n in vollstaendig))
    if not all(ganz for ganz, _ in vollstaendig):
        # Nicht verschweigen: Die Auswahl hat dann nur einen Ausschnitt gesehen.
        # Wo das steht, steht auch, wie man mehr bekommt.
        print(f'   Budget {EXACT_NODES:,} Knoten erschöpft – mehr mit WK_NODES'.replace(',', '.'))

    per_week, (hart, auftritte, worst, aus) = spread(total, vol, weeks, rnd,
                                                     RESTARTS, SPREAD_ROUNDS)
    # Eine Abweichung über MAX_REL ist die eine Sache, die nicht vorkommen soll.
    # Bleibt nach dem ersten Anlauf eine stehen, wird weitergesucht statt sie
    # hinzunehmen: die Verteilung ist eine Suche, kein Beweis, und ein zweiter
    # Anlauf mit anderem Zufall findet sie oft doch. Erst nach mehreren
    # vergeblichen Versuchen gilt es als Eigenschaft der Plansummen.
    for _ in range(3):
        if not hart:
            break
        kandidat = spread(total, vol, weeks, rnd, RESTARTS, SPREAD_ROUNDS)
        if kandidat[1][0] < hart:
            per_week, (hart, auftritte, worst, aus) = kandidat
            print(f'   nochmal verteilt: {hart} Gruppenwochen über {MAX_REL:.0%}')
    print(f'auf {weeks} Wochen verteilt: {auftritte} Auftritte '
          f'({auftritte / (weeks * WEEK):.2f} Übungen je Einheit), '
          f'schlechteste Woche {worst:.0%} vom Ziel entfernt, '
          f'{hart} Gruppenwochen über {MAX_REL:.0%}, '
          f'{aus} Ausnahmen von der Wochenschranke')

    half, unwucht = sides(ids, shares, total, groups)
    print(f'Erholung: zwei Hälften mit {unwucht / 2 / weeks:+.1f} Sätzen Unterschied pro Woche – '
          f'[{", ".join(sorted(LABEL.get(m, m) for m in half[0]))}] gegen '
          f'[{", ".join(sorted(LABEL.get(m, m) for m in half[1]))}]')

    plan = []
    used = set()
    offen = 0            # Wochen, in denen die Erholungsbedingung nicht aufging
    prev = frozenset()   # direkt trainierte Gruppen der letzten Einheit davor
    # Wann jede Gruppe zuletzt direkt drankam. Ohne dieses Gedächtnis sieht der
    # Tagesaufteiler nur seine eigene Woche – siehe MAX_LUECKE und split().
    zuletzt = {}
    for k, w in enumerate(per_week):
        block = day[k * WEEK:(k + 1) * WEEK]
        # Welche Einheiten dieses Blocks liegen zu dicht beieinander? Bei vier
        # Terminen in sieben Tagen ist das genau einer – meist der Übergang zur
        # nächsten Woche, deshalb wird `prev` mitgeführt.
        tight = [(i, i + 1) for i in range(len(block) - 1)
                 if (block[i + 1] - block[i]).days < REST_DAYS]
        eng_am_anfang = k > 0 and (block[0] - day[k * WEEK - 1]).days < REST_DAYS
        eng_am_ende = k + 1 < len(per_week) and (day[(k + 1) * WEEK] - block[-1]).days < REST_DAYS
        # Nur die Einheiten an einem zu kurzen Übergang bekommen eine Hälfte
        # zugewiesen; die dazwischen bleiben frei und nehmen, was übrig ist.
        roles = [None] * WEEK
        if eng_am_ende:
            roles[-1] = half[0]
        if eng_am_anfang:
            roles[0] = half[1]
        for a, b in tight:
            roles[a], roles[b] = roles[a] or half[0], roles[b] or half[1]
        eng_prev = prev if eng_am_anfang else frozenset()
        sess_list, direkt, konflikte = split(w, ids, shares, groups, WEEK, rnd, SPLITS, used,
                                             geraet, tight, eng_prev, roles, zuletzt, block)
        # Ging es nicht auf, kostet ein zweiter Anlauf nur für diese eine Woche
        # ein paar Sekunden – und die Erholungsbedingung ist der Punkt, an dem
        # der ganze Plan hängt. Vorher fiel sie hier still weg: bei zehn Sätzen
        # je Gruppe fand die erste Runde immer eine Lösung, bei sechzehn in zwei
        # von zwanzig Wochen nicht mehr, und im Plan standen zwei Übergänge mit
        # derselben Gruppe an zwei Tagen hintereinander.
        for faktor in (8, 40):
            if not konflikte:
                break
            sess_list, direkt, konflikte = split(w, ids, shares, groups, WEEK, rnd,
                                                 SPLITS * faktor, used, geraet, tight, eng_prev,
                                                 roles, zuletzt, block)
        offen += 1 if konflikte else 0
        prev = frozenset(direkt[-1])
        for slot, gruppen_am_tag in enumerate(direkt):
            for m in gruppen_am_tag:
                zuletzt[m] = block[slot]
        for d, sess in zip(block, sess_list):
            sess.sort(key=lambda x: rang(x[0]))
            plan.append({'date': d.isoformat(), 'ex': [{'id': e, 'sets': s} for e, s in sess]})

    # ---- Bericht ----
    got = [vol.of(w) for w in per_week]
    print(f'{len(plan)} Einheiten in {weeks} Wochen ({day[0]} bis {day[-1]}), '
          f'{sum(total)} Sätze insgesamt')
    uniq = len({frozenset(e['id'] for e in s['ex']) for s in plan})
    print(f'{uniq} von {len(plan)} Einheiten verschieden, '
          f'{min(len(s["ex"]) for s in plan)}–{max(len(s["ex"]) for s in plan)} Übungen je Einheit, '
          f'{min(sum(e["sets"] for e in s["ex"]) for s in plan)}–'
          f'{max(sum(e["sets"] for e in s["ex"]) for s in plan)} Sätze je Einheit')

    # ---- Erholung: am fertigen Plan nachgemessen, nicht dem Verfahren geglaubt ----
    def direkt_am_tag(sess):
        out = set()
        for e in sess['ex']:
            out |= direct_groups(e['id'], shares)
        return out

    eng, doppelt = 0, []
    for i in range(len(plan) - 1):
        d1 = datetime.date.fromisoformat(plan[i]['date'])
        d2 = datetime.date.fromisoformat(plan[i + 1]['date'])
        if (d2 - d1).days >= REST_DAYS:
            continue
        eng += 1
        beide = direkt_am_tag(plan[i]) & direkt_am_tag(plan[i + 1])
        if beide:
            doppelt.append((plan[i]['date'], sorted(LABEL.get(m, m) for m in beide)))
    print(f'{eng} Übergänge unter {REST_DAYS} Tagen, davon {len(doppelt)} mit einer Gruppe '
          f'zweimal direkt{" (Wochen ohne Lösung: " + str(offen) + ")" if offen else ""}')
    for datum, ms in doppelt[:5]:
        print(f'   {datum} -> Folgetag: {", ".join(ms)}')
    print()

    print(f'{"Muskelgruppe":16s} {"Ziel":>5s} {"Schnitt":>9s} {"min":>6s} {"max":>6s}')
    for g, m in enumerate(groups):
        col = [v[g] / UNIT for v in got]
        ziel = TARGET.get(m)
        print(f'{LABEL.get(m, m):16s} {"–" if ziel is None else ziel:>5} '
              f'{sum(col) / weeks:9.4f} {min(col):6.2f} {max(col):6.2f}')
    for g, m in enumerate(groups):
        summe = sum(v[g] for v in got)
        if GOAL.get(m) is None:
            if summe > CAP_U * weeks:
                sys.exit(f'\nFEHLER: {LABEL.get(m, m)} über der Obergrenze von {CAP}.')
        elif summe != GOAL[m] * weeks:
            sys.exit(f'\nFEHLER: {LABEL.get(m, m)} trifft {TARGET[m]} nicht exakt.')
    gezielt = sum(1 for m in groups if GOAL.get(m) is not None)
    print(f'\nSchnitt exakt getroffen in {gezielt} von {len(groups)} Gruppen, '
          f'der Rest unter der Obergrenze von {CAP}.')

    # ---- Der Bodyweight-Modus bekommt seine eigene Satzzahl ---------------
    #
    # Bis hierher galt: Exakt ist der Plan für die Hantel-Fassung, und was der
    # Bodyweight-Modus danebenliegt, steht eben im Bericht. Das war eine
    # Kapitulation vor der falschen Größe – nicht die Anteile sind das
    # Problem, sondern dass die Satzzahl je Auftritt festgenagelt war. Siehe
    # bw_saetze().
    vorher = {}
    for i, n in zip(ids, total):
        for m, anteil in BW_SHARES.get(i, {}).items():
            vorher[m] = vorher.get(m, 0) + n * anteil
    alt = sorted(((vorher.get(m, 0) / weeks - TARGET[m], m) for m in groups
                  if GOAL.get(m) is not None), key=lambda x: -abs(x[0]))

    bw_total, bw_rest, bw_ganz = bw_saetze(plan, weeks)
    bw_verteilen(plan, bw_total)

    nachher = {}
    for i, n in bw_total.items():
        for m, anteil in BW_SHARES.get(i, {}).items():
            nachher[m] = nachher.get(m, 0) + n * anteil
    neu = sorted(((nachher.get(m, 0) / weeks - TARGET[m], m) for m in groups
                  if GOAL.get(m) is not None), key=lambda x: -abs(x[0]))
    # **Keine Einheit gibt einer Gruppe mehr, als ihr die ganze Woche zusteht.**
    #
    # Bewusst keine Dosis-Wirkungs-Regel – dafür ist die Datenlage zu dünn –,
    # sondern eine Absurditätsschranke, und sie kommt ohne neue Zahl aus: Die
    # Wochenobergrenze steht schon da. Schöpft ein einzelner Tag sie aus, ist
    # etwas grundsätzlich schiefgegangen.
    #
    # Gemessen wird in gewichtetem Volumen, derselben Währung wie die Ziele.
    # Die rohe Satzzahl taugt dafür nicht: Sie rechnet ein Drücken voll auf den
    # Trizeps und meldet elf Sätze, wo gewichtet 8,2 stehen.
    for feld, anteile in (('sets', shares), ('bwSets', BW_SHARES)):
        for e in plan:
            tag = collections.Counter()
            for it in e['ex']:
                for m, a in anteile.get(it['id'], {}).items():
                    tag[m] += it[feld] * a
            for m, x in tag.items():
                if x > CAP + 0.05:
                    sys.exit(f'\nFEHLER: {LABEL.get(m, m)} bekommt am {e["date"]} '
                             f'{x:.2f} Sätze ({feld}) – mehr als die Wochenobergrenze {CAP}.')

    anders = sum(1 for e in plan for it in e['ex'] if it['bwSets'] != it['sets'])
    gesamt_bw = sum(it['bwSets'] for e in plan for it in e['ex'])
    print(f'\nBodyweight-Modus: eigene Satzzahl, {anders} von '
          f'{sum(len(e["ex"]) for e in plan)} Auftritten weichen von drei ab, '
          f'{gesamt_bw} statt {sum(total)} Sätze.')
    print(f'  vorher: Summe der Quadrate {sum(d * d for d, _ in alt):.3f}'
          + (', am meisten ' + ', '.join(f'{LABEL.get(m, m)} {d:+.2f}'
                                         for d, m in alt[:3] if abs(d) > 0.005) if alt else ''))
    if bw_rest < 1e-9:
        print('  jetzt:  jedes Ziel exakt getroffen.')
    else:
        nennen = [f'{LABEL.get(m, m)} {d:+.2f}' for d, m in neu[:3] if abs(d) > 0.005]
        print(f'  jetzt:  Summe der Quadrate {sum(d * d for d, _ in neu):.3f}'
              + (', am meisten ' + ', '.join(nennen) if nennen
                 else ' – keine Gruppe weicht um mehr als 0,005 Sätze ab'))
        print('          ' + ('der Suchraum ist vollständig abgesucht – mit zwei bis vier '
                              'Sätzen je Auftritt gibt es hier keine exakte Lösung.'
                              if bw_ganz else
                              'die Suche brach am Knotenbudget ab; es könnte eine exakte '
                              'Lösung geben, die sie nicht gesehen hat.'))

    print(f'\n{"Übung":34s} {"Plan":>5s} {"je Woche":>9s}')
    for i, t in sorted(zip(ids, total), key=lambda x: -x[1]):
        print(f'{i:34s} {t:5d} {t / weeks:9.2f}')

    if '--report' in sys.argv:
        return
    # Die Ziele wandern mit: die App zeigt das Wochenvolumen gegen genau diese
    # Zahlen, und eine zweite Stelle, an der 10 steht, wäre eine Stelle zu viel.
    # Der Nacken bekommt seinen Ist-Wert als Ziel – ohne Ziel gäbe es dort
    # nichts anzuzeigen, und die Obergrenze ist keine Ansage. Zwei
    # Nachkommastellen sind dabei nicht gerundet, sondern exakt: der Wert ist
    # ein Vielfaches von 0,05.
    ziele = {m: TARGET[m] if TARGET.get(m) is not None
             else round(sum(v[groups.index(m)] for v in got) / weeks / UNIT, 4)
             for m in groups}
    # Welche davon Ziel sind und welche bloß Ergebnis, steht ausdrücklich dabei:
    # der Nacken lässt sich nicht setzen, und "exakt getroffen" darf für ihn
    # niemand behaupten – sein Wert ist, was aus den anderen Gleichungen fällt.
    ergebnis = sorted(m for m in groups if TARGET.get(m) is None)
    # Die Erholungsregel wandert ebenfalls mit: die App tauscht bei
    # Verletzungen Übungen aus und muss dabei dieselbe Schwelle einhalten wie
    # der Generator, sonst steht die Gruppe doch zweimal in 48 Stunden.
    OUT.write_text(json.dumps({'variante': VARIANTE,
                               'name': VARIANTEN[VARIANTE]['name'],
                               'target': ziele, 'derived': ergebnis, 'cap': CAP,
                               'rest': {'days': REST_DAYS, 'direct': DIRECT},
                               'plan': plan},
                              ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'\n{OUT.relative_to(ROOT)} geschrieben')


if __name__ == '__main__':
    main()
