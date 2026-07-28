-- 0058: LinkedIn-Follow-up-Threads (Wargame docs/wargames/linkedin-followups.md, Zug 4).
-- Sync liest lesend aus dem Voyager-API-Postfach (runner/linkedin/sync.mjs) und
-- schreibt hierher (runner/linkedin/upsert.mjs, service_role, umgeht RLS).
-- followup_stage/snoozed_until/status/first_seen_at sind Kevins Steuerung und
-- werden vom Sync nie überschrieben (siehe Zug 5).

create table if not exists linkedin_threads (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  thread_key text not null,
  contact_id uuid references contacts(id) on delete set null,
  name text not null default '',
  company text not null default '',
  profile_url text not null default '',
  preview text not null default '',
  last_message_at timestamptz,
  last_from text not null default 'unknown' check (last_from in ('me', 'them', 'unknown')),
  unread boolean not null default false,
  -- LinkedIn-Stern. Kevins Konvention: Lead hat Ja zur Loom-Analyse gesagt.
  starred boolean not null default false,
  followup_stage int not null default 0,
  snoozed_until timestamptz,
  status text not null default 'active'
    check (status in ('active', 'waiting_reply', 'won', 'lost', 'archived')),
  first_seen_at timestamptz not null default now(),
  last_synced_at timestamptz not null default now(),
  unique (brand_id, thread_key)
);

create index if not exists linkedin_threads_brand_status_idx on linkedin_threads (brand_id, status);
create index if not exists linkedin_threads_contact_idx on linkedin_threads (contact_id);

alter table linkedin_threads enable row level security;

-- Muster 1:1 aus 0009_rls.sql (contacts_via_brand) übernommen.
drop policy if exists "linkedin_threads_via_brand" on linkedin_threads;
create policy "linkedin_threads_via_brand" on linkedin_threads
  for all
  using (
    exists (select 1 from brands b where b.id = linkedin_threads.brand_id and b.user_id = auth.uid())
  )
  with check (
    exists (select 1 from brands b where b.id = linkedin_threads.brand_id and b.user_id = auth.uid())
  );
