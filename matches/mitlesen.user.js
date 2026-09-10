// ==UserScript==
// @name         Matches mitlesen
// @namespace    workout-matches
// @version      1.0
// @description  Liest im eingeloggten Tinder-Tab mit, was die Seite ohnehin lädt, und legt daraus eine Datei für die Match-Tabelle an.
// @match        https://tinder.com/*
// @match        https://*.tinder.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

/*
 * Mitlesen, nicht abfragen.
 *
 * Wofür das reicht, gleich vorweg, damit niemand auf die anderen beiden
 * wartet: **Tinder, sonst nichts.** Bumble hat seine Webfassung am 8. August
 * 2026 abgeschaltet – bumble.com/get-started leitet seither auf eine Seite
 * „nicht verfügbar" um, und ohne Weboberfläche gibt es nichts mitzulesen.
 * Hinge hatte nie eine. Für beide bleibt nur das Eintippen von Hand oder ein
 * Eingriff auf dem Telefon selbst, und der kostet ein gerootetes Gerät und ein
 * ungleich größeres Sperrrisiko.
 *
 * Der Leser unten ist trotzdem bewusst nicht auf Tinder festgelegt: Er sucht
 * nach Gestalt, nicht nach Feldnamen. Käme Bumble zurück oder machte ein
 * anderer Dienst eine Weboberfläche auf, genügt eine @match-Zeile.
 *
 * Das ist der ganze Entwurf, und er steckt in dem einen Wort. Das Skript
 * schickt **keine einzige eigene Anfrage**. Es hängt sich vor `fetch` und
 * `XMLHttpRequest` und sieht sich an, was die Seite von sich aus holt, während
 * du durch deine Matches scrollst. Für den Server sieht das aus wie ein Mensch,
 * der durch seine Matches scrollt – weil genau das passiert.
 *
 * Der Unterschied ist nicht kosmetisch. Ein eigener Client, der die private
 * Schnittstelle selbst abfragt, erzeugt ein Anfragemuster, das kein echtes
 * Gerät erzeugt: gleichmäßige Abstände, keine Bilder, keine Tippgeräusche
 * dazwischen, hunderte Profilabrufe in zwei Minuten. Das ist genau das Muster,
 * auf das die Bot-Erkennung schaut, und das übliche Ende ist die Kontosperre.
 * Hier gibt es dieses Muster nicht, weil es keine eigenen Anfragen gibt.
 *
 * Trotzdem ehrlich dazugesagt: Automatisiertes Auslesen steht in den
 * Nutzungsbedingungen beider Dienste unter „nicht erlaubt", auch das passive.
 * Das Risiko ist klein, aber es ist nicht null, und es ist deins.
 *
 * Und: Nichts verlässt den Browser. Kein Server, kein Netz, keine Übertragung.
 * Was zusammenkommt, landet in einer Datei, die du selbst herunterlädst.
 */

