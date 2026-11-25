/*
 * Meine Apps – die Seite.
 *
 * Holt mit einem Aufruf alles, was die Apps melden (apps_uebersicht in Tobis
 * Supabase-Projekt, tools/apps-uebersicht.sql), und zeigt je App, wer sie wann
 * benutzt hat. Das Passwort ist dasselbe wie für die Übersicht der
 * Workout-App.
 *
 * Offline zuerst: Der letzte Stand liegt im Speicher dieses Geräts und steht
 * sofort da – ohne Netz mit „Ohne Netz – Stand von …“. Sobald Netz da ist
 * (Ereignis `online`, Zurückkommen in die App, „Neu laden“), holt die Seite
 * von selbst nach. Es gibt nichts zu senden, also auch nichts vorzumerken.
 */
import { auswerten, zusammenfassung, dauer, datumKurz, tagAus, uhrAus, TAGE } from './modell.js';

export const FASSUNG = 'a1';

const SERVER = {
  url: 'https://vjyohppohmvhhxgwouti.supabase.co',
  // Öffentlich: Damit kommt man nur an Funktionen, und diese will ein Passwort.
  key: 'sb_publishable_wTUNShIKMFjCOmZzQuuN-A_vFHPkKUI',
};
const STAND = 'apps.stand.v1';
const PASS = 'apps.pass.v1';
const FRISCH_GENUG = 2 * 60 * 1000;

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const lesen = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const schreiben = (k, v) => {
  try {
    if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v));
  } catch { /* gesperrter Speicher: dann eben ohne Gedächtnis */ }
};

let laeuft = null;
let hinweis = '';

/* ------------------------------------------------------------------ *
 * Holen
 * ------------------------------------------------------------------ */

class FalschesPasswort extends Error {}

async function abrufen(pass) {
  const abbruch = new AbortController();
  const uhr = setTimeout(() => abbruch.abort(), 15000);
  try {
    const res = await fetch(`${SERVER.url}/rest/v1/rpc/apps_uebersicht`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SERVER.key },
      body: JSON.stringify({ pass }),
      signal: abbruch.signal,
      cache: 'no-store',
    });
    const text = await res.text();
    let daten = null;
    try { daten = JSON.parse(text); } catch { /* bleibt null */ }
    if (!res.ok) {
      if (daten && daten.message === 'nope') throw new FalschesPasswort('Falsches Passwort.');
      throw new Error(`Der Server antwortet nicht wie erwartet (${res.status}).`);
    }
    if (!daten || typeof daten !== 'object' || !daten.heute) throw new Error('Die Antwort ist unvollständig.');
    return daten;
  } finally {
    clearTimeout(uhr);
  }
}

/** Holt neu; `pass` nur beim Anmelden, sonst das gemerkte. */
function holen(pass) {
  const wort = pass || lesen(PASS);
  if (!wort) { zeichnen(); return Promise.resolve(); }
  if (laeuft) return laeuft;
  hinweis = 'Lädt …';
  zeichnen();
  laeuft = abrufen(wort)
    .then((daten) => {
      schreiben(PASS, wort);
      schreiben(STAND, { daten, geholt: Date.now() });
      hinweis = '';
    })
    .catch((e) => {
      if (e instanceof FalschesPasswort) {
        schreiben(PASS, null);
        hinweis = e.message;
      } else if (!navigator.onLine || e.name === 'AbortError' || e instanceof TypeError) {
        hinweis = 'ohne-netz';
      } else {
        hinweis = e.message || 'Hat nicht geklappt.';
      }
    })
    .finally(() => {
      laeuft = null;
      zeichnen();
    });
  return laeuft;
}

/* ------------------------------------------------------------------ *
 * Zeichnen
 * ------------------------------------------------------------------ */

function wannGeholt(geholt) {
  const tag = tagAus(new Date(geholt).toISOString());
  const heute = tagAus(new Date().toISOString());
  const uhr = uhrAus(new Date(geholt).toISOString());
  return tag === heute ? `heute ${uhr}` : `${datumKurz(tag)} ${uhr}`;
}

function streifen(app) {
  const kaestchen = app.streifen.map((t) => {
    const titel = `${datumKurz(t.tag)}${t.an ? `: benutzt${t.sekunden ? `, ${dauer(t.sekunden)}` : ''}` : ''}`;
    return `<i class="${t.an ? 'an' : ''}" title="${esc(titel)}"></i>`;
  }).join('');
  return `<div class="streifen" role="img" aria-label="${esc(`An ${app.aktiv} der letzten ${TAGE} Tage benutzt`)}">${kaestchen}</div>
    <div class="streifen-fuss"><span>vor 2 Wochen</span><span>heute</span></div>`;
}

function personZeile(p, nurZuletzt) {
  const teile = [p.wann];
  if (p.tage && !nurZuletzt) teile.push(`an ${p.tage} von ${TAGE} Tagen`);
  if (p.sekunden) teile.push(dauer(p.sekunden));
  teile.push(...p.notiz);
  return `<li><b>${esc(p.name)}</b> <span>${esc(teile.join(' · '))}</span></li>`;
}

