/*
 * Töne der App.
 *
 * Alles wird per Web Audio erzeugt, nichts geladen: keine zusätzliche Datei,
 * kein Netz, kein Zwischenspeicher, der veralten könnte. Ein Ton ist eine
 * Folge kurzer Stimmen – Sinus, Dreieck und Rechteck, mit Tiefpass, leichter
 * Verstimmung und einem Rauschanschlag davor (siehe SOUNDS).
 *
 * Drei Dinge sind hier wichtiger, als sie aussehen:
 *
 *   Freischalten.  Mobile Browser lassen Ton nur zu, wenn der AudioContext auf
 *                  eine Berührung zurückgeht. Deshalb entsteht er in der ERSTEN
 *                  aktivierenden Berührung der Seite – pointerup, touchend,
 *                  mousedown, keydown, einmal auf dem Dokument abgehört (siehe
 *                  beruehrung()). Ohne Berührung nur dort, wo der Browser keine
 *                  verlangt: In der installierten App wird das einmal gemessen,
 *                  nicht angenommen – ein Kontext, der sofort läuft, bleibt, einer,
 *                  der schläft, wird gleich wieder geschlossen (initAudio()). Was
 *                  die App davor schon wollte (eine Pause, die den Neustart
 *                  überdauert hat; ein Pausenende, bei dem niemand getippt hat),
 *                  merkt sie sich und holt es nach, sobald der Kanal frei ist –
 *                  einen Ton aber nur innerhalb seiner Frist, und nie, wenn die
 *                  Berührung selbst schon etwas Hörbares anstößt (den nächsten
 *                  Satz, eine neue Pause), der nächste Haken ist – auch ein
 *                  stummer – oder die Töne ausschaltet: siehe nachholen() und
 *                  tonUeberholt().
 *
 *   Vorausplanen.  Das Pausensignal wird nicht per setTimeout ausgelöst,
 *                  sondern beim Start der Pause fest auf die Uhr des
 *                  AudioContext gelegt. Diese Uhr läuft weiter, wenn die Seite
 *                  in den Hintergrund gerät – Zeitgeber der Seite werden dort
 *                  ausgebremst oder ganz eingefroren. Damit der Browser den
 *                  Kontext dabei nicht schlafen legt, läuft bis zum Signal ein
 *                  unhörbarer Trägerton mit (siehe traeger()).
 *
 *   Ehrlich zählen. *„Irgendwie gibt's überhaupt keine soundeffekte mehr in der
 *                  app"* – dahinter stecken zwei Ursachen, die von außen gleich
 *                  aussehen: Die App schickt keinen Ton los, oder sie schickt
 *                  ihn und das Gerät gibt ihn nicht aus. Gezählt wird deshalb
 *                  nicht, was angefordert wurde, sondern was der Kontext
 *                  wirklich wiedergegeben hat (`ended` nach der Startzeit) und
 *                  was davon zu spät kam – und getrennt davon jeder Ton, der
 *                  fällig war und nie kam. Jeder gewollte Ton landet in genau
 *                  einem Topf, und bei jedem steht, woran es lag: noch keine
 *                  Berührung seit dem Öffnen, oder ein Kanal, den der Browser
 *                  angehalten hatte. tonStand() liefert alles, Mehr → Töne und
 *                  Hinweise zeigt es.
 */

/*
 * Ein Ton ist ein Objekt, keine nackte Frequenz mehr:
 *
 *   f      Grundfrequenz in Hz
 *   bis    Zielfrequenz – der Ton gleitet dorthin (null = bleibt stehen)
 *   t      Versatz in Sekunden ab dem Beginn des Signals
 *   d      Dauer in Sekunden
 *   v      Lautstärke
 *   form   Wellenform: sine | triangle | square | sawtooth
 *   ct     Verstimmung in Cent für eine zweite Stimme daneben (0 = keine)
 *   tief   Tiefpass in Hz – nimmt den kantigen Formen die Schärfe
 *   knack  kurzer Rauschanteil davor, der dem Ton einen Anschlag gibt
 *
 * Warum der Aufwand: Ein reiner Sinuston klingt nach Piepser. Zwei leicht
 * gegeneinander verstimmte Stimmen schweben, ein Dreieck bringt Obertöne, ein
 * Tiefpass nimmt ihnen die Schärfe, und ein Hauch Rauschen davor macht aus
 * einem Ton einen Anschlag. Das ist der Unterschied zwischen einer Eieruhr und
 * etwas, das man dreimal die Woche gern hört.
 */
