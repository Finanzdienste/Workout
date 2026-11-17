/*
 * Mahlzeit v3: die Supabase-Funktion mahlzeit-ki – ohne Netz, ohne Deno.
 *
 * handler.ts bekommt Claude und die Datenbank hereingereicht; hier sind beide
 * nachgebaut. Geprüft wird, was schiefgehen darf und was nicht: ohne Code
 * kein Claude, ein falscher Code kostet nichts, Grenzen je Tag, kaputte
 * Fotos, eine Antwort mit unmöglichen Zahlen, ein Rezept, das über Summe und
 * Gewicht gerechnet wird, und was an Claude geht (Modell, Aufwand, Schema,
 * Fotos, Rückfallmodell).
 */
import * as H from '../mahlzeit/supabase/functions/mahlzeit-ki/handler.ts';
import { pruefer } from './mz-hilfe.mjs';

const { check, ende } = pruefer();
const CODE = 'ABCDE-FGHJK';
const HASH = await H.pruefsumme(CODE);
const HERKUNFT = 'https://finanzdienste.github.io';

function umgebung({ zugaenge = [HASH], gezaehlt = { zugang: 0, alle: 0 }, antwort = null, claudeWirft = false, ohneClaude = false } = {}) {
  const log = { claude: [], gemerkt: [] };
  const env = {
    erlaubteUrspruenge: [HERKUNFT],
    zugang: async (h) => zugaenge.includes(h),
    gezaehlt: async () => gezaehlt,
    merken: async (e) => { log.gemerkt.push(e); },
    claude: ohneClaude ? undefined : async (rumpf) => {
      log.claude.push(rumpf);
      if (claudeWirft) throw new Error('overloaded');
      return antwort || { text: JSON.stringify(REZEPT), stop: 'end_turn', modell: 'claude-opus-5-5', usage: { input_tokens: 2000, output_tokens: 1000 } };
    },
  };
  return { handler: H.erstelleHandler(env), log };
}

const REZEPT = {
  art: 'rezept', name: 'Spaghetti Bolognese', ean: '', portionen: 4, gesamt_gramm: 1800, gesamt_kcal: 2400, gesamt_kh: 260,
  kcal_100g: 999, kh_100g: 14, portion_text: '1 Teller (450 g)', portion_gramm: 450,
  zutaten: [{ name: 'Rinderhack', menge: '500 g', gramm: 500, kcal: 1250 }], hinweis: 'Nudeln gekocht gerechnet.',
};

const anfrage = (koerper, { code = CODE, herkunft = HERKUNFT, methode = 'POST' } = {}) => new Request('https://x.supabase.co/functions/v1/mahlzeit-ki', {
  method: methode,
  headers: { 'content-type': 'application/json', ...(code ? { 'x-zugang': code } : {}), ...(herkunft ? { origin: herkunft } : {}) },
  body: methode === 'POST' ? JSON.stringify(koerper) : undefined,
});
const rezeptText = { art: 'auswerten', text: '500 g Hack, 250 g Spaghetti, 1 Dose Tomaten, für 4', bilder: [], portionen: null, hinweis: 'rezept' };

// --- Vorabfrage und Herkunft
let { handler, log } = umgebung();
let res = await handler(new Request('https://x/', { method: 'OPTIONS', headers: { origin: HERKUNFT } }));
check(res.status === 204 && res.headers.get('access-control-allow-headers').includes('x-zugang'), 'Vorabfrage: x-zugang ist erlaubt');
check(res.headers.get('access-control-allow-origin') === HERKUNFT, 'CORS nur für GitHub Pages');
res = await handler(anfrage(rezeptText, { herkunft: 'https://boese.example' }));
check(res.status === 403 && log.claude.length === 0, 'fremde Herkunft: 403, Claude wird nicht gefragt');

// --- Code
res = await handler(anfrage(rezeptText, { code: '' }));
check(res.status === 401 && log.claude.length === 0, 'ohne Code: 401, kein Claude');
res = await handler(anfrage(rezeptText, { code: 'ZZZZZ-ZZZZZ' }));
check(res.status === 401 && (await res.json()).fehler.includes('stimmt nicht'), 'falscher Code: 401 mit Grund');
check(log.claude.length === 0 && log.gemerkt.length === 0, '… kostet nichts und zählt nicht');
res = await handler(anfrage({ art: 'pruefen' }, { code: 'abcde fghjk' }));
check(res.status === 200 && log.claude.length === 0, '„pruefen" mit gültigem Code (klein, mit Leerzeichen): 200, ohne Claude');
check(H.codeOrdnen('abcde-fghjk') === 'ABCDEFGHJK', 'Code: groß, ohne Bindestrich');

