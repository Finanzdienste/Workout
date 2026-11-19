/*
 * Sport für Uwe – Übungen, Geräte, was heute dran ist. Ohne Seite prüfbar.
 *
 * Tobi, 17.11.2026: „Lass noch nen Sportmodus einbauen. Uwe brauch auch
 * bewerglichkeit und so. Können wir ja basierend auf meiner workout app
 * machen. Er soll auch eintragen können was er für Hanteln und Gewichte hat"
 * – dazu Fotos von Schwungstäben, einem Schwingstab, „und n wackelkissen",
 * „Hometrainer Fahrrad hat er auch" und: „er meint er ist sehr steif".
 *
 * Daraus: Beweglichkeit jeden Tag (zehn Minuten, sanft), Kraft und Ausdauer
 * zwei- oder dreimal die Woche mit dem, was er hat. Die Dehn- und
 * Mobilisierungsübungen und ihre Hinweise stammen aus der Workout-App
 * (js/injuries.js, CARE), die Hantelübungen aus ihrem Übungsvorrat – als
 * Kopie, damit eine Änderung an Tobis Plan Uwes App nicht verschiebt.
 */

export const GERAETE = [
  { id: 'hanteln', n: 'Kurzhanteln', z: '🏋️' },
  { id: 'rad', n: 'Heimtrainer (Fahrrad)', z: '🚲' },
  { id: 'schwungstaebe', n: 'Schwungstäbe', z: '〰️' },
  { id: 'schwingstab', n: 'Schwingstab', z: '🎋' },
  { id: 'wackelkissen', n: 'Wackelkissen', z: '🟢' },
  { id: 'matte', n: 'Gymnastikmatte', z: '🧘' },
  { id: 'studio', n: 'Fitnessstudio', z: '🏢' },
];

export const BESCHWERDEN = [
  { id: 'ruecken', n: 'Rücken' },
  { id: 'knie', n: 'Knie' },
  { id: 'schulter', n: 'Schulter' },
  { id: 'nacken', n: 'Nacken' },
  { id: 'huefte', n: 'Hüfte' },
];

/** Was sich an Hanteln eintragen lässt (je eine Hantel, kg). */
export const HANTEL_KG = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 15, 16, 18, 20];

/*
 * Eine Übung: n Name, a Art, d Dosis (sek: Dauer, je Seite verdoppelt;
 * saetze/wdh), je je Seite, g Gerät (null = ohne), z Zielgewicht in kg je
 * Hand für Hanteln (die App nimmt das nächste, das er hat), nicht bei
 * welchen Beschwerden sie wegfällt, statt Ersatz ohne das Gerät, t Hinweis.
 */
const U = (id, n, a, d, t, mehr = {}) => ({ id, n, a, d, t, je: false, g: null, nicht: [], ...mehr });

