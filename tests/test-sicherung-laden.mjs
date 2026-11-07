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

// --- 6. Sicherung aus einem älteren Planstand, gleicher Fokus -------------
// Neu geladen wurde nach dem Import nur bei anderem Fokus. Beim Start läuft
// aber auch der Planwechsel samt Reparaturen, und zwar nur dort. Eine
// Sicherung unter dem Cut a51fd2 mit angefangener Einheit zeigte deshalb bis
// zum nächsten Öffnen die Übungen des neuen Plans; wer weitertrainierte,
// bekam danach die alte Liste festgeschrieben und eine schon gemachte Übung
// offen daneben. Jetzt ist der eingelesene Stand ein Start wie jeder andere.
const alt = await page.evaluate(async () => {
  const { PLANS } = await import('./js/data.js');
  const k = (PLANS.cut.vorher || []).find((x) => x.stand === 'a51fd2af0bfc');
  if (!k) return null;
  const n = k.ex.findIndex((l, i) => l.length >= 3
    && l.map(([id]) => id).join() !== PLANS.cut.plan[i].ex.map((x) => x.id).join()) + 1;
  return { n, ids: k.ex[n - 1].map(([id]) => id), jetzt: PLANS.cut.stand };
});
if (!alt) {
  console.log('     der Cut a51fd2 liegt nicht in der Kette – 6. entfällt');
} else {
  await zuDaten();
  await page.evaluate(({ n, ids }) => {
    const roh = JSON.parse(document.getElementById('io').value || '{}');
    const s = { ...roh, greeted: true, focus: 'cut', planStand: { cut: 'a51fd2af0bfc' }, log: { [n]: {
      mode: 'db', startedOn: '2026-10-01', bw: {},
      db: { [ids[0]]: [{ w: '20', done: true }, {}, {}], [ids[1]]: [{}, {}, {}] },
      soll: { [ids[0]]: 3, [ids[1]]: 3 },
    } } };
    document.getElementById('io').value = JSON.stringify(s);
  }, alt);
  // Nicht auf das Neuladen warten, sondern auf die Zeit, die es braucht –
  // bleibt es aus, sollen die Prüfungen unten das sagen, nicht ein Zeitlimit.
  await page.locator('[data-act="import"]').first().click();
  await page.waitForTimeout(1500);
  await page.waitForLoadState('networkidle');
  const nach = await page.evaluate(async (n) => {
    const s = (await import('./js/store.js')).getState();
    const { workoutByNo } = await import('./js/plan.js');
    return {
      fest: ((s.log[n] || {}).fest || []).map((x) => x.id),
      festAus: (s.log[n] || {}).festAus,
      planStand: (s.planStand || {}).cut,
      zeigt: workoutByNo(n, 'db').ex.map((x) => x.id),
      toast: (document.getElementById('toast') || {}).textContent || '',
    };
  }, alt.n);
  check(nach.planStand === alt.jetzt, `nach dem Import lief der Planwechsel (planStand ${nach.planStand})`);
  check(nach.fest.join() === alt.ids.join() && nach.festAus === 'a51fd2af0bfc',
    `die angefangene Einheit ${alt.n} steht mit ihrer alten Liste fest (${nach.fest.length} von ${alt.ids.length})`);
  check([...nach.zeigt].sort().join() === [...alt.ids].sort().join(),
    'und die App zeigt sie so – nicht die Übungen des neuen Plans');
  check(/Import erfolgreich/.test(nach.toast), `die Meldung kommt nach dem Neuladen („${nach.toast.trim()}")`);
}

rmSync(datei, { force: true });
rmSync(mist, { force: true });
check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.join(' | ') : ''}`);
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
await browser.close();
