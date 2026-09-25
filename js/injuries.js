/*
 * Verletzungen und Beschwerden.
 *
 * Wer etwas anhakt, bekommt einen angepassten Plan: betroffene Übungen fallen
 * weg oder werden getauscht, und zwar dauerhaft, bis der Haken wieder weg ist.
 *
 * Zwei Listen je Eintrag:
 *
 *   avoid   Übungen, die mit dieser Beschwerde nicht in den Plan gehören.
 *   swap    Ersatz, wo es einen gibt, der dieselbe Richtung trainiert, ohne
 *           die betroffene Stelle zu belasten. Ohne Eintrag fällt die Übung
 *           ersatzlos weg – das ist ehrlicher als ein Ersatz, der auch weh tut.
 *   care    Was stattdessen gut tut: dehnen, mobilisieren, gezielt kräftigen.
 *           Steht in CARE weiter unten und zählt nicht ins Wochenvolumen.
 *
 * Ein Ersatz kann selbst gesperrt sein, wenn eine zweite Beschwerde dazukommt.
 * Dann greift er nicht und die Übung fällt doch weg; genau das zeigt der Tab
 * als Wechselwirkung an. Ausgerechnet wird das, nicht behauptet.
 *
 * `spot` ist die Stelle auf der 3D-Figur, `kind` bestimmt das Symbol.
 *
 * Das hier ersetzt keine Diagnose. Die Zuordnungen sind gängige
 * Trainingslehre – was im Einzelfall gut tut, weiß nur eine Untersuchung.
 */

export const KIND_LABEL = {
  bruch: 'Bruch',
  riss: 'Riss',
  zerrung: 'Zerrung',
  reizung: 'Reizung',
  vorfall: 'Vorfall',
  blockade: 'Blockade',
  prellung: 'Prellung',
};

/*
 * Fünf Übungen kamen später dazu (Inverted Row, einbeiniges Kreuzheben,
 * Pike-Liegestütze, Kurzhantel-Bodenpresse, Reverse Snow Angel). Ihre Sperren
 * sind nicht nach Gefühl gesetzt, sondern mechanisch abgeleitet: **Jede erbt
 * die Sperren ihres Bewegungsvorbilds.**
 *
 *   Inverted Row              wie einarmiges Rudern (waagerechtes Ziehen)
 *                             plus Klimmzug (derselbe Griff)
 *   Einbeiniges Kreuzheben    wie Rumänisches Kreuzheben (Hüftstreckung)
 *                             plus einbeiniger Beinbeuger (ein Bein)
 *   Pike-Liegestütze          wie Schulterdrücken (über Kopf)
 *                             plus Liegestütze mit erhöhten Füßen (Handstand)
 *   Kurzhantel-Bodenpresse    wie Floor Press
 *   Reverse Snow Angel        wie Reverse Fly (hintere Schulter)
 *                             plus Crunches (Rumpf am Boden)
 *
 * Das ergab 43 Einträge in 26 Regeln, und wo das Vorbild einen Ersatz nennt,
 * ist er mitgekommen – sofern das Ziel in derselben Regel nicht selbst gesperrt
 * ist. Die Ableitung irrt eher in Richtung „lieber nicht": Eine Übung zu viel
 * auszulassen kostet ein paar Sätze, eine zu wenig kostet Wochen.
 *
 * Zwei weitere kamen später dazu, und bei ihnen läuft die Ableitung einmal in
 * die andere Richtung:
 *
 *   Trizepsstrecken an der Tischkante   wie der Überkopf-Trizepsstrecker (Ellenbogen
 *                                   streckt gegen Last) plus Inverted Row
 *                                   (derselbe Griff an derselben Kante)
 *                                   – **außer** beim Schulter-Impingement: Dort
 *                                   fällt das Vorbild wegen der Überkopfstellung
 *                                   aus, die es hier nicht gibt. Statt zu erben,
 *                                   springt sie dort für das Vorbild ein.
 *   Beckenheben                     wie der Hip Thrust (dieselbe Hüftstreckung)
 *                                   – **außer** bei ISG-Blockade und
 *                                   Beinbeugerzerrung: Beide Regeln führen das
 *                                   Beckenheben selbst unter care als Übung zum
 *                                   Kräftigen auf. Was eine Regel empfiehlt,
 *                                   kann sie nicht zugleich verbieten; dort
 *                                   ersetzt es den Hip Thrust.
 *
 * Beide Ausnahmen sind derselbe Gedanke: Eine abgeleitete Sperre gilt nur,
 * solange der Grund des Vorbilds auch für die neue Übung gilt.
 */
