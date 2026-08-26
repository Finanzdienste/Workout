# Workout

Trainings-App zum Plan aus `Workoutplan_mit_Bodyweight_Equivalent.xlsx` – mit
Umschalter zwischen **Hantel-Variante** und der **Fassung für unterwegs**
(Körpergewicht, Loop-Band und Klimmzugstange).

Statische Web-App: kein Build, keine Abhängigkeiten, keine Server-Anbindung.
`index.html` im Browser öffnen oder über GitHub Pages ausliefern. Alle
protokollierten Sätze liegen lokal im `localStorage` des Geräts.

## Tabs

Drei Reiter, nicht fünf: Kalender und Verletzungen ruft man selten und nie
mitten im Satz auf. Sie standen trotzdem dauerhaft unten und haben die drei
wichtigen schmal gemacht – jetzt liegen sie als Einstiege oben unter *Mehr*.

**Welche unten stehen, entscheidet aber der Nutzer** (*Mehr → Leiste unten*):
Wer jeden zweiten Tag in den Kalender schaut, soll ihn dort haben. *Dashboard*
und *Mehr* bleiben gesetzt – ohne das eine gibt es kein Training, ohne das
andere keinen Weg zurück zu dieser Einstellung –, dazu bis zu drei weitere; mehr
als fünf werden auf schmalen Handys zur Briefmarke. Die drei Standardreiter
stehen zusätzlich fest im HTML: Seite und Skript können aus unterschiedlich
alten Zwischenspeichern stammen, und eine leere Leiste mit einem älteren Skript
wäre eine App ohne Navigation.

| Tab | Inhalt |
| --- | --- |
| **Dashboard** | Startansicht: was heute ansteht, welche Muskelgruppen drankommen, Startknopf. Darunter drei Ebenen – Kurzliste, volle Übungsliste, Fokus-Ansicht während des Trainings. Mit ← und → durch die Einheiten blättern. |
| **Statistik** | Kennzahlen, **Vergleich mit Freunden**, nächste Einheit, **Wochenvolumen Soll gegen Ist**, **Gewichtsverlauf je Übung** und **Volumen je Muskelgruppe** als Verlaufskarten, meist trainierte Übungen. |
| **Mehr** | Einstiege zu **Kalender**, **Verletzt** und **eigenen Workouts**; Farbdesign, Teilen, Töne, Trainingsfokus, Standardmodus, „Modus je Workout merken“, Plan-Verschiebung, **Kalenderdatei für Google Kalender**, Export/Import als JSON, Backup-Datei, Alles löschen. |

Unter *Mehr* erreichbar:

| Seite | Inhalt |
| --- | --- |
| **Kalender** | Monatsraster mit den tatsächlichen Terminen: was trainiert ist, was ansteht, was ausgefallen ist – je Tag mit Modus. Tippen zeigt die Übungen der Einheit. |
| **Verletzt** | Verletzungen und Beschwerden anhaken. Betroffene Übungen fallen aus dem Plan oder werden getauscht – dauerhaft, bis der Haken weg ist. |
| **Eigenes Workout** | Eine Einheit selbst zusammenstellen – neben dem Plan, nicht darin. |

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
sich unterscheiden: Der Floor Press trifft den Trizeps mit 0,70 und die vordere
Schulter mit 0,35, seine Fassung für unterwegs – die Liegestütze – verschiebt
das auf 0,60 und 0,45.

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

* **Zwei Startknöpfe, kein Umschalten mittendrin.** *Hanteln starten* oder
  *Bodyweight starten* – die Variante wird beim Start gewählt und steht dann
  fest. Der Umschalter oben verschwindet während des Trainings: Zwischen zwei
  Sätzen ist er keine Wahl mehr, sondern eine Möglichkeit, sich zu verklicken.
* **Workout starten.** Der Knopf beginnt die Einheit und wechselt in die
  Fokus-Ansicht: eine Übung groß, mit vorgeführter Bewegung, Gewicht und
  Satz-Knöpfen. Sind alle Sätze abgehakt, rückt die App von selbst zur
  nächsten offenen Übung. Über *☰ Übersicht* geht es jederzeit zurück in die
  Liste, ohne das Training zu beenden. Der Start schaltet nebenbei den Ton frei
  – mobile Browser lassen ihn nur nach einer Berührung zu, und so sitzt schon
  das erste Pausensignal.
* **Ein Griff pro Satz.** Die Satz-Knöpfe liegen außerhalb des aufklappbaren
  Bereichs und sind 48 px hoch – Abhaken ohne Zielen, ohne vorher aufzuklappen.
* **Fortschrittsleiste.** Über der Fokus-Ansicht ein Kasten je Übung, darunter
  ein Feld je Satz: was steht, wo man gerade ist, was noch kommt. Die Breite
  folgt der Satzzahl, ein Tipp auf einen Kasten springt dorthin.
* **Die Uhr misst Training, nicht Anwesenheit.** Sie läuft, solange die App
  offen ist oder eine Pause läuft, und steht, wenn beides nicht zutrifft – wer
  zwischendurch das Handy weglegt, bekommt sonst zwei Stunden angezeigt, in
  denen vierzig Minuten trainiert wurde. *Fortsetzen* zählt weiter statt neu
  anzufangen, über Nacht fängt sie von vorn an, *Abbrechen* setzt sie zurück.
* **Keine Wiederholungen eintragen.** Die stehen im Plan.
* **Ein Arbeitsgewicht je Übung**, vorbelegt mit einem Startwert (siehe unten).
  Änderbar durch Antippen der Zahl oder über **−** und **+**, die je Übung
  unterschiedlich weit gehen (siehe *Gewichtsschritte*).
* **Kein Fragebogen.** Nach dem letzten Satz einer Übung springt die
  Fokus-Ansicht sofort zur nächsten. Dazwischen stand einmal die Frage „Wie war
  das?" mit drei Knöpfen; sie ist raus. Sie kostete bei jeder Übung einen Griff,
  hielt den Ablauf an – und die Progression kommt auch ohne sie aus: Was zählt,
  ist, dass alle Sätze standen.
* **Wie schwer – einmal gelesen, nicht dauernd wiederholt.** Unter dem
  Übungsnamen stand eine Zeile *„so schwer wählen, dass noch 1–2 Wiederholungen
  drin wären"*. Sie ist raus: Wer den Plan zweimal gemacht hat, weiß das, und
  darunter steht sie bei jeder Übung im Weg. Der Grundsatz gilt weiter und
  steht in der ausführlichen Erklärung dort, wo er hingehört – bei den Übungen,
  bei denen es darauf ankommt (Floor Press ohne Ständer etwa).
* **Zwei Wege aus dem Training.** *Abschließen* behält, was abgehakt ist – auch
  wenn nicht alles steht; der Knopf nennt den Stand mit. Der Tag gilt damit als
  trainiert: im Kalender, in der Serie, in der Statistik. Für den Tag, an dem man
  das vergessen hat, steht auf der Startansicht *✓ Als trainiert markieren*. Wer den letzten Satz
  Wadenheben weglässt, hat trotzdem trainiert – vorher stand dort ein
  ausgefallener Tag, obwohl 16 von 18 Sätzen standen. *Abbrechen* verwirft
  die Einheit ganz, sie gilt dann als nicht trainiert und der Plan behandelt
  den Tag wie einen verpassten. Verworfen wird alles zu diesem Workout in
  dieser Variante, nicht nur die Sätze von heute – deshalb steht die Zahl in
  der Rückfrage.
* **Pausentimer.** Startet automatisch beim Abhaken und meldet sich am Ende mit
  Ton und Vibration. Nach dem letzten Satz einer Übung läuft bewusst keiner.
  Während der Pause um 30 s verlängerbar oder vorzeitig beendbar. Auf Wunsch
  kommt am Ende zusätzlich eine Systemmeldung, wenn die App gerade im
  Hintergrund ist (siehe *Töne*).
* **Fünf Sekunden Vorwarnung.** Zwischen dem Signal und der ersten Wiederholung
  liegen sonst noch der Weg zur Hantel und das Zurechtlegen – die Pause ist
  damit in Wahrheit länger als geplant. Fünf Sekunden vor Schluss kommt deshalb
  ein leiserer, tieferer Ton, und die Leiste schaltet auf *Fertig machen* um.
  Beim Signal selbst steht man dann schon an der Stange.
* **Rüstzeile.** Über dem Gewicht steht, was für diese Übung umzubauen ist –
  oder dass nichts umzubauen ist, weil die Stange schon so daliegt (siehe
  *Umbauen kostet mehr Zeit als Pausieren*).
* **Töne zu den Ereignissen.** Training gestartet, Satz abgehakt, Übung fertig,
  Workout komplett – jedes mit eigenem Ton, sodass man ohne Hinsehen weiß, was
  passiert ist.

### Bewegungsabläufe

`js/figure.js` zeichnet eine **drehbare 3D-Figur**. Eine Stellung hält nur
Gelenkwinkel, das Skelett rechnet `solve()` daraus. Das ist nicht bloß kürzer
als feste Punkte, sondern hält die Figur anatomisch beisammen: ein Knie kann
nicht neben der Hüfte landen, und dieselbe Stellung stimmt aus jedem
Blickwinkel. Waagerechtes Ziehen dreht um die Hochachse.

Gezeichnet wird mit schwacher Perspektive und Maleralgorithmus – was hinten
liegt, kommt zuerst.

**Sie steht auch in der aufgeklappten Übungskarte**, nicht nur in der
Fokus-Ansicht: Genau dort schaut man nach, wie eine Übung geht. Nur offene
Karten bekommen eine Figur, und **gezeichnet wird nur, was im Bild ist** – ein
`IntersectionObserver` meldet jede Figur ab, die aus dem Sichtfeld scrollt. Mit
acht offenen Karten und gedrosselter CPU fiel sonst jede zehnte Bildwiedergabe
aus, für Figuren, die gerade niemand sah. Alle Figuren teilen sich eine einzige
`requestAnimationFrame`-Schleife, die pausiert, sobald der Tab in den
Hintergrund geht oder das System reduzierte Bewegung verlangt.

Für Screenreader ist die Figur `aria-hidden`: zwei Dutzend namenlose Formen,
deren Inhalt als Text direkt daneben steht.

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

| Hanteln | Fassung für unterwegs |
| --- | --- |
| Goblet Squat (`squat`) | Kniebeuge mit vorgestreckten Armen (`squatbw`) |
| Hip Thrust beidbeinig (`thrust`) | einbeinig (`thrust1`) |
| Floor Press (`press`) | Liegestütze (`pushup`) |

Umgekehrt gilt genauso: Wo die Fassung für unterwegs **dieselbe** Bewegung mit
dem Band ist – Rudern, Reverse Fly, Trizepsdrücken, Schulterdrücken, Curls –,
muss das Muster auch dasselbe sein. Eine Figur, die im Bodyweight-Modus grundlos
etwas anderes vorführt, ist derselbe Fehler mit umgekehrtem Vorzeichen. Beide
Richtungen stehen in der Testreihe.

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
`backpack` ein Rucksack auf dem Rücken, `band` ein Band zwischen den Händen,
`null` kein Gerät.

**Aus `backplate` wurde `backpack`**, und das war kein Schönheitsfehler: Die
Figur trug eine Scheibe auf dem Rücken, die Gewichtsangabe hieß
„Zusatzgewicht" – beides zeigt etwas, das man sich allein nicht auflegen kann.
Ein Rucksack schon, und er sieht auch anders aus: ein Kasten, keine Scheibe.
Der Hinweis sagt jetzt, was hineingehört (Wasserflaschen, 1 l = 1 kg), wie er
sitzt (hoch zwischen den Schulterblättern, sonst hebelt er) – und wie mehr
Tiefe geht als der Boden zulässt: zwei gleich hohe, kippsichere Auflagen unter
den Händen. **Nicht auf Kurzhanteln**, außer sie sind sechseckig; runde
Scheiben rollen unter Last weg, und zwar genau unten in der gedehnten Position,
wo das Handgelenk schräg steht. Der erste Entwurf hat das empfohlen – ein
schlechter Rat, der nur deshalb aufgefallen ist, weil jemand mit den eigenen
Hanteln davorstand. Vorher wurde es aus `weightNote` erraten – „eine Hantel" trifft aber
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
| 5 kg | Kreuzheben, Hip Thrust, Rudern | Langhantel: eine 2,5-kg-Scheibe je Seite |
| 2,5 kg | Goblet Squats, SZ-Curls | schwer, beidhändig, gröbere Scheiben |
| 2 kg | Floor Press, Wadenheben | je Hand gerechnet, also 2 kg pro Hantel |
| 1,25 kg | gewichtete Liegestütze, Crunches | Zusatzgewicht auf dem Rücken |
| 1 kg | Reverse Fly, Seitheben, Trizepsstrecker | kleine Muskeln, kleine Hanteln |

Maßstab: kein Schritt über einem Viertel des Arbeitsgewichts. Der größte liegt
bei 25 % (Reverse Fly, 1 von 4 kg), die meisten deutlich darunter. Bei den
beiden Langhantelübungen sind es 12,5 % – wer 1,25-kg-Scheiben hat, setzt
`dbStep` dort auf 2,5.

Gespeichert wird auf **Viertelkilo** gerundet, nicht auf halbe: sonst würde aus
dem angenommenen Vorschlag „auf 21,25 kg" still 21,5. Aus demselben Grund zeigt
die App zwei Nachkommastellen statt einer.

#### Zwei Bänder statt Kilo

Am Band gibt es kein Gewicht, aber zwei Bänder: **gelb ist leicht, rot ist
schwer**. Genau das ist dort die Steigerung – dieselbe Übung, stärkeres Band.
Bandübungen zeigen deshalb statt der Kilo-Zeile eine Auswahl der beiden Farben,
gespeichert je Übung. Nochmal auf dieselbe Farbe tippen nimmt die Auswahl
zurück; „noch nicht entschieden" bleibt ein möglicher Zustand.

