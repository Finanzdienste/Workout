/*
 * Der Speicher: alles, was die App weiß, in einem Schlüssel im localStorage.
 *
 * Kein Server, kein Konto. Was hier steht, liegt nur auf diesem Handy – das
 * ist der Grund, warum die Sicherung (exportJSON/importJSON) kein Beiwerk
 * ist, sondern der einzige Weg, die Daten bei einem Handywechsel zu behalten.
 *
 * Drei Grundsätze, übernommen aus der Workout-App und dort teuer gelernt:
 *
 *   1. Nichts geht still verloren. Kann nicht gespeichert werden (privates
 *      Fenster, Speicher voll), sagt die App das – siehe kannSpeichern().
 *   2. Ein unbekannter, höherer Stand wird nie überschrieben. Eine Sicherung
 *      aus einer neueren Fassung lehnt importJSON ab, statt Felder zu
 *      verlieren, die diese Fassung nicht kennt.
 *   3. Eingaben werden entschärft, nicht geglaubt: normStand() bringt jeden
 *      gelesenen Stand – aus dem Speicher wie aus einer Datei – in die Form,
 *      mit der der Rest der App rechnet.
 */
import { heuteISO, istISO, istUhr, zahlAus, zahlText } from './datum.js';

export const SCHLUESSEL = 'schilddruese.stand.v1';
/*
 * Fassung 2 (Einschätzung): Profil mit Geburtsjahr, Behandlungsgrund,
 * Präparatart, persönlichem Zielbereich, Herz, Knochen und Bundesland; die
 * weiteren Mittel mit Abstand und Wechseln; je Befund die Fragen zur
 * Blutabnahme; die Warnzeichen-Checks. Alles nur Ergänzungen – ein Stand der
 * Fassung 1 wird beim Lesen einfach ergänzt. Hochgezählt, damit eine noch
 * zwischengespeicherte ältere App diese Felder nicht beim nächsten Speichern
 * stillschweigend verwirft (siehe neuererStand).
 */
export const VERSION = 2;

function tageWeiterLokal(iso, n) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Eine Kennung für Einträge – kurz, zufällig, ohne Bibliothek. */
export function kennung() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Bekannte Beschwerden für das Befinden – Schlüssel und Anzeigetext. Wie sie
 * zählen (zu wenig, zu viel, keins von beiden), steht in js/einschaetzung.js.
 * „trockene Haut, Haarausfall" war früher ein Punkt – siehe ALTE_BESCHWERDEN.
 */
export const BESCHWERDEN = [
  ['muede', 'müde, erschöpft'],
  ['frieren', 'friere leicht, auch wenn andere es warm finden'],
  ['schwitzen', 'schwitze, innerlich unruhig'],
  ['herz', 'Herzklopfen'],
  ['puls', 'Puls unregelmäßig oder Herzstolpern'],
  ['zittern', 'Zittern der Hände'],
  ['waerme', 'Wärme schlecht vertragen'],
  ['verstopfung', 'Verstopfung'],
  ['durchfall', 'Durchfall'],
  ['trockenhaut', 'trockene Haut'],
  ['haarausfall', 'Haarausfall'],
  ['gesicht', 'geschwollene Lider oder geschwollenes Gesicht'],
  ['abnahme', 'ungewollt abgenommen'],
  ['gewicht', 'Gewicht verändert'],
  ['stimmung', 'gedrückte Stimmung'],
  ['lebensmuede', 'so niedergeschlagen, dass ich manchmal nicht mehr leben möchte'],
  ['schlaf', 'schlecht geschlafen'],
  ['konzentration', 'Konzentration fällt schwer'],
  ['schmerzen', 'Muskel- oder Gelenkschmerzen'],
];

/*
 * Beschwerden aus früheren Fassungen, die das Befinden-Formular nicht mehr
 * anbietet. „trockene Haut, Haarausfall" war ein Punkt und meinte das eine
 * ODER das andere. Beim Lesen wurde daraus früher „trockene Haut" – dann
 * nannte der Arztbericht eine Beschwerde, die so nie angegeben wurde, und sie
 * zählte als Punkt für „zu wenig Hormon", auch wenn nur Haarausfall gemeint
 * war (der zu beidem passt). Jetzt bleibt der alte Eintrag, was er war: mit
 * seinem Text, ohne Punkt für eine Richtung (C22).
 */
export const ALTE_BESCHWERDEN = [
  ['haut', 'trockene Haut oder Haarausfall (frühere Angabe)'],
];

/** Der Anzeigetext einer Beschwerde – auch einer aus einer früheren Fassung. */
export function beschwerdeName(k) {
  return ([...BESCHWERDEN, ...ALTE_BESCHWERDEN].find(([id]) => id === k) || [k, k])[1];
}

/*
 * Weitere Mittel, die mit L-Thyroxin zusammenspielen: Schlüssel und Name. In
 * welcher Weise, steht in js/einschaetzung.js. „Östrogen" war früher ein
 * Punkt – als Tablette erhöht es den Bedarf, als Pflaster kaum; ein alter
 * Eintrag wird zur Tablette und die App fragt einmal nach.
 */
export const MITTEL = [
  ['kalzium', 'Kalzium, auch Kalzium mit Vitamin D (Knochen-Tabletten)'],
  ['eisen', 'Eisen'],
  ['magnesium', 'Magnesium'],
  ['multimineral', 'Multivitamin mit Mineralien'],
  ['antazida', 'Mittel gegen Sodbrennen zum Lutschen oder Trinken (z. B. Maaloxan, Rennie)'],
  ['ppi', 'Magenschutz (z. B. Pantoprazol, Omeprazol, Famotidin)'],
  ['sucralfat', 'Sucralfat (Magenschutz)'],
  ['phosphatbinder', 'Phosphatbinder bei Nierenschwäche (Sevelamer, Lanthan, Aluminium)'],
  ['orlistat', 'Orlistat (Abnehmmittel)'],
  ['soja', 'Sojaprodukte (Sojamilch, Tofu)'],
  ['ballaststoffe', 'Ballaststoff-Präparat (Flohsamen, Leinsamen, Kleie)'],
  ['colestyramin', 'Colestyramin, Colesevelam oder Colestipol (Cholesterin, Gallensäure)'],
  ['kaffee', 'Kaffee oder Tee am Morgen'],
  ['oestrogen_tablette', 'Östrogen als Tablette (Hormonersatz)'],
  ['oestrogen_haut', 'Östrogen als Pflaster, Gel oder Spray'],
  ['raloxifen', 'Raloxifen (Knochenmittel)'],
  ['tamoxifen', 'Tamoxifen (nach Brustkrebs)'],
  ['bisphosphonat', 'Knochenmittel zum Nüchtern-Einnehmen (z. B. Alendronat)'],
  ['biotin', 'Biotin (Haar-, Haut- und Nägel-Mittel, Vitamin-B-Komplex)'],
  ['selen', 'Selen'],
  ['jod', 'Jodtabletten, Algen, Kelp'],
  ['marcumar', 'Blutverdünner Marcumar / Phenprocoumon'],
  ['digitalis', 'Herzmittel Digoxin oder Digitoxin'],
  ['amiodaron', 'Amiodaron (Herzrhythmus)'],
  ['diabetes', 'Diabetes-Tabletten oder Insulin'],
  ['metformin', 'Metformin (Diabetes)'],
  ['lithium', 'Lithium'],
  ['enzyminduktor', 'Carbamazepin, Phenytoin, Phenobarbital oder Rifampicin'],
  ['krebsmittel', 'Krebsmittel (Tyrosinkinase-Hemmer, Immuntherapie)'],
];

