/*
 * Das Diagnoseprotokoll: Die App schreibt mit, was sie technisch tut – auf dem
 * Gerät, sichtbar, abschaltbar, und nichts geht von selbst irgendwohin.
 *
 *     „Können wir nicht allgemein alles mögliche im Hintergrund loggen damit du
 *      siehst was funktioniert und was nicht oder so?"
 *
 * Gemessen wird, was die Zusage ausmacht, nicht nur, dass Zeilen entstehen:
 *
 *   1. Start: eine Startzeile mit Browser, Fenster, Zeitzone, Speicherlage und
 *      Plan; die Fassung aus dem Zwischenspeicher eine Zeile später; der Grund
 *      eines Neuladens, das die App selbst auslöst; installiert oder nicht. Im
 *      Speicher steht sie erst mit dem Wegschalten – nie im Start selbst.
 *   2. Keine Last im Training: Abgehakte Sätze schreiben das Protokoll nicht –
 *      null setItem auf seinen Schlüssel im Tipp, der Store schreibt wie immer.
 *      Geschrieben wird gebündelt, eine Schreibung für alles, was anstand.
 *   3. Fehler landen sofort im Speicher – geworfene, abgelehnte Versprechen,
 *      fehlende Dateien –, eine Flut als eine Zeile mit „×n", und weder ein
 *      Schlüssel aus dem Anker noch der zitierte Anfang eines JSON-Textes.
 *   4. Pause und Ton: Start, Auflegen, Ablauf mit dem, was endRest() entschied,
 *      Wegtippen, +30 s, der Kontext und woher er kam. Ohne Berührung: der Ton
 *      vorgemerkt, mit der ersten Berührung nachgeholt – oder nach der Frist
 *      verfallen, mit Grund; ein fälliges Signal ohne Kontext als verpasst.
 *   5. Tagesabschluss: Die liegen gebliebene Einheit schließt sich ab, die
 *      Sitzung endet – das Protokoll sagt, welche, mit wie vielen Sätzen, und
 *      dass die Uhr am letzten Lebenszeichen stehen blieb.
 *   6. Sicherung: gelungen und gescheitert, mit Grund – und weder der Schlüssel
 *      noch die Kennung im Protokoll; keine Anfrage trägt eine Protokollzeile.
 *   7. Ansehen: die Karte unter Mehr → Daten mit Zusammenfassung, der Lage zum
 *      Abfotografieren und dem ganzen Text.
 *   8. Teilen: eine .txt mit genau text/plain, Kopf oben – ohne Namen, Gewicht,
 *      Sicherungsschlüssel, Wiederherstellungslink, Betreiber-Passwort oder
 *      Server-Schlüssel. Abbruch still, Ablehnung endet im Download.
 *   9. Kopieren: in die Zwischenablage, sonst markiert im Feld.
 *  10. Löschen leert, der Schalter aus schreibt nichts mehr – auch nach dem
 *      Neuladen nicht –, und „Alle Daten löschen" räumt mit und stellt ihn an.
 *  11. Ringpuffer: 64 KB, das Älteste fällt vorn weg; Zeilen älter als 14 Tage
 *      fallen beim Laden weg.
 *  12. Volle Ablage: Meldet der Store „voll", gibt das Protokoll seinen Platz
 *      sofort frei und läuft im Arbeitsspeicher weiter; ist der Speicher knapp,
 *      legt es sich gar nicht erst hinein. Nichts bricht, das Training geht
 *      weiter, Teilen geht weiter.
 *  13. Nichts geht raus: js/diagnose.js hat keinen Weg nach draußen, die Knöpfe
 *      lösen keine Anfrage aus, die Sicherungsdatei kennt das Protokoll nicht.
 *  14. Die Einzeldatei: läuft ohne Fehler, sagt „einzeldatei=true", hat die
 *      Karte.
 *
 * Gegenprobe gegen 87e4cd1 (vor dem Protokoll): 16 Prüfungen rot, in allen
 * 14 Abschnitten – 1 bis 6, 11 und 12 brechen ab, weil js/diagnose.js fehlt
 * (404), 7 und 10, weil die Karte fehlt, 13, weil die Datei fehlt; in 3, 12 und
 * 14 schon vorher rot: kein Fehler im Speicher, kein Protokoll, keine
 * Startzeile, keine Karte. Grün bleiben nur die Vorbereitung („der Speicher ist
 * dicht") und „14 Einzeldatei: keine Fehler".
 *
 * DIAGNOSE_NUR=1,5 lässt nur diese Abschnitte laufen.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { URL, EINZEL, ROOT } from './umgebung.mjs';
import { START, labor, meta } from './sicherung-labor.mjs';

const browser = await chromium.launch();
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };
const nur = (process.env.DIAGNOSE_NUR || '').split(',').filter(Boolean);
const offen = new Set();
const D = './js/diagnose.js';
const KEY = 'workout.diagnose.v1';
const AUS = 'workout.diagnose.aus';

// Ein Sicherungsschlüssel, wie die App ihn macht (43 Zeichen base64url), und ein
// Betreiber-Passwort – beides darf nirgends im Protokoll auftauchen.
const GEHEIM = 'Gx7Kp2Qw9Lm4Zr8Tn6Vb3Hd5Js1Fa0Ye_CuXoWiNq-A';
const PASSWORT = 'Betreiber-Passwort-4711';
const NAME = 'Tobi-Testname';
const GRUND = {
  greeted: true, name: NAME, restSeconds: 0, useExerciseRest: false, log: {}, sound: true, soundSets: true,
  weights: { 'goblet-squat': 37.75 }, adminPass: PASSWORT,
};

/**
 * Ein Fall in eigenem Browserkontext – eigener Speicher, frisches Protokoll.
 * `zustand` wird vor dem ersten Laden gesät, `vorher` läuft vor jedem Laden
 * (Attrappen). `window.__hidden` schaltet die App weg.
 */
