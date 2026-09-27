/*
 * Die Dosis-Karte: Spricht der letzte Befund für mehr, weniger oder gleich viel?
 *
 * Ausdrücklicher Wunsch: „die app soll auch sagen ob man mehr oder weniger
 * nehmen soll". Sie sagt es – als Richtung mit der Schrittgröße, die
 * Ärztinnen üblicherweise wählen, nie als neue Tagesdosis, und immer mit dem
 * Rat, zuerst in der Praxis anzurufen. Die Richtung steht nie allein: Der
 * Pflichttext darunter (D6) ist nicht einklappbar.
 *
 * Die Reihenfolge ist verbindlich (Regelwerk 2, Grundsatz 1):
 *   1. Warnzeichen – bei Herzklopfen, Unruhe, unregelmäßigem Puls erst der Check.
 *   2. Schwangerschaft.
 *   3. Sperrgründe, die schon feststehen (D0.1–D0.18).
 *   4. Offene Pflichtfragen – höchstens eine je Anzeige.
 *   5. Die Richtung nach Muster (D1–D5), mit Pflichttext und Grundlage.
 * Schon ein Sperrgrund heißt: keine Richtung. Das heißt nicht „alles gut" –
 * die Karte nennt jeden Grund, und die Dringlichkeit des Befunds bleibt.
 *
 * Eine Stufe für alles (RW1 L3f): Die Karte liegt nie unter der Stufe des
 * Musters (außer D0.4 und D0.5), nie unter der Stufe eines ihrer Gründe und
 * nie unter der Stufe, die die Einschätzung für Puls, Herzklopfen oder
 * seelische Not nennt. Jeder Text mit Frist wird erst geschrieben, wenn diese
 * Stufe feststeht – so nennt kein Satz eine längere Frist als die Kopfzeile.
 *
 * Wie in js/einschaetzung.js: reine Rechnung mit übergebenem Stand und Tag.
 */
import { tageWeiter, tageZwischen, zahlText, datumKurz } from './datum.js';
import * as sp from './speicher.js';
import { normEinheit, inStandard, plausibel } from './einheiten.js';
import {
  befundEinschaetzen, dosisAmIn, alterAm, einnahmenVor, beschwerdenAuswerten, hatDiabetes, zielBereich,
  einordnen, hoechste, warnzeichenAuswerten, vergleichbar, W5_TEXT, praxisHatErklaert,
  STUFEN, kopfFuer, giftnotrufAnruf, gesamtbild,
} from './einschaetzung.js';

const kurz = (iso) => datumKurz(iso);
const zahl = (n) => zahlText(n, 2);
const ug = (n) => `${zahlText(n, 1)} µg`;
const rang = (s) => (STUFEN[s] ? STUFEN[s].rang : 0);
/** Sätze zusammensetzen, leere Teile fallen weg. */
const satz = (...teile) => teile.filter(Boolean).join(' ');

const JNW = [['ja', 'Ja'], ['nein', 'Nein'], ['unbekannt', 'Weiß nicht']];

// ---------------------------------------------------------------- Texte

export const KOPF_KLAEREN = 'Aus diesem Befund lässt sich im Moment nichts zur Dosis ableiten.';
const KLAEREN_KURZ = 'Das heißt nicht, dass alles in Ordnung ist – die Gründe stehen darunter.';
const KLAEREN_SATZ = `${KLAEREN_KURZ} Nehmen Sie Ihre Tablette bis dahin genau wie bisher weiter.`;

export const D6_LANG = 'Das ist eine Einschätzung aus Ihrem Laborwert, keine Anweisung. Ändern Sie die Dosis nicht auf eigene Faust, sondern erst nach einem Anruf in der Praxis. Die Ärztin legt die neue Menge fest; oft braucht es dafür eine andere Tablettenstärke und ein neues Rezept. Bis Sie mit der Praxis gesprochen haben, nehmen Sie Ihre Tablette genau wie bisher weiter, auch am Wochenende oder wenn die Praxis Urlaub hat. Ein paar Tage Warten schaden nicht. Nehmen Sie keine Tabletten aus alten Packungen dazu, teilen Sie Tabletten nicht zusätzlich, wechseln Sie nicht zwischen Stärken ab und lassen Sie keine Tage weg, wenn die Praxis es nicht so gesagt hat. Immer nur ein Schritt: Nach jeder Änderung wird nach 6 bis 8 Wochen kontrolliert, vorher keine weitere Änderung. Nie eine zweite Tablette zum Ausgleich. Eine vergessene Tablette dürfen Sie am selben Tag noch nehmen. Hat Ihre Ärztin anders entschieden oder einen eigenen Zielbereich für Sie festgelegt, gilt die Ärztin: Sie kennt Ihr Herz, Ihre Knochen und Ihre übrigen Befunde.';
export const D6_KURZ = 'Das ist eine Einschätzung aus Ihrem Laborwert. Ändern Sie die Dosis nicht wegen Beschwerden allein. Hat Ihre Ärztin anders entschieden, gilt die Ärztin.';

export const WD2 = 'Sofort 112 anrufen bei: Schmerzen oder Engegefühl in der Brust · starkem Herzrasen mit Schwindel oder Ohnmacht · Atemnot.';

/** L5 (Regelwerk 2): was vor der nächsten Blutabnahme zu beachten ist. */
export const VOR_ABNAHME = 'Vor der Blutabnahme: Lassen Sie das Blut möglichst morgens abnehmen. Nehmen Sie die Schilddrüsentablette an diesem Tag erst nach der Abnahme. Lassen Sie Biotin und Mittel für Haare, Haut und Nägel mindestens 3 Tage vorher weg (hoch dosiert eine Woche) und sagen Sie es der Praxis. Gehen Sie möglichst ins gleiche Labor wie beim letzten Mal.';

const E5_TEXT = 'Glutenfreie Ernährung hilft nur bei nachgewiesener Zöliakie. Bei Hashimoto kommt Zöliakie etwas häufiger vor. Sprechen Sie es an bei anhaltendem Durchfall oder Blähungen, ungewolltem Abnehmen, Blutarmut oder Eisenmangel, oder wenn Ihr TSH trotz regelmäßiger, richtiger Einnahme immer wieder zu hoch ist. Wichtig: Essen Sie vor einem Bluttest auf Zöliakie NICHT glutenfrei, sonst fällt der Test fälschlich unauffällig aus.';

/** Die Menge, wie sie eingetragen ist: „weiter ½ Tablette" (X10). */
function mengeText(d) {
  if (!d || d.tabletten === 1) return '';
  const m = d.tabletten === 0.5 ? '½ Tablette' : d.tabletten === 1.5 ? '1½ Tabletten' : `${String(d.tabletten).replace('.', ',')} Tabletten`;
  return ` (weiter ${m} am Tag)`;
}
const nichtWeglassen = (d) => `Nehmen Sie Ihre Tablette weiter genau wie bisher${mengeText(d)}, auch geteilt, wenn die Praxis es so verordnet hat. Teilen Sie nicht zusätzlich und lassen Sie keine Tage weg.`;

// ---------------------------------------------------------------- Fristen und Nummern

/*
 * Feste Fristen (Grundsatz 4). Ein Satz je Stufe – Texte mit Frist holen sie
 * sich erst, wenn die Stufe der Karte feststeht. Vorher stand etwa unter
 * „In den nächsten Tagen anrufen" noch „innerhalb von ein bis zwei Wochen".
 */
const WANN = { heute: 'heute noch', tage: 'in den nächsten Tagen', zeitnah: 'innerhalb von ein bis zwei Wochen' };
const wann = (stufe) => WANN[stufe] || (rang(stufe) > rang('heute') ? 'heute noch' : 'beim nächsten Termin');
function fristSatz(stufe) {
  if (rang(stufe) >= rang('heute')) return 'Rufen Sie heute noch in der Praxis an, außerhalb der Sprechzeiten 116 117.';
  if (stufe === 'tage') return 'Rufen Sie in den nächsten Tagen die Praxis an.';
  if (stufe === 'zeitnah') return 'Besprechen Sie das innerhalb von ein bis zwei Wochen mit der Praxis.';
  return 'Sprechen Sie es beim nächsten Termin an.';
}

/*
 * Anrufbare Nummern: Jeder Text, der zum Anruf auffordert, bekommt seine
 * Nummer als Eintrag in `anrufe` – im Notfall sucht niemand erst die Nummer.
 * Reihenfolge wie in der Einschätzung: zuerst die Telefonseelsorge (112 nur
 * bei akuter Gefahr, RW1 Grundsatz 15), dann Giftnotruf, Bereitschaftsdienst, 112.
 */
const TEL_112 = { nummer: '112', text: '112 anrufen' };
const TEL_116 = { nummer: '116117', text: 'Bereitschaftsdienst 116 117' };
const TEL_SEELSORGE = [
  { nummer: '08001110111', text: 'Telefonseelsorge 0800 111 0 111' },
  { nummer: '08001110222', text: 'Telefonseelsorge 0800 111 0 222' },
];
const eindeutig = (liste) => liste.filter((x, i) => x && liste.findIndex((y) => y && y.nummer === x.nummer) === i);
/** Die Nummern, zu denen die Texte auffordern. Der Giftnotruf je Bundesland (X15), ohne Angabe 112 (P5). */
function anrufeAus(texte, stand) {
  const t = texte.filter(Boolean).join('\n');
  const a = [];
  if (/Telefonseelsorge/.test(t)) a.push(...TEL_SEELSORGE);
  if (/Giftnotruf/.test(t)) a.push(giftnotrufAnruf(stand));
  if (/116 ?117/.test(t)) a.push(TEL_116);
  if (/(^|[^\d,.])112([^\d,]|$)/.test(t)) a.push(TEL_112);
  return eindeutig(a);
}

// ---------------------------------------------------------------- Hilfen

/** Der jüngste Befund mit TSH bis heute. */
export function dosisBefund(stand, heute) {
  return [...stand.labor].reverse().find((l) => l.tsh && l.datum <= heute) || null;
}

/** Befinden der letzten `tage` Tage: alle genannten Beschwerden mit dem jüngsten Datum. */
function genannt(stand, heute, tage) {
  const ab = tageWeiter(heute, -(tage - 1));
  const m = new Map();
  stand.befinden.filter((b) => b.datum >= ab && b.datum <= heute)
    .forEach((b) => b.beschwerden.forEach((k) => { if (!m.has(k) || m.get(k) < b.datum) m.set(k, b.datum); }));
  return m;
}

function nachfrage(stand, art, bezug) {
  return [...stand.nachfragen].reverse().find((n) => n.art === art && n.bezug === bezug) || null;
}

/** Einpendelzeit: 6 Wochen, ab 70 oder ohne Geburtsjahr 8 Wochen (D0.6). */
function einpendeln(stand, tag) {
  const a = alterAm(stand, tag);
  return a === null || a >= 70 ? 56 : 42;
}
const wochenText = (frist) => (frist === 56 ? 'etwa 8 Wochen' : '6 bis 8 Wochen');

/** Jeder Dosis-Eintrag außer dem ersten ist eine Änderung (Dosis, Präparat, Hersteller). */
const aenderungen = (stand) => stand.dosen.slice(1);

/**
 * Was ein Dosis-Eintrag gegenüber dem vorigen ändert: 'dosis' (andere Menge am
 * Tag – oder sie ist nicht bekannt), 'praeparat' (gleiche Menge, aber anderes
 * Präparat, anderer Hersteller oder andere Stärke) oder 'doppelt' (alles
 * gleich). Ein doppelter Eintrag entsteht leicht: Beim Einrichten gilt die
 * Dosis „ab heute", und wer die Dosis später mit dem richtigen Beginn noch
 * einmal einträgt, hat sie zweimal. Er ist keine Änderung, die der Praxis
 * gemeldet oder kontrolliert werden müsste (RW2 Grundsatz: wahre Aussagen).
 */
function aenderungsArt(d, vorher) {
  const a = sp.tagesdosis(d);
  const b = sp.tagesdosis(vorher);
  if (a === null || b === null || a !== b) return 'dosis';
  const name = (x) => String(x.praeparat || '').trim().toLowerCase();
  return name(d) === name(vorher) && d.mikrogramm === vorher.mikrogramm && d.tabletten === vorher.tabletten ? 'doppelt' : 'praeparat';
}

