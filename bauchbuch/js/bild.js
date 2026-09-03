/*
 * Das Bild: so weit Richtung Diagnose, wie ein Tagebuch ehrlich kommt.
 *
 * Diese Datei sagt nicht, was jemand hat. Sie sagt, wonach das aussieht, was
 * er eingetragen hat – und zwar in den Begriffen, die in einer Praxis benutzt
 * werden, damit das Gespräch dort nicht bei null anfängt.
 *
 * Warum nicht weiter? Weil weiter geraten wäre. Gastritis, Magengeschwür,
 * Refluxkrankheit, funktionelle Dyspepsie und ein Reizdarm machen im Tagebuch
 * teils dasselbe Bild. Auseinander hält sie eine Magenspiegelung, ein Test auf
 * Helicobacter, ein Blutbild, ein Atemtest – Dinge, die man nicht eintippen
 * kann. Eine App, die sich trotzdem für eine entscheidet, nimmt der
 * Untersuchung ihre Frage weg und der Nutzerin die Möglichkeit zu merken, dass
 * es etwas anderes ist.
 *
 * Was hier deshalb steht, ist dreierlei:
 *
 *   1. **Warnzeichen.** Der einzige Teil, der wirklich dringt. Wo Blut,
 *      Gewichtsverlust oder eine Schluckstörung im Tagebuch stehen, gehört ein
 *      klarer Satz hin und keine Statistik.
 *   2. **Muster mit Belegen.** „Säuretypisch, in 78 % der Einträge Brennen
 *      oder Sodbrennen, davon 12 von 15 nachts" – eine Beschreibung, die man
 *      nachrechnen und vorlesen kann.
 *   3. **Was dahinterstecken kann und was es unterscheidet.** Also welche
 *      Untersuchung welche Frage beantwortet. Das ist die nützlichste Zeile
 *      des ganzen Programms.
 */
import { artAnteil, essensbezug, faktorBilanz, nachTageszeit, tagesWert } from './auswertung.js';
import { phasenBilanz, belastbar } from './zyklus.js';

/*
 * ---------------------------------------------------------------------------
 * 1. Warnzeichen
 * ---------------------------------------------------------------------------
 *
 * Sie stehen als eigene Liste im Beschwerdebogen, getrennt von der Frage, wie
 * es sich anfühlt. Ein Warnzeichen ist keine Ausprägung von „Brennen", es ist
 * eine andere Art von Angabe – und es darf nie in einer Statistik verschwinden.
 *
 * `dringlichkeit`:
 *   'sofort'  heute, notfalls über die 112 oder eine Notaufnahme
 *   'zeitnah' in den nächsten Tagen ein Termin, nicht „irgendwann mal"
 */
