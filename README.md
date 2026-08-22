# Workout

Trainings-App zum Plan aus `Workoutplan_mit_Bodyweight_Equivalent.xlsx` – mit
Umschalter zwischen **Hantel-Variante** und **reinem Bodyweight-Äquivalent**.

Statische Web-App: kein Build, keine Abhängigkeiten, keine Server-Anbindung.
`index.html` im Browser öffnen oder über GitHub Pages ausliefern. Alle
protokollierten Sätze liegen lokal im `localStorage` des Geräts.

## Tabs

| Tab | Inhalt |
| --- | --- |
| **Dashboard** | Startansicht: was heute ansteht, welche Muskelgruppen drankommen, Startknopf. Darunter drei Ebenen – Kurzliste, volle Übungsliste, Fokus-Ansicht während des Trainings. Mit ← und → durch die Einheiten blättern. |
| **Statistik** | Kennzahlen, nächste Einheit, **Gewichtsverlauf je Übung** und **Volumen je Muskelgruppe** als Verlaufskarten, meist trainierte Übungen. |
| **Mehr** | Standardmodus, „Modus je Workout merken“, verpasste Tage nachrücken, Plan-Verschiebung, Export/Import als JSON, Backup-Datei, Alles löschen. |

## Drei Ebenen

Die App zeigt beim Öffnen nur, was vor dem Training zählt, und wird erst
tiefer, wenn man es braucht:

1. **Startansicht** – eine Bildschirmseite ohne Scrollen: Datum und Umfang
   oben, darunter die Körperkarte über die volle Breite, die beanspruchten
   Gruppen als Marken, der Startknopf. Keine Übungsliste, keine Satz-Knöpfe:
   vor dem Training will man wissen, was kommt, nicht schon etwas abhaken.
   Kopf und Fuß nehmen sich, was sie brauchen, die Körperkarte bekommt den
   Rest – geprüft von 414 × 896 bis 360 × 740.
2. **Übungsliste** – die vollen Karten mit Gewicht, Satz-Knöpfen und Hinweisen.
   Erreichbar über *Übungen & Gewichte* oder aus dem laufenden Training.
3. **Fokus-Ansicht** – eine Übung groß, während trainiert wird.

### Körperkarte

`js/body.js` zeichnet Vorder- und Rückansicht **aus einem Skelett**, nicht aus
einzeln hingelegten Ovalen. Aus denselben Gelenkpunkten entstehen Silhouette
und Muskeln: die Gliedmaßen als zum Gelenk hin schmaler werdende Flächen, die
Muskeln als Spindeln entlang genau desselben Knochens. Dadurch sitzt der Bizeps
zwangsläufig auf dem Oberarm, und eine Änderung an den Proportionen zieht beides
zugleich nach. Rumpf, Brust, Rücken und Gesäß haben keine Knochenachse, die sie
beschreiben würde – die sind als Pfade gezeichnet.

Hervorheben ist nur eine Frage der Füllfarbe, ohne zweite Zeichnung darunter.
Eine dünne Trennlinie in Hintergrundfarbe hält benachbarte Bereiche
auseinander; ohne sie verschmelzen sie an einem Ganzkörpertag zu einem einzigen
orangen Fleck. Die Arme stehen leicht ab, sonst fallen Schulter und Brust
optisch zusammen. Kopf, Unterarme, Hände und Füße sind kein Trainingsziel und
bleiben neutral.

Welche Region eine Übung trifft, steht als `dbShares`/`bwShares` in
`tools/exercise-meta.json` – **als Anteil, nicht als Liste**: 1,0 heißt „dafür
ist die Übung da", 0,55 „arbeitet deutlich mit". Je Variante getrennt, weil sie
sich unterscheiden: Seitheben trifft nur die Schulter, sein
Bodyweight-Äquivalent Pike Push-ups zusätzlich den Trizeps.

Aus denselben Anteilen kommt beides – die Hervorhebung auf der Karte (der
größte Anteil zuerst) und die Volumenrechnung in `tools/build-plan.py`. Eine
Quelle, damit Karte und Plan nicht auseinanderlaufen können. Die Werte sind
Schätzungen aus gängiger Trainingslehre, keine Messwerte.

**Zwei Stufen statt einer.** Was eine Übung mit Anteil 1,0 trifft, leuchtet
voll; was nur mitarbeitet, bleibt gedämpft. Der Plan ist Ganzkörpertraining – wäre alles
gleich hell, würde die Karte an den meisten Tagen gar nichts mehr aussagen.
Die Marken darunter sind entsprechend sortiert, und das `aria-label` nennt
beide Stufen getrennt.

