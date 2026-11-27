/*
 * Mahlzeit v18: die Erinnerung am Abend. Tobi, 27.11.: „Alle drei“ – auf den
 * Vorschlag, Uwe abends sanft zu erinnern, wenn noch nichts fürs Abendessen
 * eingetragen ist.
 *
 * Drei Teile:
 *   1. die Edge Function ohne Netz und ohne Deno (lauf.js): wer ist wann dran,
 *      was geht an den Push-Dienst (entschlüsselt nachgelesen), tote Abos,
 *      die Probe mit Grenze;
 *   2. der Service Worker (sw.js): aus dem Anstoß wird eine Mitteilung, ein
 *      Tipp darauf holt die App;
 *   3. die App im Browser, mit nachgebautem Push-Dienst: fragen, einschalten,
 *      Stand nachmelden (auch nach einer Zeit ohne Netz), Uhrzeit, Probe, aus.
 */
import { readFileSync } from 'node:fs';
import * as L from '../mahlzeit/supabase/functions/mahlzeit-erinnerung/lauf.js';
import * as W from '../mahlzeit/supabase/functions/mahlzeit-erinnerung/webpush.js';
import { oeffne, pruefer, eintragen } from './mz-hilfe.mjs';

const { check, ende } = pruefer();

// --- 1. Wer ist dran --------------------------------------------------------
const um = (iso) => new Date(iso).getTime();
const ZEILE = { kennung: 'abcdefghjkmnpqrstuvw2345', uhr: '20:00', tz: 'Europe/Berlin', tag: '2026-11-27', abends: 0, gesamt: 3, gesendet: '2026-11-26', at: '2026-11-27T12:00:00Z' };
check(JSON.stringify(L.ortszeit(um('2026-11-27T19:05:00Z'), 'Europe/Berlin')) === '{"tag":"2026-11-27","min":1205}', 'Ortszeit Berlin im Winter: 19:05 UTC = 20:05');
check(L.ortszeit(um('2026-07-01T22:30:00Z'), 'Europe/Berlin').tag === '2026-07-02' && L.ortszeit(um('2026-07-01T22:30:00Z'), 'Quatsch/Zone').min === 30, 'im Sommer über Mitternacht; unbekannte Zone → Berlin');
check(L.faellig(ZEILE, um('2026-11-27T18:59:00Z')) === null, '19:59: noch nicht');
let f = L.faellig(ZEILE, um('2026-11-27T19:00:00Z'));
check(f?.tag === '2026-11-27' && f.text.startsWith('Abendessen schon gehabt?'), '20:00, drei Einträge, keiner abends: „Abendessen schon gehabt? …“');
check(L.faellig({ ...ZEILE, abends: 1 }, um('2026-11-27T19:00:00Z')) === null, 'abends schon eingetragen: still');
check(L.faellig({ ...ZEILE, gesendet: '2026-11-27' }, um('2026-11-27T19:30:00Z')) === null, 'heute schon erinnert: kein zweites Mal');
f = L.faellig({ ...ZEILE, tag: '2026-11-26', abends: 2, gesamt: 5 }, um('2026-11-27T19:00:00Z'));
check(f?.text.startsWith('Heute ist noch nichts eingetragen'), 'der Stand ist von gestern (App heute nicht geöffnet): „Heute ist noch nichts eingetragen …“');
check(L.faellig(ZEILE, um('2026-11-27T21:01:00Z')) === null, 'nach 22:00 nicht mehr (zwei Stunden Fenster)');
check(L.faellig({ ...ZEILE, at: '2026-11-19T12:00:00Z' }, um('2026-11-27T19:00:00Z')) === null, 'App seit über sieben Tagen still: keine Erinnerung mehr');
check(L.faellig({ ...ZEILE, uhr: '19:00' }, um('2026-11-27T18:10:00Z')) !== null, 'eigene Uhrzeit 19:00');
check(L.dienstErlaubt('https://fcm.googleapis.com/fcm/send/x') && L.dienstErlaubt('https://web.push.apple.com/abc') && !L.dienstErlaubt('https://boese.example/x') && !L.dienstErlaubt('http://fcm.googleapis.com/x') && !L.dienstErlaubt('https://fcm.googleapis.com.boese.example/x'), 'nur an echte Push-Dienste');

