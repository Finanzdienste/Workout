/*
 * Alle Übungen, nach Muskelgruppen, einzeln an- und abwählbar.
 *
 *     „Mach bei den Einstellungen ne Übersicht in der man sich alle Übungen
 *      nach Muskelgruppen sortiert anzeigen lassen kann. Jede Übung soll man
 *      aktivieren und deaktivieren können. Der Plan soll sich natürlich
 *      entsprechend anpassen sodass man trotzdem alle Muskelgruppen optimal
 *      trainiert."
 *
 * Der zweite Satz ist der, der geprüft werden muss: Eine Abwahl darf keine
 * Lücke hinterlassen, wo der Katalog einen Ersatz kennt – und wo er keinen
 * kennt, muss die App das sagen, statt die Sätze still verschwinden zu lassen.
 */
import { chromium } from 'playwright';
import { URL, SHOT } from './umgebung.mjs';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } });
await ctx.route('**/rest/v1/**', (r) => r.fulfill({ status: 204, body: '' }));
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.setItem('workout.state.v1',
  JSON.stringify({ greeted: true, name: 'T', level: 'geuebt', mode: 'db' })));
await page.reload({ waitUntil: 'networkidle' });

const zurListe = async () => {
  await page.locator('.tab[data-tab="settings"]').click();
  await page.waitForTimeout(250);
  await page.locator('[data-act="go-tab"][data-tab="uebungen"]').click();
  await page.waitForTimeout(300);
};

// --- 1. Die Liste ist vollständig und nach Gruppen sortiert ---------------
await zurListe();
const zeilen = await page.locator('.ex-an').count();
const katalog = await page.evaluate(async () => (await import('./js/data.js')).EXERCISES.length);
console.log(`     ${zeilen} Zeilen für ${katalog} Katalogübungen`);
check(zeilen === katalog, `jede Übung des Katalogs steht genau einmal da (${zeilen}/${katalog})`);

const ueberschriften = await page.locator('.section-title').allTextContents();
console.log('     Gruppen:', ueberschriften.slice(1).join(' · '));
check(ueberschriften.length >= 8, `nach Muskelgruppen geteilt (${ueberschriften.length - 1} Gruppen)`);
// Die Gruppen der Statistik, nicht erfundene Überschriften: Wer hier sucht,
// sucht mit derselben Vokabel, die im Wochenvolumen steht.
const bekannt = await page.evaluate(async () => Object.values(
  (await import('./js/body.js')).MUSCLE_LABEL));
const fremde = ueberschriften.slice(1).filter((t) => !bekannt.includes(t.trim()));
check(fremde.length === 0, `alle Überschriften sind Muskelgruppen der App${
  fremde.length ? ': ' + fremde.join(', ') : ''}`);

// --- 2. Abwählen wirkt auf den Plan --------------------------------------
// Genommen wird eine Übung, die im Plan wirklich vorkommt – sonst prüft der
// Test eine Abwahl ohne Wirkung.
// Die häufigste Übung – aber nur unter denen, die in der *angezeigten* Einheit
// stehen. Prüfung 5 weiter unten liest den Hinweis auf dem Dashboard, und das
// zeigt die erste offene Einheit. Ohne diese Einschränkung hing der Test daran,
// dass die häufigste Übung des Plans zufällig auch in Einheit 1 vorkommt; beim
// ersten Neulauf war das nicht mehr so, und der Hinweis fehlte zu Recht.
const opfer = await page.evaluate(async () => {
  const { PLAN } = await import('./js/data.js');
  const zaehl = new Map();
  PLAN.forEach((w) => w.ex.forEach((it) => zaehl.set(it.id, (zaehl.get(it.id) || 0) + 1)));
  const heute = new Set(PLAN[0].ex.map((it) => it.id));
  const [id, n] = [...zaehl.entries()].filter(([x]) => heute.has(x))
    .sort((a, b) => b[1] - a[1])[0];
  return { id, n };
});
console.log(`     abgewählt wird ${opfer.id} (${opfer.n} Auftritte im Plan)`);

