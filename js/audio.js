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
    geplant.push({ at, quellen: SOUNDS[name].flatMap((t) => ton(at, t)) });
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