const SOUNDS = {
  // Training beginnt – aufsteigender Dreiklang, warm und breit.
  start: [
    { f: 261.63, t: 0, d: 0.5, v: 0.1, form: 'triangle', ct: 6, tief: 2200 },
    { f: 392.00, t: 0.09, d: 0.42, v: 0.11, form: 'triangle', ct: 6, tief: 2400 },
    { f: 523.25, t: 0.18, d: 0.55, v: 0.13, form: 'triangle', ct: 8, tief: 2600 },
  ],
  // Satz abgehakt – ein Anschlag, kein Piepser. Kommt zwanzigmal pro Training
  // vor und muss deshalb kurz, satt und unaufdringlich sein: ein tiefer
  // Grundton mit einem Hauch Rauschen davor, das Ganze in 120 Millisekunden.
  set: [
    { f: 660, bis: 440, t: 0, d: 0.09, v: 0.13, form: 'triangle', tief: 3000, knack: 0.012 },
    { f: 220, t: 0, d: 0.14, v: 0.06, form: 'sine' },
  ],
  // Übung fertig, nächste kommt – zwei Stufen hoch, mit Schweben.
  exercise: [
    { f: 523.25, t: 0, d: 0.13, v: 0.13, form: 'triangle', ct: 7, tief: 2600 },
    { f: 783.99, t: 0.1, d: 0.36, v: 0.15, form: 'triangle', ct: 9, tief: 3000 },
    { f: 261.63, t: 0.1, d: 0.4, v: 0.05, form: 'sine' },
  ],
  // Fertig machen – fünf Sekunden vor Schluss. Zwei kurze, tiefere Tupfer:
  // erkennbar anders als das Signal selbst, sonst steht man zu früh auf.
  ready: [
    { f: 587.33, t: 0, d: 0.09, v: 0.15, form: 'square', tief: 1500 },
    { f: 587.33, t: 0.16, d: 0.09, v: 0.15, form: 'square', tief: 1500 },
  ],
  // Pause vorbei – das lauteste Signal, es muss quer durch den Raum kommen.
  // Ein Glockenschlag: Grundton lang, zwei Obertöne kurz darüber, dazu ein
  // Anschlag. Danach der zweite Schlag eine Quinte höher.
  rest: [
    { f: 880, t: 0, d: 0.6, v: 0.3, form: 'triangle', ct: 5, tief: 4000, knack: 0.02 },
    { f: 1760, t: 0, d: 0.16, v: 0.1, form: 'sine' },
    { f: 2640, t: 0, d: 0.09, v: 0.05, form: 'sine' },
    { f: 1318.5, t: 0.3, d: 0.55, v: 0.26, form: 'triangle', ct: 5, tief: 5000, knack: 0.015 },
    { f: 440, t: 0, d: 0.5, v: 0.09, form: 'sine' },
  ],
  // Workout komplett – eine kleine Fanfare, die sich Zeit nimmt.
  done: [
    { f: 523.25, t: 0, d: 0.16, v: 0.13, form: 'triangle', ct: 6, tief: 2600 },
    { f: 659.25, t: 0.13, d: 0.16, v: 0.13, form: 'triangle', ct: 6, tief: 2800 },
    { f: 783.99, t: 0.26, d: 0.16, v: 0.14, form: 'triangle', ct: 7, tief: 3000 },
    { f: 1046.5, t: 0.39, d: 0.9, v: 0.16, form: 'triangle', ct: 9, tief: 3400, knack: 0.015 },
    // Der Akkord darunter, der stehen bleibt – das ist die halbe Feier.
    { f: 261.63, t: 0.39, d: 1.1, v: 0.07, form: 'sine' },
    { f: 392.00, t: 0.39, d: 1.0, v: 0.06, form: 'sine' },
    { f: 523.25, t: 0.44, d: 0.95, v: 0.05, form: 'sine' },
  ],
  // Training beendet oder abgebrochen – absteigend, ohne Feierlichkeit.
  stop: [
    { f: 587.33, t: 0, d: 0.18, v: 0.12, form: 'triangle', tief: 1800 },
    { f: 392.00, t: 0.14, d: 0.4, v: 0.12, form: 'triangle', ct: 5, tief: 1600 },
  ],
};

/** Die Reihe, die „Töne anhören" spielt – so steht sie auch im Toast daneben. */
export const PROBE = ['start', 'set', 'exercise', 'ready', 'rest', 'done'];
const PROBE_TAKT = 0.9;   // Sekunden von Ton zu Ton

/*
 * Ein Signal gilt als „läuft schon", wenn seine Startzeit höchstens so weit in
 * der Zukunft liegt. Der Takt der Pausenuhr ist eine Viertelsekunde, und
 * `currentTime` zeigt das zuletzt gerenderte Quantum, nicht die Wanduhr – ohne
 * diese Toleranz würde endRest() ein Signal, das in 20 ms anfängt, als „nicht
 * gespielt" verwerfen und ein zweites obendrauf setzen.
 *
 * Nur am echten Ende der Pause, nirgends sonst (cancelSound({ ausklingen })).
 * Galt sie für jeden, der aufräumt, kam ein Signal, das in den letzten 0,3 s
 * vor seinem Start stand, trotzdem: nach „+30 s", nach „Pause weg" – und beim
 * Zurückkommen in die App doppelt, weil armRest() ein zweites danebenlegte.
 */
const GLEICH = 0.3;

/*
 * Wie lange ein vorgemerkter Ton nachgeholt werden darf, wenn der Aufrufer
 * nichts anderes sagt – und ab wann ein Ton als verspätet gilt.
 *
 * Ein Gong, der eine Minute nach dem Pausenende kommt, ist kein Signal mehr,
 * sondern ein Rätsel. endRest() gibt dem „Pause vorbei" deshalb eine Frist ab
 * dem Pausenende mit; danach verfällt er und bleibt als verpasst gezählt. Die
 * Frist allein reicht nicht: Ein Satz dauert 20 bis 60 s, die erste Berührung
 * nach dem Pausenende ist meist der nächste Haken – und mit ihm kam „Pause
 * vorbei" zuerst genau dann, wenn die neue Pause begann. Das regelt
 * nachholen(), nicht die Frist. Verspätet heißt: mehr als zwei Sekunden nach
 * der Zeit, zu der er hätte kommen sollen – so lange dauert ein Tipp, nicht
 * aber ein angehaltener Kanal.
 */
const NACHHOLEN_MS = 60000;
const SPAET_MS = 2000;

let ctx = null;
let geplant = [];      // vorausgelegte Pausensignale (siehe klang())
let probe = [];        // „Töne anhören" – eigene Liste, cancelSound() lässt sie in Ruhe
let traegerTon = null;

// Ohne Berührung schon einmal gemessen, ob ein Kontext von selbst läuft? Einmal
// je Dokument genügt: Die Regel des Browsers ändert sich ohne Berührung nicht,
// und jeder weitere Versuch hinterließe nur eine Konsolenmeldung.
let probiert = false;

