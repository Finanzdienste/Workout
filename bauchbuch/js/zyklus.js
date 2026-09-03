/*
 * Der Zyklus – gerechnet aus dem, was eingetragen wurde, und aus nichts sonst.
 *
 * Warum das in ein Magentagebuch gehört: Bei vielen Menschen schwanken
 * Übelkeit, Blähungen, Sodbrennen und Appetit mit dem Zyklus, und wer das
 * nicht mitzählt, sucht die Ursache vier Wochen lang im Essen. Ein Muster, das
 * sich alle vier Wochen wiederholt, sieht man nur, wenn man weiß, wo die
 * Wochen anfangen.
 *
 * WOFÜR DAS HIER NICHT TAUGT, und das ist keine Formalie:
 *
 *   * **Nicht zur Verhütung.** Der Eisprung wird hier nicht gemessen, sondern
 *     aus der halben Zykluslänge geschätzt. Er verschiebt sich, und zwar
 *     gerade dann, wenn jemand krank ist oder unter Druck steht – also genau
 *     in den Zeiträumen, um die es in dieser App geht.
 *   * **Nicht als Vorhersage.** „Nächste Periode am …" steht nirgends. Eine
 *     Zahl, die aus drei beobachteten Zyklen stammt, sieht genauso aus wie
 *     eine, die aus dreißig stammt – und wird genauso geglaubt.
 *
 * Was hier steht, ist eine Einordnung des *vergangenen* Verlaufs: In welcher
 * Phase lag ein bestimmter Tag, gemessen an den eingetragenen Blutungstagen.
 */
import { plusTage, tageDazwischen } from './datum.js';

/** Ab hier gilt ein Tag als Blutungstag – Schmierblutung zählt mit. */
const BLUTUNG_AB = 1;

/**
 * Eine Lücke von so vielen Tagen trennt zwei Zyklen.
 *
 * Zwei Tage Pause mitten in der Periode sind nichts Ungewöhnliches; würde man
 * schon daraus einen neuen Zyklus machen, käme eine Zykluslänge von vier Tagen
 * heraus. Drei Tage ist die übliche Grenze.
 */
const LUECKE = 3;

export const PHASEN = [
  { id: 'menstruation', name: 'Periode' },
  { id: 'follikel', name: 'erste Zyklushälfte' },
  { id: 'ovulation', name: 'Zyklusmitte' },
  { id: 'luteal', name: 'zweite Zyklushälfte' },
];

const PHASEN_MAP = Object.fromEntries(PHASEN.map((p) => [p.id, p]));

export function phasenName(id) {
  return PHASEN_MAP[id] ? PHASEN_MAP[id].name : id;
}

/** Alle eingetragenen Blutungstage, aufsteigend. */
export function blutungsTage(tage) {
  return Object.keys(tage || {})
    .filter((iso) => Number(tage[iso] && tage[iso].blutung) >= BLUTUNG_AB)
    .sort();
}

/**
 * Die beobachteten Zyklen: [{ start, laenge }].
 *
 * Ein Zyklus beginnt am ersten Blutungstag nach einer Lücke. Seine Länge ist
 * der Abstand zum nächsten Anfang – der letzte Zyklus hat deshalb keine, er
 * läuft noch.
 */
export function zyklen(tage) {
  const bt = blutungsTage(tage);
  if (!bt.length) return [];
  const starts = [bt[0]];
  const blutungsEnden = [];
  for (let i = 1; i < bt.length; i++) {
    if (tageDazwischen(bt[i - 1], bt[i]) >= LUECKE) {
      blutungsEnden.push(bt[i - 1]);
      starts.push(bt[i]);
    }
  }
  blutungsEnden.push(bt[bt.length - 1]);
  return starts.map((start, i) => ({
    start,
    blutungBis: blutungsEnden[i],
    blutungsTage: tageDazwischen(start, blutungsEnden[i]) + 1,
    laenge: i + 1 < starts.length ? tageDazwischen(start, starts[i + 1]) : null,
  }));
}

/**
 * Die mittlere Zykluslänge aus den abgeschlossenen Zyklen.
 *
 * Ohne abgeschlossenen Zyklus gibt es keine – dann liefert das hier `null`,
 * und alles, was darauf aufbaut, hält den Mund. 28 als stille Annahme
 * einzusetzen wäre bequem und falsch: Es gibt genug Menschen, bei denen 24
 * oder 34 der Normalfall ist, und deren Phasen lägen dann durchgehend daneben.
 */
export function mittlereLaenge(tage) {
  const fertig = zyklen(tage).filter((z) => z.laenge && z.laenge >= 15 && z.laenge <= 60);
  if (!fertig.length) return null;
  return Math.round(fertig.reduce((s, z) => s + z.laenge, 0) / fertig.length);
}

