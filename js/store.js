import { todayISO } from './dates.js';

const KEY = 'workout.state.v1';

/* Die Ablage liegt in einem eigenen Schlüssel, und das hat einen gemessenen
 * Grund: `persist()` schreibt bei **jedem abgehakten Satz** den ganzen Zustand.
 * Ein abgeschlossener Durchlauf über 84 Einheiten ist dabei rund 65 KB groß,
 * und vorher lagen alle im selben Schlüssel:
 *
 *     1 abgelegte Runde   65 KB je abgehaktem Satz
 *     3 Runden           194 KB
 *     5 Runden           324 KB
 *
 * Das wuchs mit jedem Durchlauf und wurde nie wieder kleiner – auf einem Handy
 * mitten im Training ist das die eine Stelle, an der die App von selbst träger
 * wird, je länger man sie benutzt.
 *
 * Ehrlich dazugesagt: Der *laufende* Durchlauf steht weiterhin im
 * Hauptschlüssel und muss das auch, denn er ändert sich bei jedem Tipp. Der
 * Schreibweg ist also nicht klein, sondern **begrenzt** – höchstens eine Runde
 * statt einer Runde plus allem, was je vorher war. Die Ablage selbst ändert
 * sich nur beim Neustart des Plans, beim Zurückholen und beim Einlesen einer
 * Sicherung, also zwei-, dreimal im halben Jahr.
 *
 * Nachgemessen wird das in tests/test-speicher.mjs, nicht nur behauptet. */
const KEY_RUNDEN = 'workout.rounds.v1';
// Der Stand direkt vor dem letzten Import, damit er sich zurückholen lässt.
const KEY_VOR_IMPORT = 'workout.state.v1.vorImport';

const DEFAULT_STATE = {
  // Die zuletzt gewaehlte Variante: 'db' (Hanteln) | 'bw' (Bodyweight). Kein
  // Standard, sondern ein Ausgangspunkt - eine Einheit, die noch keine eigene
  // Wahl hat, faengt damit an. Siehe modusWahl() in js/app.js.
  mode: 'db',
  shift: 0,              // Tage, um die der noch offene Plan verschoben ist
  useExerciseRest: true, // Pause je Übung statt einer festen Länge
  restSeconds: 90,       // feste Pause, wenn useExerciseRest aus ist; 0 = keine
  shareCount: 0,         // wie oft der Link oder der Stand weitergeschickt wurde
  share: true,           // Stand an den Betreiber melden (nur wenn js/config.js einen Server nennt)
  deviceId: null,        // zufällige Kennung dieses Geräts für genau diese Meldung
  lastShare: null,       // { on, ok, msg } – wann zuletzt gemeldet wurde und was schiefging
  tabs: ['stats'],       // frei wählbare Reiter unten; Dashboard und Mehr stehen immer
  level: 'geuebt',       // Erfahrung: anfaenger | geuebt | fortgeschritten – skaliert die Startgewichte
  // Eigene Wahl der Fassung je Übung: { <Plan-Übung>: <gewählte Übung> }.
  // Schlägt die Erfahrungsstufe, in beide Richtungen – siehe
  // anfaengerFassung() in js/plan.js. Der Schlüssel ist immer die Übung, wie
  // sie im Plan steht, nie die gerade angezeigte.
  fassung: {},
  focus: 'standard',     // Trainingsfokus – welche Planvariante gilt (siehe js/data.js)
  theme: 'orange',       // Farbdesign: orange | rosa | blau | gruen | violett
  name: '',              // Anzeigename – steht nur in diesem Browser, kein Konto
  greeted: false,        // Willkommensseite gesehen
  sound: true,           // Töne: Pausenende, Start, Übung fertig, Workout komplett
  soundSets: true,       // zusätzlich ein kurzer Ton bei jedem abgehakten Satz
  notify: false,         // Systemhinweis am Pausenende, wenn die App im Hintergrund ist
  // Erinnerung am Trainingstag: { an, werktags, wochenende }, Uhrzeiten "HH:MM".
  // Getrennte Zeiten, weil der Tag anders läuft: unter der Woche nach der
  // Arbeit, am Wochenende früh. Siehe js/erinnerung.js.
  erinnerung: { an: false, werktags: '16:00', wochenende: '06:30' },
  // Tage, an denen etwas anderes ansteht: [{ datum, name, schont }]. `schont`
  // ist einer der Körbe aus js/termine.js. Am Termintag und am Tag davor fallen
  // die betroffenen Übungen aus der Einheit – siehe dort, auch zu dem Preis:
  // Die Woche verfehlt dann ihr Ziel für diese Gruppen.
  termine: [],
  // Welche Stangen und Scheiben es hier gibt: { lh: {stange, scheiben}, kh: … }.
  // null heißt „nicht eingetragen" – dann rechnet die App mit freien Schritten
  // wie früher, statt sich einen Scheibensatz auszudenken. Siehe js/scheiben.js.
  scheiben: null,
  // Aufwärmsätze über den schweren Übungen anzeigen. Steht auf an: Wer sie
  // nicht will, tippt einmal; wer sie braucht, weiß meist nicht, dass es sie
  // gäbe. Siehe aufwaermsaetze() in js/gewichte.js.
  aufwaermen: true,
  // Der Fingerabdruck des Plans, unter dem der laufende Verlauf entstanden ist
  // – je Fokus. Ändert sich der Plan (neue Übungen, neu verteilt), zeigt ein
  // alter Eintrag auf etwas anderes als das, was gemacht wurde. Siehe
  // planWechsel() in js/app.js.
  planStand: {},
  // Übungen, die von Hand nach vorn geholt wurden, weil sie sonst regelmäßig
  // ausfallen. Kostet womöglich einen zusätzlichen Umbau – siehe js/muster.js.
  vorne: [],
  // Supersätze: zwei verträgliche Übungen im Wechsel statt lange Pausen.
  // Welche zwei zusammenpassen, entscheidet js/supersatz.js.
  supersatz: false,
  rest: null,            // laufende Pause: { endsAt, total, next }
  weights: {},           // Arbeitsgewicht je Übung in kg, vom Nutzer gepflegt
  bands: {},             // Bandstärke je Übung: 'gelb' (leicht) oder 'rot' (schwer)
  // Übungen, die abgewählt sind. Wie `fehlt` eine Liste des *Abgewählten*: Ein
  // leeres Feld heißt „alle da", und neue Übungen im Katalog sind automatisch
  // an. Der Plan ersetzt sie wie eine Übung, deren Gerät fehlt – siehe
  // js/vorrat.js.
  ausUebungen: [],
  // Geräte, die gerade *nicht* da sind – IDs aus GERAETE in js/vorrat.js.
  //
  // Abgewählt statt angewählt, und das ist der ganze Trick: Ein leeres Feld
  // heißt „alles da". Wer die App seit Monaten benutzt, merkt vom Vorrat
  // deshalb nichts, und eine Sicherung ohne dieses Feld schaltet nicht
  // versehentlich den halben Plan ab. Entstanden bei den Eltern, ohne Bänder
  // und ohne Klimmzugstange.
  fehlt: [],
  friends: {},           // zuletzt geschickter Stand anderer: { id: { n, w, s, kg, r, p, d, am } }
  customs: [],           // eigene Einheiten: [{ id: 'c1', name, ex: [{id, sets}] }]
  session: null,         // laufendes Training: { n }
  clock: null,           // Uhr der Einheit: { n, on, spent, since } – siehe startSession()
  lastBackup: null,      // { on, done } – Stand der letzten Sicherung
  // Hat der Browser zugesagt, diesen Speicher nicht von selbst freizugeben?
  // Ergebnis von storage.persist(), einmal beim Start erfragt – gemerkt, damit
  // die Einstellungen den Stand nennen können, statt ihn zu behaupten.
  dauerhaft: false,
  // Stand der zuletzt erzeugten Kalenderdatei: { on, shift, seq }. Aus `shift`
  // ergibt sich, ob die Termine im Kalender noch stimmen; `seq` zählt hoch,
  // damit ein erneuter Import die alten Termine überschreibt statt sie stehen
  // zu lassen.
  lastIcs: null,
  rounds: [],            // abgeschlossene Durchläufe: [{ finishedOn, log }]
  // Angehakte Verletzungen als IDs aus js/injuries.js. Sie gelten für alle
  // kommenden Trainings, bis der Haken wieder weg ist – nicht nur für heute.
  injuries: [],
  tab: 'dashboard',      // zuletzt sichtbarer Tab, damit ein Neuladen nicht herausreißt
  // Zusätzliche Wiederholungen im Bodyweight-Modus, je Übung. Dort gibt es
  // kein Gewicht, das man erhöhen könnte – die Steigerung sind die Wdh.
  bwPlus: {},
  // Stufen, in die die App von selbst hochgestuft hat: ['geuebt', ...].
  // Jeder Schritt kommt genau einmal. Wer danach von Hand zurückstellt, wird
  // nicht wieder hochgestuft – sonst wäre die Wahl keine.
  aufstiege: [],
  // Der zuletzt vollzogene Aufstieg, solange der Hinweis noch nicht weggetippt
  // ist: { nach, von, am, einheiten, tonnen }.
  aufstieg: null,
  // Wochen, für die der Zusatztag ausdrücklich weggetippt wurde. Ohne dieses
  // Gedächtnis legt ihn der nächste Start wieder an – „brauch ich nicht" wäre
  // dann keine Antwort, sondern eine Wiederholungsschleife.
  zusatzNein: [],
  // Ein von selbst angelegter Zusatztag, solange sein Hinweis offen ist:
  // { id, name, woche, uebungen, saetze, fehlt, gruppen, am }. Die Einheit
  // selbst steht in `customs` und bleibt auch, wenn der Hinweis weg ist.
  zusatztag: null,
  // Ein abgeschaffter Trainingsfokus, auf den dieses Gerät noch stand, solange
  // der Hinweis dazu offen ist: { von, nach, am, abgelegt }. `von` und `nach`
  // sind Klarnamen, keine Schlüssel – den alten Plan gibt es nicht mehr, und
  // sein Name steht sonst nirgends. Siehe fokusUmzug() in js/app.js.
  fokusUmzug: null,
  // Dasselbe eine Etage tiefer: Der Fokus bleibt, aber der *Inhalt* des Plans
  // ist ein anderer geworden. Siehe planWechsel() in js/app.js.
  planUmbau: null,
  // { [workoutNo]: { db: {exId: [{w,done,wie}]}, bw: {...}, mode, startedOn }
  //   w    benutztes Gewicht, beim Abhaken mitgeschrieben
  //   done abgehakt
  //   wie  'unter' | 'drin' | 'oben' – wo im Wiederholungsbereich der Satz
  //        lag, falls beantwortet. Fehlt, wenn die Frage übergangen wurde;
  //        das ist der Normalfall und kostet nichts. }
  log: {},
};