// Wohin jeder gewollte Ton gekommen ist – in genau einen Topf. Nicht Kosmetik:
// „Ich höre nichts" hat zwei ganz verschiedene Ursachen – die App erzeugt
// keinen Ton, oder sie erzeugt ihn und das Gerät gibt ihn nicht aus. Von außen
// sehen beide gleich aus, und ohne diese Zahlen lässt sich das nicht trennen.
//
//   gespielt    vom Kontext wiedergegeben, pünktlich oder nicht
//   verspaetet  davon mehr als SPAET_MS nach seiner Zeit …
//   nachgeholt  … und davon wiederum die, die bis zur ersten Berührung
//               vorgemerkt waren
//   verpasst    fällig gewesen und nie gekommen …
//   ohneKontext … und davon die, für die es noch gar keinen Kontext gab: Vor
//               der ersten Berührung nach dem Öffnen lässt der Browser keinen
//               Ton zu. Der Rest von `verpasst` lag auf einem Kontext, den der
//               Browser angehalten hatte. Zwei Ursachen, die unter Mehr
//               verschieden heißen müssen – sonst liest man bei einem Ton, der
//               nur auf den ersten Tipp wartete, „angehalten" und sucht ein
//               Problem im Hintergrund, das es nie gab. (In tonStand() heißt
//               dieser Topf `gesperrt`; hier nicht – im Ein-Datei-Bündel
//               teilen sich alle Module einen Gültigkeitsbereich.)
let gespielt = 0;
let verspaetet = 0;
let nachgeholt = 0;
let verpasst = 0;
let ohneKontext = 0;

// Wie oft die App seit dem Laden einen Ton angestoßen hat (playSound,
// probeSpielen, scheduleSound mit einem Plan). Nur ein Vergleichswert für
// nachholen(): Hat die Berührung, die den Ton freischaltet, selbst schon einen
// angestoßen?
let angestossen = 0;

// Die erste aktivierende Berührung: Hat der Lauscher sie gesehen, und wann?
// Beide braucht tonStand(): Ein Kanal, der anderthalb Sekunden nach dieser
// Berührung immer noch schläft, ist ein Problem – einer, der noch nie berührt
// wurde, nur die Regel des Browsers.
let beruehrt = false;
let beruehrtSeit = 0;

// Was vor dem Freischalten gewünscht wurde und nachgeholt wird, sobald der
// Kanal frei ist:
//
//   wunschPlan  die Pause neu auflegen – `neu` ist ein Rückruf, der die
//               Restzeit frisch rechnet; `faellig` sagt, wann ihre Töne auf
//               der Wanduhr dran wären (für die Zählung, falls sie verfällt)
//   wunschTon   ein Ton, der sofort hätte kommen sollen – praktisch immer
//               „Pause vorbei" aus einem Pausenende, bei dem niemand getippt
//               hat –, mit seiner Zeit (`faellig`) und seiner Frist (`bis`)
//
// Der Ton zählt als verpasst (ohne Kontext), solange er aussteht und wenn er
// verfällt; erst nachgeholt wechselt er den Topf. Vom Plan zählt, was beim
// Auflösen schon fällig war (planAufloesen()).
let wunschPlan = null;
let wunschTon = null;

// Wer erfahren will, wenn sich an tonStand() etwas ändert – die Zeile unter
// Mehr → Töne und Hinweise, die stille Zeile im Dashboard.
const lauscher = new Set();

export function onTonStand(cb) {
  lauscher.add(cb);
}

function tonMelden() {
  lauscher.forEach((cb) => {
    try { cb(); } catch { /* ein Zuhörer darf den Ton nicht mitreißen */ }
  });
}

/**
 * Hat das Dokument eine aktivierende Berührung gesehen?
 *
 * Wo es `navigator.userActivation` gibt (Chrome, Safari ab 16.4, Firefox ab
 * 120), zählt dessen Wort: `hasBeenActive` ist genau die Marke, an der Chrome
 * die Tonsperre festmacht – sie wird beim pointerup/touchend/mousedown/keydown
 * gesetzt, nicht beim touchstart, und nicht beim Scrollen. Ohne die API bleibt
 * nur, was der eigene Lauscher gesehen hat.
 */
export function tonFrei() {
  const u = navigator.userActivation;
  return u ? u.hasBeenActive : beruehrt;
}

/**
 * iOS: Die Tonsitzung als „ambient" anmelden – mischbar, Musik läuft weiter.
 *
 * Wer mit Spotify im Ohr trainiert, soll die Musik behalten. Naheliegend wäre
 * 'playback', damit das Signal den Stummschalter des iPhones übertönt. Nur ist
 * 'playback' nach der Audio Session API (W3C-Entwurf, MDN, Safari ab 16.4) die
 * NICHT mischbare Wiedergabe: Andere Wiedergabe wird angehalten – und zwar,
 * solange der Kontext rendert, und der läuft hier nach der ersten Berührung
 * das ganze Training (Trägerton in jeder Pause). Die Musik wäre ab dem ersten
 * Ton für das ganze Training weg, nicht „kurz". 'playback' nur rund um ein
 * Signal hilft nicht: Auch dann hält iOS die Musik bei jedem Gong an, und ob
 * sie danach weiterläuft, entscheidet die andere App. Mischbar und zugleich am
 * Stummschalter vorbei gibt es in WebKit nicht.
 *
 * Also 'ambient', ausdrücklich: Das ist die Sitzung, die der Entwurf als
 * mischbar beschreibt, und die, in der Web Audio auf iOS bis v240 ohnehin lag
 * ('auto'). Der Preis steht unter Mehr → Töne und Hinweise: Ist der
 * Stummschalter an, bleibt die App stumm. Nicht am Gerät gemessen, aus den
 * Quellen. Wo es die API nicht gibt, passiert nichts.
 */
function tonSitzung() {
  try {
    const s = navigator.audioSession;
    if (s && 'type' in s && s.type !== 'ambient') s.type = 'ambient';
  } catch { /* nicht vorhanden oder nicht erlaubt – dann eben nicht */ }
}

/** Läuft die Seite als installierte App (Startbildschirm, eigenes Fenster)? */
function installiert() {
  try {
    return navigator.standalone === true
      || ['standalone', 'fullscreen', 'minimal-ui'].some((m) => window.matchMedia(`(display-mode: ${m})`).matches);
  } catch {
    return false;
  }
}

function moeglich() {
  return !!(window.AudioContext || window.webkitAudioContext);
}

