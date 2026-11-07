/*
 * Die Übersicht des Rückkanals (Nov. 2026) – für den Betreiber, nicht für die
 * Nutzerin. Eigenes kleines Modul neben uebersicht.html, nicht unter js/:
 * Dort steht jedes Modul im Vorrat des Service Workers (tests/test-sd-offline.mjs
 * prüft das), und die Übersicht gehört nicht dazu.
 *
 * Passwort eingeben, dann je Gerät eine Tabelle: Fassung (mit Vermerk, ob es
 * die aktuelle ist), Startbildschirm, Plattform, zuletzt geöffnet, seit wann,
 * an wie vielen Tagen, Einführung angezeigt. Darüber ein Hinweis, wenn die
 * Fassung alt ist oder die App seit über sieben Tagen nicht geöffnet wurde.
 *
 * Was vom Server kommt, ist fremder Text: Jeder kann mit dem öffentlichen
 * Schlüssel eine Zeile schreiben (sd_melde prüft zwar die Form, aber darauf
 * verlässt sich diese Seite nicht). Deshalb entsteht hier alles über
 * textContent, nie über innerHTML – ein „<img onerror=…>" in einer Zeile
 * bleibt Text (tests/test-sd-rueckkanal.mjs, wie die XSS-Fälle in
 * tests/test-admin.mjs).
 *
 * Das Passwort lebt nur in einer Variablen dieser Seite – nicht im
 * localStorage, nicht im sessionStorage. Neu laden heißt neu eingeben.
 */
import { APP_FASSUNG, rpc } from './js/rueckkanal.js';
import { heuteISO, istISO, tageZwischen, datumKurz } from './js/datum.js';

const $form = document.getElementById('anmelden');
const $pass = document.getElementById('pass');
const $fehler = document.getElementById('fehler');
const $liste = document.getElementById('liste');
const $stand = document.getElementById('stand');
const $geraete = document.getElementById('geraete');

let passwort = null;

try {
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.dataset.farbe = 'dunkel';
} catch { /* dann hell */ }

/*
 * Die aktuelle Fassung: VERSION aus sw.js, frisch vom Server – das ist, was
 * gerade ausgeliefert wird. Nur wenn das nicht geht, die Fassung, die diese
 * Seite selbst mitbringt.
 */
async function aktuelleFassung() {
  try {
    const res = await fetch('sw.js', { cache: 'no-store' });
    if (res.ok) {
      const m = (await res.text()).match(/const VERSION = '(v\d+)'/);
      if (m) return { fassung: m[1], quelle: 'sw.js' };
    }
  } catch { /* ohne Netz zu sw.js */ }
  return { fassung: APP_FASSUNG, quelle: 'dieser Seite' };
}

const nummer = (f) => {
  const m = typeof f === 'string' ? f.match(/^v(\d+)$/) : null;
  return m ? Number(m[1]) : null;
};

/** Fehlertext des Servers in einem Satz – PostgREST antwortet als JSON. */
async function grund(res) {
  let roh = '';
  try {
    roh = await res.text();
  } catch { /* leer */ }
  try {
    const j = JSON.parse(roh);
    return `${res.status}: ${j.message || j.error || roh}${j.code ? ` [${j.code}]` : ''}`.slice(0, 200);
  } catch {
    return `${res.status}: ${roh}`.slice(0, 200);
  }
}

/*
 * Die Liste holen. „nope" wirft nur admin_liste() bei falschem Passwort; ein
 * fehlendes Ausführungsrecht (permission denied) ist etwas anderes und soll
 * nicht wie ein Tippfehler aussehen (wie adminListe() in js/telemetry.js).
 */
async function laden(pass) {
  let res;
  try {
    res = await rpc('sd_admin_liste', { pass });
  } catch (e) {
    throw new Error(`Keine Verbindung (${e && e.message ? e.message : 'Netz'})`);
  }
  if (!res.ok) {
    const text = await grund(res);
    const falsch = /\bnope\b/.test(text) && !/permission denied/i.test(text);
    throw new Error(falsch ? 'Passwort falsch' : text);
  }
  const daten = await res.json();
  if (!Array.isArray(daten)) throw new Error('Unerwartete Antwort');
  return daten;
}

function el(tag, text, klasse) {
  const e = document.createElement(tag);
  if (text !== undefined && text !== null) e.textContent = String(text);
  if (klasse) e.className = klasse;
  return e;
}

const janein = (v) => (v === true ? 'ja' : v === false ? 'nein' : 'unbekannt');
const PLATTFORM = { ios: 'iPhone oder iPad', android: 'Android', andere: 'andere' };

