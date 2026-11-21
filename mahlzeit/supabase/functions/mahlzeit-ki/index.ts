/*
 * Einstieg der Supabase-Funktion „mahlzeit-ki" (Projekt „Finanzdienste's
 * Project", wie amy-chat). Verbindet handler.ts mit Claude (Anthropic-SDK)
 * und der Datenbank.
 *
 * Secrets (Edge Functions → Secrets), schon da für amy-chat:
 *
 *   ANTHROPIC_API_KEY    der Schlüssel aus der Anthropic Console
 *
 *   GEMINI_API_KEY       ein kostenloser Schlüssel aus aistudio.google.com
 *                        (v11, wird zuerst gefragt)
 *   TAVILY_API_KEY       für die Suche im Internet (schon da für rezept-web)
 *
 * Optional:
 *
 *   ERLAUBTE_URSPRUENGE  von welchen Adressen die App fragen darf, durch Komma
 *                        getrennt; ohne Angabe nur GitHub Pages
 *
 * SUPABASE_URL und die Schlüssel des Projekts setzt Supabase selbst. Mit dem
 * geheimen Schlüssel liest die Funktion mahlzeit_zugang und schreibt
 * mahlzeit_ki und fragmal_kosten. Ohne Anmeldung aufrufbar (verify_jwt
 * false): Die Funktion prüft den Freischalt-Code selbst.
 */

import Anthropic from "npm:@anthropic-ai/sdk@1.7.0";
import { erstelleHandler, geminiLesen, trefferOrdnen, type ClaudeAntwort, type Treffer } from "./handler.ts";

const KEIN_NUTZER = "00000000-0000-0000-0000-000000000000";

