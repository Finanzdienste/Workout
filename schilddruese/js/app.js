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
import { formular, absenden, eintragLoeschen } from './ansicht-formulare.js';
import { einschaetzungSeite } from './ansicht-einschaetzung.js';
import { dosisSeite, PRAXIS_BESTAETIGUNG, PRAXIS_NEUE_DOSIS, PRAXIS_NOCH_NICHT } from './ansicht-dosis.js';
import { fragenVorschlaege, abnahmeHeute } from './einschaetzung.js';
import { dosisHinweise } from './dosis.js';
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

function render() {
  const stand = sp.getStand();
  document.documentElement.dataset.schrift = stand.einstellungen.schrift;
  document.documentElement.dataset.farbe = stand.einstellungen.farbe;
  const heute = heuteISO();

  let html;
  let titel = null;
  const willkommen = !stand.profil.begruesst;
  if (willkommen) {
    // Ein Entwurf aus „Zurück" geht dem Stand vor (Runde 4: E12).
    html = willkommenAnsicht(ui.schritt, stand, heute, ui.entwurf[ui.schritt] || null);
    titel = `Schritt ${ui.schritt} von ${WILLKOMMEN_SCHRITTE}`;
  } else if (ui.seite) {
    const s = seiteInhalt(ui.seite, stand, heute);
    html = s.html;
    titel = s.titel;
    // Die Dosis-Karte kann sich merken lassen, dass sie etwas gezeigt hat –
    // einmal; beim nächsten Zeichnen liefert sie dafür nichts mehr. Mit dem
    // Titel der Karte: Der Bericht nennt so die zuletzt gezeigte Richtung in
    // den Worten, die die Patientin gelesen hat (RW2 B1, Runde 4: E16).
    // Der Titel ist danach Nutzerspeicher – jede Ansicht gibt ihn nur über esc() aus.
    if (s.merken) {
      const m = s.merken;
      const titelText = typeof m.titel === 'string' ? m.titel.trim().slice(0, 200) : '';
      sp.aendern((st) => {
        st.nachfragen.push({ id: sp.kennung(), art: m.art, bezug: m.bezug, antwort: m.antwort, am: heute, ...(titelText ? { titel: titelText } : {}) });
      });
    }
  } else if (ui.tab === 'verlauf') {
    html = verlaufAnsicht(stand, heute);
  } else if (ui.tab === 'mehr') {
    html = mehrAnsicht(stand, heute);
  } else {
    html = heuteAnsicht(stand, heute, jetztUhr());
  }

  // Kopf: die Marke, oder „Zurück" mit dem Titel der Seite.
  if (titel && !willkommen) {
    const ziel = ui.stapel.length ? seiteInhalt(ui.stapel[ui.stapel.length - 1], stand, heute).titel : REITER_TITEL[ui.tab];
    $kopf.innerHTML = `<button type="button" class="kopf-zurueck" data-act="zurueck" aria-label="Zurück zu ${esc(ziel)}">‹ Zurück</button><span class="kopf-titel" id="seitentitel">${esc(titel)}</span>`;
  } else if (willkommen) {
    $kopf.innerHTML = `<h1 class="marke"><img src="icon.svg" alt="">Schilddrüse</h1><span class="kopf-titel gedaempft" style="margin-left:auto">${esc(titel)}</span>`;
  } else {
    $kopf.innerHTML = '<h1 class="marke"><img src="icon.svg" alt="">Schilddrüse</h1>';
  }

  kopfHoeheMerken();
  $ansicht.innerHTML = speicherWarnung() + html;
  // Vorleseprogramme nennen beim Fokus den Namen des Bereichs – bei einer
  // offenen Seite ihren Titel, nicht den Reiter darunter.
  $ansicht.setAttribute('aria-labelledby', titel && !willkommen ? 'seitentitel' : `reiter-${ui.tab}`);
  $reiter.hidden = willkommen;
  document.body.classList.toggle('ohne-leiste', willkommen);
  $reiter.querySelectorAll('.reiter').forEach((b) => {
    b.setAttribute('aria-selected', String(!willkommen && b.dataset.reiter === ui.tab && !ui.seite));
  });
  // Was im Formular stand, als es gezeichnet wurde – daran misst verlassen(),
  // ob etwas eingetippt und noch nicht gespeichert ist (Runde 4: E5).
  ui.formStand = formStand();
  // Ein Update hat während eines Formulars übernommen: jetzt neu laden, wo
  // nichts mehr verloren geht (Runde 4: E25, siehe index.html). Dann ohne
  // Schritt im Browserverlauf – der liefe sonst erst nach dem Neuladen.
  if (window.__schilddrueseNeuLaden && neuLadenErlaubt()) {
    window.__schilddrueseNeuLaden = false;
    sp.sofortSchreiben();
    location.reload();
    return;
  }
  verlaufAbgleichen();
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
    $ansicht.focus({ preventScroll: true });
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

/** Die Felder des offenen Formulars als Text – oder null ohne Formular. */
function formStand() {
  const form = $ansicht.querySelector('form[data-formular]');
  if (!form) return null;
  return JSON.stringify([...new FormData(form)].map(([k, v]) => [k, typeof v === 'string' ? v : '']));
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

/**
 * Die Sicherung weitergeben – aufs Handy heißt das meist: an sich selbst
 * schicken oder in einen Ordner legen. Wo das Teilen nicht geht, wird
 * heruntergeladen. Abbrechen ist keine Meldung wert.
 */
async function sicherungSpeichern() {
  const heute = heuteISO();
  const name = `schilddruese-sicherung-${heute}.json`;
  const json = sp.exportJSON();
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
      const uhr = jetztUhr();
      sp.einnahmeSetzen(heute, { uhr });
      ui.abgehakt = { tag: heute, uhr };
      render();
      meldung('Tablette abgehakt', { knopf: { act: 'tablette-rueckgaengig', text: 'Rückgängig' } });
      break;
    }
    case 'tablette-rueckgaengig': {
      // Nur der Haken von eben – steht inzwischen etwas anderes da (eine
      // andere Uhrzeit, ein neuer Tag), bleibt es.
      const a = ui.abgehakt;
      const e = sp.einnahme(heute);
      ui.abgehakt = null;
      meldungZu();
      if (a && a.tag === heute && e && e.uhr === a.uhr) {
        sp.einnahmeSetzen(heute, undefined);
        render();
        meldung('Zurückgenommen – heute ist keine Tablette abgehakt.');
      }
      break;
    }
    case 'tablette-zurueck':
      if (window.confirm('Den Haken für heute zurücknehmen?')) {
        sp.einnahmeSetzen(heute, undefined);
        render();
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
          b.praxis = wert;
          b.praxisAm = heute;
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
      if (sp.importZurueck()) { meldung('Vorheriger Stand ist wieder da'); render(); } else meldung('Kein vorheriger Stand vorhanden');
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
        s.nachfragen.push({ id: sp.kennung(), art, bezug: zu, antwort: wert, am: heute });
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

function rueckfrageZeigen(form, fragen, { satz = '', feld = '' } = {}) {
  rueckfrageSchliessen(null);
  const { dialog, freigeben } = dialogZeigen({
    titel: 'Bitte prüfen',
    punkte: fragen,
    satz: satz || 'Steht es genau so auf dem Befund?',
    knoepfe: [
      { text: 'Ja, stimmt', klasse: 'knopf knopf-haupt', act: 'befund-bestaetigen' },
      { text: 'Korrigieren', klasse: 'knopf', act: 'befund-korrigieren' },
    ],
    abbrechen: () => rueckfrageSchliessen(false),
  });
  const r = { dialog, form, feld, bereit: false };
  rueckfrage = r;
  freigeben(() => { r.bereit = true; });
}

/** true: bestätigt speichern · false: zurück ins Formular · null: nur schließen. */
function rueckfrageSchliessen(bestaetigt) {
  if (!rueckfrage) return;
  const { dialog, form, feld: feldName } = rueckfrage;
  rueckfrage = null;
  if (dialog.open && dialog.close) dialog.close();
  dialog.remove();
  if (bestaetigt === true && form.isConnected) {
    let feld = form.querySelector('input[name="bestaetigt"]');
    if (!feld) {
      feld = document.createElement('input');
      feld.type = 'hidden';
      feld.name = 'bestaetigt';
      form.appendChild(feld);
    }
    feld.value = 'ja';
    form.requestSubmit();
  } else if (bestaetigt === false && form.isConnected) {
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

function praxisNochGeaendert(vorher) {
  const b = sp.getStand().labor.find((l) => l.id === vorher.befund);
  return Boolean(b && b.praxis === 'geaendert');
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

/**
 * Fehler am Feld zeigen, ohne die Eingaben zu verlieren. Ein Fehler ist ein
 * Text – oder { text, knopf: { seite, param, text } }, wenn der Weg zur Lösung
 * auf einer anderen Seite liegt (etwa: den vorhandenen Eintrag öffnen).
 */
function zeigeFehler(form, fehler) {
  if (!form) return;
  form.querySelectorAll('.feld-fehler').forEach((f) => f.remove());
  form.querySelectorAll('.feld.fehlt').forEach((f) => f.classList.remove('fehlt'));
  let erstes = null;
  Object.entries(fehler || {}).forEach(([name, eintrag]) => {
    const { text, knopf } = typeof eintrag === 'string' ? { text: eintrag, knopf: null } : eintrag;
    const feld = form.querySelector(`[name="${name}"]`);
    const huelle = feld ? feld.closest('.feld') : form.querySelector(`[data-feld="${name}"]`);
    const ziel = huelle || form;
    if (huelle) huelle.classList.add('fehlt');
    const p = document.createElement('p');
    p.className = 'feld-fehler';
    p.setAttribute('role', 'alert');
    p.textContent = text;
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
    ziel.appendChild(p);
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
    rueckfrageZeigen(form, ergebnis.rueckfragen, { satz: ergebnis.rueckfrageSatz, feld: ergebnis.rueckfrageFeld });
    return;
  }
  if (!ergebnis.ok) { zeigeFehler(form, ergebnis.fehler); return; }
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
 */
function fremdeAenderung() {
  const warEingerichtet = sp.getStand().profil.begruesst;
  if (!sp.neuLesen()) return;
  if (warEingerichtet && !sp.getStand().profil.begruesst) {
    ui.seite = null;
    ui.stapel = [];
    ui.tab = 'heute';
    ui.schritt = 1;
    ui.entwurf = {};
    window.scrollTo(0, 0);
    render();
  } else if (!ui.seite) {
    render();
  }
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

render();
speicherFestnageln();
tablettenHinweis();
