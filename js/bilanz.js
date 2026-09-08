/*
 * Was insgesamt geleistet wurde – über abgelegte Runden hinweg.
 *
 * sammleStats() in js/plan.js beantwortet die Frage „wie weit bin ich in
 * diesem Plan". Der Stufenaufstieg fragt aber nach der Erfahrung eines
 * Menschen, und die endet nicht mit einem Neustart. Hier wird deshalb die
 * laufende Runde mit allen abgelegten zusammengezählt.
 */
import * as store from './store.js';
import { EX_BY_ID, gezaehlteReps, stufenWerte } from './uebung.js';
import { FOKUS_ERSATZ, PLANS } from './data.js';
import { offenerAufstieg } from './stufen.js';
import { sammleStats } from './plan.js';
import { todayISO } from './dates.js';

/**
 * Was eine Runde geleistet hat, festgehalten in dem Moment, in dem sie in die
 * Ablage wandert.
 *
 * Muss beim Ablegen passieren, nicht beim Auswerten: Ein Protokoll speichert
 * nur die *angetippten* Übungen. Eine Einheit, bei der jemand nach der ersten
 * Übung aufgehört hat, sieht darin genauso aus wie eine fertige – ein Log mit
 * lauter abgehakten Sätzen. Nachgemessen: von sechs geplanten Übungen stand
 * nach dem Abhaken der ersten genau eine im Log.
 */
export function rundenBilanz() {
  const st = sammleStats();
  return {
    einheiten: st.workoutsDone,
    saetze: st.setsDone,
    volumen: Math.round(st.volume),
    db: st.doneDb,
    bw: st.doneBw,
  };
}

/**
 * Die Bilanz einer abgelegten Runde – notfalls nachgerechnet.
 *
 * Runden, die vor der Einführung von `bilanz` abgelegt wurden, tragen keine.
 * Für die wird nachgerechnet, und zwar so genau, wie es die Lage hergibt:
 *
 *   Sätze und Volumen  sind **exakt**, immer. Sie stehen mit Übungs-ID im Log
 *                      selbst; dafür braucht es den Plan gar nicht – auch nicht
 *                      für Runden aus den gestrichenen Fokussen.
 *   Einheiten          brauchen den Plan der Runde. Gibt es ihn noch (standard,
 *                      bbp, cut, oberkoerper), gilt eine Einheit als erledigt,
 *                      wenn zu **jeder geplanten Übung** mindestens ein Satz
 *                      abgehakt ist.
 *
 * Gezählt werden Übungen, nicht Sätze, und das ist der Punkt: Wie viele Sätze
 * geplant waren, hängt an der Erfahrungsstufe (zwei für Anfänger, drei für
 * Geübte). Die Stufe von damals steht nirgends – und ausgerechnet beim
 * Aufstieg ändert sie sich. Über die Satzzahl gerechnet würde ein Aufstieg
 * rückwirkend jede Anfänger-Einheit für unfertig erklären. Die Zahl der
 * Übungen je Einheit steht dagegen fest im Plan.
 *
 * Einen Tausch wegen Verletzung übersteht das meistens: applyInjuries() setzt
 * eine Ersatzübung an dieselbe Stelle (js/injuries.js), die Zahl bleibt gleich,
 * nur die ID ist eine andere. Nicht immer aber – fällt eine Übung ersatzlos aus
 * oder landet ihr Ersatz auf einer Übung, die ohnehin schon in der Einheit
 * steht (`same.sets += item.sets`), schrumpft die Zahl. Solche Einheiten zählen
 * hier als unfertig. Das ist die verkraftbare Richtung: zu wenig, nicht zu viel.
 *
 * Für 'kurz' und 'beine' gibt es keinen Plan mehr – wohl aber die Zahl der
 * Übungen je Einheit, die `FOKUS_ERSATZ` aus js/data.js mitbringt. Mehr braucht
 * es dafür nicht, und deshalb sind auch diese Runden exakt. Runden ganz ohne
 * Fokus-Vermerk stammen aus einer Fassung, die nur einen Plan kannte.
 */
export const LEERE_BILANZ = { einheiten: 0, saetze: 0, volumen: 0, db: 0, bw: 0 };

