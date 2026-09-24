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
import { addDays, fmtDate, monthStart, plural, todayISO } from './dates.js';
import { completedMode, effDate, exOf, progressOf, resolve } from './plan.js';
import { MODE_ICON, MODE_LABEL, repsLabel } from './anzeige.js';
import { termine, terminLabel } from './termine.js';
import { AKT_BY_ID, gruppenAm } from './aktivitaeten.js';
import { MUSCLE_LABEL } from './body.js';

/** Ein Zeichen für „hier war Sport, aber nicht aus dem Plan". */
export const AKT_ICON = '🤾';

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

/**
 * Sport außerhalb des Plans, nach Tag – für den Kalender.
 *
 *     „Die sonstigen Sachen die ich hatte, zb padel, soll man auch im Kalender
 *      sehen"
 *
 * Die Einträge lagen bisher nur unter *Mehr* und wirkten auf den Plan, ohne im
 * Kalender vorzukommen. Der Kalender zeigt aber, was an einem Tag war – und
 * anderthalb Stunden Padel waren an dem Tag.
 */
export function aktivitaetTage() {
  const map = new Map();
  termine().forEach((t) => {
    if (!t || !t.datum) return;
    const da = map.get(t.datum) || [];
    da.push(t);
    map.set(t.datum, da);
  });
  return map;
}

export function calendarCell(iso, month, today, byDate, sel, frueher, akt) {
  const ws = byDate.get(iso) || [];
  const st = dayState(ws[0], iso, today);
  // Der laufende Plan hat Vorrang: Steht heute eine Einheit an, ist das die
  // Auskunft, und nicht das, was vor einem Fokuswechsel an diesem Tag war.
  const alt = st ? null : (frueher && frueher.get(iso)) || null;
  // Aktivitäten sind eine eigene Ebene und keine dritte Sorte Tag: An einem
  // Tag kann beides gewesen sein – vormittags Padel, abends die Einheit. Sie
  // ersetzen deshalb nichts, sondern kommen als Streifen dazu.
  const sport = (akt && akt.get(iso)) || [];
  const cls = ['cal-cell'];
  if (iso.slice(0, 7) !== month.slice(0, 7)) cls.push('out');
  if (iso === today) cls.push('today');
  if (iso === sel) cls.push('sel');
  if (st) cls.push(st.kind, st.mode);
  // 'frueher' trägt keine eigene Darstellung mehr (siehe css/styles.css) – die
  // Kachel ist eine trainierte wie jede andere. Die Klasse bleibt als Merkmal
  // für die Detailansicht und den Test stehen.
  else if (alt) cls.push('done', 'frueher', alt.mode);
  if (sport.length) cls.push('akt');
  const tag = Number(iso.slice(8));
  // Ohne Einheit und ohne Sport ist der Tag kein Knopf: nichts anzuzeigen,
  // nichts zu tippen.
  if (!st && !alt && !sport.length) {
    return `<div class="${cls.join(' ')}"><span class="cal-num">${tag}</span></div>`;
  }
  const namen = sport.map((t) => t.name || terminLabel(t)).join(', ');
  if (!st && !alt) {
    // Nur Sport an diesem Tag. Die Kachel bleibt ungefüllt – trainiert wurde
    // nach dem Plan nicht –, trägt aber den Streifen und lässt sich antippen.
    return `
      <button type="button" class="${cls.join(' ')}" data-act="cal-day" data-iso="${iso}"
              aria-pressed="${iso === sel}"
              aria-label="${esc(fmtDate(iso, true))}: ${esc(namen)}">
        <span class="cal-num">${tag}</span>
        <span class="cal-mark">${AKT_ICON}</span>
      </button>`;
  }
  const anzahl = st ? ws.length : alt.einheiten;
  const modus = st ? st.mode : alt.mode;
  const mehr = anzahl > 1 ? ` (+${anzahl - 1})` : '';
  return `
    <button type="button" class="${cls.join(' ')}" data-act="cal-day" data-iso="${iso}"
            aria-pressed="${iso === sel}"
            aria-label="${esc(fmtDate(iso, true))}: ${plural(anzahl, 'Einheit', 'Einheiten')} ${
              esc(st ? KIND_TEXT[st.kind] : KIND_TEXT.done)}, ${esc(MODE_LABEL[modus])}${
              sport.length ? ` · ${esc(namen)}` : ''}">
      <span class="cal-num">${tag}</span>
      <span class="cal-mark">${st && st.kind === 'miss' ? '·' : MODE_ICON[modus]}${mehr}</span>
    </button>`;
}