async function fall(name, { zustand = GRUND, sw = false, vorher = null, adresse = URL } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 414, height: 896 }, serviceWorkers: sw ? 'allow' : 'block', acceptDownloads: true,
  });
  offen.add(ctx);
  await ctx.route('**/rest/v1/**', (r) => r.fulfill({ status: 204, body: '' }));
  await ctx.addInitScript(() => {
    window.__hidden = false;
    Object.defineProperty(document, 'hidden', { get: () => window.__hidden, configurable: true });
    Object.defineProperty(document, 'visibilityState', {
      get: () => (window.__hidden ? 'hidden' : 'visible'), configurable: true,
    });
    navigator.vibrate = () => true;
    // Ein Stand für das nächste Laden (Abschnitt 5): vor der App gesät, damit
    // nichts aus dem laufenden Fenster ihn beim Schließen überschreibt.
    const neu = sessionStorage.getItem('__neu');
    if (neu) {
      sessionStorage.removeItem('__neu');
      localStorage.setItem('workout.state.v1', neu);
    }
  });
  if (vorher) await ctx.addInitScript(vorher);
  if (zustand) {
    await ctx.addInitScript(({ s, pass }) => {
      if (sessionStorage.getItem('__gesaet')) return;
      sessionStorage.setItem('__gesaet', '1');
      sessionStorage.setItem('workout.adminPass', pass);
      localStorage.setItem('workout.state.v1', JSON.stringify(s));
    }, { s: zustand, pass: PASSWORT });
  }
  const page = await ctx.newPage();
  page.setDefaultTimeout(5000);
  const errs = [];
  const anfragen = [];
  page.on('pageerror', (e) => errs.push(`PAGEERROR: ${e.message}`));
  page.on('request', (r) => anfragen.push(`${r.method()} ${r.url()}`));
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.goto(adresse, { waitUntil: 'networkidle' });
  await page.waitForTimeout(250);
  const f = {
    name, ctx, page, errs, anfragen,
    zeilen: () => page.evaluate(async (d) => (await import(d)).diagnoseZeilen(), D),
    gespeichert: () => page.evaluate((k) => localStorage.getItem(k), KEY),
    schreiben: () => page.evaluate(async (d) => (await import(d)).diagnoseSchreiben(), D),
    stand: () => page.evaluate(async (d) => (await import(d)).diagnoseStand(), D),
    klick: async (sel, ms = 250) => {
      await page.locator(sel).first().click();
      await page.waitForTimeout(ms);
    },
    zuMehr: async () => {
      await page.locator('.tab[data-tab="settings"]').click();
      await page.waitForTimeout(250);
    },
    weg: () => page.evaluate(() => { window.__hidden = true; document.dispatchEvent(new Event('visibilitychange')); }),
    da: () => page.evaluate(() => { window.__hidden = false; document.dispatchEvent(new Event('visibilitychange')); }),
    neu: async () => {
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(300);
    },
  };
  return f;
}
async function ende(f, absicht = /^$/) {
  const echt = f.errs.filter((e) => !absicht.test(e));
  check(echt.length === 0, `${f.name}: keine Fehler${echt.length ? ` – ${echt.slice(0, 2).join(' | ')}` : ''}`);
  offen.delete(f.ctx);
  await f.ctx.close();
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
const hat = (zeilen, re) => zeilen.some((z) => re.test(z));
const zeige = (zeilen, re) => (zeilen.find((z) => re.test(z)) || '(keine)').slice(0, 200);

/* ------------------------------------------------------------------ *
 * 1. Start
 * ------------------------------------------------------------------ */
await abschnitt(1, async () => {
  const f = await fall('1 Start', { sw: true });
  let z = await f.zeilen();
  const starts = z.filter((x) => / start anzeige=/.test(x));
  const s = starts[0] || '';
  console.log(`     ${s.slice(0, 190)}`);
  check(starts.length === 1, `genau eine Startzeile (${starts.length})`);
  check(/ einzeldatei=false/.test(s) && / anzeige=browser/.test(s) && / ua=Chrome\/\d+,/.test(s)
    && / sicht=414x896/.test(s) && / online=true/.test(s) && / speicher=ok/.test(s)
    && / plan=\d+/.test(s) && / tz=[+-]\d\d:\d\d/.test(s) && / grund=-/.test(s),
  'mit Einzeldatei, Anzeige, Browser, Fenster, Netz, Speicherlage, Plan, Zeitzone und Grund');
  const st = s.slice(0, 23);
  check(st.length === 23 && st[4] === '-' && st[7] === '-' && st[10] === ' ' && st[13] === ':' && st[16] === ':'
    && st[19] === '.' && !Number.isNaN(Date.parse(st.replace(' ', 'T'))),
  `der Stempel ist Ortszeit mit Millisekunden, lexikografisch sortierbar (${st})`);
  check(!s.includes(NAME), 'kein Name in der Startzeile');
  check(await f.gespeichert() === null,
    'im Start selbst wird nicht geschrieben – die Zeilen warten auf die Drossel');
  await f.weg();
  await f.page.waitForTimeout(100);
  const nachWeg = (await f.gespeichert()) || '';
  check(/ start anzeige=/.test(nachWeg) && / sicht zu=weg/.test(nachWeg),
    'mit dem Wegschalten steht alles im Speicher – im selben Takt wie der Store');
  await f.da();
  // Neu laden: Der Service Worker hat den Zwischenspeicher inzwischen gefüllt.
  await f.neu();
  await f.page.waitForTimeout(300);
  z = await f.zeilen();
  check(z.filter((x) => / start anzeige=/.test(x)).length === 2,
    'nach dem Neuladen steht die alte Startzeile noch da – geschrieben beim Schließen der Seite');
  check(hat(z, / sicht zu="seite zu"/), 'und das Schließen selbst');
  check(hat(z, / start fassung=workout-v\d+/), `die Fassung aus dem Zwischenspeicher (${zeige(z, /fassung=workout/).slice(24)})`);
  check(hat(z, / sw was=registriert/), 'der Service Worker meldet sich');
  // Ein Neuladen, das die App selbst auslöst, nennt seinen Grund.
  await f.page.evaluate(async (d) => (await import(d)).diagnoseGrundMerken('update'), D);
  await f.neu();
  z = await f.zeilen();
  check(/ grund=update/.test(z.filter((x) => / start anzeige=/.test(x)).pop() || ''),
    'nach einem Neuladen der App trägt die nächste Startzeile den Grund (grund=update)');
  await ende(f);

  const g = await fall('1 installiert', {
    vorher: () => {
      const orig = window.matchMedia.bind(window);
      window.matchMedia = (q) => (/display-mode: standalone/.test(q)
        ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : orig(q));
    },
  });
  check(hat(await g.zeilen(), / start anzeige=standalone/), 'als installierte App: anzeige=standalone');
  await ende(g);
});

/* ------------------------------------------------------------------ *
 * 2. Keine Last im Training
 * ------------------------------------------------------------------ */
await abschnitt(2, async () => {
  const f = await fall('2 Kosten', {
    vorher: () => {
      const orig = window.Storage.prototype.setItem;
      window.__setItems = {};
      window.Storage.prototype.setItem = function (k, v) {
        const t0 = performance.now();
        try {
          return orig.call(this, k, v);
        } finally {
          const e = window.__setItems[k] || (window.__setItems[k] = { n: 0, ms: [], len: 0 });
          e.n += 1;
          e.ms.push(performance.now() - t0);
          e.len = String(v).length;
        }
      };
    },
  });
  const zahl = (k) => f.page.evaluate((key) => (window.__setItems[key] || { n: 0 }).n, k);
  await f.klick('[data-act="start-session"]', 300);
  const stateVorher = await zahl('workout.state.v1');
  // Was vor den Tipps geschrieben wurde (ein Fehler schriebe sofort), zählt
  // nicht; gezählt wird ab hier.
  const vor = await zahl(KEY);
  const imTipp = [];
  for (let i = 0; i < 5; i++) {
    await f.page.locator('.focus-set:not(.on)').first().click();
    imTipp.push(await zahl(KEY));
    await f.page.waitForTimeout(180);
  }
  await f.page.waitForTimeout(500);
  const z = await f.zeilen();
  check(z.filter((x) => / satz n=\d+ mode=db ex=\S+ i=\d done=true/.test(x)).length === 5,
    `jeder Haken steht im Protokoll (${z.filter((x) => / satz /.test(x)).length} Satz-Zeilen)`);
  check(imTipp.every((n) => n === vor) && await zahl(KEY) === vor,
    `null Schreibvorgänge des Protokolls in fünf Tipps (${imTipp.map((n) => n - vor).join(',')})`);
  check(await zahl('workout.state.v1') > stateVorher, 'der Store schreibt wie immer');
  const satz = z.find((x) => / satz /.test(x)) || '';
  check(!/ w=| r=|37[.,]75|kg/.test(satz), `kein Gewicht, keine Wiederholung in der Satz-Zeile (${satz.slice(24, 140)})`);
  await f.schreiben();
  const e = await f.page.evaluate((k) => window.__setItems[k] || { n: 0, ms: [], len: 0 }, KEY);
  check(e.n === vor + 1 && e.len > 0 && e.len <= 65536,
    `eine Schreibung für alles, was anstand (${e.n - vor}×, ${e.len} Zeichen)`);
  console.log(`     gemessen: setItem des Protokolls ${e.ms.slice(vor).map((x) => x.toFixed(2)).join(', ')} ms bei ${e.len} Zeichen`);
  // Und was ein Eintrag kostet – im Browser gemessen, ohne Schreiben.
  const us = await f.page.evaluate(async (d) => {
    const m = await import(d);
    const t0 = performance.now();
    for (let i = 0; i < 2000; i++) m.notieren('probe', { i, ex: 'goblet-squat', done: true });
    return ((performance.now() - t0) * 1000) / 2000;
  }, D);
  console.log(`     gemessen: notieren() ${us.toFixed(1)} µs je Eintrag (2000 Einträge, ohne Schreiben)`);
  check(us < 100, `ein Eintrag kostet Mikrosekunden, keine Millisekunden (${us.toFixed(1)} µs)`);
  await ende(f);
});

/* ------------------------------------------------------------------ *
 * 3. Fehler
 * ------------------------------------------------------------------ */
await abschnitt(3, async () => {
  const f = await fall('3 Fehler');
  // Als Skript der Seite, nicht per evaluate(): Dann hat der Fehler eine Datei.
  await f.page.addScriptTag({ content: 'setTimeout(() => { throw new Error("Probe-Fehler aus dem Test"); }, 0);' });
  // „Sofort" heißt: gleich nach dem Ereignis (höchstens einmal je 2 s), nicht
  // nach der Drossel von einer Minute.
  await f.page.waitForTimeout(400);
  const gleich = (await f.gespeichert()) || '';
  // Datei:Zeile hat er hier nicht (ein eingeschobenes Skript hat keine Datei),
  // dafür die erste Zeile des Stacks; die Datei prüfen die Fälle darunter.
  check(/ fehler quelle=error name=Error msg="(Uncaught Error: )?Probe-Fehler aus dem Test"( ort=\S+)? stack=\S+/.test(gleich),
    `ein geworfener Fehler steht ohne Drossel im Speicher, mit Stack (${zeige(gleich.split('\n'), / fehler /).slice(24)})`);
  await f.page.evaluate(() => { Promise.reject(new Error('Probe-Ablehnung')); });
  await f.page.evaluate(() => {
    const img = document.createElement('img');
    img.src = './gibt-es-nicht.png?x=1#y';
    document.body.appendChild(img);
  });
  await f.page.waitForTimeout(400);
  let z = await f.zeilen();
  check(hat(z, / fehler quelle=rejection name=Error msg=Probe-Ablehnung/), 'ein abgelehntes Versprechen ebenso');
  check(hat(z, / fehler quelle=ressource tag=img src=gibt-es-nicht\.png$/),
    `eine Datei, die nicht lädt, mit Namen – ohne Anfrage und Anker (${zeige(z, /ressource/).slice(24)})`);
  await f.page.evaluate(() => {
    for (let i = 0; i < 5; i++) window.dispatchEvent(new window.ErrorEvent('error', { message: 'Flut', filename: `${location.origin}/js/app.js`, lineno: 3 }));
  });
  await f.page.waitForTimeout(100);
  z = await f.zeilen();
  check(z.filter((x) => /msg=Flut/.test(x)).length === 1 && hat(z, /msg=Flut .* ×5$/),
    `eine Fehlerflut ist eine Zeile mit „×5" (${zeige(z, /Flut/).slice(24)})`);
  await f.page.evaluate((key) => {
    const adr = `${location.href}#sicherung=${key}`;
    window.dispatchEvent(new window.ErrorEvent('error', { message: `Kaputt bei ${adr}`, filename: adr, lineno: 7 }));
    window.dispatchEvent(new window.ErrorEvent('error', {
      message: `Unexpected token 'x', "{"name":"Tobi-Testname","log"... is not valid JSON`,
    }));
  }, GEHEIM);
  await f.page.waitForTimeout(100);
  z = await f.zeilen();
  const alles = z.join('\n');
  check(hat(z, /msg="Kaputt bei index\.html" ort=index\.html:7:0/) && !alles.includes(GEHEIM) && !alles.includes('sicherung='),
    `aus Adressen fallen Anker, Anfrage und Herkunft – der Schlüssel des Links nie im Protokoll (${zeige(z, /Kaputt/).slice(24)})`);
  check(hat(z, /not valid JSON/) && !alles.includes(NAME),
    'eine JSON-Meldung verliert, was sie zitiert – der Name aus der Sicherung nie im Protokoll');
  // Der Schlüssel des Servers (js/config.js) in einer Meldung – etwa einer
  // Antwort, die die Anfrage zitiert: Er wird zu „…", die Adresse verliert ihre
  // Herkunft.
  const cfg = await f.page.evaluate(async () => {
    const { CONFIG } = await import('./js/config.js');
    window.dispatchEvent(new window.ErrorEvent('error', {
      message: `Abgelehnt: apikey=${CONFIG.key} an ${CONFIG.url}/rest/v1/rpc/melde`,
    }));
    return { key: CONFIG.key, host: new window.URL(CONFIG.url).host };
  });
  await f.page.waitForTimeout(100);
  const mitCfg = (await f.zeilen()).join('\n');
  check(/msg="Abgelehnt: apikey=… an rest\/v1\/rpc\/melde"/.test(mitCfg) && !mitCfg.includes(cfg.key) && !mitCfg.includes(cfg.host),
    `der Schlüssel des Servers wird zu „…", seine Adresse verliert die Herkunft (${zeige(mitCfg.split('\n'), /Abgelehnt/).slice(24)})`);
  await ende(f, /Probe-Fehler|Probe-Ablehnung/);
});

/* ------------------------------------------------------------------ *
 * 4. Pause und Ton
 * ------------------------------------------------------------------ */
await abschnitt(4, async () => {
  const f = await fall('4 Pause', { zustand: { ...GRUND, restSeconds: 2 } });
  await f.klick('[data-act="start-session"]', 300);
  await f.page.locator('.focus-set:not(.on)').first().click();
  await f.page.waitForTimeout(2900);
  let z = await f.zeilen();
  check(hat(z, / einheit was=start n=\d+ mode=db/), 'Einheit gestartet');
  check(hat(z, / ton was=kontext woher=\S+ zustand=running/), `der Tonkanal mit Herkunft und Zustand (${zeige(z, /was=kontext/).slice(24)})`);
  check(hat(z, / pause was=start dauer=2 ex=\S+ satz=1 von=\d/), 'die Pause beginnt: Dauer, Übung, Satz');
  check(hat(z, / ton was=geplant plan=rest in=2/), 'ihr Signal liegt auf der Audio-Uhr');
  check(hat(z, / pause was=auflegen rest=2 armed=true toene=true meldung=aus/), 'aufgelegt: Ton ja, Hinweis aus');
  check(hat(z, / pause was=ablauf stand=\S+ frisch=true ersatz=(true|false) toene=true leiste=true sichtbar=true spaet=0/),
    `abgelaufen – mit dem, was endRest() entschied (${zeige(z, /was=ablauf/).slice(24)})`);
  // Zweiter Satz: Pause weggetippt.
  await f.page.locator('.focus-set:not(.on)').first().click();
  await f.page.waitForTimeout(200);
  await f.klick('#restSkip', 200);
  z = await f.zeilen();
  check(hat(z, / pause was=weg ex=\S+ eigene=true/) && hat(z, / pause was=abbruch stand=\S+/),
    'weggetippt: „weg" und „abbruch"');
  check(hat(z, / ton was=abgesagt verworfen=1/), 'und das Signal, das nicht mehr kommen soll, ist abgesagt');
  // Dritter Satz beendet die Übung, der erste der nächsten startet eine Pause: +30 s.
  await f.page.locator('.focus-set:not(.on)').first().click();
  await f.page.waitForTimeout(250);
  await f.page.locator('.focus-set:not(.on)').first().click();
  await f.page.waitForTimeout(200);
  await f.klick('#restPlus', 200);
  z = await f.zeilen();
  check(hat(z, / pause was=\+30 ex=\S+ eigene=true/) && hat(z, / pause was=auflegen rest=3[12] /),
    `+30 s, und neu aufgelegt (${zeige(z, /auflegen rest=3/).slice(24)})`);
  check(hat(z, / satz .* exFertig=true/), 'die fertige Übung steht im Haken');
  await ende(f);

  // Ohne Berührung seit dem Laden: Die Pause lief vor fünf Sekunden ab.
  // Ab hier kein page.evaluate() vor dem Tipp – Playwright gäbe damit eine
  // Geste ab, und der Ton wäre frei (siehe tests/test-ton-freischalten.mjs).
  const heute = new Date().toISOString().slice(0, 10);
  const laufend = (endsAt) => ({
    ...GRUND, session: { n: 1 }, clock: { n: 1, on: heute, spent: 0, since: Date.now(), gebucht: 0 },
    rest: { endsAt, total: 90, next: 'Satz 2 von 3 · Test', ex: null },
  });
  const g = await fall('4 nachgeholt', { zustand: laufend(Date.now() - 5000) });
  await g.page.waitForTimeout(300);
  await g.page.mouse.click(345, 870);   // der Reiter „Mehr" – ein Tipp, der selbst keinen Ton will
  await g.page.waitForTimeout(900);
  z = await g.zeilen();
  check(hat(z, / pause was=ablauf stand=keins frisch=true ersatz=true/), 'die abgelaufene Pause will ihren Ton geben');
  check(hat(z, / ton was=vorgemerkt name=rest frist=5\d/), `ohne Berührung wird er vorgemerkt (${zeige(z, /vorgemerkt name=rest/).slice(24)})`);
  check(hat(z, / ton was=beruehrt kontext=running api=true/) && hat(z, / ton was=kontext woher=beruehrung zustand=running/),
    'die erste Berührung legt den Kontext an');
  check(hat(z, / ton was=nachgeholt name=rest spaet=\d+ zustand=running/), `und holt ihn nach (${zeige(z, /nachgeholt name/).slice(24)})`);
  await ende(g);

  const h = await fall('4 verfallen', { zustand: laufend(Date.now() - 56500) });
  await h.page.waitForTimeout(4200);
  z = await h.zeilen();
  check(hat(z, / ton was=verfallen name=rest grund="frist ohne beruehrung"/),
    `ohne Berührung bis zum Ende der Frist: verfallen, mit Grund (${zeige(z, /verfallen/).slice(24)})`);
  await ende(h);

  const k = await fall('4 verpasst', { zustand: laufend(Date.now() + 9000) });
  await k.page.waitForTimeout(8600);
  z = await k.zeilen();
  check(hat(z, / ton was=vorgemerkt plan=ready\+rest/), 'eine Pause beim Laden: das Signal wird vorgemerkt, nicht auf eine stehende Uhr gelegt');
  check(hat(z, / ton was=verpasst anzahl=1 grund="ohne kontext" quelle="vorgemerkte pause"/),
    `die fällige Vorwarnung kam nie – verpasst, mit Grund (${zeige(z, /was=verpasst/).slice(24)})`);
  await ende(k);
});

/* ------------------------------------------------------------------ *
 * 5. Tagesabschluss
 * ------------------------------------------------------------------ */
await abschnitt(5, async () => {
  const f = await fall('5 Tagesabschluss');
  const gestern = await f.page.evaluate(async () => {
    const { PLAN } = await import('./js/data.js');
    const P = await import('./js/plan.js');
    const zwei = (n) => String(n).padStart(2, '0');
    const d = new Date(Date.now() - 86400000);
    const tag = `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`;
    const e = { db: {}, bw: {}, mode: 'db', soll: {}, nach: {}, nachFest: { db: {}, bw: {} }, nachWarum: { db: {}, bw: {} }, startedOn: tag };
    let rest = 3;
    P.exBasis(PLAN[0], 'db').forEach(({ id, sets }) => {
      e.soll[id] = sets;
      e.nach[id] = 0;
      e.db[id] = Array.from({ length: sets }, () => { const x = rest > 0; if (x) rest -= 1; return { w: '', done: x }; });
    });
    const seit = new Date(d);
    seit.setHours(18, 0, 0, 0);
    const s = JSON.parse(localStorage.getItem('workout.state.v1'));
    Object.assign(s, {
      log: { 1: e }, session: { n: 1 }, letzterEintrag: { n: 1, at: seit.getTime() + 600000 },
      clock: { n: 1, on: tag, spent: 600000, since: seit.getTime(), gebucht: 0 },
    });
    sessionStorage.setItem('__neu', JSON.stringify(s));
    return tag;
  });
  await f.neu();
  const z = await f.zeilen();
  check(hat(z, new RegExp(` tag was=abschluss einheiten=1:3/\\d+@${gestern} sitzung=1 still=\\d+`)),
    `die liegen gebliebene Einheit schließt sich ab, die Sitzung endet (${zeige(z, /was=abschluss/).slice(24)})`);
  check(hat(z, / einheit was="uhr gedeckelt" n=1 wo="liegen geblieben" vorMin=\d+/),
    `die Uhr bleibt am letzten Lebenszeichen stehen (${zeige(z, /gedeckelt/).slice(24)})`);
  check(hat(z, / einheit was=ende n=1 liegen=true secs=\d+/), 'die Sitzung endet als „liegen geblieben"');
  check(/ tag was=abschluss /.test((await f.gespeichert()) || ''), 'und das steht sofort im Speicher');
  await ende(f);
});

/* ------------------------------------------------------------------ *
 * 6. Sicherung
 * ------------------------------------------------------------------ */
await abschnitt(6, async () => {
  const lab = labor(browser);
  const { page: a, ctx } = await lab.geraet('6 Sicherung', {
    zustand: { greeted: true, name: NAME, focus: 'cut' }, zeit: START,
  });
  offen.add(ctx);
  await a.evaluate(async () => {
    const store = await import('./js/store.js');
    const { PLAN } = await import('./js/data.js');
    for (let i = 0; i < 2; i++) {
      const w = PLAN[i];
      store.completeWorkout(w.n, 'db', w.ex.map((x) => ({ id: x.id, sets: x.sets, w: '37.75' })));
    }
  });
  await lab.warte(a, 1100);
  await lab.warte(a, 5000);
  const zeilen = () => a.evaluate(async (d) => (await import(d)).diagnoseZeilen(), D);
  let z = await zeilen();
  check(lab.geschrieben().length === 1 && hat(z, / sicherung ok=true$/),
    `gesichert – das Protokoll sagt es (${zeige(z, / sicherung /).slice(24)})`);
  lab.modus = 'weg';
  await a.evaluate(async () => (await import('./js/store.js')).setSetting('name', 'Tobi-Testname'));
  await a.evaluate(async () => (await import('./js/store.js')).completeWorkout(3, 'db', []));
  await lab.warte(a, 1100);
  await lab.warte(a, 130000);
  await lab.warte(a, 15000);
  z = await zeilen();
  check(hat(z, / sicherung ok=false fehler="Keine Verbindung"/), `gescheitert, mit Grund (${zeige(z, /ok=false/).slice(24)})`);
  const m = await meta(a);
  const alles = z.join('\n');
  check(!!m.key && !alles.includes(m.key) && !alles.includes(m.id) && !alles.includes(m.w || '-'),
    'weder Schlüssel noch Kennung noch Schreibmarke stehen im Protokoll');
  check(lab.anfragen.every((x) => !/ start anzeige=| sicherung ok=| satz n=/.test(x.roh) && !x.url.includes('diagnose')),
    `keine Anfrage an den Server trägt eine Protokollzeile (${lab.anfragen.length} Anfragen geprüft)`);
  check(lab.fehler.length === 0, `6 Sicherung: keine Fehler${lab.fehler.length ? ` – ${lab.fehler[0]}` : ''}`);
  offen.delete(ctx);
  await ctx.close();
});

/* ------------------------------------------------------------------ *
 * 7.–10. Ansehen, Teilen, Kopieren, Löschen, Schalter
 * ------------------------------------------------------------------ */
const ATTRAPPEN = () => {
  window.__geteilt = null;
  window.__teilenWirft = '';
  navigator.canShare = () => true;
  navigator.share = async (d) => {
    const datei = d.files && d.files[0];
    window.__geteilt = { title: d.title, name: datei && datei.name, type: datei && datei.type, text: datei ? await datei.text() : '' };
    if (window.__teilenWirft) throw new DOMException('Probe', window.__teilenWirft);
  };
  window.__kopiert = null;
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true, value: { writeText: async (t) => { window.__kopiert = t; } },
  });
};
const geheimnisse = (text) => [NAME, '37.75', '37,75', GEHEIM, PASSWORT, 'sicherung=', 'adminPass']
  .filter((g) => text.includes(g));

