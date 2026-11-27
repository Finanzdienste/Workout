/*
 * mahlzeit-erinnerung: die Erinnerung am Abend (Mahlzeit v18). Ist zur
 * gewählten Uhrzeit noch nichts fürs Abendessen eingetragen, bekommt das
 * Handy eine Mitteilung – sonst nicht.
 *
 * Tobi, 27.11.2026: „Alle drei“ – auf den Vorschlag „eine sanfte Erinnerung am
 * Abend“, weil Uwe jeden Tag einträgt, aber von Tag zu Tag weniger (13 → 4).
 *
 * Die App legt ihr Abo beim Push-Dienst und ihren Stand von heute (wie viele
 * Einträge, wie viele abends) in mahlzeit_erinnerung ab
 * (mahlzeit_erinnerung_melden, supabase/erinnerung.sql). Die Datenbank stößt
 * diese Funktion alle 15 Minuten an, wenn jemand dran sein könnte (pg_cron).
 * Verschickt wird wie in Freizeit: webpush.js ist eine unveränderte Kopie aus
 * Finanzdienste/Freizeit (supabase/functions/freizeit-push), der Ausweis
 * (VAPID) ist derselbe und liegt in der Datenbank (freizeit_push_schluessel).
 *
 * Ohne Deno-Besonderheiten – tests/test-mz-erinnerung.mjs lässt denselben
 * Code in Node laufen, mit eigenem `holen` statt fetch.
 */
import { senden } from './webpush.js';

export const SUBJECT = 'https://finanzdienste.github.io/Workout/mahlzeit/';
/** So lange nach der gewählten Uhrzeit wird noch erinnert – nicht mehr mitten in der Nacht. */
export const FENSTER_MIN = 120;
/** Hat sich die App so viele Tage nicht gemeldet, hört die Erinnerung auf – niemand wird ewig angetippt. */
export const STILL_TAGE = 7;
export const PROBEN_JE_TAG = 5;
/** Nur an echte Push-Dienste – die Adresse kommt vom Handy, und die Funktion soll nicht irgendwohin schicken. */
const DIENSTE = /(^|\.)(fcm\.googleapis\.com|push\.apple\.com|push\.services\.mozilla\.com|notify\.windows\.com)$/;

export function dienstErlaubt(endpoint) {
  try {
    const u = new URL(endpoint);
    return u.protocol === 'https:' && DIENSTE.test(u.hostname);
  } catch {
    return false;
  }
}

/** Datum und Uhrzeit in einer Zeitzone: { tag: '2026-11-27', min: 1205 } – ohne Zeitzone gilt Berlin. */
export function ortszeit(jetzt, tz) {
  let teile;
  try {
    teile = new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(jetzt));
  } catch {
    return ortszeit(jetzt, 'Europe/Berlin');
  }
  const t = Object.fromEntries(teile.map((x) => [x.type, x.value]));
  return { tag: `${t.year}-${t.month}-${t.day}`, min: Number(t.hour) * 60 + Number(t.minute) };
}

