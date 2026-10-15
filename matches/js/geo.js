/*
 * Entfernungen.
 *
 * Der ehrliche Ausgangspunkt: Keine der drei Apps gibt ihre Entfernungsangabe
 * heraus. Weder Tinder noch Hinge noch Bumble stellen eine Schnittstelle
 * bereit, und in den Datenauskünften (DSGVO-Export) steht zwar, wann ein Match
 * entstanden ist – aber nirgends, wo die andere Person ist. Die „4 km", die im
 * Profil stehen, gibt es nur im Moment des Hinsehens, im Bildschirm der App.
 *
 * Deshalb kennt dieses Modul zwei Wege zu einer Zahl, und die Reihenfolge ist
 * kein Zufall:
 *
 *   1. **Eingetragen.** Was in der App stand, abgetippt. Das ist die genaueste
 *      Angabe, die es überhaupt geben kann – sie kommt aus derselben Quelle,
 *      nach der sortiert werden soll.
 *   2. **Gerechnet.** Aus einem Ort ("Kreuzberg", "Hamburg") werden Koordinaten,
 *      daraus die Luftlinie zum eigenen Standort. Das ist Ortsmitte zu
 *      Ortsmitte, also ein Näherungswert – und in einer Großstadt kann er
 *      danebenliegen, weil beide „Berlin" heißen und trotzdem 30 km trennen.
 *
 * Beides steht in der Tabelle nebeneinander, mit einem Zeichen dahinter, welcher
 * Weg es war. Eine gerechnete Zahl, die aussieht wie eine gemessene, wäre die
 * unangenehmere Form von Genauigkeit.
 */

/** Erdradius in km. Kugel statt Ellipsoid: der Fehler liegt unter 0,5 %. */
const R = 6371;

const bogen = (grad) => (grad * Math.PI) / 180;

/**
 * Luftlinie zwischen zwei Punkten in km (Haversine).
 * Gibt null zurück, sobald eine Koordinate fehlt – nicht 0. Der Unterschied
 * zählt: 0 km hieße „wohnt hier", null heißt „weiß ich nicht", und nur das
 * zweite darf beim Sortieren ans Ende rutschen.
 */
