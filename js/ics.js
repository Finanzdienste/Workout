/*
 * Trainingstermine als Kalenderdatei (iCalendar/.ics).
 *
 * Warum eine Datei und keine Anbindung: Die App kennt keine Konten, spricht mit
 * keinem Server und läuft offline. Direkt in einen Google-Kalender zu schreiben
 * hieße OAuth, ein Google-Cloud-Projekt und eine Netzverbindung – drei Dinge,
 * die diese App bewusst nicht hat. Der Kalender „Workout", der sich auch bei
 * geschlossener App verschiebt, geht deshalb einen anderen Weg: Die App
 * rechnet die Termine der nächsten Wochen vor und schickt sie an ein Skript in
 * Tobis eigenem Google-Konto, das selbst schreibt (js/kalender-vorschau.js).
 * Titel, Übungsliste und Dauer kommen für beide Wege von hier (terminText()).
 *
 * Was die Datei dafür kann: Sie bringt den Kalender jedes Mal auf denselben
 * Stand wie den Plan. Termine, die es nicht mehr gibt, kommen als STATUS:
 * CANCELLED mit – der Kalender räumt sie damit selbst weg, statt sie neben den
 * neuen stehen zu lassen.
 *
 * Der wichtige Teil steckt in der UID: Jeder Termin trägt eine feste Kennung
 * aus seiner Workout-Nummer. Wird der Plan verschoben und die Datei neu
 * eingelesen, erkennt der Kalender dieselben Termine wieder und *verschiebt*
 * sie, statt achtzig neue anzulegen. Damit das Aktualisieren greift, zählt
 * SEQUENCE bei jedem Export hoch – ältere Fassungen gewinnen sonst.
 *
 * Die Uhrzeit steht ohne Zeitzone da ("floating"): 18:00 heißt 18:00 in der
 * Zeitzone des Kalenders, egal ob Sommer- oder Winterzeit. Mit fester Zeitzone
 * müsste hier eine VTIMEZONE-Tabelle mitgeschleppt werden, die zur nächsten
 * Zeitumstellung falsch wäre.
 */
import { pad } from './dates.js';

const NL = '\r\n';

/* Text für iCalendar entschärfen: Trennzeichen und Zeilenumbrüche.
 *
 * Heißt nicht esc(): So heißt in js/text.js das Entschärfen für HTML, und im
 * Bündel (dist/workout.html) teilen sich alle Module einen Gültigkeitsbereich.
 * Zwei gleichnamige, verschiedene Funktionen gehen dort nicht – und genau
 * daran ist diese Datei nie ins Bündel aufgenommen worden. */
