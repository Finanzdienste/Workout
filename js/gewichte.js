/*
 * Arbeitsgewichte und die Reihenfolge, in der umgebaut wird.
 *
 * Beides gehört zusammen: Die Reihenfolge innerhalb einer Einheit richtet
 * sich nach Gerät und Gewicht, und dafür muss man die aktuellen
 * Arbeitsgewichte kennen.
 */
import * as store from './store.js';
import { EX_BY_ID, repsBereich } from './uebung.js';
import { esc, fmtNum } from './text.js';
import { levelFaktor } from './stufen.js';
import { belegungText, gepflegt, nachbar, normSatz, raste } from './scheiben.js';

/** Der eingetragene Scheibensatz – oder ein leerer, wenn nichts eingetragen ist. */
export const meinSatz = () => normSatz(store.getState().scheiben);

/**
 * Ein Gewicht auf das einrasten, was sich hier wirklich einstellen lässt.
 *
 * Ist nichts eingetragen, bleibt die Zahl, wie sie war. Das ist der ganze
 * Vertrag: Die App rät keinen Scheibensatz herbei, aber sobald sie einen
 * kennt, schlägt sie nichts Unmögliches mehr vor.
 */
export function gerastet(ex, kg) {
  if (kg === null || !ex || !gepflegt(ex.equip, meinSatz())) return kg;
  const r = raste(kg, ex.equip, meinSatz());
  return r === null ? kg : r;
}

/* ------------------------------------------------------------------ *
 * Aufwärmen
 *
 * Der erste Arbeitssatz war bisher wirklich der erste Satz. Bei 40 kg Hip
 * Thrust heißt das: aus dem Sessel auf die Bank und volles Gewicht. Das ist die
 * billigste Verletzungsvorbeugung, die es gibt, und sie stand nirgends.
 *
 * **Was hier absichtlich nicht passiert.** Aufwärmsätze werden nicht abgehakt
 * und nicht protokolliert. Sie sind keine Leistung – zählte man sie mit, stiege
 * die Satzzahl in der Statistik um ein Drittel, ohne dass mehr trainiert wurde,
 * und der Stufenaufstieg käme zu früh. Es ist eine Zeile, kein Knopf.
 *
 * **Wer sie bekommt.** Nur Übungen mit Last und nur die schweren: `tier` 1 und 2
 * – Grundübungen und schwere Nebenübungen. Ein Seitheben mit 5 kg braucht kein
 * Aufwärmen, und eine Zeile, die überall steht, liest bald niemand mehr.
 *
 * **Womit.** Die Hälfte und drei Viertel des Arbeitsgewichts, eingerastet auf
 * das, was sich mit den vorhandenen Scheiben wirklich aufstecken lässt – ein
 * Aufwärmsatz mit 17,3 kg wäre eine Rechnung, keine Ansage. Fällt ein Satz mit
 * dem Arbeitsgewicht zusammen oder mit dem anderen Aufwärmsatz, faellt er weg:
 * Zweimal dasselbe Gewicht ist kein Aufbau.
 *
 * Wiederholungen: gut die Hälfte der unteren Bereichsgrenze. Aufwärmen soll
 * wach machen, nicht müde.
 * ------------------------------------------------------------------ */

/** Anteile des Arbeitsgewichts je Stufe – schwerer heißt mehr Anlauf. */
const AUFWAERM_STUFEN = { 1: [0.5, 0.75], 2: [0.6] };

/**
 * Die Aufwärmsätze einer Übung: [{ kg, reps }] – oder eine leere Liste.
 *
 * `kg` ist das Arbeitsgewicht dieser Übung in diesem Modus, `ex` der Eintrag
 * aus dem Katalog (mit `tier`, `equip` und dem Wiederholungsbereich).
 */
