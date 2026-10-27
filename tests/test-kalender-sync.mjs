/*
 * Google Kalender automatisch – die Seite der App (js/kalender-sync.js, die
 * Karte unter Mehr → Kalender).
 *
 *     „Ja aber nur wenn es wirklich keinen Weg gibt wie verschoben wird auch
 *      wenn ich die app nicht öffne"
 *
 *     „Es soll von selbst einfach das optimale passieren"
 *
 * Das Skript in Tobis Google-Konto wird hier gespielt (page.route auf
 * script.google.com): Es antwortet, wie kalender/workout-kalender.gs antwortet
 * – oder mit dem, was in der Praxis schiefgeht: kein Netz, eine Anmeldeseite
 * ohne CORS (Zugriff „Jeder mit Google-Konto", „Neue Version" vergessen), eine
 * Fehlerseite, keine Antwort, ein falsches Kennwort, ein zu alter Code, ein
 * anderes Gerät. Kein Aufruf erreicht Google. Die Weiterleitung über
 * script.googleusercontent.com lässt sich so nicht nachstellen (Playwright
 * folgt einem gespielten 302 nicht) – das prüft erst Tobis Konto.
 *
 *   1. Die Karte: was sie sagt, die Schritte, „Code kopieren" – das Kennwort
 *      steht vorher fest im Speicher, ist im Code, bleibt über Neuladen und
 *      zweites Kopieren dasselbe; geht das Kopieren nicht, steht der Code da.
 *      Ohne Verbindung geht nichts hinaus.
 *   2. „Verbinden": jede Fehlerart mit einem Satz, der sagt, was zu tun ist,
 *      ohne dass die Verbindung gespeichert wird; dann die gelungene Probe und
 *      die erste Vorschau – ein einfacher POST (text/plain, keine eigenen
 *      Header, keine Cookies, kein OPTIONS), die nutzlastPruefen() besteht.
 *   3. Der Takt: Start, Neuladen am selben Tag (nichts) und am nächsten,
 *      erster Haken sofort (und die Einheit bleibt morgen auf heute), ein
 *      zweiter Haken gedrosselt (der Tagesabschluss ab zwei Sätzen), ein
 *      dritter nichts, andere Änderungen gedrosselt auf einmal in zwei
 *      Minuten, Abschluss sofort, Wegschalten nur mit fertiger Vorschau, ohne
 *      Netz nachgeholt bei „online". Die Pause (Start, Ende, „+30 s") rechnet
 *      nicht neu.
 *   4. Die Antworten: anderes Gerät, Kennwort, zu alter Code, Kalender fehlt,
 *      undurchsichtig – was davon auf das Dashboard gehört und was nicht;
 *      „fehler" und „zeit" gehen von selbst noch einmal hinaus.
 *   5. Uhrzeit und Erinnerung schicken sofort neu.
 *   6. Trennen, eine neue URL (das „aus" an die alte), Trennen ohne Netz,
 *      „Alle Daten löschen".
 *   7. Sicherung und Export tragen die Verbindung, ein neues Handy schickt
 *      damit als eigenes Gerät weiter; eine Datei ohne Adresse trennt nicht;
 *      Kennwort und Adresse stehen nie im Rückkanal, im Diagnoseprotokoll, in
 *      einer Meldung, der Konsole oder dem, was an den Worker geht (Abschnitt 3).
 *   8. Der ICS-Hinweis schweigt, solange der Kalender verbunden ist.
 *   9. Ohne Netz trainiert: Der Service Worker schickt im Hintergrund nach
 *      (das „sync" per CDP ausgelöst – Background Sync ist im Chromium ohne
 *      Oberfläche abgeschaltet); nach „fehler" ebenso, und ist das Skript
 *      noch beschäftigt, behält er die Sendung.
 *  10. Last im Fenster, gemessen mit echter Uhr.
 *  11. Die Einzeldatei: Karte ohne Knöpfe, keine Fehler.
 *  12. Konstanten, die an zwei Stellen stehen, sind gleich.
 *  13. Ein Jahr im Voraus („Klappt alles aber bisschen wenig Termine. Lass
 *      doch mal ein Jahr machen"): Solange das Skript Fassung 1 meldet, geht
 *      v 1 hinaus wie bisher; die Startseite sagt es einmal dezent (und bleibt
 *      eine Seite, bei 414×896 und 360×740; neben einer anderen Zeile und mit
 *      Fortschritt tritt die Bitte zurück), die Karte bittet um den neuen Code
 *      – mit Schritten ohne „einrichten" und demselben Kennwort, nach
 *      „Ansehen" unter der Kopfleiste, oben „vier Wochen im Voraus".
 *      Zurück aus Apps Script – auch schon nach 90 s, oder auf der Karte
 *      geblieben – fragt die App nach, sieht Fassung 2 und schickt von selbst
 *      das Jahr, genau einmal; solange es beim Skript liegt, sagt die Karte
 *      „Neuer Code erkannt". Ein Gerät, das die Fassung
 *      nicht kennt, schickt erst v 1 und gleich danach v 2; weist ein Skript
 *      v 2 zurück, geht dieselbe Vorschau gleich als v 1 hinaus (beim
 *      Wegschalten erst beim Zurückkommen) – ohne dass eine Warnzeile
 *      aufblitzt. Findet die Rechnung nie zur Fassung (ein Worker ohne
 *      Ferne), hört die App nach zwei Versuchen auf. Was v245 vermerkte, sagt
 *      die Fassung schon vor der ersten Antwort.
 *  14. Über 64 KiB (ein Jahr mit vielen Terminen): beim Wegschalten kein
 *      keepalive, sondern gleich in den Ausgang – der Service Worker schickt
 *      es, und die App merkt sich danach, was ankam.
 *  15. Was die Prüfung des Entwurfs fand: Während das Skript das Jahr
 *      einträgt, sagt die Karte, was schon steht (stehen, folge), und fragt
 *      nach – danach nicht mehr; eine gekürzte Ferne; eine Ferne, die sich
 *      nicht rechnen lässt (die Nähe geht genau einmal als v 1); „Neue
 *      Version" vergessen, gezählt nach der Zeit der Antwort (ohne die grüne
 *      Meldung daneben); das Tageskontingent („morgen"); über 64 KiB ohne
 *      Background Sync.
 *
 *     node tests/test-kalender-sync.mjs            # alles
 *     node tests/test-kalender-sync.mjs 3 7        # nur Abschnitt 3 und 7
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, URL as APP, EINZEL, SHOT } from './umgebung.mjs';
import { entschluesseln, labor, meta as sicherungMeta } from './sicherung-labor.mjs';

const V = await import(pathToFileURL(path.join(ROOT, 'js', 'kalender-vorschau.js')).href);

let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };
const nur = process.argv.slice(2);

const ZUSTAND = JSON.parse(readFileSync(path.join(ROOT, 'tests', 'zusatz-tobi-do.json'), 'utf8'));
const VORLAGE = readFileSync(path.join(ROOT, 'kalender', 'workout-kalender.gs'), 'utf8');
const PLATZHALTER = '<<KENNWORT-AUS-DER-APP>>';
// Do 08.10.2026, 10:00 in Berlin – der Tag von Tobis Stand.
const START = Date.parse('2026-10-08T10:00:00+02:00');
const HEUTE = '2026-10-08';
const MORGEN = '2026-10-09';
const URL_A = 'https://script.google.com/macros/s/AKfycbTestEinsAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/exec';
const URL_B = 'https://script.google.com/macros/s/AKfycbTestZweiBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB/exec';
const TOKEN = 'Testkennwort_0123456789abcdefghijklmnopqrstu';
const ACAO = { 'access-control-allow-origin': '*' };
const ORIGIN = new globalThis.URL(APP).origin;

const browser = await chromium.launch();
const seitenFehler = [];
const offen = new Set();
const echteWarte = (ms) => new Promise((r) => { setTimeout(r, ms); });

/* ------------------------------------------------------------------ *
 * Das gespielte Skript
 * ------------------------------------------------------------------ */

const bisTag = (iso, k) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + k)).toISOString().slice(0, 10);
};

/**
 * Antwortet wie kalender/workout-kalender.gs – solange `modus` 'ok' ist und
 * kein `code` vorgegeben. Hält jede Anfrage fest: Adresse, Body, Kopf, ob sie
 * vom Service Worker kam.
 *   modus  'ok' | 'netz' (kein Netz) | 'html' (Anmeldeseite ohne CORS) |
 *          'kaputt' (lesbare Fehlerseite, kein JSON)
 *   code   eine feste Antwort ('token', 'format', 'aelter' …) samt hinweis
 *   halten ein Versprechen, auf das jede Anfrage wartet (keine Antwort)
 */
function skriptAttrappe() {
  const s = {
    anfragen: [], modus: 'ok', code: null, hinweis: undefined, version: 2, halten: null, geaendert: 2, cors: new Set(),
    get: 'status', getCors: false, probeHinweis: null, haltenVorschau: null,
    // Wie Fassung 1 (Tobis Skript bis zum Code-Update): kennt v 2 nicht.
    fassung1: false,
    // Fassung 2 beim Eintragen des Jahres (Abschnitt 15): so viel ist nach der
    // Sendung noch offen, bis dahin steht der Kalender, kommt der Rest in Minuten;
    // probeStand: was eine Probe danach vom letzten Abgleich sagt.
    offen: 0, stehen: null, folge: null, probeStand: null,
  };
  s.route = async (route) => {
    const req = route.request();
    const roh = req.postData() || '';
    let j = null;
    try { j = JSON.parse(roh); } catch { j = null; }
    let vonSW = false;
    try { vonSW = !!req.serviceWorker(); } catch { vonSW = false; }
    s.anfragen.push({ url: req.url(), methode: req.method(), roh, j, kopf: req.headers(), vonSW });
    try {
      // doGet (die App fragt es nur nach einer undurchsichtigen Probe):
      //   'status' der neue Code, 'alt' der Code der Probe (JSON ohne code
      //   'status'), 'html' eine Seite ohne CORS, 'netz' gar nichts.
      if (req.method() === 'GET') {
        if (s.get === 'netz') { await route.abort('internetdisconnected'); return; }
        if (s.get === 'html') {
          s.getCors = !s.getCors;
          if (s.getCors) { await route.abort('failed'); return; }
          await route.fulfill({ status: 200, contentType: 'text/html', body: '<html>Anmelden – Google-Konten</html>' });
          return;
        }
        const body = s.get === 'alt' ? { ok: true, probe: 'läuft' } : { ok: true, code: 'status', version: s.version, kalender: 'Workout', kennwort: true };
        await route.fulfill({ status: 200, contentType: 'application/json', headers: ACAO, body: JSON.stringify(body) });
        return;
      }
      if (s.halten) await s.halten;
      if (s.haltenVorschau && j && j.tage) await s.haltenVorschau;
      if (s.modus === 'netz') { await route.abort('internetdisconnected'); return; }
      if (s.modus === 'html') {
        // Eine Anmeldeseite ohne CORS-Freigabe. Playwright prüft bei einer
        // gespielten Antwort kein CORS – also so, wie der Browser es der Seite
        // zeigt: Die Anfrage mit CORS scheitert („Failed to fetch"), dieselbe
        // ohne CORS kommt an und ist undurchsichtig.
        if (!s.cors.has(roh)) {
          s.cors.add(roh);
          await route.abort('failed');
          return;
        }
        await route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>Anmelden – Google-Konten</body></html>' });
        return;
      }
      if (s.modus === 'kaputt') {
        await route.fulfill({ status: 404, contentType: 'text/html', headers: ACAO, body: '<html>Die Seite wurde nicht gefunden</html>' });
        return;
      }
      let a;
      if (s.fassung1 && j && j.v !== 1) a = { ok: false, code: 'format', hinweis: 'Die App ist neuer als dieses Skript – „Kalender-Code erneuern".' };
      else if (s.code) a = { ok: ['angekommen', 'gleich', 'probe', 'aus'].includes(s.code), code: s.code };
      else if (j && j.probe) a = { ok: true, code: 'probe', hinweis: s.probeHinweis || 'Verbunden. Noch keine Vorschau angekommen.' };
      else if (j && j.aus) a = { ok: true, code: 'aus', geaendert: 3 };
      else a = { ok: true, code: 'angekommen', tag: j && j.ab, geaendert: s.geaendert };
      const fern = !s.fassung1 && j && j.ferne && a.ok ? bisTag(j.ab, j.ferne.bis) : null;
      const antwort = {
        ok: a.ok, code: a.code, version: s.fassung1 ? 1 : s.version, kalender: 'Workout', tag: a.tag || null,
        geaendert: a.geaendert ?? null, stand: j && j.stand ? j.stand : null, seq: j ? j.seq : null,
        // Fassung 2 sagt, bis wann die Liste reicht, was noch offen ist und
        // bis wann der Kalender schon steht – wie kalender/workout-kalender.gs.
        ...(fern ? {
          offen: s.offen, bis: fern, stehen: s.offen ? s.stehen : fern, folge: s.offen ? s.folge : null,
        } : {}),
        ...(j && j.probe && s.probeStand ? s.probeStand : {}),
        ...(s.hinweis !== undefined ? { hinweis: s.hinweis } : a.hinweis ? { hinweis: a.hinweis } : {}),
      };
      await route.fulfill({ status: 200, contentType: 'application/json', headers: ACAO, body: JSON.stringify(antwort) });
    } catch { /* die Seite hat aufgegeben (Abbruch) – dann eben ohne Antwort */ }
  };
  s.vorschauen = () => s.anfragen.filter((a) => a.j && a.j.tage);
  s.proben = () => s.anfragen.filter((a) => a.j && a.j.probe);
  s.aus = () => s.anfragen.filter((a) => a.j && a.j.aus);
  s.letzte = () => { const v = s.vorschauen(); return v.length ? v[v.length - 1].j : null; };
  return s;
}

/* ------------------------------------------------------------------ *
 * Ein Gerät
 * ------------------------------------------------------------------ */

