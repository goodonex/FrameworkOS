-- 0079 — Der Player meldet, ob und wie lange ein Lead das Loom-Video gesehen hat.
--
-- Blaupause: jophiel/wargames/04-loom.md, Etappe 3 (Statistik in Uriel).
--
-- Fortschritt und Dauer gehören in details jsonb, keine neuen Spalten - das
-- Muster steht schon in 0076. Diese Migration ist rein additiv, wie 0078:
-- der CHECK wird nur weiter, nie enger. Bestehende Zeilen sind nicht betroffen.

alter table lead_ereignisse
  drop constraint if exists lead_ereignisse_typ_check;

alter table lead_ereignisse
  add constraint lead_ereignisse_typ_check check (typ in (
    'anfrage', 'angenommen', 'erstnachricht', 'followup', 'antwort_erhalten',
    'loom_zugesagt', 'loom_gesendet',
    -- Neu (0079): der Loom-Player meldet sich per sendBeacon selbst zurück.
    'loom_angesehen',
    'inmail', 'email', 'postkarte', 'anruf',
    'instagram', 'pdf',
    'wiedervorlage_gesetzt', 'disqualifiziert', 'reaktiviert', 'notiz'
  ));

comment on column lead_ereignisse.typ is
  'Kanaele: erstnachricht/followup (LinkedIn) · instagram · pdf (Follow-up-Analyse ungefragt) · email/postkarte/anruf (stiller Zweig) · inmail (Nebenstrom, hakt nichts ab) · loom_zugesagt/loom_gesendet/loom_angesehen (Analyse-Funnel)';
