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

const VERSION = 'v247';
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
  './js/diagnose.js',
  './js/config.js',
  './js/telemetry.js',
  './js/sicherung.js',
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
  './js/termine.js',
  './js/aktivitaeten.js',
  './js/plan.js',
  './js/bilanz.js',
  './js/tagstart.js',
  './js/kalender.js',
  // Die Vorschau des Kalenders rechnet in einem eigenen Worker, an app.js
  // vorbei (tools/pruefung/schichten.py prüft ihn eigens). Ohne Netz fehlte
  // sie sonst genau dann, wenn die Vorschau nach dem Training raus soll.
  './js/kalender-vorschau.js',
  './js/kalender-worker.js',
  // Das Senden an das Skript (Karte unter Mehr → Kalender, Takt, Antwort).
  './js/kalender-sync.js',
  // Die Vorlage für das Skript in Tobis Google-Konto: „Code kopieren" setzt
  // dort das Kennwort ein. Kein Modul – sie läuft nur bei Google.
  './kalender/workout-kalender.gs',
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
      // Nur die eigenen alten Fassungen. Im selben Ursprung liegt auch der
      // Vorrat der Schilddrüsen- und der Freizeit-App (schilddruese/sw.js,
      // freizeit/sw.js); ohne den Filter ging
      // der bei jeder neuen Workout-Fassung mit, und wer beide Apps auf einem
      // Handy hat, stand mit der anderen danach offline vor einer leeren Seite.
      .then((keys) => Promise.all(keys
        .filter((k) => k.startsWith('workout-') && k !== CACHE)
        .map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Die Schilddrüsen-App im Unterordner hat ihren eigenen Worker und ihren
  // eigenen Vorrat. Dieser hier lässt sie in Ruhe: Sonst beantwortete er ihre
  // Seitenaufrufe, solange ihr Worker (noch) nicht registriert ist – offline,
  // und bei /schilddruese ohne Schrägstrich (GitHub Pages leitet um) sogar
  // mit Netz, jeweils mit der index.html *dieser* App.
  if (url.pathname.startsWith(new URL('./schilddruese', self.location).pathname)) return;
  // Dasselbe für die Freizeit-App (freizeit/sw.js, Vorrat freizeit-…).
  if (url.pathname.startsWith(new URL('./freizeit', self.location).pathname)) return;

  // Nur im Zwischenspeicher dieser Fassung nachsehen. caches.match() ohne
  // Angabe durchsucht *alle* – ein übrig gebliebener alter Zwischenspeicher
  // würde dann weiter alte Dateien ausliefern.
  const cached = (req) => caches.open(CACHE).then((c) => c.match(req));

  // Nur eine gute Antwort ersetzt, was im Zwischenspeicher liegt. Vorher wurde
  // beim Seitenaufruf *jede* Antwort abgelegt – eine 503 von GitHub Pages oder
  // eine umgeleitete Seite ebenso. Danach lieferte der Worker genau diese
  // Fehlerseite aus, auch ohne Netz, und die App ging im Keller nicht mehr auf,
  // obwohl die Daten im Speicher lagen. Gefunden bei der Durchsicht der App.
  const gut = (res) => res && res.ok && !res.redirected && res.type === 'basic';
  const zuletztGut = () => cached(request).then((hit) => hit || cached('./index.html'));

  if (request.mode === 'navigate') {
    event.respondWith(
      fresh(request)
        .then((res) => {
          if (gut(res)) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
            return res;
          }
          // Fehler- oder Umleitungsseite: lieber die letzte gute Fassung zeigen.
          // Nur wenn es keine gibt, sieht man, was der Server geschickt hat.
          return zuletztGut().then((hit) => hit || res);
        })
        .catch(() => zuletztGut().then((hit) => hit || Response.error())),
    );
    return;
  }

  event.respondWith(
    cached(request).then((hit) => {
      const update = fresh(request)
        .then((res) => {
          if (gut(res)) {
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
 * Was hier NICHT mehr steht: die Erinnerung am Trainingstag
 *
 *     „Mach auch die einmalige Push Nachricht morgens weg. Pausen usw sollen
 *      aber natuerlich immer noch mit angezeigt werden"
 *
 * Bis v182 stand hier die Meldung „Training steht an", geweckt durch
 * `periodicsync` und durch Web Push von einem zeitgesteuerten Ablauf bei
 * GitHub. Sie ist ersatzlos weg, und mit ihr der ganze Weg dorthin: der
 * Merkzettel in IndexedDB, beide Ereignisse, der Wecker, die VAPID-Schluessel.
 *
 * **Warum nicht nur die Meldung, sondern der ganze Weg.** Web Push laeuft unter
 * `userVisibleOnly`: Chrome erwartet, dass jeder zugestellte Push etwas
 * anzeigt, und blendet sonst irgendwann von sich aus „im Hintergrund
 * aktualisiert" ein. Ein stiller Push waere also keine stille Loesung, sondern
 * eine fremde Meldung an derselben Stelle. Bleibt der Weg bestehen und wird nur
 * die Meldung entfernt, steht am Ende genau das da, was weg sollte.
 *
 * **Was bleibt, ist alles rund um die Pause** – `pause-start`, die laufende
 * Uhr, „Pause vorbei". Die haengt an einer Nachricht der Seite und nicht am
 * Push-Dienst; sie war nie Teil dieses Abschnitts und ist es auch jetzt nicht.
 * ------------------------------------------------------------------ */

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
      // Nur das kleine Symbol – zu `icon` siehe erinnerungZeigen().
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

/* ------------------------------------------------------------------ *
 * Google Kalender automatisch: nachsenden, wenn wieder Netz da ist
 *
 *     „Ja aber nur wenn es wirklich keinen Weg gibt wie verschoben wird auch
 *      wenn ich die app nicht öffne"
 *
 * Trainiert Tobi im Studio ohne Netz, kann die App die neue Vorschau nicht
 * schicken, und bis zum nächsten Öffnen mit Netz hielte der Kalender das
 * Training für verpasst und schöbe es weiter. Ebenso, wenn das Skript gerade
 * beschäftigt war oder keine Antwort kam und Tobi die App gleich danach
 * schließt. Die App legt die fertige Sendung deshalb in den Ausgang (Cache
 * „kalender-ausgang", js/kalender-sync.js) und bittet um ein „sync". Das
 * schickt der Browser sofort, wenn Netz da ist, sonst sobald wieder welches
 * da ist – auch bei geschlossener App (Background Sync: Chrome, also Android;
 * Safari und Firefox kennen es nicht). Wirft dieser Teil, versucht der
 * Browser es einige Minuten später noch einmal.
 *
 * Geschickt wird erst mit CORS, damit die Antwort lesbar ist: Sagt das
 * Skript „fehler" (beschäftigt – der stündliche Abgleich hält die Sperre bis
 * zu vier Minuten), wirft dieser Teil, und die Sendung bleibt im Ausgang.
 * Bis zur Prüfung des Entwurfs ging sie ohne CORS hinaus und galt dann als
 * geschickt, auch wenn das Skript sie abgewiesen hatte. Scheitert die Anfrage
 * mit CORS, ist das kein Netz – oder eine Seite ohne Freigabe (Anmeldeseite,
 * Fehlerseite). Dann dieselbe noch einmal ohne CORS: Die wirft nur ohne Netz;
 * sonst wäre es endlos weitergegangen. Vermerkt wird, dass es hinausging, und
 * – wenn lesbar – was das Skript sagte. Nur an eine Web-App von Google Apps
 * Script – dieselbe Prüfung wie KALENDER_URL in js/store.js.
 *
 * Ohne keepalive: Der Service Worker friert nicht ein wie die Seite, er lebt,
 * solange waitUntil() läuft. Darum geht hier auch eine Sendung über 64 KiB
 * hinaus – ein Jahr Plan mit vielen Terminen (bis 192 KiB, siehe
 * js/kalender-vorschau.js). Die Seite legt sie beim Wegschalten deshalb
 * gleich hierher, statt es mit keepalive zu versuchen.
 * ------------------------------------------------------------------ */

const KALENDER_AUSGANG = 'kalender-ausgang';
const KALENDER_ZIEL = /^https:\/\/script\.google\.com\/(?:macros|a\/macros\/[A-Za-z0-9.-]{1,100})\/s\/[A-Za-z0-9_-]{10,200}\/exec$/;

async function kalenderNachsenden() {
  const c = await caches.open(KALENDER_AUSGANG);
  const schluessel = new URL('kalender-ausgang', self.registration.scope).href;
  const hit = await c.match(schluessel);
  if (!hit) return;
  const s = await hit.json().catch(() => null);
  if (!s || typeof s.text !== 'string' || !KALENDER_ZIEL.test(s.url || '')) {
    await c.delete(schluessel);
    return;
  }
  const anfrage = (mode) => fetch(s.url, {
    method: 'POST', body: s.text, mode, credentials: 'omit', redirect: 'follow',
  });
  let code = null;
  let version = null;
  let antwort = null;
  let res = null;
  try {
    res = await anfrage('cors');
  } catch {
    res = null;
  }
  if (res) {
    try {
      const j = JSON.parse(await res.text());
      code = j && typeof j.code === 'string' ? j.code.slice(0, 20) : null;
      version = j && Number.isInteger(j.version) ? j.version : null;
      // Was das Skript über den Abgleich sagt (Fassung 2) – die App prüft es
      // wie die Antwort auf eine eigene Sendung (kalAbgleich()). Dazu der
      // Trainingsstand, der beim Skript gilt: Sagt es „aelter", ist es der
      // eines anderen Geräts, und die App merkt sich, dass dort dessen Plan
      // gilt (kalNachLesen() – seit der Prüfung von v247; sie prüft ihn mit
      // kalStandLesen(), nur Zahlen).
      if (j && typeof j === 'object') {
        antwort = {
          tag: j.tag, geaendert: j.geaendert, offen: j.offen, bis: j.bis, stehen: j.stehen, folge: j.folge, morgen: j.morgen,
          stand: j.stand && typeof j.stand === 'object'
            ? { einheiten: j.stand.einheiten, saetze: j.stand.saetze, zuletzt: j.stand.zuletzt } : null,
        };
      }
    } catch {
      code = null;
    }
    // Beschäftigt (oder ein Fehler im Skript): behalten, später noch einmal.
    if (code === 'fehler') throw new Error('Kalender-Skript beschäftigt');
  } else {
    // Wirft ohne Netz – dann kommt das nächste „sync".
    await anfrage('no-cors');
  }
  // Nur wegräumen, was geschickt wurde: Hat die App inzwischen eine neuere
  // Sendung hineingelegt, bleibt die für das nächste „sync".
  const jetzt = await c.match(schluessel);
  const noch = jetzt ? await jetzt.json().catch(() => null) : null;
  if (!noch || noch.seq === s.seq) await c.delete(schluessel);
  // Fingerabdruck und Verbindung reisen zurück: Kam die Sendung an, schickt
  // die App dieselbe Vorschau nicht noch einmal (kalNachLesen() in
  // js/kalender-sync.js) – und die Fassung des Skripts erfährt sie auch.
  // Dazu Vertrag, Kürzung und was die Antwort über den Abgleich sagt: Die App
  // vermerkt die Sendung dann als die, die zuletzt ankam. Und der Grund, aus
  // dem sie hier lag (netz, wegschalten, fehler, zeit, gross –
  // kalAusgangLegen()): Nur bei „netz" war wirklich ohne Netz trainiert; die
  // Karte sagte es bis v247 bei jeder nachgeschickten Sendung, auch bei der,
  // die nur über 64 KiB groß war.
  await c.put(new URL('kalender-ausgang-nach', self.registration.scope).href,
    new Response(JSON.stringify({
      seq: s.seq, zeit: Date.now(), code, version, hash: typeof s.hash === 'string' ? s.hash : null, ziel: typeof s.ziel === 'string' ? s.ziel : null,
      vertrag: Number.isInteger(s.vertrag) ? s.vertrag : null, gekuerzt: Number.isInteger(s.gekuerzt) ? s.gekuerzt : null, antwort,
      grund: typeof s.grund === 'string' ? s.grund.slice(0, 20) : null,
    }), { headers: { 'content-type': 'application/json' } }));
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'kalender') event.waitUntil(kalenderNachsenden());
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
