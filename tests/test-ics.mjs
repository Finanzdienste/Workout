/*
 * Kalenderdatei: Termine um 18 Uhr, feste Kennung je Workout, und nach einer
 * Verschiebung wandern dieselben Termine mit – das ist der ganze Zweck.
 */
import { chromium } from 'playwright';
import { URL } from './umgebung.mjs';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 414, height: 896 } });
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('workout.state.v1', '{"greeted":true}'); });
await page.reload({ waitUntil: 'networkidle' });

/** Datei erzeugen wie der Knopf – ohne Download, damit der Text prüfbar bleibt. */
const bauen = (shift) => page.evaluate(async (tage) => {
  const store = await import('./js/store.js');
  const { buildICS } = await import('./js/ics.js');
  const { PLAN, EXERCISES } = await import('./js/data.js');
  const byId = new Map(EXERCISES.map((e) => [e.id, e]));
  store.setShift(tage);
  const datum = (w) => store.startedOn(w.n) || (() => {
    const d = new Date(`${w.date}T00:00:00`);
    d.setDate(d.getDate() + tage);
    return d.toISOString().slice(0, 10);
  })();
  return buildICS(
    PLAN.map((w) => ({ n: w.n, date: datum(w) })),
    (w) => PLAN[w.n - 1].ex.map((it) => ({
      sets: it.sets, name: byId.get(it.id).db.name,
      reps: byId.get(it.id).db.reps, rest: byId.get(it.id).db.rest,
    })),
    { hour: 18, seq: 1 },
  );
}, shift);

const ics = await bauen(0);
const zeilen = ics.split('\r\n');
console.log('     Kopf:', zeilen.slice(0, 4).join(' | '));

// --- Grundgerüst ---
check(zeilen[0] === 'BEGIN:VCALENDAR' && ics.trimEnd().endsWith('END:VCALENDAR'), 'gültiger Rahmen');
check(ics.includes('\r\n'), 'Zeilenenden nach Standard (CRLF)');
const events = ics.split('BEGIN:VEVENT').length - 1;
const geplant = await page.evaluate(async () => (await import('./js/data.js')).PLAN.length);
check(events === geplant, `ein Termin je Einheit (${events} von ${geplant})`);
check((ics.match(/END:VEVENT/g) || []).length === events, 'jeder Termin ist geschlossen');

// --- Zeit und Dauer ---
const starts = [...ics.matchAll(/DTSTART:(\d{8})T(\d{6})/g)];
check(starts.length === events, 'jeder Termin hat einen Beginn');
check(starts.every(([, , t]) => t === '180000'), 'alle Termine beginnen um 18:00');
const ende = /DTEND:(\d{8})T(\d{6})/.exec(ics);
const minuten = (Number(ende[2].slice(0, 2)) - 18) * 60 + Number(ende[2].slice(2, 4));
console.log('     erste Einheit dauert', minuten, 'min');
check(minuten >= 25 && minuten <= 75, `Dauer plausibel (${minuten} min)`);
check(!/DTSTART:[^\r]*Z/.test(ics), 'keine feste Zeitzone – 18 Uhr bleibt 18 Uhr');

// --- Inhalt ---
check(/SUMMARY:Workout 1 · \d+ Übungen/.test(ics), 'Titel nennt Workout und Umfang');
const beschreibung = /DESCRIPTION:(.*)/.exec(ics)[1];
console.log('     Beschreibung:', beschreibung.slice(0, 70));
check(beschreibung.includes('•') && /\\n/.test(ics), 'Übungsliste in der Beschreibung');
check(!/^.{76,}$/m.test(ics), 'keine Zeile länger als 75 Zeichen (gefaltet)');

// --- Feste Kennung: der eigentliche Punkt ---
const uids = [...ics.matchAll(/UID:(.+)/g)].map((m) => m[1].trim());
check(new Set(uids).size === uids.length, 'jede Kennung kommt genau einmal vor');
check(uids[0].startsWith('workout-1@'), `Kennung hängt an der Workout-Nummer (${uids[0]})`);

// --- Verschiebung: dieselben Kennungen, andere Termine ---
const ics2 = await bauen(3);
const uids2 = [...ics2.matchAll(/UID:(.+)/g)].map((m) => m[1].trim());
const starts2 = [...ics2.matchAll(/DTSTART:(\d{8})T/g)].map((m) => m[1]);
const starts1 = starts.map((m) => m[1]);
console.log(`     ohne Verschiebung: ${starts1[0]} · mit 3 Tagen: ${starts2[0]}`);
check(uids2.join() === uids.join(), 'nach der Verschiebung dieselben Kennungen');
check(starts2[0] !== starts1[0], 'aber andere Termine');
const diff = (a, b) => (Date.parse(`${b.slice(0, 4)}-${b.slice(4, 6)}-${b.slice(6)}`)
                      - Date.parse(`${a.slice(0, 4)}-${a.slice(4, 6)}-${a.slice(6)}`)) / 86400000;
check(starts1.every((d, i) => diff(d, starts2[i]) === 3), 'alle Termine wandern um genau 3 Tage');

// --- SEQUENCE zählt hoch, sonst überschreibt der Import nichts ---
const seq = await page.evaluate(async () => {
  const store = await import('./js/store.js');
  return [store.markIcs().seq, store.markIcs().seq];
});
console.log('     SEQUENCE:', seq.join(' -> '));
check(seq[1] === seq[0] + 1, 'jeder Export zählt SEQUENCE hoch');

// --- Der Hinweis im Tab "Mehr" ---
// Frisch schreiben statt lesen: der Speicher wird verzögert geschrieben, und
// direkt nach dem Leeren steht dort noch gar nichts. Erst den ausstehenden
// Schreibvorgang der Aufrufe oben abwarten – sonst überschreibt der uns gleich
// wieder.
await page.evaluate(async () => (await import('./js/store.js')).flush());
await page.evaluate(() => {
  localStorage.setItem('workout.state.v1', JSON.stringify({
    log: {}, shift: 4, tab: 'settings', autoShift: false,
    lastIcs: { on: '2026-08-24', shift: 0, seq: 1 },
  }));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
const text = (await page.locator('#view').textContent()).replace(/\s+/g, ' ');
check(/Plan hat sich seit dem letzten Export/.test(text), 'die App meldet den veralteten Kalender');
check(/4 Tage/.test(text), 'und nennt die Zahl der Tage');
check(await page.locator('[data-act="download-ics"]').count() === 1, 'Knopf zum Erzeugen da');

console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
console.log('ERRORS:', errs.length ? errs : 'none');
await browser.close();