/*
 * X3 (1): Die Antwort „Nein, ich nehme etwas anderes" merkt sich die Menge,
 * auf die sie sich bezog („nein_75", „nein_87_5"). Ist die eingetragene Menge
 * danach eine andere, hat die Nutzerin berichtigt – dann fragt die Karte neu,
 * statt für diesen Befund für immer zu sperren. Alte Antworten „nein" ohne
 * Menge gibt es aus früheren Versionen.
 */
const neinWert = (td) => `nein_${String(td).replace('.', '_')}`;
function neinDosis(antwort) {
  const m = /^nein_(\d+)(?:_(\d+))?$/.exec(antwort || '');
  return m ? Number(`${m[1]}.${m[2] || '0'}`) : null;
}

// ---------------------------------------------------------------- Dosisrichtung

/*
 * Woher eine höhere Stufe aus dem Befinden kommt – ein kurzer Satz, damit die
 * Karte sagt, warum sie „heute" oder „in den nächsten Tagen" zeigt.
 */
function pfadSatz(t) {
  if (t.id === 'S4') return 'Sie haben einen neu unregelmäßigen Puls oder Herzstolpern eingetragen.';
  if (t.id === 'S4ii') return 'Sie haben Herzklopfen eingetragen, und Ihr TSH ist niedrig.';
  if (t.id === 'R3') return rang(t.stufe) >= rang('heute') ? 'Sie haben an mehreren Tagen Herzklopfen eingetragen.' : 'Sie haben Herzklopfen eingetragen.';
  if (t.id === 'W2t') return 'Sie haben „ungewollt abgenommen" eingetragen.';
  return null;
}
/*
 * Herzklopfen an einem Tag (R3 „Termin"): nicht „beim nächsten Termin"
 * allein – wie die Einschätzung sagt die Karte, was gilt, wenn es seit Tagen
 * besteht. Sonst läse sich die Karte milder als die Einschätzung.
 */
const R3_EINMAL = 'Sie haben Herzklopfen eingetragen. Wenn es seit Tagen besteht, rufen Sie heute in der Praxis an, außerhalb der Sprechzeiten 116 117.';

/**
 * Die Karte zum jüngsten Befund mit TSH – oder null, wenn es keinen gibt.
 *
 * { richtung, titel, texte, schritt, pflicht, gruende: [{ id, text, stufe, anrufe }],
 *   frage, aktion: 'dosis'|null, aktionParam: null|'praxis'|<Dosis-id>, aktionText,
 *   hinweise, stufe, kopf: { titel, text }, anrufe: [{ nummer, text }],
 *   warnzeichen, grundlage, befund, einschaetzung, merken, regeln }
 *
 * aktion 'dosis' öffnet das Dosis-Formular: ohne aktionParam als neue Dosis,
 * mit 'praxis' als neue Dosis „auf Anweisung der Praxis", mit einer Dosis-id
 * zum Ändern dieses Eintrags.
 */
