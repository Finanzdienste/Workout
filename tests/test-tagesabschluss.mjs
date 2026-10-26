/*
 * Eine liegen gebliebene Einheit schließt sich am Folgetag selbst ab.
 *
 *     „Wieso steht da samstag? Heute ist Sonntag"
 *
 * Tobi, Sonntag 25.10.2026, mit einem Bild der Startseite: „Tobi · Gestern ·
 * Workout 12 / Sa, 24. Oktober 2026 / Hanteln · 5 Übungen · 17 Sätze / 4/17
 * Sätze", darunter „Training fortsetzen" und „Als trainiert markieren".
 * Workout 12 war am Samstag angefangen und nie abgeschlossen worden – es wäre
 * auch am Montag noch dagestanden („vor 2 Tagen"), Workout 13 nie
 * drangekommen, und was liegen blieb, hätte nichts nachgeholt.
 *
 * Zugesagt: „Ab dem nächsten Tag wird eine liegengebliebene Einheit
 * automatisch mit dem abgeschlossen, was steht. Oben steht dann eine Zeile
 * dazu und ein Knopf ‚Rest heute machen', falls du doch willst."
 *
 * Nachgestellt mit Tobis Woche: Cut, geübt, Hanteln, Supersätze an, Mo/Mi/Fr/Sa
 * – Workout 9 bis 12 vom 19. bis 24. Oktober, Workout 13 am Montag, 26.
 * Workout 1 bis 11 sind ganz gemacht, in Workout 12 stehen 4 von 15 Sätzen.
 * Die Uhr steht fest (Europe/Berlin); ein neuer Tag ist ein Neuladen, außer
 * wo der Fall das Zurückkommen in die App oder die Uhr bei offener App prüft.
 *
 *   1. Am Sonntag beim Laden: Workout 12 ist abgeschlossen (im Modus der
 *      Einheit, wie „Als trainiert markieren"), bleibt auf Samstag, die
 *      Startseite zeigt nicht mehr „Gestern · Workout 12".
 *   2. Die Zeile oben: „✓ Workout 12 vom Samstag ist abgeschlossen – 4 von 15
 *      Sätzen." – und wohin der Rest geht, nur so, wie die App es dann tut,
 *      ohne dieselbe Zahl noch einmal in der Zeile am Ruhetag. Seit v244 ohne
 *      Knopf (siehe unten). Die Startseite bleibt mit ihr eine Seite (414×896,
 *      360×740).
 *   3. Zurück in die Einheit geht es über das Blättern: Workout 12 zeigt
 *      „✓ Abgeschlossen" (nicht „Für heute durch") und „Doch noch
 *      weitermachen" – Fokusansicht, bei der ersten offenen Übung. Der erste
 *      Haken nimmt die Zeile weg und vermerkt den Sonntag als Trainingstag:
 *      kein Zusatztag mehr für heute, keine Zeile „Heute frei", Workout 12
 *      bleibt auf Samstag (Kalender, Statistik). Ein ohne Sitzung nachgehakter
 *      Satz von gestern dagegen ist Nachtragen, kein Training: Heute bleibt
 *      frei – die Zeile ist weg (sie stimmt nicht mehr), die am Ruhetag sagt,
 *      was jetzt gilt.
 *   4. Die Enden der Zeile, ohne Knopf: Sie bleibt über das Neuladen, geht mit
 *      dem ersten Haken in der nächsten Einheit, steht am Tag danach noch und
 *      ist am übernächsten weg – auch bei offener App um Mitternacht, auch ohne
 *      Training; eine Woche alt oder aus der Zukunft (Sicherung) steht sie nie.
 *      Zurücksetzen nimmt sie weg, ein neuer Tagesabschluss ersetzt sie.
 *   5. Training über Mitternacht bleibt offen: Haken um 23:50, um 0:20 zurück
 *      in die App – nichts abgeschlossen, die Sitzung läuft, im Kopf „Gestern
 *      angefangen"; nach einem Neuladen geht es in der Fokusansicht weiter, und
 *      die Einheit endet normal mit dem letzten Satz.
 *   6. Eine liegen gebliebene Sitzung endet und schließt ab: beim Laden, beim
 *      Zurückkommen in die App und nach einem harten Ende der Seite – gebucht
 *      wird bis zum letzten Lebenszeichen, nicht die Nacht, und ohne Ton.
 *   7. Ein Fehltipp bleibt offen: ein Satz in Workout 13 (vorgeblättert, auf
 *      Sonntag vorgezogen) ist am Montag kein „trainiert mit 1 von 15".
 *   8. Danach greift die Rechnung: Der Zusatztag der Woche 3 steckt am Montag
 *      in Workout 13 – genau mit den Sätzen, die am Sonntag angekündigt sind.
 *      Mitten in der Woche (Workout 10 am Mittwoch liegen geblieben) holen die
 *      restlichen Einheiten nach, was die Zeile am Donnerstag sagt; an einem
 *      Trainingstag (Workout 11 am Freitag, Samstag ist Workout 12 dran) sagt
 *      es die Zeile selbst – und Workout 11 trägt genau das. Wo kein Ziel
 *      sicher ist, nennt sie keins. Steht der Zusatztag am Sonntag allein da
 *      (Woche 2), sagt sie das – und nach „Doch noch weitermachen" auf Workout
 *      8 wartet er bis morgen. Und Tobis Woche, wie auf seinem Bild (17 Sätze,
 *      zwei davon aus Workout 9): Die Zeile sagt, wovon der Zusatz ein Teil
 *      ist – „von den 11 offenen Sätzen" nur, wenn alles Offene aus Workout 12
 *      stammt.
 *   9. Sicherung und Import: Das neue Feld reist mit; aus fremder Hand wird es
 *      geprüft – Unsinn fällt weg, nichts landet als HTML in der Seite, ein
 *      Lebenszeichen aus der Zukunft hält keine Einheit offen.
 *  10. Über die Zeitumstellung (25.10., 3:00 MESZ → 2:00 MEZ): Gezählt werden
 *      echte Stunden, nicht die der Wanduhr – und die Uhr bei offener App
 *      feuert um Mitternacht des 25-Stunden-Tages, nicht eine Stunde früher.
 *
 * Aus der Prüfung danach (zwei Prüfer, jeder Befund nachgestellt):
 *
 *  11. „Doch noch weitermachen" und doch nicht: kein „Abbrechen", das die
 *      Sätze vom Samstag löscht und den Plan einen Tag schiebt – auch ein
 *      stehen gebliebener Knopf nicht; „Abschließen" lässt den Samstag, wie er
 *      war (bis v242 über „Rest heute machen", derselbe Weg).
 *  12. Der Kopf beim Rest von heute: „Gestern angefangen · Workout 12" in der
 *      Sitzung und über „Für heute durch", nicht „Gestern · Workout 12"; am
 *      Montag wieder „✓ Abgeschlossen".
 *  13. Eine Sitzung von heute endet nicht am selben Tag: „Doch noch
 *      weitermachen", drei Stunden Mittag – sie läuft weiter, auch bei
 *      offener App. Eine am Sonntag um 0:10 fortgesetzte Einheit vom Samstag
 *      bleibt offen, bis die Sitzung am Montag liegt; dann enden beide
 *      zusammen.
 *  14. Nach einem Start mit Planumbau wartet der Abschluss nur an diesem Tag –
 *      am Montag schließt er ab, auch ohne Neuladen.
 *  15. Über Nacht sichtbar, und die Uhr kam nicht dran: Neuladen, Wegschalten
 *      oder „Abschließen" am Morgen buchen nicht die Nacht, und die Einheit
 *      schließt ab.
 *
 * Aus dem Gegenlesen von v241 (v242):
 *
 *  2b. Dazu klemmt der Ton: Auf der Startseite hat die Zeile zum Abschluss
 *      Vorrang vor der stillen Zeile zum Ton, danach steht die kurz da – eine
 *      Seite bei 414×896 und 360×740, Sonntag und Montag; und am Samstag mit
 *      angefangener Einheit, wo die Karte auch für die kurze Zeile Höhe
 *      abgibt (aus der Prüfung danach, rot gegen 1e98686 und 87e4cd1).
 *  16. Stunden Stille bei sichtbarer App, dann zuerst ein Satz: Die Uhr bucht
 *      die Stille nicht, auch nicht, wenn der Satz die Einheit beendet.
 *  17. Ein Eintrag in einer anderen Einheit (ein Fehltipp in Workout 13)
 *      nimmt Workout 12 nicht ihr Lebenszeichen: kein Abschluss zehn Minuten
 *      nach ihrem letzten Satz, kein zweiter Trainingstag nach Mitternacht.
 *      Der letzte Eintrag je Einheit aus fremder Hand zählt nur, wenn er gilt
 *      (dazu 9: eine Sicherung von v241 zieht um).
 *
 * Ohne Wahl (v244):
 *
 *     „Ich will nicht zwischen ok und Rest heute wählen können. Es soll von
 *      selbst einfach das optimale passieren"
 *
 * „Rest heute machen" und „OK" sind weg. Die App bleibt von selbst im
 * Rhythmus, Nacharbeit und Zusatztag verteilen, was fehlt – die Zeile ist nur
 * noch Auskunft und geht von selbst (2, 4). Was über den Knopf in die Einheit
 * ging, geht jetzt über das Blättern und „Doch noch weitermachen" (3, 8e, 11,
 * 12, 13), mit denselben Sicherungen.
 *
 *  18. Die Karte einer Einheit von gestern: „✓ Abgeschlossen" statt „✓ Für
 *      heute durch" – die selbst abgeschlossene mit „Doch noch weitermachen",
 *      die ganz gemachte ohne Knopf; nach dem Rest von heute wieder „Für heute
 *      durch".
 *  19. Zwei Einheiten in der Zeile: Ein Satz in der einen nimmt nur sie
 *      heraus, die andere bleibt stehen.
 *  20. Die letzte Einheit der Runde liegt: Die Runde rollt weiter, die Zeile
 *      sagt, warum die Startseite bei Workout 1 steht, und geht mit dem
 *      ersten Satz dort.
 *
 * Aus der Prüfung von v244 (zwei Prüfer, jeder Befund nachgestellt):
 *
 *  4g. Ein Fokuswechsel und „Von vorn beginnen" nehmen die Zeile mit – sie
 *      sprach vom alten Plan; ein am vollen Speicher gescheiterter Wechsel
 *      lässt sie stehen.
 *  8f. Tobis eigener Satz, gemessen: höchstens drei Zeilen, das letzte Wort
 *      nie allein (bei 360×740 standen vier, in der letzten nur „rein."), und
 *      die Karte von Workout 12 bleibt eine Seite.
 *  18. Über der Karte einer Einheit, von der die Zeile spricht, steht sie
 *      nicht – sonst schob sich die Seite bei 360×740, und „4 von 15" stand
 *      dreimal da; Sonntag und Montag, 414×896 und 360×740.
 *  21. „Doch noch weitermachen", ohne Haken zurück: keine Zeile „ist
 *      abgeschlossen" über „Training abschließen" oder „läuft noch"; endet die
 *      Sitzung ohne Haken, steht sie wieder da.
 *
 * Gegenprobe gegen 6b533af (v242): 27 von 192 Prüfungen rot – 2 (Knöpfe), 2b
 * (5: die Zeile geht nicht von selbst, also auch keine zum Ton), 3 und 3b (6),
 * 4 (6), 8d, 8e, 11 und 12 (je 1: Knöpfe oder „Für heute durch" über
 * gestern), 18, 19 (je 2) und 20 (1). Nichts bricht ab: „Doch noch
 * weitermachen" gab es dort schon. Mit der Prüfung von v244 (4g, 8f, 18, 21)
 * sind es 43 von 218: dazu 4 (2), 8f (6), 18 (6) und 21 (2).
 *
 * Gegenprobe gegen 1725a52 (der erste Stand von v244): 13 von 218 rot – 4g
 * (2: Fokuswechsel, „Von vorn beginnen"), 8f (5: der Wortlaut, die vier
 * Zeilen, die Karte von Workout 12 bei beiden Größen; dazu als Folge der
 * Montag, dem ohne den neuen Wortlaut die angekündigte Zahl fehlt), 18 (4: die
 * Zeile über der eigenen Karte, 24 px bei 360×740) und 21 (2). Grün dort: der
 * am vollen Speicher gescheiterte Wechsel – er wacht über das Neue.
 *
 * Gegenprobe gegen 87e4cd1 (v241): 19 von 161 Prüfungen rot – 2b (10), 16 (3),
 * 17a und 17b (3) und in 9 die drei, die das neue Feld prüfen. 17c ist dort
 * grün, weil 87e4cd1 das Feld nicht liest. Gegen 1e98686 (der erste Stand von
 * v242): 1 rot – 2b Samstag bei 360×740.
 *
 * Gegenprobe gegen f43f137 (ohne Tagesabschluss): 47 von 78 Prüfungen rot,
 * jeder Abschnitt; 1, 3, 4, 7, 8, 9, 11, 12, 13 und 14 brechen ab, weil es
 * Knopf, Zeile oder Feld nicht gibt. Gegen fcd9757 (vor der Prüfung): 23 von
 * 129 rot – 2, 8, 8b, 8c, 8f („Davon") und 11 bis 15. Einzeln zurückgedreht
 * wird jede Stelle rot, gemessen an fcd9757: trainiertAm() nur mit startedOn
 * – 3 und 8e (2); ABSCHLUSS_AB = 1 – 7 (3); LIEGT_AB_MS = 0 – 5 und 10 (4);
 * ohne tagesUhrStellen() – 10 (1); die Zeile am Ruhetag lässt nichts weg – 2
 * und 8b (2); „der Rest danach" versprochen – 8b bis 8d (4). Und aus der
 * Prüfung, gemessen am jetzigen Stand, sonst nichts rot: der Tag der Sitzung
 * wieder von ihrer Einheit – 13 (3); die Sperre nach dem Planumbau für die
 * ganze Seite – 14 (1); „Abbrechen" auch auf einer Einheit von gestern – 11
 * (3); der Kopf ohne „angefangen" beim Rest von heute – 12 (2); „Davon kommen
 * …" statt „Von den 11 offenen Sätzen" – 2, 8 und 8f (6); die Uhr ohne
 * Deckel – 15 (5).
 *
 * TAGESABSCHLUSS_NUR=1,5 lässt nur diese Fälle laufen.
 */
import { chromium } from 'playwright';
import { URL } from './umgebung.mjs';

const T = {
  sa: '2026-10-24T18:00:00+02:00',
  sa2350: '2026-10-24T23:50:00+02:00',
  so0020: '2026-10-25T00:20:00+02:00',
  so: '2026-10-25T10:00:00+01:00',
  mo: '2026-10-26T17:00:00+01:00',
};
const TAG = { sa: '2026-10-24', so: '2026-10-25', mo: '2026-10-26' };
const SHIFT = 42;   // Workout 12 (Plan: Sa 12.9.) auf Sa 24.10.

const browser = await chromium.launch();
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };
const nur = (process.env.TAGESABSCHLUSS_NUR || '').split(',').filter(Boolean);
const offen = new Set();

