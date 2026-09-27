/*
 * Kalenderdatei (iCalendar/.ics) – der verlässliche Weg zur Erinnerung.
 *
 * Die App hat keinen Server, und ohne Server gibt es keinen Weckruf: Ein
 * Service Worker wacht nicht von selbst um sieben Uhr auf, und auf dem iPhone
 * schon gar nicht. Was zuverlässig jeden Morgen klingelt, ist der Kalender
 * des Handys. Deshalb erzeugt die App einen wiederkehrenden Termin mit Alarm,
 * den man einmal in den Kalender legt – danach erinnert das Handy, nicht die
 * App.
 *
 * Die Uhrzeit steht ohne Zeitzone da („floating"): 7:00 heißt 7:00, egal ob
 * Sommer- oder Winterzeit. Feste Kennungen (UID) sorgen dafür, dass ein
 * zweiter Import denselben Termin ersetzt statt ihn zu verdoppeln.
 */
import { zweistellig } from './datum.js';

const NL = '\r\n';

function entschaerfen(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    // Auch ein einzelnes CR: Manche Leser werten es als Zeilenende.
    .replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * Zeilen auf 75 Oktette umbrechen – der Standard verlangt es, manche Kalender
 * verschlucken sonst den Rest.
 *
 * Oktette, nicht Zeichen: „ü" sind in UTF-8 zwei. Und nur zwischen ganzen
 * Zeichen: Ein Emoji besteht in JavaScript aus zwei Hälften, und an der
 * Grenze durchgeschnitten wurden daraus zwei Ersatzzeichen.
 */
const kodierer = new TextEncoder();
function falten(zeile) {
  const teile = [];
  let aktuell = '';
  let laenge = 0;
  for (const zeichen of zeile) {
    const n = kodierer.encode(zeichen).length;
    const grenze = teile.length ? 74 : 75;   // Folgezeilen beginnen mit einem Leerzeichen
    if (laenge + n > grenze) {
      teile.push(aktuell);
      aktuell = '';
      laenge = 0;
    }
    aktuell += zeichen;
    laenge += n;
  }
  teile.push(aktuell);
  return teile.map((t, i) => (i ? ` ${t}` : t)).join(NL);
}

/*
 * SEQUENCE steigt mit jeder neu erzeugten Datei (Minuten seit 2024). Ein
 * Kalender, der die UID auswertet, nimmt dann die neue Fassung statt der
 * alten. Verlassen kann man sich darauf nicht – siehe den Hinweis unter
 * „Erinnerung", den alten Termin vorher zu löschen.
 */
function folge() {
  return String(Math.max(1, Math.floor((Date.now() - Date.UTC(2024, 0, 1)) / 60000)));
}

/**
 * 2026-09-26 + „07:00" (+ Minuten) → 20260926T070000.
 *
 * Über ein Date gerechnet und nicht an den Ziffern: Ein Termin um 23:50 mit
 * einer Viertelstunde Dauer endet am nächsten Tag um 00:05 – an den Ziffern
 * gerechnet stand dort 00:05 desselben Tages, also vor dem Beginn, und
 * manche Kalender verwerfen einen solchen Termin still.
 */
function stempel(iso, hhmm, plusMinuten = 0) {
  const [j, mo, t] = iso.split('-').map(Number);
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(j, mo - 1, t, h, m + plusMinuten);
  return `${d.getFullYear()}${zweistellig(d.getMonth() + 1)}${zweistellig(d.getDate())}`
    + `T${zweistellig(d.getHours())}${zweistellig(d.getMinutes())}00`;
}

function jetztUTC() {
  const d = new Date();
  return `${d.getUTCFullYear()}${zweistellig(d.getUTCMonth() + 1)}${zweistellig(d.getUTCDate())}`
    + `T${zweistellig(d.getUTCHours())}${zweistellig(d.getUTCMinutes())}${zweistellig(d.getUTCSeconds())}Z`;
}

function kopf(name) {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Schilddruese//Erinnerung//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${entschaerfen(name)}`,
  ];
}

/*
 * Was in der Erinnerung steht, richtet sich nach der Uhrzeit: Wer die
 * Tablette nach Absprache mit der Praxis abends nimmt (RW2 E15), bekam um
 * 22 Uhr „Frühstück frühestens eine halbe Stunde später" – und nichts über den
 * Abstand zur letzten Mahlzeit (B57). Abends gilt deshalb der Satz aus M3
 * (ab 17 Uhr wie „Was braucht Abstand?"), tagsüber ein neutraler – kein Rat,
 * danach nichts mehr zu essen: Mittags hieße das, das Abendessen wegzulassen.
 */
