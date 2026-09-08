/*
 * Eine Figur als Bild – fünf Standbilder über den Bewegungsablauf.
 *
 * tools/pose.mjs sagt, wo die Gelenke liegen; das hier zeigt, wie es aussieht.
 * Beides zusammen ist der Unterschied zwischen „die Zahlen stimmen" und „man
 * erkennt die Übung": Eine Stellung kann rechnerisch passen und trotzdem aus
 * dem gewählten Blickwinkel unlesbar sein, weil ein Bein das andere verdeckt.
 *
 *     python3 -m http.server 8399 --bind 127.0.0.1 &
 *     node tools/figur-bild.mjs thrust hipbar .testlauf/thrust.png 0,0

 * Das letzte Feld ist der Blickwinkel (yaw,pitch) und übergeht den des Musters –
 * nützlich, um eine Stellung einmal von der reinen Seite anzusehen.
 *
 * Läuft absichtlich gegen einen laufenden Server und nicht gegen file:// –
 * die Figur steckt in einem ES-Modul, und das lädt der Browser von der Platte
 * nicht.
 */
import { chromium } from 'playwright';

const muster = process.argv[2] || 'thrust';
const equip = process.argv[3] || '';
const ziel = process.argv[4] || `.testlauf/figur-${muster}.png`;
const URL = process.env.WORKOUT_URL || 'http://127.0.0.1:8399/index.html';

const browser = await chromium.launch();
const gross = process.env.FIG_GROSS === '1';
// reducedMotion: sonst überschreibt die laufende Animation die gesetzten
// Zeitpunkte sofort wieder – alle Kästen zeigten dieselbe Stellung.
const page = await browser.newPage({
  viewport: { width: gross ? 700 : 1000, height: gross ? 460 : 220 },
  reducedMotion: 'reduce',
});
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
if (gross) await page.evaluate(() => { window.__figN = 2; window.__figS = 330; });

const blick = process.argv[5] ? process.argv[5].split(',').map(Number) : null;

await page.evaluate(async ([m, eq, view]) => {
  const { mountFigure, PATTERNS } = await import('./js/figure.js');
  if (view) PATTERNS[m].view = view;
  document.body.innerHTML = '<div id="reihe" style="display:flex;gap:8px;padding:8px;'
    + 'background:#0f1115;margin:0"></div>';
  const reihe = document.getElementById('reihe');
  const n = window.__figN || 5;
  for (let i = 0; i < n; i++) {
    const d = document.createElement('div');
    d.style.cssText = `width:${window.__figS || 190}px;height:${window.__figS || 190}px;background:#151922;border-radius:10px`;
    d.className = 'fig-wrap';
    reihe.appendChild(d);
    mountFigure(d, m, true, eq || null);
  }
}, [muster, equip, blick]);

await page.waitForTimeout(500);
// Fünf Kästen, fünf Zeitpunkte – Standbilder statt Animation.
await page.evaluate(() => {
  document.querySelectorAll('.fig-wrap').forEach((d, i) => {
    const n = document.querySelectorAll('.fig-wrap').length;
    if (d.__figEntry) d.__figEntry.draw(n > 1 ? i / (n - 1) : 0);
  });
});
await page.waitForTimeout(150);
await page.screenshot({ path: ziel });
await browser.close();
console.log('geschrieben:', ziel);
