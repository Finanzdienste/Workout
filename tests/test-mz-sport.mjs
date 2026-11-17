/*
 * Mahlzeit v4: der Sportmodus für Uwe.
 *
 * Tobi: „Lass noch nen Sportmodus einbauen. Uwe brauch auch bewerglichkeit
 * und so … Er soll auch eintragen können was er für Hanteln und Gewichte hat"
 * – Schwungstäbe, Schwingstab, Wackelkissen, Heimtrainer; „er meint er ist
 * sehr steif".
 *
 * Erst ohne Browser (sport.js): welche Übungen bei welchen Geräten und
 * Beschwerden, welche Hantel, was heute dran ist. Dann im Browser: einrichten,
 * eine Einheit durchgehen (mit Uhr), Gewichte anpassen, Heimtrainer.
 */
import * as SP from '../mahlzeit/js/sport.js';
import * as R from '../mahlzeit/js/rechnen.js';
import { figur, FIGUREN } from '../mahlzeit/js/figuren.js';
import { oeffne, pruefer, plus } from './mz-hilfe.mjs';

const { check, ende } = pruefer();
const ids = (liste) => liste.map((u) => u.id);

// --- Übungen und Geräte
check(SP.UEBUNGEN.every((u) => u.t && u.n && (u.d.sek || (u.d.saetze && u.d.wdh))), 'jede Übung hat Name, Anleitung und Dosis');
check([...SP.BEWEGLICH, ...SP.KRAFT].every((id) => SP.NACH_ID.has(id)), 'jede Übung der Einheiten gibt es');
check(SP.UEBUNGEN.every((u) => !u.statt || SP.NACH_ID.has(u.statt)) && SP.UEBUNGEN.every((u) => !u.mitHantel || SP.NACH_ID.has(u.mitHantel)), 'jeder Ersatz gibt es');
check(SP.UEBUNGEN.every((u) => !u.g || SP.GERAETE.some((g) => g.id === u.g)), 'jedes Gerät ist bekannt');
const nackt = SP.einheit('beweglich', { geraete: [], beschwerden: [] });
check(ids(nackt).includes('katzeKuhStehend') && !ids(nackt).includes('katzeKuh') && !ids(nackt).includes('schwingstabLocker'), 'ohne Matte: Katze–Kuh im Stehen; ohne Schwingstab keiner');
check(SP.minuten(nackt) >= 8 && SP.minuten(nackt) <= 12, `Beweglichkeit dauert rund zehn Minuten (${SP.minuten(nackt)})`);
const alles = { geraete: ['hanteln', 'rad', 'schwungstaebe', 'schwingstab', 'wackelkissen', 'matte'], beschwerden: [] };
check(ids(SP.einheit('beweglich', alles)).includes('katzeKuh') && ids(SP.einheit('beweglich', alles)).includes('schwingstabLocker'), 'mit Matte und Schwingstab: beide dabei');
const kraft = ids(SP.einheit('kraft', alles));
check(kraft[0] === 'radLocker' && kraft.includes('radIntervall') && kraft.includes('schwungstaebe') && kraft.includes('wackelkissenStand') && kraft.includes('schwingstabRumpf'), 'Kraft mit allem: Rad zum Aufwärmen und zum Schluss, Schwungstäbe, Wackelkissen, Schwingstab');
check(kraft.includes('gobletStuhl') && !kraft.includes('kniebeugeStuhl'), 'mit Hanteln: Goblet-Kniebeuge statt Kniebeuge ohne Gewicht');
const ohne = ids(SP.einheit('kraft', { geraete: [], beschwerden: [] }));
check(ohne[0] === 'marschieren' && ohne.includes('kniebeugeStuhl') && ohne.includes('schulterblatt') && ohne.includes('einbeinstand') && ohne.includes('wadenheben'), 'ohne Geräte: Gehen, Kniebeuge, Schulterblätter, Einbeinstand, Wadenheben');
check(!ohne.some((id) => SP.NACH_ID.get(id).g), 'ohne Geräte: keine Übung braucht eins');
const ruecken = ids(SP.einheit('kraft', { ...alles, beschwerden: ['ruecken'] }));
check(!ruecken.includes('rudernKH') && ruecken.includes('schulterblatt'), 'Rücken: kein vorgebeugtes Rudern, dafür Schulterblätter');
const schulter = ids(SP.einheit('kraft', { ...alles, beschwerden: ['schulter'] }));
check(!['schulterdrueckenKH', 'wandLiegestuetz', 'schwungstaebe', 'schwingstabRumpf'].some((id) => schulter.includes(id)), 'Schulter: kein Drücken, keine Liegestütze, keine Schwungstäbe');
const knie = ids(SP.einheit('kraft', { ...alles, beschwerden: ['knie'] }));
check(!knie.includes('gobletStuhl') && !knie.includes('kniebeugeStuhl'), 'Knie: keine Kniebeuge');
check(new Set(kraft).size === kraft.length, 'keine Übung doppelt');