export function aufwaermsaetze(ex, kg, reps) {
  const stufen = AUFWAERM_STUFEN[ex && ex.tier];
  if (!stufen || kg === null || !(kg > 0)) return [];
  const unten = repsBereich(reps).lo || 8;
  const wdh = Math.max(4, Math.min(8, Math.round(unten * 0.6)));
  const gesehen = new Set([kg]);
  const liste = [];
  stufen.forEach((anteil) => {
    const roh = Math.round(kg * anteil * 4) / 4;
    const w = gerastet(ex, roh);
    // Über dem Arbeitsgewicht ist kein Aufwärmsatz, sondern ein Fehler: Das
    // passiert, wenn das Raster grob ist und nach oben schnappt.
    if (!(w > 0) || w >= kg || gesehen.has(w)) return;
    gesehen.add(w);
    liste.push({ kg: w, reps: wdh });
  });
  return liste;
}

/** Startgewicht einer Übung, auf die Erfahrung umgerechnet. */
export function startWeight(ex) {
  if (ex.weight === null) return null;
  const f = levelFaktor();
  // 0 kg heißt "ohne Zusatzlast" (Klimmzüge) – das bleibt 0, egal wer trainiert.
  if (!ex.weight || f === 1) return gerastet(ex, ex.weight);
  const step = ex.step || 2.5;
  return gerastet(ex, Math.max(step, Math.round((ex.weight * f) / step) * step));
}

/** Gewicht, mit dem diese Übung heute gearbeitet wird. */
export function workingWeight(exId) {
  const ex = EX_BY_ID.get(exId);
  if (ex.weight === null) return null;
  const own = store.weightOf(exId);
  return own === null ? startWeight(ex) : own;
}

/**
 * Womit die schon abgehakten Sätze gemacht wurden, wenn es abweicht.
 *
 * Jeder Satz merkt sich sein eigenes Gewicht, sobald er abgehakt wird. Das ist
 * der Grund, warum sich mitten im Training umentscheiden lässt: Wer nach dem
 * ersten Satz merkt, dass 40 kg zu viel sind, stellt auf 35 und macht die
 * restlichen Sätze damit. Die schon abgehakten bleiben, wie sie waren – nichts
 * wird rückwirkend umgeschrieben.
 *
 * Früher stand deshalb das *zuerst* benutzte Gewicht groß in der Zeile und jede
 * Änderung galt "nächstes Mal". Das war beim Erhöhen richtig und beim Senken
 * falsch: Man senkt es ja gerade, weil der nächste Satz jetzt dran ist. Jetzt
 * steht dort das Gewicht für den nächsten Satz, und diese Zeile sagt, womit die
 * bisherigen gemacht wurden.
 */
export function doneWeightNote(n, mode, exId) {
  const arr = store.peekSets(n, mode, exId) || [];
  const jetzt = workingWeight(exId);
  const andere = [];
  arr.forEach((x, i) => {
    if (!x.done || x.w === '') return;
    const kg = parseFloat(String(x.w).replace(',', '.'));
    if (Number.isNaN(kg) || Math.abs(kg - jetzt) < 0.01) return;
    andere.push({ i: i + 1, kg });
  });
  if (!andere.length) return '';
  const gruppen = new Map();
  andere.forEach(({ i, kg }) => gruppen.set(kg, (gruppen.get(kg) || []).concat(i)));
  return [...gruppen.entries()]
    .map(([kg, saetze]) => `Satz ${saetze.join(', ')} mit ${fmtNum(kg)} kg`)
    .join(' · ');
}

/* ------------------------------------------------------------------ *
 * Rüstzeit: Reihenfolge nach Gerät und Gewicht
 *
 * Zwischen zwei Übungen steht oft nicht die Pause, sondern der Umbau: Scheiben
 * abziehen, andere aufstecken, Verschlüsse zu. Das ist die Zeit, die eine
 * Einheit in der Wohnung wirklich lang macht, und sie steht in keinem Plan.
 *
 * Die Reihenfolge innerhalb einer Einheit ist dafür der ganze Hebel. Welche
 * Übungen an einem Tag stehen, entscheidet tools/build-plan.py nach dem
 * Wochenvolumen – daran wird hier nichts geändert. Aber ob die beiden
 * Langhantel-Übungen hintereinander kommen oder eine Kurzhantelübung dazwischen
 * liegt, kostet einen kompletten Auf- und Abbau.
 *
 * Sortiert wird deshalb nach Gerät und innerhalb des Geräts absteigend nach
 * Gewicht: Jedes Gerät wird einmal aufgebaut, und die Last geht in kleinen
 * Schritten nach unten statt hin und her. Am Plan gemessen sind das rund 30 %
 * weniger Kilo, die in einer Einheit bewegt werden – und schwer zuerst ist
 * ohnehin die richtige Reihenfolge fürs Training.
 *
 * Warum in der App und nicht im Generator: Hier stehen die *aktuellen*
 * Arbeitsgewichte. Der Generator kennt nur die Startwerte, und die stimmen nach
 * dem dritten Steigerungsvorschlag nicht mehr.
 *
 * Die Plätze der Übungen ohne Aufbau (Klimmzüge, Band, Bodyweight) bleiben, wo
 * sie sind: Sie kosten keinen Umbau, also darf zwischen zwei Langhantelübungen
 * ruhig ein Satz Pull-Apart liegen – die Stange bleibt ja geladen.
 * ------------------------------------------------------------------ */

