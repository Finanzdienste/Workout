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
 * Wie in js/einschaetzung.js: reine Rechnung mit übergebenem Stand und Tag.
 */
import { tageWeiter, tageZwischen, zahlText, datumKurz } from './datum.js';
import * as sp from './speicher.js';
import { normEinheit, inStandard, plausibel } from './einheiten.js';
import {
  befundEinschaetzen, dosisAmIn, alterAm, einnahmenVor, beschwerdenAuswerten, hatDiabetes, zielBereich,
  einordnen, hoechste, warnzeichenAuswerten, vergleichbar, W5_TEXT, praxisHatErklaert,
} from './einschaetzung.js';

const kurz = (iso) => datumKurz(iso);
const zahl = (n) => zahlText(n, 2);
const ug = (n) => `${zahlText(n, 1)} µg`;

const JNW = [['ja', 'Ja'], ['nein', 'Nein'], ['unbekannt', 'Weiß nicht']];

// ---------------------------------------------------------------- Texte

export const KOPF_KLAEREN = 'Aus diesem Befund lässt sich im Moment nichts zur Dosis ableiten.';
const KLAEREN_SATZ = 'Das heißt nicht, dass alles in Ordnung ist – die Gründe stehen darunter. Nehmen Sie Ihre Tablette bis dahin genau wie bisher weiter.';

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

/** Jeder Dosis-Eintrag außer dem ersten ist eine Änderung (Dosis, Präparat, Hersteller). */
const aenderungen = (stand) => stand.dosen.slice(1);

// ---------------------------------------------------------------- Dosisrichtung