Die Bauchmuskeln sind in sechs Felder geteilt, nicht ein Block: die Kontur um
jede Fläche zeichnet das Muster von selbst.

## Bedienung während des Trainings

Zwischen zwei Sätzen soll die App so wenig Aufmerksamkeit wie möglich kosten:

* **Workout starten.** Der Knopf beginnt die Einheit und wechselt in die
  Fokus-Ansicht: eine Übung groß, mit vorgeführter Bewegung, Gewicht und
  Satz-Knöpfen. Sind alle Sätze abgehakt, rückt die App von selbst zur
  nächsten offenen Übung. Über *☰ Übersicht* geht es jederzeit zurück in die
  Liste, ohne das Training zu beenden. Der Start schaltet nebenbei den Ton frei
  – mobile Browser lassen ihn nur nach einer Berührung zu, und so sitzt schon
  das erste Pausensignal.
* **Ein Griff pro Satz.** Die Satz-Knöpfe liegen außerhalb des aufklappbaren
  Bereichs und sind 48 px hoch – Abhaken ohne Zielen, ohne vorher aufzuklappen.
* **Keine Wiederholungen eintragen.** Die stehen im Plan.
* **Ein Arbeitsgewicht je Übung**, vorbelegt mit einem Startwert (siehe unten).
  Änderbar durch Antippen der Zahl oder über **−** und **+**, die in 2,5-kg-
  Schritten gehen.
* **Zwei Wege aus dem Training.** *Abschließen* behält, was abgehakt ist – auch
  wenn nicht alles steht; der Knopf nennt den Stand mit. *Abbrechen* verwirft
  die Einheit ganz, sie gilt dann als nicht trainiert und der Plan behandelt
  den Tag wie einen verpassten. Verworfen wird alles zu diesem Workout in
  dieser Variante, nicht nur die Sätze von heute – deshalb steht die Zahl in
  der Rückfrage.
* **Pausentimer.** Startet automatisch beim Abhaken und meldet sich am Ende mit
  Ton und Vibration. Nach dem letzten Satz einer Übung läuft bewusst keiner.
  Während der Pause um 30 s verlängerbar oder vorzeitig beendbar.

### Bewegungsabläufe

`js/figure.js` zeichnet eine **drehbare 3D-Figur**. Eine Stellung hält nur
Gelenkwinkel, das Skelett rechnet `solve()` daraus. Das ist nicht bloß kürzer
als feste Punkte, sondern hält die Figur anatomisch beisammen: ein Knie kann
nicht neben der Hüfte landen, und dieselbe Stellung stimmt aus jedem
Blickwinkel. Waagerechtes Ziehen dreht um die Hochachse.

Gezeichnet wird mit schwacher Perspektive und Maleralgorithmus – was hinten
liegt, kommt zuerst.

**Der Körper hat Volumen.** Der Rumpf ist kein Viereck zwischen Schultern und
Hüften mehr – das war von der Seite papierdünn und hatte keine Taille –, sondern
ein Körper aus drei Ringen (Schulter, Taille, Becken) mit je vier Ecken.
Gliedmaßen sind Flächen statt Striche, zum Gelenk hin schmaler, jede ein
einzelner Pfad mit halbrunden Enden. Dazu Hals, Hände und ein Kopf als Ei entlang
der Rumpfachse.

Zwei Kleinigkeiten, die den Unterschied machen: **Tiefe als Helligkeit** – was
hinten liegt, wird etwas dunkler, denn der Maleralgorithmus sagt nur, was
verdeckt ist, nicht, was weiter weg ist. Und eine **Trennlinie** in
Hintergrundfarbe um jede Gliedmaße; ohne sie lag in der tiefen Hocke alles als
ein einziger Klumpen übereinander. Der Rumpf bleibt ohne, seine Flächen gehören
zusammen.

**Frei drehbar in alle Richtungen:** waagerechtes Ziehen um die Hochachse,
senkrechtes um die Querachse, beides unbegrenzt und über volle Umdrehungen
hinaus. Auch der Boden liegt als Fläche im Raum und kippt mit – ein Strich am
unteren Rand sah aus wie ein Schieberegler.

Vorzeichen: `+lean` neigt den Rumpf **nach vorn**, und der Arm dreht mit dem
Rumpf mit (`-arm.p + lean`). Beides war zeitweise verdreht, wodurch die Figur
sich nach hinten lehnte und die Stellungen mühsam darum herumgebogen waren.

