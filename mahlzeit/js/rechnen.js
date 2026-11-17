/*
 * Alles, was die App rechnet – ohne Seite, ohne Speicher, ohne Uhr.
 *
 * Jede Funktion bekommt, was sie braucht (den Stand, den heutigen Tag) und
 * gibt etwas zurück. So lässt sich alles hier in Node prüfen
 * (tests/test-mz-rechnen.mjs), und die Ansicht zeigt nur an.
 */

// --- Tage ------------------------------------------------------------------

const zwei = (n) => String(n).padStart(2, '0');

/** Tag eines Date als „2026-11-17" – in Ortszeit, nicht in UTC. */
export function tagVon(d) {
  return `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`;
}

/** „2026-11-17" + n Tage. Mittags gerechnet, damit keine Zeitumstellung stört. */
export function plusTage(tag, n) {
  const d = new Date(`${tag}T12:00:00`);
  d.setDate(d.getDate() + n);
  return tagVon(d);
}

/** Tage von a bis b (b − a). */
export function abstand(a, b) {
  return Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 86400000);
}

const WOCHENTAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

export const monatsname = (m) => MONATE[m];
export const wochentag = (tag) => WOCHENTAGE[new Date(`${tag}T12:00:00`).getDay()];

/** „Dienstag, 17. November" */
export function datumLang(tag) {
  const d = new Date(`${tag}T12:00:00`);
  return `${WOCHENTAGE[d.getDay()]}, ${d.getDate()}. ${MONATE[d.getMonth()]}`;
}

/** „Di, 17.11." */
export function datumKurz(tag) {
  const d = new Date(`${tag}T12:00:00`);
  return `${WOCHENTAGE[d.getDay()].slice(0, 2)}, ${d.getDate()}.${d.getMonth() + 1}.`;
}

/** „Heute", „Gestern", „Morgen" oder das Datum. */
export function tagName(tag, heute) {
  const n = abstand(heute, tag);
  if (n === 0) return 'Heute';
  if (n === -1) return 'Gestern';
  if (n === 1) return 'Morgen';
  return datumLang(tag);
}

// --- Tageszeiten -----------------------------------------------------------

export const TAGESZEITEN = [
  { id: 'morgens', n: 'Morgens' },
  { id: 'mittags', n: 'Mittags' },
  { id: 'nachmittags', n: 'Nachmittags' },
  { id: 'abends', n: 'Abends' },
];

/** Die Tageszeit zur Stunde: bis 11 morgens, bis 15 mittags, bis 18 nachmittags. */
export function tageszeitZu(stunde) {
  if (stunde < 4) return 'abends';   // der Döner nach Mitternacht zählt zum Abend
  if (stunde < 11) return 'morgens';
  if (stunde < 15) return 'mittags';
  if (stunde < 18) return 'nachmittags';
  return 'abends';
}

// --- Zahlen ----------------------------------------------------------------

/** 1240 → „1.240" */
export function zahl(n) {
  return Math.round(n).toLocaleString('de-DE');
}

export const MENGEN = [0.5, 1, 1.5, 2, 3];

/** 0.5 → „½", 1.5 → „1½" */
export function menge(m) {
  const ganz = Math.floor(m);
  const rest = m - ganz;
  const bruch = rest === 0.5 ? '½' : rest === 0.25 ? '¼' : rest === 0.75 ? '¾' : rest ? String(rest).replace('.', ',') : '';
  if (!ganz) return bruch || '0';
  return `${ganz}${bruch}`;
}

/** kcal eines Eintrags: kcal je Portion mal Menge, gerundet. */
export const kcalVon = (e) => Math.round((e.kcal || 0) * (e.m || 1));
export const khVon = (e) => Math.round((e.kh || 0) * (e.m || 1));

export function summe(eintraege = []) {
  return eintraege.reduce((s, e) => ({ kcal: s.kcal + kcalVon(e), kh: s.kh + khVon(e) }), { kcal: 0, kh: 0 });
}

// --- Suche -----------------------------------------------------------------

/*
 * Zwei Schreibweisen je Text: „döner" → „doener" und „doner". Wer auf dem
 * Handy kein ö findet, tippt eins von beiden; beides soll treffen.
 */
function grund(text) {
  return String(text || '').toLowerCase().replace(/ß/g, 'ss').replace(/[^a-z0-9äöü ]+/g, ' ');
}
export function schreibweisen(text) {
  const g = grund(text);
  const a = g.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue');
  const b = g.replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u');
  return [a, b].map((s) => s.replace(/\s+/g, ' ').trim());
}

