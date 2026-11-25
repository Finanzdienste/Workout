/*
 * Meine Apps – aus den Zahlen des Servers wird je App: wer sie benutzt hat,
 * wann zuletzt, an welchen der letzten 14 Tage und wie lange.
 *
 * Tobi, 25.11.2026: „Können wir mir nicht mal ne masterübersicht aus allen
 * meinen Apps bauen damit ich seh ob die genutzt werden?“
 *
 * Reine Funktionen ohne Seite und ohne Netz – tests/test-apps.mjs prüft sie
 * direkt in Node. Was der Server schickt, beschreibt tools/apps-uebersicht.sql
 * (apps_uebersicht). Ein Tag ist immer ein Tag in Berlin, als „JJJJ-MM-TT“.
 */

import { tagebuchTage, standardMittel } from './tagebuch.js';

/** So viele Tage zeigt der Streifen je App. */
export const TAGE = 14;

/**
 * Alle Apps, auch die, die nichts melden. `pfad` ist relativ zu /Workout/apps/
 * (alle liegen auf finanzdienste.github.io); `blind` sagt, was die Übersicht
 * nicht sehen kann, `misstNichts`, warum sie gar nichts sieht. Body Check
 * sieht nur, was jemand dort ausdrücklich teilt (`ungeteilt`, solange nichts
 * geteilt ist).
 */
export const APPS = [
  {
    id: 'workout', name: 'Workout', pfad: '../', farbe: '#e8743b',
    quelle: 'Bildschirmzeit-Widget und Rückkanal der App',
  },
  {
    id: 'boxenstopp', name: 'Boxenstopp', pfad: '../../Boxenstopp/', farbe: '#2e8b57',
    quelle: 'Bildschirmzeit-Widget und KI-Anfragen',
    blind: 'Amy und Marielle meldet Boxenstopp nicht – hier steht nur, was dein Widget misst.',
  },
  {
    id: 'bewerbungszentrale', name: 'Bewerbungszentrale', pfad: '../../Bewerbungszentrale/', farbe: '#3b6fd4',
    quelle: 'Bildschirmzeit-Widget',
  },
  {
    id: 'freizeit', name: 'Freizeit', pfad: '../../Freizeit/', farbe: '#d9a21b',
    quelle: 'Bildschirmzeit-Widget, „zuletzt in der App“ und Haken der Eingeladenen',
  },
  {
    id: 'mahlzeit', name: 'Mahlzeit', pfad: '../mahlzeit/', farbe: '#2e7d4f',
    quelle: 'Lebenszeichen der App (nur Zahlen)',
  },
  {
    id: 'schilddruese', name: 'Schilddrüse', pfad: '../schilddruese/', farbe: '#8a5cc2',
    quelle: 'tägliches Lebenszeichen der App',
    leer: 'Noch kein Gerät hat sich gemeldet.',
  },
  {
    id: 'fragmal', name: 'Frag mal', pfad: '../../Amy/', farbe: '#c2477a',
    quelle: 'Anmeldungen und Chats (aus den Kosten)',
  },
  {
    id: 'widget', name: 'Bildschirmzeit-Widget', pfad: null, farbe: '#455a64',
    quelle: 'wann das Widget zuletzt Zahlen geholt hat',
    // Der Server kennt nur den letzten Abruf, keinen Verlauf: kein Streifen.
    nurZuletzt: true,
  },
  {
    id: 'bodycheck', name: 'Body Check', pfad: '../../Bauchbuch/', farbe: '#b0603a',
    quelle: 'geteiltes Tagebuch – nur nach „Ja, teilen“ in Body Check',
    ungeteilt: 'Noch nichts geteilt. Body Check schickt das Tagebuch erst, wenn in der App „Ja, teilen“ getippt wurde.',
  },
];

/* ------------------------------------------------------------------ *
 * Tage
 * ------------------------------------------------------------------ */

const BERLIN = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' });
const UHR = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' });

/** Zeitpunkt (ISO) oder Tag → Tag in Berlin; Unbrauchbares → null. */
export function tagAus(wert) {
  if (!wert || typeof wert !== 'string') return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(wert)) return wert;
  const d = new Date(wert);
  return Number.isNaN(d.getTime()) ? null : BERLIN.format(d);
}

/** Uhrzeit in Berlin, „14:05“. */
export function uhrAus(wert) {
  const d = new Date(wert);
  return Number.isNaN(d.getTime()) ? '' : UHR.format(d);
}

const ms = (tag) => Date.parse(`${tag}T00:00:00Z`);

/** Ganze Tage von `tag` bis `heute` (gestern = 1). */
export function abstand(tag, heute) {
  return Math.round((ms(heute) - ms(tag)) / 86400000);
}

