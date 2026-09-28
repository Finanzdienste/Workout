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
  STUFEN, kopfFuer, giftnotrufAnruf, gesamtbild, WARNFRAGEN,
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
/*
 * D6 unter einer Richtung, die selbst „Heute anrufen" sagt (S4ii, R3 an
 * mehreren Tagen, W2h – seit B25 bleibt „weniger" dort stehen): ohne „auch am
 * Wochenende … Ein paar Tage Warten schaden nicht". Der Satz stünde sonst
 * direkt unter „Rufen Sie heute noch … 116 117" und nennte eine längere
 * Frist als die Kopfzeile (RW1 L3f, C5). Das Komma vor „auch" fällt mit weg.
 */
export const D6_HEUTE = D6_LANG.replace(', auch am Wochenende oder wenn die Praxis Urlaub hat. Ein paar Tage Warten schaden nicht.', '.');
export const D6_KURZ = 'Das ist eine Einschätzung aus Ihrem Laborwert. Ändern Sie die Dosis nicht wegen Beschwerden allein. Hat Ihre Ärztin anders entschieden, gilt die Ärztin.';

export const WD2 = 'Sofort 112 anrufen bei: Schmerzen oder Engegefühl in der Brust · starkem Herzrasen mit Schwindel oder Ohnmacht · Atemnot.';
/*
 * Die Nachfrage nach einer Erhöhung (W-D4) nennt „Schmerzen in der Brust"
 * neben schlechtem Schlaf. Auf „Ja" hieß es nur „Warnzeichen-Check und heute
 * noch anrufen" – die Dosis-Karte sagt zum selben Anlass „sofort 112" (RW1
 * W1, RW2 W-D2; Runde 3: D4). Der Satz steht schon unter der Frage, damit er
 * vor dem Antworten zu lesen ist.
 */
const WD4_112 = 'Wenn Sie gerade Schmerzen oder Engegefühl in der Brust, starkes Herzrasen mit Schwindel oder Atemnot haben: sofort 112 anrufen.';

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

/*
 * Die Rohfassung jedes Grunds (Text als Funktion der Endstufe, eigene
 * Nummern) und die inneren Werte jeder Karte. Übernimmt eine Karte Gründe aus
 * einer zweiten Rechnung (frühe Ausstiege, Runde 3: D17), schreibt sie deren
 * Fristsätze mit ihrer eigenen Stufe neu – ein fertig geschriebener Satz
 * stünde sonst unter einer anderen Kopfzeile (RW1 L3f). WeakMap: Die
 * Schnittstelle der Karte bleibt, wie sie ist.
 */
const ROH = new WeakMap();
const INNEN = new WeakMap();
/** Die Gruppen des Warnzeichen-Checks mit Stufe 112 (RW1 W1, W4a, W5). */
const NOTRUF_GRUPPEN = ['w1', 'w4a', 'w5'];
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

/*
 * Jeder Dosis-Eintrag außer dem ersten ist eine Änderung (Dosis, Präparat,
 * Hersteller) – außer einem doppelten (alles gleich wie der vorige, B59) und
 * einer Berichtigung, die den vorigen Eintrag vom selben Tag ersetzt: Der
 * galt keinen Tag, die Menge war von Anfang an eine andere. Wer nach „Nein,
 * ich nehme etwas anderes" über den Verlauf einen zweiten Eintrag anlegte,
 * statt den vorhandenen zu ändern, las sonst bis zur nächsten Kontrolle „Ihre
 * Dosis … wurde weniger als 8 Wochen vor der Abnahme geändert" (Runde 3: D19).
 */
const aenderungen = (stand, heute) => stand.dosen.filter((d, i, a) => i > 0
  && aenderungsArt(d, a[i - 1]) !== 'doppelt'
  && !(a[i - 1].ab === d.ab && istBerichtigung(stand, d, heute)));

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
 * Ist ein Eintrag mit der Marke „berichtigung" wirklich die Berichtigung nach
 * „Nein, ich nehme etwas anderes"? Das Dosis-Formular setzt die Marke, sobald
 * irgendwo eine Antwort „nein" liegt – auch eine alte zu einem früheren
 * Befund. Dann würde die nächste echte, von der Praxis angeordnete Änderung
 * zur „Berichtigung": keine Kontrolle (D6c), keine Nachfrage nach der
 * Erhöhung (W-D4), „Sie haben berichtigt" bei INR und Blutzucker (C17).
 *
 * Nach „Ja" fragt die Karte zu einem Befund nie wieder, ob die Dosis stimmt.
 * Steht zum Befund, der beim Beginn des Eintrags galt, schon vor diesem
 * Beginn ein „Ja", kann das „Nein" nicht ihm gegolten haben – dann ist der
 * Eintrag eine Änderung. Nach einer echten Berichtigung kommt ein „Ja" erst
 * danach (die Karte fragt mit der neuen Menge neu). Gibt es einen späteren
 * Befund, kann das „Nein" ihm gegolten haben (Eintrag rückdatiert): Dann
 * bleibt es bei der Marke.
 */
function istBerichtigung(stand, d, heute) {
  if (!d || !d.berichtigung) return false;
  if (stand.labor.some((l) => l.tsh && l.datum > d.ab && l.datum <= heute)) return true;
  const b = [...stand.labor].reverse().find((l) => l.tsh && l.datum <= d.ab);
  if (!b) return true;
  // „Die Dosis wird geändert" (F8) sperrt die Karte (D0.5) – zu diesem Befund
  // wurde danach nie gefragt, ob die Dosis stimmt. Ein Eintrag ab dieser
  // Entscheidung ist die Änderung der Praxis, auch ohne „Ja" vorher.
  if (b.praxis === 'geaendert' && praxisHatErklaert(b) && b.praxisAm <= d.ab) return false;
  return !stand.nachfragen.some((n) => n.art === 'dosis_stimmt' && n.bezug === b.id && n.antwort === 'ja' && n.am < d.ab);
}

/** X3 (4): mehr als ein üblicher Schritt – über 25 µg oder über ein Viertel der bisherigen Menge am Tag. */
function grosserSchritt(tdNeu, tdAlt) {
  if (tdNeu === null || tdAlt === null) return false;
  const schritt = Math.abs(tdNeu - tdAlt);
  return schritt > 25 || (tdAlt > 0 && schritt / tdAlt > 0.25);
}

/*
 * Hat die Praxis nach einer eigenen Änderung zum jüngsten Befund entschieden
 * (F8 oder „Die Praxis hat entschieden")? Dann gilt ihre Entscheidung (RW2
 * Grundsatz 6, D6b): „Sagen Sie es der Praxis in den nächsten Tagen" ist
 * erledigt. Vorher stand das direkt unter „Gut. Es gilt, was die Praxis
 * gesagt hat" – auf der Karte bis zum nächsten Befund, ohne Ausweg (C4).
 * `seit`: ab wann die eigene Änderung bekannt ist (Eintrag oder Meldung).
 */
function praxisNachEigener(stand, heute, seit) {
  const b = dosisBefund(stand, heute);
  return Boolean(b && seit && praxisHatErklaert(b) && b.praxisAm && b.praxisAm >= seit);
}

/**
 * Die jüngste Änderung bis heute – für „Heute" (dosisHinweise) und die Karte,
 * damit beide dieselbe Änderung meinen. Ein doppelter Eintrag (alles gleich
 * wie der vorige) ist keine Änderung: Er löst weder „Ihre Schilddrüsendosis
 * wurde geändert" noch eine Kontrolle aus (B59).
 * → { letzte, vorige, art, berichtigt, tdNeu, tdAlt, mehr, weniger } | null
 */
function letzteAenderung(stand, heute) {
  const bisHeute = stand.dosen.filter((d) => d.ab <= heute);
  const dosen = bisHeute.filter((d, i) => i === 0 || aenderungsArt(d, bisHeute[i - 1]) !== 'doppelt');
  if (dosen.length < 2) return null;
  const letzte = dosen[dosen.length - 1];
  const vorige = dosen[dosen.length - 2];
  const tdNeu = sp.tagesdosis(letzte);
  const tdAlt = sp.tagesdosis(vorige);
  return {
    letzte,
    vorige,
    art: aenderungsArt(letzte, vorige),
    berichtigt: istBerichtigung(stand, letzte, heute),
    tdNeu,
    tdAlt,
    mehr: tdNeu !== null && tdAlt !== null && tdNeu > tdAlt,
    weniger: tdNeu !== null && tdAlt !== null && tdNeu < tdAlt,
  };
}

