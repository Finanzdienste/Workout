/*
 * Workout-Kalender – das Skript in deinem eigenen Google-Konto
 * ============================================================
 *
 *     „Ja aber nur wenn es wirklich keinen Weg gibt wie verschoben wird auch
 *      wenn ich die app nicht öffne"
 *
 *     „Klappt alles aber bisschen wenig Termine. Lass doch mal ein Jahr
 *      machen"
 *
 * Ohne Öffnen der App ändert sich der Plan nur dadurch, dass Tage vergehen.
 * Die Workout-App rechnet deshalb vor, was sie an jedem der nächsten 42 Tage
 * zeigen würde, wenn bis dahin nicht trainiert wird – und je Tag, wie es ein
 * Jahr lang weitergeht, wenn ab dann nach Plan trainiert wird –, und schickt
 * diese Vorschau hierher. Das Skript legt sie ab und hält den Kalender
 * „Workout" danach aktuell: sofort und dann jede Stunde mit der Liste für
 * heute (Berliner Zeit) – auch wenn die App zu ist. Es rechnet nichts selbst,
 * es wählt nur den Tag. Trainierst du, schickt die App eine neue Vorschau, und
 * die alte ist überholt.
 *
 * EINRICHTEN (einmal, am Handy im Browser mit „Desktop-Website"):
 *   1. Diesen Code ganz einfügen – in der App unter Mehr → Kalender
 *      „Code kopieren" – und speichern.
 *   2. Oben „einrichten" wählen und „Ausführen" tippen, den Zugriff erlauben.
 *      Es räumt die Probe weg, legt den Kalender „Workout" an (oder findet
 *      ihn wieder) und genau einen stündlichen Auslöser. Was es getan hat,
 *      steht unten im Ausführungsprotokoll.
 *   3. Bereitstellen → Bereitstellungen verwalten → Bearbeiten (Stift) →
 *      Version: Neue Version → Bereitstellen. Die URL bleibt dieselbe.
 *      Gibt es noch keine: Bereitstellen → Neue Bereitstellung → Web-App,
 *      „Ausführen als: Ich", „Zugriff: Jeder" (nicht „Jeder mit
 *      Google-Konto" – dann käme die App nie an).
 *   4. Die URL in der App einfügen und „Verbinden" tippen.
 *
 * NEUE FASSUNG (etwa von Fassung 1 auf 2 – die App sagt es dir): im selben
 * Projekt den ganzen Code ersetzen, speichern, dann Schritt 3. „einrichten"
 * braucht es dafür nicht: Kalender und stündlicher Auslöser bleiben (der
 * Auslöser ruft „stuendlich" beim Namen, und das ist jetzt der neue Code),
 * und Fassung 2 braucht keine Rechte, die Fassung 1 nicht schon hatte. Fehlt
 * doch etwas, sagt das Skript selbst, dass „einrichten" hilft. Ohne „Neue
 * Version" liefe die Web-App mit dem alten Code weiter, während der
 * stündliche Auslöser schon den neuen nimmt – darum liest der neue Code
 * alles, was ein alter gespeichert hat, und die App schickt dem alten weiter,
 * was er versteht.
 *
 * WAS ES DARF UND TUT
 * - Google fragt nach Zugriff auf alle deine Kalender; so ist CalendarApp
 *   gebaut. Das Skript fasst aber nur seinen eigenen Kalender „Workout" an,
 *   und dort nur Termine, die es selbst angelegt hat (eine unsichtbare
 *   Markierung am Termin). Von Hand eingetragene oder eingelesene Termine
 *   bleiben, wie sie sind. Das ist eine Regel dieses Codes, keine Sperre von
 *   Google.
 * - Seine eigenen Termine überschreibt es beim nächsten Abgleich: Uhrzeit
 *   (Standard 17:30) und Erinnerung stellst du in der App ein.
 * - Ein Jahr Termine anzulegen dauert länger, als ein Lauf darf (sechs
 *   Minuten bei Google). Das Skript macht deshalb die nächsten Tage zuerst,
 *   hört nach gut vier Minuten auf und macht ein paar Minuten später weiter
 *   (ein einmaliger Auslöser „weiter"), bis alles steht. Die Beschreibung des
 *   Kalenders sagt, bis wann die Termine stehen und wie viel noch offen ist.
 * - Gespeichert wird nur die letzte Vorschau (Tage, Titel, Übungen) in den
 *   Skript-Eigenschaften dieses Projekts – in deinem Konto, sonst nirgends.
 *   Das Kennwort wird nicht mitgespeichert.
 *
 * GEHEIM ist nur die Zeile mit TOKEN. Wer sie und die URL kennt, kann Termine
 * in „Workout" schreiben, sonst nichts. Den Code deshalb nicht weitergeben.
 *
 * Herkunft: kalender/workout-kalender.gs der Workout-App, Prüfung in
 * tests/test-kalender-gas.mjs. Den Vertrag mit der App beschreibt
 * js/kalender-vorschau.js (Fassung 2); die Regeln unten (nutzlastPruefen_,
 * sendungVergleichen_, vorschauFuer_, fernListe_, bleibtStehen_) sind von
 * dort Zeile für Zeile übernommen. Funktionen mit _ am Ende sind intern –
 * Apps Script zeigt sie oben in der Auswahl nicht an.
 */

// Das Kennwort dieses Kalenders. Die App setzt es beim „Code kopieren" ein;
// der Platzhalter kommt in dieser Datei genau einmal vor.
const TOKEN = '<<KENNWORT-AUS-DER-APP>>';

// Die Fassung dieses Codes. Sie steht in jeder Antwort und in der Beschreibung
// des Kalenders. Daran wählt die App, was sie schickt (ab Fassung 2 die
// Ferne), und ist sie älter als die, die die App mitbringt, bittet die App um
// neuen Code.
const FASSUNG = 2;

const KALENDER_NAME = 'Workout';
const ZONE = 'Europe/Berlin';
// Nie umbenennen: Der Auslöser ruft die Funktion bei diesem Namen, auch einer,
// den eine ältere Fassung angelegt hat.
const AUSLOESER = 'stuendlich';
// Der einmalige Auslöser, der einen Lauf fortsetzt, der nicht fertig wurde.
const FOLGE = 'weiter';

// Tobis Probe vom 26.10.2026: Kalender „Workout-Probe", seine id in „kal".
const PROBE_NAME = 'Workout-Probe';
const PROBE_EIGENSCHAFT = 'kal';

// Der Vertrag (js/kalender-vorschau.js). Fassung 1 und 2 werden angenommen.
const VORSCHAU_V = 2;
const VORSCHAU_MAX_BYTES = 64 * 1024;
const VORSCHAU_MAX_BYTES_2 = 192 * 1024;
const FERNE_MAX = 400;
const KENNUNG_MUSTER = /^[a-z0-9]{1,24}-\d{1,4}-z?\d{1,4}$/;
const TAG = /^\d{4}-\d{2}-\d{2}$/;
const ZEICHEN = /^[A-Za-z0-9_-]+$/;
// Was von einer Sendung aufbewahrt wird – alles außer dem Kennwort.
const FELDER = ['v', 'geraet', 'seq', 'gesendet', 'app', 'minuten', 'erinnerung', 'ab', 'fenster', 'stand', 'texte', 'tage', 'ferne'];

// Der Speicher (Skript-Eigenschaften). Format 1: die Sendung als JSON in
// Stücken (Google erlaubt 9 KB je Wert, 500 KB insgesamt), dazu eine kleine
// Meta-Zeile, die sagt, welche Stücke gelten. Fassung 2 schreibt dasselbe
// Format – eine Sendung mit Ferne ist nur länger.
const SPEICHER_FORMAT = 1;
const P_KALENDER = 'workout.kalender';
const P_PROJEKT = 'workout.projekt';
const P_META = 'workout.meta';
const P_TEIL = 'workout.teil.';
const P_ABGLEICH = 'workout.abgleich';
const P_OFFEN = 'workout.offen';
// Der Anfang des Fensters der zuletzt ganz angeglichenen Liste – davor kann
// kein offener eigener Termin mehr liegen (siehe angleichArbeit_()).
const P_LISTE = 'workout.liste';
// Welche Sendung an welchem Tag zuletzt samt Ferne ganz angeglichen ist –
// solange beides gleich bleibt, prüft ein Lauf nur noch die Nähe.
const P_FERNE = 'workout.ferne';
const TEIL_BYTES = 8000;

// Die unsichtbaren Markierungen am Termin.
const T_KENNUNG = 'workout';          // <fokus>-<runde>-<n>, wie in der Vorschau
const T_QUELLE = 'workoutSkript';     // von diesem Skript angelegt (Projekt-Kennung)
const T_TEXT = 'workoutText';         // Fingerabdruck der Beschreibung, die es gesetzt hat
const T_HINWEIS = 'workoutHinweis';   // der Hinweis „Vorschau aufgebraucht"
const HINWEIS_ART = '!hinweis';

// Zeit und Kontingent schonen. Ein Lauf darf bei Google sechs Minuten; nach
// viereinhalb hört dieser auf, und der Rest kommt im nächsten. Die Antwort an
// die App wartet nicht so lange: Sie wartet höchstens 45 Sekunden, also gleicht
// doPost nur 25 Sekunden lang an – das Nächste zuerst – und überlässt den Rest
// dem Auslöser.
const ZEIT_BUDGET_MS = 4.5 * 60 * 1000;
const POST_BUDGET_MS = 25 * 1000;
const MAX_AENDERUNGEN = 400;
const PAUSE_MS = 100;
// Bleibt so viel offen (oder etwas aus den nächsten vier Wochen), kommt der
// Rest nicht erst in einer Stunde, sondern nach ein paar Minuten (FOLGE).
const FOLGE_AB = 10;
const FOLGE_MS = 3 * 60 * 1000;
// So weit vor und hinter dem Fenster sucht der Abgleich noch nach einem Termin
// derselben Einheit, um ihn zu verschieben statt einen zweiten anzulegen.
const SUCHE_ZURUECK = 35;
const SUCHE_VORAUS = 7;
// Nach dem Abschalten: so weit voraus räumt das Skript seine Termine weg.
const AUS_VORAUS = FERNE_MAX + SUCHE_VORAUS;

