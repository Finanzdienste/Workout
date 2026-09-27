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
import { heuteISO, jetztUhr, tageWeiter, istISO } from './datum.js';
import { esc } from './text.js';
import { heuteAnsicht } from './ansicht-heute.js';
import { verlaufAnsicht, verlaufSeite } from './ansicht-verlauf.js';
import { mehrAnsicht, mehrSeite } from './ansicht-mehr.js';
import { formular, absenden, eintragLoeschen } from './ansicht-formulare.js';
import { einschaetzungSeite } from './ansicht-einschaetzung.js';
import { dosisSeite, PRAXIS_BESTAETIGUNG, PRAXIS_NEUE_DOSIS } from './ansicht-dosis.js';
import { fragenVorschlaege } from './einschaetzung.js';
import { dosisHinweise } from './dosis.js';
import { willkommenAnsicht, willkommenWeiter, WILLKOMMEN_SCHRITTE } from './ansicht-willkommen.js';
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
export function meldung(text) {
  $meldung.textContent = text;
  $meldung.classList.add('zeigen');
  clearTimeout(meldungTimer);
  const dauer = 5000 + text.split(/\s+/).length * 350;
  meldungTimer = setTimeout(() => $meldung.classList.remove('zeigen'), dauer);
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
    html = willkommenAnsicht(ui.schritt, stand, heute);
    titel = `Schritt ${ui.schritt} von ${WILLKOMMEN_SCHRITTE}`;
  } else if (ui.seite) {
    const s = seiteInhalt(ui.seite, stand, heute);
    html = s.html;
    titel = s.titel;
    // Die Dosis-Karte kann sich merken lassen, dass sie etwas gezeigt hat –
    // einmal; beim nächsten Zeichnen liefert sie dafür nichts mehr.
    if (s.merken) {
      const m = s.merken;
      sp.aendern((st) => { st.nachfragen.push({ id: sp.kennung(), art: m.art, bezug: m.bezug, antwort: m.antwort, am: heute }); });
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
  window.scrollTo(0, 0);
  render();
  $ansicht.focus({ preventScroll: true });
}

function zurueck() {
  ui.seite = ui.stapel.pop() || null;
  window.scrollTo(0, 0);
  render();
  $ansicht.focus({ preventScroll: true });
}

/** Nach dem Speichern: dorthin, wohin das Formular will – oder zurück. */
function nachDemSpeichern(danach) {
  if (!danach) { zurueck(); return; }
  const unten = ui.stapel[ui.stapel.length - 1];
  if (unten && unten.name === danach.name) { zurueck(); return; }
  zeigeSeite(danach.name, danach.param || null, { ersetzen: true });
}

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

function sicherungLaden(datei) {
  if (!datei) return;
  const leser = new FileReader();
  leser.onload = () => {
    let ergebnis;
    try {
      ergebnis = sp.importJSON(String(leser.result || ''));
    } catch {
      // Was normStand nicht abfängt, darf nicht still im Nichts enden.
      ergebnis = { ok: false, grund: 'Die Datei ließ sich nicht einlesen. Es wurde nichts geändert.' };
    }
    if (ergebnis.ok) {
      meldung('Sicherung eingelesen');
      ui.seite = null;
      ui.stapel = [];
      ui.tab = 'heute';
      ui.schritt = 1;
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
  try {
    if (localStorage.getItem(HINWEIS_MERK) === heute) return;
    localStorage.setItem(HINWEIS_MERK, heute);
  } catch { return; }
  const optionen = { body: 'Nüchtern, mit einem Glas Wasser – und danach hier abhaken.', tag: 'schilddruese-tablette', icon: './icon-192.png' };
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
      zurueck();
      break;
    case 'seite':
      zeigeSeite(el.dataset.seite, el.dataset.param || null);
      break;
    case 'reiter':
      zeigeReiter(el.dataset.reiter);
      break;
    case 'tablette':
      sp.einnahmeSetzen(heute, { uhr: jetztUhr() });
      render();
      meldung('Tablette abgehakt');
      break;
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
      sp.aendern((s) => {
        const f = s.fragen.find((x) => x.id === id);
        if (f) f.erledigt = !f.erledigt;
      });
      render();
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
      const wert = el.dataset.wert;
      if (!['bleibt', 'geaendert', 'nachmessen'].includes(wert)) break;
      sp.aendern((s) => {
        const b = s.labor.find((l) => l.id === el.dataset.id);
        if (b) { b.praxis = wert; b.praxisAm = heute; }
      });
      if (wert === 'geaendert') zeigeSeite('dosis', 'praxis', { ersetzen: true });
      else zurueck();
      meldung(wert === 'geaendert' ? PRAXIS_NEUE_DOSIS : PRAXIS_BESTAETIGUNG);
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
      rueckfrageSchliessen(true);
      break;
    case 'befund-korrigieren':
      rueckfrageSchliessen(false);
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
      const titel = t.art === 'labor' ? 'Blutabnahme Schilddrüse' : t.art === 'arzt' ? 'Arzttermin Schilddrüse' : 'Termin';
      herunterladen(`termin-${t.datum}.ics`, terminICS({
        id: t.id, datum: t.datum, uhr: t.uhr, titel: t.wo ? `${titel} – ${t.wo}` : titel,
        notiz: [t.blutabnahme || t.art === 'labor' ? 'Tablette wie mit der Praxis besprochen – meist erst nach der Blutabnahme.' : '', t.notiz].filter(Boolean).join('\n'),
        blutabnahme: t.art === 'labor' || t.blutabnahme,
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
      if (!ergebnis.ok) { zeigeFehler(form, ergebnis.fehler); break; }
      if (ui.schritt >= WILLKOMMEN_SCHRITTE) {
        sp.aendern((s) => {
          s.profil.begruesst = true;
          if (!s.profil.seit) s.profil.seit = heute;
        });
        ui.schritt = 1;
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
      if (ui.schritt > 1) {
        ui.schritt--;
        window.scrollTo(0, 0);
        render();
        $ansicht.focus({ preventScroll: true });
      }
      break;
    default:
      break;
  }
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
  if (/^[a-z0-9_]{1,20}$/i.test(wert || '') && /^[A-Za-z0-9_]{1,30}$/.test(feld || '')) {
    sp.aendern((s) => {
      if (ziel === 'befund') {
        const b = s.labor.find((l) => l.id === bezug);
        if (!b || !(BEFUND_ANTWORTEN[feld] || []).includes(wert)) return;
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
 */
let rueckfrage = null;   // { dialog, form }

function rueckfrageZeigen(form, fragen) {
  rueckfrageSchliessen(null);
  const dialog = document.createElement('dialog');
  dialog.className = 'rueckfrage';
  dialog.setAttribute('aria-labelledby', 'rueckfrage-titel');
  const h = document.createElement('h2');
  h.id = 'rueckfrage-titel';
  h.textContent = 'Bitte prüfen';
  const ul = document.createElement('ul');
  fragen.forEach((t) => { const li = document.createElement('li'); li.textContent = t; ul.appendChild(li); });
  const p = document.createElement('p');
  p.textContent = 'Steht es genau so auf dem Befund?';
  const reihe = document.createElement('div');
  reihe.className = 'knopf-reihe';
  [['befund-bestaetigen', 'Ja, stimmt', 'knopf knopf-haupt'], ['befund-korrigieren', 'Korrigieren', 'knopf']].forEach(([act, text, klasse]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = klasse;
    b.dataset.act = act;
    b.textContent = text;
    reihe.appendChild(b);
  });
  dialog.append(h, ul, p, reihe);
  // Escape heißt „Korrigieren".
  dialog.addEventListener('cancel', (e) => { e.preventDefault(); rueckfrageSchliessen(false); });
  document.body.appendChild(dialog);
  rueckfrage = { dialog, form };
  if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', '');
  reihe.querySelector('button').focus();
}

/** true: bestätigt speichern · false: zurück ins Formular · null: nur schließen. */
function rueckfrageSchliessen(bestaetigt) {
  if (!rueckfrage) return;
  const { dialog, form } = rueckfrage;
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
    const erstes = form.querySelector('input[name$="_wert"]');
    if (erstes) {
      erstes.scrollIntoView({ block: 'center' });
      erstes.focus({ preventScroll: true });
    }
  }
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
    zeigeReiter(reiter.dataset.reiter);
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
  if (!ergebnis.ok && ergebnis.rueckfragen) { rueckfrageZeigen(form, ergebnis.rueckfragen); return; }
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
let gezeigterTag = heuteISO();
function tagPruefen() {
  const jetzt = heuteISO();
  if (jetzt !== gezeigterTag) {
    gezeigterTag = jetzt;
    const einrichten = !sp.getStand().profil.begruesst;
    const imFormular = ui.seite && $ansicht.querySelector('form[data-formular]');
    if (!einrichten && !imFormular) {
      ui.seite = null;
      ui.stapel = [];
      ui.tab = 'heute';
      reiterMerken('heute');
      window.scrollTo(0, 0);
      render();
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

render();
speicherFestnageln();
tablettenHinweis();
