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
 *
 * Seit v13 auch die Werte selbst (werteMelden): Gewicht, Blutzucker, HbA1c,
 * Schlaf und Schritte der letzten 60 Tage, mit Datum – Tobi, 25.11.2026:
 * „Mach Variante 2“, Uwe ist einverstanden („Uwe meinte ich kann all seine
 * gesundheitsdaten haben“, 21.11.). Was er isst, geht weiter nicht mit. Ziel
 * ist mahlzeit_werte über die Funktion mahlzeit_werte_melden, die die 60 Tage
 * je Gerät ersetzt – so kommen auch Löschungen an. Geschickt wird nur, wenn
 * sich etwas geändert hat; derselbe Schalter stellt beides ab.
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

// --- Die Werte selbst (v13) ---------------------------------------------------

export const WERTE_ADRESSE = 'https://vjyohppohmvhhxgwouti.supabase.co/rest/v1/rpc/mahlzeit_werte_melden';
const WERTE_ZULETZT = 'mahlzeit.wertegemeldet.v1';
export const WERTE_TAGE = 60;

/** Die Werte ab einem Tag, so wie sie gehen – ohne alles andere aus dem Stand. */
export function werteFuerTobi(stand, von) {
  return (stand.werte || []).filter((w) => w.tag >= von).slice(-600).map((w) => ({
    id: String(w.id), art: w.art, tag: w.tag, wert: w.wert,
    ...(w.uhr ? { uhr: w.uhr } : {}), ...(w.wann ? { wann: w.wann } : {}), ...(w.quelle ? { quelle: w.quelle } : {}),
  }));
}

function plusTage(tag, n) {
  const d = new Date(`${tag}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Schickt die Werte, wenn sie sich seit dem letzten Mal geändert haben. Wirft nie. */
export async function werteMelden(stand, { tag, holen = (...a) => fetch(...a) } = {}) {
  try {
    if (stand.meldung === false) return false;
    const von = plusTage(tag, -WERTE_TAGE);
    const werte = werteFuerTobi(stand, von);
    const fingerabdruck = `${von}|${JSON.stringify(werte)}`;
    if (localStorage.getItem(WERTE_ZULETZT) === fingerabdruck) return false;
    const res = await holen(WERTE_ADRESSE, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: OEFFENTLICH },
      body: JSON.stringify({ p_geraet: geraet(), p_von: von, p_werte: werte }),
      keepalive: true,
    });
    if (res.ok) localStorage.setItem(WERTE_ZULETZT, fingerabdruck);
    return res.ok;
  } catch {
    return false;
  }
}