const SPAETER = 'Google bremst gerade – der Rest folgt mit dem nächsten stündlichen Abgleich.';
const TAGESKONTINGENT = 'Google lässt heute keine weiteren Kalender-Änderungen zu (Tageskontingent aufgebraucht) – morgen geht es von selbst weiter.';

/* ------------------------------------------------------------------ *
 * Was du oben auswählen kannst
 * ------------------------------------------------------------------ */

/**
 * Einmal von Hand ausführen. Räumt die Probe weg, legt den Kalender „Workout"
 * an oder findet den eigenen wieder, legt genau einen stündlichen Auslöser an
 * und sagt im Protokoll, was es getan hat. Beliebig oft wiederholbar, ohne
 * dass etwas doppelt entsteht. Nach einer neuen Fassung des Codes nur nötig,
 * wenn das Skript oder die App darum bittet.
 */
function einrichten() {
  // Mit „einzelnen Häkchen" im Zustimmungsdialog fragt Google sonst nur
  // einen Teil der Rechte ab, und der Auslöser scheitert später still.
  ScriptApp.requireAllScopes(ScriptApp.AuthMode.FULL);
  const P = PropertiesService.getScriptProperties();
  const melde = melder_();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error('Gerade läuft ein Abgleich. In einer Minute noch einmal „einrichten" ausführen.');
  }
  try {
    melde('Workout-Kalender, Fassung ' + FASSUNG + ': einrichten');
    probeWegraeumen_(P, melde);
    kalenderSichern_(P, melde, true);
    ausloeserNeu_(melde);
    melde(tokenGesetzt_()
      ? '✓ Das Kennwort steht im Code.'
      : '✗ Im Code fehlt das Kennwort. In der App unter Mehr → Kalender „Code kopieren" und hier alles ersetzen.');
    const meta = metaLesenSanft_(P);
    if (meta && !meta.aus) melde(zusammenfassung_(abgleichenSicher_(P, ZEIT_BUDGET_MS)));
    else if (meta) melde('– In der App abgeschaltet: Das Skript gleicht nichts an, bis wieder eine Vorschau kommt.');
    else melde('– Noch keine Vorschau von der App. Bis sie kommt, bleibt der Kalender leer.');
    melde('Nächster Schritt: Bereitstellen → Bereitstellungen verwalten → Bearbeiten (Stift) → '
      + 'Version: Neue Version → Bereitstellen. Danach in der App „Verbinden" – ist sie schon verbunden, '
      + 'merkt sie den neuen Code von selbst.');
  } finally {
    lock.releaseLock();
  }
  if (!tokenGesetzt_()) {
    throw new Error('Im Code fehlt das Kennwort – in der App „Code kopieren" und hier alles ersetzen. '
      + '(Kalender und Auslöser sind trotzdem eingerichtet.)');
  }
  return melde.zeilen.join('\n');
}

/**
 * Läuft jede Stunde von selbst (Auslöser). Gleicht den Kalender mit der Liste
 * für heute an. Bemerkt das Skript einen Fehler, wirft es – dann schickt
 * Google eine Mail („Summary of failures"), statt dass es still stehen bleibt.
 */
function stuendlich() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    console.log('Gerade läuft schon ein Abgleich – er macht auch den Rest, oder die nächste Stunde.');
    return null;
  }
  let r;
  try {
    r = abgleichenSicher_(PropertiesService.getScriptProperties(), ZEIT_BUDGET_MS);
  } finally {
    lock.releaseLock();
  }
  console.log(zusammenfassung_(r));
  if (r.fehler) throw new Error(r.fehler);
  return r;
}

/** Dasselbe von Hand: jetzt gleich abgleichen. */
function abgleichen() {
  return stuendlich();
}

/**
 * Läuft von selbst ein paar Minuten nach einem Lauf, der nicht fertig wurde –
 * ein Jahr Termine anzulegen dauert länger, als ein Lauf darf. Räumt seinen
 * einmaligen Auslöser weg und gleicht weiter an; bleibt wieder viel offen,
 * legt der Lauf den nächsten an.
 */
function weiter() {
  try {
    ScriptApp.getProjectTriggers().forEach((t) => {
      if (t.getHandlerFunction() === FOLGE) ScriptApp.deleteTrigger(t);
    });
  } catch (err) {
    console.log('Den einmaligen Auslöser konnte das Skript nicht wegräumen: ' + bereinigt_(err));
  }
  return stuendlich();
}

/**
 * Hier kommt die App an. Klein und stabil: prüfen, ablegen, abgleichen
 * versuchen – und immer mit JSON antworten, auch bei jedem Fehler. Sonst sähe
 * die App nur einen CORS-Fehler und könnte nicht sagen, was los ist.
 */
function doPost(e) {
  let a;
  try {
    a = annehmen_(e);
  } catch (err) {
    a = antwort_(false, 'fehler', { hinweis: 'Unerwarteter Fehler im Skript: ' + bereinigt_(err) });
  }
  return ausgabe_(a);
}

/**
 * Ein Lebenszeichen für den Browser – ohne Kennwort, ohne Stand, ohne
 * Kalender-ID, und ohne einen Blick in den Speicher: doGet ist öffentlich
 * („Zugriff: Jeder"), und wer nur die URL hat, soll damit kein Kontingent
 * leeren (Skript-Eigenschaften: 50 000 Zugriffe am Tag). Wie es steht, sagt
 * „Verbinden" (probe) – die braucht das Kennwort. Die App fragt doGet nur,
 * wenn „Verbinden" keine lesbare Antwort bekam: Antwortet es, ist der neue
 * Code bereitgestellt und „Zugriff: Jeder" gesetzt.
 */
function doGet(e) {
  return ausgabe_(antwort_(true, 'status', {
    kennwort: tokenGesetzt_(),
    hinweis: tokenGesetzt_() ? undefined : 'Im Code fehlt das Kennwort – in der App „Code kopieren".',
  }));
}

/* ------------------------------------------------------------------ *
 * Annehmen
 * ------------------------------------------------------------------ */

function annehmen_(e) {
  const body = e && e.postData && typeof e.postData.contents === 'string' ? e.postData.contents : null;
  if (body === null) return antwort_(false, 'format', { hinweis: 'Keine Daten angekommen.' });
  // Vor dem Lesen: Was über der Grenze liegt, wird gar nicht erst ausgepackt.
  if (utf8Bytes_(body) > VORSCHAU_MAX_BYTES_2) return antwort_(false, 'format', { hinweis: 'Zu groß – höchstens 192 KiB.' });
  let n;
  try {
    n = JSON.parse(body);
  } catch (err) {
    // Die Meldung von JSON.parse zitiert den Text – nicht zurückgeben.
    return antwort_(false, 'format', { hinweis: 'Kein JSON.' });
  }
  if (!n || typeof n !== 'object' || Array.isArray(n)) return antwort_(false, 'format', { hinweis: 'Kein Objekt.' });
  if (!tokenGesetzt_()) {
    return antwort_(false, 'token', { hinweis: 'Im Skript steht noch kein Kennwort – in der App „Code kopieren" und in Apps Script alles ersetzen.' });
  }
  if (!gleich_(typeof n.token === 'string' ? n.token : '', TOKEN)) {
    return antwort_(false, 'token', { hinweis: 'Das Kennwort passt nicht – in der App „Code kopieren" und in Apps Script alles ersetzen.' });
  }
  const grund = nutzlastPruefen_(n);
  if (grund) {
    let hinweis = 'Die Sendung passt nicht zum Vertrag (' + grund + ').';
    if (grund === 'v') hinweis = 'Die App ist neuer als dieses Skript – „Kalender-Code erneuern".';
    if (grund === 'groesse') hinweis = 'Zu groß – höchstens ' + (n.v === 2 ? '192' : '64') + ' KiB.';
    return antwort_(false, 'format', { hinweis: hinweis });
  }
  const P = PropertiesService.getScriptProperties();
  if (n.probe === true) return probeAntwort_(P);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    return antwort_(false, 'fehler', { hinweis: 'Das Skript ist gerade beschäftigt – die App schickt es später noch einmal.' });
  }
  try {
    // Ein unlesbarer Speicher heilt mit der nächsten gültigen Sendung.
    const alt = metaLesenSanft_(P);
    if (n.aus === true) return abschalten_(P, n, alt);
    const urteil = sendungVergleichen_(alt, n);
    if (urteil === 'alt' || urteil === 'aelter') {
      return antwort_(false, urteil, {
        stand: alt.stand || null,
        seq: alt.seq,
        hinweis: urteil === 'alt'
          ? 'Eine frühere Sendung dieses Geräts – die spätere gilt schon.'
          : 'Ein anderes Gerät hat zuletzt trainiert – der Kalender bleibt bei dessen Plan.',
      });
    }
    const meta = urteil === 'neu' ? speichern_(P, n) : alt;
    // Nie „einrichten" ausgeführt, aber die Probe ist noch da – naheliegend,
    // Tobi hat bei der Probe schon eine Funktion dieses Namens ausgeführt.
    // Dann räumt die erste Vorschau sie weg, wie einrichten() es täte.
    let probeHinweis = null;
    if (P.getProperty(PROBE_EIGENSCHAFT)) {
      try {
        const z = melder_();
        probeWegraeumen_(P, z);
        probeHinweis = 'Die Probe ist weggeräumt (Kalender „' + PROBE_NAME + '").';
      } catch (err) {
        probeHinweis = 'Die Probe ließ sich nicht wegräumen – in Apps Script einmal „einrichten" ausführen.';
      }
    }
    // Erst den Auslöser: Den Rest des Abgleichs macht er.
    let auslHinweis = null;
    try {
      auslHinweis = ausloeserSichern_(P);
    } catch (err) {
      auslHinweis = 'Den stündlichen Auslöser konnte das Skript nicht prüfen – in Apps Script „einrichten" ausführen.';
    }
    const r = abgleichenSicher_(P, POST_BUDGET_MS);
    // Was offen bleibt, steht in offen, stehen und folge – daraus macht die
    // App ihren eigenen Satz, auch später, wenn eine Probe den neuen Stand
    // holt. Im Hinweis stünde es sonst doppelt und bald veraltet.
    return antwort_(true, urteil === 'neu' ? 'angekommen' : 'gleich', {
      tag: r.tag,
      geaendert: r.geaendert,
      offen: r.offen,
      bis: r.bis,
      stehen: r.vollBis,
      folge: r.offen ? !!r.folge : null,
      stand: meta.stand,
      seq: meta.seq,
      hinweis: r.fehler || r.hinweis || (r.fremd ? null : auslHinweis) || probeHinweis || undefined,
    });
  } finally {
    lock.releaseLock();
  }
}

