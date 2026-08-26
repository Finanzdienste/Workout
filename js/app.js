import { EXERCISES, FOCUS, PLAN, PLANS, TARGET, REST } from './data.js';
import * as store from './store.js';
import { todayISO, addDays, daysBetween, fmtDate, plural, fmtMonth, monthStart, addMonths, monthGrid, WEEK_HEAD } from './dates.js';
import { mountFigure, clearFigures } from './figure.js';
import { mountBody, MUSCLE_LABEL } from './body.js';
import { INJURIES, KIND_LABEL, CARE, CARE_LABEL, injuryById, applyInjuries, blocked, weeklyImpact, combosFor, careFor, needsClearance } from './injuries.js';
import { sparkPanel } from './chart.js';
import { buildICS } from './ics.js';
import { CONFIG, hatServer } from './config.js';
import { geraeteId, melden, loeschen, adminListe } from './telemetry.js';
import { initAudio, playSound, scheduleSound, cancelSound } from './audio.js';

/* ------------------------------------------------------------------ *
 * Hilfsfunktionen
 * ------------------------------------------------------------------ */

/* Trainingsfokus: js/data.js liefert alle Varianten mit (PLANS) und wählt beim
 * Laden aus, welche gilt – PLAN, TARGET und REST kommen von dort und meinen
 * überall dasselbe. Der Wechsel lädt die Seite neu, siehe 'set-focus'. */

const EX_BY_ID = new Map(EXERCISES.map((e) => [e.id, e]));
const view = document.getElementById('view');
const tabbar = document.getElementById('tabbar');
const modeSwitch = document.getElementById('modeSwitch');
const toastEl = document.getElementById('toast');

const MODE_LABEL = { db: 'Hanteln', bw: 'Bodyweight' };

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/**
 * Tatsächlicher Termin einer Einheit.
 *
 * Bereits begonnene Einheiten bleiben auf dem Tag, an dem trainiert wurde –
 * die Historie darf sich nicht rückwirkend verschieben. Alles Offene liegt
 * auf seinem Plandatum plus der aktuellen Verschiebung.
 */
function effDate(w) {
  // Eigene Einheiten hängen an keinem Plantermin: Sie sind an dem Tag, an dem
  // man sie macht, und verschieben sich mit dem Plan nicht mit.
  if (istCustom(w.n)) return store.startedOn(w.n) || todayISO();
  return store.startedOn(w.n) || addDays(w.date, store.getState().shift);
}

/** Eigene Einheiten haben eine Kennung statt einer Nummer. */
const istCustom = (n) => typeof n === 'string' && n.startsWith('c');

/**
 * Verpasste Tage nachtragen: Ist der Termin der frühesten noch nicht
 * begonnenen Einheit verstrichen, wandert der gesamte Restplan um genau so
 * viele Tage nach hinten, bis diese Einheit auf heute fällt. Die Abstände
 * zwischen den Einheiten bleiben dabei erhalten.
 */
function catchUpPlan() {
  const s = store.getState();
  const open = PLAN.find((w) => !store.isStarted(w.n));
  if (!open) return 0;
  const missed = daysBetween(effDate(open), todayISO());
  if (missed <= 0) return 0;
  store.setShift(s.shift + missed);
  return missed;
}

/** Die erste Einheit, die noch nicht angefangen wurde – die, die dran wäre. */
function firstOpen() {
  return PLAN.find((w) => !store.isStarted(w.n)) || PLAN[PLAN.length - 1];
}

/**
 * Verschiebung, die die nächste offene Einheit auf heute legt – in beide
 * Richtungen.
 *
 * Die Termine stammen aus der Excel und liegen unter Umständen in der Zukunft.
 * Nachrücken allein half da nicht: Es schiebt nur, was verstrichen ist. Wer
 * heute anfangen will, braucht den Weg nach vorn genauso.
 */
function shiftToToday() {
  return store.getState().shift + daysBetween(effDate(firstOpen()), todayISO());
}

/**
 * Knopf „Heute anfangen“ – nur, wenn es etwas vorzuziehen gibt.
 *
 * Sichtbar an genau der Einheit, die als Nächstes offen ist: An Workout 40
 * angetippt würde er den halben Plan um Monate verschieben, und das will
 * niemand aus Versehen.
 */
function startTodayRow(n) {
  const offen = firstOpen();
  if (store.getState().session || offen.n !== n) return '';
  const tage = daysBetween(todayISO(), effDate(offen));
  if (tage <= 0) return '';
  return `<div class="btn-row">
      <button type="button" class="btn btn-ghost btn-block" data-act="start-today">
        Heute anfangen – Plan ${esc(plural(tage, 'Tag', 'Tage'))} vorziehen
      </button>
    </div>`;
}

/** Die Einheit, die als Nächstes ansteht: die erste noch nicht abgeschlossene. */
function defaultWorkoutNo() {
  const open = PLAN.find((w) => !completedMode(w.n));
  return open ? open.n : PLAN[PLAN.length - 1].n;
}

/** Angehakte Verletzungen. */
function activeInjuries() { return store.getState().injuries || []; }

/** Muskelgruppen, für die eine Übung da ist – dieselbe Schwelle wie im Plan. */
function directOf(exId) {
  const ex = EX_BY_ID.get(exId);
  if (!ex) return [];
  return Object.entries(ex.db.shares).filter(([, v]) => v >= REST.direct).map(([m]) => m);
}

const directSets = (items) => new Set(items.flatMap((it) => directOf(it.id)));

/**
 * Der ganze Plan unter den angehakten Beschwerden – einmal gerechnet, gemerkt.
 *
 * Ein Tausch darf die Erholung nicht aushebeln: Der Plan ist so gebaut, dass
 * keine Muskelgruppe innerhalb von REST.days Tagen zweimal direkt drankommt,
 * und ein Ersatz, der genau das täte, ist keiner – dann fällt die Übung lieber
 * ersatzlos weg. Geprüft wird gegen beide Nachbarn: den Vortag in der bereits
 * angepassten Fassung und den Folgetag so, wie er im Plan steht. Dessen eigene
 * Tausche werden dann ihrerseits gegen diesen Tag geprüft.
 */
const planCache = { key: null, list: null, notes: null };

// Jede Zustandsänderung verwirft den Zwischenstand. Die Anpassung hängt an den
// tatsächlichen Terminen, und die ändern sich auch, wenn eine Einheit begonnen
// wird – das ließe sich am Schlüssel kaum zuverlässig ablesen. Ein Neuaufbau
// kostet unter einer Millisekunde, die Ersparnis liegt in den vielen Aufrufen
// innerhalb *eines* Renderdurchlaufs.
store.subscribe(() => { planCache.key = null; });

function adjustedPlan() {
  const act = activeInjuries();
  // Der Schlüssel nennt nur, was die Anpassung selbst bestimmt. Die Termine
  // hängen zusätzlich daran, wann tatsächlich trainiert wurde – deshalb wird
  // der Zwischenstand bei jeder Zustandsänderung verworfen (siehe unten),
  // statt hier eine Signatur über den ganzen Verlauf zu bilden.
  const key = `${act.join(',')}|${store.getState().shift}`;
  if (planCache.key === key) return planCache.list;

  const list = [];
  const notes = [];
  PLAN.forEach((w, i) => {
    if (!act.length) {
      list.push(w.ex);
      notes.push({ dropped: [], swapped: [] });
      return;
    }
    const eng = (a, b) => a && b && Math.abs(daysBetween(effDate(a), effDate(b))) < REST.days;
    const meide = new Set();
    if (eng(PLAN[i - 1], w)) directSets(list[i - 1]).forEach((m) => meide.add(m));
    if (eng(w, PLAN[i + 1])) directSets(PLAN[i + 1].ex).forEach((m) => meide.add(m));
    const taboo = new Set(EXERCISES
      .filter((e) => directOf(e.id).some((m) => meide.has(m)))
      .map((e) => e.id));
    const r = applyInjuries(w.ex, act, taboo);
    list.push(r.items);
    notes.push({ dropped: r.dropped, swapped: r.swapped });
  });
  planCache.key = key;
  planCache.list = list;
  planCache.notes = notes;
  return list;
}

/** Was an einem Plantag getauscht wurde und was wegfiel. */
function injuryNotes(n) {
  adjustedPlan();
  return planCache.notes[n - 1] || { dropped: [], swapped: [] };
}

/**
 * Übungsliste eines Plantags, angepasst an die angehakten Verletzungen.
 *
 * Alles in der App geht durch diese Stelle – Übersicht, Fokus, Statistik,
 * Steigerungsvorschlag. So kann es gar nicht passieren, dass an einer Stelle
 * eine gesperrte Übung auftaucht und an einer anderen nicht.
 */
function exOf(w) {
  if (istCustom(w.n)) return w.ex;
  const items = adjustedPlan()[w.n - 1] || w.ex;
  // Nur bei den Hanteln: Im Bodyweight-Modus gibt es nichts umzubauen, und die
  // Reihenfolge soll dann die des Plans bleiben.
  return store.workoutMode(w.n) === 'db' ? ruestOrderStabil(items, w.n, 'db') : items;
}

function workoutByNo(n) {
  if (istCustom(n)) {
    const c = store.customById(n);
    if (c) return { n, date: todayISO(), name: c.name, ex: c.ex, custom: true };
  }
  const w = PLAN.find((x) => x.n === n) || PLAN[0];
  const ex = exOf(w);
  return ex === w.ex ? w : { ...w, ex };
}

/** Untere Grenze eines Wiederholungsbereichs, z. B. "8–12" -> 8. */
function plannedReps(reps) {
  const m = String(reps).match(/\d+/);
  return m ? Number(m[0]) : 0;
}

/** Variante (db/bw) einer geplanten Übung inkl. Sätze. */
function resolve(item, mode) {
  const ex = EX_BY_ID.get(item.id);
  const v = ex[mode];
  return {
    id: item.id, sets: item.sets, group: ex.group,
    name: v.name, reps: v.reps, equip: v.equip, cue: v.cue, rest: v.rest, pattern: v.pattern, muscles: v.muscles,
    // Die ausführliche Erklärung hängt an der Übung, nicht an der Variante:
    // Griff, Aufbau und typische Fehler sind in beiden Fassungen dieselben.
    detail: ex.detail,
    // Zusatzgewicht gibt es nur in der Hantel-Variante und nur, wo die Übung
    // eines kennt – Chin-ups und Sliding Leg Curls etwa nicht.
    weight: mode === 'db' ? ex.weight : null,
    // Gerät der Figur. Bodyweight heißt nicht gerätelos: Ein Loop-Band ist in
    // beiden Varianten dasselbe Gerät, und seit die Bodyweight-Fassungen von
    // Curls, Trizepsdrücken und Schulterdrücken am Band hängen, wäre eine Figur
    // ohne Band schlicht falsch.
    gear: mode === 'db' ? ex.equip : (/band/i.test(v.equip) ? 'band' : null),
    weightNote: ex.weightNote,
  };
}

/* ------------------------------------------------------------------ *
 * Erfahrung
 *
 * Die Startgewichte in tools/exercise-meta.json sind die eines Menschen, der
 * seit einer Weile trainiert: 40 kg Floor Press, 20 kg Goblet Squat. Für jemand
 * anderen, der den Link bekommt, ist das entweder zu viel oder zu wenig – und
 * beides führt zum selben Ergebnis, nämlich dass die erste Einheit nichts taugt.
 *
 * Die Erfahrung skaliert deshalb die Startwerte, gerundet auf die Schrittweite
 * der jeweiligen Übung. Mehr nicht: Der Plan selbst, die Sätze, die Pausen und
 * die Erholungsregel sind für Anfänger dieselben wie für alle anderen – daran
 * ist nichts anfängerspezifisch. Und sobald jemand ein Gewicht selbst einstellt,
 * gilt seins; die Erfahrung ist ein Startpunkt, keine Obergrenze.
 * ------------------------------------------------------------------ */

const LEVELS = [
  ['anfaenger', 'Anfänger', 'Neu im Krafttraining oder lange raus. Die Startgewichte gehen '
    + 'auf die Hälfte – die ersten Wochen entscheidet die Technik, nicht die Scheibe.', 0.5],
  ['geuebt', 'Geübt', 'Du weißt, wie sich ein sauberer Satz anfühlt, und trainierst schon '
    + 'eine Weile. Die Startgewichte des Plans passen so.', 1],
  ['fortgeschritten', 'Fortgeschritten', 'Jahre im Training, die Technik sitzt. Die '
    + 'Startgewichte gehen um die Hälfte hoch.', 1.5],
];

/** Zwei Beispiele, damit die Wahl nicht abstrakt bleibt. */
function levelBeispiel(faktor) {
  const zeig = ['floor-press', 'goblet-squat']
    .map((id) => EX_BY_ID.get(id))
    .filter((ex) => ex && ex.weight)
    .map((ex) => {
      const step = ex.step || 2.5;
      const kg = faktor === 1 ? ex.weight
        : Math.max(step, Math.round((ex.weight * faktor) / step) * step);
      return `${ex.db.name} ${fmtNum(kg)} kg`;
    });
  return zeig.join(' · ');
}

const levelFaktor = () => {
  const eintrag = LEVELS.find(([key]) => key === (store.getState().level || 'geuebt'));
  return eintrag ? eintrag[3] : 1;
};

/** Startgewicht einer Übung, auf die Erfahrung umgerechnet. */
function startWeight(ex) {
  if (ex.weight === null) return null;
  const f = levelFaktor();
  // 0 kg heißt "ohne Zusatzlast" (Klimmzüge) – das bleibt 0, egal wer trainiert.
  if (!ex.weight || f === 1) return ex.weight;
  const step = ex.step || 2.5;
  return Math.max(step, Math.round((ex.weight * f) / step) * step);
}

/** Gewicht, mit dem diese Übung heute gearbeitet wird. */
function workingWeight(exId) {
  const ex = EX_BY_ID.get(exId);
  if (ex.weight === null) return null;
  const own = store.weightOf(exId);
  return own === null ? startWeight(ex) : own;
}

/**
 * Womit die schon abgehakten Sätze gemacht wurden, wenn es abweicht.
 *
 * Jeder Satz merkt sich sein eigenes Gewicht, sobald er abgehakt wird. Das ist
 * der Grund, warum sich mitten im Training umentscheiden lässt: Wer nach dem
 * ersten Satz merkt, dass 40 kg zu viel sind, stellt auf 35 und macht die
 * restlichen Sätze damit. Die schon abgehakten bleiben, wie sie waren – nichts
 * wird rückwirkend umgeschrieben.
 *
 * Früher stand deshalb das *zuerst* benutzte Gewicht groß in der Zeile und jede
 * Änderung galt "nächstes Mal". Das war beim Erhöhen richtig und beim Senken
 * falsch: Man senkt es ja gerade, weil der nächste Satz jetzt dran ist. Jetzt
 * steht dort das Gewicht für den nächsten Satz, und diese Zeile sagt, womit die
 * bisherigen gemacht wurden.
 */
function doneWeightNote(n, mode, exId) {
  const arr = store.peekSets(n, mode, exId) || [];
  const jetzt = workingWeight(exId);
  const andere = [];
  arr.forEach((x, i) => {
    if (!x.done || x.w === '') return;
    const kg = parseFloat(String(x.w).replace(',', '.'));
    if (Number.isNaN(kg) || Math.abs(kg - jetzt) < 0.01) return;
    andere.push({ i: i + 1, kg });
  });
  if (!andere.length) return '';
  const gruppen = new Map();
  andere.forEach(({ i, kg }) => gruppen.set(kg, (gruppen.get(kg) || []).concat(i)));
  return [...gruppen.entries()]
    .map(([kg, saetze]) => `Satz ${saetze.join(', ')} mit ${fmtNum(kg)} kg`)
    .join(' · ');
}

/* ------------------------------------------------------------------ *
 * Rüstzeit: Reihenfolge nach Gerät und Gewicht
 *
 * Zwischen zwei Übungen steht oft nicht die Pause, sondern der Umbau: Scheiben
 * abziehen, andere aufstecken, Verschlüsse zu. Das ist die Zeit, die eine
 * Einheit in der Wohnung wirklich lang macht, und sie steht in keinem Plan.
 *
 * Die Reihenfolge innerhalb einer Einheit ist dafür der ganze Hebel. Welche
 * Übungen an einem Tag stehen, entscheidet tools/build-plan.py nach dem
 * Wochenvolumen – daran wird hier nichts geändert. Aber ob die beiden
 * Langhantel-Übungen hintereinander kommen oder eine Kurzhantelübung dazwischen
 * liegt, kostet einen kompletten Auf- und Abbau.
 *
 * Sortiert wird deshalb nach Gerät und innerhalb des Geräts absteigend nach
 * Gewicht: Jedes Gerät wird einmal aufgebaut, und die Last geht in kleinen
 * Schritten nach unten statt hin und her. Am Plan gemessen sind das rund 30 %
 * weniger Kilo, die in einer Einheit bewegt werden – und schwer zuerst ist
 * ohnehin die richtige Reihenfolge fürs Training.
 *
 * Warum in der App und nicht im Generator: Hier stehen die *aktuellen*
 * Arbeitsgewichte. Der Generator kennt nur die Startwerte, und die stimmen nach
 * dem dritten Steigerungsvorschlag nicht mehr.
 *
 * Die Plätze der Übungen ohne Aufbau (Klimmzüge, Band, Bodyweight) bleiben, wo
 * sie sind: Sie kosten keinen Umbau, also darf zwischen zwei Langhantelübungen
 * ruhig ein Satz Pull-Apart liegen – die Stange bleibt ja geladen.
 * ------------------------------------------------------------------ */

const RUEST_FAM = {
  barbell: 'lh', hipbar: 'lh',          // dieselbe Stange, nur einmal mit Polster
  dumbbells: 'kh2',                     // beide Kurzhanteln auf dasselbe Gewicht
  goblet: 'kh1', onehand: 'kh1', plate: 'kh1',
  backpack: 'ruck',
};
const FAM_LABEL = { lh: 'Stange', kh2: 'Kurzhanteln', kh1: 'Kurzhantel', ruck: 'Rucksack' };

/** Was für eine Übung aufzubauen ist – oder null, wenn nichts zu schleppen ist. */
function setupOf(exId, kg) {
  const ex = EX_BY_ID.get(exId);
  const fam = ex && RUEST_FAM[ex.equip];
  if (!fam || !kg) return null;   // Klimmzüge stehen mit 0 kg im Rucksack: nichts zu tun
  return { fam, kg, label: FAM_LABEL[fam], note: ex.weightNote };
}

/**
 * Übungen einer Einheit nach Rüstaufwand ordnen.
 *
 * Die Reihenfolge der Geräte bleibt die des Plans – das erste Vorkommen eines
 * Geräts bestimmt seinen Platz. Damit steht vorn weiter, was der Generator nach
 * vorn gestellt hat (schwere Grundübung zuerst), und nur das Verstreute rückt
 * zusammen.
 */
const ruestCache = new Map();   // "Nummer|Modus|Übungen" -> Reihenfolge der IDs

/**
 * Wie ruestOrder(), aber die einmal gefundene Reihenfolge bleibt stehen.
 *
 * Ohne das springen die Karten unter dem Finger: Wer das Gewicht einer Übung
 * ändert, ändert damit ihren Platz in der Sortierung – und schon steht die
 * Übung, die man gerade bearbeitet, zwei Zeilen weiter oben. Die Reihenfolge
 * ist ein Plan für diese Einheit, keine ständig nachgeführte Sortierung; sie
 * wird beim ersten Ansehen festgelegt und beim nächsten Laden neu berechnet.
 *
 * Der Schlüssel enthält die Übungen selbst: Hakt jemand eine Verletzung an,
 * fällt eine Übung weg – dann ist es eine andere Einheit und wird neu sortiert.
 */
function ruestOrderStabil(items, n, mode) {
  const key = `${n}|${mode}|${items.map((i) => i.id).join(',')}`;
  const gemerkt = ruestCache.get(key);
  if (gemerkt) {
    const byId = new Map(items.map((i) => [i.id, i]));
    return gemerkt.map((id) => byId.get(id));
  }
  const out = ruestOrder(items);
  ruestCache.set(key, out.map((i) => i.id));
  return out;
}

/**
 * Zieht diese Reihenfolge eine kleine Übung vor eine schwere am selben Muskel?
 *
 * Gibt beide Plätze zurück, sonst null. Zwei Übungen sind "am selben Muskel",
 * wenn beide ihn direkt treffen (Anteil ab 0,5) – der Trizepsstrecker vor den
 * Liegestützen ist der Fall, der Beinbeuger vor dem Drücken nicht.
 */
function vorgezogen(liste) {
  const direkt = (it) => {
    const ex = EX_BY_ID.get(it.id);
    const sh = (ex && ex.db && ex.db.shares) || {};
    return new Set(Object.keys(sh).filter((m) => sh[m] >= 0.5));
  };
  const stufe = (it) => (EX_BY_ID.get(it.id) || {}).tier || 1;
  for (let a = 0; a < liste.length; a++) {
    for (let b = a + 1; b < liste.length; b++) {
      if (stufe(liste[a]) <= stufe(liste[b])) continue;
      const ma = direkt(liste[a]);
      if ([...direkt(liste[b])].some((m) => ma.has(m))) return [a, b];
    }
  }
  return null;
}

function ruestOrder(items) {
  const geladen = [];
  items.forEach((it, i) => {
    const s = setupOf(it.id, workingWeight(it.id));
    if (s) geladen.push({ it, s, i });
  });
  if (geladen.length < 3) return items;   // darunter gibt es nichts zu gewinnen

  // `fest` sind Übungen, die auf ihrem Platz bleiben müssen. Anfangs keine;
  // wer eine Grundübung überholt hat, kommt dazu und wird neu sortiert.
  const fest = new Set();
  const bauen = () => {
    const platz = new Map();
    const key = (g) => (fest.has(g.i) ? `#${g.i}` : g.s.fam);
    geladen.forEach((g) => { if (!platz.has(key(g))) platz.set(key(g), g.i); });
    const sortiert = geladen.slice().sort((a, b) => (
      platz.get(key(a)) - platz.get(key(b)) || b.s.kg - a.s.kg || a.i - b.i));
    const out = items.slice();
    geladen.forEach((g, k) => { out[g.i] = sortiert[k].it; });
    return out;
  };

  // Höchstens so viele Durchgänge, wie es Übungen gibt: Jeder setzt eine fest,
  // und mit allen festgesetzten steht wieder die Reihenfolge des Plans da.
  let out = bauen();
  for (let runde = 0; runde < geladen.length; runde++) {
    const paar = vorgezogen(out);
    if (!paar) break;
    // Festsetzen lässt sich nur, was überhaupt verschoben wurde. Drei Fälle,
    // in dieser Reihenfolge:
    //   1. die kleine Übung ist nach vorn gerutscht – sie bleibt stehen;
    //   2. sie stand schon immer da (Beinbeuger ohne Gewicht), und die schwere
    //      wurde nach hinten geschoben: dann bleibt das stehen, was ihren
    //      Platz eingenommen hat;
    //   3. sonst die schwere Übung selbst.
    const schwer = geladen.find((x) => x.it === out[paar[1]]);
    const kandidaten = [out[paar[0]], schwer ? out[schwer.i] : null, out[paar[1]]];
    const g = kandidaten.reduce((gefunden, it) => gefunden
      || (it ? geladen.find((x) => x.it === it && !fest.has(x.i)) : null), null);
    if (!g) break;
    fest.add(g.i);
    out = bauen();
  }
  return out;
}

/** Zeile über der Gewichtsangabe: was vor dieser Übung umzubauen ist. */
function ruestHint(n, mode, list, i) {
  if (mode !== 'db') return '';
  const cur = setupOf(list[i].id, workingWeight(list[i].id));
  if (!cur) return '';
  let prev = null;
  for (let k = i - 1; k >= 0 && !prev; k--) prev = setupOf(list[k].id, workingWeight(list[k].id));
  const kg = `${fmtNum(cur.kg)} kg${cur.note ? ` ${cur.note}` : ''}`;
  if (prev && prev.fam === cur.fam && Math.abs(prev.kg - cur.kg) < 0.01) {
    return `<div class="ruest gleich">✓ ${esc(cur.label)} bleibt bei ${esc(kg)} – nichts umbauen</div>`;
  }
  if (prev && prev.fam === cur.fam) {
    return `<div class="ruest">Umbauen: ${esc(cur.label)} von ${esc(fmtNum(prev.kg))} auf ${esc(kg)}</div>`;
  }
  return `<div class="ruest">Aufbauen: ${esc(cur.label)} auf ${esc(kg)}</div>`;
}

/**
 * Vorschlag, das Gewicht zu erhöhen – doppelte Progression ohne Eingabe.
 *
 * Bedingung: die letzten beiden Male wurde diese Übung mit genau diesem
 * Gewicht komplett durchgezogen. Dann ist sie kein Reiz mehr. Gezählt werden
 * nur die Hantel-Variante und nur Einheiten, in denen wirklich alle Sätze
 * stehen – ein abgebrochenes Workout ist kein Beweis.
 *
 * Bewusst nur ein Vorschlag: ob der Satz sauber war, weiß die App nicht.
 */
/**
 * Wie viel eine Steigerung ausmacht, steht je Übung in exercise-meta.json.
 *
 * Fest 2,5 kg war für den Goblet Squat richtig (20 → 22,5, also ein Achtel
 * mehr) und für das Seitheben Unsinn: 6 → 8,5 kg je Hand sind über vierzig
 * Prozent auf einmal. Der Vorschlag empfahl damit regelmäßig etwas, das
 * niemand schafft.
 */
const stepOf = (exId) => {
  const ex = EX_BY_ID.get(exId);
  return (ex && ex.step) || 2.5;
};
const BUMP_NEEDED = 2;

