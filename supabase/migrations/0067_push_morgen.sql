-- 0067 — Morgen-Push (O3, Zug 2 des Wargames docs/wargames/morgen-workflow.md)
--
-- Drei Dinge: wohin gepusht wird (push_subscriptions), was heute schon raus ist
-- (push_log), und wer den Versand antreibt (pg_cron → Edge Function).
--
-- Regel dieses Repos seit dem 15.07.: Migrationen ausschliesslich ueber
-- `supabase db push`, nie im SQL-Editor. Genau das hatte die Historie zerlegt.

-- ---------------------------------------------------------------------------
-- Abonnements des Browsers/der PWA
-- ---------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Der Endpoint ist die Identitaet des Geraets. Unique, damit ein erneutes
  -- Aktivieren dieselbe Zeile aktualisiert statt Leichen anzuhaeufen — nach
  -- einer PWA-Neuinstallation am iPhone passiert genau das.
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

comment on table public.push_subscriptions is
  'Web-Push-Abonnements je Geraet (O3). Der Versand laeuft ueber die Edge Function morgen-push mit Service-Role — diese Policies gelten fuer den Browser.';

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_select_own" on public.push_subscriptions;
create policy "push_subscriptions_select_own" on public.push_subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "push_subscriptions_insert_own" on public.push_subscriptions;
create policy "push_subscriptions_insert_own" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);

drop policy if exists "push_subscriptions_update_own" on public.push_subscriptions;
create policy "push_subscriptions_update_own" on public.push_subscriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "push_subscriptions_delete_own" on public.push_subscriptions;
create policy "push_subscriptions_delete_own" on public.push_subscriptions
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Tages-Protokoll: genau ein Push je Werktag
-- ---------------------------------------------------------------------------
-- Der Primaerschluessel IST die Sperre: Zwei Cron-Laeufe (Sommer- und
-- Winter-Zeile, siehe unten) treffen am selben Tag denselben Schluessel, und
-- der zweite prallt ab. Kein Zaehler, kein Lock, keine Race-Condition.
create table if not exists public.push_log (
  datum date primary key,
  sent_at timestamptz not null default now(),
  empfaenger int not null default 0,
  payload jsonb
);

comment on table public.push_log is
  'Ein Eintrag je Tag, an dem der Morgen-Push rausging (O3). Der Primaerschluessel verhindert den zweiten Push desselben Tages.';

alter table public.push_log enable row level security;

-- Nur lesen, und nur eingeloggt. Geschrieben wird ausschliesslich von der Edge
-- Function mit Service-Role, die an RLS vorbeigeht.
drop policy if exists "push_log_select_authenticated" on public.push_log;
create policy "push_log_select_authenticated" on public.push_log
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Takt: zwei Cron-Zeilen, ein Push (D3 im Wargame)
-- ---------------------------------------------------------------------------
-- 5:00 UTC und 6:00 UTC — im Sommer trifft die erste 7:00 Berliner Zeit, im
-- Winter die zweite. Die Function prueft selbst, ob es gerade 7 Uhr in Berlin
-- ist und ob heute schon etwas rausging. Damit ist die Zeitumstellung erledigt,
-- ohne dass jemand zweimal im Jahr an einem Cron-Ausdruck dreht.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Idempotent: `db push` darf mehrfach laufen, ohne zu scheitern.
select cron.unschedule('morgen-push-sommer')
where exists (select 1 from cron.job where jobname = 'morgen-push-sommer');
select cron.unschedule('morgen-push-winter')
where exists (select 1 from cron.job where jobname = 'morgen-push-winter');

-- Die beiden Geheimnisse liegen im Vault (Zug 3), NICHT in dieser Datei:
-- `project_url` und `cron_key`. Die Job-SQL wird als Text gespeichert und erst
-- beim Feuern ausgewertet — fehlt ein Secret, scheitert der Lauf zur Laufzeit
-- und steht in cron.job_run_details, nicht hier beim Einspielen.
select cron.schedule(
  'morgen-push-sommer',
  '0 5 * * 1-5',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/morgen-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-key', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'morgen-push-winter',
  '0 6 * * 1-5',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/morgen-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-key', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
