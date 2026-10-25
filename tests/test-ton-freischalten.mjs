/*
 * Der Ton wird mit der ersten Berührung frei – und nie ohne eine, außer dort,
 * wo der Browser keine verlangt.
 *
 *     „Irgendwie gibt's überhaupt keine soundeffekte mehr in der app"
 *     „Jetzt fehlt iwie die Pause" – „Und es gibt iwie überhaupt keine sounds"
 *
 * Gemessen wird hier das, was die Autoplay-Sperre des Handys mit der App macht,
 * und zwar mit der Sperre: Chromium läuft ohne --autoplay-policy-Flagge, also
 * mit document-user-activation-required – genau wie Chrome auf dem Handy im Tab.
 * Touch-Kontext, Android-Chrome-UA. (Ein iPhone-UA ergibt in Chromium dasselbe
 * Protokoll; WebKit-Regeln kann dieser Lauf nicht prüfen.) Nur Szene H läuft
 * zusätzlich ohne Sperre – so, wie Chrome eine installierte App behandelt.
 *
 * **Gestenfrei messen, sonst misst man nichts.** Playwright schickt jedes
 * page.evaluate() und jede Locator-Hilfe (count, boundingBox, die Vorprüfung
 * von tap/click) als Runtime.callFunctionOn mit userGesture: true, und Chromium
 * aktiviert damit das Dokument dauerhaft – ein AudioContext startet danach
 * running, ohne dass je ein Finger das Display berührt hat. Deshalb läuft hier
 * alles über eine rohe CDP-Sitzung: Runtime.evaluate ohne userGesture zum
 * Ablesen, Input.dispatchTouchEvent als Finger, und die erste Prüfung jeder
 * Szene ist, dass das Dokument noch NICHT aktiviert ist. Sie wird rot, sobald
 * jemand ein page.evaluate() davorsetzt.
 *
 * Fünf Szenen des Umbaus, jede mit Gegenprobe gegen den Stand vor v241
 * (4e1669e):
 *
 *   A  Frischer Start: Die erste Berührung – auch eine, die keinen Ton auslöst
 *      (der Reiter „Mehr") – legt den Kontext an, und er läuft sofort. Die
 *      Tonsitzung ist mischbar ('ambient', nie 'playback').
 *   B  Gespeicherte Pause beim Start: Kein Kontext ohne Geste, auch nicht nach
 *      „weggeschaltet und zurück"; die erste Berührung (die Figur) legt das
 *      Signal nach, es spielt genau einmal – und endRest() verwirft es nicht
 *      mehr vor seinem Start.
 *   C  Pausenende ohne Tipp: kein Kontext, kein „not allowed to start", der
 *      Ton gilt als verpasst – und kommt mit der ersten Berührung (der Figur)
 *      einmal nach, als verspätet gezählt.
 *   D  „Töne anhören" als erste Berührung: sechs Töne, sofort auf der Audio-Uhr;
 *      solange sie laufen, steht das da, danach das Urteil zuerst.
 *   E  Attrappe eines unterbrochenen Kontexts ('interrupted'): Die Berührung
 *      weckt ihn, und das Dashboard sagt still, dass er klemmt.
 *
 * Und fünf aus der Nachprüfung, jede rot gegen den ersten Stand von v241
 * (f43f137) und grün danach:
 *
 *   F  Frist: Ein vorgemerktes „Pause vorbei" kommt nicht 70 s nach dem Ende
 *      – es verfällt und bleibt verpasst (F1).
 *   G  Ausklingen nur am echten Ende: Zurück in die App 0,15 s vor dem Signal
 *      gibt EINEN Gong, „+30 s" und „Pause weg" 0,15 s davor gar keinen.
 *   H  Installierte App ohne Sperre: Pausenende nach dem Neuladen klingt ohne
 *      Berührung (der Kontext wird gemessen, nicht angenommen); mit Sperre wird
 *      der Mess-Kontext geschlossen und nie benutzt.
 *   I  Ein fälliges Signal, das nie kam, wird gezählt – ohne Ersatz als
 *      verpasst, mit Ersatz als verspätet.
 *   (Die Tonsitzung, Mangel fünf, prüft A.)
 *
 * Und aus der zweiten Nachprüfung, rot gegen d412e37 und grün danach:
 *
 *   F2 Die erste Berührung ist der nächste Haken, 30 s nach dem Pausenende –
 *      mitten in der Frist: „Pause vorbei" kommt NICHT zusammen mit dessen
 *      Tupfer und dem Start der neuen Pause.
 *   J  Mehr → Töne und Hinweise vor der ersten Berührung, die App mitten in
 *      der Pause neu geladen: Dort steht nicht „Noch kein Ton angefordert",
 *      sondern woran es liegt, wie viele Töne deshalb fehlten und was ein Tipp
 *      noch bringt – auch dann noch richtig, wenn die Frist verstreicht. Und
 *      ein Ton, der nur auf den ersten Tipp wartete, heißt nie „angehalten"
 *      (dazu F1; den echten angehaltenen Fall prüft I1).
 */
import { chromium } from 'playwright';
import { URL, SHOT } from './umgebung.mjs';

const browser = await chromium.launch();   // KEINE Autoplay-Flagge – Standard-Policy
// Ohne Sperre, wie Chrome eine zum Startbildschirm hinzugefügte App behandelt
// (Szene H). Dass die Seite installiert läuft, sagt ihr die Sonde.
const ohneSperre = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const bis = (t) => warte(Math.max(0, t - Date.now()));
console.log(`# Chromium ${browser.version()}, Standard-Autoplay-Policy, Touch`);

const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const heute = new Date().toISOString().slice(0, 10);
const GRUND = { greeted: true, name: 'T', level: 'geuebt', shift: 0, log: {}, tab: 'dashboard', sound: true, soundSets: true };
const LAUFEND = {
  ...GRUND, session: { n: 1 }, fokusOffen: { n: 1, id: null },
  clock: { n: 1, on: heute, spent: 0, since: Date.now(), gebucht: 0 },
};
const pause = (endsAt) => ({ ...LAUFEND, rest: { endsAt, total: 90, next: 'Satz 2 von 3 · Test', ex: null } });

/*
 * Die Sonde: AudioContext und seine Quellen beobachten – vor dem Laden der
 * Seite, per addInitScript. Mitgeschrieben werden Anlegen (Zustand, Aktivierung,
 * Aufrufkette), Zustandswechsel, resume(), close(), jeder start(), jedes ended
 * und jeder stop() vor dem eigenen Start, mit der Audio-Uhr.
 *
 *   attrappe     Der Kontext meldet 'interrupted' und lässt sich nicht wecken –
 *                so, wie iOS ihn nach einem Anruf hinterlässt.
 *   installiert  matchMedia('(display-mode: standalone)') sagt ja – die Seite
 *                läuft wie vom Startbildschirm. (Chromium emuliert display-mode
 *                über CDP nicht; gemessen: setEmulatedMedia nimmt es an und
 *                ändert nichts.)
 *
 * Dazu: Date.now() verschiebbar (window.__dateOffset – eine Seite, die eine
 * Minute eingefroren war), die Tonsitzung als Attrappe (navigator.audioSession
 * gibt es in Chromium nicht; jede Zuweisung landet in __sitzung), die Zeit
 * jedes Klicks, die Sichtbarkeit steuerbar.
 */
