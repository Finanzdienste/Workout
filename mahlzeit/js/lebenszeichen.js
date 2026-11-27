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
 *
 * Seit v14 auf Wunsch auch das Essen (essenMelden) – Tobi, 26.11.2026: „Ja
 * ich will das essen auch sehen. In meiner Master übersicht“. Weil bis v13
 * in der App stand „Was du isst, geht nicht mit“, fragt die App Uwe einmal
 * („Darf Tobi auch sehen, was du isst?“); erst nach „Ja“ (stand.essenTeilen
 * === true) geht etwas weg. Ziel ist mahlzeit_essen über mahlzeit_essen_melden
 * (mahlzeit/supabase/essen.sql), wieder 60 Tage je Gerät ersetzt. Steht es
 * auf „aus“ (oder das Lebenszeichen ganz), schickt die App einmal eine leere
 * Liste: Dann ist bei Tobi auch nichts mehr davon.
 */

export const ADRESSE = 'https://vjyohppohmvhhxgwouti.supabase.co/rest/v1/mahlzeit_nutzung';
// Der öffentliche Schlüssel des Projekts (darf in die Seite; er erlaubt nur, was die Regeln der Tabelle zulassen).
const OEFFENTLICH = 'sb_publishable_wTUNShIKMFjCOmZzQuuN-A_vFHPkKUI';
const GERAET_ALT = 'mahlzeit.geraet.v1';
const GERAET = 'mahlzeit.geraet.v2';
const ZULETZT = 'mahlzeit.lebenszeichen.v1';
export const ABSTAND = 3 * 3600 * 1000;

/*
 * Nur echte Handys melden (v15). Tobi, 26.11.2026, beim Blick in „Meine Apps“:
 * „Was sind das eigentlich für weitere Geräte?“ – vier davon waren Testläufe
 * von Claude-Sitzungen (Browser unter Fernsteuerung oder ein Testserver auf
 * dem eigenen Rechner). Darum: kein Lebenszeichen, keine Werte, kein Essen,
 * wenn der Browser ferngesteuert ist (navigator.webdriver) oder die App nicht
 * von GitHub Pages kommt. Die Tests schalten es mit __mz_lz_test bewusst ein.
 */
export function echtesGeraet() {
  try {
    if (localStorage.getItem('__mz_lz_test') === '1') return true;
  } catch { /* egal */ }
  return typeof navigator !== 'undefined' && !navigator.webdriver && typeof location !== 'undefined' && /(^|\.)github\.io$/.test(location.hostname);
}

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
  if (!/^[a-z0-9]{12,24}$/.test(id || '')) {
    const zeichen = 'abcdefghijkmnpqrstuvwxyz23456789';
    id = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => zeichen[b % zeichen.length]).join('');
    localStorage.setItem(GERAET, id);
  }
  return id;
}

/*
 * Der Wechsel auf eine neue Kennung (v19). Die Kennung ist der einzige
 * Ausweis des Handys beim Server, und die von Uwes Handy stand seit v13 in
 * den Notizen eines öffentlichen Repos – wer sie kannte, hätte überschreiben
 * können, was bei Tobi ankommt. Tobi, 27.11.2026, auf die Frage, ob die
 * Angaben aus den Notizen sollen und Uwes App eine neue Kennung bekommt: „Jo“.
 *
 * Ein Handy mit alter Kennung (mahlzeit.geraet.v1) würfelt eine neue und
 * meldet dem Server den Wechsel – mit den Kennungen seiner Werte als Beweis,
 * die kennt sonst nur die Datenbank (mahlzeit_geraet_wechseln; es zählen nur
 * Werte, die dort schon vor dem 27.11. lagen). Dann zieht dort alles um, auch
 * der Name in Tobis Übersicht. Bis der Server geantwortet
 * hat, geht nichts hinaus (ohne Netz also später); danach ist die alte
 * Kennung auf dem Handy gelöscht. Neue Handys haben gleich die neue Art.
 */
export const WECHSEL_ADRESSE = 'https://vjyohppohmvhhxgwouti.supabase.co/rest/v1/rpc/mahlzeit_geraet_wechseln';

