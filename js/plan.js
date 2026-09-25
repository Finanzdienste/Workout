/*
 * Der Plan: Termine, Übungen je Einheit, Nacharbeit, Fortschritt.
 *
 * Das Herz der Rechnung. js/data.js liefert den geschriebenen Plan; hier wird
 * daraus der Plan, der heute gilt – verschoben um verpasste Tage, angepasst an
 * Verletzungen, skaliert auf die Erfahrungsstufe, ergänzt um Nacharbeit.
 *
 * exOf() ist die eine Stelle, an der Modus und Stufe über die Satzzahl
 * entscheiden. Alles danach – Protokoll, Fortschritt, Wochenvolumen,
 * Zeitschätzung – rechnet mit dem, was von dort kommt.
 */
import * as store from './store.js';
import { EXERCISES, PLAN, REST } from './data.js';
import { EX_BY_ID, directOf, directSets, gezaehlteReps, stufenWerte } from './uebung.js';
import { addDays, daysBetween, plural, todayISO } from './dates.js';
import { INJURIES, applyInjuries, gesperrt, modusTausch } from './injuries.js';
import { faelltAus, termine } from './termine.js';
import { esc } from './text.js';
import { ruestOrderStabil } from './gewichte.js';
import { nichtsAbgewaehlt, vorratFassung } from './vorrat.js';
import { satzZahl } from './stufen.js';

/**
 * Wie viele Wochen ein ganzer Durchlauf dauert.
 *
 * Aus den Terminen gerechnet und nicht gezählt: Wer 84 Einheiten durch vier
 * teilt, bekommt 21 – aber nur, solange niemand einen Tag verschiebt.
 */
export const PLAN_WEEKS = (() => {
  const span = daysBetween(PLAN[0].date, PLAN[PLAN.length - 1].date);
  // Die letzte Einheit endet nicht am Wochenende: eine Lücke dazurechnen,
  // sonst kommt bei 80 Einheiten in 139 Tagen 19,9 statt 20 heraus.
  return Math.max(1, Math.round((span * PLAN.length) / Math.max(1, PLAN.length - 1) / 7));
})();

/**
 * Tatsächlicher Termin einer Einheit.
 *
 * Bereits begonnene Einheiten bleiben auf dem Tag, an dem trainiert wurde –
 * die Historie darf sich nicht rückwirkend verschieben. Alles Offene liegt
 * auf seinem Plandatum plus der aktuellen Verschiebung.
 */
export function effDate(w) {
  // Eigene Einheiten hängen an keinem Plantermin: Sie sind an dem Tag, an dem
  // man sie macht, und verschieben sich mit dem Plan nicht mit.
  if (istCustom(w.n)) return store.startedOn(w.n) || todayISO();
  return store.startedOn(w.n) || addDays(w.date, store.getState().shift);
}

/** Eigene Einheiten haben eine Kennung statt einer Nummer. */
export const istCustom = (n) => typeof n === 'string' && n.startsWith('c');

/**
 * Verpasste Tage nachtragen: Ist der Termin der frühesten noch nicht
 * begonnenen Einheit verstrichen, wandert der gesamte Restplan um genau so
 * viele Tage nach hinten, bis diese Einheit auf heute fällt. Die Abstände
 * zwischen den Einheiten bleiben dabei erhalten.
 */
export function catchUpPlan() {
  const s = store.getState();
  const open = PLAN.find((w) => !store.isStarted(w.n));
  if (!open) return 0;
  const missed = daysBetween(effDate(open), todayISO());
  if (missed <= 0) return 0;
  store.setShift(s.shift + missed);
  return missed;
}

/** Die erste Einheit, die noch nicht angefangen wurde – die, die dran wäre. */
export function firstOpen() {
  return PLAN.find((w) => !store.isStarted(w.n)) || PLAN[PLAN.length - 1];
}

/**
 * Verschiebung, die die nächste offene Einheit auf heute legt – in beide
 * Richtungen.
 *
 * Die Termine stammen aus der Excel und liegen unter Umständen in der Zukunft.
 * Nachrücken allein half da nicht: Es schiebt nur, was verstrichen ist. Wer
 * heute anfangen will, braucht den Weg nach vorn genauso.
 */
export function shiftToToday() {
  return store.getState().shift + daysBetween(effDate(firstOpen()), todayISO());
}

/**
 * Knopf „Heute anfangen“ – nur, wenn es etwas vorzuziehen gibt.
 *
 * Sichtbar an genau der Einheit, die als Nächstes offen ist: An Workout 40
 * angetippt würde er den halben Plan um Monate verschieben, und das will
 * niemand aus Versehen.
 */
export function startTodayRow(n) {
  const offen = firstOpen();
  if (store.getState().session || offen.n !== n) return '';
  const tage = daysBetween(todayISO(), effDate(offen));
  if (tage <= 0) return '';
  return `<div class="btn-row">
      <button type="button" class="btn btn-ghost btn-block" data-act="start-today">
        Heute anfangen – Plan ${esc(plural(tage, 'Tag', 'Tage'))} vorziehen
      </button>
    </div>`;
}

/** Die Einheit, die als Nächstes ansteht: die erste noch nicht abgeschlossene. */
export function defaultWorkoutNo() {
  const open = PLAN.find((w) => !completedMode(w.n));
  return open ? open.n : PLAN[PLAN.length - 1].n;
}

/** Angehakte Verletzungen. */
export function activeInjuries() { return store.getState().injuries || []; }

/**
 * Der ganze Plan unter den angehakten Beschwerden – einmal gerechnet, gemerkt.
 *
 * Ein Tausch darf die Erholung nicht aushebeln: Der Plan ist so gebaut, dass
 * keine Muskelgruppe innerhalb von REST.days Tagen zweimal direkt drankommt,
 * und ein Ersatz, der genau das täte, ist keiner – dann fällt die Übung lieber
 * ersatzlos weg. Geprüft wird gegen beide Nachbarn: den Vortag in der bereits
 * angepassten Fassung und den Folgetag so, wie er im Plan steht. Dessen eigene
 * Tausche werden dann ihrerseits gegen diesen Tag geprüft.
 */
export const planCache = { key: null, list: null, notes: null };

// Jede Zustandsänderung verwirft den Zwischenstand. Die Anpassung hängt an den
// tatsächlichen Terminen, und die ändern sich auch, wenn eine Einheit begonnen
// wird – das ließe sich am Schlüssel kaum zuverlässig ablesen. Ein Neuaufbau
// kostet unter einer Millisekunde, die Ersparnis liegt in den vielen Aufrufen
// innerhalb *eines* Renderdurchlaufs.
store.subscribe(() => { planCache.key = null; });