/**
 * AudioContext anlegen – aus einer Berührung heraus, oder dort, wo der Browser
 * keine verlangt.
 *
 * Ohne Berührung entstand bis v240 hier ein Kontext im Zustand 'suspended' mit
 * einem resume(), das nie antwortet: Töne, die darauf gelegt wurden, lagen auf
 * einer stehenden Uhr und klingelten beim nächsten Tipp alle auf einmal nach –
 * *„Jetzt fehlt iwie die Pause"*, und beim nächsten Satz ein Gong zur Unzeit.
 *
 * Ohne Berührung gar keinen anzulegen wäre die einfache Antwort – und für die
 * installierte App die falsche: Chrome hat dort keine Tonsperre (laut seinen
 * Autoplay-Regeln dürfen zum Startbildschirm hinzugefügte Seiten von selbst
 * spielen; nicht am Gerät gemessen), und ein Pausenende nach dem Neuladen,
 * das in v240 klang, bliebe stumm. Deshalb wird gemessen statt angenommen: In
 * der installierten App legt diese Funktion ohne Berührung einmal je Dokument
 * einen Kontext an und behält ihn nur, wenn er sofort läuft. Ein schlafender
 * wird gleich wieder geschlossen und nie als bereit gewertet – dann bleibt es
 * beim Vormerken (playSound, scheduleSound). Im Browser-Tab wird nicht
 * probiert: Dort sperrt Chrome auf dem Handy immer, und ein Versuch
 * hinterließe nur die Konsolenmeldung „The AudioContext was not allowed to
 * start".
 */
export function initAudio() {
  if (ctx) return;
  const frei = tonFrei();
  if (!frei && (probiert || !installiert())) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  tonSitzung();
  let c;
  try { c = new Ctx(); } catch { return; }
  if (!frei) {
    probiert = true;
    if (c.state !== 'running') {
      try { c.close().catch(() => {}); } catch { /* egal – er wird nicht benutzt */ }
      return;
    }
  }
  ctx = c;
  ctx.addEventListener('statechange', tonMelden);
  tonMelden();
}

/**
 * Einen schlafenden Kontext wecken.
 *
 * Nicht nur 'suspended': iOS setzt den Kontext nach einem Anruf oder einem
 * App-Wechsel auf 'interrupted', und der bleibt es, bis ihn jemand weckt. Alles,
 * was nicht läuft und nicht geschlossen ist, bekommt ein resume(). Ein
 * verweigertes resume() lehnt nicht ab, es bleibt offen – und löst sich bei der
 * nächsten Berührung von selbst.
 */
function wecken() {
  if (!ctx || ctx.state === 'running' || ctx.state === 'closed') return;
  try { ctx.resume().catch(() => {}); } catch { /* egal */ }
}

/**
 * Die erste Berührung, die der Browser als Aktivierung zählt – und jede
 * weitere.
 *
 * Hier entsteht der Kontext und wird geweckt, noch im selben Ereignis, bevor
 * irgendein Klick-Handler läuft: Das ist die eine Stelle, an der jeder Browser
 * den Ton freigibt. Chrome merkt sich die Aktivierung für die Lebensdauer des
 * Dokuments, iOS gibt einen einmal geweckten Kontext dauerhaft frei. Danach
 * wird nachgeholt, was vorher gewünscht war.
 *
 * pointerup und touchend, nicht pointerdown und touchstart: Ein liegender
 * Finger aktiviert nichts, erst das Loslassen; ein senkrechter Wisch (Scrollen)
 * gar nicht – deshalb die Rückfrage bei `userActivation`, wo es sie gibt.
 */
function beruehrung(ev) {
  const u = navigator.userActivation;
  if (u && !u.hasBeenActive) return;
  const erste = !beruehrt;
  if (erste) { beruehrt = true; beruehrtSeit = Date.now(); }
  initAudio();
  wecken();
  if (erste) {
    // Mit Maus und Tastatur ist schon das Drücken die Berührung, der Klick
    // kommt erst beim Loslassen (nachDemKlick()).
    nachholen(ev && (ev.type === 'mousedown' || ev.type === 'keydown'));
    // Schläft der Kanal trotz Berührung weiter, soll das jemand erfahren –
    // aber erst, wenn resume() seine Chance hatte (siehe tonStand().klemmt).
    setTimeout(tonMelden, 1600);
  }
  tonMelden();
}
for (const ev of ['pointerup', 'touchend', 'mousedown', 'keydown']) {
  document.addEventListener(ev, beruehrung, { capture: true, passive: true });
}

/**
 * Nach dem Freischalten: erst die Pause neu auflegen, dann den Ton, der fehlte.
 *
 * Den Ton nur innerhalb seiner Frist – und erst nach dem Klick derselben
 * Berührung. Dieser Lauscher läuft im capture, vor jedem Klick-Handler; was
 * die Berührung selbst auslöst, steht erst danach fest. Die erste Berührung
 * nach einer Pause, die nach dem Neuladen ohne Tipp ablief, ist meist der
 * nächste Haken. Hier sofort gespielt, kam „Pause vorbei" zusammen mit dessen
 * Tupfer und genau in dem Moment, in dem die neue Pause begann – gemessen 30 s
 * nach dem Pausenende, also mitten in der Frist. Hat die Berührung selbst
 * einen Ton angestoßen (Haken, neue Pause, Training beenden, „Töne anhören"),
 * ist der alte überholt: Er verfällt und bleibt als verpasst gezählt (das ist
 * er ja), mit derselben Ursache wie vorher. Kommt er dran, verlässt er diesen
 * Topf und landet dort, wo er wirklich ankommt – gespielt und verspätet, oder,
 * wenn auch jetzt nichts durchgeht, wieder verpasst.
 *
 * Ob die Berührung einen Ton angestoßen hat, reicht dafür nicht immer: Ein
 * Haken kann stumm bleiben („Ton bei jedem Satz" aus, im Supersatz ohne
 * Wartezeit weiter zum Partner), und „Töne" aus stößt gar nichts an. Beides
 * sagt die App ausdrücklich (tonUeberholt()).
 *
 * **Eine Pause, die schon vorbei ist, bleibt hier liegen.** Fällt die
 * Berührung in die Viertelsekunde zwischen dem Pausenende und dem Takt, der es
 * bemerkt, ist von ihrem Plan alles fällig, und neu auflegen lässt sich nichts
 * mehr. Aufgelöst zählte er hier den Gong als verpasst – und gleich danach gab
 * endRest() ihn als Ersatz, gespielt: ein Ton in zwei Töpfen. Den Plan löst
 * dann auf, wer die Pause beendet, und sagt dabei, ob er den Gong selbst gibt
 * (cancelSound({ ersetzt })).
 *
 * `gedrueckt`: Die Berührung war ein Drücken (Maus, Taste) – siehe
 * nachDemKlick().
 */
