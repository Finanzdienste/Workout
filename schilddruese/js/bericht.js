/*
 * Der Bericht für den Arzttermin – der Grund, warum die App überhaupt Daten
 * sammelt.
 *
 * Zum Zeigen, Vorlesen, Weiterschicken oder Drucken: Dosis seit wann, wie
 * zuverlässig genommen, die letzten Laborwerte mit der damals gültigen Dosis,
 * Gewicht, Befinden, andere Medikamente und die notierten Fragen. Als
 * schlichter Text, damit er in jede Nachricht passt.
 *
 * Der Hauptteil sagt, was war. Darunter steht ein eigener Abschnitt mit den
 * Angaben zur Blutabnahme, zum Profil, zu den weiteren Mitteln und den
 * Warnzeichen-Checks – immer, auch ohne bestätigte Behandlung (P6): P6 sperrt
 * nur die Einschätzung, nicht die Angaben der Patientin (Runde 5: F12). Nur
 * bei P6 heißt er „EINSCHÄTZUNG DER APP" und enthält dazu, was die App nach
 * festen Regeln einordnet – gekennzeichnet, woher jede Angabe stammt (Angabe
 * der Patientin, vom Befund übertragen, von der App berechnet), mit der
 * Gesamteinschätzung und der Dosis-Karte. Was daraus folgt, sagt die Ärztin.
 */
import { datumKurz, zahlText, rohText, tageWeiter, uhrText } from './datum.js';
import * as sp from './speicher.js';
import { mehrzahl, saeubern, einzeilig } from './text.js';
import * as ez from './einschaetzung.js';
import { dosisBerichtZeilen, gesamtBerichtZeilen } from './dosis.js';

/** B2 (Regelwerk 2): ob eine Dosis auf Anweisung der Praxis eingetragen wurde. */
const quelle = (d) => (d.praxis === true ? ' – auf Anweisung der Praxis: ja' : d.praxis === false ? ' – auf Anweisung der Praxis: nein' : '');

function stufeText(s) {
  return { gut: 'gut', mittel: 'mittel', schlecht: 'schlecht' }[s] || s;
}

/*
 * Ein Wert so, wie er auf dem Befund steht: „< 0,01" mit dem Zeichen, ein
 * einseitiger Bereich als „ab 20" oder „bis 5". Vorher fehlte das „<", ein
 * Bereich nur mit Obergrenze fehlte ganz, und einer nur mit Untergrenze stand
 * als „20––" da (B49, B56). Ungerundet: Unter „aus den Befunden
 * abgeschrieben" stand TSH 0,015 als „0,02", fT4 1,125 als „1,13"
 * (Runde 4: E21).
 */
function wertText(name, w) {
  const v = w.von !== null && w.von !== undefined;
  const b = w.bis !== null && w.bis !== undefined;
  const bereich = v && b ? ` (Labor ${rohText(w.von)}–${rohText(w.bis)})` : v ? ` (Labor ab ${rohText(w.von)})` : b ? ` (Labor bis ${rohText(w.bis)})` : '';
  return `${name} ${w.unter ? '< ' : ''}${rohText(w.wert)} ${w.einheit}${bereich}`;
}

/*
 * Runde 5: F26 – Notizen und Fragen kommen aus mehrzeiligen Textfeldern. Wie
 * getippt übernommen, stand jede Folgezeile ohne Datum und ohne Einzug im
 * Bericht: Eine abgeschriebene Wertzeile „12.08.2026: TSH 0,05 …" in einer
 * Befund-Notiz sah unter LABORWERTE aus wie ein eigener Befund, eine
 * Leerzeile wie das Ende des Abschnitts. Jetzt fallen Leerzeilen weg, und
 * jede Folgezeile steht eingerückt unter dem Eintrag, zu dem sie gehört –
 * weiter eingerückt als jede Zeile, die der Bericht selbst gliedert.
 */
function mehrzeilig(text, einzug = '    ') {
  return saeubern(text).split('\n').map((z) => z.trim()).filter(Boolean).join(`\n${einzug}`);
}

/** Die Notizen eines Dosis-Zeitraums: aus einem einzeiligen Feld – jede nur einmal, in Klammern. */
function notizText(p) {
  const n = [...new Set(p.eintraege.map((d) => einzeilig(d.notiz)).filter(Boolean))];
  return n.length ? ` (${n.join(' · ')})` : '';
}