/*
 * Führt eine eigene Änderung zur Menge vor der vorigen eigenen Änderung
 * zurück (75 → 125 → 75 µg, beide „Auf Anweisung der Praxis: Nein"), ist das
 * kein neuer großer Schritt. Wer dem Rat „nehmen Sie bis dahin wieder Ihre
 * bisherige Menge" gefolgt war, las sonst denselben Rat noch einmal – jetzt
 * für die 125 µg (Runde 3: D11). Hat die Praxis zwischen den beiden
 * Änderungen entschieden, galt die mittlere Menge als ihre: Dann bleibt das
 * Zurück ein eigener Schritt.
 */
function zurueckGenommen(stand, d, heute) {
  const td = sp.tagesdosis(d);
  if (td === null) return false;
  // Die Mengen in ihrer Folge, jede mit dem Eintrag, mit dem sie begann.
  const mengen = [];
  stand.dosen.slice(0, stand.dosen.indexOf(d) + 1).forEach((x) => {
    const t = sp.tagesdosis(x);
    if (!mengen.length || mengen[mengen.length - 1].td !== t) mengen.push({ td: t, d: x });
  });
  if (mengen.length < 3 || mengen[mengen.length - 1].d !== d) return false;
  const vorige = mengen[mengen.length - 2].d;
  const vorigeEigen = vorige.praxis === false || (vorige.praxis === null && Boolean(selbstGemeldet(stand, vorige)));
  const b = dosisBefund(stand, heute);
  const praxisDazwischen = Boolean(b && praxisHatErklaert(b) && b.praxisAm && b.praxisAm >= vorige.ab && b.praxisAm < d.ab);
  return vorigeEigen && !praxisDazwischen && mengen[mengen.length - 3].td === td;
}

/**
 * Die eigene Änderung, zu der die Praxis noch nichts gesagt hat (rot-2 X3 (4),
 * RW2 B2): der jüngste Eintrag mit anderer Menge, „Auf Anweisung der Praxis:
 * Nein" oder mit der Meldung „selbst geändert" (B23), keine Berichtigung.
 *
 * Sie gilt ohne Ablaufdatum – bis die Praxis danach entschieden hat (C4) oder
 * ein Befund nach der Einpendelzeit zeigt, wie die neue Menge wirkt. Vorher
 * hing sie am Hinweis auf „Heute" und endete nach 14 Tagen: Ab Tag 15 sagte
 * die Karte „Eine neue Einschätzung gibt es mit dem Kontrollwert", also bei
 * der selbst gewählten Menge bleiben, und „In den nächsten Tagen" fiel weg,
 * obwohl nichts geklärt war (Runde 3: D11). Wer dieselbe Änderung über die
 * 14-Tage-Frage meldete, behielt den Schutz – je nach Eingabeweg eine andere
 * Karte (C7).
 * → { d, ab, gross, zurueck } | null – `ab`: seit wann die Änderung bekannt ist.
 */