/**
 * Ein Fall in eigenem Kontext. `zustand` wird vor dem ersten Laden gesät,
 * die Uhr steht fest auf `wann` – oder läuft ab `wann` (`laufend`), wo die
 * Uhr bei offener App geprüft wird. `window.__hidden` schaltet die App weg.
 * `klemmt`: Der Tonkanal bleibt nach jeder Berührung 'interrupted' – so, wie
 * iOS ihn nach einer Nacht im Hintergrund hinterlässt (die stille Zeile zum
 * Ton, siehe klemmen()).
 */
async function fall(name, zustand, wann, { laufend = false, klemmt = false } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 414, height: 896 }, timezoneId: 'Europe/Berlin', serviceWorkers: 'block',
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
  });
  if (klemmt) {
    await ctx.addInitScript(() => {
      const Orig = window.AudioContext;
      window.AudioContext = class extends Orig {
        get state() { return 'interrupted'; }
        get currentTime() { return 0; }
        resume() { return new Promise(() => {}); }
      };
    });
  }
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(`PAGEERROR: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(`CONSOLE: ${m.text()}`); });
  page.on('dialog', (d) => d.accept().catch(() => {}));
  if (laufend) await page.clock.install({ time: new Date(wann) });
  else await page.clock.setFixedTime(new Date(wann));
  if (zustand) {
    await page.addInitScript((s) => {
      if (sessionStorage.getItem('gesaet')) return;
      sessionStorage.setItem('gesaet', '1');
      localStorage.setItem('workout.state.v1', JSON.stringify(s));
      localStorage.removeItem('workout.rounds.v1');
    }, zustand);
  }
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(250);
  return {
    name, ctx, page, errs,
    txt: async (sel) => ((await page.locator(sel).first().textContent({ timeout: 1500 }).catch(() => '')) || '')
      .replace(/\s+/g, ' ').trim(),
    lies: () => page.evaluate(() => JSON.parse(localStorage.getItem('workout.state.v1') || '{}')),
    M: (fn, arg) => page.evaluate(async ([src, a]) => {
      const m = {
        P: await import('./js/plan.js'), store: await import('./js/store.js'), D: await import('./js/data.js'),
      };
      return (0, eval)(`(${src})`)(m, a);
    }, [fn.toString(), arg]),
    klick: async (sel, warte = 300) => {
      await page.locator(sel).first().click({ timeout: 3000 });
      await page.waitForTimeout(warte);
    },
    /** Neuer Tag (oder neue Stunde): Uhr stellen und neu laden. */
    tag: async (iso) => {
      await page.clock.setFixedTime(new Date(iso));
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(300);
    },
    /** App weg – Uhr weiter – App wieder da, ohne Neuladen. */
    wegUndZurueck: async (iso) => {
      await page.evaluate(() => { window.__hidden = true; document.dispatchEvent(new Event('visibilitychange')); });
      await page.waitForTimeout(150);
      await page.clock.setFixedTime(new Date(iso));
      await page.evaluate(() => { window.__hidden = false; document.dispatchEvent(new Event('visibilitychange')); });
      await page.waitForTimeout(350);
    },
  };
}
async function ende(f) {
  check(f.errs.length === 0, `${f.name}: keine Fehler${f.errs.length ? ` – ${f.errs.slice(0, 2).join(' | ')}` : ''}`);
  offen.delete(f.ctx);
  await f.ctx.close();
}
/**
 * Die Berührung, nach der der Tonkanal klemmt (fall(…, { klemmt })): ein
 * Mausklick auf eine leere Stelle, dann die Uhr gut zwei Sekunden weiter –
 * erst nach anderthalb gilt er als klemmend (tonStand().klemmt in js/audio.js).
 */
async function klemmen(f) {
  const t = await f.page.evaluate(() => Date.now());
  await f.page.mouse.click(5, 300);
  await f.page.clock.setFixedTime(new Date(t + 2500));
  await f.page.waitForTimeout(1900);
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

/* ------------------------------------------------------------------ *
 * Tobis Woche als Protokoll
 * ------------------------------------------------------------------ */

// `lastBackup`: gesichert – sonst stünde über allem die Zeile zur Sicherung
// (bei Tobi läuft die automatische), und die Startseite wäre schon ohne die
// Zeile zum Tagesabschluss länger als ein Bildschirm.
const GRUND = {
  greeted: true, name: 'Tobi', focus: 'cut', level: 'geuebt', mode: 'db', supersatz: true, shift: SHIFT,
  lastBackup: { on: '2026-10-24', done: 99 },
};

/** Ein ISO-Tag plus `d` Tage – in UTC gerechnet, damit keine Zeitumstellung dazwischenfunkt. */
const plusTage = (iso, d) => new Date(Date.parse(`${iso}T12:00:00Z`) + d * 86400000).toISOString().slice(0, 10);
/**
 * Die Grundlisten aller Einheiten und ihre Tage (Plandatum plus SHIFT) –
 * einmal aus der App selbst, mit leerem Protokoll. Alle, nicht nur die ersten
 * 16: In 20 liegt die letzte Einheit der Runde.
 */
const PLAN = await (async () => {
  const f = await fall('Plan lesen', GRUND, T.sa);
  const p = await f.M(({ P, D }) => D.PLAN.map((w) => ({
    n: w.n, date: w.date, ex: P.exBasis(w, 'db').map((x) => ({ id: x.id, sets: x.sets })),
  })));
  await f.ctx.close();
  offen.delete(f.ctx);
  return p.map((w) => ({ ...w, tag: plusTage(w.date, SHIFT) }));
})();
const tagVon = (n) => PLAN[n - 1].tag;
check(tagVon(12) === TAG.sa && tagVon(13) === TAG.mo && tagVon(10) === '2026-10-21',
  `Ausgangslage: Workout 12 am Sa 24.10., Workout 13 am Mo 26.10. (${tagVon(12)}, ${tagVon(13)})`);

/**
 * Ein Protokolleintrag wie die App ihn schreibt: `soll` für jede Übung (die
 * Liste stempelt beim Öffnen alle), Nacharbeit festgehalten (keine), die
 * ersten `k` Sätze abgehakt – alle, wenn `k` fehlt, und dann abgeschlossen.
 */
function eintrag(n, k = Infinity, tag = tagVon(n)) {
  const e = { db: {}, bw: {}, mode: 'db', soll: {}, nach: {}, nachFest: { db: {}, bw: {} }, nachWarum: { db: {}, bw: {} } };
  let rest = k;
  PLAN[n - 1].ex.forEach(({ id, sets }) => {
    e.soll[id] = sets;
    e.nach[id] = 0;
    e.db[id] = Array.from({ length: sets }, () => {
      const d = rest > 0;
      if (d) rest -= 1;
      return { w: '', done: d };
    });
  });
  if (k > 0) e.startedOn = tag;
  if (k === Infinity) e.done = 'db';
  return e;
}
/** Workout 1 bis `bis` ganz gemacht. */
const fertigBis = (bis) => Object.fromEntries(Array.from({ length: bis }, (_, i) => [i + 1, eintrag(i + 1)]));
const ms = (iso) => new Date(iso).getTime();

/**
 * Tobis Samstag: 1–11 ganz, Workout 12 mit 4 von 15. `extra` ergänzt den Zustand.
 * Der letzte Eintrag steht hier, wie v241 ihn schrieb (`letzterEintrag`); er
 * zieht beim Laden in seine Einheit um – so geht jeder Fall auch über den Umzug.
 */
const samstag = (extra = {}) => ({
  ...GRUND,
  log: { ...fertigBis(11), 12: eintrag(12, 4) },
  letzterEintrag: { n: '12', at: ms(T.sa) },
  ...extra,
});

/** Was die Startseite zeigt. */
async function blick(f) {
  return {
    auge: await f.txt('.hero-eyebrow'),
    titel: await f.txt('.hero-title'),
    sub: await f.txt('.hero-sub'),
    zeile: await f.txt('.notice.abschluss'),
    zeilen: await f.page.locator('.notice.abschluss').count(),
    frei: await f.txt('.ov-frei'),
    fokus: await f.page.locator('.focus-cue').count() > 0,
    // Knöpfe in der Zeile – seit v244 keine: kein „Rest heute machen", kein „OK".
    knoepfe: await f.page.locator('.notice.abschluss button, .notice.abschluss [data-act]').count(),
    kopf: await f.txt('.fertig-kopf'),
  };
}
/**
 * Die Startseite gemessen: die Zeile zum Abschluss (Höhe und ihre Zeilen, wie
 * sie umbricht – Zeichen für Zeichen nach ihrer Lage), der Überhang und der
 * Fuß gegen die Leiste.
 */
const seiteMessen = (f) => f.page.evaluate(() => {
  const z = document.querySelector('.notice.abschluss');
  const zeilen = new Map();
  if (z) {
    const gang = document.createTreeWalker(z, window.NodeFilter.SHOW_TEXT);
    while (gang.nextNode()) {
      const t = gang.currentNode;
      for (let i = 0; i < t.length; i++) {
        const r = document.createRange();
        r.setStart(t, i);
        r.setEnd(t, i + 1);
        const box = r.getClientRects()[0];
        if (box) zeilen.set(Math.round(box.top), (zeilen.get(Math.round(box.top)) || '') + t.data[i]);
      }
    }
  }
  const leiste = document.getElementById('tabbar').getBoundingClientRect();
  const fuss = document.querySelector('.ov-foot').getBoundingClientRect();
  return {
    hoehe: z ? Math.round(z.getBoundingClientRect().height) : 0,
    zeilen: [...zeilen.entries()].sort((a, b) => a[0] - b[0]).map(([, s]) => s.replace(/\s+/g, ' ').trim()),
    scroll: document.documentElement.scrollHeight - window.innerHeight,
    fussUnten: Math.round(fuss.bottom),
    sichtbar: Math.round(Math.min(window.innerHeight, leiste.height ? leiste.top : window.innerHeight)),
  };
});
/** Unter Mehr einen Knopf tippen – die Abschnitte aufklappen, bis er da ist. */
async function mehr(f, sel) {
  await f.klick('#tab-settings', 300);
  for (let i = 0; i < 8 && !(await f.page.locator(sel).count()); i++) {
    const zu = f.page.locator('details:not([open]) > summary');
    if (!(await zu.count())) break;
    await zu.first().click();
    await f.page.waitForTimeout(150);
  }
  await f.page.locator(sel).first().evaluate((b) => b.click());
  await f.page.waitForTimeout(800);
  await f.page.waitForLoadState('networkidle').catch(() => {});
  if (await f.page.locator('#tab-dashboard').count()) await f.klick('#tab-dashboard', 300);
}
/**
 * Zurück in eine abgeschlossene Einheit, wie es seit v244 geht: auf der
 * Startseite zu ihr blättern (von einem Zusatztag aus erst zurück zum Plan) und
 * „Doch noch weitermachen". Gibt zurück, was die Karte davor zeigte.
 */
async function dochWeiter(f, n = 12) {
  if (await f.page.locator('[data-act="back-to-plan"]').count()) await f.klick('[data-act="back-to-plan"]', 250);
  for (let i = 0; i < 8; i++) {
    const m = (await f.txt('.hero-eyebrow')).match(/Workout (\d+)/);
    if (m && Number(m[1]) === n) break;
    await f.klick(`[data-act="nav-workout"][data-delta="${m && Number(m[1]) < n ? 1 : -1}"]`, 250);
  }
  const karte = { auge: await f.txt('.hero-eyebrow'), kopf: await f.txt('.fertig-kopf'), sub: await f.txt('.fertig-sub') };
  await f.klick('[data-act="start-session"]:has-text("Doch noch weitermachen")', 400);
  return karte;
}
/** Aus der Fokusansicht zurück aufs Dashboard. */
async function zurueck(f) {
  for (let k = 0; k < 3 && await f.page.locator('.focus-cue').count(); k++) {
    await f.page.goBack();
    await f.page.waitForTimeout(250);
  }
}
const satzText = 'Workout 12 vom Samstag ist abgeschlossen – 4 von 15 Sätzen.';
/** Die Zusatzübungen der Woche `woche` in Einheit `n`, wie sie dasteht: Sätze. */
const zusatzIn = (f, n, woche) => f.M(({ P }, [k, wo]) => P.workoutByNo(k).ex
  .filter((x) => x.zusatz && x.zusatz.woche === wo).reduce((a, x) => a + x.sets, 0), [n, woche]);
/** Nachholsätze in Einheit `n`, wie sie dasteht. */
const nachIn = (f, n) => f.M(({ P }, k) => P.workoutByNo(k).ex.reduce((a, x) => a + (x.nach || 0), 0), n);
/** Was der Toast zuletzt sagte – und ob er gerade steht. */
const toastText = (f) => f.page.evaluate(() => {
  const t = document.getElementById('toast');
  return t && t.classList.contains('show') ? t.textContent : '';
});
/** Zur Übungsliste der gezeigten Einheit (aus der Fokusansicht oder vom Dashboard). */
async function zurListe(f) {
  if (await f.page.locator('[data-act="focus-list"]').count()) await f.klick('[data-act="focus-list"]', 200);
  else if (await f.page.locator('[data-act="show-list"]').count()) await f.klick('[data-act="show-list"]', 200);
}
/** In der Liste `k` offene Sätze abhaken, der Reihe nach. */
async function hake(f, k) {
  for (let i = 0; i < k; i++) {
    const l = f.page.locator('[data-act="toggle-set"][aria-pressed="false"]');
    if (!(await l.count())) return i;
    await l.first().click();
    await f.page.waitForTimeout(120);
    if (await f.page.locator('[data-act="focus-list"]').count()) await f.klick('[data-act="focus-list"]', 120);
  }
  return k;
}

/* ------------------------------------------------------------------ *
 * 1, 2 und 8a: Abschluss beim Laden, die Zeile, der Zusatz am Montag
 * ------------------------------------------------------------------ */
await abschnitt(1, async () => {
  const f = await fall('1 Laden', samstag(), T.sa);
  const sa = await blick(f);
  check(/Heute · Workout 12/.test(sa.auge) && sa.zeilen === 0,
    `1 Samstag: „Heute · Workout 12", keine Zeile (${sa.auge})`);
  await f.tag(T.so);
  const st = await f.lies();
  const e12 = st.log[12];
  check(e12.done === 'db', `1 Sonntag: Workout 12 ist abgeschlossen, mit Hanteln (done ${e12.done})`);
  check(e12.startedOn === TAG.sa, `1 und bleibt auf Samstag (${e12.startedOn})`);
  const cm = await f.M(({ P }) => [P.completedMode(12), P.defaultWorkoutNo()]);
  check(cm[0] === 'db' && cm[1] === 13, `1 completedMode db, als Nächstes Workout 13 (${cm.join(', ')})`);
  const kal = await f.M(({ P, D }) => {
    return { tag: P.effDate(D.PLAN[11]), aus: [...P.ausfallTage().keys()] };
  });
  check(kal.tag === TAG.sa && !kal.aus.includes(TAG.sa),
    `1 Kalender: Workout 12 steht am Samstag, nichts ausgefallen (${kal.tag}, ausgefallen: ${kal.aus.join(', ') || '–'})`);
  const so = await blick(f);
  console.log(`     So: ${so.auge} | ${so.titel} | ${so.sub} | Zeile: ${so.zeile} | frei: ${so.frei}`);
  check(/Morgen · Workout 13/.test(so.auge) && !/Gestern/.test(so.auge),
    `1 die Startseite zeigt „Morgen · Workout 13", nicht mehr Workout 12 von gestern („${so.auge}")`);
  check(so.zeilen === 1 && so.zeile.startsWith(`✓ ${satzText}`), `2 die Zeile mit Zahlen und Tag: „${so.zeile}"`);
  // „Ich will nicht zwischen ok und Rest heute wählen können." Bis v242 standen
  // „Rest heute machen" und „OK" darunter.
  check(so.knoepfe === 0 && !/Rest heute machen|\bOK\b/.test(so.zeile),
    `2 ohne Knopf – kein „Rest heute machen", kein „OK" (${so.knoepfe} Knöpfe)`);
  const tabelle = st.tagesabschluss;
  check(!!tabelle && tabelle.am === TAG.so && tabelle.einheiten.length === 1
    && tabelle.einheiten[0].n === 12 && tabelle.einheiten[0].done === 4 && tabelle.einheiten[0].total === 15
    && tabelle.einheiten[0].tag === TAG.sa,
  `2 gespeichert: ${JSON.stringify(tabelle)}`);
  // Wohin der Rest geht: Ein Zusatztag allein ist am Sonntag nicht möglich
  // (die Gruppen von Samstag und Montag ruhen) – also kommt er morgen in
  // Workout 13. Die Zeile sagt genau das, mit der Zahl, die zusatzMorgen()
  // für die Zeile am Ruhetag rechnet.
  // Mit dem Bezug ausgeschrieben: „Davon" hinter „4 von 15 Sätzen" las sich
  // wie „von den 4 gemachten". Gemeint sind die 11 offenen – und die nennt
  // die Zeile jetzt.
  const morgen = (so.zeile.match(/Von den 11 offenen Sätzen kommen morgen (\d+) in Workout 13 mit rein\./) || [])[1];
  check(!!morgen, `2 Ziel: „Von den 11 offenen Sätzen kommen morgen … in Workout 13 mit rein." („${so.zeile}")`);
  check(so.frei === '', `2 keine zweite Zeile am Ruhetag mit derselben Zahl („${so.frei}")`);
  // Ist die Zeile weg, steht es wieder in der Zeile am Ruhetag. Bis v242 ging
  // sie hier mit „OK"; am Sonntag selbst geht sie nur mit einem Eintrag, und
  // der änderte die Zahl. Also von Hand weggenommen – auf einer Kopie, damit
  // der Montag unten mit dem echten Stand rechnet.
  const kopie = await fall('2 Zeile weg', { ...(await f.lies()), tagesabschluss: null }, T.so);
  const ohne = await blick(kopie);
  check(ohne.zeilen === 0 && ohne.frei === `Heute frei. Aus Woche 3 kommt dazu: morgen +${morgen}.`,
    `2 ist die Zeile weg, steht es wieder in der Zeile am Ruhetag, dieselbe Zahl („${ohne.frei}")`);
  await ende(kopie);
  // 8a: Am Montag steckt der Zusatztag der Woche 3 in Workout 13 – mit genau
  // diesen Sätzen.
  await f.tag(T.mo);
  const mo = await blick(f);
  const zus = await zusatzIn(f, 13, 3);
  console.log(`     Mo: ${mo.auge} | ${mo.sub} | Zusatz ${zus}`);
  check(/Heute · Workout 13/.test(mo.auge) && zus === Number(morgen),
    `8 Montag: Workout 13 trägt den Zusatz aus Woche 3 – ${zus} Sätze, angekündigt ${morgen} („${mo.auge} · ${mo.sub}")`);
  await ende(f);
});

