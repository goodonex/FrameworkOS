-- 0065: Antwort-Entwurf direkt am Thread (Etappe 3, Schritt 3 aus
-- docs/IDEEN-2026-07-30-nutzbarkeit.md — „Aktion am Posten, nicht im Bereich").
--
-- Warum eine Spalte und keine eigene Tabelle: je Thread gibt es genau EINEN
-- aktuellen Entwurf. Eine Tabelle brächte einen Join, eine zweite RLS-Policy und
-- einen zweiten Hook, ohne eine Frage zu beantworten, die die Spalte nicht schon
-- beantwortet. `linkedin_threads` wird ohnehin komplett geladen
-- (useLinkedinThreads, select *) — der Entwurf kommt damit ohne eine einzige
-- zusätzliche Abfrage am Posten an.
--
-- Warum nicht localStorage (wie beim Freigaben-Status, approvalStatus.ts):
-- der Entwurf entsteht nachts auf dem Mac und wird morgens am Handy gebraucht.
-- Gerätelokal wäre er genau dann leer, wenn er zählt.
--
-- Geschrieben ausschließlich vom Runner nach einem `linkedin-antwort-entwuerfe`-Lauf
-- (service_role). Gelöscht wird er beim Abhaken (markDonePatch) — ein verschickter
-- Entwurf darf nicht als „liegt bereit" stehen bleiben.
--
-- `entwurf_at` ist nicht Kosmetik: liegt `last_message_at` danach, hat der Lead
-- inzwischen erneut geschrieben und die Oberfläche markiert den Entwurf als
-- veraltet, statt eine Antwort auf eine überholte Nachricht anzubieten.

alter table linkedin_threads
  add column if not exists entwurf text,
  add column if not exists entwurf_at timestamptz,
  add column if not exists entwurf_run_id text;

comment on column linkedin_threads.entwurf is
  'Versandfertiger Antwort-Entwurf des Agenten linkedin-antwort-entwuerfe. NULL = keiner offen.';