export function dosisRichtung(stand, heute) {
  const befund = dosisBefund(stand, heute);
  if (!befund) return null;
  const e = befundEinschaetzen(befund, stand, heute);
  const p = stand.profil;
  const tag = befund.datum;
  const alt = alterAm(stand, tag);
  const herzVorsicht = ['ja', 'unbekannt', ''].includes(p.herz);
  const vorsichtig = alt === null || alt >= 65 || herzVorsicht;
  const dAkt = dosisAmIn(stand, heute);
  const dBef = dosisAmIn(stand, tag);
  const td = sp.tagesdosis(dAkt);
  const ziel = zielBereich(stand);
  const tsh = inStandard('tsh', befund.tsh);
  const gruppe = e.gruppe;
  const code = e.muster;
  const g14 = genannt(stand, heute, 14);
  const g28 = genannt(stand, heute, 28);
  const b = beschwerdenAuswerten(stand, heute);
  const regeln = [];
  const gruende = [];
  /* `text` darf eine Funktion der Endstufe sein – siehe karte(). */
  const grund = (id, text, stufe = null, anrufe = []) => { gruende.push({ id, text, stufe, anrufe }); regeln.push(id); };
  const blockJaWeissNicht = (wert) => wert === 'ja' || wert === 'unbekannt';
  let aktion = null;
  const aktionSetzen = (param, text) => { if (!aktion) aktion = { param, text }; };
  // Gründe, unter denen „Nehmen Sie Ihre Tablette … genau wie bisher weiter"
  // falsch wäre: nach Überdosis, eigener Änderung, geänderter Anordnung (B28).
  let ohneWieBisher = false;

  /*
   * Die Stufe aus dem Befinden (Puls, Herzklopfen) und dem Check von heute.
   * Die Einschätzung nennt für dieselben Einträge „heute" (S4, S4ii, R3) – die
   * Karte darf nicht darunter liegen, sonst sagen zwei Bildschirme zweierlei.
   */
  let stufeWarn = 'keine';
  let warnSatz = null;
  let warnFertig = false;  // der Satz nennt seine Frist schon selbst
  const setzeWarn = (stufe, text, fertig = false) => {
    if (rang(stufe) > rang(stufeWarn)) { stufeWarn = stufe; warnSatz = text; warnFertig = fertig; }
  };
  // W2t (ungewollt abgenommen, B1) gehört dazu: Die Einschätzung sagt „in den nächsten Tagen".
  const pfade = b.texte.filter((t) => ['S4', 'S4ii', 'R3', 'W2t'].includes(t.id));
  pfade.forEach((t) => (t.id === 'R3' && rang(t.stufe) < rang('heute') ? setzeWarn(t.stufe, R3_EINMAL, true) : setzeWarn(t.stufe, pfadSatz(t))));
  const stufeHerz = hoechste(...pfade.map((t) => t.stufe));

  // DG – die Grundlage steht auf jeder Karte
  const bereich = (w) => (w.von !== null || w.bis !== null ? `${w.von !== null ? zahl(w.von) : '…'}–${w.bis !== null ? zahl(w.bis) : '…'}` : 'kein Bereich eingetragen');
  // B21: Eine schon eingetragene künftige Dosis gehört zur Grundlage – sonst nennt die Karte nur die alte.
  const naechste = stand.dosen.find((d) => d.ab > heute && d !== dAkt && sp.tagesdosis(d) !== null);
  const grundlage = `Grundlage: Befund vom ${kurz(tag)} – TSH ${befund.tsh.unter ? '< ' : ''}${zahl(befund.tsh.wert)} ${befund.tsh.einheit} (Bereich Ihres Labors ${bereich(befund.tsh)}${ziel ? `; Zielbereich Ihrer Ärztin ${zahl(ziel.von)}–${zahl(ziel.bis)} mU/l` : ''})${befund.ft4 ? `, fT4 ${befund.ft4.unter ? '< ' : ''}${zahl(befund.ft4.wert)} ${befund.ft4.einheit} (Bereich ${bereich(befund.ft4)})` : ''}. ${dAkt && td !== null ? `Ihre Dosis laut App: ${ug(td)} am Tag seit ${kurz(dAkt.ab)}${dAkt.praeparat ? ` (${dAkt.praeparat})` : ''}.` : 'Ihre Dosis ist in der App nicht vollständig eingetragen.'}${naechste && dAkt ? ` Ab ${kurz(naechste.ab)} ist eingetragen: ${ug(sp.tagesdosis(naechste))} am Tag.` : ''} Die App kennt Ihre übrigen Befunde nicht – die Entscheidung trifft die Praxis.`;

  const karte = (x) => {
    const richtung = x.richtung || 'klaeren';
    // Grundsatz 5 / D0: Die Dringlichkeit des Musters bleibt stehen – auch
    // unter einer Richtung oder einem Klärtext, der selbst eine niedrigere
    // nennt (D2d, D4a/D4b bei Muster d). Nur D0.4 (Termin) und D0.5 (keine)
    // ersetzen sie – und nur sie: X3, Q5, D0.18, X1, X4 … behalten ihre Stufe.
    // D0.13 leitet sich aus dem Muster ab und folgt deshalb der festen Stufe.
    const basis = x.stufeFest || hoechste(x.stufe || 'keine', e.stufeLabor);
    const eigen = hoechste(basis, ...gruende.filter((g) => !(x.stufeFest && g.id === 'D0.13')).map((g) => g.stufe).filter(Boolean));
    const stufe = hoechste(eigen, stufeWarn);
    // Texte mit Frist: jetzt fertig schreiben, mit der Stufe, die oben steht.
    const fertig = (t) => (typeof t === 'function' ? t(stufe, eigen) : t);
    gruende.forEach((g) => {
      g.text = fertig(g.text);
      g.anrufe = eindeutig([...(g.anrufe || []), ...anrufeAus([g.text], stand)]);
    });
    const wieBisher = !ohneWieBisher && !gruende.some((g) => ['Q5', 'X3'].includes(g.id) || g.stufe === 'notruf');
    const texte = (x.texte || (richtung === 'klaeren' && !x.frage ? [wieBisher ? KLAEREN_SATZ : KLAEREN_KURZ] : [])).map(fertig).filter(Boolean);
    // Kommt die höchste Stufe aus Befinden oder Check, sagt die Karte, warum – mit der Frist dieser Stufe.
    if (rang(stufeWarn) > rang(eigen) && warnSatz) texte.push(warnFertig ? warnSatz : satz(warnSatz, fristSatz(stufe)));
    if (richtung !== 'klaeren') {
      // P5, P3: fehlende Angaben stehen auf jeder Richtungskarte – im Text, nicht in einer Randnotiz.
      if (alt === null) texte.push('Bitte tragen Sie im Profil Ihr Geburtsjahr ein. Bis dahin rechnet die App vorsichtig.');
      if (['unbekannt', ''].includes(p.herz)) texte.push('Solange nicht angegeben ist, ob Sie eine Herzerkrankung haben, rechnet die App vorsichtig so, als hätten Sie eine.');
    }
    const kopf = kopfFuer(stufe, gruende);
    const warnzeichen = x.warnzeichen || null;
    const a = x.aktion || aktion;
    return {
      richtung,
      titel: x.titel || KOPF_KLAEREN,
      texte,
      schritt: x.schritt || null,
      pflicht: richtung === 'mehr' || richtung === 'weniger' ? D6_LANG : D6_KURZ,
      gruende,
      frage: x.frage || null,
      aktion: a ? 'dosis' : null,
      aktionParam: a ? a.param : null,
      aktionText: a ? a.text : null,
      hinweise: [],
      stufe,
      kopf,
      anrufe: eindeutig([...gruende.flatMap((g) => g.anrufe), ...anrufeAus([kopf.text, ...texte, warnzeichen, x.frage && x.frage.text], stand)]),
      warnzeichen,
      grundlage,
      befund,
      einschaetzung: e,
      // Früher schrieb die Ansicht hier den ersten Anzeigetag mit; die
      // 14-Tage-Rückfrage (X3) zählt jetzt ab der Antwort auf die Dosisfrage.
      merken: null,
      regeln: [...new Set([...regeln, ...(x.regeln || [])])],
    };
  };

  // ---- 1. Warnzeichen (W-D1, W-D3, X1, X2)
  if (g14.has('lebensmuede')) {
    // W5 hat die Stufe 112 (Entscheidung zu W5) – die Kopfzeile kommt aus
    // kopfFuer() und bietet zuerst das Gespräch an, wie in der Einschätzung.
    grund('W5', W5_TEXT, 'notruf');
    // Ein Check von heute mit 112- oder Giftnotruf-Zeichen gehört mit auf die
    // Karte – sonst stünde dort nur das Gesprächsangebot, im Gesamtbild aber „Sofort 112".
    const check = [...stand.warnzeichen].reverse().find((w) => w.datum === heute);
    if (check) {
      warnzeichenAuswerten(check.ja, stand).abschnitte.filter((a) => a.id !== 'W5' && rang(a.stufe) >= rang('tage'))
        .forEach((a) => grund(a.id, a.text, a.stufe, a.anrufe || []));
    }
    const nurW5 = gruende.filter((g) => g.stufe === 'notruf').every((g) => g.id === 'W5');
    return karte({ titel: nurW5 ? 'Bevor es um die Dosis geht: Bitte bleiben Sie damit nicht allein.' : 'Bitte zuerst den Notruf', texte: [], regeln: ['X2'] });
  }
  const unruhe = ['herz', 'schwitzen', 'puls', 'zittern'].filter((k) => g14.has(k));
  const muedeB = gruppe === 'b' && ['muede', 'frieren', 'konzentration'].some((k) => g14.has(k));
  const wd3 = gruppe === 'b' && ((tsh !== null && tsh > 20) || muedeB);
  if (unruhe.length || wd3) {
    const seit = unruhe.length ? unruhe.map((k) => g14.get(k)).sort()[0] : tag;
    // Nur ein Check von heute zählt – Beschwerden können sich über Nacht ändern.
    const check = [...stand.warnzeichen].reverse().find((w) => w.datum >= seit && w.datum === heute);
    const id = unruhe.length ? 'W-D1' : 'W-D3';
    regeln.push(id);
    if (!check) {
      const text = unruhe.length
        ? 'Bevor es um die Dosis geht: Sie haben in letzter Zeit Herzklopfen, Unruhe oder einen unregelmäßigen Puls eingetragen. Bitte gehen Sie kurz den Warnzeichen-Check durch.'
        : 'Ihr TSH ist deutlich erhöht. Bitte prüfen Sie zuerst: Sind Sie extrem schläfrig oder verwirrt, ist Ihnen sehr kalt, atmen Sie langsam? Dann sofort 112 anrufen. Gehen Sie dazu kurz den Warnzeichen-Check durch.';
      return karte({ titel: 'Zuerst der Warnzeichen-Check', frage: { id, text, optionen: null, ziel: 'warncheck', feld: null }, stufe: e.stufeLabor });
    }
    const w = warnzeichenAuswerten(check.ja, stand);
    if (w.stufe === 'notruf') {
      // Alle dringlichen Abschnitte mit ihrer eigenen Kennung und ihren
      // Nummern: der Giftnotruf fürs Bundesland (W4a), die Telefonseelsorge
      // (W5). Unter der Kennung 'W-D1' erkannte kopfFuer() W5 nicht, und
      // neben W4a fiel W5 ganz weg.
      const dringend = w.abschnitte.filter((a) => rang(a.stufe) >= rang('tage'));
      dringend.forEach((a) => grund(a.id, a.text, a.stufe, a.anrufe || []));
      const nurW5 = dringend.filter((a) => a.stufe === 'notruf').every((a) => a.id === 'W5');
      return karte({ titel: nurW5 ? 'Bevor es um die Dosis geht: Bitte bleiben Sie damit nicht allein.' : 'Bitte zuerst den Notruf', texte: [], stufeFest: 'notruf' });
    }
    // W-D1: Stufe des Checks – die Karte mindestens so hoch (Tage bei W2t, heute bei W2h).
    setzeWarn(w.stufe, rang(w.stufe) >= rang('tage') ? 'Nach Ihrem Warnzeichen-Check von heute:'
      : unruhe.length ? 'Sie haben in letzter Zeit Herzklopfen, Unruhe, Zittern oder einen unregelmäßigen Puls eingetragen.' : null);
    // X4 gilt für Herz und Unruhe – nicht, wenn W-D3 den Check wegen
    // Müdigkeit oder Frieren verlangt hat (B38). Herzklopfen an mehreren Tagen
    // (R3 „heute") ist dasselbe Anliegen wie ein Check mit Stufe Tage.
    const herzUnruhe = unruhe.length > 0 || check.ja.some((k) => ['herzklopfen', 'puls', 'unruhe'].includes(k));
    if ((gruppe === 'b' || gruppe === 'c')
      && ((herzUnruhe && rang(w.stufe) >= rang('tage')) || rang(stufeHerz) >= rang('tage'))) {
      grund('X4', 'Bei Herzklopfen oder Unruhe sollte die Praxis zuerst Herz und Puls ansehen, bevor über mehr Tablette gesprochen wird.', 'tage');
    }
    if (unruhe.includes('puls')) {
      // X1 – mit der Stufe, die die Einschätzung für den Puls nennt (S4).
      const s4 = pfade.find((t) => t.id === 'S4');
      grund('X1', (s) => `Ein neu unregelmäßiger Puls sollte ${wann(hoechste(s, 'tage'))} ärztlich angesehen werden, auch wenn Ihr Schilddrüsenwert passt.`, hoechste('tage', s4 ? s4.stufe : 'keine'));
    }
  }

  // ---- 2. Schwangerschaft (D7, nur unter 55)
  if (alt !== null && alt < 55 && p.schwanger === 'ja') {
    grund('D7', 'Bei Schwangerschaft oder Kinderwunsch gibt die App keine Einschätzung zur Dosis. Der Bedarf steigt oft schon in den ersten Wochen. Rufen Sie bitte sofort die Praxis an.', 'tage');
    return karte({});
  }

  // ---- 3. Sperrgründe, die schon feststehen
  const lab = befund.tsh;
  const tshEinheit = normEinheit('tsh', lab.einheit);
  if (!tshEinheit) grund('D0.2', 'TSH steht in einer Einheit, für die die Regeln nicht gelten. Bitte prüfen Sie die Einheit auf dem Befund (üblich: mU/l, mIE/l oder µU/ml).');
  if (!ziel && (lab.von === null || lab.bis === null)) grund('D0.1', 'Für eine Aussage zur Dosis braucht es den TSH-Bereich von Ihrem Labor. Bitte tragen Sie beide Grenzen vom Befund ein (z. B. 0,27–4,20). Mit einem allgemeinen Orientierungsbereich ordnet die App nur ein.');
  if (!plausibel(befund, stand)) grund('D0.3', 'Ein Wert in diesem Befund ist ungewöhnlich (z. B. Komma oder Einheit). Bitte bestätigen oder korrigieren Sie ihn in der Befund-Eingabe. Vorher gibt die App keine Richtung.');

  const stimmt = nachfrage(stand, 'dosis_stimmt', befund.id);
  const stimmtNein = stimmt && /^nein/.test(stimmt.antwort) ? stimmt : null;
  const nach14 = nachfrage(stand, 'nach14', befund.id);

  /*
   * D0.5 (a): Einträge nach der Abnahme – auch einer, der erst künftig gilt
   * („ab Montag 88 µg"): Die Änderung ist dann schon beschlossen (B21). Der
   * Befund gilt als beantwortet („keine") nur bei einer echten Änderung der
   * Menge, die die Praxis angeordnet hat. Ein doppelter Eintrag, nur ein
   * anderes Präparat, eine eigene Änderung oder die Berichtigung nach „Nein,
   * ich nehme etwas anderes" beantworten ihn nicht – sonst meldete die Karte
   * bei TSH 0,08 „Kein besonderer Anlass", nur weil beim Einrichten „heute"
   * stehen blieb (B59, B32).
   */
  const nachher = stand.dosen.map((d, i) => ({ d, i })).filter(({ d, i }) => i > 0 && d.ab > tag).map(({ d, i }) => ({
    d, art: aenderungsArt(d, stand.dosen[i - 1]), korrektur: Boolean(d.berichtigung || (stimmtNein && d.ab >= stimmtNein.am)),
  }));
  const dosisNach = nachher.length > 0;
  const echt = nachher.some((x) => x.art === 'dosis' && x.d.praxis === true && !x.korrektur);
  const praxisSagt = praxisHatErklaert(befund);
  let stufeFest = null;
  if (tageZwischen(tag, heute) > 92) {
    // X12: nur herabstufen, wenn die Praxis sich geäußert hat oder die Dosis seither geändert wurde
    if (praxisSagt || echt) {
      grund('D0.4', 'Der Befund ist älter als drei Monate. Er ist zu alt, um daraus etwas für heute abzuleiten, und die Praxis hat ihn wahrscheinlich schon bewertet. Wenn eine Kontrolle ansteht, lassen Sie neu messen.');
      stufeFest = 'termin';
    } else {
      grund('D0.4', (s) => `Der Befund ist älter als drei Monate und zu alt, um daraus etwas für heute abzuleiten. Falls die Praxis zu diesem Wert noch nichts gesagt hat, rufen Sie ${wann(s)} an und lassen Sie neu messen.`);
    }
  }
  /*
   * Ein neuerer Befund ohne TSH, aber mit auffälligem fT4: Die Karte darf nicht
   * aus dem älteren TSH „weniger" raten, wenn das neueste fT4 zu niedrig ist
   * (Nachprüfung zu B2). Keine Richtung, die Stufe dieses Befunds gilt.
   */
  const neuerOhneTsh = [...stand.labor].reverse().find((l) => l.datum > tag && l.datum <= heute && !l.tsh && l.ft4);
  if (neuerOhneTsh) {
    const en = befundEinschaetzen(neuerOhneTsh, stand, heute);
    if (en.stufe && en.stufe !== 'keine') {
      grund('D0.1', `Ihr neuester Befund vom ${kurz(neuerOhneTsh.datum)} enthält nur fT4, und das liegt ${en.werte.find((w) => w.key === 'ft4').einordnung.text}. Solange dazu kein TSH-Wert da ist, gibt die App keine Richtung. Bitte besprechen Sie den Wert mit der Praxis.`, en.stufe);
    }
  }
  const frist = einpendeln(stand, tag);
  if (dosisNach) {
    const x = nachher[nachher.length - 1];
    const bisher = nachher.filter((y) => y.d.ab <= heute);
    const doppelt = nachher.every((y) => y.art === 'doppelt');
    const ohneMenge = nachher.every((y) => y.art !== 'dosis');
    if (x.korrektur) {
      // Nach „Nein, ich nehme etwas anderes": Wann sie gewechselt hat, weiß die App nicht.
      grund('D0.5', `Sie haben ab ${kurz(x.d.ab)} eingetragen, was Sie jetzt nehmen${sp.tagesdosis(x.d) !== null ? ` (${ug(sp.tagesdosis(x.d))} am Tag)` : ''}. Nehmen Sie das schon seit der Blutabnahme am ${kurz(tag)} oder länger, ändern Sie bei diesem Eintrag „Gilt ab" auf den Tag, seit dem Sie es nehmen – ungefähr genügt. Haben Sie erst nach der Blutabnahme gewechselt, sagen Sie es der Praxis. Bis dahin gibt die App keine Richtung.`);
      aktionSetzen(x.d.id, 'Dosis ändern');
      ohneWieBisher = true;
    } else if (doppelt) {
      grund('D0.5', `Ab ${kurz(x.d.ab)} ist dieselbe Dosis noch einmal eingetragen${sp.tagesdosis(x.d) !== null ? ` (${ug(sp.tagesdosis(x.d))} am Tag)` : ''} – nach dieser Blutabnahme. Ist es dieselbe Tablette wie vorher, löschen Sie den doppelten Eintrag. War es ein anderes Präparat oder ein anderer Hersteller, tragen Sie dort den Namen von der Packung ein. Bis dahin gibt die App keine Richtung.`);
      aktionSetzen(x.d.id, 'Dosis ändern');
    } else if (!bisher.length) {
      grund('D0.5', `Ab ${kurz(nachher[0].d.ab)} ist schon eine neue Dosis eingetragen. Der Wert zeigt deshalb nicht, wie es ab dann ist. Eine neue Einschätzung gibt es mit dem Kontrollwert ${wochenText(frist)} nach der Änderung.`);
    } else if (ohneMenge) {
      grund('D0.5', `Nach dieser Blutabnahme haben Sie ein anderes Präparat oder einen anderen Hersteller eingetragen (ab ${kurz(nachher[0].d.ab)}). Auch das kann den Wert verändern. Eine neue Einschätzung gibt es mit dem Kontrollwert ${wochenText(frist)} nach dem Wechsel.`);
    } else {
      // Offene Quelle: Die Karte bleibt bei der Stufe des Befunds und sagt, wie
      // sich das klärt – außer die Nutzerin hat „selbst geändert" gemeldet.
      const quelleOffen = nachher.find((y) => y.art === 'dosis' && y.d.praxis === null);
      const erklaeren = quelleOffen && !praxisSagt && !(nach14 && nach14.antwort === 'selbst');
      grund('D0.5', satz(`Ihre Dosis wurde nach dieser Blutabnahme schon geändert. Der Wert zeigt deshalb nicht mehr, wie es heute ist. Eine neue Einschätzung gibt es mit dem Kontrollwert ${wochenText(frist)} nach der Änderung.`,
        erklaeren ? 'Hat die Praxis die Änderung angeordnet, tragen Sie das bei der Dosis ein („Auf Anweisung der Praxis?": Ja).' : ''));
      if (erklaeren) aktionSetzen(quelleOffen.d.id, 'Dosis ändern');
    }
    // „wie bisher" wäre nach einer eingetragenen Änderung missverständlich:
    // Gemeint ist die neue Menge, nicht die alte.
    if (!doppelt) ohneWieBisher = true;
    // Die Praxis-Angabe senkt die Stufe nur, solange sie gilt (R1: nicht mehr,
    // wenn danach neue Beschwerden eingetragen wurden – e.praxisErklaert).
    if (echt || (praxisSagt && e.praxisErklaert)) stufeFest = 'keine';
  } else if (praxisSagt) {
    if (befund.praxis === 'geaendert') {
      // F8 „Die Dosis wird geändert" – ohne neuen Eintrag gäbe es weder die
      // Kontrolle (D6c) noch INR (WW1) oder Blutzucker (WW2). Wie D6b: eintragen lassen.
      grund('D0.5', 'Die Praxis hat zu diesem Wert schon entschieden: Die Dosis wird geändert. Bitte tragen Sie die neue Dosis ein, die die Praxis festgelegt hat – dann erinnert die App an die Kontrolle.');
      aktionSetzen('praxis', 'Neue Dosis eintragen');
      ohneWieBisher = true;
    } else {
      grund('D0.5', 'Die Praxis hat zu diesem Wert schon entschieden. Dann gilt, was die Praxis gesagt hat.');
    }
    if (e.praxisErklaert) stufeFest = 'keine';
  }
  const kurzVorher = aenderungen(stand).find((d) => d.ab <= tag && tageZwischen(d.ab, tag) < frist);
  if (kurzVorher) {
    grund('D0.6', `Ihre Dosis oder Ihr Präparat wurde weniger als ${frist === 56 ? 8 : 6} Wochen vor der Abnahme geändert. Der Wert hat sich noch nicht eingependelt. Sinnvoll ist eine Kontrolle etwa ${frist === 56 ? '8' : '6 bis 8'} Wochen nach der Änderung.`);
  }
  const direkt = ['amiodaron', 'lithium', 'jod'].filter((k) => stand.mittel.includes(k));
  if (direkt.length) {
    const namen = direkt.map((k) => ({ amiodaron: 'Amiodaron', lithium: 'Lithium', jod: 'Jodtabletten, Algen oder Kelp' }[k])).join(' und ');
    grund('D0.11', `Sie nehmen ${namen}. Das beeinflusst die Schilddrüse direkt. Jede Frage zur Dosis gehört dann in die Hand der Praxis. Die App gibt keine Richtung.`);
  }
  if (gruppe === 'f') grund('D0.12', 'TSH und fT4 sind beide erhöht. Das passt nicht ins übliche Bild. Oft liegt es an unregelmäßiger Einnahme oder an einer Messstörung. Die Praxis sollte entscheiden, ob der Wert wiederholt wird.');
  if (gruppe === 'g') grund('D0.12', 'fT4 ist niedrig, ohne dass TSH erhöht ist. Das kann verschiedene Gründe haben – eine Messstörung, bestimmte Mittel oder selten eine andere Hormonstörung – und gehört ärztlich angesehen.');
  if (gruppe === 'h') grund('D0.12', `fT4 liegt über dem Bereich, TSH im Bereich. Das kommt oft vor, wenn die Tablette kurz vor der Abnahme genommen wurde.${befund.vorAbnahme === 'ja' ? ' Bei Ihnen war das so.' : ''}`);
  if (!code && !gruende.some((g) => g.id === 'D0.2')) grund('D0.2', 'Der TSH-Wert lässt sich nicht einordnen.');
  if (p.krebs === 'ja') {
    // X11: die Stufe des Musters bleibt, die Krebsregel kann sie nur anheben
    let s = e.mInfo && e.mInfo.tZ.lage === 'ueber' ? 'zeitnah' : 'termin';
    if (gruppe === 'b' && tsh !== null && tsh > 10) s = 'tage';
    if (gruppe === 'd' || (code === 'z3' && e.mInfo.variante === 'ft4-ueber')) s = tsh !== null && tsh < 0.1 && vorsichtig ? 'tage' : hoechste(s, 'zeitnah');
    grund('D0.13', 'Nach Schilddrüsenkrebs legt die Ärztin einen persönlichen Zielbereich fest; oft soll TSH bewusst niedrig sein. Deshalb gibt die App keine Richtung. Besprechen Sie jeden Wert mit Ihrer Praxis.', s);
  }
  // „Weiß nicht", ob TSH bewusst niedrig sein soll, sperrt wie jede andere
  // RW2-Sperre (Entscheidung 6, Grundsatz 3) – nicht nur „ja" (B34).
  if (p.ursache === 'hypophyse' || p.kortison === 'ja' || p.kortison === 'unbekannt'
    || (blockJaWeissNicht(p.zielNiedrig) && (['d', 'e', 'z'].includes(gruppe)))) {
    grund('D0.14', 'Bei einer Unterfunktion durch die Hirnanhangdrüse, bei einer Nebennierenschwäche, bei dauerhaftem Kortison oder wenn TSH bewusst niedrig gehalten werden soll, sagt TSH wenig über die richtige Dosis. Deshalb gibt die App keine Richtung. Besprechen Sie jeden Wert mit der Praxis.');
  }
  if (p.praeparatArt === 't3' || gruppe === 't') grund('D0.15', 'Ihr Präparat enthält neben L-Thyroxin auch T3 oder Schilddrüsenextrakt. Dann lässt sich die Dosis aus TSH nicht so einfach ablesen. Die App gibt keine Richtung. Besprechen Sie den Wert mit der Praxis.');
  // D0.16 – die Dosis fehlt, oder sie beginnt erst nach der Abnahme. Im
  // zweiten Fall ist sie eingetragen, nur ihr Beginn nicht: Beim Einrichten
  // bleibt „Seit wann?" oft auf heute stehen. Dann hilft „Gilt ab" ändern –
  // ein zweiter Eintrag erfände eine Dosisänderung (B32, B59).
  const erste = stand.dosen[0] || null;
  if (!erste) {
    grund('D0.16', 'Bitte tragen Sie zuerst ein, wie viel Sie im Moment nehmen (µg am Tag). Ohne Ihre aktuelle Dosis gibt die App keine Richtung.');
    aktionSetzen(null, 'Dosis eintragen');
  } else if (!dBef) {
    const td0 = sp.tagesdosis(erste);
    grund('D0.16', `Die App kennt Ihre Dosis erst ab ${kurz(erste.ab)}. Für die Blutabnahme am ${kurz(tag)} ist keine eingetragen. Nehmen Sie ${td0 !== null ? `${ug(td0)} am Tag` : 'diese Dosis'} schon länger, ändern Sie bei dieser Dosis „Gilt ab" auf den Tag, seit dem Sie sie nehmen – ungefähr genügt. Haben Sie damals etwas anderes genommen, tragen Sie diese frühere Dosis mit ihrem Beginn zusätzlich ein. Vorher gibt die App keine Richtung.`);
    aktionSetzen(erste.id, 'Dosis ändern');
  } else if (!dAkt || td === null) {
    grund('D0.16', 'Bei Ihrer Dosis fehlt die Stärke in µg. Bitte ergänzen Sie sie. Ohne Ihre aktuelle Dosis gibt die App keine Richtung.');
    aktionSetzen(dAkt ? dAkt.id : null, dAkt ? 'Dosis ändern' : 'Dosis eintragen');
  }
  // D0.17 – der vorige Wert lag bei gleicher Dosis auf der anderen Seite
  const lage = einordnen('tsh', befund.tsh).lage;
  const v = [...stand.labor].reverse().find((l) => l.id !== befund.id && l.tsh && l.datum < tag
    && tageZwischen(l.datum, tag) >= 42 && tageZwischen(l.datum, tag) <= 365);
  if (v && vergleichbar(v, befund, 'tsh') && !stand.dosen.some((d) => d.ab > v.datum && d.ab <= tag)) {
    const la = einordnen('tsh', v.tsh).lage;
    if ((la === 'ueber' && lage === 'unter') || (la === 'unter' && lage === 'ueber')) {
      grund('D0.17', `Ihr voriger Wert vom ${kurz(v.datum)} lag bei gleicher Dosis auf der anderen Seite des Bereichs (${zahl(v.tsh.wert)} ${v.tsh.einheit}). Die beiden Werte widersprechen sich. Lassen Sie erst nachmessen, bevor etwas geändert wird.`);
    }
  }
  if ((b.richtung === 'viel' && ['b', 'c'].includes(gruppe)) || (b.richtung === 'wenig' && ['d', 'e'].includes(gruppe))) {
    grund('D0.18', (s) => `Ihre Beschwerden der letzten vier Wochen passen nicht zu diesem Laborwert. Das sollte die Praxis ansehen, bevor etwas an der Dosis geändert wird. Rufen Sie ${wann(hoechste(s, 'zeitnah'))} an.`, 'zeitnah');
  }
  if (p.zielNiedrig === 'ja' && gruppe === 'a') {
    grund('D0.14', 'Ihre Ärztin möchte den TSH-Wert bewusst niedrig halten. Dann legt sie die Dosis fest – die App gibt keine Richtung.');
  }

  // X3 (2): Nach 14 Tagen fragt die Karte, ob inzwischen etwas passiert ist.
  if (nach14 && nach14.antwort === 'selbst') {
    // Nach einer eigenen Änderung nie „genau wie bisher weiter" (B22, B28):
    // Das hieße, bei der selbst gewählten Menge zu bleiben.
    const neu = nachher.filter((y) => y.art === 'dosis').pop();
    if (neu) {
      const i = stand.dosen.indexOf(neu.d);
      const tdNeu = sp.tagesdosis(neu.d);
      const tdAlt = sp.tagesdosis(stand.dosen[i - 1]);
      const schritt = tdNeu !== null && tdAlt !== null ? Math.abs(tdNeu - tdAlt) : 0;
      if (schritt > 25 || (tdAlt && schritt / tdAlt > 0.25)) {
        // X3 (4): mehr als ein üblicher Schritt – bis zum Anruf die bisherige Menge.
        grund('X3', (s) => `Sie haben angegeben, selbst etwas an der Dosis geändert zu haben. Das ist mehr als ein üblicher Schritt. Rufen Sie ${rang(s) >= rang('heute') ? 'heute noch' : 'heute oder morgen'} die Praxis an und nehmen Sie bis dahin wieder Ihre bisherige Menge.`, 'tage');
      } else {
        grund('X3', (s) => `Sie haben angegeben, selbst etwas an der Dosis geändert zu haben. Sagen Sie der Praxis ${wann(hoechste(s, 'tage'))}, was Sie jetzt nehmen, und fragen Sie, ob Sie dabei bleiben sollen. Eine neue Einschätzung gibt es mit dem nächsten Kontrollwert.`, 'tage');
      }
    } else {
      grund('X3', (s) => `Sie haben angegeben, selbst etwas an der Dosis geändert zu haben. Bitte tragen Sie ein, was Sie jetzt nehmen, und sagen Sie es der Praxis ${wann(hoechste(s, 'tage'))}. Eine neue Einschätzung gibt es mit dem nächsten Kontrollwert.`, 'tage');
      aktionSetzen(null, 'Dosis eintragen');
    }
  }
  // X3 (1) „Nein, ich nehme etwas anderes": Die Karte wartet auf die
  // Berichtigung – ein Eintrag ab dem Tag der Antwort oder eine andere Menge
  // als die, auf die sich das Nein bezog. Danach fragt sie neu (B26, B63).
  let stimmtGilt = stimmt;
  if (stimmtNein) {
    const bezogen = neinDosis(stimmtNein.antwort);
    const berichtigt = stand.dosen.some((d) => d.ab >= stimmtNein.am) || (bezogen !== null && td !== null && td !== bezogen);
    if (berichtigt) {
      stimmtGilt = null;
    } else {
      grund('X3', 'Sie nehmen im Moment etwas anderes als in der App eingetragen. Bitte tragen Sie ein, was Sie jetzt nehmen – mit dem Tag, seit dem Sie es nehmen. Vorher gibt die App keine Richtung.');
      aktionSetzen(null, 'Dosis eintragen');
    }
  }

  const hart = gruende.length > 0;

  // ---- 4. Offene Pflichtfragen (höchstens eine) und ihre Sperren
  let frage = null;
  const offen = (f) => { if (!frage) frage = f; };
  const bFrage = (id, feld, text, optionen = JNW) => ({ id, text, optionen, ziel: 'befund', feld, bezug: befund.id });
  const pFrage = (id, feld, text, optionen = JNW) => ({ id, text, optionen, ziel: 'profil', feld });

  if (!hart) {
    // X3 (2) „Ja, mit der Praxis gesprochen": dann zuerst fragen, was die
    // Praxis gesagt hat (F8). Erst die Antwort gibt D0.5 – vorher stünde
    // „anrufen" über „Sie haben mit der Praxis gesprochen" (B70).
    if (nach14 && nach14.antwort === 'praxis' && !praxisSagt && !(befund.praxisAm && befund.praxisAm >= nach14.am)) {
      offen(bFrage('F8', 'praxis', 'Sie haben mit der Praxis gesprochen. Was hat die Praxis zu diesem Wert gesagt?', [['bleibt', 'Die Dosis bleibt so'], ['geaendert', 'Die Dosis wird geändert'], ['nachmessen', 'Erst nachmessen'], ['nochnicht', 'Noch nichts entschieden']]));
    }
    // F8 – hat die Praxis schon etwas gesagt?
    if (!befund.praxis) {
      offen(bFrage('F8', 'praxis', 'Hat die Praxis zu diesem Wert schon etwas gesagt?', [['bleibt', 'Ja: Die Dosis bleibt so'], ['geaendert', 'Ja: Die Dosis wird geändert'], ['nachmessen', 'Ja: Erst nachmessen'], ['nochnicht', 'Noch nicht']]));
    }
    // X3 (1) – nimmt sie wirklich, was eingetragen ist?
    if (!stimmtGilt) {
      offen({ id: 'X3', text: `Nehmen Sie im Moment genau ${ug(td)} am Tag, so wie in der App eingetragen?`, optionen: [['ja', 'Ja'], [neinWert(td), 'Nein, ich nehme etwas anderes']], ziel: 'nachfrage', feld: 'dosis_stimmt', bezug: befund.id });
    }
    // P2 / D0.13 – Krebs
    if (!p.krebs) offen(pFrage('P2', 'krebs', 'Wurden Sie jemals wegen Schilddrüsenkrebs behandelt (Operation oder Radiojod)? Nach Schilddrüsenkrebs soll TSH oft bewusst niedrig sein – ein Rat zu „weniger" wäre dann falsch.'));
    else if (p.krebs === 'unbekannt') grund('D0.13', 'Bitte geben Sie im Profil an, ob Sie je wegen Schilddrüsenkrebs behandelt wurden. Vorher gibt die App keine Richtung.');
    // P9 / D0.14 – Kortison, Nebenniere
    if (!p.kortison) offen(pFrage('P9', 'kortison', 'Nehmen Sie dauerhaft Kortison als Tablette (z. B. Prednisolon, Hydrocortison) oder wurde bei Ihnen eine Nebennierenschwäche festgestellt?'));
    // X6 – Geburtsjahr bei Muster c
    if (gruppe === 'c' && alt === null) offen({ id: 'X6', text: 'In welchem Jahr sind Sie geboren? Im Alter wird ein etwas höherer TSH-Wert oft bewusst hingenommen – ohne Ihr Alter gibt die App hier keine Richtung.', optionen: null, ziel: 'profil', feld: 'geburtsjahr', typ: 'jahr' });
    // Q4 – Hirnanhangdrüse oder bewusst niedrig (d/e bei offenem Grund). P1
    // verlangt die Frage bei jeder offenen Ursache: „nein" zu „bewusst
    // niedrig" beantwortet nur deren zweiten Teil (B29). Dann fragt sie nur
    // noch nach der Hirnanhangdrüse – die Antwort landet im selben Feld.
    if (['d', 'e'].includes(gruppe) && ['andere', 'unbekannt', ''].includes(p.ursache)) {
      if (!p.hypophyseOderNiedrig) {
        offen(pFrage('Q4', 'hypophyseOderNiedrig', p.zielNiedrig === 'nein'
          ? 'Hat Ihnen eine Ärztin einmal gesagt, dass die Ursache Ihrer Unterfunktion in der Hirnanhangdrüse liegt?'
          : 'Hat Ihnen eine Ärztin einmal gesagt, dass die Ursache in der Hirnanhangdrüse liegt oder dass Ihr TSH bewusst niedrig gehalten werden soll?'));
      } else if (blockJaWeissNicht(p.hypophyseOderNiedrig)) grund('D0.14', 'Wenn die Ursache in der Hirnanhangdrüse liegt oder TSH bewusst niedrig gehalten werden soll, sagt TSH wenig über die richtige Dosis. Deshalb gibt die App keine Richtung. Besprechen Sie jeden Wert mit der Praxis.');
    }
    // F2 / D0.9 – Biotin (jedes Muster)
    if (stand.mittel.includes('biotin') || blockJaWeissNicht(befund.biotin)) {
      grund('D0.9', 'Biotin steckt auch in Mitteln für Haare, Haut und Nägel und in Vitamin-B-Komplexen. Es verfälscht bei vielen Labortests TSH und fT4: TSH wirkt zu niedrig, fT4 zu hoch. Lassen Sie den Wert wiederholen, nachdem Sie Biotin mindestens 3 Tage weggelassen haben (hoch dosiert eine Woche), und sagen Sie der Praxis Bescheid. Wenn Sie unsicher sind: Schauen Sie auf der Packung nach „Biotin" oder „Vitamin B7".');
    } else if (!befund.biotin) offen(bFrage('F2', 'biotin', 'Haben Sie in der Woche vor der Abnahme Biotin, ein Mittel für Haare, Haut oder Nägel oder einen Vitamin-B-Komplex genommen?'));
    // F3–F5 / D0.10 – Krankheit, Kortison, Kontrastmittel
    const d010 = ['krank', 'kortison', 'kontrastmittel'].some((k) => blockJaWeissNicht(befund[k]));
    if (d010) grund('D0.10', 'Eine schwere Krankheit, ein Krankenhausaufenthalt, eine Operation, Kortison oder ein Kontrastmittel kurz vor der Abnahme können TSH vorübergehend verändern. Lassen Sie den Wert wiederholen, wenn Sie wieder gesund sind, frühestens 6 Wochen danach. Sagen Sie der Praxis Bescheid.');
    if (!befund.krank) offen(bFrage('F3', 'krank', 'Waren Sie in den 6 Wochen vor der Abnahme schwer krank, im Krankenhaus oder wurden Sie operiert?'));
    if (!befund.kortison) offen(bFrage('F4', 'kortison', 'Haben Sie in den 6 Wochen vor der Abnahme Kortison als Tablette oder Spritze bekommen? (Spray und Salbe zählen nicht.)'));
    if (!befund.kontrastmittel) offen(bFrage('F5', 'kontrastmittel', 'Hatten Sie in den 8 Wochen vor der Abnahme eine Untersuchung mit Kontrastmittel, z. B. CT oder Herzkatheter?'));
    // X14 / F10 – andere Packung
    if (blockJaWeissNicht(befund.packung)) grund('D0.6', 'Sie haben kurz vor der Abnahme eine Packung mit anderem Namen, Hersteller oder anderer Stärke bekommen. Der Wert hat sich womöglich noch nicht eingependelt. Sinnvoll ist eine Kontrolle etwa 6 bis 8 Wochen nach dem Wechsel.');
    else if (!befund.packung) offen(bFrage('F10', 'packung', 'Haben Sie in den 8 Wochen vor der Abnahme eine Packung mit anderem Namen, Hersteller oder anderer Stärke bekommen?'));
    // F6/F7 / D0.8a – Mittel oder Einnahme geändert (b, c, d, e); E15: Uhrzeit verschoben zählt als ja
    if (['b', 'c', 'd', 'e'].includes(gruppe)) {
      const uhrVerschoben = stand.uhrWechsel.some((u) => u.am <= tag && tageZwischen(u.am, tag) < 56);
      if (blockJaWeissNicht(befund.mittelGeaendert) || blockJaWeissNicht(befund.einnahmeGeaendert) || uhrVerschoben) {
        grund('D0.8', 'In den Wochen vor der Abnahme wurde ein Mittel begonnen oder abgesetzt oder die Einnahme geändert. Das kann den Wert verschieben, ohne dass Ihre Dosis falsch ist. Behalten Sie jetzt alles gleich bei und lassen Sie nach 6 bis 8 Wochen neu messen. Sagen Sie der Praxis, was sich geändert hat.');
      }
      if (!befund.mittelGeaendert) offen(bFrage('F6', 'mittelGeaendert', 'Haben Sie in den 8 Wochen vor der Abnahme ein Mittel neu begonnen oder abgesetzt, z. B. Magenschutz, Kalzium (auch mit Vitamin D), Eisen, Magnesium, Mittel gegen Sodbrennen, Ballaststoffe, Östrogen oder ein Knochenmittel?'));
      if (!befund.einnahmeGeaendert && !uhrVerschoben) offen(bFrage('F7', 'einnahmeGeaendert', 'Haben Sie in dieser Zeit etwas an Ihrer Einnahme geändert, z. B. Frühstück oder Kaffee näher an die Tablette gerückt oder die Uhrzeit gewechselt?'));
    }
    // D0.7 – Einnahme (b, c)
    if (gruppe === 'b' || gruppe === 'c') {
      const x = einnahmenVor(befund, stand, 42, stand.profil.seit);
      const schluss = ' Vergessene Tabletten erhöhen TSH. Nehmen Sie die Tablette jetzt jeden Tag und lassen Sie in 6 bis 8 Wochen neu messen – sonst wäre eine höhere Dosis später zu viel.';
      if (x.nicht >= 3 || (x.erfasst >= 1 && x.genommen / x.erfasst < 0.9)) {
        grund('D0.7', `In den sechs Wochen vor der Abnahme wurde die Tablette an ${x.nicht} ${x.nicht === 1 ? 'Tag' : 'Tagen'} nicht genommen.${schluss}`);
      } else if (x.erfasst < 34 || befund.vergessen) {
        if (['einzelne', 'mehrere', 'unbekannt'].includes(befund.vergessen)) grund('D0.7', `Sie haben angegeben, dass in den sechs Wochen vor der Abnahme Tabletten vergessen wurden oder Sie es nicht sicher wissen.${schluss}`);
        else if (!befund.vergessen) offen(bFrage('Q1', 'vergessen', 'Haben Sie die Tablette in den 6 Wochen vor der Blutabnahme wirklich jeden Tag genommen?', [['nein', 'Ja, jeden Tag'], ['einzelne', 'Einzelne Tage vergessen'], ['mehrere', 'Mehrere Tage vergessen'], ['unbekannt', 'Weiß nicht']]));
      }
      if (['nein', 'unbekannt'].includes(befund.einnahmeArt)) {
        grund('D0.7', 'Zuerst die Einnahme ordnen: jeden Morgen nüchtern mit einem Glas Wasser, 30 bis 60 Minuten vor Frühstück und Kaffee, jeden Tag gleich. Nach 6 bis 8 Wochen neu messen lassen. Sagen Sie der Praxis, dass der Wert erhöht war.');
      } else if (!befund.einnahmeArt) offen(bFrage('Q2', 'einnahmeArt', 'Nehmen Sie die Tablette morgens nüchtern mit Wasser, 30 bis 60 Minuten vor Frühstück und Kaffee?', [['ja', 'Ja'], ['abends', 'Abends, so mit der Praxis abgesprochen'], ['nein', 'Nein'], ['unbekannt', 'Weiß nicht']]));
      // D0.8b – Abstände bei Aufnahmehemmern
      const hemmer = ['kalzium', 'eisen', 'magnesium', 'multimineral', 'antazida', 'sucralfat', 'soja', 'ballaststoffe', 'colestyramin', 'kaffee', 'bisphosphonat'].filter((k) => stand.mittel.includes(k));
      if (hemmer.length) {
        const profilJa = hemmer.every((k) => stand.mittelAbstand[k] === 'ja' || k === 'bisphosphonat');
        const profilNein = hemmer.some((k) => ['nein', 'unbekannt'].includes(stand.mittelAbstand[k]));
        const ok = befund.abstandOk || (profilJa ? 'ja' : '');
        if (['nein', 'unbekannt'].includes(ok) || (!befund.abstandOk && profilNein)) {
          grund('D0.8', 'Ein Mittel aus Ihrer Liste kann die Aufnahme der Tablette stören. Halten Sie zuerst jeden Tag die Abstände ein und lassen Sie nach 6 bis 8 Wochen neu messen. Eine höhere Dosis wäre sonst zu viel, sobald der Abstand stimmt.');
        } else if (!ok) offen(bFrage('Q3', 'abstandOk', 'Halten Sie die Abstände aus Ihrem Plan „Was braucht Abstand?" jeden Tag ein?'));
      }
    }
    // D5 – F1 und Q5 (Q5 auch bei e, X3)
    if (gruppe === 'd' && !befund.vorAbnahme) offen(bFrage('F1', 'vorAbnahme', 'Haben Sie die Tablette am Morgen der Blutabnahme schon vorher genommen?'));
    if (gruppe === 'd' || gruppe === 'e') {
      if (befund.verwechselt === 'einmal') {
        // X15: der Giftnotruf fürs eingetragene Bundesland, mit Nummer und Knopf (ohne Bundesland 112, P5).
        const gift = giftnotrufAnruf(stand);
        const giftText = gift.nummer === '112' ? 'den Giftnotruf (ohne eingetragenes Bundesland: 112)' : `den ${gift.text}`;
        grund('Q5', `Wenn Sie einmalig viele Tabletten auf einmal genommen haben: Rufen Sie heute noch ${giftText} oder die Praxis an. Bei Brustschmerz, Herzrasen oder Atemnot: sofort 112. Die Beschwerden setzen oft erst nach Tagen ein.`, 'heute', [gift, TEL_112]);
      } else if (befund.verwechselt === 'tage') {
        grund('Q5', (s) => `Nehmen Sie ab jetzt wieder genau Ihre verordnete Stärke, so wie die Praxis sie festgelegt hat, und rufen Sie ${wann(hoechste(s, 'tage'))} die Praxis an. Lassen Sie danach neu messen.`, 'tage');
      } else if (!befund.verwechselt) {
        offen(bFrage('Q5', 'verwechselt', 'Haben Sie vielleicht versehentlich mehr genommen oder eine Packung mit einer anderen Stärke bekommen?', [['nein', 'Nein'], ['einmal', 'Ja, einmal viele Tabletten auf einmal'], ['tage', 'Ja, über Tage zu viel oder eine andere Stärke'], ['unbekannt', 'Weiß nicht']]));
      }
    }
    // X3 (2) – Richtung nur 14 Tage ohne Rückfrage
    // Die Richtung gilt 14 Tage ab der Antwort auf die Dosisfrage – dann wird
    // nachgefragt, bevor sie wieder erscheint. „Noch nicht" gibt weitere 14 Tage.
    const anker = nach14 && nach14.antwort === 'nein' ? nach14 : stimmtGilt && stimmtGilt.antwort === 'ja' ? stimmtGilt : null;
    if (anker && tageZwischen(anker.am, heute) >= 14) {
      offen({ id: 'X3-14', text: 'Haben Sie inzwischen mit der Praxis über diesen Wert gesprochen oder selbst etwas an der Dosis geändert?', optionen: [['praxis', 'Ja, mit der Praxis gesprochen'], ['selbst', 'Ich habe selbst etwas geändert'], ['nein', 'Nein, noch nicht']], ziel: 'nachfrage', feld: 'nach14', bezug: befund.id });
    }
  }

  if (gruende.length) return karte({ stufe: e.stufeLabor, stufeFest });
  if (frage) return karte({ titel: 'Zuerst eine Frage', frage, stufe: e.stufeLabor });

  // ---- 5. Die Richtung (D1–D5)
  /*
   * Die Frist aus Befund und Muster – nur, wenn sie die Stufe der Karte
   * bestimmt (s === eigen) und mindestens `ab` ist. Kommt die höhere Stufe aus
   * Befinden oder Check, nennt karte() sie in der Warnzeile; so steht jede
   * Frist genau einmal da und nie unter der Kopfzeile.
   */
  const fristHier = (s, eigen, ab = 'zeitnah') => (s === eigen && rang(s) >= rang(ab) ? fristSatz(s) : '');
  const og = ziel ? ziel.bis : lab.bis;
  const unten = ziel ? ziel.von : lab.von;
  const sMehr = vorsichtig || td <= 50
    ? 'Ärztinnen erhöhen dann meist nur in einem kleinen Schritt von 12,5 µg (Mikrogramm) am Tag und begleiten das eng.'
    : 'Ärztinnen erhöhen dann meist um 12,5 bis 25 µg (Mikrogramm) am Tag.';
  // Bei 12,5 µg am Tag wäre „um 12,5 µg verringern" das Absetzen – eine neue
  // Tagesdosis von 0 wäre ablesbar (Grundsatz 4). Dann keine Zahl (B30).
  const sWeniger = td <= 12.5 ? 'Bei so kleiner Dosis entscheidet die Praxis, ob und wie verringert wird.'
    : td <= 50 ? 'Ärztinnen verringern dann meist um 12,5 µg (Mikrogramm) am Tag.' : 'Ärztinnen verringern dann meist um 12,5 bis 25 µg (Mikrogramm) am Tag.';
  const warumKlein = () => {
    if (!vorsichtig) return '';
    if (alt === null || ['unbekannt', ''].includes(p.herz)) return 'Weil Alter oder Herz im Profil fehlen, geht das nur in kleinen Schritten. ';
    if (p.herz === 'ja') return 'Weil Sie eine Herzerkrankung haben, geht das nur in kleinen Schritten. ';
    return 'Weil Sie über 65 sind, geht das nur in kleinen Schritten. ';
  };
  const herzZusatz = 'Wenn nach einer Erhöhung Schmerzen oder Engegefühl in der Brust, Herzrasen oder Atemnot auftreten: sofort 112 anrufen.';
  /* „Fragen Sie beim nächsten Termin …" nur, wenn die Karte selbst beim Termin steht. */
  const zielFrage = (s, eigen) => (rang(s) <= rang('termin')
    ? 'Fragen Sie beim nächsten Termin, welcher Zielbereich für Sie gilt.'
    : satz(fristHier(s, eigen), 'Fragen Sie in der Praxis auch, welcher Zielbereich für Sie gilt.'));

  // Vorbefund über der Grenze bei gleicher Dosis (D2b/D2c)
  const vorUeber = v && vergleichbar(v, befund, 'tsh') && !stand.dosen.some((d) => d.ab > v.datum && d.ab <= tag)
    && einordnen('tsh', v.tsh).lage === 'ueber' ? v : null;

  if (gruppe === 'a') {
    const breite = og - unten;
    const amRand = tsh !== null && breite > 0 && (tsh <= unten + 0.1 * breite || tsh >= og - 0.1 * breite);
    const unterRand = tsh !== null && (tsh < 0.6 || (breite > 0 && tsh <= unten + 0.1 * breite));
    if (!ziel && (vorsichtig || p.osteoporose !== 'nein') && unterRand) {
      return karte({
        richtung: 'gleich', titel: 'Das spricht dafür, die Dosis so zu lassen – und nach dem Zielbereich zu fragen.', stufe: 'termin', regeln: ['D1b'],
        texte: [(s, eigen) => satz('Ihr TSH liegt am unteren Rand. Im Alter, bei Herz- oder Knochenerkrankung wird TSH oft etwas höher angestrebt.', zielFrage(s, eigen))],
      });
    }
    const texte = [(s, eigen) => satz(`Ihr TSH liegt im Bereich ${ziel ? 'den Ihre Ärztin festgelegt hat' : 'Ihres Labors'}. Das spricht dafür, die Dosis so zu lassen. Beschwerden allein sind kein Grund, die Dosis zu ändern. Sie haben oft andere Ursachen, zum Beispiel Blutarmut, Vitamin-B12- oder Eisenmangel, Schlaf, Stimmung oder andere Medikamente. Wenn Sie sich über Wochen deutlich schlecht fühlen, sprechen Sie es in der Praxis an.`, fristHier(s, eigen))];
    const vorher = [...stand.labor].reverse().find((l) => l.id !== befund.id && l.tsh && l.datum < tag);
    if (amRand && (!vorher || !stand.dosen.some((d) => d.ab > vorher.datum && d.ab <= tag))) texte.push('Ein Wert knapp am Rand des Bereichs schwankt von Messung zu Messung. Das ist kein Grund für eine Änderung.');
    if (g28.has('muede')) texte.push('Bei Hashimoto kommt eine chronische Entzündung der Magenschleimhaut häufiger vor. Sie kann zu Vitamin-B12- und Eisenmangel führen. Wenn Sie trotz guter Schilddrüsenwerte müde sind, lassen Sie Blutbild, B12 und Ferritin prüfen.');
    return karte({ richtung: 'gleich', titel: 'Das spricht dafür, die Dosis so zu lassen.', texte, stufe: b.richtung ? 'termin' : 'keine', regeln: ['D1'] });
  }

  // D2d (X9) – hohe Dosis oder Hinweise auf gestörte Aufnahme
  if (gruppe === 'b' || gruppe === 'c') {
    const kg = stand.gewicht.length ? stand.gewicht[stand.gewicht.length - 1].kg : null;
    const erhoehungen = stand.dosen.filter((d, i) => i > 0 && tageZwischen(d.ab, heute) <= 365 && sp.tagesdosis(d) !== null
      && sp.tagesdosis(stand.dosen[i - 1]) !== null && sp.tagesdosis(d) > sp.tagesdosis(stand.dosen[i - 1])).length;
    const hoch = td > 150 || (kg && td / kg > 1.6) || (!kg && td > (vorsichtig ? 100 : 125))
      || (kg && (alt === null || alt >= 65) && td / kg > 1.3) || erhoehungen >= 2
      || g28.has('durchfall') || g28.has('abnahme');
    if (hoch) {
      // Eine hohe Dosis macht einen hohen TSH nicht weniger dringlich: über 10
      // gilt Tage wie bei D2c, und nie weniger als das Muster (B24).
      return karte({
        richtung: 'klaeren', titel: KOPF_KLAEREN, stufe: gruppe === 'b' || (tsh !== null && tsh > 10) ? 'tage' : 'zeitnah', regeln: ['D2d'],
        texte: [(s, eigen) => satz('Ihr TSH ist erhöht, obwohl Sie schon eine hohe Dosis nehmen oder die Dosis schon mehrfach erhöht wurde – oder Sie haben Durchfall oder abgenommen. Dann ist mehr Tablette oft nicht die Lösung. Häufiger wird die Tablette nicht richtig aufgenommen, etwa wegen der Einnahme, des Magens, des Darms, anderer Mittel oder einer Zöliakie. Das sollte die Praxis klären.', fristHier(s, eigen, 'tage'), 'Bitte nehmen Sie nicht selbst mehr.'), E5_TEXT],
      });
    }
  }

  if (gruppe === 'c') {
    // D2a – im Alter oft gewollt (nur mit Geburtsjahr, ohne Ziel)
    const grenzeAlt = alt !== null && alt >= 80 ? 7 : 6;
    if (!ziel && alt !== null && alt >= 70 && tsh <= grenzeAlt) {
      return karte({
        richtung: 'gleich', titel: 'Das spricht eher dafür, die Dosis so zu lassen.', stufe: 'termin', regeln: ['D2a'],
        texte: [(s, eigen) => satz('Ihr TSH liegt etwas über dem Bereich des Labors. Im Alter wird ein etwas höherer TSH-Wert oft bewusst hingenommen, weil zu viel Hormon Herz und Knochen belastet. Das spricht eher dafür, die Dosis so zu lassen.', zielFrage(s, eigen))],
      });
    }
    // X7 – über 80 mit Herzkrankheit im Graubereich: keine Richtung
    if (alt !== null && alt >= 80 && herzVorsicht && tsh <= 10) {
      return karte({
        richtung: 'klaeren', titel: KOPF_KLAEREN, stufe: 'termin', regeln: ['X7'],
        texte: [(s, eigen) => satz('Ihr TSH ist etwas erhöht. Über 80 und mit einer Herzerkrankung ist ein TSH unter 10 oft die gewollte Einstellung.', rang(s) <= rang('termin')
          ? 'Ob etwas geändert wird, sollte die Praxis entscheiden – sprechen Sie es beim nächsten Termin an.'
          : satz('Ob etwas geändert wird, sollte die Praxis entscheiden.', fristHier(s, eigen))), KLAEREN_SATZ],
      });
    }
    const zusatz = [];
    let stufe;
    // Der Graubereich endet bei TSH 10: Darüber gilt nach L3a und D2c immer
    // Tage, auch wenn 1,5 × Obergrenze (Labor 7,5 oder Ziel bis 8) höher läge (B24).
    const graubereich = tsh <= 10 && (tsh <= 1.5 * og || vorsichtig);
    if (graubereich) {
      stufe = 'termin';
      zusatz.push('Ihr TSH ist leicht erhöht. Ein einzelner, nur leicht erhöhter Wert kann auch Schwankung sein. Deshalb wird oft zuerst in 6 bis 8 Wochen nachgemessen oder die Dosis in einem kleinen Schritt erhöht, meist um 12,5 µg (Mikrogramm) am Tag. Was davon, entscheidet die Praxis.');
    } else {
      stufe = tsh > 10 ? 'tage' : 'zeitnah';
      zusatz.push((s, eigen) => satz(`Ihr TSH ist zu hoch. Das spricht für eine etwas höhere Dosis. ${warumKlein()}${sMehr}`, fristHier(s, eigen, 'tage')));
    }
    if (vorUeber) {
      zusatz.push(`Schon am ${kurz(vorUeber.datum)} lag Ihr TSH über dem Bereich (${zahl(vorUeber.tsh.wert)} ${vorUeber.tsh.einheit}). Zweimal erhöht spricht klarer für eine etwas höhere Dosis.`);
      stufe = hoechste(stufe, 'zeitnah');
    }
    if (graubereich) zusatz.push((s, eigen) => fristHier(s, eigen, 'tage'));
    if (vorsichtig) zusatz.push(herzZusatz);
    return karte({
      richtung: 'mehr',
      titel: graubereich ? 'Das spricht für eine Kontrolle oder einen kleinen Schritt nach oben.' : 'Das spricht für eine etwas höhere Dosis.',
      texte: zusatz, schritt: graubereich ? 'Ärztinnen erhöhen dann meist nur in einem kleinen Schritt von 12,5 µg (Mikrogramm) am Tag.' : sMehr,
      stufe, warnzeichen: vorsichtig ? WD2 : null, regeln: [graubereich ? 'D2b' : 'D2c'],
    });
  }

  if (gruppe === 'b') {
    return karte({
      richtung: 'mehr', titel: 'Das spricht klar dafür, dass Ihre Dosis im Moment zu niedrig ist.', stufe: 'tage', regeln: ['D3'], schritt: sMehr,
      warnzeichen: vorsichtig ? WD2 : null,
      texte: [(s, eigen) => satz('Ihr TSH ist zu hoch und Ihr fT4 zu niedrig.', fristHier(s, eigen), `${warumKlein()}${sMehr} Nehmen Sie nicht auf eigene Faust mehr, und schon gar nicht mehrere Schritte auf einmal. Wenn Sie sehr schläfrig oder verwirrt sind oder stark frieren, machen Sie gleich den Warnzeichen-Check.`), ...(vorsichtig ? [herzZusatz] : [])],
    });
  }

  const d4 = (zusatzVorher = []) => {
    const risikoKnochen = p.osteoporose !== 'nein';
    if (alt !== null && alt < 65 && p.herz === 'nein' && p.osteoporose === 'nein' && tsh >= 0.1) {
      // „Oft wird erst in 6 bis 8 Wochen nachgemessen" nur, wenn die Karte beim
      // Termin steht – bei Muster d oder Herzklopfen gilt eine kürzere Frist (B24).
      return karte({
        richtung: 'weniger', titel: 'Das spricht für eine etwas niedrigere Dosis oder zunächst eine Kontrolle.', stufe: 'termin', regeln: ['D4a'], schritt: sWeniger,
        texte: [...zusatzVorher, (s, eigen) => satz('Ihr TSH ist leicht zu niedrig. Das spricht für eine etwas niedrigere Dosis oder zunächst eine Kontrolle.',
          rang(s) <= rang('termin') ? 'Oft wird erst in 6 bis 8 Wochen nachgemessen. Das entscheidet die Praxis.' : satz('Ob erst nachgemessen wird, entscheidet die Praxis.', fristHier(s, eigen)),
          nichtWeglassen(dAkt))],
      });
    }
    // D4b: eine Frist, aus der Stufe – nicht „innerhalb von ein bis zwei
    // Wochen" und darunter „in den nächsten Tagen" (B35, B62).
    const stufe = tsh < 0.1 ? 'tage' : vorsichtig || risikoKnochen ? 'zeitnah' : 'termin';
    const texte = [...zusatzVorher, (s, eigen) => satz(`Ihr TSH ist zu niedrig. Das spricht für eine etwas niedrigere Dosis. ${sWeniger}`,
      vorsichtig || risikoKnochen ? 'Gerade im Alter, bei Herzkrankheit oder bei Knochenschwund belastet zu viel Hormon auf Dauer Herz und Knochen, auch wenn Sie sich gut fühlen.' : '',
      fristHier(s, eigen), nichtWeglassen(dAkt))];
    return karte({ richtung: 'weniger', titel: 'Das spricht für eine etwas niedrigere Dosis.', stufe, regeln: ['D4b'], schritt: sWeniger, texte });
  };

  const y = befund.verwechselt === 'unbekannt' ? ['Schauen Sie auf Ihre Packung: Steht dort dieselbe Stärke (µg) wie in der App?'] : [];
  if (gruppe === 'e') {
    const f1 = e.mInfo.variante === 'aus-d' && befund.vorAbnahme === 'ja' ? ['Die Tablette war vor der Abnahme genommen. fT4 kann dadurch höher sein; entscheidend ist hier das TSH.'] : [];
    return d4([...y, ...f1]);
  }

  if (gruppe === 'd') {
    const obenFt4 = befund.ft4 && befund.ft4.bis !== null ? befund.ft4.bis : null;
    if (befund.vorAbnahme === 'ja' && obenFt4 !== null && befund.ft4.wert <= 1.2 * obenFt4) {
      return d4([...y, 'Die Tablette war vor der Abnahme genommen. fT4 kann dadurch höher sein; entscheidend ist hier das niedrige TSH.']);
    }
    const texte = [...y, (s, eigen) => satz('Ihr TSH ist zu niedrig und Ihr fT4 zu hoch. Das spricht für eine niedrigere Dosis.', fristHier(s, eigen), `${sWeniger} Die Menge legt die Praxis fest. Setzen Sie die Tablette nicht einfach ab und lassen Sie keine Tage weg.${mengeText(dAkt) ? ` ${nichtWeglassen(dAkt)}` : ''}`)];
    // „heute oder morgen" nur, solange die Karte nicht selbst „heute" sagt.
    if (g14.has('herz') || g14.has('schwitzen')) texte.push((s) => (rang(s) >= rang('heute') ? '' : 'Wenn Sie seit Tagen Herzklopfen, Zittern oder innere Unruhe haben: Rufen Sie heute oder morgen an.'));
    return karte({ richtung: 'weniger', titel: 'Das spricht für eine niedrigere Dosis.', stufe: 'tage', regeln: ['D5'], schritt: sWeniger, texte, warnzeichen: WD2 });
  }

  // Übrige Muster (z) – keine Richtung
  grund('D0.14', 'Für dieses Muster gibt die App keine Richtung. Besprechen Sie den Wert mit der Praxis.');
  return karte({ stufe: e.stufeLabor });
}

