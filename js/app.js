import { EXERCISES, PLAN } from './data.js';
import * as store from './store.js';
import { todayISO, addDays, daysBetween, fmtDate, plural } from './dates.js';
import { mountFigure, clearFigures } from './figure.js';
import { mountBody, MUSCLE_LABEL } from './body.js';

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

function workoutByNo(n) {
  return PLAN.find((w) => w.n === n) || PLAN[0];
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
    name: v.name, reps: v.reps, equip: v.equip, cue: v.cue, rest: v.rest, pattern: v.pattern, img: v.img, muscles: v.muscles,
    // Zusatzgewicht gibt es nur in der Hantel-Variante und nur, wo die Übung
    // eines kennt – Chin-ups und Sliding Leg Curls etwa nicht.
    weight: mode === 'db' ? ex.weight : null,
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

const ui = {
  tab: 'dashboard',
  workoutNo: defaultWorkoutNo(),
  openEx: new Set(),
  planFilter: 'all',
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
    ${it.img ? '<div class="illu-credit">Abb.: Everkinetic · CC BY-SA 3.0</div>' : ''}

    <h2 class="focus-name">${esc(it.name)}</h2>
    <div class="focus-meta">${it.sets} Sätze × ${esc(it.reps)} Wdh. · ${esc(it.group)} · ${esc(it.equip)}</div>

    ${kg === null ? '' : `
      <div class="ex-weight focus-weight">
        <button type="button" class="kg-step" data-act="weight-step" data-ex="${it.id}" data-d="-2.5" aria-label="2,5 Kilo weniger">−</button>
        <div class="kg-main">
          <input type="text" inputmode="decimal" class="kg-val" value="${fmtKg(kg)}"
                 data-act="weight-input" data-ex="${it.id}" aria-label="Gewicht in Kilo">
          <span class="kg-unit">kg${it.weightNote ? ` · ${esc(it.weightNote)}` : ''}</span>
        </div>
        <button type="button" class="kg-step kg-plus" data-act="weight-step" data-ex="${it.id}" data-d="2.5" aria-label="2,5 Kilo mehr">+</button>
      </div>
      ${frozen ? `<div class="kg-next focus-next">Nächstes Mal: ${esc(fmtKg(next))} kg</div>` : ''}`}

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

    <div class="btn-row">
      <button type="button" class="btn btn-danger btn-block" data-act="end-session">Training beenden</button>
    </div>
  `;

  const host = document.getElementById('focusFig');
  if (host) mountFigure(host, it.pattern, it.weight !== null, it.img);
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

  // Eine Bildschirmseite, ohne Scrollen: Kopf, Körper, Start. Der Körper
  // nimmt sich den Platz, der zwischen den beiden übrig bleibt.
  view.innerHTML = `
    <section class="ov">
      ${store.canPersist() ? '' : `<div class="notice warn">⚠️ Dieser Browser lässt keine Speicherung zu –
        Eintragungen gehen beim Neuladen verloren.</div>`}

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
        .map((m) => `<span>${esc(MUSCLE_LABEL[m] || m)}</span>`).join('')}</div>

      <button type="button" class="btn btn-primary btn-block btn-start" data-act="start-session">
        ${prog.done ? '▶︎ Training fortsetzen' : '▶︎ Workout starten'}
      </button>

      <div class="ov-foot">
        <button type="button" class="ov-nav" data-act="nav-workout" data-delta="-1" ${n === PLAN[0].n ? 'disabled' : ''}>←</button>
        <button type="button" class="ov-nav wide" data-act="show-list">Übungen &amp; Gewichte</button>
        <button type="button" class="ov-nav" data-act="nav-workout" data-delta="1" ${n === PLAN[PLAN.length - 1].n ? 'disabled' : ''}>→</button>
      </div>
    </section>
  `;

  const host = document.getElementById('bodyMap');
  if (host) mountBody(host, muscles);
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
        ? `<div class="btn-row">
             <button type="button" class="btn btn-danger" data-act="end-session">Training beenden</button>
           </div>`
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

    // Gewichtszeile: ein Arbeitsgewicht je Übung, nicht je Satz. "+2,5 kg"
    // gilt ab dem nächsten Mal, sobald heute schon ein Satz steht.
    const kg = it.weight === null ? null : usedWeight(n, mode, it.id);
    const next = it.weight === null ? null : workingWeight(it.id);
    const frozen = kg !== null && next !== null && Math.abs(kg - next) > 0.01;
    const weightRow = kg === null ? '' : `
      <div class="ex-weight">
        <button type="button" class="kg-step" data-act="weight-step" data-ex="${it.id}" data-d="-2.5"
                aria-label="2,5 Kilo weniger">−</button>
        <div class="kg-main">
          <input type="text" inputmode="decimal" class="kg-val" value="${fmtKg(kg)}"
                 data-act="weight-input" data-ex="${it.id}" aria-label="Gewicht ${esc(it.name)} in Kilo">
          <span class="kg-unit">kg${it.weightNote ? ` · ${esc(it.weightNote)}` : ''}</span>
        </div>
        <button type="button" class="kg-step kg-plus" data-act="weight-step" data-ex="${it.id}" data-d="2.5"
                aria-label="2,5 Kilo mehr">+</button>
      </div>
      ${frozen ? `<div class="kg-next">Nächstes Mal: ${esc(fmtKg(next))} kg</div>` : ''}`;

    parts.push(`
      <article class="ex ${open ? 'open' : ''} ${complete ? 'complete' : ''}">
        <div class="ex-head" data-act="toggle-ex" data-ex="${it.id}" role="button" tabindex="0" aria-expanded="${open}">
          <span class="ex-idx">${complete ? '✓' : i + 1}</span>
          <span class="ex-main">
            <span class="ex-name">${esc(it.name)}</span>
            <span class="ex-meta">${it.sets} × ${esc(it.reps)} · ${esc(it.group)} · ${esc(it.equip)}</span>
          </span>
          <span class="ex-right"><span class="chev">▼</span></span>
        </div>
        ${weightRow}
        <div class="ex-sets">${setBtns}</div>
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
  `);

  view.innerHTML = parts.join('');
}

/** Letzter protokollierter Eintrag derselben Übung im selben Modus. */
function lastLoggedFor(exId, mode, beforeN) {
  for (let i = PLAN.length - 1; i >= 0; i--) {
    const w = PLAN[i];
    if (w.n >= beforeN) continue;
    const item = w.ex.find((x) => x.id === exId);
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
 * Plan
 * ------------------------------------------------------------------ */

function renderPlan() {
  const today = todayISO();
  const filters = [['all', 'Alle'], ['open', 'Offen'], ['done', 'Erledigt'], ['upcoming', 'Ab heute']];

  const rows = PLAN.filter((w) => {
    const done = completedMode(w.n);
    if (ui.planFilter === 'done') return !!done;
    if (ui.planFilter === 'open') return !done;
    if (ui.planFilter === 'upcoming') return effDate(w) >= today;
    return true;
  }).map((w) => {
    const cm = completedMode(w.n);
    const mode = store.workoutMode(w.n);
    const first = w.ex.slice(0, 3).map((i) => resolve(i, mode).name).join(' · ');
    const date = effDate(w);
    const isToday = date === today;
    return `
      <button type="button" class="plan-item ${isToday ? 'is-today' : ''} ${cm ? 'is-done' : ''}" data-act="open-workout" data-n="${w.n}">
        <span class="plan-n">${cm ? '✓' : w.n}</span>
        <span class="plan-main">
          <span class="plan-date">${esc(fmtDate(date))} ${isToday ? '· heute' : ''}</span>
          <span class="plan-sub">${esc(first)} …</span>
        </span>
        <span class="plan-flag">${cm ? (cm === 'db' ? '🏋️' : '🤸') : ''}</span>
      </button>`;
  });

  const shift = store.getState().shift;

  view.innerHTML = `
    <div class="section-title">Trainingsplan · ${PLAN.length} Einheiten</div>
    ${shift ? `<div class="notice">↷ Der Plan liegt ${esc(plural(shift, 'Tag', 'Tage'))} hinter dem Original – verpasste Termine sind nachgerückt.</div>` : ''}
    <div class="filter-row">
      ${filters.map(([k, l]) => `<button type="button" class="filter-btn" aria-pressed="${ui.planFilter === k}" data-act="plan-filter" data-f="${k}">${l}</button>`).join('')}
    </div>
    ${rows.length ? rows.join('') : '<div class="empty">Keine Einheiten in diesem Filter.</div>'}
  `;
}

/* ------------------------------------------------------------------ *
 * Statistik
 * ------------------------------------------------------------------ */

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
      w.ex.forEach((item) => {
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
    </div>

    <div class="section-title">Nächste Einheit</div>
    <div class="card">
      ${upcoming
        ? `<div class="plan-date">Workout ${upcoming.n} · ${esc(fmtDate(effDate(upcoming), true))}</div>
           <div class="small muted" style="margin-top:4px">${esc(upcoming.ex.map((i) => resolve(i, store.workoutMode(upcoming.n)).name).join(' · '))}</div>
           <div class="btn-row"><button type="button" class="btn btn-primary" data-act="open-workout" data-n="${upcoming.n}">Öffnen</button></div>`
        : '<div class="muted">Alle Einheiten des Plans sind abgeschlossen. Stark.</div>'}
    </div>

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
}

/* ------------------------------------------------------------------ *
 * Einstellungen
 * ------------------------------------------------------------------ */

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

    <div class="section-title">Daten</div>
    <div class="card">
      <div class="small muted">Alles liegt lokal im Browser. Sicherung als Text kopieren oder hier wieder einfügen.</div>
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

    <div class="section-title">Bildnachweis</div>
    <div class="card small muted">
      Ein Teil der Bewegungsbilder stammt von <b>Everkinetic</b> und steht unter
      <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener">CC BY-SA 3.0</a>.
      Sie wurden verkleinert und für den dunklen Hintergrund eingefärbt und stehen als
      Bearbeitung ebenfalls unter CC BY-SA 3.0. Die übrigen Bewegungen sind eigene Zeichnungen.
    </div>

    <div class="section-title">Über den Plan</div>
    <div class="card small muted">
      ${PLAN.length} Einheiten, ursprünglich vom ${esc(fmtDate(PLAN[0].date, true))} bis ${esc(fmtDate(PLAN[PLAN.length - 1].date, true))},
      aufgebaut auf ${EXERCISES.length} Grundübungen. Zu jeder Hantelübung gehört ein
      Bodyweight-Äquivalent mit gleicher Satzzahl und angepasstem Wiederholungsbereich.
    </div>
  `;
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
  plan: renderPlan,
  stats: renderStats,
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
}

function go(tab) {
  ui.tab = tab;
  render();
  window.scrollTo({ top: 0 });
}

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
    case 'start-session':
      initAudio(); // Ton jetzt freischalten, damit das erste Pausensignal sitzt
      store.startSession(n);
      ui.focus = true;
      ui.listView = false;
      ui.focusIdx = firstOpenExercise(n, mode);
      render();
      toast('Los geht’s 💪');
      break;
    case 'end-session':
      store.endSession();
      ui.focus = false;
      ui.listView = false;
      if (store.getState().rest) endRest(false);
      render();
      toast('Training beendet');
      break;
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
    case 'plan-filter':
      ui.planFilter = t.dataset.f;
      render();
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
    case 'download': {
      const json = store.exportJSON();
      // Manche Umgebungen – eingebettete Ansichten, strenge Browser – lassen
      // den Download stillschweigend fallen. Deshalb steht der Export danach
      // immer auch im Textfeld zum Kopieren.
      document.getElementById('io').value = json;
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `workout-backup-${todayISO()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast('Gesichert – falls kein Download kam: Text unten kopieren');
      break;
    }
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