export function adjustedPlan() {
  const act = activeInjuries();
  const term = termine();
  // Der Schlüssel nennt nur, was die Anpassung selbst bestimmt. Die Termine
  // hängen zusätzlich daran, wann tatsächlich trainiert wurde – deshalb wird
  // der Zwischenstand bei jeder Zustandsänderung verworfen (siehe oben),
  // statt hier eine Signatur über den ganzen Verlauf zu bilden.
  const key = `${act.join(',')}|${store.getState().shift}|${term.length}`;
  if (planCache.key === key) return planCache.list;

  const list = [];
  const notes = [];
  PLAN.forEach((w, i) => {
    if (!act.length && !term.length) {
      list.push(w.ex);
      notes.push({ dropped: [], swapped: [], termin: [] });
      return;
    }
    if (!act.length) {
      // Nur Termine, keine Beschwerden: Der teure Teil oben (Nachbartage,
      // Tabuliste, Ersatzsuche) hat dann nichts zu tun.
      const t = faelltAus(w.ex, effDate(w));
      list.push(t.items);
      notes.push({ dropped: t.dropped, swapped: [], termin: t.namen });
      return;
    }
    const eng = (a, b) => a && b && Math.abs(daysBetween(effDate(a), effDate(b))) < REST.days;
    const meide = new Set();
    if (eng(PLAN[i - 1], w)) directSets(list[i - 1]).forEach((m) => meide.add(m));
    if (eng(w, PLAN[i + 1])) directSets(PLAN[i + 1].ex).forEach((m) => meide.add(m));
    const taboo = new Set(EXERCISES
      .filter((e) => directOf(e.id).some((m) => meide.has(m)))
      .map((e) => e.id));
    const r = applyInjuries(w.ex, act, taboo);
    // Termine kommen *nach* den Verletzungen: Was ohnehin schon getauscht ist,
    // wird an seiner neuen Stelle geprüft. Ein Ersatz, der die geschonte Gruppe
    // trifft, fällt dann genauso weg wie das Original.
    const t = faelltAus(r.items, effDate(w));
    list.push(t.items);
    notes.push({ dropped: r.dropped.concat(t.dropped), swapped: r.swapped, termin: t.namen });
  });
  planCache.key = key;
  planCache.list = list;
  planCache.notes = notes;
  return list;
}

/** Was an einem Plantag getauscht wurde und was wegfiel. */
export function injuryNotes(n, mode) {
  adjustedPlan();
  let roh = planCache.notes[n - 1] || { dropped: [], swapped: [], termin: [] };
  // Mit Modus kommen die Sperren dazu, die nur in diesem Modus gelten – sonst
  // fiele im Bodyweight-Modus eine Übung weg, und die Notiz sagte nichts dazu.
  const w = PLAN[n - 1];
  if (mode && w) {
    const r = modusTausch(vorratFassung(gestufteSaetze(w, mode), mode).items, activeInjuries(), mode);
    roh = { ...roh, dropped: roh.dropped.concat(r.dropped), swapped: roh.swapped.concat(r.swapped) };
  }
  // Was protokolliert ist, ist weder ausgefallen noch getauscht worden – es
  // steht wieder da (behalteProtokolliertes). Ohne diesen Filter hieß es an
  // einer längst trainierten Einheit nach einem nachgetragenen Padel-Tag
  // „Hip Thrust fällt aus", während daneben die drei abgehakten Sätze standen.
  const da = protokolliert(n);
  if (!da.size) return roh;
  return {
    ...roh,
    dropped: roh.dropped.filter((d) => !da.has(d.id)),
    swapped: roh.swapped.filter((x) => !da.has(x.from)),
  };
}

/**
 * Der Plantag, wie er im Plan steht – Verletzungen, Modus und Erfahrungsstufe
 * eingerechnet, aber ohne Nacharbeit.
 *
 * Das ist die Zahl, gegen die gemessen wird: Wer wissen will, was diese Woche
 * liegen geblieben ist, muss den *Plan* fragen und nicht eine Einheit, die
 * schon Nachgetragenes enthält. Sonst wächst der Rückstand an sich selbst.
 * Nach außen geht exOf(), nicht diese Funktion.
 */
/**
 * Übungen, die auf der Anfängerstufe durch ihre einfachere Fassung ersetzt sind.
 *
 * Die Erfahrungsstufe hat bisher nur an zwei Schrauben gedreht: Startgewichte
 * skalieren und Satzzahlen setzen. Beides hilft nichts, wo die Übung selbst das
 * Nadelöhr ist:
 *
 *     „Beim hängenden Beinheben merk ich eigentlich nur die Arme und muss nach
 *      zwei Wiederholungen abbrechen … Dann brauch ich als Anfänger halt einfach
 *      ne andere Übung und zwar anscheinend die Boden Variante. Das soll nicht
 *      nur im Text stehen sondern wenn man Anfänger ausgewählt hat soll auch nur
 *      die Boden Variante kommen."
 *
 * Der Hinweis stand seit jeher im Katalogtext. Ein Rat, den man erst aufklappen
 * muss, ändert aber nichts an dem, was auf dem Bildschirm steht – und zwei
 * Wiederholungen an der Stange sind kein halbes Training, sondern keins.
 *
 * **Warum das hier steht und nicht in resolve():** Getauscht wird die *Übung*,
 * nicht ihre Darstellung. Ab hier rechnen Protokoll, Fortschritt, Wochenvolumen
 * und Zeitschätzung von selbst mit der richtigen – genau wie beim Tausch durch
 * den Verletzungsfilter, der eine Zeile weiter oben passiert.
 *
 * **Warum die Anteile gleich sein müssen:** Die Wochenziele je Muskelgruppe
 * hängen am Plan. Ein Ersatz mit anderen Anteilen verschöbe sie stillschweigend
 * für jeden Anfänger. tests/test-anfaenger.mjs prüft das für jedes Paar.
 */