function bumpHint(exId) {
  const ex = EX_BY_ID.get(exId);
  if (!ex || ex.weight === null) return null;
  const current = workingWeight(exId);

  let streak = 0;
  for (let i = PLAN.length - 1; i >= 0; i--) {
    const w = PLAN[i];
    const item = exOf(w).find((x) => x.id === exId);
    if (!item) continue;
    const sets = store.peekSets(w.n, 'db', exId);
    // Leere Sätze zählen nicht als Lücke. getSets() legt sie schon beim
    // *Ansehen* einer Einheit an – wer einmal mit "Nächstes →" nach vorn
    // blättert, hinterlässt dort drei leere Sätze. Ohne diese Zeile bricht die
    // Suche an genau dieser künftigen Einheit ab und der Vorschlag kam für die
    // Übungen darin nie wieder.
    if (!sets || !sets.some((x) => x.done || x.w !== '')) continue;
    const complete = sets.length >= item.sets && sets.slice(0, item.sets).every((x) => x.done);
    if (!complete) break;                       // Lücke beendet die Serie
    const used = parseFloat(String(sets[0].w).replace(',', '.'));
    if (!(Math.abs(used - current) < 0.01)) break;   // anderes Gewicht: Serie neu
    streak += 1;
    if (streak >= BUMP_NEEDED) return { from: current, to: current + stepOf(exId), streak };
  }
  return null;
}

/**
 * Sicherung als Datei. Alles liegt nur im Speicher dieses Browsers – Android
 * räumt den bei Platzmangel weg, und "Websitedaten löschen" reicht ebenfalls.
 * Deshalb wird der Stand mitgeschrieben, um später erinnern zu können.
 */
function downloadBackup() {
  const json = store.exportJSON();
  // Manche Umgebungen – eingebettete Ansichten, strenge Browser – lassen den
  // Download stillschweigend fallen. Deshalb steht der Export danach immer
  // auch im Textfeld zum Kopieren.
  const io = document.getElementById('io');
  if (io) io.value = json;
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `workout-backup-${todayISO()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  store.markBackup(doneCount());
  toast('Gesichert – falls kein Download kam: Text in „Mehr“ kopieren');
}

/**
 * Trainingstermine als Kalenderdatei.
 *
 * Geschrieben werden die *tatsächlichen* Termine – verschobene inbegriffen –
 * mit fester Kennung je Workout. Wird die Datei nach einer Verschiebung erneut
 * eingelesen, wandern dieselben Termine mit, statt sich zu verdoppeln.
 */
function downloadICS() {
  const vorher = store.getState().lastIcs;
  const stand = store.markIcs(PLAN.length);
  // Was beim letzten Mal exportiert wurde und diesmal nicht mehr vorkommt, muss
  // aus dem Kalender wieder heraus: ein anderer Trainingsfokus hat womöglich
  // weniger Einheiten, und ein Tag, an dem Verletzungen alles sperren, hat gar
  // keinen Termin mehr.
  const jetzt = new Set(PLAN.filter((w) => exOf(workoutByNo(w.n)).length).map((w) => w.n));
  const cancel = [];
  for (let n = 1; n <= Math.max((vorher && vorher.count) || 0, PLAN.length); n++) {
    if (!jetzt.has(n)) cancel.push(n);
  }
  const text = buildICS(
    PLAN.map((w) => ({ n: w.n, date: effDate(w) })),
    (w) => exOf(workoutByNo(w.n)).map((it) => resolve(it, store.workoutMode(w.n))),
    { hour: 18, seq: stand.seq, cancel },
  );
  const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `workout-termine-${todayISO()}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('Kalenderdatei erstellt – in Google Kalender importieren');
}

/** Stimmen die Termine im Kalender noch, oder hat sich der Plan seither verschoben? */
function icsStale() {
  const s = store.getState();
  return !!s.lastIcs && s.lastIcs.shift !== s.shift;
}

/** Zahl der abgeschlossenen Einheiten in dieser Runde. */
function doneCount() {
  return PLAN.filter((w) => completedMode(w.n)).length;
}

/** Wie viele Einheiten seit der letzten Sicherung dazugekommen sind. */
const BACKUP_EVERY = 8;

function backupDue() {
  const done = doneCount();
  const last = store.getState().lastBackup;
  if (!last) return done >= 3 ? done : 0;
  return done - last.done >= BACKUP_EVERY ? done - last.done : 0;
}

/**
 * Abschluss eines laufenden Trainings: zwei Wege, klar getrennt.
 *
 * "Abschließen" behält, was abgehakt ist – auch wenn nicht alles steht.
 * "Abbrechen" verwirft die Einheit ganz, damit sie als nicht trainiert gilt
 * und der Plan sie behandelt wie einen verpassten Tag. Ohne diese Trennung
 * blieb nach jedem Abbruch ein halb abgehaktes Workout stehen.
 */
function sessionButtons(n, mode) {
  const prog = progressOf(n, mode);
  return `
    <div class="btn-row nav">
      <button type="button" class="btn btn-danger" data-act="discard-session">Abbrechen</button>
      <button type="button" class="btn btn-ok" data-act="finish-session">
        ✓ Abschließen${prog.done ? ` (${prog.done}/${prog.total})` : ''}
      </button>
    </div>`;
}

/** Knopf, der den Vorschlag annimmt – oder nichts, wenn keiner ansteht. */
function bumpChip(exId, mode) {
  if (mode !== 'db') return '';
  const hint = bumpHint(exId);
  if (!hint) return '';
  return `<button type="button" class="kg-bump" data-act="accept-bump" data-ex="${exId}" data-kg="${hint.to}">
      ${hint.streak}× alles geschafft · auf ${esc(fmtNum(hint.to))} kg?
    </button>`;
}

/** Zahl in deutscher Schreibweise, ohne unnötige Null hinter dem Komma.
 *
 * Zwei Nachkommastellen, nicht eine: seit die Gewichtsschritte je Übung gehen,
 * gibt es 1,25-kg-Sprünge, und 21,25 kg als "21,3" anzuzeigen wäre schlicht
 * falsch – die Zahl steht am Knopf, nach dem man greift.
 */
function fmtNum(n) {
  return Number.isInteger(n) ? String(n) : String(+n.toFixed(2)).replace('.', ',');
}

/** Pausenlänge für eine Übung – empfohlen oder fest, je nach Einstellung. */
function restFor(item) {
  const s = store.getState();
  if (!s.useExerciseRest) return s.restSeconds;
  return item.rest;
}

function progressOf(n, mode) {
  const w = workoutByNo(n);
  let done = 0;
  let total = 0;
  w.ex.forEach((item) => {
    const arr = store.peekSets(n, mode, item.id) || [];
    total += item.sets;
    done += arr.slice(0, item.sets).filter((s) => s.done).length;
  });
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0, complete: total > 0 && done === total };
}

/** Ist das Workout in irgendeinem Modus abgeschlossen? Gibt den Modus zurück. */
function completedMode(n) {
  const st = store.getState().log[n];
  if (!st) return null;
  for (const m of ['db', 'bw']) {
    if (progressOf(n, m).complete) return m;
  }
  // Von Hand abgeschlossen: "Abschließen" heißt, dass die Einheit fertig ist –
  // auch wenn der letzte Satz Wadenheben fehlt. Ohne das stand im Kalender ein
  // ausgefallener Tag, obwohl 16 von 18 Sätzen standen.
  return st.done && hasAnyEntry(n, st.done) ? st.done : null;
}

function hasAnyEntry(n, mode) {
  const w = workoutByNo(n);
  return w.ex.some((item) => (store.peekSets(n, mode, item.id) || [])
    .some((s) => s.done || s.w !== ''));
}

/* ------------------------------------------------------------------ *
 * Pausentimer
 * ------------------------------------------------------------------ */

const restBar = document.getElementById('restBar');
const restTime = document.getElementById('restTime');
const restNext = document.getElementById('restNext');
const restFill = document.getElementById('restFill');
const restLive = document.getElementById('restLive');
const restLabel = document.getElementById('restLabel');

/** Ansage für Screenreader – nur zum Anfang und Ende, nicht im Sekundentakt. */
function announce(text) {
  if (restLive) restLive.textContent = text;
}

let restTicker = null;
let wakeLock = null;
let restArmed = false;   // liegt das Pausensignal schon auf der Audio-Uhr?

/**
 * Vorwarnung vor dem Ende der Pause.
 *
 * Zwischen dem Signal und dem ersten Wiederholung liegen sonst noch der Weg zur
 * Hantel und das Zurechtlegen – die Pause ist damit in Wahrheit länger als
 * geplant. Fünf Sekunden vorher kommt deshalb ein leiserer, tieferer Ton, und
 * die Leiste schaltet auf "Fertig machen" um. Beim Signal selbst steht man dann
 * schon an der Stange.
 */
const VORLAUF = 5;

/**
 * Ton zu einem Ereignis – Training starten, Satz abhaken, Übung fertig,
 * Workout komplett. Die Töne selbst stehen in js/audio.js.
 *
 * Der Tupfer beim Abhaken hat einen eigenen Schalter: Er kommt in einem
 * Training zwanzigmal, und ob man das mag, ist Geschmackssache – die
 * Ereignisse drumherum kommen ein- bis zweimal und stören niemanden.
 */
function sound(name) {
  const s = store.getState();
  if (!s.sound) return;
  if (name === 'set' && !s.soundSets) return;
  playSound(name);
}

/* Hinweis zum Pausenende, wenn die App gerade nicht im Vordergrund ist.
 *
 * Der Ton allein reicht dafür nicht immer: Schaltet man während der Pause zu
 * einer anderen App, darf der Browser die Seite einfrieren. Der vorausgelegte
 * Ton übersteht das meistens (siehe js/audio.js), eine Systemmeldung kommt
 * zusätzlich auch dann noch an, wenn er es nicht tut – und sie ist sichtbar,
 * nicht nur hörbar. Sie braucht eine Erlaubnis, deshalb ein eigener Schalter
 * unter Mehr statt einer Nachfrage beim ersten Start.
 *
 * Was auch das nicht kann: die App komplett schließen und trotzdem klingeln.
 * Dafür bräuchte es einen Server, der eine Push-Nachricht schickt – die App
 * hat keinen und soll keinen haben. */
const NOTE_TAG = 'workout-pause';
let noteTimer = null;

/** Registrierung des Service Workers, immer als Promise – auch ohne ihn. */
function swReg() {
  try {
    return navigator.serviceWorker?.getRegistration() || Promise.resolve(null);
  } catch {
    return Promise.resolve(null);
  }
}

/** Vom Browser blockiert – dann hilft kein Schalter in der App mehr. */
function notifyDenied() {
  return 'Notification' in window && Notification.permission === 'denied';
}

function noteAllowed() {
  return store.getState().notify && 'Notification' in window
    && Notification.permission === 'granted';
}

function planNote(secs, text) {
  dropNote();
  if (!noteAllowed()) return;
  noteTimer = setTimeout(() => {
    noteTimer = null;
    // Nur, wenn die App gerade nicht zu sehen ist: Wer davorsitzt, hört den Ton
    // und sieht die Leiste – eine Systemmeldung wäre da nur Lärm.
    if (!document.hidden) return;
    const opt = {
      body: text,
      tag: NOTE_TAG,          // ersetzt eine ältere, statt sie zu stapeln
      icon: './icon-192.png',
      badge: './icon-192.png',
      vibrate: [180, 90, 180],
    };
    swReg().then((reg) => {
      if (reg) reg.showNotification('Pause vorbei', opt);
      else new Notification('Pause vorbei', opt);
    }).catch(() => {});
  }, Math.max(0, secs) * 1000);
}

/** Wecker abbestellen und eine schon sichtbare Meldung schließen. */
function dropNote() {
  clearTimeout(noteTimer);
  noteTimer = null;
  swReg()
    .then((reg) => (reg ? reg.getNotifications({ tag: NOTE_TAG }) : []))
    .then((list) => list.forEach((nt) => nt.close()))
    .catch(() => {});
}

/**
 * Ton und Hinweis auf das Ende der laufenden Pause legen.
 *
 * Bei jeder Änderung neu: Start, „+30 s", und auch beim Umlegen der Schalter,
 * damit eine schon laufende Pause der neuen Einstellung folgt.
 */
function armRest() {
  const rest = store.getState().rest;
  if (!rest) {
    cancelSound();
    dropNote();
    restArmed = false;
    return;
  }
  const left = (rest.endsAt - Date.now()) / 1000;
  if (store.getState().sound) {
    restArmed = scheduleSound([['ready', left - VORLAUF], ['rest', left]]);
  } else {
    cancelSound();
    restArmed = false;
  }
  planNote(left, rest.next);
}

/**
 * Displaysperre während der Pause. Ohne sie schläft das Handy ein, der Browser
 * friert die Seite ein – und der Ton käme zu spät oder gar nicht.
 */