await abschnitt(7, async () => {
  const f = await fall('7 Ansehen', { vorher: ATTRAPPEN, adresse: `${URL}#sicherung=${GEHEIM}` });
  await f.klick('[data-act="start-session"]', 300);
  await f.page.locator('.focus-set:not(.on)').first().click();
  await f.page.waitForTimeout(250);
  await f.zuMehr();
  check(await f.page.locator('#diagnose').count() === 1, 'unter Mehr → Daten steht die Karte „Diagnoseprotokoll"');
  const hint = (await f.page.locator('#diagnose .hint').textContent()) || '';
  check(/bleibt auf diesem Gerät/.test(hint) && /keine Gewichte/.test(hint) && /Uhrzeiten/.test(hint)
    && /nirgendwohin/.test(hint) && /64 KB/.test(hint) && /14 Tage/.test(hint),
  'sie sagt, was drinsteht und was nicht, dass Uhrzeiten dabei sind, wo es bleibt und wie groß es wird');
  check(await f.page.locator('[data-act="toggle-diagnose"]').getAttribute('aria-pressed') === 'true', 'der Schalter steht an');
  const stand = (await f.page.locator('#diagnoseStand').textContent()) || '';
  check(/^\d+ Einträge seit \d\d\.\d\d\. \d\d:\d\d · \d+ KB · 0 Fehler/.test(stand), `die Zusammenfassungszeile (${stand})`);
  const lage = (await f.page.locator('#diagnoseLage').textContent()) || '';
  const lz = lage.split('\n');
  check(/^Workout-Diagnose · /.test(lz[0]) && lz.includes('---') && lz.length - lz.indexOf('---') - 1 === 8
    && / satz /.test(lage), `der Kasten: Lage oben, darunter die letzten acht Einträge (${lz.length} Zeilen)`);
  await f.klick('[data-act="diagnose-ansehen"]');
  const ganz = await f.page.locator('#diagnoseText').inputValue();
  check(/^Workout-Diagnose · .* bleibt auf dem Gerät, geteilt nur auf Tipp\n/.test(ganz) && /\n---\n\d{4}-\d\d-\d\d /.test(ganz)
    && / start anzeige=/.test(ganz) && / satz /.test(ganz),
  'Alles ansehen: der Kopf, eine Linie, dann jede Zeile');
  check(geheimnisse(ganz).length === 0, `kein Geheimnis im Text, auch nach einem Wiederherstellungs-Link (${geheimnisse(ganz).join(', ') || 'keins'})`);
  check(await f.page.locator('[data-act="diagnose-ansehen"]').textContent() === 'Zuklappen', 'und der Knopf heißt jetzt „Zuklappen"');

  // --- 8. Teilen ---------------------------------------------------------
  await f.klick('[data-act="diagnose-teilen"]', 400);
  const g = await f.page.evaluate(() => window.__geteilt);
  check(!!g && /^workout-diagnose-\d{4}-\d{2}-\d{2}\.txt$/.test(g.name || '') && g.type === 'text/plain',
    `Teilen: eine .txt mit genau text/plain (${g && g.name}, ${g && g.type})`);
  check(!!g && /^Workout-Diagnose · /.test(g.text) && /\nFassung |\nEinzeldatei /.test(g.text) && g.text.includes('\n---\n'),
    'oben der Kopf mit Fassung, eine Linie, dann das Protokoll');
  check(!!g && geheimnisse(g.text).length === 0 && !g.text.includes('eyJ'),
    `ohne Namen, Gewicht, Sicherungsschlüssel, Link, Passwort, Server-Schlüssel (${g ? geheimnisse(g.text).join(', ') || 'nichts gefunden' : '-'})`);
  check(hat(await f.zeilen(), / diagnose was=geteilt bytes=\d+/), 'das Teilen steht selbst im Protokoll');
  await f.page.evaluate(() => { window.__teilenWirft = 'AbortError'; });
  await f.klick('[data-act="diagnose-teilen"]', 400);
  check(await f.page.locator('#diagnoseFehler').count() === 0, 'abgebrochen: keine Meldung');
  await f.page.evaluate(() => { window.__teilenWirft = 'NotAllowedError'; });
  const download = f.page.waitForEvent('download', { timeout: 3000 }).catch(() => null);
  await f.klick('[data-act="diagnose-teilen"]', 400);
  const dl = await download;
  check(!!dl && /^workout-diagnose-\d{4}-\d{2}-\d{2}\.txt$/.test(dl.suggestedFilename()),
    `abgelehnt: als Datei heruntergeladen (${dl ? dl.suggestedFilename() : 'kein Download'})`);
  check(await f.page.locator('#diagnoseFehler').count() === 1 && (await f.page.locator('#diagnoseText').inputValue()).length > 100,
    'mit der Meldung, warum, und dem Text im Feld');
  check(hat(await f.zeilen(), / diagnose was=download bytes=\d+ fehler=NotAllowedError/), 'auch das steht im Protokoll');

  // --- 9. Kopieren -------------------------------------------------------
  await f.klick('[data-act="diagnose-kopieren"]', 300);
  const kopiert = await f.page.evaluate(() => window.__kopiert) || '';
  check(/^Workout-Diagnose · /.test(kopiert) && geheimnisse(kopiert).length === 0,
    'Kopieren: derselbe Text in die Zwischenablage');
  check(/Protokoll kopiert/.test(await f.page.locator('#toast').textContent()), 'Toast „Protokoll kopiert"');
  await f.page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }));
  await f.klick('[data-act="diagnose-kopieren"]', 300);
  const sel = await f.page.evaluate(() => {
    const ta = document.getElementById('diagnoseText');
    return ta ? { a: ta.selectionStart, b: ta.selectionEnd, n: ta.value.length, fokus: document.activeElement === ta } : null;
  });
  check(!!sel && sel.a === 0 && sel.b === sel.n && sel.n > 100 && sel.fokus,
    'ohne Zwischenablage: der ganze Text markiert im Feld');
  check(/Kopieren ging nicht/.test(await f.page.locator('#toast').textContent()), 'mit Toast „Kopieren ging nicht"');
  // Kein Knopf der Karte hat eine Anfrage ausgelöst, die etwas schreibt oder nach draußen geht.
  const raus = f.anfragen.filter((x) => !/^GET http:\/\/127\.0\.0\.1:\d+\//.test(x) && !/^GET (blob|data):/.test(x));
  check(raus.length === 0, `keine Anfrage nach draußen, kein POST (${raus.slice(0, 2).join(' | ') || 'keine'})`);
  await ende(f);
});