function secretKey(): string {
  const neu = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (neu) {
    try {
      const schluessel = JSON.parse(neu);
      if (schluessel.default) return schluessel.default;
    } catch {
      // weiter mit dem alten Schlüssel
    }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

const URL_DB = `${Deno.env.get("SUPABASE_URL") ?? ""}/rest/v1`;
const GEHEIM = secretKey();
const db = (pfad: string, init: RequestInit = {}) => fetch(`${URL_DB}/${pfad}`, {
  ...init,
  headers: { apikey: GEHEIM, Authorization: `Bearer ${GEHEIM}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
});

const schluessel = Deno.env.get("ANTHROPIC_API_KEY");
const client = schluessel ? new Anthropic({ apiKey: schluessel, maxRetries: 1, timeout: 120_000 }) : null;

async function claude(rumpf: Record<string, unknown>): Promise<ClaudeAntwort> {
  let nachricht;
  try {
    // deno-lint-ignore no-explicit-any
    nachricht = await client!.beta.messages.create(rumpf as any);
  } catch (e) {
    // 400/401/403/404 vergehen nicht von selbst (Guthaben leer, Schlüssel
    // falsch, Modell weg) – handler.ts sagt dann „sag Tobi Bescheid".
    if (e instanceof Anthropic.APIError && [400, 401, 403, 404].includes(e.status ?? 0)) {
      throw Object.assign(new Error(e.message), { dauerhaft: true });
    }
    throw e;
  }
  const text = nachricht.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("");
  return {
    text,
    stop: nachricht.stop_reason ?? null,
    modell: nachricht.model,
    usage: nachricht.usage as unknown as Record<string, unknown>,
  };
}

const geminiSchluessel = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GEMINI_KEY");
const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/interactions?alt=sse";

async function gemini(rumpf: Record<string, unknown>): Promise<ClaudeAntwort> {
  const abbruch = new AbortController();
  const uhr = setTimeout(() => abbruch.abort(), 30_000);
  let alles = "";
  try {
    const res = await fetch(GEMINI_API, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": geminiSchluessel! },
      body: JSON.stringify(rumpf),
      signal: abbruch.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      let info: { error?: { message?: string } } | null = null;
      try { const j = JSON.parse(text); info = Array.isArray(j) ? j[0] : j; } catch { /* kein JSON */ }
      const meldung = info?.error?.message || `HTTP ${res.status}`;
      // Kennt das Modell die Denkstufe nicht: einmal ohne sie (wie Boxenstopp).
      const gc = rumpf.generation_config as Record<string, unknown> | undefined;
      if (res.status === 400 && /thinking/i.test(meldung) && gc?.thinking_level) {
        const ohne = { ...gc };
        delete ohne.thinking_level;
        clearTimeout(uhr);
        return gemini({ ...rumpf, generation_config: ohne });
      }
      // 429: Gratis-Kontingent; 400/401/403: Schlüssel falsch oder gesperrt – vergeht nicht von selbst
      // 404: dieses Modell gibt es (noch) nicht – dann das nächste, wie bei 503.
      throw Object.assign(new Error(`${res.status} ${meldung}`), { grenze: res.status === 429, dauerhaft: [401, 403].includes(res.status) || (res.status === 400 && /api.?key|permission|denied/i.test(meldung)) });
    }
    // Stück für Stück lesen und beim Ende der Antwort aufhören – der Strom bleibt
    // sonst offen, und das Warten läuft in die Zeitgrenze (21.11., erster Test).
    const leser = res.body!.getReader();
    const dekoder = new TextDecoder();
    for (;;) {
      const { done, value } = await leser.read();
      if (done) break;
      alles += dekoder.decode(value, { stream: true });
      // Das Ende-Ereignis ganz abwarten (bis zur Leerzeile), dann nicht weiter auf den Strom warten.
      const ende = alles.replace(/\r\n/g, "\n").search(/"event_type"\s*:\s*"interaction\.(?:completed|complete|done|failed|error)"|"status"\s*:\s*"(?:completed|failed|incomplete|cancelled)"/);
      if (ende >= 0 && alles.replace(/\r\n/g, "\n").indexOf("\n\n", ende) >= 0) {
        await leser.cancel().catch(() => {});
        break;
      }
    }
    const antwort = geminiLesen(alles);
    if (!antwort.text) console.error("Gemini ohne Text:", alles.slice(0, 800));
    return antwort;
  } catch (e) {
    // Zum Nachsehen im Protokoll: welche Ereignisse kamen (ohne Inhalt der Anfrage).
    console.error("Gemini roh:", alles.length, (alles.match(/"event_type"\s*:\s*"[^"]+"/g) ?? []).slice(0, 12).join(" "), alles.slice(-300));
    if (abbruch.signal.aborted) throw new Error("Gemini: Zeit abgelaufen");
    throw e;
  } finally {
    clearTimeout(uhr);
  }
}

const tavilySchluessel = Deno.env.get("TAVILY_API_KEY");

async function suchen(q: string): Promise<Treffer[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tavilySchluessel}` },
    body: JSON.stringify({ query: `${q} Kalorien Nährwerte pro 100 g`, max_results: 5, search_depth: "basic", include_answer: false, include_raw_content: false, include_images: false }),
    signal: AbortSignal.timeout(20_000),
  });
  if ([429, 432, 433].includes(res.status)) { await res.body?.cancel(); throw Object.assign(new Error(`Tavily ${res.status}`), { grenze: true }); }
  if (!res.ok) { await res.body?.cancel(); throw new Error(`Tavily ${res.status}`); }
  return trefferOrdnen(await res.json());
}

Deno.serve(erstelleHandler({
  erlaubteUrspruenge: (Deno.env.get("ERLAUBTE_URSPRUENGE") ?? "https://finanzdienste.github.io")
    .split(",").map((s) => s.trim()).filter(Boolean),

  async zugang(hash) {
    const r = await db(`mahlzeit_zugang?hash=eq.${hash}&aktiv=is.true&select=hash`);
    if (!r.ok) throw new Error(`mahlzeit_zugang: HTTP ${r.status}`);
    return (await r.json()).length === 1;
  },

  async gezaehlt(hash) {
    const seit = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const r = await db(`mahlzeit_ki?at=gte.${encodeURIComponent(seit)}&select=zugang`);
    if (!r.ok) throw new Error(`mahlzeit_ki: HTTP ${r.status}`);
    const zeilen: { zugang: string }[] = await r.json();
    return { zugang: zeilen.filter((z) => z.zugang === hash.slice(0, 16)).length, alle: zeilen.length };
  },

  async merken({ hash, art, usd, modell, ok, grund, versuche, ms }) {
    const betrag = Math.round(usd * 1e6) / 1e6;
    await db("mahlzeit_ki", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ zugang: hash.slice(0, 16), art, usd: betrag, modell, ok, grund: grund ?? null, versuche: versuche ?? null, ms: ms ?? null }),
    });
    if (betrag > 0) {
      await db("fragmal_kosten", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ app: "mahlzeit", nutzer: KEIN_NUTZER, modell, usd: betrag }),
      });
    }
  },

  claude: client ? claude : undefined,
  gemini: geminiSchluessel ? gemini : undefined,
  suchen: tavilySchluessel ? suchen : undefined,
}));
