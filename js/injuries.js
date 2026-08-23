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

export const INJURIES = [
  /* ---------------- Schulter ---------------- */
  {
    id: 'schulter-impingement',
    name: 'Schulter-Impingement',
    area: 'Schulter', spot: 'shoulder', kind: 'reizung',
    text: 'Der Raum unter dem Schulterdach wird eng. Typisch ist der Schmerz beim '
      + 'Heben des Arms zwischen etwa 60° und 120° – seitlich mehr als vorn. '
      + 'Drücken am Boden mit kurzem Weg geht meist, Heben über Schulterhöhe nicht.',
    avoid: ['sitzendes-seitheben', 'fuesse-erhoehte-liegestuetze'],
    swap: { 'sitzendes-seitheben': 'reverse-fly', 'fuesse-erhoehte-liegestuetze': 'floor-press' },
  },
  {
    id: 'rotatorenmanschette',
    name: 'Rotatorenmanschetten-Riss',
    area: 'Schulter', spot: 'shoulder', kind: 'riss',
    text: 'Riss in einer der vier Sehnen, die den Oberarmkopf in der Pfanne führen. '
      + 'Alles, was den Arm gegen Widerstand hebt, dreht oder drückt, fällt aus. '
      + 'Hier gehört ein Arzt drauf, nicht ein Trainingsplan.',
    avoid: ['sitzendes-seitheben', 'fuesse-erhoehte-liegestuetze', 'gewichtete-liegestuetze',
      'floor-press', 'reverse-fly', 'chin-ups', 'einarmiges-kh-rudern'],
    swap: {},
  },
  {
    id: 'ac-gelenk',
    name: 'AC-Gelenk-Reizung (Schultereck)',
    area: 'Schulter', spot: 'shoulder', kind: 'reizung',
    text: 'Das kleine Gelenk zwischen Schlüsselbein und Schulterdach. Es meldet sich, '
      + 'wenn der Arm quer vor dem Körper zusammengeführt wird – also beim Drücken '
      + 'und bei allem, was die Schultern nach vorn zieht.',
    avoid: ['gewichtete-liegestuetze', 'fuesse-erhoehte-liegestuetze', 'floor-press'],
    swap: { 'fuesse-erhoehte-liegestuetze': 'reverse-fly' },
  },
  {
    id: 'bizepssehne',
    name: 'Reizung der langen Bizepssehne',
    area: 'Schulter', spot: 'upperArm', kind: 'reizung',
    text: 'Die lange Bizepssehne läuft durch eine Rinne am Oberarmkopf. Sie reibt bei '
      + 'Zug mit gestrecktem Arm und bei allem, was den Unterarm gegen Widerstand '
      + 'nach außen dreht – Curls und Klimmzüge im Untergriff also.',
    avoid: ['sz-curls', 'chin-ups'],
    swap: { 'chin-ups': 'einarmiges-kh-rudern' },
  },

  /* ---------------- Ellenbogen und Hand ---------------- */
  {
    id: 'tennisarm',
    name: 'Tennisarm (Epicondylitis lateralis)',
    area: 'Ellenbogen', spot: 'elbow', kind: 'reizung',
    text: 'Der Ansatz der Handstrecker an der Außenseite des Ellenbogens ist gereizt. '
      + 'Weh tut vor allem Zugreifen und Festhalten – Rudern, Klimmzüge, Curls. '
      + 'Drücken belastet ihn kaum.',
    avoid: ['chin-ups', 'sz-curls', 'einarmiges-kh-rudern'],
    swap: {},
  },
  {
    id: 'golferarm',
    name: 'Golferarm (Epicondylitis medialis)',
    area: 'Ellenbogen', spot: 'elbow', kind: 'reizung',
    text: 'Dasselbe an der Innenseite, am Ansatz der Handbeuger. Auch hier ist der '
      + 'Griff das Problem, dazu jede kräftige Beugung im Ellenbogen.',
    avoid: ['chin-ups', 'sz-curls', 'einarmiges-kh-rudern'],
    swap: {},
  },
  {
    id: 'ellenbogen-bursitis',
    name: 'Schleimbeutelentzündung am Ellenbogen',
    area: 'Ellenbogen', spot: 'elbow', kind: 'reizung',
    text: 'Der Schleimbeutel an der Ellenbogenspitze schwillt an und drückt. Direkter '
      + 'Druck auf den Ellenbogen und volle Streckung gegen Widerstand sind unangenehm.',
    avoid: ['liegende-trizepsstrecker', 'gewichtete-liegestuetze', 'floor-press'],
    swap: { 'gewichtete-liegestuetze': 'reverse-fly' },
  },
  {
    id: 'handgelenk-reizung',
    name: 'Handgelenksüberlastung',
    area: 'Handgelenk', spot: 'wrist', kind: 'reizung',
    text: 'Schmerz, wenn das Handgelenk unter Last nach hinten abknickt – genau die '
      + 'Stellung beim Liegestütz. Mit gerader Hand am Griff geht es meist gut.',
    avoid: ['gewichtete-liegestuetze', 'fuesse-erhoehte-liegestuetze'],
    swap: { 'gewichtete-liegestuetze': 'floor-press', 'fuesse-erhoehte-liegestuetze': 'floor-press' },
  },
  {
    id: 'handgelenk-bruch',
    name: 'Handgelenkbruch',
    area: 'Handgelenk', spot: 'wrist', kind: 'bruch',
    text: 'Mit Gips oder frisch verheilt geht über die Hand keine Last. Damit fällt '
      + 'fast der ganze Oberkörper weg – übrig bleiben Übungen, bei denen die Hände '
      + 'nichts halten und nichts tragen.',
    avoid: ['goblet-squat', 'fersenerhoehter-goblet-squat', 'gewichtete-liegestuetze',
      'fuesse-erhoehte-liegestuetze', 'floor-press', 'einarmiges-kh-rudern', 'chin-ups',
      'reverse-fly', 'sitzendes-seitheben', 'liegende-trizepsstrecker', 'sz-curls',
      'gewichtete-crunches'],
    swap: { 'goblet-squat': 'hip-thrust', 'fersenerhoehter-goblet-squat': 'hip-thrust' },
  },
  {
    id: 'daumen-sehnenscheide',
    name: 'Sehnenscheidenentzündung am Daumen',
    area: 'Handgelenk', spot: 'wrist', kind: 'reizung',
    text: 'De Quervain: die Sehnen zum Daumen laufen durch ein zu enges Fach an der '
      + 'Speichenseite. Alles, was fest gegriffen wird, zieht daran.',
    avoid: ['chin-ups', 'einarmiges-kh-rudern', 'sz-curls'],
    swap: {},
  },
  {
    id: 'ringband',
    name: 'Ringbandverletzung am Finger',
    area: 'Hand', spot: 'hand', kind: 'riss',
    text: 'Das Band, das die Beugesehne am Knochen hält, ist überdehnt oder gerissen – '
      + 'klassisch vom Hängen an einer Kante. Jeder feste Griff belastet es.',
    avoid: ['chin-ups', 'einarmiges-kh-rudern'],
    swap: {},
  },

  /* ---------------- Rumpf ---------------- */
  {
    id: 'nacken',
    name: 'Nackenverspannung / HWS-Reizung',
    area: 'Nacken', spot: 'neck', kind: 'reizung',
    text: 'Verspannter Nacken meldet sich bei allem, was die Schultern hochzieht, und '
      + 'bei Übungen, in denen der Kopf gegen die Schwerkraft gehalten wird.',
    avoid: ['gewichtete-crunches', 'sitzendes-seitheben'],
    swap: { 'sitzendes-seitheben': 'floor-press' },
  },
  {
    id: 'hws-bandscheibe',
    name: 'Bandscheibenvorfall HWS',
    area: 'Nacken', spot: 'neck', kind: 'vorfall',
    text: 'Vorfall in der Halswirbelsäule, oft mit Ausstrahlung in den Arm. Zug am Arm '
      + 'und Last auf den Schultern sind tabu, ebenso jede Beugung des Nackens gegen '
      + 'Widerstand.',
    avoid: ['gewichtete-crunches', 'sitzendes-seitheben', 'chin-ups', 'einarmiges-kh-rudern',
      'reverse-fly'],
    swap: {},
  },
  {
    id: 'lws-bandscheibe',
    name: 'Bandscheibenvorfall LWS',
    area: 'unterer Rücken', spot: 'lowerBack', kind: 'vorfall',
    text: 'Vorfall in der Lendenwirbelsäule. Beugung der Wirbelsäule unter Last ist das '
      + 'Gegenteil dessen, was hilft – Crunches fallen ganz weg, ebenso alles '
      + 'vorgebeugte. Gestützte Hüftstreckung ist meist gut verträglich.',
    avoid: ['gewichtete-crunches', 'goblet-squat', 'fersenerhoehter-goblet-squat',
      'einarmiges-kh-rudern', 'reverse-fly'],
    swap: { 'goblet-squat': 'hip-thrust', 'fersenerhoehter-goblet-squat': 'hip-thrust' },
  },
  {
    id: 'hexenschuss',
    name: 'Hexenschuss (Lumbago)',
    area: 'unterer Rücken', spot: 'lowerBack', kind: 'blockade',
    text: 'Der Rücken macht plötzlich dicht, meist nach einer ungünstigen Bewegung. '
      + 'Nichts Schweres aufrecht halten, nichts vorgebeugt ziehen; leichte Bewegung '
      + 'tut in der Regel besser als liegen bleiben.',
    avoid: ['goblet-squat', 'fersenerhoehter-goblet-squat', 'einarmiges-kh-rudern',
      'gewichtete-crunches'],
    swap: { 'goblet-squat': 'hip-thrust' },
  },
  {
    id: 'isg',
    name: 'ISG-Blockade',
    area: 'Becken', spot: 'pelvis', kind: 'blockade',
    text: 'Das Kreuz-Darmbein-Gelenk sitzt fest, der Schmerz sitzt tief seitlich über '
      + 'dem Gesäß. Einbeinige Belastung und kräftige Hüftstreckung reizen es.',
    avoid: ['hip-thrust', 'einbeiniger-sliding-leg-curl', 'einbeiniges-stehendes-wadenheben'],
    swap: {
      'einbeiniger-sliding-leg-curl': 'sliding-leg-curl',
      'einbeiniges-stehendes-wadenheben': 'wadenheben-gebeugtes-knie',
    },
  },
  {
    id: 'rippenprellung',
    name: 'Rippenprellung',
    area: 'Rippen', spot: 'ribs', kind: 'prellung',
    text: 'Prellung oder Anriss einer Rippe. Jedes kräftige Anspannen des Rumpfes tut '
      + 'weh, ebenso Druck von außen – die Hantel vor der Brust zum Beispiel.',
    avoid: ['gewichtete-crunches', 'goblet-squat', 'fersenerhoehter-goblet-squat'],
    swap: { 'goblet-squat': 'hip-thrust', 'fersenerhoehter-goblet-squat': 'hip-thrust' },
  },
  {
    id: 'bauchmuskelzerrung',
    name: 'Bauchmuskelzerrung',
    area: 'Bauch', spot: 'abs', kind: 'zerrung',
    text: 'Gezerrte gerade Bauchmuskulatur, oft nach einer schnellen Drehung. Beugung '
      + 'gegen Widerstand fällt aus; halten und stabilisieren geht meist noch.',
    avoid: ['gewichtete-crunches'],
    swap: {},
  },
  {
    id: 'brustmuskelzerrung',
    name: 'Zerrung der Brustmuskulatur',
    area: 'Brust', spot: 'chest', kind: 'zerrung',
    text: 'Meist am Übergang zur Sehne nahe der Achsel. Drücken und alles, was den Arm '
      + 'aus der gedehnten Stellung nach vorn bringt, ist betroffen.',
    avoid: ['gewichtete-liegestuetze', 'fuesse-erhoehte-liegestuetze', 'floor-press'],
    swap: {},
  },
  {
    id: 'leistenbruch',
    name: 'Leistenbruch (Hernie)',
    area: 'Leiste', spot: 'groin', kind: 'bruch',
    text: 'Eine Lücke in der Bauchwand, durch die Gewebe drückt. Jede kräftige '
      + 'Bauchpresse vergrößert sie – schwere Übungen im Stand und alles mit '
      + 'angehaltenem Atem fallen weg, bis das operiert ist.',
    avoid: ['goblet-squat', 'fersenerhoehter-goblet-squat', 'gewichtete-crunches',
      'hip-thrust', 'einarmiges-kh-rudern'],
    swap: {},
  },

  /* ---------------- Hüfte und Bein ---------------- */
  {
    id: 'huefte-fai',
    name: 'Hüftimpingement (FAI)',
    area: 'Hüfte', spot: 'hip', kind: 'reizung',
    text: 'Schenkelhals und Pfannenrand stoßen in tiefer Beugung aneinander. Tiefe '
      + 'Kniebeugen kneifen vorn in der Leiste; Hüftstreckung aus flacher Stellung '
      + 'geht dagegen gut.',
    avoid: ['goblet-squat', 'fersenerhoehter-goblet-squat'],
    swap: { 'goblet-squat': 'hip-thrust', 'fersenerhoehter-goblet-squat': 'hip-thrust' },
  },
  {
    id: 'leistenzerrung',
    name: 'Leistenzerrung (Adduktoren)',
    area: 'Leiste', spot: 'groin', kind: 'zerrung',
    text: 'Die Adduktoren an der Oberschenkelinnenseite sind gezerrt. Breiter Stand und '
      + 'einbeinige Übungen ziehen daran.',
    avoid: ['goblet-squat', 'fersenerhoehter-goblet-squat', 'einbeiniger-sliding-leg-curl',
      'einbeiniges-stehendes-wadenheben'],
    swap: {
      'einbeiniger-sliding-leg-curl': 'sliding-leg-curl',
      'einbeiniges-stehendes-wadenheben': 'wadenheben-gebeugtes-knie',
    },
  },
  {
    id: 'patellasehne',
    name: 'Springerknie (Patellasehne)',
    area: 'Knie', spot: 'knee', kind: 'reizung',
    text: 'Die Sehne zwischen Kniescheibe und Schienbein ist gereizt. Tiefe Beugung '
      + 'unter Last drückt darauf, erhöhte Fersen machen es schlimmer, nicht besser.',
    avoid: ['fersenerhoehter-goblet-squat', 'goblet-squat'],
    swap: { 'goblet-squat': 'hip-thrust', 'fersenerhoehter-goblet-squat': 'hip-thrust' },
  },
  {
    id: 'meniskus',
    name: 'Meniskusriss',
    area: 'Knie', spot: 'knee', kind: 'riss',
    text: 'Riss im Faserknorpel zwischen Ober- und Unterschenkel. Tiefe Beugung unter '
      + 'Last und Drehung im belasteten Knie sind die kritischen Bewegungen.',
    avoid: ['goblet-squat', 'fersenerhoehter-goblet-squat', 'einbeiniger-sliding-leg-curl'],
    swap: { 'goblet-squat': 'hip-thrust', 'einbeiniger-sliding-leg-curl': 'hip-thrust' },
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
      'wadenheben-gebeugtes-knie'],
    swap: {},
  },
  {
    id: 'laeuferknie',
    name: 'Läuferknie (ITBS)',
    area: 'Knie', spot: 'knee', kind: 'reizung',
    text: 'Der Tractus iliotibialis reibt außen am Knie. Wiederholte Beugung um die 30° '
      + 'reizt am meisten – einbeinige Übungen und tiefe Kniebeugen also.',
    avoid: ['einbeiniger-sliding-leg-curl', 'einbeiniges-stehendes-wadenheben',
      'fersenerhoehter-goblet-squat'],
    swap: {
      'einbeiniger-sliding-leg-curl': 'sliding-leg-curl',
      'einbeiniges-stehendes-wadenheben': 'wadenheben-gebeugtes-knie',
      'fersenerhoehter-goblet-squat': 'goblet-squat',
    },
  },
  {
    id: 'hamstringzerrung',
    name: 'Zerrung der Oberschenkelrückseite',
    area: 'Beinbeuger', spot: 'hamstring', kind: 'zerrung',
    text: 'Der Beinbeuger ist gezerrt, meist nahe am Sitzbein. Exzentrisches Nachgeben '
      + 'in der Länge – genau das, was der Sliding Leg Curl macht – ist am '
      + 'empfindlichsten.',
    avoid: ['sliding-leg-curl', 'einbeiniger-sliding-leg-curl', 'hip-thrust'],
    swap: {},
  },
  {
    id: 'wadenzerrung',
    name: 'Wadenzerrung',
    area: 'Wade', spot: 'calf', kind: 'zerrung',
    text: 'Riss einzelner Fasern im Wadenmuskel, oft mit einem hörbaren Knall beim '
      + 'Antritt. Jedes Wadenheben zieht direkt daran.',
    avoid: ['einbeiniges-stehendes-wadenheben', 'wadenheben-gebeugtes-knie'],
    swap: {},
  },
  {
    id: 'achillessehne',
    name: 'Achillessehnen-Reizung',
    area: 'Achillessehne', spot: 'achilles', kind: 'reizung',
    text: 'Die Sehne ist verdickt und morgens steif. Wadenheben mit gestrecktem Knie '
      + 'belastet sie am stärksten; mit gebeugtem Knie deutlich weniger.',
    avoid: ['einbeiniges-stehendes-wadenheben'],
    swap: { 'einbeiniges-stehendes-wadenheben': 'wadenheben-gebeugtes-knie' },
  },
  {
    id: 'sprunggelenk',
    name: 'Umgeknickt (Bänderdehnung)',
    area: 'Sprunggelenk', spot: 'ankle', kind: 'zerrung',
    text: 'Die Außenbänder sind überdehnt, das Gelenk ist wackelig. Alles auf einem Bein '
      + 'fällt weg, ebenso tiefe Kniebeugen, bei denen das Sprunggelenk weit nach vorn '
      + 'kippt.',
    avoid: ['einbeiniges-stehendes-wadenheben', 'einbeiniger-sliding-leg-curl', 'goblet-squat'],
    swap: {
      'einbeiniges-stehendes-wadenheben': 'wadenheben-gebeugtes-knie',
      'einbeiniger-sliding-leg-curl': 'sliding-leg-curl',
      'goblet-squat': 'fersenerhoehter-goblet-squat',
    },
  },
  {
    id: 'schienbeinkante',
    name: 'Schienbeinkantensyndrom',
    area: 'Schienbein', spot: 'shin', kind: 'reizung',
    text: 'Der Ansatz der Muskulatur an der Schienbeinkante ist überlastet, typisch nach '
      + 'zu viel Laufen. Stoßbelastung und Wadenheben im Stand reizen weiter.',
    avoid: ['einbeiniges-stehendes-wadenheben'],
    swap: { 'einbeiniges-stehendes-wadenheben': 'wadenheben-gebeugtes-knie' },
  },
];

