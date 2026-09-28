/*
 * Schilddrüse – Alltagsbegleiter bei Schilddrüsenunterfunktion.
 *
 * Für eine Nutzerin, die morgens eine Tablette nimmt und beim Arzttermin
 * wissen will, was seit dem letzten Mal war. Die App hakt die Einnahme ab,
 * hält Dosis, Laborwerte, Gewicht und Befinden fest und schreibt daraus den
 * Bericht für den Termin. Sie ordnet Werte und Beschwerden nach festen Regeln
 * ein (js/einschaetzung.js) und nennt auf der Dosis-Karte eine Richtung
 * (js/dosis.js) – eine neue Dosis rechnet sie nie aus; die legt die Ärztin fest.
 *
 * Aufbau: js/speicher.js hält den Zustand, die ansicht-*.js liefern HTML als
 * Text, und diese Datei setzt beides zusammen: welcher Reiter, welche Seite
 * darüber, was ein Tipp auslöst. Alles über data-act-Attribute und eine
 * Weiche unten – ohne Rahmenwerk, wie die Workout-App nebenan.
 */
import * as sp from './speicher.js';
import { heuteISO, jetztUhr, tageWeiter, istISO, datumKurz } from './datum.js';
import { esc, mehrzahl } from './text.js';
import { heuteAnsicht } from './ansicht-heute.js';
import { verlaufAnsicht, verlaufSeite } from './ansicht-verlauf.js';
import { mehrAnsicht, mehrSeite } from './ansicht-mehr.js';
import { formular, absenden, eintragLoeschen, zaehlerNachfuehren } from './ansicht-formulare.js';
import { einschaetzungSeite } from './ansicht-einschaetzung.js';
import { dosisSeite, PRAXIS_BESTAETIGUNG, PRAXIS_NEUE_DOSIS, PRAXIS_NOCH_NICHT } from './ansicht-dosis.js';
import { fragenVorschlaege, abnahmeHeute, aenderungsArt } from './einschaetzung.js';
import { dosisHinweise, wd4FrageArt } from './dosis.js';
import { willkommenAnsicht, willkommenWeiter, willkommenEntwurf, WILLKOMMEN_SCHRITTE } from './ansicht-willkommen.js';
import { berichtText } from './bericht.js';
import { erinnerungICS, terminICS } from './ics.js';

const $ansicht = document.getElementById('ansicht');
const $kopf = document.getElementById('kopf');
const $reiter = document.getElementById('reiterleiste');
const $meldung = document.getElementById('meldung');

/*
 * Mit welchem Reiter die App öffnet: immer „Heute" – dort stehen die
 * Notfallnummern (W0), der Knopf für die Tablette und was heute ansteht.
 * Vorher kam der Reiter aus dem gespeicherten Stand: Wer zuletzt unter „Mehr"
 * den Bericht gelesen hatte, sah Tage später beim Öffnen nur die Liste unter
 * „Mehr" (B64). Gemerkt wird der Reiter nur für ein Neuladen am selben Tag
 * (etwa nach einer neuen Fassung), in der Sitzung des Browsers.
 */
const REITER_MERK = 'schilddruese.reiter';
const REITER = ['heute', 'verlauf', 'mehr'];
function reiterBeimStart() {
  try {
    const m = JSON.parse(sessionStorage.getItem(REITER_MERK) || 'null');
    if (m && m.tag === heuteISO() && REITER.includes(m.tab)) return m.tab;
  } catch { /* ohne Sitzungsspeicher eben „Heute" */ }
  return 'heute';
}
function reiterMerken(tab) {
  try { sessionStorage.setItem(REITER_MERK, JSON.stringify({ tab, tag: heuteISO() })); } catch { /* egal */ }
}

/*
 * Was gerade zu sehen ist: ein Reiter, und darüber womöglich eine Seite
 * (ein Formular, eine Liste, ein Wissenskapitel). „Zurück", „Abbrechen" und
 * „Löschen" führen dorthin, woher man kam – aus „Alle Laborwerte" in einen
 * Befund und zurück in die Liste, nicht bis zum Reiter. Sonst muss man die
 * Liste nach jedem Eintrag neu suchen, und derselbe Knopf führt mal hierhin,
 * mal dorthin.
 */
const ui = {
  tab: reiterBeimStart(),
  seite: null,        // { name, param } oder null
  stapel: [],         // die Seiten darunter, zu denen „Zurück" führt
  schritt: 1,         // Willkommen: welcher Schritt
  // Willkommen: was beim Tipp auf „Zurück" in einem Schritt stand, je Schritt
  // (willkommenEntwurf). Ohne das war in Schritt 2 danach die Stärke leer und
  // „Seit wann?" still wieder heute (Runde 4: E12).
  entwurf: {},
  formStand: null,    // die Felder des offenen Formulars beim Zeichnen (E5)
  abgehakt: null,     // { tag, uhr } des Hakens von eben – für „Rückgängig" (E3)
};

const REITER_TITEL = { heute: 'Heute', verlauf: 'Verlauf', mehr: 'Mehr' };

/*
 * Eine kurze Meldung unten. Die Dauer richtet sich nach der Länge: Wer
 * langsam liest oder gerade zur Tablettenschachtel schaut, soll den Satz
 * noch sehen – mindestens fünf Sekunden, dazu gut eine Drittelsekunde je
 * Wort. Was wichtig bleibt (etwa „nicht doppelt nehmen"), steht zusätzlich
 * dauerhaft auf der Seite und nicht nur hier.
 */
let meldungTimer = null;
/*
 * `optionen.knopf` ({ act, text }): ein Knopf in der Meldung, etwa
 * „Rückgängig" nach „Tablette abgehakt" (Runde 4: E3). Die Meldung nimmt
 * sonst keine Tipps an (pointer-events: none in css/styles.css) – mit Knopf
 * nur, solange sie zu sehen ist. Ältere Aufrufe geben als zweites eine Dauer
 * mit; die zählt nicht.
 */
export function meldung(text, optionen = null) {
  const knopf = optionen && typeof optionen === 'object' ? optionen.knopf : null;
  $meldung.textContent = text;
  if (knopf) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'knopf knopf-klein';
    b.dataset.act = knopf.act;
    b.textContent = knopf.text;
    b.style.marginLeft = '.6rem';
    $meldung.append(b);
  }
  $meldung.style.pointerEvents = knopf ? 'auto' : '';
  $meldung.style.borderRadius = knopf ? '1.2rem' : '';
  $meldung.classList.add('zeigen');
  clearTimeout(meldungTimer);
  const dauer = 5000 + text.split(/\s+/).length * 350;
  meldungTimer = setTimeout(meldungZu, dauer);
}

// Die Meldung steht mit left: 50% fest unten – ohne feste Breite war sie
// deshalb höchstens halb so breit wie der Bildschirm. Bei Schrift „sehr groß"
// wurden längere Meldungen (etwa nach dem Abhaken einer Frage, Runde 4: E14)
// ein schmaler Klecks über sieben Zeilen. So nimmt sie die Breite ihres Texts,
// höchstens 92 % (max-width in css/styles.css).
$meldung.style.width = 'max-content';

function meldungZu() {
  clearTimeout(meldungTimer);
  $meldung.classList.remove('zeigen');
  $meldung.style.pointerEvents = '';
  $meldung.style.borderRadius = '';
  // Ein unsichtbarer Knopf darf nicht mehr erreichbar sein – auch nicht mit der Tastatur.
  $meldung.querySelectorAll('button').forEach((b) => b.remove());
}

/**
 * Die Warnung, wenn nicht gespeichert werden kann – über jeder Ansicht, auch
 * der Willkommensseite. Stand sie nur unter „Heute", sah sie niemand, der
 * gerade woanders war; und bei Daten aus einer neueren Fassung zeigt die App
 * die Willkommensseite (sie kennt den Stand ja nicht) – genau dort muss
 * stehen, warum.
 */
function speicherWarnung() {
  if (sp.kannSpeichern()) return '';
  const grund = sp.speicherGrund();
  const text = grund === 'neuer'
    ? 'Auf diesem Handy liegen Daten aus einer neueren Fassung der App. Bitte die Seite neu laden oder die App aktualisieren – bis dahin wird nichts überschrieben, und was Sie jetzt eintragen, wird nicht gespeichert.'
    : grund === 'voll'
      ? 'Der Speicher des Browsers ist voll. Was Sie jetzt eintragen, geht beim Schließen verloren. Bitte unter „Mehr → Sicherung" eine Sicherung speichern.'
      : 'Der Browser kann hier nichts speichern (privates Fenster?). Was Sie eintragen, geht beim Schließen verloren.';
  return `<div class="hinweis-karte gefahr" role="alert"><span class="ri" aria-hidden="true">⚠️</span><div>${esc(text)}</div></div>`;
}

/** Eine Seite über dem Reiter auflösen – wer sie kennt, liefert sie. */
function seiteInhalt(seite, stand, heute) {
  return formular(seite.name, seite.param, stand, heute)
    || verlaufSeite(seite.name, seite.param, stand, heute)
    || mehrSeite(seite.name, seite.param, stand, heute)
    || einschaetzungSeite(seite.name, seite.param, stand, heute)
    || dosisSeite(seite.name, seite.param, stand, heute)
    || { titel: 'Nicht gefunden', html: '<div class="karte"><p>Diese Seite gibt es nicht.</p></div>' };
}

/*
 * Was zuletzt gezeichnet wurde – daran erkennt render(), ob es dieselbe Seite
 * an Ort und Stelle neu zeichnet (Schrift, Farben, eine Antwort auf der
 * Dosis-Karte, eine Änderung im anderen Fenster) oder ob eine andere Seite
 * kommt. Jede neue Seite ist ein neues Objekt in ui.seite (zeigeSeite, zurueck).
 */
let gezeichnet = null;   // { seite, tab, willkommen, schritt }

/*
 * Was render() mit diesem Stand zeichnen würde – ohne zu zeichnen und ohne
 * etwas zu merken. → { html, titel, merken? }. Auch für fremdeAenderung():
 * Gibt es das offene Formular mit dem neuen Stand noch? (Runde 6: G2)
 */
function ansichtBauen(stand, heute) {
  if (!stand.profil.begruesst) {
    // Ein Entwurf aus „Zurück" geht dem Stand vor (Runde 4: E12).
    return {
      html: willkommenAnsicht(ui.schritt, stand, heute, ui.entwurf[ui.schritt] || null),
      titel: `Schritt ${ui.schritt} von ${WILLKOMMEN_SCHRITTE}`,
    };
  }
  if (ui.seite) return seiteInhalt(ui.seite, stand, heute);
  if (ui.tab === 'verlauf') return { html: verlaufAnsicht(stand, heute), titel: null };
  if (ui.tab === 'mehr') return { html: mehrAnsicht(stand, heute), titel: null };
  return { html: heuteAnsicht(stand, heute, jetztUhr()), titel: null };
}

/*
 * Runde 6: G3 – Die Formulare der Einrichtung tragen kein data-formular: Der
 * Empfänger für „submit" schickt sie an willkommenWeiter, nicht an absenden().
 * Deshalb erfassten formStand() und eingabenMerken() sie nicht. Schrieb ein
 * zweites Fenster, zeichnete die App den Schritt neu, und die getippte
 * Stärke und das Präparat waren still weg. Sie bekommen hier data-schritt
 * und zählen damit wie jedes andere Formular.
 */
const FORMULARE = 'form[data-formular], form[data-schritt]';
function schritteMarkieren(wurzel) {
  wurzel.querySelectorAll('form:not([data-formular]):not([data-sofort])').forEach((f) => { f.dataset.schritt = String(ui.schritt); });
}
/** Woran ein Formular nach dem Neuzeichnen wiederzuerkennen ist. */
function formKennung(form) {
  return form.dataset.formular ? `${form.dataset.formular}#${form.dataset.id || ''}` : `schritt#${form.dataset.schritt || ''}`;
}

/**
 * `eingaben`: was nach dem Zeichnen in die Felder zurückkommt. Ohne Angabe
 * (undefined) das Getippte, wenn dieselbe Seite an Ort und Stelle neu
 * gezeichnet wird (F21); null zeichnet nur aus dem Stand (G2).
 */
