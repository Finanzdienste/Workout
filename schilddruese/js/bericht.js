/*
 * Der Bericht für den Arzttermin – der Grund, warum die App überhaupt Daten
 * sammelt.
 *
 * Eine Seite, zum Zeigen, Vorlesen, Weiterschicken oder Drucken: Dosis seit
 * wann, wie zuverlässig genommen, die letzten Laborwerte mit der damals
 * gültigen Dosis, Gewicht, Befinden, andere Medikamente und die notierten
 * Fragen. Als schlichter Text, damit er in jede Nachricht passt.
 *
 * Der Hauptteil sagt, was war. Was die App daraus nach festen Regeln
 * einordnet, steht getrennt darunter im Abschnitt „EINSCHÄTZUNG DER APP" –
 * gekennzeichnet, woher jede Angabe stammt (Angabe der Patientin, vom Befund
 * übertragen, von der App berechnet), mit der zuletzt gezeigten Dosis-Karte.
 * Nur bei bestätigter Behandlung (P6); was daraus folgt, sagt die Ärztin.
 */
import { datumKurz, zahlText, tageWeiter, uhrText } from './datum.js';
import * as sp from './speicher.js';
import { mehrzahl } from './text.js';
import * as ez from './einschaetzung.js';
import { dosisBerichtZeilen } from './dosis.js';

/** B2 (Regelwerk 2): ob eine Dosis auf Anweisung der Praxis eingetragen wurde. */
const quelle = (d) => (d.praxis === true ? ' – auf Anweisung der Praxis: ja' : d.praxis === false ? ' – auf Anweisung der Praxis: nein' : '');

function stufeText(s) {
  return { gut: 'gut', mittel: 'mittel', schlecht: 'schlecht' }[s] || s;
}

/*
 * Ein Wert so, wie er auf dem Befund steht: „< 0,01" mit dem Zeichen, ein
 * einseitiger Bereich als „ab 20" oder „bis 5". Vorher fehlte das „<", ein
 * Bereich nur mit Obergrenze fehlte ganz, und einer nur mit Untergrenze stand
 * als „20––" da (B49, B56).
 */
function wertText(name, w) {
  const v = w.von !== null && w.von !== undefined;
  const b = w.bis !== null && w.bis !== undefined;
  const bereich = v && b ? ` (Labor ${zahlText(w.von)}–${zahlText(w.bis)})` : v ? ` (Labor ab ${zahlText(w.von)})` : b ? ` (Labor bis ${zahlText(w.bis)})` : '';
  return `${name} ${w.unter ? '< ' : ''}${zahlText(w.wert)} ${w.einheit}${bereich}`;
}

/*
 * RW2 B1: Der Bericht enthält die Antworten auf F1–F8 und Q1–Q5. Die Zeile
 * „Angaben zur Abnahme" aus dem Kern nennt F1–F7, die Packung und Q1; hier
 * kommen Q2 (nüchtern), Q3 (Abstände), Q5 (versehentlich mehr) und F8 (was
 * die Praxis gesagt hat) dazu – gerade „einmal viele Tabletten auf einmal"
 * muss die Ärztin lesen (B45, B65). Dazu Q4 im Profil.
 */
const ANTWORT = { ja: 'ja', nein: 'nein', unbekannt: 'weiß nicht', '': 'nicht beantwortet' };
const Q2 = { ja: 'ja', abends: 'abends, mit der Praxis abgesprochen', nein: 'nein', unbekannt: 'weiß nicht', '': 'nicht beantwortet' };
const Q5 = { nein: 'nein', einmal: 'ja, einmal viele Tabletten auf einmal', tage: 'ja, über Tage zu viel oder eine andere Stärke', unbekannt: 'weiß nicht', '': 'nicht beantwortet' };
const F8 = { bleibt: 'Dosis bleibt', geaendert: 'Dosis wird geändert', nachmessen: 'erst nachmessen', nochnicht: 'noch nichts gesagt', '': 'nicht beantwortet' };

function weitereAngaben(l, mitDatum) {
  const teile = [
    `nüchtern mit Wasser: ${Q2[l.einnahmeArt || ''] || l.einnahmeArt}`,
    l.abstandOk ? `Abstände eingehalten: ${ANTWORT[l.abstandOk] || l.abstandOk}` : null,
    `versehentlich mehr genommen: ${Q5[l.verwechselt || ''] || l.verwechselt}`,
    `Praxis zu diesem Wert: ${F8[l.praxis || ''] || l.praxis}${l.praxis && l.praxisAm ? ` (angegeben ${datumKurz(l.praxisAm)})` : ''}`,
  ].filter(Boolean);
  return `  Weitere Angaben${mitDatum ? ` zum Befund vom ${datumKurz(l.datum)}` : ''} (Angabe): ${teile.join('; ')}.`;
}