/** „Verbinden": nichts speichern, nur sagen, wie es steht. */
function probeAntwort_(P) {
  const meta = metaLesenSanft_(P);
  const kid = P.getProperty(P_KALENDER);
  const kal = kid ? CalendarApp.getCalendarById(kid) : null;
  const ausloeser = ScriptApp.getProjectTriggers().some((t) => t.getHandlerFunction() === AUSLOESER);
  const letzter = jsonSanft_(P.getProperty(P_ABGLEICH));
  const besitzer = kal ? besitzer_(kal) : null;
  let hinweis;
  if (kid && !kal) hinweis = 'Der Kalender „Workout" fehlt – in Apps Script „einrichten" noch einmal ausführen.';
  else if (besitzer && besitzer !== P.getProperty(P_PROJEKT)) {
    hinweis = 'Den Kalender „Workout" pflegt ein anderes Skript-Projekt – diese URL gehört zum alten. Die URL des neuen nehmen, oder hier „einrichten" ausführen.';
  } else if (!ausloeser) hinweis = 'Verbunden, aber ohne stündlichen Auslöser – in Apps Script „einrichten" ausführen.';
  else if (!meta && P.getProperty(PROBE_EIGENSCHAFT)) {
    hinweis = 'Verbunden. Die erste Vorschau räumt die Probe weg (Kalender „' + PROBE_NAME + '") und legt „Workout" an.';
  } else if (meta && meta.aus) hinweis = 'Verbunden. In der App abgeschaltet – es geht weiter, sobald wieder eine Vorschau kommt.';
  else if (!meta) hinweis = 'Verbunden. Noch keine Vorschau angekommen' + (kal ? '.' : ' – der Kalender „Workout" entsteht mit der ersten.');
  else {
    hinweis = 'Verbunden.' + (letzter ? ' Zuletzt abgeglichen ' + zeitDe_(letzter.zeit) + '.' : '')
      + (letzter && letzter.offen ? ' Noch ' + letzter.offen + (letzter.offen === 1 ? ' Änderung' : ' Änderungen') + ' offen.' : '');
  }
  // Wie weit der letzte Abgleich kam – die App fragt so nach, solange das
  // Skript das Jahr noch einträgt.
  return antwort_(true, 'probe', {
    tag: letzter ? letzter.tag : null,
    offen: letzter && Number.isInteger(letzter.offen) ? letzter.offen : null,
    bis: letzter && letzter.bis ? letzter.bis : null,
    stehen: letzter && letzter.stehen ? letzter.stehen : null,
    folge: letzter && letzter.offen ? !!letzter.folge : null,
    stand: meta && !meta.aus ? meta.stand : null,
    seq: meta ? meta.seq : null,
    hinweis: hinweis,
  });
}

/**
 * „Abschalten": eigene Termine ab heute weg, die Vorschau weg, nichts mehr
 * angleichen, bis wieder eine kommt. Von jedem Gerät mit dem Kennwort – nur
 * eine verspätete frühere Sendung desselben Geräts zählt nicht mehr.
 */
function abschalten_(P, n, alt) {
  if (alt && alt.geraet === n.geraet && sendungVergleichen_(alt, n) === 'alt') {
    return antwort_(false, 'alt', { stand: alt.stand || null, seq: alt.seq, hinweis: 'Eine frühere Sendung dieses Geräts – die spätere gilt schon.' });
  }
  const meta = {
    format: SPEICHER_FORMAT, aus: true, geraet: n.geraet, seq: n.seq, gesendet: n.gesendet, stand: null, empfangen: Date.now(),
  };
  P.setProperty(P_META, JSON.stringify(meta));
  teileAufraeumen_(P, null);
  const r = abgleichenSicher_(P, POST_BUDGET_MS);
  return antwort_(true, 'aus', {
    geaendert: r.geaendert, offen: r.offen, seq: n.seq, hinweis: r.fehler || (r.gebremst ? SPAETER : offenSatz_(r)) || undefined,
  });
}

/* ------------------------------------------------------------------ *
 * Der Abgleich
 * ------------------------------------------------------------------ */

/** Wie abgleichen_(), wirft aber nie – das Ergebnis sagt, was war. */
function abgleichenSicher_(P, budget) {
  let r;
  try {
    r = abgleichen_(P, budget);
  } catch (err) {
    if (tagesKontingent_(err)) r = leer_({ fehler: TAGESKONTINGENT });
    else if (zuOft_(err)) r = leer_({ spaeter: true, gebremst: true, hinweis: SPAETER });
    else r = leer_({ fehler: 'Abgleich gescheitert: ' + bereinigt_(err) });
  }
  if (r.gelaufen !== false) {
    try {
      P.setProperty(P_ABGLEICH, JSON.stringify({
        zeit: Date.now(), tag: r.tag, geaendert: r.geaendert, offen: r.offen, bis: r.bis, stehen: r.vollBis, folge: !!r.folge,
        spaeter: r.spaeter, fehler: !!r.fehler,
      }));
    } catch (err) {
      // Nur eine Auskunft für „Verbinden" – der Abgleich selbst ist durch.
    }
  }
  return r;
}

/** Ein leeres Ergebnis eines Abgleichs, mit dem, was schon feststeht. */
function leer_(mehr) {
  const r = {
    tag: null, geaendert: null, offen: null, bis: null, vollBis: null, spaeter: false, gebremst: false, folge: false,
    hinweis: null, fehler: null,
  };
  Object.keys(mehr || {}).forEach((k) => {
    r[k] = mehr[k];
  });
  return r;
}

/**
 * Den Kalender an die Liste für heute angleichen – die Nähe und, bei einer
 * Sendung der Fassung 2, die Ferne bis ein Jahr voraus. Ein Skript, das noch
 * keine Vorschau angenommen hat, fasst ihn gar nicht an – ein zweites,
 * vergessenes Projekt räumt so nicht im Kalender des ersten herum.
 *
 * `budget`: so lange darf es dauern (doPost kurz, der Auslöser länger). Was
 * nicht fertig wird, macht der nächste Lauf – das Nächste zuerst: die nächsten
 * vier Wochen, dann die letzten Tage, dann die Ferne der Reihe nach.
 *
 * Die Ferne wird nur geprüft, wenn sich etwas geändert haben kann: eine neue
 * Sendung, ein neuer Tag, oder der letzte Lauf wurde nicht fertig. Eine
 * Stunde wie die davor prüft nur die Nähe (P_FERNE) – sonst läse jede Stunde
 * rund 200 Termine, von denen sich nichts bewegt hat.
 */
function abgleichen_(P, budget) {
  const start = Date.now();
  const r = leer_();
  // Wirft bei kaputtem Speicher: Dann bleibt der Kalender, wie er ist.
  const meta = metaLesen_(P);
  if (!meta) {
    r.hinweis = 'Noch keine Vorschau von der App – das Skript fasst den Kalender nicht an.';
    r.gelaufen = false;
    return r;
  }
  if (meta.aus) {
    r.hinweis = 'In der App abgeschaltet – das Skript gleicht nichts an, bis wieder eine Vorschau kommt.';
    // Abgeschaltet und den Kalender gelöscht: Das ist Aufräumen, kein Fehler.
    const kid = P.getProperty(P_KALENDER);
    if (!kid || !CalendarApp.getCalendarById(kid)) return r;
  }
  const kal = kalenderSichern_(P, stumm_, false);
  if (!kal) {
    r.fehler = 'Der Kalender „Workout" fehlt (gelöscht?). In Apps Script „einrichten" noch einmal ausführen.';
    return r;
  }
  const projekt = projektKennung_(P);
  const besitzer = besitzer_(kal);
  if (besitzer && besitzer !== projekt) {
    // Zuletzt eingerichtet hat ein anderes Projekt. Dieses hier legt sich
    // schlafen, statt im selben Kalender gegen das andere anzuschreiben.
    ausloeserAus_();
    r.fremd = true;
    r.hinweis = 'Den Kalender „Workout" pflegt inzwischen ein anderes Skript-Projekt. Dieses hier fasst ihn nicht mehr an '
      + 'und hat seinen Auslöser abgeschaltet – in der App die neue URL nehmen, oder hier „einrichten" ausführen.';
    return r;
  }
  offenNachholen_(P, kal, projekt);
  const heute = tagIn_(new Date());
  if (meta.aus) {
    nachLauf_(r, abarbeiten_(eigeneAbHeute_(kal, heute), start, budget, r), heute);
    beschreibungSchreiben_(kal, projekt, meta, r);
    return r;
  }
  const n = vorschauLesen_(P, meta);
  const wahl = vorschauFuer_(n.tage, heute);
  if (!wahl) {
    r.hinweis = 'Die Vorschau beginnt erst am ' + datumDe_(n.ab) + ' – bis dahin bleibt der Kalender, wie er ist.';
  } else if (wahl.aufgebraucht) {
    // Sechs Wochen ohne neue Sendung: nichts mehr verschieben – geraten wäre
    // jeder weitere Tag. Stattdessen ein Hinweis-Termin, der auffällt.
    r.hinweis = 'Die Vorschau ist aufgebraucht: Die App hat seit ' + datumDe_(n.ab) + ' keinen neuen Plan geschickt, und sie reichte bis '
      + datumDe_(meta.bis) + '. Der Kalender verschiebt deshalb nicht mehr – einmal die App mit Netz öffnen.';
    nachLauf_(r, abarbeiten_(hinweisArbeit_(P, kal, heute, n, projekt, meta), start, budget, r), heute);
  } else {
    r.tag = wahl.tag;
    const zweite = n.v === 2 && !!n.ferne;
    const nahBis = plusTage_(heute, n.fenster[1]);
    r.bis = zweite ? plusTage_(heute, n.ferne.bis) : nahBis;
    const fertig = jsonSanft_(P.getProperty(P_FERNE));
    const voll = zweite && !(fertig && fertig.gen === meta.gen && fertig.heute === heute);
    const umfang = voll
      ? { bis: r.bis, oben: plusTage_(heute, FERNE_MAX + SUCHE_VORAUS), weg: true }
      : { bis: nahBis, oben: plusTage_(nahBis, SUCHE_VORAUS), weg: false };
    const liste = wahl.liste.concat(fernListe_(n, wahl.tag));
    nachLauf_(r, abarbeiten_(angleichArbeit_(P, kal, n, liste, heute, projekt, umfang), start, budget, r), heute);
    // Ganz angeglichen: Ab jetzt liegt kein offener eigener Termin mehr vor
    // dem Fenster dieser Liste – und die Ferne steht bis zu ihrem Ende. Nicht
    // nach einem halben Lauf: dann gilt die frühere, weitere Grenze, und der
    // nächste Lauf prüft die Ferne noch einmal.
    if (!r.offen && !r.fehler) {
      try {
        P.setProperty(P_LISTE, plusTage_(heute, -n.fenster[0]));
        if (voll) P.setProperty(P_FERNE, JSON.stringify({ gen: meta.gen, heute: heute, bis: r.bis }));
      } catch (err) {
        // Nur Suchgrenzen – ohne sie sucht der nächste Lauf wie bisher.
      }
    }
  }
  beschreibungSchreiben_(kal, projekt, meta, r);
  return r;
}

