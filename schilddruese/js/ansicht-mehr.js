/*
 * Mehr – alles, was man nicht jeden Tag braucht: Bericht für den Arzttermin,
 * Fragen, Termine, Wissen, Erinnerung, Vorrat, Darstellung, Sicherung.
 *
 * Eine Liste großer Zeilen, jede mit einem Satz darunter, was sich dahinter
 * verbirgt. Keine versteckten Menüs, kein Wischen.
 */
import { datumInWorten, datumKurz, relativ, uhrText, tageZwischen } from './datum.js';
import { esc, mehrzahl } from './text.js';
import * as sp from './speicher.js';
import { berichtText } from './bericht.js';
import { KAPITEL, kapitel, kapitelHtml } from './wissen.js';
import { vorratAndereStaerke, vorratText } from './ansicht-formulare.js';

const zeile = (seite, titel, unter, param = null, ri = '') => `
  <button type="button" class="zeile" data-act="seite" data-seite="${seite}"${param ? ` data-param="${esc(param)}"` : ''}>
    ${ri ? `<span class="ri" aria-hidden="true" style="font-size:1.4rem">${ri}</span>` : ''}
    <span class="zeile-text"><span class="zeile-titel">${titel}</span>${unter ? `<span class="zeile-unter">${unter}</span>` : ''}</span>
    <span class="zeile-pfeil" aria-hidden="true">›</span>
  </button>`;

function sicherungUnter(stand, heute) {
  if (!stand.letzteSicherung) return 'Noch nie gesichert';
  const tage = tageZwischen(stand.letzteSicherung, heute);
  return `Zuletzt ${esc(relativ(stand.letzteSicherung, heute))}${tage > 60 ? ' – Zeit für eine neue' : ''}`;
}

/*
 * Die Zeile zum Vorrat sagt dasselbe wie „Heute" (D13): nach einer anderen
 * Stärke „bitte neu zählen" statt einer Reichweite aus der alten Packung,
 * bei 0 „aufgebraucht" statt „reicht noch etwa 0 Tage".
 */
