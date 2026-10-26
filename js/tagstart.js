/*
 * Den Tag nachziehen: was die App am Zustand weiterschreibt, bevor sie etwas
 * zeigt – beim Laden und beim Tageswechsel.
 *
 *     „Sicher dass man jetzt die Workout zeiten täglich um 17:30 nicht
 *      reinschreiben kann inkl Verschiebung wenn ich mal was verpasse oder
 *      so?"
 *
 *     „Ja aber nur wenn es wirklich keinen Weg gibt wie verschoben wird auch
 *      wenn ich die app nicht öffne"
 *
 * Es gibt einen, und er fängt hier an. Ohne Öffnen der App ändert sich der
 * Plan nur dadurch, dass Tage vergehen: Beim nächsten Öffnen rückt er nach,
 * eine liegen gebliebene Einheit schließt sich ab, die Runde rollt weiter, der
 * Zusatztag wird für heute gerechnet. Was die App an einem Tag zeigen würde,
 * lässt sich deshalb heute schon vorausrechnen – mit genau diesen Schritten,
 * nicht mit einem Nachbau (js/kalender-vorschau.js). Ein Nachbau liefe beim
 * nächsten Update der Regeln auseinander; diese Schritte sind die der App.
 *
 * Dafür müssen sie ohne Oberfläche laufen: in einem Worker, in Node, ohne
 * `ui` und ohne render(). Bis v244 standen sie in js/app.js, mitten in der
 * Anzeige – planWechsel() neben dem Hinweis dazu, rundeWeiter() setzte gleich
 * die Startansicht zurück, tagAbschliessen() beendete die Sitzung samt Ton
 * und Sicherung. Herausgelöst ist nur, was am Zustand rechnet; die Stellen,
 * an denen die Anzeige mitgeht, sind Anschlüsse (tagstartAnschliessen()).
 * Ohne Anschluss rechnet alles still: kein Diagnoseprotokoll, eine liegen
 * gebliebene Sitzung endet nur im Speicher, die Startansicht gibt es nicht.
 *
 * **Die Uhr ist die Quelle für heute und jetzt.** tagNachziehen() nimmt kein
 * Datum entgegen, und das ist Absicht: catchUpPlan(), effDate(),
 * zusatzBindung() und alles darunter fragen todayISO() selbst. Ein Datum, das
 * nur bis hierher reicht, hieße zwei Tage in einer Rechnung. Wer einen anderen
 * Tag rechnen will, stellt die Uhr – so macht es die Vorschau.
 *
 * Reihenfolge und Schritte sind dieselben wie vorher; was die App dabei
 * zeigt, ändert sich nicht (gemessen: dieselben Browsertests vor und nach dem
 * Umzug, siehe README).
 */
import * as store from './store.js';
import { EXERCISES, FOKUS_ERSATZ, PLAN, PLANS, REST } from './data.js';
import { addDays, daysBetween, todayISO } from './dates.js';
import {
  NACH_ANTEIL, WEEK_SESSIONS, ZUSATZ_IN_EINHEIT, ZUSATZ_NAME, ZUSATZ_UEBUNGEN,
  activeInjuries, catchUpPlan, completedMode, defaultWorkoutNo, effDate, einheitEx, exBasis, exOf,
  festerZusatz, hasAnyEntry, istCustom, liegenGeblieben, nacharbeit, offenImBlock, offenerZusatztag,
  progressOf, resolve, saetzeErledigt, shiftToToday, stufenKette, vorherFassung, zusatzBindung,
  zusatzEinheitFuer, zusatzGrund, zusatzIds, zusatzRueckstand, zusatzVergeben, zusatzZaehlt,
} from './plan.js';
import { bilanzAus, pruefeAufstieg, rundenBilanz } from './bilanz.js';
import { EX_BY_ID } from './uebung.js';
import { satzZahl } from './stufen.js';
import { ruestOrder, ruestSchritte } from './gewichte.js';
import { paare } from './supersatz.js';
import { gesperrt } from './injuries.js';
import { geschont } from './termine.js';
import { MUSCLE_LABEL } from './body.js';

/*
 * Die Anschlüsse der Oberfläche – gesetzt von js/app.js, sonst still.
 *
 *   notieren   das Diagnoseprotokoll (notieren() in js/diagnose.js)
 *   beenden    eine liegen gebliebene Sitzung beenden, wie mit dem Knopf
 *              (einheitBeenden() in js/app.js: Zeit buchen bis `bis`, Pause
 *              weg, Aufstieg, Zusatztag, Meldung, Sicherung). Still nur das,
 *              was davon am Zustand rechnet (sitzungStill()).
 *   umlenken   stand die Startansicht auf einer eben abgeschlossenen Einheit?
 *              Dann geht sie zur nächsten – Antwort true, wenn ja.
 *   neueRunde  die Runde ist eben weitergerollt: Startansicht auf Workout 1.
 *
 * Ein Anschluss ist kein Umweg um die Regeln: Er sieht, was passiert ist, und
 * zeigt es; am Zustand ändert er nichts, was die Vorschau anders rechnen
 * würde. einheitBeenden() ist die eine Ausnahme mit Absicht – es rechnet
 * dasselbe wie sitzungStill() und meldet, sichert und gibt Ton dazu.
 */
const startOberflaeche = {
  notieren: () => {},
  beenden: null,
  umlenken: () => false,
  neueRunde: () => {},
};

/** Die Oberfläche anschließen: { notieren, beenden, umlenken, neueRunde }, jedes für sich. */
export function tagstartAnschliessen(anschluss) {
  Object.entries(anschluss || {}).forEach(([k, fn]) => {
    if (k in startOberflaeche && typeof fn === 'function') startOberflaeche[k] = fn;
  });
}

/** Ins Diagnoseprotokoll, wenn eins angeschlossen ist. */
function startNotiz(art, daten, sofort) {
  startOberflaeche.notieren(art, daten, sofort);
}

/**
 * Eine liegen gebliebene Sitzung beenden, ohne Oberfläche: dasselbe am
 * Zustand wie einheitBeenden() in js/app.js – Zeit bis zum letzten
 * Lebenszeichen, Pause weg, Aufstieg und Zusatztag nachrechnen.
 */
function sitzungStill(bis) {
  store.endSession(bis);
  if (store.getState().rest) store.setRest(null);
  pruefeAufstieg();
  pruefeZusatztag();
}

function sitzungBeenden(bis) {
  (startOberflaeche.beenden || sitzungStill)(bis);
}

/* ------------------------------------------------------------------ *
 * Abgeschaffter Trainingsfokus
 *
 * Der Fokus steht im Browser, der Plan in der App. Wird eine Variante
 * gestrichen, treffen sich beim nächsten Laden ein Schlüssel und kein Plan.
 * js/data.js löst das für sich – es lädt den benannten Nachfolger, sonst
 * stünde die halbe App ohne Übungen da. Aber `state.focus` zeigt danach noch
 * auf den alten Wert, und zwei Angaben, die dasselbe meinen sollen, liefen von
 * da an dauerhaft auseinander:
 *
 *   * `restorable()` in js/store.js vergleicht den Fokus eines abgelegten
 *     Durchlaufs mit `state.focus`. Beide stünden auf 'kurz' – ein Protokoll
 *     aus 96 Einheiten ließe sich in einen Plan mit 84 zurückholen und
 *     markierte dort Einheiten als erledigt, die nie stattgefunden haben.
 *   * Die Fokusauswahl hätte keine Karte markiert, weil zu 'kurz' keine
 *     gehört – jeder Plan sähe nicht ausgewählt aus.
 *   * Der Rückkanal meldete weiter „Kurz und knapp" für einen Cut-Plan.
 *
 * Deshalb einmal beim Start umschreiben, und zwar auf demselben Weg wie ein
 * Wechsel von Hand: Der bisherige Verlauf wandert als eigene Runde in die
 * Ablage (mit dem *alten* Fokus als Vermerk – restartPlan() liest ihn, bevor
 * wir ihn ändern), die Gewichte bleiben stehen. Ein Protokoll nach
 * Workout-Nummer in einen anderen Plan zu übernehmen ginge nicht: Workout 12
 * hieß dort etwas anderes.
 * ------------------------------------------------------------------ */
function fokusUmzug() {
  const s = store.getState();
  const alt = s.focus;
  const ziel = FOKUS_ERSATZ[alt];
  if (!ziel || !PLANS[ziel.nach]) return false;
  // Reihenfolge: erst ablegen, dann umschreiben. restartPlan() vermerkt den
  // Fokus, der beim Training galt, und das war der alte.
  const hatteVerlauf = Object.keys(s.log || {}).length > 0;
  // **Nicht** rundenBilanz(): Die rechnet über den Plan, den die App gerade
  // geladen hat – und das ist hier schon der *Nachfolger*. js/data.js löst
  // FOKUS_ERSATZ beim Import auf, lange bevor diese Zeile läuft. Das Protokoll
  // stammt dagegen noch aus dem alten Plan, mit dessen Einheiten und Übungen.
  //
  // Gemessen, was dabei herauskam: ein Gerät mit einer vollständigen
  // „Kurz und knapp"-Runde – 96 Einheiten, 1230 Sätze – bekam eine Bilanz von
  // {0, 0, 0} in die Ablage geschrieben. Ein Cut-Plan gegen ein Kurz-Protokoll
  // gezählt findet fast keine Übung wieder, und die zwölf Einheiten 85–96 sieht
  // er überhaupt nicht. Weil bilanzAus() eine vorhandene Bilanz unbesehen
  // zurückgibt, wäre die Null endgültig gewesen – ausgerechnet auf dem einen
  // Weg, für den die ganze Rechnerei gebaut ist.
  //
  // bilanzAus() nimmt den Fokus der Runde als Ausgangspunkt und kommt deshalb
  // auf die richtigen Zahlen. Es bekommt hier eine Runde gereicht, die es so
  // gleich noch einmal sieht – dieselbe Rechnung, nur eben rechtzeitig.
  // Passt die Ablage nicht mehr in den Speicher, bleibt alles, wie es ist –
  // beim nächsten Start wird es wieder versucht.
  if (!store.wechsleFokus(ziel.nach, bilanzAus({ log: s.log, focus: alt }), frischerStart())) return false;
  store.setSetting('fokusUmzug', {
    von: ziel.name, nach: PLANS[ziel.nach].name, am: todayISO(), abgelegt: hatteVerlauf,
  });
  startNotiz('plan', { was: 'umzug', von: alt, nach: ziel.nach, abgelegt: hatteVerlauf });
  return true;
}

/* ------------------------------------------------------------------ *
 * Der Plan hat sich geändert
 *
 * Ein Protokoll steht nach Workout-Nummer. Kommen Übungen in den Katalog und
 * verteilt der Generator neu, steckt hinter Nummer 3 etwas anderes als an dem
 * Tag, an dem sie abgehakt wurde – und die App behauptete rückwirkend, es sei
 * schon immer das gewesen. Das ist derselbe Fehler wie beim Fokuswechsel, nur
 * ohne dass jemand darauf getippt hätte.
 *
 * Deshalb trägt jede Planvariante seit js/data.js einen Fingerabdruck ihrer
 * Inhalte. Stimmt er nicht mehr mit dem überein, unter dem der laufende Verlauf
 * entstanden ist, werden die Einheiten, die schon angefangen oder trainiert
 * sind, auf das festgeschrieben, was im Protokoll steht (`fest`, siehe
 * gestufteSaetze() in js/plan.js). Die übrigen bekommen den neuen Plan, und
 * die Runde läuft weiter.
 *
 * Bis v204 wanderte stattdessen der ganze Verlauf in die Ablage, und die Runde
 * fing bei eins an. Verloren ging dabei nichts, aber jede Verbesserung am Plan
 * kostete einen Neustart – und damit war jede ein Grund, sie zu unterlassen.
 *
 * Aus dem Protokoll allein, nicht aus dem alten Plan: Der ist beim Laden schon
 * ersetzt. Das Protokoll kennt die Liste trotzdem – beim ersten Anzeigen legt
 * die App für jede Übung der Einheit einen Eintrag an und hält die Satzzahl
 * dieses Tages in `soll` fest.
 *
 * Termine gehen in den Fingerabdruck nicht ein – die verschieben sich im
 * Betrieb ständig und ändern nichts an dem, was zu tun ist.
 * ------------------------------------------------------------------ */
