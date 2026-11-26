/*
 * Uwes Werte aus Mahlzeit, nach Tagen – für die Karte „Mahlzeit“ (Meine Apps a4).
 *
 * Tobi, 26.11.2026: „Dachte wir haben bei Uwe jetzt eingestellt dass wir
 * seine Sachen tiefgehend sehen können“. Uwe ist einverstanden („Uwe meinte
 * ich kann all seine gesundheitsdaten haben“, 21.11.; mahlzeit/README.md
 * v10/v13). Die App schickt Gewicht, Blutzucker, HbA1c, Schlaf und Schritte
 * der letzten 60 Tage (mahlzeit_lesen), dazu je Tag die Zahlen des
 * Lebenszeichens (Einträge, Hafer, Sport). Was er isst, schickt sie nicht.
 *
 * Wie in Mahlzeit selbst: Werte werden gezeigt, nicht bewertet – keine Farbe,
 * kein „zu hoch“. Nur der Unterschied beim Gewicht steht da, als Zahl.
 *
 * Reine Funktionen; tests/test-apps.mjs prüft sie in Node.
 */
import { tagKopf } from './tagebuch.js';

const ZUCKER_WANN = { nuechtern: 'nüchtern', vor: 'vor dem Essen', nach: 'nach dem Essen', sonst: 'sonst' };
const NAME = { gewicht: 'Gewicht', zucker: 'Blutzucker', hba1c: 'HbA1c', schlaf: 'Schlaf', schritte: 'Schritte' };
const REIHE = ['gewicht', 'zucker', 'hba1c', 'schlaf', 'schritte'];

const liste = (x) => (Array.isArray(x) ? x : []);
const istTag = (t) => typeof t === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t);
const zahl = (x) => (Number.isFinite(Number(x)) ? Number(x) : null);

/** „124,6“ */
export function kommazahl(x, stellen = 1) {
  return Number(x).toLocaleString('de-DE', { maximumFractionDigits: stellen, minimumFractionDigits: 0 });
}

/** Minuten → „7 Std. 10 Min.“ */
function schlafText(min) {
  const m = Math.round(min);
  const std = Math.floor(m / 60);
  const rest = m % 60;
  if (!std) return `${rest} Min.`;
  return rest ? `${std} Std. ${rest} Min.` : `${std} Std.`;
}

/** Ein Wert als Text, ohne Namen: „124,6 kg“, „132 mg/dl um 07:40, nüchtern“. */
export function wertText(w) {
  const v = zahl(w.wert);
  if (v === null) return '';
  const uhr = w.quelle === 'uhr' || w.quelle === '⌚' ? ' ⌚' : '';
  switch (w.art) {
    case 'gewicht': return `${kommazahl(v)} kg`;
    case 'zucker': {
      const dazu = [w.uhr ? `um ${w.uhr}` : '', ZUCKER_WANN[w.wann] || ''].filter(Boolean).join(', ');
      return `${kommazahl(v, 0)} mg/dl${dazu ? ` ${dazu}` : ''}`;
    }
    case 'hba1c': return `${kommazahl(v)} %`;
    case 'schlaf': return `${schlafText(v)}${uhr}`;
    case 'schritte': return `${Math.round(v).toLocaleString('de-DE')}${uhr}`;
    default: return kommazahl(v);
  }
}

/**
 * Alle gültigen Werte eines Geräts. Was die Uhr direkt schickt (mahlzeit_uhr)
 * zählt nur, wenn die App für den Tag nicht schon einen Wert derselben Art hat.
 */
function alleWerte(eintrag) {
  const e = eintrag || {};
  const gut = (w) => w && istTag(w.tag) && NAME[w.art] && zahl(w.wert) !== null;
  const werte = liste(e.werte).filter(gut);
  const hat = new Set(werte.map((w) => `${w.tag}|${w.art}`));
  liste(e.uhr).filter(gut).forEach((u) => {
    if (!hat.has(`${u.tag}|${u.art}`)) werte.push({ ...u, quelle: 'uhr' });
  });
  return werte;
}

/**
 * Die Tage eines Geräts, neuester zuerst:
 *   [{ tag, kopf, werte: [„Gewicht 124,6 kg“, …], zahlen: „9 Einträge · Sport“ }]
 * `nutzung` sind die Zeilen aus apps_uebersicht().mahlzeit für dieses Gerät.
 * Was die Uhr direkt schickt (mahlzeit_uhr), zählt nur, wenn die App für den
 * Tag nicht schon einen Wert derselben Art hat.
 */
export function werteTage(eintrag, nutzung = []) {
  const tage = new Map();
  const tagVon = (iso) => {
    if (!tage.has(iso)) tage.set(iso, { tag: iso, kopf: tagKopf(iso), roh: [], zahlen: '' });
    return tage.get(iso);
  };
  alleWerte(eintrag).forEach((w) => tagVon(w.tag).roh.push(w));
  liste(nutzung).forEach((n) => {
    if (!n || !istTag(n.tag)) return;
    const teile = [];
    if (Number(n.essen) > 0) teile.push(`${n.essen} ${Number(n.essen) === 1 ? 'Eintrag' : 'Einträge'}`);
    if (Number(n.hafer) > 0) teile.push(`${n.hafer} × Hafer`);
    if (Number(n.sport) > 0) teile.push(`${n.sport} × Sport`);
    if (teile.length) tagVon(n.tag).zahlen = teile.join(' · ');
  });
  return [...tage.values()]
    .map((t) => ({
      tag: t.tag,
      kopf: t.kopf,
      zahlen: t.zahlen,
      werte: t.roh
        .sort((a, b) => REIHE.indexOf(a.art) - REIHE.indexOf(b.art) || String(a.uhr || '').localeCompare(String(b.uhr || '')))
        .map((w) => `${NAME[w.art]} ${wertText(w)}`),
    }))
    .sort((a, b) => b.tag.localeCompare(a.tag));
}

/**
 * Oben über den Tagen: der letzte Wert je Art, beim Gewicht dazu der
 * Unterschied zum ersten der 60 Tage – als Zahl, ohne Urteil.
 */
export function werteUeberblick(eintrag) {
  const alle = alleWerte(eintrag);
  const zeilen = [];
  REIHE.forEach((art) => {
    const reihe = alle.filter((w) => w.art === art).sort((a, b) => a.tag.localeCompare(b.tag) || String(a.uhr || '').localeCompare(String(b.uhr || '')));
    if (!reihe.length) return;
    const letzt = reihe[reihe.length - 1];
    const [, m, d] = letzt.tag.split('-');
    let z = `${NAME[art]} am ${Number(d)}.${Number(m)}.: ${wertText(letzt)}`;
    if (art === 'gewicht' && reihe.length > 1) {
      const erst = reihe[0];
      const diff = Math.round((zahl(letzt.wert) - zahl(erst.wert)) * 10) / 10;
      const [, m0, d0] = erst.tag.split('-');
      z += ` (seit ${Number(d0)}.${Number(m0)}.: ${diff > 0 ? '+' : diff < 0 ? '−' : '±'}${kommazahl(Math.abs(diff))} kg)`;
    }
    if (art === 'zucker' && reihe.length > 1) z += ` · ${reihe.length} Messungen`;
    zeilen.push(z);
  });
  return zeilen;
}