/** Wie kalZiel() in js/kalender-sync.js: welche Verbindung (FNV-1a über Adresse und Kennwort). */
const zielVon = (url, token) => {
  const s = `${url}\u0000${token}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
};

/**
 *   zustand   der Stand vor dem ersten Laden (Standard: Tobis vom 08.10.)
 *   kalender  state.kalender dazu – { token, url }
 *   fassung   ist es verbunden: welche Fassung des Skripts das Gerät aus
 *             früheren Antworten kennt (Standard 2 – ein Gerät, das schon
 *             lief); null: noch keine (erst v 1, dann gleich v 2, Abschnitt 13)
 *   meta      workout.kalender.v1 vor dem ersten Laden, statt `fassung`
 *   zeit      wo die Uhr steht (null: echte Uhr)
 *   sw        Service Worker zulassen
 */
async function geraet(name, {
  zustand = ZUSTAND, kalender = null, fassung = 2, meta: vorMeta = null, zeit = START, sw = false, adresse = APP, rechte = true,
} = {}) {
  const mt = vorMeta || (kalender && kalender.url && kalender.token && fassung !== null
    ? { fassung: { ziel: zielVon(kalender.url, kalender.token), version: fassung } } : null);
  const ctx = await browser.newContext({
    timezoneId: 'Europe/Berlin', viewport: { width: 414, height: 896 }, serviceWorkers: sw ? 'allow' : 'block',
  });
  offen.add(ctx);
  if (rechte && /^http/.test(adresse)) await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ORIGIN });
  // Ein Google-Cookie: Die App schickt ohne Cookies – sonst sähe Google einen
  // angemeldeten Fremden statt „Jeder".
  await ctx.addCookies([{ name: 'SID', value: 'angemeldet', domain: 'script.google.com', path: '/', secure: true, sameSite: 'None' }]);
  const skript = skriptAttrappe();
  await ctx.route(/^https:\/\/script\.google(?:usercontent)?\.com\//, skript.route);
  const rueck = [];
  await ctx.route(/supabase\.co\/|\/rest\/v1\//, (r) => {
    rueck.push({ url: r.request().url(), roh: r.request().postData() || '' });
    r.fulfill({ status: 204, body: '' });
  });
  await ctx.addInitScript(({ z, k, mt }) => {
    if (z && !sessionStorage.getItem('__test.zustand')) {
      sessionStorage.setItem('__test.zustand', '1');
      localStorage.setItem('workout.state.v1', JSON.stringify(k ? { ...z, kalender: k } : z));
    }
    if (mt && !sessionStorage.getItem('__test.meta')) {
      sessionStorage.setItem('__test.meta', '1');
      localStorage.setItem('workout.kalender.v1', JSON.stringify(mt));
    }
    // Sichtbarkeit steuerbar (wie tests/sicherung-labor.mjs).
    window.__hidden = false;
    Object.defineProperty(document, 'hidden', { get: () => window.__hidden, configurable: true });
    Object.defineProperty(document, 'visibilityState', { get: () => (window.__hidden ? 'hidden' : 'visible'), configurable: true });
    // Jede Meldung auf dem Bildschirm mitschreiben.
    window.__toasts = [];
    document.addEventListener('DOMContentLoaded', () => {
      const t = document.getElementById('toast');
      if (t) new MutationObserver(() => window.__toasts.push(t.textContent)).observe(t, { childList: true, characterData: true, subtree: true });
    });
    // Background Sync ist im Chromium ohne Oberfläche abgeschaltet: anmelden
    // geht hier, ausgelöst wird per CDP (Abschnitt 9).
    window.__sync = [];
    if (window.SyncManager) {
      window.SyncManager.prototype.register = function register(tag) { window.__sync.push(tag); return Promise.resolve(); };
    }
    // Was an den Worker geht (Abschnitt 7): nur, ob Kennwort oder Adresse darin stehen.
    window.__anWorker = [];
    if (window.Worker) {
      const post = window.Worker.prototype.postMessage;
      window.Worker.prototype.postMessage = function postMessage(m, ...rest) {
        try {
          const s = JSON.stringify(m);
          window.__anWorker.push({ geheim: /Testkennwort|AKfycbTest|script\.google/.test(s), zustand: !!(m && m.zustand) });
        } catch { /* nur mitschreiben */ }
        // Abschnitt 13: ein Worker, der die Ferne nicht kennt (wie aus einem älteren Zwischenspeicher).
        const an = window.__ohneFerne && m && typeof m === 'object' && 'ferne' in m ? { ...m, ferne: 0 } : m;
        return post.call(this, an, ...rest);
      };
      // Abschnitt 15: Die Ferne scheitert beim Rechnen – der Worker meldet,
      // was rechnen() in js/kalender-vorschau.js dann meldet: die Nähe allein
      // (v 1) und fernFehler.
      const hoeren = window.Worker.prototype.addEventListener;
      window.Worker.prototype.addEventListener = function addEventListener(typ, fn, ...rest) {
        if (typ !== 'message') return hoeren.call(this, typ, fn, ...rest);
        return hoeren.call(this, typ, (e) => {
          const d = e && e.data;
          // … oder die Rechnung musste die Ferne kürzen (gekuerzt), weil die
          // Sendung sonst zu groß würde.
          if (window.__gekuerzt && d && d.ok && d.vorschau && d.vorschau.ferne) {
            const v = { ...d.vorschau, ferne: { ...d.vorschau.ferne, bis: window.__gekuerzt }, gekuerzt: window.__gekuerzt };
            return fn({ data: { ...d, vorschau: v } });
          }
          if (window.__fernKaputt && d && d.ok && d.vorschau && d.vorschau.ferne) {
            const v = { ...d.vorschau, v: 1, fernFehler: 'Ferne am Tag 3 nicht genau kodierbar' };
            delete v.ferne;
            delete v.gekuerzt;
            const nah = new Set(Object.values(v.tage).flat().map((x) => x[3]));
            v.texte = Object.fromEntries(Object.entries(v.texte).filter(([h]) => nah.has(h)));
            return fn({ data: { ...d, vorschau: v } });
          }
          return fn(e);
        }, ...rest);
      };
    }
    // Lange Aufgaben im Fenster (Abschnitt 10).
    window.__lang = [];
    try {
      new window.PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lang.push({ start: e.startTime, dauer: e.duration })))
        .observe({ type: 'longtask', buffered: true });
    } catch { /* kein longtask */ }
  }, { z: zustand, k: kalender, mt });
  const page = await ctx.newPage();
  page.setDefaultTimeout(6000);
  const konsole = [];
  page.on('console', (m) => konsole.push(m.text()));
  page.on('pageerror', (e) => seitenFehler.push(`${name}: ${e.message}`));
  page.on('dialog', (d) => d.accept().catch(() => {}));
  if (zeit !== null) {
    await page.clock.install({ time: zeit });
    await page.clock.pauseAt(zeit + 1000);
  }
  await page.goto(adresse, { waitUntil: 'load' });
  return { ctx, page, skript, rueck, konsole, name };
}

async function zu(g) {
  offen.delete(g.ctx);
  await g.ctx.close().catch(() => {});
}

/** Uhr vorstellen und dem, was dabei startet (Worker, Netz), echte Zeit lassen. */
async function vor(page, ms, danach = 700) {
  if (ms) await page.clock.fastForward(ms);
  await echteWarte(danach);
}

/** Warten, bis `fn()` stimmt – höchstens `ms` echte Zeit. */
async function bis(fn, ms = 8000) {
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    if (await fn()) return true;
    await echteWarte(100);
  }
  return !!(await fn());
}

const text = async (page, sel = '#view') => ((await page.locator(sel).first().textContent().catch(() => '')) || '').replace(/\s+/g, ' ');
const zuMehr = async (page) => { await page.locator('.tab[data-tab="settings"]').click(); await echteWarte(150); };
const zumDashboard = async (page) => { await page.locator('.tab[data-tab="dashboard"]').click(); await echteWarte(150); };
const kal = (page) => page.evaluate(() => (JSON.parse(localStorage.getItem('workout.state.v1') || '{}').kalender) || null);
// Was der Store gerade hält (geschrieben wird 120 ms später – mit stehender Uhr erst beim Wegschalten).
const kalJetzt = (page) => page.evaluate(async () => (await import('./js/store.js')).kalender());
const meta = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('workout.kalender.v1') || '{}'));
const diagZeilen = (page) => page.evaluate(async () => (await import('./js/diagnose.js')).diagnoseZeilen().map(String));
const verstecken = (page) => page.evaluate(() => { window.__hidden = true; document.dispatchEvent(new Event('visibilitychange')); });
const zeigen = (page) => page.evaluate(() => { window.__hidden = false; document.dispatchEvent(new Event('visibilitychange')); });
/** Die Startseite: Höhe der Zeile zum Jahr, Überhang, Fuß gegen die Leiste (wie tests/test-tagesabschluss.mjs 2). */
const seiteMessen = (page) => page.evaluate(() => {
  const leiste = document.getElementById('tabbar').getBoundingClientRect();
  const fuss = document.querySelector('.ov-foot').getBoundingClientRect();
  const z = document.getElementById('kalenderJahrZeile');
  return {
    zeile: z ? Math.round(z.getBoundingClientRect().height) : 0,
    scroll: document.documentElement.scrollHeight - window.innerHeight,
    fussUnten: Math.round(fuss.bottom),
    sichtbar: Math.round(Math.min(window.innerHeight, leiste.height ? leiste.top : window.innerHeight)),
  };
});
/** Liegt die Überschrift der Bitte um neuen Code frei – nicht unter der Kopfleiste? */
const ueberschriftFrei = (page) => page.evaluate(() => {
  const s = document.querySelector('#kalenderJahr strong');
  const r = s.getBoundingClientRect();
  const da = document.elementFromPoint(r.left + 4, r.top + r.height / 2);
  return {
    frei: !!da && !da.closest('.topbar') && s.contains(da), oben: Math.round(r.top),
    leiste: Math.round(document.querySelector('.topbar').getBoundingClientRect().bottom),
  };
});

/** Einen Satz in der Einheit von heute abhaken (wie ein Tipp, ohne Oberfläche). */
const haken = (page, satz = 0, n = null) => page.evaluate(async ({ satz: i, n: nr }) => {
  const store = await import('./js/store.js');
  const { workoutByNo } = await import('./js/plan.js');
  const { naechsteEinheit } = await import('./js/tagstart.js');
  const einheit = nr ?? naechsteEinheit();
  const mode = store.workoutMode(einheit);
  const ex = workoutByNo(einheit, mode).ex[0];
  store.updateSet(einheit, mode, ex.id, ex.sets, i, { done: true, w: '20' }, ex.nach || 0);
  return einheit;
}, { satz, n });

/** Die Einheit fertig – wie mit dem letzten Haken (completeWorkout, markDone). */
const fertig = (page, n) => page.evaluate(async (nr) => {
  const store = await import('./js/store.js');
  const { workoutByNo } = await import('./js/plan.js');
  const mode = store.workoutMode(nr);
  store.completeWorkout(nr, mode, workoutByNo(nr, mode).ex.map((x) => ({ id: x.id, sets: x.sets, nach: x.nach || 0, w: '20' })));
  store.markDone(nr, mode);
}, n);

/** Der Eintrag einer Einheit in der Tagesliste `tag` einer Nutzlast. */
const eintrag = (j, tag, n) => ((j && j.tage && j.tage[tag]) || []).find((e) => new RegExp(`-${n}$`).test(e[0]) && !/-z\d+$/.test(e[0]));

async function verbinden(page, url, warten = true) {
  // Verbunden steht das Feld zugeklappt unter „Neues Skript-Projekt?".
  if (!(await page.locator('#kalenderUrl').isVisible()) && await page.locator('#kalenderNeuKnopf').count()) {
    await page.locator('#kalenderNeuKnopf').click();
  }
  await page.locator('#kalenderUrl').fill(url);
  await page.locator('[data-act="kalender-verbinden"]').click();
  if (warten) {
    await bis(async () => {
      const m = await text(page, '#kalenderMeldung');
      return m && !/Frage das Skript/.test(m);
    });
  }
  return text(page, '#kalenderMeldung');
}

async function abschnitt(nr, fn) {
  if (nur.length && !nur.includes(String(nr))) return;
  try {
    await fn();
  } catch (e) {
    check(false, `${nr} abgebrochen: ${String(e.message || e).split('\n')[0]}`);
    for (const ctx of offen) await ctx.close().catch(() => {});
    offen.clear();
  }
}

const geheim = (s, token = TOKEN) => [token, 'AKfycbTest', 'script.google.com', 'script.google'].filter((x) => x && String(s).includes(x));

/* ================================================================== *
 * 1. Die Karte und „Code kopieren"
 * ================================================================== */
await abschnitt(1, async () => {
  const g = await geraet('1 Karte');
  const { page, skript } = g;
  await vor(page, 4000);
  await zuMehr(page);
  check(await page.locator('#kalenderAuto').count() === 1, 'unter Mehr → Kalender steht die Karte „Google Kalender automatisch"');
  const k = await text(page, '#kalenderAuto');
  check(/Google Kalender automatisch/.test(k) && /„Workout"/.test(k) && /17:30/.test(k),
    'sie nennt den eigenen Kalender „Workout" und 17:30');
  check(/auch wenn du die App nicht öffnest/.test(k) && /nicht trainierst/.test(k),
    'sie sagt, dass es auch ohne geöffnete App verschiebt – gerechnet mit „nicht trainiert"');
  check(/An Google geht nur, was im Kalender steht/.test(k) && /Titel, Übungen, Tage und Uhrzeit/.test(k) && /dein eigenes Konto/.test(k),
    'was an Google geht: Titel, Übungen, Zeiten – in sein eigenes Konto');
  check(/alle deine Kalender/.test(k) && /nur „Workout" an/.test(k) && /Regel in seinem Code, keine Sperre/.test(k),
    'Google fragt nach allen Kalendern, das Skript fasst nur „Workout" an – als Regel des Codes, nicht als Sperre');
  check(/ohne Netz/.test(k) && /schiebt er das Training womöglich/.test(k),
    'die Grenze: ohne Netz trainiert kann der Kalender bis zur nächsten Sendung falsch schieben');
  const schritte = await page.locator('#kalenderSchritte li').allTextContents();
  check(schritte.length === 6, `sechs nummerierte Schritte (${schritte.length})`);
  const s = schritte.join(' | ').replace(/\s+/g, ' ');
  check(/Code kopieren/.test(schritte[0] || '') && /Desktopwebsite/.test(s) && /einrichten/.test(s) && /Ausführen/.test(s)
    && /Neue Version/.test(s) && /„Zugriff: Jeder"/.test(s) && /„Ausführen als: Ich"/.test(s) && /\/exec/.test(s) && /Verbinden/.test(s),
    'darin: Code kopieren, Desktopwebsite, einrichten ausführen, Neue Version, „Zugriff: Jeder", URL einfügen, Verbinden');
  check(await page.locator('[data-act="kalender-code"]').count() === 1 && await page.locator('#kalenderUrl').count() === 1
    && await page.locator('[data-act="kalender-verbinden"]').count() === 1, 'Knopf „Code kopieren", URL-Feld und „Verbinden"');
  check(await page.locator('#kalenderUhrzeit').count() === 0 && await page.locator('[data-act="kalender-trennen"]').count() === 0,
    'Uhrzeit und Trennen erst, wenn verbunden – vorher gibt es nichts einzustellen');
  check((await kal(page)) === null, 'vor dem ersten Kopieren gibt es kein Kennwort');
  // Die Schritte gleich nach dem ersten Absatz; was an Google geht und die
  // Grenzen zugeklappt darunter (vorher standen sie mit rund 200 Wörtern davor).
  const aufbau = await page.evaluate(() => {
    const karte = document.getElementById('kalenderAuto');
    const schritte = document.getElementById('kalenderSchritte');
    const wer = document.getElementById('kalenderWer');
    const box = document.getElementById('kalenderMehr');
    return {
      oben: schritte.getBoundingClientRect().top - karte.getBoundingClientRect().top,
      danach: !!(schritte.compareDocumentPosition(wer) & window.Node.DOCUMENT_POSITION_FOLLOWING),
      zu: !!box && box.hidden && box.contains(wer) && box.contains(document.getElementById('kalenderGrenze')),
      hoehe: karte.getBoundingClientRect().height,
      haupt: [...karte.querySelectorAll('.btn-primary')].map((b) => b.textContent.trim()),
    };
  });
  console.log(`     Karte vor dem Einrichten: ${Math.round(aufbau.hoehe)} px hoch, Schritte ${Math.round(aufbau.oben)} px unter dem Kopf`);
  check(aufbau.zu && aufbau.danach && aufbau.oben < 320,
    `die Schritte stehen gleich nach dem ersten Absatz (${Math.round(aufbau.oben)} px unter dem Kopf); „Was an Google geht · Grenzen" zugeklappt darunter`);
  check(aufbau.haupt.length === 1 && aufbau.haupt[0] === 'Code kopieren', `vor dem Kopieren genau ein Hauptknopf: „Code kopieren" (${aufbau.haupt.join(', ')})`);
  await page.locator('#kalenderMehrKnopf').click();
  check(await page.locator('#kalenderWer').isVisible() && await page.locator('#kalenderGrenze').isVisible(),
    'aufgeklappt: was an Google geht und die Grenzen');
  await page.locator('#kalenderMehrKnopf').click();
  await page.locator('#kalenderAuto').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOT}/kalender-karte-einrichten.png` });

  // --- Code kopieren ---------------------------------------------------
  await page.locator('[data-act="kalender-code"]').click();
  await bis(async () => /Code kopiert/.test(await text(page, '#kalenderMeldung')));
  const k1 = await kal(page);
  const code1 = await page.evaluate(() => navigator.clipboard.readText());
  check(!!k1 && /^[A-Za-z0-9_-]{43}$/.test(k1.token || '') && k1.url === null,
    'das Kennwort steht danach im Speicher (localStorage, nicht nur im Arbeitsspeicher): 256 Bit, base64url');
  check(code1 === VORLAGE.replace(PLATZHALTER, k1.token),
    'der kopierte Code ist die Vorlage mit genau diesem Kennwort an der Stelle des Platzhalters');
  check(!code1.includes(PLATZHALTER) && code1.split(k1.token).length === 2 && code1.includes(`const TOKEN = '${k1.token}';`),
    'kein Platzhalter mehr, das Kennwort genau einmal, in der Zeile const TOKEN');
  check(/^const FASSUNG = 2;$/m.test(code1), 'die Fassung des Skripts steht lesbar darin (2)');
  check(/Code kopiert/.test(await text(page, '#kalenderMeldung')) && await page.locator('#kalenderKennwort').count() === 1,
    'die Karte sagt „Code kopiert" und dass das Kennwort fest gespeichert ist');
  check((await page.locator('#kalenderAuto .btn-primary').allTextContents()).map((x) => x.trim()).join() === 'Verbinden',
    'mit Kennwort ist „Verbinden" der Hauptknopf');
  await page.locator('[data-act="kalender-code"]').click();
  await echteWarte(300);
  const code2 = await page.evaluate(() => navigator.clipboard.readText());
  check(code2 === code1 && (await kal(page)).token === k1.token, 'ein zweites Kopieren gibt denselben Code – kein neues Kennwort');
  await page.reload({ waitUntil: 'load' });
  await vor(page, 4000);
  await zuMehr(page);
  check((await kal(page)).token === k1.token, 'nach dem Neuladen steht dasselbe Kennwort im Speicher');
  await page.locator('[data-act="kalender-code"]').click();
  await echteWarte(300);
  check(await page.evaluate(() => navigator.clipboard.readText()) === code1, 'und der Code ist derselbe – auch nach einem Neuladen');

  // --- Kopieren geht nicht: zum Abschreiben ------------------------------
  await page.evaluate(() => { navigator.clipboard.writeText = () => Promise.reject(new Error('nicht erlaubt')); });
  await page.locator('[data-act="kalender-code"]').click();
  await bis(async () => (await page.locator('#kalenderCodeText').count()) === 1);
  const feld = await page.locator('#kalenderCodeText').inputValue().catch(() => '');
  check(feld === code1 && /Kopieren ging nicht/.test(await text(page, '#kalenderMeldung')),
    'geht das Kopieren nicht, steht der Code markiert zum Abschreiben da – mit Satz');

  // --- Ohne Verbindung geht nichts hinaus -----------------------------
  await haken(page);
  await vor(page, 5 * 60 * 1000, 1200);
  check(skript.anfragen.length === 0, `mit Kennwort, aber ohne URL geht nichts an Google (${skript.anfragen.length} Anfragen)`);
  const toasts = await page.evaluate(() => window.__toasts);
  check(geheim(toasts.join(' '), k1.token).length === 0, 'keine Meldung nennt Kennwort oder Adresse');
  await zu(g);

  // Ganz ohne Einrichtung: weder Anfragen noch ein Kennwort.
  const h = await geraet('1 nie eingerichtet');
  await vor(h.page, 4000);
  await haken(h.page);
  await vor(h.page, 3 * 60 * 1000, 1000);
  await fertig(h.page, await haken(h.page, 1));
  await vor(h.page, 3 * 60 * 1000, 1000);
  check(h.skript.anfragen.length === 0 && (await kal(h.page)) === null,
    'nie eingerichtet: kein Training löst eine Anfrage aus, und es entsteht kein Kennwort');
  await zu(h);
});

/* ================================================================== *
 * 2. „Verbinden" – jede Fehlerart, dann die gelungene Probe
 * ================================================================== */
await abschnitt(2, async () => {
  const g = await geraet('2 Verbinden', { kalender: { token: TOKEN } });
  const { page, skript } = g;
  await vor(page, 4000);
  // Ein alter Export, damit der ICS-Hinweis etwas zu sagen hätte (Abschnitt 8).
  await page.evaluate(async () => {
    const store = await import('./js/store.js');
    store.setSetting('lastIcs', { on: '2026-10-01', shift: store.getState().shift - 3, seq: 4, count: 84 });
  });
  await zuMehr(page);

  const versuch = async (url, erwartet, was, anfragen = null) => {
    const vorher = skript.anfragen.length;
    const m = await verbinden(page, url);
    const neu = skript.anfragen.length - vorher;
    const k = await kal(page);
    check(erwartet.test(m) && k.url === null && await page.locator('#kalenderSchritte').count() === 1
      && (anfragen === null || neu === anfragen),
      `${was}: „${m.slice(0, 90)}…" – nicht verbunden${anfragen === null ? '' : `, ${neu} Anfrage(n)`}`);
    return m;
  };
  await versuch('', /Web-App-URL einfügen/, 'leeres Feld', 0);
  await versuch('https://script.google.com/macros/s/AKfycbTestEinsAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/dev', /Test-URL.*\/exec/, 'die Test-URL (…/dev)', 0);
  await versuch('https://script.google.com/home/projects/1AbCdEfGhIjKlMnOp/edit', /Editors.*Bereitstellungen verwalten/, 'die Adresse des Editors', 0);
  await versuch('https://script.googleusercontent.com/macros/echo?user_content_key=abc', /Weiterleitung/, 'die Weiterleitung', 0);
  await versuch('https://example.com/exec', /keine Web-App-URL von Google Apps Script/, 'eine fremde Adresse', 0);

  skript.modus = 'netz';
  await versuch(URL_A, /Kein Netz/, 'kein Netz');
  // Die Probe kommt undurchsichtig zurück (eine Seite ohne CORS). Die App
  // fragt dieselbe Adresse mit einem GET (doGet) und sagt die eine Ursache,
  // statt Tobi zwischen dreien wählen zu lassen.
  skript.modus = 'html';
  skript.get = 'alt';
  const mAlt = await versuch(URL_A, /Code der Probe/, 'undurchsichtig, doGet antwortet wie Tobis Probe', 3);
  check(/Neue Version/.test(mAlt) && !/Jeder mit Google-Konto/.test(mAlt) && !/Meist eins davon/.test(mAlt),
    '… dann nur „Neue Version bereitstellen" – keine drei Ursachen zur Wahl');
  skript.get = 'html';
  const mZu = await versuch(URL_A, /„Zugriff: Jeder"/, 'undurchsichtig, und auch doGet antwortet ohne CORS (Anmeldeseite)', 4);
  check(/Jeder mit Google-Konto/.test(mZu) && /„Ausführen als: Ich"/.test(mZu) && !/Code der Probe/.test(mZu) && !/Meist eins davon/.test(mZu),
    '… dann nur „Zugriff: Jeder" und „Ausführen als: Ich"');
  skript.get = 'status';
  await versuch(URL_A, /neue Code ist bereitgestellt.*[Nn]och einmal „Verbinden"/, 'undurchsichtig, doGet antwortet mit dem neuen Code', 3);
  skript.get = 'netz';
  const m = await versuch(URL_A, /nicht das Skript/, 'undurchsichtig, und doGet kommt gar nicht durch', 4);
  check(/Neue Version/.test(m) && /„Zugriff: Jeder"/.test(m) && /Jeder mit Google-Konto/.test(m) && /„Ausführen als: Ich"/.test(m) && /\/exec/.test(m),
    '… nur dann der lange Satz mit allen drei Ursachen: Neue Version, Zugriff „Jeder" statt „Jeder mit Google-Konto", Ausführen als „Ich", /exec');
  skript.get = 'status';
  skript.modus = 'kaputt';
  await versuch(URL_A, /HTTP 404.*stimmt die URL/, 'eine lesbare Fehlerseite');
  skript.modus = 'ok';
  skript.code = 'token';
  await versuch(URL_A, /kennt dieses Kennwort nicht.*Code kopieren.*Neue Version/, 'falsches Kennwort');
  skript.code = 'format';
  skript.hinweis = 'Die App ist neuer als dieses Skript – „Kalender-Code erneuern".';
  const mZuAlt = await versuch(URL_A, /Kalender-Code erneuern.*Neue Version/, 'zu alter Code');
  check(!/einrichten/.test(mZuAlt), '… ohne „einrichten" – Kalender und Auslöser bestehen schon');
  skript.code = null;
  skript.hinweis = undefined;
  // Keine Antwort: Die Probe hängt, nach 30 s gibt die App auf.
  let loslassen;
  skript.halten = new Promise((r) => { loslassen = r; });
  await verbinden(page, URL_A, false);
  await echteWarte(400);
  await vor(page, 31000, 600);
  await bis(async () => !/Frage das Skript/.test(await text(page, '#kalenderMeldung')));
  check(/Keine Antwort nach 30 Sekunden/.test(await text(page, '#kalenderMeldung')) && (await kal(page)).url === null,
    'keine Antwort: nach 30 s „noch einmal Verbinden" – nicht verbunden');
  skript.halten = null;
  loslassen();
  await echteWarte(300);

  // --- Jetzt richtig -------------------------------------------------
  // Vorher, noch ohne Verbindung, angefangen: Das Verbinden schickt die
  // Vorschau trotzdem genau einmal (nicht noch einmal als „erster Haken").
  await haken(page);
  await echteWarte(300);
  const vorher = skript.anfragen.length;
  // Die erste Vorschau hält das Skript kurz an – so lässt sich lesen, was die
  // Karte bis dahin sagt.
  let vorschauFrei;
  skript.haltenVorschau = new Promise((r) => { vorschauFrei = r; });
  const ok = await verbinden(page, `  ${URL_A}  `);
  check(/^Verbunden – die erste Vorschau ist unterwegs\./.test(ok) && /nach etwa einer Minute/i.test(ok) && !/Noch keine Vorschau/.test(ok)
    && /var\(--ok\)/.test(await page.locator('#kalenderMeldung').getAttribute('style') || ''),
  `verbunden: „${ok.slice(0, 80)}…" – grün, ohne den Satz der Probe („Noch keine Vorschau angekommen")`);
  check((await kal(page)).url === URL_A, 'die Adresse steht jetzt in state.kalender (ohne Leerzeichen)');
  skript.haltenVorschau = null;
  vorschauFrei();
  await bis(() => skript.vorschauen().length >= 1);
  // Kurz Zeit für eine zweite, die nicht kommen soll.
  await vor(page, 1000, 1500);
  const neu = skript.anfragen.slice(vorher);
  check(neu.length === 2 && neu[0].j && neu[0].j.probe === true && neu[1].j && neu[1].j.tage,
    `erst die Probe, dann gleich die erste Vorschau (${neu.length} Anfragen)`);
  const p = neu[0].j;
  check(Object.keys(p).sort().join(',') === 'geraet,gesendet,probe,seq,token,v' && p.token === TOKEN,
    'die Probe trägt nur v, token, geraet, seq, gesendet, probe');
  const v = neu[1];
  check(V.nutzlastPruefen(v.j) === null, `die Vorschau besteht nutzlastPruefen() aus dem Vertrag (${V.nutzlastPruefen(v.j)})`);
  check(v.j.token === TOKEN && v.j.minuten === 1050 && v.j.erinnerung === 30 && v.j.v === 2 && v.j.ferne && v.j.ferne.bis === 365,
    'mit dem Kennwort, 17:30 (1050) und 30 Minuten Erinnerung als Standard – und, weil die Probe Fassung 2 meldete, mit dem Jahr (v 2)');
  check(v.j.ab === HEUTE && Object.keys(v.j.tage).length === V.VORSCHAU_TAGE && v.j.fenster.join() === '7,28',
    `ab heute, 42 Tage, Fenster [7, 28] (${Object.keys(v.j.tage).length} Tage)`);
  check(Buffer.byteLength(v.roh, 'utf8') < V.VORSCHAU_MAX_BYTES, `${(Buffer.byteLength(v.roh) / 1024).toFixed(1)} KiB für ein Jahr – sogar unter den 64 KiB für keepalive`);
  const kopf = v.kopf;
  check(kopf['content-type'] === 'text/plain;charset=UTF-8', `Content-Type text/plain (${kopf['content-type']})`);
  const eigene = Object.keys(kopf).filter((h) => /^x-|^authorization$|^cookie$/i.test(h));
  check(eigene.length === 0, `keine eigenen Header, keine Cookies (${eigene.join(', ') || 'keine'})`);
  check(skript.anfragen.every((a) => a.methode === 'POST' || a.methode === 'GET') && neu.every((a) => a.methode === 'POST'),
    'POST, und GET nur zum Nachfragen nach einer undurchsichtigen Probe – kein OPTIONS, also kein Preflight');
  const m2 = await meta(page);
  check(/^[A-Za-z0-9_-]{4,64}$/.test(v.j.geraet || '') && v.j.geraet === m2.geraet && v.j.seq === m2.seq && v.j.seq > p.seq,
    `geraet und seq kommen aus workout.kalender.v1 (seq ${p.seq} → ${v.j.seq})`);
  await bis(async () => /Zuletzt angekommen/.test(await text(page, '#kalenderStand')));
  check(/Verbunden\. Zuletzt angekommen: gerade eben \(Skript Fassung 2\)\. Im Kalender: Termine bis 08\.10\.2027\./.test(await text(page, '#kalenderStand')),
    `die Karte sagt, wann es zuletzt ankam („${(await text(page, '#kalenderStand')).slice(0, 70)}")`);
  check(await page.locator('#kalenderMeldung').count() === 0,
    'sobald die erste Vorschau angekommen ist, sagt die Karte nur noch den Stand – kein „Noch keine Vorschau" mehr darunter');
  check(/Summary of failures/.test(await text(page, '#kalenderMail')) && /einrichten/.test(await text(page, '#kalenderMail')),
    'die Karte sagt, was eine Mail „Summary of failures" von Google bedeutet und was dann hilft');
  check(await page.locator('#kalenderAuto .btn-primary').count() === 0 && !(await page.locator('#kalenderUrl').isVisible())
    && await page.locator('#kalenderNeuKnopf').count() === 1,
  'verbunden: kein Hauptknopf, das Feld für ein neues Skript-Projekt zugeklappt');
  check(await page.locator('#kalenderUhrzeit').inputValue() === '17:30'
    && await page.locator('#kalenderErinnerung').inputValue() === '30', 'Uhrzeit 17:30 und Erinnerung 30 Minuten stehen fertig da');
  check(await page.locator('[data-act="kalender-trennen"]').count() === 1, 'dazu „Trennen"');
  await page.locator('#kalenderAuto').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOT}/kalender-karte-verbunden.png` });

  // --- 8. Der ICS-Hinweis ---------------------------------------------
  const ics = await text(page, '#view');
  check(/pflegt sich schon selbst/.test(ics) && /doppelt/.test(ics) && !/seit dem letzten Export um/.test(ics),
    '8: verbunden schweigt der ICS-Hinweis („um 3 Tage verschoben") – stattdessen: sonst doppelt');
  check(await page.locator('[data-act="download-ics"]').count() === 1, '8: die Kalenderdatei bleibt erreichbar');
  await zu(g);
});

/* ================================================================== *
 * 3. Der Takt
 * ================================================================== */
await abschnitt(3, async () => {
  const g = await geraet('3 Takt', { kalender: { token: TOKEN, url: URL_A } });
  const { page, skript } = g;
  await vor(page, 2000, 300);
  check(skript.anfragen.length === 0, 'in den ersten Sekunden nach dem Laden nichts – der Start hat Vorrang');
  await vor(page, 1500, 300);
  await bis(() => skript.vorschauen().length === 1);
  check(skript.vorschauen().length === 1, 'drei Sekunden nach dem Start: die Vorschau für heute');
  const erst = skript.letzte();
  const n = await page.evaluate(async () => (await import('./js/tagstart.js')).naechsteEinheit());
  const vorHaken = eintrag(erst, MORGEN, n);
  check(!!vorHaken && vorHaken[1] === MORGEN, `ohne Training stünde Workout ${n} morgen auf morgen (${vorHaken && vorHaken[1]})`);

  // Neuladen am selben Tag: dieselbe Vorschau – geht nicht noch einmal.
  await page.reload({ waitUntil: 'load' });
  await vor(page, 4000, 1500);
  check(skript.vorschauen().length === 1, 'Neuladen am selben Tag: dieselbe Vorschau geht nicht noch einmal hinaus');

  // Erster Haken: sofort.
  await haken(page);
  await bis(() => skript.vorschauen().length === 2, 4000);
  check(skript.vorschauen().length === 2, 'der erste Haken einer Einheit geht sofort hinaus – ohne die Uhr vorzustellen');
  const nachHaken = eintrag(skript.letzte(), MORGEN, n);
  check(!!nachHaken && nachHaken[1] === HEUTE && nachHaken[4] === 0,
    `und morgen steht Workout ${n} dann auf heute, offen – der Kalender schiebt es nicht als verpasst weiter`);
  check(skript.letzte().stand.saetze > erst.stand.saetze, 'mit dem neuen Trainingsstand (Sätze)');

  // Andere Änderungen kurz nach einer Sendung: gedrosselt auf höchstens eine
  // in zwei Minuten – und zwei Änderungen darin werden eine Sendung.
  const zahl = skript.vorschauen().length;
  await page.evaluate(async () => (await import('./js/store.js')).setSetting('injuries', ['schulter-impingement']));
  await echteWarte(500);
  check(skript.vorschauen().length === zahl, 'eine Beschwerde angehakt: nicht sofort');
  await vor(page, 2500, 1500);
  await vor(page, 5000, 600);
  check(skript.vorschauen().length === zahl, 'auch nicht nach dem Rechnen und fünf Sekunden – die letzte Sendung ist keine zwei Minuten her');
  await vor(page, 60 * 1000, 600);
  await page.evaluate(async () => (await import('./js/store.js')).setSetting('injuries', ['schulter-impingement', 'tennisarm']));
  await vor(page, 2500, 1500);
  check(skript.vorschauen().length === zahl, 'eine zweite Änderung nach einer Minute: weiter nichts');
  await vor(page, 60 * 1000, 1500);
  await bis(() => skript.vorschauen().length > zahl, 3000);
  await echteWarte(500);
  check(skript.vorschauen().length === zahl + 1, `zwei Minuten nach der letzten Sendung: genau eine für beide Änderungen (${skript.vorschauen().length - zahl})`);

  // Nach einer ruhigen Zeit: frühestens fünf Sekunden nach der Änderung.
  await vor(page, 5 * 60 * 1000, 600);
  const ruhig = skript.vorschauen().length;
  await page.evaluate(async () => (await import('./js/store.js')).setSetting('injuries', ['schulter-impingement']));
  await vor(page, 2500, 1500);
  check(skript.vorschauen().length === ruhig, 'nach einer ruhigen Zeit: nicht in den ersten Sekunden');
  await vor(page, 3000, 1000);
  await bis(() => skript.vorschauen().length > ruhig, 3000);
  check(skript.vorschauen().length === ruhig + 1, 'aber fünf Sekunden nach der Änderung');

  // Zweiter Haken derselben Einheit: Ab zwei Sätzen schließt der
  // Tagesabschluss sie morgen ab (ABSCHLUSS_AB) – die Vorschau für morgen ist
  // damit eine andere und geht gedrosselt hinaus. Die Uhr in Schritten: erst
  // rechnen lassen (der Worker rechnet in echter Zeit), dann die zwei Minuten
  // – in einem Sprung liefe der Zeitgeber der Drossel nie, und die Prüfung
  // bestünde auch mit einem kaputten gedrosselten Pfad.
  const vorZweitem = skript.vorschauen().length;
  await haken(page, 1);
  await vor(page, 2500, 1500);
  check(skript.vorschauen().length === vorZweitem, 'ein zweiter Haken: nicht sofort (kein erster Haken, kein Abschluss)');
  await vor(page, 2 * 60 * 1000, 1500);
  await bis(() => skript.vorschauen().length > vorZweitem, 3000);
  await echteWarte(300);
  const zweiter = skript.letzte();
  check(skript.vorschauen().length === vorZweitem + 1 && (eintrag(zweiter, MORGEN, n) || [])[4] === 1,
    `der zweite Haken geht gedrosselt hinaus: ab morgen steht Workout ${n} als abgeschlossen da (Tagesabschluss ab zwei Sätzen)`);
  const vorDrittem = skript.vorschauen().length;
  await haken(page, 2);
  await vor(page, 2500, 1500);
  await vor(page, 2 * 60 * 1000, 1500);
  await vor(page, 1000, 800);
  check(skript.vorschauen().length === vorDrittem, 'ein dritter Haken ändert am Kalender nichts – nichts geht hinaus');

  // Abschluss: sofort, mit „fertig".
  const vorAbschluss = skript.vorschauen().length;
  await fertig(page, n);
  await bis(() => skript.vorschauen().length > vorAbschluss, 4000);
  const abg = skript.letzte();
  const heute = eintrag(abg, HEUTE, n);
  check(skript.vorschauen().length === vorAbschluss + 1 && !!heute && heute[4] === 1,
    `der Abschluss geht sofort hinaus: Workout ${n} heute mit fertig = 1`);
  check(abg.stand.einheiten === erst.stand.einheiten + 1, `Trainingsstand: ${erst.stand.einheiten} → ${abg.stand.einheiten} Einheiten`);

  // Wegschalten: nur, was fertig gerechnet bereitliegt.
  const vorWeg = skript.vorschauen().length;
  await verstecken(page);
  await echteWarte(800);
  check(skript.vorschauen().length === vorWeg, 'Wegschalten ohne fertige Vorschau: nichts');
  await zeigen(page);
  await page.evaluate(async () => (await import('./js/store.js')).setSetting('injuries', []));
  await vor(page, 2500, 1500);
  check(skript.vorschauen().length === vorWeg, 'eine Änderung ist gerechnet, wartet aber auf die Drossel');
  await verstecken(page);
  await bis(() => skript.vorschauen().length > vorWeg, 3000);
  check(skript.vorschauen().length === vorWeg + 1, 'beim Wegschalten geht die fertige Vorschau sofort hinterher');
  const keepalive = async () => (await diagZeilen(page)).filter((z) => / kalender was=vorschau .*keepalive=true/.test(z));
  await bis(async () => (await keepalive()).length > 0, 3000);
  const weg = await keepalive();
  check(weg.length === 1, `mit keepalive (${weg.length} Zeile im Diagnoseprotokoll)`);
  await zeigen(page);

  // Ohne Netz: beim nächsten „online" nachgeholt.
  skript.modus = 'netz';
  const vorNetz = skript.vorschauen().length;
  await page.evaluate(async () => (await import('./js/store.js')).setSetting('injuries', ['ac-gelenk']));
  await vor(page, 2500, 800);
  await vor(page, 2 * 60 * 1000, 1500);
  await bis(() => skript.vorschauen().length > vorNetz, 3000);
  check((await meta(page)).offen === true && (await meta(page)).letzte.ergebnis === 'netz', 'ohne Netz: vermerkt, der Versuch steht offen');
  await zuMehr(page);
  check(/Kein Netz – geht hinaus, sobald wieder welches da ist/.test(await text(page, '#kalenderStand')),
    'die Karte sagt es, ohne Alarm');
  await zumDashboard(page);
  check(await page.locator('#kalenderZeile').count() === 0, 'auf dem Dashboard steht dazu nichts – das richtet sich selbst');
  skript.modus = 'ok';
  const vorOnline = skript.vorschauen().length;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await bis(() => skript.vorschauen().length > vorOnline, 4000);
  check(skript.vorschauen().length === vorOnline + 1 && (await meta(page)).offen === false, '„online": sofort nachgeholt');

  // Am nächsten Tag: eine neue Vorschau beim Start.
  const vorMorgen = skript.vorschauen().length;
  await page.clock.setSystemTime(Date.parse('2026-10-09T07:00:00+02:00'));
  await page.reload({ waitUntil: 'load' });
  await vor(page, 4000, 1500);
  await bis(() => skript.vorschauen().length > vorMorgen, 3000);
  check(skript.vorschauen().length === vorMorgen + 1 && skript.letzte().ab === MORGEN,
    `am nächsten Tag geht beim Start eine neue Vorschau hinaus, ab ${skript.letzte().ab}`);
  // Ohne Netz geht dieselbe Sendung zweimal hinaus (mit und ohne CORS) – eine Sendung, ein seq.
  const seqs = [...new Set(skript.vorschauen().map((a) => a.j.seq))];
  check(seqs.every((x, i) => i === 0 || x > seqs[i - 1]), `seq steigt mit jeder Sendung (${seqs.join(', ')})`);
  check(new Set(skript.vorschauen().map((a) => a.j.geraet)).size === 1, 'immer dieselbe Gerätekennung');
  // Was an den Worker ging (seit dem letzten Neuladen): der Zustand, ohne die Verbindung.
  const anWorker = await page.evaluate(() => window.__anWorker || []);
  check(anWorker.length >= 1 && anWorker.every((x) => x.zustand && !x.geheim),
    `an den Worker geht der Zustand ohne die Verbindung – weder Kennwort noch Adresse (${anWorker.length} Auftrag/Aufträge)`);
  await zu(g);

  // Die Pause (Start, Ende, „+30 s" – store.setRest()) ändert am Kalender
  // nichts: Die Vorschau liest state.rest nicht. Bis zur Prüfung des Entwurfs
  // rechnete jede davon die Vorschau samt Jahr neu – der erste Haken mit Pause
  // zweimal, das Pausenende noch einmal (13 statt 6 Rechnungen für sechs Sätze).
  const p = await geraet('3 Pause', { kalender: { token: TOKEN, url: URL_A } });
  await vor(p.page, 4000, 1500);
  await bis(() => p.skript.vorschauen().length === 1);
  const auftraege = () => p.page.evaluate(() => (window.__anWorker || []).filter((x) => x.zustand).length);
  const pause = (art) => p.page.evaluate(async (a) => {
    const store = await import('./js/store.js');
    const r = store.getState().rest;
    if (a === 'start') store.setRest({ endsAt: Date.now() + 90000, total: 90, next: 'Satz 2', ex: null });
    else if (a === 'plus') store.setRest({ ...r, endsAt: r.endsAt + 30000, total: r.total + 30 });
    else store.setRest(null);
  }, art);
  const a0 = await auftraege();
  await haken(p.page);
  await pause('start');
  await bis(() => p.skript.vorschauen().length === 2, 4000);
  await vor(p.page, 2500, 1500);
  const a1 = await auftraege();
  await pause('plus');
  await vor(p.page, 2500, 1500);
  await pause('ende');
  await vor(p.page, 2500, 1500);
  const a2 = await auftraege();
  await haken(p.page, 1);
  await pause('start');
  await vor(p.page, 2500, 1500);
  const a3 = await auftraege();
  check(p.skript.vorschauen().length === 2 && a1 - a0 === 1 && a2 === a1 && a3 - a2 === 1,
    `die Pause rechnet nicht neu: erster Haken samt Pausenstart ${a1 - a0} Rechnung, „+30 s" und Pausenende ${a2 - a1}, `
      + `zweiter Haken samt Pausenstart ${a3 - a2} – je Satz eine statt zwei`);
  await zu(p);
});