function clone(o) { return JSON.parse(JSON.stringify(o)); }

// Muss vor load() stehen: load() läuft schon bei der Modulauswertung, und eine
// weiter unten deklarierte Variable wäre dort noch nicht initialisiert.
let wandert = false;

/**
 * Ein geschickter Stand, auf genau seine Felder und Typen gebracht.
 *
 * Gefunden bei der Durchsicht der ganzen App, und es war das Schwerste auf der
 * Liste: Ein Stand kommt aus einem Link, den *jemand anders* gebaut hat. Geprüft
 * wurden nur `v` und `n`; die Zahlen `w`, `p`, `s` wanderten ungeprüft in die
 * Seite und dann in den Speicher. Ein Link mit einem HTML-Schnipsel statt einer
 * Zahl lief damit als Skript in der App – beim Öffnen, und nach dem Übernehmen
 * bei jedem Öffnen der Statistik wieder.
 *
 * Deshalb hier und nicht an den Anzeigestellen: Was durch diese Funktion geht,
 * sind Zahlen, kurze Zeichenketten und Datumsangaben, und sonst nichts. Sie läuft
 * beim Dekodieren eines Links, beim Speichern eines Freundes, beim Laden und beim
 * Einlesen einer Sicherung – damit auch ein schon gespeicherter Stand entschärft
 * wird, der vor dieser Fassung hereinkam.
 */
const STAND_DATUM = /^\d{4}-\d{2}-\d{2}$/;
const standZahl = (x) => (Number.isFinite(Number(x)) && Number(x) >= 0 ? Math.round(Number(x)) : 0);
// Spitze Klammern haben in einem Namen oder Fokus nichts verloren. Angezeigt
// wird ohnehin maskiert; das hier ist die zweite Sicherung, falls eine
// künftige Anzeigestelle esc() vergisst.
const standText = (x, max) => (typeof x === 'string' ? x.replace(/[<>]/g, '').slice(0, max) : '');
export function normStand(roh) {
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return null;
  const n = standText(roh.n, 40).trim();
  if (!n) return null;
  const out = {
    v: standZahl(roh.v), n,
    w: standZahl(roh.w), s: standZahl(roh.s), kg: standZahl(roh.kg), r: standZahl(roh.r), p: standZahl(roh.p),
    d: STAND_DATUM.test(roh.d) ? roh.d : null,
    f: standText(roh.f, 40),
    z: STAND_DATUM.test(roh.z) ? roh.z : null,
  };
  if (STAND_DATUM.test(roh.am)) out.am = roh.am;
  return out;
}

function normFreunde(freunde) {
  const out = {};
  if (!freunde || typeof freunde !== 'object' || Array.isArray(freunde)) return out;
  Object.entries(freunde).forEach(([id, f]) => {
    const g = normStand(f);
    if (g && /^[\w-]{1,80}$/.test(id)) out[id] = g;
  });
  return out;
}