const BY_ID = new Map(INJURIES.map((i) => [i.id, i]));

export function injuryById(id) { return BY_ID.get(id) || null; }

/**
 * Von Hand notierte Wechselwirkungen. Alles, was sich ausrechnen lässt –
 * welche Übung wegfällt, welcher Ersatz nicht greift –, steht nicht hier,
 * sondern wird gerechnet. Hier stehen nur Dinge, die man wissen muss und die
 * keine Formel hergibt.
 */
export const COMBOS = [
  {
    when: ['schulter-impingement', 'handgelenk-reizung'],
    text: 'Schulter und Handgelenk zusammen lassen vom Drücken nichts übrig: die '
      + 'Schulter verbietet den erhöhten Liegestütz, das Handgelenk den flachen, '
      + 'und der Floor Press ist der Ersatz für beide – er kann nicht gleichzeitig '
      + 'Ersatz und Ausweg sein.',
  },
  {
    when: ['tennisarm', 'golferarm'],
    text: 'Beide Seiten des Ellenbogens gereizt heißt: kein Griff hält mehr etwas. '
      + 'Damit fällt der komplette Zug weg – Rücken und Bizeps bekommen null Sätze.',
  },
  {
    when: ['lws-bandscheibe', 'patellasehne'],
    text: 'Rücken und Knie zusammen sperren die Kniebeuge doppelt, und der Hip Thrust '
      + 'ist für beide der Ausweg. Ob er sich gut anfühlt, entscheidet die '
      + 'Bandscheibe – wenn nicht, bleibt für die Oberschenkel nichts.',
  },
  {
    when: ['kreuzband', 'hamstringzerrung'],
    text: 'Knie und Beinbeuger gleichzeitig: das gesamte Beintraining fällt aus, '
      + 'inklusive Waden. Übrig bleibt reines Oberkörpertraining.',
  },
  {
    when: ['rotatorenmanschette', 'handgelenk-bruch'],
    text: 'Schulter und Hand zusammen: vom Oberkörper bleibt nichts übrig. In so einer '
      + 'Lage ist der Plan das kleinste Problem.',
  },
  {
    when: ['isg', 'huefte-fai'],
    text: 'Becken und Hüfte zusammen nehmen sowohl die Kniebeuge als auch den Hip '
      + 'Thrust – der eine ist der Ersatz des anderen. Für Gesäß und Oberschenkel '
      + 'bleibt dann nur, was die Beinbeuger nebenbei mitnehmen.',
  },
];

