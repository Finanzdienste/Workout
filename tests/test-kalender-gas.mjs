/*
 * Das Skript in Tobis Google-Konto (kalender/workout-kalender.gs) – geprüft
 * ohne Google.
 *
 *     „Es soll von selbst einfach das optimale passieren"
 *
 * Von selbst heißt: Tobi richtet es einmal ein, und danach verschiebt es den
 * Kalender jede Stunde, ohne dass jemand zusieht. Was dort schiefgeht, sieht
 * man erst, wenn der Termin fehlt. Laufen kann das Skript nur in Tobis Konto –
 * hier läuft es deshalb in einem nackten V8-Kontext (node:vm, ohne fetch,
 * TextEncoder, setTimeout, Intl), mit Attrappen der Apps-Script-Dienste, die
 * sich so verhalten wie dort, wo es zählt: Skript-Eigenschaften mit 9 KB je
 * Wert und 500 KB insgesamt, Kalender mit Markierungen und Erinnerungen,
 * Auslöser, Sperre, Antworten per ContentService, Datum nur über
 * Utilities.formatDate/parseDate mit Zone. Und mit echten Vorschauen aus
 * vorschauRechnen() (js/kalender-vorschau.js) als Eingabe.
 *
 * Zwei Prozesse: Die Vorschauen rechnet der Kern in Europe/Berlin (wie die App
 * auf Tobis Handy). Das Skript läuft danach in America/Los_Angeles – wie ein
 * Apps-Script-Projekt mit fremder Zeitzone, das trotzdem in Berliner Tagen
 * rechnen muss. Berliner Mitternacht ist dort 15 oder 16 Uhr am Vortag; wer
 * irgendwo die lokale Zeit nimmt, liegt rund um Mitternacht einen Tag daneben.
 *
 *   1. Die Vorlage: Platzhalter statt Kennwort, kein Geheimnis, nichts läuft
 *      beim Laden, „einrichten" steht oben.
 *   2. Die vier Regeln des Vertrags sind dieselben wie im Kern.
 *   3. einrichten() räumt Tobis Probe weg und ist wiederholbar ohne Doppel.
 *   4. doPost: falsches und fehlendes Kennwort, kaputtes JSON, zu groß, alte
 *      Fassung – immer JSON, nie das Kennwort, nichts gespeichert.
 *   5. Der Abgleich über Wochen: anlegen, verschieben (derselbe Termin),
 *      abhaken, verpasste weg, fremde in Ruhe, idempotent; Mitternacht und
 *      Zeitumstellung in Berlin; zwei Geräte; Horizont abgelaufen;
 *      abschalten und wieder an.
 *   6. Leere Einheit, Zusatztag, Rundenende; Google bremst, Zeit um; ein
 *      zweites Projekt; Kalender gelöscht; ohne einrichten; Platzhalter.
 *   7. Speicher: Stücke unter 9 KB, alte weg, Format 1 bleibt lesbar,
 *      Beschädigtes fasst den Kalender nicht an. Sperre.
 */
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HIER = fileURLToPath(import.meta.url);
const GAS = process.argv[2] === '--gas';
if (!GAS && process.env.TZ !== 'Europe/Berlin') {
  const r = spawnSync(process.execPath, [HIER, ...process.argv.slice(2)], {
    stdio: 'inherit', env: { ...process.env, TZ: 'Europe/Berlin' },
  });
  process.exit(r.status === null ? 1 : r.status);
}

const { ROOT, ABLAGE } = await import('./umgebung.mjs');
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };
const zeige = (m) => console.log(`     ${m}`);
const um = (iso) => Date.parse(iso);
const addDays = (iso, k) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + k)).toISOString().slice(0, 10);
};
const V = await import(pathToFileURL(path.join(ROOT, 'js', 'kalender-vorschau.js')).href);
// Kein echtes Kennwort – dasselbe wie in tests/test-kalender-vorschau.mjs.
const TOKEN = 'testtoken-kein-echtes-0123456789';
const DATEI = path.join(ABLAGE, 'kalender-gas-vorschau.json');

/* ------------------------------------------------------------------ *
 * Teil 1, in Europe/Berlin: die Vorschauen, mit dem Kern gerechnet
 * ------------------------------------------------------------------ */

if (!GAS) {
  const basisText = readFileSync(path.join(ROOT, 'tests', 'zusatz-tobi-do.json'), 'utf8');
  const kopie = () => JSON.parse(basisText);
  const satz = (k) => Array.from({ length: k }, () => ({ w: '', done: true }));
  const rechne = (z, jetzt) => V.vorschauRechnen(JSON.stringify(z), { jetzt: um(jetzt) });
  const N = {};
  const nutz = (name, v, geraet, seq, gesendet) => {
    N[name] = V.nutzlastBauen(v, { token: TOKEN, geraet, seq, gesendet: um(gesendet), app: 'v245' });
  };

  // Tobis Stand vom Do 08.10. – die Module laden dabei mit seinem Fokus (Cut).
  nutz('A', await rechne(kopie(), '2026-10-08T12:00:00+02:00'), 'handy-tobi', 1, '2026-10-08T12:00:00+02:00');
  const D = await import(pathToFileURL(path.join(ROOT, 'js', 'data.js')).href);
  const erste = (n) => D.PLAN.find((w) => w.n === n).ex[0].id;
  /** Workout n am Tag `tag` gemacht und abgeschlossen, letzter Satz um `uhr`. */
  const gemacht = (z, n, tag, uhr) => {
    z.log[n] = { mode: 'db', db: { [erste(n)]: satz(3) }, bw: {}, startedOn: tag, done: 'db', zuletzt: um(uhr) };
    return z;
  };
  const zT = gemacht(kopie(), 9, '2026-10-26', '2026-10-26T18:20:00+01:00');
  const zTab = gemacht(gemacht(kopie(), 9, '2026-10-26', '2026-10-26T18:20:00+01:00'), 10, '2026-10-28', '2026-10-28T18:00:00+01:00');
  nutz('T', await rechne(zT, '2026-10-26T19:00:00+01:00'), 'handy-tobi', 2, '2026-10-26T19:00:00+01:00');
  // Das Tablet aus der Schublade: Tobis Stand vom 08.10., einen Tag nach dem Training gesendet.
  nutz('Tablet', await rechne(kopie(), '2026-10-27T08:00:00+01:00'), 'tablet-01', 5, '2026-10-27T08:00:00+01:00');
  // Auf dem Tablet weiter trainiert (Workout 10 am 28.10.) – jetzt hat es zuletzt trainiert.
  nutz('Tab2', await rechne(zTab, '2026-10-28T19:00:00+01:00'), 'tablet-01', 6, '2026-10-28T19:00:00+01:00');
  nutz('HandyAlt', await rechne(zT, '2026-10-29T08:00:00+01:00'), 'handy-tobi', 3, '2026-10-29T08:00:00+01:00');
  nutz('Tab3', await rechne(zTab, '2026-12-10T18:00:00+01:00'), 'tablet-01', 7, '2026-12-10T18:00:00+01:00');
  nutz('Handy5', await rechne(zTab, '2026-12-11T09:00:00+01:00'), 'handy-tobi', 5, '2026-12-11T09:00:00+01:00');

  // Die Fälle der Recherche, die im Kalender etwas löschen oder stehen lassen.
  const F = kopie();
  F.termine = [{ datum: '2026-10-12', name: 'Turnier', schont: 'alles' }];
  nutz('F', await rechne(F, '2026-10-08T12:00:00+02:00'), 'handy-tobi', 1, '2026-10-08T12:00:00+02:00');
  {
    // Ruhetage mit Zusatztag – wie in tests/test-kalender-vorschau.mjs (R).
    const heute = '2026-10-08';
    const tage = { 1: -8, 2: -6, 3: -4, 4: -3 };
    const log = {};
    D.PLAN.slice(0, 4).forEach((w) => {
      const e = { mode: 'db', done: 'db', db: {}, bw: {}, startedOn: addDays(heute, tage[w.n]) };
      w.ex.slice(0, Math.max(1, w.ex.length - 2)).forEach((it) => {
        e.db[it.id] = Array.from({ length: it.sets }, () => ({ w: '20', r: '', done: true }));
      });
      log[w.n] = e;
    });
    const zwischen = (a, b) => (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000;
    const R = { greeted: true, name: 'T', level: 'geuebt', focus: 'cut', shift: zwischen(D.PLAN[4].date, addDays(heute, 3)), log };
    nutz('R', await rechne(R, '2026-10-08T12:00:00+02:00'), 'handy-tobi', 1, '2026-10-08T12:00:00+02:00');
  }
  {
    // Rundenende: Workout 1–83 erledigt, 84 am Fr 23.10. angefangen und liegen gelassen (E2).
    const z = kopie();
    z.customs = [];
    z.log = {};
    z.shift = 0;
    const start = um('2026-04-01T12:00:00+02:00');
    D.PLAN.forEach((w, i) => {
      const tag = new Date(start + i * 2 * 86400000).toISOString().slice(0, 10);
      z.log[w.n] = { mode: 'db', db: { [w.ex[0].id]: satz(1) }, bw: {}, done: 'db', startedOn: tag };
    });
    const w = D.PLAN[D.PLAN.length - 1];
    z.log[w.n] = {
      mode: 'db', db: { [w.ex[0].id]: satz(1), [w.ex[1].id]: satz(1) }, bw: {}, startedOn: '2026-10-23', zuletzt: um('2026-10-23T18:30:00+02:00'),
    };
    nutz('E2', await rechne(z, '2026-10-23T19:00:00+02:00'), 'handy-tobi', 1, '2026-10-23T19:00:00+02:00');
  }
  {
    // Fast 64 KiB, mit Umlauten und einem Zeichen außerhalb der BMP: zerteilt das Skript richtig?
    const g = JSON.parse(JSON.stringify(N.A));
    g.seq = 3;
    for (let i = 0; V.nutzlastBytes(g) < 60 * 1024; i++) {
      g.texte[`zz${i}`] = [`Übung ${i} · Sätze ✓ 💪`, 'Kniebeuge – Satz für Satz, Grüße aus dem Keller 💪 '.repeat(30)];
    }
    N.Gross = g;
  }

  const groessen = Object.entries(N).map(([k, n]) => `${k} ${(V.nutzlastBytes(n) / 1024).toFixed(1)}`);
  zeige(`Nutzlasten (KiB): ${groessen.join(', ')}`);
  check(Object.values(N).every((n) => V.nutzlastPruefen(n) === null), `alle ${Object.keys(N).length} Sendungen bestehen nutzlastPruefen() des Kerns`);
  check(N.Tablet.stand.zuletzt < N.T.stand.zuletzt && N.Tab2.stand.zuletzt > N.T.stand.zuletzt,
    'Trainingsstände: Tablet aus der Schublade hinter dem Handy, nach Workout 10 davor');
  writeFileSync(DATEI, JSON.stringify(N));
  const r = spawnSync(process.execPath, [HIER, '--gas', DATEI], { stdio: 'inherit', env: { ...process.env, TZ: 'America/Los_Angeles' } });
  process.exit(fails || r.status !== 0 ? 1 : 0);
}

/* ------------------------------------------------------------------ *
 * Teil 2, in America/Los_Angeles: die Attrappen
 * ------------------------------------------------------------------ */

const N = JSON.parse(readFileSync(process.argv[3], 'utf8'));
const VORLAGE = readFileSync(path.join(ROOT, 'kalender', 'workout-kalender.gs'), 'utf8');
const PLATZHALTER = '<<KENNWORT-AUS-DER-APP>>';
// So setzt die App das Kennwort beim „Code kopieren" ein.
const CODE = VORLAGE.replace(PLATZHALTER, TOKEN);
const BERLIN = 'Europe/Berlin';

check(new Date(2026, 9, 26, 12).getTimezoneOffset() === 420,
  'das Skript läuft in America/Los_Angeles – Berliner Mitternacht ist hier der Nachmittag davor');

/** Datum und Uhrzeit eines Zeitpunkts in einer Zone, über Intl – nur in den Attrappen. */
const teile = (ms, tz) => Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
  timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
}).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));

