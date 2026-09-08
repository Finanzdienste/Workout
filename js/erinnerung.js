/*
 * Erinnerung am Trainingstag – die Entscheidung, wann eine fällig ist.
 *
 * Der Kalenderweg schied aus, und zwar aus einem guten Grund: Der Plan rückt
 * nach, wenn ein Termin verstreicht. Exportierte Termine stehen danach an
 * falschen Tagen, und wer oft aussetzt, exportiert und löscht dauernd. Was
 * bleibt, muss dem Plan von selbst folgen.
 *
 * **Warum diese Datei so klein und so stumpf ist.** Wecken kann die App sich
 * nicht selbst; das macht der Browser über den Service Worker (periodicsync in
 * sw.js). Und der kommt an `localStorage` nicht heran – Service Worker haben
 * keinen Zugriff darauf. Also rechnet die App hier alles aus, solange sie läuft,
 * und legt das Ergebnis als *fertige Antwort* in IndexedDB ab, wo der Worker sie
 * findet:
 *
 *     zeigenAb   ein Zeitpunkt. Wacht der Worker danach auf, erinnert er.
 *
 * Der Worker rechnet damit gar nichts mehr – er vergleicht eine Zahl. Das ist
 * Absicht: Was im Worker steht, lässt sich kaum testen (ein Testlauf kann
 * periodicsync nicht auslösen), was hier steht dagegen schon.
 */
import { defaultWorkoutNo, effDate, workoutByNo, completedMode } from './plan.js';
import { plural, todayISO } from './dates.js';

/** "16:00" -> 960 Minuten. Unbrauchbares gibt null. */
export function minuten(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Samstag und Sonntag. */
export const istWochenende = (d) => d.getDay() === 0 || d.getDay() === 6;

/**
 * Ab wann an einem bestimmten Tag erinnert werden soll, als Zeitstempel.
 *
 * Bewusst nach *diesem* Tag entschieden und nicht nach heute: Liegt die nächste
 * Einheit auf Samstag, gilt die Wochenendzeit, auch wenn heute Mittwoch ist.
 */
export function zeitpunkt(iso, zeiten) {
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return null;
  const tag = new Date(y, m - 1, d);
  const min = minuten(istWochenende(tag) ? zeiten.wochenende : zeiten.werktags);
  if (min === null) return null;
  tag.setHours(Math.floor(min / 60), min % 60, 0, 0);
  return tag.getTime();
}

/**
 * Der Stand, den der Service Worker braucht – oder null, wenn nichts ansteht.
 *
 * `faellig` ist der Termin der ersten noch nicht abgeschlossenen Einheit. Weil
 * der Plan verpasste Tage nachrückt, liegt der fast immer auf heute, sobald man
 * einmal hinterher ist – genau das soll die Erinnerung ja auffangen. Ist die
 * Einheit von heute schon abgeschlossen, steht `faellig` auf dem nächsten
 * Termin, und bis dahin kommt nichts.
 */
export function erinnerungsStand(zeiten, heute = todayISO()) {
  const n = defaultWorkoutNo();
  const w = workoutByNo(n);
  if (!w || completedMode(n)) return null;   // alles durch – nichts zu erinnern
  const faellig = effDate(w);
  // Ein Termin in der Zukunft bekommt seine eigene Uhrzeit, ein verstrichener
  // die von heute: Wer seit Dienstag hinterher ist, soll heute erinnert werden
  // und nicht rückwirkend am Dienstag.
  const tag = faellig < heute ? heute : faellig;
  const ab = zeitpunkt(tag, zeiten);
  if (ab === null) return null;
  return {
    zeigenAb: ab,
    tag,
    nummer: n,
    // Kein „von 84": *„Die app geht ja unendlich."* Stimmt – am Ende der Runde
    // beginnt der Plan von selbst wieder bei 1. Statt der Gesamtzahl steht
    // deshalb da, was heute ansteht, und das ist die nützlichere Auskunft.
    titel: `Workout ${n} · ${plural(w.ex.length, 'Übung', 'Übungen')}`,
  };
}