/* ------------------------------------------------------------------ *
 * Anwenden
 * ------------------------------------------------------------------ */

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
 */
function substitute(exId, active, block) {
  for (const id of active) {
    const inj = BY_ID.get(id);
    const to = inj && inj.swap[exId];
    if (to && !block.has(to)) return to;
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
export function applyInjuries(items, active) {
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
    const to = substitute(item.id, active, block);
    if (!to) {
      dropped.push({ ...item });
      return;
    }
    swapped.push({ from: item.id, to, sets: item.sets });
    const same = out.find((x) => x.id === to);
    if (same) same.sets += item.sets;
    else out.push({ id: to, sets: item.sets, from: item.id });
  });
  return { items: out, dropped, swapped };
}

/**
 * Was die Auswahl im Schnitt pro Woche kostet.
 *
 * Gerechnet über den ganzen Plan, damit die Zahl nicht vom heutigen Tag
 * abhängt: Sätze je Muskelgruppe mit und ohne Beschwerden, umgerechnet auf
 * eine Woche.
 */
export function weeklyImpact(plan, byId, active, mode, weeks) {
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
  plan.forEach((w) => {
    const a = sum(w.ex);
    const b = sum(applyInjuries(w.ex, active).items);
    Object.entries(a).forEach(([m, v]) => { before[m] = (before[m] || 0) + v; });
    Object.entries(b).forEach(([m, v]) => { after[m] = (after[m] || 0) + v; });
  });
  const out = {};
  Object.keys(before).forEach((m) => {
    out[m] = { before: before[m] / weeks, after: (after[m] || 0) / weeks };
  });
  return out;
}

/** Von Hand notierte Wechselwirkungen, die auf die Auswahl passen. */
export function combosFor(active) {
  const set = new Set(active);
  return COMBOS.filter((c) => c.when.every((id) => set.has(id)));
}
