/*
 * Service Worker – macht die App ohne Netz benutzbar.
 *
 * Muss im Wurzelverzeichnis liegen: Der Geltungsbereich eines Service Workers
 * ist sein eigener Ordner, und von hier aus deckt er die gesamte App ab.
 *
 * Zwei Strategien, je nach Art der Anfrage:
 *
 *   Seitenaufrufe   erst Netz, bei Fehlschlag der Zwischenspeicher.
 *                   So ist eine neue Fassung sofort da, sobald Empfang
 *                   besteht, und im Keller ohne Netz startet sie trotzdem.
 *
 *   Alles andere    sofort aus dem Zwischenspeicher ausliefern und parallel
 *                   im Hintergrund erneuern. Der Start bleibt dadurch auch
 *                   bei schlechter Verbindung schnell; die Aktualisierung
 *                   greift beim nächsten Aufruf.
 *
 * VERSION bei jeder Änderung an den unten gelisteten Dateien hochzählen –
 * daran hängt das Aufräumen alter Zwischenspeicher.
 */

const VERSION = 'v172';
const CACHE = `workout-${VERSION}`;

const SHELL = [
  './',
  './index.html',
  // Die Übersicht aller Bewegungsbilder. Kein Teil der App, aber aus ihr
  // verlinkt – eine Seite, die offline ins Leere läuft, ist schlimmer als
  // keine Verlinkung.
  './figuren.html',
  './css/styles.css',
  './js/app.js',
  './js/audio.js',
  './js/config.js',
  './js/telemetry.js',
  './js/data.js',
  './js/body.js',
  './js/chart.js',
  './js/dates.js',
  './js/figure.js',
  './js/injuries.js',
  './js/ics.js',
  './js/store.js',
  './js/text.js',
  './js/uebung.js',
  './js/stufen.js',
  './js/scheiben.js',
  './js/anzeige.js',
  './js/ansicht-scheiben.js',
  './js/ansicht-kalender.js',
  './js/ansicht-vorrat.js',
  './js/ansicht-statistik.js',
  './js/gewichte.js',
  './js/supersatz.js',
  './js/vorrat.js',
  './js/muster.js',
  './js/plan.js',
  './js/bilanz.js',
  './js/erinnerung.js',
  './js/merkzettel.js',
  './icon.svg',
  './badge.svg',
  // Das kleine Symbol der Meldungen. Eigene Datei, weil Android den `badge`
  // als Schablone nimmt: nur der Alphakanal zaehlt, und icon-192.png ist
  // durchgehend deckend – in der Statusleiste stand ein weisser Kasten.
  './badge-96.png',
  // Der Rueckfall fuer die Statusleiste: Nimmt Android den `badge` nicht,
  // zeichnet es das App-Symbol als Schablone - und icon-192.png ist deckend,
  // also ein Kasten. Siehe icon-monochrome.svg.
  './icon-monochrome-512.png',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './manifest.webmanifest',
];

/**
 * Am Zwischenspeicher des Browsers vorbei laden.
 *
 * Das ist keine Feinheit: GitHub Pages schickt die Dateien mit einer
 * Haltbarkeit von zehn Minuten. Ein gewöhnliches fetch() bekommt dann die
 * *alte* Fassung aus dem Browser-Zwischenspeicher – und der Service Worker
 * legt sie als vermeintlich frisch in seinen eigenen. So kann eine neue
 * Fassung beliebig lange nicht ankommen, obwohl sie längst online steht.
 */
const fresh = (input) => fetch(new Request(input, { cache: 'reload' }));

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // Einzeln statt addAll: eine fehlende Datei darf nicht die gesamte
      // Installation scheitern lassen.
      .then((cache) => Promise.all(SHELL.map((url) => fresh(url)
        .then((res) => (res && res.ok ? cache.put(url, res) : null))
        .catch(() => null))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Nur im Zwischenspeicher dieser Fassung nachsehen. caches.match() ohne
  // Angabe durchsucht *alle* – ein übrig gebliebener alter Zwischenspeicher
  // würde dann weiter alte Dateien ausliefern.
  const cached = (req) => caches.open(CACHE).then((c) => c.match(req));

  if (request.mode === 'navigate') {
    event.respondWith(
      fresh(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => cached(request)
          .then((hit) => hit || cached('./index.html'))
          .then((hit) => hit || Response.error())),
    );
    return;
  }

  event.respondWith(
    cached(request).then((hit) => {
      const update = fresh(request)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || update;
    }),
  );
});

