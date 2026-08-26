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

function kopf(mitBearer = true) {
  const h = { 'Content-Type': 'application/json', apikey: CONFIG.key };
  // Die alten anon-Schlüssel sind JWTs und gehören zusätzlich in Authorization.
  // Die neuen (sb_publishable_…) sind es nicht – manche Projekte weisen sie dort
  // ab. Deshalb ist der Kopf abschaltbar: senden() versucht es dann ohne.
  if (mitBearer) h.Authorization = `Bearer ${CONFIG.key}`;
  return h;
}

/**
 * Eine Anfrage, zwei Versuche.
 *
 * Antwortet der Server mit "nicht erlaubt", kann das am Bearer-Kopf liegen
 * (siehe kopf()). Einmal ohne ihn nachfassen kostet nichts und erspart die
 * Fehlersuche im Blindflug.
 */
async function senden(pfad, optionen, mitBearer = true) {
  const res = await fetch(`${CONFIG.url}${pfad}`, {
    ...optionen,
    headers: { ...kopf(mitBearer), ...(optionen.headers || {}) },
  });
  if (!res.ok && mitBearer && (res.status === 401 || res.status === 403)) {
    return senden(pfad, optionen, false);
  }
  return res;
}

/** Die Fehlermeldung des Servers in einem Satz – PostgREST antwortet als JSON. */
async function grund(res) {
  try {
    const roh = await res.text();
    if (!roh) return `Fehler ${res.status}`;
    try {
      const j = JSON.parse(roh);
      return `${res.status}: ${j.message || j.msg || j.error || roh}`.slice(0, 160);
    } catch {
      return `${res.status}: ${roh}`.slice(0, 160);
    }
  } catch {
    return `Fehler ${res.status}`;
  }
}

/**
 * Stand melden. Fehler sind hier keine Fehler: Kein Netz, Server weg, Tabelle
 * anders – die App darf davon nichts merken, sie ist ohne den Server vollständig.
 *
 * Zurück kommt trotzdem, *warum* es nicht ging: { ok, status, msg }. Das steht
 * dann unter Mehr, sonst sucht man den Fehler auf der falschen Seite.
 */
export async function melden(zeile) {
  if (!hatServer()) return { ok: false, status: 0, msg: 'Kein Server eingetragen' };
  try {
    const res = await senden(`/rest/v1/${TABELLE}`, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([zeile]),
    });
    if (res.ok) return { ok: true, status: res.status, msg: '' };
    return { ok: false, status: res.status, msg: await grund(res) };
  } catch (e) {
    // fetch wirft nur bei Netz oder CORS – der Status bleibt unbekannt.
    return { ok: false, status: 0, msg: `Keine Verbindung (${e && e.message ? e.message : 'Netz oder CORS'})` };
  }
}

/** Eigene Zeile löschen – der Weg zurück, wenn jemand doch nicht mag. */
export async function loeschen(id) {
  if (!hatServer() || !id) return false;
  try {
    const res = await senden(`/rest/v1/${TABELLE}?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
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
  const res = await senden('/rest/v1/rpc/admin_liste', {
    method: 'POST',
    body: JSON.stringify({ pass: passwort }),
  });
  // 42501 ist der Code, den die Funktion bei falschem Passwort wirft; alles
  // andere (Funktion fehlt, Recht fehlt) soll nicht als "Passwort falsch"
  // durchgehen – sonst sucht man ewig am falschen Ende.
  if (!res.ok) {
    const text = await grund(res);
    throw new Error(/42501|nope/.test(text) ? 'Passwort falsch' : text);
  }
  const daten = await res.json();
  if (!Array.isArray(daten)) throw new Error('Passwort falsch');
  return daten;
}
