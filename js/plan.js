/*
 * Der Plan: Termine, Übungen je Einheit, Nacharbeit, Fortschritt.
 *
 * Das Herz der Rechnung. js/data.js liefert den geschriebenen Plan; hier wird
 * daraus der Plan, der heute gilt – verschoben um verpasste Tage, angepasst an
 * Verletzungen, skaliert auf die Erfahrungsstufe, ergänzt um Nacharbeit.
 *
 * exOf() ist die eine Stelle, an der Modus und Stufe über die Satzzahl
 * entscheiden. Alles danach – Protokoll, Fortschritt, Wochenvolumen,
 * Zeitschätzung – rechnet mit dem, was von dort kommt.
 */
import * as store from './store.js';
import { EXERCISES, PLAN, REST } from './data.js';
import { EX_BY_ID, directOf, directSets, gezaehlteReps, stufenWerte } from './uebung.js';
import { addDays, daysBetween, plural, todayISO } from './dates.js';
import { applyInjuries } from './injuries.js';
import { esc } from './text.js';
import { ruestOrderStabil } from './gewichte.js';
import { satzZahl } from './stufen.js';

/**
 * Tatsächlicher Termin einer Einheit.
 *
 * Bereits begonnene Einheiten bleiben auf dem Tag, an dem trainiert wurde –
 * die Historie darf sich nicht rückwirkend verschieben. Alles Offene liegt
 * auf seinem Plandatum plus der aktuellen Verschiebung.
 */
export function effDate(w) {
  // Eigene Einheiten hängen an keinem Plantermin: Sie sind an dem Tag, an dem
  // man sie macht, und verschieben sich mit dem Plan nicht mit.
  if (istCustom(w.n)) return store.startedOn(w.n) || todayISO();
  return store.startedOn(w.n) || addDays(w.date, store.getState().shift);
}

/** Eigene Einheiten haben eine Kennung statt einer Nummer. */
export const istCustom = (n) => typeof n === 'string' && n.startsWith('c');

/**
 * Verpasste Tage nachtragen: Ist der Termin der frühesten noch nicht
 * begonnenen Einheit verstrichen, wandert der gesamte Restplan um genau so
 * viele Tage nach hinten, bis diese Einheit auf heute fällt. Die Abstände
 * zwischen den Einheiten bleiben dabei erhalten.
 */
export function catchUpPlan() {
  const s = store.getState();
  const open = PLAN.find((w) => !store.isStarted(w.n));
  if (!open) return 0;
  const missed = daysBetween(effDate(open), todayISO());
  if (missed <= 0) return 0;
  store.setShift(s.shift + missed);
  return missed;
}