function render({ eingaben } = {}) {
  const stand = sp.getStand();
  document.documentElement.dataset.schrift = stand.einstellungen.schrift;
  document.documentElement.dataset.farbe = stand.einstellungen.farbe;
  const heute = heuteISO();

  const willkommen = !stand.profil.begruesst;
  /*
   * Runde 5: F21 – An Ort und Stelle neu gezeichnet, kam jedes Formular aus
   * dem gespeicherten Stand: „Frau Möller" ins Feld „Anrede" getippt, dann
   * „Sehr groß" – das Feld war leer, und weil der Vergleichsstand (E5) neu
   * gesetzt wurde, galt es als unverändert. „Anrede speichern" speicherte
   * leer und meldete „Anrede gespeichert". Jetzt bleibt stehen, was getippt
   * war, und es zählt weiter als ungespeichert.
   */
  const anOrt = Boolean(gezeichnet) && gezeichnet.seite === ui.seite && gezeichnet.tab === ui.tab
    && gezeichnet.willkommen === willkommen && (!willkommen || gezeichnet.schritt === ui.schritt);
  const behalten = eingaben !== undefined ? eingaben : anOrt && eingabenGeaendert() ? eingabenMerken() : null;
  gezeichnet = { seite: ui.seite, tab: ui.tab, willkommen, schritt: ui.schritt };
  const gebaut = ansichtBauen(stand, heute);
  const { html } = gebaut;
  const titel = gebaut.titel || null;
  // Die Dosis-Karte kann sich merken lassen, dass sie etwas gezeigt hat –
  // einmal; beim nächsten Zeichnen liefert sie dafür nichts mehr. Mit dem
  // Titel der Karte: Der Bericht nennt so die zuletzt gezeigte Richtung in
  // den Worten, die die Patientin gelesen hat (RW2 B1, Runde 4: E16).
  // Der Titel ist danach Nutzerspeicher – jede Ansicht gibt ihn nur über esc() aus.
  if (!willkommen && ui.seite && gebaut.merken) {
    const m = gebaut.merken;
    const titelText = typeof m.titel === 'string' ? m.titel.trim().slice(0, 200) : '';
    sp.aendern((st) => {
      st.nachfragen.push({ id: sp.kennung(), art: m.art, bezug: m.bezug, antwort: m.antwort, am: heute, ...(titelText ? { titel: titelText } : {}) });
    });
  }

  // Kopf: die Marke, oder „Zurück" mit dem Titel der Seite.
  // Der Titel ist die Überschrift der Seite (h1): Vorher ein Span, und viele
  // Seiten – auch die Dosis-Karte – hatten gar keine Überschrift; die
  // Überschriften-Navigation der Vorleseprogramme fand dort nichts (Runde 5:
  // F4). Die Klasse bleibt, damit Größe und Stil gleich bleiben. tabindex -1:
  // Nach dem Öffnen einer Seite steht der Fokus auf ihr (zeigeSeite).
  if (titel && !willkommen) {
    const ziel = ui.stapel.length ? seiteInhalt(ui.stapel[ui.stapel.length - 1], stand, heute).titel : REITER_TITEL[ui.tab];
    $kopf.innerHTML = `<button type="button" class="kopf-zurueck" data-act="zurueck" aria-label="Zurück zu ${esc(ziel)}">‹ Zurück</button><h1 class="kopf-titel" id="seitentitel" tabindex="-1">${esc(titel)}</h1>`;
  } else if (willkommen) {
    $kopf.innerHTML = `<h1 class="marke"><img src="icon.svg" alt="">Schilddrüse</h1><span class="kopf-titel gedaempft" style="margin-left:auto">${esc(titel)}</span>`;
  } else {
    $kopf.innerHTML = '<h1 class="marke"><img src="icon.svg" alt="">Schilddrüse</h1>';
  }

  kopfHoeheMerken();
  $ansicht.innerHTML = speicherWarnung() + html;
  if (willkommen) schritteMarkieren($ansicht);
  // Vorleseprogramme nennen beim Fokus den Namen des Bereichs – bei einer
  // offenen Seite ihren Titel, nicht den Reiter darunter.
  $ansicht.setAttribute('aria-labelledby', titel && !willkommen ? 'seitentitel' : `reiter-${ui.tab}`);
  $reiter.hidden = willkommen;
  document.body.classList.toggle('ohne-leiste', willkommen);
  $reiter.querySelectorAll('.reiter').forEach((b) => {
    b.setAttribute('aria-selected', String(!willkommen && b.dataset.reiter === ui.tab && !ui.seite));
  });
  /*
   * Runde 6: G4 – Der gemerkte Reiter ist immer der gezeichnete. Gemerkt
   * wurde er nur beim Tipp auf einen Reiter: Nach „Sicherung einlesen" oder
   * „Fertig – zur App" stand „Heute" da, gemerkt blieb „Mehr" – und das
   * aufgeschobene Neuladen nach einem Update sprang eine Sekunde später ohne
   * Zutun dorthin (E25, F19). Nicht beim Einrichten: Dort gibt es keinen Reiter.
   */
  if (!willkommen) reiterMerken(ui.tab);
  /*
   * Runde 6: G9 – „Rückgängig" gilt nur dem Haken von eben. Steht für den Tag
   * inzwischen etwas anderes (über „antippen zum Zurücknehmen", in der Liste
   * der Einnahmen, im anderen Fenster), geht der Knopf mit der Meldung weg.
   * Vorher blieb „Tablette abgehakt [Rückgängig]" unter „Noch nicht
   * eingetragen" stehen, und der Knopf tat nichts.
   */
  if (ui.abgehakt) {
    const e = sp.einnahme(ui.abgehakt.tag);
    if (!e || e.uhr !== ui.abgehakt.uhr) {
      ui.abgehakt = null;
      if ($meldung.querySelector('[data-act="tablette-rueckgaengig"]')) meldungZu();
    }
  }
  // Was im Formular stand, als es gezeichnet wurde – daran misst verlassen(),
  // ob etwas eingetippt und noch nicht gespeichert ist (Runde 4: E5).
  ui.formStand = formStand();
  // Das Getippte zurück in die Felder – der Vergleichsstand bleibt der
  // gezeichnete, die Eingaben zählen also weiter als ungespeichert (F21).
  if (behalten && behalten.length) {
    eingabenZurueck(behalten);
    // Der Zeichenzähler zählt, was jetzt im Feld steht (Runde 5: F23).
    $ansicht.querySelectorAll('textarea').forEach(zaehlerNachfuehren);
  }
  verlaufAbgleichen();
  // Ein Update hat während eines Formulars übernommen: neu laden, wo nichts
  // mehr verloren geht (Runde 4: E25, siehe index.html) – aber nicht sofort.
  // Das lud gleich nach dem Tipp auf „Speichern" neu, und die Sperre gegen den
  // zweiten Tipp (E3) war mit der alten Seite weg: Der zweite Tipp eines
  // Doppeltipps traf auf der frischen Seite „Tablette genommen?" und hakte
  // die Tablette um 6:30 ab; „Befinden gespeichert" sah niemand (Runde 5: F19).
  if (window.__schilddrueseNeuLaden && neuLadenErlaubt()) neuLadenPlanen();
}

/*
 * Runde 5: F21 – die Felder der offenen Formulare, bevor render() sie
 * ersetzt, und zurück in die neu gezeichneten. Zugeordnet wird über das
 * Formular (data-formular, data-id; beim Einrichten data-schritt, Runde 6:
 * G3) und den Namen der Felder; Haken und Auswahlknöpfe über ihren Wert.
 * Verborgene Felder setzt nur die App selbst.
 */
function eingabenMerken() {
  return [...$ansicht.querySelectorAll(FORMULARE)].map((form) => ({
    kennung: formKennung(form),
    felder: [...form.elements]
      .filter((el) => el.name && !['hidden', 'file', 'submit', 'button', 'reset'].includes(el.type))
      .map((el) => ({ name: el.name, typ: el.type, wert: el.value, an: el.checked, aus: el.disabled })),
    offen: [...form.querySelectorAll('details')].map((d) => d.open),
  }));
}

function eingabenZurueck(gemerkt) {
  gemerkt.forEach((g) => {
    const form = [...$ansicht.querySelectorAll(FORMULARE)].find((f) => formKennung(f) === g.kennung);
    if (!form) return;
    const reihe = {};   // Name → Werte der Textfelder in ihrer Reihenfolge
    g.felder.forEach((f) => {
      if (f.typ !== 'checkbox' && f.typ !== 'radio') (reihe[f.name] = reihe[f.name] || []).push(f.wert);
    });
    const schonDa = {};
    [...form.elements].forEach((el) => {
      if (!el.name || ['hidden', 'file', 'submit', 'button', 'reset'].includes(el.type)) return;
      if (el.type === 'checkbox' && g.delta && g.delta[el.name]) {
        if (g.delta[el.name].an.includes(el.value)) el.checked = true;
        else if (g.delta[el.name].aus.includes(el.value)) el.checked = false;
        return;
      }
      if (el.type === 'checkbox' || el.type === 'radio') {
        const alt = g.felder.find((f) => f.name === el.name && f.typ === el.type && f.wert === el.value);
        if (alt) el.checked = alt.an;
        else if (g.felder.some((f) => f.name === el.name && f.typ === el.type)) el.checked = false;
        return;
      }
      const i = schonDa[el.name] || 0;
      schonDa[el.name] = i + 1;
      const werte = reihe[el.name];
      if (!werte || i >= werte.length) return;
      if (el.tagName === 'SELECT' && ![...el.options].some((o) => o.value === werte[i])) return;
      el.value = werte[i];
    });
    const details = form.querySelectorAll('details');
    if (details.length === g.offen.length) details.forEach((d, i) => { if (g.offen[i]) d.open = true; });
  });
}

/*
 * Der Kopf klebt oben. Springt die Seite zu einer Stelle (neue Frage auf der
 * Dosis-Karte, der 112-Text nach „JETZT", ein Feld mit Fehler), lag deren
 * Anfang vorher unter dem Kopf – nach der letzten Frage sah man weder die Stufe
 * noch den Anfang der Richtung (B60). Die Höhe des Kopfs geht deshalb als
 * --kopf-h an scroll-padding-top (css/styles.css); sie wächst mit der Schrift.
 */
function kopfHoeheMerken() {
  const kopf = $kopf.closest('.kopf') || $kopf;
  document.documentElement.style.setProperty('--kopf-h', `${kopf.offsetHeight}px`);
}
window.addEventListener('resize', kopfHoeheMerken);

function zeigeReiter(tab) {
  ui.tab = tab;
  ui.seite = null;
  ui.stapel = [];
  reiterMerken(tab);
  sperren();
  window.scrollTo(0, 0);
  render();
  $ansicht.focus({ preventScroll: true });
}

/**
 * Eine Seite öffnen. Aus einer anderen Seite heraus merkt sie sich, woher
 * man kam; `ersetzen` tauscht die aktuelle aus (nach dem Speichern eines
 * Formulars soll „Zurück" nicht wieder ins Formular führen).
 */
function zeigeSeite(name, param = null, { ersetzen = false } = {}) {
  if (ui.seite && !ersetzen) ui.stapel.push(ui.seite);
  ui.seite = { name, param };
  sperren();
  window.scrollTo(0, 0);
  render();
  /*
   * „Bundesland eintragen" (Notfallleiste, Wissen) öffnete „Über mich" ganz
   * oben – die Auswahl stand bei Schrift „sehr groß" gut sieben Bildschirme
   * tiefer, und oben stand nur „Alles freiwillig …" (Runde 4: E8). Jetzt steht
   * sie in der Mitte und hat den Fokus.
   */
  const ziel = name === 'profil' && param === 'bundesland' ? $ansicht.querySelector('select[name="bundesland"]') : null;
  if (ziel) {
    ziel.scrollIntoView({ block: 'center' });
    ziel.focus({ preventScroll: true });
  } else {
    // Auf die Überschrift der neuen Seite: Das Vorleseprogramm sagt
    // „Überschrift, Ebene 1" mit dem Titel an, und das Weiterwischen führt in
    // den Inhalt (Runde 5: F4). Ohne Titel wie bisher auf die Ansicht.
    (document.getElementById('seitentitel') || $ansicht).focus({ preventScroll: true });
  }
}

function zurueck() {
  ui.seite = ui.stapel.pop() || null;
  sperren();
  window.scrollTo(0, 0);
  render();
  $ansicht.focus({ preventScroll: true });
}

// ---------------------------------------------------------------- Verlassen, Zurück-Taste

/*
 * Eine Seite verlassen – über „‹ Zurück", „Abbrechen", einen Reiter oder die
 * Zurück-Taste des Handys. Vorher verwarf jeder dieser Wege ein halb
 * ausgefülltes Formular ohne Rückfrage: TSH 3,8 und 0,27 abgetippt, einmal
 * „Heute" angetippt, alles weg; „Herzerkrankung: Ja" in „Über mich" (bei
 * Schrift „sehr groß" 5600 px über „Speichern") ebenso (Runde 4: E5).
 * Verglichen wird mit dem Stand beim Zeichnen; wer nichts geändert hat, wird
 * nicht gefragt. Nach dem Speichern (nachDemSpeichern) und nach „Löschen"
 * fragt nichts – dort ist nichts verloren.
 *
 * Das Dosis-Formular nach „Die Dosis wird geändert" fragt stattdessen, ob die
 * Praxis schon geändert hat (Runde 4: E1, praxisNachfrage).
 */
const VERWERFEN = 'Ihre Eingaben sind noch nicht gespeichert. Verwerfen und die Seite verlassen?';

/*
 * Die Felder der offenen Formulare als Text – oder null ohne Formular. Je
 * Formular mit seiner Kennung: geaenderteEingaben() vergleicht Feld für
 * Feld (Runde 6: G2). Vorher zählte nur das erste Formular der Seite.
 */
function formStand() {
  const formulare = [...$ansicht.querySelectorAll(FORMULARE)];
  if (!formulare.length) return null;
  return JSON.stringify(formulare.map((form) => [
    formKennung(form), [...new FormData(form)].map(([k, v]) => [k, typeof v === 'string' ? v : '']),
  ]));
}

function eingabenGeaendert() {
  const jetzt = formStand();
  return jetzt !== null && jetzt !== ui.formStand;
}

function verlassen(weiter) {
  const s = ui.seite;
  if (s && s.praxisVorher && s.name === 'dosis' && s.param === 'praxis' && praxisNochGeaendert(s.praxisVorher)) {
    praxisNachfrage(s.praxisVorher, weiter);
    return;
  }
  if (eingabenGeaendert() && !window.confirm(VERWERFEN)) {
    // Nach der Zurück-Taste steht die Seite so wieder im Verlauf des Browsers.
    verlaufAbgleichen();
    return;
  }
  weiter();
}

/*
 * Die Zurück-Taste des Handys (Runde 4: E5). Die App legte für Seiten keine
 * Einträge im Verlauf des Browsers an: Die Taste oder die Wischgeste
 * verließ aus jedem Formular heraus die App, als installierte App wurde sie
 * geschlossen – mit allem, was halb abgetippt war.
 *
 * Jetzt steht für jede offene Seite (und jeden Willkommensschritt nach dem
 * ersten) ein Eintrag im Verlauf. Die Taste nimmt einen weg, und die App geht
 * eine Seite zurück – mit derselben Rückfrage wie „‹ Zurück". Schließt die
 * App Seiten selbst („‹ Zurück", Speichern, ein Reiter), nimmt sie die
 * Einträge mit history.go() wieder weg; das popstate dazu kommt von ihr
 * selbst und wird übergangen. Gezeichnet wird dabei sofort, nicht erst beim
 * popstate. Einen Eintrag legt die App nur bei einem Tipp an: Chrome
 * überspringt Einträge, die ohne Zutun entstehen.
 */
