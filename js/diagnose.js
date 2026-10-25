/*
 * Das Diagnoseprotokoll: was die App technisch tut, auf diesem Gerät
 * mitgeschrieben – und nur dort.
 *
 *     „Können wir nicht allgemein alles mögliche im Hintergrund loggen damit du
 *      siehst was funktioniert und was nicht oder so?"
 *
 * Ja, weil Ton, Pause, Service Worker und Speicher auf dem Handy still
 * scheitern. Hinter *„es gab iwie keine sounds"* und *„Jetzt fehlt iwie die
 * Pause"* standen jedes Mal Gründe, die in keinem Zustand stehen – ob die Pause
 * ablief oder weggetippt wurde, ob das Signal auf der Audio-Uhr lag, ob der
 * Kanal schlief, ob der erste Tipp den Ton überholt hat. Im Test nachgestellt
 * sieht man sie, am Gerät sah man bis jetzt nichts. Mitgeschrieben wird nach
 * denselben Regeln wie beim Rückkanal, nur strenger, weil hier mehr drinsteht:
 *
 *   Bleibt hier.  Ein eigener Schlüssel im localStorage, höchstens 64 KB und
 *                 14 Tage. Dieses Modul hat keinen Weg nach draußen – kein
 *                 fetch, kein sendBeacon, nicht in der Sicherung (weder Datei
 *                 noch Server), nicht im Rückkanal; tests/test-diagnose.mjs
 *                 prüft das. Hinaus geht es nur, wenn der Mensch unter
 *                 Mehr → Daten auf „Teilen" oder „Kopieren" tippt.
 *   Abschaltbar.  Ein Schalter (Standard an), „Löschen" daneben, und „Alle
 *                 Daten löschen" räumt es mit.
 *   Wenig.        Kennungen und Zahlen, keine Inhalte: die Einheit als Nummer,
 *                 die Übung als Kennung, der Satz als Index – keine Gewichte,
 *                 keine Wiederholungen, kein Name, keine Beschwerden, keine
 *                 Eingaben, keine Schlüssel. Jede Adresse verliert Anker,
 *                 Anfrage und Herkunft (diagnoseSauber()): Im Anker eines
 *                 Wiederherstellungs-Links steht der Sicherungsschlüssel.
 *                 Uhrzeiten stehen drin – das sagt die Karte unter Mehr.
 *   Stört nie.    Alles in try/catch, notieren() wirft nie und fasst den
 *                 Speicher nie an. Geschrieben wird gebündelt aus einem
 *                 Zeitgeber (höchstens einmal je Minute), an den Stellen, an
 *                 denen auch der Store sofort schreibt (Wegschalten, Neuladen),
 *                 und kurz nach einem Fehler – nie im Tipp selbst. Und es
 *                 nimmt dem Training nie den Platz (siehe „Platz" unten).
 *
 * Ein Eintrag ist eine Textzeile, kein JSON: Anhängen kostet nichts, Kürzen ist
 * ein indexOf('\n'), und der Text, den man teilt, *ist* das Protokoll.
 *
 *     2026-10-24 18:01:03.120 satz n=12 mode=db ex=goblet-squat i=1 done=true …
 *
 *   Zeit   Ortszeit mit Millisekunden – das Ton-Timing spielt in Fenstern von
 *          20 ms und 1,2 s. Aus den Teilen des Datums gebaut, nicht mit
 *          toISOString() (das wäre UTC). Die Zeitzone steht in der Startzeile.
 *          Lexikografisch sortierbar: Der Altersschnitt vergleicht Text.
 *   Art    ein Wort aus der Liste unten
 *   Rest   k=v-Paare. Zahlen, Wahrheitswerte und Wörter roh, alles mit
 *          Leerzeichen in Anführungszeichen; leere Felder fallen weg. Ein Wert
 *          höchstens 120 Zeichen (Meldungen 200), die Zeile höchstens 400.
 *          Dieselbe Zeile binnen 10 s wird nicht wiederholt, sondern als „×n"
 *          hochgezählt – ein Fehler je Bild rollte sonst in Sekunden das ganze
 *          Protokoll weg.
 *
 * Die Arten (die Felder stehen an den Aufrufstellen, ohne Prosa daneben):
 *
 *   start       Start der Seite: Einzeldatei, Anzeige, Browser, Fenster,
 *               Zeitzone, Netz, Speicherlage, Größen, Plan, Grund des Neuladens;
 *               eine zweite Zeile mit der Fassung aus dem Zwischenspeicher
 *   sw          Service Worker: registriert, Update, Zustand, Wechsel, Notausgang
 *   fehler      jeder Fehler, den niemand gefangen hat – mit Datei:Zeile
 *   sicht       App weg, wieder da, Neuladen
 *   netz        online / offline
 *   ton         Kontext (woher, Zustand), Wecken, Berührung, los, geplant,
 *               vorgemerkt, nachgeholt, verfallen (mit Grund), verpasst,
 *               verworfen, erklungen, abgesagt
 *   pause       Start, Auflegen (Ton und Hinweis), Ablauf oder Abbruch mit dem,
 *               was endRest() entschied, weg, +30 s, Hinweis gefeuert, Wakelock
 *   satz        ein Haken: Einheit, Modus, Übung, Index, was danach kam
 *   einheit     Start, Ende (wie, Dauer, Uhr gedeckelt), verworfen, markiert
 *   plan / tag / zusatz / nach
 *               Umzug, Umbau, Fokus, Neustart, Runde, Vorziehen, Zusatztag,
 *               Nachrücken, Tagesabschluss, die Uhr um Mitternacht
 *   schalter    Töne, Satz-Tupfer, Hinweise, Supersatz, Teilen, Stufe, Pause
 *   datei       Sicherung teilen, herunterladen, Export, Import
 *   sicherung   Ergebnis jedes Sicherungsversuchs, Holen, Löschauftrag
 *   rueckkanal  Ergebnis der Meldung
 *   speicher    Speicherlage, Zusage, Platz gemacht, Satzuhr
 *   diagnose    das Protokoll selbst: an, aus, geleert, geteilt, kopiert
 *
 * Ehrlich dazugesagt: Ein Lade- oder Syntaxfehler im Modulgraphen (ein halbes
 * Update, eine fehlende Datei) verhindert jedes Modul, also auch dieses – genau
 * die „weiße Seite" bleibt unprotokolliert. Und was der Service Worker im
 * Hintergrund tut (die Meldung „Pause vorbei"), sieht die Seite nicht.
 *
 * Warum dieses Modul nichts importiert: audio.js, sicherung.js und app.js
 * benutzen es, und audio.js steht ganz unten in der Schichtung. Mit einem
 * eigenen Import gäbe es einen Kreis (tools/pruefung/schichten.py). In
 * js/app.js steht es als erster Import: ES-Module werten ihre Abhängigkeiten in
 * Importreihenfolge aus, so stehen die Fehler-Lauscher, bevor data.js und
 * store.js laufen.
 *
 * Die Namen heißen diagnose…, nicht protokoll… (wie im ersten Entwurf): In
 * dieser App ist „das Protokoll" das Trainingsprotokoll, `state.log`, und
 * `protokollStand` ist in js/app.js schon ein Parameter. Alles Interne trägt
 * „diag" vorn – im Ein-Datei-Bündel teilen sich alle Module einen
 * Gültigkeitsbereich.
 */