export const WARNZEICHEN = [
  {
    id: 'bluterbrechen',
    name: 'Blut erbrochen oder kaffeesatzartiges Erbrechen',
    dringlichkeit: 'sofort',
    warum: 'Das kann eine Blutung im Magen oder in der Speiseröhre sein.',
  },
  {
    id: 'teerstuhl',
    name: 'Schwarzer, klebriger Stuhl',
    dringlichkeit: 'sofort',
    warum: 'Schwarzer Stuhl kann verdautes Blut sein. (Eisentabletten, Heidelbeeren '
      + 'und Bismut färben ihn ebenfalls dunkel – das gehört dazugesagt, aber '
      + 'geklärt wird das dort und nicht hier.)',
  },
  {
    id: 'ausstrahlung',
    name: 'Schmerz strahlt in Arm, Kiefer oder Rücken aus, mit Luftnot oder kaltem Schweiß',
    dringlichkeit: 'sofort',
    warum: 'Beschwerden in der Magengegend können vom Herzen kommen, besonders '
      + 'bei Frauen. Das ist der eine Fall, in dem Abwarten teuer wird.',
  },
  {
    id: 'blutstuhl',
    name: 'Frisches Blut im Stuhl',
    dringlichkeit: 'zeitnah',
    warum: 'Gehört abgeklärt, auch wenn Hämorrhoiden die häufigste Ursache sind.',
  },
  {
    id: 'schlucken',
    name: 'Schluckstörung, Essen bleibt stecken',
    dringlichkeit: 'zeitnah',
    warum: 'Eine Enge in der Speiseröhre wird nicht von selbst besser.',
  },
  {
    id: 'gewicht',
    name: 'Ungewollter Gewichtsverlust',
    dringlichkeit: 'zeitnah',
    warum: 'Abnehmen, ohne es zu wollen, ist immer eine eigene Frage wert.',
  },
  {
    id: 'erbrechen',
    name: 'Anhaltendes Erbrechen',
    dringlichkeit: 'zeitnah',
    warum: 'Länger als ein, zwei Tage: Es geht dabei auch Flüssigkeit verloren.',
  },
  {
    id: 'nachtschmerz',
    name: 'Schmerz weckt nachts auf',
    dringlichkeit: 'zeitnah',
    warum: 'Beschwerden, die aus dem Schlaf reißen, unterscheiden sich von '
      + 'solchen, die tagsüber kommen und gehen.',
  },
  {
    id: 'blaesse',
    name: 'Auffällige Blässe, Schwäche oder Luftnot bei Anstrengung',
    dringlichkeit: 'zeitnah',
    warum: 'Zeichen, die zu einer Blutarmut passen – ein Blutbild klärt das in '
      + 'einer Viertelstunde.',
  },
  {
    id: 'fieber',
    name: 'Fieber dazu',
    dringlichkeit: 'zeitnah',
    warum: 'Fieber gehört nicht zu einer gereizten Magenschleimhaut.',
  },
];

const WARN_MAP = Object.fromEntries(WARNZEICHEN.map((w) => [w.id, w]));

export function warnzeichenVon(id) {
  return WARN_MAP[id] || null;
}

/**
 * Welche Warnzeichen im Tagebuch stehen – mit Datum und Häufigkeit.
 *
 * Ohne Zeitgrenze und ohne Schwelle: Ein einziges Mal Blut erbrochen ist ein
 * einziges Mal zu viel, und ein Eintrag von vor drei Monaten, der nie
 * abgeklärt wurde, ist keine alte Nachricht.
 */
export function warnungen(eintraege) {
  const zaehler = new Map();
  eintraege.filter((e) => e.art === 'beschwerde').forEach((e) => {
    (e.warnzeichen || []).forEach((id) => {
      const w = WARN_MAP[id];
      if (!w) return;
      const v = zaehler.get(id) || { ...w, anzahl: 0, zuerst: e.am, zuletzt: e.am };
      v.anzahl += 1;
      if (e.am < v.zuerst) v.zuerst = e.am;
      if (e.am > v.zuletzt) v.zuletzt = e.am;
      zaehler.set(id, v);
    });
  });
  // Das Dringende zuerst, sonst nach Häufigkeit.
  const rang = { sofort: 0, zeitnah: 1 };
  return [...zaehler.values()]
    .sort((a, b) => (rang[a.dringlichkeit] - rang[b.dringlichkeit]) || (b.anzahl - a.anzahl));
}

/*
 * ---------------------------------------------------------------------------
 * 2. Die Muster
 * ---------------------------------------------------------------------------
 *
 * Jedes Muster prüft ein paar Bedingungen an den eigenen Daten. Jede erfüllte
 * Bedingung bringt Punkte *und* einen Beleg im Klartext – ein Punktestand ohne
 * Begründung wäre ein Orakel. Angezeigt wird nur, was mindestens zwei Belege
 * hat: Ein einzelner Treffer ist noch kein Bild.
 */

const SAEURE_ARTEN = ['brennen', 'sodbrennen', 'aufstossen'];
const FUELLE_ARTEN = ['druck', 'uebelkeit', 'appetit'];
const DARM_ARTEN = ['blaehung', 'krampf'];

const pz = (x) => `${Math.round(x * 100)} %`;