function anfaengerFassung(ex, m) {
  const s = store.getState();
  // Nichts hierher holen, was eine angehakte Beschwerde sperrt. Gefunden bei
  // der Durchsicht der App: Wer einmal die Crunches als Fassung gewählt hatte
  // und später eine Bauchmuskelzerrung anhakte, behielt die Crunches – samt dem
  // Hinweis „der Plan ist angepasst". Die Beschwerde lief vorher, die Wahl
  // danach, und die Wahl kannte keine Sperren. Zwanzig solcher Paare im Plan.
  const tabu = gesperrt(s.injuries || [], m);
  const anfaenger = (s.level || 'geuebt') === 'anfaenger';
  const wahl = s.fassung || {};
  let getauscht = false;
  const raus = ex.map((it) => {
    const ersatz = (EX_BY_ID.get(it.id) || {}).anfaenger;
    // Eine eigene Wahl schlägt die Stufe, in beide Richtungen: Wer die
    // schwerere wählt, bekommt sie auch als Anfänger, wer die leichtere wählt,
    // auch als Geübter. Zugelassen ist nur die Kette aus leichter und
    // schwerer (`anfaenger`), nicht jede Übung mit denselben Anteilen:
    //
    //     „ich will generell keine Alternativen, sondern höchstens nur statt
    //      + die schwerere Übungs-Version, ähnlich wie bei den gelben und
    //      roten Bändern"
    //
    // Bis v205 zählte alles mit exakt gleichen Muskelanteilen dazu (beim
    // Seitheben vier Übungen). Wer eine Übung nicht verträgt, hakt das unter
    // Beschwerden an; dort entscheidet die App, was wegfällt und was einspringt.
    const gleich = stufenKette(it.id);
    const eigene = gleich.includes(wahl[it.id]) && !tabu.has(wahl[it.id]) ? wahl[it.id] : null;
    const leicht = ersatz && EX_BY_ID.has(ersatz) && !tabu.has(ersatz) ? ersatz : null;
    if (!eigene && !leicht) return it;
    const ziel = eigene || (anfaenger && leicht ? leicht : it.id);
    if (ziel === it.id) return it;
    getauscht = true;
    return { ...it, id: ziel, statt: it.id, stattWarum: eigene ? 'fassung' : 'stufe' };
  });
  return getauscht ? raus : ex;
}

/**
 * Die beiden Fassungen einer Übung: leicht und schwer.
 *
 *     „Lass machen dass wenn man bei knieheben im Liegen auf + drückt man
 *      automatisch zu knieheben an der Stange kommt. Also die Übung sozusagen
 *      umgewandelt wird. Genauso natürlich bei minus anders herum"
 *
 * Die Beziehung steht seit jeher im Katalog: `anfaenger` nennt zu einer Übung
 * die leichtere Ausführung derselben Bewegung. Sie war nur nicht anfassbar –
 * getauscht wurde allein über die Erfahrungsstufe unter *Mehr*, und die gilt
 * für alles auf einmal und ist ausdrücklich keine Einstellung, sondern etwas,
 * das die App misst.
 *
 * `id` ist hier immer die Übung, wie sie **im Plan** steht – also die schwere.
 * Daran hängt die Wahl, damit sie nicht davon abhängt, was gerade angezeigt
 * wird: Sonst hieße „ich will die schwere" beim nächsten Öffnen „ich will die,
 * die gerade dasteht", und der Schalter kippte mit sich selbst.
 */
/**
 * Alle Übungen mit genau denselben Muskelanteilen – in *beiden* Modi.
 *
 * Gerechnet beim ersten Bedarf und dann gemerkt: Der Katalog ändert sich zur
 * Laufzeit nicht.
 *
 * **In beiden Modi, und das ist keine Kleinigkeit.** Das Seitheben zerfällt im
 * Hantel-Modus in eine Klasse von vier und im Bodyweight-Modus in zwei
 * Klassen von zwei – wer nur einen Modus prüft, bietet einen Tausch an, der im
 * anderen die Wochenziele verschiebt. Verlangt wird deshalb Gleichheit in
 * beiden.
 */
let anteilsgleichCache = null;

function anteilsgleich() {
  if (anteilsgleichCache) return anteilsgleichCache;
  const map = new Map();
  EXERCISES.forEach((e) => {
    const key = JSON.stringify([Object.entries(e.db.shares).sort(),
                                Object.entries(e.bw.shares).sort()]);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(e.id);
  });
  anteilsgleichCache = new Map();
  map.forEach((ids) => ids.forEach((id) => anteilsgleichCache.set(id, ids)));
  return anteilsgleichCache;
}

/**
 * Die Übungen, zwischen denen man an dieser Stelle wählen darf.
 *
 *     „Gibt es nicht mehr bauchübungen auf der Welt als die beiden?"
 *
 * Gibt es, und drei davon stehen längst im Katalog – wählen konnte man sie
 * nur nicht. Bis v187 gab es hier ein Paar aus leicht und schwer, gebaut auf
 * dem Katalogfeld `anfaenger`; damit standen genau zwei Übungen zur Wahl, und
 * auch die nur beim Knieheben. Dabei gibt es **sieben** Gruppen im Katalog,
 * in denen mehrere Übungen dieselben Muskelanteile haben – Seitheben sogar
 * vier. In keiner davon konnte man tauschen.
 *
 * Maßstab ist die Gleichheit der Anteile und nicht die Ähnlichkeit der
 * Bewegung. Das ist die harte Bedingung: Nur so bleibt die Wochenrechnung
 * Ziffer für Ziffer stehen, egal was gewählt wird. Was sich ändert, ist die
 * Ausführung – und genau darum geht es.
 *
 * `wie` sagt, wo eine Übung im Verhältnis zur Plan-Übung steht, soweit der
 * Katalog es weiß (`anfaenger`): 'leichter', 'schwerer' oder null für „anders,
 * nicht leichter oder schwerer". Geraten wird nichts.
 */
export function fassungen(item) {
  if (!item) return null;
  const plan = item.statt || item.id;
  const kette = stufenKette(item.id);
  if (kette.length < 2) return null;
  const leichter = (EX_BY_ID.get(item.id) || {}).anfaenger || null;
  const schwerer = (EXERCISES.find((e) => e.anfaenger === item.id) || {}).id || null;
  return { plan, jetzt: item.id, leichter: leichter && EX_BY_ID.has(leichter) ? leichter : null, schwerer };
}

/**
 * Die Übung selbst, ihre leichtere und ihre schwerere Ausführung – soweit der
 * Katalog sie kennt (`anfaenger`). Mehr steht nicht zur Wahl.
 */
export function stufenKette(id) {
  const leichter = (EX_BY_ID.get(id) || {}).anfaenger;
  const schwerer = (EXERCISES.find((e) => e.anfaenger === id) || {}).id;
  return [id, leichter, schwerer].filter((x) => x && EX_BY_ID.has(x));
}

