-- Mahlzeit v19 (27.11.2026): eine neue Kennung für jedes Handy mit alter.
--
-- Die Kennung (mahlzeit.geraet.v…) ist der einzige Ausweis eines Handys beim
-- Server. Die von Uwes Handy stand seit v13 in den Notizen dieses öffentlichen
-- Repos – wer sie kannte, hätte über mahlzeit_werte_melden überschreiben
-- können, was bei Tobi ankommt. Tobi auf die Frage, ob die Angaben aus den
-- Notizen sollen und Uwes App eine neue Kennung bekommt: „Jo“.
--
-- Drei Tabellen, eine Funktion:
--   mahlzeit_name            wem ein Gerät gehört (für „Meine Apps“). Die Zeile
--                            für Uwe steht NUR in der Datenbank – nie hier.
--   mahlzeit_wechsel_beweis  die Kennungen der Werte je Gerät, festgehalten am
--                            Tag der Umstellung. Nur sie zählen als Beweis:
--                            Was jemand danach unter der alten Kennung
--                            hinlegt, zählt nicht.
--   mahlzeit_wechsel         Fehlversuche je alter Kennung (nach 20 gesperrt)
--                            und wann der Wechsel gelang.
--   mahlzeit_geraet_wechseln(alt, neu, beweis)
--                            ruft die App (js/lebenszeichen.js geraetBereit):
--                            Kennt das Handy mindestens drei der
--                            festgehaltenen Werte (oder alle, wenn es weniger
--                            sind), zieht alles von alt nach neu – Werte,
--                            Essen, Lebenszeichen und der Name.
--
-- In „Meine Apps“ (Repo Finanzdienste/Apps, tools/apps-uebersicht.sql) fragen
-- apps_wer und mahlzeit_lesen den Namen aus mahlzeit_name ab statt nach einer
-- festen Kennung.
--
-- Einspielen: Supabase → SQL Editor → am Stück. Wiederholbar – bis auf das
-- Festhalten der Werte (unten), das nur am Tag der Umstellung Sinn hat.

create table if not exists mahlzeit_name (
  geraet text primary key,
  name text not null
);
comment on table mahlzeit_name is 'Mahlzeit v19: wem ein Gerät gehört (für Meine Apps). Nur hier, nie im Repo. Zieht beim Kennungswechsel mit.';
alter table mahlzeit_name enable row level security;
revoke all on table mahlzeit_name from anon, authenticated;

create table if not exists mahlzeit_wechsel (
  alt text primary key,
  fehlversuche integer not null default 0,
  fertig timestamptz
);
comment on table mahlzeit_wechsel is 'Mahlzeit v19: Fehlversuche beim Kennungswechsel je alter Kennung (nach 20 gesperrt) und wann er gelang.';
alter table mahlzeit_wechsel enable row level security;
revoke all on table mahlzeit_wechsel from anon, authenticated;

create table if not exists mahlzeit_wechsel_beweis (
  alt text not null,
  id text not null,
  primary key (alt, id)
);
comment on table mahlzeit_wechsel_beweis is 'Mahlzeit v19: die Kennungen der Werte je Gerät, festgehalten am 27.11.2026 – nur sie zählen als Beweis beim Kennungswechsel.';
alter table mahlzeit_wechsel_beweis enable row level security;
revoke all on table mahlzeit_wechsel_beweis from anon, authenticated;

-- Einmal, am 27.11.2026: festhalten, was da ist.
-- insert into mahlzeit_wechsel_beweis (alt, id)
-- select geraet, id from mahlzeit_werte on conflict do nothing;

create or replace function mahlzeit_geraet_wechseln(p_alt text, p_neu text, p_beweis text[])
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_fehl integer;
  v_alle integer;
  v_treffer integer;
begin
  if p_alt is null or p_neu is null or p_alt !~ '^[a-z0-9]{8,24}$' or p_neu !~ '^[a-z0-9]{12,24}$' or p_alt = p_neu then raise exception 'kennung'; end if;
  if cardinality(coalesce(p_beweis, '{}'::text[])) > 600 then raise exception 'beweis'; end if;
  select fehlversuche into v_fehl from mahlzeit_wechsel where alt = p_alt;
  if coalesce(v_fehl, 0) >= 20 then return jsonb_build_object('ok', false, 'grund', 'gesperrt'); end if;
  select count(*) into v_alle from mahlzeit_wechsel_beweis where alt = p_alt;
  if v_alle = 0 then return jsonb_build_object('ok', false, 'grund', 'ohne'); end if;
  select count(*) into v_treffer from mahlzeit_wechsel_beweis where alt = p_alt and id = any (coalesce(p_beweis, '{}'::text[]));
  if v_treffer < least(3, v_alle) then
    insert into mahlzeit_wechsel (alt, fehlversuche) values (p_alt, 1)
    on conflict (alt) do update set fehlversuche = mahlzeit_wechsel.fehlversuche + 1;
    return jsonb_build_object('ok', false, 'grund', 'beweis');
  end if;
  delete from mahlzeit_werte where geraet = p_neu;
  delete from mahlzeit_essen where geraet = p_neu;
  delete from mahlzeit_name where geraet = p_neu;
  update mahlzeit_werte set geraet = p_neu where geraet = p_alt;
  update mahlzeit_essen set geraet = p_neu where geraet = p_alt;
  update mahlzeit_nutzung set geraet = p_neu where geraet = p_alt;
  update mahlzeit_name set geraet = p_neu where geraet = p_alt;
  -- Einmal: Danach gibt es zur alten Kennung nichts mehr zu holen.
  delete from mahlzeit_wechsel_beweis where alt = p_alt;
  insert into mahlzeit_wechsel (alt, fertig) values (p_alt, now())
  on conflict (alt) do update set fertig = now();
  return jsonb_build_object('ok', true);
end $$;
revoke all on function mahlzeit_geraet_wechseln(text, text, text[]) from public;
grant execute on function mahlzeit_geraet_wechseln(text, text, text[]) to anon, authenticated;

-- Wer ist Uwe? (für Tobi, im SQL Editor)
--   select geraet from mahlzeit_name where name = 'Uwe';
-- Ist sein Handy schon gewechselt?
--   select fertig, fehlversuche from mahlzeit_wechsel;
