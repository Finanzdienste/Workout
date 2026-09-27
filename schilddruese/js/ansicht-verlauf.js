/*
 * Verlauf – alles, was sich über die Zeit ansammelt: Laborwerte, Dosis,
 * Einnahmen, Gewicht, Befinden.
 *
 * Die Übersicht zeigt je Bereich das Neueste und einen Knopf zum Eintragen;
 * die vollständigen Listen liegen eine Seite tiefer. Laborwerte stehen neben
 * der Dosis, die damals galt – das ist die Zeile, die im Sprechzimmer sonst
 * mühsam aus der Akte zusammengesucht wird.
 *
 * Was hier nirgends steht: „zu hoch", „zu niedrig", eine Ampel. Der Bereich
 * des Labors wird gezeigt, wie er auf dem Befund steht; ob ein Wert für diese
 * Nutzerin richtig ist, entscheidet ihre Ärztin.
 */
import { datumKurz, datumInWorten, tageWeiter, zahlText, uhrText, relativ } from './datum.js';
import { esc, mehrzahl } from './text.js';
import * as sp from './speicher.js';
import { verlaufslinie } from './diagramm.js';

const WT_KOPF = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function bereichText(w) {
  return w && w.von !== null ? `Bereich ${zahlText(w.von)}–${zahlText(w.bis)}` : '';
}

/**
 * Die Laborwerte, neueste zuerst: je Befund eine Karte mit Datum, der damals
 * gültigen Dosis und je Wert einer Zeile samt Bereich des Labors.
 * `alle`: die vollständige Liste mit Knopf zum Ändern, sonst die letzten drei.
 */
function laborKarten(labor, alle = false) {
  const befunde = [...labor].reverse().slice(0, alle ? undefined : 3);
  return befunde.map((l) => {
    const dosis = sp.dosisAm(l.datum);
    const werte = sp.LABORWERTE.filter(([k]) => l[k]).map(([k, name]) => `
      <div class="befund-wert"><b>${name}</b>
        <span class="zahl">${esc(zahlText(l[k].wert))} ${esc(l[k].einheit)}</span>
      </div>
      ${l[k].von !== null ? `<div class="bereich" style="text-align:right">${esc(bereichText(l[k]))}</div>` : ''}`).join('');
    return `
      <div class="befund">
        <div class="befund-kopf">
          <span class="befund-datum">${esc(datumKurz(l.datum))}</span>
          <span class="gedaempft klein">${sp.tagesdosis(dosis) !== null ? `Dosis damals ${esc(zahlText(sp.tagesdosis(dosis), 1))} µg am Tag` : ''}</span>
        </div>
        ${werte}
        ${alle && l.notiz ? `<p class="klein gedaempft">${esc(l.notiz)}</p>` : ''}
        ${alle ? `<button type="button" class="knopf knopf-klein" data-act="seite" data-seite="labor" data-param="${esc(l.id)}" aria-label="Laborwerte vom ${esc(datumKurz(l.datum))} ändern" style="margin-top:.4rem">Ändern</button>` : ''}
      </div>`;
  }).join('');
}

/*
 * Nur Werte in derselben Einheit wie der neueste: fT4 in ng/dl und in pmol/l
 * auf einer Achse sähe aus wie ein zwölffacher Sprung, und der ältere Punkt
 * läge weit unter dem Streifen – das würde als „zu niedrig" gelesen.
 * Einheiten werden dabei ohne Groß-/Kleinschreibung verglichen (ng/dl, ng/dL).
 */
function laborDiagramm(labor, key, name) {
  const mitWert = labor.filter((l) => l[key]);
  if (mitWert.length < 2) return '';
  const letzter = mitWert[mitWert.length - 1];
  const einheit = (letzter[key].einheit || '').toLowerCase();
  const gleich = mitWert.filter((l) => (l[key].einheit || '').toLowerCase() === einheit);
  if (gleich.length < 2) return '';
  const punkte = gleich.map((l) => ({ datum: l.datum, wert: l[key].wert }));
  const bereich = letzter[key].von !== null ? [letzter[key].von, letzter[key].bis] : null;
  const fehlen = mitWert.length - gleich.length;
  return `<h3>${name} im Verlauf</h3>${verlaufslinie({ punkte, einheit: letzter[key].einheit, bereich, titel: name })}
    <p class="klein gedaempft">${bereich ? 'Der helle Streifen ist der Bereich des Labors laut letztem Befund.' : 'Ohne Bereich des Labors – beim nächsten Eintrag mit abschreiben.'}${fehlen ? ` ${fehlen === 1 ? 'Ein Wert steht' : `${fehlen} Werte stehen`} in einer anderen Einheit und ${fehlen === 1 ? 'ist' : 'sind'} deshalb nicht eingezeichnet.` : ''}</p>`;
}