function planWechsel() {
  const s = store.getState();
  const fokus = s.focus || 'standard';
  const jetzt = (PLANS[fokus] || {}).stand || '';
  const vorher = (s.planStand || {})[fokus];
  if (!jetzt) return false;
  // Beim ersten Mal steht nichts da. Das ist kein Wechsel, sondern der Anfang
  // der Buchführung – sonst legte dieses Merkmal bei seiner Einführung jeden
  // laufenden Verlauf einmal weg.
  if (vorher === undefined || vorher === jetzt) {
    if (vorher !== jetzt) {
      store.setSetting('planStand', { ...(s.planStand || {}), [fokus]: jetzt });
    }
    return satzWechsel(fokus, vorher === undefined);
  }
  merkeSaetze(fokus);
  const { listen, ausPlan } = festeListen(s.log || {}, s.mode, vorherPlan(fokus, vorher), vorher);
  const einheiten = store.festschreiben(listen, ausPlan);
  // **Und gesagt wird es auch** – eine Einheit, die plötzlich andere Übungen
  // zeigt, braucht einen Grund, den man lesen kann.
  store.setSetting('planUmbau', { einheiten, fest: true, fokus: (PLANS[fokus] || {}).name || fokus });
  store.setSetting('planStand', { ...(s.planStand || {}), [fokus]: jetzt });
  startNotiz('plan', { was: 'umbau', grund: 'stand', fokus, von: vorher, nach: jetzt, einheiten });
  return true;
}

/** Den Fingerabdruck der Satzzahlen dieses Plans als gesehen vermerken. */
function merkeSaetze(fokus) {
  const s = store.getState();
  const jetzt = (PLANS[fokus] || {}).saetze || '';
  if (jetzt && (s.planSaetze || {})[fokus] !== jetzt) {
    store.setSetting('planSaetze', { ...(s.planSaetze || {}), [fokus]: jetzt });
  }
}

/**
 * Dieselben Übungen, andere Satzzahlen.
 *
 * `stand` sieht nur, welche Übung hinter welcher Nummer steht. Der Neulauf vom
 * 05.10. hat allein die Sätze ohne Hanteln neu verteilt – `stand` blieb gleich,
 * planWechsel() lief nicht, und eine angefangene Einheit bekam still eine
 * andere Satzzahl. Eine abgeschlossene, die mit drei Sätzen fertig war, hätte
 * danach sogar als unfertig gegolten, wenn dort jetzt vier stehen.
 *
 * Deshalb ein zweiter Fingerabdruck nur für die Satzzahlen (`saetze`, siehe
 * tools/build-data.py). Ändert er sich, werden die Einheiten festgeschrieben,
 * in denen etwas passiert ist und deren Satzzahl im trainierten Modus vom
 * neuen Plan abweicht – mit der Zahl jenes Tages aus dem Protokoll (`soll`,
 * ohne Nacharbeit), wie bei einem Planwechsel ohne Plan davor. Die Zahl des
 * anderen Modus kommt aus dem Plan: Sie hat sich dort nicht geändert, oder es
 * wurde in ihm nicht trainiert. Alle übrigen Einheiten bekommen den neuen Plan.
 */
function satzWechsel(fokus, ganzNeu = false) {
  const s = store.getState();
  const jetzt = (PLANS[fokus] || {}).saetze || '';
  const vorher = (s.planSaetze || {})[fokus];
  if (!jetzt) return false;
  // Ganz neu (noch nie ein Plan vermerkt): nichts zu vergleichen. Kennt das
  // Gerät dagegen schon einen Plan, aber noch keinen Satz-Fingerabdruck – jede
  // Fassung vor dieser –, wird geprüft: Ob sich etwas geändert hat, sagt dann
  // das Protokoll selbst, und eine Einheit, deren Zahlen stimmen, bleibt frei.
  if (vorher === jetzt || (vorher === undefined && ganzNeu)) {
    merkeSaetze(fokus);
    return false;
  }
  const stand = (PLANS[fokus] || {}).stand || '';
  const { listen } = festeListen(s.log || {}, s.mode, null, stand);
  const fest = {};
  const ausPlan = {};
  Object.entries(listen).forEach(([n, liste]) => {
    const w = PLAN[Number(n) - 1];
    const e = s.log[n];
    if (!w || !e) return;
    const zahl = (m) => Object.values(e[m] || {})
      .reduce((a, arr) => a + (Array.isArray(arr) ? arr.filter((x) => x && x.done).length : 0), 0);
    let m = e.mode || s.mode || 'db';
    if (zahl('db') || zahl('bw')) m = zahl('bw') > zahl('db') ? 'bw' : 'db';
    const anders = m === 'bw' ? 'db' : 'bw';
    const neu = new Map(exBasis(w, m).map((it) => [it.id, it.sets]));
    const neuAnders = new Map(exBasis(w, anders).map((it) => [it.id, it.sets]));
    if (!liste.some((it) => neu.get(it.id) !== it.sets)) return;
    fest[n] = liste.map((it) => {
      const sonst = neuAnders.get(it.id) ?? it.sets;
      return m === 'bw' ? { id: it.id, sets: sonst, bwSets: it.sets } : { id: it.id, sets: it.sets, bwSets: sonst };
    });
    ausPlan[n] = stand;
  });
  const einheiten = Object.keys(fest).length ? store.festschreiben(fest, ausPlan) : 0;
  if (einheiten) {
    store.setSetting('planUmbau', { einheiten, fest: true, fokus: (PLANS[fokus] || {}).name || fokus });
    startNotiz('plan', { was: 'umbau', grund: 'saetze', fokus, einheiten });
  }
  merkeSaetze(fokus);
  return einheiten > 0;
}

/**
 * Der frühere Plan mit genau diesem Stand – oder null.
 *
 * js/data.js bringt je Variante jeden Plan mit, der seit der Ablage je
 * ausgeliefert war (`vorher`, eine Liste von { stand, ex }). Bis hierher war es
 * einer, der jeweils letzte: Wer eine Fassung übersprungen hatte, lief unter
 * einem Stand, den die App nicht mehr kannte, und eine angefangene Einheit
 * wurde wieder nur aus dem Protokoll festgeschrieben – unter v214 hieß das:
 * das erste Paar. Gesucht wird nach dem Stand und nur nach ihm; ein Plan, der
 * bloß ähnlich aussieht, ist nicht der, unter dem trainiert wurde.
 */
function vorherPlan(fokus, stand) {
  const kette = (PLANS[fokus] || {}).vorher || [];
  return (stand && kette.find((k) => k.stand === stand)) || null;
}

/**
 * Die Übungsliste jeder angefangenen oder trainierten Einheit, aus dem Protokoll.
 *
 * Nur Einheiten, in denen etwas passiert ist (abgehakt, Gewicht, Rückmeldung
 * oder abgeschlossen). Bloß angesehene zählen nicht: Wer vorausblättert, legt
 * dabei Einträge an, und die Einheit soll trotzdem den neuen Plan bekommen.
 *
 * Aus dem Modus, in dem am meisten abgehakt ist. Bei einer abgeschlossenen
 * Einheit nur, was angefasst wurde – eine ausgelassene Übung wird sonst im
 * Nachhinein zu einer offenen. Bei einer angefangenen alles, was dort stand:
 * der Rest ist noch zu tun.
 *
 * `ausPlan` nennt zu jeder Einheit den Stand, aus dem ihre Liste stammt: den
 * des Plans davor, wenn sie ganz aus ihm kommt, sonst `protokollStand`, den
 * Stand, unter dem das Protokoll entstand. store.festschreiben() vermerkt ihn
 * als `festAus`, und festReparieren() weiß damit, dass es dort nichts zu
 * reparieren gibt – repariert werden nur die unvermerkten Listen von v215.
 */
function festeListen(log, grundModus, vorher = null, protokollStand = '') {
  const aktiv = (x) => x && (x.done || x.w || x.wie);
  const out = {};
  const ausPlan = {};
  Object.entries(log).forEach(([n, e]) => {
    if (!e || e.fest) return;
    const zahl = (m) => Object.values(e[m] || {})
      .reduce((a, arr) => a + (Array.isArray(arr) ? arr.filter((x) => x && x.done).length : 0), 0);
    const angefasst = (m) => Object.values(e[m] || {}).some((arr) => Array.isArray(arr) && arr.some(aktiv));
    if (!e.done && !angefasst('db') && !angefasst('bw')) return;
    let m = e.mode || grundModus || 'db';
    if (zahl('db') || zahl('bw')) m = zahl('bw') > zahl('db') ? 'bw' : 'db';
    // Eine angefangene Einheit mit dem Plan davor: ganz, wie sie dort stand.
    // Das Protokoll allein kennt nur die Übungen, die schon angezeigt waren –
    // in der Fokusansicht bis v215 nur das erste Paar (siehe vorherListe()).
    const alt = !e.done && vorherListe(vorher, n, m);
    if (alt) {
      out[n] = alt;
      ausPlan[n] = vorher.stand;
      return;
    }
    const soll = e.soll || {};
    const nach = e.nach || {};
    // Die eingefügten Übungen eines Zusatztags gehören nicht in die feste
    // Liste: Die ist der *Plan* der Einheit, und der Zusatz steht für sich in
    // log[n].zusatz – einheitEx() legt ihn wieder dahinter. Stünde er auch
    // hier, käme er nach einem Planwechsel doppelt, oder seine Sätze zählten
    // als Plan der Woche, in deren Tage er fällt.
    const zus = zusatzIds(e);
    // Ohne die Nacharbeit jenes Tages, aus demselben Grund wie in
    // vorherFassung(): Die feste Liste ist die Basis, exOf() legt die
    // Nacharbeit darauf. Einen Plan, der die Satzzahl des anderen Modus
    // nennte, gibt es hier nicht – dort gilt dieselbe Zahl, wie bisher.
    out[n] = Object.entries(e[m] || {})
      .filter(([id]) => !zus.has(id))
      .filter(([id, arr]) => Array.isArray(arr) && EX_BY_ID.has(id) && (!e.done || arr.some(aktiv)))
      .map(([id, arr]) => ({ id, sets: Math.max(1, (soll[id] || arr.length) - (nach[id] || 0)) }));
    // Auch eine Liste aus dem Protokoll ist seit v216 ganz – die Fokusansicht
    // legt die Einheit beim Öffnen vollständig an. Sie trägt deshalb ebenfalls
    // einen Vermerk, hier den Stand, unter dem das Protokoll entstand. Ohne ihn
    // hielt festReparieren() sie beim nächsten Start für eine der kurzen Listen
    // von v215 und „reparierte" sie gegen einen Plan davor, aus dem sie gar
    // nicht stammt – etwa wenn eine Fassung übersprungen wurde.
    ausPlan[n] = protokollStand || 'protokoll';
  });
  return { listen: out, ausPlan };
}

/**
 * Die Übungsliste der Einheit n im Plan davor, im gegebenen Modus – oder null.
 * Nicht roh, sondern so, wie sie dastand: Stufe, eigene Wahl, Beschwerden und
 * was schon im Protokoll steht (vorherFassung() in js/plan.js).
 */
function vorherListe(vorher, n, mode) {
  const liste = vorher && vorher.ex[Number(n) - 1];
  if (!liste) return null;
  const fassung = vorherFassung(Number(n), liste, mode);
  return fassung.length ? fassung : null;
}

