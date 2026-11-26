-- Mahlzeit v14 (26.11.2026): Was Uwe isst, geht an Tobi – erst, wenn Uwe in der
-- App „Ja, darf er“ getippt hat (stand.essenTeilen === true).
--
-- Tobi: „Ja ich will das essen auch sehen. In meiner Master übersicht“.
-- Bis v13 stand in der App „Was du isst, geht nicht mit“ – deshalb fragt die
-- App Uwe einmal, statt still mehr zu schicken.
--
-- Wie mahlzeit_werte_melden: Die App schickt die Einträge der letzten 60 Tage,
-- die Funktion ersetzt sie je Gerät (so kommen auch Löschungen an; eine leere
-- Liste löscht alles ab p_von – so wirkt „Essen an Tobi: aus“). Lesen kann nur
-- Tobi, über mahlzeit_lesen(pass) (Repo Finanzdienste/Apps, tools/apps-uebersicht.sql).
--
-- Einspielen: Supabase → SQL Editor → am Stück. Wiederholbar.

create table if not exists mahlzeit_essen (
  geraet text not null,
  id text not null,
  tag date not null,
  zeit text,            -- Tageszeit: morgens, mittags, nachmittags, abends
  name text not null,
  portion text,         -- wie in der App, z. B. „150 g“, „1 Teller“
  menge numeric,        -- Faktor m (2 = doppelte Portion)
  kcal integer,         -- für den ganzen Eintrag (kcal × m)
  kh integer,
  ei integer,
  hafer boolean not null default false,
  at timestamptz not null default now(),
  primary key (geraet, id)
);
comment on table mahlzeit_essen is 'Mahlzeit v14: Uwes Einträge (was, wie viel, kcal), nur nach seiner Zustimmung in der App. Lesen nur über mahlzeit_lesen(pass).';
alter table mahlzeit_essen enable row level security;
revoke all on table mahlzeit_essen from anon, authenticated;

create or replace function mahlzeit_essen_melden(p_geraet text, p_von date, p_essen jsonb)
returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  n integer;
begin
  if p_geraet !~ '^[a-z0-9]{8,24}$' then raise exception 'geraet'; end if;
  if jsonb_typeof(p_essen) <> 'array' or jsonb_array_length(p_essen) > 3000 then raise exception 'essen'; end if;
  if p_von is null or p_von < current_date - 400 then raise exception 'von'; end if;
  delete from mahlzeit_essen where geraet = p_geraet and tag >= p_von;
  insert into mahlzeit_essen (geraet, id, tag, zeit, name, portion, menge, kcal, kh, ei, hafer)
  select p_geraet, left(e->>'id', 40), (e->>'tag')::date, nullif(left(e->>'zeit', 20), ''),
         left(e->>'name', 120), nullif(left(e->>'portion', 60), ''),
         case when jsonb_typeof(e->'menge') = 'number' then (e->>'menge')::numeric end,
         case when jsonb_typeof(e->'kcal') = 'number' then round((e->>'kcal')::numeric)::int end,
         case when jsonb_typeof(e->'kh') = 'number' then round((e->>'kh')::numeric)::int end,
         case when jsonb_typeof(e->'ei') = 'number' then round((e->>'ei')::numeric)::int end,
         coalesce((e->>'hafer')::boolean, false)
  from jsonb_array_elements(p_essen) e
  where e->>'id' is not null and e->>'name' is not null
    and case when (e->>'tag') ~ '^\d{4}-\d{2}-\d{2}$' then (e->>'tag')::date >= p_von else false end
  on conflict (geraet, id) do update set tag = excluded.tag, zeit = excluded.zeit, name = excluded.name,
    portion = excluded.portion, menge = excluded.menge, kcal = excluded.kcal, kh = excluded.kh,
    ei = excluded.ei, hafer = excluded.hafer, at = now();
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function mahlzeit_essen_melden(text, date, jsonb) from public, anon, authenticated;
grant execute on function mahlzeit_essen_melden(text, date, jsonb) to anon;
