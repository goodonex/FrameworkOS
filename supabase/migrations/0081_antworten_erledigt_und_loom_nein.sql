-- 0081 — Zwei Loecher, die beim Arbeiten auffallen (28.08.2026).
--
-- Blaupause: docs/wargames/sales-canvas-v2.md, Zuege 5 und 6.
-- Beide Teile sind rein additiv: eine Spalte mit Default, ein weiterer CHECK-
-- Wert. Bestehende Zeilen sind nicht betroffen, nichts wird enger.
--
--
-- TEIL 1 — `daily_metrics.antworten_erledigt`
--
-- Kevins Wunsch: „ich will eine Tagesliste, dass ich sehe: null von vierzig und
-- null von fuenf Antworten und null von elf Looms […] und am Ende des Tages
-- elf von elf."
--
-- Fuenf der sechs Stufen koennen das schon. Die Antworten-Stufe nicht, und zwar
-- aus einem handfesten Grund: Sie ist in `tagesFlow.ts` als `art: 'frische'`
-- gebaut (`feld: null`) und fragt „wartet jemand laenger als 24 Stunden?" statt
-- „wie viele habe ich heute erledigt?". Es gibt schlicht keine Spalte, die das
-- zaehlt — `arbeitsmodusTracking.metrikFeldFuer('antwort')` liefert bis heute
-- `null`, und der Kommentar dort verbietet ausdruecklich, ein Feld zu erfinden,
-- „wenn eine Spur auf keins passt". Jetzt passt eine, also gibt es sie.
--
-- WICHTIG, die Verwechslung, die hier lauert: `antworten_li` existiert bereits
-- und bedeutet das GEGENTEIL — wie viele Antworten Kevin BEKOMMEN hat (eine
-- Kanal-Kennzahl im Tracking, Trichter-Eingang). Diese Spalte zaehlt, wie viele
-- er ABGEARBEITET hat. Wer die beiden je zusammenlegt, macht aus dem
-- Trichter-Eingang eine Erledigungsquote.
--
-- Die Frische-Frage geht dabei nicht verloren: Wie lange der aelteste wartet,
-- steht weiter an der Zeile (`ANTWORT_FRISCHE_STUNDEN`) — nur nicht mehr als
-- Bedingung dafuer, ob die Stufe steht.

alter table daily_metrics
  add column if not exists antworten_erledigt integer not null default 0;

comment on column daily_metrics.antworten_erledigt is
  'Von Kevin ABGEARBEITETE Antworten an diesem Tag. Nicht zu verwechseln mit antworten_li - das sind die ERHALTENEN Antworten (Kanal-Kennzahl). Gebucht ueber arbeitsmodusTracking bei der Spur "antwort".';


-- TEIL 2 — Ereignis-Typ `loom_abgelehnt`
--
-- Kevins Beobachtung: „da gibt es die Ja/Nein-Frage irgendwie gar nicht. So:
-- Loom ja oder Loom nein."
--
-- Der Befund im Code gibt ihm recht, und zwar schaerfer als er es sagt:
--
--   * „Loom ja" kann Uriel gar nicht. `linkedin_threads.starred` wird von der
--     App NIE geschrieben (`useLinkedinThreads` hat kein starred-Update); der
--     Stern kommt ausschliesslich aus dem Voyager-Sync, und `leads-sync.ts`
--     leitet daraus `loom_zugesagt` ab. Kevins einziger Weg zur Zusage fuehrt
--     also ueber einen Wechsel nach LinkedIn.
--   * „Loom nein" gibt es ueberhaupt nicht. Eine Absage bleibt unter „Antwort
--     da" stehen, bis sie auf „Erledigt" gesetzt wird — und ist danach von
--     einer nie beantworteten Antwort nicht mehr zu unterscheiden.
--
-- Warum ein eigener Typ und nicht `uebersprungen` mit details: `uebersprungen`
-- sagt „Kevin hat eine Stufe uebersprungen" und traegt von/nach. Eine Absage
-- ist keine Stufen-Korrektur, sondern eine Tatsache ueber den Lead — sie muss
-- in `funnelRaten` als solche zaehlbar bleiben (Zusagen je Antwort ist die
-- Quote, an der die ganze Loom-Anbahnung haengt). Ein Typ, der luegt, waere
-- genau der Fehler, den 0080 vermeiden wollte.
--
-- Die Reihenfolge in `leadStation` entscheidet, nicht die Quelle: Es gewinnt
-- das JUENGSTE Ereignis. Der Sync stempelt `loom_zugesagt` mit
-- `thread.last_message_at` — das ist aelter als eine Absage von eben, also
-- ueberschreibt der naechste Sync Kevins Nein nicht. `verify-lead-station.ts`
-- erzwingt das als Fixture, damit es Logik bleibt und nicht Hoffnung.
--
-- ACHTUNG, Reihenfolge: Diese Liste fuehrt `uebersprungen` aus 0080 mit. Laeuft
-- 0080 NACH dieser Migration, nimmt sie `loom_abgelehnt` wieder weg — die
-- Nummern sorgen dafuer, dass das nicht passiert, aber wer hier von Hand
-- eingreift, muss es wissen.

alter table lead_ereignisse
  drop constraint if exists lead_ereignisse_typ_check;

alter table lead_ereignisse
  add constraint lead_ereignisse_typ_check check (typ in (
    'anfrage', 'angenommen', 'erstnachricht', 'followup', 'antwort_erhalten',
    -- Neu (0081): die Absage als eigene Tatsache, nicht als stilles Nichts.
    'loom_zugesagt', 'loom_abgelehnt', 'loom_gesendet', 'loom_angesehen',
    'inmail', 'email', 'postkarte', 'anruf',
    'instagram', 'pdf',
    'uebersprungen',
    'wiedervorlage_gesetzt', 'disqualifiziert', 'reaktiviert', 'notiz'
  ));

comment on column lead_ereignisse.typ is
  'Kanaele: erstnachricht/followup (LinkedIn) · instagram · pdf (Follow-up-Analyse ungefragt) · email/postkarte/anruf (stiller Zweig) · inmail (Nebenstrom, hakt nichts ab) · loom_zugesagt/loom_abgelehnt/loom_gesendet/loom_angesehen (Analyse-Funnel; abgelehnt = Lead will keine Analyse) · uebersprungen (Handkorrektur, KEIN Kanal - details traegt von/nach/grund)';
