/*
 * Die Liste: halten, sortieren, hinausgeben.
 *
 * Alles liegt im Browser dieses Geräts (localStorage), nichts auf einem Server.
 * Das ist keine Bescheidenheit, sondern die einzige vertretbare Bauweise: Eine
 * Tabelle mit Namen, Wohnorten und Verabredungen anderer Menschen ist deren
 * Sache, nicht die eines fremden Rechenzentrums. Wer sie woanders haben will,
 * nimmt die Sicherung – eine Datei, die man selbst in der Hand hat.
 */

import { entfernung } from './geo.js';

const KEY = 'matches.v1';

export const APPS = { tinder: 'Tinder', hinge: 'Hinge', bumble: 'Bumble', andere: 'Andere' };

export const STATUS = {
  neu: 'Neu',
  geschrieben: 'Geschrieben',
  date: 'Date gehabt',
  aus: 'Erledigt',
};

/** Wonach sich sortieren lässt – zugleich die Prüfliste beim Einlesen. */
export const SORTIERBAR = ['km', 'name', 'app', 'matchAm', 'status', 'nachrichten'];

const LEER = {
  heim: null,          // { ort, lat, lon } – der Punkt, von dem aus gemessen wird
  netzsuche: false,    // Ortssuche im Netz erlaubt (siehe geo.js)
  leute: [],
  sortier: { feld: 'km', richtung: 1 },
  // Zeitstempel der zuletzt übernommenen daten.json des Mitlesers. Ohne den
  // würde jeder Takt dieselbe Datei erneut melden – nicht falsch, aber laut.
  zuletztGeholt: null,
};