// --- Eingabe
for (const [koerper, wort, was] of [
  [{ art: 'auswerten', text: '', bilder: [] }, 'Text oder ein Foto', 'leer'],
  [{ art: 'auswerten', text: 'x'.repeat(6001) }, 'zu lang', 'Text zu lang'],
  [{ art: 'auswerten', bilder: [1, 2, 3, 4].map(() => ({ typ: 'image/jpeg', daten: 'QUJD' })) }, 'Höchstens 3', 'vier Fotos'],
  [{ art: 'auswerten', bilder: [{ typ: 'image/gif', daten: 'QUJD' }] }, 'JPEG', 'GIF'],
  [{ art: 'auswerten', bilder: [{ typ: 'image/jpeg', daten: 'kein base64!' }] }, 'kaputt', 'kaputtes Foto'],
  [{ art: 'loeschen' }, 'Unbekannte Art', 'unbekannte Art'],
]) {
  res = await handler(anfrage(koerper));
  const t = res.status === 400 ? (await res.json()).fehler : '';
  check(res.status === 400 && t.includes(wort), `${was}: 400 („${t}")`);
}
check(log.claude.length === 0, 'keine dieser Eingaben erreicht Claude');

// --- Grenzen
({ handler, log } = umgebung({ gezaehlt: { zugang: H.GRENZE_ZUGANG, alle: 3 } }));
res = await handler(anfrage(rezeptText));
check(res.status === 429 && (await res.json()).fehler.includes('Morgen'), `${H.GRENZE_ZUGANG} am Tag mit einem Code: dann 429`);
({ handler, log } = umgebung({ gezaehlt: { zugang: 0, alle: H.GRENZE_ALLE } }));
res = await handler(anfrage(rezeptText));
check(res.status === 429 && log.claude.length === 0, `${H.GRENZE_ALLE} am Tag für alle: dann 429, ohne Claude`);
({ handler } = umgebung({ ohneClaude: true }));
res = await handler(anfrage(rezeptText));
check(res.status === 503, 'ohne ANTHROPIC_API_KEY: 503');

// --- Ein Rezept
({ handler, log } = umgebung());
res = await handler(anfrage({ ...rezeptText, portionen: 3 }));
const { ergebnis } = await res.json();
check(res.status === 200 && ergebnis.name === 'Spaghetti Bolognese', 'Rezept: 200 mit Ergebnis');
check(ergebnis.kcal_100g === 133 && ergebnis.kh_100g === 14.4, `je 100 g aus Summe und Gewicht (2400 kcal / 1800 g = 133, nicht die 999 der KI): ${ergebnis.kcal_100g}, ${ergebnis.kh_100g}`);
const rumpf = log.claude[0];
check(rumpf.model === 'claude-opus-5-5' && rumpf.output_config.effort === 'medium', 'an Claude: Opus 5.5, Aufwand mittel');
check(rumpf.output_config.format.type === 'json_schema' && rumpf.output_config.format.schema.additionalProperties === false, '… mit festem JSON-Schema');
check(rumpf.fallbacks === 'default' && rumpf.betas.includes('server-side-fallback-2026-07-01'), '… mit Rückfallmodell bei einer Ablehnung');
check(!('thinking' in rumpf) && !('temperature' in rumpf), '… ohne thinking und temperature (bei Opus 5.5 ein Fehler)');
const textBlock = rumpf.messages[0].content.at(-1).text;
check(textBlock.includes('3 Portionen') && textBlock.includes('500 g Hack'), 'der Text und die Portionen gehen mit');
check(log.gemerkt.length === 1 && log.gemerkt[0].ok && Math.abs(log.gemerkt[0].usd - (2000 * 4 + 1000 * 20) / 1e6) < 1e-9, `Kosten gemerkt: ${log.gemerkt[0].usd} $`);

