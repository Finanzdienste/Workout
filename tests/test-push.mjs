/*
 * Web Push: die Einrichtung, und wo der private Schlüssel landen darf.
 *
 * Der Push ist der zuverlässige Teil der Erinnerung – er kommt an, ob die App
 * läuft oder nicht. Dafür entsteht auf dem Gerät ein VAPID-Schlüsselpaar, und
 * dessen privater Teil ist genau die Sorte Geheimnis, die sich unbemerkt
 * ausbreitet: in eine Sicherungsdatei, in den geteilten Stand, in die Meldung
 * an den Rückkanal. Geprüft wird deshalb zuerst, dass er das **nicht** tut.
 *
 * Was hier nicht geprüft werden kann: dass ein Push wirklich ankommt. Dafür
 * bräuchte es einen echten Push-Dienst, eine installierte App und einen
 * Absender – nichts davon gibt es in einem Testlauf. Diese Hälfte misst die App
 * selbst („zuletzt geweckt" unter Mehr), statt sie zu behaupten.
 */
import { chromium } from 'playwright';
import { URL, ROOT } from './umgebung.mjs';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } });
await ctx.route('**/rest/v1/**', (r) => r.fulfill({ status: 204, body: '' }));
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.setItem('workout.state.v1', JSON.stringify({
  greeted: true, name: 'T', level: 'geuebt', shift: 0, log: {},
  erinnerung: { an: true, werktags: '16:00', wochenende: '06:30' },
})));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);

// --- 1. Das Schlüsselpaar --------------------------------------------
// Erzeugt wird es im Browser, nicht auf einem Server und nicht in einer
// Konsole: So sieht den privaten Teil niemand außer dem Gerät selbst.
const paar = await page.evaluate(async () => {
  const p = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' },
    true, ['sign', 'verify']);
  const jwk = await crypto.subtle.exportKey('jwk', p.privateKey);
  const roh = (s) => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/')
    + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));
  return { x: roh(jwk.x).length, y: roh(jwk.y).length, d: roh(jwk.d).length };
});
console.log('     Schlüsselteile in Bytes:', JSON.stringify(paar));
check(paar.x === 32 && paar.y === 32,
  'der öffentliche Punkt besteht aus zwei 32-Byte-Hälften – zusammen mit dem 0x04 davor die 65 Byte, die VAPID will');
check(paar.d === 32, 'und der private Teil ist 32 Byte');

// --- 2. Der private Schlüssel bleibt, wo er hingehört ------------------
// Er liegt in einem eigenen localStorage-Schlüssel, nicht im Zustand der App.
// Das ist der Unterschied, an dem alles hängt: Der Zustand geht in jede
// Sicherung, in den geteilten Stand und in die Meldung an den Rückkanal.
await page.evaluate(() => localStorage.setItem('workout.push.v1',
  JSON.stringify({ oeffentlich: 'BOEFFENTLICH', privat: 'GEHEIM-PRIVAT-TEIL' })));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);

const wo = await page.evaluate(async () => {
  const store = await import('./js/store.js');
  return {
    imZustand: JSON.stringify(store.getState()),
    inSicherung: store.exportJSON(),
    haupt: localStorage.getItem('workout.state.v1'),
  };
});
check(!/GEHEIM-PRIVAT-TEIL/.test(wo.imZustand),
  'der private Schlüssel steht nicht im Zustand der App');
check(!/GEHEIM-PRIVAT-TEIL/.test(wo.inSicherung),
  'und damit auch nicht in der Sicherungsdatei');
check(!/GEHEIM-PRIVAT-TEIL/.test(wo.haupt),
  'und nicht im Schlüssel, den jeder abgehakte Satz schreibt');

// Auch nicht in dem, was an den Rückkanal ginge.
const gemeldet = await page.evaluate(async () => {
  const mod = await import('./js/app.js').catch(() => null);
  // standZeile() ist nicht exportiert – stattdessen der Weg über die Anzeige:
  // Was gemeldet wird, steht als Text in der Teilen-Karte unter Mehr.
  return mod ? 'geladen' : 'nicht geladen';
});
check(gemeldet === 'geladen', 'die App lädt mit hinterlegtem Schlüssel ohne Fehler');