export const URSACHEN = [
  ['', 'bitte wählen'],
  ['hashimoto', 'Hashimoto'],
  ['op', 'Schilddrüse (ganz oder teilweise) entfernt'],
  ['radiojod', 'nach Radiojod-Behandlung'],
  ['hypophyse', 'Erkrankung der Hirnanhangdrüse'],
  ['andere', 'andere Ursache'],
  ['unbekannt', 'weiß ich nicht'],
];

/** Welche Schilddrüsen-Tablette: nur T4, mit T3-Anteil, weiß nicht. */
export const PRAEPARATE = [
  ['t4', 'nur L-Thyroxin (z. B. L-Thyroxin, Euthyrox)'],
  ['t3', 'mit T3-Anteil (z. B. Novothyral, Prothyrid, Thybon)'],
  ['unbekannt', 'weiß ich nicht'],
];

/*
 * Bundesland → Giftnotruf. Die Giftinformationszentren sind nach Ländern
 * aufgeteilt; ohne Angabe zeigt die App 112.
 */
export const BUNDESLAENDER = [
  ['BW', 'Baden-Württemberg', '0761 19240'],
  ['BY', 'Bayern', '089 19240'],
  ['BE', 'Berlin', '030 19240'],
  ['BB', 'Brandenburg', '030 19240'],
  ['HB', 'Bremen', '0551 19240'],
  ['HH', 'Hamburg', '0551 19240'],
  ['HE', 'Hessen', '06131 19240'],
  ['MV', 'Mecklenburg-Vorpommern', '0361 730730'],
  ['NI', 'Niedersachsen', '0551 19240'],
  ['NW', 'Nordrhein-Westfalen', '0228 19240'],
  ['RP', 'Rheinland-Pfalz', '06131 19240'],
  ['SL', 'Saarland', '06841 19240'],
  ['SN', 'Sachsen', '0361 730730'],
  ['ST', 'Sachsen-Anhalt', '0361 730730'],
  ['SH', 'Schleswig-Holstein', '0551 19240'],
  ['TH', 'Thüringen', '0361 730730'],
];

/** Die Giftnotruf-Nummer fürs Bundesland – oder null ohne Angabe. */
export function giftnotruf(bundesland) {
  const b = BUNDESLAENDER.find(([k]) => k === bundesland);
  return b ? b[2] : null;
}

/*
 * Weitere Werte, die bei Schilddrüsenunterfunktion oft mitbestimmt werden:
 * Cholesterin steigt bei Unterversorgung, der Blutzucker verschiebt sich bei
 * Dosisänderungen, bei Hashimoto kommen B12- und Eisenmangel häufiger vor,
 * und Blutarmut oder ein niedriges Natrium erklären Müdigkeit oft besser als
 * die Schilddrüse. Freiwillig; eingeordnet wird nur gegen den Bereich vom
 * Befund – feste Orientierungswerte gibt es hier bewusst nicht.
 */
export const WEITERE_WERTE = [
  ['hb', 'Hämoglobin (Blutfarbstoff)', ['g/dl', 'g/l', 'mmol/l']],
  ['ferritin', 'Ferritin (Eisenspeicher)', ['ng/ml', 'µg/l']],
  ['b12', 'Vitamin B12', ['pg/ml', 'pmol/l']],
  ['vitd', 'Vitamin D (25-OH)', ['ng/ml', 'nmol/l']],
  ['natrium', 'Natrium', ['mmol/l']],
  ['hba1c', 'HbA1c (Langzeit-Blutzucker)', ['%', 'mmol/mol']],
  ['ldl', 'LDL-Cholesterin', ['mg/dl', 'mmol/l']],
  ['crp', 'CRP (Entzündungswert)', ['mg/l', 'mg/dl']],
];

/** Antworten auf Ja/Nein-Fragen: '' heißt „noch nicht beantwortet", 'unbekannt' „weiß nicht". */
export const JNW = ['ja', 'nein', 'unbekannt', ''];

/*
 * Schlüssel, Name, Einheiten zur Auswahl (die erste ist vorbelegt). Beim
 * TSH meinen alle dieselbe Größe mit demselben Zahlenwert – deutsche Labore
 * schreiben oft „mIE/l". Umgerechnet wird in js/einschaetzung.js.
 */
export const LABORWERTE = [
  ['tsh', 'TSH', ['mU/l', 'mIE/l', 'µU/ml', 'mIU/l', 'µIU/ml']],
  ['ft4', 'fT4', ['pmol/l', 'ng/dl', 'ng/l']],
  ['ft3', 'fT3', ['pmol/l', 'pg/ml']],
];

function leererStand() {
  return {
    version: VERSION,
    profil: {
      name: '',             // Anrede in der App, nur hier gespeichert
      begruesst: false,     // Willkommensseite durchlaufen
      // Der Tag, an dem die App eingerichtet wurde. Davor gibt es keine
      // Einträge, weil es die App nicht gab – die Tage zählen deshalb nicht
      // als „ohne Eintrag", auch wenn die Dosis schon seit Jahren gilt.
      seit: null,
      // Für die Einschätzung, alles freiwillig. Nicht angegeben heißt
      // immer „weiß nicht", nie „nein".
      geburtsjahr: null,    // im Alter gelten oft andere Zielwerte
      ursache: '',          // siehe URSACHEN
      // Die Ja/Nein-Fragen: ja | nein | unbekannt („weiß nicht") | '' (offen).
      krebs: '',            // je wegen Schilddrüsenkrebs behandelt – dann soll TSH oft niedrig sein
      praeparatArt: '',     // t4 | t3 | unbekannt | '' – siehe PRAEPARATE
      herz: '',             // Vorhofflimmern, andere Rhythmusstörung, Herzschwäche, Herzkranzgefäße
      osteoporose: '',
      kortison: '',         // dauerhaft Kortison-Tabletten oder Nebennierenschwäche
      diabetes: '',
      schwanger: '',        // nur gefragt, wenn das Alter unter 55 liegt
      // Der persönliche TSH-Zielbereich, wenn die Ärztin ihn genannt hat
      // (mU/l). Er hat Vorrang vor dem Bereich des Labors und vor den
      // Altersregeln – mit Datum, weil ein Ziel still veraltet.
      zielVon: null,
      zielBis: null,
      zielNiedrig: '',      // „Meine Ärztin möchte den TSH-Wert bewusst niedrig halten"
      zielAm: null,         // wann der Zielbereich eingetragen oder bestätigt wurde
      // „Hat Ihnen eine Ärztin gesagt, dass die Ursache in der Hirnanhangdrüse
      // liegt oder dass Ihr TSH bewusst niedrig gehalten werden soll?" – nur
      // gefragt, wenn der Behandlungsgrund offen ist.
      hypophyseOderNiedrig: '',
      bundesland: '',       // für die Giftnotruf-Nummer – siehe BUNDESLAENDER
      // Bestätigt: wegen einer Unterfunktion mit Tabletten in Behandlung.
      // Nur dafür gelten die Regeln der Einschätzung.
      behandelt: false,
      oestrogenPruefen: false, // alter Eintrag „Östrogen" – Tablette oder Pflaster?
      // Die Mittel wurden schon einmal gespeichert. Erst danach gilt ein neu
      // angekreuztes Mittel als „neu begonnen" – beim ersten Eintragen nimmt
      // man die meisten schon seit Jahren.
      mittelErfasst: false,
    },
    // Weitere Mittel als Schlüssel aus MITTEL.
    mittel: [],
    // Je Mittel, das Abstand zur Tablette braucht: ja | nein | unbekannt.
    mittelAbstand: {},
    // Beginn und Ende eines Mittels, das den Bedarf verändert – für die
    // Erinnerung an die Kontrolle nach 6–8 Wochen: [{ id, key, art: beginn|ende, am }]
    mittelWechsel: [],
    // Wann die Einnahmezeit um mehr als drei Stunden verschoben wurde – auch
    // das kann den Wert verändern: [{ id, am, von, nach }]
    uhrWechsel: [],
    // Antworten auf die Nachfragen nach einer Dosisänderung und auf der
    // Dosis-Karte: [{ id, art, bezug, antwort, am }] – siehe js/dosis.js
    nachfragen: [],
    einstellungen: {
      erinnerung: '07:00',  // Uhrzeit der Tablette – Hinweis in der App und Kalenderdatei
      schrift: 'gross',     // normal | gross | sehr-gross
      farbe: 'hell',        // hell | dunkel
      hinweisTablette: true, // Systemhinweis, wenn die App offen ist und die Tablette fehlt
    },
    // Die Dosis, wie sie auf der Packung steht, ab wann. Die neueste gilt.
    // praxis: auf Anweisung der Praxis eingetragen (true/false/null).
    dosen: [],              // [{ id, ab, praeparat, mikrogramm, tabletten, notiz, praxis }]
    // Einnahmen je Tag: { uhr } genommen, null bewusst „nicht genommen",
    // fehlender Tag „unbekannt" – der Unterschied zählt im Arztbericht.
    einnahmen: {},
    // Befunde: [{ id, datum, tsh, ft4, ft3, …WEITERE_WERTE, notiz, und die
    // Fragen zur Blutabnahme (siehe normStand) }] – je Wert { wert, einheit, von, bis } oder null
    labor: [],
    befinden: [],           // [{ id, datum, stufe: gut|mittel|schlecht, beschwerden: [], notiz }]
    gewicht: [],            // [{ id, datum, kg }]
    termine: [],            // [{ id, datum, uhr, art: arzt|labor|sonst, wo, blutabnahme, notiz }]
    fragen: [],             // Fragen für den nächsten Arzttermin: [{ id, text, erledigt }]
    // Warnzeichen-Checks mit den Fragen, die mit Ja beantwortet wurden – für
    // die Gesamteinschätzung und den Bericht: [{ id, datum, uhr, ja: [] }]
    warnzeichen: [],
    vorrat: null,           // { tabletten, stand } – Packungsvorrat, oder null
    tab: 'heute',
    letzteSicherung: null,  // ISO-Tag der letzten gespeicherten Sicherung
    dauerhaft: false,       // Zusage des Browsers, den Speicher nicht selbst zu räumen
  };
}