/**
 * Wofür diese Übung eingesprungen ist – und warum.
 *
 * Drei Filter tauschen inzwischen Übungen aus: die eigene Wahl an der Übung
 * selbst, die Erfahrungsstufe und der Gerätevorrat. Alle schreiben `statt` an
 * den Eintrag, `stattWarum` unterscheidet sie. Ohne Angabe ist es die Stufe –
 * so war es zuerst, und alte Einträge tragen bis heute nur `statt`.
 */
export const ersatzGrund = (item) => (item && item.statt
  ? { statt: item.statt, warum: item.stattWarum || 'stufe' } : null);

/**
 * Was an einem Plantag am Vorrat scheitert – getauscht oder weggefallen.
 *
 * Anders als bei den Verletzungen hängt das am Modus: Im Bodyweight-Modus
 * braucht keine Übung eine Kurzhantel, im Hantel-Modus keine ein Band, wo eine
 * Hantel danebenliegt. Deshalb wird es hier gerechnet und nicht in
 * adjustedPlan(), das den Modus gar nicht kennt.
 */
export function vorratNotiz(w, mode) {
  if (istCustom(w.n) || nichtsAbgewaehlt()) return { getauscht: [], weg: [] };
  const m = mode || store.workoutMode(w.n);
  const r = vorratFassung(gestufteSaetze(w, m), m);
  return { getauscht: r.getauscht, weg: r.weg };
}

/**
 * Der Plantag mit den Satzzahlen, die hier gelten – Verletzungen und
 * Erfahrungsstufe schon eingerechnet, der Vorrat noch nicht.
 *
 * Der Modus bestimmt die Satzzahl, die Erfahrung skaliert sie. Beides muss hier
 * passieren und nicht erst beim Anzeigen: Ab workoutByNo() reicht die App nur
 * noch `sets` weiter, und wer dort die falsche Zahl hineingibt, bekommt sie in
 * der Fortschrittsanzeige, im Protokoll und in der Statistik wieder heraus.
 * Siehe bw_saetze() in tools/build-plan.py.
 *
 * **Vor dem Vorrat und nicht danach:** Was wegfällt, soll mit den Sätzen
 * wegfallen, die es an diesem Tag wirklich gehabt hätte. Sonst nennte
 * vorratNotiz() für einen Anfänger im Bodyweight-Modus einen Verlust, den es in
 * dieser Höhe nie gab.
 */
export function planSaetze(w, mode) {
  return istCustom(w.n) ? w.ex : gestufteSaetze(w, mode || store.workoutMode(w.n));
}

function gestufteSaetze(w, m) {
  // Festgeschrieben bei einem Planwechsel (planWechsel() in js/app.js): Diese
  // Einheit war schon angefangen oder trainiert, und hinter ihrer Nummer steht
  // im neuen Plan etwas anderes. Sie bleibt, wie sie war – samt der Satzzahl
  // jenes Tages, deshalb hier vor der Stufe und ohne sie.
  const fest = (store.getState().log[w.n] || {}).fest;
  if (Array.isArray(fest) && fest.length) {
    return fest.filter((it) => EX_BY_ID.has(it.id)).map((it) => ({ id: it.id, sets: it.sets, bwSets: it.sets }));
  }
  // Erst die Stufe, dann der Vorrat. Die Anfängerfassung einer Übung braucht
  // oft weniger Gerät – das hängende Knieheben die Klimmzugstange, das liegende
  // nichts. Andersherum fiele sie weg, statt getauscht zu werden.
  const geplant = anfaengerFassung(adjustedPlan()[w.n - 1] || w.ex, m);
  return geplant.map((it) => {
    const roh = m === 'bw' && it.bwSets ? it.bwSets : it.sets;
    const sets = satzZahl(roh);
    return sets === it.sets ? it : { ...it, sets };
  });
}

/**
 * Wie viele Übungen eine Einheit hat – ohne die Reihenfolge festzuschreiben.
 *
 * exBasis() sortiert im Hantel-Modus nach Rüstaufwand und merkt sich das
 * Ergebnis (ruestCache), damit die Karten unter dem Finger nicht springen. Wer
 * bloß zählen will, darf diesen Merkzettel nicht füllen: Sonst stünde die
 * Reihenfolge aller 84 Einheiten fest, sobald eine Ansicht einmal gezeichnet
 * wurde – festgeschrieben mit den Gewichten von genau diesem Augenblick, statt
 * mit denen vom ersten Ansehen der Einheit. Die Länge hängt an Stufe,
 * Verletzungen und Vorrat, nicht an der Reihenfolge.
 */
export function tagLaenge(w, mode) {
  if (istCustom(w.n)) return w.ex.length;
  const m = mode || store.workoutMode(w.n);
  return vorratFassung(gestufteSaetze(w, m), m).items.length;
}

/**
 * Was schon trainiert ist, bleibt stehen.
 *
 * Gefunden bei der Durchsicht der ganzen App, und es war der schwerste Befund
 * nach dem Sicherheitsloch: Der Plan einer Einheit wird bei jedem Anzeigen neu
 * gerechnet – aus dem geschriebenen Plan, den *heutigen* Beschwerden, der
 * *heutigen* Stufe, der *heutigen* Wahl und dem *heutigen* Gerätevorrat. Das
 * galt auch für Einheiten, die längst trainiert waren. Gemessen: Woche 1
 * vollständig abgehakt, danach „Tennisarm" angehakt – und die Einheit stand als
 * 9 von 12 da, die Statistik zählte 9 statt 18 Sätze. „Gestern Padel"
 * nachgetragen, und Hip Thrust und Wadenheben galten rückwirkend als
 * ausgefallen, obwohl sie gemacht waren. Die Sätze lagen weiter im Protokoll,
 * nur unter einer Übung, die der Plan nicht mehr kannte.
 *
 * Deshalb hier die Regel: **Jede Übung, zu der in dieser Einheit etwas
 * protokolliert ist, steht wieder da** – an der Stelle der Übung, aus der sie
 * geworden ist. Was noch nicht angefasst wurde, bleibt beweglich: Wer mitten
 * in der Einheit eine Beschwerde anhakt, will, dass die *kommenden* Übungen
 * getauscht werden, nicht die, die er gerade gemacht hat.
 *
 * Kein Schnappschuss, sondern gerechnet aus dem Protokoll, und das mit Absicht:
 * So wirkt es auch für alle Wochen, die vor dieser Fassung trainiert wurden,
 * und es gibt keine zweite Wahrheit, die mit der ersten auseinanderlaufen kann.
 *
 * „Aus der sie geworden ist" heißt: verwandt über die Wege, auf denen die App
 * Übungen tauscht – gleiche Anteile, leichte/schwere Fassung, Ersatz einer
 * Beschwerde –, und das über höchstens zwei Schritte (Beschwerde tauscht A auf
 * B, eigene Wahl macht aus B ein C).
 */
