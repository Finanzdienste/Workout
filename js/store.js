const KEY = 'workout.state.v1';

const DEFAULT_STATE = {
  mode: 'db',            // global default: 'db' (Hanteln) | 'bw' (Bodyweight)
  keepModePerWorkout: true,
  log: {},               // { [workoutNo]: { db: {exId: [{w,r,done}]}, bw: {...}, mode: 'db'|'bw' } }
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
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* Speicher voll / privater Modus */ }
  }, 120);
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
  persist();
  emit();
}

export function resetWorkout(n, mode) {
  const e = state.log[n];
  if (!e) return;
  e[mode] = {};
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
  persist();
  emit();
}

export function setSetting(key, value) {
  state[key] = value;
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