/**
 * Eigene Workouts aus fremder Hand auf ihre Felder bringen.
 *
 * Eine Sicherung ist eine Datei, die man auch weitergibt – „Sicherung
 * weitergeben" steht als Knopf in der App. Geprüft wurde bisher nur, dass
 * `customs` eine Liste ist. Eine präparierte Kennung landete dann als
 * Attribut in der Seite, und eine Liste mit fehlenden Feldern legte die
 * Ansicht „Eigenes" ohne Fehlermeldung lahm. Gefunden bei der Durchsicht.
 */
function normCustoms(liste) {
  if (!Array.isArray(liste)) return [];
  return liste.map((c) => {
    if (!c || typeof c !== 'object') return null;
    const id = typeof c.id === 'string' && /^c[\w-]{1,40}$/.test(c.id) ? c.id : null;
    if (!id) return null;
    const ex = (Array.isArray(c.ex) ? c.ex : []).map((x) => (x && typeof x.id === 'string'
      && /^[a-z0-9-]{1,60}$/.test(x.id)
      ? { id: x.id, sets: Math.min(10, Math.max(1, Math.round(Number(x.sets)) || 3)) } : null))
      .filter(Boolean);
    return { id, name: standText(c.name, 60) || 'Eigenes Workout', ex };
  }).filter(Boolean);
}

let state = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return clone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    const state = Object.assign(clone(DEFAULT_STATE), parsed);
    // Das Betreiber-Passwort lag früher hier. Es gehört in den Tab-Speicher
    // (siehe adminPassMerken in js/app.js) und nicht in eine Sicherungsdatei –
    // ein alter Stand wird deshalb beim Laden davon befreit.
    if ('adminPass' in state) delete state.adminPass;
    state.friends = normFreunde(state.friends);
    state.customs = normCustoms(state.customs);
    // Die Ablage: Steht sie noch im Hauptschlüssel, gilt sie und wird gleich
    // ausgelagert – das ist entweder ein Stand aus der Fassung davor oder ein
    // von Hand gesetzter (Sicherung, Tests). Sonst kommt sie aus ihrem eigenen
    // Schlüssel.
    if (Array.isArray(parsed.rounds)) {
      state.rounds = parsed.rounds;
      wandert = true;
    } else {
      const roh = localStorage.getItem(KEY_RUNDEN);
      if (roh !== null) {
        try { state.rounds = JSON.parse(roh) || []; } catch { state.rounds = []; }
      }
    }
    // Wer schon etwas gespeichert hat, ist nicht neu hier: Die Willkommensseite
    // fragt nach dem Namen und erklärt die App – für jemanden, der seit Wochen
    // trainiert, wäre sie eine Zumutung. Der Schlüssel fehlt genau dann, wenn
    // der Stand aus einer Fassung vor der Seite stammt.
    if (!('greeted' in parsed)) {
      state.greeted = true;
      // Und dann fehlt auch der Name. Diese App ist für einen bestimmten
      // Menschen gebaut, und dessen Stand ist genau der, in dem `greeted` noch
      // nicht vorkam – also trägt er sich hier selbst ein. Wer den Namen nicht
      // will, ändert ihn unter Mehr in einer Zeile.
      if (!state.name) state.name = 'Tobi';
    }
    /*
     * Ein Aufstieg, der als „schon dagewesen" gebucht ist, obwohl er nie
     * stattgefunden hat.
     *
     * `aufstiege` merkt sich vollzogene Schritte, damit die App niemanden
     * zweimal hochstuft. Eingetragen wurde bis eben aber auch, wer seine Stufe
     * *selbst* wählte – und das tut jeder genau einmal, bei der Einrichtung.
     * Wer dort „Anfänger" antippte, hatte damit den einzigen Aufstieg, den es
     * für ihn gibt, im selben Moment verbraucht: Die App hätte ihn nie
     * hochgestuft, egal wie lange er trainiert.
     *
     *     „Wenn die App mich bisher noch nicht hochgestuft hat, bin ich ja
     *      anscheinend noch Anfänger."
     *
     * Eben nicht. Deshalb hier die Heilung, und sie ist eindeutig: Ein Eintrag
     * über der eigenen Stufe kann kein vollzogener Aufstieg sein – dann stünde
     * die Stufe dort. Er kommt weg, und ab dem nächsten abgehakten Satz zählt
     * die App wieder mit.
     */
    const RANG = ['anfaenger', 'geuebt', 'fortgeschritten'];
    if (Array.isArray(state.aufstiege)) {
      const meine = RANG.indexOf(state.level || 'geuebt');
      state.aufstiege = state.aufstiege.filter((k) => RANG.indexOf(k) <= meine);
    }
    return state;
  } catch {
    return clone(DEFAULT_STATE);
  }
}

let saveTimer = null;

/**
 * Warum nicht gespeichert werden kann – und das sind zwei verschiedene Lagen.
 *
 *   'gesperrt'  Der Browser lässt gar nicht erst speichern: privates Fenster,
 *               eingebettete Ansicht, Website-Daten blockiert. Nichts von dem,
 *               was eingetragen wird, überlebt das Neuladen – aber es war auch
 *               nie etwas da.
 *
 *   'voll'      Es ging bisher, und jetzt nicht mehr. Das ist die gefährliche
 *               Lage: Ein halbes Jahr Training liegt gespeichert, der heutige
 *               Satz kommt nicht mehr dazu, und der Rat „öffne die Seite direkt
 *               im Browser" hilft daran gar nichts. Hier gehört die Sicherung
 *               hin, sofort.
 *
 * Vorher stand für beides derselbe Satz da, und er beschrieb nur die erste.
 */
function warumNicht(fehler) {
  // Chrome/Safari melden QuotaExceededError, Firefox NS_ERROR_DOM_QUOTA_REACHED,
  // ältere Fassungen nur den Code 22. Alles andere ist eine Sperre.
  const name = fehler && (fehler.name || '');
  const code = fehler && fehler.code;
  return (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED'
    || code === 22 || code === 1014) ? 'voll' : 'gesperrt';
}

let speicherFehler = null;

let storageOk = (() => {
  try {
    localStorage.setItem(`${KEY}.probe`, '1');
    localStorage.removeItem(`${KEY}.probe`);
    return true;
  } catch (e) {
    // Beim Start ist auch ein voller Speicher eine Sperre: Es gibt noch nichts
    // zu retten, und der einzige Rat wäre derselbe wie bei jeder anderen.
    speicherFehler = 'gesperrt';
    return false;
  }
})();

