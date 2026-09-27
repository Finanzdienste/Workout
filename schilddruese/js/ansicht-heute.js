/*
 * Heute – der erste Bildschirm, und für die meisten Tage der einzige.
 *
 * Oben das Datum in Worten, darunter die Dosis, dann der eine große Knopf.
 * Was danach kommt, ist nur da, wenn es zutrifft: ein Termin in den nächsten
 * zwei Wochen, ein Vorrat, der zur Neige geht, ein Tag gestern ohne Eintrag.
 * Ganz unten die Frage nach dem Befinden – freiwillig, drei Knöpfe.
 *
 * Nichts hier scrollt bei 360 × 740, solange keine Hinweise anstehen.
 */
import { datumInWorten, tageWeiter, uhrText, relativ, tageZwischen } from './datum.js';
import { esc } from './text.js';
import {
  dosisText, aktuelleDosis, einnahme, naechsterTermin, vorratReicht,
} from './speicher.js';

const STUFEN = [['gut', 'Gut'], ['mittel', 'Mittel'], ['schlecht', 'Schlecht']];

function tabletteKnopf(stand, heute, jetztUhr) {
  const e = einnahme(heute);
  if (e) {
    return `
      <button type="button" class="tablette genommen" data-act="tablette-zurueck" aria-pressed="true">
        <span>✓ Tablette genommen</span>
        <small>${e.uhr ? `heute um ${esc(uhrText(e.uhr))}` : 'heute'} · antippen zum Zurücknehmen</small>
      </button>`;
  }
  if (e === null) {
    return `
      <button type="button" class="tablette faellig" data-act="tablette" aria-pressed="false">
        <span>Heute nicht genommen</span>
        <small>Doch genommen? Hier antippen.</small>
      </button>`;
  }
  const faellig = jetztUhr >= stand.einstellungen.erinnerung;
  return `
    <button type="button" class="tablette${faellig ? ' faellig' : ''}" data-act="tablette" aria-pressed="false">
      <span>Tablette genommen?</span>
      <small>${faellig ? 'Noch nicht eingetragen – antippen, sobald genommen.' : `Nüchtern, mit Wasser · geplant ${esc(uhrText(stand.einstellungen.erinnerung))}`}</small>
    </button>`;
}