function nachholen(gedrueckt = false) {
  const wand = Date.now();
  const vorbei = !!wunschPlan && wunschPlan.faellig.every(([, f]) => f <= wand);
  const plan = vorbei ? null : planAufloesen();
  if (plan && plan.neu) {
    try { plan.neu(); } catch { /* der Rückruf gehört der App – ihr Fehler, nicht unserer */ }
  }
  if (wunschTon) {
    const vorher = angestossen;
    nachDemKlick(() => {
      const ton = wunschTon;
      wunschTon = null;
      if (ton && angestossen === vorher && ctx && Date.now() <= ton.bis) {
        verpasst -= 1;
        ohneKontext -= 1;
        jetztSpielen(ton.name, ton.faellig).nachgeholt = true;
      }
      tonMelden();
    }, gedrueckt);
  }
  tonMelden();
}

/**
 * Der Ton, der auf die erste Berührung wartet, ist überholt – auch wenn das,
 * was ihn überholt, selbst stumm bleibt. Er verfällt und bleibt als verpasst
 * gezählt (siehe nachholen()).
 *
 * Für den nächsten Haken und für „Töne" aus. Supersatz, „Ton bei jedem Satz"
 * aus, die Seite mitten in der Pause neu geladen, die Pause lief ohne Tipp ab:
 * Die erste Berührung war der Haken auf A2, und B war ohne Wartezeit dran –
 * kein Tupfer, keine neue Pause, kein Ton, an dem nachholen() den Haken hätte
 * erkennen können. „Pause vorbei" kam direkt danach, mit „Weiter: B". Und wer
 * unter Mehr als Erstes „Töne" ausschaltete, bekam in dem Moment den
 * lautesten Ton der App. Ein zurückgenommener Haken überholt nichts – mit dem
 * nächsten Satz ist, wer korrigiert, noch nicht weiter; die App ruft das dort
 * nicht.
 */
export function tonUeberholt() {
  if (!wunschTon) return;
  wunschTon = null;
  tonMelden();
}

// Womit eine Berührung endet – ab da zählt nachDemKlick() die halbe Sekunde.
const LOSLASSEN = ['pointerup', 'mouseup', 'keyup', 'touchend'];

/**
 * `fn` nach dem Klick der laufenden Berührung aufrufen – nach allen
 * Klick-Handlern der App, die auf Elementen darunter sitzen. Kommt kein Klick
 * (eine Taste ohne Knopf, ein Finger, der vom Knopf rutscht), entscheidet eine
 * halbe Sekunde nach dem Loslassen der Zeitgeber.
 *
 * **Ab dem Loslassen, nicht ab dem Drücken.** Mit Maus und Tastatur ist schon
 * mousedown bzw. keydown die erste Berührung (`gedrueckt`), der Klick kommt
 * beim Loslassen – auch nach langem Druck. Lief die halbe Sekunde ab dem
 * Drücken, bekam, wer die Maustaste oder die Leertaste auf dem nächsten Satz
 * 0,8 s hielt, erst „Pause vorbei" und beim Loslassen den Haken mit Tupfer und
 * neuer Pause. Jetzt stellt jedes Loslassen den Zeitgeber, solange kein Klick
 * kam – auch ein späteres, falls das erste nicht beim Dokument ankam.
 */
function nachDemKlick(fn, gedrueckt = false) {
  let fertig = false;
  let notfall = 0;
  const weg = [];
  function los() {
    if (fertig) return;
    fertig = true;
    clearTimeout(notfall);
    weg.forEach((f) => f());
    fn();
  }
  function stellen() {
    clearTimeout(notfall);
    notfall = setTimeout(los, 500);
  }
  const klick = () => setTimeout(los, 0);
  document.addEventListener('click', klick);
  weg.push(() => document.removeEventListener('click', klick));
  if (gedrueckt) {
    LOSLASSEN.forEach((ev) => {
      document.addEventListener(ev, stellen, true);
      weg.push(() => document.removeEventListener(ev, stellen, true));
    });
  } else {
    stellen();
  }
}

/**
 * Ein vorgemerkter Plan wird aufgelöst – nachgeholt, ersetzt oder verworfen.
 *
 * Was von ihm schon fällig war, kam nie und zählt als verpasst – etwa die
 * Vorwarnung einer Pause, die nach dem Neuladen ohne Tipp ablief. Und zwar ohne
 * Kontext: Vorgemerkt wird ein Plan nur, wenn es keinen gab. `ersetzt`
 * nimmt einen Ton davon aus, für den der Aufrufer gerade selbst sorgt
 * (endRest() gibt das „Pause vorbei" dann als eigenen Ton).
 */
function planAufloesen(ersetzt = null) {
  const plan = wunschPlan;
  wunschPlan = null;
  if (!plan) return null;
  const wand = Date.now();
  const n = plan.faellig.filter(([name, f]) => f <= wand && name !== ersetzt).length;
  verpasst += n;
  ohneKontext += n;
  return plan;
}

/**
 * Ein kurzer Rauschanteil als Anschlag.
 *
 * Zwölf Millisekunden weißes Rauschen vor dem Ton – hörbar ist das nicht als
 * Rauschen, sondern als das Anschlagen selbst. Ohne diesen Anteil setzt jeder
 * Ton weich ein und klingt nach Signalgeber statt nach Instrument.
 */
