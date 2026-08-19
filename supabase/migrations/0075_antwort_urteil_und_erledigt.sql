-- 0075 — Zwei Lücken, die Kevin am 19.08.2026 an echten Daten gefunden hat.
--
-- (1) `linkedin_threads.agent_urteil` — Der ICP-Filter (icpRegeln.json) liest
--     nur die LinkedIn-Headline, und die lügt: „90 Tage: Leben, Business und
--     Energie im Einklang" ist ein Coach, „Schritt für Schritt ein
--     erfolgreiches Unternehmen aufbauen" ein Verkäufer — beide standen in
--     Kevins Antworten-Spur, beide bekamen Entwürfe. Wer da schreibt, steht
--     nur in der NACHRICHT, und die liest allein der Entwurfs-Agent. Er
--     hinterlegt sein Urteil hier; Anzeige und nächster Lauf verlassen sich
--     darauf, statt dieselbe Fehleinschätzung täglich zu wiederholen.
--
--     Werte: 'lead' (Zielgruppe) · 'kontakt' (kein Kunde, aber echtes
--     Anliegen) · 'akquise' (will Kevin etwas verkaufen — fliegt aus der
--     Spur). NULL = noch nicht beurteilt, zählt wie 'lead'.
--
-- (2) `sales_tagesportionen.erledigt_at` — Die Streak kannte nur einen Weg zu
--     grün („Zähler >= Soll"), die Oberfläche drei (der dritte: die Liste ist
--     leer). Am 18.08. standen 37 von 39 Erstnachrichten im Zähler, weil Kevin
--     zwei verworfen hat — Zeile grün, Streak gerissen. Rückwirkend lässt sich
--     „war die Liste leer?" nicht rekonstruieren, deshalb wird der Moment
--     festgehalten, in dem die Stufe steht.

alter table linkedin_threads
  add column if not exists agent_urteil text,
  add column if not exists agent_urteil_at timestamptz;

alter table linkedin_threads
  drop constraint if exists linkedin_threads_agent_urteil_bekannt;
alter table linkedin_threads
  add constraint linkedin_threads_agent_urteil_bekannt
  check (agent_urteil is null or agent_urteil in ('lead', 'kontakt', 'akquise'));

comment on column linkedin_threads.agent_urteil is
  'Urteil des Antwort-Entwürfe-Agenten aus dem Nachrichtentext: lead | kontakt | akquise. NULL = unbeurteilt.';

alter table sales_tagesportionen
  add column if not exists erledigt_at timestamptz;

comment on column sales_tagesportionen.erledigt_at is
  'Wann die Stufe an diesem Tag stand — auch dann, wenn der Zähler das Soll nie erreicht hat, weil die Liste leerlief. Die Streak liest diesen Vermerk.';
