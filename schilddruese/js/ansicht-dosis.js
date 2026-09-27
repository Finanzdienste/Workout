/*
 * Die Dosis-Karte: Spricht der letzte TSH-Wert für mehr, weniger oder gleich
 * viel? Und die kleine Seite „Die Praxis hat entschieden" (D6b).
 *
 * Gerechnet wird in js/dosis.js – in der verbindlichen Reihenfolge:
 * Warnzeichen, Schwangerschaft, Sperrgründe, offene Fragen (eine je Anzeige),
 * dann die Richtung. Hier wird nur gezeigt, was dosisRichtung() liefert.
 *
 * Drei Dinge sind hier Gestaltungsregel und nicht Geschmack (Regelwerk 2,
 * Grundsatz 8 und D6):
 *   - Der Titel mit der Richtung ist nie größer als der Pflichttext darunter –
 *     beide in derselben Schriftgröße, der Titel nur fett.
 *   - Der Pflichttext ist immer sichtbar, nie aufklappbar.
 *   - Die 112-Zeichen (W-D2) stehen direkt unter der Richtung, rot, ohne Link.
 * Deshalb nennt auch „Heute" die Richtung nicht, sondern verweist nur hierher:
 * Eine Richtung ohne Pflichttext darf es nirgends geben.
 */
import { datumKurz, zahlText } from './datum.js';
import { esc } from './text.js';
import * as ez from './einschaetzung.js';
import { dosisRichtung } from './dosis.js';
import { stufeSchild, STUFE_KLASSE, p6Karte } from './ansicht-einschaetzung.js';

const PRAXIS_WAHL = [
  ['bleibt', 'Die Dosis bleibt so'],
  ['geaendert', 'Neue Dosis eintragen'],
  ['nachmessen', 'Erst nachmessen'],
];
export const PRAXIS_BESTAETIGUNG = 'Gut. Es gilt, was die Praxis gesagt hat. Die App zeigt zu diesem Befund keine Richtung mehr und erinnert Sie an die Kontrolle.';

/** Die offene Frage der Karte, mit einem Knopf je Antwort. */
function frageBlock(f, stand) {
  let antworten;
  if (f.typ === 'jahr') {
    // X6: das Geburtsjahr als Zahl – ein eigenes kleines Formular.
    const jetzt = stand.profil.geburtsjahr ? String(stand.profil.geburtsjahr) : '';
    antworten = `
      <form data-formular="geburtsjahr" class="jahr-form" novalidate>
        <label class="feld"><span>Geburtsjahr</span>
          <input type="text" inputmode="numeric" name="geburtsjahr" value="${esc(jetzt)}" placeholder="z. B. 1952" autocomplete="off">
        </label>
        <button type="submit" class="knopf knopf-haupt knopf-breit">Speichern</button>
      </form>`;
  } else if (f.ziel === 'warncheck') {
    antworten = '<button type="button" class="knopf knopf-haupt knopf-breit" data-act="seite" data-seite="warnzeichen">Zum Warnzeichen-Check</button>';
  } else {
    antworten = `<div class="antworten">${(f.optionen || []).map(([wert, text]) => `
      <button type="button" class="knopf antwort" data-act="frage-antwort" data-ziel="${esc(f.ziel)}" data-feld="${esc(f.feld)}"${f.bezug ? ` data-bezug="${esc(f.bezug)}"` : ''} data-wert="${esc(wert)}">${esc(text)}</button>`).join('')}</div>`;
  }
  return `
    <div class="dosis-frage" data-frage="${esc(f.id)}">
      <p class="dosis-frage-text" id="dosis-frage-text">${esc(f.text)}</p>
      ${antworten}
    </div>`;
}