/*
 * Die Startseite bleibt mit der Zeile eine Bildschirmseite („Hier beim
 * dashboard soll man nicht scrollen können") – am Sonntag und am Montag, wo
 * Workout 13 mit dem Zusatz länger ist. Und am Montag, dem Tag danach, steht
 * sie noch: Die Zeile rechnet live und sagt jetzt „heute".
 */
await abschnitt(2, async () => {
  const f = await fall('2 Montag', samstag(), T.sa);
  await f.tag(T.so);
  const seite = async (wo) => {
    for (const [b, h] of [[414, 896], [360, 740]]) {
      await f.page.setViewportSize({ width: b, height: h });
      await f.page.reload({ waitUntil: 'networkidle' });
      await f.page.waitForTimeout(300);
      const m = await f.page.evaluate(() => {
        const leiste = document.getElementById('tabbar').getBoundingClientRect();
        const fuss = document.querySelector('.ov-foot').getBoundingClientRect();
        const z = document.querySelector('.notice.abschluss');
        return {
          sichtbar: Math.min(window.innerHeight, leiste.height ? leiste.top : window.innerHeight),
          fussUnten: fuss.bottom, zeile: z ? Math.round(z.getBoundingClientRect().height) : 0,
          scroll: document.documentElement.scrollHeight - window.innerHeight,
          breit: document.documentElement.scrollWidth > window.innerWidth + 1,
        };
      });
      check(m.zeile > 0 && m.scroll <= 0 && !m.breit && m.fussUnten <= m.sichtbar,
        `2 ${wo} ${b}×${h}: mit der Zeile (${m.zeile} px) eine Seite, Fuß über der Leiste (Überhang ${m.scroll}, Fuß ${Math.round(m.fussUnten)} / ${Math.round(m.sichtbar)})`);
    }
  };
  await seite('Sonntag');
  await f.tag(T.mo);
  await seite('Montag');
  const mo = await blick(f);
  const zus = await zusatzIn(f, 13, 3);
  check(mo.zeile.startsWith(`✓ ${satzText}`) && mo.zeile.includes(`Von den 11 offenen Sätzen kommen heute ${zus} in Workout 13 mit rein.`),
    `2 Montag, der Tag danach – die Zeile steht noch: „${mo.zeile}"`);
  await ende(f);

  // b) Dazu klemmt der Ton: Die App lag über Nacht im Speicher, iOS hat den
  //    Tonkanal unterbrochen, und er wacht nach der Berührung nicht auf – dann
  //    kommt die stille Zeile zum Ton (tonHinweis() in js/app.js). Zusammen
  //    mit der Zeile zum Abschluss lag der Fuß der Startseite bei 360×740
  //    78 px (Sonntag) und 111 px (Montag) unter der Leiste, mit der Zeile zum
  //    Ton allein (116 px) noch 35 und 45 px. Jetzt hat auf der Startseite die
  //    Zeile zum Abschluss Vorrang, danach steht die zum Ton, kurz, und beides
  //    bleibt eine Seite. Seit v244 geht die Zeile von selbst statt mit „OK":
  //    am Sonntag mit dem nachgetragenen Satz, sonst am Dienstag.
  const messen = (fl) => fl.page.evaluate(async () => {
    const a = await import('./js/audio.js');
    const leiste = document.getElementById('tabbar').getBoundingClientRect();
    const fuss = document.querySelector('.ov-foot').getBoundingClientRect();
    const ton = document.querySelector('.ov > #tonHinweis');
    return {
      klemmt: a.tonStand().klemmt,
      sichtbar: Math.min(window.innerHeight, leiste.height ? leiste.top : window.innerHeight),
      fussUnten: fuss.bottom, zeile: document.querySelectorAll('.ov > .notice.abschluss').length,
      ton: ton ? Math.round(ton.getBoundingClientRect().height) : 0,
      tonText: ton ? ton.textContent.replace(/\s+/g, ' ').trim() : '',
      scroll: document.documentElement.scrollHeight - window.innerHeight,
    };
  });
  const tonSeite = async (fl, wo, mitZeile) => {
    for (const [b, h] of [[414, 896], [360, 740]]) {
      await fl.page.setViewportSize({ width: b, height: h });
      await fl.page.reload({ waitUntil: 'networkidle' });
      await fl.page.waitForTimeout(300);
      await klemmen(fl);
      const m = await messen(fl);
      const passt = m.scroll <= 0 && m.fussUnten <= m.sichtbar;
      if (mitZeile) {
        check(m.klemmt && m.zeile === 1 && m.ton === 0 && passt,
          `2b ${wo} ${b}×${h}, Ton klemmt (${m.klemmt}): oben nur die Zeile zum Abschluss, eine Seite (Ton-Zeile ${m.ton} px, Überhang ${m.scroll}, Fuß ${Math.round(m.fussUnten)} / ${Math.round(m.sichtbar)})`);
      } else {
        check(m.klemmt && m.zeile === 0 && m.ton > 0 && m.ton <= 60 && passt,
          `2b ${wo} ${b}×${h}: die Zeile zum Ton (${m.ton} px), eine Seite (Überhang ${m.scroll}, Fuß ${Math.round(m.fussUnten)} / ${Math.round(m.sichtbar)}) – „${m.tonText}"`);
      }
    }
  };
  const g = await fall('2b Ton klemmt', samstag(), T.sa, { klemmt: true });
  await g.tag(T.so);
  await tonSeite(g, 'Sonntag', true);
  await g.tag(T.mo);
  await tonSeite(g, 'Montag', true);
  // Dienstag, Montag nicht trainiert: Die Zeile ist weg, Workout 13 mit dem
  // Zusatz ist heute dran – so lang wie die Seite am Montag.
  await g.tag('2026-10-27T17:00:00+01:00');
  await tonSeite(g, 'Dienstag, die Zeile ist weg', false);
  await ende(g);
  // Sonntag: ein vergessener Satz in Workout 12 nachgetragen – die Zeile geht,
  // die am Ruhetag steht da.
  const h = await fall('2b Ton klemmt, Sonntag', samstag(), T.sa, { klemmt: true });
  await h.tag(T.so);
  await h.klick('[data-act="nav-workout"][data-delta="-1"]', 200);
  await zurListe(h);
  await hake(h, 1);
  // Der Haken startet die Pause; ihre Leiste unten wäre sonst mitgemessen
  // (63 px). „Fertig", wie nach jedem Satz.
  if (await h.page.locator('#restBar:not([hidden]) #restSkip').count()) await h.klick('#restSkip', 200);
  await h.klick('[data-act="hide-list"]', 200);
  check((await h.lies()).tagesabschluss === null, '2b Sonntag: nach dem nachgetragenen Satz ist die Zeile weg');
  await tonSeite(h, 'Sonntag, die Zeile ist weg', false);
  await ende(h);
  // Und am Samstag selbst, Workout 12 angefangen: Fortschritt, „Training
  // fortsetzen" und „Als trainiert markieren" stehen da, keine Zeile zum
  // Abschluss. Die Karte gab ihre Höhe nur neben der Zeile zum Abschluss ab –
  // mit der kurzen Zeile zum Ton allein lag der Fuß bei 360×740 noch 13 px
  // unter der Leiste (Überhang 40).
  const s = await fall('2b Ton klemmt, Samstag', samstag(), T.sa, { klemmt: true });
  await tonSeite(s, 'Samstag, Workout 12 angefangen', false);
  await ende(s);
});

/* ------------------------------------------------------------------ *
 * 3: Zurück in die Einheit – blättern, „Doch noch weitermachen"
 * ------------------------------------------------------------------ */
await abschnitt(3, async () => {
  // Bis v242 führte „Rest heute machen" in der Zeile hinein. Jetzt geht es
  // dorthin, wo jede abgeschlossene Einheit ihren Weg zurück hat – auf ihre
  // Karte, unaufdringlich, nur für den, der dorthin blättert.
  const f = await fall('3 Doch noch', samstag(), T.sa);
  await f.tag(T.so);
  const karte = await dochWeiter(f);
  check(/Gestern · Workout 12/.test(karte.auge) && karte.kopf === '✓ Abgeschlossen',
    `3 zurückgeblättert: „${karte.auge}" über „${karte.kopf}" – nicht „Für heute durch"`);
  const drin = await blick(f);
  const lage = await f.M(({ store, P }) => {
    const s = store.getState();
    const ex = P.workoutByNo(12).ex;
    return {
      session: s.session && s.session.n, zeile: s.tagesabschluss,
      offen: ex.filter((x) => P.saetzeErledigt(12, x.id, x.sets) < x.sets).map((x) => x.id),
    };
  });
  const gezeigt = await f.page.evaluate(() => (document.querySelector('.focus-sets .set-btn') || {}).dataset?.ex || null);
  check(drin.fokus && lage.session === 12, `3 „Doch noch weitermachen" öffnet Workout 12 in der Fokusansicht, Sitzung läuft (${lage.session})`);
  check(lage.offen.includes(gezeigt), `3 bei einer Übung mit offenem Satz (${gezeigt}; offen: ${lage.offen.join(', ')})`);
  check(lage.zeile !== null, '3 die Zeile bleibt, solange nichts eingetragen ist – sie stimmt noch');
  await f.page.locator('.focus-sets .set-btn:not(.on)').first().click();
  await f.page.waitForTimeout(300);
  const nach = await f.M(({ store, P }, heute) => ({
    e: store.getState().log[12], cm: P.completedMode(12), heute: store.trainiertAm(12, heute),
    prog: P.progressOf(12, 'db').done, zeile: store.getState().tagesabschluss,
  }), TAG.so);
  check(nach.e.startedOn === TAG.sa && nach.e.weiterAm === TAG.so && nach.cm === 'db' && nach.prog === 5,
    `3 ein Haken: Workout 12 bleibt auf Samstag und abgeschlossen, 5 Sätze, weiter am Sonntag (${nach.e.startedOn}, ${nach.e.weiterAm}, ${nach.cm}, ${nach.prog})`);
  check(nach.heute, '3 der Sonntag gilt jetzt als Trainingstag (trainiertAm)');
  check(nach.zeile === null, `3 mit dem ersten Haken ist die Zeile weg – „4 von 15" stimmt nicht mehr (${JSON.stringify(nach.zeile)})`);
  // Abschließen und zurück: Heute ist nicht mehr frei – kein „Heute frei",
  // kein Zusatztag für heute.
  await zurueck(f);
  if (await f.page.locator('[data-act="finish-session"]').count()) await f.klick('[data-act="finish-session"]', 400);
  const danach = await blick(f);
  const bindung = await f.M(({ P }) => [P.zusatzEinheit(), P.zusatzEinheit('2026-10-26') && P.zusatzEinheit('2026-10-26').n]);
  console.log(`     So nach dem Rest: ${danach.auge} | ${danach.sub} | frei: „${danach.frei}" | Zeile: „${danach.zeile}"`);
  check(danach.frei === '' && danach.zeilen === 0, `3 danach keine Zeile „Heute frei" (${danach.frei || '–'})`);
  check(bindung[0] === null, '3 und kein Zusatztag in eine Einheit von heute (zusatzEinheit)');
  const st = await f.lies();
  check(!st.session && st.log[12].startedOn === TAG.sa, '3 Sitzung beendet, Workout 12 weiter am Samstag');
  await ende(f);

  // b) Nachtragen ist kein Training: ein vergessener Satz von Samstag, am
  //    Sonntag ohne Sitzung in der Liste nachgehakt (wie R12 in
  //    tests/test-nacharbeit-ruhetag.mjs) – heute bleibt frei. Die Zeile oben
  //    geht dabei: Sie sagte „4 von 15", und wer dort einträgt, ist bei der
  //    Einheit. Was jetzt gilt, sagt die Zeile am Ruhetag.
  const g = await fall('3b Nachtragen', samstag(), T.sa);
  await g.tag(T.so);
  const vor = await blick(g);
  check(vor.zeilen === 1 && vor.frei === '', `3b Sonntag: die Zeile steht, die am Ruhetag nennt nichts doppelt („${vor.frei}")`);
  await g.klick('[data-act="nav-workout"][data-delta="-1"]', 200);
  await zurListe(g);
  await hake(g, 1);
  const nt = await g.M(({ store }, heute) => ({
    e: store.getState().log[12], heute: store.trainiertAm(12, heute), zeile: store.getState().tagesabschluss,
  }), TAG.so);
  check(nt.e.weiterAm === undefined && !nt.heute, `3b ohne Sitzung nachgehakt: kein Trainingstag (weiterAm ${nt.e.weiterAm})`);
  check(nt.zeile === null, `3b der nachgetragene Satz nimmt die Zeile weg (${JSON.stringify(nt.zeile)})`);
  await g.klick('[data-act="hide-list"]', 200);
  const k12 = await blick(g);
  check(k12.kopf === '✓ Abgeschlossen', `3b Workout 12 heißt weiter „${k12.kopf}" – Nachtragen ist kein Training von heute`);
  await g.klick('[data-act="nav-workout"][data-delta="1"]', 200);
  const nb = await blick(g);
  check(nb.zeilen === 0 && /^Heute frei\./.test(nb.frei), `3b und die Zeile am Ruhetag sagt, was jetzt gilt („${nb.frei}")`);
  await ende(g);
});

