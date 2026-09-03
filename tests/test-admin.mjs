/* Rückkanal und Betreiber-Übersicht – mit vorgetäuschtem Supabase. */
import { chromium } from 'playwright';
import { URL, SHOT } from './umgebung.mjs';
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 414, height: 896 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();

// Der Rückkanal ist von lokalen Adressen aus abgeschaltet (siehe hatServer() in
// js/config.js) – sonst hätte jeder Testlauf echte Geräte gemeldet. Diese Datei
// prüft ihn aber, also schaltet sie ihn ausdrücklich frei.
await ctx.addInitScript(() => localStorage.setItem('workout.rueckkanal.lokal', '1'));
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
p.on('console', (m) => m.type()==='error' && console.log('CONSOLE', m.text()));

// Supabase vortäuschen: config.js füllen und fetch abfangen
/*
 * Die Vorgabezeilen tragen *relative* Daten, keine festen.
 *
 * Hier standen einmal '2026-08-25' und Nachbarn, und die Prüfung „drei davon in
 * den letzten sieben Tagen" hielt genau neun Tage. Danach lagen alle Zeilen
 * außerhalb des Fensters, die Zahl kippte auf 0, und der Test meldete einen
 * Fehler in der App, wo keiner war – der dritte dieser Sorte in diesem Repo
 * (siehe test-calendar.mjs und test-ics.mjs).
 *
 * Gemessen wird ein Abstand, also gehört ein Abstand in die Vorgabe.
 */
const vorTagen = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

await ctx.route('**/rest/v1/**', async (route) => {
  const url = route.request().url();
  if (url.includes('rpc/admin_liste')) {
    const body = JSON.parse(route.request().postData() || '{}');
    if (body.pass !== 'geheim') return route.fulfill({ status: 401, body: 'nope' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
      { id:'a', name:'Alex', fokus:'Bauch, Beine, Po', stufe:'Anfänger', einheiten:9, plan:84, saetze:160, volumen:23000, serie:4, zuletzt:vorTagen(3), geteilt:2, freunde:1, uebungen:{'floor-press':12,'chin-ups':9}, gesehen:`${vorTagen(2)}T10:00:00Z` },
      { id:'b', name:'Mia', fokus:'Kurz und knapp', stufe:'Geübt', einheiten:3, plan:96, saetze:54, volumen:4200, serie:1, zuletzt:vorTagen(22), geteilt:0, freunde:0, uebungen:{'goblet-squat':6}, gesehen:`${vorTagen(20)}T10:00:00Z` },
      { id:'x', name:'<img src=x onerror="window.__xss=1">', fokus:'<b>fett</b>', stufe:'—',
        einheiten:'<img src=x onerror="window.__xss=2">', plan:'"><script>window.__xss=3</script>',
        saetze:'<svg onload="window.__xss=4">', volumen:0, serie:0, zuletzt:vorTagen(4), geteilt:0, freunde:0,
        uebungen:{'floor-press':'<img src=x onerror="window.__xss=5">'}, gesehen:`${vorTagen(2)}T10:00:00Z` },
      { id:'c2', name:'tobi ', fokus:'Ausgewogen', stufe:'Geübt', einheiten:0, plan:84, saetze:9, volumen:0, serie:0, zuletzt:null, geteilt:0, freunde:0, uebungen:{'chin-ups':3}, gesehen:vorTagen(1) },
      { id:'c', name:'Tobi', fokus:'Ausgewogen', stufe:'Geübt', einheiten:1, plan:84, saetze:18, volumen:900, serie:1, zuletzt:vorTagen(2), geteilt:5, freunde:2, uebungen:{'floor-press':3}, gesehen:`${vorTagen(2)}T18:00:00Z` },
    ]) });
  }
  return route.fulfill({ status: 201, body: '' });
});
await p.addInitScript(() => { window.__configPatch = true; });
await p.goto(URL, { waitUntil: 'networkidle' });
// config.js im Modulcache ist schon geladen – wir setzen sie über den Import
await p.evaluate(async () => {
  const c = await import('./js/config.js');
  c.CONFIG.url = 'https://test.supabase.co';
  c.CONFIG.key = 'anon-test';
});
// Die Freigabe muss den clear() überleben – ohne sie hält hatServer() diese
// Seite für einen Testlauf und schaltet den Rückkanal ab, zu Recht.
await p.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('workout.rueckkanal.lokal', '1');
  localStorage.setItem('workout.state.v1', '{"greeted":true,"name":"Tobi"}');
});
await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('workout.state.v1')); localStorage.setItem('workout.state.v1', JSON.stringify(s)); });
await p.locator('.tab[data-tab="settings"]').click();
await p.waitForTimeout(300);
check(await p.locator('[data-act="toggle-share"]').count() === 1, 'Schalter zum Teilen steht unter Mehr');
check((await p.locator('#view').textContent()).includes('gehen dein Name'),
  'und sagt in einem Satz, was rausgeht');