/** Die letzten 28 Tage als Reihe: genommen, nicht genommen, unbekannt. */
/*
 * Die letzten Wochen als Kalender: sieben Spalten, Montag zuerst, je Tag das
 * Datum und ein Zeichen – ✓ genommen, ✗ nicht genommen, ? kein Eintrag. Das
 * Zeichen trägt die Bedeutung, die Farbe nur zusätzlich; Rot und Grün allein
 * unterscheidet nicht jeder. Vorher waren es vierzehn Spalten mit dem
 * Anfangsbuchstaben des Wochentags (zweimal „D", zweimal „S"), 18 Pixel breit
 * – zu klein, um mit dem Finger sicher den richtigen Tag zu treffen.
 */
const ZEICHEN = { ja: '✓', nein: '✗', offen: '?', leer: '' };

function einnahmenReihe(stand, heute, tage = 28) {
  const erste = sp.zaehltAb();
  const beginn = tageWeiter(heute, 1 - tage);
  const montag = tageWeiter(beginn, -((new Date(`${beginn}T12:00:00`).getDay() + 6) % 7));
  const zellen = WT_KOPF.map((w) => `<span class="tag-kopf" aria-hidden="true">${w}</span>`);
  for (let tag = montag; tag <= heute; tag = tageWeiter(tag, 1)) {
    if (tag < beginn) { zellen.push('<span class="tag-platz"></span>'); continue; }
    const e = stand.einnahmen[tag];
    const vorher = erste && tag < erste;
    const klasse = vorher ? 'leer' : e ? 'ja' : e === null ? 'nein' : 'offen';
    const text = vorher ? 'noch nicht erfasst' : e ? 'genommen' : e === null ? 'nicht genommen' : 'kein Eintrag';
    zellen.push(`<button type="button" class="tag ${klasse}" data-act="seite" data-seite="einnahme" data-param="${tag}" aria-label="${esc(datumInWorten(tag))}: ${text}"><span class="tag-zahl">${Number(tag.slice(8))}</span><span class="tag-zeichen" aria-hidden="true">${ZEICHEN[klasse]}</span></button>`);
  }
  return `<div class="tage" role="group" aria-label="Einnahmen der letzten ${tage} Tage">${zellen.join('')}</div>
    <p class="klein gedaempft">✓ genommen · ✗ nicht genommen · ? kein Eintrag. Einen Tag antippen, um ihn nachzutragen.</p>`;
}

