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
 *      zweiter Haken nichts, andere Änderungen gedrosselt auf einmal in zwei
 *      Minuten, Abschluss sofort, Wegschalten nur mit fertiger Vorschau, ohne
 *      Netz nachgeholt bei „online".
 *   4. Die Antworten: anderes Gerät, Kennwort, zu alter Code, Kalender fehlt,
 *      undurchsichtig – was davon auf das Dashboard gehört und was nicht.
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
 *      Oberfläche abgeschaltet).
 *  10. Last im Fenster, gemessen mit echter Uhr.
 *  11. Die Einzeldatei: Karte ohne Knöpfe, keine Fehler.
 *  12. Konstanten, die an zwei Stellen stehen, sind gleich.
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
    anfragen: [], modus: 'ok', code: null, hinweis: undefined, version: 1, halten: null, geaendert: 2, cors: new Set(),
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
      if (s.halten) await s.halten;
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
      if (s.code) a = { ok: ['angekommen', 'gleich', 'probe', 'aus'].includes(s.code), code: s.code };
      else if (j && j.probe) a = { ok: true, code: 'probe', hinweis: 'Verbunden. Noch keine Vorschau angekommen.' };
      else if (j && j.aus) a = { ok: true, code: 'aus', geaendert: 3 };
      else a = { ok: true, code: 'angekommen', tag: j && j.ab, geaendert: s.geaendert };
      const antwort = {
        ok: a.ok, code: a.code, version: s.version, kalender: 'Workout', tag: a.tag || null,
        geaendert: a.geaendert ?? null, stand: j && j.stand ? j.stand : null, seq: j ? j.seq : null,
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

/**
 *   zustand   der Stand vor dem ersten Laden (Standard: Tobis vom 08.10.)
 *   kalender  state.kalender dazu – { token, url }
 *   zeit      wo die Uhr steht (null: echte Uhr)
 *   sw        Service Worker zulassen
 */
async function geraet(name, {
  zustand = ZUSTAND, kalender = null, zeit = START, sw = false, adresse = APP, rechte = true,
} = {}) {
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
  await ctx.addInitScript(({ z, k }) => {
    if (z && !sessionStorage.getItem('__test.zustand')) {
      sessionStorage.setItem('__test.zustand', '1');
      localStorage.setItem('workout.state.v1', JSON.stringify(k ? { ...z, kalender: k } : z));
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
        return post.call(this, m, ...rest);
      };
    }
    // Lange Aufgaben im Fenster (Abschnitt 10).
    window.__lang = [];
    try {
      new window.PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lang.push({ start: e.startTime, dauer: e.duration })))
        .observe({ type: 'longtask', buffered: true });
    } catch { /* kein longtask */ }
  }, { z: zustand, k: kalender });
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
  check(/^const FASSUNG = 1;$/m.test(code1), 'die Fassung des Skripts steht lesbar darin');
  check(/Code kopiert/.test(await text(page, '#kalenderMeldung')) && await page.locator('#kalenderKennwort').count() === 1,
    'die Karte sagt „Code kopiert" und dass das Kennwort fest gespeichert ist');
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
  skript.modus = 'html';
  const m = await versuch(URL_A, /nicht das Skript/, 'Anmeldeseite ohne CORS', 2);
  check(/Neue Version/.test(m) && /„Zugriff: Jeder"/.test(m) && /Jeder mit Google-Konto/.test(m) && /„Ausführen als: Ich"/.test(m) && /\/exec/.test(m),
    'der Satz nennt alle drei Ursachen: Neue Version, Zugriff „Jeder" statt „Jeder mit Google-Konto", Ausführen als „Ich", /exec');
  skript.modus = 'kaputt';
  await versuch(URL_A, /HTTP 404.*stimmt die URL/, 'eine lesbare Fehlerseite');
  skript.modus = 'ok';
  skript.code = 'token';
  await versuch(URL_A, /kennt dieses Kennwort nicht.*Code kopieren.*Neue Version/, 'falsches Kennwort');
  skript.code = 'format';
  skript.hinweis = 'Die App ist neuer als dieses Skript – „Kalender-Code erneuern".';
  await versuch(URL_A, /Kalender-Code erneuern.*einrichten.*Neue Version/, 'zu alter Code');
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
  const ok = await verbinden(page, `  ${URL_A}  `);
  check(/Verbunden/.test(ok) && /erste Vorschau/.test(ok), `verbunden: „${ok.slice(0, 80)}…"`);
  check((await kal(page)).url === URL_A, 'die Adresse steht jetzt in state.kalender (ohne Leerzeichen)');
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
  check(v.j.token === TOKEN && v.j.minuten === 1050 && v.j.erinnerung === 30 && v.j.v === 1,
    'mit dem Kennwort, 17:30 (1050) und 30 Minuten Erinnerung als Standard');
  check(v.j.ab === HEUTE && Object.keys(v.j.tage).length === V.VORSCHAU_TAGE && v.j.fenster.join() === '7,28',
    `ab heute, 42 Tage, Fenster [7, 28] (${Object.keys(v.j.tage).length} Tage)`);
  check(Buffer.byteLength(v.roh, 'utf8') < 0.75 * V.VORSCHAU_MAX_BYTES, `${(Buffer.byteLength(v.roh) / 1024).toFixed(1)} KiB – unter drei Vierteln der 64 KiB`);
  const kopf = v.kopf;
  check(kopf['content-type'] === 'text/plain;charset=UTF-8', `Content-Type text/plain (${kopf['content-type']})`);
  const eigene = Object.keys(kopf).filter((h) => /^x-|^authorization$|^cookie$/i.test(h));
  check(eigene.length === 0, `keine eigenen Header, keine Cookies (${eigene.join(', ') || 'keine'})`);
  check(skript.anfragen.every((a) => a.methode === 'POST'), 'nur POST – kein OPTIONS, also kein Preflight');
  const m2 = await meta(page);
  check(/^[A-Za-z0-9_-]{4,64}$/.test(v.j.geraet || '') && v.j.geraet === m2.geraet && v.j.seq === m2.seq && v.j.seq > p.seq,
    `geraet und seq kommen aus workout.kalender.v1 (seq ${p.seq} → ${v.j.seq})`);
  await bis(async () => /Zuletzt angekommen/.test(await text(page, '#kalenderStand')));
  check(/Verbunden\. Zuletzt angekommen: gerade eben \(Skript Fassung 1\)/.test(await text(page, '#kalenderStand')),
    `die Karte sagt, wann es zuletzt ankam („${(await text(page, '#kalenderStand')).slice(0, 70)}")`);
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

  // Zweiter Haken derselben Einheit: die Vorschau ändert sich nicht.
  const vorZweitem = skript.vorschauen().length;
  await haken(page, 1);
  await vor(page, 3 * 60 * 1000, 1500);
  check(skript.vorschauen().length === vorZweitem, 'ein zweiter Haken ändert die Vorschau nicht – nichts geht hinaus');

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
  skript.version = 0;
  await jetzt();
  l = await lage();
  check(/älter als die App/.test(l.dash) && await page.locator('#kalenderErneuern').count() === 1,
    'das Skript meldet eine ältere Fassung als die Vorlage: „Kalender-Code erneuern", auf Karte und Dashboard');
  check(/Bereitstellungen verwalten → Bearbeiten \(Stift\) → Version: Neue Version/.test(l.karte), 'mit „Bereitstellungen verwalten → Bearbeiten → Neue Version"');

  skript.version = 1;
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
  skript.modus = 'html';
  await jetzt();
  l = await lage();
  check(/nicht das Skript/.test(l.dash), 'eine undurchsichtige Antwort im Alltag: auf das Dashboard');

  skript.modus = 'ok';
  await jetzt();
  l = await lage();
  check(!l.dash && /Zuletzt angekommen/.test(l.karte), 'wieder angekommen: die Zeile ist weg');
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
  const m = await verbinden(page, URL_B);
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
    && /const KAL_MAX_BYTES = 64 \* 1024;/.test(sync) && V.VORSCHAU_MAX_BYTES === 64 * 1024,
    'Fassung des Vertrags und 64 KiB: in js/kalender-sync.js wie in js/kalender-vorschau.js');
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

check(seitenFehler.length === 0, `keine Fehler auf den Seiten${seitenFehler.length ? `: ${seitenFehler.slice(0, 4).join(' | ')}` : ''}`);
for (const ctx of offen) await ctx.close().catch(() => {});
await browser.close();
console.log(`\n${fails ? `${fails} FEHLER` : 'alle Prüfungen bestanden'}`);