// ---------------------------------------------------------------- Hinweise für „Heute"

/**
 * Was nach einer Dosisänderung dran ist: Kontrolle (D6c), Nachfragen (W-D4),
 * INR (WW1), Blutzucker (WW2), eigenmächtige Änderung (B2, X3), Präparat-
 * oder Uhrzeitwechsel (P7, E15). Jeder Hinweis: { id, stufe, text, anrufe, frage? }.
 */
export function dosisHinweise(stand, heute) {
  const h = [];
  const add = (id, stufe, text, extra = {}) => h.push({ id, stufe, text, ...extra });
  // Ein doppelter Eintrag (alles gleich wie der vorige) ist keine Änderung:
  // Er löst weder „Ihre Schilddrüsendosis wurde geändert" noch eine Kontrolle aus (B59).
  const bisHeute = stand.dosen.filter((d) => d.ab <= heute);
  const dosen = bisHeute.filter((d, i) => i === 0 || aenderungsArt(d, bisHeute[i - 1]) !== 'doppelt');
  const letzte = dosen.length > 1 ? dosen[dosen.length - 1] : null;
  const vorige = letzte ? dosen[dosen.length - 2] : null;
  const art = letzte ? aenderungsArt(letzte, vorige) : null;
  // Nach „Nein, ich nehme etwas anderes" eingetragen: eine Berichtigung, keine
  // Änderung – keine Kontrolle „nach der Änderung", keine Nachfragen nach 14
  // und 28 Tagen, kein „wieder die bisherige Menge" (Nachprüfung zu B26).
  const berichtigt = Boolean(letzte && letzte.berichtigung);

  // D6c – Kontrolle nach einer Änderung oder nach „erst nachmessen"
  const nachmessen = [...stand.labor].reverse().find((l) => l.praxis === 'nachmessen' && l.datum <= heute);
  const aenderungAm = letzte && !berichtigt ? letzte.ab : null;
  const nachmessenAm = nachmessen ? nachmessen.praxisAm || nachmessen.datum : null;
  const seit = [aenderungAm, nachmessenAm].filter(Boolean).sort().pop();
  if (seit) {
    const ausAenderung = seit === aenderungAm;
    // Nach einer Änderung ab 70 (oder ohne Geburtsjahr) 8 Wochen wie D0.6 –
    // sonst verwirft die Karte den Kontrollwert, zu dem D6c geschickt hat (B31).
    const ab = ausAenderung ? einpendeln(stand, seit) : 42;
    const n = tageZwischen(seit, heute);
    const neuerBefund = stand.labor.some((l) => l.tsh && l.datum > seit && l.datum <= heute);
    if (!neuerBefund && n >= ab && (n <= ab + 28 || (n % 7 === 0 && n <= 183))) {
      // Der Text sagt, was war (B36): eine Änderung der Dosis, ein Präparatwechsel oder „erst nachmessen".
      const anfang = !ausAenderung ? `Die Praxis wollte nach Ihrem Befund vom ${kurz(nachmessen.datum)} nachmessen lassen.`
        : art === 'praeparat' ? `Sie haben am ${kurz(seit)} ein anderes Präparat oder einen anderen Hersteller eingetragen.`
          : `Ihre Dosis wurde am ${kurz(seit)} geändert.`;
      // Nach drei Monaten ohne Kontrolle „zeitnah" wie L7d – es ist dieselbe Kontrolle (B37).
      add('D6c', n > 90 ? 'zeitnah' : 'termin', `${anfang} Jetzt ist die Kontrolle fällig (${wochenText(ab)} danach). Bis ein neuer Wert da ist, zeigt die App keine neue Richtung. ${VOR_ABNAHME}`);
    }
  }

  if (letzte) {
    const n = tageZwischen(letzte.ab, heute);
    const tdNeu = sp.tagesdosis(letzte);
    const tdAlt = sp.tagesdosis(vorige);
    const mehr = tdNeu !== null && tdAlt !== null && tdNeu > tdAlt;
    const weniger = tdNeu !== null && tdAlt !== null && tdNeu < tdAlt;
    const was = berichtigt ? 'Sie haben berichtigt, welche Menge Sie nehmen – vielleicht hat sich Ihre Einnahme also kürzlich geändert.'
      : art === 'praeparat' ? 'Ihr Schilddrüsen-Präparat wurde gewechselt.' : 'Ihre Schilddrüsendosis wurde geändert.';

    // W-D4 – Nachfragen nach 14 und 28 Tagen
    const frage = (tag, text) => {
      const bezug = `${letzte.id}-${tag}`;
      const antwort = [...stand.nachfragen].reverse().find((x) => x.art === 'wd4' && x.bezug === bezug);
      if (!antwort && n >= tag && n <= tag + 6) {
        add('W-D4', 'termin', text, { frage: { id: 'W-D4', text, optionen: [['ja', 'Ja'], ['nein', 'Nein']], ziel: 'nachfrage', feld: 'wd4', bezug } });
      } else if (antwort && antwort.antwort === 'ja' && tageZwischen(antwort.am, heute) <= 3) {
        add('W-D4', mehr ? 'heute' : 'termin', mehr
          ? 'Bitte gehen Sie den Warnzeichen-Check durch und sagen Sie der Praxis heute oder morgen Bescheid.'
          : 'Sprechen Sie das bei der Kontrolle an. Ändern Sie nichts selbst.');
      }
    };
    if (berichtigt && n >= 0 && n <= 14) {
      add('X3b', 'termin', 'Sie haben berichtigt, welche Menge Sie im Moment nehmen. Ist das nicht die Menge, die Ihre Praxis verordnet hat, rufen Sie bitte in den nächsten Tagen dort an und sagen Sie, was Sie nehmen.');
    }
    if (mehr && !berichtigt) {
      frage(14, 'Seit Ihre Dosis erhöht wurde: Haben Sie Herzklopfen, Herzrasen, innere Unruhe, Zittern, schlechten Schlaf oder Schmerzen in der Brust bemerkt?');
      frage(28, 'Seit Ihre Dosis erhöht wurde: Haben Sie Herzklopfen, Herzrasen, innere Unruhe, Zittern, schlechten Schlaf oder Schmerzen in der Brust bemerkt?');
    }
    if (weniger && !berichtigt) frage(28, 'Seit Ihre Dosis verringert wurde: Sind Sie deutlich müder geworden oder frieren Sie mehr?');

    // WW1 – Marcumar
    if (stand.mittel.includes('marcumar') && n >= 0 && n <= 14) {
      add('WW1', 'zeitnah', `${was} Weil Sie Marcumar (Phenprocoumon) nehmen, lassen Sie den INR-Wert in den nächsten 1 bis 2 Wochen kontrollieren. Achten Sie auf ungewöhnliche blaue Flecken, Zahnfleisch- oder Nasenbluten.`);
    }
    // WW2 – Diabetes
    if (hatDiabetes(stand) && n >= 0 && n <= 42) {
      add('WW2', 'zeitnah', `${was} Messen Sie Ihren Blutzucker in den nächsten 6 Wochen öfter. Mehr Schilddrüsenhormon kann den Zucker erhöhen, weniger kann ihn senken.${weniger ? ' Achten Sie auf Unterzucker: Zittern, Schwitzen, Heißhunger, Verwirrtheit. Dann sofort etwas Zuckerhaltiges essen oder trinken und die Praxis informieren.' : ''}`);
    }
    // B2 / X3 (4) – nicht auf Anweisung der Praxis. Eine offene Quelle (null)
    // heißt nicht „nein" – sonst hieße es nach einer angeordneten Änderung
    // „wieder die bisherige Menge". Hat die Nutzerin aber auf der Karte „Ich
    // habe selbst etwas geändert" gesagt, ist die Quelle bekannt (B23).
    const meldung = letzte.praxis === null ? selbstGemeldet(stand, letzte) : null;
    if (art === 'dosis' && !berichtigt && (letzte.praxis === false || meldung)) {
      const ab = meldung && meldung.am > letzte.ab ? meldung.am : letzte.ab;
      const n2 = tageZwischen(ab, heute);
      if (n2 >= 0 && n2 <= 14) {
        const schritt = tdNeu !== null && tdAlt !== null ? Math.abs(tdNeu - tdAlt) : 0;
        if (schritt > 25 || (tdAlt && schritt / tdAlt > 0.25)) {
          add('X3', 'tage', `Das ist mehr als ein üblicher Schritt. Rufen Sie heute oder morgen die Praxis an und nehmen Sie bis dahin wieder Ihre bisherige Menge. ${WD2}`, { warnzeichen: WD2 });
        } else {
          add('B2', 'tage', 'Bitte sagen Sie Ihrer Praxis in den nächsten Tagen, dass Sie die Dosis geändert haben. Lassen Sie nach 6 bis 8 Wochen kontrollieren.');
        }
      }
    }
    // P7 – anderes Präparat bei gleicher Menge
    if (vorige && !berichtigt && tdNeu === tdAlt && (letzte.praeparat || '') !== (vorige.praeparat || '') && n >= 0 && n <= 14) {
      add('P7', 'termin', 'Sie haben ein anderes Präparat oder einen anderen Hersteller eingetragen. Auch das kann den Wert etwas verändern. Fragen Sie die Praxis, ob nach 6 bis 8 Wochen kontrolliert werden soll.');
    }
  }

  // E15 – Einnahmezeit verschoben
  const uhr = [...stand.uhrWechsel].reverse().find((u) => tageZwischen(u.am, heute) >= 0 && tageZwischen(u.am, heute) <= 14);
  if (uhr) {
    add('E15', 'termin', 'Sie haben die Uhrzeit Ihrer Tablette um mehr als drei Stunden verschoben. Manche Menschen nehmen die Tablette abends vor dem Schlafen, mindestens 3 Stunden nach der letzten Mahlzeit. Das ist möglich, aber nur nach Rücksprache mit der Praxis und dann jeden Tag gleich. Ein Wechsel der Uhrzeit kann den Wert verändern. Lassen Sie danach nach 6 bis 8 Wochen kontrollieren.');
  }
  return h.map((x) => ({ ...x, anrufe: anrufeAus([x.text], stand) }));
}

