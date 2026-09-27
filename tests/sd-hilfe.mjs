/*
 * Gemeinsames für die Tests der Schilddrüsen-App (tests/test-sd-*.mjs).
 *
 * Heißt nicht test-…, damit tests/lauf.mjs die Datei nicht selbst als Test
 * startet. Stellt bereit:
 *
 *   - die Adresse der App neben der Workout-App,
 *   - einen Browser mit fester Uhr: Datum und Uhrzeit kommen aus dem
 *     localStorage (__testtag, __testzeit), sonst hängt jeder Test am Kalender
 *     des Rechners – und „Tablette fällig ab 7 Uhr" am Zeitpunkt des Laufs,
 *   - Dialoge (confirm/alert) werden bestätigt und mitgeschrieben,
 *   - check() mit der Ausgabe, die tests/lauf.mjs zählt.
 */
import { chromium } from 'playwright';
import { URL as WORKOUT_URL } from './umgebung.mjs';

export const SD_URL = process.env.SCHILDDRUESE_URL
  || WORKOUT_URL.replace(/index\.html$/, 'schilddruese/index.html');

export const SCHLUESSEL = 'schilddruese.stand.v1';

/** ISO-Tag + n Tage, ohne Zeitzonen-Fallen (mittags gerechnet). */
export function plus(iso, n) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** „27.09.2026" aus „2026-09-27". */
export const kurz = (iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

/** Feste Uhr aus __testtag/__testzeit – als Init-Skript für einen Browserkontext. */
export function uhrStellen() {
  let tag = null;
  let zeit = null;
  try {
    tag = localStorage.getItem('__testtag');
    zeit = localStorage.getItem('__testzeit');
  } catch { /* about:blank */ }
  if (!tag) return;
  const Echt = Date;
  const fest = new Echt(`${tag}T${zeit || '12:00'}:00`).getTime();
  function Mock(...args) {
    if (!(this instanceof Mock)) return new Echt(fest).toString();
    return args.length === 0 ? new Echt(fest) : new Echt(...args);
  }
  Mock.prototype = Echt.prototype;
  Mock.now = () => fest;
  Mock.parse = Echt.parse;
  Mock.UTC = Echt.UTC;
  window.Date = Mock;
}

/**
 * Einen Browser starten und die App öffnen.
 *
 * @param {object} o
 * @param {object} [o.viewport]
 * @param {string} [o.tag]      fester Tag „2026-03-10"
 * @param {string} [o.zeit]     feste Uhrzeit „08:15"
 * @param {object} [o.stand]    Stand, der vor dem Öffnen im Speicher liegt
 * @param {boolean} [o.ohneTeilen] navigator.share entfernen (Linux hat es meist ohnehin nicht)
 */
export async function oeffne({ viewport = { width: 390, height: 844 }, tag = null, zeit = null, stand = null, ohneTeilen = true, kontext = {} } = {}) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport, locale: 'de-DE', acceptDownloads: true, ...kontext });
  await ctx.addInitScript(uhrStellen);
  if (ohneTeilen) {
    await ctx.addInitScript(() => {
      // Über das Objekt selbst statt über `Navigator`: Der Linter kennt nur
      // die Namen, die die App wirklich anfasst (siehe eslint.config.mjs).
      const proto = Object.getPrototypeOf(navigator);
      try { delete proto.share; delete proto.canShare; } catch { /* egal */ }
    });
  }
  const page = await ctx.newPage();
  const fehler = [];
  const dialoge = [];
  const dialog = { antwort: true };
  page.on('pageerror', (e) => fehler.push(`PAGEERROR: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') fehler.push(`CONSOLE: ${m.text()}`); });
  page.on('dialog', (d) => {
    dialoge.push(d.message());
    if (d.type() === 'alert' || dialog.antwort) d.accept(); else d.dismiss();
  });

  let fails = 0;
  let oks = 0;
  const check = (c, m) => {
    console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`);
    if (c) oks++; else { fails++; process.exitCode = 1; }
  };

  await page.goto(SD_URL, { waitUntil: 'networkidle' });
  await page.evaluate(({ tag: t, zeit: z, stand: s, key }) => {
    localStorage.clear();
    if (t) localStorage.setItem('__testtag', t);
    if (z) localStorage.setItem('__testzeit', z);
    if (s) localStorage.setItem(key, JSON.stringify(s));
  }, { tag, zeit, stand, key: SCHLUESSEL });
  await page.reload({ waitUntil: 'networkidle' });

  /** Uhr neu stellen und neu laden. */
  const uhr = async (t, z = null) => {
    await page.evaluate(({ t: tt, z: zz }) => {
      localStorage.setItem('__testtag', tt);
      if (zz) localStorage.setItem('__testzeit', zz); else localStorage.removeItem('__testzeit');
    }, { t, z });
    await page.reload({ waitUntil: 'networkidle' });
  };

  /** Der gespeicherte Stand – nach dem verzögerten Schreiben. */
  const gespeichert = async () => {
    await page.waitForTimeout(250);
    return page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), SCHLUESSEL);
  };

  const ende = async () => {
    check(fehler.length === 0, `keine Fehler in der Konsole${fehler.length ? `: ${fehler.slice(0, 3).join(' | ')}` : ''}`);
    await browser.close();
    if (!oks) process.exitCode = 1;
    process.exit(fails ? 1 : 0);
  };

  return { browser, ctx, page, check, fehler, dialoge, dialog, uhr, gespeichert, ende };
}

/**
 * Ein eingerichteter Stand: begrüßt, eine Dosis seit `ab`. Weitere Felder
 * über `mehr` – sie ersetzen die Vorgaben.
 */
export function standMit(ab, mehr = {}) {
  return {
    version: 1,
    profil: { name: '', begruesst: true },
    einstellungen: { erinnerung: '07:00', schrift: 'gross', farbe: 'hell', hinweisTablette: false },
    dosen: [{ id: 'd1', ab, praeparat: 'L-Thyroxin', mikrogramm: 75, tabletten: 1, notiz: '' }],
    einnahmen: {},
    labor: [],
    befinden: [],
    gewicht: [],
    termine: [],
    fragen: [],
    vorrat: null,
    ...mehr,
  };
}

/** Den Text der Ansicht, ohne Kopf und Leiste. */
export const ansichtText = (page) => page.locator('#ansicht').innerText();