const text = (v, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '');

/*
 * Kennungen aus einer Sicherungsdatei nur, wenn sie aussehen wie die eigenen.
 * Sie landen in data-Attributen und in der UID-Zeile der Kalenderdatei – eine
 * Kennung mit Zeilenumbruch schmuggelte dort eine eigene Zeile hinein (aus
 * einem einmaligen Termin wurde ein täglicher). Doppelte bekommen eine neue.
 */
let gesehen = new Set();
function eigeneKennung(v) {
  const id = typeof v === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(v) && !gesehen.has(v) ? v : kennung();
  gesehen.add(id);
  return id;
}
const bool = (v, sonst = false) => (typeof v === 'boolean' ? v : sonst);
const wahl = (v, erlaubt, sonst) => (erlaubt.includes(v) ? v : sonst);
/** Ja/Nein/Weiß-nicht; eine Zwischenfassung speicherte true/false. */
const jnw = (v) => (v === true ? 'ja' : v === false ? 'nein' : wahl(v, JNW, ''));
/*
 * Biotin und „Tablette vor der Abnahme" waren in derselben Zwischenfassung
 * nur Haken – und ihr normStand schrieb false in jeden Befund, auch in einen
 * aus Fassung 1, bei dem nie gefragt worden war. false heißt hier also „kein
 * Haken", nicht „nein". Als 'nein' übersprang die Dosis-Karte die Fragen F1
 * und F2 und nannte eine Richtung, und der Arztbericht wies „Biotin: nein"
 * als Angabe der Patientin aus (C16). Offen ('') fragt die Karte noch einmal –
 * schlimmstenfalls einmal zu viel.
 */
const haken = (v) => (v === true ? 'ja' : v === false ? '' : wahl(v, JNW, ''));

/*
 * Ein Laborwert: { wert, einheit, von, bis, unter }. Der Bereich darf
 * einseitig sein („< 116", „> 20") – beim TSH braucht die Einschätzung zwar
 * beide Grenzen, aber abschreiben soll man, was auf dem Befund steht. Eine
 * Untergrenze über der Obergrenze ist ein Tippfehler; dann gilt keiner.
 * `unter`: auf dem Befund stand „< 0,01" – gespeichert wird die Grenze.
 */
function normWert(roh) {
  if (!roh || typeof roh !== 'object') return null;
  const wert = zahlAus(roh.wert);
  if (wert === null || wert < 0) return null;
  let von = zahlAus(roh.von);
  let bis = zahlAus(roh.bis);
  if (von !== null && bis !== null && von >= bis) { von = null; bis = null; }
  return { wert, einheit: text(roh.einheit, 20), von, bis, unter: bool(roh.unter) };
}

/**
 * Eine Liste von Einträgen mit Datum – alles ohne gültiges Datum fällt
 * heraus, ebenso alles, wofür `jeEintrag` null liefert.
 *
 * Erst prüfen, dann die Kennung anfügen: `{ id, ...null }` ist ein Objekt mit
 * nur einer Kennung, kein null – so blieben verworfene Einträge (ein Befund
 * ohne einen einzigen Wert, ein Gewicht von 0 kg) als leere Hüllen stehen,
 * und das Sortieren nach Datum stürzte an ihnen ab.
 */
function liste(roh, jeEintrag, feld = 'datum') {
  if (!Array.isArray(roh)) return [];
  return roh
    // Genau das Feld, nach dem die Liste sortiert wird – eine Dosis mit
    // „datum" statt „ab" kam sonst durch und ließ das Sortieren abstürzen.
    .filter((e) => e && typeof e === 'object' && istISO(e[feld]))
    .map((e) => {
      const eintrag = jeEintrag(e);
      return eintrag ? { id: eigeneKennung(e.id), ...eintrag } : null;
    })
    .filter(Boolean);
}

/*
 * Die Fragen zur Blutabnahme in einem Befund (ohne die Uhrzeiten). Auch das
 * Befund-Formular führt mit ihnen zwei Einträge eines Tages zusammen.
 */
export const FRAGEN_FELDER = ['vorAbnahme', 'biotin', 'krank', 'kortison', 'kontrastmittel', 'mittelGeaendert', 'einnahmeGeaendert',
  'packung', 'abstandOk', 'vergessen', 'einnahmeArt', 'verwechselt', 'praxis'];

/**
 * Sagen zwei Einträge beim selben Wert Verschiedenes – Zahl, Einheit oder
 * „<"? Dann weiß nur der Befund, welcher stimmt. Der Bereich zählt hier nicht.
 */
export function wertWiderspruch(a, b) {
  return Boolean(a && b) && (a.wert !== b.wert || a.einheit !== b.einheit || Boolean(a.unter) !== Boolean(b.unter));
}