export const RUEST_FAM = {
  barbell: 'lh', hipbar: 'lh',          // dieselbe Stange, nur einmal mit Polster
  szbar: 'sz',                          // eigene Stange, eigener Auf- und Abbau
  dumbbells: 'kh2',                     // beide Kurzhanteln auf dasselbe Gewicht
  goblet: 'kh1', onehand: 'kh1', plate: 'kh1',
  backpack: 'ruck',
};

export const FAM_LABEL = {
  lh: 'Stange', sz: 'SZ-Stange', kh2: 'Kurzhanteln', kh1: 'Kurzhantel', ruck: 'Rucksack',
};

/** Was für eine Übung aufzubauen ist – oder null, wenn nichts zu schleppen ist. */
export function setupOf(exId, kg) {
  const ex = EX_BY_ID.get(exId);
  const fam = ex && RUEST_FAM[ex.equip];
  if (!fam || !kg) return null;   // Klimmzüge stehen mit 0 kg im Rucksack: nichts zu tun
  return { fam, kg, label: FAM_LABEL[fam], note: ex.weightNote };
}

/**
 * Übungen einer Einheit nach Rüstaufwand ordnen.
 *
 * Die Reihenfolge der Geräte bleibt die des Plans – das erste Vorkommen eines
 * Geräts bestimmt seinen Platz. Damit steht vorn weiter, was der Generator nach
 * vorn gestellt hat (schwere Grundübung zuerst), und nur das Verstreute rückt
 * zusammen.
 */
export const ruestCache = new Map();   // "Nummer|Modus|Übungen" -> Reihenfolge der IDs

/**
 * Wie ruestOrder(), aber die einmal gefundene Reihenfolge bleibt stehen.
 *
 * Ohne das springen die Karten unter dem Finger: Wer das Gewicht einer Übung
 * ändert, ändert damit ihren Platz in der Sortierung – und schon steht die
 * Übung, die man gerade bearbeitet, zwei Zeilen weiter oben. Die Reihenfolge
 * ist ein Plan für diese Einheit, keine ständig nachgeführte Sortierung; sie
 * wird beim ersten Ansehen festgelegt und beim nächsten Laden neu berechnet.
 *
 * Der Schlüssel enthält die Übungen selbst: Hakt jemand eine Verletzung an,
 * fällt eine Übung weg – dann ist es eine andere Einheit und wird neu sortiert.
 */
export function ruestOrderStabil(items, n, mode) {
  const key = `${n}|${mode}|${items.map((i) => i.id).join(',')}`;
  const gemerkt = ruestCache.get(key);
  if (gemerkt) {
    const byId = new Map(items.map((i) => [i.id, i]));
    return gemerkt.map((id) => byId.get(id));
  }
  const out = ruestOrder(items);
  ruestCache.set(key, out.map((i) => i.id));
  return out;
}

/**
 * Zieht diese Reihenfolge eine kleine Übung vor eine schwere am selben Muskel?
 *
 * Gibt beide Plätze zurück, sonst null. Zwei Übungen sind "am selben Muskel",
 * wenn beide ihn direkt treffen (Anteil ab 0,5) – der Trizepsstrecker vor den
 * Liegestützen ist der Fall, der Beinbeuger vor dem Drücken nicht.
 */
