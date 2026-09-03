/*
 * Der Weg, den man jeden Tag geht: eintragen, ansehen, ändern, löschen.
 *
 * Wenn hier etwas klemmt, ist die App unbenutzbar – alles andere hängt daran,
 * dass überhaupt etwas hineinkommt.
 */
import { chromium } from 'playwright';
import { URL, KEY, HANDY, SHOT, pruefer } from './umgebung.mjs';

const { check, ende } = pruefer();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: HANDY });
const fehler = [];
page.on('pageerror', (e) => fehler.push(`PAGEERROR: ${e.message}`));

await page.goto(URL, { waitUntil: 'networkidle' });
// Frisch anfangen: Ein Rest aus einem früheren Lauf zählte sonst mit.
await page.evaluate((k) => localStorage.removeItem(k), KEY);
await page.reload({ waitUntil: 'networkidle' });

/* ---------- Willkommen ---------- */

check(await page.locator('.willkommen').count() === 1, 'die Begrüßung steht am Anfang');
check(await page.locator('.tabbar').isHidden(), 'die Reiterleiste ist dabei noch weg');
await page.locator('[data-act="los"]').click();
await page.waitForTimeout(150);
check(await page.locator('.willkommen').count() === 0, 'nach „Anfangen" ist sie weg');
check(await page.locator('.anlegen-btn').count() === 4, 'vier Knöpfe zum Eintragen');

/* ---------- Eine Mahlzeit ---------- */

await page.locator('[data-act="neu"][data-art="essen"]').click();
await page.waitForTimeout(150);
check(await page.locator('.bogen').count() === 1, 'der Bogen für die Mahlzeit geht auf');

await page.locator('#bogenWas').fill('Haferbrei mit Banane');
await page.locator('.marke[data-id="kaffee"]').click();
await page.waitForTimeout(120);
check(
  await page.locator('.marke[data-id="kaffee"]').getAttribute('aria-pressed') === 'true',
  'die angetippte Marke ist angewählt',
);
check(
  await page.locator('#bogenWas').inputValue() === 'Haferbrei mit Banane',
  'das Textfeld hat den Text behalten, obwohl neu gezeichnet wurde',
);
await page.locator('[data-act="bogen-speichern"]').click();
await page.waitForTimeout(200);

check(await page.locator('.bogen').count() === 0, 'der Bogen schließt sich nach dem Eintragen');
check(await page.locator('.strang-zeile').count() === 1, 'die Mahlzeit steht im Tag');
check(
  (await page.locator('.strang-zeile').first().textContent()).includes('Haferbrei'),
  'und zwar mit dem, was eingetragen wurde',
);
check(
  (await page.locator('.strang-zeile').first().textContent()).includes('Kaffee'),
  'die Marke steht darunter',
);

/* ---------- Eine Beschwerde ---------- */

await page.locator('[data-act="neu"][data-art="beschwerde"]').click();
await page.waitForTimeout(150);
check(await page.locator('.skala .stufe').count() === 11, 'die Skala hat elf Stufen, 0 bis 10');
await page.locator('.stufe[data-n="6"]').click();
await page.waitForTimeout(120);
check(
  (await page.locator('.skala-wort').textContent()).trim() === 'deutlich',
  'zur Zahl steht ein Wort',
);
await page.locator('.marke[data-id="brennen"]').click();
await page.locator('[data-act="bogen-speichern"]').click();
await page.waitForTimeout(200);

check(await page.locator('.strang-zeile').count() === 2, 'zwei Einträge im Tag');
check(
  (await page.locator('.tagbilanz .gross').textContent()).includes('6'),
  'die Tagesbilanz nennt die stärkste Beschwerde',
);

/* ---------- Ändern ---------- */

await page.locator('.z-beschwerde .strang-text').click();
await page.waitForTimeout(150);
check(
  await page.locator('.stufe[data-n="6"]').getAttribute('aria-pressed') === 'true',
  'beim Ändern steht der alte Wert schon da',
);
await page.locator('.stufe[data-n="2"]').click();
await page.locator('[data-act="bogen-speichern"]').click();
await page.waitForTimeout(200);
check(await page.locator('.strang-zeile').count() === 2, 'Ändern legt keinen zweiten Eintrag an');
check(
  (await page.locator('.tagbilanz .gross').textContent()).includes('2'),
  'die Bilanz rechnet den geänderten Wert',
);

/* ---------- Ein leerer Eintrag wird abgelehnt ---------- */

await page.locator('[data-act="neu"][data-art="medikament"]').click();
await page.waitForTimeout(150);
await page.locator('[data-act="bogen-speichern"]').click();
await page.waitForTimeout(200);
check(await page.locator('.bogen').count() === 1, 'ohne Mittel bleibt der Bogen offen');
check(
  (await page.locator('#toast').textContent()).includes('Welches Mittel'),
  'und sagt, was fehlt',
);
await page.keyboard.press('Escape');
await page.waitForTimeout(150);
check(await page.locator('.bogen').count() === 0, 'Escape schließt den Bogen');
check(await page.locator('.strang-zeile').count() === 2, 'abgebrochen heißt nicht eingetragen');

/* ---------- Der Tag hat Umstände ---------- */

await page.locator('[data-act="stress"][data-n="3"]').click();
await page.waitForTimeout(150);
check(
  await page.locator('[data-act="stress"][data-n="3"]').getAttribute('aria-pressed') === 'true',
  'die Anspannung lässt sich setzen',
);
await page.locator('[data-act="stress"][data-n="3"]').click();
await page.waitForTimeout(150);
check(
  await page.locator('[data-act="stress"][data-n="3"]').getAttribute('aria-pressed') === 'false',
  'und durch ein zweites Tippen wieder zurücknehmen',
);

/* ---------- Blättern ---------- */

await page.locator('[data-act="tag-blaettern"][data-d="-1"]').click();
await page.waitForTimeout(150);
check(
  (await page.locator('.tagkopf h2').textContent()).trim() === 'gestern',
  'ein Tag zurück ist gestern',
);
check(await page.locator('.strang-zeile').count() === 0, 'gestern ist noch leer');
check(await page.locator('.leer').count() === 1, 'und sagt das auch');

/* ---------- Löschen ---------- */

await page.locator('[data-act="tag-blaettern"][data-d="1"]').click();
await page.waitForTimeout(150);
await page.locator('.strang-weg').first().click();
await page.waitForTimeout(200);
check(await page.locator('.strang-zeile').count() === 1, 'gelöscht ist gelöscht');

await page.screenshot({ path: `${SHOT}/10-tag.png` });
check(fehler.length === 0, `keine Fehler${fehler.length ? `: ${fehler.join(' | ')}` : ''}`);
await browser.close();
ende();
