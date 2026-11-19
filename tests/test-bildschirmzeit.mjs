/*
 * Bildschirmzeit für Tobis Widget (v263) – js/bildschirmzeit.js in der App.
 *
 *     „Ich will ein eigenes Bildschirmzeit-Widget für meinen Startbildschirm
 *      (Samsung Galaxy S24), weil Androids Bildschirmzeit meine Web-Apps
 *      Boxenstopp, Freizeit und Workout nur als „Chrome" zählt."
 *
 *     „Push, Daten und alles andere in den drei Apps müssen weiter
 *      funktionieren wie bisher."
 *
 * Supabase wird gespielt (Route auf *.supabase.co): Kein Aufruf erreicht den
 * echten Server, und die Kennungen sind erfunden. Die Sicherung spielt
 * tests/sicherung-labor.mjs, das Skript in Tobis Google-Konto eine kleine
 * Attrappe wie in tests/test-kalender-sync.mjs.
 *
 *   A. Ohne Link: keine Anfrage an bildschirmzeit_*, kein Speicher, kein Wort
 *      in der App – auch nicht nach Minuten und beim Wegschalten.
 *   B. Der Link öffnet die App wie ohne ihn (derselbe Reiter, dieselbe
 *      Ansicht), steht danach nicht mehr in der Adresse, sagt „verbunden",
 *      meldet sofort (heute = 0, p_app 'workout', nur der Kopf apikey) und
 *      steht unter Mehr.
 *   C. Die Zeit zählt nur sichtbar; alle fünf Minuten geht sie hinaus, die
 *      Karte zieht nach, beim Wegschalten mit keepalive.
 *   D. Antwortet der Server false, trennt sich die App: Abschnitt weg,
 *      Hinweis „getrennt", danach keine Anfrage mehr. Ein Fehler steht unter
 *      Mehr („Zuletzt nicht durchgekommen").
 *   E. Ein Link auf die offene App (hashchange): Sie bleibt, wo sie ist –
 *      auf ihrem Reiter und mitten in der Einheit in der Fokusansicht (ein
 *      unbekannter Anker geht zum Vergleich weiter aufs Dashboard).
 *      „Trennen", „Alle Daten löschen".
 *   F. Die anderen Links der App (#stand=, #eisen=) gehen wie bisher – kalt
 *      und auf die offene App, verbunden oder nicht.
 *   G. Wegschalten mit Sicherung und Kalender: Beide schicken wie ohne
 *      Bildschirmzeit (dieselben keepalive-Anfragen, dieselbe Größe), die
 *      Bildschirmzeit als Letzte. Die Kennung steht nie in der Sicherung (auch
 *      nicht entschlüsselt), im Export, im Diagnoseprotokoll oder einer
 *      anderen Anfrage.
 *   H. Die Einzeldatei: läuft, schweigt ohne Link und verbindet mit ihm.
 *   I. Die Fassung der Quelle (v265): js/bildschirmzeit.js und die
 *      Einzeldatei kennen alle vier Web-Apps, auch die Bewerbungszentrale.
 *
 *     node tests/test-bildschirmzeit.mjs           # alles
 *     node tests/test-bildschirmzeit.mjs B G       # nur diese Abschnitte
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT, URL as APP, EINZEL } from './umgebung.mjs';
import { entschluesseln, labor, meta as sicherungMeta } from './sicherung-labor.mjs';

let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };
const nur = process.argv.slice(2).map((s) => s.toUpperCase());
const abschnitt = (b) => !nur.length || nur.includes(b);

// Erfunden, im Format der Widget-App: 43 Zeichen base64url.
const KENNUNG = 'Erfundene_Kennung-nur_fuer_Tests_0123456789';
const KENNUNG_2 = 'Zweite_erfundene_Kennung-fuer_Tests_ABCDEFG';
if (KENNUNG.length !== 43 || KENNUNG_2.length !== 43) throw new Error('Testkennung muss 43 Zeichen haben');
const SCHLUESSEL = 'sb_publishable_wTUNShIKMFjCOmZzQuuN-A_vFHPkKUI';
// Sa 14.11.2026, 10:00 in Berlin.
const START = Date.parse('2026-11-14T10:00:00+01:00');
const HEUTE = '2026-11-14';
const KIM = { greeted: true, name: 'Kim', tab: 'dashboard' };

const browser = await chromium.launch();
const seitenFehler = [];
const offen = new Set();
const echteWarte = (ms) => new Promise((r) => { setTimeout(r, ms); });

/** Warten, bis `fn()` stimmt – höchstens `ms` echte Zeit. */
async function bis(fn, ms = 6000) {
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    if (await fn()) return true;
    await echteWarte(100);
  }
  return !!(await fn());
}

/* ------------------------------------------------------------------ *
 * Der gespielte Server: die vier Funktionen aus supabase/bildschirmzeit.sql
 * (Repo Finanzdienste/Bildschirmzeit) – hier zählt nur melden.
 * ------------------------------------------------------------------ */
function bzServer({ sicherung = null } = {}) {
  const s = { anfragen: [], antwort: true, status: 200, sicherung };
  s.route = async (route) => {
    const req = route.request();
    const url = req.url();
    const name = (/\/rpc\/([a-z_]+)/.exec(url) || [])[1] || '';
    const roh = req.postData() || '';
    let body = null;
    try { body = JSON.parse(roh || 'null'); } catch { body = null; }
    s.anfragen.push({ name, url, roh, body, kopf: req.headers() });
    if (name.startsWith('bildschirmzeit_')) {
      if (s.status === 0) { await route.abort('internetdisconnected'); return; }
      if (s.status !== 200) { await route.fulfill({ status: s.status, contentType: 'text/plain', body: 'kaputt' }); return; }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(s.antwort) });
      return;
    }
    if (s.sicherung) { await s.sicherung.route(route); return; }
    await route.fulfill({ status: 204, body: '' });
  };
  s.bz = () => s.anfragen.filter((a) => a.name.startsWith('bildschirmzeit_'));
  s.melden = () => s.anfragen.filter((a) => a.name === 'bildschirmzeit_melden');
  return s;
}

