/*
 * Der Katalog: Was Sport außerhalb des Plans mit welchem Muskel macht.
 *
 *     „Beschäftige dich echt tiefgehend mit allen sportlichen
 *      Freizeitaktivitäten und schau was genau was macht und so."
 *
 * Geprüft wird nicht, ob eine einzelne Zahl stimmt – das kann ein Test nicht
 * wissen. Geprüft wird, ob der Katalog in sich stimmig ist und ob die
 * Aussagen, wegen derer er überhaupt gebaut wurde, auch herauskommen:
 *
 *   – Radfahren und Schwimmen fordern die Muskulatur, hinterlassen aber
 *     nichts. Wer das umdreht, hat den Unterschied zwischen konzentrischer
 *     und exzentrischer Arbeit aus dem Modell geworfen.
 *   – Skifahren, Bergwandern und Bergablaufen wirken zwei Tage nach.
 *   – Spazieren und Tischtennis ändern am Plan nichts. Ein Modell, das nach
 *     jedem Spaziergang den Beintag streicht, ist unbrauchbar.
 *   – Länger heißt mehr, aber nicht beliebig viel mehr.
 *
 * Kein Browser nötig: js/aktivitaeten.js rechnet ohne DOM.
 */
import { AKTIVITAETEN, AKT_BY_ID, SCHWELLE, SCHWELLE_LANG, dauerFaktor, familien,
         gruppenAm, nachwirkung, wirkungVon } from '../js/aktivitaeten.js';
import { MUSCLE_LABEL } from '../js/body.js';

let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

/* --- 1. Der Katalog ist sauber ------------------------------------------ */
console.log(`     ${AKTIVITAETEN.length} Aktivitäten in ${familien().length} Familien`);
check(AKTIVITAETEN.length >= 40, `genug Auswahl (${AKTIVITAETEN.length})`);

const ids = AKTIVITAETEN.map((a) => a.id);
check(new Set(ids).size === ids.length, 'jede id kommt genau einmal vor');
const namen = AKTIVITAETEN.map((a) => a.name);
check(new Set(namen).size === namen.length, 'und jeder Name auch');

const gruppen = Object.keys(MUSCLE_LABEL);
const fehler = [];
AKTIVITAETEN.forEach((a) => {
  if (!a.name || !a.familie) fehler.push(`${a.id}: Name oder Familie fehlt`);
  if (!(a.typisch > 0)) fehler.push(`${a.id}: keine übliche Dauer`);
  if (!(a.exzentrik >= 0 && a.exzentrik <= 1)) fehler.push(`${a.id}: exzentrik ${a.exzentrik}`);
  // Ein Satz, der erklärt, warum die Zahlen so stehen. Er steht in der App –
  // ohne ihn ist der Eintrag eine Behauptung ohne Begründung.
  if (!a.warum || a.warum.length < 40) fehler.push(`${a.id}: kein oder zu kurzes warum`);
  Object.entries(a.last || {}).forEach(([m, v]) => {
    if (!gruppen.includes(m)) fehler.push(`${a.id}: unbekannte Gruppe ${m}`);
    if (!(v > 0 && v <= 1)) fehler.push(`${a.id}: ${m} = ${v} liegt außerhalb 0..1`);
  });
  if (!Object.keys(a.last || {}).length) fehler.push(`${a.id}: trifft gar nichts`);
});
check(!fehler.length, `jeder Eintrag ist vollständig${fehler.length ? ': ' + fehler.join(' | ') : ''}`);

/* --- 2. Die Dauer skaliert, aber nicht ins Unendliche ------------------- */
console.log('     Dauerfaktor:', [30, 60, 90, 120, 240, 360]
  .map((m) => `${m}→${dauerFaktor(m).toFixed(2)}`).join(' '));
check(Math.abs(dauerFaktor(60) - 1) < 1e-9, 'eine Stunde ist der Maßstab (Faktor 1)');
check(dauerFaktor(30) < 1 && dauerFaktor(90) > 1, 'kürzer ist weniger, länger ist mehr');
check(dauerFaktor(120) < 2 * dauerFaktor(60),
  'aber zwei Stunden sind nicht doppelt so schlimm wie eine');
check(dauerFaktor(360) === dauerFaktor(240),
  'und irgendwann ist Schluss – ein Sechs-Stunden-Skitag ist nicht dreimal ein Zwei-Stunden-Tag');
check(dauerFaktor(0) === 1 && dauerFaktor(undefined) === 1,
  'ohne brauchbare Angabe wird nicht gerechnet, sondern die Stunde angenommen');

/* --- 3. Exzentrik entscheidet über das Danach --------------------------- */
//
// Der Kern des Modells. Radfahren ist anstrengend und schädigt kaum – getreten
// wird konzentrisch. Bergablaufen schädigt maximal. Kommt hier dasselbe heraus,
// ist das Modell keins.
const rad = wirkungVon('rennrad', 120);
const trail = wirkungVon('trail', 75);
console.log(`     Rennrad 2h: Oberschenkel wirkung ${rad.wirkung.quads.toFixed(2)} `
  + `schaden ${rad.schaden.quads.toFixed(2)}`);
