/*
 * mahlzeit-uhr: Schlaf und Schritte von Uwes Uhr in die App „Mahlzeit“
 * (v10). Die Uhr gibt ihre Werte an Apple Health; ein Kurzbefehl auf dem
 * iPhone (eingerichtet von Tobi, Anleitung in der App) liest sie dort und
 * schickt sie hierher. Die App holt sie beim Öffnen ab.
 *
 * Tobi, 21.11.2026: „Doch Uwe meinte ich kann all seine gesundheitsdaten
 * haben“ – „Ne lass weg 2 machen. Ich kann das ja auch auf Uwes Handy
 * einrichten.“ Darum liegen die Werte in Tobis Supabase (mahlzeit_uhr).
 *
 *   POST ?k=SCHLÜSSEL   vom Kurzbefehl, JSON { schlaf: "…", schritte: "…" }
 *   GET  ?k=SCHLÜSSEL&seit=JJJJ-MM-TT   von der App: { werte, zuletzt }
 *
 * Der Schlüssel erzeugt die App (zufällig, je Handy); wer ihn nicht kennt,
 * kommt an nichts heran. Was der Kurzbefehl schickt, ist Text, eine Zeile je
 * Health-Sample, Felder mit „|“ getrennt:
 *
 *   schlaf     Wert|Startdatum|Enddatum      (Kern|2026-11-21T01:10:00+01:00|…)
 *   schritte   Startdatum|Wert               (nach Tag gruppiert)
 *
 * Gelesen wird großzügig, weil hier niemand am iPhone nachprüfen kann: die
 * Reihenfolge der Felder ist egal (Datum erkennt sich selbst), Daten gehen
 * als ISO 8601 oder deutsch („21.11.2026, 07:12“), Zahlen mit Einheit oder
 * Tausenderpunkt. Schlaf: „Im Bett“ und „Wach“ zählen nicht, überlappende
 * Stücke (iPhone und Uhr messen beide) nur einmal; eine Nacht gehört zu dem
 * Tag, an dem man aufwacht. Gerechnet wird mit der Uhrzeit, wie sie
 * dasteht – das Handy schreibt alles in seiner Zeitzone.
 *
 * Diese Datei kennt Deno nicht: index.ts reicht die Datenbank herein, so
 * prüft tests/test-mz-uhr.mjs alles hier in Node.
 */

export type Wert = { art: "schlaf" | "schritte"; tag: string; wert: number };

export type Umgebung = {
  erlaubteUrspruenge: string[];
  /** Werte speichern; gleiche Art und gleicher Tag ersetzen den alten Wert. */
  speichern: (k: string, werte: Wert[]) => Promise<void>;
  /** Was ankam, roh – zum Nachsehen, wenn etwas nicht stimmt. */
  eingang: (k: string, roh: string, anzahl: number) => Promise<void>;
  /** Werte ab einem Tag und wann zuletzt etwas ankam. */
  holen: (k: string, seit: string) => Promise<{ werte: Wert[]; zuletzt: string | null }>;
};

export const MAX_ROH = 300_000;
const SCHLUESSEL = /^[a-z0-9]{16,40}$/;
const TAG = /^\d{4}-\d{2}-\d{2}$/;

/** Uhrzeit aus einem Feld – als Minuten seit 1970 (ohne Zeitzone) und Tag. */
export function zeitLesen(feld: string): { min: number; tag: string; mitZeit: boolean } | null {
  const t = feld.trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2}))?/);
  let j, mo, d, h, mi;
  if (m) [j, mo, d, h, mi] = [m[1], m[2], m[3], m[4], m[5]];
  else {
    m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})(?:,?\s*(?:um\s*)?(\d{1,2}):(\d{2}))?/);
    if (!m) return null;
    [d, mo, j, h, mi] = [m[1], m[2], m[3].length === 2 ? `20${m[3]}` : m[3], m[4], m[5]];
  }
  const ms = Date.UTC(Number(j), Number(mo) - 1, Number(d), Number(h ?? 0), Number(mi ?? 0));
  if (!Number.isFinite(ms)) return null;
  const tag = new Date(ms).toISOString().slice(0, 10);
  if (tag !== `${j}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`) return null;
  return { min: ms / 60000, tag, mitZeit: h !== undefined };
}

/** „8.432“, „8432 Schritte“, „1234.0“, „8 432“ → ganze Zahl; sonst NaN. */
export function zahlLesen(feld: string): number {
  const m = feld.trim().match(/^(\d{1,3}(?:[.,\u00a0\u202f ]\d{3})+|\d+)(?:[.,]\d+)?/);
  return m ? Number(m[1].replace(/\D/g, "")) : NaN;
}

const zeilen = (text: unknown): string[][] =>
  String(text ?? "").split(/\r?\n/).map((z) => z.split("|").map((f) => f.trim())).filter((f) => f.some(Boolean));

