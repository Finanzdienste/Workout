/*
 * Die Kataloge: was man ankreuzen kann.
 *
 * Zwei Listen tragen die App. Die eine sagt, was in einer Mahlzeit stecken
 * kann und als Magenreiz gilt; die andere, wie sich Beschwerden anfühlen.
 * Beide sind absichtlich kurz. Eine Liste mit hundert Einträgen wird nicht
 * ausgefüllt, und was nicht ausgefüllt wird, taucht in keiner Auswertung auf.
 *
 * Wichtig zur Einordnung: Die Auswahl hier ist kein medizinisches Urteil. Sie
 * sammelt, was in der Ernährungsberatung bei Magenbeschwerden üblicherweise
 * zur Sprache kommt – als *Verdachtsliste*, damit man beim Eintragen nicht
 * jedes Mal überlegen muss. Ob etwas davon bei einem bestimmten Menschen
 * tatsächlich stört, sagt allein sein eigener Verlauf. Genau dafür ist die
 * App da, und genau deshalb steht in der Auswertung immer die Fallzahl daneben.
 *
 * `id` ist der Schlüssel im Speicher und darf sich nie ändern – daran hängen
 * alle bereits gemachten Eintragungen. Namen dürfen sich ändern.
 */

export const AUSLOESER = [
  { id: 'kaffee', name: 'Kaffee', icon: '☕' },
  { id: 'alkohol', name: 'Alkohol', icon: '🍷' },
  { id: 'scharf', name: 'Scharf gewürzt', icon: '🌶️' },
  { id: 'fett', name: 'Fettig, frittiert', icon: '🍟' },
  { id: 'zitrus', name: 'Zitrus, Saures', icon: '🍋' },
  { id: 'tomate', name: 'Tomate', icon: '🍅' },
  { id: 'zwiebel', name: 'Zwiebel, Knoblauch', icon: '🧅' },
  { id: 'kohlensaeure', name: 'Kohlensäure', icon: '🥤' },
  { id: 'suess', name: 'Süßes, Schokolade', icon: '🍫' },
  { id: 'milch', name: 'Milchprodukte', icon: '🥛' },
  { id: 'rohkost', name: 'Rohkost, Salat', icon: '🥗' },
  { id: 'huelsen', name: 'Hülsenfrüchte, Kohl', icon: '🫘' },
  { id: 'vollkorn', name: 'Vollkorn', icon: '🌾' },
  { id: 'geraeuchert', name: 'Geräuchert, gepökelt', icon: '🥓' },
  { id: 'minze', name: 'Pfefferminze', icon: '🌿' },
  { id: 'nikotin', name: 'Nikotin', icon: '🚬' },
];

/**
 * Zwei Merkmale, die keine Zutat sind, sondern die Umstände: die Portion und
 * die späte Stunde. Beide gelten als Magenreiz und werden in der Auswertung
 * genauso behandelt wie eine Zutat – deshalb stehen sie hier mit derselben
 * Struktur, aber getrennt: Beim Eintragen kreuzt man sie nicht an, sie ergeben
 * sich aus der Portionsangabe und der Uhrzeit.
 */
export const UMSTAENDE = [
  { id: 'gross', name: 'Große Portion', icon: '🍽️' },
  { id: 'spaet', name: 'Spät gegessen (nach 20 Uhr)', icon: '🌙' },
];

/** Alles, was die Auswertung als möglichen Auslöser kennt. */
export const ALLE_AUSLOESER = [...AUSLOESER, ...UMSTAENDE];

export const BESCHWERDEN = [
  { id: 'brennen', name: 'Brennen', icon: '🔥' },
  { id: 'druck', name: 'Druck, Völlegefühl', icon: '🪨' },
  { id: 'uebelkeit', name: 'Übelkeit', icon: '🤢' },
  { id: 'sodbrennen', name: 'Sodbrennen', icon: '🌋' },
  { id: 'aufstossen', name: 'Aufstoßen', icon: '💨' },
  { id: 'blaehung', name: 'Blähungen', icon: '🎈' },
  { id: 'krampf', name: 'Krämpfe', icon: '⚡' },
  { id: 'appetit', name: 'Kein Appetit', icon: '🍽️' },
];

export const PORTIONEN = [
  { id: 'klein', name: 'klein' },
  { id: 'normal', name: 'normal' },
  { id: 'gross', name: 'groß' },
];

/**
 * Vorschläge fürs Medikamentenfeld – nur Vorschläge. Das Feld bleibt frei
 * beschreibbar, weil jede Vorgabe hier irgendwann an dem vorbeigeht, was
 * jemand tatsächlich einnimmt.
 */
export const MITTEL_VORSCHLAEGE = [
  'Pantoprazol', 'Omeprazol', 'Esomeprazol', 'Antazidum', 'Sucralfat',
  'Iberogast', 'Kamillentee', 'Heilerde',
];

/** Wie stark, in Worten. Die Zahl allein sagt nach vier Wochen nichts mehr. */
export const STAERKE_WORT = [
  'keine', 'kaum spürbar', 'sehr leicht', 'leicht', 'merklich', 'mittel',
  'deutlich', 'stark', 'sehr stark', 'kaum auszuhalten', 'unerträglich',
];

const NACH_ID = (liste) => Object.fromEntries(liste.map((x) => [x.id, x]));

const AUSLOESER_MAP = NACH_ID(ALLE_AUSLOESER);
const BESCHWERDE_MAP = NACH_ID(BESCHWERDEN);

/**
 * Ein Auslöser zu seiner ID – auch für eigene, die der Nutzer angelegt hat.
 *
 * Eigene Auslöser bekommen die Vorsilbe `x:`; damit kann keine spätere
 * Erweiterung der Liste oben eine bereits vergebene eigene ID überschreiben.
 */
export function ausloeserVon(id, eigene = []) {
  if (AUSLOESER_MAP[id]) return AUSLOESER_MAP[id];
  const selbst = eigene.find((e) => e.id === id);
  return selbst ? { ...selbst, icon: selbst.icon || '•' } : null;
}

export function ausloeserName(id, eigene = []) {
  const a = ausloeserVon(id, eigene);
  return a ? a.name : id;
}

export function beschwerdeVon(id) {
  return BESCHWERDE_MAP[id] || null;
}

export function beschwerdeName(id) {
  const b = beschwerdeVon(id);
  return b ? b.name : id;
}

/** Aus einem freien Namen eine eigene Auslöser-ID machen. */
export function eigeneId(name) {
  const rumpf = String(name).toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `x:${rumpf || 'eigen'}`;
}