export const UEBUNGEN = [
  // --- Beweglichkeit (aus CARE der Workout-App, für Steife sanft dosiert)
  U('schulterkreisen', 'Schultern kreisen', 'mobil', { sek: 45 },
    'Große, langsame Kreise nach hinten. Klingt banal, löst aber genau die Stelle, die vom Sitzen verklebt.'),
  U('nackenSeite', 'Nacken seitlich dehnen', 'dehnen', { sek: 30 },
    'Ohr zur Schulter, die andere Hand greift die Sitzfläche und hält die Schulter unten. Kein Ziehen mit der Hand am Kopf.',
    { je: true }),
  U('brustdehnung', 'Brustdehnung im Türrahmen', 'dehnen', { sek: 30 },
    'Unterarm am Türrahmen, Ellenbogen auf Schulterhöhe, einen Schritt nach vorn. Zug vorn an der Brust, nicht in der Schulter. Ruhig atmen.',
    { je: true, nicht: ['schulter'] }),
  U('rumpfdrehen', 'Oberkörper drehen im Sitzen', 'mobil', { sek: 45 },
    'Aufrecht auf einem Stuhl, Arme vor der Brust verschränkt. Langsam nach rechts und links drehen, Becken bleibt sitzen. Jedes Mal ein kleines Stück weiter, nie mit Schwung.'),
  U('katzeKuh', 'Katze–Kuh', 'mobil', { sek: 60 },
    'Im Vierfüßlerstand die Wirbelsäule abschnittsweise runden und strecken, im Atemrhythmus. Ohne Kraft, ohne Endanschlag.',
    { g: 'matte', statt: 'katzeKuhStehend' }),
  U('katzeKuhStehend', 'Katze–Kuh im Stehen', 'mobil', { sek: 60 },
    'Hände auf die Oberschenkel, Knie leicht gebeugt. Rücken langsam rund machen, dann lang und gerade – im Atemrhythmus.'),
  U('hueftbeugerStehend', 'Hüftbeuger dehnen im Stehen', 'dehnen', { sek: 30 },
    'Großer Schritt nach vorn, an der Stuhllehne festhalten, hintere Ferse hoch. Becken nach vorn schieben und das Steißbein leicht einrollen. Zug vorn in der Leiste des hinteren Beins, nicht im Rücken.',
    { je: true }),
  U('beinbeugerDehnen', 'Beinbeuger dehnen', 'dehnen', { sek: 30 },
    'Ferse auf eine niedrige Stufe, Bein gestreckt, aus der Hüfte nach vorn kippen mit geradem Rücken. Kein Rundrücken – sonst zieht es an der falschen Stelle.',
    { je: true }),
  U('wadeGestreckt', 'Wade dehnen', 'dehnen', { sek: 30 },
    'Schrittstellung an der Wand, hinteres Bein gestreckt, Ferse am Boden.',
    { je: true }),
  U('piriformis', 'Gesäß dehnen (Vierer)', 'dehnen', { sek: 30 },
    'Rückenlage, Knöchel aufs andere Knie legen, das untere Bein zur Brust ziehen. Zug tief im Gesäß der oben liegenden Seite. Geht auch im Sitzen auf dem Stuhl.',
    { je: true, nicht: ['huefte'] }),
  U('schwingstabLocker', 'Schwingstab locker vor dem Körper', 'mobil', { sek: 30 },
    'Aufrecht stehen, Knie leicht gebeugt, Stab mit einer Hand in der Mitte, Arm vor dem Körper. Mit kleinen, schnellen Bewegungen in Schwung bringen – der Rumpf hält dagegen. Locker atmen.',
    { g: 'schwingstab', je: true }),

  // --- Aufwärmen und Ausdauer
  U('radLocker', 'Heimtrainer, locker', 'ausdauer', { sek: 300 },
    'Locker treten, so dass du dabei noch reden könntest. Zum Aufwärmen – nicht anstrengen.',
    { g: 'rad', statt: 'marschieren' }),
  U('marschieren', 'Auf der Stelle gehen', 'ausdauer', { sek: 180 },
    'Knie locker anheben, Arme mitschwingen. Zum Warmwerden – ruhig atmen.'),
  U('radIntervall', 'Heimtrainer, Intervalle', 'ausdauer', { sek: 600 },
    'Eine Minute zügig, eine Minute locker, im Wechsel. Zügig heißt: Reden geht nur noch in kurzen Sätzen.',
    { g: 'rad', statt: 'schwungstaebe' }),

  // --- Kraft (aus dem Übungsvorrat der Workout-App, einsteigertauglich)
  U('kniebeugeStuhl', 'Kniebeuge zum Stuhl', 'kraft', { saetze: 2, wdh: '10–12' },
    'Vor einen Stuhl stellen, Füße schulterbreit. Langsam absitzen, bis der Po den Stuhl berührt, nicht ablegen, wieder hoch. Knie zeigen in Richtung Zehen, Fersen bleiben am Boden.',
    { nicht: ['knie'], statt: null, mitHantel: 'gobletStuhl' }),
  U('gobletStuhl', 'Goblet-Kniebeuge zum Stuhl', 'kraft', { saetze: 2, wdh: '10–12' },
    'Eine Hantel senkrecht vor der Brust halten, die Ellenbogen zeigen nach unten. Absitzen bis zum Stuhl, wieder hoch. Das Gewicht vorn hilft, aufrecht zu bleiben.',
    { g: 'hanteln', z: 8, eine: true, nicht: ['knie'] }),
  U('wandLiegestuetz', 'Liegestütz an der Wand', 'kraft', { saetze: 2, wdh: '10–15' },
    'Hände schulterbreit an die Wand, Körper gerade wie ein Brett, Brust zur Wand und zurück. Je weiter die Füße weg sind, desto schwerer.',
    { nicht: ['schulter'] }),
  U('rudernKH', 'Rudern vorgebeugt mit Kurzhanteln', 'kraft', { saetze: 2, wdh: '10–12' },
    'Eine Hand auf der Stuhllehne, Oberkörper vorgebeugt, Rücken gerade. Die Hantel zur Hüfte ziehen, Ellenbogen nah am Körper, langsam ablassen.',
    { g: 'hanteln', z: 6, je: true, nicht: ['ruecken'], statt: 'schulterblatt' }),
  U('schulterblatt', 'Schulterblätter zusammenziehen', 'kraft', { saetze: 2, wdh: '15' },
    'Arme locker hängen lassen, nur die Schulterblätter nach hinten unten ziehen und zwei Sekunden halten. Die Arme machen nichts.'),
  U('schulterdrueckenKH', 'Schulterdrücken im Sitzen', 'kraft', { saetze: 2, wdh: '10–12' },
    'Aufrecht auf dem Stuhl, Hanteln auf Schulterhöhe. Nach oben drücken, ohne ins Hohlkreuz zu gehen, langsam zurück.',
    { g: 'hanteln', z: 4, nicht: ['schulter', 'nacken'] }),
  U('bizepsKH', 'Bizeps-Curls', 'kraft', { saetze: 2, wdh: '10–12' },
    'Aufrecht stehen, Ellenbogen am Körper. Hanteln langsam beugen und strecken, ohne Schwung aus dem Rücken.',
    { g: 'hanteln', z: 5 }),
  U('beckenheben', 'Beckenheben', 'kraft', { saetze: 2, wdh: '12' },
    'Rückenlage, Füße aufgestellt, Becken heben bis Knie–Hüfte–Schulter eine Linie bilden. Oben eine Sekunde die Pobacken fest zusammendrücken.',
    { g: 'matte', statt: 'wadenheben' }),
  U('wadenheben', 'Wadenheben', 'kraft', { saetze: 2, wdh: '15' },
    'An der Stuhllehne festhalten, langsam auf die Zehenspitzen und wieder ab.'),
  U('vogelhund', 'Bird Dog', 'kraft', { saetze: 2, wdh: '6 je Seite' },
    'Vierfüßlerstand, gegenüberliegenden Arm und Bein lang ausstrecken und 3 Sekunden halten. Becken bleibt waagerecht – ein Glas Wasser auf dem Kreuz dürfte nicht kippen.',
    { g: 'matte', statt: 'schwingstabRumpf' }),
  U('schwingstabRumpf', 'Schwingstab vor dem Körper', 'kraft', { sek: 30 },
    'Stab mit beiden Händen in der Mitte, Arme vor dem Körper. Kurze, schnelle Bewegungen, bis er schwingt. Bauch fest, Rücken gerade – die tiefen Rückenmuskeln arbeiten mit.',
    { g: 'schwingstab', nicht: ['schulter'] }),
  U('schwungstaebe', 'Schwungstäbe', 'ausdauer', { sek: 30, runden: 3, pause: 30 },
    'Leicht in die Knie, Rücken gerade, in jeder Hand einen Stab. Abwechselnd kräftig auf und ab schlagen, 30 Sekunden, dann 30 Sekunden Pause. Dreimal.',
    { g: 'schwungstaebe', nicht: ['schulter'] }),
  U('wackelkissenStand', 'Einbeinstand auf dem Wackelkissen', 'balance', { sek: 30 },
    'Ein Fuß mittig aufs Kissen, neben einer Stuhllehne zum Festhalten. Erst mit beiden Händen, dann mit einer, irgendwann ohne.',
    { g: 'wackelkissen', je: true, statt: 'einbeinstand' }),
  // --- Studio (v7): Maschinen geben den Gelenken Halt – Tobi, 19.11.: „Alles"
  // zu Uwes Plan (1× Studio an den Maschinen, 1× zu Hause, dazwischen Rad).
  U('ergometer', 'Fahrrad-Ergometer, locker', 'ausdauer', { sek: 360 },
    'Locker treten zum Aufwärmen, du solltest dabei noch reden können. Danach ein paar Mal die Arme kreisen.',
    { g: 'studio' }),
  U('beinpresse', 'Beinpresse', 'kraft', { saetze: 3, wdh: '10–12' },
    'Rücken fest ans Polster, Füße schulterbreit auf die Platte. Langsam beugen, bis die Knie etwa im rechten Winkel sind, dann wegdrücken – die Knie oben nicht ganz durchstrecken.',
    { g: 'studio', m: true }),
  U('brustpresse', 'Brustpresse', 'kraft', { saetze: 3, wdh: '10–12' },
    'Sitz so einstellen, dass die Griffe auf Brusthöhe sind. Schulterblätter nach hinten unten ziehen, Griffe nach vorn drücken, langsam zurück. Ellenbogen leicht unter Schulterhöhe.',
    { g: 'studio', m: true, nicht: ['schulter'] }),
  U('latzug', 'Latzug zur Brust', 'kraft', { saetze: 3, wdh: '10–12' },
    'Oberschenkel unter das Polster, Stange etwas breiter als schulterbreit. Brust raus, Stange zur oberen Brust ziehen, aus dem Rücken – ohne Schwung, langsam hoch.',
    { g: 'studio', m: true, nicht: ['schulter', 'nacken'], statt: 'ruderzug' }),
  U('ruderzug', 'Ruderzug am Kabel', 'kraft', { saetze: 3, wdh: '10–12' },
    'Aufrecht sitzen, Füße an der Platte, Knie leicht gebeugt. Griff zum Bauch ziehen, Ellenbogen nah am Körper, Schulterblätter zusammen. Langsam zurück, der Rücken bleibt gerade.',
    { g: 'studio', m: true }),
  U('beinbeugerMaschine', 'Beinbeuger sitzend', 'kraft', { saetze: 3, wdh: '12–15' },
    'Polster knapp über den Fersen, Oberschenkel fixiert. Fersen nach unten hinten ziehen, kurz halten, langsam zurück. Der Ausgleich zum vielen Sitzen.',
    { g: 'studio', m: true }),
  U('schulterMaschine', 'Schulterdrücken an der Maschine', 'kraft', { saetze: 2, wdh: '10–12' },
    'Rücken ans Polster, Griffe auf Schulterhöhe. Nach oben drücken, kontrolliert absenken, kein Hohlkreuz.',
    { g: 'studio', m: true, nicht: ['schulter', 'nacken'] }),
  U('einbeinstand', 'Einbeinstand', 'balance', { sek: 30 },
    'Neben einer Stuhllehne auf einem Bein stehen. Erst festhalten, dann loslassen.',
    { je: true }),
];