const minuten = (uhr) => {
  const m = /^(\d{2}):(\d{2})$/.exec(uhr || '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : 20 * 60;
};

/**
 * Ist diese Zeile jetzt dran? Zurück kommt null oder der Text der Mitteilung.
 * Dran ist sie, wenn die Uhrzeit erreicht ist (und höchstens FENSTER_MIN
 * her), heute noch nicht erinnert wurde, die App sich in den letzten
 * STILL_TAGE gemeldet hat – und für heute abends nichts eingetragen ist.
 * Ein Stand von gestern heißt: heute noch gar nichts.
 */
export function faellig(zeile, jetzt) {
  const ort = ortszeit(jetzt, zeile.tz);
  const ab = minuten(zeile.uhr);
  if (ort.min < ab || ort.min > ab + FENSTER_MIN) return null;
  if (zeile.gesendet === ort.tag) return null;
  if (!zeile.at || jetzt - new Date(zeile.at).getTime() > STILL_TAGE * 86400000) return null;
  const heute = zeile.tag === ort.tag;
  if (heute && Number(zeile.abends) > 0) return null;
  const text = heute && Number(zeile.gesamt) > 0
    ? 'Abendessen schon gehabt? Kurz eintragen, dann ist der Tag komplett.'
    : 'Heute ist noch nichts eingetragen. Magst du es kurz nachtragen?';
  return { tag: ort.tag, text };
}

const PROBE_TEXT = 'Das ist eine Probe. So meldet sich Mahlzeit abends, wenn noch nichts eingetragen ist.';

async function db(url, schluessel, pfad, init, holen) {
  const r = await holen(`${url}/rest/v1/${pfad}`, {
    ...init,
    headers: { apikey: schluessel, Authorization: `Bearer ${schluessel}`, 'Content-Type': 'application/json', ...((init && init.headers) || {}) },
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${pfad.split('?')[0]}: ${r.status} ${text.slice(0, 200)}`);
  return text.trim() ? JSON.parse(text) : null;
}

/** Derselbe Ausweis wie Freizeit: Das Paar liegt in der Datenbank, nur der Betreiber-Schlüssel kommt heran. */
export async function vapidHolen({ url, schluessel, holen = fetch }) {
  const paar = await db(url, schluessel, 'rpc/freizeit_push_schluessel', { method: 'POST', body: '{}' }, holen);
  if (!paar || typeof paar.oeffentlich !== 'string' || typeof paar.privat !== 'string') throw new Error('kein VAPID-Schlüsselpaar (freizeit_push_schluessel)');
  return { oeffentlich: paar.oeffentlich, privat: paar.privat, subject: SUBJECT };
}

const nachricht = (text) => JSON.stringify({ titel: 'Mahlzeit', text, tag: 'mahlzeit-abend', url: './' });

async function schicken(zeile, text, vapid, holen) {
  if (!zeile.abo || !dienstErlaubt(zeile.abo.endpoint)) return { status: 0, dienst: 'unbekannter Dienst' };
  const dienst = new URL(zeile.abo.endpoint).host;
  try {
    // Zwei Stunden haltbar: Ein Handy, das erst nachts wieder Netz hat, soll dann nicht mehr brummen.
    const status = await senden(zeile.abo, nachricht(text), vapid, { ttl: FENSTER_MIN * 60, topic: 'mahlzeit-abend', holen });
    return { status, dienst };
  } catch (e) {
    return { status: -1, dienst, fehler: String(e && e.message ? e.message : e).slice(0, 120) };
  }
}

const kennungOk = (k) => /^[a-z0-9]{20,40}$/.test(k || '');

/**
 * Ein Durchlauf: alle Zeilen ansehen, die fälligen anschreiben. Angeschrieben
 * ist, was einmal versucht wurde (gesendet = heute) – lieber eine Erinnerung
 * verlieren als zweimal brummen. Ein Abo, das der Push-Dienst nicht mehr kennt
 * (404, 410), fliegt raus; die App legt beim nächsten Öffnen ein neues ab.
 */
export async function lauf({ url, schluessel, vapid = null, holen = fetch, jetzt = Date.now() }) {
  const zeilen = await db(url, schluessel, 'mahlzeit_erinnerung?select=kennung,abo,uhr,tz,tag,abends,gesamt,gesendet,at', { method: 'GET' }, holen);
  const dran = (zeilen || []).map((z) => ({ z, f: faellig(z, jetzt) })).filter((x) => x.f);
  const ergebnis = { zeilen: (zeilen || []).length, faellig: dran.length, gesendet: 0, tot: 0, versuche: [] };
  if (!dran.length) return ergebnis;
  if (!vapid) vapid = await vapidHolen({ url, schluessel, holen });
  for (const { z, f } of dran) {
    const r = await schicken(z, f.text, vapid, holen);
    ergebnis.versuche.push(`${r.dienst} ${r.fehler || r.status}`);
    if (r.status === 404 || r.status === 410 || r.status === 0) {
      await db(url, schluessel, `mahlzeit_erinnerung?kennung=eq.${z.kennung}`, { method: 'DELETE' }, holen);
      ergebnis.tot++;
      continue;
    }
    if (r.status === 201 || r.status === 200) ergebnis.gesendet++;
    await db(url, schluessel, `mahlzeit_erinnerung?kennung=eq.${z.kennung}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ gesendet: f.tag }) }, holen);
  }
  return ergebnis;
}

/**
 * Eine Probe, jetzt gleich – der Knopf „Probe schicken“ in der App. Höchstens
 * PROBEN_JE_TAG am Tag. Zurück kommt { ok, status } oder { ok: false, grund }.
 */
export async function probe({ url, schluessel, kennung, vapid = null, holen = fetch, jetzt = Date.now() }) {
  if (!kennungOk(kennung)) return { ok: false, grund: 'kennung' };
  const zeilen = await db(url, schluessel, `mahlzeit_erinnerung?kennung=eq.${kennung}&select=kennung,abo,tz,proben,probe_tag`, { method: 'GET' }, holen);
  const z = zeilen && zeilen[0];
  if (!z) return { ok: false, grund: 'fehlt' };
  const heute = ortszeit(jetzt, z.tz).tag;
  const bisher = z.probe_tag === heute ? Number(z.proben) || 0 : 0;
  if (bisher >= PROBEN_JE_TAG) return { ok: false, grund: 'grenze' };
  await db(url, schluessel, `mahlzeit_erinnerung?kennung=eq.${kennung}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ proben: bisher + 1, probe_tag: heute }) }, holen);
  if (!vapid) vapid = await vapidHolen({ url, schluessel, holen });
  const r = await schicken(z, PROBE_TEXT, vapid, holen);
  if (r.status === 404 || r.status === 410 || r.status === 0) {
    await db(url, schluessel, `mahlzeit_erinnerung?kennung=eq.${kennung}`, { method: 'DELETE' }, holen);
    return { ok: false, grund: 'abo', status: r.status, dienst: r.dienst };
  }
  return { ok: r.status === 201 || r.status === 200, status: r.status, dienst: r.dienst, ...(r.fehler ? { fehler: r.fehler } : {}) };
}
