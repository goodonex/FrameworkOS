-- ============================================================
-- 0074 — sales_tagesportionen: das eingefrorene Tages-Soll je Flow-Stufe
--
-- Gehört zum Sales-Flow-Umbau (18.08.2026): /sales wird eine von oben nach
-- unten abarbeitbare Tagesroutine. Drei Stufen haben kein festes Ziel,
-- sondern ein Soll aus den Daten des Tages (Erstnachrichten: was offen ist;
-- Follow-ups: die Portion aus dem Fälligen; Looms: das Ziel, gedeckelt auf
-- die offenen Zusagen).
--
-- WARUM eine Tabelle und keine Live-Rechnung:
--
--   1. Ohne Einfrieren ist „20/20" ein bewegliches Ziel. Um 6:00 sind 20
--      fällig, um 14:00 sind es 23, weil neue Fälle nachgerutscht sind — die
--      Stufe würde nie grün. Die Portion wird beim ersten Öffnen des Tages
--      festgeschrieben; was danach reinkommt, ist Ware für morgen.
--   2. Die Streak („n Werktage in Folge geschafft") braucht das Soll
--      VERGANGENER Tage. `daily_metrics` hat nur die Ist-Werte; was an einem
--      Dienstag vor drei Wochen fällig WAR, ist aus keiner Live-Liste mehr
--      rekonstruierbar. Diese Tabelle ist das Gedächtnis der Ansprüche.
--
-- Zeilen werden GENAU EINMAL geschrieben (insert, on conflict do nothing —
-- der erste Stand des Tages gewinnt, auch über zwei Geräte) und nie geändert.
-- Deshalb kein updated_at.
--
-- Gleiche Tages-Achse und gleiches RLS-Muster wie 0049/0072.
-- Additiv und idempotent — nichts Bestehendes wird angefasst.
-- ============================================================

create table if not exists sales_tagesportionen (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  brand_id uuid not null references brands(id) on delete cascade,
  datum date not null,

  -- Die Flow-Stufe (app/src/cockpit/lib/tagesFlow.ts, PORTION_STUFEN).
  -- Nur die Aus-den-Daten-Stufen frieren ein; feste Ziele (Anfragen 30,
  -- InMails 5) sind von sich aus stabil und stehen hier nicht.
  stufe text not null,

  -- Das eingefrorene Soll. 0 ist eine gültige Aussage: „heute war nichts
  -- fällig" — die Stufe gilt dann als erledigt, die Streak reisst nicht.
  soll int not null,

  created_at timestamptz not null default now(),

  unique (user_id, brand_id, datum, stufe),
  constraint sales_tagesportionen_soll_plausibel check (soll >= 0 and soll <= 1000),
  constraint sales_tagesportionen_stufe_bekannt
    check (stufe in ('erstnachrichten', 'followups', 'looms'))
);

create index if not exists sales_tagesportionen_user_brand_datum_idx
  on sales_tagesportionen (user_id, brand_id, datum desc);

-- RLS (Owner-only, Muster aus 0049)
alter table sales_tagesportionen enable row level security;

drop policy if exists "sales_tagesportionen_owner_all" on sales_tagesportionen;
create policy "sales_tagesportionen_owner_all" on sales_tagesportionen
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