export const INJURIES = [
  /* ---------------- Schulter ---------------- */
  {
    id: 'schulter-impingement',
    name: 'Schulter-Impingement',
    area: 'Schulter', spot: 'shoulder', kind: 'reizung',
    text: 'Der Raum unter dem Schulterdach wird eng. Typisch ist der Schmerz beim '
      + 'Heben des Arms zwischen etwa 60° und 120° – seitlich mehr als vorn. '
      + 'Drücken am Boden mit kurzem Weg geht meist, Heben über Schulterhöhe nicht.',
    avoid: ['sitzendes-seitheben', 'band-seitheben', 'fuesse-erhoehte-liegestuetze',
      'sitzendes-schulterdruecken', 'liegende-trizepsstrecker',
      'pike-liegestuetze',
      'flaschen-seitheben',
      'sitzendes-flaschen-seitheben'],
    // Der Überkopf-Trizepsstrecker fällt aus, weil der Arm dabei über dem Kopf
    // steht – genau der Bogen, der weh tut. An der niedrigen Kante bleibt er
    // darunter, also steht hier ein Tausch statt einer Lücke: Sonst verlöre der
    // Trizeps seine einzige eigene Übung.
    swap: { 'sitzendes-seitheben': 'reverse-fly', 'fuesse-erhoehte-liegestuetze': 'floor-press',
      'pike-liegestuetze': 'floor-press', 'liegende-trizepsstrecker': 'trizeps-strecken-stange',
      // Wie beim Pike: Drücken am Boden bleibt unter dem Bogen, der weh tut. Das
      // Schulterdrücken fiel vorher ersatzlos weg, obwohl sein Schmerztext
      // „wird durch Drücken am Boden ersetzt" sagte.
      'sitzendes-schulterdruecken': 'floor-press' },
    care: [
      'aussenrotation', 'wandengel', 'brustdehnung', 'schulterblatt', 'sleeper',
    ],
  },
  {
    id: 'rotatorenmanschette',
    name: 'Rotatorenmanschetten-Riss',
    area: 'Schulter', spot: 'shoulder', kind: 'riss',
    text: 'Riss in einer der vier Sehnen, die den Oberarmkopf in der Pfanne führen. '
      + 'Alles, was den Arm gegen Widerstand hebt, dreht oder drückt, fällt aus. '
      + 'Hier gehört ein Arzt drauf, nicht ein Trainingsplan.',
    avoid: ['sitzendes-seitheben', 'band-seitheben', 'fuesse-erhoehte-liegestuetze', 'gewichtete-liegestuetze',
      'floor-press', 'reverse-fly', 'chin-ups', 'pull-ups', 'einarmiges-kh-rudern',
      'sitzendes-schulterdruecken', 'haengendes-knieheben', 'band-pull-apart', 'face-pull',
      'liegende-trizepsstrecker', 'trizeps-strecken-stange',
      'inverted-row', 'pike-liegestuetze', 'kurzhantel-bodenpresse', 'reverse-snow-angel',
      'flaschen-seitheben',
      'rucksack-rudern', 'sitzendes-flaschen-seitheben'],
    swap: { 'haengendes-knieheben': 'liegendes-knieheben',},
    care: ['aussenrotation', 'schulterblatt'],
  },
  {
    id: 'ac-gelenk',
    name: 'AC-Gelenk-Reizung (Schultereck)',
    area: 'Schulter', spot: 'shoulder', kind: 'reizung',
    text: 'Das kleine Gelenk zwischen Schlüsselbein und Schulterdach. Es meldet sich, '
      + 'wenn der Arm quer vor dem Körper zusammengeführt wird – also beim Drücken '
      + 'und bei allem, was die Schultern nach vorn zieht.',
    avoid: ['gewichtete-liegestuetze', 'fuesse-erhoehte-liegestuetze', 'floor-press',
      'liegende-trizepsstrecker', 'trizeps-strecken-stange',
      'pike-liegestuetze', 'kurzhantel-bodenpresse'
    ],
    swap: { 'fuesse-erhoehte-liegestuetze': 'reverse-fly', 'pike-liegestuetze': 'reverse-fly' },
    care: ['schulterblatt', 'brustdehnung', 'aussenrotation'],
  },
  {
    id: 'bizepssehne',
    name: 'Reizung der langen Bizepssehne',
    area: 'Schulter', spot: 'upperArm', kind: 'reizung',
    text: 'Die lange Bizepssehne läuft durch eine Rinne am Oberarmkopf. Sie reibt bei '
      + 'Zug mit gestrecktem Arm und bei allem, was den Unterarm gegen Widerstand '
      + 'nach außen dreht – Curls und Klimmzüge im Untergriff also.',
    // Der Hammercurl steht mit auf der Liste, obwohl er den Unterarm gerade
    // *nicht* nach außen dreht. Das Aufdrehen reizt am stärksten, es ist aber
    // nicht die einzige Last: Der Bizeps zieht über dieselbe Sehne, ob die
    // Hand dabei gedreht ist oder nicht. Er ist hier der mildere von beiden
    // Curls und trotzdem keiner, den man auf eine gereizte Sehne legt.
    avoid: ['sz-curls', 'chin-ups',
      'haengendes-knieheben', 'pull-ups',
      'inverted-row',
      'rucksack-curls', 'hammer-curls'],
    // Ersatz ist das Rudern, nicht der Obergriff: Pull-ups drehen den Unterarm
    // zwar nicht nach außen, hängen ihn aber gestreckt an die Stange – und
    // genau dieser Zug reizt die Sehne ebenfalls.
    swap: { 'haengendes-knieheben': 'liegendes-knieheben', 'chin-ups': 'einarmiges-kh-rudern', 'inverted-row': 'einarmiges-kh-rudern',
      // Die Pull-ups fielen hier ersatzlos weg, während ihr eigener Schmerztext
      // „dann übernimmt das Rudern" versprach. Dasselbe Argument wie bei den
      // Chin-ups: Rudern zieht in dieselbe Richtung, ohne gestreckt zu hängen.
      'pull-ups': 'einarmiges-kh-rudern' },
    care: ['aussenrotation', 'brustdehnung', 'beugerDehnen'],
  },

  /* ---------------- Ellenbogen und Hand ---------------- */
  {
    id: 'tennisarm',
    name: 'Tennisarm (Epicondylitis lateralis)',
    area: 'Ellenbogen', spot: 'elbow', kind: 'reizung',
    text: 'Der Ansatz der Handstrecker an der Außenseite des Ellenbogens ist gereizt. '
      + 'Weh tut vor allem Zugreifen und Festhalten – Rudern, Klimmzüge, Curls. '
      + 'Drücken belastet ihn kaum.',
    avoid: ['chin-ups', 'pull-ups', 'sz-curls', 'einarmiges-kh-rudern',
      'haengendes-knieheben',
      'inverted-row', 'trizeps-strecken-stange',
      'rucksack-curls', 'hammer-curls',
      'rucksack-rudern'],
    swap: { 'haengendes-knieheben': 'liegendes-knieheben',},
    care: [
      'streckerExzentrik', 'streckerDehnen', 'fingerstrecker', 'handgelenkMobil',
    ],
  },
  {
    id: 'golferarm',
    name: 'Golferarm (Epicondylitis medialis)',
    area: 'Ellenbogen', spot: 'elbow', kind: 'reizung',
    text: 'Dasselbe an der Innenseite, am Ansatz der Handbeuger. Auch hier ist der '
      + 'Griff das Problem, dazu jede kräftige Beugung im Ellenbogen.',
    avoid: ['chin-ups', 'pull-ups', 'sz-curls', 'einarmiges-kh-rudern',
      'haengendes-knieheben',
      'inverted-row', 'trizeps-strecken-stange',
      'rucksack-curls', 'hammer-curls',
      'rucksack-rudern'],
    swap: { 'haengendes-knieheben': 'liegendes-knieheben',},
    care: ['beugerExzentrik', 'beugerDehnen', 'handgelenkMobil'],
  },
  {
    id: 'ellenbogen-bursitis',
    name: 'Schleimbeutelentzündung am Ellenbogen',
    area: 'Ellenbogen', spot: 'elbow', kind: 'reizung',
    text: 'Der Schleimbeutel an der Ellenbogenspitze schwillt an und drückt. Direkter '
      + 'Druck auf den Ellenbogen und volle Streckung gegen Widerstand sind unangenehm.',
    avoid: ['liegende-trizepsstrecker', 'trizeps-strecken-stange',
      'gewichtete-liegestuetze', 'floor-press',
      'kurzhantel-bodenpresse'
    ],
    swap: { 'gewichtete-liegestuetze': 'reverse-fly' },
    care: ['streckerDehnen', 'beugerDehnen', 'schulterblatt'],
  },
  {
    id: 'handgelenk-reizung',
    name: 'Handgelenksüberlastung',
    area: 'Handgelenk', spot: 'wrist', kind: 'reizung',
    text: 'Schmerz, wenn das Handgelenk unter Last nach hinten abknickt – genau die '
      + 'Stellung beim Liegestütz. Mit gerader Hand am Griff geht es meist gut. '
      + 'Dazu gehört, was den Unterarm fest aufgedreht hält: An einer Stange hängen '
      + 'beide Hände in derselben Drehung, und ändern kann sie keine.',
    // Gemeldet: „SZ curls tun echt in den unterarmen iwie weh. Ich spür den
    // Knochen iwie ganz stark oder so." Die SZ-Curls standen hier nicht, und
    // das war eine Luecke: Eine Stange koppelt beide Haende an eine feste
    // Drehung ueber den ganzen Weg. Der Ausweg ist keine Lücke, sondern der
    // Hammercurl – zwei Kurzhanteln, Handflaechen zueinander, jeder Unterarm
    // frei. Anteile identisch, die Wochenrechnung merkt nichts.
    avoid: ['gewichtete-liegestuetze', 'fuesse-erhoehte-liegestuetze',
      'pike-liegestuetze', 'sz-curls', 'rucksack-curls'
    ],
    swap: { 'gewichtete-liegestuetze': 'floor-press', 'fuesse-erhoehte-liegestuetze': 'floor-press', 'pike-liegestuetze': 'floor-press', 'sz-curls': 'hammer-curls', 'rucksack-curls': 'hammer-curls' },
    care: [
      'handgelenkMobil', 'streckerDehnen', 'beugerDehnen', 'fingerstrecker',
    ],
    // Im Bodyweight-Modus sind Floor Press und Bodenpresse Liegestütze, und der
    // Tausch oben landete damit genau in der Stellung, die hier verboten ist –
    // rund 300 Sätze über den Oberkörper-Plan, und der Tab meldete einen Tausch.
    // Einen Ersatz ohne Stütz auf der Hand gibt es ohne Geräte nicht; also
    // fällt es dort weg, und das ist ehrlicher als ein Ersatz, der auch weh tut.
    avoidBw: ['floor-press', 'kurzhantel-bodenpresse'],
  },
  {
    id: 'handgelenk-bruch',
    name: 'Handgelenkbruch',
    area: 'Handgelenk', spot: 'wrist', kind: 'bruch',
    text: 'Mit Gips oder frisch verheilt geht über die Hand keine Last. Damit fällt '
      + 'fast der ganze Oberkörper weg – übrig bleiben Übungen, bei denen die Hände '
      + 'nichts halten und nichts tragen.',
    avoid: ['goblet-squat', 'fersenerhoehter-goblet-squat', 'gewichtete-liegestuetze',
      'fuesse-erhoehte-liegestuetze', 'floor-press', 'einarmiges-kh-rudern', 'chin-ups', 'pull-ups',
      'reverse-fly', 'sitzendes-seitheben', 'band-seitheben', 'liegende-trizepsstrecker', 'sz-curls',
      'gewichtete-crunches',
      'split-squat', 'sitzendes-schulterdruecken', 'haengendes-knieheben', 'band-pull-apart', 'face-pull',
      'inverted-row', 'pike-liegestuetze', 'kurzhantel-bodenpresse', 'reverse-snow-angel',
      'flaschen-seitheben', 'rucksack-curls', 'hammer-curls', 'trizeps-strecken-stange',
      'rucksack-rudern', 'sitzendes-flaschen-seitheben'],
    swap: { 'haengendes-knieheben': 'liegendes-knieheben', 'goblet-squat': 'hip-thrust', 'fersenerhoehter-goblet-squat': 'hip-thrust' },
    care: ['handgelenkMobil', 'fingerstrecker', 'schulterkreisen'],
    // Mit Hanteln halten diese Übungen die Last in der Hand – Langhantel,
    // Kurzhantel, die Stange auf der Hüfte. Ohne Hanteln brauchen dieselben
    // Übungen die Hände nicht, deshalb gilt die Sperre nur dort. Vorher blieben
    // sie in beiden Modi stehen, und die App schlug mit frischem Bruch eine
    // 40-kg-Langhantel vor.
    avoidDb: ['rumaenisches-kreuzheben', 'einbeiniges-kreuzheben', 'hip-thrust',
      'beckenheben', 'wadenheben-gebeugtes-knie', 'einbeiniges-stehendes-wadenheben'],
  },
  {
    id: 'daumen-sehnenscheide',
    name: 'Sehnenscheidenentzündung am Daumen',
    area: 'Handgelenk', spot: 'wrist', kind: 'reizung',
    text: 'De Quervain: die Sehnen zum Daumen laufen durch ein zu enges Fach an der '
      + 'Speichenseite. Alles, was fest gegriffen wird, zieht daran.',
    // De Quervain trifft die Speichenseite, und dort liegt beim Hammergriff
    // der Daumen oben unter der ganzen Last. Er ist hier nicht der sanftere
    // Curl, sondern der unangenehmere.
    avoid: ['chin-ups', 'pull-ups', 'einarmiges-kh-rudern', 'sz-curls',
      'haengendes-knieheben',
      'inverted-row',
      'rucksack-curls', 'hammer-curls',
      'rucksack-rudern'],
    swap: { 'haengendes-knieheben': 'liegendes-knieheben',},
    care: ['streckerDehnen', 'fingerstrecker', 'handgelenkMobil'],
  },
  {
    id: 'ringband',
    name: 'Ringbandverletzung am Finger',
    area: 'Hand', spot: 'hand', kind: 'riss',
    text: 'Das Band, das die Beugesehne am Knochen hält, ist überdehnt oder gerissen – '
      + 'klassisch vom Hängen an einer Kante. Jeder feste Griff belastet es.',
    avoid: ['chin-ups', 'pull-ups', 'einarmiges-kh-rudern',
      'haengendes-knieheben',
      'inverted-row',
      'rucksack-rudern'],
    swap: { 'haengendes-knieheben': 'liegendes-knieheben',},
    care: ['fingerstrecker', 'handgelenkMobil'],
  },

  /* ---------------- Rumpf ---------------- */
  {
    id: 'nacken',
    name: 'Nackenverspannung / HWS-Reizung',
    area: 'Nacken', spot: 'neck', kind: 'reizung',
    text: 'Verspannter Nacken meldet sich bei allem, was die Schultern hochzieht, und '
      + 'bei Übungen, in denen der Kopf gegen die Schwerkraft gehalten wird.',
    avoid: ['gewichtete-crunches', 'sitzendes-seitheben', 'band-seitheben',
      'sitzendes-schulterdruecken',
      'pike-liegestuetze', 'reverse-snow-angel',
      'flaschen-seitheben',
      'sitzendes-flaschen-seitheben'],
    swap: { 'sitzendes-seitheben': 'floor-press' },
    care: ['kinnZurueck', 'nackenSeite', 'schulterkreisen', 'brustdehnung'],
  },
  {
    id: 'hws-bandscheibe',
    name: 'Bandscheibenvorfall HWS',
    area: 'Nacken', spot: 'neck', kind: 'vorfall',
    text: 'Vorfall in der Halswirbelsäule, oft mit Ausstrahlung in den Arm. Zug am Arm '
      + 'und Last auf den Schultern sind tabu, ebenso jede Beugung des Nackens gegen '
      + 'Widerstand.',
    avoid: ['gewichtete-crunches', 'sitzendes-seitheben', 'band-seitheben', 'chin-ups', 'pull-ups', 'einarmiges-kh-rudern',
      'reverse-fly',
      'sitzendes-schulterdruecken', 'haengendes-knieheben',
      'inverted-row', 'pike-liegestuetze', 'reverse-snow-angel',
      'flaschen-seitheben',
      'rucksack-rudern', 'sitzendes-flaschen-seitheben'],
    swap: { 'haengendes-knieheben': 'liegendes-knieheben',},
    care: ['kinnZurueck', 'schulterkreisen', 'atmung'],
  },
  {
    // Gemeldet: „Langhantelrudern merk ich iwie am meisten im unteren rücken."
    // Dafuer gab es hier bislang nur den Hexenschuss und den Bandscheiben-
    // vorfall, und beides waere die falsche Auskunft gewesen: Wer einen
    // ueberlasteten Strecker als Vorfall anhakt, verliert das halbe
    // Unterkoerperprogramm wegen einer Diagnose, die er nicht hat. Der
    // Unterschied steht im Text und ist der, auf den es ankommt: Ein
    // ueberlasteter Muskel meldet sich breit und beim Halten, ein Nerv meldet
    // sich spitz und zieht ins Bein.
    //
    // Gesperrt wird deshalb nur, was den Rumpf *vorgebeugt gegen Last* haelt.
    // Die Inverted Row bleibt ausdruecklich drin und springt fuers Rudern ein:
    // Dort haengt der Koerper als Brett zwischen Haenden und Fersen, der
    // Strecker haelt mit, aber er haelt keinen Hebel mit Gewicht am Ende.
    id: 'rueckenstrecker',
    name: 'Überlasteter unterer Rücken',
    area: 'unterer Rücken', spot: 'lowerBack', kind: 'reizung',
    text: 'Der Streckerzug längs der Wirbelsäule ist überarbeitet, nicht verletzt. '
      + 'Typisch ist ein breites Ziehen beidseits der Wirbelsäule beim Halten – '
      + 'vorgebeugtes Rudern, Kreuzheben, alles, was den Rumpf gegen Last aufrecht '
      + 'hält. Zieht es dagegen spitz ins Gesäß oder ins Bein, ist es das hier nicht, '
      + 'und ein Trainingsplan ist dann die falsche Adresse.',
    avoid: ['einarmiges-kh-rudern', 'rumaenisches-kreuzheben', 'einbeiniges-kreuzheben',
      'rucksack-rudern'],
    swap: { 'einarmiges-kh-rudern': 'inverted-row',
      'rucksack-rudern': 'inverted-row',
      'rumaenisches-kreuzheben': 'hip-thrust', 'einbeiniges-kreuzheben': 'hip-thrust' },
    care: ['katzeKuh', 'deadBug', 'vogelhund', 'hueftbeuger'],
  },
  {
    id: 'lws-bandscheibe',
    name: 'Bandscheibenvorfall LWS',
    area: 'unterer Rücken', spot: 'lowerBack', kind: 'vorfall',
    text: 'Vorfall in der Lendenwirbelsäule. Beugung der Wirbelsäule unter Last ist das '
      + 'Gegenteil dessen, was hilft – Crunches fallen ganz weg, ebenso alles '
      + 'vorgebeugte. Gestützte Hüftstreckung ist meist gut verträglich.',
    // Das Kreuzheben stand hier lange nicht drin, obwohl der eigene Text
    // "alles vorgebeugte" nennt – eine belastete Hüftbeuge ist bei einem
    // Vorfall das Lehrbuchbeispiel für "nicht machen". Der Hip Thrust bleibt:
    // Er hält die Wirbelsäule gerade und ist genau die "gestützte
    // Hüftstreckung", die der Text als gut verträglich beschreibt.
    avoid: ['gewichtete-crunches', 'goblet-squat', 'fersenerhoehter-goblet-squat',
      'einarmiges-kh-rudern', 'reverse-fly',
      'split-squat', 'rumaenisches-kreuzheben',
      'inverted-row', 'einbeiniges-kreuzheben', 'reverse-snow-angel',
      'rucksack-rudern'],
    swap: { 'goblet-squat': 'hip-thrust',
      'fersenerhoehter-goblet-squat': 'hip-thrust',
      'rumaenisches-kreuzheben': 'hip-thrust', 'einbeiniges-kreuzheben': 'hip-thrust' },
    care: ['kobra', 'deadBug', 'vogelhund', 'hueftbeuger'],
  },
  {
    id: 'hexenschuss',
    name: 'Hexenschuss (Lumbago)',
    area: 'unterer Rücken', spot: 'lowerBack', kind: 'blockade',
    text: 'Der Rücken macht plötzlich dicht, meist nach einer ungünstigen Bewegung. '
      + 'Nichts Schweres aufrecht halten, nichts vorgebeugt ziehen; leichte Bewegung '
      + 'tut in der Regel besser als liegen bleiben.',
    // "Nichts Schweres aufrecht halten, nichts vorgebeugt ziehen" – das
    // Kreuzheben ist beides zugleich und gehörte von Anfang an hierher.
    avoid: ['goblet-squat', 'fersenerhoehter-goblet-squat', 'einarmiges-kh-rudern',
      'gewichtete-crunches',
      'split-squat', 'rumaenisches-kreuzheben',
      'inverted-row', 'einbeiniges-kreuzheben', 'reverse-snow-angel',
      'rucksack-rudern'],
    swap: { 'goblet-squat': 'hip-thrust', 'rumaenisches-kreuzheben': 'hip-thrust', 'einbeiniges-kreuzheben': 'hip-thrust' },
    care: ['katzeKuh', 'kobra', 'deadBug', 'hueftbeuger'],
  },
  {
    id: 'isg',
    name: 'ISG-Blockade',
    area: 'Becken', spot: 'pelvis', kind: 'blockade',
    text: 'Das Kreuz-Darmbein-Gelenk sitzt fest, der Schmerz sitzt tief seitlich über '
      + 'dem Gesäß. Einbeinige Belastung und kräftige Hüftstreckung reizen es.',
    avoid: ['hip-thrust', 'einbeiniger-sliding-leg-curl', 'einbeiniges-stehendes-wadenheben',
      'rumaenisches-kreuzheben',
      'einbeiniges-kreuzheben'
    ],
    // Das Beckenheben bleibt drin – es steht drei Zeilen tiefer als Übung zum
    // Kräftigen. Eine Regel, die dieselbe Bewegung zugleich verbietet und
    // empfiehlt, wäre keine Vorsicht, sondern ein Widerspruch: Der Unterschied
    // zum Hip Thrust ist die Last und der halbe Weg, und genau der ist gemeint.
    swap: { 'hip-thrust': 'beckenheben', 'einbeiniger-sliding-leg-curl': 'sliding-leg-curl',
      'einbeiniges-stehendes-wadenheben': 'wadenheben-gebeugtes-knie', 'einbeiniges-kreuzheben': 'sliding-leg-curl' },
    care: ['vogelhund', 'piriformis', 'glutebridge', 'huefte9090'],
  },
  {
    id: 'rippenprellung',
    name: 'Rippenprellung',
    area: 'Rippen', spot: 'ribs', kind: 'prellung',
    text: 'Prellung oder Anriss einer Rippe. Jedes kräftige Anspannen des Rumpfes tut '
      + 'weh, ebenso Druck von außen – die Hantel vor der Brust zum Beispiel.',
    avoid: ['gewichtete-crunches', 'goblet-squat', 'fersenerhoehter-goblet-squat',
      'split-squat',
      'reverse-snow-angel'
    ],
    swap: { 'goblet-squat': 'hip-thrust', 'fersenerhoehter-goblet-squat': 'hip-thrust' },
    care: ['atmung', 'schulterkreisen'],
  },
  {
    id: 'bauchmuskelzerrung',
    name: 'Bauchmuskelzerrung',
    area: 'Bauch', spot: 'abs', kind: 'zerrung',
    text: 'Gezerrte gerade Bauchmuskulatur, oft nach einer schnellen Drehung. Beugung '
      + 'gegen Widerstand fällt aus; halten und stabilisieren geht meist noch.',
    avoid: ['gewichtete-crunches',
      'reverse-snow-angel'
    ],
    swap: {},
    care: ['atmung', 'katzeKuh', 'deadBug'],
  },
  {
    id: 'brustmuskelzerrung',
    name: 'Zerrung der Brustmuskulatur',
    area: 'Brust', spot: 'chest', kind: 'zerrung',
    text: 'Meist am Übergang zur Sehne nahe der Achsel. Drücken und alles, was den Arm '
      + 'aus der gedehnten Stellung nach vorn bringt, ist betroffen.',
    avoid: ['gewichtete-liegestuetze', 'fuesse-erhoehte-liegestuetze', 'floor-press',
      'pike-liegestuetze', 'kurzhantel-bodenpresse'
    ],
    swap: {},
    care: ['brustdehnung', 'schulterblatt', 'aussenrotation'],
  },
  {
    id: 'leistenbruch',
    name: 'Leistenbruch (Hernie)',
    area: 'Leiste', spot: 'groin', kind: 'bruch',
    text: 'Eine Lücke in der Bauchwand, durch die Gewebe drückt. Jede kräftige '
      + 'Bauchpresse vergrößert sie – schwere Übungen im Stand und alles mit '
      + 'angehaltenem Atem fallen weg, bis das operiert ist.',
    avoid: ['goblet-squat', 'fersenerhoehter-goblet-squat', 'gewichtete-crunches',
      'hip-thrust', 'beckenheben', 'einarmiges-kh-rudern',
      'split-squat', 'rumaenisches-kreuzheben',
      'inverted-row', 'einbeiniges-kreuzheben', 'reverse-snow-angel',
      'rucksack-rudern'],
    swap: {},
    care: ['atmung', 'deadBug'],
  },

  /* ---------------- Hüfte und Bein ---------------- */
  {
    id: 'huefte-fai',
    name: 'Hüftimpingement (FAI)',
    area: 'Hüfte', spot: 'hip', kind: 'reizung',
    text: 'Schenkelhals und Pfannenrand stoßen in tiefer Beugung aneinander. Tiefe '
      + 'Kniebeugen kneifen vorn in der Leiste; Hüftstreckung aus flacher Stellung '
      + 'geht dagegen gut.',
    avoid: ['goblet-squat', 'fersenerhoehter-goblet-squat',
      'split-squat'],
    swap: { 'goblet-squat': 'hip-thrust', 'fersenerhoehter-goblet-squat': 'hip-thrust' },
    care: ['huefte9090', 'hueftbeuger', 'glutebridge', 'piriformis'],
  },
  {
    id: 'leistenzerrung',
    name: 'Leistenzerrung (Adduktoren)',
    area: 'Leiste', spot: 'groin', kind: 'zerrung',
    text: 'Die Adduktoren an der Oberschenkelinnenseite sind gezerrt. Breiter Stand und '
      + 'einbeinige Übungen ziehen daran.',
    avoid: ['goblet-squat', 'fersenerhoehter-goblet-squat', 'einbeiniger-sliding-leg-curl',
      'einbeiniges-stehendes-wadenheben',
      'split-squat',
      'einbeiniges-kreuzheben'
    ],
    swap: { 'rumaenisches-kreuzheben': 'sliding-leg-curl', 'einbeiniger-sliding-leg-curl': 'sliding-leg-curl',
      'einbeiniges-stehendes-wadenheben': 'wadenheben-gebeugtes-knie', 'einbeiniges-kreuzheben': 'sliding-leg-curl' },
    care: ['adduktoren', 'huefte9090', 'glutebridge'],
    // Im Bodyweight-Modus ist das Rumänische Kreuzheben eine einbeinige
    // Standwaage – dieselbe Belastung, die hier beim einbeinigen Kreuzheben
    // gesperrt ist. Mit der Langhantel steht man auf zwei Beinen.
    avoidBw: ['rumaenisches-kreuzheben'],
  },
  {
    id: 'patellasehne',
    name: 'Springerknie (Patellasehne)',
    area: 'Knie', spot: 'knee', kind: 'reizung',
    text: 'Die Sehne zwischen Kniescheibe und Schienbein ist gereizt. Tiefe Beugung '
      + 'unter Last drückt darauf, erhöhte Fersen machen es schlimmer, nicht besser.',
    avoid: ['fersenerhoehter-goblet-squat', 'goblet-squat',
      'split-squat'],
    swap: { 'goblet-squat': 'hip-thrust', 'fersenerhoehter-goblet-squat': 'hip-thrust' },
    care: ['wandsitz', 'beinbeugerDehnen', 'hueftbeuger', 'glutebridge'],
  },
  {
    id: 'meniskus',
    name: 'Meniskusriss',
    area: 'Knie', spot: 'knee', kind: 'riss',
    text: 'Riss im Faserknorpel zwischen Ober- und Unterschenkel. Tiefe Beugung unter '
      + 'Last und Drehung im belasteten Knie sind die kritischen Bewegungen.',
    avoid: ['goblet-squat', 'fersenerhoehter-goblet-squat', 'einbeiniger-sliding-leg-curl',
      'split-squat',
      'einbeiniges-kreuzheben'
    ],
    swap: { 'rumaenisches-kreuzheben': 'hip-thrust', 'goblet-squat': 'hip-thrust', 'einbeiniger-sliding-leg-curl': 'hip-thrust', 'einbeiniges-kreuzheben': 'hip-thrust' },
    care: ['knieextension', 'wandsitz', 'glutebridge'],
    // Im Bodyweight-Modus ist das Rumänische Kreuzheben eine einbeinige
    // Standwaage – dieselbe Belastung, die hier beim einbeinigen Kreuzheben
    // gesperrt ist. Mit der Langhantel steht man auf zwei Beinen.
    avoidBw: ['rumaenisches-kreuzheben'],
  },
  {
    id: 'kreuzband',
    name: 'Kreuzbandriss',
    area: 'Knie', spot: 'knee', kind: 'riss',
    text: 'Das Knie hat seine vordere Führung verloren. Ohne ärztliche Freigabe geht '
      + 'gar nichts, was das Knie unter Last beugt oder streckt – auch nicht einbeinig '
      + 'im Stand.',
    avoid: ['goblet-squat', 'fersenerhoehter-goblet-squat', 'sliding-leg-curl',
      'einbeiniger-sliding-leg-curl', 'einbeiniges-stehendes-wadenheben',
      'wadenheben-gebeugtes-knie',
      'split-squat',
      'einbeiniges-kreuzheben'
    ],
    swap: {},
    care: ['knieextension', 'glutebridge', 'einbeinstand'],
    // Im Bodyweight-Modus ist das Rumänische Kreuzheben eine einbeinige
    // Standwaage – dieselbe Belastung, die hier beim einbeinigen Kreuzheben
    // gesperrt ist. Mit der Langhantel steht man auf zwei Beinen.
    avoidBw: ['rumaenisches-kreuzheben'],
  },
  {
    id: 'laeuferknie',
    name: 'Läuferknie (ITBS)',
    area: 'Knie', spot: 'knee', kind: 'reizung',
    text: 'Der Tractus iliotibialis reibt außen am Knie. Wiederholte Beugung um die 30° '
      + 'reizt am meisten – einbeinige Übungen und tiefe Kniebeugen also.',
    avoid: ['einbeiniger-sliding-leg-curl', 'einbeiniges-stehendes-wadenheben',
      'fersenerhoehter-goblet-squat',
      'split-squat',
      'einbeiniges-kreuzheben'
    ],
    swap: { 'rumaenisches-kreuzheben': 'sliding-leg-curl', 'einbeiniger-sliding-leg-curl': 'sliding-leg-curl',
      'einbeiniges-stehendes-wadenheben': 'wadenheben-gebeugtes-knie',
      'fersenerhoehter-goblet-squat': 'goblet-squat', 'einbeiniges-kreuzheben': 'sliding-leg-curl' },
    care: ['piriformis', 'glutebridge', 'huefte9090', 'wandsitz'],
    // Im Bodyweight-Modus ist das Rumänische Kreuzheben eine einbeinige
    // Standwaage – dieselbe Belastung, die hier beim einbeinigen Kreuzheben
    // gesperrt ist. Mit der Langhantel steht man auf zwei Beinen.
    avoidBw: ['rumaenisches-kreuzheben'],
  },
  {
    id: 'hamstringzerrung',
    name: 'Zerrung der Oberschenkelrückseite',
    area: 'Beinbeuger', spot: 'hamstring', kind: 'zerrung',
    text: 'Der Beinbeuger ist gezerrt, meist nahe am Sitzbein. Exzentrisches Nachgeben '
      + 'in der Länge – genau das, was der Sliding Leg Curl macht – ist am '
      + 'empfindlichsten.',
    avoid: ['sliding-leg-curl', 'einbeiniger-sliding-leg-curl', 'hip-thrust',
      'rumaenisches-kreuzheben',
      'einbeiniges-kreuzheben'
    ],
    // Auch hier steht das Beckenheben unten bei den Übungen zum Kräftigen –
    // siehe ISG-Blockade. Es ersetzt den Hip Thrust, statt zu verschwinden.
    swap: { 'hip-thrust': 'beckenheben' },
    care: ['beinbeugerIso', 'beinbeugerDehnen', 'glutebridge'],
  },
  {
    id: 'wadenzerrung',
    name: 'Wadenzerrung',
    area: 'Wade', spot: 'calf', kind: 'zerrung',
    text: 'Riss einzelner Fasern im Wadenmuskel, oft mit einem hörbaren Knall beim '
      + 'Antritt. Jedes Wadenheben zieht direkt daran.',
    avoid: ['einbeiniges-stehendes-wadenheben', 'wadenheben-gebeugtes-knie'],
    swap: {},
    care: ['wadeGestreckt', 'wadeGebeugt', 'fussABC'],
  },
  {
    id: 'achillessehne',
    name: 'Achillessehnen-Reizung',
    area: 'Achillessehne', spot: 'achilles', kind: 'reizung',
    text: 'Die Sehne ist verdickt und morgens steif. Wadenheben mit gestrecktem Knie '
      + 'belastet sie am stärksten; mit gebeugtem Knie deutlich weniger.',
    avoid: ['einbeiniges-stehendes-wadenheben'],
    swap: { 'einbeiniges-stehendes-wadenheben': 'wadenheben-gebeugtes-knie' },
    care: ['achillesExzentrik', 'wadeGebeugt', 'wadeGestreckt'],
  },
  {
    id: 'sprunggelenk',
    name: 'Umgeknickt (Bänderdehnung)',
    area: 'Sprunggelenk', spot: 'ankle', kind: 'zerrung',
    text: 'Die Außenbänder sind überdehnt, das Gelenk ist wackelig. Alles auf einem Bein '
      + 'fällt weg, ebenso tiefe Kniebeugen, bei denen das Sprunggelenk weit nach vorn '
      + 'kippt.',
    avoid: ['einbeiniges-stehendes-wadenheben', 'einbeiniger-sliding-leg-curl', 'goblet-squat',
      'split-squat',
      'einbeiniges-kreuzheben'
    ],
    swap: { 'rumaenisches-kreuzheben': 'sliding-leg-curl', 'einbeiniges-stehendes-wadenheben': 'wadenheben-gebeugtes-knie',
      'einbeiniger-sliding-leg-curl': 'sliding-leg-curl',
      'goblet-squat': 'fersenerhoehter-goblet-squat', 'einbeiniges-kreuzheben': 'sliding-leg-curl' },
    care: ['fussABC', 'einbeinstand', 'wadeGestreckt', 'zehenheben'],
    // Im Bodyweight-Modus ist das Rumänische Kreuzheben eine einbeinige
    // Standwaage – dieselbe Belastung, die hier beim einbeinigen Kreuzheben
    // gesperrt ist. Mit der Langhantel steht man auf zwei Beinen.
    avoidBw: ['rumaenisches-kreuzheben'],
  },
  {
    id: 'schienbeinkante',
    name: 'Schienbeinkantensyndrom',
    area: 'Schienbein', spot: 'shin', kind: 'reizung',
    text: 'Der Ansatz der Muskulatur an der Schienbeinkante ist überlastet, typisch nach '
      + 'zu viel Laufen. Stoßbelastung und Wadenheben im Stand reizen weiter.',
    avoid: ['einbeiniges-stehendes-wadenheben'],
    swap: { 'einbeiniges-stehendes-wadenheben': 'wadenheben-gebeugtes-knie' },
    care: ['zehenheben', 'wadeGestreckt', 'fussABC'],
  },
];