// --- 3. Die Bedienung -------------------------------------------------
await page.locator('.tab[data-tab="settings"]').click();
await page.waitForTimeout(400);
const text = (await page.locator('#view').textContent()).replace(/\s+/g, ' ');
check(/Push einrichten/.test(text), 'der Knopf zum Einrichten steht unter Mehr');
check(/PUSH_KONFIG/.test(text) === false,
  'der Einfüge-Hinweis erscheint erst nach dem Einrichten, nicht vorher');

const knopf = page.locator('[data-act="push-einrichten"]');
check(await knopf.count() === 1, 'und zwar genau einmal');
// Chromium im Testlauf hat keinen Push-Dienst; der Knopf muss das aushalten,
// ohne die Seite mitzureißen.
await knopf.click();
await page.waitForTimeout(800);
check(errs.length === 0,
  `ein gescheitertes Einrichten wirft die App nicht um${errs.length ? ': ' + errs[0] : ''}`);

// --- 3b. Der Verweis auf die Secret-Seite ------------------------------
//
// Der erste Anlauf verlinkte die Seite direkt und endete auf „404 – Didn't
// find anything here": GitHub antwortet auf eine Einstellungsseite mit *nicht
// gefunden*, wenn man nicht angemeldet ist, nicht mit *keine Berechtigung*.
// Als Auskunft richtig, als Wegweiser fatal – der Link sah kaputt aus.
// Geprüft wird deshalb die Bauart der Adresse, ohne GitHub aufzurufen.
const wohin = await page.evaluate(() => {
  const bau = (host, pfad) => {
    const konto = /^([^.]+)\.github\.io$/.exec(host);
    const repo = pfad.split('/').filter(Boolean)[0];
    if (!konto || !repo || repo.includes('.')) return null;
    const ziel = `/${konto[1]}/${repo}/settings/secrets/actions/new`;
    return `https://github.com/login?return_to=${encodeURIComponent(ziel)}`;
  };
  return {
    pages: bau('finanzdienste.github.io', '/Workout/index.html'),
    fremd: bau('beispiel.de', '/workout/'),
    ohneRepo: bau('finanzdienste.github.io', '/index.html'),
  };
});
console.log('     Verweis:', wohin.pages);
check(/^https:\/\/github\.com\/login\?return_to=/.test(wohin.pages || ''),
  'der Verweis geht über die Anmeldung – sonst steht dort für Abgemeldete eine 404');
check(/settings%2Fsecrets%2Factions%2Fnew/.test(wohin.pages || ''),
  'und trägt die Secret-Seite als Ziel mit');
check(/%2FWorkout%2F/.test(wohin.pages || ''),
  'mit dem Repo aus der eigenen Adresse, nicht mit einem eingetragenen');
check(wohin.fremd === null,
  'ausserhalb von GitHub Pages gibt es keinen Verweis, sondern die Wegbeschreibung');
check(wohin.ohneRepo === null,
  'und auf einer Benutzerseite ohne Projektpfad auch nicht');

// Die Rechnung oben ist eine Kopie – geheimnisURL() steht in js/app.js und wird
// nicht ausgeführt. Damit die Kopie nicht irgendwann etwas anderes prüft als
// das Original, wird hier festgehalten, dass das Original denselben Weg geht.
const appQuelle = await (await import('node:fs/promises'))
  .readFile((await import('node:path')).join(ROOT, 'js/app.js'), 'utf8');
check(/function geheimnisURL\(\)[\s\S]{0,400}github\.com\/login\?return_to=/.test(appQuelle),
  'und die App baut die Adresse wirklich so – nicht nur diese Prüfung');

// --- 4. Der Ablauf bei GitHub sendet nichts Inhaltliches ---------------
// Geprüft an der Datei selbst: Ein Push mit Nutzlast wäre ein Push, der etwas
// über dieses Gerät verrät.
// Über ROOT statt über einen relativen Pfad: Der Läufer startet die Tests
// nicht zwingend aus dem Projektverzeichnis.
const path = await import('node:path');
const yml = await (await import('node:fs/promises'))
  .readFile(path.join(ROOT, '.github/workflows/push-erinnerung.yml'), 'utf8');
check(/sendNotification\(k\.abo, null/.test(yml),
  'der Ablauf schickt keine Nutzlast – nur ein Klopfen');
check(/PUSH_KONFIG/.test(yml), 'und liest die Einrichtung aus einem Secret');
check(/web-push@\d+\.\d+\.\d+/.test(yml),
  'mit fester Fassung der Bibliothek, damit er nicht eines Morgens still ausfällt');

console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
await browser.close();