export const NACH_ID = new Map(UEBUNGEN.map((u) => [u.id, u]));

/** Die Beweglichkeit für jeden Tag: rund zehn Minuten, von oben nach unten. */
export const BEWEGLICH = ['schulterkreisen', 'nackenSeite', 'brustdehnung', 'rumpfdrehen', 'katzeKuh', 'hueftbeugerStehend', 'beinbeugerDehnen', 'wadeGestreckt', 'piriformis', 'schwingstabLocker'];

/** Kraft und Ausdauer: Aufwärmen, Kreis aus Kraftübungen, zum Schluss Ausdauer. */
/** Der Tag im Studio: Ergometer, dann die Maschinen (v7). */
export const STUDIO = ['ergometer', 'beinpresse', 'brustpresse', 'latzug', 'ruderzug', 'beinbeugerMaschine', 'schulterMaschine'];

export const KRAFT = ['radLocker', 'kniebeugeStuhl', 'wandLiegestuetz', 'rudernKH', 'schulterdrueckenKH', 'beckenheben', 'vogelhund', 'bizepsKH', 'wackelkissenStand', 'schwingstabRumpf', 'schwungstaebe', 'radIntervall'];

// --- Zusammenstellen -------------------------------------------------------

/**
 * Eine Übung für diese Geräte und Beschwerden: mit Hanteln die Hantelfassung
 * (mitHantel), fehlt das Gerät der Ersatz (statt) – oder gar nichts. Bei
 * einer Beschwerde, die sie nicht verträgt, fällt sie weg.
 */
