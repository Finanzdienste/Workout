/*
 * Die Übersichtsseite mit allen Bewegungsbildern.
 *
 * Sie ist Werkzeug, kein Feature: Wer die Übungen macht, soll in fünf Minuten
 * alle durchsehen können, statt sich durch 84 Einheiten zu klicken. Genau daran
 * ist der Überkopf-Trizepsstrecker monatelang vorbeigelaufen – die Figur hielt
 * zwei Kurzhanteln über den Kopf, und niemand hat es gesehen.
 *
 * Geprüft wird deshalb das, was die Seite leisten muss: dass wirklich *jede*
 * Übung darauf steht, in beiden Fassungen, und dass jede eine gezeichnete Figur
 * bekommt. Eine Übersicht mit Lücken wäre schlimmer als keine – man verlässt
 * sich darauf, dass man alles gesehen hat.
 */
import { chromium } from 'playwright';
import { URL } from './umgebung.mjs';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 900, height: 1200 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

await page.goto(`${URL.replace(/index\.html$/, '')}figuren.html`, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

const anzahl = await page.evaluate(async () => (await import('./js/data.js')).EXERCISES.length);
check(anzahl === 24, `der Katalog hat ${anzahl} Übungen`);

// --- Hantel-Fassung ------------------------------------------------------
check(await page.locator('.karte').count() === anzahl,
  `jede Übung hat eine Karte (${await page.locator('.karte').count()})`);
const mitFigur = await page.locator('.karte svg.fig').count();
check(mitFigur === anzahl, `und jede eine gezeichnete Figur (${mitFigur})`);

const namenDb = (await page.locator('.karte h2').allTextContents()).map((s) => s.trim());
check(new Set(namenDb).size === anzahl, 'ohne Doppelte');
check(namenDb.includes('Überkopf-Trizepsstrecker'),
  'darunter die Übung, an der die Idee hängt');

// Das Gerät steht dabei – sonst sieht man zwar die Bewegung, aber nicht, ob
// die Figur das richtige in der Hand hält.
const fuss = (await page.locator('.karte .unten').allTextContents()).join(' | ');
check(/SZ-Stange/.test(fuss), 'der Gerätetext steht an der Karte');
check(/barbell/.test(fuss), 'und das gezeichnete Gerät dazu');

// --- Bodyweight-Fassung --------------------------------------------------
await page.locator('.modus button[data-modus="bw"]').click();
await page.waitForTimeout(600);
check(await page.locator('.karte').count() === anzahl,
  'im Bodyweight-Modus stehen ebenso viele Karten');
const mitFigurBw = await page.locator('.karte svg.fig').count();
check(mitFigurBw === anzahl, `und ebenso viele Figuren (${mitFigurBw})`);
const namenBw = (await page.locator('.karte h2').allTextContents()).map((s) => s.trim());
check(namenBw.join() !== namenDb.join(), 'die Namen sind andere – es ist wirklich die zweite Fassung');
check(namenBw.includes('Band-Schulterdrücken'),
  'darunter die Bandfassung des Schulterdrückens');

// Die beiden heute korrigierten stehen im Stehen da, nicht auf einer Bank.
const stehend = await page.evaluate(async () => {
  const { EXERCISES } = await import('./js/data.js');
  const holen = (id, m) => EXERCISES.find((e) => e.id === id)[m].pattern;
  return {
    seitheben: holen('band-seitheben', 'bw'),
    druecken: holen('sitzendes-schulterdruecken', 'bw'),
    hantelDruecken: holen('sitzendes-schulterdruecken', 'db'),
  };
});
check(stehend.seitheben === 'lateralstand',
  `Band-Seitheben steht (${stehend.seitheben})`);
check(stehend.druecken === 'ohpstand',
  `die Bandfassung des Schulterdrückens auch (${stehend.druecken})`);
check(stehend.hantelDruecken === 'ohp',
  `die Hantelfassung sitzt weiterhin – sie heißt ja auch so (${stehend.hantelDruecken})`);

await page.screenshot({ path: '.testlauf/figuren.png', fullPage: true });

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`);
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
await browser.close();
