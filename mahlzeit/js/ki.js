/*
 * Die KI: Rezepte (Text oder Foto), Nährwerttabellen und Strichcode-Fotos
 * auswerten – über die Supabase-Funktion mahlzeit-ki
 * (supabase/functions/mahlzeit-ki). Der Anthropic-Schlüssel bleibt dort;
 * die App schickt nur ihren Freischalt-Code mit (Kopf x-zugang).
 *
 * Der Code kommt mit dem Link („…/mahlzeit/#ki=ABCDE-FGHJK") oder wird
 * unter „Mehr" eingetragen. Er liegt in einem eigenen Schlüssel – nicht im
 * Stand, damit er nicht in jeder Sicherung steckt.
 */

/*
 * Schalter (v8): Solange Tobi kein Anthropic-Guthaben hat, ist die KI aus –
 * kein Knopf „Rezept oder Foto“, kein Freischalten, kein Strichcode-Foto.
 * Tobi, 19.11.2026: „Der Kollege testet die app jetzt. Es muss also alles
 * außer die ki optimal sein. Lass den ki Teil rausnehmen solange ich kein
 * api hab“. Ein Code aus dem Link wird trotzdem still gemerkt, damit es
 * später ohne neuen Link geht. Wieder an: true, VERSION/FASSUNG hochzählen.
 */
export const KI_AN = false;

export const KI_ADRESSE = 'https://vjyohppohmvhhxgwouti.supabase.co/functions/v1/mahlzeit-ki';
const SCHLUESSEL = 'mahlzeit.ki.v1';
const ZEICHEN = /^[A-HJ-NP-Z2-9]{10}$/;

/** „abcde fghjk" → „ABCDE-FGHJK", sonst null. Ohne 0/O und 1/I – die verwechselt man. */
export function codeOrdnen(text) {
  const c = String(text || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return ZEICHEN.test(c) ? `${c.slice(0, 5)}-${c.slice(5)}` : null;
}

/** Der Code aus „#ki=ABCDE-FGHJK" (auch zwischen anderen Angaben im Hash) oder null. */
export function codeAusAdresse(hash) {
  const m = String(hash || '').match(/(?:^#|&)ki=([^&]+)/);
  return m ? codeOrdnen(decodeURIComponent(m[1])) : null;
}

export function kiCode() {
  try {
    const roh = JSON.parse(localStorage.getItem(SCHLUESSEL) || 'null');
    return codeOrdnen(roh?.code);
  } catch {
    return null;
  }
}

export function kiCodeSetzen(code) {
  localStorage.setItem(SCHLUESSEL, JSON.stringify({ code }));
}

export function kiCodeWeg() {
  localStorage.removeItem(SCHLUESSEL);
}

/** Ein Fehler mit einem Satz, den man dem Nutzer zeigen kann. */
function fehler(text, status = 0) {
  const e = new Error(text);
  e.status = status;
  return e;
}

/**
 * An die Funktion schicken. Gibt die Antwort (JSON) zurück oder wirft mit
 * einem lesbaren Satz. Eine Auswertung dauert meist 10 bis 40 Sekunden.
 */
export async function kiFragen(rumpf, { code = kiCode(), holen = (...a) => fetch(...a), warten = 120000 } = {}) {
  if (!code) throw fehler('Die KI ist noch nicht freigeschaltet.', 401);
  const abbruch = new AbortController();
  const uhr = setTimeout(() => abbruch.abort(), warten);
  let res;
  try {
    res = await holen(KI_ADRESSE, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-zugang': code },
      body: JSON.stringify(rumpf),
      signal: abbruch.signal,
    });
  } catch {
    throw fehler(abbruch.signal.aborted ? 'Die KI hat zu lange gebraucht. Bitte noch einmal versuchen.' : 'Keine Verbindung. Ist das Handy online?');
  } finally {
    clearTimeout(uhr);
  }
  let daten = null;
  try { daten = await res.json(); } catch { /* keine JSON-Antwort */ }
  if (!res.ok) throw fehler(daten?.fehler || `Die KI hat nicht geantwortet (Fehler ${res.status}).`, res.status);
  return daten;
}

/** Prüft einen Code, ohne etwas auszuwerten (kostet nichts). */
export async function codePruefen(code, optionen = {}) {
  await kiFragen({ art: 'pruefen' }, { ...optionen, code });
  return true;
}

// --- Fotos -----------------------------------------------------------------

const blobZuB64 = (blob) => new Promise((ok, nein) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).split(',')[1] || '');
  r.onerror = () => nein(r.error);
  r.readAsDataURL(blob);
});

async function bildLaden(datei) {
  const zuBitmap = globalThis.createImageBitmap;
  if (typeof zuBitmap === 'function') {
    try { return await zuBitmap(datei); } catch { /* weiter mit <img> */ }
  }
  const url = URL.createObjectURL(datei);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Verkleinern (lange Kante höchstens 1600 px – eine Kochbuchseite muss lesbar
 * bleiben) und als JPEG. Gibt { typ, daten (base64), url (Vorschau) } zurück.
 */
export async function fotoVorbereiten(datei, kante = 1600) {
  const bild = await bildLaden(datei);
  const b = bild.width || bild.naturalWidth;
  const h = bild.height || bild.naturalHeight;
  const s = Math.min(1, kante / Math.max(b, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(b * s));
  c.height = Math.max(1, Math.round(h * s));
  c.getContext('2d').drawImage(bild, 0, 0, c.width, c.height);
  if (typeof bild.close === 'function') bild.close();
  const blob = await new Promise((ok) => { c.toBlob(ok, 'image/jpeg', 0.85); });
  if (!blob) throw new Error('Das Foto ließ sich nicht lesen.');
  return { typ: 'image/jpeg', daten: await blobZuB64(blob), url: URL.createObjectURL(blob) };
}
