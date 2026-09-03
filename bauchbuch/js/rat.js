/*
 * Vorschläge für heute – hergeleitet, nicht ausgedacht.
 *
 * Jeder Vorschlag trägt ein `warum`, und das ist keine Höflichkeit: Ein Rat
 * ohne Begründung ist ein Befehl, und Befehle über das eigene Essen befolgt man
 * entweder blind oder gar nicht. Beides ist schlecht. Steht daneben „weil es
 * nach deinen letzten 14 Mahlzeiten mit Kaffee im Mittel schlechter war",
 * kann man widersprechen – und genau das soll möglich sein.
 *
 * Zwei Quellen, sauber getrennt und in der Anzeige unterscheidbar:
 *
 *   'eigen'      Kommt aus ihren eigenen Eintragungen. Belastbar, soweit die
 *                Fallzahl reicht, und die steht dabei.
 *   'allgemein'  Kommt aus dem, was bei Magenbeschwerden üblicherweise
 *                empfohlen wird. Gilt für einen Durchschnitt, den es nicht
 *                gibt – deshalb immer nachrangig hinter dem eigenen Verlauf.
 *
 * WAS HIER NICHT VORKOMMT: welches Medikament sie nehmen soll. Diese Wahl
 * hängt an Diagnose, anderen Medikamenten, Nieren, Leber, Schwangerschaft –
 * nichts davon weiß diese App, und keines davon kann sie erfragen, ohne so zu
 * tun, als wüsste sie es dann. Was stattdessen kommt: was sie selbst
 * eingenommen hat, wann zuletzt, und die Frage dazu für den nächsten Termin.
 */
import { ausloeserName } from './daten.js';
import { einstufung, tagesWert } from './auswertung.js';
import { phaseVon, phasenName } from './zyklus.js';

/**
 * Was bei gereiztem Magen üblicherweise gut vertragen wird.
 *
 * Bewusst kurz und bewusst langweilig. Das ist keine Diät und keine
 * Empfehlung auf Dauer – wer wochenlang nur das isst, isst zu einseitig.
 * Gedacht für die zwei, drei Tage, an denen ohnehin nichts anderes geht.
 */
export const SCHONKOST = [
  'Haferbrei mit Wasser', 'Kartoffeln, gestampft', 'gedünstete Karotte oder Zucchini',
  'Reis', 'Banane', 'mageres Geflügel oder Fisch', 'Zwieback',
  'Kamillen- oder Fencheltee', 'stilles Wasser',
];

const rat = (id, bereich, titel, text, warum, quelle) => ({
  id, bereich, titel, text, warum, quelle,
});

/**
 * @param {object} d
 *   eintraege, tage, heute (ISO), bilanz (aus ausloeserBilanz),
 *   faktoren ({stress, schlaf, stimmung} aus faktorBilanz),
 *   phasen (aus phasenBilanz), eigene (eigene Auslöser),
 *   letzteMahlzeitStunden (Zahl oder null), mittel (zuletzt eingenommene)
 */
