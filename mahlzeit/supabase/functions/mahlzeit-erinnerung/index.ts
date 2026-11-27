/*
 * Edge Function mahlzeit-erinnerung (siehe lauf.js).
 *
 *   GET    der öffentliche VAPID-Schlüssel für die App (js/erinnerung.js):
 *          { "oeffentlich": "…" }
 *   POST   {}                         ein Durchlauf – die Datenbank stößt ihn
 *                                     alle 15 Minuten an (supabase/erinnerung.sql)
 *          { art: "probe", kennung }  eine Probe-Mitteilung jetzt gleich
 *
 * Ohne Ausweis aufrufbar (verify_jwt aus): Ein Durchlauf löst nur aus, was
 * ohnehin anstünde, und eine Probe geht nur an das Handy, dessen Kennung man
 * kennt (zufällig, nur auf dem Handy), höchstens fünfmal am Tag.
 * SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY setzt Supabase selbst.
 */
import { lauf, probe, vapidHolen } from "./lauf.js";

const KOPF = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "content-type" };
const antwort = (body: unknown, status = 200) => Response.json(body, { status, headers: KOPF });

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: KOPF });
  const url = Deno.env.get("SUPABASE_URL") || "";
  const schluessel = secretKey();
  if (!url || !schluessel) return antwort({ fehler: "SUPABASE_URL oder der Betreiber-Schlüssel fehlt" }, 500);
  try {
    if (req.method === "GET") {
      const { oeffentlich } = await vapidHolen({ url, schluessel });
      return antwort({ oeffentlich });
    }
    let rumpf: Record<string, unknown> = {};
    try { rumpf = await req.json(); } catch { /* leer: ein Durchlauf */ }
    if (rumpf && rumpf.art === "probe") {
      const r = await probe({ url, schluessel, kennung: String(rumpf.kennung ?? "") });
      console.log("mahlzeit-erinnerung Probe:", JSON.stringify({ ...r }));
      return antwort(r, r.ok ? 200 : r.grund === "grenze" ? 429 : r.grund === "fehlt" || r.grund === "abo" ? 404 : 502);
    }
    const ergebnis = await lauf({ url, schluessel });
    if (ergebnis.faellig) console.log("mahlzeit-erinnerung:", JSON.stringify(ergebnis));
    return antwort(ergebnis);
  } catch (e) {
    console.error("mahlzeit-erinnerung:", e);
    return antwort({ fehler: String(e && (e as Error).message ? (e as Error).message : e) }, 500);
  }
});
