/*
 * Strichcodes: prüfen, bei Open Food Facts nachschlagen, mit der Kamera lesen.
 *
 * Tobi, 17.11.2026: „und barcode scanner". Was auf einer Packung steht, weiß
 * Open Food Facts – eine freie Datenbank, ohne Schlüssel, ohne Konto. Dorthin
 * geht nur die Nummer.
 *
 * Lesen kann das Handy selbst nur, wo der Browser es kann (BarcodeDetector:
 * Chrome auf Android). Auf dem iPhone fotografiert man den Strichcode, und die
 * KI liest die Ziffern ab – wie in Boxenstopp (js/scanner.js) –, oder man
 * tippt die Nummer unter den Strichen ein.
 *
 * Alles bis auf liveLesen() ist ohne Seite prüfbar (tests/test-mz-rechnen.mjs).
 */

/** Prüfziffer von EAN-8, UPC-A (12), EAN-13 und GTIN-14. */
export function eanOk(code) {
  const c = String(code || '');
  if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(c)) return false;
  const ziffern = c.split('').map(Number);
  const pruef = ziffern.pop();
  const summe = ziffern.reverse().reduce((s, z, i) => s + z * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (summe % 10)) % 10 === pruef;
}

/** Nur die Ziffern; UPC-A (12) wie EAN-13 mit führender 0, so steht es in der Datenbank. */
export function eanOrdnen(text) {
  const c = String(text || '').replace(/\D/g, '');
  return c.length === 12 ? `0${c}` : c;
}

export const OFF = 'https://world.openfoodfacts.org';
const FELDER = 'code,product_name,product_name_de,generic_name_de,brands,quantity,serving_size,serving_quantity,nutriments';
export const offAdresse = (code) => `${OFF}/api/v2/product/${code}.json?fields=${FELDER}`;

const n = (x) => (x === '' || x === null || x === undefined ? NaN : Number(x));

/**
 * Was die App aus einem Treffer braucht – oder null, wenn die Nummer
 * unbekannt ist. Ohne Kalorien: ohneWerte, dann fragt die App weiter.
 */
export function produktAusOff(json, code) {
  const p = json && json.status === 1 ? json.product : null;
  if (!p) return null;
  const nu = p.nutriments || {};
  let kcal100 = n(nu['energy-kcal_100g']);
  if (!Number.isFinite(kcal100)) {
    const kj = n(nu['energy-kj_100g']);
    const energie = n(nu.energy_100g);   // in kJ
    kcal100 = Number.isFinite(kj) ? kj / 4.184 : Number.isFinite(energie) ? energie / 4.184 : NaN;
  }
  const kh100 = n(nu.carbohydrates_100g);
  const name = String(p.product_name_de || p.product_name || p.generic_name_de || '').trim();
  const marke = String(p.brands || '').split(',')[0].trim();
  const portionGramm = n(p.serving_quantity);
  const gut = Number.isFinite(kcal100) && kcal100 >= 0 && kcal100 <= 950;
  return {
    ean: code,
    name: name || marke || `Produkt ${code}`,
    marke,
    menge: String(p.quantity || '').trim(),
    portionText: String(p.serving_size || '').trim(),
    portionGramm: Number.isFinite(portionGramm) && portionGramm >= 5 && portionGramm <= 1000 ? Math.round(portionGramm) : 0,
    kcal100: gut ? Math.round(kcal100) : null,
    kh100: Number.isFinite(kh100) && kh100 >= 0 && kh100 <= 100 ? Math.round(kh100 * 10) / 10 : 0,
    ohneWerte: !gut,
  };
}

/** Aus einem Produkt eine eigene Sache für die App: je Portion, wenn die Packung eine nennt, sonst je 100 g. */
export function sacheAusProdukt(p, id) {
  const name = p.marke && !p.name.toLowerCase().includes(p.marke.toLowerCase()) ? `${p.name} (${p.marke})` : p.name;
  const g = p.portionGramm || 100;
  const text = p.portionGramm
    ? (p.portionText && p.portionText.length <= 30 && /\d/.test(p.portionText) ? `1 Portion: ${p.portionText}` : `1 Portion (${g} g)`)
    : '100 g';
  return {
    id,
    n: name.slice(0, 60),
    p: text,
    g,
    kcal: Math.round((p.kcal100 * g) / 100),
    kh: Math.round((p.kh100 * g) / 100),
    kcal100: p.kcal100,
    kh100: p.kh100,
    ean: p.ean,
    quelle: 'off',
  };
}

/**
 * Nachschlagen. Gibt das Produkt zurück, null bei unbekannter Nummer, und
 * wirft ohne Netz. `holen` ist fetch – die Tests geben ihr eigenes.
 */
export async function nachschlagen(code, { holen = (...a) => fetch(...a), signal } = {}) {
  const res = await holen(offAdresse(code), { signal });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Open Food Facts: HTTP ${res.status}`);
  return produktAusOff(await res.json(), code);
}

// --- Kamera ----------------------------------------------------------------

export const kannLive = () => typeof window !== 'undefined' && 'BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia;

/**
 * Die Kamera im Bild `video` an und im Takt nach Strichcodes suchen. Ruft
 * `gefunden(code)` mit der ersten gültigen Nummer und hört dann auf. Gibt
 * eine Funktion zurück, die die Kamera ausschaltet.
 */
export async function liveLesen(video, { gefunden, takt = 250 }) {
  let aus = false;
  let uhr = null;
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
  const stopp = () => {
    aus = true;
    clearTimeout(uhr);
    stream.getTracks().forEach((t) => { try { t.stop(); } catch { /* schon aus */ } });
    if (video) video.srcObject = null;
  };
  try {
    video.srcObject = stream;
    await video.play().catch(() => {});
    const wunsch = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];
    const da = (await window.BarcodeDetector.getSupportedFormats?.().catch(() => [])) || [];
    const formate = wunsch.filter((f) => da.includes(f));
    const leser = new window.BarcodeDetector(formate.length ? { formats: formate } : undefined);
    const runde = async () => {
      if (aus) return;
      try {
        const codes = await leser.detect(video);
        const treffer = codes.map((c) => eanOrdnen(c.rawValue)).find(eanOk);
        if (treffer) {
          stopp();
          navigator.vibrate?.(60);
          gefunden(treffer);
          return;
        }
      } catch { /* das Bild ist noch nicht bereit */ }
      uhr = setTimeout(runde, takt);
    };
    runde();
  } catch (e) {
    stopp();
    throw e;
  }
  return stopp;
}