function musterSaeure(d) {
  const belege = [];
  let punkte = 0;
  const a = artAnteil(d.eintraege, SAEURE_ARTEN);
  if (a.gesamt >= 5 && a.anteil >= 0.5) {
    punkte += 2;
    belege.push(`In ${a.anzahl} von ${a.gesamt} Eintragungen ging es um Brennen, `
      + `Sodbrennen oder Aufstoßen (${pz(a.anteil)}).`);
  }
  const nacht = d.zeiten.find((z) => z.id === 'nacht');
  const abend = d.zeiten.find((z) => z.id === 'abend');
  const spaet = (nacht ? nacht.anzahl : 0) + (abend ? abend.anzahl : 0);
  const gesamtZeiten = d.zeiten.reduce((s, z) => s + z.anzahl, 0);
  if (gesamtZeiten >= 5 && spaet / gesamtZeiten >= 0.4) {
    punkte += 1;
    belege.push(`${spaet} von ${gesamtZeiten} Beschwerden traten abends oder nachts auf.`);
  }
  const spaetEssen = d.bilanz.find((b) => b.id === 'spaet');
  if (spaetEssen && spaetEssen.genug && spaetEssen.differenz >= 1) {
    punkte += 1;
    belege.push('Nach spätem Essen war es im Mittel deutlich schlechter als sonst.');
  }
  return { punkte, belege };
}

function musterFuelle(d) {
  const belege = [];
  let punkte = 0;
  const a = artAnteil(d.eintraege, FUELLE_ARTEN);
  if (a.gesamt >= 5 && a.anteil >= 0.5) {
    punkte += 2;
    belege.push(`In ${a.anzahl} von ${a.gesamt} Eintragungen ging es um Völlegefühl, `
      + `Übelkeit oder fehlenden Appetit (${pz(a.anteil)}).`);
  }
  if (d.essen.bewertbar >= 8 && d.essen.anteilNachDemEssen >= 0.6) {
    punkte += 2;
    belege.push(`${d.essen.nachDemEssen} von ${d.essen.bewertbar} zuordenbaren `
      + `Beschwerden kamen innerhalb von zwei Stunden nach dem Essen.`);
  }
  const gross = d.bilanz.find((b) => b.id === 'gross');
  if (gross && gross.genug && gross.differenz >= 1) {
    punkte += 1;
    belege.push('Nach großen Portionen war es im Mittel schlechter als nach kleinen.');
  }
  return { punkte, belege };
}

function musterNuechtern(d) {
  const belege = [];
  let punkte = 0;
  if (d.essen.bewertbar >= 8 && d.essen.anteilNuechtern >= 0.5) {
    // Höher gewichtet als die anderen Muster, und das mit Absicht: „Brennen"
    // haben fast alle, aber *wann* es kommt, ist die spezifische Angabe. Sie
    // trennt den Nüchternschmerz vom Völlegefühl nach dem Essen – und das sind
    // zwei verschiedene Sprechstunden.
    punkte += 4;
    belege.push(`${d.essen.nuechtern} von ${d.essen.bewertbar} zuordenbaren `
      + `Beschwerden kamen erst vier Stunden oder länger nach der letzten Mahlzeit.`);
    // Die Gegenprobe gehört dazu: Dass es *nicht* nach dem Essen kommt, ist
    // hier der halbe Befund, und ohne ihn stünde die Aussage auf einem Bein.
    punkte += 1;
    belege.push(`Nur ${d.essen.nachDemEssen} davon kamen innerhalb von zwei `
      + `Stunden nach einer Mahlzeit.`);
  }
  const nacht = d.zeiten.find((z) => z.id === 'nacht');
  if (nacht && nacht.anzahl >= 3) {
    punkte += 1;
    belege.push(`${nacht.anzahl}-mal traten Beschwerden nachts auf.`);
  }
  return { punkte, belege };
}

function musterDarm(d) {
  const belege = [];
  let punkte = 0;
  const a = artAnteil(d.eintraege, DARM_ARTEN);
  if (a.gesamt >= 5 && a.anteil >= 0.4) {
    punkte += 2;
    belege.push(`In ${a.anzahl} von ${a.gesamt} Eintragungen ging es um Blähungen `
      + `oder Krämpfe (${pz(a.anteil)}).`);
  }
  ['huelsen', 'milch', 'rohkost', 'vollkorn'].forEach((id) => {
    const b = d.bilanz.find((x) => x.id === id);
    if (b && b.genug && b.differenz >= 1) {
      punkte += 1;
      belege.push(`Auffällig nach Mahlzeiten mit ${d.name(id)} `
        + `(${b.faelle} Mahlzeiten damit, ${b.gegenFaelle} ohne).`);
    }
  });
  return { punkte, belege };
}