// --- Hanteln
const H = [3, 5, 8];
const g = (id, gemerkt) => SP.gewichtFuer(SP.NACH_ID.get(id), H, gemerkt);
check(g('gobletStuhl') === 8 && g('rudernKH') === 5 && g('schulterdrueckenKH') === 3 && g('bizepsKH') === 5, 'Startgewicht: die schwerste Hantel bis zum Ziel (8 / 5 / 3 / 5 kg)');
check(SP.gewichtFuer(SP.NACH_ID.get('schulterdrueckenKH'), [10, 12]) === 10, 'alle zu schwer: die leichteste');
check(g('rudernKH', { rudernKH: 8 }) === 8, 'was er zuletzt genommen hat, gilt');
check(SP.gewichtFuer(SP.NACH_ID.get('kniebeugeStuhl'), H) === null, 'ohne Hantel-Übung: kein Gewicht');
check(SP.naechstesGewicht(5, H, 'leicht') === 8 && SP.naechstesGewicht(5, H, 'schwer') === 3 && SP.naechstesGewicht(8, H, 'leicht') === 8 && SP.naechstesGewicht(5, H, 'passt') === 5, 'zu leicht → nächste, zu schwer → leichtere, oben bleibt oben');

// --- Was ist dran
const T = '2026-11-18'; // Mittwoch
const sp = (log, mehr = {}) => SP.sportOrdnen({ eingerichtet: true, kraftProWoche: 2, log, ...mehr });
let d = SP.heuteDran(sp([]), T);
check(d.beweglich && d.kraft, 'nichts gemacht: Beweglichkeit und Kraft dran');
d = SP.heuteDran(sp([{ tag: plus(T, -1), art: 'kraft' }]), T);
check(!d.kraft && d.beweglich, 'Kraft gestern: heute Pause');
d = SP.heuteDran(sp([{ tag: '2026-11-16', art: 'kraft' }]), T);
check(d.kraft && d.kraftWoche === 1, 'Kraft Montag: Mittwoch wieder dran (1 von 2)');
d = SP.heuteDran(sp([{ tag: '2026-11-16', art: 'kraft' }, { tag: '2026-11-14', art: 'kraft' }]), T);
check(d.kraftWoche === 1, 'die Woche beginnt am Montag');
d = SP.heuteDran(sp([{ tag: '2026-11-16', art: 'kraft' }, { tag: '2026-11-17', art: 'kraft' }]), '2026-11-20');
check(!d.kraft, 'zweimal diese Woche bei Ziel 2: geschafft');
d = SP.heuteDran(sp([{ tag: T, art: 'beweglich' }, { tag: plus(T, -1), art: 'beweglich' }, { tag: plus(T, -2), art: 'beweglich' }, { tag: plus(T, -4), art: 'beweglich' }]), T);
check(!d.beweglich && d.serie === 3, 'Beweglichkeit heute gemacht, 3 Tage am Stück');
check(SP.serie([{ tag: plus(T, -1), art: 'beweglich' }], T) === 1, 'heute noch nicht: die Serie bis gestern zählt');
check(SP.radKcal(30, 'mittel', 90) === 270 && SP.radKcal(30, 'mittel', null) === null, 'Rad: 30 Minuten mittel bei 90 kg ≈ 270 kcal; ohne Gewicht keine Zahl');
check(SP.dosis(SP.NACH_ID.get('nackenSeite')) === '30 s je Seite' && SP.dosis(SP.NACH_ID.get('schwungstaebe')) === '3 × 30 s, 30 s Pause' && SP.dosis(SP.NACH_ID.get('radLocker')) === '5 Minuten', 'Dosis in Worten');
check(SP.dosis(SP.NACH_ID.get('rudernKH')) === '2 × 10–12 je Seite' && SP.dosis(SP.NACH_ID.get('vogelhund')) === '2 × 6 je Seite', 'je Seite nicht doppelt');
const leer = SP.sportOrdnen('Unsinn');
check(!leer.eingerichtet && leer.kraftProWoche === 2 && leer.log.length === 0, 'Unsinn im Speicher: nicht eingerichtet, 2× die Woche');
check(R.ordnen({ sport: { eingerichtet: true, geraete: ['rad', 'quatsch'], hanteln: [5, 5, -1, 8] } }).sport.geraete.join() === 'rad'
  && R.ordnen({ sport: { hanteln: [8, 5, 5, -1] } }).sport.hanteln.join() === '5,8', 'Speicher: unbekannte Geräte und doppelte Hanteln fliegen raus (auch in der Sicherung)');

