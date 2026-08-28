/* Kalender-Tab: wann trainiert, wann geplant, welche Übungen, welcher Modus. */
import { chromium } from 'playwright';
import { URL, SHOT } from './umgebung.mjs';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 414, height: 896 } });
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };
// Kalender und Verletzungen haben keinen eigenen Reiter mehr – sie liegen unter
// Mehr. Der Weg dorthin ist zwei Tipps lang und wird hier gekapselt.
const cal = () => page.locator('[data-act="go-tab"][data-tab="calendar"]');
const zumKalender = async () => {
  await page.locator('.tab[data-tab="settings"]').click();
  await page.waitForTimeout(150);
  await cal().click();
  await page.waitForTimeout(150);
};

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('workout.state.v1', '{"greeted":true}'); });
await page.reload({ waitUntil: 'networkidle' });

await page.locator('.tab[data-tab="settings"]').click();
await page.waitForTimeout(200);
check(await cal().count() === 1, 'Kalender steht unter Mehr');
await zumKalender();
await page.waitForTimeout(300);

// --- Raster ---
const zellen = await page.locator('.cal-cell').count();
check(zellen % 7 === 0, `ganze Wochen im Raster (${zellen} Zellen)`);
check(await page.locator('.cal-head div').count() === 7, 'sieben Spaltenköpfe');
check((await page.locator('.cal-head div').first().textContent()) === 'Mo', 'Woche beginnt am Montag');
const quadrat = await page.locator('.cal-cell').first().boundingBox();
check(Math.abs(quadrat.width - quadrat.height) < 2, `Zellen sind quadratisch (${Math.round(quadrat.width)}×${Math.round(quadrat.height)})`);

// Ohne Verlauf ist alles geplant, nichts trainiert
check(await page.locator('.cal-cell.done').count() === 0, 'ohne Verlauf nichts als trainiert markiert');
check(await page.locator('.cal-cell.plan').count() > 0, 'geplante Tage markiert');
check(await page.locator('.cal-cell.today').count() === 1, 'heute hervorgehoben');
check((await page.locator('#view').textContent()).includes('Kein Training an diesem Tag'),
  'ohne Auswahl ein Hinweis statt einer leeren Karte');
await page.screenshot({ path: `${SHOT}/cal-leer.png`, fullPage: true });

// --- Monatswechsel ---
const titel = () => page.locator('.cal-title').textContent();
const start = await titel();
await page.locator('[data-act="cal-month"][data-d="1"]').click();
await page.waitForTimeout(150);
const weiter = await titel();
check(weiter !== start, `ein Monat weiter (${start} -> ${weiter})`);
check(await page.locator('[data-act="cal-today"]').count() === 1, '"Zu heute" erscheint außerhalb des aktuellen Monats');
await page.locator('[data-act="cal-today"]').click();
await page.waitForTimeout(150);
check(await page.locator('[data-act="cal-today"]').count() === 0, 'im aktuellen Monat verschwindet der Knopf wieder');

// Über die Jahresgrenze zurück und wieder vor
await page.locator('[data-act="cal-month"][data-d="-1"]').click();
await page.waitForTimeout(120);
const zurueck = await titel();
check(zurueck !== start, `ein Monat zurück (${zurueck})`);