function musterNsar(d) {
  const belege = [];
  let punkte = 0;
  if (d.nsarTage >= 3) {
    punkte += 3;
    belege.push(`An ${d.nsarTage} Tagen wurde ein entzündungshemmendes `
      + `Schmerzmittel eingetragen (Ibuprofen, Diclofenac, ASS oder ähnlich).`);
    if (d.nsarSchnitt > d.schnittGesamt + 0.5) {
      punkte += 1;
      belege.push(`An diesen Tagen lag die Beschwerdestärke bei `
        + `${d.nsarSchnitt.toFixed(1).replace('.', ',')} statt `
        + `${d.schnittGesamt.toFixed(1).replace('.', ',')}.`);
    }
  }
  return { punkte, belege };
}

function musterStress(d) {
  const belege = [];
  let punkte = 0;
  [['stress', 'Anspannung'], ['schlaf', 'schlechtem Schlaf'], ['stimmung', 'gedrückter Stimmung']]
    .forEach(([id, wort]) => {
      const f = d.faktoren[id];
      if (f && f.genug && f.differenz >= 1) {
        punkte += 2;
        belege.push(`An Tagen mit ${wort} lag die Beschwerdestärke bei `
          + `${f.hoch.schnitt.toFixed(1).replace('.', ',')} statt `
          + `${f.niedrig.schnitt.toFixed(1).replace('.', ',')} `
          + `(${f.hoch.tage} gegen ${f.niedrig.tage} Tage).`);
      }
    });
  return { punkte, belege };
}

function musterZyklus(d) {
  const belege = [];
  let punkte = 0;
  if (!d.zyklusBelastbar || d.phasen.length < 2) return { punkte, belege };
  const sortiert = [...d.phasen].sort((a, b) => b.schnitt - a.schnitt);
  const hoch = sortiert[0];
  const tief = sortiert[sortiert.length - 1];
  if (hoch.schnitt - tief.schnitt >= 1.5 && hoch.tage >= 4 && tief.tage >= 4) {
    punkte += 3;
    belege.push(`In der Phase „${hoch.name}" lag die Beschwerdestärke bei `
      + `${hoch.schnitt.toFixed(1).replace('.', ',')} (${hoch.tage} Tage), `
      + `in der Phase „${tief.name}" bei ${tief.schnitt.toFixed(1).replace('.', ',')} `
      + `(${tief.tage} Tage).`);
  }
  return { punkte, belege };
}

/**
 * Die Muster mit dem, was dahinterstecken kann – und, das ist die eigentliche
 * Auskunft, womit sich das eine vom anderen unterscheiden lässt.
 */