// --- Zeichnungen (v5): Tobi, „Mach Zeichnungen für die Sportübungen"
const ohneBild = SP.UEBUNGEN.filter((u) => !figur(u.id));
check(!ohneBild.length, `jede Übung hat eine Zeichnung${ohneBild.length ? ` – es fehlen: ${ohneBild.map((u) => u.id).join(', ')}` : ''}`);
check(Object.keys(FIGUREN).every((id) => SP.NACH_ID.has(id)), 'keine Zeichnung ohne Übung');
const zahlen = SP.UEBUNGEN.flatMap((u) => [...figur(u.id).matchAll(/(?:x[12]|y[12]|cx|cy)="(-?[\d.]+)"/g)].map((m) => Number(m[1])));
check(zahlen.length > 500 && zahlen.every((z) => z >= 0 && z <= 100), 'alle Punkte im Bild (0 bis 100)');
check(figur('kniebeugeStuhl').includes('<animate') && !figur('kniebeugeStuhl', { ruhig: true }).includes('<animate'), 'bewegt zwischen Start und Ende; mit „Bewegung reduzieren" still');
check(figur('rudernKH').includes('class="eisen"') && figur('schwungstaebe').includes('class="stab"') && figur('wackelkissenStand').includes('kissen') && figur('radLocker').includes('class="rad"'), 'die Geräte sind mitgezeichnet: Hantel, Schwungstäbe, Wackelkissen, Rad');

// --- Im Browser
const TAG = '2026-11-18';
let o = await oeffne({ tag: TAG, zeit: '18:00' });
let p = o.page;
check(await p.locator('#sport-neu').isVisible(), 'Startseite: „Neu: Sport"');
await p.click('#sport-neu [data-tun="seite"]');
check(await p.locator('#sport-einrichten').isVisible(), 'Sport: erst einrichten');
for (const ge of ['hanteln', 'rad', 'schwungstaebe', 'schwingstab', 'wackelkissen']) await p.click(`[data-tun="sport-geraet"][data-wert="${ge}"]`);
check(await p.locator('#sport-hanteln').isVisible(), 'Kurzhanteln gewählt: welche Gewichte?');
await p.click('#sport-fertig');
check((await p.locator('#sport-fehler').innerText()).includes('Welche Hanteln'), 'ohne Gewichte: Rückfrage statt Fertig');
for (const kg of [3, 5, 8]) await p.click(`[data-tun="sport-kg"][data-wert="${kg}"]`);
await p.click('[data-tun="sport-oft"][data-wert="3"]');
await p.click('#sport-fertig');
const sp1 = (await o.gespeichert()).sport;
check(sp1.eingerichtet && sp1.hanteln.join() === '3,5,8' && sp1.kraftProWoche === 3 && sp1.geraete.length === 5, 'gespeichert: 5 Geräte, Hanteln 3, 5, 8 kg, 3× die Woche');
check((await p.locator('#sport-heute').innerText()).includes('diese Woche 0 von 3'), 'Übersicht: Kraft 0 von 3');

// Beweglichkeit mit Uhr
await p.click('#los-beweglich');
check((await p.locator('#uebung-name').innerText()) === 'Schultern kreisen' && (await p.locator('#uhr').innerText()) === '0:45', 'erste Übung: Schultern kreisen, Uhr auf 0:45');
check(await p.locator('#ebene svg.figur').isVisible(), 'mit Zeichnung über dem Namen');
await p.click('#uhr-knopf');
await p.waitForTimeout(1600);
const lauf = await p.locator('#uhr').innerText();
check(['0:44', '0:43'].includes(lauf) && (await p.locator('#uhr-knopf').innerText()) === 'Pause', `die Uhr läuft (${lauf}), der Knopf heißt jetzt Pause`);
await p.click('#uhr-knopf');
const steht = await p.locator('#uhr').innerText();
await p.waitForTimeout(1200);
check((await p.locator('#uhr').innerText()) === steht, 'Pause: die Uhr steht');
await p.click('#training-weiter');
check((await p.locator('#uhr-text').innerText()) === 'Erste Seite', 'je Seite: „Erste Seite", dann die andere');
const anzahl = Number((await p.locator('#training-stand').innerText()).match(/von (\d+)/)[1]);
for (let i = 1; i < anzahl; i++) await p.click(i === 3 ? '#training-auslassen' : '#training-weiter');
check((await p.locator('#training-ende').innerText()).includes(`${anzahl - 1} von ${anzahl} Übungen`), 'Ende: was gemacht wurde (eine ausgelassen zählt nicht)');
await p.click('#training-ende [data-tun="ebene-zu"]');
check((await p.locator('#sport-heute').innerText()).includes('✓ gemacht'), 'Beweglichkeit: ✓ gemacht');

