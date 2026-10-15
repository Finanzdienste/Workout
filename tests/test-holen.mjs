/*
 * Die Tabelle holt sich die Zeilen selbst.
 *
 * Der Unterschied, um den es geht, ist klein zu beschreiben und groß beim
 * Benutzen: Bisher musste man nach jedem Mitlesen eine Datei auswählen. Jetzt
 * liefert matches/android-lesen.py die Seite und die Daten von derselben
 * Adresse aus, und die Seite sieht alle paar Sekunden nach. Man geht auf dem
 * Telefon durch seine Profile, und in der anderen Ansicht füllt sich die
 * Tabelle mit.
 *
 * Geprüft wird hier die Seite, nicht der Server: `daten.json` wird im Browser
 * abgefangen und aus dieser Datei beantwortet. Vier Dinge müssen stimmen –
 * dass überhaupt geholt wird, dass Nachschub ankommt, dass dieselbe Datei nicht
 * doppelt meldet, und dass Handarbeit nicht überschrieben wird. Das letzte ist
 * das wichtigste: Wer eine Entfernung selbst eingetragen hat, darf sie nicht
 * dadurch verlieren, dass ein Mitleser dieselbe Person ohne Entfernung liefert.
 */
import { chromium } from 'playwright';
import { MATCHES } from './umgebung.mjs';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
const errs = [];
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

// Was der Mitleser gerade anbietet – wird im Lauf des Tests ausgetauscht.
let daten = {
  format: 'matches-mitlesen/1',
  app: 'gemischt',
  erzeugt: '2026-09-09T10:00:00.000Z',
  leute: [
    { name: 'Anna', km: 3.2, app: 'tinder', quelle: 'android' },
    { name: 'Mira', km: 12, app: 'bumble', quelle: 'android' },
  ],
};
let abrufe = 0;

await ctx.route('**/daten.json*', (route) => {
  abrufe++;
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(daten) });
});

const page = await ctx.newPage();
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
await page.goto(MATCHES, { waitUntil: 'networkidle' });

const namen = () => page.$$eval('#koerper tr td:nth-child(2) .name', (z) => z.map((x) => x.textContent.trim()));
const kmVon = (name) => page.$$eval('#koerper tr', (zeilen, n) => {
  const z = zeilen.find((r) => r.textContent.includes(n));
  return z ? z.querySelector('td').textContent.trim() : null;
}, name);

// --- 1. Ohne Zutun ----------------------------------------------------
await page.waitForFunction(() => document.querySelectorAll('#koerper tr').length === 2);
check(JSON.stringify(await namen()) === JSON.stringify(['Anna', 'Mira']),
  'die Zeilen stehen da, ohne dass jemand eine Datei ausgewählt hat');
check((await page.textContent('#importStand')).includes('Vom Mitleser übernommen'),
  'und die Seite sagt, woher sie kommen');

// --- 2. Nachschub, während man weitergeht ------------------------------
daten = {
  ...daten,
  erzeugt: '2026-09-09T10:05:00.000Z',
  leute: [...daten.leute, { name: 'Lena', km: 0.9, app: 'hinge', quelle: 'android' }],
};
await page.waitForFunction(() => document.querySelectorAll('#koerper tr').length === 3, null, { timeout: 15000 });
check(JSON.stringify(await namen()) === JSON.stringify(['Lena', 'Anna', 'Mira']),
  'eine später gefundene Person kommt von selbst dazu – und gleich an die richtige Stelle');

// --- 3. Dieselbe Datei meldet nicht zweimal ----------------------------
await page.evaluate(() => { document.getElementById('importStand').replaceChildren(); });
const vorher = abrufe;
await page.waitForFunction((v) => v < 0 || true, vorher);
await page.waitForTimeout(9000);
check(abrufe > vorher, `es wird weiter nachgesehen (${abrufe - vorher} Abrufe in 9 s)`);
check((await page.textContent('#importStand')).trim() === '',
  'aber unveränderte Daten schreiben keine neue Meldung');
check((await namen()).length === 3, 'und legen auch keine Dubletten an');

// --- 4. Handarbeit gewinnt --------------------------------------------
// Der Fall, der still Schaden anrichten würde: Man trägt für Mira die Zahl aus
// der App ein, und der nächste Durchgang findet Mira in der Liste ohne
// Entfernung. Überschriebe das die 5 km, wäre die genauere Angabe weg – und
// man würde es nicht merken.
await page.click('#koerper tr:has-text("Mira") button[aria-label*="bearbeiten"]');
await page.fill('#fKm', '5');
await page.click('#fSenden');
await page.waitForFunction(() => document.querySelector('#koerper').textContent.includes('5,0 km'));
daten = {
  ...daten,
  erzeugt: '2026-09-09T10:10:00.000Z',
  leute: daten.leute.map((p) => (p.name === 'Mira' ? { ...p, km: null } : p)),
};
await page.waitForTimeout(9000);
check((await kmVon('Mira')).startsWith('5,0 km'),
  `die selbst eingetragene Zahl überlebt den nächsten Durchgang (${await kmVon('Mira')})`);
check((await namen()).length === 3, 'und die Zeile bleibt eine');

check(errs.length === 0, `keine Fehler auf der Seite${errs.length ? ': ' + errs.join(' | ') : ''}`);
await browser.close();
console.log(fails ? `\n${fails} Prüfung(en) fehlgeschlagen.` : '\nAlles in Ordnung.');
