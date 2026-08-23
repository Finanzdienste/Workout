import { EXERCISES, PLAN } from './data.js';
import * as store from './store.js';
import { todayISO, addDays, daysBetween, fmtDate, plural } from './dates.js';
import { mountFigure, clearFigures } from './figure.js';
import { mountBody, MUSCLE_LABEL } from './body.js';
import { INJURIES, KIND_LABEL, CARE, CARE_LABEL, injuryById, applyInjuries, blocked, weeklyImpact, combosFor, careFor, needsClearance } from './injuries.js';
import { sparkPanel } from './chart.js';

/* ------------------------------------------------------------------ *
 * Hilfsfunktionen
 * ------------------------------------------------------------------ */

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
  return store.startedOn(w.n) || addDays(w.date, store.getState().shift);
}

/**
 * Verpasste Tage nachtragen: Ist der Termin der frühesten noch nicht
 * begonnenen Einheit verstrichen, wandert der gesamte Restplan um genau so
 * viele Tage nach hinten, bis diese Einheit auf heute fällt. Die Abstände
 * zwischen den Einheiten bleiben dabei erhalten.
 */
function catchUpPlan() {
  const s = store.getState();
  if (!s.autoShift) return 0;
  const open = PLAN.find((w) => !store.isStarted(w.n));
  if (!open) return 0;
  const missed = daysBetween(effDate(open), todayISO());
  if (missed <= 0) return 0;
  store.setShift(s.shift + missed);
  return missed;
}

/** Die Einheit, die als Nächstes ansteht: die erste noch nicht abgeschlossene. */
function defaultWorkoutNo() {
  const open = PLAN.find((w) => !completedMode(w.n));
  return open ? open.n : PLAN[PLAN.length - 1].n;
}

/** Angehakte Verletzungen. */
function activeInjuries() { return store.getState().injuries || []; }

/**
 * Übungsliste eines Plantags, angepasst an die angehakten Verletzungen.
 *
 * Alles in der App geht durch diese Stelle – Übersicht, Fokus, Statistik,
 * Steigerungsvorschlag. So kann es gar nicht passieren, dass an einer Stelle
 * eine gesperrte Übung auftaucht und an einer anderen nicht.
 */
function exOf(w) {
  const act = activeInjuries();
  return act.length ? applyInjuries(w.ex, act).items : w.ex;
}

function workoutByNo(n) {
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
    // Zusatzgewicht gibt es nur in der Hantel-Variante und nur, wo die Übung
    // eines kennt – Chin-ups und Sliding Leg Curls etwa nicht.
    weight: mode === 'db' ? ex.weight : null,
    gear: mode === 'db' ? ex.equip : null,    // Gerät der Figur; Bodyweight hat keins
    weightNote: ex.weightNote,
  };
}

/** Gewicht, mit dem diese Übung heute gearbeitet wird. */
function workingWeight(exId) {
  const ex = EX_BY_ID.get(exId);
  if (ex.weight === null) return null;
  const own = store.weightOf(exId);
  return own === null ? ex.weight : own;
}

/**
 * Gewicht, das in diesem Workout tatsächlich benutzt wurde. Sobald der erste
 * Satz steht, ist es festgeschrieben – ein späteres "+2,5 kg" gilt dann fürs
 * nächste Mal und schreibt die heutige Einheit nicht rückwirkend um.
 */