/** Utilities.formatDate: nur die Muster, die das Skript braucht – „YYYY" (Wochenjahr) wirft. */
function formatDate(d, tz, fmt) {
  if (!d || typeof d.getTime !== 'function' || !Number.isFinite(d.getTime())) throw new Error('formatDate: kein gültiges Datum');
  if (typeof tz !== 'string' || !tz) throw new Error('formatDate: ohne Zeitzone');
  const p = teile(d.getTime(), tz);
  return fmt.replace(/[A-Za-z]+/g, (t) => {
    const w = { yyyy: p.year, MM: p.month, dd: p.day, HH: p.hour, mm: p.minute, ss: p.second }[t];
    if (w === undefined) throw new Error(`formatDate: Muster „${t}" kennt die Attrappe nicht`);
    return w;
  });
}

/** Utilities.parseDate: „yyyy-MM-dd HH:mm" als Wanduhrzeit in der Zone. */
function parseDate(s, tz, fmt) {
  if (fmt !== 'yyyy-MM-dd HH:mm') throw new Error(`parseDate: Format „${fmt}" kennt die Attrappe nicht`);
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(s);
  if (!m || typeof tz !== 'string' || !tz) throw new Error(`parseDate: „${s}" passt nicht`);
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const wand = Date.UTC(y, mo - 1, d, h, mi);
  const versatz = (ms) => {
    const p = teile(ms, tz);
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - ms;
  };
  return new Date(wand - versatz(wand - versatz(wand)));
}

check(parseDate('2026-10-09 17:30', BERLIN, 'yyyy-MM-dd HH:mm').toISOString() === '2026-10-09T15:30:00.000Z'
  && parseDate('2026-10-26 17:30', BERLIN, 'yyyy-MM-dd HH:mm').toISOString() === '2026-10-26T16:30:00.000Z'
  && formatDate(new Date('2026-10-25T22:30:00Z'), BERLIN, 'yyyy-MM-dd HH:mm') === '2026-10-25 23:30',
'die Attrappe von Utilities rechnet Berliner Zeit über die Zeitumstellung (17:30 = 15:30Z im Oktober, 16:30Z ab dem 25.)');

const DROSSEL = 'Service invoked too many times in a short time: calendar. Try Utilities.sleep(1000) between calls.';

/** Ein Google-Konto: Kalender, Uhr, Zähler. */
class Welt {
  constructor(jetzt) {
    Object.assign(this, {
      jetzt: um(jetzt), kalender: [], nr: 0, lesen: 0, schreiben: 0, terminSchreiben: 0,
      drossel: null, proSchreiben: 0, neueErinnerung: [10],
    });
    this.haupt = new Kal(this, 'Tobi', { zone: BERLIN });
    this.CalendarApp = {
      createCalendar: (name, o = {}) => {
        this.schreib();
        return new Kal(this, String(name), { zone: o.timeZone || 'America/Los_Angeles' });
      },
      getCalendarById: (id) => { this.lies(); return this.kalender.find((k) => !k.weg && k.id === id) || null; },
      getOwnedCalendarsByName: (name) => {
        this.lies();
        return this.kalender.filter((k) => !k.weg && k.eigen && k.name.toLowerCase() === String(name).toLowerCase());
      },
      getAllOwnedCalendars: () => { this.lies(); return this.kalender.filter((k) => !k.weg && k.eigen); },
      getDefaultCalendar: () => this.haupt,
    };
  }

  /** Ein Schreibzugriff: Google bremst ab einer Zahl, und jeder kostet Zeit. */
  schreib(termin = null) {
    if (this.drossel !== null) {
      if (this.drossel <= 0) throw new Error(DROSSEL);
      this.drossel -= 1;
    }
    this.schreiben += 1;
    this.jetzt += this.proSchreiben;
    if (termin) { this.terminSchreiben += 1; termin.schreibzugriffe += 1; }
  }

  lies() { this.lesen += 1; }

  alle() { return this.kalender.flatMap((k) => k.termine); }

  heisst(name) { return this.kalender.filter((k) => !k.weg && k.name === name); }
}

class Kal {
  constructor(welt, name, { zone = 'America/Los_Angeles', eigen = true } = {}) {
    Object.assign(this, { welt, name, zone, eigen, id: `kal${++welt.nr}@group.calendar.google.com`, beschreibung: '', termine: [], weg: false });
    welt.kalender.push(this);
  }

  lebt() { if (this.weg) throw new Error('Kalender wurde gelöscht'); }

  getId() { this.lebt(); return this.id; }

  getName() { this.lebt(); return this.name; }

  getTimeZone() { this.lebt(); return this.zone; }

  isOwnedByMe() { this.lebt(); return this.eigen; }

  getDescription() { this.lebt(); this.welt.lies(); return this.beschreibung; }

  setDescription(t) { this.lebt(); this.welt.schreib(); this.beschreibung = String(t); return this; }

  deleteCalendar() { this.lebt(); if (!this.eigen) throw new Error('nicht eigener Kalender'); this.welt.schreib(); this.weg = true; }

  getEvents(a, b) {
    this.lebt();
    this.welt.lies();
    return this.termine.filter((t) => !t.weg && t.beginn < b.getTime() && t.ende > a.getTime()).sort((x, y) => x.beginn - y.beginn);
  }

  getEventById(id) { this.lebt(); this.welt.lies(); return this.termine.find((t) => !t.weg && t.id === id) || null; }

  createEvent(titel, a, b, o = {}) {
    this.lebt();
    if (!this.eigen) throw new Error('nicht eigener Kalender');
    if (!(a.getTime() < b.getTime())) throw new Error('Das Ende liegt vor dem Beginn.');
    this.welt.schreib();
    this.welt.terminSchreiben += 1;
    const t = new Termin(this, titel, a.getTime(), b.getTime(), (o && o.description) || '');
    this.termine.push(t);
    return t;
  }
}

class Termin {
  constructor(kal, titel, beginn, ende, beschreibung) {
    Object.assign(this, {
      kal, welt: kal.welt, id: `ev${++kal.welt.nr}@google.com`, titel: String(titel), beginn, ende, beschreibung: String(beschreibung),
      tags: {}, popup: [...kal.welt.neueErinnerung], email: [], weg: false, schreibzugriffe: 0,
    });
  }

  lebt() { if (this.weg) throw new Error('Das Ereignis wurde gelöscht.'); }

  w() { this.lebt(); this.welt.schreib(this); }

  r() { this.lebt(); this.welt.lies(); }

  getId() { this.lebt(); return this.id; }

  getTitle() { this.r(); return this.titel; }

  setTitle(t) { this.w(); this.titel = String(t); return this; }

  getDescription() { this.r(); return this.beschreibung; }

  setDescription(t) { this.w(); this.beschreibung = String(t); return this; }

  getStartTime() { this.r(); return new Date(this.beginn); }

  getEndTime() { this.r(); return new Date(this.ende); }

  setTime(a, b) {
    if (!(a.getTime() < b.getTime())) throw new Error('Das Ende liegt vor dem Beginn.');
    this.w();
    this.beginn = a.getTime();
    this.ende = b.getTime();
    return this;
  }

  getTag(k) { this.r(); return Object.prototype.hasOwnProperty.call(this.tags, k) ? this.tags[k] : null; }

  setTag(k, v) { this.w(); this.tags[String(k)] = String(v); return this; }

  deleteTag(k) { this.w(); delete this.tags[k]; return this; }

  getAllTagKeys() { this.r(); return Object.keys(this.tags); }

  getPopupReminders() { this.r(); return [...this.popup]; }

  getEmailReminders() { this.r(); return [...this.email]; }

  addPopupReminder(m) {
    if (!Number.isInteger(m) || m < 0 || m > 40320) throw new Error('Ungültige Erinnerung');
    this.w();
    this.popup.push(m);
    return this;
  }

  removeAllReminders() { this.w(); this.popup = []; this.email = []; return this; }

  deleteEvent() { this.w(); this.weg = true; }

  isAllDayEvent() { this.r(); return false; }
}

/** Ein Termin, den nicht das Skript angelegt hat (von Hand, eingelesen, ein anderes Werkzeug). */
const fremd = (kal, titel, iso, min, tags = {}) => {
  const t = new Termin(kal, titel, um(iso), um(iso) + min * 60000, 'von Hand');
  t.tags = { ...tags };
  t.popup = [10];
  kal.termine.push(t);
  return t;
};