const MUSTER = [
  {
    id: 'saeure',
    name: 'Säuretypisches Bild',
    satz: 'Brennen, Sodbrennen und Aufstoßen stehen im Vordergrund, oft abends '
      + 'oder im Liegen.',
    pruefe: musterSaeure,
    ursachen: [
      { name: 'Refluxkrankheit', klaerung: 'Spiegelung der Speiseröhre; oft wird zuerst probeweise ein Säureblocker gegeben und geschaut, ob es besser wird.' },
      { name: 'Gastritis', klaerung: 'Magenspiegelung mit Gewebeprobe – nur die zeigt, ob und welche Entzündung da ist.' },
      { name: 'Helicobacter pylori', klaerung: 'Atemtest, Stuhltest oder Probe bei der Spiegelung. Behandelbar, und dann ist es weg.' },
    ],
    fragen: [
      'Wäre ein Test auf Helicobacter pylori sinnvoll?',
      'Spricht etwas für oder gegen einen befristeten Versuch mit einem Säureblocker?',
    ],
  },
  {
    id: 'nuechtern',
    name: 'Nüchternschmerz',
    satz: 'Die Beschwerden kommen mit Abstand zur letzten Mahlzeit oder nachts, '
      + 'nicht direkt nach dem Essen.',
    pruefe: musterNuechtern,
    ursachen: [
      { name: 'Geschwür im Zwölffingerdarm', klaerung: 'Magenspiegelung. Der Nüchternschmerz ist dafür das klassische Muster.' },
      { name: 'Helicobacter pylori', klaerung: 'Atem-, Stuhl- oder Gewebetest – häufigste Ursache eines solchen Geschwürs.' },
      { name: 'Übersäuerung ohne Geschwür', klaerung: 'Bleibt übrig, wenn die Spiegelung unauffällig ist.' },
    ],
    fragen: [
      'Der Schmerz kommt nüchtern und bessert sich nach dem Essen – wie wird das eingeordnet?',
      'Ist eine Magenspiegelung angezeigt?',
    ],
  },
  {
    id: 'fuelle',
    name: 'Völlegefühl nach dem Essen',
    satz: 'Druck, frühes Sattsein und Übelkeit, vor allem in den zwei Stunden '
      + 'nach einer Mahlzeit.',
    pruefe: musterFuelle,
    ursachen: [
      { name: 'Funktionelle Dyspepsie', klaerung: 'Die Diagnose, die bleibt, wenn die Spiegelung nichts zeigt – häufig und behandelbar, nur anders.' },
      { name: 'Verzögerte Magenentleerung', klaerung: 'Szintigrafie oder Atemtest; kommt unter anderem bei langjährigem Diabetes vor.' },
      { name: 'Gastritis', klaerung: 'Magenspiegelung mit Gewebeprobe.' },
    ],
    fragen: [
      'Passt das Bild eher zu einer funktionellen Störung oder steckt etwas dahinter?',
      'Wären kleinere, häufigere Mahlzeiten hier der richtige Ansatz?',
    ],
  },
  {
    id: 'darm',
    name: 'Darmbetontes Bild',
    satz: 'Blähungen und Krämpfe stehen im Vordergrund, oft nach bestimmten '
      + 'Kohlenhydraten.',
    pruefe: musterDarm,
    ursachen: [
      { name: 'Reizdarmsyndrom', klaerung: 'Diagnose nach Ausschluss; die Auslöserliste aus diesem Tagebuch ist dafür brauchbares Material.' },
      { name: 'Laktose- oder Fruktoseunverträglichkeit', klaerung: 'H2-Atemtest, dauert einen Vormittag.' },
      { name: 'Zöliakie', klaerung: 'Bluttest auf Antikörper – wichtig: solange noch Gluten gegessen wird, sonst ist er falsch negativ.' },
    ],
    fragen: [
      'Wäre ein Atemtest auf Laktose oder Fruktose sinnvoll?',
      'Ist Zöliakie schon einmal ausgeschlossen worden?',
    ],
  },
  {
    id: 'nsar',
    name: 'Zusammenhang mit Schmerzmitteln',
    satz: 'Im Tagebuch stehen entzündungshemmende Schmerzmittel – die häufigste '
      + 'vermeidbare Ursache einer gereizten Magenschleimhaut.',
    pruefe: musterNsar,
    ursachen: [
      { name: 'NSAR-bedingte Magenschleimhautschädigung', klaerung: 'Auslassversuch unter ärztlicher Begleitung; bei anhaltenden Beschwerden Spiegelung.' },
    ],
    fragen: [
      'Ich nehme regelmäßig ein entzündungshemmendes Schmerzmittel – gibt es dafür eine magenfreundlichere Alternative?',
      'Wenn es dabei bleiben muss: Ist ein Magenschutz angezeigt?',
    ],
  },
  {
    id: 'zyklus',
    name: 'Zyklusgebundenes Bild',
    satz: 'Die Beschwerden schwanken deutlich mit dem Zyklus.',
    pruefe: musterZyklus,
    ursachen: [
      { name: 'Zyklusabhängige Verdauungsbeschwerden', klaerung: 'Häufig und für sich genommen harmlos – die Hormonschwankung wirkt auf den Darm.' },
      { name: 'Endometriose', klaerung: 'Kommt in Frage, wenn dazu starke Regelschmerzen, Schmerzen beim Sex oder zyklische Darmbeschwerden gehören. Wird oft jahrelang übersehen; abgeklärt wird sie gynäkologisch.' },
    ],
    fragen: [
      'Meine Beschwerden folgen dem Zyklus – kann das zusammenhängen?',
      'Wäre eine gynäkologische Abklärung sinnvoll?',
    ],
  },
  {
    id: 'stress',
    name: 'Zusammenhang mit Anspannung und Schlaf',
    satz: 'An angespannten Tagen und nach schlechten Nächten ist es messbar '
      + 'schlechter.',
    pruefe: musterStress,
    ursachen: [
      { name: 'Stressassoziierte Beschwerden', klaerung: 'Kein Ausschlussurteil und keine Einbildung: Darm und Nervensystem hängen zusammen. Entspannungsverfahren sind hier eine Behandlung, keine Beschäftigung.' },
    ],
    fragen: [
      'Meine Beschwerden hängen deutlich an Anspannung – was ist da an Unterstützung möglich?',
    ],
  },
];