/**
 * Die Karte zum jüngsten Befund mit TSH – oder null, wenn es keinen gibt.
 * Siehe die Schnittstelle in der Kopfzeile.
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
  const regeln = [];
  const gruende = [];
  const grund = (id, text, stufe = null) => { gruende.push({ id, text, stufe }); regeln.push(id); };
  let stufeWarn = 'keine';

  // DG – die Grundlage steht auf jeder Karte
  const bereich = (w) => (w.von !== null || w.bis !== null ? `${w.von !== null ? zahl(w.von) : '…'}–${w.bis !== null ? zahl(w.bis) : '…'}` : 'kein Bereich eingetragen');
  const grundlage = `Grundlage: Befund vom ${kurz(tag)} – TSH ${zahl(befund.tsh.wert)} ${befund.tsh.einheit} (Bereich Ihres Labors ${bereich(befund.tsh)}${ziel ? `; Zielbereich Ihrer Ärztin ${zahl(ziel.von)}–${zahl(ziel.bis)} mU/l` : ''})${befund.ft4 ? `, fT4 ${zahl(befund.ft4.wert)} ${befund.ft4.einheit} (Bereich ${bereich(befund.ft4)})` : ''}. ${dAkt && td !== null ? `Ihre Dosis laut App: ${ug(td)} am Tag seit ${kurz(dAkt.ab)}${dAkt.praeparat ? ` (${dAkt.praeparat})` : ''}.` : 'Ihre Dosis ist in der App nicht vollständig eingetragen.'} Die App kennt Ihre übrigen Befunde nicht – die Entscheidung trifft die Praxis.`;

  const karte = (x) => {
    const richtung = x.richtung || 'klaeren';
    const hinweise = [];
    if (richtung !== 'klaeren' || x.frage) {
      if (alt === null) hinweise.push('Bitte tragen Sie im Profil Ihr Geburtsjahr ein. Bis dahin rechnet die App vorsichtig.');
      if (['unbekannt', ''].includes(p.herz)) hinweise.push('Solange nicht angegeben ist, ob Sie eine Herzerkrankung haben, rechnet die App vorsichtig so, als hätten Sie eine.');
    }
    let stufe = hoechste(x.stufe || 'keine', stufeWarn, ...gruende.map((g) => g.stufe).filter(Boolean));
    if (x.stufeFest) stufe = hoechste(x.stufeFest, stufeWarn);
    const merken = (richtung === 'mehr' || richtung === 'weniger') && !nachfrage(stand, 'richtung', befund.id)
      ? { art: 'richtung', bezug: befund.id, antwort: richtung } : null;
    return {
      richtung,
      titel: x.titel || KOPF_KLAEREN,
      texte: x.texte || (richtung === 'klaeren' && !x.frage ? [KLAEREN_SATZ] : []),
      schritt: x.schritt || null,
      pflicht: richtung === 'mehr' || richtung === 'weniger' ? D6_LANG : D6_KURZ,
      gruende,
      frage: x.frage || null,
      aktion: x.aktion || null,
      hinweise,
      stufe,
      warnzeichen: x.warnzeichen || null,
      grundlage,
      befund,
      einschaetzung: e,
      merken,
      regeln: [...new Set([...regeln, ...(x.regeln || [])])],
    };
  };

  // ---- 1. Warnzeichen (W-D1, W-D3, X1, X2)
  if (g14.has('lebensmuede')) {
    grund('W5', W5_TEXT, 'heute');
    return karte({ titel: 'Bevor es um die Dosis geht: Bitte bleiben Sie damit nicht allein.', texte: [], regeln: ['X2'] });
  }
  const unruhe = ['herz', 'schwitzen', 'puls', 'zittern'].filter((k) => g14.has(k));
  const muedeB = gruppe === 'b' && ['muede', 'frieren', 'konzentration'].some((k) => g14.has(k));
  const wd3 = gruppe === 'b' && ((tsh !== null && tsh > 20) || muedeB);
  if (unruhe.length || wd3) {
    const seit = unruhe.length ? unruhe.map((k) => g14.get(k)).sort()[0] : tag;
    const check = [...stand.warnzeichen].reverse().find((w) => w.datum >= seit);
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
      grund(id, w.abschnitte[0].text, 'notruf');
      return karte({ titel: 'Bitte zuerst den Notruf', stufeFest: 'notruf' });
    }
    stufeWarn = hoechste(stufeWarn, w.stufe);
    if (w.stufe === 'tage' || w.stufe === 'heute') {
      stufeWarn = hoechste(stufeWarn, 'tage');
      if (gruppe === 'b' || gruppe === 'c') grund('X4', 'Bei Herzklopfen oder Unruhe sollte die Praxis zuerst Herz und Puls ansehen, bevor über mehr Tablette gesprochen wird.', 'tage');
    }
    if (unruhe.includes('puls') && w.stufe !== 'notruf') {
      stufeWarn = hoechste(stufeWarn, 'tage');
      grund('X1', 'Ein neu unregelmäßiger Puls sollte in den nächsten Tagen ärztlich angesehen werden, auch wenn Ihr Schilddrüsenwert passt.', 'tage');
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

  const dosisNach = stand.dosen.some((d, i) => i > 0 && d.ab > tag && d.ab <= heute);
  const praxisSagt = praxisHatErklaert(befund);
  let stufeFest = null;
  if (tageZwischen(tag, heute) > 92) {
    // X12: nur herabstufen, wenn die Praxis sich geäußert hat oder die Dosis seither geändert wurde
    if (praxisSagt || dosisNach) {
      grund('D0.4', 'Der Befund ist älter als drei Monate. Er ist zu alt, um daraus etwas für heute abzuleiten, und die Praxis hat ihn wahrscheinlich schon bewertet. Wenn eine Kontrolle ansteht, lassen Sie neu messen.');
      stufeFest = 'termin';
    } else {
      const frist = { tage: 'in den nächsten Tagen', zeitnah: 'innerhalb von ein bis zwei Wochen' }[e.stufeLabor] || 'beim nächsten Termin';
      grund('D0.4', `Der Befund ist älter als drei Monate und zu alt, um daraus etwas für heute abzuleiten. Falls die Praxis zu diesem Wert noch nichts gesagt hat, rufen Sie ${frist} an und lassen Sie neu messen.`);
    }
  }
  if (dosisNach) {
    grund('D0.5', 'Ihre Dosis wurde nach dieser Blutabnahme schon geändert. Der Wert zeigt deshalb nicht mehr, wie es heute ist. Eine neue Einschätzung gibt es mit dem Kontrollwert 6 bis 8 Wochen nach der Änderung.');
    stufeFest = 'keine';
  } else if (praxisSagt) {
    grund('D0.5', 'Die Praxis hat zu diesem Wert schon entschieden. Dann gilt, was die Praxis gesagt hat.');
    stufeFest = 'keine';
  }
  const frist = einpendeln(stand, tag);
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
  if (p.ursache === 'hypophyse' || p.kortison === 'ja' || p.kortison === 'unbekannt'
    || (p.zielNiedrig === 'ja' && (['d', 'e', 'z'].includes(gruppe)))) {
    grund('D0.14', 'Bei einer Unterfunktion durch die Hirnanhangdrüse, bei einer Nebennierenschwäche, bei dauerhaftem Kortison oder wenn TSH bewusst niedrig gehalten werden soll, sagt TSH wenig über die richtige Dosis. Deshalb gibt die App keine Richtung. Besprechen Sie jeden Wert mit der Praxis.');
  }
  if (p.praeparatArt === 't3' || gruppe === 't') grund('D0.15', 'Ihr Präparat enthält neben L-Thyroxin auch T3 oder Schilddrüsenextrakt. Dann lässt sich die Dosis aus TSH nicht so einfach ablesen. Die App gibt keine Richtung. Besprechen Sie den Wert mit der Praxis.');
  if (!dAkt || !dBef || td === null) {
    grund('D0.16', 'Bitte tragen Sie zuerst ein, wie viel Sie im Moment nehmen (µg am Tag). Ohne Ihre aktuelle Dosis gibt die App keine Richtung.');
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
  const b = beschwerdenAuswerten(stand, heute);
  if ((b.richtung === 'viel' && ['b', 'c'].includes(gruppe)) || (b.richtung === 'wenig' && ['d', 'e'].includes(gruppe))) {
    grund('D0.18', 'Ihre Beschwerden der letzten vier Wochen passen nicht zu diesem Laborwert. Das sollte die Praxis ansehen, bevor etwas an der Dosis geändert wird. Rufen Sie innerhalb von ein bis zwei Wochen an.', 'zeitnah');
  }
  if (p.zielNiedrig === 'ja' && gruppe === 'a') {
    grund('D0.14', 'Ihre Ärztin möchte den TSH-Wert bewusst niedrig halten. Dann legt sie die Dosis fest – die App gibt keine Richtung.');
  }

  // X3 (2): Nach 14 Tagen fragt die Karte, ob inzwischen etwas passiert ist.
  const gezeigt = nachfrage(stand, 'richtung', befund.id);
  const nach14 = nachfrage(stand, 'nach14', befund.id);
  if (nach14 && nach14.antwort === 'selbst') {
    grund('X3', 'Sie haben angegeben, selbst etwas an der Dosis geändert zu haben. Bitte tragen Sie ein, was Sie jetzt nehmen, und sagen Sie es der Praxis in den nächsten Tagen. Eine neue Einschätzung gibt es mit dem nächsten Kontrollwert.', 'tage');
  }
  if (nach14 && nach14.antwort === 'praxis') grund('D0.5', 'Sie haben mit der Praxis gesprochen. Dann gilt, was die Praxis gesagt hat – tragen Sie es unter „Die Praxis hat entschieden" ein.');
  const stimmt = nachfrage(stand, 'dosis_stimmt', befund.id);
  if (stimmt && stimmt.antwort === 'nein') {
    grund('X3', 'Sie nehmen im Moment etwas anderes als in der App eingetragen. Bitte tragen Sie zuerst ein, was Sie jetzt nehmen. Vorher gibt die App keine Richtung.');
  }

  const hart = gruende.length > 0;

  // ---- 4. Offene Pflichtfragen (höchstens eine) und ihre Sperren
  let frage = null;
  const offen = (f) => { if (!frage) frage = f; };
  const bFrage = (id, feld, text, optionen = JNW) => ({ id, text, optionen, ziel: 'befund', feld, bezug: befund.id });
  const pFrage = (id, feld, text, optionen = JNW) => ({ id, text, optionen, ziel: 'profil', feld });
  const blockJaWeissNicht = (wert) => wert === 'ja' || wert === 'unbekannt';

  if (!hart) {
    // F8 – hat die Praxis schon etwas gesagt?
    if (!befund.praxis) {
      offen(bFrage('F8', 'praxis', 'Hat die Praxis zu diesem Wert schon etwas gesagt?', [['bleibt', 'Ja: Die Dosis bleibt so'], ['geaendert', 'Ja: Die Dosis wird geändert'], ['nachmessen', 'Ja: Erst nachmessen'], ['nochnicht', 'Noch nicht']]));
    }
    // X3 (1) – nimmt sie wirklich, was eingetragen ist?
    if (!stimmt) {
      offen({ id: 'X3', text: `Nehmen Sie im Moment genau ${ug(td)} am Tag, so wie in der App eingetragen?`, optionen: [['ja', 'Ja'], ['nein', 'Nein, ich nehme etwas anderes']], ziel: 'nachfrage', feld: 'dosis_stimmt', bezug: befund.id });
    }
    // P2 / D0.13 – Krebs
    if (!p.krebs) offen(pFrage('P2', 'krebs', 'Wurden Sie jemals wegen Schilddrüsenkrebs behandelt (Operation oder Radiojod)? Nach Schilddrüsenkrebs soll TSH oft bewusst niedrig sein – ein Rat zu „weniger" wäre dann falsch.'));
    else if (p.krebs === 'unbekannt') grund('D0.13', 'Bitte geben Sie im Profil an, ob Sie je wegen Schilddrüsenkrebs behandelt wurden. Vorher gibt die App keine Richtung.');
    // P9 / D0.14 – Kortison, Nebenniere
    if (!p.kortison) offen(pFrage('P9', 'kortison', 'Nehmen Sie dauerhaft Kortison als Tablette (z. B. Prednisolon, Hydrocortison) oder wurde bei Ihnen eine Nebennierenschwäche festgestellt?'));
    // X6 – Geburtsjahr bei Muster c
    if (gruppe === 'c' && alt === null) offen({ id: 'X6', text: 'In welchem Jahr sind Sie geboren? Im Alter wird ein etwas höherer TSH-Wert oft bewusst hingenommen – ohne Ihr Alter gibt die App hier keine Richtung.', optionen: null, ziel: 'profil', feld: 'geburtsjahr', typ: 'jahr' });
    // Q4 – Hirnanhangdrüse oder bewusst niedrig (d/e bei offenem Grund)
    if (['d', 'e'].includes(gruppe) && ['andere', 'unbekannt', ''].includes(p.ursache) && p.zielNiedrig !== 'nein') {
      if (!p.hypophyseOderNiedrig) offen(pFrage('Q4', 'hypophyseOderNiedrig', 'Hat Ihnen eine Ärztin einmal gesagt, dass die Ursache in der Hirnanhangdrüse liegt oder dass Ihr TSH bewusst niedrig gehalten werden soll?'));
      else if (blockJaWeissNicht(p.hypophyseOderNiedrig)) grund('D0.14', 'Wenn die Ursache in der Hirnanhangdrüse liegt oder TSH bewusst niedrig gehalten werden soll, sagt TSH wenig über die richtige Dosis. Deshalb gibt die App keine Richtung. Besprechen Sie jeden Wert mit der Praxis.');
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
      const x = einnahmenVor(befund, stand);
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
        grund('Q5', 'Wenn Sie einmalig viele Tabletten auf einmal genommen haben: Rufen Sie heute noch den Giftnotruf oder die Praxis an. Bei Brustschmerz, Herzrasen oder Atemnot: sofort 112. Die Beschwerden setzen oft erst nach Tagen ein.', 'heute');
      } else if (befund.verwechselt === 'tage') {
        grund('Q5', 'Nehmen Sie ab jetzt wieder genau Ihre verordnete Stärke, so wie die Praxis sie festgelegt hat, und rufen Sie in den nächsten Tagen die Praxis an. Lassen Sie danach neu messen.', 'tage');
      } else if (!befund.verwechselt) {
        offen(bFrage('Q5', 'verwechselt', 'Haben Sie vielleicht versehentlich mehr genommen oder eine Packung mit einer anderen Stärke bekommen?', [['nein', 'Nein'], ['einmal', 'Ja, einmal viele Tabletten auf einmal'], ['tage', 'Ja, über Tage zu viel oder eine andere Stärke'], ['unbekannt', 'Weiß nicht']]));
      }
    }
    // X3 (2) – Richtung nur 14 Tage ohne Rückfrage
    if (gezeigt && tageZwischen(gezeigt.am, heute) > 14 && (!nach14 || (nach14.antwort === 'nein' && tageZwischen(nach14.am, heute) > 14))) {
      offen({ id: 'X3-14', text: 'Haben Sie inzwischen mit der Praxis über diesen Wert gesprochen oder selbst etwas an der Dosis geändert?', optionen: [['praxis', 'Ja, mit der Praxis gesprochen'], ['selbst', 'Ich habe selbst etwas geändert'], ['nein', 'Nein, noch nicht']], ziel: 'nachfrage', feld: 'nach14', bezug: befund.id });
    }
  }

  if (gruende.length) {
    const aktion = gruende.some((g) => g.id === 'X3' || g.id === 'D0.16') ? 'dosis' : null;
    return karte({ stufe: e.stufeLabor, stufeFest, aktion });
  }
  if (frage) return karte({ titel: 'Zuerst eine Frage', frage, stufe: e.stufeLabor });

  // ---- 5. Die Richtung (D1–D5)
  const og = ziel ? ziel.bis : lab.bis;
  const unten = ziel ? ziel.von : lab.von;
  const sMehr = vorsichtig || td <= 50
    ? 'Ärztinnen erhöhen dann meist nur in einem kleinen Schritt von 12,5 µg (Mikrogramm) am Tag und begleiten das eng.'
    : 'Ärztinnen erhöhen dann meist um 12,5 bis 25 µg (Mikrogramm) am Tag.';
  const sWeniger = td <= 50 ? 'Ärztinnen verringern dann meist um 12,5 µg (Mikrogramm) am Tag.' : 'Ärztinnen verringern dann meist um 12,5 bis 25 µg (Mikrogramm) am Tag.';
  const warumKlein = () => {
    if (!vorsichtig) return '';
    if (alt === null || ['unbekannt', ''].includes(p.herz)) return 'Weil Alter oder Herz im Profil fehlen, geht das nur in kleinen Schritten. ';
    if (p.herz === 'ja') return 'Weil Sie eine Herzerkrankung haben, geht das nur in kleinen Schritten. ';
    return 'Weil Sie über 65 sind, geht das nur in kleinen Schritten. ';
  };
  const herzZusatz = 'Wenn nach einer Erhöhung Schmerzen oder Engegefühl in der Brust, Herzrasen oder Atemnot auftreten: sofort 112 anrufen.';

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
        texte: ['Ihr TSH liegt am unteren Rand. Im Alter, bei Herz- oder Knochenerkrankung wird TSH oft etwas höher angestrebt. Fragen Sie beim nächsten Termin, welcher Zielbereich für Sie gilt.'],
      });
    }
    const texte = [`Ihr TSH liegt im Bereich ${ziel ? 'den Ihre Ärztin festgelegt hat' : 'Ihres Labors'}. Das spricht dafür, die Dosis so zu lassen. Beschwerden allein sind kein Grund, die Dosis zu ändern. Sie haben oft andere Ursachen, zum Beispiel Blutarmut, Vitamin-B12- oder Eisenmangel, Schlaf, Stimmung oder andere Medikamente. Wenn Sie sich über Wochen deutlich schlecht fühlen, sprechen Sie es in der Praxis an.`];
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
      return karte({
        richtung: 'klaeren', titel: KOPF_KLAEREN, stufe: gruppe === 'b' ? 'tage' : 'zeitnah', regeln: ['D2d'],
        texte: ['Ihr TSH ist erhöht, obwohl Sie schon eine hohe Dosis nehmen oder die Dosis schon mehrfach erhöht wurde – oder Sie haben Durchfall oder abgenommen. Dann ist mehr Tablette oft nicht die Lösung. Häufiger wird die Tablette nicht richtig aufgenommen, etwa wegen der Einnahme, des Magens, des Darms, anderer Mittel oder einer Zöliakie. Das sollte die Praxis klären. Bitte nehmen Sie nicht selbst mehr.', E5_TEXT],
      });
    }
  }

  if (gruppe === 'c') {
    // D2a – im Alter oft gewollt (nur mit Geburtsjahr, ohne Ziel)
    const grenzeAlt = alt !== null && alt >= 80 ? 7 : 6;
    if (!ziel && alt !== null && alt >= 70 && tsh <= grenzeAlt) {
      return karte({
        richtung: 'gleich', titel: 'Das spricht eher dafür, die Dosis so zu lassen.', stufe: 'termin', regeln: ['D2a'],
        texte: ['Ihr TSH liegt etwas über dem Bereich des Labors. Im Alter wird ein etwas höherer TSH-Wert oft bewusst hingenommen, weil zu viel Hormon Herz und Knochen belastet. Das spricht eher dafür, die Dosis so zu lassen. Fragen Sie beim nächsten Termin, welcher Zielbereich für Sie gilt.'],
      });
    }
    // X7 – über 80 mit Herzkrankheit im Graubereich: keine Richtung
    if (alt !== null && alt >= 80 && p.herz === 'ja' && tsh <= 10) {
      return karte({
        richtung: 'klaeren', titel: KOPF_KLAEREN, stufe: 'termin', regeln: ['X7'],
        texte: ['Ihr TSH ist etwas erhöht. Über 80 und mit einer Herzerkrankung ist ein TSH unter 10 oft die gewollte Einstellung. Ob etwas geändert wird, sollte die Praxis entscheiden – sprechen Sie es beim nächsten Termin an.', KLAEREN_SATZ],
      });
    }
    const zusatz = [];
    let stufe;
    const graubereich = tsh <= 1.5 * og || (vorsichtig && tsh <= 10);
    if (graubereich) {
      stufe = 'termin';
      zusatz.push('Ihr TSH ist leicht erhöht. Ein einzelner, nur leicht erhöhter Wert kann auch Schwankung sein. Deshalb wird oft zuerst in 6 bis 8 Wochen nachgemessen oder die Dosis in einem kleinen Schritt erhöht, meist um 12,5 µg (Mikrogramm) am Tag. Was davon, entscheidet die Praxis.');
    } else {
      stufe = tsh > 10 ? 'tage' : 'zeitnah';
      zusatz.push(`Ihr TSH ist zu hoch. Das spricht für eine etwas höhere Dosis. ${warumKlein()}${sMehr}`);
      if (tsh > 10) zusatz.push('Rufen Sie in den nächsten Tagen die Praxis an.');
    }
    if (vorUeber) {
      zusatz.push(`Schon am ${kurz(vorUeber.datum)} lag Ihr TSH über dem Bereich (${zahl(vorUeber.tsh.wert)} ${vorUeber.tsh.einheit}). Zweimal erhöht spricht klarer für eine etwas höhere Dosis.`);
      stufe = hoechste(stufe, 'zeitnah');
    }
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
      texte: [`Ihr TSH ist zu hoch und Ihr fT4 zu niedrig. Rufen Sie in den nächsten Tagen die Praxis an. ${warumKlein()}${sMehr} Nehmen Sie nicht auf eigene Faust mehr, und schon gar nicht mehrere Schritte auf einmal. Wenn Sie sehr schläfrig oder verwirrt sind oder stark frieren, machen Sie gleich den Warnzeichen-Check.`, ...(vorsichtig ? [herzZusatz] : [])],
    });
  }

  const d4 = (zusatzVorher = []) => {
    const risikoKnochen = p.osteoporose !== 'nein';
    if (alt !== null && alt < 65 && p.herz === 'nein' && p.osteoporose === 'nein' && tsh >= 0.1) {
      return karte({
        richtung: 'weniger', titel: 'Das spricht für eine etwas niedrigere Dosis oder zunächst eine Kontrolle.', stufe: 'termin', regeln: ['D4a'], schritt: sWeniger,
        texte: [...zusatzVorher, `Ihr TSH ist leicht zu niedrig. Das spricht für eine etwas niedrigere Dosis oder zunächst eine Kontrolle. Oft wird erst in 6 bis 8 Wochen nachgemessen. Das entscheidet die Praxis. ${nichtWeglassen(dAkt)}`],
      });
    }
    let stufe = vorsichtig || risikoKnochen ? 'zeitnah' : 'termin';
    const texte = [...zusatzVorher, `Ihr TSH ist zu niedrig. Das spricht für eine etwas niedrigere Dosis. ${sWeniger}${vorsichtig || risikoKnochen ? ' Gerade im Alter, bei Herzkrankheit oder bei Knochenschwund belastet zu viel Hormon auf Dauer Herz und Knochen, auch wenn Sie sich gut fühlen. Besprechen Sie das innerhalb von ein bis zwei Wochen mit der Praxis.' : ''} ${nichtWeglassen(dAkt)}`];
    if (tsh < 0.1) { stufe = 'tage'; texte.push('Rufen Sie in den nächsten Tagen die Praxis an.'); }
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
    const texte = [...y, `Ihr TSH ist zu niedrig und Ihr fT4 zu hoch. Das spricht für eine niedrigere Dosis. Rufen Sie in den nächsten Tagen die Praxis an. ${sWeniger} Die Menge legt die Praxis fest. Setzen Sie die Tablette nicht einfach ab und lassen Sie keine Tage weg.${mengeText(dAkt) ? ` ${nichtWeglassen(dAkt)}` : ''}`];
    if (g14.has('herz') || g14.has('schwitzen')) texte.push('Wenn Sie seit Tagen Herzklopfen, Zittern oder innere Unruhe haben: Rufen Sie heute oder morgen an.');
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
 * oder Uhrzeitwechsel (P7, E15).
 */
