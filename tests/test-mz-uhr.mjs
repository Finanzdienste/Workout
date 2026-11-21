/*
 * Mahlzeit v10: Schlaf und Schritte von der Uhr – die Supabase-Funktion
 * mahlzeit-uhr ohne Netz und ohne Deno, dazu das Übernehmen in der App
 * (js/uhr.js).
 *
 * Am iPhone kann hier niemand nachprüfen, was der Kurzbefehl genau schickt.
 * Darum liest die Funktion großzügig, und dieser Test hält fest, was alles
 * gehen muss: ISO 8601 mit und ohne Sekunden, deutsche Datumsformate, Felder
 * in anderer Reihenfolge, Zahlen mit Einheit und Tausenderpunkt, iPhone und
 * Uhr, die dieselbe Nacht doppelt melden, „Im Bett“ und „Wach“, fehlende
 * Uhrzeit (Zeit einschließen vergessen).
 */
import * as H from '../mahlzeit/supabase/functions/mahlzeit-uhr/handler.ts';
import * as U from '../mahlzeit/js/uhr.js';
import { pruefer, oeffne } from './mz-hilfe.mjs';

const { check, ende } = pruefer();
const K = 'abcdefghjk23456789mn';
const HERKUNFT = 'https://finanzdienste.github.io';

// --- Lesen
check(H.zeitLesen('2026-11-21T07:12:00+01:00')?.tag === '2026-11-21' && H.zeitLesen('2026-11-21T07:12+01:00')?.mitZeit, 'ISO 8601, mit und ohne Sekunden');
check(H.zeitLesen('21.11.2026, 07:12')?.tag === '2026-11-21' && H.zeitLesen('21.11.26 um 07:12')?.mitZeit, 'deutsches Datum („21.11.2026, 07:12“, „21.11.26 um 07:12“)');
check(H.zeitLesen('2026-11-21')?.mitZeit === false && H.zeitLesen('Kern') === null && H.zeitLesen('31.02.2026') === null, 'ohne Uhrzeit erkannt, Unsinn nicht als Datum');
check(['8.432', '8432 Schritte', '1234.0', '8 432', '12,345'].map(H.zahlLesen).join() === '8432,8432,1234,8432,12345', 'Zahlen: Tausenderpunkt, Einheit, Nachkomma');

const NACHT = [
  'Im Bett|2026-11-20T22:40:00+01:00|2026-11-21T06:55:00+01:00',
  'Kern|2026-11-20T23:00:00+01:00|2026-11-21T01:00:00+01:00',
  'Tief|2026-11-21T01:00:00+01:00|2026-11-21T02:00:00+01:00',
  'Wach|2026-11-21T02:00:00+01:00|2026-11-21T02:15:00+01:00',
  'REM|2026-11-21T02:15:00+01:00|2026-11-21T06:30:00+01:00',
  // dieselbe Nacht noch einmal vom iPhone, überlappend
  'Schlafend|2026-11-20T23:30:00+01:00|2026-11-21T01:30:00+01:00',
  // die Nacht davor
  'Core|2026-11-19T23:15:00+01:00|2026-11-20T06:45:00+01:00',
].join('\n');
const s = H.schlafLesen(NACHT);
const nacht = (tag) => s.werte.find((w) => w.tag === tag)?.wert;
check(nacht('2026-11-21') === 435, `Nacht zum 21.: 23:00–02:00 und 02:15–06:30 = 7 Std 15 Min, „Im Bett“ und „Wach“ zählen nicht, das iPhone nicht doppelt (${nacht('2026-11-21')})`);
check(nacht('2026-11-20') === 450, 'Nacht zum 20.: 7 Std 30 Min');
const anders = H.schlafLesen('2026-11-20T23:00:00+01:00|2026-11-21T06:00:00+01:00|Kern\n21.11.2026, 13:00|21.11.2026, 13:20|Kern');
check(anders.werte.length === 1 && anders.werte[0].wert === 440, 'Felder in anderer Reihenfolge; ein Nickerchen unter 30 Minuten allein zählt am selben Tag mit, nicht als eigene Nacht');
const ohne = H.schlafLesen('Kern|2026-11-20|2026-11-21');
check(ohne.werte.length === 0 && ohne.ohneZeit === 1, 'ohne Uhrzeit: nichts gespeichert, aber gezählt (für den Hinweis)');
check(H.quittung([], 1).includes('Zeit einschließen'), '… und die Antwort sagt, was im Kurzbefehl fehlt');

const SCHRITTE = '2026-11-20T00:00:00+01:00|8.432\n2026-11-21T00:00:00+01:00|1204 Schritte\n2026-11-21T00:00:00+01:00|96';
const st = H.schritteLesen(SCHRITTE);
check(st.map((w) => `${w.tag}=${w.wert}`).join() === '2026-11-20=8432,2026-11-21=1300', 'Schritte je Tag zusammengezählt');
check(H.schritteLesen('8432|2026-11-20T00:00:00+01:00')[0]?.wert === 8432, 'Schritte: Reihenfolge egal');

