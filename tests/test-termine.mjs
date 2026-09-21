/*
 * Termine: Tage, an denen etwas anderes ansteht.
 *
 *     „dass man auswählen kann dass man an nem bestimmten Kalendertag was
 *      vorhat zb 02.06. Padel und dass man dadurch automatisch am Tag davor
 *      keine Beine trainiert"
 *
 * Geprüft wird beides: dass die richtigen Übungen wegfallen, und dass sie an
 * jedem anderen Tag stehen bleiben. Das zweite ist das wichtigere – ein Schalter,
 * der mehr wegnimmt als angekündigt, ist schlimmer als keiner.
 */
import { chromium } from 'playwright';
import { URL } from './umgebung.mjs';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } });
await ctx.route('**/rest/v1/**', (r) => r.fulfill({ status: 204, body: '' }));
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => {
  localStorage.removeItem('workout.rounds.v1');
  localStorage.setItem('workout.state.v1', JSON.stringify({
    greeted: true, name: 'T', level: 'geuebt', shift: 0, log: {}, termine: [],
  }));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);

// --- 1. Welche Einheit trifft die Beine? --------------------------------
const lage = await page.evaluate(async () => {
  const { PLAN } = await import('./js/data.js');
  const { effDate } = await import('./js/plan.js');
  const { directOf } = await import('./js/uebung.js');
  const BEINE = ['quads', 'hamstringsKnee', 'hamstringsHip', 'glutes', 'calves'];
  const treffer = PLAN.find((w) => w.ex.some((it) => directOf(it.id).some((m) => BEINE.includes(m))));
  return { n: treffer.n, datum: effDate(treffer),
           beine: treffer.ex.filter((it) => directOf(it.id).some((m) => BEINE.includes(m)))
             .map((it) => it.id),
           andere: treffer.ex.filter((it) => !directOf(it.id).some((m) => BEINE.includes(m)))
             .map((it) => it.id) };
});
console.log('     Einheit', lage.n, 'am', lage.datum, '· Beine:', lage.beine.join(', '));
check(lage.beine.length > 0, 'es gibt eine Einheit mit Beinarbeit');

// --- 2. Termin am Tag danach: die Beine fallen weg ----------------------
const wirkung = await page.evaluate(async (l) => {
  const store = await import('./js/store.js');
  const { addDays } = await import('./js/dates.js');
  const { exOf, injuryNotes } = await import('./js/plan.js');
  const { PLAN } = await import('./js/data.js');
  const w = PLAN.find((x) => x.n === l.n);
  store.setSetting('termine', [{ datum: addDays(l.datum, 1), name: 'Padel', schont: 'beine' }]);
  const notiz = injuryNotes(l.n);
  return { ids: exOf(w, 'db').map((it) => it.id), weg: notiz.dropped.map((d) => d.id),
           grund: notiz.dropped.map((d) => d.reason), namen: notiz.termin };
}, lage);
console.log('     nach dem Eintrag:', JSON.stringify(wirkung));
check(lage.beine.every((id) => !wirkung.ids.includes(id)),
  `die Beinübungen stehen nicht mehr in der Einheit (${wirkung.ids.join(', ')})`);
check(lage.andere.every((id) => wirkung.ids.includes(id)),
  'alles andere bleibt stehen – der Termin nimmt nicht mehr weg als angekündigt');
check(wirkung.grund.every((g) => g === 'termin'), 'der Grund steht dabei');
check(wirkung.namen.includes('Padel'), 'und der Name des Termins');

// --- 3. Zwei Tage vorher gilt er nicht ----------------------------------
const vorher = await page.evaluate(async (l) => {
  const store = await import('./js/store.js');
  const { addDays } = await import('./js/dates.js');
  const { exOf } = await import('./js/plan.js');
  const { PLAN } = await import('./js/data.js');
  store.setSetting('termine', [{ datum: addDays(l.datum, 2), name: 'Padel', schont: 'beine' }]);
  return exOf(PLAN.find((x) => x.n === l.n), 'db').map((it) => it.id);
}, lage);
check(lage.beine.every((id) => vorher.includes(id)),
  'zwei Tage vorher ändert sich nichts – der Muskelkater ist bis dahin durch');

