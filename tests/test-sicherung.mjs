/*
 * Zwei Arten, ein halbes Jahr Training zu verlieren – und zwei Antworten.
 *
 *   Der Browser räumt auf   Android gibt den Speicher einer selten benutzten
 *                           Seite bei Platzmangel frei. storage.persist() ist
 *                           die Bitte, das nicht zu tun.
 *   Das Gerät ist weg       Dagegen hilft nur eine Kopie woanders. Ein Download
 *                           landet im Ordner „Downloads" desselben Handys –
 *                           das ist keine Kopie, das ist dieselbe Stelle mit
 *                           einem anderen Namen.
 *
 * Geprüft wird beides und dazu das Weitergeben selbst, das bis v239 nichts tat:
 *
 *     „Wenn ich auch 'Sicherung weitergeben' klicke passiert nichts."
 *
 * Chrome teilt Dateien nur mit bestimmten Endungen und Typen; .json und
 * application/json gehören nicht dazu. canShare() sagt trotzdem ja – geprüft
 * wird erst beim share() selbst, und das lehnte mit NotAllowedError ab. Die
 * App hielt jeden Fehler für einen Abbruch und schwieg. Jetzt: .txt mit genau
 * text/plain, ein Abbruch ist nur ein AbortError, und jede andere Ablehnung
 * endet im Download samt sichtbarer Meldung mit dem Textweg.
 *
 * Und die Grenze: Ohne Server – auf localhost ist der Rückkanal gesperrt, siehe
 * js/config.js – geht von selbst nichts raus. Was mit Server automatisch und
 * verschlüsselt gesichert wird, prüft tests/test-sicherung-auto.mjs.
 */
import { chromium } from 'playwright';
import { URL } from './umgebung.mjs';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } });
const gesendet = [];
// Jeder Netzaufruf nach draußen wird mitgeschrieben – siehe Prüfung 4.
await ctx.route('**/rest/v1/**', (r) => { gesendet.push(r.request().url()); r.fulfill({ status: 204, body: '' }); });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

await page.goto(URL, { waitUntil: 'networkidle' });

