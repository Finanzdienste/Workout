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


// --- v11: Gemini zuerst, Tavily für die Suche
const SSE = [
  'event: interaction.start\ndata: {"event_type":"interaction.start","interaction":{"status":"in_progress"}}',
  `data: ${JSON.stringify({ event_type: 'step.delta', delta: { type: 'text', text: JSON.stringify(REZEPT).slice(0, 40) } })}`,
  `data: ${JSON.stringify({ event_type: 'step.delta', delta: { type: 'text', text: JSON.stringify(REZEPT).slice(40) } })}`,
  'data: {"event_type":"interaction.completed","interaction":{"status":"completed","usage":{"total_input_tokens":1200,"total_output_tokens":300,"total_thought_tokens":50}}}',
].join('\r\n\r\n');
const gl = H.geminiLesen(SSE);
check(JSON.parse(gl.text).name === 'Spaghetti Bolognese' && gl.stop === null && gl.usage.output_tokens === 350 && gl.modell === H.GEMINI_MODELL, 'Datenstrom von Gemini gelesen (Text aus den Stücken, Verbrauch)');
const amEnde = H.geminiLesen(`data: ${JSON.stringify({ event_type: 'interaction.completed', interaction: { status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'text', text: '{"a":1}' }] }] } })}`);
check(amEnde.text === '{"a":1}', 'Text nur am Ende (nicht gestreamt) geht auch');
check(H.geminiLesen('data: {"event_type":"interaction.completed","interaction":{"status":"incomplete"}}').stop === 'max_tokens', 'abgeschnitten → max_tokens');
let geworfen = null;
try { H.geminiLesen('data: [{"error":{"code":429,"message":"quota"}}]'); } catch (e) { geworfen = e; }
check(geworfen?.status === 429, 'Fehler im Strom (als Liste) wird geworfen');

const gr = H.geminiRumpf({ art: 'auswerten', text: 'Linsen', bilder: [{ typ: 'image/jpeg', daten: 'QUJD' }], portionen: 2, hinweis: 'rezept' });
check(gr.model === 'gemini-3.8-flash' && gr.store === false && gr.stream === true && gr.input[0].type === 'image' && gr.input[0].mime_type === 'image/jpeg' && gr.input.at(-1).text.includes('2 Portionen'), 'Gemini-Rumpf wie in Boxenstopp: Foto, Text, store: false');
check(!JSON.stringify(gr.response_format.schema).includes('additionalProperties') && gr.response_format.mime_type === 'application/json', '… Schema ohne additionalProperties');

const TREFFER = [
  { titel: 'Döner Kebab Nährwerte – fddb', url: 'https://fddb.info/db/de/lebensmittel/doener/index.html', text: 'Döner Kebab: 215 kcal je 100 g, Kohlenhydrate 19 g, Eiweiß 12 g. Portion 1 Stück (350 g).' },
  { titel: 'Döner selbst machen', url: 'https://www.chefkoch.de/rezepte/doener', text: 'Rezept …' },
];
const DOENER = { ...REZEPT, art: 'packung', name: 'Döner Kebab', gesamt_gramm: 0, gesamt_kcal: 0, gesamt_kh: 0, gesamt_ei: 0, kcal_100g: 215, kh_100g: 19, ei_100g: 12, quelle: 'https://fddb.info/db/de/lebensmittel/doener/index.html', portion_text: '1 Döner (350 g)', portion_gramm: 350, zutaten: [], hinweis: 'Werte von fddb.' };
function umgebung11({ gemini = null, claude = null, suche = TREFFER, sucheWirft = null } = {}) {
  const log = { gemini: [], claude: [], suche: [], gemerkt: [] };
  const h = H.erstelleHandler({
    erlaubteUrspruenge: [HERKUNFT], zugang: async () => true, gezaehlt: async () => ({ zugang: 0, alle: 0 }), merken: async (e) => { log.gemerkt.push(e); },
    gemini: gemini && (async (r) => { log.gemini.push(r); return gemini(r); }),
    claude: claude && (async (r) => { log.claude.push(r); return claude(r); }),
    suchen: suche && (async (q) => { log.suche.push(q); if (sucheWirft) throw sucheWirft; return suche; }),
  });
  return { h, log };
}
const alsGemini = (obj) => async () => ({ text: JSON.stringify(obj), stop: null, modell: 'gemini-3.8-flash', usage: { input_tokens: 100, output_tokens: 50 } });