/** Ist die Kennung geklärt? false heißt: jetzt nichts schicken, später noch einmal. Wirft nie. */
export async function geraetBereit(stand, { holen = (...a) => fetch(...a) } = {}) {
  try {
    if (!echtesGeraet()) return true;
    // Abgeschaltet geht ohnehin nichts hinaus – der Wechsel wartet, bis es wieder an ist.
    if (stand.meldung === false) return true;
    const alt = localStorage.getItem(GERAET_ALT);
    if (!alt) return true;
    if (!/^[a-z0-9]{8,24}$/.test(alt)) { localStorage.removeItem(GERAET_ALT); return true; }
    const neu = geraet();
    const res = await holen(WECHSEL_ADRESSE, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: OEFFENTLICH },
      body: JSON.stringify({ p_alt: alt, p_neu: neu, p_beweis: (stand.werte || []).slice(-600).map((w) => String(w.id)) }),
    });
    if (!res.ok) return false;
    // Ob umgezogen oder nicht (der Server kannte die alte Kennung nicht): Werte
    // und Essen gehen gleich einmal ganz unter der neuen Kennung hinaus – dann
    // steht bei Tobi sicher, was auf dem Handy steht.
    localStorage.removeItem(WERTE_ZULETZT);
    localStorage.removeItem(ESSEN_ZULETZT);
    localStorage.removeItem(GERAET_ALT);
    return true;
  } catch {
    return false;
  }
}

/** Schickt das Lebenszeichen, wenn es dran ist. Wirft nie; ohne Netz eben nicht. */
export async function melden(stand, { tag, fassung, alsApp, jetzt = Date.now(), holen = (...a) => fetch(...a) } = {}) {
  try {
    if (!echtesGeraet()) return false;
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
    if (!echtesGeraet()) return false;
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

// --- Das Essen (v14), nur nach Uwes „Ja“ ----------------------------------------

export const ESSEN_ADRESSE = 'https://vjyohppohmvhhxgwouti.supabase.co/rest/v1/rpc/mahlzeit_essen_melden';
const ESSEN_ZULETZT = 'mahlzeit.essengemeldet.v1';
const ESSEN_WEG = 'weg';
/** So weit zurück löscht „aus“ beim Server (die Funktion nimmt höchstens 400 Tage). */
const ESSEN_LOESCHEN_TAGE = 399;

/** Die Einträge ab einem Tag, so wie sie gehen: was, wie viel, Kalorien – für den ganzen Eintrag. */
export function essenFuerTobi(stand, von) {
  const aus = [];
  Object.keys(stand.tage || {}).filter((t) => t >= von).sort().forEach((tag) => {
    (stand.tage[tag] || []).forEach((e, i) => {
      if (!e || typeof e.n !== 'string') return;
      const m = Number.isFinite(e.m) && e.m > 0 ? e.m : 1;
      aus.push({
        id: String(e.id || `${tag}-${i}`), tag, name: e.n.slice(0, 120),
        ...(e.z ? { zeit: e.z } : {}), ...(e.p ? { portion: String(e.p).slice(0, 60) } : {}), menge: m,
        kcal: Math.round((e.kcal || 0) * m), kh: Math.round((e.kh || 0) * m), ei: Math.round((e.ei || 0) * m),
        hafer: Number.isInteger(e.h),
      });
    });
  });
  return aus.slice(-3000);
}

/**
 * Schickt das Essen, wenn Uwe zugestimmt hat und sich etwas geändert hat. Ist
 * es aus und war vorher etwas geschickt, einmal die leere Liste: löschen.
 * Wirft nie; ohne Netz bleibt alles, wie es war, und beim nächsten Mal geht es.
 */
export async function essenMelden(stand, { tag, holen = (...a) => fetch(...a) } = {}) {
  try {
    if (!echtesGeraet()) return false;
    const an = stand.meldung !== false && stand.essenTeilen === true;
    const zuletzt = localStorage.getItem(ESSEN_ZULETZT);
    let von;
    let essen;
    let fingerabdruck;
    if (an) {
      von = plusTage(tag, -WERTE_TAGE);
      essen = essenFuerTobi(stand, von);
      fingerabdruck = `${von}|${JSON.stringify(essen)}`;
      if (zuletzt === fingerabdruck) return false;
    } else {
      if (zuletzt === null || zuletzt === ESSEN_WEG) return false;
      von = plusTage(tag, -ESSEN_LOESCHEN_TAGE);
      essen = [];
      fingerabdruck = ESSEN_WEG;
    }
    const body = JSON.stringify({ p_geraet: geraet(), p_von: von, p_essen: essen });
    const res = await holen(ESSEN_ADRESSE, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: OEFFENTLICH },
      body,
      // Chrome nimmt mit keepalive höchstens 64 KiB an – 60 Tage Essen können
      // mehr sein. Dann eben ohne: Kommt es beim Weglegen nicht an, geht es
      // beim nächsten Öffnen.
      keepalive: body.length < 60000,
    });
    if (res.ok) localStorage.setItem(ESSEN_ZULETZT, fingerabdruck);
    return res.ok;
  } catch {
    return false;
  }
}
