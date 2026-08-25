/*
 * Der Rückkanal.
 *
 * Die App ist ohne ihn vollständig: kein Konto, kein Server, alles im Browser.
 * Er beantwortet genau eine Frage, die von innen nicht zu beantworten ist – wie
 * die App bei den Leuten läuft, denen der Link geschickt wurde: Wer nutzt sie,
 * mit welchem Fokus, wie oft, welche Übungen.
 *
 * Drei Regeln, an denen sich das entscheidet:
 *
 *   Sichtbar.    Wer die App einrichtet, liest in einem Satz, was rausgeht und
 *                an wen, und hat den Schalter direkt daneben. Unter Mehr steht
 *                dasselbe noch einmal, mitsamt dem, was zuletzt geschickt wurde.
 *   Abschaltbar. Ein Tipp, und es geht nichts mehr raus – rückwirkend gelöscht
 *                wird auf Wunsch auch (loeschen()).
 *   Wenig.       Es geht nur, was in der App ohnehin auf dem Bildschirm steht:
 *                Name, Fokus, Erfahrung, Einheiten, Sätze, Volumen, letztes
 *                Training, Sätze je Übung. Keine Uhrzeiten, keine Adressen,
 *                keine Kennungen von außerhalb dieser App.
 *
 * Technisch ist es eine Supabase-Tabelle mit einer Zeile je Gerät (upsert auf
 * die zufällige Geräte-ID). Der anon-Schlüssel darf nur schreiben; gelesen wird
 * über eine Funktion mit Passwort, siehe README.
 */

import { CONFIG, hatServer } from './config.js';

const TABELLE = 'nutzung';

/** Zufällige Kennung dieses Geräts – ohne Bezug zu irgendetwas anderem. */
export function geraeteId(vorhanden) {
  if (vorhanden) return vorhanden;
  const zufall = crypto.randomUUID ? crypto.randomUUID()
    : `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return zufall;
}

function kopf() {
  return {
    'Content-Type': 'application/json',
    apikey: CONFIG.key,
    Authorization: `Bearer ${CONFIG.key}`,
  };
}

/**
 * Stand melden. Fehler sind hier keine Fehler: Kein Netz, Server weg, Tabelle
 * anders – die App darf davon nichts merken, sie ist ohne den Server vollständig.
 */
export async function melden(zeile) {
  if (!hatServer()) return false;
  try {
    const res = await fetch(`${CONFIG.url}/rest/v1/${TABELLE}`, {
      method: 'POST',
      headers: { ...kopf(), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([zeile]),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Eigene Zeile löschen – der Weg zurück, wenn jemand doch nicht mag. */
export async function loeschen(id) {
  if (!hatServer() || !id) return false;
  try {
    const res = await fetch(`${CONFIG.url}/rest/v1/${TABELLE}?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: kopf(),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Die Liste für den Betreiber.
 *
 * Läuft über eine Datenbankfunktion mit Passwort, nicht über einen zweiten
 * Schlüssel: Ein Schlüssel mit Leserecht müsste in der App liegen und damit bei
 * allen, die den Link haben. Das Passwort kennt nur, wer es eingibt.
 */
export async function adminListe(passwort) {
  if (!hatServer()) throw new Error('Kein Server eingetragen');
  const res = await fetch(`${CONFIG.url}/rest/v1/rpc/admin_liste`, {
    method: 'POST',
    headers: kopf(),
    body: JSON.stringify({ pass: passwort }),
  });
  if (!res.ok) throw new Error(res.status === 401 || res.status === 403 ? 'Passwort falsch' : `Fehler ${res.status}`);
  const daten = await res.json();
  if (!Array.isArray(daten)) throw new Error('Passwort falsch');
  return daten;
}