let u = umgebung11({ gemini: alsGemini(REZEPT), claude: alsGemini(REZEPT) });
res = await u.h(anfrage(rezeptText));
check(res.status === 200 && u.log.gemini.length === 1 && u.log.claude.length === 0 && u.log.gemerkt[0].usd === 0, 'Rezept: Gemini gefragt, Claude nicht, kostet 0');
u = umgebung11({ gemini: async () => { throw Object.assign(new Error('Server'), { grenze: false }); }, claude: alsGemini(REZEPT) });
res = await u.h(anfrage(rezeptText));
check(res.status === 200 && u.log.claude.length === 1, 'Gemini hakt: Claude springt ein, wenn es ihn gibt');
// Überlastet: reihum das nächste Gemini-Modell (wie Boxenstopp), das zuletzt gute zuerst
H.geminiModellZuruecksetzen();
let modelle = [];
u = umgebung11({ gemini: async (r) => { modelle.push(r.model); if (r.model !== 'gemini-3.6-flash') throw Object.assign(new Error('503 high demand'), {}); return alsGemini(REZEPT)(); }, claude: async () => { throw Object.assign(new Error('credit'), { dauerhaft: true }); } });
res = await u.h(anfrage(rezeptText));
check(res.status === 200 && modelle.join() === 'gemini-3.8-flash,gemini-3.7-flash,gemini-3.6-flash', `überlastet: 3.8 → 3.7 → 3.6 antwortet (${modelle.join()})`);
const gut = u.log.gemerkt.at(-1);
check(gut.ok === true && gut.grund === 'ok' && gut.modell === 'gemini-3.6-flash' && gut.versuche.map((v) => v.grund).join() === 'ueberlastet,ueberlastet,ok', 'Protokoll bei Erfolg: welches Modell, und dass zwei vorher überlastet waren');
check(['kontingent', 'zeit', 'guthaben', 'schluessel', 'fehler'].join() === [Object.assign(new Error('x'), { grenze: true }), new Error('Gemini: Zeit abgelaufen'), new Error('Your credit balance is too low'), Object.assign(new Error('401'), { dauerhaft: true }), new Error('kaputt')].map(H.grundVon).join(), 'Gründe: Kontingent, Zeit, Guthaben, Schlüssel, sonst „fehler“');
modelle = [];
res = await u.h(anfrage(rezeptText));
check(res.status === 200 && modelle[0] === 'gemini-3.6-flash', 'beim nächsten Mal gleich das Modell, das geantwortet hat');
modelle = [];
H.geminiModellZuruecksetzen();
u = umgebung11({ gemini: async (r) => { modelle.push(r.model); throw new Error('503 high demand'); }, claude: async () => { throw Object.assign(new Error('400 Your credit balance is too low to access the Anthropic API'), { dauerhaft: true }); } });
res = await u.h(anfrage(rezeptText));
let fe = (await res.json()).fehler;
check(res.status === 503 && modelle.length === 5 && fe.includes('überlastet') && !fe.includes('Tobi'), `alle überlastet, Claude ohne Guthaben: „überlastet, gleich noch einmal“ statt „Sag Tobi Bescheid“ (${fe})`);
const ein = u.log.gemerkt.at(-1);
check(ein.ok === false && ein.grund === 'ueberlastet' && ein.versuche.length === 6 && ein.versuche.slice(0, 5).every((v) => v.grund === 'ueberlastet') && ein.versuche[5].modell === 'claude-opus-5-5' && ein.versuche[5].grund === 'guthaben' && Number.isFinite(ein.ms), `v12 Protokoll: Grund „überlastet“, alle sechs Versuche mit Grund (${ein.versuche.map((v) => v.grund).join(',')})`);
modelle = [];
u = umgebung11({ gemini: async (r) => { modelle.push(r.model); throw Object.assign(new Error('401 key'), { dauerhaft: true }); } });
res = await u.h(anfrage(rezeptText));
check(res.status === 503 && modelle.length === 1 && (await res.json()).fehler.includes('Tobi'), 'Gemini-Schlüssel falsch: kein zweites Modell, „Sag Tobi Bescheid“');
H.geminiModellZuruecksetzen();
u = umgebung11({ gemini: async () => { throw Object.assign(new Error('quota'), { grenze: true }); } });
res = await u.h(anfrage(rezeptText));
check(res.status === 429 && (await res.json()).fehler.includes('Gratis-Kontingent'), 'Gratis-Kontingent bei Google aufgebraucht: 429 mit Satz');

