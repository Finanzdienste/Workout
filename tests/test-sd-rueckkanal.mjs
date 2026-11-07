/*
 * Schilddrüse: der Rückkanal (Nov. 2026) – ein Lebenszeichen, keine
 * Gesundheitsdaten. Mit vorgetäuschtem Supabase wie tests/test-admin.mjs:
 * Jede Anfrage an einen fremden Rechner wird abgefangen und mitgeschrieben,
 * keine geht wirklich hinaus.
 *
 * Geprüft wird:
 *   - von localhost ohne Freigabe: nichts gesendet, keine Kennung angelegt,
 *   - mit Freigabe genau die sieben Felder (Kennung, Fassung, Startbildschirm,
 *     Plattform, Einführung, erster und heutiger Tag) und nichts aus dem Stand –
 *     kein Name, kein Wert, keine Tablette, kein Befinden,
 *   - einmal am Tag; nach einem Fehlschlag beim nächsten Anlass noch einmal,
 *   - nicht vor dem Einrichten und nicht, solange das Begrüßungsfenster offen
 *     ist – wer dort ausschaltet, hat nichts gemeldet,
 *   - und erst, wenn der Satz dazu zu sehen war: Wer das Fenster vor der
 *     letzten Seite schließt, es wegen einer 112-Lage nicht bekommt oder auf
 *     „Mehr" startet, liest ihn auf einer Karte auf „Heute" – gemeldet wird
 *     erst nach „Verstanden" (Prüfung Nov. 2026),
 *   - Ausschalten löscht die eigene Zeile (sd_entferne), ohne Netz beim
 *     nächsten Öffnen; „Alles löschen" ebenso; eine Sicherung schaltet nie ein,
 *   - Plattform und Startbildschirm bei iPhone und Android,
 *   - die Übersicht: falsches Passwort abgewiesen, Geräte sicher als Text, die
 *     Hinweise „alte Fassung" und „seit über 7 Tagen nicht geöffnet",
 *   - ohne Browser: APP_FASSUNG = VERSION aus sw.js, die SQL-Datei.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { SD_URL, SCHLUESSEL, uhrStellen, plus } from './sd-hilfe.mjs';
import { ROOT, ABLAGE } from './umgebung.mjs';

const TAG = '2026-11-07';
const FREIGABE = 'schilddruese.rueckkanal.lokal';
const FREIGABE_FENSTER = 'schilddruese.einfuehrung.lokal';
const MERK = 'schilddruese.rueckkanal.v1';
const HOST = 'https://vjyohppohmvhhxgwouti.supabase.co';
const KEY = 'sb_publishable_wTUNShIKMFjCOmZzQuuN-A_vFHPkKUI';
const FELDER = ['einfuehrung', 'erstmals', 'fassung', 'id', 'plattform', 'startbildschirm', 'zuletzt'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const UEBERSICHT = SD_URL.replace(/index\.html$/, 'uebersicht.html');

let fails = 0;
let oks = 0;
const check = (c, m) => {
  console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`);
  if (c) oks++; else { fails++; process.exitCode = 1; }
};

// ---------------------------------------------------------------- ohne Browser

const ORDNER = path.join(ROOT, 'schilddruese');
const sw = readFileSync(path.join(ORDNER, 'sw.js'), 'utf8');
const VERSION = sw.match(/const VERSION = '([^']+)'/)[1];
const shell = [...sw.match(/const SHELL = \[(.*?)\];/s)[1].matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]);
const rk = await import(new URL('../schilddruese/js/rueckkanal.js', import.meta.url).href);
check(rk.APP_FASSUNG === VERSION, `gemeldete Fassung = VERSION aus sw.js (${rk.APP_FASSUNG} / ${VERSION}) – beide zusammen hochzählen`);
check(JSON.stringify([...rk.FELDER].sort()) === JSON.stringify(FELDER), `genau sieben Felder: ${rk.FELDER.join(', ')}`);
check(rk.SERVER.url === HOST && rk.SERVER.key === KEY, 'Adresse und öffentlicher Schlüssel wie in js/config.js der Workout-App');
check(shell.includes('js/rueckkanal.js') && !shell.some((f) => /uebersicht/.test(f)), 'js/rueckkanal.js steht in SHELL, die Übersicht nicht');
const appQuellen = ['index.html', ...shell.filter((f) => f.endsWith('.js'))].map((f) => readFileSync(path.join(ORDNER, f), 'utf8'));
check(!appQuellen.some((t) => /uebersicht\.html/.test(t)), 'die App verlinkt die Übersicht nirgends');

const sql = readFileSync(path.join(ROOT, 'tools', 'schilddruese-rueckkanal.sql'), 'utf8');
const ohneKommentar = sql.replace(/--.*$/gm, '');
check(/create table if not exists sd_geraete/.test(ohneKommentar) && /alter table sd_geraete enable row level security/.test(ohneKommentar),
  'SQL: Tabelle sd_geraete (wiederholbar), RLS an');
check(['id text primary key', 'fassung text', 'startbildschirm boolean', 'plattform text', 'einfuehrung boolean', 'erstmals date', 'zuletzt date', 'tage int']
  .every((sp) => ohneKommentar.includes(sp)), 'SQL: die Spalten wie im Auftrag');
check(/revoke all on table sd_geraete from anon, authenticated/.test(ohneKommentar) && !/grant [^;]* on table/i.test(ohneKommentar),
  'SQL: kein Recht für anon auf der Tabelle');
check((ohneKommentar.match(/security definer/g) || []).length === 3 && /perform \* from admin_liste\(pass\)/.test(ohneKommentar),
  'SQL: drei Funktionen mit den Rechten ihres Besitzers, das Passwort über admin_liste(pass)');
check(/grant execute on function sd_melde\(jsonb\), sd_entferne\(text\), sd_admin_liste\(text\) to anon/.test(ohneKommentar)
  && /drop function if exists sd_melde\(jsonb\)/.test(ohneKommentar), 'SQL: nur execute an anon auf die drei Funktionen, erst weg, dann neu');
const sqlFelder = (ohneKommentar.match(/k not in \(([^)]*)\)/) || ['', ''])[1].match(/'(\w+)'/g) || [];
check(JSON.stringify(sqlFelder.map((x) => x.slice(1, -1)).sort()) === JSON.stringify(FELDER), `SQL: sd_melde nimmt genau dieselben Felder an (${sqlFelder.join(', ')})`);
check(/tage = g\.tage \+ case when g\.zuletzt is null or g\.zuletzt < excluded\.zuletzt then 1 else 0 end/.test(ohneKommentar), 'SQL: tage zählt hoch, wenn zuletzt vor heute lag');
check(!/DEIN-PASSWORT|geheim/.test(sql), 'SQL: kein Passwort in der Datei');

// ---------------------------------------------------------------- Browser

const browser = await chromium.launch();
const fehler = [];
const anfragen = [];        // alles, was an einen fremden Rechner ging
const lage = { netz: true, melde: 204 };
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type, apikey, authorization',
  'access-control-allow-methods': 'POST, OPTIONS',
};
const vorTagen = (n) => plus(TAG, -n);
const XSS = '<img src=x onerror="window.__xss=1">';
const LISTE = [
  { id: '0b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d', fassung: VERSION, startbildschirm: true, plattform: 'ios', einfuehrung: true, erstmals: vorTagen(5), zuletzt: TAG, tage: 4 },
  { id: '11111111-2222-4333-8444-555555555555', fassung: 'v12', startbildschirm: false, plattform: 'android', einfuehrung: false, erstmals: vorTagen(30), zuletzt: vorTagen(9), tage: 12 },
  { id: XSS, fassung: '<script>window.__xss=2</script>', startbildschirm: '<svg onload="window.__xss=3">', plattform: '<b onmouseover="window.__xss=4">fett</b>',
    einfuehrung: '"><img src=x onerror="window.__xss=5">', erstmals: '<img src=x onerror="window.__xss=6">', zuletzt: '<iframe src="javascript:window.__xss=7">', tage: '<img src=x onerror="window.__xss=8">' },
];

async function abfangen(route) {
  const req = route.request();
  const u = new URL(req.url());
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS, body: '' });
  anfragen.push({ url: req.url(), origin: u.origin, pfad: u.pathname, methode: req.method(), kopf: req.headers(), body: req.postData() || '' });
  if (!lage.netz) return route.abort('internetdisconnected');
  if (u.origin !== HOST) return route.abort();
  if (u.pathname === '/rest/v1/rpc/sd_melde') return route.fulfill({ status: lage.melde, headers: CORS, body: lage.melde === 204 ? '' : '{"message":"Dienst nicht da"}' });
  if (u.pathname === '/rest/v1/rpc/sd_entferne') return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: '1' });
  if (u.pathname === '/rest/v1/rpc/sd_admin_liste') {
    const pass = JSON.parse(req.postData() || '{}').pass;
    // So antwortet PostgREST, wenn admin_liste() „nope" wirft.
    if (pass !== 'geheim') return route.fulfill({ status: 400, headers: { ...CORS, 'content-type': 'application/json' }, body: '{"code":"P0001","details":null,"hint":null,"message":"nope"}' });
    return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(LISTE) });
  }
  return route.abort();
}
const fremd = (u) => u.hostname !== 'localhost' && u.hostname !== '127.0.0.1';

async function kontext(optionen = {}, vorher = null) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, locale: 'de-DE', ...optionen });
  await ctx.addInitScript(uhrStellen);
  if (vorher) await ctx.addInitScript(vorher);
  await ctx.route(fremd, abfangen);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => fehler.push(`PAGEERROR: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_INTERNET_DISCONNECTED|net::ERR/.test(m.text())) fehler.push(`CONSOLE: ${m.text()}`); });
  page.on('dialog', (d) => d.accept());
  return { ctx, page };
}

/** Speicher leeren und mit Stand, Tag und Freigaben neu laden. */
async function starten(page, { stand = null, tag = TAG, zeit = '08:15', freigabe = true, fenster = false, merk = null } = {}) {
  await page.waitForTimeout(150);
  await page.evaluate(({ key, st, t, z, fg, ff, mk, MK, FG, FF }) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('__testtag', t);
    localStorage.setItem('__testzeit', z);
    if (fg) localStorage.setItem(FG, '1');
    if (ff) localStorage.setItem(FF, '1');
    if (mk) localStorage.setItem(MK, JSON.stringify(mk));
    if (st) localStorage.setItem(key, JSON.stringify(st));
  }, { key: SCHLUESSEL, st: stand, t: tag, z: zeit, fg: freigabe, ff: fenster, mk: merk, MK: MERK, FG: FREIGABE, FF: FREIGABE_FENSTER });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
}
const tagStellen = async (page, t, z = '08:15') => {
  await page.evaluate(({ tt, zz }) => { localStorage.setItem('__testtag', tt); localStorage.setItem('__testzeit', zz); }, { tt: t, zz: z });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
};
const merkLesen = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), MERK);
const standLesen = async (page) => {
  await page.waitForTimeout(250);
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), SCHLUESSEL);
};
const nur = (pfad) => anfragen.filter((a) => a.pfad === `/rest/v1/rpc/${pfad}`);
const zeileVon = (a) => JSON.parse(a.body).zeile;

