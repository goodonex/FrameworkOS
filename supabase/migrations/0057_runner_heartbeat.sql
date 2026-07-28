-- 0057: Runner-Heartbeat fürs Live-Cockpit.
-- Der Runner-Status-Punkt (Statusleiste) pollte bisher direkt http://127.0.0.1:4711.
-- Von der HTTPS-Live-Domain (frameworkos.de) blockt der Browser diesen HTTP-Call
-- als Mixed Content → der Runner erscheint IMMER offline, obwohl er lokal läuft
-- (analog zum Graph, siehe 0054). Lösung: der Runner schreibt alle paar Sekunden
-- einen Heartbeat in diese Tabelle (service_role, umgeht RLS); die Live-Seite liest
-- last_seen über HTTPS und zeigt online, wenn der Herzschlag frisch ist.
-- Single-User-App → eine globale Zeile. Idempotent, additiv.

create table if not exists runner_heartbeat (
  id text primary key default 'global',
  last_seen timestamptz not null default now(),
  running jsonb not null default '[]'::jsonb,
  queued jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint runner_heartbeat_singleton check (id = 'global')
);

alter table runner_heartbeat enable row level security;

-- Lesen nur für eingeloggte Nutzer (Kevin). Kein anon-Zugriff.
-- Geschrieben wird ausschließlich vom Runner mit service_role (umgeht RLS).
drop policy if exists "runner_heartbeat_auth_read" on runner_heartbeat;
create policy "runner_heartbeat_auth_read" on runner_heartbeat
  for select
  using (auth.uid() is not null);
