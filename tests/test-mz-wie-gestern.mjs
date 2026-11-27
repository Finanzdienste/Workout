/*
 * Mahlzeit v17: „Wie gestern“ – eine Tageszeit vom letzten Tag mit einem Tipp
 * wiederholen. Tobi, 27.11.: „Alle drei“ (Vorschlag, weil Uwe von Tag zu Tag
 * weniger einträgt: 13 → 4). Geprüft: welche Tageszeiten angeboten werden,
 * dass der Tipp sie mit neuen Kennungen einträgt, Rückgängig, ein Tag Pause
 * („wie am Mittwoch“), und ohne Netz.
 */
import * as R from '../mahlzeit/js/rechnen.js';
import { oeffne, pruefer, summe } from './mz-hilfe.mjs';

const { check, ende } = pruefer();
const TAG = '2026-11-27';
const GESTERN = [
  { id: 'a', n: 'Overnight Oats', p: '1 Glas', m: 1, kcal: 385, kh: 50, ei: 18, z: 'morgens' },
  { id: 'b', n: 'Kaffee mit Milch', p: '1 Tasse', m: 1, kcal: 20, kh: 2, ei: 1, z: 'morgens' },
  { id: 'c', n: 'Hähnchen-Kartoffel-Blech', p: '1 Portion', m: 1, kcal: 590, kh: 45, ei: 48, z: 'mittags' },
  { id: 'd', n: 'Haferbrei', p: '75 g', m: 1, kcal: 275, kh: 45, ei: 10, z: 'abends', h: 2 },
];
const STAND = {
  v: 1, hinweise: { willkommen: TAG, sportNeu: TAG, uhrSpaeter: TAG, installiert: TAG },
  tage: { '2026-11-26': GESTERN, [TAG]: [{ id: 'x', n: 'Brötchen', p: '1 Stück', m: 1, kcal: 140, kh: 27, ei: 5, z: 'mittags' }] },
};

// --- Rechnen
const v = R.wieVorher(STAND, TAG);
check(v.quelle === '2026-11-26' && v.zeiten.map((z) => z.z).join() === 'morgens,abends', 'angeboten: Morgens und Abends von gestern – Mittags hat heute schon etwas');
check(v.zeiten[0].kcal === 405 && v.zeiten[0].eintraege.length === 2, 'Morgens: 2 Sachen, 405 kcal');
const kopie = R.wiederholen(GESTERN.slice(3), () => 'neu1');
check(kopie[0].id === 'neu1' && !('h' in kopie[0]) && kopie[0].n === 'Haferbrei', 'Kopie mit neuer Kennung, ohne Hafer-Platz');
check(R.wieVorher({ tage: { '2026-11-24': GESTERN } }, TAG).quelle === '2026-11-24', 'ein paar Tage Pause: der letzte Tag mit Einträgen');
check(R.wieVorher({ tage: { '2026-11-10': GESTERN } }, TAG) === null && R.wieVorher({ tage: {} }, TAG) === null, 'länger als eine Woche her oder nichts: kein Angebot');

// --- In der App
const o = await oeffne({ tag: TAG, zeit: '08:05', stand: STAND });
const p = o.page;
const draussen = [];
p.on('request', (r) => { if (!r.url().startsWith('http://127.0.0.1')) draussen.push(r.url()); });
check(await p.locator('#wie-vorher [data-z="morgens"]').isVisible() && (await p.locator('#wie-vorher').innerText()).includes('Morgens wie gestern'), 'Heute: „↻ Morgens wie gestern“');
check(await p.locator('#wie-vorher [data-z="mittags"]').count() === 0, 'kein Mittags (heute schon eingetragen)');
await p.click('#wie-vorher [data-z="morgens"]');
check(await summe(p) === 545, `Morgens übernommen: 140 + 405 = 545 kcal (${await summe(p)})`);
let st = await o.gespeichert();
const heute = st.tage[TAG];
check(heute.length === 3 && heute.filter((e) => e.z === 'morgens').every((e) => !['a', 'b'].includes(e.id)), 'mit neuen Kennungen (gestern bleibt unberührt)');
check(st.tage['2026-11-26'].length === 4, 'gestern unverändert');
check(await p.locator('#wie-vorher [data-z="morgens"]').count() === 0 && await p.locator('#wie-vorher [data-z="abends"]').isVisible(), 'danach nur noch Abends im Angebot');
check((await p.locator('#meldung').innerText()).includes('Morgens: 2 Sachen eingetragen (405 kcal)'), 'Meldung mit Rückgängig');
await p.click('#meldung [data-tun="rueckgaengig"]');
st = await o.gespeichert();
check(st.tage[TAG].length === 1 && await summe(p) === 140, 'Rückgängig: wieder nur das Brötchen');
check(draussen.filter((u) => !/mahlzeit_(nutzung|werte|essen)|mahlzeit-ki|mahlzeit-uhr/.test(u)).length === 0, 'geht ohne Netz');
check(o.fehler.length === 0, `keine Fehler${o.fehler.length ? `: ${o.fehler.join(' | ')}` : ''}`);
await o.browser.close();

const pause = await oeffne({ tag: TAG, stand: { ...STAND, tage: { '2026-11-25': GESTERN } } });
check((await pause.page.locator('#wie-vorher').innerText()).includes('wie am Mittwoch'), 'ein Tag Pause: „Morgens wie am Mittwoch“');
await pause.browser.close();
ende();
