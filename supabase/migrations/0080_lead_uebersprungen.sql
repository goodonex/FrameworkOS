-- 0080 — Kevin darf einen Lead von Hand umhängen, ohne die Historie zu fälschen.
--
-- Blaupause: docs/wargames/pipeline-board.md, Zug 6.
--
-- Das Problem: Die Station eines Leads wird BERECHNET, nicht gespeichert
-- (`app/src/cockpit/lib/leadStation.ts`). Kevin kann sie also nicht setzen.
-- Der naheliegende Weg wäre, ein Kanal-Ereignis nachzutragen — ein `pdf`, und
-- schon steht der Lead eine Stufe weiter. Genau das darf nicht passieren: Die
-- Zeile behauptete dann, eine Analyse sei rausgegangen. In sechs Wochen liest
-- niemand mehr, dass das eine Handkorrektur war, und `funnelRaten` rechnete
-- eine Conversion aus einer Nachricht, die nie jemand bekommen hat.
--
-- Deshalb ein eigener Typ, der die Wahrheit sagt: `uebersprungen` behauptet
-- nichts über einen Kanal. Er sagt „Kevin hat entschieden, diese Stufe zu
-- überspringen" — und `details` hält fest, von wo nach wo und warum.
--
--   details: { "von": "email_faellig", "nach": "anruf_faellig", "grund": "…" }
--
-- Die Ereignis-Historie bleibt damit append-only und ehrlich (0076: „Eine
-- Korrektur ist ein neues Ereignis"), und `quelle: 'ui'` unterscheidet den
-- Eintrag ohnehin von allem, was `scripts/leads-sync.ts` ableitet.
--
-- Rein additiv wie 0078 und 0079: der CHECK wird nur weiter, nie enger.
-- Bestehende Zeilen sind nicht betroffen.
--
-- ACHTUNG, Reihenfolge: Diese Liste führt `loom_angesehen` aus 0079 mit. Läuft
-- 0079 NACH dieser Migration, nimmt sie `uebersprungen` wieder weg — die
-- Nummern sorgen dafür, dass das nicht passiert, aber wer hier von Hand
-- eingreift, muss es wissen.

alter table lead_ereignisse
  drop constraint if exists lead_ereignisse_typ_check;

alter table lead_ereignisse
  add constraint lead_ereignisse_typ_check check (typ in (
    'anfrage', 'angenommen', 'erstnachricht', 'followup', 'antwort_erhalten',
    'loom_zugesagt', 'loom_gesendet', 'loom_angesehen',
    'inmail', 'email', 'postkarte', 'anruf',
    'instagram', 'pdf',
    -- Neu (0080): die Handkorrektur, die sich als solche zu erkennen gibt.
    'uebersprungen',
    'wiedervorlage_gesetzt', 'disqualifiziert', 'reaktiviert', 'notiz'
  ));

comment on column lead_ereignisse.typ is
  'Kanaele: erstnachricht/followup (LinkedIn) · instagram · pdf (Follow-up-Analyse ungefragt) · email/postkarte/anruf (stiller Zweig) · inmail (Nebenstrom, hakt nichts ab) · loom_zugesagt/loom_gesendet/loom_angesehen (Analyse-Funnel) · uebersprungen (Handkorrektur, KEIN Kanal - details traegt von/nach/grund)';
