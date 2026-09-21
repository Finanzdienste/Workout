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
 *
 * Die Abschnitte 2 bis 6 arbeiten bewusst weiter mit der **alten** Form
 * `{ schont: 'beine' }`. Seit v182 trägt ein Eintrag eine Aktivität aus dem
 * Katalog, aber im Speicher eines Geräts, das länger nicht aktualisiert hat,
 * steht noch die alte – und die soll weiter wirken, statt stillschweigend zu
 * verschwinden. Was der Katalog kann, prüft tests/test-aktivitaeten.mjs; wie
 * beides zusammenkommt, Abschnitt 8.
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

// --- 7. Die Bedienung: was, wann, fertig --------------------------------
//
//     „Ich will das nicht selbst anklicken müssen. … Ich will nur sagen was
//      ich an welchem tag gemacht hab. Der Rest soll automatisch passieren"
//
// Drei Körbe zum Selbstauswählen gibt es nicht mehr. Die Eingabe ist: Tag
// antippen, Aktivität antippen, eintragen – die Dauer steht schon mit dem
// üblichen Wert da. Geprüft wird genau dieser Weg.
await page.evaluate(async () => (await import('./js/store.js')).setSetting('termine', []));
await page.locator('.tab[data-tab="settings"]').click();
await page.waitForTimeout(400);
const text = () => page.locator('#view').textContent().then((t) => t.replace(/\s+/g, ' '));
check(/Sport außerhalb des Plans/.test(await text()), 'der Abschnitt steht unter Mehr');
check(await page.locator('[data-act="termin-art"]').count() === 0,
  'die drei Körbe sind weg – die Aktivität sagt selbst, was sie trifft');

// Der Tag: drei Knöpfe für die drei Fälle, die fast immer reichen.
const tage = await page.locator('[data-act="termin-tag"]').allTextContents();
console.log('     Tag-Knöpfe:', tage.join(' · '));
check(tage.length === 3 && /Gestern/.test(tage.join(' ')),
  'Heute, Gestern, Vorgestern stehen als Knopf da');

// Die Suche filtert, ohne den Fokus zu verlieren – sonst tippt man einmal und
// muss danach jedes Zeichen neu anklicken.
await page.locator('#terminSuche').fill('pad');
await page.waitForTimeout(250);
const treffer = await page.locator('[data-act="termin-akt"]').allTextContents();
console.log('     Treffer für "pad":', treffer.join(' · '));
check(treffer.includes('Padel'), 'die Suche findet Padel');
check(treffer.length < 6, `und zeigt nicht den ganzen Katalog (${treffer.length})`);
check(await page.evaluate(() => document.activeElement && document.activeElement.id) === 'terminSuche',
  'das Suchfeld behält dabei den Fokus');

// Auswählen: Vorschau und Dauer erscheinen, die Dauer ist vorbelegt.
await page.locator('[data-act="termin-akt"][data-v="padel"]').click();
await page.waitForTimeout(300);
check(await page.locator('[data-act="termin-dauer"][aria-pressed="true"]').count() === 1,
  'eine Dauer ist vorausgewählt – man muss sie nicht antippen');
const vorschau = (await page.locator('.akt-vorschau').textContent()).replace(/\s+/g, ' ');
console.log('     Vorschau:', vorschau.trim().slice(0, 150));
check(/Das fällt dann aus/.test(vorschau) && /Oberschenkel/.test(vorschau),
  'die Vorschau sagt vor dem Eintragen, welche Gruppen ausfallen');
check(/Abbremsen/.test(vorschau), 'und warum gerade diese – der Satz aus dem Katalog steht dabei');

// Gestern eintragen, der Fall aus dem Zitat.
await page.locator('[data-act="termin-tag"]').nth(1).click();
await page.waitForTimeout(250);
await page.locator('[data-act="termin-neu"]').click();
await page.waitForTimeout(400);
const gestern = await page.evaluate(async () => {
  const { todayISO, addDays } = await import('./js/dates.js');
  return addDays(todayISO(), -1);
});
const eintrag = await page.evaluate(() =>
  JSON.parse(localStorage.getItem('workout.state.v1')).termine);
console.log('     eingetragen:', JSON.stringify(eintrag));
check(eintrag.length === 1 && eintrag[0].datum === gestern,
  'der Eintrag steht auf gestern');
check(eintrag[0].aktivitaet === 'padel' && eintrag[0].minuten === 90,
  `mit Aktivität und Dauer (${eintrag[0].aktivitaet}, ${eintrag[0].minuten} min)`);

// Und er gilt als wirksam, nicht als vorbei. Gelesen wird die Zeile des
// Eintrags und nicht die ganze Ansicht – weiter unten steht der Ton „Pause
// vorbei", und der hat damit nichts zu tun.
const zeile = (await page.locator('[data-act="termin-weg"]').first()
  .locator('xpath=../div').textContent()).replace(/\s+/g, ' ');
console.log('     Zeile:', zeile.trim());
check(/wirkt noch/.test(zeile) && !/vorbei/.test(zeile),
  `gestern gilt als wirksam, nicht als vorbei (${zeile.trim()})`);

// --- 8. Und das Ergebnis im Plan ---------------------------------------
const heuteWeg = await page.evaluate(async () => {
  const { PLAN } = await import('./js/data.js');
  const { effDate, exOf, injuryNotes } = await import('./js/plan.js');
  const { todayISO } = await import('./js/dates.js');
  const heute = todayISO();
  const w = PLAN.find((x) => effDate(x) === heute) || PLAN[0];
  return { n: w.n, ids: exOf(w, 'db').map((it) => it.id),
           weg: injuryNotes(w.n).dropped.map((d) => d.id),
           namen: injuryNotes(w.n).termin };
});
console.log('     heute:', JSON.stringify(heuteWeg));
check(heuteWeg.namen.length === 0 || heuteWeg.namen.includes('Padel'),
  'wenn heute etwas ausfällt, dann wegen Padel');

await page.locator('[data-act="termin-weg"]').first().click();
await page.waitForTimeout(400);
const nachWeg = await page.evaluate(() =>
  JSON.parse(localStorage.getItem('workout.state.v1')).termine);
check(nachWeg.length === 0, 'und „Entfernen" nimmt ihn wieder heraus');

// --- 9. Alte Einträge wirken weiter -------------------------------------
//
// Auf einem Gerät, das länger nicht aktualisiert hat, steht die alte Form im
// Speicher. Sie darf nicht stillschweigend aufhören zu wirken.
const alt = await page.evaluate(async (l) => {
  const store = await import('./js/store.js');
  const { exOf } = await import('./js/plan.js');
  const { PLAN } = await import('./js/data.js');
  store.setSetting('termine', [{ datum: l.datum, name: 'Altes Padel', schont: 'beine' }]);
  return exOf(PLAN.find((x) => x.n === l.n), 'db').map((it) => it.id);
}, lage);
check(lage.beine.every((id) => !alt.includes(id)),
  'ein Eintrag in der alten Form schont weiterhin die Beine');
await page.locator('.tab[data-tab="settings"]').click();
await page.waitForTimeout(300);
check(/Altes Padel/.test(await text()), 'und steht weiter in der Liste');

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`);
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
await browser.close();