/*
 * Ein eingerichteter Stand voller Gesundheitsdaten – nichts davon darf in
 * der Meldung stehen. Die Wörter und Zahlen sind so gewählt, dass sie in
 * einer Kennung aus Hexziffern nicht vorkommen können.
 */
const VOLL = {
  version: 1,
  profil: { name: 'Mama Erika', begruesst: true, seit: '2026-09-01', einfuehrung: 1, einfuehrungDaten: true, geburtsjahr: 1948, ursache: 'hashimoto', bundesland: 'BY', behandelt: true },
  einstellungen: { erinnerung: '07:30', schrift: 'gross', farbe: 'hell', hinweisTablette: false },
  dosen: [{ id: 'mod1abc', ab: '2026-09-01', praeparat: 'L-Thyroxin Henning', mikrogramm: 75, tabletten: 1, notiz: 'morgens Wasser' }],
  einnahmen: { '2026-11-05': { uhr: '07:31' }, '2026-11-06': null },
  labor: [{ id: 'mod2abc', datum: '2026-10-15', tsh: { wert: 6.8, einheit: 'mU/l', von: 0.27, bis: 4.2 }, ft4: null, ft3: null, notiz: 'Hausarzt' }],
  befinden: [{ id: 'mod3abc', datum: '2026-11-06', stufe: 'mittel', beschwerden: ['muede', 'frieren'], notiz: 'Kopfweh' }],
  gewicht: [{ id: 'mod5abc', datum: '2026-11-01', kg: 68.4 }],
  termine: [],
  fragen: [{ id: 'mod4abc', text: 'Muss ich die Tablette wirklich nehmen?', erledigt: false }],
  vorrat: { tabletten: 42, stand: '2026-11-01' },
  tab: 'heute',
  letzteSicherung: null,
  dauerhaft: false,
};
/** Ein eingerichteter Stand aus der alten App: ohne Merkmal des Begrüßungsfensters. */
const ALT_OHNE_MERKMAL = () => ({ ...JSON.parse(JSON.stringify(VOLL)), profil: { name: 'Mama', begruesst: true, seit: '2026-09-01' } });
const GEHEIM = ['Mama', 'Erika', 'Henning', 'Thyroxin', 'Wasser', 'muede', 'frieren', 'Kopfweh', 'Hausarzt', 'Muss ich', 'hashimoto', '6.8', '68.4', '07:30', '07:31', '2026-10-15', '2026-09-01', 'mU/l', 'tsh', 'labor', 'dosen', 'BY', '1948', 'profil', 'stand'];