const GRENZE_WERT = 9000; // „9 KB je Wert" – streng gelesen
const GRENZE_GESAMT = 500 * 1000;
const bytes = (s) => Buffer.byteLength(s, 'utf8');

const ContentService = {
  MimeType: { JSON: 'JSON', TEXT: 'TEXT' },
  createTextOutput: (s) => {
    const o = { inhalt: String(s), typ: 'TEXT' };
    o.setMimeType = (t) => { o.typ = t; return o; };
    o.getContent = () => o.inhalt;
    o.getMimeType = () => o.typ;
    return o;
  },
};

let ausloeserNr = 0;
const ausloeser = (fn, art, wert) => {
  const id = `ausl${++ausloeserNr}`;
  return { fn, art, wert, getHandlerFunction: () => fn, getUniqueId: () => id, getEventType: () => 'CLOCK' };
};

/** Ein Apps-Script-Projekt in der Welt: eigener Speicher, eigene Auslöser, eigene Sperre – derselbe Kalender. */
function projekt(welt, code = CODE) {
  const p = { props: new Map(), ausloeser: [], belegt: false, protokoll: [], id: `skript${++welt.nr}`, scopes: 0, maxWert: 0 };
  const store = {};
  const setzen = (k, v) => {
    const key = String(k);
    const wert = String(v);
    if (bytes(wert) > GRENZE_WERT) throw new Error(`Argument too large: value (${bytes(wert)} Byte)`);
    const vorher = p.props.get(key);
    p.props.set(key, wert);
    if ([...p.props].reduce((s, [a, b]) => s + bytes(a) + bytes(b), 0) > GRENZE_GESAMT) {
      if (vorher === undefined) p.props.delete(key); else p.props.set(key, vorher);
      throw new Error('Der Speicher der Skript-Eigenschaften ist voll (500 KB).');
    }
    p.maxWert = Math.max(p.maxWert, bytes(wert));
  };
  Object.assign(store, {
    getProperty: (k) => (p.props.has(String(k)) ? p.props.get(String(k)) : null),
    setProperty: (k, v) => { setzen(k, v); return store; },
    setProperties: (o, alleAnderen) => { if (alleAnderen) p.props.clear(); Object.entries(o).forEach(([k, v]) => setzen(k, v)); return store; },
    getProperties: () => Object.fromEntries(p.props),
    getKeys: () => [...p.props.keys()],
    deleteProperty: (k) => { p.props.delete(String(k)); return store; },
    deleteAllProperties: () => { p.props.clear(); return store; },
  });
  const ScriptApp = {
    AuthMode: { FULL: 'FULL' },
    EventType: { CLOCK: 'CLOCK' },
    requireAllScopes: () => { p.scopes += 1; },
    getScriptId: () => p.id,
    getProjectTriggers: () => p.ausloeser.slice(),
    deleteTrigger: (t) => {
      const i = p.ausloeser.indexOf(t);
      if (i < 0) throw new Error('unbekannter Auslöser');
      p.ausloeser.splice(i, 1);
    },
    newTrigger: (fn) => ({
      timeBased: () => {
        const b = { fn, art: null, wert: null };
        b.everyHours = (n) => {
          if (![1, 2, 4, 6, 8, 12].includes(n)) throw new Error('everyHours: 1, 2, 4, 6, 8 oder 12');
          Object.assign(b, { art: 'stunden', wert: n });
          return b;
        };
        b.after = (ms) => { Object.assign(b, { art: 'nach', wert: ms }); return b; };
        b.create = () => {
          if (!b.art) throw new Error('Auslöser ohne Zeitplan');
          if (p.ausloeser.length >= 20) throw new Error('zu viele Auslöser');
          const t = ausloeser(b.fn, b.art, b.wert);
          p.ausloeser.push(t);
          return t;
        };
        return b;
      },
    }),
  };
  const LockService = {
    getScriptLock: () => {
      let halte = false;
      const lock = {
        tryLock: () => { if (p.belegt) return false; p.belegt = true; halte = true; return true; },
        waitLock: (ms) => { if (!lock.tryLock(ms)) throw new Error('Sperre nicht bekommen'); },
        releaseLock: () => { if (halte) { p.belegt = false; halte = false; } },
        hasLock: () => halte,
      };
      return lock;
    },
  };
  const Utilities = {
    formatDate, parseDate,
    sleep: (ms) => { welt.jetzt += ms; },
    getUuid: () => randomUUID(),
    Charset: { UTF_8: 'UTF-8' },
  };
  const konsole = { log: (...a) => p.protokoll.push(a.map(String).join(' ')) };
  konsole.info = konsole.log;
  konsole.warn = konsole.log;
  konsole.error = konsole.log;
  const ctx = vm.createContext({
    CalendarApp: welt.CalendarApp, Utilities, PropertiesService: { getScriptProperties: () => store }, LockService, ContentService, ScriptApp,
    Session: { getScriptTimeZone: () => 'America/Los_Angeles' }, console: konsole, __uhr: () => welt.jetzt,
  });
  // Wie Apps Script: kein Intl, und `new Date()` ist die Uhr der Welt.
  vm.runInContext(`delete globalThis.Intl;
    (() => { const E = Date; const uhr = globalThis.__uhr; delete globalThis.__uhr;
      globalThis.Date = class extends E { constructor(...a) { if (a.length) super(...a); else super(uhr()); } static now() { return uhr(); } }; })();`, ctx);
  const vorher = welt.lesen + welt.schreiben;
  vm.runInContext(code, ctx, { filename: 'Code.gs' });
  p.beimLaden = welt.lesen + welt.schreiben - vorher;
  p.g = ctx;
  p.lauf = (s) => vm.runInContext(s, ctx);
  return p;
}

const alleAntworten = [];
/** Ein POST wie aus der App: text/plain, der Body als Text. */
const post = (p, body) => {
  const out = p.g.doPost({ postData: { contents: typeof body === 'string' ? body : JSON.stringify(body), type: 'text/plain' }, parameter: {} });
  const roh = out.getContent();
  alleAntworten.push(roh);
  let a = null;
  try { a = JSON.parse(roh); } catch { a = null; }
  return { a: a || {}, json: !!a, typ: out.getMimeType(), roh };
};
const probe = (p, geraet = 'handy-tobi') => post(p, { v: 1, token: TOKEN, geraet, seq: 99, gesendet: 1, probe: true }).a;
/** Der stündliche Auslöser feuert – über den Namen, den er trägt. */
const feuern = (p, jetzt) => {
  p.welt.jetzt = um(jetzt);
  const t = p.ausloeser.filter((x) => x.art === 'stunden');
  if (t.length !== 1) throw new Error(`${t.length} stündliche Auslöser`);
  return p.g[t[0].fn]();
};
const kennungOk = (k) => typeof k === 'string' && V.KENNUNG_MUSTER.test(k);
const eigene = (kal) => kal.termine.filter((t) => !t.weg && t.tags.workoutSkript && kennungOk(t.tags.workout));
const hinweise = (kal) => kal.termine.filter((t) => !t.weg && t.tags.workoutSkript && t.tags.workoutHinweis);
const tagB = (ms) => formatDate(new Date(ms), BERLIN, 'yyyy-MM-dd');
const uhrB = (ms) => formatDate(new Date(ms), BERLIN, 'HH:mm');
const berlin = (tag, minuten) => parseDate(`${tag} ${String(Math.floor(minuten / 60)).padStart(2, '0')}:${String(minuten % 60).padStart(2, '0')}`, BERLIN, 'yyyy-MM-dd HH:mm').getTime();
const workout = (welt) => {
  const k = welt.heisst('Workout');
  if (k.length !== 1) throw new Error(`${k.length} Kalender „Workout"`);
  return k[0];
};

/**
 * Zeigt der Kalender genau die Liste dieses Tages? '' oder die erste
 * Abweichung. Je Eintrag genau ein eigener Termin mit Beginn (Berlin), Ende,
 * Titel („✓ " bei fertig), Beschreibung und Erinnerung nur an offenen; kein
 * eigener doppelt; und was im Fenster ohne Eintrag steht, darf nur stehen,
 * wenn bleibtStehen() des Kerns es sagt.
 */
function abweichung(kal, n, tag) {
  const liste = n.tage[tag];
  if (!liste) return `keine Liste für ${tag}`;
  const nach = {};
  eigene(kal).forEach((t) => { (nach[t.tags.workout] = nach[t.tags.workout] || []).push(t); });
  for (const [k, ts] of Object.entries(nach)) if (ts.length > 1) return `${k} ${ts.length}× im Kalender`;
  for (const [kennung, datum, dauer, h, fertig] of liste) {
    const t = (nach[kennung] || [])[0];
    if (!t) return `${kennung} fehlt`;
    const beginn = berlin(datum, n.minuten);
    const popup = fertig || !n.erinnerung ? [] : [n.erinnerung];
    const titel = (fertig ? '✓ ' : '') + n.texte[h][0];
    if (t.beginn !== beginn || t.ende !== beginn + dauer * 60000) return `${kennung}: ${tagB(t.beginn)} ${uhrB(t.beginn)} statt ${datum} (${dauer} min)`;
    if (t.titel !== titel) return `${kennung}: Titel „${t.titel}" statt „${titel}"`;
    if (t.beschreibung !== n.texte[h][1]) return `${kennung}: Beschreibung`;
    if (JSON.stringify([...t.popup].sort()) !== JSON.stringify(popup) || t.email.length) return `${kennung}: Erinnerung ${JSON.stringify(t.popup)} statt ${JSON.stringify(popup)}`;
  }
  const drin = new Set(liste.map((e) => e[0]));
  const von = addDays(tag, -n.fenster[0]);
  const bis = addDays(tag, n.fenster[1]);
  for (const t of eigene(kal)) {
    const d = tagB(t.beginn);
    if (drin.has(t.tags.workout) || d < von || d > bis) continue;
    if (!V.bleibtStehen({ kennung: t.tags.workout, datum: d }, liste, tag)) return `${t.tags.workout}@${d} hätte weg müssen`;
  }
  return '';
}
/** Die ersten Termine ab einem Tag, kurz: kennung@MM-TT. */
const kurz = (kal, ab, k = 4) => eigene(kal).filter((t) => tagB(t.beginn) >= ab).sort((a, b) => a.beginn - b.beginn)
  .slice(0, k).map((t) => `${t.tags.workout}@${tagB(t.beginn).slice(5)}`).join(' ');