export function verlaufAnsicht(stand, heute) {
  const dosis = sp.aktuelleDosis(heute);
  const naechste = sp.naechsteDosis(heute);
  const labor = stand.labor;
  const gewicht = stand.gewicht;
  const bilanz = sp.einnahmeBilanz(28, heute);
  const letztesBefinden = stand.befinden.length ? stand.befinden[stand.befinden.length - 1] : null;
  const STUFE = { gut: 'gut', mittel: 'mittel', schlecht: 'schlecht' };

  return `
    <h2 class="abschnitt">Laborwerte</h2>
    <div class="karte">
      ${labor.length ? laborKarten(labor) : '<p class="gedaempft">Noch keine Laborwerte. Beim nächsten Befund: TSH, fT4 und fT3 mit dem Bereich des Labors abschreiben.</p>'}
      ${laborDiagramm(labor, 'tsh', 'TSH')}
      <div class="knopf-reihe">
        <button type="button" class="knopf knopf-haupt" data-act="seite" data-seite="labor">Laborwerte eintragen</button>
        ${labor.length ? `<button type="button" class="knopf" data-act="seite" data-seite="labor-liste">${labor.length > 3 ? 'Alle anzeigen' : 'Ändern'}</button>` : ''}
      </div>
    </div>

    <h2 class="abschnitt">Dosis</h2>
    <div class="karte">
      ${dosis
    ? `<p class="gross">${esc(sp.dosisText(dosis))}</p><p class="gedaempft">${dosis.ab > heute ? 'ab' : 'seit'} ${esc(datumInWorten(dosis.ab, { wochentag: false, jahr: true }))}${dosis.notiz ? ` · ${esc(dosis.notiz)}` : ''}</p>`
    : '<p class="gedaempft">Noch keine Dosis eingetragen.</p>'}
      ${naechste ? `<p style="margin-top:.5rem"><strong>Ab ${esc(datumInWorten(naechste.ab))}:</strong> ${esc(sp.dosisText(naechste))}</p>` : ''}
      <div class="knopf-reihe">
        <button type="button" class="knopf knopf-haupt" data-act="seite" data-seite="dosis">${dosis ? 'Neue Dosis eintragen' : 'Dosis eintragen'}</button>
        ${stand.dosen.length ? '<button type="button" class="knopf" data-act="seite" data-seite="dosis-liste">Verlauf</button>' : ''}
      </div>
    </div>

    <h2 class="abschnitt">Einnahmen</h2>
    <div class="karte">
      ${bilanz.tage
    ? `<p><strong>An ${bilanz.genommen} von ${mehrzahl(bilanz.tage, 'Tag', 'Tagen')}</strong> genommen${bilanz.ausgelassen ? `, an ${mehrzahl(bilanz.ausgelassen, 'Tag', 'Tagen')} nicht` : ''}${bilanz.unbekannt ? `, ${mehrzahl(bilanz.unbekannt, 'Tag', 'Tage')} ohne Eintrag` : ''} – in den letzten vier Wochen.</p>`
    : '<p class="gedaempft">Sobald eine Dosis eingetragen ist, zählen die Tage hier mit.</p>'}
      ${einnahmenReihe(stand, heute)}
      <div class="knopf-reihe">
        <button type="button" class="knopf" data-act="seite" data-seite="einnahme">Tag nachtragen</button>
      </div>
    </div>

    <h2 class="abschnitt">Gewicht</h2>
    <div class="karte">
      ${gewicht.length
    ? `<p class="gross">${esc(zahlText(gewicht[gewicht.length - 1].kg, 1))} kg</p><p class="gedaempft">${esc(relativ(gewicht[gewicht.length - 1].datum, heute))}</p>${gewicht.length > 1 ? verlaufslinie({ punkte: gewicht.slice(-12).map((g) => ({ datum: g.datum, wert: g.kg })), einheit: 'kg', titel: 'Gewicht' }) : ''}`
    : '<p class="gedaempft">Noch kein Gewicht eingetragen. Einmal die Woche reicht.</p>'}
      <div class="knopf-reihe">
        <button type="button" class="knopf knopf-haupt" data-act="seite" data-seite="gewicht">Gewicht eintragen</button>
        ${gewicht.length ? '<button type="button" class="knopf" data-act="seite" data-seite="gewicht-liste">Alle anzeigen</button>' : ''}
      </div>
    </div>

    <h2 class="abschnitt">Befinden</h2>
    <div class="karte">
      ${letztesBefinden
    ? `<p><strong>${esc(relativ(letztesBefinden.datum, heute))}: ${STUFE[letztesBefinden.stufe]}</strong>${letztesBefinden.beschwerden.length ? ` · ${esc(letztesBefinden.beschwerden.map((k) => (sp.BESCHWERDEN.find(([id]) => id === k) || [])[1]).filter(Boolean).join(', '))}` : ''}</p>`
    : '<p class="gedaempft">Noch kein Eintrag. Die Frage dazu steht unter „Heute".</p>'}
      <div class="knopf-reihe">
        <button type="button" class="knopf" data-act="seite" data-seite="befinden">Heute eintragen</button>
        ${stand.befinden.length ? '<button type="button" class="knopf" data-act="seite" data-seite="befinden-liste">Alle anzeigen</button>' : ''}
      </div>
    </div>`;
}

const STUFEN_TEXT = { gut: 'Gut', mittel: 'Mittel', schlecht: 'Schlecht' };