let verlaufTiefe = 0;     // wie viele eigene Einträge über dem der App liegen
let eigeneSchritte = 0;   // so viele popstate kommen von history.go() der App

function sollTiefe() {
  const st = sp.getStand();
  if (!st.profil.begruesst) return Math.max(0, ui.schritt - 1);
  return ui.seite ? ui.stapel.length + 1 : 0;
}

function verlaufAbgleichen() {
  const soll = sollTiefe();
  if (soll === verlaufTiefe) return;
  try {
    if (soll > verlaufTiefe) {
      for (let t = verlaufTiefe + 1; t <= soll; t++) history.pushState({ schilddruese: true, tiefe: t }, '');
    } else {
      eigeneSchritte++;
      history.go(soll - verlaufTiefe);
    }
    verlaufTiefe = soll;
  } catch { /* ohne Verlauf (etwa in einem eingebetteten Rahmen) wie bisher */ }
}

// Ein Eintrag aus der Zeit vor einem Neuladen gehört zu keiner offenen Seite
// mehr: Die App startet auf einem Reiter. Sie geht deshalb auf ihren eigenen
// Eintrag zurück – nur ersetzt, blieben darunter tote Einträge liegen, und
// der erste Druck auf die Zurück-Taste bewirkte nichts (Nachprüfung zu E5,
// auch nach dem aufgeschobenen Neuladen eines Updates, E25).
try {
  const alt = history.state && history.state.schilddruese ? Number(history.state.tiefe) || 0 : 0;
  if (alt > 0) {
    eigeneSchritte++;
    history.go(-alt);
  } else if (history.state && history.state.schilddruese) history.replaceState(null, '');
} catch { /* egal */ }

window.addEventListener('popstate', (e) => {
  const neu = e.state && e.state.schilddruese ? Number(e.state.tiefe) || 0 : 0;
  if (eigeneSchritte > 0) { eigeneSchritte--; return; }
  if (neu > verlaufTiefe) {
    // Vorwärts: Die Seite von damals gibt es nicht mehr – zurück, wo die App steht.
    eigeneSchritte++;
    history.go(verlaufTiefe - neu);
    return;
  }
  if (neu === verlaufTiefe) return;
  const schritte = verlaufTiefe - neu;
  verlaufTiefe = neu;
  // Eine offene Rückfrage: Die Taste heißt „nicht jetzt" – die Seite bleibt.
  if (rueckfrage || auswahl) {
    rueckfrageSchliessen(false);
    auswahlFertig(null);
    verlaufAbgleichen();
    return;
  }
  if (!sp.getStand().profil.begruesst) {
    willkommenZurueck(schritte);
    return;
  }
  if (!ui.seite) return;
  verlassen(() => {
    for (let i = 1; i < schritte && ui.stapel.length; i++) ui.stapel.pop();
    zurueck();
  });
});

/** Nach dem Speichern: dorthin, wohin das Formular will – oder zurück. */
function nachDemSpeichern(danach) {
  if (!danach) { zurueck(); return; }
  const unten = ui.stapel[ui.stapel.length - 1];
  if (unten && unten.name === danach.name) { zurueck(); return; }
  zeigeSeite(danach.name, danach.param || null, { ersetzen: true });
}

// ---------------------------------------------------------------- Doppeltipp

/*
 * Nach einem Seiten- oder Reiterwechsel, nach dem Speichern und beim
 * Abschluss der Einrichtung liegt unter dem Finger etwas anderes als eben.
 * Ein ungeduldiger zweiter Tipp traf auf „Heute" bei Schrift „sehr groß" den
 * großen Knopf „Tablette genommen?" und hakte die Tablette ab, bevor sie
 * genommen war – am Einrichtungstag um 6:30 stand danach „✓ Tablette
 * genommen" (Runde 4: E3). Für 0,6 Sekunden zählt deshalb kein zweiter Tipp
 * an derselben Stelle: ein Finger oder Stift, oder der zweite Klick eines
 * Doppelklicks (detail 2). Andere Stellen, ein einzelner Mausklick und die
 * Tastatur (detail 0) bleiben frei – wer gezielt tippt, wird nicht aufgehalten.
 * Seit Runde 5 (F18) sperrt jede Aktion so, nicht nur ein Seitenwechsel –
 * siehe den Klick-Empfänger unten.
 */
const SPERRE_MS = 600;
const SPERRE_PX = 48;
let letzterDruck = null;   // { x, y, t, finger } des letzten Fingers oder Mausdrucks
let sperre = null;         // { x, y, bis }

document.addEventListener('pointerdown', (e) => {
  letzterDruck = { x: e.clientX, y: e.clientY, t: performance.now(), finger: e.pointerType !== 'mouse' };
}, true);

function sperren() {
  const jetzt = performance.now();
  sperre = letzterDruck && jetzt - letzterDruck.t < 1500 ? { x: letzterDruck.x, y: letzterDruck.y, bis: jetzt + SPERRE_MS } : null;
}

document.addEventListener('click', (e) => {
  // Notrufnummern sind immer anrufbar: Auf der Seite nach „Auswerten" lag
  // „112 anrufen" genau unter dem Finger, und ein Tipp 0,35 Sekunden später
  // kam nie beim Link an – ein Anruf, der nicht zustande kommt, wiegt
  // schwerer als ein versehentlich geöffnetes Wählfeld (Nachprüfung zu E3).
  if (e.target && e.target.closest && e.target.closest('a[href^="tel:"]')) return;
  if (!sperre || e.detail === 0) return;
  if (performance.now() > sperre.bis) { sperre = null; return; }
  if (Math.hypot(e.clientX - sperre.x, e.clientY - sperre.y) > SPERRE_PX) return;
  if (!(letzterDruck && letzterDruck.finger) && e.detail < 2) return;
  // Auch die Wirkung des Browsers (Absenden, Haken, Link) bleibt aus.
  e.preventDefault();
  e.stopImmediatePropagation();
}, true);

// ---------------------------------------------------------------- Dateien

function herunterladen(name, inhalt, typ) {
  const blob = new Blob([inhalt], { type: typ });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/*
 * Runde 6: G8 – Die Datei nennt ihr eigenes Datum als letzte Sicherung.
 * Vorher stand darin letzteSicherung: null (die App setzte das Datum erst
 * nach dem Schreiben der Datei), und wer sie auf dem neuen Handy einlas, sah
 * „Noch nie gesichert". Auf diesem Handy gilt das Datum erst, wenn Teilen
 * oder Herunterladen geklappt hat – ein abgebrochenes Teilen ist keine Sicherung.
 */
function mitSicherungsdatum(json, heute) {
  try {
    const daten = JSON.parse(json);
    daten.letzteSicherung = heute;
    return JSON.stringify(daten, null, 2);
  } catch {
    return json;
  }
}

/**
 * Die Sicherung weitergeben – aufs Handy heißt das meist: an sich selbst
 * schicken oder in einen Ordner legen. Wo das Teilen nicht geht, wird
 * heruntergeladen. Abbrechen ist keine Meldung wert.
 */
async function sicherungSpeichern() {
  const heute = heuteISO();
  const name = `schilddruese-sicherung-${heute}.json`;
  const json = mitSicherungsdatum(sp.exportJSON(), heute);
  let geteilt = false;
  try {
    const datei = new File([json], name, { type: 'application/json' });
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [datei] })) {
      await navigator.share({ files: [datei], title: 'Sicherung Schilddrüse' });
      geteilt = true;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
  }
  if (!geteilt) herunterladen(name, json, 'application/json');
  sp.aendern((s) => { s.letzteSicherung = heute; });
  // Runde 6: G8 – Neu zeichnen: Über der Meldung „Sicherung gespeichert"
  // stand sonst weiter „Noch keine Sicherung gespeichert." Nach dem Teilen
  // (await) ist der Klick längst vorbei – der Fokus bleibt auf dem Knopf.
  render();
  fokusZurueck('[data-act="sicherung-speichern"]');
  meldung('Sicherung gespeichert');
}

/*
 * Vor dem Einlesen: Was ersetzt die Datei? Vorher ersetzte sie ohne ein Wort
 * alles auf dem Handy, und wer dieselbe ältere Datei zweimal einlas, verlor
 * die Rücklage – „zurückholen" brachte danach nur noch die Sicherung, die
 * Befunde und Einnahmen von vorher waren weg (Runde 4: E23). Jetzt nennt die
 * Rückfrage das Datum der Datei und den Umfang auf beiden Seiten, und sie
 * sagt es, wenn die Datei älter ist. Ältere Dateien tragen kein Datum.
 */
const umfangText = (u) => `${u.befunde ? mehrzahl(u.befunde, 'Befund', 'Befunde') : 'keine Befunde'}, ${u.letzteEinnahme ? `Einnahmen bis ${datumKurz(u.letzteEinnahme)}` : 'keine Einnahmen'}`;

function einlesenFrage(p) {
  const kopf = p.datei.exportiertAm ? `Sicherung vom ${datumKurz(p.datei.exportiertAm)} einlesen?` : 'Sicherung einlesen? Die Datei nennt kein Datum.';
  return [
    kopf,
    `Sie ersetzt alles auf diesem Handy (${umfangText(p.handy)}).`,
    `In der Datei: ${umfangText(p.datei)}.`,
    ...(p.dateiAelter ? ['Achtung: Die Datei ist älter als die Daten auf diesem Handy.'] : []),
  ].join('\n\n');
}

function sicherungLaden(datei) {
  if (!datei) return;
  const leser = new FileReader();
  leser.onload = () => {
    const text = String(leser.result || '');
    const kaputt = { ok: false, grund: 'Die Datei ließ sich nicht einlesen. Es wurde nichts geändert.' };
    let pruefung;
    try {
      pruefung = sp.sicherungPruefen(text);
    } catch {
      pruefung = kaputt;
    }
    if (!pruefung.ok) { window.alert(pruefung.grund); return; }
    // Dieselbe Datei noch einmal: nichts ersetzen, und das deutlich sagen –
    // nicht als kurze Meldung, die man übersieht und es wieder versucht.
    if (pruefung.schonEingelesen) { window.alert(sp.SCHON_EINGELESEN); return; }
    // Auf einem neuen Handy gibt es nichts zu ersetzen – dann ohne Rückfrage.
    if (pruefung.handy.hatDaten && !window.confirm(einlesenFrage(pruefung))) {
      meldung('Nicht eingelesen – auf diesem Handy bleibt alles, wie es war.');
      return;
    }
    let ergebnis;
    try {
      ergebnis = sp.importJSON(text);
    } catch {
      // Was normStand nicht abfängt, darf nicht still im Nichts enden.
      ergebnis = kaputt;
    }
    if (ergebnis.ok) {
      // Runde 6: G8 – Eine ältere Datei ohne eigenes Sicherungsdatum: Der
      // eingelesene Stand ist gesichert, und zwar am Tag der Datei.
      const vom = pruefung.datei.exportiertAm;
      const bisher = sp.getStand().letzteSicherung;
      if (vom && vom <= heuteISO() && (!bisher || bisher < vom)) sp.aendern((s) => { s.letzteSicherung = vom; });
      meldung(pruefung.datei.exportiertAm ? `Sicherung vom ${datumKurz(pruefung.datei.exportiertAm)} eingelesen` : 'Sicherung eingelesen');
      ui.seite = null;
      ui.stapel = [];
      ui.tab = 'heute';
      ui.schritt = 1;
      ui.entwurf = {};
      // Eine Sicherung stammt von jemandem, der schon eingerichtet war –
      // auch wenn sie ausnahmsweise ohne diesen Haken gespeichert wurde.
      if (!sp.getStand().profil.begruesst && sp.aktuelleDosis()) sp.aendern((s) => { s.profil.begruesst = true; });
      render();
    } else {
      window.alert(ergebnis.grund);
    }
  };
  leser.onerror = () => window.alert('Die Datei ließ sich nicht lesen.');
  leser.readAsText(datei);
}

async function berichtTeilen() {
  const text = berichtText(sp.getStand(), heuteISO());
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Bericht Schilddrüse', text });
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
  }
  await berichtKopieren();
}

async function berichtKopieren() {
  const text = berichtText(sp.getStand(), heuteISO());
  try {
    await navigator.clipboard.writeText(text);
    meldung('Bericht kopiert – jetzt z. B. in eine Nachricht einfügen');
  } catch {
    herunterladen(`schilddruese-bericht-${heuteISO()}.txt`, text, 'text/plain');
  }
}

// ---------------------------------------------------------------- Hinweise

/*
 * Der Systemhinweis „Tablette noch nicht genommen".
 *
 * Ehrlich gesagt: Das funktioniert nur, solange die App auf dem Bildschirm
 * offen ist – im Hintergrund hält iOS die Seite sofort an, Android nach
 * wenigen Minuten, und setInterval steht dann still. Ohne Server gibt es keinen
 * Weckruf – ein Service Worker wacht nicht von selbst um sieben Uhr auf.
 * Deshalb ist die Kalenderdatei der verlässliche Weg (siehe js/ics.js), und
 * das hier nur die Ergänzung für den Fall, dass die App ohnehin offen liegt.
 */
const HINWEIS_MERK = 'schilddruese.hinweis';