function tagText(iso, heute) {
  if (!istISO(iso)) return iso ? String(iso) : 'unbekannt';
  const n = tageZwischen(iso, heute);
  const wann = n === 0 ? 'heute' : n === 1 ? 'gestern' : n > 1 ? `vor ${n} Tagen` : 'in der Zukunft';
  return `${datumKurz(iso)} (${wann})`;
}

function geraetKarte(g, aktuell, heute) {
  const karte = el('article', null, 'karte geraet');
  const id = typeof g.id === 'string' ? g.id : String(g.id ?? '');
  const hinweise = [];
  const f = nummer(g.fassung);
  const a = nummer(aktuell);
  let fassung = g.fassung === null || g.fassung === undefined ? 'unbekannt' : String(g.fassung);
  if (f !== null && a !== null && f === a) fassung += ' (aktuell)';
  else if (f !== null && a !== null && f > a) fassung += ` (neuer als ${aktuell})`;
  else {
    fassung += ` (nicht aktuell – aktuell ist ${aktuell})`;
    hinweise.push(`Alte Fassung ${g.fassung ?? '?'}: Die App lädt die neue beim nächsten Öffnen mit Netz. Kommt sie nicht, die App einmal schließen und wieder öffnen.`);
  }
  if (istISO(g.zuletzt)) {
    const n = tageZwischen(g.zuletzt, heute);
    if (n > 7) hinweise.push(`Seit ${n} Tagen nicht geöffnet.`);
  } else {
    hinweise.push('Kein gültiger Tag der letzten Öffnung.');
  }
  hinweise.forEach((h) => karte.append(el('p', `⚠ ${h}`, 'geraet-hinweis')));

  const tabelle = el('table');
  tabelle.append(el('caption', `Gerät ${id.slice(0, 8) || '?'}`));
  const koerper = el('tbody');
  const zeilen = [
    ['Fassung', fassung],
    ['Startbildschirm', janein(g.startbildschirm)],
    ['Plattform', Object.prototype.hasOwnProperty.call(PLATTFORM, g.plattform) ? PLATTFORM[g.plattform] : String(g.plattform ?? 'unbekannt')],
    ['Zuletzt geöffnet', tagText(g.zuletzt, heute)],
    ['Seit', istISO(g.erstmals) ? datumKurz(g.erstmals) : String(g.erstmals ?? 'unbekannt')],
    ['Tage genutzt', g.tage ?? 'unbekannt'],
    ['Einführung angezeigt', janein(g.einfuehrung)],
  ];
  zeilen.forEach(([name, wert]) => {
    const tr = el('tr');
    const th = el('th', name);
    th.scope = 'row';
    tr.append(th, el('td', wert));
    koerper.append(tr);
  });
  tabelle.append(koerper);
  karte.append(tabelle);
  karte.title = id;
  return karte;
}

async function zeigen() {
  $fehler.textContent = '';
  $stand.textContent = 'Wird geladen …';
  const [geraete, aktuell] = await Promise.all([laden(passwort), aktuelleFassung()]);
  const heute = heuteISO();
  $form.hidden = true;
  $liste.hidden = false;
  $geraete.replaceChildren(...geraete.map((g) => geraetKarte(g && typeof g === 'object' ? g : {}, aktuell.fassung, heute)));
  const n = geraete.length;
  $stand.textContent = `${n === 1 ? '1 Gerät' : `${n} Geräte`} · aktuelle Fassung ${aktuell.fassung} (laut ${aktuell.quelle}) · Stand ${datumKurz(heute)}`;
  if (!n) $geraete.append(el('p', 'Noch kein Gerät hat sich gemeldet.', 'gedaempft'));
}

$form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const pass = $pass.value;
  if (!pass) {
    $fehler.textContent = 'Bitte das Passwort eingeben.';
    return;
  }
  passwort = pass;
  try {
    await zeigen();
    $pass.value = '';
  } catch (fehler) {
    passwort = null;
    $stand.textContent = '';
    $fehler.textContent = fehler.message;
    $pass.focus();
  }
});

document.getElementById('neu').addEventListener('click', async () => {
  if (!passwort) return;
  try {
    await zeigen();
  } catch (fehler) {
    $stand.textContent = fehler.message;
  }
});

document.getElementById('abmelden').addEventListener('click', () => {
  passwort = null;
  $geraete.replaceChildren();
  $stand.textContent = '';
  $liste.hidden = true;
  $form.hidden = false;
  $pass.focus();
});
