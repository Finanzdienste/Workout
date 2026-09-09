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
 * Geprüft wird beides und dazu die Grenze: Die App schickt von selbst nichts
 * irgendwohin. Ein vollständiger Trainingsverlauf geht nur dorthin, wohin er
 * ausdrücklich geschickt wird.
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
check(geteilt && /^workout-backup-\d{4}-\d{2}-\d{2}\.json$/.test(geteilt.name || ''),
  `als Datei mit sprechendem Namen (${geteilt && geteilt.name})`);
check(geteilt && geteilt.typ === 'application/json', 'und dem richtigen Typ');
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

// --- 4. Von selbst geht nichts hinaus -----------------------------------
//
// Der Rückkanal an den Betreiber trägt eine Handvoll Zahlen und ist abschaltbar.
// Ein vollständiger Verlauf ist etwas anderes; er darf nirgendwo automatisch
// landen. Geprüft am Netzverkehr, nicht am Vorsatz.
const raus = gesendet.slice();
console.log(`     Netzaufrufe nach draußen: ${raus.length}`);
check(raus.every((u) => !/backup/i.test(u)),
  'keine Sicherung verlässt das Gerät von selbst');

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`);
await browser.close();
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