/*
 * Zwei Befunde vom selben Abnahmetag sind meist ein Befund, in zwei Schritten
 * eingetragen (erst TSH, später fT4). Getrennt fiele das fT4 aus Muster und
 * Dosis-Karte heraus (B52). Das Formular verhindert neue Doppelungen; hier
 * werden vorhandene zusammengeführt.
 *
 * Widersprechen sich zwei Werte (TSH 7 und 7,5), bleiben die Einträge
 * getrennt, und die Einschätzung sagt es dazu. Ein weiterer Eintrag des
 * Tages kommt dann zum ZULETZT eingetragenen – mit ihm rechnet die
 * Auswertung (letzterBefund, dosisBefund). Vorher landete ein nachgereichtes
 * fT4 beim ersten, überholten Eintrag und fehlte in jeder Einschätzung (C15).
 *
 * Sonst wird zusammengeführt, aber nichts still entschieden (C14). Vorher
 * gewann still die erste Angabe: Ein „Biotin: ja" hinter einem „nein" ging
 * verloren, und die Dosis-Karte nannte eine Richtung, die Biotin sperrt.
 *   - Verschiedene Antworten auf eine Frage: Sie ist wieder offen, die
 *     Dosis-Karte stellt sie neu (Entscheidung 6).
 *   - Verschiedene Bereiche zum selben Wert: Es gilt der spätere (wie bei der
 *     Auswertung), der andere steht in der Notiz. Den Bereich zu leeren hieße,
 *     nach der Orientierung einzuordnen – ein Hb unter beiden Bereichen
 *     verlöre seine Frist. Getrennt ließe das fT4 wieder aus dem Muster fallen.
 *   - Verschiedene Uhrzeiten oder Labornamen: Die erste Angabe bleibt, die
 *     zweite steht in der Notiz. Eine unsichere Uhrzeit der Tablette gilt gar
 *     nicht – sie entscheidet mit, ob fT4 an der Tablette liegen kann (L5c).
 */
const WERTE = () => [...LABORWERTE, ...WEITERE_WERTE];
const ZEIT_FELDER = { abnahmeUhr: 'Uhrzeit der Abnahme', tabletteUhr: 'Uhrzeit der Tablette', laborName: 'Labor' };
const bereichText = (w) => `${w.von !== null ? zahlText(w.von, 3) : '…'}–${w.bis !== null ? zahlText(w.bis, 3) : '…'}`;
const verschieden = (a, b) => a !== null && b !== null && a !== b;

function zusammenfuehren(labor) {
  const ergebnis = [];
  // Je Ziel-Eintrag die Felder, die wegen eines Widerspruchs geleert wurden –
  // ein dritter Eintrag desselben Tages darf sie nicht still wieder füllen.
  const geleert = new Map();
  labor.forEach((l) => {
    const da = [...ergebnis].reverse().find((x) => x.datum === l.datum);
    if (!da || WERTE().some(([k]) => wertWiderspruch(da[k], l[k]))) { ergebnis.push(l); return; }
    const zweite = [];
    WERTE().forEach(([k, name]) => {
      const a = da[k];
      const b = l[k];
      if (!b) return;
      if (!a) { da[k] = b; return; }
      const von = b.von ?? a.von;
      const bis = b.bis ?? a.bis;
      if (verschieden(a.von, b.von) || verschieden(a.bis, b.bis) || (von !== null && bis !== null && von >= bis)) {
        zweite.push(`Bereich für ${name.replace(/ \(.*\)$/, '')} auch ${bereichText(a)}`);
        da[k] = { ...a, von: b.von, bis: b.bis };
      } else {
        da[k] = { ...a, von, bis };
      }
    });
    if (!geleert.has(da)) geleert.set(da, new Set());
    const offen = geleert.get(da);
    FRAGEN_FELDER.filter((k) => k !== 'praxis').forEach((k) => {
      if (offen.has(k)) return;
      if (da[k] && l[k] && da[k] !== l[k]) { da[k] = ''; offen.add(k); } else if (!da[k]) da[k] = l[k];
    });
    // Die Angabe der Praxis gehört mit ihrem Datum zusammen (R1).
    if (offen.has('praxis')) { /* widersprüchlich – bleibt offen */ } else if (da.praxis && l.praxis && da.praxis !== l.praxis) { da.praxis = ''; da.praxisAm = null; offen.add('praxis'); } else if (!da.praxis && l.praxis) { da.praxis = l.praxis; da.praxisAm = l.praxisAm; }
    else if (da.praxis && !da.praxisAm) da.praxisAm = l.praxis === da.praxis ? l.praxisAm : null;
    Object.entries(ZEIT_FELDER).forEach(([k, name]) => {
      if (offen.has(k)) {
        if (l[k]) zweite.push(`${name} auch ${l[k]}`);
      } else if (da[k] && l[k] && da[k] !== l[k]) {
        zweite.push(k === 'tabletteUhr' ? `${name} ${da[k]} oder ${l[k]}` : `${name} auch ${l[k]}`);
        if (k === 'tabletteUhr') { da[k] = ''; offen.add(k); }
      } else if (!da[k]) da[k] = l[k];
    });
    da.bestaetigt = da.bestaetigt || l.bestaetigt;
    // Felder, die oben nicht vorkommen: leere ergänzen, wie bisher. Die
    // oben bewusst geleerten (eine Frage wieder offen) bleiben leer.
    const oben = new Set(['id', 'datum', 'notiz', 'praxisAm', ...WERTE().map(([k]) => k), ...FRAGEN_FELDER, ...Object.keys(ZEIT_FELDER)]);
    Object.keys(l).filter((k) => !oben.has(k)).forEach((k) => {
      if (da[k] === null || da[k] === undefined || da[k] === '') da[k] = l[k];
    });
    const zusatz = zweite.length ? `Zwei Einträge vom selben Tag zusammengeführt – bitte mit dem Befund vergleichen: ${zweite.join('; ')}.` : '';
    const eigene = [da.notiz, l.notiz].filter(Boolean).filter((x, i, alle) => alle.indexOf(x) === i).join(' · ');
    da.notiz = [eigene.slice(0, zusatz ? Math.max(0, 297 - zusatz.length) : 300), zusatz].filter(Boolean).join(' · ').slice(0, 300);
  });
  return ergebnis;
}

/**
 * Jeden gelesenen Stand in die Form bringen, mit der die App rechnet.
 * Unbekannte Felder fallen weg, kaputte Werte werden zu ihrem Standard.
 */