/**
 * Nach dem Abarbeiten: wie viel offen blieb, bis wann die Termine schon
 * stehen, und ob ein Folge-Auslöser den Rest in ein paar Minuten macht.
 */
function nachLauf_(r, rest, heute) {
  r.offen = (r.offen || 0) + rest.length;
  const kommend = rest.filter((a) => a.datum >= heute).map((a) => a.datum).sort();
  if (!r.bis) r.vollBis = null;
  else if (!rest.length) r.vollBis = r.bis;
  else r.vollBis = kommend.length && kommend[0] > heute ? plusTage_(kommend[0], -1) : null;
  if (r.vollBis && r.vollBis > r.bis) r.vollBis = r.bis;
  if (r.offen && !r.gebremst && !r.fehler) {
    const nah = rest.some((a) => a.rang.charAt(0) === '0' || a.rang.charAt(0) === '1');
    r.folge = folgeSichern_(r.offen >= FOLGE_AB || nah);
  }
  if (r.gebremst) r.hinweis = SPAETER;
}

/** Ein Satz zu dem, was offen blieb – für die Antwort an die App. */
function offenSatz_(r) {
  if (!r || !r.offen || r.gebremst) return null;
  return 'Noch ' + r.offen + (r.offen === 1 ? ' Änderung' : ' Änderungen') + ' offen – '
    + (r.folge ? 'das Skript trägt sie in den nächsten Minuten nach.' : 'sie folgen mit dem nächsten stündlichen Abgleich.');
}

/** Den einmaligen Folge-Auslöser anlegen, wenn nötig und noch keiner da ist. true, wenn einer kommt. */
function folgeSichern_(noetig) {
  if (!noetig) return false;
  try {
    if (ScriptApp.getProjectTriggers().some((t) => t.getHandlerFunction() === FOLGE)) return true;
    ScriptApp.newTrigger(FOLGE).timeBased().after(FOLGE_MS).create();
    return true;
  } catch (err) {
    // Dann eben der nächste stündliche Lauf.
    return false;
  }
}

/**
 * Was zu tun ist, damit der Kalender die Liste zeigt – als Arbeitsliste, nur
 * mit dem, was sich wirklich ändert, das Nächste zuerst (rangFuer_()).
 *
 * Je Eintrag genau ein eigener Termin, wiedergefunden über die Kennung –
 * verschoben, nicht neu angelegt, auch wenn er knapp außerhalb des Fensters
 * liegt; Termine von Fassung 1 sind dieselben. Ein eigener Termin im Fenster
 * ohne Eintrag kommt weg oder bleibt stehen, wie bleibtStehen_() es sagt.
 * Hinter dem Fenster: bei Fassung 2 weg (die App hat die Ferne gekürzt),
 * sonst bleibt er. Fremde Termine (ohne Markierung) fasst das Skript nie an.
 *
 * `umfang` { bis, oben, weg }: bis wohin dieser Lauf angleicht, bis wohin er
 * sucht, und ob eigene Termine hinter `bis` wegkommen. Ein Eintrag hinter
 * `bis` bleibt in diesem Lauf, wie er ist.
 */
function angleichArbeit_(P, kal, n, liste, heute, projekt, umfang) {
  const von = plusTage_(heute, -n.fenster[0]);
  const rang = rangFuer_(heute, plusTage_(heute, n.fenster[1]));
  // Gesucht wird bis 35 Tage vor dem Fenster – und mindestens bis zum Fenster
  // der zuletzt ganz angeglichenen Liste (P_LISTE): War die Vorschau lange
  // aufgebraucht (sechs Wochen und mehr ohne Sendung), stehen ihre offenen
  // Termine weit vor dem heutigen Fenster. Ohne diese Grenze fände der
  // Abgleich sie nicht, legte jede Einheit neu an, und die alten stünden für
  // immer doppelt da (gemessen bei der Prüfung: 17 nach zwölf Wochen).
  let unten = plusTage_(von, -SUCHE_ZURUECK);
  const zuletzt = P.getProperty(P_LISTE);
  if (zuletzt && TAG.test(zuletzt) && zuletzt < unten) unten = zuletzt;
  const vorhanden = kal.getEvents(beginn_(unten), beginn_(plusTage_(umfang.oben, 1)));
  const eigene = {};
  const arbeit = [];
  vorhanden.forEach((ev) => {
    if (!ev.getTag(T_QUELLE)) return;
    if (ev.getTag(T_HINWEIS)) {
      // Der Hinweis „aufgebraucht" ist erledigt, sobald wieder eine Liste gilt.
      arbeit.push({ datum: heute, rang: rang(heute), tun: () => loeschen_(ev) });
      return;
    }
    const k = ev.getTag(T_KENNUNG);
    if (!k || !KENNUNG_MUSTER.test(k)) return;
    (eigene[k] = eigene[k] || []).push({ ev: ev, datum: tagIn_(ev.getStartTime()) });
  });
  const alle = {};
  liste.forEach((e) => {
    if (!alle[e[0]]) alle[e[0]] = e;
  });
  Object.keys(alle).forEach((k) => {
    const e = alle[k];
    if (e[1] > umfang.bis) return;
    const soll = terminSoll_(e, n);
    // Liegt einer schon am richtigen Tag, bleibt der; weitere derselben
    // Einheit sind doppelt und kommen weg.
    const da = (eigene[k] || []).slice().sort((a, b) => (a.datum === e[1] ? 0 : 1) - (b.datum === e[1] ? 0 : 1));
    const behalten = da.length ? da[0].ev : null;
    if (!behalten || terminAnders_(behalten, soll, projekt)) {
      arbeit.push({ datum: e[1], rang: rang(e[1]), tun: () => terminAngleichen_(P, kal, behalten, soll, projekt) });
    }
    da.slice(1).forEach((x) => arbeit.push({ datum: x.datum, rang: rang(x.datum), tun: () => loeschen_(x.ev) }));
  });
  Object.keys(eigene).forEach((k) => {
    if (alle[k]) return;
    eigene[k].forEach((x) => {
      if (x.datum < von) return;
      if (x.datum > umfang.bis) {
        if (umfang.weg) arbeit.push({ datum: x.datum, rang: rang(x.datum), tun: () => loeschen_(x.ev) });
        return;
      }
      if (bleibtStehen_({ kennung: k, datum: x.datum }, liste, heute)) return;
      arbeit.push({ datum: x.datum, rang: rang(x.datum), tun: () => loeschen_(x.ev) });
    });
  });
  return arbeit.sort(nachRang_);
}

/**
 * Wie dringend eine Änderung ist: heute und die nächsten vier Wochen zuerst,
 * aufsteigend; dann die letzten Tage, von gestern rückwärts; dann die Ferne,
 * aufsteigend – die nächsten Wochen stimmen so nach jedem Lauf, bevor die
 * Ferne drankommt.
 */
function rangFuer_(heute, nahBis) {
  return (d) => {
    if (d < heute) return '1' + String(99999999 - Number(d.replace(/-/g, '')));
    return (d <= nahBis ? '0' : '2') + d;
  };
}

function nachRang_(a, b) {
  if (a.rang === b.rang) return 0;
  return a.rang < b.rang ? -1 : 1;
}

/** Wie ein Eintrag im Kalender stehen soll. */
function terminSoll_(e, n) {
  const fertig = e[4] === 1;
  const text = n.texte[e[3]];
  const beginn = zeitpunkt_(e[1], n.minuten);
  return {
    kennung: e[0],
    titel: (fertig ? '✓ ' : '') + text[0],
    beschreibung: text[1],
    abdruck: abdruck_(text[1]),
    beginn: beginn,
    ende: new Date(beginn.getTime() + e[2] * 60000),
    erinnerung: !fertig && n.erinnerung > 0 ? [n.erinnerung] : [],
  };
}

/** Steht ein eigener Termin anders da, als er soll? Nur lesen. */
function terminAnders_(ev, s, projekt) {
  return ev.getStartTime().getTime() !== s.beginn.getTime() || ev.getEndTime().getTime() !== s.ende.getTime()
    || ev.getTitle() !== s.titel || ev.getTag(T_TEXT) !== s.abdruck || !erinnerungStimmt_(ev, s.erinnerung)
    || ev.getTag(T_QUELLE) !== projekt;
}