/**
 * Aus welchem früheren Plan eine feste Liste ohne Vermerk stammt, je Variante.
 *
 * `festAus` steht seit v220 an jeder festen Liste. Ohne ihn festgeschrieben
 * haben nur die Planwechsel davor, und von den Ständen der Kette lösten die nur
 * diese ab: den Cut e06a62 (v215 – die kurzen Listen) sowie Bauch-Beine-Po
 * 0b49d3 und Oberkörper 905ce6 (v218). Jeder andere Stand war noch der laufende
 * Plan, als es den Vermerk schon gab; eine Liste ohne Vermerk kann aus ihm
 * nicht kommen. Hier kommt deshalb auch nie etwas dazu – wer heute einen Plan
 * ablöst, schreibt mit Vermerk fest.
 */
const OHNE_VERMERK_AUS = { cut: 'e06a6265485c', bbp: '0b49d3183b5b', oberkoerper: '905ce67222ec' };

/**
 * Angefangene Einheiten, die ein Planwechsel zu kurz festgeschrieben hat.
 *
 *     „Heute nur zwei Übungen?"
 *
 * Mit v215 kam ein neuer Cut-Plan. Eine Einheit, die in der Fokusansicht
 * angefangen war, hatte im Protokoll nur das erste Übungspaar – die Ansicht
 * legte Einträge nur für das an, was sie gerade zeigte –, und planWechsel()
 * schrieb sie auf genau diese zwei fest. Die anderen beiden waren weg.
 *
 * Repariert wird nur, was eindeutig so entstanden ist: nicht abgeschlossen,
 * festgeschrieben, und jede feste Übung steht auch in derselben Nummer des
 * Plans davor, der aber mehr hatte. Dann gilt dessen ganze Liste; die Satzzahl
 * der schon festen Übungen bleibt.
 *
 * „Steht auch dort" heißt: als sie selbst oder als ihre leichtere oder
 * schwerere Fassung (stufenKette). Die feste Liste nennt, was angezeigt war –
 * bei einem Anfänger das liegende Knieheben, wo im Plan das hängende steht.
 * Bis v218 verglich das hier nur die IDs, und genau die Einheit eines Anfängers
 * blieb dann kurz.
 *
 * **Nur Listen aus dem alten Weg übers Protokoll.** Seit v219 schreibt
 * planWechsel() die ganze Liste aus dem Plan davor fest – so, wie sie an dem
 * Tag dastand, also ohne das, was eine Beschwerde oder ein Termin gestrichen
 * hatte. Ist die Beschwerde später abgehakt oder der Termin gelöscht, rechnet
 * vorherListe() mit dem, was *jetzt* gilt, und kommt auf eine längere Liste.
 * Ohne Vermerk sah das hier genau aus wie der Fehler von v215: Die Einheit
 * bekam die gestrichene Übung zurück, und der Hinweis behauptete „Übungen
 * verloren … Das war ein Fehler in der App" – über eine Liste, die richtig
 * war. Solche Listen tragen deshalb `festAus` (den Stand des Plans, aus dem
 * sie stammen) und bleiben hier unberührt; ebenso eine, die schon einmal
 * repariert wurde.
 *
 * **Und nur gegen den Plan, aus dem die Liste kam** (OHNE_VERMERK_AUS). Bis
 * hierher war das „der Plan davor", und der ist seit dem 03.10. ein anderer:
 * Beim Cut der a51fd2 – genau der, in den v215 gewechselt hatte. Eine kurze
 * Liste aus Einheit 3, Kreuzheben und Goblet Squat, stand dort auch drin, nur
 * zwischen Rudern und Face Pull, und wurde mit genau diesen „vervollständigt".
 * Die standen nie in der Einheit; Reverse Fly, das dort stand, fehlte weiter.
 * Ein Präfix der alten Einheit zu verlangen hätte das auch abgefangen, aber
 * nicht jede echte Kurzliste durchgelassen: Die Fokusansicht zeigte als erstes
 * Paar zwei Übungen, die zusammenpassen, nicht die ersten beiden – unter v214
 * etwa Goblet Squat mit Wadenheben, der letzten von fünf.
 *
 * Läuft beim Start **vor** stempleFertige() – warum, steht beim Aufruf unten.
 */
function festReparieren() {
  const s = store.getState();
  const fokus = s.focus || 'standard';
  const vorher = vorherPlan(fokus, OHNE_VERMERK_AUS[fokus]);
  if (!vorher) return 0;
  const passt = (a, f) => [a.id, a.statt, a.from].some((x) => x && stufenKette(x).includes(f.id));
  const ersatz = {};
  Object.entries(s.log || {}).forEach(([n, e]) => {
    if (!e || e.done || e.festAus || !Array.isArray(e.fest) || !e.fest.length) return;
    const alt = vorherListe(vorher, n, e.mode || s.mode);
    if (!alt || alt.length <= e.fest.length) return;
    if (!e.fest.every((f) => alt.some((a) => passt(a, f)))) return;
    ersatz[n] = alt.map((a) => e.fest.find((f) => f.id === a.id) || e.fest.find((f) => passt(a, f)) || a);
  });
  const k = store.festErsetzen(ersatz, vorher.stand);
  if (k) {
    // Ein Hinweis zum Planwechsel, der noch nicht weggetippt ist, bleibt
    // stehen – daneben, nicht darüber. Bis v218 überschrieb die Reparatur ihn,
    // und „ab der nächsten offenen Einheit gelten die neuen Übungen" war weg,
    // bevor es gelesen war. Deshalb zählt `repariert` für sich und `einheiten`
    // bleibt, was planWechsel() hineingeschrieben hat.
    const offen = s.planUmbau;
    store.setSetting('planUmbau', { ...(offen && offen.fest ? offen : {}), repariert: k,
      fokus: (PLANS[fokus] || {}).name || fokus });
  }
  return k;
}

/**
 * Feste Listen, in denen die Nacharbeit schon steht.
 *
 * Von v215 bis v224 schrieb ein Planwechsel eine angefangene Einheit mit der
 * Satzzahl fest, die auf dem Bildschirm stand (`soll`) – und die enthielt die
 * „+1 nachgeholt". exOf() legte die Nacharbeit dann noch einmal obendrauf:
 * Goblet Squat 5(+1) statt 4(+1), die Einheit 23 statt 21 Sätze. Seitdem
 * merkt sich das Protokoll, wie viel von `soll` Nacharbeit war (`nach`, siehe
 * merkeNach() in js/store.js), und vorherFassung() rechnet sie heraus. Für die
 * Listen, die schon so dastehen, und für ein `soll` aus der Zeit davor gibt es
 * diesen Vermerk nicht.
 *
 * **Repariert wird nur, was die Doppelung heute sichtbar macht:** eine Einheit,
 * die noch nicht fertig ist und auf die exOf() jetzt Nacharbeit legt. Dort ist
 * die Nacharbeit des Tages dieselbe Rechnung wie heute – sie misst die Einheiten
 * davor in derselben Woche, und die sind fertig und ändern sich nicht mehr.
 * Abgezogen wird nur an einer Übung, deren feste Zahl genau ihr `soll` ist
 * (also daraus stammt) und deren Nacharbeit nicht vermerkt ist. Danach zeigt
 * die Einheit wieder, was sie vor dem Update zeigte.
 *
 * **Eine fertige Einheit bleibt, wie sie ist.** Auf sie legt exOf() nichts
 * mehr, die Doppelung ist dort unsichtbar – und was an jenem Tag Nacharbeit
 * war, lässt sich aus dem Protokoll nicht mehr sicher sagen: Eine Vier kann
 * „3 + 1" sein oder die vier Sätze eines Fortgeschrittenen. Lieber eine Zahl
 * stehen lassen, die der Nutzer so gesehen hat, als eine erfundene einsetzen.
 *
 * Jede Liste wird einmal angesehen und dann vermerkt (`festNetto`), wie
 * festReparieren() es mit `festAus` hält: Kommt später in derselben Woche
 * Nacharbeit dazu, ist das echte Nacharbeit und kein Grund, nachzurechnen.
 */
function festNachReparieren() {
  const s = store.getState();
  const ergebnis = {};
  Object.entries(s.log || {}).forEach(([k, e]) => {
    const n = Number(k);
    if (!Number.isInteger(n) || !e || e.festNetto || !Array.isArray(e.fest) || !e.fest.length) return;
    const w = PLAN[n - 1];
    const m = store.workoutMode(n);
    const extra = w && !e.done ? nacharbeit(w, m) : null;
    const soll = e.soll || {};
    const nach = e.nach || {};
    ergebnis[n] = e.fest.map((f) => {
      const dazu = (extra && extra.get(f.id)) || 0;
      const feld = m === 'bw' && f.bwSets !== undefined ? 'bwSets' : 'sets';
      if (!dazu || nach[f.id] !== undefined || soll[f.id] !== f[feld] || f[feld] - dazu < 1) return f;
      return { ...f, [feld]: f[feld] - dazu };
    });
  });
  return store.festNetto(ergebnis);
}

/**
 * Auf welchen Tag Workout 1 fällt, wenn ein Fokus frisch anfängt.
 *
 * Der Plan trägt feste Daten; `shift` verschiebt sie. Beim Wechsel auf einen
 * Fokus, in dem noch nie trainiert wurde, stand dieser Wert bisher auf 0 – und
 * weil alle Plandaten in der Vergangenheit liegen, zog catchUpPlan() die erste
 * Einheit sofort auf **heute**. Wer gestern und vorgestern trainiert hat, stand
 * damit vor dem dritten Trainingstag in Folge, nur weil er den Fokus gewechselt
 * hat.
 *
 * Gerechnet wird deshalb wie beim Rundenwechsel: der übliche Abstand zwischen
 * zwei Einheiten, gezählt ab dem letzten Tag, an dem tatsächlich trainiert
 * wurde. Liegt der schon in der Vergangenheit, macht catchUpPlan() daraus von
 * selbst heute – ein Sonderfall für „drei Wochen nicht reingeschaut" ist nicht
 * nötig.
 *
 * Alle Varianten beginnen am selben Datum (js/data.js), die Verschiebung passt
 * also auch auf den Plan, der gleich geladen wird.
 */
export function frischerStart() {
  const tage = Object.values(store.getState().log || {})
    .map((e) => e && e.startedOn).filter(Boolean).sort();
  if (!tage.length) return store.getState().shift;
  const abstand = Math.max(1, daysBetween(PLAN[0].date, PLAN[1].date));
  return daysBetween(PLAN[0].date, addDays(tage[tage.length - 1], abstand));
}

/**
 * Was fertig war, bleibt fertig – einmalig nachgetragen.
 *
 * Bis eben hielt die App nur die Häkchen fest, nicht die Aussage „dieser Tag
 * war fertig". Solange die Satzzahl gleich blieb, war das dasselbe. Sie hängt
 * aber an der Erfahrungsstufe (zwei, drei oder vier Sätze je Übung), und beim
 * Wechsel wurde aus jeder abgeschlossenen Einheit rückwirkend eine halbe.
 *
 * Neue Einheiten stempeln sich beim letzten Haken selbst ab. Für alles, was
 * vorher entstanden ist, holt das hier einmal nach: Was **jetzt** vollständig
 * ist, wird als vollständig vermerkt. Das ist keine Umdeutung, sondern die
 * Aufzeichnung dessen, was ohnehin gerade gilt – und danach überlebt sie jede
 * Umstellung.
 */
function stempleFertige() {
  const log = store.getState().log || {};
  Object.keys(log).forEach((k) => {
    if (log[k].done) return;
    const n = Number(k);
    if (!Number.isInteger(n)) return;    // eigene Einheiten zählen nicht im Plan
    const mode = completedMode(n);
    if (mode) store.markDone(n, mode);
  });
}

