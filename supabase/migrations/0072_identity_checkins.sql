-- ============================================================
-- 0072 — identity_checkins: der tägliche Identitäts-Check-in
--
-- Gehört zum Identity-OS-Modul (Backlog §4, Bedingung erfüllt 16.08.2026).
-- Eine Zeile je Tag: Vertriebsblock, Clean, Sport, Energielevel und die drei
-- Dankbarkeitszeilen aus Kevins Abendroutine (Visionmap 2.0, Regel 3).
--
-- WARUM eine eigene Tabelle und keine Spalten in `daily_metrics`:
--
--   1. `daily_metrics` ist eine Zähl-Tabelle. Alle 19 Felder sind
--      `int not null default 0` und werden über `bump(feld, delta)`
--      hochgezählt. Ein Bool („clean") und drei Textzeilen haben dort keine
--      sinnvolle Semantik — „+1 clean" ist keine Aussage.
--   2. `METRIC_FIELDS` (app/src/cockpit/lib/metrikFelder.ts) ist zugleich das
--      Werkzeug-Schema von Uriels `log_metric`. Jede neue Spalte dort wäre
--      sofort per Sprachbefehl buchbar und tauchte in TrackingArea und
--      QuickTrack auf. Das ist für „Sport gemacht" falsch und für die
--      Dankbarkeit sinnlos.
--   3. HANDOFF.md ist an dieser Stelle ausdrücklich: „Keine neuen
--      Metrikfelder" (`lib/arbeitsmodusTracking.ts`).
--
-- ANGEDOCKT ist die Tabelle trotzdem, und zwar an der Stelle, an der es zählt:
-- gleiche Tages-Achse (`datum` als date), gleicher Schlüssel
-- `(user_id, brand_id, datum)`, gleiches Upsert-Ziel, gleiches RLS-Muster wie
-- 0049. Ein Tag hat damit genau eine Zeile hier und eine dort, und beide
-- lassen sich über das Datum zusammen lesen (Vertriebsblock ✓ neben
-- li_anfragen 30).
--
-- Additiv und idempotent — nichts Bestehendes wird angefasst.
-- ============================================================

create table if not exists identity_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  brand_id uuid not null references brands(id) on delete cascade,
  datum date not null,

  -- Die drei nicht verhandelbaren Einheiten des Tages (Visionmap: „Durchziehen
  -- · Sauberkeit · Zufriedenheit · Clean"). Bewusst `not null default false`:
  -- ein Tag ohne Haken ist ein Tag ohne Haken, nicht ein unbekannter Tag.
  vertriebsblock boolean not null default false,
  clean boolean not null default false,
  sport boolean not null default false,

  -- Energielevel 1–10. NULL heißt „heute noch nicht gesetzt" — anders als bei
  -- den Haken ist 0 hier keine gültige Aussage, die Skala beginnt bei 1.
  energie smallint,

  -- Dankbarkeitstagebuch: drei kurze Zeilen (Visionmap, Abendroutine).
  -- Drei Spalten statt eines Arrays, damit die Zeilen ihren Platz behalten und
  -- der Upsert ohne Array-Merge auskommt.
  dankbar_1 text,
  dankbar_2 text,
  dankbar_3 text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, brand_id, datum),
  constraint identity_checkins_energie_skala check (energie is null or (energie >= 1 and energie <= 10))
);

create index if not exists identity_checkins_user_brand_datum_idx
  on identity_checkins (user_id, brand_id, datum desc);

-- RLS (Owner-only, Muster aus 0049)
alter table identity_checkins enable row level security;

drop policy if exists "identity_checkins_owner_all" on identity_checkins;
create policy "identity_checkins_owner_all" on identity_checkins
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- updated_at automatisch pflegen (Muster aus 0049)
create or replace function set_identity_checkins_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists identity_checkins_updated_at on identity_checkins;
create trigger identity_checkins_updated_at
  before update on identity_checkins
  for each row execute function set_identity_checkins_updated_at();
