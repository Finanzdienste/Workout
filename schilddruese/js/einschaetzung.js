/*
 * Einschätzung – die App ordnet ein, so weit das verantwortbar ist.
 *
 * Auf Wunsch: „Es soll wirklich so weit wie möglich auch Diagnose sein."
 * Deshalb liest die App ihre Daten jetzt nicht mehr nur vor, sondern sagt,
 * was sie bedeuten können: ob ein Wert im Bereich des Labors liegt, welches
 * Muster TSH und fT4 zusammen ergeben, wie dringend das ist, was in den
 * eigenen Daten eine Erklärung sein könnte, wozu die Beschwerden passen, und
 * was bei Warnzeichen zu tun ist.
 *
 * Die Grenze, die bleibt: keine Dosis. Die App sagt nie „nehmen Sie mehr"
 * oder „weniger" und rechnet keine Menge aus. Sie sagt, in welche Richtung
 * ein Muster deutet, und dass die Ärztin entscheidet – eine selbst geänderte
 * Dosis kann im Alter Vorhofflimmern oder Knochenschwund auslösen, und die
 * Ärztin kennt Herz, andere Medikamente und den persönlichen Zielbereich.
 *
 * Die Regeln stammen aus einem Regelwerk, das drei unabhängige Prüfer
 * (Endokrinologie, Labormedizin, Pharmazie/Patientensicherheit) gegengelesen
 * und ein „rotes Team" an Fallbeispielen durchgespielt hat. Siehe
 * schilddruese/README.md, Abschnitt „Einschätzung".
 *
 * Reine Rechnung, keine Anzeige: Die Ansichten holen sich hier Ergebnisse
 * und setzen sie in Text um. Dadurch lässt sich jede Regel im Test prüfen.
 */
import { tageWeiter, tageZwischen, zahlText } from './datum.js';
import * as sp from './speicher.js';

// ---------------------------------------------------------------- Labor

/**
 * Orientierungsbereiche für Werte ohne eingetragenen Bereich – deutlich als
 * solche gekennzeichnet. Einheiten klein geschrieben verglichen.
 */
export const ORIENTIERUNG = {
  tsh: { 'mu/l': [0.4, 4.0], 'µu/ml': [0.4, 4.0], 'miu/l': [0.4, 4.0], 'µiu/ml': [0.4, 4.0] },
  ft4: { 'pmol/l': [12, 22], 'ng/dl': [0.9, 1.7] },
  ft3: { 'pmol/l': [3.1, 6.8], 'pg/ml': [2.0, 4.4] },
};

/**
 * Ein Wert gegen seinen Bereich: { lage: 'unter'|'im'|'ueber', quelle:
 * 'labor'|'orientierung', von, bis } – oder null, wenn es keinen Bereich gibt.
 */
export function einordnen(key, w) {
  if (!w) return null;
  let von = w.von;
  let bis = w.bis;
  let quelle = 'labor';
  if (von === null || bis === null) {
    const o = (ORIENTIERUNG[key] || {})[(w.einheit || '').toLowerCase()];
    if (!o) return null;
    [von, bis] = o;
    quelle = 'orientierung';
  }
  const lage = w.wert < von ? 'unter' : w.wert > bis ? 'ueber' : 'im';
  return { lage, quelle, von, bis };
}

/** TSH in mU/l – die Schwellen für die Dringlichkeit gelten in dieser Einheit. */
function tshMU(w) {
  if (!w) return null;
  const e = (w.einheit || '').toLowerCase();
  return ['mu/l', 'µu/ml', 'miu/l', 'µiu/ml', 'uu/ml', 'uiu/ml'].includes(e) ? w.wert : null;
}

export const MUSTER = {
  a: { titel: 'Die Werte liegen im Bereich des Labors.', richtung: 'passend' },
  b: { titel: 'Muster: deutlich zu wenig Schilddrüsenhormon.', richtung: 'wenig' },
  c: { titel: 'Muster: eher etwas zu wenig Schilddrüsenhormon.', richtung: 'wenig' },
  d: { titel: 'Muster: zu viel Schilddrüsenhormon.', richtung: 'viel' },
  e: { titel: 'Muster: eher etwas zu viel Schilddrüsenhormon.', richtung: 'viel' },
  f: { titel: 'Ungewöhnliches Muster: TSH und fT4 sind beide erhöht.', richtung: 'unklar' },
  g: { titel: 'Ungewöhnliches Muster: fT4 ist niedrig, ohne dass TSH erhöht ist.', richtung: 'unklar' },
  h: { titel: 'fT4 liegt über dem Bereich, TSH im Bereich.', richtung: 'unklar' },
};