/** Eine Kennung, die auch ohne crypto.randomUUID funktioniert. */
export function neueId() {
  if (globalThis.crypto && globalThis.crypto.randomUUID) return globalThis.crypto.randomUUID();
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Eine Zahl aus einem Feld lesen, das auch leer sein darf.
 *
 * Eigener Helfer statt Number() an Ort und Stelle, und zwar wegen eines Fehlers,
 * der genau hier saß: `Number(null)` und `Number('')` sind **0**. Ein leer
 * gelassenes Kilometerfeld wurde damit zu „0 km" – und 0 km sortiert ganz nach
 * oben. Die Tabelle behauptete also von jeder Zeile ohne Angabe, sie wohne
 * nebenan, und stellte sie an die Spitze. Genau die eine Aussage, die diese App
 * nie machen darf.
 */
function zahl(wert) {
  if (wert === null || wert === undefined || wert === '') return null;
  // „0,8" kommt aus deutschen Tastaturen und aus zurückgelesenen CSV-Dateien.
  const n = Number(typeof wert === 'string' ? wert.replace(',', '.') : wert);
  return Number.isFinite(n) ? n : null;
}

/** Eine Zeile auf die erwarteten Felder bringen – egal, woher sie kam. */
export function person(roh = {}) {
  const km = zahl(roh.km);
  return {
    id: roh.id || neueId(),
    name: String(roh.name || '').trim(),
    app: APPS[roh.app] ? roh.app : 'andere',
    km: km !== null && km >= 0 ? km : null,
    ort: String(roh.ort || '').trim(),
    lat: zahl(roh.lat),
    lon: zahl(roh.lon),
    matchAm: /^\d{4}-\d{2}-\d{2}$/.test(roh.matchAm || '') ? roh.matchAm : null,
    status: STATUS[roh.status] ? roh.status : 'neu',
    notiz: String(roh.notiz || ''),
    nachrichten: Number(roh.nachrichten) || 0,
    quelle: roh.quelle === 'import' ? 'import' : 'hand',
    extern: roh.extern || null,
    geraten: Boolean(roh.geraten),
  };
}

export function laden(ablage = globalThis.localStorage) {
  try {
    const roh = ablage && ablage.getItem(KEY);
    if (!roh) return { ...LEER, leute: [] };
    const daten = JSON.parse(roh);
    const s = daten.sortier || {};
    return {
      ...LEER,
      ...daten,
      // Eine Sicherung aus einer anderen Fassung kann nach einer Spalte
      // sortieren wollen, die es hier nicht gibt. Dann wäre jeder Wert leer und
      // die Tabelle stünde in Eingabereihenfolge da – ohne dass irgendwo
      // stünde, warum.
      sortier: {
        feld: SORTIERBAR.includes(s.feld) ? s.feld : 'km',
        richtung: s.richtung === -1 ? -1 : 1,
      },
      leute: Array.isArray(daten.leute) ? daten.leute.map(person) : [],
    };
  } catch {
    // Eine kaputte Ablage darf die App nicht am Starten hindern. Lieber leer
    // anfangen als weiß auf weiß stehen bleiben.
    return { ...LEER, leute: [] };
  }
}

export function sichern(zustand, ablage = globalThis.localStorage) {
  try {
    ablage.setItem(KEY, JSON.stringify(zustand));
    return true;
  } catch {
    return false;
  }
}

/**
 * Sortieren.
 *
 * Eine Sache ist hier absichtlich unsymmetrisch: Zeilen **ohne** Entfernung
 * stehen immer unten, in beide Richtungen. Wer nach „am nächsten" sortiert,
 * will oben die Nächsten sehen – und wer umdreht, die Fernsten. Ein Dutzend
 * „unbekannt" an der Spitze wäre in beiden Fällen die falsche Antwort auf die
 * gestellte Frage.
 */
export function sortieren(leute, heim, feld = 'km', richtung = 1) {
  const wert = (p) => {
    switch (feld) {
      case 'km': return entfernung(p, heim).km;
      case 'name': return p.name ? p.name.toLocaleLowerCase('de') : null;
      case 'app': return p.app;
      case 'matchAm': return p.matchAm;
      case 'nachrichten': return p.nachrichten;
      case 'status': return Object.keys(STATUS).indexOf(p.status);
      default: return null;
    }
  };
  const leer = (v) => v === null || v === undefined || v === '';
  return [...leute].sort((a, b) => {
    const x = wert(a);
    const y = wert(b);
    if (leer(x) && leer(y)) return 0;
    if (leer(x)) return 1;
    if (leer(y)) return -1;
    if (x === y) return (a.name || '').localeCompare(b.name || '', 'de');
    return (x < y ? -1 : 1) * richtung;
  });
}

/** Nach App, Status und Suchwort einschränken. */
export function filtern(leute, { app = '', status = '', suche = '' } = {}) {
  const s = suche.trim().toLocaleLowerCase('de');
  return leute.filter((p) => {
    if (app && p.app !== app) return false;
    if (status && p.status !== status) return false;
    if (!s) return true;
    return `${p.name} ${p.ort} ${p.notiz}`.toLocaleLowerCase('de').includes(s);
  });
}

/** Kilometer für die Anzeige: unter 10 km eine Nachkommastelle, darüber keine. */
export function kmText(km) {
  if (km === null || km === undefined) return '–';
  if (km < 10) return `${km.toFixed(1).replace('.', ',')} km`;
  return `${Math.round(km)} km`;
}

/**
 * Die Tabelle als CSV. Semikolon als Trenner, weil das die Tabellenprogramme im
 * deutschsprachigen Raum ohne Rückfrage richtig aufteilen.
 */
export function alsCsv(leute, heim) {
  const felder = ['Name', 'App', 'Entfernung km', 'Quelle', 'Ort', 'Match am', 'Status', 'Nachrichten', 'Notiz'];
  const zelle = (v) => {
    const t = String(v === null || v === undefined ? '' : v);
    return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const zeilen = leute.map((p) => {
    const e = entfernung(p, heim);
    return [
      p.name, APPS[p.app] || p.app,
      e.km === null ? '' : e.km.toFixed(1).replace('.', ','),
      e.quelle === 'eingetragen' ? 'aus der App' : (e.quelle === 'gerechnet' ? 'aus dem Ort gerechnet' : ''),
      p.ort, p.matchAm || '', STATUS[p.status] || p.status, p.nachrichten, p.notiz,
    ].map(zelle).join(';');
  });
  return [felder.join(';'), ...zeilen].join('\r\n');
}
