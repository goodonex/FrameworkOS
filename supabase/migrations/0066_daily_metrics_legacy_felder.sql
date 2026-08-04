-- 0066: die vier herkunftslosen Sammelspalten aus daily_metrics entfernen
-- (Etappe 4, Schritt 2c aus docs/IDEEN-2026-07-30-nutzbarkeit.md).
--
-- Seit 0053/0055 wird je Kanal gezählt: li_followups/ig_followups/call_followups
-- statt `followups`, termine_li/termine_ig/termine_call statt `termine_vereinbart`.
-- Cold-Mail ist als Kanal ganz aus dem Tracking gefallen (coldmails,
-- antworten_cold). Seither schreibt der Upsert in diese vier Spalten nur noch
-- Nullen, und kein einziger Leser im Code fasst sie an — geprüft per Grep über
-- app/ (die verbliebenen Treffer auf „followups" sind Datei- und Kachel-Namen).
--
-- Der Code hat die Felder bereits verlassen (useDailyMetrics.ts: Typ,
-- METRIC_FIELDS, emptyRow). Diese Migration räumt hinterher; sie ist deshalb
-- NICHT eilig und darf auch später laufen — bis dahin füllen die
-- `not null default 0`-Defaults die Spalten stillschweigend weiter.
--
-- ACHTUNG, nicht umkehrbar: die historischen Werte dieser vier Spalten sind
-- danach weg. Sie sind durchgehend 0 bzw. stammen aus der Zeit vor 0055 —
-- wer die alten Sammelzahlen noch braucht, sichert vorher:
--   select datum, coldmails, followups, antworten_cold, termine_vereinbart
--     from daily_metrics where coldmails + followups + antworten_cold + termine_vereinbart > 0;

alter table daily_metrics
  drop column if exists coldmails,
  drop column if exists followups,
  drop column if exists antworten_cold,
  drop column if exists termine_vereinbart;