export function normStand(roh) {
  gesehen = new Set();
  const s = leererStand();
  if (!roh || typeof roh !== 'object') return s;
  const p = roh.profil || {};
  s.profil.name = text(p.name, 60);
  s.profil.begruesst = bool(p.begruesst);
  s.profil.seit = istISO(p.seit) ? p.seit : null;
  const jahr = zahlAus(p.geburtsjahr);
  s.profil.geburtsjahr = jahr !== null && Number.isInteger(jahr) && jahr >= 1900 && jahr <= 2020 ? jahr : null;
  s.profil.ursache = wahl(p.ursache, URSACHEN.map(([k]) => k), '');
  // Eine Zwischenfassung führte Krebs als Behandlungsgrund.
  s.profil.krebs = p.ursache === 'krebs' ? 'ja' : wahl(p.krebs, JNW, '');
  s.profil.praeparatArt = wahl(p.praeparatArt, ['t4', 't3', 'unbekannt', ''], '');
  ['herz', 'osteoporose', 'kortison', 'diabetes', 'schwanger', 'hypophyseOderNiedrig'].forEach((k) => {
    s.profil[k] = wahl(p[k], JNW, '');
  });
  const zielVon = zahlAus(p.zielVon);
  const zielBis = zahlAus(p.zielBis);
  if (zielVon !== null && zielBis !== null && zielVon >= 0.01 && zielVon < zielBis && zielBis <= 10) {
    s.profil.zielVon = zielVon;
    s.profil.zielBis = zielBis;
  }
  s.profil.zielNiedrig = jnw(p.zielNiedrig);
  s.profil.zielAm = istISO(p.zielAm) && (s.profil.zielVon !== null || s.profil.zielNiedrig === 'ja') ? p.zielAm : null;
  s.profil.bundesland = wahl(p.bundesland, BUNDESLAENDER.map(([k]) => k), '');
  s.profil.behandelt = bool(p.behandelt);

  // Mittel: der alte Schlüssel „oestrogen" wird zur Tablette – das war die
  // häufigere Form – und die App fragt einmal nach, ob es nicht ein Pflaster ist.
  const rohMittel = Array.isArray(roh.mittel) ? roh.mittel : [];
  // Eine schon gespeicherte Liste ist kein Ersteintrag mehr. Eine
  // Zwischenfassung speicherte Mittel, kannte das Feld aber nicht – danach
  // galt ein beim ersten Speichern neu angekreuztes Mittel nicht als
  // „begonnen", und die Erinnerung an die Kontrolle (L7b) fehlte (C21).
  s.profil.mittelErfasst = bool(p.mittelErfasst) || rohMittel.length > 0;
  s.profil.oestrogenPruefen = bool(p.oestrogenPruefen) || rohMittel.includes('oestrogen');
  s.mittel = [...new Set(rohMittel.map((k) => (k === 'oestrogen' ? 'oestrogen_tablette' : k))
    .filter((k) => MITTEL.some(([m]) => m === k)))];
  // Kortison stand eine Zeit lang in der Liste der Mittel; jetzt ist es eine
  // eigene Frage, weil sie auch die Nebennierenschwäche einschließt.
  if (rohMittel.includes('kortison') && !s.profil.kortison) s.profil.kortison = 'ja';
  if (roh.mittelAbstand && typeof roh.mittelAbstand === 'object' && !Array.isArray(roh.mittelAbstand)) {
    Object.entries(roh.mittelAbstand).forEach(([k, v]) => {
      if (MITTEL.some(([m]) => m === k) && ['ja', 'nein', 'unbekannt'].includes(v)) s.mittelAbstand[k] = v;
    });
  }
  s.mittelWechsel = liste(roh.mittelWechsel, (w) => (MITTEL.some(([m]) => m === w.key) && ['beginn', 'ende'].includes(w.art)
    ? { key: w.key, art: w.art, am: w.am } : null), 'am').sort((a, b) => a.am.localeCompare(b.am)).slice(-60);
  const e = roh.einstellungen || {};
  s.einstellungen.erinnerung = istUhr(e.erinnerung) ? e.erinnerung : '07:00';
  s.einstellungen.schrift = wahl(e.schrift, ['normal', 'gross', 'sehr-gross'], 'gross');
  s.einstellungen.farbe = wahl(e.farbe, ['hell', 'dunkel'], 'hell');
  s.einstellungen.hinweisTablette = bool(e.hinweisTablette, true);

  s.dosen = liste(roh.dosen, (d) => {
    const mikrogramm = zahlAus(d.mikrogramm);
    return {
      ab: d.ab,
      praeparat: text(d.praeparat, 80),
      mikrogramm: mikrogramm !== null && mikrogramm > 0 ? mikrogramm : null,
      tabletten: zahlAus(d.tabletten) > 0 ? zahlAus(d.tabletten) : 1,
      notiz: text(d.notiz, 300),
      praxis: typeof d.praxis === 'boolean' ? d.praxis : null,
      // Eingetragen nach „Nein, ich nehme etwas anderes" auf der Dosis-Karte:
      // keine Änderung der Dosis, sondern eine Berichtigung dessen, was die App
      // wusste. Sie zählt nie als angeordnete Änderung (D0.5).
      berichtigung: bool(d.berichtigung),
    };
  }, 'ab').sort((a, b) => a.ab.localeCompare(b.ab));

  if (roh.einnahmen && typeof roh.einnahmen === 'object' && !Array.isArray(roh.einnahmen)) {
    Object.entries(roh.einnahmen).forEach(([tag, wert]) => {
      if (!istISO(tag)) return;
      if (wert === null) { s.einnahmen[tag] = null; return; }
      if (wert && typeof wert === 'object') s.einnahmen[tag] = { uhr: istUhr(wert.uhr) ? wert.uhr : '' };
    });
  }

  s.labor = liste(roh.labor, (l) => {
    const eintrag = {
      datum: l.datum, tsh: normWert(l.tsh), ft4: normWert(l.ft4), ft3: normWert(l.ft3), notiz: text(l.notiz, 300),
      ...Object.fromEntries(WEITERE_WERTE.map(([k]) => [k, normWert(l[k])])),
      // Die Fragen zur Blutabnahme – alle freiwillig, ja | nein | unbekannt
      // | '' (offen). Ohne sie lassen sich manche Muster nicht sicher deuten:
      // Eine Tablette vor der Abnahme hebt fT4, Biotin verfälscht die Messung,
      // eine schwere Krankheit oder Kortison verschieben die Werte für Wochen.
      // Offene Fragen stellt die Dosis-Karte, bevor sie eine Richtung nennt.
      abnahmeUhr: istUhr(l.abnahmeUhr) ? l.abnahmeUhr : '',
      vorAbnahme: haken(l.vorAbnahme),      // Tablette am Abnahmetag vorher genommen
      tabletteUhr: istUhr(l.tabletteUhr) ? l.tabletteUhr : '',
      biotin: haken(l.biotin),              // in der Woche davor Biotin
      krank: jnw(l.krank),                  // 6 Wochen davor schwer krank, Krankenhaus, Operation
      kortison: jnw(l.kortison),            // 6 Wochen davor Kortison als Tablette oder Spritze
      kontrastmittel: jnw(l.kontrastmittel), // 8 Wochen davor Kontrastmittel
      mittelGeaendert: jnw(l.mittelGeaendert), // 8 Wochen davor ein Mittel begonnen oder abgesetzt
      einnahmeGeaendert: jnw(l.einnahmeGeaendert), // Frühstück, Kaffee oder Uhrzeit verschoben
      packung: jnw(l.packung ?? l.hersteller), // 8 Wochen davor andere Packung: Name, Hersteller, Stärke
      // Tabletten in den 6 Wochen davor vergessen: nein | einzelne | mehrere
      // | unbekannt | ''. Die Einnahmen in der App zeigen das nur, wenn sie
      // gepflegt wurden.
      vergessen: wahl(l.vergessen, ['nein', 'einzelne', 'mehrere', 'unbekannt', ''], ''),
      // Nüchtern mit Wasser, 30–60 Minuten vor Frühstück und Kaffee?
      einnahmeArt: wahl(l.einnahmeArt, ['ja', 'abends', 'nein', 'unbekannt', ''], ''),
      abstandOk: jnw(l.abstandOk),          // Abstände aus „Was braucht Abstand?" eingehalten
      verwechselt: wahl(l.verwechselt, ['einmal', 'tage', 'nein', 'unbekannt', ''], ''), // versehentlich mehr genommen
      laborName: text(l.laborName, 60),
      // Was die Praxis zu diesem Wert gesagt hat – und wann:
      // bleibt | geaendert | nachmessen | nochnicht | ''.
      praxis: wahl(l.praxis, ['bleibt', 'geaendert', 'nachmessen', 'nochnicht', ''],
        l.erklaert === true ? 'bleibt' : ''),
      praxisAm: istISO(l.praxisAm) ? l.praxisAm : null,
      // Ein ungewöhnlicher Wert (Komma, Einheit) wurde ausdrücklich bestätigt.
      bestaetigt: bool(l.bestaetigt),
    };
    return [...LABORWERTE, ...WEITERE_WERTE].some(([k]) => eintrag[k]) ? eintrag : null;
  }).sort((a, b) => a.datum.localeCompare(b.datum));
  s.labor = zusammenfuehren(s.labor);

  s.befinden = liste(roh.befinden, (b) => ({
    datum: b.datum,
    stufe: wahl(b.stufe, ['gut', 'mittel', 'schlecht'], 'mittel'),
    beschwerden: Array.isArray(b.beschwerden)
      ? [...new Set(b.beschwerden.filter((k) => [...BESCHWERDEN, ...ALTE_BESCHWERDEN].some(([id]) => id === k)))] : [],
    notiz: text(b.notiz, 500),
  })).sort((a, b) => a.datum.localeCompare(b.datum));

  s.gewicht = liste(roh.gewicht, (g) => {
    const kg = zahlAus(g.kg);
    return kg !== null && kg > 0 && kg < 400 ? { datum: g.datum, kg } : null;
  }).sort((a, b) => a.datum.localeCompare(b.datum));

  s.termine = liste(roh.termine, (t) => ({
    datum: t.datum,
    uhr: istUhr(t.uhr) ? t.uhr : '',
    art: wahl(t.art, ['arzt', 'labor', 'sonst'], 'arzt'),
    wo: text(t.wo, 80),
    blutabnahme: bool(t.blutabnahme),
    notiz: text(t.notiz, 300),
  })).sort((a, b) => `${a.datum}${a.uhr}`.localeCompare(`${b.datum}${b.uhr}`));

  s.fragen = Array.isArray(roh.fragen)
    ? roh.fragen.filter((f) => f && typeof f.text === 'string' && f.text.trim())
      .map((f) => ({ id: eigeneKennung(f.id), text: text(f.text, 300), erledigt: bool(f.erledigt) }))
    : [];

  s.uhrWechsel = liste(roh.uhrWechsel, (u) => (istUhr(u.von) && istUhr(u.nach)
    ? { am: u.am, von: u.von, nach: u.nach } : null), 'am').sort((a, b) => a.am.localeCompare(b.am)).slice(-20);
  s.nachfragen = liste(roh.nachfragen, (n) => (typeof n.art === 'string' && /^[a-z0-9_]{1,30}$/.test(n.art)
    && typeof n.bezug === 'string' && n.bezug.length <= 40 && typeof n.antwort === 'string' && /^[a-z0-9_]{1,20}$/.test(n.antwort)
    ? { art: n.art, bezug: n.bezug, antwort: n.antwort, am: n.am } : null), 'am').slice(-80);

  // Der Arztbericht listet die Checks der letzten 90 Tage (Entscheidung 17).
  // Wer bei Herzklopfen täglich prüft (W-D1), hat schnell mehr als 50 – eine
  // Grenze von 50 löschte so beim nächsten Start still ältere Checks, auch
  // einen mit Brustschmerz. Die Grenze schützt nur noch den Speicher und ist
  // in 90 Tagen nicht zu erreichen (über zehn Checks an jedem Tag). Bewusst
  // nach Anzahl, nicht nach Alter: ein Alter hinge an der Uhr des Geräts.
  s.warnzeichen = liste(roh.warnzeichen, (w) => ({
    datum: w.datum,
    uhr: istUhr(w.uhr) ? w.uhr : '',
    ja: Array.isArray(w.ja) ? [...new Set(w.ja.filter((k) => typeof k === 'string' && /^[a-z0-9_]{1,30}$/.test(k)))].slice(0, 30) : [],
  })).sort((a, b) => `${a.datum}${a.uhr}`.localeCompare(`${b.datum}${b.uhr}`)).slice(-1000);

  if (roh.vorrat && typeof roh.vorrat === 'object' && istISO(roh.vorrat.stand)) {
    const tabletten = zahlAus(roh.vorrat.tabletten);
    if (tabletten !== null && tabletten >= 0) s.vorrat = { tabletten, stand: roh.vorrat.stand };
  }

  s.tab = wahl(roh.tab, ['heute', 'verlauf', 'mehr'], 'heute');
  s.letzteSicherung = istISO(roh.letzteSicherung) ? roh.letzteSicherung : null;
  s.dauerhaft = bool(roh.dauerhaft);
  return s;
}