// --- 4. Am Termintag selbst gilt er auch --------------------------------
const amTag = await page.evaluate(async (l) => {
  const store = await import('./js/store.js');
  const { exOf } = await import('./js/plan.js');
  const { PLAN } = await import('./js/data.js');
  store.setSetting('termine', [{ datum: l.datum, name: 'Padel', schont: 'beine' }]);
  return exOf(PLAN.find((x) => x.n === l.n), 'db').map((it) => it.id);
}, lage);
check(lage.beine.every((id) => !amTag.includes(id)), 'am Termintag selbst ebenfalls');

// --- 4b. Und der Tag danach ---------------------------------------------
//
//     „Ich hab gestern 1,5h padel gemacht. … Oder spielt padel gestern keinen
//      Einfluss auf Workout heute?"
//
// Bis v180 spielte er keinen: Ein Termin schützte den Wettkampf vor dem
// Training, aber nicht das Training vor dem Wettkampf. Der Muskelkater läuft
// aber in beide Richtungen – sein Maximum liegt 24 bis 48 Stunden *nach* der
// Belastung, und das ist nach 1,5 Stunden Abbremsen und Richtungswechsel
// genau der Tag, an dem die Kniebeuge anstünde.
const danach = await page.evaluate(async (l) => {
  const store = await import('./js/store.js');
  const { addDays } = await import('./js/dates.js');
  const { exOf, injuryNotes } = await import('./js/plan.js');
  const { PLAN } = await import('./js/data.js');
  store.setSetting('termine', [{ datum: addDays(l.datum, -1), name: 'Padel', schont: 'beine' }]);
  return { ids: exOf(PLAN.find((x) => x.n === l.n), 'db').map((it) => it.id),
           namen: injuryNotes(l.n).termin };
}, lage);
check(lage.beine.every((id) => !danach.ids.includes(id)),
  `einen Tag nach dem Termin fallen die Beine ebenfalls weg (${danach.ids.join(', ')})`);
check(lage.andere.every((id) => danach.ids.includes(id)),
  'und auch hier bleibt alles andere stehen');
check(danach.namen.includes('Padel'), 'mit dem Namen des Termins in der Begründung');

// Zwei Tage danach aber nicht mehr – sonst kostet ein Termin eine halbe Woche.
const zweiDanach = await page.evaluate(async (l) => {
  const store = await import('./js/store.js');
  const { addDays } = await import('./js/dates.js');
  const { exOf } = await import('./js/plan.js');
  const { PLAN } = await import('./js/data.js');
  store.setSetting('termine', [{ datum: addDays(l.datum, -2), name: 'Padel', schont: 'beine' }]);
  return exOf(PLAN.find((x) => x.n === l.n), 'db').map((it) => it.id);
}, lage);
check(lage.beine.every((id) => zweiDanach.includes(id)),
  'zwei Tage danach steht die Einheit wieder vollständig da');

// --- 5. Oberkörper schont nicht die Beine -------------------------------
const oben = await page.evaluate(async (l) => {
  const store = await import('./js/store.js');
  const { exOf } = await import('./js/plan.js');
  const { PLAN } = await import('./js/data.js');
  store.setSetting('termine', [{ datum: l.datum, name: 'Klettern', schont: 'oberkoerper' }]);
  return exOf(PLAN.find((x) => x.n === l.n), 'db').map((it) => it.id);
}, lage);
check(lage.beine.every((id) => oben.includes(id)),
  'ein Oberkörper-Termin lässt die Beine in Ruhe');

// --- 6. Ohne Termin ist alles wie vorher --------------------------------
const ohne = await page.evaluate(async (l) => {
  const store = await import('./js/store.js');
  const { exOf } = await import('./js/plan.js');
  const { PLAN } = await import('./js/data.js');
  store.setSetting('termine', []);
  return exOf(PLAN.find((x) => x.n === l.n), 'db').map((it) => it.id);
}, lage);
check(lage.beine.every((id) => ohne.includes(id)) && lage.andere.every((id) => ohne.includes(id)),
  'ohne Termin steht die Einheit unverändert da');