async function holdScreen(on) {
  try {
    if (on) {
      if (!wakeLock && navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen');
    } else if (wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    wakeLock = null; // nicht unterstützt oder abgelehnt – kein Beinbruch
  }
}

function startRest(exName, setIndex, sets, secs) {
  if (!secs) return;
  store.setRest({
    endsAt: Date.now() + secs * 1000,
    total: secs,
    next: `Satz ${setIndex + 2} von ${sets} · ${exName}`,
  });
  announce(`Pause ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} Minuten, `
    + `danach Satz ${setIndex + 2} von ${sets}, ${exName}`);
  holdScreen(true);
  armRest();
  tickRest();
}

function endRest(withSignal) {
  if (!restBar) return;
  if (restTicker) { clearInterval(restTicker); restTicker = null; }
  holdScreen(false);
  store.setRest(null);
  restBar.hidden = true;
  restBar.classList.remove('ready');
  document.body.classList.remove('resting');
  // Das Signal liegt längst auf der Audio-Uhr und hat gerade selbst gespielt –
  // hier noch einmal anzustoßen, gäbe ein Echo. Nur wenn das Voraussetzen nicht
  // geklappt hat (kein Ton freigeschaltet, Browser ohne Web Audio), kommt der
  // Ton jetzt. cancelSound() lässt ein bereits laufendes Signal ausklingen.
  if (withSignal && !restArmed) sound('rest');
  cancelSound();
  // Bei einer abgebrochenen Pause den Hinweis abbestellen – bei einer
  // abgelaufenen gerade nicht: Diese Zeile läuft bis zu eine halbe Sekunde vor
  // dem Ende (der Timer prüft im Vierteltakt und rundet), der Wecker soll aber
  // noch losgehen, falls die App im Hintergrund ist.
  if (!withSignal) dropNote();
  restArmed = false;
  if (withSignal) {
    if (navigator.vibrate) navigator.vibrate([180, 90, 180]);
    announce('Pause vorbei, nächster Satz');
  } else {
    announce('');
  }
}

function tickRest() {
  // Sollten Seite und Skript aus unterschiedlich alten Zwischenspeichern
  // stammen, fehlt die Leiste - dann lieber ohne Timer weiterlaufen als alles
  // mit einem Fehler anhalten.
  if (!restBar) return;
  const rest = store.getState().rest;
  if (!rest) { restBar.hidden = true; document.body.classList.remove('resting'); return; }

  const left = Math.round((rest.endsAt - Date.now()) / 1000);
  if (left <= 0) {
    endRest(true);
    toast('Pause vorbei – nächster Satz');
    return;
  }

  restBar.hidden = false;
  document.body.classList.add('resting');
  // Die letzten Sekunden gehören dem Weg zur Hantel, nicht mehr der Pause.
  const gleich = left <= VORLAUF;
  restBar.classList.toggle('ready', gleich);
  if (restLabel) restLabel.textContent = gleich ? 'Fertig machen' : 'Pause';
  restTime.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  restNext.textContent = rest.next;
  restFill.style.width = `${Math.max(0, (left / rest.total) * 100)}%`;

  if (!restTicker) restTicker = setInterval(tickRest, 250);
}

/** Laufzeit des Trainings im Kopfbereich mitzählen, ohne neu zu rendern. */
setInterval(() => {
  const badge = document.getElementById('sessionBadge');
  if (!badge || !store.getState().session) return;
  const secs = store.sessionSeconds();
  badge.textContent = `⏱ ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
}, 1000);

document.getElementById('restSkip')?.addEventListener('click', () => endRest(false));
document.getElementById('restPlus')?.addEventListener('click', () => {
  const rest = store.getState().rest;
  if (!rest) return;
  store.setRest({ ...rest, endsAt: rest.endsAt + 30000, total: rest.total + 30 });
  armRest(); // Signal 30 s weiter hinten neu auflegen
  tickRest();
});

let toastTimer = null;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

/* ------------------------------------------------------------------ *
 * UI-Zustand (nicht persistiert)
 * ------------------------------------------------------------------ */

// Alle Seiten, die es gibt – auch die ohne Reiter unten. Welche unten stehen,
// entscheidet TABS weiter hinten; hier geht es nur darum, welchen gespeicherten
// Wert `tab` überhaupt annehmen darf.
const SEITEN = ['dashboard', 'calendar', 'stats', 'injuries', 'custom', 'settings', 'admin'];

const ui = {
  // Beim Neuladen im selben Tab bleiben. Die Seite lädt öfter neu, als man
  // denkt – nach einer Aktualisierung etwa –, und jedes Mal auf dem Dashboard
  // zu landen ist lästig.
  tab: SEITEN.includes(store.getState().tab) ? store.getState().tab : 'dashboard',
  workoutNo: defaultWorkoutNo(),
  openEx: new Set(),
  openDetail: new Set(),   // Übungen, deren ausführliche Erklärung offen steht
  standAngebot: null,      // Stand, den jemand per Link geschickt hat
  shiftInfo: 0,            // um so viele Tage ist der Plan gerade nachgerückt
  standZurueck: null,      // Name, dem man seinen Stand noch zurückschicken wollte
  adminDaten: null,        // geladene Zeilen der Betreiber-Übersicht
  adminFehler: '',
  adminLaeuft: false,
  customDraft: null,       // Entwurf im Baukasten für eigene Workouts
  setupStep: 0,            // Schritt im Einstieg: Name, Farbe, Fokus
  openInjury: new Set(),
  focus: false,    // Fokus-Ansicht: eine Übung groß
  listView: false, // Übungsliste statt Startansicht
  focusIdx: 0,
  // Kalender: gezeigter Monat und der angetippte Tag. Beides fängt bei der
  // nächsten offenen Einheit an, nicht stur bei heute – wer den Tab öffnet,
  // will meistens wissen, was als Nächstes kommt.
  calMonth: null,
  calDay: null,
};

/* ------------------------------------------------------------------ *
 * Dashboard
 * ------------------------------------------------------------------ */

/** Index der ersten Übung, in der noch ein Satz offen ist. */
function firstOpenExercise(n, mode) {
  const w = workoutByNo(n);
  const idx = w.ex.findIndex((item) => {
    const arr = store.peekSets(n, mode, item.id) || [];
    return arr.slice(0, item.sets).filter((s) => s.done).length < item.sets;
  });
  return idx === -1 ? w.ex.length - 1 : idx;
}

/** Zur nächsten offenen Übung rücken und sagen, welche das ist. */
function weiterZurNaechsten(n, mode) {
  const nextIdx = firstOpenExercise(n, mode);
  if (nextIdx === ui.focusIdx) return;
  ui.focusIdx = nextIdx;
  toast(`Weiter: ${resolve(workoutByNo(n).ex[nextIdx], mode).name}`);
}

/**
 * Fortschrittsleiste über der Fokus-Ansicht.
 *
 * Ein Feld je Satz, in Gruppen zu je einer Übung. Damit steht die ganze Einheit
 * auf einen Blick da: was schon steht, wo man gerade ist, was noch kommt – und
 * ein Tipp auf eine Gruppe springt dorthin. Die Breite folgt der Satzzahl,
 * sonst sähe eine Übung mit drei Sätzen so groß aus wie eine mit einem.
 *
 * Über den Sätzen stand zuerst noch ein Balken je Übung. Der sagte nichts, was
 * die Felder darunter nicht schon sagen – drei grüne Felder sind eine fertige
 * Übung. Die laufende Übung erkennt man jetzt an den umrandeten Feldern.
 */
function progressStrip(n, mode, w, cur) {
  return `
    <div class="prog">
      ${w.ex.map((item, k) => {
        const v = resolve(item, mode);
        const arr = store.peekSets(n, mode, v.id) || [];
        const done = arr.slice(0, v.sets).filter((x) => x.done).length;
        return `
        <button type="button" class="prog-ex ${k === cur ? 'cur' : ''} ${done === v.sets ? 'done' : ''}"
                style="flex-grow:${v.sets}" data-act="focus-goto" data-i="${k}"
                aria-label="Übung ${k + 1}, ${esc(v.name)}, ${done} von ${v.sets} Sätzen"
                aria-current="${k === cur}">
          <span class="prog-sets">
            ${Array.from({ length: v.sets }, (_, x) => `<i class="${x < done ? 'on' : ''}"></i>`).join('')}
          </span>
        </button>`;
      }).join('')}
    </div>`;
}

/**
 * Fokus-Ansicht: eine Übung groß, mit vorgeführter Bewegung. Sobald alle Sätze
 * stehen, rückt sie von selbst zur nächsten offenen Übung weiter.
 */
function renderFocus() {
  const n = ui.workoutNo;
  const w = workoutByNo(n);
  const mode = store.workoutMode(n);
  const prog = progressOf(n, mode);

  // Eine Einheit kann leer sein: mit genug angehakten Beschwerden fällt jede
  // Übung weg. Dann gibt es nichts zu fokussieren – zurück in die Startansicht,
  // die den Grund nennt. Vorher lief die Ansicht hier in ein undefined.
  if (!w.ex.length) {
    ui.focus = false;
    renderOverview();
    return;
  }

  const i = Math.min(Math.max(0, ui.focusIdx), w.ex.length - 1);
  const item = w.ex[i];
  const it = resolve(item, mode);
  const sets = store.getSets(n, mode, it.id, it.sets);
  const doneCount = sets.filter((s) => s.done).length;
  const kg = it.weight === null ? null : workingWeight(it.id);
  const anders = it.weight === null ? '' : doneWeightNote(n, mode, it.id);

  view.innerHTML = `
    <div class="focus-top">
      <button type="button" class="back-link" data-act="focus-list">☰ Übersicht</button>
      <span class="focus-count">
        <span id="sessionBadge">⏱ 0:00</span> · Übung ${i + 1} von ${w.ex.length} · ${prog.done}/${prog.total} Sätze
      </span>
    </div>
    ${progressStrip(n, mode, w, i)}

    <div class="focus-fig" id="focusFig"></div>

    <h2 class="focus-name">${esc(it.name)}</h2>
    <div class="focus-meta">${it.sets} Sätze × ${esc(repsLabel(it, mode))} Wdh. · ${esc(it.group)} · ${esc(it.equip)}</div>

    ${kg === null ? bandRow(it) : `
      ${ruestHint(n, mode, w.ex, i)}
      <div class="ex-weight focus-weight">
        <button type="button" class="kg-step" data-act="weight-step" data-ex="${it.id}" data-d="${-stepOf(it.id)}"
                aria-label="${esc(fmtNum(stepOf(it.id)))} Kilo weniger">−</button>
        <div class="kg-main">
          <input type="text" inputmode="decimal" class="kg-val" value="${fmtNum(kg)}"
                 data-act="weight-input" data-ex="${it.id}" aria-label="Gewicht in Kilo">
          <span class="kg-unit">kg${it.weightNote ? ` · ${esc(it.weightNote)}` : ''}</span>
        </div>
        <button type="button" class="kg-step kg-plus" data-act="weight-step" data-ex="${it.id}" data-d="${stepOf(it.id)}"
                aria-label="${esc(fmtNum(stepOf(it.id)))} Kilo mehr">+</button>
      </div>
      ${anders ? `<div class="kg-next focus-next">${esc(anders)}</div>` : bumpChip(it.id, mode)}`}

    <div class="focus-sets">
      ${sets.map((s, idx) => `
        <button type="button" class="set-btn focus-set ${s.done ? 'on' : ''}" aria-pressed="${s.done}"
                aria-label="Satz ${idx + 1} von ${it.sets} erledigt"
                data-act="toggle-set" data-ex="${it.id}" data-i="${idx}">${s.done ? '✓' : idx + 1}</button>`).join('')}
    </div>

    <div class="cue focus-cue">${esc(it.cue)}</div>
    ${detailBlock(it)}


    <div class="btn-row nav">
      <button type="button" class="btn btn-ghost" data-act="focus-step" data-d="-1" ${i === 0 ? 'disabled' : ''}>← Zurück</button>
      <button type="button" class="btn ${doneCount === it.sets ? 'btn-primary' : 'btn-ghost'}"
              data-act="focus-step" data-d="1" ${i === w.ex.length - 1 ? 'disabled' : ''}>Weiter →</button>
    </div>

    ${i === w.ex.length - 1 ? careBlock(n) : ''}
    ${sessionButtons(n, mode)}
    ${injuryNote(w, mode)}
  `;

  const host = document.getElementById('focusFig');
  if (host) mountFigure(host, it.pattern, it.weight !== null, it.gear);
}

/**
 * Startansicht: was heute ansteht, welche Muskelgruppen drankommen, los.
 * Die einzelnen Übungen liegen eine Ebene tiefer – vor dem Training will man
 * sie nicht abhaken, sondern nur wissen, was kommt.
 */
function renderOverview() {
  const n = ui.workoutNo;
  const w = workoutByNo(n);
  const mode = store.workoutMode(n);
  const prog = progressOf(n, mode);
  const today = todayISO();
  const date = effDate(w);
  const diff = daysBetween(today, date);
  const shift = store.getState().shift;

  let when;
  if (diff === 0) when = 'Heute';
  else if (diff === 1) when = 'Morgen';
  else if (diff === -1) when = 'Gestern';
  else if (diff > 1) when = `in ${diff} Tagen`;
  else when = `vor ${-diff} Tagen`;

  const items = w.ex.map((item) => resolve(item, mode));
  const totalSets = items.reduce((a, x) => a + x.sets, 0);
  const muscles = new Set(items.flatMap((it) => it.muscles));
  // In den Daten steht der zuerst beanspruchte Muskel vorn. Daraus zwei
  // Stufen: was heute wirklich dran ist, und was nur mitarbeitet.
  const primary = new Set(items.map((it) => it.muscles[0]).filter(Boolean));
  const planDone = doneCount() === PLAN.length;
  const due = backupDue();

  // Eine Bildschirmseite, ohne Scrollen: Kopf, Körper, Start. Der Körper
  // nimmt sich den Platz, der zwischen den beiden übrig bleibt.
  view.innerHTML = `
    <section class="ov">
      ${store.canPersist() ? '' : `<div class="notice warn">⚠️ Dieser Browser lässt keine Speicherung zu –
        Eintragungen gehen beim Neuladen verloren.</div>`}
      ${ui.shiftInfo ? `<div class="notice">
        ↷ <b>${esc(plural(ui.shiftInfo, 'Tag', 'Tage'))} verpasst.</b> Der Plan ist
        nachgerückt – die Abstände zwischen den Einheiten bleiben, übersprungen wird nichts.
        ${store.getState().lastIcs ? `<div style="margin-top:8px">Deine Termine im Kalender
          stehen jetzt an den falschen Tagen. Neue Kalenderdatei erzeugen?</div>
          <div class="btn-row nav" style="margin-top:8px">
            <button type="button" class="btn btn-primary" data-act="shift-ics">Ja, Datei erzeugen</button>
            <button type="button" class="btn btn-ghost" data-act="shift-ok">Nein, später</button>
          </div>`
        : `<div class="btn-row" style="margin-top:8px">
            <button type="button" class="btn btn-ghost btn-block" data-act="shift-ok">Alles klar</button>
          </div>`}
      </div>` : ''}
      ${ui.standAngebot ? `<div class="notice">
        👋 <b>${esc(ui.standAngebot.n)}</b> hat dir seinen Stand geschickt:
        ${ui.standAngebot.w} von ${ui.standAngebot.p} Einheiten, ${ui.standAngebot.s} Sätze${
          ui.standAngebot.kg ? `, ${ui.standAngebot.kg.toLocaleString('de-DE')} kg Volumen` : ''}.
        <div class="btn-row nav" style="margin-top:10px">
          <button type="button" class="btn btn-primary" data-act="accept-stand">Zum Vergleich</button>
          <button type="button" class="btn btn-ghost" data-act="drop-stand">Verwerfen</button>
        </div></div>` : ''}
      ${planDone ? `<div class="notice done-notice">🎉 Plan geschafft – alle ${PLAN.length} Einheiten.
        <button type="button" class="btn btn-primary btn-block" data-act="restart-plan"
                style="margin-top:10px">Von vorn beginnen</button>
        <span class="small muted">Die erreichten Gewichte bleiben stehen.</span></div>` : ''}
      ${due ? `<div class="notice warn">💾 ${esc(plural(due, 'Einheit', 'Einheiten'))} seit der letzten
        Sicherung. Alles liegt nur in diesem Browser.
        <button type="button" class="btn btn-block" data-act="backup-now" style="margin-top:10px">Jetzt sichern</button></div>` : ''}

      <header class="ov-top">
        <div class="hero-eyebrow">${store.getState().name ? `${esc(store.getState().name)} · ` : ''}${
          w.custom ? 'Eigenes Workout' : `${esc(when)} · Workout ${w.n} von ${PLAN.length}`}</div>
        <h2 class="hero-title">${w.custom ? esc(w.name) : esc(fmtDate(date, true))}</h2>
        <div class="hero-sub">${MODE_LABEL[mode]} · ${items.length} Übungen · ${totalSets} Sätze${
          shift ? ` · Plan ${shift > 0 ? '+' : '−'}${esc(plural(Math.abs(shift), 'Tag', 'Tage'))}` : ''}</div>
        ${prog.done ? `<div class="progress"><i style="width:${prog.pct}%"></i></div>
          <div class="ov-prog">${prog.done}/${prog.total} Sätze${prog.complete ? ' · abgeschlossen' : ''}</div>` : ''}
      </header>

      <div class="ov-body" id="bodyMap"></div>

      <div class="bm-legend">${[...muscles]
        .sort((a, b) => (primary.has(b) ? 1 : 0) - (primary.has(a) ? 1 : 0))
        .map((m) => `<span class="${primary.has(m) ? '' : 'sub'}">${esc(MUSCLE_LABEL[m] || m)}</span>`).join('')}</div>

      ${items.length ? `
        ${prog.done ? `
        <button type="button" class="btn btn-primary btn-block btn-start" data-act="start-session">
          ▶︎ Training fortsetzen
        </button>
        ${prog.complete || completedMode(n) ? '' : `
        <button type="button" class="btn btn-ghost btn-block" data-act="mark-done" style="margin-top:8px">
          ✓ Als trainiert markieren
        </button>`}`
        : `
        <div class="start-paar">
          <button type="button" class="btn btn-primary btn-start ${mode === 'db' ? '' : 'zweit'}"
                  data-act="start-session" data-mode="db"
                  aria-label="Workout mit Hanteln starten">▶︎ Hanteln</button>
          <button type="button" class="btn btn-primary btn-start ${mode === 'bw' ? '' : 'zweit'}"
                  data-act="start-session" data-mode="bw"
                  aria-label="Workout als Bodyweight starten">▶︎ Bodyweight</button>
        </div>`}
        ${startTodayRow(w.n)}`
      : `<div class="card empty-day">
          <b>Heute bleibt nichts übrig.</b> Die angehakten Beschwerden sperren
          jede Übung dieser Einheit, und für keine gibt es einen Ersatz, der
          nicht auch weh täte. Das ist kein Fehler – nur ein Tag, an dem
          Krafttraining nicht dran ist.
          <button type="button" class="btn btn-ghost btn-sm" data-act="go-injuries">Verletzungen ansehen</button>
        </div>`}

      <div class="ov-foot">
        ${w.custom ? `<button type="button" class="ov-nav" data-act="back-to-plan" aria-label="Zurück zum Plan">↩</button>`
          : `<button type="button" class="ov-nav" data-act="nav-workout" data-delta="-1" ${n === PLAN[0].n ? 'disabled' : ''}>←</button>`}
        <button type="button" class="ov-nav wide" data-act="show-list">Übungen &amp; Gewichte</button>
        ${w.custom ? `<button type="button" class="ov-nav" data-act="go-tab" data-tab="custom" aria-label="Eigenes Workout bearbeiten">✎</button>`
          : `<button type="button" class="ov-nav" data-act="nav-workout" data-delta="1" ${n === PLAN[PLAN.length - 1].n ? 'disabled' : ''}>→</button>`}
      </div>
    </section>
    ${injuryNote(w, mode)}
  `;

  const host = document.getElementById('bodyMap');
  if (host) mountBody(host, muscles, primary);
}

/* ------------------------------------------------------------------ *
 * Erster Start
 *
 * Die App ist zum Weitergeben gedacht: ein Link, und wer ihn öffnet, hat
 * dieselbe App. Nur weiß er beim ersten Öffnen nicht, was er vor sich hat –
 * ein Plan über 84 Einheiten mit fremden Startgewichten. Deshalb einmal eine
 * Seite, die das in vier Sätzen erklärt und nach dem Namen fragt.
 *
 * Der Name ist kein Konto. Es gibt keinen Server, keine Anmeldung und nichts
 * zu synchronisieren; er steht in diesem Browser und sonst nirgends. Genau das
 * sagt die Seite auch – sonst wartet jemand darauf, dass sein Training bei
 * jemand anderem auftaucht.
 * ------------------------------------------------------------------ */

function needsWelcome() {
  const s = store.getState();
  return !s.greeted && !Object.keys(s.log).length;
}

const SETUP_LETZTER = 3;   // Name, Farbe, Erfahrung, Fokus

function renderWelcome() {
  const schritt = ui.setupStep || 0;
  const s = store.getState();

  const kopf = `
    <header class="ov-top">
      <div class="hero-eyebrow">Einrichten · Schritt ${schritt + 1} von ${SETUP_LETZTER + 1}</div>
      <h2 class="hero-title">${['Willkommen', 'Farbe', 'Wie viel Erfahrung?',
        'Worauf soll es hinauslaufen?'][schritt]}</h2>
    </header>
    ${ui.standAngebot && schritt === 0 ? `<div class="notice">👋 <b>${esc(ui.standAngebot.n)}</b> hat dir
      den Link geschickt und seinen Stand mitgeschickt: ${ui.standAngebot.w} von
      ${ui.standAngebot.p} Einheiten. Sobald du fertig eingerichtet hast, steht er in deinem
      Vergleich.</div>` : ''}`;

  const seiten = [`
    <div class="card">
      <p class="small">Ein fertiger Trainingsplan: Übungen, Sätze, Wiederholungen, Pausen –
        und zu jeder Übung eine vorgeführte Bewegung, die sich drehen lässt. Trainieren kannst
        du mit <strong>Hanteln</strong> oder als <strong>Bodyweight</strong>-Variante ganz ohne
        Geräte; der Umschalter oben wechselt jederzeit.</p>
      <p class="small">Die App läuft offline und braucht kein Konto. Was du einträgst, bleibt
        auf diesem Gerät – bis du selbst etwas verschickst: Für den Vergleich unter
        <em>Statistik</em> schickst du deinen Stand als Link, und wer ihn bekommt, sieht die
        Zahlen darin. Von allein geht nichts irgendwohin.</p>
    </div>
    <div class="card">
      <div class="lbl">Wie heißt du?</div>
      <div class="hint">Nur für die Anzeige und für den Vergleich mit Freunden.</div>
      <input type="text" id="nameInput" class="name-input" maxlength="24"
             autocomplete="name" placeholder="Dein Name" aria-label="Dein Name">
    </div>`, `
    <div class="card">
      <div class="small muted">Zwei Akzente: der wärmere gilt für die Hantel-Variante, der
        kühlere für Bodyweight. Sonst ändert sich nichts – dunkel bleibt dunkel.</div>
      <div class="farben">
        ${THEMES.map(([key, label, a, bfarbe]) => `
          <button type="button" class="farb-btn ${(s.theme || 'orange') === key ? 'on' : ''}"
                  aria-pressed="${(s.theme || 'orange') === key}" data-act="set-theme" data-v="${key}">
            <span class="farb-punkt" style="--a:${a};--b:${bfarbe}"></span>${label}
          </button>`).join('')}
      </div>
    </div>`, `
    <div class="card">
      <div class="small muted">Die Startgewichte des Plans stammen von jemandem, der seit einer
        Weile trainiert. Damit die erste Einheit etwas taugt, rechnen wir sie auf dich um –
        Sätze, Pausen und Übungen bleiben gleich, und ändern kannst du jedes Gewicht sowieso
        selbst.</div>
      <div class="fokus-liste">
        ${LEVELS.map(([key, name, hint, faktor]) => `
          <button type="button" class="fokus-btn ${(s.level || 'geuebt') === key ? 'on' : ''}"
                  aria-pressed="${(s.level || 'geuebt') === key}" data-act="set-level" data-v="${key}">
            <span class="lbl">${esc(name)}${(s.level || 'geuebt') === key ? ' ✓' : ''}</span>
            <span class="hint">${esc(hint)}</span>
            <span class="fokus-zahl">${esc(levelBeispiel(faktor))}</span>
          </button>`).join('')}
      </div>
    </div>`, `
    <div class="card">
      <div class="small muted">Jeder Fokus ist ein eigener, durchgerechneter Plan: dieselbe
        Rechnung, dieselbe Erholungsregel, andere Schwerpunkte. Später änderbar.</div>
      <div class="fokus-liste">${fokusKarten(s.focus || 'standard')}</div>
    </div>
    ${shareKarte()}
    <p class="small muted">Und wenn nichts davon passt: Unter <em>Mehr → Eigenes Workout</em>
      stellst du dir jede Einheit selbst zusammen, aus demselben Übungsvorrat.</p>`];

  view.innerHTML = `
    <section class="ov welcome">
      ${kopf}
      ${seiten[schritt]}
      <div class="btn-row nav">
        ${schritt ? '<button type="button" class="btn btn-ghost" data-act="setup-back">← Zurück</button>' : ''}
        <button type="button" class="btn btn-primary" data-act="setup-next">
          ${schritt === SETUP_LETZTER ? 'Los geht’s' : 'Weiter →'}
        </button>
      </div>
      ${schritt === 0 ? `<p class="small muted">Tipp: „Zum Startbildschirm hinzufügen" macht
        daraus ein eigenes Symbol, das ohne Browserleiste startet.</p>` : ''}
    </section>`;

  const feld = document.getElementById('nameInput');
  if (feld) {
    feld.value = store.getState().name || '';
    feld.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); setupWeiter(); }
    });
  }
}

/** Ein Schritt weiter im Einstieg – im letzten Schritt ist es der Abschluss. */
function setupWeiter() {
  const feld = document.getElementById('nameInput');
  if (feld) store.setSetting('name', feld.value.trim().slice(0, 24));
  if ((ui.setupStep || 0) < SETUP_LETZTER) {
    ui.setupStep = (ui.setupStep || 0) + 1;
    render();
    window.scrollTo({ top: 0 });
    return;
  }
  willkommenFertig();
}

function willkommenFertig() {
  const name = store.getState().name;
  store.setSetting('greeted', true);
  // Kam der Link mit einem Stand, ist die Rückfrage danach überflüssig: Wer den
  // Link von jemandem bekommt, will genau dessen Zahlen sehen.
  if (ui.standAngebot) {
    store.setFriend(freundId(ui.standAngebot.n), ui.standAngebot);
    ui.standAngebot = null;
  }
  render();
  // Jetzt erst: Der Satz mit dem Schalter stand im letzten Schritt, und der
  // Schalter stand daneben.
  meldeStand(true);
  toast(name ? `Los geht’s, ${name} 💪` : 'Los geht’s 💪');
}

/* ------------------------------------------------------------------ *
 * Rückkanal
 *
 * Ohne Eintrag in js/config.js gibt es ihn nicht: keine Frage, kein Schalter,
 * keine Verbindung. Mit Eintrag meldet jedes Gerät einmal am Tag denselben
 * Stand, der auch im Vergleich steht, plus Sätze je Übung – damit der Betreiber
 * sieht, wie die App bei den Leuten läuft, denen er den Link geschickt hat.
 *
 * Was hier *nicht* passiert: heimlich sammeln. Der Einstieg sagt in einem Satz,
 * was rausgeht und an wen, mit dem Schalter daneben; unter Mehr steht dasselbe
 * noch einmal, mitsamt dem Zeitpunkt der letzten Meldung und einem Knopf, der
 * die eigene Zeile wieder löscht.
 * ------------------------------------------------------------------ */

/**
 * Was die Antwort des Servers bedeutet, in einem Satz.
 *
 * Der Wortlaut von PostgREST ist genau, aber nur für den lesbar, der ihn schon
 * kennt. Wer die App gerade einrichtet, soll den nächsten Schritt lesen können,
 * ohne die README zu suchen.
 */
function serverHinweis(msg) {
  const m = String(msg || '');
  if (/row-level security|violates row/i.test(m)) {
    return 'Die Tabelle nimmt die Zeile nicht an – die Regeln greifen nicht für die '
      + 'anonyme Rolle. Einmal den SQL-Block aus der README ausführen: Danach läuft '
      + 'das Schreiben über eine Funktion und hängt an keiner Regel mehr.';
  }
  if (/permission denied for function/i.test(m)) {
    return 'Der Funktion melde fehlt das Ausführungsrecht: grant execute … to anon.';
  }
  // Reihenfolge zählt: PostgREST schreibt in alle drei Fällen "schema cache",
  // der Code dahinter trennt sie. Erst der genaue, dann der allgemeine Fall.
  if (/PGRST204/i.test(m)) {
    return 'Der Tabelle fehlt eine Spalte – den Block aus der README noch einmal ausführen.';
  }
  if (/PGRST205/i.test(m)) {
    return 'Die Tabelle nutzung gibt es dort nicht.';
  }
  if (/PGRST202|function.*(does not exist|not found)|Could not find the function/i.test(m)) {
    return 'Die Funktion melde gibt es dort nicht – der SQL-Block aus der README ist '
      + 'nicht (vollständig) gelaufen. Direkt danach kann es auch heißen: ein paar '
      + 'Sekunden warten, der Server kennt sie noch nicht.';
  }
  if (/invalid api key|JWS|JWT|apikey/i.test(m)) {
    return 'Der Schlüssel in js/config.js gehört nicht zu diesem Projekt.';
  }
  if (/^\s*404|Not Found/i.test(m)) {
    return 'Unter dieser Adresse antwortet weder die Funktion noch die Tabelle – '
      + 'die Projekt-Adresse in js/config.js prüfen.';
  }
  if (/column|Spalte/i.test(m)) {
    return 'Der Tabelle fehlt eine Spalte – den Block aus der README noch einmal ausführen.';
  }
  if (/Keine Verbindung/i.test(m)) {
    return 'Kein Netz – oder die Projekt-Adresse in js/config.js stimmt nicht.';
  }
  return '';
}

/**
 * Der eine Satz, der aus Sammeln eine Absprache macht.
 *
 * Er steht im Einstieg und unter Mehr, wortgleich, mit dem Schalter daneben.
 * Ohne Server in js/config.js gibt es ihn nicht – dann gibt es auch nichts zu
 * erlauben.
 */
function shareKarte(ausfuehrlich = false) {
  if (!hatServer()) return '';
  const s = store.getState();
  const an = s.share !== false;
  return `
    <div class="card">
      <div class="switch-row">
        <div>
          <div class="lbl">Nutzung mit ${esc(CONFIG.betreiber)} teilen</div>
          <div class="hint">Einmal am Tag gehen dein Name, dein Trainingsfokus, deine
            Erfahrungsstufe und dein Fortschritt an ${esc(CONFIG.betreiber)} – Einheiten,
            Sätze, Volumen, Serie, wann du zuletzt trainiert hast, welche Übungen wie oft
            vorkamen, wie oft du den Link weitergeschickt hast und wie viele Stände von
            Freunden du übernommen hast. Dazu eine Zufallszahl, an der dein Gerät
            wiedererkannt wird. Er hat die App gebaut und sieht daran, ob sie benutzt wird
            und was hakt. Sonst geht nichts raus: keine Uhrzeiten, keine Adressen, nichts
            von außerhalb dieser App.</div>
        </div>
        <button type="button" class="toggle" aria-pressed="${an}" data-act="toggle-share"
                aria-label="Nutzung teilen"></button>
      </div>
      ${ausfuehrlich ? `
      <div class="small muted">${s.lastShare
        ? `Zuletzt gemeldet am ${esc(fmtDate(s.lastShare.on))}${s.lastShare.ok ? '' : ' – hat nicht geklappt'}.`
        : 'Noch nichts gemeldet.'}
        ${an ? '' : 'Abgeschaltet – es geht nichts mehr raus.'}</div>
      ${s.lastShare && !s.lastShare.ok && s.lastShare.msg ? `
      <div class="hint" style="color:var(--accent)">Der Server sagt: ${esc(s.lastShare.msg)}</div>
      ${serverHinweis(s.lastShare.msg) ? `<div class="hint">${esc(serverHinweis(s.lastShare.msg))}</div>` : ''}` : ''}
      <div class="btn-row">
        <button type="button" class="btn" data-act="share-now">Jetzt melden</button>
        <button type="button" class="btn" data-act="share-delete">Meine Daten dort löschen</button>
      </div>` : ''}
    </div>`;
}

/** Meldet dieses Gerät gerade? Nur mit Server und nur mit Zustimmung. */
const meldetMit = () => hatServer() && store.getState().share !== false;

function standZeile() {
  const st = sammleStats();
  const zuletzt = PLAN.filter((w) => completedMode(w.n)).map((w) => effDate(w)).sort();
  const proUebung = {};
  st.perEx.forEach((anzahl, id) => { proUebung[id] = anzahl; });
  return {
    id: store.getState().deviceId,
    name: store.getState().name || 'Ohne Namen',
    fokus: FOCUS.name,
    stufe: (LEVELS.find(([k]) => k === (store.getState().level || 'geuebt')) || [])[1] || '',
    einheiten: st.workoutsDone,
    plan: PLAN.length,
    saetze: st.setsDone,
    volumen: Math.round(st.volume),
    serie: st.streak,
    zuletzt: zuletzt.length ? zuletzt[zuletzt.length - 1] : null,
    geteilt: store.getState().shareCount || 0,
    freunde: Object.keys(store.getState().friends || {}).length,
    uebungen: proUebung,
    // Kein Zeitstempel: "keine Uhrzeiten" steht so im Einwilligungstext. Wann
    // zuletzt gemeldet wurde, hält der Server als Datum fest – auf den Tag
    // genau, mehr braucht die Übersicht nicht.
  };
}

/**
 * Einmal am Tag melden, im Hintergrund, ohne die App aufzuhalten.
 *
 * Öfter bringt nichts: Die Zahlen ändern sich pro Einheit, nicht pro Minute.
 * Nach einem abgeschlossenen Training wird zusätzlich gemeldet (`sofort`),
 * damit die Übersicht nicht einen Tag hinterherhinkt.
 */
function meldeStand(sofort = false) {
  if (!meldetMit()) return;
  // Wer den Einstieg noch vor sich hat, hat den Satz mit dem Schalter noch
  // nicht gelesen. Vorher etwas zu schicken, wäre genau das, was der Satz
  // ausschließt – auch wenn es nur "Gerät eingerichtet" wäre.
  if (needsWelcome()) return;
  const s = store.getState();
  // Einmal am Tag – aber nur, wenn es auch geklappt hat. Ein Fehlversuch am
  // Morgen sperrte den Rest des Tages: Wer den Server repariert, sah bis zum
  // nächsten Tag nichts davon.
  if (!sofort && s.lastShare && s.lastShare.on === todayISO() && s.lastShare.ok) return;
  if (!s.deviceId) store.setSetting('deviceId', geraeteId(null));
  melden(standZeile()).then(({ ok, msg }) => {
    store.setSetting('lastShare', { on: todayISO(), ok, msg: ok ? '' : msg });
    // Nur neu zeichnen, wo das Ergebnis auch steht – mitten im Training wäre
    // ein Neuaufbau der Seite eine Zumutung.
    if (ui.tab === 'settings') render();
  });
}

/* ------------------------------------------------------------------ *
 * Vergleich mit Freunden
 *
 * Ohne Server. Es gibt keine Konten, keine Anmeldung und nichts, was im
 * Hintergrund abgleicht – die App liegt als statische Seite auf GitHub Pages
 * und soll dort auch bleiben.
 *
 * Stattdessen schickt man seinen Stand als Link: Ein paar Zahlen (Einheiten,
 * Sätze, Volumen, Serie) wandern base64-kodiert im Anker der Adresse mit. Wer
 * ihn öffnet, bekommt die Rückfrage "übernehmen?" und hat den Stand danach
 * lokal gespeichert. Der Vergleich in der Statistik zeigt also immer den Stand,
 * den der andere zuletzt geschickt hat – mit Datum daneben, damit niemand einen
 * drei Wochen alten Wert für aktuell hält.
 *
 * Das ist der ehrliche Umfang dessen, was ohne Server geht, und es reicht für
 * das, worum es geht: zu sehen, wer gerade vorn liegt.
 * ------------------------------------------------------------------ */

const STAND_VERSION = 1;

function meinStand() {
  const st = sammleStats();
  const zuletzt = PLAN.filter((w) => completedMode(w.n)).map((w) => effDate(w)).sort();
  return {
    v: STAND_VERSION,
    n: store.getState().name || 'Ohne Namen',
    w: st.workoutsDone,
    s: st.setsDone,
    kg: Math.round(st.volume),
    r: st.streak,
    p: PLAN.length,
    d: todayISO(),
    // Fokus und letztes Training kommen mit, seit der Vergleich mehr sein soll
    // als eine Rangliste: Wer Bauch/Beine/Po macht, hat andere Zahlen als wer
    // Oberkörper macht, und "seit drei Wochen nichts" ist die interessanteste
    // Zeile überhaupt.
    f: FOCUS.name,
    z: zuletzt.length ? zuletzt[zuletzt.length - 1] : null,
  };
}

/** JSON -> base64url. Umlaute im Namen überleben das nur über UTF-8. */
function codeVon(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let roh = '';
  bytes.forEach((b) => { roh += String.fromCharCode(b); });
  return btoa(roh).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function codeZu(code) {
  try {
    const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
    const roh = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    const bytes = Uint8Array.from(roh, (c) => c.charCodeAt(0));
    const obj = JSON.parse(new TextDecoder().decode(bytes));
    return obj && obj.v === STAND_VERSION && typeof obj.n === 'string' ? obj : null;
  } catch {
    return null;
  }
}

const standLink = () => `${appURL()}#stand=${codeVon(meinStand())}`;

/**
 * Stand aus der Adresse lesen – und den Anker sofort entfernen.
 *
 * Sonst steht er beim nächsten Neuladen wieder da, und die Frage "übernehmen?"
 * käme nach dem Übernehmen erneut. replaceState statt pushState: Der Anker soll
 * auch keinen Eintrag im Verlauf hinterlassen, sonst führt die Zurück-Taste
 * wieder hinein.
 */
function standAusAdresse() {
  const treffer = /[#&]stand=([A-Za-z0-9_-]+)/.exec(location.hash);
  if (!treffer) return null;
  history.replaceState(history.state, '', location.pathname + location.search);
  return codeZu(treffer[1]);
}

/** Kurzschlüssel eines Freundes: gleicher Name, gleicher Eintrag. */
const freundId = (name) => name.trim().toLowerCase().slice(0, 24);

/** Adresse der App zum Weitergeben – ohne Anker und ohne Suchteil. */
function appURL() {
  const u = new URL(location.href);
  u.hash = '';
  u.search = '';
  return u.href.replace(/index\.html$/, '');
}

const SHARE_TEXT = 'Mein Trainingsplan als App: 84 Einheiten, mit Hanteln oder ohne, '
  + 'mit vorgeführten Bewegungen und Pausentimer. Läuft im Browser, offline, ohne Konto.';

function renderDashboard() {
  const n = ui.workoutNo;
  const w = workoutByNo(n);
  const mode = store.workoutMode(n);
  const prog = progressOf(n, mode);
  const today = todayISO();
  const date = effDate(w);
  const diff = daysBetween(today, date);
  const shift = store.getState().shift;
  const sess = store.getState().session;
  const session = sess && sess.n === n ? sess : null;

  let when;
  if (diff === 0) when = 'Heute';
  else if (diff === 1) when = 'Morgen';
  else if (diff === -1) when = 'Gestern';
  else if (diff > 1) when = `in ${diff} Tagen`;
  else when = `vor ${-diff} Tagen`;

  const items = w.ex.map((item) => resolve(item, mode));
  const totalSets = items.reduce((a, x) => a + x.sets, 0);

  const parts = [];

  if (!store.canPersist()) {
    parts.push(`<div class="notice warn">⚠️ Dieser Browser lässt keine Speicherung zu – Eintragungen
      gehen beim Neuladen verloren. Im privaten Modus oder in einer eingebetteten Ansicht?
      Dann die Seite direkt im Browser öffnen.</div>`);
  }

  parts.push(`
    <section class="card">
      <div class="hero-eyebrow">${w.custom ? 'Eigenes Workout' : `${esc(when)} · Workout ${w.n} von ${PLAN.length}`}</div>
      <h2 class="hero-title">${w.custom ? esc(w.name) : esc(fmtDate(date, true))}</h2>
      <div class="hero-sub">${MODE_LABEL[mode]} · ${items.length} Übungen · ${totalSets} Sätze</div>
      <div class="hero-badges">
        <span class="badge accent">${mode === 'db' ? '🏋️ Hantel-Variante' : '🤸 Bodyweight-Variante'}</span>
        ${prog.complete ? '<span class="badge done">✓ Abgeschlossen</span>'
                        : `<span class="badge">${prog.done}/${prog.total} Sätze</span>`}
        ${shift ? `<span class="badge" title="Ursprünglich ${esc(fmtDate(w.date))}">↷ Plan ${shift > 0 ? '+' : '−'}${esc(plural(Math.abs(shift), 'Tag', 'Tage'))}</span>` : ''}
        ${session ? '<span class="badge accent" id="sessionBadge">⏱ läuft</span>' : ''}
      </div>
      <div class="progress"><i style="width:${prog.pct}%"></i></div>
      ${session
        ? sessionButtons(n, mode)
        : `<div class="btn-row">
             <button type="button" class="btn btn-primary btn-block" data-act="start-session">▶︎ Workout starten</button>
           </div>`}
      ${startTodayRow(n)}
      <div class="btn-row nav">
        <button type="button" class="btn btn-ghost" data-act="nav-workout" data-delta="-1" ${w.custom || n === PLAN[0].n ? 'disabled' : ''}>← Vorheriges</button>
        <button type="button" class="btn btn-ghost" data-act="nav-today">Heute</button>
        <button type="button" class="btn btn-ghost" data-act="nav-workout" data-delta="1" ${w.custom || n === PLAN[PLAN.length - 1].n ? 'disabled' : ''}>Nächstes →</button>
      </div>
    </section>
  `);

  parts.push(`<div class="focus-top">
      <button type="button" class="back-link" data-act="${store.getState().session ? 'focus-back' : 'hide-list'}">‹ Zurück</button>
      <span class="focus-count">${w.ex.length} Übungen · ${prog.done}/${prog.total} Sätze</span>
    </div>`);

  items.forEach((it, i) => {
    const sets = store.getSets(n, mode, it.id, it.sets);
    const doneCount = sets.filter((s) => s.done).length;
    const open = ui.openEx.has(it.id);
    const complete = doneCount === it.sets;
    const prev = lastLoggedFor(it.id, mode, n);

    // Satz-Knöpfe liegen bewusst außerhalb des aufklappbaren Bereichs: Abhaken
    // ist der eine Handgriff, der zwischen zwei Sätzen schnell gehen muss.
    const setBtns = sets.map((s, idx) => `
      <button type="button" class="set-btn ${s.done ? 'on' : ''}" aria-pressed="${s.done}"
              aria-label="Satz ${idx + 1} von ${it.sets} erledigt"
              data-act="toggle-set" data-ex="${it.id}" data-i="${idx}">${s.done ? '✓' : idx + 1}</button>
    `).join('');

    // Gewichtszeile: ein Arbeitsgewicht je Übung, nicht je Satz. Die Erhöhung
    // gilt ab dem nächsten Mal, sobald heute schon ein Satz steht. Wie groß
    // ein Schritt ist, hängt an der Übung – siehe stepOf().
    const kg = it.weight === null ? null : workingWeight(it.id);
    const anders = it.weight === null ? '' : doneWeightNote(n, mode, it.id);
    const weightRow = kg === null ? bandRow(it) : `
      <div class="ex-weight">
        <button type="button" class="kg-step" data-act="weight-step" data-ex="${it.id}" data-d="${-stepOf(it.id)}"
                aria-label="${esc(fmtNum(stepOf(it.id)))} Kilo weniger">−</button>
        <div class="kg-main">
          <input type="text" inputmode="decimal" class="kg-val" value="${fmtNum(kg)}"
                 data-act="weight-input" data-ex="${it.id}" aria-label="Gewicht ${esc(it.name)} in Kilo">
          <span class="kg-unit">kg${it.weightNote ? ` · ${esc(it.weightNote)}` : ''}</span>
        </div>
        <button type="button" class="kg-step kg-plus" data-act="weight-step" data-ex="${it.id}" data-d="${stepOf(it.id)}"
                aria-label="${esc(fmtNum(stepOf(it.id)))} Kilo mehr">+</button>
      </div>
      ${anders ? `<div class="kg-next">${esc(anders)}</div>` : bumpChip(it.id, mode)}`;

    // Im Bodyweight-Modus gibt es kein Gewicht – dort ist die Steigerung die
    // Wiederholungszahl. Den *neuen* Bereich zeigen, nicht den alten mit einem
    // Plus dahinter – sonst muss man beim Lesen selbst rechnen.
    const bwZiel = String(it.reps).replace(/\d+/g, (d) => String(Number(d) + store.bwPlusOf(it.id) + 2));
    const bwChip = mode === 'bw' && bwBump(it.id)
      ? `<button type="button" class="kg-bump" data-act="bw-bump" data-ex="${it.id}">
           2× komplett · nächstes Mal ${esc(bwZiel)} Wdh.?
         </button>`
      : '';

    parts.push(`
      <article class="ex ${open ? 'open' : ''} ${complete ? 'complete' : ''}">
        <div class="ex-head" data-act="toggle-ex" data-ex="${it.id}" role="button" tabindex="0" aria-expanded="${open}">
          <span class="ex-idx">${complete ? '✓' : i + 1}</span>
          <span class="ex-main">
            <span class="ex-name">${esc(it.name)}</span>
            <span class="ex-meta">${it.sets} × ${esc(repsLabel(it, mode))} · ${esc(it.group)} · ${esc(it.equip)}</span>
          </span>
          <span class="ex-right"><span class="chev">▼</span></span>
        </div>
        ${weightRow}
        ${bwChip}
        <div class="ex-sets">${setBtns}</div>
        <div class="ex-body">
          ${open ? `<div class="ex-fig" data-pattern="${esc(it.pattern)}"
               data-weight="${it.weight !== null}" data-gear="${esc(it.gear || '')}"></div>` : ''}
          <div class="cue">${esc(it.cue)}</div>
          ${detailBlock(it)}
          <div class="ex-facts">
            <span>Pause ${Math.floor(restFor(it) / 60)}:${String(restFor(it) % 60).padStart(2, '0')} min</span>
            <span>${it.sets} Sätze × ${esc(it.reps)} Wdh.</span>
            <span>${esc(it.equip)}</span>
          </div>
          ${prev ? `<div class="last-time">Zuletzt (Workout ${prev.n}): ${esc(prev.text)}</div>` : ''}
        </div>
      </article>
    `);
  });

  parts.push(careBlock(n));
  parts.push(`
    <div class="btn-row">
      <button type="button" class="btn btn-primary" data-act="complete-workout">Alle Sätze abhaken</button>
      <button type="button" class="btn btn-danger" data-act="reset-workout">Zurücksetzen</button>
    </div>
    <p class="small muted" style="margin-top:14px">
      Der Umschalter oben wechselt zwischen der Hantel-Variante aus dem Plan und dem
      Bodyweight-Äquivalent. Beide Varianten werden getrennt protokolliert.
    </p>
    ${injuryNote(w, mode)}
  `);

  view.innerHTML = parts.join('');

  // Die Figur erst nach dem Einhängen montieren – sie misst ihren Platz und
  // hängt Listener fürs Drehen an. Nur aufgeklappte Karten bekommen eine:
  // eine Animation je Übung im Hintergrund wäre Rechenzeit für nichts.
  view.querySelectorAll('.ex-fig').forEach((host) => {
    mountFigure(host, host.dataset.pattern, host.dataset.weight === 'true', host.dataset.gear || null);
  });
}

/** Letzter protokollierter Eintrag derselben Übung im selben Modus. */
function lastLoggedFor(exId, mode, beforeN) {
  for (let i = PLAN.length - 1; i >= 0; i--) {
    const w = PLAN[i];
    if (w.n >= beforeN) continue;
    const item = exOf(w).find((x) => x.id === exId);
    if (!item) continue;
    const arr = store.peekSets(w.n, mode, exId);
    if (!arr) continue;
    const filled = arr.filter((s) => s.w !== '');
    if (!filled.length) continue;
    return { n: w.n, text: filled.map((s) => s.w).join(' · ') };
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Statistik
 * ------------------------------------------------------------------ */

/**
 * Zeitreihen aus dem Protokoll: je Übung das benutzte Gewicht, je
 * Muskelgruppe das Volumen (Gewicht × geplante Wdh. × Sätze) einer Einheit.
 *
 * Nur abgehakte Sätze zählen, und nur die Hantel-Variante trägt Kilo bei –
 * Bodyweight-Einheiten haben schlicht kein Gewicht, das man summieren könnte.
 */
function progressSeries() {
  const perExercise = new Map();
  const perMuscle = new Map();

  PLAN.forEach((w) => {
    const day = fmtDate(effDate(w));
    const muscleDay = new Map();

    exOf(w).forEach((item) => {
      const arr = store.peekSets(w.n, 'db', item.id);
      if (!arr) return;
      const done = arr.slice(0, item.sets).filter((x) => x.done && x.w !== '');
      if (!done.length) return;

      const kg = parseFloat(String(done[0].w).replace(',', '.'));
      if (Number.isNaN(kg) || kg <= 0) return;

      const ex = EX_BY_ID.get(item.id);
      if (!perExercise.has(item.id)) perExercise.set(item.id, []);
      perExercise.get(item.id).push({ label: day, value: kg });

      const vol = kg * plannedReps(ex.db.reps) * done.length;
      ex.db.muscles.forEach((m) => muscleDay.set(m, (muscleDay.get(m) || 0) + vol));
    });

    muscleDay.forEach((vol, m) => {
      if (!perMuscle.has(m)) perMuscle.set(m, []);
      perMuscle.get(m).push({ label: day, value: vol });
    });
  });

  return { perExercise, perMuscle };
}

/**
 * Die Zahlen der Statistik an einer Stelle.
 *
 * Ausgelagert, weil sie zweimal gebraucht werden: für den Statistik-Tab und
 * für den Stand, den man Freunden schickt. Zwei Rechnungen für dieselbe Zahl
 * wären zwei Zahlen.
 */
function sammleStats() {
  const log = store.getState().log;
  const today = todayISO();

  let setsDone = 0;
  let repsTotal = 0;
  let volume = 0;
  let doneDb = 0;
  let doneBw = 0;
  const perEx = new Map();

  PLAN.forEach((w) => {
    const entry = log[w.n];
    if (!entry) return;
    ['db', 'bw'].forEach((m) => {
      exOf(w).forEach((item) => {
        const arr = entry[m] && entry[m][item.id];
        if (!Array.isArray(arr)) return;
        // Wiederholungen werden nicht mehr erfasst; gerechnet wird deshalb mit
        // dem geplanten Wert – der unteren Grenze des Bereichs, also bewusst
        // eher zu niedrig als zu hoch.
        const planned = plannedReps(EX_BY_ID.get(item.id)[m].reps);
        arr.forEach((s) => {
          if (!s.done) return;
          setsDone++;
          repsTotal += planned;
          const kg = parseFloat(String(s.w).replace(',', '.'));
          if (m === 'db' && !Number.isNaN(kg)) volume += kg * planned;
          perEx.set(item.id, (perEx.get(item.id) || 0) + 1);
        });
      });
    });
    const cm = completedMode(w.n);
    if (cm === 'db') doneDb++;
    else if (cm === 'bw') doneBw++;
  });

  const workoutsDone = doneDb + doneBw;

  // Aktuelle Serie: rückwärts ab dem letzten fälligen Workout
  let streak = 0;
  const past = PLAN.filter((w) => effDate(w) <= today);
  for (let i = past.length - 1; i >= 0; i--) {
    if (completedMode(past[i].n)) streak++;
    else break;
  }

  // Eigene Einheiten zählen nicht als Plan-Einheit, ihre Sätze und Kilo aber
  // schon: Trainiert ist trainiert, und eine Statistik, die das verschweigt,
  // ist falsch.
  let customSets = 0;
  store.customs().forEach((c) => {
    const entry = log[c.id];
    if (!entry) return;
    ['db', 'bw'].forEach((m) => {
      c.ex.forEach((item) => {
        const arr = entry[m] && entry[m][item.id];
        const ex = EX_BY_ID.get(item.id);
        if (!Array.isArray(arr) || !ex) return;
        const planned = plannedReps(ex[m].reps);
        arr.slice(0, item.sets).forEach((x) => {
          if (!x.done) return;
          setsDone++;
          customSets++;
          repsTotal += planned;
          const kg = parseFloat(String(x.w).replace(',', '.'));
          if (m === 'db' && !Number.isNaN(kg)) volume += kg * planned;
          perEx.set(item.id, (perEx.get(item.id) || 0) + 1);
        });
      });
    });
  });

  const upcoming = PLAN.find((w) => !completedMode(w.n));
  return { setsDone, repsTotal, volume, doneDb, doneBw, perEx, workoutsDone, streak, upcoming,
           customSets };
}

/**
 * Vergleich mit den Freunden, die einem ihren Stand geschickt haben.
 *
 * Sortiert nach erledigten Einheiten. Beim eigenen Eintrag steht "du", bei den
 * anderen, wie alt ihr Stand ist – ohne das hielte man einen drei Wochen alten
 * Wert für den heutigen.
 */
function vergleichKarte() {
  const ich = meinStand();
  const freunde = Object.entries(store.getState().friends || {})
    .map(([id, f]) => ({ id, ...f }));
  const alle = [{ id: null, ...ich }, ...freunde].sort((a, b) => b.w - a.w || b.s - a.s);

  return `
    <div class="section-title">Vergleich</div>
    <div class="card">
      ${ui.standZurueck ? `<div class="notice" style="margin:0 0 10px">
        ↩︎ ${esc(ui.standZurueck)} sieht deinen Stand erst, wenn du ihn zurückschickst.
        <div class="btn-row nav" style="margin-top:8px">
          <button type="button" class="btn btn-primary" data-act="share-stand">Zurückschicken</button>
          <button type="button" class="btn btn-ghost" data-act="drop-zurueck">Später</button>
        </div></div>` : ''}
      ${freunde.length ? `
      <table class="vgl">
        <thead><tr><th></th><th>Name</th><th>Einheiten</th><th>Sätze</th><th>Serie</th><th></th></tr></thead>
        <tbody>${alle.map((f, i) => `
          <tr class="${f.id === null ? 'ich' : ''}">
            <td class="vgl-rang">${i + 1}</td>
            <td>${esc(f.n)}${f.id === null ? ' <span class="muted">(du)</span>' : ''}
              <div class="small muted">${esc([
                f.f || '', letztesTraining(f), f.id === null ? '' : standAlter(f),
              ].filter(Boolean).join(' · '))}</div></td>
            <td><b>${f.w}</b><span class="muted">/${f.p}</span></td>
            <td>${f.s}</td>
            <td>${f.r}</td>
            <td>${f.id === null ? '' : `<button type="button" class="vgl-weg" data-act="remove-friend"
                   data-id="${esc(f.id)}" aria-label="${esc(f.n)} entfernen">✕</button>`}</td>
          </tr>`).join('')}</tbody>
      </table>` : `
      <div class="small muted">Noch niemand im Vergleich. Schick jemandem deinen Stand –
        wer den Link öffnet, hat dich danach in seiner Liste stehen und kann seinen
        zurückschicken.</div>`}
      <div class="btn-row">
        <button type="button" class="btn btn-primary btn-block" data-act="share-stand">Meinen Stand schicken</button>
      </div>
      <div class="small muted">Kein Konto, kein Server: Der Stand steckt im Link selbst.
        Was hier steht, ist der Stand vom Tag, an dem er geschickt wurde – aktueller
        wird er erst, wenn der andere einen neuen schickt.</div>
    </div>`;
}

/** Wann zuletzt trainiert wurde – die interessanteste Zeile im Vergleich. */
function letztesTraining(f) {
  if (!f.z) return 'noch nicht angefangen';
  const tage = daysBetween(f.z, todayISO());
  if (tage <= 0) return 'heute trainiert';
  if (tage === 1) return 'gestern trainiert';
  return `zuletzt vor ${tage} Tagen`;
}

/** Wie alt der geschickte Stand ist. */
function standAlter(f) {
  const tage = daysBetween(f.am || f.d, todayISO());
  if (tage <= 0) return 'Stand von heute';
  if (tage === 1) return 'Stand von gestern';
  return `Stand von vor ${tage} Tagen`;
}

function renderStats() {
  const { setsDone, repsTotal, volume, doneDb, doneBw, perEx, workoutsDone, streak,
          upcoming, customSets } = sammleStats();

  const topEx = [...perEx.entries()]
    .map(([id, c]) => ({ ex: EX_BY_ID.get(id), c }))
    .sort((a, b) => b.c - a.c)
    .slice(0, 8);
  const max = topEx.length ? topEx[0].c : 1;

  view.innerHTML = `
    <div class="section-title">Überblick</div>
    <div class="stat-grid">
      <div class="stat"><div class="stat-v">${workoutsDone}<span class="muted" style="font-size:15px">/${PLAN.length}</span></div><div class="stat-l">Workouts erledigt</div></div>
      <div class="stat"><div class="stat-v">${streak}</div><div class="stat-l">Serie in Folge</div></div>
      <div class="stat"><div class="stat-v">${setsDone}</div><div class="stat-l">Sätze abgehakt${
        customSets ? ` <span class="muted">(${customSets} eigene)</span>` : ''}</div></div>
      <div class="stat"><div class="stat-v">${repsTotal ? `ca. ${Math.round(repsTotal)}` : '–'}</div><div class="stat-l">Wiederholungen (geplant)</div></div>
      <div class="stat"><div class="stat-v">${volume ? `ca. ${Math.round(volume).toLocaleString('de-DE')}` : '–'}</div><div class="stat-l">Volumen kg (Hanteln)</div></div>
      <div class="stat"><div class="stat-v">🏋️ ${doneDb} · 🤸 ${doneBw}</div><div class="stat-l">Modus-Verteilung</div></div>
      ${store.getState().rounds.length
        ? `<div class="stat"><div class="stat-v">${store.getState().rounds.length}</div><div class="stat-l">Runden abgeschlossen</div></div>` : ''}
    </div>

    ${vergleichKarte()}

    <div class="section-title">Nächste Einheit</div>
    <div class="card">
      ${upcoming
        ? `<div class="plan-date">Workout ${upcoming.n} · ${esc(fmtDate(effDate(upcoming), true))}</div>
           <div class="small muted" style="margin-top:4px">${esc(exOf(upcoming).map((i) => resolve(i, store.workoutMode(upcoming.n)).name).join(' · '))}</div>
           <div class="btn-row"><button type="button" class="btn btn-primary" data-act="open-workout" data-n="${upcoming.n}">Öffnen</button></div>`
        : '<div class="muted">Alle Einheiten des Plans sind abgeschlossen. Stark.</div>'}
    </div>

    <div class="section-title">Wochenvolumen</div>
    <div id="volWeek"></div>

    <div class="section-title">Gewicht je Übung</div>
    <div class="spark-grid" id="sparkEx"></div>

    <div class="section-title">Volumen je Muskelgruppe</div>
    <div class="spark-grid" id="sparkMus"></div>

    <div class="section-title">Meist trainierte Übungen</div>
    <div class="card">
      ${topEx.length ? `<div class="bars">${topEx.map((t) => `
        <div class="bar-row">
          <div>
            <div class="bar-name">${esc(t.ex.db.name)} <span class="muted">/ ${esc(t.ex.bw.name)}</span></div>
            <div class="bar-track"><i style="width:${Math.round((t.c / max) * 100)}%"></i></div>
          </div>
          <div class="bar-val">${t.c}</div>
        </div>`).join('')}</div>`
        : '<div class="muted small">Noch keine Sätze protokolliert – hak im Dashboard den ersten Satz ab.</div>'}
    </div>
  `;

  const { perExercise, perMuscle } = progressSeries();
  const kgFmt = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ','));

  const fill = (id, entries, label, unit, fmt, empty) => {
    const host = document.getElementById(id);
    if (!host) return;
    if (!entries.length) {
      host.innerHTML = `<div class="card muted small">${empty}</div>`;
      return;
    }
    entries.forEach(([key, points]) => {
      host.appendChild(sparkPanel({ label: label(key), points, unit, fmt }));
    });
  };

  fill('sparkEx',
    [...perExercise.entries()].sort((a, b) => b[1].length - a[1].length),
    (id) => EX_BY_ID.get(id).db.name, 'kg', kgFmt,
    'Sobald du mit Hanteln trainierst, steht hier der Verlauf je Übung.');

  renderWeeklyVolume();

  fill('sparkMus',
    [...perMuscle.entries()].sort((a, b) => b[1].length - a[1].length),
    (m) => MUSCLE_LABEL[m] || m, 'kg', (v) => Math.round(v).toLocaleString('de-DE'),
    'Noch kein Volumen erfasst. Nur Hantel-Einheiten tragen Kilo bei.');
}

/* ------------------------------------------------------------------ *
 * Bandstärke
 *
 * Am Band gibt es kein Gewicht, aber zwei Bänder: gelb ist leicht, rot ist
 * schwer. Genau das ist dort die Steigerung – dieselbe Übung, stärkeres Band –,
 * und ohne eine Stelle dafür stünde bei jeder Bandübung nichts, wo sonst das
 * Arbeitsgewicht steht.
 * ------------------------------------------------------------------ */

const BAENDER = [['gelb', 'Gelb', 'leicht'], ['rot', 'Rot', 'schwer']];

/** Braucht diese Übung ein Band? Steht im Gerätenamen der Variante. */
const amBand = (it) => /band/i.test(it.equip || '');

function bandRow(it) {
  if (!amBand(it)) return '';
  const cur = store.bandOf(it.id);
  return `
    <div class="band-row" role="group" aria-label="Band für ${esc(it.name)}">
      ${BAENDER.map(([key, label, wie]) => `
        <button type="button" class="band-btn band-${key} ${cur === key ? 'on' : ''}"
                aria-pressed="${cur === key}" data-act="set-band" data-ex="${it.id}" data-v="${key}">
          <span class="band-dot"></span>${label}<span class="band-wie">${wie}</span>
        </button>`).join('')}
    </div>`;
}

/**
 * Ausführliche Erklärung zu einer Übung, aufklappbar.
 *
 * Der kurze Hinweis über der Bewegung sagt, was zu tun ist. Alles, was man
 * einmal wissen will und dann nicht mehr – welcher Griff, wie der Aufbau geht,
 * was schiefgeht –, steht hier darunter und nimmt zugeklappt eine Zeile weg.
 */
function detailBlock(it) {
  if (!it.detail || !it.detail.length) return '';
  const offen = ui.openDetail.has(it.id);
  return `
    <button type="button" class="detail-toggle ${offen ? 'on' : ''}" data-act="toggle-detail"
            data-ex="${it.id}" aria-expanded="${offen}">
      ${offen ? 'Weniger' : `Mehr zur Ausführung · ${it.detail.length} Punkte`}
      <span class="chev">▼</span>
    </button>
    ${offen ? `<div class="detail">${it.detail.map(([titel, text]) => `
      <div class="detail-h">${esc(titel)}</div>
      <p>${esc(text)}</p>`).join('')}</div>` : ''}`;
}

/** Wiederholungsbereich um den Bodyweight-Aufschlag verschoben. */
function repsLabel(it, mode) {
  const plus = mode === 'bw' ? store.bwPlusOf(it.id) : 0;
  if (!plus) return it.reps;
  return String(it.reps).replace(/\d+/g, (d) => String(Number(d) + plus));
}

/**
 * Vorschlag im Bodyweight-Modus: mehr Wiederholungen.
 *
 * Bedingung wie bei den Hanteln: die letzten beiden Male vollständig
 * durchgezogen. Vorher musste es zusätzlich zweimal als "ging leicht"
 * beantwortet sein – diese Frage ist raus, und damit hängt die Steigerung nur
 * noch daran, dass alle Sätze standen. Wer eine Übung schwer fand, nimmt den
 * Vorschlag einfach nicht an; er steht als Angebot da, nicht als Anweisung.
 */
function bwBump(exId) {
  let streak = 0;
  for (let i = PLAN.length - 1; i >= 0; i--) {
    const w = PLAN[i];
    const item = exOf(w).find((x) => x.id === exId);
    if (!item) continue;
    const sets = store.peekSets(w.n, 'bw', exId);
    if (!sets || !sets.some((x) => x.done || x.w !== '')) continue;   // siehe bumpHint()
    const complete = sets.length >= item.sets && sets.slice(0, item.sets).every((x) => x.done);
    if (!complete) break;
    streak += 1;
    if (streak >= BUMP_NEEDED) return streak;
  }
  return 0;
}

/* ------------------------------------------------------------------ *
 * Wochenvolumen: Soll gegen Ist
 *
 * Der ganze Plan ist darauf gebaut, dass jede Muskelgruppe ihre Sätze pro
 * Woche bekommt – und genau das war bisher nirgends nachzusehen. Verpasste
 * Einheiten, abgebrochene Trainings und jede angehakte Verletzung verschieben
 * diese Zahl, unsichtbar.
 *
 * Das Ziel ist nicht überall dasselbe: es kommt als TARGET aus den erzeugten
 * Daten, damit hier keine zweite Zahl steht, die von der Rechnung abweichen
 * kann. Im Ziel heißt: keinen ganzen Satz darunter – genau die Grenze, die
 * tools/build-plan.py für die einzelne Woche garantiert. Enger wäre es keine
 * Aussage über das Training, sondern über den Rundungsspielraum des Plans:
 * dessen eigene Wochen weichen um bis zu 0,95 Sätze ab.
 *
 * Gezählt wird, was wirklich abgehakt ist, in beiden Varianten mit den
 * jeweiligen Anteilen. Eine Woche sind WEEK_SESSIONS aufeinanderfolgende
 * Einheiten des Plans – dieselbe Einteilung, mit der tools/build-plan.py
 * rechnet.
 * ------------------------------------------------------------------ */

const WEEK_SESSIONS = 4;
const targetOf = (mus) => TARGET[mus] ?? 10;
/**
 * Im Ziel heißt: mindestens neun Zehntel dessen, was für **diese Woche**
 * geplant war.
 *
 * Vorher stand hier eine feste Toleranz von einem Satz gegen das
 * Wochen*ziel*. Das war zweimal falsch. Erstens ist ein Satz bei den Waden
 * (Ziel 6) ein Sechstel und bei der Brust (12) ein Zwölftel – dieselbe Zahl,
 * ein ganz anderer Anteil. Zweitens ist das Ziel ein Schnitt über den ganzen
 * Plan; die einzelne Woche liegt zwangsläufig darüber oder darunter, seit
 * jede Übung mit drei Sätzen dasteht. Wer alles abgehakt hatte, sah dann
 * trotzdem "8 von 12 Gruppen im Ziel" – ein Vorwurf für die Arithmetik des
 * Plans, nicht für den Nutzer. Verglichen wird deshalb mit dem Pensum der
 * Woche, und das kennt die App aus dem Plan.
 */
const inTarget = (got, soll) => got >= soll * 0.9;

/** Was der Plan für diese Woche vorsieht, je Muskelgruppe – Verletzungen und
 *  Modus eingerechnet, also dieselbe Rechnung wie beim Abhaken. */
function plannedWeek(block) {
  const acc = {};
  block.forEach((w) => {
    const mode = completedMode(w.n) || store.workoutMode(w.n);
    exOf(w).forEach((item) => {
      Object.entries(EX_BY_ID.get(item.id)[mode].shares).forEach(([mus, share]) => {
        acc[mus] = (acc[mus] || 0) + item.sets * share;
      });
    });
  });
  return acc;
}

function weeklyDone() {
  const log = store.getState().log;
  const weeks = [];
  for (let k = 0; k < PLAN.length; k += WEEK_SESSIONS) {
    const block = PLAN.slice(k, k + WEEK_SESSIONS);
    const acc = {};
    let any = false;
    block.forEach((w) => {
      const entry = log[w.n];
      if (!entry) return;
      // Nur eine Variante zählen. Wer mit Hanteln anfängt und im
      // Bodyweight-Modus fertig wird, hat die Sätze einmal gemacht, nicht
      // zweimal – gezählt wird die abgeschlossene Variante, sonst die, in der
      // das Workout gerade steht.
      const m = completedMode(w.n) || store.workoutMode(w.n);
      exOf(w).forEach((item) => {
        const arr = (entry[m] || {})[item.id];
        if (!Array.isArray(arr)) return;
        const done = arr.slice(0, item.sets).filter((x) => x.done).length;
        if (!done) return;
        any = true;
        Object.entries(EX_BY_ID.get(item.id)[m].shares).forEach(([mus, share]) => {
          acc[mus] = (acc[mus] || 0) + done * share;
        });
      });
    });
    weeks.push({ nr: weeks.length + 1, from: block[0], to: block[block.length - 1],
                 acc, soll: plannedWeek(block), any });
  }
  return weeks;
}

/** Balken für eine Muskelgruppe: erreicht gegen das Pensum dieser Woche.
 *
 * Die Zahl daneben nennt beides. Seit die Ziele auseinandergehen, sagt "4,0"
 * für sich genommen nichts mehr – erst "4,0/6" zeigt, dass die Woche steht.
 */
function volumeBar(mus, got, soll) {
  const pct = Math.min(150, (got / soll) * 100);
  const state = inTarget(got, soll) ? 'full' : (got >= soll * 0.6 ? 'part' : 'thin');
  return `
    <div class="vol-row">
      <div class="vol-name">${esc(MUSCLE_LABEL[mus] || mus)}</div>
      <div class="vol-track"><i class="vol-fill ${state}" style="width:${Math.min(100, pct).toFixed(0)}%"></i></div>
      <div class="vol-num">${got.toFixed(1).replace('.', ',')}<span>/${fmtNum(soll)}</span></div>
    </div>`;
}

/** Die Ziele in einem Satz, nach Höhe gruppiert statt zwölfmal aufgezählt. */
function zielText() {
  const byTarget = new Map();
  Object.keys(MUSCLE_LABEL).forEach((m) => {
    const t = targetOf(m);
    byTarget.set(t, (byTarget.get(t) || []).concat(MUSCLE_LABEL[m]));
  });
  return [...byTarget.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([t, ms]) => `${fmtNum(t)}× ${ms.join(', ')}`)
    .join(' · ');
}

function renderWeeklyVolume() {
  const host = document.getElementById('volWeek');
  if (!host) return;
  const weeks = weeklyDone();
  const done = weeks.filter((w) => w.any);
  if (!done.length) {
    host.innerHTML = '<div class="card muted small">Sobald die erste Einheit steht, '
      + 'zeigt sich hier, wie nah du am Wochenziel je Muskelgruppe bist.</div>';
    return;
  }
  // Die zuletzt begonnene Woche ist die interessante – nicht die letzte des Plans.
  const cur = done[done.length - 1];
  const prev = done.length > 1 ? done[done.length - 2] : null;
  const groups = Object.keys(MUSCLE_LABEL);
  // Nicht in Prozent: eine Woche mit 9,5 und 10,5 wären 99 %, obwohl alles
  // stimmt – der Plan selbst schwankt um bis zu einen Satz. Gezählt wird
  // deshalb, wie viele Gruppen ihr Ziel erreicht haben.
  const voll = groups.filter((m) => inTarget(cur.acc[m] || 0, cur.soll[m] || 0)).length;
  const inWoche = PLAN.slice(PLAN.indexOf(cur.from), PLAN.indexOf(cur.to) + 1);
  const offen = inWoche.filter((w) => !completedMode(w.n)).length;

  // Solange die Woche läuft, kann keine Gruppe ihr Ziel erreichen – "0 von 12"
  // stünde dann als Vorwurf da, obwohl nichts versäumt ist. Bis zum Ende der
  // Woche zählt deshalb der Fortschritt in Einheiten, danach das, worum es
  // geht. Die Balken darunter bleiben in beiden Fällen dieselben.
  const kopf = offen
    ? { lbl: `Woche ${cur.nr} · ${inWoche.length - offen} von ${inWoche.length} Einheiten`,
        zahl: inWoche.length - offen, von: inWoche.length }
    : { lbl: `Woche ${cur.nr} · ${plural(voll, 'Gruppe', 'Gruppen')} im Ziel`,
        zahl: voll, von: groups.length };

  host.innerHTML = `
    <div class="card">
      <div class="vol-head">
        <div>
          <div class="lbl">${esc(kopf.lbl)}</div>
          <div class="hint">${esc(fmtDate(effDate(cur.from)))} – ${esc(fmtDate(effDate(cur.to)))}${
            offen ? ` · ${plural(offen, 'Einheit', 'Einheiten')} offen` : ' · abgeschlossen'}</div>
        </div>
        <div class="vol-quote">${kopf.zahl}<span>/${kopf.von}</span></div>
      </div>
      ${groups.map((m) => volumeBar(m, cur.acc[m] || 0, cur.soll[m] || 0)).join('')}
      <div class="small muted" style="margin-top:10px">
        Verglichen wird mit dem, was <b>diese Woche</b> auf dem Plan steht – nicht mit dem
        Wochenziel. Das Ziel ist ein Schnitt über den ganzen Plan (${esc(zielText())},
        Anteile eingerechnet); die einzelne Woche liegt darüber oder darunter, weil jede
        Übung mit drei Sätzen dasteht und sich Sätze nur als Ganzes verschieben lassen.
        ${offen ? 'Bei noch offenen Einheiten ist die Woche naturgemäß unvollständig.' : ''}
        ${prev ? `Woche davor: ${groups.filter((m) => inTarget(prev.acc[m] || 0, prev.soll[m] || 0)).length}
          von ${groups.length} Gruppen im Ziel.` : ''}
      </div>
    </div>`;
}

/* ------------------------------------------------------------------ *
 * Verletzungen
 *
 * Angehakt gilt dauerhaft: der Plan rechnet ab sofort ohne die betroffenen
 * Übungen weiter, bis der Haken wieder weg ist. Was das kostet, steht daneben
 * – ausgerechnet über den ganzen Plan, nicht geschätzt.
 * ------------------------------------------------------------------ */

/** Wochen im Plan, aus den Terminen abgeleitet. */
const PLAN_WEEKS = (() => {
  const span = daysBetween(PLAN[0].date, PLAN[PLAN.length - 1].date);
  // Die letzte Einheit endet nicht am Wochenende: eine Lücke dazurechnen,
  // sonst kommt bei 80 Einheiten in 139 Tagen 19,9 statt 20 heraus.
  return Math.max(1, Math.round((span * PLAN.length) / Math.max(1, PLAN.length - 1) / 7));
})();

/**
 * Ersatz, der wegen einer zweiten Beschwerde nicht greift.
 *
 * Das ist die Wechselwirkung, die sich rechnen lässt: Beschwerde A würde eine
 * Übung durch eine andere ersetzen, Beschwerde B sperrt aber genau die.
 */
function swapConflicts(act) {
  const block = blocked(act);
  const out = [];
  act.forEach((id) => {
    const inj = injuryById(id);
    if (!inj) return;
    Object.entries(inj.swap).forEach(([from, to]) => {
      if (!block.has(from) || !block.has(to)) return;
      const by = act.filter((o) => o !== id && (injuryById(o) || { avoid: [] }).avoid.includes(to));
      if (by.length) out.push({ inj, from, to, by: by.map((o) => injuryById(o).name) });
    });
  });
  return out;
}

/** Kurzfassung fürs Training: was heute anders ist. */
function injuryNote(w, mode) {
  const act = activeInjuries();
  if (!act.length) return '';
  const { dropped, swapped } = injuryNotes(w.n);
  const names = act.map((id) => (injuryById(id) || {}).name).filter(Boolean);
  const nm = (id) => resolve({ id, sets: 0 }, mode).name;
  const lines = [];
  swapped.forEach((s) => lines.push(`${esc(nm(s.from))} → ${esc(nm(s.to))}`));
  dropped.forEach((d) => lines.push(`${esc(nm(d.id))} fällt aus${
    d.reason === 'rest' ? ' (Ersatz erst nach 48 h)' : ''}`));
  const pflege = careFor(act);
  return `
    <div class="card injury-note">
      <div class="inj-note-head">🩹 Rücksicht auf: ${esc(names.join(', '))}</div>
      ${lines.length
        ? `<div class="small muted">Heute deshalb: ${lines.join(' · ')}</div>`
        : '<div class="small muted">Heute ändert das nichts – keine der Übungen ist betroffen.</div>'}
      ${pflege.length ? `<div class="small muted" style="margin-top:6px">
        Dazu ${plural(pflege.length, 'Übung', 'Übungen')} zum Dehnen und Kräftigen:
        ${esc(pflege.slice(0, 3).map((c) => c.name).join(' · '))}${pflege.length > 3 ? ' …' : ''}
      </div>` : ''}
      <button type="button" class="btn btn-ghost btn-sm" data-act="go-injuries">Verletzungen ansehen</button>
    </div>`;
}

/** Eine Zusatzübung als Karte. Dauer statt Sätzen – das ist kein Trainingsvolumen. */
/* ------------------------------------------------------------------ *
 * Reha-Übungen im Training
 *
 * Was bei einer angehakten Beschwerde gut tut – dehnen, mobilisieren, gezielt
 * kräftigen –, stand bisher nur im Verletzungs-Tab. Dort liest man es einmal
 * und macht es nie: Gemacht wird, was im Training steht.
 *
 * Sie hängen deshalb am Trainingstag an, hinter der letzten Übung. Nicht darin:
 * Sie zählen nicht als Sätze, gehen nicht ins Wochenvolumen ein und halten
 * "Abschließen" nicht auf – ein Satz Außenrotation mit dem Gummiband ist kein
 * Satz Rudern. Sie stehen mit Dosis und Hinweis da und haben einen Haken.
 * ------------------------------------------------------------------ */

/** Reha-Übungen, die heute dazugehören – leer, wenn nichts angehakt ist. */
function careToday() {
  return careFor(activeInjuries());
}

function careBlock(n) {
  const liste = careToday();
  if (!liste.length) return '';
  const fertig = liste.filter((c) => store.careDone(n, c.key)).length;
  return `
    <section class="card care-block">
      <div class="section-title" style="margin:0 0 4px">Zum Schluss · Beschwerden</div>
      <div class="small muted">${plural(liste.length, 'Übung', 'Übungen')} zum Dehnen,
        Mobilisieren und gezielten Kräftigen – wegen dem, was du unter <em>Verletzt</em>
        angehakt hast. Sie zählen nicht als Sätze und halten das Abschließen nicht auf.
        ${fertig ? `<b>${fertig} von ${liste.length} erledigt.</b>` : ''}</div>
      ${liste.map((c) => {
        const an = store.careDone(n, c.key);
        return `
        <button type="button" class="care-row ${an ? 'on' : ''}" aria-pressed="${an}"
                data-act="toggle-care" data-key="${esc(c.key)}">
          <span class="care-tick">${an ? '✓' : ''}</span>
          <span class="care-body">
            <span class="care-head">
              <span class="care-name">${esc(c.name)}</span>
              <span class="care-kind care-${esc(c.kind)}">${esc(CARE_LABEL[c.kind] || c.kind)}</span>
            </span>
            <span class="care-dose">${esc(c.dose)}${c.clearance ? ' · erst nach ärztlicher Freigabe' : ''}</span>
            <span class="care-cue">${esc(c.cue)}</span>
          </span>
        </button>`;
      }).join('')}
    </section>`;
}

function careCard(c) {
  return `
    <div class="care">
      <div class="care-head">
        <span class="care-name">${esc(c.name)}</span>
        <span class="care-kind care-${esc(c.kind)}">${esc(CARE_LABEL[c.kind] || c.kind)}</span>
      </div>
      <div class="care-dose">${esc(c.dose)}</div>
      <div class="care-cue">${esc(c.cue)}</div>
      ${c.wegen && c.wegen.length > 1
        ? `<div class="care-why">wegen ${esc(c.wegen.join(' und '))}</div>` : ''}
    </div>`;
}

/* ------------------------------------------------------------------ *
 * Kalender
 *
 * Der Plan steht als Liste von Einheiten da, aber gelebt wird er in Tagen:
 * Wann war ich dran, wann war ich es nicht, was kommt. Gezeigt wird deshalb
 * ein gewöhnliches Monatsraster – und zwar mit den *tatsächlichen* Terminen
 * aus effDate(), nicht mit den Plandaten, sonst stimmt nach dem ersten
 * verpassten Tag nichts mehr.
 * ------------------------------------------------------------------ */

const MODE_ICON = { db: '🏋️', bw: '🤸' };

/** Zustand eines Kalendertags. Reihenfolge zählt: erledigt schlägt alles. */
function dayState(w, iso, today) {
  if (!w) return null;
  const done = completedMode(w.n);
  if (done) return { kind: 'done', mode: done };
  const angefangen = store.isStarted(w.n);
  if (iso < today) return { kind: angefangen ? 'part' : 'miss', mode: store.workoutMode(w.n) };
  return { kind: angefangen ? 'part' : 'plan', mode: store.workoutMode(w.n) };
}

const KIND_TEXT = { done: 'trainiert', part: 'angefangen', miss: 'ausgefallen', plan: 'geplant' };

function calendarCell(iso, month, today, byDate, sel) {
  const ws = byDate.get(iso) || [];
  const st = dayState(ws[0], iso, today);
  const cls = ['cal-cell'];
  if (iso.slice(0, 7) !== month.slice(0, 7)) cls.push('out');
  if (iso === today) cls.push('today');
  if (iso === sel) cls.push('sel');
  if (st) cls.push(st.kind, st.mode);
  const tag = Number(iso.slice(8));
  // Ohne Einheit ist der Tag kein Knopf: nichts anzuzeigen, nichts zu tippen.
  if (!st) return `<div class="${cls.join(' ')}"><span class="cal-num">${tag}</span></div>`;
  const mehr = ws.length > 1 ? ` (+${ws.length - 1})` : '';
  return `
    <button type="button" class="${cls.join(' ')}" data-act="cal-day" data-iso="${iso}"
            aria-pressed="${iso === sel}"
            aria-label="${esc(fmtDate(iso, true))}: ${plural(ws.length, 'Einheit', 'Einheiten')} ${
              esc(KIND_TEXT[st.kind])}, ${esc(MODE_LABEL[st.mode])}">
      <span class="cal-num">${tag}</span>
      <span class="cal-mark">${st.kind === 'miss' ? '·' : MODE_ICON[st.mode]}${mehr}</span>
    </button>`;
}

/** Die angetippte Einheit im Detail: Übungen, Sätze, Modus. */
function calendarDetail(iso, byDate, today) {
  const ws = byDate.get(iso) || [];
  if (!ws.length) {
    return `<div class="card muted small">Kein Training an diesem Tag. Tippe einen
      markierten Tag an, um die Einheit zu sehen.</div>`;
  }
  // Zwei Einheiten an einem Tag gibt es wirklich – etwa wenn zwei an
  // demselben Tag nachgetragen werden. Dann stehen beide da.
  return ws.map((w) => calendarWorkout(w, iso, today)).join('');
}

function calendarWorkout(w, iso, today) {
  const st = dayState(w, iso, today);
  const mode = st.mode;
  const items = exOf(w).map((it) => resolve(it, mode));
  const saetze = items.reduce((a, x) => a + x.sets, 0);
  const kopf = KIND_TEXT[st.kind];
  const prog = progressOf(w.n, mode);

  return `
    <div class="card cal-detail">
      <div class="cal-det-head">
        <div>
          <div class="lbl">Workout ${w.n} · ${esc(kopf)}</div>
          <div class="hint">${esc(fmtDate(iso, true))} · ${plural(items.length, 'Übung', 'Übungen')} ·
            ${plural(saetze, 'Satz', 'Sätze')}</div>
        </div>
        <span class="chip ${mode}">${MODE_ICON[mode]} ${esc(MODE_LABEL[mode])}</span>
      </div>
      ${st.kind === 'part' ? `<div class="hint">${prog.done} von ${prog.total} Sätzen stehen.</div>` : ''}
      <ul class="cal-list">
        ${items.map((it) => `
          <li>
            <span class="cal-ex">${esc(it.name)}</span>
            <span class="cal-sets">${it.sets} × ${esc(repsLabel(it, mode))}</span>
          </li>`).join('')}
      </ul>
      <button type="button" class="btn btn-sm" data-act="cal-open" data-n="${w.n}">
        ${st.kind === 'done' ? 'Im Dashboard ansehen' : 'Zu dieser Einheit'}
      </button>
    </div>`;
}

/** Gezeigter Monat: gewählter, sonst der der nächsten offenen Einheit. */
function calMonthNow() {
  if (ui.calMonth) return ui.calMonth;
  const naechste = PLAN.find((w) => !completedMode(w.n));
  return monthStart(naechste ? effDate(naechste) : todayISO());
}

function renderCalendar() {
  const today = todayISO();
  const byDate = new Map();
  PLAN.forEach((w) => {
    const d = effDate(w);
    byDate.set(d, (byDate.get(d) || []).concat(w));
  });
  const month = calMonthNow();
  const sel = ui.calDay;
  const tage = monthGrid(month);

  // Gezählt werden Einheiten, nicht Tage – an einem Tag können zwei stehen.
  const imMonat = tage.filter((d) => d.slice(0, 7) === month.slice(0, 7))
    .flatMap((d) => (byDate.get(d) || []).map((w) => dayState(w, d, today)));
  const zaehl = { done: 0, part: 0, miss: 0, plan: 0 };
  const proModus = { db: 0, bw: 0 };
  imMonat.forEach((st) => {
    zaehl[st.kind] += 1;
    if (st.kind === 'done') proModus[st.mode] += 1;
  });

  view.innerHTML = `
    <button type="button" class="back-link" data-act="go-tab" data-tab="settings">← Mehr</button>
    <div class="section-title">Kalender</div>

    <div class="card">
      <div class="cal-top">
        <button type="button" class="cal-nav" data-act="cal-month" data-d="-1" aria-label="Voriger Monat">‹</button>
        <div class="cal-title">${esc(fmtMonth(month))}</div>
        <button type="button" class="cal-nav" data-act="cal-month" data-d="1" aria-label="Nächster Monat">›</button>
      </div>
      <div class="cal-grid cal-head">${WEEK_HEAD.map((d) => `<div>${d}</div>`).join('')}</div>
      <div class="cal-grid">${tage.map((d) => calendarCell(d, month, today, byDate, sel)).join('')}</div>
      <div class="cal-legend">
        <span><i class="dot done"></i> trainiert</span>
        <span><i class="dot part"></i> angefangen</span>
        <span><i class="dot plan"></i> geplant</span>
        <span><i class="dot miss"></i> ausgefallen</span>
      </div>
      <div class="small muted">
        ${plural(imMonat.length, 'Einheit', 'Einheiten')} in diesem Monat ·
        ${zaehl.done} trainiert${zaehl.done ? ` (${MODE_ICON.db} ${proModus.db} · ${MODE_ICON.bw} ${proModus.bw})` : ''}${
          zaehl.miss ? ` · ${zaehl.miss} ausgefallen` : ''}${
          zaehl.plan ? ` · ${zaehl.plan} offen` : ''}
      </div>
      ${month.slice(0, 7) === today.slice(0, 7) ? '' : `
        <button type="button" class="btn btn-sm" data-act="cal-today">Zu heute</button>`}
    </div>

    ${calendarDetail(sel, byDate, today)}

    <div class="small muted">
      Die Termine sind die tatsächlichen: verpasste Tage rücken den Restplan
      nach hinten, abgeschlossene Einheiten bleiben auf dem Tag, an dem du
      trainiert hast.
    </div>`;
}

function renderInjuries() {
  const act = activeInjuries();
  const mode = store.getState().mode;
  const activeSet = new Set(act);
  const nm = (id) => resolve({ id, sets: 0 }, mode).name;

  const marks = act.map((id) => injuryById(id)).filter(Boolean)
    .map((i) => ({ spot: i.spot, kind: i.kind }));

  // Auswirkungen über den ganzen Plan, nicht nur über heute
  const block = blocked(act);
  const gone = [];
  const swapCount = new Map();
  let wegenPause = 0;
  PLAN.forEach((w) => {
    const r = injuryNotes(w.n);
    r.dropped.forEach((d) => {
      gone.push(d);
      if (d.reason === 'rest') wegenPause += d.sets;
    });
    r.swapped.forEach((s) => {
      const key = `${s.from}→${s.to}`;
      swapCount.set(key, (swapCount.get(key) || 0) + s.sets);
    });
  });
  const goneSets = new Map();
  gone.forEach((d) => goneSets.set(d.id, (goneSets.get(d.id) || 0) + d.sets));

  const impact = act.length
    ? weeklyImpact(PLAN, PLAN.map((w) => exOf(w)), EX_BY_ID, mode, PLAN_WEEKS) : {};
  const hits = Object.entries(impact)
    .map(([m, v]) => ({ m, ...v, diff: v.after - v.before }))
    .filter((x) => Math.abs(x.diff) > 0.05)
    .sort((a, b) => a.diff - b.diff);

  const conflicts = swapConflicts(act);
  const combos = combosFor(act);
  const pflege = careFor(act);

  const summary = act.length ? `
    <section class="card inj-summary">
      <div class="inj-fig no-hint" id="injFigure" aria-label="Körper mit den betroffenen Stellen"></div>
      <div class="inj-sum-body">
        <div class="section-title" style="margin:0 0 6px">${plural(act.length, 'Beschwerde', 'Beschwerden')} aktiv</div>
        <div class="chips">${act.map((id) => {
          const i = injuryById(id);
          return i ? `<span class="chip on">${esc(i.name)}</span>` : '';
        }).join('')}</div>
        ${[...swapCount.entries()].length ? `<div class="small" style="margin-top:10px">
          <b>Getauscht:</b> ${[...swapCount.entries()].map(([k, sets]) => {
            const [from, to] = k.split('→');
            return `${esc(nm(from))} → ${esc(nm(to))} <span class="muted">(${sets} Sätze)</span>`;
          }).join(' · ')}</div>` : ''}
        ${goneSets.size ? `<div class="small" style="margin-top:6px">
          <b>Fällt ersatzlos weg:</b> ${[...goneSets.entries()]
            .map(([id, sets]) => `${esc(nm(id))} <span class="muted">(${sets} Sätze)</span>`).join(' · ')}</div>` : ''}
        ${wegenPause ? `<div class="small muted" style="margin-top:6px">
          Davon ${wegenPause} Sätze ohne Ersatz, weil der Ersatz dieselbe Muskelgruppe
          getroffen hätte wie der Tag davor oder danach – ${REST.days === 2 ? '48 Stunden' : `${REST.days} Tage`}
          Erholung gehen vor.</div>` : ''}
        ${!swapCount.size && !goneSets.size ? '<div class="small muted" style="margin-top:10px">Am Plan ändert sich nichts – keine der angehakten Beschwerden trifft eine Übung, die vorkommt.</div>' : ''}
        <button type="button" class="btn btn-ghost btn-sm" data-act="clear-injuries" style="margin-top:12px">Alle Haken entfernen</button>
      </div>
    </section>

    ${hits.length ? `<section class="card">
      <div class="section-title" style="margin:0 0 8px">Was das pro Woche kostet</div>
      <table class="inj-table">
        <thead><tr><th>Muskelgruppe</th><th>vorher</th><th>jetzt</th></tr></thead>
        <tbody>${hits.map((x) => `<tr>
          <td>${esc(MUSCLE_LABEL[x.m] || x.m)}</td>
          <td class="muted">${x.before.toFixed(1)}</td>
          <td class="${x.after < x.before - 0.05 ? 'inj-loss' : 'inj-gain'}">${x.after.toFixed(1)}
            <span class="small">(${x.diff > 0 ? '+' : '−'}${Math.abs(x.diff).toFixed(1)})</span></td>
        </tr>`).join('')}</tbody>
      </table>
      <div class="small muted" style="margin-top:8px">Sätze je Woche, Anteile eingerechnet. Ziel sind 10.</div>
    </section>` : ''}

    ${pflege.length ? `<section class="card">
      <div class="section-title" style="margin:0 0 4px">Was jetzt gut tut</div>
      <div class="small muted" style="margin-bottom:10px">
        ${plural(pflege.length, 'Übung', 'Übungen')} zum Dehnen, Mobilisieren und gezielten
        Kräftigen. Sie zählen nicht ins Wochenvolumen – das hier ist Reha, kein Aufbau.
        ${pflege.some((c) => c.clearance)
          ? '<b>Erst nach ärztlicher Freigabe:</b> bei Bruch, Riss oder Bandscheibenvorfall entscheidet nicht der Plan, wann wieder bewegt wird.'
          : ''}
      </div>
      ${pflege.map((c) => careCard(c)).join('')}
    </section>` : ''}

    ${conflicts.length || combos.length ? `<section class="card">
      <div class="section-title" style="margin:0 0 8px">Wechselwirkungen</div>
      ${conflicts.map((c) => `<div class="inj-warn">
        <b>${esc(c.inj.name)}</b> würde ${esc(nm(c.from))} durch ${esc(nm(c.to))} ersetzen –
        das sperrt aber ${esc(c.by.join(' und '))}. Die Übung fällt deshalb ganz weg.
      </div>`).join('')}
      ${combos.map((c) => `<div class="inj-warn">${esc(c.text)}</div>`).join('')}
    </section>` : ''}
  ` : `
    <section class="card inj-summary">
      <div class="inj-fig no-hint" id="injFigure" aria-label="Körper ohne Beschwerden"></div>
      <div class="inj-sum-body">
        <div class="section-title" style="margin:0 0 6px">Nichts angehakt</div>
        <div class="small muted">Hak an, was gerade weh tut. Der Plan lässt die betroffenen
        Übungen dann weg oder tauscht sie – dauerhaft, bis der Haken wieder weg ist.</div>
      </div>
    </section>`;

  const areas = [];
  INJURIES.forEach((i) => {
    const last = areas[areas.length - 1];
    if (last && last.area === i.area) last.list.push(i);
    else areas.push({ area: i.area, list: [i] });
  });

  view.innerHTML = `
    <button type="button" class="back-link" data-act="go-tab" data-tab="settings">← Mehr</button>
    <div class="section-title">Verletzungen &amp; Beschwerden</div>
    ${summary}
    ${areas.map((g) => `
      <div class="inj-area">${esc(g.area)}</div>
      ${g.list.map((i) => {
        const open = ui.openInjury.has(i.id);
        const on = activeSet.has(i.id);
        const hitsPlan = i.avoid.some((x) => PLAN.some((w) => w.ex.some((e) => e.id === x)));
        return `
        <section class="card inj-card${on ? ' on' : ''}">
          <div class="inj-head" data-act="toggle-injury-open" data-inj="${i.id}" role="button" tabindex="0">
            <div class="inj-title">
              <div class="lbl">${esc(i.name)}</div>
              <div class="hint">${esc(KIND_LABEL[i.kind] || i.kind)} · ${esc(i.area)}${
                hitsPlan ? '' : ' · betrifft keine Übung im Plan'}</div>
            </div>
            <button type="button" class="toggle" aria-pressed="${on}"
              data-act="toggle-injury" data-inj="${i.id}"
              aria-label="${esc(i.name)} ${on ? 'abwählen' : 'anhaken'}"></button>
          </div>
          ${open ? `<div class="inj-body">
            <div class="inj-fig small-fig no-hint" data-spot="${i.spot}" data-kind="${i.kind}"
              aria-label="Körper, betroffen: ${esc(i.area)}"></div>
            <div class="inj-text">
              <p>${esc(i.text)}</p>
              ${i.avoid.length ? `<div class="small"><b>Betrifft:</b> ${
                i.avoid.map((x) => esc(nm(x))).join(' · ')}</div>` : ''}
              ${Object.keys(i.swap).length ? `<div class="small" style="margin-top:4px"><b>Ersatz:</b> ${
                Object.entries(i.swap).map(([a, b]) => `${esc(nm(a))} → ${esc(nm(b))}`).join(' · ')}</div>`
                : '<div class="small muted" style="margin-top:4px">Kein Ersatz – die Übungen fallen weg.</div>'}
            </div>
          </div>
          ${(i.care || []).length ? `<div class="inj-care">
            <div class="small"><b>Was gut tut</b>${needsClearance(i.id)
              ? ' <span class="muted">– erst nach ärztlicher Freigabe</span>' : ''}</div>
            ${i.care.map((k) => (CARE[k] ? careCard({ key: k, ...CARE[k] }) : '')).join('')}
          </div>` : ''}` : ''}
        </section>`;
      }).join('')}
    `).join('')}
    <div class="card muted small">
      Das hier ersetzt keine Diagnose. Die Zuordnungen sind gängige Trainingslehre –
      was im Einzelfall gut tut, weiß nur eine Untersuchung. Bei Schmerz, der bleibt,
      gehört jemand draufgeschaut, der das kann.
    </div>`;

  const big = document.getElementById('injFigure');
  if (big) mountFigure(big, 'stand', false, null, marks);
  view.querySelectorAll('.inj-fig.small-fig').forEach((host) => {
    mountFigure(host, 'stand', false, null, [{ spot: host.dataset.spot, kind: host.dataset.kind }]);
  });
}

/* ------------------------------------------------------------------ *
 * Einstellungen
 * ------------------------------------------------------------------ */

/**
 * Welche Fassung gerade läuft.
 *
 * Nicht aus einer Konstante im Skript – die würde man beim Ändern vergessen –,
 * sondern aus dem Namen des Zwischenspeichers, den der Service Worker anlegt.
 * Damit steht dort, was wirklich ausgeliefert wird, und im Zweifel sieht man
 * sofort, ob eine alte Fassung klebt.
 */
function showVersion() {
  const host = document.getElementById('appVersion');
  if (!host) return;
  const plan = `Plan: ${PLAN.length} Einheiten bis ${fmtDate(PLAN[PLAN.length - 1].date, true)}`;
  if (!window.caches) {
    host.textContent = `${plan} · kein Zwischenspeicher`;
    return;
  }
  caches.keys().then((keys) => {
    const mine = keys.filter((k) => k.startsWith('workout-'));
    host.textContent = `${plan} · Zwischenspeicher: ${mine.join(', ') || 'keiner'}`;
  }).catch(() => { host.textContent = plan; });
}

/* ------------------------------------------------------------------ *
 * Eigenes Workout
 *
 * Der Plan deckt 21 Wochen ab und rechnet sein Wochenvolumen aus 84 festen
 * Einheiten. Etwas dazwischenzuschieben würde diese Rechnung stillschweigend
 * verschieben – deshalb stehen eigene Einheiten *neben* dem Plan: Sie laufen in
 * derselben Fokus-Ansicht mit Pausen, Gewichten und Bewegungsbildern, aber sie
 * zählen nicht als erledigte Plan-Einheit. In der Statistik tauchen ihre Sätze
 * und Kilo trotzdem auf – trainiert ist trainiert.
 *
 * Gedacht für die Fälle, die der Plan nicht kennt: im Urlaub nur das, wofür es
 * ein Gerät gibt; nach einer Pause etwas Kurzes; oder eine Extraeinheit für
 * eine Muskelgruppe, die man selbst zu kurz findet.
 * ------------------------------------------------------------------ */

function renderCustom() {
  const liste = store.customs();
  const draft = ui.customDraft;

  if (!draft) {
    view.innerHTML = `
      <button type="button" class="back-link" data-act="go-tab" data-tab="settings">← Mehr</button>
      <div class="section-title">Eigene Workouts</div>
      <div class="card">
        <div class="small muted">Stell dir eine Einheit selbst zusammen – Übungen aus dem
          Vorrat, Sätze frei. Sie läuft wie eine Plan-Einheit, mit Pausen, Gewichten und
          Bewegungsbildern, geht dem Plan aber nicht dazwischen: Deine 84 Einheiten bleiben,
          wie sie sind. Sätze und Volumen zählen in der Statistik mit.</div>
        <div class="btn-row">
          <button type="button" class="btn btn-primary btn-block" data-act="custom-new">Neues Workout</button>
        </div>
      </div>
      ${liste.map((c) => {
        const sets = c.ex.reduce((a, x) => a + x.sets, 0);
        const prog = progressOf(c.id, store.workoutMode(c.id));
        return `
        <div class="card">
          <div class="lbl">${esc(c.name)}</div>
          <div class="hint">${c.ex.length} Übungen · ${sets} Sätze${
            prog.done ? ` · ${prog.done}/${prog.total} abgehakt` : ''}</div>
          <div class="small muted" style="margin-top:6px">${esc(c.ex.map((x) => resolve(x, 'db').name).join(' · ')) || 'Noch keine Übung'}</div>
          <div class="btn-row nav">
            <button type="button" class="btn btn-primary" data-act="custom-start" data-id="${c.id}">Öffnen</button>
            <button type="button" class="btn" data-act="custom-edit" data-id="${c.id}">Bearbeiten</button>
            <button type="button" class="btn btn-danger" data-act="custom-del" data-id="${c.id}">Löschen</button>
          </div>
        </div>`;
      }).join('')}`;
    return;
  }

  // --- Baukasten ---
  const gruppen = new Map();
  EXERCISES.forEach((e) => {
    if (!gruppen.has(e.group)) gruppen.set(e.group, []);
    gruppen.get(e.group).push(e);
  });
  const drin = new Set(draft.ex.map((x) => x.id));
  const sets = draft.ex.reduce((a, x) => a + x.sets, 0);

  view.innerHTML = `
    <button type="button" class="back-link" data-act="custom-cancel">← Eigene Workouts</button>
    <div class="section-title">${draft.id ? 'Bearbeiten' : 'Neues Workout'}</div>
    <div class="card">
      <div class="lbl">Name</div>
      <input type="text" class="name-input" maxlength="32" value="${esc(draft.name)}"
             data-act="custom-name" aria-label="Name des Workouts" placeholder="z. B. Kurz &amp; schwer">
    </div>

    <div class="section-title">Übungen${draft.ex.length ? ` · ${draft.ex.length} · ${sets} Sätze` : ''}</div>
    <div class="card">
      ${draft.ex.length ? draft.ex.map((x, i) => {
        const v = resolve(x, 'db');
        return `
        <div class="cx-row">
          <div class="cx-main">
            <div class="lbl">${esc(v.name)}</div>
            <div class="hint">${esc(v.group)} · ${esc(v.equip)}</div>
          </div>
          <div class="cx-sets">
            <button type="button" class="kg-step" data-act="custom-sets" data-i="${i}" data-d="-1"
                    aria-label="Ein Satz weniger">−</button>
            <span class="cx-num">${x.sets}</span>
            <button type="button" class="kg-step" data-act="custom-sets" data-i="${i}" data-d="1"
                    aria-label="Ein Satz mehr">+</button>
          </div>
          <button type="button" class="cx-del" data-act="custom-remove" data-i="${i}"
                  aria-label="${esc(v.name)} entfernen">✕</button>
        </div>`;
      }).join('') : '<div class="small muted">Noch nichts gewählt – unten aussuchen.</div>'}
      <div class="btn-row">
        <button type="button" class="btn btn-primary btn-block" data-act="custom-save"
                ${draft.ex.length ? '' : 'disabled'}>Speichern und öffnen</button>
      </div>
    </div>

    <div class="section-title">Übungsvorrat</div>
    <div class="card">
      ${[...gruppen.entries()].map(([g, list]) => `
        <div class="cx-group">${esc(g)}</div>
        <div class="chips">${list.map((e) => `
          <button type="button" class="chip ${drin.has(e.id) ? 'on' : ''}"
                  data-act="custom-add" data-ex="${e.id}">${esc(e.db.name)}</button>`).join('')}</div>`).join('')}
    </div>`;
}

/* Die Farbwerte stehen in css/styles.css; hier nur die Namen und die zwei
 * Tupfer für die Vorschau. Zwei Stellen für dieselbe Farbe – aber die Alternative
 * wäre, das Design aus JavaScript zusammenzubauen, und dann flackert es beim
 * Laden. */
/* Trainingsfokus: was hinter den Varianten aus js/data.js steht. Die Zahlen
 * rechnet fokusZeile() aus dem Plan selbst aus – hier steht nur, für wen das
 * gedacht ist. */
const FOKUS_TEXT = {
  standard: 'Alles gleichmäßig, mit etwas mehr für das, was breit macht: Rücken, Brust und '
    + 'seitliche Schulter. Die Beine laufen mit.',
  bbp: 'Gesäß, Beine und Bauch bekommen das meiste. Der Oberkörper bleibt drin, damit die '
    + 'Haltung nicht auf der Strecke bleibt – nur mit weniger Sätzen.',
  oberkoerper: 'Brust, Rücken, Schultern und Arme. Beine und Gesäß nur als Grundlage, ein '
    + 'Auftritt pro Woche.',
  kurz: 'Dieselben Übungen, weniger Sätze pro Woche – für Wochen, in denen die Zeit knapp ist. '
    + 'Kürzere Einheiten, dafür alles drin.',
  beine: 'Wie Ausgewogen, aber die Beine stehen nicht mehr auf Erhalt: Oberschenkel, Gesäß und '
    + 'beide Seiten des Beinbeugers bekommen ein eigenes Ziel. Der Oberkörper bleibt, wie er '
    + 'ist – die Einheiten werden dadurch etwas länger.',
};

/* Wie lange ein Satz selbst dauert – acht bis zwölf Wiederholungen mit
 * Aufstellen. Grob, aber die Pausen daneben sind der viel größere Posten. */
const ARBEIT_JE_SATZ = 40;

/** Eine Zeile Zahlen zu einer Variante: Einheiten, Sätze, geschätzte Dauer. */
function fokusZeile(v) {
  const saetze = v.plan.reduce((a, w) => a + w.ex.reduce((b, x) => b + x.sets, 0), 0);
  const proEinheit = saetze / v.plan.length;
  // Mit den echten Pausen rechnen, nicht mit einem Mittelwert für alle: Ein Satz
  // Chin-ups kostet 180 s Pause, einer Wadenheben 90. Pauschal zweieinhalb
  // Minuten je Satz unterschätzte deshalb genau die Varianten mit vielen
  // Grundübungen – und nach dieser Zahl wird die Variante ausgesucht.
  const sekunden = v.plan.reduce((a, w) => a + w.ex.reduce((b, x) => {
    const ex = EX_BY_ID.get(x.id);
    const pause = (ex && ex.db && ex.db.rest) || 120;
    // Arbeit plus Pause nach jedem Satz; die letzte Pause der Einheit fällt weg.
    return b + x.sets * (ARBEIT_JE_SATZ + pause);
  }, 0) - ((w.ex.length && EX_BY_ID.get(w.ex[w.ex.length - 1].id).db.rest) || 0), 0);
  const min = Math.round((sekunden / v.plan.length / 60) / 5) * 5;
  return `${v.plan.length} Einheiten · ${proEinheit.toFixed(1)} Sätze je Einheit · ca. ${min} min`;
}

/** Auswahlkarten für den Trainingsfokus – im Einstieg und in den Einstellungen. */
function fokusKarten(aktuell) {
  return Object.entries(PLANS).map(([key, v]) => `
    <button type="button" class="fokus-btn ${key === aktuell ? 'on' : ''}"
            aria-pressed="${key === aktuell}" data-act="set-focus" data-v="${key}">
      <span class="lbl">${esc(v.name)}${key === aktuell ? ' ✓' : ''}</span>
      <span class="hint">${esc(FOKUS_TEXT[key] || '')}</span>
      <span class="fokus-zahl">${esc(fokusZeile(v))}</span>
    </button>`).join('');
}

const THEMES = [
  ['orange', 'Orange', '#ff7a45', '#4ea1ff'],
  ['rosa', 'Rosa', '#ff6fae', '#b98cff'],
  ['blau', 'Blau', '#4ea1ff', '#4ecfd0'],
  ['gruen', 'Grün', '#3ecf8e', '#7ad0ff'],
  ['violett', 'Violett', '#a78bfa', '#f0abfc'],
];

/* ------------------------------------------------------------------ *
 * Betreiber-Übersicht
 *
 * Die eine Ansicht, die nicht jedem gehört: Wer den Link verschickt hat, sieht
 * hier, was daraus geworden ist – wie viele Geräte, welche Fokusse, wer noch
 * trainiert und wer nicht mehr.
 *
 * Der Zugang hängt an einem Passwort, das nirgends im Code steht. Die App
 * schickt es an eine Datenbankfunktion, die nur bei Übereinstimmung Zeilen
 * zurückgibt; ein Schlüssel mit Leserecht müsste dagegen in der App liegen und
 * läge damit bei allen, die den Link haben.
 * ------------------------------------------------------------------ */

function adminKarte() {
  if (!hatServer()) return '';
  return `
    <div class="section-title">Übersicht</div>
    <div class="card">
      <div class="small muted">Wer den Link verschickt hat, sieht hier, wie die App
        benutzt wird. Braucht das Passwort aus der Einrichtung.</div>
      <div class="btn-row">
        <button type="button" class="btn btn-block" data-act="go-tab" data-tab="admin">Übersicht öffnen</button>
      </div>
    </div>`;
}

/**
 * Was vom Server kommt, ist fremder Text – auch wenn er von der eigenen App
 * stammen sollte.
 *
 * Schreiben darf jeder, der den öffentlichen Schlüssel hat, und der steht im
 * Repo. Eine Zeile könnte also statt einer Zahl eine Zeichenkette mitbringen;
 * die landete beim Zusammenrechnen als Text in der Übersicht und von dort
 * ungefiltert im HTML. Deshalb wird hier einmal alles auf seine Form gebracht,
 * bevor die Ansicht es überhaupt sieht: Zahlen sind danach Zahlen, alles andere
 * geht wie gehabt durch esc().
 */
function saubereZeilen(daten) {
  const zahl = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);
  const text = (x) => (x === null || x === undefined ? '' : String(x));
  return (Array.isArray(daten) ? daten : []).map((r) => {
    const ue = {};
    Object.entries((r && r.uebungen) || {}).forEach(([id, n]) => { ue[text(id)] = zahl(n); });
    return {
      id: text(r.id),
      name: text(r.name),
      fokus: text(r.fokus),
      stufe: text(r.stufe),
      einheiten: zahl(r.einheiten),
      plan: zahl(r.plan),
      saetze: zahl(r.saetze),
      volumen: zahl(r.volumen),
      serie: zahl(r.serie),
      geteilt: zahl(r.geteilt),
      freunde: zahl(r.freunde),
      zuletzt: text(r.zuletzt),
      gesehen: text(r.gesehen),
      uebungen: ue,
    };
  });
}

/**
 * Das Betreiber-Passwort lebt nur, solange der Tab offen ist.
 *
 * Es öffnet die Zahlen aller anderen, und es lag bisher im selben Speicher wie
 * der ganze Rest: dauerhaft, lesbar für jedes Skript auf dieser Seite, und in
 * jeder Sicherungsdatei mit drin. Der Tab-Speicher überlebt Neuladen und
 * Zurück-Taste, aber weder das Schließen noch den Export.
 */
const PASS_SCHLUESSEL = 'workout.adminPass';
function adminPassLesen() {
  try { return sessionStorage.getItem(PASS_SCHLUESSEL) || ''; } catch { return ''; }
}
function adminPassMerken(wort) {
  try {
    if (wort) sessionStorage.setItem(PASS_SCHLUESSEL, wort);
    else sessionStorage.removeItem(PASS_SCHLUESSEL);
  } catch { /* gesperrter Speicher: dann eben jedes Mal eintippen */ }
}

function renderAdmin() {
  const zurueck = '<button type="button" class="back-link" data-act="go-tab" data-tab="settings">← Mehr</button>';
  if (!hatServer()) {
    view.innerHTML = `${zurueck}<div class="card muted small">In dieser Fassung ist kein Server
      eingetragen – es gibt nichts zu zeigen.</div>`;
    return;
  }
  const daten = ui.adminDaten;
  if (!daten && adminPassLesen() && !ui.adminFehler && !ui.adminLaeuft) {
    // Passwort steht schon: dann nicht danach fragen, sondern laden.
    ui.adminLaeuft = true;
    adminOeffnen(adminPassLesen());
  }
  if (!daten) {
    view.innerHTML = `
      ${zurueck}
      <div class="section-title">Übersicht</div>
      <div class="card">
        <div class="small muted">Passwort aus der Einrichtung (steht in der Datenbankfunktion
          <code>admin_liste</code>, nicht in der App).</div>
        <input type="password" class="name-input" id="adminPass" autocomplete="current-password"
               placeholder="Passwort" aria-label="Passwort">
        <div class="btn-row">
          <button type="button" class="btn btn-primary btn-block" data-act="admin-open">Öffnen</button>
        </div>
        ${ui.adminFehler ? `<div class="hint" style="color:var(--accent)">${esc(ui.adminFehler)}</div>` : ''}
      </div>`;
    const feld = document.getElementById('adminPass');
    if (feld) {
      feld.value = adminPassLesen();
      feld.addEventListener('keydown', (e) => { if (e.key === 'Enter') adminOeffnen(); });
    }
    return;
  }

  // --- Zahlen aus den Zeilen ---
  const heute = todayISO();
  const tage = (d) => (d ? daysBetween(String(d).slice(0, 10), heute) : null);
  const aktiv = daten.filter((r) => tage(r.gesehen) !== null && tage(r.gesehen) <= 7).length;
  const trainiert = daten.filter((r) => (r.einheiten || 0) > 0).length;
  const summeSaetze = daten.reduce((a, r) => a + (r.saetze || 0), 0);
  const geteilt = daten.reduce((a, r) => a + (r.geteilt || 0), 0);
  const fokusse = new Map();
  daten.forEach((r) => fokusse.set(r.fokus || '–', (fokusse.get(r.fokus || '–') || 0) + 1));
  const stufen = new Map();
  daten.forEach((r) => stufen.set(r.stufe || '–', (stufen.get(r.stufe || '–') || 0) + 1));
  const uebungen = new Map();
  daten.forEach((r) => Object.entries(r.uebungen || {}).forEach(([id, n]) => {
    uebungen.set(id, (uebungen.get(id) || 0) + (Number(n) || 0));
  }));
  const topUe = [...uebungen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxUe = topUe.length ? topUe[0][1] : 1;
  const reihen = [...daten].sort((a, b) => (b.einheiten || 0) - (a.einheiten || 0));

  const verteilung = (karte) => [...karte.entries()].sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${esc(k)} <b>${n}</b>`).join(' · ');

  view.innerHTML = `
    ${zurueck}
    <div class="section-title">Übersicht</div>
    <div class="stat-grid">
      <div class="stat"><div class="stat-v">${daten.length}</div><div class="stat-l">Geräte insgesamt</div></div>
      <div class="stat"><div class="stat-v">${aktiv}</div><div class="stat-l">in den letzten 7 Tagen</div></div>
      <div class="stat"><div class="stat-v">${trainiert}</div><div class="stat-l">haben trainiert</div></div>
      <div class="stat"><div class="stat-v">${summeSaetze}</div><div class="stat-l">Sätze zusammen</div></div>
      <div class="stat"><div class="stat-v">${geteilt}</div><div class="stat-l">mal weitergeschickt</div></div>
      <div class="stat"><div class="stat-v">${daten.filter((r) => (r.freunde || 0) > 0).length}</div><div class="stat-l">mit Vergleich</div></div>
    </div>

    <div class="section-title">Fokus und Erfahrung</div>
    <div class="card">
      <div class="small">${verteilung(fokusse) || '–'}</div>
      <div class="small muted" style="margin-top:8px">${verteilung(stufen) || '–'}</div>
    </div>

    <div class="section-title">Wer</div>
    <div class="card">
      <table class="vgl">
        <thead><tr><th>Name</th><th>Einheiten</th><th>Sätze</th><th>zuletzt</th></tr></thead>
        <tbody>${reihen.map((r) => {
          const t = tage(r.gesehen);
          return `<tr>
            <td>${esc(r.name || '–')}
              <div class="small muted">${esc(r.fokus || '')}${r.stufe ? ` · ${esc(r.stufe)}` : ''}</div></td>
            <td><b>${esc(r.einheiten || 0)}</b><span class="muted">/${esc(r.plan || '?')}</span></td>
            <td>${esc(r.saetze || 0)}</td>
            <td>${r.zuletzt ? esc(fmtDate(String(r.zuletzt).slice(0, 10))) : '–'}
              <div class="small muted">${t === null ? ''
                : t === 0 ? 'App heute geöffnet' : `App vor ${plural(t, 'Tag', 'Tagen')}`}</div></td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>

    <div class="section-title">Meistgemachte Übungen</div>
    <div class="card">
      ${topUe.length ? `<div class="bars">${topUe.map(([id, n]) => `
        <div class="bar-row">
          <div>
            <div class="bar-name">${esc((EX_BY_ID.get(id) || {}).db ? EX_BY_ID.get(id).db.name : id)}</div>
            <div class="bar-track"><i style="width:${Math.round((n / maxUe) * 100)}%"></i></div>
          </div>
          <div class="bar-val">${esc(n)}</div>
        </div>`).join('')}</div>` : '<div class="muted small">Noch nichts abgehakt.</div>'}
    </div>

    <div class="btn-row nav">
      <button type="button" class="btn" data-act="admin-reload">Neu laden</button>
      <button type="button" class="btn btn-ghost" data-act="admin-logout">Passwort vergessen</button>
    </div>
    <p class="small muted">Jede Zeile ist ein Gerät, das die App eingerichtet hat und das
      Teilen angelassen hat. Wer abschaltet, verschwindet aus der Liste, sobald er auf
      „Meine Daten dort löschen" tippt.</p>`;
}

/** Passwort prüfen und Liste holen. */
function adminOeffnen(pass) {
  const feld = document.getElementById('adminPass');
  const wort = pass || (feld ? feld.value.trim() : adminPassLesen());
  if (!wort) return;
  ui.adminFehler = '';
  adminListe(wort).then((daten) => {
    adminPassMerken(wort);
    ui.adminDaten = saubereZeilen(daten);
    ui.adminLaeuft = false;
    render();
  }).catch((e) => {
    ui.adminFehler = e.message || 'Hat nicht geklappt';
    ui.adminDaten = null;
    ui.adminLaeuft = false;
    render();
  });
}

function renderSettings() {
  const s = store.getState();
  const act = activeInjuries().length;
  view.innerHTML = `
    <div class="card kachel-karte">
      <button type="button" class="kachel" data-act="go-tab" data-tab="calendar">
        <span class="kachel-i">📅</span>
        <span><span class="lbl">Kalender</span>
        <span class="hint">Alle Termine im Monatsraster, mit dem, was an dem Tag anstand.</span></span>
      </button>
      <button type="button" class="kachel" data-act="go-tab" data-tab="custom">
        <span class="kachel-i">🧩</span>
        <span><span class="lbl">Eigenes Workout${store.customs().length ? ` · ${store.customs().length}` : ''}</span>
        <span class="hint">Eine Einheit selbst zusammenstellen – neben dem Plan, nicht darin.</span></span>
      </button>
      <button type="button" class="kachel" data-act="go-tab" data-tab="injuries">
        <span class="kachel-i">🩹</span>
        <span><span class="lbl">Verletzt${act ? ` · ${act} aktiv` : ''}</span>
        <span class="hint">Anhaken, was weh tut – der Plan tauscht dann selbst.</span></span>
      </button>
    </div>

    <div class="section-title">Einstellungen</div>
    <div class="card">
      <div class="switch-row">
        <div>
          <div class="lbl">Standardmodus: Bodyweight</div>
          <div class="hint">Neue Workouts starten ohne Zusatzgewicht.</div>
        </div>
        <button type="button" class="toggle" aria-pressed="${s.mode === 'bw'}" data-act="toggle-default-mode" aria-label="Standardmodus Bodyweight"></button>
      </div>
      <div class="switch-row">
        <div>
          <div class="lbl">Modus je Workout merken</div>
          <div class="hint">Ein einmal gewähltes Workout behält seinen Modus, auch wenn du global umschaltest.</div>
        </div>
        <button type="button" class="toggle" aria-pressed="${s.keepModePerWorkout}" data-act="toggle-keep-mode" aria-label="Modus je Workout merken"></button>
      </div>
    </div>

    <div class="section-title">Pause zwischen den Sätzen</div>
    <div class="card">
      <div class="stat-v">${s.useExerciseRest
        ? '0:45 – 2:30 min'
        : (s.restSeconds ? `${Math.floor(s.restSeconds / 60)}:${String(s.restSeconds % 60).padStart(2, '0')} min` : 'Aus')}</div>
      <div class="small muted" style="margin-top:2px">
        Läuft automatisch, sobald du einen Satz abhakst – außer nach dem letzten Satz
        einer Übung. Am Ende kommt ein Signalton.
      </div>
      <div class="switch-row" style="margin-top:10px">
        <div>
          <div class="lbl">Pause je Übung</div>
          <div class="hint">Schwere Grundübungen bekommen mehr Pause als kleine Isolationsübungen –
            2:30 beim Squat, 0:45 bei Crunches. Aus schaltet auf eine feste Länge um.</div>
        </div>
        <button type="button" class="toggle" aria-pressed="${s.useExerciseRest}" data-act="toggle-ex-rest" aria-label="Pause je Übung"></button>
      </div>
      ${s.useExerciseRest ? '' : `
      <div class="btn-row nav">
        ${[60, 90, 120, 180].map((sec) => `
          <button type="button" class="btn ${s.restSeconds === sec ? 'btn-primary' : ''}"
                  data-act="set-rest" data-sec="${sec}">${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}</button>`).join('')}
      </div>`}
      <div class="switch-row">
        <div>
          <div class="lbl">Pause abschalten</div>
          <div class="hint">Kein Timer, kein Ton – Sätze nur abhaken.</div>
        </div>
        <button type="button" class="toggle" aria-pressed="${!s.useExerciseRest && !s.restSeconds}" data-act="toggle-rest-off" aria-label="Pause abschalten"></button>
      </div>
    </div>

    ${hatServer() ? `<div class="section-title">Nutzung teilen</div>
    ${shareKarte(true)}` : ''}

    ${adminKarte()}

    <div class="section-title">Leiste unten</div>
    <div class="card">
      <div class="small muted">Welche Seiten unten stehen. <em>Dashboard</em> und <em>Mehr</em>
        bleiben – ohne das eine gibt es kein Training, ohne das andere keinen Weg zurück
        hierher. Alles andere ist auch ohne Reiter über Mehr erreichbar.</div>
      ${Object.entries(TABS).filter(([k]) => !TABS_FIX.includes(k)).map(([key, [icon, label]]) => {
        const an = tabsAktiv().includes(key);
        const voll = tabsAktiv().length >= TABS_MAX && !an;
        return `
        <div class="switch-row">
          <div>
            <div class="lbl">${icon} ${esc(label)}</div>
            ${voll ? `<div class="hint">Erst einen anderen abwählen – mehr als ${TABS_MAX}
              werden unten zu schmal.</div>` : ''}
          </div>
          <button type="button" class="toggle" aria-pressed="${an}" data-act="toggle-tab"
                  data-v="${key}" aria-label="${esc(label)} unten anzeigen" ${voll ? 'disabled' : ''}></button>
        </div>`;
      }).join('')}
    </div>

    <div class="section-title">Erfahrung</div>
    <div class="card">
      <div class="small muted">Die Startgewichte des Plans stammen von jemandem, der seit
        einer Weile trainiert. Hier lassen sie sich auf die eigene Erfahrung umrechnen –
        Sätze, Pausen und Übungen bleiben, wie sie sind. Was du selbst eingestellt hast,
        bleibt ohnehin stehen.</div>
      <div class="fokus-liste">
        ${LEVELS.map(([key, name, hint, faktor]) => `
          <button type="button" class="fokus-btn ${(s.level || 'geuebt') === key ? 'on' : ''}"
                  aria-pressed="${(s.level || 'geuebt') === key}" data-act="set-level" data-v="${key}">
            <span class="lbl">${esc(name)}${(s.level || 'geuebt') === key ? ' ✓' : ''}</span>
            <span class="hint">${esc(hint)}</span>
            <span class="fokus-zahl">${esc(levelBeispiel(faktor))}</span>
          </button>`).join('')}
      </div>
    </div>

    <div class="section-title">Trainingsfokus</div>
    <div class="card">
      <div class="small muted">Jeder Fokus ist ein eigener, durchgerechneter Plan: dieselben
        Termine, dieselbe Erholungsregel, andere Schwerpunkte. Ein Wechsel legt den bisherigen
        Verlauf in die Ablage – die erreichten Gewichte bleiben.</div>
      <div class="fokus-liste">${fokusKarten(s.focus || 'standard')}</div>
      ${Object.keys(PLANS).length < 2 ? `<div class="small muted">In dieser Fassung ist nur der
        ausgewogene Plan mitgeliefert.</div>` : ''}
    </div>

    <div class="section-title">Farbe</div>
    <div class="card">
      <div class="small muted">Zwei Akzente: der wärmere gilt für die Hantel-Variante, der
        kühlere für Bodyweight. Sonst ändert sich nichts – dunkel bleibt dunkel.</div>
      <div class="farben">
        ${THEMES.map(([key, label, a, bfarbe]) => `
          <button type="button" class="farb-btn ${(s.theme || 'orange') === key ? 'on' : ''}"
                  aria-pressed="${(s.theme || 'orange') === key}" data-act="set-theme" data-v="${key}">
            <span class="farb-punkt" style="--a:${a};--b:${bfarbe}"></span>${label}
          </button>`).join('')}
      </div>
    </div>

    <div class="section-title">Teilen</div>
    <div class="card">
      <div class="small muted">Schick den Link weiter – wer ihn öffnet, hat dieselbe App:
        derselbe Plan, dieselben Bewegungen, offline und ohne Konto. Jeder trainiert für sich;
        von allein wird nichts übertragen. Voneinander seht ihr genau das, was ihr euch
        gegenseitig schickt – dafür ist der Stand-Link unten da.</div>
      ${location.protocol.startsWith('http') ? `
      <div class="btn-row">
        <button type="button" class="btn btn-primary btn-block" data-act="share-link">Link teilen</button>
      </div>
      <div class="btn-row nav">
        <button type="button" class="btn" data-act="share-whatsapp">WhatsApp</button>
        <button type="button" class="btn" data-act="copy-link">Link kopieren</button>
      </div>
      <div class="btn-row">
        <button type="button" class="btn btn-block" data-act="share-stand">Meinen Stand schicken</button>
      </div>
      <div class="small muted">Der Stand-Link nimmt deine Zahlen mit: Wer ihn öffnet, hat dich
        danach im Vergleich unter Statistik stehen.</div>
      <div class="small muted" style="word-break:break-all">${esc(appURL())}</div>`
      : `<div class="small muted">Diese Fassung läuft als Datei auf deinem Gerät und hat keine
         Adresse zum Weitergeben – schick stattdessen die Datei selbst.</div>`}
      <div class="switch-row" style="margin-top:12px">
        <div>
          <div class="lbl">Dein Name</div>
          <div class="hint">Steht auf der Startseite – und im Vergleich, wenn du deinen
            Stand verschickst.</div>
        </div>
        <input type="text" class="name-input schmal" maxlength="24" value="${esc(s.name || '')}"
               data-act="name-input" aria-label="Dein Name" placeholder="—">
      </div>
    </div>

    <div class="section-title">Töne und Hinweise</div>
    <div class="card">
      <div class="small muted">Die Töne werden erzeugt, nicht geladen – sie funktionieren also
        auch ohne Netz. Am Ende der Pause vibriert das Handy zusätzlich.</div>
      <div class="switch-row" style="margin-top:10px">
        <div>
          <div class="lbl">Töne</div>
          <div class="hint">Pause vorbei, Training gestartet, Übung fertig, Workout komplett.</div>
        </div>
        <button type="button" class="toggle" aria-pressed="${s.sound}" data-act="toggle-sound" aria-label="Töne"></button>
      </div>
      ${s.sound ? `
      <div class="switch-row">
        <div>
          <div class="lbl">Ton bei jedem Satz</div>
          <div class="hint">Kurzer Tupfer beim Abhaken – der kommt zwanzigmal pro Training.</div>
        </div>
        <button type="button" class="toggle" aria-pressed="${s.soundSets}" data-act="toggle-sound-sets" aria-label="Ton bei jedem Satz"></button>
      </div>` : ''}
      <div class="switch-row">
        <div>
          <div class="lbl">Hinweis im Hintergrund</div>
          <div class="hint">Meldung vom Handy, wenn die Pause endet und du gerade woanders bist –
            in einer anderen App oder bei gesperrtem Bildschirm. Braucht einmal deine Erlaubnis.
            Ist die App ganz geschlossen, bleibt es still: Dafür bräuchte es einen Server, der eine
            Nachricht schickt.${notifyDenied() ? ' <strong>Dein Browser hat Hinweise für diese Seite blockiert</strong> – das lässt sich nur in seinen Einstellungen wieder freigeben.' : ''}</div>
        </div>
        <button type="button" class="toggle" aria-pressed="${s.notify && !notifyDenied()}" data-act="toggle-notify" aria-label="Hinweis im Hintergrund" ${notifyDenied() ? 'disabled' : ''}></button>
      </div>
      ${s.sound ? `
      <div class="btn-row">
        <button type="button" class="btn btn-block" data-act="test-sound">Töne anhören</button>
      </div>` : ''}
    </div>

    <div class="section-title">Plan-Verschiebung</div>
    <div class="card">
      <div class="stat-v">${s.shift ? `${s.shift > 0 ? '+' : '−'}${esc(plural(Math.abs(s.shift), 'Tag', 'Tage'))}` : 'Im Plan'}</div>
      <div class="small muted" style="margin-top:2px">
        ${s.shift
          ? `Der offene Plan endet am ${esc(fmtDate(effDate(PLAN[PLAN.length - 1]), true))} statt am ${esc(fmtDate(PLAN[PLAN.length - 1].date, true))}.`
          : 'Der Plan läuft genau nach Excel-Termin.'}
      </div>
      ${daysBetween(effDate(firstOpen()), todayISO()) !== 0 ? `
      <div class="btn-row">
        <button type="button" class="btn btn-block" data-act="start-today">Nächste Einheit auf heute</button>
      </div>
      <div class="small muted">Zieht den ganzen offenen Plan mit – die Abstände zwischen den
        Einheiten bleiben, übersprungen wird nichts.</div>` : ''}
      <div class="btn-row nav">
        <button type="button" class="btn" data-act="shift-minus">− 1 Tag</button>
        <button type="button" class="btn" data-act="shift-plus">+ 1 Tag</button>
        <button type="button" class="btn btn-ghost" data-act="shift-reset" ${s.shift ? '' : 'disabled'}>Auf Original</button>
      </div>
    </div>

    <div class="section-title">Plan neu starten</div>
    <div class="card">
      <div class="small muted">Setzt alle abgehakten Sätze zurück und legt Workout 1 auf heute.
        Die erreichten Gewichte bleiben stehen, der bisherige Verlauf wandert in die Ablage
        und bleibt im Export erhalten.${store.getState().rounds.length
          ? ` Bisher ${esc(plural(store.getState().rounds.length, 'Runde', 'Runden'))} abgeschlossen.` : ''}</div>
      <div class="btn-row">
        <button type="button" class="btn" data-act="restart-plan">Von vorn beginnen</button>
        ${store.getState().rounds.length ? `
        <button type="button" class="btn" data-act="restore-round">Verlauf zurückholen</button>` : ''}
      </div>
      ${store.getState().rounds.length ? `
      <div class="small muted">Zurückholen legt den letzten abgelegten Verlauf wieder auf den
        Plan – für den Fall, dass der Neustart oder ein Wechsel des Trainingsfokus nicht
        gewollt war. Was du seitdem abgehakt hast, bleibt stehen.</div>` : ''}
    </div>

    <div class="section-title">Kalender</div>
    <div class="card">
      <div class="small muted">Alle Trainingstermine als Kalenderdatei, jeweils um 18 Uhr,
        mit den Übungen des Tages in der Beschreibung. In Google Kalender über
        <i>Einstellungen → Importieren</i> einlesen.</div>
      ${icsStale() ? `<div class="hint" style="color:var(--accent);margin-top:8px">
        Der Plan hat sich seit dem letzten Export um
        ${esc(plural(Math.abs(store.getState().shift - store.getState().lastIcs.shift), 'Tag', 'Tage'))}
        verschoben – Datei neu erzeugen und noch einmal importieren, dann wandern
        die Termine mit.</div>` : ''}
      <div class="btn-row">
        <button type="button" class="btn" data-act="download-ics">Kalenderdatei (.ics)</button>
      </div>
      <div class="small muted" style="margin-top:8px">
        ${(() => {
          const i = store.getState().lastIcs;
          return i ? `Zuletzt erzeugt am ${esc(fmtDate(i.on))}.`
                   : 'Noch nie erzeugt.';
        })()}
        Jeder Termin behält seine Kennung: ein erneuter Import verschiebt die
        vorhandenen Einträge, statt neue anzulegen.
      </div>
    </div>

    <div class="section-title">Daten</div>
    <div class="card">
      <div class="small muted">Alles liegt lokal im Browser – Android räumt den bei Platzmangel weg.
        ${(() => {
          const b = store.getState().lastBackup;
          if (!b) return 'Noch nie gesichert.';
          return `Zuletzt gesichert am ${esc(fmtDate(b.on))}, nach ${esc(plural(b.done, 'Einheit', 'Einheiten'))}.`;
        })()}</div>
      <div class="btn-row">
        <button type="button" class="btn" data-act="export">Export anzeigen</button>
        <button type="button" class="btn" data-act="download">Als Datei sichern</button>
      </div>
      <textarea class="io" id="io" placeholder="Hier JSON einfügen und auf „Importieren“ tippen…" style="margin-top:10px"></textarea>
      <div class="btn-row">
        <button type="button" class="btn" data-act="import">Importieren</button>
        <button type="button" class="btn btn-danger" data-act="reset-all">Alle Daten löschen</button>
      </div>
    </div>


    <div class="section-title">Fassung</div>
    <div class="card">
      <div class="small muted" id="appVersion">Zwischenspeicher wird gelesen…</div>
      <div class="btn-row">
        <button type="button" class="btn" data-act="force-update">App aktualisieren</button>
      </div>
      <div class="small muted" style="margin-top:8px">Leert den Zwischenspeicher und lädt
        alles neu. Trainingsdaten bleiben unangetastet – nur die App selbst wird geholt.</div>
    </div>

    <div class="section-title">Über den Plan</div>
    <div class="card small muted">
      ${PLAN.length} Einheiten, ursprünglich vom ${esc(fmtDate(PLAN[0].date, true))} bis ${esc(fmtDate(PLAN[PLAN.length - 1].date, true))},
      aufgebaut auf ${EXERCISES.length} Grundübungen. Zu jeder Hantelübung gehört ein
      Bodyweight-Äquivalent mit gleicher Satzzahl und angepasstem Wiederholungsbereich.
    </div>
  `;

  showVersion();
}

/* ------------------------------------------------------------------ *
 * Rendering / Routing
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 * Die Leiste unten
 *
 * Fünf Reiter waren zwei zu viel: Kalender und Verletzungen ruft man selten und
 * nie mitten im Satz auf, sie standen aber dauerhaft da und haben die wichtigen
 * schmal gemacht. Drei sind der Standard.
 *
 * Welche es sind, steht aber nicht fest – wer jeden zweiten Tag in den Kalender
 * schaut, soll ihn unten haben. Dashboard und Mehr bleiben gesetzt: ohne das
 * eine gibt es kein Training, ohne das andere keinen Weg zurück zu dieser
 * Einstellung. Alles, was nicht unten steht, ist über Mehr erreichbar.
 * ------------------------------------------------------------------ */

const TABS = {
  dashboard: ['🏠', 'Dashboard'],
  stats: ['📈', 'Statistik'],
  calendar: ['📅', 'Kalender'],
  injuries: ['🩹', 'Verletzt'],
  custom: ['🧩', 'Eigenes'],
  settings: ['⚙️', 'Mehr'],
};
const TABS_FIX = ['dashboard', 'settings'];
const TABS_MAX = 5;   // mehr wird auf schmalen Handys zur Briefmarke

/** Reiter in der Leiste, immer in der Reihenfolge von TABS. */
function tabsAktiv() {
  const gewaehlt = new Set(store.getState().tabs || ['stats']);
  return Object.keys(TABS).filter((k) => TABS_FIX.includes(k) || gewaehlt.has(k));
}

function renderTabbar(aktiv) {
  tabbar.innerHTML = tabsAktiv().map((key) => {
    const [icon, label] = TABS[key];
    return `<button type="button" class="tab" id="tab-${key}" data-tab="${key}" role="tab"
              aria-controls="view" aria-selected="${key === aktiv}"><span class="ti">${icon}</span><span>${esc(label)}</span></button>`;
  }).join('');
}

const RENDERERS = {
  dashboard: () => {
    if (needsWelcome()) { renderWelcome(); return; }
    const sess = store.getState().session;
    if (ui.focus && sess && sess.n === ui.workoutNo) renderFocus();
    else if (ui.listView) renderDashboard();
    else renderOverview();
  },
  calendar: renderCalendar,
  custom: renderCustom,
  admin: renderAdmin,
  stats: renderStats,
  injuries: renderInjuries,
  settings: renderSettings,
};

/**
 * Kennung eines bedienbaren Elements, die einen Neuaufbau übersteht.
 *
 * Die Ansicht wird bei jedem abgehakten Satz komplett neu geschrieben – der
 * Tastaturfokus landete danach wieder ganz oben, und wer mit Screenreader oder
 * Tastatur arbeitet, musste sich jedes Mal neu durchhangeln. Über die
 * data-Attribute lässt sich dasselbe Element hinterher wiederfinden; sie
 * beschreiben ohnehin schon, was der Knopf tut.
 */
function focusKey(el) {
  if (!el || !view.contains(el)) return null;
  const d = el.dataset || {};
  return [el.tagName, el.id, d.act, d.ex, d.i, d.tab, d.iso, d.n, d.d, d.delta, d.v]
    .map((x) => x || '').join('|');
}

function restoreFocus(key) {
  if (!key) return;
  const hit = [...view.querySelectorAll('button, input, select, textarea, [tabindex]')]
    .find((el) => focusKey(el) === key);
  // preventScroll: sonst springt die Seite beim Abhaken zum Knopf zurück.
  if (hit) hit.focus({ preventScroll: true });
}

function render() {
  const mode = ui.tab === 'dashboard' ? store.workoutMode(ui.workoutNo) : store.getState().mode;
  document.body.classList.toggle('mode-bw', mode === 'bw');
  document.documentElement.dataset.theme = store.getState().theme || 'orange';
  // Während des Trainings ist die Wahl längst getroffen – der Umschalter oben
  // wäre dort nur eine Möglichkeit, sich mitten im Satz zu verklicken.
  const imTraining = !!store.getState().session;
  modeSwitch.hidden = imTraining;
  modeSwitch.querySelectorAll('.mode-btn').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
  });
  // Seiten ohne eigenen Reiter liegen unter Mehr – dessen Reiter bleibt
  // markiert, solange man dort ist.
  const reiter = tabsAktiv().includes(ui.tab) ? ui.tab : 'settings';
  renderTabbar(reiter);
  view.setAttribute('aria-labelledby', `tab-${reiter}`);
  const hatte = focusKey(document.activeElement);
  clearFigures(); // alte Animationen abmelden, bevor das DOM ersetzt wird
  (RENDERERS[ui.tab] || renderDashboard)();
  restoreFocus(hatte);
  syncHistory();
}

function go(tab) {
  ui.tab = tab;
  store.setSetting('tab', tab);
  render();
  window.scrollTo({ top: 0 });
}

/* ------------------------------------------------------------------ *
 * Zurück-Taste
 *
 * Auf Android verlässt die Zurück-Taste sonst gleich die ganze App, auch aus
 * der Fokus-Ansicht heraus. Statt jeden Knopf einzeln anzufassen, vergleicht
 * render() die sichtbare Ebene mit der zuletzt abgelegten – ändert sie sich,
 * kommt ein Eintrag in den Verlauf. Ein Satz abhaken ändert die Ebene nicht
 * und legt deshalb auch nichts ab.
 * ------------------------------------------------------------------ */

const levelOf = () => `${ui.tab}|${ui.listView ? 1 : 0}|${ui.focus ? 1 : 0}`;
let lastLevel = levelOf();
let goingBack = false;

function syncHistory() {
  const now = levelOf();
  if (goingBack || now === lastLevel) return;
  lastLevel = now;
  history.pushState({ tab: ui.tab, listView: ui.listView, focus: ui.focus }, '');
}

// Der Link kommt an, während die App schon offen ist: Dann lädt der Browser
// nichts neu, er ändert nur den Anker. Ohne diese Zeile passiert dabei nichts.
window.addEventListener('hashchange', () => {
  const stand = standAusAdresse();
  if (!stand) return;
  ui.standAngebot = stand;
  go('dashboard');
});

window.addEventListener('popstate', (e) => {
  const st = e.state || { tab: 'dashboard', listView: false, focus: false };
  goingBack = true;
  ui.tab = st.tab || 'dashboard';
  ui.listView = !!st.listView;
  ui.focus = !!st.focus;
  lastLevel = levelOf();
  render();
  goingBack = false;
});

/* ------------------------------------------------------------------ *
 * Events
 * ------------------------------------------------------------------ */

tabbar.addEventListener('click', (e) => {
  const btn = e.target.closest('.tab');
  if (btn) go(btn.dataset.tab);
});

modeSwitch.addEventListener('click', (e) => {
  const btn = e.target.closest('.mode-btn');
  if (!btn) return;
  const mode = btn.dataset.mode;
  if (ui.tab === 'dashboard') store.setWorkoutMode(ui.workoutNo, mode);
  else store.setMode(mode);
  render();
  toast(mode === 'bw' ? '🤸 Bodyweight-Variante' : '🏋️ Hantel-Variante');
});

view.addEventListener('click', (e) => {
  const t = e.target.closest('[data-act]');
  if (!t) return;
  const act = t.dataset.act;
  const n = ui.workoutNo;
  const mode = store.workoutMode(n);

  switch (act) {
    case 'bw-bump': {
      const id = t.dataset.ex;
      store.addBwPlus(id, 2);
      render();
      toast('↑ Zwei Wiederholungen mehr ab dem nächsten Mal');
      break;
    }
    case 'toggle-injury': {
      const id = t.dataset.inj;
      const on = t.getAttribute('aria-pressed') !== 'true';
      store.toggleInjury(id, on);
      render();
      toast(on ? `🩹 ${injuryById(id).name} angehakt` : `✓ ${injuryById(id).name} entfernt`);
      break;
    }
    case 'toggle-injury-open': {
      const id = t.dataset.inj;
      if (ui.openInjury.has(id)) ui.openInjury.delete(id); else ui.openInjury.add(id);
      render();
      break;
    }
    case 'clear-injuries': {
      store.clearInjuries();
      render();
      toast('Alle Haken entfernt');
      break;
    }
    case 'go-injuries':
      go('injuries');
      break;
    case 'go-tab':
      go(t.dataset.tab);
      break;
    case 'cal-month':
      ui.calMonth = addMonths(calMonthNow(), Number(t.dataset.d));
      render();
      break;
    case 'cal-today':
      ui.calMonth = monthStart(todayISO());
      render();
      break;
    case 'cal-day':
      // Nochmal antippen macht die Auswahl wieder auf – sonst gäbe es keinen
      // Weg zurück zur reinen Monatsübersicht.
      ui.calDay = ui.calDay === t.dataset.iso ? null : t.dataset.iso;
      render();
      break;
    case 'cal-open':
      ui.workoutNo = Number(t.dataset.n);
      ui.focus = false;
      ui.listView = false;
      go('dashboard');
      break;
    case 'toggle-ex': {
      const id = t.dataset.ex;
      if (ui.openEx.has(id)) ui.openEx.delete(id); else ui.openEx.add(id);
      render();
      break;
    }
    case 'toggle-set': {
      const id = t.dataset.ex;
      const i = Number(t.dataset.i);
      const item = workoutByNo(n).ex.find((x) => x.id === id);
      const cur = store.getSets(n, mode, id, item.sets)[i].done;
      const variant = resolve(item, mode);
      initAudio(); // Berührung nutzen, solange der Browser Ton noch erlaubt

      // Beim Abhaken das benutzte Gewicht mitschreiben – daraus speist sich
      // später der Vergleich "Zuletzt" und die Volumenrechnung.
      const patch = { done: !cur };
      if (!cur && variant.weight !== null) patch.w = fmtNum(workingWeight(id));
      else if (cur) patch.w = '';
      store.updateSet(n, mode, id, item.sets, i, patch);

      const done = !cur;
      const workoutComplete = done && progressOf(n, mode).complete;
      const exDone = done && i === item.sets - 1
        && store.getSets(n, mode, id, item.sets).every((s) => s.done);

      // In der Fokus-Ansicht sofort zur nächsten offenen Übung rücken. Bis
      // hierher wartete der Sprung auf die Antwort zu "Wie war das?" – die
      // Frage gibt es nicht mehr, also gibt es auch nichts mehr abzuwarten.
      if (ui.focus && exDone && !workoutComplete) weiterZurNaechsten(n, mode);
      render();
      // Pause nur nach einem gesetzten Haken und nie nach dem letzten Satz
      // einer Übung – und auch nicht, wenn das Workout damit fertig ist.
      if (done && !workoutComplete && i < item.sets - 1) {
        startRest(variant.name, i, item.sets, restFor(variant));
      } else if (store.getState().rest) {
        endRest(false);
      }
      // Der größte Anlass gewinnt: Workout fertig schlägt Übung fertig schlägt
      // einzelnen Satz. Ein Haken, der wieder weggeht, bleibt still.
      if (done) sound(workoutComplete ? 'done' : (exDone ? 'exercise' : 'set'));
      if (workoutComplete) toast('Workout abgeschlossen 🎉');
      break;
    }
    case 'weight-step': {
      const id = t.dataset.ex;
      const kg = store.setWeight(id, (workingWeight(id) || 0) + Number(t.dataset.d));
      render();
      // Steht heute schon ein Satz, gilt die Änderung erst beim nächsten Mal.
      const started = (store.peekSets(n, mode, id) || []).some((s) => s.done);
      toast(started ? `Ab dem nächsten Satz ${fmtNum(kg)} kg` : `${fmtNum(kg)} kg`);
      break;
    }
    case 'accept-bump': {
      const id = t.dataset.ex;
      const kg = store.setWeight(id, Number(t.dataset.kg));
      sound('bump');
      render();
      toast(`Nächstes Mal ${fmtNum(kg)} kg 💪`);
      break;
    }
    case 'start-today': {
      // Der ganze offene Plan rückt mit, die Abstände bleiben – es wird nichts
      // übersprungen, nur vorgezogen.
      const ziel = shiftToToday();
      const tage = ziel - store.getState().shift;
      store.setShift(ziel);
      ui.workoutNo = firstOpen().n;
      render();
      toast(tage < 0 ? `Plan um ${plural(-tage, 'Tag', 'Tage')} vorgezogen – los geht's 💪`
                     : 'Der Plan steht auf heute');
      break;
    }
    case 'restart-plan': {
      // Runde 1 wandert in die Ablage, die Gewichte bleiben. Workout 1 rückt
      // auf heute, sonst würde die Nachrück-Automatik den halben Plan
      // verschieben, weil das Originaldatum längst vorbei ist.
      // Auch nach vorn: Liegt der Excel-Termin in der Zukunft, fängt die neue
      // Runde trotzdem heute an und nicht irgendwann.
      const target = daysBetween(PLAN[0].date, todayISO());
      store.restartPlan(target);
      ui.workoutNo = PLAN[0].n;
      ui.focus = false;
      ui.listView = false;
      ui.openEx.clear();
      render();
      toast('Neue Runde – viel Erfolg 💪');
      break;
    }
    case 'restore-round': {
      const ok = store.restoreRound();
      // Der Verlauf steht wieder auf dem Plan; die Termine richten sich danach,
      // also gleich zur Startansicht zurück.
      ui.focus = false;
      ui.listView = false;
      render();
      toast(ok ? 'Verlauf ist zurück' : 'Da liegt nichts in der Ablage');
      if (ok) meldeStand(true);
      break;
    }
    case 'backup-now':
      downloadBackup();
      render();
      break;
    case 'start-session':
      if (!workoutByNo(n).ex.length) {
        toast('Heute fällt alles weg – nichts zu starten');
        break;
      }
      // Die Variante wird beim Starten gewählt, nicht während des Trainings:
      // Der Umschalter oben ist zwischen zwei Sätzen nur eine Falle.
      if (t.dataset.mode) store.setWorkoutMode(n, t.dataset.mode);
      initAudio(); // Ton jetzt freischalten, damit das erste Pausensignal sitzt
      sound('start');
      store.startSession(n);
      ui.focus = true;
      ui.listView = false;
      ui.focusIdx = firstOpenExercise(n, mode);
      render();
      toast('Los geht’s 💪');
      break;
    case 'finish-session': {
      const prog = progressOf(n, mode);
      // Abgehakt ist abgehakt: Wer hier tippt, ist fertig – der Tag zählt als
      // trainiert, auch wenn nicht jeder Satz steht. Ohne einen einzigen Satz
      // wäre das allerdings gelogen.
      if (prog.done) store.markDone(n, mode);
      store.endSession();
      meldeStand(true);
      ui.focus = false;
      ui.listView = false;
      if (store.getState().rest) endRest(false);
      sound(prog.complete ? 'done' : 'stop');
      render();
      toast(prog.complete
        ? `Training abgeschlossen – alle ${prog.total} Sätze 🎉`
        : `Gespeichert · ${prog.done}/${prog.total} Sätze`);
      break;
    }
    case 'discard-session': {
      const prog = progressOf(n, mode);
      // Verwerfen löscht alles zu diesem Workout in dieser Variante, nicht nur
      // die Sätze von heute – deshalb steht die Zahl in der Rückfrage.
      const ok = !prog.done || confirm(
        `Training abbrechen und ${prog.done} abgehakte ${prog.done === 1 ? 'Satz' : 'Sätze'} verwerfen?`,
      );
      if (!ok) break;
      store.resetWorkout(n, mode);
      store.endSession();
      ui.focus = false;
      ui.listView = false;
      if (store.getState().rest) endRest(false);
      sound('stop');
      render();
      toast('Training abgebrochen – nichts gespeichert');
      break;
    }
    case 'focus-list':
      ui.focus = false;
      ui.listView = true;
      render();
      break;
    case 'show-list':
      ui.listView = true;
      render();
      break;
    case 'focus-back': // aus der Liste zurück in die laufende Übung
      ui.focus = true;
      ui.listView = false;
      render();
      break;
    case 'hide-list':
      ui.listView = false;
      render();
      break;
    case 'set-band': {
      const id = t.dataset.ex;
      // Nochmal auf dasselbe Band tippen nimmt die Auswahl zurück – so bleibt
      // "noch nicht entschieden" ein möglicher Zustand.
      store.setBand(id, store.bandOf(id) === t.dataset.v ? null : t.dataset.v);
      sound('set');
      render();
      break;
    }
    case 'toggle-care':
      store.toggleCare(n, t.dataset.key);
      sound('set');
      render();
      break;
    case 'toggle-detail': {
      const id = t.dataset.ex;
      if (ui.openDetail.has(id)) ui.openDetail.delete(id); else ui.openDetail.add(id);
      render();
      break;
    }
    case 'focus-goto':
      ui.focusIdx = Number(t.dataset.i);
      render();
      break;
    case 'focus-step':
      ui.focusIdx = Math.max(0, Math.min(workoutByNo(n).ex.length - 1, ui.focusIdx + Number(t.dataset.d)));
      render();
      break;
    case 'complete-workout':
      // Das benutzte Gewicht muss mit: Ohne es fehlen die Sätze in der
      // Verlaufskurve, und die Steigerungsserie bricht ab, weil sie das
      // Gewicht der letzten Einheit nicht wiederfindet. Beim einzelnen
      // Abhaken schreibt toggle-set es längst mit.
      store.completeWorkout(n, mode, workoutByNo(n).ex.map((x) => {
        const v = resolve(x, mode);
        return { ...x, w: v.weight === null ? '' : fmtNum(workingWeight(x.id)) };
      }));
      if (store.getState().rest) endRest(false);
      sound('done');
      render();
      toast('Alle Sätze abgehakt 🎉');
      break;
    case 'reset-workout':
      if (!hasAnyEntry(n, mode) || confirm(`Workout ${n} (${MODE_LABEL[mode]}) wirklich zurücksetzen?`)) {
        store.resetWorkout(n, mode);
        if (store.getState().rest) endRest(false);
        render();
        toast('Zurückgesetzt');
      }
      break;
    case 'custom-new':
      ui.customDraft = { id: null, name: '', ex: [] };
      render();
      break;
    case 'custom-edit': {
      const c = store.customById(t.dataset.id);
      if (c) ui.customDraft = { id: c.id, name: c.name, ex: c.ex.map((x) => ({ ...x })) };
      render();
      break;
    }
    case 'custom-cancel':
      ui.customDraft = null;
      render();
      break;
    case 'custom-add': {
      const id = t.dataset.ex;
      const d = ui.customDraft;
      if (!d) break;
      const i = d.ex.findIndex((x) => x.id === id);
      // Nochmal antippen nimmt sie wieder heraus – dieselbe Kachel, beide Wege.
      if (i >= 0) d.ex.splice(i, 1);
      else d.ex.push({ id, sets: 3 });
      sound('set');
      render();
      break;
    }
    case 'custom-sets': {
      const d = ui.customDraft;
      const x = d && d.ex[Number(t.dataset.i)];
      if (!x) break;
      x.sets = Math.max(1, Math.min(9, x.sets + Number(t.dataset.d)));
      render();
      break;
    }
    case 'custom-remove': {
      const d = ui.customDraft;
      if (d) d.ex.splice(Number(t.dataset.i), 1);
      render();
      break;
    }
    case 'custom-save': {
      const d = ui.customDraft;
      if (!d || !d.ex.length) break;
      const id = store.saveCustom(d);
      ui.customDraft = null;
      ui.workoutNo = id;
      ui.listView = false;
      ui.focus = false;
      go('dashboard');
      toast('Gespeichert – los geht’s');
      break;
    }
    case 'custom-start':
      ui.workoutNo = t.dataset.id;
      ui.listView = false;
      ui.focus = false;
      go('dashboard');
      break;
    case 'custom-del': {
      const c = store.customById(t.dataset.id);
      if (!c || !confirm(`„${c.name}" löschen? Die abgehakten Sätze gehen mit.`)) break;
      store.removeCustom(c.id);
      if (ui.workoutNo === c.id) ui.workoutNo = defaultWorkoutNo();
      render();
      toast('Gelöscht');
      break;
    }
    case 'mark-done':
      // Für den Tag, an dem man abgehakt, aber nicht abgeschlossen hat – und für
      // den, an dem drei Sätze fehlten und man trotzdem trainiert hat.
      if (!progressOf(n, mode).done) {
        toast('Ohne einen abgehakten Satz gibt es nichts zu markieren');
        break;
      }
      store.markDone(n, mode);
      sound('done');
      render();
      toast('Als trainiert eingetragen – steht jetzt so im Kalender');
      break;
    case 'back-to-plan':
      ui.workoutNo = defaultWorkoutNo();
      ui.listView = false;
      render();
      break;
    case 'nav-workout': {
      if (istCustom(n)) break;
      const next = n + Number(t.dataset.delta);
      if (PLAN.some((w) => w.n === next)) {
        ui.workoutNo = next;
        ui.openEx.clear();
        ui.listView = false;
        render();
      }
      break;
    }
    case 'nav-today':
      ui.workoutNo = defaultWorkoutNo();
      ui.openEx.clear();
      ui.listView = false;
      render();
      break;
    case 'open-workout':
      ui.workoutNo = Number(t.dataset.n);
      ui.openEx.clear();
      ui.listView = false;
      go('dashboard');
      break;
    case 'toggle-default-mode':
      store.setMode(store.getState().mode === 'bw' ? 'db' : 'bw');
      render();
      break;
    case 'toggle-keep-mode':
      store.setSetting('keepModePerWorkout', !store.getState().keepModePerWorkout);
      render();
      break;
    case 'set-rest':
      initAudio();
      store.setSetting('restSeconds', Number(t.dataset.sec));
      render();
      break;
    case 'shift-ics':
      ui.shiftInfo = 0;
      downloadICS();
      render();
      break;
    case 'shift-ok':
      ui.shiftInfo = 0;
      render();
      break;
    case 'setup-next':
      setupWeiter();
      break;
    case 'setup-back':
      ui.setupStep = Math.max(0, (ui.setupStep || 0) - 1);
      render();
      break;
    case 'welcome-go':
      willkommenFertig();
      break;
    case 'set-focus': {
      const key = t.dataset.v;
      if (!PLANS[key] || key === (store.getState().focus || 'standard')) break;
      // Im Einstieg ist noch nichts protokolliert – da ist der Wechsel eine
      // Auswahl. Später ist er ein Neuanfang: Die Einheiten eines anderen Fokus
      // stehen an denselben Nummern, aber mit anderen Übungen; ein Protokoll,
      // das dazwischen hängt, wäre danach nicht mehr zuzuordnen.
      const laeuft = Object.keys(store.getState().log).length && store.getState().greeted;
      if (laeuft && !confirm(`Auf "${PLANS[key].name}" wechseln? Der bisherige Verlauf wandert `
        + 'in die Ablage und bleibt im Export erhalten, die erreichten Gewichte bleiben stehen.')) break;
      store.setSetting('focus', key);
      if (laeuft) store.restartPlan(0);
      // Der Plan steckt beim Laden in Hunderten von Zeilen; ein Wechsel mitten
      // im Betrieb hieße, dass die halbe App noch mit dem alten rechnet.
      if (store.getState().greeted) location.reload();
      else render();
      break;
    }
    case 'accept-stand': {
      const stand = ui.standAngebot;
      if (!stand) break;
      store.setFriend(freundId(stand.n), stand);
      ui.standAngebot = null;
      ui.standZurueck = stand.n;   // Vorschlag: eigenen Stand zurückschicken
      go('stats');
      toast(`${stand.n} steht jetzt im Vergleich`);
      break;
    }
    case 'drop-zurueck':
      ui.standZurueck = null;
      render();
      break;
    case 'drop-stand':
      ui.standAngebot = null;
      render();
      break;
    case 'share-stand': {
      ui.standZurueck = null;
      const url = standLink();
      const text = `Mein Stand: ${meinStand().w} Einheiten. Öffne den Link, dann stehe ich in `
        + 'deinem Vergleich – und schick mir deinen zurück.';
      if (navigator.share) navigator.share({ title: 'Workout', text, url }).catch(() => {});
      else linkKopieren(url);
      break;
    }
    case 'remove-friend':
      store.removeFriend(t.dataset.id);
      render();
      toast('Aus dem Vergleich entfernt');
      break;
    case 'share-link': {
      store.setSetting('shareCount', (store.getState().shareCount || 0) + 1);
      const url = appURL();
      if (navigator.share) {
        // Der Systemdialog braucht die Berührung, in der wir gerade stecken –
        // deshalb hier und nicht nach einem await.
        navigator.share({ title: 'Workout', text: SHARE_TEXT, url })
          .catch(() => {});   // Abbrechen ist kein Fehler
      } else {
        linkKopieren(url);
      }
      break;
    }
    case 'share-whatsapp':
      store.setSetting('shareCount', (store.getState().shareCount || 0) + 1);
      window.open(`https://wa.me/?text=${encodeURIComponent(`${SHARE_TEXT} ${appURL()}`)}`,
        '_blank', 'noopener');
      break;
    case 'copy-link':
      linkKopieren(appURL());
      break;
    case 'admin-open':
      adminOeffnen();
      break;
    case 'admin-reload':
      adminOeffnen(adminPassLesen());
      break;
    case 'admin-logout':
      adminPassMerken(null);
      ui.adminDaten = null;
      ui.adminFehler = '';
      render();
      break;
    case 'toggle-share': {
      const an = store.getState().share === false;
      store.setSetting('share', an);
      render();
      if (an) {
        meldeStand(true);
        toast('Wird ab jetzt geteilt');
      } else {
        toast('Abgeschaltet – es geht nichts mehr raus');
      }
      break;
    }
    case 'share-now':
      // Von Hand anstoßen, ohne auf den nächsten Tag zu warten – und die
      // Antwort des Servers gleich sichtbar machen.
      if (!meldetMit()) { toast('Ist abgeschaltet'); break; }
      if (!store.getState().deviceId) store.setSetting('deviceId', geraeteId(null));
      melden(standZeile()).then(({ ok, msg }) => {
        store.setSetting('lastShare', { on: todayISO(), ok, msg: ok ? '' : msg });
        if (ui.tab === 'settings') render();
        toast(ok ? 'Gemeldet' : msg || 'Hat nicht geklappt');
      });
      break;
    case 'share-delete': {
      const id = store.getState().deviceId;
      // Erst abschalten, dann löschen: Sonst könnte eine noch laufende Meldung
      // die Zeile gleich wieder hinschreiben.
      store.setSetting('share', false);
      loeschen(id).then(({ ok, zeilen, msg }) => {
        if (!ok) toast(msg || 'Hat nicht geklappt – später nochmal');
        else toast(zeilen === 0 ? 'Da lag nichts – jetzt ist es auch abgeschaltet' : 'Gelöscht');
      });
      render();
      break;
    }
    case 'toggle-tab': {
      const key = t.dataset.v;
      const drin = new Set(store.getState().tabs || ['stats']);
      if (drin.has(key)) drin.delete(key);
      else if (tabsAktiv().length < TABS_MAX) drin.add(key);
      store.setSetting('tabs', [...drin]);
      render();
      break;
    }
    case 'set-level':
      store.setSetting('level', t.dataset.v);
      render();
      toast('Startgewichte umgerechnet – eingestellte Gewichte bleiben');
      break;
    case 'set-theme':
      store.setSetting('theme', t.dataset.v);
      render();
      break;
    case 'toggle-sound': {
      initAudio();
      const on = !store.getState().sound;
      store.setSetting('sound', on);
      armRest(); // eine laufende Pause folgt der neuen Einstellung
      render();
      if (on) playSound('rest');
      break;
    }
    case 'toggle-sound-sets': {
      initAudio();
      const on = !store.getState().soundSets;
      store.setSetting('soundSets', on);
      render();
      if (on) playSound('set');
      break;
    }
    case 'toggle-notify': {
      // Die Erlaubnis holt der Browser nur aus einer Berührung heraus – also
      // genau hier. Angeschaltet gilt der Schalter erst, wenn sie da ist.
      if (!('Notification' in window)) {
        toast('Dieser Browser kennt keine Hinweise');
        break;
      }
      if (store.getState().notify) {
        store.setSetting('notify', false);
        dropNote();
        render();
        break;
      }
      Notification.requestPermission().then((erlaubnis) => {
        store.setSetting('notify', erlaubnis === 'granted');
        armRest();
        render();
        toast(erlaubnis === 'granted'
          ? 'Hinweis kommt auch im Hintergrund'
          : 'Ohne Erlaubnis geht das nicht');
      }).catch(() => {});
      break;
    }
    case 'test-sound': {
      // Der Reihe nach, damit man hört, was wofür steht.
      initAudio();
      ['start', 'set', 'exercise', 'ready', 'rest', 'done']
        .forEach((name, i) => setTimeout(() => playSound(name), i * 900));
      toast('Start · Satz · Übung fertig · fertig machen · Pause vorbei · Workout komplett');
      break;
    }
    case 'toggle-ex-rest':
      store.setSetting('useExerciseRest', !store.getState().useExerciseRest);
      render();
      break;
    case 'toggle-rest-off': {
      const off = !store.getState().useExerciseRest && !store.getState().restSeconds;
      store.setSetting('useExerciseRest', off);
      store.setSetting('restSeconds', off ? 90 : 0);
      if (store.getState().rest) endRest(false);
      render();
      break;
    }
    case 'shift-plus':
    case 'shift-minus':
      store.setShift(store.getState().shift + (act === 'shift-plus' ? 1 : -1));
      render();
      break;
    case 'shift-reset':
      store.setShift(0);
      render();
      toast('Original-Termine wiederhergestellt');
      break;
    case 'export': {
      const io = document.getElementById('io');
      io.value = store.exportJSON();
      io.select();
      toast('Export erzeugt – kopieren und sicher ablegen.');
      break;
    }
    case 'download-ics':
      downloadICS();
      render();
      break;
    case 'download':
      downloadBackup();
      break;
    case 'import': {
      const io = document.getElementById('io');
      try {
        store.importJSON(io.value);
        render();
        toast('Import erfolgreich');
      } catch (err) {
        toast(`Import fehlgeschlagen: ${err.message}`);
      }
      break;
    }
    case 'force-update': {
      // Notausgang, wenn eine alte Fassung im Zwischenspeicher klebt: Service
      // Worker abmelden, Zwischenspeicher leeren, neu laden. Der localStorage
      // bleibt, dort liegen die Trainingsdaten.
      (async () => {
        try {
          if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map((r) => r.unregister()));
          }
          if (window.caches) {
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k)));
          }
          sessionStorage.removeItem('workout.reloaded');
        } catch {
          // Auch ohne Aufräumen ist ein Neuladen besser als nichts.
        }
        store.flush();
        location.reload();
      })();
      break;
    }
    case 'reset-all':
      if (confirm('Wirklich alle protokollierten Sätze und Einstellungen löschen?')) {
        // Erst die Zeile auf dem Server, dann den Speicher: Danach ist die
        // Kennung weg, mit der sie zu finden wäre – sie bliebe für immer
        // stehen, obwohl hier gerade alles gelöscht wird.
        const id = meldetMit() ? store.getState().deviceId : null;
        if (id) loeschen(id);
        store.resetAll();
        ui.workoutNo = defaultWorkoutNo();
        render();
        toast('Alle Daten gelöscht');
      }
      break;
    default:
      break;
  }
});

view.addEventListener('keydown', (e) => {
  const head = e.target.closest('.ex-head');
  if (head && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    head.click();
  }
});

// Texteingaben: still speichern, damit der Fokus beim Tippen erhalten bleibt.
view.addEventListener('input', (e) => {
  const t = e.target.closest('[data-act]');
  if (!t) return;
  if (t.dataset.act === 'weight-input') {
    const kg = parseFloat(t.value.replace(',', '.'));
    if (!Number.isNaN(kg)) store.setWeight(t.dataset.ex, kg);
  } else if (t.dataset.act === 'custom-name') {
    if (ui.customDraft) ui.customDraft.name = t.value.slice(0, 32);
  } else if (t.dataset.act === 'name-input') {
    store.setSetting('name', t.value.trim().slice(0, 24));
  } else if (t.dataset.act === 'set-input') {
    const n = ui.workoutNo;
    const mode = store.workoutMode(n);
    const item = workoutByNo(n).ex.find((x) => x.id === t.dataset.ex);
    store.updateSet(n, mode, t.dataset.ex, item.sets, Number(t.dataset.i), { [t.dataset.field]: t.value });
  }
});

/* ------------------------------------------------------------------ *
 * Start
 * ------------------------------------------------------------------ */

// Bleibt die App über Mitternacht offen, muss der Plan beim Zurückkommen
// nachgezogen werden – sonst steht dort weiter das Datum von gestern.
let lastSeenDay = todayISO();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') {
    // Die Trainingsuhr steht, solange die App weg ist – es sei denn, es läuft
    // eine Pause. Die gehört zum Training, auch wenn man dabei aufs Handy
    // verzichtet.
    if (!store.getState().rest) store.clockStop();
    store.flush();
    return;
  }
  store.clockStart();
  tickRest(); // war das Handy gesperrt, ist die Pause womöglich abgelaufen
  // Läuft sie noch, das Signal neu auflegen: Ein im Hintergrund angehaltener
  // AudioContext verliert seine vorgemerkten Töne.
  if (store.getState().rest) armRest();
  const day = todayISO();
  const shifted = catchUpPlan();
  if (shifted || day !== lastSeenDay) {
    lastSeenDay = day;
    render();
  }
});

