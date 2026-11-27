/*
 * Die Erinnerung am Abend (v18): Ist zur gewählten Uhrzeit noch nichts fürs
 * Abendessen eingetragen, meldet sich die App mit einer Mitteilung – sonst
 * nicht.
 *
 * Tobi, 27.11.2026: „Alle drei“ – auf den Vorschlag „eine sanfte Erinnerung am
 * Abend“, weil Uwe jeden Tag einträgt, aber von Tag zu Tag weniger.
 *
 * Das Handy holt sich beim Push-Dienst seines Browsers ein Abo und legt es mit
 * Uhrzeit, Zeitzone und zwei Zahlen (Einträge heute, davon abends) bei
 * Supabase ab (mahlzeit_erinnerung_melden, supabase/erinnerung.sql). Die Edge
 * Function mahlzeit-erinnerung schickt abends die Mitteilung, sw.js zeigt sie.
 * Was gegessen wurde, geht dafür nicht mit.
 *
 * Auf dem iPhone geht das nur in der App vom Home-Bildschirm (iOS 16.4+).
 *
 * Der Zustand liegt in einem eigenen Schlüssel, nicht im Stand: Das Abo
 * gehört zu diesem Handy und soll nicht mit der Sicherung umziehen. Die
 * Kennung ist zufällig und bleibt auf dem Handy.
 *
 * Ohne Netz: Einschalten braucht einmal Netz (das Abo kommt vom Push-Dienst).
 * Der Stand (statusMelden) wird nachgeschickt, sobald wieder Netz da ist –
 * gemerkt ist nur, was wirklich ankam.
 */
import { echtesGeraet } from './lebenszeichen.js';

export const FUNKTION = 'https://vjyohppohmvhhxgwouti.supabase.co/functions/v1/mahlzeit-erinnerung';
export const MELDEN = 'https://vjyohppohmvhhxgwouti.supabase.co/rest/v1/rpc/mahlzeit_erinnerung_melden';
const OEFFENTLICH = 'sb_publishable_wTUNShIKMFjCOmZzQuuN-A_vFHPkKUI';
const SCHLUESSEL = 'mahlzeit.erinnerung.v1';
export const UHRZEITEN = ['19:00', '20:00', '21:00'];
export const STANDARD_UHR = '20:00';

function lesen() {
  try {
    const z = JSON.parse(localStorage.getItem(SCHLUESSEL) || 'null') || {};
    return { an: z.an === true, uhr: UHRZEITEN.includes(z.uhr) ? z.uhr : STANDARD_UHR, kennung: /^[a-z0-9]{20,40}$/.test(z.kennung || '') ? z.kennung : '', gemeldet: typeof z.gemeldet === 'string' ? z.gemeldet : '' };
  } catch {
    return { an: false, uhr: STANDARD_UHR, kennung: '', gemeldet: '' };
  }
}

function schreiben(z) {
  try { localStorage.setItem(SCHLUESSEL, JSON.stringify(z)); } catch { /* voll oder gesperrt */ }
}

/** { an, uhr } – für die Anzeige. */
export const zustand = () => { const z = lesen(); return { an: z.an, uhr: z.uhr }; };

function neueKennung() {
  const zeichen = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => zeichen[b % zeichen.length]).join('');
}

/**
 * Was Mitteilungen hier im Weg steht: { grund, text } mit grund '' (nichts),
 * 'iphone' (im Browser statt vom Home-Bildschirm), 'browser' (kann es nicht)
 * oder 'blockiert' (Erlaubnis verweigert).
 */
export function hindernis({ ios = false } = {}) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    if (ios) return { grund: 'iphone', text: 'Auf dem iPhone geht das erst, wenn Mahlzeit auf dem Home-Bildschirm liegt und von dort geöffnet wird.' };
    return { grund: 'browser', text: 'Dieser Browser kann keine Mitteilungen.' };
  }
  if (Notification.permission === 'denied') {
    return { grund: 'blockiert', text: ios
      ? 'Mitteilungen sind für Mahlzeit ausgeschaltet. Wieder erlauben: iPhone-Einstellungen → Mitteilungen → Mahlzeit.'
      : 'Mitteilungen sind für Mahlzeit blockiert – in den Einstellungen der Seite wieder erlauben.' };
  }
  return { grund: '', text: '' };
}

const bytes = (b64url) => {
  const t = b64url.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(t + '='.repeat((4 - (t.length % 4)) % 4)), (c) => c.charCodeAt(0));
};

async function mitFrist(tun, ms = 12000) {
  const abbruch = new AbortController();
  const uhr = setTimeout(() => abbruch.abort(), ms);
  try { return await tun(abbruch.signal); } finally { clearTimeout(uhr); }
}

async function oeffentlicherSchluessel(holen) {
  const j = await mitFrist(async (signal) => {
    const r = await holen(FUNKTION, { signal });
    return r.ok ? r.json() : null;
  });
  if (!j || !/^[A-Za-z0-9_-]{87}$/.test(j.oeffentlich || '')) throw new Error('Der Server gibt gerade keinen Schlüssel für Mitteilungen.');
  return j.oeffentlich;
}

const gleicherSchluessel = (abo, oeffentlich) => {
  const k = abo.options && abo.options.applicationServerKey;
  if (!k) return true;
  const a = new Uint8Array(k);
  const b = bytes(oeffentlich);
  return a.length === b.length && a.every((x, i) => x === b[i]);
};

/** Die zwei Zahlen von heute: wie viele Einträge, wie viele davon abends. */
export function stand(daten, tag) {
  const liste = daten.tage?.[tag] || [];
  return { tag, gesamt: Math.min(500, liste.length), abends: Math.min(500, liste.filter((e) => e.z === 'abends').length) };
}