/** Alles, was nicht vom Skript ist – samt Zahl der Schreibzugriffe darauf. */
const fremdBild = (welt) => JSON.stringify(welt.alle().filter((t) => !t.tags.workoutSkript).map((t) => ({
  id: t.id, kal: t.kal.name, titel: t.titel, beginn: t.beginn, ende: t.ende, beschreibung: t.beschreibung, popup: t.popup, tags: t.tags, weg: t.weg, s: t.schreibzugriffe,
})));
const bildEigene = (kal) => JSON.stringify(eigene(kal).map((t) => [t.id, t.tags.workout, t.beginn, t.ende, t.titel, t.popup]));
const ohneToken = (n) => { const x = JSON.parse(JSON.stringify(n)); delete x.token; return x; };
const kanon = (x) => (Array.isArray(x) ? x.map(kanon) : x && typeof x === 'object'
  ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, kanon(x[k])])) : x);
const gleich = (a, b) => JSON.stringify(kanon(a)) === JSON.stringify(kanon(b));
const mitWelt = (welt, code) => { const p = projekt(welt, code); p.welt = welt; return p; };

/* ------------------------------------------------------------------ *
 * 1. Die Vorlage
 * ------------------------------------------------------------------ */

check(VORLAGE.split(PLATZHALTER).length === 2 && /^const TOKEN = '<<KENNWORT-AUS-DER-APP>>';$/m.test(VORLAGE),
  `Vorlage: der Platzhalter ${PLATZHALTER} genau einmal, in der Zeile const TOKEN = '…';`);