await abschnitt(10, async () => {
  const f = await fall('10 Schalter');
  await f.zuMehr();
  await f.klick('[data-act="toggle-diagnose"]', 250);
  check(await f.page.locator('[data-act="toggle-diagnose"]').getAttribute('aria-pressed') === 'false', 'Schalter aus');
  const roh = (await f.gespeichert()) || '';
  check(/ diagnose an=false\n$/.test(roh), 'die letzte Zeile sagt es – und steht sofort im Speicher');
  check(await f.page.evaluate((k) => localStorage.getItem(k), AUS) === '1', `${AUS} = '1'`);
  check(/Abgeschaltet – es wird nichts mehr mitgeschrieben/.test(await f.page.locator('#diagnoseStand').textContent()),
    'die Karte sagt, dass es abgeschaltet ist');
  const vorher = (await f.zeilen()).length;
  await f.page.locator('.tab[data-tab="dashboard"]').click();
  await f.klick('[data-act="start-session"]', 300);
  for (let i = 0; i < 3; i++) await f.klick('.focus-set:not(.on)', 150);
  await f.weg();
  await f.da();
  check((await f.zeilen()).length === vorher && (await f.gespeichert()) === roh,
    `drei Sätze, Wegschalten: nichts Neues, weder im Arbeitsspeicher noch im Speicher (${vorher} Zeilen)`);
  await f.neu();
  check((await f.zeilen()).length === vorher, 'nach dem Neuladen keine neue Startzeile – aus bleibt aus');
  await f.zuMehr();
  check(await f.page.locator('[data-act="diagnose-loeschen"]').count() === 1,
    'auch abgeschaltet lässt sich löschen, was da ist');
  await f.klick('[data-act="toggle-diagnose"]', 250);
  check(/ diagnose an=true$/.test((await f.zeilen()).pop() || '')
    && await f.page.evaluate((k) => localStorage.getItem(k), AUS) === null, 'wieder an: „an=true", Schalter-Schlüssel weg');
  await f.klick('[data-act="diagnose-loeschen"]', 300);
  check((await f.gespeichert()) !== null && / diagnose was=geleert grund=tipp\n$/.test(await f.gespeichert())
    && (await f.zeilen()).length === 1, 'Löschen leert: danach genau eine Zeile, die sagt, warum');
  check(/Protokoll gelöscht/.test(await f.page.locator('#toast').textContent()), 'Toast „Protokoll gelöscht"');
  // Alle Daten löschen: räumt mit und stellt den Schalter auf Standard.
  await f.klick('[data-act="toggle-diagnose"]', 250);
  await f.klick('[data-act="reset-all"]', 500);
  const z = await f.zeilen();
  check(z.length === 1 && / diagnose was=geleert grund=reset$/.test(z[0])
    && await f.page.evaluate((k) => localStorage.getItem(k), AUS) === null
    && await f.page.evaluate(async (d) => (await import(d)).diagnoseAn(), D),
  `„Alle Daten löschen": eine Zeile „grund=reset", der Schalter wieder an (${z.length} Zeilen)`);
  await ende(f);
});

