/*
 * mahlzeit-ki: Rezepte, Kochbuchseiten, Nährwerttabellen und Strichcodes für
 * die App „Mahlzeit" auswerten – mit Claude, über den Anthropic-Schlüssel, der
 * in diesem Supabase-Projekt ohnehin liegt (ANTHROPIC_API_KEY, wie amy-chat).
 *
 * Tobi, 17.11.2026: „ihm fehlen viele rezepte und zutaten. Lass doch per Api
 * ne ki einbauen in der er seine eigenen rezepte in textform reinschreiben
 * kann oder ne seite ausm kochbuch fotografieren aknn. Dann kann man ja
 * kalorien je 100g sagen" – und: „und barcode scanner".
 *
 * Der Schlüssel bleibt hier. Die App weist sich mit einem Freischalt-Code
 * aus (Kopf x-zugang), den Tobi mit dem Link verschickt; gespeichert ist nur
 * seine Prüfsumme (Tabelle mahlzeit_zugang). Je Code und Tag höchstens
 * GRENZE_ZUGANG Auswertungen, für alle zusammen GRENZE_ALLE – so bleibt ein
 * verlorener Code ein kleiner Schaden. Was eine Auswertung gekostet hat,
 * steht in mahlzeit_ki und, für die Übersicht in „Frag mal", in
 * fragmal_kosten (app „mahlzeit").
 *
 * v11 (21.11.2026), Tobi: „Wir benutzen in der anderen app ja gemini und
 * tavily. Können wir doch hier auch machen“. Seitdem fragt die Funktion
 * zuerst Gemini (gemini-3.8-flash, kostenlos, GEMINI_API_KEY; wie Boxenstopp
 * js/ki.js), Claude nur noch, wenn Gemini nicht kann und ein Anthropic-
 * Schlüssel da ist. Dazu „suchen“: ein Gericht oder Produkt, das die App nicht
 * kennt, sucht Tavily im Internet (TAVILY_API_KEY, wie rezept-web), die KI
 * liest die Nährwerte aus den Ergebnissen. GET sagt, was eingerichtet ist.
 * Gemini kostenlos heißt: Google darf die Anfragen zum Verbessern nutzen –
 * es geht nur das Rezept, das Foto oder der Suchbegriff hin, nichts über Uwe.
 *
 * Diese Datei kennt weder Deno noch das SDK: index.ts reicht Claude, Gemini,
 * die Suche und die Datenbank herein. So prüft tests/test-mz-ki.mjs alles hier
 * in Node.
 */

export const MODELL = "claude-opus-5-5";
/** Wie in Boxenstopp (js/ki.js): kostenlos über Googles Interactions-API. */
export const GEMINI_MODELL = "gemini-3.8-flash";
export const MAX_SUCHE = 200;
export const GRENZE_ZUGANG = 30;
export const GRENZE_ALLE = 100;
export const MAX_TEXT = 6000;
export const MAX_BILDER = 3;
export const MAX_BILD_B64 = 2_500_000;
const BILDTYPEN = ["image/jpeg", "image/png", "image/webp"];
const HINWEISE = ["rezept", "packung", "strichcode", "suche"];

export type Bild = { typ: string; daten: string };
export type Eingabe = { art: "auswerten" | "suchen"; text: string; bilder: Bild[]; portionen: number | null; hinweis: string };
export type Treffer = { titel: string; url: string; text: string };

export type ClaudeAntwort = {
  /** der Text der Antwort (JSON nach SCHEMA) */
  text: string;
  stop: string | null;
  modell: string;
  usage: Record<string, unknown>;
};

export type Umgebung = {
  erlaubteUrspruenge: string[];
  /** Gibt es diesen Code (als Prüfsumme) und ist er aktiv? */
  zugang: (hash: string) => Promise<boolean>;
  /** Auswertungen der letzten 24 Stunden: mit diesem Code und insgesamt. */
  gezaehlt: (hash: string) => Promise<{ zugang: number; alle: number }>;
  /** Eine Auswertung festhalten (auch eine misslungene, sie zählt mit). */
  merken: (eintrag: { hash: string; art: string; usd: number; modell: string; ok: boolean }) => Promise<void>;
  /** Fragt Claude; fehlt sie, ist der Schlüssel nicht eingerichtet. */
  claude?: (rumpf: Record<string, unknown>) => Promise<ClaudeAntwort>;
  /** Fragt Gemini (v11, zuerst gefragt, kostenlos); fehlt sie, gibt es keinen GEMINI_API_KEY. */
  gemini?: (rumpf: Record<string, unknown>) => Promise<ClaudeAntwort>;
  /** Sucht im Internet (Tavily, wie rezept-web in Boxenstopp); fehlt sie, gibt es keinen TAVILY_API_KEY. */
  suchen?: (q: string) => Promise<Treffer[]>;
};

