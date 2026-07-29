-- 0060: LinkedIn-Erstnachrichten als Arbeitsliste.
--
-- Der Text kommt weiter aus dem Vault (der linkedin-leads-Skill schreibt ihn) —
-- die Datei bleibt die Quelle der Wahrheit für den Inhalt. Was ihr fehlte, war
-- der STATUS: Kevin musste sich in einer 1300-Zeilen-Datei merken, wo er stehen
-- geblieben ist, und konnte das vom Handy aus gar nicht sehen.
--
-- Diese Tabelle führt nur den Status. Der Runner spiegelt die Texte hier rein
-- und fasst `status`/`sent_at` dabei nie an.

create table if not exists linkedin_erstnachrichten (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  gruppe text not null default '',
  name text not null,
  firma text not null default '',
  website text not null default '',
  nachricht text not null default '',
  -- Reihenfolge aus der Datei = Kevins Abarbeitungsreihenfolge.
  sort_index int not null default 0,
  status text not null default 'offen' check (status in ('offen', 'gesendet', 'uebersprungen')),
  sent_at timestamptz,
  quelle_datei text not null default '',
  last_synced_at timestamptz not null default now(),
  unique (brand_id, gruppe, name)
);

create index if not exists linkedin_erstnachrichten_arbeit_idx
  on linkedin_erstnachrichten (brand_id, status, sort_index);

alter table linkedin_erstnachrichten enable row level security;

drop policy if exists "linkedin_erstnachrichten_via_brand" on linkedin_erstnachrichten;
create policy "linkedin_erstnachrichten_via_brand" on linkedin_erstnachrichten
  for all
  using (
    exists (select 1 from brands b where b.id = linkedin_erstnachrichten.brand_id and b.user_id = auth.uid())
  )
  with check (
    exists (select 1 from brands b where b.id = linkedin_erstnachrichten.brand_id and b.user_id = auth.uid())
  );
