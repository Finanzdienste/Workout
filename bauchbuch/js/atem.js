/*
 * Atemübungen – die Daten dazu, nicht der Ablauf.
 *
 * Warum in einem Magentagebuch: Bauch und Nervensystem hängen zusammen, und
 * zwar in beide Richtungen. Langes Ausatmen schaltet messbar auf den Teil des
 * Nervensystems um, unter dem der Darm arbeitet statt stillzustehen. Bei
 * stressgebundenen Beschwerden ist das keine Beschäftigungstherapie, sondern
 * das Mittel, das man ohne Rezept und ohne Nebenwirkung hat.
 *
 * Deshalb ist bei allen Übungen hier das Ausatmen mindestens so lang wie das
 * Einatmen. Umgekehrt – kurz aus, lang ein – täte das Gegenteil.
 *
 * Reine Daten, keine Abhängigkeiten. Wer die Übung *ausführt*, ist js/app.js;
 * getaktet wird sie mit den Tönen aus js/klang.js.
 */

/**
 * Eine Übung besteht aus Phasen. `sek: 0` heißt: Phase fällt weg.
 *
 * `runden` ist der Vorschlag, nicht die Vorschrift – wer mehr will, stellt um.
 */
export const UEBUNGEN = [
  {
    id: '478',
    name: '4–7–8',
    zweck: 'Zum Runterkommen und zum Einschlafen',
    beschreibung: 'Vier Sekunden durch die Nase ein, sieben halten, acht durch '
      + 'den Mund aus. Das lange Ausatmen ist der Wirkstoff; die Zahlen sind nur '
      + 'die Verpackung. Wenn sieben Sekunden Halten zu lang sind, ist es keine '
      + 'schlechtere Übung, wenn man kürzer macht.',
    runden: 4,
    phasen: [
      { art: 'ein', sek: 4, wort: 'Einatmen' },
      { art: 'halten', sek: 7, wort: 'Halten' },
      { art: 'aus', sek: 8, wort: 'Ausatmen' },
    ],
  },
  {
    id: 'box',
    name: 'Quadrat',
    zweck: 'Wenn der Kopf rattert',
    beschreibung: 'Vier ein, vier halten, vier aus, vier halten. Der gleiche '
      + 'Takt in alle vier Richtungen gibt dem Denken etwas zu tun, ohne es zu '
      + 'beschäftigen.',
    runden: 6,
    phasen: [
      { art: 'ein', sek: 4, wort: 'Einatmen' },
      { art: 'halten', sek: 4, wort: 'Halten' },
      { art: 'aus', sek: 4, wort: 'Ausatmen' },
      { art: 'halten', sek: 4, wort: 'Halten' },
    ],
  },
  {
    id: 'kohaerenz',
    name: 'Gleichmaß',
    zweck: 'Für zwischendurch, auch im Sitzen am Schreibtisch',
    beschreibung: 'Fünfeinhalb Sekunden ein, fünfeinhalb aus, ohne Halten – gut '
      + 'sechs Atemzüge in der Minute. Der Takt, bei dem Puls und Atem in einen '
      + 'gemeinsamen Rhythmus fallen. Unauffällig genug für den Bus.',
    runden: 10,
    phasen: [
      { art: 'ein', sek: 5.5, wort: 'Einatmen' },
      { art: 'aus', sek: 5.5, wort: 'Ausatmen' },
    ],
  },
  {
    id: 'bauch',
    name: 'Bauchatmung',
    zweck: 'Direkt auf den Bauch, bei Druck und Krämpfen',
    beschreibung: 'Eine Hand auf den Bauch, vier Sekunden so einatmen, dass sich '
      + 'die Hand hebt und nicht die Schulter, sechs Sekunden aus. Das Zwerchfell '
      + 'massiert dabei, was darunter liegt.',
    runden: 8,
    phasen: [
      { art: 'ein', sek: 4, wort: 'Einatmen, Bauch hebt sich' },
      { art: 'aus', sek: 6, wort: 'Ausatmen, Bauch senkt sich' },
    ],
  },
];

const MAP = Object.fromEntries(UEBUNGEN.map((u) => [u.id, u]));

export function uebungVon(id) {
  return MAP[id] || UEBUNGEN[0];
}

/** Wie lange eine Runde dauert, in Sekunden. */
export function rundenDauer(uebung) {
  return uebung.phasen.reduce((s, p) => s + p.sek, 0);
}

/** Die ganze Übung, in Sekunden – für die Anzeige „etwa 2 Minuten". */
export function gesamtDauer(uebung, runden) {
  return rundenDauer(uebung) * (runden || uebung.runden);
}

export function dauerText(sekunden) {
  const m = Math.round(sekunden / 60);
  if (sekunden < 90) return `${Math.round(sekunden)} Sekunden`;
  return `${m} Minuten`;
}

/**
 * Der Ablauf als flache Liste: jede Phase jeder Runde, einmal ausgerollt.
 *
 * Ausgerollt statt gerechnet, weil der Ablauf dadurch selbst zum Prüfgegenstand
 * wird – man kann ihn ansehen und nachzählen, statt einer Schleife zu glauben.
 */
export function ablauf(uebung, runden) {
  const n = runden || uebung.runden;
  const schritte = [];
  for (let r = 1; r <= n; r++) {
    uebung.phasen.forEach((p, i) => {
      schritte.push({
        runde: r,
        von: n,
        art: p.art,
        wort: p.wort,
        sek: p.sek,
        letzte: r === n && i === uebung.phasen.length - 1,
      });
    });
  }
  return schritte;
}
