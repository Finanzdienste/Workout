/*
 * Mahlzeit v19: die neue Kennung. Die Kennung ist der einzige Ausweis des
 * Handys beim Server, und die von Uwes Handy stand in den Notizen eines
 * öffentlichen Repos. Tobi, 27.11.2026, auf die Frage, ob die Angaben aus den
 * Notizen sollen und Uwes App eine neue Kennung bekommt: „Jo“.
 *
 * Geprüft: Ein Handy mit alter Kennung meldet den Wechsel einmal, mit den
 * Kennungen seiner Werte als Beweis, und schickt erst danach – unter der
 * neuen. Ohne Netz geht nichts hinaus und nichts verloren; mit Netz holt es
 * sich nach. Neue Handys fragen gar nicht. Und in den Notizen steht keine
 * Kennung eines echten Handys mehr.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { oeffne, pruefer, plus } from './mz-hilfe.mjs';
import * as LZ from '../mahlzeit/js/lebenszeichen.js';

const { check, ende } = pruefer();
const TAG = '2026-11-27';
const ALT = 'altekennung1';
const STAND = {
  v: 1, hinweise: { willkommen: TAG },
  tage: { [TAG]: [{ id: 'a', n: 'Apfel', p: '1 Stück', m: 1, kcal: 80, z: 'morgens' }] },
  werte: [
    { id: 'w1', art: 'gewicht', tag: TAG, wert: 98.4 },
    { id: 'w2', art: 'zucker', tag: TAG, wert: 112, wann: 'nuechtern', uhr: '07:30' },
    { id: 'w3', art: 'schritte', tag: plus(TAG, -1), wert: 6400 },
  ],
};
const NEUE_ART = /^[a-z2-9]{16}$/;

/** Schreibt mit, was hinausgeht – in der Reihenfolge, in der es ankommt. */
async function mitschreiben(page, { wechsel = '{"ok":true}', wechselNetz = () => true } = {}) {
  const post = [];
  const ok = { 'access-control-allow-origin': '*' };
  await page.route(/rest\/v1\/rpc\/mahlzeit_geraet_wechseln/, async (r) => {
    if (!wechselNetz()) { post.push({ art: 'wechsel-ohne-netz' }); return r.abort(); }
    post.push({ art: 'wechsel', ...JSON.parse(r.request().postData()), apikey: r.request().headers().apikey });
    return r.fulfill({ status: 200, contentType: 'application/json', body: wechsel, headers: ok });
  });
  await page.route(/rest\/v1\/mahlzeit_nutzung/, async (r) => {
    post.push({ art: 'nutzung', ...JSON.parse(r.request().postData()) });
    return r.fulfill({ status: 201, body: '', headers: ok });
  });
  await page.route(/rest\/v1\/rpc\/mahlzeit_werte_melden/, async (r) => {
    post.push({ art: 'werte', ...JSON.parse(r.request().postData()) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '3', headers: ok });
  });
  return post;
}
const speicher = (page) => page.evaluate(() => ({ alt: localStorage.getItem('mahlzeit.geraet.v1'), neu: localStorage.getItem('mahlzeit.geraet.v2') }));
const arten = (post) => post.map((p) => p.art).join(' ');

// --- 1. Ein neues Handy: keine Frage an den Server, gleich die neue Art ---------
let o = await oeffne({ tag: TAG, stand: STAND });
let post = await mitschreiben(o.page);
await o.page.waitForTimeout(4700);
let sp = await speicher(o.page);
check(!post.some((p) => p.art.startsWith('wechsel')), `neues Handy: kein Wechsel gemeldet (${arten(post)})`);
check(NEUE_ART.test(sp.neu || '') && sp.alt === null, `neues Handy: 16 Zeichen Zufall, keine alte Kennung (${(sp.neu || '').length})`);
check(post.find((p) => p.art === 'nutzung')?.geraet === sp.neu && post.find((p) => p.art === 'werte')?.p_geraet === sp.neu, 'neues Handy: Lebenszeichen und Werte unter dieser Kennung');
await o.browser.close();

