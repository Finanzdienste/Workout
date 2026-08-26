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
 * die zufällige Geräte-ID). Auf die Tabelle selbst hat der öffentliche Schlüssel
 * kein Recht: Geschrieben wird über die Funktion melde(), gelöscht über
 * entferne(), gelesen über admin_liste() mit Passwort – siehe README.
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

/**
 * Die alten anon-Schlüssel sind JWTs und gehören zusätzlich in den
 * Authorization-Kopf. Die neuen (sb_publishable_…) sind keine – dort ist der
 * Kopf bestenfalls wirkungslos, und ein Versuch damit verschleiert nur die
 * eigentliche Antwort.
 */
const istJwt = () => !/^sb_/.test(CONFIG.key);

function kopf(mitBearer = true) {
  const h = { 'Content-Type': 'application/json', apikey: CONFIG.key };
  if (mitBearer && istJwt()) h.Authorization = `Bearer ${CONFIG.key}`;
  return h;
}

/**
 * Eine Anfrage – und beim JWT-Schlüssel notfalls ein zweiter Versuch ohne den
 * Authorization-Kopf, falls das Projekt ihn abweist.
 */
async function senden(pfad, optionen, mitBearer = true) {
  const res = await fetch(`${CONFIG.url}${pfad}`, {
    ...optionen,
    headers: { ...kopf(mitBearer), ...(optionen.headers || {}) },
  });
  if (!res.ok && mitBearer && istJwt() && (res.status === 401 || res.status === 403)) {
    return senden(pfad, optionen, false);
  }
  return res;
}

/**
 * Die Fehlermeldung des Servers in einem Satz – PostgREST antwortet als JSON.
 *
 * Der `code` kommt mit: Er trennt auf einen Blick, wer geantwortet hat. PGRST…
 * ist PostgREST selbst (Funktion fehlt, Spalte fehlt), fünfstellige Ziffern
 * sind Postgres-Fehlercodes – 42501 etwa heißt "darf nicht".
 */
async function grund(res) {
  try {
    const roh = await res.text();
    if (!roh) return `Fehler ${res.status}`;
    try {
      const j = JSON.parse(roh);
      const text = j.message || j.msg || j.error || roh;
      return `${res.status}: ${text}${j.code ? ` [${j.code}]` : ''}`.slice(0, 200);
    } catch {
      return `${res.status}: ${roh}`.slice(0, 200);
    }
  } catch {
    return `Fehler ${res.status}`;
  }
}

/** Antwortet der Server "diese Funktion kenne ich nicht"? */
const fehltFunktion = (res, text) => res.status === 404
  || (res.status === 400 && /PGRST202|function|schema cache/i.test(text || ''));

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
    // Der Weg über die Funktion braucht keine Rechte auf der Tabelle – und
    // damit auch keine Regeln, die für die richtige Rolle greifen müssen.
    const res = await senden('/rest/v1/rpc/melde', {
      method: 'POST',
      body: JSON.stringify({ zeile }),
    });
    if (res.ok) return { ok: true, status: res.status, msg: '' };
    const msg = await grund(res);
    if (!fehltFunktion(res, msg)) return { ok: false, status: res.status, msg };

    // Ältere Einrichtung ohne die Funktion: direkt in die Tabelle, wie bisher.
    const alt = await senden(`/rest/v1/${TABELLE}`, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([zeile]),
    });
    if (alt.ok) return { ok: true, status: alt.status, msg: '' };
    // Beide Wege dicht: Dann gehört beides in die Meldung. Der Satz "melde
    // fehlt" allein führte sonst in die Irre, wenn die Tabelle den eigentlichen
    // Grund nennt – und umgekehrt.
    return { ok: false, status: alt.status, msg: `${msg} · direkt in die Tabelle: ${await grund(alt)}` };
  } catch (e) {
    // fetch wirft nur bei Netz oder CORS – der Status bleibt unbekannt.
    return { ok: false, status: 0, msg: `Keine Verbindung (${e && e.message ? e.message : 'Netz oder CORS'})` };
  }
}

/**
 * Eigene Zeile löschen – der Weg zurück, wenn jemand doch nicht mag.
 *
 * Auch das läuft über eine Funktion. Ein DELETE über die Tabelle meldet nämlich
 * auch dann Erfolg, wenn es null Zeilen getroffen hat – und "Gelöscht" wäre
 * dann gelogen.
 */
export async function loeschen(id) {
  if (!hatServer() || !id) return false;
  try {
    const res = await senden('/rest/v1/rpc/entferne', {
      method: 'POST',
      body: JSON.stringify({ geraet: id }),
    });
    if (res.ok) return true;
    if (!fehltFunktion(res, await grund(res))) return false;
    const alt = await senden(`/rest/v1/${TABELLE}?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return alt.ok;
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