const vorher = await page.evaluate(async (id) => {
  const { PLAN } = await import('./js/data.js');
  const { exBasis } = await import('./js/plan.js');
  return PLAN.slice(0, 12).filter((w) => exBasis(w, 'db').some((x) => x.id === id)).length;
}, opfer.id);
check(vorher > 0, `sie steht in ${vorher} der ersten zwölf Einheiten`);

await page.locator(`[data-act="toggle-uebung"][data-ex="${opfer.id}"]`).click();
await page.waitForTimeout(400);
const nachher = await page.evaluate(async (id) => {
  const store = await import('./js/store.js');
  const { PLAN } = await import('./js/data.js');
  const { exBasis } = await import('./js/plan.js');
  return {
    aus: store.getState().ausUebungen || [],
    drin: PLAN.slice(0, 12).filter((w) => exBasis(w, 'db').some((x) => x.id === id)).length,
    laengen: PLAN.slice(0, 12).map((w) => exBasis(w, 'db').length),
  };
}, opfer.id);
check(nachher.aus.includes(opfer.id), 'die Abwahl steht im Zustand');
check(nachher.drin === 0, `und die Übung ist aus dem Plan verschwunden (${nachher.drin})`);

// Der Plan bleibt gleich lang: Es wird ersetzt, nicht gestrichen. Das ist der
// Unterschied zwischen „passt sich an" und „hat jetzt eine Lücke".
const ersatzDa = await page.evaluate(async (id) => {
  const { ersatzFuer } = await import('./js/vorrat.js');
  return !!ersatzFuer(id, 'db');
}, opfer.id);
console.log('     Ersatz im Katalog:', ersatzDa, '· Einheitslängen:', nachher.laengen.join(','));
if (ersatzDa) {
  check(nachher.laengen.every((n) => n > 0),
    'die Einheiten stehen weiter – ersetzt statt gestrichen');
}

// --- 3. Die Zeile sagt, was die Abwahl kostet ----------------------------
const folge = (await page.locator('.ex-an.aus .ex-an-folge').first().textContent())
  .replace(/\s+/g, ' ').trim();
console.log('     ' + folge);
check(/Der Plan nimmt stattdessen|Kein Ersatz im Katalog/.test(folge),
  'unter der abgewählten Übung steht, wodurch der Plan sie ersetzt');
check(await page.locator('.ex-an.aus').count() === 1, 'genau eine Zeile ist abgewählt');

// Und oben die Wochenbilanz, dieselbe wie beim Geräte-Vorrat.
const kopf = (await page.locator('.card').first().textContent()).replace(/\s+/g, ' ');
check(!/Alles angehakt/.test(kopf),
  'die Übersicht behauptet nicht mehr, der Plan liefe wie gerechnet');
await page.screenshot({ path: `${SHOT}/96-uebungsliste.png`, fullPage: true });

// --- 4. Wieder anwählen stellt alles zurück ------------------------------
await page.locator(`[data-act="toggle-uebung"][data-ex="${opfer.id}"]`).click();
await page.waitForTimeout(400);
const zurueck = await page.evaluate(async (id) => {
  const store = await import('./js/store.js');
  const { PLAN } = await import('./js/data.js');
  const { exBasis } = await import('./js/plan.js');
  return {
    aus: (store.getState().ausUebungen || []).length,
    drin: PLAN.slice(0, 12).filter((w) => exBasis(w, 'db').some((x) => x.id === id)).length,
  };
}, opfer.id);
check(zurueck.aus === 0 && zurueck.drin === vorher,
  `anwählen stellt sie zurück (${zurueck.drin} von ${vorher} Einheiten)`);

// --- 5. Im Training steht, warum heute etwas anderes dasteht -------------
await page.evaluate(async (id) => {
  const { setzeUebung } = await import('./js/vorrat.js');
  setzeUebung(id, false);
}, opfer.id);
await page.locator('.tab[data-tab="dashboard"]').click();
await page.waitForTimeout(300);
await page.locator('[data-act="show-list"]').click();
await page.waitForTimeout(300);
const hinweis = (await page.locator('#view').textContent()).replace(/\s+/g, ' ');
check(/abgewählt/.test(hinweis),
  'die Einheit sagt selbst, dass etwas abgewählt ist – kein stiller Tausch');

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`);
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
await browser.close();