const zeitzone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin'; } catch { return 'Europe/Berlin'; } };

async function melden(rumpf, holen) {
  const r = await mitFrist((signal) => holen(MELDEN, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: OEFFENTLICH },
    body: JSON.stringify(rumpf),
    signal,
  }));
  if (!r.ok) throw new Error(`Der Server hat nicht angenommen (${r.status}).`);
  return true;
}

const abdruck = (uhr, s, abo) => `${uhr}|${s.tag}|${s.gesamt}|${s.abends}|${abo.endpoint}`;

async function ablegen(z, abo, daten, tag, holen) {
  const s = stand(daten, tag);
  await melden({ p_kennung: z.kennung, p_an: true, p_abo: abo, p_uhr: z.uhr, p_tz: zeitzone(), p_tag: s.tag, p_abends: s.abends, p_gesamt: s.gesamt }, holen);
  return abdruck(z.uhr, s, abo);
}

async function aboHolen(holen, { neu = true } = {}) {
  const reg = await navigator.serviceWorker.ready;
  let abo = await reg.pushManager.getSubscription();
  if (abo && !neu) return abo;
  const oeffentlich = await oeffentlicherSchluessel(holen);
  if (abo && !gleicherSchluessel(abo, oeffentlich)) {
    await abo.unsubscribe();
    abo = null;
  }
  if (!abo) abo = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(oeffentlich) });
  return abo;
}

const alsJson = (abo) => { const j = abo.toJSON(); return { endpoint: j.endpoint, keys: j.keys }; };

/**
 * Einschalten (nach einem Tipp – die Erlaubnis fragt der Browser nur dann):
 * Erlaubnis, Abo, beim Server ablegen. Wirft mit einem Satz, wenn es nicht geht.
 */
export async function einschalten(uhr, daten, tag, { ios = false, holen = (...a) => fetch(...a) } = {}) {
  const h = hindernis({ ios });
  if (h.grund) throw new Error(h.text);
  if (navigator.onLine === false) throw new Error('Zum Einschalten braucht es einmal Netz.');
  if ((await Notification.requestPermission()) !== 'granted') throw new Error('Ohne Erlaubnis keine Mitteilungen.');
  let abo;
  try {
    abo = await aboHolen(holen);
  } catch (e) {
    throw new Error(/Schlüssel/.test(e?.message || '') ? e.message : 'Das hat nicht geklappt. Ist das Handy online? Dann gleich noch einmal.');
  }
  const z = lesen();
  z.kennung = z.kennung || neueKennung();
  z.uhr = UHRZEITEN.includes(uhr) ? uhr : STANDARD_UHR;
  try {
    z.gemeldet = await ablegen(z, alsJson(abo), daten, tag, holen);
  } catch {
    throw new Error('Der Server ist gerade nicht erreichbar. Gleich noch einmal versuchen.');
  }
  z.an = true;
  schreiben(z);
}

/** Ausschalten: sofort aus; beim Server abmelden und das Abo aufgeben, soweit erreichbar. */
export async function ausschalten({ holen = (...a) => fetch(...a) } = {}) {
  const z = lesen();
  schreiben({ ...z, an: false, gemeldet: '' });
  try {
    if (z.kennung) await melden({ p_kennung: z.kennung, p_an: false }, holen);
  } catch { /* ohne Abo beim Push-Dienst kommt auch nichts mehr an */ }
  try {
    const reg = await navigator.serviceWorker.ready;
    const abo = await reg.pushManager.getSubscription();
    if (abo) await abo.unsubscribe();
  } catch { /* kein Abo */ }
}

/**
 * Den Stand von heute nachmelden, wenn er sich geändert hat (oder die Uhrzeit,
 * oder das Abo) – beim Öffnen, beim Weglegen, bei „online“. Fehlt das Abo
 * inzwischen (der Push-Dienst hat es verworfen), holt die App still ein neues.
 * Wirft nie.
 */
export async function statusMelden(daten, { tag, holen = (...a) => fetch(...a) } = {}) {
  try {
    const z = lesen();
    if (!z.an || !z.kennung || !echtesGeraet()) return false;
    if (hindernis().grund || Notification.permission !== 'granted') return false;
    const abo = alsJson(await aboHolen(holen, { neu: false }));
    if (abdruck(z.uhr, stand(daten, tag), abo) === z.gemeldet) return false;
    const gemeldet = await ablegen(z, abo, daten, tag, holen);
    schreiben({ ...lesen(), gemeldet });
    return true;
  } catch {
    return false;
  }
}

/** Eine andere Uhrzeit: gleich gemerkt, beim Server mit dem nächsten statusMelden. */
export function uhrSetzen(uhr) {
  if (!UHRZEITEN.includes(uhr)) return;
  schreiben({ ...lesen(), uhr });
}

/** Eine Probe-Mitteilung jetzt gleich. Gibt einen Satz für die Anzeige zurück. */
export async function probe({ holen = (...a) => fetch(...a) } = {}) {
  const z = lesen();
  if (!z.an || !z.kennung) return 'Erst die Erinnerung einschalten.';
  if (navigator.onLine === false) return 'Für die Probe braucht es Netz.';
  try {
    const r = await mitFrist((signal) => holen(FUNKTION, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ art: 'probe', kennung: z.kennung }), signal }), 20000);
    if (r.ok) return 'Probe ist unterwegs – sie kommt in ein paar Sekunden.';
    if (r.status === 429) return 'Für heute sind die Proben aufgebraucht.';
    if (r.status === 404) return 'Das Handy ist beim Server nicht mehr angemeldet – Erinnerung einmal aus- und wieder einschalten.';
    return 'Die Probe ging nicht raus. Gleich noch einmal versuchen.';
  } catch {
    return 'Keine Verbindung. Ist das Handy online?';
  }
}