/* ================================================================== *
 * 4. Die Antworten
 * ================================================================== */
await abschnitt(4, async () => {
  const g = await geraet('4 Antworten', { kalender: { token: TOKEN, url: URL_A } });
  const { page, skript } = g;
  await vor(page, 4000, 1500);
  await bis(() => skript.vorschauen().length === 1);
  // Eine Sendung, an der Drossel vorbei, und warten, bis ihr Ergebnis vermerkt ist.
  const jetzt = async () => {
    const vorher = ((await meta(page)).letzte || {}).zeit || 0;
    await page.evaluate(async () => (await import('./js/kalender-sync.js')).kalenderJetzt('test', { zwingen: true }));
    await bis(async () => (((await meta(page)).letzte || {}).zeit || 0) !== vorher, 5000);
    await page.clock.fastForward(1000);
    await echteWarte(200);
  };
  const lage = async () => {
    await zumDashboard(page);
    const dash = await page.locator('#kalenderZeile').count() === 1 ? await text(page, '#kalenderZeile') : '';
    await zuMehr(page);
    return { dash, karte: await text(page, '#kalenderAuto') };
  };

  skript.code = 'aelter';
  skript.hinweis = 'Ein anderes Gerät hat zuletzt trainiert – der Kalender bleibt bei dessen Plan.';
  await jetzt();
  let l = await lage();
  check(/anderes Gerät hat zuletzt trainiert/.test(l.karte) && /Sobald du hier trainierst/.test(l.karte) && !l.dash,
    'ein anderes Gerät hat zuletzt trainiert: die Karte sagt es, das Dashboard nicht – es gibt nichts zu tun');

  skript.code = 'token';
  skript.hinweis = 'Das Kennwort passt nicht – in der App „Code kopieren" und in Apps Script alles ersetzen.';
  await jetzt();
  l = await lage();
  check(/Google Kalender: Das Skript kennt dieses Kennwort nicht\./.test(l.dash), `falsches Kennwort: eine Zeile auf dem Dashboard („${l.dash.slice(0, 60)}")`);
  check(/Code kopieren.*Neue Version/.test(l.karte), 'und unter Mehr, was zu tun ist');
  await zumDashboard(page);
  await page.locator('[data-act="kalender-ansehen"]').click();
  await echteWarte(200);
  check(await page.locator('#kalenderAuto').isVisible(), '„Ansehen" führt zur Karte unter Mehr');

  skript.code = null;
  skript.hinweis = undefined;
  skript.version = 1;
  await jetzt();
  l = await lage();
  await zumDashboard(page);
  const jahrZeile = await page.locator('#kalenderJahrZeile').count() === 1 ? await text(page, '#kalenderJahrZeile') : '';
  await zuMehr(page);
  check(!l.dash && /Ein Jahr im Voraus geht jetzt/.test(jahrZeile) && await page.locator('#kalenderJahr').count() === 1
    && await page.locator('#kalenderErneuern').count() === 0,
  'das Skript meldet eine ältere Fassung als die Vorlage: keine Warnzeile – es läuft ja –, aber einmal dezent die Bitte um das Jahr, und auf der Karte die Schritte');
  check(/Bereitstellungen verwalten → Bearbeiten \(Stift\) → Version: Neue Version/.test(l.karte), 'mit „Bereitstellungen verwalten → Bearbeiten → Neue Version"');
  skript.version = 2;
  await jetzt();
  skript.geaendert = null;
  skript.hinweis = 'Der Kalender „Workout" fehlt (gelöscht?). In Apps Script „einrichten" noch einmal ausführen.';
  await jetzt();
  l = await lage();
  check(/Workout" fehlt/.test(l.karte) && /einrichten/.test(l.dash),
    'angekommen, aber der Kalender fehlt: der Satz des Skripts steht da, und das Dashboard sagt es');

  // Abgeglichen, aber ohne stündlichen Auslöser: verschiebt nicht, solange die
  // App zu ist – auch das gehört aufs Dashboard.
  skript.geaendert = 0;
  skript.hinweis = 'Den stündlichen Auslöser konnte das Skript nicht prüfen – in Apps Script „einrichten" ausführen.';
  await jetzt();
  l = await lage();
  check(/stündlichen Auslöser/.test(l.dash) && /einrichten/.test(l.karte),
    'abgeglichen, aber der Auslöser ist nicht sicher: Dashboard und Karte sagen „einrichten"');

  skript.geaendert = 2;
  skript.hinweis = undefined;
  // Eine undurchsichtige Antwort, nachdem es mit dieser Verbindung schon
  // geklappt hat: meist ein Aussetzer bei Google. Erst wiederholen, dann Alarm.
  skript.modus = 'html';
  await jetzt();
  l = await lage();
  check(!l.dash && /nicht das Skript/.test(l.karte) && /gleich noch einmal/.test(l.karte),
    'eine undurchsichtige Antwort im Alltag: erst nur unter Mehr, mit „versucht es gleich noch einmal" – noch kein Alarm');
  const vorWieder = skript.anfragen.length;
  for (const min of [2, 5, 15]) {
    const n0 = skript.anfragen.length;
    await vor(page, min * 60 * 1000 + 1000, 400);
    await bis(() => skript.anfragen.length >= n0 + 2, 4000);
    await echteWarte(300);
  }
  l = await lage();
  check(skript.anfragen.length - vorWieder === 6 && /nicht das Skript/.test(l.dash),
    `nach drei Wiederholungen (2, 5 und 15 Minuten) weiter undurchsichtig: jetzt auf das Dashboard (${(skript.anfragen.length - vorWieder) / 2} Wiederholungen)`);

  skript.modus = 'ok';
  await jetzt();
  l = await lage();
  check(!l.dash && /Zuletzt angekommen/.test(l.karte), 'wieder angekommen: die Zeile ist weg');

  // „fehler" (das Skript ist beschäftigt – der stündliche Abgleich hält die
  // Sperre bis zu vier Minuten) und „zeit" (die Antwort blieb aus): Die App
  // schickt dieselbe Vorschau von selbst noch einmal, ohne dass sich etwas
  // ändert. Bis v245-Entwurf ging sie bei bestehendem Netz nie wieder hinaus.
  for (const art of ['fehler', 'zeit']) {
    await vor(page, 20 * 60 * 1000, 300);
    let loslassen = null;
    if (art === 'fehler') {
      skript.code = 'fehler';
      skript.hinweis = 'Das Skript ist gerade beschäftigt – die App schickt es später noch einmal.';
      await jetzt();
    } else {
      skript.halten = new Promise((r) => { loslassen = r; });
      const lauf = page.evaluate(async () => (await import('./js/kalender-sync.js')).kalenderJetzt('test', { zwingen: true }));
      await echteWarte(600);
      await vor(page, 46 * 1000, 300);
      await lauf;
      skript.halten = null;
      loslassen();
      await echteWarte(300);
    }
    const m = await meta(page);
    check(m.letzte.ergebnis === art && m.offen === true, `„${art}": vermerkt, der Versuch steht offen`);
    skript.code = null;
    skript.hinweis = undefined;
    const n0 = skript.vorschauen().length;
    await vor(page, 60 * 1000, 800);
    check(skript.vorschauen().length === n0, `„${art}": nicht sofort hinterher`);
    await vor(page, 61 * 1000, 400);
    await bis(() => skript.vorschauen().length > n0, 4000);
    await echteWarte(300);
    const m2 = await meta(page);
    check(skript.vorschauen().length === n0 + 1 && m2.letzte.ergebnis === 'angekommen' && m2.offen === false,
      `„${art}": zwei Minuten danach geht sie von selbst noch einmal hinaus – ohne neue Änderung – und kommt an`);
    await vor(page, 20 * 60 * 1000, 800);
    check(skript.vorschauen().length === n0 + 1, `„${art}": danach nichts mehr – angekommen ist angekommen`);
  }
  l = await lage();
  check(!l.dash, '„fehler" und „zeit", die sich von selbst richten: nichts auf dem Dashboard');

  // Bleibt es bei „fehler" – auch nach drei Wiederholungen –, ist das kein
  // Beschäftigtsein mehr: dann aufs Dashboard.
  skript.code = 'fehler';
  skript.hinweis = 'Unerwarteter Fehler im Skript: TypeError: x is undefined';
  await jetzt();
  for (const min of [2, 5, 15]) {
    const n0 = skript.vorschauen().length;
    await vor(page, min * 60 * 1000 + 1000, 400);
    await bis(() => skript.vorschauen().length > n0, 4000);
    await echteWarte(300);
  }
  l = await lage();
  check(/Unerwarteter Fehler/.test(l.dash) && /Diagnoseprotokoll/.test(l.karte),
    '„fehler" auch nach drei Wiederholungen: jetzt auf das Dashboard, und die Karte bittet um das Diagnoseprotokoll');
  skript.code = null;
  skript.hinweis = undefined;
  await zu(g);
});