check(!/^[A-Za-z0-9_-]{16,128}$/.test(PLATZHALTER), 'der Platzhalter selbst ist kein gültiges Kennwort – unersetzt nimmt das Skript nichts an');
check(!/[\w.+-]+@[\w-]+\.[\w.-]+/.test(VORLAGE) && !/https?:\/\//.test(VORLAGE) && !/sb_publishable|eyJ[A-Za-z0-9]/.test(VORLAGE),
  'Vorlage: keine E-Mail-Adresse, keine Adresse, kein Schlüssel');
{
  const fassung = /^const FASSUNG = (\d+);$/m.exec(VORLAGE);
  check(fassung && Number(fassung[1]) >= 1, `Vorlage: die Fassung steht lesbar für die App da (const FASSUNG = ${fassung && fassung[1]};)`);
  const funktionen = [...VORLAGE.matchAll(/^function (\w+)\(/gm)].map((m) => m[1]);
  const oeffentlich = funktionen.filter((f) => !f.endsWith('_'));
  check(funktionen[0] === 'einrichten', 'Vorlage: „einrichten" ist die erste Funktion – im Editor ist sie damit schon ausgewählt');
  check(gleich(oeffentlich.sort(), ['abgleichen', 'doGet', 'doPost', 'einrichten', 'stuendlich']),
    `Vorlage: oben auswählbar nur ${oeffentlich.join(', ')} – alles andere endet auf _`);
}
{
  const welt = new Welt('2026-10-08T10:00:00+02:00');
  const p = mitWelt(welt);
  check(p.beimLaden === 0 && p.props.size === 0 && p.ausloeser.length === 0, 'beim Laden ruft das Skript keinen Dienst auf (Apps Script lädt es bei jedem Lauf neu)');
  const fehlt = ['Intl', 'TextEncoder', 'fetch', 'setTimeout', 'Buffer', 'process', 'require'].filter((g) => p.lauf(`typeof ${g}`) !== 'undefined');
  check(!fehlt.length, `der Kontext hat kein ${['Intl', 'TextEncoder', 'fetch', 'setTimeout', 'Buffer', 'process'].join(', ')}${fehlt.length ? ` – doch: ${fehlt}` : ''}`);
  check(p.lauf('KENNUNG_MUSTER.source') === V.KENNUNG_MUSTER.source && p.lauf('VORSCHAU_MAX_BYTES') === V.VORSCHAU_MAX_BYTES
    && p.lauf('VORSCHAU_V') === V.VORSCHAU_V, 'Kennung, Größengrenze und Fassung des Vertrags wie im Kern');

  /* -------------------------------------------------------------- *
   * 2. Die vier Regeln = Kern
   * -------------------------------------------------------------- */
  const g = p.g;
  const n = N.A;
  const tag = n.ab;
  const mut = (f) => { const k = JSON.parse(JSON.stringify(n)); f(k); return k; };
  const faelle = [
    ...Object.values(N), null, [], 'text', { ...n, v: 2 }, { ...n, token: 'kurz' }, { ...n, token: 'mit leerzeichen 0123456789' },
    { ...n, geraet: 'ab' }, { ...n, seq: -1 }, { ...n, seq: 1.5 }, { ...n, gesendet: 0 }, { ...n, minuten: 1440 }, { ...n, erinnerung: 1441 },
    { ...n, ab: 'heute' }, { ...n, fenster: [7] }, { ...n, fenster: [7, 61] }, { ...n, stand: null }, { ...n, stand: { ...n.stand, saetze: -1 } },
    { ...n, texte: [] }, mut((k) => { k.texte['ÄÖ'] = ['a', 'b']; }), mut((k) => { k.texte.x1 = ['t'.repeat(201), '']; }),
    mut((k) => { k.texte.x1 = ['t', 'b'.repeat(4001)]; }), mut((k) => { k.tage = {}; }), mut((k) => { k.tage.heute = []; }),
    mut((k) => { k.tage[tag][0][0] = 'Workout 9'; }), mut((k) => { k.tage[tag][0][3] = 'constructor'; }), mut((k) => { k.tage[tag][0][4] = true; }),
    mut((k) => { k.tage[tag][0][2] = 601; }), mut((k) => { k.tage[tag][0].pop(); }), mut((k) => { k.tage[tag][0][1] = '8.10.2026'; }),
    mut((k) => { for (let i = 0; i < 61; i++) k.tage[addDays('2027-01-01', i)] = []; }),
    mut((k) => { for (let i = 0; i < 70; i++) k.texte[`gross${i}`] = ['x', 'ü'.repeat(1000)]; }),
    { v: 1, token: TOKEN, geraet: 'handy-tobi', seq: 1, gesendet: 1, probe: true }, { v: 1, token: TOKEN, geraet: 'handy-tobi', seq: 1, gesendet: 1, aus: true },
  ];
  const anders = faelle.filter((x) => V.nutzlastPruefen(x) !== g.nutzlastPruefen_(x));
  const gruende = new Set(faelle.map((x) => V.nutzlastPruefen(x)));
  check(!anders.length, `nutzlastPruefen_() = Kern in ${faelle.length} Fällen (${[...gruende].map(String).join(', ')})`);
  const s = (geraet, seq, gesendet, stand) => ({ geraet, seq, gesendet, stand });
  const handy = s('handy', 10, 1000, { einheiten: 9, saetze: 120, zuletzt: 500 });
  const paare = [
    [null, handy], [handy, { ...handy }], [handy, s('handy', 11, 1100, handy.stand)], [handy, s('handy', 9, 900, handy.stand)],
    [handy, s('handy', 0, 2000, { einheiten: 5, saetze: 60, zuletzt: 100 })], [handy, s('tablet', 3, 5000, { einheiten: 9, saetze: 120, zuletzt: 400 })],
    [handy, s('tablet', 3, 5, { einheiten: 9, saetze: 120, zuletzt: 600 })], [handy, s('tablet', 3, 5, { ...handy.stand })],
    [handy, s('tablet', 3, 5, { einheiten: 9, saetze: 119, zuletzt: 500 })], [handy, s('tablet', 3, 5, null)], [s('a', 1, 1, null), handy],
    [N.T, N.Tablet], [N.Tablet, N.T], [N.T, N.Tab2], [N.Tab2, N.HandyAlt], [N.A, N.A], [N.T, N.A],
  ];
  check(paare.every(([a, b]) => V.sendungVergleichen(a, b) === g.sendungVergleichen_(a, b)),
    `sendungVergleichen_() = Kern in ${paare.length} Fällen (${[...new Set(paare.map(([a, b]) => V.sendungVergleichen(a, b)))].join(', ')})`);
  const heuteListe = ['2026-10-01', n.ab, '2026-10-25', '2026-10-26', '2026-11-18', '2026-11-19', '2027-02-01'];
  check(heuteListe.every((h) => JSON.stringify(V.vorschauFuer(n.tage, h)) === JSON.stringify(g.vorschauFuer_(n.tage, h))),
    'vorschauFuer_() = Kern: vor dem ersten Tag, am ersten, über die Zeitumstellung, am letzten, danach (aufgebraucht)');
  const listeE = N.E2.tage['2026-10-24'];
  const stehen = [
    [{ kennung: 'cut-1-84', datum: '2026-10-23' }, listeE, '2026-10-24'], [{ kennung: 'cut-2-1', datum: '2026-10-23' }, listeE, '2026-10-24'],
    [{ kennung: 'cut-1-9', datum: '2026-10-12' }, N.F.tage['2026-10-12'], '2026-10-12'], [{ kennung: 'cut-1-z1', datum: '2026-10-10' }, N.R.tage['2026-10-11'], '2026-10-11'],
    [{ kennung: 'aufbau-1-3', datum: '2026-10-01' }, n.tage[tag], tag], [{ kennung: 'cut-1-3', datum: '2026-10-30' }, n.tage[tag], tag], [{ kennung: 'cut-1-3', datum: '2026-10-01' }, [], tag],
  ];
  check(stehen.every(([t, l, h]) => V.bleibtStehen(t, l, h) === g.bleibtStehen_(t, l, h)),
    `bleibtStehen_() = Kern in ${stehen.length} Fällen (Rundenende, leere Einheit, Zusatztag, anderer Fokus, Zukunft)`);
  const texte = ['', 'abc', 'Übung · Sätze ✓', '💪 Grüße', 'a\ud800b', JSON.stringify(N.Gross)];
  check(texte.every((t) => g.utf8Bytes_(t) === bytes(t)), 'utf8Bytes_() zählt wie UTF-8 (Umlaute, ·, ✓, 💪, ein einzelnes Surrogat)');
  const st = g.teilen_(JSON.stringify(N.Gross), 8000);
  check(st.join('') === JSON.stringify(N.Gross) && st.every((x) => bytes(x) <= 8000) && st.every((x) => !/[\ud800-\udbff]$/.test(x)),
    `teilen_(): ${st.length} Stücke ≤ 8000 Byte, zusammen wieder dasselbe, kein Zeichen zerteilt`);
  check(g.gleich_(TOKEN, TOKEN) && !g.gleich_(TOKEN, `${TOKEN}x`) && !g.gleich_(TOKEN, TOKEN.slice(0, -1)) && !g.gleich_('', TOKEN) && !g.gleich_(TOKEN.replace(/.$/, 'X'), TOKEN),
    'das Kennwort-Vergleichen: gleich, länger, kürzer, leer, ein Zeichen anders');
}

/* ------------------------------------------------------------------ *
 * 3. Einrichten mit Tobis Probe
 * ------------------------------------------------------------------ */

const welt = new Welt('2026-10-08T10:00:00+02:00');
fremd(welt.haupt, 'Zahnarzt', '2026-10-09T10:00:00+02:00', 60);
// Früher aus der Kalenderdatei eingelesen: dieselbe Einheit, aber ohne Markierung.
fremd(welt.haupt, 'Workout 9 · 6 Übungen · 17 Sätze', '2026-10-08T18:00:00+02:00', 65);
const urlaub = new Kal(welt, 'Urlaub');
fremd(urlaub, 'Mallorca', '2026-10-20T00:00:00+02:00', 24 * 60);
new Kal(welt, 'Feiertage in Deutschland', { eigen: false });
const probeKal = new Kal(welt, 'Workout-Probe', { zone: BERLIN });
fremd(probeKal, 'Probe', '2026-10-26T17:30:00+01:00', 30);
new Kal(welt, 'Workout-Probe', { zone: BERLIN }); // die Probe zweimal ausgeführt
const p1 = mitWelt(welt);
p1.props.set('kal', probeKal.id);
p1.ausloeser.push(ausloeser('stuendlich', 'stunden', 1));
const probeAusloeser = p1.ausloeser[0];

let text = p1.g.einrichten();
{
  check(!welt.heisst('Workout-Probe').length && !p1.props.has('kal'), 'einrichten: beide Kalender „Workout-Probe" gelöscht, die Eigenschaft „kal" entfernt');
  check(welt.heisst('Urlaub').length === 1 && welt.heisst('Tobi').length === 1 && welt.heisst('Feiertage in Deutschland').length === 1,
    'einrichten: Hauptkalender, „Urlaub" und ein abonnierter Kalender bleiben');
  check(p1.ausloeser.length === 1 && p1.ausloeser[0] !== probeAusloeser && p1.ausloeser[0].fn === 'stuendlich'
    && p1.ausloeser[0].art === 'stunden' && p1.ausloeser[0].wert === 1, 'einrichten: der alte Auslöser der Probe weg, genau ein neuer – „stuendlich" jede Stunde');
  const k = workout(welt);
  check(k.zone === BERLIN && /Skript-Kennung: wk-[0-9a-f]{12}/.test(k.beschreibung) && /Fassung 1/.test(k.beschreibung),
    'einrichten: Kalender „Workout" in Europe/Berlin, mit Fassung und Skript-Kennung in der Beschreibung');
  check(p1.scopes === 1, 'einrichten: fragt alle Rechte auf einmal ab (requireAllScopes)');
  check(/Workout-Probe" gelöscht \(2 Stück\)/.test(text) && /angelegt/.test(text) && /Genau ein Auslöser/.test(text)
    && /Noch keine Vorschau/.test(text) && /Neue Version/.test(text) && !text.includes(TOKEN),
  'einrichten: das Protokoll sagt, was es getan hat und was als Nächstes kommt – ohne das Kennwort');
  zeige(text.split('\n').join('\n     '));
  check(!k.termine.length, 'einrichten: ohne Vorschau keine Termine');
}
text = p1.g.einrichten();
check(welt.heisst('Workout').length === 1 && p1.ausloeser.length === 1 && /wiedergefunden – kein zweiter/.test(text) && /Keine Probe mehr da/.test(text),
  'einrichten noch einmal: derselbe Kalender, wieder genau ein Auslöser, nichts doppelt');
const kal = workout(welt);
// Von Hand in „Workout": eine eingelesene Kalenderdatei, eine eigene Notiz,
// und ein Termin eines anderen Werkzeugs mit derselben Art Kennung, aber ohne
// Markierung des Skripts.
fremd(kal, 'Workout 10 · 5 Übungen · 15 Sätze', '2026-10-10T18:00:00+02:00', 60);
fremd(kal, 'Physio', '2026-10-09T08:00:00+02:00', 45);
fremd(kal, 'Fremdes Werkzeug', '2026-10-16T17:30:00+02:00', 60, { workout: 'cut-1-11' });
const fremdVorher = fremdBild(welt);

{
  const vorher = welt.schreiben;
  const r = feuern(p1, '2026-10-08T11:07:00+02:00');
  check(welt.schreiben === vorher && r && /Noch keine Vorschau/.test(r.hinweis),
    'stündlich ohne Vorschau: fasst den Kalender gar nicht an (kein Schreibzugriff, auch nicht die Beschreibung)');
}

/* ------------------------------------------------------------------ *
 * 4. doPost: was nicht angenommen wird
 * ------------------------------------------------------------------ */

{
  welt.jetzt = um('2026-10-08T11:10:00+02:00');
  const propsVorher = JSON.stringify([...p1.props]);
  const schreibVorher = welt.schreiben;
  const n = N.A;
  const k = (f) => { const x = JSON.parse(JSON.stringify(n)); f(x); return x; };
  const gross = k((x) => { x.texte.gross = ['x', 'y'.repeat(70 * 1024)]; });
  const faelle = [
    ['ohne Ereignis', () => ({ a: JSON.parse(p1.g.doPost(undefined).getContent()) }), 'format'],
    ['ohne Body', () => ({ a: JSON.parse(p1.g.doPost({ parameter: {} }).getContent()) }), 'format'],
    ['kaputtes JSON', () => post(p1, '{"v":1,"token":"' + TOKEN + '",'), 'format'],
    ['ein Array', () => post(p1, '[]'), 'format'],
    ['ohne Kennwort', () => post(p1, k((x) => { delete x.token; })), 'token'],
    ['Kennwort ein Zeichen anders', () => post(p1, k((x) => { x.token = TOKEN.replace(/.$/, 'X'); })), 'token'],
    ['Kennwort länger', () => post(p1, k((x) => { x.token = `${TOKEN}0`; })), 'token'],
    ['über 64 KiB', () => post(p1, gross), 'format'],
    ['Fassung 2 der App', () => post(p1, k((x) => { x.v = 2; })), 'format'],
    ['Kennung ohne Muster', () => post(p1, k((x) => { x.tage[x.ab][0][0] = 'Workout 9'; })), 'format'],
    ['Verweis auf „constructor"', () => post(p1, k((x) => { x.tage[x.ab][0][3] = 'constructor'; })), 'format'],
    ['24:00', () => post(p1, k((x) => { x.minuten = 1440; })), 'format'],
  ];
  const ergebnis = faelle.map(([name, f, code]) => {
    const r = f();
    return { name, ok: r.a.ok === false && r.a.code === code && r.a.version === 1 && r.a.kalender === 'Workout', a: r.a };
  });
  ergebnis.forEach((e) => check(e.ok, `doPost, ${e.name}: ok false, „${e.a.code}"${e.a.hinweis ? ` – ${e.a.hinweis}` : ''}`));
  check(/64 KiB/.test(ergebnis[7].a.hinweis) && /neuer als dieses Skript/.test(ergebnis[8].a.hinweis), 'die Hinweise sagen, was zu tun ist (zu groß, „Kalender-Code erneuern")');
  check(JSON.stringify([...p1.props]) === propsVorher && welt.schreiben === schreibVorher && !p1.belegt,
    'nichts davon hat etwas gespeichert oder den Kalender angefasst, und die Sperre ist wieder frei');
  const pr = probe(p1);
  check(pr.ok && pr.code === 'probe' && /Verbunden/.test(pr.hinweis) && JSON.stringify([...p1.props]) === propsVorher,
    `„Verbinden" (probe): ok, nichts gespeichert – ${pr.hinweis}`);
  const out = p1.g.doGet({ parameter: {} });
  const st = JSON.parse(out.getContent());
  check(out.getMimeType() === 'JSON' && st.ok && st.code === 'status' && st.kennwort === true && st.eingerichtet === true && st.vorschau === false
    && st.stand === null && !out.getContent().includes(kal.id) && !out.getContent().includes(TOKEN),
  'doGet: Lebenszeichen ohne Kennwort, ohne Stand, ohne Kalender-ID');
}

/* ------------------------------------------------------------------ *
 * 5. Der Abgleich über die Wochen
 * ------------------------------------------------------------------ */

{
  welt.jetzt = um('2026-10-08T12:00:10+02:00');
  const l = welt.lesen;
  const s = welt.schreiben;
  const r = post(p1, N.A);
  const a = r.a;
  check(r.typ === 'JSON' && a.ok && a.code === 'angekommen' && a.tag === '2026-10-08' && a.geaendert === N.A.tage['2026-10-08'].length
    && a.seq === 1 && gleich(a.stand, N.A.stand), `erste Sendung: angekommen, ${a.geaendert} Termine für den 08.10. angelegt`);
  zeige(`erste Sendung: ${welt.lesen - l} Lesezugriffe, ${welt.schreiben - s} Schreibzugriffe im Kalender`);
  const ab = abweichung(kal, N.A, '2026-10-08');
  check(!ab, `der Kalender zeigt genau die Liste vom 08.10. – 17:30 Berlin, Dauer, Titel, Übungen${ab ? ` – ${ab}` : ''}`);
  const offen = eigene(kal).filter((t) => !t.titel.startsWith('✓ '));
  const fertig = eigene(kal).filter((t) => t.titel.startsWith('✓ '));
  check(offen.length && fertig.length && offen.every((t) => gleich(t.popup, [30])) && fertig.every((t) => !t.popup.length && !t.email.length),
    `erledigte (${fertig.length}) mit „✓ " und ohne Erinnerung, offene (${offen.length}) mit 30 Minuten – die Voreinstellung des Kalenders (10 min) ist weg`);
  const werte = [...p1.props.values()];
  const meta = JSON.parse(p1.props.get('workout.meta'));
  check(meta.format === 1 && meta.teile === [...p1.props.keys()].filter((x) => x.startsWith('workout.teil.')).length && p1.maxWert <= 9000,
    `gespeichert: Format 1 in ${meta.teile} Stück(en), größter Wert ${p1.maxWert} Byte`);
  check(!werte.some((v) => v.includes(TOKEN)), 'das Kennwort steht nirgends in den Skript-Eigenschaften');
  check(fremdBild(welt) === fremdVorher, 'fremde Termine unberührt – auch die eingelesene Datei und der Termin mit fremder Kennung ohne Markierung');
}
{
  const r = post(p1, N.A);
  check(r.a.ok && r.a.code === 'gleich' && r.a.geaendert === 0, 'dieselbe Sendung noch einmal: „gleich", 0 Änderungen');
  const l = welt.lesen;
  const s = welt.schreiben;
  const r1 = feuern(p1, '2026-10-08T13:20:00+02:00');
  check(r1.tag === '2026-10-08' && r1.geaendert === 0, 'stündlich am selben Tag: 0 Änderungen (idempotent)');
  zeige(`eine ruhige Stunde: ${welt.lesen - l} Lesezugriffe, ${welt.schreiben - s} Schreibzugriff (die Beschreibung mit der Uhrzeit)`);
  const r2 = feuern(p1, '2026-10-08T23:59:30+02:00');
  check(r2.tag === '2026-10-08' && r2.geaendert === 0, 'um 23:59:30 Berlin (hier 14:59 Uhr): noch der 08.10.');
}
{
  const w9 = eigene(kal).find((t) => t.tags.workout === 'cut-1-9');
  const r = feuern(p1, '2026-10-09T00:00:30+02:00');
  const ab = abweichung(kal, N.A, '2026-10-09');
  check(r.tag === '2026-10-09' && r.geaendert > 0 && !ab, `um 0:00:30 Berlin (hier 15:00 am 08.10.): die Liste vom 09.10., ${r.geaendert} Änderungen${ab ? ` – ${ab}` : ''}`);
  const w9neu = eigene(kal).filter((t) => t.tags.workout === 'cut-1-9');
  check(w9neu.length === 1 && w9neu[0].id === w9.id && tagB(w9neu[0].beginn) === '2026-10-09' && new Date(w9neu[0].beginn).toISOString() === '2026-10-09T15:30:00.000Z',
    'Workout 9 verpasst: derselbe Termin verschoben auf Fr 09.10. 17:30 (15:30Z) – am 08.10. steht kein eigener mehr');
  check(feuern(p1, '2026-10-09T01:30:00+02:00').geaendert === 0, 'eine Stunde später: 0 Änderungen');
  const r12 = feuern(p1, '2026-10-12T00:40:00+02:00');
  check(r12.tag === '2026-10-12' && !abweichung(kal, N.A, '2026-10-12') && kurz(kal, '2026-10-12') === 'cut-1-9@10-12 cut-1-10@10-14 cut-1-11@10-16 cut-1-12@10-17',
    `drei Tage ohne App: alles rückt nach (${kurz(kal, '2026-10-12')})`);
}
{
  feuern(p1, '2026-10-25T00:30:00+02:00');
  check(!abweichung(kal, N.A, '2026-10-25'), 'So 25.10. 0:30 Sommerzeit: die Liste vom 25.10.');
  const r = feuern(p1, '2026-10-25T23:30:00+01:00');
  check(r.tag === '2026-10-25' && r.geaendert === 0, 'So 25.10. 23:30 Winterzeit (22:30Z, der Tag hat 25 Stunden): noch der 25.10.');
  const r2 = feuern(p1, '2026-10-26T00:10:00+01:00');
  const w9 = eigene(kal).find((t) => t.tags.workout === 'cut-1-9');
  check(r2.tag === '2026-10-26' && !abweichung(kal, N.A, '2026-10-26') && kurz(kal, '2026-10-26') === 'cut-1-9@10-26 cut-1-10@10-28 cut-1-11@10-30 cut-1-12@10-31'
    && new Date(w9.beginn).toISOString() === '2026-10-26T16:30:00.000Z', `Mo 26.10. 0:10 (hier noch So 25.10.): ${kurz(kal, '2026-10-26')} – Workout 9 um 16:30Z`);
  const alle = eigene(kal);
  check(alle.every((t) => uhrB(t.beginn) === '17:30' && new Date(t.beginn).getUTCHours() === (tagB(t.beginn) >= '2026-10-25' ? 16 : 15)),
    `alle ${alle.length} eigenen Termine um 17:30 Berliner Zeit – vor der Zeitumstellung 15:30Z, danach 16:30Z`);
}
{
  welt.jetzt = um('2026-10-26T19:00:05+01:00');
  const a = post(p1, N.T).a;
  const w9 = eigene(kal).find((t) => t.tags.workout === 'cut-1-9');
  check(a.ok && a.code === 'angekommen' && a.seq === 2 && !abweichung(kal, N.T, '2026-10-26'),
    `trainiert: die neue Vorschau gilt sofort (${a.geaendert} Änderungen)`);
  check(w9.titel.startsWith('✓ Workout 9') && !w9.popup.length && tagB(w9.beginn) === '2026-10-26', `Workout 9 abgehakt: „${w9.titel}", ohne Erinnerung`);
}

/* ------------------------------------------------------------------ *
 * Zwei Geräte
 * ------------------------------------------------------------------ */

{
  welt.jetzt = um('2026-10-27T08:00:05+01:00');
  const vorher = welt.terminSchreiben;
  const tab = post(p1, N.Tablet).a;
  check(!tab.ok && tab.code === 'aelter' && tab.seq === 2 && gleich(tab.stand, N.T.stand) && welt.terminSchreiben === vorher,
    'das Tablet aus der Schublade sendet einen Tag später: „aelter", der Kalender bleibt beim Handy');
  const alt = post(p1, N.A).a;
  check(!alt.ok && alt.code === 'alt' && alt.seq === 2, 'eine verspätete Wiederholung der ersten Sendung des Handys: „alt"');
  welt.jetzt = um('2026-10-28T19:00:05+01:00');
  const tab2 = post(p1, N.Tab2).a;
  check(tab2.ok && tab2.code === 'angekommen' && !abweichung(kal, N.Tab2, '2026-10-28'), 'auf dem Tablet weiter trainiert (Workout 10): jetzt gilt das Tablet');
  welt.jetzt = um('2026-10-29T08:00:05+01:00');
  const h = post(p1, N.HandyAlt).a;
  check(!h.ok && h.code === 'aelter' && h.seq === 6, 'und das Handy, das seitdem nur nachgerückt ist, ist jetzt das ältere');
  check(probe(p1).seq === 6, '„Verbinden" zeigt, was gilt (seq 6 vom Tablet)');
}

/* ------------------------------------------------------------------ *
 * Horizont abgelaufen
 * ------------------------------------------------------------------ */

{
  const letzter = Object.keys(N.Tab2.tage).sort().pop();
  check(letzter === '2026-12-08', `die Vorschau vom 28.10. reicht bis ${letzter}`);
  feuern(p1, '2026-12-08T12:00:00+01:00');
  check(!abweichung(kal, N.Tab2, '2026-12-08'), 'am letzten Tag der Vorschau: noch angeglichen');
  const bild = bildEigene(kal);
  const r = feuern(p1, '2026-12-09T00:30:00+01:00');
  const h = hinweise(kal);
  check(r.tag === null && /aufgebraucht/.test(r.hinweis) && bildEigene(kal) === bild,
    'einen Tag danach: aufgebraucht – kein eigener Termin verschoben');
  check(h.length === 1 && tagB(h[0].beginn) === '2026-12-09' && uhrB(h[0].beginn) === '17:30' && gleich(h[0].popup, [30]) && /App öffnen/.test(h[0].titel),
    `stattdessen genau ein Hinweis heute um 17:30 mit Erinnerung: „${h[0] && h[0].titel}"`);
  check(/aufgebraucht/.test(kal.beschreibung) && /Zuletzt abgeglichen/.test(kal.beschreibung), 'und die Beschreibung des Kalenders sagt es auch');
  const r2 = feuern(p1, '2026-12-09T05:30:00+01:00');
  check(r2.geaendert === 0 && hinweise(kal).length === 1 && bildEigene(kal) === bild, 'Stunden später: derselbe Hinweis, 0 Änderungen');
  feuern(p1, '2026-12-10T00:30:00+01:00');
  const h2 = hinweise(kal);
  check(h2.length === 1 && h2[0].id === h[0].id && tagB(h2[0].beginn) === '2026-12-10' && bildEigene(kal) === bild, 'am nächsten Tag: derselbe Hinweis, mitgewandert auf heute');
  welt.jetzt = um('2026-12-10T18:00:05+01:00');
  const a = post(p1, N.Tab3).a;
  check(a.ok && a.code === 'angekommen' && !hinweise(kal).length && !abweichung(kal, N.Tab3, '2026-12-10'), 'eine neue Vorschau: Hinweis weg, wieder angeglichen');
}

/* ------------------------------------------------------------------ *
 * Abschalten und wieder an
 * ------------------------------------------------------------------ */

{
  welt.jetzt = um('2026-12-10T20:00:05+01:00');
  const vorher = eigene(kal).filter((t) => tagB(t.beginn) < '2026-12-10').length;
  const a = post(p1, { v: 1, token: TOKEN, geraet: 'handy-tobi', seq: 4, gesendet: um('2026-12-10T20:00:00+01:00'), aus: true }).a;
  const ab = eigene(kal).filter((t) => tagB(t.beginn) >= '2026-12-10');
  check(a.ok && a.code === 'aus' && a.geaendert > 0 && !ab.length && eigene(kal).filter((t) => tagB(t.beginn) < '2026-12-10').length === vorher,
    `„Abschalten" (vom Handy): ${a.geaendert} eigene Termine ab heute gelöscht, die ${vorher} davor bleiben`);
  check(![...p1.props.keys()].some((x) => x.startsWith('workout.teil.')) && JSON.parse(p1.props.get('workout.meta')).aus === true && /abgeschaltet/.test(kal.beschreibung),
    'die Vorschau ist aus dem Speicher weg, die Beschreibung sagt „abgeschaltet"');
  const r = feuern(p1, '2026-12-11T00:30:00+01:00');
  check(r.geaendert === 0 && /abgeschaltet/.test(r.hinweis) && /abgeschaltet/.test(probe(p1).hinweis), 'danach stündlich: nichts, ohne Fehler; „Verbinden" sagt es');
  welt.jetzt = um('2026-12-11T09:00:05+01:00');
  const b = post(p1, N.Handy5).a;
  check(b.ok && b.code === 'angekommen' && !abweichung(kal, N.Handy5, '2026-12-11'), 'die nächste Vorschau schaltet wieder an');
}
check(fremdBild(welt) === fremdVorher, 'nach elf Wochen Abgleich: kein fremder Termin angefasst – in keinem Kalender');
check(p1.ausloeser.length === 1 && welt.heisst('Workout').length === 1 && !p1.belegt, 'weiter genau ein Auslöser, ein Kalender „Workout", die Sperre frei');

/* ------------------------------------------------------------------ *
 * 6. Leere Einheit, Zusatztag, Rundenende
 * ------------------------------------------------------------------ */

const neu = (jetzt, n, wann) => {
  const w = new Welt(jetzt);
  const p = mitWelt(w);
  p.g.einrichten();
  w.jetzt = um(wann);
  const a = post(p, n).a;
  return { w, p, k: workout(w), a };
};
{
  const { p, k, a } = neu('2026-10-08T10:00:00+02:00', N.F, '2026-10-08T12:00:05+02:00');
  check(a.ok && !abweichung(k, N.F, '2026-10-08'), 'F (Turnier am 12.10. schont alles): angelegt');
  ['2026-10-09', '2026-10-10'].forEach((t) => feuern(p, `${t}T00:30:00+02:00`));
  const w9 = eigene(k).find((t) => t.tags.workout === 'cut-1-9');
  check(w9 && tagB(w9.beginn) === '2026-10-10', 'F, Sa 10.10.: Workout 9 verpasst und nachgerückt');
  const ohneW9 = ['2026-10-11', '2026-10-12', '2026-10-13'].filter((t) => {
    feuern(p, `${t}T00:30:00+02:00`);
    return !eigene(k).some((x) => x.tags.workout === 'cut-1-9') && !abweichung(k, N.F, t);
  });
  check(ohneW9.length === 3 && w9.weg,
    'F, So 11. bis Di 13.10.: Workout 9 ist leer (das Turnier am 12.10. schont alles) – sein verpasster Termin vom Sa kommt weg, kein neuer');
  feuern(p, '2026-10-14T00:30:00+02:00');
  check(!abweichung(k, N.F, '2026-10-14') && kurz(k, '2026-10-14', 2) === 'cut-1-9@10-14 cut-1-10@10-16', `F, Mi 14.10.: Workout 9 ist wieder ein Termin (${kurz(k, '2026-10-14', 2)})`);
}
{
  const { p, k } = neu('2026-10-08T10:00:00+02:00', N.R, '2026-10-08T12:00:05+02:00');
  const z1 = eigene(k).find((t) => t.tags.workout === 'cut-1-z1');
  check(z1 && tagB(z1.beginn) === '2026-10-08' && /^Zusatztag Woche 1/.test(z1.titel), 'R, Ruhetag: der Zusatztag allein, heute');
  feuern(p, '2026-10-09T00:30:00+02:00');
  feuern(p, '2026-10-10T00:30:00+02:00');
  const z1b = eigene(k).find((t) => t.tags.workout === 'cut-1-z1');
  check(z1b && z1b.id === z1.id && tagB(z1b.beginn) === '2026-10-10', 'R, Sa 10.10.: unberührt wandert er mit (derselbe Termin)');
  feuern(p, '2026-10-11T00:30:00+02:00');
  const w5 = eigene(k).find((t) => t.tags.workout === 'cut-1-5');
  const ue = (titel) => Number(/· (\d+) Übungen/.exec(titel)[1]);
  const w5vorher = N.R.texte[N.R.tage['2026-10-08'].find((e) => e[0] === 'cut-1-5')[3]][0];
  check(!eigene(k).some((t) => t.tags.workout === 'cut-1-z1') && !abweichung(k, N.R, '2026-10-11') && ue(w5.titel) > ue(w5vorher),
    `R, So 11.10.: der Zusatztag steckt in Workout 5 – sein Termin vom Sa kommt weg (${w5vorher} → ${w5.titel})`);
}
{
  const { p, k, a } = neu('2026-10-23T10:00:00+02:00', N.E2, '2026-10-23T19:00:05+02:00');
  const w84 = eigene(k).find((t) => t.tags.workout === 'cut-1-84');
  check(a.ok && w84 && tagB(w84.beginn) === '2026-10-23' && !w84.titel.startsWith('✓'), 'E2, Fr 23.10.: Workout 84 angefangen, offen');
  feuern(p, '2026-10-24T00:30:00+02:00');
  const w84b = eigene(k).find((t) => t.tags.workout === 'cut-1-84');
  check(w84b && w84b.id === w84.id && tagB(w84b.beginn) === '2026-10-23' && eigene(k).some((t) => t.tags.workout === 'cut-2-1') && !abweichung(k, N.E2, '2026-10-24'),
    'E2, Sa 24.10.: die Runde rollt weiter (cut-2-…), der Termin von Workout 84 bleibt als Verlauf stehen');
}

/* ------------------------------------------------------------------ *
 * Google bremst, die Zeit ist um
 * ------------------------------------------------------------------ */

{
  const w = new Welt('2026-10-08T10:00:00+02:00');
  const p = mitWelt(w);
  p.g.einrichten();
  const k = workout(w);
  w.jetzt = um('2026-10-08T12:00:05+02:00');
  w.drossel = 20;
  const r = post(p, N.A);
  check(r.json && r.a.ok && r.a.code === 'angekommen' && /bremst/.test(r.a.hinweis) && r.a.geaendert < N.A.tage['2026-10-08'].length,
    `Google bremst nach 20 Schreibzugriffen: trotzdem JSON, angekommen, ${r.a.geaendert} Termine, „${r.a.hinweis}"`);
  const halb = k.termine.filter((t) => !t.weg && !t.tags.workoutSkript);
  check(halb.length === 1 && p.props.has('workout.offen'), 'dabei blieb ein Termin halb markiert – seine id hat sich das Skript gemerkt');
  w.drossel = null;
  let fehler = null;
  try { feuern(p, '2026-10-08T13:07:00+02:00'); } catch (e) { fehler = e; }
  check(!fehler && !abweichung(k, N.A, '2026-10-08') && !k.termine.some((t) => !t.weg && !t.tags.workoutSkript) && !p.props.has('workout.offen'),
    'die nächste Stunde holt den Rest nach – der halbe Termin ist markiert, nicht doppelt angelegt');
}
{
  const w = new Welt('2026-10-08T10:00:00+02:00');
  const p = mitWelt(w);
  p.g.einrichten();
  const k = workout(w);
  w.proSchreiben = 6000; // jeder Schreibzugriff dauert sechs Sekunden
  w.jetzt = um('2026-10-08T12:00:05+02:00');
  const a = post(p, N.A).a;
  const laeufe = [a.geaendert];
  let fehler = null;
  for (let h = 13; h < 20 && abweichung(k, N.A, '2026-10-08'); h++) {
    try { laeufe.push(feuern(p, `2026-10-08T${h}:00:00+02:00`).geaendert); } catch (e) { fehler = e; break; }
  }
  check(a.ok && /bremst/.test(a.hinweis) && !fehler && !abweichung(k, N.A, '2026-10-08') && laeufe.length > 2,
    `langsames Google (6 s je Schreibzugriff, 4 Minuten je Lauf): in ${laeufe.length} Läufen fertig (${laeufe.join(' + ')}), ohne Fehler und ohne Doppel`);
}

/* ------------------------------------------------------------------ *
 * Ein zweites Projekt
 * ------------------------------------------------------------------ */

{
  const w = new Welt('2026-10-08T10:00:00+02:00');
  const alt = mitWelt(w);
  alt.g.einrichten();
  w.jetzt = um('2026-10-08T12:00:05+02:00');
  post(alt, N.A);
  const k = workout(w);
  const anzahl = eigene(k).length;
  w.jetzt = um('2026-10-08T13:00:00+02:00');
  const zweit = mitWelt(w);
  const text2 = zweit.g.einrichten();
  check(w.heisst('Workout').length === 1 && /übernommen – kein zweiter/.test(text2) && eigene(k).length === anzahl,
    'ein zweites Projekt eingerichtet: übernimmt den Kalender „Workout", statt einen zweiten anzulegen');
  const s = w.schreiben;
  w.jetzt = um('2026-10-08T14:00:00+02:00');
  const r = alt.g.stuendlich();
  check(w.schreiben === s && !alt.ausloeser.length && /anderes Skript-Projekt/.test(r.hinweis),
    'das alte Projekt fasst ihn danach nicht mehr an und schaltet seinen Auslöser ab (kein Hin und Her)');
  w.jetzt = um('2026-10-08T14:10:00+02:00');
  const a = post(zweit, { ...N.A, seq: 2 }).a;
  check(a.ok && !abweichung(k, N.A, '2026-10-08') && eigene(k).length === anzahl && eigene(k).every((t) => t.tags.workoutSkript === zweit.props.get('workout.projekt')),
    'das neue Projekt gleicht dieselben Termine an – keiner doppelt, alle jetzt mit seiner Kennung');
  const s2 = w.terminSchreiben;
  const b = post(alt, { ...N.A, seq: 3 }).a;
  check(b.ok && /anderes Skript-Projekt/.test(b.hinweis) && w.terminSchreiben === s2 && !alt.ausloeser.length,
    'schickt die App noch an die alte URL: angekommen, aber mit dem Hinweis – und der Kalender bleibt beim neuen');
  check(/gehört zum alten/.test(probe(alt).hinweis) && /^Verbunden/.test(probe(zweit).hinweis), '„Verbinden" mit der alten URL sagt es auch, mit der neuen nicht');
}

/* ------------------------------------------------------------------ *
 * Kalender gelöscht, ohne einrichten, ohne Kennwort
 * ------------------------------------------------------------------ */

{
  const { w, p, k } = neu('2026-10-08T10:00:00+02:00', N.A, '2026-10-08T12:00:05+02:00');
  k.weg = true; // Tobi löscht „Workout" in Google Kalender
  let fehler = null;
  try { feuern(p, '2026-10-08T13:00:00+02:00'); } catch (e) { fehler = e; }
  check(fehler && /einrichten/.test(fehler.message) && !w.heisst('Workout').length,
    `Kalender gelöscht: der Auslöser wirft (Google schickt die Fehlermail), legt ihn nicht ungefragt neu an – „${fehler && fehler.message}"`);
  const a = post(p, { ...N.A, seq: 2 }).a;
  check(a.ok && a.geaendert === null && /einrichten/.test(a.hinweis) && /einrichten/.test(probe(p).hinweis), 'die App bekommt es beim Senden und beim „Verbinden" gesagt');
  const t = p.g.einrichten();
  check(/nicht mehr da/.test(t) && w.heisst('Workout').length === 1 && !abweichung(workout(w), N.A, '2026-10-08'), 'einrichten legt ihn neu an und gleicht gleich ab');
}
{
  const w = new Welt('2026-10-08T10:00:00+02:00');
  const p = mitWelt(w);
  w.jetzt = um('2026-10-08T12:00:05+02:00');
  const a = post(p, N.A).a;
  check(a.ok && a.code === 'angekommen' && w.heisst('Workout').length === 1 && workout(w).zone === BERLIN && p.ausloeser.length === 1 && p.ausloeser[0].fn === 'stuendlich'
    && /Auslöser fehlte/.test(a.hinweis) && !abweichung(workout(w), N.A, '2026-10-08'),
  'nur bereitgestellt, nie „einrichten" ausgeführt: die erste Sendung legt Kalender und Auslöser selbst an');
}
{
  const w = new Welt('2026-10-08T10:00:00+02:00');
  const p = mitWelt(w, VORLAGE);
  const a = post(p, N.A).a;
  check(!a.ok && a.code === 'token' && /kein Kennwort/.test(a.hinweis) && probe(p).code === 'token' && JSON.parse(p.g.doGet().getContent()).kennwort === false,
    'die Vorlage unersetzt eingefügt: nimmt nichts an und sagt warum');
  let fehler = null;
  try { p.g.einrichten(); } catch (e) { fehler = e; }
  check(fehler && /Kennwort/.test(fehler.message) && w.heisst('Workout').length === 1 && p.ausloeser.length === 1,
    'einrichten richtet trotzdem ein und endet mit einem roten Fehler „Kennwort fehlt"');
}

/* ------------------------------------------------------------------ *
 * 7. Speicher
 * ------------------------------------------------------------------ */

{
  const { w, p, a } = neu('2026-10-08T10:00:00+02:00', N.Gross, '2026-10-08T12:00:05+02:00');
  const teileKeys = () => [...p.props.keys()].filter((x) => x.startsWith('workout.teil.'));
  const meta = JSON.parse(p.props.get('workout.meta'));
  const gelesen = JSON.parse(p.lauf('JSON.stringify(vorschauLesen_(PropertiesService.getScriptProperties(), metaLesen_(PropertiesService.getScriptProperties())))'));
  const gesamt = [...p.props].reduce((s, [x, y]) => s + bytes(x) + bytes(y), 0);
  check(a.ok && meta.teile >= 7 && teileKeys().length === meta.teile && p.maxWert <= 9000 && gleich(gelesen, ohneToken(N.Gross)),
    `fast 64 KiB mit Umlauten und 💪: ${meta.teile} Stücke, größtes ${p.maxWert} Byte, zusammen ${(gesamt / 1024).toFixed(1)} KiB – gelesen wie geschickt`);
  w.jetzt = um('2026-10-08T12:30:00+02:00');
  post(p, { ...N.A, seq: 4 });
  const meta2 = JSON.parse(p.props.get('workout.meta'));
  check(teileKeys().length === meta2.teile && teileKeys().every((x) => x.startsWith(`workout.teil.${meta2.gen}.`)), 'die nächste Sendung: die alten Stücke sind weg');
}
{
  // Ein Speicher, wie ihn Fassung 1 schreibt – wörtlich hier, damit jede
  // spätere Fassung ihn lesen muss: Die Web-App läuft auf der bereitgestellten
  // Fassung, der Auslöser auf der zuletzt gespeicherten.
  const w = new Welt('2026-10-08T12:30:00+02:00');
  const k = new Kal(w, 'Workout', { zone: BERLIN });
  k.beschreibung = 'Gepflegt vom Skript „Workout-Kalender" (Fassung 1).\nSkript-Kennung: wk-fixture1234';
  const p = mitWelt(w);
  const felder = ['v', 'geraet', 'seq', 'gesendet', 'app', 'minuten', 'erinnerung', 'ab', 'fenster', 'stand', 'texte', 'tage'];
  const text1 = JSON.stringify(Object.fromEntries(felder.map((f) => [f, N.A[f]])));
  const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); };
  const mitte = Math.floor(text1.length / 2);
  const setze = () => {
    p.props.clear();
    p.props.set('workout.kalender', k.id);
    p.props.set('workout.projekt', 'wk-fixture1234');
    p.props.set('workout.meta', JSON.stringify({
      format: 1, gen: 'g1', teile: 2, zeichen: text1.length, pruef: fnv(text1), geraet: 'handy-tobi', seq: 1, gesendet: N.A.gesendet,
      stand: N.A.stand, app: 'v245', ab: '2026-10-08', bis: '2026-11-18', empfangen: N.A.gesendet + 5000,
    }));
    p.props.set('workout.teil.g1.0', text1.slice(0, mitte));
    p.props.set('workout.teil.g1.1', text1.slice(mitte));
  };
  setze();
  p.ausloeser.push(ausloeser('stuendlich', 'stunden', 1));
  const r = feuern(p, '2026-10-08T12:30:00+02:00');
  check(r.tag === '2026-10-08' && !abweichung(k, N.A, '2026-10-08'), 'ein Speicher im Format 1 (wörtlich): gelesen und angeglichen');
  const bild = bildEigene(k);
  p.props.delete('workout.teil.g1.1');
  const t0 = w.terminSchreiben;
  let fehler = null;
  try { feuern(p, '2026-10-09T00:30:00+02:00'); } catch (e) { fehler = e; }
  check(fehler && /unvollständig/.test(fehler.message) && w.terminSchreiben === t0 && bildEigene(k) === bild,
    'ein Stück fehlt: der Auslöser wirft, der Kalender bleibt, wie er ist');
  setze();
  p.props.set('workout.meta', JSON.stringify({ ...JSON.parse(p.props.get('workout.meta')), format: 2 }));
  fehler = null;
  try { feuern(p, '2026-10-09T00:30:00+02:00'); } catch (e) { fehler = e; }
  check(fehler && /Speicherformat/.test(fehler.message) && w.terminSchreiben === t0, 'ein unbekanntes Format: ebenso – nichts angefasst');
  w.jetzt = um('2026-10-09T08:00:00+02:00');
  const a = post(p, { ...N.A, seq: 2 }).a;
  check(a.ok && a.code === 'angekommen' && !abweichung(k, N.A, '2026-10-09'), 'die nächste gültige Sendung heilt es');
}

