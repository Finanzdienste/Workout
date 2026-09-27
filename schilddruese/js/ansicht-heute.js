/*
 * Heute – der erste Bildschirm, und für die meisten Tage der einzige.
 *
 * Ganz oben die Notfallleiste (W0), dann das Datum in Worten, die Dosis und
 * der eine große Knopf. Was danach kommt, ist nur da, wenn es zutrifft – und
 * nach Dringlichkeit geordnet: seelische Not (W5) immer zuerst, dann was heute
 * einen Anruf braucht, dann was in den nächsten Tagen, in ein bis zwei Wochen
 * oder beim nächsten Termin dran ist. Ganz unten die Frage nach dem Befinden –
 * freiwillig, drei Knöpfe.
 *
 * Die Einschätzung selbst steht nicht hier, nur ein Verweis mit ihrer Stufe
 * in Worten. Auch die Dosis-Karte wird nur verlinkt: Ihre Richtung darf nie
 * ohne den Pflichttext darunter stehen.
 */
import { datumInWorten, datumKurz, tageWeiter, uhrText, relativ, tageZwischen } from './datum.js';
import { esc } from './text.js';
import * as ez from './einschaetzung.js';
import { gesamtbildMitDosis } from './dosis.js';
import {
  dosisText, aktuelleDosis, naechsteDosis, einnahme, naechsterTermin, vorratReicht, zaehltAb,
} from './speicher.js';
import {
  notfallLeiste, p6Karte, beschwerdeKarte, w5Karte, stufeSchild, stufeZeile, hinweisKlasse, STUFE_KLASSE, rang, anrufReihe, anrufeImText,
} from './ansicht-einschaetzung.js';
import { dosisVerweis } from './ansicht-dosis.js';

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

const kleinerKnopf = (seite, text, param = null) => `<br><button type="button" class="knopf knopf-klein" data-act="seite" data-seite="${seite}"${param ? ` data-param="${esc(param)}"` : ''} style="margin-top:.4rem">${text}</button>`;

/** Ein Hinweis aus dem Rechenkern als Karte – mit Stufe in Worten. */
function kernHinweis(h, stand) {
  const frage = h.frage ? `
    <div class="antworten zwei">
      ${h.frage.optionen.map(([w, t]) => `<button type="button" class="knopf antwort" data-act="frage-antwort" data-ziel="${esc(h.frage.ziel)}" data-feld="${esc(h.frage.feld)}" data-bezug="${esc(h.frage.bezug)}" data-wert="${esc(w)}">${esc(t)}</button>`).join('')}
    </div>` : '';
  const warn = h.warnzeichen && !h.text.includes(h.warnzeichen) ? `<p class="warnzeichen-zeile">${esc(h.warnzeichen)}</p>` : '';
  // Nach „Ja" auf die Frage nach einer Erhöhung: erst der Warnzeichen-Check.
  const check = h.id === 'W-D4' && !h.frage && h.stufe === 'heute'
    ? '<div class="knopf-reihe"><button type="button" class="knopf" data-act="seite" data-seite="warnzeichen">Warnzeichen prüfen</button></div>' : '';
  // Nennt der Hinweis eine Nummer (X3 mit „Sofort 112 …"), ist sie anrufbar.
  // Die Kontroll-Hinweise des Kerns bringen keine Liste mit – etwa der zu zwei
  // Einträgen eines Tages (L0b-doppelt), der mit der Stufe „heute" 116 117
  // nennt (C12): dann die Nummern aus dem Text, wie im Gesamtbild.
  const anrufe = h.anrufe || anrufeImText(h.text, stand);
  return `
    <div class="karte kern-hinweis ${hinweisKlasse(h.stufe)}" data-regel="${esc(h.id)}">
      ${stufeZeile(h.stufe)}
      <p>${esc(h.text)}</p>
      ${warn}${frage}${check}${anrufReihe(anrufe)}
    </div>`;
}