let verwandtCache = null;
function verwandte(id) {
  if (!verwandtCache) {
    const k = new Map();
    const verbinde = (a, b) => {
      if (!a || !b || a === b) return;
      if (!k.has(a)) k.set(a, new Set());
      if (!k.has(b)) k.set(b, new Set());
      k.get(a).add(b);
      k.get(b).add(a);
    };
    anteilsgleich().forEach((ids, a) => ids.forEach((b) => verbinde(a, b)));
    EXERCISES.forEach((e) => verbinde(e.id, e.anfaenger));
    INJURIES.forEach((inj) => Object.entries(inj.swap || {}).forEach(([a, b]) => verbinde(a, b)));
    verwandtCache = k;
  }
  return verwandtCache.get(id) || new Set();
}

function protokolliert(n) {
  const e = store.getState().log[n];
  const ids = new Set();
  if (!e) return ids;
  ['db', 'bw'].forEach((m) => Object.entries(e[m] || {}).forEach(([id, arr]) => {
    if (Array.isArray(arr) && arr.some((x) => x.done || !!x.w || !!x.wie)) ids.add(id);
  }));
  return ids;
}

function behalteProtokolliertes(n, items) {
  const da = protokolliert(n);
  if (!da.size) return items;
  const fehlen = [...da].filter((id) => EX_BY_ID.has(id) && !items.some((it) => it.id === id));
  if (!fehlen.length) return items;
  const out = items.map((it) => ({ ...it }));
  const nah = (it, x) => [it.id, it.statt, it.from].filter(Boolean).some((y) => y === x
    || verwandte(y).has(x) || [...verwandte(y)].some((z) => verwandte(z).has(x)));
  const soll = (store.getState().log[n] || {}).soll || {};
  fehlen.forEach((x) => {
    const ziel = out.find((it) => !da.has(it.id) && !it.gehalten && nah(it, x));
    if (ziel) {
      // Die Stelle behält ihre Satzzahl; nur die Übung ist die, die gemacht
      // wurde. Ein Tauschvermerk („statt …") gehört nicht mehr dazu – das war
      // ein Tausch, der für diesen Tag nie galt.
      Object.assign(ziel, { id: x, gehalten: true, statt: null, stattWarum: null });
      delete ziel.from;
    } else {
      // Gar keine Stelle mehr, etwa weil eine Beschwerde die Übung heute
      // ersatzlos streicht: Sie kommt trotzdem wieder hinein. Gemacht ist gemacht.
      const sets = soll[x] || 3;
      out.push({ id: x, sets, bwSets: sets, gehalten: true });
    }
  });
  return out;
}

export function exBasis(w, mode) {
  if (istCustom(w.n)) return w.ex;
  const m = mode || store.workoutMode(w.n);
  const vorher = vorratFassung(gestufteSaetze(w, m), m).items;
  const items = behalteProtokolliertes(w.n, modusTausch(vorher, activeInjuries(), m).items);
  // Nur bei den Hanteln: Im Bodyweight-Modus gibt es nichts umzubauen, und die
  // Reihenfolge soll dann die des Plans bleiben.
  return m === 'db' ? ruestOrderStabil(items, w.n, 'db') : items;
}

/* ------------------------------------------------------------------ *
 * Nacharbeit: was diese Woche liegen geblieben ist
 *
 * Wer eine Einheit nicht zu Ende macht, verlor die fehlenden Sätze bisher
 * ersatzlos – "Abschließen" zählt den Tag als trainiert, und der Plan ging
 * weiter, als wäre nichts gewesen. Das Wochenziel je Muskelgruppe, auf das
 * dieser Plan exakt gerechnet ist, stimmte dann für diese Woche nicht mehr.
 *
 * **Nur innerhalb derselben Woche.** Das ist keine technische Grenze, sondern
 * die Trainingslehre: Volumen wirkt über die Zeit, in der es anfällt. Was drei
 * Wochen später nachgeholt wird, ist kein Ausgleich, sondern eine zusätzliche
 * Belastung zur Unzeit – und ein Rückstand, der über Wochen mitwächst, führt zu
 * Einheiten, die niemand mehr schafft.
 *
 * **Gedeckelt.** Höchstens ein Satz je Übung und drei je Einheit. Eine Einheit
 * soll wiedererkennbar bleiben, und mehr als das wäre auch nicht mehr die
 * Belastung, für die die Erholungsregel gerechnet ist.
 *
 * **Ohne Aufschaukeln.** Gemessen wird gegen den Plan *ohne* Nacharbeit
 * (exBasis). Wer die nachgetragenen Sätze auch liegen lässt, bekommt sie nicht
 * ein zweites Mal obendrauf.
 *
 * **Nur nach oben.** Hier stand einmal auch die Gegenrichtung: Wer über Wochen
 * nur einen Teil schafft, dem hätte die App die Einheiten von selbst gekürzt.
 * Das ist wieder raus, auf ausdrücklichen Wunsch – die Erfahrungsstufe gehört
 * dem Nutzer, und eine App, die sie ungefragt senkt, nimmt ihm eine
 * Entscheidung ab, um die er nicht gebeten hat. Wer kürzere Einheiten will,
 * nimmt den Fokus Cut; die Stufe selbst ist seitdem eine Messung, keine
 * Einstellung (erfahrungStand in js/ansicht-statistik.js).
 * ------------------------------------------------------------------ */

// Vier Einheiten sind eine Woche. Steht bewusst hier oben und nicht bei der
// Wochenauswertung, wo es hingehört: Das `ui`-Objekt ruft defaultWorkoutNo()
// noch während der Modulauswertung auf, und das geht über completedMode() bis
// hierher. Eine weiter unten stehende Konstante ist zu diesem Zeitpunkt noch
// nicht initialisiert – und der Fehler zeigt sich erst, sobald ein Protokoll
// da ist, weil completedMode() ohne Protokoll vorher aussteigt.
export const WEEK_SESSIONS = 4;

