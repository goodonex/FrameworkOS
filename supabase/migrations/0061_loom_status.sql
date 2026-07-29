-- 0061: Loom-Status auf linkedin_threads + gemessene Arbeitsdauern
-- (Wargame docs/wargames/sales-arbeitsmodus.md, Zug 2).
--
-- loom_status führt, ob ein zugesagter Lead (starred) sein Loom schon hat.
-- `starred` bleibt unverändert „hat zugesagt" — das hier ist der fehlende
-- Status danach.
--
-- arbeits_dauern ist die einzige Vorleistung fürs Zielbild (Kalenderplanung,
-- siehe Plan): ohne echte gemessene Dauern müsste später geschätzt werden,
-- und nachträglich sind sie nicht rekonstruierbar.

alter table linkedin_threads
  add column if not exists loom_status text not null default 'offen'
    check (loom_status in ('offen', 'aufgenommen', 'verschickt', 'entfaellt')),
  add column if not exists loom_erledigt_at timestamptz;

create index if not exists linkedin_threads_loom_idx
  on linkedin_threads (brand_id, loom_status) where starred;

create table if not exists arbeits_dauern (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  spur text not null,
  posten_id text not null,
  sekunden int not null,
  erledigt_at timestamptz not null default now()
);

create index if not exists arbeits_dauern_spur_idx on arbeits_dauern (brand_id, spur, erledigt_at);

alter table arbeits_dauern enable row level security;

drop policy if exists "arbeits_dauern_via_brand" on arbeits_dauern;
create policy "arbeits_dauern_via_brand" on arbeits_dauern
  for all
  using (exists (select 1 from brands b where b.id = arbeits_dauern.brand_id and b.user_id = auth.uid()))
  with check (exists (select 1 from brands b where b.id = arbeits_dauern.brand_id and b.user_id = auth.uid()));