export async function pruefsumme(code: string): Promise<string> {
  const daten = new TextEncoder().encode(codeOrdnen(code));
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", daten));
  return Array.from(h, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** „abcde-fghjk" → „ABCDEFGHJK": ohne Bindestrich, groß, nur Buchstaben und Ziffern. */
export function codeOrdnen(code: string): string {
  return String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

const kurz = (x: unknown, laenge: number) => String(x ?? "").replace(/\s+/g, " ").trim().slice(0, laenge);

// --- Was Claude bekommt ----------------------------------------------------

export const SYSTEM = `Du rechnest für eine Kalorien-App aus, wie viele Kalorien und Kohlenhydrate in einem Essen stecken. Die App benutzt ein Mann in Deutschland, der abnehmen will und Probleme mit dem Blutzucker hat. Er schickt dir eins von dreien:

1. Ein Rezept – als Text oder als Foto einer Kochbuchseite oder eines Zettels. Lies die Zutaten mit Mengen. Rechne je Zutat mit üblichen deutschen Nährwerten (Bundeslebensmittelschlüssel, Packungsangaben) für das rohe Gewicht. Fehlt eine Menge, nimm eine übliche an und sag es im Hinweis. Schätze das Gewicht des fertigen Gerichts: Nudeln, Reis und Hülsenfrüchte nehmen beim Kochen Wasser auf (gekocht etwa 2,5-fach, Reis etwa 3-fach), Fleisch verliert etwa ein Viertel, Gemüse beim Schmoren etwas, Wasser oder Brühe, die verkocht, zählt nur zum Teil. Daraus kcal und Kohlenhydrate je 100 g des fertigen Gerichts. Steht im Rezept, für wie viele Personen es ist, nimm das als Portionen; sonst schätze es aus den Mengen (rund 400 bis 500 g fertiges Essen je Hauptgericht-Portion).
2. Eine Nährwerttabelle oder Packung (Foto). Lies die Werte je 100 g (oder 100 ml) genau ab, nicht schätzen. Steht eine Portion auf der Packung („1 Riegel = 50 g"), nimm sie als Portion, sonst 100 g. Den Namen des Produkts (mit Marke, wenn zu sehen) als Name.
3. Ein Strichcode (Foto). Lies die Ziffern unter den Strichen (EAN, meist 13 oder 8 Ziffern) und gib sie als ean zurück. Die Nährwerte lässt du dann bei 0, die App schlägt die Nummer selbst nach – außer, auf dem Foto ist auch die Nährwerttabelle lesbar.
4. Eine Suche: Er nennt ein Gericht oder Produkt, das die App nicht kennt („Döner Kebab", „Snickers", „Leberkäsbrötchen"), dazu bekommst du Ergebnisse einer Internetsuche. Nimm die Nährwerte je 100 g aus den Ergebnissen – Herstellerangaben und Nährwerttabellen (fddb, Packungen, Hersteller) vor Rezeptseiten; widersprechen sie sich, nimm einen mittleren, üblichen Wert. art „packung", als Portion eine übliche (1 Döner, 1 Riegel, 1 Teller) mit Gramm. quelle: die Adresse des Ergebnisses, auf das du dich vor allem stützt. Steht in den Ergebnissen nichts Brauchbares, schätze mit üblichen Werten und sag es im hinweis.

Regeln:
- Alle Texte auf Deutsch, kurz und alltagstauglich. Name: wie man das Gericht nennt („Spaghetti Bolognese", „Linseneintopf"), höchstens 40 Zeichen.
- zutaten: je Zutat Name, Menge wie im Rezept, das angenommene rohe Gewicht in g und ihre kcal – bei einer Packung oder einem Strichcode leer.
- Zahlen ohne Einheit. kcal auf ganze Zahlen, Gramm auf ganze Zahlen, Kohlenhydrate und Eiweiß auf eine Stelle.
- Eiweiß (ei_100g, gesamt_ei) wie die Kohlenhydrate mitrechnen.
- quelle: nur bei einer Suche (Fall 4), sonst leer.
- hinweis: ein, zwei Sätze, was du angenommen hast (fehlende Mengen, Gewicht nach dem Kochen, unleserliche Stellen). Keine Ernährungs- oder Gesundheitsratschläge.
- Ist nichts davon zu erkennen (kein Essen, unleserlich), art „unklar", alle Zahlen 0, und im hinweis, was gefehlt hat.`;

export const SCHEMA = {
  type: "object",
  properties: {
    art: { type: "string", enum: ["rezept", "packung", "strichcode", "unklar"] },
    name: { type: "string" },
    ean: { type: "string", description: "nur Ziffern, leer wenn keiner zu sehen ist" },
    portionen: { type: "integer" },
    gesamt_gramm: { type: "number", description: "fertiges Gericht bzw. Packungsinhalt in g, 0 wenn unbekannt" },
    gesamt_kcal: { type: "number" },
    gesamt_kh: { type: "number" },
    kcal_100g: { type: "number" },
    kh_100g: { type: "number" },
    gesamt_ei: { type: "number" },
    ei_100g: { type: "number" },
    quelle: { type: "string", description: "nur bei einer Suche: die Adresse, aus der die Werte stammen" },
    portion_text: { type: "string", description: "z. B. „1 Teller (450 g)\" oder „1 Riegel (50 g)\"" },
    portion_gramm: { type: "number" },
    zutaten: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          menge: { type: "string" },
          gramm: { type: "number" },
          kcal: { type: "number" },
        },
        required: ["name", "menge", "gramm", "kcal"],
        additionalProperties: false,
      },
    },
    hinweis: { type: "string" },
  },
  required: ["art", "name", "ean", "portionen", "gesamt_gramm", "gesamt_kcal", "gesamt_kh", "kcal_100g", "kh_100g", "gesamt_ei", "ei_100g", "quelle", "portion_text", "portion_gramm", "zutaten", "hinweis"],
  additionalProperties: false,
};