Erkannt werden sie am Gerätenamen der Variante: Wo „Band" drinsteht, steht die
Auswahl.

#### Progression ohne Gewicht

Im Bodyweight-Modus gibt es nichts zu erhöhen – dort geht der Fortschritt über
Wiederholungen. Zweimal in Folge alles durchgezogen ergibt den Vorschlag *„2×
komplett · nächstes Mal 10–17 Wdh.?"*. Ein Tipp verschiebt den angezeigten
Bereich dauerhaft um zwei nach oben, für diese Übung.

**Ohne Fragebogen.** Bis hierher hing beides an einer Frage nach dem letzten
Satz – „Wie war das?" mit *ging leicht* / *passte* / *war schwer*. Zweimal „ging
leicht" war die Bedingung für mehr Wiederholungen, „war schwer" bremste die
Hantel-Progression. Die Frage ist raus: Sie kostete bei jeder Übung einen
Griff und hielt den Ablauf an, obwohl der Vorschlag ohnehin nur ein Angebot ist.
Wer eine Übung schwer fand, nimmt ihn einfach nicht an.

### Pausenlängen

Statt einer festen Länge bekommt jede Übung die, die zu ihrer Belastung passt
(`dbRest`/`bwRest` je Variante). Die Werte folgen einer Regel aus zwei Größen:
der Stufe aus `tier` und der **unteren Grenze des Wiederholungsbereichs** – ein
Satz zu sechs Wiederholungen kostet mehr Erholung als einer zu fünfzehn.

| Art | Pause | Beispiel |
| --- | --- | --- |
| Stufe 1, unter 8 Wdh. | 3:00 | Chin-ups (5–10), Floor Press (6–12), Schulterdrücken (6–12) |
| Stufe 1, ab 8 Wdh. | 2:30 | Goblet Squat, Rudern, Hip Thrust, Kreuzheben |
| Stufe 2 und 3 | 2:00 | Leg Curls, Seitheben, Curls, Reverse Fly, Pull-Apart |
| Stufe 4 (Bauch, Waden) | 1:30 | Crunches, Wadenheben |

**Vorher war die Isolation zu kurz.** Reverse Fly und Seitheben standen bei
1:00, Crunches bei 0:45 – das kam aus älteren ACSM/NSCA-Richtwerten, in denen
kurze Pausen als „hypertrophieorientiert" galten. Neuere Arbeiten finden das
Gegenteil: auch bei eingelenkigen Übungen bringen zwei bis drei Minuten mehr
als eine, weil sonst die Wiederholungen in den Folgesätzen einbrechen und mit
ihnen das tatsächlich geleistete Volumen. Der Preis ist Zeit: die Einheit geht
von durchschnittlich 32 auf 38 Minuten – mit dem größeren Wochenvolumen sind
es inzwischen 47. Das ist der Tausch, und er ist bewusst so herum gemacht.

Über *Mehr* lässt sich stattdessen eine feste Länge wählen oder die Pause ganz
abschalten.

### Töne

`js/audio.js` erzeugt alle Töne per Web Audio, keiner wird geladen – das hält
die App offline-tauglich und spart eine Datei, die veralten könnte. Ein Ton ist
eine Folge von Sinus-Tönen; sieben gibt es: Training gestartet, Satz abgehakt,
Übung fertig, Pause vorbei, Workout komplett, Training beendet, Gewicht erhöht.
Der Tupfer beim Abhaken hat einen eigenen Schalter, weil er zwanzigmal pro
Training kommt; die übrigen ein- bis zweimal.

Weil mobile Browser Ton nur nach einer Berührung zulassen, entsteht der
AudioContext beim Start des Trainings oder beim ersten Abhaken.

**Das Pausensignal wird vorausgeplant, nicht per `setTimeout` ausgelöst.** Der
Unterschied zählt genau dann, wenn man während der Pause das Handy weglegt oder
zu einer anderen App wechselt: Zeitgeber der Seite werden im Hintergrund
ausgebremst oder ganz eingefroren, die Uhr des AudioContext läuft weiter. Beim
Start der Pause legt die App den Ton deshalb fest auf diese Uhr
(`osc.start(ctx.currentTime + rest)`). Damit der Browser den Kontext dabei nicht
schlafen legt, läuft bis zum Signal ein Trägerton mit: 30 Hz bei einem
Tausendstel Lautstärke, den kein Handylautsprecher wiedergibt – im Signalweg ist
er aber vorhanden, und damit gilt die Seite als aktiv. Wird die Pause
übersprungen oder um 30 s verlängert, wird der vorgemerkte Ton verworfen und neu
gelegt.

Zusätzlich hält die App während der Pause das Display wach
(`navigator.wakeLock`).

**Hinweis im Hintergrund.** Wer die Pause im Hintergrund verbringt, kann sich
zusätzlich eine Systemmeldung schicken lassen (Schalter unter *Mehr*, einmalige
Erlaubnis des Browsers). Sie kommt nur, wenn die App gerade nicht zu sehen ist –
davor sitzend reichen Ton und Leiste. Der Wecker dafür ist ein gewöhnliches
`setTimeout`; der Trägerton hält die Seite wach genug, dass es auch läuft.
`endRest()` bestellt ihn nur bei einer *abgebrochenen* Pause ab, nicht bei einer
abgelaufenen: Diese Zeile läuft bis zu eine halbe Sekunde vor dem Ende, weil der
Timer im Vierteltakt prüft und rundet.

Was auch das nicht kann: klingeln, wenn die App ganz geschlossen ist. Dafür
bräuchte es einen Server, der eine Push-Nachricht schickt – die App hat keinen
und soll keinen haben.

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

**Solange die Woche läuft, zählt die Karte Einheiten statt Gruppen.** Vorher
stand dort „0 Gruppen im Ziel · 0/12", wenn zwei der vier Einheiten noch offen
waren – als Vorwurf für etwas, das gar nicht versäumt war: Vor der letzten
Einheit *kann* keine Gruppe ihr Ziel erreichen. Jetzt heißt es „Woche 2 · 2 von
4 Einheiten", und erst mit der letzten abgehakten Einheit springt die Karte auf
die Zahl um, um die es geht. Die zwölf Balken darunter bleiben in beiden Fällen
dieselben.

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
`tools/build-plan.py`, wird über den ganzen Plan im Schnitt **exakt** getroffen,
und keine Gruppe geht **im Schnitt** über die Obergrenze `CAP` von 10 Sätzen pro
Woche, indirekte Anteile eingerechnet. Im Schnitt, nicht in jeder einzelnen
Woche: `capped()` prüft die Plansumme gegen `CAP · Wochen`. Was die einzelne
Woche ausschlägt, steht in der Spalte daneben – bis 12,0 bei Brust und Rücken.

**Vier Einheiten pro Woche**, feste Wochentage: **Montag, Mittwoch, Freitag,
Samstag**. Die stehen als `DAYS` in `tools/build-plan.py` – vorher ergaben sie
sich aus dem Startdatum der Excel, das war ein Nebenprodukt statt einer
Entscheidung. Vier Termine in sieben Tagen heißen zwangsläufig einmal zwei
Tage hintereinander; hier liegt das auf Freitag/Samstag, der Sonntag bleibt
frei. 84 Einheiten in 21 Wochen, vom 24.08.2026 bis zum 16.01.2027.

| Gruppe | Ziel | Schnitt | einzelne Woche | Abweichung |
| --- | --- | --- | --- | --- |
| Brust, Rücken | 10 | **exakt** | 9,0–12,0 | 20 % |
| Bizeps | 10 | **exakt** | 8,4–11,4 | 16 % |
| Trizeps | 10 | **exakt** | 9,0–11,3 | 13 % |
| seitliche Schulter | 10 | **exakt** | 7,7–10,7 | 23 % |
| Bauch | 9 | **exakt** | 7,0–9,8 | 22 % |
| Gesäß | 9 | **exakt** | 7,7–10,3 | 15 % |
| hintere Schulter | 8 | **exakt** | 6,0–8,6 | 25 % |
| **Oberschenkel, Waden** | 6 | **exakt** | immer genau 6,0 | **0 %** |
| **Beinbeuger Knie** | 3 | **exakt** | immer genau 3,0 | **0 %** |
| vordere Schulter, Nacken, Beinbeuger Hüfte | *Ergebnis* | 9,2 / **10,0** / 5,1 | 3,3–12,1 | – |

Welche Gruppen ein Ziel haben und welche bloß herausfallen, steht als
`DERIVED` in den erzeugten Daten – „exakt getroffen" darf niemand für eine
Gruppe behaupten, die gar nicht gesetzt wurde.

Drei Gruppen treffen ihr Ziel in **jeder** Woche exakt; bei den übrigen liegt
die schlimmste Woche 25 % daneben – gemessen am Ziel der Gruppe, nicht in
Sätzen. Die Gruppen ohne Ziel dürfen weiter ausschlagen: Sie haben keins, das
die Verteilung optimieren könnte.

**Warum nicht überall dieselbe Zahl.** Der Unterkörper steht auf Erhalt
(Oberschenkel, Waden 6, Gesäß 9), der Oberkörper trägt den Rest: Ein Sechstel
aller Sätze für die Waden aufzuwenden wäre eine Entscheidung, keine
Trainingslehre, und dieselbe Zeit trägt an der Schulter mehr. Das ist die
größte bewusste Unterdosierung im Plan – wer den Oberschenkel als das nimmt,
was er ist (die größte Muskelgruppe des Körpers), setzt hier eine andere Zahl
und lässt neu rechnen.

### Der Nacken bekommt keinen einzigen eigenen Satz

Und liegt trotzdem bei zehn. Er sammelt aus Rudern, Klimmzügen, Reverse Fly
und Pull-Apart – ein Shrug steht nirgends im Plan. Genau deshalb ist er teuer:
**Jede Übung, die Rücken oder hintere Schulter trainiert, lädt ihn mit.**

Er unter zehn zu bekommen ist keine Frage der Suche, sondern der Arithmetik.
Ausgerechnet über 8000 exakte Lösungen des Oberkörper-Blocks:

| hintere Schulter | kleinster möglicher Nacken | brauchbare Lösungen darunter |
| --- | --- | --- |
| 10 | 10,79 | **keine** |
| 9 | 10,19 | keine |
| 8,5 | 9,89 | 0 von 28 |
| **8** | **9,59** | 310 |

Bei einem Ziel von 10 für die hintere Schulter ist eine Obergrenze von 10 für
den Nacken also nicht knapp verfehlt, sondern unerfüllbar. Der Tausch, der sie
möglich macht: **hintere Schulter auf 8**. Damit steht der Nacken bei exakt
10,0 im Schnitt – in einzelnen Wochen bis 11,1, denn eine Gruppe ohne Ziel
wird von der Verteilung nicht geglättet.

### Die Schulter zählt getrennt

**„10 Sätze Schulter" waren nachgerechnet 8,1 vordere und 3,7 seitliche.** Das
ist der Unterschied zwischen einer Zahl und einer Aussage: Jedes Drücken –
Liegestütze, Floor Press, Schulterdrücken – füttert die vordere Schulter mit,
sie kommt also von allein. Die seitliche hängt allein am Heben zur Seite, und
sie ist die, die breit macht. Zusammengefasst verdeckte das Ziel genau diesen
Unterschied.

Deshalb sind es jetzt drei Gruppen statt zwei: **seitliche Schulter mit
eigenem Ziel (10), vordere ohne Ziel** – sie ergibt sich aus dem Drücken und
muss nur unter der Obergrenze bleiben, so wie der Nacken –, hintere unverändert
bei 10. Die seitliche steht damit bei 10,0 statt bei 3,7 Sätzen pro Woche.

Zwei Dinge kamen dabei heraus, die vorher niemand sehen konnte:

* **Eine Übung hing an einer einzigen Übung.** Mit 10 Sätzen seitlicher
  Schulter und nur dem Seitheben dafür wäre die Gruppe genau der Klumpen, den
  das `klumpen()`-Kriterium verhindern soll. Es gibt deshalb jetzt ein
  **Band-Seitheben** dazu – beim Band steigt der Widerstand nach oben, also
  dorthin, wo die seitliche Schulter am stärksten ist; bei der Hantel ist es
  umgekehrt.
* **Das Bodyweight-Äquivalent war anatomisch falsch.** Die Excel macht aus dem
  Seitheben *Pike Push-ups* – ein Überkopfdrücken, also vordere Schulter. Im
  Bodyweight-Modus fiel die seitliche damit auf 30 % ihres Ziels. Sie hat jetzt
  ein eigenes Äquivalent (einarmiges Band-Seitheben, weggelehnt), und
  `exercise-meta.json` darf das Äquivalent aus der Excel überschreiben.
  Bodyweight liegt damit bei 9,5 statt 3.

### Der Beinbeuger zählt auch getrennt

Dieselbe Geschichte, eine Etage tiefer. **„6 Sätze Beinbeuger" waren
nachgerechnet 2,3 Kniebeugung und 3,7 Hüftstreckung.** Hip Thrust, Kreuzheben
und jede Kniebeuge zahlen auf die Hüftseite ein; der **kurze Kopf des Bizeps
femoris kreuzt aber nur das Knie** und bekommt aus der ganzen anderen
Funktionshälfte strukturell nichts – genau die Lage der seitlichen Schulter,
die am Drücken nur nebenher hängt.

Der Schaden stand im Plan, nicht in der Theorie: Der Leg Curl kam in **16 von
84 Einheiten** vor, zwischen zwei Auftritten lagen bis zu **28 Tage**, und in
**5 von 21 Wochen** fiel er ganz aus. Der Schnitt von 6,0 stimmte dabei exakt.