// ---------------------------------------------------------------- Laden

let stand = leererStand();
let speicherFehler = null;   // 'gesperrt' | 'voll' | null
let speicherOk = true;

/*
 * Warum das Schreiben scheitert: „voll" oder „gesperrt" (privates Fenster).
 * Ein älteres Safari meldet im privaten Fenster denselben Fehler wie bei
 * vollem Speicher – seine Grenze ist dort 0. Ein voller Speicher hat aber
 * Inhalt (unseren Stand oder den der Workout-App nebenan), ein privates
 * Fenster mit Grenze 0 nicht. Deshalb galt früher bei der Probe beim Start
 * immer „gesperrt" – und ein schon beim Start voller Speicher hieß
 * „privates Fenster?", ohne den Rat zur Sicherung (C20).
 */
function warumNicht(fehler) {
  const name = fehler && (fehler.name || '');
  const code = fehler && fehler.code;
  const grenze = name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || code === 22 || code === 1014;
  if (!grenze) return 'gesperrt';
  try {
    return localStorage.length > 0 ? 'voll' : 'gesperrt';
  } catch {
    return 'gesperrt';
  }
}

try {
  localStorage.setItem(`${SCHLUESSEL}.probe`, '1');
  localStorage.removeItem(`${SCHLUESSEL}.probe`);
} catch (e) {
  speicherOk = false;
  speicherFehler = warumNicht(e);
}

/** Ein gespeicherter Stand aus einer neueren Fassung – wird nicht angefasst. */
let neuererStand = false;

/** „Alles löschen" einer Instanz – siehe allesLoeschen(). */
const GELOESCHT = `${SCHLUESSEL}.geloescht`;
let bekannteLoeschung = null;
try {
  bekannteLoeschung = localStorage.getItem(GELOESCHT);
} catch { /* kein Speicher – dann gibt es auch kein fremdes Löschen */ }

try {
  const roh = localStorage.getItem(SCHLUESSEL);
  if (roh) {
    const daten = JSON.parse(roh);
    if (daten && typeof daten.version === 'number' && daten.version > VERSION) {
      neuererStand = true;
    } else {
      stand = normStand(daten);
    }
  }
} catch {
  // Kaputter Speicher: lieber leer starten als gar nicht. Was da stand,
  // bleibt im Schlüssel, bis das erste Speichern es ersetzt.
}

// ---------------------------------------------------------------- Schreiben

const zuhoerer = new Set();
let timer = null;

function schreiben() {
  timer = null;
  if (neuererStand) return;  // siehe oben – nie einen neueren Stand überschreiben
  const vorher = kannSpeichern();
  const grundVorher = speicherGrund();
  try {
    localStorage.setItem(SCHLUESSEL, JSON.stringify(stand));
    speicherOk = true;
    speicherFehler = null;
  } catch (e) {
    speicherOk = false;
    speicherFehler = warumNicht(e);
  }
  // Auch ein anderer Grund ist eine Meldung wert: Die Warnung nennt ihn (C20).
  if (kannSpeichern() !== vorher || speicherGrund() !== grundVorher) melden();
}

function merken() {
  clearTimeout(timer);
  timer = setTimeout(schreiben, 120);
}

/**
 * Den Stand neu aus dem Speicher lesen – wenn eine andere Instanz (ein
 * Browser-Tab neben der installierten App) inzwischen geschrieben hat.
 * Nicht, solange hier selbst noch ein Schreibvorgang aussteht: Der wäre
 * sonst verloren. Rückgabe: ob sich etwas geändert hat.
 */
