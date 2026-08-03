-- 0064: Gesprächsverlauf auf linkedin_threads (Etappe 3, Schritt 1 aus
-- docs/IDEEN-2026-07-30-nutzbarkeit.md — „der Funnel-Hebel").
--
-- Bisher hielt die Zeile nur `preview` = die letzte Nachricht. Der Sync hatte
-- die übrigen Nachrichten derselben Konversation ohnehin schon im Zugriff
-- (Voyager-included-Array) und hat sie weggeworfen. Ohne Verlauf schreibt der
-- Antwort-Entwürfe-Agent auf einen einzelnen Satz hin — das ist der Grund,
-- warum die Entwürfe generisch würden.
--
-- Form: Array, älteste zuerst, maximal 10 Einträge, je Eintrag
--   { "sender": "me" | "them" | "unknown", "text": "…", "ts": "<ISO>" | null }
-- Geschrieben ausschließlich vom Runner (runner/linkedin/upsert.mjs,
-- service_role). Leerer Sync-Verlauf überschreibt eine vorhandene Historie nie.
--
-- Kein GIN-Index: es wird nie IN den Verlauf gesucht, immer nur die ganze
-- Zeile über (brand_id, thread_key) gelesen.

alter table linkedin_threads
  add column if not exists verlauf jsonb not null default '[]'::jsonb;

comment on column linkedin_threads.verlauf is
  'Letzte ~10 Nachrichten des Threads, älteste zuerst: [{sender,text,ts}]. Quelle: runner/linkedin/verlauf.mjs.';