/** Die Zeilen des Kerns (Einschätzung der App) mit den Antworten, die dort fehlen. */
function einschaetzungZeilen(stand, heute) {
  const z = [];
  const p = stand.profil;
  // Dieselben Befunde, die berichtZeilen() beschreibt: die letzten drei bis heute, neueste zuerst.
  const befunde = stand.labor.filter((l) => l.datum <= heute).slice(-3).reverse();
  let n = 0;
  ez.berichtZeilen(stand, heute).forEach((x) => {
    z.push(x);
    if (x.startsWith('Profil (Angabe)') && (p.hypophyseOderNiedrig || ['andere', 'unbekannt', ''].includes(p.ursache))) {
      z.push(`  Ursache in der Hirnanhangdrüse oder TSH bewusst niedrig (Angabe): ${ANTWORT[p.hypophyseOderNiedrig || '']}.`);
    }
    if (x.startsWith('  Angaben zur Abnahme') && befunde[n]) z.push(weitereAngaben(befunde[n++], false));
  });
  // Ändert sich die Zeile im Kern, gehen die Antworten nicht still verloren –
  // dann stehen sie mit Datum am Ende des Abschnitts.
  befunde.slice(n).forEach((l) => z.push(weitereAngaben(l, true)));
  return z;
}

export function berichtText(stand, heute) {
  const z = [];
  z.push(`Schilddrüse – Bericht vom ${datumKurz(heute)}${stand.profil.name ? ` (${stand.profil.name})` : ''}`);
  z.push('');

  // Dosis
  const dosis = sp.aktuelleDosis(heute);
  z.push('DOSIS');
  if (dosis) {
    z.push(`Aktuell: ${sp.dosisText(dosis)}, ${dosis.ab > heute ? 'ab' : 'seit'} ${datumKurz(dosis.ab)}${dosis.notiz ? ` (${dosis.notiz})` : ''}${quelle(dosis)}`);
    stand.dosen.filter((d) => d.ab > heute && d !== dosis)
      .forEach((d) => z.push(`Geplant ab ${datumKurz(d.ab)}: ${sp.dosisText(d)}${d.notiz ? ` (${d.notiz})` : ''}${quelle(d)}`));
    const fruehere = stand.dosen.filter((d) => d.ab < dosis.ab).slice(-3).reverse();
    fruehere.forEach((d) => z.push(`Davor: ${sp.dosisText(d)}, ab ${datumKurz(d.ab)}${quelle(d)}`));
    z.push(`Einnahmezeit: etwa ${uhrText(stand.einstellungen.erinnerung)}, nüchtern`);
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
    z.push(`${b8.tage < 56 ? `Seit ${datumKurz(tageWeiter(b8.bis, 1 - b8.tage))}` : 'Letzte 8 Wochen'}: ${teile.join(', ')}.`);
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
      const d = sp.dosisAm(l.datum);
      const werte = [...sp.LABORWERTE, ...sp.WEITERE_WERTE].filter(([k]) => l[k]).map(([k, name]) => wertText(name, l[k]));
      const tag = sp.tagesdosis(d);
      z.push(`${datumKurz(l.datum)}: ${werte.join(', ')}${tag !== null ? ` – Dosis damals ${zahlText(tag, 1)} µg am Tag` : ''}${l.notiz ? ` – ${l.notiz}` : ''}`);
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
    const haeufig = Object.entries(beschwerden).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([k, n]) => `${sp.beschwerdeName(k)} (${n}×)`);
    if (haeufig.length) z.push(`Häufigste Beschwerden: ${haeufig.join(', ')}`);
    const notizen = befinden.filter((x) => x.notiz).slice(-3);
    notizen.forEach((x) => z.push(`${datumKurz(x.datum)} (${stufeText(x.stufe)}): ${x.notiz}`));
  } else {
    z.push('Keine Einträge.');
  }
  z.push('');

  // Einschätzung der App (RW1 B1, RW2 B1/B2) – nur bei bestätigter Behandlung.
  // Den Pflichttext unter einer Richtung liefert dosisBerichtZeilen() selbst
  // („Der Patientin dazu gezeigt: …") – hier nicht noch einmal anhängen.
  if (ez.aktiv(stand)) {
    einschaetzungZeilen(stand, heute).forEach((x) => z.push(x));
    dosisBerichtZeilen(stand, heute).forEach((x) => z.push(x));
    z.push('');
  }

  // Fragen
  const fragen = stand.fragen.filter((f) => !f.erledigt);
  if (fragen.length) {
    z.push('FRAGEN FÜR DEN TERMIN');
    fragen.forEach((f) => z.push(`– ${f.text}`));
    z.push('');
  }

  z.push('Aufgezeichnet mit der App „Schilddrüse". Ihre Einordnung folgt festen Regeln, ersetzt keine ärztliche Beratung und rechnet keine neue Dosis aus.');
  return z.join('\n');
}