/** Was zur Eingabe dazu geschrieben wird – für Claude und Gemini gleich. */
export function nutzerText(eingabe: Eingabe, treffer: Treffer[] = []): string {
  if (eingabe.art === "suchen") {
    const liste = treffer.map((t, i) => `[${i + 1}] ${t.titel}\n${t.url}\n${t.text}`).join("\n\n");
    return `Das ist eine Suche. Er sucht: ${eingabe.text}\n\nErgebnisse der Internetsuche:\n\n${liste || "(keine)"}`;
  }
  const was = {
    rezept: "Das ist ein Rezept.",
    packung: "Das ist eine Packung oder Nährwerttabelle.",
    strichcode: "Das ist ein Strichcode.",
  }[eingabe.hinweis] ?? "";
  return [
    was,
    eingabe.portionen ? `Er isst davon ${eingabe.portionen} Portionen (so oft teilt er es auf).` : "",
    eingabe.bilder.length ? `${eingabe.bilder.length === 1 ? "Ein Foto" : `${eingabe.bilder.length} Fotos`} anbei.` : "",
    eingabe.text ? `Sein Text:\n${eingabe.text}` : "",
  ].filter(Boolean).join("\n\n");
}

/** Ein Schema ohne additionalProperties – das kennt Gemini nicht (wie ohneZusatz in Boxenstopp). */
function ohneZusatz(k: unknown): unknown {
  if (Array.isArray(k)) return k.map(ohneZusatz);
  if (!k || typeof k !== "object") return k;
  return Object.fromEntries(Object.entries(k).filter(([key]) => key !== "additionalProperties").map(([key, v]) => [key, ohneZusatz(v)]));
}

/**
 * Der Rumpf für Geminis Interactions-API (POST /v1beta/interactions), gebaut
 * wie anfrageBauenGemini in Boxenstopp. store: false – Google soll die Anfrage
 * nicht als Gesprächsverlauf aufheben.
 */
export function geminiRumpf(eingabe: Eingabe, treffer: Treffer[] = []): Record<string, unknown> {
  const input: Record<string, unknown>[] = eingabe.bilder.map((b) => ({ type: "image", data: b.daten, mime_type: b.typ }));
  input.push({ type: "text", text: nutzerText(eingabe, treffer) });
  return {
    model: GEMINI_MODELL,
    system_instruction: SYSTEM,
    input,
    response_format: { type: "text", mime_type: "application/json", schema: ohneZusatz(SCHEMA) },
    generation_config: { max_output_tokens: 8000 },
    store: false,
    stream: true,
  };
}