export function neuLesen() {
  if (timer !== null || neuererStand) return false;
  try {
    const roh = localStorage.getItem(SCHLUESSEL);
    if (!roh) {
      // Nur ein vermerktes Löschen einer anderen Instanz leert den Stand hier (C19).
      const loeschung = localStorage.getItem(GELOESCHT);
      if (!loeschung || loeschung === bekannteLoeschung) return false;
      bekannteLoeschung = loeschung;
      stand = leererStand();
      return true;
    }
    if (roh === JSON.stringify(stand)) return false;
    const daten = JSON.parse(roh);
    if (daten && typeof daten.version === 'number' && daten.version > VERSION) {
      neuererStand = true;
      stand = leererStand();
      return true;
    }
    stand = normStand(daten);
    return true;
  } catch {
    return false;
  }
}

/** Ausstehendes Schreiben sofort – bevor die App in den Hintergrund geht. */
export function sofortSchreiben() {
  if (timer === null) return;
  clearTimeout(timer);
  schreiben();
}

function melden() {
  zuhoerer.forEach((fn) => fn(stand));
}

export function abonnieren(fn) {
  zuhoerer.add(fn);
  return () => zuhoerer.delete(fn);
}

export function getStand() { return stand; }

/** false, wenn der Browser nichts speichern kann – Eintragungen sind dann flüchtig. */
export function kannSpeichern() { return speicherOk && !neuererStand; }

/** 'gesperrt', 'voll', 'neuer' oder null. */
export function speicherGrund() {
  if (neuererStand) return 'neuer';
  return speicherOk ? null : speicherFehler;
}

/** Eine Änderung am Stand: ändern, speichern, allen Bescheid sagen. */
export function aendern(fn) {
  fn(stand);
  merken();
  melden();
}

// ---------------------------------------------------------------- Abfragen

/** Die Dosis, die an `tag` gilt – die neueste mit ab <= tag. */
export function dosisAm(tag = heuteISO()) {
  let gefunden = null;
  for (const d of stand.dosen) {
    if (d.ab <= tag) gefunden = d;
  }
  return gefunden;
}

/**
 * Die Dosis, die heute gilt. Eine schon eingetragene, aber erst später
 * geltende Dosis („ab Montag 100 µg") ist das nicht – die steht in
 * naechsteDosis(). Gibt es nur künftige, gilt die früheste als die aktuelle:
 * Irgendeine muss „Heute" nennen.
 */
export function aktuelleDosis(tag = heuteISO()) {
  return dosisAm(tag) || stand.dosen[0] || null;
}

/** Die nächste Dosis, die erst nach `tag` gilt – oder null. */
export function naechsteDosis(tag = heuteISO()) {
  const jetzt = aktuelleDosis(tag);
  return stand.dosen.find((d) => d.ab > tag && d !== jetzt) || null;
}

/**
 * Ab welchem Tag die Einnahmen zählen: nicht vor der ersten Dosis, und nicht
 * vor dem Tag, an dem die App eingerichtet wurde – es sei denn, es wurde
 * ausdrücklich ein früherer Tag nachgetragen. null ohne Dosis.
 *
 * Vorher zählte jeder Tag seit der ersten Dosis. Wer beim Einrichten „seit
 * März" angab, hatte am ersten Tag „an 0 von 28 Tagen genommen, 28 ohne
 * Eintrag" im Bericht – wahr, aber für die Ärztin irreführend.
 */
export function zaehltAb() {
  if (!stand.dosen.length) return null;
  const ersteDosis = stand.dosen[0].ab;
  const tage = Object.keys(stand.einnahmen).sort();
  const kandidaten = [stand.profil.seit, tage[0]].filter(Boolean).sort();
  const erfasst = kandidaten[0] || ersteDosis;
  return erfasst > ersteDosis ? erfasst : ersteDosis;
}

/**
 * Die Menge am Tag in µg: Stärke × Tabletten. null, wenn die Stärke fehlt.
 *
 * Nicht die Stärke allein: Bei 1½ Tabletten zu 50 µg nimmt man 75 µg am Tag.
 * Im Bericht stand zuerst „Dosis damals 50 µg" – und eine Ärztin, die danach
 * die neue Dosis festlegt, rechnete mit der falschen Ausgangsmenge.
 */
export function tagesdosis(d) {
  if (!d || d.mikrogramm === null) return null;
  return Math.round(d.mikrogramm * d.tabletten * 10) / 10;
}

/**
 * „L-Thyroxin 75 µg, 1 Tablette am Tag" bzw. „L-Thyroxin 50 µg, 1½ Tabletten
 * am Tag – zusammen 75 µg". Leer, wenn nichts eingetragen ist.
 */
export function dosisText(d = aktuelleDosis()) {
  if (!d) return '';
  const name = [d.praeparat, d.mikrogramm !== null ? `${String(d.mikrogramm).replace('.', ',')} µg` : '']
    .filter(Boolean).join(' ');
  const menge = d.tabletten === 1 ? '1 Tablette'
    : d.tabletten === 0.5 ? '½ Tablette'
      : d.tabletten === 1.5 ? '1½ Tabletten'
        : `${String(d.tabletten).replace('.', ',')} Tabletten`;
  const summe = d.tabletten !== 1 && tagesdosis(d) !== null ? ` – zusammen ${String(tagesdosis(d)).replace('.', ',')} µg` : '';
  const ohneStaerke = d.mikrogramm === null ? ' (Stärke noch nicht eingetragen)' : '';
  return `${name ? `${name}, ` : ''}${menge} am Tag${summe}${ohneStaerke}`;
}

/** { uhr } genommen, null nicht genommen, undefined unbekannt. */
export function einnahme(tag = heuteISO()) {
  return stand.einnahmen[tag];
}

export function einnahmeSetzen(tag, wert) {
  aendern((s) => {
    if (wert === undefined) delete s.einnahmen[tag];
    else s.einnahmen[tag] = wert;
  });
}

/**
 * Einnahmen der letzten `tage` Tage bis einschließlich `bis`:
 * genommen, ausgelassen (bewusst nicht), unbekannt (kein Eintrag).
 * Tage vor zaehltAb() zählen nicht – davor gab es nichts zu nehmen oder
 * noch keine App, in der man es hätte abhaken können.
 */
export function einnahmeBilanz(tage = 28, bis = heuteISO()) {
  const erste = zaehltAb();
  const bilanz = { genommen: 0, ausgelassen: 0, unbekannt: 0, tage: 0, ausgelassenTage: [], bis };
  // Der laufende Tag zählt erst, wenn für ihn etwas eingetragen ist. Vorher
  // stand morgens vor der Tablette „1 Tag ohne Eintrag" im Bericht – für die
  // Ärztin sah das nach einer Lücke aus, die es nicht gab. Das Fenster rückt
  // dann einen Tag zurück und bleibt so lang wie verlangt.
  if (bis === heuteISO() && stand.einnahmen[bis] === undefined) bilanz.bis = tageWeiterLokal(bis, -1);
  const d = new Date(`${bilanz.bis}T12:00:00`);
  for (let i = 0; i < tage; i++) {
    const tag = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    d.setDate(d.getDate() - 1);
    if (erste && tag < erste) continue;
    bilanz.tage++;
    const e = stand.einnahmen[tag];
    if (e === null) { bilanz.ausgelassen++; bilanz.ausgelassenTage.push(tag); } else if (e) bilanz.genommen++;
    else bilanz.unbekannt++;
  }
  return bilanz;
}

/** Alter in ganzen Jahren am Tag `tag` (nur aus dem Jahr, also ± 1) – oder null. */
export function alter(tag = heuteISO()) {
  const j = stand.profil.geburtsjahr;
  return j ? Number(tag.slice(0, 4)) - j : null;
}