/* ------------------------------------------------------------------ *
 * 11. Ringpuffer
 * ------------------------------------------------------------------ */
await abschnitt(11, async () => {
  const f = await fall('11 Ringpuffer');
  const r = await f.page.evaluate(async ({ d, k }) => {
    const m = await import(d);
    for (let i = 0; i < 3000; i++) m.notieren('probe', { i, x: 'ab cd '.repeat(10) });
    m.diagnoseSchreiben();
    const t = localStorage.getItem(k) || '';
    const z = t.trimEnd().split('\n');
    return { len: t.length, erste: z[0], letzte: z[z.length - 1], n: z.length, stand: m.diagnoseStand() };
  }, { d: D, k: KEY });
  check(r.len <= 65536 && r.len > 60000, `der Schlüssel bleibt unter 64 KB (${r.len} Zeichen, ${r.n} Zeilen)`);
  check(/ probe i=2999 /.test(r.letzte) && /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d\.\d{3} probe i=(\d+) /.test(r.erste)
    && Number(/i=(\d+)/.exec(r.erste)[1]) > 2000 && Number(/i=(\d+)/.exec(r.erste)[1]) === 3000 - r.n,
  `vorn fällt das Älteste weg, hinten steht das Neueste (${r.erste.slice(24, 40)} … ${r.letzte.slice(24, 40)})`);
  check(r.stand.bytes <= 65536 && r.stand.zeilen === r.n, 'und der Arbeitsspeicher hält dieselbe Grenze');
  // Alter: 50 Zeilen von vor 20 Tagen, 5 von heute.
  await f.page.evaluate((k) => {
    const zwei = (n) => String(n).padStart(2, '0');
    const st = (d) => `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())} 10:00:00.000`;
    const alt = st(new Date(Date.now() - 20 * 86400000));
    const neu = st(new Date());
    const z = [];
    for (let i = 0; i < 50; i++) z.push(`${alt} alt i=${i}`);
    for (let i = 0; i < 5; i++) z.push(`${neu} jung i=${i}`);
    localStorage.setItem(k, `${z.join('\n')}\n`);
  }, KEY);
  await f.neu();
  const z = await f.zeilen();
  check(z.filter((x) => / alt i=/.test(x)).length === 0 && z.filter((x) => / jung i=/.test(x)).length === 5,
    'Zeilen älter als 14 Tage fallen beim Laden weg, die jungen bleiben');
  await ende(f);
});