const SONDE = ({ attrappe, installiert }) => {
  const akt = () => (navigator.userActivation
    ? `${navigator.userActivation.isActive ? 'aktiv' : '-'}/${navigator.userActivation.hasBeenActive ? 'sticky' : '-'}`
    : '?');
  window.__ac = { log: [], ctxs: 0, resumes: 0 };
  window.__dateOffset = 0;
  const D = Date.now;
  Date.now = () => D() + window.__dateOffset;
  const Orig = window.AudioContext;
  window.AudioContext = class extends Orig {
    constructor(...a) {
      super(...a);
      window.__ac.ctxs += 1;
      window.__ctx = this;
      const stack = (new Error().stack || '').split('\n').slice(2, 8)
        .map((s) => s.trim().replace(/^at /, '').replace(/https?:\/\/[^/]+\//, '')).join(' <- ');
      window.__ac.log.push({ ev: 'neu', state: this.state, akt: akt(), stack });
      this.addEventListener('statechange', () => window.__ac.log.push({ ev: 'statechange', state: this.state }));
    }
    get state() { return attrappe ? 'interrupted' : super.state; }
    // Ein unterbrochener Kontext hat eine stehende Uhr – sonst wäre die
    // Attrappe nur halb: Die App liest an der Uhr ab, ob ein Ton erklungen ist.
    get currentTime() { return attrappe ? 0 : super.currentTime; }
    resume() {
      window.__ac.resumes += 1;
      window.__ac.log.push({ ev: 'resume', state: this.state, akt: akt() });
      return attrappe ? new Promise(() => {}) : super.resume();
    }
    close() {
      window.__ac.log.push({ ev: 'close', state: this.state });
      return super.close();
    }
  };
  const S = window.AudioScheduledSourceNode.prototype.start;
  window.AudioScheduledSourceNode.prototype.start = function (...a) {
    this.__at = a[0] !== undefined ? a[0] : this.context.currentTime;
    const f = this.frequency ? Math.round(this.frequency.value) : 0;
    window.__ac.log.push({
      ev: 'start', f, in: +(this.__at - this.context.currentTime).toFixed(2), uhr: +this.context.currentTime.toFixed(2),
      at: +this.__at.toFixed(2), state: this.context.state,
    });
    // Zu Ende gespielt heißt: `ended` mit einer Uhr hinter der Startzeit. Ein
    // vor dem Start verworfener Ton meldet `ended` auch, aber davor.
    if (f) this.addEventListener('ended', () => window.__ac.log.push({ ev: 'ended', f, uhr: +this.context.currentTime.toFixed(3), at: +this.__at.toFixed(3) }));
    return S.apply(this, a);
  };
  const T = window.AudioScheduledSourceNode.prototype.stop;
  window.AudioScheduledSourceNode.prototype.stop = function (...a) {
    // Ein stop() ohne Zeitpunkt vor dem eigenen Start: der Ton wird verworfen,
    // bevor er je geklungen hat.
    if (a[0] === undefined && this.__at !== undefined && this.context.currentTime < this.__at - 0.001) {
      window.__ac.log.push({ ev: 'vorzeitig', f: this.frequency ? Math.round(this.frequency.value) : 0, uhr: +this.context.currentTime.toFixed(2), at: +this.__at.toFixed(2) });
    }
    return T.apply(this, a);
  };
  navigator.vibrate = (p) => { window.__vibrate = p; return true; };
  // Sichtbarkeit steuerbar machen – der Weg „weggeschaltet und zurück".
  window.__hidden = false;
  Object.defineProperty(document, 'hidden', { get: () => window.__hidden, configurable: true });
  Object.defineProperty(document, 'visibilityState', {
    get: () => (window.__hidden ? 'hidden' : 'visible'), configurable: true,
  });
  // Die Tonsitzung (Audio Session API) – in Chromium nicht vorhanden.
  window.__sitzung = [];
  let typ = 'auto';
  Object.defineProperty(navigator, 'audioSession', {
    configurable: true,
    value: { get type() { return typ; }, set type(v) { typ = v; window.__sitzung.push(v); } },
  });
  window.__klicks = [];
  document.addEventListener('click', () => window.__klicks.push(Date.now()), true);
  if (installiert) {
    const mm = window.matchMedia.bind(window);
    window.matchMedia = (q) => (/display-mode:\s*standalone/.test(q)
      ? { matches: true, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } }
      : mm(q));
  }
};

/** Rohes CDP, ohne userGesture – das ist der ganze Trick. */
async function rein(cdp, expression) {
  const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || exceptionDetails.text);
  return result.value;
}