/* ------------------------------------------------------------------ *
 * 4: Die Enden der Zeile – ohne Knopf, nie ewig
 * ------------------------------------------------------------------ */
await abschnitt(4, async () => {
  // a) Sie bleibt über das Neuladen, am Montag – dem Tag danach – auch noch.
  //    Am Dienstag ist sie weg, ohne dass trainiert wurde, und auch aus dem
  //    Zustand: Sonst reiste sie in der nächsten Sicherung mit.
  const f = await fall('4 von selbst', samstag(), T.sa);
  await f.tag(T.so);
  const so = await blick(f);
  check(so.zeilen === 1 && so.knoepfe === 0, `4 Sonntag: die Zeile steht, ohne Knopf (${so.knoepfe})`);
  const sonntag = await f.lies();
  await f.tag('2026-10-25T21:00:00+01:00');
  check((await blick(f)).zeilen === 1, '4 sie bleibt über das Neuladen');
  await f.tag(T.mo);
  check((await blick(f)).zeilen === 1, '4 Montag, der Tag danach: sie steht noch');
  await f.tag('2026-10-27T09:00:00+01:00');
  const di = await blick(f);
  let st = await f.lies();
  check(di.zeilen === 0 && st.tagesabschluss === null && !(st.log[13] && st.log[13].startedOn),
    `4 Dienstag, ohne Training: weg, auch aus dem Zustand (${JSON.stringify(st.tagesabschluss)}; „${di.auge}")`);
  await ende(f);

  // b) Bei offener App: Montag 23:50 steht sie, um 0:00:30 ist sie weg – die
  //    Uhr um Mitternacht, ohne Neuladen und ohne Berührung.
  const u = await fall('4 Mitternacht', sonntag, '2026-10-26T23:50:00+01:00', { laufend: true });
  check((await blick(u)).zeilen === 1, '4 Montag 23:50, App offen: die Zeile steht');
  await u.page.clock.fastForward(ms('2026-10-27T00:00:30+01:00') - ms('2026-10-26T23:50:00+01:00'));
  await u.page.waitForTimeout(400);
  const nacht = await u.M(({ store }) => store.getState().tagesabschluss);
  check((await blick(u)).zeilen === 0 && nacht === null, `4 Dienstag 0:00:30, App offen: weg (${JSON.stringify(nacht)})`);
  await ende(u);

  // c) Nie ewig, auch nicht aus einer Sicherung: eine Zeile von vor einer
  //    Woche (Workout 8, abgeschlossen am Sonntag, 18.10.) oder eine aus der
  //    Zukunft – ein Gerät mit falsch gehender Uhr – steht nicht da und ist
  //    nach dem Laden aus dem Zustand.
  for (const [name, zeile] of [
    ['eine Woche alt', { am: '2026-10-18', einheiten: [{ n: 8, tag: tagVon(8), done: 4, total: 15 }] }],
    ['aus der Zukunft', { am: '2026-11-30', einheiten: [{ n: 12, tag: TAG.sa, done: 4, total: 15 }] }],
  ]) {
    const h = await fall(`4 ${name}`, { ...sonntag, tagesabschluss: zeile }, '2026-10-25T11:00:00+01:00');
    const b = await blick(h);
    st = await h.lies();
    check(b.zeilen === 0 && st.tagesabschluss === null, `4 ${name}: keine Zeile, weg aus dem Zustand („${b.zeile}")`);
    await ende(h);
  }

  // d) Zurücksetzen: Workout 12 ist danach nicht mehr abgeschlossen – die
  //    Zeile sagte es aber. Sie geht mit.
  const r = await fall('4 Zurücksetzen', sonntag, '2026-10-25T11:00:00+01:00');
  await r.klick('[data-act="nav-workout"][data-delta="-1"]', 200);
  await zurListe(r);
  await r.klick('[data-act="reset-workout"]', 400);
  st = await r.lies();
  await r.klick('[data-act="hide-list"]', 200).catch(() => {});
  const nachReset = await blick(r);
  check(!st.log[12].done && st.tagesabschluss === null && nachReset.zeilen === 0,
    `4 Workout 12 zurückgesetzt: keine Zeile „ist abgeschlossen" mehr (done ${st.log[12].done}, ${JSON.stringify(st.tagesabschluss)})`);
  await ende(r);

  // e) Ein neuer Tagesabschluss ersetzt eine Zeile, die noch steht – hier
  //    eine vom Samstag zu Workout 11, aus einer Sicherung.
  const zn = samstag({
    log: { ...fertigBis(10), 11: { ...eintrag(11, 3), done: 'db' }, 12: eintrag(12, 4) },
    tagesabschluss: { am: TAG.sa, einheiten: [{ n: 11, tag: tagVon(11), done: 3, total: 12 }] },
  });
  const n = await fall('4 neuer Abschluss', zn, T.sa);
  check((await blick(n)).zeile.startsWith('✓ Workout 11 vom Freitag ist abgeschlossen – 3 von 12 Sätzen.'),
    `4 Samstag: die Zeile zu Workout 11 („${(await blick(n)).zeile.slice(0, 60)}")`);
  await n.tag(T.so);
  const neu = await blick(n);
  check(neu.zeilen === 1 && neu.zeile.startsWith(`✓ ${satzText}`) && !/Workout 11/.test(neu.zeile),
    `4 Sonntag: der neue Abschluss ersetzt sie („${neu.zeile.slice(0, 70)}")`);
  await ende(n);

  // f) Mit dem ersten Haken in der nächsten Einheit.
  const g = await fall('4 nächste Einheit', samstag(), T.sa);
  await g.tag(T.so);
  await zurListe(g);
  await hake(g, 1);
  st = await g.lies();
  check(st.tagesabschluss === null && !!(st.log[13] && st.log[13].startedOn),
    `4 mit dem ersten Haken in Workout 13 ist die Zeile weg (${JSON.stringify(st.tagesabschluss)})`);
  await g.klick('[data-act="hide-list"]', 200).catch(() => {});
  check((await blick(g)).zeilen === 0, '4 und steht nicht mehr da');
  await ende(g);

  // g) Ein Fokuswechsel und „Von vorn beginnen": Die Zeile sprach vom alten
  //    Plan. Danach stand über „Morgen · Workout 1" (Aufbau) bzw. „Heute ·
  //    Workout 1" weiter „✓ Workout 12 vom Samstag ist abgeschlossen" –
  //    Workout 12 dort liegt in 20 bzw. 19 Tagen und ist unberührt. Bis v242
  //    ließ sie sich wegtippen; ohne Knopf stand sie bis zum ersten Satz oder
  //    bis Dienstag.
  for (const [name, sel] of [
    ['Fokuswechsel', '[data-act="set-focus"][data-v="standard"]'],
    ['Von vorn beginnen', '[data-act="restart-plan"]'],
  ]) {
    const p = await fall(`4 ${name}`, sonntag, '2026-10-25T11:00:00+01:00');
    const vor = await blick(p);
    await mehr(p, sel);
    const b = await blick(p);
    st = await p.lies();
    check(vor.zeilen === 1 && /Workout 1\b/.test(b.auge) && b.zeilen === 0 && st.tagesabschluss === null,
      `4 ${name}: „${b.auge}" – die Zeile vom alten Plan ist weg, auch aus dem Zustand („${b.zeile}", ${JSON.stringify(st.tagesabschluss)})`);
    await ende(p);
  }
  // Scheitert der Wechsel am vollen Speicher, bleibt alles, wie es war – die
  // Zeile auch (mitAblage() in js/store.js).
  const v = await fall('4 Fokuswechsel, Speicher voll', sonntag, '2026-10-25T11:00:00+01:00');
  const voll = await v.M(({ store }) => {
    const orig = window.Storage.prototype.setItem;
    window.Storage.prototype.setItem = function setItem(k, wert) {
      if (k === 'workout.rounds.v1') throw new window.DOMException('voll', 'QuotaExceededError');
      return orig.call(this, k, wert);
    };
    try {
      return { ok: store.wechsleFokus('standard', null, 0), focus: store.getState().focus, z: store.getState().tagesabschluss };
    } finally {
      window.Storage.prototype.setItem = orig;
    }
  });
  check(voll.ok === false && voll.focus === 'cut' && !!voll.z && voll.z.einheiten[0].n === 12,
    `4 Fokuswechsel am vollen Speicher gescheitert: Fokus und Zeile wie vorher (${voll.focus}, ${JSON.stringify(voll.z)})`);
  await ende(v);
});

/* ------------------------------------------------------------------ *
 * 5: Training über Mitternacht
 * ------------------------------------------------------------------ */
await abschnitt(5, async () => {
  // Samstag 23:30: Workout 12 läuft, 8 Sätze stehen, die Fokusansicht ist offen.
  const z = samstag({
    log: { ...fertigBis(11), 12: eintrag(12, 8) },
    session: { n: 12 },
    clock: { n: 12, on: TAG.sa, spent: 40 * 60000, since: null, halt: ms('2026-10-24T23:30:00+02:00'), gebucht: 2400 },
    letzterEintrag: { n: '12', at: ms('2026-10-24T23:28:00+02:00') },
    fokusOffen: { n: 12, id: null },
  });
  z.log[12].secs = 2400;
  const f = await fall('5 Mitternacht', z, '2026-10-24T23:30:00+02:00');
  check((await blick(f)).fokus, '5 Samstag 23:30: in der Fokusansicht');
  await f.page.clock.setFixedTime(new Date(T.sa2350));
  await f.page.locator('.focus-sets .set-btn:not(.on)').first().click();
  await f.page.waitForTimeout(300);
  // Weg um 23:55, zurück um 0:20 – über Mitternacht, 25 Minuten.
  await f.page.clock.setFixedTime(new Date('2026-10-24T23:55:00+02:00'));
  await f.wegUndZurueck(T.so0020);
  let st = await f.lies();
  const lauf = await f.M(({ store }) => ({ s: store.getState().session, c: store.getState().clock }));
  check(!st.log[12].done && lauf.s && lauf.s.n === 12 && lauf.c.since !== null && !st.tagesabschluss,
    `5 um 0:20 zurück: nichts abgeschlossen, die Sitzung läuft, die Uhr auch (${JSON.stringify(lauf.s)}, since ${lauf.c.since})`);
  // Neu geladen um 0:25 (das Handy hat die App beendet): weiter in der Fokusansicht.
  await f.tag('2026-10-25T00:25:00+02:00');
  const neu = await blick(f);
  check(neu.fokus && !(await f.lies()).log[12].done, '5 neu geladen um 0:25: weiter in der Fokusansicht, offen');
  // Zurück aufs Dashboard: „Gestern angefangen".
  for (let k = 0; k < 3 && await f.page.locator('.focus-cue').count(); k++) {
    await f.page.goBack();
    await f.page.waitForTimeout(250);
  }
  const brett = await blick(f);
  check(/Gestern angefangen · Workout 12/.test(brett.auge), `5 im Kopf: „${brett.auge}"`);
  // Die restlichen Sätze, und die Einheit endet normal.
  await f.klick('[data-act="start-session"]', 300);
  await zurListe(f);
  await hake(f, 20);
  st = await f.lies();
  check(st.log[12].done === 'db' && !st.session && !st.tagesabschluss && st.log[12].weiterAm === undefined,
    `5 der letzte Satz beendet sie wie immer – keine Zeile, kein zweiter Trainingstag (done ${st.log[12].done}, weiterAm ${st.log[12].weiterAm})`);
  await ende(f);
});

/* ------------------------------------------------------------------ *
 * 6: Eine liegen gebliebene Sitzung
 * ------------------------------------------------------------------ */