// --- Zwei Einheiten abschließen, eine mit Hanteln, eine ohne ---
await page.evaluate(async () => {
  const store = await import('./js/store.js');
  const { PLAN } = await import('./js/data.js');
  store.completeWorkout(PLAN[0].n, 'db', PLAN[0].ex.map((x) => ({ id: x.id, sets: x.sets })));
  store.completeWorkout(PLAN[1].n, 'bw', PLAN[1].ex.map((x) => ({ id: x.id, sets: x.sets })));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);

// Nach dem Neuladen steht der Kalender beim Monat der *nächsten offenen*
// Einheit – so ist er gedacht (calMonthNow()), und das ist nicht zwangsläufig
// der Monat, in dem gerade trainiert wurde: Liegen die ersten Einheiten am
// Monatsende, ist die dritte schon im nächsten. Der Test hat das lange nicht
// gemerkt, weil er zufällig in Monatsmitte lief; als der Plan an den 24. eines
// Monats rückte, stand er plötzlich einen Monat zu weit und fand keinen
// einzigen trainierten Tag. Also hinblättern statt hoffen.
// Die trainierten Einheiten sind die ersten des Plans, liegen also nie *nach*
// dem gezeigten Monat – zurückblättern genügt, und zwei Schritte reichen immer.
for (let i = 0; i < 3 && !(await page.locator('.cal-cell.done').count()); i++) {
  await page.locator('[data-act="cal-month"][data-d="-1"]').click();
  await page.waitForTimeout(150);
}
console.log('     Monat der ersten Einheiten:', (await page.locator('.cal-title').textContent()).trim());
check(await page.locator('.cal-cell.done').count() >= 1, 'trainierte Tage sind markiert');
const zusammen = (await page.locator('#view').textContent()).replace(/\s+/g, ' ');
console.log('     Zusammenfassung:', zusammen.match(/\d+ Einheiten? in diesem Monat[^Z]*/)?.[0]?.trim());
check(/2 trainiert/.test(zusammen), 'Zusammenfassung zählt beide Einheiten');
check(/🏋️ 1/.test(zusammen) && /🤸 1/.test(zusammen), 'Hanteln und Bodyweight getrennt gezählt');

// --- Tag antippen: Übungen und Modus ---
await page.locator('.cal-cell.done').first().click();
await page.waitForTimeout(250);
const karten = await page.locator('.cal-detail').count();
check(karten >= 1, `Detailkarte erscheint (${karten})`);
const ersteKarte = page.locator('.cal-detail').first();
check((await ersteKarte.textContent()).includes('trainiert'), 'Karte weist die Einheit als trainiert aus');
const zeilen = await ersteKarte.locator('.cal-list li').count();
const geplant = await page.evaluate(async () => (await import('./js/data.js')).PLAN[0].ex.length);
check(zeilen === geplant, `alle Übungen der Einheit gelistet (${zeilen} von ${geplant})`);
const erste = await ersteKarte.locator('.cal-list li').first().textContent();
console.log('     erste Zeile:', erste.replace(/\s+/g, ' ').trim());
check(/\d+ × \d+/.test(erste), 'Sätze × Wiederholungen je Übung');

// Der Modus steht dran – und zwar der, in dem trainiert wurde
const chips = await page.locator('.cal-detail .chip').allTextContents();
console.log('     Modus-Marken:', chips.map((c) => c.trim()).join(' | '));
check(chips.some((c) => c.includes('Hanteln')), 'Hantel-Einheit als solche gekennzeichnet');
check(chips.some((c) => c.includes('Bodyweight')), 'Bodyweight-Einheit als solche gekennzeichnet');

// Die Übungsnamen unterscheiden sich je Modus – Beleg, dass nicht stur
// die Hantel-Variante angezeigt wird.
const bwKarte = page.locator('.cal-detail', { hasText: 'Bodyweight' }).first();
const bwNamen = await bwKarte.locator('.cal-ex').allTextContents();
const dbNamen = await page.locator('.cal-detail', { hasText: 'Hanteln' }).first().locator('.cal-ex').allTextContents();
console.log('     Bodyweight:', bwNamen.join(', '));
check(bwNamen.join() !== dbNamen.join(), 'Bodyweight-Einheit zeigt die Bodyweight-Übungen');

// Nochmal antippen macht die Auswahl auf
await page.locator('.cal-cell.sel').first().click();
await page.waitForTimeout(200);
check(await page.locator('.cal-detail').count() === 0, 'nochmal antippen schließt die Auswahl');

// --- Sprung ins Dashboard ---
await page.locator('.cal-cell.plan').first().click();
await page.waitForTimeout(200);
const nr = await page.locator('.cal-detail .lbl').first().textContent();
await page.locator('[data-act="cal-open"]').first().click();
await page.waitForTimeout(300);
check(await page.locator('.tab[aria-selected="true"]').getAttribute('data-tab') === 'dashboard',
  'der Knopf führt ins Dashboard');
const dash = (await page.locator('#view').textContent()).replace(/\s+/g, ' ');
const zahl = nr.match(/\d+/)[0];
check(dash.includes(`Workout ${zahl} `) || dash.includes(`${zahl} von`), `und zwar zu Workout ${zahl}`);

// --- Verletzung schlägt bis in den Kalender durch ---
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('workout.state.v1'));
  s.injuries = ['kreuzband'];
  s.tab = 'calendar';
  localStorage.setItem('workout.state.v1', JSON.stringify(s));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
await page.locator('.cal-cell.plan').first().click();
await page.waitForTimeout(200);
const mitVerletzung = await page.locator('.cal-detail .cal-ex').allTextContents();
console.log('     mit Kreuzbandriss:', mitVerletzung.join(', '));
check(!mitVerletzung.some((n) => /Squat|Kniebeuge/i.test(n)), 'gesperrte Übungen stehen auch im Kalender nicht');

await page.screenshot({ path: `${SHOT}/cal-voll.png`, fullPage: true });
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check(overflow === 0, `kein horizontaler Überlauf (${overflow}px)`);

// Schmales Gerät: das Raster muss ein Raster bleiben
await page.setViewportSize({ width: 360, height: 740 });
await page.waitForTimeout(200);
const schmal = await page.locator('.cal-cell').first().boundingBox();
check(schmal.width >= 38, `Zellen auch bei 360 px groß genug (${Math.round(schmal.width)} px)`);
const overflow2 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check(overflow2 === 0, `auch bei 360 px kein Überlauf (${overflow2}px)`);

console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
console.log('ERRORS:', errs.length ? errs : 'none');
await browser.close();
