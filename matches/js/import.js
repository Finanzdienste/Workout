/*
 * Alles einlesen, was von außen hereinkommt.
 *
 * Zwei sehr verschiedene Sorten Datei landen hier, und der Unterschied bestimmt
 * die Erwartung an den jeweiligen Leser:
 *
 *   * **Die Datenauskunft nach Art. 15 DSGVO.** Selbst anfordern, ein paar Tage
 *     warten. Eine offizielle Schnittstelle hat keiner der drei Dienste, also
 *     ist das der einzige Weg, auf dem sie von sich aus etwas herausgeben. Was
 *     dabei *nicht* herauskommt: **Entfernungen, in keiner der drei.** Und
 *     meistens auch keine Namen – Tinder liefert Match-Kennungen und die
 *     Nachrichten, die man selbst geschickt hat, Hinge Zeitstempel und
 *     Gesprächsverläufe ohne Namen. Der Import daraus ist deshalb kein
 *     Selbstbedienungsladen, sondern ein Gerüst: Datum, Nachrichtenzahl, Stand.
 *   * **Das Mitgelesene.** Die Entfernung existiert ja – der Server schickt sie
 *     an die App, sonst stünde dort keine Zahl. Sie steht nur in keiner Datei,
 *     die man sich schicken lassen kann. matches/mitlesen.user.js (Browser,
 *     Tinder) und matches/android-lesen.py (Bildschirm des Telefons, Bumble und
 *     Hinge) sehen deshalb dort zu, wo sie ankommt, und legen sie in einer
 *     Datei ab, die `mitgelesen()` weiter unten liest.
 *
 * Was auf keinem der Wege dazukommt, trägt man im Formular nach.
 */

import { schluessel } from './geo.js';