// --- 2. Ein Handy mit alter Kennung: erst der Wechsel, dann alles unter der neuen ---
o = await oeffne({ tag: TAG, stand: STAND, weitere: { 'mahlzeit.geraet.v1': ALT } });
post = await mitschreiben(o.page);
await o.page.waitForTimeout(4700);
sp = await speicher(o.page);
const w = post.filter((p) => p.art === 'wechsel');
check(w.length === 1 && post[0]?.art === 'wechsel', `alte Kennung: genau ein Wechsel, vor allem anderen (${arten(post)})`);
check(w[0]?.p_alt === ALT && NEUE_ART.test(w[0]?.p_neu || '') && w[0]?.p_neu !== ALT, 'der Wechsel nennt die alte und eine neue Kennung');
check(JSON.stringify(w[0]?.p_beweis) === JSON.stringify(['w1', 'w2', 'w3']), `als Beweis die Kennungen der eigenen Werte (${JSON.stringify(w[0]?.p_beweis)})`);
check(Object.keys(w[0] || {}).sort().join(' ') === 'apikey art p_alt p_beweis p_neu', `im Wechsel stehen nur die beiden Kennungen und der Beweis – keine Werte, kein Essen (${Object.keys(w[0] || {}).join(' ')})`);
check(w[0]?.apikey?.startsWith('sb_publishable_'), 'nur mit dem öffentlichen Schlüssel');
check(sp.alt === null && sp.neu === w[0]?.p_neu, 'danach ist die alte Kennung vom Handy gelöscht');
const danach = post.filter((p) => p.art !== 'wechsel');
check(danach.length >= 1 && danach.every((p) => (p.geraet || p.p_geraet) === sp.neu), `alles Weitere unter der neuen Kennung (${arten(danach)})`);
check(!JSON.stringify(danach).includes(ALT), 'die alte Kennung geht nirgends mehr mit');
// Der Server hat umgezogen: Was schon gemeldet war, muss nicht noch einmal.
await o.page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
await o.page.waitForTimeout(400);
check(post.filter((p) => p.art === 'wechsel').length === 1, 'beim Weglegen kein zweiter Wechsel');
check(o.fehler.length === 0, `keine Fehler in der Seite ${o.fehler.join(' | ')}`);
await o.browser.close();

// --- 3. Ohne Netz: nichts geht hinaus, nichts geht verloren; mit Netz von selbst ---
let netz = false;
o = await oeffne({ tag: TAG, stand: STAND, weitere: { 'mahlzeit.geraet.v1': ALT } });
post = await mitschreiben(o.page, { wechselNetz: () => netz });
await o.page.waitForTimeout(4700);
sp = await speicher(o.page);
check(arten(post) === 'wechsel-ohne-netz', `ohne Netz: nur der Versuch, sonst nichts (${arten(post)})`);
check(sp.alt === ALT && NEUE_ART.test(sp.neu || ''), 'ohne Netz: die alte Kennung bleibt, die neue ist schon gewürfelt');
const gewuerfelt = sp.neu;
check(o.fehler.filter((f) => !/ERR_FAILED|Failed to load resource/.test(f)).length === 0, 'ohne Netz: kein Fehler in der Seite');
// Die App bleibt benutzbar: ein Wert eintragen geht.
await o.page.click('#reiter-werte');
check(await o.page.locator('#ansicht').innerText().then((t) => /Gewicht/.test(t)), 'ohne Netz: die App läuft weiter');
netz = true;
await o.page.evaluate(() => window.dispatchEvent(new Event('online')));
await o.page.waitForTimeout(700);
sp = await speicher(o.page);
const spaeter = post.filter((p) => p.art === 'wechsel');
check(spaeter.length === 1 && spaeter[0].p_neu === gewuerfelt && spaeter[0].p_alt === ALT, 'Netz wieder da: der Wechsel kommt von selbst, mit derselben neuen Kennung');
check(sp.alt === null && post.some((p) => p.art === 'nutzung' && p.geraet === gewuerfelt) && post.some((p) => p.art === 'werte' && p.p_geraet === gewuerfelt), `und danach Lebenszeichen und Werte unter der neuen (${arten(post)})`);
await o.browser.close();

// --- 4. Umgezogen oder nicht: Die Werte gehen einmal ganz unter der neuen Kennung ---
const von = plus(TAG, -LZ.WERTE_TAGE);
const abdruck = `${von}|${JSON.stringify(LZ.werteFuerTobi(STAND, von))}`;
for (const [antwort, text] of [
  ['{"ok":false,"grund":"ohne"}', 'nicht umgezogen (der Server kennt die alte Kennung nicht): die Werte gehen noch einmal'],
  ['{"ok":false,"grund":"beweis"}', 'nicht erkannt: unter der neuen Kennung von vorn'],
  ['{"ok":true}', 'umgezogen: die Werte gehen trotzdem einmal ganz – dann steht bei Tobi, was auf dem Handy steht'],
]) {
  o = await oeffne({ tag: TAG, stand: STAND, weitere: { 'mahlzeit.geraet.v1': ALT, 'mahlzeit.wertegemeldet.v1': abdruck } });
  post = await mitschreiben(o.page, { wechsel: antwort });
  await o.page.waitForTimeout(4700);
  sp = await speicher(o.page);
  const werte = post.filter((p) => p.art === 'werte');
  check(werte.length === 1 && werte[0].p_geraet === sp.neu && werte[0].p_werte.length === 3 && sp.alt === null, `${text} (${arten(post)})`);
  await o.browser.close();
}
// Gegenprobe: ohne alte Kennung und mit demselben Abdruck geht nichts doppelt.
o = await oeffne({ tag: TAG, stand: STAND, weitere: { 'mahlzeit.wertegemeldet.v1': abdruck } });
post = await mitschreiben(o.page);
await o.page.waitForTimeout(4700);
check(!post.some((p) => p.art === 'werte'), `ohne Wechsel: schon Gemeldetes geht nicht noch einmal (${arten(post)})`);
await o.browser.close();

