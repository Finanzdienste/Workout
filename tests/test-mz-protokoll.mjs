/*
 * Mahlzeit v16: das Ernährungsprotokoll. Uwe (über Tobi, 27.11.): „Gibt es
 * eine Möglichkeit das ich die eingetragenen Lebensmittel pro Tag irgendwie
 * auslesen kann? Dann bräuchte ich sie nicht doppelt für meine
 * Ernährungsprotokoll für die Ernährungsberatung aufzuschreiben.“
 * Geprüft: Tage, Tageszeiten, Mengen, Summen und Werte im Text; die Ebene mit
 * Zeitraum, Teilen und Drucken; ohne Netz.
 */
import * as R from '../mahlzeit/js/rechnen.js';
import { oeffne, pruefer } from './mz-hilfe.mjs';

const { check, ende } = pruefer();
const TAG = '2026-11-27';
const STAND = {
  v: 1, hinweise: { willkommen: TAG, sportNeu: TAG, uhrSpaeter: TAG },
  tage: {
    '2026-11-27': [
      { id: 'a', n: 'Overnight Oats', p: '1 Glas', m: 1, kcal: 385, kh: 50, ei: 18, z: 'morgens' },
      { id: 'b', n: 'Brötchen', p: '1 Stück (55 g)', m: 2, kcal: 140, kh: 27, ei: 5, z: 'mittags' },
      { id: 'c', n: 'Kaffee mit Milch', p: '1 Tasse', m: 1, kcal: 20, kh: 2, ei: 1, z: 'morgens' },
    ],
    '2026-11-25': [{ id: 'd', n: 'Haferbrei', p: '75 g', m: 1, kcal: 275, kh: 45, ei: 10, z: 'abends', h: 0 }],
    '2026-11-01': [{ id: 'e', n: 'Pizza', p: '1 Stück', m: 1, kcal: 800, kh: 90, ei: 30, z: 'abends' }],
  },
  werte: [
    { id: 'w1', art: 'gewicht', tag: '2026-11-27', wert: 126.2 },
    { id: 'w2', art: 'zucker', tag: '2026-11-27', wert: 150, wann: 'nuechtern', uhr: '07:30' },
    { id: 'w3', art: 'schlaf', tag: '2026-11-27', wert: 270 },
  ],
  hafer: { tage: ['2026-11-25'] },
};

// --- Rechnen
const tage = R.protokollTage(STAND, '2026-11-21', TAG);
check(tage.map((t) => t.tag).join() === '2026-11-25,2026-11-27', 'nur Tage mit Einträgen im Zeitraum, der älteste zuerst');
const heute = tage[1];
check(heute.zeiten.map((z) => z.n).join() === 'Morgens,Mittags' && heute.zeiten[0].eintraege.length === 2, 'nach Tageszeit geordnet');
check(heute.zeiten[1].eintraege[0].text === '2 × Brötchen, 1 Stück (55 g)' && heute.zeiten[1].eintraege[0].kcal === 280, 'Menge mal Portion: 2 × Brötchen, 280 kcal');
check(heute.summe.kcal === 685 && heute.summe.kh === 106 && heute.summe.ei === 29, 'Summe des Tages: 685 kcal, 106 g KH, 29 g Eiweiß');
check(heute.werte.join(' · ') === 'Gewicht 126,2 kg · Blutzucker 150 mg/dl (nüchtern, 07:30)', 'Werte des Tages: Gewicht und Blutzucker, nicht der Schlaf');
const text = R.protokollText(STAND, '2026-11-21', TAG);
check(text.startsWith('Ernährungsprotokoll Sa, 21.11. bis Fr, 27.11.') && text.includes('Mittwoch, 25. November (Hafertag)') && text.includes('- Overnight Oats, 1 Glas: 385 kcal') && text.includes('Summe: 685 kcal · 106 g Kohlenhydrate · 29 g Eiweiß') && !text.includes('Pizza'), 'als Text: Kopf, Tage, Einträge, Summe, ohne den 1.11.');
check(R.protokollText({ tage: {} }, '2026-11-21', TAG).includes('nichts eingetragen'), 'leer: ein Satz');

// --- In der App
const o = await oeffne({ tag: TAG, zeit: '18:00', stand: STAND });
const p = o.page;
const anfragen = [];
p.on('request', (r) => { if (!r.url().startsWith('http://127.0.0.1')) anfragen.push(r.url()); });
check(await p.locator('#protokoll-knopf').isVisible(), 'Heute: Knopf „Ernährungsprotokoll“');
await p.click('#reiter-mehr');
check((await p.locator('#karte-protokoll').innerText()).includes('Ernährungsberatung'), 'Mehr: Karte „Ernährungsprotokoll“');
await p.click('#karte-protokoll [data-tun="protokoll"]');
let inhalt = await p.locator('#protokoll').innerText();
check(inhalt.includes('Overnight Oats') && inhalt.includes('685 kcal') && inhalt.includes('Haferbrei') && !inhalt.includes('Pizza'), 'die letzten 7 Tage: zwei Tage, ohne die Pizza vom 1.11.');
await p.click('[data-tun="protokoll-zeitraum"][data-z="30"]');
inhalt = await p.locator('#protokoll').innerText();
check(inhalt.includes('Pizza'), '30 Tage: auch der 1.11.');
await p.evaluate(() => { window.__geteilt = []; navigator.share = async (d) => { window.__geteilt.push(d); }; window.__gedruckt = 0; window.print = () => { window.__gedruckt++; }; });
await p.click('#protokoll-teilen');
const geteilt = await p.evaluate(() => window.__geteilt[0]);
check(geteilt?.title === 'Ernährungsprotokoll' && geteilt.text.includes('Pizza') && geteilt.text.includes('Overnight Oats'), 'Teilen: der Text des gewählten Zeitraums');
await p.click('#protokoll-drucken');
check(await p.evaluate(() => window.__gedruckt) === 1, 'Drucken / PDF öffnet das Druckfenster');
await p.emulateMedia({ media: 'print' });
const sichtbar = await p.evaluate(() => {
  const da = (sel) => document.querySelector(sel).getClientRects().length > 0;
  return { leiste: da('.leiste'), knopf: da('#protokoll-teilen'), chips: da('[data-tun="protokoll-zeitraum"]'), protokoll: da('#protokoll'), titel: da('#protokoll .nur-drucken') };
});
check(!sichtbar.leiste && !sichtbar.knopf && !sichtbar.chips && sichtbar.protokoll && sichtbar.titel, `beim Drucken nur das Protokoll mit Überschrift, ohne Knöpfe und Leiste (${JSON.stringify(sichtbar)})`);
await p.emulateMedia({ media: 'screen' });
check(anfragen.length === 0, `geht ganz ohne Netz (${anfragen.length} Anfragen nach draußen)`);
check(o.fehler.length === 0, `keine Fehler${o.fehler.length ? `: ${o.fehler.slice(0, 2).join(' | ')}` : ''}`);
await o.browser.close();

const leer = await oeffne({ tag: TAG, stand: { ...STAND, tage: {} } });
check(await leer.page.locator('#protokoll-knopf').count() === 0, 'noch nichts eingetragen: kein Knopf auf Heute');
await leer.browser.close();
ende();