export function vorgezogen(liste) {
  const direkt = (it) => {
    const ex = EX_BY_ID.get(it.id);
    const sh = (ex && ex.db && ex.db.shares) || {};
    return new Set(Object.keys(sh).filter((m) => sh[m] >= 0.5));
  };
  const stufe = (it) => (EX_BY_ID.get(it.id) || {}).tier || 1;
  for (let a = 0; a < liste.length; a++) {
    for (let b = a + 1; b < liste.length; b++) {
      if (stufe(liste[a]) <= stufe(liste[b])) continue;
      const ma = direkt(liste[a]);
      if ([...direkt(liste[b])].some((m) => ma.has(m))) return [a, b];
    }
  }
  return null;
}

export function ruestOrder(items) {
  // Nach vorn geholte Übungen stehen vorn, Punkt. Sie gehen der Bündelung nach
  // Gerät vor und kosten damit womöglich einen zusätzlichen Aufbau – das ist
  // die bewusste Entscheidung dahinter: Eine Übung, die regelmäßig ausfällt,
  // bringt null Sätze, und ein zweiter Aufbau ist der billigere Preis. Wer sie
  // gesetzt hat, hat genau danach gefragt (siehe vorneUm() in js/muster.js).
  const vorn = store.getState().vorne || [];
  if (vorn.length) {
    const rang = (it) => {
      const i = vorn.indexOf(it.id);
      return i < 0 ? vorn.length : i;
    };
    const geholt = items.filter((it) => rang(it) < vorn.length)
      .sort((a, b) => rang(a) - rang(b));
    if (geholt.length) {
      const rest = ruestOrder(items.filter((it) => rang(it) === vorn.length));
      return [...geholt, ...rest];
    }
  }
  const geladen = [];
  items.forEach((it, i) => {
    const s = setupOf(it.id, workingWeight(it.id));
    if (s) geladen.push({ it, s, i });
  });
  if (geladen.length < 3) return items;   // darunter gibt es nichts zu gewinnen

  // `fest` sind Übungen, die auf ihrem Platz bleiben müssen. Anfangs keine;
  // wer eine Grundübung überholt hat, kommt dazu und wird neu sortiert.
  const fest = new Set();
  const bauen = () => {
    const platz = new Map();
    const key = (g) => (fest.has(g.i) ? `#${g.i}` : g.s.fam);
    geladen.forEach((g) => { if (!platz.has(key(g))) platz.set(key(g), g.i); });
    const sortiert = geladen.slice().sort((a, b) => (
      platz.get(key(a)) - platz.get(key(b)) || b.s.kg - a.s.kg || a.i - b.i));
    const out = items.slice();
    geladen.forEach((g, k) => { out[g.i] = sortiert[k].it; });
    return out;
  };

  // Höchstens so viele Durchgänge, wie es Übungen gibt: Jeder setzt eine fest,
  // und mit allen festgesetzten steht wieder die Reihenfolge des Plans da.
  let out = bauen();
  for (let runde = 0; runde < geladen.length; runde++) {
    const paar = vorgezogen(out);
    if (!paar) break;
    // Festsetzen lässt sich nur, was überhaupt verschoben wurde. Drei Fälle,
    // in dieser Reihenfolge:
    //   1. die kleine Übung ist nach vorn gerutscht – sie bleibt stehen;
    //   2. sie stand schon immer da (Beinbeuger ohne Gewicht), und die schwere
    //      wurde nach hinten geschoben: dann bleibt das stehen, was ihren
    //      Platz eingenommen hat;
    //   3. sonst die schwere Übung selbst.
    const schwer = geladen.find((x) => x.it === out[paar[1]]);
    const kandidaten = [out[paar[0]], schwer ? out[schwer.i] : null, out[paar[1]]];
    const g = kandidaten.reduce((gefunden, it) => gefunden
      || (it ? geladen.find((x) => x.it === it && !fest.has(x.i)) : null), null);
    if (!g) break;
    fest.add(g.i);
    out = bauen();
  }
  return out;
}