const heuhaufen = new WeakMap();
function haufen(l) {
  let h = heuhaufen.get(l);
  if (!h) {
    const [a, b] = schreibweisen(`${l.n} ${l.s || ''}`);
    // Die Suchwörter sind schon ohne Umlaut geschrieben („doener") – auch
    // davon die Fassung mit einfachem Vokal („doner") dazu.
    const c = a.replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u');
    h = { text: ` ${a} ${b} ${c} `, name: schreibweisen(l.n)[0] };
    heuhaufen.set(l, h);
  }
  return h;
}

/**
 * Treffer zur Eingabe, die besten zuerst.
 *
 * Jedes eingegebene Wort muss vorkommen (als Wortanfang oder irgendwo). Vorn
 * steht, wessen Name mit der Eingabe beginnt, dann, was der Nutzer oft isst,
 * dann der Rest in der Reihenfolge der Liste.
 */
export function suche(eingabe, liste, oft = new Map(), grenze = 40) {
  const [qa, qb] = schreibweisen(eingabe);
  if (!qa) return [];
  const woerterA = qa.split(' ');
  const woerterB = qb.split(' ');
  const treffer = [];
  liste.forEach((l, i) => {
    const h = haufen(l);
    const passt = (woerter) => woerter.every((w) => h.text.includes(w));
    if (!passt(woerterA) && !passt(woerterB)) return;
    let punkte = 0;
    if (h.name.startsWith(qa)) punkte += 100;
    else if (h.text.includes(` ${woerterA[0]}`)) punkte += 50;
    punkte += Math.min(40, (oft.get(l.id) || 0) * 4);
    treffer.push({ l, punkte, i });
  });
  treffer.sort((x, y) => y.punkte - x.punkte || x.i - y.i);
  return treffer.slice(0, grenze).map((t) => t.l);
}

/** Wie oft jede Sache eingetragen wurde – für „Oft bei dir". */
export function haeufigkeit(stand) {
  const oft = new Map();
  Object.values(stand.tage || {}).forEach((liste) => liste.forEach((e) => {
    if (e.f) oft.set(e.f, (oft.get(e.f) || 0) + 1);
  }));
  return oft;
}

export function haeufigste(stand, kennt, n = 8) {
  const oft = haeufigkeit(stand);
  return [...oft.entries()]
    .filter(([id]) => kennt(id))
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([id]) => kennt(id));
}

// --- Woche -----------------------------------------------------------------

/** Die letzten sieben Tage bis heute, je Tag kcal und ob Hafertag. */
export function woche(stand, heute) {
  const tage = [];
  for (let i = 6; i >= 0; i--) {
    const tag = plusTage(heute, -i);
    const liste = stand.tage?.[tag] || [];
    tage.push({ tag, kcal: summe(liste).kcal, leer: !liste.length, hafer: istHafertag(stand, tag) });
  }
  return tage;
}

/** Durchschnitt der Tage mit Einträgen (ohne heute, der ist noch nicht vorbei). */
export function schnitt(stand, heute, tage = 7) {
  const werte = [];
  for (let i = 1; i <= tage; i++) {
    const liste = stand.tage?.[plusTage(heute, -i)] || [];
    if (liste.length) werte.push(summe(liste).kcal);
  }
  if (werte.length < 3) return null;
  return { kcal: Math.round(werte.reduce((a, b) => a + b, 0) / werte.length), tage: werte.length };
}

// --- Hafertage -------------------------------------------------------------

/*
 * Nach dem Infoblatt „Intensive Hafertage" der Deutschen Diabetes-Hilfe
 * (diabetesDE, Juni 2017): drei Mahlzeiten, jede aus 75 g Haferflocken in
 * rund 500 ml Wasser oder Gemüsebrühe, zusammen 225 g am Tag.
 */
export const HAFER_JE_MAHLZEIT = 75;
export const HAFER_MAHLZEITEN = [
  { i: 0, n: 'Frühstück', z: 'morgens', f: 'hafer_wasser' },
  { i: 1, n: 'Mittag', z: 'mittags', f: 'hafer_bruehe' },
  { i: 2, n: 'Abend', z: 'abends', f: 'hafer_bruehe' },
];

export const istHafertag = (stand, tag) => (stand.hafer?.tage || []).includes(tag);

/** Welche der drei Hafer-Mahlzeiten an diesem Tag eingetragen sind. */
export function haferGegessen(stand, tag) {
  const da = new Set((stand.tage?.[tag] || []).filter((e) => Number.isInteger(e.h)).map((e) => e.h));
  return HAFER_MAHLZEITEN.map((m) => da.has(m.i));
}

