/*
 * Töne der App.
 *
 * Alles wird per Web Audio erzeugt, nichts geladen: keine zusätzliche Datei,
 * kein Netz, kein Zwischenspeicher, der veralten könnte. Ein Ton ist eine
 * Folge von Sinus-Tönen [Frequenz, Versatz in s, Dauer in s, Lautstärke].
 *
 * Drei Dinge sind hier wichtiger, als sie aussehen:
 *
 *   Freischalten.  Mobile Browser lassen Ton nur zu, wenn der AudioContext auf
 *                  eine Berührung zurückgeht. Deshalb entsteht er in der ERSTEN
 *                  aktivierenden Berührung der Seite – pointerup, touchend,
 *                  mousedown, keydown, einmal auf dem Dokument abgehört (siehe
 *                  beruehrung()) – und nie ohne eine. Was die App davor schon
 *                  wollte (eine Pause, die den Neustart überdauert hat; ein
 *                  Pausenende, bei dem niemand getippt hat), merkt sie sich und
 *                  holt es nach, sobald der Kanal frei ist.
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
 *                  wirklich wiedergegeben hat (`ended` nach der Startzeit), und
 *                  getrennt davon, was verloren ging, weil der Kanal nicht frei
 *                  war. tonStand() liefert beides, Mehr → Töne zeigt es.
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
 */
const GLEICH = 0.3;

let ctx = null;
let geplant = [];      // vorausgelegte Pausensignale (siehe klang())
let probe = [];        // „Töne anhören" – eigene Liste, cancelSound() lässt sie in Ruhe
let traegerTon = null;

// Wie viele Töne der Kontext in dieser Sitzung wirklich wiedergegeben hat, und
// wie viele verloren gingen, weil er dafür nicht frei war. Nicht Kosmetik:
// „Ich höre nichts" hat zwei ganz verschiedene Ursachen – die App erzeugt
// keinen Ton, oder sie erzeugt ihn und das Gerät gibt ihn nicht aus. Von außen
// sehen beide gleich aus, und ohne diese Zahlen lässt sich das nicht trennen.
let gespielt = 0;
let verpasst = 0;

// Die erste aktivierende Berührung: Hat der Lauscher sie gesehen, und wann?
// Beide braucht tonStand(): Ein Kanal, der eine Sekunde nach dieser Berührung
// immer noch schläft, ist ein Problem – einer, der noch nie berührt wurde, nur
// die Regel des Browsers.
let beruehrt = false;
let beruehrtSeit = 0;

// Was vor dem Freischalten gewünscht wurde und nachgeholt wird, sobald der
// Kanal frei ist: einmal die Pause neu auflegen (ein Rückruf, der die Restzeit
// frisch rechnet), und ein Ton, der sofort hätte kommen sollen – praktisch
// immer „Pause vorbei" aus einem Pausenende, bei dem niemand getippt hat.
let wunschPlan = null;
let wunschTon = null;

// Wer erfahren will, wenn sich an tonStand() etwas ändert – die Zeile unter
// Mehr → Töne, die stille Zeile im Dashboard.
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
 * iOS: Die Tonsitzung als Wiedergabe antonMelden, nicht als Beiwerk.
 *
 * WebKit legt Web Audio sonst in die Sitzung „ambient", und die verstummt mit
 * dem Stummschalter des iPhones – ein Pausensignal, das dem Schalter folgt,
 * wäre wenig wert. `navigator.audioSession.type = 'playback'` meldet die Töne
 * als Wiedergabe an (Audio Session API: W3C-Entwurf, MDN, in Safari ab 16.4;
 * nicht am Gerät gemessen, aus den Quellen übernommen). Der Preis: Während ein
 * Ton spielt, kann Musik aus einer anderen App kurz leiser werden oder
 * pausieren – das ist der Tausch, und er ist bewusst so herum gemacht. Wo es
 * die API nicht gibt, passiert nichts.
 */
function tonSitzung() {
  try {
    const s = navigator.audioSession;
    if (s && 'type' in s && s.type !== 'playback') s.type = 'playback';
  } catch { /* nicht vorhanden oder nicht erlaubt – dann eben nicht */ }
}