u = umgebung11({ gemini: alsGemini(DOENER) });
res = await u.h(anfrage({ art: 'suchen', text: '  Döner   Kebab ' }));
const doener = (await res.json()).ergebnis;
check(res.status === 200 && u.log.suche[0] === 'Döner Kebab', 'Suche: Tavily bekommt den Suchbegriff (aufgeräumt)');
check(u.log.gemini[0].input.at(-1).text.includes('fddb.info') && u.log.gemini[0].input.at(-1).text.includes('Er sucht: Döner Kebab'), '… die KI bekommt die Ergebnisse');
check(doener.art === 'packung' && doener.kcal_100g === 215 && doener.ei_100g === 12 && doener.portion_gramm === 350 && doener.quelle.includes('fddb'), 'Ergebnis: 215 kcal und 12 g Eiweiß je 100 g, 1 Döner 350 g, Quelle fddb');
u = umgebung11({ gemini: alsGemini({ ...DOENER, quelle: 'https://ausgedacht.example/x' }) });
res = await u.h(anfrage({ art: 'suchen', text: 'Döner' }));
check((await res.json()).ergebnis.quelle === TREFFER[0].url, 'eine ausgedachte Quelle wird durch ein echtes Ergebnis ersetzt');
u = umgebung11({ gemini: alsGemini(DOENER), suche: [] });
res = await u.h(anfrage({ art: 'suchen', text: 'Xyzzy' }));
check(res.status === 404 && u.log.gemini.length === 0 && (await res.json()).fehler.includes('nichts'), 'nichts gefunden: 404, die KI wird gar nicht erst gefragt');
u = umgebung11({ gemini: alsGemini(DOENER), sucheWirft: Object.assign(new Error('432'), { grenze: true }) });
res = await u.h(anfrage({ art: 'suchen', text: 'Döner' }));
check(res.status === 429 && (await res.json()).fehler.includes('aufgebraucht'), 'Tavily-Kontingent aufgebraucht: 429');
u = umgebung11({ gemini: alsGemini(DOENER), suche: null });
res = await u.h(anfrage({ art: 'suchen', text: 'Döner' }));
check(res.status === 503 && (await res.json()).fehler.includes('TAVILY'), 'ohne Tavily-Schlüssel: 503');
res = await u.h(anfrage({ art: 'suchen', text: 'x' }));
check(res.status === 400, 'zu kurzer Suchbegriff: 400');
check(H.trefferOrdnen({ results: [{ title: 'a', url: 'javascript:alert(1)', content: 'x' }, { title: 'b', url: 'https://b.de', content: 'y'.repeat(5000) }] }).map((t) => `${t.url}:${t.text.length}`).join() === 'https://b.de/:1200', 'Tavily-Ergebnisse: nur http(s), Text gekürzt');

// Was eingerichtet ist (GET, ohne Code)
res = await umgebung11({ gemini: alsGemini(REZEPT) }).h(new Request('https://x.supabase.co/functions/v1/mahlzeit-ki', { headers: { origin: HERKUNFT } }));
let st = await res.json();
check(st.ki === true && st.gemini === true && st.claude === false && st.suche === true && res.headers.get('access-control-allow-origin') === HERKUNFT, 'GET: KI und Suche eingerichtet');
res = await umgebung11({ suche: TREFFER }).h(new Request('https://x.supabase.co/functions/v1/mahlzeit-ki'));
st = await res.json();
check(st.ki === false && st.suche === false, 'GET ohne Gemini und Claude: nichts davon (Suche braucht die KI)');
res = await umgebung11({ claude: alsGemini(REZEPT), suche: TREFFER }).h(new Request('https://x.supabase.co/functions/v1/mahlzeit-ki'));
st = await res.json();
check(st.ki === false && st.claude === true, 'GET nur mit Anthropic-Schlüssel (ohne Guthaben): KI bleibt aus – maßgeblich ist Gemini');

ende();