// Ein Gerät, wie der Browser es hätte – damit lässt sich nachlesen, was ankommt.
const geraet = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
const geraetPub = new Uint8Array(await crypto.subtle.exportKey('raw', geraet.publicKey));
const auth = crypto.getRandomValues(new Uint8Array(16));
const ABO = { endpoint: 'https://web.push.apple.com/QEtestabo', keys: { p256dh: W.b64url.zu(geraetPub), auth: W.b64url.zu(auth) } };
const VAPID = { ...(await W.schluesselpaar()), subject: L.SUBJECT };

function server(zeilen, { pushStatus = 201 } = {}) {
  const log = { push: [], patch: [], geloescht: [] };
  const holen = async (url, init = {}) => {
    const u = String(url);
    if (u.includes('/rest/v1/rpc/freizeit_push_schluessel')) return new Response(JSON.stringify({ oeffentlich: VAPID.oeffentlich, privat: VAPID.privat }));
    if (u.includes('/rest/v1/mahlzeit_erinnerung')) {
      const k = /kennung=eq\.([a-z0-9]+)/.exec(u)?.[1];
      if ((init.method || 'GET') === 'GET') return new Response(JSON.stringify(k ? zeilen.filter((z) => z.kennung === k) : zeilen));
      if (init.method === 'PATCH') { log.patch.push({ k, ...JSON.parse(init.body) }); Object.assign(zeilen.find((z) => z.kennung === k) || {}, JSON.parse(init.body)); return new Response(''); }
      if (init.method === 'DELETE') { log.geloescht.push(k); return new Response(''); }
    }
    log.push.push({ url: u, headers: init.headers, body: new Uint8Array(init.body) });
    return new Response('', { status: pushStatus });
  };
  return { holen, log };
}
const JETZT = um('2026-11-27T19:00:00Z');
const zeilen = [
  { ...ZEILE, abo: ABO },
  { ...ZEILE, kennung: 'schonabendsgegessen23456', abends: 1, abo: ABO },
  { ...ZEILE, kennung: 'fremderdienst23456789abc', abo: { ...ABO, endpoint: 'https://boese.example/x' } },
];
let s = server(zeilen);
let r = await L.lauf({ url: 'https://x.supabase.co', schluessel: 'geheim', holen: s.holen, jetzt: JETZT });
check(r.zeilen === 3 && r.faellig === 2 && r.gesendet === 1 && r.tot === 1, `ein Durchlauf: 3 Zeilen, 2 fällig, 1 geschickt, 1 mit fremdem Dienst verworfen (${JSON.stringify(r)})`);
const p = s.log.push[0];
check(s.log.push.length === 1 && p.url === ABO.endpoint && p.headers.TTL === '7200' && p.headers.Topic === 'mahlzeit-abend' && p.headers['Content-Encoding'] === 'aes128gcm' && p.headers.Authorization.startsWith('vapid t='), 'an den Push-Dienst: verschlüsselt, zwei Stunden haltbar, Thema „mahlzeit-abend“, mit Ausweis');
const klar = JSON.parse((await W.entschluesseln(p.body, { privat: geraet.privateKey, oeffentlich: geraetPub, auth })).text);
check(klar.titel === 'Mahlzeit' && klar.text.startsWith('Abendessen schon gehabt?') && klar.tag === 'mahlzeit-abend' && klar.url === './', `das Handy liest: „${klar.text}“`);
check(!/Uwe|kcal|\d{3}/.test(klar.text), 'kein Name, keine Zahl, kein Urteil im Text');
const jwt = JSON.parse(Buffer.from(p.headers.Authorization.split('t=')[1].split('.')[1], 'base64url').toString());
check(jwt.aud === 'https://web.push.apple.com' && jwt.sub === L.SUBJECT, 'der Ausweis nennt den Dienst und Mahlzeit');
check(s.log.patch.length === 1 && s.log.patch[0].gesendet === '2026-11-27' && s.log.geloescht.join() === 'fremderdienst23456789abc', 'gemerkt: heute erinnert; das Abo beim fremden Dienst ist weg');
r = await L.lauf({ url: 'https://x.supabase.co', schluessel: 'geheim', holen: s.holen, jetzt: JETZT + 15 * 60000 });
check(r.gesendet === 0 && s.log.push.length === 1, 'eine Viertelstunde später: kein zweites Mal');
s = server([{ ...ZEILE, abo: ABO }], { pushStatus: 410 });
r = await L.lauf({ url: 'https://x.supabase.co', schluessel: 'geheim', holen: s.holen, jetzt: JETZT });
check(r.tot === 1 && s.log.geloescht.length === 1 && s.log.patch.length === 0, 'der Push-Dienst kennt das Abo nicht mehr (410): Zeile weg');
s = server([{ ...ZEILE, abo: ABO }], { pushStatus: 503 });
r = await L.lauf({ url: 'https://x.supabase.co', schluessel: 'geheim', holen: s.holen, jetzt: JETZT });
check(r.gesendet === 0 && s.log.patch[0]?.gesendet === '2026-11-27' && s.log.geloescht.length === 0, 'der Push-Dienst hakt (503): als versucht gemerkt, nicht alle 15 Minuten neu');