/* ------------------------------------------------------------------ *
 * Was gut tut
 *
 * Zu jeder Beschwerde ein paar Übungen, die üblicherweise helfen: dehnen,
 * mobilisieren, gezielt kräftigen. Sie gehören *nicht* in die Volumenrechnung
 * – Reha-Arbeit ist kein Muskelaufbau, und ein Satz Außenrotation mit dem
 * Gummiband ist kein Satz Rudern. Sie stehen deshalb als eigene Liste daneben,
 * mit Dauer statt Sätzen.
 *
 * Bei Bruch, Riss und Bandscheibenvorfall steht die Liste unter Vorbehalt:
 * dort entscheidet die ärztliche Freigabe, wann überhaupt wieder bewegt wird.
 * ------------------------------------------------------------------ */

export const CARE_LABEL = {
  dehnen: 'Dehnen',
  kraeftigen: 'Kräftigen',
  mobilisieren: 'Mobilisieren',
  entlasten: 'Entlasten',
};

export const CARE = {
  /* ---- Schulter ---- */
  aussenrotation: {
    name: 'Außenrotation mit Band', kind: 'kraeftigen', dose: '3 × 15 je Seite',
    cue: 'Oberarm am Körper, Ellenbogen 90°, ein Handtuch zwischen Arm und Rippen '
      + 'klemmen. Unterarm langsam nach außen ziehen, ohne dass die Schulter mitgeht. '
      + 'Leicht – hier zählt Sauberkeit, nicht Widerstand.',
  },
  wandengel: {
    name: 'Wandengel', kind: 'mobilisieren', dose: '2 × 10 langsam',
    cue: 'Mit Rücken, Kopf und Armen an der Wand, Ellenbogen 90°. Arme langsam nach '
      + 'oben schieben, ohne dass Handrücken oder Rücken die Wand verlassen. Nur so '
      + 'weit, wie es ohne Ausweichen geht.',
  },
  brustdehnung: {
    name: 'Brustdehnung im Türrahmen', kind: 'dehnen', dose: '3 × 30 s je Seite',
    cue: 'Unterarm am Türrahmen, Ellenbogen auf Schulterhöhe, einen Schritt nach vorn. '
      + 'Zug vorn an der Brust, nicht in der Schulter. Ruhig atmen.',
  },
  schulterblatt: {
    name: 'Schulterblätter zusammenziehen', kind: 'kraeftigen', dose: '3 × 15',
    cue: 'Arme locker hängen lassen, nur die Schulterblätter nach hinten unten ziehen '
      + 'und zwei Sekunden halten. Die Arme machen nichts.',
  },
  sleeper: {
    name: 'Sleeper Stretch', kind: 'dehnen', dose: '3 × 30 s je Seite',
    cue: 'Auf der betroffenen Seite liegen, Arm im rechten Winkel vor dem Körper. Mit '
      + 'der anderen Hand den Unterarm sanft Richtung Boden drücken. Für die hintere '
      + 'Kapsel – bei Schmerz sofort nachlassen.',
  },

  /* ---- Ellenbogen und Hand ---- */
  streckerExzentrik: {
    name: 'Handgelenkstrecken, langsam ablassen', kind: 'kraeftigen', dose: '3 × 15 je Seite',
    cue: 'Unterarm aufgelegt, Handrücken nach oben, leichtes Gewicht. Mit der anderen '
      + 'Hand hochhelfen, dann allein über 3–4 Sekunden ablassen. Das langsame Ablassen '
      + 'ist der wirksame Teil beim Tennisarm.',
  },
  beugerExzentrik: {
    name: 'Handgelenkbeugen, langsam ablassen', kind: 'kraeftigen', dose: '3 × 15 je Seite',
    cue: 'Wie oben, nur mit der Handfläche nach oben. Hochhelfen, allein über 3–4 '
      + 'Sekunden ablassen. Das Gegenstück für den Golferarm.',
  },
  streckerDehnen: {
    name: 'Unterarmstrecker dehnen', kind: 'dehnen', dose: '3 × 30 s je Seite',
    cue: 'Arm gestreckt vor den Körper, Handrücken nach oben, Hand nach unten ziehen. '
      + 'Zug an der Außenseite des Unterarms.',
  },
  beugerDehnen: {
    name: 'Unterarmbeuger dehnen', kind: 'dehnen', dose: '3 × 30 s je Seite',
    cue: 'Arm gestreckt, Handfläche nach oben, Finger nach unten ziehen. Zug an der '
      + 'Innenseite.',
  },
  handgelenkMobil: {
    name: 'Handgelenke mobilisieren', kind: 'mobilisieren', dose: '2 Minuten',
    cue: 'Im Vierfüßlerstand die Hände langsam kreisen lassen, Finger mal nach vorn, '
      + 'mal zur Seite, mal nach hinten. Gewicht dosiert verlagern.',
  },
  fingerstrecker: {
    name: 'Finger gegen Gummiband spreizen', kind: 'kraeftigen', dose: '3 × 20',
    cue: 'Ein Haushaltsgummi um alle Fingerspitzen, Finger langsam aufspannen und '
      + 'kontrolliert zurück. Gleicht das ewige Greifen aus.',
  },

  /* ---- Nacken ---- */
  kinnZurueck: {
    name: 'Kinn zurückziehen', kind: 'kraeftigen', dose: '3 × 10, je 5 s halten',
    cue: 'Kopf gerade, Kinn waagerecht nach hinten schieben (Doppelkinn), nicht nicken. '
      + 'Zieht die tiefen Halsbeuger an, die bei Nackenschmerz meist schwach sind.',
  },
  nackenSeite: {
    name: 'Nacken seitlich dehnen', kind: 'dehnen', dose: '3 × 30 s je Seite',
    cue: 'Ohr zur Schulter, die andere Hand greift die Sitzfläche und hält die Schulter '
      + 'unten. Kein Ziehen mit der Hand am Kopf.',
  },
  schulterkreisen: {
    name: 'Schultern kreisen', kind: 'mobilisieren', dose: '2 × 15 nach hinten',
    cue: 'Große, langsame Kreise nach hinten. Klingt banal, löst aber genau die Stelle, '
      + 'die vom Sitzen verklebt.',
  },

  /* ---- Rücken und Becken ---- */
  katzeKuh: {
    name: 'Katze–Kuh', kind: 'mobilisieren', dose: '2 × 10 langsam',
    cue: 'Im Vierfüßlerstand die Wirbelsäule abschnittsweise runden und strecken, im '
      + 'Atemrhythmus. Ohne Kraft, ohne Endanschlag.',
  },
  kobra: {
    name: 'Streckung in Bauchlage', kind: 'mobilisieren', dose: '10 × 5 s',
    cue: 'Bauchlage, Hände unter den Schultern, Oberkörper so weit anheben, wie es ohne '
      + 'Schmerz geht, Becken bleibt liegen. Bei Bandscheibenbeschwerden oft die '
      + 'Richtung, die den Schmerz aus dem Bein zurückwandern lässt – wandert er ins '
      + 'Bein, sofort aufhören.',
  },
  deadBug: {
    name: 'Dead Bug', kind: 'kraeftigen', dose: '3 × 8 je Seite',
    cue: 'Rückenlage, Arme und Beine hoch. Gegenüberliegenden Arm und Bein langsam '
      + 'absenken, der untere Rücken bleibt am Boden. Rumpfstabilität ohne Beugung.',
  },
  vogelhund: {
    name: 'Bird Dog', kind: 'kraeftigen', dose: '3 × 8 je Seite',
    cue: 'Vierfüßlerstand, gegenüberliegenden Arm und Bein lang ausstrecken und 3 s '
      + 'halten. Becken bleibt waagerecht – ein Glas Wasser auf dem Kreuz dürfte nicht '
      + 'kippen.',
  },
  glutebridge: {
    name: 'Beckenheben', kind: 'kraeftigen', dose: '3 × 12',
    cue: 'Rückenlage, Füße aufgestellt, Becken heben bis Knie–Hüfte–Schulter eine Linie '
      + 'bilden. Oben eine Sekunde die Pobacken fest zusammendrücken.',
  },
  hueftbeuger: {
    name: 'Hüftbeuger dehnen', kind: 'dehnen', dose: '3 × 30 s je Seite',
    cue: 'Halber Kniestand, Becken nach vorn schieben und dabei das Steißbein leicht '
      + 'einrollen. Zug vorn in der Leiste des hinteren Beins, nicht im Rücken.',
  },
  piriformis: {
    name: 'Gesäß dehnen (Vierer)', kind: 'dehnen', dose: '3 × 30 s je Seite',
    cue: 'Rückenlage, Knöchel aufs andere Knie legen, das untere Bein zur Brust ziehen. '
      + 'Zug tief im Gesäß der oben liegenden Seite.',
  },
  atmung: {
    name: 'Ruhige Rippenatmung', kind: 'entlasten', dose: '5 Minuten',
    cue: 'Hände seitlich an die unteren Rippen, langsam so einatmen, dass sich die '
      + 'Rippen zur Seite weiten, nicht der Bauch nach vorn. Hält die Rippen beweglich, '
      + 'ohne den verletzten Bereich zu belasten.',
  },

  /* ---- Hüfte und Bein ---- */
  huefte9090: {
    name: '90/90 Hüftrotation', kind: 'mobilisieren', dose: '2 × 10 je Seite',
    cue: 'Im Sitzen beide Knie 90°, ein Bein vor, eines seitlich. Langsam von Seite zu '
      + 'Seite kippen. Öffnet die Hüfte, ohne sie in den Anschlag zu drücken.',
  },
  adduktoren: {
    name: 'Adduktoren dehnen', kind: 'dehnen', dose: '3 × 30 s je Seite',
    cue: 'Breiter Stand, Gewicht auf ein gebeugtes Bein, das andere lang und gestreckt. '
      + 'Zug an der Oberschenkelinnenseite.',
  },
  wandsitz: {
    name: 'Wandsitz', kind: 'kraeftigen', dose: '4 × 30–45 s',
    cue: 'Mit dem Rücken an der Wand, Knie etwa 60° gebeugt, ruhig halten. Isometrisch '
      + 'belastet das die Patellasehne, ohne sie zu reizen – bei Springerknie oft das, '
      + 'was den Schmerz noch am selben Tag senkt.',
  },
  knieextension: {
    name: 'Knie zu Ende strecken', kind: 'kraeftigen', dose: '3 × 15 je Seite',
    cue: 'Handtuchrolle unter dem Knie, Ferse liegen lassen und das Knie kräftig in die '
      + 'Rolle drücken, bis es ganz gestreckt ist. 5 s halten. Die letzten Grad sind '
      + 'die, die nach jeder Knieverletzung fehlen.',
  },
  beinbeugerDehnen: {
    name: 'Beinbeuger dehnen', kind: 'dehnen', dose: '3 × 30 s je Seite',
    cue: 'Ferse auf eine niedrige Stufe, Bein gestreckt, aus der Hüfte nach vorn kippen '
      + 'mit geradem Rücken. Kein Rundrücken – sonst zieht es an der falschen Stelle.',
  },
  beinbeugerIso: {
    name: 'Beinbeuger anspannen', kind: 'kraeftigen', dose: '4 × 20 s je Seite',
    cue: 'Rückenlage, Ferse in den Boden drücken, Knie leicht gebeugt, halten. Bei einer '
      + 'frischen Zerrung der erste Reiz, der wieder gut tut – schmerzfrei dosieren.',
  },

  /* ---- Wade und Fuß ---- */
  wadeGestreckt: {
    name: 'Wade dehnen, Knie gestreckt', kind: 'dehnen', dose: '3 × 30 s je Seite',
    cue: 'Schrittstellung an der Wand, hinteres Bein gestreckt, Ferse am Boden. Trifft '
      + 'den zweiköpfigen Wadenmuskel.',
  },
  wadeGebeugt: {
    name: 'Wade dehnen, Knie gebeugt', kind: 'dehnen', dose: '3 × 30 s je Seite',
    cue: 'Dieselbe Stellung, hinteres Knie leicht gebeugt. Trifft den tiefer liegenden '
      + 'Schollenmuskel und damit den Ansatz der Achillessehne.',
  },
  achillesExzentrik: {
    name: 'Wadenheben, langsam ablassen', kind: 'kraeftigen', dose: '3 × 15, zweimal täglich',
    cue: 'Auf einer Stufe mit beiden Beinen hoch, das Gewicht aufs betroffene Bein '
      + 'verlagern und über 3–4 Sekunden unter die Stufenkante ablassen. Das '
      + 'Standardprogramm bei Achillessehnenbeschwerden; leichter Schmerz während der '
      + 'Übung ist dabei erlaubt.',
  },
  fussABC: {
    name: 'Fuß-ABC', kind: 'mobilisieren', dose: '2 Durchgänge je Seite',
    cue: 'Im Sitzen mit der großen Zehe das Alphabet in die Luft schreiben. Bringt das '
      + 'Sprunggelenk in alle Richtungen, ohne es zu belasten.',
  },
  einbeinstand: {
    name: 'Einbeinstand', kind: 'kraeftigen', dose: '3 × 45 s je Seite',
    cue: 'Auf einem Bein stehen, erst mit offenen, dann mit geschlossenen Augen. Nach '
      + 'dem Umknicken ist es die gestörte Tiefenwahrnehmung, die das nächste Umknicken '
      + 'wahrscheinlich macht.',
  },
  zehenheben: {
    name: 'Zehen heben', kind: 'kraeftigen', dose: '3 × 20',
    cue: 'Mit den Fersen auf einer Stufe stehen, Fußspitzen anheben und langsam ablassen. '
      + 'Kräftigt den vorderen Schienbeinmuskel.',
  },
};

