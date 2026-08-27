/* Der Rückkanal: geht über die Funktion, fällt zurück, und sagt, warum er klemmt. */
import { chromium } from 'playwright';
import { URL, SHOT } from './umgebung.mjs';


const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));

let fails = 0;
const check = (cond, msg) => {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${msg}`);
  if (!cond) { fails++; process.exitCode = 1; }
};

// Der Server wird gespielt. `modus` entscheidet, was er antwortet, `gesehen`
// hält fest, welcher Weg tatsächlich benutzt wurde.
let modus = 'ok';
const gesehen = [];
const json = (status, obj) => ({ status, contentType: 'application/json', body: JSON.stringify(obj) });

await ctx.route('**/rest/v1/**', async (route) => {
  const url = route.request().url();
  const weg = url.includes('/rpc/melde') ? 'funktion'
    : url.includes('/rpc/entferne') ? 'entfernen'
      : url.includes('/nutzung') ? 'tabelle' : 'anderes';
  const h = route.request().headers();
  gesehen.push({ weg, auth: !!h.authorization, apikey: !!h.apikey, body: route.request().postData() });

  if (modus === 'weg') return route.abort('failed');
  if (weg === 'entfernen' && modus === 'ok') {
    return route.fulfill({ status: 200, contentType: 'application/json', body: '1' });
  }
  if (weg === 'funktion' || weg === 'entfernen') {
    if (modus === 'ok') return route.fulfill({ status: 204, body: '' });
    // Alte Einrichtung: Es gibt nur die Tabelle, keine Funktion.
    if (modus === 'ohneFunktion' || modus === 'alteRegeln') {
      return route.fulfill(json(404, { code: 'PGRST202', message: 'Could not find the function public.melde(zeile) in the schema cache' }));
    }
    if (modus === 'keinRecht') {
      return route.fulfill(json(401, { code: '42501', message: 'permission denied for function melde' }));
    }
    if (modus === 'schluessel') return route.fulfill(json(401, { message: 'Invalid API key' }));
  }
  if (weg === 'tabelle') {
    if (modus === 'ohneFunktion') return route.fulfill({ status: 201, body: '' });
    if (modus === 'alteRegeln') {
      return route.fulfill(json(401, { code: '42501', message: 'new row violates row-level security policy for table "nutzung"' }));
    }
  }
  return route.fulfill({ status: 201, body: '' });
});

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.setItem('workout.state.v1',
  JSON.stringify({ greeted: true, name: 'Tobi' })));
await page.reload({ waitUntil: 'networkidle' });
await page.locator('.tab[data-tab="settings"]').click();
await page.waitForTimeout(300);

const karte = page.locator('.card').filter({ hasText: 'Nutzung mit' });
check(await karte.count() === 1, 'die Karte "Nutzung teilen" steht unter Mehr');
check(await page.locator('[data-act="share-now"]').count() === 1, 'mit einem Knopf "Jetzt melden"');

// --- Der normale Weg: über die Funktion ---
gesehen.length = 0;
await page.locator('[data-act="share-now"]').click();
await page.waitForTimeout(400);
check(gesehen.length === 1 && gesehen[0].weg === 'funktion',
  `gemeldet wird über die Funktion, nicht über die Tabelle (${gesehen.map((g) => g.weg).join(', ')})`);
check(!gesehen[0].auth, 'der sb_publishable-Schlüssel geht nur als apikey raus, nicht als Bearer');
const paket = JSON.parse(gesehen[0].body || '{}');
check(!!paket.zeile && paket.zeile.name === 'Tobi',
  `die Zeile steckt im Aufruf (${paket.zeile && paket.zeile.name})`);
check(!!paket.zeile.id && Object.keys(paket.zeile).length === 13,
  `mit allen 13 Feldern (${Object.keys(paket.zeile).join(', ')})`);
check(!('gesehen' in paket.zeile),
  'ohne Uhrzeit – "keine Uhrzeiten" steht so im Einwilligungstext');
check((await karte.textContent()).includes('Zuletzt gemeldet'), 'und die Karte sagt, dass gemeldet wurde');
check(!(await karte.textContent()).includes('hat nicht geklappt'), 'ohne Fehlerhinweis');

// --- Ältere Einrichtung ohne die Funktion: Rückfall auf die Tabelle ---
modus = 'ohneFunktion';
gesehen.length = 0;
await page.locator('[data-act="share-now"]').click();
await page.waitForTimeout(500);
check(gesehen.map((g) => g.weg).join(',') === 'funktion,tabelle',
  `fehlt die Funktion, geht es wie früher direkt in die Tabelle (${gesehen.map((g) => g.weg).join(',')})`);
check(!(await karte.textContent()).includes('hat nicht geklappt'), 'und das gilt als geklappt');

// --- Alte Einrichtung, deren Regeln nicht greifen: der Grund steht da ---
modus = 'alteRegeln';
gesehen.length = 0;
await page.locator('[data-act="share-now"]').click();
await page.waitForTimeout(500);
const rls = (await karte.textContent()).replace(/\s+/g, ' ');
check(rls.includes('row-level security'), 'der Wortlaut des Servers steht da');
check(rls.includes('42501'), 'mitsamt dem Fehlercode aus der Datenbank');
check(rls.includes('SQL-Block aus der README'), 'und darunter, was zu tun ist');
await page.screenshot({ path: `${SHOT}/50-melden-fehler.png` });

// --- Funktion da, aber ohne Ausführungsrecht ---
modus = 'keinRecht';
await page.locator('[data-act="share-now"]').click();
await page.waitForTimeout(400);
check((await karte.textContent()).includes('grant execute'),
  'fehlendes Ausführungsrecht wird beim Namen genannt');

// --- Falscher Schlüssel ---
modus = 'schluessel';
await page.locator('[data-act="share-now"]').click();
await page.waitForTimeout(400);
const text = (await karte.textContent()).replace(/\s+/g, ' ');
check(text.includes('401') && text.includes('Invalid API key'), 'falscher Schlüssel: Status und Wortlaut');
check(text.includes('js/config.js'), 'mit dem Hinweis, wo er steht');

// --- Kein Netz ---
modus = 'weg';
await page.locator('[data-act="share-now"]').click();
await page.waitForTimeout(500);
check((await karte.textContent()).includes('Keine Verbindung'),
  'ohne Netz steht "Keine Verbindung" statt einer Statusnummer');

// --- Löschen läuft auch über eine Funktion ---
modus = 'ok';
gesehen.length = 0;
await page.locator('[data-act="share-delete"]').click();
await page.waitForTimeout(400);
check(gesehen.some((g) => g.weg === 'entfernen'), 'Löschen ruft entferne()');
check((await page.locator('.toast').textContent()).includes('Gelöscht'),
  'und meldet erst dann "Gelöscht", wenn wirklich eine Zeile wegging');

// --- Abgeschaltet meldet nichts ---
gesehen.length = 0;
await page.locator('[data-act="share-now"]').click();
await page.waitForTimeout(300);
check(gesehen.length === 0, 'abgeschaltet geht auch von Hand nichts raus');

console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
console.log('ERRORS:', errs.length ? errs : 'none');
await browser.close();