export function waehle(id, { geraete = [], beschwerden = [] } = {}, tiefe = 0) {
  let u = NACH_ID.get(id);
  if (!u || tiefe > 3) return null;
  if (u.mitHantel && geraete.includes('hanteln')) {
    const h = NACH_ID.get(u.mitHantel);
    if (h && !h.nicht.some((b) => beschwerden.includes(b))) u = h;
  }
  if (u.g && !geraete.includes(u.g)) return u.statt ? waehle(u.statt, { geraete, beschwerden }, tiefe + 1) : null;
  if (u.nicht.some((b) => beschwerden.includes(b))) return u.statt ? waehle(u.statt, { geraete, beschwerden }, tiefe + 1) : null;
  return u;
}

/** Die Liste für eine Einheit („beweglich" oder „kraft"), ohne Doppelte. */
export function einheit(typ, profil) {
  const ids = typ === 'kraft' ? KRAFT : typ === 'studio' ? STUDIO : BEWEGLICH;
  const gesehen = new Set();
  const liste = [];
  ids.forEach((id) => {
    const u = waehle(id, profil);
    if (u && !gesehen.has(u.id)) {
      gesehen.add(u.id);
      liste.push(u);
    }
  });
  return liste;
}

/** Wie lange eine Übung ungefähr dauert, in Sekunden (für die Minutenangabe). */
export function dauer(u) {
  if (u.d.sek) {
    const runden = u.d.runden || 1;
    return (u.d.sek * runden + (u.d.pause || 0) * (runden - 1)) * (u.je ? 2 : 1) + 10;
  }
  return (u.d.saetze || 1) * (u.je ? 70 : 45) + 30;
}

