-- Die Testleichen aus der Rückkanal-Tabelle räumen.
--
--   Wo:  Supabase → SQL Editor → einfügen → Run
--   Wer: nur der Betreiber. Der öffentliche Schlüssel der App kommt an die
--        Tabelle gar nicht heran (siehe README, Abschnitt Rückkanal), und das
--        ist Absicht – auch dieses Aufräumen geht deshalb nur von Hand.
--
-- WARUM DAS NICHTS KAPUTT MACHT
--
-- Die Tabelle ist ein Zwischenstand, kein Archiv. Jede Zeile entsteht neu, wenn
-- ein Gerät das nächste Mal meldet: Die Zahlen stehen im Browser des Geräts,
-- nicht hier. Eine gelöschte Zeile eines Geräts, das noch benutzt wird, ist beim
-- nächsten Öffnen der App wieder da – mit aktuellen Zahlen. Verloren geht nur,
-- was zu einem Gerät gehört, das sich nie wieder meldet. Genau das soll weg.
--
-- WAS DIE TESTLEICHEN SIND
--
-- Bis zum 28.08.2026 hat jeder Browsertestlauf gemeldet wie ein echtes Gerät:
-- frischer Browserkontext, also neue Gerätekennung, kein `lastShare`, keine
-- Drossel. Rund 1000 Zeilen kamen so zusammen. Seit js/config.js Meldungen von
-- lokalen Adressen blockiert (Commit 380cd1a), passiert das nicht mehr – aber
-- die alten Zeilen stehen noch da und lassen die Übersicht wie eine
-- Erfolgsmeldung aussehen.

-- ---------------------------------------------------------------------------
-- 1. ERST ANSEHEN. Nichts löschen, was man nicht vorher gezählt hat.
-- ---------------------------------------------------------------------------

-- Wie viele Zeilen, wie alt, wie viele davon haben je trainiert?
select count(*) as zeilen,
       min(gesehen) as aelteste_meldung,
       max(gesehen) as neueste_meldung,
       count(*) filter (where coalesce(einheiten, 0) = 0) as ohne_eine_einheit
from nutzung;

-- Nach Name gruppiert. Die Testnamen stehen ausschließlich in tests/*.mjs:
-- T, Tom, Mia, Alex, Chris – und ein Name, der ein XSS-Versuch ist. „Tobi"
-- steht in beiden Welten, echt und im Test; der wird deshalb nicht am Namen
-- erkannt, sondern am Datum.
select coalesce(name, '(null)') as name,
       count(*) as zeilen,
       min(gesehen) as von,
       max(gesehen) as bis,
       max(coalesce(einheiten, 0)) as meiste_einheiten
from nutzung
group by 1
order by zeilen desc;

-- Was Schritt 2 löschen würde – dieselbe Bedingung, nur als Auszug.
select id, name, fokus, einheiten, saetze, gesehen
from nutzung
where gesehen <= date '2026-08-29'
order by gesehen, name
limit 50;

-- ---------------------------------------------------------------------------
-- 2. DANN LÖSCHEN. Eine Zeile Bedingung, und die trennt sauber.
-- ---------------------------------------------------------------------------
--
-- Alles, was sich seit dem Tag nach der Korrektur nicht mehr gemeldet hat, ist
-- eine Testleiche: Ein Gerät, das die App wirklich benutzt, meldet bei jedem
-- Öffnen (höchstens einmal am Tag). Diese Regel braucht keine Namensliste, sie
-- rät nicht, und sie heilt sich selbst – ein aktives Gerät, das hier
-- fälschlich getroffen wird, steht beim nächsten Öffnen wieder da.
--
-- Bewusst `<=` und nicht `<`: Am 28.08. lief noch getestet, bevor die Sperre
-- griff.

delete from nutzung
where gesehen <= date '2026-08-29';

-- ---------------------------------------------------------------------------
-- 3. NACHSEHEN, ob es gereicht hat.
-- ---------------------------------------------------------------------------

select count(*) as verbleibend,
       min(gesehen) as aelteste_meldung
from nutzung;

select coalesce(name, '(null)') as name, count(*) as zeilen, max(gesehen) as bis
from nutzung
group by 1
order by zeilen desc;

-- Bleibt danach noch eine Zeile mit einem der Testnamen stehen, stammt sie von
-- einem Lauf nach der Korrektur – dann stimmt etwas mit der Sperre nicht, und
-- das gehört geprüft, nicht weggelöscht:
--
--   select id, name, gesehen from nutzung
--   where name in ('T', 'Tom', 'Mia', 'Alex', 'Chris') or name like '%<img%';
