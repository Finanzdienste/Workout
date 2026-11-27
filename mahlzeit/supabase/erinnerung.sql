-- Mahlzeit v18 (27.11.2026): die Erinnerung am Abend.
--
-- Tobi: „Alle drei“ – auf den Vorschlag „eine sanfte Erinnerung am Abend“,
-- weil Uwe jeden Tag einträgt, aber von Tag zu Tag weniger.
--
-- Die App legt hier ihr Abo beim Push-Dienst und ihren Stand von heute ab
-- (mahlzeit_erinnerung_melden). Die Edge Function mahlzeit-erinnerung
-- (supabase/functions) sieht alle 15 Minuten nach, wer dran ist, und schickt
-- die Mitteilung. Die Kennung ist zufällig und liegt nur auf dem Handy – nicht
-- die Gerätekennung des Lebenszeichens, die steht in Tobis Übersicht.
-- Was hier liegt: Abo, Uhrzeit, Zeitzone, zwei Zahlen (Einträge heute, davon
-- abends) – nicht, was gegessen wurde.
--
-- Einspielen: Supabase → SQL Editor → am Stück. Wiederholbar.

create table if not exists mahlzeit_erinnerung (
  kennung text primary key check (kennung ~ '^[a-z0-9]{20,40}$'),
  abo jsonb not null,
  uhr text not null default '20:00' check (uhr ~ '^(1[5-9]|2[0-3]):[0-5][0-9]$'),
  tz text not null default 'Europe/Berlin' check (length(tz) <= 64),
  tag date,                 -- der Tag, für den abends/gesamt gelten (Ortszeit des Handys)
  abends integer not null default 0,
  gesamt integer not null default 0,
  gesendet date,            -- an diesem Tag wurde schon erinnert
  proben integer not null default 0,
  probe_tag date,
  angelegt timestamptz not null default now(),
  at timestamptz not null default now()
);
alter table mahlzeit_erinnerung enable row level security;
comment on table mahlzeit_erinnerung is 'Mahlzeit v18: Abo und Stand für die Erinnerung am Abend. Nur die Edge Function mahlzeit-erinnerung liest (Betreiber-Schlüssel); die App schreibt über mahlzeit_erinnerung_melden.';

-- An: Abo und Stand ablegen oder auffrischen. Aus: die Zeile ist weg.
-- Zurück kommt {"an": true|false}.
create or replace function mahlzeit_erinnerung_melden(
  p_kennung text, p_an boolean, p_abo jsonb default null, p_uhr text default '20:00', p_tz text default 'Europe/Berlin',
  p_tag date default null, p_abends integer default 0, p_gesamt integer default 0)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_tz text := left(coalesce(nullif(p_tz, ''), 'Europe/Berlin'), 64);
begin
  -- Eine Zeitzone, die es nicht gibt, ließe sonst den Anstoß für alle scheitern.
  begin
    perform now() at time zone v_tz;
  exception when others then
    v_tz := 'Europe/Berlin';
  end;
  if p_kennung is null or p_kennung !~ '^[a-z0-9]{20,40}$' then raise exception 'kennung'; end if;
  if not coalesce(p_an, false) then
    delete from mahlzeit_erinnerung where kennung = p_kennung;
    return jsonb_build_object('an', false);
  end if;
  if p_abo is null or jsonb_typeof(p_abo) <> 'object' or coalesce(p_abo->>'endpoint', '') !~ '^https://[^ ]{10,}$' or length(p_abo->>'endpoint') > 1000
     or coalesce(p_abo->'keys'->>'p256dh', '') !~ '^[A-Za-z0-9_-]{80,100}$' or coalesce(p_abo->'keys'->>'auth', '') !~ '^[A-Za-z0-9_-]{16,32}$' then
    raise exception 'abo';
  end if;
  if p_uhr is null or p_uhr !~ '^(1[5-9]|2[0-3]):[0-5][0-9]$' then raise exception 'uhr'; end if;
  if not exists (select 1 from mahlzeit_erinnerung where kennung = p_kennung)
     and (select count(*) from mahlzeit_erinnerung) >= 200 then
    raise exception 'voll';
  end if;
  insert into mahlzeit_erinnerung (kennung, abo, uhr, tz, tag, abends, gesamt)
  values (p_kennung, jsonb_build_object('endpoint', p_abo->>'endpoint', 'keys', jsonb_build_object('p256dh', p_abo->'keys'->>'p256dh', 'auth', p_abo->'keys'->>'auth')),
          p_uhr, v_tz, p_tag, greatest(0, least(coalesce(p_abends, 0), 500)), greatest(0, least(coalesce(p_gesamt, 0), 500)))
  on conflict (kennung) do update set abo = excluded.abo, uhr = excluded.uhr, tz = excluded.tz, tag = excluded.tag,
    abends = excluded.abends, gesamt = excluded.gesamt, at = now();
  return jsonb_build_object('an', true);
end $$;
revoke all on function mahlzeit_erinnerung_melden(text, boolean, jsonb, text, text, date, integer, integer) from public;
grant execute on function mahlzeit_erinnerung_melden(text, boolean, jsonb, text, text, date, integer, integer) to anon, authenticated;

-- Alle 15 Minuten: die Edge Function anstoßen – aber nur, wenn überhaupt
-- jemand dran sein könnte (Uhrzeit erreicht und höchstens zwei Stunden her,
-- heute noch nicht erinnert, abends nichts eingetragen, die App in den
-- letzten sieben Tagen da). Dieselben Regeln wie lauf.js (faellig) – dort
-- fällt die Entscheidung, hier wird nur nicht umsonst geweckt.
create or replace function mahlzeit_erinnerung_anstossen()
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if exists (
    select 1 from mahlzeit_erinnerung
    where (extract(hour from now() at time zone tz) * 60 + extract(minute from now() at time zone tz))
            between (left(uhr, 2)::int * 60 + right(uhr, 2)::int) and (left(uhr, 2)::int * 60 + right(uhr, 2)::int + 120)
      and gesendet is distinct from (now() at time zone tz)::date
      and not (tag is not distinct from (now() at time zone tz)::date and abends > 0)
      and at > now() - interval '7 days'
  ) then
    perform net.http_post(
      url := 'https://vjyohppohmvhhxgwouti.supabase.co/functions/v1/mahlzeit-erinnerung',
      body := '{}'::jsonb,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      timeout_milliseconds := 8000);
  end if;
end $$;
revoke all on function mahlzeit_erinnerung_anstossen() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'mahlzeit-erinnerung';
    perform cron.schedule('mahlzeit-erinnerung', '*/15 * * * *', 'select public.mahlzeit_erinnerung_anstossen()');
  end if;
end $$;