export function dosisHinweise(stand, heute) {
  const h = [];
  const add = (id, stufe, text, extra = {}) => h.push({ id, stufe, text, ...extra });
  const dosen = stand.dosen.filter((d) => d.ab <= heute);
  const letzte = dosen.length > 1 ? dosen[dosen.length - 1] : null;
  const vorige = letzte ? dosen[dosen.length - 2] : null;

  // D6c – Kontrolle nach einer Änderung oder nach „erst nachmessen"
  const nachmessen = [...stand.labor].reverse().find((l) => l.praxis === 'nachmessen' && l.datum <= heute);
  const seit = [letzte && letzte.ab, nachmessen && (nachmessen.praxisAm || nachmessen.datum)].filter(Boolean).sort().pop();
  if (seit) {
    const n = tageZwischen(seit, heute);
    const neuerBefund = stand.labor.some((l) => l.tsh && l.datum > seit && l.datum <= heute);
    if (!neuerBefund && n >= 42 && (n <= 70 || (n % 7 === 0 && n <= 183))) {
      add('D6c', 'termin', `Ihre Dosis wurde am ${kurz(seit)} geändert${nachmessen && seit !== (letzte && letzte.ab) ? ' oder die Praxis wollte nachmessen' : ''}. Jetzt ist die Kontrolle fällig (6 bis 8 Wochen danach). Bis ein neuer Wert da ist, zeigt die App keine neue Richtung. ${VOR_ABNAHME}`);
    }
  }

  if (letzte) {
    const n = tageZwischen(letzte.ab, heute);
    const tdNeu = sp.tagesdosis(letzte);
    const tdAlt = sp.tagesdosis(vorige);
    const mehr = tdNeu !== null && tdAlt !== null && tdNeu > tdAlt;
    const weniger = tdNeu !== null && tdAlt !== null && tdNeu < tdAlt;

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
    if (mehr) {
      frage(14, 'Seit Ihre Dosis erhöht wurde: Haben Sie Herzklopfen, Herzrasen, innere Unruhe, Zittern, schlechten Schlaf oder Schmerzen in der Brust bemerkt?');
      frage(28, 'Seit Ihre Dosis erhöht wurde: Haben Sie Herzklopfen, Herzrasen, innere Unruhe, Zittern, schlechten Schlaf oder Schmerzen in der Brust bemerkt?');
    }
    if (weniger) frage(28, 'Seit Ihre Dosis verringert wurde: Sind Sie deutlich müder geworden oder frieren Sie mehr?');

    // WW1 – Marcumar
    if (stand.mittel.includes('marcumar') && n >= 0 && n <= 14) {
      add('WW1', 'zeitnah', 'Ihre Schilddrüsendosis wurde geändert. Weil Sie Marcumar (Phenprocoumon) nehmen, lassen Sie den INR-Wert in den nächsten 1 bis 2 Wochen kontrollieren. Achten Sie auf ungewöhnliche blaue Flecken, Zahnfleisch- oder Nasenbluten.');
    }
    // WW2 – Diabetes
    if (hatDiabetes(stand) && n >= 0 && n <= 42) {
      add('WW2', 'zeitnah', `Ihre Schilddrüsendosis wurde geändert. Messen Sie Ihren Blutzucker in den nächsten 6 Wochen öfter. Mehr Schilddrüsenhormon kann den Zucker erhöhen, weniger kann ihn senken.${weniger ? ' Achten Sie auf Unterzucker: Zittern, Schwitzen, Heißhunger, Verwirrtheit. Dann sofort etwas Zuckerhaltiges essen oder trinken und die Praxis informieren.' : ''}`);
    }
    // B2 / X3 (4) – nicht auf Anweisung der Praxis
    if (letzte.praxis === false && n >= 0 && n <= 14) {
      const schritt = tdNeu !== null && tdAlt !== null ? Math.abs(tdNeu - tdAlt) : 0;
      if (schritt > 25 || (tdAlt && schritt / tdAlt > 0.25)) {
        add('X3', 'tage', 'Das ist mehr als ein üblicher Schritt. Rufen Sie heute oder morgen die Praxis an und nehmen Sie bis dahin wieder Ihre bisherige Menge.', { warnzeichen: WD2 });
      } else {
        add('B2', 'tage', 'Bitte sagen Sie Ihrer Praxis in den nächsten Tagen, dass Sie die Dosis geändert haben. Lassen Sie nach 6 bis 8 Wochen kontrollieren.');
      }
    }
    // P7 – anderes Präparat bei gleicher Menge
    if (vorige && tdNeu === tdAlt && (letzte.praeparat || '') !== (vorige.praeparat || '') && n >= 0 && n <= 14) {
      add('P7', 'termin', 'Sie haben ein anderes Präparat oder einen anderen Hersteller eingetragen. Auch das kann den Wert etwas verändern. Fragen Sie die Praxis, ob nach 6 bis 8 Wochen kontrolliert werden soll.');
    }
  }

  // E15 – Einnahmezeit verschoben
  const uhr = [...stand.uhrWechsel].reverse().find((u) => tageZwischen(u.am, heute) >= 0 && tageZwischen(u.am, heute) <= 14);
  if (uhr) {
    add('E15', 'termin', 'Sie haben die Uhrzeit Ihrer Tablette um mehr als drei Stunden verschoben. Manche Menschen nehmen die Tablette abends vor dem Schlafen, mindestens 3 Stunden nach der letzten Mahlzeit. Das ist möglich, aber nur nach Rücksprache mit der Praxis und dann jeden Tag gleich. Ein Wechsel der Uhrzeit kann den Wert verändern. Lassen Sie danach nach 6 bis 8 Wochen kontrollieren.');
  }
  return h;
}

/** Die zuletzt gezeigte Karte für den Arztbericht (B1 aus Regelwerk 2). */
export function dosisBerichtZeilen(stand, heute) {
  const k = dosisRichtung(stand, heute);
  if (!k) return [];
  const titel = k.frage ? `offene Frage – ${k.frage.text}` : k.titel;
  const z = [`Dosis-Karte der App vom ${kurz(heute)} zum Befund vom ${kurz(k.befund.datum)} (App): ${titel} Die App gibt nur eine Richtung, keine Dosis.`];
  k.gruende.forEach((g) => z.push(`  Grund ${g.id}: ${g.text}`));
  if (k.schritt && !k.frage) z.push(`  ${k.schritt}`);
  z.push(`  ${k.grundlage}`);
  return z;
}
