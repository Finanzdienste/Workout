/*
 * Mahlzeit v14: Was Uwe isst, geht an Tobi – erst nach Uwes „Ja“.
 *
 * Tobi, 26.11.2026: „Ja ich will das essen auch sehen. In meiner Master
 * übersicht“. Bis v13 stand in der App „Was du isst, geht nicht mit“, also
 * fragt die App einmal. Geprüft: vorher nichts; nach „Ja“ die Einträge der
 * 60 Tage (Kalorien für den ganzen Eintrag); Unverändertes nicht doppelt;
 * „nein“ unter „Mehr“ löscht bei Tobi; „Lieber nicht“ schickt nie etwas; ohne
 * Netz nichts verloren; Lebenszeichen aus heißt auch kein Essen; ohne
 * Einträge keine Frage.
 */
import * as LZ from '../mahlzeit/js/lebenszeichen.js';
import { oeffne, pruefer } from './mz-hilfe.mjs';

const { check, ende } = pruefer();
const TAG = '2026-11-26';
const STAND = {
  v: 1, hinweise: { willkommen: '2026-11-19' },
  tage: {
    [TAG]: [
      { id: 'a', f: 'doener', n: 'Döner', p: '1 Stück', m: 1, kcal: 700, kh: 60, ei: 30, z: 'mittags' },
      { id: 'b', f: 'hafer_wasser', n: 'Haferbrei', p: '75 g', m: 2, kcal: 275, kh: 45, ei: 9, z: 'morgens', h: 0 },
    ],
    '2026-11-25': [{ id: 'c', n: 'Apfel', kcal: 80, m: 1, z: 'nachmittags' }],
    '2026-08-01': [{ id: 'alt', n: 'Alte Pizza', kcal: 900, m: 1 }],
  },
  werte: [{ id: 'w', art: 'gewicht', tag: TAG, wert: 98.4 }],
  eigene: [],
};

// --- Ohne Browser
const fe = LZ.essenFuerTobi(STAND, '2026-09-27');
check(fe.length === 3 && !fe.some((e) => e.name === 'Alte Pizza'), 'nur die Einträge der letzten 60 Tage');
const brei = fe.find((e) => e.id === 'b');
check(brei.name === 'Haferbrei' && brei.kcal === 550 && brei.kh === 90 && brei.menge === 2 && brei.hafer === true && brei.zeit === 'morgens' && brei.portion === '75 g',
  `ein Eintrag: Name, Portion, Menge, Kalorien für den ganzen Eintrag, Hafer (${JSON.stringify(brei)})`);
check(fe.find((e) => e.id === 'a').hafer === false && fe.find((e) => e.id === 'c').tag === '2026-11-25', 'Döner kein Hafer, der Apfel mit seinem Tag');

const fang = (page, liste, { netz = () => true } = {}) => page.route(/rpc\/mahlzeit_essen_melden/, (r) => {
  if (!netz()) return r.abort();
  liste.push({ body: JSON.parse(r.request().postData() || '{}'), headers: r.request().headers() });
  return r.fulfill({ status: 200, contentType: 'application/json', body: '3', headers: { 'access-control-allow-origin': '*' } });
});
const weglegen = async (page) => {
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(400);
  await page.evaluate(() => Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }));
};

// --- 1. Noch nicht gefragt: nichts geht weg, die Frage steht auf „Heute“; „Ja“
const gesendet = [];
let o = await oeffne({ tag: TAG, stand: STAND });
await fang(o.page, gesendet);
await o.page.waitForTimeout(4600);
check(gesendet.length === 0, 'vor der Antwort: kein Essen an Tobi');
check(await o.page.locator('#essen-frage').isVisible()
  && (await o.page.locator('#essen-frage').innerText()).includes('Darf Tobi auch sehen, was du isst?'), 'auf „Heute“ die Frage „Darf Tobi auch sehen, was du isst?“');
await o.page.click('#essen-frage [data-tun="essen-teilen"][data-an="1"]');
await o.page.waitForTimeout(500);
const b1 = gesendet[0]?.body || {};
check(gesendet.length === 1 && b1.p_von === '2026-09-27' && /^[a-z0-9]{8,24}$/.test(b1.p_geraet) && gesendet[0].headers.apikey?.startsWith('sb_publishable_'),
  'nach „Ja“ sofort geschickt: ab dem 27.9. (60 Tage), mit Zufallskennung, öffentlicher Schlüssel');
check(b1.p_essen?.length === 3 && b1.p_essen.some((e) => e.name === 'Döner' && e.kcal === 700) && b1.p_essen.some((e) => e.name === 'Haferbrei' && e.kcal === 550 && e.hafer),
  'mit Döner (700 kcal) und doppeltem Haferbrei (550 kcal, Hafer)');
