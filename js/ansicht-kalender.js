/* ------------------------------------------------------------------ *
 * Kalender – das Monatsraster
 *
 * Der Plan steht als Liste von Einheiten da, aber gelebt wird er in Tagen:
 * Wann war ich dran, wann war ich es nicht, was kommt. Gezeigt wird deshalb
 * ein gewöhnliches Monatsraster – und zwar mit den *tatsächlichen* Terminen
 * aus effDate(), nicht mit den Plandaten, sonst stimmt nach dem ersten
 * verpassten Tag nichts mehr.
 *
 * Nur die Rechnung und das Erzeugen der Kacheln. Welcher Tag gewählt ist und
 * welcher Monat gezeigt wird, weiß js/app.js; diese Datei bekommt beides als
 * Argument. Sonst hinge die Ansicht am Zustand der Oberfläche und ließe sich
 * nicht für sich prüfen.
 * ------------------------------------------------------------------ */
import * as store from './store.js';
import { PLAN } from './data.js';
import { esc } from './text.js';
import { fmtDate, monthStart, plural, todayISO } from './dates.js';
import { completedMode, effDate, exOf, progressOf, resolve } from './plan.js';
import { MODE_ICON, MODE_LABEL, repsLabel } from './anzeige.js';

/** Zustand eines Kalendertags. Reihenfolge zählt: erledigt schlägt alles. */
export function dayState(w, iso, today) {
  if (!w) return null;
  const done = completedMode(w.n);
  if (done) return { kind: 'done', mode: done };
  const angefangen = store.isStarted(w.n);
  if (iso < today) return { kind: angefangen ? 'part' : 'miss', mode: store.workoutMode(w.n) };
  return { kind: angefangen ? 'part' : 'plan', mode: store.workoutMode(w.n) };
}

export const KIND_TEXT = { done: 'trainiert', part: 'angefangen', miss: 'ausgefallen', plan: 'geplant' };

/**
 * Tage, an denen unter einem anderen Plan trainiert wurde.
 *
 * Der Kalender zeichnet den Plan: PLAN.forEach, effDate, fertig. Nach einem
 * Fokuswechsel steht darin nur noch der neue Plan – *„anscheinend hat er damit
 * vergessen dass ich gestern und vorgestern trainiert hab."* Vergessen war
 * nichts, die Tage stehen im abgelegten Protokoll; sie wurden nur nicht mehr
 * gezeigt. Ein Trainingstag gehört aber dem Tag, nicht dem Plan.
 *
 * Welche Übungen es waren, weiß der Kalender nicht mehr – der Plan dazu ist
 * nicht geladen. Gezeigt werden deshalb Tag, Modus und die Zahl der Sätze.
 */
export function fruehereTage() {
  const map = new Map();
  (store.getState().rounds || []).forEach((r) => {
    Object.values(r.log || {}).forEach((e) => {
      if (!e || !e.startedOn) return;
      const proModus = { db: 0, bw: 0 };
      ['db', 'bw'].forEach((m) => {
        Object.values(e[m] || {}).forEach((arr) => {
          if (Array.isArray(arr)) arr.forEach((s) => { if (s && s.done) proModus[m] += 1; });
        });
      });
      const saetze = proModus.db + proModus.bw;
      if (!saetze) return;
      const da = map.get(e.startedOn)
        || { saetze: 0, einheiten: 0, mode: e.done || (proModus.bw > proModus.db ? 'bw' : 'db') };
      da.saetze += saetze;
      da.einheiten += 1;
      map.set(e.startedOn, da);
    });
  });
  return map;
}

export function calendarCell(iso, month, today, byDate, sel, frueher) {
  const ws = byDate.get(iso) || [];
  const st = dayState(ws[0], iso, today);
  // Der laufende Plan hat Vorrang: Steht heute eine Einheit an, ist das die
  // Auskunft, und nicht das, was vor einem Fokuswechsel an diesem Tag war.
  const alt = st ? null : (frueher && frueher.get(iso)) || null;
  const cls = ['cal-cell'];
  if (iso.slice(0, 7) !== month.slice(0, 7)) cls.push('out');
  if (iso === today) cls.push('today');
  if (iso === sel) cls.push('sel');
  if (st) cls.push(st.kind, st.mode);
  else if (alt) cls.push('done', 'frueher', alt.mode);
  const tag = Number(iso.slice(8));
  // Ohne Einheit ist der Tag kein Knopf: nichts anzuzeigen, nichts zu tippen.
  if (!st && !alt) return `<div class="${cls.join(' ')}"><span class="cal-num">${tag}</span></div>`;
  const anzahl = st ? ws.length : alt.einheiten;
  const modus = st ? st.mode : alt.mode;
  const mehr = anzahl > 1 ? ` (+${anzahl - 1})` : '';
  return `
    <button type="button" class="${cls.join(' ')}" data-act="cal-day" data-iso="${iso}"
            aria-pressed="${iso === sel}"
            aria-label="${esc(fmtDate(iso, true))}: ${plural(anzahl, 'Einheit', 'Einheiten')} ${
              esc(st ? KIND_TEXT[st.kind] : 'trainiert, früherer Plan')}, ${esc(MODE_LABEL[modus])}">
      <span class="cal-num">${tag}</span>
      <span class="cal-mark">${st && st.kind === 'miss' ? '·' : MODE_ICON[modus]}${mehr}</span>
    </button>`;
}

/** Die angetippte Einheit im Detail: Übungen, Sätze, Modus. */
export function calendarDetail(iso, byDate, today, frueher) {
  const ws = byDate.get(iso) || [];
  const alt = ws.length ? null : (frueher && frueher.get(iso)) || null;
  if (alt) {
    return `
      <div class="card cal-detail">
        <div class="cal-det-head">
          <div>
            <div class="lbl">${plural(alt.einheiten, 'Einheit', 'Einheiten')} · trainiert</div>
            <div class="hint">${esc(fmtDate(iso, true))} · ${plural(alt.saetze, 'Satz', 'Sätze')}</div>
          </div>
          <span class="chip ${alt.mode}">${MODE_ICON[alt.mode]} ${esc(MODE_LABEL[alt.mode])}</span>
        </div>
        <div class="small muted">Aus einem früheren Trainingsplan. Die Übungen dazu stehen in
          dem Plan, der damals galt – die Sätze und Kilo zählen in der Statistik weiter mit.</div>
      </div>`;
  }
  if (!ws.length) {
    return `<div class="card muted small">Kein Training an diesem Tag. Tippe einen
      markierten Tag an, um die Einheit zu sehen.</div>`;
  }
  // Zwei Einheiten an einem Tag gibt es wirklich – etwa wenn zwei an
  // demselben Tag nachgetragen werden. Dann stehen beide da.
  return ws.map((w) => calendarWorkout(w, iso, today)).join('');
}

export function calendarWorkout(w, iso, today) {
  const st = dayState(w, iso, today);
  const mode = st.mode;
  const items = exOf(w, mode).map((it) => resolve(it, mode));
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
export function calMonthNow(gewaehlt) {
  if (gewaehlt) return gewaehlt;
  const naechste = PLAN.find((w) => !completedMode(w.n));
  return monthStart(naechste ? effDate(naechste) : todayISO());
}