/**
 * Ein Termin wie im Eintrag – angelegt, oder nur geändert, was nicht stimmt:
 * Verschieben ist ein Schreibzugriff, Titel, Beschreibung und Erinnerung nur,
 * wenn sie anders sind. Gibt 1 bei einer Änderung, sonst 0.
 */
function terminAngleichen_(P, kal, ev, s, projekt) {
  if (!ev) {
    const neu = kal.createEvent(s.titel, s.beginn, s.ende, { description: s.beschreibung });
    markieren_(P, neu, s.kennung, projekt, s.abdruck);
    // Immer, nicht nur bei einer Abweichung: Ein neuer Termin trägt die
    // Voreinstellung des Kalenders, und ob getPopupReminders() die meldet,
    // ist nicht belegt. Sonst behielten erledigte Termine und alle bei „keine
    // Erinnerung" sie still.
    erinnerungSetzen_(neu, s.erinnerung);
    Utilities.sleep(PAUSE_MS);
    return 1;
  }
  let anders = false;
  if (ev.getStartTime().getTime() !== s.beginn.getTime() || ev.getEndTime().getTime() !== s.ende.getTime()) {
    ev.setTime(s.beginn, s.ende);
    anders = true;
  }
  if (ev.getTitle() !== s.titel) {
    ev.setTitle(s.titel);
    anders = true;
  }
  // Verglichen wird der Fingerabdruck dessen, was das Skript gesetzt hat –
  // nicht der Text, den Google zurückgibt: Formt Google ihn um (Zeilenenden,
  // HTML), schriebe das Skript sonst jede Stunde jede Beschreibung neu.
  if (ev.getTag(T_TEXT) !== s.abdruck) {
    ev.setDescription(s.beschreibung);
    ev.setTag(T_TEXT, s.abdruck);
    anders = true;
  }
  if (!erinnerungStimmt_(ev, s.erinnerung)) {
    erinnerungSetzen_(ev, s.erinnerung);
    anders = true;
  }
  if (ev.getTag(T_QUELLE) !== projekt) {
    ev.setTag(T_QUELLE, projekt);
    anders = true;
  }
  return anders ? 1 : 0;
}

/**
 * Ein neuer Termin bekommt seine Markierung. Zwischen Anlegen und Markieren
 * kann Google bremsen – dann stünde ein Termin ohne Markierung da, sähe aus
 * wie ein fremder und bliebe für immer doppelt. Darum merkt sich das Skript
 * die id vorher; der nächste Lauf holt die Markierung nach (offenNachholen_()).
 */
function markieren_(P, ev, art, projekt, abdruck) {
  const offen = jsonSanft_(P.getProperty(P_OFFEN)) || {};
  offen[ev.getId()] = art;
  P.setProperty(P_OFFEN, JSON.stringify(offen));
  if (art === HINWEIS_ART) ev.setTag(T_HINWEIS, '1');
  else ev.setTag(T_KENNUNG, art);
  ev.setTag(T_QUELLE, projekt);
  ev.setTag(T_TEXT, abdruck);
  delete offen[ev.getId()];
  if (Object.keys(offen).length) P.setProperty(P_OFFEN, JSON.stringify(offen));
  else P.deleteProperty(P_OFFEN);
}

/**
 * Markierungen nachholen, die ein abgebrochener Lauf nicht mehr setzen konnte.
 * Je id für sich: Bremst Google, bleibt sie gemerkt, und die nächste Stunde
 * versucht es wieder. Scheitert Google an einem Termin aus einem anderen Grund
 * (gelöscht, im Papierkorb …), wird die id aufgegeben – schlimmstenfalls
 * bleibt ein Termin ohne Markierung stehen. Vorher hielt eine solche id jeden
 * Abgleich für immer an, und der Kalender verschob nichts mehr.
 */
function offenNachholen_(P, kal, projekt) {
  const offen = jsonSanft_(P.getProperty(P_OFFEN));
  if (!offen) return;
  const uebrig = {};
  let gebremst = null;
  Object.keys(offen).forEach((id) => {
    if (gebremst) {
      uebrig[id] = offen[id];
      return;
    }
    try {
      const ev = kal.getEventById(id);
      if (!ev || ev.getTag(T_QUELLE)) return;
      if (offen[id] === HINWEIS_ART) ev.setTag(T_HINWEIS, '1');
      else ev.setTag(T_KENNUNG, offen[id]);
      // Ohne Fingerabdruck: Der Abgleich setzt die Beschreibung gleich noch einmal.
      ev.setTag(T_QUELLE, projekt);
    } catch (err) {
      if (zuOft_(err) || tagesKontingent_(err)) {
        gebremst = err;
        uebrig[id] = offen[id];
        return;
      }
      console.log('Eine Markierung ließ sich nicht nachholen und ist aufgegeben: ' + bereinigt_(err));
    }
  });
  if (Object.keys(uebrig).length) P.setProperty(P_OFFEN, JSON.stringify(uebrig));
  else P.deleteProperty(P_OFFEN);
  if (gebremst) throw gebremst;
}

/**
 * Die Vorschau ist aufgebraucht: genau ein Hinweis-Termin heute zur
 * Trainingszeit, mit Erinnerung. Die übrigen Termine bleiben, wie sie sind.
 */
function hinweisArbeit_(P, kal, heute, n, projekt, meta) {
  const da = kal.getEvents(beginn_(plusTage_(heute, -SUCHE_ZURUECK)), beginn_(plusTage_(heute, 2)))
    .filter((ev) => ev.getTag(T_QUELLE) && ev.getTag(T_HINWEIS));
  const titel = 'Workout-App öffnen – der Kalender verschiebt nicht mehr';
  const beschreibung = 'Die Workout-App hat seit dem ' + datumDe_(n.ab) + ' keinen neuen Plan geschickt, und die Vorschau reichte bis '
    + datumDe_(meta.bis) + '. Seitdem verschiebt der Kalender „Workout" nicht mehr, die Termine darin stimmen vielleicht nicht. '
    + 'Einmal die App mit Netz öffnen genügt – dann verschwindet dieser Hinweis von selbst.';
  const beginn = zeitpunkt_(heute, n.minuten);
  const ende = new Date(beginn.getTime() + 15 * 60000);
  const erinnerung = n.erinnerung > 0 ? [n.erinnerung] : [];
  const abdruck = abdruck_(beschreibung);
  const rang = '0' + heute;
  const arbeit = da.slice(1).map((ev) => ({ datum: heute, rang: rang, tun: () => loeschen_(ev) }));
  const ev = da.length ? da[0] : null;
  arbeit.unshift({
    datum: heute,
    rang: rang,
    tun: () => {
      if (!ev) {
        const neu = kal.createEvent(titel, beginn, ende, { description: beschreibung });
        markieren_(P, neu, HINWEIS_ART, projekt, abdruck);
        erinnerungSetzen_(neu, erinnerung);
        return 1;
      }
      let anders = false;
      if (ev.getStartTime().getTime() !== beginn.getTime() || ev.getEndTime().getTime() !== ende.getTime()) {
        ev.setTime(beginn, ende);
        anders = true;
      }
      if (ev.getTitle() !== titel) {
        ev.setTitle(titel);
        anders = true;
      }
      if (ev.getTag(T_TEXT) !== abdruck) {
        ev.setDescription(beschreibung);
        ev.setTag(T_TEXT, abdruck);
        anders = true;
      }
      if (!erinnerungStimmt_(ev, erinnerung)) {
        erinnerungSetzen_(ev, erinnerung);
        anders = true;
      }
      return anders ? 1 : 0;
    },
  });
  return arbeit;
}

/** Abgeschaltet: alle eigenen Termine ab heute (auch einen Hinweis) als Arbeitsliste zum Löschen, die nächsten zuerst. */
function eigeneAbHeute_(kal, heute) {
  return kal.getEvents(beginn_(heute), beginn_(plusTage_(heute, AUS_VORAUS)))
    .filter((ev) => ev.getTag(T_QUELLE) && (ev.getTag(T_HINWEIS) || KENNUNG_MUSTER.test(ev.getTag(T_KENNUNG) || ''))
      && tagIn_(ev.getStartTime()) >= heute)
    .map((ev) => {
      const d = tagIn_(ev.getStartTime());
      return { datum: d, rang: '0' + d, tun: () => loeschen_(ev) };
    })
    .sort(nachRang_);
}

/**
 * Die Arbeitsliste abarbeiten, bis sie leer ist, die Zeit um ist oder Google
 * bremst. Gibt zurück, was liegen blieb – das holt der nächste Lauf nach.
 */
function abarbeiten_(arbeit, start, budget, r) {
  let geaendert = 0;
  let i = 0;
  for (; i < arbeit.length; i++) {
    if (geaendert >= MAX_AENDERUNGEN || Date.now() - start > budget) {
      r.spaeter = true;
      break;
    }
    try {
      geaendert += arbeit[i].tun();
    } catch (err) {
      if (tagesKontingent_(err)) {
        r.fehler = TAGESKONTINGENT;
        break;
      }
      if (zuOft_(err)) {
        r.spaeter = true;
        r.gebremst = true;
        break;
      }
      if (!r.fehler) r.fehler = 'Ein Termin ließ sich nicht angleichen: ' + bereinigt_(err);
    }
  }
  r.geaendert = (r.geaendert || 0) + geaendert;
  return arbeit.slice(i);
}

function loeschen_(ev) {
  ev.deleteEvent();
  Utilities.sleep(PAUSE_MS);
  return 1;
}

/** Stimmen die Erinnerungen? Nur Popups in genau dieser Länge, keine Mails – auch keine Voreinstellung des Kalenders. */
function erinnerungStimmt_(ev, soll) {
  const popup = ev.getPopupReminders().slice().sort((a, b) => a - b);
  return ev.getEmailReminders().length === 0 && popup.length === soll.length && popup.every((m, i) => m === soll[i]);
}

function erinnerungSetzen_(ev, soll) {
  ev.removeAllReminders();
  soll.forEach((m) => ev.addPopupReminder(m));
}

/* ------------------------------------------------------------------ *
 * Der Kalender
 * ------------------------------------------------------------------ */

