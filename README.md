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
| **Kalender** | Monatsraster mit den tatsächlichen Terminen: was trainiert ist, was ansteht, was ausgefallen ist – je Tag mit Modus. Tippen zeigt die Übungen der Einheit. |
| **Statistik** | Kennzahlen, nächste Einheit, **Wochenvolumen Soll gegen Ist**, **Gewichtsverlauf je Übung** und **Volumen je Muskelgruppe** als Verlaufskarten, meist trainierte Übungen. |
| **Verletzt** | Verletzungen und Beschwerden anhaken. Betroffene Übungen fallen aus dem Plan oder werden getauscht – dauerhaft, bis der Haken weg ist. |
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
  Änderbar durch Antippen der Zahl oder über **−** und **+**, die je Übung
  unterschiedlich weit gehen (siehe *Gewichtsschritte*).
* **Aufwärmen steht oben.** Eine eigene Karte über der ersten Übung, aufklappbar,
  mit den Anlaufsätzen fürs erste Arbeitsgewicht.
* **„Wie war das?"** – drei Knöpfe nach dem letzten Satz einer Übung. Freiwillig,
  ein Griff, und die Grundlage für den Vorschlag beim nächsten Mal.
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

#### Gewichtsschritte je Übung

2,5 kg überall war für die schweren Übungen zu wenig und für die kleinen zu
viel: Beim Seitheben mit 8 kg sind 2,5 kg ein Sprung um 31 % – das schafft
niemand von einer Woche auf die nächste, und der Vorschlagsknopf schlug etwas
vor, was nicht ging. Deshalb steht der Schritt jetzt als `dbStep` neben dem
Startgewicht in `tools/exercise-meta.json` und geht über `js/data.js` in die
App, wo `stepOf()` die einzige Stelle ist, die ihn kennt – Knöpfe, `aria-label`
und Steigerungsvorschlag holen ihn dort.

| Schritt | Übungen | warum |
| --- | --- | --- |
| 2,5 kg | Goblet Squats, Hip Thrust, SZ-Curls | schwer, beidhändig, gröbere Scheiben |
| 2 kg | Floor Press, KH-Rudern, Wadenheben | je Hand gerechnet, also 2 kg pro Hantel |
| 1,25 kg | gewichtete Liegestütze, Crunches | Zusatzgewicht auf dem Rücken |
| 1 kg | Reverse Fly, Seitheben, Trizepsstrecker | kleine Muskeln, kleine Hanteln |

Maßstab: kein Schritt über einem Viertel des Arbeitsgewichts. Der größte liegt
bei 25 % (Reverse Fly, 1 von 4 kg), die meisten deutlich darunter.

Gespeichert wird auf **Viertelkilo** gerundet, nicht auf halbe: sonst würde aus
dem angenommenen Vorschlag „auf 21,25 kg" still 21,5. Aus demselben Grund zeigt
die App zwei Nachkommastellen statt einer.

#### Progression ohne Gewicht

Im Bodyweight-Modus gibt es nichts zu erhöhen – dort geht der Fortschritt über
Wiederholungen. Die App fragt nach dem letzten Satz **„Wie war das?"** (*ging
leicht* / *passte* / *war schwer*). Zweimal in Folge alles durchgezogen **und**
beide Male „ging leicht" ergibt den Vorschlag *„2× ging leicht · nächstes Mal
10–17 Wdh.?"*. Ein Tipp verschiebt den angezeigten Bereich dauerhaft um zwei
nach oben, für diese Übung.

Dieselbe Antwort dient bei den Hanteln als Bremse: „war schwer" beendet die
Serie, ohne dass man das Gewicht zurücknehmen müsste. Beantworten ist
freiwillig – ohne Antwort verhält sich die Hantel-Progression wie vorher.

### Aufwärmen