/* ------------------------------------------------------------------ *
 * Der Punkt am Symbol, waehrend die App zu ist
 *
 * Die App kann sich nicht selbst aufwecken. Was der Browser stattdessen
 * anbietet, ist `periodicsync`: Er weckt diesen Worker gelegentlich auf, wenn
 * die App installiert ist und regelmaessig benutzt wird.
 *
 * **Gelegentlich** ist woertlich zu nehmen. Wann und ob ueberhaupt, entscheidet
 * Chrome; das angegebene Intervall ist ein Wunsch, keine Zusage. Deshalb wird
 * hier nichts versprochen: Jeder Weckruf wird mit Zeitstempel im Merkzettel
 * vermerkt, und die App zeigt unter Mehr, wann es zuletzt geklappt hat. Steht
 * da nach einer Woche nichts, weiss man, dass der Weg nicht traegt. Schlimm ist
 * das nicht mehr: Frueher haette dann eine Meldung gefehlt, heute steht der
 * Punkt einen halben Tag laenger als noetig.
 *
 * Gerechnet wird hier absichtlich nichts. Welche Einheit ansteht und ob sie
 * schon gemacht ist, steht in js/erinnerung.js und ist dort geprueft. Hier
 * werden zwei Datumsangaben verglichen.
 * ------------------------------------------------------------------ */

const MERK_DB = 'workout.merk';
const MERK_LADEN = 'zettel';
const MERK_SCHLUESSEL = 'erinnerung';

// Dieselben paar Zeilen wie in js/merkzettel.js. Doppelt, weil es nicht anders
// geht: Dieser Worker ist ein klassisches Skript und kann kein ES-Modul laden.
// Die Alternative waere ein Modul-Worker – den kennt Firefox erst seit Kurzem,
// und dafuer die Offline-Faehigkeit aufs Spiel zu setzen, lohnt fuer 15 Zeilen
// nicht.
function merkOeffnen() {
  return new Promise((ok, fehler) => {
    const a = indexedDB.open(MERK_DB, 1);
    a.onupgradeneeded = () => {
      if (!a.result.objectStoreNames.contains(MERK_LADEN)) {
        a.result.createObjectStore(MERK_LADEN);
      }
    };
    a.onsuccess = () => ok(a.result);
    a.onerror = () => fehler(a.error);
  });
}

async function merkLesen() {
  try {
    const db = await merkOeffnen();
    return await new Promise((ok) => {
      const a = db.transaction(MERK_LADEN, 'readonly').objectStore(MERK_LADEN).get(MERK_SCHLUESSEL);
      a.onsuccess = () => ok(a.result || {});
      a.onerror = () => ok({});
    });
  } catch {
    return {};
  }
}

async function merkSchreiben(felder) {
  try {
    const alt = await merkLesen();
    const db = await merkOeffnen();
    await new Promise((ok) => {
      const a = db.transaction(MERK_LADEN, 'readwrite').objectStore(MERK_LADEN)
        .put({ ...alt, ...felder }, MERK_SCHLUESSEL);
      a.onsuccess = () => ok();
      a.onerror = () => ok();
    });
  } catch { /* gesperrt – dann eben nicht */ }
}

const heuteISO = () => {
  const d = new Date();
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
};

/*
 * Den Punkt am Symbol nachziehen, waehrend die App zu ist.
 *
 * Hier stand bis v171 eine Meldung in der Statusleiste, ausgeloest von einem
 * Web Push. Beides ist weg, auf Ansage: *„Deaktivier saemtliche Push
 * Benachrichtigungen."* Der Worker zeigt jetzt nichts mehr an – er setzt oder
 * loescht nur noch den Punkt, und zwar dann, wenn Chrome ihn ohnehin weckt.
 *
 * **Warum das hier trotzdem steht, obwohl die App den Punkt selbst setzt.**
 * Solange die App laeuft, stimmt er immer. Geht sie zu und wird es Mitternacht,
 * stimmt er nicht mehr: Der Termin von morgen ist dann der von heute. Der
 * einzige Weg, das zu bemerken, ohne die App zu oeffnen, ist dieser hier.
 *
 * **Und warum jeder Ausgang einen Namen hat.** Ob Chrome den Worker ueberhaupt
 * weckt, kann ich auf einem fremden Handy nicht nachmessen, und ein Testlauf
 * kann periodicsync nicht ausloesen. Also behauptet die App nichts, sondern
 * vermerkt, wann zuletzt geweckt wurde und was daraufhin geschah; unter Mehr
 * steht es im Klartext. Das kostet vier Zeilen und ersetzt Raten durch
 * Nachsehen.
 */
async function punktSetzen() {
  const zettel = await merkLesen();
  const heute = heuteISO();
  // Der Weckruf selbst wird immer vermerkt, auch wenn nichts zu tun ist. Das
  // ist der Messwert: Er sagt, ob der Weg ueberhaupt traegt.
  const notiz = (grund) => merkSchreiben({ geweckt: Date.now(), weckGrund: grund });

  if (!zettel.an) return notiz('aus');
  if (!self.navigator || !self.navigator.setAppBadge) return notiz('kein-punkt');

  const faellig = !!zettel.tag && zettel.tag <= heute;
  try {
    if (faellig) await self.navigator.setAppBadge();
    else if (self.navigator.clearAppBadge) await self.navigator.clearAppBadge();
  } catch { /* nicht unterstuetzt – dann eben nicht */ }
  return notiz(faellig ? 'gesetzt' : 'geloescht');
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'workout-erinnerung') event.waitUntil(punktSetzen());
});

