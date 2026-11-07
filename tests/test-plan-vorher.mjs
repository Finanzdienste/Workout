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
 * Die Ablage ist eine Kette: je ausgeliefertem Stand eine Datei,
 * tools/plan-vorher/<variante>/<stand>.json. Bis zum 03.10. war es eine Datei
 * je Variante, und der neue Plan überschrieb den vorigen – wer eine Fassung
 * übersprungen hatte, fand seinen Stand nicht mehr.
 *
 * Geprüft wird zuerst, dass js/data.js die echte Kette mitbringt, dann das Tor
 * selbst, in einem Wegwerf-Repo mit den echten Plänen:
 *
 *   1. Nichts geändert oder nur Termine verschoben: Es lässt durch.
 *   2. Ein Plan mit neuem Stand, der ausgelieferte nicht in der Kette: Es
 *      hält an und nennt die Befehle, die ihn dorthin holen.
 *   3. Genau diese ausgeführt: Es lässt durch, und der ältere Stand liegt noch
 *      daneben. Ein gelöschtes Glied, eine alte Einzeldatei, deren Stand in der
 *      Kette fehlt, und eine falsch benannte Datei halten es an.
 *   4. Sein Fingerabdruck ist der aus tools/build-data.py – derselbe, den die
 *      App in js/data.js vergleicht. Rechnete das Tor anders, prüfte es etwas,
 *      das die App nie ansieht.
 *   5. In CI vergleicht es mit dem ausgelieferten Stand, nicht mit dem vor dem
 *      Push: Zwei Pushes mit Planänderung auf einem Zweig, und wer der Meldung
 *      folgt, besteht danach auch gegen main.
 *
 * Was heute in tools/plan-vorher/ liegt, übernimmt der Test bewusst nicht. Die
 * erste Fassung tat das und verlangte wörtlich „standard.json fehlt" – beim
 * nächsten neuen Standardplan hätte genau die Datei dort gelegen, die das Tor
 * verlangt, und der Test wäre rot geworden, obwohl alles stimmte. Den
 * Ausgangszustand legt er deshalb selbst fest.
 *
 * Kein Browser: Das Tor ist ein Python-Skript. Es steht trotzdem hier, damit es
 * mit `node tests/lauf.mjs` überall mitläuft.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './umgebung.mjs';

let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };
const zeige = (text) => console.log(text.split('\n').map((z) => `     ${z}`).join('\n'));

const { PLANS } = await import(pathToFileURL(path.join(ROOT, 'js', 'data.js')).href);

// Der Fingerabdruck, wie lies_plan() in tools/build-data.py ihn bildet: welche
// Übung hinter welcher Nummer steht, ohne Termine. Hier nachgerechnet, damit
// der Test die Stände seiner selbst gebauten Ablagen kennt, ohne sie dem Tor
// abzulesen – und gegen js/data.js abgeglichen, damit er nicht danebenliegt.
const standVon = (roh) => createHash('sha256')
  .update(roh.plan.map((o, i) => `${i + 1}:${o.ex.map((x) => x.id).join(',')}`).join(';'))
  .digest('hex').slice(0, 12);