function eigeneAenderung(stand, heute) {
  const a = letzteAenderung(stand, heute);
  if (!a || a.art !== 'dosis' || a.berichtigt) return null;
  const d = a.letzte;
  const meldung = d.praxis === null ? selbstGemeldet(stand, d) : null;
  if (d.praxis !== false && !meldung) return null;
  const ab = meldung && meldung.am > d.ab ? meldung.am : d.ab;
  if (ab > heute || praxisNachEigener(stand, heute, ab)) return null;
  const frist = einpendeln(stand, d.ab);
  if (stand.labor.some((l) => l.tsh && l.datum <= heute && tageZwischen(d.ab, l.datum) >= frist)) return null;
  const zurueck = zurueckGenommen(stand, d, heute);
  return { d, ab, gross: !zurueck && grosserSchritt(a.tdNeu, a.tdAlt), zurueck };
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
  // W-D2 sofort sichtbar bei mehr als einem üblichen eigenen Schritt (rot-2
  // X3 (4)). Schon hier, weil auch frühe Ausstiege ihn übernehmen (D17).
  let warnWD2 = false;

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
    /*
     * Auf einer 112-Karte (W5, Check mit 112-Zeichen) stehen die übrigen
     * Gründe (D17) mit der Frist, die sie ohne den Notfall untereinander
     * hätten – nicht „heute noch" aus der Stufe 112: Das Gesamtbild nennt sie
     * mit dieser Stufe, und der Satz soll dort derselbe sein.
     */
    const rest = stufe === 'notruf'
      ? hoechste('keine', ...gruende.filter((g) => !/^W\d/.test(g.id) && g.stufe && g.stufe !== 'notruf').map((g) => g.stufe)) : null;
    // Texte mit Frist: jetzt fertig schreiben, mit der Stufe, die oben steht.
    const fertig = (t, g = null) => {
      if (typeof t !== 'function') return t;
      return rest && rang(rest) > rang('keine') && g && !/^W\d/.test(g.id) ? t(rest, rest) : t(stufe, eigen);
    };
    gruende.forEach((g) => {
      if (!ROH.has(g)) ROH.set(g, { text: g.text, anrufe: g.anrufe || [] });
      g.text = fertig(g.text, g);
      g.anrufe = eindeutig([...(g.anrufe || []), ...anrufeAus([g.text], stand)]);
    });
    const wieBisher = !ohneWieBisher && !gruende.some((g) => ['Q5', 'X3', 'B2'].includes(g.id) || g.stufe === 'notruf');
    const texte = (x.texte || (richtung === 'klaeren' && !x.frage ? [wieBisher ? KLAEREN_SATZ : KLAEREN_KURZ] : [])).map((t) => fertig(t)).filter(Boolean);
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
    const k = {
      richtung,
      titel: x.titel || KOPF_KLAEREN,
      texte,
      schritt: x.schritt || null,
      pflicht: richtung === 'mehr' || richtung === 'weniger' ? (rang(stufe) >= rang('heute') ? D6_HEUTE : D6_LANG) : D6_KURZ,
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
    INNEN.set(k, { eigen, rest, ohneWieBisher, warnWD2 });
    return k;
  };

  /*
   * Frühe Ausstiege (W5, ein Check mit 112-Zeichen, die Frage nach dem Check,
   * Schwangerschaft) kehrten zurück, bevor die Karte Befund und Antworten
   * ausgewertet hatte. Was nur die Karte kennt, fiel samt Stufe weg: „selbst
   * geändert" (X3), „einmal viele Tabletten" mit dem Giftnotruf (Q5), D0.13,
   * D0.18 … Ein neuer Eintrag „Herzklopfen" oder „lebensmüde" senkte so die
   * Dringlichkeit und tilgte den Rat von allen Bildschirmen (Runde 3: D17;
   * RW2 Grundsatz 5, RW1 L3f). Jetzt übernehmen sie die Gründe einer zweiten
   * Rechnung ohne das Warnsignal: alle mit Stufe, dazu die eigene Änderung
   * (X3, B2) auch ohne Frist – ihr „wieder die bisherige Menge" schützt.
   * Nicht die aus dem Check und dem Befinden (W1 … W5, die stehen selbst da)
   * und nichts neben W1: RW1 W1 blendet bei Brustschmerz alles andere aus.
   */
  const uebernehmen = (andere) => {
    if (!andere || gruende.some((g) => g.id === 'W1')) return null;
    andere.gruende
      .filter((g) => (g.stufe || ['X3', 'B2'].includes(g.id)) && !/^W\d/.test(g.id) && !gruende.some((x) => x.id === g.id))
      .forEach((g) => {
        const roh = ROH.get(g) || { text: g.text, anrufe: g.anrufe };
        grund(g.id, roh.text, g.stufe, roh.anrufe);
      });
    const innen = INNEN.get(andere);
    if (innen && innen.ohneWieBisher) ohneWieBisher = true;
    if (innen && innen.warnWD2 && gruende.some((g) => g.id === 'X3')) warnWD2 = true;
    return andere;
  };
  // Dieselbe Rechnung mit dem Check von heute ohne seine 112-Zeichen (W1, W4a,
  // W5) – ohne Check mit „Nichts davon": die Gründe, die nicht aus dem Notfall
  // kommen. Was der übrige Check auslöst (X4 nach Herzklopfen, X1), bleibt so
  // erhalten; ein leerer Check hätte es mit verworfen.
  const ohneNotfall = (s) => {
    const c = [...s.warnzeichen].reverse().find((w) => w.datum === heute);
    const ja = c ? c.ja.filter((k) => !NOTRUF_GRUPPEN.includes((WARNFRAGEN.find((f) => f.key === k) || {}).gruppe)) : [];
    return dosisRichtung({ ...s, warnzeichen: [...s.warnzeichen.filter((w) => w.datum !== heute), { id: '_ohne-notfall', datum: heute, uhr: c ? c.uhr : '', ja }] }, heute);
  };

  // ---- 1. Warnzeichen (W-D1, W-D3, X1, X2)
  // Nur ein Check von heute zählt – Beschwerden können sich über Nacht ändern (Entscheidung 17).
  const check = [...stand.warnzeichen].reverse().find((w) => w.datum === heute) || null;
  if (g14.has('lebensmuede')) {
    // W5 hat die Stufe 112 (Entscheidung zu W5) – die Kopfzeile kommt aus
    // kopfFuer() und bietet zuerst das Gespräch an, wie in der Einschätzung.
    grund('W5', W5_TEXT, 'notruf');
    // Ein Check von heute mit 112- oder Giftnotruf-Zeichen gehört mit auf die
    // Karte – sonst stünde dort nur das Gesprächsangebot, im Gesamtbild aber „Sofort 112".
    if (check) {
      warnzeichenAuswerten(check.ja, stand).abschnitte.filter((a) => a.id !== 'W5' && rang(a.stufe) >= rang('tage'))
        .forEach((a) => grund(a.id, a.text, a.stufe, a.anrufe || []));
    }
    // W5 hat Vorrang (rot-2 X2) – die übrigen dringlichen Gründe bleiben
    // darunter stehen, 14 Tage lang sonst nirgends (D17).
    uebernehmen(ohneNotfall({ ...stand, befinden: stand.befinden.map((x) => ({ ...x, beschwerden: x.beschwerden.filter((k) => k !== 'lebensmuede') })) }));
    const nurW5 = gruende.filter((g) => g.stufe === 'notruf').every((g) => g.id === 'W5');
    // W-D2 zur übernommenen großen eigenen Änderung (X3) auch hier – wie unter der Frage nach dem Check.
    return karte({ titel: nurW5 ? 'Bevor es um die Dosis geht: Bitte bleiben Sie damit nicht allein.' : 'Bitte zuerst den Notruf', texte: [], regeln: ['X2'], warnzeichen: warnWD2 ? WD2 : null });
  }
  const unruhe = ['herz', 'schwitzen', 'puls', 'zittern'].filter((k) => g14.has(k));
  const muedeB = gruppe === 'b' && ['muede', 'frieren', 'konzentration'].some((k) => g14.has(k));
  const wd3 = gruppe === 'b' && ((tsh !== null && tsh > 20) || muedeB);
  if ((unruhe.length || wd3) && !check) {
    const id = unruhe.length ? 'W-D1' : 'W-D3';
    regeln.push(id);
    const text = unruhe.length
      ? 'Bevor es um die Dosis geht: Sie haben in letzter Zeit Herzklopfen, Unruhe oder einen unregelmäßigen Puls eingetragen. Bitte gehen Sie kurz den Warnzeichen-Check durch.'
      : 'Ihr TSH ist deutlich erhöht. Bitte prüfen Sie zuerst: Sind Sie extrem schläfrig oder verwirrt, ist Ihnen sehr kalt, atmen Sie langsam? Dann sofort 112 anrufen. Gehen Sie dazu kurz den Warnzeichen-Check durch.';
    /*
     * Auch vor dem Check nie unter der Karte, die nach „Nichts davon" käme,
     * und mit ihren dringlichen Gründen (D17): Vorher las die Frage nur die
     * Hinweise von „Heute" (X3, B2, W-D4) – „selbst geändert" oder Q5
     * „einmal viele Tabletten" mit dem Giftnotruf verschwanden, bis der
     * Check gemacht war, und die Stufe fiel mit. Deren Stufe ohne die aus dem
     * Befinden: Die nennt karte() selbst, mit ihrem Satz, warum.
     */
    const ohneFrage = uebernehmen(ohneNotfall(stand));
    const stufeDanach = ohneFrage && INNEN.get(ohneFrage) ? INNEN.get(ohneFrage).eigen : 'keine';
    return karte({
      titel: 'Zuerst der Warnzeichen-Check', frage: { id, text, optionen: null, ziel: 'warncheck', feld: null },
      stufeFest: hoechste(e.stufeLabor, stufeDanach), warnzeichen: warnWD2 ? WD2 : null,
    });
  }
  /*
   * Der Check von heute gilt immer – nicht nur, wenn Herzklopfen oder
   * Müdigkeit im Befinden ihn verlangt haben. Hat die Nutzerin ihn von sich
   * aus gemacht („große Menge auf einmal", Brustschmerz, lebensmüde), stand
   * hier sonst eine Richtung mit „Beim nächsten Termin … Ein paar Tage Warten
   * schaden nicht", während „Heute" „Sofort 112" sagte und auf diese Karte
   * verwies (C1, C6; RW1 L3f).
   */
  if (check) {
    if (unruhe.length || wd3) regeln.push(unruhe.length ? 'W-D1' : 'W-D3');
    const w = warnzeichenAuswerten(check.ja, stand);
    if (w.stufe === 'notruf') {
      // Alle dringlichen Abschnitte mit ihrer eigenen Kennung und ihren
      // Nummern: der Giftnotruf fürs Bundesland (W4a), die Telefonseelsorge
      // (W5). Unter der Kennung 'W-D1' erkannte kopfFuer() W5 nicht, und
      // neben W4a fiel W5 ganz weg.
      const dringend = w.abschnitte.filter((a) => rang(a.stufe) >= rang('tage'));
      dringend.forEach((a) => grund(a.id, a.text, a.stufe, a.anrufe || []));
      // Außer bei W1 bleiben die übrigen dringlichen Gründe darunter (D17):
      // Nach „große Menge auf einmal" fehlte sonst etwa „selbst geändert".
      uebernehmen(ohneNotfall(stand));
      const nurW5 = dringend.filter((a) => a.stufe === 'notruf').every((a) => a.id === 'W5');
      // X2: „lebensmüde" im Check hat Vorrang wie im Befinden – eigene Karte, keine Richtung.
      const x2 = dringend.some((a) => a.id === 'W5') ? ['X2'] : [];
      return karte({ titel: nurW5 ? 'Bevor es um die Dosis geht: Bitte bleiben Sie damit nicht allein.' : 'Bitte zuerst den Notruf', texte: [], stufeFest: 'notruf', regeln: x2, warnzeichen: warnWD2 ? WD2 : null });
    }
    // W-D1: Stufe des Checks – die Karte mindestens so hoch (Tage bei W2t, heute bei W2h).
    // Der Satz „Nach Ihrem Warnzeichen-Check von heute" nur ab Tage: Unter
    // „Nichts davon" (W3) oder W4b hieße er „… Sprechen Sie es beim nächsten
    // Termin an" – und hebt die Karte ohne Beschwerden nicht auf „Termin".
    if (rang(w.stufe) >= rang('tage')) setzeWarn(w.stufe, 'Nach Ihrem Warnzeichen-Check von heute:');
    else if (unruhe.length || wd3) setzeWarn(w.stufe, unruhe.length ? 'Sie haben in letzter Zeit Herzklopfen, Unruhe, Zittern oder einen unregelmäßigen Puls eingetragen.' : null);
    /*
     * „Über mehrere Tage versehentlich zu viele Tabletten" ist dieselbe Angabe
     * wie Q5 „über Tage zu viel" (RW2 D5, X15): keine Richtung und nie „genau
     * wie bisher weiter" – das läse sich als „mit der zu hohen Menge
     * weitermachen" (C3, B28). Eigene Kennung W2h statt Q5: Der Arztbericht
     * soll keine Befundantwort nennen, die es nicht gibt.
     */
    if (check.ja.includes('zuviele')) {
      grund('W2h', (s) => `Sie haben im Warnzeichen-Check angegeben, über mehrere Tage versehentlich zu viele Schilddrüsen-Tabletten genommen zu haben. Nehmen Sie ab jetzt wieder genau Ihre verordnete Stärke, so wie die Praxis sie festgelegt hat, und rufen Sie ${wann(hoechste(s, 'heute'))} die Praxis an, außerhalb der Sprechzeiten 116 117. Lassen Sie danach neu messen.`, 'heute');
      ohneWieBisher = true;
    }
    // X4 gilt für Herz und Unruhe – nicht, wenn W-D3 den Check wegen
    // Müdigkeit oder Frieren verlangt hat (B38). Herzklopfen an mehreren Tagen
    // (R3 „heute") ist dasselbe Anliegen wie ein Check mit Stufe Tage. Die
    // Stufe aus dem Befinden zählt nur mit Befinden-Eintrag, der den Check
    // verlangt hat – wie vorher, als der Check nur dann gelesen wurde.
    const herzUnruhe = unruhe.length > 0 || check.ja.some((k) => ['herzklopfen', 'puls', 'unruhe'].includes(k));
    if ((gruppe === 'b' || gruppe === 'c')
      && ((herzUnruhe && rang(w.stufe) >= rang('tage')) || ((unruhe.length || wd3) && rang(stufeHerz) >= rang('tage')))) {
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
    // D7 geht jeder Regel vor – keine Richtung, keine Frage. Dringliche Gründe
    // (Q5 „einmal viele Tabletten", eine eigene Änderung …) bleiben aber stehen (D17).
    uebernehmen(dosisRichtung({ ...stand, profil: { ...p, schwanger: 'nein' } }, heute));
    return karte({ warnzeichen: warnWD2 ? WD2 : null });
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
  const selbst = Boolean(nach14 && nach14.antwort === 'selbst');

  /*
   * Was „Heute" zur jüngsten Dosisänderung sagt (dosisHinweise), gilt auch
   * hier – dieselbe Lage, dieselbe Stufe (RW1 L3f). X3 (4) und B2: eine
   * eingetragene eigene Änderung („Auf Anweisung der Praxis: Nein"). Vorher
   * sagte die Karte „Beim nächsten Termin … neue Einschätzung mit dem
   * Kontrollwert", „Heute" aber „heute oder morgen anrufen und bis dahin
   * wieder die bisherige Menge" (C7). „Heute" nennt sie 14 Tage lang, die
   * Karte, bis sie geklärt ist (eigeneAenderung, D11) – danach verweist
   * „Heute" auf diesen wichtigen Grund der Karte. Die Meldung über die
   * 14-Tage-Frage („selbst geändert") hat unten ihren eigenen Grund X3.
   */
  const aenderung = letzteAenderung(stand, heute);
  const hinweise = dosisHinweise(stand, heute);
  const eigen = !selbst ? eigeneAenderung(stand, heute) : null;
  if (eigen && eigen.gross) warnWD2 = true;

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
    d, art: aenderungsArt(d, stand.dosen[i - 1]), korrektur: Boolean(istBerichtigung(stand, d, heute) || (stimmtNein && d.ab >= stimmtNein.am)),
  }));
  const dosisNach = nachher.length > 0;
  const echt = nachher.some((x) => x.art === 'dosis' && x.d.praxis === true && !x.korrektur);
  const praxisSagt = praxisHatErklaert(befund);
  // „Selbst geändert" gemeldet, und die Praxis hat danach entschieden (C4) –
  // nach der Meldung und nach dem jüngsten eigenen Eintrag, wie auf „Heute".
  const eigenAb = nachher.filter((y) => y.art === 'dosis' && y.d.praxis !== true && !y.korrektur).map((y) => y.d.ab).pop() || null;
  const praxisDanach = selbst && praxisNachEigener(stand, heute, [nach14.am, eigenAb].filter(Boolean).sort().pop());
  // Nach einer eigenen Änderung, zu der die Praxis noch nichts gesagt hat,
  // klärt erst der Anruf, was gilt – nicht „8 Wochen bei der neuen Menge
  // bleiben bis zum Kontrollwert" neben „wieder die bisherige Menge" (C7).
  const anrufKlaert = Boolean(eigen) || (selbst && !praxisDanach);
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
      const erklaeren = quelleOffen && !praxisSagt && !selbst;
      grund('D0.5', satz('Ihre Dosis wurde nach dieser Blutabnahme schon geändert. Der Wert zeigt deshalb nicht mehr, wie es heute ist.',
        anrufKlaert ? 'Was jetzt gilt, klärt der Anruf in der Praxis.' : `Eine neue Einschätzung gibt es mit dem Kontrollwert ${wochenText(frist)} nach der Änderung.`,
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
  const kurzVorher = aenderungen(stand, heute).find((d) => d.ab <= tag && tageZwischen(d.ab, tag) < frist);
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
  /*
   * Bei der Hirnanhangdrüse sagt TSH nichts über die Hormonmenge (RW2 P1,
   * D0.14) – die Einschätzung rechnet dort mit fT4 (B12). Mit dem TSH-Muster
   * verglichen, „passten" Müdigkeit und Frieren bei erwartet niedrigem TSH
   * „nicht zum Laborwert", gerade wenn fT4 unten lag und sie genau dazu
   * passten (Runde 3: D7). Dann zählt die Richtung der Einschätzung aus fT4.
   */
  const hypo = p.ursache === 'hypophyse';
  const labWenig = hypo ? e.richtung === 'wenig' : ['b', 'c'].includes(gruppe);
  const labViel = hypo ? e.richtung === 'viel' : ['d', 'e'].includes(gruppe);
  if ((b.richtung === 'viel' && labWenig) || (b.richtung === 'wenig' && labViel)) {
    grund('D0.18', (s) => `Ihre Beschwerden der letzten vier Wochen passen nicht zu diesem Laborwert. Das sollte die Praxis ansehen, bevor etwas an der Dosis geändert wird. Rufen Sie ${wann(hoechste(s, 'zeitnah'))} an.`, 'zeitnah');
  }
  if (p.zielNiedrig === 'ja' && gruppe === 'a') {
    grund('D0.14', 'Ihre Ärztin möchte den TSH-Wert bewusst niedrig halten. Dann legt sie die Dosis fest – die App gibt keine Richtung.');
  }

  // X3 (2): Nach 14 Tagen fragt die Karte, ob inzwischen etwas passiert ist.
  if (selbst) {
    /*
     * Hat die Praxis danach entschieden (praxisDanach), gilt ihre Entscheidung
     * (RW2 Grundsatz 6, D6b). Vorher stand direkt unter „Gut. Es gilt, was die
     * Praxis gesagt hat" bis zum nächsten Befund – wochenlang und ohne Ausweg
     * – „In den nächsten Tagen anrufen" (C4). Der Grund bleibt, nur ohne
     * Frist: Ob die Praxis von der eigenen Änderung wusste, weiß die App
     * nicht, und „Die Dosis bleibt so" ist nach einer Verdopplung mehrdeutig –
     * der Schutz „wieder die bisherige Menge" bleibt.
     */
    // Nach einer eigenen Änderung nie „genau wie bisher weiter" (B22, B28):
    // Das hieße, bei der selbst gewählten Menge zu bleiben.
    const neu = nachher.filter((y) => y.art === 'dosis').pop();
    if (neu) {
      const i = stand.dosen.indexOf(neu.d);
      // Zurück auf die Menge vor der vorigen eigenen Änderung ist kein neuer großer Schritt (D11).
      if (grosserSchritt(sp.tagesdosis(neu.d), sp.tagesdosis(stand.dosen[i - 1])) && !zurueckGenommen(stand, neu.d, heute)) {
        if (praxisDanach) {
          grund('X3', 'Sie haben angegeben, selbst mehr als einen üblichen Schritt an der Dosis geändert zu haben. Wusste die Praxis das bei ihrer Entscheidung nicht, nehmen Sie wieder Ihre bisherige Menge und sagen Sie es ihr.');
        } else {
          // X3 (4): mehr als ein üblicher Schritt – bis zum Anruf die bisherige Menge.
          grund('X3', (s) => `Sie haben angegeben, selbst etwas an der Dosis geändert zu haben. Das ist mehr als ein üblicher Schritt. Rufen Sie ${rang(s) >= rang('heute') ? 'heute noch' : 'heute oder morgen'} die Praxis an und nehmen Sie bis dahin wieder Ihre bisherige Menge.`, 'tage');
        }
        // W-D2 sofort sichtbar (X3 (4)) – auch nach der Entscheidung der
        // Praxis: Ob sie von dem großen Schritt wusste, weiß die App nicht.
        warnWD2 = true;
      } else if (praxisDanach) {
        grund('X3', 'Sie haben angegeben, selbst etwas an der Dosis geändert zu haben. Wusste die Praxis das bei ihrer Entscheidung nicht, sagen Sie ihr, was Sie jetzt nehmen.');
      } else {
        grund('X3', (s) => `Sie haben angegeben, selbst etwas an der Dosis geändert zu haben. Sagen Sie der Praxis ${wann(hoechste(s, 'tage'))}, was Sie jetzt nehmen, und fragen Sie, ob Sie dabei bleiben sollen. Eine neue Einschätzung gibt es mit dem nächsten Kontrollwert.`, 'tage');
      }
    } else {
      if (praxisDanach) {
        grund('X3', 'Sie haben angegeben, selbst etwas an der Dosis geändert zu haben. Bitte tragen Sie ein, was Sie jetzt nehmen. Wusste die Praxis das bei ihrer Entscheidung nicht, sagen Sie es ihr.');
      } else {
        grund('X3', (s) => `Sie haben angegeben, selbst etwas an der Dosis geändert zu haben. Bitte tragen Sie ein, was Sie jetzt nehmen, und sagen Sie es der Praxis ${wann(hoechste(s, 'tage'))}. Eine neue Einschätzung gibt es mit dem nächsten Kontrollwert.`, 'tage');
      }
      aktionSetzen(null, 'Dosis eintragen');
    }
  } else if (eigen) {
    // X3 (4) / B2 wie auf „Heute" (siehe oben bei `eigen`) – mit Frist und
    // Stufe erst, wenn die Stufe der Karte feststeht. „Angegeben": Die Quelle
    // kann der Eintrag sein oder die Antwort „selbst geändert" zu einem
    // früheren Befund (B23).
    // „6 bis 8 Wochen nach der Änderung": Der Grund steht jetzt auch Wochen
    // später noch da (D11) – „nach 6 bis 8 Wochen" zählte dann ab heute.
    const seit = kurz(eigen.d.ab);
    if (eigen.zurueck) {
      grund('B2', (s) => `Sie haben angegeben, dass Sie die Dosis ab ${seit} ohne Anweisung der Praxis geändert haben – zurück auf Ihre frühere Menge. Sagen Sie der Praxis ${wann(hoechste(s, 'tage'))} Bescheid, dass Sie zwischendurch eine andere Menge genommen hatten.`, 'tage');
    } else if (eigen.gross) {
      grund('X3', (s) => `Sie haben angegeben, dass Sie die Dosis ab ${seit} ohne Anweisung der Praxis geändert haben. Das ist mehr als ein üblicher Schritt. Rufen Sie ${rang(s) >= rang('heute') ? 'heute noch' : 'heute oder morgen'} die Praxis an und nehmen Sie bis dahin wieder Ihre bisherige Menge.`, 'tage');
    } else {
      grund('B2', (s) => `Sie haben angegeben, dass Sie die Dosis ab ${seit} ohne Anweisung der Praxis geändert haben. Bitte sagen Sie es der Praxis ${wann(hoechste(s, 'tage'))}. Lassen Sie 6 bis 8 Wochen nach der Änderung kontrollieren.`, 'tage');
    }
  } else {
    /*
     * Dieselbe eingetragene eigene Änderung, nachdem die Praxis zu diesem
     * Befund entschieden hat: „Heute" nennt sie dann nicht mehr (siehe
     * dosisHinweise). Wie bei „selbst geändert" bleibt der Grund ohne Frist
     * stehen – sonst hinge der Schutz „wieder die bisherige Menge" davon ab,
     * auf welchem Weg die Änderung in die App kam (C4, C7).
     */
    // Auch eine eigene Änderung VOR der Blutabnahme gehört dazu – sonst fiel
    // der Schutz weg, sobald die Praxis zu diesem Befund entschied (Nachprüfung zu C4).
    const nachAbnahme = nachher.filter((y) => y.art === 'dosis' && y.d.praxis === false && !y.korrektur).pop();
    const davor = aenderung && aenderung.art === 'dosis' && !aenderung.berichtigt
      && (aenderung.letzte.praxis === false || selbstGemeldet(stand, aenderung.letzte)) ? aenderung.letzte : null;
    const eigeneD = nachAbnahme ? nachAbnahme.d : davor;
    if (eigeneD && praxisNachEigener(stand, heute, eigeneD.ab)) {
      const i = stand.dosen.indexOf(eigeneD);
      const gross = grosserSchritt(sp.tagesdosis(eigeneD), sp.tagesdosis(stand.dosen[i - 1])) && !zurueckGenommen(stand, eigeneD, heute);
      if (gross) warnWD2 = true;
      grund(gross ? 'X3' : 'B2', satz(`Sie haben angegeben, dass Sie die Dosis ab ${kurz(eigeneD.ab)} ohne Anweisung der Praxis geändert haben.`,
        gross ? 'Das ist mehr als ein üblicher Schritt. Wusste die Praxis das bei ihrer Entscheidung nicht, nehmen Sie wieder Ihre bisherige Menge und sagen Sie es ihr.'
          : 'Wusste die Praxis das bei ihrer Entscheidung nicht, sagen Sie es ihr.'));
    }
  }
  /*
   * W-D4 beantwortet: Beschwerden seit genau dieser Änderung sind ein eigener
   * Anlass. „Heute" sagt nach einer Erhöhung „Heute anrufen" – die Karte
   * zeigte darunter in Grün „Kein besonderer Anlass", weil D0.5 ihre Stufe
   * festlegt (C8). Gründe zählen auch bei fester Stufe.
   * Nach einer Senkung heißt der Satz von „Heute" „Sprechen Sie das bei der
   * Kontrolle an" (RW2 W-D4, Stufe Termin). Liegt die Karte höher – etwa
   * „In den nächsten Tagen anrufen" nach einem Kontrollbefund mit hohem TSH
   * –, nannte er darunter eine längere Frist als die Kopfzeile (RW1 L3f;
   * Runde 3: D20 – C8 hatte nur den Satz nach einer Erhöhung angepasst).
   */
  hinweise.filter((h) => h.id === 'W-D4' && !h.frage).forEach((h) => {
    grund('W-D4', aenderung && aenderung.mehr
      ? satz('Sie haben angegeben, dass Sie seit der Erhöhung Ihrer Dosis Beschwerden wie Herzklopfen oder Unruhe bemerkt haben.', h.text)
      : (s) => satz('Sie haben angegeben, dass Sie seit der Senkung Ihrer Dosis müder geworden sind oder mehr frieren.', rang(s) > rang('termin')
        ? 'Sagen Sie das bei Ihrem Anruf in der Praxis mit. Ändern Sie nichts selbst.' : h.text), h.stufe);
  });
  /*
   * X3 (1) „Nein, ich nehme etwas anderes": Die Karte wartet auf die
   * Berichtigung – ein Eintrag ab dem Tag der Antwort mit einer anderen Menge
   * oder eine andere Menge als die, auf die sich das Nein bezog. Danach fragt
   * sie neu (B26, B63). Ohne die Menge galt am Einrichtungstag die eine,
   * „ab heute" eingetragene Dosis selbst als Berichtigung: Die Karte fragte
   * sofort wieder nach derselben Menge – weiter ging es nur mit einem
   * unwahren „Ja" (Runde 3: D19). Beginnt der geltende Eintrag erst mit der
   * Antwort, öffnet der Knopf ihn zum Ändern: Ein zweiter Eintrag daneben
   * sähe aus wie eine Änderung (eigener Schritt, W-D4 nach „Erhöhung").
   */
  let stimmtGilt = stimmt;
  if (stimmtNein) {
    const bezogen = neinDosis(stimmtNein.antwort);
    const berichtigt = stand.dosen.some((d) => d.ab >= stimmtNein.am && (bezogen === null || sp.tagesdosis(d) !== bezogen))
      || (bezogen !== null && td !== null && td !== bezogen);
    if (berichtigt) {
      stimmtGilt = null;
    } else if (dAkt && dAkt.ab >= stimmtNein.am) {
      grund('X3', `Sie nehmen im Moment etwas anderes als in der App eingetragen. Bitte ändern Sie den Eintrag ab ${kurz(dAkt.ab)} auf das, was Sie wirklich nehmen – mit dem Tag, seit dem Sie es nehmen. Vorher gibt die App keine Richtung.`);
      aktionSetzen(dAkt.id, 'Dosis ändern');
    } else {
      grund('X3', 'Sie nehmen im Moment etwas anderes als in der App eingetragen. Bitte tragen Sie ein, was Sie jetzt nehmen – mit dem Tag, seit dem Sie es nehmen. Vorher gibt die App keine Richtung.');
      aktionSetzen(null, 'Dosis eintragen');
    }
  }

  /*
   * Q5 (RW2 D5, rot-2 X15): Eine schon beantwortete Verwechslung ist ein
   * dringlicher Grund – „einmal viele Tabletten" mit Giftnotruf und Stufe
   * heute. Sie wurde nur ohne andere Gründe gelesen (unten, mit der Frage).
   * Kam danach ein Grund dazu – Beschwerden (D0.18), Kortison „weiß nicht",
   * ein Check –, verschwand der Giftnotruf von allen Bildschirmen, und die
   * Karte sagte wieder „genau wie bisher weiter" (Runde 3: D18). „Keine
   * weiteren Pflichtfragen nach einem Sperrgrund" gilt für offene Fragen,
   * nicht für beantwortete dringliche.
   */
  const q5Grund = () => {
    if (gruppe !== 'd' && gruppe !== 'e') return;
    if (befund.verwechselt === 'einmal') {
      // X15: der Giftnotruf fürs eingetragene Bundesland, mit Nummer und Knopf (ohne Bundesland 112, P5).
      const gift = giftnotrufAnruf(stand);
      const giftText = gift.nummer === '112' ? 'den Giftnotruf (ohne eingetragenes Bundesland: 112)' : `den ${gift.text}`;
      grund('Q5', `Wenn Sie einmalig viele Tabletten auf einmal genommen haben: Rufen Sie heute noch ${giftText} oder die Praxis an. Bei Brustschmerz, Herzrasen oder Atemnot: sofort 112. Die Beschwerden setzen oft erst nach Tagen ein.`, 'heute', [gift, TEL_112]);
    } else if (befund.verwechselt === 'tage') {
      grund('Q5', (s) => `Nehmen Sie ab jetzt wieder genau Ihre verordnete Stärke, so wie die Praxis sie festgelegt hat, und rufen Sie ${wann(hoechste(s, 'tage'))} die Praxis an. Lassen Sie danach neu messen.`, 'tage');
    }
  };

  const hart = gruende.length > 0;
  if (hart) q5Grund();

  // ---- 4. Offene Pflichtfragen (höchstens eine) und ihre Sperren
  let frage = null;
  let frage14 = null;
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
    q5Grund();
    if ((gruppe === 'd' || gruppe === 'e') && !befund.verwechselt) {
      offen(bFrage('Q5', 'verwechselt', 'Haben Sie vielleicht versehentlich mehr genommen oder eine Packung mit einer anderen Stärke bekommen?', [['nein', 'Nein'], ['einmal', 'Ja, einmal viele Tabletten auf einmal'], ['tage', 'Ja, über Tage zu viel oder eine andere Stärke'], ['unbekannt', 'Weiß nicht']]));
    }
    // X3 (2) – Richtung nur 14 Tage ohne Rückfrage
    // Die Richtung gilt 14 Tage ab der Antwort auf die Dosisfrage – dann wird
    // nachgefragt, bevor sie wieder erscheint. „Noch nicht" gibt weitere 14 Tage.
    // Ebenso „Ja, mit der Praxis gesprochen" mit „Noch nichts entschieden" (F8,
    // RW2 D0.5): Zählte nur „Nein, noch nicht", kam die Rückfrage sofort und
    // endlos wieder – heraus kam man nur mit einer unwahren Antwort (C2). Wird
    // F8 erst Tage später beantwortet, zählen die 14 Tage ab dieser Antwort.
    const beantwortet = [
      nach14 && ['nein', 'praxis'].includes(nach14.antwort) ? nach14.am : null,
      stimmtGilt && stimmtGilt.antwort === 'ja' ? stimmtGilt.am : null,
    ].filter(Boolean);
    // Nur Tage bis heute: Ein Datum in der Zukunft (etwa aus einer Sicherung
    // mit verstellter Uhr) schöbe die Rückfrage sonst beliebig weit hinaus.
    const anker = beantwortet.length
      ? [...beantwortet, befund.praxis === 'nochnicht' ? befund.praxisAm : null].filter((t) => t && t <= heute).sort().pop() || null
      : null;
    // Gestellt wird sie erst unten, wenn die Richtung feststeht (Runde 3: D14).
    if (anker && tageZwischen(anker, heute) >= 14) {
      frage14 = { id: 'X3-14', text: 'Haben Sie inzwischen mit der Praxis über diesen Wert gesprochen oder selbst etwas an der Dosis geändert?', optionen: [['praxis', 'Ja, mit der Praxis gesprochen'], ['selbst', 'Ich habe selbst etwas geändert'], ['nein', 'Nein, noch nicht']], ziel: 'nachfrage', feld: 'nach14', bezug: befund.id };
    }
  }

  if (gruende.length) return karte({ stufe: e.stufeLabor, stufeFest, warnzeichen: warnWD2 ? WD2 : null });
  if (frage) return karte({ titel: 'Zuerst eine Frage', frage, stufe: e.stufeLabor });

  // ---- 5. Die Richtung (D1–D5)
  /*
   * X3 (2): Nur eine Richtung „mehr" oder „weniger" gilt 14 Tage ohne
   * Rückfrage (rot-2). Vorher fragte die Karte bei jedem Muster, auch bei
   * TSH 2,1 („Dosis so lassen") alle 14 Tage „Haben Sie inzwischen mit der
   * Praxis gesprochen oder selbst etwas an der Dosis geändert?" – als sei bei
   * einem Normalwert ein Gespräch fällig (Runde 3: D14). Die Frage trägt die
   * Stufe der Richtung, die sie zurückhält: Die Kopfzeile sinkt nicht.
   */
  /*
   * Die Frage hält die Richtung zurück, nicht deren Notfallzeilen: W-D2 und
   * bei Muster b der Satz „sofort 112 anrufen" bei Schläfrigkeit oder
   * Verwirrtheit (D9) standen sonst ab Tag 14 nicht mehr auf der Karte.
   */
  const richtungsKarte = (x) => (frage14 && ['mehr', 'weniger'].includes(x.richtung)
    ? karte({ titel: 'Zuerst eine Frage', frage: frage14, stufe: x.stufe, warnzeichen: x.warnzeichen || null, texte: x.notfall ? [x.notfall] : undefined })
    : karte(x));
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
      return richtungsKarte({
        richtung: 'gleich', titel: 'Das spricht dafür, die Dosis so zu lassen – und nach dem Zielbereich zu fragen.', stufe: 'termin', regeln: ['D1b'],
        texte: [(s, eigen) => satz('Ihr TSH liegt am unteren Rand. Im Alter, bei Herz- oder Knochenerkrankung wird TSH oft etwas höher angestrebt.', zielFrage(s, eigen))],
      });
    }
    const texte = [(s, eigen) => satz(`Ihr TSH liegt im Bereich ${ziel ? 'den Ihre Ärztin festgelegt hat' : 'Ihres Labors'}. Das spricht dafür, die Dosis so zu lassen. Beschwerden allein sind kein Grund, die Dosis zu ändern. Sie haben oft andere Ursachen, zum Beispiel Blutarmut, Vitamin-B12- oder Eisenmangel, Schlaf, Stimmung oder andere Medikamente. Wenn Sie sich über Wochen deutlich schlecht fühlen, sprechen Sie es in der Praxis an.`, fristHier(s, eigen))];
    const vorher = [...stand.labor].reverse().find((l) => l.id !== befund.id && l.tsh && l.datum < tag);
    if (amRand && (!vorher || !stand.dosen.some((d) => d.ab > vorher.datum && d.ab <= tag))) texte.push('Ein Wert knapp am Rand des Bereichs schwankt von Messung zu Messung. Das ist kein Grund für eine Änderung.');
    if (g28.has('muede')) texte.push('Bei Hashimoto kommt eine chronische Entzündung der Magenschleimhaut häufiger vor. Sie kann zu Vitamin-B12- und Eisenmangel führen. Wenn Sie trotz guter Schilddrüsenwerte müde sind, lassen Sie Blutbild, B12 und Ferritin prüfen.');
    return richtungsKarte({ richtung: 'gleich', titel: 'Das spricht dafür, die Dosis so zu lassen.', texte, stufe: b.richtung ? 'termin' : 'keine', regeln: ['D1'] });
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
      return richtungsKarte({
        richtung: 'klaeren', titel: KOPF_KLAEREN, stufe: gruppe === 'b' || (tsh !== null && tsh > 10) ? 'tage' : 'zeitnah', regeln: ['D2d'],
        texte: [(s, eigen) => satz('Ihr TSH ist erhöht, obwohl Sie schon eine hohe Dosis nehmen oder die Dosis schon mehrfach erhöht wurde – oder Sie haben Durchfall oder abgenommen. Dann ist mehr Tablette oft nicht die Lösung. Häufiger wird die Tablette nicht richtig aufgenommen, etwa wegen der Einnahme, des Magens, des Darms, anderer Mittel oder einer Zöliakie. Das sollte die Praxis klären.', fristHier(s, eigen, 'tage'), 'Bitte nehmen Sie nicht selbst mehr.'), E5_TEXT],
      });
    }
  }

  if (gruppe === 'c') {
    // D2a – im Alter oft gewollt (nur mit Geburtsjahr, ohne Ziel)
    const grenzeAlt = alt !== null && alt >= 80 ? 7 : 6;
    if (!ziel && alt !== null && alt >= 70 && tsh <= grenzeAlt) {
      return richtungsKarte({
        richtung: 'gleich', titel: 'Das spricht eher dafür, die Dosis so zu lassen.', stufe: 'termin', regeln: ['D2a'],
        texte: [(s, eigen) => satz('Ihr TSH liegt etwas über dem Bereich des Labors. Im Alter wird ein etwas höherer TSH-Wert oft bewusst hingenommen, weil zu viel Hormon Herz und Knochen belastet. Das spricht eher dafür, die Dosis so zu lassen.', zielFrage(s, eigen))],
      });
    }
    // X7 – über 80 mit Herzkrankheit im Graubereich: keine Richtung
    if (alt !== null && alt >= 80 && herzVorsicht && tsh <= 10) {
      return richtungsKarte({
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
    return richtungsKarte({
      richtung: 'mehr',
      titel: graubereich ? 'Das spricht für eine Kontrolle oder einen kleinen Schritt nach oben.' : 'Das spricht für eine etwas höhere Dosis.',
      texte: zusatz, schritt: graubereich ? 'Ärztinnen erhöhen dann meist nur in einem kleinen Schritt von 12,5 µg (Mikrogramm) am Tag.' : sMehr,
      stufe, warnzeichen: vorsichtig ? WD2 : null, regeln: [graubereich ? 'D2b' : 'D2c'],
    });
  }

  if (gruppe === 'b') {
    /*
     * Schläfrigkeit, Verwirrtheit, Auskühlen sind die Zeichen eines drohenden
     * Myxödemkomas: 112, wie die Einschätzung zum selben Befund (RW1 W1, L3e)
     * und W-D3. Vorher schickte die Karte zuerst in den Check – wer so krank
     * ist, füllt keinen Fragebogen aus (RW1 W0; Runde 3: D9).
     */
    const notfallD3 = 'Wenn Sie ungewohnt stark schläfrig oder neu verwirrt sind oder stark auskühlen: sofort 112 anrufen. Wenn Sie nur mehr frieren als sonst, machen Sie den Warnzeichen-Check.';
    return richtungsKarte({
      richtung: 'mehr', titel: 'Das spricht klar dafür, dass Ihre Dosis im Moment zu niedrig ist.', stufe: 'tage', regeln: ['D3'], schritt: sMehr,
      warnzeichen: vorsichtig ? WD2 : null, notfall: notfallD3,
      texte: [(s, eigen) => satz('Ihr TSH ist zu hoch und Ihr fT4 zu niedrig.', fristHier(s, eigen), `${warumKlein()}${sMehr} Nehmen Sie nicht auf eigene Faust mehr, und schon gar nicht mehrere Schritte auf einmal. ${notfallD3}`), ...(vorsichtig ? [herzZusatz] : [])],
    });
  }

  const d4 = (zusatzVorher = []) => {
    const risikoKnochen = p.osteoporose !== 'nein';
    if (alt !== null && alt < 65 && p.herz === 'nein' && p.osteoporose === 'nein' && tsh >= 0.1) {
      // „Oft wird erst in 6 bis 8 Wochen nachgemessen" nur, wenn die Karte beim
      // Termin steht – bei Muster d oder Herzklopfen gilt eine kürzere Frist (B24).
      return richtungsKarte({
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
    return richtungsKarte({ richtung: 'weniger', titel: 'Das spricht für eine etwas niedrigere Dosis.', stufe, regeln: ['D4b'], schritt: sWeniger, texte });
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
    return richtungsKarte({ richtung: 'weniger', titel: 'Das spricht für eine niedrigere Dosis.', stufe: 'tage', regeln: ['D5'], schritt: sWeniger, texte, warnzeichen: WD2 });
  }

  // Übrige Muster (z) – keine Richtung
  grund('D0.14', 'Für dieses Muster gibt die App keine Richtung. Besprechen Sie den Wert mit der Praxis.');
  return richtungsKarte({ stufe: e.stufeLabor });
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
  const aenderung = letzteAenderung(stand, heute);
  const letzte = aenderung ? aenderung.letzte : null;
  const vorige = aenderung ? aenderung.vorige : null;
  const art = aenderung ? aenderung.art : null;
  // Nach „Nein, ich nehme etwas anderes" eingetragen: eine Berichtigung, keine
  // Änderung – keine Kontrolle „nach der Änderung", keine Nachfragen nach 14
  // und 28 Tagen, kein „wieder die bisherige Menge" (Nachprüfung zu B26).
  const berichtigt = Boolean(aenderung && aenderung.berichtigt);

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
    /*
     * Fällig ist die Kontrolle ab Tag `ab` bis zum Kontrollbefund – ein
     * Zustand, kein Ereignis (RW2 D6c „wöchentlich wiederholen", ohne Ende).
     * Als Karte auf „Heute" erscheint sie die ersten vier Wochen täglich,
     * danach an jedem 7. Tag; an den Tagen dazwischen steht sie `still` da:
     * im Gesamtbild mit ihrer Stufe, ohne eigene Karte auf „Heute". Vorher
     * gab es sie nur an den Anzeigetagen: Die eine Gesamteinschätzung sprang
     * jede Woche zwischen „In ein bis zwei Wochen" und „Kein besonderer
     * Anlass", und ab Tag 183 erinnerte nichts mehr (Runde 3: D12).
     */
    if (!neuerBefund && n >= ab) {
      // Der Text sagt, was war (B36): eine Änderung der Dosis, ein Präparatwechsel oder „erst nachmessen".
      const anfang = !ausAenderung ? `Die Praxis wollte nach Ihrem Befund vom ${kurz(nachmessen.datum)} nachmessen lassen.`
        : art === 'praeparat' ? `Sie haben am ${kurz(seit)} ein anderes Präparat oder einen anderen Hersteller eingetragen.`
          : `Ihre Dosis wurde am ${kurz(seit)} geändert.`;
      const zeigen = n <= ab + 28 || n % 7 === 0;
      // Nach drei Monaten ohne Kontrolle „zeitnah" wie L7d – es ist dieselbe Kontrolle (B37).
      add('D6c', n > 90 ? 'zeitnah' : 'termin', `${anfang} Jetzt ist die Kontrolle fällig (${wochenText(ab)} danach). Bis ein neuer Wert da ist, zeigt die App keine neue Richtung. ${VOR_ABNAHME}`,
        zeigen ? {} : { still: true });
    }
  }

  if (letzte) {
    const n = tageZwischen(letzte.ab, heute);
    const { tdNeu, tdAlt, mehr, weniger } = aenderung;
    /*
     * INR und Blutzucker stehen täglich da (die Stufe bleibt so stabil) – mit
     * Datum statt „in den nächsten 1 bis 2 Wochen": Die Frist rückte sonst
     * jeden Tag mit, und an Tag 14 hieß es noch „1 bis 2 Wochen" (Grundsatz 4,
     * feste Fristen; Runde 3: D15).
     */
    const am = kurz(letzte.ab);
    const was = berichtigt ? 'Sie haben berichtigt, welche Menge Sie nehmen – vielleicht hat sich Ihre Einnahme also kürzlich geändert.'
      : art === 'praeparat' ? `Ihr Schilddrüsen-Präparat wurde am ${am} gewechselt.` : `Ihre Schilddrüsendosis wurde am ${am} geändert.`;

    // W-D4 – Nachfragen nach 14 und 28 Tagen
    const frage = (tag, text) => {
      const bezug = `${letzte.id}-${tag}`;
      const antwort = [...stand.nachfragen].reverse().find((x) => x.art === 'wd4' && x.bezug === bezug);
      if (!antwort && n >= tag && n <= tag + 6) {
        add('W-D4', 'termin', text, { frage: { id: 'W-D4', text, optionen: [['ja', 'Ja'], ['nein', 'Nein']], ziel: 'nachfrage', feld: 'wd4', bezug } });
      } else if (antwort && antwort.antwort === 'ja' && tageZwischen(antwort.am, heute) <= 3) {
        // Unter „Heute anrufen" nicht „heute oder morgen" – derselbe Satz steht
        // bei X3 unter „In den nächsten Tagen" (C8, Grundsatz 4: feste Fristen).
        add('W-D4', mehr ? 'heute' : 'termin', mehr
          ? `Bitte gehen Sie den Warnzeichen-Check durch und rufen Sie heute noch in der Praxis an, außerhalb der Sprechzeiten 116 117. ${WD4_112}`
          : 'Sprechen Sie das bei der Kontrolle an. Ändern Sie nichts selbst.');
      }
    };
    if (berichtigt && n >= 0 && n <= 14) {
      add('X3b', 'termin', 'Sie haben berichtigt, welche Menge Sie im Moment nehmen. Ist das nicht die Menge, die Ihre Praxis verordnet hat, rufen Sie bitte in den nächsten Tagen dort an und sagen Sie, was Sie nehmen.');
    }
    if (mehr && !berichtigt) {
      frage(14, `Seit Ihre Dosis erhöht wurde: Haben Sie Herzklopfen, Herzrasen, innere Unruhe, Zittern, schlechten Schlaf oder Schmerzen in der Brust bemerkt? ${WD4_112}`);
      frage(28, `Seit Ihre Dosis erhöht wurde: Haben Sie Herzklopfen, Herzrasen, innere Unruhe, Zittern, schlechten Schlaf oder Schmerzen in der Brust bemerkt? ${WD4_112}`);
    }
    if (weniger && !berichtigt) frage(28, 'Seit Ihre Dosis verringert wurde: Sind Sie deutlich müder geworden oder frieren Sie mehr?');

    // WW1 – Marcumar
    if (stand.mittel.includes('marcumar') && n >= 0 && n <= 14) {
      add('WW1', 'zeitnah', `${was} Weil Sie Marcumar (Phenprocoumon) nehmen, lassen Sie den INR-Wert bis spätestens ${kurz(tageWeiter(letzte.ab, 14))} kontrollieren. Achten Sie auf ungewöhnliche blaue Flecken, Zahnfleisch- oder Nasenbluten.`);
    }
    // WW2 – Diabetes
    if (hatDiabetes(stand) && n >= 0 && n <= 42) {
      add('WW2', 'zeitnah', `${was} Messen Sie Ihren Blutzucker bis zum ${kurz(tageWeiter(letzte.ab, 42))} öfter. Mehr Schilddrüsenhormon kann den Zucker erhöhen, weniger kann ihn senken.${weniger ? ' Achten Sie auf Unterzucker: Zittern, Schwitzen, Heißhunger, Verwirrtheit. Dann sofort etwas Zuckerhaltiges essen oder trinken und die Praxis informieren.' : ''}`);
    }
    // B2 / X3 (4) – nicht auf Anweisung der Praxis (eigeneAenderung). Eine
    // offene Quelle (null) heißt nicht „nein" – sonst hieße es nach einer
    // angeordneten Änderung „wieder die bisherige Menge". Hat die Nutzerin
    // aber auf der Karte „Ich habe selbst etwas geändert" gesagt, ist die
    // Quelle bekannt (B23). Hat die Praxis danach entschieden, gilt das (C4) –
    // die Dosis-Karte nennt die eigene Änderung dann ohne Frist, „Heute"
    // nicht mehr. „Heute" nennt sie 14 Tage lang, die Karte bis sie geklärt
    // ist (D11); danach verweist „Heute" auf die Karte.
    const eigen = eigeneAenderung(stand, heute);
    if (eigen && tageZwischen(eigen.ab, heute) <= 14) {
      if (eigen.zurueck) {
        add('B2', 'tage', 'Sie nehmen wieder Ihre frühere Menge. Bitte sagen Sie Ihrer Praxis in den nächsten Tagen, dass Sie die Dosis zwischendurch selbst geändert hatten.');
      } else if (eigen.gross) {
        add('X3', 'tage', `Das ist mehr als ein üblicher Schritt. Rufen Sie heute oder morgen die Praxis an und nehmen Sie bis dahin wieder Ihre bisherige Menge. ${WD2}`, { warnzeichen: WD2 });
      } else {
        add('B2', 'tage', 'Bitte sagen Sie Ihrer Praxis in den nächsten Tagen, dass Sie die Dosis geändert haben. Lassen Sie nach 6 bis 8 Wochen kontrollieren.');
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

/**
 * Der Teil der Dosis-Karte im Gesamtbild – ohne Richtung: Die gibt es nur mit
 * Pflichttext (D6). `schonDa`: Kennungen der Dosis-Hinweise, die im Gesamtbild
 * schon selbst stehen (X3, B2, W-D4) – ihr Text stünde sonst zweimal da (C7, C8).
 */
function dosisTeilText(k, schonDa = new Set()) {
  const am = kurz(k.befund.datum);
  // Alle Gründe mit der Stufe der Karte, nicht nur der erste: Neben einem
  // zweiten Grund mit derselben Stufe (Check „über Tage zu viele", Puls)
  // fehlte sonst der Giftnotruf nach „einmal viele Tabletten" (D18).
  const oben = rang(k.stufe) > rang('keine') ? k.gruende.filter((g) => g.stufe === k.stufe && !schonDa.has(g.id)).map((g) => g.text) : [];
  if (k.frage) {
    // Die Frage nach dem Check trägt die dringlichen Gründe der Karte mit
    // (D17) – etwa den Giftnotruf. Er steht dann auch hier, nicht erst auf der Karte.
    return k.frage.ziel === 'warncheck'
      ? satz(`Die Dosis-Karte zu Ihrem Befund vom ${am} bittet Sie zuerst um den Warnzeichen-Check.`, ...oben)
      : `Die Dosis-Karte hat zu Ihrem Befund vom ${am} eine Frage an Sie.`;
  }
  if (k.richtung !== 'klaeren') return `Zu Ihrem Befund vom ${am} gibt es eine Einschätzung zur Dosis. Bitte lesen Sie sie auf der Dosis-Karte ganz – und rufen Sie vor jeder Änderung die Praxis an.`;
  return satz(`Die Dosis-Karte zu Ihrem Befund vom ${am} sagt im Moment nichts zur Dosis und nennt die Gründe.`, ...oben);
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
  /*
   * L7d und D6c meinen dieselbe Kontrolle (B37, Entscheidung „Kontrolle nach
   * Dosisänderung nur D6c"): Steht D6c da, fällt L7d weg, und D6c trägt die
   * höhere der beiden Stufen. L7d zählt ab dem Befund, D6c ab der Änderung –
   * vorher standen bis Tag 90 nach der Änderung „In ein bis zwei Wochen" (L7d)
   * und „Beim nächsten Termin" (D6c) für dieselbe Kontrolle nebeneinander
   * (C11). Die Stufe wird am Hinweis selbst angehoben, damit „Heute"
   * (dosisHinweise unten) sie auch zeigt. Ohne D6c bleibt L7d stehen.
   * L7a (letzte Kontrolle über ein Jahr her) meint ebenfalls dieselbe
   * Kontrolle, seit D6c ohne Ende gilt (Runde 3: D12): auch dann nur eine
   * Erinnerung. D6c bleibt, mit der höheren Stufe – sonst fiele die
   * überfällige Kontrolle nach der Änderung nach einem Jahr auf „Termin".
   */
  const d6c = hinweise.find((h) => h.id === 'D6c');
  ['L7d', 'L7a'].forEach((id) => {
    const l7 = teile.find((t) => t.id === id);
    if (d6c && l7) {
      teile = teile.filter((t) => t.id !== id);
      d6c.stufe = hoechste(d6c.stufe, l7.stufe);
    }
  });
  const hinweisIds = new Set(hinweise.map((h) => h.id));
  if (karte && karte.stufe !== 'notruf') {
    const text = dosisTeilText(karte, hinweisIds);
    teile.push({ id: 'dosis', stufe: karte.stufe, text, quelle: 'dosis', anrufe: anrufeAus([text], stand) });
  } else if (karte && !karte.gruende.some((x) => x.id === 'W1')) {
    /*
     * Eine 112-Karte kommt nur vom Check von heute oder von W5 im Befinden –
     * beide stehen schon mit eigener Kennung im Gesamtbild. Ein zusätzlicher
     * Teil 'dosis' mit 112 verdeckte in kopfFuer() das Gesprächsangebot bei
     * W5. Die übrigen dringlichen Gründe der Karte (D17: Q5 mit dem
     * Giftnotruf, „selbst geändert" …) stehen aber sonst nirgends – sie kommen
     * einzeln dazu, mit der Stufe, mit der die Karte ihre Sätze geschrieben
     * hat (`rest`). Außer neben W1 (RW1 W1: alles andere ausblenden).
     */
    const rest = (INNEN.get(karte) || {}).rest;
    const schon = new Set([...teile.map((t) => t.id), ...hinweisIds]);
    if (rest && rang(rest) > rang('keine')) {
      karte.gruende.filter((x) => x.stufe && x.stufe !== 'notruf' && !/^W\d/.test(x.id) && !schon.has(x.id))
        .forEach((x) => teile.push({ id: x.id, stufe: rest, text: x.text, quelle: 'dosis', anrufe: x.anrufe }));
    }
  }
  hinweise.forEach((h) => teile.push({ id: h.id, stufe: h.stufe, text: h.text, quelle: 'dosis', anrufe: h.anrufe, mitFrage: Boolean(h.frage), still: Boolean(h.still) }));
  // W5 steht immer oben, ganz gleich, welche Stufe sonst gilt (wie im Gesamtbild).
  teile.sort((a, b) => (b.id === 'W5') - (a.id === 'W5') || rang(b.stufe) - rang(a.stufe));
  const stufe = hoechste(...teile.map((t) => t.stufe));
  // „Heute" zeigt die Hinweise als Karten – einen stillen (D6c zwischen den
  // Anzeigetagen, D12) nicht: Seine Stufe steht im Gesamtbild und damit in
  // der Einschätzung auf „Heute".
  return { ...g, stufe, kopf: kopfFuer(stufe, teile), teile, dosis: karte, dosisHinweise: hinweise.filter((h) => !h.still) };
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
