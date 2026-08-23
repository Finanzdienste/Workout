import { todayISO } from './dates.js';

const KEY = 'workout.state.v1';

const DEFAULT_STATE = {
  mode: 'db',            // global default: 'db' (Hanteln) | 'bw' (Bodyweight)
  keepModePerWorkout: true,
  autoShift: true,       // verpasste Tage schieben den Restplan nach hinten
  shift: 0,              // Tage, um die der noch offene Plan verschoben ist
  useExerciseRest: true, // Pause je Übung statt einer festen Länge
  restSeconds: 90,       // feste Pause, wenn useExerciseRest aus ist; 0 = keine
  sound: true,           // Ton am Ende der Pause
  rest: null,            // laufende Pause: { endsAt, total, next }
  weights: {},           // Arbeitsgewicht je Übung in kg, vom Nutzer gepflegt
  session: null,         // laufendes Training: { n, startedAt }
  lastBackup: null,      // { on, done } – Stand der letzten Sicherung
  rounds: [],            // abgeschlossene Durchläufe: [{ finishedOn, log }]
  // Angehakte Verletzungen als IDs aus js/injuries.js. Sie gelten für alle
  // kommenden Trainings, bis der Haken wieder weg ist – nicht nur für heute.
  injuries: [],
  tab: 'dashboard',      // zuletzt sichtbarer Tab, damit ein Neuladen nicht herausreißt
  // Wie sich eine Übung angefühlt hat: { [workoutNo]: { db: {exId: 'leicht'|'ok'|'schwer'}, bw: {…} } }
  effort: {},
  // Zusätzliche Wiederholungen im Bodyweight-Modus, je Übung. Dort gibt es
  // kein Gewicht, das man erhöhen könnte – die Steigerung sind die Wdh.
  bwPlus: {},
  // { [workoutNo]: { db: {exId: [{w,r,done}]}, bw: {...}, mode, startedOn } }
  log: {},
};

function clone(o) { return JSON.parse(JSON.stringify(o)); }

let state = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return clone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    return Object.assign(clone(DEFAULT_STATE), parsed);
  } catch {
    return clone(DEFAULT_STATE);
  }
}

let saveTimer = null;

/**
 * Einmal vorab prüfen, statt auf den ersten fehlgeschlagenen Schreibvorgang zu
 * warten: In privaten Fenstern und manchen eingebetteten Ansichten ist der
 * Speicher gesperrt, und dann darf die App das nicht stillschweigend schlucken.
 */
let storageOk = (() => {
  try {
    localStorage.setItem(`${KEY}.probe`, '1');
    localStorage.removeItem(`${KEY}.probe`);
    return true;
  } catch {
    return false;
  }
})();

/** false, wenn der Browser nichts speichern kann – Eintragungen sind flüchtig. */
export function canPersist() { return storageOk; }

function write() {
  saveTimer = null;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    storageOk = true;
  } catch {
    storageOk = false; // Speicher voll oder gesperrt
  }
}

function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(write, 120);
}

/**
 * Ausstehenden Schreibvorgang sofort ausführen. Nötig, bevor die App in den
 * Hintergrund geht: mobile Browser verwerfen die Seite dort ohne Vorwarnung,
 * und der letzte abgehakte Satz wäre sonst verloren.
 */
export function flush() {
  if (saveTimer === null) return;
  clearTimeout(saveTimer);
  write();
}

