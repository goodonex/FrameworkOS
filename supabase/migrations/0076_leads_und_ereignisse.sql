-- 0076 — Das Lead-System: jeder LinkedIn-Kontakt wird ein Lead mit Geschichte.
--
-- Blaupause: docs/wargames/lead-system.md (20.08.2026).
--
-- Warum eine eigene Tabelle und nicht ein paar Spalten an `linkedin_netzwerk`:
-- die Spiegel gehören dem Runner. `netzwerkUpsert.mjs` upsertet auf
-- (brand_id, profil_key), `upsert.mjs` auf (brand_id, thread_key) — Kevins
-- Handarbeit (Wiedervorlage, Notiz, Disqualifikation) in einer Tabelle, die ein
-- Sync-Lauf anfasst, ist genau die Sorte stiller Datenverlust, die dieses Repo
-- schon zweimal repariert hat (0071, O1). Dazu kommt: nicht jeder Lead steht im
-- Netzwerk-Spiegel — wer Kevin von sich aus geschrieben hat, hat einen Thread,
-- aber keine Einladung.
--
-- **Zwei Schlüssel, weil LinkedIn zwei Sorten IDs ausgibt.** Am 20.08. an Prod
-- gemessen: Die Einladungs-/Kontaktliste liefert lesbare Slugs
-- ('anton-bachhaeubl-45a96920b'), das Postfach liefert opake IDs
-- ('ACoAACAUWC4BuMVJg4jiN3by3fe0AOX7y9uz4Fw'). Die Schnittmenge ist **leer** —
-- ein URL-Abgleich zwischen beiden Welten trifft in 0 von 239 Fällen. Deshalb
-- hält der Lead beide: `profil_key` aus dem Netzwerk, `li_urn` aus dem Postfach.
-- Verheiratet werden sie über den Namen (230 von 239 eindeutig); ist das einmal
-- geschehen, hält `li_urn` die Verbindung dauerhaft fest und der Namensabgleich
-- muss sie nie wieder erraten.

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,

  -- Slug aus linkedin_netzwerk, '' wenn der Lead nur aus dem Postfach kommt.
  profil_key text not null default '',
  -- Opake ID aus linkedin_threads.profile_url, '' bis der Lead einen Thread hat.
  li_urn text not null default '',
  profile_url text not null default '',

  name text not null,
  headline text not null default '',

  -- 'aktiv'          — läuft durch den Workflow
  -- 'wiedervorlage'  — Kevin hat ein Datum gesetzt, sticht jede Fälligkeit
  -- 'ruht'           — Kadenz durchlaufen, kommt nach RUHE_MONATE von selbst wieder
  -- 'disqualifiziert'— bewusst aussortiert, mit Grund; wird nie gelöscht
  -- 'kunde'          — in contacts übergegangen, Endstation
  lead_status text not null default 'aktiv'
    check (lead_status in ('aktiv', 'wiedervorlage', 'ruht', 'disqualifiziert', 'kunde')),

  wiedervorlage_am date,
  wiedervorlage_grund text not null default '',
  disqualifiziert_grund text not null default '',

  -- Kevins „den ruf ich einfach mal an"-Fähnchen aus dem Abend-Rückblick.
  markiert boolean not null default false,
  notiz text not null default '',

  -- Bewusst leer angelegt: die Kanäle E-Mail/Postkarte/Anruf brauchen sie,
  -- die Beschaffung (Apollo o. ä.) ist eine eigene spätere Runde.
  email text not null default '',
  telefon text not null default '',
  anschrift text not null default '',

  first_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Teil-Unique: leere Schlüssel dürfen sich beliebig oft wiederholen, gefüllte
-- nie. Ohne das WHERE würde der erste Nur-Postfach-Lead jeden weiteren blocken.
create unique index if not exists leads_profil_key_uidx
  on leads (brand_id, profil_key) where profil_key <> '';
create unique index if not exists leads_li_urn_uidx
  on leads (brand_id, li_urn) where li_urn <> '';

create index if not exists leads_status_idx
  on leads (brand_id, lead_status, wiedervorlage_am);
create index if not exists leads_name_idx on leads (brand_id, name);

alter table leads enable row level security;
drop policy if exists "leads_via_brand" on leads;
create policy "leads_via_brand" on leads
  for all
  using (
    exists (select 1 from brands b where b.id = leads.brand_id and b.user_id = auth.uid())
  )
  with check (
    exists (select 1 from brands b where b.id = leads.brand_id and b.user_id = auth.uid())
  );

-- Das Gedächtnis. **Append-only** — kein Update, kein Delete; Korrekturen sind
-- neue Ereignisse. Damit kann die Historie nicht durch einen Sync-Lauf oder
-- einen Fehlklick verloren gehen, und „wie oft habe ich den geschrieben" ist
-- eine Zählung statt einer Rekonstruktion aus den letzten zehn Nachrichten.
create table if not exists lead_ereignisse (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,

  typ text not null check (typ in (
    'anfrage', 'angenommen', 'erstnachricht', 'followup', 'antwort_erhalten',
    'loom_zugesagt', 'loom_gesendet',
    'inmail', 'email', 'postkarte', 'anruf',
    'wiedervorlage_gesetzt', 'disqualifiziert', 'reaktiviert', 'notiz'
  )),
  at timestamptz not null,
  -- 'sync' | 'ui' | 'backfill' — woher das Ereignis kam.
  quelle text not null default 'ui',
  details jsonb not null default '{}'::jsonb,
  erstellt_at timestamptz not null default now()
);

-- Idempotenz des Backfills: derselbe Vorgang zur selben Sekunde ist derselbe
-- Vorgang. Zweimal laufen lassen erzeugt keine Dubletten.
create unique index if not exists lead_ereignisse_uidx
  on lead_ereignisse (lead_id, typ, at);

create index if not exists lead_ereignisse_tag_idx on lead_ereignisse (brand_id, at desc);
create index if not exists lead_ereignisse_lead_idx on lead_ereignisse (lead_id, at);

alter table lead_ereignisse enable row level security;
drop policy if exists "lead_ereignisse_via_brand" on lead_ereignisse;
create policy "lead_ereignisse_via_brand" on lead_ereignisse
  for all
  using (
    exists (select 1 from brands b where b.id = lead_ereignisse.brand_id and b.user_id = auth.uid())
  )
  with check (
    exists (select 1 from brands b where b.id = lead_ereignisse.brand_id and b.user_id = auth.uid())
  );

-- Rückverweise an den Spiegeln. Die Sync-Läufe schicken diese Spalten nie mit,
-- und PostgREST fasst bei `resolution=merge-duplicates` ausschließlich die
-- mitgeschickten Spalten an (siehe Kommentar in runner/linkedin/upsert.mjs) —
-- ein Sync kann eine einmal gesetzte Verbindung also nicht überschreiben.
alter table linkedin_netzwerk add column if not exists lead_id uuid references leads(id) on delete set null;
alter table linkedin_threads add column if not exists lead_id uuid references leads(id) on delete set null;
alter table linkedin_erstnachrichten add column if not exists lead_id uuid references leads(id) on delete set null;

create index if not exists linkedin_netzwerk_lead_idx on linkedin_netzwerk (lead_id);
create index if not exists linkedin_threads_lead_idx on linkedin_threads (lead_id);
create index if not exists linkedin_erstnachrichten_lead_idx on linkedin_erstnachrichten (lead_id);
