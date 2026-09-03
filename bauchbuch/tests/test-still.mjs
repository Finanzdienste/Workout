/*
 * Die App schickt nichts. Das ist die eine Zusage, die diese App macht.
 *
 * „Alles bleibt auf dem Gerät" steht im Willkommenstext, unter Mehr und in der
 * README. Ein Satz in einer README ist keine Eigenschaft – geprüft wird er
 * hier: Jede Anfrage, die der Browser stellt, wird mitgeschrieben, und was
 * nicht auf die eigene Adresse zeigt, ist ein Fehlschlag.
 *
 * Es gibt eine Vorgeschichte dazu, aus dem Schwesterprojekt: Dort meldeten die
 * Testläufe monatelang erfundene Geräte an einen echten Server, weil niemand
 * nachgesehen hatte, wohin die Aufrufe gingen. Hier gibt es keinen Server, den
 * man versehentlich anrufen könnte – aber genau das muss nachgewiesen werden
 * und nicht behauptet.
 */
import { chromium } from 'playwright';
import { URL, KEY, HANDY, pruefer } from './umgebung.mjs';

const { check, ende } = pruefer();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: HANDY });
const page = await ctx.newPage();
const fehler = [];
page.on('pageerror', (e) => fehler.push(`PAGEERROR: ${e.message}`));

const eigen = new global.URL(URL).origin;
const fremd = [];
page.on('request', (r) => {
  if (!r.url().startsWith(eigen) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) {
    fremd.push(`${r.method()} ${r.url()}`);
  }
});

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate((k) => localStorage.removeItem(k), KEY);
await page.reload({ waitUntil: 'networkidle' });

// Einmal durch die App: eintragen, blättern, auswerten, Bericht bauen.
await page.locator('[data-act="los"]').click();
await page.waitForTimeout(150);
await page.locator('[data-act="neu"][data-art="essen"]').click();
await page.waitForTimeout(150);
await page.locator('#bogenWas').fill('Reis mit Möhren');
await page.locator('.marke[data-id="fett"]').click();
await page.locator('[data-act="bogen-speichern"]').click();
await page.waitForTimeout(200);

await page.locator('[data-act="neu"][data-art="beschwerde"]').click();
await page.waitForTimeout(150);
await page.locator('.stufe[data-n="5"]').click();
await page.locator('[data-act="bogen-speichern"]').click();
await page.waitForTimeout(200);

for (const tab of ['verlauf', 'muster', 'mehr']) {
  await page.locator(`[data-act="tab"][data-tab="${tab}"]`).click();
  await page.waitForTimeout(200);
}
await page.locator('[data-act="bericht"][data-n="30"]').click();
await page.waitForTimeout(250);
check(await page.locator('.bericht').count() === 1, 'der Bericht ist erzeugt worden');

// Der Service Worker holt beim Einrichten die ganze Liste nach – abwarten,
// sonst prüft der Test, bevor überhaupt etwas hätte falsch laufen können.
await page.waitForTimeout(1200);

check(fremd.length === 0, `keine Anfrage nach draußen${fremd.length ? `: ${fremd.slice(0, 5).join(' | ')}` : ''}`);

// Auch nichts, das nur so aussieht, als bräuchte es das Netz: keine
// eingebundene Schrift, kein Bild von einer anderen Adresse.
const auswaerts = await page.evaluate((o) => [...document.querySelectorAll('[src],[href]')]
  .map((el) => el.getAttribute('src') || el.getAttribute('href'))
  .filter((u) => /^https?:/.test(u) && !u.startsWith(o)), eigen);
check(auswaerts.length === 0, `kein Verweis auf eine fremde Adresse${auswaerts.length ? `: ${auswaerts.join(', ')}` : ''}`);

// Und im Quelltext steht keine Adresse, die jemand später „nur mal eben"
// scharf schalten könnte.
const quelle = await page.evaluate(async () => {
  const dateien = ['./js/app.js', './js/store.js', './js/auswertung.js', './js/bericht.js',
    './js/daten.js', './js/datum.js', './js/text.js', './js/chart.js', './sw.js'];
  const texte = await Promise.all(dateien.map((d) => fetch(d).then((r) => r.text())));
  return texte.join('\n');
});
const adressen = quelle.match(/https?:\/\/[^\s'"`)]+/g) || [];
check(
  adressen.length === 0,
  `keine Adresse im Quelltext${adressen.length ? `: ${[...new Set(adressen)].join(', ')}` : ''}`,
);
check(
  !/\bfetch\s*\(\s*['"`]https?:/.test(quelle) && !/XMLHttpRequest|navigator\.sendBeacon/.test(quelle),
  'kein Aufruf, der etwas verschicken könnte',
);

check(fehler.length === 0, `keine Fehler${fehler.length ? `: ${fehler.join(' | ')}` : ''}`);
await browser.close();
ende();