export const minuten = (liste) => Math.max(1, Math.round(liste.reduce((s, u) => s + dauer(u), 0) / 60));

/** „2 × 10–12", „30 s je Seite", „3 × 30 s, 30 s Pause". */
export function dosis(u) {
  if (u.d.sek) {
    const zeit = u.d.sek >= 120 ? `${Math.round(u.d.sek / 60)} Minuten` : `${u.d.sek} s`;
    if (u.d.runden) return `${u.d.runden} × ${zeit}, ${u.d.pause} s Pause`;
    return `${zeit}${u.je ? ' je Seite' : ''}`;
  }
  return `${u.d.saetze} × ${u.d.wdh}${u.je && !/Seite/.test(u.d.wdh) ? ' je Seite' : ''}`;
}

// --- Gewichte --------------------------------------------------------------

/**
 * Welche Hantel für diese Übung: zuerst, was Uwe zuletzt genommen hat,
 * sonst die schwerste, die das Ziel nicht übersteigt (sonst die leichteste).
 */
export function gewichtFuer(u, hanteln = [], gemerkt = {}) {
  if (u.g !== 'hanteln' || !hanteln.length) return null;
  const da = [...hanteln].sort((a, b) => a - b);
  if (da.includes(gemerkt[u.id])) return gemerkt[u.id];
  const passend = da.filter((kg) => kg <= u.z);
  return passend.length ? passend[passend.length - 1] : da[0];
}

/** Nach „zu leicht" die nächstschwerere Hantel, nach „zu schwer" die nächstleichtere. */
export function naechstesGewicht(kg, hanteln, urteil) {
  const da = [...hanteln].sort((a, b) => a - b);
  const i = da.indexOf(kg);
  if (i < 0) return kg;
  if (urteil === 'leicht') return da[Math.min(da.length - 1, i + 1)];
  if (urteil === 'schwer') return da[Math.max(0, i - 1)];
  return kg;
}

// --- Was ist dran ----------------------------------------------------------