/*
 * Die Ablage hat ihren eigenen Fehlerstand.
 *
 * Gefunden bei der Durchsicht der App: Scheiterte das Schreiben der Ablage
 * (Speicher voll), setzte schreibeRunden() die Warnung – und das nächste
 * write() des Hauptschlüssels, der ohne das gerade abgelegte Protokoll kleiner
 * war und passte, nahm sie 120 ms später wieder weg. Nach dem Neuladen war die
 * Runde weg, ein halbes Jahr Training, und niemand war gewarnt worden.
 *
 * Jetzt: restartPlan() und wechsleFokus() rollen zurück, wenn die Ablage nicht
 * geschrieben werden kann, und dieser Fehler bleibt stehen, bis ein Schreiben
 * der Ablage gelingt – write() rührt ihn nicht an.
 */
let rundenFehler = null;
// Liegt die Ablage noch im Hauptschlüssel (alte Fassung) und ließ sie sich
// nicht umziehen, muss write() sie dort lassen – sonst wäre sie weg.
let rundenImHaupt = false;

/** false, wenn der Browser nichts speichern kann – Eintragungen sind flüchtig. */
export function canPersist() { return storageOk && !rundenFehler; }

/** 'gesperrt', 'voll' oder null – siehe warumNicht(). */
export function speicherGrund() { return !storageOk ? speicherFehler : rundenFehler; }

/** Eintragungen werden gespeichert, nur die Ablage einer Runde ging nicht. */
export function ablageKlemmt() { return storageOk && !!rundenFehler; }

// Kam die Ablage aus dem Hauptschlüssel, muss sie **sofort** in ihren eigenen –
// nicht erst beim nächsten abgehakten Satz. Dazwischen hätte der Hauptschlüssel
// sie beim ersten write() verloren, während der neue noch leer wäre.
if (wandert) {
  if (!schreibeRunden()) rundenImHaupt = true;
  persist();
}

function write() {
  saveTimer = null;
  const vorher = canPersist();
  try {
    // Ohne die Ablage – die steht in KEY_RUNDEN und ändert sich fast nie.
    const { rounds, ...schlank } = state;
    localStorage.setItem(KEY, JSON.stringify(rundenImHaupt ? state : schlank));
    storageOk = true;
    speicherFehler = null;
  } catch (e) {
    storageOk = false;
    speicherFehler = warumNicht(e);
  }
  // Beim Wechsel melden, in **beide** Richtungen. Nötig, weil dieser
  // Schreibvorgang *nach* dem Rendern läuft – persist() wartet 120 ms. Ohne
  // diese Meldung stünde die Warnung einen verlorenen Satz zu spät da; und
  // wäre nur das Scheitern gemeldet, bliebe sie nach dem Aufräumen kleben, bis
  // von selbst etwas anderes neu zeichnet. Wer darauf reagiert: js/app.js.
  if (canPersist() !== vorher) emit();
}

/** Die Ablage schreiben. Nur aufrufen, wo sie sich wirklich ändert. true, wenn es ging. */
function schreibeRunden() {
  try {
    localStorage.setItem(KEY_RUNDEN, JSON.stringify(state.rounds || []));
    rundenFehler = null;
    rundenImHaupt = false;
    return true;
  } catch (e) {
    rundenFehler = warumNicht(e);
    return false;
  }
}

/**
 * Eine Änderung, die die Ablage betrifft, nur ganz oder gar nicht.
 * `aendern` schreibt am Zustand; gelingt danach das Ablegen nicht, kommt der
 * vorherige Zustand zurück, und es bleibt beim Fehler. Rückgabe: ob es ging.
 */
function mitAblage(aendern) {
  const vorher = {
    log: state.log, rounds: state.rounds, shift: state.shift, focus: state.focus,
    session: state.session, clock: state.clock, rest: state.rest,
  };
  state.rounds = [...(state.rounds || [])];
  aendern();
  if (!schreibeRunden()) {
    Object.assign(state, vorher);
    emit();
    return false;
  }
  persist();
  emit();
  return true;
}

function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(write, 120);
}

/**
 * Ausstehenden Schreibvorgang sofort ausführen. Nötig, bevor die App in den
 * Hintergrund geht: mobile Browser verwerfen die Seite dort ohne Vorwarnung,
 * und der letzte abgehakte Satz wäre sonst verloren.
 */
export function flush() {
  if (saveTimer === null) return;
  clearTimeout(saveTimer);
  write();
}