async function seite(zustand, { attrappe = false, installiert = false, br = browser } = {}) {
  const ctx = await br.newContext({ hasTouch: true, isMobile: true, viewport: { width: 414, height: 896 }, userAgent: UA });
  // Nichts nach draußen – die Sicherung spricht sonst mit dem Server.
  await ctx.route((u) => !u.href.startsWith('http://127.0.0.1'), (r) => r.fulfill({ status: 204, body: '' }));
  await ctx.addInitScript(SONDE, { attrappe, installiert });
  await ctx.addInitScript((z) => {
    if (!sessionStorage.getItem('gesaet')) {
      localStorage.clear();
      localStorage.setItem('workout.state.v1', JSON.stringify(z));
      sessionStorage.setItem('gesaet', '1');
    }
  }, zustand);
  const page = await ctx.newPage();
  const errs = [];
  const konsole = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') konsole.push(m.text()); });
  const cdp = await ctx.newCDPSession(page);
  await page.goto(URL, { waitUntil: 'networkidle' });
  await warte(300);
  /** Mitte eines Elements, vorher in die Sicht gescrollt – alles ohne Geste. */
  const mitte = async (sel) => {
    const p = await rein(cdp, `(() => {
      const el = document.querySelector(${JSON.stringify(sel)});
      if (!el) return null;
      el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    if (!p) throw new Error('kein Element: ' + sel);
    await warte(60);
    return p;
  };
  /** Ein Finger: touchStart, touchEnd – Chromium aktiviert beim Loslassen. */
  const finger = async (p) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y }] });
    await warte(40);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  const tippe = async (sel) => { await finger(await mitte(sel)); await warte(350); };
  /** Stand ablesen: tonStand() aus derselben Modulinstanz wie die App, dazu die Sonde. */
  const stand = async () => {
    const r = await rein(cdp, `(async () => {
      const a = await import('./js/audio.js');
      const ua = navigator.userActivation;
      return {
        ...a.tonStand(), ctxs: window.__ac.ctxs, resumes: window.__ac.resumes, log: window.__ac.log.splice(0),
        ctxState: window.__ctx ? window.__ctx.state : null,
        akt: ua ? (ua.isActive ? 'aktiv' : '-') + '/' + (ua.hasBeenActive ? 'sticky' : '-') : '?',
        pause: !(document.getElementById('restBar') || {}).hidden,
        restTime: (document.getElementById('restTime') || {}).textContent || '',
        zeile: ((document.getElementById('tonStand') || {}).textContent || '').replace(/\\s+/g, ' ').trim(),
        hinweis: ((document.getElementById('tonHinweis') || {}).textContent || '').replace(/\\s+/g, ' ').trim(),
        toast: (document.getElementById('toast') || {}).textContent || '',
        vibriert: Array.isArray(window.__vibrate),
        sitzung: window.__sitzung.slice(), sitzungJetzt: navigator.audioSession.type,
        klicks: window.__klicks.splice(0),
      };
    })()`);
    return r;
  };
  const text = (sel) => rein(cdp, `((document.querySelector(${JSON.stringify(sel)}) || {}).textContent || '').replace(/\\s+/g, ' ').trim()`);
  /** Sichtbarkeit umschalten; gibt die Seitenzeit des Umschaltens zurück. */
  const sicht = (hidden) => rein(cdp, `(() => { window.__hidden = ${hidden}; const t = Date.now(); document.dispatchEvent(new Event('visibilitychange')); return t; })()`);
  return { ctx, page, cdp, errs, konsole, tippe, mitte, finger, stand, text, sicht };
}

/**
 * Wie viele Quellen einer Frequenz gestartet wurden – 880 Hz ist der Grundton
 * von „Pause vorbei", dreistimmig: 3 heißt einmal, 6 hieße zweimal. `sofort`
 * zählt nur, was für jetzt gestartet wurde, nicht das für die nächste Pause
 * vorausgelegte Signal (dasselbe Signal, nur Sekunden später auf der Uhr).
 */
const starts = (log, f, sofort = false) => log.filter((l) => l.ev === 'start' && l.f === f && (!sofort || l.in < 0.5)).length;
/** Wie viele Stimmen einer Frequenz zu Ende gespielt wurden – 3 bei 880 Hz heißt: ein Gong. */
const zuEnde = (log, f) => log.filter((l) => l.ev === 'ended' && l.f === f && l.uhr >= l.at).length;
const gruppen = (log) => {
  const zeiten = log.filter((l) => l.ev === 'start' && l.f !== 30).map((l) => l.at).sort((a, b) => a - b);
  const g = [];
  zeiten.forEach((t) => { if (!g.length || t - g[g.length - 1] > 0.5) g.push(t); });
  return g;
};

/* ================================================================== */
/* A  Frischer Start                                                     */
/* ================================================================== */
console.log('\n--- A  Frischer Start: die erste Berührung schaltet frei ---');
{
  const { ctx, errs, tippe, stand, text, cdp } = await seite({ ...GRUND, tab: 'settings' });
  const s0 = await stand();
  check(s0.akt === '-/-', `vor der ersten Berührung ist das Dokument nicht aktiviert (${s0.akt}) – die Messung ist gestenfrei`);
  check(s0.ctxs === 0 && s0.zustand === 'aus', `und es gibt keinen AudioContext (Kontexte=${s0.ctxs}, ${s0.zustand})`);
  check(/Noch kein Ton angefordert/.test(s0.zeile) && /Töne anhören/.test(s0.zeile),
    `die Zeile unter Mehr sagt es und rät zu „Töne anhören": ${JSON.stringify(s0.zeile.slice(0, 90))}…`);

  // Die erste Berührung ist eine, die keinen Ton auslöst: der Reiter Dashboard.
  await tippe('.tab[data-tab="dashboard"]');
  const s1 = await stand();
  const neu = s1.log.find((l) => l.ev === 'neu');
  check(!!neu, 'die erste Berührung – ein Reiter, kein Ton – legt den AudioContext an');
  check(neu && neu.state === 'running' && neu.akt.endsWith('sticky'),
    `und er läuft sofort (${neu && neu.state}, Aktivierung ${neu && neu.akt})`);
  check(neu && /beruehrung/.test(neu.stack), `angelegt im Berührungs-Lauscher, nicht erst in einem Klick-Handler (${neu && neu.stack.split(' <- ')[1]})`);
  check(s1.zustand === 'laeuft' && s1.gespielt === 0, `tonStand: läuft, noch kein Ton (${s1.zustand}, gespielt=${s1.gespielt})`);
  // Mangel fünf der Nachprüfung: 'playback' ist auf iOS die nicht mischbare
  // Sitzung – Spotify o. Ä. stünde ab dem ersten Ton das ganze Training still.
  check(s1.sitzungJetzt === 'ambient' && !s1.sitzung.includes('playback'),
    `die Tonsitzung ist mischbar: 'ambient', nie 'playback' – Musik anderer Apps läuft weiter (gesetzt: ${JSON.stringify(s1.sitzung)})`);

  await tippe('[data-act="start-session"]');
  await warte(900);
  const s2 = await stand();
  check(s2.ctxs === 1, `„Training starten" legt keinen zweiten Kontext an (${s2.ctxs})`);
  check(s2.gespielt === 1, `der Start-Ton ist durchgelaufen (gespielt=${s2.gespielt})`);
  check(s2.log.filter((l) => l.ev === 'start').every((l) => l.state === 'running'), 'alle Quellen starteten auf einem laufenden Kontext');

  await tippe('.focus-set:not(.on)');
  await warte(500);
  const s3 = await stand();
  check(s3.gespielt === 2, `Satz-Ton durchgelaufen (gespielt=${s3.gespielt})`);
  check(s3.log.some((l) => l.ev === 'start' && l.in > 1) && s3.pause, `und das Pausensignal liegt voraus (Pause=${s3.pause})`);
  check(s3.verpasst === 0, `nichts verpasst (${s3.verpasst})`);

  await tippe('.tab[data-tab="settings"]');
  const z = await text('#tonStand');
  const urteil = await text('#tonStand .ton-urteil');
  check(urteil === '✓ Die App schickt Töne los (2 seit dem Öffnen).',
    `unter Mehr steht das Urteil zuerst, in einem Satz: ${JSON.stringify(urteil)}`);
  const li = await rein(cdp, `[...document.querySelectorAll('#tonStand li')].map((e) => e.textContent.trim())`);
  check(li.length === 5 && /Medien-Lautstärke/.test(li[0]) && /Bluetooth/.test(li[1]) && /Bitte nicht stören/.test(li[2])
    && /Website-Einstellungen → Ton/.test(li[3]) && /Stummschalter/.test(li[4]),
    `darunter die Ursachen am Handy als Liste (${li.length} Punkte)`);
  check(/Hörst du nichts, liegt es am Handy/.test(z) && !/Tonkanal:/.test(z) && (z.match(/\b2\b/g) || []).length === 1,
    'die Zahl steht einmal, nicht doppelt, und ohne Vorzeile');
  const farben = await rein(cdp, `(() => {
    const f = (sel) => { const e = document.querySelector(sel); return e ? getComputedStyle(e).color : null; };
    return { urteil: f('#tonStand .ton-urteil'), liste: f('#tonStand li'), grau: f('.small.muted') };
  })()`);
  check(farben.urteil && farben.urteil !== farben.grau && farben.liste === farben.grau,
    `das Urteil in Textfarbe (${farben.urteil}), die Liste grau (${farben.liste})`);
  const abschnitt = await rein(cdp, `[...document.querySelectorAll('.section-title')].some((e) => e.textContent.trim() === 'Töne und Hinweise')`);
  check(abschnitt, 'der Abschnitt heißt „Töne und Hinweise" – so nennt ihn auch die stille Zeile (Szene E)');
  check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.join(' | ') : ''}`);
  await ctx.close();
}

/* ================================================================== */
/* B  Gespeicherte Pause beim Start                                      */
/* ================================================================== */
console.log('\n--- B  Neuladen mitten in der Pause: kein Kontext ohne Geste, Signal kommt mit der ersten Berührung nach ---');
{
  const { ctx, errs, tippe, stand, page, sicht } = await seite(pause(Date.now() + 8000));
  const s0 = await stand();
  check(s0.akt === '-/-' && s0.pause, `gestenfrei, Leiste steht nach dem Neuladen (Pause=${s0.pause})`);
  check(s0.ctxs === 0 && s0.offen, `kein AudioContext, aber der Wunsch ist vorgemerkt (Kontexte=${s0.ctxs}, offen=${s0.offen})`);

  // Weggeschaltet und zurück – der Weg, auf dem die App bis v240 einen
  // schlafenden Kontext ohne Berührung anlegte.
  await sicht(true);
  await warte(200);
  await sicht(false);
  await warte(300);
  const s1 = await stand();
  check(s1.ctxs === 0, `auch „weggeschaltet und zurück" legt ohne Berührung keinen Kontext an (Kontexte=${s1.ctxs})`);
  check(!s1.log.some((l) => l.ev === 'start'), 'und legt nichts auf eine stehende Uhr');

  // Die erste Berührung: die Figur – löst selbst keinen Ton aus.
  await tippe('#focusFig');
  const s2 = await stand();
  const neu = s2.log.find((l) => l.ev === 'neu');
  check(!!neu && neu.state === 'running', `die Berührung der Figur legt den Kontext an, er läuft (${neu && neu.state})`);
  const vorgelegt = s2.log.filter((l) => l.ev === 'start' && l.in > 1 && l.f !== 30);
  check(vorgelegt.length >= 4 && starts(s2.log, 880) === 3,
    `und die Pause wird nachgeholt: Vorwarnung und Signal liegen voraus (${vorgelegt.length} Quellen, Signal bei +${vorgelegt.length ? Math.max(...vorgelegt.map((l) => l.in)) : '?'} s)`);
  check(!s2.offen, 'nichts mehr vorgemerkt');

  // Pausenende abwarten – ohne weitere Berührung.
  await warte(8500);
  const s3 = await stand();
  check(!s3.pause && /Pause vorbei/.test(s3.toast), `die Pause ist zu Ende (${JSON.stringify(s3.toast)})`);
  check(s3.gespielt === 2, `Vorwarnung und Signal sind durchgelaufen (gespielt=${s3.gespielt})`);
  check(starts(s3.log, 880) === 0, `kein zweites „Pause vorbei" obendrauf (neue 880-Hz-Quellen: ${starts(s3.log, 880)})`);
  const vorzeitig = s3.log.filter((l) => l.ev === 'vorzeitig');
  check(vorzeitig.length === 0,
    `endRest() hat das Signal nicht vor seinem Start verworfen (vorzeitig gestoppt: ${vorzeitig.length}${vorzeitig[0] ? `, z. B. ${vorzeitig[0].f} Hz bei Uhr ${vorzeitig[0].uhr} statt ${vorzeitig[0].at}` : ''})`);
  check(s3.vibriert, 'Handy vibriert');
  await page.screenshot({ path: `${SHOT}/42-ton-pause-nachgeholt.png` });
  check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.join(' | ') : ''}`);
  await ctx.close();
}

/* ================================================================== */
/* C  Pausenende ohne jede Berührung                                     */
/* ================================================================== */
console.log('\n--- C  Pausenende ohne Tipp: kein Kontext, der Ton gilt als verpasst und kommt einmal nach – verspätet ---');
{
  const endsAt = Date.now() + 3000;
  const { ctx, errs, konsole, tippe, stand, text } = await seite(pause(endsAt));
  const s0 = await stand();
  check(s0.akt === '-/-' && s0.pause && s0.ctxs === 0, 'gestenfrei, Leiste steht, kein Kontext');
  await bis(endsAt + 1000);
  const s1 = await stand();
  check(!s1.pause && /Pause vorbei/.test(s1.toast), `die Pause ist ohne Berührung zu Ende gegangen (${JSON.stringify(s1.toast)})`);
  check(s1.ctxs === 0, `kein Kontext ohne Geste – bis v240 entstand hier einer, schlafend (Kontexte=${s1.ctxs})`);
  check(s1.gespielt === 0 && s1.verpasst === 1 && s1.offen,
    `der Ton ist als verpasst gezählt und vorgemerkt (gespielt=${s1.gespielt}, verpasst=${s1.verpasst}, offen=${s1.offen})`);
  const sperre = konsole.filter((t) => /not allowed to start/.test(t));
  check(sperre.length === 0, `keine Konsolenmeldung „The AudioContext was not allowed to start" (${sperre.length})`);

  // Die erste Berührung: die Figur – gut drei Sekunden nach dem Ende, innerhalb
  // der Frist, und eine, die selbst keinen Ton auslöst. (Ist sie der nächste
  // Haken, kommt der Gong nicht – siehe F2.)
  await bis(endsAt + 3500);
  await tippe('#focusFig');
  await warte(1200);
  const s2 = await stand();
  const neu = s2.log.find((l) => l.ev === 'neu');
  check(!!neu && neu.state === 'running', `die Berührung legt den Kontext an, er läuft (${neu && neu.state})`);
  check(starts(s2.log, 880, true) === 3, `„Pause vorbei" kommt genau einmal nach (sofortige 880-Hz-Quellen: ${starts(s2.log, 880, true)})`);
  check(s2.gespielt === 1 && s2.verpasst === 0 && s2.verspaetet === 1 && s2.nachgeholt === 1 && !s2.offen,
    `durchgelaufen: der nachgeholte Gong – als verspätet, nicht als verpasst (gespielt=${s2.gespielt}, verspätet=${s2.verspaetet}, nachgeholt=${s2.nachgeholt}, verpasst=${s2.verpasst})`);
  await tippe('.focus-set:not(.on)');
  await warte(500);
  const s3 = await stand();
  check(s3.gespielt === 2 && s3.pause && starts(s3.log, 880, true) === 0,
    `der nächste Satz: sein Tupfer, die neue Pause, kein zweiter Gong (gespielt=${s3.gespielt}, Pause=${s3.pause})`);

  await tippe('.tab[data-tab="settings"]');
  const z = await text('#tonStand');
  check(/Die App schickt Töne los \(2 seit dem Öffnen\)\. 1 Ton kam verspätet – erst mit deiner ersten Berührung/.test(z) && !/kam nicht|deshalb/.test(z),
    `die Zeile unter Mehr nennt ihn verspätet, nicht „kam nicht": ${JSON.stringify(z.slice(0, 140))}…`);
  check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.join(' | ') : ''}`);
  await ctx.close();
}

/* ================================================================== */
/* D  „Töne anhören" als erste Berührung                                 */
/* ================================================================== */
console.log('\n--- D  „Töne anhören" als erste Berührung: sechs Töne auf der Audio-Uhr, Auswertung darunter ---');
{
  const { ctx, errs, tippe, stand, text, page } = await seite({ ...GRUND, tab: 'settings' });
  const s0 = await stand();
  check(s0.akt === '-/-' && s0.ctxs === 0, 'gestenfrei, kein Kontext');
  await tippe('[data-act="test-sound"]');
  const s1 = await stand();
  const neu = s1.log.find((l) => l.ev === 'neu');
  check(!!neu && neu.state === 'running', `der Tipp legt den Kontext an, er läuft (${neu && neu.state})`);
  const g = gruppen(s1.log);
  check(g.length === 6, `alle sechs Töne liegen sofort auf der Audio-Uhr, nicht erst per setTimeout (${g.length} Gruppen: ${g.map((t) => (t - g[0]).toFixed(1)).join(', ')} s)`);
  check(g.length === 6 && Math.abs((g[5] - g[0]) - 4.5) < 0.2, 'im Abstand von 0,9 s');
  check(s1.laufend && /Töne laufen gerade/.test(s1.zeile) && !/tipp auf/i.test(s1.zeile) && !/\b0\b/.test(s1.zeile),
    `solange die Töne laufen, steht das da – keine Aufforderung, auf „Töne anhören" zu tippen, keine 0: ${JSON.stringify(s1.zeile)}`);
  await warte(7000);
  const s2 = await stand();
  check(s2.gespielt === 6 && s2.verpasst === 0 && !s2.laufend, `alle sechs sind durchgelaufen (gespielt=${s2.gespielt}, verpasst=${s2.verpasst})`);
  const urteil = await text('#tonStand .ton-urteil');
  check(urteil === '✓ Die App schickt Töne los (6 seit dem Öffnen).',
    `die Zeile hat sich ohne weiteren Tipp nachgezogen, das Urteil zuerst: ${JSON.stringify(urteil)}`);
  const z = await text('#tonStand');
  check(/Hörst du nichts, liegt es am Handy/.test(z) && /Medien-Lautstärke/.test(z) && /Bluetooth/.test(z) && /Bitte nicht stören/.test(z)
    && /Website-Einstellungen → Ton/.test(z) && /Stummschalter/.test(z),
    'und darunter, woran es dann liegt: Medien-Lautstärke, Bluetooth, Bitte nicht stören, Website-Ton in Chrome, Stummschalter');
  check(urteil.split(/\s+/).length <= 10, `das Urteil ist kurz (${urteil.split(/\s+/).length} Wörter)`);
  await page.screenshot({ path: `${SHOT}/43-ton-auswertung.png` });
  check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.join(' | ') : ''}`);
  await ctx.close();
}

/* ================================================================== */
/* E  Attrappe: der Kontext bleibt 'interrupted'                          */
/* ================================================================== */
console.log('\n--- E  Attrappe eines unterbrochenen Kontexts: Berührung weckt, Dashboard sagt still, dass er klemmt ---');
{
  const { ctx, errs, tippe, stand, text, page } = await seite(GRUND, { attrappe: true });
  const s0 = await stand();
  check(s0.akt === '-/-' && s0.ctxs === 0, 'gestenfrei, kein Kontext');
  await tippe('[data-act="start-session"]');
  const s1 = await stand();
  check(s1.ctxs === 1 && s1.zustand === 'schlaeft', `der Kontext ist da und meldet sich als unterbrochen (${s1.zustand})`);
  check(s1.resumes >= 1, `die Berührung ruft resume() – auch bei 'interrupted', nicht nur bei 'suspended' (${s1.resumes}×)`);
  check(!s1.hinweis, 'noch keine Zeile im Dashboard – resume() bekommt erst seine Chance');
  await warte(2000);
  const s2 = await stand();
  check(s2.klemmt, `nach gut anderthalb Sekunden gilt der Kanal als klemmend (klemmt=${s2.klemmt})`);
  check(/^🔇 Töne kommen gerade nicht – der Browser hält den Ton an, obwohl du getippt hast\./.test(s2.hinweis)
    && /bleibt es stumm, App schließen und neu öffnen/.test(s2.hinweis) && /Mehr → Töne und Hinweise/.test(s2.hinweis)
    && !/nächste Tipp weckt/.test(s2.hinweis),
    `das Dashboard zeigt die stille Zeile – Urteil vorn, kein Versprechen, der Abschnitt richtig benannt: ${JSON.stringify(s2.hinweis)}`);
  check(!/Töne kommen/.test(s2.toast), 'und kein Popup dazu');
  check(s2.verpasst === 1 && s2.gespielt === 0, `der Start-Ton gilt als verpasst, nicht als gespielt (verpasst=${s2.verpasst}, gespielt=${s2.gespielt})`);
  await page.screenshot({ path: `${SHOT}/44-ton-klemmt.png` });
  await tippe('.tab[data-tab="settings"]');
  const z = await text('#tonStand');
  check(/^✗ Der Browser hält den Ton an, obwohl du schon getippt hast\. Deshalb kam 1 Ton nicht\./.test(z)
    && /Anruf/.test(z) && /Tipp noch einmal/.test(z),
    `unter Mehr steht der passende Satz: ${JSON.stringify(z.slice(0, 140))}…`);
  check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.join(' | ') : ''}`);
  await ctx.close();
}