/** Eine Zahl, oder 0. Nicht `undefined`, und vor allem nicht NaN – siehe bilanzAus(). */
export function zahl(x) {
  const n = typeof x === 'number' ? x : parseFloat(x);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function bilanzAus(runde) {
  if (!runde || typeof runde !== 'object') return LEERE_BILANZ;
  // Eine mitgebrachte Bilanz wird geprüft, nicht geglaubt. importJSON() lässt
  // `rounds` bis auf "ist ein Array" ungeprüft durch (js/store.js), und eine
  // Sicherung kommt als Datei von irgendwoher. Stünde dort {einheiten: "viele"},
  // würde daraus in gesamtStats() ein NaN – und **NaN < 60 ist false**, also
  // fiele jede einzelne Schwelle auf einen Schlag durch. Eine kaputte Datei
  // hätte damit nicht die Rechnung gestört, sondern jeden sofort hochgestuft.
  if (runde.bilanz && typeof runde.bilanz === 'object') {
    const b = runde.bilanz;
    return { einheiten: zahl(b.einheiten), saetze: zahl(b.saetze),
             volumen: zahl(b.volumen), db: zahl(b.db), bw: zahl(b.bw) };
  }
  const key = runde.focus || 'standard';
  const plan = (PLANS[key] || {}).plan;
  const alt = FOKUS_ERSATZ[key];
  const geplant = plan
    ? new Map(plan.map((w) => [String(w.n), w.ex.length]))
    // Abgeschaffter Plan: seine Einheiten stehen der Reihe nach, Nummer 1 vorn.
    : (alt && alt.uebungen
      ? new Map(alt.uebungen.map((anzahl, i) => [String(i + 1), anzahl]))
      : null);
  let einheiten = 0, saetze = 0, volumen = 0, db = 0, bw = 0;

  Object.entries(runde.log || {}).forEach(([n, e]) => {
    if (!e) return;
    const soll = geplant && geplant.get(String(n));
    let fertig = null;
    ['db', 'bw'].forEach((m) => {
      let mitSatz = 0;
      Object.entries(e[m] || {}).forEach(([id, arr]) => {
        const ex = EX_BY_ID.get(id);
        if (!ex || !Array.isArray(arr)) return;
        const reps = stufenWerte(ex[m]).reps;
        let hier = 0;
        arr.forEach((s) => {
          if (!s.done) return;
          saetze++;
          hier++;
          const kg = parseFloat(String(s.w).replace(',', '.'));
          if (m === 'db' && !Number.isNaN(kg)) volumen += kg * gezaehlteReps(s, reps);
        });
        if (hier) mitSatz++;
      });
      // "Von Hand abgeschlossen" gilt auch ohne den letzten Satz – genau wie in
      // completedMode(). Sonst fehlte jede Einheit, die jemand bewusst beendet
      // hat, bevor das Wadenheben stand.
      if (e.done === m && mitSatz > 0) fertig = fertig || m;
      else if (soll && mitSatz >= soll) fertig = fertig || m;
    });
    // Eigene Workouts haben eine Kennung wie 'c1' statt einer Nummer. Ihre
    // Sätze zählen (trainiert ist trainiert), als Plan-Einheit zählen sie
    // nicht – dieselbe Regel wie in sammleStats().
    if (fertig && /^\d+$/.test(String(n))) {
      einheiten++;
      if (fertig === 'db') db++; else bw++;
    }
  });
  return { einheiten, saetze, volumen: Math.round(volumen), db, bw };
}

/**
 * Was in *einem* Protokoll steht – ohne den Plan dahinter.
 *
 * Sätze, Wiederholungen, Kilo, Zeit, Trainingstage und wie oft jede Übung
 * drankam. Nichts davon braucht den Plan: Es steht alles im Log, an der
 * Übungskennung. Genau deshalb lässt sich damit auch ein *abgelegter* Verlauf
 * auswerten, dessen Plan gerade gar nicht geladen ist.
 *
 * Was hier fehlt, ist die Zahl der erledigten Einheiten – die braucht das Soll
 * aus dem Plan, und dafür ist bilanzAus() zuständig.
 */
export function protokollWerte(log) {
  const w = { saetze: 0, reps: 0, volumen: 0, perEx: new Map(),
              sekunden: 0, mitZeit: 0, tage: new Set() };
  Object.values(log || {}).forEach((e) => {
    if (!e || typeof e !== 'object') return;
    if (e.startedOn) w.tage.add(e.startedOn);
    const secs = zahl(e.secs);
    if (secs > 0) { w.sekunden += secs; w.mitZeit += 1; }
    ['db', 'bw'].forEach((m) => {
      Object.entries(e[m] || {}).forEach(([id, arr]) => {
        const ex = EX_BY_ID.get(id);
        if (!ex || !Array.isArray(arr)) return;
        const reps = stufenWerte(ex[m]).reps;
        arr.forEach((s) => {
          if (!s || !s.done) return;
          const geplant = gezaehlteReps(s, reps);
          w.saetze += 1;
          w.reps += geplant;
          const kg = parseFloat(String(s.w).replace(',', '.'));
          if (m === 'db' && !Number.isNaN(kg)) w.volumen += kg * geplant;
          w.perEx.set(id, (w.perEx.get(id) || 0) + 1);
        });
      });
    });
  });
  w.volumen = Math.round(w.volumen);
  return w;
}

/**
 * Alles, was je trainiert wurde – laufender Verlauf plus Ablage.
 *
 * Der Stufenaufstieg fragt nach der Erfahrung eines Menschen, nicht nach dem
 * Fortschritt in einem Plan. sammleStats() beantwortet die zweite Frage: Es
 * liest ausschließlich `state.log`, und ein Fokuswechsel legt genau das weg.
 * Wer 55 von 60 nötigen Einheiten hatte und den Trainingsfokus wechselte, fing
 * damit wieder bei null an – bestraft dafür, dass er eine Entscheidung
 * getroffen hat. Der automatische Fokus-Umzug hätte das sogar ungefragt getan.
 *
 * Dasselbe galt für die Statistik: *„Auch Statistik und so ist jetzt ja alles
 * weg."* Sätze, Kilo und Trainingstage sind aber keine Eigenschaft eines Plans,
 * sondern dessen, der trainiert hat. Sie kommen deshalb von hier – aus allen
 * Protokollen, den abgelegten eingerechnet.
 *
 * Gerechnet wird über die Protokolle selbst, nicht über die beim Ablegen
 * notierte Bilanz: Beide Wege zählen Sätze und Kilo mit derselben Rechnung
 * (bilanzAus() macht es genauso), aber nur der erste kennt auch Zeit, Tage und
 * Übungen. Die notierte Bilanz springt nur da ein, wo eine eingelesene
 * Sicherung eine Runde ohne Protokoll mitbringt – sonst fiele die auf null.
 */
export function lebenStats() {
  const s = store.getState();
  const jetzt = sammleStats();
  const summe = protokollWerte(s.log);
  const runden = s.rounds || [];
  let einheiten = jetzt.workoutsDone;
  let db = jetzt.doneDb;
  let bw = jetzt.doneBw;

  runden.forEach((r) => {
    const b = bilanzAus(r);
    einheiten += b.einheiten;
    db += b.db;
    bw += b.bw;
    const w = protokollWerte(r && r.log);
    if (!w.saetze && b.saetze) {
      // Runde ohne Protokoll: nur die mitgebrachten Zahlen, keine Details.
      summe.saetze += b.saetze;
      summe.volumen += b.volumen;
      return;
    }
    summe.saetze += w.saetze;
    summe.reps += w.reps;
    summe.volumen += w.volumen;
    summe.sekunden += w.sekunden;
    summe.mitZeit += w.mitZeit;
    w.perEx.forEach((c, id) => summe.perEx.set(id, (summe.perEx.get(id) || 0) + c));
    w.tage.forEach((t) => summe.tage.add(t));
  });

  // Auch die laufende Runde kann aus einer eingelesenen Sicherung stammen.
  // Lieber eine 0 als ein NaN, das jede Schwelle unterläuft.
  ['saetze', 'reps', 'volumen', 'sekunden'].forEach((k) => { summe[k] = zahl(summe[k]); });
  return { ...summe, einheiten: zahl(einheiten), db: zahl(db), bw: zahl(bw),
           runden: runden.length };
}

/** Die Zahlen, an denen der Stufenaufstieg gemessen wird. Siehe lebenStats(). */
export function gesamtStats() {
  const l = lebenStats();
  return { einheiten: l.einheiten, saetze: l.saetze, volumen: l.volumen,
           db: l.db, bw: l.bw, runden: l.runden };
}

/**
 * Prüfen und gegebenenfalls hochstufen. Gibt zurück, ob etwas passiert ist.
 *
 * Wird nach jeder abgeschlossenen Einheit aufgerufen und einmal beim Start –
 * Letzteres, damit auch eine eingelesene Sicherung sofort richtig einsortiert
 * wird und nicht erst beim nächsten Training.
 *
 * Gerechnet wird über *alles* Trainierte, nicht über die laufende Runde: siehe
 * gesamtStats().
 */
export function pruefeAufstieg() {
  const schritt = offenerAufstieg();
  if (!schritt) return false;
  const st = gesamtStats();
  const mitGewichten = st.db >= st.bw;
  if (st.einheiten < schritt.einheiten) return false;
  if (st.saetze < schritt.saetze) return false;
  if (mitGewichten && st.volumen < schritt.tonnen * 1000) return false;

  const s = store.getState();
  store.setSetting('aufstiege', [...(s.aufstiege || []), schritt.nach]);
  store.setSetting('aufstieg', {
    von: schritt.von,
    nach: schritt.nach,
    am: todayISO(),
    einheiten: st.einheiten,
    tonnen: Math.round(st.volumen / 1000),
  });
  store.setSetting('level', schritt.nach);
  return true;
}