const { ctx, page } = await kontext();
await page.goto(SD_URL, { waitUntil: 'networkidle' });

// ---------------------------------------------------------------- lokale Adresse

await starten(page, { stand: VOLL, freigabe: false });
await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
await page.evaluate(() => window.dispatchEvent(new Event('online')));
await page.waitForTimeout(500);
check(anfragen.length === 0, `localhost ohne Freigabe: keine einzige Anfrage nach draußen (${anfragen.length})`);
check(await merkLesen(page) === null, '… und keine Gerätekennung angelegt');

// ---------------------------------------------------------------- die Meldung

await starten(page, { stand: VOLL });
let melde = nur('sd_melde');
check(melde.length === 1, `mit Freigabe: beim Öffnen genau eine Meldung (${melde.length})`);
const erste = melde[0];
const zeile = erste ? zeileVon(erste) : {};
check(erste && erste.methode === 'POST' && erste.origin === HOST, '… als POST an das Supabase-Projekt');
check(erste && erste.kopf.apikey === KEY && !erste.kopf.authorization, '… mit dem öffentlichen Schlüssel, ohne Authorization-Kopf');
check(erste && !erste.kopf.referer && !erste.kopf.cookie, '… ohne Herkunftsangabe und ohne Cookies');
check(erste && JSON.stringify(Object.keys(JSON.parse(erste.body))) === '["zeile"]', '… der Körper ist nur { zeile }');
check(JSON.stringify(Object.keys(zeile).sort()) === JSON.stringify(FELDER), `… mit genau diesen Feldern: ${Object.keys(zeile).join(', ')}`);
check(UUID.test(zeile.id || ''), `Kennung: eine zufällige UUID (${zeile.id})`);
check(zeile.fassung === VERSION, `Fassung: ${zeile.fassung} (VERSION aus sw.js)`);
check(zeile.startbildschirm === false && zeile.plattform === 'andere', `im Browser auf Linux: kein Startbildschirm, Plattform „andere" (${zeile.startbildschirm}/${zeile.plattform})`);
check(zeile.einfuehrung === true, 'Einführung angezeigt: ja (profil.einfuehrung = 1)');
check(zeile.erstmals === TAG && zeile.zuletzt === TAG, `erster und heutiger Tag, ohne Uhrzeit (${zeile.erstmals} / ${zeile.zuletzt})`);
const ohneKennung = erste ? erste.body.replace(zeile.id, '') : '';
const gefunden = GEHEIM.filter((w) => ohneKennung.includes(w));
check(erste && !gefunden.length, `keine Gesundheitsdaten, kein Name, keine Anrede in der Meldung${gefunden.length ? `: ${gefunden.join(', ')}` : ''}`);
check(['42', '75'].every((z) => !ohneKennung.includes(z)), '… auch keine Stärke und kein Vorrat');
let merk = await merkLesen(page);
check(merk && merk.id === zeile.id && merk.erstmals === TAG && merk.gemeldet === TAG, 'Kennung, erster Tag und Tag der Meldung bleiben auf dem Gerät gemerkt');
check(await page.evaluate(async () => (await import('./js/speicher.js')).getStand().einstellungen.rueckkanal) === true, 'der Schalter steht im Stand und ist an');
const sicherung = await page.evaluate(async () => (await import('./js/speicher.js')).exportJSON());
check(!sicherung.includes(zeile.id) && /"rueckkanal": true/.test(sicherung), 'die Kennung steht nicht in der Sicherung, nur der Schalter');