**Liegende Übungen liegen wirklich.** Vorher wurde die stehende Figur mit zwei
Winkeln (`roll`/`tilt`) so lange schräg gedreht, bis sie aus *einem* bestimmten
Blickwinkel lag – aus jedem anderen sah sie umgekippt aus, und die Gelenkwinkel
waren nur noch Ausgleich für diese Schieflage. Jetzt gibt `lie: 'supine'` oder
`'prone'` eine echte Lage vor: die Längsachse zeigt nach links (Kopf links, Füße
rechts), der Bauch nach oben oder nach unten. Die Gelenkwinkel bedeuten damit
wieder das, was ihr Name sagt – bei Rückenlage hebt `arm.p = 90` den Arm senkrecht
nach oben, bei Bauchlage stellt er ihn senkrecht auf den Boden.

`tilt` neigt die ganze liegende Figur: positiv hebt es das Fußende (die Brücke
beim Hip Thrust), negativ senkt es sie, bis beim Liegestütz Hände und Zehen
zugleich den Boden berühren.

Beim **Klimmzug** schwingt die Schulter weit: unten zeigt der Oberarm nach
oben (`arm.p` knapp über 180, damit die Arme leicht nach hinten greifen und der
Kopf davor sichtbar bleibt), oben nach unten-vorn, mit dem Ellenbogen am Rumpf.
Bleibt `arm.p` oben nahe 180, steht der Ellenbogen über der Schulter ab wie ein
Flügel, und der Kopf kommt nie über die Stange.

**Wer eine Stange greift, hält sie fest.** Mit `anchor: 'bar'` sitzt nicht der
Körper auf dem Boden, sondern die Hände liegen auf einer festen Stange in Höhe
`barY`, und der Körper bewegt sich dagegen – bei Klimmzügen, Inverted Rows und
Trizeps an der Stange. Andersherum wanderte die Stange mit den Händen mit, und
das fällt sofort als Fehler auf. Damit dabei die Füße stehen bleiben, ändern
diese Muster ihre Neigung zwischen den Stellungen: der Körper dreht sich um die
Fersen, statt sich als Ganzes zu verschieben.

**Der Ausschnitt passt sich der Bewegung an**, einmal je Muster aus beiden
Endstellungen gerechnet. Eine feste Größe ließ liegende Übungen klein in einem
halbleeren Kasten stehen; ein Maß je Einzelbild würde die Figur beim Abspielen
atmen lassen. Gemessen wird ein Radius, kein Rechteck – sonst änderte schon das
Drehen die Größe. Das Sichtfeld übernimmt zudem die Form des Kastens; bei festem
Quadrat blieb links und rechts breiter Rand ungenutzt.

Beim Wadenheben steigt der Körper, die **Zehen bleiben liegen**. Wird alles
zusammen angehoben, wandert bloß die ganze Figur nach oben und die Bewegung ist
unsichtbar.

