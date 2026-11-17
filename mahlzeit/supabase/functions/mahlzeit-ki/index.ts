/*
 * Einstieg der Supabase-Funktion „mahlzeit-ki" (Projekt „Finanzdienste's
 * Project", wie amy-chat). Verbindet handler.ts mit Claude (Anthropic-SDK)
 * und der Datenbank.
 *
 * Secrets (Edge Functions → Secrets), schon da für amy-chat:
 *
 *   ANTHROPIC_API_KEY    der Schlüssel aus der Anthropic Console
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
import { erstelleHandler, type ClaudeAntwort } from "./handler.ts";

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

  async merken({ hash, art, usd, modell, ok }) {
    const betrag = Math.round(usd * 1e6) / 1e6;
    await db("mahlzeit_ki", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ zugang: hash.slice(0, 16), art, usd: betrag, modell, ok }),
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
}));