// Einmal am Tag.
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
await page.evaluate(() => window.dispatchEvent(new Event('online')));
await page.waitForTimeout(300);
check(nur('sd_melde').length === 1, `neu geladen und wieder nach vorn am selben Tag: keine zweite Meldung (${nur('sd_melde').length})`);
await tagStellen(page, plus(TAG, 1));
melde = nur('sd_melde');
const zweite = melde[1] ? zeileVon(melde[1]) : {};
check(melde.length === 2 && zweite.id === zeile.id && zweite.erstmals === TAG && zweite.zuletzt === plus(TAG, 1),
  `am nächsten Tag: wieder eine, mit derselben Kennung und dem ersten Tag (${melde.length}, ${zweite.erstmals} → ${zweite.zuletzt})`);

// Ein Fehlschlag: beim nächsten Anlass noch einmal, nicht jede Minute.
lage.melde = 503;
await tagStellen(page, plus(TAG, 2));
check(nur('sd_melde').length === 3 && (await merkLesen(page)).gemeldet === plus(TAG, 1), 'Server antwortet nicht: nicht als gemeldet vermerkt');
await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
await page.waitForTimeout(300);
lage.melde = 204;
await page.evaluate(() => window.dispatchEvent(new Event('online')));
await page.waitForTimeout(400);
check(nur('sd_melde').length === 5 && (await merkLesen(page)).gemeldet === plus(TAG, 2), `wieder nach vorn bzw. wieder Netz: neuer Versuch, dann gemeldet (${nur('sd_melde').length})`);

// ---------------------------------------------------------------- Über diese App

await page.click('#reiter-mehr');
check((await page.locator('[data-seite="ueber"]').innerText()).includes('Meldung an Tobi'), 'unter „Mehr": „Über diese App" nennt die Meldung an Tobi');
await page.click('[data-seite="ueber"]');
const satz = await page.evaluate(async () => (await import('./js/ansicht-begruessung.js')).RUECKKANAL_SATZ);
const karte = page.locator('.rueckkanal-karte');
check((await karte.innerText()).includes(satz), '„Über diese App": derselbe Satz wie im Begrüßungsfenster');
check(await karte.locator('[data-act="rueckkanal"][data-wert="an"][aria-pressed="true"]').count() === 1, '… mit dem Schalter, „An" gewählt');
check((await karte.innerText()).includes('Heute schon gemeldet'), '… und daneben, dass heute schon gemeldet wurde');
check((await page.locator('#ansicht').innerText()).includes(`Fassung ${VERSION}`), 'unten steht die Fassung der App');
// Begrüßung/Rückkanal (Nov. 2026): Die Karte steht zuerst – Seite 6 und die
// Karte auf „Heute" schicken hierher; hinter dem Kapitel lag sie fünf Bildschirme tief.
const ersteKarte = await page.evaluate(() => {
  const k = document.querySelector('#ansicht .karte');
  return k ? { klasse: k.className, unten: Math.round(k.querySelector('[data-act="rueckkanal"]').getBoundingClientRect().bottom), hoehe: window.innerHeight } : null;
});
check(ersteKarte && ersteKarte.klasse.includes('rueckkanal-karte'), `„Über diese App": „Meldung an Tobi" ist die erste Karte (${ersteKarte && ersteKarte.klasse})`);
check(ersteKarte && ersteKarte.unten < ersteKarte.hoehe * 2, `… der Schalter liegt höchstens einen Bildschirm tief (${ersteKarte && ersteKarte.unten} px, Fenster ${ersteKarte && ersteKarte.hoehe} px)`);
check(/Supabase/.test(await karte.innerText()) && /IP-Adresse/.test(await karte.innerText()) && (await karte.innerText()).includes('In die Liste für Tobi kommt sie nicht.'),
  '… und sie sagt, wer die Meldung aufbewahrt: Supabase, der dabei wie jeder Dienst die IP-Adresse sieht');
const vorAus = anfragen.length;
await page.click('[data-act="rueckkanal"][data-wert="aus"]');
await page.waitForTimeout(400);
const entferne = nur('sd_entferne');
check(entferne.length === 1 && JSON.parse(entferne[0].body).geraet === zeile.id, 'Ausschalten: sd_entferne mit der eigenen Kennung');
check(anfragen.length === vorAus + 1, '… und sonst nichts');
merk = await merkLesen(page);
check(merk && merk.id === null && merk.loeschen.length === 0, 'die Kennung ist vergessen, nichts wartet aufs Löschen');
check((await standLesen(page)).einstellungen.rueckkanal === false, 'der Schalter steht im Stand auf aus');
check((await page.locator('#meldung').innerText()).includes('Ausgeschaltet. Es geht keine Meldung mehr an Tobi.'), `Meldung: „${await page.locator('#meldung').innerText()}"`);
check(await page.evaluate(() => document.activeElement && document.activeElement.dataset.act === 'rueckkanal' && document.activeElement.dataset.wert === 'aus'), 'der Fokus bleibt auf „Aus"');
check((await page.locator('.rueckkanal-karte [aria-pressed="true"]').innerText()) === 'Aus' && (await karte.innerText()).includes('Aus. Es geht keine Meldung mehr an Tobi.'), '… „Aus" ist gewählt, daneben steht es in Worten');
await tagStellen(page, plus(TAG, 3));
await page.evaluate(() => window.dispatchEvent(new Event('online')));
await page.waitForTimeout(300);
check(nur('sd_melde').length === 5, 'ausgeschaltet: am nächsten Tag keine Meldung');

// Wieder an: sofort eine Meldung, mit neuer Kennung.
await page.click('#reiter-mehr');
await page.click('[data-seite="ueber"]');
await page.click('[data-act="rueckkanal"][data-wert="an"]');
await page.waitForTimeout(400);
melde = nur('sd_melde');
const neu = melde[5] ? zeileVon(melde[5]) : {};
check(melde.length === 6 && UUID.test(neu.id || '') && neu.id !== zeile.id && neu.erstmals === plus(TAG, 3), 'wieder an: gleich eine Meldung, mit einer neuen Kennung – nichts verbindet sie mit der alten');
check((await page.locator('#meldung').innerText()).includes('Eingeschaltet'), '… mit der Meldung „Eingeschaltet …"');