// --- 7. Die Bedienung ---------------------------------------------------
await page.locator('.tab[data-tab="settings"]').click();
await page.waitForTimeout(300);
const text = () => page.locator('#view').textContent().then((t) => t.replace(/\s+/g, ' '));
check(/Termine/.test(await text()), 'der Abschnitt steht unter Mehr');
check(/Tag davor/.test(await text()), 'und sagt, dass der Tag davor gemeint ist');
check(/Tag danach/.test(await text()), 'und der Tag danach auch');
check(/unter ihrem Ziel/.test(await text()),
  'und dass die Woche dafür unter ihrem Ziel liegt – der Preis steht dabei');

// Nachtragen muss gehen: Wer gestern gespielt hat, will es heute eintragen.
// Das Feld hatte min=heute und nahm ein vergangenes Datum gar nicht erst an.
const gestern = await page.evaluate(async () => {
  const { todayISO, addDays } = await import('./js/dates.js');
  return addDays(todayISO(), -1);
});
const minWert = await page.locator('#terminDatum').getAttribute('min');
check(minWert < gestern, `gestern liegt im erlaubten Bereich (min=${minWert})`);
await page.locator('#terminDatum').fill(gestern);
await page.locator('#terminName').fill('Padel');
await page.locator('[data-act="termin-neu"]').click();
await page.waitForTimeout(400);
const nachtrag = await page.evaluate(() =>
  JSON.parse(localStorage.getItem('workout.state.v1')).termine);
check(nachtrag.length === 1 && nachtrag[0].datum === gestern,
  `ein vergangener Tag lässt sich nachtragen (${JSON.stringify(nachtrag)})`);
// Und er steht nicht als „vorbei" da, solange er die heutige Einheit kürzt.
// Gelesen wird die Zeile des Termins und nicht die ganze Ansicht – weiter
// unten steht der Ton „Pause vorbei", und der hat damit nichts zu tun.
const zeile = (await page.locator('[data-act="termin-weg"]').first()
  .locator('xpath=../div').textContent()).replace(/\s+/g, ' ');
console.log('     Zeile:', zeile.trim());
check(/wirkt noch heute/.test(zeile) && !/vorbei/.test(zeile),
  `und gilt als wirksam, nicht als vorbei (${zeile.trim()})`);
await page.locator('[data-act="termin-weg"]').first().click();
await page.waitForTimeout(400);

await page.locator('#terminDatum').fill('2027-06-02');
await page.locator('#terminName').fill('Padel');
await page.locator('[data-act="termin-neu"]').click();
await page.waitForTimeout(400);
const nachKlick = await page.evaluate(() =>
  JSON.parse(localStorage.getItem('workout.state.v1')).termine);
console.log('     eingetragen:', JSON.stringify(nachKlick));
check(nachKlick.length === 1 && nachKlick[0].datum === '2027-06-02' && nachKlick[0].name === 'Padel',
  'der Knopf trägt ihn ein');
// Stand beim ersten Lauf nicht drin: ui.terminArt war undefiniert, das Feld fiel
// beim Speichern weg, und es wirkte nur, weil überall auf „Beine" zurückgefallen
// wird. Ein Feld, das aus Versehen fehlt, ist kein Verhalten.
check(nachKlick[0].schont === 'beine', `mit dem gewählten Korb (${nachKlick[0].schont})`);
check(/Padel/.test(await text()), 'und er steht danach in der Liste');

await page.locator('[data-act="termin-weg"]').first().click();
await page.waitForTimeout(400);
const nachWeg = await page.evaluate(() =>
  JSON.parse(localStorage.getItem('workout.state.v1')).termine);
check(nachWeg.length === 0, 'und „Entfernen" nimmt ihn wieder heraus');

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`);
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
await browser.close();
