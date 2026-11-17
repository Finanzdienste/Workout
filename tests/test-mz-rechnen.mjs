/*
 * Mahlzeit: was gerechnet wird – ohne Browser.
 *
 * Die Lebensmittel-Liste (stimmig, keine doppelten Kennungen, keine
 * unmöglichen Werte), die Suche (Umlaute, Synonyme, mehrere Wörter, „oft bei
 * dir" vorn), Mengen und Summen, Tage über Monats- und Zeitumstellung, die
 * Hafertage nach dem Infoblatt, die Kalenderdatei und die Sicherung.
 */
import { BEREICHE, LEBENSMITTEL, BELIEBT, NACH_ID } from '../mahlzeit/js/lebensmittel.js';
import * as R from '../mahlzeit/js/rechnen.js';
import { pruefer } from './mz-hilfe.mjs';

const { check, ende } = pruefer();

// --- Die Liste
const ids = LEBENSMITTEL.map((l) => l.id);
check(new Set(ids).size === ids.length, `jede Kennung gibt es nur einmal (${ids.length} Sachen)`);
check(LEBENSMITTEL.length >= 150, `die Liste kennt mindestens 150 Sachen (${LEBENSMITTEL.length})`);
const bereiche = new Set(BEREICHE.map((b) => b.id));
check(LEBENSMITTEL.every((l) => bereiche.has(l.k)), 'jede Sache gehört zu einem bekannten Bereich');
check(BEREICHE.every((b) => LEBENSMITTEL.some((l) => l.k === b.id)), 'kein Bereich ist leer');
check(LEBENSMITTEL.every((l) => Number.isInteger(l.kcal) && l.kcal >= 0 && l.kcal <= 2000), 'kcal sind ganze Zahlen zwischen 0 und 2000');
const zuViel = LEBENSMITTEL.filter((l) => l.kh * 4 > l.kcal + 5);
check(!zuViel.length, `keine Sache hat mehr Kohlenhydrate, als ihre Kalorien hergeben${zuViel.length ? `: ${zuViel.map((l) => l.id).join(', ')}` : ''}`);
check(LEBENSMITTEL.every((l) => l.n && l.p), 'jede Sache hat Namen und Portion');
check(BELIEBT.every((id) => NACH_ID.has(id)), 'jede Sache unter „Beliebt" gibt es');
const hafer = NACH_ID.get('hafer_wasser');
check(Math.abs(hafer.kcal * 3 - 828) < 20 && Math.abs(hafer.kh * 3 - 132) < 5,
  `Haferbrei: dreimal am Tag ≈ 828 kcal und 132 g Kohlenhydrate wie im Infoblatt (${hafer.kcal * 3} kcal, ${hafer.kh * 3} g)`);

// --- Suche
const erster = (q, oft) => R.suche(q, LEBENSMITTEL, oft)[0]?.id;
check(erster('semmel') === 'broetchen', `„semmel" findet das Brötchen (${erster('semmel')})`);
check(erster('Schrippe') === 'broetchen', '„Schrippe" auch');
check(erster('döner') === 'doener', `„döner" findet den Döner (${erster('döner')})`);
check(erster('doner') === 'doener', `„doner" ohne Umlaut auch (${erster('doner')})`);
check(erster('doener') === 'doener', '„doener" auch');
check(erster('DÖNER') === 'doener', 'Großbuchstaben stören nicht');
check(erster('broetchen') === 'broetchen' && erster('brotchen') === 'broetchen', '„broetchen" und „brotchen" finden das Brötchen');
check(erster('Nutella') === 'nussnougat', 'Markennamen als Suchwort: „Nutella" findet die Nuss-Nougat-Creme');
const cola = R.suche('cola', LEBENSMITTEL).map((l) => l.id);
check(['cola_dose', 'cola_flasche', 'cola_zero'].every((id) => cola.includes(id)), '„cola" findet Dose, Flasche und Zero');
const km = R.suche('kaffee milch', LEBENSMITTEL).map((l) => l.id);
check(km.includes('kaffee_milch') && km.includes('kaffee_mz') && !km.includes('kaffee'), 'zwei Wörter: beide müssen passen („kaffee milch" ohne schwarzen Kaffee)');
check(R.suche('xyzq', LEBENSMITTEL).length === 0, 'Unsinn findet nichts');
check(R.suche('   ', LEBENSMITTEL).length === 0, 'leere Eingabe findet nichts');
check(erster('cola', new Map([['cola_zero', 5]])) === 'cola_zero', 'was man oft isst, steht vorn');
check(R.suche('a', LEBENSMITTEL).length <= 40, 'höchstens 40 Treffer');
const eigene = [{ id: 'eigen-1', n: 'Kantine Gulasch', kcal: 650, kh: 50, k: 'eigen' }, ...LEBENSMITTEL];
check(R.suche('kantine', eigene)[0].id === 'eigen-1', 'eigene Sachen findet die Suche mit');

