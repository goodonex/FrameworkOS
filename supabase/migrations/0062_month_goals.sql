-- 0062: Monatsziele geräteübergreifend.
-- Bisher lagen abweichende Monats-Totals nur in localStorage
-- (`cockpit.monthTarget.<YYYY-MM>`, goals.ts) — und es gab gar kein UI dafür:
-- `setMonthTotalOverride` hatte null Aufrufer. Folge: ab September 2026 zeigt die
-- Home stillschweigend den 40.000-€-Planungs-Default, und Mac und Handy hätten
-- ohnehin unterschiedliche Ziele angezeigt.
-- Ein Ziel je Brand und Monat. Idempotent, additiv.

create table if not exists month_goals (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  -- Kalendermonat als 'YYYY-MM' (gleicher Schlüssel wie goals.monthTargetFor).
  month_key text not null,
  -- Umsatzziel des Monats in ganzen Euro.
  total integer not null check (total > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint month_goals_month_key_format check (month_key ~ '^\d{4}-\d{2}$')
);

create unique index if not exists month_goals_brand_month_idx
  on month_goals (brand_id, month_key);

alter table month_goals enable row level security;

drop policy if exists "month_goals_via_brand" on month_goals;
create policy "month_goals_via_brand" on month_goals
  for all
  using (exists (select 1 from brands b where b.id = month_goals.brand_id and b.user_id = auth.uid()))
  with check (exists (select 1 from brands b where b.id = month_goals.brand_id and b.user_id = auth.uid()));

create or replace function set_month_goals_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists month_goals_set_updated_at on month_goals;
create trigger month_goals_set_updated_at
before update on month_goals
for each row execute function set_month_goals_updated_at();

comment on table month_goals is 'Umsatz-Monatsziel je Brand (ersetzt den localStorage-Override aus goals.ts)';
