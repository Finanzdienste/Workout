/*
 * Termine wieder austragen.
 *
 * Die Gegenrichtung zum Export, und sie braucht kein Konto: Weil jeder Termin
 * seine feste Kennung `workout-<n>@workout.local` trägt, genügt eine Datei aus
 * lauter Absagen. Der Kalender ordnet sie über die Kennung zu und räumt sie weg.
 *
 * Drei Dinge müssen dafür stimmen, und jedes einzelne entscheidet, ob die
 * Termine wirklich verschwinden oder nur doppelt dastehen:
 *
 *   – Die Datei enthält *keinen* neuen Termin, sonst legt der Import ihn an.
 *   – Jede Absage trägt dieselbe Kennung wie der Termin, den sie meint.
 *   – SEQUENCE liegt über jedem bisherigen Export, sonst gewinnt die ältere
 *     Fassung und der Kalender ignoriert die Absage.
 */
import { chromium } from 'playwright';
import { URL } from './umgebung.mjs';

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 414, height: 896 }, acceptDownloads: true,
});
await ctx.route('**/rest/v1/**', (r) => r.fulfill({ status: 204, body: '' }));
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
page.on('dialog', (d) => d.accept().catch(() => {}));
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

const hole = async (act) => {
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.locator(`[data-act="${act}"]`).first().click(),
  ]);
  const strom = await dl.createReadStream();
  let text = '';
  for await (const stueck of strom) text += stueck;
  return { text, name: dl.suggestedFilename() };
};

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.setItem('workout.state.v1',
  JSON.stringify({ greeted: true, name: 'T' })));
await page.reload({ waitUntil: 'networkidle' });
await page.locator('.tab[data-tab="settings"]').click();
await page.waitForTimeout(400);

// --- Erst normal exportieren, damit es etwas auszutragen gibt -----------
const exportiert = await hole('download-ics');
const termine = [...exportiert.text.matchAll(/UID:(workout-\d+@workout\.local)/g)].map((m) => m[1]);
const seqExport = Math.max(...[...exportiert.text.matchAll(/SEQUENCE:(\d+)/g)].map((m) => Number(m[1])));
check(termine.length > 50, `der Export enthält ${termine.length} Termine`);
check(!/STATUS:CANCELLED/.test(exportiert.text), 'und keine einzige Absage');

// --- Jetzt austragen ---------------------------------------------------
await page.waitForTimeout(300);
const aus = await hole('ics-aus');
const bloecke = aus.text.split('BEGIN:VEVENT').slice(1);
const abgesagt = bloecke.filter((b) => /STATUS:CANCELLED/.test(b));

check(/austragen/.test(aus.name), `die Datei heißt danach (${aus.name})`);
check(bloecke.length > 0 && abgesagt.length === bloecke.length,
  `alle ${bloecke.length} Einträge sind Absagen – kein einziger neuer Termin`);

// Jede exportierte Kennung muss abgesagt werden, sonst bleibt sie stehen.
const ausUIDs = new Set([...aus.text.matchAll(/UID:(workout-\d+@workout\.local)/g)].map((m) => m[1]));
const vergessen = termine.filter((u) => !ausUIDs.has(u));
check(vergessen.length === 0,
  `jede exportierte Kennung wird abgesagt${vergessen.length ? ': fehlt ' + vergessen.slice(0, 3).join(', ') : ''}`);

// Und darüber hinaus die Nummern der anderen Fokus-Varianten – und die der
// abgeschafften. Abgesagt wird nach Terminnummer, und im Kalender steht, was
// *jemals* exportiert wurde: „Kurz und knapp" hatte 96 Einheiten und gibt es
// nicht mehr. Nähme die App die höchste Zahl der heutigen Pläne (84), blieben
// zwölf Termine für immer stehen. Eine Absage für einen Termin, den es nie
// gab, kostet dagegen nichts – die Zahl darf nur steigen, nie fallen.
const heuteGroesste = await page.evaluate(async () => {
  const { PLANS } = await import('./js/data.js');
  return Math.max(...Object.values(PLANS).map((v) => v.plan.length));
});
check(ausUIDs.size >= heuteGroesste,
  `abgesagt wird mindestens die größte Einheitenzahl von heute (${ausUIDs.size} ≥ ${heuteGroesste})`);
check(ausUIDs.size >= 96,
  `und die 96 des abgeschafften „Kurz und knapp" ebenfalls (${ausUIDs.size})`);

// SEQUENCE muss jeden bisherigen Export schlagen.
const seqAus = Math.min(...[...aus.text.matchAll(/SEQUENCE:(\d+)/g)].map((m) => Number(m[1])));
check(seqAus > seqExport,
  `die Absagen haben die höhere Fassungsnummer (${seqAus} > ${seqExport})`);

// --- Der Plan in der App bleibt unangetastet ---------------------------
const nachher = await page.evaluate(async () => {
  const s = await import('./js/store.js');
  const { PLAN } = await import('./js/data.js');
  return { einheiten: PLAN.length, ics: s.getState().lastIcs };
});
check(nachher.einheiten > 50, `der Plan steht weiterhin mit ${nachher.einheiten} Einheiten`);
check(nachher.ics && nachher.ics.count === 0,
  'die App merkt sich, dass im Kalender jetzt nichts mehr steht');

// --- Zweimal austragen bleibt gültig -----------------------------------
// Wer es doppelt macht, darf keine Datei bekommen, die der Kalender wegen
// gleicher Fassungsnummer ignoriert.
await page.waitForTimeout(300);
const zweite = await hole('ics-aus');
const seqZwei = Math.min(...[...zweite.text.matchAll(/SEQUENCE:(\d+)/g)].map((m) => Number(m[1])));
check(seqZwei > seqAus, `ein zweiter Versuch zählt weiter hoch (${seqZwei} > ${seqAus})`);

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.join(' | ') : ''}`);
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
await browser.close();