async function tablettenHinweis() {
  const stand = sp.getStand();
  if (!stand.profil.begruesst || !stand.einstellungen.hinweisTablette) return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const heute = heuteISO();
  if (sp.einnahme(heute) !== undefined) return;
  if (jetztUhr() < stand.einstellungen.erinnerung) return;
  /*
   * Am Morgen einer Blutabnahme kommt die Tablette erst danach (RW1 L0d).
   * Der Hinweis „Nüchtern, mit einem Glas Wasser" sagte um 7 Uhr das
   * Gegenteil – wer ihm folgte, bekam ein erhöhtes fT4 (D16). Bis zur
   * Uhrzeit der Abnahme also keiner. Gemerkt wird erst ein wirklich
   * gezeigter Hinweis: Nach der Abnahme erinnert die App dann noch – der
   * Minutentakt in tagPruefen() ruft hier wieder an.
   *
   * Ohne Uhrzeit weiß die App nicht, wann die Abnahme vorbei ist. Vorher
   * schwieg der Hinweis dann den ganzen Tag: Wer die Tablette nach der
   * Abnahme vergaß, wurde nicht mehr erinnert, und bei Einnahme am Abend fiel
   * die Erinnerung ohne Grund weg (Runde 4: E34). Jetzt kommt er zur
   * gewohnten Zeit – mit dem Satz, dass die Tablette erst nach der Abnahme
   * kommt, statt „Nüchtern, mit einem Glas Wasser".
   */
  const abnahme = abnahmeHeute(stand, heute, jetztUhr());
  if (abnahme && abnahme.uhr) return;
  try {
    if (localStorage.getItem(HINWEIS_MERK) === heute) return;
    localStorage.setItem(HINWEIS_MERK, heute);
  } catch { return; }
  const body = abnahme
    ? 'Heute ist Blutabnahme: die Tablette erst nach der Abnahme nehmen – und danach hier abhaken.'
    : 'Nüchtern, mit einem Glas Wasser – und danach hier abhaken.';
  const optionen = { body, tag: 'schilddruese-tablette', icon: './icon-192.png' };
  try {
    const reg = navigator.serviceWorker ? await navigator.serviceWorker.getRegistration() : null;
    if (reg) await reg.showNotification('Schilddrüsentablette', optionen);
    else new Notification('Schilddrüsentablette', optionen);
  } catch { /* dann eben nicht – der Reiter „Heute" zeigt es ohnehin */ }
}

async function hinweisErlauben() {
  if (typeof Notification === 'undefined') {
    window.alert('Dieser Browser kennt keine Systemhinweise.');
    return;
  }
  try {
    const erlaubnis = await Notification.requestPermission();
    if (erlaubnis === 'granted') {
      sp.aendern((s) => { s.einstellungen.hinweisTablette = true; });
      meldung('Hinweise erlaubt');
    } else {
      meldung('Hinweise nicht erlaubt');
    }
  } catch { meldung('Das ging nicht'); }
  render();
}

/** Den Browser bitten, diese Daten nicht von selbst wegzuräumen. */
async function speicherFestnageln() {
  if (!navigator.storage || !navigator.storage.persist) return;
  try {
    const schon = navigator.storage.persisted ? await navigator.storage.persisted() : false;
    const ok = schon || await navigator.storage.persist();
    if (sp.getStand().dauerhaft !== ok) sp.aendern((s) => { s.dauerhaft = ok; });
  } catch { /* kennt der Browser nicht */ }
}

// ---------------------------------------------------------------- Weiche

function aktion(el) {
  const act = el.dataset.act;
  const stand = sp.getStand();
  const heute = heuteISO();
  switch (act) {
    case 'zurueck':
      // „‹ Zurück" und „Abbrechen": mit Rückfrage, wenn Eingaben verloren gingen (E5).
      verlassen(zurueck);
      break;
    case 'seite':
      // Aus einem Formular heraus – etwa „Eintrag vom … öffnen" unter einem
      // belegten Datum – ist das Eingetippte beim Zurückkommen weg. Wie beim
      // Zurück erst fragen (Nachprüfung zu E22/E5).
      if (eingabenGeaendert() && !window.confirm(VERWERFEN)) break;
      zeigeSeite(el.dataset.seite, el.dataset.param || null);
      break;
    case 'reiter':
      verlassen(() => zeigeReiter(el.dataset.reiter));
      break;
    case 'tablette': {
      // Abhaken fragt nicht nach – ein Fehltipp lässt sich aber gleich in der
      // Meldung zurücknehmen, ohne die Rückfrage von „Zurücknehmen" (Runde 4: E3).
      // Gemerkt wird auch, was vorher für heute galt: „Rückgängig" machte aus
      // einem bewussten „Heute nicht genommen" sonst einen leeren Tag, und
      // „Heute" forderte danach gelb zur Einnahme auf (Runde 5: F20).
      const uhr = jetztUhr();
      const vorher = sp.einnahme(heute);
      sp.einnahmeSetzen(heute, { uhr });
      ui.abgehakt = { tag: heute, uhr, vorher: vorher && typeof vorher === 'object' ? { ...vorher } : vorher };
      render();
      meldung('Tablette abgehakt', { knopf: { act: 'tablette-rueckgaengig', text: 'Rückgängig' } });
      break;
    }
    case 'tablette-rueckgaengig': {
      // Nur der Haken von eben – steht inzwischen etwas anderes da (eine
      // andere Uhrzeit, ein neuer Tag), bleibt es. Zurück kommt der Stand von
      // vorher (F20): nichts eingetragen, oder „nicht genommen".
      const a = ui.abgehakt;
      const e = sp.einnahme(heute);
      ui.abgehakt = null;
      meldungZu();
      if (a && a.tag === heute && e && e.uhr === a.uhr) {
        sp.einnahmeSetzen(heute, a.vorher);
        render();
        meldung(a.vorher === null
          ? 'Zurückgenommen – für heute steht wieder: nicht genommen.'
          : a.vorher ? 'Zurückgenommen – für heute gilt wieder der Eintrag von vorher.' : 'Zurückgenommen – heute ist keine Tablette abgehakt.');
      }
      break;
    }
    case 'tablette-zurueck':
      if (window.confirm('Den Haken für heute zurücknehmen?')) {
        // Runde 6: G9 – „Tablette abgehakt [Rückgängig]" von eben geht mit
        // weg; stattdessen sagt die Meldung, was jetzt gilt.
        ui.abgehakt = null;
        meldungZu();
        sp.einnahmeSetzen(heute, undefined);
        render();
        meldung('Zurückgenommen – heute ist keine Tablette abgehakt.');
      }
      break;
    case 'gestern-genommen':
      sp.einnahmeSetzen(tageWeiter(heute, -1), { uhr: '' });
      render();
      break;
    case 'gestern-nicht':
      sp.einnahmeSetzen(tageWeiter(heute, -1), null);
      render();
      meldung('Eingetragen. Nicht doppelt nehmen – heute wie gewohnt.');
      break;
    case 'einnahme-setzen': {
      // Aus der Einnahmen-Liste: ein Tag umschalten.
      const tag = el.dataset.tag;
      const wert = el.dataset.wert;
      if (!istISO(tag)) break;
      sp.einnahmeSetzen(tag, wert === 'genommen' ? { uhr: '' } : wert === 'nicht' ? null : undefined);
      render();
      break;
    }
    case 'befinden': {
      const stufe = el.dataset.stufe;
      sp.aendern((s) => {
        const da = s.befinden.find((b) => b.datum === heute);
        if (da) da.stufe = stufe;
        else s.befinden.push({ id: sp.kennung(), datum: heute, stufe, beschwerden: [], notiz: '' });
        s.befinden.sort((a, b) => a.datum.localeCompare(b.datum));
      });
      render();
      break;
    }
    case 'loeschen': {
      if (!window.confirm('Diesen Eintrag wirklich löschen?')) break;
      eintragLoeschen(el.dataset.art, el.dataset.id);
      zurueck();
      meldung('Gelöscht');
      break;
    }
    case 'frage-erledigt': {
      const id = el.dataset.id;
      let erledigt = null;
      sp.aendern((s) => {
        const f = s.fragen.find((x) => x.id === id);
        if (f) { f.erledigt = !f.erledigt; erledigt = f.erledigt; }
      });
      render();
      // Die Frage springt dabei ans Ende unter „Besprochen" – ohne ein Wort
      // sah das aus, als sei sie verschwunden (Runde 4: E14).
      if (erledigt !== null) meldung(erledigt ? 'Als besprochen markiert – steht jetzt unten unter „Besprochen"' : 'Wieder offen');
      break;
    }
    case 'behandelt':
      // P6: bestätigt, dass eine Unterfunktion mit Tabletten behandelt wird.
      sp.aendern((s) => { s.profil.behandelt = true; });
      render();
      meldung('Eingeschaltet: Die App ordnet Ihre Werte jetzt ein.');
      break;
    case 'frage-antwort':
      frageBeantworten(el.dataset, heute);
      break;
    case 'praxis-entscheid': {
      // D6b: Die Entscheidung der Praxis gilt – mit Datum am Befund.
      // „Noch nichts entschieden" nimmt eine frühere Angabe zurück, mit Datum
      // wie F8 „Noch nicht" (Runde 4: E1).
      const wert = el.dataset.wert;
      if (!['bleibt', 'geaendert', 'nachmessen', 'nochnicht'].includes(wert)) break;
      let vorher = null;
      sp.aendern((s) => {
        const b = s.labor.find((l) => l.id === el.dataset.id);
        if (b) {
          vorher = { befund: b.id, praxis: b.praxis, praxisAm: b.praxisAm };
          /*
           * Runde 6: G5 – Eine Entscheidung, die schon gilt, behält ihr Datum,
           * wie im Befund-Formular. Ein erneuter Tipp auf „Neue Dosis
           * eintragen" machte aus der Entscheidung vom 07.09. eine von heute –
           * und damit die schon eingetragene neue Dosis zu einer, die vor der
           * Entscheidung begann. „Noch nichts entschieden" ist dagegen eine
           * Angabe über heute (wie F8 „Noch nicht") und bekommt das Datum neu.
           * Der Haken „Es gilt, was die Praxis gesagt hat" auf der Karte
           * gehört zum Tag der Entscheidung und kommt bei einem erneuten Tipp
           * nicht wieder; die Meldung nach dem Tipp bestätigt ihn trotzdem.
           */
          if (b.praxis !== wert || !b.praxisAm || wert === 'nochnicht') b.praxisAm = heute;
          b.praxis = wert;
        }
      });
      if (wert === 'geaendert') {
        zeigeSeite('dosis', 'praxis', { ersetzen: true });
        // Für die Rückfrage beim Verlassen ohne Dosis (praxisNachfrage).
        if (vorher) ui.seite.praxisVorher = vorher;
      } else {
        zurueck();
      }
      meldung(wert === 'geaendert' ? PRAXIS_NEUE_DOSIS : wert === 'nochnicht' ? PRAXIS_NOCH_NICHT : PRAXIS_BESTAETIGUNG);
      break;
    }
    case 'ziel-bestaetigt':
      // R12: Die Praxis hat den Zielbereich bestätigt – das Datum wird neu,
      // der Zielbereich selbst bleibt. Ohne Zielbereich gibt es nichts zu bestätigen.
      sp.aendern((s) => {
        if (s.profil.zielVon !== null || s.profil.zielNiedrig === 'ja') s.profil.zielAm = heute;
      });
      render();
      meldung('Vermerkt: Die Praxis hat den Zielbereich heute bestätigt.');
      break;
    case 'notfall-jetzt': {
      // R2: sofort der 112-Text, ohne zu speichern und ohne die Eingaben zu verlieren.
      const huelle = document.getElementById('notfall-jetzt-huelle');
      const karte = document.getElementById('notfall-jetzt');
      if (!huelle || !karte) break;
      huelle.hidden = false;
      karte.scrollIntoView({ block: 'start' });
      karte.focus({ preventScroll: true });
      break;
    }
    case 'befund-bestaetigen':
      // Erst, wenn die Rückfrage wirklich zu sehen war (Runde 4: E2).
      if (rueckfrage && rueckfrage.bereit) rueckfrageSchliessen(true);
      break;
    case 'befund-korrigieren':
      rueckfrageSchliessen(false);
      break;
    case 'auswahl':
      if (auswahl && auswahl.bereit) auswahlFertig(el.dataset.wert);
      break;
    case 'fragen-uebernehmen': {
      const neu = fragenVorschlaege(stand, heute).filter((t) => !stand.fragen.some((f) => f.text === t));
      sp.aendern((s) => { neu.forEach((t) => s.fragen.push({ id: sp.kennung(), text: t, erledigt: false })); });
      meldung(neu.length ? `${neu.length === 1 ? 'Eine Frage' : `${neu.length} Fragen`} zu „Meine Fragen" hinzugefügt` : 'Die Fragen stehen schon unter „Meine Fragen"');
      break;
    }
    case 'frage-loeschen':
      if (!window.confirm('Diese Frage wirklich löschen?')) break;
      sp.aendern((s) => { s.fragen = s.fragen.filter((x) => x.id !== el.dataset.id); });
      render();
      meldung('Frage gelöscht');
      break;
    case 'schrift':
      sp.aendern((s) => { s.einstellungen.schrift = el.dataset.wert; });
      render();
      break;
    case 'farbe':
      sp.aendern((s) => { s.einstellungen.farbe = el.dataset.wert; });
      render();
      break;
    case 'hinweis-erlauben':
      hinweisErlauben();
      break;
    case 'hinweis-aus':
      sp.aendern((s) => { s.einstellungen.hinweisTablette = false; });
      render();
      break;
    case 'ics-erinnerung':
      herunterladen('schilddruese-erinnerung.ics', erinnerungICS({ abISO: heute, uhr: stand.einstellungen.erinnerung }), 'text/calendar');
      meldung('Kalenderdatei erzeugt – bitte öffnen und in den Kalender übernehmen', 4500);
      break;
    case 'ics-termin': {
      const t = stand.termine.find((x) => x.id === el.dataset.id);
      if (!t) break;
      const abnahme = t.art === 'labor' || Boolean(t.blutabnahme);
      /*
       * Mit Blutabnahme steht die Tablette schon im Titel. Am Morgen der
       * Abnahme klingelten um 7 Uhr „Schilddrüsentablette nehmen – Nüchtern,
       * mit einem Glas Wasser" und „Blutabnahme Schilddrüse"; dass die
       * Tablette warten muss, sagte nur die Erinnerung am Vortag. Der Alarm
       * eine Stunde vorher zeigt nur den Titel – iOS ohnehin nur ihn, und
       * Google Kalender übernimmt beim Einlesen keine eigenen Alarme (RW1
       * L0d, Runde 4: E27).
       */
      const art = t.art === 'labor' ? 'Blutabnahme Schilddrüse' : t.art === 'arzt' ? 'Arzttermin Schilddrüse' : 'Termin';
      const titel = !abnahme ? art : t.art === 'labor' ? `${art} – Tablette erst danach` : `${art} mit Blutabnahme – Tablette erst danach`;
      herunterladen(`termin-${t.datum}.ics`, terminICS({
        id: t.id, datum: t.datum, uhr: t.uhr, titel: t.wo ? `${titel} – ${t.wo}` : titel,
        notiz: [abnahme ? 'Tablette wie mit der Praxis besprochen – meist erst nach der Blutabnahme.' : '', t.notiz].filter(Boolean).join('\n'),
        blutabnahme: abnahme,
        biotin: stand.mittel.includes('biotin'),
      }), 'text/calendar');
      meldung('Kalenderdatei erzeugt', 3000);
      break;
    }
    case 'sicherung-speichern':
      sicherungSpeichern();
      break;
    case 'sicherung-laden':
      document.getElementById('sicherungDatei')?.click();
      break;
    case 'sicherung-zurueck':
      // Zurückholen ersetzt alles, was seit dem Einlesen eingetragen wurde –
      // „zurückholen" klingt aber nach „meine Daten wiederherstellen".
      if (!window.confirm('Den Stand von vor dem Einlesen zurückholen? Alles, was seitdem eingetragen wurde, geht dabei verloren.')) break;
      if (sp.importZurueck()) {
        // War der Stand von vorher eine unfertige Einrichtung, beginnt sie von
        // vorn – wie nach „Alles löschen". Vorher blieb die Seite „Sicherung"
        // stehen und öffnete sich nach „Fertig – zur App" statt „Heute"
        // (Runde 5: F22, wie C19).
        if (!sp.getStand().profil.begruesst) {
          ui.seite = null;
          ui.stapel = [];
          ui.tab = 'heute';
          ui.schritt = 1;
          ui.entwurf = {};
          window.scrollTo(0, 0);
        }
        meldung('Vorheriger Stand ist wieder da');
        render();
      } else meldung('Kein vorheriger Stand vorhanden');
      break;
    case 'alles-loeschen':
      if (window.confirm('Wirklich alle Daten dieser App löschen? Dosis, Einnahmen, Laborwerte, alles.')
        && window.confirm('Letzte Frage: Alles löschen? Das lässt sich nur mit einer Sicherung rückgängig machen.')) {
        sp.allesLoeschen();
        ui.seite = null;
        ui.stapel = [];
        ui.tab = 'heute';
        ui.schritt = 1;
        ui.entwurf = {};
        render();
        meldung('Alles gelöscht');
      }
      break;
    case 'bericht-kopieren':
      berichtKopieren();
      break;
    case 'bericht-teilen':
      berichtTeilen();
      break;
    case 'bericht-drucken':
      window.print();
      break;
    case 'willkommen-weiter': {
      const form = el.closest('form');
      const ergebnis = willkommenWeiter(ui.schritt, form, heute);
      // Eine ungewöhnliche Stärke („7,5" statt „75"): dieselbe Rückfrage wie
      // beim Befund. „Ja, stimmt" schickt den Schritt mit bestaetigt=ja noch
      // einmal ab (Runde 4: E10). `fehler` ist nur der Rückfall ohne Dialog.
      if (!ergebnis.ok && ergebnis.rueckfragen) {
        rueckfrageZeigen(form, ergebnis.rueckfragen, { satz: ergebnis.rueckfrageSatz, feld: ergebnis.rueckfrageFeld });
        break;
      }
      if (!ergebnis.ok) { zeigeFehler(form, ergebnis.fehler); break; }
      // Gespeichert – ab jetzt gilt der Stand, nicht ein alter Entwurf.
      delete ui.entwurf[ui.schritt];
      sperren();
      if (ui.schritt >= WILLKOMMEN_SCHRITTE) {
        sp.aendern((s) => {
          s.profil.begruesst = true;
          if (!s.profil.seit) s.profil.seit = heute;
        });
        ui.schritt = 1;
        ui.entwurf = {};
        ui.tab = 'heute';
        // „Fertig – zur App" führt zu „Heute" (B64, E3) – auch wenn die
        // Einrichtung aus einer offenen Seite heraus kam, etwa nach dem
        // Zurückholen eines unfertigen Stands unter „Sicherung" (Runde 5: F22).
        ui.seite = null;
        ui.stapel = [];
        window.scrollTo(0, 0);
        render();
        $ansicht.focus({ preventScroll: true });
        meldung('Fertig eingerichtet');
      } else {
        ui.schritt++;
        window.scrollTo(0, 0);
        render();
        $ansicht.focus({ preventScroll: true });
      }
      break;
    }
    case 'willkommen-zurueck':
      willkommenZurueck();
      break;
    default:
      break;
  }
}