/** Die Zeilen, mit Zeilenumbruch verbunden – sonst nichts. Nie im Zustand der App. */
export const DIAGNOSE_KEY = 'workout.diagnose.v1';

/** '1' heißt abgeschaltet; fehlt er, ist es an (Vorbild: `an !== false` in js/sicherung.js). */
export const DIAGNOSE_AUS = 'workout.diagnose.aus';

/*
 * Ein Wort für die Startzeile nach einem Neuladen, das die App selbst auslöst
 * (Update, Import, Einstieg, Fokuswechsel) – in sessionStorage, gelesen und
 * gelöscht beim nächsten Start. Muster: `workout.nachImport` in js/app.js.
 */
const DIAGNOSE_GRUND = 'workout.diagnose.grund';

/*
 * 64 KB: so viel wie eine abgelegte Runde in der Ablage und wie keepalive für
 * die Sicherung trägt. Gemessen ergibt ein abgehakter Satz samt Pause und Ton
 * 550–770 Zeichen, eine Einheit mit 17 Sätzen also 10–13 KB – das Protokoll
 * hält die letzten fünf, sechs Einheiten. (Die Spezifikation rechnete mit 60
 * Sätzen und 55–80 Zeichen je Zeile; beides war zu knapp geschätzt.) Größer
 * ginge, aber jedes KB wird bei jeder Schreibung kopiert. Gezählt in Zeichen,
 * wie localStorage selbst.
 */
export const DIAGNOSE_MAX_BYTES = 64 * 1024;

/* Älteres fällt beim Laden, beim Schreiben und beim Teilen weg. */
const DIAGNOSE_MAX_TAGE = 14;

/*
 * Höchstens eine Schreibung je Minute, Vorderkante: Der erste ungeschriebene
 * Eintrag stellt den Zeitgeber, alle weiteren tun nichts – ein Dauerfeuer schiebt
 * das Schreiben also nicht hinaus. Gemessen am Satztakt (60–120 s) ergibt das
 * etwa eine Schreibung je Satz; die Drossel bestimmt nur, wie viel bei einem
 * harten Ende ohne Wegschalten verloren geht (höchstens eine Minute). Kürzer
 * hieße nicht weniger Schreibungen, sondern Schreibungen im Takt der Tipps.
 *
 * Die Startzeile wartet darauf mit – kein eigenes Schreiben zwei Sekunden nach
 * dem Start, wie der Entwurf es vorsah: Kurz nach dem Start ist genau die Zeit,
 * in der ein voller Speicher sich zuerst zeigt, und ein Protokoll, das dann
 * schreibt und weicht, verschöbe, welcher Satz scheitert
 * (tests/test-speicher-voll.mjs). Sie landet beim ersten Wegschalten, beim
 * ersten Fehler oder nach einer Minute.
 */
