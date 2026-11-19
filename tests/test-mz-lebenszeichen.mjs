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
check((await o.page.locator('#karte-lebenszeichen').innerText()).includes('nie, was du isst'), 'unter „Mehr" steht offen, was gemeldet wird');
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
ende();