const BY_ID = new Map(INJURIES.map((i) => [i.id, i]));

export function injuryById(id) { return BY_ID.get(id) || null; }

/**
 * Von Hand notierte Wechselwirkungen. Alles, was sich ausrechnen lässt –
 * welche Übung wegfällt, welcher Ersatz nicht greift –, steht nicht hier,
 * sondern wird gerechnet. Hier stehen nur Dinge, die man wissen muss und die
 * keine Formel hergibt.
 */
export const COMBOS = [
  // `null` nennt, was dabei auf null Sätze fällt, `nullBw` was zusätzlich ohne
  // Hanteln. tests/test-combos.mjs rechnet es für alle Pläne nach – der erste
  // Text hier behauptete „vom Drücken bleibt nichts", und gerechnet blieb die
  // Brust mit Hanteln voll auf Ziel.
  {
    when: ['schulter-impingement', 'handgelenk-reizung'],
    null: ['sideDelts'],
    nullBw: ['chest', 'frontDelts'],
    text: 'Mit Hanteln bleibt das Drücken: Beide Liegestütze gehen auf den Floor Press, '
      + 'die Brust bekommt ihre Sätze dort. Das Seitheben fällt aber ganz weg. Ohne '
      + 'Hanteln bleibt vom Drücken nichts – der Floor Press ist dann selbst ein '
      + 'Liegestütz, und den verbietet das Handgelenk.',
  },
  {
    when: ['tennisarm', 'golferarm'],
    null: ['lats', 'biceps'],
    text: 'Beide Seiten des Ellenbogens gereizt heißt: kein Griff hält mehr eine Last. '
      + 'Damit fällt jeder schwere Zug weg – Latissimus und Bizeps bekommen null '
      + 'Sätze. Übrig bleibt, was die hintere Schulter mit dem Band macht.',
  },
  {
    when: ['lws-bandscheibe', 'patellasehne'],
    null: ['quads'],
    text: 'Rücken und Knie zusammen sperren jede Kniebeuge – die vorderen '
      + 'Oberschenkel bekommen null Sätze. Das Gesäß bleibt über den Hip Thrust im '
      + 'Plan; ob der sich gut anfühlt, entscheidet die Bandscheibe.',
  },
  {
    when: ['kreuzband', 'hamstringzerrung'],
    null: ['quads', 'hamstringsKnee', 'calves'],
    text: 'Knie und Beinbeuger gleichzeitig: Kniebeuge, Kreuzheben, Beinbeuger und '
      + 'Waden fallen aus. Von den Beinen bleibt nur das Beckenheben, und das trägt '
      + 'wenig – im Kern ist es dann Oberkörpertraining.',
  },
  {
    when: ['rotatorenmanschette', 'handgelenk-bruch'],
    null: ['chest', 'triceps', 'frontDelts', 'sideDelts', 'rearDelts', 'lats', 'biceps'],
    text: 'Schulter und Hand zusammen: vom Oberkörper bleibt nichts übrig. In so einer '
      + 'Lage ist der Plan das kleinste Problem.',
  },
  {
    when: ['isg', 'huefte-fai'],
    null: ['quads'],
    text: 'Becken und Hüfte zusammen nehmen die Kniebeuge und den Hip Thrust – der '
      + 'eine ist der Ersatz des anderen. Die vorderen Oberschenkel bekommen dann '
      + 'nichts mehr, das Gesäß nur noch, was die übrigen Hüftübungen mitnehmen: '
      + 'etwa die Hälfte.',
  },
];

