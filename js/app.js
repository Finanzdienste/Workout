import { EXERCISES, PLAN } from './data.js';
import * as store from './store.js';

/* ------------------------------------------------------------------ *
 * Hilfsfunktionen
 * ------------------------------------------------------------------ */

const EX_BY_ID = new Map(EXERCISES.map((e) => [e.id, e]));
const view = document.getElementById('view');
const tabbar = document.getElementById('tabbar');
const modeSwitch = document.getElementById('modeSwitch');
const toastEl = document.getElementById('toast');

const MODE_LABEL = { db: 'Hanteln', bw: 'Bodyweight' };
const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli',
  'August', 'September', 'Oktober', 'November', 'Dezember'];

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function todayISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function fmtDate(iso, long) {
  const d = parseISO(iso);
  const wd = WEEKDAYS[d.getDay()];
  if (long) return `${wd}, ${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  return `${wd}, ${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`;
}

function daysBetween(isoA, isoB) {
  return Math.round((parseISO(isoB) - parseISO(isoA)) / 86400000);
}

/** Das Workout für heute – exakter Treffer, sonst das nächste anstehende. */
function defaultWorkoutNo() {
  const t = todayISO();
  const exact = PLAN.find((w) => w.date === t);
  if (exact) return exact.n;
  const next = PLAN.find((w) => w.date > t);
  if (next) return next.n;
  return PLAN[PLAN.length - 1].n;
}

function workoutByNo(n) {
  return PLAN.find((w) => w.n === n) || PLAN[0];
}

/** Variante (db/bw) einer geplanten Übung inkl. Sätze. */
function resolve(item, mode) {
  const ex = EX_BY_ID.get(item.id);
  const v = ex[mode];
  return { id: item.id, sets: item.sets, group: ex.group, name: v.name, reps: v.reps, equip: v.equip, cue: v.cue };
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
    .some((s) => s.done || s.w !== '' || s.r !== ''));
}

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
  exSearch: '',
};

/* ------------------------------------------------------------------ *
 * Dashboard
 * ------------------------------------------------------------------ */

function renderDashboard() {
  const n = ui.workoutNo;
  const w = workoutByNo(n);
  const mode = store.workoutMode(n);
  const prog = progressOf(n, mode);
  const today = todayISO();
  const diff = daysBetween(today, w.date);

  let when;
  if (diff === 0) when = 'Heute';
  else if (diff === 1) when = 'Morgen';
  else if (diff === -1) when = 'Gestern';
  else if (diff > 1) when = `in ${diff} Tagen`;
  else when = `vor ${-diff} Tagen`;

  const items = w.ex.map((item) => resolve(item, mode));
  const totalSets = items.reduce((a, x) => a + x.sets, 0);

  const parts = [];

  parts.push(`
    <section class="card">
      <div class="hero-eyebrow">${esc(when)} · Workout ${w.n} von ${PLAN.length}</div>
      <h2 class="hero-title">${esc(fmtDate(w.date, true))}</h2>
      <div class="hero-sub">${MODE_LABEL[mode]} · ${items.length} Übungen · ${totalSets} Sätze</div>
      <div class="hero-badges">
        <span class="badge accent">${mode === 'db' ? '🏋️ Hantel-Variante' : '🤸 Bodyweight-Variante'}</span>
        ${prog.complete ? '<span class="badge done">✓ Abgeschlossen</span>'
                        : `<span class="badge">${prog.done}/${prog.total} Sätze</span>`}
      </div>
      <div class="progress"><i style="width:${prog.pct}%"></i></div>
      <div class="btn-row nav">
        <button type="button" class="btn btn-ghost" data-act="nav-workout" data-delta="-1" ${n === PLAN[0].n ? 'disabled' : ''}>← Vorheriges</button>
        <button type="button" class="btn btn-ghost" data-act="nav-today">Heute</button>
        <button type="button" class="btn btn-ghost" data-act="nav-workout" data-delta="1" ${n === PLAN[PLAN.length - 1].n ? 'disabled' : ''}>Nächstes →</button>
      </div>
    </section>
  `);

  parts.push('<div class="section-title">Übungen</div>');

  items.forEach((it, i) => {
    const sets = store.getSets(n, mode, it.id, it.sets);
    const doneCount = sets.filter((s) => s.done).length;
    const open = ui.openEx.has(it.id);
    const complete = doneCount === it.sets;
    const prev = lastLoggedFor(it.id, mode, n);

    const dots = sets.map((s) => `<i class="${s.done ? 'on' : ''}"></i>`).join('');

    const rows = sets.map((s, idx) => `
      <div class="set-row">
        <span class="set-no">Satz ${idx + 1}</span>
        ${mode === 'db'
          ? `<input type="text" inputmode="decimal" placeholder="kg" value="${esc(s.w)}"
                    data-act="set-input" data-field="w" data-ex="${it.id}" data-i="${idx}" aria-label="Gewicht Satz ${idx + 1}">`
          : `<input type="text" placeholder="Notiz" value="${esc(s.w)}"
                    data-act="set-input" data-field="w" data-ex="${it.id}" data-i="${idx}" aria-label="Notiz Satz ${idx + 1}">`}
        <input type="text" inputmode="numeric" placeholder="Wdh." value="${esc(s.r)}"
               data-act="set-input" data-field="r" data-ex="${it.id}" data-i="${idx}" aria-label="Wiederholungen Satz ${idx + 1}">
        <button type="button" class="chk" aria-pressed="${s.done}" aria-label="Satz ${idx + 1} erledigt"
                data-act="toggle-set" data-ex="${it.id}" data-i="${idx}">✓</button>
      </div>
    `).join('');

    parts.push(`
      <article class="ex ${open ? 'open' : ''} ${complete ? 'complete' : ''}">
        <div class="ex-head" data-act="toggle-ex" data-ex="${it.id}" role="button" tabindex="0" aria-expanded="${open}">
          <span class="ex-idx">${complete ? '✓' : i + 1}</span>
          <span class="ex-main">
            <span class="ex-name">${esc(it.name)}</span>
            <span class="ex-meta">${it.sets} × ${esc(it.reps)} · ${esc(it.group)} · ${esc(it.equip)}</span>
          </span>
          <span class="ex-right">
            <span class="set-dots">${dots}</span>
            <span class="chev">▼</span>
          </span>
        </div>
        <div class="ex-body">
          <div class="cue">${esc(it.cue)}</div>
          <div class="set-legend">
            <span></span><span>${mode === 'db' ? 'Gewicht' : 'Notiz'}</span><span>Wdh.</span><span></span>
          </div>
          ${rows}
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
    const filled = arr.filter((s) => s.r !== '' || s.w !== '');
    if (!filled.length) continue;
    const text = filled.map((s) => (mode === 'db' && s.w ? `${s.w}×${s.r || '?'}` : (s.r || '–'))).join(', ');
    return { n: w.n, text };
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
    if (ui.planFilter === 'upcoming') return w.date >= today;
    return true;
  }).map((w) => {
    const cm = completedMode(w.n);
    const mode = store.workoutMode(w.n);
    const first = w.ex.slice(0, 3).map((i) => resolve(i, mode).name).join(' · ');
    const isToday = w.date === today;
    return `
      <button type="button" class="plan-item ${isToday ? 'is-today' : ''} ${cm ? 'is-done' : ''}" data-act="open-workout" data-n="${w.n}">
        <span class="plan-n">${cm ? '✓' : w.n}</span>
        <span class="plan-main">
          <span class="plan-date">${esc(fmtDate(w.date))} ${isToday ? '· heute' : ''}</span>
          <span class="plan-sub">${esc(first)} …</span>
        </span>
        <span class="plan-flag">${cm ? (cm === 'db' ? '🏋️' : '🤸') : ''}</span>
      </button>`;
  });

  view.innerHTML = `
    <div class="section-title">Trainingsplan · ${PLAN.length} Einheiten</div>
    <div class="filter-row">
      ${filters.map(([k, l]) => `<button type="button" class="filter-btn" aria-pressed="${ui.planFilter === k}" data-act="plan-filter" data-f="${k}">${l}</button>`).join('')}
    </div>
    ${rows.length ? rows.join('') : '<div class="empty">Keine Einheiten in diesem Filter.</div>'}
  `;
}