/*
 * Zwei Dosen für den Satz zur Berichtigung: die Menge am Tag – oder, wenn sie
 * gleich ist (nur das Präparat war falsch eingetragen) oder fehlt, der ganze
 * Eintrag. Sonst stünde „100 µg am Tag statt 100 µg am Tag" da.
 */
function vergleich(neu, alt) {
  const a = sp.tagesdosis(neu);
  const b = sp.tagesdosis(alt);
  if (a !== null && b !== null && a !== b) return [`${zahlText(a, 1)} µg am Tag`, `${zahlText(b, 1)} µg am Tag`];
  return [sp.dosisText(neu), sp.dosisText(alt)];
}

/*
 * Runde 5: F15 – die Dosis-Historie nach denselben Regeln wie Karte und
 * Einschätzung (ez.dosisVerlauf). Vorher war jeder Eintrag eine eigene
 * Periode: Nach „Nein, ich nehme etwas anderes" stand die Berichtigung als
 * „Aktuell: 100 µg seit 20.09. / Davor: 75 µg" da – die Ärztin las „erhöht"
 * und wartete die Einpendelzeit ab, obwohl der Wert womöglich schon unter
 * 100 µg gemessen war. Ein doppelter Eintrag vom Einrichten las sich als
 * „Aktuell: 75 µg seit 01.09.2026 / Davor: 75 µg ab 2019" wie ein Neubeginn.
 * Jetzt: „seit" ist der Beginn des ersten gleichen Eintrags, und eine
 * Berichtigung heißt so – mit der Menge, die vorher eingetragen war.
 */
function aktuellZeile(p, vor, heute) {
  const text = sp.dosisText(p.d);
  const alt = p.ersetzt ? p.ersetzt.d : vor ? vor.d : null;
  if (p.berichtigung && alt) {
    const [neuText, altText] = vergleich(p.d, alt);
    // Ersetzt die Berichtigung einen Eintrag vom selben Tag, war nur dieser
    // falsch – ab wann die Menge gilt, hat die Patientin selbst eingetragen.
    // Runde 6: G11 – was dort zuerst eingetragen war, sagt die Zeile „nie
    // genommen" unter den Davor-Zeilen (ez.nieGenommenZeilen), mit Menge und
    // Quelle; hier stünde es sonst doppelt.
    if (p.ersetzt) {
      return `Aktuell: ${text}, ${p.ab > heute ? 'ab' : 'seit'} ${datumKurz(p.ab)}${notizText(p)}${quelle(p.erster)}`;
    }
    return `Aktuell: ${text}, eingetragen ab ${datumKurz(p.ab)}${notizText(p)}${quelle(p.erster)}. Berichtigung (Angabe): Die Patientin nimmt nach eigener Angabe ${neuText} statt der zuvor eingetragenen ${altText}. Seit wann genau, ist offen.`;
  }
  return `Aktuell: ${text}, ${p.ab > heute ? 'ab' : 'seit'} ${datumKurz(p.ab)}${notizText(p)}${quelle(p.erster)}`;
}

/** Ein früherer Zeitraum – mit dem Vermerk, wenn seine Menge später berichtigt wurde. */
function davorZeile(p) {
  return `Davor: ${sp.dosisText(p.d)}, ab ${datumKurz(p.ab)}${quelle(p.erster)}`
    + `${p.berichtigung ? ' – eingetragen als Berichtigung (Angabe)' : ''}`
    + `${p.berichtigtDurch ? ` – laut App; später berichtigt (Berichtigung ab ${datumKurz(p.berichtigtDurch.ab)})` : ''}`;
}

/*
 * Runde 5: F13 – Q2 (nüchtern mit Wasser?) zum letzten Befund mit TSH, gleich
 * unter der Einnahmezeit. Vorher stand dort fest „etwa 7:00 Uhr, nüchtern" –
 * „nüchtern" war der Rat aus dem Einrichten, keine Angabe der Patientin. Bei
 * einem erhöhten TSH wegen der Tablette zum Frühstück stand oben so das
 * Gegenteil der Ursache.
 */
const Q2 = { ja: 'ja', abends: 'abends, mit der Praxis abgesprochen', nein: 'nein', unbekannt: 'weiß nicht' };

