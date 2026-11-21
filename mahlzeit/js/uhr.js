/*
 * Schlaf und Schritte von der Uhr (v10). Die Uhr gibt ihre Werte an Apple
 * Health, ein Kurzbefehl auf dem iPhone schickt sie an die Supabase-Funktion
 * mahlzeit-uhr, die App holt sie hier ab und trägt sie unter „Werte“ ein.
 *
 * Tobi, 21.11.2026: „Doch Uwe meinte ich kann all seine gesundheitsdaten
 * haben“ – „Ich kann das ja auch auf Uwes Handy einrichten. Er kann ja n Pop
 * up bekommen ‚an dieser Stelle muss Tobi was an deinem Handy einrichten‘“.
 *
 * Der Schlüssel steht im Stand (stand.uhr.k), damit er mit der Sicherung auf
 * ein neues Handy umzieht; wann zuletzt geholt wurde, in einem eigenen
 * Schlüssel. Von Hand Eingetragenes bleibt stehen – die Uhr ergänzt nur.
 */

export const UHR_ADRESSE = 'https://vjyohppohmvhhxgwouti.supabase.co/functions/v1/mahlzeit-uhr';
const ZULETZT = 'mahlzeit.uhr.v1';
export const ABSTAND = 10 * 60 * 1000;
const ARTEN = ['schlaf', 'schritte'];
const TAG = /^\d{4}-\d{2}-\d{2}$/;

export const senderAdresse = (k) => `${UHR_ADRESSE}?k=${k}`;

export function neuerSchluessel() {
  const zeichen = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(20)), (b) => zeichen[b % zeichen.length]).join('');
}

/** Werte von der Uhr in den Stand übernehmen. Gibt zurück, wie viele sich geändert haben. */
export function uebernehmen(stand, werte, neueId) {
  let geaendert = 0;
  for (const w of werte || []) {
    if (!ARTEN.includes(w?.art) || !TAG.test(w.tag || '') || !Number.isFinite(w.wert) || w.wert <= 0) continue;
    const da = stand.werte.find((x) => x.art === w.art && x.tag === w.tag);
    if (da && da.quelle !== 'uhr') continue;
    const wert = Math.round(w.wert);
    if (da) {
      if (da.wert !== wert) { da.wert = wert; geaendert++; }
    } else {
      stand.werte.push({ id: neueId(), art: w.art, tag: w.tag, wert, quelle: 'uhr' });
      geaendert++;
    }
  }
  return geaendert;
}

export function zuletztGeholt() {
  try { return JSON.parse(localStorage.getItem(ZULETZT) || 'null') || {}; } catch { return {}; }
}

function merken(daten) {
  try { localStorage.setItem(ZULETZT, JSON.stringify({ ...zuletztGeholt(), ...daten })); } catch { /* egal */ }
}

/**
 * Holt die Werte der letzten 14 Tage. `immer` holt auch, wenn es gerade erst
 * war (Knopf „Nachsehen“). Gibt { werte, zuletzt } zurück oder null; wirft nie.
 */
export async function holen(k, { heute, immer = false, jetzt = Date.now(), holen: abruf = (...a) => fetch(...a) } = {}) {
  if (!k) return null;
  if (!immer && jetzt - (zuletztGeholt().um || 0) < ABSTAND) return null;
  const seit = new Date(new Date(`${heute}T12:00:00`).getTime() - 14 * 86400000).toISOString().slice(0, 10);
  try {
    const res = await abruf(`${senderAdresse(k)}&seit=${seit}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const daten = await res.json();
    merken({ um: jetzt, angekommen: daten.zuletzt || null });
    return daten;
  } catch {
    return null;
  }
}