check((await o.gespeichert()).essenTeilen === true && !(await o.page.locator('#essen-frage').count()), 'die Antwort ist gemerkt, die Frage weg');
await weglegen(o.page);
check(gesendet.length === 1, 'nichts geändert, weggelegt: kein zweites Mal');
await o.page.click('#reiter-mehr');
const karte = await o.page.locator('#karte-lebenszeichen').innerText();
check(karte.includes('was du isst') && await o.page.locator('[data-tun="essen-teilen"][data-an="1"]').getAttribute('aria-pressed') === 'true', 'unter „Mehr“: dass Tobi auch das Essen sieht, „ja“ gedrückt');
check((await o.page.locator('#karte-ueber').innerText()).includes('und deinem Essen'), '„Über die App“ sagt es auch');
await o.page.click('#karte-lebenszeichen [data-tun="essen-teilen"][data-an=""]');
await o.page.waitForTimeout(500);
const b2 = gesendet[1]?.body || {};
check(gesendet.length === 2 && Array.isArray(b2.p_essen) && b2.p_essen.length === 0 && b2.p_von === new Date(Date.parse(`${TAG}T12:00:00Z`) - 399 * 864e5).toISOString().slice(0, 10), '„nein“ unter „Mehr“: eine leere Liste – bei Tobi ist es weg');
check((await o.gespeichert()).essenTeilen === false && (await o.page.locator('#karte-lebenszeichen').innerText()).includes('Was du isst, geht nicht mit'), 'gemerkt, und die Karte sagt wieder „geht nicht mit“');
await weglegen(o.page);
check(gesendet.length === 2, 'danach nichts mehr');
await o.browser.close();

// --- 2. „Lieber nicht“: nie etwas, die Frage kommt nicht wieder
const nie = [];
o = await oeffne({ tag: TAG, stand: STAND });
await fang(o.page, nie);
await o.page.click('#essen-frage [data-tun="essen-teilen"][data-an=""]');
await o.page.waitForTimeout(4600);
await weglegen(o.page);
check(nie.length === 0 && (await o.gespeichert()).essenTeilen === false, '„Lieber nicht“: nichts geschickt, gemerkt');
await o.page.reload({ waitUntil: 'load' });
await o.page.waitForSelector('html[data-bereit="1"]');
check(!(await o.page.locator('#essen-frage').count()), '… und die Frage kommt nicht wieder');
await o.browser.close();

// --- 3. Ohne Netz: nicht als geschickt gemerkt; bei „online“ kommt es nach
let netz = false;
const spaeter = [];
o = await oeffne({ tag: TAG, stand: { ...STAND, essenTeilen: true } });
await fang(o.page, spaeter, { netz: () => netz });
await o.page.waitForTimeout(4600);
check(spaeter.length === 0 && await o.page.evaluate(() => localStorage.getItem('mahlzeit.essengemeldet.v1')) === null, 'ohne Netz: nicht als geschickt gemerkt');
netz = true;
await o.page.evaluate(() => window.dispatchEvent(new Event('online')));
await o.page.waitForTimeout(600);
check(spaeter.length === 1 && spaeter[0].body.p_essen.length === 3, 'wieder Netz: das Essen kommt von selbst nach');
check(o.fehler.filter((f) => !/ERR_FAILED|Failed to load resource|ERR_INTERNET/.test(f)).length === 0, 'ohne Netz: kein Fehler in der Seite');
await o.browser.close();

// --- 4. Lebenszeichen ganz aus: kein Essen, keine Frage
const aus = [];
o = await oeffne({ tag: TAG, stand: { ...STAND, meldung: false, essenTeilen: true } });
await fang(o.page, aus);
await o.page.waitForTimeout(4600);
check(aus.length === 0 && !(await o.page.locator('#essen-frage').count()), 'Lebenszeichen aus: kein Essen, keine Frage');
await o.browser.close();
// Ganz aus, nachdem schon etwas geschickt war: einmal löschen
const ausNachher = [];
o = await oeffne({ tag: TAG, stand: { ...STAND, meldung: false, essenTeilen: true }, weitere: { 'mahlzeit.essengemeldet.v1': '2026-09-27|[]' } });
await fang(o.page, ausNachher);
await o.page.waitForTimeout(4600);
check(ausNachher.length === 1 && ausNachher[0].body.p_essen.length === 0, 'Lebenszeichen aus, vorher geschickt: einmal die leere Liste');
await o.browser.close();

// --- 5. Ohne Einträge (noch nie benutzt) und neben dem Hallo: keine Frage
o = await oeffne({ tag: TAG, stand: { ...STAND, tage: {} } });
check(!(await o.page.locator('#essen-frage').count()), 'ohne Einträge keine Frage');
await o.browser.close();
o = await oeffne({ tag: TAG, stand: { ...STAND, hinweise: {} } });
check(!(await o.page.locator('#essen-frage').count()) && (await o.page.locator('#willkommen').innerText()).includes('nicht, was du isst'), 'neben dem Hallo keine Frage; das Hallo sagt „nicht, was du isst“');
await o.browser.close();
o = await oeffne({ tag: TAG, stand: { ...STAND, hinweise: {}, essenTeilen: true } });
check((await o.page.locator('#willkommen').innerText()).includes('weil du es erlaubt hast, was du isst'), 'mit Ja sagt das Hallo, dass Tobi das Essen sieht');
await o.browser.close();
ende();
