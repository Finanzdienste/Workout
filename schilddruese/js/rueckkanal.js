/*
 * Der Rückkanal (Nov. 2026) – ein Lebenszeichen, keine Gesundheitsdaten.
 *
 * Tobi hat die App für seine Mutter gebaut und will sehen, ob sie bei ihr
 * läuft: ob sie auf dem Startbildschirm liegt, ob sie geöffnet wird und ob es
 * die neue Fassung ist. Von innen lässt sich das nicht beantworten. Dafür
 * meldet die App einmal am Tag beim Öffnen genau diese Felder (FELDER):
 *
 *   id               eine Zufallsnummer dieses Geräts (UUID) – kein Name
 *   fassung          die Fassung der App (VERSION aus sw.js = APP_FASSUNG)
 *   startbildschirm  läuft sie als Symbol vom Startbildschirm?
 *   plattform        ios | android | andere
 *   einfuehrung      wurde das Begrüßungsfenster schon angezeigt?
 *   erstmals         der Tag der ersten Meldung, ohne Uhrzeit
 *   zuletzt          der heutige Tag, ohne Uhrzeit
 *
 * Nichts über Werte, Einträge, Tabletten, Befinden, Name oder Anrede. Diese
 * Datei bekommt den Stand gar nicht zu sehen: js/app.js reicht nur drei
 * Wahrheitswerte herein (an, eingerichtet, einfuehrung). Die Meldung wird aus
 * den sieben Feldern gebaut, nicht aus dem Stand mit etwas weggelassen – was
 * neu in den Stand kommt, geht so nie von selbst mit. Auch sd_melde() auf dem
 * Server nimmt nur genau diese Felder an (tools/schilddruese-rueckkanal.sql);
 * die Zahl der Tage mit Öffnen zählt er selbst.
 *
 * Drei Regeln, aus der Workout-App übernommen (README dort, „Rückkanal"):
 *
 *   Sichtbar.    Der Satz dazu steht auf der letzten Seite des
 *                Begrüßungsfensters und unter „Mehr → Über diese App", jeweils
 *                mit dem Schalter (js/ansicht-begruessung.js). Solange das
 *                Fenster offen ist, wartet die Meldung (js/app.js) – und
 *                überhaupt, bis der Satz zu sehen war: Wer das Fenster vorher
 *                schließt oder es nie bekam, liest auf „Heute" eine kleine
 *                Karte dazu; erst nach „Verstanden" geht etwas raus.
 *   Abschaltbar. Aus heißt: Es geht nichts mehr raus, und die eigene Zeile auf
 *                dem Server wird gelöscht (sd_entferne). Ohne Netz wird das
 *                Löschen beim nächsten Öffnen nachgeholt.
 *   Kein Test.   Von einer lokalen Adresse geht nie etwas raus. Die
 *                Workout-App zählte so rund 1000 erfundene Geräte, weil jeder
 *                Testlauf mit leerem Speicher als neues Gerät meldete.
 *                tests/test-sd-rueckkanal.mjs schaltet es ausdrücklich frei
 *                und fängt fetch ab.
 *
 * Was die App dafür auf dem Gerät behält (Kennung, erster Tag, Tag der letzten
 * Meldung, offene Löschungen), steht in einem eigenen Schlüssel (MERK), nicht
 * im Stand: Es gehört zu diesem Gerät und nicht in die Sicherung – sonst wären
 * altes und neues Handy nach dem Umzug dasselbe Gerät. Nur der Schalter steht
 * im Stand (einstellungen.rueckkanal) und geht mit der Sicherung mit.
 *
 * schilddruese/uebersicht.js lädt diese Datei für Adresse und Aufruf mit –
 * deshalb hängt sie an nichts außer js/datum.js.
 */
import { heuteISO, istISO } from './datum.js';

/** Wem die Meldung gilt – steht so im Satz dazu. */
export const BETREIBER = 'Tobi';

/*
 * Die Fassung der App, die gemeldet wird – dieselbe wie VERSION in sw.js,
 * beide zusammen hochzählen (tests/test-sd-rueckkanal.mjs vergleicht sie).
 * Eine Konstante statt einer Frage an den Service Worker: Sie kommt aus
 * demselben Vorrat wie der übrige Code, nennt also genau die Fassung, die
 * gerade läuft – auch ohne Worker und ohne Warten auf seine Antwort.
 */
export const APP_FASSUNG = 'v17';

/*
 * Das Supabase-Projekt der Workout-App (dort js/config.js). Adresse und
 * Schlüssel dürfen öffentlich sein: Mit dem SQL aus
 * tools/schilddruese-rueckkanal.sql kommt man damit an genau drei Funktionen
 * – melden, die eigene Zeile löschen und die Übersicht, und die will ein
 * Passwort. Auf die Tabelle selbst führt kein Weg.
 */
export const SERVER = {
  url: 'https://vjyohppohmvhhxgwouti.supabase.co',
  key: 'sb_publishable_wTUNShIKMFjCOmZzQuuN-A_vFHPkKUI',
};