// --- Die Funktion
function umgebung() {
  const db = { werte: new Map(), eingang: [] };
  const env = {
    erlaubteUrspruenge: [HERKUNFT],
    speichern: async (k, werte) => { werte.forEach((w) => db.werte.set(`${k}|${w.art}|${w.tag}`, w)); },
    eingang: async (k, roh, anzahl) => { db.eingang.push({ k, roh, anzahl, at: '2026-11-21T08:31:00Z' }); },
    holen: async (k, seit) => ({
      werte: [...db.werte].filter(([key, w]) => key.startsWith(`${k}|`) && w.tag >= seit).map(([, w]) => w),
      zuletzt: db.eingang.filter((e) => e.k === k).at(-1)?.at ?? null,
    }),
  };
  return { handler: H.erstelleHandler(env), db };
}
const { handler, db } = umgebung();
const adresse = (q) => `https://x.supabase.co/functions/v1/mahlzeit-uhr${q}`;
let res = await handler(new Request(adresse(`?k=${K}`), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ schlaf: NACHT, schritte: SCHRITTE }) }));
const quittung = await res.text();
check(res.status === 200 && quittung.startsWith('✓') && quittung.includes('21.11. 7 Std 15 Min') && quittung.includes('20.11. 8.432'), `Kurzbefehl schickt: angenommen, lesbare Antwort („${quittung.slice(0, 80)}…“)`);
check(db.werte.size === 4 && db.eingang[0].roh.includes('REM|') && db.eingang[0].anzahl === 4, 'gespeichert: 2 Nächte, 2 Tage Schritte; roh zum Nachsehen');
// Der nächste Lauf (abends) schickt die Schritte neu: ersetzt, nicht addiert
await handler(new Request(adresse(`?k=${K}`), { method: 'POST', body: JSON.stringify({ schlaf: '', schritte: '2026-11-21T00:00:00+01:00|9.870' }) }));
check(db.werte.get(`${K}|schritte|2026-11-21`).wert === 9870 && db.werte.size === 4, 'zweiter Lauf am selben Tag ersetzt die Schritte');
// Listen statt Text (falls der Kurzbefehl die Ergebnisse als Liste schickt)
await handler(new Request(adresse(`?k=${K}`), { method: 'POST', body: JSON.stringify({ schritte: ['2026-11-19T00:00:00+01:00|5000'] }) }));
check(db.werte.get(`${K}|schritte|2026-11-19`)?.wert === 5000, 'eine Liste statt Text geht auch');
res = await handler(new Request(adresse('?k=kurz'), { method: 'POST', body: '{}' }));
check(res.status === 400 && (await res.text()).includes('neu kopieren'), 'Adresse ohne gültigen Schlüssel: 400, mit Satz');

res = await handler(new Request(adresse(`?k=${K}&seit=2026-11-20`), { headers: { origin: HERKUNFT } }));
const geholt = await res.json();
check(res.headers.get('access-control-allow-origin') === HERKUNFT && geholt.werte.length === 4 && geholt.zuletzt, 'App holt ab dem 20.: 4 Werte und wann zuletzt etwas ankam');
res = await handler(new Request(adresse(`?k=${K}`), { headers: { origin: 'https://boese.example' } }));
check(res.status === 403, 'fremde Seite bekommt nichts');
res = await handler(new Request(adresse(`?k=${K}`), { method: 'OPTIONS', headers: { origin: HERKUNFT } }));
check(res.status === 204 && res.headers.get('access-control-allow-methods').includes('GET'), 'Vorabfrage des Browsers');

const kaputt = H.erstelleHandler({ erlaubteUrspruenge: [], speichern: async () => {}, eingang: async () => { throw new Error('db'); }, holen: async () => ({ werte: [], zuletzt: null }) });
res = await kaputt(new Request(adresse(`?k=${K}`), { method: 'POST', body: '{}' }));
check(res.status === 503 && (await res.text()).includes('nächste Lauf'), 'Datenbank weg: 503, der nächste Lauf holt es nach');

// --- Übernehmen in der App
const stand = { werte: [
  { id: 'w1', art: 'schlaf', tag: '2026-11-20', wert: 400 },                  // von Hand
  { id: 'w2', art: 'schritte', tag: '2026-11-20', wert: 100, quelle: 'uhr' }, // alt von der Uhr
] };
let n = 0;
const geaendert = U.uebernehmen(stand, geholt.werte, () => `u${++n}`);
const hol = (art, tag) => stand.werte.find((w) => w.art === art && w.tag === tag);
check(hol('schlaf', '2026-11-20').wert === 400 && !hol('schlaf', '2026-11-20').quelle, 'von Hand Eingetragenes bleibt');
check(hol('schritte', '2026-11-20').wert === 8432 && hol('schlaf', '2026-11-21').quelle === 'uhr' && hol('schlaf', '2026-11-21').wert === 435, 'von der Uhr: neu dazu oder aktualisiert, mit ⌚-Herkunft');
check(geaendert === 3 && U.uebernehmen(stand, geholt.werte, () => 'x') === 0, 'ein zweites Mal ändert nichts');
check(U.uebernehmen(stand, [{ art: 'gewicht', tag: '2026-11-21', wert: 1 }, { art: 'schlaf', tag: 'gestern', wert: 1 }], () => 'y') === 0, 'fremde Arten und kaputte Tage werden nicht übernommen');
check(U.senderAdresse(K) === `${U.UHR_ADRESSE}?k=${K}` && /^[a-z0-9]{20}$/.test(U.neuerSchluessel()), 'Adresse für den Kurzbefehl, Schlüssel aus 20 Zeichen');