/* ------------------------------------------------------------------ *
 * Anwenden
 * ------------------------------------------------------------------ */

const EMPTY = new Set();

/** Vereinigung aller gesperrten Übungen. */
export function blocked(active) {
  const out = new Set();
  active.forEach((id) => {
    const inj = BY_ID.get(id);
    if (inj) inj.avoid.forEach((x) => out.add(x));
  });
  return out;
}

/**
 * Ersatz für eine gesperrte Übung, oder null.
 *
 * Vorschläge mehrerer Beschwerden werden der Reihe nach geprüft; der erste,
 * der nicht selbst gesperrt ist, gewinnt. Ist keiner frei, fällt die Übung weg.
 *
 * `taboo` sind Übungen, die hier zwar erlaubt, aber gerade unpassend sind –
 * in der App die, die eine Muskelgruppe ein zweites Mal innerhalb der
 * Erholungszeit direkt träfen. Ein Ersatz, der die 48 Stunden bricht, ist
 * keiner.
 */
function substitute(exId, active, block, taboo) {
  for (const id of active) {
    const inj = BY_ID.get(id);
    const to = inj && inj.swap[exId];
    if (to && !block.has(to) && !taboo.has(to)) return to;
  }
  return null;
}

/**
 * Übungsliste eines Trainings unter den aktiven Beschwerden.
 *
 * Rückgabe je Eintrag: `{ id, sets, from }` – `from` ist gesetzt, wenn getauscht
 * wurde. Fällt eine Übung ersatzlos weg, fehlt sie in der Liste; ihre Sätze
 * stehen in `dropped`.
 *
 * Landen zwei Einträge auf derselben Übung, werden ihre Sätze zusammengelegt –
 * zweimal dieselbe Zeile im selben Training wäre nur verwirrend.
 */