function karte(app) {
  const symbol = app.pfad ? `<img class="symbol-bild" alt="" src="${esc(`${app.pfad}icon-192.png`)}">` : '';
  const kopf = `<header>
      <span class="symbol" style="--farbe:${esc(app.farbe)}" aria-hidden="true"><b>${esc(app.name[0])}</b>${symbol}</span>
      <h2>${esc(app.name)}</h2>
      <span class="pille">${esc(app.wann)}</span>
    </header>`;
  if (app.misstNichts) {
    return `<article class="app stufe-nichts" data-app="${esc(app.id)}">${kopf}<p class="leise">${esc(app.misstNichts)}</p></article>`;
  }
  const leute = app.leute.length ? `<ul class="leute">${app.leute.map((p) => personZeile(p, app.nurZuletzt)).join('')}</ul>` : '';
  const namen = [...new Set(app.weitere.map((p) => p.name))];
  const kurz = namen.length > 3 ? `${namen.slice(0, 3).join(', ')} und ${namen.length - 3} mehr` : namen.join(', ');
  const weitere = app.weitere.length
    ? `<details class="weitere"><summary>${esc(`${app.leute.length ? 'Weitere' : 'Früher'}: ${kurz}`)}</summary>
        <ul class="leute">${app.weitere.map((p) => `<li><b>${esc(p.name)}</b> <span>${esc(p.zuletzt ? `zuletzt am ${datumKurz(p.zuletzt)}` : 'noch nie')}${p.notiz.length ? esc(` · ${p.notiz.join(' · ')}`) : ''}</span></li>`).join('')}</ul>
      </details>`
    : '';
  const leer = !app.leute.length && !app.weitere.length ? `<p class="leise">${esc(app.leer || 'Noch nichts gemeldet.')}</p>` : '';
  const zeilen = app.zeilen.map((z) => `<p class="zeile">${esc(z)}</p>`).join('');
  const blind = app.blind ? `<p class="blind">${esc(app.blind)}</p>` : '';
  const oeffnen = app.pfad ? ` · <a href="${esc(app.pfad)}">Öffnen</a>` : '';
  return `<article class="app stufe-${esc(app.stufe)}" data-app="${esc(app.id)}">
      ${kopf}
      ${app.nurZuletzt ? '' : streifen(app)}
      ${leute}${leer}${weitere}${zeilen}${blind}
      <p class="quelle">Gemessen über ${esc(app.quelle)}${oeffnen}</p>
    </article>`;
}

function anmeldung() {
  const fehler = hinweis && hinweis !== 'Lädt …' && hinweis !== 'ohne-netz' ? hinweis : '';
  const offline = hinweis === 'ohne-netz' ? 'Zum ersten Öffnen braucht die Übersicht Netz.' : '';
  return `<form id="anmelden" class="karte" novalidate>
      <label class="feld"><span>Passwort</span>
        <input type="password" id="pass" name="pass" autocomplete="current-password" required>
        <span class="leise klein">Dasselbe wie für die Übersicht in der Workout-App. Es bleibt auf diesem Gerät.</span>
      </label>
      <button type="submit" class="knopf" ${hinweis === 'Lädt …' ? 'disabled' : ''}>${hinweis === 'Lädt …' ? 'Lädt …' : 'Öffnen'}</button>
      <p class="fehler" id="fehler" role="alert">${esc(fehler || offline)}</p>
    </form>`;
}

function zeichnen() {
  const stand = lesen(STAND);
  const angemeldet = !!lesen(PASS);
  const haupt = $('#inhalt');
  if (!stand || !stand.daten || (!angemeldet && hinweis !== 'Lädt …' && !laeuft)) {
    haupt.innerHTML = anmeldung();
    const form = $('#anmelden');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const wort = $('#pass').value.trim();
      if (wort) holen(wort);
    });
    return;
  }
  const heute = tagAus(new Date().toISOString());
  const apps = auswerten(stand.daten, heute);
  const { satz, still } = zusammenfassung(apps, heute);
  let standText = `Stand: ${wannGeholt(stand.geholt)}`;
  let standArt = '';
  if (hinweis === 'Lädt …') standText += ' · lädt …';
  else if (hinweis === 'ohne-netz') { standText = `Ohne Netz – Stand von ${wannGeholt(stand.geholt)}. Lädt von selbst, sobald Netz da ist.`; standArt = 'warn'; }
  else if (hinweis) { standText += ` · ${hinweis}`; standArt = 'warn'; }
  haupt.innerHTML = `
    <section class="kopf-karte">
      <p class="satz">${esc(satz)}</p>
      <p class="leise">${esc(still)}</p>
      <p id="stand" class="stand ${standArt}" aria-live="polite">${esc(standText)}</p>
      <div class="knoepfe">
        <button type="button" class="knopf klein" id="neu">Neu laden</button>
        <button type="button" class="knopf klein leise-knopf" id="abmelden">Abmelden</button>
      </div>
    </section>
    <section id="apps">${apps.map(karte).join('')}</section>
    <p class="leise klein fuss">Je App: wer sie an welchem der letzten ${TAGE} Tage benutzt hat. Grün bis 2 Tage, gelb bis 7, rot länger. „Tobi“ kommt vom Bildschirmzeit-Widget. Keine Werte, keine Einträge.</p>`;
  $('#neu').addEventListener('click', () => holen());
  $('#abmelden').addEventListener('click', () => {
    schreiben(PASS, null);
    schreiben(STAND, null);
    hinweis = '';
    zeichnen();
  });
  // Fehlt das Symbol einer App (nie gesehen, ohne Netz), bleibt der Buchstabe.
  document.querySelectorAll('.symbol-bild').forEach((img) => {
    const weg = () => img.remove();
    if (img.complete && !img.naturalWidth) weg(); else img.addEventListener('error', weg, { once: true });
  });
}

/* ------------------------------------------------------------------ *
 * Start
 * ------------------------------------------------------------------ */

function veraltet() {
  const stand = lesen(STAND);
  return !stand || !stand.geholt || Date.now() - stand.geholt > FRISCH_GENUG;
}

zeichnen();
holen();
window.addEventListener('online', () => holen());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && veraltet()) holen();
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => { /* ohne Worker eben ohne Vorrat */ });
}