await abschnitt(6, async () => {
  // a) Beim Laden: Sitzung seit Samstag 18:05 angehalten.
  const za = samstag({
    session: { n: 12 },
    clock: { n: 12, on: TAG.sa, spent: 30 * 60000, since: null, halt: ms('2026-10-24T18:05:00+02:00'), gebucht: 1800 },
    fokusOffen: { n: 12, id: null },
  });
  za.log[12].secs = 1800;
  const a = await fall('6a Laden', za, T.sa);
  check((await blick(a)).fokus, '6a Samstag: die Sitzung läuft, Fokusansicht');
  // Um 18:05 kommt das Handy weg – die Uhr hält an, 5 Minuten mehr. Am Sonntag
  // hat es die App beendet, sie lädt neu.
  await a.page.clock.setFixedTime(new Date('2026-10-24T18:05:00+02:00'));
  await a.page.evaluate(() => { window.__hidden = true; document.dispatchEvent(new Event('visibilitychange')); });
  await a.page.waitForTimeout(150);
  await a.page.evaluate(() => { window.__hidden = false; });
  await a.tag(T.so);
  let st = await a.lies();
  check(!st.session && st.log[12].done === 'db' && st.log[12].secs === 35 * 60,
    `6a Sonntag beim Laden: Sitzung beendet, abgeschlossen, gebucht 35 min bis zum Wegschalten (${st.log[12].secs} s)`);
  const so = await blick(a);
  check(!so.fokus && so.zeile.startsWith(`✓ ${satzText}`), `6a Dashboard mit der Zeile, keine Fokusansicht („${so.zeile.slice(0, 60)}…")`);
  check(!/abgeschlossen|Gespeichert/.test(await toastText(a)), '6a ohne Meldung – und ohne Ton (kein trainingBeenden)');
  await ende(a);

  // b) Beim Zurückkommen: die App lag seit Samstag im Hintergrund.
  const zb = samstag({
    session: { n: 12 },
    clock: { n: 12, on: TAG.sa, spent: 0, since: null, halt: ms('2026-10-24T17:30:00+02:00'), gebucht: 0 },
    fokusOffen: { n: 12, id: null },
  });
  const b = await fall('6b Zurück', zb, '2026-10-24T17:30:00+02:00');
  await b.page.clock.setFixedTime(new Date('2026-10-24T17:55:00+02:00'));
  await b.page.locator('.focus-sets .set-btn:not(.on)').first().click();
  await b.page.waitForTimeout(300);
  // Die Pause, die beim Wegschalten noch läuft, gehört zum Training
  // (clockCredit()) – höchstens so lang, wie sie noch offen war.
  const pause = await b.M(({ store }) => {
    const r = store.getState().rest;
    return r ? Math.max(0, Math.floor((r.endsAt - Date.now()) / 1000)) : 0;
  });
  await b.wegUndZurueck(T.so);
  st = await b.lies();
  const uhr = await b.M(({ store }) => store.getState().clock);
  check(!st.session && st.log[12].done === 'db', '6b Sonntag zurück in der App: Sitzung beendet, abgeschlossen');
  check(Math.abs(st.log[12].secs - (25 * 60 + pause)) <= 1 && uhr.since === null,
    `6b gebucht 25 min bis zum Wegschalten und die offene Pause (${pause} s), nicht die Nacht; die Uhr läuft nicht weiter (${st.log[12].secs} s, since ${uhr.since})`);
  const bb = await blick(b);
  check(!bb.fokus && bb.zeile.startsWith('✓ Workout 12 vom Samstag ist abgeschlossen – 5 von 15 Sätzen.'),
    `6b aus der Fokusansicht aufs Dashboard, die Zeile steht („${bb.zeile.slice(0, 70)}…")`);
  await ende(b);

  // c) Hart beendet: Die Uhr lief noch (since Samstag 17:00), letzter Satz 17:45.
  const zc = samstag({
    session: { n: 12 },
    clock: { n: 12, on: TAG.sa, spent: 0, since: ms('2026-10-24T17:00:00+02:00'), gebucht: 0 },
    letzterEintrag: { n: '12', at: ms('2026-10-24T17:45:00+02:00') },
  });
  const c = await fall('6c hart beendet', zc, T.so);
  st = await c.lies();
  check(!st.session && st.log[12].done === 'db' && st.log[12].secs === 45 * 60,
    `6c gebucht bis zum letzten Satz, nicht die Nacht (${st.log[12].secs} s statt 17 h)`);
  await ende(c);
});

/* ------------------------------------------------------------------ *
 * 7: Ein Fehltipp bleibt offen
 * ------------------------------------------------------------------ */
await abschnitt(7, async () => {
  const f = await fall('7 Fehltipp', samstag(), T.sa);
  await f.tag(T.so);
  // Vorgeblättert auf Workout 13 (Montag), ein Satz aus Versehen – der Plan
  // rückt dabei auf Sonntag vor (planVorziehen()).
  await zurListe(f);
  await hake(f, 1);
  let st = await f.lies();
  check(st.log[13].startedOn === TAG.so, `7 ein Satz in Workout 13 am Sonntag (${st.log[13].startedOn})`);
  await f.tag(T.mo);
  st = await f.lies();
  const mo = await blick(f);
  check(!st.log[13].done && !st.tagesabschluss, `7 Montag: Workout 13 bleibt offen, keine Zeile (done ${st.log[13].done})`);
  check(/Gestern angefangen · Workout 13/.test(mo.auge), `7 und steht da als „${mo.auge}"`);
  await ende(f);

  // b) Ein Satz und eine liegen gebliebene Sitzung: Die Sitzung endet, die
  //    Einheit bleibt offen.
  const z = samstag({
    log: { ...fertigBis(12), 13: eintrag(13, 1, TAG.so) },
    session: { n: 13 },
    clock: { n: 13, on: TAG.so, spent: 60000, since: null, halt: ms('2026-10-25T11:00:00+01:00'), gebucht: 60 },
    letzterEintrag: { n: '13', at: ms('2026-10-25T11:00:00+01:00') },
  });
  const g = await fall('7b Fehltipp mit Sitzung', z, T.mo);
  st = await g.lies();
  check(!st.session && !st.log[13].done && !st.tagesabschluss,
    '7b Montag: die liegen gebliebene Sitzung endet, die Einheit mit einem Satz bleibt offen');
  await ende(g);
});

/* ------------------------------------------------------------------ *
 * 8: Nacharbeit mitten in der Woche
 * ------------------------------------------------------------------ */
await abschnitt(8, async () => {
  // b) Workout 10 am Mittwoch mit 3 von 15 – Donnerstag ist frei.
  const zb = { ...GRUND, log: { ...fertigBis(9), 10: eintrag(10, 3) }, letzterEintrag: { n: '10', at: ms('2026-10-21T18:00:00+02:00') } };
  const f = await fall('8b Mitte der Woche', zb, '2026-10-21T18:00:00+02:00');
  await f.tag('2026-10-22T10:00:00+02:00');
  const don = await blick(f);
  console.log(`     Do: ${don.auge} | ${don.sub} | Zeile: ${don.zeile} | frei: ${don.frei}`);
  // „Von den 12 offenen": Nach Samstag bliebe noch etwas für einen Zusatztag –
  // ob der kommt, entscheidet sich erst an seinem Tag (8d), also steht er
  // nicht da, und die Zeile sagt, wovon die Zahlen ein Teil sind.
  const m = don.zeile.match(/Von den 12 offenen Sätzen kommen dazu: morgen \+(\d+), Sa \+(\d+)\./);
  check(don.zeile.startsWith('✓ Workout 10 vom Mittwoch ist abgeschlossen – 3 von 15 Sätzen.') && !!m,
    `8b Donnerstag: „${don.zeile}"`);
  check(don.frei === '', `8b keine zweite Zeile am Ruhetag mit denselben Zahlen („${don.frei}")`);
  await f.tag('2026-10-23T10:00:00+02:00');
  const fr = await nachIn(f, 11);
  check(m && fr === Number(m[1]), `8b Freitag: Workout 11 holt ${fr} nach, angekündigt „morgen +${m && m[1]}"`);
  // Freitag ganz gemacht, wie es dasteht – Samstag zeigt dann, was angesagt war.
  await zurListe(f);
  await f.klick('[data-act="complete-workout"]', 400);
  await f.tag('2026-10-24T10:00:00+02:00');
  const sa = await nachIn(f, 12);
  check(!m || !m[2] || sa === Number(m[2]), `8b Samstag: Workout 12 holt ${sa} nach, angekündigt „Sa +${m && m[2]}"`);
  await ende(f);

  // c) Ein Trainingstag: Workout 10 am Mittwoch mit 3 von 15, die App erst
  //    am Freitag wieder offen – Workout 11 ist heute dran und holt nach.
  const zc = { ...GRUND, log: { ...fertigBis(9), 10: eintrag(10, 3) }, letzterEintrag: { n: '10', at: ms('2026-10-21T18:00:00+02:00') } };
  const g = await fall('8c Trainingstag', zc, '2026-10-21T18:00:00+02:00');
  await g.tag('2026-10-23T10:00:00+02:00');
  const fre = await blick(g);
  console.log(`     Fr: ${fre.auge} | ${fre.sub} | Zeile: ${fre.zeile}`);
  const h = fre.zeile.match(/Von den 12 offenen Sätzen kommen dazu: heute \+(\d+), morgen \+(\d+)\./);
  const plus = await nachIn(g, 11);
  check(fre.zeile.startsWith('✓ Workout 10 vom Mittwoch ist abgeschlossen – 3 von 15 Sätzen.') && !!h && Number(h[1]) === plus && plus > 0,
    `8c Freitag: „${fre.zeile}" – Workout 11 trägt ${plus}`);
  check(/Heute · Workout 11/.test(fre.auge), `8c und Workout 11 steht für heute da (${fre.auge})`);
  await ende(g);

  // d) Workout 11 am Freitag mit 3 von 12, Samstag ist Workout 12 dran. Es
  //    trifft keine der liegen gebliebenen Gruppen (Rücken, Bizeps, hintere
  //    Schulter), heute kommt nichts dazu. Der Rest trüge einen Zusatztag –
  //    aber am Sonntag ruhen die Gruppen von Samstag und Montag, und am Montag
  //    trifft Workout 13 sie selbst: Es kommt keiner. Die Zeile verspricht
  //    deshalb auch keinen. Lieber kein Ziel als ein falsches.
  const zd = { ...GRUND, log: { ...fertigBis(10), 11: eintrag(11, 3) }, letzterEintrag: { n: '11', at: ms('2026-10-23T18:00:00+02:00') } };
  const d = await fall('8d Trainingstag ohne Nacharbeit', zd, '2026-10-23T18:00:00+02:00');
  await d.tag('2026-10-24T10:00:00+02:00');
  const sam = await blick(d);
  const plus12 = await nachIn(d, 12);
  check(/^✓ Workout 11 vom Freitag ist abgeschlossen – 3 von 12 Sätzen\.$/.test(sam.zeile) && plus12 === 0,
    `8d Samstag: kein Ziel – „${sam.zeile}", Workout 12 trägt ${plus12}`);
  await d.M(({ store, P }) => { store.completeWorkout(12, 'db', P.workoutByNo(12, 'db').ex); store.flush(); });
  const kommt = [];
  for (const wann of ['2026-10-25T10:00:00+01:00', '2026-10-26T10:00:00+01:00']) {
    await d.tag(wann);
    kommt.push(await d.M(({ store, P }) => store.customs().filter((c) => /^Zusatztag/.test(c.name)).length
      + P.workoutByNo(13).ex.filter((x) => x.zusatz).length));
  }
  check(kommt.every((k) => k === 0), `8d und wirklich: weder am Sonntag noch am Montag ein Zusatztag (${kommt.join(', ')})`);
  await ende(d);

  // e) Workout 8 am Samstag 17.10. mit 4 von 15: Am Sonntag steht der
  //    Zusatztag der Woche 2 allein da – und die Zeile sagt es. Wer dann
  //    doch an Workout 8 weitermacht (zurück zum Plan, zu ihr blättern, „Doch
  //    noch weitermachen"), hat heute trainiert: Der Zusatztag kommt
  //    frühestens morgen, statt nach dem Rest auch noch für heute dazustehen.
  const ze = { ...GRUND, log: { ...fertigBis(7), 8: eintrag(8, 4) }, letzterEintrag: { n: '8', at: ms('2026-10-17T18:00:00+02:00') } };
  const z8 = await fall('8e Zusatztag allein', ze, '2026-10-17T18:00:00+02:00');
  await z8.tag('2026-10-18T10:00:00+02:00');
  const so8 = await blick(z8);
  console.log(`     So 18.10.: ${so8.auge} | ${so8.zeile}`);
  check(/Heute · Zusatztag/.test(so8.auge)
    && so8.zeile.startsWith('✓ Workout 8 vom Samstag ist abgeschlossen – 4 von 15 Sätzen. Zum Nachholen steht heute ein Zusatztag bereit.'),
  `8e Sonntag: „${so8.auge}" – „${so8.zeile}"`);
  const k8 = await dochWeiter(z8, 8);
  check(/Workout 8/.test(k8.auge) && k8.kopf === '✓ Abgeschlossen' && (await blick(z8)).fokus,
    `8e zurück zum Plan, zu Workout 8 geblättert („${k8.auge}", „${k8.kopf}"), „Doch noch weitermachen"`);
  // Ein Satz in der Übung, die am Samstag schon dran war – so ruht heute
  // keine Gruppe mehr als vorher, und der Zusatztag bleibt möglich. Die Frage
  // ist allein, ob er nach dem Rest noch für heute dasteht.
  await zurListe(z8);
  await z8.klick(`[data-act="toggle-set"][data-ex="${PLAN[7].ex[1].id}"][aria-pressed="false"]`, 300);
  if (await z8.page.locator('[data-act="focus-list"]').count()) await z8.klick('[data-act="focus-list"]', 150);
  for (let k = 0; k < 3 && await z8.page.locator('.focus-cue').count(); k++) {
    await z8.page.goBack();
    await z8.page.waitForTimeout(250);
  }
  if (await z8.page.locator('[data-act="finish-session"]').count()) await z8.klick('[data-act="finish-session"]', 400);
  await z8.tag('2026-10-18T15:00:00+02:00');
  const nach8 = await blick(z8);
  const traeger8 = await z8.M(({ store }) => store.customs().filter((c) => c.name === 'Zusatztag Woche 2' && !store.isStarted(c.id)).length);
  check(traeger8 === 1 && !/Heute · Zusatztag/.test(nach8.auge),
    `8e nach dem Rest am Sonntag: der Zusatztag wartet auf morgen („${nach8.auge}", Träger ${traeger8})`);
  await ende(z8);

  // f) Tobis Woche, wie auf seinem Bild: In Workout 9 fehlen zwei Sätze (Floor
  //    Press, hängendes Knieheben), Workout 12 trägt sie als Nacharbeit –
  //    „5 Übungen · 17 Sätze". Am Samstag um 17:00 gestartet, 4 Sätze, um
  //    17:20 weg. Was der Zusatztag am Montag bringt, stammt dann nicht allein
  //    aus Workout 12 – die Zeile sagt deshalb nicht „von den 13 offenen",
  //    sondern „aus Woche 3" (bis zur Nachbesserung von v244 „von dem, was in
  //    Woche 3 liegen blieb" – bei 360×740 vier Zeilen, in der letzten nur
  //    „rein.").
  const neun = eintrag(9);
  const fehlen = ['floor-press', 'haengendes-knieheben'].filter((id) => neun.db[id]);
  fehlen.forEach((id) => { neun.db[id][neun.db[id].length - 1].done = false; });
  check(fehlen.length === 2, `8f Workout 9 hat Floor Press und hängendes Knieheben (${fehlen.join(', ')})`);
  const tw = await fall('8f Tobis Woche', { ...GRUND, log: { ...fertigBis(11), 9: neun } }, '2026-10-24T17:00:00+02:00');
  const sa17 = await blick(tw);
  check(/Heute · Workout 12/.test(sa17.auge) && /5 Übungen · 17 Sätze/.test(sa17.sub),
    `8f Samstag 17:00: „${sa17.auge} · ${sa17.sub}"`);
  await tw.klick('[data-act="start-session"]', 400);
  for (let i = 0; i < 4; i++) {
    await tw.page.clock.setFixedTime(new Date(ms('2026-10-24T17:02:00+02:00') + i * 4 * 60000));
    await tw.page.locator('.focus-sets .set-btn:not(.on)').first().click();
    await tw.page.waitForTimeout(250);
  }
  await tw.page.clock.setFixedTime(new Date('2026-10-24T17:20:00+02:00'));
  await tw.page.evaluate(() => { window.__hidden = true; document.dispatchEvent(new Event('visibilitychange')); });
  await tw.page.waitForTimeout(150);
  await tw.page.evaluate(() => { window.__hidden = false; });
  await tw.tag('2026-10-25T09:30:00+01:00');
  const so17 = await blick(tw);
  console.log(`     So (Tobis Woche): ${so17.auge} | ${so17.zeile}`);
  const m17 = so17.zeile.match(/^✓ Workout 12 vom Samstag ist abgeschlossen – 4 von 17 Sätzen\. Aus Woche 3 kommen morgen (\d+) Sätze in Workout 13 mit rein\.$/);
  check(!!m17, `8f Sonntag: „${so17.zeile}"`);
  // Gemessen wie in 2, mit Tobis Satz: höchstens drei Zeilen, und in der
  // letzten nie ein Wort allein – die Seite bleibt eine Seite. Und zu Workout
  // 12 geblättert, steht die Zeile nicht über ihrer eigenen Karte: Dort schob
  // sich die Seite bei 360×740 um 41 px (18).
  for (const [b, h] of [[414, 896], [360, 740]]) {
    await tw.page.setViewportSize({ width: b, height: h });
    await tw.page.reload({ waitUntil: 'networkidle' });
    await tw.page.waitForTimeout(300);
    const m = await seiteMessen(tw);
    const letzte = m.zeilen[m.zeilen.length - 1] || '';
    check(m.zeilen.length >= 2 && m.zeilen.length <= 3 && letzte.split(' ').length >= 2
      && m.scroll <= 0 && m.fussUnten <= m.sichtbar,
    `8f Sonntag ${b}×${h}: die Zeile in ${m.zeilen.length} Zeilen (${m.hoehe} px), zuletzt „${letzte}" – eine Seite (Überhang ${m.scroll}, Fuß ${m.fussUnten} / ${m.sichtbar})`);
    await tw.klick('[data-act="nav-workout"][data-delta="-1"]', 250);
    const k12 = await blick(tw);
    const k = await seiteMessen(tw);
    check(/Gestern · Workout 12/.test(k12.auge) && k12.zeilen === 0 && k.scroll <= 0 && k.fussUnten <= k.sichtbar,
      `8f Sonntag ${b}×${h}, zu Workout 12 geblättert: keine Zeile über ihrer Karte, eine Seite (Überhang ${k.scroll}, Fuß ${k.fussUnten} / ${k.sichtbar})`);
  }
  await tw.page.setViewportSize({ width: 414, height: 896 });
  await tw.tag(T.mo);
  const z17 = await zusatzIn(tw, 13, 3);
  check(!!m17 && z17 === Number(m17[1]), `8f Montag: Workout 13 trägt ${z17} Sätze aus Woche 3, angekündigt ${m17 && m17[1]}`);
  await ende(tw);
});