/**
 * Ein Tag Sport außerhalb des Plans, im Detail.
 *
 * Zeigt, was der Katalog über die Aktivität weiß – und vor allem, was sie am
 * Plan bewirkt hat: welche Gruppen an welchem Tag deshalb ausfallen. Wer im
 * Kalender auf Padel tippt, will genau das wissen und nicht noch einmal unter
 * Mehr nachsehen müssen.
 */
export function calendarAktivitaet(iso, sport) {
  const heute = todayISO();
  const TAGE = [[-1, 'am Tag davor'], [0, 'am Tag selbst'],
                [1, 'am Tag danach'], [2, 'zwei Tage danach']];
  return sport.map((t) => {
    const a = t.aktivitaet && AKT_BY_ID.get(t.aktivitaet);
    const dauer = t.minuten
      ? (t.minuten >= 60
        ? `${Math.floor(t.minuten / 60)}:${String(t.minuten % 60).padStart(2, '0')} h`
        : `${t.minuten} min`)
      : '';
    const zeilen = a ? TAGE.map(([d, label]) => {
      const tag = addDays(iso, d);
      const g = gruppenAm(a.id, t.minuten, d);
      if (!g.length) return '';
      const wann = tag < heute ? `${fmtDate(tag)}, vorbei` : fmtDate(tag);
      return `<li><b>${esc(label)}</b> (${esc(wann)}): ${
        g.map((m) => esc(MUSCLE_LABEL[m] || m)).sort().join(', ')}</li>`;
    }).filter(Boolean) : [];
    return `
      <div class="card cal-detail">
        <div class="cal-det-head">
          <div>
            <div class="lbl">${esc(t.name || terminLabel(t))}</div>
            <div class="hint">${esc(fmtDate(iso, true))}${dauer ? ` · ${esc(dauer)}` : ''}${
              a ? ` · ${esc(a.familie)}` : ''}</div>
          </div>
          <span class="chip akt">${AKT_ICON} Sport</span>
        </div>
        ${zeilen.length ? `<div class="lbl" style="margin-top:8px">Das fällt deshalb aus</div>
          <ul class="akt-tage">${zeilen.join('')}</ul>`
    : '<div class="small muted">Ändert am Trainingsplan nichts.</div>'}
        ${a ? `<div class="small muted" style="margin-top:8px">${esc(a.warum)}</div>` : ''}
        <button type="button" class="btn btn-sm" data-act="go-tab" data-tab="settings">Eintrag ändern</button>
      </div>`;
  }).join('');
}

/** Die angetippte Einheit im Detail: Übungen, Sätze, Modus. */
export function calendarDetail(iso, byDate, today, frueher, akt) {
  // Noch kein Tag angetippt: dann gibt es auch keinen Tag, über den sich etwas
  // sagen ließe. Vorher stand hier „Kein Training an diesem Tag" – auch wenn
  // heute eine Einheit lag.
  if (!iso) {
    return `<div class="card muted small">Tippe einen markierten Tag an, um die Einheit
      zu sehen.</div>`;
  }
  const ws = byDate.get(iso) || [];
  const sport = (akt && akt.get(iso)) || [];
  // Der Sport steht oben: Wer im Kalender auf einen orangen Streifen tippt,
  // hat ihn gemeint. Die Einheit desselben Tages kommt darunter, sie geht
  // dabei nicht verloren.
  const vorn = sport.length ? calendarAktivitaet(iso, sport) : '';
  if (vorn && !ws.length && !(frueher && frueher.get(iso))) return vorn;
  const alt = ws.length ? null : (frueher && frueher.get(iso)) || null;
  if (alt) {
    return vorn + `
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
  return vorn + ws.map((w) => calendarWorkout(w, iso, today)).join('');
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