// Ohne Netz ausschalten: beim nächsten Öffnen wird gelöscht.
lage.netz = false;
await page.waitForTimeout(700);
await page.click('[data-act="rueckkanal"][data-wert="aus"]');
await page.waitForTimeout(400);
merk = await merkLesen(page);
check(merk.loeschen.length === 1 && merk.loeschen[0] === neu.id && merk.id === null, 'ohne Netz ausgeschaltet: die Löschung wartet');
check((await page.locator('#meldung').innerText()).includes('sobald das Handy wieder Netz hat') && (await karte.innerText()).includes('wird gelöscht'), '… und das steht da');
lage.netz = true;
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const nachgeholt = nur('sd_entferne');
check(nachgeholt.length === 3 && JSON.parse(nachgeholt[2].body).geraet === neu.id && (await merkLesen(page)).loeschen.length === 0, 'beim nächsten Öffnen nachgeholt und erledigt');
check(nur('sd_melde').length === 6, '… und dabei nichts gemeldet');

// „Alles löschen" löscht auch die Zeile.
await starten(page, { stand: VOLL });
const vorLoeschen = (await merkLesen(page)).id;
await page.click('#reiter-mehr');
await page.click('[data-seite="ueber"]');
await page.click('[data-act="alles-loeschen"]');
await page.waitForTimeout(400);
const weg = nur('sd_entferne');
check(weg.length && JSON.parse(weg[weg.length - 1].body).geraet === vorLoeschen && (await merkLesen(page)).id === null, '„Alles löschen": auch die Zeile beim Betreiber und die Kennung');
const vorEinrichten = nur('sd_melde').length;
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
check(nur('sd_melde').length === vorEinrichten, 'vor dem Einrichten: keine Meldung');

// Nach dem Einrichten (das Begrüßungsfenster ist hier nicht freigegeben).
await page.fill('input[name=name]', 'Erika');
await page.click('[data-act="willkommen-weiter"]');
await page.fill('input[name=mikrogramm]', '75');
await page.click('[data-act="willkommen-weiter"]');
await page.click('[data-act="willkommen-weiter"]');
await page.waitForTimeout(500);
// Begrüßung/Rückkanal (Nov. 2026): Ohne Fenster war der Satz nirgends zu
// sehen – vorher ging die erste Meldung hier gleich raus. Jetzt steht er auf
// „Heute", und gemeldet wird erst nach „Verstanden".
check(nur('sd_melde').length === vorEinrichten && !((await merkLesen(page)) || {}).id, 'nach „Fertig – zur App" ohne Fenster: noch keine Meldung, keine Kennung – der Satz dazu war nirgends zu sehen');
const hinweis = page.locator('#ansicht .rueckkanal-hinweis');
const kurz = await page.evaluate(async () => (await import('./js/ansicht-begruessung.js')).RUECKKANAL_KURZ);
check(await hinweis.count() === 1 && (await hinweis.innerText()).includes(kurz) && (await hinweis.innerText()).includes('Mehr → Über diese App'),
  '… dafür auf „Heute" die Karte „Meldung an Tobi" mit dem Satz und dem Weg zu „Über diese App"');
check(kurz === 'Die App schickt Tobi einmal am Tag eine kurze Meldung, ob sie läuft und aktuell ist – nichts über Ihre Gesundheit.', '… im Wortlaut der Textautorin');
const tablettenKnopf = await page.locator('.tablette').boundingBox();
const hinweisKasten = await hinweis.boundingBox();
check(tablettenKnopf && hinweisKasten && hinweisKasten.y > tablettenKnopf.y, '… unter dem Tabletten-Knopf, nicht davor');
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
check(nur('sd_melde').length === vorEinrichten && await hinweis.count() === 1, 'neu geladen: weiter keine Meldung, die Karte bleibt');
await hinweis.locator('[data-act="rueckkanal-verstanden"]').click();
await page.waitForTimeout(500);
melde = nur('sd_melde');
const nachEinrichten = melde.length > vorEinrichten ? zeileVon(melde[melde.length - 1]) : {};
check(melde.length === vorEinrichten + 1 && nachEinrichten.einfuehrung === false && !JSON.stringify(nachEinrichten).includes('Erika'),
  `„Verstanden": jetzt die erste Meldung, Einführung noch nicht angezeigt (${melde.length - vorEinrichten})`);
check(await hinweis.count() === 0 && (await standLesen(page)).profil.einfuehrungDaten === true, '… die Karte ist weg, gemerkt im Stand (einfuehrungDaten)');
check(await page.evaluate(() => document.activeElement && document.activeElement.id === 'ansicht'), '… der Fokus steht auf der Ansicht, nicht im Leeren');

// „Ausschalten" auf der Karte: nichts geht raus, nichts zu löschen.
await starten(page, { stand: { ...JSON.parse(JSON.stringify(VOLL)), profil: { ...VOLL.profil, einfuehrungDaten: false } } });
let vorKarte = nur('sd_melde').length;
const entferneVorKarte = nur('sd_entferne').length;
check(nur('sd_melde').length === vorKarte && await hinweis.count() === 1, 'Fenster schon angezeigt, aber nicht bis zur letzten Seite: keine Meldung, die Karte steht da');
await hinweis.locator('[data-act="rueckkanal"][data-wert="aus"]').click();
await page.waitForTimeout(500);
check(nur('sd_melde').length === vorKarte && nur('sd_entferne').length === entferneVorKarte && !(await merkLesen(page)), '„Ausschalten" auf der Karte: keine Meldung, nichts zu löschen, keine Kennung');
let st = await standLesen(page);
check(st.einstellungen.rueckkanal === false && st.profil.einfuehrungDaten === true && await hinweis.count() === 0, '… aus, die Karte ist weg');
check((await page.locator('#meldung').innerText()).includes('Ausgeschaltet. Es geht keine Meldung mehr an Tobi.'), '… mit der Meldung „Ausgeschaltet …"');