function knacks(at, dauer, laut) {
  const n = Math.max(1, Math.floor(ctx.sampleRate * dauer));
  const puffer = ctx.createBuffer(1, n, ctx.sampleRate);
  const daten = puffer.getChannelData(0);
  for (let i = 0; i < n; i++) daten[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const quelle = ctx.createBufferSource();
  quelle.buffer = puffer;
  const gain = ctx.createGain();
  gain.gain.value = laut;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 2400;
  quelle.connect(filter).connect(gain).connect(ctx.destination);
  quelle.start(at);
  return quelle;
}

/** Eine Stimme: Oszillator, Hüllkurve, wahlweise Tiefpass und Gleitflug. */
function stimme(t0, s, cent) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = s.form || 'sine';
  // Beides: .value macht die Frequenz sofort ablesbar (auch für den Testlauf),
  // setValueAtTime verankert sie auf der Uhr des Kontexts.
  osc.frequency.value = s.f;
  osc.frequency.setValueAtTime(s.f, t0);
  if (s.bis) osc.frequency.exponentialRampToValueAtTime(s.bis, t0 + s.d);
  if (cent) osc.detune.value = cent;

  // Exponentiell, nicht linear: so klingt der Ton aus, statt abgeschnitten zu
  // werden – ein hartes Ende knackt hörbar.
  const laut = Math.max(0.0002, (s.v ?? 0.22) * (cent ? 0.6 : 1));
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(laut, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + s.d);

  let ende = gain;
  if (s.tief) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = s.tief;
    gain.connect(filter);
    ende = filter;
  }
  ende.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + s.d + 0.05);
  return osc;
}

/**
 * Ein Ton des Signals – als eine oder zwei gegeneinander verstimmte Stimmen.
 *
 * Zwei Stimmen ein paar Cent auseinander schweben gegeneinander. Das ist der
 * Unterschied zwischen "ein Ton" und "ein Klang", und er kostet einen
 * Oszillator.
 */
function ton(at, s) {
  const t0 = at + (s.t || 0);
  const quellen = [stimme(t0, s, 0)];
  if (s.ct) quellen.push(stimme(t0, s, s.ct), stimme(t0, s, -s.ct));
  if (s.knack) quellen.push(knacks(t0, s.knack, (s.v ?? 0.22) * 0.5));
  return quellen;
}

/**
 * Ein ganzer Klang (ein Eintrag aus SOUNDS) auf der Uhr des Kontexts.
 *
 *   name        welcher Ton
 *   at          Startzeit auf der Audio-Uhr
 *   faellig     wann er auf der Wanduhr hätte kommen sollen (Date.now())
 *   quellen     alle Oszillatoren und Rauschquellen, zum Verwerfen
 *   erklungen   hat der Kontext ihn wiedergegeben?
 *   verworfen   wurde er vor seinem Start gestoppt?
 *   nachgeholt  stand er bis zur ersten Berührung auf der Merkliste?
 *
 * Ob er erklungen ist, sagt der Grundton selbst: Sein `ended` kommt, wenn die
 * Uhr über sein Ende gelaufen ist. Wird er per stop() vor seinem Start
 * verworfen, kommt `ended` auch – aber die Uhr steht dann noch vor seiner
 * Startzeit, und genau daran werden die beiden Fälle auseinandergehalten.
 * Wann er auf der Wanduhr begann, steht dann auch fest: Die Audio-Uhr ist seit
 * seinem Beginn so weit gelaufen, wie er dauerte. Liegt das mehr als SPAET_MS
 * hinter `faellig`, kam er verspätet.
 */
function klang(name, at, faellig = Date.now() + (at - ctx.currentTime) * 1000) {
  const s = SOUNDS[name];
  const k = {
    name, at, faellig, quellen: s.flatMap((t) => ton(at, t)),
    erklungen: false, verworfen: false, nachgeholt: false,
  };
  k.quellen[0].addEventListener('ended', () => {
    if (k.erklungen || k.verworfen || !ctx || ctx.currentTime < k.at) return;
    k.erklungen = true;
    gespielt += 1;
    const begann = Date.now() - (ctx.currentTime - k.at) * 1000;
    if (begann - k.faellig > SPAET_MS) {
      verspaetet += 1;
      if (k.nachgeholt) nachgeholt += 1;
    }
    tonMelden();
  });
  return k;
}

function verwerfen(k) {
  k.verworfen = true;
  k.quellen.forEach((q) => { try { q.stop(); } catch { /* schon gestoppt oder nie gestartet */ } });
}

/**
 * Wache für Töne, die jetzt klingen sollen.
 *
 * Steht die Uhr des Kontexts (angehalten, unterbrochen), liegt der Ton auf ihr
 * und käme beim Anlaufen nach – ein Satz-Tupfer eine Minute später oder ein
 * „Pause vorbei" zum nächsten Satz, wie es vor diesem Umbau passierte. Nach
 * gut einer Sekunde wird deshalb nachgesehen: Hat der Ton nicht angefangen,
 * wird er verworfen und als verpasst gezählt. Der Zeitgeber kann im Hintergrund
 * später kommen; das ist egal – er tut nur dann etwas, wenn der Ton bis dahin
 * nicht erklungen ist.
 *
 * `sofort`: Ein Ton für jetzt muss nach der Frist begonnen haben; ein Ton der
 * Probereihe darf noch ausstehen, solange der Kontext läuft.
 */
function bewachen(k, sofort) {
  setTimeout(() => {
    if (!ctx || k.erklungen || k.verworfen) return;
    const spaet = ctx.state !== 'running' || (sofort && ctx.currentTime + 0.001 < k.at);
    if (!spaet) return;
    verwerfen(k);
    verpasst += 1;
    tonMelden();
  }, 1200);
}

/**
 * Unhörbarer Trägerton, solange ein Signal aussteht.
 *
 * Ein Browser, dessen Seite im Hintergrund ist und nichts hörbar tut, darf den
 * AudioContext anhalten und die Seite einfrieren – dann käme das Pausensignal
 * gar nicht oder erst beim Zurückschalten. Läuft dagegen Ton, gilt die Seite
 * als aktiv. 30 Hz bei einem Tausendstel Lautstärke gibt kein Handylautsprecher
 * wieder, im Signalweg ist es aber vorhanden.
 */
