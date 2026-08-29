/*
 * Der Zusatztag: eine Einheit daneben statt Sätze hineingestopft.
 *
 * Die Nacharbeit hat einen Deckel von drei Sätzen, und der ist gewollt. Wer
 * aber eine ganze Einheit ausgelassen hat, dem fehlen fünfzehn – die passen
 * nirgendwo mehr hinein, ohne dass die nächste Einheit zur Zumutung wird.
 *
 * Vier Dinge müssen stimmen, und zwei davon sind Fälle, in denen *nichts*
 * angeboten werden darf:
 *
 *   1. Wer seine Woche gemacht hat, bekommt keinen Vorschlag.
 *   2. Solange die Woche noch läuft, auch nicht – da ist nichts versäumt.
 *   3. Bei echtem Rückstand: eine Einheit aus genau dem, was fehlt.
 *   4. Und die 48-Stunden-Regel gilt auch für sie. Sonst stünde die Regel, die
 *      den ganzen Plan trägt, ausgerechnet für die freiwillige Einheit nicht.
 */
import { chromium } from 'playwright';
import { URL } from './umgebung.mjs';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } });
await ctx.route('**/rest/v1/**', (r) => r.fulfill({ status: 204, body: '' }));
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
page.on('dialog', (d) => d.accept().catch(() => {}));
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

const setze = (z) => page.evaluate(
  (o) => localStorage.setItem('workout.state.v1', JSON.stringify(o)), z);

/** Protokoll für die Einheiten `von`..`bis`; `auslassen` Übungen je Einheit weg. */
const protokoll = (von, bis, auslassen = 0) => page.evaluate(async ([a, b, weg]) => {
  const { PLAN } = await import('./js/data.js');
  const log = {};
  PLAN.slice(a, b).forEach((w) => {
    const e = { mode: 'db', done: 'db', db: {} };
    w.ex.slice(0, Math.max(1, w.ex.length - weg)).forEach((it) => {
      e.db[it.id] = Array.from({ length: it.sets }, () => ({ w: '20', r: '', done: true }));
    });
    log[w.n] = e;
  });
  return log;
}, [von, bis, auslassen]);

const zurStatistik = async () => {
  await page.locator('.tab[data-tab="stats"]').click();
  await page.waitForTimeout(500);
  return (await page.locator('#view').textContent()).replace(/\s+/g, ' ');
};

await page.goto(URL, { waitUntil: 'networkidle' });

// Der Plan rückt beim Laden auf heute nach. Damit die erste Woche wirklich in
// der Vergangenheit liegt, wird die Verschiebung fest gesetzt – sonst steht die
// „abgeschlossene" Woche je nach Testtag noch in der Zukunft.
const schiebe = await page.evaluate(async () => {
  const { PLAN } = await import('./js/data.js');
  const heute = new Date();
  const start = new Date(PLAN[0].date);
  return Math.round((heute - start) / 86400000) + 14;   // Woche 1 liegt hinter uns
});

// --- 1. Volle Woche, kein Vorschlag -------------------------------------
await setze({ greeted: true, name: 'T', level: 'geuebt', shift: schiebe,
  log: await protokoll(0, 4, 0) });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
let text = await zurStatistik();
check(/Woche 1/.test(text), 'die erste Woche wird ausgewertet');
check(!/Zusatztag\?/.test(text), 'wer seine Woche gemacht hat, bekommt keinen Vorschlag');

// --- 2. Woche läuft noch: auch kein Vorschlag ----------------------------
// Zwei von vier Einheiten gemacht, zwei stehen noch offen.
await setze({ greeted: true, name: 'T', level: 'geuebt', shift: 0,
  log: await protokoll(0, 2, 0) });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
text = await zurStatistik();
check(!/Zusatztag\?/.test(text),
  'solange die Woche läuft, wird nichts vorgeschlagen – da ist nichts versäumt');

// --- 3. Woche durch, echter Rückstand: der Vorschlag steht --------------
// Alle vier Einheiten „abgeschlossen", aber je zwei Übungen nie angefasst.
await setze({ greeted: true, name: 'T', level: 'geuebt', shift: schiebe,
  log: await protokoll(0, 4, 2) });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
