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

const VERSION = 'v121';
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
  './js/gewichte.js',
  './js/supersatz.js',
  './js/plan.js',
  './js/bilanz.js',
  './js/erinnerung.js',
  './js/merkzettel.js',
  './js/push.js',
  './icon.svg',
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
 * Erinnerung am Trainingstag
 *
 * Die App kann sich nicht selbst um 16:00 aufwecken – dafuer braeuchte es
 * einen Server, der eine Nachricht schickt. Was der Browser stattdessen
 * anbietet, ist `periodicsync`: Er weckt diesen Worker gelegentlich auf, wenn
 * die App installiert ist und regelmaessig benutzt wird.
 *
 * **Gelegentlich** ist woertlich zu nehmen. Wann und ob ueberhaupt, entscheidet
 * Chrome; das angegebene Intervall ist ein Wunsch, keine Zusage. Deshalb wird
 * hier nichts versprochen: Jeder Weckruf wird mit Zeitstempel im Merkzettel
 * vermerkt, und die App zeigt unter Mehr, wann es zuletzt geklappt hat. Steht
 * da nach einer Woche nichts, weiss man, dass der Weg nicht traegt.
 *
 * Gerechnet wird hier absichtlich nichts. Welche Einheit ansteht, ob sie schon
 * gemacht ist, welche Uhrzeit fuer welchen Wochentag gilt – das steht alles in
 * js/erinnerung.js und ist dort geprueft. Hier wird eine Zahl verglichen.
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
 * `zeitPruefen` trennt die beiden Ausloeser, und das ist keine Feinheit:
 *
 *   periodicsync  Chrome weckt, wann es will – womoeglich um 9 Uhr frueh. Ohne
 *                 die Zeitpruefung kaeme die Erinnerung zur Unzeit.
 *   push          Der Absender weckt zur richtigen Zeit; die Uhrzeit ist damit
 *                 schon entschieden. Hier trotzdem zu pruefen war ein Fehler im
 *                 ersten Entwurf: Zur Winterzeit trifft der Push eine Stunde
 *                 vor der eingestellten Uhrzeit ein, die Pruefung haette ihn
 *                 verworfen – und es waere an dem Tag gar nichts gekommen.
 */
async function erinnern(zeitPruefen) {
  const zettel = await merkLesen();
  const heute = heuteISO();
  // Der Weckruf selbst wird immer vermerkt, auch wenn nichts zu melden ist.
  // Das ist der Messwert: Er sagt, ob der Weg ueberhaupt traegt.
  await merkSchreiben({ geweckt: Date.now() });

  if (!zettel.an) return;
  if (zettel.gemeldet === heute) return;          // heute schon gemeldet
  if (zeitPruefen) {
    if (!zettel.zeigenAb || Date.now() < zettel.zeigenAb) return;
  } else if (!zettel.tag || zettel.tag > heute) {
    return;                                       // erst an einem spaeteren Tag faellig
  }

  // Ist die App gerade offen, braucht es keine Meldung – dann sieht er es ja.
  const offen = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  if (offen.some((c) => c.visibilityState === 'visible')) return;

  await self.registration.showNotification('Training steht an', {
    body: zettel.titel || 'Dein nächstes Workout wartet.',
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: 'workout-erinnerung',
    // Bleibt in der Leiste stehen, bis sie weggewischt wird – genau das war
    // der Wunsch: nicht ein Piep, der im Vorbeigehen verschwindet.
    requireInteraction: true,
  });
  if (self.navigator && self.navigator.setAppBadge) {
    self.navigator.setAppBadge(1).catch(() => {});
  }
  await merkSchreiben({ gemeldet: heute });
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'workout-erinnerung') event.waitUntil(erinnern(true));
});

/*
 * Web Push – derselbe Entscheid, nur zuverlaessig ausgeloest.
 *
 * Der Push kommt von einem zeitgesteuerten Ablauf bei GitHub und **traegt
 * nichts**: kein Text, keine Daten, nur ein Klopfen. Was angezeigt wird und ob
 * ueberhaupt, entscheidet allein dieses Geraet anhand des Merkzettels. Wer den
 * Wecker betreibt, erfaehrt nicht einmal, ob heute etwas anstand.
 *
 * Chrome verlangt bei `userVisibleOnly` im Grundsatz, dass jeder Push etwas
 * anzeigt, und blendet sonst irgendwann von sich aus „im Hintergrund
 * aktualisiert" ein. Deshalb kommt genau **ein** Push am Tag, und an
 * Ruhetagen bleibt er still. Sollte Chrome das anmerken, ist die Lehre nicht,
 * oefter zu senden, sondern an Ruhetagen etwas Nuetzliches zu zeigen.
 */
self.addEventListener('push', (event) => {
  event.waitUntil(erinnern(false));
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
      icon: './icon-192.png',
      badge: './icon-192.png',
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
    icon: './icon-192.png',
    badge: './icon-192.png',
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
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((liste) => {
      for (const client of liste) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow('./');
    }),
  );
});
