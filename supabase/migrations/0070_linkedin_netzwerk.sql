-- 0070: Kevins LinkedIn-Netzwerk — gesendete Einladungen und angenommene Kontakte.
--
-- **Die Lücke, die das schliesst.** Der Postfach-Sync (0058 ff.) kennt nur
-- Konversationen. Wer eine Vernetzungsanfrage bekommen und NICHT angenommen hat,
-- taucht dort nie auf — und wer angenommen hat, aber noch nie angeschrieben
-- wurde, ebenso wenig. Genau das sind aber zwei der fünf Funnel-Stufen:
-- „angenommen, noch keine Erstnachricht" und „nie angenommen → InMail".
-- Bis heute war die Antwort darauf eine Handerhebung im Vault (Baseline vom
-- 27.07.: 880 offene Einladungen). Diese Tabelle macht daraus eine laufende Zahl.
--
-- **Ein Eintrag je Person, nicht je Ereignis.** Nimmt jemand die Einladung an,
-- wandert derselbe Eintrag von 'offen' auf 'angenommen' — deshalb der
-- Unique-Key auf dem Profil-Schlüssel und nicht auf (Status, Person).

create table if not exists linkedin_netzwerk (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  -- Der öffentliche Identifier aus der Profil-URL (linkedin.com/in/<hier>).
  -- Stabiler als der Name und der einzige verlässliche Schlüssel gegen die
  -- Threads: Namen sind mehrdeutig, URNs wechseln je Oberfläche.
  profil_key text not null,
  name text not null,
  headline text not null default '',
  profile_url text not null default '',
  -- offen = Einladung raus, noch nicht angenommen · angenommen = ist Kontakt.
  status text not null check (status in ('offen', 'angenommen')),
  eingeladen_at timestamptz,
  angenommen_at timestamptz,
  -- War der Eintrag im letzten Lauf SEINER Liste noch zu sehen? Trägt die
  -- Regel „Abwesenheits-Schlüsse nur aus vollständigen Läufen": ein
  -- abgebrochener Sync darf niemanden aus der InMail-Liste kippen, nur weil
  -- das Blättern vorher endete.
  zuletzt_gesehen_at timestamptz not null default now(),
  first_seen_at timestamptz not null default now(),
  last_synced_at timestamptz not null default now(),
  unique (brand_id, profil_key)
);

-- Die eine Abfrage, die zählt: „alle offenen Einladungen dieser Marke, älteste
-- zuerst" (InMail-Kandidaten) bzw. „alle Kontakte" (Stufe 1).
create index if not exists linkedin_netzwerk_stufe_idx
  on linkedin_netzwerk (brand_id, status, zuletzt_gesehen_at);

alter table linkedin_netzwerk enable row level security;

drop policy if exists "linkedin_netzwerk_via_brand" on linkedin_netzwerk;
create policy "linkedin_netzwerk_via_brand" on linkedin_netzwerk
  for all
  using (
    exists (select 1 from brands b where b.id = linkedin_netzwerk.brand_id and b.user_id = auth.uid())
  )
  with check (
    exists (select 1 from brands b where b.id = linkedin_netzwerk.brand_id and b.user_id = auth.uid())
  );
