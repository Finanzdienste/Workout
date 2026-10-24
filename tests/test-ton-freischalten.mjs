/*
 * Der Ton wird mit der ersten Berührung frei – und nie ohne eine.
 *
 *     „Irgendwie gibt's überhaupt keine soundeffekte mehr in der app"
 *     „Jetzt fehlt iwie die Pause" – „Und es gibt iwie überhaupt keine sounds"
 *
 * Gemessen wird hier das, was die Autoplay-Sperre des Handys mit der App macht,
 * und zwar mit der Sperre: Chromium läuft ohne --autoplay-policy-Flagge, also
 * mit document-user-activation-required – genau wie Chrome auf dem Handy im Tab
 * und als „Zum Startbildschirm"-Verknüpfung. Touch-Kontext, Android-Chrome-UA.
 * (Ein iPhone-UA ergibt in Chromium dasselbe Protokoll; WebKit-Regeln kann
 * dieser Lauf nicht prüfen.)
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
 * Fünf Szenen, jede mit Gegenprobe gegen den Stand vor v241 (4e1669e):
 *
 *   A  Frischer Start: Die erste Berührung – auch eine, die keinen Ton auslöst
 *      (der Reiter „Mehr") – legt den Kontext an, und er läuft sofort.
 *   B  Gespeicherte Pause beim Start: Kein Kontext ohne Geste, auch nicht nach
 *      „weggeschaltet und zurück"; die erste Berührung (die Figur) legt das
 *      Signal nach, es spielt genau einmal – und endRest() verwirft es nicht
 *      mehr vor seinem Start.
 *   C  Pausenende ohne Tipp: kein Kontext, kein „not allowed to start", der
 *      Ton gilt als verpasst – und kommt mit der ersten Berührung einmal nach.
 *   D  „Töne anhören" als erste Berührung: sechs Töne, sofort auf der Audio-Uhr,
 *      und die Auswertung darunter nennt die Geräte-Ursachen.
 *   E  Attrappe eines unterbrochenen Kontexts ('interrupted'): Die Berührung
 *      weckt ihn, und das Dashboard sagt still, dass er klemmt.
 */
import { chromium } from 'playwright';
import { URL, SHOT } from './umgebung.mjs';

const browser = await chromium.launch();   // KEINE Autoplay-Flagge – Standard-Policy
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
console.log(`# Chromium ${browser.version()}, Standard-Autoplay-Policy, Touch`);

const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const heute = new Date().toISOString().slice(0, 10);
const GRUND = { greeted: true, name: 'T', level: 'geuebt', shift: 0, log: {}, tab: 'dashboard', sound: true, soundSets: true };
const LAUFEND = {
  ...GRUND, session: { n: 1 }, fokusOffen: { n: 1, id: null },
  clock: { n: 1, on: heute, spent: 0, since: Date.now(), gebucht: 0 },
};

/*
 * Die Sonde: AudioContext und seine Quellen beobachten – vor dem Laden der
 * Seite, per addInitScript. Mitgeschrieben werden Anlegen (Zustand, Aktivierung,
 * Aufrufkette), Zustandswechsel, resume(), jeder start() und stop() mit der
 * Audio-Uhr. `attrappe` macht aus dem Kontext einen, der 'interrupted' meldet
 * und sich nicht wecken lässt – so, wie iOS ihn nach einem Anruf hinterlässt.
 */
