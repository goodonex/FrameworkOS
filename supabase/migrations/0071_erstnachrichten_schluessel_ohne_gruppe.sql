-- 0071: Der Schlüssel der Erstnachrichten löst sich von der Gruppen-Überschrift.
--
-- **Der Fehler.** 0060 hat den Datensatz über `(brand_id, gruppe, name)`
-- identifiziert, und der Runner spiegelt mit genau diesem Konflikt-Ziel
-- (`runner/index.mjs`, `on_conflict=brand_id,gruppe,name`). Die `gruppe` ist
-- aber kein Schlüssel, sondern eine Überschrift aus dem Vault — sie wird beim
-- Pflegen umformuliert. Am 14.08. stand in der Datei
--   "## Gruppe 1 — Erste Charge · 27 Kontakte (raus 13./14.07.)"
-- wo vorher
--   "## Gruppe 1 — Erste Charge · 27 Kontakte (raus am 13.07., nur Sabine
--    Keulertz noch offen)"
-- stand. Kein bestehender Datensatz passte mehr auf den Konflikt, also legte
-- der Spiegel die komplette Gruppe ein zweites Mal an: 145 Zeilen für 118
-- Leads, die Kachel meldete "144 offen", und Roland Wettstein — längst als
-- gesendet abgehakt — stand als frischer Lead wieder in der Liste.
--
-- **Die Regel ab jetzt.** Eine Person je Marke ist eine Zeile. Die `gruppe`
-- wird zu dem, was sie immer war: eine mitlaufende Beschriftung, die der
-- Spiegel aktualisiert, statt einen neuen Datensatz zu erzeugen.
--
-- **Reihenfolge.** Schritt 1 rettet den Fortschritt (verlustfrei, ändert nur
-- Status/sent_at der überlebenden Zeile). Danach müssen die verwaisten
-- Doppel-Zeilen weg — das ist eine Löschung an Kevins Bestand und steht
-- deshalb NICHT in dieser Migration. Das exakte Statement liegt in der
-- Übergabe (Runde 14.08., Abschnitt „Bestandsdaten"). Schritt 3 bricht mit
-- klarer Meldung ab, solange noch Doppel da sind — lieber ein lauter Abbruch
-- als ein halb umgestellter Schlüssel.

-- 1) Fortschritt retten: Die zuletzt gespiegelte Zeile einer Person (sie trägt
--    den aktuellen Text und die aktuelle Gruppe) erbt den weitesten Stand aller
--    ihrer Doppel. Idempotent — ein zweiter Lauf ändert nichts mehr.
with rang as (
  select
    id,
    brand_id,
    name,
    row_number() over (
      partition by brand_id, name
      order by last_synced_at desc, sort_index asc, id asc
    ) as rn
  from linkedin_erstnachrichten
),
fortschritt as (
  select
    e.brand_id,
    e.name,
    max(case e.status when 'gesendet' then 2 when 'uebersprungen' then 1 else 0 end) as stand,
    max(e.sent_at) as sent_at
  from linkedin_erstnachrichten e
  group by e.brand_id, e.name
)
update linkedin_erstnachrichten z
set
  status = case f.stand when 2 then 'gesendet' when 1 then 'uebersprungen' else z.status end,
  sent_at = case when f.stand = 2 then coalesce(z.sent_at, f.sent_at) else z.sent_at end
from rang r
join fortschritt f on f.brand_id = r.brand_id and f.name = r.name
where z.id = r.id
  and r.rn = 1
  and f.stand > case z.status when 'gesendet' then 2 when 'uebersprungen' then 1 else 0 end;

-- 2) Wächter: Ohne Bereinigung geht es hier nicht weiter, und die Meldung sagt
--    auch, wie viele Zeilen betroffen sind.
do $$
declare
  doppel int;
begin
  select coalesce(sum(n - 1), 0) into doppel
  from (
    select count(*) as n
    from linkedin_erstnachrichten
    group by brand_id, name
    having count(*) > 1
  ) d;

  if doppel > 0 then
    raise exception
      'linkedin_erstnachrichten: % ueberzaehlige Zeile(n) je (brand_id, name). Zuerst die Bereinigung aus der Uebergabe vom 14.08. fahren, dann 0071 erneut pushen.',
      doppel;
  end if;
end $$;

-- 3) Der neue Schlüssel. Als Unique-INDEX, nicht als Constraint: PostgREST
--    schliesst `on_conflict=brand_id,name` auch daraus, und ein Index lässt
--    sich ohne Namens-Raterei idempotent anlegen.
create unique index if not exists linkedin_erstnachrichten_brand_name_key
  on linkedin_erstnachrichten (brand_id, name);

-- 4) Der alte, gruppen-abhängige Schlüssel fliegt raus. Bliebe er stehen, wäre
--    er zwar harmlos (der neue ist strenger), aber irreführend — er ist genau
--    die Zusage, die sich als falsch erwiesen hat.
do $$
declare
  c text;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where rel.relname = 'linkedin_erstnachrichten'
      and ns.nspname = 'public'
      and con.contype = 'u'
      and (
        -- `attname` ist `name`, nicht `text`. Ohne den Cast gibt es keinen
        -- `=`-Operator fuer die beiden Array-Typen und die Migration bricht mit
        -- 42883 ab (passiert am 14.08. beim ersten Push).
        select array_agg(att.attname::text order by att.attname::text)
        from unnest(con.conkey) k
        join pg_attribute att on att.attrelid = con.conrelid and att.attnum = k
      ) = array['brand_id', 'gruppe', 'name']
  loop
    execute format('alter table public.linkedin_erstnachrichten drop constraint %I', c);
  end loop;
end $$;