/* ------------------------------------------------------------------ *
 * 9: Sicherung und Import
 * ------------------------------------------------------------------ */
await abschnitt(9, async () => {
  const f = await fall('9 Sicherung', samstag(), T.sa);
  await f.tag(T.so);
  const json = await f.M(({ store }) => store.exportJSON());
  const roh = JSON.parse(json);
  // Der letzte Eintrag steht seit v242 je Einheit (`zuletzt`); der Stand von
  // samstag() hat noch den einen Platz von v241 und zieht beim Laden um.
  check(!!roh.tagesabschluss && roh.tagesabschluss.einheiten[0].n === 12
    && roh.log[12].zuletzt === ms(T.sa) && !('letzterEintrag' in roh),
    `9 die Sicherung trägt das Feld und den letzten Eintrag in der Einheit (${JSON.stringify(roh.tagesabschluss)}, zuletzt ${roh.log[12].zuletzt}, alt ${'letzterEintrag' in roh})`);
  await ende(f);

  // In ein frisches Gerät eingelesen: dieselbe Zeile.
  const g = await fall('9 Import', { greeted: true, focus: 'cut' }, T.so);
  await g.M(({ store }, text) => store.importJSON(text), json);
  await g.tag('2026-10-25T10:05:00+01:00');
  const z = await blick(g);
  check(z.zeile.startsWith(`✓ ${satzText}`), `9 nach dem Import steht die Zeile wieder da („${z.zeile.slice(0, 60)}…")`);

  // Aus fremder Hand: Unsinn fällt weg, HTML kommt nicht in die Seite.
  const boese = JSON.parse(json);
  boese.tagesabschluss = {
    am: TAG.so,
    einheiten: [
      { n: '<img src=x onerror="window.__xss=1">', tag: TAG.sa, done: 4, total: 15 },
      { n: 12, tag: TAG.sa, done: 99, total: 15 },
      { n: 12, tag: '<b>', done: 4, total: 15 },
      { n: 12, tag: TAG.sa, done: 4, total: 15, name: '<img src=x onerror="window.__xss=2">' },
    ],
  };
  await g.M(({ store }, text) => store.importJSON(text), JSON.stringify(boese));
  const gelesen = await g.M(({ store }) => [store.tagesabschluss(), store.getState().tagesabschluss]);
  check(JSON.stringify(gelesen[1]) === JSON.stringify({ am: TAG.so, einheiten: [{ n: 12, tag: TAG.sa, done: 4, total: 15 }] }),
    `9 beim Import geprüft: nur der eine gültige Eintrag, ohne Zusatzfeld (${JSON.stringify(gelesen[1])})`);
  await g.tag('2026-10-25T10:10:00+01:00');
  const html = await g.page.evaluate(() => ({ xss: window.__xss || 0, img: document.querySelectorAll('.notice.abschluss img').length }));
  check(html.xss === 0 && html.img === 0, '9 nichts davon landet als HTML in der Seite');
  boese.tagesabschluss = '<script>window.__xss=3</script>';
  boese.letzterEintrag = 'kaputt';
  await g.M(({ store }, text) => store.importJSON(text), JSON.stringify(boese));
  const leer = await g.M(({ store }) => [store.getState().tagesabschluss, 'letzterEintrag' in store.getState()]);
  check(leer[0] === null && leer[1] === false, `9 eine Zeichenkette statt des Felds: weg (${JSON.stringify(leer)})`);

  // Eine Sicherung von v241: Ihr `letzterEintrag` zieht in seine Einheit um.
  const alt = JSON.parse(json);
  delete alt.log[12].zuletzt;
  alt.letzterEintrag = { n: '12', at: ms(T.sa2350) };
  await g.M(({ store }, text) => store.importJSON(text), JSON.stringify(alt));
  const um = await g.M(({ store }) => [store.getState().log[12].zuletzt, 'letzterEintrag' in store.getState()]);
  check(um[0] === ms(T.sa2350) && um[1] === false,
    `9 eine Sicherung von v241: der letzte Eintrag steht danach in Workout 12 (${um[0]}, altes Feld ${um[1]})`);
  await ende(g);

  // Ein Lebenszeichen aus der Zukunft (falsch gehende Uhr am anderen Gerät)
  // hält Workout 12 nicht offen.
  const zz = samstag({ letzterEintrag: { n: '12', at: ms('2026-11-30T12:00:00+01:00') } });
  const h = await fall('9 Zukunft', zz, T.so);
  check((await h.lies()).log[12].done === 'db', '9 ein Lebenszeichen aus der Zukunft zählt nicht – abgeschlossen');
  await ende(h);
});

/* ------------------------------------------------------------------ *
 * 10: Über die Zeitumstellung
 * ------------------------------------------------------------------ */
await abschnitt(10, async () => {
  // Training über Mitternacht in die Nacht der Umstellung: letzter Satz um
  // 0:30 MESZ (22:30 UTC). Um 2:20 MEZ (1:20 UTC) sind 2 h 50 vergangen –
  // offen. Um 2:40 MEZ 3 h 10 – auf der Wanduhr erst 2 h 10. Gezählt wird echt.
  const z = samstag({
    log: { ...fertigBis(11), 12: eintrag(12, 6) },
    letzterEintrag: { n: '12', at: ms('2026-10-25T00:30:00+02:00') },
  });
  const f = await fall('10 Umstellung', z, '2026-10-25T02:20:00+01:00');
  check(!(await f.lies()).log[12].done, '10 um 2:20 MEZ (2 h 50 nach dem letzten Satz): offen');
  await f.tag('2026-10-25T02:40:00+01:00');
  const st = await f.lies();
  check(st.log[12].done === 'db' && st.tagesabschluss && st.tagesabschluss.am === TAG.so,
    `10 um 2:40 MEZ (3 h 10, Wanduhr 2 h 10): abgeschlossen, am ${st.tagesabschluss && st.tagesabschluss.am}`);
  const z10 = await blick(f);
  check(z10.zeile.startsWith('✓ Workout 12 vom Samstag ist abgeschlossen – 6 von 15 Sätzen.'), `10 die Zeile: „${z10.zeile.slice(0, 64)}…"`);
  await ende(f);

  // Die Uhr bei offener App über den 25-Stunden-Tag: Workout 13 am Sonntag
  // um 9:55 mit 3 Sätzen angefangen, die App bleibt offen. Um 23:30 MEZ ist
  // noch Sonntag – offen; um 0:00:30 am Montag hat die Uhr nachgesehen.
  const zu = {
    ...GRUND, shift: SHIFT - 1,
    log: { ...fertigBis(12), 13: eintrag(13, 3, TAG.so) },
    letzterEintrag: { n: '13', at: ms('2026-10-25T09:55:00+01:00') },
  };
  const g = await fall('10 Uhr', zu, '2026-10-25T10:00:00+01:00', { laufend: true });
  await g.page.clock.fastForward(ms('2026-10-25T23:30:00+01:00') - ms('2026-10-25T10:00:00+01:00'));
  await g.page.waitForTimeout(200);
  check(!(await g.M(({ store }) => store.getState().log[13].done)), '10 Sonntag 23:30 MEZ, App offen: noch offen');
  await g.page.clock.fastForward(ms('2026-10-26T00:00:30+01:00') - ms('2026-10-25T23:30:00+01:00'));
  await g.page.waitForTimeout(400);
  const nachts = await g.M(({ store }) => ({ done: store.getState().log[13].done, z: store.getState().tagesabschluss }));
  const zeile = await g.txt('.notice.abschluss');
  check(nachts.done === 'db' && zeile.startsWith('✓ Workout 13 vom Sonntag ist abgeschlossen – 3 von 15 Sätzen.'),
    `10 Montag 0:00:30, ohne Neuladen: abgeschlossen, die Zeile steht („${zeile.slice(0, 64)}")`);
  await ende(g);
});

/* ------------------------------------------------------------------ *
 * 11: „Doch noch weitermachen" – und doch nicht
 * ------------------------------------------------------------------ */
await abschnitt(11, async () => {
  // In der Sitzung stand „Abbrechen | ✓ Abschließen (4/15)". „Abbrechen"
  // verwirft eine Einheit ganz (store.verwirfEinheit()) – hier die 4 Sätze vom
  // Samstag. Danach war Workout 12 untrainiert, der Plan rückte einen Tag, und
  // am Sonntag stand „Heute · Workout 12" da: Tobis Bild, nur ohne Samstag.
  // Gefunden über „Rest heute machen" (bis v242); derselbe Weg ist jetzt das
  // Blättern und „Doch noch weitermachen".
  const f = await fall('11 doch nicht', samstag(), T.sa);
  await f.tag(T.so);
  await dochWeiter(f);
  const knoepfe = await f.page.evaluate(() => [...document.querySelectorAll('#view [data-act="discard-session"], #view [data-act="finish-session"]')]
    .map((b) => b.textContent.replace(/\s+/g, ' ').trim()));
  check((await blick(f)).fokus && knoepfe.length === 1 && /Abschließen \(4\/15\)/.test(knoepfe[0]),
    `11 in der Sitzung auf der abgeschlossenen Einheit kein „Abbrechen", nur „Abschließen" (${knoepfe.join(' | ')})`);
  // Ein „Abbrechen" von früher (ein stehen gebliebener Knopf) löscht auch nichts.
  await f.page.evaluate(() => document.getElementById('view')
    .insertAdjacentHTML('afterbegin', '<button type="button" id="altAbbrechen" data-act="discard-session">Abbrechen</button>'));
  await f.klick('#altAbbrechen', 400);
  let st = await f.lies();
  const satz = (e) => Object.values(e.db || {}).reduce((a, arr) => a + arr.filter((x) => x && x.done).length, 0);
  check(!st.session && st.log[12].done === 'db' && st.log[12].startedOn === TAG.sa && satz(st.log[12]) === 4,
    `11 auch so: Sitzung zu, Workout 12 bleibt abgeschlossen am Samstag mit 4 Sätzen (${st.log[12].done}, ${st.log[12].startedOn}, ${satz(st.log[12])})`);
  await f.tag('2026-10-25T10:05:00+01:00');
  st = await f.lies();
  const tage = await f.M(({ P, D }) => [P.effDate(D.PLAN[11]), P.effDate(D.PLAN[12])]);
  const so = await blick(f);
  check(st.shift === SHIFT && tage[0] === TAG.sa && tage[1] === TAG.mo && /Morgen · Workout 13/.test(so.auge),
    `11 neu geladen: der Plan bleibt (shift ${st.shift}, ${tage.join(', ')}), „${so.auge}"`);

  // Und „Abschließen" ohne neuen Satz lässt den Samstag, wie er war.
  const g = await fall('11 Abschließen', samstag(), T.sa);
  await g.tag(T.so);
  await dochWeiter(g);
  await g.klick('[data-act="finish-session"]', 400);
  st = await g.lies();
  check(!st.session && st.log[12].done === 'db' && st.log[12].startedOn === TAG.sa && satz(st.log[12]) === 4
    && st.log[12].weiterAm === undefined,
  '11 „Abschließen" ohne neuen Satz: Workout 12 wie am Samstag, der Sonntag kein Trainingstag');
  // Und dann heißt sie weiter, was sie ist – nichts von heute.
  const kg = await blick(g);
  check(kg.kopf === '✓ Abgeschlossen' && /Gestern · Workout 12/.test(kg.auge),
    `11 danach: „${kg.auge}" über „${kg.kopf}"`);
  await ende(f);
  await ende(g);
});

/* ------------------------------------------------------------------ *
 * 12: Der Kopf beim Rest von heute
 * ------------------------------------------------------------------ */