function usedWeight(n, mode, exId) {
  const logged = (store.peekSets(n, mode, exId) || []).find((s) => s.w !== '');
  if (logged) return parseFloat(logged.w);
  return workingWeight(exId);
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
    if (!sets || !sets.length) continue;
    const complete = sets.length >= item.sets && sets.slice(0, item.sets).every((x) => x.done);
    if (!complete) break;                       // Lücke beendet die Serie
    // Wer nach der Einheit "war schwer" angetippt hat, bekommt keinen
    // Vorschlag: dieselbe Last noch einmal sauber ist der nächste Schritt.
    if (store.effortOf(w.n, 'db', exId) === 'schwer') break;
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
      ${hint.streak}× alles geschafft · auf ${esc(fmtKg(hint.to))} kg?
    </button>`;
}

function fmtKg(kg) {
  return Number.isInteger(kg) ? String(kg) : kg.toFixed(1).replace('.', ',');
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
  return null;
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

let audioCtx = null;
let restTicker = null;
let wakeLock = null;

/**
 * Kurzes Doppelsignal zum Ende der Pause – erzeugt statt geladen, damit die
 * App ohne Netz und ohne zusätzliche Datei auskommt.
 *
 * Der AudioContext entsteht erst beim ersten Abhaken. Mobile Browser lassen
 * Ton nur zu, wenn er auf eine Berührung zurückgeht; genau die ist das.
 */
function initAudio() {
  if (audioCtx) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  try { audioCtx = new Ctx(); } catch { audioCtx = null; }
}

function beep() {
  if (!store.getState().sound || !audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  const now = audioCtx.currentTime;
  [0, 0.28].forEach((offset, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = i === 0 ? 880 : 1320;
    gain.gain.setValueAtTime(0.0001, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.35, now + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.22);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(now + offset);
    osc.stop(now + offset + 0.24);
  });
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
  holdScreen(true);
  tickRest();
}

function endRest(withSignal) {
  if (!restBar) return;
  if (restTicker) { clearInterval(restTicker); restTicker = null; }
  holdScreen(false);
  store.setRest(null);
  restBar.hidden = true;
  document.body.classList.remove('resting');
  if (withSignal) {
    beep();
    if (navigator.vibrate) navigator.vibrate([180, 90, 180]);
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
  restTime.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  restNext.textContent = rest.next;
  restFill.style.width = `${Math.max(0, (left / rest.total) * 100)}%`;

  if (!restTicker) restTicker = setInterval(tickRest, 250);
}

/** Laufzeit des Trainings im Kopfbereich mitzählen, ohne neu zu rendern. */
setInterval(() => {
  const badge = document.getElementById('sessionBadge');
  const sess = store.getState().session;
  if (!badge || !sess) return;
  const secs = Math.floor((Date.now() - sess.startedAt) / 1000);
  badge.textContent = `⏱ ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
}, 1000);