/**
 * Der Plan hört nicht auf.
 *
 * Am Ende der 84 Einheiten stand bisher „🎉 Plan geschafft" und ein Knopf „Von
 * vorn beginnen". Beides ist weg, auf Ansage: *„Der Plan soll unendlich
 * laufen."* Eine Runde ist eine Buchführungseinheit, kein Ereignis, das den
 * Nutzer etwas angeht – die Zahlen dazu stehen weiter in der Statistik.
 *
 * Also rollt die Runde hier von selbst weiter: Verlauf in die Ablage, Gewichte
 * bleiben stehen, Workout 1 beginnt neu.
 *
 * **Wann** ist die einzige Frage, die dabei zu entscheiden war. Nicht sofort
 * beim letzten Haken – dann flöge man aus der gerade fertigen Einheit heraus,
 * während man noch draufschaut. Deshalb läuft das dort, wo auch das Nachrücken
 * läuft: beim Öffnen der App und beim Zurückkommen aus dem Hintergrund.
 *
 * **Auf welchen Tag** ergibt sich aus dem Plan selbst: der übliche Abstand nach
 * der letzten Einheit. Liegt der Tag schon in der Vergangenheit, zieht
 * catchUpPlan() ihn ohnehin auf heute – es braucht also keinen Sonderfall für
 * „drei Wochen nicht reingeschaut".
 */
function rundeWeiter() {
  if (PLAN.some((w) => !completedMode(w.n))) return false;
  const letzte = PLAN[PLAN.length - 1];
  const abstand = Math.max(1, daysBetween(PLAN[0].date, PLAN[1].date));
  const ab = addDays(store.startedOn(letzte.n) || effDate(letzte), abstand);
  if (!store.restartPlan(daysBetween(PLAN[0].date, ab), rundenBilanz())) {
    startNotiz('plan', { was: 'runde weiter', ok: false });
    return false;
  }
  startNotiz('plan', { was: 'runde weiter', ok: true, runden: (store.getState().rounds || []).length });
  // Die Startansicht geht auf Workout 1 – das macht die Oberfläche.
  startOberflaeche.neueRunde();
  return true;
}

/*
 * Nicht am Tag eines Starts, der mit einem Umbau des Plans begann
 * (planWechsel() oder festReparieren() beim Start – siehe dort): Die Reparatur
 * vervollständigt nur offene Einheiten, und zwar erst beim Start nach dem
 * Planwechsel. Eine Einheit, die schon vorher abgeschlossen würde, behielte die
 * kurze Liste von v215 – „2 von 6 Sätzen" statt der ganzen Einheit. Der
 * Abschluss kommt dann beim nächsten Laden; diesmal hat die App ohnehin etwas
 * zu sagen (der Hinweis zum Umbau). Hier steht der Tag dieses Starts.
 *
 * Bleibt die Seite offen, am nächsten Tag: Bis zur Nachbesserung galt die
 * Sperre für die ganze Lebensdauer der Seite – und die bleibt oft tagelang im
 * Speicher. Am Montag stand „vor 2 Tagen angefangen · Workout 12", am Mittwoch
 * „vor 4 Tagen", Tobis Bild, nur länger. Dann holt tagAbschliessen() zuerst
 * nach, was der nächste Start davor täte: reparieren, nachrechnen,
 * nachstempeln.
 */
let abschlussWartet = null;

/*
 * Tagesabschluss: Eine liegen gebliebene Einheit schließt sich selbst ab.
 *
 *     „Wieso steht da samstag? Heute ist Sonntag"
 *
 * Tobi, Sonntag 25.10.2026, auf der Startseite: „Tobi · Gestern · Workout 12 /
 * Sa, 24. Oktober 2026 / 4/17 Sätze", darunter „Training fortsetzen" und „Als
 * trainiert markieren". Workout 12 war am Samstag angefangen und nie
 * abgeschlossen worden. Eine angefangene Einheit bleibt auf ihrem Tag
 * (effDate()), und die Startseite zeigt die erste nicht abgeschlossene
 * (defaultWorkoutNo()) – also stand dort Samstag, am Montag hätte „vor 2 Tagen"
 * dagestanden, und Workout 13 wäre nie drangekommen, während catchUpPlan() den
 * Rest des Plans weiterschob. Und was am Samstag liegen blieb, holte nichts
 * nach: Eine offene Einheit trägt keinen Rückstand bei (offenImBlock() in
 * js/plan.js), und der Zusatztag wartet, bis die Woche abgeschlossen ist.
 *
 * Zugesagt war: „Ab dem nächsten Tag wird eine liegengebliebene Einheit
 * automatisch mit dem abgeschlossen, was steht. Oben steht dann eine Zeile
 * dazu und ein Knopf ‚Rest heute machen', falls du doch willst."
 *
 * Den Knopf gibt es seit v244 nicht mehr, und das „OK" daneben auch nicht:
 *
 *     „Ich will nicht zwischen ok und Rest heute wählen können. Es soll von
 *      selbst einfach das optimale passieren"
 *
 * Das Optimale ist, was ohne Knopf geschieht: im Rhythmus bleiben, und was
 * fehlt, verteilen Nacharbeit und Zusatztag (abschlussHinweis() in js/app.js). Die
 * Zeile sagt nur noch, was passiert ist, und geht von selbst. Wer doch in die
 * Einheit zurück will, blättert zu ihr – dort steht „Doch noch weitermachen".
 *
 * Abgeschlossen wird genau wie mit „Als trainiert markieren"
 * (store.markDone() im Modus der Einheit, case 'mark-done' in js/app.js), und alles Weitere
 * folgt von selbst, weil es an completedMode() hängt: die Nacharbeit in den
 * restlichen Einheiten der Woche, nach ihrer letzten der Zusatztag, der
 * Kalender. Wann eine Einheit liegt und ab wie vielen Sätzen sie sich
 * abschließt, steht bei liegenGeblieben() in js/plan.js und LIEGT_AB_MS in
 * js/store.js – kurz: an einem früheren Tag angefangen, mindestens zwei Sätze,
 * seit drei Stunden nichts mehr. Wer über Mitternacht trainiert, merkt davon
 * nichts.
 *
 * Eine Sitzung, die so lange liegt, endet wie mit dem Knopf (einheitBeenden()
 * in js/app.js, ohne Oberfläche sitzungStill()) – Zeit gebucht bis zu ihrem
 * letzten Lebenszeichen, ohne Ton.
 *
 * Läuft beim Laden (nach stempleFertige(), vor rundeWeiter()), beim
 * Zurückkommen in die App und bei offener App um Mitternacht
 * (tagesUhrStellen() in js/app.js). Gibt { einheiten, sitzung, umgelenkt } zurück, oder
 * null, wenn nichts zu tun war.
 */
export function tagAbschliessen() {
  const heute = todayISO();
  // Eine abgelaufene Zeile zum Tagesabschluss räumt der neue Tag weg – sie
  // steht ohnehin nicht mehr da (store.tagesabschluss()), soll aber auch nicht
  // in der nächsten Sicherung mitreisen.
  if (store.abschlussAufraeumen()) startNotiz('tag', { was: 'zeile abgelaufen' });
  if (abschlussWartet) {
    if (!(abschlussWartet < heute)) return null;
    abschlussWartet = null;
    festReparieren();
    festNachReparieren();
    stempleFertige();
    startNotiz('tag', { was: 'umbau nachgezogen' });
  }
  const { einheiten, sitzung } = liegenGeblieben(heute);
  if (!einheiten.length && !sitzung) return null;
  const zeile = einheiten.map((n) => {
    // Der Modus wie bei „Als trainiert markieren" – der der Einheit. Steht
    // dort kein Eintrag (umgeschaltet, ohne abzuhaken), der andere: Sonst wäre
    // sie markiert und trotzdem nicht abgeschlossen (completedMode() verlangt
    // einen Eintrag im Modus des Abschlusses).
    const eigen = store.workoutMode(n);
    const mode = hasAnyEntry(n, eigen) ? eigen : (eigen === 'db' ? 'bw' : 'db');
    const p = progressOf(n, mode);
    store.markDone(n, mode);
    return { n, tag: store.startedOn(n), done: p.done, total: p.total };
  });
  if (zeile.length) store.setzeTagesabschluss({ am: heute, einheiten: zeile });
  // Die Einheiten, die sich eben selbst abgeschlossen haben, und die Sitzung,
  // die liegen blieb – mit dem, was stand, und wann zuletzt etwas geschah.
  startNotiz('tag', {
    was: 'abschluss',
    einheiten: zeile.map((z) => `${z.n}:${z.done}/${z.total}@${z.tag || '?'}`).join(',') || undefined,
    sitzung: sitzung ? sitzung.n : undefined,
    still: sitzung && sitzung.bis ? Math.round((Date.now() - sitzung.bis) / 60000) : undefined,
  }, true);
  if (sitzung) sitzungBeenden(sitzung.bis);
  // Stand die Startseite auf einer davon, geht sie zur nächsten Einheit –
  // sonst stünde dort „Für heute durch" über dem Samstag. Ob sie dort stand,
  // weiß nur die Oberfläche (startOberflaeche.umlenken). Die Aufrufer fragen
  // nach dem Nachrücken und dem Zusatztag noch einmal (`umgelenkt`).
  const umgelenkt = !store.getState().session && !!startOberflaeche.umlenken(einheiten, sitzung);
  return { einheiten, sitzung: !!sitzung, umgelenkt };
}

/** Was der Plan für diese Woche vorsieht, je Muskelgruppe – Verletzungen und
 *  Modus eingerechnet, also dieselbe Rechnung wie beim Abhaken. */
function plannedWeek(block) {
  const acc = {};
  block.forEach((w) => {
    const mode = completedMode(w.n) || store.workoutMode(w.n);
    const eintrag = store.getState().log[w.n] || {};
    const soll = eintrag.soll || {};
    const nachVermerk = eintrag.nach || {};
    exOf(w, mode).forEach((item) => {
      // Für eine schon angefangene Übung gilt die Zahl von *dem* Tag, nicht die
      // von heute. Sonst erfand ein Aufstieg (drei auf vier Sätze) für jede
      // längst trainierte Einheit einen Satz Rückstand je Übung, und aus der
      // Summe wurde ein ganzer „Zusatztag" für eine vollständige Woche –
      // gemessen, bei der Durchsicht der App. Eine Einstellung darf keine
      // Arbeit erzeugen. Kleiner als heute darf die Tageszahl die Planung
      // machen, größer nicht: Was darüber hinausgeht, ist Nacharbeit, und die
      // gehört der Woche, nicht dieser Übung.
      //
      // Deshalb auch ohne die Nacharbeit selbst: Seit sie an einer
      // angefangenen Einheit festgehalten wird (nachFesthalten()), steht sie
      // auch nach dem Abschluss noch in exOf(). Zählte sie hier mit, wüchse
      // das Pensum der Woche um genau die Sätze, die ihren Rückstand schließen
      // – und der Rückstand bliebe auf dem Papier stehen.
      const basis = item.sets - (item.nach || 0);
      const amTag = soll[item.id] === undefined ? undefined
        : soll[item.id] - (nachVermerk[item.id] || 0);
      const sets = amTag === undefined ? basis : Math.min(amTag, basis);
      Object.entries(EX_BY_ID.get(item.id)[mode].shares).forEach(([mus, share]) => {
        acc[mus] = (acc[mus] || 0) + sets * share;
      });
    });
  });
  return acc;
}