/** Das Muster eines Befunds aus TSH und fT4 – oder null ohne einordenbares TSH/fT4. */
export function muster(befund) {
  const t = einordnen('tsh', befund.tsh);
  const f = einordnen('ft4', befund.ft4);
  if (!t && !f) return null;
  const tl = t ? t.lage : null;
  const fl = f ? f.lage : null;
  if (tl === 'ueber' && fl === 'unter') return 'b';
  if (tl === 'ueber' && fl === 'ueber') return 'f';
  if (tl === 'ueber') return 'c';
  if (tl === 'unter' && fl === 'ueber') return 'd';
  if (fl === 'unter') return 'g';
  if (tl === 'unter') return 'e';
  if (fl === 'ueber') return 'h';
  return 'a';
}

export const STUFEN = {
  notruf: { rang: 4, text: 'Jetzt 112 anrufen.' },
  tage: { rang: 3, text: 'In den nächsten Tagen die Praxis anrufen – nicht bis zum nächsten Routinetermin warten.' },
  zeitnah: { rang: 2, text: 'Zeitnah mit der Praxis besprechen, innerhalb von ein bis zwei Wochen.' },
  termin: { rang: 1, text: 'Beim nächsten Termin ansprechen.' },
  keine: { rang: 0, text: 'Kein besonderer Anlass.' },
};

const hoeher = (a, b) => (STUFEN[a].rang >= STUFEN[b].rang ? a : b);

/*
 * Alles hier rechnet mit dem übergebenen Stand, nie mit dem gespeicherten:
 * So lässt sich jede Regel mit einem beliebigen Stand prüfen, und die Ansicht
 * zeigt genau das, was sie übergibt.
 */
const alterAm = (stand, tag) => (stand.profil.geburtsjahr ? Number(tag.slice(0, 4)) - stand.profil.geburtsjahr : null);
function dosisAmIn(stand, tag) {
  let d = null;
  for (const x of stand.dosen) if (x.ab <= tag) d = x;
  return d;
}

/**
 * Die ganze Einschätzung eines Befunds.
 *
 * @returns {{ muster, titel, richtung, werte, dringlichkeit, zusaetze: string[],
 *   erklaerungen: string[], verlauf: string|null, fragen: string[] } | null}
 */
export function befundEinschaetzen(befund, stand = sp.getStand()) {
  const code = muster(befund);
  if (!code) return null;
  const m = MUSTER[code];
  const alter = alterAm(stand, befund.datum);
  const tsh = tshMU(befund.tsh);
  const werte = sp.LABORWERTE.filter(([k]) => befund[k]).map(([k, name]) => ({ key: k, name, ...(einordnen(k, befund[k]) || {}), wert: befund[k] }));
  const zusaetze = [];
  const fragen = [];

  let dringlichkeit = { a: 'keine', b: 'zeitnah', c: 'termin', d: 'zeitnah', e: 'termin', f: 'zeitnah', g: 'zeitnah', h: 'termin' }[code];
  if (tsh !== null && (tsh > 10 || tsh < 0.1)) dringlichkeit = hoeher('tage', dringlichkeit);

  // Alter: etwas höheres TSH wird oft bewusst hingenommen; zu viel belastet Herz und Knochen.
  if (code === 'c' && alter !== null && alter >= 70 && tsh !== null && tsh <= (alter >= 80 ? 7 : 6)) {
    zusaetze.push('Im Alter wird ein etwas höherer TSH-Wert oft bewusst hingenommen – mit der Ärztin klären, welcher Zielbereich für Sie gilt.');
  }
  if ((code === 'd' || code === 'e') && ((alter !== null && alter >= 65) || stand.profil.herz === 'ja')) {
    zusaetze.push('Dauerhaft zu viel Hormon belastet gerade im Alter und bei Herzkrankheit Herz und Knochen – deshalb ansprechen, auch wenn Sie sich gut fühlen.');
    if (code === 'e') dringlichkeit = hoeher('zeitnah', dringlichkeit);
  }
  if (code === 'h') zusaetze.push('Das kommt häufig vor, wenn die Tablette kurz vor der Blutabnahme genommen wurde.');
  if (code === 'g') zusaetze.push('Das kann auf eine Störung der Hirnanhangdrüse oder eine Messstörung hindeuten und gehört ärztlich angesehen.');
  if (code === 'f') zusaetze.push('Das sieht man oft, wenn Tabletten eine Weile unregelmäßig genommen wurden und dann kurz vor der Abnahme wieder – auch Messstörungen kommen vor.');

  const erklaerungen = erklaerungenFuer(befund, code, stand);
  const verlauf = verlaufText(befund, stand);

  // Fragen für die Ärztin
  if (code === 'b' || code === 'c') fragen.push(`Mein TSH lag am ${kurz(befund.datum)} über dem Bereich – soll die Dosis angepasst oder erst noch einmal kontrolliert werden?`);
  if (code === 'd' || code === 'e') fragen.push(`Mein TSH lag am ${kurz(befund.datum)} unter dem Bereich – ist das für mich so gewollt, auch mit Blick auf Herz und Knochen?`);
  if (code === 'f' || code === 'g' || code === 'h') fragen.push(`Die Werte vom ${kurz(befund.datum)} passen nicht ins übliche Muster – sollten sie wiederholt werden?`);

  return { muster: code, titel: m.titel, richtung: m.richtung, werte, dringlichkeit, zusaetze, erklaerungen, verlauf, fragen };
}