// --- 1. Der Browser wird gefragt ---------------------------------------
await page.evaluate(async () => {
  const store = await import('./js/store.js');
  store.setSetting('greeted', true);
  store.setSetting('name', 'T');
  store.setSetting('tab', 'settings');
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(600);

const stand = await page.evaluate(async () => {
  const store = await import('./js/store.js');
  return {
    gemerkt: store.getState().dauerhaft,
    echt: navigator.storage && navigator.storage.persisted
      ? await navigator.storage.persisted() : null,
  };
});
console.log('     Zusage:', JSON.stringify(stand));
check(stand.gemerkt === stand.echt,
  `gemerkt wird, was der Browser wirklich sagt (${stand.gemerkt}), nicht was man hofft`);

const text = (await page.locator('#view').textContent()).replace(/\s+/g, ' ');
check(/nicht von selbst freizugeben|nichts zugesagt/.test(text),
  'und die Einstellungen sagen es im Klartext');
check(/Kopie woanders|Kopie \w+ woanders/.test(text),
  'mit der ehrlichen Ergänzung: gegen ein verlorenes Handy hilft das nicht');

// --- 2. Weitergeben statt herunterladen --------------------------------
const geteilt = await page.evaluate(async () => {
  // Das Teilen abfangen: Ein Testlauf hat keinen Dialog, aber die Frage ist,
  // *was* die App übergibt.
  window.__geteilt = null;
  navigator.canShare = () => true;
  navigator.share = async (d) => { window.__geteilt = d; };
  document.querySelector('[data-act="backup-teilen"]').click();
  await new Promise((ok) => setTimeout(ok, 400));
  const d = window.__geteilt;
  if (!d) return null;
  const datei = d.files && d.files[0];
  return { titel: d.titel || d.title, name: datei && datei.name,
           typ: datei && datei.type, inhalt: datei ? await datei.text() : '' };
});
console.log('     geteilt:', JSON.stringify({ ...geteilt, inhalt: `${(geteilt || {}).inhalt || ''}`.slice(0, 60) }));
check(!!geteilt, 'der Knopf reicht die Sicherung ans Teilen weiter');
// Chrome lässt beim Teilen nur bestimmte Endungen durch (ShareServiceImpl:
// PERMITTED_EXTENSIONS) – .json nicht, .txt schon. Und der Typ wird exakt
// verglichen: "text/plain;charset=utf-8" fiele durch.
check(geteilt && /^workout-backup-\d{4}-\d{2}-\d{2}\.txt$/.test(geteilt.name || ''),
  `als Datei mit sprechendem Namen und einer Endung, die Chrome teilt (${geteilt && geteilt.name})`);
check(geteilt && geteilt.typ === 'text/plain', `und genau dem Typ text/plain (${geteilt && geteilt.typ})`);
const inhalt = geteilt ? JSON.parse(geteilt.inhalt) : {};
check(!!inhalt && typeof inhalt === 'object' && 'weights' in inhalt,
  'darin steht der vollständige Stand, nicht nur eine Zusammenfassung');
check(!('adminPass' in inhalt),
  'aber nicht das Betreiber-Passwort – das gehört in keine Datei, die weitergereicht wird');

// --- 3. Danach gilt sie als gesichert -----------------------------------
const vermerk = await page.evaluate(async () => (await import('./js/store.js')).getState().lastBackup);
console.log('     Vermerk:', JSON.stringify(vermerk));
check(!!vermerk && !!vermerk.on,
  'erst nach dem Weitergeben gilt sie als gesichert – nicht schon beim Antippen');

// Abgebrochenes Teilen ist keine Sicherung und keine Fehlermeldung.
const abgebrochen = await page.evaluate(async () => {
  const store = await import('./js/store.js');
  store.setSetting('lastBackup', null);
  navigator.canShare = () => true;
  navigator.share = async () => { throw new DOMException('Abort', 'AbortError'); };
  document.querySelector('[data-act="backup-teilen"]').click();
  await new Promise((ok) => setTimeout(ok, 400));
  return store.getState().lastBackup;
});
check(abgebrochen === null,
  'wer das Teilen abbricht, hat nicht gesichert – und bekommt auch keine Meldung');
check(!(await page.locator('#toast.show').count()), 'keine Meldung nach dem Abbruch');

// --- 3a. Abgelehnt ist nicht abgebrochen --------------------------------
//
// Genau das passierte bei Tobi: NotAllowedError, still verschluckt. Jetzt
// geht die Sicherung als Datei raus, und die App sagt, was los war und wo der
// Text zum Kopieren steht.
await page.evaluate(async () => {
  const store = await import('./js/store.js');
  store.setSetting('lastBackup', null);
  navigator.canShare = () => true;
  navigator.share = async () => { throw new DOMException('Permission denied', 'NotAllowedError'); };
});
const [abgelehntDl] = await Promise.all([
  page.waitForEvent('download', { timeout: 3000 }).catch(() => null),
  page.locator('[data-act="backup-teilen"]').first().click(),
]);
await page.waitForTimeout(300);
check(!!abgelehntDl, `lehnt der Browser das Teilen ab, kommt die Datei als Download (${abgelehntDl && abgelehntDl.suggestedFilename()})`);
const meldung = (await page.locator('#toast').textContent()) || '';
check(/Teilen/.test(meldung) && /Mehr|Text/.test(meldung),
  `mit einer sichtbaren Meldung samt Textweg („${meldung.trim()}")`);
const hinweis = ((await page.locator('#teilenFehler').textContent().catch(() => '')) || '').replace(/\s+/g, ' ');
check(/NotAllowedError/.test(hinweis) && /Textfeld|kopieren/i.test(hinweis),
  'unter Mehr → Daten steht der Grund und der Weg über das Textfeld');
check(((await page.locator('#io').inputValue()) || '').includes('"weights"'),
  'und im Textfeld steht die Sicherung schon zum Kopieren');
check(await page.evaluate(async () => !!(await import('./js/store.js')).getState().lastBackup),
  'der Download zählt als Sicherung');

// --- 3b. Kein Teilen für Dateien: gleich der Download ------------------
await page.evaluate(async () => {
  (await import('./js/store.js')).setSetting('lastBackup', null);
  navigator.canShare = () => false;
  window.__geteilt = null;
  navigator.share = async (d) => { window.__geteilt = d; };
});
const [ohneDl] = await Promise.all([
  page.waitForEvent('download', { timeout: 3000 }).catch(() => null),
  page.locator('[data-act="backup-teilen"]').first().click(),
]);
check(!!ohneDl && !(await page.evaluate(() => window.__geteilt)),
  'sagt canShare nein, kommt ohne Umweg der Download');

// --- 3c. Was geteilt wurde, lässt sich auch wieder laden ----------------
//
// Die geteilte Datei endet auf .txt. "Datei laden" muss sie annehmen, sonst
// steht die eigene Sicherung im Dateidialog ausgegraut da.
const [waehler] = await Promise.all([
  page.waitForEvent('filechooser'),
  page.locator('[data-act="import-file"]').first().click(),
]);
const annehmen = (await waehler.element().getAttribute('accept')) || '';
check(/\.txt/.test(annehmen) && /text\/plain/.test(annehmen),
  `„Datei laden" nimmt .txt und text/plain an (${annehmen})`);
await waehler.setFiles({ name: geteilt.name, mimeType: 'text/plain', buffer: Buffer.from(geteilt.inhalt, 'utf8') });
await page.waitForLoadState('networkidle');
await page.waitForTimeout(600);
check(await page.evaluate(async () => (await import('./js/store.js')).getState().name) === 'T',
  'und die eingelesene .txt-Sicherung ist danach der Stand');

// --- 4. Von selbst geht nichts hinaus – ohne Server ---------------------
//
// Hier, auf localhost, ist der Rückkanal gesperrt: kein Server, also auch keine
// automatische Sicherung. Mit Server geht der Verlauf nur verschlüsselt raus –
// das prüft tests/test-sicherung-auto.mjs. Geprüft am Netzverkehr, nicht am
// Vorsatz.
const raus = gesendet.slice();
console.log(`     Netzaufrufe nach draußen: ${raus.length}`);
check(raus.every((u) => !/backup|sicherung/i.test(u)),
  'ohne Server verlässt keine Sicherung das Gerät');

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`);
await browser.close();
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
