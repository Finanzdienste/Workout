/*
 * Was eingetragen wurde, muss dableiben – auch in der Ein-Datei-Fassung.
 *
 * Geprüft wird die Fassung aus dist/, direkt vom Dateisystem geöffnet, mit
 * einem bleibenden Browserprofil: also genau die Lage, in der jemand die Datei
 * per Messenger bekommt und im Browser behält. Wenn hier etwas verlorengeht,
 * merkt es der Betroffene erst, wenn seine Einheit weg ist.
 *
 * Drei Stufen, weil sie verschiedene Dinge treffen können: Neuladen der Seite,
 * Schließen und Neuöffnen des Tabs, und zuletzt der Blick darauf, ob die App
 * ohne Not warnt.
 */
import { chromium } from 'playwright';
import { EINZEL, profil } from './umgebung.mjs';
import { rmSync } from 'node:fs';

// Frisches Profil: ein Rest aus dem letzten Lauf hätte die Haken schon gesetzt.
const ORT = profil('persist');
rmSync(ORT, { recursive: true, force: true });
const ctx = await chromium.launchPersistentContext(ORT, { viewport: { width: 414, height: 896 } });
let page = await ctx.pages()[0] || await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

/** Die Übungsliste steht hinter einem Tipp – ui.listView wird nicht gespeichert. */
const zurListe = async () => {
  const auf = page.locator('[data-act="show-list"]');
  if (await auf.count()) { await auf.first().click(); await page.waitForTimeout(150); }
};

await page.goto(EINZEL, { waitUntil: 'networkidle' });
// Die Begrüßung stünde sonst davor – hier geht es um das, was danach bleibt.
if (await page.locator('.welcome').count()) {
  await page.evaluate(() => {
    const k = 'workout.state.v1';
    const s = JSON.parse(localStorage.getItem(k) || '{}');
    s.greeted = true;
    localStorage.setItem(k, JSON.stringify(s));
  });
  await page.reload({ waitUntil: 'networkidle' });
}
await zurListe();

// Die erste Übung mit Kilo-Feld – Körpergewichtsübungen haben keins.
const mitKg = () => page.locator('.ex').filter({ has: page.locator('.kg-val') }).first();
await mitKg().locator('.ex-head').click();
await page.waitForTimeout(200);
const name = (await mitKg().locator('.ex-name').textContent()).trim();
// Nach einem Neuladen kann die Reihenfolge anders sein – das Umbau-Sortieren
// rechnet mit dem neuen Gewicht. Deshalb ab hier über den Namen suchen.
const uebung = () => page.locator('.ex').filter({ hasText: name }).first();
check(!!name, `Übung mit Gewicht gefunden (${name})`);

await mitKg().locator('.kg-val').fill('26');
await mitKg().locator('.set-btn').first().click();
await page.waitForTimeout(300);
check(await page.locator('.set-btn.on').count() === 1, 'ein Satz ist abgehakt');

// --- Neuladen der Seite ---
await page.reload({ waitUntil: 'networkidle' });
await zurListe();
check(await page.locator('.set-btn.on').count() === 1, 'der Haken überlebt das Neuladen');
await uebung().locator('.ex-head').click();
await page.waitForTimeout(200);
const kg = await uebung().locator('.kg-val').inputValue();
check(kg === '26', `das eingetragene Gewicht überlebt das Neuladen (${kg})`);

// --- Tab schließen und neu öffnen: die App wurde neu gestartet ---
await page.close();
page = await ctx.newPage();
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
await page.goto(EINZEL, { waitUntil: 'networkidle' });
await zurListe();
check(await page.locator('.set-btn.on').count() === 1, 'der Haken überlebt den Neustart');
check(await uebung().count() > 0, 'die Übung steht weiterhin im Plan');

// --- Kein Fehlalarm ---
// Der Warnhinweis gehört Fällen, in denen wirklich nicht gespeichert werden
// kann. Erscheint er hier, hält die App ihr eigenes Speichern für gescheitert.
check(await page.locator('.notice.warn').count() === 0, 'kein Warnhinweis, obwohl gespeichert wurde');
check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.join(' | ') : ''}`);

await ctx.close();
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