/** Zeile über der Gewichtsangabe: was vor dieser Übung umzubauen ist. */
export function ruestHint(n, mode, list, i) {
  if (mode !== 'db') return '';
  const cur = setupOf(list[i].id, workingWeight(list[i].id));
  if (!cur) return '';
  let prev = null;
  for (let k = i - 1; k >= 0 && !prev; k--) prev = setupOf(list[k].id, workingWeight(list[k].id));
  const kg = `${fmtNum(cur.kg)} kg${cur.note ? ` ${cur.note}` : ''}`;
  // Sind die Scheiben bekannt, steht hier nicht nur das Ziel, sondern der Weg
  // dahin: Welche Scheiben, wie viele, auf welche Seite. Das ist die Zeile, die
  // den Umbau kurz macht.
  const lade = ladeText(list[i].id, cur.kg);
  const wie = lade ? ` <span class="ruest-lade">(${esc(lade)})</span>` : '';
  if (prev && prev.fam === cur.fam && Math.abs(prev.kg - cur.kg) < 0.01) {
    return `<div class="ruest gleich">✓ ${esc(cur.label)} bleibt bei ${esc(kg)} – nichts umbauen</div>`;
  }
  if (prev && prev.fam === cur.fam) {
    return `<div class="ruest">Umbauen: ${esc(cur.label)} von ${esc(fmtNum(prev.kg))} auf ${esc(kg)}${wie}</div>`;
  }
  return `<div class="ruest">Aufbauen: ${esc(cur.label)} auf ${esc(kg)}${wie}</div>`;
}

/**
 * Wie viel eine Steigerung ausmacht, steht je Übung in exercise-meta.json.
 *
 * Fest 2,5 kg war für den Goblet Squat richtig (20 → 22,5, also ein Achtel
 * mehr) und für das Seitheben Unsinn: 6 → 8,5 kg je Hand sind über vierzig
 * Prozent auf einmal. Die Schrittweite der Knöpfe hängt deshalb an der Übung.
 */
export const stepOf = (exId) => {
  const ex = EX_BY_ID.get(exId);
  return (ex && ex.step) || 2.5;
};

/**
 * Wohin ein Druck auf + oder − führt.
 *
 * Ohne eingetragene Scheiben ist das die Schrittweite der Übung, wie bisher.
 * Mit Scheiben ist es der nächste Wert, der sich auch aufstecken lässt – und
 * der kann weiter weg liegen: Wer nur 2,5er-Scheiben hat, springt bei beiden
 * Kurzhanteln in Fünferschritten je Hand, ob ihm das passt oder nicht. Genau
 * das soll die Zahl auch zeigen.
 */
/**
 * Wie weit ein Schritt mindestens gehen muss – gemessen am aktuellen Gewicht.
 *
 *     „Ich will 20 kg machen aber wenn ich bei 16 auf plus drück dann geht er
 *      direkt hier hin [21,5]."
 *
 * Die Schrittweite aus dem Katalog ist eine absolute Zahl: 5 kg für alles an
 * der Langhantel. Sie ist auf das *typische* Arbeitsgewicht der Übung geeicht –
 * beim Langhantelrudern 35 kg, da sind 5 kg ein knappes Siebtel. Bei 16,5 kg
 * sind dieselben 5 kg **dreißig Prozent**, und der Knopf sprang über 17,5 und 19
 * hinweg, obwohl beide aufsteckbar gewesen wären.
 *
 * Deshalb ist die Mindestweite jetzt relativ: **fünf Prozent des aktuellen
 * Gewichts**, gedeckelt durch die Schrittweite der Übung und nach unten durch
 * ein halbes Kilo begrenzt, damit aus einem Schritt kein Krümel wird. Fünf
 * Prozent, weil das die Größenordnung ist, in der im Krafttraining tatsächlich
 * gesteigert wird – 2,5 kg auf 50 kg. Gerechnet an Beispielen:
 *
 *     bei 17,5 kg, Schritt 5    mindestens 0,88  →  19 statt 21,5
 *     bei 40 kg,   Schritt 5    mindestens 2,0   →  42,5 statt 45
 *     bei 6 kg,    Schritt 1    mindestens 0,5   →  7,  wie bisher
 *
 * Der Deckel bleibt wichtig: Bei einem feinen Scheibensatz läge sonst alle
 * 1,25 kg eine Stufe, und bei 40 kg wären das drei Prozent – ein Schritt, der
 * keiner ist.
 */