console.log(`     Bergab 75min: Oberschenkel wirkung ${trail.wirkung.quads.toFixed(2)} `
  + `schaden ${trail.schaden.quads.toFixed(2)}`);
check(rad.wirkung.quads >= SCHWELLE,
  'Radfahren fordert den Oberschenkel – vorher schont die App ihn');
check(rad.schaden.quads < SCHWELLE,
  'hinterlässt aber nichts: danach steht dem Beintag nichts im Weg');
check(trail.schaden.quads >= SCHWELLE_LANG,
  'Bergablaufen dagegen wirkt zwei Tage nach');
check(nachwirkung('rennrad', 120) === 0 && nachwirkung('schwimmen', 45) === 0,
  'Rennrad und Schwimmen: null Tage Nachwirkung');

/* --- 4. Die zwei Tage sind den wirklich schädigenden vorbehalten -------- */
const lang = AKTIVITAETEN.filter((a) => nachwirkung(a.id, a.typisch) === 2).map((a) => a.name);
const gar = AKTIVITAETEN.filter((a) => nachwirkung(a.id, a.typisch) === 0).map((a) => a.name);
console.log('     zwei Tage:', lang.join(', '));
console.log(`     gar nicht (${gar.length}):`, gar.join(', '));
check(lang.length >= 3 && lang.length <= 10,
  `nur wenige Aktivitäten kosten zwei Tage (${lang.length})`);
['Skifahren (alpin)', 'Bergwandern', 'Trailrunning / bergab'].forEach((n) => {
  check(lang.includes(n), `${n} gehört dazu`);
});
check(gar.length >= AKTIVITAETEN.length / 3,
  `und ein guter Teil ändert gar nichts (${gar.length} von ${AKTIVITAETEN.length})`);
['Spazieren', 'Tischtennis', 'Stretching / Mobility', 'Alltagsrad'].forEach((n) => {
  check(gar.includes(n), `${n} lässt den Plan in Ruhe`);
});

/* --- 5. Padel, der Fall aus dem Zitat ----------------------------------- */
//
//     „Ich hab gestern 1,5h padel gemacht."
//
const padelHeute = gruppenAm('padel', 90, 1);
console.log('     Padel 1,5h → am Tag danach:',
  padelHeute.map((m) => MUSCLE_LABEL[m]).join(', ') || '–');
check(padelHeute.includes('quads') && padelHeute.includes('calves'),
  'nach 1,5 h Padel fallen am nächsten Tag Oberschenkel und Waden aus');
check(!padelHeute.includes('chest') && !padelHeute.includes('biceps'),
  'Brust und Bizeps aber nicht – Padel ist kein Oberkörpertraining');
check(!gruppenAm('padel', 90, 2).length,
  'und zwei Tage später ist es durch');
check(gruppenAm('padel', 30, 1).length < padelHeute.length,
  'eine halbe Stunde Padel wirkt weniger nach als anderthalb');

/* --- 6. Vorher wird nach Bedarf geschont, nachher nach Schaden ---------- */
//
// Ein Sport kann eine Gruppe fordern, ohne sie zu schädigen (Rennrad) – dann
// gehört sie vorher geschont und nachher nicht. Umgekehrt gibt es nicht: Was
// nicht gefordert wurde, kann auch nicht geschädigt sein.
const verstoesse = [];
AKTIVITAETEN.forEach((a) => {
  const vor = new Set(gruppenAm(a.id, a.typisch, -1));
  gruppenAm(a.id, a.typisch, 1).forEach((m) => {
    if (!vor.has(m)) verstoesse.push(`${a.name}/${MUSCLE_LABEL[m]}`);
  });
  gruppenAm(a.id, a.typisch, 2).forEach((m) => {
    if (!gruppenAm(a.id, a.typisch, 1).includes(m)) verstoesse.push(`${a.name}/${MUSCLE_LABEL[m]} (+2)`);
  });
});
check(!verstoesse.length,
  `was nachher geschont wird, war vorher gefordert${verstoesse.length ? ': ' + verstoesse.join(', ') : ''}`);

/* --- 7. Unbekanntes kippt nichts um ------------------------------------- */
check(!gruppenAm('gibtsnicht', 60, 1).length, 'eine unbekannte id schont nichts');
check(nachwirkung('gibtsnicht', 60) === 0, 'und wirkt auch nicht nach');
check(AKT_BY_ID.get('padel') === AKTIVITAETEN.find((a) => a.id === 'padel'),
  'die Nachschlagetabelle zeigt auf dieselben Einträge');
check(!gruppenAm('padel', 90, 5).length, 'fünf Tage danach ist nichts mehr');

console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