/* ================================================================== */
/* F  Frist für den nachgeholten Gong                                     */
/* ================================================================== */
console.log('\n--- F  Pausenende ohne Tipp: nach der Frist verfällt der Gong, und der nächste Haken bringt ihn nie ---');
/*
 * F1  Erster Tipp 70 s nach dem Ende, auf die Figur – kein Ton von ihr selbst,
 *     also prüft das nur die Frist.
 * F2  Erster Tipp 30 s nach dem Ende, mitten in der Frist – aber er ist der
 *     nächste Haken. Bis d412e37 kam „Pause vorbei" dann zusammen mit dessen
 *     Tupfer, genau in dem Moment, in dem die neue Pause begann: Der
 *     Freischalt-Lauscher spielte ihn, bevor der Klick-Handler lief.
 */
for (const [name, nach, ziel] of [['F1 70 s danach, die Figur', 70000, '#focusFig'], ['F2 30 s danach, der nächste Satz', 30000, '.focus-set:not(.on)']]) {
  const satz = ziel !== '#focusFig';
  const endsAt = Date.now() + 3000;
  const { ctx, errs, cdp, tippe, stand, text } = await seite(pause(endsAt));
  await bis(endsAt + 800);
  const s1 = await stand();
  check(s1.akt === '-/-' && !s1.pause && s1.ctxs === 0 && s1.verpasst === 1 && s1.offen,
    `${name}: Pause ohne Berührung zu Ende, Gong vorgemerkt (verpasst=${s1.verpasst}, offen=${s1.offen})`);
  // Die Seite hat eine Weile nichts gesehen – Handy weggelegt, Wasser geholt,
  // oder eben den nächsten Satz gemacht.
  await rein(cdp, `window.__dateOffset += ${endsAt} + ${nach} - Date.now()`);
  await warte(300);
  const s2 = await stand();
  check(s2.offen === satz, `${name}: ${satz ? 'innerhalb der Frist steht der Gong noch an' : 'nach Ablauf der Frist steht nichts mehr zum Nachholen an'} (offen=${s2.offen})`);
  await tippe(ziel);
  await warte(1200);
  const s3 = await stand();
  check(starts(s3.log, 880, true) === 0,
    `${name}: der erste Tipp bringt KEIN „Pause vorbei" (sofortige 880-Hz-Quellen: ${starts(s3.log, 880, true)})`);
  check(s3.gespielt === (satz ? 1 : 0) && s3.verpasst === 1 && s3.gesperrt === 1 && s3.nachgeholt === 0 && !s3.offen,
    `${name}: der Gong bleibt verpasst – vor der ersten Berührung, nicht angehalten –, gespielt ist ${satz ? 'nur der Satz-Ton' : 'nichts'} (gespielt=${s3.gespielt}, verpasst=${s3.verpasst}, gesperrt=${s3.gesperrt}, nachgeholt=${s3.nachgeholt})`);
  if (satz) {
    check(s3.pause && s3.log.some((l) => l.ev === 'start' && l.f === 880 && l.in > 5),
      `${name}: die neue Pause läuft, ihr Signal liegt voraus (${s3.restTime})`);
  }
  await tippe('.tab[data-tab="settings"]');
  const z = await text('#tonStand');
  check(/1 Ton kam nicht – vor deiner ersten Berührung nach dem Öffnen lässt der Browser keinen Ton zu\./.test(z) && !/angehalten|verspätet/.test(z),
    `${name}: unter Mehr „kam nicht" mit seiner Ursache – nicht „angehalten", nicht „verspätet": ${JSON.stringify(z.slice(0, 160))}…`);
  check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.join(' | ') : ''}`);
  await ctx.close();
}

/* ================================================================== */
/* G  Ausklingen nur am echten Pausenende                                 */
/* ================================================================== */
console.log('\n--- G  0,15 s vor dem Signal: zurück in die App, „+30 s", „Pause weg" ---');
{
  // Ziel: 150 ms vor dem Ende – mitten im alten 0,3-s-Fenster. Ob die Messung
  // es trifft, wird mitgeprüft: Sonst prüfte die Szene nichts.
  const VOR = 150;
  const fenster = (d) => d > 20 && d < 290;

  // Kürzer als fünf Sekunden ab dem ersten Tipp, damit keine Vorwarnung mitspielt.
  //
  // G1  Zurück in die App: armRest() legt neu auf, das alte Signal bleibt nicht stehen.
  {
    const endsAt = Date.now() + 4500;
    const { ctx, errs, tippe, stand, sicht } = await seite(pause(endsAt));
    await tippe('#focusFig');
    const s1 = await stand();
    check(starts(s1.log, 880) === 3 && s1.zustand === 'laeuft', `G1: Signal liegt voraus, Kontext läuft (880-Hz-Quellen: ${starts(s1.log, 880)})`);
    await sicht(true);
    await bis(endsAt - VOR);
    const t = await sicht(false);
    await warte(2000);
    const s2 = await stand();
    check(fenster(endsAt - t), `G1: zurück ${endsAt - t} ms vor dem Ende – im Fenster`);
    check(zuEnde(s2.log, 880) === 3,
      `G1: „Pause vorbei" genau EINMAL (zu Ende gespielte 880-Hz-Stimmen: ${zuEnde(s2.log, 880)}; 3 = einmal, 6 = Doppelgong)`);
    check(!s2.pause && s2.gespielt === 1, `G1: Pause zu Ende, ein Ton gespielt (gespielt=${s2.gespielt})`);
    check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.join(' | ') : ''}`);
    await ctx.close();
  }

  // G2  „+30 s" kurz vor dem Ende: kein alter Gong, die Pause läuft weiter.
  for (const [name, sel, weiter] of [['G2 „+30 s"', '#restPlus', true], ['G3 „Pause weg"', '#restSkip', false]]) {
    const endsAt = Date.now() + 4500;
    const { ctx, errs, tippe, mitte, finger, stand } = await seite(pause(endsAt));
    await tippe('#focusFig');
    const s1 = await stand();
    check(starts(s1.log, 880) === 3, `${name}: Signal liegt voraus (880-Hz-Quellen: ${starts(s1.log, 880)})`);
    const p = await mitte(sel);
    await bis(endsAt - VOR - 40);   // der Klick kommt mit dem Loslassen, 40 ms nach dem Aufsetzen
    await finger(p);
    await warte(1500);
    const s2 = await stand();
    const klick = s2.klicks[s2.klicks.length - 1];
    check(klick && fenster(endsAt - klick), `${name}: getippt ${klick ? endsAt - klick : '?'} ms vor dem Ende – im Fenster`);
    check(zuEnde(s2.log, 880) === 0,
      `${name}: das alte Signal spielt NICHT (zu Ende gespielte 880-Hz-Stimmen: ${zuEnde(s2.log, 880)})`);
    if (weiter) {
      // 1,5 s nach dem Tipp: gut 28 s übrig.
      check(s2.pause && /^0:(2[789]|30)$/.test(s2.restTime) && starts(s2.log, 880) === 3 && s2.log.some((l) => l.ev === 'start' && l.f === 880 && l.in > 25),
        `${name}: die Pause läuft 30 s weiter, das Signal liegt neu 30 s später (${s2.restTime})`);
    } else {
      check(!s2.pause && s2.gespielt === 0, `${name}: die Pause ist weg, kein Ton (gespielt=${s2.gespielt})`);
    }
    check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.join(' | ') : ''}`);
    await ctx.close();
  }
}