// --- Mengen und Summen
check(R.menge(0.5) === '½' && R.menge(1.5) === '1½' && R.menge(2) === '2' && R.menge(1) === '1', 'Mengen: ½, 1½, 2');
const s = R.summe([{ kcal: 140, kh: 27, m: 2 }, { kcal: 210, kh: 53, m: 1 }, { kcal: 245, kh: 27, m: 0.5 }]);
check(s.kcal === 280 + 210 + 123 && s.kh === 54 + 53 + 14, `Summe mit Mengen (${s.kcal} kcal, ${s.kh} g)`);
check(R.zahl(1240) === '1.240' && R.zahl(0) === '0', 'Tausenderpunkt');

// --- Tage und Tageszeiten
check(R.plusTage('2026-03-28', 2) === '2026-03-30', 'über die Zeitumstellung im März');
check(R.plusTage('2026-10-24', 2) === '2026-10-26', 'über die Zeitumstellung im Oktober');
check(R.plusTage('2026-12-31', 1) === '2027-01-01' && R.plusTage('2026-03-01', -1) === '2026-02-28', 'über Jahres- und Monatsgrenzen');
check(R.abstand('2026-11-17', '2026-11-21') === 4, 'Abstand in Tagen');
check(R.datumLang('2026-11-17') === 'Dienstag, 17. November', `Datum in Worten (${R.datumLang('2026-11-17')})`);
check(R.tagName('2026-11-16', '2026-11-17') === 'Gestern' && R.tagName('2026-11-17', '2026-11-17') === 'Heute', 'Heute und Gestern');
check([7, 12, 16, 20, 1].map(R.tageszeitZu).join() === 'morgens,mittags,nachmittags,abends,abends', 'Tageszeit aus der Stunde (der Döner um eins zählt zum Abend)');

// --- Hafertage
const stand = R.leererStand();
check(stand.hafer.proMonat === 3, 'ohne Einstellung: 3 Hafertage im Monat');
stand.hafer.tage = ['2026-11-21', '2026-11-22', '2026-11-23', '2026-12-05'];
check(JSON.stringify(R.haferBlock(stand, '2026-11-22')) === '{"nr":2,"von":3}', 'drei am Stück: der mittlere ist Tag 2 von 3');
check(JSON.stringify(R.haferBlock(stand, '2026-12-05')) === '{"nr":1,"von":1}', 'ein einzelner Hafertag ist Tag 1 von 1');
check(R.haferBlock(stand, '2026-11-24') === null, 'kein Hafertag: kein Block');
check(R.naechsterHafertag(stand, '2026-11-17') === '2026-11-21' && R.naechsterHafertag(stand, '2026-11-22') === '2026-11-22', 'nächster Hafertag, heute eingeschlossen');
check(R.naechsterHafertag(stand, '2026-12-06') === null, 'nach dem letzten: keiner');
check(R.haferImMonat(stand, '2026-11').length === 3, 'drei im November');
stand.tage['2026-11-21'] = [{ n: 'Haferbrei', kcal: 275, h: 0 }, { n: 'Haferbrei', kcal: 285, h: 2 }, { n: 'Apfel', kcal: 80 }];
check(R.haferGegessen(stand, '2026-11-21').join() === 'true,false,true', 'welche Hafer-Mahlzeiten gegessen sind');
check(!R.haferFertig(stand, '2026-11-21'), 'zwei von drei sind nicht fertig');
const e2 = R.haferEinkauf(2);
check(e2.gramm === 450 && e2.packungen === 1 && e2.bruehe === 2, 'Einkauf für 2 Hafertage: 450 g, eine Packung, 2 l Brühe');
check(R.haferEinkauf(3).packungen === 2, 'für 3 Hafertage zwei Packungen (675 g)');
const nov = R.monatsblatt(2026, 10);
check(nov[0][6] === '2026-11-01' && nov[0][5] === null && nov.flat().filter(Boolean).length === 30, 'November 2026 beginnt am Sonntag, 30 Tage');
check(nov.every((w) => w.length === 7), 'jede Woche hat sieben Felder');