/* ================================================================== *
 * 5. Uhrzeit und Erinnerung
 * ================================================================== */
await abschnitt(5, async () => {
  const g = await geraet('5 Uhrzeit', { kalender: { token: TOKEN, url: URL_A } });
  const { page, skript } = g;
  await vor(page, 4000, 1500);
  await bis(() => skript.vorschauen().length === 1);
  await zuMehr(page);
  await page.locator('#kalenderUhrzeit').fill('18:15');
  await bis(() => skript.vorschauen().length === 2, 4000);
  check((await kal(page)).minuten === 18 * 60 + 15 && skript.letzte().minuten === 1095,
    'eine neue Uhrzeit steht in state.kalender und geht sofort hinaus (1095 = 18:15)');
  const t = await page.evaluate(() => window.__toasts);
  check(t.some((x) => /18:15/.test(x)) && geheim(t.join(' ')).length === 0, 'die Meldung nennt die Uhrzeit – sonst nichts');
  check(/um 18:15/.test(await text(page, '#kalenderWas')), 'die Karte nennt jetzt 18:15');
  await page.locator('#kalenderErinnerung').selectOption('60');
  await bis(() => skript.vorschauen().length === 3, 4000);
  check((await kal(page)).erinnerung === 60 && skript.letzte().erinnerung === 60, 'Erinnerung 60 Minuten: gespeichert und sofort hinaus');
  await page.locator('#kalenderErinnerung').selectOption('0');
  await bis(() => skript.vorschauen().length === 4, 4000);
  check(skript.letzte().erinnerung === 0, 'keine Erinnerung (0)');
  // Bei 360 px Breite (kleines Android) passt jede Erinnerung ins Feld – vorher stand dort „30 Min. vorhe".
  await page.setViewportSize({ width: 360, height: 740 });
  await echteWarte(200);
  const passt = await page.evaluate(() => {
    const sel = document.getElementById('kalenderErinnerung');
    const cs = getComputedStyle(sel);
    const c = document.createElement('canvas').getContext('2d');
    c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    // Platz für den Text: das Feld ohne Innenabstand und ohne den Pfeil (rund 20 px).
    const platz = sel.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 20;
    return { platz: Math.round(platz), o: [...sel.options].map((o) => ({ t: o.text, b: Math.round(c.measureText(o.text).width) })) };
  });
  check(passt.o.every((x) => x.b <= passt.platz),
    `bei 360 px passt jede Erinnerung ins Feld (${passt.platz} px Platz: ${passt.o.map((x) => `${x.t} ${x.b}`).join(', ')})`);
  await page.setViewportSize({ width: 414, height: 896 });
  // „Code kopieren" im verbundenen Zustand: Die nummerierten Schritte gibt es
  // hier nicht – der Satz nennt, was beim Erneuern zu tun ist.
  await page.locator('[data-act="kalender-code"]').click();
  await bis(async () => /Code kopiert/.test(await text(page, '#kalenderMeldung')));
  const mc = await text(page, '#kalenderMeldung');
  check(/demselben Kennwort/.test(mc) && /im selben Projekt den ganzen Code/.test(mc) && /Neue Version/.test(mc) && !/einrichten/.test(mc)
    && !/Schritt 2 und 3/.test(mc),
  `verbunden „Code kopieren": dasselbe Kennwort, im selben Projekt ersetzen, Neue Version – ohne „einrichten" (Kalender und Auslöser bestehen) und nicht „Schritt 2 und 3" („${mc.slice(0, 70)}…")`);
  await zu(g);
});

