/*
 * Lebenszeichen an Tobi (v6) – ob Uwe die App nutzt, nicht was er isst.
 *
 * Tobi, 18.11.2026: „ich hab die app ja selbst nicht und brauch sie nicht
 * aber wenn ich dich hier frage sollst dus mir sagen können". Gemeldet werden
 * nur Zahlen des Tages – wie viele Einträge, Hafer-Mahlzeiten, Sporteinheiten,
 * Werte, eigene Sachen, an wie vielen Tagen insgesamt etwas eingetragen ist –,
 * nie ein Name, eine Kalorie, ein Gewicht oder ein Blutzucker. Dazu eine
 * Zufallskennung des Geräts (kein Name) und ob die App vom Startbildschirm
 * läuft. Höchstens alle drei Stunden, beim Öffnen und beim Weglegen.
 *
 * Ziel ist die Tabelle mahlzeit_nutzung in Tobis Supabase-Projekt: Die App
 * darf dort nur einfügen, lesen kann nur der geheime Schlüssel. Abschalten
 * unter „Mehr → Lebenszeichen an Tobi".
 */

export const ADRESSE = 'https://vjyohppohmvhhxgwouti.supabase.co/rest/v1/mahlzeit_nutzung';
// Der öffentliche Schlüssel des Projekts (darf in die Seite; er erlaubt nur, was die Regeln der Tabelle zulassen).
const OEFFENTLICH = 'sb_publishable_wTUNShIKMFjCOmZzQuuN-A_vFHPkKUI';
const GERAET = 'mahlzeit.geraet.v1';
const ZULETZT = 'mahlzeit.lebenszeichen.v1';
export const ABSTAND = 3 * 3600 * 1000;

/** Die Zahlen eines Tages – nur Anzahlen. */
export function zahlen(stand, tag) {
  const liste = stand.tage?.[tag] || [];
  return {
    essen: Math.min(500, liste.length),
    hafer: Math.min(3, liste.filter((e) => Number.isInteger(e.h)).length),
    sport: Math.min(20, (stand.sport?.log || []).filter((l) => l.tag === tag).length),
    werte: Math.min(100, (stand.werte || []).filter((w) => w.tag === tag).length),
    eigene: Math.min(5000, (stand.eigene || []).length),
    tage: Math.min(5000, Object.keys(stand.tage || {}).length),
  };
}

export const faellig = (zuletzt, jetzt) => !Number.isFinite(zuletzt) || jetzt - zuletzt >= ABSTAND;

function geraet() {
  let id = localStorage.getItem(GERAET);
  if (!/^[a-z0-9]{8,24}$/.test(id || '')) {
    id = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => (b % 36).toString(36)).join('') + Date.now().toString(36).slice(-4);
    localStorage.setItem(GERAET, id);
  }
  return id;
}

/** Schickt das Lebenszeichen, wenn es dran ist. Wirft nie; ohne Netz eben nicht. */
export async function melden(stand, { tag, fassung, alsApp, jetzt = Date.now(), holen = (...a) => fetch(...a) } = {}) {
  try {
    if (stand.meldung === false) return false;
    const zuletzt = Number(localStorage.getItem(ZULETZT));
    if (!faellig(zuletzt, jetzt)) return false;
    localStorage.setItem(ZULETZT, String(jetzt));
    const res = await holen(ADRESSE, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: OEFFENTLICH, Prefer: 'return=minimal' },
      body: JSON.stringify({ geraet: geraet(), tag, fassung, als_app: !!alsApp, ...zahlen(stand, tag) }),
      keepalive: true,
    });
    if (!res.ok) localStorage.removeItem(ZULETZT);
    return res.ok;
  } catch {
    try { localStorage.removeItem(ZULETZT); } catch { /* egal */ }
    return false;
  }
}
