/*
 * Was die Mittel bewirken – eine Übersicht, kein Rat.
 *
 * Wer Magenbeschwerden hat, hat bald mehrere Schachteln im Schrank, und die
 * Beipackzettel beantworten selten die Frage, die man wirklich hat: Was macht
 * das eigentlich, und warum soll ich es ausgerechnet vor dem Frühstück nehmen?
 * Genau dafür steht das hier – in ganzen Sätzen, nicht in Fachsprache.
 *
 * Drei Regeln, an die sich dieser Text hält:
 *
 *   1. **Keine Dosierungen.** Was jemand nimmt und wie viel, steht auf seiner
 *      Packung und ist mit einer Ärztin besprochen. Eine App, die hier eine
 *      Zahl hinschreibt, macht sich zu etwas, das sie nicht ist.
 *   2. **Keine Empfehlung.** Nirgends steht „nimm", nirgends „hilft gegen".
 *      Beschrieben wird, wie ein Wirkstoff arbeitet – ob er für einen
 *      bestimmten Menschen der richtige ist, weiß diese App nicht und kann
 *      es nicht wissen.
 *   3. **Was schadet, steht mit dabei.** Eine Übersicht über Magenmittel, in
 *      der die Schmerzmittel fehlen, die den Magen erst reizen, ist die
 *      halbe Wahrheit – und die gefährlichere Hälfte. Siehe REIZSTOFFE.
 *
 * Reine Daten, keine Abhängigkeiten.
 */