export const haferFertig = (stand, tag) => haferGegessen(stand, tag).every(Boolean);

/** Geplante Hafertage in diesem Monat („2026-11"). */
export function haferImMonat(stand, monat) {
  return (stand.hafer?.tage || []).filter((t) => t.startsWith(monat)).sort();
}

/** Der nächste geplante Hafertag ab heute (heute eingeschlossen) oder null. */
export function naechsterHafertag(stand, heute) {
  return (stand.hafer?.tage || []).filter((t) => t >= heute).sort()[0] || null;
}

/**
 * Stelle im Block: Drei Hafertage am Stück → heute ist Tag 2 von 3.
 * Einzelne Tage geben {nr: 1, von: 1}.
 */
export function haferBlock(stand, tag) {
  const tage = new Set(stand.hafer?.tage || []);
  if (!tage.has(tag)) return null;
  let anfang = tag;
  while (tage.has(plusTage(anfang, -1))) anfang = plusTage(anfang, -1);
  let ende = tag;
  while (tage.has(plusTage(ende, 1))) ende = plusTage(ende, 1);
  return { nr: abstand(anfang, tag) + 1, von: abstand(anfang, ende) + 1 };
}

/*
 * Wie der Arzt die Hafertage meint – die zwei Wege aus dem Infoblatt:
 * „verteilt" (regelmäßig 1, 2 oder 4 Hafertage im Monat) oder „am Stück"
 * (2 oder 3 Tage hintereinander, dann alle paar Monate wieder). Dazu
 * „unklar" (fragt beim nächsten Termin) und „aus". null: noch nicht gefragt.
 */
export const HAFER_ARTEN = ['verteilt', 'amStueck', 'unklar', 'aus'];

/** Zusammenhängende Läufe geplanter Hafertage: [{anfang, ende, laenge}], nach Datum. */
export function haferBloecke(tage) {
  const sortiert = [...new Set(tage)].sort();
  const bloecke = [];
  sortiert.forEach((t) => {
    const letzter = bloecke[bloecke.length - 1];
    if (letzter && plusTage(letzter.ende, 1) === t) {
      letzter.ende = t;
      letzter.laenge++;
    } else bloecke.push({ anfang: t, ende: t, laenge: 1 });
  });
  return bloecke;
}

/** n Tage ab `tag`. */
export function blockAb(tag, n) {
  return Array.from({ length: n }, (_, i) => plusTage(tag, i));
}

/** „2026-11-30" + 3 Monate → „2027-02-28" (der Tag wird am Monatsende gekappt). */
export function plusMonate(tag, n) {
  const [j, m, t] = tag.split('-').map(Number);
  const ziel = new Date(j, m - 1 + n, 1, 12);
  const laenge = new Date(ziel.getFullYear(), ziel.getMonth() + 1, 0, 12).getDate();
  ziel.setDate(Math.min(t, laenge));
  return tagVon(ziel);
}

/**
 * Am Stück: ab wann die nächste Runde dran ist – Beginn der letzten
 * begonnenen Runde plus „alle … Monate". null, wenn es noch keine gab.
 */
export function naechsteRunde(stand, heute) {
  const begonnen = haferBloecke(stand.hafer?.tage || []).filter((b) => b.anfang <= heute);
  if (!begonnen.length) return null;
  return plusMonate(begonnen[begonnen.length - 1].anfang, stand.hafer.alleMonate || 1);
}

/** Was man für diese Hafertage kauft. */
export function haferEinkauf(anzahl) {
  const gramm = anzahl * 3 * HAFER_JE_MAHLZEIT;
  return {
    gramm,
    packungen: Math.ceil(gramm / 500),
    bruehe: anzahl * 1,   // Liter Gemüsebrühe, für zwei herzhafte Mahlzeiten am Tag
  };
}

/** Die Tage eines Monats als Wochen (Montag zuerst), leere Felder als null. */
export function monatsblatt(jahr, monat) {
  const erster = new Date(jahr, monat, 1, 12);
  const versatz = (erster.getDay() + 6) % 7;
  const laenge = new Date(jahr, monat + 1, 0, 12).getDate();
  const felder = Array(versatz).fill(null);
  for (let t = 1; t <= laenge; t++) felder.push(`${jahr}-${zwei(monat + 1)}-${zwei(t)}`);
  while (felder.length % 7) felder.push(null);
  const wochen = [];
  for (let i = 0; i < felder.length; i += 7) wochen.push(felder.slice(i, i + 7));
  return wochen;
}