const SONDE = (attrappe) => {
  const akt = () => (navigator.userActivation
    ? `${navigator.userActivation.isActive ? 'aktiv' : '-'}/${navigator.userActivation.hasBeenActive ? 'sticky' : '-'}`
    : '?');
  window.__ac = { log: [], ctxs: 0, resumes: 0 };
  const Orig = window.AudioContext;
  window.AudioContext = class extends Orig {
    constructor(...a) {
      super(...a);
      window.__ac.ctxs += 1;
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
  };
  const S = window.AudioScheduledSourceNode.prototype.start;
  window.AudioScheduledSourceNode.prototype.start = function (...a) {
    this.__at = a[0] !== undefined ? a[0] : this.context.currentTime;
    window.__ac.log.push({
      ev: 'start', f: this.frequency ? Math.round(this.frequency.value) : 0,
      in: +(this.__at - this.context.currentTime).toFixed(2), uhr: +this.context.currentTime.toFixed(2),
      at: +this.__at.toFixed(2), state: this.context.state,
    });
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
};

/** Rohes CDP, ohne userGesture – das ist der ganze Trick. */
async function rein(cdp, expression) {
  const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || exceptionDetails.text);
  return result.value;
}

async function seite(zustand, attrappe = false) {
  const ctx = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 414, height: 896 }, userAgent: UA });
  // Nichts nach draußen – die Sicherung spricht sonst mit dem Server.
  await ctx.route((u) => !u.href.startsWith('http://127.0.0.1'), (r) => r.fulfill({ status: 204, body: '' }));
  await ctx.addInitScript(SONDE, attrappe);
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
  /** Ein Tipp mit dem Finger: touchStart, touchEnd – Chromium aktiviert beim Loslassen. */
  const tippe = async (sel) => {
    const p = await mitte(sel);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y }] });
    await warte(40);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await warte(350);
  };
  /** Stand ablesen: tonStand() aus derselben Modulinstanz wie die App, dazu die Sonde. */
  const stand = async () => {
    const r = await rein(cdp, `(async () => {
      const a = await import('./js/audio.js');
      const ua = navigator.userActivation;
      return {
        ...a.tonStand(), ctxs: window.__ac.ctxs, resumes: window.__ac.resumes, log: window.__ac.log.splice(0),
        akt: ua ? (ua.isActive ? 'aktiv' : '-') + '/' + (ua.hasBeenActive ? 'sticky' : '-') : '?',
        pause: !(document.getElementById('restBar') || {}).hidden,
        zeile: (document.getElementById('tonStand') || {}).textContent || '',
        hinweis: ((document.getElementById('tonHinweis') || {}).textContent || '').replace(/\\s+/g, ' ').trim(),
        toast: (document.getElementById('toast') || {}).textContent || '',
        vibriert: Array.isArray(window.__vibrate),
      };
    })()`);
    return r;
  };
  const text = (sel) => rein(cdp, `((document.querySelector(${JSON.stringify(sel)}) || {}).textContent || '').replace(/\\s+/g, ' ').trim()`);
  return { ctx, page, cdp, errs, konsole, tippe, mitte, stand, text };
}

/**
 * Wie viele Quellen einer Frequenz gestartet wurden – 880 Hz ist der Grundton
 * von „Pause vorbei", dreistimmig: 3 heißt einmal, 6 hieße zweimal. `sofort`
 * zählt nur, was für jetzt gestartet wurde, nicht das für die nächste Pause
 * vorausgelegte Signal (dasselbe Signal, nur Sekunden später auf der Uhr).
 */