/* ================================================================== */
/* H  Installierte App                                                    */
/* ================================================================== */
console.log('\n--- H  Installierte App: ohne Sperre klingt das Pausenende nach dem Neuladen ohne Berührung ---');
{
  // H1  Ohne Sperre (wie Chrome eine zum Startbildschirm hinzugefügte App
  // behandelt): Bis v240 klang es hier, der erste Stand von v241 blieb stumm.
  const endsAt = Date.now() + 8000;
  const { ctx, errs, konsole, stand } = await seite(pause(endsAt), { br: ohneSperre, installiert: true });
  const s0 = await stand();
  const neu = s0.log.find((l) => l.ev === 'neu');
  check(s0.akt === '-/-' && s0.pause, `H1: gestenfrei, Leiste steht nach dem Neuladen (${s0.akt})`);
  check(s0.ctxs === 1 && neu && neu.state === 'running' && s0.zustand === 'laeuft' && !s0.offen,
    `H1: die App misst – ein Kontext ohne Berührung läuft sofort und bleibt (Kontexte=${s0.ctxs}, ${neu && neu.state}, über ${neu && neu.stack.split(' <- ').slice(1, 3).join(' <- ')})`);
  check(starts(s0.log, 880) === 3, `H1: das Signal liegt auf der Uhr (880-Hz-Quellen: ${starts(s0.log, 880)})`);
  await bis(endsAt + 1500);
  const s1 = await stand();
  check(!s1.pause && zuEnde([...s0.log, ...s1.log], 880) === 3,
    `H1: „Pause vorbei" klingt ohne jede Berührung (zu Ende gespielte 880-Hz-Stimmen: ${zuEnde([...s0.log, ...s1.log], 880)})`);
  check(s1.gespielt === 2 && s1.verpasst === 0 && s1.akt === '-/-',
    `H1: Vorwarnung und Signal gespielt, nichts verpasst, nie berührt (gespielt=${s1.gespielt}, verpasst=${s1.verpasst}, ${s1.akt})`);
  check(konsole.filter((t) => /not allowed to start/.test(t)).length === 0, 'H1: keine Sperrmeldung');
  check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.join(' | ') : ''}`);
  await ctx.close();
}
{
  // H2  Installiert, aber MIT Sperre (iPhone vom Startbildschirm, ein Browser,
  // der auch dort sperrt): Der Mess-Kontext schläft – er wird geschlossen und
  // nie als bereit gewertet; es bleibt beim Vormerken, wie im Tab.
  const endsAt = Date.now() + 3000;
  const { ctx, errs, konsole, tippe, stand } = await seite(pause(endsAt), { installiert: true });
  const s0 = await stand();
  const neu = s0.log.find((l) => l.ev === 'neu');
  const zu = s0.log.find((l) => l.ev === 'close');
  check(s0.akt === '-/-' && s0.ctxs === 1 && neu && neu.state === 'suspended' && !!zu,
    `H2: einmal gemessen – der Kontext schläft (${neu && neu.state}) und wird gleich geschlossen (${zu ? 'close()' : 'nicht geschlossen'})`);
  check(s0.zustand === 'aus' && s0.offen && !s0.log.some((l) => l.ev === 'start'),
    `H2: nicht als bereit gewertet: kein Ton auf seiner Uhr, die Pause ist vorgemerkt (${s0.zustand}, offen=${s0.offen})`);
  await bis(endsAt + 1000);
  const s1 = await stand();
  check(!s1.pause && s1.ctxs === 1 && s1.verpasst === 1 && s1.offen,
    `H2: Pausenende ohne Tipp – kein zweiter Versuch, der Gong ist vorgemerkt (Kontexte=${s1.ctxs}, verpasst=${s1.verpasst})`);
  const sperre = konsole.filter((t) => /not allowed to start/.test(t)).length;
  check(sperre <= 1, `H2: höchstens eine Sperrmeldung je Dokument (${sperre})`);
  // Die Figur, nicht der nächste Haken – der brächte den Gong nicht (F2).
  await tippe('#focusFig');
  await warte(1200);
  const s2 = await stand();
  const neu2 = s2.log.find((l) => l.ev === 'neu');
  check(s2.ctxs === 2 && neu2 && neu2.state === 'running' && starts(s2.log, 880, true) === 3,
    `H2: die erste Berührung legt einen laufenden Kontext an und holt den Gong nach (${neu2 && neu2.state}, sofortige 880-Hz-Quellen: ${starts(s2.log, 880, true)})`);
  check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.join(' | ') : ''}`);
  await ctx.close();
}

