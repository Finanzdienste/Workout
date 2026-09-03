/*
 * Töne – erzeugt, nicht geladen.
 *
 * Die Atemübung führt jemand mit geschlossenen Augen durch. Der Ton ist dann
 * nicht Beiwerk, sondern die ganze Bedienoberfläche: Er sagt, wann eingeatmet
 * wird, wann gehalten und wann ausgeatmet.
 *
 * Deshalb keine Audiodateien. Eine Datei wäre ein Download, in der
 * Ein-Datei-Fassung ein halbes Megabyte base64, und ohne Netz womöglich gar
 * nicht da. Hier entstehen die Töne im Browser aus einem Oszillator: ein paar
 * Zeilen, kein Byte Ladelast, funktioniert offline und in der einen Datei
 * gleichermaßen.
 *
 * Klanglich bewusst weich: Sinuston, sanft ein- und ausgeblendet. Ein harter
 * Anschlag reißt genau die Anspannung wieder hoch, gegen die die Übung läuft.
 */

let kontext = null;

/**
 * Den Tonkontext holen – und zwar erst, wenn wirklich ein Ton kommen soll.
 *
 * Browser lassen Audio nur nach einer Nutzergeste zu. Ein Kontext, der beim
 * Laden der Seite entsteht, startet gesperrt und bleibt es; einer, der beim
 * Druck auf „Start" entsteht, läuft.
 */
function holeKontext() {
  if (kontext) return kontext;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    kontext = new AC();
  } catch {
    return null;
  }
  return kontext;
}

/** Nach einer Pause im Hintergrund steht der Kontext still. */
export function weckKlang() {
  const k = holeKontext();
  if (k && k.state === 'suspended') k.resume().catch(() => {});
  return !!k;
}

/**
 * Ein einzelner weicher Ton.
 *
 * @param {number} hz     Tonhöhe
 * @param {number} dauer  Sekunden
 * @param {number} laut   0 bis 1
 */
export function ton(hz, dauer = 0.35, laut = 0.18) {
  const k = holeKontext();
  if (!k) return;
  if (k.state === 'suspended') k.resume().catch(() => {});
  const jetzt = k.currentTime;
  const osz = k.createOscillator();
  const huelle = k.createGain();
  osz.type = 'sine';
  osz.frequency.setValueAtTime(hz, jetzt);
  // Ein- und ausblenden über je 60 ms. Ohne das knackt es an beiden Enden,
  // und ein Knacken im Ohr ist bei geschlossenen Augen doppelt unangenehm.
  huelle.gain.setValueAtTime(0.0001, jetzt);
  huelle.gain.exponentialRampToValueAtTime(laut, jetzt + 0.06);
  huelle.gain.setValueAtTime(laut, jetzt + Math.max(0.07, dauer - 0.06));
  huelle.gain.exponentialRampToValueAtTime(0.0001, jetzt + dauer);
  osz.connect(huelle).connect(k.destination);
  osz.start(jetzt);
  osz.stop(jetzt + dauer + 0.02);
}

/*
 * Die Töne der Atemübung. Drei Höhen, die man auch schlaftrunken
 * auseinanderhält: aufwärts heißt einatmen, gleichbleibend heißt halten,
 * abwärts heißt ausatmen.
 */
export const KLAENGE = {
  ein: () => { ton(523.25, 0.3); setTimeout(() => ton(659.25, 0.34), 110); },
  halten: () => ton(587.33, 0.22, 0.12),
  aus: () => { ton(523.25, 0.3); setTimeout(() => ton(392.0, 0.5), 110); },
  fertig: () => {
    ton(523.25, 0.5, 0.16);
    setTimeout(() => ton(659.25, 0.5, 0.16), 160);
    setTimeout(() => ton(783.99, 0.9, 0.16), 320);
  },
  tick: () => ton(880, 0.06, 0.05),
};

/** Ein kurzer Rüttler, wo das Gerät ihn kann – hilft, wenn es leise sein muss. */
export function ruettel(muster) {
  try {
    if (navigator.vibrate) navigator.vibrate(muster);
  } catch { /* dann eben nicht */ }
}