export const NACH_JE_EINHEIT = 3;

export const NACH_JE_UEBUNG = 1;

/**
 * Ist diese Einheit abgeschlossen? Wie completedMode(), aber über die
 * Plan-Satzzahl ohne Nacharbeit.
 *
 * Eine eigene Fassung, weil completedMode() über workoutByNo() an exOf() geht –
 * und exOf() fragt hier. Das wäre eine Endlosschleife.
 */
/**
 * Abgehakte Sätze einer Übung in einer Einheit – aus beiden Modi zusammen.
 *
 * Gefunden bei der Durchsicht der App: Wer mitten in der Einheit von Hanteln
 * auf Bodyweight wechselt – der Knopf dafür steht über jeder Einheit –, hatte
 * danach laut App nur die Hälfte trainiert. Gezählt wurde allein der Eimer des
 * gerade gewählten Modus: 9 von 18, die Einheit endete nicht von selbst, die
 * nächste bekam drei Sätze Nacharbeit für schon Gemachtes. Der Kommentar am
 * Moduswechsel versprach das Gegenteil.
 *
 * Die Übung ist in beiden Modi dieselbe (nur ihre Ausführung nicht), also
 * zählen die Sätze beider zusammen – gedeckelt auf die Satzzahl, damit
 * dieselbe Übung zweimal gemacht nicht mehr als fertig heißt.
 */
export function saetzeErledigt(n, exId, bis) {
  const e = store.getState().log[n];
  if (!e) return 0;
  const zahl = (m) => (((e[m] || {})[exId]) || []).filter((x) => x && x.done).length;
  return Math.min(bis, zahl('db') + zahl('bw'));
}

/** Modi, in denen in dieser Einheit wirklich abgehakt wurde – der mit den meisten zuerst. */
function modiMitSaetzen(st) {
  const eigene = (m) => Object.values(st[m] || {})
    .reduce((a, arr) => a + (Array.isArray(arr) ? arr.filter((x) => x && x.done).length : 0), 0);
  return ['db', 'bw'].filter((m) => eigene(m) > 0).sort((a, b) => eigene(b) - eigene(a));
}

export function fertigOhneNacharbeit(n) {
  const st = store.getState().log[n];
  const w = PLAN[n - 1];
  if (!st || !w) return null;
  // Nur Modi, in denen auch wirklich trainiert wurde, und der mit den meisten
  // eigenen Sätzen zuerst. Sonst hieße ein zu kurz abgehakter Hantel-Tag
  // „fertig ohne Hanteln", nur weil der Bodyweight-Modus weniger Sätze
  // verlangt – und ein ganz ohne Hanteln trainierter Tag „mit Hanteln", weil
  // der zuerst geprüft wird.
  for (const m of modiMitSaetzen(st)) {
    let total = 0;
    let done = 0;
    exBasis(w, m).forEach((it) => {
      total += it.sets;
      done += saetzeErledigt(n, it.id, it.sets);
    });
    if (total > 0 && done === total) return m;
  }
  // Von Hand abgeschlossen zählt auch – aber nur, wenn überhaupt etwas steht.
  if (st.done) {
    const drin = Object.values(st[st.done] || {})
      .some((arr) => Array.isArray(arr) && arr.some((s) => s.done));
    if (drin) return st.done;
  }
  return null;
}

/** Was in dieser Woche vor `w` liegen geblieben ist, je Muskelgruppe. */
export function offenInWoche(w) {
  const start = Math.floor((w.n - 1) / WEEK_SESSIONS) * WEEK_SESSIONS;
  const fehlt = {};
  let summe = 0;
  for (let i = start; i < w.n - 1 && i < PLAN.length; i++) {
    const x = PLAN[i];
    const mx = fertigOhneNacharbeit(x.n);
    if (!mx) continue;   // noch offen – das ist kein Rückstand, das ist Zukunft
    const eintrag = store.getState().log[x.n] || {};
    // Ohne Stempel: ein Stand aus der Zeit vor dieser Rechnung. Dann bleibt die
    // Einheit draußen, statt an der heutigen Satzzahl gemessen zu werden – die
    // App erfindet lieber keinen Rückstand, als einen zu behaupten, den sie
    // nicht belegen kann.
    if (!eintrag.soll) continue;
    exBasis(x, mx).forEach((it) => {
      const done = saetzeErledigt(x.n, it.id, it.sets);
      // Gemessen wird an der Satzzahl, die an *diesem* Tag galt, nicht an der
      // von heute. Das ist der ganze Punkt:
      //
      //     "Aber heute ist doch erst Dienstag? Montag stand ein Training an,
      //      Dienstag nicht."
      //
      // Vorher stand hier die heutige Zahl. Als die Anfaengerstufe von zwei auf
      // drei Saetze ging, wurde damit jede vorher sauber zu Ende trainierte
      // Einheit derselben Woche rueckwirkend um einen Satz je Uebung zu kurz -
      // und die Nacharbeit legte den erfundenen Rueckstand als "+1 nachgeholt"
      // auf die naechste Einheit.
      //
      // Am Speicher allein ist das nicht zu erkennen: getSets() fuellt die
      // Satzliste beim blossen Ansehen auf die heutige Zahl auf, ein leerer
      // dritter Satz sieht danach aus wie einer, den jemand ausgelassen hat.
      // Und die *Stufe* zu merken reicht auch nicht - "Anfaenger" hiess gestern
      // zwei Saetze und heute drei. Also steht die Zahl selbst im Protokoll
      // (`soll`, siehe getSets() in js/store.js).
      //
      // Eine Uebung ohne Eintrag hat keine Zahl: Sie stand da und wurde gar
      // nicht angefasst, also zaehlt sie ganz als offen.
      const soll = eintrag.soll[it.id];
      const offen = (soll === undefined ? it.sets : Math.min(soll, it.sets)) - done;
      if (offen <= 0) return;
      const shares = EX_BY_ID.get(it.id)[mx].shares;
      Object.entries(shares).forEach(([mus, share]) => {
        fehlt[mus] = (fehlt[mus] || 0) + offen * share;
        summe += offen * share;
      });
    });
  }
  return { fehlt, summe };
}

/**
 * Wie viele Sätze diese Einheit obendrauf bekommt, je Übung.
 *
 * Verteilt wird gierig: Immer der Satz, der vom Rückstand am meisten wegnimmt.
 * Eine Übung zählt dabei mit ihren Anteilen – ein Satz Kniebeugen schließt
 * etwas beim Oberschenkel *und* beim Gesäß.
 */
