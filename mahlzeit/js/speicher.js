/*
 * Der Speicher: alles in einem Schlüssel im localStorage dieses Handys.
 *
 * Im selben Ursprung (finanzdienste.github.io) liegen weitere Apps – Workout,
 * Schilddrüse, Boxenstopp –, und der localStorage gehört allen zusammen.
 * Deshalb fasst diese App nur Schlüssel an, die mit „mahlzeit." beginnen,
 * und „Alles löschen" ruft nie localStorage.clear() auf.
 *
 * Jede Änderung liest den Stand frisch, ändert ihn und schreibt ihn zurück.
 * So überschreibt ein zweiter offener Tab nicht, was im ersten eingetragen
 * wurde.
 */
import { ordnen } from './rechnen.js';

export const SCHLUESSEL = 'mahlzeit.stand.v1';

export function lesen() {
  try {
    const roh = localStorage.getItem(SCHLUESSEL);
    return ordnen(roh ? JSON.parse(roh) : null);
  } catch {
    return ordnen(null);
  }
}

export function schreiben(stand) {
  localStorage.setItem(SCHLUESSEL, JSON.stringify(stand));
}

let bitteBehalten = false;

/** Ändern: frisch lesen, `fn` darf den Stand verändern, danach speichern. */
export function aendern(fn) {
  const stand = lesen();
  fn(stand);
  schreiben(stand);
  if (!bitteBehalten && navigator.storage?.persist) {
    // Einmal darum bitten, dass der Browser die Einträge nicht von selbst
    // wegräumt, wenn das Handy voll wird. Ein Nein ändert nichts.
    bitteBehalten = true;
    navigator.storage.persist().catch(() => {});
  }
  return stand;
}

/** Nur die eigenen Schlüssel – die anderen Apps im Ursprung bleiben. */
export function allesLoeschen() {
  const eigene = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('mahlzeit.')) eigene.push(k);
  }
  eigene.forEach((k) => localStorage.removeItem(k));
}

/** Eine kurze, eindeutige Kennung für Einträge. */
export function neueId(vorsatz = 'e') {
  return `${vorsatz}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