// Kraft mit Gewichten
await p.click('#los-kraft');
check((await p.locator('#uebung-name').innerText()) === 'Heimtrainer, locker', 'Kraft beginnt mit dem Rad zum Aufwärmen');
await p.click('#training-weiter');
check((await p.locator('#uebung-dosis').innerText()).includes('8 kg (eine Hantel)'), 'Goblet-Kniebeuge mit 8 kg, eine Hantel');
await p.click('#training-weiter');
await p.click('#training-weiter');
check((await p.locator('#uebung-name').innerText()).startsWith('Rudern') && (await p.locator('#uebung-dosis').innerText()).includes('5 kg je Hand'), 'Rudern mit 5 kg je Hand');
await p.click('[data-tun="urteil"][data-urteil="leicht"]');
let n = Number((await p.locator('#training-stand').innerText()).match(/von (\d+)/)[1]);
for (let i = 3; i < n; i++) await p.click('#training-weiter');
check(await p.locator('#training-ende').isVisible() && (await p.locator('#training-ende').innerText()).includes('Gewichte fürs nächste Mal'), 'Ende: Gewichte angepasst');
const sp2 = (await o.gespeichert()).sport;
check(sp2.gewichte.rudernKH === 8 && sp2.log.filter((l) => l.art === 'kraft').length === 1, 'Rudern zu leicht → nächstes Mal 8 kg; Kraft festgehalten');
await p.click('#training-ende [data-tun="ebene-zu"]');
check((await p.locator('#sport-hinweis').innerText()).includes('übermorgen'), 'nach der Kraft: „wieder übermorgen"');

// Heimtrainer
await p.click('#reiter-werte');
await p.fill('#w-gewicht', '96');
await p.click('form[data-form="gewicht"] button');
await p.click('#reiter-sport');
await p.fill('#rad-min', '30');
await p.click('form[data-form="rad"] button');
check((await p.locator('#rad-heute').innerText()).includes('30 Minuten') && (await p.locator('#rad-heute').innerText()).includes('288 kcal'), 'Rad: 30 Minuten, bei 96 kg etwa 288 kcal');
check((await p.locator('#sport-woche').innerText()).includes('🤸💪🚲'), 'Woche: heute Beweglichkeit, Kraft und Rad');

// 340 px
await p.setViewportSize({ width: 340, height: 700 });
const breit = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check(breit <= 0, `340 px, Sport: nichts läuft über den Rand (${breit})`);
const leiste = await p.evaluate(() => [...document.querySelectorAll('.leiste button')].every((b) => b.scrollWidth <= b.clientWidth + 1));
check(leiste, '340 px: fünf Reiter passen in die Leiste');
await p.setViewportSize({ width: 390, height: 844 });
const stand = await o.gespeichert();
check(o.fehler.length === 0, `keine Fehler${o.fehler.length ? `: ${o.fehler.slice(0, 2).join(' | ')}` : ''}`);
await o.browser.close();

// Nächster Tag: Startseite erinnert an Beweglichkeit, Kraft hat Pause; Rudern startet mit 8 kg
o = await oeffne({ tag: plus(TAG, 1), stand });
p = o.page;
const karte = await p.locator('#sport-heute-karte').innerText();
check(karte.includes('Beweglichkeit') && karte.includes('heute noch nicht') && !karte.includes('Kraft und Ausdauer ist auch dran'), 'am nächsten Tag: Beweglichkeit ja, Kraft Pause');
await p.click('#reiter-sport');
await p.click('#los-kraft');
for (let i = 0; i < 3; i++) await p.click('#training-weiter');
check((await p.locator('#uebung-dosis').innerText()).includes('8 kg je Hand'), 'Rudern jetzt mit 8 kg');
await o.browser.close();

// Hafertag
o = await oeffne({ tag: TAG, stand: { ...stand, hafer: { art: 'verteilt', proMonat: 3, tage: [TAG] } } });
await o.page.click('#reiter-sport');
check((await o.page.locator('#sport-hinweis').innerText()).includes('Hafertag'), 'am Hafertag: lieber nur Beweglichkeit oder locker Rad');
await o.browser.close();

ende();