// --- Hafertage am Stück (v2)
const bl = R.haferBloecke(['2026-11-23', '2026-11-21', '2026-11-22', '2026-12-05', '2026-11-22']);
check(bl.length === 2 && bl[0].anfang === '2026-11-21' && bl[0].laenge === 3 && bl[1].laenge === 1, 'Läufe: 21.–23.11. und 5.12.');
check(R.blockAb('2026-11-30', 3).join() === '2026-11-30,2026-12-01,2026-12-02', 'drei Tage ab dem 30.11. gehen in den Dezember');
check(R.plusMonate('2026-11-30', 3) === '2027-02-28' && R.plusMonate('2027-01-31', 1) === '2027-02-28' && R.plusMonate('2026-08-20', 3) === '2026-11-20', 'plus Monate, am Monatsende gekappt');
const rs = R.leererStand();
check(rs.hafer.art === null && rs.hafer.amStueck === 3 && rs.hafer.alleMonate === 1, 'neu: noch nicht gefragt, am Stück 3 Tage, jeden Monat');
check(R.naechsteRunde(rs, '2026-11-17') === null, 'ohne Hafertage: keine nächste Runde');
rs.hafer.alleMonate = 3;
rs.hafer.tage = ['2026-05-02', '2026-05-03', '2026-08-20', '2026-08-21', '2026-12-24'];
check(R.naechsteRunde(rs, '2026-11-17') === '2026-11-20', 'nächste Runde: Beginn der letzten begonnenen + 3 Monate (geplante zählen nicht)');
check(R.ordnen({ hafer: { proMonat: 0 } }).hafer.art === 'aus', 'Stand aus v1 mit „aus" (proMonat 0) bleibt aus');
check(R.ordnen({ hafer: { proMonat: 3 } }).hafer.art === null, 'Stand aus v1 ohne Antwort: die Frage kommt');
check(R.ordnen({ hafer: { art: 'quatsch', amStueck: 9, alleMonate: 0 } }).hafer.art === null, 'unbekannte Antwort: wieder fragen');

// --- Gerät
check(R.geraet('Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X)') === 'ios', 'iPhone erkannt');
check(R.geraet('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari', 5) === 'ios', 'iPad (meldet sich als Mac, mit Touch) erkannt');
check(R.geraet('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari', 0) === 'andere', 'echter Mac: kein iPhone');
check(R.geraet('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/141 Mobile') === 'android', 'Android erkannt');

check(R.safariFassung('Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1') === 26,
  'Safari 26 meldet „iPhone OS 18_6" – gezählt wird „Version/26"');
check(R.safariFassung('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1') === 17, 'Safari 17');
check(R.safariFassung('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/119.0 Mobile/15E148 Safari/604.1') === null, 'Chrome auf dem iPhone ist kein Safari');