/*
 * Willkommen: einen Schritt zurück. „Zurück" speichert nichts – die Felder
 * dieses Schritts bleiben als Entwurf, bis „Weiter" sie speichert. Vorher
 * waren in Schritt 2 danach die Stärke leer und „Seit wann?" still wieder
 * heute; wer nur die Stärke neu eintippte, hatte die Dosis ab heute
 * (Runde 4: E12). Auch für die Zurück-Taste des Handys (E5).
 */
function willkommenZurueck(schritte = 1) {
  if (ui.schritt <= 1) return;
  const form = $ansicht.querySelector('form');
  if (form) ui.entwurf[ui.schritt] = willkommenEntwurf(form);
  rueckfrageSchliessen(null);
  ui.schritt = Math.max(1, ui.schritt - schritte);
  sperren();
  window.scrollTo(0, 0);
  render();
  $ansicht.focus({ preventScroll: true });
}

/*
 * Welche Felder eine Frage setzen darf, mit den Antworten, die es gibt (wie
 * in speicher.normStand). Vorher genügte „das Feld steht schon als Text da":
 * Ein Befund, der in dieser Sitzung angelegt wurde, hatte `verwechselt` noch
 * nicht – das legt normStand erst beim nächsten Laden an. Die Antwort auf Q5
 * fiel still weg, die Meldung sagte trotzdem „gespeichert", die Frage kam
 * immer wieder, und „einmal viele Tabletten" brachte nie den Giftnotruf (B39).
 */
const JNW_ANTWORT = ['ja', 'nein', 'unbekannt'];
const BEFUND_ANTWORTEN = {
  vorAbnahme: JNW_ANTWORT,
  biotin: JNW_ANTWORT,
  krank: JNW_ANTWORT,
  kortison: JNW_ANTWORT,
  kontrastmittel: JNW_ANTWORT,
  mittelGeaendert: JNW_ANTWORT,
  einnahmeGeaendert: JNW_ANTWORT,
  packung: JNW_ANTWORT,
  abstandOk: JNW_ANTWORT,
  vergessen: ['nein', 'einzelne', 'mehrere', 'unbekannt'],
  einnahmeArt: ['ja', 'abends', 'nein', 'unbekannt'],
  verwechselt: ['einmal', 'tage', 'nein', 'unbekannt'],
  praxis: ['bleibt', 'geaendert', 'nachmessen', 'nochnicht'],
};
const PROFIL_ANTWORTEN = {
  krebs: JNW_ANTWORT,
  kortison: JNW_ANTWORT,
  hypophyseOderNiedrig: JNW_ANTWORT,
  herz: JNW_ANTWORT,
  osteoporose: JNW_ANTWORT,
  diabetes: JNW_ANTWORT,
  zielNiedrig: JNW_ANTWORT,
};

/*
 * Eine Frage der Dosis-Karte oder von „Heute" beantworten. Wohin die Antwort
 * gehört, sagt die Frage selbst (js/dosis.js): an den Befund, ins Profil
 * oder als Nachfrage mit Datum. Danach zeichnet die Karte neu – mit der
 * nächsten Frage oder der Richtung –, und der Fokus steht auf der Karte, damit
 * ein Vorleseprogramm die neue Frage vorliest und nicht einen gleich
 * beschrifteten Knopf.
 */
function frageBeantworten({ ziel, feld, bezug, wert }, heute) {
  let geschrieben = false;
  let praxisVorher = null;
  if (/^[a-z0-9_]{1,20}$/i.test(wert || '') && /^[A-Za-z0-9_]{1,30}$/.test(feld || '')) {
    sp.aendern((s) => {
      if (ziel === 'befund') {
        const b = s.labor.find((l) => l.id === bezug);
        if (!b || !(BEFUND_ANTWORTEN[feld] || []).includes(wert)) return;
        if (feld === 'praxis') praxisVorher = { befund: b.id, praxis: b.praxis, praxisAm: b.praxisAm };
        b[feld] = wert;
        if (feld === 'praxis') b.praxisAm = heute;
        geschrieben = true;
      } else if (ziel === 'profil') {
        if (!(PROFIL_ANTWORTEN[feld] || []).includes(wert)) return;
        s.profil[feld] = wert;
        geschrieben = true;
      } else if (ziel === 'nachfrage') {
        const art = feld.toLowerCase();
        const zu = String(bezug || '').slice(0, 40);
        // Eine Antwort „Nein, ich nehme etwas anderes" zu einem früheren Befund
        // ist mit der Antwort zum neuen erledigt. Blieb sie liegen, machte sie
        // die nächste Dosisänderung zur „Berichtigung" – ohne Kontrolle und
        // ohne Nachfrage nach einer Erhöhung (C17).
        if (art === 'dosis_stimmt') s.nachfragen = s.nachfragen.filter((n) => !(n.art === 'dosis_stimmt' && n.bezug !== zu && /^nein/.test(n.antwort)));
        // Runde 6 – Rest (W-D4-Art): Die Antwort auf W-D4 merkt sich, wonach
        // gefragt wurde – nach einer Erhöhung oder einer Senkung. Später aus
        // den Einträgen gelesen, machte ein nachgetragener Eintrag davor aus
        // „Herzklopfen seit der Erhöhung: Ja" ein „müder seit der Senkung".
        const aenderung = art === 'wd4' ? wd4FrageArt(s, heute, zu) : null;
        s.nachfragen.push({ id: sp.kennung(), art, bezug: zu, antwort: wert, am: heute, ...(aenderung ? { aenderung } : {}) });
        geschrieben = true;
      }
    });
  }
  // Nicht still neu zeichnen, als wäre alles gut: Die Frage stünde sonst
  // einfach wieder da, und niemand wüsste warum.
  if (!geschrieben) {
    render();
    meldung('Die Antwort ließ sich nicht speichern. Bitte laden Sie die Seite neu und antworten Sie noch einmal.');
    return;
  }
  // F8 „Die Dosis wird geändert" auf der Dosis-Karte: wie „Die Praxis hat
  // entschieden → Neue Dosis eintragen" gleich das Formular, mit „auf
  // Anweisung der Praxis: ja". Ohne den Eintrag gab es weder die Erinnerung
  // an die Kontrolle (D6c) noch INR (WW1) oder Blutzucker (WW2) (B27, B46).
  // Die Karte bleibt darunter liegen – nach dem Speichern geht es zu ihr zurück.
  if (ziel === 'befund' && feld === 'praxis' && wert === 'geaendert') {
    zeigeSeite('dosis', 'praxis');
    // Verlässt sie das Formular ohne Dosis, fragt die App nach (Runde 4: E1).
    if (praxisVorher) ui.seite.praxisVorher = praxisVorher;
    meldung(PRAXIS_NEUE_DOSIS);
    return;
  }
  render();
  const karte = document.getElementById('dosis-karte');
  if (karte) {
    // Auf der Dosis-Karte zeichnet sich die Karte sichtbar neu – mit der
    // nächsten Frage oder der Richtung. Die Meldung unten deckte dort sonst
    // sekundenlang Zeilen des Pflichttexts ab (B60).
    karte.scrollIntoView({ block: 'start' });
    karte.focus({ preventScroll: true });
  } else {
    meldung('Antwort gespeichert');
  }
}

/*
 * Die Rückfrage beim Befund (einheiten.befundPruefen): ein Dialog im Stil der
 * App mit den ungewöhnlichen Werten. „Ja, stimmt" speichert mit Bestätigung,
 * „Korrigieren" führt zurück ins Formular – die Eingaben bleiben stehen.
 * Dieselbe Rückfrage bei einer ungewöhnlichen Stärke (Dosis, Einrichten):
 * dann mit eigenem Satz („… auf der Packung?") und dem Feld, zu dem
 * „Korrigieren" führt (Runde 4: E10).
 *
 * Die Knöpfe sind die ersten 0,6 Sekunden gesperrt, und der Fokus steht auf
 * der Überschrift. Vorher lag „Ja, stimmt" bei Schrift „sehr groß" genau dort,
 * wo eben „Speichern" war, schon mit Fokus: Ein ungeduldiger zweiter Tipp
 * bestätigte TSH 0,21 statt 2,1 ungelesen, und die Karte leitete daraus eine
 * Richtung ab (Runde 4: E2). Gesperrte Knöpfe nehmen keinen Tipp an – wer
 * liest, merkt davon nichts.
 */