/**
 * Der eigene Kalender „Workout": über die gespeicherte id; sonst einer, den
 * dieses Skript früher – in einem anderen Projekt – angelegt hat (er trägt
 * die Zeile „Skript-Kennung" in der Beschreibung); sonst ein neuer. Nie still
 * ein zweiter. `einrichten`: true legt einen gelöschten neu an und holt einen
 * zurück, den inzwischen ein anderes Projekt pflegt; aus dem Abgleich heraus
 * nie – ein gelöschter Kalender gibt dort null.
 */
function kalenderSichern_(P, melde, einrichten) {
  const projekt = projektKennung_(P);
  const id = P.getProperty(P_KALENDER);
  if (id) {
    const k = CalendarApp.getCalendarById(id);
    if (k) {
      if (einrichten) {
        const b = besitzer_(k);
        melde(b && b !== projekt
          ? '✓ Kalender „Workout" wiedergefunden – ab jetzt pflegt ihn wieder dieses Projekt.'
          : '✓ Kalender „Workout" wiedergefunden – kein zweiter.');
        besitzSetzen_(k, projekt);
      }
      return k;
    }
    if (!einrichten) return null;
    melde('– Der Kalender „Workout" von früher ist nicht mehr da (gelöscht?) – das Skript legt ihn neu an.');
  }
  const gleichnamig = CalendarApp.getOwnedCalendarsByName(KALENDER_NAME).filter((k) => k.getName() === KALENDER_NAME);
  const vonSkript = gleichnamig.filter((k) => besitzer_(k) !== null);
  if (vonSkript.length) {
    const k = vonSkript[0];
    P.setProperty(P_KALENDER, k.getId());
    besitzSetzen_(k, projekt);
    melde('✓ Kalender „Workout" aus einer früheren Einrichtung übernommen – kein zweiter. '
      + 'Ein älteres Skript-Projekt fasst ihn ab jetzt nicht mehr an.');
    if (vonSkript.length > 1) {
      melde('– Es gibt ' + vonSkript.length + ' Kalender „Workout" aus diesem Skript. Die übrigen kannst du in Google Kalender löschen.');
    }
    return k;
  }
  if (gleichnamig.length) {
    melde('– Es gibt schon einen Kalender „Workout", den nicht dieses Skript angelegt hat. Er bleibt, wie er ist; '
      + 'das Skript legt einen eigenen an.');
  }
  const k = CalendarApp.createCalendar(KALENDER_NAME, { timeZone: ZONE });
  P.setProperty(P_KALENDER, k.getId());
  besitzSetzen_(k, projekt);
  melde('✓ Kalender „Workout" angelegt (Zeitzone ' + ZONE + ').');
  return k;
}

/** Die Projekt-Kennung aus der Beschreibung des Kalenders, oder null. */
function besitzer_(kal) {
  const m = /Skript-Kennung: ([A-Za-z0-9-]+)/.exec(kal.getDescription() || '');
  return m ? m[1] : null;
}

function besitzSetzen_(kal, projekt) {
  kal.setDescription(beschreibungText_(projekt, ['Noch kein Abgleich.']));
}

/**
 * Die Beschreibung des Kalenders: wer ihn pflegt, wann zuletzt abgeglichen
 * wurde, bis wann die Termine stehen und was noch offen ist, von wann der
 * Plan ist, und ein Hinweis, wenn etwas nicht stimmt. Kurz vor dem Schreiben
 * noch einmal nachgesehen: Hat ihn inzwischen ein anderes Projekt übernommen,
 * bleibt dessen Zeile stehen.
 */
function beschreibungSchreiben_(kal, projekt, meta, r) {
  const z = [];
  z.push('Zuletzt abgeglichen: ' + zeitDe_(Date.now())
    + (r.tag ? ' – Liste für ' + datumDe_(r.tag) + (r.geaendert !== null ? ', ' + r.geaendert + (r.geaendert === 1 ? ' Änderung' : ' Änderungen') : '') : '')
    + '.');
  if (r.offen) {
    z.push((r.vollBis ? 'Termine bis ' + datumDe_(r.vollBis) + ' – noch ' : 'Noch ') + r.offen
      + (r.offen === 1 ? ' Änderung' : ' Änderungen') + ' offen, '
      + (r.gebremst ? 'sobald Google wieder lässt.' : r.folge ? 'sie folgen in den nächsten Minuten.' : 'sie folgen mit dem nächsten stündlichen Abgleich.'));
  } else if (r.tag && r.bis) {
    z.push('Termine bis ' + datumDe_(r.bis) + '.');
  }
  if (meta && meta.aus) z.push('In der App abgeschaltet am ' + zeitDe_(meta.empfangen) + '.');
  else if (meta) {
    z.push('Plan aus der App: gesendet ' + zeitDe_(meta.gesendet) + (meta.app ? ' (' + meta.app + ')' : '')
      + ', verschiebt von selbst bis ' + datumDe_(meta.bis) + '.');
  }
  const h = r.fehler || r.hinweis;
  if (h) z.push('Hinweis: ' + h);
  const text = beschreibungText_(projekt, z);
  try {
    const jetzt = kal.getDescription() || '';
    const b = besitzer_(kal);
    if (jetzt !== text && (!b || b === projekt)) kal.setDescription(text);
  } catch (err) {
    if (!zuOft_(err)) throw err;
  }
}

function beschreibungText_(projekt, zeilen) {
  return ['Gepflegt vom Skript „Workout-Kalender" (Fassung ' + FASSUNG + '). Termine hier überschreibt es beim nächsten Abgleich – '
    + 'Uhrzeit und Erinnerung stellst du in der Workout-App ein.'].concat(zeilen, ['Skript-Kennung: ' + projekt]).join('\n');
}

/** Eine zufällige Kennung dieses Projekts – am Kalender und an jedem eigenen Termin. */
function projektKennung_(P) {
  let p = P.getProperty(P_PROJEKT);
  if (!p) {
    p = 'wk-' + Utilities.getUuid().replace(/[^0-9a-fA-F]/g, '').slice(0, 12).toLowerCase();
    P.setProperty(P_PROJEKT, p);
  }
  return p;
}

/**
 * Die Probe vom 26.10.: Kalender „Workout-Probe" (über „kal" und über den
 * Namen, falls sie zweimal lief) und die Eigenschaft „kal". Gelöscht wird nur
 * ein eigener Kalender mit genau diesem Namen.
 */
function probeWegraeumen_(P, melde) {
  const id = P.getProperty(PROBE_EIGENSCHAFT);
  // Erst alle einsammeln, dann löschen: Derselbe Kalender kommt über den Namen
  // und über „kal" – nach dem Löschen ist er für jede weitere Frage weg.
  const kandidaten = [];
  const gesehen = {};
  const dazu = (k) => {
    if (!k) return;
    const kid = k.getId();
    if (gesehen[kid]) return;
    gesehen[kid] = true;
    kandidaten.push(k);
  };
  CalendarApp.getOwnedCalendarsByName(PROBE_NAME).forEach(dazu);
  if (id) dazu(CalendarApp.getCalendarById(id));
  let weg = 0;
  kandidaten.forEach((k) => {
    if (k.getName() !== PROBE_NAME || !k.isOwnedByMe()) {
      melde('– „' + k.getName() + '" ist nicht die Probe und bleibt stehen.');
      return;
    }
    k.deleteCalendar();
    weg += 1;
  });
  if (id) P.deleteProperty(PROBE_EIGENSCHAFT);
  if (weg) {
    melde('✓ Probe weggeräumt: Kalender „' + PROBE_NAME + '" gelöscht' + (weg > 1 ? ' (' + weg + ' Stück)' : '')
      + (id ? ', Eigenschaft „' + PROBE_EIGENSCHAFT + '" entfernt.' : '.'));
  } else {
    melde(id ? '✓ Eigenschaft „' + PROBE_EIGENSCHAFT + '" der Probe entfernt (ihr Kalender war schon weg).' : '✓ Keine Probe mehr da.');
  }
}

/* ------------------------------------------------------------------ *
 * Auslöser
 * ------------------------------------------------------------------ */

/** Alle Auslöser dieses Projekts weg (auch die der Probe und ein wartendes „weiter"), genau einer neu. */
function ausloeserNeu_(melde) {
  const alte = ScriptApp.getProjectTriggers();
  alte.forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger(AUSLOESER).timeBased().everyHours(1).create();
  melde((alte.length ? '✓ ' + alte.length + ' alte(r) Auslöser gelöscht (' + alte.map((t) => t.getHandlerFunction()).join(', ') + '). ' : '')
    + '✓ Genau ein Auslöser: „' + AUSLOESER + '" jede Stunde.');
}

/**
 * Kam die App an, ohne dass je eingerichtet wurde: den stündlichen Auslöser
 * nachholen. Gibt einen Hinweis oder null. Nicht, wenn den Kalender ein
 * anderes Projekt pflegt – dann hat sich dieses hier schlafen gelegt.
 */
function ausloeserSichern_(P) {
  if (ScriptApp.getProjectTriggers().some((t) => t.getHandlerFunction() === AUSLOESER)) return null;
  const kid = P.getProperty(P_KALENDER);
  const kal = kid ? CalendarApp.getCalendarById(kid) : null;
  const b = kal ? besitzer_(kal) : null;
  if (b && b !== projektKennung_(P)) return null;
  ScriptApp.newTrigger(AUSLOESER).timeBased().everyHours(1).create();
  return 'Der stündliche Auslöser fehlte – jetzt angelegt.';
}

function ausloeserAus_() {
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  console.log('Den Kalender „Workout" pflegt ein anderes Projekt – dieses hier hat seine Auslöser abgeschaltet.');
}

/* ------------------------------------------------------------------ *
 * Speicher, Format 1
 * ------------------------------------------------------------------ */

/**
 * Eine angenommene Sendung ablegen: ohne Kennwort, als JSON in Stücken unter
 * einer neuen Generation; erst danach zeigt die Meta-Zeile auf sie, und erst
 * dann gehen die alten Stücke. Bricht etwas dazwischen ab, gilt die alte.
 */
