/*
 * Was gerade da ist – und was der Plan daraus macht.
 *
 *     „Außerdem bin ich bei meinen Eltern wo ich nichts hab. Also auch keine
 *      Bänder und Klimmzugstange. Kann ich das irgendwo angeben?"
 *
 * Konnte man nicht. Die App nahm an, dass alles da ist, was im Gerätetext einer
 * Übung steht, und an einem Wochenende ohne Band standen dann acht Übungen auf
 * dem Bildschirm, die nicht gingen. Ein Training, das man nicht machen kann,
 * ist kein Training – und Übungen von Hand zu überspringen verschiebt zugleich
 * die Wochenbilanz, ohne dass jemand es merkt.
 *
 * Hier steht deshalb der Vorrat: eine Liste von Geräten, die man abwählen kann,
 * und die Regel, was dann mit dem Plan geschieht.
 *
 * DREI ENTSCHEIDUNGEN, die das Ganze tragen:
 *
 * 1. **Abwählen, nicht anwählen.** Gespeichert wird, was *fehlt* – ein leeres
 *    `fehlt: []` heißt „alles da". Wer die App seit einem Jahr benutzt, merkt
 *    von dieser Datei deshalb nichts, und eine eingelesene Sicherung ohne das
 *    Feld schaltet nicht versehentlich den halben Plan ab.
 *
 * 2. **Ersatz in zwei Stufen: erst gleiche Anteile, dann gleicher
 *    Hauptmuskel.** Siehe ersatzFuer(). Die erste Stufe kostet gar nichts, die
 *    zweite ist der Unterschied zwischen einem Training und einer Lücke:
 *
 *        „Falls es irgendeinen Weg gibt (zB durch neue Übungen) auch bei full
 *         bodyweight also auch ohne Bänder und so möglichst die
 *         Zielmuskelgruppen dieser Einheit zu treffen dann können wir das gern
 *         machen."
 *
 *    Gemessen, im Bodyweight-Plan ohne Bänder und ohne Klimmzugstange, in
 *    Sätzen je Woche: Rücken von 0,0 auf 7,4 · Bizeps von 0,0 auf 8,0 ·
 *    seitliche Schulter von 0,3 auf 8,4 · hintere Schulter von 0,0 auf 9,2.
 *    Möglich wurde das durch die zweite Stufe und durch zwei Übungen mehr im
 *    Katalog – Seitheben mit zwei gefüllten Flaschen und Curls mit einem mit
 *    Büchern gefüllten Rucksack. Für diese beiden Muskelgruppen kennt der
 *    Katalog sonst keine Übung, die ganz ohne Widerstand von außen auskommt.
 *
 * 3. **Gesagt wird, was es kostet.** Nichts davon ist umsonst: Wo der Ersatz
 *    einen eigenen Schwerpunkt mitbringt, verschiebt er Volumen dorthin. Die
 *    App behauptet deshalb nicht, der Plan sei danach derselbe. Ausgerechnet
 *    wird es in vorratBilanz() (js/app.js) – am Plan und nicht am Katalog, weil
 *    eine Übung, die es gäbe, kein Volumen ist.
 */
import { EXERCISES } from './data.js';
import { EX_BY_ID } from './uebung.js';
import { blocked } from './injuries.js';
import * as store from './store.js';

/**
 * Was man abwählen kann.
 *
 * `seite` sagt, unter welchem Reiter es steht – Bodyweight oder Hanteln. Die
 * Aufteilung ist die des Trainings selbst:
 *
 *     „Lass doch in den Einstellungen im Equipment Bereich zwischen bodyweight
 *      und Hanteln wechseln können. Und bei bodyweight kann man dann Band rot
 *      und gelb und Klimmzugstange ankreuzen und bei Hanteln ist dann ‚alles
 *      aus bodyweight +' und dann halt die Hantel Auflistung."
 *
 * Genau so wirkt es auch: Bänder und Stange zählen in *beiden* Modi, die
 * Hanteln nur im Hantel-Modus. Deshalb gibt es kein eigenes Feld „im
 * Bodyweight-Modus vorhanden" – die Übungen selbst sagen schon, was sie
 * brauchen, und im Bodyweight-Modus braucht keine eine Kurzhantel.
 *
 * Möbel stehen hier nicht: Stuhl, Erhöhung, Handtuch, Buch, Tischkante,
 * Rucksack. Siehe GERAET_AUS_TEXT in tools/build-data.py.
 */
