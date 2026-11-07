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
import { datumKurz, zahlText, rohText } from './datum.js';
import { esc } from './text.js';
import * as ez from './einschaetzung.js';
import * as sp from './speicher.js';
import { dosisRichtung } from './dosis.js';
import {
  stufeSchild, STUFE_KLASSE, p6Karte, beschwerdeKnoepfe, anrufKnopf, anrufReihe, rang, BEFUND_FRAGEN, JNW_WAHL,
} from './ansicht-einschaetzung.js';

/*
 * „Noch nichts entschieden" nimmt eine frühere Angabe zurück. Vorher gab es
 * hier nur die drei Entscheidungen: Ein Fehltipp auf „Neue Dosis eintragen",
 * danach „Abbrechen" im Formular, ließ den Befund als von der Praxis erklärt
 * stehen – „Heute" schwieg zu TSH < 0,01, und zurück ging es nur über
 * Verlauf → Ändern → Ändern → die Praxis-Frage im Befund (Runde 4: E1).
 * js/app.js („praxis-entscheid") speichert 'nochnicht' wie die Frage F8.
 */
const PRAXIS_WAHL = [
  ['bleibt', 'Die Dosis bleibt so'],
  ['geaendert', 'Neue Dosis eintragen'],
  ['nachmessen', 'Erst nachmessen'],
  ['nochnicht', 'Noch nichts entschieden'],
];
export const PRAXIS_BESTAETIGUNG = 'Gut. Es gilt, was die Praxis gesagt hat. Die App zeigt zu diesem Befund keine Richtung mehr und erinnert Sie an die Kontrolle.';
/*
 * „Die Dosis wird geändert": Die Erinnerung an die Kontrolle hängt am neuen
 * Dosis-Eintrag (D6c) – bevor er da ist, darf die Meldung sie nicht versprechen.
 */
export const PRAXIS_NEUE_DOSIS = 'Gut. Bitte tragen Sie jetzt die neue Dosis ein, die die Praxis festgelegt hat – dann erinnert die App an die Kontrolle.';
/** Die Meldung nach „Noch nichts entschieden" (Runde 4: E1) – für js/app.js. */
export const PRAXIS_NOCH_NICHT = 'Vermerkt: Die Praxis hat noch nichts entschieden. Die Dosis-Karte ordnet den Befund wieder selbst ein.';

/*
 * Anruf-Knöpfe unter einem Grund. Jeder Grund bringt seine Nummern mit
 * (js/dosis.js: g.anrufe) – den Giftnotruf fürs eingetragene Bundesland, die
 * Telefonseelsorge, 116 117, 112. Vorher gab es Knöpfe nur bei W5 und bei der
 * Stufe 112: „Rufen Sie heute noch den Giftnotruf an" stand ohne Nummer da.
 */