function dosisKarteSeite(stand, heute) {
  const titel = 'Dosis-Karte';
  if (!ez.aktiv(stand)) return { titel, html: p6Karte() };
  const k = dosisRichtung(stand, heute);
  if (!k) {
    return {
      titel,
      html: `
        <div class="karte">
          <p>Für eine Aussage zur Dosis braucht es einen Befund mit TSH-Wert – am besten mit dem Bereich Ihres Labors (untere und obere Grenze).</p>
          <div class="knopf-reihe"><button type="button" class="knopf knopf-haupt" data-act="seite" data-seite="labor">Befund eintragen</button></div>
        </div>`,
    };
  }
  const b = k.befund;
  const entschieden = ['bleibt', 'geaendert', 'nachmessen'].includes(b.praxis);
  const teile = [];
  if (entschieden && b.praxisAm === heute) {
    teile.push(`<div class="hinweis-karte ok" role="status"><span class="ri" aria-hidden="true">✓</span><div>${esc(PRAXIS_BESTAETIGUNG)}</div></div>`);
  }
  teile.push(`
    <div class="karte dosis-karte ${STUFE_KLASSE[k.stufe]}" id="dosis-karte" tabindex="-1" data-richtung="${esc(k.richtung)}" data-stufe="${esc(k.stufe)}">
      <p class="stufe-zeile">${stufeSchild(k.stufe)}</p>
      <p class="dosis-titel">${esc(k.titel)}</p>
      ${k.frage ? frageBlock(k.frage, stand) : ''}
      ${k.texte.map((t) => `<p class="dosis-text">${esc(t)}</p>`).join('')}
      ${k.gruende.length ? `<ul class="gruende">${k.gruende.map((g) => `<li data-grund="${esc(g.id)}">${esc(g.text)}</li>`).join('')}</ul>` : ''}
      ${k.schritt && !k.texte.some((t) => t.includes(k.schritt)) ? `<p class="dosis-text schritt">${esc(k.schritt)}</p>` : ''}
      ${k.warnzeichen ? `<p class="warnzeichen-zeile" role="note">${esc(k.warnzeichen)}</p>` : ''}
      <p class="pflicht">${esc(k.pflicht)}</p>
      ${k.hinweise.map((h) => `<p class="klein">${esc(h)}</p>`).join('')}
      ${k.aktion === 'dosis' ? '<div class="knopf-reihe"><button type="button" class="knopf knopf-haupt" data-act="seite" data-seite="dosis">Dosis eintragen</button></div>' : ''}
      <div class="knopf-reihe"><button type="button" class="knopf" data-act="seite" data-seite="praxis-entschieden" data-param="${esc(b.id)}">Die Praxis hat entschieden</button></div>
      <p class="klein gedaempft grundlage">${esc(k.grundlage)}</p>
    </div>`);
  teile.push(`<p class="klein gedaempft">${esc(ez.FUSSZEILE)}</p>`);
  return { titel, html: teile.join(''), merken: k.merken || null };
}

/** D6b: Was hat die Praxis entschieden? Drei große Knöpfe. */
function praxisSeite(param, stand) {
  const b = stand.labor.find((l) => l.id === param);
  if (!b) return { titel: 'Die Praxis hat entschieden', html: '<div class="karte"><p>Diesen Befund gibt es nicht mehr.</p></div>' };
  const tsh = b.tsh ? ` (TSH ${zahlText(b.tsh.wert)} ${b.tsh.einheit})` : '';
  return {
    titel: 'Die Praxis hat entschieden',
    html: `
      <p style="margin-bottom:.8rem">Was hat die Praxis zum Befund vom ${esc(datumKurz(b.datum))}${esc(tsh)} gesagt?</p>
      <div class="antworten gross-antworten">
        ${PRAXIS_WAHL.map(([w, t]) => `<button type="button" class="knopf antwort" data-act="praxis-entscheid" data-id="${esc(b.id)}" data-wert="${esc(w)}" aria-pressed="${b.praxis === w}">${esc(t)}</button>`).join('')}
      </div>
      <p class="klein gedaempft" style="margin-top:.8rem">Danach zeigt die App zu diesem Befund keine Richtung mehr. Bei „Neue Dosis eintragen" öffnet sich gleich das Formular für die neue Dosis.</p>
      <div class="knopf-reihe"><button type="button" class="knopf knopf-leise" data-act="zurueck">Abbrechen</button></div>`,
  };
}

/** Seiten dieses Bereichs: { titel, html } oder null. */
export function dosisSeite(name, param, stand, heute) {
  switch (name) {
    case 'dosis-karte': return dosisKarteSeite(stand, heute);
    case 'praxis-entschieden': return praxisSeite(param, stand);
    default: return null;
  }
}

/**
 * Für „Heute": ein Verweis auf die Karte, wenn sie eine Richtung oder eine
 * offene Frage hat – ohne die Richtung selbst zu nennen (Grundsatz 8: nie
 * ohne den Pflichttext). null, wenn nichts ansteht.
 */
export function dosisVerweis(stand, heute) {
  if (!ez.aktiv(stand)) return null;
  const k = dosisRichtung(stand, heute);
  if (!k) return null;
  const richtung = k.richtung === 'mehr' || k.richtung === 'weniger';
  if (!richtung && !k.frage) return null;
  const text = k.frage
    ? `Zu Ihrem Befund vom ${datumKurz(k.befund.datum)} hat die Dosis-Karte eine Frage an Sie.`
    : `Zu Ihrem Befund vom ${datumKurz(k.befund.datum)} gibt es eine Einschätzung zur Dosis. Bitte lesen Sie sie ganz – und rufen Sie vor jeder Änderung die Praxis an.`;
  return { stufe: k.stufe, text };
}