/* ------------------------------------------------------------------ *
 * Das Skript in Tobis Google-Konto, so knapp wie möglich: Es nimmt jede
 * Sendung an (wie skriptAttrappe() in tests/test-kalender-sync.mjs mit
 * modus 'ok').
 * ------------------------------------------------------------------ */
const ACAO = { 'access-control-allow-origin': '*' };
const bisTag = (iso, k) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + k)).toISOString().slice(0, 10);
};
function skriptAttrappe() {
  const s = { anfragen: [] };
  s.route = async (route) => {
    const req = route.request();
    const roh = req.postData() || '';
    let j = null;
    try { j = JSON.parse(roh); } catch { j = null; }
    s.anfragen.push({ url: req.url(), methode: req.method(), roh, j });
    try {
      if (req.method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', headers: ACAO, body: JSON.stringify({ ok: true, code: 'status', version: 2, kalender: 'Workout', kennwort: true }) });
        return;
      }
      const code = j && j.probe ? 'probe' : j && j.aus ? 'aus' : 'angekommen';
      const fern = j && j.ferne ? bisTag(j.ab, j.ferne.bis) : null;
      const antwort = {
        ok: true, code, version: 2, kalender: 'Workout', tag: (j && j.ab) || null, geaendert: 2,
        stand: (j && j.stand) || null, seq: j ? j.seq : null,
        ...(fern ? { offen: 0, bis: fern, stehen: fern, folge: null, morgen: null } : {}),
      };
      await route.fulfill({ status: 200, contentType: 'application/json', headers: ACAO, body: JSON.stringify(antwort) });
    } catch { /* die Seite hat aufgegeben */ }
  };
  s.vorschauen = () => s.anfragen.filter((a) => a.j && a.j.tage);
  return s;
}
/** Wie kalZiel() in js/kalender-sync.js (FNV-1a über Adresse und Kennwort). */
const zielVon = (url, token) => {
  const s = `${url}\u0000${token}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
};

/* ------------------------------------------------------------------ *
 * Ein Gerät
 *
 *   zustand   workout.state.v1 vor dem ersten Laden
 *   anker     an die Adresse gehängt ('#bildschirmzeit=…')
 *   sicherung ein Labor aus tests/sicherung-labor.mjs (Rückkanal frei)
 *   kalender  { url, token } – mit Skript-Attrappe und bekannter Fassung 2
 *   adresse   statt der App über den Server (die Einzeldatei)
 * ------------------------------------------------------------------ */
async function geraet(name, {
  zustand = KIM, anker = '', sicherung = null, kalender = null, adresse = APP, zeit = START,
} = {}) {
  const ctx = await browser.newContext({
    timezoneId: 'Europe/Berlin', viewport: { width: 414, height: 896 }, serviceWorkers: 'block',
  });
  offen.add(ctx);
  const server = bzServer({ sicherung });
  await ctx.route(/supabase\.co\//, server.route);
  const skript = skriptAttrappe();
  await ctx.route(/^https:\/\/script\.google(?:usercontent)?\.com\//, skript.route);
  const mt = kalender ? { fassung: { ziel: zielVon(kalender.url, kalender.token), version: 2 } } : null;
  await ctx.addInitScript(({ z, k, mt: m, frei }) => {
    if (!/^(https?|file):$/.test(location.protocol)) return;   // about:blank
    if (frei) localStorage.setItem('workout.rueckkanal.lokal', '1');
    if (z && !sessionStorage.getItem('__test.zustand')) {
      sessionStorage.setItem('__test.zustand', '1');
      localStorage.setItem('workout.state.v1', JSON.stringify(k ? { ...z, kalender: k } : z));
    }
    if (m && !sessionStorage.getItem('__test.meta')) {
      sessionStorage.setItem('__test.meta', '1');
      localStorage.setItem('workout.kalender.v1', JSON.stringify(m));
    }
    // Online, auch wo Chromium keine Netzschnittstelle sieht (ein eigener
    // Netz-Namensraum nur mit loopback): Ohne das schickte der Kalender nie
    // (kalSchicken() fragt navigator.onLine), und G prüfte nichts.
    Object.defineProperty(Object.getPrototypeOf(navigator), 'onLine', { configurable: true, get: () => true });
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
    // Jeden Aufruf von fetch() in der Reihenfolge, in der die Seite ihn
    // absetzt – mit keepalive und Größe. Die Route sieht keepalive nicht.
    window.__abrufe = [];
    // Und wie viele noch unterwegs sind: Die Uhr springt erst weiter, wenn
    // nichts mehr unterwegs ist – sonst bräche ein Sprung über die zehn
    // Sekunden Wartezeit eine Anfrage ab, deren Antwort schon da ist.
    window.__unterwegs = 0;
    const echt = window.fetch;
    window.fetch = function abrufen(input, init) {
      window.__unterwegs += 1;
      try {
        const url = typeof input === 'string' ? input : (input && input.url) || String(input);
        const body = init && typeof init.body === 'string' ? init.body : '';
        window.__abrufe.push({
          url, keepalive: !!(init && init.keepalive), laenge: body.length,
          body: /bildschirmzeit_/.test(url) ? body : '',
          kopf: /bildschirmzeit_/.test(url) && init && init.headers ? init.headers : null,
        });
      } catch { /* nur mitschreiben */ }
      const p = echt.apply(this, arguments);
      p.then(() => {}, () => {}).then(() => { window.__unterwegs -= 1; });
      return p;
    };
  }, { z: zustand, k: kalender, mt, frei: !!sicherung });
  const page = await ctx.newPage();
  page.setDefaultTimeout(6000);
  page.on('pageerror', (e) => seitenFehler.push(`${name}: ${e.message}`));
  page.on('dialog', (d) => d.accept().catch(() => {}));
  // Die Uhr steht, bis der Test sie vorstellt (wie in tests/sicherung-labor.mjs):
  // Mit laufender Uhr gingen einzelne Sprünge verloren, und drei Minuten
  // wurden 166 Sekunden.
  await page.clock.install({ time: zeit });
  await page.clock.pauseAt(zeit + 1000);
  await page.goto(adresse + anker, { waitUntil: 'load' });
  await echteWarte(400);
  return { ctx, page, server, skript, name };
}

async function zu(g) {
  offen.delete(g.ctx);
  await g.ctx.close().catch(() => {});
}

const text = async (page, sel = '#view') => ((await page.locator(sel).first().textContent().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
const zuMehr = async (page) => { await page.locator('.tab[data-tab="settings"]').click(); await echteWarte(200); };
const zumDashboard = async (page) => { await page.locator('.tab[data-tab="dashboard"]').click(); await echteWarte(200); };
const bzSpeicher = (page) => page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('bildschirmzeit')));
const bzStand = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('bildschirmzeit.workout') || 'null'));
const abrufe = (page) => page.evaluate(() => window.__abrufe);
const toasts = (page) => page.evaluate(() => window.__toasts.join(' | '));
const verstecken = (page) => page.evaluate(() => { window.__hidden = true; document.dispatchEvent(new Event('visibilitychange')); });
const zeigen = (page) => page.evaluate(() => { window.__hidden = false; document.dispatchEvent(new Event('visibilitychange')); });
/** Warten, bis keine Anfrage der Seite mehr unterwegs ist (höchstens 4 s echte Zeit). */
const ruhig = (page) => bis(() => page.evaluate(() => window.__unterwegs === 0), 4000);
/**
 * Die Uhr vorstellen, in Schritten des Takts (15 s) – fastForward löst je
 * Sprung jeden Zeitgeber höchstens einmal aus. Vor jedem Sprung ist nichts
 * mehr unterwegs (ruhig()).
 */
async function vor(page, ms, schritt = 15000) {
  for (let t = 0; t < ms; t += schritt) {
    await ruhig(page);
    await page.clock.fastForward(Math.min(schritt, ms - t));
  }
  await ruhig(page);
  await echteWarte(300);
}
const ganzeSeite = async (page) => (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');

/* ================================================================== *
 * A – ohne Link
 * ================================================================== */
if (abschnitt('A')) {
  console.log('--- A: ohne Link ---');
  const g = await geraet('A');
  const { page, server } = g;
  await vor(page, 6 * 60 * 1000);
  await verstecken(page);
  await echteWarte(300);
  await zeigen(page);
  await vor(page, 60 * 1000);
  check(server.bz().length === 0, `ohne Link keine Anfrage an bildschirmzeit_* (${server.bz().length}), auch nach sechs Minuten und einem Wegschalten`);
  check((await abrufe(page)).every((a) => !/bildschirmzeit/.test(a.url)), 'und kein Versuch dazu (fetch)');
  check((await bzSpeicher(page)).length === 0, `kein Speicher unter „bildschirmzeit…" (${(await bzSpeicher(page)).join(', ') || 'keiner'})`);
  await zuMehr(page);
  check(await page.locator('#bildschirmzeit, #bildschirmzeitKarte, [data-act="bildschirmzeit-trennen"]').count() === 0,
    'unter Mehr kein Abschnitt, kein Knopf');
  const alles = `${await ganzeSeite(page)} ${await toasts(page)}`;
  check(!/Bildschirmzeit|Widget/i.test(alles), 'in der ganzen App kein Wort davon – auch kein Hinweis');
  await zumDashboard(page);
  check(!/Bildschirmzeit|Widget/i.test(await ganzeSeite(page)), 'auch auf der Startseite nicht');
  await zu(g);
}

