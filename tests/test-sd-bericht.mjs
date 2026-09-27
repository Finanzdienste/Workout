/*
 * Schilddrüse: der Bericht für den Arzttermin.
 *
 * Er ist der Grund, warum die App überhaupt sammelt. Geprüft wird, dass
 * darin steht, was im Sprechzimmer gefragt wird – Dosis seit wann, wie
 * zuverlässig genommen, Werte neben der damaligen Dosis, Fragen –, dass die
 * Zahlen stimmen, und dass er nichts bewertet.
 */
import { oeffne, standMit, plus, kurz } from './sd-hilfe.mjs';

const TAG = '2026-03-10';
const einnahmen = {};
for (let i = 1; i <= 70; i++) einnahmen[plus(TAG, -i)] = { uhr: '07:05' };
[3, 17, 40].forEach((i) => { einnahmen[plus(TAG, -i)] = null; });
delete einnahmen[plus(TAG, -20)];

const stand = standMit(plus(TAG, -200), {
  profil: { name: 'Mama', begruesst: true },
  dosen: [
    { id: 'd1', ab: plus(TAG, -200), praeparat: 'L-Thyroxin Henning', mikrogramm: 50, tabletten: 1, notiz: '' },
    { id: 'd2', ab: plus(TAG, -45), praeparat: 'L-Thyroxin Henning', mikrogramm: 75, tabletten: 1, notiz: 'nach Kontrolle' },
  ],
  einnahmen,
  labor: [
    { id: 'l1', datum: plus(TAG, -50), tsh: { wert: 5.8, einheit: 'mU/l', von: 0.27, bis: 4.2 }, ft4: { wert: 12.1, einheit: 'pmol/l', von: 12, bis: 22 }, ft3: null, notiz: '' },
    { id: 'l2', datum: plus(TAG, -2), tsh: { wert: 2.4, einheit: 'mU/l', von: 0.27, bis: 4.2 }, ft4: null, ft3: null, notiz: 'Tablette nach der Abnahme' },
  ],
  gewicht: [{ id: 'g1', datum: plus(TAG, -120), kg: 71.2 }, { id: 'g2', datum: plus(TAG, -1), kg: 69.9 }],
  befinden: [
    { id: 'b1', datum: plus(TAG, -3), stufe: 'schlecht', beschwerden: ['muede', 'frieren'], notiz: 'nachmittags sehr müde' },
    { id: 'b2', datum: plus(TAG, -10), stufe: 'mittel', beschwerden: ['muede'], notiz: '' },
  ],
  fragen: [
    { id: 'f1', text: 'Kann die Müdigkeit an der Dosis liegen?', erledigt: false },
    { id: 'f2', text: 'Alte, schon besprochene Frage', erledigt: true },
  ],
});

const { page, ctx, check, ende } = await oeffne({ tag: TAG, stand });

await page.click('#reiter-mehr');
await page.click('[data-seite="bericht"]');
const text = await page.locator('#berichtText').innerText();
console.log(text.split('\n').map((z) => `     | ${z}`).join('\n'));

check(text.startsWith(`Schilddrüse – Bericht vom ${kurz(TAG)} (Mama)`), 'Kopfzeile mit Datum und Anrede');
check(text.includes(`Aktuell: L-Thyroxin Henning 75 µg, 1 Tablette am Tag, seit ${kurz(plus(TAG, -45))} (nach Kontrolle)`), 'aktuelle Dosis mit Datum und Notiz');
check(text.includes(`Davor: L-Thyroxin Henning 50 µg, 1 Tablette am Tag, ab ${kurz(plus(TAG, -200))}`), 'die Dosis davor');
// 56 Tage bis einschließlich heute: heute kein Eintrag, vor 20 Tagen keiner, 3 Tage nicht genommen.
check(text.includes('Letzte 8 Wochen: an 51 von 56 Tagen genommen, an 3 Tagen nicht genommen, 2 Tage ohne Eintrag.'), 'Einnahmen der letzten acht Wochen richtig gezählt');
// Letzte 28 Tage: heute und vor 20 Tagen ohne Eintrag, vor 3 und 17 Tagen nicht genommen.
check(text.includes('Davon letzte 4 Wochen: an 24 von 28 Tagen genommen.'), 'und die der letzten vier Wochen');
check(text.includes(`Nicht genommen am: ${kurz(plus(TAG, -3))}, ${kurz(plus(TAG, -17))}, ${kurz(plus(TAG, -40))}`), 'die Tage ohne Tablette mit Datum');
check(text.includes(`${kurz(plus(TAG, -2))}: TSH 2,4 mU/l (Labor 0,27–4,2) – Dosis damals 75 µg – Tablette nach der Abnahme`), 'neuester Laborwert mit Bereich, damaliger Dosis und Notiz');
check(text.includes(`${kurz(plus(TAG, -50))}: TSH 5,8 mU/l (Labor 0,27–4,2), fT4 12,1 pmol/l (Labor 12–22) – Dosis damals 50 µg`), 'älterer Laborwert mit der Dosis von damals (50 µg)');
check(text.includes(`69,9 kg am ${kurz(plus(TAG, -1))}; vor etwa drei Monaten 71,2 kg`), 'Gewicht jetzt und vor drei Monaten');
check(text.includes('2 Einträge: 1× mittel, 1× schlecht.'), 'Befinden zusammengefasst, ohne Nullen');
check(text.includes('müde, erschöpft (2×)'), 'häufigste Beschwerde mit Anzahl');
check(text.includes('Kann die Müdigkeit an der Dosis liegen?'), 'offene Frage steht drin');
check(!text.includes('schon besprochene'), 'besprochene Frage nicht');
check(!/zu hoch|zu niedrig|erhöht|auffällig|undefined|NaN|null|Tag\(e\)/.test(text), 'keine Bewertung und kein Rechenrest (undefined, NaN, „Tag(e)")');
check(text.includes('bewertet keine Werte'), 'am Ende der Hinweis, dass die App nichts bewertet');

// Kopieren landet in der Zwischenablage.
await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
await page.click('[data-act="bericht-kopieren"]');
await page.waitForTimeout(200);
const ablage = await page.evaluate(() => navigator.clipboard.readText());
check(ablage === text.replace(/\n$/, '') || ablage.trim() === text.trim(), '„Kopieren" legt genau diesen Text in die Zwischenablage');

// Leerer Stand: ein Bericht ohne Rechenreste.
await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({ version: 1, profil: { begruesst: true } })), 'schilddruese.stand.v1');
await page.reload({ waitUntil: 'networkidle' });
await page.click('#reiter-mehr');
await page.click('[data-seite="bericht"]');
const leer = await page.locator('#berichtText').innerText();
check(leer.includes('Keine Dosis eingetragen.') && leer.includes('Keine Laborwerte eingetragen.'), 'ohne Daten: Sätze statt leerer Abschnitte');
check(!/undefined|NaN|null/.test(leer), 'ohne Daten: kein undefined oder NaN');

await ende();
