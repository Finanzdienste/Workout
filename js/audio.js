/*
 * Töne der App.
 *
 * Alles wird per Web Audio erzeugt, nichts geladen: keine zusätzliche Datei,
 * kein Netz, kein Zwischenspeicher, der veralten könnte. Ein Ton ist eine
 * Folge von Sinus-Tönen [Frequenz, Versatz in s, Dauer in s, Lautstärke].
 *
 * Zwei Dinge sind hier wichtiger, als sie aussehen:
 *
 *   Freischalten.  Mobile Browser lassen Ton nur zu, wenn der AudioContext auf
 *                  eine Berührung zurückgeht. Deshalb entsteht er beim ersten
 *                  Tippen (Training starten, Satz abhaken) und nicht beim Laden.
 *
 *   Vorausplanen.  Das Pausensignal wird nicht per setTimeout ausgelöst,
 *                  sondern beim Start der Pause fest auf die Uhr des
 *                  AudioContext gelegt. Diese Uhr läuft weiter, wenn die Seite
 *                  in den Hintergrund gerät – Zeitgeber der Seite werden dort
 *                  ausgebremst oder ganz eingefroren. Damit der Browser den
 *                  Kontext dabei nicht schlafen legt, läuft bis zum Signal ein
 *                  unhörbarer Trägerton mit (siehe traeger()).
 */

const SOUNDS = {
  // Training beginnt – aufsteigender Dreiklang.
  start: [[523.25, 0, 0.14], [659.25, 0.11, 0.14], [783.99, 0.22, 0.34]],
  // Satz abgehakt – kurzer, leiser Tupfer. Kommt 20-mal pro Training vor.
  set: [[1244.51, 0, 0.07, 0.12]],
  // Übung fertig, nächste kommt.
  exercise: [[659.25, 0, 0.1], [987.77, 0.1, 0.24]],
  // Fertig machen – fünf Sekunden vor Schluss. Zwei kurze, tiefere Tupfer:
  // erkennbar anders als das Signal selbst, sonst steht man zu früh auf.
  ready: [[587.33, 0, 0.09, 0.18], [587.33, 0.16, 0.09, 0.18]],
  // Pause vorbei – das lauteste Signal, es muss quer durch den Raum kommen.
  rest: [[880, 0, 0.24, 0.35], [1320, 0.28, 0.26, 0.35]],
  // Workout komplett.
  done: [[523.25, 0, 0.14], [659.25, 0.13, 0.14], [783.99, 0.26, 0.14], [1046.5, 0.39, 0.55]],
  // Training beendet oder abgebrochen – absteigend, ohne Feierlichkeit.
  stop: [[587.33, 0, 0.16], [440, 0.14, 0.34]],
  // Gewicht erhöht.
  bump: [[783.99, 0, 0.09], [1174.66, 0.09, 0.22]],
};

let ctx = null;
let geplant = [];     // vorausgelegte Signale: [{ quellen, at }]
let traegerTon = null;

/** AudioContext anlegen – nur aus einer Berührung heraus aufrufen. */
export function initAudio() {
  if (ctx) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  try { ctx = new Ctx(); } catch { ctx = null; }
}

function wecken() {
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
}

function ton(at, [f, versatz, dauer, laut = 0.22]) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const t0 = at + versatz;
  osc.type = 'sine';
  osc.frequency.value = f;
  // Exponentiell, nicht linear: so klingt der Ton aus, statt abgeschnitten zu
  // werden – ein hartes Ende knackt hörbar.
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(laut, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dauer);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dauer + 0.02);
  return osc;
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

/** Ton sofort abspielen. Ohne freigeschalteten Kontext passiert nichts. */
export function playSound(name) {
  if (!ctx || !SOUNDS[name]) return;
  wecken();
  SOUNDS[name].forEach((t) => ton(ctx.currentTime + 0.02, t));
}

/**
 * Töne vorausplanen, fest auf die Uhr des AudioContext gelegt.
 *
 * `plan` ist eine Liste [Name, Sekunden ab jetzt]. Mehrere auf einmal, weil zu
 * einer Pause zwei gehören: die Vorwarnung und das Signal selbst. Alles Frühere
 * wird dabei verworfen – es gibt immer nur eine laufende Pause.
 *
 * Gibt zurück, ob es geklappt hat; sonst muss der Aufrufer sich anders helfen.
 */
export function scheduleSound(plan) {
  initAudio();
  if (!ctx) return false;
  wecken();
  cancelSound();
  plan.forEach(([name, secs]) => {
    if (!SOUNDS[name] || secs < 0) return;
    const at = ctx.currentTime + secs;
    geplant.push({ at, quellen: SOUNDS[name].map((t) => ton(at, t)) });
  });
  if (!geplant.length) return false;
  traeger(true);
  return true;
}

/**
 * Vorausgelegte Signale verwerfen – Pause übersprungen, verlängert, aus.
 *
 * Was gerade spielt, bleibt: Ein Ton, der schon begonnen hat, würde sonst
 * mitten im Klang abgeschnitten – und genau das passiert am Ende der Pause,
 * wo endRest() eine Viertelsekunde nach dem Signal aufräumt.
 */
export function cancelSound() {
  const jetzt = ctx ? ctx.currentTime : 0;
  geplant.forEach((g) => {
    if (g.at <= jetzt) return;
    g.quellen.forEach((osc) => { try { osc.stop(); } catch { /* egal */ } });
  });
  geplant = [];
  traeger(false);
}

// Zurück aus dem Hintergrund: iOS legt den Kontext beim Wegschalten schlafen,
// und ein schlafender Kontext bleibt es, bis ihn jemand weckt.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) wecken();
});