/* ------------------------------------------------------------------ *
 * 12. Volle Ablage
 * ------------------------------------------------------------------ */
const FUELLEN = (frei) => {
  const fuellen = (groesse, praefix, max) => {
    const block = 'x'.repeat(groesse);
    let n = 0;
    try { for (; n < max; n++) localStorage.setItem(`${praefix}${n}`, block); } catch { /* voll */ }
    return n;
  };
  const grob = fuellen(64 * 1024, 'ballast.grob.', 500);
  fuellen(1024, 'ballast.mittel.', 200);
  fuellen(32, 'ballast.fein.', 2000);
  // `frei` Blöcke zu 64 KB wieder heraus – so viel Platz bleibt.
  for (let i = 0; i < frei; i++) localStorage.removeItem(`ballast.grob.${grob - 1 - i}`);
  return grob;
};
const RAEUMEN = () => Object.keys(localStorage).filter((k) => k.startsWith('ballast.')).forEach((k) => localStorage.removeItem(k));

await abschnitt(12, async () => {
  const f = await fall('12 voll', { zustand: { ...GRUND, adminPass: undefined } });
  await f.weg();
  await f.da();
  check(((await f.gespeichert()) || '').length > 0, 'vorher: das Protokoll liegt im Speicher');
  const grob = await f.page.evaluate(FUELLEN, 0);
  check(grob > 0, `der Speicher ist dicht (${grob} × 64 KB Ballast)`);
  await f.klick('[data-act="start-session"]', 300);
  await f.page.locator('.focus-set:not(.on)').first().click();
  await f.page.waitForTimeout(700);
  const lage = await f.page.evaluate(async (d) => {
    const s = await import('./js/store.js');
    return { kann: s.canPersist(), grund: s.speicherGrund(), diag: (await import(d)).diagnoseStand() };
  }, D);
  check(lage.kann === false && lage.grund === 'voll', `der Store meldet „voll" wie ohne Protokoll (${lage.grund})`);
  check(await f.gespeichert() === null && lage.diag.nurRam && lage.diag.warum === 'platz',
    'das Protokoll hat seinen Schlüssel sofort freigegeben und läuft im Arbeitsspeicher');
  check(await f.page.locator('.notice.warn').count() > 0, 'die Warnung steht, wie sie stand');
  await f.page.evaluate(RAEUMEN);
  await f.page.locator('.focus-set:not(.on)').first().click();
  await f.page.waitForTimeout(700);
  const danach = await f.page.evaluate(async () => {
    const s = await import('./js/store.js');
    return { kann: s.canPersist(), saetze: Object.values((s.getState().log[1] || {}).db || {}).flat().filter((x) => x && x.done).length };
  });
  check(danach.kann && danach.saetze === 2 && await f.page.locator('.notice.warn').count() === 0,
    `aufgeräumt: beide Sätze gespeichert, die Warnung ist weg (${danach.saetze})`);
  const z = await f.zeilen();
  check(hat(z, / speicher kann=false grund=voll/) && hat(z, / speicher was=platz/) && hat(z, / speicher kann=true/),
    'im Arbeitsspeicher steht, was geschah – Teilen ginge weiter');
  check(await f.gespeichert() === null, 'bis zum nächsten Start legt es sich nicht wieder hinein');
  await ende(f);

  // Knapp, aber nicht voll: 128 KB frei, und so startet die App. Das Protokoll
  // legt sich gar nicht erst hinein.
  const g = await fall('12 knapp', { zustand: { ...GRUND, adminPass: undefined } });
  await g.page.evaluate(FUELLEN, 2);
  await g.neu();
  await g.schreiben();
  const st = await g.stand();
  check(await g.gespeichert() === null && st.nurRam && st.warum === 'knapp',
    `bei unter 256 KB Platz bleibt der Speicher dem Training (${st.warum || 'liegt drin'})`);
  await g.klick('[data-act="start-session"]', 300);
  await g.page.locator('.focus-set:not(.on)').first().click();
  await g.page.waitForTimeout(700);
  check(await g.page.evaluate(async () => (await import('./js/store.js')).canPersist()), 'und der Satz landet');
  await g.page.evaluate(RAEUMEN);
  await ende(g);
});