const FREIGABE_MS = 600;
let rueckfrage = null;   // { dialog, form, feld, bereit }
let auswahl = null;      // { dialog, wahl, bereit } – eine Rückfrage mit eigenen Antworten

/** Den Dialog bauen und zeigen. knoepfe: [{ text, klasse, act, wert }] → der Dialog. */
function dialogZeigen({ titel, punkte = [], satz = '', knoepfe, art, abbrechen }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'rueckfrage';
  if (art) dialog.dataset.frage = art;
  dialog.setAttribute('aria-labelledby', 'rueckfrage-titel');
  const h = document.createElement('h2');
  h.id = 'rueckfrage-titel';
  h.tabIndex = -1;
  h.textContent = titel;
  dialog.append(h);
  if (punkte.length) {
    const ul = document.createElement('ul');
    punkte.forEach((t) => { const li = document.createElement('li'); li.textContent = t; ul.appendChild(li); });
    dialog.append(ul);
  }
  if (satz) {
    const p = document.createElement('p');
    p.textContent = satz;
    dialog.append(p);
  }
  const reihe = document.createElement('div');
  reihe.className = 'knopf-reihe';
  const liste = knoepfe.map(({ text, klasse, act, wert }) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = klasse;
    b.dataset.act = act;
    if (wert) b.dataset.wert = wert;
    b.textContent = text;
    b.disabled = true;
    reihe.appendChild(b);
    return b;
  });
  dialog.append(reihe);
  // Escape (und die Zurück-Taste, wo der Browser sie dem Dialog gibt) heißt „nicht so".
  dialog.addEventListener('cancel', (e) => { e.preventDefault(); abbrechen(); });
  document.body.appendChild(dialog);
  if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', '');
  h.focus();
  return { dialog, freigeben: (fertig) => setTimeout(() => { liste.forEach((b) => { b.disabled = false; }); fertig(); }, FREIGABE_MS) };
}

/*
 * Runde 6: G11 – `ja`, `nein`, `name`: eigene Knopftexte und ein eigenes
 * Bestätigungsfeld. Die Frage des Dosis-Formulars „Haben Sie das nie
 * genommen?" beantwortet „Ja, stimmt" schlecht, und ihre Bestätigung
 * (nieGenommen=ja) darf die Rückfrage zur Stärke nicht mit abhaken – die
 * kommt danach noch, mit „bestaetigt".
 */
function rueckfrageZeigen(form, fragen, { satz = '', feld = '', ja = '', nein = '', name = '' } = {}) {
  rueckfrageSchliessen(null);
  const { dialog, freigeben } = dialogZeigen({
    titel: 'Bitte prüfen',
    punkte: fragen,
    satz: satz || 'Steht es genau so auf dem Befund?',
    knoepfe: [
      { text: ja || 'Ja, stimmt', klasse: 'knopf knopf-haupt', act: 'befund-bestaetigen' },
      { text: nein || 'Korrigieren', klasse: 'knopf', act: 'befund-korrigieren' },
    ],
    abbrechen: () => rueckfrageSchliessen(false),
  });
  const r = { dialog, form, feld, name: /^[a-z]\w{0,30}$/i.test(name) ? name : 'bestaetigt', kennung: form ? formKennung(form) : '', bereit: false };
  rueckfrage = r;
  freigeben(() => { r.bereit = true; });
}

/** true: bestätigt speichern · false: zurück ins Formular · null: nur schließen. */
function rueckfrageSchliessen(bestaetigt) {
  if (!rueckfrage) return;
  const { dialog, form: gefragt, feld: feldName, kennung, name: bestaetigtName } = rueckfrage;
  rueckfrage = null;
  if (dialog.open && dialog.close) dialog.close();
  dialog.remove();
  /*
   * Runde 6: G3 – Wurde die Seite unter der Rückfrage neu gezeichnet, hing sie
   * an einem Formular, das es nicht mehr gab: „Ja, stimmt" schloss nur den
   * Dialog, gespeichert wurde nichts, und niemand erfuhr es. Das neue
   * Formular trägt dieselbe Kennung und die getippten Werte (F21) – dann
   * gilt es. Gibt es keines, sagt es eine Meldung.
   */
  const form = gefragt && gefragt.isConnected ? gefragt
    : [...$ansicht.querySelectorAll(FORMULARE)].find((f) => formKennung(f) === kennung) || null;
  if (bestaetigt === true && !form) {
    meldung('Die Seite hat sich inzwischen geändert – gespeichert wurde nichts. Bitte prüfen Sie Ihre Angaben noch einmal.');
    return;
  }
  if (bestaetigt === true) {
    let feld = form.querySelector(`input[name="${bestaetigtName}"]`);
    if (!feld) {
      feld = document.createElement('input');
      feld.type = 'hidden';
      feld.name = bestaetigtName;
      form.appendChild(feld);
    }
    feld.value = 'ja';
    form.requestSubmit();
  } else if (bestaetigt === false && form) {
    // „Korrigieren" führt zum Feld, um das es geht – bei der Stärke also
    // dorthin, nicht zum ersten Laborwert.
    const erstes = (feldName && form.querySelector(`[name="${CSS.escape(feldName)}"]`)) || form.querySelector('input[name$="_wert"]');
    if (erstes) {
      erstes.scrollIntoView({ block: 'center' });
      erstes.focus({ preventScroll: true });
    }
  }
}

/** Eine Rückfrage mit eigenen Antworten; `wahl(wert)` bekommt die Antwort, null bei Escape. */
function auswahlZeigen({ titel, satz, knoepfe, art }, wahl) {
  auswahlFertig(null);
  const { dialog, freigeben } = dialogZeigen({
    titel, satz, art, knoepfe: knoepfe.map(([wert, text, klasse]) => ({ text, klasse, act: 'auswahl', wert })), abbrechen: () => auswahlFertig(null),
  });
  const a = { dialog, wahl, bereit: false };
  auswahl = a;
  freigeben(() => { a.bereit = true; });
}

function auswahlFertig(wert) {
  if (!auswahl) return;
  const { dialog, wahl } = auswahl;
  auswahl = null;
  if (dialog.open && dialog.close) dialog.close();
  dialog.remove();
  wahl(wert || null);
}

/*
 * „Neue Dosis eintragen" (Die Praxis hat entschieden) und F8 „Ja: Die Dosis
 * wird geändert" speichern die Angabe sofort, erst danach öffnet sich das
 * Formular. „Abbrechen" nahm sie nicht zurück: Nach einem Fehltipp galt der
 * Befund als von der Praxis erklärt – „Heute" schwieg zu TSH < 0,01 und fT4
 * 2,1 ng/dl monatelang, und ohne Dosis-Eintrag kam nie eine Erinnerung an die
 * Kontrolle (Runde 4: E1). Wer dieses Formular ohne Dosis verlässt, wird
 * deshalb gefragt. „Nein" stellt die Angabe von vorher wieder her; war dort
 * nichts entschieden, gilt „Noch nichts entschieden" mit dem Datum von heute
 * (wie F8 „Noch nicht"). Die Frage deckt auch ungespeicherte Eingaben ab
 * („… noch nicht eingetragen"), und „Zurück zum Formular" bleibt.
 */
const PRAXIS_ENTSCHIEDEN = { bleibt: 'Die Dosis bleibt so', nachmessen: 'Erst nachmessen' };

/*
 * Runde 6: G5 – nur, solange nach dem Befund noch keine Dosis eingetragen ist
 * (wie dosisNach in js/dosis.js). Vorher fragte die App auch dann „Die neue
 * Dosis ist noch nicht eingetragen", wenn 88 µg seit drei Wochen dastanden –
 * und „Nein, noch nichts entschieden" löschte die Entscheidung der Praxis,
 * der Bericht widersprach sich danach.
 */
function praxisNochGeaendert(vorher) {
  const st = sp.getStand();
  const b = st.labor.find((l) => l.id === vorher.befund);
  if (!b || b.praxis !== 'geaendert') return false;
  // Erledigt ist die Bitte nur mit einer neuen Menge „auf Anweisung der
  // Praxis" – nicht schon mit irgendeinem Eintrag nach dem Befund. Eine
  // eigene Änderung oder eine Berichtigung ist nicht die Dosis der Praxis;
  // sonst senkte ein Fehltipp mit „Abbrechen" die Dringlichkeit ohne jede
  // Rückfrage (Nachprüfung zu G5).
  return !st.dosen.some((d, i) => i > 0 && d.ab > b.datum && d.praxis === true && !d.berichtigung
    && aenderungsArt(d, st.dosen[i - 1]) === 'dosis');
}

function praxisNachfrage(vorher, weiter) {
  const entschieden = PRAXIS_ENTSCHIEDEN[vorher.praxis] || null;
  auswahlZeigen({
    art: 'praxis',
    titel: 'Hat die Praxis Ihre Dosis schon geändert?',
    satz: 'Die neue Dosis ist noch nicht eingetragen.',
    knoepfe: [
      ['spaeter', 'Ja – ich trage sie später ein', 'knopf knopf-breit'],
      ['nein', entschieden ? `Nein – es gilt weiter: ${entschieden}` : 'Nein, noch nichts entschieden', 'knopf knopf-breit'],
      ['bleiben', 'Zurück zum Formular', 'knopf knopf-leise knopf-breit'],
    ],
  }, (wahl) => {
    if (wahl === 'spaeter') {
      weiter();
      meldung('Vermerkt: Die Praxis hat die Dosis geändert. Bitte tragen Sie die neue Dosis ein, sobald Sie sie kennen.');
    } else if (wahl === 'nein') {
      const heute = heuteISO();
      const zurueckAuf = entschieden || vorher.praxis === 'nochnicht'
        ? { praxis: vorher.praxis, praxisAm: vorher.praxisAm }
        : { praxis: 'nochnicht', praxisAm: heute };
      sp.aendern((s) => {
        const b = s.labor.find((l) => l.id === vorher.befund);
        if (b && b.praxis === 'geaendert') Object.assign(b, zurueckAuf);
      });
      weiter();
      meldung(entschieden ? `Zurückgenommen – es gilt weiter: ${entschieden}.` : PRAXIS_NOCH_NICHT);
    } else {
      // Bleiben: Nach der Zurück-Taste steht die Seite wieder im Verlauf.
      verlaufAbgleichen();
      const feld = $ansicht.querySelector('form[data-formular="dosis"] [name="mikrogramm"]');
      if (feld) {
        feld.scrollIntoView({ block: 'center' });
        feld.focus({ preventScroll: true });
      }
    }
  });
}

/*
 * Runde 5: F3 – Der Fehler gehört zum Feld, auch für Vorleseprogramme: Das
 * Feld (bei Auswahlknöpfen ihre Gruppe) trägt aria-invalid und nennt den
 * Fehlertext über aria-describedby. Vorher meldete das Feld „gültig", und wer
 * wieder auf das Feld wischte, erfuhr nicht, was falsch war. Der Text steht
 * hinter dem Label, nicht darin – sonst läse WebKit ihn als Teil des Namens.
 * Der erste Fehler bekommt den Fokus und wird so mit dem Feld angesagt; eine
 * zusätzliche Alarm-Ansage würde von der Fokus-Ansage ohnehin verdrängt. Jeder
 * weitere Fehler (etwa „Hat die Praxis diese Dosis angeordnet?" neben der
 * leeren Stärke) bleibt eine Alarm-Ansage.
 */
function fehlerMarkeWeg(form) {
  form.querySelectorAll('[data-fehler-marke]').forEach((el) => {
    el.removeAttribute('aria-invalid');
    const rest = (el.getAttribute('aria-describedby') || '').split(/\s+/).filter((id) => id && !id.startsWith('fehler-'));
    if (rest.length) el.setAttribute('aria-describedby', rest.join(' '));
    else el.removeAttribute('aria-describedby');
    el.removeAttribute('data-fehler-marke');
  });
}

/**
 * Fehler am Feld zeigen, ohne die Eingaben zu verlieren. Ein Fehler ist ein
 * Text – oder { text, knopf: { seite, param, text } }, wenn der Weg zur Lösung
 * auf einer anderen Seite liegt (etwa: den vorhandenen Eintrag öffnen).
 */
function zeigeFehler(form, fehler) {
  if (!form) return;
  form.querySelectorAll('.feld-fehler').forEach((f) => f.remove());
  form.querySelectorAll('.feld.fehlt').forEach((f) => f.classList.remove('fehlt'));
  fehlerMarkeWeg(form);
  let erstes = null;
  Object.entries(fehler || {}).forEach(([name, eintrag]) => {
    const { text, knopf } = typeof eintrag === 'string' ? { text: eintrag, knopf: null } : eintrag;
    const feld = form.querySelector(`[name="${CSS.escape(name)}"]`);
    const huelle = feld ? feld.closest('.feld') : form.querySelector(`[data-feld="${CSS.escape(name)}"]`);
    const ziel = huelle || form;
    if (huelle) huelle.classList.add('fehlt');
    const p = document.createElement('p');
    p.className = 'feld-fehler';
    p.id = `fehler-${String(name).replace(/[^\w-]/g, '_')}`;
    p.textContent = text;
    // Wer den Fehler trägt: das Feld selbst, bei Auswahlknöpfen und Haken
    // ihre Gruppe. Ohne Feld nur die Hülle – und die nur mit Beschreibung.
    const gruppe = feld && ['radio', 'checkbox'].includes(feld.type) ? feld.closest('[role="radiogroup"], [role="group"]') : null;
    const traeger = gruppe || (feld && !['radio', 'checkbox'].includes(feld.type) ? feld : null);
    const beschrieben = traeger || huelle;
    if (beschrieben) {
      const ids = (beschrieben.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
      beschrieben.setAttribute('aria-describedby', [...ids, p.id].join(' '));
      beschrieben.setAttribute('data-fehler-marke', '');
    }
    if (traeger) traeger.setAttribute('aria-invalid', 'true');
    // Nur der erste Fehler, dessen Feld selbst den Text nennt und den Fokus
    // bekommt, kommt ohne Alarm aus.
    const mitFokus = !erstes && feld && traeger === feld;
    if (!mitFokus) p.setAttribute('role', 'alert');
    if (knopf) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'knopf knopf-klein';
      b.dataset.act = 'seite';
      b.dataset.seite = knopf.seite;
      if (knopf.param) b.dataset.param = knopf.param;
      b.textContent = knopf.text;
      p.append(document.createElement('br'), b);
    }
    if (huelle && huelle.tagName === 'LABEL') {
      // Dicht unter das Feld: Das Label hat unten Abstand zum nächsten Feld.
      p.style.margin = '-.6rem 0 .9rem';
      huelle.after(p);
    } else {
      ziel.appendChild(p);
    }
    if (!erstes) erstes = feld || ziel;
  });
  if (erstes) {
    erstes.scrollIntoView({ block: 'center' });
    if (erstes.focus) erstes.focus({ preventScroll: true });
  }
}

