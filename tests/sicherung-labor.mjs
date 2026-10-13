/*
 * Das Labor für die automatische Sicherung: ein gespielter Server und Geräte,
 * die mit ihm reden. Geteilt von tests/test-sicherung-auto.mjs und
 * tests/test-sicherung-faelle.mjs – kein eigener Test (der Name fängt nicht mit
 * „test-" an, tests/lauf.mjs lässt ihn liegen).
 *
 * Der Server ist keine Attrappe, die alles schluckt, sondern spielt die
 * Semantik der drei Funktionen aus tools/sicherung.sql: Kennung und
 * Schreibmarke als Hex, IV als base64, ein Größenlimit, der Hash der
 * Schreibmarke statt der Marke selbst, „veraltet", wenn ein anderes Gerät
 * dazwischen geschrieben hat, „geloescht", wenn die Zeile weg ist, und „zu
 * oft" unter zehn Sekunden. Die Drossel je Quelle spielt er nicht: Sie hängt
 * an X-Forwarded-For, und den setzt hier niemand – gegen echtes PostgreSQL ist
 * sie in der README nachgestellt. Kein Aufruf erreicht den echten Server –
 * alles, was nach *.supabase.co will, landet in `route()`.
 *
 * Dazu, was die Fälle aus der Prüfung brauchen:
 *
 *   halten        ein Versprechen: Schreibaufrufe warten darauf, bevor der
 *                 Server sie bearbeitet – eine Sicherung, die im Netz hängt
 *   antwortWeg    so viele Schreibaufrufe bearbeitet der Server, verwirft dann
 *                 aber die Antwort – „angekommen, Antwort verloren"
 */
import { webcrypto, createHash } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';
import { URL as APP } from './umgebung.mjs';

export const START = Date.parse('2026-10-13T08:00:00Z');
export const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

const url64 = (t) => Buffer.from(t.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

/** Entschlüsseln wie ein Fremder, der den Schlüssel hat. */
export async function entschluesseln(key, daten, iv) {
  const k = await webcrypto.subtle.importKey('raw', url64(key), 'AES-GCM', false, ['decrypt']);
  const klar = Buffer.from(await webcrypto.subtle.decrypt(
    { name: 'AES-GCM', iv: Buffer.from(iv, 'base64') }, k, Buffer.from(daten, 'base64')));
  if (klar[0] === 1) return gunzipSync(klar.subarray(1)).toString('utf8');
  if (klar[0] === 0) return klar.subarray(1).toString('utf8');
  throw new Error(`unbekanntes Format ${klar[0]}`);
}

/** Verschlüsseln im Format der App – für Zeilen, die ein anderes Gerät angelegt hätte. */
export async function verschluesseln(key, text) {
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const k = await webcrypto.subtle.importKey('raw', url64(key), 'AES-GCM', false, ['encrypt']);
  const klar = Buffer.concat([Buffer.from([1]), gzipSync(Buffer.from(text, 'utf8'))]);
  const geheim = Buffer.from(await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, klar));
  return { daten: geheim.toString('base64'), iv: Buffer.from(iv).toString('base64') };
}

