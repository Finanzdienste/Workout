/*
 * Die Termine, wie ein Kalender sie zeigen soll – aus der Rechnung der App.
 *
 *     „Es soll von selbst einfach das optimale passieren"
 *
 * Zwei Wege führen in einen Kalender, und beide nehmen ihre Termine von hier:
 * die Kalenderdatei zum Einlesen (downloadICS() in js/app.js) und der
 * Kalender „Workout", den ein kleines Skript in Tobis eigenem Google-Konto
 * selbst angleicht, auch wenn die App zu ist (js/kalender-vorschau.js, README
 * „Google Kalender automatisch"). Vorher baute downloadICS() seine Liste
 * selbst zusammen; eine zweite Liste daneben hätte beim nächsten Umbau etwas
 * anderes gezeigt als die erste.
 *
 * Ein Termin ist eine Einheit an ihrem tatsächlichen Tag (effDate(), also
 * nach dem Nachrücken), mit Titel und Übungsliste wie in der Kalenderdatei
 * (terminText() in js/ics.js) und der Dauer, die die Kalenderdatei schätzt
 * (duration()). Die Uhrzeit steht nicht hier: Die Datei schreibt 18:00 ohne
 * Zeitzone, der Kalender nimmt, was in der App eingestellt ist – Standard
 * 17:30 Berliner Zeit (KALENDER_MINUTEN).
 *
 * **Mit Zusatz.** Steckt heute ein Zusatztag in der Einheit (einheitEx() in
 * js/plan.js), stehen seine Übungen im Kalender mit drin – so, wie die App
 * die Einheit zeigt und wie trainiert wird. Die Kalenderdatei bleibt beim
 * Plan der Einheit (exOf(), `zusatz: false`), wie bisher. Ein Zusatztag, der
 * an einem Tag ohne Planeinheit allein steht („Heute · Zusatztag",
 * naechsteEinheit() in js/tagstart.js), ist ein eigener Termin an diesem Tag;
 * ein angefangener bleibt an seinem Tag stehen. Eigene Workouts nicht – die
 * entstehen, wenn sie gemacht werden, und sind kein Plan.
 *
 * **Die Kennung** bleibt dieselbe, solange es dieselbe Einheit ist:
 * „<fokus>-<runde>-<n>", für einen Zusatztag „<fokus>-<runde>-z<woche>".
 * Nicht die Nummer allein wie in der Kalenderdatei (UID workout-N): Nach dem
 * Rundenende fängt Workout 1 wieder an, und mit derselben Kennung hätte der
 * Abgleich das erledigte Workout 1 der alten Runde aus der Vergangenheit auf
 * den neuen Tag gezogen. Dasselbe beim Fokuswechsel – Workout 12 im Cut ist
 * eine andere Einheit als Workout 12 im Aufbau. Die Runde ist die Zahl der
 * abgelegten Durchläufe dieses Fokus plus eins; sie steigt mit jedem Rundenende
 * und bleibt beim Hin- und Herwechseln des Fokus stehen, weil wechsleFokus()
 * den Verlauf des Ziels aus der Ablage zurückholt.
 *
 * Nur Rechnung, keine Oberfläche – dieselben Zeilen laufen in der App und in
 * der Vorschau (Worker, Node).
 */
import * as store from './store.js';
import { PLAN } from './data.js';
import { ZUSATZ_NAME, completedMode, effDate, exOf, resolve, workoutByNo } from './plan.js';
import { todayISO } from './dates.js';
import { terminText } from './ics.js';
import { naechsteEinheit } from './tagstart.js';

/** Beginn im Kalender, Minuten nach Mitternacht (Europe/Berlin): 17:30. */
export const KALENDER_MINUTEN = 17 * 60 + 30;
/** Erinnerung vor dem Beginn, in Minuten. */
export const KALENDER_ERINNERUNG = 30;
/** So sieht eine Kennung aus – das Skript fasst nur Termine mit einer solchen an. */
export const KENNUNG = /^[a-z0-9]{1,24}-\d{1,4}-z?\d{1,4}$/;

/**
 * Die Übungen einer Einheit in ihrer Variante, aufgelöst (Name, Wiederholungen,
 * Pause). `zusatz`: wie trainiert wird (einheitEx()) oder nur der Plan der
 * Einheit (exOf()) wie in der Kalenderdatei.
 */
function posten(n, zusatz) {
  const mode = store.workoutMode(n);
  const w = workoutByNo(n, mode);
  return (zusatz ? w.ex : exOf(w, mode)).map((it) => resolve(it, mode));
}

/**
 * Alle Einheiten der laufenden Runde mit Tag und Übungen: [{ n, datum, posten }].
 * Die Grundlage der Kalenderdatei – sie nimmt jede Einheit, auch erledigte.
 */
export function kalenderEinheiten({ zusatz = true } = {}) {
  return PLAN.map((w) => ({ n: w.n, datum: effDate(w), posten: posten(w.n, zusatz) }));
}

/** Fokus und Runde für die Kennung: { fokus, runde }. */
export function kalenderRunde() {
  const s = store.getState();
  const f = s.focus || 'standard';
  const runde = (s.rounds || []).filter((r) => (r.focus || 'standard') === f).length + 1;
  return { fokus: String(f).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24) || 'plan', runde };
}

/**
 * Die Termine zwischen `von` und `bis` (ISO-Tage, beide eingeschlossen; ohne
 * Grenze alle): [{ kennung, n, datum, dauer, titel, beschreibung, fertig }],
 * nach Tag sortiert. Eine Einheit ohne Übungen – ein Termin schont an dem Tag
 * alles – ist kein Termin, wie in der Kalenderdatei; am Tag danach rückt sie
 * nach und ist wieder einer. `fertig`: abgeschlossen (completedMode()).
 */
export function kalenderTermine({ von = null, bis = null, zusatz = true } = {}) {
  const { fokus, runde } = kalenderRunde();
  const vorn = `${fokus}-${runde}`;
  const drin = (d) => !!d && (!von || d >= von) && (!bis || d <= bis);
  const out = [];
  const termin = (kennung, n, datum, name, liste) => {
    const t = terminText(name, liste);
    out.push({
      kennung, n, datum, dauer: t.dauer, titel: t.titel, beschreibung: t.beschreibung,
      fertig: !!completedMode(n),
    });
  };
  PLAN.forEach((w) => {
    const datum = effDate(w);
    if (!drin(datum)) return;
    const liste = posten(w.n, zusatz);
    if (liste.length) termin(`${vorn}-${w.n}`, w.n, datum, `Workout ${w.n}`, liste);
  });
  if (zusatz) {
    let heute = null;
    store.customs().forEach((c) => {
      const z = ZUSATZ_NAME.exec(c.name);
      if (!z) return;
      let datum = store.startedOn(c.id);
      if (!store.isStarted(c.id)) {
        // Unberührt steht er nur an dem Tag im Kalender, an dem die App ihn
        // als Einheit des Tages zeigt.
        if (heute === null) heute = naechsteEinheit();
        datum = heute === c.id ? todayISO() : null;
      }
      if (!drin(datum)) return;
      const liste = posten(c.id, true);
      if (liste.length) termin(`${vorn}-z${z[1]}`, c.id, datum, c.name, liste);
    });
  }
  const rang = (t) => (typeof t.n === 'number' ? t.n : 1e6);
  return out.sort((a, b) => a.datum.localeCompare(b.datum) || rang(a) - rang(b) || a.kennung.localeCompare(b.kennung));
}