// Startet die App am selben Tag auf „Mehr" (Neuladen nach einem Update),
// kommt das Fenster erst auf „Heute" – und bis dahin auch keine Meldung.
await page.evaluate(({ key, st, t }) => {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem('__testtag', t);
  localStorage.setItem('__testzeit', '08:15');
  localStorage.setItem('schilddruese.rueckkanal.lokal', '1');
  localStorage.setItem('schilddruese.einfuehrung.lokal', '1');
  localStorage.setItem(key, JSON.stringify(st));
  sessionStorage.setItem('schilddruese.reiter', JSON.stringify({ tab: 'mehr', tag: t }));
}, { key: SCHLUESSEL, st: ALT_OHNE_MERKMAL(), t: TAG });
vorKarte = nur('sd_melde').length;
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
check((await page.locator('#reiter-mehr').getAttribute('aria-selected')) === 'true' && !(await page.locator('dialog.begruessung[open]').count()) && nur('sd_melde').length === vorKarte,
  'Neustart auf „Mehr" mit einem Stand der alten App: kein Fenster und keine Meldung (vorher ging sie hier raus)');
check((await page.locator('[data-seite="ueber"]').innerText()).includes('Meldung an Tobi: an'), '… die Zeile „Über diese App" sagt, dass die Meldung an ist');
await page.click('[data-seite="ueber"]');
await page.waitForTimeout(300);
check(nur('sd_melde').length === vorKarte, '„Über diese App" nur geöffnet: noch keine Meldung');
await page.click('.rueckkanal-karte [data-act="rueckkanal"][data-wert="an"]');
await page.waitForTimeout(500);
check(nur('sd_melde').length === vorKarte + 1 && (await standLesen(page)).profil.einfuehrungDaten === true, 'dort „An" getippt (es war schon an): Satz gesehen, jetzt die Meldung');
check((await karte.innerText()).includes('Heute schon gemeldet'), '… und daneben steht, dass heute gemeldet wurde');

// ---------------------------------------------------------------- Begrüßungsfenster

const ALT = ALT_OHNE_MERKMAL();
await starten(page, { stand: ALT, fenster: true });
const fenster = page.locator('dialog.begruessung[open]');
check(await fenster.count() === 1, 'alte App ohne Merkmal: das Begrüßungsfenster ist offen');
let vorher = nur('sd_melde').length;
await page.waitForTimeout(500);
check(nur('sd_melde').length === vorher && !(await merkLesen(page)), 'solange es offen ist: keine Meldung, keine Kennung');
for (let i = 0; i < 5; i++) {
  await page.click('[data-act="begruessung-weiter"]');
  await page.waitForTimeout(700);
}
const stelle = fenster.locator('[data-stelle="rueckkanal"]');
check(await stelle.locator('[data-act="rueckkanal"][data-wert="an"][aria-pressed="true"]').count() === 1, 'letzte Seite: der Schalter unter dem Satz, „An" gewählt');
check(await stelle.locator('p').count() === 0, '… ohne eigene Absätze (die Absätze der Seite sind der geprüfte Text)');
await stelle.locator('[data-wert="aus"]').click();
await page.waitForTimeout(400);
check(await stelle.locator('[data-wert="aus"][aria-pressed="true"]').count() === 1 && (await stelle.innerText()).includes('Aus. Es geht keine Meldung mehr an Tobi.'), 'im Fenster ausgeschaltet: „Aus" gewählt, in Worten daneben');
check(await page.evaluate(() => document.activeElement && document.activeElement.dataset.wert === 'aus' && Boolean(document.activeElement.closest('dialog'))), '… der Fokus bleibt auf „Aus" im Fenster');
check(nur('sd_entferne').length === weg.length, '… nichts zu löschen, es wurde ja noch nichts gemeldet');
await page.click('[data-act="begruessung-fertig"]');
await page.waitForTimeout(400);
check(nur('sd_melde').length === vorher, 'nach dem Schließen: keine Meldung – sie hat im Fenster ausgeschaltet');
check((await standLesen(page)).einstellungen.rueckkanal === false, '… und es bleibt aus');

// Dasselbe, aber „An" gelassen und bis zur letzten Seite: nach „Los geht's" geht die Meldung raus.
await starten(page, { stand: ALT, fenster: true });
vorher = nur('sd_melde').length;
for (let i = 0; i < 5; i++) {
  await page.click('[data-act="begruessung-weiter"]');
  await page.waitForTimeout(700);
}
check(nur('sd_melde').length === vorher, 'letzte Seite, „An" gelassen: noch keine Meldung, solange das Fenster offen ist');
await page.click('[data-act="begruessung-fertig"]');
await page.waitForTimeout(400);
melde = nur('sd_melde');
check(melde.length === vorher + 1 && zeileVon(melde[melde.length - 1]).einfuehrung === true, '„Los geht\'s": jetzt die Meldung, Einführung angezeigt');
check(await hinweis.count() === 0, '… und auf „Heute" keine Karte dazu – der Satz war zu sehen');