/**
 * Den Datenstrom der Interactions-API lesen (wie verarbeiteGemini in
 * Boxenstopp): step.delta mit Text, zum Schluss der Status und der Verbrauch.
 */
export function geminiLesen(sse: string): ClaudeAntwort {
  let text = "";
  let stop: string | null = null;
  const usage: Record<string, unknown> = {};
  for (const block of sse.replace(/\r\n/g, "\n").split("\n\n")) {
    const daten = block.split("\n").filter((z) => z.startsWith("data:")).map((z) => z.slice(5).trimStart()).join("\n");
    if (!daten) continue;
    let ev: Record<string, unknown>;
    try { ev = JSON.parse(daten); } catch { continue; }
    if (Array.isArray(ev)) ev = ev[0] ?? {};
    const err = ev.error as { code?: number; message?: string } | undefined;
    if (ev.event_type === "error" || err) {
      throw Object.assign(new Error(err?.message || "Gemini-Fehler"), { status: Number(err?.code) || 500 });
    }
    if (ev.event_type === "step.delta") {
      const d = ev.delta as { type?: string; text?: string } | undefined;
      if (d?.type === "text" && typeof d.text === "string") text += d.text;
      continue;
    }
    const ia = (ev.interaction ?? ev) as Record<string, unknown>;
    const u = ia.usage as Record<string, unknown> | undefined;
    if (u) {
      usage.input_tokens = Number(u.total_input_tokens) || 0;
      usage.output_tokens = (Number(u.total_output_tokens) || 0) + (Number(u.total_thought_tokens) || 0);
    }
    if (typeof ia.status === "string" && !["in_progress", "completed"].includes(ia.status)) {
      stop = ia.status === "incomplete" ? "max_tokens" : /safety|block|prohibit|recitation/i.test(JSON.stringify(ia)) ? "refusal" : ia.status;
    }
    if (!text && Array.isArray(ia.steps)) {
      for (const st of ia.steps as { type?: string; content?: { type?: string; text?: string }[] }[]) {
        if (st.type === "model_output") for (const c of st.content ?? []) if (c.type === "text" && typeof c.text === "string") text += c.text;
      }
    }
  }
  return { text, stop, modell: GEMINI_MODELL, usage };
}

/** Die Ergebnisse von Tavily – höchstens fünf, Text gekürzt, nur http(s). */
export function trefferOrdnen(d: unknown): Treffer[] {
  const liste = Array.isArray((d as { results?: unknown })?.results) ? (d as { results: Record<string, unknown>[] }).results : [];
  return liste.slice(0, 5).flatMap((x) => {
    let url = "";
    try { const u = new URL(String(x.url ?? "")); if (u.protocol === "https:" || u.protocol === "http:") url = u.href; } catch { /* keine */ }
    return url ? [{ titel: kurz(x.title, 160), url, text: kurz(x.content, 1200) }] : [];
  });
}

