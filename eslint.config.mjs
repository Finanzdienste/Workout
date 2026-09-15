/*
 * Der Linter: liest den Code, ohne ihn auszuführen.
 *
 * Was er soll, und was ausdrücklich nicht. Diese App hat 1337 Browserprüfungen,
 * die messen, ob sie *das Richtige tut*. Was dabei durchrutscht, ist die andere
 * Sorte Fehler: eine Variable, die nach einem Umbau niemand mehr liest; eine
 * Funktion, die in einem Zweig nichts zurückgibt; ein `case` ohne `break`. Das
 * sind keine Verhaltensfehler, die ein Test sieht – es sind Fehler, die man an
 * der Form erkennt, und genau dafür ist er da.
 *
 * Deshalb steht hier `js.configs.recommended` und darüber eine Handvoll Regeln,
 * die alle demselben Muster folgen: Jede von ihnen hat in dieser App schon
 * einmal etwas kaputt gemacht.
 *
 * **Kein Stilregelwerk.** Keine Zeilenlänge, keine Anführungszeichen, keine
 * Kommaregeln. Der Code sieht aus, wie er aussieht, und ein Linter, der bei
 * jedem Lauf zweihundert Formatierungswünsche meldet, wird nach einer Woche
 * weggeklickt – dann meldet er die echten Funde an niemanden mehr.
 */
import js from '@eslint/js';

export default [
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  js.configs.recommended,
  {
    files: ['js/**/*.js', 'tests/**/*.mjs', 'sw.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        // Browser und Service Worker. Bewusst von Hand statt über ein
        // Globals-Paket: Was hier steht, ist die Liste dessen, was die App
        // wirklich anfasst – eine Abhängigkeit mehr wäre ein schlechter Tausch.
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        location: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        indexedDB: 'readonly',
        fetch: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        Headers: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        Blob: 'readonly',
        File: 'readonly',
        FileReader: 'readonly',
        Image: 'readonly',
        Audio: 'readonly',
        AudioContext: 'readonly',
        webkitAudioContext: 'readonly',
        caches: 'readonly',
        crypto: 'readonly',
        atob: 'readonly',
        btoa: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        queueMicrotask: 'readonly',
        performance: 'readonly',
        console: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        prompt: 'readonly',
        CustomEvent: 'readonly',
        Event: 'readonly',
        MutationObserver: 'readonly',
        ResizeObserver: 'readonly',
        IntersectionObserver: 'readonly',
        matchMedia: 'readonly',
        getComputedStyle: 'readonly',
        structuredClone: 'readonly',
        history: 'readonly',
        Notification: 'readonly',
        AbortController: 'readonly',
        DOMException: 'readonly',
        PopStateEvent: 'readonly',
        ServiceWorkerRegistration: 'readonly',
        SVGElement: 'readonly',
        HTMLElement: 'readonly',
        // Service Worker
        self: 'readonly',
        clients: 'readonly',
        registration: 'readonly',
        skipWaiting: 'readonly',
        importScripts: 'readonly',
        // Node, für die Tests
        process: 'readonly',
      },
    },
    rules: {
      // Jede dieser Regeln hat hier schon einmal zugeschlagen.

      // Eine Variable, die nach einem Umbau niemand mehr liest – zuletzt
      // `totalSets`, als die Satzzahl aus der Kopfzeile flog. Argumente bleiben
      // draußen: Ein unbenutzter Parameter ist oft die Signatur einer
      // Schnittstelle und kein Versehen.
      //
      // `ignoreRestSiblings`, weil `const { adminPass, ...rest } = state` das
      // uebliche Mittel ist, um genau einen Schluessel wegzulassen - dort ist
      // die ungenutzte Variable der Zweck der Zeile und kein Versehen.
      'no-unused-vars': ['error', {
        args: 'none', caughtErrors: 'none', ignoreRestSiblings: true,
      }],

      // Ein `case`, das ins nächste durchfällt. Der Schalter in js/app.js hat
      // über sechzig davon; einmal ein vergessenes `break`, und ein Tipp löst
      // zwei Dinge aus.
      'no-fallthrough': 'error',

      // Eine Funktion, die mal etwas zurückgibt und mal nichts. Genau daran
      // hing der Fehler, bei dem eine Prüfung „bestanden" meldete, weil sie
      // `undefined` statt `false` lieferte.
      'consistent-return': 'error',

      // `==` statt `===`. Bei Gewichten, die als Text im Protokoll stehen,
      // ist "0" == 0 wahr und "" == 0 auch – zwei sehr verschiedene Fälle.
      eqeqeq: ['error', 'always'],

      // Zuweisung in einer Bedingung, doppelte Objektschlüssel, tote Zweige.
      'no-cond-assign': ['error', 'always'],
      'no-dupe-keys': 'error',
      'no-unreachable': 'error',

      // `var`. Die App ist durchgehend `const`/`let`; ein einzelnes `var`
      // bringt eine andere Sichtbarkeitsregel mit, und das sieht man ihm nicht
      // an.
      'no-var': 'error',
    },
  },
  {
    // Die Prüfskripte laufen in Node und dürfen dessen Globals benutzen.
    files: ['tests/**/*.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        global: 'readonly',
        // Was in page.evaluate() steht, laeuft nicht hier, sondern im Browser
        // bzw. im Service Worker - dort gibt es diese Namen. Der Linter sieht
        // nur den Quelltext und kann das nicht wissen.
        heuteISO: 'readonly',
        merkLesen: 'readonly',
        merkSchreiben: 'readonly',
        erinnerungZeigen: 'readonly',
        OfflineAudioContext: 'readonly',
      },
    },
  },
];