export function labor(browser) {
  const lab = {
    zeilen: new Map(),        // id -> { w_hash, daten, iv, groesse, stand }
    modus: 'ok',              // 'ok' | 'fehlt' | 'weg'
    anfragen: [],             // { name, body, url, roh, antwort }
    uhr: START,
    halten: null,
    antwortWeg: 0,
    fehler: [],
  };
  // PostgREST schreibt timestamptz mit Mikrosekunden und +00:00 – genau so zurück.
  const stempel = () => new Date(lab.uhr).toISOString().replace('Z', '123+00:00');
  const json = (status, obj) => ({ status, contentType: 'application/json', body: JSON.stringify(obj) });
  const abgelehnt = (message) => json(400, { code: 'P0001', message, details: null, hint: null });

  function schreiben(p) {
    if (!/^[0-9a-f]{64}$/.test(p.p_id || '')) return abgelehnt('ungueltige Kennung');
    if (!/^[0-9a-f]{64}$/.test(p.p_w || '')) return abgelehnt('ungueltige Schreibmarke');
    if (!/^[A-Za-z0-9+/]{16}$/.test(p.p_iv || '')) return abgelehnt('ungueltiger IV');
    if (!p.p_daten || p.p_daten.length < 24) return abgelehnt('leere Sicherung');
    if (p.p_daten.length > 2 * 1024 * 1024) return abgelehnt('Sicherung zu gross');
    const marke = sha(p.p_w);
    const alt = lab.zeilen.get(p.p_id);
    if (!alt) {
      if (p.p_vorher !== null && p.p_vorher !== undefined) return abgelehnt('geloescht');
      const z = { w_hash: marke, daten: p.p_daten, iv: p.p_iv, groesse: p.p_daten.length, stand: stempel() };
      lab.zeilen.set(p.p_id, z);
      return json(200, z.stand);
    }
    if (alt.w_hash !== marke) return abgelehnt('Schreibmarke passt nicht');
    if (p.p_vorher === null || p.p_vorher === undefined || p.p_vorher !== alt.stand) return abgelehnt('veraltet');
    if (lab.uhr - Date.parse(alt.stand) < 10000) return abgelehnt('zu oft');
    Object.assign(alt, { daten: p.p_daten, iv: p.p_iv, groesse: p.p_daten.length, stand: stempel() });
    return json(200, alt.stand);
  }

  lab.route = async (route) => {
    const url = route.request().url();
    const name = (/\/rpc\/([a-z_]+)/.exec(url) || [])[1] || url;
    const roh = route.request().postData() || '';
    let body = {};
    try { body = JSON.parse(roh || '{}'); } catch { body = {}; }
    const eintrag = { name, body, url, roh, antwort: null };
    lab.anfragen.push(eintrag);
    if (!name.startsWith('sicherung_')) return route.fulfill({ status: 204, body: '' });
    if (name === 'sicherung_schreiben' && lab.halten) await lab.halten;
    if (lab.modus === 'weg') { eintrag.antwort = 'kein Netz'; return route.abort('internetdisconnected'); }
    if (lab.modus === 'fehlt') {
      eintrag.antwort = 'fehlt';
      return route.fulfill(json(404, {
        code: 'PGRST202', details: null, hint: null,
        message: `Could not find the function public.${name} in the schema cache`,
      }));
    }
    let antwort;
    if (name === 'sicherung_schreiben') antwort = schreiben(body);
    else if (name === 'sicherung_lesen') {
      const z = lab.zeilen.get(body.p_id);
      antwort = json(200, z ? [{ daten: z.daten, iv: z.iv, groesse: z.groesse, stand: z.stand }] : []);
    } else if (name === 'sicherung_loeschen') {
      const z = lab.zeilen.get(body.p_id);
      const weg = z && z.w_hash === sha(body.p_w || '') ? 1 : 0;
      if (weg) lab.zeilen.delete(body.p_id);
      antwort = json(200, weg);
    } else antwort = json(404, { code: 'PGRST202', message: 'unbekannt' });
    eintrag.antwort = antwort.status === 200 ? 'ok' : JSON.parse(antwort.body).message;
    if (name === 'sicherung_schreiben' && lab.antwortWeg > 0) {
      // Geschrieben ist geschrieben – nur die Antwort kommt nie an.
      lab.antwortWeg -= 1;
      eintrag.antwort = `${eintrag.antwort} (Antwort verloren)`;
      return route.abort('connectionreset');
    }
    return route.fulfill(antwort);
  };

  lab.verkehr = () => lab.anfragen.filter((a) => a.name.startsWith('sicherung_'));
  lab.geschrieben = () => lab.anfragen.filter((a) => a.name === 'sicherung_schreiben');

  /** Eine Zeile anlegen, wie ein anderes Gerät mit diesem Schlüssel sie geschrieben hätte. */
  lab.ablegen = async (key, stand) => {
    const { daten, iv } = await verschluesseln(key, JSON.stringify(stand));
    const z = { w_hash: sha(sha(`w:${key}`)), daten, iv, groesse: daten.length, stand: stempel() };
    lab.zeilen.set(sha(`id:${key}`), z);
    return z;
  };

  /** Was unter diesem Schlüssel liegt, entschlüsselt – oder null. */
  lab.inhalt = async (key) => {
    const z = lab.zeilen.get(sha(`id:${key}`));
    return z ? JSON.parse(await entschluesseln(key, z.daten, z.iv)) : null;
  };

  /**
   * Ein Gerät: eigener Browserkontext, eigener Speicher, eigene Uhr.
   *
   *   zustand  der Stand im Speicher vor dem ersten Laden
   *   pm       was der Passwortmanager herausgibt: ein Eintrag, 'keiner', oder
   *            (fehlt) was auf diesem Gerät abgelegt wurde
   *   anker    an die Adresse gehängt, etwa '#sicherung=…'
   *   zeit     wo die Uhr des Geräts steht (sonst: die Uhr des Servers)
   */
  lab.geraet = async (name, { zustand = null, pm = null, anker = '', zeit = null } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 414, height: 896 }, acceptDownloads: true });
    // Alles nach Supabase landet beim gespielten Server – nie beim echten.
    await ctx.route(/supabase\.co\//, lab.route);
    await ctx.addInitScript(({ zustand: z, pm: vorgabe }) => {
      // Der Rückkanal ist von lokalen Adressen aus gesperrt (js/config.js);
      // diese Tests prüfen ihn, also schalten sie ihn ausdrücklich frei.
      localStorage.setItem('workout.rueckkanal.lokal', '1');
      if (z && !sessionStorage.getItem('__test.zustand')) {
        sessionStorage.setItem('__test.zustand', '1');
        localStorage.setItem('workout.state.v1', JSON.stringify(z));
      }
      // Der Passwortmanager, nachgebildet: store() legt ab, get() gibt heraus,
      // was abgelegt oder vorgegeben ist. Das echte Chromium ohne Oberfläche
      // lehnt store() ab – genau der Fall, den die App ebenfalls abfangen muss.
      class Ausweis {
        constructor(d) { this.id = d.id; this.name = d.name; this.password = d.password; this.type = 'password'; }
      }
      window.PasswordCredential = Ausweis;
      const abgelegt = () => JSON.parse(localStorage.getItem('__test.pm') || 'null');
      Object.defineProperty(navigator, 'credentials', {
        configurable: true,
        value: {
          store: async (c) => {
            localStorage.setItem('__test.pm', JSON.stringify({ id: c.id, name: c.name, password: c.password }));
          },
          get: async (o) => {
            // Überlebt das Neuladen nach dem Zurückholen – window nicht.
            sessionStorage.setItem('__test.get', JSON.stringify(o || null));
            const d = vorgabe === 'keiner' ? null : (vorgabe || abgelegt());
            return d ? new Ausweis(d) : null;
          },
        },
      });
      // Teilen: Ein Testlauf hat keinen Dialog – die Frage ist, *was* übergeben wird.
      navigator.canShare = () => true;
      navigator.share = async (d) => { window.__geteilt = { title: d.title, text: d.text, url: d.url }; };
      // Sichtbarkeit steuerbar, wie in test-zeit.mjs.
      window.__hidden = false;
      Object.defineProperty(document, 'hidden', { get: () => window.__hidden, configurable: true });
      Object.defineProperty(document, 'visibilityState', {
        get: () => (window.__hidden ? 'hidden' : 'visible'), configurable: true,
      });
    }, { zustand, pm });
    const page = await ctx.newPage();
    // Kurz: Fehlt ein Knopf (in der Gegenprobe gegen eine ältere Fassung), soll
    // der Fall scheitern und der nächste laufen – nicht eine halbe Minute warten.
    page.setDefaultTimeout(8000);
    page.on('pageerror', (e) => lab.fehler.push(`${name}: ${e.message}`));
    page.on('dialog', (d) => d.accept().catch(() => {}));
    // Die Uhr steht, bis der Test sie vorstellt: Drossel und Startverzögerung
    // sind Prüfgegenstand, und echte zwei Minuten wartet hier niemand ab.
    const t0 = zeit === null ? lab.uhr : zeit;
    await page.clock.install({ time: t0 });
    await page.clock.pauseAt(t0 + 1000);
    await page.goto(APP + anker, { waitUntil: 'networkidle' });
    return { ctx, page };
  };

  /**
   * Die Uhr vorstellen – und dem, was danach übers Netz geht, Zeit lassen.
   *
   * fastForward und nicht runFor: runFor spielt jedes Einzelbild der
   * Bewegungsbilder mit (requestAnimationFrame, 60 je Sekunde), und zwei Minuten
   * Drossel kosteten so eine halbe Minute echte Zeit. fastForward springt und
   * löst jeden fälligen Zeitgeber einmal aus – genau das, was hier zählt.
   */
  lab.warte = async (page, ms) => {
    if (ms) await page.clock.fastForward(ms);
    lab.uhr += ms;
    await page.waitForTimeout(350);
    await page.clock.fastForward(1);
    await page.waitForTimeout(150);
  };

  return lab;
}

export const meta = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('workout.sicherung.v1') || '{}'));
export const text = async (page, sel = '#view') => ((await page.locator(sel).first().textContent()) || '').replace(/\s+/g, ' ');
export const zuMehr = async (page) => {
  await page.locator('.tab[data-tab="settings"]').click();
  await page.waitForTimeout(150);
};
export const zumDashboard = async (page) => {
  await page.locator('.tab[data-tab="dashboard"]').click();
  await page.waitForTimeout(150);
};
export const logVon = (page) => page.evaluate(async () => JSON.stringify((await import('./js/store.js')).getState().log));
export const verstecken = (page) => page.evaluate(() => {
  window.__hidden = true;
  document.dispatchEvent(new Event('visibilitychange'));
});
export const zeigen = (page) => page.evaluate(() => {
  window.__hidden = false;
  document.dispatchEvent(new Event('visibilitychange'));
});
