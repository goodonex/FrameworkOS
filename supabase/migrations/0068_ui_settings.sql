-- 0068: Oberflächen-Einstellungen geräteübergreifend (O18 v2 d).
--
-- Anlass ist die selbst gewählte Reihenfolge der App-Kacheln auf dem mobilen
-- Homescreen. Sie in localStorage zu legen wäre der bequeme Weg gewesen — und
-- der falsche: die PWA einmal löschen und neu zum Home-Bildschirm hinzufügen
-- ist bei diesem Projekt ein dokumentierter Schritt (O3, für den Service
-- Worker). Genau dabei wäre die Anordnung jedes Mal weg. Dieselbe Lehre wie
-- bei 0062 (Monatsziele), nur eine Ebene höher.
--
-- Bewusst ein schmaler Schlüssel/Wert-Speicher je Nutzer statt einer Spalte je
-- Einstellung: die nächste Oberflächen-Einstellung soll keine Migration mehr
-- kosten. Was drinsteht, definiert die App (`lib/uiSettings.ts`), nicht die DB.
-- Additiv und idempotent.

create table if not exists ui_settings (
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Kennung der Einstellung, z. B. 'home.kachelReihenfolge'.
  setting_key text not null,
  setting_value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, setting_key)
);

alter table ui_settings enable row level security;

-- Einstellungen sind persönlich: kein Brand-Umweg, der Nutzer selbst ist die Grenze.
drop policy if exists "ui_settings_own" on ui_settings;
create policy "ui_settings_own" on ui_settings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function set_ui_settings_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists ui_settings_set_updated_at on ui_settings;
create trigger ui_settings_set_updated_at
before update on ui_settings
for each row execute function set_ui_settings_updated_at();

comment on table ui_settings is 'Oberflaechen-Einstellungen je Nutzer (Schluessel/Wert). Erste Nutzung: Reihenfolge der App-Kacheln auf dem Homescreen.';