export function nacharbeit(w, m) {
  if (istCustom(w.n) || !PLAN[w.n - 1]) return null;
  // Eine abgeschlossene Einheit ist Geschichte. Ihr nachträglich Sätze
  // hinzuzufügen, hieße, sie rückwirkend für unfertig zu erklären.
  if (fertigOhneNacharbeit(w.n)) return null;
  const { fehlt, summe } = offenInWoche(w);
  // Unter einem halben Satz lohnt die Unruhe nicht.
  if (summe < 0.5) return null;

  const rest = { ...fehlt };
  const items = exBasis(w, m);
  const extra = new Map();
  for (let k = 0; k < NACH_JE_EINHEIT; k++) {
    let beste = null;
    let bestWert = 0;
    items.forEach((it) => {
      if ((extra.get(it.id) || 0) >= NACH_JE_UEBUNG) return;
      const shares = EX_BY_ID.get(it.id)[m].shares;
      // Was ein zusätzlicher Satz vom Rückstand wirklich wegnimmt – mehr als
      // offen ist, kann er nicht schließen.
      const wert = Object.entries(shares)
        .reduce((a, [mus, share]) => a + Math.min(share, rest[mus] || 0), 0);
      if (wert > bestWert) { bestWert = wert; beste = it; }
    });
    if (!beste || bestWert < 0.25) break;
    extra.set(beste.id, (extra.get(beste.id) || 0) + 1);
    Object.entries(EX_BY_ID.get(beste.id)[m].shares).forEach(([mus, share]) => {
      rest[mus] = Math.max(0, (rest[mus] || 0) - share);
    });
  }
  return extra.size ? extra : null;
}

/** Wie viele Sätze einer Einheit aus der Nacharbeit stammen. */
export function nachSumme(items) {
  return items.reduce((a, it) => a + (it.nach || 0), 0);
}

/**
 * Übungsliste eines Plantags – Verletzungen, Modus, Erfahrung und Nacharbeit.
 *
 * Alles in der App geht durch diese Stelle. Die nachgetragenen Sätze stehen
 * deshalb schon hier drin und nicht erst in der Anzeige: Protokoll,
 * Fortschritt, Wochenvolumen und Zeitschätzung rechnen dann von selbst mit.
 */
export function exOf(w, mode) {
  if (istCustom(w.n)) return w.ex;
  const m = mode || store.workoutMode(w.n);
  const basis = exBasis(w, m);
  const extra = nacharbeit(w, m);
  if (!extra) return basis;
  return basis.map((it) => (extra.has(it.id)
    ? { ...it, sets: it.sets + extra.get(it.id), nach: extra.get(it.id) }
    : it));
}

/**
 * Ein Plantag mit den Satzzahlen des gewünschten Modus.
 *
 * `mode` ist optional und heißt "der Modus, in dem diese Einheit gerade steht".
 * Wer über *beide* Modi rechnet – completedMode(), die Statistik – muss ihn
 * ausdrücklich mitgeben, sonst bekommt er zweimal dieselben Zahlen und misst
 * den einen Modus am Soll des anderen.
 */
export function workoutByNo(n, mode) {
  if (istCustom(n)) {
    const c = store.customById(n);
    if (c) return { n, date: todayISO(), name: c.name, ex: c.ex, custom: true };
  }
  const w = PLAN.find((x) => x.n === n) || PLAN[0];
  const ex = exOf(w, mode);
  return ex === w.ex ? w : { ...w, ex };
}

/** Variante (db/bw) einer geplanten Übung inkl. Sätze. */
export function resolve(item, mode) {
  const ex = EX_BY_ID.get(item.id);
  const v = ex[mode];
  const stufe = stufenWerte(v);
  return {
    id: item.id, sets: item.sets, group: ex.group,
    // Wie viele dieser Sätze aus der Nacharbeit stammen – siehe nacharbeit().
    // Muss mitwandern: Ab hier sieht die Anzeige nur noch das, was hier steht,
    // und eine Einheit, die kommentarlos wächst, ist eine Zumutung.
    nach: item.nach || 0,
    // Wofür diese Übung eingesprungen ist, wenn die Anfängerstufe getauscht hat.
    // Muss mitwandern wie `nach`: Ab hier sieht die Anzeige nur noch das, was
    // hier steht – und ein stiller Tausch wäre genau die Sorte Änderung, die
    // diese App nicht macht.
    statt: item.statt || null,
    stattWarum: item.stattWarum || null,
    name: v.name, reps: stufe.reps, equip: v.equip, cue: v.cue, rest: stufe.rest,
    pattern: v.pattern, muscles: v.muscles,
    // Die ausführliche Erklärung hängt an der Übung, gefiltert nach Modus.
    // Hier stand, Griff, Aufbau und Fehler seien in beiden Fassungen dieselben.
    // Oft stimmte das nicht: Bei „Enge Liegestütze" erklärte die Karte, warum
    // zwei Hanteln besser sind als eine Stange, bei der Standwaage den Griff an
    // der Langhantel. Ein Abschnitt mit drittem Feld 'db' oder 'bw' gilt nur
    // dort; ohne gilt er in beiden.
    detail: (ex.detail || []).filter((d) => !d[2] || d[2] === mode),
    // Dasselbe für „was tun, wenn hier etwas weh tut", mit `modus`.
    schmerz: (() => {
      const s = (ex.schmerz || []).filter((x) => !x.modus || x.modus === mode);
      return s.length ? s : null;
    })(),
    // Zusatzgewicht gibt es nur in der Hantel-Variante und nur, wo die Übung
    // eines kennt – Chin-ups und Sliding Leg Curls etwa nicht.
    weight: mode === 'db' ? ex.weight : null,
    // Gerät der Figur. Bodyweight heißt nicht gerätelos: Ein Loop-Band ist in
    // beiden Varianten dasselbe Gerät, und seit die Bodyweight-Fassungen von
    // Curls, Trizepsdrücken und Schulterdrücken am Band hängen, wäre eine Figur
    // ohne Band schlicht falsch.
    gear: mode === 'db' ? ex.equip : (/band/i.test(v.equip) ? 'band' : null),
    weightNote: ex.weightNote,
  };
}

