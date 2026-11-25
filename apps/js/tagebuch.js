/*
 * Das Tagebuch aus Body Check, so wie Amy es teilt – nach Tagen, lesbar.
 *
 * Tobi, 25.11.2026: „Body Check schickt jetzt Amys Tagebuch nach Supabase,
 * sobald sie in der App zugestimmt hat. […] Zeig das in der Master-Übersicht
 * bei Body Check an, statt „zählt bewusst nichts“: wann zuletzt aktualisiert,
 * und Amys Einträge übersichtlich nach Tagen.“
 *
 * Geteilt wird nur nach „Ja, teilen“ in Body Check; die Frage dort sagt, dass
 * das ganze Tagebuch an Tobi geht („alle Einträge, Mittel, Werte und
 * Notizen“). „Teilen beenden“ löscht den Stand beim Server – dann steht hier
 * beim nächsten Laden nichts mehr.
 *
 * Reine Funktionen: aus `stand` (der Tagebuchstand wie in der Sicherung von
 * Body Check, siehe dort js/store.js) werden Tage mit Tageswerten und
 * Einträgen. Die Namen zu den Kennungen kommen aus bodycheck-woerter.js; eine
 * unbekannte Kennung steht da, wie sie ist.
 */
import { WOERTER } from './bodycheck-woerter.js';

const FRAGEN = WOERTER.fragen;
const PAUSE = { pause: 'Pause', geplant: 'geplant', vergessen: 'vergessen', beschwerden: 'wegen Beschwerden' };
const ZUM_ESSEN = { mit: 'mit/nach Essen', vor: 'kurz vor dem Essen', ohne: 'ohne Essen' };
const ART = {
  essen: 'Essen', beschwerde: 'Beschwerden', stuhl: 'Stuhlgang', medikament: 'Mittel',
  kopf: 'Kopfschmerz', notiz: 'Notiz', aktivitaet: 'Aktivität',
};
const WOCHENTAG = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

const istTag = (t) => typeof t === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t);
const text = (x) => (x === null || x === undefined ? '' : String(x).trim());
const liste = (x) => (Array.isArray(x) ? x : []);

/** „Mi 25.11.“ */
export function tagKopf(tag) {
  const [, m, d] = tag.split('-');
  return `${WOCHENTAG[new Date(`${tag}T12:00:00Z`).getUTCDay()]} ${Number(d)}.${Number(m)}.`;
}

function woerterbuch(stand) {
  const eigen = (xs) => Object.fromEntries(liste(xs).filter((x) => x && x.id).map((x) => [String(x.id), text(x.name)]));
  const zutat = { ...WOERTER.zutat, ...eigen(stand.eigeneAusloeser) };
  const aktivitaet = { ...WOERTER.aktivitaet, ...eigen(stand.eigeneAktivitaeten) };
  return (karte, id) => {
    const k = String(id ?? '');
    const quelle = karte === 'zutat' ? zutat : karte === 'aktivitaet' ? aktivitaet : WOERTER[karte];
    return (quelle && quelle[k]) || k;
  };
}

/** Die Zeile zu einem Eintrag, ohne Uhrzeit und Art. */
function eintragText(e, wort) {
  const teile = [];
  const dazu = (x) => { const t = text(x); if (t) teile.push(t); };
  switch (e.art) {
    case 'essen':
      dazu(e.was);
      liste(e.zutaten).forEach((z) => {
        const name = wort('zutat', z && z.id);
        const rolle = z && z.rolle && z.rolle !== 'haupt' ? ` (${wort('rolle', z.rolle)})` : '';
        dazu(`${name}${rolle}`);
      });
      if (e.portion && e.portion !== 'normal') dazu(`Portion ${wort('portion', e.portion)}`);
      if (e.auswaerts) dazu('auswärts');
      break;
    case 'beschwerde':
      dazu(liste(e.arten).map((a) => wort('beschwerde', a)).join(', '));
      if (Number.isFinite(e.staerke)) dazu(`Stärke ${e.staerke}/10`);
      if (e.stuhlbezug) dazu(wort('stuhlbezug', e.stuhlbezug));
      dazu(e.notiz);
      break;
    case 'stuhl':
      if (Number.isFinite(e.form)) dazu(`Typ ${e.form}: ${wort('bristol', e.form)}`);
      if (e.dringend) dazu('dringend');
      if (e.unvollstaendig) dazu('nicht vollständig');
      if (liste(e.warnzeichen).length) dazu(`Warnzeichen: ${liste(e.warnzeichen).map((w) => wort('warnzeichen', w)).join(', ')}`);
      break;
    case 'medikament':
      dazu([text(e.mittel), text(e.dosis)].filter(Boolean).join(' '));
      if (e.essen) dazu(ZUM_ESSEN[e.essen] || e.essen);
      if (e.form && e.form !== 'unbekannt') dazu(`Form ${e.form}`);
      break;
    case 'kopf':
      if (Number.isFinite(e.staerke)) dazu(`Stärke ${e.staerke}/10`);
      dazu(liste(e.kopfArten).map((a) => wort('kopfArt', a)).join(', '));
      if (e.dauer) dazu(wort('kopfDauer', e.dauer));
      if (e.verlauf) dazu(wort('kopfVerlauf', e.verlauf));
      if (e.mittelWirkung) dazu(`Mittel: ${wort('mittelWirkung', e.mittelWirkung)}`);
      break;
    case 'notiz':
      dazu(e.text);
      break;
    case 'aktivitaet':
      dazu(liste(e.aktivitaeten).map((a) => wort('aktivitaet', a)).join(', '));
      if (e.intensitaet) dazu(wort('intensitaet', e.intensitaet));
      dazu(e.notiz);
      break;
    default:
      dazu(e.text || e.notiz || e.was);
  }
  return teile.join(' · ');
}

