/*
 * Der Ausdruck für den Arzttermin.
 *
 * Zehn Minuten Sprechstunde und die Frage „und, wie war es?" – darauf ist
 * niemand aus dem Kopf vorbereitet. Diese Datei macht aus Wochen an
 * Eintragungen eine Seite Text: Zeitraum, wie viele Tage mit Beschwerden, wie
 * stark, wann, was auffällig war, welche Mittel genommen wurden.
 *
 * Bewusst reiner Text und kein PDF: Text lässt sich in jede Mail einfügen, auf
 * jedem Gerät ausdrucken und vorher noch ändern. Und was man ändern kann,
 * liest man vorher – bei einem erzeugten PDF tut das erfahrungsgemäß niemand.
 *
 * Der Bericht behauptet nichts. Er zählt, und er sagt dazu, wie oft. Die
 * Einordnung macht die Praxis.
 */
import { fmtDatum, tageDazwischen } from './datum.js';
import { fmtZahl, mehrzahl } from './text.js';
import { ausloeserName, beschwerdeName, STAERKE_WORT } from './daten.js';
import { ausloeserBilanz, einstufung, gesamtZahlen, nachArt, nachTageszeit } from './auswertung.js';

const prozent = (x) => `${Math.round(x * 100)} %`;

/**
 * @param {object} zustand  der gesamte Speicherzustand
 * @param {string} von, bis ISO-Daten, einschließlich
 */
export function arztBericht(zustand, von, bis) {
  const { eintraege, tage } = zustand;
  const imZeitraum = eintraege.filter((e) => e.am >= von && e.am <= bis);
  const z = gesamtZahlen(imZeitraum, tage, von, bis);
  const zeilen = [];
  const sag = (s = '') => zeilen.push(s);

  sag('Magen-Tagebuch');
  sag(`Zeitraum: ${fmtDatum(von, true)} bis ${fmtDatum(bis, true)} `
    + `(${mehrzahl(tageDazwischen(von, bis) + 1, 'Tag', 'Tage')})`);
  sag();

  if (!z.notierteTage) {
    sag('In diesem Zeitraum wurde nichts eingetragen.');
    return zeilen.join('\n');
  }

  sag('ÜBERSICHT');
  sag(`  Tage mit Eintragung        ${z.notierteTage} von ${z.tage}`);
  sag(`  Tage mit Beschwerden       ${z.tageMitBeschwerden} (${prozent(z.anteil)} der eingetragenen Tage)`);
  sag(`  Stärke im Mittel           ${fmtZahl(z.schnitt)} von 10`);
  sag(`  Höchster Wert              ${z.hoechster} von 10 (${STAERKE_WORT[z.hoechster] || ''})`);
  sag(`  Mahlzeiten eingetragen     ${z.mahlzeiten}`);
  sag(`  Medikamenteneinnahmen      ${z.medikamente}`);
  sag();

  const arten = nachArt(imZeitraum);
  if (arten.length) {
    sag('BESCHWERDEN NACH ART');
    arten.slice(0, 8).forEach((a) => {
      sag(`  ${beschwerdeName(a.id).padEnd(24)} ${mehrzahl(a.anzahl, 'Mal', 'Mal')}`);
    });
    sag();
  }

  const zeiten = nachTageszeit(imZeitraum);
  if (zeiten.length) {
    sag('BESCHWERDEN NACH TAGESZEIT');
    zeiten.forEach((t) => {
      sag(`  ${t.name.padEnd(24)} ${String(t.anzahl).padStart(3)} Mal, `
        + `im Mittel ${fmtZahl(t.schnitt)}`);
    });
    sag();
  }

  const bilanz = ausloeserBilanz(imZeitraum, {
    fenster: zustand.fenster,
    mindestFaelle: zustand.mindestFaelle,
    eigene: zustand.eigeneAusloeser,
  }).filter((b) => b.genug && einstufung(b) !== 'neutral' && einstufung(b) !== 'unauffaellig');

  if (bilanz.length) {
    sag(`AUFFÄLLIG IM ZEITRAUM VON ${zustand.fenster} STUNDEN NACH DEM ESSEN`);
    sag('  (Vergleich: mittlere Beschwerdestärke danach gegen alle übrigen Mahlzeiten)');
    bilanz.slice(0, 8).forEach((b) => {
      sag(`  ${ausloeserName(b.id, zustand.eigeneAusloeser).padEnd(24)} `
        + `${fmtZahl(b.schnittMit)} gegen ${fmtZahl(b.schnittOhne)} `
        + `(${b.faelle} Mahlzeiten damit, ${b.gegenFaelle} ohne)`);
    });
    sag();
  }

  const mittel = new Map();
  imZeitraum.filter((e) => e.art === 'medikament').forEach((e) => {
    const name = (e.mittel || 'ohne Angabe').trim();
    mittel.set(name, (mittel.get(name) || 0) + 1);
  });
  if (mittel.size) {
    sag('EINGENOMMENE MITTEL');
    [...mittel.entries()].sort((a, b) => b[1] - a[1]).forEach(([name, n]) => {
      sag(`  ${name.padEnd(24)} ${mehrzahl(n, 'Mal', 'Mal')}`);
    });
    sag();
  }

  const notizen = imZeitraum.filter((e) => e.art === 'notiz' && String(e.text || '').trim());
  if (notizen.length) {
    sag('NOTIZEN');
    notizen.slice(-12).forEach((e) => sag(`  ${fmtDatum(e.am)} ${e.um}  ${e.text.trim()}`));
    sag();
  }

  sag('---');
  sag('Selbst geführtes Tagebuch. Die Zahlen sind gezählt, nicht gedeutet;');
  sag('„auffällig" heißt hier nur: nach diesen Mahlzeiten stand im Mittel ein');
  sag('höherer Wert als nach den übrigen.');
  return zeilen.join('\n');
}

/** Dateiname für den Bericht – ohne Umlaute, damit ihn jedes System annimmt. */
export function berichtName(von, bis) {
  return `magen-tagebuch-${von}-bis-${bis}.txt`;
}