/** Wie stark die Zykluslänge schwankt – die Spanne zwischen kürzestem und längstem. */
export function schwankung(tage) {
  const laengen = zyklen(tage).map((z) => z.laenge)
    .filter((l) => l && l >= 15 && l <= 60);
  if (laengen.length < 2) return null;
  return { von: Math.min(...laengen), bis: Math.max(...laengen), anzahl: laengen.length };
}

/**
 * Der Zyklustag eines Datums: 1 am ersten Blutungstag.
 *
 * `null`, wenn der Tag vor dem ersten eingetragenen Zyklus liegt oder mehr als
 * zwei Monate hinter seinem Anfang – dann ist die Zuordnung geraten, nicht
 * gerechnet.
 */
export function zyklusTag(tage, iso) {
  const alle = zyklen(tage);
  let letzter = null;
  for (const z of alle) {
    if (z.start <= iso) letzter = z;
  }
  if (!letzter) return null;
  const tag = tageDazwischen(letzter.start, iso) + 1;
  return tag >= 1 && tag <= 60 ? tag : null;
}

/**
 * Die Phase eines Tages.
 *
 * Grob und offen gesagt grob: Die Periode kommt aus den Eintragungen, die
 * Mitte wird aus der halben Zykluslänge geschätzt, der Rest teilt sich davor
 * und danach auf. Feiner geht es ohne Temperatur- oder Hormonmessung nicht,
 * und feiner zu *tun* wäre schlimmer als grob zu sein.
 */
export function phaseVon(tage, iso) {
  const tag = zyklusTag(tage, iso);
  if (!tag) return null;
  const tagInfo = (tage || {})[iso];
  if (Number(tagInfo && tagInfo.blutung) >= BLUTUNG_AB) return 'menstruation';
  const laenge = mittlereLaenge(tage);
  if (!laenge) return null;
  const mitte = Math.round(laenge / 2);
  if (tag >= mitte - 2 && tag <= mitte + 2) return 'ovulation';
  return tag < mitte ? 'follikel' : 'luteal';
}

/**
 * Beschwerdestärke je Zyklusphase.
 *
 * Die eigentliche Auskunft dieses Moduls. Zurück kommt für jede Phase, in der
 * überhaupt etwas notiert wurde: wie viele Tage, wie stark im Mittel, und wie
 * viele davon mit Beschwerden. Ohne Schwelle und ohne Urteil – die Fallzahlen
 * stehen daneben, damit man selbst sieht, ob drei Tage oder dreißig gemeint
 * sind.
 */
export function phasenBilanz(eintraege, tage, tagesWert) {
  const eimer = Object.fromEntries(PHASEN.map((p) => [p.id, { tage: 0, summe: 0, mit: 0 }]));
  const gesehen = new Set();
  const alleTage = new Set([
    ...Object.keys(tage || {}),
    ...eintraege.map((e) => e.am),
  ]);
  alleTage.forEach((iso) => {
    if (gesehen.has(iso)) return;
    gesehen.add(iso);
    const p = phaseVon(tage, iso);
    if (!p) return;
    const t = tagesWert(eintraege, iso, tage);
    if (!t.notiert) return;
    eimer[p].tage += 1;
    eimer[p].summe += t.wert;
    if (t.wert > 0) eimer[p].mit += 1;
  });
  return PHASEN
    .filter((p) => eimer[p.id].tage > 0)
    .map((p) => ({
      phase: p.id,
      name: p.name,
      tage: eimer[p.id].tage,
      schnitt: eimer[p.id].summe / eimer[p.id].tage,
      anteil: eimer[p.id].mit / eimer[p.id].tage,
    }));
}

/**
 * Reicht das für eine Aussage?
 *
 * Zwei abgeschlossene Zyklen sind die Untergrenze, unter der eine Phase
 * bestenfalls ein Zufall ist. Steht hier `false`, zeigt die App die Zahlen
 * trotzdem – aber ohne den Satz, dass daraus etwas folgt.
 */
export function belastbar(tage) {
  return zyklen(tage).filter((z) => z.laenge).length >= 2;
}

/** Der Stand von heute, für die Tagesansicht. */
export function heutigerStand(tage, iso) {
  const tag = zyklusTag(tage, iso);
  if (!tag) return null;
  return {
    tag,
    phase: phaseVon(tage, iso),
    laenge: mittlereLaenge(tage),
    // Nur zur Einordnung des Heute, nicht als Vorhersage: Wie weit ist der
    // Zyklus, gemessen an der bisherigen mittleren Länge.
    seitAnfang: plusTage(iso, -(tag - 1)),
  };
}