/** Die letzten `n` Tage bis einschließlich heute, ältester zuerst. */
export function letzteTage(heute, n = TAGE) {
  const t0 = ms(heute);
  return Array.from({ length: n }, (_, i) => new Date(t0 - (n - 1 - i) * 86400000).toISOString().slice(0, 10));
}

/** „23.11.“ */
export function datumKurz(tag) {
  const [, m, d] = tag.split('-');
  return `${Number(d)}.${Number(m)}.`;
}

/** „heute“, „gestern“, „vor 3 Tagen“, „noch nie“. */
export function wann(tag, heute) {
  if (!tag) return 'noch nie';
  const d = abstand(tag, heute);
  if (d <= 0) return 'heute';
  if (d === 1) return 'gestern';
  return `vor ${d} Tagen`;
}

/** „1 Std. 5 Min.“, „12 Min.“, „unter 1 Min.“ – wie das Widget. */
export function dauer(sekunden) {
  const min = Math.round(sekunden / 60);
  if (min < 1) return 'unter 1 Min.';
  const std = Math.floor(min / 60);
  const rest = min % 60;
  if (!std) return `${min} Min.`;
  return rest ? `${std} Std. ${rest} Min.` : `${std} Std.`;
}

/* ------------------------------------------------------------------ *
 * Auswerten
 * ------------------------------------------------------------------ */

/**
 * Wie frisch: „frisch“ (bis 2 Tage), „mittel“ (bis 7), „alt“, „nie“ oder
 * „nichts“ (misst nichts).
 */
export function stufe(zuletzt, heute) {
  if (!zuletzt) return 'nie';
  const d = abstand(zuletzt, heute);
  if (d <= 2) return 'frisch';
  if (d <= 7) return 'mittel';
  return 'alt';
}

const zahl = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);
const text = (x) => (x === null || x === undefined ? '' : String(x).trim());
const liste = (x) => (Array.isArray(x) ? x : []);
const mehrzahl = (n, eins, viele) => `${n} ${n === 1 ? eins : viele}`;

/**
 * Aus der Antwort von apps_uebersicht() je App:
 *   { app, zuletzt, stufe, wann, streifen: [{ tag, an, sekunden }], aktiv,
 *     leute: [{ name, zuletzt, wann, tage, sekunden, notiz }], weitere,
 *     zeilen: [Text], ...App-Angaben }
 * Sortiert: zuletzt benutzt zuerst, nie benutzt danach, „misst nichts“ ans Ende.
 */