const starts = (log, f, sofort = false) => log.filter((l) => l.ev === 'start' && l.f === f && (!sofort || l.in < 0.5)).length;
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
  const { ctx, errs, tippe, stand, text } = await seite({ ...GRUND, tab: 'settings' });
  const s0 = await stand();
  check(s0.akt === '-/-', `vor der ersten Berührung ist das Dokument nicht aktiviert (${s0.akt}) – die Messung ist gestenfrei`);
  check(s0.ctxs === 0 && s0.zustand === 'aus', `und es gibt keinen AudioContext (Kontexte=${s0.ctxs}, ${s0.zustand})`);
  check(/noch nicht angefordert/.test(s0.zeile) && /Töne anhören/.test(s0.zeile),
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
  check(/Tonkanal: läuft · 2 Töne losgeschickt/.test(z) && /Medien-Lautstärke/.test(z) && /Bluetooth/.test(z)
    && /Bitte nicht stören/.test(z) && /Website-Einstellungen/.test(z) && /Stummschalter/.test(z),
    `unter Mehr steht die Auswertung mit den Geräte-Ursachen: ${JSON.stringify(z.slice(0, 120))}…`);
  check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.join(' | ') : ''}`);
  await ctx.close();
}

/* ================================================================== */
/* B  Gespeicherte Pause beim Start                                      */
/* ================================================================== */
console.log('\n--- B  Neuladen mitten in der Pause: kein Kontext ohne Geste, Signal kommt mit der ersten Berührung nach ---');
{
  const { ctx, cdp, errs, tippe, stand, page } = await seite({
    ...LAUFEND, rest: { endsAt: Date.now() + 8000, total: 90, next: 'Satz 2 von 3 · Test', ex: null },
  });
  const s0 = await stand();
  check(s0.akt === '-/-' && s0.pause, `gestenfrei, Leiste steht nach dem Neuladen (Pause=${s0.pause})`);
  check(s0.ctxs === 0 && s0.offen, `kein AudioContext, aber der Wunsch ist vorgemerkt (Kontexte=${s0.ctxs}, offen=${s0.offen})`);

  // Weggeschaltet und zurück – der Weg, auf dem die App bis v240 einen
  // schlafenden Kontext ohne Berührung anlegte.
  await rein(cdp, `(() => { window.__hidden = true; document.dispatchEvent(new Event('visibilitychange')); })()`);
  await warte(200);
  await rein(cdp, `(() => { window.__hidden = false; document.dispatchEvent(new Event('visibilitychange')); })()`);
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
console.log('\n--- C  Pausenende ohne Tipp: kein Kontext, der Ton gilt als verpasst und kommt einmal nach ---');
{
  const { ctx, errs, konsole, tippe, stand, text } = await seite({
    ...LAUFEND, rest: { endsAt: Date.now() + 3000, total: 90, next: 'Satz 2 von 3 · Test', ex: null },
  });
  const s0 = await stand();
  check(s0.akt === '-/-' && s0.pause && s0.ctxs === 0, 'gestenfrei, Leiste steht, kein Kontext');
  await warte(4000);
  const s1 = await stand();
  check(!s1.pause && /Pause vorbei/.test(s1.toast), `die Pause ist ohne Berührung zu Ende gegangen (${JSON.stringify(s1.toast)})`);
  check(s1.ctxs === 0, `kein Kontext ohne Geste – bis v240 entstand hier einer, schlafend (Kontexte=${s1.ctxs})`);
  check(s1.gespielt === 0 && s1.verpasst === 1 && s1.offen,
    `der Ton ist als verpasst gezählt und vorgemerkt (gespielt=${s1.gespielt}, verpasst=${s1.verpasst}, offen=${s1.offen})`);
  const sperre = konsole.filter((t) => /not allowed to start/.test(t));
  check(sperre.length === 0, `keine Konsolenmeldung „The AudioContext was not allowed to start" (${sperre.length})`);

  // Die erste Berührung: der nächste Satz.
  await tippe('.focus-set:not(.on)');
  await warte(1200);
  const s2 = await stand();
  const neu = s2.log.find((l) => l.ev === 'neu');
  check(!!neu && neu.state === 'running', `der Satz-Tipp legt den Kontext an, er läuft (${neu && neu.state})`);
  check(starts(s2.log, 880, true) === 3, `„Pause vorbei" kommt genau einmal nach (sofortige 880-Hz-Quellen: ${starts(s2.log, 880, true)})`);
  check(s2.gespielt === 2 && s2.verpasst === 1 && !s2.offen,
    `durchgelaufen: der nachgeholte Gong und der Satz-Ton (gespielt=${s2.gespielt}, verpasst=${s2.verpasst}, offen=${s2.offen})`);
  check(s2.pause, 'und die neue Pause läuft');

  await tippe('.tab[data-tab="settings"]');
  const z = await text('#tonStand');
  check(/läuft · 2 Töne losgeschickt/.test(z) && /1 Ton kam deshalb nicht/.test(z),
    `die Zeile unter Mehr nennt den verpassten Ton: …${JSON.stringify(z.slice(-110))}`);
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
  check(/Tonkanal: läuft · 0 Töne losgeschickt/.test(s1.zeile), `die Zeile steht sofort auf „läuft": ${JSON.stringify(s1.zeile.slice(0, 60))}…`);
  await warte(7000);
  const s2 = await stand();
  check(s2.gespielt === 6 && s2.verpasst === 0, `alle sechs sind durchgelaufen (gespielt=${s2.gespielt}, verpasst=${s2.verpasst})`);
  const z = await text('#tonStand');
  check(/Tonkanal: läuft · 6 Töne losgeschickt/.test(z), `die Zeile hat sich ohne weiteren Tipp nachgezogen: ${JSON.stringify(z.slice(0, 60))}…`);
  check(/liegt es am Gerät/.test(z) && /Medien-Lautstärke/.test(z) && /Bluetooth/.test(z) && /Bitte nicht stören/.test(z)
    && /Website-Einstellungen → Ton/.test(z) && /Stummschalter/.test(z),
    'und nennt in einfachen Worten, woran es dann liegt: Medien-Lautstärke, Bluetooth, Bitte nicht stören, Website-Ton in Chrome, Stummschalter');
  await page.screenshot({ path: `${SHOT}/43-ton-auswertung.png` });
  check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.join(' | ') : ''}`);
  await ctx.close();
}

/* ================================================================== */
/* E  Attrappe: der Kontext bleibt 'interrupted'                          */
/* ================================================================== */
console.log('\n--- E  Attrappe eines unterbrochenen Kontexts: Berührung weckt, Dashboard sagt still, dass er klemmt ---');
{
  const { ctx, errs, tippe, stand, text, page } = await seite(GRUND, true);
  const s0 = await stand();
  check(s0.akt === '-/-' && s0.ctxs === 0, 'gestenfrei, kein Kontext');
  await tippe('[data-act="start-session"]');
  const s1 = await stand();
  check(s1.ctxs === 1 && s1.zustand === 'schlaeft', `der Kontext ist da und meldet sich als unterbrochen (${s1.zustand})`);
  check(s1.resumes >= 1, `die Berührung ruft resume() – auch bei 'interrupted', nicht nur bei 'suspended' (${s1.resumes}×)`);
  check(!s1.hinweis, 'noch keine Zeile im Dashboard – resume() bekommt erst seine Chance');
  await warte(2000);
  const s2 = await stand();
  check(s2.klemmt, `nach gut einer Sekunde gilt der Kanal als klemmend (klemmt=${s2.klemmt})`);
  check(/Tonkanal an, obwohl du getippt hast/.test(s2.hinweis), `das Dashboard zeigt die stille Zeile: ${JSON.stringify(s2.hinweis.replace(/\s+/g, ' ').trim().slice(0, 80))}…`);
  check(!/Tonkanal/.test(s2.toast), 'und kein Popup dazu');
  check(s2.verpasst === 1 && s2.gespielt === 0, `der Start-Ton gilt als verpasst, nicht als gespielt (verpasst=${s2.verpasst}, gespielt=${s2.gespielt})`);
  await page.screenshot({ path: `${SHOT}/44-ton-klemmt.png` });
  await tippe('.tab[data-tab="settings"]');
  const z = await text('#tonStand');
  check(/Tonkanal: angehalten/.test(z) && /obwohl du schon getippt hast/.test(z) && /1 Ton kam deshalb nicht/.test(z),
    `unter Mehr steht der passende Satz: ${JSON.stringify(z.slice(0, 120))}…`);
  check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.join(' | ') : ''}`);
  await ctx.close();
}

console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
await browser.close();