// --- 5. Ein Fehler des Servers (500) ist wie kein Netz -------------------------------
o = await oeffne({ tag: TAG, stand: STAND, weitere: { 'mahlzeit.geraet.v1': ALT } });
post = [];
await o.page.route(/rest\/v1\/rpc\/mahlzeit_geraet_wechseln/, (r) => { post.push('wechsel'); return r.fulfill({ status: 500, body: 'kaputt', headers: { 'access-control-allow-origin': '*' } }); });
await o.page.route(/rest\/v1\/(mahlzeit_nutzung|rpc\/mahlzeit_werte_melden)/, (r) => { post.push('anderes'); return r.fulfill({ status: 201, body: '' }); });
await o.page.waitForTimeout(4700);
sp = await speicher(o.page);
check(post.join(' ') === 'wechsel' && sp.alt === ALT, `Fehler des Servers: nichts weiter geschickt, alte Kennung bleibt für den nächsten Versuch (${post.join(' ')})`);
await o.browser.close();

// --- 6. Abgeschaltet und Testbrowser: gar keine Frage ---------------------------------
o = await oeffne({ tag: TAG, stand: { ...STAND, meldung: false }, weitere: { 'mahlzeit.geraet.v1': ALT } });
post = await mitschreiben(o.page);
await o.page.waitForTimeout(4700);
check(post.length === 0 && (await speicher(o.page)).alt === ALT, `Meldung abgeschaltet: kein Wechsel, nichts geschickt (${arten(post)})`);
await o.browser.close();
o = await oeffne({ tag: TAG, stand: STAND, weitere: { 'mahlzeit.geraet.v1': ALT }, wieEcht: true });
post = await mitschreiben(o.page);
await o.page.waitForTimeout(4700);
check(post.length === 0, `Testbrowser (v15): kein Wechsel, nichts geschickt (${arten(post)})`);
await o.browser.close();

// --- 7. In den Notizen steht keine Kennung eines Handys und nichts über Uwes Körper ---
const wurzel = new URL('..', import.meta.url).pathname;
const dateien = [];
const sammeln = (ordner) => {
  for (const name of readdirSync(ordner)) {
    if (['node_modules', '.git', 'dist'].includes(name)) continue;
    const pfad = `${ordner}/${name}`;
    if (statSync(pfad).isDirectory()) sammeln(pfad);
    else if (/\.(md|js|mjs|ts|sql|html|json)$/.test(name)) dateien.push(pfad);
  }
};
sammeln(`${wurzel}mahlzeit`);
dateien.push(`${wurzel}CLAUDE.md`, `${wurzel}README.md`);
for (const name of readdirSync(`${wurzel}tests`)) if (/^(test-mz-|mz-)/.test(name)) dateien.push(`${wurzel}tests/${name}`);
const kurz = (pfad) => pfad.replace(wurzel, '');
const mitKennung = [];
const mitKoerper = [];
for (const pfad of dateien) {
  const text = readFileSync(pfad, 'utf8');
  // „geraet = '…'“ oder „Gerät ist `…`“ mit einer festen Kennung (8 bis 24 Zeichen, mit Ziffer)
  for (const m of text.matchAll(/(?:geraet\s*=\s*'|Gerät ist `|^- `)([a-z0-9]{8,24})['`]/gm)) {
    if (/\d/.test(m[1]) && !/^test|^alte/.test(m[1])) mitKennung.push(`${kurz(pfad)}: ${m[1].slice(0, 4)}…`);
  }
  if (/\b1[0-4]\d kg, 1[5-9]\d cm\b|Uwe: \d\d,/.test(text)) mitKoerper.push(kurz(pfad));
}
check(mitKennung.length === 0, `keine Kennung eines Handys in Notizen und Code ${mitKennung.join(', ')}`);
check(mitKoerper.length === 0, `Alter, Gewicht und Größe stehen nicht in den Notizen ${mitKoerper.join(', ')}`);
const sql = readFileSync(`${wurzel}mahlzeit/supabase/geraet.sql`, 'utf8');
check(/mahlzeit_geraet_wechseln/.test(sql) && /mahlzeit_name/.test(sql) && /mahlzeit_wechsel_beweis/.test(sql) && !/insert into[^;]*mahlzeit_name[^;]*values/i.test(sql), 'das SQL liegt im Repo – ohne die Zeile mit Uwes Kennung');

ende();