function speichern_(P, n) {
  const ohne = {};
  FELDER.forEach((k) => {
    if (n[k] !== undefined) ohne[k] = n[k];
  });
  const text = JSON.stringify(ohne);
  const teile = teilen_(text, TEIL_BYTES);
  const gen = Utilities.getUuid().replace(/[^0-9a-fA-F]/g, '').slice(0, 10).toLowerCase();
  const neu = {};
  teile.forEach((t, i) => {
    neu[P_TEIL + gen + '.' + i] = t;
  });
  P.setProperties(neu);
  const tage = Object.keys(n.tage).sort();
  const meta = {
    format: SPEICHER_FORMAT,
    v: n.v,
    gen: gen,
    teile: teile.length,
    zeichen: text.length,
    pruef: abdruck_(text),
    geraet: n.geraet,
    seq: n.seq,
    gesendet: n.gesendet,
    stand: n.stand,
    app: n.app || null,
    ab: n.ab,
    bis: tage[tage.length - 1],
    empfangen: Date.now(),
  };
  P.setProperty(P_META, JSON.stringify(meta));
  teileAufraeumen_(P, gen);
  return meta;
}

/** Stücke, die zu keiner geltenden Generation gehören, weg (gen null: alle). */
function teileAufraeumen_(P, gen) {
  P.getKeys().forEach((k) => {
    if (k.indexOf(P_TEIL) === 0 && (gen === null || k.indexOf(P_TEIL + gen + '.') !== 0)) P.deleteProperty(k);
  });
}

/**
 * Die Meta-Zeile lesen. Jede Fassung dieses Codes liest alle Formate, die
 * eine frühere geschrieben hat: Die Web-App läuft auf der bereitgestellten
 * Fassung, der Auslöser auf der zuletzt gespeicherten. Bis jetzt gibt es
 * Format 1 – Fassung 1 und 2 schreiben es beide; Tobis Probe hatte keins
 * („kal" räumt einrichten() weg).
 */
function metaLesen_(P) {
  const roh = P.getProperty(P_META);
  if (!roh) return null;
  let m;
  try {
    m = JSON.parse(roh);
  } catch (err) {
    throw new Error('Der Speicher des Skripts ist beschädigt (Meta). Die nächste Sendung der App ersetzt ihn.');
  }
  if (m && m.format === 1) return m;
  throw new Error('Unbekanntes Speicherformat ' + (m && m.format) + ' – diesen Code durch die neue Fassung aus der App ersetzen.');
}

function metaLesenSanft_(P) {
  try {
    return metaLesen_(P);
  } catch (err) {
    return null;
  }
}

/** Die gespeicherte Vorschau (Format 1), geprüft wie beim Annehmen. Wirft, wenn etwas fehlt oder nicht passt. */
function vorschauLesen_(P, meta) {
  const alle = P.getProperties();
  let text = '';
  for (let i = 0; i < meta.teile; i++) {
    const t = alle[P_TEIL + meta.gen + '.' + i];
    if (typeof t !== 'string') {
      throw new Error('Die gespeicherte Vorschau ist unvollständig (Stück ' + (i + 1) + ' von ' + meta.teile + ' fehlt). Die nächste Sendung der App ersetzt sie.');
    }
    text += t;
  }
  if (text.length !== meta.zeichen || abdruck_(text) !== meta.pruef) {
    throw new Error('Die gespeicherte Vorschau ist beschädigt. Die nächste Sendung der App ersetzt sie.');
  }
  const n = JSON.parse(text);
  const pruefling = { token: 'gespeichert-ohne-kennwort' };
  FELDER.forEach((k) => {
    if (n[k] !== undefined) pruefling[k] = n[k];
  });
  const grund = nutzlastPruefen_(pruefling);
  if (grund) throw new Error('Die gespeicherte Vorschau passt nicht zum Vertrag (' + grund + ').');
  return n;
}

/** Text in Stücke von höchstens `max` Byte (UTF-8), ohne ein Zeichen zu zerteilen. */
function teilen_(text, max) {
  const teile = [];
  let anfang = 0;
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    let len = c < 0x80 ? 1 : c < 0x800 ? 2 : 3;
    let breite = 1;
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < text.length && (text.charCodeAt(i + 1) & 0xfc00) === 0xdc00) {
      len = 4;
      breite = 2;
    }
    if (bytes + len > max) {
      teile.push(text.slice(anfang, i));
      anfang = i;
      bytes = 0;
    }
    bytes += len;
    i += breite - 1;
  }
  teile.push(text.slice(anfang));
  return teile;
}

/** Länge in Byte (UTF-8) – wie TextEncoder, den es hier nicht gibt. */
function utf8Bytes_(s) {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length && (s.charCodeAt(i + 1) & 0xfc00) === 0xdc00) {
      n += 4;
      i += 1;
    } else n += 3;
  }
  return n;
}

/* ------------------------------------------------------------------ *
 * Die Regeln des Vertrags – aus js/kalender-vorschau.js übernommen
 * ------------------------------------------------------------------ */

function ganz_(x, lo, hi) {
  return Number.isInteger(x) && x >= lo && x <= hi;
}

function zeichenkette_(x, lo, hi) {
  return typeof x === 'string' && x.length >= lo && x.length <= hi && ZEICHEN.test(x);
}

function eigen_(o, k) {
  return Object.prototype.hasOwnProperty.call(o, k);
}

/** nutzlastPruefen(): null, wenn die Sendung passt, sonst der erste Grund. Fassung 1 und 2. */
function nutzlastPruefen_(n, optionen) {
  const kennung = (optionen && optionen.kennung) || KENNUNG_MUSTER;
  if (!n || typeof n !== 'object' || Array.isArray(n)) return 'kein Objekt';
  if (n.v !== 1 && n.v !== VORSCHAU_V) return 'v';
  if (!zeichenkette_(n.token, 16, 128)) return 'token';
  if (!zeichenkette_(n.geraet, 4, 64)) return 'geraet';
  if (!ganz_(n.seq, 0, Number.MAX_SAFE_INTEGER)) return 'seq';
  if (!ganz_(n.gesendet, 1, Number.MAX_SAFE_INTEGER)) return 'gesendet';
  if (n.probe === true || n.aus === true) return null;
  if (utf8Bytes_(JSON.stringify(n)) > (n.v === 2 ? VORSCHAU_MAX_BYTES_2 : VORSCHAU_MAX_BYTES)) return 'groesse';
  if (!ganz_(n.minuten, 0, 1439)) return 'minuten';
  if (!ganz_(n.erinnerung, 0, 1440)) return 'erinnerung';
  if (!TAG.test(n.ab || '')) return 'ab';
  if (!Array.isArray(n.fenster) || n.fenster.length !== 2 || !n.fenster.every((x) => ganz_(x, 0, 60))) return 'fenster';
  const st = n.stand;
  if (!st || !ganz_(st.einheiten, 0, 1e7) || !ganz_(st.saetze, 0, 1e8) || !ganz_(st.zuletzt, 0, Number.MAX_SAFE_INTEGER)) {
    return 'stand';
  }
  if (!n.texte || typeof n.texte !== 'object' || Array.isArray(n.texte)) return 'texte';
  const texte = Object.entries(n.texte);
  if (texte.length > (n.v === 2 ? 3000 : 500)) return 'texte';
  for (const [h, t] of texte) {
    if (!/^[0-9a-z]{1,12}$/.test(h) || !Array.isArray(t) || t.length !== 2
      || typeof t[0] !== 'string' || t[0].length > 200 || typeof t[1] !== 'string' || t[1].length > 4000) return 'texte';
  }
  if (!n.tage || typeof n.tage !== 'object' || Array.isArray(n.tage)) return 'tage';
  const tage = Object.entries(n.tage);
  if (!tage.length || tage.length > 60) return 'tage';
  for (const [tag, liste] of tage) {
    if (!TAG.test(tag) || !Array.isArray(liste) || liste.length > 200) return 'tage';
    for (const e of liste) {
      if (!Array.isArray(e) || e.length !== 5 || typeof e[0] !== 'string' || !kennung.test(e[0])
        || !TAG.test(e[1] || '') || !ganz_(e[2], 1, 600) || typeof e[3] !== 'string' || !eigen_(n.texte, e[3])
        || (e[4] !== 0 && e[4] !== 1)) {
        return 'eintrag';
      }
    }
  }
  if (n.v === 2) return fernePruefen_(n, kennung);
  return null;
}

/** Fassung 2: die Ferne – null oder 'ferne'. */
function fernePruefen_(n, kennung) {
  const f = n.ferne;
  if (!f || typeof f !== 'object' || Array.isArray(f)) return 'ferne';
  if (!ganz_(f.bis, n.fenster[1], FERNE_MAX)) return 'ferne';
  const eintrag = (e) => Array.isArray(e) && e.length === 5 && typeof e[0] === 'string' && kennung.test(e[0])
    && ganz_(e[1], 0, 2000) && ganz_(e[2], 1, 600) && typeof e[3] === 'string' && eigen_(n.texte, e[3]) && (e[4] === 0 || e[4] === 1);
  if (!Array.isArray(f.listen) || !f.listen.length || f.listen.length > 60) return 'ferne';
  for (const l of f.listen) {
    if (!Array.isArray(l) || l.length > 600 || !l.every(eintrag)) return 'ferne';
  }
  if (!Array.isArray(f.tage) || !f.tage.length || f.tage.length > 60) return 'ferne';
  for (const s of f.tage) {
    if (!Array.isArray(s) || (s.length !== 2 && s.length !== 4) || !ganz_(s[0], 0, f.listen.length - 1) || !ganz_(s[1], -1000, 1000)) return 'ferne';
    if (s.length === 4) {
      if (!Array.isArray(s[2]) || s[2].length > 600 || !s[2].every((k) => typeof k === 'string' && kennung.test(k))) return 'ferne';
      if (!Array.isArray(s[3]) || s[3].length > 600 || !s[3].every(eintrag)) return 'ferne';
    }
  }
  // Jeder Tag der Vorschau hat seinen Satz.
  for (const tag of Object.keys(n.tage)) {
    const k = tageZwischen_(n.ab, tag);
    if (!(k >= 0 && k < f.tage.length)) return 'ferne';
  }
  return null;
}