window.addEventListener('pagehide', () => {
  if (!store.getState().rest) store.clockStop();
  store.flush();
});

// Offline-Betrieb. Nur über http(s) – unter file:// gibt es keine Service
// Worker, und die gebündelte Einzeldatei braucht sie ohnehin nicht.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  // Nach einer neuen Fassung einmal neu laden.
  //
  // Der Service Worker holt Seitenaufrufe aus dem Netz, alles andere zuerst
  // aus dem Zwischenspeicher. Direkt nach einer Aktualisierung trifft damit
  // ein frisches index.html auf altes app.js und data.js – dann steht in der
  // Tabbar ein Tab, den das alte Skript nicht kennt, und im Kopf die
  // Einheitenzahl des alten Plans. Übernimmt der neue Service Worker die
  // Seite, ist alles Weitere frisch; ein Neuladen holt es sofort.
  //
  // Nur wenn vorher schon einer die Seite hatte: bei der allerersten
  // Installation greift `clients.claim()` ebenfalls, und ein Neuladen wäre
  // dort unnötig. Und nur einmal je Sitzung, damit ein kaputter Service
  // Worker die Seite nicht in eine Schleife schickt.
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return;
    try {
      if (sessionStorage.getItem('workout.reloaded')) return;
      sessionStorage.setItem('workout.reloaded', '1');
    } catch {
      return;   // ohne Speicher lieber gar nicht neu laden als endlos
    }
    location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Kein Offline-Betrieb, aber die App läuft normal weiter.
    });
  });
}