/** Schlaf je Tag (Minuten) aus den Zeilen des Kurzbefehls. */
export function schlafLesen(text: unknown): { werte: Wert[]; ohneZeit: number } {
  const stuecke: { von: number; bis: number; tag: string }[] = [];
  let ohneZeit = 0;
  for (const felder of zeilen(text)) {
    const zeiten = felder.map(zeitLesen);
    const daten = zeiten.filter((z) => z) as NonNullable<ReturnType<typeof zeitLesen>>[];
    const wert = felder.filter((_, i) => !zeiten[i]).join(" ");
    if (/bett|bed|wach|awake/i.test(wert)) continue;
    if (daten.length < 2) continue;
    if (!daten[0].mitZeit || !daten[1].mitZeit) { ohneZeit++; continue; }
    const [von, bis] = [daten[0], daten[1]];
    if (bis.min <= von.min || bis.min - von.min > 16 * 60) continue;
    stuecke.push({ von: von.min, bis: bis.min, tag: bis.tag });
  }
  stuecke.sort((a, b) => a.von - b.von);
  const zusammen: typeof stuecke = [];
  for (const s of stuecke) {
    const letzt = zusammen.at(-1);
    if (letzt && s.von <= letzt.bis) {
      if (s.bis > letzt.bis) { letzt.bis = s.bis; letzt.tag = s.tag; }
    } else zusammen.push({ ...s });
  }
  const jeTag = new Map<string, number>();
  for (const s of zusammen) jeTag.set(s.tag, (jeTag.get(s.tag) ?? 0) + (s.bis - s.von));
  const werte = [...jeTag].filter(([, min]) => min >= 30).map(([tag, min]) => ({ art: "schlaf" as const, tag, wert: Math.round(Math.min(min, 1200)) }));
  return { werte, ohneZeit };
}

/** Schritte je Tag aus den Zeilen des Kurzbefehls. */
export function schritteLesen(text: unknown): Wert[] {
  const jeTag = new Map<string, number>();
  for (const felder of zeilen(text)) {
    const zeiten = felder.map(zeitLesen);
    const datum = zeiten.find((z) => z);
    const zahl = felder.filter((_, i) => !zeiten[i]).map(zahlLesen).find((n) => Number.isFinite(n));
    if (!datum || zahl === undefined) continue;
    jeTag.set(datum.tag, (jeTag.get(datum.tag) ?? 0) + zahl);
  }
  return [...jeTag].filter(([, n]) => n > 0 && n <= 150_000).map(([tag, wert]) => ({ art: "schritte" as const, tag, wert }));
}

const datumKurz = (tag: string) => `${tag.slice(8, 10)}.${tag.slice(5, 7)}.`;
const tausender = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const dauer = (min: number) => `${Math.floor(min / 60)} Std${min % 60 ? ` ${min % 60} Min` : ""}`;

/** Die Antwort an den Kurzbefehl – lesbar, falls Tobi sie sich anzeigen lässt. */
export function quittung(werte: Wert[], ohneZeit: number): string {
  const schlaf = werte.filter((w) => w.art === "schlaf").map((w) => `${datumKurz(w.tag)} ${dauer(w.wert)}`);
  const schritte = werte.filter((w) => w.art === "schritte").map((w) => `${datumKurz(w.tag)} ${tausender(w.wert)}`);
  const teile = [];
  if (schlaf.length) teile.push(`Schlaf ${schlaf.join(", ")}`);
  if (schritte.length) teile.push(`Schritte ${schritte.join(", ")}`);
  let text = teile.length ? `✓ Bei Mahlzeit angekommen: ${teile.join(" · ")}` : "Angekommen, aber ohne Werte.";
  if (ohneZeit) text += " Achtung: Bei Start- und Enddatum fehlt die Uhrzeit – im Kurzbefehl „Zeit einschließen“ anschalten.";
  return text;
}

async function rumpfLesen(req: Request): Promise<Record<string, unknown>> {
  const text = (await req.text()).slice(0, MAX_ROH);
  try {
    const j = JSON.parse(text);
    if (j && typeof j === "object" && !Array.isArray(j)) return j;
  } catch { /* kein JSON */ }
  const form = new URLSearchParams(text);
  if (form.has("schlaf") || form.has("schritte")) return Object.fromEntries(form);
  return { schlaf: text };
}

const alsText = (v: unknown) => (Array.isArray(v) ? v.join("\n") : typeof v === "string" ? v : v == null ? "" : String(v));

export function erstelleHandler(env: Umgebung) {
  return async (req: Request): Promise<Response> => {
    const herkunft = req.headers.get("origin") ?? "";
    const cors: Record<string, string> = env.erlaubteUrspruenge.includes(herkunft)
      ? { "Access-Control-Allow-Origin": herkunft, Vary: "Origin", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "content-type" }
      : {};
    const json = (daten: unknown, status = 200) => new Response(JSON.stringify(daten), { status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } });
    const text = (t: string, status = 200) => new Response(t, { status, headers: { ...cors, "Content-Type": "text/plain; charset=utf-8" } });

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const url = new URL(req.url);
    const k = (url.searchParams.get("k") ?? "").toLowerCase();
    if (!SCHLUESSEL.test(k)) return text("Die Adresse ist nicht vollständig – bitte aus Mahlzeit neu kopieren.", 400);

    try {
      if (req.method === "GET") {
        if (herkunft && !cors["Access-Control-Allow-Origin"]) return json({ fehler: "nicht erlaubt" }, 403);
        const seit = url.searchParams.get("seit") ?? "";
        return json(await env.holen(k, TAG.test(seit) ? seit : "2000-01-01"));
      }
      if (req.method !== "POST") return text("Nur GET und POST.", 405);
      const rumpf = await rumpfLesen(req);
      const roh = `schlaf:\n${alsText(rumpf.schlaf)}\nschritte:\n${alsText(rumpf.schritte)}`;
      const schlaf = schlafLesen(alsText(rumpf.schlaf));
      const werte = [...schlaf.werte, ...schritteLesen(alsText(rumpf.schritte))].slice(-60);
      await env.eingang(k, roh.slice(0, 50_000), werte.length);
      if (werte.length) await env.speichern(k, werte);
      return text(quittung(werte, schlaf.ohneZeit));
    } catch (e) {
      console.error("mahlzeit-uhr", e);
      return text("Gerade nicht erreichbar – der nächste Lauf holt es nach.", 503);
    }
  };
}
