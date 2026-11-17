/*
 * Gemeinsames für die Tests von Mahlzeit (tests/test-mz-*.mjs).
 *
 * Heißt nicht test-…, damit tests/lauf.mjs die Datei nicht selbst startet.
 * Stellt bereit: die Adresse der App, einen Browser mit fester Uhr (dieselbe
 * wie für die Schilddrüsen-App: __testtag und __testzeit im localStorage),
 * mitgeschriebene Dialoge und check() mit der Ausgabe, die lauf.mjs zählt.
 */
import { chromium } from 'playwright';
import { URL as WORKOUT_URL } from './umgebung.mjs';
import { uhrStellen, plus } from './sd-hilfe.mjs';

export { plus };

export const MZ_URL = process.env.MAHLZEIT_URL
  || WORKOUT_URL.replace(/index\.html$/, 'mahlzeit/index.html');

export const SCHLUESSEL = 'mahlzeit.stand.v1';

export function pruefer() {
  let fails = 0;
  let oks = 0;
  const check = (c, m) => {
    console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`);
    if (c) oks++; else { fails++; process.exitCode = 1; }
  };
  const ende = () => {
    console.log(`\n${oks} OK, ${fails} FAIL`);
    if (fails) process.exitCode = 1;
  };
  return { check, ende };
}

/*
 * Vor dem ersten Laden: Tag, Uhrzeit, Stand und weitere Schlüssel in den
 * Speicher – nur einmal je Kontext, damit ein Neuladen nicht zurücksetzt,
 * was der Test inzwischen eingetragen hat.
 */
function vorbereiten({ tag, zeit, stand, schluessel, weitere }) {
  try {
    if (localStorage.getItem('__mz_vorbereitet')) return;
    localStorage.setItem('__mz_vorbereitet', '1');
    if (tag) localStorage.setItem('__testtag', tag);
    if (zeit) localStorage.setItem('__testzeit', zeit);
    if (stand) localStorage.setItem(schluessel, JSON.stringify(stand));
    Object.entries(weitere || {}).forEach(([k, v]) => localStorage.setItem(k, v));
  } catch { /* about:blank */ }
}

/**
 * Einen Browser starten und Mahlzeit öffnen.
 * Dialoge (confirm, prompt) beantwortet `dialog.antwort` (true/false) bzw.
 * `dialog.text` für prompt; mitgeschrieben in `dialoge`.
 */
export async function oeffne({
  tag = '2026-11-17', zeit = '08:15', stand = null, weitere = null,
  viewport = { width: 390, height: 844 }, url = MZ_URL,
} = {}) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport, locale: 'de-DE', acceptDownloads: true, serviceWorkers: 'block' });
  await ctx.addInitScript(vorbereiten, { tag, zeit, stand, schluessel: SCHLUESSEL, weitere });
  await ctx.addInitScript(uhrStellen);
  const page = await ctx.newPage();
  const fehler = [];
  const dialoge = [];
  const dialog = { antwort: true, text: '' };
  page.on('pageerror', (e) => fehler.push(`PAGEERROR: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') fehler.push(`CONSOLE: ${m.text()}`); });
  page.on('dialog', async (d) => {
    dialoge.push(d.message());
    if (d.type() === 'prompt') await d.accept(dialog.text);
    else if (dialog.antwort) await d.accept();
    else await d.dismiss();
  });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForSelector('html[data-bereit="1"]');
  const gespeichert = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), SCHLUESSEL);
  return { browser, ctx, page, fehler, dialoge, dialog, gespeichert };
}

/** Die angezeigte Tagessumme als Zahl. */
export async function summe(page) {
  return Number((await page.locator('#summe-kcal').innerText()).replace(/\./g, ''));
}

/** Über die Suche eine Sache eintragen: Suchwort, Treffer mit diesem Namen, Menge. */
export async function eintragen(page, wort, name, menge = 1) {
  if (!(await page.locator('#suche').isVisible())) await page.click('#essen-knopf');
  await page.fill('#suche', wort);
  await page.locator('#trefferliste .sache', { hasText: name }).first().click();
  if (menge !== 1) await page.click(`[data-tun="menge"][data-m="${menge}"]`);
  await page.click('#eintragen');
  await page.waitForSelector('#eingetragen');
}