// Das Wegwerf-Repo: die Pläne und das Tor, als ein Commit – der ist hier
// „ausgeliefert". Nie im echten Repo, wo ein Fehler im Test tools/ umschriebe.
const wurzel = mkdtempSync(path.join(os.tmpdir(), 'plan-vorher-'));
const tmp = path.join(wurzel, 'repo');
const quelle = path.join(ROOT, 'tools');
const git = (...args) => execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid',
  '-c', 'commit.gpgsign=false', '-c', 'init.defaultBranch=main', ...args],
{ cwd: tmp, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
// Das Tor. Die GITHUB_*-Variablen des Testlaufs selbst (der läuft in CI ja
// auch) dürfen nicht hineinreichen – nur die, die ein Schritt ausdrücklich setzt.
const tor = (args, ci = {}) => {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GITHUB_')));
  const r = spawnSync('python3', [path.join('tools', 'pruefung', 'plan-vorher.py'), ...args],
    { cwd: tmp, encoding: 'utf8', env: { ...env, ...ci } });
  return { code: r.status, text: `${r.stdout || ''}${r.stderr || ''}`.trim() };
};
const datei = (f) => path.join(tmp, 'tools', f);
const plan = (f) => JSON.parse(readFileSync(datei(f), 'utf8'));
const schreibe = (f, roh) => writeFileSync(datei(f), JSON.stringify(roh, null, 1));
// Ein neuer Stand, wie ihn ein Generatorlauf bringt: andere Übungen hinter
// einer Nummer. Die Reihenfolge reicht – sie geht in den Fingerabdruck ein.
const umgebaut = (roh, nummer) => {
  const neu = structuredClone(roh);
  neu.plan[nummer - 1].ex.reverse();
  return neu;
};
const umbauen = (f, nummer = 1) => schreibe(f, umgebaut(plan(f), nummer));
const befehle = (text) => text.split('\n').filter((z) => /^\s*(git show \S+ > \S+|mkdir -p \S+)$/.test(z))
  .forEach((z) => execFileSync('sh', ['-c', z.trim()], { cwd: tmp }));
// Wo ein Stand in der Kette liegt: tools/plan-vorher/<variante>/<stand>.json.
const glied = (variante, roh) => `plan-vorher/${variante}/${standVon(roh)}.json`;

try {
  mkdirSync(path.join(tmp, 'tools', 'pruefung'), { recursive: true });
  readdirSync(quelle).filter((f) => /^plan(-.+)?\.json$/.test(f))
    .forEach((f) => cpSync(path.join(quelle, f), datei(f)));
  cpSync(path.join(quelle, 'pruefung', 'plan-vorher.py'), datei('pruefung/plan-vorher.py'));

  // Der Ausgangszustand von tools/plan-vorher/, unabhängig vom echten Repo:
  // für den Cut ein Glied der Kette, das nicht der laufende Plan ist (Einheit 2
  // umgedreht), also ein älterer Stand – für den Standardplan ausdrücklich keins.
  const cut = plan('plan-cut.json');
  const veraltet = umgebaut(cut, 2);
  mkdirSync(datei('plan-vorher/cut'), { recursive: true });
  schreibe(glied('cut', veraltet), veraltet);

  check(standVon(cut) === PLANS.cut.stand && standVon(plan('plan.json')) === PLANS.standard.stand,
    `der Fingerabdruck im Test ist der aus js/data.js (${PLANS.cut.stand}, ${PLANS.standard.stand})`);
  check(standVon(veraltet) !== PLANS.cut.stand && standVon(umgebaut(cut, 1)) !== PLANS.cut.stand,
    'Umdrehen einer Einheit ergibt wirklich einen neuen Stand');

  // Die echte Kette, so wie js/data.js sie mitbringt: jeder Stand aus
  // tools/plan-vorher/<variante>/ außer dem laufenden – und darunter die, die
  // am 03.10. überschrieben worden waren. Wer unter einem davon zuletzt
  // trainiert hat, bekommt seine angefangene Einheit sonst nur aus dem
  // Protokoll festgeschrieben.
  for (const v of Object.keys(PLANS)) {
    const ordner = path.join(quelle, 'plan-vorher', v);
    const liegen = readdirSync(ordner).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5))
      .filter((s) => s !== PLANS[v].stand);
    const drin = (PLANS[v].vorher || []).map((k) => k.stand);
    check(Array.isArray(PLANS[v].vorher) && liegen.sort().join() === [...drin].sort().join()
        && PLANS[v].vorher.every((k) => k.ex.length === PLANS[v].plan.length),
    `${v}: js/data.js bringt die ganze Kette mit (${drin.join(', ')})`);
  }
  const alte = { cut: 'e06a6265485c', bbp: '0b49d3183b5b', oberkoerper: '905ce67222ec' };
  check(Object.entries(alte).every(([v, s]) => PLANS[v].vorher.some((k) => k.stand === s)),
    `auch die Stände, die ein neuer Plan einmal überschrieben hatte (${Object.values(alte).join(', ')})`);

  git('init', '-q');
  git('add', '.');
  git('commit', '-qm', 'ausgeliefert');
  const basis = git('rev-parse', 'HEAD').trim();

  // --- 1. Nichts geändert, oder nur Termine ----------------------------
  let r = tor([basis]);
  zeige(r.text);
  check(r.code === 0, 'unveränderte Pläne: das Tor lässt durch');

  const roh = plan('plan-cut.json');
  roh.plan.forEach((o) => {
    o.date = new Date(Date.parse(o.date) + 7 * 864e5).toISOString().slice(0, 10);
  });
  schreibe('plan-cut.json', roh);
  r = tor([basis]);
  check(r.code === 0, 'nur Termine verschoben (und die Datei anders formatiert): es lässt durch');
  git('checkout', '--', 'tools');

  // --- 2. Neuer Stand, der Plan davor veraltet -------------------------
  umbauen('plan-cut.json');
  r = tor([basis]);
  zeige(r.text);
  check(r.code === 1, 'neuer Cut, in der Kette nur ein älterer Stand: das Tor hält an');
  check(r.text.includes(`tools/plan-vorher/cut/${PLANS.cut.stand}.json fehlt`),
    `es nennt die Datei, die fehlt – benannt nach dem ausgelieferten Stand (${PLANS.cut.stand})`);
  check(r.text.includes(`tools/plan-cut.json: ${PLANS.cut.stand} → ${standVon(plan('plan-cut.json'))}`),
    `sein Fingerabdruck ist der aus js/data.js (${PLANS.cut.stand})`);
  const befehl = `git show ${basis}:tools/plan-cut.json > tools/plan-vorher/cut/${PLANS.cut.stand}.json`;
  check(r.text.includes(befehl), 'es nennt den Befehl, der den ausgelieferten Cut dorthin holt');
  check(!/plan-bbp|plan-oberkoerper|plan\.json/.test(r.text),
    'und nur den Plan, der sich geändert hat');

  // --- 3. Den genannten Befehl ausgeführt ------------------------------
  befehle(r.text);
  check(readFileSync(datei(`plan-vorher/cut/${PLANS.cut.stand}.json`), 'utf8')
    === readFileSync(path.join(quelle, 'plan-cut.json'), 'utf8'),
  'danach liegt dort der ausgelieferte Cut, Byte für Byte');
  check(readdirSync(datei('plan-vorher/cut')).sort().join()
      === [`${PLANS.cut.stand}.json`, `${standVon(veraltet)}.json`].sort().join(),
  'neben dem älteren Stand – die Kette wird länger, nichts wird überschrieben');
  r = tor([basis]);
  zeige(r.text);
  check(r.code === 0, 'und das Tor lässt durch');

  // --- 4. Der Standardplan heißt dort standard.json --------------------
  umbauen('plan.json');
  r = tor([basis]);
  check(r.code === 1 && r.text.includes(`tools/plan-vorher/standard/${PLANS.standard.stand}.json fehlt`),
    'neuer Standardplan ohne Kette unter tools/plan-vorher/standard/: das Tor hält an');
  check(r.text.includes(`tools/plan.json: ${PLANS.standard.stand} →`),
    `auch hier der Fingerabdruck aus js/data.js (${PLANS.standard.stand})`);
  check(r.text.includes('mkdir -p tools/plan-vorher/standard')
      && r.text.includes(`git show ${basis}:tools/plan.json > tools/plan-vorher/standard/${PLANS.standard.stand}.json`),
  'mit den Befehlen, die den Ordner anlegen und ihn dorthin holen');
  befehle(r.text);
  check(tor([basis]).code === 0, 'genau die ausgeführt: das Tor lässt durch');
  rmSync(datei('plan-vorher/standard'), { recursive: true, force: true });

  // --- 4b. Die Kette wird nur länger ------------------------------------
  //
  // Bis zum 03.10. lag je Variante eine Datei, und jeder neue Plan überschrieb
  // sie. Ein Nutzer, der eine Fassung übersprungen hatte, lief danach unter
  // einem Stand, den die App nicht mehr kannte. Ein Glied, das im
  // ausgelieferten Stand lag, darf deshalb nicht verschwinden.
  git('checkout', '--', 'tools');
  rmSync(datei(glied('cut', veraltet)));
  r = tor([basis]);
  zeige(r.text);
  check(r.code === 1 && r.text.includes(`> tools/plan-vorher/cut/${standVon(veraltet)}.json`),
    `ein Glied der Kette gelöscht: das Tor hält an und nennt es (${standVon(veraltet)})`);
  befehle(r.text);
  check(readFileSync(datei(glied('cut', veraltet)), 'utf8').length > 0 && tor([basis]).code === 0,
    'der genannte Befehl holt es zurück, und das Tor lässt durch');

  // Ausgeliefert war noch die eine Datei von früher (tools/plan-vorher/cut.json),
  // in der Kette fehlt ihr Stand: Auch der darf nicht verloren gehen – genau so
  // ist der Cut e06a62 verschwunden.
  git('checkout', '-qb', 'alt-einzeln', basis);
  rmSync(datei('plan-vorher/cut'), { recursive: true, force: true });
  schreibe('plan-vorher/cut.json', veraltet);
  git('add', '-A');
  git('commit', '-qm', 'Ablage wie bis zum 03.10.: eine Datei je Variante');
  const einzeln = git('rev-parse', 'HEAD').trim();
  rmSync(datei('plan-vorher/cut.json'));
  r = tor([einzeln]);
  zeige(r.text);
  check(r.code === 1 && r.text.includes(`git show ${einzeln}:tools/plan-vorher/cut.json > tools/plan-vorher/cut/${standVon(veraltet)}.json`),
    'gegen die alte Ablage verglichen: ihr Stand muss in die Kette, mit dem Befehl dafür');
  befehle(r.text);
  check(tor([einzeln]).code === 0, 'danach liegt er dort, und das Tor lässt durch');
  git('checkout', '-qf', 'main');
  git('clean', '-qfd', 'tools');

  // Eine Datei unter fremdem Namen: Der Name ist der Stand.
  cpSync(datei(glied('cut', veraltet)), datei('plan-vorher/cut/aaaaaaaaaaaa.json'));
  r = tor([basis]);
  check(r.code === 1 && r.text.includes(`plan-vorher/cut/aaaaaaaaaaaa.json hat den Stand ${standVon(veraltet)}`),
    'eine Datei, die nicht wie ihr Stand heißt: das Tor hält an');
  rmSync(datei('plan-vorher/cut/aaaaaaaaaaaa.json'));

  // --- 5. Wo es nichts zu vergleichen gibt -----------------------------
  git('checkout', '--', 'tools');
  cpSync(datei('plan-cut.json'), datei('plan-neu.json'));
  r = tor([basis]);
  check(r.code === 0, 'eine neue Variante hat keinen Plan davor und verlangt keinen');
  r = tor(['0'.repeat(40)]);
  check(r.code === 0 && r.text.includes('nichts geprüft'),
    'Vergleichsstand 000… (etwa vor dem allerersten Push nach main): nichts geprüft, und das gesagt');
  rmSync(datei('plan-neu.json'));

  // --- 6. In CI: gegen den ausgelieferten Stand ------------------------
  //
  // Bis Runde 1 bekam das Tor in CI den Stand vor dem Push. Auf einem Zweig
  // ist der ab dem zweiten Push einer, den nie jemand hatte: Gegen ihn
  // verlangte es diesen Zwischenstand als Plan davor, und wer das befolgte,
  // scheiterte danach am Pull-Request gegen main. Hier zwei Pushes auf einem
  // Zweig, der erste hat den Plan davor vergessen.
  git('update-ref', 'refs/remotes/origin/main', basis);
  git('checkout', '-qb', 'zweig');
  const ereignis = path.join(wurzel, 'ereignis.json');
  const ci = (name, ref, daten) => {
    writeFileSync(ereignis, JSON.stringify(daten));
    return tor(['--ci'], { GITHUB_EVENT_NAME: name, GITHUB_REF: ref, GITHUB_EVENT_PATH: ereignis });
  };

  umbauen('plan-cut.json');
  git('commit', '-qam', 'Push 1: neuer Cut, Plan davor vergessen');
  const push1 = git('rev-parse', 'HEAD').trim();
  r = ci('push', 'refs/heads/zweig', { before: '0'.repeat(40) });
  zeige(r.text);
  check(r.code === 1 && r.text.includes('Abzweig von origin/main'),
    'Push 1 auf den Zweig (vorher = 000…): verglichen wird trotzdem, mit dem Abzweig von main');
  check(r.text.includes(befehl), 'und es verlangt den ausgelieferten Cut, nicht einen vom Zweig');

  befehle(r.text);
  umbauen('plan-cut.json', 3);
  git('add', '-A');
  git('commit', '-qm', 'Push 2: Plan davor nach Anweisung, Cut noch einmal anders');
  r = ci('push', 'refs/heads/zweig', { before: push1 });
  zeige(r.text);
  check(r.code === 0, 'Push 2 (vorher = Push 1): der Anweisung gefolgt, das Tor lässt durch');
  check(tor([push1]).code === 1,
    'gegen Push 1 als Vergleich hätte es angehalten – deshalb nicht der Stand vor dem Push');

  r = ci('pull_request', 'refs/pull/1/merge', { before: push1, pull_request: { base: { sha: basis } } });
  zeige(r.text);
  // Dass wirklich verglichen wurde: Dieselbe Bezeichnung steht auch in der
  // Meldung „kein Vergleichsstand … nichts geprüft", ebenfalls mit Exit 0.
  check(r.code === 0 && r.text.includes('Basis des Pull-Requests') && !r.text.includes('nichts geprüft')
      && r.text.includes(`cut ${PLANS.cut.stand} →`) && r.text.includes(basis.slice(0, 12)),
    'der Pull-Request vergleicht mit seiner Basis (main) und lässt durch');
  r = ci('pull_request', 'refs/pull/1/merge', { before: basis, pull_request: { base: { sha: push1 } } });
  check(r.code === 1 && r.text.includes(push1.slice(0, 12)),
    'mit Push 1 als Basis hält derselbe Pull-Request an – gelesen wird base.sha, nicht before');

  // Inzwischen ist main weitergegangen, mit einem anderen Plan. Der Zweig
  // zweigt weiter von `basis` ab und wird gegen den Abzweig geprüft, nicht
  // gegen die Spitze von main – gegen die hielte er wegen eines Plans an, den
  // er nie angefasst hat.
  git('checkout', '-qb', 'main-weiter', basis);
  umbauen('plan-bbp.json');
  git('commit', '-qam', 'main geht weiter: neuer BBP');
  const spitze = git('rev-parse', 'HEAD').trim();
  git('checkout', '-q', 'zweig');
  git('update-ref', 'refs/remotes/origin/main', spitze);
  r = ci('push', 'refs/heads/zweig', { before: push1 });
  zeige(r.text);
  check(r.code === 0 && r.text.includes(`${basis.slice(0, 12)}, Abzweig von origin/main`),
    'main ist weiter: der Zweig wird gegen seinen Abzweig geprüft und lässt durch');
  check(tor([spitze]).code === 1,
    'gegen die Spitze von main hätte er angehalten – deshalb der Abzweig');
  git('update-ref', 'refs/remotes/origin/main', basis);

  r = ci('push', 'refs/heads/main', { before: basis });
  zeige(r.text);
  check(r.code === 0 && r.text.includes('Stand vor dem Push nach main'),
    'und der Push nach main, gegen den Stand davor, auch');

  r = ci('push', 'refs/heads/main', { before: push1 });
  check(r.code === 1, 'auf main zählt der Stand vor dem Push – dort ist er der ausgelieferte');
} finally {
  rmSync(wurzel, { recursive: true, force: true });
}

console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