/** „08:10“, bei einem Zeitknopf „morgens“. */
function zeitVon(e) {
  if (e.ungefaehr && e.tageszeit) return WOERTER.tageszeit[e.tageszeit] || e.tageszeit;
  return text(e.um);
}

/** Die Tageswerte als kurze Zeilen: „Stimmung: gut“, „Wasser: 6 Gläser“. */
function tagesWerte(tag) {
  if (!tag || typeof tag !== 'object') return [];
  const werte = [];
  FRAGEN.forEach((f) => {
    const v = tag[f.id];
    if (v === null || v === undefined || v === '') return;
    const w = Number.isInteger(v) && f.worte[v] !== undefined ? f.worte[v] : String(v);
    werte.push(`${f.name}: ${w}`);
  });
  if (tag.adhsPause) werte.push(`ADHS-Mittel: ${PAUSE[tag.adhsPause] || tag.adhsPause}`);
  if (Number(tag.wasser) > 0) werte.push(`Wasser: ${tag.wasser} ${Number(tag.wasser) === 1 ? 'Glas' : 'Gläser'}`);
  return werte;
}

/**
 * Aus einem Tagebuchstand die Tage, neuester zuerst:
 *   [{ tag, kopf, werte: [Text], notiz, eintraege: [{ zeit, art, text }] }]
 * Ein Tag steht da, wenn er Einträge oder Tageswerte hat.
 */
export function tagebuchTage(stand) {
  const s = stand && typeof stand === 'object' ? stand : {};
  const wort = woerterbuch(s);
  const tage = new Map();
  const tagVon = (iso) => {
    if (!tage.has(iso)) tage.set(iso, { tag: iso, kopf: tagKopf(iso), werte: [], notiz: '', eintraege: [] });
    return tage.get(iso);
  };
  liste(s.eintraege).forEach((e) => {
    if (!e || !istTag(e.am)) return;
    tagVon(e.am).eintraege.push({ zeit: zeitVon(e), art: ART[e.art] || text(e.art) || 'Eintrag', text: eintragText(e, wort), um: text(e.um) });
  });
  Object.entries(s.tage && typeof s.tage === 'object' ? s.tage : {}).forEach(([iso, t]) => {
    if (!istTag(iso)) return;
    const werte = tagesWerte(t);
    const notiz = text(t && t.notiz);
    if (!werte.length && !notiz) return;
    const tag = tagVon(iso);
    tag.werte = werte;
    tag.notiz = notiz;
  });
  return [...tage.values()]
    .map((t) => ({ ...t, eintraege: t.eintraege.sort((a, b) => (a.um || '99').localeCompare(b.um || '99')).map(({ um, ...rest }) => rest) }))
    .sort((a, b) => b.tag.localeCompare(a.tag));
}

/** Die regelmäßigen Mittel, als eine Zeile je Mittel. */
export function standardMittel(stand) {
  return liste(stand && stand.standardMittel)
    .map((m) => [text(m && m.mittel), text(m && m.dosis), m && m.tageszeit ? (WOERTER.tageszeit[m.tageszeit] || m.tageszeit) : ''].filter(Boolean).join(' '))
    .filter(Boolean);
}
