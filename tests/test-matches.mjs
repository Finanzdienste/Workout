/*
 * Die Match-Tabelle: sortiert sie nach dem, wonach gefragt wurde?
 *
 * Der Prüfgegenstand ist nicht das Formular, sondern die Reihenfolge – und dort
 * vor allem der unbequeme Fall. Zu einem Teil der Zeilen gibt es schlicht keine
 * Entfernung, weil in keiner Datenauskunft eine steht. Diese Zeilen dürfen
 * weder verschwinden noch nach oben rutschen, und zwar in beide
 * Sortierrichtungen. Eine Liste, die beim Umdrehen mit „unbekannt" beginnt,
 * beantwortet weder „wer ist am nächsten" noch „wer ist am weitesten".
 *
 * Der zweite Teil prüft, dass eine eingetragene Zahl eine gerechnete schlägt.
 * Das ist die Rangfolge, auf der die ganze Spalte beruht: was in der App stand,
 * ist genauer als Ortsmitte zu Ortsmitte.
 */
import { chromium } from 'playwright';
import { MATCHES } from './umgebung.mjs';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

await page.goto(MATCHES, { waitUntil: 'networkidle' });

// --- 1. Leer, aber nicht stumm ---------------------------------------
check(await page.locator('#leer').isVisible(), 'ohne eine einzige Zeile sagt die Tabelle das auch');

// --- 2. Standort ------------------------------------------------------
await page.fill('#heimOrt', 'Berlin');
await page.click('#heimSetzen');
await page.waitForFunction(() => document.getElementById('heimStand').textContent.includes('Berlin'));
check((await page.textContent('#heimStand')).includes('52.520'), 'ein Ortsname wird ohne Netz zu Koordinaten');

// --- 3. Drei Zeilen auf drei Wegen -----------------------------------
const eintragen = async ({ name, app, km, ort }) => {
  await page.fill('#fName', name);
  await page.selectOption('#fApp', app);
  await page.fill('#fKm', km === undefined ? '' : String(km));
  await page.fill('#fOrt', ort || '');
  await page.click('#fSenden');
  await page.waitForFunction((n) => document.getElementById('koerper').textContent.includes(n), name);
};

await eintragen({ name: 'Mira', app: 'hinge', ort: 'Leipzig' });        // gerechnet
await eintragen({ name: 'Anna', app: 'tinder', km: 4 });                // eingetragen
await eintragen({ name: 'Nele', app: 'bumble' });                       // gar nichts
await eintragen({ name: 'Lena', app: 'bumble', km: 0.8 });              // eingetragen

const namen = () => page.$$eval('#koerper tr td:nth-child(2) .name', (zellen) => zellen.map((z) => z.textContent.trim()));
const kmSpalte = () => page.$$eval('#koerper tr td:nth-child(1)', (zellen) => zellen.map((z) => z.textContent.trim()));

const reihe = await namen();
console.log('     Reihenfolge:', reihe.join(' → '));
check(JSON.stringify(reihe) === JSON.stringify(['Lena', 'Anna', 'Mira', 'Nele']),
  'aufsteigend: 0,8 km vor 4 km vor dem gerechneten Leipzig vor der unbekannten Zeile');

const spalte = await kmSpalte();
check(spalte[0].startsWith('0,8') && !spalte[0].startsWith('~'),
  'eine abgetippte Zahl steht ohne Tilde da – sie kommt aus derselben Quelle wie die Frage');
check(spalte[2].startsWith('~') && spalte[2].includes('149'),
  `Leipzig wird gerechnet und als gerechnet gezeigt (${spalte[2].replace(/\s+/g, ' ')})`);
check(spalte[3] === '–', 'ohne beides bleibt die Zelle leer statt 0 km zu behaupten');

// --- 4. Umdrehen -------------------------------------------------------
await page.click('th[data-feld="km"] button');
const rueck = await namen();
console.log('     umgedreht: ', rueck.join(' → '));
check(JSON.stringify(rueck) === JSON.stringify(['Mira', 'Anna', 'Lena', 'Nele']),
  'absteigend dreht die bekannten Zeilen um – und lässt die unbekannte trotzdem unten');

// --- 5. Eingetragen schlägt gerechnet ---------------------------------
await page.click('#koerper tr:nth-child(1) button[aria-label*="bearbeiten"]');
await page.fill('#fKm', '12');
await page.click('#fSenden');
await page.waitForFunction(() => document.querySelector('#koerper').textContent.includes('12 km'));
const nachKorrektur = await kmSpalte();
check(nachKorrektur.some((z) => z.startsWith('12 km') && !z.startsWith('~')),
  'trägt man bei einer gerechneten Zeile die Zahl aus der App nach, gilt ab sofort die');