// --- Kalenderdatei ---------------------------------------------------------

/*
 * Erinnern kann eine App ohne Server nicht, wenn sie geschlossen ist. Der
 * Kalender des Handys kann es: Je Hafertag ein ganztägiger Termin, mit
 * Erinnerung am Abend davor (18 Uhr) – dann ist noch Zeit zum Einkaufen.
 * Feste Kennungen je Tag: Ein zweiter Import ersetzt den Termin, statt ihn
 * zu verdoppeln (bei Kalendern, die das auswerten).
 */
const NL = '\r\n';
const kodierer = new TextEncoder();

function icsText(text) {
  return String(text)
    // eslint-disable-next-line no-control-regex -- Steuerzeichen sind in TEXT verboten (RFC 5545)
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/** Auf 75 Oktette falten, nur zwischen ganzen Zeichen (ü sind zwei Oktette). */
export function falten(zeile) {
  const teile = [];
  let aktuell = '';
  let laenge = 0;
  for (const zeichen of zeile) {
    const n = kodierer.encode(zeichen).length;
    const grenze = teile.length ? 74 : 75;
    if (laenge + n > grenze) {
      teile.push(aktuell);
      aktuell = '';
      laenge = 0;
    }
    aktuell += zeichen;
    laenge += n;
  }
  teile.push(aktuell);
  return teile.map((t, i) => (i ? ` ${t}` : t)).join(NL);
}

const kompakt = (tag) => tag.replace(/-/g, '');

export function haferIcs(tage, jetzt = new Date()) {
  const stempel = `${jetzt.getUTCFullYear()}${zwei(jetzt.getUTCMonth() + 1)}${zwei(jetzt.getUTCDate())}T${zwei(jetzt.getUTCHours())}${zwei(jetzt.getUTCMinutes())}00Z`;
  const zeilen = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Mahlzeit//Hafertage//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  [...tage].sort().forEach((tag) => {
    zeilen.push(
      'BEGIN:VEVENT',
      `UID:hafertag-${kompakt(tag)}@mahlzeit`,
      `DTSTAMP:${stempel}`,
      `DTSTART;VALUE=DATE:${kompakt(tag)}`,
      `DTEND;VALUE=DATE:${kompakt(plusTage(tag, 1))}`,
      `SUMMARY:${icsText('Hafertag 🌾')}`,
      `DESCRIPTION:${icsText('3 Mahlzeiten aus je 75 g Haferflocken in rund 500 ml Wasser oder Gemüsebrühe. Rund 2 Liter trinken, nichts dazwischen.')}`,
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${icsText('Morgen ist Hafertag – Haferflocken und Gemüsebrühe im Haus?')}`,
      'TRIGGER:-PT6H',
      'END:VALARM',
      'END:VEVENT',
    );
  });
  zeilen.push('END:VCALENDAR');
  return zeilen.map(falten).join(NL) + NL;
}

// --- Gerät -----------------------------------------------------------------

/**
 * Welches Handy: davon hängt ab, wie man die App auf den Startbildschirm
 * legt. iPadOS meldet sich als Mac – erkennbar an den Fingern auf dem Glas.
 */
export function geraet(ua = '', finger = 0) {
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && finger > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'andere';
}

/**
 * Die Fassung von Safari aus „Version/26.0" – nicht aus „iPhone OS 18_6":
 * Seit iOS 26 meldet Safari dort mit Absicht eine eingefrorene Zahl. Ohne
 * Version-Angabe ist es kein Safari (Chrome „CriOS", Firefox „FxiOS"): null.
 */
export function safariFassung(ua = '') {
  if (/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)) return null;
  const m = ua.match(/Version\/(\d+)/);
  return m ? Number(m[1]) : null;
}

// --- Werte -----------------------------------------------------------------

export const ZUCKER_WANN = [
  { id: 'nuechtern', n: 'nüchtern' },
  { id: 'vor', n: 'vor dem Essen' },
  { id: 'nach', n: 'nach dem Essen' },
  { id: 'sonst', n: 'sonst' },
];

/**
 * Ein Blutzucker unter 35 ist in mg/dl kaum möglich, in mmol/l dagegen
 * üblich (6,5 mmol/l = 117 mg/dl). Dann fragt die App nach, statt eine
 * falsche Zahl zu speichern.
 */
export function vielleichtMmol(wert) {
  return wert > 0 && wert < 35 ? Math.round(wert * 18.016) : null;
}

/** Zahl aus „82,5" oder „82.5"; sonst NaN. */
export function leseZahl(text) {
  const t = String(text ?? '').trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(t)) return NaN;
  return Number(t);
}

/** Werte einer Art, ältester zuerst. */
export function werteVon(stand, art) {
  return (stand.werte || []).filter((w) => w.art === art).sort((a, b) => (a.tag + (a.uhr || '')).localeCompare(b.tag + (b.uhr || '')));
}

/** Gewicht: erster und letzter Wert, Unterschied. */
export function gewichtVerlauf(stand) {
  const liste = werteVon(stand, 'gewicht');
  if (liste.length < 2) return null;
  const erster = liste[0];
  const letzter = liste[liste.length - 1];
  return { erster, letzter, diff: Math.round((letzter.wert - erster.wert) * 10) / 10 };
}

// --- Stand -----------------------------------------------------------------

export function leererStand() {
  return {
    v: 1,
    tage: {},
    eigene: [],
    ziel: null,
    // Tobi: „Er soll drei mal im Monat nur Hafer essen oder so" – daher 3,
    // für beide Wege. Was gilt, beantwortet der Kollege selbst (art).
    hafer: { art: null, proMonat: 3, amStueck: 3, alleMonate: 1, tage: [] },
    werte: [],
    hinweise: {},
    sicherung: null,
  };
}

/** Einen gelesenen Stand auf die erwartete Form bringen – fehlende Teile ergänzen. */
export function ordnen(roh) {
  const s = leererStand();
  if (!roh || typeof roh !== 'object') return s;
  if (roh.tage && typeof roh.tage === 'object') {
    Object.entries(roh.tage).forEach(([tag, liste]) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(tag) && Array.isArray(liste)) {
        const gut = liste.filter((e) => e && typeof e === 'object' && typeof e.n === 'string' && Number.isFinite(e.kcal));
        if (gut.length) s.tage[tag] = gut;
      }
    });
  }
  if (Array.isArray(roh.eigene)) s.eigene = roh.eigene.filter((e) => e && typeof e.n === 'string' && Number.isFinite(e.kcal));
  if (Number.isFinite(roh.ziel) && roh.ziel > 0) s.ziel = roh.ziel;
  if (roh.hafer && typeof roh.hafer === 'object') {
    if (HAFER_ARTEN.includes(roh.hafer.art)) s.hafer.art = roh.hafer.art;
    else if (roh.hafer.proMonat === 0) s.hafer.art = 'aus';   // v1: „aus" stand als 0 in proMonat
    if (Number.isInteger(roh.hafer.proMonat) && roh.hafer.proMonat >= 1 && roh.hafer.proMonat <= 8) s.hafer.proMonat = roh.hafer.proMonat;
    if ([2, 3].includes(roh.hafer.amStueck)) s.hafer.amStueck = roh.hafer.amStueck;
    if ([1, 2, 3, 4].includes(roh.hafer.alleMonate)) s.hafer.alleMonate = roh.hafer.alleMonate;
    if (Array.isArray(roh.hafer.tage)) s.hafer.tage = [...new Set(roh.hafer.tage.filter((t) => /^\d{4}-\d{2}-\d{2}$/.test(t)))].sort();
  }
  if (Array.isArray(roh.werte)) s.werte = roh.werte.filter((w) => w && ['gewicht', 'zucker', 'hba1c'].includes(w.art) && Number.isFinite(w.wert) && /^\d{4}-\d{2}-\d{2}$/.test(w.tag));
  if (roh.hinweise && typeof roh.hinweise === 'object') s.hinweise = { ...roh.hinweise };
  if (typeof roh.sicherung === 'string') s.sicherung = roh.sicherung;
  return s;
}

/** Eine Sicherungsdatei prüfen. Gibt den Stand zurück oder wirft mit einem lesbaren Grund. */
export function sicherungLesen(text) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new Error('Die Datei ist keine Sicherung dieser App (kein lesbarer Inhalt).');
  }
  if (!obj || obj.app !== 'mahlzeit' || !obj.stand) {
    throw new Error('Die Datei ist keine Sicherung von „Mahlzeit".');
  }
  return ordnen(obj.stand);
}

export function sicherungText(stand, heute) {
  return JSON.stringify({ app: 'mahlzeit', v: 1, am: heute, stand }, null, 1);
}

/** Wie viele Tage mit Einträgen es gibt – für den Hinweis auf die Sicherung. */
export const tageMitEintraegen = (stand) => Object.keys(stand.tage || {}).length;