/* ================================================================== *
 * 6. Trennen, neue URL, ohne Netz, alle Daten löschen
 * ================================================================== */
await abschnitt(6, async () => {
  const g = await geraet('6 Trennen', { kalender: { token: TOKEN, url: URL_A } });
  const { page, skript } = g;
  await vor(page, 4000, 1500);
  await bis(() => skript.vorschauen().length === 1);
  await zuMehr(page);
  // Eine neue URL: erst die Probe dort, dann „aus" an die alte, dann die Vorschau.
  const vorher = skript.anfragen.length;
  // Dabei bittet das neue Skript um etwas: Der Satz steht in der Farbe für „da
  // ist etwas zu tun", ohne „nach etwa einer Minute stehen die Termine".
  skript.probeHinweis = 'Verbunden, aber ohne stündlichen Auslöser – in Apps Script „einrichten" ausführen.';
  let frei;
  skript.haltenVorschau = new Promise((r) => { frei = r; });
  const m = await verbinden(page, URL_B);
  const stil = await page.locator('#kalenderMeldung').getAttribute('style').catch(() => '');
  check(/ohne stündlichen Auslöser/.test(m) && /einrichten/.test(m) && !/nach etwa einer Minute/.test(m) && /var\(--accent\)/.test(stil || ''),
    `ein Hinweis, der um „einrichten" bittet: in der Akzentfarbe, ohne Versprechen („${m.slice(0, 70)}")`);
  skript.probeHinweis = null;
  skript.haltenVorschau = null;
  frei();
  await bis(() => skript.anfragen.slice(vorher).filter((a) => a.j && a.j.tage).length === 1 && skript.aus().length === 1, 5000);
  const neu = skript.anfragen.slice(vorher);
  const probe = neu.find((a) => a.j && a.j.probe);
  const aus = neu.find((a) => a.j && a.j.aus);
  const vorschau = neu.find((a) => a.j && a.j.tage);
  check(/Verbunden/.test(m) && (await kal(page)).url === URL_B, 'eine neue URL verbindet neu');
  check(!!probe && probe.url === URL_B && !!aus && aus.url === URL_A && !!vorschau && vorschau.url === URL_B,
    'die Probe an die neue, ein „aus" an die alte – sonst schöbe deren Skript weiter –, die Vorschau an die neue');
  check(aus && Object.keys(aus.j).sort().join(',') === 'aus,geraet,gesendet,seq,token,v', '„aus" trägt nur v, token, geraet, seq, gesendet');

  // Trennen.
  const vorTrennen = skript.aus().length;
  await page.locator('[data-act="kalender-trennen"]').click();
  await bis(async () => /Getrennt/.test(await text(page, '#kalenderMeldung')), 5000);
  const a2 = skript.aus()[vorTrennen];
  check(!!a2 && a2.url === URL_B && a2.j.token === TOKEN, 'Trennen schickt „aus" an das verbundene Skript');
  const k = await kal(page);
  check(k.url === null && k.token === TOKEN, 'danach ist die Adresse vergessen, das Kennwort bleibt (es steht ja noch im Skript)');
  check(/Termine ab heute verschwinden/.test(await text(page, '#kalenderMeldung')) && await page.locator('#kalenderSchritte').count() === 1,
    'die Karte sagt, was passiert ist, und zeigt wieder die Schritte');
  const zahl = skript.vorschauen().length;
  await haken(page);
  await vor(page, 3 * 60 * 1000, 1000);
  check(skript.vorschauen().length === zahl, 'getrennt geht keine Vorschau mehr hinaus');

  // Trennen ohne Netz: das „aus" wartet und geht bei „online" nach.
  await verbinden(page, URL_A);
  await bis(() => skript.vorschauen().length > zahl, 4000);
  skript.modus = 'netz';
  await page.locator('[data-act="kalender-trennen"]').click();
  await bis(async () => /Getrennt/.test(await text(page, '#kalenderMeldung')), 5000);
  check(/kein Netz/.test(await text(page, '#kalenderMeldung')) && (await meta(page)).aus.length === 1
    && await page.locator('#kalenderAusOffen').count() === 1, 'ohne Netz: getrennt, aber das „aus" wartet – und die Karte sagt es');
  skript.modus = 'ok';
  const vorOnline = skript.aus().length;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  // Erst angekommen, dann vermerkt – auf beides warten.
  await bis(async () => skript.aus().length > vorOnline && (await meta(page)).aus.length === 0, 4000);
  check(skript.aus().length === vorOnline + 1 && (await meta(page)).aus.length === 0, '„online": das „aus" geht nach und ist dann erledigt');

  // Alle Daten löschen: „aus" mit, die Verbindung weg, die Gerätekennung bleibt.
  await verbinden(page, URL_A);
  await bis(() => (skript.letzte() || {}).seq > 0, 3000);
  const geraetVorher = (await meta(page)).geraet;
  const vorReset = skript.aus().length;
  await page.locator('[data-act="reset-all"]').click();
  await bis(() => skript.aus().length > vorReset, 5000);
  check(skript.aus().length === vorReset + 1 && skript.aus()[vorReset].url === URL_A, '„Alle Daten löschen" schickt dem Skript ein „aus"');
  check((await kal(page)) === null && (await meta(page)).geraet === geraetVorher,
    'danach keine Verbindung mehr; die Gerätekennung bleibt (sie hängt am Gerät, nicht am Training)');
  await zu(g);
});

/* ================================================================== *
 * 7. Sicherung, Export, neues Handy – und wo Kennwort und Adresse nie stehen
 * ================================================================== */
