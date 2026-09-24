/*
 * Während der Pause sind die Satz-Knöpfe erreichbar.
 *
 * Gefunden bei der Durchsicht der App: In der Fokusansicht wächst die Figur,
 * bis die Satz-Knöpfe genau am unteren Rand stehen – und dort liegt während der
 * Pause die Leiste. Ein Tipp auf die Mitte jedes Knopfs traf bei 360, 390 und
 * 414 Pixel Breite die Leiste statt den Knopf. Wer vor Ablauf der Pause den
 * nächsten Satz abhaken wollte, musste erst „Fertig" drücken oder scrollen –
 * gegen das Versprechen „ein Griff pro Satz".
 *
 * Geprüft wird, was ein Finger trifft: elementFromPoint auf die Mitte jedes
 * Knopfs, ohne zu scrollen.
 */
import { chromium } from 'playwright';
import { URL } from './umgebung.mjs';

const browser = await chromium.launch();
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };
const errs = [];

for (const [w, h] of [[360, 740], [390, 844], [414, 896]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    localStorage.clear();
    const s = await import('./js/store.js');
    s.setSetting('greeted', true);
    s.setSetting('name', 'T');
    s.flush();
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-act="start-session"]').first().click();
  await page.waitForTimeout(600);
  await page.locator('.focus-set').first().click();
  await page.waitForTimeout(600);
  const r = await page.evaluate(() => ({
    pause: !document.getElementById('restBar').hidden,
    scrollY: window.scrollY,
    treffer: [...document.querySelectorAll('.focus-set')].map((bt) => {
      const q = bt.getBoundingClientRect();
      const e = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2);
      return e === bt || bt.contains(e);
    }),
  }));
  check(r.pause, `${w}×${h}: die Pause läuft`);
  check(r.scrollY === 0 && r.treffer.length > 0 && r.treffer.every(Boolean),
    `${w}×${h}: jeder Satz-Knopf ist ohne Scrollen antippbar (${r.treffer.map((x) => (x ? '✓' : '✗')).join(' ')})`);
  await page.close();
}

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`);
await browser.close();
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