const DIAGNOSE_DROSSEL_MS = 60000;

/* „Bald" (Fehler, Speicher, Einheit zu Ende): höchstens einmal je 2 s. */
const DIAGNOSE_SOFORT_MS = 2000;

const DIAGNOSE_WIEDERHOLUNG_MS = 10000;
const DIAGNOSE_MAX_ZEILE = 400;
const DIAGNOSE_MAX_WERT = 120;
const DIAGNOSE_MAX_MELDUNG = 200;

/*
 * Platz: Das Protokoll liegt nur im Speicher, solange danach noch reichlich frei
 * ist.
 *
 * Die Spezifikation sah zwei Wege vor, beide nachträglich: Scheitert das eigene
 * Schreiben, räumt das Protokoll seinen Schlüssel; meldet der Store „voll",
 * ebenso. Beim zweiten ist der Satz, um den es geht, aber schon gescheitert –
 * das Protokoll hätte ihm den Platz genommen und erst danach zurückgegeben. Das
 * ist genau das, was nie passieren darf.
 *
 * Deshalb ein dritter Weg, vorher: Nach dem eigenen Schreiben legt es kurz einen
 * Platzhalter von 256 KB daneben und nimmt ihn gleich wieder weg. Passt der
 * nicht, ist der Speicher so knapp, dass das Protokoll dort nichts zu suchen
 * hat – es räumt seinen Schlüssel und läuft nur noch im Arbeitsspeicher. 256 KB
 * sind das Vierfache des Protokolls und mehr als der ganze Zustand samt einer
 * abgelegten Runde; was das Training in einer halben Stunde dazuschreibt, sind
 * ein paar KB. Bei der ersten Schreibung jeder Seite und danach höchstens alle
 * zehn Minuten, nicht bei jeder: Der Platzhalter kostet so viel wie vier volle
 * Protokolle. Füllt in der Zwischenzeit etwas anderes den Speicher (eine andere
 * App unter derselben Adresse), greift der Weg über den Store.
 */
const DIAGNOSE_PLATZ_KEY = 'workout.diagnose.platz';
const DIAGNOSE_PLATZ = 256 * 1024;
const DIAGNOSE_PLATZ_ALLE_MS = 10 * 60000;

let diagAn = true;
let diagSpeicherDa = true;   // lässt der Browser überhaupt speichern?
let diagNurRam = false;      // gesperrt, oder Platz für das Training gemacht
let diagWarum = '';          // … und warum (für die Karte unter Mehr)
let diagKoerper = '';        // was nach eigenem Wissen im Schlüssel steht (mit '\n' am Ende)
let diagGeschrieben = '';    // genau das, was zuletzt geschrieben oder gelesen wurde
let diagGeaendert = false;   // diagKoerper weicht davon ab (gekürzt, ×n)
let diagOffen = [];          // noch nicht geschriebene Zeilen
let diagOffenBytes = 0;
let diagLetzte = null;       // { schluessel, zeile, n, t } – die letzte Zeile, für „×n"
let diagUhr = null;
let diagUhrWann = 0;
let diagUhrSofort = false;
let diagSofortZuletzt = 0;
let diagPlatzZuletzt = 0;
let diagStartGrund = '';
let diagFassung = '';
const diagMessung = { n: 0, max: 0, summe: 0, zuletzt: 0 };

const diagZwei = (n) => String(n).padStart(2, '0');

/** Ortszeit JJJJ-MM-TT HH:MM:SS.mmm */
function diagStempel(d) {
  return `${d.getFullYear()}-${diagZwei(d.getMonth() + 1)}-${diagZwei(d.getDate())} `
    + `${diagZwei(d.getHours())}:${diagZwei(d.getMinutes())}:${diagZwei(d.getSeconds())}`
    + `.${String(d.getMilliseconds()).padStart(3, '0')}`;
}

/** Versatz zur UTC wie „+02:00" – für die Startzeile und den Kopf. */
export function diagnoseZone(d = new Date(Date.now())) {
  const v = -d.getTimezoneOffset();
  const a = Math.abs(v);
  return `${v < 0 ? '-' : '+'}${diagZwei(Math.floor(a / 60))}:${diagZwei(a % 60)}`;
}