function escIcs(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Zeilen auf 75 Zeichen umbrechen, Fortsetzung mit einem Leerzeichen.
 *
 * Der Standard verlangt das, und manche Kalender verschlucken sonst den Rest
 * der Zeile – die Übungsliste ist schnell länger.
 */
function fold(line) {
  if (line.length <= 75) return line;
  const teile = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    teile.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  if (rest) teile.push(` ${rest}`);
  return teile.join(NL);
}

/** 2026-08-24 + 18:00 -> 20260824T180000 (ohne Zeitzone, siehe oben). */
function stamp(iso, minutes) {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(y, m - 1, d, 0, minutes);
  return `${t.getFullYear()}${pad(t.getMonth() + 1)}${pad(t.getDate())}`
       + `T${pad(t.getHours())}${pad(t.getMinutes())}00`;
}

/** Jetzt, in UTC – für DTSTAMP, das ist Pflicht und keine Anzeige. */
function nowUTC() {
  const d = new Date();
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`
       + `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

/**
 * Geschätzte Dauer einer Einheit in Minuten.
 *
 * Arbeit knapp eine Dreiviertelminute je Satz, dazu die Pausen *zwischen* den
 * Sätzen – nach dem letzten läuft keine – und etwas Umbauzeit je Übung. Auf
 * fünf Minuten aufgerundet: der Kalender soll den Abend grob abstecken, nicht
 * Sekunden versprechen.
 */
export function duration(items) {
  const secs = items.reduce((a, it) => a + it.sets * 45 + (it.sets - 1) * (it.rest || 90) + 45, 0);
  return Math.max(30, Math.ceil(secs / 60 / 5) * 5);
}

/**
 * Titel, Beschreibung und Dauer eines Termins – für die Kalenderdatei und für
 * den Kalender „Workout", der sich selbst angleicht (kalenderTermine() in
 * js/kalender.js). Eine Stelle für beide, damit sie dasselbe sagen.
 *
 * `name` ist „Workout 12" oder der Name eines Zusatztags, `items` sind die
 * Übungen in der Variante, in der trainiert wird (resolve() in js/plan.js).
 */
export function terminText(name, items) {
  const saetze = items.reduce((a, it) => a + it.sets, 0);
  return {
    titel: `${name} · ${items.length} Übungen · ${saetze} Sätze`,
    beschreibung: items.map((it) => `• ${it.sets} × ${it.reps} ${it.name}`).join('\n'),
    dauer: duration(items),
  };
}

/**
 * Kalenderdatei für den ganzen Plan.
 *
 * `plan` sind die Einheiten mit ihren *tatsächlichen* Terminen (also nach
 * Verschiebung), `resolve` liefert je Eintrag Name, Sätze, Wiederholungen und
 * Pause in der Variante, in der trainiert wird.
 */
export function buildICS(plan, resolve, { hour = 18, seq = 0, name = 'Workout', cancel = [] } = {}) {
  const zeilen = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Workout//Trainingsplan//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escIcs(name)}`,
  ];
  const jetzt = nowUTC();

  plan.forEach((w) => {
    const items = resolve(w);
    if (!items.length) return;          // ein leerer Tag ist kein Termin
    const { titel, beschreibung, dauer } = terminText(`Workout ${w.n}`, items);
    zeilen.push(
      'BEGIN:VEVENT',
      // Feste Kennung je Workout: dieselbe Datei später erneut eingelesen
      // verschiebt die Termine, statt sie zu verdoppeln. Der Teil hinter dem @
      // muss nur eindeutig sein und kein echter Rechner – hier steht deshalb
      // nichts, was irgendwohin zeigt.
      `UID:workout-${w.n}@workout.local`,
      `DTSTAMP:${jetzt}`,
      `SEQUENCE:${seq}`,
      `DTSTART:${stamp(w.date, hour * 60)}`,
      `DTEND:${stamp(w.date, hour * 60 + dauer)}`,
      fold(`SUMMARY:${escIcs(titel)}`),
      fold(`DESCRIPTION:${escIcs(beschreibung)}`),
      'END:VEVENT',
    );
  });

  // Termine, die es nicht mehr gibt: abgesagt statt stehen gelassen.
  //
  // Der Fall kommt vor, sobald sich der Plan selbst ändert – ein anderer
  // Trainingsfokus hat womöglich weniger Einheiten, und ein Tag, an dem
  // Verletzungen jede Übung sperren, hat gar keinen Termin mehr. Ohne diesen
  // Teil blieben die alten Einträge für immer im Kalender stehen, während die
  // neuen daneben auftauchen.
  cancel.forEach((n) => {
    zeilen.push(
      'BEGIN:VEVENT',
      `UID:workout-${n}@workout.local`,
      `DTSTAMP:${jetzt}`,
      `SEQUENCE:${seq}`,
      'STATUS:CANCELLED',
      // DTSTART muss dabeistehen, auch wenn der Termin verschwindet: ein VEVENT
      // ohne Beginn lehnen manche Kalender als fehlerhaft ab.
      `DTSTART:${stamp('1970-01-01', hour * 60)}`,
      fold(`SUMMARY:${escIcs(`Workout ${n} – entfällt`)}`),
      'END:VEVENT',
    );
  });

  zeilen.push('END:VCALENDAR');
  return zeilen.join(NL) + NL;
}