**Das Tempo einer Wiederholung ist unsymmetrisch.** Hin und zurück gleich
schnell sieht aus wie ein Pendel, nicht wie Training: echte Wiederholungen
gehen zügig in die Anstrengung, halten dort kurz und kommen deutlich langsamer
zurück – so steht es auch in den Hinweisen („3 Sekunden kontrolliert
ablassen"). Welche der beiden Endstellungen die anstrengende ist, hängt von der
Übung ab: beim Curl ist Stellung 1 oben, bei der Kniebeuge unten. Die Muster in
`LOWER_TO_1` laufen deshalb andersherum.

Ist im System *reduzierte Bewegung* eingestellt, steht die Figur still – aber in
einer mittleren Stellung, sonst sähe man von der Übung nichts. Drehen geht
weiterhin.

Die 23 Muster sind nach **Bewegungsart** benannt, nicht nach Übung. Zugeordnet
wird je Variante über `dbPattern`/`bwPattern` in `tools/exercise-meta.json` –
und zwar **getrennt**, denn oft ist die Bodyweight-Variante eine ganz andere
Bewegung als die mit Hanteln:

| Hanteln | Bodyweight |
| --- | --- |
| Einarmiges KH-Rudern (`row`) | Inverted Rows unter der Stange (`invrow`) |
| Liegende Trizepsstrecker (`triceps`) | Trizeps an niedriger Stange (`tricepsbar`) |
| Reverse Fly vorgebeugt (`reversefly`) | Reverse Snow Angels in Bauchlage (`snowangel`) |
| Goblet Squat (`squat`) | Kniebeuge mit vorgestreckten Armen (`squatbw`) |
| Hip Thrust beidbeinig (`thrust`) | einbeinig (`thrust1`) |

Der Goblet Squat ist das feinste Beispiel: ohne Hantel greifen die Hände nichts,
und mit der geerbten Goblet-Haltung sah es aus, als hielte die Figur eine
unsichtbare Hantel vor der Brust.

Auch innerhalb einer Variante zählt der Unterschied: einbeinige Übungen haben
eigene Muster (`legcurl1`, `calf1`), das Wadenheben mit gebeugtem Knie ebenso
(`calfbent`), und bei den Füße-erhöhten Liegestützen (`pushupfeet`) steht ein
Kasten unter den Füßen – sonst wäre nicht zu sehen, dass sie erhöht sind.

Wo eine Übung im Sitzen ausgeführt wird, setzt `seat: true` eine Bank unter die
Figur – Sitzfläche mit Vorderkante und vier Beinen, damit sie beim Drehen von
allen Seiten eine Bank bleibt und von vorn nicht zum Strich wird. Nur angewinkelte
Beine ohne Bank sähen aus, als säße die Figur in der Luft.

**Das Gerät steht ausdrücklich in `tools/exercise-meta.json`** (Feld `equip`):
`dumbbells` je eine Kurzhantel pro Hand, `onehand` eine in einer Hand,
`goblet` eine senkrecht vor der Brust, `barbell` eine Stange über beide Hände,
`hipbar` eine quer über dem Becken, `plate` eine Scheibe vor der Brust,
`backplate` eine auf dem Rücken, `null` kein Gerät. Vorher wurde es aus `weightNote` erraten – „eine Hantel" trifft aber
sowohl auf den Goblet Squat zu (beidhändig vor der Brust) als auch aufs
Wadenheben (einhändig neben dem Körper), und die Figur hielt dann das Falsche.

Gezeichnet wird das Gerät entlang der Achsen des Skeletts selbst
(Schulterachse, Rumpfachse), nicht entlang der Bildschirmachsen – so bleibt es
beim Drehen in der Hand statt daneben zu schweben.

Wo beide Hände dasselbe Gerät fassen, dreht `arm.i` den Unterarm zur
Körpermitte; ohne das griffen die Hände schulterbreit ins Leere und die Hantel
schwebte dazwischen.

Bewusst keine fremden Bilder: Übungs-GIFs sind fast durchweg urheberrechtlich
geschützt, und ein zugekaufter Fremdstil neben eigenen Zeichnungen wirkt
zusammengestückelt. Alles aus einer Hand bleibt einheitlich und offline
lauffähig.

### Gewichte und Progression

**Steigerungsvorschlag statt Gedächtnis.** Wer zwei Einheiten in Folge alle
Sätze einer Übung mit demselben Gewicht durchzieht, bekommt einen Knopf
angeboten: *„2× alles geschafft · auf 22,5 kg?"*. Ein Tipp übernimmt es fürs
nächste Mal. Bewusst nur ein Vorschlag – ob die Wiederholungen sauber waren,
weiß die App nicht. Gezählt werden nur Hantel-Einheiten und nur solche, in
denen wirklich alle Sätze stehen; eine abgebrochene Einheit beendet die Serie.

`tools/exercise-meta.json` hält je Übung ein Startgewicht (`dbWeight`) und
einen Hinweis, wie es gemeint ist (`weightNote`: „je Hand", „eine Hantel",
„Zusatzgewicht", „Stange gesamt"). Übungen ohne Zusatzlast – Chin-ups, Sliding
Leg Curls, Füße-erhöhte Liegestütze – tragen dort `null` und zeigen gar keine
Gewichtszeile.

Die Startwerte sind Schätzungen für einen durchschnittlich trainierten
Erwachsenen, kein Messwert. Sie sind als Ausgangspunkt gedacht und werden vom
eigenen Wert überschrieben, sobald einer gesetzt ist.

**Das „+" wirkt ab dem nächsten Mal.** Sobald in einer Einheit der erste Satz
steht, ist deren Gewicht festgeschrieben: Beim Abhaken wird der benutzte Wert
in den Satz geschrieben, und die Karte zeigt weiter ihn. Eine Erhöhung landet
dann sichtbar als „Nächstes Mal: 22,5 kg" – die laufende Einheit wird nicht
rückwirkend umgeschrieben.

### Pausenlängen

Statt einer festen Länge bekommt jede Übung die, die zu ihrer Belastung passt
(`dbRest`/`bwRest` je Variante, an ACSM/NSCA-Richtwerten orientiert):

| Art | Pause | Beispiel |
| --- | --- | --- |
| mehrgelenkig schwer | 2:30 | Goblet Squat, Chin-ups |
| mehrgelenkig mittel | 2:00 | Floor Press, KH-Rudern, Hip Thrust |
| Beinbeuger | 1:30 | Sliding Leg Curl |
| größere Isolation | 1:15 | Trizepsstrecker, SZ-Curls |
| kleine Isolation, Waden | 1:00 | Seitheben, Reverse Fly, Wadenheben |
| Bauch | 0:45 | Crunches |

Die Bodyweight-Varianten weichen dort ab, wo sie einen anderen Charakter haben
– Pike Push-ups sind mehrgelenkig und bekommen 2:00, wo das Seitheben 1:00
hätte. Über *Mehr* lässt sich stattdessen eine feste Länge wählen oder die
Pause ganz abschalten.

Der Ton wird per Web Audio erzeugt, nicht als Datei geladen – das hält die App
offline-tauglich. Weil mobile Browser Ton nur nach einer Berührung zulassen,
entsteht der AudioContext beim ersten Abhaken. Während einer Pause hält die App
zusätzlich das Display wach (`navigator.wakeLock`), sonst friert der Browser die
Seite ein und das Signal käme zu spät.

Gespeichert wird der **Endzeitpunkt** der Pause, nicht die Restdauer. Dadurch
stimmt die Anzeige auch, wenn das Handy zwischendurch gesperrt war, und eine
laufende Pause übersteht sogar einen Neustart der Seite.

Da Wiederholungen nicht mehr erfasst werden, rechnet die Statistik mit dem
geplanten Wert – der unteren Grenze des Bereichs, also eher zu niedrig als zu
hoch. Die betroffenen Kennzahlen sind entsprechend als „ca." und „geplant"
ausgewiesen.

### Verlaufskarten

Die Statistik zeigt Gewicht je Übung und Volumen je Muskelgruppe über die Zeit
als **Small Multiples** – eine kleine Karte je Reihe statt eines Diagramms mit
vielen Linien. Bei zwölf Muskelgruppen wären zwölf Farben nicht mehr
auseinanderzuhalten, für Farbfehlsichtige schon gar nicht. Eine Karte je Reihe
braucht dagegen nur eine Farbe, und die Überschrift ersetzt die Legende.

Je Karte: Fläche als 10-%-Hauch, Linie 2 px, Endpunkt als Punkt mit Ring in der
Untergrundfarbe. Beschriftet wird nur der Endwert – eine Zahl an jedem Punkt
liest niemand. Ziehen über die Karte zeigt den Wert des jeweiligen Tages, die
vollständige Reihe steht im `aria-label`.

Volumen = Gewicht × geplante Wiederholungen × abgehakte Sätze. Nur
Hantel-Einheiten tragen Kilo bei; Bodyweight-Einheiten haben kein Gewicht, das
sich sinnvoll summieren ließe, und erscheinen deshalb nicht in dieser Rechnung.

## Wochenvolumen je Muskelgruppe

Ziel sind **10 Sätze pro Woche und Muskelgruppe**, Anteile eingerechnet – und
über den ganzen Plan im Schnitt **exakt** 10,0000, nicht ungefähr. Eine Woche
sind hier drei aufeinanderfolgende Einheiten; der Plan trainiert alle zwei bis
drei Tage, drei Einheiten decken also gut sieben Tage ab.

| | Excel, im Mittel | jetzt, Schnitt | jetzt, einzelne Woche |
| --- | --- | --- | --- |
| Oberschenkel, Brust, Rücken, Waden | 9,7–11,1 | **10,0000** | immer genau 10,0 |
| Nacken | 1,5 | **10,0000** | 9,8–10,4 |
| hintere Schulter | **0,5** | **10,0000** | 9,5–10,5 |
| Bizeps | 7,3 | **10,0000** | 9,3–10,5 |
| Bauch | 7,8 | **10,0000** | 9,4–10,4 |
| Schultern, Trizeps, Beinbeuger | | **10,0000** | 9,3–10,7 |
| Gesäß | | **10,0000** | 9,4–11,0 |

**Die Zahl der Wochen muss gerade sein.** Das ist keine Feinheit, sondern der
Grund, warum der Plan von 57 auf 60 Einheiten gewachsen ist. Der Rücken kommt
nur aus Rudern und Chin-ups, beide mit Anteil 1,0 – seine Plansumme ist also
immer eine ganze Zahl und trifft 10·W genau. Die hintere Schulter hängt an
denselben zwei Übungen (0,35 und 0,15) plus Reverse Fly:

    hintere Schulter = 1,5·W + 0,2·Rudern + ReverseFly

Für 10·W bräuchte es ReverseFly = 8,5·W − 0,2·Rudern. Bei ungeradem W endet
8,5·W auf ,5, und 0,2·Rudern kann nur auf ,0 ,2 ,4 ,6 oder ,8 enden – das geht
nie auf. Mit 19 Wochen ist exakt 10 also nicht knapp verfehlt, sondern
unmöglich; mit 20 Wochen geht es, sobald Rudern durch 20 teilbar ist. Die drei
Zusatztermine setzen den Rhythmus der Excel fort (alle zwei bis drei Tage), der
Plan endet jetzt am 12.01.2027 statt am 04.01.

`tools/build-plan.py` rechnet in drei Schritten:

1. **Plansummen.** Wie viele Sätze bekommt jede Übung über den ganzen Plan?
   Das ist ein Gleichungssystem mit zwölf Zeilen und siebzehn Unbekannten,
   gelöst per Tiefensuche: steht in einer Gleichung nur noch eine Übung offen,
   ist ihr Wert bestimmt; stehen mehrere offen, muss der Rest durch den größten
   gemeinsamen Teiler ihrer Anteile teilbar sein. Das schneidet den Suchbaum so
   früh ab, dass alle Lösungen in unter einer Sekunde dastehen. Zufallssuche
   findet hier übrigens *nichts* – die exakten Punkte liegen zu dünn.
2. **Verteilung auf die Wochen.** Die Summen stehen fest, verschoben werden nur
   Sätze zwischen Wochen. Der Schnitt bleibt damit zwangsläufig exakt; gesucht
   wird die Verteilung mit der besten schlechtesten Woche.
3. **Aufteilung auf die Einheiten.** Zwei bis vier Sätze je Auftritt, ein bis
   drei Auftritte je Woche, alle drei Einheiten etwa gleich lang.

Gerechnet wird durchweg in Zwanzigsteln eines Satzes – alle Anteile sind
Vielfache von 0,05, damit ist „exakt" wirklich exakt und nicht bis auf
Rundungsfehler.

**Was die Exaktheit kostet.** Die Gleichungen lassen weniger Spielraum, als man
denkt, und drei Dinge fallen dabei ab:

- **Der Hip Thrust muss rein, aber nur mit 10 Sätzen im ganzen Plan.** Ohne ihn
  ist das Gesäß nicht auf 10 zu bringen (Kniebeugen und Beinbeuger liefern
  zusammen zu wenig), mit mehr als einem halben Satz pro Woche liegt es
  darüber. In den fünf Wochen, in denen er auftaucht, geht das Gesäß auf 11,0 –
  das ist die schlechteste Woche im ganzen Plan und rechnerisch nicht zu
  unterbieten.
- **Rudern 9 Sätze pro Woche, Chin-ups 1.** Das Seitheben ist über den Nacken
  an Rudern gekoppelt, und was dann noch an Schulter fehlt, müssen die
  Brustübungen liefern – daraus folgt zwingend Rudern ≥ 7,5 pro Woche. Ein
  ausgeglicheneres Zug-Verhältnis gibt es in keiner der sechzehn Lösungen.
- **Füße-erhöhte Liegestütze 1 Satz pro Woche.** Aus derselben Gleichung.

Von allen exakten Lösungen wird die ausgewogenste genommen: keine Übung fällt
ganz heraus, und die Streuung der Satzzahlen ist so klein wie möglich. Zum
Vergleich: die vorige Fassung ohne Exaktheitsforderung hielt jede Woche in
9,7–10,3, traf den Schnitt aber nur ungefähr. Wer das lieber hat, nimmt sie aus
der Versionsgeschichte zurück – exakt im Schnitt und eng in jeder Woche geht
nicht beides.

**Die Abwechslung bleibt vollständig:** 60 verschiedene Zusammenstellungen bei
60 Einheiten, 8–10 Übungen und 24–25 Sätze je Einheit.

`tools/build-data.py` übernimmt die Auswahl je Tag aus `tools/plan.json`;
Namen, Wiederholungen und die Bodyweight-Äquivalente kommen unverändert aus der
Excel. Der Plan darf dabei über das Excel-Ende hinausgehen – die Zusatztermine
stehen dann in `plan.json`. `tools/plan.json` löschen und neu generieren stellt
den Originalplan wieder her.

Im Bodyweight-Modus liegen Rücken (13,4) und Trizeps (13,0) höher, Brust,
Nacken und Schulter leicht: die Äquivalente von SZ-Curls und Seitheben sind
enge Chin-ups und Pike Push-ups, die beide zusätzlich mitarbeiten. Die übrigen
acht Gruppen treffen auch dort exakt 10. Nach unten weicht nichts ab.

## Sicherung

Alles liegt im `localStorage` genau eines Browsers. Android räumt den bei
Platzmangel weg, und „Websitedaten löschen" reicht ebenfalls – ein halbes Jahr
Training wäre weg. Deshalb erinnert die Startansicht nach acht erledigten
Einheiten daran und bietet die Sicherung direkt an; in *Mehr* steht, wann
zuletzt gesichert wurde.

## Wenn der Plan durch ist

Nach der letzten von 60 Einheiten bietet die Startansicht *Von vorn beginnen*
an. Der bisherige Verlauf wandert in `rounds` und bleibt im Export erhalten,
die **Gewichte bleiben stehen** – Runde zwei startet also auf dem erreichten
Stand. Workout 1 rückt auf heute, sonst würde die Nachrück-Automatik den
halben Plan verschieben, weil das Originaldatum längst vorbei ist.

## Zurück-Taste

Auf Android verließ die Zurück-Taste sonst gleich die ganze App, auch aus der
Fokus-Ansicht heraus. Statt jeden Knopf einzeln anzufassen, vergleicht
`render()` die sichtbare Ebene mit der zuletzt abgelegten – ändert sie sich,
kommt ein Eintrag in den Verlauf. Einen Satz abhaken ändert die Ebene nicht und
legt deshalb auch nichts ab.

## Verpasste Tage

Ist ein Trainingstag vorbei, ohne dass an der Einheit irgendetwas eingetragen
oder abgehakt wurde, gilt sie als nicht stattgefunden – und **der gesamte
Restplan rückt um so viele Tage nach hinten**, bis sie wieder auf heute fällt.
Die Abstände zwischen den Einheiten bleiben dabei unverändert; aus einer Pause
von drei Tagen wird also kein gedrängter Nachholplan.

Zwei Punkte, die dabei absichtlich so geregelt sind:

* **Die Historie wandert nicht mit.** Sobald an einer Einheit etwas erfasst
  wurde, merkt sich die App den Tag, an dem das passiert ist. Dieses Datum
  bleibt stehen, auch wenn der Plan später weiterrückt.
* **Angefangen zählt als trainiert.** Nachgerückt wird nur, wenn zu der Einheit
  gar nichts vorliegt – weder ein Haken noch ein eingetragenes Gewicht. Wer
  Sätze notiert, aber das Abhaken vergisst, verliert seinen Platz im Plan nicht.

Nachgerechnet wird beim Öffnen der App und beim Zurückkehren aus dem
Hintergrund, damit auch eine über Mitternacht offene App den richtigen Tag
zeigt. Unter **Mehr** lässt sich die Automatik abschalten, die aktuelle
Verschiebung ablesen, tageweise korrigieren oder auf die Original-Termine aus
der Excel zurücksetzen.

## Die zwei Modi

Der Umschalter oben rechts wechselt die angezeigte Variante. Die Satzzahl bleibt
in beiden Modi identisch, nur Übung und Wiederholungsbereich ändern sich – ohne
Zusatzlast wird über mehr Wiederholungen, langsameres Tempo oder eine einbeinige
Ausführung nachgeschärft.

Beide Varianten werden **getrennt** protokolliert: Wer ein Workout mit Hanteln
beginnt und auf Bodyweight umschaltet, verliert die Einträge nicht.

Ist „Modus je Workout merken“ aktiv (Standard), behält eine einmal bearbeitete
Einheit ihren Modus, auch wenn global umgeschaltet wird.

## Übungszuordnung

| Hanteln | Bodyweight-Äquivalent |
| --- | --- |
| Goblet Squat | 1½-Wdh. Bodyweight Squat |
| Fersenerhöhter Goblet Squat | Fersenerhöhter 1½-Wdh. Bodyweight Squat |
| Sliding Leg Curl | Sliding Leg Curl |
| Einbeiniger Sliding Leg Curl | Einbeiniger Sliding Leg Curl |
| Hip Thrust | Einbeiniger Hip Thrust |
| Gewichtete Liegestütze | Langsame Liegestütze (3 s ablassen) |
| Füße-erhöhte Liegestütze | Füße-erhöhte Liegestütze |
| Floor Press | Liegestütze |
| Einarmiges KH-Rudern | Inverted Rows an sicherer niedriger Stange |
| Chin-ups | Chin-ups |
| Reverse Fly | Prone Reverse Fly / Reverse Snow Angels |
| Sitzendes Seitheben | Pike Push-ups |
| Liegende Trizepsstrecker | Bodyweight Trizeps Extensions an niedriger Stange |
| SZ-Curls | Enge supinierte Chin-ups |
| Gewichtete Crunches | Crunches |
| Einbeiniges stehendes Wadenheben | Einbeiniges Wadenheben |
| Wadenheben gebeugtes Knie | Wadenheben mit gebeugtem Knie |

## Aufbau

```
index.html              Grundgerüst, Topbar mit Modus-Umschalter, Tabbar
css/styles.css          Styling (dunkel, mobil zuerst)
js/data.js              Aus der Excel generiert: 17 Übungen + 60 Einheiten
js/dates.js             Datums-Hilfsfunktionen
js/store.js             Zustand und localStorage-Persistenz
js/app.js               Rendering der fünf Tabs und Event-Handling
js/figure.js            Animierte Bewegungsabläufe (14 Muster)
js/body.js              Körperkarte mit den beanspruchten Muskelgruppen
js/chart.js             Verlaufskarten für die Statistik
sw.js                   Service Worker für den Offline-Betrieb
manifest.webmanifest    Installierbar als App auf dem Homescreen
data/…xlsx              Quelle des Plans
tools/build-data.py     Generator: Excel + Hinweise -> js/data.js
tools/exercise-meta.json  Muskelgruppe, Equipment und Ausführungshinweise je Übung
tools/build-single.py   Bündelt alles zu dist/workout.html
dist/workout.html       Erzeugt: die App als eine portable Datei
```

`js/data.js` ist generiert und wird nicht von Hand editiert. Planänderungen
gehören in die Excel, Textänderungen an Hinweisen in `tools/exercise-meta.json`.
Danach neu erzeugen (nur Standardbibliothek, keine Installation nötig):

```bash
python3 tools/build-data.py
```

Der Generator bricht ab, wenn eine Zeile nicht dem Muster `3× Übung (8–12)`
folgt, wenn Hantel- und Bodyweight-Spalte unterschiedlich viele Übungen haben
oder wenn zu einer Übung der Eintrag in `exercise-meta.json` fehlt.

## Aufs Handy bekommen

**Als GitHub Page.** In den Repo-Einstellungen unter *Pages* als Quelle diesen
Branch und den Ordner `/ (root)` wählen. Die App liegt dann unter
`https://finanzdienste.github.io/Workout/` und lässt sich im Browser über
*Teilen → Zum Home-Bildschirm* als App ablegen – dank `manifest.webmanifest`
startet sie dann ohne Browser-Leiste im Vollbild.

Einmal geladen, läuft die Seite auch **ohne Netz** – `sw.js` legt Oberfläche und
Plandaten im Browser ab. Seitenaufrufe gehen erst ans Netz und fallen bei
Fehlschlag auf den Zwischenspeicher zurück, damit eine neue Fassung sofort
ankommt, sobald Empfang besteht. Übrige Dateien kommen sofort aus dem
Zwischenspeicher und werden im Hintergrund erneuert.

Wichtig beim Ändern: `VERSION` in `sw.js` hochzählen, wenn Dateien aus der
Liste `SHELL` dazukommen oder wegfallen – daran hängt das Aufräumen alter
Zwischenspeicher.

**Als einzelne Datei.** `dist/workout.html` enthält die gesamte App inklusive
CSS und JavaScript und läuft ohne Server und ohne Netz. Neu bauen nach
Änderungen an `index.html`, `css/` oder `js/` – die Datei ist eine Kopie, kein
Verweis:

```bash
python3 tools/build-single.py
```

Auf Android: Datei aufs Gerät legen (Download, Cloud, Messenger, Kabel), in der
Dateien-App antippen, Chrome öffnet sie. Über *Menü → Zum Startbildschirm
hinzufügen* landet sie als Symbol neben den übrigen Apps. Eingetragene Sätze
überstehen Neuladen und Neustart – über `file://` mit persistentem
Browserprofil getestet.

Ein Hinweis dazu: Der Trainingsfortschritt liegt im `localStorage` und hängt
damit am Ort, von dem die App geladen wurde. Wer zwischen GitHub Page und
lokaler Datei wechselt, nimmt seine Daten über *Mehr → Export/Import* mit.
Kann ein Browser gar nicht speichern (privates Fenster, eingebettete Ansicht),
weist die App im Dashboard sichtbar darauf hin, statt Einträge still zu
verlieren.

## Lokal starten

```bash
npx http-server -p 8080 .
```

Dann `http://localhost:8080` öffnen. Ein Server ist nötig, weil `index.html`
ES-Module lädt und ein direkter `file://`-Aufruf davon vom Browser blockiert
wird – `dist/workout.html` hat dieses Problem nicht.