export function applyInjuries(items, active, taboo = EMPTY) {
  const block = blocked(active);
  if (!block.size) return { items: items.map((i) => ({ ...i })), dropped: [], swapped: [] };

  const out = [];
  const dropped = [];
  const swapped = [];
  items.forEach((item) => {
    if (!block.has(item.id)) {
      out.push({ ...item });
      return;
    }
    const to = substitute(item.id, active, block, taboo);
    if (!to) {
      // Warum nichts kam, macht einen Unterschied: gar kein Vorschlag ist
      // etwas anderes als einer, der erst am Folgetag wieder ginge.
      const wegen = active.some((id) => {
        const inj = BY_ID.get(id);
        const alt = inj && inj.swap[item.id];
        return alt && !block.has(alt) && taboo.has(alt);
      });
      dropped.push({ ...item, reason: wegen ? 'rest' : 'none' });
      return;
    }
    swapped.push({ from: item.id, to, sets: item.sets });
    out.push({ ...item, id: to, from: item.id });
  });
  return { items: zusammenlegen(out), dropped, swapped };
}

/**
 * Dieselbe Übung zweimal in einer Einheit wird eine, mit den Sätzen beider.
 *
 * Vorher wurde nur zusammengelegt, wenn das Tauschziel *vor* dem getauschten
 * Eintrag stand. Kam es danach, stand die Übung doppelt da – gemessen mit
 * Schulter-Impingement: zweimal Floor Press in Workout 3, zweimal Reverse Fly
 * in Workout 2. Ein Tipp hakte dann beide Karten ab (sie teilen sich die
 * Satzliste), und Zähler, Abschluss und Wochenvolumen stimmten nicht mehr.
 *
 * Und `bwSets` geht nicht mehr verloren: Der getauschte Eintrag bestand bisher
 * nur aus id, sets und from, im Bodyweight-Modus galt dann die Hantel-Satzzahl.
 */