/**
 * Das ganze Bild.
 *
 * @param {{eintraege, tage, fenster, mindestFaelle, bilanz, nsarNamen}} d
 *   `bilanz` ist das Ergebnis von ausloeserBilanz(), `nsarNamen` die Prüfung,
 *   ob ein eingetragenes Mittel ein NSAR ist – beides kommt von außen herein,
 *   damit diese Datei nichts doppelt rechnet und nichts über die Anzeige weiß.
 */
export function bildLesen(d) {
  const eintraege = d.eintraege || [];
  const tage = d.tage || {};

  const tageMitBeschwerden = [...new Set(eintraege
    .filter((e) => e.art === 'beschwerde').map((e) => e.am))];
  const alleNotiert = [...new Set([...eintraege.map((e) => e.am), ...Object.keys(tage)])]
    .filter((iso) => tagesWert(eintraege, iso, tage).notiert);
  const schnittGesamt = alleNotiert.length
    ? alleNotiert.reduce((s, iso) => s + tagesWert(eintraege, iso, tage).wert, 0) / alleNotiert.length
    : 0;

  const nsarTageListe = [...new Set(eintraege
    .filter((e) => e.art === 'medikament' && d.istNsar(e.mittel))
    .map((e) => e.am))];
  const nsarSchnitt = nsarTageListe.length
    ? nsarTageListe.reduce((s, iso) => s + tagesWert(eintraege, iso, tage).wert, 0) / nsarTageListe.length
    : 0;

  const daten = {
    eintraege,
    tage,
    bilanz: d.bilanz || [],
    name: d.name || ((id) => id),
    zeiten: nachTageszeit(eintraege),
    essen: essensbezug(eintraege),
    faktoren: Object.fromEntries(['stress', 'schlaf', 'stimmung']
      .map((id) => [id, faktorBilanz(eintraege, tage, id, tagesWert)])),
    phasen: phasenBilanz(eintraege, tage, tagesWert),
    zyklusBelastbar: belastbar(tage),
    nsarTage: nsarTageListe.length,
    nsarSchnitt,
    schnittGesamt,
  };

  const muster = MUSTER
    .map((m) => ({ ...m, ...m.pruefe(daten) }))
    // Zwei Belege sind die Untergrenze. Ein einzelner Treffer ist ein Zufall,
    // und ein Zufall, der als „Bild" ausgegeben wird, führt jemanden in die
    // falsche Sprechstunde.
    .filter((m) => m.belege.length >= 2)
    .sort((a, b) => b.punkte - a.punkte);

  return {
    warnungen: warnungen(eintraege),
    muster,
    // Woran das alles hängt – steht in der Anzeige daneben, damit sichtbar ist,
    // wie dünn oder dick die Grundlage ist.
    basis: {
      beschwerden: eintraege.filter((e) => e.art === 'beschwerde').length,
      tageMitBeschwerden: tageMitBeschwerden.length,
      notierteTage: alleNotiert.length,
      zuordenbar: daten.essen.bewertbar,
    },
    fragen: [...new Set(muster.flatMap((m) => m.fragen))].slice(0, 6),
  };
}

/** Reicht die Grundlage, damit die Einordnung überhaupt etwas bedeutet? */
export function genugFuerBild(basis) {
  return basis.notierteTage >= 10 && basis.beschwerden >= 5;
}
