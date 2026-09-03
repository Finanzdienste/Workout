/*
 * Der Verlauf – und die eine Unterscheidung, an der er hängt.
 *
 * Ein Tag ohne Beschwerden und ein Tag ohne Eintragung sehen in einer
 * Statistik gleich aus, wenn man sie gleich behandelt: beide null. Sie sind
 * aber das Gegenteil voneinander, und die Lücken häufen sich ausgerechnet in
 * den Wochen, in denen es jemandem zu schlecht ging, um etwas einzutragen. Wer
 * das zusammenwirft, baut eine App, die genau dann Besserung meldet.
 */
import { chromium } from 'playwright';
import { URL, KEY, HANDY, SHOT, vorTagen, pruefer } from './umgebung.mjs';

const { check, ende } = pruefer();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: HANDY });
const fehler = [];
page.on('pageerror', (e) => fehler.push(`PAGEERROR: ${e.message}`));

const heute = vorTagen(0);
const gestern = vorTagen(1);
const vorgestern = vorTagen(2);
const lueckeTag = vorTagen(3);
const schlimm = vorTagen(4);

const eintraege = [
  // heute und gestern: eingetragen, beschwerdefrei
  { id: 'a', am: heute, um: '08:00', art: 'essen', was: 'Haferbrei', tags: [], portion: 'normal' },
  { id: 'b', am: gestern, um: '08:00', art: 'essen', was: 'Haferbrei', tags: [], portion: 'normal' },
  // vorgestern: leichte Beschwerden
  { id: 'c', am: vorgestern, um: '12:00', art: 'essen', was: 'Nudeln', tags: [], portion: 'normal' },
  { id: 'd', am: vorgestern, um: '14:00', art: 'beschwerde', staerke: 2, arten: ['druck'] },
  // vor drei Tagen: nichts – die Lücke
  // vor vier Tagen: ein schlechter Tag
  { id: 'e', am: schlimm, um: '19:00', art: 'essen', was: 'Pizza', tags: ['fett'], portion: 'gross' },
  { id: 'f', am: schlimm, um: '21:00', art: 'beschwerde', staerke: 9, arten: ['brennen'] },
];

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(([k, s]) => localStorage.setItem(k, JSON.stringify(s)),
  [KEY, { eintraege, tage: {}, begruesst: true, tab: 'verlauf' }]);
await page.reload({ waitUntil: 'networkidle' });

/* ---------- Kacheln ---------- */

const kacheln = await page.locator('.kachel').allTextContents();
check(kacheln[0].startsWith('4'), `vier notierte Tage, nicht dreißig (${kacheln[0]})`);
check(kacheln[1].includes('50 %'), `zwei von vier Tagen mit Beschwerden = 50 % (${kacheln[1]})`);
check(kacheln[3].startsWith('2'), `zwei beschwerdefreie Tage in Folge (${kacheln[3]})`);

/* ---------- Der Balken ---------- */

const balken = await page.locator('.tafel svg rect').count();
check(balken === 30, `dreißig Tage, dreißig Balken (${balken})`);
const beschriftung = await page.locator('.tafel svg title').allTextContents();
check(
  beschriftung.filter((t) => t.includes('nichts eingetragen')).length === 26,
  'sechsundzwanzig davon sind als „nichts eingetragen" beschriftet – die Lücke\n'
  + '   zwischen den Eintragungen ebenso wie die Wochen davor',
);
check(
  beschriftung.some((t) => t.includes('beschwerdefrei')),
  'und der beschwerdefreie Tag heißt beschwerdefrei, nicht null',
);

/* ---------- Der Monatskalender ---------- */

const heuteFeld = page.locator(`.rfeld[data-iso="${heute}"]`);
check(await heuteFeld.count() === 1, 'der heutige Tag steht im Kalender');
check((await heuteFeld.getAttribute('class')).includes('f-gut'), 'als guter Tag');
check((await heuteFeld.getAttribute('class')).includes('heute'), 'und ist als heute markiert');

const schlimmFeld = page.locator(`.rfeld[data-iso="${schlimm}"]`);
if (await schlimmFeld.count()) {
  check((await schlimmFeld.getAttribute('class')).includes('f-schlecht'), 'der schlechte Tag ist rot');
  const lueckeFeld = page.locator(`.rfeld[data-iso="${lueckeTag}"]`);
  check((await lueckeFeld.getAttribute('class')).includes('f-leer'), 'die Lücke bleibt leer und wird nicht grün');
} else {
  // Am Monatsanfang liegen die älteren Tage im Vormonat – dann eine Seite
  // zurückblättern, statt den Test zu überspringen.
  await page.locator('[data-act="monat-blaettern"][data-d="-1"]').click();
  await page.waitForTimeout(200);
  check(
    (await page.locator(`.rfeld[data-iso="${schlimm}"]`).getAttribute('class')).includes('f-schlecht'),
    'der schlechte Tag ist rot (im Vormonat)',
  );
  check(
    (await page.locator(`.rfeld[data-iso="${lueckeTag}"]`).getAttribute('class')).includes('f-leer'),
    'die Lücke bleibt leer und wird nicht grün',
  );
  await page.locator('[data-act="monat-blaettern"][data-d="1"]').click();
  await page.waitForTimeout(200);
}

/* ---------- Ein Tag lässt sich anspringen ---------- */

await page.locator(`.rfeld[data-iso="${gestern}"]`).click();
await page.waitForTimeout(250);
check(
  (await page.locator('.tagkopf h2').textContent()).trim() === 'gestern',
  'ein Tippen auf den Kalendertag führt zu diesem Tag',
);
check(await page.locator('.strang-zeile').count() === 1, 'mit seinem Eintrag');

/* ---------- Zeitraum umstellen ---------- */

await page.locator('[data-act="tab"][data-tab="verlauf"]').click();
await page.waitForTimeout(200);
await page.locator('[data-act="zeitraum"][data-n="14"]').click();
await page.waitForTimeout(200);
check(await page.locator('.tafel svg rect').count() === 14, 'vierzehn Tage, vierzehn Balken');

await page.screenshot({ path: `${SHOT}/40-verlauf.png` });
check(fehler.length === 0, `keine Fehler${fehler.length ? `: ${fehler.join(' | ')}` : ''}`);
await browser.close();
ende();