/* ------------------------------------------------------------------ *
 * Die laufende Pause – hier statt in der Seite
 *
 * Erst zaehlte die Seite selbst herunter und ersetzte jede Sekunde dieselbe
 * Meldung. Das funktioniert, solange die Seite laeuft – und genau daran hakt
 * es: Android friert eine Seite im Hintergrund ein, spaetestens wenn der
 * Bildschirm laenger aus ist. Dann steht die Zahl, und das Signal am Ende
 * kommt gar nicht.
 *
 * Ein Service Worker haengt nicht an der Seite. Solange ein `waitUntil` offen
 * ist, laeuft er weiter, auch wenn die Seite eingefroren oder ganz weg ist.
 * Deshalb bekommt er beim Start der Pause einmal Bescheid und macht den Rest
 * allein: mitzaehlen, am Ende melden.
 *
 * **Was das nicht kann.** Chrome beendet einen Worker, dessen Ereignis zu
 * lange laeuft – in der Groessenordnung von fuenf Minuten. Fuer eine Pause von
 * 90 bis 180 Sekunden reicht das; fuer eine beliebig lange nicht, deshalb der
 * Deckel unten. Und ist der Browser ganz beendet, laeuft nichts mehr – dafuer
 * gaebe es keinen Weg ausser einem Server, der zur Sekunde sendet.
 * ------------------------------------------------------------------ */

const PAUSE_TAG = 'workout-pause';
const PAUSE_DECKEL = 300000;   // 5 min – darueber beendet Chrome den Worker ohnehin
let pause = null;              // { endet, text, sichtbar, fertig }

/** Eine Meldung, die sich selbst ersetzt statt zu stapeln. */
function pauseZeigen(rest) {
  const sek = Math.max(0, Math.round(rest / 1000));
  const ende = new Date(pause.endet);
  const uhr = `${ende.getHours()}:${String(ende.getMinutes()).padStart(2, '0')}`;
  return self.registration.showNotification(
    `Pause ${Math.floor(sek / 60)}:${String(sek % 60).padStart(2, '0')}`,
    {
      body: `${pause.text} · weiter um ${uhr}`,
      tag: PAUSE_TAG,
      // Nur das kleine Symbol: Mit `icon` daneben zeichnet Android dieselbe
      // Hantel zweimal, und als Schablone taugt icon-192.png nicht – sie ist
      // deckend, es bliebe ein weisser Kasten. Siehe badge.svg.
      badge: './badge-96.png',
      silent: true,          // sonst klingelt es jede Sekunde neu
      renotify: false,
      requireInteraction: true,
    },
  );
}

/** Das Ende: die eine Meldung, die sich bemerkbar machen darf. */
function pauseFertig() {
  return self.registration.showNotification('Pause vorbei', {
    body: pause.text,
    tag: PAUSE_TAG,
    badge: './badge-96.png',
    vibrate: [180, 90, 180],
    requireInteraction: true,
  });
}

/**
 * Die Uhr des Workers. Laeuft, bis die Pause um ist oder abgesagt wird.
 *
 * Gewartet wird auf einen echten Zeitpunkt, nicht auf gezaehlte Sekunden: Wird
 * der Worker zwischendurch ausgebremst, stimmt die Zahl trotzdem.
 */
function pauseUhr() {
  return new Promise((fertig) => {
    const takt = setInterval(async () => {
      if (!pause) { clearInterval(takt); fertig(); return; }
      const rest = pause.endet - Date.now();
      if (rest <= 0) {
        clearInterval(takt);
        await pauseFertig().catch(() => {});
        pause = null;
        fertig();
        return;
      }
      // Waehrend die App vorn ist, zeigt sie die Leiste selbst – eine Meldung
      // in der Statusleiste waere daneben nur ein Duplikat.
      if (!pause.sichtbar) await pauseZeigen(rest).catch(() => {});
    }, 1000);
  });
}

/** Die schon sichtbare Pausenmeldung wegraeumen. */
async function pauseWeg() {
  const liste = await self.registration.getNotifications({ tag: PAUSE_TAG });
  liste.forEach((n) => n.close());
}

self.addEventListener('message', (event) => {
  const m = event.data || {};
  if (m.typ === 'pause-start') {
    const lauf = Number(m.endet) - Date.now();
    if (!(lauf > 0) || lauf > PAUSE_DECKEL) return;
    const schonAn = !!pause;
    pause = { endet: Number(m.endet), text: String(m.text || ''), sichtbar: !!m.sichtbar };
    // Nur eine Uhr: Bei „+30 s" laeuft die bestehende weiter und liest den
    // neuen Endzeitpunkt beim naechsten Takt.
    if (!schonAn) event.waitUntil(pauseUhr());
  } else if (m.typ === 'pause-aus') {
    pause = null;
    event.waitUntil(pauseWeg());
  } else if (m.typ === 'sichtbar') {
    if (pause) pause.sichtbar = !!m.an;
    if (m.an) event.waitUntil(pauseWeg());
  }
});

/*
 * Tippen auf den Hinweis „Pause vorbei" bringt die App nach vorn, statt eine
 * zweite Instanz zu oeffnen. Ohne diesen Zweig passiert schlicht nichts.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const liste = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of liste) {
      if ('focus' in client) {
        await client.focus();
        return;
      }
    }
    await self.clients.openWindow('./');
  })());
});