(() => {
  'use strict';

  if (window.__matchesMitlesen) return;   // zweimal eingehängt zählt doppelt
  window.__matchesMitlesen = true;

  const APP = location.hostname.includes('bumble') ? 'bumble' : 'tinder';
  const MEILE = 1.609344;

  /** Was gefunden wurde, nach Kennung – dieselbe Person zweimal ist eine. */
  const leute = new Map();
  /** Die letzten Rohantworten. Nur für den Fall, dass die Ernte nichts findet. */
  const roh = [];
  const ROH_MAX = 40;

  /* --- Erkennen ------------------------------------------------------- */

  /*
   * Warum hier nicht nach festen Feldnamen gesucht wird:
   *
   * Beide Dienste haben private Schnittstellen ohne Zusage, wie sie morgen
   * aussehen. Ein Leser, der `person.distance_mi` erwartet, ist genau so lange
   * heil, bis jemand dort ein Feld umbenennt – und dann liefert er stumm eine
   * leere Liste, was schlimmer ist als ein Fehler. Deshalb wird die Antwort
   * durchgegangen und nach *Gestalt* gesucht: etwas mit einem Namen und einer
   * Entfernung ist eine Person, egal wie die Felder heißen.
   */

  const NAME_FELD = /^(name|first_?name|display_?name|user_?name)$/i;
  const ENTFERNUNG_FELD = /distance|entfernung|distanz/i;
  const DATUM_FELD = /(created|matched?)_?(date|at|time)?$|^match_time$/i;
  const ID_FELD = /^(_?id|user_?id|person_?id|conversation_?id)$/i;

  /** Aus „12 km entfernt", „5 miles away" oder einer nackten Zahl Kilometer machen. */
  function kilometer(wert, feldname) {
    if (wert === null || wert === undefined) return null;
    let zahl = null;
    let meilen = /_?mi$|miles?/i.test(feldname);
    if (typeof wert === 'number') {
      zahl = wert;
    } else if (typeof wert === 'string') {
      const m = wert.match(/(\d+(?:[.,]\d+)?)/);
      if (!m) return null;
      zahl = Number(m[1].replace(',', '.'));
      if (/\bmiles?\b|\bmi\b/i.test(wert)) meilen = true;
      if (/\bkm\b|kilomet/i.test(wert)) meilen = false;
    }
    if (!Number.isFinite(zahl) || zahl < 0 || zahl > 20000) return null;
    return meilen ? zahl * MEILE : zahl;
  }

  function datum(wert) {
    if (!wert) return null;
    const d = typeof wert === 'number'
      ? new Date(wert > 1e11 ? wert : wert * 1000)
      : new Date(String(wert));
    if (Number.isNaN(d.getTime())) return null;
    const jahr = d.getUTCFullYear();
    // Ein Zeitstempel aus dem Jahr 1970 oder 2153 ist keiner, sondern eine Zahl,
    // die zufällig durch new Date() gegangen ist.
    if (jahr < 2010 || jahr > new Date().getUTCFullYear() + 1) return null;
    return d.toISOString().slice(0, 10);
  }

  function sinnvollerName(wert) {
    if (typeof wert !== 'string') return null;
    const n = wert.trim();
    if (n.length < 2 || n.length > 40) return null;
    if (/^https?:|[<>{}]|@/.test(n)) return null;      // URLs, Markup, Mailadressen
    if (/^[0-9a-f]{16,}$/i.test(n)) return null;       // Kennungen
    return n;
  }

  /**
   * Ein Objekt daraufhin ansehen, ob es eine Person beschreibt.
   * Rückgabe: die Zeile für die Tabelle, oder null.
   */
  function eigenesDatum(o) {
    for (const [feld, wert] of Object.entries(o)) {
      if (DATUM_FELD.test(feld)) {
        const d = datum(wert);
        if (d) return d;
      }
    }
    return null;
  }

  function alsPerson(o, datumAusUmgebung = null) {
    let name = null;
    let km = null;
    let kennung = null;

    for (const [feld, wert] of Object.entries(o)) {
      if (!name && NAME_FELD.test(feld)) name = sinnvollerName(wert);
      if (km === null && ENTFERNUNG_FELD.test(feld)) km = kilometer(wert, feld);
      if (!kennung && ID_FELD.test(feld) && (typeof wert === 'string' || typeof wert === 'number')) {
        kennung = String(wert);
      }
    }
    if (!name) return null;

    const fotos = Object.entries(o).some(([f, w]) => /photo|image|picture/i.test(f)
      && (Array.isArray(w) || (w && typeof w === 'object')));
    // Ein Name allein macht noch keine Person: „name" steht auch an Filtern,
    // Einstellungen und Werbeflächen – und eine Werbefläche hat meistens auch
    // eine Kennung. Es braucht deshalb entweder eine Entfernung, die sonst
    // nichts hat, oder Bilder *und* eine Kennung, wie es jedes Profil hat.
    if (km === null && !(fotos && kennung)) return null;

    // Das Match-Datum steht nicht an der Person, sondern an dem Match, das sie
    // enthält. Deshalb reicht die Umgebung ihres nach unten durch.
    return {
      name, km, matchAm: eigenesDatum(o) || datumAusUmgebung,
      extern: kennung, app: APP, quelle: 'mitlesen',
    };
  }

  /** Die ganze Antwort durchgehen, in die Tiefe. */
  function ernten(knoten, tiefe = 0, datumAusUmgebung = null) {
    if (!knoten || typeof knoten !== 'object' || tiefe > 12) return;
    if (Array.isArray(knoten)) {
      for (const k of knoten) ernten(k, tiefe + 1, datumAusUmgebung);
      return;
    }
    const hier = eigenesDatum(knoten) || datumAusUmgebung;
    const person = alsPerson(knoten, datumAusUmgebung);
    if (person) {
      const schluessel = person.extern || person.name.toLowerCase();
      const alt = leute.get(schluessel);
      if (alt) {
        // Später Gesehenes darf ergänzen, aber nichts Bekanntes löschen: Die
        // Entfernung steht oft erst im Profil, nicht schon in der Liste.
        if (alt.km === null && person.km !== null) alt.km = person.km;
        if (!alt.matchAm && person.matchAm) alt.matchAm = person.matchAm;
        if (!alt.name && person.name) alt.name = person.name;
      } else {
        leute.set(schluessel, person);
      }
      anzeigen();
    }
    for (const wert of Object.values(knoten)) ernten(wert, tiefe + 1, hier);
  }

  function antwortLesen(text, url) {
    if (!text || text.length > 8e6) return;
    let daten;
    try { daten = JSON.parse(text); } catch { return; }
    roh.push({ url: String(url).slice(0, 300), daten });
    if (roh.length > ROH_MAX) roh.shift();
    ernten(daten);
  }

  /* --- Einhängen ------------------------------------------------------ */

  const echtesFetch = window.fetch;
  window.fetch = async function (...args) {
    const antwort = await echtesFetch.apply(this, args);
    // Auf einer Kopie lesen. Der Körper einer Antwort lässt sich genau einmal
    // auslesen – ohne clone() nähme man ihn der Seite weg, und die Match-Liste
    // bliebe leer. Ein Werkzeug, das die Seite kaputtmacht, die es beobachtet,
    // ist keins.
    try {
      antwort.clone().text().then((t) => antwortLesen(t, antwort.url)).catch(() => {});
    } catch { /* undurchsichtige Antworten lassen sich nicht kopieren */ }
    return antwort;
  };

  const echtesOeffnen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (methode, url, ...rest) {
    this.addEventListener('load', () => {
      try {
        if (!this.responseType || this.responseType === 'text') antwortLesen(this.responseText, url);
        else if (this.responseType === 'json') antwortLesen(JSON.stringify(this.response), url);
      } catch { /* egal */ }
    });
    return echtesOeffnen.call(this, methode, url, ...rest);
  };

  /* --- Anzeige -------------------------------------------------------- */

  let kasten = null;
  let zahl = null;

  function bauen() {
    if (kasten || !document.body) return;
    kasten = document.createElement('div');
    kasten.style.cssText = 'position:fixed;z-index:2147483647;right:16px;bottom:16px;'
      + 'background:#171a21;color:#e8eaed;border:1px solid #ff6fae;border-radius:14px;'
      + 'padding:10px 12px;font:14px -apple-system,system-ui,sans-serif;'
      + 'box-shadow:0 8px 24px #0008;display:flex;gap:8px;align-items:center';
    zahl = document.createElement('span');
    kasten.append(zahl);

    const knopf = (text, tun) => {
      const b = document.createElement('button');
      b.textContent = text;
      b.style.cssText = 'background:#ff6fae;color:#1a0d14;border:0;border-radius:9px;'
        + 'padding:6px 10px;font:inherit;font-weight:600;cursor:pointer';
      b.onclick = tun;
      kasten.append(b);
      return b;
    };
    knopf('Datei', () => herunterladen(
      `matches-${APP}-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify({
        format: 'matches-mitlesen/1',
        app: APP,
        erzeugt: new Date().toISOString(),
        leute: [...leute.values()],
      }, null, 1)));
    const b = knopf('Rohdaten', () => herunterladen(
      `matches-${APP}-rohdaten.json`, JSON.stringify(roh, null, 1)));
    b.style.background = 'transparent';
    b.style.color = '#9aa3b2';
    b.title = 'Nur nötig, wenn nichts gefunden wird: die letzten Antworten zum Nachsehen.';
    document.body.append(kasten);
  }

  function anzeigen() {
    bauen();
    if (!zahl) return;
    const mitKm = [...leute.values()].filter((p) => p.km !== null).length;
    zahl.textContent = `${leute.size} gefunden · ${mitKm} mit km`;
  }

  function herunterladen(name, inhalt) {
    const url = URL.createObjectURL(new Blob([inhalt], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (document.body) anzeigen();
  else document.addEventListener('DOMContentLoaded', anzeigen, { once: true });

  // Für die Prüfung von außen erreichbar – die Oberfläche nachzuspielen wäre
  // eine Prüfung des Kastens, nicht der Ernte.
  window.__matchesErnte = { leute, roh, ernten, alsPerson, kilometer };
})();
