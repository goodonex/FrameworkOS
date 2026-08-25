-- 0077: Zwischenstufe „Zuständigkeit ungeklärt" im Loom-Status.
--
-- Anlass (24.08.2026, Fall Ludwig Cords): Ein Lead sagt Ja zur Analyse, ist
-- aber Angestellter in einem Haus mit rund zehn geschäftsführenden
-- Gesellschaftern. Wer ihm die fertige Analyse schickt, verschenkt sie an
-- jemanden, der sie nicht umsetzen, aber intern weiterreichen kann. Kevins
-- Regel: erst klären, wer über die Website entscheidet, dann bauen.
--
-- Der Stern bleibt unverändert „hat zugesagt". Neu ist der Zustand DAZWISCHEN:
-- zugesagt, aber noch nicht freigegeben zum Bauen. Alle bestehenden Filter
-- fragen auf loom_status = 'offen' ab und schliessen diese Leads dadurch
-- automatisch aus der Bauliste aus, auch in Jophiel.

alter table linkedin_threads
  drop constraint if exists linkedin_threads_loom_status_check;

alter table linkedin_threads
  add constraint linkedin_threads_loom_status_check
    check (loom_status in ('offen', 'zustaendigkeit', 'aufgenommen', 'verschickt', 'entfaellt'));

comment on column linkedin_threads.loom_status is
  'offen = freigegeben zum Aufnehmen · zustaendigkeit = zugesagt, aber Entscheider noch ungeklaert · aufgenommen · verschickt · entfaellt';