const MORGENS = 'Nüchtern, mit einem Glas Wasser. Frühstück frühestens eine halbe Stunde später.';
const TAGSUEBER = 'Mit einem Glas Wasser, jeden Tag zur gleichen Zeit. Essen und andere Mittel mit Abstand – siehe „Was braucht Abstand?" in der App.';
const ABENDS = 'Mit einem Glas Wasser, frühestens 2 bis 3 Stunden nach der letzten Mahlzeit – jeden Tag gleich, so wie mit der Praxis besprochen.';
export const erinnerungText = (uhr) => {
  const h = Number(String(uhr).slice(0, 2));
  return h >= 17 ? ABENDS : h >= 11 ? TAGSUEBER : MORGENS;
};

/**
 * Die tägliche Erinnerung: ein Termin ab `abISO` um `uhr`, jeden Tag, mit
 * Alarm zur vollen Zeit. Fünfzehn Minuten lang – ein Kalender ohne Dauer
 * zeigt manchen Termin gar nicht.
 */
export function erinnerungICS({ abISO, uhr, text = 'Schilddrüsentablette nehmen', notiz = '' }) {
  const z = kopf('Schilddrüse');
  const start = stempel(abISO, uhr);
  const ende = stempel(abISO, uhr, 15);
  z.push(
    'BEGIN:VEVENT',
    'UID:tablette@schilddruese.local',
    `DTSTAMP:${jetztUTC()}`,
    `SEQUENCE:${folge()}`,
    `DTSTART:${start}`,
    `DTEND:${ende}`,
    'RRULE:FREQ=DAILY',
    falten(`SUMMARY:${entschaerfen(text)}`),
    falten(`DESCRIPTION:${entschaerfen(notiz || erinnerungText(uhr))}`),
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    falten(`DESCRIPTION:${entschaerfen(text)}`),
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  );
  return z.join(NL) + NL;
}

/**
 * Ein einzelner Termin (Arzt, Blutabnahme) mit Erinnerung einen Tag und eine
 * Stunde vorher. `id` ist die Kennung des Termins in der App – derselbe Termin
 * zweimal exportiert ersetzt sich im Kalender. Ohne Uhrzeit steht er um 9 Uhr.
 *
 * Vor einer Blutabnahme sagt die Erinnerung am Vortag, was zählt: Tablette
 * erst danach. Wer Biotin nimmt, wird drei Tage vorher an die Pause erinnert –
 * beides verhindert die häufigsten Scheinbefunde.
 */
export function terminICS({ id, datum, uhr, titel, notiz = '', blutabnahme = false, biotin = false }) {
  const z = kopf('Schilddrüse');
  const beginn = uhr || '09:00';
  const vortag = blutabnahme
    ? `Morgen: ${titel}. Die Schilddrüsen-Tablette morgen erst NACH der Blutabnahme nehmen – außer die Praxis hat etwas anderes gesagt.`
    : `Morgen: ${titel}`;
  z.push(
    'BEGIN:VEVENT',
    `UID:termin-${id}@schilddruese.local`,
    `DTSTAMP:${jetztUTC()}`,
    `SEQUENCE:${folge()}`,
    `DTSTART:${stempel(datum, beginn)}`,
    `DTEND:${stempel(datum, beginn, 60)}`,
    falten(`SUMMARY:${entschaerfen(titel)}`),
    falten(`DESCRIPTION:${entschaerfen(notiz)}`),
  );
  if (blutabnahme && biotin) {
    z.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      falten(`DESCRIPTION:${entschaerfen('In drei Tagen ist Blutabnahme: Bitte Biotin ab heute weglassen. Wurde Biotin ärztlich verordnet, vorher in der Praxis fragen.')}`),
      'TRIGGER:-P3D',
      'END:VALARM',
    );
  }
  z.push(
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    falten(`DESCRIPTION:${entschaerfen(vortag)}`),
    'TRIGGER:-P1D',
    'END:VALARM',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    falten(`DESCRIPTION:${entschaerfen(titel)}`),
    'TRIGGER:-PT1H',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  );
  return z.join(NL) + NL;
}
