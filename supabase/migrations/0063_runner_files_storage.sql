-- 0063: Datei-Spiegel des Runners (Etappe 2 „Handy vollwertig").
--
-- Problem: Loom-Skripte, Follow-up-PDFs, Wochen-Galerien und Ad-Creatives liegen
-- auf Kevins Platte und wurden nur über http://127.0.0.1:4711/files/… ausgeliefert.
-- Auf der HTTPS-Domain (Handy) sind das tote Links — die Oberfläche sagte
-- deshalb „Skript bereit — am Mac öffnen".
--
-- Lösung wie beim Runs-Spiegel: der Runner schiebt raus. Er lädt genau die
-- Dateien, die die Oberfläche verlinkt, in diesen privaten Bucket (Upsert per
-- mtime-Vergleich) und veröffentlicht das Verzeichnis als Snapshot
-- `files_index` in runner_snapshots. Das Cockpit macht daraus signierte URLs.
--
-- Geschrieben wird ausschließlich vom Runner mit service_role (umgeht RLS) —
-- deshalb gibt es hier bewusst KEINE insert/update/delete-Policy.

insert into storage.buckets (id, name, public, file_size_limit)
values ('runner-files', 'runner-files', false, 26214400) -- 25 MB, = FILE_MAX_BYTES im Runner
on conflict (id) do update set public = false, file_size_limit = 26214400;

-- Lesen darf, wer eine eigene Brand besitzt — also Kevin. Portal-Kunden haben
-- keine brands-Zeile und kommen damit an keine Datei.
drop policy if exists "runner_files_owner_read" on storage.objects;
create policy "runner_files_owner_read" on storage.objects
  for select
  using (
    bucket_id = 'runner-files'
    and exists (select 1 from brands b where b.user_id = auth.uid())
  );