export function progressOf(n, mode) {
  // Mit dem Modus, nicht ohne: `mode` sagt, aus welchem Eimer die abgehakten
  // Sätze kommen – dann muss auch das Soll aus demselben Modus stammen. Ohne
  // das würde eine im Bodyweight-Modus vollständig gemachte Einheit am Soll
  // der Hantel-Fassung gemessen und käme nie auf "fertig".
  const w = workoutByNo(n, mode);
  let done = 0;
  let total = 0;
  w.ex.forEach((item) => {
    total += item.sets;
    done += saetzeErledigt(n, item.id, item.sets);
  });
  // `complete` heißt weiterhin: jedes Häkchen steht. `erledigt` heißt: der Tag
  // ist trainiert. Meistens dasselbe, aber nicht immer, und der Unterschied
  // trägt zwei Fälle:
  //
  //   Von Hand abgeschlossen. 16 von 18 Sätzen, dann „Abschließen" – der Tag
  //   zählt, die Häkchen sind trotzdem nicht alle.
  //   Erfahrungsstufe gewechselt. Die Satzzahl je Übung hängt daran; aus einer
  //   fertigen 10/10 wird sonst rückwirkend eine 10/15.
  //
  // Was gezählt und angezeigt wird, bleibt ehrlich: done und total ändern sich
  // nicht. Nur die Frage „ist hier noch etwas zu tun" wird richtig beantwortet.
  const st = store.getState().log[n];
  return {
    done,
    total,
    pct: total ? Math.round((done / total) * 100) : 0,
    complete: total > 0 && done === total,
    erledigt: (total > 0 && done === total) || !!(st && st.done === mode),
  };
}

/** Ist das Workout in irgendeinem Modus abgeschlossen? Gibt den Modus zurück. */
export function completedMode(n) {
  const st = store.getState().log[n];
  if (!st) return null;
  // Nur Modi, in denen trainiert wurde (siehe fertigOhneNacharbeit): Seit die
  // Sätze beider Modi zusammen zählen, wäre sonst jede Einheit „mit Hanteln"
  // fertig, weil dieser Modus zuerst gefragt wird.
  for (const m of modiMitSaetzen(st)) {
    if (progressOf(n, m).complete) return m;
  }
  // Von Hand abgeschlossen: "Abschließen" heißt, dass die Einheit fertig ist –
  // auch wenn der letzte Satz Wadenheben fehlt. Ohne das stand im Kalender ein
  // ausgefallener Tag, obwohl 16 von 18 Sätzen standen.
  return st.done && hasAnyEntry(n, st.done) ? st.done : null;
}

export function hasAnyEntry(n, mode) {
  const w = workoutByNo(n, mode);
  return w.ex.some((item) => (store.peekSets(n, mode, item.id) || [])
    .some((s) => s.done || s.w !== ''));
}

/**
 * Die Zahlen der Statistik an einer Stelle.
 *
 * Ausgelagert, weil sie zweimal gebraucht werden: für den Statistik-Tab und
 * für den Stand, den man Freunden schickt. Zwei Rechnungen für dieselbe Zahl
 * wären zwei Zahlen.
 */
export function sammleStats() {
  const log = store.getState().log;
  const today = todayISO();

  let setsDone = 0;
  let repsTotal = 0;
  let volume = 0;
  let doneDb = 0;
  let doneBw = 0;
  const perEx = new Map();

  PLAN.forEach((w) => {
    const entry = log[w.n];
    if (!entry) return;
    ['db', 'bw'].forEach((m) => {
      exOf(w, m).forEach((item) => {
        const arr = entry[m] && entry[m][item.id];
        if (!Array.isArray(arr)) return;
        // Gerechnet wird mit gezaehlteReps(): der unteren Grenze des Bereichs,
        // und der oberen nur dort, wo der Satz ausdrücklich als "oben raus"
        // beantwortet wurde. Bewusst eher zu niedrig als zu hoch.
        const reps = stufenWerte(EX_BY_ID.get(item.id)[m]).reps;
        arr.forEach((s) => {
          if (!s.done) return;
          const planned = gezaehlteReps(s, reps);
          setsDone++;
          repsTotal += planned;
          const kg = parseFloat(String(s.w).replace(',', '.'));
          if (m === 'db' && !Number.isNaN(kg)) volume += kg * planned;
          perEx.set(item.id, (perEx.get(item.id) || 0) + 1);
        });
      });
    });
    const cm = completedMode(w.n);
    if (cm === 'db') doneDb++;
    else if (cm === 'bw') doneBw++;
  });

  const workoutsDone = doneDb + doneBw;

  // Aktuelle Serie: rückwärts ab dem letzten fälligen Workout
  let streak = 0;
  const past = PLAN.filter((w) => effDate(w) <= today);
  for (let i = past.length - 1; i >= 0; i--) {
    if (completedMode(past[i].n)) streak++;
    else break;
  }

  // Eigene Einheiten zählen nicht als Plan-Einheit, ihre Sätze und Kilo aber
  // schon: Trainiert ist trainiert, und eine Statistik, die das verschweigt,
  // ist falsch.
  // Zeit im Training, aus dem Protokoll. Ältere Einheiten haben keine – die
  // Uhr wurde erst später mitgeschrieben; gezählt wird deshalb auch, wie viele
  // Einheiten überhaupt eine Zeit tragen.
  let seconds = 0;
  let mitZeit = 0;
  Object.values(log).forEach((e) => {
    if (e && e.secs > 0) { seconds += e.secs; mitZeit += 1; }
  });

  let customSets = 0;
  store.customs().forEach((c) => {
    const entry = log[c.id];
    if (!entry) return;
    ['db', 'bw'].forEach((m) => {
      c.ex.forEach((item) => {
        const arr = entry[m] && entry[m][item.id];
        const ex = EX_BY_ID.get(item.id);
        if (!Array.isArray(arr) || !ex) return;
        const reps = stufenWerte(ex[m]).reps;
        arr.slice(0, item.sets).forEach((x) => {
          if (!x.done) return;
          const planned = gezaehlteReps(x, reps);
          setsDone++;
          customSets++;
          repsTotal += planned;
          const kg = parseFloat(String(x.w).replace(',', '.'));
          if (m === 'db' && !Number.isNaN(kg)) volume += kg * planned;
          perEx.set(item.id, (perEx.get(item.id) || 0) + 1);
        });
      });
    });
  });

  const upcoming = PLAN.find((w) => !completedMode(w.n));
  return { setsDone, repsTotal, volume, doneDb, doneBw, perEx, workoutsDone, streak, upcoming,
           customSets, seconds, mitZeit };
}
