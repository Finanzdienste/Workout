/*
 * Mahlzeit v6: das Lebenszeichen an Tobi – ob Uwe die App nutzt, nicht was
 * er isst. Tobi, 18.11.: „wenn ich dich hier frage sollst dus mir sagen
 * können". Geprüft: nur Zahlen, nichts Persönliches; höchstens alle drei
 * Stunden; abschaltbar; ohne Netz kein Fehler.
 */
import * as LZ from '../mahlzeit/js/lebenszeichen.js';
import { readFileSync } from 'node:fs';

const FASSUNG = readFileSync(new URL('../mahlzeit/js/app.js', import.meta.url), 'utf8').match(/export const FASSUNG = '([^']+)'/)[1];
import { oeffne, pruefer } from './mz-hilfe.mjs';

const { check, ende } = pruefer();
const TAG = '2026-11-18';
const STAND = {
  v: 1, hinweise: { willkommen: TAG },
  tage: { [TAG]: [{ id: 'a', n: 'Döner', p: '1 Stück', m: 1, kcal: 700, z: 'mittags' }, { id: 'b', n: 'Haferbrei', p: '75 g', m: 1, kcal: 275, z: 'morgens', h: 0 }], '2026-11-17': [{ id: 'c', n: 'Apfel', kcal: 80, m: 1 }] },
  werte: [{ id: 'w', art: 'gewicht', tag: TAG, wert: 98.4 }, { id: 'z', art: 'zucker', tag: TAG, wert: 140 }],
  eigene: [{ id: 'e', n: 'Omas Gulasch', kcal: 600 }],
  sport: { eingerichtet: true, log: [{ tag: TAG, art: 'beweglich', min: 11 }] },
};

const z = LZ.zahlen(STAND, TAG);
check(JSON.stringify(z) === JSON.stringify({ essen: 2, hafer: 1, sport: 1, werte: 2, eigene: 1, tage: 2 }), `nur Anzahlen: ${JSON.stringify(z)}`);
check(LZ.faellig(NaN, 0) && !LZ.faellig(1000, 1000 + LZ.ABSTAND - 1) && LZ.faellig(1000, 1000 + LZ.ABSTAND), 'höchstens alle drei Stunden');

// Im Browser
const gesendet = [];
let o = await oeffne({ tag: TAG, stand: STAND });
await o.page.route(/rest\/v1\/mahlzeit_nutzung/, async (r) => { gesendet.push({ body: r.request().postData(), headers: r.request().headers() }); await r.fulfill({ status: 201, body: '', headers: { 'access-control-allow-origin': '*' } }); });
await o.page.waitForTimeout(4600);
check(gesendet.length === 1, `beim Öffnen genau ein Lebenszeichen (${gesendet.length})`);
const b = JSON.parse(gesendet[0]?.body || '{}');
check(b.tag === TAG && b.essen === 2 && b.hafer === 1 && b.sport === 1 && b.werte === 2 && b.fassung === FASSUNG && /^[a-z0-9]{8,24}$/.test(b.geraet), 'mit Tag, Zahlen, Fassung und Zufallskennung');
const roh = gesendet[0]?.body || '';
check(!/Döner|Gulasch|Haferbrei|Apfel|700|275|98|140|Uwe/.test(roh), 'kein Essen, keine Kalorien, kein Gewicht, kein Blutzucker, kein Name');
check(gesendet[0].headers.apikey?.startsWith('sb_publishable_'), 'nur mit dem öffentlichen Schlüssel');
await o.page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
await o.page.waitForTimeout(300);
check(gesendet.length === 1, 'gleich wieder weggelegt: kein zweites (drei Stunden Abstand)');
await o.page.evaluate(() => Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }));
await o.page.click('#reiter-mehr');
const karte = await o.page.locator('#karte-lebenszeichen').innerText();
check(karte.includes('Gewicht, Blutzucker, HbA1c, Schlaf und Schritte') && karte.includes('Was du isst, geht nicht mit'), 'unter „Mehr" steht offen, was gemeldet wird – seit v13 auch die Werte');
await o.page.click('[data-tun="meldung"][data-an=""]');
const st = await o.gespeichert();
check(st.meldung === false, 'abgeschaltet und gemerkt');
await o.browser.close();

