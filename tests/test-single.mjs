import { chromium } from 'playwright';
import { EINZEL, SHOT } from './umgebung.mjs';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 414, height: 896 } });
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });

/** Neu laden und wieder in die Uebungsliste wechseln (ui.listView ist nicht persistent). */
async function reloadToList(waitUntil = 'networkidle') {
  await page.reload({ waitUntil });
  const open = page.locator('[data-act="show-list"]');
  if (await open.count()) { await open.click(); await page.waitForTimeout(120); }
}
page.on('requestfailed', (r) => errs.push('REQFAIL: ' + r.url()));

let fails = 0;
const check = (cond, msg) => {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${msg}`);
  if (!cond) { fails++; process.exitCode = 1; }
};

await page.goto(EINZEL, { waitUntil: 'networkidle' });
// Pausentimer stoert diese Tests nur - hier geht es um anderes. Und greeted:
// ohne das steht hier die Willkommensseite, die es beim ersten Start gibt.
await page.evaluate(() => { const k='workout.state.v1'; const s=JSON.parse(localStorage.getItem(k)||'{}'); s.restSeconds=0; s.greeted=true; localStorage.setItem(k, JSON.stringify(s)); });
await reloadToList();


// Keine externen Anfragen: alles muss eingebettet sein
const external = await page.evaluate(() => [...document.querySelectorAll('[src],[href]')]
  .map((e) => e.getAttribute('src') || e.getAttribute('href'))
  .filter((u) => u && !u.startsWith('data:')));
check(external.length === 0, `keine externen Verweise (${JSON.stringify(external)})`);

// Wie viele Übungen der Tag hat, sagt die Kopfzeile – der Plan gleicht die
// Wochenmenge je Muskelgruppe aus und ist deshalb nicht überall gleich lang.
await page.locator('[data-act="hide-list"]').click();
const soll = Number((await page.locator('.hero-sub').first().textContent()).match(/(\d+)\s+Übungen/)[1]);
await page.locator('[data-act="show-list"]').click();
const exCount = await page.locator('.ex').count();
check(exCount === soll, `Liste rendert die Übungen des Tages (${exCount} von ${soll})`);
check(await page.locator('.tab').count() === 3, '3 Tabs vorhanden');
await page.locator('[data-act="hide-list"]').click();
check((await page.locator('.hero-eyebrow').textContent()).includes('Workout'), 'Hero da');
check(await page.locator('.bodymap').count() === 1, 'Körperkarte in der Einzeldatei');
check(await page.locator('.bm-part.on').count() > 0, 'Muskelgruppen hervorgehoben');
await page.locator('[data-act="show-list"]').click();

// Styling wirklich aktiv?
const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
check(bg === 'rgb(15, 17, 21)', `CSS eingebettet und aktiv (${bg})`);

// Modus-Umschalter
// Die ganze Liste vergleichen statt nur der ersten Zeile: manche Übungen
// heißen in beiden Varianten gleich (Chin-ups), dann sagt ein Vergleich an
// fester Stelle nichts. Hier läuft alles über file:// – die Daten kommen aus
// der Oberfläche, nicht aus einem Modul.
const dbNamen = await page.locator('.ex-name').allTextContents();
await page.locator('.mode-btn[data-mode="bw"]').click();
await page.waitForTimeout(150);
const bwNamen = await page.locator('.ex-name').allTextContents();
const geaendert = dbNamen.map((n, i) => [n, bwNamen[i]]).filter(([a, b]) => a !== b);
check(bwNamen.length === dbNamen.length && bwNamen.every((n) => n.length > 0),
  `Liste bleibt vollständig (${bwNamen.length} Übungen)`);
check(geaendert.length > 0,
  `Bodyweight-Umschaltung (${geaendert.length ? geaendert[0].join(' -> ') : 'nichts geändert'})`);
await page.locator('.mode-btn[data-mode="db"]').click();

// Speichern über file:// – Chromium erlaubt hier kein localStorage
const persists = await page.evaluate(() => {
  try { localStorage.setItem('x', '1'); localStorage.removeItem('x'); return true; } catch { return false; }
});
console.log(`     localStorage unter file://: ${persists ? 'verfügbar' : 'gesperrt'}`);
const warn = await page.locator('.notice.warn').count();
check(persists ? warn === 0 : warn === 1, 'Speicher-Hinweis passt zur Lage');

// Alle Tabs durchklicken
for (const tab of ['stats', 'settings', 'dashboard']) {
  await page.locator(`.tab[data-tab="${tab}"]`).click();
  const n = await page.locator('.view > *').count();
  check(n > 0, `Tab ${tab} rendert (${n} Blöcke)`);
}

// Interaktion
await page.locator('.ex-head').first().click();
await page.locator('.set-btn').first().click();
check(await page.locator('.set-btn.on').count() === 1, 'Satz abhaken funktioniert');

const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check(overflow === 0, `kein horizontaler Überlauf (${overflow}px)`);

await page.screenshot({ path: `${SHOT}/20-single-file.png`, fullPage: false });

console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
console.log('ERRORS:', errs.length ? errs : 'none');
await browser.close();