const mindestSchritt = (jetzt, schritt) =>
  Math.min(schritt, Math.max(0.5, jetzt * 0.05));

export function naechstesGewicht(exId, richtung) {
  const ex = EX_BY_ID.get(exId);
  const jetzt = workingWeight(exId) || 0;
  const schritt = stepOf(exId);
  if (!ex || !gepflegt(ex.equip, meinSatz())) return Math.max(0, jetzt + richtung * schritt);
  const n = nachbar(jetzt, richtung, ex.equip, meinSatz(), mindestSchritt(jetzt, schritt));
  return n === null ? jetzt : n;
}

/* ------------------------------------------------------------------ *
 * Wann ein Gewicht reif ist
 *
 * Die App hat nie ein Arbeitsgewicht angehoben. `weights` wurde ausschließlich
 * von Hand gepflegt, und der „Aufstieg" in js/stufen.js ist die Erfahrungs-
 * stufe – der ändert Satzzahlen, keine Kilo. Ein Plan ohne Progression ist
 * Erhaltung.
 *
 * **Womit gerechnet wird, und womit nicht.** Im Protokoll steht je Satz genau
 * zweierlei: das benutzte Gewicht und ob er abgehakt ist (js/store.js, getSets).
 * Kein Wiederholungsfeld – `r` gab es, es wurde nie beschrieben und ist raus.
 * Keine Anstrengung – die Satzfrage stand einmal im Training und wurde auf
 * Ansage entfernt (siehe den Kommentarblock in js/app.js). Damit bleibt genau
 * ein Signal, und es ist ein schwaches: *alle Sätze standen, beim selben
 * Gewicht, mehrmals hintereinander.*
 *
 * Das ist weniger, als eine klassische doppelte Progression hätte. Es ist aber
 * das, was wirklich dasteht – und ein Vorschlag aus erfundenen Daten wäre
 * schlimmer als keiner. Deshalb sagt der Hinweis in der Oberfläche selbst
 * dazu, worauf er beruht: „Wie schwer die Sätze waren, weiß die App nicht –
 * nur, dass alle standen."
 *
 * **Was hier bewusst nicht passiert: von selbst etwas ändern.** Dieselbe Regel
 * wie in js/muster.js. Gerechnet wird hier, entschieden wird von Hand.
 * ------------------------------------------------------------------ */

/** Wie viele volle Termine ein Schritt braucht. */
export const STEIGERUNG_REIF = 3;

/**
 * Bei kleinen Übungen einer mehr.
 *
 * 2,5 kg auf eine Kniebeuge sind ein Achtel, auf eine Seitheben-Kurzhantel über
 * vierzig Prozent. Wo der kleinstmögliche Schritt prozentual groß ausfällt, darf
 * er länger auf sich warten lassen.
 */
export const STEIGERUNG_REIF_GROSS = 4;

/** Ab wann ein Schritt „groß" ist: ein Sechstel des Arbeitsgewichts. */
export const STEIGERUNG_GROSS = 0.15;

/**
 * Und ab wann er gar nicht mehr angeboten wird.
 *
 * Mit grobem Eisen kann der nächste erreichbare Wert weit springen – wer nur
 * 5er-Scheiben hat, geht bei beiden Kurzhanteln in Zehnerschritten je Hand. Ein
 * Sprung, den die App selbst als unbaubar groß erkennt, ist kein Angebot,
 * sondern eine Zumutung; dann schweigt sie, und der + Knopf steht ja weiter da.
 */
export const STEIGERUNG_DECKEL = 0.35;

/** Wie viele Vorschläge höchstens auf einmal dastehen. */
export const STEIGERUNG_ZEILEN = 2;

