/*
 * Der Reiter „Muster" – die einzige Stelle, an der die App etwas behauptet.
 *
 * Geprüft wird an einem ausgedachten Verlauf, dessen Ergebnis feststeht: Nach
 * dem Mittagessen mit Kaffee tut es weh, nach dem Abendessen mit Milch nicht.
 * Die App muss den Kaffee finden, die Milch nicht anschwärzen – und, wenn die
 * Schwelle hochgesetzt wird, den Mund halten, obwohl die Zahlen dieselben sind.
 */
import { chromium } from 'playwright';
import { URL, KEY, HANDY, SHOT, pruefer } from './umgebung.mjs';

const { check, ende } = pruefer();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: HANDY });
const fehler = [];
page.on('pageerror', (e) => fehler.push(`PAGEERROR: ${e.message}`));

const eintraege = [];
for (let t = 1; t <= 20; t++) {
  const am = `2026-02-${String(t).padStart(2, '0')}`;
  eintraege.push({ id: `a${t}`, am, um: '12:00', art: 'essen', was: 'Mittag', tags: ['kaffee'], portion: 'normal' });
  eintraege.push({ id: `b${t}`, am, um: '13:30', art: 'beschwerde', staerke: 7, arten: ['brennen'] });
  eintraege.push({ id: `c${t}`, am, um: '18:00', art: 'essen', was: 'Abend', tags: ['milch'], portion: 'normal' });
}
// Zwei Fälle Alkohol mit voller Wucht – das darf nichts auslösen.
eintraege.push({ id: 'd1', am: '2026-02-21', um: '19:00', art: 'essen', was: 'Feier', tags: ['alkohol'], portion: 'normal' });
eintraege.push({ id: 'd2', am: '2026-02-21', um: '20:00', art: 'beschwerde', staerke: 10, arten: ['uebelkeit'] });
eintraege.push({ id: 'd3', am: '2026-02-22', um: '19:00', art: 'essen', was: 'Feier', tags: ['alkohol'], portion: 'normal' });
eintraege.push({ id: 'd4', am: '2026-02-22', um: '20:00', art: 'beschwerde', staerke: 10, arten: ['uebelkeit'] });

const stand = { eintraege, tage: {}, fenster: 4, mindestFaelle: 5, begruesst: true, tab: 'muster' };

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(([k, s]) => localStorage.setItem(k, JSON.stringify(s)), [KEY, stand]);
await page.reload({ waitUntil: 'networkidle' });

check(await page.locator('.funde .fund').count() > 0, 'es gibt Funde');
const erster = page.locator('.funde .fund').first();
check((await erster.textContent()).includes('Kaffee'), 'der Kaffee steht oben');
check(
  (await erster.getAttribute('class')).includes('f-auffaellig'),
  'und ist als auffällig ausgezeichnet',
);
check(
  (await erster.textContent()).includes('20 Mahlzeiten damit'),
  'die Fallzahl steht daneben, nicht nur das Urteil',
);
check(
  (await erster.locator('.vgl-zeile b').first().textContent()).trim() === '7,0',
  'der Vergleichsbalken nennt die 7,0 nach dem Kaffee',
);
// Nicht 0,0: Zu den übrigen Mahlzeiten zählen auch die beiden Alkohol-Abende
// mit ihrer 10. Genau so soll es sein – der Vergleich läuft gegen den eigenen
// Alltag, nicht gegen einen erfundenen Nullpunkt.
const sonst = Number((await erster.locator('.vgl-zeile b').nth(1).textContent()).trim().replace(',', '.'));
check(sonst > 0 && sonst < 1, `die übrigen Mahlzeiten liegen bei ${sonst} – deutlich darunter`);

const alleFunde = await page.locator('.funde .fund').allTextContents();
const milchZeile = alleFunde.find((t) => t.includes('Milchprodukte'));
check(!!milchZeile, 'die Milch steht ebenfalls in der Liste');
check(
  milchZeile.includes('eher unauffällig'),
  'aber als eher unauffällig – die Gegenprobe wird nicht zum Verdacht',
);
check(
  !alleFunde.some((t) => t.includes('Alkohol')),
  'der Alkohol mit zwei Fällen erscheint gar nicht unter den Funden',
);
check(
  (await page.locator('.zaehlt').textContent()).includes('Alkohol'),
  'er steht unter „Zählt noch"',
);
check(
  (await page.locator('.zaehlt').textContent()).includes('2 von 5'),
  'mit der Angabe, wie viele Fälle noch fehlen',
);

await page.screenshot({ path: `${SHOT}/20-muster.png` });

/* ---------- Die Schwelle wirkt ---------- */

await page.locator('[data-act="tab"][data-tab="mehr"]').click();
await page.waitForTimeout(200);
await page.locator('[data-act="mindest"][data-n="12"]').click();
await page.waitForTimeout(200);
await page.locator('[data-act="tab"][data-tab="muster"]').click();
await page.waitForTimeout(200);
check(
  (await page.locator('#view').textContent()).includes('Kaffee'),
  'bei 12 geforderten Fällen bleibt der Kaffee mit seinen 20 stehen',
);

await page.locator('[data-act="tab"][data-tab="mehr"]').click();
await page.waitForTimeout(200);
await page.locator('[data-act="fenster"][data-n="2"]').click();
await page.waitForTimeout(200);
await page.locator('[data-act="tab"][data-tab="muster"]').click();
await page.waitForTimeout(200);
const engText = await page.locator('#view').textContent();
check(
  engText.includes('2 Stunden'),
  'das Fenster steht in der Erklärung und lässt sich umstellen',
);
check(
  (await page.locator('.funde .fund').first().textContent()).includes('Kaffee'),
  'bei zwei Stunden bleibt der Zusammenhang bestehen – 90 Minuten passen hinein',
);

/* ---------- Ohne Eintragungen keine Behauptung ---------- */

await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ begruesst: true, tab: 'muster' })), KEY);
await page.reload({ waitUntil: 'networkidle' });
check(await page.locator('.funde').count() === 0, 'ohne Eintragungen gibt es keine Funde');
check(
  (await page.locator('#view').textContent()).includes('Noch keine Mahlzeit'),
  'sondern einen Satz, der das erklärt',
);
check(
  (await page.locator('#view').textContent()).includes('keine Ursache'),
  'und den Hinweis, dass Häufigkeit keine Ursache ist',
);

check(fehler.length === 0, `keine Fehler${fehler.length ? `: ${fehler.join(' | ')}` : ''}`);
await browser.close();
ende();