export function weeklyDone() {
  const log = store.getState().log;
  const weeks = [];
  for (let k = 0; k < PLAN.length; k += WEEK_SESSIONS) {
    const block = PLAN.slice(k, k + WEEK_SESSIONS);
    const acc = {};
    let any = false;
    block.forEach((w) => {
      const entry = log[w.n];
      if (!entry) return;
      // Nur eine Variante zählen. Wer mit Hanteln anfängt und im
      // Bodyweight-Modus fertig wird, hat die Sätze einmal gemacht, nicht
      // zweimal – gezählt wird die abgeschlossene Variante, sonst die, in der
      // das Workout gerade steht.
      const m = completedMode(w.n) || store.workoutMode(w.n);
      exOf(w, m).forEach((item) => {
        // Beide Modi, jeder mit seinen eigenen Anteilen: Wer mitten in der
        // Einheit umschaltet, hat die Sätze davor trotzdem gemacht.
        // Aber nur zum Auffüllen: Wer dieselbe Übung in beiden Modi ganz
        // abhakt, hat sie einmal gemacht, nicht zweimal.
        const hier = ((entry[m] || {})[item.id] || []).filter((x) => x && x.done).length;
        ['db', 'bw'].filter((mm) => mm !== m).forEach((mm) => {
          const dort = ((entry[mm] || {})[item.id] || []).filter((x) => x && x.done).length;
          const anders = Math.min(dort, Math.max(0, item.sets - hier));
          if (!anders) return;
          any = true;
          Object.entries(EX_BY_ID.get(item.id)[mm].shares).forEach(([mus, share]) => {
            acc[mus] = (acc[mus] || 0) + anders * share;
          });
        });
        const arr = (entry[m] || {})[item.id];
        if (!Array.isArray(arr)) return;
        // Alle abgehakten Sätze, nicht nur die bis zur heutigen Satzzahl.
        // Nachgeholte Sätze liegen über der Satzzahl der Übung – schnitt man
        // sie hier ab, galt der Rückstand der Woche am Ende trotzdem als offen,
        // und wer die Nacharbeit brav mitgemacht hatte, bekam für denselben
        // Rückstand noch einen Zusatztag.
        const done = arr.filter((x) => x.done).length;
        if (!done) return;
        any = true;
        Object.entries(EX_BY_ID.get(item.id)[m].shares).forEach(([mus, share]) => {
          acc[mus] = (acc[mus] || 0) + done * share;
        });
      });
    });
    const soll = plannedWeek(block);
    const nr = weeks.length + 1;
    Object.entries(zusatzBeitrag(nr, acc, soll)).forEach(([mus, v]) => {
      acc[mus] = (acc[mus] || 0) + v;
    });
    weeks.push({ nr, from: block[0], to: block[block.length - 1], acc, soll, any });
  }
  return weeks;
}

/**
 * Was der Zusatztag einer Woche zu ihrer Bilanz beiträgt.
 *
 * Bisher nichts: weeklyDone() las nur die Planeinheiten. Nach einem ganz
 * gemachten Zusatztag (Goblet Squat, Chin-ups, Hammercurls, 9/9) standen in der
 * Statistik genau die Lücken, die er schließen sollte – Oberschenkel 3,0/6,
 * Rücken 4,0/6 –, und es sah aus, als hätte er nichts gebracht. Er gehört der
 * Woche, aus deren Rückstand er gerechnet wurde („Zusatztag Woche N"), nicht
 * der, in deren Tage er fällt.
 *
 * **Nur bis zur Lücke.** Gezählt wird je Muskelgruppe höchstens, was nach den
 * Planeinheiten – Nacharbeit eingeschlossen – noch fehlte. Was die Nacharbeit
 * schon geschlossen hat, schließt der Zusatztag nicht ein zweites Mal, und
 * Volumen für Gruppen ohne Rückstand macht keine Woche voller, als sie geplant
 * war. Trainiert ist es trotzdem: In der Gesamtstatistik zählt jeder Satz
 * (sammleStats() in js/plan.js).
 *
 * Eine umbenannte eigene Einheit ist kein Zusatztag mehr – sie gehört dann
 * dem Nutzer, nicht einer Woche.
 *
 * **Und ein in eine Planeinheit eingefügter genauso.** Seine Sätze stehen im
 * Eimer jener Einheit (log[n].zusatz, einheitEx() in js/plan.js), zählen aber
 * hier – für die Woche, aus der er gerechnet wurde –, und nicht in der Woche,
 * in deren Tage er fällt: plannedWeek() und weeklyDone() lesen nur den Plan
 * der Einheit (exOf()). Je Übung im Modus der Einheit, mit dem anderen Modus
 * nur zum Auffüllen bis zur Satzzahl – wie weeklyDone().
 */
function zusatzBeitrag(nr, acc, soll) {
  const roh = {};
  const log = store.getState().log;
  const dazu = (ex, m, k) => {
    if (!k) return;
    Object.entries(ex[m].shares).forEach(([mus, share]) => {
      roh[mus] = (roh[mus] || 0) + k * share;
    });
  };
  Object.entries(log).forEach(([k, e]) => {
    const n = Number(k);
    if (!Number.isInteger(n) || !PLAN[n - 1]) return;
    const z = festerZusatz(e);
    // Nur aus einer Einheit hinter seiner Woche (zusatzZaehlt()) – sonst
    // schriebe ein Zusatz in Workout 1 einer Woche 2 gut, die noch gar nicht
    // begonnen hat.
    if (!z || z.woche !== nr || !zusatzZaehlt(n, z)) return;
    const m = completedMode(n) || store.workoutMode(n);
    const anders = m === 'bw' ? 'db' : 'bw';
    const zahl = (mm, id) => {
      const arr = (e[mm] || {})[id];
      return Array.isArray(arr) ? arr.filter((x) => x && x.done).length : 0;
    };
    z.ex.forEach((x) => {
      const ex = EX_BY_ID.get(x.id);
      const hier = zahl(m, x.id);
      const dort = Math.min(zahl(anders, x.id), Math.max(0, (m === 'bw' ? x.bwSets : x.sets) - hier));
      dazu(ex, m, hier);
      dazu(ex, anders, dort);
    });
  });
  store.customs().filter((c) => c.name === `Zusatztag Woche ${nr}`).forEach((c) => {
    const e = log[c.id];
    if (!e) return;
    c.ex.forEach((item) => {
      const ex = EX_BY_ID.get(item.id);
      if (!ex) return;
      ['db', 'bw'].forEach((m) => {
        const arr = (e[m] || {})[item.id];
        const done = Array.isArray(arr) ? arr.filter((x) => x && x.done).length : 0;
        if (!done) return;
        Object.entries(ex[m].shares).forEach(([mus, share]) => {
          roh[mus] = (roh[mus] || 0) + done * share;
        });
      });
    });
  });
  const out = {};
  Object.entries(roh).forEach(([mus, v]) => {
    const luecke = Math.max(0, (soll[mus] || 0) - (acc[mus] || 0));
    if (Math.min(v, luecke) > 0) out[mus] = Math.min(v, luecke);
  });
  return out;
}

/* ------------------------------------------------------------------ *
 * Der Zusatztag
 *
 * Die Nacharbeit hat einen Deckel, und der ist gewollt: Höchstens drei Sätze
 * kommen auf eine Einheit obendrauf. Wer aber eine *ganze* Einheit ausgelassen
 * hat, dem fehlen fünfzehn – die passen nirgendwo mehr hinein, ohne dass die
 * nächste Einheit zur Zumutung wird.
 *
 * Also nicht hineinstopfen, sondern danebenstellen. Eine zusätzliche Einheit
 * ist die sauberere Dosis: normale Satzzahl, normale Pausen, und die Übungen
 * sind genau die, die diese Woche zu kurz gekommen sind.
 *
 * Angeboten wird sie erst, wenn die Woche **durch** ist. Solange noch eine
 * Einheit offen steht, ist nichts versäumt – da erledigt die Nacharbeit den
 * Rest, und ein Vorschlag wäre bloß Drängeln.
 *
 * Angelegt wird sie als *eigenes* Workout („Zusatztag Woche N", der Träger),
 * nicht im Plan: Der Plan rechnet sein Wochenvolumen aus festen Einheiten.
 * Abgehakte Sätze zählen trotzdem mit – für die Woche, aus der sie gerechnet
 * wurde (zusatzBeitrag()).
 *
 * **Und an einem Tag mit fälliger Planeinheit steckt sie in dieser Einheit.**
 *
 *     „Was soll das mit zweite Einheit. Wenn heute Übungen dazu kommen dann
 *      soll alles flüssig in EINE Einheit"
 *
 * Bis v238 stand sie dann als „Als zweite Einheit heute" unter dem Start –
 * zwei Einheiten an einem Tag, zwei Starts, zwei Abschlüsse. Und allein auf
 * der Startseite, am Tag davor, verstand niemand, wann und warum: „Check ich
 * nicht. Wann soll ich das machen?" Jetzt sind ihre Übungen Teil der heutigen
 * Einheit (einheitEx() in js/plan.js): ein Start, eine Liste, eine
 * Fokusansicht, Supersätze und Rüst-Reihenfolge über alle, ein Abschluss. An
 * der Übung steht, woher sie kommt (zusatzZeile() in js/app.js). Nur an einem Tag ohne
 * Planeinheit bleibt sie die Einheit des Tages – „Heute · Zusatztag".
 *
 * Eingefügt sind es höchstens ZUSATZ_IN_EINHEIT Übungen, und die
 * Erholungsregel sorgt dafür, dass keine eine Gruppe der Planeinheit direkt
 * trifft: genau das macht sie zu guten Partnern im Supersatz. Bei gleichem
 * Nutzen gewinnt die Übung, die keinen weiteren Umbau kostet (zusatztagEx()).
 * Die Zahlen dazu (ZUSATZ_*) stehen in js/plan.js – warum dort, steht dort.
 * ------------------------------------------------------------------ */

/**
 * Muskelgruppen, die gerade Ruhe brauchen.
 *
 * Dieselbe Regel wie im Generator: Wer in den letzten `REST.days` Tagen direkt
 * dran war – oder es in der nächsten Einheit ist –, kommt nicht in den
 * Zusatztag. Sonst stünde die Erholungsregel, die den ganzen Plan trägt,
 * ausgerechnet für die Einheit nicht, die freiwillig dazukommt.
 *
 * Ausgefallene Einheiten sperren nichts: Was nicht stattgefunden hat, muss auch
 * nicht erholt werden. Und das gilt auch für den Teil einer Einheit, der
 * ausgefallen ist:
 *
 *     „Hab gestern mein Training nicht ganz beendet. Müssten die
 *      muskelgruppen nicht heute dazu kommen oder so?"
 *
 * Vorher sperrte eine abgeschlossene Einheit von gestern *alle* ihre Gruppen,
 * auch die der Übungen, von denen kein Satz abgehakt war. Weil die letzten
 * beiden Einheiten einer Woche an zwei aufeinanderfolgenden Tagen liegen und
 * zusammen jede Gruppe treffen, gab es am Tag danach nie einen Zusatztag –
 * ausgerechnet für das, was liegen geblieben war und gar nicht ermüdet ist.
 * Jetzt sperrt eine angefasste Einheit – abgeschlossen oder angefangen – nur
 * die Gruppen der Übungen, von denen wirklich ein Satz steht, in beiden Modi
 * gezählt (saetzeErledigt). Die abgehakten Sätze sind trainiert, ob die
 * Einheit nun fertig heißt oder nicht. Alles sperrt nur eine Einheit, die
 * noch bevorsteht und nicht angefangen ist; eine verstrichene, nie
 * angefangene sperrt nichts.
 *
 * **Das gilt auch für heute.** Zuerst hing es am Datum: Vergangene Einheiten
 * sperrten nach Trainiertem, alles ab heute alles. Gerechnet wird der
 * Zusatztag aber meist im Augenblick, in dem die letzte Einheit der Woche
 * abgeschlossen wird – an ihrem eigenen Tag. Sie zählte dort als anstehend,
 * und was an ihr ausgelassen war, fehlte im Zusatztag. Dass die Regel gilt,
 * hängt am Stand der Einheit, nicht am Kalender.
 *
 * Eine angefasste Einheit sperrt über alle ihre Übungen (einheitEx()), also
 * auch über die abgehakten eines eingefügten Zusatztags. Eine unberührte
 * sperrt über ihren Plan (exBasis()) – ein noch nicht festgehaltener Zusatz
 * sperrt sich damit nie selbst.
 *
 * **Und was ein Termin heute schont** (geschont() in js/termine.js). Der Plan
 * nimmt an so einem Tag jede Übung heraus, die eine geschonte Gruppe direkt
 * trifft (faelltAus()). Der Zusatztag kannte die Termine nicht: Mit Bouldern
 * am Freitag fiel am Donnerstag der Reverse Fly aus dem Plan – und eben
 * deshalb ruhte die hintere Schulter nicht mehr, und als Zusatz kam die
 * Inverted Row, die Rücken, Nacken, Bizeps und hintere Schulter trifft: genau
 * das, was der Plan derselben Einheit schonte. Was eine geschonte Gruppe
 * *direkt* trifft, nimmt schon zusatzGrund() heraus, mit der Regel des Plans;
 * hier geht es um den Nutzen: Ein Nebenanteil auf einer geschonten Gruppe ist
 * keiner. Zwei Stunden Boxen am Freitag schonen am Donnerstag Nacken und
 * hintere Schulter, nicht aber Rücken und Bizeps – ohne diese Zeile gewannen
 * die Pull-ups vor den Chin-ups, allein über ihre 0,35 Nacken und 0,2 hintere
 * Schulter je Satz. Gerechnet wird der Zusatztag für die Einheit, die heute
 * fällig ist, oder für heute allein (zusatzEinheitFuer() in js/plan.js) –
 * `heute` ist also der Tag, an dem er gemacht wird. Ein anderer ist es nur für
 * die Zeile am Ruhetag: Sie rechnet den Zusatztag, der morgen in die Einheit
 * kommt, mit der Regel von morgen (zusatzMorgen() in js/app.js).
 */