await abschnitt(7, async () => {
  const lab = labor(browser);
  const { page: a, ctx } = await lab.geraet('7 A', {
    zustand: { ...ZUSTAND, share: true, lastShare: null, kalender: { token: TOKEN, url: URL_A } }, zeit: START,
  });
  offen.add(ctx);
  const skript = skriptAttrappe();
  await ctx.route(/^https:\/\/script\.google(?:usercontent)?\.com\//, skript.route);
  const konsole = [];
  a.on('console', (m) => konsole.push(m.text()));
  await lab.warte(a, 4000);
  await bis(() => skript.vorschauen().length === 1 && lab.geschrieben().length >= 1, 6000);
  check(skript.vorschauen().length === 1, 'mit Server: die Vorschau geht hinaus wie sonst');
  const mA = await sicherungMeta(a);
  const s = lab.geschrieben()[lab.geschrieben().length - 1];
  const klar = s ? JSON.parse(await entschluesseln(mA.key, s.body.p_daten, s.body.p_iv)) : {};
  check(klar.kalender && klar.kalender.token === TOKEN && klar.kalender.url === URL_A,
    'die automatische Sicherung (Ende-zu-Ende verschlüsselt) trägt die Verbindung – ein neues Handy übernimmt sie');
  const gA = (await meta(a)).geraet;
  check(!!gA && !JSON.stringify(klar).includes(gA), 'die Gerätekennung für das Skript steht nicht darin');
  const roh = lab.anfragen.map((x) => `${x.url} ${x.roh}`).join('\n');
  const melde = lab.anfragen.filter((x) => x.name === 'melde');
  check(melde.length >= 1 && geheim(roh).length === 0,
    `im Rückkanal (${melde.length} Meldung) und neben dem Chiffrat: weder Kennwort noch Adresse (${lab.anfragen.length} Anfragen an Supabase)`);
  const exp = await a.evaluate(async () => (await import('./js/store.js')).exportJSON());
  const e = JSON.parse(exp);
  check(e.kalender && e.kalender.token === TOKEN && e.kalender.url === URL_A && !exp.includes(gA), 'die Exportdatei trägt die Verbindung, nicht die Gerätekennung');

  // Das Diagnoseprotokoll: was die Sendung ergab, nie Kennwort oder Adresse.
  await a.locator('.tab[data-tab="settings"]').click();
  await echteWarte(200);
  const zeilen = await diagZeilen(a);
  const kz = zeilen.filter((z) => / kalender /.test(z));
  check(kz.some((z) => / kalender was=vorschau ergebnis=angekommen .*bytes=\d+ /.test(z)),
    `das Diagnoseprotokoll vermerkt die Sendung mit Ergebnis und Größe („${(kz.find((z) => /was=vorschau/.test(z)) || '').slice(24, 120)}")`);
  const lageText = await text(a, '#diagnoseLage');
  check(/Kalender verbunden, zuletzt angekommen/.test(lageText), 'und der Kopf des Protokolls nennt den Kalender');
  const gespeichert = await a.evaluate(() => localStorage.getItem('workout.diagnose.v1') || '');
  check(geheim(zeilen.join('\n') + lageText + gespeichert).length === 0, 'im Diagnoseprotokoll (Zeilen, Kopf, Speicher): weder Kennwort noch Adresse');
  check(geheim(konsole.join('\n')).length === 0, 'in der Konsole: nichts davon');

  // Ein neues Handy liest die Exportdatei ein.
  const b = await geraet('7 B', { zustand: { greeted: true, name: 'Tobi', log: {} } });
  await vor(b.page, 4000);
  await b.page.evaluate(async (t) => (await import('./js/store.js')).importJSON(t), exp);
  check((await kalJetzt(b.page)).token === TOKEN && (await kalJetzt(b.page)).url === URL_A, 'B hat nach dem Einlesen die Verbindung');
  await b.page.reload({ waitUntil: 'load' });
  await vor(b.page, 4000, 1500);
  await bis(() => b.skript.vorschauen().length === 1, 4000);
  const jb = b.skript.letzte();
  check(!!jb && jb.token === TOKEN && jb.geraet !== gA && /^[A-Za-z0-9_-]{4,64}$/.test(jb.geraet),
    'und schickt weiter – als eigenes Gerät, nicht unter der Kennung von A (die Regel „Wer gilt" hängt daran)');
  // Eine Sicherung ohne Verbindung lässt die des Geräts stehen.
  await b.page.evaluate(async (t) => (await import('./js/store.js')).importJSON(t), JSON.stringify({ ...ZUSTAND, kalender: undefined }));
  check((await kalJetzt(b.page)).url === URL_A, 'eine eingelesene Datei ohne Verbindung trennt nicht still');
  // Eine Datei von nach „Code kopieren", aber vor „Verbinden" (Kennwort ohne
  // Adresse): Sie trennt auch nicht.
  await b.page.evaluate(async (t) => (await import('./js/store.js')).importJSON(t),
    JSON.stringify({ ...ZUSTAND, kalender: { token: 'AnderesKennwort_0123456789', url: null } }));
  check((await kalJetzt(b.page)).url === URL_A && (await kalJetzt(b.page)).token === TOKEN,
    'eine Datei mit Kennwort, aber ohne Adresse: Die Verbindung des Geräts bleibt, wie sie ist');
  // Eine Datei mit fremder Adresse: die Adresse kommt nicht durch.
  await b.page.evaluate(async (t) => (await import('./js/store.js')).importJSON(t),
    JSON.stringify({ ...ZUSTAND, kalender: { token: TOKEN, url: 'https://boese.example/exec' } }));
  check((await kalJetzt(b.page)).url === URL_A,
    'eine Datei mit einer Adresse außerhalb von script.google.com: Die Adresse fällt weg – das Kennwort geht nirgendwohin sonst');
  // Ohne eigene Verbindung: eine fremde Adresse in der Datei verbindet nicht.
  const c = await geraet('7 C', { zustand: { greeted: true, name: 'Tobi', log: {} } });
  await vor(c.page, 4000);
  await c.page.evaluate(async (t) => (await import('./js/store.js')).importJSON(t),
    JSON.stringify({ ...ZUSTAND, kalender: { token: TOKEN, url: 'https://boese.example/exec' } }));
  const kc = await kalJetzt(c.page);
  await vor(c.page, 3 * 60 * 1000, 1000);
  check(!!kc && kc.url === null && kc.token === TOKEN && c.skript.anfragen.length === 0,
    'ein Gerät ohne Verbindung liest dieselbe Datei: nicht verbunden, keine Anfrage');
  await zu(c);
  await zu(b);
  offen.delete(ctx);
  await ctx.close();
  if (lab.fehler.length) seitenFehler.push(...lab.fehler);
});

/* ================================================================== *
 * 9. Ohne Netz trainiert: der Service Worker schickt nach
 * ================================================================== */
await abschnitt(9, async () => {
  const g = await geraet('9 Hintergrund', { kalender: { token: TOKEN, url: URL_A }, sw: true });
  const { page, skript, ctx } = g;
  await bis(() => page.evaluate(() => !!navigator.serviceWorker.controller), 10000);
  check(await page.evaluate(() => !!navigator.serviceWorker.controller), 'der Service Worker ist da');
  await vor(page, 4000, 1500);
  await bis(() => skript.vorschauen().length === 1);
  skript.modus = 'netz';
  const n = await haken(page);
  await bis(async () => ((await meta(page)).letzte || {}).ergebnis === 'netz', 5000);
  const ausgang = await page.evaluate(async () => {
    const c = await caches.open('kalender-ausgang');
    const r = await c.match(new URL('kalender-ausgang', location.href).href);
    return r ? r.json() : null;
  });
  check(!!ausgang && ausgang.url === URL_A && JSON.parse(ausgang.text).seq === ausgang.seq && JSON.parse(ausgang.text).tage,
    'ohne Netz liegt die fertige Sendung im Ausgang des Service Workers');
  check((await page.evaluate(() => window.__sync)).includes('kalender'), 'und die App hat um ein „sync" gebeten');
  // Wieder Netz – der Browser weckt den Service Worker (hier per CDP).
  skript.modus = 'ok';
  const cdp = await ctx.newCDPSession(page);
  let regId = null;
  cdp.on('ServiceWorker.workerRegistrationUpdated', (ev) => { (ev.registrations || []).forEach((r) => { if (!r.isDeleted) regId = r.registrationId; }); });
  await cdp.send('ServiceWorker.enable');
  await bis(() => regId !== null, 3000);
  const vorSync = skript.anfragen.length;
  await cdp.send('ServiceWorker.dispatchSyncEvent', { origin: ORIGIN, registrationId: regId, tag: 'kalender', lastChance: false });
  await bis(() => skript.anfragen.length > vorSync, 5000);
  const vomSW = skript.anfragen.slice(vorSync);
  check(vomSW.length === 1 && vomSW[0].vonSW && vomSW[0].roh === ausgang.text && vomSW[0].url === URL_A,
    'der Service Worker schickt genau diese Sendung – auch ohne offene Seite ginge das so');
  const nachher = await page.evaluate(async () => {
    const c = await caches.open('kalender-ausgang');
    const weg = !(await c.match(new URL('kalender-ausgang', location.href).href));
    const nach = await c.match(new URL('kalender-ausgang-nach', location.href).href);
    return { weg, nach: nach ? await nach.json() : null };
  });
  check(nachher.weg && nachher.nach && nachher.nach.seq === ausgang.seq, 'danach ist der Ausgang leer, und ein Vermerk sagt, was hinausging');
  await verstecken(page);
  await zeigen(page);
  await bis(async () => !!(await meta(page)).nach, 3000);
  await zuMehr(page);
  check(/Im Hintergrund nachgeschickt/.test(await text(page, '#kalenderStand')), 'die Karte sagt es beim nächsten Hinsehen');
  check((await diagZeilen(page)).some((z) => / kalender was=nachgesendet /.test(z)), 'und das Diagnoseprotokoll');
  // Eine Sendung an eine fremde Adresse schickt der Service Worker nie.
  await page.evaluate(async () => {
    const c = await caches.open('kalender-ausgang');
    await c.put(new URL('kalender-ausgang', location.href).href, new Response(JSON.stringify({ url: 'https://boese.example/exec', text: '{"v":1}', seq: 99 })));
  });
  const vorBoese = skript.anfragen.length;
  let fremd = 0;
  await ctx.route('https://boese.example/**', (r) => { fremd += 1; r.fulfill({ status: 200, body: '' }); });
  await cdp.send('ServiceWorker.dispatchSyncEvent', { origin: ORIGIN, registrationId: regId, tag: 'kalender', lastChance: false });
  await echteWarte(800);
  const leer = await page.evaluate(async () => !(await (await caches.open('kalender-ausgang')).match(new URL('kalender-ausgang', location.href).href)));
  check(fremd === 0 && skript.anfragen.length === vorBoese && leer, 'eine Sendung an eine fremde Adresse schickt der Service Worker nicht – er räumt sie weg');

  // „fehler" (das Skript beschäftigt) mit Service Worker: Die Sendung liegt im
  // Ausgang – schließt Tobi die App gleich nach dem Training, schickt er sie
  // nach. Ist das Skript dann noch beschäftigt, liest er das, wirft (der
  // Browser versucht es einige Minuten später noch einmal) und behält sie.
  const imAusgang = () => page.evaluate(async () => {
    const r = await (await caches.open('kalender-ausgang')).match(new URL('kalender-ausgang', location.href).href);
    return r ? r.json() : null;
  });
  const vermerkNach = () => page.evaluate(async () => {
    const r = await (await caches.open('kalender-ausgang')).match(new URL('kalender-ausgang-nach', location.href).href);
    return r ? r.json() : null;
  });
  skript.code = 'fehler';
  skript.hinweis = 'Das Skript ist gerade beschäftigt – die App schickt es später noch einmal.';
  const syncVorher = (await page.evaluate(() => window.__sync)).length;
  await page.evaluate(async () => (await import('./js/kalender-sync.js')).kalenderJetzt('test', { zwingen: true }));
  await bis(async () => ((await meta(page)).letzte || {}).ergebnis === 'fehler', 5000);
  const a1 = await imAusgang();
  check(!!a1 && a1.url === URL_A && (await page.evaluate(() => window.__sync)).length > syncVorher,
    '„fehler": die Sendung liegt im Ausgang, und die App hat um ein „sync" gebeten');
  const nachVorher = await vermerkNach();
  const s1 = skript.anfragen.length;
  await cdp.send('ServiceWorker.dispatchSyncEvent', { origin: ORIGIN, registrationId: regId, tag: 'kalender', lastChance: false });
  await bis(() => skript.anfragen.length > s1, 5000);
  await echteWarte(600);
  const a2 = await imAusgang();
  check(skript.anfragen.length === s1 + 1 && !!a2 && a2.seq === a1.seq && JSON.stringify(await vermerkNach()) === JSON.stringify(nachVorher),
    'noch beschäftigt: der Service Worker liest „fehler" (eine Anfrage, mit CORS) und behält die Sendung – kein Vermerk „nachgeschickt"');
  skript.code = null;
  skript.hinweis = undefined;
  const s2 = skript.anfragen.length;
  await cdp.send('ServiceWorker.dispatchSyncEvent', { origin: ORIGIN, registrationId: regId, tag: 'kalender', lastChance: false });
  await bis(async () => skript.anfragen.length > s2 && !(await imAusgang()), 5000);
  const nach2 = await vermerkNach();
  check(skript.anfragen.length === s2 + 1 && skript.anfragen[s2].roh === a1.text && !(await imAusgang()) && nach2 && nach2.seq === a1.seq && nach2.code === 'angekommen',
    'wieder frei: er schickt genau diese Sendung, der Ausgang ist leer, und der Vermerk sagt „angekommen"');
  void n;
  await zu(g);
});

/* ================================================================== *
 * 10. Last im Fenster – mit echter Uhr
 * ================================================================== */
await abschnitt(10, async () => {
  const g = await geraet('10 Last', { kalender: { token: TOKEN, url: URL_A }, zeit: null });
  const { page, skript } = g;
  await bis(() => skript.vorschauen().length === 1, 10000);
  check(skript.vorschauen().length === 1, 'mit echter Uhr: die Vorschau beim Start');
  const t0 = await page.evaluate(() => performance.now());
  await page.evaluate(async () => (await import('./js/store.js')).setSetting('injuries', ['tennisarm']));
  await page.evaluate(async () => (await import('./js/kalender-sync.js')).kalenderJetzt('messung', { zwingen: true }));
  await bis(() => skript.vorschauen().length === 2, 6000);
  const z = (await diagZeilen(page)).filter((x) => / kalender was=vorschau /.test(x));
  const werte = z.map((x) => ({ rechnen: Number((/rechnen=(\d+)/.exec(x) || [])[1]), haupt: Number((/haupt=([\d.]+)/.exec(x) || [])[1]) }));
  const max = (k) => Math.max(...werte.map((w) => w[k]).filter(Number.isFinite));
  const lang = (await page.evaluate(() => window.__lang)).filter((x) => x.start >= t0);
  console.log(`     Messung: Worker ${werte.map((w) => w.rechnen).join(' / ')} ms, im Fenster ${werte.map((w) => w.haupt).join(' / ')} ms, `
    + `lange Aufgaben danach: ${lang.map((x) => Math.round(x.dauer)).join(', ') || 'keine'}`);
  check(werte.length === 2 && max('haupt') < 30, `im Fenster höchstens ${max('haupt')} ms je Sendung (Zustand hinübergeben, Text bauen) – unter 30 ms`);
  check(lang.every((x) => x.dauer < 100), `keine lange Aufgabe über 100 ms, während der Worker rechnet (${lang.length} über 50 ms)`);
  await zu(g);
});

/* ================================================================== *
 * 11. Die Einzeldatei
 * ================================================================== */
await abschnitt(11, async () => {
  const g = await geraet('11 Einzeldatei', { adresse: EINZEL, zeit: START });
  const { page } = g;
  await vor(page, 4000);
  await zuMehr(page);
  const k = await text(page, '#kalenderAuto');
  check(/Google Kalender automatisch/.test(k) && /nicht in dieser Einzeldatei/.test(k),
    'in der Einzeldatei steht die Karte – mit dem Satz, dass es nur in der App aus dem Netz geht');
  check(await page.locator('[data-act="kalender-code"]').count() === 0 && await page.locator('#kalenderUrl').count() === 0,
    'ohne „Code kopieren" und ohne URL-Feld');
  await zu(g);
});

/* ================================================================== *
 * 12. Was an zwei Stellen steht
 * ================================================================== */
await abschnitt(12, async () => {
  const sync = readFileSync(path.join(ROOT, 'js', 'kalender-sync.js'), 'utf8');
  const store = readFileSync(path.join(ROOT, 'js', 'store.js'), 'utf8');
  const sw = readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  check(Number((/const KAL_VERTRAG = (\d+);/.exec(sync) || [])[1]) === V.VORSCHAU_V
    && /const KAL_MAX_BYTES = 64 \* 1024;/.test(sync) && V.VORSCHAU_MAX_BYTES === 64 * 1024
    && /const KAL_MAX_BYTES_2 = 192 \* 1024;/.test(sync) && V.VORSCHAU_MAX_BYTES_2 === 192 * 1024
    && Number((/const KAL_FERNE = (\d+);/.exec(sync) || [])[1]) === V.VORSCHAU_FERNE,
  'Fassung des Vertrags, 64 und 192 KiB, ein Jahr Ferne: in js/kalender-sync.js wie in js/kalender-vorschau.js');
  const reStore = (/export const KALENDER_URL = (\/.+\/);/.exec(store) || [])[1];
  const reSw = (/const KALENDER_ZIEL = (\/.+\/);/.exec(sw) || [])[1];
  check(!!reStore && reStore === reSw, 'die erlaubte Adresse: in js/store.js und sw.js dieselbe');
  check(/'\.\/js\/kalender-sync\.js'/.test(sw), 'sw.js hält js/kalender-sync.js vor');
  const g = await geraet('12 Standards');
  const std = await g.page.evaluate(async () => {
    const k = await import('./js/kalender.js');
    const s = await import('./js/store.js');
    return { k: [k.KALENDER_MINUTEN, k.KALENDER_ERINNERUNG], s: s.normKalender({ token: 'abcdefghijklmnop1234' }) };
  });
  check(std.s.minuten === std.k[0] && std.s.erinnerung === std.k[1], `die Standards: ${std.k.join(' / ')} in js/kalender.js wie in normKalender()`);
  await zu(g);
});

/* ================================================================== *
 * 13. Fassung 1 im Skript – und das Code-Update
 *
 *     „Klappt alles aber bisschen wenig Termine. Lass doch mal ein Jahr
 *      machen"
 * ================================================================== */
await abschnitt(13, async () => {
  // Tobis Skript bis zum Update: Fassung 1. Das Gerät kennt die Fassung noch nicht.
  const g = await geraet('13 Fassung 1', { kalender: { token: TOKEN, url: URL_A }, fassung: null });
  const { page, skript } = g;
  skript.fassung1 = true;
  await vor(page, 4000, 1500);
  await bis(() => skript.vorschauen().length === 1);
  await vor(page, 1000, 1500);
  const erst = skript.vorschauen();
  check(erst.length === 1 && erst[0].j.v === 1 && !('ferne' in erst[0].j) && V.nutzlastPruefen(erst[0].j) === null
    && Object.keys(erst[0].j.tage).length === 42 && Buffer.byteLength(erst[0].roh) < V.VORSCHAU_MAX_BYTES,
  `Fassung unbekannt: die App schickt v 1 wie bisher (${(Buffer.byteLength(erst[0].roh) / 1024).toFixed(1)} KiB) – ein Skript der Fassung 1 nimmt es an`);
  const m1 = await meta(page);
  check(m1.fassung.version === 1 && m1.fassung.ziel === zielVon(URL_A, TOKEN) && m1.letzte.ok,
    'die Antwort sagt Fassung 1 – die App merkt es sich für diese Verbindung, und es bleibt bei v 1');
  // Die Startseite: einmal, dezent.
  await zumDashboard(page);
  const zeile = page.locator('#kalenderJahrZeile');
  const zText = (await text(page, '#kalenderJahrZeile')).trim();
  check(await zeile.count() === 1 && !/\bwarn\b/.test(await zeile.getAttribute('class')) && await page.locator('#kalenderZeile').count() === 0
    && /Ein Jahr im Voraus geht jetzt – dafür einmal den Code im Skript erneuern/.test(zText),
  `Startseite: einmal dezent, ohne Warnfarbe – kaputt ist nichts („${zText}")`);
  // „Hier beim Dashboard soll man nicht scrollen können" – auch mit ihr eine
  // Seite, bei 414×896 und 360×740. Bis zur Prüfung des Entwurfs stand sie als
  // gewöhnliche Zeile da (97 px), und bei 360×740 lag der Fuß 26 px unter der
  // Leiste; jetzt klein gesetzt wie die Zeile zum Ton (.notice.kurz).
  for (const [b, h] of [[414, 896], [360, 740]]) {
    await page.setViewportSize({ width: b, height: h });
    await echteWarte(300);
    const m = await seiteMessen(page);
    check(/\bkurz\b/.test(await zeile.getAttribute('class')) && m.zeile > 0 && m.scroll <= 0 && m.fussUnten <= m.sichtbar,
      `Startseite ${b}×${h} mit der Zeile (${m.zeile} px): eine Seite, Fuß über der Leiste (Überhang ${m.scroll}, Fuß ${m.fussUnten} / ${m.sichtbar})`);
  }
  await page.setViewportSize({ width: 414, height: 896 });
  await echteWarte(300);
  await page.locator('[data-act="kalender-jahr-ansehen"]').click();
  await echteWarte(300);
  // Die Bitte steht nach dem Sprung unter der Kopfleiste, nicht dahinter. Bis
  // zur Prüfung des Entwurfs lagen Überschrift und erster Satz darunter, und
  // Tobi las die Bitte mitten im Satz an.
  const sprung = await ueberschriftFrei(page);
  check(sprung.frei && sprung.oben >= sprung.leiste,
    `„Ansehen": die Überschrift der Bitte liegt unter der Kopfleiste (bei ${sprung.oben} px, die Leiste bis ${sprung.leiste} px)`);
  // Bei Fassung 1 steht ein Jahr nicht im Kalender – die Karte sagt es oben
  // nicht anders als die Bitte darunter.
  const was = await text(page, '#kalenderWas');
  check(/vier Wochen im Voraus \(ein Jahr mit neuem Code, siehe unten\)/.test(was) && !/ein Jahr im Voraus/.test(was) && !/wie es danach weitergeht/.test(was),
    `bei Fassung 1 sagt die Karte oben „vier Wochen im Voraus" – nicht „ein Jahr" („${was.slice(0, 150)}…")`);
  const jahr = await page.evaluate(async () => (await import('./js/kalender-sync.js')).KALENDER_JAHR);
  const karte = await text(page, '#kalenderJahr');
  const schritte = (await page.locator('#kalenderJahrSchritte li').allTextContents()).map((x) => x.replace(/\s+/g, ' ').trim());
  check(await page.locator('#kalenderJahr').isVisible() && karte.includes(jahr.titel) && karte.includes(jahr.satz) && karte.includes(jahr.danach)
    && JSON.stringify(schritte) === JSON.stringify(jahr.schritte),
  '„Ansehen" führt zur Bitte auf der Karte: der Satz, vier Schritte, was danach passiert');
  console.log(`     Die Bitte: ${jahr.satz} ${schritte.map((x, i) => `${i + 1}. ${x}`).join(' ')} ${jahr.danach}`);
  check(schritte.length === 4 && /„Code kopieren"/.test(schritte[0]) && /script\.google\.com/.test(schritte[1]) && /Desktopwebsite/.test(schritte[1])
    && /dasselbe wie beim Einrichten/.test(schritte[1]) && /den ganzen Code dort durch den kopierten ersetzen und speichern/i.test(schritte[2])
    && /Bereitstellen → Bereitstellungen verwalten → Bearbeiten \(Stift\) → Version: Neue Version → Bereitstellen/.test(schritte[3])
    && !/„?einrichten/.test(`${jahr.satz} ${schritte.join(' ')} ${jahr.danach}`.replace('beim Einrichten', '')),
  'die Schritte: Code kopieren, dasselbe Projekt öffnen, ganzen Code ersetzen und speichern, Neue Version bereitstellen – kein „einrichten"');
  check(/von selbst/.test(jahr.danach) && /das ganze Jahr/.test(jahr.danach) && /dasselbe/.test(jahr.satz),
    'dazu: dasselbe Kennwort, und die App merkt es von selbst – keine Wahl, kein Knopf');
  check(await page.locator('#kalenderJahr .btn-primary[data-act="kalender-code"]').count() === 1
    && await page.locator('#kalenderAuto [data-act="kalender-code"]').count() === 1,
  'genau ein „Code kopieren" auf der Karte, als Hauptknopf in der Bitte');
  await page.locator('#kalenderAuto').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOT}/kalender-karte-jahr.png` });
  await zumDashboard(page);
  check(await page.locator('#kalenderJahrZeile').count() === 0, 'einmal: angesehen, steht die Zeile nicht mehr auf der Startseite');
  await page.reload({ waitUntil: 'load' });
  await vor(page, 4000, 1500);
  await zumDashboard(page);
  check(await page.locator('#kalenderJahrZeile').count() === 0 && skript.vorschauen().length === 1,
    '… auch nach dem Neuladen nicht; dieselbe Vorschau geht nicht noch einmal hinaus');
  await zuMehr(page);
  await page.locator('#kalenderJahr [data-act="kalender-code"]').click();
  await bis(async () => /Code kopiert/.test(await text(page, '#kalenderMeldung')));
  const code = await page.evaluate(() => navigator.clipboard.readText());
  check(code === VORLAGE.replace(PLATZHALTER, TOKEN) && /^const FASSUNG = 2;$/m.test(code) && (await kal(page)).token === TOKEN,
    '„Code kopieren": die neue Fassung mit demselben Kennwort wie bisher – das Skript erkennt die App weiter');
  // Die Schritte stehen direkt darüber – die Meldung verweist auf sie, statt
  // Schritt 3 und 4 ein zweites Mal in sieben Zeilen zu sagen.
  const kopiertText = (await text(page, '#kalenderMeldung')).trim();
  check(kopiertText === 'Code kopiert – mit demselben Kennwort wie bisher. Weiter mit Schritt 2.',
    `nach dem Kopieren eine kurze Meldung („${kopiertText}")`);
  // Tobi ersetzt in Apps Script den Code und stellt die neue Version bereit –
  // die App ist so lange versteckt. Er ist schnell: Nach 90 s ist er zurück,
  // keine zwei Minuten nach der letzten Nachfrage. Die App weiß, dass er den
  // Code eben kopiert hat, und fragt gleich. Bis zur Prüfung des Entwurfs
  // fragte sie erst nach den zwei Minuten und dann erst beim nächsten
  // Zurückkommen – blieb er auf der Karte, merkte sie den neuen Code nie.
  const proben = skript.proben().length;
  const n0 = skript.vorschauen().length;
  await verstecken(page);
  skript.fassung1 = false;
  let los;
  skript.haltenVorschau = new Promise((r) => { los = r; });
  await vor(page, 90 * 1000, 300);
  await zeigen(page);
  await bis(() => skript.vorschauen().length > n0, 8000);
  // Die erste Sendung mit dem Jahr liegt beim Skript (doPost gleicht bis zu
  // 25 s an). Bis zur Prüfung stand dann „(Skript Fassung 1)" da, ohne ein
  // Wort zum Jahr – genau wenn Tobi nachsieht, ob es geklappt hat.
  await bis(async () => /Neuer Code erkannt/.test(await text(page, '#kalenderStand')), 4000);
  const waehrend = await text(page, '#kalenderStand');
  check(skript.proben().length === proben + 1 && /Neuer Code erkannt \(Skript Fassung 2\) – das ganze Jahr geht jetzt an das Skript\./.test(waehrend)
    && !/Fassung 1/.test(waehrend) && await page.locator('#kalenderJahr').count() === 0 && await page.locator('#kalenderMeldung').count() === 0,
  `schnell zurück (90 s): gleich eine Probe – und solange das Jahr beim Skript liegt, sagt die Karte es („${waehrend.slice(0, 110)}"), `
    + 'die Bitte und die Meldung vom Kopieren sind weg');
  // Kurz weg und wieder da, während sie noch liegt: keine zweite Sendung.
  await verstecken(page);
  await zeigen(page);
  await echteWarte(300);
  skript.haltenVorschau = null;
  los();
  await bis(async () => /Termine bis/.test(await text(page, '#kalenderStand')), 6000);
  await vor(page, 1000, 1000);
  const v2 = skript.letzte();
  const v2Zahl = skript.vorschauen().slice(n0).length;
  check(v2Zahl === 1 && v2 && v2.v === 2 && v2.ferne && v2.ferne.bis === 365 && V.nutzlastPruefen(v2) === null,
    `zurück aus Apps Script: die App sieht Fassung 2 und schickt von selbst das Jahr – genau einmal (${v2Zahl}), auch wenn er zwischendurch kurz weg war`);
  check(await page.locator('#kalenderJahr').count() === 0 && /Skript Fassung 2\)\. Im Kalender: Termine bis 08\.10\.2027\./.test(await text(page, '#kalenderStand')),
    `die Bitte ist weg; die Karte sagt, bis wann die Termine stehen („${(await text(page, '#kalenderStand')).slice(0, 110)}")`);
  const dz = (await diagZeilen(page)).filter((x) => / kalender was=(fassung-frage|vorschau) /.test(x)).slice(-2);
  check(dz.some((x) => /was=fassung-frage version=2/.test(x)) && dz.some((x) => /vertrag=2 fern=365/.test(x)),
    'im Diagnoseprotokoll: die Nachfrage und die Sendung mit Vertrag 2');
  await zu(g);

  // Bleibt Tobi nach dem Kopieren in der App (am Rechner bereitgestellt, oder
  // Google brauchte einen Moment): Solange sie zu sehen ist, fragt sie alle
  // zwei Minuten von selbst – eine halbe Stunde lang nach dem Kopieren.
  const s = await geraet('13 sichtbar', { kalender: { token: TOKEN, url: URL_A }, fassung: 1 });
  s.skript.fassung1 = true;
  await vor(s.page, 4000, 1500);
  await bis(() => s.skript.vorschauen().length >= 1, 8000);
  await zuMehr(s.page);
  await bis(() => s.skript.proben().length >= 1, 4000);
  await s.page.locator('#kalenderJahr [data-act="kalender-code"]').click();
  await bis(async () => /Code kopiert/.test(await text(s.page, '#kalenderMeldung')));
  const sp = s.skript.proben().length;
  s.skript.fassung1 = false;
  await vor(s.page, 2 * 60 * 1000 + 5000, 1500);
  await bis(() => s.skript.vorschauen().some((x) => x.j.v === 2), 6000);
  check(s.skript.proben().length === sp + 1 && s.skript.vorschauen().some((x) => x.j.v === 2) && await s.page.locator('#kalenderJahr').count() === 0,
    `nach dem Kopieren auf der Karte geblieben: zwei Minuten später fragt die App von selbst (${s.skript.proben().length - sp} Probe), sieht Fassung 2 und schickt das Jahr`);
  await zu(s);

  // Die Zeile eilt nicht: Steht oben schon etwas (hier die Zeile zum
  // Tagesabschluss) oder ist an der Einheit schon etwas abgehakt, tritt sie
  // zurück und kommt wieder, wenn das weg ist. Mit Fortschritt und „Training
  // fortsetzen" lag der Fuß mit ihr bei 360×740 13 px unter der Leiste.
  const zs = JSON.parse(JSON.stringify(ZUSTAND));
  zs.tagesabschluss = { am: HEUTE, einheiten: [{ n: 8, tag: '2026-10-06', done: 10, total: 17 }] };
  const st = await geraet('13 Startseite', { zustand: zs, kalender: { token: TOKEN, url: URL_A }, fassung: 1 });
  st.skript.fassung1 = true;
  await st.page.setViewportSize({ width: 360, height: 740 });
  await vor(st.page, 4000, 1500);
  await bis(() => st.skript.vorschauen().length >= 1, 8000);
  await zumDashboard(st.page);
  const mitAbschluss = { jahr: await st.page.locator('#kalenderJahrZeile').count(), abschluss: await st.page.locator('.notice.abschluss').count() };
  await st.page.evaluate(async () => (await import('./js/store.js')).setzeTagesabschluss(null));
  await zuMehr(st.page);
  await zumDashboard(st.page);
  const ohneAbschluss = await st.page.locator('#kalenderJahrZeile').count();
  await haken(st.page);
  await zuMehr(st.page);
  await zumDashboard(st.page);
  const mitHaken = await st.page.locator('#kalenderJahrZeile').count();
  const mh = await seiteMessen(st.page);
  check(mitAbschluss.abschluss === 1 && mitAbschluss.jahr === 0 && ohneAbschluss === 1 && mitHaken === 0 && mh.fussUnten <= mh.sichtbar,
    `sie tritt zurück: neben der Zeile zum Tagesabschluss nicht (${mitAbschluss.jahr}), ohne sie da (${ohneAbschluss}), `
      + `mit einem Haken an der Einheit nicht (${mitHaken}, Fuß ${mh.fussUnten} / ${mh.sichtbar})`);
  // Der Sprung zur Bitte, auch bei 360×740: unter der Kopfleiste.
  await zuMehr(st.page);
  await st.page.evaluate(() => document.getElementById('kalenderJahr').scrollIntoView());
  await echteWarte(200);
  const sprung360 = await ueberschriftFrei(st.page);
  check(sprung360.frei && sprung360.oben >= sprung360.leiste,
    `360×740: zur Bitte gesprungen, liegt die Überschrift unter der Kopfleiste (bei ${sprung360.oben} px, Leiste bis ${sprung360.leiste} px)`);
  await zu(st);

  // Unbekannt heißt v 1 – und meldet die Antwort Fassung 2, geht gleich das Jahr hinterher.
  const h = await geraet('13 neu', { kalender: { token: TOKEN, url: URL_A }, fassung: null });
  await vor(h.page, 4000, 1500);
  await bis(() => h.skript.vorschauen().length >= 2, 8000);
  const vs = h.skript.vorschauen().map((x) => x.j.v);
  check(vs.length === 2 && vs[0] === 1 && vs[1] === 2 && h.skript.vorschauen()[1].j.ferne,
    `ein Gerät, das die Fassung noch nicht kennt: erst v 1, die Antwort sagt Fassung 2, gleich danach v 2 (${vs.join(', ')})`);
  await zumDashboard(h.page);
  check(await h.page.locator('#kalenderJahrZeile').count() === 0 && await h.page.locator('#kalenderZeile').count() === 0,
    'Fassung 2 im Skript: keine Zeile auf der Startseite');
  await zu(h);

  // Ein Skript, das v 2 zurückweist (der alte Code wieder eingefügt): gleich noch einmal als v 1.
  const f = await geraet('13 zurück', { kalender: { token: TOKEN, url: URL_A }, fassung: null });
  await vor(f.page, 4000, 1500);
  await bis(() => f.skript.vorschauen().length >= 2, 8000);
  f.skript.fassung1 = true;
  // Auf der Startseite mitschreiben, ob dazwischen eine Warnzeile aufblitzt.
  await zumDashboard(f.page);
  await f.page.evaluate(() => {
    window.__warnZeile = 0;
    new window.MutationObserver(() => { if (document.getElementById('kalenderZeile')) window.__warnZeile += 1; })
      .observe(document.body, { childList: true, subtree: true });
  });
  const n1 = f.skript.vorschauen().length;
  await f.page.evaluate(async () => (await import('./js/kalender-sync.js')).kalenderJetzt('test', { zwingen: true }));
  await bis(() => f.skript.vorschauen().length >= n1 + 2, 8000);
  await echteWarte(500);
  const danach = f.skript.vorschauen().slice(n1).map((x) => x.j.v);
  check(danach[0] === 2 && danach[1] === 1 && (await meta(f.page)).letzte.ok && (await meta(f.page)).fassung.version === 1,
    `ein Skript, das v 2 nicht kennt: abgewiesen („format", Fassung 1), gleich noch einmal als v 1 – und angekommen (${danach.join(', ')})`);
  check(await f.page.evaluate(() => window.__warnZeile) === 0 && await f.page.locator('#kalenderJahrZeile').count() === 1,
    'dazwischen blitzt auf der Startseite keine Warnzeile auf – danach steht dort nur die dezente Bitte um das Jahr');
  await zu(f);

  // Dasselbe beim Wegschalten: Die Seite darf dann nicht gleich nachschicken
  // (sie friert ein). Zurück in der App schickt sie dieselbe Vorschau passend.
  const w = await geraet('13 Wegschalten', { kalender: { token: TOKEN, url: URL_A } });
  await vor(w.page, 4000, 1500);
  await bis(() => w.skript.vorschauen().length >= 1, 8000);
  w.skript.fassung1 = true;
  await zumDashboard(w.page);
  await w.page.evaluate(() => {
    window.__warnZeile = 0;
    new window.MutationObserver(() => { if (document.getElementById('kalenderZeile')) window.__warnZeile += 1; })
      .observe(document.body, { childList: true, subtree: true });
  });
  const nw = w.skript.vorschauen().length;
  await w.page.evaluate(async () => (await import('./js/store.js')).setSetting('injuries', ['tennisarm']));
  await vor(w.page, 2500, 2500);
  await verstecken(w.page);
  await bis(() => w.skript.vorschauen().length > nw, 5000);
  await echteWarte(800);
  const weg = w.skript.vorschauen().slice(nw);
  const keep = (await diagZeilen(w.page)).filter((x) => / kalender was=vorschau .*keepalive=true/.test(x));
  check(weg.length === 1 && weg[0].j.v === 2 && keep.length === 1 && (await meta(w.page)).letzte.ergebnis === 'format',
    `beim Wegschalten v 2 mit keepalive an ein Skript, das wieder Fassung 1 ist: abgewiesen – und nicht gleich nachgeschickt (${weg.map((x) => x.j.v).join(', ')})`);
  await zeigen(w.page);
  await bis(() => w.skript.vorschauen().length > nw + 1, 8000);
  await echteWarte(500);
  const zurueck = w.skript.vorschauen().slice(nw + 1);
  check(zurueck.length === 1 && zurueck[0].j.v === 1 && (await meta(w.page)).letzte.ok
    && await w.page.evaluate(() => window.__warnZeile) === 0,
  'zurück in der App: dieselbe Vorschau als v 1 – angekommen, und keine Warnzeile');
  await zu(w);

  // Ein Worker, der die Ferne nicht kennt (etwa aus einem älteren
  // Zwischenspeicher): Die Rechnung findet nie zur Fassung des Skripts. Die
  // App versucht es zweimal und hört dann auf, statt ohne Ende zu schicken.
  const ow = await geraet('13 alter Worker', { kalender: { token: TOKEN, url: URL_A } });
  await ow.page.evaluate(() => { window.__ohneFerne = true; });
  await vor(ow.page, 4000, 1500);
  await bis(() => ow.skript.vorschauen().length >= 3, 8000);
  await vor(ow.page, 1000, 2500);
  const ov = ow.skript.vorschauen().map((x) => x.j.v);
  const auf = (await diagZeilen(ow.page)).filter((x) => / kalender was=fassung .*aufgegeben=true/.test(x));
  check(ov.length === 3 && ov.every((x) => x === 1) && auf.length === 1 && (await meta(ow.page)).letzte.ok,
    `findet die Rechnung nie zur Fassung des Skripts: drei Sendungen, dann hört die App auf – vermerkt im Diagnoseprotokoll (${ov.join(', ')})`);
  await zu(ow);

  // Tobis Handy nach dem Update der App: Was v245 hinterließ, kennt `fassung`
  // noch nicht – die Fassung steht nur beim letzten Versuch und beim letzten,
  // der ankam. Die zählt auch, ohne dass erst etwas ankommen muss (hier: kein Netz).
  const ziel = zielVon(URL_A, TOKEN);
  const alt = Date.parse('2026-10-07T18:00:00+02:00');
  const t = await geraet('13 nach dem Update', {
    kalender: { token: TOKEN, url: URL_A },
    meta: {
      geraet: 'gAltesGeraet01', seq: 41, hash: 'abc123', ziel,
      letzte: { nr: 9, art: 'vorschau', zeit: alt, ergebnis: 'angekommen', ok: true, version: 1, ziel },
      angekommen: { zeit: alt, version: 1, tag: '2026-10-07', ziel },
    },
  });
  t.skript.modus = 'netz';
  await vor(t.page, 4000, 1500);
  await bis(() => t.skript.vorschauen().length >= 1, 8000);
  await echteWarte(300);
  await zumDashboard(t.page);
  // Ohne Netz versucht der Browser dieselbe Sendung zweimal (mit und ohne CORS) – es bleibt eine.
  const tv = t.skript.vorschauen();
  check(new Set(tv.map((x) => x.roh)).size === 1 && tv[0].j.v === 1 && !tv[0].j.ferne
    && await t.page.locator('#kalenderJahrZeile').count() === 1 && await t.page.locator('#kalenderZeile').count() === 0,
  'nach dem Update der App: Fassung 1 aus dem, was v245 vermerkte – v 1, und die Bitte steht da, auch ohne Netz');
  await zu(t);
});