// --- Kalenderdatei
const ics = R.haferIcs(['2026-11-22', '2026-11-21'], new Date(Date.UTC(2026, 10, 17, 9, 30)));
check((ics.match(/BEGIN:VEVENT/g) || []).length === 2, 'je Hafertag ein Termin');
check(ics.includes('DTSTART;VALUE=DATE:20261121') && ics.includes('DTEND;VALUE=DATE:20261122'), 'ganztägig: von Tag zu Folgetag');
check(ics.indexOf('20261121') < ics.indexOf('DTSTART;VALUE=DATE:20261122'), 'nach Datum sortiert');
check(ics.includes('TRIGGER:-PT6H'), 'Erinnerung am Abend davor (18 Uhr)');
check(ics.includes('UID:hafertag-20261121@mahlzeit'), 'feste Kennung je Tag – ein zweiter Import verdoppelt nicht');
const zeilen = ics.split('\r\n');
check(ics.endsWith('\r\n') && !ics.replace(/\r\n/g, '').includes('\n'), 'Zeilenenden CRLF');
check(zeilen.every((z) => new TextEncoder().encode(z).length <= 75), 'keine Zeile länger als 75 Oktette');
check(!ics.includes('�') && zeilen.map((z, i) => (i && z.startsWith(' ') ? z.slice(1) : `\n${z}`)).join('').includes('Hafertag 🌾'), 'das Emoji bleibt beim Falten ganz');

// --- Werte
check(R.vielleichtMmol(6.5) === 117 && R.vielleichtMmol(120) === null, '6,5 sieht nach mmol/l aus (117 mg/dl), 120 nicht');
check(R.leseZahl('98,4') === 98.4 && R.leseZahl('98.4') === 98.4 && Number.isNaN(R.leseZahl('abc')) && Number.isNaN(R.leseZahl('')), 'Zahlen mit Komma oder Punkt, sonst nichts');
const ws = R.leererStand();
ws.werte = [{ art: 'gewicht', tag: '2026-11-17', wert: 98 }, { art: 'gewicht', tag: '2026-10-01', wert: 101.4 }, { art: 'zucker', tag: '2026-11-17', wert: 120 }];
const v = R.gewichtVerlauf(ws);
check(v.erster.tag === '2026-10-01' && v.diff === -3.4, `Gewicht: ältester zuerst, −3,4 kg (${v.diff})`);

// --- Woche und Schnitt
const wo = R.leererStand();
wo.tage['2026-11-16'] = [{ n: 'x', kcal: 2000 }];
wo.tage['2026-11-15'] = [{ n: 'x', kcal: 2200 }];
check(R.schnitt(wo, '2026-11-17') === null, 'Schnitt erst ab drei Tagen');
wo.tage['2026-11-14'] = [{ n: 'x', kcal: 2300 }];
wo.tage['2026-11-17'] = [{ n: 'x', kcal: 500 }];
check(R.schnitt(wo, '2026-11-17').kcal === 2167, 'Schnitt ohne den laufenden Tag');
const w7 = R.woche(wo, '2026-11-17');
check(w7.length === 7 && w7[6].tag === '2026-11-17' && w7[6].kcal === 500, 'die Woche endet heute');

// --- Stand und Sicherung
check(JSON.stringify(R.ordnen('Unsinn')) === JSON.stringify(R.leererStand()), 'Unsinn im Speicher: leerer Stand statt Absturz');
const roh = { tage: { '2026-11-17': [{ n: 'Apfel', kcal: 80, m: 1 }, { kaputt: true }], falsch: [] }, hafer: { proMonat: 99, tage: ['2026-11-21', '2026-11-21', 'x'] }, ziel: -5 };
const g = R.ordnen(roh);
check(g.tage['2026-11-17'].length === 1 && !g.tage.falsch, 'kaputte Einträge fliegen raus, gute bleiben');
check(g.hafer.proMonat === 3 && g.hafer.tage.join() === '2026-11-21' && g.ziel === null, 'unmögliche Werte werden zum Standard');
const text = R.sicherungText(g, '2026-11-17');
check(JSON.stringify(R.sicherungLesen(text)) === JSON.stringify(g), 'Sicherung hin und zurück ergibt denselben Stand');
let grund = '';
try { R.sicherungLesen(JSON.stringify({ app: 'schilddruese', stand: {} })); } catch (e) { grund = e.message; }
check(grund.includes('keine Sicherung'), `fremde Sicherung wird abgelehnt („${grund}")`);
grund = '';
try { R.sicherungLesen('{kaputt'); } catch (e) { grund = e.message; }
check(grund.includes('keine Sicherung'), 'kaputte Datei wird abgelehnt');

ende();