function ruhendeGruppen(heute = todayISO()) {
  const sperre = new Set();
  const direkt = (id, m) => {
    const ex = EX_BY_ID.get(id);
    if (!ex) return;
    Object.entries(ex[m].shares).forEach(([mus, share]) => {
      if (share >= REST.direct) sperre.add(mus);
    });
  };
  PLAN.forEach((w) => {
    const d = effDate(w);
    if (Math.abs(daysBetween(d, heute)) >= REST.days) return;
    const m = completedMode(w.n) || store.workoutMode(w.n);
    const angefasst = store.isStarted(w.n) || !!completedMode(w.n);
    if (!angefasst && d < heute) return;
    (angefasst ? einheitEx(w, m) : exBasis(w, m)).forEach((it) => {
      if (!angefasst || saetzeErledigt(w.n, it.id, it.sets) > 0) direkt(it.id, m);
    });
  });
  geschont(heute).gruppen.forEach((mus) => sperre.add(mus));
  return sperre;
}

/**
 * Die Übungen für einen Zusatztag – oder null, wenn keiner nötig ist.
 *
 * `einheit` ist die Planeinheit, in die er heute eingefügt wird
 * (zusatzEinheitFuer() in js/plan.js), oder null, wenn er allein steht.
 *
 * Gierig zusammengestellt: immer die Übung, die vom Rückstand am meisten
 * wegnimmt. Eine Übung zählt dabei mit ihren Anteilen, ein Satz Kreuzheben
 * schließt etwas bei der Hüftstreckung *und* beim Gesäß.
 *
 * **Nur, was heute geht.** Keine Übung, die eine ruhende Gruppe direkt trifft
 * (ruhendeGruppen()), keine, die eine Beschwerde im Modus sperrt, keine ohne
 * Gerät, keine, die schon in der Einheit steht.
 *
 * **Nur Nutzen, der heute zählt.** Ein Nebenanteil auf einer ruhenden Gruppe
 * ist kein Nutzen: Gemessen an Tobis Donnerstag gewannen die Pull-ups (4,85)
 * vor den Chin-ups (4,65) allein über 0,2 hintere Schulter und 0,35 Nacken –
 * genau die Gruppen, die der Reverse Fly derselben Einheit direkt trifft. Ohne
 * sie liegen die Chin-ups vorn (3,30 gegen 3,20), und das ist die Übung, die
 * am Samstag liegen geblieben ist.
 *
 * **Und nur, was sich trägt** – dieselbe Regel wie bei der Nacharbeit
 * (NACH_ANTEIL): Mindestens die Hälfte dessen, was eine Übung direkt
 * trainiert, muss in den Rückstand gehen. Sonst kamen nach den Pull-ups noch
 * die Chin-ups dazu, für 1,45 von 4,95 direkten Sätzen – fast eine Kopie.
 *
 * **Bei gleichem Nutzen: kein Umbau mehr.** In eine Einheit eingefügt gewinnt
 * im Hantel-Modus die Übung mit weniger Rüstschritten über die ganze Einheit
 * (ruestSchritte() in js/gewichte.js), danach – mit Supersätzen – die mit
 * mehr Paaren. Gemessen am Seitheben: Band- statt Sitzendes Seitheben, drei
 * statt vier Rüstschritte, drei statt zwei Paare. Eine Toleranz gibt es
 * nicht: Der Nutzen bleibt der Maßstab, der Umbau entscheidet nur den
 * Gleichstand.
 *
 * Eingefügt höchstens ZUSATZ_IN_EINHEIT Übungen und mindestens eine; allein
 * höchstens ZUSATZ_UEBUNGEN und mindestens zwei – eine einzelne Übung ist
 * keine Einheit, aber ein guter Zusatz.
 *
 * Je gewählter Übung merkt sich die Rechnung, was sie schließt (`warum`, wie
 * nacharbeitPlan() in js/plan.js): die Gruppen und die Übungen der Woche, die
 * diesen Rückstand hinterlassen haben – in derselben Schleife, nicht in einer
 * zweiten Rechnung daneben.
 */
export function zusatztagEx(woche, mode, einheit = null) {
  // Ab wann ein Rückstand einen Zusatztag trägt, steht an einer Stelle
  // (zusatzRueckstand() in js/plan.js) – die Zeile am Ruhetag fragt dieselbe.
  const rueck = zusatzRueckstand(Object.fromEntries(Object.keys(MUSCLE_LABEL)
    .map((m) => [m, (woche.soll[m] || 0) - (woche.acc[m] || 0)])));
  if (!rueck) return null;
  const { rest, summe } = rueck;

  // Beschwerde, Gerät und Termin mit derselben Prüfung wie die Einheit, die
  // ihn zeigt (zusatzGrund() in js/plan.js) – am Tag, an dem er gemacht wird.
  // Und die Erholungsregel für denselben Tag: Am Tag selbst ist das heute; die
  // Zeile am Ruhetag rechnet so schon den Zusatz von morgen (zusatzMorgen()).
  const tag = einheit ? effDate(einheit) : todayISO();
  const ruht = ruhendeGruppen(tag);
  const sperre = gesperrt(activeInjuries(), mode);
  const satz = satzZahl(3);
  const plan = einheit ? exOf(einheit, mode) : [];
  const imPlan = new Set(plan.map((it) => it.id));
  const anteile = (ex) => ex[mode].shares;
  const kandidaten = EXERCISES.filter((ex) => !zusatzGrund(ex.id, mode, tag, sperre)
    && !imPlan.has(ex.id)
    // Keine Übung, die eine ruhende Gruppe direkt trifft.
    && !Object.entries(anteile(ex)).some(([m, s]) => s >= REST.direct && ruht.has(m)));
  const deckel = einheit ? ZUSATZ_IN_EINHEIT : ZUSATZ_UEBUNGEN;
  const mindestens = einheit ? 1 : 2;
  // Woher der Rückstand kommt: die ganze Woche, mit der Rechnung der Nacharbeit.
  const herkunft = offenImBlock((woche.nr - 1) * WEEK_SESSIONS, woche.nr * WEEK_SESSIONS).herkunft;

  const gewaehlt = [];
  const warum = {};
  const uebrig = { ...rest };
  const wertVon = (ex) => Object.entries(anteile(ex))
    .reduce((a, [m, s]) => a + (ruht.has(m) ? 0 : Math.min(s * satz, uebrig[m] || 0)), 0);
  const traegt = (ex, wert) => {
    const direkt = Object.values(anteile(ex)).filter((s) => s >= REST.direct)
      .reduce((a, s) => a + s, 0) * satz;
    return !(direkt > 0 && wert < NACH_ANTEIL * direkt);
  };
  // **Eingefügt nur so viele Sätze, wie etwas bringen.** Gewählt wird mit
  // der vollen Satzzahl (`satz`), eingefügt mit der kleinsten, die schon
  // genauso viel vom Rückstand schließt. Bei Tobi am Donnerstag schlossen
  // zwei Sätze Chin-ups Rücken (2,0 offen) und Bizeps (1,3 offen) ganz; der
  // dritte brachte nichts mehr – für Woche 2 nicht und für Woche 3 auch nicht
  // (zusatzBeitrag() bucht ihn nur bis zur Lücke). Er kostete einen Satz und
  // eine Pause, und an der Übung stand „am Sa nur 1 von 3 Sätzen abgehakt":
  // Wer nachrechnet, fragt, warum es dann drei sind. Jetzt sind es zwei.
  // Allein bleibt es bei der vollen Satzzahl – dort ist er eine Einheit für
  // sich, nicht ein Anhang an eine.
  const saetzeFuer = (ex) => {
    if (!einheit) return satz;
    const voll = wertVon(ex);
    for (let k = 1; k < satz; k++) {
      const wert = Object.entries(anteile(ex))
        .reduce((a, [m, s]) => a + (ruht.has(m) ? 0 : Math.min(s * k, uebrig[m] || 0)), 0);
      if (wert >= voll - 1e-6) return k;
    }
    return satz;
  };
  // Rüstschritte und Paare der Einheit mit dieser Übung dazu – nur gefragt,
  // wenn zwei Übungen gleich viel bringen.
  const kosten = (ex) => {
    const k = saetzeFuer(ex);
    const liste = [...plan, ...gewaehlt, { id: ex.id, sets: k, bwSets: k }];
    const reihe = mode === 'db' ? ruestOrder(liste) : liste;
    return {
      schritte: mode === 'db' ? ruestSchritte(liste) : 0,
      paare: store.getState().supersatz ? paare(reihe.map((it) => resolve(it, mode)), mode).filter((g) => g.length === 2).length : 0,
    };
  };
  for (let k = 0; k < deckel; k++) {
    let beste = null;
    let bestWert = 0;
    let bestKosten = null;
    kandidaten.forEach((ex) => {
      if (gewaehlt.some((g) => g.id === ex.id)) return;
      const wert = wertVon(ex);
      if (!(wert > 0) || !traegt(ex, wert)) return;
      if (!beste || wert > bestWert + 1e-6) {
        beste = ex; bestWert = wert; bestKosten = null;
        return;
      }
      if (Math.abs(wert - bestWert) >= 1e-6) return;
      // Gleichstand: weniger Umbau, dann mehr Paare, sonst bleibt die erste.
      if (!bestKosten) bestKosten = kosten(beste);
      const hier = kosten(ex);
      if (hier.schritte < bestKosten.schritte
        || (hier.schritte === bestKosten.schritte && hier.paare > bestKosten.paare)) {
        beste = ex; bestWert = wert; bestKosten = hier;
      }
    });
    if (!beste || bestWert < 0.5) break;
    // Was diese Übung schließt, je Gruppe – vor dem Abziehen gemessen, und nur
    // bei Gruppen, die heute nicht ruhen.
    const zu = Object.entries(anteile(beste)).filter(([m]) => !ruht.has(m))
      .map(([m, s]) => ({ m, s, zu: Math.min(s * satz, uebrig[m] || 0) }))
      .filter((x) => x.zu > 0);
    const direkt = zu.filter((x) => x.s >= REST.direct);
    const g = (direkt.length ? direkt : zu).sort((a, b) => b.zu - a.zu).slice(0, 2).map((x) => x.m);
    const anteil = (h) => ((EX_BY_ID.get(h.id) || {})[h.m] || { shares: {} }).shares[g[0]] || 0;
    const q = herkunft
      .filter((h) => anteil(h) >= REST.direct)
      .sort((a, b) => (b.offen * anteil(b) - a.offen * anteil(a)) || (b.n - a.n))
      .slice(0, 3)
      .map((h) => [h.n, h.id, h.abgehakt, h.von, h.m]);
    warum[beste.id] = { g, q };
    const k = saetzeFuer(beste);
    gewaehlt.push({ id: beste.id, sets: k });
    Object.entries(anteile(beste)).forEach(([m, s]) => {
      uebrig[m] = Math.max(0, (uebrig[m] || 0) - s * k);
    });
  }
  if (gewaehlt.length < mindestens) return null;
  return { ex: gewaehlt, warum, fehlt: Math.round(summe), gruppen: Object.keys(rest).length };
}