/**
 * Die Antwort „Ich habe selbst etwas geändert" (X3-14), die zu diesem
 * Dosis-Eintrag gehört: zum jüngsten Befund vor dem Eintrag. Ein späterer
 * Befund hätte eine eigene Rückfrage – dann gehört die Antwort nicht mehr hierher.
 */
function selbstGemeldet(stand, d) {
  const befund = [...stand.labor].reverse().find((l) => l.tsh && l.datum < d.ab);
  if (!befund) return null;
  return [...stand.nachfragen].reverse().find((x) => x.art === 'nach14' && x.antwort === 'selbst' && x.bezug === befund.id) || null;
}

// ---------------------------------------------------------------- Gesamtbild mit Dosis-Karte

/** Der Teil der Dosis-Karte im Gesamtbild – ohne Richtung: Die gibt es nur mit Pflichttext (D6). */
function dosisTeilText(k) {
  const am = kurz(k.befund.datum);
  if (k.frage) {
    return k.frage.ziel === 'warncheck'
      ? `Die Dosis-Karte zu Ihrem Befund vom ${am} bittet Sie zuerst um den Warnzeichen-Check.`
      : `Die Dosis-Karte hat zu Ihrem Befund vom ${am} eine Frage an Sie.`;
  }
  if (k.richtung !== 'klaeren') return `Zu Ihrem Befund vom ${am} gibt es eine Einschätzung zur Dosis. Bitte lesen Sie sie auf der Dosis-Karte ganz – und rufen Sie vor jeder Änderung die Praxis an.`;
  const top = rang(k.stufe) > rang('keine') ? k.gruende.find((g) => g.stufe === k.stufe) : null;
  return satz(`Die Dosis-Karte zu Ihrem Befund vom ${am} sagt im Moment nichts zur Dosis und nennt die Gründe.`, top ? top.text : '');
}