/* ================================================================== */
/* I  Ein fälliges Signal, das nie kam                                    */
/* ================================================================== */
console.log('\n--- I  Kontext angehalten, Pausenende verschlafen: gezählt wird es trotzdem ---');
for (const [name, nach, ersatz] of [['I1 70 s danach', 70000, false], ['I2 20 s danach', 20000, true]]) {
  const endsAt = Date.now() + 30000;
  const { ctx, errs, cdp, tippe, stand, text, sicht } = await seite(pause(endsAt));
  await tippe('#focusFig');
  const s1 = await stand();
  check(starts(s1.log, 880) === 3 && s1.log.some((l) => l.ev === 'start' && l.f === 587) && s1.zustand === 'laeuft',
    `${name}: Vorwarnung und Signal liegen, Kontext läuft`);
  // Der Browser hält den Kontext im Hintergrund an, die Seite schläft; beim
  // Aufwachen steht die Wanduhr hinter dem Pausenende.
  await rein(cdp, 'window.__ctx.suspend()');
  await sicht(true);
  await rein(cdp, `window.__dateOffset += ${endsAt} + ${nach} - Date.now()`);
  await warte(2000);
  const s2 = await stand();
  await sicht(false);
  await warte(1500);
  const s3 = await stand();
  const log = [...s2.log, ...s3.log];
  check(!s2.pause, `${name}: die Pause ist zu Ende`);
  if (!ersatz) {
    check(starts(log, 880) === 0 && zuEnde(log, 880) === 0, `${name}: kein Nachklingeln – zu lange her (880-Hz-Quellen: ${starts(log, 880)})`);
    check(s3.gespielt === 0 && s3.verpasst === 2,
      `${name}: Vorwarnung und Signal waren fällig und kamen nie – beide gezählt (gespielt=${s3.gespielt}, verpasst=${s3.verpasst})`);
    await tippe('.tab[data-tab="settings"]');
    const z = await text('#tonStand');
    // Hier lag es wirklich am angehaltenen Kanal, nicht an der ersten Berührung.
    check(/2 Töne kamen nicht – der Browser hatte den Ton in dem Moment angehalten\./.test(z) && !/vor deiner ersten Berührung/.test(z),
      `${name}: unter Mehr steht es, mit der richtigen Ursache: ${JSON.stringify(z.slice(0, 140))}…`);
  } else {
    check(starts(log, 880, true) === 3 && zuEnde(log, 880) === 3, `${name}: Ersatz-Gong, genau einer (zu Ende gespielt: ${zuEnde(log, 880)})`);
    check(s3.gespielt === 1 && s3.verspaetet === 1 && s3.nachgeholt === 0 && s3.verpasst === 1,
      `${name}: der Ersatz zählt als verspätet, der liegengebliebene nicht doppelt, die Vorwarnung als verpasst (gespielt=${s3.gespielt}, verspätet=${s3.verspaetet}, verpasst=${s3.verpasst})`);
  }
  check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.join(' | ') : ''}`);
  await ctx.close();
}

/* ================================================================== */
/* J  Mehr → Töne und Hinweise vor der ersten Berührung                   */
/* ================================================================== */
console.log('\n--- J  Neu geladen mitten in der Pause, direkt unter Mehr: was dort vor dem ersten Tipp steht ---');
const KEIN_TON = '✗ Noch kein Ton frei – vor der ersten Berührung nach dem Öffnen lässt der Browser keinen zu.';
{
  // J1  Tobi steht in der Pause unter Mehr, Android beendet die App, er kommt
  // zurück: Sie lädt direkt dorthin (der Reiter wird mitgespeichert), und die
  // Pause läuft ohne Tipp ab. Bis d412e37 stand hier die ganze Zeit „Noch kein
  // Ton angefordert" – auch mit zwei verpassten Tönen und einem, der wartete.
  const endsAt = Date.now() + 8000;
  const { ctx, errs, tippe, stand, text } = await seite({ ...pause(endsAt), tab: 'settings' });
  const s0 = await stand();
  check(s0.akt === '-/-' && s0.pause && s0.zustand === 'aus' && s0.wartet === 'pause' && s0.verpasst === 0,
    `J1: gestenfrei, Pause läuft, ihr Signal wartet auf die erste Berührung (${s0.zustand}, wartet=${s0.wartet})`);
  check(s0.zeile === `${KEIN_TON} Tipp einmal irgendwohin, dann kommt das Pausensignal pünktlich.`,
    `J1: unter Mehr steht, woran es liegt und was ein Tipp bringt – nicht „Noch kein Ton angefordert": ${JSON.stringify(s0.zeile)}`);
  await bis(endsAt + 800);
  const s1 = await stand();
  check(!s1.pause && s1.verpasst === 2 && s1.gesperrt === 2 && s1.wartet === 'rest',
    `J1: Pause ohne Tipp abgelaufen – Vorwarnung und Gong verpasst, beide vor der ersten Berührung, der Gong wartet (verpasst=${s1.verpasst}, gesperrt=${s1.gesperrt}, wartet=${s1.wartet})`);
  check(s1.zeile === `${KEIN_TON} Deshalb kamen 2 Töne nicht. Tipp einmal irgendwohin, dann kommt „Pause vorbei" noch nach.`,
    `J1: die Zeile hat sich nachgezogen, mit der Zahl und ohne „angehalten": ${JSON.stringify(s1.zeile)}`);
  // Die erste Berührung: eine Überschrift unter Mehr – kein Knopf, kein Ton.
  // Gut drei Sekunden nach dem Ende: Unter zwei Sekunden hieße der Gong nicht
  // verspätet (SPAET_MS).
  await bis(endsAt + 3500);
  await tippe('#daten');
  await warte(1200);
  const s2 = await stand();
  check(s2.zustand === 'laeuft' && starts(s2.log, 880, true) === 3 && s2.gespielt === 1 && s2.verspaetet === 1
    && s2.nachgeholt === 1 && s2.verpasst === 1 && s2.gesperrt === 1,
    `J1: die Berührung holt den Gong nach (sofortige 880-Hz-Quellen: ${starts(s2.log, 880, true)}, gespielt=${s2.gespielt}, nachgeholt=${s2.nachgeholt}, verpasst=${s2.verpasst})`);
  const urteil = await text('#tonStand .ton-urteil');
  check(urteil === '✓ Die App schickt Töne los (1 seit dem Öffnen). Vor deiner ersten Berührung nach dem Öffnen lässt der Browser keinen Ton zu – deshalb kam 1 Ton verspätet, 1 Ton kam gar nicht.',
    `J1: eine Ursache, ein Satz – nicht zwei verschiedene Gründe für zwei Töne aus demselben: ${JSON.stringify(urteil)}`);
  check(!/angehalten/.test(s2.zeile), 'J1: und nirgends „angehalten" – angehalten hatte der Browser nichts');
  check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.join(' | ') : ''}`);
  await ctx.close();
}
{
  // J2  Die Frist verstreicht, während Mehr offen ist: „kommt noch nach" darf
  // dann nicht stehen bleiben. Die Wanduhr springt auf 57 s nach dem Ende –
  // die Pause endet beim nächsten Takt, der Gong hätte noch drei Sekunden.
  // Nebenbei: Hier ist beim Pausenende nur der Gong fällig (die Vorwarnung lag
  // schon beim Laden zurück) – auch dann muss „das Pausensignal kommt
  // pünktlich" verschwinden; cancelSound() meldete das erst nicht.
  const endsAt = Date.now() + 3000;
  const { ctx, errs, stand, cdp } = await seite({ ...pause(endsAt), tab: 'settings' });
  await rein(cdp, `window.__dateOffset += ${endsAt} + 57000 - Date.now()`);
  await warte(800);
  const s1 = await stand();
  check(s1.akt === '-/-' && !s1.pause && s1.wartet === 'rest' && s1.verpasst === 1 && s1.gesperrt === 1,
    `J2: Pause zu Ende, der Gong wartet noch (wartet=${s1.wartet}, verpasst=${s1.verpasst})`);
  check(s1.zeile === `${KEIN_TON} Deshalb kam 1 Ton nicht. Tipp einmal irgendwohin, dann kommt „Pause vorbei" noch nach.`,
    `J2: ${JSON.stringify(s1.zeile)}`);
  await warte(3500);
  const s2 = await stand();
  check(!s2.offen && s2.wartet === null && s2.verpasst === 1,
    `J2: nach der Frist wartet nichts mehr (offen=${s2.offen}, verpasst=${s2.verpasst})`);
  check(s2.zeile === `${KEIN_TON} Deshalb kam 1 Ton nicht. Tipp einmal irgendwohin, dann ist der Ton frei.`,
    `J2: die Zeile zieht sich ohne Berührung nach – kein „kommt noch nach" mehr: ${JSON.stringify(s2.zeile)}`);
  check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.join(' | ') : ''}`);
  await ctx.close();
}

console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
await browser.close();
await ohneSperre.close();