/* ------------------------------------------------------------------ *
 * Übungs-Bibliothek
 * ------------------------------------------------------------------ */

function renderExercises() {
  const mode = store.getState().mode;
  const q = ui.exSearch.trim().toLowerCase();

  const list = EXERCISES.filter((e) => !q
    || e.db.name.toLowerCase().includes(q)
    || e.bw.name.toLowerCase().includes(q)
    || e.group.toLowerCase().includes(q));

  const cards = list.map((e) => `
    <article class="card lib-item">
      <div class="lib-group">${esc(e.group)}</div>
      <div class="swap">
        <div class="swap-side ${mode === 'db' ? 'active' : ''}">
          <div class="swap-label">🏋️ Hanteln</div>
          <div class="swap-name">${esc(e.db.name)}</div>
          <div class="swap-reps">${esc(e.db.reps)} Wdh. · ${esc(e.db.equip)}</div>
        </div>
        <div class="swap-arrow">⇄</div>
        <div class="swap-side ${mode === 'bw' ? 'active' : ''}">
          <div class="swap-label">🤸 Bodyweight</div>
          <div class="swap-name">${esc(e.bw.name)}</div>
          <div class="swap-reps">${esc(e.bw.reps)} Wdh. · ${esc(e.bw.equip)}</div>
        </div>
      </div>
      <div class="cue-pair"><b>Hanteln:</b> ${esc(e.db.cue)}</div>
      <div class="cue-pair"><b>Bodyweight:</b> ${esc(e.bw.cue)}</div>
    </article>
  `);

  view.innerHTML = `
    <div class="section-title">Übungen &amp; Bodyweight-Äquivalente</div>
    <div class="card" style="padding:10px 12px">
      <input type="search" class="io" style="min-height:0;font-family:inherit;font-size:14px;padding:10px"
             placeholder="Übung oder Muskelgruppe suchen…" value="${esc(ui.exSearch)}" data-act="ex-search">
    </div>
    ${cards.length ? cards.join('') : '<div class="empty">Nichts gefunden.</div>'}
    <p class="small muted">
      Jede der ${EXERCISES.length} Plan-Übungen hat ein Äquivalent ohne Zusatzgewicht.
      Die Satzzahl bleibt identisch, die Wiederholungsbereiche sind angepasst, damit die
      Variante ohne Zusatzlast sinnvoll schwer bleibt.
    </p>
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
        arr.forEach((s) => {
          if (!s.done) return;
          setsDone++;
          const r = parseFloat(String(s.r).replace(',', '.'));
          if (!Number.isNaN(r)) {
            repsTotal += r;
            const kg = parseFloat(String(s.w).replace(',', '.'));
            if (m === 'db' && !Number.isNaN(kg)) volume += kg * r;
          }
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
  const past = PLAN.filter((w) => w.date <= today);
  for (let i = past.length - 1; i >= 0; i--) {
    if (completedMode(past[i].n)) streak++;
    else break;
  }

  const upcoming = PLAN.find((w) => w.date >= today && !completedMode(w.n));

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
      <div class="stat"><div class="stat-v">${Math.round(repsTotal)}</div><div class="stat-l">Wiederholungen</div></div>
      <div class="stat"><div class="stat-v">${volume ? Math.round(volume).toLocaleString('de-DE') : '–'}</div><div class="stat-l">Volumen kg (Hanteln)</div></div>
      <div class="stat"><div class="stat-v">🏋️ ${doneDb} · 🤸 ${doneBw}</div><div class="stat-l">Modus-Verteilung</div></div>
    </div>

    <div class="section-title">Nächste Einheit</div>
    <div class="card">
      ${upcoming
        ? `<div class="plan-date">Workout ${upcoming.n} · ${esc(fmtDate(upcoming.date, true))}</div>
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

    <div class="section-title">Über den Plan</div>
    <div class="card small muted">
      ${PLAN.length} Einheiten von ${esc(fmtDate(PLAN[0].date, true))} bis ${esc(fmtDate(PLAN[PLAN.length - 1].date, true))},
      aufgebaut auf ${EXERCISES.length} Grundübungen. Zu jeder Hantelübung gehört ein
      Bodyweight-Äquivalent mit gleicher Satzzahl und angepasstem Wiederholungsbereich.
    </div>
  `;
}

/* ------------------------------------------------------------------ *
 * Rendering / Routing
 * ------------------------------------------------------------------ */

const RENDERERS = {
  dashboard: renderDashboard,
  plan: renderPlan,
  exercises: renderExercises,
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
      store.updateSet(n, mode, id, item.sets, i, { done: !cur });
      render();
      if (!cur && progressOf(n, mode).complete) toast('Workout abgeschlossen 🎉');
      break;
    }
    case 'complete-workout':
      store.completeWorkout(n, mode, workoutByNo(n).ex);
      render();
      toast('Alle Sätze abgehakt 🎉');
      break;
    case 'reset-workout':
      if (!hasAnyEntry(n, mode) || confirm(`Workout ${n} (${MODE_LABEL[mode]}) wirklich zurücksetzen?`)) {
        store.resetWorkout(n, mode);
        render();
        toast('Zurückgesetzt');
      }
      break;
    case 'nav-workout': {
      const next = n + Number(t.dataset.delta);
      if (PLAN.some((w) => w.n === next)) {
        ui.workoutNo = next;
        ui.openEx.clear();
        render();
      }
      break;
    }
    case 'nav-today':
      ui.workoutNo = defaultWorkoutNo();
      ui.openEx.clear();
      render();
      break;
    case 'open-workout':
      ui.workoutNo = Number(t.dataset.n);
      ui.openEx.clear();
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
    case 'export': {
      const io = document.getElementById('io');
      io.value = store.exportJSON();
      io.select();
      toast('Export erzeugt – kopieren und sicher ablegen.');
      break;
    }
    case 'download': {
      const blob = new Blob([store.exportJSON()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `workout-backup-${todayISO()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
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
  if (t.dataset.act === 'set-input') {
    const n = ui.workoutNo;
    const mode = store.workoutMode(n);
    const item = workoutByNo(n).ex.find((x) => x.id === t.dataset.ex);
    store.updateSet(n, mode, t.dataset.ex, item.sets, Number(t.dataset.i), { [t.dataset.field]: t.value });
  } else if (t.dataset.act === 'ex-search') {
    ui.exSearch = t.value;
    const pos = t.selectionStart;
    renderExercises();
    const again = view.querySelector('[data-act="ex-search"]');
    if (again) { again.focus(); again.setSelectionRange(pos, pos); }
  }
});

render();
