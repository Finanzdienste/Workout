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
 * `dialog.text` für prompt; mitgeschrieben in `dialoge`. `kontext` geht an
 * newContext (etwa userAgent), `skripte` laufen vor jeder Seite. `ki: true`
 * schaltet die KI ein, die in der App aus ist, bis die Funktion sagt, dass sie
 * eingerichtet ist (js/ki.js, v8/v11) – so bleiben ihre Tests in Gebrauch.
 */
export async function oeffne({
  tag = '2026-11-17', zeit = '08:15', stand = null, weitere = null,
  viewport = { width: 390, height: 844 }, url = MZ_URL, kontext = {}, skripte = [], ki = false, wieEcht = false,
} = {}) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport, locale: 'de-DE', acceptDownloads: true, serviceWorkers: 'block', ...kontext });
  await ctx.addInitScript(vorbereiten, { tag, zeit, stand, schluessel: SCHLUESSEL, weitere });
  await ctx.addInitScript(uhrStellen);
  for (const skript of skripte) await ctx.addInitScript(skript);
  // Die App meldet nur von echten Handys (v15, js/lebenszeichen.js echtesGeraet) –
  // die Tests schalten das Melden ein, außer sie prüfen gerade das (wieEcht: true).
  if (!wieEcht) await ctx.addInitScript(() => { try { localStorage.setItem('__mz_lz_test', '1'); } catch { /* about:blank */ } });
  // Nie ins echte Netz: Die KI kostet Geld, Open Food Facts ist nicht unser
  // Prüfstand. Tests, die es brauchen, legen page.route darüber.
  await ctx.route(/supabase\.co|openfoodfacts\.org/, (r) => r.abort());
  // Das Lebenszeichen (v6) still annehmen – sonst stünde in jedem Test ein
  // abgebrochener Abruf als Fehler in der Konsole.
  // Die Nachfrage, was eingerichtet ist (v11): still „nichts“ – Tests mit ki: true haben den Stand schon.
  await ctx.route(/functions\/v1\/mahlzeit-ki/, (r) => (r.request().method() === 'GET'
    ? r.fulfill({ status: 200, contentType: 'application/json', body: '{"ki":false,"suche":false}', headers: { 'access-control-allow-origin': '*' } })
    : r.fallback()));
  await ctx.route(/rest\/v1\/mahlzeit_nutzung/, (r) => r.fulfill({ status: 201, body: '', headers: { 'access-control-allow-origin': '*' } }));
  // Die Werte an Tobi (v13) ebenso still annehmen.
  await ctx.route(/rest\/v1\/rpc\/mahlzeit_werte_melden/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '0', headers: { 'access-control-allow-origin': '*' } }));
  // Das Essen an Tobi (v14), nur nach „Ja“ – ebenso still annehmen.
  await ctx.route(/rest\/v1\/rpc\/mahlzeit_essen_melden/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '0', headers: { 'access-control-allow-origin': '*' } }));
  if (ki) {
    // Als hätte die Funktion gesagt: KI und Suche eingerichtet (v11) – ohne neue Nachfrage.
    await ctx.addInitScript(() => { try { localStorage.setItem('mahlzeit.kistatus.v1', JSON.stringify({ ki: true, suche: true, um: 9e15 })); } catch { /* about:blank */ } });
  }
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
