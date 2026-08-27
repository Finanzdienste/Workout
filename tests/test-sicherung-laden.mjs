/*
 * Eine Sicherungsdatei wieder einlesen.
 *
 * Die App konnte eine Datei schreiben, aber nicht lesen – der Import nahm nur
 * eingefügten Text. Auf dem Rechner ist das lästig, auf dem Handy eine Sperre:
 * Wer von einem Browser in die installierte App umzieht, müsste einen langen
 * JSON-Block von Hand markieren. Genau dieser Umzug ist aber der häufigste
 * Grund, überhaupt eine Sicherung zu brauchen.
 *
 * Geprüft wird der ganze Weg: sichern, in einem *frischen* Browser einlesen,
 * und nachsehen, ob wirklich alles wieder da ist – Name, Stufe, Fokus und die
 * abgehakten Sätze. Dazu der Fall, der es in der Praxis auslöst: Die
 * Einrichtung steht noch offen, und der Import muss sie beenden.
 */
import { chromium } from 'playwright';
import { URL, ABLAGE } from './umgebung.mjs';
import { writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 414, height: 896 }, acceptDownloads: true,
});
await ctx.route('**/rest/v1/**', (r) => r.fulfill({ status: 204, body: '' }));
let page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
page.on('dialog', (d) => d.accept().catch(() => {}));
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

const zuDaten = async () => {
  await page.locator('.tab[data-tab="settings"]').click();
  await page.waitForTimeout(400);
};

// --- 1. Auf dem "alten Gerät": Stand anlegen und sichern ---------------
await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.setItem('workout.state.v1', JSON.stringify({
  greeted: true, name: 'Tobi', level: 'anfaenger', focus: 'cut', theme: 'gruen',
})));
await page.reload({ waitUntil: 'networkidle' });

const gesetzt = await page.evaluate(async () => {
  const s = await import('./js/store.js');
  const { PLAN } = await import('./js/data.js');
  const w = PLAN[0];
  w.ex.forEach((it) => s.updateSet(1, 'db', it.id, it.sets, 0, { done: true, w: '22' }));
  s.markDone(1, 'db');
  return w.ex.length;
});
check(gesetzt > 0, `${gesetzt} Übungen abgehakt`);

await zuDaten();
const [dl] = await Promise.all([
  page.waitForEvent('download'),
  page.locator('[data-act="download"]').first().click(),
]);
const datei = path.join(ABLAGE, 'sicherung-test.json');
rmSync(datei, { force: true });
await dl.saveAs(datei);
check(dl.suggestedFilename().endsWith('.json'), `Sicherung erzeugt (${dl.suggestedFilename()})`);

// --- 2. Auf dem "neuen Gerät" ------------------------------------------
// Ein eigener Browserkontext statt eines geleerten Speichers: Genau das ist
// die Lage, um die es geht – ein anderer Browser oder die frisch installierte
// App teilen sich mit dem alten nichts.
const ctx2 = await browser.newContext({ viewport: { width: 414, height: 896 }, acceptDownloads: true });
await ctx2.route('**/rest/v1/**', (r) => r.fulfill({ status: 204, body: '' }));
await page.close();
page = await ctx2.newPage();
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
page.on('dialog', (d) => d.accept().catch(() => {}));
await page.goto(URL, { waitUntil: 'networkidle' });
const willkommen = (await page.locator('#view').textContent()).replace(/\s+/g, ' ');
check(/Willkommen|Einrichten/i.test(willkommen),
  `frischer Start zeigt die Einrichtung (${willkommen.slice(0, 50)}…)`);

// Der Knopf muss auch dann erreichbar sein – sonst müsste man sich erst durch
// vier Schritte klicken, die der Import gleich wieder überschreibt.
await zuDaten();
const knopf = page.locator('[data-act="import-file"]');
check(await knopf.count() > 0, 'der Knopf „Datei laden" steht in den Daten');

// --- 3. Datei einlesen -------------------------------------------------
const [chooser] = await Promise.all([
  page.waitForEvent('filechooser'),
  knopf.first().click(),
]);
await chooser.setFiles(datei);
await page.waitForTimeout(600);

const zurueck = await page.evaluate(async () => {
  const s = (await import('./js/store.js')).getState();
  const erste = s.log[1] && s.log[1].db ? Object.values(s.log[1].db) : [];
  return {
    name: s.name, level: s.level, focus: s.focus, theme: s.theme, greeted: s.greeted,
    abgehakt: erste.reduce((a, arr) => a + arr.filter((x) => x.done).length, 0),
    gewicht: (erste[0] || [])[0] && erste[0][0].w,
  };
});
check(zurueck.name === 'Tobi', `der Name ist zurück (${zurueck.name})`);
check(zurueck.level === 'anfaenger', `die Erfahrungsstufe ist zurück (${zurueck.level})`);
check(zurueck.focus === 'cut', `der Trainingsfokus ist zurück (${zurueck.focus})`);
check(zurueck.theme === 'gruen', `das Farbdesign ist zurück (${zurueck.theme})`);
check(zurueck.abgehakt === gesetzt, `alle ${gesetzt} abgehakten Sätze sind zurück (${zurueck.abgehakt})`);
check(zurueck.gewicht === '22', `und die eingetragenen Gewichte (${zurueck.gewicht})`);

// --- 4. Die Einrichtung ist damit erledigt -----------------------------
check(zurueck.greeted === true, 'der eingelesene Stand gilt als eingerichtet');
await page.locator('.tab[data-tab="dashboard"]').click();
await page.waitForTimeout(400);
const dash = (await page.locator('#view').textContent()).replace(/\s+/g, ' ');
check(!/Einrichten · Schritt/.test(dash),
  `die Startseite zeigt nicht mehr die Einrichtung (${dash.slice(0, 60)}…)`);

// --- 5. Kaputte Datei kippt den Stand nicht um -------------------------
const mist = path.join(ABLAGE, 'sicherung-kaputt.json');
writeFileSync(mist, '{ das ist kein JSON');
const [chooser2] = await Promise.all([
  page.waitForEvent('filechooser'),
  (await zuDaten(), page.locator('[data-act="import-file"]').first().click()),
]);
await chooser2.setFiles(mist);
await page.waitForTimeout(500);
const heil = await page.evaluate(async () => (await import('./js/store.js')).getState().name);
check(heil === 'Tobi', `nach einer kaputten Datei steht der alte Stand noch (${heil})`);

rmSync(datei, { force: true });
rmSync(mist, { force: true });
check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.join(' | ') : ''}`);
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
await browser.close();