document.getElementById('restSkip')?.addEventListener('click', () => endRest(false));
document.getElementById('restPlus')?.addEventListener('click', () => {
  const rest = store.getState().rest;
  if (!rest) return;
  store.setRest({ ...rest, endsAt: rest.endsAt + 30000, total: rest.total + 30 });
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

const TABS = ['dashboard', 'stats', 'injuries', 'settings'];

const ui = {
  // Beim Neuladen im selben Tab bleiben. Die Seite lädt öfter neu, als man
  // denkt – nach einer Aktualisierung etwa –, und jedes Mal auf dem Dashboard
  // zu landen ist lästig.
  tab: TABS.includes(store.getState().tab) ? store.getState().tab : 'dashboard',
  workoutNo: defaultWorkoutNo(),
  openEx: new Set(),
  openInjury: new Set(),
  focus: false,    // Fokus-Ansicht: eine Übung groß
  listView: false, // Übungsliste statt Startansicht
  focusIdx: 0,
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

/**
 * Fokus-Ansicht: eine Übung groß, mit vorgeführter Bewegung. Sobald alle Sätze
 * stehen, rückt die App von selbst zur nächsten offenen Übung weiter.
 */
function renderFocus() {
  const n = ui.workoutNo;
  const w = workoutByNo(n);
  const mode = store.workoutMode(n);
  const prog = progressOf(n, mode);

  const i = Math.min(ui.focusIdx, w.ex.length - 1);
  const item = w.ex[i];
  const it = resolve(item, mode);
  const sets = store.getSets(n, mode, it.id, it.sets);
  const doneCount = sets.filter((s) => s.done).length;
  const kg = it.weight === null ? null : usedWeight(n, mode, it.id);
  const next = it.weight === null ? null : workingWeight(it.id);
  const frozen = kg !== null && next !== null && Math.abs(kg - next) > 0.01;

  view.innerHTML = `
    <div class="focus-top">
      <button type="button" class="back-link" data-act="focus-list">☰ Übersicht</button>
      <span class="focus-count">
        <span id="sessionBadge">⏱ 0:00</span> · Übung ${i + 1} von ${w.ex.length} · ${prog.done}/${prog.total} Sätze
      </span>
    </div>

    <div class="focus-fig" id="focusFig"></div>

    <h2 class="focus-name">${esc(it.name)}</h2>
    <div class="focus-meta">${it.sets} Sätze × ${esc(it.reps)} Wdh. · ${esc(it.group)} · ${esc(it.equip)}</div>

    ${kg === null ? '' : `
      <div class="ex-weight focus-weight">
        <button type="button" class="kg-step" data-act="weight-step" data-ex="${it.id}" data-d="${-stepOf(it.id)}"
                aria-label="${esc(fmtKg(stepOf(it.id)))} Kilo weniger">−</button>
        <div class="kg-main">
          <input type="text" inputmode="decimal" class="kg-val" value="${fmtKg(kg)}"
                 data-act="weight-input" data-ex="${it.id}" aria-label="Gewicht in Kilo">
          <span class="kg-unit">kg${it.weightNote ? ` · ${esc(it.weightNote)}` : ''}</span>
        </div>
        <button type="button" class="kg-step kg-plus" data-act="weight-step" data-ex="${it.id}" data-d="${stepOf(it.id)}"
                aria-label="${esc(fmtKg(stepOf(it.id)))} Kilo mehr">+</button>
      </div>
      ${frozen ? `<div class="kg-next focus-next">Nächstes Mal: ${esc(fmtKg(next))} kg</div>` : bumpChip(it.id, mode)}`}

    <div class="focus-sets">
      ${sets.map((s, idx) => `
        <button type="button" class="set-btn focus-set ${s.done ? 'on' : ''}" aria-pressed="${s.done}"
                aria-label="Satz ${idx + 1} von ${it.sets} erledigt"
                data-act="toggle-set" data-ex="${it.id}" data-i="${idx}">${s.done ? '✓' : idx + 1}</button>`).join('')}
    </div>

    <div class="cue focus-cue">${esc(it.cue)}</div>

    <div class="btn-row nav">
      <button type="button" class="btn btn-ghost" data-act="focus-step" data-d="-1" ${i === 0 ? 'disabled' : ''}>← Zurück</button>
      <button type="button" class="btn ${doneCount === it.sets ? 'btn-primary' : 'btn-ghost'}"
              data-act="focus-step" data-d="1" ${i === w.ex.length - 1 ? 'disabled' : ''}>Weiter →</button>
    </div>

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
      ${planDone ? `<div class="notice done-notice">🎉 Plan geschafft – alle ${PLAN.length} Einheiten.
        <button type="button" class="btn btn-primary btn-block" data-act="restart-plan"
                style="margin-top:10px">Von vorn beginnen</button>
        <span class="small muted">Die erreichten Gewichte bleiben stehen.</span></div>` : ''}
      ${due ? `<div class="notice warn">💾 ${esc(plural(due, 'Einheit', 'Einheiten'))} seit der letzten
        Sicherung. Alles liegt nur in diesem Browser.
        <button type="button" class="btn btn-block" data-act="backup-now" style="margin-top:10px">Jetzt sichern</button></div>` : ''}

      <header class="ov-top">
        <div class="hero-eyebrow">${esc(when)} · Workout ${w.n} von ${PLAN.length}</div>
        <h2 class="hero-title">${esc(fmtDate(date, true))}</h2>
        <div class="hero-sub">${MODE_LABEL[mode]} · ${items.length} Übungen · ${totalSets} Sätze${
          shift ? ` · Plan +${esc(plural(shift, 'Tag', 'Tage'))}` : ''}</div>
        ${prog.done ? `<div class="progress"><i style="width:${prog.pct}%"></i></div>
          <div class="ov-prog">${prog.done}/${prog.total} Sätze${prog.complete ? ' · abgeschlossen' : ''}</div>` : ''}
      </header>

      <div class="ov-body" id="bodyMap"></div>

      <div class="bm-legend">${[...muscles]
        .sort((a, b) => (primary.has(b) ? 1 : 0) - (primary.has(a) ? 1 : 0))
        .map((m) => `<span class="${primary.has(m) ? '' : 'sub'}">${esc(MUSCLE_LABEL[m] || m)}</span>`).join('')}</div>

      <button type="button" class="btn btn-primary btn-block btn-start" data-act="start-session">
        ${prog.done ? '▶︎ Training fortsetzen' : '▶︎ Workout starten'}
      </button>

      <div class="ov-foot">
        <button type="button" class="ov-nav" data-act="nav-workout" data-delta="-1" ${n === PLAN[0].n ? 'disabled' : ''}>←</button>
        <button type="button" class="ov-nav wide" data-act="show-list">Übungen &amp; Gewichte</button>
        <button type="button" class="ov-nav" data-act="nav-workout" data-delta="1" ${n === PLAN[PLAN.length - 1].n ? 'disabled' : ''}>→</button>
      </div>
    </section>
    ${injuryNote(w, mode)}
  `;

  const host = document.getElementById('bodyMap');
  if (host) mountBody(host, muscles, primary);
}

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
      <div class="hero-eyebrow">${esc(when)} · Workout ${w.n} von ${PLAN.length}</div>
      <h2 class="hero-title">${esc(fmtDate(date, true))}</h2>
      <div class="hero-sub">${MODE_LABEL[mode]} · ${items.length} Übungen · ${totalSets} Sätze</div>
      <div class="hero-badges">
        <span class="badge accent">${mode === 'db' ? '🏋️ Hantel-Variante' : '🤸 Bodyweight-Variante'}</span>
        ${prog.complete ? '<span class="badge done">✓ Abgeschlossen</span>'
                        : `<span class="badge">${prog.done}/${prog.total} Sätze</span>`}
        ${shift ? `<span class="badge" title="Ursprünglich ${esc(fmtDate(w.date))}">↷ Plan +${esc(plural(shift, 'Tag', 'Tage'))}</span>` : ''}
        ${session ? '<span class="badge accent" id="sessionBadge">⏱ läuft</span>' : ''}
      </div>
      <div class="progress"><i style="width:${prog.pct}%"></i></div>
      ${session
        ? sessionButtons(n, mode)
        : `<div class="btn-row">
             <button type="button" class="btn btn-primary btn-block" data-act="start-session">▶︎ Workout starten</button>
           </div>`}
      <div class="btn-row nav">
        <button type="button" class="btn btn-ghost" data-act="nav-workout" data-delta="-1" ${n === PLAN[0].n ? 'disabled' : ''}>← Vorheriges</button>
        <button type="button" class="btn btn-ghost" data-act="nav-today">Heute</button>
        <button type="button" class="btn btn-ghost" data-act="nav-workout" data-delta="1" ${n === PLAN[PLAN.length - 1].n ? 'disabled' : ''}>Nächstes →</button>
      </div>
    </section>
  `);

  parts.push(`<div class="focus-top">
      <button type="button" class="back-link" data-act="${store.getState().session ? 'focus-back' : 'hide-list'}">‹ Zurück</button>
      <span class="focus-count">${w.ex.length} Übungen · ${prog.done}/${prog.total} Sätze</span>
    </div>`);

  // Aufwärmen steht vor der ersten Übung, nicht darunter – dort liest es
  // niemand mehr, wenn schon der erste Satz abgehakt ist.
  parts.push(warmupCard(items, n, mode));

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
    const kg = it.weight === null ? null : usedWeight(n, mode, it.id);
    const next = it.weight === null ? null : workingWeight(it.id);
    const frozen = kg !== null && next !== null && Math.abs(kg - next) > 0.01;
    const weightRow = kg === null ? '' : `
      <div class="ex-weight">
        <button type="button" class="kg-step" data-act="weight-step" data-ex="${it.id}" data-d="${-stepOf(it.id)}"
                aria-label="${esc(fmtKg(stepOf(it.id)))} Kilo weniger">−</button>
        <div class="kg-main">
          <input type="text" inputmode="decimal" class="kg-val" value="${fmtKg(kg)}"
                 data-act="weight-input" data-ex="${it.id}" aria-label="Gewicht ${esc(it.name)} in Kilo">
          <span class="kg-unit">kg${it.weightNote ? ` · ${esc(it.weightNote)}` : ''}</span>
        </div>
        <button type="button" class="kg-step kg-plus" data-act="weight-step" data-ex="${it.id}" data-d="${stepOf(it.id)}"
                aria-label="${esc(fmtKg(stepOf(it.id)))} Kilo mehr">+</button>
      </div>
      ${frozen ? `<div class="kg-next">Nächstes Mal: ${esc(fmtKg(next))} kg</div>` : bumpChip(it.id, mode)}`;

    // Im Bodyweight-Modus gibt es kein Gewicht – dort ist die Steigerung die
    // Wiederholungszahl, und der Vorschlag hängt an "ging leicht".
    // Den *neuen* Bereich zeigen, nicht den alten mit einem Plus dahinter –
    // sonst muss man beim Lesen selbst rechnen.
    const bwZiel = String(it.reps).replace(/\d+/g, (d) => String(Number(d) + store.bwPlusOf(it.id) + 2));
    const bwChip = mode === 'bw' && bwBump(it.id)
      ? `<button type="button" class="kg-bump" data-act="bw-bump" data-ex="${it.id}">
           2× ging leicht · nächstes Mal ${esc(bwZiel)} Wdh.?
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
        ${effortRow(n, mode, it.id, complete)}
        <div class="ex-body">
          <div class="cue">${esc(it.cue)}</div>
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

function renderStats() {
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

  const upcoming = PLAN.find((w) => !completedMode(w.n));

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
      <div class="stat"><div class="stat-v">${setsDone}</div><div class="stat-l">Sätze abgehakt</div></div>
      <div class="stat"><div class="stat-v">${repsTotal ? `ca. ${Math.round(repsTotal)}` : '–'}</div><div class="stat-l">Wiederholungen (geplant)</div></div>
      <div class="stat"><div class="stat-v">${volume ? `ca. ${Math.round(volume).toLocaleString('de-DE')}` : '–'}</div><div class="stat-l">Volumen kg (Hanteln)</div></div>
      <div class="stat"><div class="stat-v">🏋️ ${doneDb} · 🤸 ${doneBw}</div><div class="stat-l">Modus-Verteilung</div></div>
      ${store.getState().rounds.length
        ? `<div class="stat"><div class="stat-v">${store.getState().rounds.length}</div><div class="stat-l">Runden abgeschlossen</div></div>` : ''}
    </div>

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
 * Aufwärmen
 *
 * Der Plan fing bisher kalt an: drei Sätze Rudern mit 16 kg als Erstes. Was
 * hier steht, ist bewusst knapp und zählt nicht ins Wochenvolumen – es ist
 * Vorbereitung, kein Training.
 * ------------------------------------------------------------------ */

/** Auf ein Vielfaches der Schrittweite runden, mindestens einen Schritt. */
function roundToStep(kg, step) {
  return Math.max(step, Math.round(kg / step) * step);
}

function warmupCard(items, n, mode) {
  if (!items.length) return '';
  const erste = items[0];
  const kg = mode === 'db' && erste.weight !== null ? usedWeight(n, mode, erste.id) : null;
  const step = stepOf(erste.id);
  const offen = ui.openEx.has('__warmup');
  const saetze = kg === null
    ? `<li>Ein lockerer Satz <b>${esc(erste.name)}</b> mit halber Wiederholungszahl.</li>`
    : `<li>1 × 8 <b>${esc(erste.name)}</b> mit ${esc(fmtKg(roundToStep(kg * 0.5, step)))} kg</li>
       <li>1 × 5 mit ${esc(fmtKg(roundToStep(kg * 0.75, step)))} kg</li>`;
  // Bewusst eigene Klassen statt .ex: das hier ist keine Übung, wird nicht
  // abgehakt und zählt nirgends mit. Als .ex hätte es sich in jede Zählung
  // eingeschlichen – in der App wie in den Testreihen.
  return `
    <article class="warmup">
      <div class="warm-head" data-act="toggle-ex" data-ex="__warmup" role="button" tabindex="0"
           aria-expanded="${offen}">
        <span class="warm-icon">🔥</span>
        <span class="warm-main">
          <span class="warm-name">Aufwärmen</span>
          <span class="warm-meta">3 Minuten · zählt nicht mit</span>
        </span>
        <span class="chev">▼</span>
      </div>
      ${offen ? `<div class="warm-body">
        <div class="cue">Zwei, drei Minuten, bis dir warm ist: Hampelmänner, Seilspringen
          oder zügiges Treppensteigen. Dann die Gelenke, die gleich arbeiten – Arme
          kreisen, Hüfte kreisen, ein paar tiefe Kniebeugen ohne Gewicht.</div>
        <ul class="warm-list">${saetze}</ul>
        <div class="small muted">Die Anlaufsätze machen nicht müde, sie stellen die
          Bewegung ein. Erst danach steht das Arbeitsgewicht.</div>
      </div>` : ''}
    </article>`;
}

/* ------------------------------------------------------------------ *
 * Wie war das?
 *
 * Ein Griff nach dem letzten Satz. Damit weiß die App zweierlei: ob der
 * Steigerungsvorschlag mit Hanteln gerechtfertigt ist – und im
 * Bodyweight-Modus, wo es kein Gewicht zu erhöhen gibt, ob es Zeit für ein
 * paar Wiederholungen mehr ist.
 * ------------------------------------------------------------------ */

const EFFORT = [
  ['leicht', 'ging leicht'],
  ['ok', 'passte'],
  ['schwer', 'war schwer'],
];

function effortRow(n, mode, exId, complete) {
  if (!complete) return '';
  const cur = store.effortOf(n, mode, exId);
  return `
    <div class="effort">
      <span class="effort-q">Wie war das?</span>
      ${EFFORT.map(([key, label]) => `
        <button type="button" class="effort-btn ${cur === key ? 'on' : ''}"
                aria-pressed="${cur === key}" data-act="set-effort"
                data-ex="${exId}" data-v="${key}">${label}</button>`).join('')}
    </div>`;
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
 * Bedingung wie bei den Hanteln – die letzten beiden Male vollständig
 * durchgezogen –, nur zählt hier nicht das Gewicht, sondern dass es beide Male
 * als leicht durchging.
 */
function bwBump(exId) {
  let streak = 0;
  for (let i = PLAN.length - 1; i >= 0; i--) {
    const w = PLAN[i];
    const item = exOf(w).find((x) => x.id === exId);
    if (!item) continue;
    const sets = store.peekSets(w.n, 'bw', exId);
    if (!sets || !sets.length) continue;
    const complete = sets.length >= item.sets && sets.slice(0, item.sets).every((x) => x.done);
    if (!complete) break;
    if (store.effortOf(w.n, 'bw', exId) !== 'leicht') break;
    streak += 1;
    if (streak >= BUMP_NEEDED) return streak;
  }
  return 0;
}

/* ------------------------------------------------------------------ *
 * Wochenvolumen: Soll gegen Ist
 *
 * Der ganze Plan ist darauf gebaut, dass jede Muskelgruppe zehn Sätze pro
 * Woche bekommt – und genau das war bisher nirgends nachzusehen. Verpasste
 * Einheiten, abgebrochene Trainings und jede angehakte Verletzung verschieben
 * diese Zahl, unsichtbar.
 *
 * Gezählt wird, was wirklich abgehakt ist, in beiden Varianten mit den
 * jeweiligen Anteilen. Eine Woche sind WEEK_SESSIONS aufeinanderfolgende
 * Einheiten des Plans – dieselbe Einteilung, mit der tools/build-plan.py
 * rechnet.
 * ------------------------------------------------------------------ */

const TARGET_SETS = 10;
const WEEK_SESSIONS = 4;

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
      ['db', 'bw'].forEach((m) => {
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
    });
    weeks.push({ nr: weeks.length + 1, from: block[0], to: block[block.length - 1], acc, any });
  }
  return weeks;
}

/** Balken für eine Muskelgruppe: erreicht gegen die zehn. */
function volumeBar(mus, got) {
  const pct = Math.min(150, (got / TARGET_SETS) * 100);
  const state = got >= TARGET_SETS - 0.5 ? 'full' : (got >= TARGET_SETS * 0.6 ? 'part' : 'thin');
  return `
    <div class="vol-row">
      <div class="vol-name">${esc(MUSCLE_LABEL[mus] || mus)}</div>
      <div class="vol-track"><i class="vol-fill ${state}" style="width:${Math.min(100, pct).toFixed(0)}%"></i></div>
      <div class="vol-num">${got.toFixed(1).replace('.', ',')}</div>
    </div>`;
}

function renderWeeklyVolume() {
  const host = document.getElementById('volWeek');
  if (!host) return;
  const weeks = weeklyDone();
  const done = weeks.filter((w) => w.any);
  if (!done.length) {
    host.innerHTML = '<div class="card muted small">Sobald die erste Einheit steht, '
      + 'zeigt sich hier, wie nah du an den zehn Sätzen je Muskelgruppe bist.</div>';
    return;
  }
  // Die zuletzt begonnene Woche ist die interessante – nicht die letzte des Plans.
  const cur = done[done.length - 1];
  const prev = done.length > 1 ? done[done.length - 2] : null;
  const groups = Object.keys(MUSCLE_LABEL);
  // Nicht in Prozent: eine Woche mit 9,5 und 10,5 wären 99 %, obwohl alles
  // stimmt – der Plan selbst schwankt um einen halben Satz. Gezählt wird
  // deshalb, wie viele Gruppen ihr Ziel erreicht haben.
  const voll = groups.filter((m) => (cur.acc[m] || 0) >= TARGET_SETS - 0.5).length;
  const offen = PLAN.slice(PLAN.indexOf(cur.from), PLAN.indexOf(cur.to) + 1)
    .filter((w) => !completedMode(w.n)).length;

  host.innerHTML = `
    <div class="card">
      <div class="vol-head">
        <div>
          <div class="lbl">Woche ${cur.nr} · ${plural(voll, 'Gruppe', 'Gruppen')} im Ziel</div>
          <div class="hint">${esc(fmtDate(effDate(cur.from)))} – ${esc(fmtDate(effDate(cur.to)))}${
            offen ? ` · ${plural(offen, 'Einheit', 'Einheiten')} offen` : ' · abgeschlossen'}</div>
        </div>
        <div class="vol-quote">${voll}<span>/${groups.length}</span></div>
      </div>
      ${groups.map((m) => volumeBar(m, cur.acc[m] || 0)).join('')}
      <div class="small muted" style="margin-top:10px">
        Ziel sind 10 Sätze je Gruppe, Anteile eingerechnet – bei ${offen ? 'noch offenen Einheiten ist die Woche naturgemäß unvollständig'
          : 'einer vollen Woche sollte alles bei 10 stehen'}.
        ${prev ? `Woche davor: ${groups.filter((m) => (prev.acc[m] || 0) >= TARGET_SETS - 0.5).length}
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
  const src = PLAN.find((x) => x.n === w.n) || w;
  const { dropped, swapped } = applyInjuries(src.ex, act);
  const names = act.map((id) => (injuryById(id) || {}).name).filter(Boolean);
  const nm = (id) => resolve({ id, sets: 0 }, mode).name;
  const lines = [];
  swapped.forEach((s) => lines.push(`${esc(nm(s.from))} → ${esc(nm(s.to))}`));
  dropped.forEach((d) => lines.push(`${esc(nm(d.id))} fällt aus`));
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
  PLAN.forEach((w) => {
    const r = applyInjuries(w.ex, act);
    r.dropped.forEach((d) => gone.push(d));
    r.swapped.forEach((s) => {
      const key = `${s.from}→${s.to}`;
      swapCount.set(key, (swapCount.get(key) || 0) + s.sets);
    });
  });
  const goneSets = new Map();
  gone.forEach((d) => goneSets.set(d.id, (goneSets.get(d.id) || 0) + d.sets));

  const impact = act.length ? weeklyImpact(PLAN, EX_BY_ID, act, mode, PLAN_WEEKS) : {};
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

function renderSettings() {
  const s = store.getState();
  view.innerHTML = `
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
      <div class="switch-row">
        <div>
          <div class="lbl">Verpasste Tage nachrücken</div>
          <div class="hint">Bleibt an einem Trainingstag alles unangetastet, wandert der gesamte Restplan einen Tag weiter. Abstände bleiben erhalten.</div>
        </div>
        <button type="button" class="toggle" aria-pressed="${s.autoShift}" data-act="toggle-auto-shift" aria-label="Verpasste Tage nachrücken"></button>
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
          <div class="lbl">Signalton</div>
          <div class="hint">Zusätzlich vibriert das Handy. Der Ton wird erzeugt, nicht geladen – funktioniert also auch ohne Netz.</div>
        </div>
        <button type="button" class="toggle" aria-pressed="${s.sound}" data-act="toggle-sound" aria-label="Signalton"></button>
      </div>
      <div class="switch-row">
        <div>
          <div class="lbl">Pause abschalten</div>
          <div class="hint">Kein Timer, kein Ton – Sätze nur abhaken.</div>
        </div>
        <button type="button" class="toggle" aria-pressed="${!s.useExerciseRest && !s.restSeconds}" data-act="toggle-rest-off" aria-label="Pause abschalten"></button>
      </div>
    </div>

    <div class="section-title">Plan-Verschiebung</div>
    <div class="card">
      <div class="stat-v">${s.shift ? `+${esc(plural(s.shift, 'Tag', 'Tage'))}` : 'Im Plan'}</div>
      <div class="small muted" style="margin-top:2px">
        ${s.shift
          ? `Der offene Plan endet am ${esc(fmtDate(effDate(PLAN[PLAN.length - 1]), true))} statt am ${esc(fmtDate(PLAN[PLAN.length - 1].date, true))}.`
          : 'Der Plan läuft genau nach Excel-Termin.'}
      </div>
      <div class="btn-row nav">
        <button type="button" class="btn" data-act="shift-minus" ${s.shift ? '' : 'disabled'}>− 1 Tag</button>
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

const RENDERERS = {
  dashboard: () => {
    const sess = store.getState().session;
    if (ui.focus && sess && sess.n === ui.workoutNo) renderFocus();
    else if (ui.listView) renderDashboard();
    else renderOverview();
  },
  stats: renderStats,
  injuries: renderInjuries,
  settings: renderSettings,
};

function render() {
  const mode = ui.tab === 'dashboard' ? store.workoutMode(ui.workoutNo) : store.getState().mode;
  document.body.classList.toggle('mode-bw', mode === 'bw');
  modeSwitch.querySelectorAll('.mode-btn').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
  });
  tabbar.querySelectorAll('.tab').forEach((b) => {
    b.setAttribute('aria-selected', String(b.dataset.tab === ui.tab));
  });
  clearFigures(); // alte Animationen abmelden, bevor das DOM ersetzt wird
  (RENDERERS[ui.tab] || renderDashboard)();
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
    case 'set-effort': {
      const id = t.dataset.ex;
      const v = t.dataset.v;
      store.setEffort(n, mode, id, store.effortOf(n, mode, id) === v ? null : v);
      render();
      break;
    }
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
      if (!cur && variant.weight !== null) patch.w = fmtKg(usedWeight(n, mode, id));
      else if (cur) patch.w = '';
      store.updateSet(n, mode, id, item.sets, i, patch);

      const done = !cur;
      const workoutComplete = done && progressOf(n, mode).complete;
      const exDone = done && i === item.sets - 1
        && store.getSets(n, mode, id, item.sets).every((s) => s.done);

      // In der Fokus-Ansicht von selbst zur nächsten offenen Übung rücken.
      if (ui.focus && exDone && !workoutComplete) {
        const nextIdx = firstOpenExercise(n, mode);
        if (nextIdx !== ui.focusIdx) {
          ui.focusIdx = nextIdx;
          toast(`Weiter: ${resolve(workoutByNo(n).ex[nextIdx], mode).name}`);
        }
      }
      render();
      // Pause nur nach einem gesetzten Haken und nie nach dem letzten Satz
      // einer Übung – und auch nicht, wenn das Workout damit fertig ist.
      if (done && !workoutComplete && i < item.sets - 1) {
        startRest(variant.name, i, item.sets, restFor(variant));
      } else if (store.getState().rest) {
        endRest(false);
      }
      if (workoutComplete) toast('Workout abgeschlossen 🎉');
      break;
    }
    case 'weight-step': {
      const id = t.dataset.ex;
      const kg = store.setWeight(id, (workingWeight(id) || 0) + Number(t.dataset.d));
      render();
      // Steht heute schon ein Satz, gilt die Änderung erst beim nächsten Mal.
      const started = (store.peekSets(n, mode, id) || []).some((s) => s.w !== '');
      toast(started ? `Nächstes Mal ${fmtKg(kg)} kg` : `${fmtKg(kg)} kg`);
      break;
    }
    case 'accept-bump': {
      const id = t.dataset.ex;
      const kg = store.setWeight(id, Number(t.dataset.kg));
      render();
      toast(`Nächstes Mal ${fmtKg(kg)} kg 💪`);
      break;
    }
    case 'restart-plan': {
      // Runde 1 wandert in die Ablage, die Gewichte bleiben. Workout 1 rückt
      // auf heute, sonst würde die Nachrück-Automatik den halben Plan
      // verschieben, weil das Originaldatum längst vorbei ist.
      const target = Math.max(0, daysBetween(PLAN[0].date, todayISO()));
      store.restartPlan(target);
      ui.workoutNo = PLAN[0].n;
      ui.focus = false;
      ui.listView = false;
      ui.openEx.clear();
      render();
      toast('Neue Runde – viel Erfolg 💪');
      break;
    }
    case 'backup-now':
      downloadBackup();
      render();
      break;
    case 'start-session':
      initAudio(); // Ton jetzt freischalten, damit das erste Pausensignal sitzt
      store.startSession(n);
      ui.focus = true;
      ui.listView = false;
      ui.focusIdx = firstOpenExercise(n, mode);
      render();
      toast('Los geht’s 💪');
      break;
    case 'finish-session': {
      const prog = progressOf(n, mode);
      store.endSession();
      ui.focus = false;
      ui.listView = false;
      if (store.getState().rest) endRest(false);
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
    case 'focus-step':
      ui.focusIdx = Math.max(0, Math.min(workoutByNo(n).ex.length - 1, ui.focusIdx + Number(t.dataset.d)));
      render();
      break;
    case 'complete-workout':
      store.completeWorkout(n, mode, workoutByNo(n).ex);
      if (store.getState().rest) endRest(false);
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
    case 'nav-workout': {
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
    case 'toggle-auto-shift': {
      const on = !store.getState().autoShift;
      store.setSetting('autoShift', on);
      if (on) catchUpPlan();
      render();
      toast(on ? 'Verpasste Tage rücken nach' : 'Plan bleibt auf den Original-Terminen');
      break;
    }
    case 'set-rest':
      initAudio();
      store.setSetting('restSeconds', Number(t.dataset.sec));
      render();
      break;
    case 'toggle-sound': {
      initAudio();
      const on = !store.getState().sound;
      store.setSetting('sound', on);
      render();
      if (on) beep();
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
    store.flush();
    return;
  }
  tickRest(); // war das Handy gesperrt, ist die Pause womöglich abgelaufen
  const day = todayISO();
  const shifted = catchUpPlan();
  if (shifted || day !== lastSeenDay) {
    lastSeenDay = day;
    render();
  }
});

window.addEventListener('pagehide', store.flush);

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
render();
tickRest(); // eine Pause, die einen Neustart der Seite überdauert hat
if (missedAtStart) {
  toast(`↷ ${plural(missedAtStart, 'Tag', 'Tage')} verpasst – Plan nachgerückt`);
}