/* ------------------------------------------------------------------ *
 * Die Sperre
 * ------------------------------------------------------------------ */

{
  const w = new Welt('2026-10-08T10:00:00+02:00');
  const p = mitWelt(w);
  p.g.einrichten();
  post(p, N.A);
  p.belegt = true; // ein anderer Lauf hält die Sperre
  const s = w.schreiben;
  const a = post(p, { ...N.A, seq: 2 }).a;
  let r = 'x';
  let fehlerS = null;
  try { r = feuern(p, '2026-10-08T13:00:00+02:00'); } catch (e) { fehlerS = e; }
  let fehlerE = null;
  try { p.g.einrichten(); } catch (e) { fehlerE = e; }
  check(!a.ok && a.code === 'fehler' && /beschäftigt/.test(a.hinweis) && r === null && !fehlerS && fehlerE && w.schreiben === s,
    'die Sperre ist belegt: doPost antwortet „beschäftigt", stündlich wartet still auf die nächste Stunde, einrichten bittet um eine Minute');
}

/* ------------------------------------------------------------------ *
 * Alle Antworten
 * ------------------------------------------------------------------ */

{
  const geparst = alleAntworten.map((x) => { try { return JSON.parse(x); } catch { return null; } });
  check(geparst.every((a) => a && typeof a.ok === 'boolean' && typeof a.code === 'string' && a.version === 1 && a.kalender === 'Workout'
    && ['tag', 'geaendert', 'stand', 'seq'].every((f) => f in a)), `alle ${geparst.length} Antworten: JSON mit ok, code, version, kalender, tag, geaendert, stand, seq`);
  check(!alleAntworten.some((x) => x.includes(TOKEN) || /@group\.calendar|@google\.com|https?:/.test(x)), 'keine Antwort enthält das Kennwort, eine Kalender-ID oder eine Adresse');
  const codes = [...new Set(geparst.map((a) => a.code))].sort();
  check(gleich(codes, ['aelter', 'alt', 'angekommen', 'aus', 'fehler', 'format', 'gleich', 'probe', 'token']), `jede Antwort aus dem Vertrag kam vor (${codes.join(', ')})`);
}

console.log(fails ? `\n${fails} gescheitert` : '\nalles grün');
process.exit(fails ? 1 : 0);
