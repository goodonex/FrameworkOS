-- 0078 — Die Kette hört nach dem dritten Follow-up nicht mehr auf.
--
-- Anlass: Kevins Diktat vom 25.08.2026. Der Hauptweg endete bisher im Nichts:
-- nach drei LinkedIn-Follow-ups (3/7/14 Tage, `linkedinFollowups.ts`) steht der
-- Thread im Bucket `abschluss` und passiert nie wieder etwas. Wer angenommen
-- und danach nie geantwortet hat, war damit verloren — obwohl das die Leute
-- sind, die Kevin am günstigsten erreicht: der Kontakt steht schon.
--
-- Seine Kette dafür, wörtlich verdichtet:
--   „Erstnachricht, keine Antwort, dann eine kurze Nachricht ob's untergegangen
--    ist, dann die PDF ungefragt. Wer schon Loom oder PDF hatte und nicht
--    geantwortet hat, kriegt eine handgeschriebene Postkarte, und die kann man
--    dann nach einer gewissen Zeit anrufen. Wer mich auf LinkedIn angenommen
--    hat, den kann ich zusätzlich auf Instagram anfragen."
--
-- Der Kanalwechsel schlägt dabei die vierte LinkedIn-Nachricht: dieselbe
-- Person, ein anderer Ort, das wirkt wie Zufall statt wie Kampagne. Deshalb
-- steht Instagram VOR der PDF, nicht parallel zur Erstnachricht — zwei
-- gleichzeitige Kanäle lesen sich als bedürftig.
--
-- Diese Migration ist rein additiv: sie erweitert nur die erlaubten
-- Ereignis-Typen um die zwei Kanäle, die es noch nicht gab. Die Wartezeiten
-- selbst stehen bewusst NICHT in der Datenbank, sondern an einer Stelle im
-- Code (`app/src/cockpit/lib/leadStation.ts`) — sie sind Kevins Einstellung,
-- kein Schema.
--
-- Bestehende Zeilen sind nicht betroffen; der CHECK wird nur weiter, nie enger.

alter table lead_ereignisse
  drop constraint if exists lead_ereignisse_typ_check;

alter table lead_ereignisse
  add constraint lead_ereignisse_typ_check check (typ in (
    'anfrage', 'angenommen', 'erstnachricht', 'followup', 'antwort_erhalten',
    'loom_zugesagt', 'loom_gesendet',
    'inmail', 'email', 'postkarte', 'anruf',
    -- Neu (0078): die zwei Kanalwechsel im lauten Zweig.
    'instagram', 'pdf',
    'wiedervorlage_gesetzt', 'disqualifiziert', 'reaktiviert', 'notiz'
  ));

comment on column lead_ereignisse.typ is
  'Kanaele: erstnachricht/followup (LinkedIn) · instagram · pdf (Follow-up-Analyse ungefragt) · email/postkarte/anruf (stiller Zweig) · inmail (Nebenstrom, hakt nichts ab)';