/**
 * Alle protokollierten Einheiten, jüngste zuerst – über Runden hinweg.
 *
 * Nicht nur `state.log`: wechsleFokus() schiebt das laufende Protokoll in die
 * Ablage und holt eine frühere Runde des Zielfokus zurück. Wer nur das Log
 * liest, dem reißt bei jedem Fokuswechsel die Reihe – derselbe Fehler, den
 * lebenStats() in js/bilanz.js schon einmal repariert hat.
 *
 * Eigene Einheiten bleiben draußen, wie in js/muster.js: Ein Zusatztag, den die
 * App selbst angelegt hat, soll keine Steigerung mitbelegen, um die niemand
 * gebeten hat.
 */
export function protokollEinheiten() {
  const s = store.getState();
  const raus = [];
  // Dieselbe Zeile wie istCustom() in js/plan.js, und sie steht hier statt
  // eines Imports: js/plan.js importiert dieses Modul (ruestOrderStabil), ein
  // Import zurück wäre ein Zyklus – und tools/pruefung/schichten.py prüft genau
  // darauf. Eine Kennung ist eine eigene Einheit, wenn sie mit 'c' beginnt.
  const eigene = (n) => typeof n === 'string' && n.startsWith('c');
  const sammeln = (log, ersatzTag) => {
    Object.entries(log || {}).forEach(([n, e]) => {
      if (!e || eigene(n)) return;
      raus.push({ tag: e.startedOn || ersatzTag || '', e });
    });
  };
  // `r &&`, und das ist kein Vorsichtsritual: tests/test-gesamt.mjs schiebt der
  // App absichtlich beschädigte Stände unter, und ein `rounds: [null]` steht in
  // einer alten oder halb geschriebenen Sicherung schneller, als man denkt. Ohne
  // die Prüfung war es kein leerer Verlauf, sondern eine leere App.
  (s.rounds || []).forEach((r) => { if (r) sammeln(r.log, r.finishedOn); });
  sammeln(s.log, null);
  return raus.filter((x) => x.tag).sort((a, b) => (a.tag < b.tag ? 1 : a.tag > b.tag ? -1 : 0));
}

/**
 * Was eine Übung in den protokollierten Einheiten gemacht hat, jüngste zuerst.
 *
 * Jeder Eintrag ist `{ tag, kg, voll }`. Einheiten, in denen für diese Übung
 * **kein einziger Haken** steht, kommen gar nicht vor – und das ist die
 * wichtigste Einzelentscheidung hier.
 *
 * Der Grund: getSets() legt beim Rendern für jede Übung der Einheit ein volles
 * Satz-Array an, auch für eine, die man nur angesehen und dann übersprungen
 * hat. Wer bloß `every(done)` prüft, wertet einen ausgefallenen Termin als
 * Fehlversuch und bricht die Reihe. Dass Übungen regelmäßig ausfallen, ist
 * keine Spekulation – js/muster.js existiert genau dafür. Also: „Eine Einheit,
 * in der nichts steht, ist keine ausgelassene Übung, sondern ein ausgefallener
 * Tag."
 *
 * Das Gewicht eines Auftritts ist das **kleinste** der abgehakten Sätze, nicht
 * das erste: Wer nach dem ersten Satz von 40 auf 35 heruntergeht, hat 35
 * gehalten. Heruntergehen ist ausdrücklich vorgesehen (siehe doneWeightNote).
 */
export function auftritte(exId, grenze = 12) {
  const raus = [];
  protokollEinheiten().some(({ tag, e }) => {
    const arr = (e.db || {})[exId];
    if (!Array.isArray(arr) || !arr.length) return false;
    const fertig = arr.filter((s) => s && s.done);
    if (!fertig.length) return false;             // angesehen, nicht gemacht
    const kilos = fertig
      .map((s) => parseFloat(String(s.w).replace(',', '.')))
      .filter((x) => Number.isFinite(x) && x > 0);
    if (!kilos.length) return false;              // ohne Zusatzlast – siehe unten
    raus.push({ tag, kg: Math.min(...kilos), voll: arr.every((s) => s && s.done) });
    return raus.length >= grenze;
  });
  return raus;
}