// Begrüßung/Rückkanal (Nov. 2026): „Später lesen" bzw. Escape vor der letzten
// Seite – vorher ging die Meldung gleich beim Schließen raus, obwohl Satz und
// Schalter nie zu sehen waren. Jetzt die Karte auf „Heute", gemeldet wird erst danach.
for (const [wie, schliessen] of [['Escape auf Seite 1', async () => page.keyboard.press('Escape')],
  ['„Später lesen" auf Seite 3', async () => {
    await page.click('[data-act="begruessung-weiter"]');
    await page.waitForTimeout(500);
    await page.click('[data-act="begruessung-weiter"]');
    await page.waitForTimeout(500);
    await page.click('[data-act="begruessung-zu"]');
  }]]) {
  await starten(page, { stand: ALT, fenster: true });
  vorher = nur('sd_melde').length;
  await schliessen();
  await page.waitForTimeout(500);
  st = await standLesen(page);
  check(!(await fenster.count()) && nur('sd_melde').length === vorher && !(await merkLesen(page)) && st.profil.einfuehrung === 1 && st.profil.einfuehrungDaten === false,
    `${wie}: keine Meldung, keine Kennung – der Satz war nicht zu sehen`);
  check(await hinweis.count() === 1, `${wie}: … dafür die Karte „Meldung an Tobi" auf „Heute"`);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForTimeout(300);
  check(nur('sd_melde').length === vorher, `${wie}: … auch nicht beim Zurückkommen oder bei Netz`);
}
await hinweis.locator('[data-act="rueckkanal-verstanden"]').click();
await page.waitForTimeout(500);
melde = nur('sd_melde');
check(melde.length === vorher + 1 && zeileVon(melde[melde.length - 1]).einfuehrung === true, 'dann „Verstanden": die Meldung, Einführung angezeigt');

// Kommt das Fenster wegen einer 112-Lage nicht (W1 im Check von heute), wartet auch die Meldung.
await starten(page, { stand: { ...ALT_OHNE_MERKMAL(), warnzeichen: [{ id: 'z1', datum: TAG, uhr: '08:05', ja: ['brust'] }] }, fenster: true });
vorher = nur('sd_melde').length;
check(!(await fenster.count()) && await page.locator('#ansicht [data-regel="W1"]').count() === 1, 'W1 heute: die 112-Karte, kein Fenster');
check(nur('sd_melde').length === vorher && !(await merkLesen(page)), '… und keine Meldung (vorher ging sie hier mit „Einführung: nein" raus)');
const w1Box = await page.locator('#ansicht [data-regel="W1"]').boundingBox();
const kartenBox = await hinweis.boundingBox();
check(w1Box && kartenBox && kartenBox.y > w1Box.y, '… die Karte „Meldung an Tobi" steht unter der 112-Karte');

// ---------------------------------------------------------------- Sicherung

// Die Sicherung bringt „aus" mit: wie Ausschalten.
await starten(page, { stand: VOLL });
const idVorImport = (await merkLesen(page)).id;
const datei = path.join(ABLAGE, 'sd-rueckkanal-aus.json');
writeFileSync(datei, JSON.stringify({ ...VOLL, version: 4, app: 'schilddruese', einstellungen: { ...VOLL.einstellungen, rueckkanal: false }, fragen: [], exportiertAm: '2026-11-06T10:00:00.000Z' }));
await page.click('#reiter-mehr');
await page.click('[data-seite="sicherung"]');
const entferneVorher = nur('sd_entferne').length;
await page.setInputFiles('#sicherungDatei', datei);
await page.waitForTimeout(500);
const nachImport = nur('sd_entferne');
check((await standLesen(page)).einstellungen.rueckkanal === false && nachImport.length === entferneVorher + 1 && JSON.parse(nachImport[nachImport.length - 1].body).geraet === idVorImport,
  'Sicherung mit „aus" eingelesen: aus, und die Zeile wird gelöscht');
// Umgekehrt schaltet eine Sicherung mit „an" nicht wieder ein.
const wiederAn = await page.evaluate(async (s) => {
  const sp = await import('./js/speicher.js');
  const r = sp.importJSON(JSON.stringify(s));
  return { ok: r.ok, an: sp.getStand().einstellungen.rueckkanal };
}, { ...VOLL, version: 4, app: 'schilddruese', einstellungen: { ...VOLL.einstellungen, rueckkanal: true } });
check(wiederAn.ok && wiederAn.an === false, `Sicherung mit „an" auf einem Handy mit „aus": bleibt aus (${JSON.stringify(wiederAn)})`);
const norm = await page.evaluate(async () => {
  const sp = await import('./js/speicher.js');
  return [sp.normStand({ version: 1, einstellungen: {} }).einstellungen.rueckkanal, sp.normStand({ version: 4, einstellungen: { rueckkanal: false } }).einstellungen.rueckkanal,
    sp.normStand({ version: 4, einstellungen: { rueckkanal: 'nein' } }).einstellungen.rueckkanal];
});
check(JSON.stringify(norm) === '[true,false,true]', `normStand: ohne Angabe an, „aus" bleibt aus, Unsinn wird an (${norm})`);

// Kann die App sich die Kennung nicht merken, meldet sie nicht – sonst wäre jedes Öffnen ein neues Gerät.
const gesperrt = await kontext({}, () => {
  // Über das Objekt selbst statt über `Storage`: Der Linter kennt nur die Namen der App.
  const proto = Object.getPrototypeOf(localStorage);
  const echt = proto.setItem;
  proto.setItem = function setItem(k, v) {
    if (k === 'schilddruese.rueckkanal.v1') throw new DOMException('voll', 'QuotaExceededError');
    return echt.call(this, k, v);
  };
});
await gesperrt.page.goto(SD_URL, { waitUntil: 'networkidle' });
const vorGesperrt = anfragen.length;
await starten(gesperrt.page, { stand: VOLL });
check(anfragen.length === vorGesperrt, 'kann die Kennung nicht gespeichert werden: keine Meldung');
await gesperrt.ctx.close();

// ---------------------------------------------------------------- Plattform, Startbildschirm