export const GERAETE = [
  { id: 'band-gelb', seite: 'bw', label: 'Band, gelb', hint: 'das leichtere' },
  { id: 'band-rot', seite: 'bw', label: 'Band, rot', hint: 'das schwerere' },
  { id: 'stange', seite: 'bw', label: 'Klimmzugstange', hint: 'Tür- oder Wandstange' },
  { id: 'kurzhantel', seite: 'db', label: 'Kurzhanteln', hint: 'ein Paar' },
  { id: 'langhantel', seite: 'db', label: 'Langhantel', hint: 'gerade Stange' },
  { id: 'sz', seite: 'db', label: 'SZ-Stange', hint: 'die gewellte' },
];

const GERAET_IDS = new Set(GERAETE.map((g) => g.id));

/** Was gerade als fehlend angehakt ist – bereinigt um Unbekanntes. */
export function fehlt() {
  const roh = store.getState().fehlt;
  return Array.isArray(roh) ? roh.filter((id) => GERAET_IDS.has(id)) : [];
}

/** Fehlt überhaupt etwas? Der Normalfall ist nein, und dann tut diese Datei nichts. */
export const vorratVollstaendig = () => fehlt().length === 0;

export function setzeVorrat(id, da) {
  if (!GERAET_IDS.has(id)) return;
  const liste = fehlt().filter((x) => x !== id);
  if (!da) liste.push(id);
  store.setSetting('fehlt', liste.sort());
}

/**
 * Ist dieser Geräteschlüssel gedeckt?
 *
 * `band` ist der eine Schlüssel, der sich aus zweien speist: Eine Übung am Band
 * braucht *ein* Band, nicht ein bestimmtes. Welche Farbe dann gilt, sagt
 * bandFarbe().
 */
function daIst(schluessel) {
  const weg = fehlt();
  if (schluessel === 'band') return !weg.includes('band-gelb') || !weg.includes('band-rot');
  return !weg.includes(schluessel);
}

/**
 * Reicht der Vorrat für diese Anforderung?
 *
 * `braucht` ist eine Liste von Alternativgruppen: UND über ODER. "kurzhantel|sz"
 * ist eine Gruppe, die schon ein Gerät erfüllt.
 */
export function erfuellt(braucht) {
  return (braucht || []).every((gruppe) => gruppe.split('|').some(daIst));
}

/** Geht diese Übung in diesem Modus gerade? */
export function uebungGeht(exId, mode) {
  const ex = EX_BY_ID.get(exId);
  if (!ex) return true;
  return erfuellt((ex[mode] || {}).braucht);
}

/**
 * Die Bandfarbe, die es wirklich gibt.
 *
 * Wer „rot" eingestellt hat und das rote Band zu Hause liegen lässt, soll nicht
 * eine Farbe angezeigt bekommen, die er nicht hat. Der gespeicherte Wunsch
 * bleibt dabei stehen – zurück zu Hause steht wieder Rot da, ohne dass es neu
 * eingestellt werden muss. Geändert wird die Anzeige, nicht der Zustand.
 */
export function bandFarbe(exId) {
  const wunsch = store.bandOf(exId) === 'rot' ? 'rot' : 'gelb';
  if (!fehlt().includes(`band-${wunsch}`)) return wunsch;
  const andere = wunsch === 'rot' ? 'gelb' : 'rot';
  return fehlt().includes(`band-${andere}`) ? wunsch : andere;
}

/* ------------------------------------------------------------------ *
 * Ersatz mit denselben Muskelanteilen
 *
 * Gesucht wird nicht „etwas Ähnliches", sondern etwas, das die Wochenrechnung
 * nicht anfasst: dieselben Anteile auf dieselben Muskeln. Im Katalog gibt es
 * davon eine Handvoll Paare, und sie sind es, die den Unterschied machen –
 * ohne Klimmzugstange wird aus dem hängenden Knieheben das liegende, ohne Band
 * aus dem Band-Seitheben das mit der Kurzhantel.
 *
 * Gerechnet wird beim ersten Bedarf und dann gemerkt: Der Katalog ändert sich
 * zur Laufzeit nicht.
 * ------------------------------------------------------------------ */