/**
 * Wie oft zuletzt hintereinander alles stand, beim selben Gewicht.
 *
 * Gibt `{ mal, kg, seit }` oder null. Gezählt wird von der jüngsten Einheit
 * rückwärts, und abgebrochen wird beim ersten Auftritt, der nicht voll war oder
 * ein anderes Gewicht trug.
 *
 * `voll` heißt `arr.every(done)` über das gespeicherte Array, nicht gegen die
 * *heutige* Satzzahl. Das ist die dokumentierte Falle aus js/store.js: getSets()
 * kürzt nur leere Sätze am Ende, „eine Einstellung darf keine Trainingsgeschichte
 * wegräumen". Ein damals volles Dreier-Array bleibt für immer 3/3 – auch nach
 * einem Stufenaufstieg, und auch für abgelegte Runden, deren Plan gar nicht
 * geladen ist.
 *
 * Zwei Dinge lassen die Reihe absichtlich reißen, ohne dass etwas kaputt ist:
 * ein Stufenaufstieg (er verlängert die Satzzahl, und die nächste Einheit ist
 * erst mit mehr Sätzen wieder voll) und jede Änderung des Arbeitsgewichts von
 * Hand. Beides sind falsche Neins – die richtige Seite des Fehlers.
 */
export function serie(exId) {
  const liste = auftritte(exId);
  if (!liste.length) return null;
  const kg = liste[0].kg;
  let mal = 0;
  for (const a of liste) {
    if (!a.voll || Math.abs(a.kg - kg) > 1e-9) break;
    mal += 1;
  }
  return mal ? { mal, kg, seit: liste[mal - 1].tag } : null;
}

/**
 * Welche der übergebenen Übungen reif für einen Schritt sind.
 *
 * Übergeben wird die Liste der Übungen einer Einheit (die aufgelösten `it`),
 * damit hier nichts über den Plan gewusst werden muss.
 *
 * Draußen bleiben:
 *   * Übungen ohne Zusatzlast. chin-ups, pull-ups und inverted-row stehen mit
 *     Gewicht 0 im Katalog; ein Haken sagt dort nichts über die Last, und ihr
 *     eigener Katalogtext sagt „Zusatzgewicht erst, wenn 10 saubere stehen" –
 *     ob zehn saubere stehen, misst die App nicht.
 *   * Übungen, bei denen der Vorschlag schon abgelehnt wurde und sich seither
 *     am Arbeitsgewicht nichts geändert hat.
 *   * Sprünge über STEIGERUNG_DECKEL.
 */
export function reifeUebungen(items) {
  const nein = store.getState().steigerungNein || {};
  const raus = [];
  (items || []).forEach((it) => {
    const ex = EX_BY_ID.get(it.id);
    if (!ex || !ex.weight) return;
    const jetzt = workingWeight(it.id);
    if (!Number.isFinite(jetzt) || jetzt <= 0) return;
    if (Number.isFinite(nein[it.id]) && Math.abs(nein[it.id] - jetzt) < 1e-9) return;
    const s = serie(it.id);
    if (!s || Math.abs(s.kg - jetzt) > 1e-9) return;
    const ziel = naechstesGewicht(it.id, 1);
    if (!Number.isFinite(ziel) || ziel <= jetzt) return;
    const anteil = (ziel - jetzt) / jetzt;
    if (anteil > STEIGERUNG_DECKEL) return;
    // Die Einteilung „groß/klein" rechnet am *laufenden* Arbeitsgewicht, nicht
    // am Katalogwert. Sie wandert deshalb mit: Seitheben 6 → 7 kg sind 16,7 %
    // und brauchen vier Termine, später 12 → 13 kg nur noch 8,3 % und drei.
    // Das ist gewollt – der Sprung wird ja auch wirklich leichter.
    const reif = anteil > STEIGERUNG_GROSS ? STEIGERUNG_REIF_GROSS : STEIGERUNG_REIF;
    if (s.mal < reif) return;
    raus.push({ id: it.id, name: (it.name || ex.id), jetzt, ziel, mal: s.mal, seit: s.seit });
  });
  return raus.sort((a, b) => b.mal - a.mal || a.name.localeCompare(b.name));
}

/** „je Seite 1× 2,5 kg" – wenn bekannt ist, welche Scheiben es gibt. */
export function ladeText(exId, kg) {
  const ex = EX_BY_ID.get(exId);
  if (!ex || kg === null) return '';
  return belegungText(kg, ex.equip, meinSatz());
}