function vorratUnter(stand, heute, reicht) {
  if (reicht === null) return 'Wird nicht gezählt';
  if (vorratAndereStaerke(stand, heute)) return 'Andere Stärke – bitte neu zählen';
  const t = vorratText(reicht);
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function mehrAnsicht(stand, heute) {
  const offen = stand.fragen.filter((f) => !f.erledigt).length;
  const termin = sp.naechsterTermin(heute);
  const reicht = sp.vorratReicht(heute);
  return `
    <h2 class="abschnitt">Einschätzung</h2>
    <div class="zeilen">
      ${zeile('gesamtbild', 'Einschätzung: Was sagen meine Werte?', 'Laborwerte, Beschwerden und Kontrollen eingeordnet', null, '🔎')}
      ${zeile('dosis-karte', 'Dosis-Karte: mehr oder weniger?', 'Was der letzte TSH-Wert für die Dosis bedeutet – vor jeder Änderung die Praxis anrufen', null, '⚖️')}
      ${zeile('warnzeichen', 'Warnzeichen prüfen', 'Geht es Ihnen gerade schlecht? In einer Minute wissen, was zu tun ist', null, '🚨')}
      ${zeile('abstand', 'Was braucht Abstand?', stand.mittel.length ? `Uhrzeiten für ${mehrzahl(stand.mittel.length, 'Mittel', 'Mittel')}` : 'Kaffee, Kalzium, Eisen – ab wann in Ordnung', null, '⏱️')}
      ${zeile('profil', 'Über mich & weitere Mittel', stand.profil.geburtsjahr || stand.mittel.length ? 'Angaben ändern' : 'Alter, Behandlung, Bundesland und weitere Mittel', null, '👤')}
    </div>

    <h2 class="abschnitt">Zum Arzttermin</h2>
    <div class="zeilen">
      ${zeile('bericht', 'Bericht für den Arzttermin', 'Dosis, Einnahmen, Laborwerte, Befinden – zum Zeigen oder Schicken', null, '📄')}
      ${zeile('fragen', 'Meine Fragen', offen ? mehrzahl(offen, 'offene Frage', 'offene Fragen') : 'Fragen notieren, damit beim Termin nichts vergessen wird', null, '❓')}
      ${zeile('termine', 'Termine', termin ? `Nächster: ${esc(relativ(termin.datum, heute))}${termin.uhr ? `, ${esc(uhrText(termin.uhr))}` : ''}` : 'Arzt- und Labortermine eintragen', null, '📅')}
    </div>

    <h2 class="abschnitt">Wissen</h2>
    <div class="zeilen">
      ${zeile('wissen', 'Wissen zur Schilddrüse', 'Einnahme, Abstände, Laborwerte, Warnzeichen', null, '📖')}
      ${zeile('wissen-kapitel', 'Wann anrufen, wann 112', 'Notruf, Bereitschaftsdienst, Praxis', 'notfall', '🚑')}
    </div>

    <h2 class="abschnitt">Einstellungen</h2>
    <div class="zeilen">
      ${zeile('erinnerung', 'Erinnerung', `Einnahme um ${esc(uhrText(stand.einstellungen.erinnerung))} · Kalenderdatei`, null, '⏰')}
      ${zeile('vorrat', 'Tablettenvorrat', vorratUnter(stand, heute, reicht), null, '💊')}
      ${zeile('darstellung', 'Schrift, Farben, Anrede', stand.einstellungen.schrift === 'sehr-gross' ? 'Schrift sehr groß' : stand.einstellungen.schrift === 'normal' ? 'Schrift normal' : 'Schrift groß', null, '🔤')}
      ${zeile('sicherung', 'Sicherung', sicherungUnter(stand, heute), null, '💾')}
      ${zeile('ueber', 'Über diese App', 'Was sie kann und was nicht · Alles löschen', null, 'ℹ️')}
    </div>`;
}

// ---------------------------------------------------------------- Seiten

function berichtSeite(stand, heute) {
  return {
    titel: 'Bericht',
    html: `
      <p class="gedaempft" style="margin-bottom:.8rem">Zum Zeigen im Sprechzimmer, zum Vorlesen oder zum Weiterschicken. Was die App selbst eingeordnet hat, steht darin gekennzeichnet in einem eigenen Abschnitt.</p>
      <div class="knopf-reihe" style="margin:0 0 .8rem">
        <button type="button" class="knopf knopf-haupt" data-act="bericht-teilen">Teilen</button>
        <button type="button" class="knopf" data-act="bericht-kopieren">Kopieren</button>
        <button type="button" class="knopf" data-act="bericht-drucken">Drucken</button>
      </div>
      <div class="karte"><div class="bericht" id="berichtText">${esc(berichtText(stand, heute))}</div></div>`,
  };
}

/*
 * Der Knopf zum Abhaken zeigte nur „○" – was er tut, stand allein in der
 * Beschreibung für Vorleseprogramme. Ein Tipp schob die Frage ohne ein Wort
 * unter „Besprochen" ans Ende, als sei sie verschwunden (Runde 4: E14). Jetzt
 * steht es auf dem Knopf, in der Reihe mit „Ändern" und „Löschen" – neben der
 * Frage wäre bei „sehr groß" auf 360 px kaum Platz für ihren Text geblieben.
 */
function fragenSeite(stand) {
  const offen = stand.fragen.filter((f) => !f.erledigt);
  const erledigt = stand.fragen.filter((f) => f.erledigt);
  const liste = (fragen) => fragen.map((f) => `
    <div class="karte">
      <p>${esc(f.text)}</p>
      <div class="knopf-reihe" style="margin-top:.4rem">
        <button type="button" class="knopf knopf-klein${f.erledigt ? '' : ' knopf-leise'}" data-act="frage-erledigt" data-id="${esc(f.id)}" aria-pressed="${f.erledigt}" aria-label="${f.erledigt ? 'Wieder offen' : 'Als besprochen abhaken'}"><span aria-hidden="true">${f.erledigt ? '✓' : '○'}</span> ${f.erledigt ? 'Besprochen' : 'Besprochen?'}</button>
        <button type="button" class="knopf knopf-klein knopf-leise" data-act="seite" data-seite="frage" data-param="${esc(f.id)}">Ändern</button>
        <button type="button" class="knopf knopf-klein knopf-gefahr" data-act="frage-loeschen" data-id="${esc(f.id)}">Löschen</button>
      </div>
    </div>`).join('');
  return {
    titel: 'Meine Fragen',
    html: `
      <button type="button" class="knopf knopf-haupt knopf-breit" data-act="seite" data-seite="frage" style="margin-bottom:1rem">Neue Frage</button>
      ${offen.length ? liste(offen) : '<p class="gedaempft">Keine offenen Fragen. Was Ihnen zwischendurch einfällt, hier notieren – die offenen Fragen stehen dann auch im Bericht.</p>'}
      ${erledigt.length ? `<h2 class="abschnitt">Besprochen</h2>${liste(erledigt)}` : ''}`,
  };
}

function termineSeite(stand, heute) {
  const kommend = stand.termine.filter((t) => t.datum >= heute);
  const vorbei = stand.termine.filter((t) => t.datum < heute).reverse().slice(0, 10);
  const ART = { arzt: 'Arzttermin', labor: 'Blutabnahme', sonst: 'Termin' };
  const karte = (t, mitKalender) => `
    <div class="karte">
      <p><strong>${ART[t.art]}</strong>${t.wo ? ` · ${esc(t.wo)}` : ''}</p>
      <p>${esc(datumInWorten(t.datum, { jahr: true }))}${t.uhr ? `, ${esc(uhrText(t.uhr))}` : ''} <span class="gedaempft">(${esc(relativ(t.datum, heute))})</span></p>
      ${t.blutabnahme || t.art === 'labor' ? '<p class="klein gedaempft">Blutabnahme: Tablette wie mit der Praxis besprochen – meist erst danach.</p>' : ''}
      ${t.notiz ? `<p class="klein">${esc(t.notiz)}</p>` : ''}
      <div class="knopf-reihe">
        <button type="button" class="knopf knopf-klein" data-act="seite" data-seite="termin" data-param="${esc(t.id)}">Ändern</button>
        ${mitKalender ? `<button type="button" class="knopf knopf-klein" data-act="ics-termin" data-id="${esc(t.id)}">In den Kalender</button>` : ''}
      </div>
    </div>`;
  return {
    titel: 'Termine',
    html: `
      <button type="button" class="knopf knopf-haupt knopf-breit" data-act="seite" data-seite="termin" style="margin-bottom:1rem">Neuer Termin</button>
      ${kommend.length ? kommend.map((t) => karte(t, true)).join('') : '<p class="gedaempft">Kein Termin eingetragen. Steht einer an, erscheint er zwei Wochen vorher auch unter „Heute".</p>'}
      ${vorbei.length ? `<h2 class="abschnitt">Vergangen</h2>${vorbei.map((t) => karte(t, false)).join('')}` : ''}`,
  };
}

function wissenSeite() {
  return {
    titel: 'Wissen',
    html: `
      <div class="zeilen">${KAPITEL.map((k) => zeile('wissen-kapitel', esc(k.titel), esc(k.kurz), k.id)).join('')}</div>
      <p class="klein gedaempft" style="margin-top:1rem">Diese Texte ersetzen keine ärztliche Beratung. Im Zweifel: Ihre Ärztin, Ihr Arzt oder die Apotheke.</p>`,
  };
}

function kapitelSeite(id, stand) {
  const k = kapitel(id);
  if (!k) return null;
  const i = KAPITEL.indexOf(k);
  const weiter = KAPITEL[i + 1];
  return {
    titel: k.titel,
    html: `
      <article class="karte wissen">${kapitelHtml(k, stand)}</article>
      <p class="klein gedaempft">Im Zweifel: Ihre Ärztin, Ihr Arzt oder die Apotheke. Diese App ersetzt keine ärztliche Beratung.</p>
      ${weiter ? `<div class="knopf-reihe"><button type="button" class="knopf knopf-breit" data-act="seite" data-seite="wissen-kapitel" data-param="${weiter.id}">Weiter: ${esc(weiter.titel)} ›</button></div>` : ''}`,
  };
}

function erinnerungSeite(stand) {
  const hatHinweise = typeof Notification !== 'undefined';
  const erlaubnis = hatHinweise ? Notification.permission : 'nicht-da';
  const hinweis = !hatHinweise
    ? '<p class="gedaempft">Dieser Browser kennt keine Systemhinweise.</p>'
    : erlaubnis === 'granted'
      ? `<p>Systemhinweise sind erlaubt${stand.einstellungen.hinweisTablette ? ' und eingeschaltet' : ', aber ausgeschaltet'}.</p>
         <div class="knopf-reihe">${stand.einstellungen.hinweisTablette
    ? '<button type="button" class="knopf" data-act="hinweis-aus">Hinweis ausschalten</button>'
    : '<button type="button" class="knopf" data-act="hinweis-erlauben">Hinweis einschalten</button>'}</div>`
      : erlaubnis === 'denied'
        ? '<p class="gedaempft">Systemhinweise sind in den Einstellungen des Browsers gesperrt.</p>'
        : '<div class="knopf-reihe"><button type="button" class="knopf" data-act="hinweis-erlauben">Hinweise erlauben</button></div>';
  return {
    titel: 'Erinnerung',
    html: `
      <form data-sofort="erinnerung" class="karte" novalidate>
        <label class="feld" style="margin:0"><span>Wann nehmen Sie die Tablette?</span>
          <input type="time" name="erinnerung" value="${esc(stand.einstellungen.erinnerung)}">
          <span class="hinweis">Ab dieser Uhrzeit zeigt „Heute" den Knopf gelb, solange nichts abgehakt ist. Wird sofort übernommen.</span>
        </label>
      </form>

      <div class="karte">
        <h2>Zuverlässig: der Kalender des Handys</h2>
        <p>Diese App kann sich nicht von selbst melden, wenn sie geschlossen ist. Der Kalender kann es. Mit diesem Knopf entsteht eine Kalenderdatei mit einem <strong>täglichen Termin um ${esc(uhrText(stand.einstellungen.erinnerung))}</strong> und Erinnerung.</p>
        <button type="button" class="knopf knopf-haupt knopf-breit" data-act="ics-erinnerung" style="margin-top:.8rem">Tägliche Erinnerung für den Kalender</button>
        <h3>So geht es weiter</h3>
        <ul style="padding-left:1.2rem;margin:.3rem 0">
          <li><strong>Android:</strong> die heruntergeladene Datei antippen, den Kalender wählen, „Speichern".</li>
          <li><strong>iPhone:</strong> „Zum Kalender hinzufügen" antippen.</li>
        </ul>
        <p class="klein gedaempft"><strong>Ändert sich die Uhrzeit:</strong> zuerst den alten Termin „Schilddrüsentablette nehmen" im Kalender löschen (alle Wiederholungen), dann die neue Datei öffnen. Viele Handy-Kalender ersetzen ihn nicht von selbst – dann gäbe es zwei tägliche Erinnerungen. Auch ein täglicher Wecker im Handy tut es.</p>
      </div>

      <div class="karte">
        <h2>Zusätzlich: Hinweis, solange die App offen ist</h2>
        <p class="gedaempft">Ist die App gerade auf dem Bildschirm offen, meldet sie sich nach der Einnahmezeit einmal am Tag, wenn noch nichts abgehakt ist. Im Hintergrund oder geschlossen kommt auf den meisten Handys nichts – darauf also nicht verlassen, dafür ist der Kalender da.</p>
        ${hinweis}
      </div>`,
  };
}

function darstellungSeite(stand) {
  const e = stand.einstellungen;
  const wahl = (act, wert, text, aktuell) => `<button type="button" class="knopf" data-act="${act}" data-wert="${wert}" aria-pressed="${aktuell === wert}">${text}</button>`;
  return {
    titel: 'Schrift, Farben, Anrede',
    html: `
      <div class="karte">
        <h2>Schriftgröße</h2>
        <div class="wahl" role="group" aria-label="Schriftgröße">
          ${wahl('schrift', 'normal', 'Normal', e.schrift)}
          ${wahl('schrift', 'gross', 'Groß', e.schrift)}
          ${wahl('schrift', 'sehr-gross', 'Sehr groß', e.schrift)}
        </div>
      </div>
      <div class="karte">
        <h2>Farben</h2>
        <div class="wahl" role="group" aria-label="Farben">
          ${wahl('farbe', 'hell', 'Hell', e.farbe)}
          ${wahl('farbe', 'dunkel', 'Dunkel', e.farbe)}
        </div>
      </div>
      <form data-formular="anrede" class="karte" novalidate>
        <label class="feld"><span>Anrede (freiwillig)</span>
          <input type="text" name="name" value="${esc(stand.profil.name)}" placeholder="z. B. Frau Müller oder Vorname" autocomplete="off">
          <span class="hinweis">Steht oben auf „Heute" und im Bericht.</span>
        </label>
        <button type="submit" class="knopf knopf-breit">Anrede speichern</button>
      </form>`,
  };
}

function sicherungSeite(stand, heute) {
  const vorImport = !!sp.rueckholbar(heute);
  return {
    titel: 'Sicherung',
    html: `
      <div class="karte">
        <p>Alle Daten liegen nur auf diesem Handy. Eine Sicherungsdatei rettet sie bei einem neuen Handy oder wenn der Browser aufräumt.</p>
        <p class="gedaempft">${stand.letzteSicherung ? `Letzte Sicherung: ${esc(datumInWorten(stand.letzteSicherung, { jahr: true }))}.` : 'Noch keine Sicherung gespeichert.'}</p>
        <button type="button" class="knopf knopf-haupt knopf-breit" data-act="sicherung-speichern" style="margin-top:.8rem">Sicherung speichern</button>
        <p class="klein gedaempft" style="margin-top:.5rem">Am besten an sich selbst oder an Tochter oder Sohn schicken – dann liegt sie nicht nur auf diesem Handy.</p>
      </div>
      <div class="karte">
        <h2>Sicherung einlesen</h2>
        <p class="gedaempft">Ersetzt alles, was jetzt in der App steht, durch den Stand aus der Datei.</p>
        <input type="file" id="sicherungDatei" accept=".json,application/json" hidden>
        <button type="button" class="knopf knopf-breit" data-act="sicherung-laden" style="margin-top:.6rem">Datei auswählen …</button>
        ${vorImport ? '<button type="button" class="knopf knopf-leise knopf-breit" data-act="sicherung-zurueck" style="margin-top:.6rem">Stand vor dem Einlesen zurückholen</button>' : ''}
      </div>
      <p class="klein gedaempft">${stand.dauerhaft ? 'Der Browser hat zugesagt, diese Daten nicht von selbst zu löschen.' : 'Tipp: Die App über das Browser-Menü „Zum Startbildschirm hinzufügen" – dann räumt der Browser die Daten seltener weg.'}</p>`,
  };
}

function ueberSeite(stand, heute) {
  return {
    titel: 'Über diese App',
    html: `
      <article class="karte wissen">${kapitel('app').html}</article>
      <div class="karte">
        <h2>Alles löschen</h2>
        <p class="gedaempft">Löscht Dosis, Einnahmen, Laborwerte und alle Einstellungen auf diesem Handy. Vorher besser eine Sicherung speichern.</p>
        <button type="button" class="knopf knopf-gefahr knopf-breit" data-act="alles-loeschen" style="margin-top:.8rem">Alles löschen</button>
      </div>
      <p class="klein gedaempft mitte">Schilddrüse · Datenstand ${esc(datumKurz(heute))} · Speicherfassung ${sp.VERSION}</p>`,
  };
}

/** { titel, html } oder null, wenn `name` keine Seite unter „Mehr" ist. */
export function mehrSeite(name, param, stand, heute) {
  switch (name) {
    case 'bericht': return berichtSeite(stand, heute);
    case 'fragen': return fragenSeite(stand);
    case 'termine': return termineSeite(stand, heute);
    case 'wissen': return wissenSeite();
    case 'wissen-kapitel': return kapitelSeite(param, stand);
    case 'erinnerung': return erinnerungSeite(stand);
    case 'darstellung': return darstellungSeite(stand);
    case 'sicherung': return sicherungSeite(stand, heute);
    case 'ueber': return ueberSeite(stand, heute);
    default: return null;
  }
}