/** Datum aus den verschiedenen Schreibweisen der Exporte auf YYYY-MM-DD. */
export function datumLesen(wert) {
  if (!wert) return null;
  if (typeof wert === 'number') {
    // Sekunden oder Millisekunden – beide kommen vor.
    const ms = wert > 1e11 ? wert : wert * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const text = String(wert).trim();
  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const deutsch = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (deutsch) {
    return `${deutsch[3]}-${String(deutsch[2]).padStart(2, '0')}-${String(deutsch[1]).padStart(2, '0')}`;
  }
  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/**
 * Einen Vornamen aus der eigenen ersten Nachricht raten.
 *
 * Klingt nach einem Kunstgriff, ist aber der einzige Ort, an dem der Name im
 * Tinder-Export überhaupt vorkommt: „Hey Anna, …" hat man selbst geschrieben,
 * und genau das steht in der Datei. Der geratene Name landet als Vorschlag in
 * der Zeile und ist als geraten gekennzeichnet – eine Vermutung, die sich als
 * Tatsache ausgibt, wäre hier besonders unangenehm.
 */
export function nameRaten(text) {
  if (!text) return null;
  const satz = String(text);
  const gruss = satz.match(/^\s*(?:hey+|hi+|hallo|hej|moin|servus|guten\s+(?:morgen|abend|tag)|na)[\s,!.]+/i);
  if (!gruss) return null;
  const rest = satz.slice(gruss[0].length);
  const wort = rest.match(/^([A-ZÄÖÜ][a-zäöüß]{2,15})/);
  if (!wort) return null;
  // Ein Name steht am Satzende oder vor einem Satzzeichen: „Hey Anna," oder
  // „hi Lena". Folgt dagegen gleich das nächste Wort („Moin! Schöne Bilder"),
  // war das Großgeschriebene keine Anrede, sondern der Satzanfang.
  const danach = rest.slice(wort[1].length).replace(/^\s+/, '');
  if (/^[A-Za-zÄÖÜäöüß]/.test(danach)) return null;
  const keineNamen = ['Guten', 'Schöne', 'Schönes', 'Danke', 'Sorry', 'Wow', 'Alles', 'Wie', 'Was'];
  return keineNamen.includes(wort[1]) ? null : wort[1];
}

/** Eine leere Zeile in der Form, die die Tabelle erwartet. */
function zeile(app, zusatz) {
  return {
    name: '', app, km: null, ort: '', lat: null, lon: null,
    matchAm: null, status: 'neu', notiz: '', nachrichten: 0,
    quelle: 'import', extern: null, geraten: false, ...zusatz,
  };
}

/* --- Tinder ---------------------------------------------------------- */

function tinder(daten) {
  const hinweise = [];
  const leute = [];
  const nachrichten = Array.isArray(daten.Messages) ? daten.Messages : [];

  for (const eintrag of nachrichten) {
    const liste = Array.isArray(eintrag.messages) ? eintrag.messages : [];
    const erste = liste[0];
    const geraten = nameRaten(erste && erste.message);
    leute.push(zeile('tinder', {
      name: geraten || '',
      geraten: Boolean(geraten),
      extern: eintrag.match_id || null,
      matchAm: datumLesen(erste && (erste.sent_date || erste.timestamp)),
      nachrichten: liste.length,
      notiz: erste && erste.message ? `Erste Nachricht: „${String(erste.message).slice(0, 80)}"` : '',
    }));
  }

  // Die Nutzungsübersicht zählt auch Matches, mit denen nie geschrieben wurde.
  // Die tauchen nirgends einzeln auf – sagen wir es lieber, als es zu verschweigen.
  const zaehlung = daten.Usage && daten.Usage.matches;
  if (zaehlung && typeof zaehlung === 'object') {
    const summe = Object.values(zaehlung).reduce((a, b) => a + (Number(b) || 0), 0);
    if (summe > leute.length) {
      hinweise.push(`Der Export zählt ${summe} Matches insgesamt, führt aber nur `
        + `${leute.length} mit Nachrichten einzeln auf. Stumme Matches stehen dort `
        + 'nur als Tagessumme und lassen sich nicht auseinanderhalten.');
    }
  }
  if (leute.length) {
    hinweise.push('Tinder legt weder Namen noch Entfernungen in die Auskunft. '
      + 'Namen sind, wo möglich, aus der eigenen ersten Nachricht geraten (grau markiert).');
  }
  return { app: 'tinder', leute, hinweise };
}

/* --- Hinge ----------------------------------------------------------- */

function hinge(daten) {
  const hinweise = [];
  const leute = [];
  const liste = Array.isArray(daten) ? daten : (Array.isArray(daten.matches) ? daten.matches : []);

  for (const eintrag of liste) {
    // Nur echte Matches, keine abgeschickten Likes ohne Gegenstück.
    const match = Array.isArray(eintrag.match) ? eintrag.match[0] : null;
    if (!match) continue;
    const chats = Array.isArray(eintrag.chats) ? eintrag.chats : [];
    const geraten = nameRaten(chats[0] && chats[0].body);
    const beendet = Array.isArray(eintrag.block) && eintrag.block.length;
    const getroffen = Array.isArray(eintrag.we_met) && eintrag.we_met.length;
    leute.push(zeile('hinge', {
      name: geraten || '',
      geraten: Boolean(geraten),
      matchAm: datumLesen(match.timestamp || match.match_timestamp),
      nachrichten: chats.length,
      status: beendet ? 'aus' : (getroffen ? 'date' : (chats.length ? 'geschrieben' : 'neu')),
      notiz: chats[0] && chats[0].body ? `Erste Nachricht: „${String(chats[0].body).slice(0, 80)}"` : '',
    }));
  }
  if (leute.length) {
    hinweise.push('Hinge nennt in der Auskunft keine Namen und keine Orte – '
      + 'Datum, Nachrichtenzahl und „getroffen"/„beendet" sind alles, was dort steht.');
  }
  return { app: 'hinge', leute, hinweise };
}

/* --- Bumble ---------------------------------------------------------- */

/** Ein CSV-Leser, der Anführungszeichen und Zeilenumbrüche in Feldern aushält. */
export function csvLesen(text) {
  const zeilen = [];
  let feld = '';
  let satz = [];
  let inAnfuehrung = false;
  const roh = String(text).replace(/\r\n?/g, '\n');
  for (let i = 0; i < roh.length; i++) {
    const z = roh[i];
    if (inAnfuehrung) {
      if (z === '"') {
        if (roh[i + 1] === '"') { feld += '"'; i++; } else inAnfuehrung = false;
      } else feld += z;
      continue;
    }
    if (z === '"') inAnfuehrung = true;
    else if (z === ',' || z === ';' || z === '\t') { satz.push(feld); feld = ''; }
    else if (z === '\n') { satz.push(feld); zeilen.push(satz); satz = []; feld = ''; }
    else feld += z;
  }
  if (feld || satz.length) { satz.push(feld); zeilen.push(satz); }
  return zeilen.filter((s) => s.some((f) => f.trim() !== ''));
}

/** Die erste Spalte, deren Überschrift zu einem der Wörter passt. */
function spalte(kopf, woerter) {
  const i = kopf.findIndex((h) => woerter.some((w) => schluessel(h).includes(w)));
  return i < 0 ? null : i;
}

function bumble(daten, roh) {
  const hinweise = [];
  const leute = [];

  // Bumble liefert je nach Zeitpunkt und Land mal JSON, mal CSV, mal HTML. Statt
  // ein Format zu behaupten, wird hier nach Feldern gesucht, die es alle haben.
  if (Array.isArray(daten)) {
    const nachName = new Map();
    for (const e of daten) {
      const name = e.name || e.other_user_name || e.match_name || e.partner || '';
      const wann = e.match_date || e.matched_at || e.date || e.timestamp || e.created;
      const kennung = schluessel(name) || String(e.id || e.conversation_id || Math.random());
      const vorhanden = nachName.get(kennung);
      if (vorhanden) { vorhanden.nachrichten++; continue; }
      nachName.set(kennung, zeile('bumble', {
        name: String(name).trim(),
        matchAm: datumLesen(wann),
        nachrichten: 1,
        ort: String(e.city || e.location || '').trim(),
      }));
    }
    leute.push(...nachName.values());
  } else if (typeof roh === 'string' && roh.includes(',')) {
    const tabelle = csvLesen(roh);
    const kopf = tabelle[0] || [];
    const iName = spalte(kopf, ['name', 'partner', 'user']);
    const iDatum = spalte(kopf, ['date', 'datum', 'zeit', 'time']);
    const iOrt = spalte(kopf, ['city', 'stadt', 'ort', 'location']);
    if (iName === null) {
      hinweise.push('In dieser CSV steckt keine erkennbare Namensspalte – '
        + 'bitte als JSON versuchen oder die Zeilen von Hand anlegen.');
    } else {
      const nachName = new Map();
      for (const s of tabelle.slice(1)) {
        const name = (s[iName] || '').trim();
        if (!name) continue;
        const kennung = schluessel(name);
        const vorhanden = nachName.get(kennung);
        if (vorhanden) { vorhanden.nachrichten++; continue; }
        nachName.set(kennung, zeile('bumble', {
          name,
          matchAm: iDatum === null ? null : datumLesen(s[iDatum]),
          ort: iOrt === null ? '' : (s[iOrt] || '').trim(),
          nachrichten: 1,
        }));
      }
      leute.push(...nachName.values());
    }
  }
  if (leute.length) {
    hinweise.push('Bumbles Auskunft ist von Land zu Land verschieden aufgebaut. '
      + 'Wenn Zeilen fehlen: die Datei enthält vermutlich Felder, die hier noch '
      + 'niemand gesehen hat – Entfernungen sind in keiner Fassung dabei.');
  }
  return { app: 'bumble', leute, hinweise };
}

/* --- Mitgelesenes ----------------------------------------------------- */

const APPS_BEKANNT = new Set(['tinder', 'hinge', 'bumble', 'andere']);

/**
 * Die Datei aus matches/mitlesen.user.js oder matches/android-lesen.py.
 *
 * Das sind die beiden Wege, auf denen eine Entfernung *automatisch* in diese
 * Tabelle kommt: nicht aus der Datenauskunft – dort steht keine –, sondern aus
 * dem, was Tinder im Browser ohnehin lädt oder was bei Bumble und Hinge auf dem
 * Bildschirm des Telefons steht, während man durch seine Matches geht. Was
 * dabei zusammenkommt, hängt davon ab, wie weit man gekommen ist; die Zahl dazu
 * steht im Hinweis, damit niemand eine halbe Liste für die ganze hält.
 */
function mitgelesen(daten) {
  const hinweise = [];
  const liste = Array.isArray(daten.leute) ? daten.leute : [];
  const leute = liste.map((p) => zeile(APPS_BEKANNT.has(p.app) ? p.app : (daten.app || 'andere'), {
    name: String(p.name || '').trim(),
    km: Number.isFinite(Number(p.km)) && p.km !== null ? Number(p.km) : null,
    matchAm: datumLesen(p.matchAm),
    extern: p.extern || null,
    // „Weniger als 1 km" ist eine Obergrenze, kein Messwert. Die Zahl steht
    // trotzdem in der Spalte – sie stimmt ja als Schranke –, aber die Zeile
    // sagt dazu, dass die App sich hier nicht festgelegt hat.
    notiz: p.ungefaehr ? `Die App sagt „weniger als ${p.km} km" – genauer wird es nicht.` : '',
  }));

  const mitKm = leute.filter((p) => p.km !== null).length;
  hinweise.push(`${leute.length} Zeilen mitgelesen, davon ${mitKm} mit Entfernung.`
    + (mitKm < leute.length
      ? ' Die übrigen standen nur in der Liste, nicht im Profil – die Entfernung'
        + ' schickt der Dienst erst, wenn das Profil geöffnet wird.'
      : ''));
  if (daten.erzeugt) {
    hinweise.push(`Stand: ${String(daten.erzeugt).slice(0, 10)}. Entfernungen sind Momentaufnahmen –`
      + ' wer umzieht oder verreist, steht beim nächsten Mitlesen woanders.');
  }
  return { app: APPS_BEKANNT.has(daten.app) ? daten.app : 'tinder', leute, hinweise };
}

/* --- Erkennung ------------------------------------------------------- */

/** Woher stammt diese Datei? Am Inhalt erkannt, nicht am Dateinamen. */
export function appErkennen(daten, dateiname = '') {
  const n = schluessel(dateiname);
  // Die eigene Datei sagt selbst, was sie ist – vor jeder Rateroutine.
  if (daten && daten.format === 'matches-mitlesen/1') return 'mitlesen';
  if (daten && !Array.isArray(daten) && (daten.Messages || daten.Usage || daten.SpotifyTopArtists)) return 'tinder';
  if (Array.isArray(daten) && daten.some((e) => e && (e.match || e.like || e.chats))) return 'hinge';
  if (n.includes('tinder')) return 'tinder';
  if (n.includes('hinge')) return 'hinge';
  if (n.includes('bumble')) return 'bumble';
  return 'bumble';
}

/**
 * Eine Exportdatei einlesen.
 * @param {string} roh   Dateiinhalt
 * @param {string} name  Dateiname (nur als letzter Hinweis auf die App)
 */
export function einlesen(roh, name = '') {
  let daten = null;
  try { daten = JSON.parse(roh); } catch { /* dann eben CSV */ }
  const app = appErkennen(daten, name);
  const ergebnis = app === 'mitlesen' ? mitgelesen(daten)
    : app === 'tinder' ? tinder(daten || {})
      : app === 'hinge' ? hinge(daten || [])
        : bumble(daten, roh);
  if (!ergebnis.leute.length && !ergebnis.hinweise.length) {
    ergebnis.hinweise.push('Aus dieser Datei ließ sich keine einzige Zeile lesen. '
      + 'Bei Tinder ist es die data.json aus dem ZIP, bei Hinge die matches.json.');
  }
  return ergebnis;
}

/**
 * Neue Zeilen mit den vorhandenen zusammenführen – ohne Dubletten und ohne
 * Handarbeit zu überschreiben. Wer eine Entfernung eingetragen hat, soll sie
 * nach dem zweiten Import nicht wieder eintragen müssen.
 */
export function zusammenfuehren(vorhanden, neue) {
  const kennung = (p) => (p.extern ? `x:${p.app}:${p.extern}` : (schluessel(p.name) ? `n:${p.app}:${schluessel(p.name)}` : null));
  const bekannt = new Map();
  for (const p of vorhanden) {
    const k = kennung(p);
    if (k) bekannt.set(k, p);
  }
  let neu = 0;
  let ergaenzt = 0;
  const liste = [...vorhanden];
  for (const p of neue) {
    const k = kennung(p);
    const alt = k && bekannt.get(k);
    if (alt) {
      // Nur füllen, was leer ist. Das Eingetragene gewinnt immer.
      if (!alt.matchAm && p.matchAm) { alt.matchAm = p.matchAm; ergaenzt++; }
      if (!alt.nachrichten && p.nachrichten) { alt.nachrichten = p.nachrichten; }
      if (!alt.notiz && p.notiz) alt.notiz = p.notiz;
      continue;
    }
    liste.push(p);
    if (k) bekannt.set(k, p);
    neu++;
  }
  return { liste, neu, ergaenzt };
}