// --- Fotos
({ handler, log } = umgebung());
res = await handler(anfrage({ art: 'auswerten', text: '', bilder: [{ typ: 'image/jpeg', daten: 'QUJDRA==' }, { typ: 'image/png', daten: 'QUJD' }], hinweis: 'packung' }));
const inhalt = log.claude[0].messages[0].content;
check(inhalt.length === 3 && inhalt[0].type === 'image' && inhalt[0].source.media_type === 'image/jpeg' && inhalt[1].source.media_type === 'image/png', 'zwei Fotos als Bilder vor dem Text');
check(inhalt[2].text.includes('Packung') && inhalt[2].text.includes('2 Fotos'), '… mit dem Hinweis „Packung"');

// --- Unmögliche Zahlen, Ablehnung, Fehler
const komisch = { ...REZEPT, art: 'packung', name: '  Riegel  ', ean: '40-08400-40162-1', kcal_100g: 1450, kh_100g: 180, portion_gramm: -3, hinweis: 'x'.repeat(900), zutaten: [{ name: '', menge: '', gramm: 0, kcal: 0 }] };
({ handler } = umgebung({ antwort: { text: JSON.stringify(komisch), stop: 'end_turn', modell: 'claude-opus-5-5', usage: {} } }));
const e2 = (await (await handler(anfrage(rezeptText))).json()).ergebnis;
check(e2.kcal_100g === 950 && e2.kh_100g === 100, `Packung mit 1450 kcal je 100 g: gekappt auf 950 (${e2.kcal_100g})`);
check(e2.portion_gramm === 0 && e2.name === 'Riegel' && e2.hinweis.length <= 400 && e2.zutaten.length === 0, 'negative Portion, Leerzeichen, langer Hinweis, leere Zutat: aufgeräumt');
check(e2.ean === '4008400401621', 'Strichcode nur aus Ziffern');
({ handler, log } = umgebung({ antwort: { text: '', stop: 'refusal', modell: 'claude-opus-5-5', usage: { input_tokens: 100, output_tokens: 0 } } }));
res = await handler(anfrage(rezeptText));
check(res.status === 502 && log.gemerkt[0].ok === false, 'Ablehnung: 502, als misslungen gemerkt (zählt zur Grenze)');
({ handler, log } = umgebung({ antwort: { text: '{kaputt', stop: 'end_turn', modell: 'claude-opus-5-5', usage: {} } }));
res = await handler(anfrage(rezeptText));
check(res.status === 502, 'kaputtes JSON: 502 mit Satz statt Absturz');
({ handler, log } = umgebung({ claudeWirft: true }));
res = await handler(anfrage(rezeptText));
check(res.status === 502 && (await res.json()).fehler.includes('noch einmal'), 'Claude nicht erreichbar: 502, „gleich noch einmal versuchen"');
check(res.headers.get('access-control-allow-origin') === HERKUNFT, '… auch dann mit CORS (sonst sähe die App nur „Netzfehler")');

// Guthaben leer o. ä.: nicht „gleich noch einmal", sondern Bescheid sagen
const leer = H.erstelleHandler({ erlaubteUrspruenge: [HERKUNFT], zugang: async () => true, gezaehlt: async () => ({ zugang: 0, alle: 0 }), merken: async () => {},
  claude: async () => { throw Object.assign(new Error('Your credit balance is too low'), { dauerhaft: true }); } });
res = await leer(anfrage(rezeptText));
check(res.status === 503 && (await res.json()).fehler.includes('Sag Tobi Bescheid'), 'Guthaben leer (dauerhafter Fehler): 503 „Sag Tobi Bescheid"');

// --- Die Datenbank hakt
const kaputt = H.erstelleHandler({ erlaubteUrspruenge: [HERKUNFT], zugang: async () => { throw new Error('db'); }, gezaehlt: async () => ({ zugang: 0, alle: 0 }), merken: async () => {} });
res = await kaputt(anfrage(rezeptText));
check(res.status === 503 && res.headers.get('access-control-allow-origin') === HERKUNFT, 'Datenbank nicht erreichbar: 503 mit CORS');

// --- Was Claude über den Mann erfährt
check(!/Tobi/.test(H.SYSTEM), 'kein Name im Systemtext');
check(H.SYSTEM.includes('Keine Ernährungs- oder Gesundheitsratschläge'), 'Systemtext: keine Gesundheitsratschläge');

ende();