/**
 * Zusatztag anlegen, wenn eine Woche mit Rückstand zu Ende gegangen ist.
 *
 * Ungefragt – wie der Stufenaufstieg. Ein Knopf, den man erst suchen und dann
 * drücken muss, ist keine Anpassung, sondern eine Hausaufgabe. Wer ihn nicht
 * will, tippt ihn weg; das ist ein Griff statt zwei.
 *
 * Nur für die **zuletzt abgeschlossene** Woche. Eine Woche gilt als
 * abgeschlossen, wenn jede ihrer Einheiten abgehakt oder beendet ist – solange
 * eine offen steht, ist nichts versäumt, und der Plan rückt ohnehin nach.
 *
 * Und dabei fliegen ältere Zusatztage raus, die nie angefasst wurden. Das ist
 * dieselbe Überlegung wie beim Deckel der Nacharbeit: Volumen wirkt dann, wenn
 * es anfällt. Ein unberührter Zusatztag von vor drei Wochen holt nichts mehr
 * nach, er steht nur im Weg.
 */
export function pruefeZusatztag() {
  const geaendert = zusatztagRechnen();
  traegerSitzungLoesen();
  if (geaendert) startNotiz('zusatz', { was: 'zusatztag neu gerechnet' });
  return geaendert;
}

/**
 * Eine Sitzung, die auf einem Zusatztag stand, der jetzt in der Einheit des
 * Tages steckt – oder den es nicht mehr gibt –, endet hier, ohne Buchung
 * (store.sitzungVerwerfen()).
 *
 * Gefunden so: Freitag, Ruhetag, „Heute · Zusatztag", Start getippt, nichts
 * abgehakt, App zu. Sonntag ist Workout 5 fällig, und der Zusatztag steckt
 * darin – aber die Sitzung zeigte noch auf ihn. Statt des Starts stand dort
 * „Zusatztag Woche 1 läuft noch. ▶︎ Zurück zu Zusatztag Woche 1", und das
 * führte über render() zurück auf dieselbe Einheit, im Kreis. Nach dem ersten
 * Satz war der Träger verbraucht, und es hieß „Eigenes Workout läuft noch":
 * genau der zweite Start und die zweite Einheit, die weg sein sollten.
 *
 * Läuft bei jeder Prüfung des Zusatztags mit – beim Start, beim Tageswechsel,
 * nach dem Vorziehen –, denn genau dort kann er in eine Einheit wandern. Eine
 * Sitzung auf einem selbst gebauten Workout oder auf einem Zusatztag, der
 * allein steht oder schon angefangen ist, bleibt, wie sie ist.
 */
function traegerSitzungLoesen() {
  const s = store.getState().session;
  if (!s || !istCustom(s.n)) return;
  const c = store.customById(s.n);
  if (c && !traegerGebunden(c.id)) return;
  store.sitzungVerwerfen(s.n);
}

/**
 * Die zuletzt abgeschlossene Woche (aus weeklyDone()), für die ein Zusatztag
 * gerechnet wird – oder null. Für zusatztagRechnen() und die Zeile am Ruhetag
 * (zusatzMorgen() in js/app.js), mit derselben Frage.
 */
export function zusatzZiel() {
  let ziel = null;
  weeklyDone().forEach((w) => {
    if (!w.any) return;
    const block = PLAN.slice(PLAN.indexOf(w.from), PLAN.indexOf(w.to) + 1);
    if (block.some((x) => !completedMode(x.n))) return;
    ziel = w;
  });
  return ziel;
}

/** Der Kern von pruefeZusatztag(): aufräumen, neu rechnen, anlegen. */
function zusatztagRechnen() {
  const ziel = zusatzZiel();
  const name = ziel ? `Zusatztag Woche ${ziel.nr}` : null;

  // **Erst aufräumen.** Ein unberührter Zusatztag gehört zu der Runde, aus der
  // er gerechnet wurde. Wandert die in die Ablage – Fokuswechsel, Neustart,
  // geänderter Plan –, blieb er bisher stehen. Und weil naechsteEinheit() ihn
  // dem Plan vorzieht, war er danach die *nächste Einheit*:
  //
  //   „Okay ist heute Zusatztag oder normaler übungstag?" – Das Dashboard bot
  //   „Zusatztag Woche 1" an (2 Übungen, 4 Sätze, Bauch), der Kalender zeigte
  //   für denselben Tag Workout 1 des Cut-Plans (5 Übungen, 10 Sätze). Beide
  //   hatten recht, und genau deshalb war es falsch: Der Zusatztag war aus der
  //   Aufbau-Runde übrig, die beim Fokuswechsel weggelegt worden war.
  //
  // Weg muss deshalb jeder unberührte, der nicht zu einer Woche gehört, die
  // *jetzt* gerade zu wenig bekommen hat. Angefangene bleiben: Was abgehakt
  // ist, wird nicht weggeräumt.
  let weg = 0;
  store.customs()
    .filter((c) => ZUSATZ_NAME.test(c.name) && c.name !== name
      && !store.isStarted(c.id))
    .forEach((c) => { store.removeCustom(c.id); weg += 1; });

  if (!ziel) return weg > 0;
  const da = store.customs().find((c) => c.name === name);
  // Angefangen ist angefangen: Was abgehakt ist, wird nicht umgebaut.
  if (da && store.isStarted(da.id)) return weg > 0;
  // **Schon in einer Einheit aufgegangen**, gemacht oder liegen gelassen: Dann
  // ist der Zusatztag dieser Woche verbraucht (zusatzVergeben() in
  // js/plan.js). Kein zweiter, und ein unberührter Rest kommt weg – sonst
  // stünde nach Workout 9 ein neuer „Zusatztag Woche 2" da und hinge sich an
  // Workout 10, und ein liegen gelassener Zusatz würde wie liegen gelassene
  // Nacharbeit ein zweites Mal eingefordert. Ein festgehaltener Zusatz wird
  // hier nie angefasst.
  if (zusatzVergeben(ziel.nr)) {
    if (!da) return weg > 0;
    store.removeCustom(da.id);
    return true;
  }
  // Die Merkliste `zusatzNein` ist mit dem Knopf „Brauch ich nicht" weggefallen.
  // Sie wird nicht mehr gelesen: Wer den Tag nicht will, macht die nächste
  // Planeinheit, und beim nächsten Wochenwechsel ersetzt ein neuer Zusatztag
  // den unberührten alten.
  //
  // Gerechnet für die Einheit, in die er heute eingefügt wird, und in deren
  // Modus – oder allein, wenn heute keine Planeinheit fällig ist. Dieselbe
  // Frage, mit der die Einheit ihn nachher aufnimmt (zusatzBindung()).
  const einheit = zusatzEinheitFuer(ziel.nr);
  const mode = einheit ? store.workoutMode(einheit.n) : store.getState().mode;
  const vorschlag = zusatztagEx(ziel, mode, einheit);

  // **Ein unberührter Zusatztag wird bei jeder Prüfung neu gerechnet** – beim
  // Start, beim Tageswechsel und nach jeder abgeschlossenen Einheit. Die
  // Erholungsregel gilt für den Tag, an dem er gemacht wird, und das ist fast
  // nie der, an dem er entsteht: Angelegt wird er beim Abschluss der letzten
  // Einheit der Woche, gemacht am Tag danach. Bisher blieb er, wie er am
  // Samstag gerechnet war – am Sonntag fehlte, was am Samstag ausgelassen
  // war, und dafür standen sechs Sätze Bauch einen Tag vor der Einheit mit
  // Bauch. Der Name bleibt, die Übungen sind die von heute; lässt die Regel
  // heute keinen zu, ist er weg und kommt wieder, sobald sie es tut.
  //
  // Mit ihm seine Herkunft (`warum`): Auch die ist von heute, und ein Träger
  // aus v238 ohne sie bekommt sie hier.
  if (da) {
    if (!vorschlag) { store.removeCustom(da.id); return true; }
    const warum = store.normWarum(vorschlag.warum, vorschlag.ex.map((x) => x.id));
    const gleich = da.ex.length === vorschlag.ex.length
      && da.ex.every((x, i) => x.id === vorschlag.ex[i].id && x.sets === vorschlag.ex[i].sets)
      && JSON.stringify(da.warum || {}) === JSON.stringify(warum);
    if (!gleich) store.saveCustom({ id: da.id, name, ex: vorschlag.ex, warum: vorschlag.warum });
    // Dieselbe Einheit, nur anders gefüllt – wer auf ihr steht, bleibt dort.
    return weg > 0;
  }
  if (!vorschlag) return weg > 0;

  store.saveCustom({ name, ex: vorschlag.ex, warum: vorschlag.warum });
  return true;
}

/**
 * Welche Einheit die App zeigt, wenn sie aufgeht.
 *
 * Normalerweise die nächste offene aus dem Plan. Liegt aber ein unberührter
 * Zusatztag da, ist **er** die nächste Einheit – dafür wurde er angelegt. Das
 * ist der Unterschied zwischen „angelegt" und „passiert": Eine eigene Einheit,
 * die man erst suchen muss, holt kein einziges Satzvolumen nach.
 *
 * Sobald er angefangen ist, tritt er zurück und der Plan läuft weiter. Wer ihn
 * gar nicht will, blättert mit „Zurück zum Plan" daran vorbei; beim nächsten
 * Wochenwechsel wird ein unberührter Zusatztag ohnehin ersetzt.
 *
 * **Außer an einem Tag, an dem eine Planeinheit fällig ist.** Dann steht sie
 * vorn – und der Zusatztag *steckt in ihr* (einheitEx() in js/plan.js). Fiel
 * mitten in der Woche eine ganze Einheit aus, entstand der Zusatztag oft erst
 * am Tag von Workout 5 – und verdrängte es: Das Dashboard zeigte „Eigenes
 * Workout / Zusatztag Woche 1" statt „Heute · Workout 5". Danach stand er als
 * zweite Einheit darunter, und das war auch nicht richtig:
 *
 *     „Was soll das mit zweite Einheit. Wenn heute Übungen dazu kommen dann
 *      soll alles flüssig in EINE Einheit"
 *
 * **Und nie allein an einem Tag, an dem schon trainiert wurde.** Wer heute
 * seine Planeinheit gemacht hat, bekommt danach keinen Zusatztag als nächste
 * Einheit vorgesetzt: Der wartet bis morgen – an einem Ruhetag steht er dann
 * allein da, an einem Plantag steckt er in dessen Einheit.
 */
export function naechsteEinheit() {
  const plan = defaultWorkoutNo();
  const w = PLAN.find((x) => x.n === plan);
  if (w && !completedMode(w.n) && effDate(w) <= todayISO()) return plan;
  const offen = offenerZusatztag();
  // „Heute trainiert" mit store.trainiertAm(): auch, wer heute den Rest einer
  // abgeschlossenen Einheit von gestern gemacht hat (Tagesabschluss).
  if (!offen || zusatzBindung() || PLAN.some((x) => store.trainiertAm(x.n, todayISO()))) return plan;
  return offen.id;
}

/** Steckt dieser Zusatztag gerade in der Einheit des Tages (zusatzBindung())? */
export function traegerGebunden(id) {
  const b = zusatzBindung();
  return !!b && b.c.id === id;
}