/**
 * Die Liste der weiteren Mittel ersetzen. Ab dem zweiten Speichern wird jedes
 * neu angekreuzte oder weggenommene Mittel mit Datum vermerkt – daraus
 * erinnert die App an die Kontrolle 6–8 Wochen nach Beginn oder Ende.
 */
export function mittelSetzen(neu, abstand = {}, heute = heuteISO()) {
  aendern((s) => {
    const vorher = new Set(s.mittel);
    const danach = [...new Set(neu.filter((k) => MITTEL.some(([m]) => m === k)))];
    if (s.profil.mittelErfasst) {
      danach.filter((k) => !vorher.has(k)).forEach((key) => s.mittelWechsel.push({ id: kennung(), key, art: 'beginn', am: heute }));
      [...vorher].filter((k) => !danach.includes(k)).forEach((key) => s.mittelWechsel.push({ id: kennung(), key, art: 'ende', am: heute }));
    }
    s.mittel = danach;
    s.mittelAbstand = Object.fromEntries(Object.entries(abstand)
      .filter(([k, v]) => danach.includes(k) && ['ja', 'nein', 'unbekannt'].includes(v)));
    s.profil.mittelErfasst = true;
    // Das Formular zeigt die Rückfrage zum alten „Östrogen" – gespeichert ist beantwortet.
    s.profil.oestrogenPruefen = false;
  });
}

/** Der nächste Termin ab heute, oder null. */
export function naechsterTermin(heute = heuteISO()) {
  return stand.termine.find((t) => t.datum >= heute) || null;
}

/** Tage, die der Vorrat noch reicht – oder null ohne Vorrat/Dosis. */
export function vorratReicht(heute = heuteISO()) {
  if (!stand.vorrat) return null;
  const dosis = aktuelleDosis();
  const jeTag = dosis ? dosis.tabletten : 1;
  const vergangen = Math.max(0, Math.round((new Date(`${heute}T12:00:00`) - new Date(`${stand.vorrat.stand}T12:00:00`)) / 86400000));
  const rest = stand.vorrat.tabletten - vergangen * jeTag;
  return Math.floor(rest / jeTag);
}

// ---------------------------------------------------------------- Sicherung

export function exportJSON() {
  return JSON.stringify({ ...stand, exportiertAm: new Date().toISOString(), app: 'schilddruese' }, null, 2);
}

/**
 * Eine Sicherung einlesen. Rückgabe { ok, grund }.
 * Der vorherige Stand bleibt unter einem Nebenschlüssel, bis das nächste
 * Einlesen ihn ersetzt – ein Fehlgriff lässt sich so zurückholen.
 */
export function importJSON(textDaten) {
  let daten;
  try {
    daten = JSON.parse(textDaten);
  } catch {
    return { ok: false, grund: 'Die Datei ist keine Sicherung dieser App.' };
  }
  // Eine Sicherung dieser App trägt ihren Namen; ältere oder von Hand
  // gebaute erkennt man an den eigenen Feldern. Die Sicherung der
  // Workout-App nebenan hat beides nicht – und würde sonst als leerer Stand
  // eingelesen, der alles ersetzt.
  const unsere = daten && typeof daten === 'object' && !Array.isArray(daten) && 'version' in daten
    && (daten.app === 'schilddruese' || (!('app' in daten) && 'profil' in daten && 'einnahmen' in daten));
  if (!unsere) {
    return { ok: false, grund: 'Die Datei ist keine Sicherung dieser App.' };
  }
  if (typeof daten.version !== 'number' || daten.version > VERSION) {
    return { ok: false, grund: 'Die Sicherung stammt aus einer neueren Fassung der App. Bitte erst die App aktualisieren.' };
  }
  // Liegt im Speicher ein Stand aus einer neueren Fassung, würde das Einlesen
  // ihn überschreiben – und die Rücklage enthielte nur den leeren Stand, den
  // diese Fassung stattdessen zeigt.
  if (neuererStand) {
    return { ok: false, grund: 'Auf diesem Handy liegen Daten aus einer neueren Fassung der App. Bitte zuerst die App aktualisieren (Seite neu laden).' };
  }
  // Die Rücklage nur, wenn es etwas zu sichern gibt – auf einem neuen Handy
  // ist der Stand davor leer, und ein Knopf, der ihn „zurückholt", wäre eine
  // Falle. Mit Datum, damit der Knopf nicht wochenlang stehen bleibt.
  const hatteDaten = stand.profil.begruesst || stand.dosen.length || Object.keys(stand.einnahmen).length;
  try {
    if (hatteDaten) {
      localStorage.setItem(`${SCHLUESSEL}.vorImport`, JSON.stringify({ am: heuteISO(), stand }));
    } else {
      localStorage.removeItem(`${SCHLUESSEL}.vorImport`);
    }
  } catch { /* kein Platz für die Rücklage – dann eben ohne */ }
  stand = normStand(daten);
  neuererStand = false;
  merken();
  melden();
  return { ok: true, grund: '' };
}

/**
 * Gibt es einen Stand von vor dem letzten Einlesen, der sich noch
 * zurückholen lässt? Nur am Tag des Einlesens und den zwei Tagen danach –
 * wer sich vertan hat, merkt es sofort; Wochen später wäre „zurückholen"
 * nur noch ein Weg, alles seither Eingetragene zu verlieren.
 */
export function rueckholbar(heute = heuteISO()) {
  try {
    const roh = localStorage.getItem(`${SCHLUESSEL}.vorImport`);
    if (!roh) return null;
    const r = JSON.parse(roh);
    if (!r || !istISO(r.am) || !r.stand) return null;
    const alter = Math.round((new Date(`${heute}T12:00:00`) - new Date(`${r.am}T12:00:00`)) / 86400000);
    return alter >= 0 && alter <= 2 ? r : null;
  } catch {
    return null;
  }
}

export function importZurueck() {
  try {
    const r = rueckholbar();
    if (!r) return false;
    stand = normStand(r.stand);
    localStorage.removeItem(`${SCHLUESSEL}.vorImport`);
    merken();
    melden();
    return true;
  } catch {
    return false;
  }
}

/*
 * Alles löschen. Eine zweite offene Instanz (ein Browser-Tab neben der
 * installierten App) muss es übernehmen: Sonst behielt sie ihren Stand,
 * zeigte ihn weiter und schrieb ihn beim nächsten Tipp zurück – das Löschen
 * war rückgängig gemacht (C19). Ein fehlender Schlüssel allein heißt dort
 * aber nicht „gelöscht": Wo nie geschrieben werden konnte (Speicher
 * gesperrt), fehlt er immer, und der Stand im Arbeitsspeicher ist der
 * einzige. Deshalb steht das Löschen mit einer eigenen Kennung unter einem
 * Nebenschlüssel; neuLesen() übernimmt es nur bei einer Kennung, die diese
 * Instanz noch nicht kennt.
 */
export function allesLoeschen() {
  clearTimeout(timer);
  timer = null;
  stand = leererStand();
  neuererStand = false;
  bekannteLoeschung = kennung();
  const vermerken = () => {
    try {
      localStorage.setItem(GELOESCHT, bekannteLoeschung);
      return true;
    } catch {
      return false;
    }
  };
  const vermerkt = vermerken();
  try {
    localStorage.removeItem(SCHLUESSEL);
    localStorage.removeItem(`${SCHLUESSEL}.vorImport`);
  } catch { /* dann bleibt es beim nächsten Schreiben leer */ }
  // War der Speicher voll, ist jetzt Platz für den Vermerk.
  if (!vermerkt) vermerken();
  melden();
}