/** Genau diese Felder gehen raus – nicht mehr. */
export const FELDER = ['id', 'fassung', 'startbildschirm', 'plattform', 'einfuehrung', 'erstmals', 'zuletzt'];

/** Was dieses Gerät sich für den Rückkanal merkt (siehe oben). */
export const MERK = 'schilddruese.rueckkanal.v1';

/** Die Freigabe für Tests auf einer lokalen Adresse – wie 'workout.rueckkanal.lokal'. */
export const FREIGABE = 'schilddruese.rueckkanal.lokal';

/** Läuft diese Seite von einer lokalen Adresse? Leer ist file://. Wie lokaleAdresse() in js/config.js der Workout-App. */
export function lokaleAdresse() {
  try {
    const h = location.hostname;
    return h === '' || h === 'localhost' || h === '127.0.0.1' || h === '[::1]'
      || h === '::1' || h.endsWith('.local');
  } catch {
    return false;
  }
}

/** Darf von hier überhaupt etwas zum Server? Von einer lokalen Adresse nur mit Freigabe. */
export function sendenErlaubt() {
  if (!lokaleAdresse()) return true;
  try {
    return localStorage.getItem(FREIGABE) === '1';
  } catch {
    return false;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Eine zufällige Kennung (UUID v4) – ohne Bezug zu irgendetwas anderem. */
export function neueKennung() {
  if (crypto.randomUUID) return crypto.randomUUID();
  // Ohne randomUUID (ältere Browser) trotzdem echter Zufall, wie in der Workout-App.
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/*
 * Der Merkzettel: { id, erstmals, gemeldet, loeschen: [Kennungen] }.
 * null heißt: Der Speicher ist nicht lesbar – dann wird nicht gemeldet. Ohne
 * gemerkte Kennung käme bei jedem Öffnen eine neue, und die Übersicht zeigte
 * jeden Tag ein Gerät mehr, das es nicht gibt.
 */
function merkLesen() {
  let roh;
  try {
    roh = localStorage.getItem(MERK);
  } catch {
    return null;
  }
  let m = null;
  try {
    m = JSON.parse(roh || 'null');
  } catch { /* kaputt – dann wie neu */ }
  if (!m || typeof m !== 'object') m = {};
  const id = typeof m.id === 'string' && UUID.test(m.id) ? m.id : null;
  return {
    id,
    erstmals: id && istISO(m.erstmals) ? m.erstmals : null,
    gemeldet: id && istISO(m.gemeldet) ? m.gemeldet : null,
    loeschen: Array.isArray(m.loeschen)
      ? [...new Set(m.loeschen.filter((x) => typeof x === 'string' && UUID.test(x)))].slice(-10)
      : [],
  };
}

function merkSchreiben(m) {
  try {
    const text = JSON.stringify(m);
    localStorage.setItem(MERK, text);
    return localStorage.getItem(MERK) === text;
  } catch {
    return false;
  }
}

/** Grob die Plattform: ios | android | andere. Ein iPad meldet sich als Mac – mit Touch ist es keiner. */
export function plattform(nav = navigator) {
  const ua = String((nav && nav.userAgent) || '');
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'andere';
}

/** Läuft die App als Symbol vom Startbildschirm? navigator.standalone kennt nur Safari auf dem iPhone. */
export function vomStartbildschirm() {
  try {
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
  } catch { /* dann eben nur die Frage an Safari */ }
  return navigator.standalone === true;
}

/** Die Meldung – genau FELDER, aus `einfuehrung` (Wahrheitswert) und dem Merkzettel. */
export function meldungBauen(einfuehrung, merk, heute) {
  return {
    id: merk.id,
    fassung: APP_FASSUNG,
    startbildschirm: vomStartbildschirm(),
    plattform: plattform(),
    einfuehrung: einfuehrung === true,
    erstmals: merk.erstmals,
    zuletzt: heute,
  };
}

/*
 * Ein Aufruf einer Datenbankfunktion. Zehn Sekunden, dann ist gut – ohne
 * Schranke bliebe die Anfrage bei einem Server, der die Verbindung offen
 * lässt, für immer stehen. Ohne Cookies und ohne Herkunftsangabe: Beides
 * gehört nicht zur Meldung. Der neue Schlüssel (sb_publishable_…) ist kein
 * JWT und gehört deshalb nur in „apikey", nicht in „Authorization".
 */
export async function rpc(name, params) {
  const abbruch = new AbortController();
  const uhr = setTimeout(() => abbruch.abort(), 10000);
  try {
    return await fetch(`${SERVER.url}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SERVER.key },
      body: JSON.stringify(params),
      signal: abbruch.signal,
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
  } finally {
    clearTimeout(uhr);
  }
}

let laufend = null;     // die Meldung, die gerade unterwegs ist
let versuchtAm = null;  // an diesem Tag in dieser Sitzung schon versucht

/*
 * Nach einem Fehlschlag (kein Netz, Server weg) nicht jede Minute neu
 * versuchen, sondern erst beim nächsten Öffnen: wenn die App wieder nach vorn
 * kommt oder der Browser „online" meldet (js/app.js).
 */
export function nochmalVersuchen() {
  versuchtAm = null;
}

/**
 * Einmal am Tag melden. `lage`: { an, eingerichtet, einfuehrung } – drei
 * Wahrheitswerte aus dem Stand, mehr bekommt diese Datei nicht.
 * → Promise<{ ok, grund }>. Fehler sind hier keine Fehler: Die App ist ohne
 * den Server vollständig und merkt davon nichts.
 */
export function melden(lage, heute = heuteISO()) {
  const nicht = (grund) => Promise.resolve({ ok: false, grund });
  if (!lage || lage.an !== true) return nicht('aus');
  if (lage.eingerichtet !== true) return nicht('nicht eingerichtet');
  if (!sendenErlaubt()) return nicht('lokal');
  if (laufend) return laufend;
  if (versuchtAm === heute) return nicht('heute schon versucht');
  const merk = merkLesen();
  if (!merk) return nicht('kein Speicher');
  if (merk.gemeldet === heute) return nicht('heute schon gemeldet');
  if (!merk.id) {
    merk.id = neueKennung();
    merk.erstmals = heute;
    merk.gemeldet = null;
  }
  if (!merk.erstmals || merk.erstmals > heute) merk.erstmals = heute;
  // Erst merken, dann senden – siehe merkLesen().
  if (!merkSchreiben(merk)) return nicht('kein Speicher');
  versuchtAm = heute;
  const zeile = meldungBauen(lage.einfuehrung === true, merk, heute);
  laufend = (async () => {
    try {
      const res = await rpc('sd_melde', { zeile });
      if (!res.ok) return { ok: false, grund: `Fehler ${res.status}` };
      // Inzwischen ausgeschaltet (auch in einem anderen Fenster): Dann gehört
      // die Kennung nicht mehr zu diesem Gerät und wird nicht wieder vermerkt.
      const jetzt = merkLesen();
      if (jetzt && jetzt.id === zeile.id) {
        jetzt.gemeldet = heute;
        merkSchreiben(jetzt);
      }
      return { ok: true, grund: '' };
    } catch {
      return { ok: false, grund: 'keine Verbindung' };
    } finally {
      laufend = null;
    }
  })();
  return laufend;
}

/**
 * Aus: die Kennung vergessen und die eigene Zeile auf dem Server löschen.
 * Eingeschaltet bekäme die nächste Meldung eine neue Kennung – nichts
 * verbindet sie mit der alten. Auch für „Alles löschen".
 * → Promise<{ ok, zeilen, offen }> – offen: Das Löschen wartet auf Netz.
 */
export async function abschalten() {
  // Eine Meldung, die gerade unterwegs ist, erst ankommen lassen – sonst
  // schriebe sie die Zeile gleich nach dem Löschen wieder hin.
  if (laufend) await laufend;
  const merk = merkLesen();
  if (merk && merk.id) {
    merkSchreiben({ id: null, erstmals: null, gemeldet: null, loeschen: [...merk.loeschen, merk.id] });
  }
  return loeschenNachholen();
}

/**
 * Offene Löschungen nachholen – beim Abschalten und bei jedem Öffnen.
 * Gelöscht ist erst, was der Server mit seiner Antwort bestätigt hat.
 */
export async function loeschenNachholen() {
  const merk = merkLesen();
  if (!merk || !merk.loeschen.length) return { ok: true, zeilen: 0, offen: false };
  if (!sendenErlaubt()) return { ok: false, zeilen: 0, offen: true };
  let zeilen = 0;
  const erledigt = [];
  for (const geraet of merk.loeschen) {
    try {
      const res = await rpc('sd_entferne', { geraet });
      if (!res.ok) continue;
      const zahl = Number((await res.text()).trim());
      if (Number.isFinite(zahl)) zeilen += zahl;
      erledigt.push(geraet);
    } catch { /* kein Netz – beim nächsten Öffnen */ }
  }
  // Neu gelesen: Ein anderes Fenster kann inzwischen etwas dazugelegt haben.
  const jetzt = merkLesen() || merk;
  jetzt.loeschen = jetzt.loeschen.filter((x) => !erledigt.includes(x));
  merkSchreiben(jetzt);
  return { ok: !jetzt.loeschen.length, zeilen, offen: jetzt.loeschen.length > 0 };
}

/** Für die Anzeige neben dem Schalter: { lokal, gemeldet (ISO-Tag | null), loeschenOffen }. */
export function zustand() {
  const merk = merkLesen();
  return {
    lokal: !sendenErlaubt(),
    gemeldet: merk ? merk.gemeldet : null,
    loeschenOffen: Boolean(merk && merk.loeschen.length),
  };
}
