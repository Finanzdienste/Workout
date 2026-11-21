/*
 * Einstieg der Supabase-Funktion „mahlzeit-uhr“ (Projekt „Finanzdienste's
 * Project“, wie mahlzeit-ki). Verbindet handler.ts mit der Datenbank:
 * mahlzeit_uhr (ein Wert je Schlüssel, Art und Tag) und mahlzeit_uhr_eingang
 * (was ankam, roh, 14 Tage). Ohne Anmeldung aufrufbar (verify_jwt false):
 * Der Kurzbefehl hat nur seine Adresse mit dem Schlüssel der App.
 */

import { erstelleHandler, type Wert } from "./handler.ts";

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
const db = async (pfad: string, init: RequestInit = {}) => {
  const r = await fetch(`${URL_DB}/${pfad}`, {
    ...init,
    headers: { apikey: GEHEIM, Authorization: `Bearer ${GEHEIM}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (!r.ok) throw new Error(`${pfad.split("?")[0]}: HTTP ${r.status} ${await r.text()}`);
  return r;
};

Deno.serve(erstelleHandler({
  erlaubteUrspruenge: (Deno.env.get("ERLAUBTE_URSPRUENGE") ?? "https://finanzdienste.github.io")
    .split(",").map((s) => s.trim()).filter(Boolean),

  async speichern(k, werte) {
    const jetzt = new Date().toISOString();
    await db("mahlzeit_uhr?on_conflict=geraet,art,tag", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(werte.map((w) => ({ geraet: k, art: w.art, tag: w.tag, wert: w.wert, at: jetzt }))),
    });
  },

  async eingang(k, roh, anzahl) {
    await db("mahlzeit_uhr_eingang", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ geraet: k, roh, werte: anzahl }),
    });
    const alt = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
    await db(`mahlzeit_uhr_eingang?geraet=eq.${k}&at=lt.${encodeURIComponent(alt)}`, { method: "DELETE" });
  },

  async holen(k, seit) {
    const werte: Wert[] = await (await db(`mahlzeit_uhr?geraet=eq.${k}&tag=gte.${seit}&select=art,tag,wert&order=tag.asc`)).json();
    const letzt = await (await db(`mahlzeit_uhr_eingang?geraet=eq.${k}&select=at&order=at.desc&limit=1`)).json();
    return { werte, zuletzt: letzt[0]?.at ?? null };
  },
}));