/**
 * sendungVergleichen(): 'neu' | 'gleich' | 'alt' | 'aelter'. Dasselbe Gerät:
 * die spätere Sendung. Ein anderes: das, mit dem zuletzt trainiert wurde –
 * nicht das, das zuletzt gesendet hat (das Tablet aus der Schublade).
 */
function sendungVergleichen_(alt, neu) {
  if (!alt) return 'neu';
  if (neu.geraet === alt.geraet) {
    if (neu.seq === alt.seq && neu.gesendet === alt.gesendet) return 'gleich';
    return neu.seq > alt.seq || neu.gesendet > alt.gesendet ? 'neu' : 'alt';
  }
  const a = alt.stand || {};
  const b = neu.stand || {};
  for (const k of ['zuletzt', 'einheiten', 'saetze']) {
    if ((b[k] || 0) !== (a[k] || 0)) return (b[k] || 0) > (a[k] || 0) ? 'neu' : 'aelter';
  }
  return 'neu';
}

/**
 * bleibtStehen(): ein eigener Termin, dessen Kennung in der Liste (Nähe und
 * Ferne) fehlt – bleibt er? Nach heute nie; heute und davor nur, wenn er zu
 * einer früheren Runde oder einem anderen Fokus gehört (Verlauf) – nicht zur
 * laufenden und nicht zu einer, die erst noch kommt (eine Schätzung der Ferne).
 */
function bleibtStehen_(termin, liste, heute) {
  if (termin.datum > heute) return false;
  const teile = (k) => /^(.*)-(\d+)-z?\d+$/.exec(String(k)) || [String(k), String(k), '0'];
  const t = teile(termin.kennung);
  const fokus = t[1];
  const runde = t[2];
  const l = liste || [];
  if (l.some((e) => teile(e[0])[1] === fokus && teile(e[0])[2] === runde)) return false;
  return !l.some((e) => teile(e[0])[1] === fokus && Number(teile(e[0])[2]) < Number(runde));
}

/** vorschauFuer(): die Liste für heute, sonst die letzte davor – { tag, liste, aufgebraucht } oder null. */
function vorschauFuer_(tage, heute) {
  const vorher = Object.keys(tage || {}).filter((t) => TAG.test(t) && t <= heute).sort();
  if (!vorher.length) return null;
  const tag = vorher[vorher.length - 1];
  return { tag: tag, liste: tage[tag], aufgebraucht: tag !== heute };
}

/**
 * fernListe(): die Ferne des Tages `tag` – listen[r] um v verschoben, ohne
 * weg, mit dazu, nach dem Tag bis tag + bis, ohne die Kennungen der Nähe.
 * Leer bei Fassung 1.
 */
function fernListe_(n, tag) {
  const f = n && n.ferne;
  const nah = n && n.tage && n.tage[tag];
  if (!f || !Array.isArray(nah)) return [];
  const k = tageZwischen_(n.ab, tag);
  const s = f.tage[k];
  if (!s || !f.listen[s[0]]) return [];
  const nahe = {};
  nah.forEach((e) => {
    nahe[e[0]] = true;
  });
  return entschluesseln_(f.listen[s[0]], s[1], s[2] || [], s[3] || [], k + 1, k + f.bis, nahe)
    .map((e) => [e[0], plusTage_(n.ab, e[1]), e[2], e[3], e[4]]);
}

function entschluesseln_(liste, versatz, weg, dazu, von, ende, nahe) {
  const raus = {};
  weg.forEach((k) => {
    raus[k] = true;
  });
  dazu.forEach((e) => {
    raus[e[0]] = true;
  });
  const out = [];
  liste.forEach((e) => {
    if (!raus[e[0]]) out.push([e[0], e[1] + versatz, e[2], e[3], e[4]]);
  });
  dazu.forEach((e) => out.push([e[0], e[1], e[2], e[3], e[4]]));
  return out.filter((e) => e[1] >= von && e[1] <= ende && !nahe[e[0]]).sort(nachTag_);
}

function kennungRang_(k) {
  const m = /-(z?)(\d+)$/.exec(k);
  return m && !m[1] ? Number(m[2]) : 1e6;
}

function nachTag_(a, b) {
  if (a[1] !== b[1]) return a[1] < b[1] ? -1 : 1;
  const r = kennungRang_(a[0]) - kennungRang_(b[0]);
  if (r) return r;
  if (a[0] === b[0]) return 0;
  return a[0] < b[0] ? -1 : 1;
}

/* ------------------------------------------------------------------ *
 * Kleinkram
 * ------------------------------------------------------------------ */

/** Der Tag eines Zeitpunkts in Berlin. Immer mit Zone – die Zeitzone des Projekts zählt hier nirgends. 'yyyy', nicht 'YYYY' (Wochenjahr). */
function tagIn_(d) {
  return Utilities.formatDate(d, ZONE, 'yyyy-MM-dd');
}

/** Ein Tag um `minuten` nach Mitternacht in Berlin – über die Zeitumstellung hinweg richtig. */
function zeitpunkt_(tag, minuten) {
  const hh = ('0' + Math.floor(minuten / 60)).slice(-2);
  const mm = ('0' + (minuten % 60)).slice(-2);
  return Utilities.parseDate(tag + ' ' + hh + ':' + mm, ZONE, 'yyyy-MM-dd HH:mm');
}

/** Mitternacht eines Tages in Berlin. */
function beginn_(tag) {
  return zeitpunkt_(tag, 0);
}

/** ISO-Tag plus k Tage – ohne Uhrzeit, also ohne Zeitumstellung. */
function plusTage_(tag, k) {
  const t = tag.split('-').map(Number);
  return new Date(Date.UTC(t[0], t[1] - 1, t[2] + k)).toISOString().slice(0, 10);
}

/** Ganze Tage von `a` bis `b` (ISO), ohne Uhrzeit. */
function tageZwischen_(a, b) {
  const t = (s) => {
    const x = s.split('-').map(Number);
    return Date.UTC(x[0], x[1] - 1, x[2]);
  };
  return Math.round((t(b) - t(a)) / 86400000);
}

function datumDe_(tag) {
  if (!tag || !TAG.test(tag)) return '?';
  const t = tag.split('-');
  return t[2] + '.' + t[1] + '.' + t[0];
}

function zeitDe_(ms) {
  return Number.isFinite(ms) ? Utilities.formatDate(new Date(ms), ZONE, 'dd.MM.yyyy HH:mm') : '?';
}

/** Fingerabdruck eines Textes (FNV-1a, 32 Bit, Basis 36) – wie der Text-Schlüssel der Vorschau. */
function abdruck_(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** Das Kennwort vergleichen, ohne früher aufzuhören, wenn ein Zeichen nicht passt. */
function gleich_(a, b) {
  const n = Math.max(a.length, b.length);
  let unterschied = a.length === b.length ? 0 : 1;
  for (let i = 0; i < n; i++) {
    const x = i < a.length ? a.charCodeAt(i) : 0;
    const y = i < b.length ? b.charCodeAt(i) : 0;
    unterschied |= x ^ y;
  }
  return unterschied === 0;
}

function tokenGesetzt_() {
  return zeichenkette_(TOKEN, 16, 128);
}

/**
 * Bremst Google nur kurz? Die Meldungen kommen je nach Konto auf Englisch oder
 * Deutsch. Ein aufgebrauchtes Tageskontingent („… for one day") zählt nicht
 * dazu: Das holt die nächste Stunde nicht nach – dann soll der Auslöser
 * werfen, damit Google die Fehlermail schickt (tagesKontingent_()).
 */
function zuOft_(err) {
  if (tagesKontingent_(err)) return false;
  return /too many|zu oft|zu viele|zu häufig|rate ?limit|quota|kontingent|try again later|später erneut/i.test(String((err && err.message) || err));
}

/** Ist ein Tageskontingent aufgebraucht (Kalender, Skript-Eigenschaften …)? */
function tagesKontingent_(err) {
  return /for one day|per day|an einem Tag|für einen Tag|pro Tag|täglich/i.test(String((err && err.message) || err));
}

/** Eine Meldung für draußen: ohne Kennwort, ohne Adressen und Kalender-IDs, kurz. */
function bereinigt_(x) {
  let s = String((x && x.message) || x);
  if (tokenGesetzt_()) s = s.split(TOKEN).join('…');
  return s.replace(/https?:\/\/\S+/g, '…').replace(/[\w.+-]+@[\w.-]+/g, '…').slice(0, 300);
}

function antwort_(ok, code, mehr) {
  const a = {
    ok: ok, code: code, version: FASSUNG, kalender: KALENDER_NAME, tag: null, geaendert: null, offen: null, bis: null, stehen: null, folge: null,
    stand: null, seq: null,
  };
  Object.keys(mehr || {}).forEach((k) => {
    if (mehr[k] !== undefined) a[k] = mehr[k];
  });
  if (typeof a.hinweis === 'string') a.hinweis = bereinigt_(a.hinweis);
  return a;
}

function ausgabe_(a) {
  return ContentService.createTextOutput(JSON.stringify(a)).setMimeType(ContentService.MimeType.JSON);
}

function jsonSanft_(s) {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch (err) {
    return null;
  }
}

function melder_() {
  const zeilen = [];
  const melde = (z) => {
    zeilen.push(z);
    console.log(z);
  };
  melde.zeilen = zeilen;
  return melde;
}

function stumm_() {}

function zusammenfassung_(r) {
  if (!r) return '';
  const teile = [];
  if (r.tag) teile.push('Liste für ' + datumDe_(r.tag));
  if (r.geaendert !== null && r.geaendert !== undefined) teile.push(r.geaendert + (r.geaendert === 1 ? ' Änderung' : ' Änderungen'));
  if (r.offen) teile.push('noch ' + r.offen + ' offen' + (r.folge ? ' – „weiter" macht in ein paar Minuten weiter' : ''));
  else if (r.tag && r.bis) teile.push('Termine bis ' + datumDe_(r.bis));
  if (r.fehler) teile.push('✗ ' + r.fehler);
  else if (r.hinweis) teile.push(r.hinweis);
  return 'Abgleich: ' + (teile.join(' · ') || 'nichts zu tun');
}