Die Kniebeugung bekommt deshalb ein eigenes Ziel: **3 Sätze**. Das ist bei
festen Dreiersätzen nicht wenig, sondern die kleinste Zahl, die in *jeder*
Woche vorkommt – genau ein Auftritt. Die Hüftseite bekommt gar keins; sie
ergibt sich aus dem Rest und muss nur unter der Obergrenze bleiben, so wie die
vordere Schulter und der Nacken.

| | vorher | jetzt |
| --- | --- | --- |
| Kniebeugung | 2,3 Sätze/Woche | **3,0** |
| Leg Curl in | 16 von 84 Einheiten | **21 von 84** |
| größte Lücke | 28 Tage | **11 Tage** |
| Wochen ganz ohne | 5 von 21 | **keine** |
| Beinbeuger insgesamt | 6,0 | 8,1 |

Die 8,1 sind nur zum Teil mehr Training: Der gleitende Leg Curl hält die Hüfte
die ganze Zeit gestreckt, und dafür steht jetzt ein Anteil von 0,3 auf der
Hüftseite – dieselbe Haltearbeit, für die schon `glutes: 0.5` stand. Real dazu
kommen rund 1,2 Sätze pro Woche, bei drei zusätzlichen Sätzen im ganzen Plan.
Bezahlt wird das aus dem Beinblock selbst: Der Hip Thrust geht von 3,7 auf 2,4
Sätze zurück, das Kreuzheben von 1,0 auf 2,0 hoch.

**Der Muskel kommt weiter zweimal pro Woche dran**, nur eben über zwei Ziele:
Kniebeugung an einem Tag, Hüftstreckung an 1,5 – zusammen 2,29 Einheiten je
Woche, exakt wie vorher.

### Anderswo lohnt eine feinere Aufteilung nicht

Der Maßstab hat drei Teile, und alle drei müssen zutreffen: Die Unterköpfe
müssen von den vorhandenen Übungen **sehr** ungleich belastet werden, sie
müssen sich mit dem vorhandenen Gerät **getrennt ansteuern** lassen, und das
Sammelziel muss eine Unterpartie **tatsächlich verhungern** lassen. Schulter
und Beinbeuger erfüllen alle drei. Der Rest nicht:

| Kandidat | Warum nicht |
| --- | --- |
| **Rücken** senkrecht/waagerecht | 7,1 zu 2,9 – aber alle drei Zugübungen tragen `lats: 1.0`. Ein zweites Ziel zählte dieselben Sätze doppelt. Was senkrecht und waagerecht wirklich trennt, sind die Schulterblattzieher, und die zählen schon als eigene Gruppe (Nacken). |
| **Brust** oben/unten | 3,1 zu 6,9, und wieder tragen alle drei `chest: 1.0`. Eine ansteuerbare untere Fassung gibt es ohne Dips oder Negativbank nicht. |
| **Waden** | Zwei Übungen, ein Ziel – aber sie stehen in **allen 21 Wochen** 1:1 nebeneinander. Ein getrenntes Ziel erzeugte genau das, was ohnehin dasteht. Das ist der Unterschied zum Beinbeuger: dort waren es 16 von 84 Einheiten, hier 21 von 21 Wochen. |
| **Bizeps** | Beide Köpfe arbeiten in jedem Curl und jedem Klimmzug; der Brachialis sitzt an der Elle, ihm ist der Griff egal. Neutral und proniert laufen mit 4,3 Sätzen aus Rudern und Pull-ups ohnehin mit. |
| **Unterarme** | Kein eigener Satz im Plan – und trotzdem rund 9,4 gewichtete Sätze pro Woche allein aus Hängen und Halten. Überversorgt, nicht unterversorgt. |
| **Adduktoren, Rotatorenmanschette, Serratus, Hals, Schienbein** | Werden real mitbelastet oder sind für Masse bedeutungslos. Der Serratus etwa bekommt 9,6 Sätze aus Liegestütz und Überkopfdrücken; ein Push-up Plus liefert nichts dazu. |
| **schräge Bauchmuskeln** | Der stärkste **abgelehnte** Kandidat: Anti-Rotation und Seitbeugung sind tatsächlich 0,0 in allen 21 Wochen. Er scheitert am zweiten Teil des Maßstabs – ein Koffertragen mit 16 kg ist nicht steigerbar, dieselbe Hantel *bewegst* du beim Rudern, und das Wiederholungsschema kennt keine Sekunden. |

**Der Trizeps stand nur rechnerisch bei zehn.** 8,3 der 10 Sätze kommen aus
Drückbewegungen; direkt blieben 1,7, und die fielen in neun von 21 Wochen ganz
aus. Mehr direktes Volumen geht nicht – der Trizeps sitzt an jeder Drückübung
mit, ein höheres Ziel reißt die Obergrenze. Was ging, war die Übung selbst:
Aus dem **liegenden** wurde ein **Überkopf-Trizepsstrecker**. Der lange Kopf
kreuzt die Schulter; über Kopf steht er auf voller Länge, und gedehnt wächst er
mehr. Gleiche Hantel, gleiche Satzzahl, gleicher Anteil – nur die Position
ändert sich, und der Schlüssel der Übung bleibt derselbe, damit die
eingetragenen Gewichte stehen bleiben.

**Jede Übung steht mit drei Sätzen da.** `PER_SET = (3, 3)` – und das ändert
mehr als die Satzzahl. Bei fester Satzzahl ist die Wochensumme jeder Übung ein
Vielfaches von drei, und für Gruppen, deren Übungen alle Anteil 1,0 haben
(Brust, Rücken, Oberschenkel, Waden), gilt das damit auch für die Gruppe. Ein
Ziel von 10 ist dort im Schnitt erreichbar, in einer einzelnen Woche aber
**nie** – es käme immer 9 oder 12 heraus. Brust und Rücken stehen deshalb auf 10 im
**Schnitt** und schwanken zwischen 9 und 12; die Waden auf 6, und die werden
in jeder einzelnen Woche exakt getroffen. Aus demselben Grund läuft der Plan
über 21 Wochen statt 20 – Ziel × Wochen muss durch drei teilbar sein, und die
Wochenzahl sucht sich der Lauf jetzt selbst.

Was das bringt: **5,7 Übungen je Einheit statt 7,7**, 15 bis 18 Sätze je
Einheit statt 15 bis 21. Was es kostet: ein paar Sätze Wochenvolumen weniger
und größere Ausschläge in den gemischten Gruppen – bis 25 % statt bis 10 %.
Der Schnitt über den ganzen Plan bleibt in beiden Fällen exakt.

**Gewichtet wird im Verhältnis zum Ziel**, nicht in Sätzen. Ein Satz zu wenig
ist bei den Waden (Ziel 6) ein Sechstel des Wochenpensums, bei der Brust (10)
ein Zehntel – dieselbe Zahl, ein ganz anderer Verlust. Vorher zählte die
absolute Abweichung, und das bevorzugte systematisch die großen Gruppen: Die
Suche holte sich ein paar Zehntel bei der Brust, indem sie den Waden einen
ganzen Satz nahm.

### Der Schnitt sagt nichts darüber, wann etwas stattfindet

`PER_EX_WEEK` band lange nur die **Plansumme**, nicht die einzelne Woche. 60
Sätze Rudern auf 21 Wochen sind im Schnitt 2,86 – und waren als 0, 0, 0, 6, 6, 6
genauso zulässig wie als zwanzigmal 3. Am fertigen Plan nachgemessen sah das so
aus:

| Übung | Auftritte | größte Lücke | Wochen ohne |
| --- | --- | --- | --- |
| Rumänisches Kreuzheben | 7 von 84 | **37 Tage** | 15 von 21 |
| Trizepsstrecker | 12 von 84 | 21 Tage | 9 von 21 |
| Leg Curl (beide zusammen) | 16 von 84 | 28 Tage | 5 von 21 |
| Einarmiges Rudern | 20 von 84 | 14 Tage | 3 von 21 |

Ein Reiz alle fünf Wochen ist kein Reiz. Der Schnitt stimmte in jedem dieser
Fälle exakt – er sagt eben nichts darüber, *wann* etwas stattfindet.

Dagegen stehen jetzt zwei Kriterien, und beide kosten **keinen einzigen
zusätzlichen Satz**:

* **`band()` – eine Schranke je Übung.** Erlaubt sind die beiden Vielfachen der
  Körnung um den eigenen Wochenschnitt herum, beim Rudern also 0 und 3. Damit
  steht es in zwanzig Wochen einmal da und in einer gar nicht, statt dreimal
  doppelt und dreimal gar nicht.
* **`spacing()` – der Abstand dazwischen.** Die Schranke verhindert das
  Stapeln, nicht aber, dass die freien Wochen zusammenliegen: Pull-ups haben
  zehn Auftritte in 21 Wochen, und ob dazwischen gleichmäßig zwei Wochen liegen
  oder einmal sechs, ist der Schranke egal. Gewertet wird deshalb die Summe der
  quadrierten Abstände – die ist am kleinsten, wenn alle gleich groß sind.

**Beide sind weich.** Hart gesetzt kostet die Schranke zu viel: Die schlechteste
Woche rückte von 25 % auf 31 % vom Ziel ab, weil die hintere Schulter ihre
schwachen Wochen nur ausgleichen kann, wenn das Pull-Apart einmal doppelt
vorkommt. Eine Ausnahme kostet deshalb `BAND` statt verboten zu sein. Heraus
kommen neun Ausnahmen in 504 Übungswochen – und:

| Bewegung | vorher | jetzt |
| --- | --- | --- |
| Kreuzheben | 7 Einheiten, 37 Tage | **14 Einheiten, 18 Tage** |
| Kniebeugung | 16 Einheiten, 28 Tage | **21 Einheiten, 11 Tage** |
| Trizeps direkt | 12 Einheiten, 21 Tage | **12 Einheiten, 18 Tage** |
| Rudern | 20 Einheiten, 14 Tage | 20 Einheiten, 19 Tage |
| schlechteste Woche | 25 % | **25 %** |

Das Rudern ist der einzige Rückschritt, und zwar innerhalb der Schranke: Es
kommt weiterhin in 20 von 21 Wochen vor, nur liegt sein einziges Loch jetzt
ungünstiger im Kalender. Der Trizepsstrecker bleibt bei zwölf Auftritten – bei
36 Sätzen und drei Sätzen je Auftritt sind neun Wochen ohne ihn keine Frage der
Verteilung, sondern der Arithmetik.

**Erste Fassung der Ziele.** Vorher stand im Oberkörper überall eine 10 –
das war die selbst gesetzte Obergrenze, nicht das Optimum. Zwei Korrekturen:

* **Bauch von 10 auf 8.** Zehn Sätze pro Woche waren das teuerste Nichts im
  Plan: Ein sichtbarer Bauch ist eine Frage des Körperfetts, nicht der
  Crunches. Erst standen hier fünf – und das war zu wenig, aus einem Grund,
  den die Zahl verdeckt (siehe unten): **Beim Bauch stecken 60 % des Ziels in
  indirekten Anteilen.** Von fünf blieben zwei direkte Sätze übrig, an einem
  einzigen Tag der Woche. Acht ergeben rund fünf direkte Sätze auf zwei Tagen.
* **Oberkörper auf 12–16.** Die Dosis-Wirkung steigt bis etwa zwanzig Sätze je
  Muskel und Woche weiter, mit abnehmendem Ertrag. Wer schnell zulegen will,
  liegt bei 14–16 näher am Optimum als bei 10. Am meisten bekommt, was den
  Oberkörper breit macht (damals Brust und Schultern 16), die Arme etwas weniger
  (14 – sie tragen bei jedem Drücken und Ziehen ohnehin mit), die hintere
  Schulter 12.

Das kostete zunächst Zeit – die Einheiten wuchsen von 38 auf 47 Minuten; mit
den festen Dreiersätzen sind es wieder 42.

**Ein Ziel ist nicht dasselbe wie direkte Arbeit.** Die Zahl in `TARGET` zählt
indirekte Anteile mit, und bei einer Gruppe macht das den Unterschied zwischen
Training und Buchhaltung:

| Gruppe | Ziel | davon direkt | indirekt |
| --- | --- | --- | --- |
| Brust, Rücken, Oberschenkel, Trizeps, Waden, Beinbeuger Knie | wie gesetzt | **100 %** | – |
| Bizeps, Gesäß | | 90–94 % | 6–10 % |
| seitliche/hintere Schulter | | 73–81 % | 19–27 % |
| vordere Schulter, Nacken, Beinbeuger Hüfte | *Ergebnis* | 51–64 % | 36–49 % |
| **Bauch** | 9 | **65 %** | **35 %** |

Beim Bauch ist der indirekte Anteil das Halten bei Kniebeuge, Kreuzheben und
Leg Curl – isometrische Stabilisationsarbeit. Als Reiz für einen Muskel, der
wachsen soll, ist das kein Ersatz für Beugen gegen Widerstand. Mit einem Ziel
von 5 blieben davon **zwei direkte Sätze pro Woche** übrig, an einem Tag; mit 9
sind es knapp sechs auf zwei Tagen. Bei den übrigen gesetzten Gruppen ist der
Unterschied klein genug, um ihn zu ignorieren; die drei ohne Ziel stehen
ohnehin da, wo sie herauskommen.
Ändern heißt: `TARGET` umschreiben und neu rechnen – ob die neuen Ziele
zusammen überhaupt erreichbar sind, sagt der Lauf selbst.

**Der Nacken ist keine freie Größe.** Er kommt vollständig aus Übungen, die
schon anderswo festgelegt sind:

    Nacken = 0,5·Rudern + 0,3·Chin-ups + 0,35·Pull-ups
           + 0,6·ReverseFly + 0,7·Pull-Apart + 0,2·Seitheben + 0,3·Drücken