/* ================================================================== *
 * 14. Über 64 KiB: beim Wegschalten über den Service Worker
 * ================================================================== */
await abschnitt(14, async () => {
  // Fußball jede Woche, ein Jahr lang: die Ferne voller Termine, die
  // Sendung über 64 KiB – mehr, als keepalive beim Wegschalten trägt.
  const z = JSON.parse(JSON.stringify(ZUSTAND));
  z.termine = Array.from({ length: 52 }, (_, i) => ({ datum: bisTag('2026-11-07', i * 7), name: 'Fußball', aktivitaet: 'fussball', minuten: 90 }));
  const g = await geraet('14 groß', { zustand: z, kalender: { token: TOKEN, url: URL_A }, sw: true });
  const { page, skript, ctx } = g;
  await bis(() => page.evaluate(() => !!navigator.serviceWorker.controller), 10000);
  await vor(page, 4000, 1500);
  await bis(() => skript.vorschauen().some((x) => x.j.v === 2), 30000);
  const gross = skript.vorschauen().find((x) => x.j.v === 2);
  const kib = (s) => (Buffer.byteLength(s) / 1024).toFixed(1);
  check(!!gross && Buffer.byteLength(gross.roh) > V.VORSCHAU_MAX_BYTES && Buffer.byteLength(gross.roh) < V.VORSCHAU_MAX_BYTES_2,
    `52 Termine in der Ferne: ${gross ? kib(gross.roh) : '?'} KiB – über 64 KiB, bei offener Seite trotzdem hinaus (ohne keepalive)`);
  const n0 = skript.vorschauen().length;
  await page.evaluate(async () => (await import('./js/store.js')).setSetting('injuries', ['tennisarm']));
  await vor(page, 2500, 300);
  await echteWarte(10000);   // der Worker rechnet die 52 Termine in echter Zeit
  await verstecken(page);
  await echteWarte(1500);
  const ausgang = await page.evaluate(async () => {
    const r = await (await caches.open('kalender-ausgang')).match(new URL('kalender-ausgang', location.href).href);
    return r ? r.json() : null;
  });
  const keepalive = (await diagZeilen(page)).filter((x) => / kalender was=vorschau .*keepalive=true/.test(x));
  check(skript.vorschauen().length === n0 && !!ausgang && JSON.parse(ausgang.text).v === 2 && Buffer.byteLength(ausgang.text) > V.VORSCHAU_MAX_BYTES
    && !keepalive.length && (await page.evaluate(() => window.__sync)).includes('kalender'),
  `Wegschalten mit ${ausgang ? kib(ausgang.text) : '?'} KiB: kein keepalive-Versuch, gleich in den Ausgang – der Service Worker schickt es`);
  const cdp = await ctx.newCDPSession(page);
  let regId = null;
  cdp.on('ServiceWorker.workerRegistrationUpdated', (ev) => { (ev.registrations || []).forEach((r) => { if (!r.isDeleted) regId = r.registrationId; }); });
  await cdp.send('ServiceWorker.enable');
  await bis(() => regId !== null, 3000);
  await cdp.send('ServiceWorker.dispatchSyncEvent', { origin: ORIGIN, registrationId: regId, tag: 'kalender', lastChance: false });
  await bis(() => skript.vorschauen().length > n0, 8000);
  const vomSW = skript.vorschauen().slice(n0);
  check(vomSW.length === 1 && vomSW[0].vonSW && vomSW[0].roh === ausgang.text, 'der Service Worker schickt genau diese Sendung – über 64 KiB, ohne keepalive');
  await zeigen(page);
  await bis(async () => !!(await meta(page)).nach, 4000);
  const m = await meta(page);
  check(m.nach && m.nach.code === 'angekommen' && m.hash === ausgang.hash && m.fassung.version === 2,
    'zurück in der App: Sie liest den Vermerk – angekommen, dieselbe Vorschau –, und merkt sich Fingerabdruck und Fassung');
  await vor(page, 3 * 60 * 1000, 2000);
  check(skript.vorschauen().length === n0 + 1, 'dieselbe Vorschau geht danach nicht noch einmal hinaus');
  await zu(g);
});