// Die Probe
s = server([{ ...ZEILE, abo: ABO, proben: 0, probe_tag: null }]);
r = await L.probe({ url: 'https://x.supabase.co', schluessel: 'geheim', kennung: ZEILE.kennung, holen: s.holen, jetzt: um('2026-11-27T10:00:00Z') });
const probeText = JSON.parse((await W.entschluesseln(s.log.push[0].body, { privat: geraet.privateKey, oeffentlich: geraetPub, auth })).text).text;
check(r.ok && probeText.startsWith('Das ist eine Probe') && s.log.patch[0].proben === 1, 'Probe: geht sofort raus, zu jeder Uhrzeit, und wird gezählt');
for (let i = 0; i < 4; i++) await L.probe({ url: 'https://x.supabase.co', schluessel: 'geheim', kennung: ZEILE.kennung, holen: s.holen, jetzt: um('2026-11-27T10:00:00Z') });
r = await L.probe({ url: 'https://x.supabase.co', schluessel: 'geheim', kennung: ZEILE.kennung, holen: s.holen, jetzt: um('2026-11-27T10:00:00Z') });
check(r.ok === false && r.grund === 'grenze' && s.log.push.length === 5, 'die sechste Probe am Tag: abgelehnt');
r = await L.probe({ url: 'https://x.supabase.co', schluessel: 'geheim', kennung: 'unbekanntekennung2345678', holen: s.holen });
check(r.grund === 'fehlt' && (await L.probe({ url: 'x', schluessel: 'y', kennung: 'kurz', holen: s.holen })).grund === 'kennung', 'unbekannte oder kaputte Kennung: nichts');

// --- 2. Der Service Worker ---------------------------------------------------
const swText = readFileSync(new URL('../mahlzeit/sw.js', import.meta.url), 'utf8');
const hoerer = {};
const gezeigt = [];
const fenster = [];
const geoeffnet = [];
const selbst = {
  location: { href: 'https://finanzdienste.github.io/Workout/mahlzeit/sw.js', origin: 'https://finanzdienste.github.io' },
  addEventListener: (name, fn) => { hoerer[name] = fn; },
  registration: { showNotification: async (titel, o) => { gezeigt.push({ titel, ...o }); } },
  clients: { matchAll: async () => fenster, openWindow: async (u) => { geoeffnet.push(u); } },
  skipWaiting: async () => {},
};
new Function('self', 'caches', swText)(selbst, {});
const ereignis = (mehr) => { const e = { warten: [], waitUntil(x) { this.warten.push(x); }, ...mehr }; return e; };
let ev = ereignis({ data: { json: () => klar, text: () => JSON.stringify(klar) } });
hoerer.push(ev);
await Promise.all(ev.warten);
check(gezeigt[0]?.titel === 'Mahlzeit' && gezeigt[0].body === klar.text && gezeigt[0].tag === 'mahlzeit-abend' && gezeigt[0].icon === './icon-192.png', 'Anstoß → Mitteilung „Mahlzeit“ mit dem Text und dem Symbol');
ev = ereignis({ data: null });
hoerer.push(ev);
await Promise.all(ev.warten);
check(gezeigt[1]?.body === 'Schon alles eingetragen?', 'Anstoß ohne Inhalt: trotzdem ein Satz (iOS verlangt eine sichtbare Mitteilung)');
let zu = 0;
ev = ereignis({ notification: { close: () => { zu++; }, data: { url: './' } } });
hoerer.notificationclick(ev);
await Promise.all(ev.warten);
check(zu === 1 && geoeffnet[0] === 'https://finanzdienste.github.io/Workout/mahlzeit/', 'Tipp auf die Mitteilung: App öffnen');
let vorn = 0;
fenster.push({ url: 'https://finanzdienste.github.io/Workout/index.html', focus: async () => { vorn += 100; } }, { url: 'https://finanzdienste.github.io/Workout/mahlzeit/index.html', focus: async () => { vorn++; } });
ev = ereignis({ notification: { close: () => {}, data: { url: './' } } });
hoerer.notificationclick(ev);
await Promise.all(ev.warten);
check(vorn === 1 && geoeffnet.length === 1, 'ist Mahlzeit schon offen: nach vorn holen – nicht die Workout-App daneben');
check(/'\.\/js\/erinnerung\.js'/.test(swText), 'js/erinnerung.js liegt im Vorrat (ohne Netz startet die App)');