/**
 * Eine Adresse ohne Anker, ohne Anfrage und ohne Herkunft.
 *
 * Im Anker steht beim Wiederherstellungs-Link der Sicherungsschlüssel
 * (`#sicherung=…`), beim geteilten Stand der Stand selbst samt Namen – und
 * eine Stack-Zeile oder `e.filename` trägt die Adresse der Seite mit. Unter
 * file:// bleibt nur der Dateiname: Der Pfad davor nennt auf dem Rechner oft
 * den Benutzernamen.
 */
export function ohneAnker(url) {
  let s = String(url ?? '');
  const schnitt = s.search(/[?#]/);
  if (schnitt >= 0) s = s.slice(0, schnitt);
  if (/^file:/i.test(s)) return s.slice(s.lastIndexOf('/') + 1);
  return s.replace(/^(?:blob:)?[a-z][\w+.-]*:\/\/[^/]*\/?/i, '');
}

/**
 * Freitext entschärfen: Meldungen, Stack-Zeilen, Antworten des Servers.
 *
 * Adressen wie oben; ein Anker der Form `#name=…` auch ohne Adresse davor; und
 * jede Zeichenkette ab 40 Zeichen aus dem Alphabet von Schlüsseln (base64url,
 * hex) – der Sicherungsschlüssel hat 43, Hashes 64, ein JWT noch mehr. Die
 * längste Übungskennung hat 32 Zeichen, die bleibt.
 *
 * Und eine Meldung über JSON verliert alles in Anführungszeichen: Chrome
 * zitiert beim Parsen den Anfang des Textes („"{"name":"To"... is not valid
 * JSON"), und das wäre der Anfang einer Sicherung – mit dem Namen darin.
 */
export function diagnoseSauber(text) {
  let s = String(text ?? '')
    .replace(/(?:blob:)?(?:https?|file|chrome-extension|moz-extension):\/\/[^\s'"()<>]*/gi, (u) => ohneAnker(u) || '/')
    .replace(/#[\w-]+=[^\s'"]*/g, '#…')
    .replace(/[A-Za-z0-9_-]{40,}/g, '…');
  if (/JSON/.test(s)) s = s.replace(/"[\s\S]*"/g, '"…"');
  return s;
}

function diagWert(k, v) {
  if (typeof v === 'number') return Number.isFinite(v) ? String(Math.round(v * 100) / 100) : String(v);
  if (typeof v === 'boolean') return String(v);
  let s = diagnoseSauber(typeof v === 'string' ? v : JSON.stringify(v));
  const max = k === 'msg' || k === 'fehler' || k === 'stack' ? DIAGNOSE_MAX_MELDUNG : DIAGNOSE_MAX_WERT;
  if (s.length > max) s = `${s.slice(0, max - 1)}…`;
  return /^[^\s"=]+$/.test(s) ? s : JSON.stringify(s);
}

function diagKurz(daten) {
  if (daten === null || daten === undefined) return '';
  if (typeof daten !== 'object') return diagWert('text', daten);
  const teile = [];
  Object.keys(daten).forEach((k) => {
    const v = daten[k];
    if (v === undefined || v === null || v === '') return;
    teile.push(`${k}=${diagWert(k, v)}`);
  });
  return teile.join(' ');
}

/** Älteres als 14 Tage vorn weg, dann vorn an einer Zeilengrenze auf 64 KB. */
function diagKuerzen(text) {
  let t = text;
  const grenze = diagStempel(new Date(Date.now() - DIAGNOSE_MAX_TAGE * 86400000)).slice(0, 10);
  let ab = 0;
  while (ab < t.length && t.slice(ab, ab + 10) < grenze) {
    const nl = t.indexOf('\n', ab);
    ab = nl < 0 ? t.length : nl + 1;
  }
  if (ab) t = t.slice(ab);
  if (t.length > DIAGNOSE_MAX_BYTES) {
    const nl = t.indexOf('\n', t.length - DIAGNOSE_MAX_BYTES);
    t = nl < 0 ? '' : t.slice(nl + 1);
  }
  return t;
}

/** Alles, was es gibt – Geschriebenes und Ungeschriebenes, gekürzt. */
function diagAlles() {
  return diagKuerzen(diagKoerper + (diagOffen.length ? `${diagOffen.join('\n')}\n` : ''));
}

/* Dieselben vier Namen wie warumNicht() in js/store.js – dort nicht importierbar. */
function diagVoll(e) {
  const name = e && (e.name || '');
  const code = e && e.code;
  return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || code === 22 || code === 1014;
}

/**
 * Den eigenen Schlüssel räumen und ab jetzt nur im Arbeitsspeicher weiter.
 *
 * Bis zum nächsten Start, nicht nur bis der Store wieder „ok" meldet: Wer so
 * knapp an der Grenze ist, gewinnt mit dem Protokoll nichts, und ein
 * Wechselspiel – Protokoll schreibt, Satz scheitert, Protokoll räumt – kostete
 * jedes Mal einen gescheiterten Schreibvorgang des Trainings. Beim nächsten
 * Start prüft der Platzhalter von vorn. Teilen und Kopieren gehen aus dem
 * Arbeitsspeicher weiter.
 */
function diagWeichen(was, text) {
  try { localStorage.removeItem(DIAGNOSE_KEY); } catch { /* auch das nicht – dann eben nicht */ }
  if (text) {
    diagKoerper = text;
    diagOffen = [];
    diagOffenBytes = 0;
  }
  diagGeschrieben = '';
  diagNurRam = true;
  diagWarum = was;
  clearTimeout(diagUhr);
  diagUhr = null;
  notieren('speicher', { was });
}

/** Ist nach dem eigenen Schreiben noch reichlich frei? Siehe DIAGNOSE_PLATZ. */
function diagPlatzReicht() {
  if (Date.now() - diagPlatzZuletzt < DIAGNOSE_PLATZ_ALLE_MS) return true;
  diagPlatzZuletzt = Date.now();
  try {
    localStorage.setItem(DIAGNOSE_PLATZ_KEY, ' '.repeat(DIAGNOSE_PLATZ));
    localStorage.removeItem(DIAGNOSE_PLATZ_KEY);
    return true;
  } catch {
    try { localStorage.removeItem(DIAGNOSE_PLATZ_KEY); } catch { /* war gar nicht da */ }
    return false;
  }
}

/**
 * Schreiben. Hat ein zweites Fenster derselben App inzwischen geschrieben
 * (installiert und als Tab), ist dessen Stand die Grundlage und die eigenen
 * offenen Zeilen kommen hinten dran – so verliert keins seine Zeilen, nur die
 * Reihenfolge zwischen den beiden ist nicht garantiert. Hat das andere Fenster
 * das Protokoll abgeschaltet, gilt das auch hier: nichts mehr schreiben. Das
 * Lesen davor kopiert aus dem Speicher des Renderers und kostet Mikrosekunden.
 */
function diagSchreibenJetzt() {
  clearTimeout(diagUhr);
  diagUhr = null;
  if (diagNurRam || (!diagOffen.length && !diagGeaendert)) return;
  const t0 = performance.now();
  let text = '';
  try {
    if (localStorage.getItem(DIAGNOSE_AUS) === '1') {
      diagAn = false;
      diagOffen = [];
      diagOffenBytes = 0;
      return;
    }
    const da = localStorage.getItem(DIAGNOSE_KEY) || '';
    let basis = diagKoerper;
    if (da !== diagGeschrieben) {
      basis = da && !da.endsWith('\n') ? `${da}\n` : da;
      diagLetzte = null;
    }
    text = diagKuerzen(basis + (diagOffen.length ? `${diagOffen.join('\n')}\n` : ''));
    localStorage.setItem(DIAGNOSE_KEY, text);
  } catch (e) {
    diagWeichen(diagVoll(e) ? 'verdraengt' : 'gesperrt', text);
    return;
  }
  if (!diagPlatzReicht()) {
    diagWeichen('knapp', text);
    return;
  }
  const ms = performance.now() - t0;
  diagKoerper = text;
  diagGeschrieben = text;
  diagOffen = [];
  diagOffenBytes = 0;
  diagGeaendert = false;
  diagMessung.n += 1;
  diagMessung.summe += ms;
  diagMessung.max = Math.max(diagMessung.max, ms);
  diagMessung.zuletzt = Date.now();
}

function diagTakt() {
  diagUhr = null;
  if (diagUhrSofort) diagSofortZuletzt = Date.now();
  try { diagSchreibenJetzt(); } catch { /* s. o. */ }
}

/*
 * Den Zeitgeber stellen. „Sofort" heißt hier: gleich nach dem laufenden
 * Ereignis (setTimeout 0), nie mitten darin – auch das Ende einer Einheit kommt
 * aus dem letzten Haken, und der soll nicht auf 64 KB setItem warten.
 */
function diagPlanen(sofort) {
  if (diagNurRam) return;
  const jetzt = Date.now();
  const wann = sofort ? Math.max(jetzt, diagSofortZuletzt + DIAGNOSE_SOFORT_MS) : jetzt + DIAGNOSE_DROSSEL_MS;
  if (diagUhr !== null && diagUhrWann <= wann) return;
  clearTimeout(diagUhr);
  diagUhrWann = wann;
  diagUhrSofort = sofort;
  diagUhr = setTimeout(diagTakt, wann - jetzt);
}

/**
 * Einen Eintrag anhängen. `daten` ist ein flaches Objekt (oder nichts),
 * `sofort` schreibt gleich nach dem laufenden Ereignis statt nach der Drossel.
 * Fasst den Speicher nie an, wirft nie, gibt nichts zurück – abgeschaltet ist es
 * ein einziger Vergleich.
 */
export function notieren(art, daten = null, sofort = false) {
  if (!diagAn) return;
  try {
    const rest = diagKurz(daten);
    const schluessel = rest ? `${art} ${rest}` : String(art);
    const jetzt = Date.now();
    const l = diagLetzte;
    if (l && l.schluessel === schluessel && jetzt - l.t <= DIAGNOSE_WIEDERHOLUNG_MS) {
      l.n += 1;
      l.t = jetzt;
      const neu = `${l.zeile} ×${l.n}`;
      if (diagOffen.length) {
        diagOffenBytes += neu.length - diagOffen[diagOffen.length - 1].length;
        diagOffen[diagOffen.length - 1] = neu;
      } else {
        const ab = diagKoerper.lastIndexOf('\n', diagKoerper.length - 2) + 1;
        diagKoerper = `${diagKoerper.slice(0, ab)}${neu}\n`;
        diagGeaendert = true;
      }
      diagPlanen(sofort);
      return;
    }
    let zeile = `${diagStempel(new Date(jetzt))} ${schluessel}`;
    if (zeile.length > DIAGNOSE_MAX_ZEILE) zeile = `${zeile.slice(0, DIAGNOSE_MAX_ZEILE - 1)}…`;
    diagOffen.push(zeile);
    diagOffenBytes += zeile.length + 1;
    // Mehr als 64 KB ungeschrieben fielen beim Schreiben ohnehin vorn weg –
    // so bleibt auch der Arbeitsspeicher begrenzt, wenn nicht geschrieben wird.
    while (diagOffenBytes > DIAGNOSE_MAX_BYTES && diagOffen.length > 1) {
      diagOffenBytes -= diagOffen.shift().length + 1;
    }
    diagLetzte = { schluessel, zeile, n: 1, t: jetzt };
    diagPlanen(sofort);
  } catch { /* das Protokoll darf die App nie stören */ }
}

/** Läuft es? */
export function diagnoseAn() {
  return diagAn;
}

/**
 * Der Schalter unter Mehr. Aus: eine letzte Zeile, sofort geschrieben, dann
 * nichts mehr – was da ist, bleibt bis zum Löschen. Die Lauscher bleiben
 * hängen, damit das Einschalten keinen Neustart braucht; abgeschaltet tun sie
 * nichts. Gibt den neuen Stand zurück.
 *
 * Hier wird ausnahmsweise im Tipp geschrieben: Es ist ein Tipp unter Mehr, kein
 * Satz im Training, und die letzte Zeile muss vor dem Schalter im Speicher
 * stehen – danach schriebe dieses Modul (und jedes andere Fenster) nichts mehr.
 */
export function diagnoseSchalten(an) {
  try {
    if (an) {
      diagAn = true;
      localStorage.removeItem(DIAGNOSE_AUS);
      notieren('diagnose', { an: true });
      diagSchreibenJetzt();
    } else {
      notieren('diagnose', { an: false });
      diagSchreibenJetzt();
      diagAn = false;
      diagOffen = [];
      diagOffenBytes = 0;
      localStorage.setItem(DIAGNOSE_AUS, '1');
    }
  } catch {
    diagAn = !!an;
  }
  return diagAn;
}

/** Der ganze Text zum Teilen: der Kopf (aus js/app.js), eine Linie, die Zeilen. */
export function diagnoseText(kopf = []) {
  const zeilen = diagAlles();
  return `${kopf.length ? `${kopf.join('\n')}\n---\n` : ''}${zeilen}`;
}

/** Die Zeilen als Liste – für den Kasten „letzte acht" und die Tests. */
export function diagnoseZeilen() {
  const t = diagAlles();
  return t ? t.slice(0, -1).split('\n') : [];
}

/**
 * Was die Karte unter Mehr und der Kopf brauchen – alles synchron.
 *
 *   zeilen, bytes       Umfang
 *   von, bis            Stempel der ersten und letzten Zeile
 *   fehler, heute       Zeilen der Art „fehler", Zeilen von heute
 *   nurRam, warum       geht es gerade nicht in den Speicher – und weshalb
 *                       ('gesperrt', 'verdraengt', 'knapp', 'platz')
 *   speicherDa          lässt der Browser überhaupt speichern?
 *   schreibungen …      wie oft und wie lange in dieser Sitzung geschrieben wurde
 *   fassung             der Zwischenspeicher, aus dem diese Seite kam
 */
export function diagnoseStand() {
  const text = diagAlles();
  const zeilen = text ? (text.match(/\n/g) || []).length : 0;
  // Die Zeilen stehen nach der Zeit sortiert: ab der ersten von heute zählen.
  const heute = diagStempel(new Date(Date.now())).slice(0, 10);
  const ab = text.startsWith(heute) ? 0 : text.indexOf(`\n${heute}`) + 1;
  const heuteN = ab > 0 || text.startsWith(heute) ? (text.slice(ab).match(/\n/g) || []).length : 0;
  const letzteAb = text.lastIndexOf('\n', text.length - 2) + 1;
  return {
    an: diagAn,
    zeilen,
    bytes: text.length,
    von: zeilen ? text.slice(0, 19) : '',
    bis: zeilen ? text.slice(letzteAb, letzteAb + 19) : '',
    fehler: (text.match(/^\S+ \S+ fehler /gm) || []).length,
    heute: heuteN,
    nurRam: diagNurRam,
    warum: diagWarum,
    speicherDa: diagSpeicherDa,
    schreibungen: diagMessung.n,
    schreibMsMax: diagMessung.max,
    schreibMsMittel: diagMessung.n ? diagMessung.summe / diagMessung.n : 0,
    zuletzt: diagMessung.zuletzt,
    fassung: diagFassung,
  };
}

/** Jetzt schreiben – an den Stellen, an denen auch der Store sofort schreibt. */
export function diagnoseSchreiben() {
  try { diagSchreibenJetzt(); } catch { /* s. o. */ }
}

/**
 * Löschen. Danach steht genau eine Zeile da, die sagt, warum – außer es ist
 * abgeschaltet, dann gar keine. `reset` („Alle Daten löschen") stellt auch den
 * Schalter auf den Standard zurück, wie jede andere Einstellung; die Rückfrage
 * dort nennt die Einstellungen ausdrücklich.
 *
 * Geschrieben wird gleich, wie beim Schalter: ein Tipp unter Mehr, und was
 * danach im Speicher steht, soll genau das sein, was die Karte zeigt.
 */
export function diagnoseLeeren(grund = 'tipp') {
  try {
    clearTimeout(diagUhr);
    diagUhr = null;
    diagKoerper = '';
    diagGeschrieben = '';
    diagGeaendert = false;
    diagOffen = [];
    diagOffenBytes = 0;
    diagLetzte = null;
    if (grund === 'reset') {
      diagAn = true;
      localStorage.removeItem(DIAGNOSE_AUS);
    }
    localStorage.removeItem(DIAGNOSE_KEY);
  } catch { /* gesperrter Speicher – im Arbeitsspeicher ist es leer */ }
  notieren('diagnose', { was: 'geleert', grund });
  try { diagSchreibenJetzt(); } catch { /* s. o. */ }
}

/**
 * Der Store meldet „voll": den eigenen Schlüssel sofort freigeben, damit das
 * nächste Schreiben des Trainings den Platz hat.
 *
 * Kein zweiter Schreibversuch des Stores von hier aus – erwogen (eine
 * Funktion store.nochmalSchreiben()) und verworfen: Der Satz, der eben
 * scheiterte, steht im Arbeitsspeicher und geht mit dem nächsten Schreiben mit,
 * die Warnung, die der Store jetzt zeigt, ist die Wahrheit über diesen Moment,
 * und tests/test-speicher-voll.mjs prüft genau sie. Dafür, dass das Protokoll
 * ihm den Platz gar nicht erst nimmt, sorgt der Platzhalter beim Schreiben
 * (DIAGNOSE_PLATZ). js/store.js bleibt dafür unangetastet.
 */
export function diagnosePlatzMachen() {
  if (diagNurRam) return;
  diagWeichen('platz', '');
}

/** Vor einem Neuladen, das die App selbst auslöst: warum (für die nächste Startzeile). */
export function diagnoseGrundMerken(wort) {
  try { sessionStorage.setItem(DIAGNOSE_GRUND, wort); } catch { /* dann eben ohne */ }
}

/*
 * Der Reihe nach gefragt, nicht in einem Ausdruck mit „|": Der fände das, was im
 * Text zuerst steht – und das ist auf Android „Linux", vor „Android 14", und
 * „Chrome" vor „EdgA".
 */
const DIAG_BROWSER = ['SamsungBrowser', 'EdgA', 'Edg', 'OPR', 'FxiOS', 'CriOS', 'Firefox', 'Chrome', 'Version'];
const DIAG_SYSTEM = [/Android \d+/, /iPhone OS \d+/, /CPU OS \d+/, /Windows NT [\d.]+/, /Mac OS X [\d_]+/, /CrOS/, /Linux/];

/** Browser und System kurz, etwa „Chrome/130,Android/14" – ganz steht er im Kopf. */
export function uaKurz(ua = navigator.userAgent || '') {
  const b = DIAG_BROWSER.map((n) => ua.match(new RegExp(`${n}/(\\d+)`))).find(Boolean);
  const name = b ? b[0].slice(0, b[0].indexOf('/')) : '';
  const browser = b ? `${name === 'Version' ? 'Safari' : name}/${b[1]}` : '?';
  const s = DIAG_SYSTEM.map((r) => ua.match(r)).find(Boolean);
  return `${browser},${s ? s[0].replace(/ (?=\d)/, '/').replace(/ /g, '').replace(/_/g, '.') : '?'}`;
}

/** Läuft die Seite als installierte App? */
function diagAnzeige() {
  try {
    if (navigator.standalone === true) return 'standalone';
    return ['standalone', 'fullscreen', 'minimal-ui'].find((m) => window.matchMedia(`(display-mode: ${m})`).matches)
      || 'browser';
  } catch {
    return '?';
  }
}

/**
 * Die Startzeile. Was nur die App weiß (Speicherlage, Plan, Einzeldatei),
 * gibt sie mit; den Rest weiß dieses Modul selbst. Die Fassung kommt danach,
 * aus dem Namen des Zwischenspeichers – wie unter Mehr → Fassung –, in der
 * Einzeldatei gar nicht.
 */
export function diagnoseStart(daten = {}) {
  notieren('start', {
    anzeige: diagAnzeige(),
    ua: uaKurz(),
    sicht: `${window.innerWidth}x${window.innerHeight}`,
    tz: diagnoseZone(),
    online: navigator.onLine,
    ...daten,
    grund: diagStartGrund || '-',
  });
  try {
    if (daten.einzeldatei || !window.caches) return;
    caches.keys().then((k) => {
      diagFassung = k.filter((x) => x.startsWith('workout-')).join(',') || 'keine';
      notieren('start', { fassung: diagFassung });
    }).catch(() => {});
  } catch { /* kein Zwischenspeicher – dann eben ohne Fassung */ }
}

function diagErsteZeile(stack) {
  const zeilen = String(stack || '').split('\n').map((z) => z.trim()).filter(Boolean);
  const z = zeilen.find((x) => /^at\s/.test(x) || /@/.test(x)) || '';
  return z.replace(/^at\s+/, '');
}

function diagFehler(e) {
  try {
    const ziel = e && e.target;
    if (ziel && ziel !== window && ziel.tagName) {
      notieren('fehler', {
        quelle: 'ressource', tag: String(ziel.tagName).toLowerCase(), src: ohneAnker(ziel.src || ziel.href || ''),
      }, true);
      return;
    }
    const err = e && e.error;
    notieren('fehler', {
      quelle: 'error',
      name: err && err.name,
      msg: (e && e.message) || (err && err.message) || 'ohne Meldung',
      ort: e && e.filename ? `${ohneAnker(e.filename)}:${e.lineno || 0}:${e.colno || 0}` : undefined,
      stack: err && err.stack ? diagErsteZeile(err.stack) : undefined,
    }, true);
  } catch { /* s. o. */ }
}

function diagAblehnung(e) {
  try {
    const r = e ? e.reason : undefined;
    const echt = !!r && typeof r === 'object' && ('message' in r || 'name' in r);
    notieren('fehler', {
      quelle: 'rejection',
      name: echt ? r.name : undefined,
      msg: echt ? r.message : String(r),
      stack: echt && r.stack ? diagErsteZeile(r.stack) : undefined,
    }, true);
  } catch { /* s. o. */ }
}

/*
 * Ein anderes Fenster hat den Schalter umgelegt: Das gilt hier sofort, nicht
 * erst beim nächsten Schreiben. Gelöscht hat es dort, liest dieses Fenster beim
 * nächsten Schreiben den leeren Schlüssel als Grundlage (diagSchreibenJetzt()).
 */
function diagFremd(e) {
  try {
    if (e.key === DIAGNOSE_AUS) {
      diagAn = e.newValue !== '1';
      if (!diagAn) { diagOffen = []; diagOffenBytes = 0; }
    }
  } catch { /* s. o. */ }
}

function diagLaden() {
  try {
    diagAn = localStorage.getItem(DIAGNOSE_AUS) !== '1';
    const roh = localStorage.getItem(DIAGNOSE_KEY) || '';
    diagGeschrieben = roh;
    const t = diagKuerzen(roh && !roh.endsWith('\n') ? `${roh}\n` : roh);
    diagKoerper = t;
    diagGeaendert = t !== roh;
  } catch {
    // Privates Fenster, blockierte Website-Daten: Es lebt nur bis zum Schließen.
    diagSpeicherDa = false;
    diagNurRam = true;
    diagWarum = 'gesperrt';
  }
  try {
    diagStartGrund = sessionStorage.getItem(DIAGNOSE_GRUND) || '';
    if (diagStartGrund) sessionStorage.removeItem(DIAGNOSE_GRUND);
  } catch { diagStartGrund = ''; }
}

diagLaden();
try {
  // capture: Ladefehler von Bildern und Skripten steigen nicht auf, sie kommen
  // nur in der Einfangphase am Fenster an.
  window.addEventListener('error', diagFehler, true);
  window.addEventListener('unhandledrejection', diagAblehnung);
  window.addEventListener('online', () => notieren('netz', { online: true }));
  window.addEventListener('offline', () => notieren('netz', { online: false }));
  window.addEventListener('storage', diagFremd);
} catch { /* kein Fenster – dann gibt es auch nichts mitzuschreiben */ }