// --- In der App (iPhone): Hinweis an Uwe, Anleitung für Tobi, Abholen
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
const o = await oeffne({ tag: '2026-11-21', zeit: '09:40', kontext: { userAgent: IPHONE } });
const p = o.page;
const abrufe = [];
let antwort = { werte: [], zuletzt: null };
await p.route(/functions\/v1\/mahlzeit-uhr/, (r) => {
  abrufe.push(r.request().url());
  r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(antwort) });
});
check(await p.locator('#uhr-hinweis').isVisible() && (await p.locator('#uhr-hinweis').innerText()).includes('Tobi'), 'iPhone: Hinweis „muss Tobi einmal einrichten“ auf der Startseite');
await p.click('#uhr-hinweis [data-tun="uhr-einrichten"]');
const k = (await o.gespeichert()).uhr?.k;
check(/^[a-z0-9]{20}$/.test(k || '') && (await p.locator('#uhr-adresse').innerText()) === U.senderAdresse(k), 'Tobi richtet ein: Schlüssel angelegt, die Adresse steht da');
const anleitung = await p.locator('#ebene').innerText();
check(['Health-Samples suchen', 'Schlafanalyse', 'Wiederholen mit jedem', 'ISO 8601', 'Zeit einschließen', 'Text kombinieren', 'Gruppieren nach', 'Inhalte von URL abrufen', 'POST', 'JSON', 'schlaf', 'schritte', 'Sofort ausführen', '21:30'].every((w) => anleitung.includes(w)), 'die Anleitung nennt alle Aktionen und Einstellungen');
await p.click('#uhr-nachsehen');
await p.waitForFunction(() => document.querySelector('#uhr-status')?.textContent.includes('Noch nichts'));
check(true, 'Nachsehen ohne Daten: „Noch nichts angekommen …“');
antwort = { werte: [{ art: 'schlaf', tag: '2026-11-21', wert: 435 }, { art: 'schritte', tag: '2026-11-20', wert: 8432 }], zuletzt: '2026-11-21T08:31:00Z' };
await p.click('#uhr-nachsehen');
await p.waitForFunction(() => document.querySelector('#uhr-status')?.textContent.includes('✓'));
const status = await p.locator('#uhr-status').innerText();
check(status.includes('7 Std 15 Min') && status.includes('8.432') && abrufe.at(-1).includes(`k=${k}`) && abrufe.at(-1).includes('seit=2026-11-07'), `Nachsehen mit Daten: „${status}“`);
await p.click('#ebene .gross-knopf[data-tun="ebene-zu"]');
check(await p.locator('#uhr-hinweis').count() === 0, 'eingerichtet: der Hinweis ist weg');
await p.click('#reiter-werte');
check((await p.locator('#karte-schlaf').innerText()).includes('7 Std 15 Min') && (await p.locator('#karte-schlaf').innerText()).includes('⌚'), 'Werte: Schlaf von der Uhr, mit ⌚');
await p.click('#reiter-mehr');
check((await p.locator('#karte-uhr').innerText()).includes('Zuletzt angekommen'), 'Mehr: verbunden, zuletzt angekommen');
// Beim nächsten Öffnen holt die App von selbst (Abstand vorbei)
await p.evaluate(() => localStorage.removeItem('mahlzeit.uhr.v1'));
antwort = { werte: [{ art: 'schritte', tag: '2026-11-21', wert: 2100 }], zuletzt: '2026-11-21T20:30:00Z' };
const vorher = abrufe.length;
await p.reload();
await p.waitForFunction((n) => window.__abrufe === undefined && document.documentElement.dataset.bereit === '1', vorher);
await p.waitForTimeout(2200);
check(abrufe.length === vorher + 1 && (await o.gespeichert()).werte.some((w) => w.art === 'schritte' && w.tag === '2026-11-21' && w.wert === 2100), 'beim Öffnen von selbst abgeholt');
await p.click('#reiter-mehr');
o.dialog.antwort = true;
await p.click('[data-tun="uhr-trennen"]');
check(!(await o.gespeichert()).uhr && (await o.gespeichert()).werte.some((w) => w.quelle === 'uhr'), 'Trennen: Schlüssel weg, Werte bleiben');
check(o.fehler.length === 0, `keine Fehler in der Seite${o.fehler.length ? `: ${o.fehler.slice(0, 3).join(' | ')}` : ''}`);
await o.browser.close();

// Android: kein Hinweis auf der Startseite
const a = await oeffne({ tag: '2026-11-21' });
check(await a.page.locator('#uhr-hinweis').count() === 0, 'nicht auf dem iPhone: kein Hinweis auf der Startseite');
await a.browser.close();

ende();
