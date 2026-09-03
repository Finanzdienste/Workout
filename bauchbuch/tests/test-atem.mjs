/*
 * Die Atemübung.
 *
 * Sie wird mit geschlossenen Augen gemacht – der Ton ist die Bedienoberfläche,
 * nicht das Bild. Geprüft wird deshalb vor allem der Ablauf: dass die Phasen
 * in der richtigen Reihenfolge und mit der richtigen Länge kommen, dass die
 * Übung von selbst endet und dass sie aufhört, wenn man den Reiter verlässt.
 *
 * Eine Übung, die im Hintergrund weiterpiepst, während jemand im Tagebuch
 * blättert, wäre das Gegenteil dessen, wozu sie da ist.
 *
 * Der Ton selbst lässt sich in einem Testbrowser nicht hören. Geprüft wird
 * stattdessen, dass er erzeugt *wird* – über die Zahl der Oszillatoren, die
 * die Seite anlegt.
 */
import { chromium } from 'playwright';
import { URL, KEY, HANDY, SHOT, pruefer } from './umgebung.mjs';

const { check, ende } = pruefer();
const browser = await chromium.launch();
// Eigener Kontext, damit die Einstellung "Ton aus" am Ende nicht in den
// nächsten Lauf hineinreicht.
const ctx = await browser.newContext({ viewport: HANDY });
const page = await ctx.newPage();
const fehler = [];
page.on('pageerror', (e) => fehler.push(`PAGEERROR: ${e.message}`));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ begruesst: true, tab: 'ruhe' })), KEY);
await page.reload({ waitUntil: 'networkidle' });

/* ---------- Der Ablauf, ohne ihn abzuwarten ---------- */

const ablauf = (id, runden) => page.evaluate(
  ([i, r]) => import('./js/atem.js').then((m) => m.ablauf(m.uebungVon(i), r)),
  [id, runden],
);

const a478 = await ablauf('478', 2);
check(a478.length === 6, `4–7–8 mit zwei Runden sind sechs Phasen (${a478.length})`);
check(
  a478.map((x) => x.sek).join() === '4,7,8,4,7,8',
  `vier ein, sieben halten, acht aus – zweimal (${a478.map((x) => x.sek).join()})`,
);
check(a478[5].letzte === true, 'die letzte Phase weiß, dass sie die letzte ist');
check(a478[0].runde === 1 && a478[3].runde === 2, 'die Runden werden mitgezählt');

const alle = await page.evaluate(() => import('./js/atem.js').then((m) => m.UEBUNGEN.map((u) => ({
  id: u.id,
  ein: u.phasen.filter((p) => p.art === 'ein').reduce((s, p) => s + p.sek, 0),
  aus: u.phasen.filter((p) => p.art === 'aus').reduce((s, p) => s + p.sek, 0),
}))));
check(alle.length === 4, `vier Übungen zur Wahl (${alle.length})`);
check(
  alle.every((u) => u.aus >= u.ein),
  'bei jeder Übung ist das Ausatmen mindestens so lang wie das Einatmen – '
  + 'umgekehrt täte sie das Gegenteil',
);

/* ---------- Die Übung läuft ---------- */

check(await page.locator('.atem-kreis').count() === 1, 'der Kreis ist da');
check(
  (await page.locator('#atemWort').textContent()).includes('Bereit'),
  'vor dem Start steht dort nichts als eine Einladung',
);

// Zählen, wie oft die Seite einen Ton anlegt.
await page.evaluate(() => {
  window.__toene = 0;
  const AC = window.AudioContext || window.webkitAudioContext;
  const echt = AC.prototype.createOscillator;
  AC.prototype.createOscillator = function zaehlend(...args) {
    window.__toene += 1;
    return echt.apply(this, args);
  };
});

// Das Quadrat, weil seine Phasen alle vier Sekunden dauern: Damit lässt sich
// der Übergang von "Einatmen" zu "Halten" in vertretbarer Zeit abwarten,
// ohne den Testlauf um eine halbe Minute zu verlängern.
await page.locator('[data-act="atem-uebung"][data-id="box"]').click();
await page.waitForTimeout(200);
await page.locator('[data-act="atem-runden"][data-n="2"]').click();
await page.waitForTimeout(200);
await page.locator('[data-act="atem-start"]').click();
await page.waitForTimeout(600);

check(
  (await page.locator('#atemWort').textContent()).trim() === 'Einatmen',
  'die erste Phase ist Einatmen',
);
check(
  (await page.locator('#atemRunde').textContent()).includes('Runde 1 von 2'),
  'die Runde steht dabei',
);
check(
  await page.locator('#atemKreis').getAttribute('data-art') === 'ein',
  'der Kreis weiß, welche Phase läuft',
);
const zahl = Number(await page.locator('#atemZahl').textContent());
check(zahl >= 1 && zahl <= 4, `der Zähler läuft rückwärts (${zahl})`);
check(await page.evaluate(() => window.__toene) > 0, 'es wird ein Ton erzeugt');
check(
  await page.locator('[data-act="atem-uebung"]').count() === 0,
  'während der Übung steht nichts auf dem Bildschirm als der Kreis – keine Auswahl',
);
await page.screenshot({ path: `${SHOT}/93-atem.png` });

await page.waitForTimeout(4200);
check(
  (await page.locator('#atemWort').textContent()).trim() === 'Halten',
  'nach vier Sekunden kommt das Halten',
);

/* ---------- Abbrechen und Verlassen ---------- */

await page.locator('[data-act="atem-stopp"]').click();
await page.waitForTimeout(300);
check(
  (await page.locator('#atemWort').textContent()).includes('Bereit'),
  'nach dem Abbrechen steht wieder die Einladung da',
);

await page.locator('[data-act="atem-start"]').click();
await page.waitForTimeout(500);
const vorher = await page.evaluate(() => window.__toene);
await page.locator('[data-act="tab"][data-tab="heute"]').click();
await page.waitForTimeout(2500);
const nachher = await page.evaluate(() => window.__toene);
check(
  nachher === vorher,
  `beim Wechseln des Reiters hört die Übung auf (${vorher} → ${nachher} Töne)`,
);

/* ---------- Ohne Ton geht es auch ---------- */

await page.locator('[data-act="tab"][data-tab="mehr"]').click();
await page.waitForTimeout(250);
await page.locator('[data-act="ton"]').click();
await page.waitForTimeout(250);
await page.locator('[data-act="tab"][data-tab="ruhe"]').click();
await page.waitForTimeout(250);
check(
  (await page.locator('#view').textContent()).includes('Der Ton ist gerade aus'),
  'ist der Ton aus, sagt die App das – sonst wartet jemand mit geschlossenen Augen auf ein Signal',
);
const vorStumm = await page.evaluate(() => window.__toene);
await page.locator('[data-act="atem-start"]').click();
await page.waitForTimeout(800);
check(
  await page.evaluate(() => window.__toene) === vorStumm,
  'und dann kommt auch keiner',
);
check(
  (await page.locator('#atemWort').textContent()).trim() === 'Einatmen',
  'die Übung läuft trotzdem, nur stumm',
);
await page.locator('[data-act="atem-stopp"]').click();

check(fehler.length === 0, `keine Fehler${fehler.length ? `: ${fehler.join(' | ')}` : ''}`);
await browser.close();
ende();
