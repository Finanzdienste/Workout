/* ------------------------------------------------------------------ *
 * Statistik – die Karten
 *
 * Gerechnet wird in js/bilanz.js und js/plan.js, gezeichnet in js/chart.js;
 * hier steht dazwischen, was der Nutzer davon zu sehen bekommt. Keine dieser
 * Funktionen schreibt etwas – sie lesen den Zustand und geben HTML zurück.
 *
 * renderStats() selbst bleibt in js/app.js: Es hängt die Karten in die Seite
 * und montiert danach die Diagramme, und beides ist Umgang mit dem DOM.
 * ------------------------------------------------------------------ */
import * as store from './store.js';
import { PLAN } from './data.js';
import { EX_BY_ID, plannedReps, stufenWerte } from './uebung.js';
import { LEISTUNG_MIN, LEVELS, SAETZE_JE_STUFE, leistungsStand, naechsteStufe } from './stufen.js';
import { esc, fmtNum } from './text.js';
import { fmtDate, plural } from './dates.js';
import { effDate, exOf } from './plan.js';
import { gesamtStats } from './bilanz.js';
import { abbruch, ausgelassen, vorneListe } from './muster.js';

/** Letzter protokollierter Eintrag derselben Übung im selben Modus. */
export function lastLoggedFor(exId, mode, beforeN) {
  for (let i = PLAN.length - 1; i >= 0; i--) {
    const w = PLAN[i];
    if (w.n >= beforeN) continue;
    const item = exOf(w, mode).find((x) => x.id === exId);
    if (!item) continue;
    const arr = store.peekSets(w.n, mode, exId);
    if (!arr) continue;
    const filled = arr.filter((s) => s.w !== '');
    if (!filled.length) continue;
    return { n: w.n, text: filled.map((s) => s.w).join(' · ') };
  }
  return null;
}

/**
 * Zeitreihen aus dem Protokoll: je Übung das benutzte Gewicht, je
 * Muskelgruppe das Volumen (Gewicht × geplante Wdh. × Sätze) einer Einheit.
 *
 * Nur abgehakte Sätze zählen, und nur die Hantel-Variante trägt Kilo bei –
 * Bodyweight-Einheiten haben schlicht kein Gewicht, das man summieren könnte.
 */