/** Die Listen unter dem Verlauf. { titel, html } oder null. */
export function verlaufSeite(name, param, stand, heute) {
  switch (name) {
    case 'labor-liste':
      return {
        titel: 'Alle Laborwerte',
        html: `<div class="karte">${stand.labor.length ? laborKarten(stand.labor, true) : '<p class="gedaempft">Noch keine Laborwerte.</p>'}
          ${laborDiagramm(stand.labor, 'tsh', 'TSH')}${laborDiagramm(stand.labor, 'ft4', 'fT4')}${laborDiagramm(stand.labor, 'ft3', 'fT3')}
          <div class="knopf-reihe"><button type="button" class="knopf knopf-haupt" data-act="seite" data-seite="labor">Laborwerte eintragen</button></div>
          </div>`,
      };
    case 'dosis-liste':
      return {
        titel: 'Dosis im Verlauf',
        html: `<div class="zeilen">${[...stand.dosen].reverse().map((d) => `
          <button type="button" class="zeile" data-act="seite" data-seite="dosis" data-param="${esc(d.id)}">
            <span class="zeile-text"><span class="zeile-titel">${esc(sp.dosisText(d))}${d === sp.aktuelleDosis(heute) ? ' · aktuell' : d.ab > heute ? ' · geplant' : ''}</span>
            <span class="zeile-unter">ab ${esc(datumKurz(d.ab))}${d.notiz ? ` · ${esc(d.notiz)}` : ''}</span></span><span class="zeile-pfeil" aria-hidden="true">›</span>
          </button>`).join('')}</div>
          <div class="knopf-reihe"><button type="button" class="knopf knopf-haupt" data-act="seite" data-seite="dosis">Neue Dosis eintragen</button></div>`,
      };
    case 'gewicht-liste':
      return {
        titel: 'Gewicht',
        html: `<div class="zeilen">${[...stand.gewicht].reverse().map((g) => `
          <button type="button" class="zeile" data-act="seite" data-seite="gewicht" data-param="${esc(g.id)}">
            <span class="zeile-text"><span class="zeile-titel">${esc(zahlText(g.kg, 1))} kg</span><span class="zeile-unter">${esc(datumInWorten(g.datum, { jahr: true }))}</span></span><span class="zeile-pfeil" aria-hidden="true">›</span>
          </button>`).join('')}</div>
          <div class="knopf-reihe"><button type="button" class="knopf knopf-haupt" data-act="seite" data-seite="gewicht">Gewicht eintragen</button></div>`,
      };
    case 'befinden-liste':
      return {
        titel: 'Befinden',
        html: `<div class="zeilen">${[...stand.befinden].reverse().map((b) => `
          <button type="button" class="zeile" data-act="seite" data-seite="befinden" data-param="${esc(b.id)}">
            <span class="zeile-text"><span class="zeile-titel">${esc(datumInWorten(b.datum))}: ${STUFEN_TEXT[b.stufe]}</span>
            <span class="zeile-unter">${esc([b.beschwerden.map((k) => (sp.BESCHWERDEN.find(([id]) => id === k) || [])[1]).filter(Boolean).join(', '), b.notiz].filter(Boolean).join(' · ') || 'keine Beschwerden angegeben')}</span></span><span class="zeile-pfeil" aria-hidden="true">›</span>
          </button>`).join('')}</div>`,
      };
    case 'einnahmen-liste': {
      const bilanz = sp.einnahmeBilanz(28, heute);
      return {
        titel: 'Einnahmen',
        html: `<div class="karte">
          ${bilanz.tage ? `<p><strong>An ${bilanz.genommen} von ${mehrzahl(bilanz.tage, 'Tag', 'Tagen')}</strong> genommen in den letzten vier Wochen.</p>` : ''}
          ${einnahmenReihe(stand, heute, 56)}
          <div class="knopf-reihe"><button type="button" class="knopf knopf-haupt" data-act="seite" data-seite="einnahme">Tag nachtragen</button></div>
          </div>
          <div class="zeilen">${Object.keys(stand.einnahmen).sort().reverse().slice(0, 60).map((tag) => {
    const e = stand.einnahmen[tag];
    return `<button type="button" class="zeile" data-act="seite" data-seite="einnahme" data-param="${tag}">
              <span class="zeile-text"><span class="zeile-titel">${esc(datumInWorten(tag))}</span><span class="zeile-unter">${e ? `genommen${e.uhr ? ` um ${esc(uhrText(e.uhr))}` : ''}` : 'nicht genommen'}</span></span><span class="zeile-pfeil" aria-hidden="true">›</span>
            </button>`;
  }).join('')}</div>`,
      };
    }
    default:
      return null;
  }
}
