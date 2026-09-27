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
import { heuteISO, istISO, istUhr, zahlAus } from './datum.js';

export const SCHLUESSEL = 'schilddruese.stand.v1';
export const VERSION = 1;

/** Eine Kennung für Einträge – kurz, zufällig, ohne Bibliothek. */
export function kennung() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** Bekannte Beschwerden für das Befinden – Schlüssel und Anzeigetext. */
export const BESCHWERDEN = [
  ['muede', 'müde, erschöpft'],
  ['frieren', 'friere leicht'],
  ['schwitzen', 'schwitze, innerlich unruhig'],
  ['herz', 'Herzklopfen'],
  ['verstopfung', 'Verstopfung'],
  ['durchfall', 'Durchfall'],
  ['haut', 'trockene Haut, Haarausfall'],
  ['stimmung', 'gedrückte Stimmung'],
  ['schlaf', 'schlecht geschlafen'],
  ['konzentration', 'Konzentration fällt schwer'],
  ['gewicht', 'Gewicht verändert'],
  ['schmerzen', 'Muskel- oder Gelenkschmerzen'],
];

export const LABORWERTE = [
  // Schlüssel, Name, übliche Einheiten (die erste ist vorbelegt)
  ['tsh', 'TSH', ['mU/l', 'µU/ml']],
  ['ft4', 'fT4', ['pmol/l', 'ng/dl']],
  ['ft3', 'fT3', ['pmol/l', 'pg/ml']],
];

function leererStand() {
  return {
    version: VERSION,
    profil: {
      name: '',             // Anrede in der App, nur hier gespeichert
      begruesst: false,     // Willkommensseite durchlaufen
    },
    einstellungen: {
      erinnerung: '07:00',  // Uhrzeit der Tablette – Hinweis in der App und Kalenderdatei
      schrift: 'gross',     // normal | gross | sehr-gross
      farbe: 'hell',        // hell | dunkel
      hinweisTablette: true, // Systemhinweis, wenn die App offen ist und die Tablette fehlt
    },
    // Die Dosis, wie sie auf der Packung steht, ab wann. Die neueste gilt.
    dosen: [],              // [{ id, ab, praeparat, mikrogramm, tabletten, notiz }]
    // Einnahmen je Tag: { uhr } genommen, null bewusst „nicht genommen",
    // fehlender Tag „unbekannt" – der Unterschied zählt im Arztbericht.
    einnahmen: {},
    labor: [],              // [{ id, datum, tsh, ft4, ft3, notiz }] – je Wert { wert, einheit, von, bis } oder null
    befinden: [],           // [{ id, datum, stufe: gut|mittel|schlecht, beschwerden: [], notiz }]
    gewicht: [],            // [{ id, datum, kg }]
    termine: [],            // [{ id, datum, uhr, art: arzt|labor|sonst, wo, blutabnahme, notiz }]
    fragen: [],             // Fragen für den nächsten Arzttermin: [{ id, text, erledigt }]
    vorrat: null,           // { tabletten, stand } – Packungsvorrat, oder null
    tab: 'heute',
    letzteSicherung: null,  // ISO-Tag der letzten gespeicherten Sicherung
    dauerhaft: false,       // Zusage des Browsers, den Speicher nicht selbst zu räumen
  };
}

const text = (v, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '');
const bool = (v, sonst = false) => (typeof v === 'boolean' ? v : sonst);
const wahl = (v, erlaubt, sonst) => (erlaubt.includes(v) ? v : sonst);

function normWert(roh) {
  if (!roh || typeof roh !== 'object') return null;
  const wert = zahlAus(roh.wert);
  if (wert === null) return null;
  const von = zahlAus(roh.von);
  const bis = zahlAus(roh.bis);
  return {
    wert,
    einheit: text(roh.einheit, 20),
    von: von !== null && bis !== null && von <= bis ? von : null,
    bis: von !== null && bis !== null && von <= bis ? bis : null,
  };
}

/** Eine Liste von Einträgen mit Datum – alles ohne gültiges Datum fällt heraus. */
function liste(roh, jeEintrag) {
  if (!Array.isArray(roh)) return [];
  return roh
    .filter((e) => e && typeof e === 'object' && istISO(e.datum || e.ab))
    .map((e) => ({ id: text(e.id, 40) || kennung(), ...jeEintrag(e) }))
    .filter(Boolean);
}

/**
 * Jeden gelesenen Stand in die Form bringen, mit der die App rechnet.
 * Unbekannte Felder fallen weg, kaputte Werte werden zu ihrem Standard.
 */