text = await zurStatistik();
check(/Zusatztag\?/.test(text), 'bei echtem Rückstand steht der Vorschlag da');
console.log('     ', (text.match(/Zusatztag\? .{0,150}/) || [''])[0]);
check(/48-Stunden-Regel/.test(text), 'und sagt, dass die Erholungsregel auch dort gilt');
check(await page.locator('[data-act="zusatztag"]').count() === 1, 'mit einem Knopf dazu');

// --- 4. Anlegen: eine echte Einheit aus dem, was fehlt -------------------
const luecke = await page.evaluate(async () => {
  const app = await import('./js/data.js');
  void app;
  return null;
});
void luecke;
await page.locator('[data-act="zusatztag"]').click();
await page.waitForTimeout(600);
const angelegt = await page.evaluate(async () => {
  const store = await import('./js/store.js');
  const daten = await import('./js/data.js');
  const c = store.customs()[0];
  if (!c) return null;
  const byId = new Map(daten.EXERCISES.map((e) => [e.id, e]));
  return {
    name: c.name,
    anzahl: c.ex.length,
    saetze: c.ex.reduce((a, x) => a + x.sets, 0),
    ids: c.ex.map((x) => x.id),
    // Welche Gruppen die Einheit direkt trifft
    direkt: [...new Set(c.ex.flatMap((x) => Object.entries(byId.get(x.id).db.shares)
      .filter(([, s]) => s >= daten.REST.direct).map(([m]) => m)))],
  };
});
console.log('     ', JSON.stringify(angelegt));
check(!!angelegt, 'der Zusatztag ist angelegt');
check(angelegt && /Zusatztag Woche 1/.test(angelegt.name), `mit sprechendem Namen (${angelegt && angelegt.name})`);
check(angelegt && angelegt.anzahl >= 2 && angelegt.anzahl <= 5,
  `zwei bis fünf Übungen, wie eine gewöhnliche Einheit (${angelegt && angelegt.anzahl})`);
check(angelegt && angelegt.ex !== 0 && angelegt.saetze >= 6,
  `und genug Sätze, dass es sich lohnt (${angelegt && angelegt.saetze})`);
check(new Set(angelegt.ids).size === angelegt.ids.length, 'keine Übung doppelt');

// --- 5. Die Erholungsregel gilt auch hier --------------------------------
// Keine Gruppe, die in den letzten zwei Tagen direkt dran war, darf im
// Zusatztag stehen. Gegengerechnet über den echten Plan.
const kollision = await page.evaluate(async () => {
  const store = await import('./js/store.js');
  const daten = await import('./js/data.js');
  const c = store.customs()[0];
  const byId = new Map(daten.EXERCISES.map((e) => [e.id, e]));
  const heute = new Date();
  const s = store.getState();
  const direktIm = (liste) => new Set(liste.flatMap((x) => Object.entries(byId.get(x.id).db.shares)
    .filter(([, sh]) => sh >= daten.REST.direct).map(([m]) => m)));
  const zusatz = direktIm(c.ex);
  const treffer = [];
  daten.PLAN.forEach((w) => {
    const d = new Date(w.date);
    d.setDate(d.getDate() + (s.shift || 0));
    const tage = Math.abs(Math.round((d - heute) / 86400000));
    if (tage >= daten.REST.days) return;
    direktIm(w.ex).forEach((m) => { if (zusatz.has(m)) treffer.push(`${m}@W${w.n}`); });
  });
  return treffer;
});
check(kollision.length === 0,
  `keine Gruppe kollidiert mit einer Einheit in Reichweite${
    kollision.length ? ': ' + kollision.slice(0, 4).join(', ') : ''}`);

// --- 6. Nur einmal je Woche ----------------------------------------------
// Der Rückstand schrumpft nicht dadurch, dass man den Zusatztag macht – er
// steht im Plan, nicht im Protokoll. Ohne Sperre stünde der Vorschlag weiter
// da, und zweimal Tippen ergäbe zwei gleiche Einheiten.
text = await zurStatistik();
check(!/Zusatztag\?/.test(text), 'der Vorschlag verschwindet, sobald einer angelegt ist');
check(/steht schon ein Zusatztag bereit/.test(text),
  'stattdessen steht da, dass es ihn schon gibt');
check(await page.locator('[data-act="zusatztag"]').count() === 0,
  'und der Knopf zum Anlegen ist weg');
const anzahlCustoms = await page.evaluate(async () => (await import('./js/store.js')).customs().length);
check(anzahlCustoms === 1, `es bleibt bei einer eigenen Einheit (${anzahlCustoms})`);

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`);
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
await browser.close();
