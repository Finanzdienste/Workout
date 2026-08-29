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

const zustand = () => page.evaluate(async () => {
  const store = await import('./js/store.js');
  const s = store.getState();
  return { hinweis: s.zusatztag, customs: store.customs().map((c) => c.name) };
});

// --- 1. Volle Woche: es passiert nichts ---------------------------------
await setze({ greeted: true, name: 'T', level: 'geuebt', shift: schiebe,
  log: await protokoll(0, 4, 0) });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);
let z = await zustand();
check(z.customs.length === 0, 'wer seine Woche gemacht hat, bekommt keinen Zusatztag');
check(!z.hinweis, 'und keinen Hinweis');

// --- 2. Woche läuft noch: auch nichts -----------------------------------
await setze({ greeted: true, name: 'T', level: 'geuebt', shift: 0,
  log: await protokoll(0, 2, 0) });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);
z = await zustand();
check(z.customs.length === 0,
  'solange die Woche läuft, wird nichts angelegt – da ist nichts versäumt');

// --- 3. Woche durch, Rückstand: der Zusatztag ist einfach da ------------
// Ungefragt, ohne Knopf. Das ist der Punkt: Wer erst suchen und drücken muss,
// bekommt keine Anpassung, sondern eine Hausaufgabe.
await setze({ greeted: true, name: 'T', level: 'geuebt', shift: schiebe,
  log: await protokoll(0, 4, 2) });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(600);
z = await zustand();
console.log('     ', JSON.stringify(z.hinweis));
check(z.customs.length === 1 && /Zusatztag Woche 1/.test(z.customs[0]),
  `der Zusatztag steht von selbst da (${z.customs.join(', ') || 'nichts'})`);
check(!!z.hinweis, 'mit einem Hinweis auf der Startseite');
const hinweis = (await page.locator('.notice.aufstieg').first().textContent()).replace(/\s+/g, ' ');
check(/Zusatztag angelegt/.test(hinweis), 'der sagt, was passiert ist');
check(/Erholung/.test(hinweis), 'und dass die Erholungsregel eingehalten ist');
check(await page.locator('[data-act="zusatztag-weg"]').count() === 1,
  'mit einem Weg, ihn loszuwerden');

// --- 4. Die Einheit selbst ----------------------------------------------
const angelegt = await page.evaluate(async () => {
  const store = await import('./js/store.js');
  const daten = await import('./js/data.js');
  const c = store.customs()[0];
  const byId = new Map(daten.EXERCISES.map((e) => [e.id, e]));
  return {
    anzahl: c.ex.length,
    saetze: c.ex.reduce((a, x) => a + x.sets, 0),
    ids: c.ex.map((x) => x.id),
  };
});
console.log('     ', JSON.stringify(angelegt));
check(angelegt.anzahl >= 2 && angelegt.anzahl <= 5,
  `zwei bis fünf Übungen, wie eine gewöhnliche Einheit (${angelegt.anzahl})`);
check(angelegt.saetze >= 6, `und genug Sätze, dass es sich lohnt (${angelegt.saetze})`);
check(new Set(angelegt.ids).size === angelegt.ids.length, 'keine Übung doppelt');

// --- 5. Die Erholungsregel gilt auch hier --------------------------------
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
    if (Math.abs(Math.round((d - heute) / 86400000)) >= daten.REST.days) return;
    direktIm(w.ex).forEach((m) => { if (zusatz.has(m)) treffer.push(`${m}@W${w.n}`); });
  });
  return treffer;
});
check(kollision.length === 0,
  `keine Gruppe kollidiert mit einer Einheit in Reichweite${
    kollision.length ? ': ' + kollision.slice(0, 4).join(', ') : ''}`);

// --- 6. Kein zweiter beim nächsten Laden --------------------------------
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);
z = await zustand();
check(z.customs.length === 1, `es bleibt bei einem (${z.customs.length})`);

// --- 7. „Brauch ich nicht" räumt ihn weg --------------------------------
await page.locator('.tab[data-tab="dashboard"]').click();
await page.waitForTimeout(300);
await page.locator('[data-act="zusatztag-weg"]').click();
await page.waitForTimeout(400);
z = await zustand();
check(z.customs.length === 0, 'weggetippt heißt weg');
check(!z.hinweis, 'und der Hinweis ist mit weg');
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(600);
z = await zustand();
check(z.customs.length === 0, 'auch nach dem Neuladen kommt er nicht wieder');

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`);
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
await browser.close();