export function normStand(roh) {
  const s = leererStand();
  if (!roh || typeof roh !== 'object') return s;
  const p = roh.profil || {};
  s.profil.name = text(p.name, 60);
  s.profil.begruesst = bool(p.begruesst);
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
    };
  }).sort((a, b) => a.ab.localeCompare(b.ab));

  if (roh.einnahmen && typeof roh.einnahmen === 'object' && !Array.isArray(roh.einnahmen)) {
    Object.entries(roh.einnahmen).forEach(([tag, wert]) => {
      if (!istISO(tag)) return;
      if (wert === null) { s.einnahmen[tag] = null; return; }
      if (wert && typeof wert === 'object') s.einnahmen[tag] = { uhr: istUhr(wert.uhr) ? wert.uhr : '' };
    });
  }

  s.labor = liste(roh.labor, (l) => {
    const eintrag = { datum: l.datum, tsh: normWert(l.tsh), ft4: normWert(l.ft4), ft3: normWert(l.ft3), notiz: text(l.notiz, 300) };
    return eintrag.tsh || eintrag.ft4 || eintrag.ft3 ? eintrag : null;
  }).sort((a, b) => a.datum.localeCompare(b.datum));

  s.befinden = liste(roh.befinden, (b) => ({
    datum: b.datum,
    stufe: wahl(b.stufe, ['gut', 'mittel', 'schlecht'], 'mittel'),
    beschwerden: Array.isArray(b.beschwerden)
      ? b.beschwerden.filter((k) => BESCHWERDEN.some(([id]) => id === k)) : [],
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
      .map((f) => ({ id: text(f.id, 40) || kennung(), text: text(f.text, 300), erledigt: bool(f.erledigt) }))
    : [];

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

function warumNicht(fehler) {
  const name = fehler && (fehler.name || '');
  const code = fehler && fehler.code;
  return (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED'
    || code === 22 || code === 1014) ? 'voll' : 'gesperrt';
}

try {
  localStorage.setItem(`${SCHLUESSEL}.probe`, '1');
  localStorage.removeItem(`${SCHLUESSEL}.probe`);
} catch {
  speicherOk = false;
  speicherFehler = 'gesperrt';
}

/** Ein gespeicherter Stand aus einer neueren Fassung – wird nicht angefasst. */
let neuererStand = false;

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
  try {
    localStorage.setItem(SCHLUESSEL, JSON.stringify(stand));
    speicherOk = true;
    speicherFehler = null;
  } catch (e) {
    speicherOk = false;
    speicherFehler = warumNicht(e);
  }
  if (kannSpeichern() !== vorher) melden();
}

function merken() {
  clearTimeout(timer);
  timer = setTimeout(schreiben, 120);
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

export function aktuelleDosis() {
  return stand.dosen.length ? stand.dosen[stand.dosen.length - 1] : null;
}

/** „L-Thyroxin 75 µg, 1 Tablette" – oder leer, wenn nichts eingetragen ist. */
export function dosisText(d = aktuelleDosis()) {
  if (!d) return '';
  const name = [d.praeparat, d.mikrogramm !== null ? `${String(d.mikrogramm).replace('.', ',')} µg` : '']
    .filter(Boolean).join(' ');
  const menge = d.tabletten === 1 ? '1 Tablette'
    : d.tabletten === 0.5 ? '½ Tablette'
      : d.tabletten === 1.5 ? '1½ Tabletten'
        : `${String(d.tabletten).replace('.', ',')} Tabletten`;
  return name ? `${name}, ${menge} am Tag` : `${menge} am Tag`;
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
 * Tage vor der ersten Dosis zählen nicht – davor gab es nichts zu nehmen.
 */
export function einnahmeBilanz(tage = 28, bis = heuteISO()) {
  const erste = stand.dosen.length ? stand.dosen[0].ab : null;
  const bilanz = { genommen: 0, ausgelassen: 0, unbekannt: 0, tage: 0, ausgelassenTage: [] };
  const d = new Date(`${bis}T12:00:00`);
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
  try {
    localStorage.setItem(`${SCHLUESSEL}.vorImport`, JSON.stringify(stand));
  } catch { /* kein Platz für die Rücklage – dann eben ohne */ }
  stand = normStand(daten);
  neuererStand = false;
  merken();
  melden();
  return { ok: true, grund: '' };
}

export function importZurueck() {
  try {
    const roh = localStorage.getItem(`${SCHLUESSEL}.vorImport`);
    if (!roh) return false;
    stand = normStand(JSON.parse(roh));
    localStorage.removeItem(`${SCHLUESSEL}.vorImport`);
    merken();
    melden();
    return true;
  } catch {
    return false;
  }
}

export function allesLoeschen() {
  stand = leererStand();
  neuererStand = false;
  try {
    localStorage.removeItem(SCHLUESSEL);
    localStorage.removeItem(`${SCHLUESSEL}.vorImport`);
  } catch { /* dann bleibt es beim nächsten Schreiben leer */ }
  melden();
}
