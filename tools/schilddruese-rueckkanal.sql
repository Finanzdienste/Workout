-- Schilddrüse: der Rückkanal (Nov. 2026) – nur ein Lebenszeichen.
--
-- Einmal am Tag meldet die Schilddrüsen-App (schilddruese/js/rueckkanal.js)
-- je Gerät: eine Zufallskennung, die Fassung der App, ob sie vom
-- Startbildschirm läuft, grob die Plattform, ob die Einführung angezeigt
-- wurde, den ersten und den heutigen Tag. Keine Werte, keine Einträge, keine
-- Tabletten, kein Befinden, kein Name. Die Zahl der Tage mit Öffnen zählt
-- sd_melde() selbst.
--
-- Im selben Supabase-Projekt wie der Rückkanal der Workout-App
-- (vjyohppohmvhhxgwouti) und nach denselben Regeln (README dort,
-- „Rückkanal und Betreiber-Übersicht"):
--
--   * Auf die Tabelle hat der öffentliche Schlüssel kein Recht. Geschrieben,
--     gelöscht und gelesen wird nur über die drei Funktionen unten; sie
--     laufen mit den Rechten ihres Besitzers (security definer).
--   * sd_melde() nimmt nur genau diese sieben Felder an und prüft ihre Form –
--     ein Feld mehr, und die Meldung wird abgewiesen. So kann auch eine
--     spätere Fassung der App nicht still mehr schicken.
--   * Gelesen wird nur mit Passwort, und zwar mit demselben wie die Übersicht
--     der Workout-App: sd_admin_liste() fragt admin_liste(), die bei einem
--     falschen Passwort eine Sekunde wartet und abbricht. So gibt es nur ein
--     Passwort, und es steht auch hier nicht.
--
-- Einspielen: Supabase → SQL Editor → diesen Block am Stück ausführen. Er ist
-- wiederholbar: Ein zweiter Lauf legt nichts doppelt an, löscht keine Zeilen
-- und bringt eine ältere Tabelle auf den heutigen Stand. Voraussetzung ist
-- die Funktion admin_liste(text) aus der Einrichtung der Workout-App.

create table if not exists sd_geraete (
  id text primary key,
  fassung text,
  startbildschirm boolean,
  plattform text,
  einfuehrung boolean,
  erstmals date,
  zuletzt date,
  tage int not null default 1
);

-- Falls die Tabelle schon steht und aus einer älteren Fassung dieses Blocks
-- stammt: Er soll auch dann durchlaufen und nicht an einer fehlenden Spalte
-- scheitern.
alter table sd_geraete add column if not exists fassung text;
alter table sd_geraete add column if not exists startbildschirm boolean;
alter table sd_geraete add column if not exists plattform text;
alter table sd_geraete add column if not exists einfuehrung boolean;
alter table sd_geraete add column if not exists erstmals date;
alter table sd_geraete add column if not exists zuletzt date;
alter table sd_geraete add column if not exists tage int not null default 1;

alter table sd_geraete enable row level security;

-- Erst weg, dann neu: Ändert sich der Rückgabetyp einer Funktion, verweigert
-- "create or replace" den Dienst.
drop function if exists sd_melde(jsonb);
drop function if exists sd_entferne(text);
drop function if exists sd_admin_liste(text);

-- Melden. Schreiben darf jeder, der den Link hat – was er schreibt, hat
-- trotzdem eine Form zu haben: genau diese Felder, eine UUID als Kennung,
-- Tage ohne Uhrzeit. Der Tag der Meldung kommt vom Handy (seine Zeitzone),
-- darf aber höchstens einen Tag vom Server abweichen.
create or replace function sd_melde(zeile jsonb)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  heute date := current_date;
  kennung text;
  tag_erst date;
  tag_jetzt date;
begin
  if zeile is null or jsonb_typeof(zeile) <> 'object' then
    raise exception 'keine Zeile';
  end if;
  if length(zeile::text) > 1000 then
    raise exception 'Zeile zu gross';
  end if;
  if exists (select 1 from jsonb_object_keys(zeile) k
              where k not in ('id', 'fassung', 'startbildschirm', 'plattform',
                              'einfuehrung', 'erstmals', 'zuletzt')) then
    raise exception 'unbekanntes Feld';
  end if;

  kennung := zeile->>'id';
  if kennung is null
     or kennung !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'ungueltige Kennung';
  end if;
  if coalesce(zeile->>'fassung', '') !~ '^v[0-9]{1,6}$' then
    raise exception 'ungueltige Fassung';
  end if;
  if coalesce(zeile->>'plattform', '') not in ('ios', 'android', 'andere') then
    raise exception 'ungueltige Plattform';
  end if;
  if jsonb_typeof(zeile->'startbildschirm') is distinct from 'boolean'
     or jsonb_typeof(zeile->'einfuehrung') is distinct from 'boolean' then
    raise exception 'ungueltiger Wahrheitswert';
  end if;
  if coalesce(zeile->>'erstmals', '') !~ '^\d{4}-\d{2}-\d{2}$'
     or coalesce(zeile->>'zuletzt', '') !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'ungueltiges Datum';
  end if;

  begin
    tag_erst := (zeile->>'erstmals')::date;
    tag_jetzt := (zeile->>'zuletzt')::date;
  exception when others then
    raise exception 'ungueltiges Datum';
  end;
  if tag_jetzt not between heute - 1 and heute + 1 then
    tag_jetzt := heute;
  end if;
  if tag_erst > tag_jetzt or tag_erst < date '2026-01-01' then
    tag_erst := tag_jetzt;
  end if;

  -- tage zählt hoch, wenn die letzte Meldung von einem früheren Tag ist –
  -- eine zweite Meldung am selben Tag (zwei Fenster) zählt nicht mit.
  insert into sd_geraete as g (id, fassung, startbildschirm, plattform,
                               einfuehrung, erstmals, zuletzt, tage)
  values (kennung, zeile->>'fassung', (zeile->>'startbildschirm')::boolean,
          zeile->>'plattform', (zeile->>'einfuehrung')::boolean,
          tag_erst, tag_jetzt, 1)
  on conflict (id) do update set
    fassung = excluded.fassung,
    startbildschirm = excluded.startbildschirm,
    plattform = excluded.plattform,
    einfuehrung = excluded.einfuehrung,
    erstmals = least(g.erstmals, excluded.erstmals),
    zuletzt = greatest(g.zuletzt, excluded.zuletzt),
    tage = g.tage + case when g.zuletzt is null or g.zuletzt < excluded.zuletzt then 1 else 0 end;
end $$;

-- Der Weg zurück: die eigene Zeile entfernen – beim Ausschalten in der App.
-- Gibt zurück, wie viele Zeilen weggingen; sonst müsste die App "gelöscht"
-- sagen, ohne es zu wissen.
create or replace function sd_entferne(geraet text)
returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare weg int;
begin
  delete from sd_geraete where id = geraet;
  get diagnostics weg = row_count;
  return weg;
end $$;

-- Gelesen wird nur hier, und nur mit dem Passwort der Workout-Übersicht:
-- admin_liste() bricht bei einem falschen ab (nach einer Sekunde Wartezeit),
-- und damit auch diese Funktion.
create or replace function sd_admin_liste(pass text)
returns setof sd_geraete
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform * from admin_liste(pass);
  return query select * from sd_geraete order by zuletzt desc nulls last, id;
end $$;

-- Nur die drei Funktionen sind erreichbar, die Tabelle selbst nicht.
revoke all on table sd_geraete from anon, authenticated;
revoke all on function sd_melde(jsonb), sd_entferne(text), sd_admin_liste(text)
  from public, anon, authenticated;
grant execute on function sd_melde(jsonb), sd_entferne(text), sd_admin_liste(text) to anon;