function emit() {
  listeners.forEach((fn) => fn(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getState() { return state; }

export function setMode(mode) {
  state.mode = mode === 'bw' ? 'bw' : 'db';
  persist();
  emit();
}

/** Modus, in dem ein konkretes Workout bearbeitet wird. */
export function workoutMode(n) {
  const entry = state.log[n];
  if (state.keepModePerWorkout && entry && entry.mode) return entry.mode;
  return state.mode;
}

export function setWorkoutMode(n, mode) {
  const entry = ensure(n);
  entry.mode = mode;
  state.mode = mode;
  persist();
  emit();
}

function ensure(n) {
  if (!state.log[n]) state.log[n] = { db: {}, bw: {}, mode: state.mode };
  const e = state.log[n];
  if (!e.db) e.db = {};
  if (!e.bw) e.bw = {};
  return e;
}

/** Satz-Array für eine Übung in einem Workout; legt es bei Bedarf an. */
export function getSets(n, mode, exId, setCount) {
  const bucket = ensure(n)[mode];
  let arr = bucket[exId];
  if (!Array.isArray(arr)) arr = bucket[exId] = [];
  while (arr.length < setCount) arr.push({ w: '', r: '', done: false });
  if (arr.length > setCount) arr.length = setCount;
  return arr;
}

/** Wurde an diesem Workout überhaupt schon etwas eingetragen oder abgehakt? */
export function isStarted(n) {
  const e = state.log[n];
  if (!e) return false;
  return ['db', 'bw'].some((m) => Object.values(e[m] || {}).some(
    (arr) => Array.isArray(arr) && arr.some((s) => s.done || s.w !== '' || s.r !== ''),
  ));
}

/** Tag, an dem tatsächlich trainiert wurde – oder null, solange nichts erfasst ist. */
export function startedOn(n) {
  const e = state.log[n];
  return (e && e.startedOn) || null;
}

/** Hält fest, wann eine Einheit begonnen wurde, bzw. löst die Markierung wieder. */
function syncStartedOn(n) {
  const e = state.log[n];
  if (!e) return;
  if (isStarted(n)) {
    if (!e.startedOn) e.startedOn = todayISO();
  } else {
    delete e.startedOn;
  }
}

/**
 * Laufende Pause setzen oder beenden. Gespeichert wird der Endzeitpunkt, nicht
 * die Restdauer – so stimmt die Anzeige auch, wenn das Handy zwischendurch
 * gesperrt war und die App erst später wieder in den Vordergrund kommt.
 */
export function setRest(rest) {
  state.rest = rest;
  persist();
  emit();
}

/** Arbeitsgewicht einer Übung; null, solange der Nutzer nichts geändert hat. */
export function weightOf(exId) {
  const w = state.weights[exId];
  return typeof w === 'number' ? w : null;
}

export function setWeight(exId, kg) {
  // Auf Viertelkilo runden, nicht auf halbe: die Gewichtsschritte gehen je
  // Übung, und die kleinen liegen bei 1,25 kg. Mit halben Kilo wurde aus dem
  // Vorschlag "auf 21,25 kg" beim Annehmen still 21,5.
  const v = Math.max(0, Math.round(kg * 4) / 4);
  state.weights[exId] = v;
  persist();
  emit();
  return v;
}

export function startSession(n) {
  state.session = { n, startedAt: Date.now() };
  persist();
  emit();
}

export function endSession() {
  state.session = null;
  persist();
  emit();
}

export function setShift(days) {
  const v = Math.max(0, Math.round(Number(days) || 0));
  if (v === state.shift) return;
  state.shift = v;
  persist();
  emit();
}

/** Nur lesen – legt nichts an, damit reines Blättern den Speicher nicht füllt. */
export function peekSets(n, mode, exId) {
  const e = state.log[n];
  const arr = e && e[mode] && e[mode][exId];
  return Array.isArray(arr) ? arr : null;
}

export function updateSet(n, mode, exId, setCount, index, patch) {
  const arr = getSets(n, mode, exId, setCount);
  Object.assign(arr[index], patch);
  ensure(n).mode = mode;
  syncStartedOn(n);
  persist();
  emit();
}

export function resetWorkout(n, mode) {
  const e = state.log[n];
  if (!e) return;
  e[mode] = {};
  syncStartedOn(n);
  persist();
  emit();
}

export function completeWorkout(n, mode, exList) {
  const e = ensure(n);
  e.mode = mode;
  exList.forEach((item) => {
    const arr = getSets(n, mode, item.id, item.sets);
    arr.forEach((s) => { s.done = true; });
  });
  syncStartedOn(n);
  persist();
  emit();
}

/** Wie sich eine Übung angefühlt hat – 'leicht', 'ok' oder 'schwer'. */
export function effortOf(n, mode, exId) {
  return ((state.effort[n] || {})[mode] || {})[exId] || null;
}

export function setEffort(n, mode, exId, value) {
  const day = state.effort[n] || (state.effort[n] = {});
  const m = day[mode] || (day[mode] = {});
  if (value) m[exId] = value;
  else delete m[exId];
  persist();
}

/** Aufschlag an Wiederholungen im Bodyweight-Modus. */
export function bwPlusOf(exId) { return state.bwPlus[exId] || 0; }

export function addBwPlus(exId, delta) {
  state.bwPlus[exId] = Math.max(0, (state.bwPlus[exId] || 0) + delta);
  persist();
}

/** Verletzung an- oder abhaken. Gilt für alle kommenden Trainings. */
export function toggleInjury(id, on) {
  const set = new Set(state.injuries || []);
  if (on) set.add(id);
  else set.delete(id);
  state.injuries = [...set];
  persist();
}

/** Alle Haken auf einmal entfernen. */
export function clearInjuries() {
  state.injuries = [];
  persist();
}

export function setSetting(key, value) {
  state[key] = value;
  persist();
  emit();
}

/** Hält fest, dass gesichert wurde – gemessen an der Zahl erledigter Einheiten. */
export function markBackup(done) {
  state.lastBackup = { on: todayISO(), done };
  persist();
  emit();
}

/**
 * Plan von vorn beginnen. Der bisherige Verlauf wandert in `rounds`, die
 * Gewichte bleiben stehen – Runde zwei startet also auf dem erreichten Stand
 * und nicht wieder bei den Anfangswerten.
 */
export function restartPlan(shiftDays) {
  if (Object.keys(state.log).length) {
    state.rounds.push({ finishedOn: todayISO(), log: state.log });
  }
  state.log = {};
  state.session = null;
  state.rest = null;
  state.shift = Math.max(0, Math.round(Number(shiftDays) || 0));
  persist();
  emit();
}

export function exportJSON() {
  return JSON.stringify(state, null, 2);
}

export function importJSON(text) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || typeof parsed.log !== 'object') {
    throw new Error('Unerwartetes Format – "log" fehlt.');
  }
  state = Object.assign(clone(DEFAULT_STATE), parsed);
  persist();
  emit();
}

export function resetAll() {
  state = clone(DEFAULT_STATE);
  try { localStorage.removeItem(KEY); } catch { /* ignorieren */ }
  persist();
  emit();
}