// --- 3. In der App ------------------------------------------------------------
const TAG = '2026-11-27';
const STAND = {
  v: 1, hinweise: { willkommen: TAG, sportNeu: TAG, uhrSpaeter: TAG, installiert: TAG }, essenTeilen: false,
  tage: {
    '2026-11-26': [{ id: 'a', n: 'Brötchen', p: '1 Stück', m: 1, kcal: 140, z: 'morgens' }],
    [TAG]: [{ id: 'b', n: 'Overnight Oats', p: '1 Glas', m: 1, kcal: 385, z: 'morgens' }, { id: 'c', n: 'Apfel', p: '1 Stück', m: 1, kcal: 80, z: 'mittags' }],
  },
};
const FUNKTION = /functions\/v1\/mahlzeit-erinnerung/;
const MELDEN = /rpc\/mahlzeit_erinnerung_melden/;
/* Der Push-Dienst des Browsers, nachgebaut: Erlaubnis, Abo, Kündigen – mit Zählern. */
function pushNachbauen(antwort) {
  window.__push = { erlaubnis: 'default', antwort, gefragt: 0, abos: 0, gekuendigt: 0, abo: null, arg: null };
  const abo = {
    endpoint: 'https://web.push.apple.com/QEtestabo', options: {},
    toJSON() { return { endpoint: this.endpoint, keys: { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) } }; },
    unsubscribe: async () => { window.__push.gekuendigt++; window.__push.abo = null; return true; },
  };
  const reg = { pushManager: {
    getSubscription: async () => window.__push.abo,
    subscribe: async (o) => { window.__push.arg = { sichtbar: o.userVisibleOnly, bytes: o.applicationServerKey.length }; window.__push.abos++; window.__push.abo = abo; return abo; },
  } };
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { ready: Promise.resolve(reg), register: async () => reg, addEventListener() {}, controller: null } });
  window.Notification = { get permission() { return window.__push.erlaubnis; }, requestPermission: async () => { window.__push.gefragt++; window.__push.erlaubnis = window.__push.antwort; return window.__push.antwort; } };
}
const skript = (antwort) => `(${pushNachbauen.toString()})(${JSON.stringify(antwort)})`;
const weg = (page) => page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
const da = (page) => page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });

let o = await oeffne({ tag: TAG, zeit: '18:30', stand: STAND, skripte: [skript('granted')] });
let page = o.page;
const gemeldet = [];
const proben = [];
let netz = true;
await page.route(FUNKTION, (rt) => {
  if (rt.request().method() === 'GET') return rt.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ oeffentlich: VAPID.oeffentlich }) });
  proben.push(JSON.parse(rt.request().postData() || '{}'));
  return rt.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"ok":true,"status":201}' });
});
await page.route(MELDEN, (rt) => {
  if (!netz) return rt.abort();
  gemeldet.push({ rumpf: JSON.parse(rt.request().postData() || '{}'), apikey: rt.request().headers().apikey });
  return rt.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"an":true}' });
});
check(await page.locator('#erinnerung-frage').isVisible() && (await page.locator('#erinnerung-frage').innerText()).includes('Soll ich dich abends erinnern?'), 'Heute, nach zwei Tagen mit Einträgen: „Soll ich dich abends erinnern?“');
await page.click('#erinnerung-frage [data-tun="erinnerung-an"]');
await page.waitForFunction(() => document.querySelector('#erinnerung-frage') === null);
let push = await page.evaluate(() => window.__push);
check(push.gefragt === 1 && push.abos === 1 && push.arg.sichtbar === true && push.arg.bytes === 65, 'ein Tipp: Erlaubnis gefragt, Abo mit dem Schlüssel des Servers geholt');
let m = gemeldet[0]?.rumpf || {};
check(gemeldet.length === 1 && /^[a-z0-9]{24}$/.test(m.p_kennung) && m.p_an === true && m.p_uhr === '20:00' && m.p_abo.endpoint.includes('web.push.apple.com') && m.p_abo.keys.auth.length === 22 && typeof m.p_tz === 'string' && gemeldet[0].apikey.startsWith('sb_publishable_'), 'beim Server abgelegt: Zufallskennung, Abo, 20:00, Zeitzone');
check(m.p_tag === TAG && m.p_gesamt === 2 && m.p_abends === 0 && !JSON.stringify(m).match(/Oats|Apfel|385|kcal/), 'dazu nur zwei Zahlen von heute (2 Einträge, 0 abends) – nicht, was gegessen wurde');
check((await o.gespeichert()).hinweise.erinnerung === TAG && (await page.locator('#meldung').innerText()).includes('Erinnerung an: 20 Uhr'), 'die Frage kommt nicht wieder; Meldung „Erinnerung an: 20 Uhr“');
const kennung = m.p_kennung;
check(!JSON.stringify(await o.gespeichert()).includes(kennung), 'die Kennung steht nicht im Stand (zieht nicht mit der Sicherung um)');

await eintragen(page, 'Brötchen', 'Brötchen');
await page.click('#eingetragen [data-tun="ebene-zu"]');
await weg(page);
await page.waitForTimeout(500);
m = gemeldet.at(-1).rumpf;
check(gemeldet.length === 2 && m.p_abends === 1 && m.p_gesamt === 3 && m.p_kennung === kennung, 'Abendessen eingetragen, App weggelegt: der Server weiß es (1 abends) – dann bleibt es um 20 Uhr still');
await da(page);
await weg(page);
await page.waitForTimeout(300);
check(gemeldet.length === 2, 'nichts geändert: kein neuer Abruf');
await da(page);

await page.click('#reiter-mehr');
check(await page.locator('#karte-erinnerung [data-uhr="20:00"]').getAttribute('aria-pressed') === 'true' && await page.locator('#erinnerung-probe').isVisible(), 'Mehr: 20 Uhr ist gewählt, „Probe schicken“ ist da');
await page.click('#karte-erinnerung [data-uhr="21:00"]');
await page.waitForTimeout(500);
push = await page.evaluate(() => window.__push);
check(gemeldet.at(-1).rumpf.p_uhr === '21:00' && push.gefragt === 1 && push.abos === 1 && await page.locator('#karte-erinnerung [data-uhr="21:00"]').getAttribute('aria-pressed') === 'true', 'auf 21 Uhr gestellt: gleich beim Server, ohne neue Erlaubnis');
await page.click('#erinnerung-probe');
await page.waitForFunction(() => document.querySelector('#erinnerung-status')?.textContent.includes('unterwegs'));
check(proben.length === 1 && proben[0].art === 'probe' && proben[0].kennung === kennung, 'Probe schicken: geht mit der Kennung an die Funktion, „Probe ist unterwegs“');

// Ohne Netz: der Stand kommt nach, sobald wieder Netz da ist
netz = false;
const vorher = gemeldet.length;
await page.click('#reiter-heute');
await eintragen(page, 'Apfel', 'Apfel');
await page.click('#eingetragen [data-tun="ebene-zu"]');
await weg(page);
await page.waitForTimeout(400);
await da(page);
check(gemeldet.length === vorher, 'ohne Netz: nichts angekommen …');
netz = true;
await page.evaluate(() => window.dispatchEvent(new Event('online')));
await page.waitForTimeout(600);
check(gemeldet.length === vorher + 1 && gemeldet.at(-1).rumpf.p_gesamt === 4, '… wieder Netz: der Stand kommt von selbst nach (4 Einträge)');

