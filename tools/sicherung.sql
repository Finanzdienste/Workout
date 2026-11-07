-- Die automatische Sicherung: eine Tabelle, drei Funktionen – und zwei kleine
-- Tabellen für die Drossel je Quelle.
--
--   Wo:  Supabase → SQL Editor → einfügen → Run
--   Wer: der Betreiber, einmal. Der Block ist wiederholbar – ein zweiter Lauf
--        legt nichts doppelt an und löscht keine Sicherung.
--
-- Dasselbe steht in der README, Abschnitt „Automatische Sicherung".
--
-- WAS DER SERVER SIEHT
--
-- Die App verschlüsselt den Stand auf dem Gerät (AES-GCM, 256 Bit), bevor er
-- das Gerät verlässt. Der Schlüssel geht nie über die Leitung. Hier kommen an:
--
--   id        SHA-256 über "id:" + Schlüssel, als Hex – eine Zufallskennung
--   w_hash    SHA-256 der Schreibmarke; die Marke selbst (SHA-256 über
--             "w:" + Schlüssel) wird nicht gespeichert
--   daten     das Chiffrat, base64
--   iv        der IV dazu, base64
--   groesse   Länge des Chiffrats
--   stand     wann zuletzt geschrieben wurde
--
-- Lesen kann den Verlauf nur, wer den Schlüssel hat – auch der Betreiber nicht.
--
-- Dazu sieht Supabase wie bei jeder Anfrage die IP-Adresse des Geräts. In
-- `sicherung` steht sie nicht. Gegen Missbrauch zählt `sicherung_quelle` je
-- Quelle und Tag, wie viel neu dazukam – die Quelle ist SHA-256 über die
-- Adresse und ein Salz, das jeden Tag neu gewürfelt wird. Zähler und Salz
-- eines Tages löscht der erste Aufruf am Tag danach. Wer das Salz des Tages
-- hat, also der Betreiber, könnte eine IPv4-Adresse durch Durchprobieren
-- zurückrechnen; länger als den Tag gibt es deshalb weder Salz noch Zähler.
--
-- WARUM FUNKTIONEN UND KEINE REGELN
--
-- Wie beim Rückkanal (README, „Rückkanal und Betreiber-Übersicht"): Auf die
-- Tabelle hat der öffentliche Schlüssel kein Recht. Geschrieben, gelesen und
-- gelöscht wird nur über die drei Funktionen, die mit den Rechten ihres
-- Besitzers laufen und selbst prüfen, was sie annehmen.

create table if not exists sicherung (
  id       text primary key,
  w_hash   text not null,
  daten    text not null,
  iv       text not null,
  groesse  int  not null,
  stand    timestamptz not null default now(),
  angelegt timestamptz not null default now()
);

-- Falls die Tabelle aus einer früheren Fassung dieses Blocks stammt.
alter table sicherung add column if not exists angelegt timestamptz not null default now();

-- Die Drossel je Quelle: wie viel eine Quelle an einem Tag neu angelegt hat und
-- wie viele Daten dazukamen (Anlegen und Wachsen). Die Quelle ist ein Hash aus
-- IP-Adresse und Tagessalz – die Adresse selbst steht nirgends.
create table if not exists sicherung_quelle (
  quelle text   not null,
  tag    date   not null,
  neu    int    not null default 0,
  bytes  bigint not null default 0,
  primary key (quelle, tag)
);
create table if not exists sicherung_salz (
  tag  date primary key,
  salz text not null
);

alter table sicherung enable row level security;
alter table sicherung_quelle enable row level security;
alter table sicherung_salz enable row level security;

-- Erst weg, dann neu: Ändert sich eine Signatur oder ein Rückgabetyp,
-- verweigert "create or replace" den Dienst.
drop function if exists sicherung_schreiben(text, text, text, text, timestamptz);
drop function if exists sicherung_lesen(text);
drop function if exists sicherung_loeschen(text, text);

-- Anlegen oder ersetzen – Ersetzen nur mit passender Schreibmarke und nur, wenn
-- `p_vorher` der Stand ist, der dort gerade liegt. Sonst hat dazwischen ein
-- anderes Gerät mit demselben Schlüssel geschrieben ('veraltet'), oder die
-- Sicherung wurde inzwischen gelöscht ('geloescht'). Die App hört dann auf und
-- fragt, statt den anderen Stand still zu überschreiben.
create or replace function sicherung_schreiben(
  p_id text, p_w text, p_daten text, p_iv text, p_vorher timestamptz default null)
returns timestamptz
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  marke    text;
  alt      sicherung%rowtype;
  jetzt    timestamptz := now();
  heute    date := (now() at time zone 'utc')::date;
  v_ip     text;
  v_salz   text;
  v_quelle text;
  v_neu    int;
  v_bytes  bigint;
  zuwachs  bigint;
begin
  -- Schreiben darf jeder, der den Link hat. Was er schreibt, hat trotzdem eine
  -- Form zu haben – und eine Größe, die der kostenlose Tarif verträgt.
  if p_id is null or p_id !~ '^[0-9a-f]{64}$' then raise exception 'ungueltige Kennung'; end if;
  if p_w is null or p_w !~ '^[0-9a-f]{64}$' then raise exception 'ungueltige Schreibmarke'; end if;
  if p_iv is null or p_iv !~ '^[A-Za-z0-9+/]{16}$' then raise exception 'ungueltiger IV'; end if;
  if p_daten is null or length(p_daten) < 24 then raise exception 'leere Sicherung'; end if;
  if length(p_daten) > 2 * 1024 * 1024 then raise exception 'Sicherung zu gross'; end if;
  marke := encode(sha256(convert_to(p_w, 'UTF8')), 'hex');

  -- Aufräumen nebenbei: Was 400 Tage niemand erneuert hat, gehört zu keinem
  -- Gerät mehr. Die App erneuert spätestens alle 30 Tage, solange sie benutzt
  -- wird – hier verschwindet also nur Verwaistes. Und von der Drossel je
  -- Quelle bleibt kein Tag über seinen Tag hinaus: Ohne das Salz lässt sich
  -- aus einem alten Hash auch durch Durchprobieren keine Adresse gewinnen.
  delete from sicherung where stand < now() - interval '400 days';
  delete from sicherung_quelle where tag < heute;
  delete from sicherung_salz where tag < heute;

  -- Die Quelle: der erste Eintrag in X-Forwarded-For, den PostgREST als
  -- request.headers weiterreicht. Die Grenzen für alle zusammen (unten) waren
  -- allein von jedem ausschöpfbar, der den öffentlichen Schlüssel hat – hundert
  -- Kleinstanfragen, und kein neues Gerät kam mehr hinein. Fehlt der Kopf
  -- (SQL-Editor, Aufruf ohne Proxy), gibt es keine Grenze je Quelle, nur die
  -- für alle. Wer den Kopf fälscht, landet ebenfalls dort: Die Grenze je Quelle
  -- hält die einfache Flut auf, die Grenzen für alle bleiben die letzte Wand.
  v_ip := nullif(btrim(split_part(coalesce(
    nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ''), ',', 1)), '');
  if v_ip is not null then
    insert into sicherung_salz (tag, salz)
      values (heute, encode(sha256(convert_to(gen_random_uuid()::text || gen_random_uuid()::text, 'UTF8')), 'hex'))
      on conflict (tag) do nothing;
    select s.salz into v_salz from sicherung_salz s where s.tag = heute;
    v_quelle := encode(sha256(convert_to(left(v_ip, 64) || v_salz, 'UTF8')), 'hex');
    select q.neu, q.bytes into v_neu, v_bytes
      from sicherung_quelle q where q.quelle = v_quelle and q.tag = heute;
  end if;
  v_neu := coalesce(v_neu, 0);
  v_bytes := coalesce(v_bytes, 0);

  select * into alt from sicherung where id = p_id for update;
  if not found then
    if p_vorher is not null then raise exception 'geloescht'; end if;
    zuwachs := length(p_daten);
    -- Je Quelle und Tag: fünf neue Sicherungen und 8 MB. Ein Umzug, ein
    -- Rückweg und ein frischer Schlüssel nach einem Link passen an einem Tag
    -- bequem hinein; eine Flut nicht.
    if v_quelle is not null and v_neu >= 5 then
      raise exception 'zu viele neue Sicherungen von hier';
    end if;
    if v_quelle is not null and v_bytes + zuwachs > 8 * 1024 * 1024 then
      raise exception 'zu viele Daten von hier';
    end if;
    -- Für alle zusammen: nicht beliebig viele neue Sicherungen je Stunde,
    -- nicht mehr als 200 MB insgesamt.
    if (select count(*) from sicherung where angelegt > now() - interval '1 hour') >= 100 then
      raise exception 'zu viele neue Sicherungen';
    end if;
    if (select coalesce(sum(groesse), 0) from sicherung) + zuwachs > 200 * 1024 * 1024 then
      raise exception 'Server voll';
    end if;
    insert into sicherung (id, w_hash, daten, iv, groesse, stand, angelegt)
      values (p_id, marke, p_daten, p_iv, length(p_daten), jetzt, jetzt);
    if v_quelle is not null then
      insert into sicherung_quelle (quelle, tag, neu, bytes) values (v_quelle, heute, 1, zuwachs)
        on conflict (quelle, tag) do update
          set neu = sicherung_quelle.neu + excluded.neu, bytes = sicherung_quelle.bytes + excluded.bytes;
    end if;
    return jetzt;
  end if;

  if alt.w_hash is distinct from marke then raise exception 'Schreibmarke passt nicht'; end if;
  if p_vorher is distinct from alt.stand then raise exception 'veraltet'; end if;
  if alt.stand > now() - interval '10 seconds' then raise exception 'zu oft'; end if;
  -- Wachsen zählt wie Anlegen: Sonst legte man klein an und blähte danach auf.
  zuwachs := greatest(length(p_daten) - alt.groesse, 0);
  if v_quelle is not null and zuwachs > 0 and v_bytes + zuwachs > 8 * 1024 * 1024 then
    raise exception 'zu viele Daten von hier';
  end if;
  if (select coalesce(sum(groesse), 0) from sicherung) - alt.groesse + length(p_daten)
       > 200 * 1024 * 1024 then
    raise exception 'Server voll';
  end if;
  update sicherung
     set daten = p_daten, iv = p_iv, groesse = length(p_daten), stand = jetzt
   where id = p_id;
  if v_quelle is not null and zuwachs > 0 then
    insert into sicherung_quelle (quelle, tag, neu, bytes) values (v_quelle, heute, 0, zuwachs)
      on conflict (quelle, tag) do update
        set neu = sicherung_quelle.neu + excluded.neu, bytes = sicherung_quelle.bytes + excluded.bytes;
  end if;
  return jetzt;
end $$;

-- Lesen mit der Kennung allein: Ohne den Schlüssel ist das Chiffrat Rauschen,
-- und die Kennung ist eine 256-Bit-Zufallszahl – erraten lässt sie sich nicht.
create or replace function sicherung_lesen(p_id text)
returns table (daten text, iv text, groesse int, stand timestamptz)
language sql security definer set search_path = public, pg_temp as $$
  select s.daten, s.iv, s.groesse, s.stand from sicherung s where s.id = p_id;
$$;

-- Der Weg zurück. Gibt zurück, wie viele Zeilen weggingen – sonst müsste die
-- App "Gelöscht" sagen, ohne es zu wissen.
create or replace function sicherung_loeschen(p_id text, p_w text)
returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare weg int;
begin
  delete from sicherung
   where id = p_id
     and w_hash = encode(sha256(convert_to(coalesce(p_w, ''), 'UTF8')), 'hex');
  get diagnostics weg = row_count;
  return weg;
end $$;

-- Nur die drei Funktionen sind erreichbar, die Tabellen selbst nicht.
revoke all on table sicherung, sicherung_quelle, sicherung_salz from anon, authenticated;
revoke all on function sicherung_schreiben(text, text, text, text, timestamptz),
                       sicherung_lesen(text), sicherung_loeschen(text, text)
  from public, anon, authenticated;
grant execute on function sicherung_schreiben(text, text, text, text, timestamptz),
                          sicherung_lesen(text), sicherung_loeschen(text, text)
  to anon;

-- PostgREST die neuen Funktionen sofort zeigen, statt auf den nächsten
-- Neustart seines Zwischenspeichers zu warten.
notify pgrst, 'reload schema';