export function progressSeries() {
  const perExercise = new Map();
  const perMuscle = new Map();

  // Alle Einheiten, in denen etwas steht – die abgelegten zuerst, dann die des
  // laufenden Plans. Eine abgelegte Einheit kennt ihren Plan nicht mehr; ihr
  // Tag steht im Protokoll (startedOn), sonst zählt der Tag, an dem die Runde
  // weggelegt wurde. Ohne die Ablage bräche jede Kurve beim Fokuswechsel ab –
  // und genau die Kurven zeigen, dass es vorangeht.
  const einheiten = [];
  (store.getState().rounds || []).forEach((r) => {
    Object.values(r.log || {}).forEach((e) => {
      if (e) einheiten.push({ tag: e.startedOn || r.finishedOn || '', e });
    });
  });
  einheiten.sort((a, b) => (a.tag < b.tag ? -1 : (a.tag > b.tag ? 1 : 0)));
  const log = store.getState().log;
  PLAN.forEach((w) => { if (log[w.n]) einheiten.push({ tag: effDate(w), e: log[w.n] }); });

  einheiten.forEach(({ tag, e }) => {
    const day = tag ? fmtDate(tag) : '';
    const muscleDay = new Map();

    Object.entries(e.db || {}).forEach(([id, arr]) => {
      const ex = EX_BY_ID.get(id);
      if (!ex || !Array.isArray(arr)) return;
      const done = arr.filter((x) => x && x.done && x.w !== '');
      if (!done.length) return;

      const kg = parseFloat(String(done[0].w).replace(',', '.'));
      if (Number.isNaN(kg) || kg <= 0) return;

      if (!perExercise.has(id)) perExercise.set(id, []);
      perExercise.get(id).push({ label: day, value: kg });

      const vol = kg * plannedReps(stufenWerte(ex.db).reps) * done.length;
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
 * Die Erfahrungsstufe – zum Ansehen, nicht zum Einstellen.
 *
 *     „Die App sollte einen ja selbst auf Grundlage der Gewichte,
 *      Wiederholungen, Anzahl absolvierter Trainings usw irgendwann hochstufen.
 *      Selbst sollte man diese Einstufung ja nie verändern."
 *
 * Das ist die richtige Trennung, und vorher war sie nicht gezogen: Unter Mehr
 * standen drei Knöpfe, mit denen man sich jederzeit selbst hochstufen konnte –
 * und damit war die Stufe eine Meinung über sich und keine Messung. Wer sich
 * hochstuft, bekommt mehr Sätze, als er gerade verträgt; wer sich herunterstuft,
 * trainiert zu wenig und merkt es nicht.
 *
 * Gewählt wird sie deshalb genau einmal, bei der Einrichtung, als
 * Selbsteinschätzung zum Start. Danach gehört sie der App: pruefeAufstieg()
 * zählt Einheiten, Sätze und bewegte Tonnen und stellt um, wenn alles drei
 * steht. Was hier bleibt, ist die Auskunft – wo man steht, was das für den Plan
 * heißt, und wie weit es noch ist.
 */
export function erfahrungStand() {
  const s = store.getState();
  const key = s.level || 'geuebt';
  const eintrag = LEVELS.find(([k]) => k === key) || LEVELS[1];
  const saetze = SAETZE_JE_STUFE[key] || 3;
  const stand = leistungsStand();
  const nach = naechsteStufe(key);
  const name = (k) => (LEVELS.find(([kk]) => kk === k) || [])[1] || k;
  return `
    <div class="stat-grid">
      <div class="stat"><div class="stat-v">${esc(eintrag[1])}</div>
        <div class="stat-l">${esc(plural(saetze, 'Satz', 'Sätze'))} je Übung</div></div>
    </div>
    <div class="small muted" style="margin-top:10px">${esc(eintrag[2])}</div>
    <div class="small muted" style="margin-top:10px">Die Stufe skaliert Startgewichte
      <em>und</em> Sätze je Übung. Übungen, Pausen und die Verteilung über die Woche bleiben,
      wie sie sind – jede Muskelgruppe behält ihren Anteil, nur die Höhe ändert sich.
      Eingestellte Gewichte rührt sie nie an.</div>
    ${aufstiegBalken()}
    <div class="small muted" style="margin-top:12px">${nach
      ? 'Hochgestuft wird von selbst, sobald du es hebst – einstellen kannst und sollst du '
        + 'das nicht: Eine Stufe ist etwas, das man sich ertrainiert, keine Einstellung. '
        + 'Gewählt hast du sie einmal bei der Einrichtung, danach misst die App.'
      : 'Du stehst auf der höchsten Stufe – hier kommt nichts mehr dazu.'}</div>
    ${nach && stand.verhaeltnis !== null ? `<div class="small muted" style="margin-top:8px">
      Gemessen an <b>allen</b> ${esc(plural(stand.n, 'Übung', 'Übungen'))}, bei denen du selbst
      ein Gewicht oder Zusatzwiederholungen eingetragen hast – zurzeit ${esc(String(stand.n))}.
      Trägst du bei einer weiteren etwas ein, zählt sie mit; ${esc(String(LEISTUNG_MIN))} müssen
      es mindestens sein. Auf <b>${esc(name(nach))}</b> steht es, wenn der Median dort
      ${esc(fmtNum((LEVELS.find(([k]) => k === nach) || [])[3] || 1))} erreicht.</div>` : ''}`;
}

/**
 * Wie weit es bis zur nächsten Stufe noch ist – ein Balken statt drei.
 *
 * Vorher standen hier Einheiten, Sätze und Tonnen nebeneinander, und alle drei
 * mussten voll sein. Das misst Anwesenheit; gemessen wird jetzt, was auf der
 * Hantel liegt (leistungsStand() in js/stufen.js). Der Balken zeigt denselben
 * Median, an dem die App entscheidet – keine zweite Rechnung daneben.
 *
 * Er steht auch dann da, wenn noch nicht genug eingetragen ist: Dann sagt er
 * genau das, statt zu schweigen.
 *
 *     "Wenn die App mich bisher noch nicht hochgestuft hat, bin ich ja
 *      anscheinend noch Anfänger."
 *
 * Richtig – aber dann muss auch dastehen, woran das liegt.
 */
export function aufstiegBalken() {
  const s = store.getState();
  const nach = naechsteStufe(s.level || 'geuebt');
  if (!nach) return '';
  const ziel = (LEVELS.find(([k]) => k === nach) || [])[3] || 1;
  const name = (LEVELS.find(([k]) => k === nach) || [])[1] || nach;
  const stand = leistungsStand();

  if (stand.verhaeltnis === null) {
    return `
      <div class="small muted" style="margin-top:14px">Bis <b>${esc(name)}</b>: Die App misst
        an dem, was du wirklich bewegst – an den Gewichten und Wiederholungen, die du selbst
        eingestellt hast. Dafür fehlen noch
        ${esc(plural(stand.fehlt, 'Übung', 'Übungen'))}; bisher
        ${stand.n === 1 ? 'steht eine' : `stehen ${esc(String(stand.n))}`} mit eigener
        Angabe.</div>`;
  }
  const pct = Math.min(100, Math.round((stand.verhaeltnis / ziel) * 100));
  // „Hat es nen Sinn dass sich hier auf exakt 7 Übungen beschränkt wird?" –
  // beschränkt wird gar nichts, die Zahl ist seine eigene: so viele Übungen
  // haben eine eingetragene Angabe. Deshalb steht jetzt „deinen", nicht bloß
  // die nackte Zahl; eine Obergrenze gibt es nicht, nur die Untergrenze
  // LEISTUNG_MIN.
  return `
    <div class="small muted" style="margin-top:14px">Bis <b>${esc(name)}</b> – gemessen an deinen
      ${esc(plural(stand.n, 'Übung', 'Übungen'))} mit eigener Angabe:</div>
    <div class="bars" style="margin-top:8px">
      <div class="bar-row">
        <div>
          <div class="bar-name">Was du hebst, im Verhältnis zum Startgewicht</div>
          <div class="bar-track"><i style="width:${pct}%"></i></div>
        </div>
        <div class="bar-val">${esc(fmtNum(Math.round(stand.verhaeltnis * 100) / 100))}
          / ${esc(fmtNum(ziel))}</div>
      </div>
    </div>`;
}


export function gesamtKarte() {
  const s = store.getState();
  if (!(s.rounds || []).length) return '';
  const g = gesamtStats();
  return `
    <div class="section-title">Insgesamt trainiert</div>
    <div class="card">
      <div class="stat-grid">
        <div class="stat"><div class="stat-v">${g.einheiten}</div><div class="stat-l">Einheiten
          <span class="muted">über alle Pläne</span></div></div>
      </div>
      <div class="small muted" style="margin-top:10px">Oben steht der Fortschritt in
        <i>diesem</i> Plan – hier stehen alle ${plural(g.runden + 1, 'Runde', 'Runden')} zusammen.
        Ein Neustart oder ein Wechsel des Trainingsfokus fängt den Plan neu an; gezählt wird
        weiter.</div>
      ${aufstiegBalken() || `<div class="small muted" style="margin-top:12px">Du stehst auf
        der höchsten Erfahrungsstufe – hier kommt nichts mehr dazu.</div>`}
    </div>`;
}

/**
 * Was das Protokoll über die Gewohnheiten sagt – und was man dagegen tun kann.
 *
 * Steht in der Statistik und nicht auf dem Dashboard: Es ist eine Auswertung,
 * kein Auftrag für heute. Und sie steht nur da, wenn es etwas zu sagen gibt –
 * eine Karte, die in der Hälfte der Fälle „alles gut" meldet, wird nicht
 * gelesen, sie wird überblättert.
 */
export function musterKarte() {
  const ab = abbruch();
  const weg = ausgelassen();
  if (!ab && !weg.length) return '';
  const vorn = vorneListe();
  return `
    <div class="section-title">Was dir im Protokoll auffällt</div>
    <div class="card">
      ${ab ? `<div class="small">In ${plural(ab.kurz, 'Einheit', 'Einheiten')} von
        ${ab.einheiten} hast du vor dem Ende aufgehört – meist nach Übung
        <b>${ab.bis} von ${ab.von}</b>. Das ist kein Problem einer einzelnen Übung,
        sondern der Länge: Was hinten steht, kommt nicht dran. Entweder die Einheit
        kürzen (Erfahrungsstufe eine Stufe zurück, unter <i>Mehr</i>) oder das
        Wichtige nach vorn holen.</div>` : ''}

      ${weg.length ? `
        <div class="small" style="${ab ? 'margin-top:12px' : ''}">Diese Übungen fallen
          regelmäßig aus – jeweils gezählt über die Einheiten, in denen sie überhaupt
          dran waren:</div>
        <div class="muster-liste">
          ${weg.map((x) => `
            <div class="muster-zeile">
              <div>
                <div class="lbl">${esc(x.name)}</div>
                <div class="hint">${x.weg} von ${x.dran} Mal übergangen</div>
              </div>
              <button type="button" class="btn btn-sm ${vorn.includes(x.id) ? '' : 'btn-primary'}"
                      data-act="muster-vorne" data-ex="${esc(x.id)}">
                ${vorn.includes(x.id) ? 'steht vorn ✓' : 'nach vorn'}
              </button>
            </div>`).join('')}
        </div>
        <div class="small muted" style="margin-top:10px">„Nach vorn" heißt: Diese Übung
          steht ab sofort am Anfang der Einheit, vor der Bündelung nach Gerät. Das kostet
          womöglich einen zusätzlichen Umbau – eine Übung, die ausfällt, bringt aber null
          Sätze, und das ist der teurere Preis.</div>` : ''}
    </div>`;
}