export function raete(d) {
  const raus = [];
  const heuteWert = tagesWert(d.eintraege, d.heute, d.tage).wert;
  const heuteTag = d.tage[d.heute] || {};
  const akut = heuteWert >= 6;
  const leicht = heuteWert > 0 && heuteWert < 6;

  /* ---------- Essen ---------- */

  // Was ihr eigener Verlauf hergibt, steht vor allem Allgemeinen.
  const auffaellig = (d.bilanz || [])
    .filter((b) => b.genug && ['auffaellig', 'moeglich'].includes(einstufung(b)))
    .filter((b) => !['gross', 'spaet'].includes(b.id))
    .slice(0, 3);

  if (auffaellig.length) {
    const namen = auffaellig.map((b) => ausloeserName(b.id, d.eigene)).join(', ');
    raus.push(rat('essen-eigen', 'essen',
      `Heute eher ohne ${namen}`,
      'Nicht für immer streichen – nur an Tagen wie diesem einmal weglassen und '
      + 'schauen, ob es einen Unterschied macht. Ein Auslöser, der sich in zwei '
      + 'Wochen ohne ihn nicht bestätigt, war keiner.',
      auffaellig.map((b) => `${ausloeserName(b.id, d.eigene)}: danach im Mittel `
        + `${b.schnittMit.toFixed(1).replace('.', ',')} statt `
        + `${b.schnittOhne.toFixed(1).replace('.', ',')} `
        + `(${b.faelle} Mahlzeiten damit, ${b.gegenFaelle} ohne)`).join(' · '),
      'eigen'));
  }

  if (akut) {
    raus.push(rat('essen-schon', 'essen',
      'Heute klein und mild',
      `Mehrere kleine Portionen statt zwei großen, und dabei bleiben bei: `
      + `${SCHONKOST.slice(0, 6).join(', ')}.`,
      `Der heutige Wert liegt bei ${heuteWert} von 10.`,
      'allgemein'));
  }

  const spaet = (d.bilanz || []).find((b) => b.id === 'spaet');
  if (spaet && spaet.genug && spaet.differenz >= 1) {
    raus.push(rat('essen-spaet', 'essen',
      'Die letzte Mahlzeit früher legen',
      'Zwischen dem letzten Essen und dem Hinlegen etwa drei Stunden – im Liegen '
      + 'hat der Magen keine Schwerkraft mehr auf seiner Seite.',
      `Nach Mahlzeiten nach 20 Uhr lag der Wert bei `
      + `${spaet.schnittMit.toFixed(1).replace('.', ',')} statt `
      + `${spaet.schnittOhne.toFixed(1).replace('.', ',')} (${spaet.faelle} Fälle).`,
      'eigen'));
  }

  const gross = (d.bilanz || []).find((b) => b.id === 'gross');
  if (gross && gross.genug && gross.differenz >= 1) {
    raus.push(rat('essen-portion', 'essen',
      'Lieber öfter und kleiner',
      'Fünf kleine Mahlzeiten belasten weniger als drei große – der Magen muss '
      + 'dann nie viel auf einmal bewegen.',
      `Nach großen Portionen lag der Wert bei `
      + `${gross.schnittMit.toFixed(1).replace('.', ',')} statt `
      + `${gross.schnittOhne.toFixed(1).replace('.', ',')} (${gross.faelle} Fälle).`,
      'eigen'));
  }

  /* ---------- Entspannung ---------- */

  const stress = d.faktoren && d.faktoren.stress;
  const heuteAngespannt = Number(heuteTag.stress) >= 3;
  const schlechtGeschlafen = Number(heuteTag.schlaf) >= 3;

  if (stress && stress.genug && stress.differenz >= 1) {
    raus.push(rat('ruhe-eigen', 'ruhe',
      heuteAngespannt ? 'Heute wäre eine Atemrunde dran' : 'Anspannung ist bei dir ein Faktor',
      'Bei dir hängen Anspannung und Beschwerden messbar zusammen. Langes '
      + 'Ausatmen schaltet auf den Teil des Nervensystems um, unter dem der Darm '
      + 'arbeitet – unter „Ruhe" liegt 4–7–8, gut zwei Minuten.',
      `An angespannten Tagen ${stress.hoch.schnitt.toFixed(1).replace('.', ',')} `
      + `statt ${stress.niedrig.schnitt.toFixed(1).replace('.', ',')} `
      + `(${stress.hoch.tage} gegen ${stress.niedrig.tage} Tage).`,
      'eigen'));
  } else if (heuteAngespannt || akut) {
    raus.push(rat('ruhe-heute', 'ruhe',
      'Zwei Minuten Atmen',
      'Unter „Ruhe": 4–7–8 zum Runterkommen, Gleichmaß fürs Sitzen zwischendurch. '
      + 'Mit Ton, damit die Augen zubleiben können.',
      heuteAngespannt ? 'Du hast heute viel Anspannung eingetragen.'
        : `Der heutige Wert liegt bei ${heuteWert} von 10.`,
      'allgemein'));
  }

  if (schlechtGeschlafen) {
    raus.push(rat('ruhe-schlaf', 'ruhe',
      'Heute Abend 4–7–8 vor dem Schlafen',
      'Die Übung ist ursprünglich fürs Einschlafen gedacht. Vier Runden im Bett, '
      + 'Licht schon aus.',
      'Du hast für heute schlechten Schlaf eingetragen.',
      'allgemein'));
  }

  /* ---------- Sport ---------- */

  raus.push(sportRat(d, { heuteWert, akut, leicht, heuteTag, heuteAngespannt }));

  /* ---------- Medikamente: kein Rat, sondern der Stand ---------- */

  if (d.mittel && d.mittel.length) {
    raus.push(rat('mittel', 'mittel',
      'Was du nimmst',
      d.mittel.map((m) => `${m.name} – zuletzt ${m.zuletzt}`).join(' · ')
      + '. Was die Mittel bewirken, steht unter „Mehr".',
      'Diese App schlägt bewusst kein Medikament vor: Das hängt an Diagnose, '
      + 'anderen Mitteln und Vorerkrankungen, und nichts davon weiß sie. Nimm '
      + 'die Liste mit zum Termin.',
      'allgemein'));
  }

  return raus.filter(Boolean);
}

