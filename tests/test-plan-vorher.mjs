/*
 * Wer einen Plan neu einspielt, legt den ausgelieferten nach tools/plan-vorher/
 * – und tools/pruefung/plan-vorher.py hält an, wenn das vergessen wurde.
 *
 * Ohne den Plan davor schreibt die App eine angefangene Einheit beim
 * Planwechsel nur aus dem Protokoll fest, und das kannte am 29.09. von einer
 * Cut-Einheit nur das erste Paar: „Heute nur zwei Übungen?" Eine veraltete
 * Datei hilft so wenig wie keine – die App nimmt den Plan davor nur, wenn sein
 * Stand der ist, von dem der Wechsel kommt.
 *
 * Geprüft wird das Tor selbst, in einem Wegwerf-Repo mit den echten Plänen:
 *
 *   1. Nichts geändert oder nur Termine verschoben: Es lässt durch.
 *   2. Ein Plan mit neuem Stand, der Plan davor veraltet oder gar nicht da: Es
 *      hält an und nennt den Befehl, der den ausgelieferten dorthin holt.
 *   3. Genau diesen Befehl ausgeführt: Es lässt durch.
 *   4. Sein Fingerabdruck ist der aus tools/build-data.py – derselbe, den die
 *      App in js/data.js vergleicht. Rechnete das Tor anders, prüfte es etwas,
 *      das die App nie ansieht.
 *
 * Kein Browser: Das Tor ist ein Python-Skript. Es steht trotzdem hier, damit es
 * mit `node tests/lauf.mjs` überall mitläuft.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './umgebung.mjs';

let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

const { PLANS } = await import(pathToFileURL(path.join(ROOT, 'js', 'data.js')).href);

// Das Wegwerf-Repo: die Pläne, der Plan davor und das Tor, als ein Commit –
// der ist hier „ausgeliefert". Nie im echten Repo, wo ein Fehler im Test
// tools/ umschriebe.
const tmp = mkdtempSync(path.join(os.tmpdir(), 'plan-vorher-'));
const quelle = path.join(ROOT, 'tools');
const git = (...args) => execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid',
  '-c', 'commit.gpgsign=false', ...args], { cwd: tmp, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const tor = (...args) => {
  const r = spawnSync('python3', [path.join('tools', 'pruefung', 'plan-vorher.py'), ...args],
    { cwd: tmp, encoding: 'utf8' });
  return { code: r.status, text: `${r.stdout || ''}${r.stderr || ''}`.trim() };
};
const plan = (f) => JSON.parse(readFileSync(path.join(tmp, 'tools', f), 'utf8'));
const schreibe = (f, roh) => writeFileSync(path.join(tmp, 'tools', f), JSON.stringify(roh, null, 1));
// Ein neuer Stand, wie ihn ein Generatorlauf bringt: andere Übungen hinter
// einer Nummer. Die Reihenfolge reicht – sie geht in den Fingerabdruck ein.
const umbauen = (f) => {
  const roh = plan(f);
  roh.plan[0].ex.reverse();
  schreibe(f, roh);
};

try {
  mkdirSync(path.join(tmp, 'tools', 'pruefung'), { recursive: true });
  readdirSync(quelle).filter((f) => /^plan(-.+)?\.json$/.test(f))
    .forEach((f) => cpSync(path.join(quelle, f), path.join(tmp, 'tools', f)));
  cpSync(path.join(quelle, 'plan-vorher'), path.join(tmp, 'tools', 'plan-vorher'), { recursive: true });
  cpSync(path.join(quelle, 'pruefung', 'plan-vorher.py'), path.join(tmp, 'tools', 'pruefung', 'plan-vorher.py'));
  git('init', '-q');
  git('add', '.');
  git('commit', '-qm', 'ausgeliefert');
  const basis = git('rev-parse', 'HEAD').trim();

  // --- 1. Nichts geändert, oder nur Termine ----------------------------
  let r = tor(basis);
  console.log(`     ${r.text}`);
  check(r.code === 0, 'unveränderte Pläne: das Tor lässt durch');

  const roh = plan('plan-cut.json');
  roh.plan.forEach((o) => {
    o.date = new Date(Date.parse(o.date) + 7 * 864e5).toISOString().slice(0, 10);
  });
  schreibe('plan-cut.json', roh);
  r = tor(basis);
  check(r.code === 0, 'nur Termine verschoben (und die Datei anders formatiert): es lässt durch');
  git('checkout', '--', 'tools');

  // --- 2. Neuer Stand, der Plan davor veraltet -------------------------
  //
  // Genau die Lage im Repo: tools/plan-vorher/cut.json ist der Cut von vor
  // „Schultern auf 8". Der nächste neue Cut muss den jetzigen dorthin legen.
  umbauen('plan-cut.json');
  r = tor(basis);
  console.log(r.text.split('\n').map((z) => `     ${z}`).join('\n'));
  check(r.code === 1, 'neuer Cut, tools/plan-vorher/cut.json veraltet: das Tor hält an');
  check(r.text.includes(`tools/plan-vorher/cut.json hat ${PLANS.cut.vorher.stand}`),
    'es nennt die Datei und den Stand, der dort liegt');
  check(r.text.includes(`tools/plan-cut.json: ${PLANS.cut.stand} →`),
    `sein Fingerabdruck ist der aus js/data.js (${PLANS.cut.stand})`);
  const befehl = `git show ${basis}:tools/plan-cut.json > tools/plan-vorher/cut.json`;
  check(r.text.includes(befehl), 'es nennt den Befehl, der den ausgelieferten Cut dorthin holt');
  check(!/plan-bbp|plan-oberkoerper|plan\.json/.test(r.text),
    'und nur den Plan, der sich geändert hat');

  // --- 3. Den genannten Befehl ausgeführt ------------------------------
  r.text.split('\n').filter((z) => /^\s*git show \S+ > \S+$/.test(z))
    .forEach((z) => execFileSync('sh', ['-c', z.trim()], { cwd: tmp }));
  check(readFileSync(path.join(tmp, 'tools', 'plan-vorher', 'cut.json'), 'utf8')
    === readFileSync(path.join(quelle, 'plan-cut.json'), 'utf8'),
  'danach liegt dort der ausgelieferte Cut, Byte für Byte');
  r = tor(basis);
  console.log(`     ${r.text}`);
  check(r.code === 0, 'und das Tor lässt durch');

  // --- 4. Der Standardplan heißt dort standard.json --------------------
  umbauen('plan.json');
  r = tor(basis);
  check(r.code === 1 && r.text.includes('tools/plan-vorher/standard.json fehlt'),
    'neuer Standardplan ohne tools/plan-vorher/standard.json: das Tor hält an');
  check(r.text.includes(`tools/plan.json: ${PLANS.standard.stand} →`),
    `auch hier der Fingerabdruck aus js/data.js (${PLANS.standard.stand})`);
  check(r.text.includes(`git show ${basis}:tools/plan.json > tools/plan-vorher/standard.json`),
    'mit dem Befehl, der ihn dorthin holt');

  // --- 5. Wo es nichts zu vergleichen gibt -----------------------------
  git('checkout', '--', 'tools/plan.json');
  cpSync(path.join(tmp, 'tools', 'plan-cut.json'), path.join(tmp, 'tools', 'plan-neu.json'));
  r = tor(basis);
  check(r.code === 0, 'eine neue Variante hat keinen Plan davor und verlangt keinen');
  r = tor('0'.repeat(40));
  check(r.code === 0 && r.text.includes('nichts geprüft'),
    'der erste Push eines Zweigs (vorher = 000…): nichts geprüft, und das gesagt');
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