const kurz = (iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

/** Was in den eigenen Daten eine Erklärung sein könnte. */
function erklaerungenFuer(befund, code, stand) {
  const e = [];
  const wenig = ['b', 'c', 'f'].includes(code);
  const viel = ['d', 'e', 'f', 'h'].includes(code);

  // Dosis oder Präparat in den 6 Wochen davor geändert
  const aenderung = stand.dosen.find((d, i) => i > 0 && d.ab <= befund.datum && tageZwischen(d.ab, befund.datum) < 42);
  if (aenderung && code !== 'a') e.push(`Die Dosis wurde am ${kurz(aenderung.ab)} geändert, weniger als sechs Wochen vor der Abnahme – der Wert hat sich womöglich noch nicht eingependelt.`);

  // Vergessene Tabletten in den 6 Wochen davor
  if (wenig) {
    let nicht = 0;
    let erfasst = 0;
    for (let i = 1; i <= 42; i++) {
      const tag = tageWeiter(befund.datum, -i);
      const x = stand.einnahmen[tag];
      if (x === null) { nicht++; erfasst++; } else if (x) erfasst++;
    }
    if (nicht >= 3 || (erfasst >= 14 && (erfasst - nicht) / erfasst < 0.9)) {
      e.push(`In den sechs Wochen vor der Abnahme war die Tablette an ${nicht} ${nicht === 1 ? 'Tag' : 'Tagen'} nicht genommen – vergessene Tabletten können TSH erhöhen.`);
    }
  }
  if (befund.vorAbnahme && viel) e.push('Die Tablette war vor der Abnahme genommen – fT4 kann dadurch höher ausfallen, TSH kaum.');
  if ((befund.biotin || stand.mittel.includes('biotin')) && (viel || code === 'a')) {
    e.push('Biotin verfälscht die Messung: TSH erscheint zu niedrig, fT4 zu hoch. Den Wert mit Vorsicht lesen und ansprechen, ob er ohne Biotin wiederholt werden soll.');
  }
  const aufnahme = ['ppi', 'kalzium', 'eisen', 'magnesium', 'antazida', 'soja', 'ballaststoffe', 'colestyramin', 'kaffee', 'sucralfat', 'multimineral']
    .filter((k) => stand.mittel.includes(k));
  if (wenig && aufnahme.length) {
    e.push(`${namen(aufnahme)} ${aufnahme.length === 1 ? 'kann' : 'können'} die Aufnahme der Tablette verringern und so TSH erhöhen – vor allem ohne genügend Abstand (siehe „Was braucht Abstand?").`);
  }
  if (wenig && stand.mittel.includes('oestrogen')) e.push('Östrogen kann den Bedarf an Schilddrüsenhormon erhöhen.');
  const direkt = ['amiodaron', 'jod'].filter((k) => stand.mittel.includes(k));
  if (code !== 'a' && direkt.length) e.push(`${namen(direkt)} ${direkt.length === 1 ? 'beeinflusst' : 'beeinflussen'} die Schilddrüse direkt – der Schilddrüsenpraxis sagen.`);

  // Andere Einheit als beim vorigen Befund
  const vorher = [...stand.labor].reverse().find((l) => l.datum < befund.datum && l.tsh);
  if (vorher && befund.tsh && (vorher.tsh.einheit || '').toLowerCase() !== (befund.tsh.einheit || '').toLowerCase()) {
    e.push('Andere Einheit als beim letzten Befund – die Werte nicht direkt vergleichen.');
  }
  return e;
}

function namen(keys) {
  const n = keys.map((k) => (sp.MITTEL.find(([m]) => m === k) || [k, k])[1].replace(/ \(.*\)$/, ''));
  return n.length > 1 ? `${n.slice(0, -1).join(', ')} und ${n[n.length - 1]}` : n[0];
}

/** TSH im Vergleich zum vorigen Befund in derselben Einheit. */
function verlaufText(befund, stand) {
  if (!befund.tsh) return null;
  const vorher = [...stand.labor].reverse().find((l) => l.datum < befund.datum && l.tsh
    && (l.tsh.einheit || '').toLowerCase() === (befund.tsh.einheit || '').toLowerCase());
  if (!vorher) return null;
  const a = vorher.tsh.wert;
  const b = befund.tsh.wert;
  const rel = a > 0 ? (b - a) / a : 0;
  const wort = rel > 0.25 ? 'gestiegen' : rel < -0.25 ? 'gesunken' : 'etwa gleich geblieben';
  const dA = sp.tagesdosis(dosisAmIn(stand, vorher.datum));
  const dB = sp.tagesdosis(dosisAmIn(stand, befund.datum));
  const dosis = dA !== null && dB !== null && dA !== dB
    ? ` Dazwischen wurde die Dosis von ${zahlText(dA, 1)} auf ${zahlText(dB, 1)} µg am Tag geändert.`
    : dA !== null && dA === dB ? ' Die Dosis war dazwischen gleich.' : '';
  return `TSH ist seit dem ${kurz(vorher.datum)} ${wort}: von ${zahlText(a)} auf ${zahlText(b)}.${dosis}`;
}

/** Der jüngste Befund mit Einschätzung – oder null. */
export function letzterBefund(stand = sp.getStand()) {
  for (let i = stand.labor.length - 1; i >= 0; i--) {
    const e = befundEinschaetzen(stand.labor[i], stand);
    if (e) return { befund: stand.labor[i], einschaetzung: e };
  }
  return null;
}

/** Kontrolle fällig? Text oder null. */
export function kontrolleFaellig(stand, heute) {
  if (!stand.dosen.length) return null;
  const letzter = stand.labor.length ? stand.labor[stand.labor.length - 1].datum : null;
  if (!letzter) return null;
  const tage = tageZwischen(letzter, heute);
  if (tage > 365) return `Der letzte Laborwert ist über ein Jahr alt (${kurz(letzter)}). Bei stabiler Einstellung wird etwa alle 6 bis 12 Monate kontrolliert – einen Termin ausmachen.`;
  return null;
}

// ---------------------------------------------------------------- Beschwerden

export const ZU_WENIG = ['muede', 'frieren', 'verstopfung', 'haut', 'stimmung', 'konzentration', 'schmerzen'];
export const ZU_VIEL = ['schwitzen', 'herz', 'durchfall', 'schlaf'];

/**
 * Wozu passen die Beschwerden der letzten 4 Wochen?
 * { richtung: 'wenig'|'viel'|null, wenig, viel, eintraege, text, abgleich }
 */
export function beschwerdenMuster(stand, heute) {
  const ab = tageWeiter(heute, -27);
  const eintraege = stand.befinden.filter((b) => b.datum >= ab && b.datum <= heute);
  let wenig = 0;
  let viel = 0;
  eintraege.forEach((b) => b.beschwerden.forEach((k) => {
    if (ZU_WENIG.includes(k)) wenig++;
    if (ZU_VIEL.includes(k)) viel++;
  }));
  let richtung = null;
  if (wenig >= 3 && wenig >= 2 * viel) richtung = 'wenig';
  else if (viel >= 3 && viel >= 2 * wenig) richtung = 'viel';
  const text = !eintraege.length ? null
    : richtung === 'wenig' ? 'Ihre Beschwerden der letzten vier Wochen passen eher zu zu wenig Schilddrüsenhormon.'
      : richtung === 'viel' ? 'Ihre Beschwerden der letzten vier Wochen passen eher zu zu viel Schilddrüsenhormon.'
        : (wenig + viel) ? 'Ihre Beschwerden der letzten vier Wochen ergeben kein klares Muster.' : 'In den letzten vier Wochen keine typischen Beschwerden eingetragen.';
  let abgleich = null;
  const letzter = letzterBefund(stand);
  if (richtung && letzter && tageZwischen(letzter.befund.datum, heute) <= 92) {
    const r = letzter.einschaetzung.richtung;
    if (r === richtung) abgleich = 'Das passt zum letzten Laborwert.';
    else if (r === 'passend') abgleich = 'Der letzte Laborwert lag im Bereich – dann sucht die Ärztin eher nach anderen Ursachen.';
    else abgleich = 'Das passt nicht zum letzten Laborwert – gut, das beim Termin anzusprechen.';
  }
  return { richtung, wenig, viel, eintraege: eintraege.length, text, abgleich };
}

// ---------------------------------------------------------------- Warnzeichen

export const WARN_NOTRUF = [
  ['brust', 'Schmerzen oder Engegefühl in der Brust'],
  ['herzrasen', 'Plötzlich starkes Herzrasen oder Herzstolpern mit Schwindel'],
  ['atem', 'Atemnot'],
  ['ohnmacht', 'Ohnmacht oder kurz weggetreten'],
  ['laehmung', 'Plötzliche Lähmung einer Seite, hängender Mundwinkel oder Sprachstörung'],
  ['verwirrt', 'Extreme Schläfrigkeit, Verwirrtheit, sehr kalt und langsamer Atem'],
];
export const WARN_PRAXIS = [
  ['unruhe', 'Seit Tagen Herzklopfen, Zittern oder innere Unruhe'],
  ['durchfall', 'Mehrere Tage Durchfall oder Erbrechen'],
  ['ueberdosis', 'Versehentlich mehrere Tabletten zu viel genommen'],
  ['abnahme', 'Ungewollt abgenommen'],
  ['muede', 'Seit Wochen neue, starke Müdigkeit oder Frieren'],
];

/** Auswertung des Warnzeichen-Checks: { stufe: 'notruf'|'tage'|'termin', grund: string[] } */
export function warnzeichenAuswerten(antworten) {
  const ja = (liste) => liste.filter(([k]) => antworten.includes(k)).map(([, t]) => t);
  const notruf = ja(WARN_NOTRUF);
  if (notruf.length) return { stufe: 'notruf', grund: notruf };
  const praxis = ja(WARN_PRAXIS);
  if (praxis.length) return { stufe: 'tage', grund: praxis };
  return { stufe: 'termin', grund: [] };
}

// ---------------------------------------------------------------- Abstand

const ABSTAND = {
  kalzium: 240, eisen: 240, magnesium: 240, multimineral: 240, antazida: 240, sucralfat: 240, soja: 240, ballaststoffe: 240,
  colestyramin: 300,
  kaffee: 60,
};

const HINWEIS = {
  ppi: 'Kein zeitlicher Abstand hilft – wichtig ist, dass die Ärztin davon weiß. Beim Beginnen oder Absetzen die Werte kontrollieren lassen. Den Magenschutz nicht wegen der Schilddrüse selbst absetzen.',
  oestrogen: 'Kann den Bedarf erhöhen. Beim Beginnen oder Absetzen die Werte kontrollieren lassen.',
  biotin: 'Verfälscht die Laborwerte: vor jeder Blutabnahme mindestens 3 Tage pausieren (hoch dosiert bis zu einer Woche) und der Praxis sagen.',
  marcumar: 'Nach jeder Dosisänderung der Schilddrüsentablette den INR-Wert früher kontrollieren lassen.',
  diabetes: 'Nach einer Dosisänderung der Schilddrüsentablette kann sich der Blutzucker ändern – öfter messen.',
  amiodaron: 'Beeinflusst die Schilddrüse direkt – mit der Schilddrüsenpraxis abstimmen.',
  jod: 'Große Mengen Jod können die Schilddrüse beeinflussen – nur nach Rücksprache.',
  bisphosphonat: 'Muss ebenfalls nüchtern genommen werden – nicht zusammen mit der Schilddrüsentablette. Mit der Ärztin klären, wie beides zeitlich getrennt wird.',
  selen: 'Ein Nutzen ist nicht belegt – nur nach Rücksprache.',
};

function plusMinuten(hhmm, min) {
  const [h, m] = hhmm.split(':').map(Number);
  const t = (h * 60 + m + min) % (24 * 60);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/**
 * Persönlicher Plan: je gewähltem Mittel { key, name, ab: 'HH:MM'|null, text }.
 * Frühstück, Kaffee, Milch stehen immer dabei.
 */
export function abstandPlan(stand) {
  const t = stand.einstellungen.erinnerung;
  const plan = [{
    key: 'fruehstueck', name: 'Frühstück, Milch, Saft', ab: plusMinuten(t, 30),
    text: `frühestens ${plusMinuten(t, 30)} Uhr, besser ab ${plusMinuten(t, 60)} Uhr`,
  }];
  stand.mittel.forEach((k) => {
    const name = (sp.MITTEL.find(([m]) => m === k) || [k, k])[1];
    if (ABSTAND[k]) {
      const ab = plusMinuten(t, ABSTAND[k]);
      const text = k === 'kaffee' ? `frühestens ${plusMinuten(t, 30)} Uhr, besser ab ${ab} Uhr`
        : k === 'colestyramin' ? `frühestens ${ab} Uhr (4 bis 5 Stunden nach der Tablette)`
          : `frühestens ${ab} Uhr (4 Stunden nach der Tablette)`;
      plan.push({ key: k, name, ab, text });
    } else if (HINWEIS[k]) {
      plan.push({ key: k, name, ab: null, text: HINWEIS[k] });
    }
  });
  return plan;
}

// ---------------------------------------------------------------- Gesamtbild

/** Fragen für die Ärztin aus allem zusammen – ohne Doppelungen. */
export function fragenVorschlaege(stand, heute) {
  const f = [];
  const letzter = letzterBefund(stand);
  if (letzter && tageZwischen(letzter.befund.datum, heute) <= 180) f.push(...letzter.einschaetzung.fragen);
  const b = beschwerdenMuster(stand, heute);
  if (b.richtung && (!letzter || letzter.einschaetzung.richtung === 'passend')) f.push('Können meine Beschwerden an der Schilddrüse liegen – oder woran sonst?');
  if (stand.mittel.includes('bisphosphonat')) f.push('Wie nehme ich das Knochenmittel und die Schilddrüsentablette, ohne dass sie sich stören?');
  if (stand.mittel.includes('biotin')) f.push('Soll ich Biotin vor der nächsten Blutabnahme pausieren?');
  return [...new Set(f)];
}

// ---------------------------------------------------------------- Dosisrichtung

/*
 * Ob der jüngste Befund eher für mehr, weniger oder gleich viel spricht.
 *
 * Ausdrücklicher Wunsch: „die app soll auch sagen ob man mehr oder weniger
 * nehmen soll". Sie sagt es – als Richtung mit den üblichen Schrittgrößen,
 * nicht als neue Tagesdosis, und mit dem Rat, vorher kurz die Praxis
 * anzurufen: Die neue Stärke braucht ohnehin ein Rezept, und nach jeder
 * Änderung wird nach 6 bis 8 Wochen kontrolliert.
 *
 * Keine Richtung, sondern „erst klären", wenn der Befund dafür nicht taugt:
 * kurz nach einer Änderung, nach vergessenen Tabletten, unter Biotin, bei
 * ungewöhnlichem Muster, zu altem Befund, Amiodaron oder TSH in fremder
 * Einheit. Genau dort würde eine Richtung am ehesten in die Irre führen.
 */
export function dosisRichtung(stand, heute) {
  const letzter = letzterBefund(stand);
  if (!letzter) return null;
  const { befund, einschaetzung: e } = letzter;
  const alter = alterAm(stand, befund.datum);
  const herz = stand.profil.herz === 'ja';
  const tsh = tshMU(befund.tsh);
  const gruende = [];

  if (tageZwischen(befund.datum, heute) > 183) gruende.push('Der letzte Befund ist älter als sechs Monate – für eine Aussage zur Dosis braucht es einen aktuellen.');
  if (tsh === null && befund.tsh) gruende.push('TSH steht in einer Einheit, für die die Regeln nicht gelten.');
  if (!befund.tsh) gruende.push('Für eine Aussage zur Dosis braucht es einen TSH-Wert.');
  if (['f', 'g', 'h'].includes(e.muster)) gruende.push('Das Muster ist ungewöhnlich – erst ärztlich klären, ob der Befund wiederholt werden soll.');
  const aenderung = stand.dosen.find((d, i) => i > 0 && d.ab <= befund.datum && tageZwischen(d.ab, befund.datum) < 42);
  if (aenderung) gruende.push('Die Dosis wurde weniger als sechs Wochen vor der Abnahme geändert – der Wert hat sich noch nicht eingependelt. Kontrolle etwa 6 bis 8 Wochen nach der Änderung.');
  let nicht = 0;
  for (let i = 1; i <= 42; i++) if (stand.einnahmen[tageWeiter(befund.datum, -i)] === null) nicht++;
  if (nicht >= 3 && ['b', 'c'].includes(e.muster)) gruende.push(`In den sechs Wochen davor wurde die Tablette an ${nicht} Tagen nicht genommen – erst einige Wochen regelmäßig nehmen, dann erneut messen.`);
  if (befund.biotin || stand.mittel.includes('biotin')) gruende.push('Biotin verfälscht TSH und fT4 – den Wert ohne Biotin wiederholen lassen.');
  if (stand.mittel.includes('amiodaron')) gruende.push('Unter Amiodaron gehört jede Dosisfrage in die Hand der Schilddrüsenpraxis.');

  if (gruende.length) return { richtung: 'klaeren', titel: 'Aus diesem Befund lässt sich nichts zur Dosis ableiten.', gruende, befund };

  const vorsichtig = herz || (alter !== null && alter >= 70);
  const schritte = vorsichtig ? 'nur in kleinen Schritten (12,5 µg) und ärztlich begleitet' : 'Üblich sind Schritte von 12,5 bis 25 µg am Tag.';
  let r;
  switch (e.muster) {
    case 'a': r = { richtung: 'gleich', titel: 'Der Wert spricht dafür, die Dosis so zu lassen.' }; break;
    case 'b': r = { richtung: 'mehr', titel: `Der Wert spricht deutlich für eine höhere Dosis${vorsichtig ? ' – ' : '. '}${schritte}` }; break;
    case 'c':
      if (alter !== null && alter >= 70 && tsh <= (alter >= 80 ? 7 : 6)) r = { richtung: 'gleich', titel: 'Der Wert spricht eher dafür, die Dosis so zu lassen – im Alter ist ein etwas höheres TSH oft so gewollt.' };
      else r = { richtung: 'mehr', titel: `Der Wert spricht für eine etwas höhere Dosis${vorsichtig ? ' – ' : '. '}${schritte}` };
      break;
    case 'd': r = { richtung: 'weniger', titel: `Der Wert spricht für eine niedrigere Dosis. ${vorsichtig ? 'Gerade im Alter oder bei Herzkrankheit bald ansprechen.' : 'Üblich sind Schritte von 12,5 bis 25 µg am Tag.'}` }; break;
    case 'e': r = { richtung: 'weniger', titel: `Der Wert spricht für eine etwas niedrigere Dosis. ${vorsichtig || (alter !== null && alter >= 65) ? 'Gerade im Alter belastet zu viel Hormon Herz und Knochen.' : 'Üblich sind Schritte von 12,5 bis 25 µg am Tag.'}` }; break;
    default: return null;
  }
  return {
    ...r,
    befund,
    gruende: [],
    rat: r.richtung === 'gleich'
      ? 'Beschwerden allein sind kein Grund, die Dosis zu ändern.'
      : 'Ändern Sie die Dosis erst nach einem kurzen Anruf in der Praxis – die neue Stärke braucht ohnehin ein Rezept, und die Ärztin legt die neue Menge fest. Nach jeder Änderung wird nach 6 bis 8 Wochen kontrolliert. Nie eine zweite Tablette „zum Ausgleich".',
  };
}