export function zusammenlegen(items) {
  const out = [];
  items.forEach((it) => {
    const da = out.find((x) => x.id === it.id);
    if (!da) { out.push({ ...it }); return; }
    const bw = (x) => x.bwSets ?? x.sets ?? 0;
    if (da.bwSets !== undefined || it.bwSets !== undefined) da.bwSets = bw(da) + bw(it);
    da.sets = (da.sets || 0) + (it.sets || 0);
  });
  return out;
}

/**
 * Sperren, die nur in einem Modus gelten.
 *
 * Die Sperrlisten hängen an der Übung, und eine Übung hat zwei Fassungen. Bei
 * den meisten ist das dieselbe Bewegung; bei einigen nicht, und dort griffen
 * die Sperren ins Leere – gefunden bei der Durchsicht der App:
 *
 *   Handgelenksüberlastung   tauschte Liegestütze auf die Floor Press – und die
 *                            *ist* im Bodyweight-Modus ein Liegestütz. Rund 300
 *                            Sätze über 21 Wochen in genau der Stellung, die der
 *                            Eintrag verbietet, und der Tab meldete einen Tausch.
 *   Kreuzband, Sprunggelenk  sperrten das einbeinige Kreuzheben, aber nicht das
 *                            rumänische – dessen Bodyweight-Fassung ist eine
 *                            einbeinige Standwaage.
 *   Handgelenkbruch          ließ mit Hanteln Kreuzheben, Wadenheben mit
 *                            Kurzhantel und den Hip Thrust mit Stange stehen –
 *                            ohne Hanteln brauchen dieselben Übungen die Hände
 *                            nicht.
 *
 * `avoidDb` und `avoidBw` am Eintrag nennen solche Übungen; gesperrt() liefert
 * alles, was im jeweiligen Modus nicht geht.
 */