/** Die erste Einheit, die noch nicht angefangen wurde – die, die dran wäre. */
export function firstOpen() {
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
export function shiftToToday() {
  return store.getState().shift + daysBetween(effDate(firstOpen()), todayISO());
}

/**
 * Knopf „Heute anfangen“ – nur, wenn es etwas vorzuziehen gibt.
 *
 * Sichtbar an genau der Einheit, die als Nächstes offen ist: An Workout 40
 * angetippt würde er den halben Plan um Monate verschieben, und das will
 * niemand aus Versehen.
 */
export function startTodayRow(n) {
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
export function defaultWorkoutNo() {
  const open = PLAN.find((w) => !completedMode(w.n));
  return open ? open.n : PLAN[PLAN.length - 1].n;
}

/** Angehakte Verletzungen. */
export function activeInjuries() { return store.getState().injuries || []; }

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
export const planCache = { key: null, list: null, notes: null };

// Jede Zustandsänderung verwirft den Zwischenstand. Die Anpassung hängt an den
// tatsächlichen Terminen, und die ändern sich auch, wenn eine Einheit begonnen
// wird – das ließe sich am Schlüssel kaum zuverlässig ablesen. Ein Neuaufbau
// kostet unter einer Millisekunde, die Ersparnis liegt in den vielen Aufrufen
// innerhalb *eines* Renderdurchlaufs.
store.subscribe(() => { planCache.key = null; });

export function adjustedPlan() {
  const act = activeInjuries();
  // Der Schlüssel nennt nur, was die Anpassung selbst bestimmt. Die Termine
  // hängen zusätzlich daran, wann tatsächlich trainiert wurde – deshalb wird
  // der Zwischenstand bei jeder Zustandsänderung verworfen (siehe oben),
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
export function injuryNotes(n) {
  adjustedPlan();
  return planCache.notes[n - 1] || { dropped: [], swapped: [] };
}

/**
 * Der Plantag, wie er im Plan steht – Verletzungen, Modus und Erfahrungsstufe
 * eingerechnet, aber ohne Nacharbeit.
 *
 * Das ist die Zahl, gegen die gemessen wird: Wer wissen will, was diese Woche
 * liegen geblieben ist, muss den *Plan* fragen und nicht eine Einheit, die
 * schon Nachgetragenes enthält. Sonst wächst der Rückstand an sich selbst.
 * Nach außen geht exOf(), nicht diese Funktion.
 */
export function exBasis(w, mode) {
  if (istCustom(w.n)) return w.ex;
  const m = mode || store.workoutMode(w.n);
  const geplant = adjustedPlan()[w.n - 1] || w.ex;
  // Der Modus bestimmt die Satzzahl, die Erfahrung skaliert sie. Beides muss
  // hier passieren und nicht erst beim Anzeigen: Ab workoutByNo() reicht die
  // App nur noch `sets` weiter, und wer dort die falsche Zahl hineingibt,
  // bekommt sie in der Fortschrittsanzeige, im Protokoll und in der Statistik
  // wieder heraus. Siehe bw_saetze() in tools/build-plan.py.
  const items = geplant.map((it) => {
    const roh = m === 'bw' && it.bwSets ? it.bwSets : it.sets;
    const sets = satzZahl(roh);
    return sets === it.sets ? it : { ...it, sets };
  });
  // Nur bei den Hanteln: Im Bodyweight-Modus gibt es nichts umzubauen, und die
  // Reihenfolge soll dann die des Plans bleiben.
  return m === 'db' ? ruestOrderStabil(items, w.n, 'db') : items;
}

/* ------------------------------------------------------------------ *
 * Nacharbeit: was diese Woche liegen geblieben ist
 *
 * Wer eine Einheit nicht zu Ende macht, verlor die fehlenden Sätze bisher
 * ersatzlos – "Abschließen" zählt den Tag als trainiert, und der Plan ging
 * weiter, als wäre nichts gewesen. Das Wochenziel je Muskelgruppe, auf das
 * dieser Plan exakt gerechnet ist, stimmte dann für diese Woche nicht mehr.
 *
 * **Nur innerhalb derselben Woche.** Das ist keine technische Grenze, sondern
 * die Trainingslehre: Volumen wirkt über die Zeit, in der es anfällt. Was drei
 * Wochen später nachgeholt wird, ist kein Ausgleich, sondern eine zusätzliche
 * Belastung zur Unzeit – und ein Rückstand, der über Wochen mitwächst, führt zu
 * Einheiten, die niemand mehr schafft.
 *
 * **Gedeckelt.** Höchstens ein Satz je Übung und drei je Einheit. Eine Einheit
 * soll wiedererkennbar bleiben, und mehr als das wäre auch nicht mehr die
 * Belastung, für die die Erholungsregel gerechnet ist.
 *
 * **Ohne Aufschaukeln.** Gemessen wird gegen den Plan *ohne* Nacharbeit
 * (exBasis). Wer die nachgetragenen Sätze auch liegen lässt, bekommt sie nicht
 * ein zweites Mal obendrauf.
 *
 * **Nur nach oben.** Hier stand einmal auch die Gegenrichtung: Wer über Wochen
 * nur einen Teil schafft, dem hätte die App die Einheiten von selbst gekürzt.
 * Das ist wieder raus, auf ausdrücklichen Wunsch – die Erfahrungsstufe gehört
 * dem Nutzer, und eine App, die sie ungefragt senkt, nimmt ihm eine
 * Entscheidung ab, um die er nicht gebeten hat. Wer kürzere Einheiten will,
 * stellt die Stufe unter *Mehr → Erfahrung* selbst um.
 * ------------------------------------------------------------------ */

// Vier Einheiten sind eine Woche. Steht bewusst hier oben und nicht bei der
// Wochenauswertung, wo es hingehört: Das `ui`-Objekt ruft defaultWorkoutNo()
// noch während der Modulauswertung auf, und das geht über completedMode() bis
// hierher. Eine weiter unten stehende Konstante ist zu diesem Zeitpunkt noch
// nicht initialisiert – und der Fehler zeigt sich erst, sobald ein Protokoll
// da ist, weil completedMode() ohne Protokoll vorher aussteigt.
export const WEEK_SESSIONS = 4;

export const NACH_JE_EINHEIT = 3;

export const NACH_JE_UEBUNG = 1;

/**
 * Ist diese Einheit abgeschlossen? Wie completedMode(), aber über die
 * Plan-Satzzahl ohne Nacharbeit.
 *
 * Eine eigene Fassung, weil completedMode() über workoutByNo() an exOf() geht –
 * und exOf() fragt hier. Das wäre eine Endlosschleife.
 */
export function fertigOhneNacharbeit(n) {
  const st = store.getState().log[n];
  const w = PLAN[n - 1];
  if (!st || !w) return null;
  for (const m of ['db', 'bw']) {
    let total = 0;
    let done = 0;
    exBasis(w, m).forEach((it) => {
      const arr = (st[m] || {})[it.id] || [];
      total += it.sets;
      done += arr.slice(0, it.sets).filter((s) => s.done).length;
    });
    if (total > 0 && done === total) return m;
  }
  // Von Hand abgeschlossen zählt auch – aber nur, wenn überhaupt etwas steht.
  if (st.done) {
    const drin = Object.values(st[st.done] || {})
      .some((arr) => Array.isArray(arr) && arr.some((s) => s.done));
    if (drin) return st.done;
  }
  return null;
}

/** Was in dieser Woche vor `w` liegen geblieben ist, je Muskelgruppe. */
export function offenInWoche(w) {
  const start = Math.floor((w.n - 1) / WEEK_SESSIONS) * WEEK_SESSIONS;
  const fehlt = {};
  let summe = 0;
  for (let i = start; i < w.n - 1 && i < PLAN.length; i++) {
    const x = PLAN[i];
    const mx = fertigOhneNacharbeit(x.n);
    if (!mx) continue;   // noch offen – das ist kein Rückstand, das ist Zukunft
    const log = (store.getState().log[x.n] || {})[mx] || {};
    exBasis(x, mx).forEach((it) => {
      const arr = log[it.id];
      const done = Array.isArray(arr) ? arr.slice(0, it.sets).filter((s) => s.done).length : 0;
      const offen = it.sets - done;
      if (offen <= 0) return;
      const shares = EX_BY_ID.get(it.id)[mx].shares;
      Object.entries(shares).forEach(([mus, share]) => {
        fehlt[mus] = (fehlt[mus] || 0) + offen * share;
        summe += offen * share;
      });
    });
  }
  return { fehlt, summe };
}

/**
 * Wie viele Sätze diese Einheit obendrauf bekommt, je Übung.
 *
 * Verteilt wird gierig: Immer der Satz, der vom Rückstand am meisten wegnimmt.
 * Eine Übung zählt dabei mit ihren Anteilen – ein Satz Kniebeugen schließt
 * etwas beim Oberschenkel *und* beim Gesäß.
 */
export function nacharbeit(w, m) {
  if (istCustom(w.n) || !PLAN[w.n - 1]) return null;
  // Eine abgeschlossene Einheit ist Geschichte. Ihr nachträglich Sätze
  // hinzuzufügen, hieße, sie rückwirkend für unfertig zu erklären.
  if (fertigOhneNacharbeit(w.n)) return null;
  const { fehlt, summe } = offenInWoche(w);
  // Unter einem halben Satz lohnt die Unruhe nicht.
  if (summe < 0.5) return null;

  const rest = { ...fehlt };
  const items = exBasis(w, m);
  const extra = new Map();
  for (let k = 0; k < NACH_JE_EINHEIT; k++) {
    let beste = null;
    let bestWert = 0;
    items.forEach((it) => {
      if ((extra.get(it.id) || 0) >= NACH_JE_UEBUNG) return;
      const shares = EX_BY_ID.get(it.id)[m].shares;
      // Was ein zusätzlicher Satz vom Rückstand wirklich wegnimmt – mehr als
      // offen ist, kann er nicht schließen.
      const wert = Object.entries(shares)
        .reduce((a, [mus, share]) => a + Math.min(share, rest[mus] || 0), 0);
      if (wert > bestWert) { bestWert = wert; beste = it; }
    });
    if (!beste || bestWert < 0.25) break;
    extra.set(beste.id, (extra.get(beste.id) || 0) + 1);
    Object.entries(EX_BY_ID.get(beste.id)[m].shares).forEach(([mus, share]) => {
      rest[mus] = Math.max(0, (rest[mus] || 0) - share);
    });
  }
  return extra.size ? extra : null;
}

/** Wie viele Sätze einer Einheit aus der Nacharbeit stammen. */
export function nachSumme(items) {
  return items.reduce((a, it) => a + (it.nach || 0), 0);
}

/**
 * Übungsliste eines Plantags – Verletzungen, Modus, Erfahrung und Nacharbeit.
 *
 * Alles in der App geht durch diese Stelle. Die nachgetragenen Sätze stehen
 * deshalb schon hier drin und nicht erst in der Anzeige: Protokoll,
 * Fortschritt, Wochenvolumen und Zeitschätzung rechnen dann von selbst mit.
 */
export function exOf(w, mode) {
  if (istCustom(w.n)) return w.ex;
  const m = mode || store.workoutMode(w.n);
  const basis = exBasis(w, m);
  const extra = nacharbeit(w, m);
  if (!extra) return basis;
  return basis.map((it) => (extra.has(it.id)
    ? { ...it, sets: it.sets + extra.get(it.id), nach: extra.get(it.id) }
    : it));
}

/**
 * Ein Plantag mit den Satzzahlen des gewünschten Modus.
 *
 * `mode` ist optional und heißt "der Modus, in dem diese Einheit gerade steht".
 * Wer über *beide* Modi rechnet – completedMode(), die Statistik – muss ihn
 * ausdrücklich mitgeben, sonst bekommt er zweimal dieselben Zahlen und misst
 * den einen Modus am Soll des anderen.
 */
export function workoutByNo(n, mode) {
  if (istCustom(n)) {
    const c = store.customById(n);
    if (c) return { n, date: todayISO(), name: c.name, ex: c.ex, custom: true };
  }
  const w = PLAN.find((x) => x.n === n) || PLAN[0];
  const ex = exOf(w, mode);
  return ex === w.ex ? w : { ...w, ex };
}

/** Variante (db/bw) einer geplanten Übung inkl. Sätze. */
export function resolve(item, mode) {
  const ex = EX_BY_ID.get(item.id);
  const v = ex[mode];
  const stufe = stufenWerte(v);
  return {
    id: item.id, sets: item.sets, group: ex.group,
    // Wie viele dieser Sätze aus der Nacharbeit stammen – siehe nacharbeit().
    // Muss mitwandern: Ab hier sieht die Anzeige nur noch das, was hier steht,
    // und eine Einheit, die kommentarlos wächst, ist eine Zumutung.
    nach: item.nach || 0,
    name: v.name, reps: stufe.reps, equip: v.equip, cue: v.cue, rest: stufe.rest,
    pattern: v.pattern, muscles: v.muscles,
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

export function progressOf(n, mode) {
  // Mit dem Modus, nicht ohne: `mode` sagt, aus welchem Eimer die abgehakten
  // Sätze kommen – dann muss auch das Soll aus demselben Modus stammen. Ohne
  // das würde eine im Bodyweight-Modus vollständig gemachte Einheit am Soll
  // der Hantel-Fassung gemessen und käme nie auf "fertig".
  const w = workoutByNo(n, mode);
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
export function completedMode(n) {
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

export function hasAnyEntry(n, mode) {
  const w = workoutByNo(n, mode);
  return w.ex.some((item) => (store.peekSets(n, mode, item.id) || [])
    .some((s) => s.done || s.w !== ''));
}

/**
 * Die Zahlen der Statistik an einer Stelle.
 *
 * Ausgelagert, weil sie zweimal gebraucht werden: für den Statistik-Tab und
 * für den Stand, den man Freunden schickt. Zwei Rechnungen für dieselbe Zahl
 * wären zwei Zahlen.
 */
export function sammleStats() {
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
      exOf(w, m).forEach((item) => {
        const arr = entry[m] && entry[m][item.id];
        if (!Array.isArray(arr)) return;
        // Gerechnet wird mit gezaehlteReps(): der unteren Grenze des Bereichs,
        // und der oberen nur dort, wo der Satz ausdrücklich als "oben raus"
        // beantwortet wurde. Bewusst eher zu niedrig als zu hoch.
        const reps = stufenWerte(EX_BY_ID.get(item.id)[m]).reps;
        arr.forEach((s) => {
          if (!s.done) return;
          const planned = gezaehlteReps(s, reps);
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
  // Zeit im Training, aus dem Protokoll. Ältere Einheiten haben keine – die
  // Uhr wurde erst später mitgeschrieben; gezählt wird deshalb auch, wie viele
  // Einheiten überhaupt eine Zeit tragen.
  let seconds = 0;
  let mitZeit = 0;
  Object.values(log).forEach((e) => {
    if (e && e.secs > 0) { seconds += e.secs; mitZeit += 1; }
  });

  let customSets = 0;
  store.customs().forEach((c) => {
    const entry = log[c.id];
    if (!entry) return;
    ['db', 'bw'].forEach((m) => {
      c.ex.forEach((item) => {
        const arr = entry[m] && entry[m][item.id];
        const ex = EX_BY_ID.get(item.id);
        if (!Array.isArray(arr) || !ex) return;
        const reps = stufenWerte(ex[m]).reps;
        arr.slice(0, item.sets).forEach((x) => {
          if (!x.done) return;
          const planned = gezaehlteReps(x, reps);
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
           customSets, seconds, mitZeit };
}
