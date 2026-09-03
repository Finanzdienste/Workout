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

/*
 * Die Rolle einer Zutat in der Mahlzeit.
 *
 * Statt einer Menge in Gramm. Niemand wiegt sein Abendessen, und für die
 * Frage, um die es hier geht, ist die Waage auch gar nicht das richtige
 * Werkzeug: Ob eine Zwiebel stört, hängt weniger an ihren Gramm als daran, ob
 * sie die Suppe war oder drei Ringe obendrauf. Genau diesen Unterschied
 * beschreibt die Rolle – in Worten, die man beim Eintragen ohne Nachdenken
 * trifft.
 *
 * Die Reihenfolge ist die Reihenfolge im Auswahlmenü und geht von „viel" nach
 * „wenig". `haupt` ist die Vorgabe: Wer nichts umstellt, hat damit die
 * harmlosere Angabe *nicht* gewählt.
 */
export const ROLLEN = [
  { id: 'haupt', name: 'Hauptzutat', kurz: 'Haupt', hilfe: 'Das meiste an dieser Mahlzeit' },
  { id: 'beilage', name: 'Beilage', kurz: 'Beilage', hilfe: 'Ein ordentlicher Teil, aber nicht die Hauptsache' },
  { id: 'topping', name: 'Topping', kurz: 'Topping', hilfe: 'Obendrauf, ein paar Löffel' },
  { id: 'getraenk', name: 'Getränk dazu', kurz: 'Getränk', hilfe: 'Getrunken, nicht gegessen' },
  { id: 'wuerze', name: 'Würze oder Sauce', kurz: 'Würze', hilfe: 'Nur ein Hauch davon' },
];

export const ROLLE_VORGABE = 'haupt';

const ROLLEN_MAP = Object.fromEntries(ROLLEN.map((r) => [r.id, r]));

export function rolleVon(id) {
  return ROLLEN_MAP[id] || ROLLEN_MAP[ROLLE_VORGABE];
}

export function rolleName(id, kurz) {
  const r = rolleVon(id);
  return kurz ? r.kurz : r.name;
}

/*
 * Was für einen ganzen Tag gilt, nicht für einen Zeitpunkt.
 *
 * Aus dem Magentagebuch ist ein Gesundheitstagebuch geworden, und diese Liste
 * ist der Grund, warum das kein Umbau war: Eine weitere Frage ist eine
 * weitere Zeile. Anzeige, Speicher, Auswertung und Bericht lesen alle hier.
 *
 * Zwei Regeln für die Skalen:
 *
 *   * Bei allem, was gut oder schlecht sein kann, ist **0 gut und 4 schlecht**.
 *     Dann bedeutet ein Zusammenhang immer dasselbe, und die Auswertung muss
 *     sich nicht je Frage merken, in welche Richtung sie zu lesen ist.
 *   * `bewegung`, `blutung` und `sex` sind Mengen, keine Bewertungen. Sie
 *     tragen `menge: true` und werden nirgends als „schlecht" gerechnet.
 *
 * Nicht jede Frage will jeder beantworten – ein Feld für Sex im Tagebuch ist
 * für die einen selbstverständlich und für die anderen ein Übergriff. Welche
 * Fragen erscheinen, entscheidet die Einstellung `tagesfragen` unter Mehr.
 */
export const TAGESFRAGEN = [
  { id: 'stimmung', name: 'Stimmung', worte: ['gut', 'ok', 'gedrückt', 'schlecht', 'sehr schlecht'] },
  { id: 'stress', name: 'Anspannung', worte: ['ruhig', 'geht so', 'angespannt', 'viel', 'sehr viel'] },
  { id: 'schlaf', name: 'Schlaf', worte: ['gut', 'ok', 'mäßig', 'schlecht', 'kaum'] },
  { id: 'bewegung', name: 'Bewegung', menge: true, worte: ['keine', 'leicht', 'moderat', 'intensiv', 'sehr intensiv'] },
  { id: 'blutung', name: 'Periode', menge: true, worte: ['keine', 'Schmierblutung', 'leicht', 'mittel', 'stark'] },
  { id: 'sex', name: 'Sex', menge: true, worte: ['nein', 'ja'] },
];

const FRAGEN_MAP = Object.fromEntries(TAGESFRAGEN.map((f) => [f.id, f]));

export function frageVon(id) {
  return FRAGEN_MAP[id] || null;
}

/** Die Fragen, die dieser Nutzer sehen will – in der Reihenfolge von oben. */
export function sichtbareFragen(gewaehlt) {
  if (!Array.isArray(gewaehlt)) return TAGESFRAGEN;
  return TAGESFRAGEN.filter((f) => gewaehlt.includes(f.id));
}

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