function traeger(an) {
  if (an) {
    if (traegerTon || !ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 30;
    gain.gain.value = 0.001;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    traegerTon = osc;
  } else if (traegerTon) {
    try { traegerTon.stop(); } catch { /* schon gestoppt */ }
    traegerTon = null;
  }
}

/** Einen Ton jetzt auf die Uhr legen und bewachen – `ctx` muss da sein. */
function jetztSpielen(name, faellig) {
  wecken();
  const k = klang(name, ctx.currentTime + 0.02, faellig);
  bewachen(k, true);
  return k;
}

/**
 * Ton sofort abspielen.
 *
 * Ohne Kontext – keine Berührung, und der Browser verlangt eine – wird der Ton
 * vorgemerkt und beim Freischalten einmal nachgeholt, wenn seine Frist dann
 * noch läuft; bis dahin zählt er als verpasst. Das ist der Fall „Pause vorbei,
 * aber seit dem Neuladen hat niemand getippt". Vorher entstand hier ein
 * schlafender Kontext, der Ton lag auf dessen stehender Uhr und klingelte beim
 * nächsten Satz nach.
 *
 *   faellig  wann der Ton hätte kommen sollen (Wanduhr) – für „verspätet"
 *   bis      bis wann er nachgeholt werden darf; danach verfällt er
 *
 * Gibt zurück, ob der Ton auf die Uhr gelegt wurde.
 */
export function playSound(name, { faellig = Date.now(), bis = faellig + NACHHOLEN_MS } = {}) {
  if (!SOUNDS[name]) return false;
  angestossen += 1;
  initAudio();
  if (!ctx) {
    if (!tonFrei() && moeglich()) {
      wunschTon = { name, faellig, bis };
      verpasst += 1;
      ohneKontext += 1;
      // Läuft die Frist ab, stimmt „kommt noch nach" unter Mehr nicht mehr.
      setTimeout(tonMelden, Math.max(0, bis - Date.now()) + 50);
      tonMelden();
    }
    return false;
  }
  jetztSpielen(name, faellig);
  tonMelden();
  return true;
}

/**
 * „Töne anhören": alle sechs der Reihe nach, auf der Uhr des Kontexts.
 *
 * Nicht per setTimeout wie früher – auf iOS hätte ein Ton, dessen Zeitgeber
 * später als fünf Sekunden nach dem Tipp feuert, den Kontext nicht mehr
 * wecken dürfen, und ein ausgebremster Zeitgeber verschiebt die Reihe. Auf der
 * Audio-Uhr liegt alles im Moment des Tipps. Eine eigene Liste, damit das
 * Vorausplanen der Pause (cancelSound) sie nicht trifft und sie die Pause
 * nicht. Eine laufende Probe wird durch eine neue ersetzt.
 */
export function probeSpielen() {
  angestossen += 1;
  initAudio();
  if (!ctx) {
    if (!tonFrei() && moeglich()) {
      verpasst += PROBE.length;
      ohneKontext += PROBE.length;
      tonMelden();
    }
    return false;
  }
  wecken();
  probe.forEach((k) => { if (!k.erklungen) verwerfen(k); });
  const ab = ctx.currentTime + 0.05;
  probe = PROBE.map((name, i) => klang(name, ab + i * PROBE_TAKT));
  probe.forEach((k) => bewachen(k, false));
  tonMelden();
  return true;
}

/**
 * Was der Ton-Weg gerade wirklich tut – die ehrliche Auskunft.
 *
 * Dieselbe Sorte Messwert wie „zuletzt geweckt" beim Push: Sie sagt nicht, ob
 * etwas zu hören war (das kann keine Seite wissen), sondern ob die App etwas
 * losgeschickt hat und in welchem Zustand der Tonkanal dabei war.
 *
 *   moeglich    Kennt dieser Browser Web Audio überhaupt?
 *   zustand     'aus'      – noch kein Kontext, es wurde noch nichts angefordert
 *               'laeuft'   – offen, Töne gehen hinaus
 *               'schlaeft' – angelegt, aber vom Browser angehalten oder unterbrochen
 *   gespielt    Wie viele Töne der Kontext diese Sitzung wiedergegeben hat
 *   verspaetet  davon mehr als zwei Sekunden nach ihrer Zeit
 *   nachgeholt  davon wiederum die, die bis zur ersten Berührung warteten
 *   verpasst    Wie viele fällige Töne nie kamen – vorgemerkt und verfallen,
 *               auf einer stehenden Uhr verworfen, beim Aufräumen fällig
 *               gewesen – oder noch auf die erste Berührung warten
 *   gesperrt    davon die, für die es noch keinen Kontext gab (vor der ersten
 *               Berührung nach dem Öffnen); der Rest von `verpasst` lag auf
 *               einem angehaltenen
 *   frei        Hat das Dokument eine aktivierende Berührung gesehen?
 *   klemmt      Berührt, und trotzdem schläft der Kanal seit über anderthalb
 *               Sekunden – das ist kein Browserrecht mehr, sondern ein Zustand,
 *               den man sehen sollte (iOS 'interrupted', ein Browser, der
 *               nicht weckt)
 *   laufend     „Töne anhören" spielt gerade, und der Kanal läuft
 *   offen       Steht noch etwas an, das nach dem Freischalten nachgeholt wird?
 *   wartet      … und was: 'pause' (eine Pause wird neu aufgelegt, ihr Signal
 *               kommt dann pünktlich), der Name eines Tons, der noch innerhalb
 *               seiner Frist nachkäme, oder null
 */
export function tonStand() {
  const zustand = !ctx ? 'aus' : (ctx.state === 'running' ? 'laeuft' : 'schlaeft');
  const klemmt = zustand === 'schlaeft' && beruehrt && Date.now() - beruehrtSeit > 1500;
  const wartet = wunschPlan ? 'pause' : (wunschTon && Date.now() <= wunschTon.bis ? wunschTon.name : null);
  return {
    moeglich: moeglich(), zustand, gespielt, verspaetet, nachgeholt, verpasst, gesperrt: ohneKontext, frei: tonFrei(), klemmt,
    laufend: zustand === 'laeuft' && probe.some((k) => !k.erklungen && !k.verworfen),
    offen: !!wartet, wartet,
  };
}

/**
 * Töne vorausplanen, fest auf die Uhr des AudioContext gelegt.
 *
 * `plan` ist eine Liste [Name, Sekunden ab jetzt]. Mehrere auf einmal, weil zu
 * einer Pause zwei gehören: die Vorwarnung und das Signal selbst. Alles Frühere
 * wird dabei verworfen – es gibt immer nur eine laufende Pause.
 *
 * `spaeter` ist der Rückruf für den Fall, dass kein Kontext da ist (keine
 * Berührung, und der Browser verlangt eine): Er wird nach dem Freischalten
 * einmal aufgerufen und legt die Pause mit frisch gerechneter Restzeit neu auf
 * (armRest in js/app.js). So überdauert eine Pause den Neustart der Seite,
 * ohne dass ein schlafender Kontext entsteht.
 *
 * Klingt derselbe Ton schon – eben begonnen oder gerade erklungen – und fiele
 * der neue in dieselben 0,3 s, ist es dasselbe Signal: Es wird übernommen,
 * nicht ein zweites danebengelegt. Das ist der Fall „zurück in die App, kurz
 * bevor die Pause endet": armRest() legt neu auf, und die Audio-Uhr ist der
 * Wanduhr um ein paar Millisekunden voraus oder hinterher.
 *
 * Gibt zurück, ob die Töne auf der Uhr liegen; sonst muss der Aufrufer am Ende
 * selbst für den Ton sorgen (endRest).
 */
export function scheduleSound(plan, spaeter = null) {
  const behalten = cancelSound();
  if (plan.some(([name, secs]) => SOUNDS[name] && secs >= 0)) angestossen += 1;
  initAudio();
  if (!ctx) {
    if (!tonFrei()) {
      const wand = Date.now();
      wunschPlan = {
        neu: spaeter,
        faellig: plan.filter(([name, secs]) => SOUNDS[name] && secs >= 0).map(([name, secs]) => [name, wand + secs * 1000]),
      };
    }
    tonMelden();
    return false;
  }
  wecken();
  const jetzt = ctx.currentTime;
  plan.forEach(([name, secs]) => {
    if (!SOUNDS[name] || secs < 0) return;
    const at = jetzt + secs;
    const da = behalten.find((k) => k.name === name && Math.abs(k.at - at) <= GLEICH);
    geplant.push(da || klang(name, at));
  });
  if (!geplant.length) return false;
  if (geplant.some((k) => !k.erklungen)) traeger(true);
  tonMelden();
  return true;
}

/**
 * Hat das vorausgelegte Signal gespielt?
 *
 *   'erklungen'  der Kontext hat es wiedergegeben
 *   'laeuft'     es hat begonnen oder beginnt in den nächsten Augenblicken
 *   'offen'      es liegt noch vor uns – oder auf einer stehenden Uhr
 *   'keins'      es liegt gar nichts vor
 *
 * Für endRest(): Bei 'erklungen' und 'laeuft' wäre ein zweiter Ton ein Echo,
 * bei 'offen' käme ohne Ersatz gar keiner – etwa, wenn der Kontext im
 * Hintergrund angehalten war und seine Uhr hinter der Wanduhr zurückliegt.
 */
export function signalStand(name) {
  const k = geplant.find((g) => g.name === name);
  if (!k || !ctx) return 'keins';
  if (k.erklungen) return 'erklungen';
  if (ctx.state === 'running' && k.at <= ctx.currentTime + GLEICH) return 'laeuft';
  return 'offen';
}

/**
 * Vorausgelegte Signale verwerfen – Pause übersprungen, verlängert, aus, neu
 * aufgelegt, zu Ende.
 *
 * Was schon begonnen hat, bleibt: Es würde sonst mitten im Klang
 * abgeschnitten. Alles andere geht – auch ein Signal, das in 0,2 s dran wäre:
 * Wer „+30 s" oder „Pause weg" tippt, will genau dieses Signal nicht mehr.
 *
 *   ausklingen  Nur für endRest() am echten Pausenende: Was in den nächsten
 *               0,3 s anfängt, ist das Signal dieses Endes und darf kommen
 *               (siehe GLEICH) – endRest() hat signalStand() eben gefragt und
 *               keinen Ersatz gegeben.
 *   ersetzt     Für diesen Ton sorgt der Aufrufer gerade selbst (endRest()
 *               mit Ersatzton): Ein fälliger, nie gespielter wird dann still
 *               verworfen, statt als verpasst zu zählen – der Ersatz zählt.
 *
 * Jeder andere Ton, der schon fällig war und nie kam, zählt als verpasst: Ohne
 * das verschwand ein Pausensignal, das auf einer angehaltenen Uhr lag, aus der
 * Zählung, als hätte es nie existiert. Ein vorgemerkter Wunsch, die Pause nach
 * dem Freischalten neu aufzulegen, ist damit ebenfalls erledigt – mit
 * derselben Zählung.
 *
 * Gibt zurück, was stehen blieb (begonnen oder erklungen) – scheduleSound()
 * übernimmt daraus, was es sonst ein zweites Mal legen würde.
 */
export function cancelSound({ ausklingen = false, ersetzt = null } = {}) {
  const vorher = verpasst;
  // Ein aufgelöster Wunsch ändert, was unter Mehr steht („das Pausensignal
  // kommt pünktlich"), auch wenn dabei nichts verpasst wurde.
  const wunsch = !!wunschPlan;
  planAufloesen(ersetzt);
  const laeuft = !!ctx && ctx.state === 'running';
  const jetzt = ctx ? ctx.currentTime : 0;
  const frist = ausklingen ? GLEICH : 0;
  const wand = Date.now();
  const behalten = [];
  geplant.forEach((k) => {
    if (k.erklungen || (laeuft && k.at <= jetzt + frist)) {
      behalten.push(k);
      return;
    }
    verwerfen(k);
    if (k.name !== ersetzt && k.faellig <= wand) verpasst += 1;
  });
  geplant = [];
  traeger(false);
  if (verpasst !== vorher || wunsch) tonMelden();
  return behalten;
}

// Zurück aus dem Hintergrund: iOS legt den Kontext beim Wegschalten schlafen
// oder unterbricht ihn, und so bleibt er, bis ihn jemand weckt.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) wecken();
});