Er ist damit rechnerisch festgelegt, sobald die anderen Ziele stehen – ein
eigenes Ziel wäre nicht knapp verfehlt, sondern unmöglich. Er bekommt deshalb
gar keine Gleichung (`None`), sondern nur die Obergrenze. Das kostet nichts und
bringt viel: **ohne diese eine Gleichung hat der Oberkörper-Block ein
Vielfaches an exakten Lösungen**, und unter denen liegt eine deutlich bessere.

**Immer drei Sätze je Übung und Einheit**, höchstens neun pro Woche, und **so
wenige verschiedene Übungen je Einheit wie möglich**: 5 bis 7, im Mittel 5,9.
Das sind 15 bis 21 Sätze und geschätzte 35 bis 56 Minuten.
**84 von 84 Einheiten sind verschieden.**

**Was zweimal in der Woche vorkommt, gehört auf zwei Tage.** Zweimal pro Woche
schlägt einmal bei gleicher Satzzahl – aber die Aufteilung wusste davon nichts:
Jede Übung suchte für sich den leersten Tag, und dass die zweite Wadenübung
dieselbe Gruppe trifft, sah sie nicht. Ergebnis: Die Waden lagen in acht von
zwanzig Wochen auf einem einzigen Tag, der Bauch in **jeder**. Jetzt bevorzugt
die Platzierung einen Tag, an dem die Gruppe noch nicht direkt drankam, und ein
eigenes Kriterium in der Bewertung zählt die Fälle, in denen das misslingt.

Nur für *knappe* Gruppen – höchstens sechs direkte Sätze in dieser Woche, also
zwei Auftritte. Für alle zu gelten war zu viel des Guten: Brust und Rücken
streuen bei drei Auftritten von selbst, und sie auf frische Tage zu drängen
schob Sätze auf ohnehin volle Tage – die Einheiten gingen auf 37 bis 57 Minuten
auseinander und nur noch 67 von 80 waren verschieden. So kommt jede Gruppe in
jeder Woche an mindestens zwei Tagen dran, ohne dass es woanders weh tut.

**Ein ganzer Satz Abweichung wird nicht hingenommen.** Bleibt nach dem ersten
Verteilungslauf eine Woche stehen, in der eine Gruppe einen ganzen Satz
danebenliegt, sucht der Generator weiter – bis zu dreimal mit anderem Zufall.
Die Verteilung ist eine Suche, kein Beweis: beim Einbau des Klumpen-Kriteriums
stand nach dem ersten Anlauf genau ein solcher Fall da, und der zweite fand
eine Verteilung ohne ihn.

Die Länge einer Einheit ergibt sich fast vollständig aus den Zielen: ihre Summe
über vierzehn Gruppen, abzüglich der Überschneidung (ein Goblet Squat zahlt
gleichzeitig auf Oberschenkel, Gesäß, Bauch und Beinbeuger ein), macht rund 69
Sätze pro Woche und damit 17 je Training. Die Frequenz ist der Hebel, nicht die
Verteilung.

### 48 Stunden je Muskelgruppe

**Vier Termine in sieben Tagen erzwingen einen Ein-Tages-Abstand.** Die
Abstände müssen sich zu sieben addieren; bei höchstens zwei Tagen bleibt nur
2-2-2-1. Wegplanen lässt sich das nicht – aber verlegen: die Einheit davor und
die danach nehmen **verschiedene Hälften des Körpers**, dann hat jede Gruppe
trotzdem ihre 48 Stunden.

Maßstab ist die *direkte* Arbeit, Anteil ab 0,5. Drei Sätze Kniebeugen sind für
den Oberschenkel etwas anderes als der Bauchanteil derselben Sätze; Nebenanteile
am kurzen Übergang bleiben deshalb erlaubt. Übrig bleiben drei: die seitliche
und die vordere Schulter (Ø 5,0 bzw. 4,9 Sätze über beide Tage) und der Nacken
(Ø 5,0) – Beiwerk aus Drücken, Rudern und Klimmzügen. Zweimal *direkt* kommt
über alle 21 kurzen Übergänge keine einzige Gruppe.

**Die Hälften stehen nicht in der Datei, sie werden gerechnet.** Übungen, die
eine direkte Gruppe teilen, müssen zusammenbleiben – daraus ergeben sich Blöcke
(Ziehen, Drücken, Beine, Bauch, Waden). Von allen Aufteilungen dieser Blöcke
gewinnt die mit dem kleinsten Satzunterschied, sonst wird eine der beiden
Einheiten zum Rumpf. Heraus kommt:

| Hälfte | Gruppen | Sätze/Woche |
| --- | --- | --- |
| A | Bauch, beide Beinbeuger-Hälften, Brust, Gesäß, Oberschenkel, Trizeps, vordere Schulter | ~48 |
| B | Bizeps, Nacken, Rücken, Waden, hintere und seitliche Schulter | ~48 |

Nur die beiden Einheiten am kurzen Übergang bekommen eine Hälfte zugewiesen;
die zwei dazwischen bleiben frei und nehmen, was übrig ist. Deshalb kostet die
Bedingung fast nichts: weiterhin 5 bis 7 Übungen je Einheit, 15 bis 21 Sätze.

**Was sie kostet:** nichts an der Abwechslung – 84 von 84 Zusammenstellungen
sind verschieden. Zwei gleiche Einheiten direkt hintereinander kommen ohnehin
nicht vor.

**Ein zweiter Anlauf, wenn eine Woche nicht aufgeht.** Bei zehn Sätzen je
Gruppe fand die Suche in jeder Woche eine Aufteilung. Bei sechzehn nicht mehr:
In zwei von zwanzig Wochen fiel die Bedingung durch – und der Generator ließ
sie **still fallen**, weil er sonst gar keine Aufteilung gehabt hätte. Im Plan
standen dann zwei Übergänge, an denen dieselbe Gruppe an zwei Tagen
hintereinander direkt drankam. Jetzt bekommt eine solche Woche einen zweiten
und dritten Anlauf mit dem Acht- und Vierzigfachen an Versuchen; das kostet ein
paar Sekunden und löst beide Fälle. Bleibt danach eine Woche übrig, sagt der
Lauf es ausdrücklich – gemessen wird am fertigen Plan, nicht am Verfahren.

Ein erster Versuch hatte die Bedingung stur beim Verteilen erzwungen, ohne die
Hälften: dann muss die erste Einheit einer Woche alles meiden, was am Vortag
dran war, und es blieben Einheiten mit 2 Übungen und 4 Sätzen neben solchen mit
9 und 21. Die Bedingung war erfüllt und der Plan unbrauchbar.