function grundKnoepfe(g) {
  // Schickt der Grund zum Check („Bitte gehen Sie den Warnzeichen-Check
  // durch", W-D4 nach „Ja"), führt ein Knopf dorthin – wie auf „Heute" (C8).
  const check = /Warnzeichen-Check durch/.test(g.text)
    ? '<div class="knopf-reihe"><button type="button" class="knopf" data-act="seite" data-seite="warnzeichen">Warnzeichen prüfen</button></div>' : '';
  if (g.anrufe && g.anrufe.length) return anrufReihe(g.anrufe) + check;
  if (g.id === 'W5') return beschwerdeKnoepfe('W5');
  if (g.stufe === 'notruf') return `<div class="knopf-reihe">${anrufKnopf('112', '112 anrufen', { notruf: true, breit: true })}</div>`;
  return check;
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

/*
 * „Ihre Antworten zu diesem Befund" (Runde 4: E4). Die Karte stellt ihre
 * Fragen einzeln und zeigte danach nie, was geantwortet wurde. Ein Fehltipp
 * auf „Ja, einmal viele Tabletten auf einmal" ließ „Heute anrufen –
 * Giftnotruf" wochenlang stehen, auch im Arztbericht; ein „Nein, ich nehme
 * etwas anderes" sperrte die Karte, und der Weg zurück führte über einen
 * Dosis-Eintrag, den kein Text nannte. Jetzt steht jede Antwort da, mit
 * „ändern": Darunter erscheinen die übrigen Antworten als Knöpfe, und die
 * speichern wie die Frage selbst (data-act="frage-antwort", js/app.js
 * frageBeantworten – mit derselben Prüfung der Werte). Eine Antwort nur zu
 * löschen hülfe nicht: Neben einem anderen Grund fragt die Karte nicht neu,
 * und die Angabe bliebe offen.
 *
 * Eine eigene Karte direkt unter der Dosis-Karte, nicht in ihr: In der
 * Karte ist nichts aufklappbar (Grundsatz 8 – der Pflichttext steht immer
 * da), und Richtung und Pflichttext rücken nicht hinter eine lange Liste.
 * Aufgeklappt, wenn eine Antwort der Karte gerade eine Frist oder Sperre
 * auslöst (Q5 „einmal"/„über Tage", X3 „Nein" oder „selbst geändert"), sonst zu.
 */
const Q5_WAHL = [['nein', 'Nein'], ['einmal', 'Ja, einmal viele Tabletten auf einmal'], ['tage', 'Ja, über Tage zu viel oder eine andere Stärke'], ['unbekannt', 'Weiß nicht']];
const NACH14_WAHL = [['praxis', 'Ja, mit der Praxis gesprochen'], ['selbst', 'Ich habe selbst etwas geändert'], ['nein', 'Nein, noch nicht']];
const grossAnfang = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const letzteNachfrage = (stand, art, bezug) => [...stand.nachfragen].reverse().find((n) => n.art === art && n.bezug === bezug) || null;

/*
 * Runde 6: G6 – die Angaben über sie, nach denen die Karte selbst fragt:
 * Schilddrüsenkrebs (P2), dauerhaft Kortison oder Nebennierenschwäche (P9),
 * Hirnanhangdrüse oder TSH bewusst niedrig (Q4, nur wo die Karte danach
 * fragt: Muster d/e bei offener Ursache) und das Geburtsjahr (X6, Muster c).
 * Vorher fehlten sie in der Liste: Ein Fehltipp „Ja" auf die Krebsfrage
 * sperrte die Karte, hob „Heute" an und stand so im Arztbericht – und unter
 * „Stimmt eine Antwort nicht? Tippen Sie auf ändern" stand die falsche
 * Antwort nicht. Sie speichern wie die Frage selbst ins Profil
 * (js/app.js frageBeantworten, PROFIL_ANTWORTEN).
 */
const PROFIL_ZEILEN = [
  { feld: 'krebs', kurz: 'Wegen Schilddrüsenkrebs behandelt' },
  { feld: 'kortison', kurz: 'Dauerhaft Kortison oder Nebennierenschwäche' },
  { feld: 'hypophyseOderNiedrig', kurz: 'Ursache in der Hirnanhangdrüse oder TSH bewusst niedrig', nurWenn: (e, p) => ['d', 'e'].includes(e.gruppe) && ['andere', 'unbekannt', ''].includes(p.ursache) },
];

function antwortenBlock(b, stand, heute, e = null) {
  const zeilen = [];
  const profilZeilen = [];
  const zeile = ({ feld, ziel, kurz, wert, optionen, zusatz = '' }, liste = zeilen) => {
    const gewaehlt = optionen.find(([w]) => w === wert);
    const text = gewaehlt ? gewaehlt[1].replace(/^Ja: /, '') : wert;
    const andere = optionen.filter(([w]) => w !== wert);
    // Profil-Angaben mit eigenem Anker: „kortison" gibt es auch am Befund (F4).
    liste.push(`
      <li class="antwort-zeile" data-antwort="${esc(ziel === 'profil' ? `profil-${feld}` : feld)}">
        <p><span class="gedaempft">${esc(kurz)}:</span> <strong>${esc(text)}</strong></p>
        <details class="antwort-aendern">
          <summary class="knopf knopf-klein" aria-label="${esc(`Antwort ändern: ${kurz}`)}">ändern</summary>
          <div class="antworten">${andere.map(([w, t]) => `
            <button type="button" class="knopf antwort" data-act="frage-antwort" data-ziel="${esc(ziel)}" data-feld="${esc(feld)}" data-bezug="${esc(b.id)}" data-wert="${esc(w)}">${esc(t)}</button>`).join('')}</div>
        </details>
        ${zusatz}
      </li>`);
  };
  if (b.verwechselt) zeile({ feld: 'verwechselt', ziel: 'befund', kurz: 'Versehentlich mehr genommen', wert: b.verwechselt, optionen: Q5_WAHL });
  // X3: „Nein" trägt die Menge, auf die es sich bezog (nein_75) – für die
  // Gegenantwort die Menge von heute, wie die Frage auf der Karte.
  const stimmt = letzteNachfrage(stand, 'dosis_stimmt', b.id);
  const td = sp.tagesdosis(ez.dosisAmIn(stand, heute));
  const ug = td !== null ? `${zahlText(td, 1)} µg` : null;
  if (stimmt) {
    const nein = /^nein/.test(stimmt.antwort);
    zeile({
      feld: 'dosis_stimmt', ziel: 'nachfrage', kurz: 'Dosis wie in der App eingetragen', wert: nein ? stimmt.antwort : 'ja',
      optionen: [['ja', ug ? `Ja, genau ${ug} am Tag` : 'Ja'], [nein ? stimmt.antwort : td !== null ? `nein_${String(td).replace('.', '_')}` : 'nein', 'Nein, ich nehme etwas anderes']],
    });
  }
  const nach14 = letzteNachfrage(stand, 'nach14', b.id);
  if (nach14) zeile({ feld: 'nach14', ziel: 'nachfrage', kurz: 'Seitdem mit der Praxis gesprochen oder selbst geändert', wert: nach14.antwort, optionen: NACH14_WAHL });
  BEFUND_FRAGEN.forEach((f) => {
    if (!b[f.feld]) return;
    zeile({ feld: f.feld, ziel: 'befund', kurz: grossAnfang(f.kurz), wert: b[f.feld], optionen: f.optionen || JNW_WAHL });
  });
  // G6: die Angaben über sie. „Weiß nicht" sperrt wie „Ja" (Grundsatz 3) –
  // dann die Bitte, die Angabe zu ergänzen, sobald sie es weiß (bei D0.13
  // sagte die Karte das schon, bei D0.14 nicht).
  const p = stand.profil;
  const sperrt = [];
  PROFIL_ZEILEN.forEach((z) => {
    if (!p[z.feld] || (z.nurWenn && !(e && z.nurWenn(e, p)))) return;
    if (['ja', 'unbekannt'].includes(p[z.feld])) sperrt.push(z.feld);
    zeile({
      feld: z.feld, ziel: 'profil', kurz: z.kurz, wert: p[z.feld], optionen: JNW_WAHL,
      zusatz: p[z.feld] === 'unbekannt' ? '<p class="klein antwort-zusatz">Bitte ändern Sie die Angabe hier, sobald Sie es wissen – fragen Sie beim nächsten Anruf in der Praxis.</p>' : '',
    }, profilZeilen);
  });
  // Das Geburtsjahr ist eine Zahl: „ändern" öffnet das kleine Formular der Frage X6.
  if (e && e.gruppe === 'c' && p.geburtsjahr) {
    profilZeilen.push(`
      <li class="antwort-zeile" data-antwort="profil-geburtsjahr">
        <p><span class="gedaempft">Geburtsjahr:</span> <strong>${esc(String(p.geburtsjahr))}</strong></p>
        <details class="antwort-aendern">
          <summary class="knopf knopf-klein" aria-label="Antwort ändern: Geburtsjahr">ändern</summary>
          <form data-formular="geburtsjahr" class="jahr-form" novalidate>
            <label class="feld"><span>Geburtsjahr</span>
              <input type="text" inputmode="numeric" name="geburtsjahr" value="${esc(String(p.geburtsjahr))}" placeholder="z. B. 1952" autocomplete="off">
            </label>
            <button type="submit" class="knopf knopf-haupt knopf-breit">Speichern</button>
          </form>
        </details>
      </li>`);
  }
  const anzahl = zeilen.length + profilZeilen.length;
  if (!anzahl) return '';
  const offen = ['einmal', 'tage'].includes(b.verwechselt) || (stimmt && /^nein/.test(stimmt.antwort)) || (nach14 && nach14.antwort === 'selbst') || sperrt.length > 0;
  return `
    <details class="karte antworten-block"${offen ? ' open' : ''}>
      <summary>Ihre Antworten (${anzahl})</summary>
      <p class="klein gedaempft">Stimmt eine Antwort nicht? Tippen Sie auf „ändern" und wählen Sie die richtige.</p>
      ${zeilen.length ? `${profilZeilen.length ? '<p class="klein zwischen"><strong>Zu diesem Befund:</strong></p>' : ''}<ul class="antwort-liste">${zeilen.join('')}</ul>` : ''}
      ${profilZeilen.length ? `<p class="klein zwischen"><strong>Über Sie</strong> – gilt für alle Befunde und steht auch unter „Mehr → Über mich":</p><ul class="antwort-liste" data-antworten="profil">${profilZeilen.join('')}</ul>` : ''}
    </details>`;
}

/*
 * Die Knöpfe zu den Aktionen der Karte (js/dosis.js: k.aktionen). Neben der
 * Dosis (D0.5, D0.16 …) verlangt die Karte auch Nachträge im Befund („Bitte
 * tragen Sie beide Grenzen vom Befund ein", D0.1) und unter „Über mich"
 * (Geburtsjahr, Herz, D0.13 „Weiß nicht" zu Krebs) – bisher ohne Knopf
 * dorthin; der einzige war „Die Praxis hat entschieden" (Runde 4: E7).
 * 'labor' öffnet den Befund (param: seine Kennung), 'profil' die Seite
 * „Über mich & weitere Mittel". Der erste Knopf ist der Hauptknopf.
 */
const AKTION = {
  dosis: { seite: 'dosis', text: 'Dosis eintragen' },
  labor: { seite: 'labor', text: 'Befund ergänzen' },
  profil: { seite: 'profil', text: 'Über mich öffnen' },
};
function aktionKnoepfe(k) {
  const liste = (k.aktionen || (k.aktion ? [{ aktion: k.aktion, param: k.aktionParam, text: k.aktionText }] : []))
    .filter((a) => AKTION[a.aktion]);
  if (!liste.length) return '';
  return `<div class="knopf-reihe">${liste.map((a, i) => `<button type="button" class="knopf${i ? '' : ' knopf-haupt'}" data-act="seite" data-seite="${AKTION[a.aktion].seite}" data-param="${esc(a.param || '')}">${esc(a.text || AKTION[a.aktion].text)}</button>`).join('')}</div>`;
}

/*
 * Runde 5: F4 – Der Kopf der Karte ist ihre Überschrift (Ebene 2, unter dem
 * Seitentitel „Dosis-Karte"). Vorher hatte die Seite gar keine Überschrift;
 * die Überschriften-Navigation der Vorleseprogramme fand dort nichts. Die
 * Überschrift umfasst Stufe und Titel: Wer von Überschrift zu Überschrift
 * springt, hört zuerst, wie dringlich es ist – „In den nächsten Tagen
 * anrufen", dann „Das spricht für …" –, statt hinter der Stufe zu landen.
 * Kein <h2>: `.karte h2` machte den Titel größer als den Pflichttext
 * (Grundsatz 8). Aussehen und Größe bleiben, wie sie waren.
 */
function kartenKopf(stufe, kopfTitel, titel) {
  return `<div class="dosis-kopf" role="heading" aria-level="2">
        <p class="stufe-zeile">${stufeSchild(stufe, kopfTitel)}</p>
        <p class="dosis-titel">${esc(titel)}</p>
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
  const inGruenden = new Set(k.gruende.flatMap((g) => (g.anrufe || []).map((a) => a.nummer)));
  const uebrige = (k.anrufe || []).filter((a) => !inGruenden.has(a.nummer));
  const kopfTitel = k.kopf ? k.kopf.titel : ez.kopfFuer(k.stufe, k.gruende).titel;
  const gruendeListe = k.gruende.length ? `<ul class="gruende">${k.gruende.map((g) => `<li data-grund="${esc(g.id)}">${esc(g.text)}${grundKnoepfe(g)}</li>`).join('')}</ul>` : '';

  /*
   * Stufe 112 – ein Check von heute mit 112- oder Giftnotruf-Zeichen oder
   * „lebensmüde" (W-D1, X2): Die Karte zeigt nur den Notfall mit seinen
   * Nummern (RW1 W1: „alle anderen Auswertungen ausblenden"). Pflichttext,
   * „Die Praxis hat entschieden" und die Grundlage gehören zur Dosis, und um
   * die geht es erst danach. Vorher stand unter „Bitte rufen Sie jetzt den
   * Giftnotruf an" noch „Das ist eine Einschätzung aus Ihrem Laborwert …"
   * (C1, C6).
   * Außer neben W1 stehen darunter die übrigen dringlichen Gründe mit ihren
   * Nummern (D17: Q5 mit dem Giftnotruf, „selbst geändert" …) – und, falls
   * die Karte sie trägt, die 112-Zeichen (W-D2) wie auf jeder anderen Karte.
   */
  if (k.stufe === 'notruf') {
    teile.push(`
      <div class="karte dosis-karte ${STUFE_KLASSE.notruf} dosis-notruf" id="dosis-karte" tabindex="-1" data-richtung="${esc(k.richtung)}" data-stufe="notruf">
        ${kartenKopf('notruf', kopfTitel, k.titel)}
        ${k.texte.map((t) => `<p class="dosis-text">${esc(t)}</p>`).join('')}
        ${gruendeListe}
        ${k.warnzeichen ? `<p class="warnzeichen-zeile" role="note">${esc(k.warnzeichen)}</p>` : ''}
        ${anrufReihe(uebrige)}
      </div>`);
    return { titel, html: teile.join('') };
  }
  // Die Bestätigung verspricht die Erinnerung an die Kontrolle – nicht, solange
  // die neue Dosis noch einzutragen ist (aktionParam 'praxis'): Dann gibt es
  // die Erinnerung noch nicht (B27).
  if (entschieden && b.praxisAm === heute && k.aktionParam !== 'praxis') {
    teile.push(`<div class="hinweis-karte ok" role="status"><span class="ri" aria-hidden="true">✓</span><div>${esc(PRAXIS_BESTAETIGUNG)}</div></div>`);
  }
  // Nummern, die Kopf, Texte, Frage oder die 112-Zeichen nennen, aber kein
  // Grund – etwa 116 117 aus „Heute anrufen" oder 112 aus W-D2 –, als eigene
  // Knopfreihe unter der Warnzeile: Jede genannte Nummer ist anrufbar.
  teile.push(`
    <div class="karte dosis-karte ${STUFE_KLASSE[k.stufe]}" id="dosis-karte" tabindex="-1" data-richtung="${esc(k.richtung)}" data-stufe="${esc(k.stufe)}">
      ${kartenKopf(k.stufe, kopfTitel, k.titel)}
      ${k.frage ? frageBlock(k.frage, stand) : ''}
      ${k.texte.map((t) => `<p class="dosis-text">${esc(t)}</p>`).join('')}
      ${gruendeListe}
      ${k.schritt && !k.texte.some((t) => t.includes(k.schritt)) ? `<p class="dosis-text schritt">${esc(k.schritt)}</p>` : ''}
      ${k.warnzeichen ? `<p class="warnzeichen-zeile" role="note">${esc(k.warnzeichen)}</p>` : ''}
      ${anrufReihe(uebrige)}
      <p class="pflicht">${esc(k.pflicht)}</p>
      ${k.hinweise.map((h) => `<p class="klein">${esc(h)}</p>`).join('')}
      ${aktionKnoepfe(k)}
      <div class="knopf-reihe"><button type="button" class="knopf" data-act="seite" data-seite="praxis-entschieden" data-param="${esc(b.id)}">Die Praxis hat entschieden</button></div>
      <p class="klein gedaempft grundlage">${esc(k.grundlage)}</p>
    </div>`);
  teile.push(antwortenBlock(b, stand, heute, k.einschaetzung));
  teile.push(`<p class="klein gedaempft">${esc(ez.FUSSZEILE)}</p>`);
  return { titel, html: teile.join(''), merken: k.merken || null };
}

/** D6b: Was hat die Praxis entschieden? Große Knöpfe – und „Noch nichts entschieden". */
function praxisSeite(param, stand) {
  const b = stand.labor.find((l) => l.id === param);
  if (!b) return { titel: 'Die Praxis hat entschieden', html: '<div class="karte"><p>Diesen Befund gibt es nicht mehr.</p></div>' };
  // Der Wert, wie er auf dem Befund steht: „< 0,01" mit Zeichen und
  // ungerundet. Vorher stand hier „TSH 0,01 mIE/l" – ein Messwert statt
  // „kleiner als" (Runde 4: E9, E21).
  const tsh = b.tsh ? ` (TSH ${b.tsh.unter ? '< ' : ''}${rohText(b.tsh.wert)} ${b.tsh.einheit})` : '';
  return {
    titel: 'Die Praxis hat entschieden',
    html: `
      <p style="margin-bottom:.8rem">Was hat die Praxis zum Befund vom ${esc(datumKurz(b.datum))}${esc(tsh)} gesagt?</p>
      <div class="antworten gross-antworten">
        ${PRAXIS_WAHL.map(([w, t]) => `<button type="button" class="knopf antwort" data-act="praxis-entscheid" data-id="${esc(b.id)}" data-wert="${esc(w)}" aria-pressed="${b.praxis === w}">${esc(t)}</button>`).join('')}
      </div>
      <p class="klein gedaempft" style="margin-top:.8rem">Hat die Praxis entschieden, zeigt die App zu diesem Befund keine Richtung mehr. Bei „Neue Dosis eintragen" öffnet sich gleich das Formular für die neue Dosis. „Noch nichts entschieden" nimmt eine frühere Angabe zurück.</p>
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
 * `schonDa`: Kennungen der Dosis-Hinweise, die „Heute" selbst zeigt. Seit die
 * Karte X3 und B2 zur eigenen Änderung mit derselben Stufe trägt wie „Heute"
 * (C7), stand dort sonst unter „Das ist mehr als ein üblicher Schritt …" noch
 * einmal „… hat die Dosis-Karte einen wichtigen Hinweis" – derselbe Anlass
 * zweimal.
 *
 * X3 und B2 zur eigenen Änderung sind immer wichtig, auch ohne höhere Stufe
 * als der Befund (D11): „Heute" nennt sie selbst nur 14 Tage, die Karte, bis
 * die Praxis danach entschieden hat. Bei TSH 12 (Stufe Tage wie X3) stand
 * „nehmen Sie bis dahin wieder Ihre bisherige Menge" ab Tag 15 nur noch auf
 * der Karte – und nichts auf „Heute" führte dorthin. Ohne Stufe (die Praxis
 * hat danach entschieden, C4) nicht: Dann gilt, was sie gesagt hat.
 *
 * → { stufe, text, knopf? } – `knopf` ({ seite, param, text }) steht neben
 * „Dosis-Karte ansehen", wenn der Verweis selbst um einen Eintrag bittet.
 */
export function dosisVerweis(stand, heute, k = undefined, schonDa = new Set()) {
  if (!ez.aktiv(stand)) return null;
  const karte = k === undefined ? dosisRichtung(stand, heute) : k;
  if (!karte) return null;
  const am = datumKurz(karte.befund.datum);
  const richtung = karte.richtung === 'mehr' || karte.richtung === 'weniger';
  const eigene = ['X3', 'B2'];
  const wichtige = karte.gruende.filter((g) => g.stufe && !g.id.startsWith('W') && !schonDa.has(g.id)
    && (eigene.includes(g.id) || rang(g.stufe) > rang(karte.einschaetzung.stufeLabor)));
  /*
   * Eine 112-Karte (W5, ein Check mit 112-Zeichen) nennt ihre übrigen Gründe
   * mit eigener Frist (D17: Q5 „einmal viele Tabletten" – heute der
   * Giftnotruf). Der Verweis darauf trägt deren Stufe, nicht 112: Den Notfall
   * zeigt „Heute" schon selbst, mit seinen Nummern, ganz oben.
   */
  const stufe = karte.stufe === 'notruf'
    ? ez.hoechste(...wichtige.filter((g) => g.stufe !== 'notruf').map((g) => g.stufe)) : karte.stufe;
  // Die Frage nach dem Check trägt die dringlichen Gründe mit (D17) – dann
  // sagt der Verweis beides, sonst läse sich „eine Frage" wie eine Nebensache.
  if (karte.frage) {
    return { stufe, text: `Zu Ihrem Befund vom ${am} hat die Dosis-Karte eine Frage an Sie${wichtige.length ? ' und einen wichtigen Hinweis. Bitte lesen Sie beides dort.' : '.'}` };
  }
  /*
   * „Die Praxis hat entschieden: Die Dosis wird geändert", aber die neue Dosis
   * fehlt (aktionParam 'praxis'). Die Karte bittet dann darum, „Heute" sagte
   * nichts: ohne Richtung, ohne Frage und mit Stufe „keine" gab es keinen
   * Verweis. Ein Fehltipp auf „Neue Dosis eintragen", danach „Abbrechen",
   * ließ die App so monatelang zu TSH < 0,01 schweigen – und ohne den Eintrag
   * erinnert sie nie an die Kontrolle (D6c). Jetzt steht die Bitte auf
   * „Heute", mindestens „Beim nächsten Termin", mit dem Knopf zum Formular
   * (Runde 4: E1). Stimmt die Angabe nicht, nimmt „Die Praxis hat
   * entschieden → Noch nichts entschieden" sie zurück.
   */
  if ((karte.aktionen || [{ aktion: karte.aktion, param: karte.aktionParam }]).some((a) => a.aktion === 'dosis' && a.param === 'praxis')) {
    return {
      stufe: ez.hoechste('termin', stufe),
      text: `Zu Ihrem Befund vom ${am}: Die Praxis hat Ihre Dosis geändert. Bitte tragen Sie die neue Dosis ein – dann erinnert die App an die Kontrolle.${wichtige.length ? ' Die Dosis-Karte hat dazu einen wichtigen Hinweis.' : ''}`,
      knopf: { seite: 'dosis', param: 'praxis', text: 'Neue Dosis eintragen' },
    };
  }
  if (richtung) return { stufe, text: `Zu Ihrem Befund vom ${am} gibt es eine Einschätzung zur Dosis. Bitte lesen Sie sie ganz – und rufen Sie vor jeder Änderung die Praxis an.` };
  if (wichtige.length && rang(stufe) > rang('keine')) return { stufe, text: `Zu Ihrem Befund vom ${am} hat die Dosis-Karte einen wichtigen Hinweis. Bitte lesen Sie ihn dort.` };
  return null;
}