const zwei = (n) => String(n).padStart(2, '0');
const tagVon = (d) => `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`;
const plus = (tag, n) => { const d = new Date(`${tag}T12:00:00`); d.setDate(d.getDate() + n); return tagVon(d); };

/** Montag der Woche dieses Tages. */
export function wochenanfang(tag) {
  const d = new Date(`${tag}T12:00:00`);
  return plus(tag, -((d.getDay() + 6) % 7));
}

/**
 * Was heute dran ist. Beweglichkeit jeden Tag; Kraft, solange in dieser Woche
 * weniger gemacht wurde als gewünscht und nicht schon gestern oder heute –
 * zwischen zwei Krafteinheiten liegt ein Tag Pause.
 */
export function heuteDran(sport, heute) {
  const log = sport.log || [];
  const montag = wochenanfang(heute);
  const istKraft = (l) => l.art === 'kraft' || l.art === 'studio';
  const kraftWoche = log.filter((l) => istKraft(l) && l.tag >= montag && l.tag <= heute).length;
  const kraftZuletzt = log.filter(istKraft).map((l) => l.tag).sort().pop() || null;
  const beweglichHeute = log.some((l) => l.art === 'beweglich' && l.tag === heute);
  const kraftHeute = log.some((l) => istKraft(l) && l.tag === heute);
  // Mit Studio: einmal die Woche dorthin, die übrigen Male zu Hause.
  const studioWoche = log.some((l) => l.art === 'studio' && l.tag >= montag && l.tag <= heute);
  const vorschlag = (sport.geraete || []).includes('studio') && !studioWoche ? 'studio' : 'kraft';
  const pause = kraftZuletzt && kraftZuletzt >= plus(heute, -1);
  return {
    beweglich: !beweglichHeute,
    kraft: !kraftHeute && !pause && kraftWoche < (sport.kraftProWoche || 2),
    kraftWoche,
    beweglichHeute,
    kraftHeute,
    vorschlag,
    serie: serie(log, heute),
  };
}

/** Wie viele Tage am Stück Beweglichkeit gemacht wurde (heute zählt, wenn schon gemacht). */
export function serie(log, heute) {
  const tage = new Set(log.filter((l) => l.art === 'beweglich').map((l) => l.tag));
  let tag = tage.has(heute) ? heute : plus(heute, -1);
  let n = 0;
  while (tage.has(tag)) { n++; tag = plus(tag, -1); }
  return n;
}

/** Ungefähr verbrauchte kcal beim Radfahren (MET × kg × Stunden). Ohne Gewicht: null. */
export function radKcal(minuten, stufe, kg) {
  if (!(kg > 0) || !(minuten > 0)) return null;
  const met = { locker: 4, mittel: 6, zuegig: 8 }[stufe] || 5;
  return Math.round((met * kg * minuten) / 60);
}

export function sportOrdnen(roh) {
  const r = roh && typeof roh === 'object' ? roh : {};
  const geraete = Array.isArray(r.geraete) ? r.geraete.filter((g) => GERAETE.some((x) => x.id === g)) : [];
  const hanteln = Array.isArray(r.hanteln) ? [...new Set(r.hanteln.filter((kg) => Number.isFinite(kg) && kg > 0 && kg <= 60))].sort((a, b) => a - b) : [];
  const beschwerden = Array.isArray(r.beschwerden) ? r.beschwerden.filter((b) => BESCHWERDEN.some((x) => x.id === b)) : [];
  const gewichte = {};
  Object.entries(r.gewichte && typeof r.gewichte === 'object' ? r.gewichte : {}).forEach(([k, v]) => { if (Number.isFinite(v) && v > 0) gewichte[k] = v; });
  const log = Array.isArray(r.log) ? r.log.filter((l) => l && /^\d{4}-\d{2}-\d{2}$/.test(l.tag) && ['beweglich', 'kraft', 'studio', 'rad'].includes(l.art)) : [];
  return {
    eingerichtet: r.eingerichtet === true,
    geraete,
    hanteln,
    beschwerden,
    kraftProWoche: [2, 3].includes(r.kraftProWoche) ? r.kraftProWoche : 2,
    gewichte,
    log,
  };
}