/**
 * Das Gesamtbild (einschaetzung.gesamtbild) mit der Dosis-Karte und den
 * Dosis-Hinweisen: eine Stufe für „Heute" und die Einschätzung (RW1 Grundsatz
 * 5, L3f). Ohne das zeigte „Heute" „Beim nächsten Termin", während die Karte
 * „Heute anrufen – Giftnotruf" sagte (B40, B61), oder die Einschätzung „Kein
 * besonderer Anlass" nach einer eigenmächtigen Verdopplung (B9).
 *
 * → { …gesamtbild, stufe, kopf, teile, dosis: Karte|null, dosisHinweise }.
 * Die Teile der Karte und der Hinweise haben quelle 'dosis'. Die Richtung
 * steht nie in einem Teil – nur auf der Karte mit ihrem Pflichttext.
 */
export function gesamtbildMitDosis(stand, heute) {
  const g = gesamtbild(stand, heute);
  if (!g.aktiv) return { ...g, dosis: null, dosisHinweise: [] };
  const karte = dosisRichtung(stand, heute);
  const hinweise = dosisHinweise(stand, heute);
  let teile = [...g.teile];
  // L7d und D6c meinen dieselbe Kontrolle; D6c trägt ab Tag 91 dieselbe Stufe (B37).
  if (hinweise.some((h) => h.id === 'D6c' && rang(h.stufe) >= rang('zeitnah'))) teile = teile.filter((t) => t.id !== 'L7d');
  // Eine 112-Karte kommt nur vom Check von heute oder von W5 im Befinden –
  // beide stehen schon mit eigener Kennung im Gesamtbild. Ein zusätzlicher
  // Teil 'dosis' mit 112 verdeckte in kopfFuer() das Gesprächsangebot bei W5.
  if (karte && karte.stufe !== 'notruf') {
    const text = dosisTeilText(karte);
    teile.push({ id: 'dosis', stufe: karte.stufe, text, quelle: 'dosis', anrufe: anrufeAus([text], stand) });
  }
  hinweise.forEach((h) => teile.push({ id: h.id, stufe: h.stufe, text: h.text, quelle: 'dosis', anrufe: h.anrufe, mitFrage: Boolean(h.frage) }));
  // W5 steht immer oben, ganz gleich, welche Stufe sonst gilt (wie im Gesamtbild).
  teile.sort((a, b) => (b.id === 'W5') - (a.id === 'W5') || rang(b.stufe) - rang(a.stufe));
  const stufe = hoechste(...teile.map((t) => t.stufe));
  return { ...g, stufe, kopf: kopfFuer(stufe, teile), teile, dosis: karte, dosisHinweise: hinweise };
}

/** Die zuletzt gezeigte Karte für den Arztbericht (B1 aus Regelwerk 2). */
export function dosisBerichtZeilen(stand, heute) {
  const k = dosisRichtung(stand, heute);
  if (!k) return [];
  const titel = k.frage ? `offene Frage – ${k.frage.text}` : k.titel;
  const z = [`Dosis-Karte der App vom ${kurz(heute)} zum Befund vom ${kurz(k.befund.datum)} (App): ${titel} Die App gibt nur eine Richtung, keine Dosis.`];
  // D6 / Grundsatz 8: Auch im Bericht steht die Richtung nie ohne Pflichttext –
  // die Nutzerin liest ihn in der App und beim Teilen mit (B41).
  if (!k.frage && k.richtung !== 'klaeren') z.push(`  Der Patientin dazu gezeigt: ${k.pflicht}`);
  k.gruende.forEach((g) => z.push(`  Grund ${g.id}: ${g.text}`));
  if (k.schritt && !k.frage) z.push(`  ${k.schritt}`);
  z.push(`  ${k.grundlage}`);
  return z;
}