/**
 * Alle Hinweise als Liste { stufe, html, oben }. Die bisherigen (Tablette,
 * gestern, Termin, Vorrat, Sicherung) bekommen eine Stufe, damit sie sich
 * einreihen: „gestern keine Tablette – nicht doppelt" gehört vor eine
 * Erinnerung an die Kontrolle, eine aufgebrauchte Packung auch.
 */
function hinweise(stand, heute) {
  const liste = [];
  const add = (stufe, html, oben = false) => liste.push({ stufe, html, oben });
  const aktiv = ez.aktiv(stand);
  // Eine Rechnung für alles, was die Einschätzung betrifft: das Gesamtbild
  // mit Dosis-Karte und Dosis-Hinweisen (js/dosis.js). So nennt „Heute" dieselbe
  // Stufe wie die Seite „Einschätzung" und die Dosis-Karte (B40, B61).
  const gm = aktiv ? gesamtbildMitDosis(stand, heute) : null;

  // Seelische Not, Herz und ungewollter Gewichtsverlust aus dem Befinden –
  // das sind Warnzeichen (W5, S4, R3, W2t), keine Einschätzung, und stehen
  // deshalb auch ohne P6-Haken da.
  ez.beschwerdenAuswerten(stand, heute).texte
    .filter((t) => ['W5', 'W5b', 'S4', 'S4ii', 'R3', 'W2t'].includes(t.id))
    .forEach((t) => add(t.stufe, t.id === 'W5' ? w5Karte(t.text) : beschwerdeKarte(t), t.id === 'W5'));

  // Stärke fehlt (beim Einrichten leer gelassen): daran erinnern, bis sie da ist.
  const geltend = aktuelleDosis(heute);
  if (geltend && geltend.mikrogramm === null) {
    add('termin', `
      <div class="hinweis-karte warn"><span class="ri" aria-hidden="true">💊</span>
        <div><strong>Die Stärke der Tablette fehlt noch.</strong> Sie steht auf der Packung, z. B. „75 µg".
        ${kleinerKnopf('dosis', 'Stärke eintragen', geltend.id)}</div>
      </div>`);
  }

  // Gestern bewusst nicht genommen, heute noch nichts abgehakt: Der eine Satz,
  // der vor einer doppelten Tablette schützt, steht hier dauerhaft – nicht nur
  // ein paar Sekunden als Meldung.
  if (einnahme(tageWeiter(heute, -1)) === null && einnahme(heute) === undefined) {
    add('tage', `
      <div class="hinweis-karte"><span class="ri" aria-hidden="true">ℹ️</span>
        <div>Gestern keine Tablette. <strong>Heute wie gewohnt eine – nicht doppelt.</strong></div>
      </div>`);
  }

  // Nur fragen, wenn gestern schon zählte – am Tag nach dem Einrichten gibt
  // es kein „gestern", das man hätte abhaken können.
  const gestern = tageWeiter(heute, -1);
  const ab = zaehltAb();
  if (ab && ab <= gestern && einnahme(gestern) === undefined) {
    add('termin', `
      <div class="karte" id="gestern">
        <h2>Gestern nicht eingetragen</h2>
        <p class="gedaempft">Haben Sie gestern die Tablette genommen?</p>
        <div class="knopf-reihe">
          <button type="button" class="knopf" data-act="gestern-genommen">Ja, genommen</button>
          <button type="button" class="knopf" data-act="gestern-nicht">Nein, vergessen</button>
        </div>
      </div>`);
  }

  // Die alte Frage nach Östrogen: Tablette oder Pflaster? Das macht beim
  // Bedarf einen Unterschied, und die App weiß es nicht.
  if (stand.profil.oestrogenPruefen) {
    add('termin', `
      <div class="hinweis-karte warn"><span class="ri" aria-hidden="true">💊</span>
        <div><strong>Bitte prüfen:</strong> Nehmen Sie Östrogen als Tablette oder als Pflaster/Gel?
        ${kleinerKnopf('profil', 'Im Profil angeben')}</div>
      </div>`);
  }

  const termin = naechsterTermin(heute);
  if (termin && tageZwischen(heute, termin.datum) <= 14) {
    const art = termin.art === 'labor' ? 'Blutabnahme' : termin.art === 'arzt' ? 'Arzttermin' : 'Termin';
    const wann = `${relativ(termin.datum, heute)}${termin.uhr ? `, ${uhrText(termin.uhr)}` : ''}`;
    const blut = termin.blutabnahme || termin.art === 'labor';
    add(tageZwischen(heute, termin.datum) <= 1 ? 'tage' : 'termin', `
      <div class="hinweis-karte"><span class="ri" aria-hidden="true">📅</span>
        <div><strong>${esc(art)} ${esc(wann)}</strong>${termin.wo ? ` · ${esc(termin.wo)}` : ''}
        ${blut ? '<br><span class="klein">Blutabnahme: Die Tablette meist erst danach nehmen – so, wie es mit der Praxis besprochen ist.</span>' : ''}
        ${termin.notiz ? `<br><span class="klein">${esc(termin.notiz)}</span>` : ''}</div>
      </div>`);
  }

  // Was die Rechenkerne für heute sagen: Kontrollen, Nachfragen nach einer
  // Dosisänderung, Wechselwirkungen. Nur bei bestätigter Behandlung (P6).
  // Die Kontrollen aus dem Gesamtbild: Dort fällt L7d weg, wenn die
  // Dosis-Karte an dieselbe Kontrolle erinnert (D6c) – sonst stand sie doppelt da.
  // Eine eigene Erinnerung „vor N Wochen geändert" gibt es hier nicht mehr:
  // Sie kam auch ohne P6 und ohne den Text vor der Blutabnahme (B47) – die
  // Kontrolle nach einer Dosisänderung meldet allein D6c.
  const kern = gm ? [...gm.teile.filter((t) => t.quelle === 'kontrolle'), ...gm.dosisHinweise] : [];
  kern.forEach((h) => add(h.stufe, kernHinweis(h, stand)));

  if (gm) {
    // Die Einschätzung: nur ihre Stufe in Worten und der Weg dorthin.
    const g = gm;
    const befundAm = g.ohneMuster ? g.ohneMuster.befund.datum : g.befund ? g.befund.befund.datum : null;
    if (rang(g.stufe) >= rang('termin')) {
      add(g.stufe, `
        <div class="karte einschaetzung-verweis ${STUFE_KLASSE[g.stufe]}" data-stufe="${esc(g.stufe)}">
          <p class="klein gedaempft">Einschätzung</p>
          <p class="stufe-zeile">${stufeSchild(g.stufe, g.kopf.titel)}</p>
          ${befundAm ? `<p class="klein">Nach dem Befund vom ${esc(datumKurz(befundAm))} und Ihren übrigen Einträgen.</p>` : '<p class="klein">Nach Ihren Einträgen.</p>'}
          <button type="button" class="knopf knopf-klein" data-act="seite" data-seite="gesamtbild" style="margin-top:.5rem">Einschätzung ansehen</button>
        </div>`);
    }
    const d = dosisVerweis(stand, heute, g.dosis, new Set(g.dosisHinweise.map((h) => h.id)));
    if (d) {
      add(d.stufe, `
        <div class="karte dosis-verweis" data-stufe="${esc(d.stufe)}">
          <p><strong>Dosis-Karte</strong></p>
          <p class="klein">${esc(d.text)}</p>
          <button type="button" class="knopf knopf-klein" data-act="seite" data-seite="dosis-karte" style="margin-top:.5rem">Dosis-Karte ansehen</button>
        </div>`);
    }
  }

  const reicht = vorratReicht(heute);
  if (reicht !== null && reicht <= 14) {
    add(reicht <= 0 ? 'heute' : reicht <= 3 ? 'tage' : 'termin', `
      <div class="hinweis-karte warn"><span class="ri" aria-hidden="true">💊</span>
        <div><strong>${reicht <= 0 ? 'Der Vorrat ist aufgebraucht.' : `Vorrat reicht noch etwa ${reicht} ${reicht === 1 ? 'Tag' : 'Tage'}.`}</strong>
        <br><span class="klein">Rechtzeitig ein neues Rezept holen. <button type="button" class="knopf knopf-klein" data-act="seite" data-seite="vorrat">Vorrat ändern</button></span></div>
      </div>`);
  }

  // Sicherung: erst, wenn es etwas zu verlieren gibt, und dann alle zwei Monate.
  const eintraege = Object.keys(stand.einnahmen).length + stand.labor.length;
  const letzteSicherung = stand.letzteSicherung;
  if (eintraege >= 30 && (!letzteSicherung || tageZwischen(letzteSicherung, heute) > 60)) {
    add('keine', `
      <div class="hinweis-karte"><span class="ri" aria-hidden="true">💾</span>
        <div>${letzteSicherung ? 'Die letzte Sicherung ist über zwei Monate her.' : 'Ihre Daten sind noch nicht gesichert.'} Bei einem neuen Handy wären sie sonst weg.
        ${kleinerKnopf('sicherung', 'Jetzt sichern')}</div>
      </div>`);
  }

  // P6: ohne Bestätigung keine Einschätzung – klein, ganz unten.
  if (!aktiv) add('keine', p6Karte());

  // W5 immer zuerst, danach nach Stufe; Gleichstand behält die Reihenfolge.
  return liste
    .map((h, i) => ({ ...h, i }))
    .sort((a, b) => (b.oben - a.oben) || (rang(b.stufe) - rang(a.stufe)) || (a.i - b.i))
    .map((h) => h.html)
    .join('');
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
        <button type="button" class="knopf knopf-klein knopf-leise" data-act="seite" data-seite="warnzeichen" style="margin:.2rem 0 .4rem">Geht es Ihnen gerade schlecht? Warnzeichen prüfen</button><br>
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
  const dosis = dosisText(aktuelleDosis(heute));
  const naechste = naechsteDosis(heute);
  const anrede = stand.profil.name ? `Guten Tag, ${esc(stand.profil.name)}.` : '';
  const kopf = `
    <p class="heute-datum">${esc(datumInWorten(heute))}</p>
    <p class="heute-dosis">${anrede ? `${anrede} ` : ''}${dosis
    ? esc(dosis)
    : 'Noch keine Dosis eingetragen. <button type="button" class="knopf knopf-klein" data-act="seite" data-seite="dosis">Dosis eintragen</button>'}</p>
    ${naechste ? `<p class="hinweis-karte" style="display:block"><strong>Ab ${esc(datumInWorten(naechste.ab))}:</strong> ${esc(dosisText(naechste))}</p>` : ''}`;
  const knopf = tabletteKnopf(stand, heute, jetztUhr);
  // Bei Schrift „sehr groß" füllten Notfallleiste, Datum und Dosis den ersten
  // Bildschirm (360 × 740) – der Knopf, für den man die App jeden Morgen
  // öffnet, lag darunter. Dann steht er direkt unter der Leiste, Datum und
  // Dosis folgen. Die Leiste selbst bleibt oben (W0).
  const knopfZuerst = stand.einstellungen.schrift === 'sehr-gross';
  return `
    ${notfallLeiste(stand)}
    ${knopfZuerst ? `${knopf}<div style="height:.6rem"></div>${kopf}` : `${kopf}${knopf}`}
    <div style="height:.8rem"></div>
    ${hinweise(stand, heute)}
    ${befinden(stand, heute)}`;
}