/* ------------------------------------------------------------------ *
 * Die Folge
 * ------------------------------------------------------------------ */

/** Der Tag, an dem ein Start mit Planumbau den Tagesabschluss aufschiebt – oder null. */
export function abschlussWartetAm() {
  return abschlussWartet;
}

/**
 * Den Tag nachziehen – die eine Folge, in der die App den Zustand
 * weiterschreibt, bevor sie etwas zeigt. Zwei Gelegenheiten, zwei Folgen:
 *
 *   'start'    beim Laden der App, und für die Vorschau des Kalenders, die je
 *              Tag einen frischen Start rechnet (js/kalender-vorschau.js).
 *   'wechsel'  bei offener App: beim Zurückkommen (visibilitychange) und von
 *              der Uhr um Mitternacht (tagesUhrStellen() in js/app.js).
 *
 * Gibt zurück, was passiert ist; die Anzeige macht daraus ihre Startansicht.
 * Mittendrin braucht sie es an zwei Stellen beim Start (`bei`), weil die
 * nächste Einheit (naechsteEinheit()) dort genau zwischen zwei Schritten
 * bestimmt wird – danach stimmt sie nicht mehr:
 *
 *   bei.gestempelt({ umzug, umgebaut })  nach dem Nachstempeln, vor dem Tagesabschluss
 *   bei.nachgerueckt({ abschluss })      nach dem Nachrücken, vor Aufstieg und Zusatztag
 *
 * `wartet` ('start'): ein Tag, an dem der Tagesabschluss aufgeschoben bleibt,
 * als hätte dieser Start mit einem Planumbau begonnen. Nur die Vorschau gibt
 * ihn mit – für den Tag, an dem die App selbst so gestartet ist
 * (abschlussWartetAm()). Sonst schlösse der Kalender heute ab, was die App
 * erst morgen abschließt.
 *
 * `abgeschlossen` ('wechsel'): was ein tagAbschliessen() davor schon ergeben
 * hat – das Zurückkommen in die App schließt ab, bevor die Uhr der Einheit
 * weiterläuft, und zieht den Rest danach nach. Fehlt es, wird hier
 * abgeschlossen. `neuerTag`: Ist seit dem letzten Nachziehen ein Tag
 * vergangen? Das weiß nur die Seite, die offen war.
 */
export function tagNachziehen({ art = 'start', bei = {}, wartet = null, abgeschlossen, neuerTag = false } = {}) {
  return art === 'wechsel' ? tagWechseln(abgeschlossen, neuerTag) : tagStarten(bei, wartet);
}

/*
 * Der Start, Schritt für Schritt – die Reihenfolge trägt. Die Kommentare sind
 * die, die bis v244 an denselben Zeilen in js/app.js standen.
 */
function tagStarten(bei, wartet) {
  // Vor Umzug und Planwechsel: Ein Kalender-Export ohne Planangabe stammt aus dem
  // Plan, der bis jetzt galt – danach weiß das hier niemand mehr (siehe
  // icsPlanNachtragen() in js/store.js).
  {
    const s = store.getState();
    const f = s.focus || 'standard';
    store.icsPlanNachtragen(f, (s.planStand || {})[f]);
  }
  // Stand dieses Gerät auf einem Fokus, den es nicht mehr gibt? Dann jetzt
  // umschreiben – js/data.js hat den Nachfolger schon geladen, hier zieht der
  // gespeicherte Wert nach.
  const umzug = fokusUmzug();
  // Und danach: Hat sich der *Inhalt* des Plans geändert, ohne dass der Fokus ein
  // anderer wäre? Dann werden die angefangenen Einheiten festgeschrieben, und die
  // Runde läuft weiter – kein Neuanfang, also auch kein Verschieben auf heute.
  // Nach fokusUmzug(), nicht davor – der stellt erst fest, welcher Plan gilt.
  const umgebaut = planWechsel() || festReparieren();
  if (umgebaut) startNotiz('plan', { was: 'umgebaut', abschluss: 'ab morgen' });
  // Danach, und immer: auch die Listen, die eben erst festgeschrieben wurden,
  // können aus einem `soll` ohne Nacharbeits-Vermerk stammen. Still – die
  // Einheit zeigt danach wieder, was sie vor dem Update zeigte, und das ist
  // keine Nachricht.
  festNachReparieren();
  // Erst jetzt nachstempeln: nach Umzug, Planwechsel und Reparatur, nicht davor.
  // Bis v218 lief es als Erstes, und eine Einheit, die v215 auf ihr erstes Paar
  // festgeschrieben hatte, war gegen diese kurze Liste gemessen fertig, sobald
  // beide Übungen ganz abgehakt waren. stempleFertige() setzte `done`,
  // festReparieren() lässt Abgeschlossenes aus – Crunches und Wadenheben kamen
  // nie zurück, und die Einheit galt als trainiert. Was von Hand oder mit dem
  // letzten Haken fertig wurde, trägt `done` schon vorher und bleibt, wie es ist.
  // Und nach dem Umzug, weil das Protokoll davor noch zum alten Plan gehört.
  //
  // Erst nachstempeln, dann die Runde prüfen: rundeWeiter() fragt genau die
  // Vollständigkeit ab, die hier festgeschrieben wird.
  stempleFertige();
  // Hier bestimmt die Anzeige die Einheit fürs Dashboard neu (siehe den Start in
  // js/app.js) – vor rundeWeiter(), das beim Weiterrollen selbst auf Workout 1
  // springt.
  if (bei.gestempelt) bei.gestempelt({ umzug, umgebaut: !!umgebaut });
  // Liegen Gebliebenes von einem früheren Tag abschließen (tagAbschliessen()):
  // nach stempleFertige(), denn was ganz abgehakt ist, ist schon fertig und
  // trägt seinen Stempel, und abgeschlossen wird nur, was wirklich offen ist.
  // Vor rundeWeiter(): War Workout 84 die liegen gebliebene, rollt die Runde im
  // selben Start weiter. Und vor pruefeAufstieg() und pruefeZusatztag() weiter
  // unten – die abgeschlossene Einheit zählt dort mit, und mit ihr ist ihre
  // Woche womöglich zu Ende. Das Nachrücken (catchUpPlan()) ist davon
  // unabhängig: Es fragt nach der ersten *nicht angefangenen* Einheit. Nach einem
  // Umbau des Plans erst beim nächsten Laden oder am nächsten Tag
  // (`abschlussWartet`) – und in der Vorschau des Kalenders am Tag, an dem die
  // App selbst so gestartet ist (`wartet`, siehe tagNachziehen()).
  abschlussWartet = umgebaut ? todayISO() : (wartet || null);
  const abschluss = tagAbschliessen();
  const runde = rundeWeiter();
  // Nachrücken passiert still: Ist der Termin der nächsten offenen Einheit
  // verstrichen, wandert der Restplan nach hinten.
  const tage = catchUpPlan();
  if (tage) startNotiz('tag', { was: 'nachgerueckt', tage });
  /*
   * Eine neu begonnene Runde fängt heute an – nicht am Plandatum.
   *
   *     „Workout liegt in der Vergangenheit? Das weiteste in der Vergangenheit
   *      was ein Workout bei dashboard ja liegen kann ist heute"
   *
   * Genau so ist es gedacht, und genau das war kaputt. Beide Umzüge oben setzen
   * die Verschiebung auf null zurück (restartPlan), und die Plandaten stehen fest
   * in js/data.js – die erste Einheit trägt den 24. August. Das Nachrücken, das
   * daraus sonst „heute" macht, lief damals vor den Umzügen. Auf dem Dashboard
   * stand danach „vor 25 Tagen · Workout 1".
   *
   * Deshalb hier und nicht in restartPlan(): Der Speicher kennt keine Plandaten,
   * und er soll sie auch nicht kennen – die Rechnung dazu steht in js/plan.js.
   *
   * shiftToToday() statt catchUpPlan(), weil es in beide Richtungen zieht: Ein
   * Plan, dessen Termine in der Zukunft liegen, würde sonst dort stehen bleiben.
   */
  if (umzug) {
    store.setShift(shiftToToday());
    startNotiz('plan', { was: 'neu angefangen', shift: store.getState().shift });
  }
  // Die Startseite stand noch auf der eben abgeschlossenen Einheit – jetzt, nach
  // dem Nachrücken, die nächste (die Anzeige, siehe den Start in js/app.js).
  if (bei.nachgerueckt) bei.nachgerueckt({ abschluss });
  // Auch beim Start prüfen, nicht nur nach einer Einheit: Eine eingelesene
  // Sicherung bringt womöglich ein halbes Jahr Training mit, und das soll sofort
  // in der richtigen Stufe landen statt erst nach dem nächsten Training.
  //
  // **Nach dem Fokus-Umzug**, und das war einmal andersherum: Solange der
  // Aufstieg nur `state.log` zählte, musste er vor dem Umzug laufen, weil der das
  // Protokoll wegräumt. Seit die abgelegte Runde ihre eigene Bilanz mitbringt und
  // gesamtStats() sie mitzählt, gilt das Gegenteil – und zwar zwingend: Während
  // des Umzugs steht das Protokoll des *alten* Plans einem bereits geladenen
  // *neuen* gegenüber, und dagegen gerechnet findet sammleStats() so gut wie
  // nichts. Erst nachdem der Umzug die Runde samt Bilanz abgelegt hat, steht dem
  // Aufstieg die richtige Zahl gegenüber.
  //
  // Beide Prüfungen laufen, jede für sich – nicht `pruefeAufstieg() ||
  // pruefeZusatztag()`. Mit dem Kurzschluss blieb nach einem Aufstieg beim Start
  // der fällige Zusatztag aus, und ein veralteter, unberührter wurde nicht
  // weggeräumt – er stand dann über naechsteEinheit() sogar als nächste Einheit
  // da. Nach einer Einheit (toggle-set, finish-session) liefen sie schon immer
  // nacheinander.
  const gestiegen = pruefeAufstieg();
  const zusatz = pruefeZusatztag();
  if (gestiegen) startNotiz('plan', { was: 'aufstieg', stufe: store.getState().level });
  return { art: 'start', umzug, umgebaut: !!umgebaut, abschluss, runde, nachgerueckt: tage, gestiegen, zusatz };
}

/*
 * Der Tageswechsel bei offener App: liegen Gebliebenes abschließen, die Runde
 * weiterrollen, nachrücken, den Zusatztag für heute rechnen.
 *
 * Erst die Runde weiterrollen, dann nachrücken: Sonst schöbe catchUpPlan()
 * den alten, längst fertigen Plan durch die Gegend.
 *
 * Ein unberührter Zusatztag gilt für den Tag, an dem er gemacht wird – über
 * Mitternacht offen gelassen, wird er für den neuen Tag nachgerechnet
 * (pruefeZusatztag()). Und nach einer frisch weitergerollten Runde ebenso,
 * wie nach „Von vorn beginnen": Ein Träger der alten Runde gehört zu deren
 * Protokoll, nicht zur neuen. Nach einem Tagesabschluss ebenso: Mit der
 * abgeschlossenen Woche kann ein Zusatztag entstehen.
 */
function tagWechseln(abgeschlossen, neuerTag) {
  const abschluss = abgeschlossen === undefined ? tagAbschliessen() : abgeschlossen;
  const runde = rundeWeiter();
  const nachgerueckt = catchUpPlan() || runde;
  const geaendert = !!(nachgerueckt || neuerTag || abschluss);
  let zusatz = false;
  if (geaendert) {
    startNotiz('tag', {
      was: 'nachziehen', neuerTag, runde: runde || undefined,
      nachgerueckt: typeof nachgerueckt === 'number' && nachgerueckt ? nachgerueckt : undefined, abschluss: !!abschluss,
    });
    zusatz = (neuerTag || runde || !!abschluss) && pruefeZusatztag();
  }
  return { art: 'wechsel', abschluss, runde, nachgerueckt, zusatz, geaendert };
}
