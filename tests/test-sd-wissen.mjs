/*
 * Schilddrüse: die Wissenstexte.
 *
 * Die Texte wurden vor dem Bau Satz für Satz von drei unabhängigen Prüfern
 * gegengelesen. Dieser Test hält fest, was dabei die Linie war: kein Satz
 * weist an, die Dosis zu ändern; die Warnzeichen und Notrufnummern sind da;
 * jede Seite verweist auf die Ärztin. Und alle Kapitel öffnen sich.
 */
import { oeffne, standMit, plus } from './sd-hilfe.mjs';

const TAG = '2026-03-10';
const { page, check, ende } = await oeffne({ tag: TAG, stand: standMit(plus(TAG, -3)) });

const kapitel = await page.evaluate(async () => (await import('./js/wissen.js')).KAPITEL.map((k) => ({ id: k.id, titel: k.titel, html: k.html })));
check(kapitel.length >= 8, `${kapitel.length} Kapitel`);
const alles = kapitel.map((k) => k.html.replace(/<[^>]+>/g, ' ')).join('\n');

const verboten = [
  /erhöhen Sie/i, /reduzieren Sie/i, /verringern Sie die Dosis/i, /nehmen Sie (eine|zwei|mehr|weniger)/i,
  /verdoppeln Sie/i, /setzen Sie .* ab/i, /Ihr Wert ist/i, /Sie haben (eine|einen)/i,
];
verboten.forEach((re) => check(!re.test(alles), `keine Anweisung zur Dosis und keine Diagnose: ${re}`));

check(/Nie die doppelte Menge/.test(alles), 'vergessene Tablette: „Nie die doppelte Menge"');
check(/30 Minuten, besser 60 Minuten vor dem Frühstück/.test(alles), 'Einnahme: 30, besser 60 Minuten vor dem Frühstück');
check(/Leitungswasser/.test(alles), 'Einnahme: mit Leitungswasser');
check(/4 Stunden/.test(alles) && /Kalzium/.test(alles) && /Eisen/.test(alles), 'Abstand zu Kalzium und Eisen: 4 Stunden');
check(/Biotin/.test(alles), 'Biotin vor der Blutabnahme');
check(/6 bis 8 Wochen/.test(alles), 'Kontrolle 6 bis 8 Wochen nach Dosisänderung');
check(/erst <strong>nach<\/strong> der Abnahme|erst nach der Abnahme/.test(kapitel.map((k) => k.html).join('')), 'Tablette am Tag der Blutabnahme meist erst danach');
check(/keine Normwerte vor/.test(alles), 'Laborwerte: die App gibt keine Normwerte vor');
check(/Vorhofflimmern/.test(alles) && /Knochenschwund/.test(alles), 'Risiko von zu viel Hormon wird genannt');
check(/kein Mittel zum Abnehmen/.test(alles), 'L-Thyroxin ist kein Mittel zum Abnehmen');
check(/keine Dosis/.test(alles) && /kein Medizinprodukt/.test(alles), '„Über die App": keine Dosis, kein Medizinprodukt');

// Alle Kapitel öffnen sich; jedes verweist auf die Ärztin.
for (const k of kapitel) {
  await page.click('#reiter-mehr');
  await page.click('[data-seite="wissen"]');
  await page.click(`[data-seite="wissen-kapitel"][data-param="${k.id}"]`);
  const text = await page.locator('#ansicht').innerText();
  check(text.includes(k.titel) || (await page.locator('.kopf-titel').innerText()) === k.titel, `Kapitel „${k.titel}" öffnet sich`);
  check(/ärztliche Beratung/.test(text), `„${k.titel}": Hinweis, dass die App keine ärztliche Beratung ersetzt`);
}

// Notfall: Nummern als Knöpfe zum Anrufen.
await page.click('#reiter-mehr');
await page.click('[data-seite="wissen-kapitel"][data-param="notfall"]');
check(await page.locator('a[href="tel:112"]').count() === 1, 'Notruf 112 als Knopf zum Anrufen');
check(await page.locator('a[href="tel:116117"]').count() === 1, 'Bereitschaftsdienst 116 117 als Knopf');
check((await page.locator('#ansicht').innerText()).includes('Brustschmerz'), 'Brustschmerz als Grund für 112');

await ende();