/* ================================================================== *
 * B – der Link
 * ================================================================== */
let ansichtOhne = null;
if (abschnitt('B') || abschnitt('C') || abschnitt('D')) {
  console.log('--- B: der Link ---');
  // Zum Vergleich: dieselbe App ohne Link – zuletzt stand sie in der Statistik.
  const ohne = await geraet('B-ohne', { zustand: { ...KIM, tab: 'stats' } });
  ansichtOhne = { tab: await ohne.page.evaluate(() => (document.querySelector('.tab[aria-selected="true"]') || {}).dataset?.tab || ''), view: await text(ohne.page) };
  await zu(ohne);

  const g = await geraet('B', { zustand: { ...KIM, tab: 'stats' }, anker: `#bildschirmzeit=${KENNUNG}` });
  const { page, server } = g;
  await bis(() => server.melden().length > 0, 3000);
  const ansicht = { tab: await page.evaluate(() => (document.querySelector('.tab[aria-selected="true"]') || {}).dataset?.tab || ''), view: await text(page) };
  check(ansicht.tab === ansichtOhne.tab && ansicht.tab === 'stats',
    `der Link öffnet die App, wo sie war – wie ohne Link (${ansicht.tab} / ohne: ${ansichtOhne.tab})`);
  check(ansicht.view === ansichtOhne.view && ansicht.view.length > 50, 'mit derselben Ansicht, Zeichen für Zeichen');
  const adresse = page.url();
  check(!/#/.test(adresse) && !adresse.includes(KENNUNG), `danach steht der Link nicht mehr in der Adresse (${adresse})`);
  check(await page.evaluate(() => location.hash === ''), 'location.hash ist leer – die App sieht ihn nie');
  await page.clock.fastForward(1);
  await bis(async () => /Bildschirmzeit verbunden/.test(await toasts(page)), 2000);
  check(/Bildschirmzeit verbunden: Diese App meldet ab jetzt ihre Minuten an dein Widget\./.test(await toasts(page)),
    `der Hinweis kommt über den Toast der App („${(await toasts(page)).slice(0, 90)}")`);

  const erste = server.melden()[0];
  check(!!erste && erste.body && erste.body.p_kennung === KENNUNG && erste.body.p_app === 'workout',
    `gleich nach dem Verbinden: POST bildschirmzeit_melden mit p_app 'workout' (${erste ? JSON.stringify({ ...erste.body, p_kennung: '…' }) : 'keiner'})`);
  check(!!erste && erste.body.p_tage && erste.body.p_tage[HEUTE] === 0 && Object.keys(erste.body.p_tage).length === 1,
    'mit heute = 0 – damit die Widget-App „verbunden" sieht');
  check(!!erste && erste.kopf.apikey === SCHLUESSEL && !('authorization' in erste.kopf),
    'Kopf: nur apikey mit dem öffentlichen Schlüssel, kein Authorization (der Schlüssel ist kein JWT)');
  check(!!erste && /^https:\/\/vjyohppohmvhhxgwouti\.supabase\.co\/rest\/v1\/rpc\/bildschirmzeit_melden$/.test(erste.url),
    'an die Funktion im Projekt vjyohppohmvhhxgwouti');
  check(server.anfragen.every((a) => !a.url.includes(KENNUNG)), 'die Kennung steht nie in einer Adresse');
  check(JSON.stringify(await bzSpeicher(page)) === '["bildschirmzeit.workout"]',
    `gespeichert unter „bildschirmzeit.workout" und nirgends sonst (${(await bzSpeicher(page)).join(', ')})`);
  check((await bzStand(page)).kennung === KENNUNG, 'die Kennung liegt dort');

  await zuMehr(page);
  check(await page.locator('#bildschirmzeit').count() === 1 && await page.locator('#bildschirmzeitKarte').isVisible(),
    'unter Mehr steht der Abschnitt „Bildschirmzeit"');
  const zeile = await text(page, '#bildschirmzeitStand');
  check(/^Verbunden mit deinem Widget\. Heute unter 1 Min\. offen, zuletzt gemeldet um 10:0\d\.$/.test(zeile), `„${zeile}"`);
  check(await page.locator('#bildschirmzeitFehler').count() === 0, 'ohne Fehler keine Fehlerzeile');
  check(await page.locator('#bildschirmzeitKarte [data-act="bildschirmzeit-trennen"]').count() === 1, 'mit dem Knopf „Trennen"');
  check(!(await ganzeSeite(page)).includes(KENNUNG), 'die Kennung steht nirgends auf dem Bildschirm');

  /* ================================================================ *
   * C – die Zeit
   * ================================================================ */
  if (abschnitt('C') || abschnitt('D')) {
    console.log('--- C: die Zeit ---');
    await vor(page, 3 * 60 * 1000);
    const nach3 = (await bzStand(page)).tage[HEUTE];
    check(nach3 >= 175 && nach3 <= 200, `drei Minuten sichtbar: ${Math.round(nach3)} s gezählt`);
    const vorFuenf = server.melden().length;
    await vor(page, 2 * 60 * 1000 + 15000);
    await bis(() => server.melden().length > vorFuenf, 2000);
    const fuenf = server.melden()[server.melden().length - 1];
    check(server.melden().length === vorFuenf + 1 && fuenf.body.p_tage[HEUTE] >= 290 && fuenf.body.p_tage[HEUTE] <= 330,
      `nach fünf Minuten geht der Tagesstand von selbst hinaus (${fuenf ? fuenf.body.p_tage[HEUTE] : '?'} s)`);
    await echteWarte(300);
    const zeile5 = await text(page, '#bildschirmzeitStand');
    check(/Heute 5 Min\. offen, zuletzt gemeldet um 10:0\d\./.test(zeile5), `die Karte zieht nach, ohne Neuaufbau der Seite („${zeile5}")`);

    // Wegschalten: mit keepalive, und danach zählt nichts mehr.
    await vor(page, 30 * 1000);
    const vorWeg = (await abrufe(page)).length;
    await verstecken(page);
    await bis(async () => (await abrufe(page)).slice(vorWeg).some((a) => /bildschirmzeit_melden/.test(a.url)), 2000);
    const weg = (await abrufe(page)).slice(vorWeg).filter((a) => /bildschirmzeit_melden/.test(a.url));
    const wegBody = weg.length ? JSON.parse(weg[0].body) : {};
    check(weg.length === 1 && weg[0].keepalive === true, `beim Wegschalten geht der Stand mit keepalive hinaus (${weg.length}×)`);
    check(weg.length === 1 && weg[0].laenge < 400 && wegBody.p_tage[HEUTE] >= 320,
      `klein (${weg.length ? weg[0].laenge : '?'} Byte) und mit der Zeit bis zum Wegschalten (${wegBody.p_tage ? wegBody.p_tage[HEUTE] : '?'} s)`);
    const vorVerborgen = (await bzStand(page)).tage[HEUTE];
    await vor(page, 2 * 60 * 1000);
    check(Math.abs((await bzStand(page)).tage[HEUTE] - vorVerborgen) < 1, 'weggeschaltet zählt nichts – zwei Minuten später derselbe Stand');
    const vorDa = server.melden().length;
    await zeigen(page);
    await vor(page, 45 * 1000);
    check((await bzStand(page)).tage[HEUTE] > vorVerborgen + 30, 'wieder da, zählt es weiter');
    check(server.melden().length === vorDa, 'beim Zurückkommen ohne Neues keine Anfrage (alles schon bestätigt)');
  }

  /* ================================================================ *
   * D – der Server kennt die Kennung nicht mehr, oder kommt nicht durch
   * ================================================================ */
  if (abschnitt('D')) {
    console.log('--- D: Fehler und false ---');
    server.status = 503;
    const vorFehler = server.melden().length;
    await vor(page, 5 * 60 * 1000);
    await bis(() => server.melden().length > vorFehler, 2000);
    await echteWarte(300);
    check(/^Zuletzt nicht durchgekommen: Fehler 503\.$/.test(await text(page, '#bildschirmzeitFehler')),
      `ein Fehler steht unter Mehr („${await text(page, '#bildschirmzeitFehler')}")`);
    server.status = 200;
    const vorWieder = server.melden().length;
    await vor(page, 5 * 60 * 1000);
    await bis(() => server.melden().length > vorWieder, 2000);
    await echteWarte(300);
    check(await page.locator('#bildschirmzeitFehler').count() === 0, 'kommt es wieder durch, ist die Zeile weg');

    server.antwort = false;
    const vorFalse = server.melden().length;
    await vor(page, 5 * 60 * 1000);
    await bis(() => server.melden().length > vorFalse, 2000);
    await bis(async () => await page.locator('#bildschirmzeit').count() === 0, 2000);
    check(await page.locator('#bildschirmzeit, #bildschirmzeitKarte').count() === 0, 'Antwort false: der Abschnitt ist weg');
    check(/Bildschirmzeit getrennt: Die Widget-App kennt diese Verbindung nicht mehr\./.test(await toasts(page)),
      'und der Hinweis sagt „getrennt"');
    check((await bzSpeicher(page)).length === 0, 'der Speicher ist leer – samt Kennung');
    const danach = server.bz().length;
    await vor(page, 6 * 60 * 1000);
    await verstecken(page);
    await echteWarte(300);
    await zeigen(page);
    check(server.bz().length === danach, 'danach geht nichts mehr hinaus');
    check(/Sätze|Volumen|Einheiten/.test(await text(page)), 'Mehr steht weiter da, wie es war');
  }
  await zu(g);
}

/* ================================================================== *
 * E – Link auf die offene App, Trennen, Alle Daten löschen
 * ================================================================== */
if (abschnitt('E')) {
  console.log('--- E: offene App, Trennen, Alle Daten löschen ---');
  const g = await geraet('E');
  const { page, server } = g;
  // Zum Vergleich: ein Anker, den niemand kennt, auf die offene App unter Mehr.
  await zuMehr(page);
  await page.evaluate(() => { location.hash = 'unbekannt'; });
  await echteWarte(300);
  const reiterSonst = await page.evaluate(() => (document.querySelector('.tab[aria-selected="true"]') || {}).dataset?.tab || '');
  check(reiterSonst === 'dashboard', `zum Vergleich: ein unbekannter Anker auf die offene App geht wie bisher aufs Dashboard (${reiterSonst})`);
  await page.evaluate(() => history.replaceState(history.state, '', location.pathname));
  await zuMehr(page);
  check(await page.locator('#bildschirmzeit').count() === 0, 'vorher kein Abschnitt');
  await page.evaluate((k) => { location.hash = `bildschirmzeit=${k}`; }, KENNUNG_2);
  await bis(() => server.melden().length > 0, 3000);
  check(server.melden().length === 1 && server.melden()[0].body.p_kennung === KENNUNG_2,
    'ein Link auf die schon offene App (hashchange) verbindet ebenso');
  check(await page.evaluate(() => location.hash === '' && !location.href.includes('#')), 'der Link ist wieder aus der Adresse');
  await echteWarte(300);
  const reiter = await page.evaluate(() => (document.querySelector('.tab[aria-selected="true"]') || {}).dataset?.tab || '');
  check(reiter === 'settings', `die App bleibt dabei unter Mehr (${reiter}; ein anderer Anker: ${reiterSonst})`);
  check(await page.locator('#bildschirmzeit').count() === 1, 'und dort steht der Abschnitt gleich, ohne Neuladen');

  await page.locator('[data-act="bildschirmzeit-trennen"]').click();
  await echteWarte(300);
  check(await page.locator('#bildschirmzeit, #bildschirmzeitKarte').count() === 0, '„Trennen": der Abschnitt ist weg');
  check((await bzSpeicher(page)).length === 0, 'und der Speicher leer');
  check(/Bildschirmzeit getrennt/.test(await toasts(page)), 'der Hinweis sagt es');
  const nachTrennen = server.bz().length;
  await vor(page, 6 * 60 * 1000);
  await verstecken(page);
  await echteWarte(300);
  await zeigen(page);
  check(server.bz().length === nachTrennen, 'getrennt geht nichts mehr hinaus – auch nicht beim Wegschalten');

  // Wieder verbinden (derselbe Weg), dann „Alle Daten löschen".
  const vorWieder = server.melden().length;
  await page.evaluate((k) => { location.hash = `bildschirmzeit=${k}`; }, KENNUNG_2);
  await bis(() => server.melden().length > vorWieder, 3000);
  await zuMehr(page);
  check(await page.locator('#bildschirmzeit').count() === 1, 'wieder verbunden');
  let frage = '';
  page.once('dialog', (d) => { frage = d.message(); });
  await page.locator('[data-act="reset-all"]').click();
  await echteWarte(500);
  check(/Die Bildschirmzeit wird getrennt/.test(frage), `„Alle Daten löschen" sagt, dass die Bildschirmzeit mitgeht („…${frage.slice(-80)}")`);
  check((await bzSpeicher(page)).length === 0, 'und trennt sie');
  await zu(g);

  // Nicht verbunden fragt „Alle Daten löschen" wie bisher.
  const g2 = await geraet('E2');
  await zuMehr(g2.page);
  let frage2 = '';
  g2.page.once('dialog', (d) => { frage2 = d.message(); });
  await g2.page.locator('[data-act="reset-all"]').click();
  await echteWarte(400);
  check(/^Wirklich alle protokollierten Sätze und Einstellungen löschen\?$/.test(frage2),
    `nicht verbunden: dieselbe Frage wie vor v263 („${frage2}")`);
  check((await bzSpeicher(g2.page)).length === 0 && g2.server.bz().length === 0, 'und nichts von der Bildschirmzeit');
  await zu(g2);

  // Mitten in der Einheit: Tobi sieht in der Pause aufs Widget und tippt dort
  // „Verbinden". Bis zur Nachbesserung warf der Link aus der Fokusansicht
  // aufs Dashboard (popstate ohne Stand).
  const g3 = await geraet('E3');
  const p3 = g3.page;
  await p3.locator('[data-act="start-session"]').first().click();
  await echteWarte(400);
  const fokus = async () => ({
    fokus: await p3.locator('#view section.fo').count() === 1,
    kopf: (await text(p3, '#view .focus-count')).replace(/⏱ \S+ · /, ''),
  });
  const vorher = await fokus();
  check(vorher.fokus && /Übung 1 von/.test(vorher.kopf), `vorher in der Fokusansicht („${vorher.kopf}")`);
  const vorEintraege = await p3.evaluate(() => history.length);
  await p3.evaluate((k) => { location.hash = `bildschirmzeit=${k}`; }, KENNUNG_2);
  await bis(() => g3.server.melden().length > 0, 3000);
  await echteWarte(300);
  const nachher = await fokus();
  check(g3.server.melden().length === 1 && (await bzSpeicher(p3)).length === 1, 'der Link verbindet auch mitten in der Einheit');
  check(nachher.fokus && nachher.kopf === vorher.kopf,
    `und die App bleibt in der Fokusansicht, bei derselben Übung („${nachher.kopf}")`);
  check(await p3.evaluate(() => location.hash === '' && !!history.state && history.state.focus === true),
    'der Link ist aus der Adresse, der Eintrag im Verlauf trägt den Stand der Oberfläche (Fokus)');
  await p3.clock.fastForward(1);
  await bis(async () => /Bildschirmzeit verbunden/.test(await toasts(p3)), 2000);
  check(/Bildschirmzeit verbunden/.test(await toasts(p3)), 'der Hinweis kommt trotzdem');
  check((await fokus()).fokus, 'und die Fokusansicht bleibt auch danach');
  check(await p3.evaluate(() => history.length) <= vorEintraege + 1, 'höchstens ein Eintrag mehr im Verlauf');
  await p3.goBack().catch(() => {});
  await echteWarte(400);
  const zurueck = await fokus();
  check(zurueck.fokus && zurueck.kopf === vorher.kopf, `einmal Zurück: noch immer dieselbe Übung in der Fokusansicht („${zurueck.kopf}")`);
  // Zum Vergleich, damit der Test nicht nur die Fokusansicht an sich sieht:
  // ein unbekannter Anker mitten in der Einheit geht wie bisher aufs Dashboard.
  await p3.evaluate(() => { location.hash = 'unbekannt'; });
  await echteWarte(400);
  check(!(await fokus()).fokus, 'ein unbekannter Anker verlässt die Fokusansicht wie bisher');
  await zu(g3);
}

/* ================================================================== *
 * F – die anderen Links der App
 * ================================================================== */
const codeVon = (obj) => Buffer.from(JSON.stringify(obj), 'utf8').toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const STAND = { v: 1, n: 'Jo', w: 12, s: 140, kg: 5200, r: 3, p: 84, d: '2026-11-13' };
const EISEN = { stange: { kh: 2, lh: 10 }, scheiben: [[1.25, 8], [2.5, 4]] };
if (abschnitt('F')) {
  console.log('--- F: die anderen Links ---');
  // Kalt, ohne Bildschirmzeit: der Stand-Link wie bisher.
  const g = await geraet('F', { zustand: { ...KIM, tab: 'stats' }, anker: `#stand=${codeVon(STAND)}` });
  const { page, server } = g;
  check(/Jo hat dir seinen Stand geschickt/.test(await text(page)) && await page.locator('[data-act="accept-stand"]').count() === 1,
    'der Stand-Link öffnet wie bisher das Dashboard mit dem Angebot');
  check(!page.url().includes('#'), 'und ist aus der Adresse');
  check((await bzSpeicher(page)).length === 0 && server.bz().length === 0, 'die Bildschirmzeit bleibt still');
  await page.locator('[data-act="accept-stand"]').click();
  await echteWarte(300);

  // Verbinden, dann kommen die anderen Links auf die offene App.
  await page.evaluate((k) => { location.hash = `bildschirmzeit=${k}`; }, KENNUNG);
  await bis(() => server.melden().length > 0, 3000);
  await zuMehr(page);
  await page.evaluate((c) => { location.hash = `stand=${c}`; }, codeVon({ ...STAND, n: 'Kai' }));
  await echteWarte(500);
  check(/Kai hat dir seinen Stand geschickt/.test(await text(page)), 'verbunden: ein Stand-Link auf die offene App geht wie bisher (hashchange)');
  check((await bzStand(page) || {}).kennung === KENNUNG, 'und lässt die Bildschirmzeit, wie sie ist');
  await page.evaluate((c) => { location.hash = `eisen=${c}`; }, codeVon(EISEN));
  await echteWarte(500);
  const scheiben = await page.evaluate(async () => (await import('./js/store.js')).getState().scheiben || null);
  check(!!scheiben && scheiben.scheiben.length === 2 && scheiben.stange.lh === 10, 'ein Scheiben-Link (#eisen=) ebenso');
  check(!page.url().includes('#'), 'beide verlassen die Adresse wie bisher');
  check(server.melden().length >= 1 && server.melden().every((a) => a.body.p_kennung === KENNUNG), 'die Bildschirmzeit meldet weiter unter ihrer Kennung');
  await zu(g);

  // Kalt mit Bildschirmzeit verbunden: der Scheiben-Link wie bisher.
  const g2 = await geraet('F2', { anker: `#bildschirmzeit=${KENNUNG}` });
  await bis(() => g2.server.melden().length > 0, 3000);
  // Über about:blank: Sonst wäre es nur ein Sprung im selben Dokument (hashchange).
  await g2.page.goto('about:blank');
  await g2.page.goto(`${APP}#eisen=${codeVon({ ...EISEN, scheiben: [[5, 2]] })}`, { waitUntil: 'load' });
  await echteWarte(600);
  const s2 = await g2.page.evaluate(async () => (await import('./js/store.js')).getState().scheiben || null);
  check(!!s2 && s2.scheiben.length === 1 && s2.scheiben[0][0] === 5, 'verbunden und neu geladen: #eisen= geht wie bisher');
  check((await bzStand(g2.page) || {}).kennung === KENNUNG, 'und die Verbindung bleibt über das Neuladen');
  await zu(g2);
}

/* ================================================================== *
 * G – Wegschalten mit Sicherung und Kalender; nichts davon in Sicherung,
 *     Export, Diagnose
 * ================================================================== */
const TOBI = JSON.parse(readFileSync(path.join(ROOT, 'tests', 'zusatz-tobi-do.json'), 'utf8'));
const KAL = {
  url: 'https://script.google.com/macros/s/AKfycbTestWidgetAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/exec',
  token: 'Testkennwort_Widgetprobe_0123456789abcdefgh',
};
const G_START = Date.parse('2026-10-08T10:00:00+02:00');

/**
 * Ein Gerät mit Sicherung und Kalender, eine Änderung, dann weg: Was geht mit
 * keepalive hinaus, in welcher Reihenfolge? `bz`: vorher per Link verbunden.
 */
async function wegschalten(name, bz) {
  const lab = labor(browser);
  lab.uhr = G_START;
  const g = await geraet(name, {
    zustand: TOBI, sicherung: lab, kalender: KAL, zeit: G_START, anker: bz ? `#bildschirmzeit=${KENNUNG}` : '',
  });
  const { page, skript, server } = g;
  // Der Start: die erste Sicherung (nach drei Sekunden) und die Vorschau für heute.
  await page.clock.fastForward(4000);
  await bis(() => lab.geschrieben().length > 0 && skript.vorschauen().length > 0, 8000);
  await ruhig(page);
  const start = { sicherung: lab.geschrieben().length, kalender: skript.vorschauen().length };
  // Eine Änderung: Beide bereiten vor, die Drossel hält sie zurück.
  lab.uhr += 15000;
  await page.clock.fastForward(15000);
  await ruhig(page);
  await page.evaluate(async () => (await import('./js/store.js')).setSetting('injuries', ['ac-gelenk']));
  lab.uhr += 2500;
  await page.clock.fastForward(2500);
  await echteWarte(1500);
  await ruhig(page);
  lab.uhr += 1000;
  await page.clock.fastForward(1000);
  await echteWarte(800);
  await ruhig(page);
  const vorher = (await abrufe(page)).length;
  const vorherS = lab.geschrieben().length;
  const vorherK = skript.vorschauen().length;
  await verstecken(page);
  await bis(() => lab.geschrieben().length > vorherS && skript.vorschauen().length > vorherK
    && (!bz || server.melden().length > 1), 5000);
  await echteWarte(500);
  const weg = (await abrufe(page)).slice(vorher).filter((a) => a.keepalive);
  const art = (a) => (/sicherung_schreiben/.test(a.url) ? 'sicherung' : /script\.google/.test(a.url) ? 'kalender'
    : /bildschirmzeit_melden/.test(a.url) ? 'bildschirmzeit' : a.url);
  return { g, lab, start, weg: weg.map((a) => ({ art: art(a), laenge: a.laenge })) };
}

if (abschnitt('G')) {
  console.log('--- G: Sicherung, Kalender, Export, Diagnose ---');
  const ohne = await wegschalten('G-ohne', false);
  const mit = await wegschalten('G-mit', true);
  const zeig = (w) => w.map((a) => `${a.art} ${a.laenge} B`).join(', ');
  console.log(`     ohne Bildschirmzeit: ${zeig(ohne.weg)}`);
  console.log(`     mit Bildschirmzeit:  ${zeig(mit.weg)}`);
  check(ohne.start.sicherung > 0 && ohne.start.kalender > 0, `die Probe trägt: gesichert und Vorschau geschickt beim Start (${ohne.start.sicherung}/${ohne.start.kalender})`);
  check(ohne.weg.map((a) => a.art).join(',') === 'sicherung,kalender',
    `ohne Bildschirmzeit: beim Wegschalten Sicherung, dann Kalender, beide mit keepalive (${zeig(ohne.weg)})`);
  const mitOhneBz = mit.weg.filter((a) => a.art !== 'bildschirmzeit');
  check(mitOhneBz.map((a) => a.art).join(',') === 'sicherung,kalender'
    && mitOhneBz.every((a, i) => ohne.weg[i] && Math.abs(a.laenge - ohne.weg[i].laenge) <= 64),
  'verbunden: Sicherung und Kalender gehen genauso hinaus – dieselben Anfragen, (fast) dieselbe Größe');
  check(mit.weg.length === 3 && mit.weg[2].art === 'bildschirmzeit',
    `die Bildschirmzeit geht als Letzte hinaus, erst nach beiden (${zeig(mit.weg)})`);
  const summe = mit.weg.reduce((s, a) => s + a.laenge, 0);
  check(mit.weg.length === 3 && mit.weg[2].laenge < 300, `und klein: ${mit.weg.length === 3 ? mit.weg[2].laenge : '?'} Byte von zusammen ${summe}`);

  // Die Kennung: nicht in der Sicherung (entschlüsselt), nicht im Export, nicht im Diagnoseprotokoll.
  const { page, server } = mit.g;
  const key = (await sicherungMeta(page)).key;
  const geschrieben = mit.lab.geschrieben();
  let klar = '';
  for (const s of geschrieben) klar += await entschluesseln(key, s.body.p_daten, s.body.p_iv);
  check(geschrieben.length >= 2 && klar.length > 1000 && !klar.includes(KENNUNG) && !/bildschirmzeit/i.test(klar),
    `die Sicherung trägt die Kennung nicht – auch entschlüsselt nicht (${geschrieben.length} Sicherungen, ${Math.round(klar.length / 1024)} KB Klartext)`);
  await zeigen(page);
  await echteWarte(300);
  await zuMehr(page);
  await page.locator('[data-act="export"]').click();
  await echteWarte(300);
  const exportText = await page.locator('#io').inputValue();
  check(exportText.length > 1000 && !exportText.includes(KENNUNG) && !/bildschirmzeit/i.test(exportText),
    `der Export (Mehr → Daten) trägt sie nicht (${Math.round(exportText.length / 1024)} KB)`);
  const datei = await page.evaluate(async () => (await import('./js/store.js')).exportJSON());
  check(!datei.includes(KENNUNG), 'die Sicherungsdatei (exportJSON) ebenso nicht');
  await page.locator('[data-act="diagnose-ansehen"]').click();
  await echteWarte(300);
  const diag = await page.locator('#diagnoseText').inputValue();
  check(/Bildschirmzeit verbunden, heute \d+ Min\., gemeldet /.test(diag), 'der Kopf des Diagnoseprotokolls sagt, dass sie verbunden ist');
  check(/ bildschirmzeit was=verbunden/.test(diag), 'das Protokoll vermerkt das Verbinden');
  check(!diag.includes(KENNUNG) && !(await page.evaluate(() => localStorage.getItem('workout.diagnose.v1') || '')).includes(KENNUNG),
    'aber nie die Kennung – weder im Text noch im Speicher des Protokolls');
  const fremd = server.anfragen.filter((a) => !a.name.startsWith('bildschirmzeit_'));
  check(fremd.length > 0 && fremd.every((a) => !a.roh.includes(KENNUNG) && !a.url.includes(KENNUNG))
    && mit.g.skript.anfragen.every((a) => !a.roh.includes(KENNUNG)),
  `keine andere Anfrage trägt sie – Sicherung, Rückkanal, Kalender (${fremd.length + mit.g.skript.anfragen.length} geprüft)`);
  await zu(ohne.g);
  await zu(mit.g);
}

/* ================================================================== *
 * H – die Einzeldatei
 * ================================================================== */
if (abschnitt('H')) {
  console.log('--- H: Einzeldatei ---');
  const ohne = await geraet('H-ohne', { adresse: EINZEL });
  await vor(ohne.page, 6 * 60 * 1000);
  check(ohne.server.bz().length === 0 && (await bzSpeicher(ohne.page)).length === 0, 'die Einzeldatei schweigt ohne Link');
  await zuMehr(ohne.page);
  check(!/Bildschirmzeit/.test(await ganzeSeite(ohne.page)), 'und zeigt nichts davon');
  await zu(ohne);
  const mit = await geraet('H-mit', { adresse: EINZEL, anker: `#bildschirmzeit=${KENNUNG}` });
  await bis(() => mit.server.melden().length > 0, 3000);
  check(mit.server.melden().length === 1 && mit.server.melden()[0].body.p_app === 'workout', 'mit Link verbindet sie wie die App (im Bündel in eigenem Gültigkeitsbereich)');
  await zuMehr(mit.page);
  check(await mit.page.locator('#bildschirmzeitKarte').count() === 1, 'und zeigt den Abschnitt');
  await zu(mit);
  const html = readFileSync(path.join(ROOT, 'dist', 'workout.html'), 'utf8');
  const aussen = (/const \{ (BZ_EREIGNIS, [^}]*) \} = \(\(\) => \{/.exec(html) || [])[1] || '';
  const importiert = (/import \{([^}]*)\} from '\.\/bildschirmzeit\.js';/.exec(readFileSync(path.join(ROOT, 'js', 'app.js'), 'utf8')) || [])[1] || '';
  const namen = (t) => t.split(',').map((n) => n.trim()).filter(Boolean).sort().join(', ');
  check(!!aussen && namen(aussen) === namen(importiert), `im Bündel nach außen nur, was app.js importiert (${namen(aussen)})`);
}

// I. Tobi, 19.11.: „Hab nh zusätzliche App die noch nicht connected ist. Geht um die Bewerbungs app“ –
//    die Quelle (Finanzdienste/Bildschirmzeit, web/bildschirmzeit.js) kennt seitdem vier Apps; die Kopie muss dieselbe sein.
if (abschnitt('I')) {
  const liste = (t) => ((/(?:export )?const BZ_APPS = \[([^\]]*)\]/.exec(t) || [])[1] || '').split(',').map((s) => s.trim().replace(/'/g, '')).filter(Boolean).join(', ');
  const kopie = liste(readFileSync(path.join(ROOT, 'js', 'bildschirmzeit.js'), 'utf8'));
  check(kopie === 'boxenstopp, freizeit, workout, bewerbungszentrale', `js/bildschirmzeit.js ist die Fassung mit der Bewerbungszentrale (BZ_APPS: ${kopie})`);
  const einzeln = liste(readFileSync(path.join(ROOT, 'dist', 'workout.html'), 'utf8'));
  check(einzeln === kopie, `die Einzeldatei hat dieselbe Liste (${einzeln})`);
}

check(seitenFehler.length === 0, `keine Fehler in der Seite${seitenFehler.length ? `: ${seitenFehler.slice(0, 3).join(' | ')}` : ''}`);
for (const ctx of offen) await ctx.close().catch(() => {});
await browser.close();
console.log(fails ? `\n${fails} Prüfung(en) gescheitert` : '\nalles grün');
