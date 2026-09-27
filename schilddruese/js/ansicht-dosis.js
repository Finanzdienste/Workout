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
import { stufeSchild, STUFE_KLASSE, p6Karte, beschwerdeKnoepfe, anrufKnopf, anrufReihe, rang } from './ansicht-einschaetzung.js';

const PRAXIS_WAHL = [
  ['bleibt', 'Die Dosis bleibt so'],
  ['geaendert', 'Neue Dosis eintragen'],
  ['nachmessen', 'Erst nachmessen'],
];
export const PRAXIS_BESTAETIGUNG = 'Gut. Es gilt, was die Praxis gesagt hat. Die App zeigt zu diesem Befund keine Richtung mehr und erinnert Sie an die Kontrolle.';
/*
 * „Die Dosis wird geändert": Die Erinnerung an die Kontrolle hängt am neuen
 * Dosis-Eintrag (D6c) – bevor er da ist, darf die Meldung sie nicht versprechen.
 */
export const PRAXIS_NEUE_DOSIS = 'Gut. Bitte tragen Sie jetzt die neue Dosis ein, die die Praxis festgelegt hat – dann erinnert die App an die Kontrolle.';

/*
 * Anruf-Knöpfe unter einem Grund. Jeder Grund bringt seine Nummern mit
 * (js/dosis.js: g.anrufe) – den Giftnotruf fürs eingetragene Bundesland, die
 * Telefonseelsorge, 116 117, 112. Vorher gab es Knöpfe nur bei W5 und bei der
 * Stufe 112: „Rufen Sie heute noch den Giftnotruf an" stand ohne Nummer da.
 */
function grundKnoepfe(g) {
  if (g.anrufe && g.anrufe.length) return anrufReihe(g.anrufe);
  if (g.id === 'W5') return beschwerdeKnoepfe('W5');
  if (g.stufe === 'notruf') return `<div class="knopf-reihe">${anrufKnopf('112', '112 anrufen', { notruf: true, breit: true })}</div>`;
  return '';
}

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
  // Die Bestätigung verspricht die Erinnerung an die Kontrolle – nicht, solange
  // die neue Dosis noch einzutragen ist (aktionParam 'praxis'): Dann gibt es
  // die Erinnerung noch nicht (B27).
  if (entschieden && b.praxisAm === heute && k.aktionParam !== 'praxis') {
    teile.push(`<div class="hinweis-karte ok" role="status"><span class="ri" aria-hidden="true">✓</span><div>${esc(PRAXIS_BESTAETIGUNG)}</div></div>`);
  }
  // Nummern, die Kopf, Texte, Frage oder die 112-Zeichen nennen, aber kein
  // Grund – etwa 116 117 aus „Heute anrufen" oder 112 aus W-D2 –, als eigene
  // Knopfreihe unter der Warnzeile: Jede genannte Nummer ist anrufbar.
  const inGruenden = new Set(k.gruende.flatMap((g) => (g.anrufe || []).map((a) => a.nummer)));
  const uebrige = (k.anrufe || []).filter((a) => !inGruenden.has(a.nummer));
  teile.push(`
    <div class="karte dosis-karte ${STUFE_KLASSE[k.stufe]}" id="dosis-karte" tabindex="-1" data-richtung="${esc(k.richtung)}" data-stufe="${esc(k.stufe)}">
      <p class="stufe-zeile">${stufeSchild(k.stufe, k.kopf ? k.kopf.titel : ez.kopfFuer(k.stufe, k.gruende).titel)}</p>
      <p class="dosis-titel">${esc(k.titel)}</p>
      ${k.frage ? frageBlock(k.frage, stand) : ''}
      ${k.texte.map((t) => `<p class="dosis-text">${esc(t)}</p>`).join('')}
      ${k.gruende.length ? `<ul class="gruende">${k.gruende.map((g) => `<li data-grund="${esc(g.id)}">${esc(g.text)}${grundKnoepfe(g)}</li>`).join('')}</ul>` : ''}
      ${k.schritt && !k.texte.some((t) => t.includes(k.schritt)) ? `<p class="dosis-text schritt">${esc(k.schritt)}</p>` : ''}
      ${k.warnzeichen ? `<p class="warnzeichen-zeile" role="note">${esc(k.warnzeichen)}</p>` : ''}
      ${anrufReihe(uebrige)}
      <p class="pflicht">${esc(k.pflicht)}</p>
      ${k.hinweise.map((h) => `<p class="klein">${esc(h)}</p>`).join('')}
      ${k.aktion === 'dosis' ? `<div class="knopf-reihe"><button type="button" class="knopf knopf-haupt" data-act="seite" data-seite="dosis" data-param="${esc(k.aktionParam || '')}">${esc(k.aktionText || 'Dosis eintragen')}</button></div>` : ''}
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
 *
 * Auch ohne Richtung, wenn ein Grund der Karte dringlicher ist als der Befund
 * selbst (Q5 „einmal viele Tabletten": heute, X3 „selbst geändert": in den
 * nächsten Tagen) – dort stehen die Nummern. Die Gründe aus dem Befinden und
 * dem Warnzeichen-Check (W…) stehen auf „Heute" schon selbst.
 *
 * `k`: die Karte, wenn sie schon gerechnet ist (gesamtbildMitDosis().dosis).
 */
export function dosisVerweis(stand, heute, k = undefined) {
  if (!ez.aktiv(stand)) return null;
  const karte = k === undefined ? dosisRichtung(stand, heute) : k;
  if (!karte) return null;
  const am = datumKurz(karte.befund.datum);
  const richtung = karte.richtung === 'mehr' || karte.richtung === 'weniger';
  const wichtig = karte.gruende.some((g) => g.stufe && !g.id.startsWith('W') && rang(g.stufe) > rang(karte.einschaetzung.stufeLabor));
  if (karte.frage) return { stufe: karte.stufe, text: `Zu Ihrem Befund vom ${am} hat die Dosis-Karte eine Frage an Sie.` };
  if (richtung) return { stufe: karte.stufe, text: `Zu Ihrem Befund vom ${am} gibt es eine Einschätzung zur Dosis. Bitte lesen Sie sie ganz – und rufen Sie vor jeder Änderung die Praxis an.` };
  if (wichtig) return { stufe: karte.stufe, text: `Zu Ihrem Befund vom ${am} hat die Dosis-Karte einen wichtigen Hinweis. Bitte lesen Sie ihn dort.` };
  return null;
}