/* ------------------------------------------------------------------ *
 * 13. Nichts geht raus
 * ------------------------------------------------------------------ */
await abschnitt(13, async () => {
  const quelle = readFileSync(path.join(ROOT, 'js', 'diagnose.js'), 'utf8');
  const code = quelle.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/.*$/gm, '');
  check(!/^\s*import\s/m.test(code), 'js/diagnose.js importiert nichts');
  const wege = ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'postMessage', 'EventSource', 'navigator.share']
    .filter((w) => code.includes(w));
  check(wege.length === 0, `und hat keinen Weg nach draußen (${wege.join(', ') || 'keiner'})`);
  const f = await fall('13 Export');
  await f.weg();
  await f.da();
  const json = await f.page.evaluate(async () => (await import('./js/store.js')).exportJSON());
  check(!/workout\.diagnose| start anzeige=| sicht zu=/.test(json), 'die Sicherungsdatei kennt das Protokoll nicht');
  await ende(f);
});

/* ------------------------------------------------------------------ *
 * 14. Die Einzeldatei
 * ------------------------------------------------------------------ */
await abschnitt(14, async () => {
  const f = await fall('14 Einzeldatei', { adresse: EINZEL });
  // Unter file:// gibt es kein Modul zum Nachladen – gelesen wird der Speicher.
  await f.weg();
  await f.da();
  const z = ((await f.gespeichert()) || '').trimEnd().split('\n');
  check(hat(z, / start .*einzeldatei=true/) && !hat(z, / fassung=/), 'Startzeile mit „einzeldatei=true", ohne Fassung');
  await f.zuMehr();
  check(await f.page.locator('#diagnose').count() === 1, 'die Karte ist da');
  await ende(f);
});

console.log(`\n${fails ? `${fails} FEHLER` : 'alle Prüfungen bestanden'}`);
await browser.close();
