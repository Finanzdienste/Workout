/*
 * Schilddrüse – Alltagsbegleiter bei Schilddrüsenunterfunktion.
 *
 * Für eine Nutzerin, die morgens eine Tablette nimmt und beim Arzttermin
 * wissen will, was seit dem letzten Mal war. Die App hakt die Einnahme ab,
 * hält Dosis, Laborwerte, Gewicht und Befinden fest und schreibt daraus den
 * Bericht für den Termin. Sie deutet nichts und empfiehlt nichts – das bleibt
 * bei der Ärztin.
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
import { willkommenAnsicht, willkommenWeiter, WILLKOMMEN_SCHRITTE } from './ansicht-willkommen.js';
import { berichtText } from './bericht.js';
import { erinnerungICS, terminICS } from './ics.js';

const $ansicht = document.getElementById('ansicht');
const $kopf = document.getElementById('kopf');
const $reiter = document.getElementById('reiterleiste');
const $meldung = document.getElementById('meldung');

/*
 * Was gerade zu sehen ist: ein Reiter, und darüber womöglich eine Seite
 * (ein Formular, eine Liste, ein Wissenskapitel). „Zurück", „Abbrechen" und
 * „Löschen" führen dorthin, woher man kam – aus „Alle Laborwerte" in einen
 * Befund und zurück in die Liste, nicht bis zum Reiter. Sonst muss man die
 * Liste nach jedem Eintrag neu suchen, und derselbe Knopf führt mal hierhin,
 * mal dorthin.
 */
const ui = {
  tab: sp.getStand().tab,
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

function zeigeReiter(tab) {
  ui.tab = tab;
  ui.seite = null;
  ui.stapel = [];
  if (sp.getStand().tab !== tab) sp.aendern((s) => { s.tab = tab; });
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

/** Fehler am Feld zeigen, ohne die Eingaben zu verlieren. */
function zeigeFehler(form, fehler) {
  if (!form) return;
  form.querySelectorAll('.feld-fehler').forEach((f) => f.remove());
  form.querySelectorAll('.feld.fehlt').forEach((f) => f.classList.remove('fehlt'));
  let erstes = null;
  Object.entries(fehler || {}).forEach(([name, text]) => {
    const feld = form.querySelector(`[name="${name}"]`);
    const huelle = feld ? feld.closest('.feld') : form.querySelector(`[data-feld="${name}"]`);
    const ziel = huelle || form;
    if (huelle) huelle.classList.add('fehlt');
    const p = document.createElement('p');
    p.className = 'feld-fehler';
    p.setAttribute('role', 'alert');
    p.textContent = text;
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
  if (!ergebnis.ok) { zeigeFehler(form, ergebnis.fehler); return; }
  nachDemSpeichern(ergebnis.danach);
  meldung(ergebnis.meldung || 'Gespeichert');
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
    if (/^\d{2}:\d{2}$/.test(wert)) {
      sp.aendern((s) => { s.einstellungen.erinnerung = wert; });
      meldung(`Einnahmezeit: ${wert.replace(/^0/, '')} Uhr`);
    }
  }
});

// ---------------------------------------------------------------- Start

// Neuer Tag, neuer Bildschirm: Wer die App abends offen liegen lässt, sieht
// morgens sonst noch den Haken von gestern.
let gezeigterTag = heuteISO();
function tagPruefen() {
  const jetzt = heuteISO();
  if (jetzt !== gezeigterTag) {
    gezeigterTag = jetzt;
    if (!ui.seite) render();
  }
  tablettenHinweis();
}
setInterval(tagPruefen, 60000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    // Eine zweite Instanz (Browser-Tab neben der installierten App) kann
    // inzwischen geschrieben haben – deren Einträge zuerst übernehmen, sonst
    // überschreibt der nächste Tipp hier sie mit dem alten Stand.
    if (sp.neuLesen() && !ui.seite) render();
    tagPruefen();
  } else {
    sp.sofortSchreiben();
  }
});
// Dasselbe, während beide offen sind: Der Browser meldet fremde Schreibvorgänge.
window.addEventListener('storage', (e) => {
  if (e.key !== sp.SCHLUESSEL) return;
  // Mitten in einem Formular nicht neu zeichnen – die Eingaben gingen verloren.
  if (sp.neuLesen() && !ui.seite) render();
});
window.addEventListener('pagehide', () => sp.sofortSchreiben());

// Gezeichnet wird von jeder Aktion selbst. Hier nur der eine Fall, den keine
// Aktion sieht: Das Speichern läuft 120 ms verzögert, und scheitert es (oder
// klappt es wieder), muss die Warnung unter „Heute" sofort erscheinen bzw.
// verschwinden – nicht erst beim nächsten Tipp.
let konnteSpeichern = sp.kannSpeichern();
sp.abonnieren(() => {
  if (sp.kannSpeichern() !== konnteSpeichern) {
    konnteSpeichern = sp.kannSpeichern();
    render();
  }
});

// Offline-Betrieb, nur über http(s) – unter file:// gibt es keine Service Worker.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  // Nach einer neuen Fassung einmal neu laden – nur, wenn vorher schon *der
  // eigene* Worker die Seite hatte, und nur einmal je Sitzung. Begründung in
  // ../js/app.js. Der Worker der Workout-App eine Ebene höher steuert beim
  // allerersten Besuch womöglich auch diese Seite; dann ist die Übernahme
  // durch den eigenen keine neue Fassung, und ein Neuladen risse die
  // Nutzerin mitten aus dem Einrichten.
  const eigenerWorker = new URL('./sw.js', location.href).href;
  const hatteWorker = navigator.serviceWorker.controller?.scriptURL === eigenerWorker;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hatteWorker) return;
    try {
      if (sessionStorage.getItem('schilddruese.neugeladen')) return;
      sessionStorage.setItem('schilddruese.neugeladen', '1');
    } catch { return; }
    location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* dann ohne Offline-Betrieb */ });
  });
}

render();
speicherFestnageln();
tablettenHinweis();