/*
 * Wann die Tablette in den letzten 4 Wochen meist abgehakt wurde (Median) –
 * nur mit mindestens 7 Uhrzeiten, und nur, wenn sie mindestens eine Stunde
 * von der Uhrzeit der Erinnerung abweicht: Wer jeden Tag um 10:45 oder 21:30
 * abhakt, nimmt die Tablette kaum um 7 Uhr (Runde 5: F13). Auf 5 Minuten
 * gerundet. → 'HH:MM' | null
 */
function abhakZeit(stand, heute) {
  const ab = tageWeiter(heute, -27);
  const minuten = Object.entries(stand.einnahmen)
    .filter(([tag, e]) => tag >= ab && tag <= heute && e && /^\d{2}:\d{2}$/.test(e.uhr || ''))
    .map(([, e]) => Number(e.uhr.slice(0, 2)) * 60 + Number(e.uhr.slice(3)))
    .sort((a, b) => a - b);
  if (minuten.length < 7) return null;
  const mitte = Math.round(minuten[Math.floor(minuten.length / 2)] / 5) * 5;
  const erinnerung = /^\d{2}:\d{2}$/.test(stand.einstellungen.erinnerung || '')
    ? Number(stand.einstellungen.erinnerung.slice(0, 2)) * 60 + Number(stand.einstellungen.erinnerung.slice(3)) : null;
  if (erinnerung !== null && Math.abs(mitte - erinnerung) < 60) return null;
  const m = Math.min(mitte, 23 * 60 + 55);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function berichtText(stand, heute) {
  const z = [];
  const name = einzeilig(stand.profil.name);
  z.push(`Schilddrüse – Bericht vom ${datumKurz(heute)}${name ? ` (${name})` : ''}`);
  z.push('');

  // Dosis (F15): aus den Zeiträumen, nicht aus den einzelnen Einträgen.
  // Runde 7: H18 – ein Eintrag, den am selben Tag ein anderer ersetzt hat,
  // galt keinen Tag und hat keinen Zeitraum: Vorher stand er als „Davor: 88 µg
  // ab 20.09." da, obwohl ab demselben Tag 100 µg eingetragen waren. Eine
  // Berichtigung ersetzt, worauf ihr `statt` zeigt, eine zweite die erste
  // (H1, H7, H11) – was dabei nie genommen wurde, nennt nieGenommenZeilen.
  const perioden = ez.dosisVerlauf(stand, heute);
  z.push('DOSIS');
  if (perioden.length) {
    // Gibt es nur künftige Einträge, gilt der früheste als aktuell (wie sp.aktuelleDosis).
    const aktuell = [...perioden].reverse().find((p) => !p.geplant) || perioden[0];
    const i = perioden.indexOf(aktuell);
    z.push(aktuellZeile(aktuell, perioden[i - 1] || null, heute));
    perioden.filter((p) => p.geplant && p !== aktuell)
      .forEach((p) => z.push(`Geplant ab ${datumKurz(p.ab)}: ${sp.dosisText(p.d)}${notizText(p)}${quelle(p.erster)}`));
    perioden.slice(0, i).slice(-3).reverse().forEach((p) => z.push(davorZeile(p)));
    /*
     * Runde 6: G11 – Einträge, die nach Angabe der Patientin nie galten (von
     * einer Berichtigung ersetzt, am selben Tag oder weil sie vor ihnen
     * beginnt). Vorher verschwand mit dem wahren Beginn der Berichtigung auch
     * die Nachricht, dass eine angeordnete Dosis nie umgesetzt wurde – die
     * Ärztin rechnete von einer Menge aus weiter, die nie genommen wurde.
     */
    ez.nieGenommenZeilen(stand, heute).forEach((x) => z.push(x));
    // Nachprüfung zu Runde 7 (N1): eine am selben Tag ersetzte Anordnung.
    ez.amTagErsetztZeilen(stand, heute).forEach((x) => z.push(x));
    z.push(`Einnahmezeit laut Erinnerung in der App (Angabe): etwa ${uhrText(stand.einstellungen.erinnerung)}`);
    const letzterTsh = [...stand.labor].reverse().find((l) => l.tsh && l.datum <= heute);
    if (letzterTsh && Q2[letzterTsh.einnahmeArt]) {
      z.push(`Nüchtern mit Wasser (Angabe zum Befund vom ${datumKurz(letzterTsh.datum)}): ${Q2[letzterTsh.einnahmeArt]}`);
    }
    const abgehakt = abhakZeit(stand, heute);
    if (abgehakt) z.push(`In den letzten 4 Wochen meist abgehakt gegen ${uhrText(abgehakt)} (App; die Uhrzeit des Abhakens kann von der Einnahme abweichen)`);
  } else {
    z.push('Keine Dosis eingetragen.');
  }
  z.push('');

  // Einnahmen
  const b8 = sp.einnahmeBilanz(56, heute);
  const b4 = sp.einnahmeBilanz(28, heute);
  z.push('EINNAHME');
  if (b8.tage) {
    const teile = [`an ${b8.genommen} von ${mehrzahl(b8.tage, 'Tag', 'Tagen')} genommen`];
    if (b8.ausgelassen) teile.push(`an ${mehrzahl(b8.ausgelassen, 'Tag', 'Tagen')} nicht genommen`);
    if (b8.unbekannt) teile.push(`${mehrzahl(b8.unbekannt, 'Tag', 'Tage')} ohne Eintrag`);
    // „Seit …" ist der Beginn des Zählens in der App, nicht der Behandlung –
    // neben „Aktuell: … seit 2019" las es sich sonst wie ein Neubeginn (F15).
    z.push(`${b8.tage < 56 ? `Seit ${datumKurz(tageWeiter(b8.bis, 1 - b8.tage))} (ab da zählt die App)` : 'Letzte 8 Wochen'}: ${teile.join(', ')}.`);
    if (b8.tage > 28) z.push(`Davon letzte 4 Wochen: an ${b4.genommen} von ${mehrzahl(b4.tage, 'Tag', 'Tagen')} genommen.`);
    if (b8.ausgelassenTage.length) z.push(`Nicht genommen am: ${b8.ausgelassenTage.map(datumKurz).join(', ')}`);
  } else {
    z.push('Noch keine Einnahmen erfasst.');
  }
  z.push('');

  // Labor
  z.push('LABORWERTE (aus den Befunden abgeschrieben)');
  const labor = [...stand.labor].reverse().slice(0, 5);
  if (labor.length) {
    labor.forEach((l) => {
      const werte = [...sp.LABORWERTE, ...sp.WEITERE_WERTE].filter(([k]) => l[k]).map(([k, n]) => wertText(n, l[k]));
      // Die Dosis an diesem Tag – und ob ihre Menge später als unzutreffend
      // gemeldet wurde: Dann ist sie nur, was die App damals wusste (F15).
      const damals = ez.dosisDamals(stand, l.datum, heute);
      const dosisDamals = damals && damals.td !== null
        ? ` – Dosis damals ${zahlText(damals.td, 1)} µg am Tag${damals.berichtigtDurch ? ` (laut App; später berichtigt, Berichtigung ab ${datumKurz(damals.berichtigtDurch.ab)})` : ''}` : '';
      const notiz = mehrzeilig(l.notiz);
      z.push(`${datumKurz(l.datum)}: ${werte.join(', ')}${dosisDamals}${notiz ? ` – ${notiz}` : ''}`);
    });
  } else {
    z.push('Keine Laborwerte eingetragen.');
  }
  z.push('');

  // Gewicht
  z.push('GEWICHT');
  if (stand.gewicht.length) {
    const letzt = stand.gewicht[stand.gewicht.length - 1];
    // Zum Vergleich der jüngste Wert, der mindestens zwei Monate vor dem
    // letzten liegt – mit seinem Datum und ohne „vor etwa drei Monaten": Lag
    // er in Wahrheit 15 Monate zurück, las sich der Unterschied sonst wie ein
    // schneller Gewichtsverlust, im Alter ein Warnzeichen.
    const grenze = tageWeiter(letzt.datum, -60);
    const aelter = [...stand.gewicht].reverse().find((g) => g.datum <= grenze);
    z.push(`${zahlText(letzt.kg, 1)} kg am ${datumKurz(letzt.datum)}${aelter ? `; davor ${zahlText(aelter.kg, 1)} kg am ${datumKurz(aelter.datum)}` : ''}`);
  } else {
    z.push('Kein Gewicht eingetragen.');
  }
  z.push('');

  // Befinden
  z.push('BEFINDEN (letzte 8 Wochen)');
  const ab = tageWeiter(heute, -55);
  const befinden = stand.befinden.filter((x) => x.datum >= ab);
  if (befinden.length) {
    const anzahl = { gut: 0, mittel: 0, schlecht: 0 };
    const beschwerden = {};
    befinden.forEach((x) => {
      anzahl[x.stufe]++;
      x.beschwerden.forEach((k) => { beschwerden[k] = (beschwerden[k] || 0) + 1; });
    });
    const verteilung = [['gut', anzahl.gut], ['mittel', anzahl.mittel], ['schlecht', anzahl.schlecht]]
      .filter(([, n]) => n).map(([t, n]) => `${n}× ${t}`).join(', ');
    z.push(`${mehrzahl(befinden.length, 'Eintrag', 'Einträge')}: ${verteilung}.`);
    // Mit den Namen früherer Fassungen: Der alte Punkt „trockene Haut,
    // Haarausfall" heißt, was er war – nicht „trockene Haut" (C22, RW1 B1).
    // Alle Beschwerden mit Anzahl, nicht nur die fünf häufigsten: Ein
    // einmaliger Eintrag „lebensmüde", „Herzstolpern" oder „ungewollt
    // abgenommen" fiel sonst weg, sobald es fünf häufigere gab (Runde 5: F9).
    const alle = Object.entries(beschwerden).sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `${sp.beschwerdeName(k)} (${n}×)`);
    if (alle.length) z.push(`Beschwerden nach Häufigkeit: ${alle.join('; ')}`);
    // Die Beschwerden mit eigenem Warn-Pfad (W5, S4, S4ii/R3, W2t) mit Datum –
    // auch ohne P6: P6 sperrt diese Warnzeichen nicht, und die App hat sie der
    // Patientin gezeigt (F9). Nur die Angabe, ohne Stufe und ohne Auswertung.
    const warn = ez.warnBeschwerden(stand, heute, 56);
    if (warn.length) z.push(`Warnbeschwerden (Angabe): ${warn.map((x) => `${x.name} am ${x.daten.map(datumKurz).join(', ')}`).join('; ')}.`);
    const notizen = befinden.filter((x) => saeubern(x.notiz).trim()).slice(-3);
    notizen.forEach((x) => z.push(`${datumKurz(x.datum)} (${stufeText(x.stufe)}): ${mehrzeilig(x.notiz)}`));
  } else {
    z.push('Keine Einträge.');
  }
  z.push('');

  /*
   * Angaben und – nur bei bestätigter Behandlung – die Einschätzung der App
   * (RW1 B1, RW2 B1/B2). Beide Fassungen kommen aus dem Kern, mit derselben
   * Befundauswahl (F11, F12). Die Gesamteinschätzung wie auf „Heute" steht
   * gleich unter „Grundlage" – mit ihr die höchste Stufe, die die App der
   * Patientin gezeigt hat (F10). Den Pflichttext unter einer Richtung liefert
   * dosisBerichtZeilen() selbst („Der Patientin dazu gezeigt: …").
   */
  if (ez.aktiv(stand)) {
    const zeilen = ez.berichtZeilen(stand, heute);
    // Ohne „Grundlage:" (ändert sich der Kern) gleich unter der Überschrift – nie still weg.
    const grundlage = zeilen.findIndex((x) => x.startsWith('Grundlage:'));
    zeilen.splice(grundlage >= 0 ? grundlage + 1 : Math.min(1, zeilen.length), 0, ...gesamtBerichtZeilen(stand, heute));
    zeilen.forEach((x) => z.push(x));
    dosisBerichtZeilen(stand, heute).forEach((x) => z.push(x));
  } else {
    ez.angabenZeilen(stand, heute).forEach((x) => z.push(x));
  }
  z.push('');

  // Fragen – eine mehrzeilige Frage bleibt unter ihrem Strich (F26).
  const fragen = stand.fragen.filter((f) => !f.erledigt);
  if (fragen.length) {
    z.push('FRAGEN FÜR DEN TERMIN');
    fragen.forEach((f) => z.push(`– ${mehrzeilig(f.text, '  ')}`));
    z.push('');
  }

  z.push('Aufgezeichnet mit der App „Schilddrüse". Ihre Einordnung folgt festen Regeln, ersetzt keine ärztliche Beratung und rechnet keine neue Dosis aus.');
  return z.join('\n');
}