await page.click('#reiter-mehr');
await page.click('#karte-erinnerung [data-tun="erinnerung-aus"]');
await page.waitForFunction(() => window.__push.gekuendigt === 1);
check(gemeldet.at(-1).rumpf.p_an === false && gemeldet.at(-1).rumpf.p_kennung === kennung && await page.locator('#erinnerung-probe').count() === 0 && await page.locator('#karte-erinnerung [data-tun="erinnerung-aus"]').getAttribute('aria-pressed') === 'true', 'aus: beim Server abgemeldet, Abo gekündigt, Probe-Knopf weg');
await page.click('#reiter-heute');
check(await page.locator('#erinnerung-frage').count() === 0, 'die Frage auf „Heute“ kommt nach dem Ausschalten nicht wieder');
check(o.fehler.filter((x) => !/ERR_FAILED|Failed to load resource/.test(x)).length === 0, `keine Fehler in der Seite${o.fehler.length ? `: ${o.fehler.slice(0, 2).join(' | ')}` : ''}`);
await o.browser.close();

// Erlaubnis verweigert
o = await oeffne({ tag: TAG, stand: STAND, skripte: [skript('denied')] });
const nein = [];
await o.page.route(MELDEN, (rt) => { nein.push(1); rt.fulfill({ status: 200, body: '{}' }); });
await o.page.click('#erinnerung-frage [data-tun="erinnerung-an"]');
await o.page.waitForFunction(() => document.querySelector('#meldung')?.textContent.includes('Ohne Erlaubnis'));
check(nein.length === 0, '„Nicht erlauben“ getippt: „Ohne Erlaubnis keine Mitteilungen“, nichts geht zum Server');
await o.page.click('#reiter-mehr');
check((await o.page.locator('#erinnerung-hindernis').innerText()).includes('blockiert') && await o.page.locator('#karte-erinnerung [data-uhr="20:00"]').isDisabled(), 'Mehr: sagt, dass Mitteilungen blockiert sind; die Uhrzeiten sind aus');
await o.browser.close();

// Der Server ist nicht erreichbar: nicht „an“
o = await oeffne({ tag: TAG, stand: STAND, skripte: [skript('granted')] });
await o.page.click('#erinnerung-frage [data-tun="erinnerung-an"]');
await o.page.waitForFunction(() => /nicht geklappt|nicht erreichbar|keinen Schlüssel/.test(document.querySelector('#meldung')?.textContent || ''));
check(await o.page.evaluate(() => JSON.parse(localStorage.getItem('mahlzeit.erinnerung.v1') || '{}').an !== true) && await o.page.locator('#erinnerung-frage').isVisible(), 'Server nicht erreichbar: ein Satz, die Erinnerung bleibt aus und die Frage stehen');
await o.browser.close();

// Kein Push (iPhone im Browser statt vom Home-Bildschirm)
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
o = await oeffne({ tag: TAG, stand: STAND, kontext: { userAgent: IPHONE }, skripte: ['delete window.PushManager; try { delete Window.prototype.PushManager; } catch {}'] });
check(await o.page.locator('#erinnerung-frage').count() === 0, 'iPhone im Browser (kein Push): keine Frage auf „Heute“');
await o.page.click('#reiter-mehr');
check((await o.page.locator('#erinnerung-hindernis').innerText()).includes('Home-Bildschirm'), 'Mehr: „… erst, wenn Mahlzeit auf dem Home-Bildschirm liegt“');
await o.browser.close();

// Ein Testbrowser meldet nichts (wie das Lebenszeichen, v15)
o = await oeffne({ tag: TAG, stand: STAND, wieEcht: true, skripte: [skript('granted'), 'window.__push.erlaubnis = "granted";'], weitere: { 'mahlzeit.erinnerung.v1': JSON.stringify({ an: true, uhr: '20:00', kennung: 'abcdefghjkmnpqrstuvw2345', gemeldet: '' }) } });
const still = [];
await o.page.route(MELDEN, (rt) => { still.push(1); rt.fulfill({ status: 200, body: '{}' }); });
await o.page.waitForTimeout(4600);
check(still.length === 0, 'ferngesteuerter Browser: der Stand wird nicht gemeldet');
await o.browser.close();

ende();