// Abgeschaltet: nichts; ohne Netz: kein Fehler
const zwei = [];
o = await oeffne({ tag: TAG, stand: { ...STAND, meldung: false } });
await o.page.route(/rest\/v1\/mahlzeit_nutzung/, (r) => { zwei.push(1); r.fulfill({ status: 201, body: '' }); });
await o.page.waitForTimeout(4600);
check(zwei.length === 0, 'abgeschaltet: kein Lebenszeichen');
await o.browser.close();
o = await oeffne({ tag: TAG, stand: STAND });
await o.page.route(/rest\/v1\/mahlzeit_nutzung/, (r) => r.abort());
await o.page.waitForTimeout(4600);
check(o.fehler.filter((f) => !/ERR_FAILED|Failed to load resource/.test(f)).length === 0, 'ohne Netz: kein Fehler in der Seite');
check(await o.page.evaluate(() => localStorage.getItem('mahlzeit.lebenszeichen.v1')) === null, '… und beim nächsten Öffnen wird es noch einmal versucht');
await o.browser.close();

// --- v13: die Werte selbst an Tobi (Tobi: „Mach Variante 2“)
const MIT_WERTEN = { ...STAND, werte: [...STAND.werte, { id: 's', art: 'schlaf', tag: TAG, wert: 435, quelle: 'uhr' }, { id: 'alt', art: 'gewicht', tag: '2026-08-01', wert: 102 }], tage: { ...STAND.tage } };
const fw = LZ.werteFuerTobi(MIT_WERTEN, '2026-09-19');
check(fw.length === 3 && fw.every((w) => !('n' in w) && !('kcal' in w)) && fw.find((w) => w.id === 's').quelle === 'uhr', 'nur Werte der letzten 60 Tage, mit Herkunft, ohne Essen');
const werteGesendet = [];
o = await oeffne({ tag: TAG, stand: MIT_WERTEN });
await o.page.route(/rpc\/mahlzeit_werte_melden/, async (r) => { werteGesendet.push({ body: JSON.parse(r.request().postData() || '{}'), headers: r.request().headers() }); await r.fulfill({ status: 200, contentType: 'application/json', body: '3', headers: { 'access-control-allow-origin': '*' } }); });
await o.page.waitForTimeout(4600);
const wb = werteGesendet[0]?.body || {};
check(werteGesendet.length === 1 && wb.p_von === '2026-09-19' && /^[a-z0-9]{8,24}$/.test(wb.p_geraet) && werteGesendet[0].headers.apikey?.startsWith('sb_publishable_'), 'beim Öffnen: die Werte ab dem 19.9. (60 Tage), mit Zufallskennung, öffentlicher Schlüssel');
check(wb.p_werte?.some((w) => w.art === 'gewicht' && w.wert === 98.4) && wb.p_werte?.some((w) => w.art === 'zucker' && w.wert === 140) && !JSON.stringify(wb).match(/Döner|Gulasch|Haferbrei|700/), 'Gewicht 98,4 und Blutzucker 140 gehen mit – das Essen nicht');
await o.page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
await o.page.waitForTimeout(300);
check(werteGesendet.length === 1, 'nichts geändert: kein zweites Mal');
await o.page.evaluate(() => Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }));
await o.page.click('#reiter-werte');
await o.page.fill('#w-gewicht', '97,9');
await o.page.click('form[data-form="gewicht"] button');
await o.page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
await o.page.waitForTimeout(400);
check(werteGesendet.length === 2 && werteGesendet[1].body.p_werte.some((w) => w.art === 'gewicht' && w.wert === 97.9) && !werteGesendet[1].body.p_werte.some((w) => w.wert === 98.4), 'neues Gewicht eingetragen, App weggelegt: gleich geschickt (ersetzt 98,4)');
await o.browser.close();
// Ohne Netz: nichts verloren – beim Ereignis „online“ kommt es nach
let netz = false;
const nachher = [];
o = await oeffne({ tag: TAG, stand: MIT_WERTEN });
await o.page.route(/rpc\/mahlzeit_werte_melden/, (r) => { if (!netz) return r.abort(); nachher.push(JSON.parse(r.request().postData() || '{}')); return r.fulfill({ status: 200, contentType: 'application/json', body: '3', headers: { 'access-control-allow-origin': '*' } }); });
await o.page.waitForTimeout(4600);
check(nachher.length === 0 && await o.page.evaluate(() => localStorage.getItem('mahlzeit.wertegemeldet.v1')) === null, 'ohne Netz: nicht als geschickt gemerkt');
netz = true;
await o.page.evaluate(() => window.dispatchEvent(new Event('online')));
await o.page.waitForTimeout(500);
check(nachher.length === 1 && nachher[0].p_werte.length === 3, 'wieder Netz: die Werte kommen von selbst nach');
await o.browser.close();
const werteAus = [];
o = await oeffne({ tag: TAG, stand: { ...MIT_WERTEN, meldung: false } });
await o.page.route(/rpc\/mahlzeit_werte_melden/, (r) => { werteAus.push(1); r.fulfill({ status: 200, body: '0' }); });
await o.page.waitForTimeout(4600);
check(werteAus.length === 0, 'Lebenszeichen aus: auch keine Werte');
await o.browser.close();
ende();