export function gesperrt(active, mode) {
  const out = blocked(active);
  const feld = mode === 'bw' ? 'avoidBw' : 'avoidDb';
  active.forEach((id) => {
    const inj = BY_ID.get(id);
    ((inj && inj[feld]) || []).forEach((x) => out.add(x));
  });
  return out;
}

/** Die Modus-Sperren anwenden: tauschen, wo ein Ersatz im Modus geht, sonst streichen. */
export function modusTausch(items, active, mode) {
  const alle = gesperrt(active, mode);
  const allgemein = blocked(active);
  const dropped = [];
  const swapped = [];
  const out = [];
  items.forEach((item) => {
    if (!alle.has(item.id) || allgemein.has(item.id)) { out.push(item); return; }
    let to = null;
    for (const id of active) {
      const inj = BY_ID.get(id);
      const ziel = inj && inj.swap[item.id];
      if (ziel && !alle.has(ziel)) { to = ziel; break; }
    }
    if (!to) { dropped.push({ ...item, reason: 'none' }); return; }
    swapped.push({ from: item.id, to, sets: item.sets });
    out.push({ ...item, id: to, from: item.id });
  });
  return { items: zusammenlegen(out), dropped, swapped };
}

/**
 * Was die Auswahl im Schnitt pro Woche kostet.
 *
 * Gerechnet über den ganzen Plan, damit die Zahl nicht vom heutigen Tag
 * abhängt: Sätze je Muskelgruppe mit und ohne Beschwerden, umgerechnet auf
 * eine Woche. Die angepasste Fassung kommt fertig herein – sie hängt an den
 * Nachbartagen und wird deshalb an einer Stelle in der App gerechnet, nicht
 * hier noch einmal.
 */
export function weeklyImpact(plan, adjusted, byId, mode, weeks) {
  const sum = (list) => {
    const acc = {};
    list.forEach((it) => {
      const shares = byId.get(it.id)[mode].shares;
      Object.entries(shares).forEach(([m, s]) => { acc[m] = (acc[m] || 0) + it.sets * s; });
    });
    return acc;
  };
  const before = {};
  const after = {};
  plan.forEach((w, i) => {
    const a = sum(w.ex);
    const b = sum(adjusted[i]);
    Object.entries(a).forEach(([m, v]) => { before[m] = (before[m] || 0) + v; });
    Object.entries(b).forEach(([m, v]) => { after[m] = (after[m] || 0) + v; });
  });
  const out = {};
  Object.keys(before).forEach((m) => {
    out[m] = { before: before[m] / weeks, after: (after[m] || 0) / weeks };
  });
  return out;
}

/**
 * Freigabe abwarten? Bei Bruch, Riss und Bandscheibenvorfall entscheidet nicht
 * der Trainingsplan, wann wieder bewegt wird.
 */
export function needsClearance(id) {
  const inj = BY_ID.get(id);
  return !!inj && ['bruch', 'riss', 'vorfall'].includes(inj.kind);
}

/**
 * Übungen, die bei der aktuellen Auswahl gut tun – ohne Doppelte, in der
 * Reihenfolge der angehakten Beschwerden.
 *
 * Zu jeder steht dabei, wegen welcher Beschwerde sie in der Liste ist, und ob
 * eine davon erst eine ärztliche Freigabe braucht.
 */
export function careFor(active) {
  const out = new Map();
  active.forEach((id) => {
    const inj = BY_ID.get(id);
    if (!inj) return;
    (inj.care || []).forEach((key) => {
      if (!CARE[key]) return;
      const seen = out.get(key) || { key, ...CARE[key], wegen: [], clearance: false };
      seen.wegen.push(inj.name);
      seen.clearance = seen.clearance || needsClearance(id);
      out.set(key, seen);
    });
  });
  return [...out.values()];
}

/** Von Hand notierte Wechselwirkungen, die auf die Auswahl passen. */
export function combosFor(active) {
  const set = new Set(active);
  return COMBOS.filter((c) => c.when.every((id) => set.has(id)));
}