async function meldungMit(optionen, vorher) {
  const k = await kontext(optionen, vorher);
  await k.page.goto(SD_URL, { waitUntil: 'networkidle' });
  const n = nur('sd_melde').length;
  await starten(k.page, { stand: VOLL });
  const m = nur('sd_melde');
  await k.ctx.close();
  return m.length === n + 1 ? zeileVon(m[m.length - 1]) : null;
}
const iphone = await meldungMit({
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1', isMobile: true, hasTouch: true,
}, () => { Object.defineProperty(Object.getPrototypeOf(navigator), 'standalone', { get: () => true, configurable: true }); });
check(iphone && iphone.plattform === 'ios' && iphone.startbildschirm === true, `iPhone vom Startbildschirm: ios, Startbildschirm ja (${iphone && `${iphone.plattform}/${iphone.startbildschirm}`})`);
const ipad = await meldungMit({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15', hasTouch: true,
}, () => { Object.defineProperty(Object.getPrototypeOf(navigator), 'maxTouchPoints', { get: () => 5, configurable: true }); });
check(ipad && ipad.plattform === 'ios' && ipad.startbildschirm === false, `iPad (meldet sich als Mac, aber mit Touch): ios (${ipad && ipad.plattform})`);
const android = await meldungMit({
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36', isMobile: true, hasTouch: true,
}, () => {
  const echt = window.matchMedia.bind(window);
  window.matchMedia = (q) => (q === '(display-mode: standalone)' ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : echt(q));
});
check(android && android.plattform === 'android' && android.startbildschirm === true, `Android als installierte App: android, Startbildschirm ja (${android && `${android.plattform}/${android.startbildschirm}`})`);

// ---------------------------------------------------------------- Übersicht

const uebersicht = await kontext({ viewport: { width: 390, height: 844 } });
const up = uebersicht.page;
await up.goto(UEBERSICHT, { waitUntil: 'networkidle' });
await up.evaluate((t) => { localStorage.setItem('__testtag', t); }, TAG);
await up.reload({ waitUntil: 'networkidle' });
check((await up.title()).includes('Übersicht') && await up.locator('#pass').count() === 1, 'die Übersicht fragt nach dem Passwort');
await up.fill('#pass', 'falsch');
await up.click('#anmelden button[type="submit"]');
await up.waitForTimeout(400);
check((await up.locator('#fehler').innerText()) === 'Passwort falsch' && await up.locator('#liste').isHidden(), 'falsches Passwort: abgewiesen, keine Liste');
const admin = nur('sd_admin_liste');
check(admin.length === 1 && JSON.parse(admin[0].body).pass === 'falsch' && admin[0].kopf.apikey === KEY, '… gefragt wurde sd_admin_liste mit dem Passwort');
await up.fill('#pass', 'geheim');
await up.click('#anmelden button[type="submit"]');
await up.waitForTimeout(500);
const tabellen = up.locator('#geraete article table');
check(await tabellen.count() === 3, `richtiges Passwort: eine Tabelle je Gerät (${await tabellen.count()})`);
const stand = await up.locator('#stand').innerText();
check(stand.includes(`aktuelle Fassung ${VERSION} (laut sw.js)`) && stand.includes('3 Geräte'), `oben: Zahl der Geräte und die aktuelle Fassung aus sw.js („${stand}")`);
const g1 = await up.locator('#geraete article').nth(0).innerText();
check(g1.includes(`${VERSION} (aktuell)`) && g1.includes('iPhone oder iPad') && /Startbildschirm\s+ja/.test(g1) && g1.includes('(heute)') && /Tage genutzt\s+4/.test(g1)
  && /Einführung angezeigt\s+ja/.test(g1) && !g1.includes('⚠'), 'Gerät 1: aktuelle Fassung, Startbildschirm, Plattform, heute geöffnet, Tage, Einführung – ohne Hinweis');
const g2 = await up.locator('#geraete article').nth(1).innerText();
check(g2.includes('Alte Fassung v12') && g2.includes('Seit 9 Tagen nicht geöffnet') && g2.includes('vor 9 Tagen') && g2.includes('nicht aktuell'),
  'Gerät 2: Hinweis auf die alte Fassung und „seit 9 Tagen nicht geöffnet"');
await up.waitForTimeout(300);
const xss = await up.evaluate(() => window.__xss || null);
check(xss === null, `nichts aus der Tabelle wird als HTML ausgeführt (${xss === null ? 'sauber' : `AUSGEFÜHRT: ${xss}`})`);
const roh = await up.locator('#geraete').innerHTML();
check(!/<img|<svg|<script|<iframe|<b /.test(roh), '… und kein fremdes Element im Dokument');
const g3 = await up.locator('#geraete article').nth(2).innerText();
check(g3.includes('<script>window.__xss=2</script>') && g3.includes('<b onmouseover'), '… der Text selbst steht da, nur eben als Text');
const imSpeicher = await up.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
check(!imSpeicher.includes('geheim'), 'das Passwort liegt weder im localStorage noch im sessionStorage');
await up.click('#abmelden');
check(await up.locator('#pass').isVisible() && !(await up.locator('#geraete article').count()), '„Abmelden" schließt wieder ab');
await uebersicht.ctx.close();

// ---------------------------------------------------------------- nichts sonst

const andere = anfragen.filter((a) => a.origin !== HOST || !a.pfad.startsWith('/rest/v1/rpc/sd_'));
check(!andere.length, `keine Anfrage an einen anderen Rechner oder eine andere Funktion${andere.length ? `: ${andere.map((a) => a.url).slice(0, 3).join(', ')}` : ''}`);
check(fehler.length === 0, `keine Fehler in der Konsole${fehler.length ? `: ${fehler.slice(0, 3).join(' | ')}` : ''}`);
await ctx.close();
await browser.close();
console.log(`\n${fails ? `${fails} FEHLER` : 'alle Prüfungen bestanden'} (${oks} OK)`);
process.exit(fails || !oks ? 1 : 0);