check(await p.locator('[data-act="go-tab"][data-tab="admin"]').count() === 1, 'Übersicht erreichbar');
await p.locator('[data-act="go-tab"][data-tab="admin"]').click();
await p.waitForTimeout(300);
await p.locator('#adminPass').fill('falsch');
await p.locator('[data-act="admin-open"]').click();
await p.waitForTimeout(400);
check((await p.locator('#view').textContent()).includes('Passwort falsch'), 'falsches Passwort wird abgewiesen');
await p.locator('#adminPass').fill('geheim');
await p.locator('[data-act="admin-open"]').click();
await p.waitForTimeout(500);
const zahlen = (await p.locator('.stat').allTextContents()).join(' | ').replace(/\s+/g, ' ');
console.log('     ', zahlen);
check(/5Ger/.test(zahlen.replace(/\s/g, '')), 'fünf Geräte gezählt');
check(/^4Personen/.test(zahlen.replace(/\s/g, '')), 'aber nur vier Personen');
check(/3inden/.test(zahlen.replace(/\s/g, '')), 'drei davon in den letzten sieben Tagen');
const zeilen = await p.locator('.vgl tbody tr').count();
check(zeilen === 4, `die Tabelle zeigt vier Zeilen, nicht fünf (${zeilen})`);
const tobi = p.locator('.vgl tbody tr').filter({ hasText: 'Tobi' });
check(await tobi.count() === 1, 'Tobi steht genau einmal da');
check((await tobi.textContent()).includes('2 Geräte'), 'mit dem Vermerk "2 Geräte"');
// Gerät "c" hat 18 Sätze, "c2" hat 9 – gezeigt wird das Maximum, nicht die Summe.
const zahlenTobi = (await tobi.textContent()).match(/\d+/g).join(' ');
check(zahlenTobi.includes('18') && !zahlenTobi.includes('27'),
  `das Maximum der beiden Geräte, nicht ihre Summe (${zahlenTobi})`);
check((await p.locator('.vgl').textContent()).includes('Alex'), 'Liste zeigt die Namen');
check((await p.locator('.bars').textContent()).includes('Floor Press'), 'meistgemachte Übungen zusammengezählt');

// --- Was vom Server kommt, ist fremder Text ---
const xss = await p.evaluate(() => window.__xss || null);
check(xss === null, `nichts aus der Tabelle wird als HTML ausgeführt (${xss === null ? 'sauber' : 'AUSGEFÜHRT: ' + xss})`);
const roh = await p.locator('#view').innerHTML();
check(!/<img src=x|<svg onload|<script>window/.test(roh),
  'und es steht auch kein fremdes Element im Dokument');
const sicht = await p.locator('#view').textContent();
check(sicht.includes('<img src=x'), 'der Text selbst wird angezeigt, nur eben als Text');

await p.locator('[data-act="admin-logout"]').click();
await p.waitForTimeout(300);
check(await p.locator('#adminPass').count() === 1, '"Passwort vergessen" schließt wieder ab');

// --- Das Passwort steht nicht im gespeicherten Zustand ---
await p.locator('#adminPass').fill('geheim');
await p.locator('[data-act="admin-open"]').click();
await p.waitForTimeout(500);
check((await p.locator('.vgl').textContent()).includes('Alex'), 'wieder offen');
const imSpeicher = await p.evaluate(() => localStorage.getItem('workout.state.v1') || '');
check(!imSpeicher.includes('geheim'), 'das Passwort liegt nicht im dauerhaften Speicher');
const imTab = await p.evaluate(() => sessionStorage.getItem('workout.adminPass'));
check(imTab === 'geheim', 'sondern nur im Tab-Speicher, solange er offen ist');
const sicherung = await p.evaluate(async () => (await import('./js/store.js')).exportJSON());
check(!sicherung.includes('geheim') && !sicherung.includes('adminPass'),
  'und es steht nicht in der Sicherungsdatei');
await p.screenshot({ path: `${SHOT}/66-admin.png`, fullPage: true });

console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
await b.close();