/**
 * Intensiv oder moderat?
 *
 * Bewegung hilft bei fast allem hier – aber nicht jede Bewegung zu jeder
 * Stunde. Zwei Regeln sind unstrittig genug, um sie hinzuschreiben: nicht
 * intensiv direkt nach dem Essen (im Liegen und Springen kommt hoch, was
 * unten bleiben soll), und nicht intensiv, während es akut weh tut. Alles
 * andere kommt aus ihrem eigenen Verlauf.
 */
function sportRat(d, k) {
  const seitEssen = d.letzteMahlzeitStunden;
  const frischGegessen = seitEssen !== null && seitEssen < 2;
  const phase = phaseVon(d.tage, d.heute);
  const phasenSchlecht = phase && (d.phasen || [])
    .some((p) => p.phase === phase && p.schnitt >= 4 && p.tage >= 4);

  if (k.akut) {
    return rat('sport', 'sport', 'Heute nur spazieren',
      'Bei einem Wert wie heute bringt intensives Training nichts und kann die '
      + 'Beschwerden verstärken. Zwanzig Minuten gehen hilft der Verdauung '
      + 'trotzdem.',
      `Der heutige Wert liegt bei ${k.heuteWert} von 10.`, 'allgemein');
  }
  if (frischGegessen) {
    return rat('sport', 'sport', 'Erst in zwei Stunden intensiv',
      'Jetzt passt ein Spaziergang. Intensives Training kurz nach dem Essen '
      + 'drückt auf den vollen Magen – danach spricht nichts dagegen.',
      `Die letzte Mahlzeit ist ${Math.round(seitEssen * 10) / 10} Stunden her.`,
      'allgemein');
  }
  if (phasenSchlecht) {
    return rat('sport', 'sport', 'Heute eher moderat',
      'Ausdauer in ruhigem Tempo, 30 bis 45 Minuten. In dieser Zyklusphase war '
      + 'es bei dir bisher schwerer – das heißt nicht „gar nichts", sondern '
      + '„nicht auf Zeit".',
      `In der Phase „${phasenName(phase)}" lagen deine Werte höher als sonst.`,
      'eigen');
  }
  if (k.heuteAngespannt) {
    return rat('sport', 'sport', 'Moderate Ausdauer wäre heute richtig',
      'Laufen, Rad, zügiges Gehen in einem Tempo, bei dem Reden noch geht – das '
      + 'baut Anspannung ab, ohne neuen Stress zu machen. Intensive Intervalle '
      + 'tun an einem angespannten Tag das Gegenteil.',
      'Du hast heute viel Anspannung eingetragen.', 'allgemein');
  }
  if (k.leicht) {
    return rat('sport', 'sport', 'Moderat spricht nichts dagegen',
      'Bei leichten Beschwerden ist Bewegung eher hilfreich als schädlich. '
      + 'Intensiv würde ich heute noch nicht ansetzen.',
      `Der heutige Wert liegt bei ${k.heuteWert} von 10.`, 'allgemein');
  }
  return rat('sport', 'sport', 'Heute geht auch intensiv',
    'Beschwerdefrei und ausgeruht: Wenn du intensiv trainieren willst, ist heute '
    + 'der Tag dafür. Danach mindestens eine Stunde, bevor du dich hinlegst.',
    k.heuteWert === 0 ? 'Heute ist bisher nichts an Beschwerden eingetragen.'
      : 'Keine Beschwerden und keine hohe Anspannung für heute eingetragen.',
    'allgemein');
}

export const BEREICH_NAME = {
  essen: 'Essen',
  ruhe: 'Ruhe',
  sport: 'Bewegung',
  mittel: 'Medikamente',
};

export const BEREICH_ICON = {
  essen: '🍽️', ruhe: '🌬️', sport: '🚶', mittel: '💊',
};