export function auswerten(daten, heute = tagAus(daten && daten.heute) || tagAus(new Date().toISOString()), bodycheck = []) {
  const d = daten || {};
  const fenster = letzteTage(heute);
  const imFenster = new Set(fenster);
  const ab = fenster[0];
  const apps = new Map(APPS.map((a) => [a.id, { ...a, leute: new Map(), zeilen: [] }]));

  const person = (app, name) => {
    const a = apps.get(app);
    if (!a || !name) return null;
    let p = a.leute.get(name);
    if (!p) {
      p = { name, tage: new Set(), sekunden: 0, zuletzt: null, notiz: [] };
      a.leute.set(name, p);
    }
    return p;
  };
  const merke = (p, tag) => {
    if (!p || !tag || tag > heute) return;
    if (tag >= ab) p.tage.add(tag);
    if (!p.zuletzt || tag > p.zuletzt) p.zuletzt = tag;
  };
  const sekundenJeTag = new Map();

  // Bildschirmzeit aus Tobis Widget: Sekunden je App und Tag.
  liste(d.bildschirmzeit).forEach((z) => {
    const s = zahl(z.sekunden);
    const tag = tagAus(z.tag);
    if (!apps.has(z.app) || !tag || s <= 0) return;
    const p = person(z.app, 'Tobi');
    merke(p, tag);
    if (imFenster.has(tag)) {
      p.sekunden += s;
      const k = `${z.app}|${tag}`;
      sekundenJeTag.set(k, (sekundenJeTag.get(k) || 0) + s);
    }
  });

  // Freizeit: Namen zu den Kennungen, dann „zuletzt in der App“ und Haken.
  const freizeitName = new Map();
  liste(d.freizeit).forEach((z) => { if (z.wer) freizeitName.set(z.wer, z.name || 'ohne Namen'); });

  // Tage aus apps_tag (Workout, Schilddrüse, Freizeit).
  liste(d.tage).forEach((z) => {
    const name = z.app === 'freizeit' ? freizeitName.get(z.wer) : z.wer;
    merke(person(z.app, name), tagAus(z.tag));
  });

  // Workout: je Name, mit letztem Training.
  liste(d.workout).forEach((z) => {
    const p = person('workout', z.wer);
    merke(p, tagAus(z.gesehen));
    if (!p) return;
    if (z.trainiert) {
      merke(p, tagAus(z.trainiert));
      p.notiz.push(`zuletzt trainiert am ${datumKurz(tagAus(z.trainiert))}`);
    }
    if (zahl(z.geraete) > 1) p.notiz.push(mehrzahl(zahl(z.geraete), 'Gerät', 'Geräte'));
  });

  // Schilddrüse: je Gerät.
  liste(d.schilddruese).forEach((z) => {
    const p = person('schilddruese', z.wer);
    merke(p, tagAus(z.zuletzt));
    if (p && z.erstmals) p.notiz.push(`an ${mehrzahl(zahl(z.tage), 'Tag', 'Tagen')} seit ${datumKurz(tagAus(z.erstmals))}`);
  });

  // Mahlzeit: ein Lebenszeichen je Gerät und Tag.
  const essen = new Map();
  const startbildschirm = new Set();
  liste(d.mahlzeit).forEach((z) => {
    const p = person('mahlzeit', z.wer);
    const tag = tagAus(z.tag);
    merke(p, tag);
    if (p && imFenster.has(tag)) essen.set(p, (essen.get(p) || 0) + zahl(z.essen));
    if (p && z.als_app) startbildschirm.add(p);
  });
  essen.forEach((n, p) => { if (n) p.notiz.push(`${mehrzahl(n, 'Eintrag', 'Einträge')} in ${TAGE} Tagen`); });
  startbildschirm.forEach((p) => p.notiz.push('vom Startbildschirm'));
  const ki = liste(d.mahlzeit_ki).filter((z) => imFenster.has(tagAus(z.tag))).reduce((s, z) => s + zahl(z.n), 0);
  if (ki) apps.get('mahlzeit').zeilen.push(`KI: ${mehrzahl(ki, 'Anfrage', 'Anfragen')} in ${TAGE} Tagen`);

  // Freizeit: wer dabei ist.
  liste(d.freizeit).forEach((z) => {
    const p = person('freizeit', z.name || 'ohne Namen');
    [z.angelegt, z.offen, z.bock].forEach((t) => merke(p, tagAus(t)));
  });
  const leuteFreizeit = liste(d.freizeit).length;
  if (leuteFreizeit) apps.get('freizeit').zeilen.push(`${mehrzahl(leuteFreizeit, 'Person', 'Personen')} im Raum`);

  // Frag mal: Konten (Anmelden und Weiterlaufen der Sitzung) und Chats.
  liste(d.fragmal_konten).forEach((z) => merke(person('fragmal', `Konto ${z.nr}`), tagAus(z.zuletzt)));
  const kiBox = { n: 0, zuletzt: null };
  const chats = new Map();
  liste(d.fragmal).forEach((z) => {
    const tag = tagAus(z.tag);
    if (z.app === 'fragmal') {
      const p = person('fragmal', z.konto ? `Konto ${z.konto}` : 'ohne Konto');
      merke(p, tag);
      if (p && imFenster.has(tag)) chats.set(p, (chats.get(p) || 0) + zahl(z.n));
    } else if (z.app === 'boxenstopp' && tag) {
      if (imFenster.has(tag)) kiBox.n += zahl(z.n);
      if (!kiBox.zuletzt || tag > kiBox.zuletzt) kiBox.zuletzt = tag;
    }
  });
  chats.forEach((n, p) => p.notiz.push(`${mehrzahl(n, 'Antwort', 'Antworten')} in ${TAGE} Tagen`));
  if (kiBox.zuletzt) {
    apps.get('boxenstopp').zeilen.push(kiBox.n
      ? `KI: ${mehrzahl(kiBox.n, 'Anfrage', 'Anfragen')} in ${TAGE} Tagen, zuletzt ${wann(kiBox.zuletzt, heute)}`
      : `KI: zuletzt am ${datumKurz(kiBox.zuletzt)}`);
  }

  // Das Widget: wann es zuletzt Zahlen geholt hat.
  if (d.widget) {
    const p = person('widget', 'Tobi');
    merke(p, tagAus(d.widget));
    if (p && tagAus(d.widget) === heute) p.notiz.push(`zuletzt um ${uhrAus(d.widget)} Zahlen geholt`);
  }

  // Body Check: je geteiltem Gerät das Tagebuch (bodycheck_lesen). Benutzt
  // ist ein Tag, an dem etwas eingetragen ist; dazu der Tag der letzten
  // Aktualisierung (die App schickt nur, wenn sich etwas geändert hat).
  const bc = apps.get('bodycheck');
  const geteilt = liste(bodycheck).filter((z) => z && z.stand && typeof z.stand === 'object');
  if (!geteilt.length) bc.misstNichts = bc.ungeteilt;
  bc.tagebuecher = geteilt.map((z) => {
    const name = text(z.name) || 'ohne Namen';
    const p = person('bodycheck', name);
    const tage = tagebuchTage(z.stand);
    merke(p, tagAus(z.aktualisiert));
    tage.forEach((t) => merke(p, t.tag));
    return { name, geraet: text(z.geraet), aktualisiert: z.aktualisiert || null, fassung: text(z.fassung), tage, mittel: standardMittel(z.stand), person: p };
  });
  bc.tagebuecher.forEach((t) => {
    const n = t.tage.filter((x) => imFenster.has(x.tag)).reduce((s, x) => s + x.eintraege.length, 0);
    if (n) t.person.notiz.push(`${mehrzahl(n, 'Eintrag', 'Einträge')} in ${TAGE} Tagen`);
    if (t.aktualisiert) {
      const tag = tagAus(t.aktualisiert);
      t.person.notiz.push(`aktualisiert ${tag === heute ? 'heute' : `am ${datumKurz(tag)}`} um ${uhrAus(t.aktualisiert)}`);
    }
    if (bc.tagebuecher.length > 1 && t.geraet) t.person.notiz.push(t.geraet);
    delete t.person;
  });

  const ergebnis = [...apps.values()].map((a) => {
    const leute = [...a.leute.values()]
      .map((p) => ({
        name: p.name,
        zuletzt: p.zuletzt,
        wann: wann(p.zuletzt, heute),
        tage: p.tage.size,
        sekunden: p.sekunden,
        notiz: p.notiz,
      }))
      .sort((x, y) => (y.zuletzt || '').localeCompare(x.zuletzt || '') || y.tage - x.tage || x.name.localeCompare(y.name, 'de'));
    const zuletzt = leute.reduce((m, p) => (p.zuletzt && (!m || p.zuletzt > m) ? p.zuletzt : m), null);
    const streifen = fenster.map((tag) => ({
      tag,
      an: [...a.leute.values()].some((p) => p.tage.has(tag)),
      sekunden: sekundenJeTag.get(`${a.id}|${tag}`) || 0,
    }));
    // Ein Gerät ohne Namen, das nur an einem Tag kurz da war und sonst nichts
    // getan hat (meist ein Test oder ein Ausprobieren), steht neben jemandem,
    // der die App wirklich benutzt, unter „Weitere“.
    const stamm = leute.some((p) => p.tage >= 2);
    const nebenbei = (p) => stamm && p.name.startsWith('Gerät ') && p.tage <= 1 && !p.notiz.length;
    return {
      ...a,
      leute: leute.filter((p) => p.tage && !nebenbei(p)),
      weitere: leute.filter((p) => !p.tage || nebenbei(p)),
      zuletzt,
      stufe: a.misstNichts ? 'nichts' : stufe(zuletzt, heute),
      wann: a.misstNichts ? (a.ungeteilt ? 'nicht geteilt' : 'misst nichts') : wann(zuletzt, heute),
      streifen,
      aktiv: streifen.filter((t) => t.an).length,
    };
  });

  const rang = (a) => (a.misstNichts ? 2 : a.zuletzt ? 0 : 1);
  return ergebnis.sort((x, y) => rang(x) - rang(y)
    || (y.zuletzt || '').localeCompare(x.zuletzt || '')
    || APPS.findIndex((a) => a.id === x.id) - APPS.findIndex((a) => a.id === y.id));
}

/**
 * Der Satz ganz oben: wie viele Apps in den letzten 7 Tagen benutzt wurden,
 * und welche still sind – mit dem Tag, seit dem.
 */
export function zusammenfassung(apps, heute) {
  const gemessen = apps.filter((a) => !a.misstNichts);
  const benutzt = gemessen.filter((a) => a.zuletzt && abstand(a.zuletzt, heute) <= 7);
  const still = gemessen.filter((a) => !a.zuletzt || abstand(a.zuletzt, heute) > 7)
    .map((a) => (a.zuletzt ? `${a.name} (seit ${datumKurz(a.zuletzt)})` : `${a.name} (noch nie)`));
  return {
    satz: `In den letzten 7 Tagen benutzt: ${benutzt.length} von ${gemessen.length} Apps.`,
    still: still.length ? `Still: ${still.join(', ')}.` : 'Keine ist still.',
  };
}
