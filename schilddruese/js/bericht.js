/*
 * Der Bericht für den Arzttermin – der Grund, warum die App überhaupt Daten
 * sammelt.
 *
 * Eine Seite, zum Zeigen, Vorlesen, Weiterschicken oder Drucken: Dosis seit
 * wann, wie zuverlässig genommen, die letzten Laborwerte mit der damals
 * gültigen Dosis, Gewicht, Befinden, andere Medikamente und die notierten
 * Fragen. Als schlichter Text, damit er in jede Nachricht passt.
 *
 * Was nicht drinsteht: eine Bewertung. Der Bericht sagt, was war – was daraus
 * folgt, sagt die Ärztin.
 */
import { datumKurz, zahlText, tageWeiter, uhrText } from './datum.js';
import * as sp from './speicher.js';
import { mehrzahl } from './text.js';

function stufeText(s) {
  return { gut: 'gut', mittel: 'mittel', schlecht: 'schlecht' }[s] || s;
}

export function berichtText(stand, heute) {
  const z = [];
  z.push(`Schilddrüse – Bericht vom ${datumKurz(heute)}${stand.profil.name ? ` (${stand.profil.name})` : ''}`);
  z.push('');

  // Dosis
  const dosis = sp.aktuelleDosis();
  z.push('DOSIS');
  if (dosis) {
    z.push(`Aktuell: ${sp.dosisText(dosis)}, seit ${datumKurz(dosis.ab)}${dosis.notiz ? ` (${dosis.notiz})` : ''}`);
    const fruehere = stand.dosen.slice(0, -1).slice(-3).reverse();
    fruehere.forEach((d) => z.push(`Davor: ${sp.dosisText(d)}, ab ${datumKurz(d.ab)}`));
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
    z.push(`${b8.tage < 56 ? `Seit ${datumKurz(tageWeiter(heute, 1 - b8.tage))}` : 'Letzte 8 Wochen'}: ${teile.join(', ')}.`);
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
      const werte = sp.LABORWERTE.filter(([k]) => l[k]).map(([k, name]) => {
        const w = l[k];
        return `${name} ${zahlText(w.wert)} ${w.einheit}${w.von !== null ? ` (Labor ${zahlText(w.von)}–${zahlText(w.bis)})` : ''}`;
      });
      z.push(`${datumKurz(l.datum)}: ${werte.join(', ')}${d && d.mikrogramm !== null ? ` – Dosis damals ${zahlText(d.mikrogramm, 1)} µg` : ''}${l.notiz ? ` – ${l.notiz}` : ''}`);
    });
  } else {
    z.push('Keine Laborwerte eingetragen.');
  }
  z.push('');

  // Gewicht
  z.push('GEWICHT');
  if (stand.gewicht.length) {
    const letzt = stand.gewicht[stand.gewicht.length - 1];
    const grenze = tageWeiter(heute, -90);
    const aelter = [...stand.gewicht].reverse().find((g) => g.datum <= grenze);
    z.push(`${zahlText(letzt.kg, 1)} kg am ${datumKurz(letzt.datum)}${aelter ? `; vor etwa drei Monaten ${zahlText(aelter.kg, 1)} kg (${datumKurz(aelter.datum)})` : ''}`);
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
    const haeufig = Object.entries(beschwerden).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([k, n]) => `${(sp.BESCHWERDEN.find(([id]) => id === k) || [k, k])[1]} (${n}×)`);
    if (haeufig.length) z.push(`Häufigste Beschwerden: ${haeufig.join(', ')}`);
    const notizen = befinden.filter((x) => x.notiz).slice(-3);
    notizen.forEach((x) => z.push(`${datumKurz(x.datum)} (${stufeText(x.stufe)}): ${x.notiz}`));
  } else {
    z.push('Keine Einträge.');
  }
  z.push('');

  // Fragen
  const fragen = stand.fragen.filter((f) => !f.erledigt);
  if (fragen.length) {
    z.push('FRAGEN FÜR DEN TERMIN');
    fragen.forEach((f) => z.push(`– ${f.text}`));
    z.push('');
  }

  z.push('Aufgezeichnet mit der App „Schilddrüse". Die App bewertet keine Werte und ersetzt keine ärztliche Beratung.');
  return z.join('\n');
}