await abschnitt(12, async () => {
  // „Rest heute machen" (bis v242; jetzt „Doch noch weitermachen"), ein Satz,
  // zurück aufs Dashboard: Dort stand „Tobi · Gestern · Workout 12 / Sa, 24.
  // Oktober 2026" über dem Training von heute – und nach „Für heute durch"
  // ebenso. Genau das ließ Tobi fragen.
  const f = await fall('12 Kopf', samstag(), T.sa);
  await f.tag(T.so);
  await dochWeiter(f);
  await f.page.locator('.focus-sets .set-btn:not(.on)').first().click();
  await f.page.waitForTimeout(300);
  await zurueck(f);
  const lauf = await blick(f);
  check(/Gestern angefangen · Workout 12/.test(lauf.auge) && /Sa, 24\. Oktober/.test(lauf.titel),
    `12 während der Sitzung: „${lauf.auge} / ${lauf.titel}"`);
  await f.klick('[data-act="finish-session"]', 400);
  const fertig = await blick(f);
  const durch = await f.txt('.fertig-kopf');
  check(/Gestern angefangen · Workout 12/.test(fertig.auge) && /Für heute durch/.test(durch),
    `12 nach dem Abschließen: „${fertig.auge}" über „${durch}"`);
  // Eine abgeschlossene Einheit von gestern, an der heute nichts passiert ist,
  // heißt weiter „Gestern" – und ihre Karte „Abgeschlossen", nicht mehr „Für
  // heute durch": Der Rest war gestern.
  await f.tag('2026-10-26T17:00:00+01:00');
  await f.klick('[data-act="nav-workout"][data-delta="-1"]', 250);
  const mo = await blick(f);
  check(/vor 2 Tagen · Workout 12/.test(mo.auge) && !/angefangen/.test(mo.auge) && mo.kopf === '✓ Abgeschlossen',
    `12 am Montag zurückgeblättert: „${mo.auge}" über „${mo.kopf}"`);
  await ende(f);
});

/* ------------------------------------------------------------------ *
 * 13: Eine Sitzung von heute endet nicht am selben Tag
 * ------------------------------------------------------------------ */
await abschnitt(13, async () => {
  // a) „Doch noch weitermachen" um 10:00 (bis v242 „Rest heute machen"), ein
  //    Satz, um 10:05 zum Mittagessen weg, um 13:30 zurück: Die Sitzung läuft
  //    weiter wie jede andere von heute. Vorher galt als ihr Tag der Samstag
  //    (startedOn der Einheit), und sie war still beendet – Fokusansicht weg,
  //    kein Wort.
  const f = await fall('13a Mittag', samstag(), T.sa);
  await f.tag(T.so);
  await dochWeiter(f);
  await f.page.locator('.focus-sets .set-btn:not(.on)').first().click();
  await f.page.waitForTimeout(300);
  await f.page.clock.setFixedTime(new Date('2026-10-25T10:05:00+01:00'));
  await f.wegUndZurueck('2026-10-25T13:30:00+01:00');
  let lauf = await f.M(({ store }) => store.getState().session);
  check(!!lauf && lauf.n === 12 && (await blick(f)).fokus, `13a um 13:30 zurück: Sitzung läuft, Fokusansicht (${JSON.stringify(lauf)})`);
  // Am Montag liegt sie seit gestern – dann endet sie.
  await f.wegUndZurueck('2026-10-26T17:00:00+01:00');
  lauf = await f.M(({ store }) => store.getState().session);
  check(lauf === null && (await f.lies()).log[12].done === 'db', '13a am Montag: die Sitzung von gestern endet, Workout 12 bleibt abgeschlossen');
  await ende(f);

  // b) Dasselbe bei offener App: Die Uhr, die nachsieht (tagesUhrStellen()),
  //    beendet sie drei Stunden nach dem Satz nicht. Kurz weg und wieder da,
  //    damit die Uhr neu gestellt ist – mit der Sitzung, die jetzt läuft.
  const h = await fall('13b Mittag, App offen', samstag(), T.so, { laufend: true });
  await dochWeiter(h);
  await h.page.locator('.focus-sets .set-btn:not(.on)').first().click();
  await h.page.waitForTimeout(300);
  await h.page.evaluate(() => { window.__hidden = true; document.dispatchEvent(new Event('visibilitychange')); });
  await h.page.waitForTimeout(150);
  await h.page.evaluate(() => { window.__hidden = false; document.dispatchEvent(new Event('visibilitychange')); });
  await h.page.waitForTimeout(300);
  await h.page.clock.fastForward(3.5 * 3600 * 1000);
  await h.page.waitForTimeout(400);
  lauf = await h.M(({ store }) => store.getState().session);
  check(!!lauf && lauf.n === 12, `13b App offen bis 13:30: Sitzung läuft (${JSON.stringify(lauf)})`);
  await ende(h);

  // c) Workout 12 am Samstag bis 23:50, am Sonntag um 0:10 „Training
  //    fortsetzen" – eine Sitzung von Sonntag auf der Einheit vom Samstag. Um
  //    0:20 weg, um 4:00 zurück: Sie läuft, und ihre Einheit bleibt offen. Am
  //    Montag liegt die Sitzung seit gestern: Sie endet, und die Einheit
  //    schließt ab – beides zusammen, nie eine Sitzung auf einer
  //    abgeschlossenen Einheit.
  const zc = samstag({ letzterEintrag: { n: '12', at: ms(T.sa2350) } });
  const c = await fall('13c Sonntag fortgesetzt', zc, '2026-10-25T00:10:00+02:00');
  check(!(await c.lies()).log[12].done, '13c Sonntag 0:10: Workout 12 noch offen (20 Minuten seit dem letzten Satz)');
  await c.klick('[data-act="start-session"]', 400);
  await c.page.clock.setFixedTime(new Date('2026-10-25T00:20:00+02:00'));
  await c.wegUndZurueck('2026-10-25T04:00:00+01:00');
  let s = await c.M(({ store }) => ({ s: store.getState().session, d: store.getState().log[12].done }));
  check(!!s.s && s.s.n === 12 && !s.d, `13c um 4:00 zurück: Sitzung läuft, Workout 12 offen (${JSON.stringify(s)})`);
  await c.wegUndZurueck(T.mo);
  s = await c.M(({ store }) => ({ s: store.getState().session, d: store.getState().log[12].done }));
  const zm = await blick(c);
  check(s.s === null && s.d === 'db' && zm.zeile.startsWith(`✓ ${satzText}`),
    `13c Montag: Sitzung beendet und abgeschlossen, die Zeile steht (${JSON.stringify(s)}, „${zm.zeile.slice(0, 60)}")`);
  await ende(c);
});

/* ------------------------------------------------------------------ *
 * 14: Nach einem Start mit Planumbau
 * ------------------------------------------------------------------ */
await abschnitt(14, async () => {
  // Die Reparatur nach einem Planwechsel kommt erst beim nächsten Start
  // (planWechsel() || festReparieren()), also wartet der Abschluss an diesem
  // Tag. Das galt aber für die ganze Lebensdauer der Seite: Blieb die App im
  // Speicher, stand am Montag und am Mittwoch noch „vor 2 / vor 4 Tagen
  // angefangen · Workout 12".
  const f = await fall('14 Planumbau', samstag({ planStand: { cut: 'aaaaaaaaaaaa' } }), T.so);
  let st = await f.lies();
  check(!!st.planUmbau && !st.log[12].done, `14 Sonntag mit Planumbau: Workout 12 wartet noch (planUmbau ${!!st.planUmbau})`);
  await f.wegUndZurueck(T.mo);
  st = await f.lies();
  const mo = await blick(f);
  check(st.log[12].done === 'db' && mo.zeile.startsWith(`✓ ${satzText}`) && /Workout 13/.test(mo.auge),
    `14 Montag ohne Neuladen: abgeschlossen, die Zeile steht („${mo.auge}", „${mo.zeile.slice(0, 50)}")`);
  await ende(f);
});

/* ------------------------------------------------------------------ *
 * 15: Über Nacht offen, und die Uhr kam nicht dran
 * ------------------------------------------------------------------ */
await abschnitt(15, async () => {
  // Workout 12 läuft, der letzte Satz um 18:45, die App bleibt sichtbar – der
  // Rechner oder das Tablet schläft, kein Timer, kein Wegschalten. Am Sonntag
  // um 8:00 wird neu geladen, weggeschaltet oder auf „Abschließen" getippt.
  // Gebucht wurde dabei die ganze Nacht (14 h), und die Einheit blieb offen:
  // Das Anhalten der Uhr galt als frisches Lebenszeichen.
  for (const art of ['Neuladen', 'Wegschalten', 'Abschließen']) {
    const z = samstag({
      session: { n: 12 },
      clock: { n: 12, on: TAG.sa, spent: 0, since: ms('2026-10-24T18:00:00+02:00'), gebucht: 0 },
      letzterEintrag: { n: '12', at: ms('2026-10-24T18:45:00+02:00') },
      fokusOffen: { n: 12, id: null },
    });
    const f = await fall(`15 ${art}`, z, '2026-10-24T18:46:00+02:00');
    await f.page.clock.setFixedTime(new Date('2026-10-25T08:00:00+01:00'));
    if (art === 'Neuladen') {
      await f.page.reload({ waitUntil: 'networkidle' });
      await f.page.waitForTimeout(300);
    } else if (art === 'Wegschalten') {
      await f.page.evaluate(() => { window.__hidden = true; document.dispatchEvent(new Event('visibilitychange')); });
      await f.page.waitForTimeout(150);
      await f.page.evaluate(() => { window.__hidden = false; document.dispatchEvent(new Event('visibilitychange')); });
      await f.page.waitForTimeout(350);
    } else {
      await f.klick('[data-act="finish-session"]', 400);
    }
    const st = await f.lies();
    const secs = st.log[12].secs || 0;
    check(secs <= 120, `15 ${art}: die Nacht ist nicht gebucht (${secs} s)`);
    if (art !== 'Abschließen') {
      const b = await blick(f);
      check(!st.session && st.log[12].done === 'db' && b.zeile.startsWith(`✓ ${satzText}`),
        `15 ${art}: Sitzung beendet, abgeschlossen, die Zeile steht (${JSON.stringify(st.session)}, ${st.log[12].done})`);
    }
    await ende(f);
  }
});

/* ------------------------------------------------------------------ *
 * 16: Stunden Stille bei offener App, dann zuerst ein Satz
 * ------------------------------------------------------------------ */
await abschnitt(16, async () => {
  // Der Deckel aus 15 sah nur beim Anhalten nach, wie lange die Stille her
  // ist. Tablet, App sichtbar: Start 10:00, ein Satz um 10:45, dann 3 h 45
  // weg. Um 14:30 der nächste Satz – damit war das Lebenszeichen frisch –, um
  // 14:45 „Abschließen": gebucht 4 h 45 statt einer Stunde. Wer zuerst auf
  // „Abschließen" tippte, bekam 45 Minuten. Jetzt bemerkt schon der Satz die
  // Stille: Die Uhr bucht bis 10:45 und läuft ab 14:30 weiter.
  for (const art of ['Abschließen', 'letzter Satz']) {
    const z = samstag({
      session: { n: 12 },
      clock: { n: 12, on: TAG.sa, spent: 0, since: ms('2026-10-24T10:00:00+02:00'), gebucht: 0 },
      letzterEintrag: null,
      fokusOffen: { n: 12, id: null },
    });
    // „letzter Satz": bis auf einen alles abgehakt – der Satz um 14:30 beendet
    // die Einheit selbst (einheitBeenden() wie beim Knopf).
    if (art === 'letzter Satz') {
      z.log[12] = eintrag(12, 13);
    }
    const f = await fall(`16 ${art}`, z, '2026-10-24T10:00:00+02:00');
    check((await blick(f)).fokus, `16 ${art}: Samstag 10:00, die Sitzung läuft, Fokusansicht`);
    await f.page.clock.setFixedTime(new Date('2026-10-24T10:45:00+02:00'));
    await f.page.locator('.focus-sets .set-btn:not(.on)').first().click();
    await f.page.waitForTimeout(300);
    await f.page.clock.setFixedTime(new Date('2026-10-24T14:30:00+02:00'));
    await f.page.waitForTimeout(400);
    await f.page.locator('.focus-sets .set-btn:not(.on)').first().click();
    await f.page.waitForTimeout(300);
    if (art === 'Abschließen') {
      // Die Sitzung läuft weiter, die Uhr ab dem Satz: 45 min gezählt, seit 14:30.
      const mitten = await f.lies();
      check(!!mitten.session && mitten.clock.spent === 45 * 60000 && mitten.clock.since === ms('2026-10-24T14:30:00+02:00'),
        `16 ${art}: um 14:30 läuft die Sitzung weiter, die Uhr ab dem Satz (gezählt ${mitten.clock.spent / 60000} min, seit ${new Date(mitten.clock.since).toISOString()})`);
      await f.page.clock.setFixedTime(new Date('2026-10-24T14:45:00+02:00'));
      await f.klick('[data-act="finish-session"]', 400);
    }
    const st = await f.lies();
    const soll = art === 'Abschließen' ? 60 * 60 : 45 * 60;
    check(!st.session && st.log[12].done === 'db' && Math.abs((st.log[12].secs || 0) - soll) <= 2,
      `16 ${art}: gebucht ${soll / 60} min, nicht die Stille (${st.log[12].secs} s${st.log[12].secs > 3 * 3600 ? ' – mit den 3 h 45' : ''})`);
    await ende(f);
  }
});

/* ------------------------------------------------------------------ *
 * 17: Ein Eintrag in einer anderen Einheit
 * ------------------------------------------------------------------ */