document.addEventListener('click', (e) => {
  const reiter = e.target.closest('[data-reiter]');
  if (reiter && $reiter.contains(reiter)) {
    // Ein Reiter verlässt die offene Seite – mit Rückfrage, wenn Eingaben
    // verloren gingen (Runde 4: E5).
    verlassen(() => zeigeReiter(reiter.dataset.reiter));
    return;
  }
  const el = e.target.closest('[data-act]');
  if (!el) return;
  // Ein Knopf im Formular darf es nicht abschicken.
  if (el.tagName === 'BUTTON' && !el.getAttribute('type')) el.setAttribute('type', 'button');
  const merkmal = fokusMerkmal(el);
  aktion(el);
  /*
   * Runde 5: F18 – Jede Aktion sperrt den zweiten Tipp an derselben Stelle
   * wie ein Seitenwechsel (E3). Auch was an Ort und Stelle neu zeichnet, legt
   * neue Knöpfe unter den Finger: Ein Doppeltipp auf „Ja, ich werde … behandelt"
   * beantwortete auf der Dosis-Karte ungelesen „Hat die Praxis zu diesem Wert
   * schon etwas gesagt?" mit „Erst nachmessen" – danach schwiegen Karte und
   * „Heute" zur Anruf-Frist. Ebenso sprang ein doppeltes „Nein" über die
   * nächste Frage („schwer krank?"), und unter „Meine Fragen" wurde die
   * nachrückende Frage mit abgehakt. Hier, im selben Klick, ist der letzte
   * Druck noch der dieses Tipps. Notrufnummern (tel:) bleiben immer frei.
   */
  sperren();
  fokusZurueck(merkmal);
});

/*
 * Nach einem Tipp zeichnet die App die Ansicht neu – und der Knopf, der den
 * Fokus hatte, ist ein anderer Knoten. Ohne diese beiden Funktionen stand der
 * Fokus danach auf <body>: Ein Vorleseprogramm verlor die Stelle und sagte
 * nichts an, wer mit der Tastatur bedient, fing oben neu an. Wo die Aktion
 * selbst den Fokus setzt (neue Seite, Zurück), bleibt es dabei.
 */
function fokusMerkmal(el) {
  const d = el.dataset;
  const teile = [`[data-act="${d.act}"]`];
  ['stufe', 'wert', 'tag', 'id', 'seite', 'param'].forEach((k) => {
    if (d[k] !== undefined) teile.push(`[data-${k}="${CSS.escape(d[k])}"]`);
  });
  return teile.join('');
}

function fokusZurueck(merkmal) {
  if (document.activeElement && document.activeElement !== document.body) return;
  const ziel = document.querySelector(merkmal) || $ansicht;
  ziel.focus({ preventScroll: true });
}

document.addEventListener('submit', (e) => {
  const form = e.target;
  // Jedes Formular hier wird von Hand ausgewertet. Ohne das lädt die Eingabe-
  // taste in einem Feld ohne eigenes Formular (Willkommen, Einnahmezeit) die
  // Seite neu, mit den Eingaben in der Adresszeile.
  e.preventDefault();
  if (!form.dataset.formular) {
    const weiter = form.querySelector('[data-act="willkommen-weiter"]');
    if (weiter) aktion(weiter);
    return;
  }
  const ergebnis = absenden(form.dataset.formular, form.dataset.id || null, form, heuteISO());
  if (!ergebnis.ok && ergebnis.rueckfragen) {
    // Eigene Knöpfe und eigenes Bestätigungsfeld: „nie genommen?" (Runde 6: G11).
    rueckfrageZeigen(form, ergebnis.rueckfragen, {
      satz: ergebnis.rueckfrageSatz, feld: ergebnis.rueckfrageFeld, ja: ergebnis.rueckfrageJa, nein: ergebnis.rueckfrageNein, name: ergebnis.rueckfrageName,
    });
    return;
  }
  // Ein Fehler rollt das Feld in die Mitte – unter dem Finger liegt dann
  // etwas anderes als „Speichern" (Runde 5: F18, wie E3).
  if (!ergebnis.ok) { zeigeFehler(form, ergebnis.fehler); sperren(); return; }
  nachDemSpeichern(ergebnis.danach);
  meldung(ergebnis.meldung || 'Gespeichert');
});

/*
 * Die Eingabetaste in den Willkommensschritten: „Weiter". Ein Formular ohne
 * Absende-Knopf schickt sie nur ab, solange es genau ein Textfeld hat – seit
 * Schritt 1 auch nach dem Geburtsjahr fragt, sind es zwei, und die Taste tat
 * sonst nichts.
 */
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.target.tagName !== 'INPUT' || ['checkbox', 'radio'].includes(e.target.type)) return;
  const form = e.target.form;
  if (!form || form.dataset.formular) return;
  const weiter = form.querySelector('[data-act="willkommen-weiter"]');
  if (!weiter) return;
  e.preventDefault();
  aktion(weiter);
});

// Runde 5: F23 – der Zeichenzähler unter Notiz und Frage geht beim Tippen,
// Einfügen und Diktieren mit (js/ansicht-formulare.js). Ohne ihn sah niemand,
// dass ein langes Diktat an der Grenze abgeschnitten wurde.
document.addEventListener('input', (e) => zaehlerNachfuehren(e.target));

document.addEventListener('change', (e) => {
  if (e.target.id === 'sicherungDatei') {
    sicherungLaden(e.target.files && e.target.files[0]);
    e.target.value = '';
  }
  // Einnahme nachtragen: Wechselt der Tag, zeigt das Formular den Stand
  // dieses Tages. Vorher blieb die Auswahl des alten Tages stehen und sah aus
  // wie der gespeicherte Stand des neuen – ein „Speichern" überschrieb dann
  // einen Haken, den die Nutzerin nur ansehen wollte.
  if (e.target.name === 'datum' && e.target.form && e.target.form.dataset.formular === 'einnahme' && istISO(e.target.value)) {
    zeigeSeite('einnahme', e.target.value, { ersetzen: true });
    return;
  }
  // Uhrzeit der Erinnerung: sofort übernehmen, ohne Speichern-Knopf.
  if (e.target.name === 'erinnerung' && e.target.form && e.target.form.dataset.sofort === 'erinnerung') {
    const wert = e.target.value;
    if (/^\d{2}:\d{2}$/.test(wert)) einnahmezeitSetzen(wert);
  }
});

/*
 * Die Einnahmezeit ändern. Um mehr als drei Stunden verschoben, zählt das als
 * Wechsel (E15): Es kann den Wert verändern, und die Dosis-Karte fragt dann
 * nach. Ein Wechsel je Tag – beim Tippen einer Uhrzeit entstehen Zwischen-
 * stände (erst 02:00, dann 22:00), die sonst jeder für sich zählten; kommt
 * die Zeit am selben Tag zurück, verschwindet er wieder.
 */
function minutenAbstand(a, b) {
  const m = (u) => Number(u.slice(0, 2)) * 60 + Number(u.slice(3));
  const d = Math.abs(m(a) - m(b));
  return Math.min(d, 1440 - d);
}

function einnahmezeitSetzen(wert) {
  const heute = heuteISO();
  let weit = false;
  sp.aendern((s) => {
    const vorher = s.einstellungen.erinnerung;
    s.einstellungen.erinnerung = wert;
    const schon = s.uhrWechsel.find((u) => u.am === heute);
    const von = schon ? schon.von : vorher;
    weit = minutenAbstand(von, wert) > 180;
    if (schon && !weit) s.uhrWechsel = s.uhrWechsel.filter((u) => u !== schon);
    else if (schon) schon.nach = wert;
    else if (weit) s.uhrWechsel.push({ id: sp.kennung(), am: heute, von, nach: wert });
  });
  const e15 = weit ? dosisHinweise(sp.getStand(), heute).find((h) => h.id === 'E15') : null;
  meldung(e15 ? e15.text : `Einnahmezeit: ${wert.replace(/^0/, '')} Uhr`);
}

// ---------------------------------------------------------------- Start

// Neuer Tag, neuer Bildschirm: Wer die App abends offen liegen lässt, sieht
// morgens sonst noch den Haken von gestern.
// An einem neuen Tag geht es zurück zu „Heute" (B64) – außer mitten in einem
// Formular, dessen Eingaben sonst verloren gingen.
//
// Und außer auf dem Ergebnis des Warnzeichen-Checks und der Seite „Wichtig"
// nach dem Befinden: Wer den Check um 23:55 machte, sah „Jetzt den Giftnotruf
// anrufen" bzw. „Sofort 112" um Mitternacht ohne Zutun durch „Heute" ersetzt,
// wo ein Check von gestern nicht mehr zählt (Entscheidung 17) – ebenso nach
// dem Anruf zurück in der App (Runde 4: E24). Entschieden wird nach dem Namen
// der Seite, nicht nach einer Alarm-Karte im Bild: Die stehen auch auf
// „Heute", und dort soll der Tageswechsel gerade stattfinden. Geschlossen
// führt die Seite dann zu „Heute", nicht zurück in den Reiter von gestern.
const TAGESWECHSEL_BLEIBT = ['warnzeichen-ergebnis', 'befinden-hinweis'];
let gezeigterTag = heuteISO();
function tagPruefen() {
  const jetzt = heuteISO();
  if (jetzt !== gezeigterTag) {
    gezeigterTag = jetzt;
    const einrichten = !sp.getStand().profil.begruesst;
    const imFormular = ui.seite && $ansicht.querySelector('form[data-formular]');
    const bleiben = ui.seite && TAGESWECHSEL_BLEIBT.includes(ui.seite.name);
    if (!einrichten && !imFormular && !bleiben) {
      ui.seite = null;
      ui.stapel = [];
      ui.tab = 'heute';
      reiterMerken('heute');
      window.scrollTo(0, 0);
      render();
    } else if (!einrichten && bleiben) {
      // Nicht neu zeichnen – die Nutzerin liest gerade oder wählt die Nummer.
      ui.stapel = [];
      ui.tab = 'heute';
      reiterMerken('heute');
      verlaufAbgleichen();
      const knopf = $kopf.querySelector('.kopf-zurueck');
      if (knopf) knopf.setAttribute('aria-label', `Zurück zu ${REITER_TITEL.heute}`);
    }
  }
  tablettenHinweis();
}
setInterval(tagPruefen, 60000);

/*
 * Eine zweite Instanz (Browser-Tab neben der installierten App) kann
 * inzwischen geschrieben haben – deren Einträge zuerst übernehmen, sonst
 * überschreibt der nächste Tipp hier sie mit dem alten Stand. Mitten in einem
 * Formular nicht neu zeichnen – die Eingaben gingen verloren.
 *
 * Hat die andere Instanz alles gelöscht, liefert neuLesen() den leeren Stand
 * (C19). Dann auch hier zurück zum Anfang, selbst aus einer offenen Seite:
 * Sonst stand dort weiter, was es nicht mehr gibt, und nach dem Einrichten
 * öffnete sich wieder die alte Seite.
 *
 * Eine offene Seite ohne ungespeicherte Eingaben zeichnet sich neu (Runde 5:
 * F24). Vorher blieb jede Seite stehen, auch ohne Formular: Die Dosis-Karte
 * zeigte weiter „kleiner Schritt nach oben", obwohl im anderen Fenster gerade
 * TSH 0,05 eingetragen worden war, und „Teilen" schickte einen anderen
 * Bericht als den gezeigten. Mit Eingaben oder einer offenen Rückfrage bleibt
 * die Seite, wie sie ist – mit einer Meldung, dass sich etwas geändert hat.
 */
/*
 * Die aufgeklappte 112-Karte auf der Befinden-Seite („… – JETZT") ist wie eine
 * offene Rückfrage: Neu gezeichnet klappte sie ohne Hinweis zu, und die
 * 112-Zeile war nicht mehr im Bild (Nachprüfung zu F24).
 */
const notrufOffen = () => {
  const huelle = document.getElementById('notfall-jetzt-huelle');
  return Boolean(huelle && !huelle.hidden);
};

/*
 * Runde 6: G2 – Mit ungespeicherten Eingaben blieb die Seite stehen, und die
 * Meldung versprach „Die Anzeige wird nach dem Speichern aktualisiert". Die
 * Felder, die niemand angefasst hatte, zeigten aber den alten Stand, und das
 * Speichern schrieb ihn zurück: „Herzerkrankung: Ja" aus dem anderen Fenster
 * wurde still wieder „Nein". Jetzt zeichnet die Seite aus dem neuen Stand,
 * und nur die Felder, die hier geändert wurden, kommen zurück – sie zählen
 * weiter als ungespeichert. Wo das nicht geht (eine Rückfrage ist offen, oder
 * das Formular gibt es mit dem neuen Stand nicht mehr), bleibt die Seite
 * stehen, und die Meldung sagt, was beim Speichern gilt.
 *
 * Runde 6: G3 – Die Einrichtung zählt dabei wie eine offene Seite. Vorher
 * zeichnete die App dort immer neu: Stärke und Präparat aus Schritt 2 waren
 * weg, und eine offene Rückfrage („7,5 µg ist ungewöhnlich") hing an einem
 * Formular, das es nicht mehr gab – „Ja, stimmt" tat nichts.
 */