Der Plan fing kalt an: erste Karte, erster Satz, volles Arbeitsgewicht. Über
der ersten Übung steht jetzt eine eigene Karte – zwei bis drei Minuten allgemein
warm werden, die Gelenke bewegen, und dann die **Anlaufsätze fürs erste
Arbeitsgewicht**: 1 × 8 mit der Hälfte, 1 × 5 mit drei Vierteln, jeweils auf die
Schrittweite der Übung gerundet („1 × 8 Einarmiges KH-Rudern mit 8 kg / 1 × 5
mit 12 kg"). Ohne Zusatzlast bleibt es bei einem lockeren Satz mit halber
Wiederholungszahl.

Die Karte hat bewusst **eigene Klassen** statt `.ex`: sie wird nicht abgehakt,
zählt nicht ins Wochenvolumen und darf in keiner Zählung mitlaufen – als
`.ex` hatte sie sich sofort in die Übungszahl und in die Testreihen
eingeschlichen.

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

### Wochenvolumen: Soll gegen Ist

Der ganze Plan ist darauf gebaut, dass jede Muskelgruppe ihre Sätze pro Woche
bekommt – und genau das war in der App nirgends nachzusehen. Verpasste
Einheiten, abgebrochene Trainings und jede angehakte Verletzung verschieben die
Zahl, unsichtbar. Oben in der Statistik steht deshalb die zuletzt begonnene
Woche mit zwölf Balken gegen ihr jeweiliges Ziel, dazu die Woche davor als
Vergleich.

**Das Ziel kommt aus den erzeugten Daten**, nicht aus einer Konstante im
Skript: `tools/build-plan.py` schreibt es als `TARGET` nach `plan.json`, von
dort geht es über `js/data.js` in die App. Eine zweite Zahl im Frontend wäre
eine Zahl, die beim nächsten Umrechnen still falsch wird. Jede Zeile nennt
beides – „6,8/10" statt bloß „6,8", seit die Ziele auseinandergehen.

Gezählt wird, was wirklich abgehakt ist, in beiden Varianten mit den jeweiligen
Anteilen; eine Woche sind vier aufeinanderfolgende Einheiten – dieselbe
Einteilung, mit der `tools/build-plan.py` rechnet.

**Kein Prozentwert.** Eine Woche mit 9,5 und 10,5 wären 99 %, obwohl alles
stimmt: der Plan selbst schwankt um bis zu einen Satz. Angezeigt wird deshalb,
wie viele Gruppen ihr Ziel erreicht haben („12/12"). Die Grenze ist genau das,
was der Generator für die einzelne Woche garantiert – **kein ganzer Satz
darunter**. Enger wäre keine Aussage über das Training, sondern über den
Rundungsspielraum des Plans. Sind noch Einheiten der Woche offen, steht das
dabei – sonst sähe eine halb trainierte Woche wie ein Rückstand aus.

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

Das Ziel ist **nicht überall dieselbe Zahl**. Es steht als `TARGET` in
`tools/build-plan.py`, wird über den ganzen Plan im Schnitt **exakt** getroffen
und keine Gruppe geht über die Obergrenze `CAP` von 10 Sätzen pro Woche,
indirekte Anteile eingerechnet.

**Vier Einheiten pro Woche**, feste Wochentage: Montag, Mittwoch, Donnerstag,
Samstag. Vier Termine in sieben Tagen heißen zwangsläufig einmal zwei Tage
hintereinander – das ist der Mittwoch/Donnerstag. 80 Einheiten in 20 Wochen,
vom 20.08.2026 bis zum 06.01.2027.

| Gruppe | Ziel | Schnitt | einzelne Woche |
| --- | --- | --- | --- |
| Brust, Rücken, Schultern, hintere Schulter, Bizeps, Trizeps, Bauch | 10 | **exakt** | 9,25–10,95 |
| Gesäß | 8 | **exakt** | 7,5–8,5 |
| Oberschenkel, Beinbeuger | 6 | **exakt** | 5,1–6,8 |
| Waden | 4 | **exakt** | immer genau 4,0 |
| Nacken | *Ergebnis* | 9,65 | 9,4–10,0 |

In keiner der 20 Wochen liegt eine Gruppe einen ganzen Satz daneben; 0,95 ist
das Schlimmste, was vorkommt.

**Warum nicht überall 10.** Zehn Sätze sind der Bereich, in dem der Großteil
des Effekts liegt – aber nur da, wo man den Effekt will. Vierzehn Prozent aller
Sätze für die Waden aufzuwenden ist eine Entscheidung, keine Trainingslehre,
und dieselbe Zeit trägt an der Schulter mehr. Der Unterkörper steht deshalb auf
Erhalt (6–8), die Waden auf 4, der Oberkörper am Limit. Ändern heißt: `TARGET`
umschreiben und neu rechnen – ob die neuen Ziele zusammen überhaupt erreichbar
sind, sagt der Lauf selbst.

**Der Nacken ist keine freie Größe.** Er kommt vollständig aus Übungen, die
schon anderswo festgelegt sind:

    Nacken = 0,29·Rudern + 0,21·Chin-ups + 0,6·ReverseFly + 0,2·Seitheben

Bei 10 Sätzen Rücken und 10 hinterer Schulter liegt er damit rechnerisch bei
mindestens 8,9 – ein Ziel von 8 ist nicht knapp verfehlt, sondern unmöglich. Er
bekommt deshalb gar keine Gleichung (`None`), sondern nur die Obergrenze. Das
kostet nichts und bringt viel: **ohne diese eine Gleichung hat der
Oberkörper-Block 2431 exakte Lösungen statt 16**, und unter denen liegt eine
deutlich bessere.

**Höchstens drei Sätze je Übung und Einheit**, mindestens zwei, und **so wenige
verschiedene Übungen je Einheit wie möglich**: 6 bis 8, im Mittel 6,6. Das sind
14 bis 18 Sätze und geschätzte 30 bis 42 Minuten – zwei Sätze und rund fünf
Minuten weniger als mit flachen 10 überall.

Die Länge einer Einheit ergibt sich fast vollständig aus den Zielen: ihre Summe
über zwölf Gruppen, abzüglich der Überschneidung (ein Goblet Squat zahlt
gleichzeitig auf Oberschenkel, Gesäß, Bauch und Beinbeuger ein), macht rund 64
Sätze pro Woche und damit 16 je Training. Die Frequenz ist der Hebel, nicht die
Verteilung.

### 48 Stunden je Muskelgruppe

**Vier Termine in sieben Tagen erzwingen einen Ein-Tages-Abstand.** Die
Abstände müssen sich zu sieben addieren; bei höchstens zwei Tagen bleibt nur
2-2-2-1. Wegplanen lässt sich das nicht – aber verlegen: die Einheit davor und
die danach nehmen **verschiedene Hälften des Körpers**, dann hat jede Gruppe
trotzdem ihre 48 Stunden.

Maßstab ist die *direkte* Arbeit, Anteil ab 0,5. Drei Sätze Kniebeugen sind für
den Oberschenkel etwas anderes als der Bauchanteil derselben Sätze; Nebenanteile
am kurzen Übergang bleiben deshalb erlaubt. Übrig bleiben genau zwei: der Nacken
(Ø 3,9 Sätze über beide Tage) und der Bauch (Ø 4,7) – beides Beiwerk aus
Rudern, Chin-ups und Kniebeugen.

**Die Hälften stehen nicht in der Datei, sie werden gerechnet.** Übungen, die
eine direkte Gruppe teilen, müssen zusammenbleiben – daraus ergeben sich Blöcke
(Ziehen, Drücken, Beine, Bauch, Waden). Von allen Aufteilungen dieser Blöcke
gewinnt die mit dem kleinsten Satzunterschied, sonst wird eine der beiden
Einheiten zum Rumpf. Heraus kommt:

| Hälfte | Gruppen | Sätze/Woche |
| --- | --- | --- |
| A | Beinbeuger, Brust, Gesäß, Oberschenkel, Schultern, Trizeps | 32,2 |
| B | Bauch, Bizeps, Nacken, Rücken, Waden, hintere Schulter | 32,5 |

Nur die beiden Einheiten am kurzen Übergang bekommen eine Hälfte zugewiesen;
die zwei dazwischen bleiben frei und nehmen, was übrig ist. Deshalb kostet die
Bedingung fast nichts: weiterhin 6 bis 8 Übungen je Einheit, 14 bis 18 Sätze.

**Was sie kostet:** die Abwechslung. 67 von 80 Zusammenstellungen sind
verschieden statt 80 von 80 – der Raum ist kleiner, wenn zwei der vier
Einheiten festgelegt sind. Mehr Suchversuche ändern daran nichts, es sind
schlicht nicht mehr da. Zwei gleiche Einheiten direkt hintereinander kommen
trotzdem nicht vor.

Ein erster Versuch hatte die Bedingung stur beim Verteilen erzwungen, ohne die
Hälften: dann muss die erste Einheit einer Woche alles meiden, was am Vortag
dran war, und es blieben Einheiten mit 2 Übungen und 4 Sätzen neben solchen mit
9 und 21. Die Bedingung war erfüllt und der Plan unbrauchbar.

**Die Zahl der Wochen muss gerade sein**, solange Rücken und hintere Schulter
dasselbe Ziel haben. Das ist keine Feinheit, sondern der
Grund, warum der Plan nicht 19 Wochen lang ist. Der Rücken kommt
nur aus Rudern und Chin-ups, beide mit Anteil 1,0 – seine Plansumme ist also
immer eine ganze Zahl und trifft 10·W genau. Die hintere Schulter hängt an
denselben zwei Übungen (0,35 und 0,15) plus Reverse Fly:

    hintere Schulter = 1,5·W + 0,2·Rudern + ReverseFly

Für 10·W bräuchte es ReverseFly = 8,5·W − 0,2·Rudern. Bei ungeradem W endet
8,5·W auf ,5, und 0,2·Rudern kann nur auf ,0 ,2 ,4 ,6 oder ,8 enden – das geht
nie auf. Mit 19 Wochen ist exakt 10 also nicht knapp verfehlt, sondern
unmöglich; mit 20 Wochen geht es, sobald Rudern durch 20 teilbar ist.

Die Termine erzeugt `tools/build-plan.py` selbst: erster Tag aus der Excel,
danach die sieben Tage einer Woche so gleichmäßig wie möglich auf die Abstände
verteilt (bei vier Einheiten 2-2-2-1). Weil sich die Abstände zu genau sieben
Tagen addieren, bleiben die Wochentage fest.

`tools/build-plan.py` rechnet in drei Schritten:

1. **Plansummen.** Wie viele Sätze bekommt jede Übung über den ganzen Plan?
   Das ist ein Gleichungssystem mit elf Zeilen und siebzehn Unbekannten – der
   Nacken hat keine, er wird nur gedeckelt –,
   gelöst per Tiefensuche: steht in einer Gleichung nur noch eine Übung offen,
   ist ihr Wert bestimmt; stehen mehrere offen, muss der Rest durch den größten
   gemeinsamen Teiler ihrer Anteile teilbar sein. Das schneidet den Suchbaum so
   früh ab, dass alle Lösungen in unter einer Sekunde dastehen. Zufallssuche
   findet hier übrigens *nichts* – die exakten Punkte liegen zu dünn.
2. **Verteilung auf die Wochen.** Die Summen stehen fest, verschoben werden nur
   Sätze zwischen Wochen. Der Schnitt bleibt damit zwangsläufig exakt. Bewertet
   wird in drei Stufen, streng nacheinander: kein ganzer Satz Abweichung, dann
   möglichst wenige Auftritte, dann die kleinen Abweichungen in vierter Potenz.
   Ein zusätzlicher Auftritt und eine Abweichung von gut 0,85 Sätzen stehen dabei
   etwa gleich hoch – für eine Übung weniger in der Einheit darf eine Gruppe ein
   paar Zehntel danebenliegen, für einen halben Satz aber nicht.
3. **Aufteilung auf die Einheiten.** Zwei oder drei Sätze je Auftritt, immer die
   kürzeste Zerlegung, alle vier Einheiten etwa gleich lang und keine die
   längste – und die beiden am Ein-Tages-Abstand je auf eine Körperhälfte
   festgelegt, siehe oben.

Gerechnet wird durchweg in Zwanzigsteln eines Satzes – alle Anteile sind
Vielfache von 0,05, damit ist „exakt" wirklich exakt und nicht bis auf
Rundungsfehler.

**Was die Ziele bewirken.** Die Gleichungen lassen weniger Spielraum, als man
denkt – wer eine Zahl ändert, sieht es an ganz anderer Stelle:

- **Chin-ups von 1 auf 4 Sätze pro Woche.** Vorher hingen sie an einer
  Nacken-Gleichung, die Rudern erzwang; ohne sie verteilt sich der Rücken auf
  beide Zugrichtungen statt zu 90 % auf Rudern. Für die Breite ist genau das
  der Unterschied – vertikales Ziehen kam vorher praktisch nicht vor.
- **Reverse Fly ist die häufigste Übung** (7,3 Sätze pro Woche). Die hintere
  Schulter steht auf 10, und da Rudern zurückgeht, muss der Rest von dort
  kommen. Das ist kein Zufall, sondern die Gleichung.
- **Der Hip Thrust wird gebraucht** (2,9 Sätze pro Woche statt 0,5). Gesäß 8 bei
  Oberschenkel 6 geht nicht mehr über Kniebeugen: die sind durch das
  Oberschenkel-Ziel gedeckelt, also muss das Gesäß direkt kommen.
- **Der Bauch wird echt trainiert.** Vorher kamen 6,3 seiner 10 Sätze nebenbei
  aus Kniebeugen und Rudern, nur 3,6 direkt. Jetzt sind es 6,8 direkte – weil
  weniger Beinarbeit weniger Bauch nebenbei liefert und die Crunches
  nachrücken müssen.

Sonst gilt: von allen exakten Lösungen gewinnt die, mit der keine Gruppe einen
ganzen Satz danebenliegt; dann die, bei der keine Übung unter einen Satz pro
Woche rutscht (vier Sätze im ganzen Plan sind schlechter als gar keine); dann
die mit den kürzesten Einheiten. Für die aussichtsreichsten fünfzig wird das
kurz durchgerechnet, statt es zu schätzen.

**Zwei Stellen, an denen das Verfahren sonst danebengreift.** Die
Startverteilung muss so breit wie möglich streuen: staffelt sie 40 Sätze auf
zehn Wochen à vier statt zwanzig à zwei, liegt der Rücken jede zweite Woche um
einen ganzen Satz daneben, und der Abstieg findet von dort nicht zurück. Und
ein *ganzer* Satz Abweichung braucht einen eigenen Zuschlag, sonst tauscht das
Verfahren bereitwillig einen ganzen Satz Rücken gegen ein paar Zehntel
anderswo – in der App sieht man den ganzen Satz, die Zehntel nicht.

**Die Abwechslung bleibt vollständig:** 80 verschiedene Zusammenstellungen bei
80 Einheiten, alle 17 Übungen kommen vor.

`tools/build-data.py` übernimmt die Auswahl je Tag aus `tools/plan.json` –
dort stehen neben den Einheiten auch die **Ziele je Muskelgruppe** und die
Obergrenze, damit die App gegen dieselben Zahlen rechnet wie der Generator.
Namen, Wiederholungen und die Bodyweight-Äquivalente kommen unverändert aus der
Excel. Der Plan darf dabei über das Excel-Ende hinausgehen – die Zusatztermine
stehen dann in `plan.json`. `tools/plan.json` löschen und neu generieren stellt
den Originalplan wieder her; ohne die Datei gilt für jede Gruppe wieder 10.

Im Bodyweight-Modus liegen Rücken (13,1) und Trizeps (12,8) höher, Brust
(11,1), Nacken (10,5) und Schulter (10,4) leicht: die Äquivalente von SZ-Curls
und Seitheben sind enge Chin-ups und Pike Push-ups, die beide zusätzlich
mitarbeiten. Die übrigen sechs Gruppen treffen auch dort ihr Ziel genau. Nach
unten weicht nichts ab.

## Kalender

Der Plan ist eine Liste von Einheiten, gelebt wird er aber in Tagen. Der Tab
zeigt deshalb ein gewöhnliches Monatsraster, Montag bis Sonntag, mit den
**tatsächlichen** Terminen aus `effDate()` – nicht mit den Plandaten aus der
Excel. Nach dem ersten verpassten Tag wären die nämlich falsch: der Restplan
rückt nach, abgeschlossene Einheiten bleiben auf dem Tag, an dem wirklich
trainiert wurde.

Vier Zustände, und zwar **auch ohne Farbe unterscheidbar** – gefüllt ist
trainiert, umrandet geplant, gestrichelt ausgefallen, plus ein Ring um heute:

| | |
| --- | --- |
| **trainiert** | gefüllt, in der Farbe des Modus (orange Hanteln, blau Bodyweight) |
| **angefangen** | getönt mit Rahmen – Sätze stehen, die Einheit ist aber nicht fertig |
| **geplant** | schlichter Rahmen |
| **ausgefallen** | gestrichelt, nur bei abgeschaltetem Nachrücken möglich |

Das Zeichen in der Kachel nennt den Modus (🏋️ / 🤸), bei erledigten Einheiten
den, in dem tatsächlich trainiert wurde, sonst den, der beim Start greifen
würde. Darunter zählt eine Zeile den Monat zusammen: wie viele Einheiten,
wie viele davon mit Hanteln, wie viele mit Bodyweight, was offen ist.

**Ein Tipp auf einen Tag** klappt die Einheit auf: Datum, Zustand, Modus-Marke
und alle Übungen mit Sätzen und Wiederholungen – in der Variante, die zu dem
Tag gehört. Ein zweiter Tipp schließt sie wieder, ein Knopf springt ins
Dashboard zu genau dieser Einheit. Angehakte Verletzungen wirken auch hier,
weil die Liste durch dasselbe `exOf()` läuft wie überall sonst.

**Zwei Einheiten an einem Tag** kommen wirklich vor – etwa wenn zwei
nacheinander nachgetragen werden. Die Kachel zeigt dann „+1", und aufgeklappt
stehen beide untereinander. Eine Map von Datum auf *eine* Einheit hätte die
zweite still verschluckt.

## Verletzungen

Ein eigener Tab, in dem sich anhaken lässt, was gerade weh tut. Die Auswahl
bleibt stehen, bis der Haken wieder weg ist – sie gilt also für alle kommenden
Trainings, nicht nur für heute.

**31 Einträge** in `js/injuries.js`, nach Körperregion sortiert, von der
Schulter bis zur Achillessehne. Je Eintrag: eine kurze Beschreibung, welche
Bewegung das Problem ist, welche Übungen deshalb gesperrt sind und wo es einen
Ersatz gibt.

    avoid   Übungen, die mit dieser Beschwerde nicht in den Plan gehören.
    swap    Ersatz, wo es einen gibt, der dieselbe Richtung trainiert, ohne
            die Stelle zu belasten. Ohne Eintrag fällt die Übung ersatzlos weg
            – das ist ehrlicher als ein Ersatz, der auch weh tut.
    care    Was stattdessen gut tut – Verweise in den Katalog `CARE`.

**Ein Ersatz, der die Erholung bricht, ist keiner.** Der Plan hält 48 Stunden
zwischen zwei direkten Reizen auf dieselbe Gruppe ein (siehe oben) – ein Tausch
könnte das aushebeln, weil die Ersatzübung eine ganz andere Gruppe trifft als
die gesperrte. Deshalb kennt `applyInjuries()` einen dritten Parameter: Übungen,
die hier gerade unpassend sind. Greift der Ersatz eine Gruppe, die am Nachbartag
schon direkt drankommt, fällt die Übung an *diesem* Tag ersatzlos weg – an den
übrigen wird weiter getauscht.

Beim Schulter-Impingement heißt das: 49 Tausche bleiben, 19 fallen weg, und die
Zahl der Verstöße geht von 19 auf 0. Der Tab schreibt hin, wie viele Sätze das
kostet und warum.

Gerechnet wird das in einem **Vorwärtsdurchlauf** über den ganzen Plan: jeder
Tag sieht den Vortag in der bereits angepassten Fassung und den Folgetag so, wie
er im Plan steht – dessen eigene Tausche werden dann ihrerseits gegen diesen Tag
geprüft. Das Ergebnis liegt gemerkt in `adjustedPlan()`; Startansicht, Fokus,
Statistik, Kalender und der Verletzungs-Tab lesen alle daraus, damit die Zahlen
nicht auseinanderlaufen. Die Schwelle (48 Stunden, Anteil ab 0,5) kommt als
`REST` aus denselben erzeugten Daten wie der Plan.

**Was gut tut.** 34 Zusatzübungen in `CARE`, jede mit Art (dehnen,
mobilisieren, kräftigen, entlasten), Dosierung und einem Hinweis, worauf es
ankommt – beim Wandsitz etwa, dass die isometrische Belastung die Patellasehne
reizarm belastet und den Schmerz oft noch am selben Tag senkt. Je Beschwerde
zwei bis fünf davon; die Auswahl erscheint aufgeklappt in der Karte und, für
alle angehakten zusammengefasst und ohne Doppelte, oben im Tab.

Sie zählen bewusst **nicht** ins Wochenvolumen und stehen mit Dauer statt
Sätzen da: ein Satz Außenrotation mit dem Gummiband ist kein Satz Rudern, und
die exakte 10 würde sonst zu einer Zahl, die nichts mehr bedeutet.

Bei Bruch, Riss und Bandscheibenvorfall steht über der Liste, dass hier die
ärztliche Freigabe entscheidet, wann überhaupt wieder bewegt wird – nicht der
Trainingsplan.

**Alles geht durch eine Stelle.** `exOf()` in `js/app.js` – und darunter
`adjustedPlan()` – ist der einzige Weg,
auf dem die App an die Übungen eines Plantags kommt – Startansicht, Fokus,
Statistik, Steigerungsvorschlag. Damit kann es gar nicht passieren, dass eine
gesperrte Übung an einer Stelle auftaucht und an einer anderen nicht.

**Die Auswirkungen werden gerechnet, nicht behauptet.** Der Tab zeigt für die
angehakte Auswahl, was über den ganzen Plan getauscht wird, was ersatzlos
wegfällt und wie sich die Sätze je Muskelgruppe und Woche dadurch verschieben –
gegen dieselben Ziele, an denen der ganze Plan hängt. Mit Meniskus und
Schulter-Impingement zusammen fallen die Oberschenkel zum Beispiel von 6,0 auf
0,0 und die Schultern von 10,0 auf 3,8, während die hintere Schulter auf 15,4
steigt, weil das Seitheben durch Reverse Fly ersetzt wird.

**Wechselwirkungen** gibt es in zwei Sorten. Die eine rechnet sich aus: Wenn
Beschwerde A eine Übung durch eine andere ersetzen würde, Beschwerde B aber
genau die sperrt, greift der Ersatz nicht und die Übung fällt doch weg. Das
findet die App selbst und schreibt es hin. Die andere steht als `COMBOS` von
Hand in der Datei – Dinge, die man wissen muss und die keine Formel hergibt,
etwa dass Tennis- und Golferarm zusammen den kompletten Zug lahmlegen.

**Die 3D-Figur** kommt aus `js/figure.js`, mit einer ruhig stehenden Stellung
(`stand`) und Marken an den betroffenen Stellen. `SPOTS` übersetzt einen Namen
wie `knee` in Punkte am Skelett; was es doppelt gibt, wird auch doppelt
markiert, weil der Plan die Seiten nicht unterscheidet. Bruch und Riss bekommen
einen Zackenblitz. Mit Marken färbt sich der Körper neutral, sonst ginge die
Marke in der Akzentfarbe unter. Die Figur ist drehbar wie die
Bewegungsabläufe.

Während des Trainings steht unten eine Karte, die die aktiven Beschwerden nennt
und was sich heute konkret dadurch geändert hat.

Das ersetzt keine Diagnose, und die Zuordnungen sind gängige Trainingslehre,
keine Messwerte – was im Einzelfall gut tut, weiß nur eine Untersuchung. Das
steht auch in der App unter der Liste.

## Nach einer Aktualisierung

Hier steckten zwei Fehler übereinander, und beide sind die Sorte, die man nur
im echten Betrieb sieht.

**Der Browser-Zwischenspeicher fütterte den Service Worker mit alten Dateien.**
GitHub Pages liefert alles mit zehn Minuten Haltbarkeit aus. Ein gewöhnliches
`fetch()` im Service Worker bekommt in dieser Zeit die *alte* Fassung aus dem
Zwischenspeicher des Browsers – und der Service Worker legt sie als vermeintlich
frisch in seinen eigenen. Damit kann eine neue Fassung beliebig lange nicht
ankommen, obwohl sie längst online steht. Deshalb geht jeder Abruf, der etwas in
den Zwischenspeicher schreibt, jetzt mit `cache: 'reload'` daran vorbei.

Dazu: `caches.match()` ohne Angabe durchsucht **alle** Zwischenspeicher, auch
übrig gebliebene alte. Gesucht wird jetzt nur noch in dem der laufenden Fassung.

**Frisches `index.html` traf auf altes `app.js`.** Seitenaufrufe holt der
Service Worker aus dem Netz, alles andere zuerst aus dem Zwischenspeicher – das
macht den Start schnell, mischt aber direkt nach einer Aktualisierung zwei
Fassungen. Sichtbar wurde das, als ein neuer Tab in der Tabbar stand, den das
alte Skript nicht kannte: der Tab ließ sich anwählen, zeigte aber das Dashboard.
Jetzt lädt die App einmal neu, sobald ein neuer Service Worker die Seite
übernimmt (`controllerchange`) – nur wenn vorher schon einer da war, und nur
einmal je Sitzung, damit ein kaputter Service Worker keine Schleife auslöst.

**Notausgang.** In *Mehr* steht, welche Fassung läuft – nicht aus einer
Konstante im Skript, die man beim Ändern vergisst, sondern aus dem Namen des
Zwischenspeichers. Daneben ein Knopf, der Service Worker abmeldet,
Zwischenspeicher leert und neu lädt. Die Trainingsdaten liegen im
`localStorage` und bleiben unangetastet.

Geprüft wird das von einer eigenen Testreihe, die den echten Ablauf nachstellt –
Fassung installieren, benutzen, neue Fassung ausliefern, App wieder öffnen –
und zwar über einen Server, der wie GitHub Pages zehn Minuten Haltbarkeit
mitschickt. Mit dem alten `fetch()` fällt sie durch.

## Tab bleibt stehen

Am oberen Rand nach unten zu wischen lud die Seite neu und warf einen damit aus
jedem Tab zurück aufs Dashboard – mitten im Training genau die falsche Geste.
`overscroll-behavior-y: contain` schaltet das ab. Zusätzlich merkt sich die App
den zuletzt sichtbaren Tab, damit auch ein Neuladen aus anderem Anlass nicht
herausreißt.

## Sicherung

Alles liegt im `localStorage` genau eines Browsers. Android räumt den bei
Platzmangel weg, und „Websitedaten löschen" reicht ebenfalls – ein halbes Jahr
Training wäre weg. Deshalb erinnert die Startansicht nach acht erledigten
Einheiten daran und bietet die Sicherung direkt an; in *Mehr* steht, wann
zuletzt gesichert wurde.

## Wenn der Plan durch ist

Nach der letzten von 80 Einheiten bietet die Startansicht *Von vorn beginnen*
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
js/data.js              Aus Excel + plan.json erzeugt: 17 Übungen, 80 Einheiten, Wochenziele
js/injuries.js          Verletzungskatalog und die Anpassung des Plans
js/dates.js             Datums-Hilfsfunktionen inkl. Monatsraster
js/store.js             Zustand und localStorage-Persistenz
js/app.js               Rendering der fünf Tabs und Event-Handling
js/figure.js            Animierte Bewegungsabläufe und die Verletzungsfigur
js/body.js              Körperkarte mit den beanspruchten Muskelgruppen
js/chart.js             Verlaufskarten für die Statistik
sw.js                   Service Worker für den Offline-Betrieb
manifest.webmanifest    Installierbar als App auf dem Homescreen
data/…xlsx              Quelle des Plans
tools/build-data.py     Generator: Excel + Hinweise -> js/data.js
tools/exercise-meta.json  Muskelgruppe, Equipment und Ausführungshinweise je Übung
tools/build-plan.py     Generator: Ziele je Muskelgruppe -> tools/plan.json
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