**Die Zahl der Wochen ist eine Frage der Teilbarkeit, keine Wahl.** Der Rücken
kommt aus drei Übungen mit Anteil 1,0; bei festen Dreiersätzen ist seine
Plansumme also ein Vielfaches von drei und muss Ziel × Wochen treffen. Bei
einem Ziel von 12 geht das für jede Wochenzahl auf, bei 10 nur für Vielfache
von drei. Früher stand hier eine feste Regel („Wochenzahl gerade"), abgeleitet
aus einer bestimmten Kombination von Zielen und Anteilen – und die wurde
falsch, sobald sich eine davon änderte. Jetzt probiert der Lauf, statt zu
raten: Er nimmt die erste Wochenzahl ab `WEEKS`, für die alle Blöcke exakt
aufgehen, und sagt es, wenn er erhöhen musste.

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

**Die Abwechslung bleibt vollständig:** 84 verschiedene Zusammenstellungen bei
84 Einheiten, und jede der 24 Übungen kommt vor – die seltenste mit einem Satz
pro Woche.

`tools/build-data.py` übernimmt die Auswahl je Tag aus `tools/plan.json` –
dort stehen neben den Einheiten auch die **Ziele je Muskelgruppe** und die
Obergrenze, damit die App gegen dieselben Zahlen rechnet wie der Generator.
Namen, Wiederholungen und die Fassung für unterwegs kommen aus der Excel –
sofern `exercise-meta.json` kein eigenes `bwName`/`bwReps` setzt oder die Übung
gar nicht in der Excel steht. Der Plan darf dabei über das Excel-Ende hinausgehen – die Zusatztermine
stehen dann in `plan.json`. `tools/plan.json` löschen und neu generieren stellt
den Originalplan wieder her; ohne die Datei gilt für jede Gruppe wieder 10.

### Bodyweight ist keine Übersetzung, sondern derselbe Reiz

Der Bodyweight-Modus ist für unterwegs gedacht: nicht als eigener Plan, sondern
als Fassung **derselben Einheit** ohne Hanteln. Der Maßstab ist deshalb nicht
„gibt es eine ähnliche Übung", sondern: **Trifft die Bodyweight-Fassung dieser
Einheit dieselben Muskelgruppen wie ihre Hantel-Fassung?**

Nachgemessen war der Abstand anfangs **1,80 Sätze je Einheit** (Summe über alle
dreizehn Gruppen), im schlimmsten Fall 4,30. Drei Zuordnungen aus der Excel
verursachten praktisch alles davon:

| Hantel | Excel-Äquivalent | Verschiebung je Woche |
| --- | --- | --- |
| SZ-Curls | Enge supinierte Chin-ups | **+3,0 Rücken**, +0,9 Nacken |
| Sitzendes Schulterdrücken | Füße-erhöhte Pike Push-ups | +1,0 Brust, −0,5 seitliche Schulter |
| Trizepsstrecker | Extensions an niedriger Stange | +0,5 Brust |
| Einarmiges KH-Rudern | Inverted Rows an niedriger Stange | Gerät, das unterwegs fehlt |
| Reverse Fly | Reverse Snow Angels | Überkopf-Anteil ist Nacken, nicht hintere Schulter |

Jede dieser drei ist ein *anderes* Muster, nicht dieselbe Bewegung ohne Hantel:
Chin-ups sind Rückentraining, Pike Push-ups sind zu gutem Teil Brust. Ersetzt
sind sie jetzt durch die Band-Fassung derselben Bewegung – Band-Curls,
Band-Schulterdrücken, Überkopf-Trizepsstrecker am Band. Ein Loop-Band wiegt nichts und ist
genau das, was auf Reisen mitkommt.

**Ergebnis: 0,51 Sätze Abstand je Einheit statt 1,80**, schlimmster Fall 1,35
statt 4,30.

Die Zahl war zwischenzeitlich 0,32 – und das war zu gut, um wahr zu sein. Fünf
Bodyweight-Fassungen hatten ihre Muskelanteile **unverändert von der
Hantel-Fassung geerbt**, obwohl sie eine andere Bewegung sind: Inverted Rows
statt vorgebeugtem Rudern, Snow Angels statt Reverse Fly, einbeiniger Hip
Thrust statt beidbeinigem, und zwei Kniebeugen, deren Bauchanteil von den 20 kg
vor der Brust stammte, die im Bodyweight-Modus niemand hält. Eine kopierte
Schätzung sieht in der Rechnung wie Übereinstimmung aus, ohne welche zu sein.

Drei davon sind jetzt echte Band-Fassungen derselben Bewegung – Band-Rudern,
Band-Reverse-Fly, sitzendes Band-Seitheben –, bei denen die geerbten Anteile
zu Recht stehen. Zwei behalten die Bewegung und haben korrigierte Anteile: Die
Kniebeugen ohne Hantel bekommen weniger Bauch (0,20 / 0,15 statt 0,35 / 0,30),
der einbeinige Hip Thrust mehr Beinbeuger (0,60 statt 0,50).

Was übrig bleibt, ist ehrlich und klein: Trizeps 9,6 statt 10 (die Liegestütze
gibt gegenüber dem Floor Press etwas Trizeps an die vordere Schulter ab) und
Bauch 8,4 statt 9 (ohne Hantel vor der Brust ist die Kniebeuge weniger
Rumpfarbeit – genau das, was die korrigierte Schätzung jetzt sagt). Die größte
Lücke in einer einzelnen Einheit sind 0,45 Sätze Bauch; eine zusätzliche Übung
wären drei, also das Siebenfache – deshalb steht dort keine.

Der Preis: **Die Fassung für unterwegs setzt ein Loop-Band und eine
Klimmzugstange voraus.** Ohne Band fehlen Bizeps, Trizeps, Überkopfdrücken,
Rudern, Reverse Fly, Pull-Apart und beide Seitheben-Fassungen (26,3 Sätze pro
Woche); ohne Stange Chin-ups, Pull-ups und das hängende Knieheben (11,3 Sätze
pro Woche).
Dazu kommen Gegenstände, die in jedem Zimmer stehen: ein Stuhl, ein paar
Bücher, ein Handtuch. Die Figur zeichnet das Band deshalb auch dort, wo es nur
in der Fassung für unterwegs vorkommt.

**Die Geräteangabe muss vollständig sein, weil der Hantel-Hinweis unsichtbar
ist.** Im Bodyweight-Modus zeigt die App ausschließlich den `bwCue` – ein
Hinweis, der mit "Identisch." auf den Hantel-Text verweist, ist dort blind.
Genau das war an fünf Stellen der Fall: Der einbeinige Hip Thrust brauchte eine
Schulterauflage, die nur im Hantel-Hinweis stand; die füße-erhöhten Liegestütze
sagten nicht, worauf die Füße kommen; das Wadenheben verlangte "volle Dehnung"
ohne die Stufe, die sie erst möglich macht; die gewichteten Liegestütze warnten
vor Hantelscheiben, die es im Bodyweight-Modus gar nicht gibt; und Chin-ups
nannten einen Stuhl, den die Geräteangabe verschwieg.

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

### In den Google-Kalender

*Mehr → Kalender → Kalenderdatei (.ics)* schreibt **alle 80 Termine** in eine
Datei, jeweils um **18:00** am tatsächlichen Trainingstag. In der
Google-Kalender-App: *Einstellungen → Importieren* bzw. am Rechner
[calendar.google.com/calendar/u/0/r/settings/export](https://calendar.google.com/calendar/u/0/r/settings/export)
→ *Importieren*. Der Titel nennt Nummer, Anzahl Übungen und Sätze, die
Beschreibung listet die Übungen in der Variante, in der trainiert wird
(Hanteln oder Bodyweight, samt Verletzungs-Ersatz). Die Dauer ist gerechnet,
nicht geraten: Arbeitszeit je Satz plus die Pausen *zwischen* den Sätzen plus
Umbauzeit, auf fünf Minuten aufgerundet.

**Verschiebt sich der Plan, wandern die Termine mit** – aber nicht von selbst.
Die App spricht mit keinem Server und kennt kein Google-Konto; automatisch
schreiben hieße OAuth, ein Google-Cloud-Projekt und eine Netzverbindung, also
genau die drei Dinge, die diese App bewusst nicht hat. Stattdessen trägt jeder
Termin eine **feste Kennung** aus seiner Workout-Nummer
(`workout-7@workout.local`). Wird die Datei nach einer Verschiebung
neu erzeugt und noch einmal importiert, erkennt der Kalender dieselben Termine
wieder und **verschiebt sie**, statt achtzig neue danebenzulegen. Damit die
neue Fassung gewinnt, zählt `SEQUENCE` bei jedem Export hoch – ohne das
behält der Kalender stur den alten Stand.

Daran erinnert die App von sich aus: Steht der Plan nicht mehr dort, wo er beim
letzten Export stand, erscheint in der Kalender-Karte der Hinweis „Der Plan hat
sich seit dem letzten Export um *n* Tage verschoben". Ein Tipp auf den Knopf,
ein Import, und die Termine stimmen wieder.

Die Uhrzeit steht **ohne Zeitzone** in der Datei („floating"): 18:00 heißt
18:00 im Kalender des Geräts, im Sommer wie im Winter. Mit fester Zeitzone
müsste eine `VTIMEZONE`-Tabelle mitreisen, die zur nächsten Zeitumstellung
falsch wäre.

## Übungsvorrat

### Die Langhantel war ein Jahr lang unsichtbar

Der ganze Vorrat war um Kurzhanteln herum gebaut, obwohl eine Langhantel im
Raum stand – im Repo kam das Wort nirgends vor. Aufgefallen ist es an einer
Zahl, die von der anderen Seite kam: **Goblet Squat, fersenerhöhter Goblet
Squat und Hip Thrust stehen mit 20 kg ab der ersten Einheit am Anschlag**, weil
20 kg schlicht die schwerste vorhandene Kurzhantel ist. 43 der 84 Einheiten
enthalten eine dieser drei. Ein Satz, der im Wochenvolumen voll zählt und weit
von der Anstrengungsvorgabe entfernt liegt, trägt real fast nichts bei.

Vier Übungen sind deshalb auf die Stange umgezogen. Alle vier behalten
**Schlüssel und Muskelanteile** – also kein neuer Planlauf, keine neuen
Verletzungseinträge, und die eingetragenen Gewichte bleiben stehen. Der
Generator rechnet in *Sätzen*, nicht in Kilo; die Stange ändert nicht den
Plan, sondern was ein Satz wert ist.

| | vorher | jetzt |
| --- | --- | --- |
| Rumänisches Kreuzheben | 12 kg je Hand = **24 kg** | **40 kg**, Stange gesamt |
| Hip Thrust | eine Kurzhantel, **20 kg** | **40 kg**, Stange gesamt |
| Einarmiges KH-Rudern → **Langhantelrudern** | 16 kg, einarmig | **35 kg**, Stange gesamt |
| Floor Press | 14 kg je Hand = **28 kg** | **40 kg**, Stange gesamt |

Beim Hip Thrust zeichnete die App längst eine Stange über der Hüfte
(`equip: 'hipbar'`) – sie war nur mit einer Kurzhantel beladen.

**Der Floor Press war der Sonderfall.** Erst stand hier, er solle bei den
Kurzhanteln bleiben – der Notausgang ist dort einfach, man lässt sie neben sich
fallen. Dagegen stand die Erfahrung: Verstellbare Kurzhanteln werden mit vielen
Scheiben lang und kopflastig, und dann knickt das Handgelenk weg. Das ist ein
härteres Argument als eine Notausgangs-Überlegung, denn es passiert in jedem
einzelnen Satz. Mit der Stange liegen beide Handgelenke in einer Linie. Was
bleibt, ist die Auflage: **keine Stühle** – die kippen. Stange neben sich legen,
im Sitzen über die Oberschenkel rollen, mit ihr zurücklegen, und denselben Weg
zurück. Verschlüsse drauf.

**Was in einer Wohnung nicht geht.** Die Kniebeuge mit der Stange im Nacken
scheitert ohne Ständer daran, dass die Stange nicht hochkommt; Frontkniebeuge
und Zercher gehen technisch, aber ihr Notausgang ist das Fallenlassen von 50
bis 70 kg auf einen Geschossboden. Die umgestellten Übungen sind dagegen leise:
Beim Kreuzheben berührt die Stange den Boden nur vor und nach dem Satz – sie
geht bis Schienbeinmitte und wieder hoch –, beim Hip Thrust bleibt sie die
ganze Zeit auf der Hüfte, beim Rudern hängt sie am gestreckten Arm, beim Floor
Press liegt sie in den Händen.

**Was es kostet: einmal umladen in 22 von 84 Einheiten.** Mit drei
Langhantelübungen kam keine Einheit auf zwei davon – der Floor Press bricht
das, weil er als einzige Drückübung mit fast allem zusammen liegt: 13-mal mit
dem Hip Thrust, 6-mal mit dem Kreuzheben, 3-mal mit dem Rudern. In den übrigen
62 Einheiten wird die Stange einmal geladen und nicht mehr angefasst.

**Alle 38 Muster-Gerät-Kombinationen einmal angesehen.** Nicht gerechnet,
sondern gerendert und geprüft – Start- und Endstellung, in der Ansicht, die die
App benutzt. Vier Dinge stimmten nicht, und drei davon lagen an einer Zahl:

| Was | Warum es falsch aussah |
| --- | --- |
| **Das Band** hing zwischen den Händen | Richtig ist das nur beim Pull-Apart und beim Reverse Fly. Bei Curls, Seitheben, Schulterdrücken, Rudern und Überkopfstrecken **steht man darauf** – die Figur sah aus, als hielte sie ein schlaffes Springseil vor sich. Das Band geht jetzt von jeder Hand hinunter zum Fuß; welche Fassung gilt, steht als `band: 'hands'` am Muster. |
| **Die Kurzhanteln** waren 19 cm lang | Zu kurz: Die beiden Scheiben überdeckten sich aus den meisten Blickwinkeln zu einem einzigen weißen Fleck. Jetzt 29 cm. |
| **Die Scheibe beim Crunch** war unsichtbar | Sie lag 0,155 vor der Brust und damit hinter den gefalteten Armen; übrig blieb ein weißer Keil. Jetzt 0,26 – sie liegt sichtbar auf der Brust. |
| **Das gebeugte Knie** war von vorn nicht zu sehen | Und damit war der ganze Unterschied zur Schwesterübung weg. Das Wadenheben mit gebeugtem Knie steht jetzt seitlich. |

**Die Stange sah lange nicht wie eine Stange aus.** Sie war mit `half = 0.34`
gerade **75 cm lang** – die Maße einer Kurzhantelstange. Die Scheiben klebten
damit an den Händen, weil sie größer waren als das Stück Stange, das überhaupt
aus der Faust herausschaute. Dazu kippte sie: Projiziert man die beiden Enden
einzeln, bekommt das nähere einen größeren Perspektivfaktor als das fernere,
und aus einer waagerechten Stange wird eine Wippe. Bei einer Kurzhantel sieht
das niemand, bei 1,2 m schon. Beide Enden rechnen jetzt mit dem Faktor der
Stangenmitte – die Verkürzung beim Drehen bleibt, die falsche Neigung
verschwindet. Hip Thrust und Floor Press haben außerdem einen weiter
herumgedrehten Blickwinkel bekommen: Bei der alten Kameravorgabe lief die
Stange schräg durch den Körper, eine Scheibe oben, eine unten.

Das Rudern hat ein eigenes Bewegungsbild bekommen (`rowbar`): beidarmig
vorgebeugt statt einarmig abgestützt. Genau das ist auch
der Unterschied für den unteren Rücken – er hält die Neigung jetzt allein. Die
Fassung für unterwegs zieht mit, damit Bild und Bewegung zusammenpassen:
beide Füße auf das Band, beide Hände ziehen.

**Die Sperrlisten stimmten hier schon.** Bandscheibenvorfall LWS, Hexenschuss,
HWS-Vorfall und Leistenbruch sperren das Rudern längst – also genau die
Beschwerden, bei denen „vorgebeugt ziehen" das Problem ist. Beim Kreuzheben
war das nicht so, siehe unten.

**Was die Stange *nicht* ändert:** das Verhältnis von senkrechtem zu
waagerechtem Zug. Das steht weiter bei 7,14 zu 2,86 Sätzen, denn der Plan zählt
Sätze, und an der Zahl der Rudersätze ändert eine schwerere Stange nichts. Was
sich ändert, ist, was in diesen 2,86 Sätzen passiert: 35 kg beidarmig statt
16 kg einarmig, und ein Zug, der wachsen kann statt bei 20 kg Kurzhantel zu
enden.

### Sieben Übungen, die es vorher nicht gab

**24 Übungen.** Die ursprünglichen 17 aus der Excel deckten die
Bewegungsmuster nicht vollständig ab – Lücken, die keine Rechnung schließen
kann, weil die Übung schlicht fehlte:

| Neu | Schließt |
| --- | --- |
| **Sitzendes Schulterdrücken** | Es gab kein Überkopfdrücken. Die Schulter hing an Seitheben, und das ist mit 8 kg irgendwann am Ende – ein Drücken lässt sich progressiv laden. |
| **Rumänisches Kreuzheben** | Der Beinbeuger kam ausschließlich aus Kniebeugung (Leg Curl). Die Hüftstreck-Funktion, die größere Hälfte, wurde nie trainiert. |
| **Split Squat** | Der Goblet Squat ist ab einem gewissen Punkt durch das *Halten* der Hantel begrenzt, nicht durch die Beine. Einbeinig fällt diese Grenze weg. |
| **Hängendes Knieheben** | Der Bauch bestand aus Crunches, also nur Beugen. Jetzt kommt der Zug von unten dazu – und der Bauch hat 5,9 direkte Sätze statt 3,6, auf zwei Übungen verteilt. |
| **Pull-ups** | Der Rücken hing an zwei Übungen, Chin-ups und Rudern. Bei einer Obergrenze von acht Sätzen je Übung und Woche war damit früh Schluss – das Ziel hätte beide fest angeschlagen. Der weite Obergriff nimmt außerdem den Bizeps aus der Bewegung: mehr Rücken je Satz, und genau der macht die V-Form. |
| **Band-Seitheben** | Mit 10 Sätzen seitlicher Schulter hinge die Gruppe an einer einzigen Übung – genau der Klumpen, den das Kriterium verhindern soll. Beim Band steigt der Widerstand nach oben, dorthin, wo die seitliche Schulter am stärksten ist; bei der Hantel ist es umgekehrt. |
| **Band-Pull-Apart** | Die hintere Schulter hing an einer einzigen Übung mit 7,9 Sätzen pro Woche. Jetzt teilen sich zwei den Reiz: Reverse Fly 4,0 und Pull-Apart 1,9. Beim Band steigt der Widerstand zum Ende der Bewegung – genau dort, wo die hintere Schulter am stärksten ist; bei der Hantel ist es umgekehrt. Mit einem langen Band über der Klimmzugstange wird daraus ein Face Pull, die bessere Variante; der Hinweis sagt das. |

Die sieben stehen **nicht in der Excel**. Die bleibt Quelle des ursprünglichen
Plans; was später dazukommt, steht vollständig in `tools/exercise-meta.json` –
mit Name, Wiederholungen und Bodyweight-Äquivalent. `tools/build-data.py`
nimmt beides. Denselben Weg nimmt eine Übung, die sich *ändert*: Der Schlüssel
ist der Slug ihres Excel-Namens und trägt die eingetragenen Gewichte, also
bleibt er stehen, und `name` in `exercise-meta.json` überschreibt die Anzeige –
so wurde aus dem liegenden Trizepsstrecker der Überkopf-Trizepsstrecker, ohne
dass die Excel angefasst werden musste.

**Was das gekostet hat, war lehrreich.** Zwei Fallen auf einmal:

1. **Ein Anteil an der falschen Stelle legt die Rechnung lahm.** Mein
   Kreuzheben hatte anfangs `traps: 0.25` und `lats: 0.2` für den isometrischen
   Halt. Damit hängen Bein- und Oberkörperblock über eine gemeinsame Gruppe
   zusammen – aus drei kleinen Gleichungssystemen wird eines mit 19 Unbekannten,
   und die Tiefensuche lief nach 26 Minuten noch. Ohne die beiden Anteile
   zerfällt es wieder in 9 + 10 + 2 Übungen und ist in Sekunden gelöst. Die
   Anteile waren ohnehin großzügig: ein Halten ist kein Rückentraining.
2. **Mehr Übungen heißt ein größerer Lösungsraum – und der braucht Führung.**
   Mit 21 Übungen sind die ersten 4000 gefundenen Lösungen keine Auswahl mehr,
   sondern Zufall. Heraus kam eine, die rechnerisch exakt stimmte und als Plan
   unbrauchbar war: Chin-ups am Anschlag mit 10 Sätzen pro Woche, **Rudern
   komplett bei null**. Zwei Zeilen haben das behoben – `PER_EX_WEEK = (1, 9)`
   begrenzt, was eine Übung im Schnitt pro Woche tragen darf, und die Suche
   probiert Werte in der Nähe eines ausgewogenen Anteils zuerst statt in
   zufälliger Reihenfolge. Jetzt kommt jede der 24 Übungen vor.

### Keine Gruppe an einer einzigen Übung

Von allen exakten Lösungen gewinnt nicht mehr nur die ausgewogenste über die
Übungen, sondern auch die, bei der **keine Muskelgruppe an einer einzigen
Übung hängt** (`klumpen()`). Das ist kein Schönheitspreis:

- Ein Reiz aus zwei Richtungen ist mehr wert als derselbe Reiz doppelt.
- Fällt eine Übung wegen einer Beschwerde aus, bleibt bei einer
  Klumpen-Lösung nichts übrig.

Der Unterschied war deutlich: vorher trug der Reverse Fly 7,9 der 10 Sätze für
die hintere Schulter allein, jetzt sind es 3,0 plus 4,9 Pull-Apart.

Was das Kriterium **nicht** löst: das Zug-Verhältnis steht weiter bei 7,0
Chin-ups zu 3,0 Rudern. Gemessen wird der schlimmste Klumpen über alle
Gruppen, und der Rücken ist mit 0,7 nicht der schlimmste – für Breite ist
vertikales Ziehen ohnehin das Richtige, für Dicke wäre ausgeglichener besser.

### Reihenfolge in der Einheit

Sortiert wird nach `tier` aus `tools/exercise-meta.json`: 1 schwer
mehrgelenkig, 2 mehrgelenkig, 3 Isolation, 4 Bauch und Waden. Innerhalb einer
Stufe kommt zuerst, was auf das höchste Wochenziel einzahlt – die Prioritäten
stehen damit an genau einer Stelle, in `TARGET`.

Vorher entschied die Summe aller Muskelanteile, eine Hilfsgröße, die meistens
stimmte und manchmal daneben lag: der Hip Thrust (1,50) landete hinter dem
Reverse Fly (1,60) – eine schwere Hüftstreckung also hinter einer
Schulter-Isolation.

### Umbauen kostet mehr Zeit als Pausieren

Zwischen zwei Übungen steht in der Wohnung nicht die Pause, sondern der Umbau:
Scheiben abziehen, andere aufstecken, Verschlüsse zu. Das ist die Zeit, die eine
Einheit wirklich lang macht, und sie stand in keinem Plan. Zwei Stellen arbeiten
dagegen.

**Der Generator legt zusammen, was dasselbe Gerät braucht.** Welche Übungen in
einer Woche wie oft vorkommen, steht vor der Aufteilung auf die vier Tage fest –
welcher Tag sie bekommt, ist frei. `split()` bewertet deshalb zusätzlich, wie
viele Geräte an einem Tag aufgebaut werden müssen (`ruest`): Zwei Übungen an
derselben Stange sind ein Aufbau, verteilt auf zwei Tage sind es zwei, bei
identischem Volumen. Das drückt den Schnitt von 2,79 auf 2,26 Geräte je Einheit,
ohne dass sich am Wochenvolumen einer einzigen Muskelgruppe etwas ändert – und
ohne dass die Einheiten länger oder ungleicher werden: 5–6 Übungen und 15–18
Sätze, genau wie vorher.

Die Stelle in der Bewertungsreihenfolge ist mit Bedacht gewählt: hinter der Länge
der Einheiten. Weiter vorn holt der Rüstaufwand mehr heraus – 2,23 Geräte je
Einheit –, aber die Einheiten laufen dann auseinander: 12 bis 21 Sätze statt 15
bis 18. Eine Einheit, die anderthalbmal so lang ist wie die nächste, ist der
schlechtere Tausch. Umgebaut wird zwischendurch, gewartet wird die ganze Zeit.

**Die App sortiert innerhalb der Einheit.** Nach Gerät, und innerhalb des Geräts
absteigend nach Gewicht: Jedes Gerät wird einmal aufgebaut, und die Last geht in
kleinen Schritten nach unten statt hin und her. Die Reihenfolge der Geräte bleibt
dabei die des Plans – das erste Vorkommen bestimmt den Platz –, damit vorn
weiterhin steht, was `tier` nach vorn gestellt hat.

Warum in der App und nicht im Generator: Hier stehen die *aktuellen*
Arbeitsgewichte. Der Generator kennt nur die Startwerte, und die stimmen nach dem
dritten angenommenen Steigerungsvorschlag nicht mehr.

Übungen ohne Aufbau – Klimmzüge, Band, Bodyweight – behalten ihren Platz. Sie
kosten nichts, also darf zwischen zwei Langhantelübungen ruhig ein Satz
Pull-Apart liegen; die Stange bleibt ja geladen.

**Eine Grenze hat das Sortieren.** Am fertigen Plan nachgemessen zog es in 9 von
84 Einheiten eine kleine Übung vor eine schwere am selben Muskel – achtmal den
Trizepsstrecker vor die gewichteten Liegestütze, dazu viermal einen Beinbeuger
vor Kniebeuge oder Kreuzheben. Beides ist Vorermüdung: Die Grundübung endet
dann am kleinen Muskel statt am großen, und genau dafür ist sie nicht da.
`ruestOrder()` prüft das Ergebnis deshalb und setzt die Übung fest, die
überholt hat; danach wird neu sortiert, bis nichts mehr überholt. Die Ersparnis
bleibt dabei stehen – 304 Rüstvorgänge über den Plan, genau wie ohne die Regel,
gegen 312 in der reinen Plan-Reihenfolge. Der Maßstab ist `tier` aus
`exercise-meta.json` und "beide treffen denselben Muskel direkt" (Anteil ab
0,5); der Beinbeuger vor dem Drücken bleibt also erlaubt.

Am Plan nachgerechnet, mit den Startgewichten und einem einfachen Maß – wie viele
Kilo in einer Einheit von einer Stange auf die andere wandern:

| | Geräte je Einheit | bewegte Kilo je Einheit |
| --- | --- | --- |
| vorher | 2,79 | 109 |
| nur sortiert | 2,79 | 98 |
| Generator + sortiert | 2,26 | 84 |

Knapp ein Viertel weniger geschleppt, bei unverändertem Trainingsinhalt.

## Reha-Übungen im Training

Was bei einer angehakten Beschwerde gut tut – dehnen, mobilisieren, gezielt
kräftigen –, stand bisher nur im Verletzungs-Tab. Dort liest man es einmal und
macht es nie: Gemacht wird, was im Training steht.

Sie hängen deshalb am Trainingstag an, hinter der letzten Übung, mit Dosis,
Hinweis und einem Haken. Nicht *darin*: Sie zählen nicht als Sätze, gehen nicht
ins Wochenvolumen ein und halten das Abschließen nicht auf. Ein Satz
Außenrotation mit dem Gummiband ist kein Satz Rudern – das ist derselbe Grund,
aus dem sie in `js/injuries.js` mit Dauer statt Sätzen stehen.

Abgehakt wird je Einheit (`log[n].care`), nicht je Tag: Wer eine Einheit
zurücksetzt, setzt sie mit zurück.

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

**Halb gesperrte Übungsfamilien sind der Fehler, der hier passiert.** Split
Squat, Schulterdrücken, Kreuzheben und hängendes Knieheben kamen später zum
Übungsvorrat dazu – und standen in **keiner einzigen** Sperre. Wer einen
Kreuzbandriss angehakt hatte, bekam die Kniebeuge aus dem Plan genommen und den
Split Squat weiter angezeigt: dieselbe Kniebeugung unter Last, nur einbeinig.
35 solcher Stellen waren es insgesamt, quer durch den Katalog.

Nachgetragen ist das, und eine Prüfung in der Testreihe findet den Fehler beim
nächsten Mal von allein: Sie kennt sechs Übungsfamilien (Kniebeuge,
Hüftstreckung, Überkopf, Hängen, hintere Schulter, Drücken) und meldet jede
Beschwerde, die eine Familie nur zur Hälfte sperrt. Sieben Stellen bleiben
bewusst offen und stehen als Ausnahme in der Prüfung – der Floor Press stoppt
am Boden und hält das Handgelenk gerade, der fersenerhöhte Squat beugt das Knie
mehr und das Sprunggelenk weniger, der Band-Pull-Apart steht aufrecht. Eine
zweite Prüfung stellt sicher, dass überhaupt jede Übung des Plans irgendwo im
Katalog vorkommt.

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
0,0 und die **seitliche Schulter von 10,0 auf 0,0**, während die hintere auf
13,7 steigt, weil das Seitheben durch Reverse Fly ersetzt wird. Vorher, als
vordere und seitliche Schulter noch eine Gruppe waren, stand da „von 10,0 auf
3,8" – dieselbe Lage, nur unkenntlich: Die 3,8 waren vordere Schulter aus dem
Drücken, die seitliche war längst bei null.

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

## Wenn nichts übrig bleibt

Mit genug angehakten Beschwerden fällt eine Einheit komplett aus – ein
Handgelenksbruch allein leert zwei der 80, zwei Beschwerden zusammen in 37 von
465 Kombinationen mindestens eine. Die Startansicht sagt das dann und bietet
gar nicht erst an, ein leeres Training zu beginnen. Vorher lief die
Fokus-Ansicht in ein `undefined`, und es passierte sichtbar gar nichts.

## Bedienung ohne Maus und ohne Augen

Die Ansicht wird bei jedem abgehakten Satz komplett neu geschrieben – der
Tastaturfokus landete danach wieder ganz oben. `render()` merkt sich deshalb
vorher, worauf der Fokus stand, und setzt ihn hinterher zurück; wiedergefunden
wird das Element an seinen `data`-Attributen, die ohnehin schon beschreiben,
was der Knopf tut. Ohne `preventScroll` springt die Seite dabei.

Die Pause meldet sich mit Ton und Vibration – lautlos braucht es eine Ansage.
Eine eigene Live-Region nennt Beginn („Pause 2:00 Minuten, danach Satz 2 von 3,
Langhantelrudern") und Ende, aber nicht die laufende Zeit: im Sekundentakt
vorgelesen wäre der Timer unbenutzbar. Die Tabs verweisen mit `aria-controls`
auf die Ansicht, die Ansicht mit `aria-labelledby` zurück auf den aktiven Tab.

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

Nach der letzten von 84 Einheiten bietet die Startansicht *Von vorn beginnen*
an. Der bisherige Verlauf wandert in `rounds` und bleibt im Export erhalten,
die **Gewichte bleiben stehen** – Runde zwei startet also auf dem erreichten
Stand. Workout 1 rückt auf heute, sonst würde die Nachrück-Automatik den
halben Plan verschieben, weil das Originaldatum längst vorbei ist.

Daneben steht *Verlauf zurückholen*, sobald etwas in der Ablage liegt. Es ist
der Rückweg aus genau einer Falltür: Neustart und Fokuswechsel hängen an einer
einzigen Rückfrage, und die klickt man auch mal weg. Zusammengeführt wird pro
Einheit – was seit dem Neustart abgehakt wurde, bleibt stehen.

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
zeigt. Unter **Mehr** lässt sich die aktuelle Verschiebung ablesen, tageweise
korrigieren oder auf die Original-Termine aus der Excel zurücksetzen.

**Es passiert still.** Einen Schalter dafür gab es einmal – abgeschaltet war er
nie sinnvoll, und angeschaltet stellte er eine Frage, deren Antwort immer
dieselbe ist. Auch die Meldung „↷ 2 Tage verpasst" ist weg. Was übrig bleibt,
ist die eine Folge, die man wirklich wissen muss: **Wer seine Termine im
Kalender stehen hat, hat sie jetzt an den falschen Tagen.** Genau danach fragt
die Startansicht dann – *Neue Kalenderdatei erzeugen? Ja / Nein* –, und nur,
wenn überhaupt schon einmal eine erzeugt wurde.

Was die App nicht kann: den Google-Kalender selbst umschreiben. Dafür bräuchte
es eine Anmeldung bei Google und einen Zugriffsschlüssel; eine Datei
herunterladen und importieren ist der Weg, der ohne beides auskommt.

### Heute anfangen

Die Verschiebung geht **in beide Richtungen**. Das Nachrücken allein reichte
nicht: Es schiebt nur, was verstrichen ist. Die Termine stammen aber aus der
Excel und können in der Zukunft liegen – und dann stand da „in 5 Tagen",
`− 1 Tag` war ausgegraut, und wer heute anfangen wollte, konnte nur warten.
Die Untergrenze von null war schlicht falsch.

Liegt die nächste offene Einheit in der Zukunft, steht deshalb unter dem
Startknopf **„Heute anfangen – Plan *n* Tage vorziehen"**. Der ganze offene
Plan rückt mit, die Abstände bleiben – die 48 Stunden Erholung zwischen zwei
direkten Reizen gelten unverändert, es wird nichts übersprungen und nichts
gedrängt. Dieselbe Rechnung greift beim Neustart einer Runde: Sie beginnt
heute, nicht am Excel-Termin.

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

| Hanteln | Fassung für unterwegs | Gerät |
| --- | --- | --- |
| Goblet Squat | 1½-Wdh. Bodyweight Squat | Ohne Gerät |
| Sliding Leg Curl | Sliding Leg Curl | Handtuch, glatter Boden |
| Gewichtete Liegestütze | Langsame Liegestütze (3 s ablassen) | Ohne Gerät (optional zwei Bücherstapel) |
| Chin-ups | Chin-ups | Klimmzugstange (+ Stuhl) |
| Sitzendes Seitheben | Sitzendes Band-Seitheben | Loop-Band + Stuhl |
| Überkopf-Trizepsstrecker | Überkopf-Trizepsstrecker am Band | Loop-Band + Stuhl |
| Einbeiniges stehendes Wadenheben | Einbeiniges Wadenheben | Stufe oder dickes Buch |
| Wadenheben gebeugtes Knie | Wadenheben mit gebeugtem Knie | Ohne Gerät |
| Fersenerhöhter Goblet Squat | Fersenerhöhter 1½-Wdh. Bodyweight Squat | Erhöhung (Buch/Keil) |
| SZ-Curls | Band-Curls | Loop-Band |
| Gewichtete Crunches | Crunches | Ohne Gerät |
| Einbeiniger Sliding Leg Curl | Einbeiniger Sliding Leg Curl | Handtuch, glatter Boden |
| Füße-erhöhte Liegestütze | Füße-erhöhte Liegestütze | Stuhl oder feste Kiste |
| Floor Press | Liegestütze | Ohne Gerät |
| Langhantelrudern | Vorgebeugtes Band-Rudern | Loop-Band |
| Hip Thrust | Einbeiniger Hip Thrust | Stuhl- oder Sofakante |
| Reverse Fly | Vorgebeugtes Band-Reverse-Fly | Loop-Band |
| Pull-ups | Pull-ups | Klimmzugstange (+ Stuhl) |
| Band-Seitheben | Band-Seitheben | Loop-Band |
| Sitzendes Schulterdrücken | Band-Schulterdrücken | Loop-Band |
| Rumänisches Kreuzheben | Einbeiniges Kreuzheben (Standwaage) | Ohne Gerät |
| Split Squat | Split Squat ohne Gewicht | Ohne Gerät |
| Hängendes Knieheben | Hängendes Knieheben | Klimmzugstange |
| Band-Pull-Apart | Band-Pull-Apart | Loop-Band (Face Pull: + Klimmzugstange) |

## Aufbau

```
index.html              Grundgerüst, Topbar mit Modus-Umschalter, Tabbar
css/styles.css          Styling (dunkel, mobil zuerst)
js/data.js              Aus Excel + plan.json erzeugt: 24 Übungen, 84 Einheiten, Wochenziele
js/injuries.js          Verletzungskatalog und die Anpassung des Plans
js/dates.js             Datums-Hilfsfunktionen inkl. Monatsraster
js/store.js             Zustand und localStorage-Persistenz
js/app.js               Rendering der fünf Tabs und Event-Handling
js/figure.js            Animierte Bewegungsabläufe und die Verletzungsfigur
js/body.js              Körperkarte mit den beanspruchten Muskelgruppen
js/chart.js             Verlaufskarten für die Statistik
js/audio.js             Erzeugte Töne und das vorausgeplante Pausensignal
js/config.js            Adresse des Rückkanals – leer heißt: kein Server
js/telemetry.js         Melden, löschen, Betreiber-Übersicht (siehe Rückkanal)
js/ics.js               Trainingstermine als Kalenderdatei (.ics)
sw.js                   Service Worker für den Offline-Betrieb
manifest.webmanifest    Installierbar als App auf dem Homescreen
icon.svg                Quelle des Symbols
icon-192/512/maskable   Erzeugt: dieselben Symbole als PNG für den Launcher
data/…xlsx              Quelle des Plans
tools/build-data.py     Generator: Excel + Hinweise -> js/data.js
tools/exercise-meta.json  Muskelgruppe, Equipment und Ausführungshinweise je Übung
tools/build-plan.py     Generator: Ziele je Muskelgruppe -> tools/plan.json
tools/build-icons.mjs   Generator: icon.svg -> die drei PNGs
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

## Trainingsfokus

Nicht jeder will dasselbe. Wer den Link weitergibt, gibt ihn an Menschen, die
sich für Beine und Gesäß interessieren oder ausschließlich für den Oberkörper –
und dann soll der Plan nicht „ausgewogen" heißen und trotzdem zehn Sätze Brust
rechnen.

Der Fokus ist deshalb **kein Filter über einen Plan, sondern ein eigener Plan**.
`tools/build-plan.py <variante>` läuft mit anderen Wochenzielen durch dieselbe
Rechnung: exakte Wochensummen, 48 Stunden Erholung, gleichmäßige Verteilung,
gruppierte Geräte. Es ändert sich nichts an der Sorgfalt, nur an der Betonung.

| Variante | Betonung |
| --- | --- |
| `standard` – Ausgewogen | Rücken, Brust, seitliche Schulter vorn; Beine laufen mit |
| `bbp` – Bauch, Beine, Po | Gesäß 15, Beine 12, Bauch 12 Sätze/Woche; Oberkörper reduziert |
| `oberkoerper` – Oberkörper | Brust, Rücken, Schultern, Arme je 12; Beine ein Auftritt/Woche |
| `kurz` – Kurz und knapp | dieselben Übungen, überall weniger Sätze – kürzere Einheiten |

`cap` steht je Variante dabei, weil die Obergrenze in Wahrheit nur den Nacken
bindet: Wer Rücken und hintere Schulter hochzieht, treibt ihn mit hoch, und eine
10 wäre dort unerfüllbar (siehe *Der Nacken bekommt keinen einzigen eigenen
Satz*).

Alle Varianten liegen zusammen in `js/data.js` unter `PLANS`. Welche gilt, liest
die Datei beim Laden selbst aus dem Speicher (`focus`) – so meinen `PLAN`,
`TARGET` und `REST` überall dasselbe, auch in Modulen, die den Zustand gar nicht
kennen. Ein Wechsel lädt die Seite neu: Der Plan steckt in Hunderten von Zeilen,
und ein Tausch mitten im Betrieb hieße, dass die halbe App noch mit dem alten
rechnet. Wer mittendrin wechselt, wird gefragt – der bisherige Verlauf wandert
in die Ablage, die erreichten Gewichte bleiben. Zurück geht es über *Mehr → Plan
neu starten → Verlauf zurückholen*.

### Erfahrung: dieselben Übungen, andere Startgewichte

Die Startgewichte in `tools/exercise-meta.json` sind die eines Menschen, der
seit einer Weile trainiert: 40 kg Floor Press, 20 kg Goblet Squat. Für jemand
anderen, der den Link bekommt, ist das entweder zu viel oder zu wenig – und
beides führt zum selben Ergebnis, nämlich dass die erste Einheit nichts taugt.

| Stufe | Faktor | Floor Press | Goblet Squat |
| --- | --- | --- | --- |
| Anfänger | ×0,5 | 20 kg | 10 kg |
| Geübt | ×1 | 40 kg | 20 kg |
| Fortgeschritten | ×1,5 | 60 kg | 30 kg |

Gerundet wird auf die Schrittweite der jeweiligen Übung, mindestens auf einen
Schritt. `0 kg` bleibt `0 kg`: Bei Klimmzügen heißt das „ohne Zusatzlast", und
das gilt für jeden.

Mehr ändert die Stufe nicht. Sätze, Pausen, Übungsauswahl und die
Erholungsregel sind für Anfänger dieselben – daran ist nichts
anfängerspezifisch. Und sobald jemand ein Gewicht selbst einstellt, gilt seins:
Die Stufe ist ein Startpunkt, keine Obergrenze.

### Einrichten in vier Schritten

Wer den Link zum ersten Mal öffnet, bekommt **Name, Farbe, Erfahrung, Fokus** –
in dieser Reihenfolge, eine Frage pro Bildschirm. Die Farbe wirkt sofort, damit
die Auswahl nicht abstrakt bleibt; bei der Erfahrung stehen zwei Beispielgewichte
unter jeder Stufe. Am Ende steht der Hinweis, dass sich unter *Mehr → Eigenes
Workout* ohnehin jede Einheit selbst zusammenstellen lässt: Der Fokus ist ein
Vorschlag, kein Korsett.

## Eigene Workouts

Der Plan deckt 21 Wochen ab und rechnet sein Wochenvolumen aus 84 festen
Einheiten. Etwas dazwischenzuschieben würde diese Rechnung stillschweigend
verschieben – deshalb stehen eigene Einheiten **neben** dem Plan: Sie laufen in
derselben Fokus-Ansicht mit Pausen, Gewichten und Bewegungsbildern, aber sie
zählen nicht als erledigte Plan-Einheit. Ihre Sätze und Kilo tauchen in der
Statistik trotzdem auf, mit dem Zusatz „(x eigene)" – trainiert ist trainiert.

Gedacht für die Fälle, die der Plan nicht kennt: im Urlaub nur das, wofür es ein
Gerät gibt; nach einer Pause etwas Kurzes; oder eine Extraeinheit für eine
Muskelgruppe, die man selbst zu kurz findet.

Technisch sind es Einheiten mit einer Kennung statt einer Nummer (`c…`). Alles,
was am Workout hängt – Sätze, Gewichte, Modus, Pausen –, ist ohnehin nach dieser
Kennung abgelegt; nur `effDate()`, `exOf()` und `workoutByNo()` müssen wissen,
dass es keinen Plantermin dazu gibt.

## Vergleich mit Freunden

**Ohne Server.** Es gibt keine Konten, keine Anmeldung und nichts, was im
Hintergrund abgleicht; die App liegt als statische Seite auf GitHub Pages und
soll dort bleiben. Ein Vergleich braucht aber die Zahlen des anderen – also
wandern sie im Link mit: Einheiten, Sätze, Volumen, Serie, base64-kodiert im
Anker (`#stand=…`).

Wer den Link öffnet, bekommt die Rückfrage „übernehmen?" und hat den Stand
danach lokal gespeichert. Die Statistik zeigt daraus eine Rangliste – mit
Trainingsfokus, letztem Training und dem Alter des Standes darunter. „Zuletzt
vor 15 Tagen" ist die interessanteste Zeile überhaupt, und ohne das Alter hielte
man einen drei Wochen alten Wert für den heutigen. Ein zweiter Stand desselben
Menschen ersetzt den ersten; der Schlüssel ist der Name.

Der Rückweg wird angeboten, statt ihn zu erwarten: Wer einen Stand übernimmt,
sieht darüber „*X* sieht deinen Stand erst, wenn du ihn zurückschickst" mit
einem Knopf dafür. Ohne das bleibt der Vergleich einseitig.

Kommt der Link an, während die App schon offen ist, lädt der Browser nichts neu
– er ändert nur den Anker. Ein `hashchange`-Zweig fängt genau das ab.

Das ist der ehrliche Umfang dessen, was ohne Server geht, und es reicht für das,
worum es geht: zu sehen, wer gerade vorn liegt.

## Farbdesign

Fünf Farben unter *Mehr*: Orange (Standard), Rosa, Blau, Grün, Violett. Geändert
werden nur die beiden Akzente – Hintergrund, Linien und das Grün für „erledigt"
bleiben, damit die App überall gleich lesbar ist.

Zwei Akzente, nicht einer: Die Hantel-Variante ist warm, die Bodyweight-Variante
kühl. Daran erkennt man den Modus, ohne den Schalter zu lesen. Das Design setzt
beide (`--accent-db`, `--accent-bw`), und `body.mode-bw` schaltet zwischen ihnen
um. Das Attribut sitzt am `<html>` und nicht am `<body>`: `--accent` wird auf
`:root` abgeleitet und nähme sonst weiter den Standardwert von dort.

## Rückkanal und Betreiber-Übersicht

Die App ist ohne ihn vollständig – kein Konto, kein Server, alles im Browser.
Er beantwortet genau eine Frage, die von innen nicht zu beantworten ist: wie die
App bei den Leuten läuft, denen der Link geschickt wurde.

**Ohne Eintrag in `js/config.js` gibt es ihn nicht.** Kein Text, kein Schalter,
keine Verbindung; das ist der Auslieferungszustand und der Grund, warum die App
weiter offline und ohne Konto läuft.

### Drei Regeln

* **Sichtbar.** Wer die App einrichtet, liest im letzten Schritt in einem Satz,
  was rausgeht und an wen – mit dem Schalter direkt daneben. Unter *Mehr* steht
  derselbe Satz noch einmal, dazu der Zeitpunkt der letzten Meldung.
* **Abschaltbar.** Ein Tipp, und es geht nichts mehr raus. *Meine Daten dort
  löschen* entfernt die eigene Zeile auch rückwirkend.
* **Wenig.** Nur, was in der App ohnehin auf dem Bildschirm steht: Name, Fokus,
  Erfahrungsstufe, Einheiten, Sätze, Volumen, Serie, letztes Training, Sätze je
  Übung, wie oft weitergeschickt, wie viele Freundes-Stände übernommen wurden –
  dazu eine Zufallszahl als Kennung des Geräts. Keine Uhrzeiten (der Server
  vermerkt nur den Tag der letzten Meldung), keine Adressen, nichts von
  außerhalb dieser App. Dieselbe Aufzählung steht wortgleich in der App.

Heimlich mitzuzählen wäre technisch dasselbe und trotzdem etwas anderes: Die App
verspricht jedem beim ersten Start, dass nichts von allein sein Gerät verlässt.
Eine Zusage, die sie an anderer Stelle bricht, ist schlimmer als gar keine.

### Einrichten (einmalig, ~5 Minuten)

1. Auf [supabase.com](https://supabase.com) ein kostenloses Projekt anlegen.
2. Im **SQL-Editor** das Folgende am Stück ausführen. `DEIN-PASSWORT` ist frei
   wählbar und steht nur hier, nie in der App. Der Block ist wiederholbar – ein
   zweiter Lauf stirbt nicht am ersten Statement und löscht nichts:

```sql
create table if not exists nutzung (
  id text primary key,
  name text, fokus text, stufe text,
  einheiten int, plan int, saetze int, volumen int, serie int,
  zuletzt date, geteilt int, freunde int,
  uebungen jsonb,
  gesehen date default current_date
);

-- Falls die Tabelle schon steht und aus einer aelteren Fassung stammt: Der
-- Block soll auch dann durchlaufen und nicht an einer fehlenden Spalte scheitern.
alter table nutzung add column if not exists name text;
alter table nutzung add column if not exists fokus text;
alter table nutzung add column if not exists stufe text;
alter table nutzung add column if not exists einheiten int;
alter table nutzung add column if not exists plan int;
alter table nutzung add column if not exists saetze int;
alter table nutzung add column if not exists volumen int;
alter table nutzung add column if not exists serie int;
alter table nutzung add column if not exists zuletzt date;
alter table nutzung add column if not exists geteilt int;
alter table nutzung add column if not exists freunde int;
alter table nutzung add column if not exists uebungen jsonb;
alter table nutzung add column if not exists gesehen date default current_date;
-- Nur ein Datum, keine Uhrzeit: So steht es in der Zusage an die Nutzer.
alter table nutzung alter column gesehen type date;

alter table nutzung enable row level security;

-- Regeln aus aelteren Fassungen: Sie greifen ohnehin nicht mehr, sobald anon
-- kein Recht auf der Tabelle hat – aber sie sollen auch nicht herumliegen.
drop policy if exists schreiben on nutzung;
drop policy if exists aendern   on nutzung;
drop policy if exists loeschen  on nutzung;

-- Erst weg, dann neu: Ändert sich der Rückgabetyp einer Funktion – entferne()
-- gibt jetzt die Zahl der gelöschten Zeilen zurück –, verweigert
-- "create or replace" den Dienst.
drop function if exists melde(jsonb);
drop function if exists entferne(text);
drop function if exists admin_liste(text);

-- Geschrieben wird über diese Funktion, nicht über die Tabelle. Sie läuft mit
-- den Rechten ihres Besitzers – deshalb braucht anon auf nutzung selbst gar
-- kein Recht, und damit gibt es auch nichts, was versehentlich lesbar wäre.
-- pg_temp steht am Ende des Suchpfads, sonst käme es zuerst.
create or replace function melde(zeile jsonb)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare kennung text := zeile->>'id';
begin
  -- Schreiben darf jeder, der den Link hat. Was er schreibt, hat trotzdem eine
  -- Form zu haben: eine Kennung wie die der App, und nicht beliebig viel davon.
  if kennung is null or kennung !~ '^[A-Za-z0-9-]{8,64}$' then
    raise exception 'ungueltige Kennung';
  end if;
  if length(zeile::text) > 4000 then
    raise exception 'Zeile zu gross';
  end if;

  insert into nutzung (id, name, fokus, stufe, einheiten, plan, saetze,
                       volumen, serie, zuletzt, geteilt, freunde, uebungen, gesehen)
  select z.id, left(z.name, 60), left(z.fokus, 40), left(z.stufe, 40),
         z.einheiten, z.plan, z.saetze, z.volumen, z.serie, z.zuletzt,
         z.geteilt, z.freunde, z.uebungen, current_date
    from jsonb_populate_record(null::nutzung, zeile) z
  on conflict (id) do update set
    name = excluded.name, fokus = excluded.fokus, stufe = excluded.stufe,
    einheiten = excluded.einheiten, plan = excluded.plan, saetze = excluded.saetze,
    volumen = excluded.volumen, serie = excluded.serie, zuletzt = excluded.zuletzt,
    geteilt = excluded.geteilt, freunde = excluded.freunde,
    uebungen = excluded.uebungen, gesehen = current_date;
end $$;

-- Der Weg zurück: die eigene Zeile wieder entfernen. Gibt zurück, wie viele
-- Zeilen weggingen – sonst müsste die App "Gelöscht" sagen, ohne es zu wissen.
create or replace function entferne(geraet text)
returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare weg int;
begin
  delete from nutzung where id = geraet;
  get diagnostics weg = row_count;
  return weg;
end $$;

-- Gelesen wird nur hier, und nur mit Passwort. Die Sekunde Verzögerung bei
-- einem Fehlversuch macht aus dem Durchprobieren eine Geduldsprobe.
create or replace function admin_liste(pass text)
returns setof nutzung
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if pass is distinct from 'DEIN-PASSWORT' then
    perform pg_sleep(1);
    raise exception 'nope';
  end if;
  return query select * from nutzung order by einheiten desc;
end $$;

-- Nur die drei Funktionen sind erreichbar, die Tabelle selbst nicht.
revoke all on table nutzung from anon, authenticated;
revoke all on function melde(jsonb), entferne(text), admin_liste(text)
  from public, anon, authenticated;
grant execute on function melde(jsonb), entferne(text), admin_liste(text) to anon;
```

   Der Block lässt sich jederzeit erneut ausführen – auch über eine bestehende
   Einrichtung. Er legt nichts doppelt an, löscht keine Zeilen und bringt eine
   ältere Tabelle auf den heutigen Stand.

3. In `js/config.js` `url` und `key` eintragen (Projekt-URL und der öffentliche
   Schlüssel aus *Project Settings → API Keys*; `anon`-JWT oder der neue
   `sb_publishable_…` – beides geht). Beide dürfen öffentlich sein: Mit dem
   Block oben kommt man damit an genau drei Funktionen, und die eine, die etwas
   herausgibt, will ein Passwort.
4. `python3 tools/build-single.py`, committen, pushen.

Die Übersicht steht danach unter *Mehr → Übersicht öffnen* und fragt nach dem
Passwort aus Schritt 2. Sie zeigt Geräte insgesamt, wie viele in den letzten
sieben Tagen offen waren, wer wie weit ist, wann er zuletzt trainiert hat, die
Verteilung von Fokus und Erfahrung und die meistgemachten Übungen.

**Warum über Funktionen und nicht über die Tabelle:** Weil der direkte Weg mit
genau dieser Absicht – schreiben ja, lesen nein – gar nicht funktioniert. Die App
schreibt eine Zeile je Gerät, also einen Upsert; PostgREST macht daraus
`insert … on conflict (id) do update`. Und dabei prüft Postgres die Zeile
zusätzlich gegen die **select**-Regeln, auch wenn die Tabelle leer ist und gar
kein Konflikt auftreten kann. Gibt es keine select-Regel, ist die Prüfliste leer,
und jeder Schreibversuch scheitert – mit einer Meldung, die auf die falsche
Fährte führt:

```
ERROR:  new row violates row-level security policy for table "nutzung"
```

Nachgestellt mit PostgreSQL 16: reiner `insert` als `anon` geht durch, derselbe
`insert … on conflict` scheitert – ohne select-Recht mit `permission denied`, mit
select-Recht (das Supabase neuen Tabellen automatisch gibt) mit der Meldung oben.
Eine select-Regel dazuzunehmen würde die Tabelle für jeden lesbar machen, der den
Link hat; genau das soll sie nicht sein.

Die Funktion hat diese Stelle nicht: Sie läuft mit den Rechten ihres Besitzers,
und auf die Tabelle selbst hat außer ihr niemand ein Recht.

Wer eine ältere Einrichtung mit Regeln statt Funktionen hat, muss nichts tun –
die App fällt darauf zurück, wenn es `melde` nicht gibt.

### Wenn nichts ankommt

Unter *Mehr → Nutzung teilen* steht **Jetzt melden**. Der Knopf schickt sofort
und schreibt die Antwort des Servers darunter, statt sie zu verschlucken –
danach muss nicht mehr geraten werden:

| Antwort | Ursache |
| --- | --- |
| `401/403: Invalid API key` | Schlüssel in `js/config.js` gehört nicht zu diesem Projekt |
| `404` oder `PGRST202` | die Funktion `melde` fehlt – Block aus Schritt 2 lief nicht durch. Direkt danach kann es auch heißen: PostgREST kennt sie noch nicht, ein paar Sekunden warten und noch einmal tippen |
| `…new row violates row-level security policy…` | der Block aus Schritt 2 lief nicht; geschrieben wurde direkt in die Tabelle, und daran scheitert der Upsert (siehe oben) |
| `…permission denied for function melde…` | `grant execute` fehlt |
| `…ungueltige Kennung…` / `…Zeile zu gross…` | die Funktion hat die Zeile abgewiesen – so soll sie sich gegen Fremdes wehren; bei der eigenen App kommt das nicht vor |
| `Keine Verbindung` | kein Netz, oder die Projekt-URL stimmt nicht |

Der Status allein sagt wenig: Ein abgelehnter Schreibversuch kommt bei Supabase
als **401** zurück, nicht als 403, sobald die Anfrage als anonyme Rolle ankommt.
Es zählt der Text dahinter.

Nachsehen lässt sich das im SQL-Editor:

```sql
select routine_name from information_schema.routines
 where routine_schema = 'public' and routine_name in ('melde', 'entferne', 'admin_liste');

select p.proname, r.rolname
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  left join lateral aclexplode(p.proacl) a on true
  left join pg_roles r on r.oid = a.grantee
 where n.nspname = 'public' and p.proname in ('melde', 'entferne', 'admin_liste');
```

Drei Funktionen, und `anon` steht bei jeder – dann liegt es nicht an der
Datenbank. Ein Schreibversuch lässt sich auch direkt nachspielen:

```sql
select melde('{"id":"probe","name":"Probe","einheiten":1}'::jsonb);
select id, name, einheiten, gesehen from nutzung where id = 'probe';
delete from nutzung where id = 'probe';
```

Das Passwort bleibt im Tab-Speicher (`sessionStorage`), nicht im dauerhaften:
Es öffnet die Zahlen aller anderen, und es hat weder in einer Sicherungsdatei
noch in einem Speicher zu stehen, den jedes Skript auf der Seite lesen kann.
Wer den Tab schließt, tippt es beim nächsten Mal wieder ein.

**Warum ein Passwort und kein zweiter Schlüssel:** Ein Schlüssel mit Leserecht
müsste in der App liegen und läge damit bei allen, die den Link haben. Die
Funktion `admin_liste` läuft dagegen mit den Rechten ihres Besitzers und gibt
nur bei passendem Passwort Zeilen zurück; das Passwort steht nirgends im Code.

## Weitergeben

Unter *Mehr* steht ein Knopf **Link teilen**. Er ruft den Systemdialog
(`navigator.share`) – auf dem Handy also WhatsApp, Signal, Mail, was da ist –,
daneben liegen ein direkter WhatsApp-Knopf und *Link kopieren* als Rückfallweg
für Browser ohne den Dialog.

Wer den Link öffnet, hat dieselbe App: denselben Plan, dieselben Bewegungen,
offline. Beim ersten Start kommt eine Seite, die in vier Sätzen erklärt, was das
ist, und nach dem Namen fragt.

**Der Name ist kein Konto.** Es gibt keinen Server, keine Anmeldung und nichts,
was im Hintergrund abgleicht. Was jemand einträgt, bleibt auf seinem Gerät – bis
er selbst etwas verschickt: Für den Vergleich unter *Statistik* schickt man
seinen Stand als Link, und wer ihn bekommt, sieht die Zahlen darin.

Genau so steht es auch auf der Seite. Vorher stand dort „niemand sonst sieht es",
und das stimmte nicht mehr, seit es den Vergleich gibt – eine Zusage, die die App
an einer anderen Stelle bricht, ist schlimmer als gar keine.

Wer schon Daten hat, wird nicht begrüßt: Fehlt im gespeicherten Stand der
Schlüssel `greeted`, stammt er aus einer Fassung vor der Willkommensseite – und
dann ist derjenige nicht neu hier. In genau diesem Fall trägt sich auch der Name
selbst ein („Tobi"): Diese App ist für einen bestimmten Menschen gebaut, und
sein Stand ist der einzige, der aus der Zeit davor stammt. Änderbar ist er unter
*Mehr* in einer Zeile.

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

### Das Symbol auf dem Startbildschirm

Die Quelle ist `icon.svg`, ausgeliefert werden zusätzlich drei PNGs. Nicht aus
Nostalgie: **Firefox für Android nimmt für die Verknüpfung kein SVG.** Dort
stand statt der Hantel ein generierter Buchstabe mit Firefox-Abzeichen auf dem
Startbildschirm – Chrome kam mit dem SVG zurecht, Firefox nicht. Mit PNG in
den üblichen Größen sieht es überall gleich aus:

| Datei | wofür |
| --- | --- |
| `icon-192.png` | Startbildschirm und `apple-touch-icon` |
| `icon-512.png` | Splash-Screen und größere Raster |
| `icon-maskable-512.png` | `purpose: "maskable"` – Android schneidet daraus einen Kreis oder ein Rundeck |

Die maskierbare Fassung ist bewusst eine **eigene**: Ihr Hintergrund reicht
bis an den Rand (eigene runde Ecken würden doppelt abgeschnitten) und die
Hantel sitzt auf 74 % verkleinert in der Mitte, damit sie den Beschnitt
überlebt. Neu erzeugen nur nötig, wenn sich `icon.svg` ändert – die Dateien
liegen im Repository:

```bash
node tools/build-icons.mjs
```

Playwright rastert dabei das SVG; es ist Werkzeug, keine Abhängigkeit der App.
`dist/workout.html` bekommt das 192er-PNG als Data-URI eingebettet, damit auch
die Einzeldatei ein Symbol hat.

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

Beim Einlesen wird geprüft, was hereinkommt: Eine Datei ohne `log` wird
abgewiesen, falsche Typen und Fremdfelder fallen weg. Nicht aus Misstrauen –
eine halb passende Datei hinterließe sonst still einen Zustand, in dem die App
merkwürdig wird.

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