const FREMD_NEU = 'In einem anderen Fenster wurde etwas geändert. Die Seite zeigt jetzt den neuen Stand – Ihre Eingaben hier sind noch da.';
// Welche Liste des Stands hinter einem Formular mit data-id steht (wie eintragLoeschen).
const EINTRAG_LISTE = { dosis: 'dosen', labor: 'labor', gewicht: 'gewicht', befinden: 'befinden', termin: 'termine', frage: 'fragen' };

function fremdStehtText() {
  if (gezeichnet && gezeichnet.willkommen) return 'In einem anderen Fenster wurde etwas geändert. Wenn Sie hier weitermachen, gilt, was auf dieser Seite steht.';
  return `In einem anderen Fenster wurde etwas geändert. Wenn Sie hier speichern, gilt, was auf dieser Seite steht.${ui.seite ? ' Den neuen Stand sehen Sie nach „‹ Zurück".' : ''}`;
}

/** Die Werte je Feldname aus [name, wert]-Paaren. */
function werteJeName(paare) {
  const m = new Map();
  paare.forEach(([k, v]) => m.set(k, [...(m.get(k) || []), v]));
  return m;
}

/*
 * Runde 6: G2 – nur die Felder, die hier jemand verändert hat: verglichen mit
 * dem Stand beim Zeichnen (ui.formStand), je Formular und Name. Haken und
 * Auswahlknöpfe als Menge, Textfelder in ihrer Reihenfolge. Gesperrte und
 * verborgene Felder setzt nur die App. → wie eingabenMerken(), nur die geänderten.
 */
function geaenderteEingaben() {
  let vorher;
  try {
    vorher = new Map(JSON.parse(ui.formStand || '[]'));
  } catch {
    vorher = new Map();
  }
  const menge = (typ) => typ === 'checkbox' || typ === 'radio';
  return eingabenMerken().map((g) => {
    const felder = g.felder.filter((f) => !f.aus);
    const alt = werteJeName(vorher.get(g.kennung) || []);
    const jetzt = werteJeName(felder.filter((f) => !menge(f.typ) || f.an).map((f) => [f.name, f.wert]));
    const alsMenge = new Set(felder.filter((f) => menge(f.typ)).map((f) => f.name));
    const gleich = (name) => {
      const a = alt.get(name) || [];
      const b = jetzt.get(name) || [];
      return alsMenge.has(name) ? JSON.stringify([...a].sort()) === JSON.stringify([...b].sort()) : JSON.stringify(a) === JSON.stringify(b);
    };
    const namen = new Set(felder.map((f) => f.name).filter((n) => !gleich(n)));
    // Bei Haken-Gruppen zählt, was hier dazu- oder weggekommen ist – nicht
    // die ganze Gruppe: Sonst verwarf das Zurückholen, was im anderen Fenster
    // in derselben Gruppe angehakt wurde (Nachprüfung zu G2).
    const delta = {};
    felder.filter((f) => f.typ === 'checkbox' && namen.has(f.name)).forEach((f) => {
      const a = new Set(alt.get(f.name) || []);
      const d = delta[f.name] || (delta[f.name] = { an: [], aus: [] });
      if (f.an && !a.has(f.wert)) d.an.push(f.wert);
      if (!f.an && a.has(f.wert)) d.aus.push(f.wert);
    });
    return { ...g, felder: felder.filter((f) => namen.has(f.name)), delta };
  }).filter((g) => g.felder.length);
}

/** Das Feld mit dem Fokus – um es nach dem Neuzeichnen wiederzufinden. */
function feldMerken() {
  const el = document.activeElement;
  const form = el && el.form;
  if (!form || !el.name || !$ansicht.contains(form) || !form.matches(FORMULARE)) return null;
  let markiert = null;
  try {
    if (typeof el.selectionStart === 'number') markiert = [el.selectionStart, el.selectionEnd];
  } catch { /* Zahlenfelder kennen keine Markierung */ }
  const gleiche = [...form.elements].filter((x) => x.name === el.name);
  return { kennung: formKennung(form), name: el.name, nr: gleiche.indexOf(el), wert: el.value, typ: el.type, markiert };
}

function feldZurueck(m) {
  if (!m) return;
  const form = [...$ansicht.querySelectorAll(FORMULARE)].find((f) => formKennung(f) === m.kennung);
  if (!form) return;
  const gleiche = [...form.elements].filter((x) => x.name === m.name);
  const el = m.typ === 'radio' || m.typ === 'checkbox' ? gleiche.find((x) => x.value === m.wert) : gleiche[m.nr];
  if (!el) return;
  el.focus({ preventScroll: true });
  try {
    if (m.markiert) el.setSelectionRange(m.markiert[0], m.markiert[1]);
  } catch { /* egal */ }
}

function fremdeAenderung() {
  const warEingerichtet = sp.getStand().profil.begruesst;
  // Die geänderten Felder vor dem Einlesen – verglichen wird mit dem Zeichnen.
  const eingaben = eingabenGeaendert() ? geaenderteEingaben() : [];
  // Derselbe Inhalt, nur anders geschrieben (ein Stand, den normStand beim
  // Laden ergänzt hat): keine Änderung – sonst meldete jede Rückkehr in die
  // App mitten im Formular ein „anderes Fenster", das es nicht gibt.
  const inhaltVorher = JSON.stringify(sp.getStand());
  if (!sp.neuLesen() || JSON.stringify(sp.getStand()) === inhaltVorher) return;
  const stand = sp.getStand();
  if (warEingerichtet && !stand.profil.begruesst) {
    ui.seite = null;
    ui.stapel = [];
    ui.tab = 'heute';
    ui.schritt = 1;
    ui.entwurf = {};
    window.scrollTo(0, 0);
    render();
    return;
  }
  // Eine offene Rückfrage oder die aufgeklappte 112-Karte bleiben, wie sie sind.
  if (rueckfrage || auswahl || notrufOffen()) {
    meldung(fremdStehtText());
    return;
  }
  if (eingaben.length) {
    // Gibt es das Formular mit dem neuen Stand nicht mehr (etwa: im anderen
    // Fenster fertig eingerichtet), wären die Eingaben beim Neuzeichnen weg.
    // Ebenso, wenn der Eintrag dahinter gelöscht wurde: Dann käme ein leeres
    // Formular („Laborwerte eintragen", Datum heute) um die geänderten Felder.
    const vorlage = document.createElement('template');
    vorlage.innerHTML = ansichtBauen(stand, heuteISO()).html;
    if (!stand.profil.begruesst) schritteMarkieren(vorlage.content);
    const da = new Set([...vorlage.content.querySelectorAll(FORMULARE)].map(formKennung));
    const eintragWeg = (kennung) => {
      const [art, id] = kennung.split('#');
      const liste = stand[EINTRAG_LISTE[art]];
      return Boolean(id && Array.isArray(liste) && !liste.some((x) => x.id === id));
    };
    if (!eingaben.every((g) => da.has(g.kennung) && !eintragWeg(g.kennung))) {
      meldung(fremdStehtText());
      return;
    }
  }
  if (!warEingerichtet && stand.profil.begruesst) {
    // Im anderen Fenster fertig eingerichtet: hier auch – weiter auf „Heute",
    // wie nach „Fertig – zur App".
    ui.seite = null;
    ui.stapel = [];
    ui.tab = 'heute';
    ui.schritt = 1;
    ui.entwurf = {};
  }
  if (eingaben.length) {
    const feld = feldMerken();
    render({ eingaben });
    feldZurueck(feld);
    meldung(FREMD_NEU);
    return;
  }
  // Der Fokus bleibt auf dem Knopf, der ihn hatte – sonst stand er danach im Nichts.
  const aktiv = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.act ? fokusMerkmal(document.activeElement) : null;
  render({ eingaben: null });
  if (aktiv) fokusZurueck(aktiv);
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    fremdeAenderung();
    tagPruefen();
  } else {
    sp.sofortSchreiben();
  }
});
// Dasselbe, während beide offen sind: Der Browser meldet fremde Schreibvorgänge.
window.addEventListener('storage', (e) => {
  if (e.key === sp.SCHLUESSEL) fremdeAenderung();
});
window.addEventListener('pagehide', () => sp.sofortSchreiben());

// Gezeichnet wird von jeder Aktion selbst. Hier nur der eine Fall, den keine
// Aktion sieht: Das Speichern läuft 120 ms verzögert, und scheitert es (oder
// klappt es wieder), muss die Warnung unter „Heute" sofort erscheinen bzw.
// verschwinden – nicht erst beim nächsten Tipp. Ebenso, wenn sich nur der
// Grund ändert („privates Fenster?" → „Speicher voll"): Vorher blieb der
// falsche Text stehen, und der Rat zur Sicherung fehlte (C20).
let konnteSpeichern = sp.kannSpeichern();
let grundVorher = sp.speicherGrund();
sp.abonnieren(() => {
  if (sp.kannSpeichern() !== konnteSpeichern || sp.speicherGrund() !== grundVorher) {
    konnteSpeichern = sp.kannSpeichern();
    grundVorher = sp.speicherGrund();
    render();
  }
});

// Offline-Betrieb (Service Worker) und das Neuladen nach einem Update stehen
// als klassisches Skript in index.html – sie müssen auch laufen, wenn dieses
// Modul gar nicht erst startet (C18).
//
// Das Neuladen kam ohne Rückfrage, auch mitten in einem Formular: Auf einem
// langsamen Netz übernahm der neue Worker 20 Sekunden nach dem Öffnen, und
// die halb eingetragenen Laborwerte waren weg (Runde 4: E25). Läuft die App,
// fragt index.html deshalb hier nach, ob gerade neu geladen werden darf: nur
// auf einem Reiter ohne offene Seite und außerhalb der Einrichtung – eine
// offene Seite (Formular, Ergebnis des Checks) wäre sonst ohne Zutun weg.
// Sonst wartet das Neuladen, bis render() eine solche Lage zeichnet. Startet
// die App nicht, gibt es die Frage nicht, und es lädt wie bisher sofort neu.
function neuLadenErlaubt() {
  return Boolean(sp.getStand().profil.begruesst) && !ui.seite && !rueckfrage && !auswahl && !eingabenGeaendert();
}
window.__schilddrueseNeuLadenErlaubt = neuLadenErlaubt;

/*
 * Runde 5: F19 – das aufgeschobene Neuladen. Es wartet, bis seit dem letzten
 * Tipp die Sperre gegen den Doppeltipp abgelaufen ist (die lebt nur in dieser
 * Seite und wäre nach dem Neuladen weg), und solange die Meldung einen Knopf
 * wie „Rückgängig" anbietet – der ginge sonst mit der Seite verloren. Die
 * Meldung selbst („Befinden gespeichert") kommt nach dem Neuladen noch einmal.
 * Geht die App vorher in den Hintergrund, lädt sie dort neu – das sieht
 * niemand, und kein Tipp kann es treffen.
 */
const MELDUNG_MERK = 'schilddruese.meldung';
let neuLadenTimer = null;

function neuLadenPlanen() {
  clearTimeout(neuLadenTimer);
  neuLadenTimer = setTimeout(neuLadenVersuchen, SPERRE_MS + 300);
}

function neuLadenVersuchen() {
  neuLadenTimer = null;
  // Inzwischen eine Seite offen: Das nächste render() ohne Seite plant neu.
  if (!window.__schilddrueseNeuLaden || !neuLadenErlaubt()) return;
  const seitDemTipp = letzterDruck ? performance.now() - letzterDruck.t : Infinity;
  const knopfOffen = $meldung.classList.contains('zeigen') && $meldung.querySelector('button');
  if (seitDemTipp < SPERRE_MS + 300 || knopfOffen) { neuLadenPlanen(); return; }
  neuLaden();
}

function neuLaden() {
  clearTimeout(neuLadenTimer);
  neuLadenTimer = null;
  window.__schilddrueseNeuLaden = false;
  try {
    const text = $meldung.classList.contains('zeigen') && $meldung.firstChild && $meldung.firstChild.nodeType === 3 ? $meldung.firstChild.textContent : '';
    if (text) sessionStorage.setItem(MELDUNG_MERK, text);
  } catch { /* dann ohne die Meldung */ }
  sp.sofortSchreiben();
  location.reload();
}

// Für index.html: Übernimmt der neue Worker, plant die App das Neuladen –
// ohne offene Seite gleich, sonst beim nächsten render() ohne Seite.
window.__schilddrueseNeuLadenPlanen = () => { if (neuLadenErlaubt()) neuLadenPlanen(); };

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'hidden' || !window.__schilddrueseNeuLaden || !neuLadenErlaubt()) return;
  // „Rückgängig" in der Meldung soll nach der Rückkehr noch da sein.
  if ($meldung.classList.contains('zeigen') && $meldung.querySelector('button')) return;
  neuLaden();
});

render();
speicherFestnageln();
tablettenHinweis();
// Eine Meldung von vor dem Neuladen nach einem Update – einmal (F19).
try {
  const gemerkt = sessionStorage.getItem(MELDUNG_MERK);
  if (gemerkt) {
    sessionStorage.removeItem(MELDUNG_MERK);
    meldung(gemerkt);
  }
} catch { /* ohne Sitzungsspeicher eben nicht */ }