/** Der Rumpf für die Messages-API (ohne Modell-Client – den hat index.ts). */
export function anfrageRumpf(eingabe: Eingabe, treffer: Treffer[] = []): Record<string, unknown> {
  const inhalt: Record<string, unknown>[] = eingabe.bilder.map((b) => ({
    type: "image",
    source: { type: "base64", media_type: b.typ, data: b.daten },
  }));
  inhalt.push({ type: "text", text: nutzerText(eingabe, treffer) });
  return {
    model: MODELL,
    max_tokens: 16000,
    system: SYSTEM,
    messages: [{ role: "user", content: inhalt }],
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    // Lehnt Claude Opus 5.5 ab (Sicherheitsfilter, bei Rezepten kaum zu
    // erwarten), springt ein anderes Modell ein, statt dass nichts kommt.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  };
}

// --- Eingabe prüfen --------------------------------------------------------

export function eingabePruefen(roh: unknown): Eingabe | string {
  if (!roh || typeof roh !== "object") return "Kein JSON.";
  const r = roh as Record<string, unknown>;
  if (r.art === "suchen") {
    const q = typeof r.text === "string" ? r.text.replace(/\s+/g, " ").trim() : "";
    if (q.length < 2) return "Wonach soll ich suchen?";
    if (q.length > MAX_SUCHE) return `Bitte kürzer (höchstens ${MAX_SUCHE} Zeichen).`;
    return { art: "suchen", text: q, bilder: [], portionen: null, hinweis: "suche" };
  }
  if (r.art !== "auswerten") return "Unbekannte Art.";
  const text = typeof r.text === "string" ? r.text.trim() : "";
  if (text.length > MAX_TEXT) return `Der Text ist zu lang (höchstens ${MAX_TEXT} Zeichen).`;
  const bilder = Array.isArray(r.bilder) ? r.bilder : [];
  if (bilder.length > MAX_BILDER) return `Höchstens ${MAX_BILDER} Fotos.`;
  const gute: Bild[] = [];
  for (const b of bilder) {
    const typ = String((b as Bild)?.typ ?? "");
    const daten = String((b as Bild)?.daten ?? "");
    if (!BILDTYPEN.includes(typ)) return "Nur Fotos als JPEG, PNG oder WebP.";
    if (!daten || daten.length > MAX_BILD_B64 || !/^[A-Za-z0-9+/]+=*$/.test(daten)) return "Ein Foto ist zu groß oder kaputt.";
    gute.push({ typ, daten });
  }
  if (!text && !gute.length) return "Bitte einen Text oder ein Foto schicken.";
  const p = Number(r.portionen);
  const portionen = Number.isInteger(p) && p >= 1 && p <= 20 ? p : null;
  const hinweis = HINWEISE.includes(String(r.hinweis)) ? String(r.hinweis) : "rezept";
  return { art: "auswerten", text, bilder: gute, portionen, hinweis };
}

// --- Antwort aufräumen -----------------------------------------------------

const zahl = (x: unknown, max: number, stellen = 0) => {
  const n = Number(x);
  if (!Number.isFinite(n) || n < 0) return 0;
  const f = 10 ** stellen;
  return Math.round(Math.min(n, max) * f) / f;
};

/**
 * Was Claude liefert, in Grenzen, die ein Essen haben kann – ein Lesefehler
 * („1450 kcal pro 100 g") darf nicht in der App landen. Passen Summe und
 * Gewicht zusammen, gilt die Rechnung daraus für 100 g.
 */
export function ergebnisOrdnen(roh: Record<string, unknown>, treffer: Treffer[] = []) {
  const art = ["rezept", "packung", "strichcode", "unklar"].includes(String(roh.art)) ? String(roh.art) : "unklar";
  const gesamtGramm = zahl(roh.gesamt_gramm, 20000);
  const gesamtKcal = zahl(roh.gesamt_kcal, 30000);
  const gesamtKh = zahl(roh.gesamt_kh, 5000, 1);
  let kcal100 = zahl(roh.kcal_100g, 950);
  let kh100 = zahl(roh.kh_100g, 100, 1);
  const gesamtEi = zahl(roh.gesamt_ei, 3000, 1);
  let ei100 = zahl(roh.ei_100g, 100, 1);
  if (art === "rezept" && gesamtGramm >= 50 && gesamtKcal > 0) {
    kcal100 = Math.min(950, Math.round((gesamtKcal / gesamtGramm) * 100));
    kh100 = Math.min(100, Math.round((gesamtKh / gesamtGramm) * 1000) / 10);
    if (gesamtEi > 0) ei100 = Math.min(100, Math.round((gesamtEi / gesamtGramm) * 1000) / 10);
  }
  // Nur eine Adresse aus den Suchergebnissen – keine, die sich die KI ausgedacht hat.
  const quelle = treffer.find((t) => t.url === String(roh.quelle ?? "").trim())?.url ?? (treffer.length && art !== "unklar" ? treffer[0].url : "");
  const zutaten = (Array.isArray(roh.zutaten) ? roh.zutaten : []).slice(0, 30).map((z) => {
    const e = (z ?? {}) as Record<string, unknown>;
    return { name: kurz(e.name, 60), menge: kurz(e.menge, 40), gramm: zahl(e.gramm, 10000), kcal: zahl(e.kcal, 20000) };
  }).filter((z) => z.name);
  const ean = String(roh.ean ?? "").replace(/\D/g, "");
  return {
    art,
    name: kurz(roh.name, 40) || (art === "packung" ? "Packung" : "Rezept"),
    ean: /^\d{8,14}$/.test(ean) ? ean : "",
    portionen: Math.max(1, Math.min(20, Math.round(Number(roh.portionen) || 1))),
    gesamt_gramm: gesamtGramm,
    gesamt_kcal: gesamtKcal,
    gesamt_kh: gesamtKh,
    kcal_100g: kcal100,
    kh_100g: kh100,
    gesamt_ei: gesamtEi,
    ei_100g: ei100,
    quelle,
    portion_text: kurz(roh.portion_text, 40),
    portion_gramm: zahl(roh.portion_gramm, 5000),
    zutaten,
    hinweis: kurz(roh.hinweis, 400),
  };
}

// --- Kosten ----------------------------------------------------------------

/* US-Dollar je Million Tokens, Stand November 2026 (wie amy-chat/kosten.js). */
const PREISE: Record<string, { ein: number; schreiben: number; lesen: number; aus: number }> = {
  opus: { ein: 4, schreiben: 5, lesen: 0.2, aus: 20 },
  fable: { ein: 8, schreiben: 10, lesen: 0.2, aus: 40 },
  sonnet: { ein: 2, schreiben: 2.5, lesen: 0.1, aus: 10 },
  haiku: { ein: 0.1, schreiben: 0.125, lesen: 0.01, aus: 0.5 },
};

export function kostenUSD(usage: Record<string, unknown>, modell: string): number {
  const m = String(modell);
  const p = /fable|mythos/.test(m) ? PREISE.fable : /sonnet/.test(m) ? PREISE.sonnet : /haiku/.test(m) ? PREISE.haiku : PREISE.opus;
  const n = (k: string) => (Number.isFinite(Number(usage?.[k])) ? Number(usage[k]) : 0);
  return (n("input_tokens") * p.ein + n("cache_creation_input_tokens") * p.schreiben
    + n("cache_read_input_tokens") * p.lesen + n("output_tokens") * p.aus) / 1_000_000;
}

// --- Der Handler -----------------------------------------------------------

export function erstelleHandler(env: Umgebung) {
  function cors(req: Request): Record<string, string> {
    const herkunft = req.headers.get("origin") ?? "";
    return {
      "Access-Control-Allow-Origin": env.erlaubteUrspruenge.includes(herkunft) ? herkunft : env.erlaubteUrspruenge[0] ?? "",
      "Access-Control-Allow-Headers": "content-type, x-zugang",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    };
  }

  return async function handler(req: Request): Promise<Response> {
    const koepfe = cors(req);
    const json = (status: number, daten: unknown) => new Response(JSON.stringify(daten), {
      status, headers: { ...koepfe, "Content-Type": "application/json; charset=utf-8" },
    });
    const fehler = (status: number, text: string) => json(status, { fehler: text });

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: koepfe });
    // Was eingerichtet ist (v11) – die App blendet danach die KI und die Suche ein. Nur ja/nein, kein Schlüssel.
    // Maßgeblich ist Gemini: Den Anthropic-Schlüssel gibt es schon (amy-chat), aber ohne Guthaben (17.11.) –
    // Claude ist nur noch Ersatz, wenn Gemini hakt.
    if (req.method === "GET") return json(200, { ki: !!env.gemini, gemini: !!env.gemini, claude: !!env.claude, suche: !!env.suchen && !!env.gemini });
    if (req.method !== "POST") return fehler(405, "Nur POST.");
    const herkunft = req.headers.get("origin");
    if (herkunft && !env.erlaubteUrspruenge.includes(herkunft)) return fehler(403, "Diese Adresse darf nicht fragen.");

    const code = codeOrdnen(req.headers.get("x-zugang") ?? "");
    if (code.length < 10) return fehler(401, "Der Freischalt-Code fehlt.");
    const hash = await pruefsumme(code);
    try {
      if (!(await env.zugang(hash))) return fehler(401, "Der Freischalt-Code stimmt nicht (mehr).");
    } catch (e) {
      console.error("zugang:", e instanceof Error ? e.message : e);
      return fehler(503, "Gerade nicht erreichbar. Bitte gleich noch einmal versuchen.");
    }

    let roh: unknown;
    try {
      roh = await req.json();
    } catch {
      return fehler(400, "Kein JSON.");
    }
    // Nur den Code prüfen (beim Freischalten in der App) – kostet nichts.
    if ((roh as Record<string, unknown>)?.art === "pruefen") return json(200, { ok: true });

    const eingabe = eingabePruefen(roh);
    if (typeof eingabe === "string") return fehler(400, eingabe);
    if (!env.gemini && !env.claude) return fehler(503, "Die KI ist noch nicht eingerichtet (GEMINI_API_KEY fehlt).");
    if (eingabe.art === "suchen" && !env.suchen) return fehler(503, "Die Suche ist noch nicht eingerichtet (TAVILY_API_KEY fehlt).");

    let zaehler: { zugang: number; alle: number };
    try {
      zaehler = await env.gezaehlt(hash);
    } catch (e) {
      console.error("gezaehlt:", e instanceof Error ? e.message : e);
      return fehler(503, "Gerade nicht erreichbar. Bitte gleich noch einmal versuchen.");
    }
    if (zaehler.zugang >= GRENZE_ZUGANG) return fehler(429, `Für heute sind die ${GRENZE_ZUGANG} Auswertungen aufgebraucht. Morgen geht es weiter.`);
    if (zaehler.alle >= GRENZE_ALLE) return fehler(429, "Für heute ist die KI ausgelastet. Morgen geht es weiter.");

    let treffer: Treffer[] = [];
    if (eingabe.art === "suchen") {
      try {
        treffer = await env.suchen!(eingabe.text);
      } catch (e) {
        console.error("Suche:", e instanceof Error ? e.message : e);
        if ((e as { grenze?: boolean })?.grenze) return fehler(429, "Die Internetsuche ist für diesen Monat aufgebraucht. Selbst eintragen geht immer.");
        return fehler(502, "Die Internetsuche hat gerade nicht geantwortet. Bitte gleich noch einmal versuchen.");
      }
      if (!treffer.length) return fehler(404, `Im Internet nichts zu „${eingabe.text}“ gefunden. Anders schreiben – oder selbst eintragen.`);
    }

    // Erst Gemini (kostenlos), dann Claude, wenn es ihn gibt (v11).
    const wege: { name: string; frag: (r: Record<string, unknown>) => Promise<ClaudeAntwort>; rumpf: () => Record<string, unknown> }[] = [];
    if (env.gemini) wege.push({ name: GEMINI_MODELL, frag: env.gemini, rumpf: () => geminiRumpf(eingabe, treffer) });
    if (env.claude) wege.push({ name: MODELL, frag: env.claude, rumpf: () => anfrageRumpf(eingabe, treffer) });
    let antwort: ClaudeAntwort | null = null;
    let letzterFehler: unknown = null;
    for (const weg of wege) {
      try {
        antwort = await weg.frag(weg.rumpf());
        break;
      } catch (e) {
        letzterFehler = e;
        console.error(`${weg.name}:`, e instanceof Error ? e.message : e);
        await env.merken({ hash, art: eingabe.hinweis, usd: 0, modell: weg.name, ok: false }).catch(() => {});
      }
    }
    if (!antwort) {
      const e = letzterFehler as { dauerhaft?: boolean; grenze?: boolean } | null;
      if (e?.grenze) return fehler(429, "Die KI ist für heute ausgelastet (Gratis-Kontingent). Morgen geht es weiter – selbst eintragen geht immer.");
      // Ein Fehler, der nicht von selbst vergeht (Guthaben leer, Schlüssel
      // ungültig – am 17.11. gleich beim ersten Versuch): nicht „gleich noch
      // einmal", sondern Bescheid sagen.
      if (e?.dauerhaft) return fehler(503, "Die KI ist gerade nicht verfügbar. Sag Tobi Bescheid – mit dem Strichcode und der Suche geht es weiter.");
      return fehler(502, "Die KI hat gerade nicht geantwortet. Bitte gleich noch einmal versuchen.");
    }
    const usd = antwort.modell.startsWith("gemini") ? 0 : kostenUSD(antwort.usage, antwort.modell);
    let ergebnis = null;
    if (antwort.stop !== "refusal" && antwort.stop !== "max_tokens") {
      try {
        ergebnis = ergebnisOrdnen(JSON.parse(antwort.text), treffer);
      } catch {
        ergebnis = null;
      }
    }
    await env.merken({ hash, art: eingabe.hinweis, usd, modell: antwort.modell, ok: !!ergebnis }).catch((e) => console.error("merken:", e));
    if (!ergebnis) return fehler(502, eingabe.art === "suchen" ? "Daraus ließ sich nichts ablesen. Anders schreiben – oder selbst eintragen." : "Die KI konnte das nicht auswerten. Versuch es mit einem schärferen Foto oder als Text.");
    return json(200, { ergebnis });
  };
}