/**
 * AudioContext anlegen – nur aus einer Berührung heraus.
 *
 * Ohne Berührung legt diese Funktion nichts an. Vorher tat sie es doch, und
 * das Ergebnis war ein Kontext im Zustand 'suspended' mit einem resume(), das
 * nie antwortet: Töne, die darauf gelegt wurden, lagen auf einer stehenden
 * Uhr und klingelten beim nächsten Tipp alle auf einmal nach – *„Jetzt fehlt
 * iwie die Pause"*, und beim nächsten Satz ein Gong zur Unzeit. Wer ohne
 * Berührung einen Ton will, bekommt ihn vorgemerkt (playSound, scheduleSound).
 */
export function initAudio() {
  if (ctx || !tonFrei()) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  tonSitzung();
  try { ctx = new Ctx(); } catch { ctx = null; return; }
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
function beruehrung() {
  const u = navigator.userActivation;
  if (u && !u.hasBeenActive) return;
  const erste = !beruehrt;
  if (erste) { beruehrt = true; beruehrtSeit = Date.now(); }
  initAudio();
  wecken();
  if (erste) {
    nachholen();
    // Schläft der Kanal trotz Berührung weiter, soll das jemand erfahren –
    // aber erst, wenn resume() seine Chance hatte (siehe tonStand().klemmt).
    setTimeout(tonMelden, 1600);
  }
  tonMelden();
}
for (const ev of ['pointerup', 'touchend', 'mousedown', 'keydown']) {
  document.addEventListener(ev, beruehrung, { capture: true, passive: true });
}

/** Nach dem Freischalten: erst die Pause neu auflegen, dann den Ton, der fehlte. */
function nachholen() {
  const plan = wunschPlan;
  const ton = wunschTon;
  wunschPlan = null;
  wunschTon = null;
  if (plan) {
    try { plan(); } catch { /* der Rückruf gehört der App – ihr Fehler, nicht unserer */ }
  }
  if (ton) playSound(ton);
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
 *   name       welcher Ton
 *   at         Startzeit auf der Audio-Uhr
 *   quellen    alle Oszillatoren und Rauschquellen, zum Verwerfen
 *   erklungen  hat der Kontext ihn wiedergegeben?
 *   verworfen  wurde er vor seinem Start gestoppt?
 *
 * Ob er erklungen ist, sagt der Grundton selbst: Sein `ended` kommt, wenn die
 * Uhr über sein Ende gelaufen ist. Wird er per stop() vor seinem Start
 * verworfen, kommt `ended` auch – aber die Uhr steht dann noch vor seiner
 * Startzeit, und genau daran werden die beiden Fälle auseinandergehalten.
 */
function klang(name, at) {
  const s = SOUNDS[name];
  const k = { name, at, quellen: s.flatMap((t) => ton(at, t)), erklungen: false, verworfen: false };
  k.quellen[0].addEventListener('ended', () => {
    if (k.erklungen || k.verworfen || !ctx || ctx.currentTime < k.at) return;
    k.erklungen = true;
    gespielt += 1;
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

/**
 * Ton sofort abspielen.
 *
 * Ohne Berührung gibt es keinen Kontext – dann wird der Ton vorgemerkt und
 * beim Freischalten einmal nachgeholt, und er zählt als verpasst: Das ist der
 * Fall „Pause vorbei, aber seit dem Neuladen hat niemand getippt". Vorher
 * entstand hier ein schlafender Kontext, der Ton lag auf dessen stehender Uhr
 * und klingelte beim nächsten Satz nach.
 *
 * Gibt zurück, ob der Ton auf die Uhr gelegt wurde.
 */
export function playSound(name) {
  if (!SOUNDS[name]) return false;
  if (!tonFrei()) {
    wunschTon = name;
    verpasst += 1;
    tonMelden();
    return false;
  }
  initAudio();
  if (!ctx) return false;
  wecken();
  bewachen(klang(name, ctx.currentTime + 0.02), true);
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
  if (!tonFrei()) {
    verpasst += PROBE.length;
    tonMelden();
    return false;
  }
  initAudio();
  if (!ctx) return false;
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
 *   moeglich  Kennt dieser Browser Web Audio überhaupt?
 *   zustand   'aus'      – noch kein Kontext, es wurde noch nichts angefordert
 *             'laeuft'   – offen, Töne gehen hinaus
 *             'schlaeft' – angelegt, aber vom Browser angehalten oder unterbrochen
 *   gespielt  Wie viele Töne der Kontext diese Sitzung wiedergegeben hat
 *   verpasst  Wie viele Töne verloren gingen, weil der Kanal nicht frei war
 *   frei      Hat das Dokument eine aktivierende Berührung gesehen?
 *   klemmt    Berührt, und trotzdem schläft der Kanal seit über einer Sekunde –
 *             das ist kein Browserrecht mehr, sondern ein Zustand, den man
 *             sehen sollte (iOS 'interrupted', ein Browser, der nicht weckt)
 *   offen     Steht noch etwas an, das nach dem Freischalten nachgeholt wird?
 */
export function tonStand() {
  const moeglich = !!(window.AudioContext || window.webkitAudioContext);
  const zustand = !ctx ? 'aus' : (ctx.state === 'running' ? 'laeuft' : 'schlaeft');
  const klemmt = zustand === 'schlaeft' && beruehrt && Date.now() - beruehrtSeit > 1500;
  return {
    moeglich, zustand, gespielt, verpasst, frei: tonFrei(), klemmt,
    offen: !!(wunschPlan || wunschTon),
  };
}

/**
 * Töne vorausplanen, fest auf die Uhr des AudioContext gelegt.
 *
 * `plan` ist eine Liste [Name, Sekunden ab jetzt]. Mehrere auf einmal, weil zu
 * einer Pause zwei gehören: die Vorwarnung und das Signal selbst. Alles Frühere
 * wird dabei verworfen – es gibt immer nur eine laufende Pause.
 *
 * `spaeter` ist der Rückruf für den Fall, dass noch keine Berührung da war:
 * Er wird nach dem Freischalten einmal aufgerufen und legt die Pause mit frisch
 * gerechneter Restzeit neu auf (armRest in js/app.js). So überdauert eine
 * Pause den Neustart der Seite, ohne dass ein Kontext ohne Geste entsteht.
 *
 * Gibt zurück, ob die Töne auf der Uhr liegen; sonst muss der Aufrufer am Ende
 * selbst für den Ton sorgen (endRest).
 */
export function scheduleSound(plan, spaeter = null) {
  cancelSound();
  if (!tonFrei()) {
    wunschPlan = spaeter;
    tonMelden();
    return false;
  }
  initAudio();
  if (!ctx) return false;
  wecken();
  plan.forEach(([name, secs]) => {
    if (!SOUNDS[name] || secs < 0) return;
    geplant.push(klang(name, ctx.currentTime + secs));
  });
  if (!geplant.length) return false;
  traeger(true);
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
 * Vorausgelegte Signale verwerfen – Pause übersprungen, verlängert, aus.
 *
 * Was gerade spielt oder in den nächsten Augenblicken anfängt, bleibt: Ein
 * Ton, der schon begonnen hat, würde sonst mitten im Klang abgeschnitten, und
 * einer, der in 20 ms fällig ist, fiele ganz aus – genau das passiert am Ende
 * der Pause, wo endRest() kurz nach dem Signal aufräumt. Ein vorgemerkter
 * Wunsch, die Pause nach dem Freischalten neu aufzulegen, ist damit ebenfalls
 * erledigt.
 */
export function cancelSound() {
  wunschPlan = null;
  const laeuft = !!ctx && ctx.state === 'running';
  const jetzt = ctx ? ctx.currentTime : 0;
  geplant.forEach((k) => {
    if (k.erklungen || (laeuft && k.at <= jetzt + GLEICH)) return;
    verwerfen(k);
  });
  geplant = [];
  traeger(false);
}

// Zurück aus dem Hintergrund: iOS legt den Kontext beim Wegschalten schlafen
// oder unterbricht ihn, und so bleibt er, bis ihn jemand weckt.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) wecken();
});
