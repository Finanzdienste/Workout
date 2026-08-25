/*
 * Trainingstermine als Kalenderdatei (iCalendar/.ics).
 *
 * Warum eine Datei und keine Anbindung: Die App kennt keine Konten, spricht mit
 * keinem Server und läuft offline. Direkt in einen Google-Kalender zu schreiben
 * hieße OAuth, ein Google-Cloud-Projekt und eine Netzverbindung – drei Dinge,
 * die diese App bewusst nicht hat.
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

const NL = '\r\n';

/** Text für iCalendar entschärfen: Trennzeichen und Zeilenumbrüche. */
function esc(text) {
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

const pad = (n) => String(n).padStart(2, '0');

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
 * Kalenderdatei für den ganzen Plan.
 *
 * `plan` sind die Einheiten mit ihren *tatsächlichen* Terminen (also nach
 * Verschiebung), `resolve` liefert je Eintrag Name, Sätze, Wiederholungen und
 * Pause in der Variante, in der trainiert wird.
 */
export function buildICS(plan, resolve, { hour = 18, seq = 0, name = 'Workout' } = {}) {
  const zeilen = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Workout//Trainingsplan//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(name)}`,
  ];
  const jetzt = nowUTC();

  plan.forEach((w) => {
    const items = resolve(w);
    if (!items.length) return;          // ein leerer Tag ist kein Termin
    const dauer = duration(items);
    const liste = items.map((it) => `• ${it.sets} × ${it.reps} ${it.name}`).join('\n');
    const saetze = items.reduce((a, it) => a + it.sets, 0);
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
      fold(`SUMMARY:${esc(`Workout ${w.n} · ${items.length} Übungen · ${saetze} Sätze`)}`),
      fold(`DESCRIPTION:${esc(liste)}`),
      'END:VEVENT',
    );
  });

  zeilen.push('END:VCALENDAR');
  return zeilen.join(NL) + NL;
}