export function luftlinie(a, b) {
  if (!a || !b) return null;
  if (!Number.isFinite(a.lat) || !Number.isFinite(a.lon)) return null;
  if (!Number.isFinite(b.lat) || !Number.isFinite(b.lon)) return null;
  const dLat = bogen(b.lat - a.lat);
  const dLon = bogen(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(bogen(a.lat)) * Math.cos(bogen(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Die Entfernung einer Person zum eigenen Standort.
 * Rückgabe: { km, quelle } mit quelle 'eingetragen' | 'gerechnet' | null.
 */
export function entfernung(person, heim) {
  if (!person) return { km: null, quelle: null };
  if (Number.isFinite(person.km)) return { km: person.km, quelle: 'eingetragen' };
  const km = luftlinie(person, heim);
  if (km === null) return { km: null, quelle: null };
  return { km, quelle: 'gerechnet' };
}

/*
 * Ein kleiner Ortsverzeichnis-Vorrat im Programm selbst.
 *
 * Warum nicht gleich einen Dienst fragen? Weil der häufige Fall „sie wohnt in
 * Leipzig" damit ohne Netz, ohne Wartezeit und vor allem *ohne dass die Namen
 * der Orte das Gerät verlassen* beantwortet ist. Wer eine Liste von Menschen
 * samt Wohnort führt, sollte diese Liste nicht nebenbei an einen fremden Server
 * durchreichen, nur damit eine Zahl in einer Spalte steht.
 *
 * Die Liste ist bewusst kurz: die größeren Städte im deutschsprachigen Raum und
 * die Berliner Bezirke, weil dort der Unterschied zwischen „Spandau" und
 * „Friedrichshain" die eigentliche Frage ist. Alles andere klärt entweder die
 * Ortssuche im Netz (ausdrücklich einzuschalten) oder eine abgetippte Zahl.
 */
const ORTE = [
  ['Berlin', 52.520, 13.405], ['Berlin-Mitte', 52.520, 13.405],
  ['Berlin-Kreuzberg', 52.499, 13.403], ['Berlin-Neukölln', 52.481, 13.435],
  ['Berlin-Friedrichshain', 52.515, 13.454], ['Berlin-Prenzlauer Berg', 52.540, 13.424],
  ['Berlin-Charlottenburg', 52.505, 13.303], ['Berlin-Wedding', 52.550, 13.365],
  ['Berlin-Schöneberg', 52.483, 13.355], ['Berlin-Spandau', 52.535, 13.198],
  ['Berlin-Pankow', 52.569, 13.402], ['Berlin-Steglitz', 52.456, 13.332],
  ['Berlin-Lichtenberg', 52.516, 13.499], ['Berlin-Treptow', 52.494, 13.459],
  ['Berlin-Marzahn', 52.545, 13.567], ['Berlin-Köpenick', 52.445, 13.575],
  ['Berlin-Tempelhof', 52.470, 13.386], ['Berlin-Reinickendorf', 52.583, 13.334],
  ['Berlin-Zehlendorf', 52.434, 13.259], ['Potsdam', 52.396, 13.059],
  ['Hamburg', 53.551, 9.993], ['München', 48.137, 11.575], ['Köln', 50.938, 6.960],
  ['Frankfurt am Main', 50.110, 8.682], ['Stuttgart', 48.776, 9.183],
  ['Düsseldorf', 51.228, 6.773], ['Leipzig', 51.340, 12.375], ['Dortmund', 51.514, 7.466],
  ['Essen', 51.456, 7.012], ['Bremen', 53.079, 8.802], ['Dresden', 51.050, 13.738],
  ['Hannover', 52.376, 9.732], ['Nürnberg', 49.452, 11.077], ['Duisburg', 51.435, 6.763],
  ['Bochum', 51.482, 7.216], ['Wuppertal', 51.256, 7.150], ['Bielefeld', 52.021, 8.532],
  ['Bonn', 50.735, 7.100], ['Münster', 51.961, 7.626], ['Karlsruhe', 49.007, 8.404],
  ['Mannheim', 49.488, 8.469], ['Augsburg', 48.371, 10.898], ['Wiesbaden', 50.083, 8.240],
  ['Mönchengladbach', 51.180, 6.442], ['Gelsenkirchen', 51.517, 7.086],
  ['Braunschweig', 52.269, 10.521], ['Chemnitz', 50.828, 12.921], ['Kiel', 54.323, 10.135],
  ['Aachen', 50.776, 6.084], ['Halle', 51.483, 11.970], ['Magdeburg', 52.121, 11.628],
  ['Freiburg', 47.999, 7.842], ['Krefeld', 51.334, 6.564], ['Lübeck', 53.866, 10.687],
  ['Oberhausen', 51.470, 6.852], ['Erfurt', 50.978, 11.029], ['Mainz', 49.993, 8.247],
  ['Rostock', 54.092, 12.099], ['Kassel', 51.312, 9.480], ['Hagen', 51.361, 7.473],
  ['Saarbrücken', 49.240, 6.997], ['Hamm', 51.680, 7.821],
  ['Ludwigshafen', 49.477, 8.445], ['Mülheim an der Ruhr', 51.427, 6.883],
  ['Oldenburg', 53.144, 8.214], ['Osnabrück', 52.279, 8.047], ['Leverkusen', 51.033, 6.985],
  ['Heidelberg', 49.399, 8.672], ['Solingen', 51.171, 7.084], ['Darmstadt', 49.872, 8.651],
  ['Herne', 51.538, 7.220], ['Neuss', 51.198, 6.692], ['Regensburg', 49.014, 12.102],
  ['Paderborn', 51.719, 8.754], ['Ingolstadt', 48.766, 11.425], ['Würzburg', 49.792, 9.953],
  ['Fürth', 49.478, 10.990], ['Wolfsburg', 52.424, 10.787], ['Offenbach', 50.096, 8.777],
  ['Ulm', 48.401, 9.987], ['Heilbronn', 49.142, 9.211], ['Pforzheim', 48.891, 8.699],
  ['Göttingen', 51.542, 9.916], ['Bottrop', 51.523, 6.923], ['Trier', 49.750, 6.637],
  ['Recklinghausen', 51.614, 7.198], ['Reutlingen', 48.492, 9.204], ['Bremerhaven', 53.540, 8.580],
  ['Koblenz', 50.356, 7.594], ['Bergisch Gladbach', 50.985, 7.133], ['Jena', 50.928, 11.589],
  ['Remscheid', 51.180, 7.190], ['Erlangen', 49.590, 11.005], ['Moers', 51.452, 6.626],
  ['Siegen', 50.874, 8.024], ['Hildesheim', 52.155, 9.951], ['Salzgitter', 52.157, 10.415],
  ['Cottbus', 51.756, 14.334], ['Kaiserslautern', 49.443, 7.769], ['Gütersloh', 51.906, 8.379],
  ['Schwerin', 53.636, 11.401], ['Flensburg', 54.783, 9.434], ['Konstanz', 47.663, 9.175],
  ['Tübingen', 48.520, 9.055], ['Marburg', 50.802, 8.766], ['Gießen', 50.587, 8.678],
  ['Bamberg', 49.892, 10.887], ['Lüneburg', 53.249, 10.414], ['Greifswald', 54.093, 13.387],
  ['Wien', 48.208, 16.373], ['Graz', 47.071, 15.439], ['Linz', 48.306, 14.286],
  ['Salzburg', 47.809, 13.055], ['Innsbruck', 47.269, 11.404], ['Klagenfurt', 46.624, 14.308],
  ['Zürich', 47.377, 8.542], ['Genf', 46.204, 6.143], ['Basel', 47.559, 7.588],
  ['Bern', 46.948, 7.447], ['Lausanne', 46.520, 6.633], ['Luzern', 47.051, 8.306],
  ['St. Gallen', 47.424, 9.377], ['Winterthur', 47.500, 8.724],
  ['Amsterdam', 52.373, 4.892], ['Kopenhagen', 55.677, 12.569], ['Prag', 50.076, 14.438],
  ['Warschau', 52.230, 21.012], ['Paris', 48.857, 2.352], ['London', 51.507, -0.128],
  ['Brüssel', 50.851, 4.352], ['Mailand', 45.464, 9.190], ['Rom', 41.903, 12.496],
  ['Barcelona', 41.385, 2.173], ['Madrid', 40.417, -3.704], ['Lissabon', 38.722, -9.139],
  ['Stockholm', 59.329, 18.069], ['Oslo', 59.914, 10.752], ['Budapest', 47.498, 19.040],
];

/** Vergleichbar machen: Kleinschreibung, Umlaute aufgelöst, Zierrat weg. */
export function schluessel(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Einen Ort im eingebauten Verzeichnis nachschlagen.
 * Erst genau, dann „fängt an mit", dann „kommt vor" – damit „kreuzberg" auch
 * „Berlin-Kreuzberg" findet, ohne dass „berlin" plötzlich Spandau bedeutet.
 */
export function ortSuchen(text) {
  const s = schluessel(text);
  if (!s) return null;
  const treffer = (pruef) => {
    const t = ORTE.find(([name]) => pruef(schluessel(name)));
    return t ? { ort: t[0], lat: t[1], lon: t[2], quelle: 'liste' } : null;
  };
  return treffer((k) => k === s)
    || treffer((k) => k.startsWith(s))
    || treffer((k) => k.includes(s))
    || null;
}

/** Alle bekannten Ortsnamen – für die Vorschlagsliste im Formular. */
export const orte = () => ORTE.map(([name]) => name);

/**
 * „52.52, 13.405" als Koordinatenpaar lesen. Wer die Zahlen hat, soll sie
 * eintippen dürfen, statt auf eine Ortssuche angewiesen zu sein.
 */
export function koordinatenLesen(text) {
  const m = String(text || '').match(/^\s*(-?\d+[.,]?\d*)\s*[,; ]\s*(-?\d+[.,]?\d*)\s*$/);
  if (!m) return null;
  const lat = Number(m[1].replace(',', '.'));
  const lon = Number(m[2].replace(',', '.'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { ort: `${lat}, ${lon}`, lat, lon, quelle: 'koordinaten' };
}

/**
 * Die Ortssuche im Netz (OpenStreetMap/Nominatim) – nur auf ausdrücklichen
 * Wunsch. Sie schickt den eingetippten Ortsnamen an einen fremden Server; das
 * ist die eine Stelle, an der diese App das Gerät verlässt, und deshalb ist sie
 * standardmäßig aus und steht als Schalter in den Einstellungen.
 */
export async function ortImNetz(text, fetchImpl = globalThis.fetch) {
  const s = String(text || '').trim();
  if (!s) return null;
  const url = 'https://nominatim.openstreetmap.org/search'
    + `?format=json&limit=1&accept-language=de&q=${encodeURIComponent(s)}`;
  const antwort = await fetchImpl(url, { headers: { Accept: 'application/json' } });
  if (!antwort.ok) throw new Error(`Ortssuche antwortet ${antwort.status}`);
  const daten = await antwort.json();
  if (!Array.isArray(daten) || !daten.length) return null;
  const lat = Number(daten[0].lat);
  const lon = Number(daten[0].lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { ort: daten[0].display_name.split(',')[0].trim() || s, lat, lon, quelle: 'netz' };
}

/**
 * Ort → Koordinaten, in der Reihenfolge, die am wenigsten preisgibt:
 * Koordinatenpaar, eingebaute Liste, und erst dann das Netz.
 */
export async function ortAufloesen(text, { netz = false, fetchImpl } = {}) {
  return koordinatenLesen(text)
    || ortSuchen(text)
    || (netz ? await ortImNetz(text, fetchImpl) : null);
}