const missedAtStart = catchUpPlan();
// Nachgerückt wird still. Gefragt wird nur, was danach zu tun ist: Wer seine
// Termine im Kalender stehen hat, hat sie jetzt an den falschen Tagen. Muss vor
// dem ersten render() stehen, sonst kommt die Frage einen Aufbau zu spät.
ui.shiftInfo = missedAtStart;
// Hat jemand einen Stand geschickt? Steht im Anker der Adresse und wird dort
// sofort entfernt. Die Frage danach stellt die Startansicht – also muss sie
// auch die sichtbare sein, sonst öffnet der Link bei jemandem, der zuletzt in
// der Statistik war, eine Seite ohne jeden Hinweis.
ui.standAngebot = standAusAdresse();
if (ui.standAngebot) {
  ui.tab = 'dashboard';
  ui.focus = false;
  ui.listView = false;
}
render();
meldeStand();        // einmal am Tag, wenn ein Server eingetragen und erlaubt ist
store.clockResync(); // Zeit, in der die Seite gar nicht lief, zählt nicht mit
// Neu geladen und sichtbar: Die Uhr eines laufenden Trainings muss wieder
// anlaufen. Ohne diese Zeile stünde sie bis zum nächsten Wegschalten still.
if (!document.hidden) store.clockStart();
tickRest(); // eine Pause, die einen Neustart der Seite überdauert hat