await abschnitt(17, async () => {
  // Das Lebenszeichen hatte einen Platz für alle Einheiten (letzterEintrag),
  // und jeder Eintrag überschrieb ihn – auch ein Fehltipp in einer anderen.
  //
  // a) Ohne Sitzung: Samstag 23:50 ein Satz in Workout 12, um 23:55 in
  //    Workout 13 vorgeblättert, ein Satz an und gleich wieder ab. Um 0:00:30
  //    (Neuladen, wie das Zurückkommen) war Workout 12 abgeschlossen – zehn
  //    Minuten nach dem letzten Satz statt drei Stunden.
  const f = await fall('17a Fehltipp nebenan', samstag(), '2026-10-24T23:40:00+02:00');
  await f.page.clock.setFixedTime(new Date(T.sa2350));
  await zurListe(f);
  await hake(f, 1);
  await f.klick('[data-act="hide-list"]', 200).catch(() => {});
  await f.page.clock.setFixedTime(new Date('2026-10-24T23:55:00+02:00'));
  await f.klick('[data-act="nav-workout"][data-delta="1"]', 250);
  await zurListe(f);
  await hake(f, 1);
  await f.klick('[data-act="toggle-set"][aria-pressed="true"]', 250);
  let st = await f.lies();
  check(!(st.log[13] && st.log[13].startedOn) && st.log[12].startedOn === TAG.sa,
    `17a Samstag 23:55: Workout 13 an und wieder ab – nicht angefangen (${st.log[13] && st.log[13].startedOn})`);
  await f.tag('2026-10-25T00:00:30+02:00');
  st = await f.lies();
  check(!st.log[12].done && !st.tagesabschluss,
    `17a Sonntag 0:00:30, zehn Minuten nach dem letzten Satz in Workout 12: offen, keine Zeile (done ${st.log[12].done})`);
  await f.tag('2026-10-25T01:45:00+02:00');
  st = await f.lies();
  check(!st.log[12].done, `17a um 1:45, knapp zwei Stunden danach: noch offen (done ${st.log[12].done})`);
  // 2:55 MESZ – die Nacht der Zeitumstellung, die Uhr springt erst um 3:00 zurück.
  await f.tag('2026-10-25T02:55:00+02:00');
  st = await f.lies();
  check(st.log[12].done === 'db' && !!st.tagesabschluss,
    `17a um 2:55, gut drei Stunden nach dem letzten Satz: abgeschlossen, wie sonst (done ${st.log[12].done})`);
  await ende(f);

  // b) In einer Sitzung: Workout 12 läuft, um 23:40 ein Satz, um 23:45 in
  //    Workout 13 an und ab, um 0:05 wieder ein Satz in Workout 12. Der Sonntag
  //    galt dann als zweiter Trainingstag (weiterAm) – kein Zusatztag mehr für
  //    heute, keine Zeile „Heute frei".
  const z = samstag({
    session: { n: 12 },
    clock: { n: 12, on: TAG.sa, spent: 30 * 60000, since: null, halt: ms('2026-10-24T23:30:00+02:00'), gebucht: 1800 },
    letzterEintrag: { n: '12', at: ms('2026-10-24T23:30:00+02:00') },
    fokusOffen: { n: 12, id: null },
  });
  z.log[12].secs = 1800;
  const g = await fall('17b Sitzung, Fehltipp nebenan', z, '2026-10-24T23:35:00+02:00');
  await g.page.clock.setFixedTime(new Date('2026-10-24T23:40:00+02:00'));
  await g.page.locator('.focus-sets .set-btn:not(.on)').first().click();
  await g.page.waitForTimeout(300);
  await g.page.clock.setFixedTime(new Date('2026-10-24T23:45:00+02:00'));
  for (let k = 0; k < 3 && await g.page.locator('.focus-cue').count(); k++) {
    await g.page.goBack();
    await g.page.waitForTimeout(250);
  }
  await g.klick('[data-act="nav-workout"][data-delta="1"]', 250);
  await zurListe(g);
  await hake(g, 1);
  await g.klick('[data-act="toggle-set"][aria-pressed="true"]', 250);
  await g.klick('[data-act="hide-list"]', 200).catch(() => {});
  await g.klick('[data-act="nav-workout"][data-delta="-1"]', 250);
  await g.page.clock.setFixedTime(new Date('2026-10-25T00:05:00+02:00'));
  await zurListe(g);
  await hake(g, 1);
  st = await g.lies();
  const heute = await g.M(({ store }, iso) => store.trainiertAm(12, iso), TAG.so);
  check(!!st.session && st.session.n === 12 && st.log[12].weiterAm === undefined && !heute,
    `17b Sonntag 0:05, weiter in Workout 12: kein zweiter Trainingstag (Sitzung ${JSON.stringify(st.session)}, weiterAm ${st.log[12].weiterAm})`);
  await ende(g);

  // c) Aus fremder Hand: ein Eintrag aus der Zukunft oder Unsinn in der
  //    Einheit hält sie nicht offen (wie 9 für das alte Feld).
  for (const [name, wert] of [['Zukunft', ms('2026-11-30T12:00:00+01:00')], ['Unsinn', '<b>']]) {
    const zz = samstag();
    zz.log[12].zuletzt = wert;
    const h = await fall(`17c ${name}`, zz, T.so);
    check((await h.lies()).log[12].done === 'db', `17c ${name} als letzter Eintrag der Einheit zählt nicht – abgeschlossen`);
    await ende(h);
  }
});

/* ------------------------------------------------------------------ *
 * 18: Die Karte einer Einheit von gestern
 * ------------------------------------------------------------------ */
await abschnitt(18, async () => {
  // Am Sonntag zu Workout 12 zurückgeblättert – sie hat sich am Morgen selbst
  // abgeschlossen. Dort stand „✓ Für heute durch / 4 von 15 Sätzen. Die
  // nächste Einheit kommt von selbst." unter „Gestern · Workout 12": weder war
  // heute etwas, noch kommt die nächste erst noch. Und ebenso über jeder ganz
  // gemachten Einheit von früher.
  const f = await fall('18 Karte von gestern', samstag(), T.sa);
  await f.tag(T.so);
  await f.klick('[data-act="nav-workout"][data-delta="-1"]', 250);
  const k12 = { ...(await blick(f)), sub: await f.txt('.fertig-sub') };
  const weiter = await f.page.locator('[data-act="start-session"]:has-text("Doch noch weitermachen")').count();
  check(/Gestern · Workout 12/.test(k12.auge) && k12.kopf === '✓ Abgeschlossen' && k12.sub === '4 von 15 Sätzen.' && weiter === 1,
    `18 Workout 12, selbst abgeschlossen: „${k12.auge}" – „${k12.kopf}" – „${k12.sub}", „Doch noch weitermachen" ${weiter}×`);
  await f.klick('[data-act="nav-workout"][data-delta="-1"]', 250);
  const k11 = { ...(await blick(f)), sub: await f.txt('.fertig-sub') };
  const knopf = await f.page.locator('#view [data-act="start-session"]').count();
  check(/vor 2 Tagen · Workout 11/.test(k11.auge) && k11.kopf === '✓ Abgeschlossen' && k11.sub === 'Alle 12 Sätze stehen.' && knopf === 0,
    `18 Workout 11, ganz gemacht: „${k11.auge}" – „${k11.kopf}" – „${k11.sub}", ohne Knopf (${knopf})`);
  await ende(f);

  // Und die Seite: Mit der Zeile darüber schob sich die Karte von Workout 12
  // bei 360×740 um 24 px (mit Tobis 17 Sätzen 41 px, 8f), die Reihe „Übungen
  // & Gewichte" halb unter der Leiste – und „4 von 15" stand dreimal da, in
  // der Zeile, im Fortschritt und auf der Karte. Über der Karte einer Einheit,
  // von der die Zeile spricht, steht sie deshalb nicht; auf der Startseite und
  // über Workout 11 weiter.
  const g = await fall('18 Seite', samstag(), T.sa);
  for (const [wann, wort] of [[T.so, 'Sonntag'], [T.mo, 'Montag']]) {
    for (const [b, h] of [[414, 896], [360, 740]]) {
      await g.page.setViewportSize({ width: b, height: h });
      await g.tag(wann);
      const start = await blick(g);
      await g.klick('[data-act="nav-workout"][data-delta="-1"]', 250);
      const k = await blick(g);
      const m = await seiteMessen(g);
      check(start.zeilen === 1 && /Workout 12/.test(k.auge) && k.kopf === '✓ Abgeschlossen' && k.zeilen === 0
        && m.scroll <= 0 && m.fussUnten <= m.sichtbar,
      `18 ${wort} ${b}×${h}, zu Workout 12 geblättert („${k.auge}"): keine Zeile über ihrer Karte, eine Seite (Überhang ${m.scroll}, Fuß ${m.fussUnten} / ${m.sichtbar}); auf der Startseite steht sie (${start.zeilen})`);
      await g.klick('[data-act="nav-workout"][data-delta="-1"]', 250);
      const k11 = await blick(g);
      const m11 = await seiteMessen(g);
      check(/Workout 11/.test(k11.auge) && k11.zeilen === 1 && m11.scroll <= 0 && m11.fussUnten <= m11.sichtbar,
        `18 ${wort} ${b}×${h}, Workout 11: die Zeile steht, eine Seite (Überhang ${m11.scroll}, Fuß ${m11.fussUnten} / ${m11.sichtbar})`);
    }
  }
  await ende(g);
});

/* ------------------------------------------------------------------ *
 * 19: Zwei Einheiten in der Zeile
 * ------------------------------------------------------------------ */
await abschnitt(19, async () => {
  // Wie nach zwei Tagen ohne die App: Workout 11 vom Freitag mit 3 von 12,
  // Workout 12 vom Samstag mit 4 von 15 – beide am Sonntag abgeschlossen. Ein
  // Satz in Workout 12 nachgetragen: Sie ist dann nicht mehr „4 von 15", und
  // die Zeile nennt nur noch Workout 11.
  const f = await fall('19 zwei', samstag({ log: { ...fertigBis(10), 11: eintrag(11, 3), 12: eintrag(12, 4) } }), T.so);
  const so = await blick(f);
  check(so.zeile.startsWith('✓ Workout 11 vom Freitag (3 von 12 Sätzen) und Workout 12 vom Samstag (4 von 15 Sätzen) sind abgeschlossen.')
    && so.knoepfe === 0, `19 beide in der Zeile, ohne Knopf („${so.zeile}")`);
  await f.klick('[data-act="nav-workout"][data-delta="-1"]', 200);
  await zurListe(f);
  await hake(f, 1);
  await f.klick('[data-act="hide-list"]', 200);
  await f.klick('[data-act="nav-workout"][data-delta="1"]', 200);
  const nb = await blick(f);
  const z = await f.M(({ store }) => store.getState().tagesabschluss);
  check(nb.zeile.startsWith('✓ Workout 11 vom Freitag ist abgeschlossen – 3 von 12 Sätzen.') && !/Workout 12 vom/.test(nb.zeile)
    && z && z.einheiten.length === 1 && z.einheiten[0].n === 11,
  `19 nach dem Satz in Workout 12: nur noch Workout 11 („${nb.zeile}")`);
  await ende(f);
});

/* ------------------------------------------------------------------ *
 * 20: Die letzte Einheit der Runde liegt
 * ------------------------------------------------------------------ */
await abschnitt(20, async () => {
  // Workout 84 angefangen, 4 Sätze, liegen geblieben. Am nächsten Tag schließt
  // sie sich ab, und im selben Start rollt die Runde weiter (rundeWeiter()):
  // Die Startseite steht bei Workout 1. Die Zeile bleibt – sie sagt, warum –,
  // obwohl das Protokoll von Workout 84 jetzt in der Ablage liegt. Mit dem
  // ersten Satz in Workout 1 geht sie.
  const letzte = PLAN[PLAN.length - 1];
  const tag = letzte.tag;
  const z = {
    ...GRUND, lastBackup: { on: tag, done: 99 },
    log: { ...fertigBis(PLAN.length - 1), [letzte.n]: eintrag(letzte.n, 4) },
    letzterEintrag: { n: String(letzte.n), at: ms(`${tag}T18:00:00+01:00`) },
  };
  // Gleich am nächsten Tag geöffnet, nicht über f.tag(): Beim Neuladen hält
  // dieser Test document.hidden auf „sichtbar" (fall()), und die alte Seite
  // nähme das Wegschalten beim Entladen für ein Zurückkommen – sie rollte die
  // Runde selbst noch einmal weiter, und die Ablage hätte sie doppelt.
  const f = await fall('20 Runde', z, `${plusTage(tag, 1)}T10:00:00+01:00`);
  const b = await blick(f);
  const st = await f.lies();
  const runden = await f.M(({ store }) => (store.getState().rounds || []).length);
  check(runden === 1 && /Workout 1\b/.test(b.auge)
    && b.zeile.startsWith(`✓ Workout ${letzte.n} vom `) && b.zeile.includes('ist abgeschlossen – 4 von') && b.knoepfe === 0,
  `20 die Runde rollt weiter, die Zeile sagt, warum („${b.auge}" – „${b.zeile}", Runden ${runden})`);
  check(!!st.tagesabschluss, '20 und steht im Zustand');
  await zurListe(f);
  await hake(f, 1);
  const nach = await f.lies();
  check(nach.tagesabschluss === null && !!(nach.log[1] && nach.log[1].startedOn),
    `20 der erste Satz in Workout 1 nimmt sie weg (${JSON.stringify(nach.tagesabschluss)})`);
  await ende(f);
});

/* ------------------------------------------------------------------ *
 * 21: „Doch noch weitermachen", ohne Haken
 * ------------------------------------------------------------------ */
await abschnitt(21, async () => {
  // Getippt, ohne Haken zurück aufs Dashboard: Oben stand „✓ Workout 12 vom
  // Samstag ist abgeschlossen – 4 von 15 Sätzen.", direkt darunter „Gestern
  // angefangen · Workout 12" mit „✓ Training abschließen (4/15)" – am
  // Nachmittag über „Workout 12 läuft noch.". Bis v242 nahm „Rest heute
  // machen" die Zeile beim Tipp weg. Jetzt tritt sie zurück, solange die
  // Sitzung auf der Einheit läuft, und steht wieder da, wenn die ohne Haken
  // endet: Der Tipp allein hat nichts geändert.
  const f = await fall('21 ohne Haken', samstag(), T.sa);
  await f.tag(T.so);
  await dochWeiter(f);
  await zurueck(f);
  const lauf = await blick(f);
  const knopf = await f.txt('[data-act="finish-session"]');
  check(/Training abschließen \(4\/15\)/.test(knopf) && /Gestern angefangen · Workout 12/.test(lauf.auge) && lauf.zeilen === 0,
    `21 zurück aufs Dashboard: „${lauf.auge}", „${knopf}" – keine Zeile „ist abgeschlossen" darüber („${lauf.zeile}")`);
  check((await f.lies()).tagesabschluss !== null, '21 im Zustand bleibt sie');
  await f.tag('2026-10-25T14:00:00+01:00');
  const nm = await blick(f);
  const ansicht = await f.txt('#view');
  check(/Workout 12 läuft noch/.test(ansicht) && /Workout 13/.test(nm.auge) && nm.zeilen === 0,
    `21 um 14:00 neu geöffnet: „${nm.auge}", „Workout 12 läuft noch" – keine Zeile darüber („${nm.zeile}")`);
  // Die Sitzung endet ohne Haken: Auf der Startseite steht sie wieder, mit dem Ziel.
  await f.klick('[data-act="zur-laufenden"]', 400);
  await zurueck(f);
  await f.klick('[data-act="finish-session"]', 400);
  if (!/Workout 13/.test((await blick(f)).auge)) await f.klick('[data-act="nav-workout"][data-delta="1"]', 250);
  const wieder = await blick(f);
  check(!(await f.lies()).session && wieder.zeile.startsWith(`✓ ${satzText}`)
    && /Von den 11 offenen Sätzen kommen morgen \d+ in Workout 13 mit rein\./.test(wieder.zeile),
  `21 „Abschließen" ohne Haken, auf Workout 13: die Zeile steht wieder da („${wieder.zeile}")`);
  await ende(f);

  // Bleibt die Sitzung bis Montag liegen, endet sie dort (13a) – und die Zeile
  // steht am Tag danach, wie sonst auch.
  const g = await fall('21 bis Montag', samstag(), T.sa);
  await g.tag(T.so);
  await dochWeiter(g);
  await zurueck(g);
  await g.tag(T.mo);
  const mo = await blick(g);
  check(!(await g.lies()).session && mo.zeile.startsWith(`✓ ${satzText}`) && mo.zeile.includes('kommen heute'),
    `21 Montag: die Sitzung von gestern ist zu, die Zeile steht wieder („${mo.zeile}")`);
  await ende(g);
});

console.log(`\n${fails ? `${fails} FEHLER` : 'alle Prüfungen bestanden'}`);
for (const ctx of offen) await ctx.close().catch(() => {});
await browser.close();
