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
check(/Bereich von Ihrem Befund/.test(alles) && /Orientierungswerte/.test(alles), 'Laborwerte: Bereich vom Befund, sonst ausdrücklich Orientierungswerte');
check(/Vorhofflimmern/.test(alles) && /Knochenschwund/.test(alles), 'Risiko von zu viel Hormon wird genannt');
check(/kein Mittel zum Abnehmen/.test(alles), 'L-Thyroxin ist kein Mittel zum Abnehmen');
check(/rechnet keine neue Dosis/.test(alles) && /ersetzt keinen Arztbesuch/.test(alles) && /kein Medizinprodukt/.test(alles), '„Über die App": keine neue Dosis, kein Arztersatz, kein Medizinprodukt');

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
// Geändert in Runde 3 (D2): Der neue Abschnitt „Heute noch die Praxis
// anrufen" nennt 116 117 und 112 und macht beide dort selbst anrufbar –
// seitdem stehen beide Nummern zweimal im Kapitel, deshalb „mindestens einmal".
check(await page.locator('a[href="tel:112"]').count() >= 1, 'Notruf 112 als Knopf zum Anrufen');
check(await page.locator('a[href="tel:116117"]').count() >= 1, 'Bereitschaftsdienst 116 117 als Knopf');
check((await page.locator('#ansicht').innerText()).includes('Brustschmerz'), 'Brustschmerz als Grund für 112');

// ---------------------------------------------------------------- Runde 6: G19, G22, G23

// Dieselbe Lage mit derselben Frist wie im Warnzeichen-Check und auf „Heute".
const nurText = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const kap = (id) => kapitel.find((k) => k.id === id).html;
const warnfragen = await page.evaluate(async () => (await import('./js/einschaetzung.js')).WARNFRAGEN.map((f) => ({ key: f.key, gruppe: f.gruppe, text: f.text })));

// G19: Die 112-Liste nannte keine Blutung; „Nasenbluten, das nicht aufhört"
// stand nur unter „Heute noch die Praxis anrufen" – der Check nennt es bei 112.
const notfall112 = nurText(kap('notfall').split('</ul>')[0]);
const heuteNoch = nurText(kap('notfall').split('Heute noch die Praxis anrufen')[1].split('</ul>')[0]);
const w1Blutung = warnfragen.find((f) => f.key === 'blutung');
check(/Notruf 112/.test(notfall112) && /starken Blutung, die nicht aufhört/.test(notfall112) && /Nasenbluten, das nach 15 Minuten Zudrücken nicht steht/.test(notfall112)
  && /Bluterbrechen/.test(notfall112) && /schwarzem/.test(notfall112) && w1Blutung.gruppe === 'w1' && /15 Minuten Zudrücken/.test(w1Blutung.text),
`G19: „Wann anrufen, wann 112" nennt die Blutung, die nicht aufhört, bei 112 – wie W1 im Check (${notfall112.slice(0, 60)}…)`);
check(/Marcumar: Nasen- oder Zahnfleischbluten, das öfter kommt/.test(heuteNoch) && !/Nasenbluten, das nicht aufhört/.test(nurText(kap('notfall'))),
  'G19: … unter „Heute noch" nur die Blutungszeichen, die kein Notfall sind');

// G22: „einmal doppelt" – im Wissen „bei Herzkrankheit anrufen", im Check
// „beim nächsten Kontakt erwähnen … wenn heute Herzklopfen". Jetzt gleich.
const doppelt = nurText(kap('vergessen'));
check(doppelt.includes('Treten in den nächsten Tagen Herzklopfen, Unruhe oder Zittern auf, die Praxis anrufen.')
  && /Bei einer Herzkrankheit oder einem Präparat mit T3-Anteil .{0,40}sagen Sie es der Praxis beim nächsten Kontakt, auch ohne Beschwerden/.test(doppelt)
  && !doppelt.includes('oder haben Sie eine Herzkrankheit'),
'G22: „einmal doppelt": anrufen bei Beschwerden in den nächsten Tagen, bei Herzkrankheit oder T3 beim nächsten Kontakt sagen – wie der Check');

// G23: neu unregelmäßiger Puls → heute (S4, W2h), neue Verwirrtheit → 112 (W1).
const zeichen = nurText(kap('zeichen'));
check(zeichen.includes('Ist der Puls neu unregelmäßig, rufen Sie heute noch die Praxis an') && zeichen.includes('Bei plötzlicher, neuer Verwirrtheit: sofort 112')
  && warnfragen.some((f) => f.key === 'verwirrt' && f.gruppe === 'w1'),
'G23: „Anzeichen" nennt für neu unregelmäßigen Puls und neue Verwirrtheit dieselbe Frist wie Check und Befinden');
check(nurText(kap('notfall')).includes('plötzlicher, neuer Verwirrtheit'), 'G23: … und „Wann anrufen, wann 112" führt die neue Verwirrtheit bei 112');
await page.click('#reiter-mehr');
await page.click('[data-seite="wissen"]');
await page.click('[data-seite="wissen-kapitel"][data-param="zeichen"]');
check(await page.locator('#ansicht a[href="tel:112"]').count() >= 1 && await page.locator('#ansicht a[href="tel:116117"]').count() >= 1
  && await page.locator('#ansicht [data-seite="wissen-kapitel"][data-param="notfall"]').count() >= 1,
'G23: … mit 112 und 116 117 als Knopf und dem Weg zu „Wann anrufen, wann 112"');
check(await page.evaluate(() => document.documentElement.scrollWidth) <= 390, 'G23: das Kapitel bleibt ohne waagerechtes Scrollen');

await ende();