/* ================================================================== *
 * 15. Während das Skript das Jahr einträgt – und was sonst schiefgehen kann
 * ================================================================== */
await abschnitt(15, async () => {
  // a) Die erste Sendung mit dem Jahr: Das Skript hat in 25 s die vier Wochen
  // und ein paar Termine dahinter, 183 Änderungen sind offen. Die Karte sagt,
  // was steht – nicht schon das ganze Jahr.
  const g = await geraet('15 Auffüllen', { kalender: { token: TOKEN, url: URL_A } });
  const { page, skript } = g;
  Object.assign(skript, { offen: 183, stehen: '2026-12-10', folge: true });
  await vor(page, 4000, 1500);
  await bis(() => skript.vorschauen().length >= 1, 8000);
  await zuMehr(page);
  const s1 = await text(page, '#kalenderStand');
  check(/Im Kalender: Termine bis 10\.12\.2026\. Den Rest bis 08\.10\.2027 trägt das Skript in den nächsten Minuten nach – noch 183 Änderungen\./.test(s1)
    && !/Termine bis 08\.10\.2027\./.test(s1) && skript.proben().length === 0,
  `die erste Sendung mit dem Jahr: die Karte sagt, was schon steht und was folgt („${s1.replace(/^.*?(Im Kalender)/, '$1').slice(0, 140)}")`);
  // Ein paar Minuten später ist er wieder da: Die App fragt nach (eine Probe).
  skript.probeStand = { offen: 95, bis: '2027-10-08', stehen: '2027-05-13', folge: true };
  await vor(page, 3 * 60 * 1000 + 1000, 300);
  await verstecken(page);
  await zeigen(page);
  await bis(async () => /13\.05\.2027/.test(await text(page, '#kalenderStand')), 6000);
  const s2 = await text(page, '#kalenderStand');
  check(skript.proben().length === 1 && skript.vorschauen().length === 1
    && /Im Kalender: Termine bis 13\.05\.2027\. Den Rest bis 08\.10\.2027 trägt das Skript in den nächsten Minuten nach – noch 95 Änderungen \(Stand gerade eben\)\./.test(s2),
  `ein paar Minuten später fragt die App nach – eine Probe, keine Sendung – und die Karte sagt den neuen Stand („${s2.replace(/^.*?(Im Kalender)/, '$1').slice(0, 150)}")`);
  skript.probeStand = { offen: 0, bis: '2027-10-08', stehen: '2027-10-08', folge: null };
  await vor(page, 3 * 60 * 1000 + 1000, 300);
  await verstecken(page);
  await zeigen(page);
  await bis(async () => /Im Kalender: Termine bis 08\.10\.2027\./.test(await text(page, '#kalenderStand')), 6000);
  const p1 = skript.proben().length;
  await vor(page, 5 * 60 * 1000, 300);
  await verstecken(page);
  await zeigen(page);
  await echteWarte(800);
  await zumDashboard(page);
  await zuMehr(page);
  const s3 = await text(page, '#kalenderStand');
  check(/Im Kalender: Termine bis 08\.10\.2027\./.test(s3) && !/offen|Rest|Stand/.test(s3.replace(/^.*?(Im Kalender)/, '$1')) && p1 === 2
    && skript.proben().length === p1,
  `alles eingetragen: „Termine bis 08.10.2027." – danach fragt die App nicht mehr nach (${skript.proben().length} Proben)`);
  await zu(g);

  // a2) Gekürzt (die Sendung wäre sonst zu groß geworden): Die Karte sagt es.
  const gk = await geraet('15 gekürzt', { kalender: { token: TOKEN, url: URL_A } });
  await gk.page.evaluate(() => { window.__gekuerzt = 120; });
  await vor(gk.page, 4000, 1500);
  await bis(() => gk.skript.vorschauen().length >= 1, 8000);
  await zuMehr(gk.page);
  const sk = await text(gk.page, '#kalenderStand');
  check(gk.skript.letzte().ferne.bis === 120 && V.nutzlastPruefen(gk.skript.letzte()) === null
    && /Im Kalender: Termine bis 05\.02\.2027\. Diesmal nicht ein ganzes Jahr – die Sendung wäre sonst zu groß geworden/.test(sk),
  `gekürzte Ferne: die Karte sagt es („${sk.replace(/^.*?(Im Kalender)/, '$1').slice(0, 130)}")`);
  await zu(gk);

  // b) Die Ferne lässt sich nicht rechnen (ein Fehler in der Rechnung): Die
  // Nähe geht trotzdem, allein, als v 1 – das Skript gleicht die vier Wochen
  // an und lässt das Jahr stehen. Genau einmal, ohne „passend nachschicken".
  const f = await geraet('15 Ferne kaputt', { kalender: { token: TOKEN, url: URL_A } });
  await f.page.evaluate(() => { window.__fernKaputt = true; });
  await vor(f.page, 4000, 1500);
  await bis(() => f.skript.vorschauen().length >= 1, 8000);
  await vor(f.page, 3000, 1500);
  const fv = f.skript.vorschauen();
  const fz = (await diagZeilen(f.page)).filter((x) => / kalender was=vorschau .*fernfehler=/.test(x));
  check(fv.length === 1 && fv[0].j.v === 1 && !('ferne' in fv[0].j) && V.nutzlastPruefen(fv[0].j) === null && (await meta(f.page)).letzte.ok
    && fz.length === 1 && /vertrag=1/.test(fz[0]),
  `die Ferne lässt sich nicht rechnen: die Nähe geht allein als v 1, genau einmal – und das Diagnoseprotokoll sagt es (${(fz[0] || '').replace(/^.* kalender /, '').slice(0, 120)})`);
  await vor(f.page, 90 * 1000, 300);
  await verstecken(f.page);
  await zeigen(f.page);
  await echteWarte(1500);
  await zumDashboard(f.page);
  check(f.skript.vorschauen().length === 1 && await f.page.locator('#kalenderZeile').count() === 0 && await f.page.locator('#kalenderJahrZeile').count() === 0,
    '… auch beim Zurückkommen nicht noch einmal, und keine Zeile auf der Startseite – die vier Wochen stimmen');
  await zu(f);

  // c) „Neue Version" vergessen. Der Satz dazu hängt an der Zeit der
  // Antwort, nicht an der des Anzeigens: Kommt Tobi nach sechs Minuten mit
  // allem erledigt zurück, steht er nicht da, während die Nachfrage läuft.
  for (const fall of ['richtig', 'vergessen']) {
    const h = await geraet(`15 Code ${fall}`, { kalender: { token: TOKEN, url: URL_A }, fassung: 1 });
    h.skript.fassung1 = true;
    await vor(h.page, 4000, 1500);
    await bis(() => h.skript.vorschauen().length >= 1, 8000);
    await zuMehr(h.page);
    await bis(() => h.skript.proben().length >= 1, 4000);
    await h.page.locator('#kalenderJahr [data-act="kalender-code"]').click();
    await bis(async () => /Code kopiert/.test(await text(h.page, '#kalenderMeldung')));
    if (fall === 'richtig') {
      h.skript.fassung1 = false;
      let los;
      h.skript.halten = new Promise((r) => { los = r; });
      await vor(h.page, 6 * 60 * 1000, 300);
      await verstecken(h.page);
      await zeigen(h.page);
      await bis(() => h.skript.proben().length >= 2, 4000);
      // Neu gezeichnet, während die Nachfrage noch läuft.
      await zumDashboard(h.page);
      await zuMehr(h.page);
      check(await h.page.locator('#kalenderJahr').count() === 1 && await h.page.locator('#kalenderJahrFehlt').count() === 0,
        'nach sechs Minuten zurück, alles erledigt: Solange die Nachfrage läuft, steht die Bitte da, aber kein „Meist fehlt …"');
      h.skript.halten = null;
      los();
      await bis(async () => await h.page.locator('#kalenderJahr').count() === 0, 8000);
      await bis(() => h.skript.vorschauen().some((x) => x.j.v === 2), 8000);
      check(await h.page.locator('#kalenderJahr').count() === 0 && h.skript.vorschauen().some((x) => x.j.v === 2),
        '… die Antwort sagt Fassung 2: die Bitte ist weg, das Jahr geht hinaus');
    } else {
      await vor(h.page, 2.5 * 60 * 1000, 300);
      await verstecken(h.page);
      await zeigen(h.page);
      await bis(() => h.skript.proben().length >= 2, 4000);
      await echteWarte(400);
      const frueh = await h.page.locator('#kalenderJahrFehlt').count();
      await vor(h.page, 2.5 * 60 * 1000, 300);
      await verstecken(h.page);
      await zeigen(h.page);
      await bis(() => h.skript.proben().length >= 3, 4000);
      await bis(async () => await h.page.locator('#kalenderJahrFehlt').count() === 1, 4000);
      const jahr = await h.page.evaluate(async () => (await import('./js/kalender-sync.js')).KALENDER_JAHR);
      const satz = (await text(h.page, '#kalenderJahrFehlt')).trim();
      check(frueh === 0 && satz === jahr.fehlt && /Neue Version/.test(satz) && /Speichern/.test(satz) && !/einrichten/.test(satz),
        `„Neue Version" vergessen: zweieinhalb Minuten nach dem Kopieren noch nichts, fünf Minuten danach meldet das Skript weiter Fassung 1 – „${satz}"`);
      // Daneben nicht mehr das grüne „Code kopiert …" – bis zur Prüfung stand
      // es die ganze Sitzung neben dem orangen Satz.
      check(await h.page.locator('#kalenderMeldung').count() === 0,
        '… und die grüne Meldung vom Kopieren steht nicht mehr daneben');
    }
    await zu(h);
  }

  // c2) Das Tageskontingent ist aufgebraucht, das Skript sagt „morgen geht es
  // von selbst weiter": Darüber steht nicht „mit dem nächsten stündlichen
  // Abgleich".
  const tk = await geraet('15 Tageskontingent', { kalender: { token: TOKEN, url: URL_A } });
  Object.assign(tk.skript, {
    offen: 150, stehen: '2026-11-12', folge: false,
    hinweis: 'Google lässt heute keine weiteren Kalender-Änderungen zu (Tageskontingent aufgebraucht) – morgen geht es von selbst weiter.',
  });
  await vor(tk.page, 4000, 1500);
  await bis(() => tk.skript.vorschauen().length >= 1, 8000);
  await zuMehr(tk.page);
  const st = await text(tk.page, '#kalenderStand');
  check(/Den Rest bis 08\.10\.2027 trägt das Skript morgen nach – noch 150 Änderungen\./.test(st) && !/stündlichen Abgleich/.test(st) && /morgen geht es von selbst weiter/.test(st),
    `Tageskontingent aufgebraucht: „morgen" – nicht „mit dem nächsten stündlichen Abgleich" („${st.replace(/^.*?(Im Kalender)/, '$1').slice(0, 170)}")`);
  await zu(tk);

  // d) Über 64 KiB bei versteckter Seite, ohne Background Sync (Safari): Die
  // Sendung geht gewöhnlich hinaus, so weit die Seite kommt, und gilt als
  // offen, bis die Antwort da ist. Bis zur Prüfung ging sie dort gar nicht.
  const z = JSON.parse(JSON.stringify(ZUSTAND));
  z.termine = Array.from({ length: 52 }, (_, i) => ({ datum: bisTag('2026-11-07', i * 7), name: 'Fußball', aktivitaet: 'fussball', minuten: 90 }));
  const gr = await geraet('15 groß ohne Sync', { zustand: z, kalender: { token: TOKEN, url: URL_A } });
  await vor(gr.page, 4000, 1500);
  await bis(() => gr.skript.vorschauen().some((x) => x.j.v === 2), 30000);
  const n0 = gr.skript.vorschauen().length;
  await gr.page.evaluate(async () => (await import('./js/store.js')).setSetting('injuries', ['tennisarm']));
  await vor(gr.page, 2500, 300);
  await echteWarte(10000);   // der Worker rechnet die 52 Termine in echter Zeit
  let los;
  gr.skript.halten = new Promise((r) => { los = r; });
  await verstecken(gr.page);
  await bis(() => gr.skript.vorschauen().length > n0, 5000);
  await echteWarte(300);
  const unterwegs = gr.skript.vorschauen().slice(n0);
  const mOffen = (await meta(gr.page)).offen;
  gr.skript.halten = null;
  los();
  await bis(async () => (await meta(gr.page)).offen === false, 6000);
  const gz = (await diagZeilen(gr.page)).filter((x) => / kalender was=(ausgang|vorschau) /.test(x)).slice(-2);
  check(unterwegs.length === 1 && Buffer.byteLength(unterwegs[0].roh) > V.VORSCHAU_MAX_BYTES && unterwegs[0].j.v === 2 && mOffen === true
    && (await meta(gr.page)).offen === false && gz.some((x) => /was=ausgang .*ausgang=false/.test(x)) && !gz.some((x) => /keepalive=true/.test(x)),
  `über 64 KiB weggeschaltet, ohne Background Sync: gewöhnlich hinaus (${(Buffer.byteLength(unterwegs[0] ? unterwegs[0].roh : '') / 1024).toFixed(1)} KiB, ohne keepalive), offen bis zur Antwort`);
  await zu(gr);
});

check(seitenFehler.length === 0, `keine Fehler auf den Seiten${seitenFehler.length ? `: ${seitenFehler.slice(0, 4).join(' | ')}` : ''}`);
for (const ctx of offen) await ctx.close().catch(() => {});
await browser.close();
console.log(`\n${fails ? `${fails} FEHLER` : 'alle Prüfungen bestanden'}`);