// --- 6. Import ---------------------------------------------------------
const tinder = JSON.stringify({
  Usage: { matches: { '2024-01-01': 5 } },
  Messages: [
    { match_id: 'a1', messages: [{ message: 'Hey Sophie, wie läufts?', sent_date: '2024-01-01T10:00:00.000Z' }] },
    { match_id: 'a2', messages: [{ message: 'was geht', sent_date: '2024-01-02T10:00:00.000Z' }] },
  ],
});
await page.setInputFiles('#datei', { name: 'data.json', mimeType: 'application/json', buffer: Buffer.from(tinder) });
await page.waitForFunction(() => document.getElementById('importStand').textContent.includes('2 neue Zeilen'));
check((await page.textContent('#importStand')).includes('in keinem Export'),
  'der Import sagt von sich aus, dass in der Datei keine Entfernung steht');
check((await namen()).includes('Sophie'),
  'aus der eigenen ersten Nachricht wird ein Vorname geraten – die einzige Stelle, an der er dort vorkommt');
check(await page.locator('.name--geraten').first().isVisible(),
  'und er steht kursiv da, weil geraten nicht dasselbe ist wie gewusst');
check((await namen()).includes('(ohne Namen)'),
  'wo nichts zu raten war, steht das auch so da statt einer erfundenen Kennung');

// --- 7. Überleben eines Neustarts --------------------------------------
await page.reload({ waitUntil: 'networkidle' });
check((await namen()).length === 6, 'nach dem Neuladen stehen alle sechs Zeilen wieder da');
check((await page.textContent('#heimStand')).includes('Berlin'), 'und der Standort auch');

// --- 8. Ein zweiter Import verdoppelt nichts ---------------------------
await page.setInputFiles('#datei', { name: 'data.json', mimeType: 'application/json', buffer: Buffer.from(tinder) });
await page.waitForFunction(() => document.getElementById('importStand').textContent.includes('0 neue Zeilen'));
check((await namen()).length === 6, 'dieselbe Datei ein zweites Mal eingelesen legt keine Dubletten an');

// --- 9. CSV ------------------------------------------------------------
// Noch eine gerechnete Zeile, denn Miras Entfernung ist oben von Hand ersetzt
// worden – die CSV soll beide Quellen nebeneinander zeigen können.
await eintragen({ name: 'Julia', app: 'hinge', ort: 'Hamburg' });
const csv = await page.evaluate(async () => {
  const s = await import('./js/speicher.js');
  const z = window.matches.zustand();
  return s.alsCsv(s.sortieren(z.leute, z.heim, 'km', 1), z.heim);
});
check(csv.split('\r\n')[0].startsWith('Name;App;Entfernung km;Quelle'),
  'die CSV nennt neben der Zahl die Quelle – ohne die ist eine Entfernung nur eine Behauptung');
check(csv.includes('aus der App') && csv.includes('aus dem Ort gerechnet'),
  'und beide Quellen kommen darin vor');

// --- 10. Ein geänderter Ort zieht die alte Entfernung mit --------------
// Der Fall, der still falsch wäre: Julia stand in Hamburg, zieht nach
// „Hintertupfingen", und das steht in keiner Ortsliste. Bliebe der alte Punkt
// stehen, zeigte die Tabelle weiter 255 km nach Hamburg – eine Zahl, der man
// nicht ansieht, dass sie zu einem Ort gehört, der da nicht mehr steht.
const julia = () => page.$$eval('#koerper tr', (zeilen) => {
  const z = zeilen.find((r) => r.textContent.includes('Julia'));
  return z ? z.querySelector('td').textContent.trim() : null;
});
check((await julia()).includes('~'), `Julia steht mit gerechneter Entfernung da (${await julia()})`);
await page.click('#koerper tr:has-text("Julia") button[aria-label*="bearbeiten"]');
await page.fill('#fOrt', 'Hintertupfingen');
await page.click('#fSenden');
await page.waitForFunction(() => document.getElementById('formHinweis').hidden === false);
check((await julia()) === '\u2013',
  `nach dem Umzug an einen unbekannten Ort ist die Entfernung leer, nicht die alte (${await julia()})`);
check((await page.textContent('#formHinweis')).includes('Hintertupfingen'),
  'und die App sagt, woran es lag');

check(errs.length === 0, `keine Fehler auf der Seite${errs.length ? ': ' + errs.join(' | ') : ''}`);
await browser.close();
console.log(fails ? `\n${fails} Prüfung(en) fehlgeschlagen.` : '\nAlles in Ordnung.');
