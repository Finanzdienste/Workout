/*
 * Steht heute eine Einheit an? – die eine Frage hinter dem Punkt am Symbol.
 *
 * Der Kalenderweg schied aus, und zwar aus einem guten Grund: Der Plan rückt
 * nach, wenn ein Termin verstreicht. Exportierte Termine stehen danach an
 * falschen Tagen, und wer oft aussetzt, exportiert und löscht dauernd. Was
 * bleibt, muss dem Plan von selbst folgen.
 *
 * **Warum hier keine Uhrzeit mehr steht.** Bis v171 rechnete diese Datei einen
 * Zeitpunkt aus – „ab 16:00 werktags, ab 06:30 am Wochenende" –, weil daran
 * eine Meldung in der Statusleiste hing und eine Meldung eine Uhrzeit braucht.
 * Die Meldung ist weg (siehe js/app.js, Abschnitt „Der Punkt am Symbol"), und
 * ein Punkt braucht keine: Er steht am Symbol, er klingelt nicht, er weckt
 * niemanden. Er gilt für den Tag, nicht für die Minute.
 *
 * Übrig bleibt eine einzige Zeile Antwort: das Datum, an dem die nächste offene
 * Einheit fällig ist – oder null, wenn nichts ansteht. Was die App und der
 * Service Worker daraus machen, steht dort, nicht hier.
 */
import { defaultWorkoutNo, effDate, workoutByNo, completedMode } from './plan.js';
import { todayISO } from './dates.js';

/**
 * Der Tag der ersten noch nicht abgeschlossenen Einheit – oder null.
 *
 * Weil der Plan verpasste Tage nachrückt, liegt der fast immer auf heute,
 * sobald man einmal hinterher ist – genau das soll der Punkt ja auffangen. Ist
 * die Einheit von heute schon abgeschlossen, steht hier der nächste Termin, und
 * bis dahin ist nichts fällig.
 *
 * Ein verstrichener Termin wird auf heute gezogen: Wer seit Dienstag hinterher
 * ist, soll den Punkt heute sehen und nicht rückwirkend am Dienstag – das ist
 * dieselbe Regel, nach der das Dashboard rechnet.
 */
export function faelligAm(heute = todayISO()) {
  const n = defaultWorkoutNo();
  const w = workoutByNo(n);
  if (!w || completedMode(n)) return null;   // alles durch – nichts zu zeigen
  const faellig = effDate(w);
  return faellig < heute ? heute : faellig;
}