export const MITTEL_WISSEN = [
  {
    id: 'ppi',
    gruppe: 'Protonenpumpenhemmer',
    kuerzel: 'PPI',
    beispiele: ['Pantoprazol', 'Omeprazol', 'Esomeprazol', 'Lansoprazol', 'Rabeprazol'],
    kurz: 'Drosselt die Säurebildung, damit die Schleimhaut zur Ruhe kommt.',
    wirkung: 'Blockiert die Pumpen in der Magenwand, an denen die Säure entsteht. '
      + 'Es wird also nicht neutralisiert, was schon da ist – es kommt weniger nach. '
      + 'Deshalb ist die volle Wirkung erst nach ein bis vier Tagen da, und deshalb '
      + 'hilft eine einzelne Tablette gegen akutes Brennen kaum.',
    einnahme: 'Üblicherweise morgens auf nüchternen Magen, eine halbe bis eine Stunde '
      + 'vor dem Frühstück. Hemmen lassen sich nur Pumpen, die gerade arbeiten – und '
      + 'das tun sie zur ersten Mahlzeit.',
    hinweis: 'Nach längerer Einnahme nicht von einem Tag auf den anderen weglassen: '
      + 'Der Magen antwortet dann vorübergehend mit mehr Säure als vorher, und das '
      + 'fühlt sich an wie ein Rückfall. Das Ausschleichen gehört besprochen. Bei '
      + 'monatelanger Einnahme wird gelegentlich auf Magnesium, Vitamin B12 und '
      + 'Eisen geschaut.',
  },
  {
    id: 'h2',
    gruppe: 'H2-Blocker',
    beispiele: ['Famotidin', 'Cimetidin'],
    kurz: 'Drosselt die Säure auch, schwächer als ein PPI, aber schneller.',
    wirkung: 'Setzt eine Stufe früher an als der PPI: Er besetzt den Schalter '
      + '(den Histamin-H2-Rezeptor), über den die Säurebildung angeregt wird. '
      + 'Wirkt innerhalb einer Stunde, dafür weniger stark.',
    einnahme: 'Oft abends, weil er die nächtliche Säure gut abfängt.',
    hinweis: 'Bei täglicher Einnahme lässt die Wirkung nach einigen Tagen nach – '
      + 'der Körper gewöhnt sich daran. Ranitidin, das früher hierher gehörte, ist '
      + 'seit 2020 vom Markt.',
  },
  {
    id: 'antazida',
    gruppe: 'Antazida',
    beispiele: ['Magaldrat', 'Hydrotalcit', 'Riopan', 'Talcid', 'Rennie', 'Antazidum'],
    kurz: 'Neutralisiert die Säure, die schon da ist. Wirkt in Minuten.',
    wirkung: 'Eine Base, die die vorhandene Säure abpuffert. Nichts wird gedrosselt '
      + 'und nichts geheilt – es wird das gelöscht, was gerade brennt. Nach ein bis '
      + 'drei Stunden ist es vorbei.',
    einnahme: 'Bei Bedarf, häufig etwa eine Stunde nach dem Essen und vor dem '
      + 'Schlafengehen.',
    hinweis: 'Der wichtigste Punkt steht selten vorn auf der Packung: Antazida binden '
      + 'andere Wirkstoffe und können sie damit unwirksam machen. Zu anderen '
      + 'Medikamenten gehören ein bis zwei Stunden Abstand. Magnesiumhaltige wirken '
      + 'eher abführend, aluminium- und calciumhaltige eher stopfend.',
  },
  {
    id: 'alginat',
    gruppe: 'Alginate',
    beispiele: ['Gaviscon', 'Alginat'],
    kurz: 'Legt einen Deckel auf den Mageninhalt, gegen Aufsteigendes.',
    wirkung: 'Aus Algen gewonnen: Im Magen bildet sich ein leichtes Gel, das oben '
      + 'aufschwimmt und die Säure am Übertritt in die Speiseröhre hindert. Zielt '
      + 'also auf Sodbrennen und Aufstoßen, nicht auf die Säuremenge.',
    einnahme: 'Nach dem Essen und vor dem Hinlegen – dann ist etwas da, worauf sich '
      + 'das Gel legen kann.',
    hinweis: 'Auch hier Abstand zu anderen Medikamenten.',
  },
  {
    id: 'sucralfat',
    gruppe: 'Sucralfat',
    beispiele: ['Sucralfat', 'Ulcogant'],
    kurz: 'Legt sich als Film über die wunden Stellen.',
    wirkung: 'Haftet an entzündeter oder verletzter Schleimhaut und bildet dort eine '
      + 'Schutzschicht gegen Säure und Verdauungsenzyme. Greift nicht in die '
      + 'Säurebildung ein – es deckt ab.',
    einnahme: 'Auf nüchternen Magen, meist etwa eine Stunde vor den Mahlzeiten.',
    hinweis: 'Braucht ein saures Milieu, um zu haften – zusammen mit einem Antazidum '
      + 'im selben Moment wirkt es schlechter. Auch von anderen Medikamenten Abstand '
      + 'halten.',
  },
  {
    id: 'prokinetika',
    gruppe: 'Prokinetika',
    beispiele: ['Domperidon', 'Metoclopramid', 'MCP'],
    kurz: 'Bringt den Magen dazu, sich schneller zu entleeren.',
    wirkung: 'Regt die Magenbewegung an. Gedacht für den Fall, dass das Essen zu '
      + 'lange liegen bleibt – Völlegefühl, Übelkeit, frühes Sattsein.',
    einnahme: 'Vor den Mahlzeiten. Verschreibungspflichtig.',
    hinweis: 'Nicht für den Dauergebrauch gedacht; die zugelassene Anwendungsdauer '
      + 'ist begrenzt, wegen möglicher Wirkungen auf Herzrhythmus und Nervensystem. '
      + 'Gehört in ärztliche Hand.',
  },
  {
    id: 'pflanzlich',
    gruppe: 'Pflanzliche Mittel',
    beispiele: ['Iberogast', 'Kamille', 'Kamillentee', 'Süßholz', 'Kümmel', 'Fenchel', 'Anis'],
    kurz: 'Wirkt eher auf Krampf und Bewegung als auf die Säure.',
    wirkung: 'Iberogast ist eine Mischung aus neun Pflanzenauszügen und zielt auf '
      + 'Krämpfe und die Magenbewegung. Kamille wirkt reizlindernd, Kümmel, Fenchel '
      + 'und Anis entkrampfen und helfen gegen Blähungen. Süßholzwurzel wird bei '
      + 'gereizter Schleimhaut verwendet.',
    einnahme: 'Meist zu oder nach den Mahlzeiten; Tee, wann man ihn braucht.',
    hinweis: '„Pflanzlich" heißt nicht „harmlos". Für Iberogast gibt es wegen des '
      + 'Schöllkraut-Anteils einen Warnhinweis zu den Leberwerten. Süßholz in größeren '
      + 'Mengen über längere Zeit kann Blutdruck und Kalium beeinflussen. Beides '
      + 'gehört in ein Gespräch in der Apotheke.',
  },
  {
    id: 'heilerde',
    gruppe: 'Heilerde und Bismut',
    beispiele: ['Heilerde', 'Bismut'],
    kurz: 'Bindet Säure und legt sich über die Schleimhaut.',
    wirkung: 'Feiner Löss, der Säure bindet – ähnlich einem Antazidum, nur langsamer '
      + 'und milder. Bismutsalze legen sich zusätzlich schützend auf und werden vor '
      + 'allem in Kombinationstherapien gegen Helicobacter eingesetzt.',
    einnahme: 'Zwischen den Mahlzeiten, mit reichlich Wasser.',
    hinweis: 'Auch das bindet andere Wirkstoffe: Abstand halten. Bismut färbt Stuhl '
      + 'und Zunge dunkel – erwartbar, kein Alarmzeichen.',
  },
  {
    id: 'eradikation',
    gruppe: 'Helicobacter-Behandlung',
    beispiele: ['Amoxicillin', 'Clarithromycin', 'Metronidazol'],
    kurz: 'Eine befristete Kombination, die ein bestimmtes Bakterium beseitigt.',
    wirkung: 'Helicobacter pylori ist eine der häufigsten Ursachen einer chronischen '
      + 'Gastritis. Behandelt wird nicht mit einem Mittel, sondern mit einer '
      + 'Kombination aus einem PPI und zwei bis drei Antibiotika über sieben bis '
      + 'vierzehn Tage.',
    einnahme: 'Genau nach Schema, meist morgens und abends.',
    hinweis: 'Das eine Mittel, bei dem „ich fühl mich besser, ich lass den Rest weg" '
      + 'wirklich schadet: Eine abgebrochene Behandlung kann Keime zurücklassen, die '
      + 'gegen das Antibiotikum unempfindlich geworden sind. Ob der Keim weg ist, '
      + 'wird hinterher nachgeprüft.',
  },
];