function hinweise(stand, heute) {
  const teile = [];
  const gestern = tageWeiter(heute, -1);
  const dosis = aktuelleDosis();
  if (dosis && dosis.ab <= gestern && einnahme(gestern) === undefined) {
    teile.push(`
      <div class="karte" id="gestern">
        <h2>Gestern nicht eingetragen</h2>
        <p class="gedaempft">Haben Sie gestern die Tablette genommen?</p>
        <div class="knopf-reihe">
          <button type="button" class="knopf" data-act="gestern-genommen">Ja, genommen</button>
          <button type="button" class="knopf" data-act="gestern-nicht">Nein, vergessen</button>
        </div>
      </div>`);
  }

  const termin = naechsterTermin(heute);
  if (termin && tageZwischen(heute, termin.datum) <= 14) {
    const art = termin.art === 'labor' ? 'Blutabnahme' : termin.art === 'arzt' ? 'Arzttermin' : 'Termin';
    const wann = `${relativ(termin.datum, heute)}${termin.uhr ? `, ${uhrText(termin.uhr)}` : ''}`;
    const blut = termin.blutabnahme || termin.art === 'labor';
    teile.push(`
      <div class="hinweis-karte"><span class="ri" aria-hidden="true">📅</span>
        <div><strong>${esc(art)} ${esc(wann)}</strong>${termin.wo ? ` · ${esc(termin.wo)}` : ''}
        ${blut ? '<br><span class="klein">Blutabnahme: Die Tablette meist erst danach nehmen – so, wie es mit der Praxis besprochen ist.</span>' : ''}
        ${termin.notiz ? `<br><span class="klein">${esc(termin.notiz)}</span>` : ''}</div>
      </div>`);
  }

  // Nach einer Dosisänderung wird meist nach 6–8 Wochen kontrolliert. Nur eine
  // Erinnerung an diese Regel, keine Empfehlung: Sie erscheint erst ab der
  // vierten Woche, nur solange weder ein neuer Laborwert noch ein Termin
  // eingetragen ist, und sagt nichts über die Dosis selbst.
  if (stand.dosen.length >= 2 && !termin) {
    const letzte = stand.dosen[stand.dosen.length - 1];
    const seit = tageZwischen(letzte.ab, heute);
    const laborDanach = stand.labor.some((l) => l.datum >= letzte.ab);
    if (seit >= 28 && seit <= 70 && !laborDanach) {
      teile.push(`
        <div class="hinweis-karte"><span class="ri" aria-hidden="true">🩸</span>
          <div>Die Dosis wurde vor ${Math.floor(seit / 7)} Wochen geändert. Üblich ist eine Blutkontrolle etwa 6 bis 8 Wochen danach – falls noch kein Termin ausgemacht ist, bei der Praxis nachfragen.
          <br><button type="button" class="knopf knopf-klein" data-act="seite" data-seite="termin" style="margin-top:.4rem">Termin eintragen</button></div>
        </div>`);
    }
  }

  // Sicherung: erst, wenn es etwas zu verlieren gibt, und dann alle zwei Monate.
  const eintraege = Object.keys(stand.einnahmen).length + stand.labor.length;
  const letzteSicherung = stand.letzteSicherung;
  if (eintraege >= 30 && (!letzteSicherung || tageZwischen(letzteSicherung, heute) > 60)) {
    teile.push(`
      <div class="hinweis-karte"><span class="ri" aria-hidden="true">💾</span>
        <div>${letzteSicherung ? 'Die letzte Sicherung ist über zwei Monate her.' : 'Ihre Daten sind noch nicht gesichert.'} Bei einem neuen Handy wären sie sonst weg.
        <br><button type="button" class="knopf knopf-klein" data-act="seite" data-seite="sicherung" style="margin-top:.4rem">Jetzt sichern</button></div>
      </div>`);
  }

  const reicht = vorratReicht(heute);
  if (reicht !== null && reicht <= 14) {
    teile.push(`
      <div class="hinweis-karte warn"><span class="ri" aria-hidden="true">💊</span>
        <div><strong>${reicht <= 0 ? 'Der Vorrat ist aufgebraucht.' : `Vorrat reicht noch etwa ${reicht} ${reicht === 1 ? 'Tag' : 'Tage'}.`}</strong>
        <br><span class="klein">Rechtzeitig ein neues Rezept holen. <button type="button" class="knopf knopf-klein" data-act="seite" data-seite="vorrat">Vorrat ändern</button></span></div>
      </div>`);
  }

  return teile.join('');
}

function befinden(stand, heute) {
  const eintrag = stand.befinden.find((b) => b.datum === heute);
  const gewaehlt = eintrag ? eintrag.stufe : null;
  return `
    <div class="karte" id="befinden">
      <h2>Wie geht es Ihnen heute?</h2>
      <div class="wahl" role="group" aria-label="Befinden heute">
        ${STUFEN.map(([id, name]) => `<button type="button" class="knopf" data-act="befinden" data-stufe="${id}" aria-pressed="${gewaehlt === id}">${name}</button>`).join('')}
      </div>
      <p class="klein gedaempft" style="margin-top:.6rem">
        ${eintrag
    ? `Eingetragen${eintrag.beschwerden.length ? ` · ${eintrag.beschwerden.length} ${eintrag.beschwerden.length === 1 ? 'Beschwerde' : 'Beschwerden'}` : ''}. <button type="button" class="knopf knopf-klein knopf-leise" data-act="seite" data-seite="befinden" data-param="${esc(eintrag.id)}">Beschwerden angeben</button>`
    : 'Freiwillig. Beschwerden lassen sich danach genauer angeben.'}
      </p>
    </div>`;
}

/**
 * @param {object} stand    der ganze Zustand
 * @param {string} heute    ISO-Tag
 * @param {string} jetztUhr „HH:MM"
 */
export function heuteAnsicht(stand, heute, jetztUhr) {
  const dosis = dosisText();
  const anrede = stand.profil.name ? `Guten Tag, ${esc(stand.profil.name)}.` : '';
  return `
    <p class="heute-datum">${esc(datumInWorten(heute))}</p>
    <p class="heute-dosis">${anrede ? `${anrede} ` : ''}${dosis
    ? esc(dosis)
    : 'Noch keine Dosis eingetragen. <button type="button" class="knopf knopf-klein" data-act="seite" data-seite="dosis">Dosis eintragen</button>'}</p>
    ${tabletteKnopf(stand, heute, jetztUhr)}
    <div style="height:.8rem"></div>
    ${hinweise(stand, heute)}
    ${befinden(stand, heute)}`;
}