function emit() {
  listeners.forEach((fn) => fn(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getState() { return state; }

export function setMode(mode) {
  state.mode = mode === 'bw' ? 'bw' : 'db';
  persist();
  emit();
}

/**
 * Modus, in dem ein konkretes Workout bearbeitet wird.
 *
 * Die eigene Wahl der Einheit gilt immer, wenn es eine gibt. Frueher hing das
 * an einem Schalter `keepModePerWorkout`, der zu einem globalen „Standardmodus"
 * gehoerte - beide sind weg: *„Hier schaltet man immer zwischen Hanteln und
 * bodyweight hin und her je nachdem was man grad hat. Nichts davon ist
 * Standard."* Ohne Standard braucht es auch keinen Schalter, der ihn ueberstimmt.
 */
export function workoutMode(n) {
  const entry = state.log[n];
  return (entry && entry.mode) || state.mode;
}

export function setWorkoutMode(n, mode) {
  const entry = ensure(n);
  entry.mode = mode;
  state.mode = mode;
  persist();
  emit();
}

function ensure(n) {
  if (!state.log[n]) state.log[n] = { db: {}, bw: {}, mode: state.mode };
  const e = state.log[n];
  if (!e.db) e.db = {};
  if (!e.bw) e.bw = {};
  return e;
}

/** Satz-Array für eine Übung in einem Workout; legt es bei Bedarf an. */
export function getSets(n, mode, exId, setCount) {
  const e = ensure(n);
  const bucket = e[mode];
  let arr = bucket[exId];
  if (!Array.isArray(arr)) {
    arr = bucket[exId] = [];
    // Wie viele Sätze diese Übung an diesem Tag hatte – einmal festgehalten,
    // in dem Augenblick, in dem die App sich entscheidet.
    //
    // Ohne diese Zahl misst die Nacharbeit eine vergangene Einheit an der
    // Satzzahl von *heute*, und die ändert sich: Sie hängt an der
    // Erfahrungsstufe, und was eine Stufe bedeutet, kann sich ebenfalls ändern
    // ("Anfänger" hieß gestern zwei Sätze und heute drei). Beides machte jede
    // fertig trainierte Einheit derselben Woche rückwirkend zu kurz, und die
    // Nacharbeit erfand einen Rückstand, den es nie gab. Eine Einstellung darf
    // keine Arbeit erzeugen. Siehe offenInWoche() in js/plan.js.
    //
    // Am Speicher allein ist das nicht abzulesen: Die Zeile unten füllt die
    // Satzliste beim bloßen Ansehen auf die heutige Zahl auf, und ein leerer
    // dritter Satz sieht danach aus wie einer, den jemand ausgelassen hat.
    if (!e.soll) e.soll = {};
    if (e.soll[exId] === undefined) e.soll[exId] = setCount;
  }
  // Ein Satz ist: benutztes Gewicht, abgehakt, und – wenn beantwortet – wie er
  // gelaufen ist (`wie`, siehe updateSet). Ein Feld `r` für Wiederholungen
  // stand hier jahrelang mit drin und wurde **nie beschrieben**: leer angelegt,
  // leer gespeichert, leer ausgewertet. Es ist raus. Ein Feld, das aussieht,
  // als würde es gefüllt, ist schlimmer als keins – die Volumenrechnung sah
  // danach aus, als kenne sie die Wiederholungen, und rechnete in Wahrheit mit
  // der Untergrenze des geplanten Bereichs.
  while (arr.length < setCount) arr.push({ w: '', done: false });
  // Gekürzt wird nur, was leer ist. Seit die Erfahrungsstufe die Satzzahl
  // bestimmt (drei Sätze für Geübte, zwei für Anfänger), würde ein Wechsel
  // sonst rückwirkend den dritten Satz jeder protokollierten Übung löschen –
  // eine Einstellung darf keine Trainingsgeschichte wegräumen.
  // `r` steht in alten Ständen noch drin und darf einen Satz nicht am Leben
  // halten: geprüft wird auf leer im Sinne von "nichts eingetragen".
  const leer = (x) => !x.done && !x.w && !x.wie;
  while (arr.length > setCount && leer(arr[arr.length - 1])) arr.pop();
  return arr;
}

/** Wurde an diesem Workout überhaupt schon etwas eingetragen oder abgehakt? */
export function isStarted(n) {
  const e = state.log[n];
  if (!e) return false;
  return ['db', 'bw'].some((m) => Object.values(e[m] || {}).some(
    (arr) => Array.isArray(arr) && arr.some((s) => s.done || !!s.w || !!s.wie),
  ));
}

/** Tag, an dem tatsächlich trainiert wurde – oder null, solange nichts erfasst ist. */
export function startedOn(n) {
  const e = state.log[n];
  return (e && e.startedOn) || null;
}

/** Hält fest, wann eine Einheit begonnen wurde, bzw. löst die Markierung wieder. */
function syncStartedOn(n) {
  const e = state.log[n];
  if (!e) return;
  if (isStarted(n)) {
    if (!e.startedOn) e.startedOn = todayISO();
  } else {
    delete e.startedOn;
  }
}

/**
 * Laufende Pause setzen oder beenden. Gespeichert wird der Endzeitpunkt, nicht
 * die Restdauer – so stimmt die Anzeige auch, wenn das Handy zwischendurch
 * gesperrt war und die App erst später wieder in den Vordergrund kommt.
 */
export function setRest(rest) {
  state.rest = rest;
  persist();
  emit();
}

/** Arbeitsgewicht einer Übung; null, solange der Nutzer nichts geändert hat. */
export function weightOf(exId) {
  const w = state.weights[exId];
  return typeof w === 'number' ? w : null;
}

export function setWeight(exId, kg) {
  // Auf Viertelkilo runden, nicht auf halbe: die Gewichtsschritte gehen je
  // Übung, und die kleinen liegen bei 1,25 kg. Mit halben Kilo wurde aus dem
  // Vorschlag "auf 21,25 kg" beim Annehmen still 21,5.
  const v = Math.max(0, Math.round(kg * 4) / 4);
  state.weights[exId] = v;
  persist();
  emit();
  return v;
}

/* Die Uhr des Trainings.
 *
 * Sie misst nicht die Zeit seit dem Startknopf, sondern die Zeit, die wirklich
 * trainiert wurde: Sie läuft, solange die App offen ist oder eine Pause läuft,
 * und steht, wenn beides nicht zutrifft. Wer zwischendurch aufs Handy verzichtet
 * oder die App weglegt, bekommt sonst eine Einheit von zwei Stunden angezeigt,
 * in der er vierzig Minuten trainiert hat.
 *
 * `clock` hält deshalb zwei Zahlen: `spent` ist die schon gezählte Zeit in
 * Millisekunden, `since` der Zeitpunkt, seit dem sie wieder läuft (oder null,
 * wenn sie steht). Beides hängt an der Einheit und am Tag, damit Fortsetzen
 * kein Neuanfang ist – und damit am nächsten Morgen nicht eine zwölfstündige
 * Einheit dasteht.
 */

export function startSession(n) {
  const c = state.clock;
  const weiter = c && c.n === n && c.on === todayISO();
  state.clock = {
    n, on: todayISO(), spent: weiter ? c.spent : 0, since: Date.now(),
    // Mitgenommen wird auch, was davon schon ins Protokoll gebucht ist –
    // sonst zählte eine fortgesetzte Einheit ihre bisherige Zeit doppelt.
    gebucht: weiter ? (c.gebucht || 0) : 0,
  };
  state.session = { n };
  persist();
  emit();
}

export function endSession() {
  clockStop();
  state.session = null;
  persist();
  emit();
}

/**
 * Gezählte Zeit in die Einheit schreiben.
 *
 * Die Uhr lebte bisher nur für die laufende Einheit: `state.clock` wird beim
 * Start der nächsten überschrieben, und damit war die Trainingszeit weg. Sie
 * gehört ins Protokoll, wo auch die Sätze stehen.
 *
 * Gebucht wird die *Differenz* zum schon Gebuchten, nicht die Summe – sonst
 * zählte jede Unterbrechung (App im Hintergrund, Seite verlassen) die bisherige
 * Zeit noch einmal dazu. Nur in eine Einheit, die es schon gibt: Wer startet
 * und ohne einen einzigen Satz aufhört, hat nicht trainiert.
 */
function bucheZeit() {
  const c = state.clock;
  if (!c) return;
  const gesamt = Math.floor(c.spent / 1000);
  const schon = c.gebucht || 0;
  if (gesamt <= schon) return;
  const e = state.log[c.n];
  if (e) e.secs = (e.secs || 0) + (gesamt - schon);
  state.clock = { ...c, gebucht: gesamt };
}

/** Uhr anhalten – App im Hintergrund oder Training beendet. */
export function clockStop() {
  const c = state.clock;
  if (!c || c.since === null) return;
  state.clock = { ...c, spent: c.spent + (Date.now() - c.since), since: null };
  bucheZeit();
  persist();
}

/** Uhr weiterlaufen lassen – App wieder da. */
export function clockStart() {
  const c = state.clock;
  if (!state.session || !c || c.since !== null) return;
  state.clock = { ...c, since: Date.now() };
  persist();
}

/**
 * Nachträglich Zeit gutschreiben, die zum Training gehört.
 *
 * Es gibt genau einen Fall: Wer die App mitten in einer Pause verlässt, dessen
 * Pause läuft weiter – sie gehört zum Training, auch wenn man dabei nicht aufs
 * Handy schaut. Der Rest der Abwesenheit gehört nicht dazu.
 *
 *     „Die Zeit geht iwie immer weiter wenn ich aus der app rausgeh"
 *
 * Und so war es: Solange eine Pause lief, hielt die Uhr beim Verlassen gar
 * nicht an – auch nicht, wenn die Pause zwei Minuten später abgelaufen war und
 * das Handy noch eine halbe Stunde in der Tasche lag. Jetzt hält sie immer an,
 * und beim Zurückkommen wird genau die Pause nachgetragen, die währenddessen
 * noch offen war.
 */
export function clockCredit(ms) {
  const c = state.clock;
  const dazu = Math.max(0, Math.round(Number(ms) || 0));
  if (!c || !dazu) return;
  state.clock = { ...c, spent: c.spent + dazu };
  bucheZeit();
  persist();
}

/**
 * Beim Laden der Seite: die Lücke seit dem letzten Mal nicht mitzählen.
 *
 * Normalerweise hält `pagehide` die Uhr an, bevor die Seite verschwindet. Wird
 * der Browser abgeschossen oder das Handy hart ausgeschaltet, bleibt `since`
 * stehen – und ohne diese Zeile stünden beim nächsten Öffnen die Stunden
 * dazwischen in der Einheit.
 */
export function clockResync() {
  const c = state.clock;
  if (!c || c.since === null) return;
  state.clock = { ...c, since: Date.now() };
  persist();
}

/** Bisher gezählte Trainingszeit der laufenden Einheit, in Sekunden. */
export function sessionSeconds() {
  const c = state.clock;
  if (!c) return 0;
  return Math.floor((c.spent + (c.since ? Date.now() - c.since : 0)) / 1000);
}

/**
 * Verschiebung des offenen Plans in Tagen.
 *
 * Auch negativ: Die Termine kommen aus der Excel und liegen unter Umständen in
 * der Zukunft. Vorher war hier eine Untergrenze von 0 – wer früher anfangen
 * wollte als die Tabelle vorsah, konnte nur warten.
 */
export function setShift(days) {
  const v = Math.round(Number(days) || 0);
  if (v === state.shift) return;
  state.shift = v;
  persist();
  emit();
}

/** Nur lesen – legt nichts an, damit reines Blättern den Speicher nicht füllt. */
export function peekSets(n, mode, exId) {
  const e = state.log[n];
  const arr = e && e[mode] && e[mode][exId];
  return Array.isArray(arr) ? arr : null;
}

export function updateSet(n, mode, exId, setCount, index, patch) {
  const arr = getSets(n, mode, exId, setCount);
  Object.assign(arr[index], patch);
  const e = ensure(n);
  // Beim Antippen zählt, was gerade auf dem Bildschirm steht: Wer die Stufe
  // mitten in einer Einheit wechselt, trainiert ab da die neue Satzzahl.
  if (!e.soll) e.soll = {};
  e.soll[exId] = setCount;
  e.mode = mode;
  syncStartedOn(n);
  persist();
  emit();
}

export function resetWorkout(n, mode) {
  const e = state.log[n];
  if (!e) return;
  e[mode] = {};
  if (e.done === mode) delete e.done;
  // Verworfen ist verworfen: Der nächste Anlauf an dieser Einheit fängt die
  // Zeit wieder bei null an.
  if (state.clock && state.clock.n === n) state.clock = null;
  syncStartedOn(n);
  persist();
  emit();
}

export function completeWorkout(n, mode, exList) {
  const e = ensure(n);
  e.mode = mode;
  exList.forEach((item) => {
    const arr = getSets(n, mode, item.id, item.sets);
    // `w` mitschreiben, sonst fehlt der Eintrag später überall dort, wo das
    // Gewicht zählt: in der Verlaufskurve und in der Steigerungsserie.
    arr.forEach((s) => { s.done = true; if (item.w && s.w === '') s.w = item.w; });
  });
  syncStartedOn(n);
  persist();
  emit();
}

/* Reha-Übungen einer Einheit. Sie hängen am Workout, nicht am Tag: Gemacht
 * werden sie im Anschluss ans Training, und wer eine Einheit zurücksetzt, setzt
 * sie mit zurück. In die Volumenrechnung gehen sie nicht ein – Reha-Arbeit ist
 * kein Muskelaufbau. */
export function careDone(n, key) {
  const e = state.log[n];
  return !!(e && e.care && e.care[key]);
}

export function toggleCare(n, key) {
  const e = ensure(n);
  const care = e.care || (e.care = {});
  if (care[key]) delete care[key];
  else care[key] = true;
  syncStartedOn(n);
  persist();
  emit();
}

/**
 * Einheit für erledigt erklären, auch wenn nicht jeder Satz steht.
 *
 * "Abschließen" heißt genau das: Ich bin für heute fertig. Wer den letzten Satz
 * Wadenheben weglässt, hat trotzdem trainiert – und der Tag soll im Kalender
 * und in der Serie als trainiert zählen. Gespeichert wird die Variante, in der
 * abgeschlossen wurde; ein Zurücksetzen nimmt sie wieder zurück.
 */
/**
 * Einheiten auf ihre eigene Übungsliste festschreiben – siehe planWechsel()
 * in js/app.js. `einheiten`: { [n]: [{ id, sets }] }. Was schon eine hat,
 * behält sie: Festgeschrieben wird der Stand des Tages, an dem trainiert
 * wurde, nicht der des zweiten Planwechsels danach.
 */
export function festschreiben(einheiten) {
  let neu = 0;
  Object.entries(einheiten).forEach(([n, liste]) => {
    const e = state.log[n];
    if (!e || e.fest || !liste.length) return;
    e.fest = liste.map(({ id, sets }) => ({ id, sets }));
    neu += 1;
  });
  if (neu) { persist(); emit(); }
  return neu;
}

export function markDone(n, mode) {
  const e = ensure(n);
  e.done = mode;
  // Mit Supersätzen dauert eine Einheit rund 40 % kürzer, und die
  // Zeitformel kennt keine – die Eichung (zeitEichung in js/app.js) lässt
  // solche Einheiten deshalb aus. Dafür muss sie wissen, welche es waren.
  if (state.supersatz) e.super = true;
  else delete e.super;
  syncStartedOn(n);
  persist();
  emit();
}

/* Eigene Einheiten. Sie stehen neben dem Plan, nicht darin: Der Plan rechnet
 * sein Wochenvolumen aus 84 festen Einheiten, und eine dazwischengeschobene
 * würde diese Rechnung stillschweigend verschieben. Was hier abgehakt wird,
 * zählt deshalb in der Statistik mit – bei Sätzen und Volumen –, aber nicht als
 * erledigte Plan-Einheit. */
export function customs() { return state.customs || []; }

export function customById(id) { return customs().find((c) => c.id === id) || null; }

export function saveCustom(entwurf) {
  const liste = customs();
  const id = entwurf.id || `c${Date.now().toString(36)}`;
  const eintrag = { id, name: entwurf.name || 'Eigenes Workout', ex: entwurf.ex || [] };
  const i = liste.findIndex((c) => c.id === id);
  if (i >= 0) liste[i] = eintrag;
  else liste.push(eintrag);
  state.customs = liste;
  persist();
  emit();
  return id;
}

export function removeCustom(id) {
  state.customs = customs().filter((c) => c.id !== id);
  delete state.log[id];
  persist();
  emit();
}

/* Freunde. Kein Konto und kein Server – hier liegt nur, was jemand einem
 * geschickt hat, mit dem Tag, an dem es angekommen ist. */
export function setFriend(id, stand) {
  const g = normStand(stand);
  if (!g) return;
  state.friends[id] = { ...g, am: todayISO() };
  persist();
  emit();
}

export function removeFriend(id) {
  delete state.friends[id];
  persist();
  emit();
}

/* Bandstärke statt Gewicht. Am Band gibt es keine Kilo, aber zwei Bänder –
 * gelb leicht, rot schwer. Das ist die Steigerung: gleiche Übung, stärkeres
 * Band. Gespeichert wird sie je Übung, genau wie das Arbeitsgewicht. */
export function bandOf(exId) { return state.bands[exId] || null; }

export function setBand(exId, farbe) {
  if (farbe) state.bands[exId] = farbe;
  else delete state.bands[exId];
  persist();
  emit();
}

/** Aufschlag an Wiederholungen im Bodyweight-Modus. */
export function bwPlusOf(exId) { return state.bwPlus[exId] || 0; }

export function addBwPlus(exId, delta) {
  state.bwPlus[exId] = Math.max(0, (state.bwPlus[exId] || 0) + delta);
  persist();
}

/** Verletzung an- oder abhaken. Gilt für alle kommenden Trainings. */
export function toggleInjury(id, on) {
  const set = new Set(state.injuries || []);
  if (on) set.add(id);
  else set.delete(id);
  state.injuries = [...set];
  persist();
}

/** Alle Haken auf einmal entfernen. */
export function clearInjuries() {
  state.injuries = [];
  persist();
}

export function setSetting(key, value) {
  state[key] = value;
  persist();
  emit();
}

/** Hält fest, dass gesichert wurde – gemessen an der Zahl erledigter Einheiten. */
export function markBackup(done) {
  state.lastBackup = { on: todayISO(), done };
  persist();
  emit();
}

/**
 * Plan von vorn beginnen. Der bisherige Verlauf wandert in `rounds`, die
 * Gewichte bleiben stehen – Runde zwei startet also auf dem erreichten Stand
 * und nicht wieder bei den Anfangswerten.
 *
 * `bilanz` ist die Zusammenfassung dessen, was in dieser Runde geleistet wurde:
 * {einheiten, saetze, volumen, db, bw}. Sie kommt aus js/app.js, weil nur die
 * App den Plan kennt – und sie kommt **jetzt**, weil sie später nicht mehr
 * sauber nachzurechnen ist: Ein Protokoll speichert nur die angetippten
 * Übungen, nicht die geplanten. Aus dem Log allein lässt sich deshalb nicht
 * unterscheiden, ob jemand eine Einheit fertig gemacht oder nach der ersten
 * Übung aufgehört hat. Ohne diesen Vermerk müsste der Stufenaufstieg raten.
 */
export function restartPlan(shiftDays, bilanz) {
  return mitAblage(() => {
    if (Object.keys(state.log).length) {
      // Der Fokus gehört dazu: Ein Protokoll ist nach Workout-Nummer abgelegt,
      // und Workout 3 im Beinplan hat andere Übungen als Workout 3 im
      // ausgewogenen. Ohne diesen Vermerk ließe sich ein Verlauf in einen Plan
      // zurückholen, in den er nicht gehört.
      state.rounds.push({
        finishedOn: todayISO(), log: state.log, focus: state.focus,
        ...(bilanz ? { bilanz } : {}),
      });
    }
    state.log = {};
    state.session = null;
    state.clock = null;
    state.rest = null;
    state.shift = Math.round(Number(shiftDays) || 0);
  });
}

/**
 * Trainingsfokus wechseln, ohne dass etwas verschwindet.
 *
 * *„Hab auf cut gewechselt und anscheinend hat er damit vergessen dass ich
 * gestern und vorgestern trainiert hab. Die Übergänge von cut zu Aufbau usw
 * müssen natürlich flüssig sein."*
 *
 * Der Wechsel ging bisher über restartPlan(): Verlauf in die Ablage, neuer Plan
 * bei null. Zurückholen ließ er sich nur von Hand, über einen Knopf unter Mehr,
 * den man kennen muss. Wer zwischen Aufbau und Cut hin und her wechselt – und
 * genau dafür sind die Varianten da –, verlor damit jedes Mal seinen Stand aus
 * den Augen.
 *
 * Ein Protokoll steht weiterhin nach Workout-Nummer, und Workout 3 im Cut-Plan
 * hat andere Übungen als Workout 3 im Aufbau. Zusammenführen lässt sich das
 * nicht. Was geht: **je Fokus einen eigenen Verlauf halten.** Der laufende
 * wandert beim Wechsel in die Ablage, und der Verlauf des Ziel-Fokus kommt von
 * dort zurück, samt seiner Verschiebung – der Cut-Plan steht also wieder genau
 * da, wo man ihn verlassen hat. Zurück nach Aufbau, und der Aufbau-Plan steht
 * wieder da, wo *er* war.
 *
 * `startShift` gilt nur für einen Fokus, der noch keinen Verlauf hat: Damit legt
 * die App fest, auf welchen Tag dessen Workout 1 fällt (siehe frischerStart()
 * in js/app.js). Ohne das begänne ein neuer Plan am Tag nach dem letzten
 * Training – oder heute, als dritter Trainingstag in Folge.
 */
export function wechsleFokus(key, bilanz, startShift) {
  const alt = state.focus || 'standard';
  if (key === alt) return false;
  return mitAblage(() => {
    if (Object.keys(state.log).length) {
      state.rounds.push({
        finishedOn: todayISO(), log: state.log, focus: alt, shift: state.shift,
        ...(bilanz ? { bilanz } : {}),
      });
    }
    const zurueck = letzteRunde(key);
    if (zurueck) state.rounds = state.rounds.filter((r) => r !== zurueck);
    state.log = (zurueck && zurueck.log) || {};
    state.shift = Math.round(Number(zurueck ? zurueck.shift : startShift) || 0);
    state.session = null;
    state.clock = null;
    state.rest = null;
    state.focus = key;
  });
}

/**
 * Der zuletzt abgelegte Verlauf genau dieses Fokus – oder null.
 *
 * Anders als restorable() **ohne** die Nachsicht für Runden ohne Fokus-Vermerk:
 * Die stammen aus einer Fassung, die nur einen Plan kannte, und ließen sich
 * deshalb keinem der heutigen zuordnen. Von Hand zurückgeholt ist das eine
 * Entscheidung, hier liefe es ungefragt.
 */
function letzteRunde(key) {
  const liste = state.rounds || [];
  for (let i = liste.length - 1; i >= 0; i--) {
    if (liste[i].focus === key) return liste[i];
  }
  return null;
}

/**
 * Den zuletzt abgelegten Verlauf zurückholen.
 *
 * `restartPlan` ist die einzige Stelle, an der ein Protokoll aus dem laufenden
 * Plan verschwindet – und sie hängt an einer einzigen Rückfrage, die man auch
 * aus Versehen wegklickt. Ohne Rückweg wäre das eine Falltür. (Der Wechsel des
 * Trainingsfokus ging früher denselben Weg; er holt seinen Verlauf inzwischen
 * von selbst zurück, siehe wechsleFokus().)
 *
 * Zusammengeführt wird pro Einheit: Was seit dem Neustart abgehakt wurde, bleibt
 * stehen; alles andere kommt zurück.
 *
 * Nur aus demselben Trainingsfokus: siehe restoreRound() weiter unten.
 */
export function restoreRound() {
  const runde = restorable();
  if (!runde) return false;
  return mitAblage(() => {
    state.rounds = state.rounds.filter((r) => r !== runde);
    const zurueck = runde.log || {};
    state.log = { ...state.log };
    Object.keys(zurueck).forEach((n) => {
      if (!state.log[n]) state.log[n] = zurueck[n];
    });
  });
}

/**
 * Der zuletzt abgelegte Verlauf, der in den heutigen Plan gehört – oder null.
 *
 * Ein Protokoll ist nach Workout-Nummer abgelegt, die Übungen dahinter stehen
 * aber im Plan. Aus einem anderen Fokus zurückgeholt, markierte es Einheiten
 * als erledigt, die jemand nie gemacht hat. Verläufe ohne Vermerk stammen aus
 * einer Fassung, die nur einen Plan kannte, und gelten deshalb als passend.
 */
export function restorable() {
  const liste = state.rounds || [];
  for (let i = liste.length - 1; i >= 0; i--) {
    const r = liste[i];
    if (!r.focus || r.focus === (state.focus || 'standard')) return r;
  }
  return null;
}

/** Hält fest, dass eine Kalenderdatei erzeugt wurde, und zählt SEQUENCE hoch. */
export function markIcs(count = 0) {
  const seq = (state.lastIcs && state.lastIcs.seq) || 0;
  // `count` merkt sich, wie viele Termine in der Datei standen. Beim nächsten
  // Export weiß die App damit, welche Nummern abzusagen sind.
  state.lastIcs = { on: todayISO(), shift: state.shift, seq: seq + 1, count };
  persist();
  emit();
  return state.lastIcs;
}

/**
 * Alles für die Sicherung – bis auf das Betreiber-Passwort.
 *
 * Eine Sicherungsdatei wird weitergegeben, auf einen anderen Rechner, in eine
 * Cloud, per Mail an sich selbst. Das Passwort für die Übersicht hat darin
 * nichts zu suchen; es öffnet die Daten aller anderen. Es steht ohnehin nicht
 * mehr im Zustand – die Zeile hier ist der Riegel für alte Stände, die es noch
 * mitschleppen.
 */
export function exportJSON() {
  const { adminPass, ...rest } = state;
  return JSON.stringify(rest, null, 2);
}

/**
 * Sicherung einlesen.
 *
 * Geprüft wird nicht aus Misstrauen, sondern weil eine halb passende Datei
 * sonst still einen Zustand hinterlässt, in dem die App merkwürdig wird –
 * `injuries` als Zeichenkette etwa, oder ein `log` voller Fremdformate. Alles
 * Unbekannte fällt weg, alles Bekannte wird auf seinen Typ gebracht.
 */
export function importJSON(text) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)
      || !parsed.log || typeof parsed.log !== 'object' || Array.isArray(parsed.log)) {
    throw new Error('Unerwartetes Format – "log" fehlt.');
  }
  const fresh = clone(DEFAULT_STATE);
  Object.keys(DEFAULT_STATE).forEach((key) => {
    const v = parsed[key];
    if (v === undefined || v === null) return;
    const soll = DEFAULT_STATE[key];
    if (Array.isArray(soll) !== Array.isArray(v)) return;
    if (soll !== null && typeof soll !== typeof v) return;
    fresh[key] = v;
  });
  if (typeof fresh.shift !== 'number' || !Number.isFinite(fresh.shift)) fresh.shift = 0;
  fresh.injuries = fresh.injuries.filter((x) => typeof x === 'string');
  fresh.friends = normFreunde(fresh.friends);
  fresh.customs = normCustoms(fresh.customs);
  // Was an *diesem Gerät* hängt, kommt nicht aus der Datei. Vorher übernahm
  // der Import auch `share`, `deviceId` und `lastShare`: Eine bewusst
  // abgeschaltete Telemetrie war danach still wieder an, und zwei Geräte
  // meldeten unter derselben Kennung. Die Zusage „abschaltbar" gilt auch über
  // einen Umzug hinweg.
  ['share', 'deviceId', 'lastShare'].forEach((k) => { fresh[k] = state[k]; });
  // Der bisherige Stand wird beiseitegelegt, bevor er ersetzt wird – eine
  // versehentlich gewählte ältere Sicherung kostete sonst ohne Rückweg alles
  // seit damals. Klappt das nicht (Speicher voll), geht der Import trotzdem:
  // Gefragt wurde vorher.
  try {
    localStorage.setItem(KEY_VOR_IMPORT, JSON.stringify({ am: new Date().toISOString(), stand: state }));
  } catch { /* kein Platz – dann eben ohne Rückweg */ }
  state = fresh;
  // Passt die eingelesene Ablage nicht in ihren Schlüssel, bleibt sie im
  // Hauptschlüssel – sonst schriebe write() den Stand ohne sie.
  if (!schreibeRunden()) rundenImHaupt = true;
  persist();
  emit();
}

/** Gibt es einen Stand von vor dem letzten Import? { am } oder null. */
export function vorImport() {
  try {
    const roh = localStorage.getItem(KEY_VOR_IMPORT);
    return roh ? { am: JSON.parse(roh).am } : null;
  } catch { return null; }
}

/** Den Stand von vor dem letzten Import zurückholen – einmal, dann ist er weg. */
export function vorImportZurueck() {
  const roh = localStorage.getItem(KEY_VOR_IMPORT);
  if (!roh) return false;
  const { stand } = JSON.parse(roh);
  localStorage.removeItem(KEY_VOR_IMPORT);
  importJSON(JSON.stringify(stand));
  // importJSON hat eben den *eingelesenen* Stand beiseitegelegt; der ist
  // hier nicht gefragt, sonst gäbe es ein endloses Hin und Her.
  localStorage.removeItem(KEY_VOR_IMPORT);
  return true;
}

export function resetAll() {
  state = clone(DEFAULT_STATE);
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(KEY_RUNDEN);
  } catch { /* ignorieren */ }
  persist();
  emit();
}