/**
 * Was den Magen von der anderen Seite belastet.
 *
 * Gehört in eine Übersicht über Magenmittel, weil es der häufigste vermeidbare
 * Grund für eine gereizte Schleimhaut ist – und weil es das Einzige hier ist,
 * was jemand womöglich gerade selbst einnimmt, ohne den Zusammenhang zu kennen.
 */
export const REIZSTOFFE = [
  {
    id: 'nsar',
    gruppe: 'Entzündungshemmende Schmerzmittel (NSAR)',
    beispiele: ['Ibuprofen', 'Diclofenac', 'Naproxen', 'ASS', 'Aspirin'],
    kurz: 'Häufigster vermeidbarer Grund für eine gereizte Magenschleimhaut.',
    wirkung: 'Sie hemmen Botenstoffe, die Schmerz und Entzündung machen – dieselben '
      + 'Botenstoffe sorgen aber auch für die Schleimschicht, die den Magen vor '
      + 'seiner eigenen Säure schützt. Der Schutz wird also mit abgeschaltet.',
    einnahme: '–',
    hinweis: 'Wer regelmäßig zu einem davon greift und Magenbeschwerden hat, sollte '
      + 'das ansprechen – es gibt Schmerzmittel, die den Magen nicht angreifen, und '
      + 'wenn es ohne NSAR nicht geht, gibt es einen Magenschutz dazu. Zusammen mit '
      + 'Kortison steigt das Risiko weiter.',
  },
  {
    id: 'kortison',
    gruppe: 'Kortison',
    beispiele: ['Prednisolon', 'Kortison'],
    kurz: 'Allein weniger heikel, zusammen mit NSAR deutlich mehr.',
    wirkung: 'Für sich genommen ein geringerer Magenreiz als lange angenommen. In '
      + 'Kombination mit einem entzündungshemmenden Schmerzmittel steigt das Risiko '
      + 'für Schleimhautschäden jedoch deutlich.',
    einnahme: '–',
    hinweis: 'Nie eigenmächtig absetzen. Änderungen gehören in ärztliche Hand.',
  },
];

const ALLE = [...MITTEL_WISSEN, ...REIZSTOFFE];

/**
 * Zu einem eingetragenen Namen die passende Gruppe finden.
 *
 * Eingetragen wird frei: „Pantoprazol 20mg", „pantoprazol", „Panto". Deshalb
 * wird kleingeschrieben verglichen und geprüft, ob eines der Beispiele im
 * Eingetragenen vorkommt – nicht auf Gleichheit.
 */
export function wissenZu(name) {
  const gesucht = String(name || '').toLowerCase().trim();
  if (!gesucht) return null;
  return ALLE.find((g) => g.beispiele.some((b) => gesucht.includes(b.toLowerCase())))
    || ALLE.find((g) => gesucht.includes(g.gruppe.toLowerCase()))
    || null;
}