const gleichAnteile = { db: null, bw: null };

function anteilGruppen(mode) {
  if (gleichAnteile[mode]) return gleichAnteile[mode];
  const map = new Map();
  EXERCISES.forEach((e) => {
    const key = JSON.stringify(Object.entries(e[mode].shares).sort());
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(e.id);
  });
  gleichAnteile[mode] = map;
  return map;
}

/** Der Muskel, um den es bei dieser Übung geht – der mit dem größten Anteil. */
function hauptmuskel(shares) {
  return Object.entries(shares).sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * Wie gut zwei Übungen einander decken: die Summe der gemeinsamen Anteile.
 *
 * Kein Winkel, keine Norm – die Anteile sind selbst schon eine Angabe „wie viel
 * von dieser Übung kommt bei diesem Muskel an". Das Minimum je Muskel ist
 * genau der Teil, den beide liefern, und die Summe darüber ist damit eine Zahl
 * in derselben Einheit wie das, worum es geht.
 */
function deckung(a, b) {
  return Object.entries(a).reduce((s, [m, v]) => s + Math.min(v, b[m] || 0), 0);
}

/**
 * Ersatz für eine Übung, die gerade nicht geht – oder null.
 *
 * **Zwei Stufen, und die zweite ist der Grund, warum ohne Geräte überhaupt noch
 * etwas geht:**
 *
 * 1. *Dieselben Anteile.* Der saubere Fall: Die Wochenrechnung bleibt Ziffer
 *    für Ziffer stehen. Im Katalog gibt es davon eine Handvoll Paare.
 *
 * 2. *Derselbe Hauptmuskel.* Sonst stünde für einen ganzen Plan ohne Band und
 *    Stange bei Rücken, Nacken und hinterer Schulter eine Null – gemessen, nicht
 *    vermutet. Dabei kennt der Katalog Übungen, die das können und die nur
 *    deshalb nicht im Plan stehen, weil der Plan mit Geräten rechnet: das
 *    Inverted Row an der Tischkante, den Reverse Snow Angel, die Pike-
 *    Liegestütze.
 *
 *        „Falls es irgendeinen Weg gibt, auch bei full bodyweight also auch
 *         ohne Bänder und so möglichst die Zielmuskelgruppen dieser Einheit zu
 *         treffen, dann können wir das gern machen."
 *
 *    Gibt es. Verlangt wird, dass der Ersatz den Hauptmuskel der alten Übung
 *    mindestens zur Hälfte trifft. Bevorzugt wird, wo es das gibt, eine Übung,
 *    bei der dieser Muskel auch der eigene Hauptmuskel ist; sonst die mit der
 *    größten Deckung. Die Hauptlast bleibt damit, wo sie war, und mit ihr die
 *    48-Stunden-Regel, die an ihr hängt.
 *
 *    **Ehrlich dazu:** Wo der Ersatz einen eigenen Schwerpunkt mitbringt,
 *    verschiebt er auch etwas hin. Ohne Band gibt es keine Trizeps-Isolation
 *    mehr, also kommen enge Liegestütze – und mit ihnen Brust, die an dem Tag
 *    nicht geplant war: 11,9 statt 10,0 Sätzen je Woche. Das rechnet
 *    vorratBilanz() aus und die Einstellungsseite schreibt es hin. Eine stille
 *    Verschiebung wäre etwas anderes als eine ausgewiesene.
 *
 * `belegt` sind die Übungen, die in dieser Einheit schon stehen. Auf Stufe 2
 * werden sie übersprungen: Zwei Zeilen zusammenzulegen ist bei gleichen
 * Anteilen eine Buchung, bei ungleichen eine Übung mit acht Sätzen.
 *
 * Angehakte Beschwerden gelten auch hier: Der Verletzungsfilter läuft vorher und
 * hat seine Sperren gezogen; ein Ersatz, der eine davon zurückholte, wäre
 * schlimmer als die Lücke.
 */
export function ersatzFuer(exId, mode, belegt = new Set()) {
  const ex = EX_BY_ID.get(exId);
  if (!ex) return null;
  const gesperrt = blocked(store.getState().injuries || []);
  const frei = (id) => id !== exId && !gesperrt.has(id) && uebungGeht(id, mode);

  const anteile = ex[mode].shares;
  const key = JSON.stringify(Object.entries(anteile).sort());
  const genau = (anteilGruppen(mode).get(key) || []).find(frei);
  if (genau) return genau;

  const haupt = hauptmuskel(anteile);
  const naechster = EXERCISES
    .filter((e) => frei(e.id) && !belegt.has(e.id) && (e[mode].shares[haupt] || 0) >= 0.5)
    .map((e) => ({
      id: e.id,
      // Ist der gesuchte Muskel auch der, um den es bei der Ersatzübung geht?
      // Das ist der saubere Fall und gewinnt vor allem anderen. Sonst bringt
      // der Ersatz seinen eigenen Hauptmuskel mit – enge Liegestütze statt
      // Trizepsdrücken am Band bringen Brust mit, die an dem Tag nicht geplant
      // war. Besser als eine Lücke, aber nicht dasselbe, und deshalb erst,
      // wenn es nichts Besseres gibt. Was dabei herauskommt, steht in
      // vorratBilanz() – ohne Band und Stange etwa Brust 11,9 statt 10,0.
      eigener: hauptmuskel(e[mode].shares) === haupt ? 1 : 0,
      anteil: e[mode].shares[haupt],
      deckung: deckung(anteile, e[mode].shares),
    }))
    .sort((a, b) => b.eigener - a.eigener || b.anteil - a.anteil || b.deckung - a.deckung)[0];
  return naechster ? naechster.id : null;
}

/** Trifft der Ersatz genau dieselben Anteile, oder nur denselben Hauptmuskel? */
export function ersatzGenau(vonId, zuId, mode) {
  const a = EX_BY_ID.get(vonId);
  const b = EX_BY_ID.get(zuId);
  if (!a || !b) return false;
  return JSON.stringify(Object.entries(a[mode].shares).sort())
    === JSON.stringify(Object.entries(b[mode].shares).sort());
}

/**
 * Eine Übungsliste unter dem, was da ist.
 *
 * Rückgabe wie bei applyInjuries(): die Liste, die Tausche und das, was
 * ersatzlos wegfällt. Ist alles da, kommt die Liste unverändert zurück –
 * dieselbe Referenz, damit der Normalfall nichts kostet.
 *
 * `statt`/`stattWarum` wandern mit: Ohne sie könnte die Anzeige nicht sagen,
 * wofür die Übung eingesprungen ist, und ein stiller Tausch wäre genau das,
 * was js/muster.js im Kopf ausschließt.
 */
export function vorratFassung(items, mode) {
  if (vorratVollstaendig()) return { items, getauscht: [], weg: [] };
  const out = [];
  const getauscht = [];
  const weg = [];
  // Was in dieser Einheit schon steht – samt dem, was noch kommt. Der Ersatz
  // soll nicht ausgerechnet die Übung sein, die zwei Zeilen weiter unten
  // ohnehin dransteht.
  const belegt = new Set(items.map((x) => x.id));
  items.forEach((it) => {
    // Kopiert, nicht durchgereicht: Unten werden Sätze zusammengelegt, und das
    // träfe sonst den zwischengespeicherten Plan selbst.
    if (uebungGeht(it.id, mode)) { out.push({ ...it }); return; }
    const zu = ersatzFuer(it.id, mode, belegt);
    if (zu) belegt.add(zu);
    if (!zu) { weg.push({ id: it.id, sets: it.sets }); return; }
    getauscht.push({ from: it.id, to: zu, sets: it.sets });
    const schon = out.find((x) => x.id === zu);
    // Zweimal dieselbe Zeile in einer Einheit wäre nur verwirrend – die Sätze
    // kommen dann zusammen, wie beim Verletzungsfilter auch.
    if (schon) schon.sets += it.sets;
    else out.push({ ...it, id: zu, statt: it.id, stattWarum: 'vorrat' });
  });
  return { items: out, getauscht, weg };
}

/** Übungen, die im aktuellen Vorrat nicht gehen – für die Einstellungsseite. */
export function nichtMoeglich(mode) {
  return EXERCISES.filter((e) => !uebungGeht(e.id, mode)).map((e) => e.id);
}
