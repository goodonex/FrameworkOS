-- 0059: Runner-Brücke — Aufträge und Spiegel über Supabase.
--
-- Problem: Das Cockpit auf der HTTPS-Domain darf den lokalen Runner-Port nicht
-- ansprechen (Browser-Regel, siehe 0057 für denselben Effekt beim Status-Punkt).
-- Der Runner läuft aber auf genau dem Rechner, an dem Kevin sitzt.
--
-- Lösung: Richtung umdrehen. Der Runner ruft ohnehin regelmäßig bei Supabase an
-- (Heartbeat). Er holt sich dort jetzt auch seine Aufträge ab und legt seine
-- Daten als Spiegel ab. Nichts an Kevins Rechner wird von außen erreichbar —
-- der Runner spricht ausschließlich nach draußen.

-- ---------- Aufträge (Knopfdrücke aus dem Cockpit) ----------
create table if not exists runner_jobs (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'done', 'error')),
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

-- Der Runner fragt nach genau diesem Muster: ältester offener Auftrag zuerst.
create index if not exists runner_jobs_offen_idx on runner_jobs (status, created_at);

alter table runner_jobs enable row level security;

-- Eingeloggte Nutzer dürfen Aufträge anlegen und ihren Stand verfolgen.
-- Geschrieben wird der Fortschritt vom Runner mit service_role (umgeht RLS).
drop policy if exists "runner_jobs_auth_read" on runner_jobs;
create policy "runner_jobs_auth_read" on runner_jobs
  for select using (auth.uid() is not null);

drop policy if exists "runner_jobs_auth_insert" on runner_jobs;
create policy "runner_jobs_auth_insert" on runner_jobs
  for insert with check (auth.uid() is not null);

-- ---------- Spiegel (Daten, die sonst nur lokal lesbar wären) ----------
-- Ein Schlüssel je Ansicht, z. B. 'ads_overview', 'social_weeks', 'agents'.
-- Absichtlich generisch: neue Ansichten brauchen keine neue Migration.
create table if not exists runner_snapshots (
  key text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table runner_snapshots enable row level security;

drop policy if exists "runner_snapshots_auth_read" on runner_snapshots;
create policy "runner_snapshots_auth_read" on runner_snapshots
  for select using (auth.uid() is not null);
