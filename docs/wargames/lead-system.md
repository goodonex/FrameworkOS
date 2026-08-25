# Wargame — Lead-System: jeder LinkedIn-Kontakt wird ein Lead mit Geschichte

**Erstellt:** 2026-08-20 · **Planer:** Fable 5 · **Überarbeitet nach Kevins Korrekturen:** Opus 5
**Executor:** Opus 5 auf `xhigh` (blind ausführbar) · **Branch:** `cockpit-rebuild`
**Repo:** `~/Kevin OS/02 Projekte/uriel` · **Status:** ✅ **UMGESETZT am 20.08.2026** (Z0–Z7). Ergebnisse und Abweichungen
stehen unten unter „Was tatsächlich passiert ist".

---

## Mission Brief

Kevins Diktat (19./20.08., verdichtet):

> „Workflow, wann geht was raus — eine Datenbank, wo jeder LinkedIn-Kontakt ein
> eigener Lead ist und Zeitstempel bekommt. Dadurch Historie: wie oft habe ich
> den geschrieben. Wenn ich zwanzig Follow-ups rausgeschickt habe, will ich sie
> abends nochmal aufmachen können — war die Ansprache richtig, wen markiere ich
> mir extra, wen rufe ich an. Leads wirklich als Leads behandeln, nicht als
> To-dos: Wiedervorlage setzen, Leads aussortieren, mit denen es keinen Sinn
> macht. Eine Datenbank, mit der ich einem Mitarbeiter sagen kann: hier, tausend
> Leute, die nicht angenommen haben — die fragst du an. Sehen, wie viele gerade
> in der Pipeline sind."

**Korrektur vom 20.08. (Kevin, nach der ersten Fassung):** Der stille Zweig lief
falsch. InMail ist **keine Station** in der Kette — Kevin fragt dauerhaft mehr
Leute an, als er InMail-Credits hat (30 Anfragen, ~3 Annahmen; 150 Credits
gesamt). Eine Kette, in der jeder Nie-Annehmer auf eine InMail wartet, staut
sich sofort. Richtig ist:

> „Diese E-Mail läuft einfach so nebenbei. Für die Leute, die nicht angenommen
> haben, nach dreißig Tagen eine E-Mail, dann eine Woche später eine
> handgeschriebene Postkarte, um dann eine Woche später anzurufen. Die InMails
> mach ich einfach konstant nebenbei."

### Diagnose — warum das heute nicht geht

Uriel kennt dieselbe Person bis zu **dreimal, ohne es zu wissen**:

| Tabelle | Weiß | Schlüssel | Weiß NICHT |
|---|---|---|---|
| `linkedin_netzwerk` (0070) | eingeladen/angenommen + wann | `profil_key` | ob je eine Nachricht floss |
| `linkedin_threads` (0058) | Postfach-Verlauf, Follow-up-Stufe, Loom | `thread_key` | ob/wann die Einladung lief |
| `linkedin_erstnachrichten` (0060) | Entwurf, gesendet/offen | `name` (!) | alles andere |

Verheiratet wird zur Laufzeit **über den Namen** (`funnelStufen.ts`,
`erstnachrichtenOffen.ts`) — mit dokumentierter Unsicherheits-Markierung, weil
es eben nicht sicher geht. Folgen, alle real gemessen:

- **20.08. live nachgerechnet** (Prod, mit Blättern): `linkedin_erstnachrichten`
  hat 118 Zeilen — 80 `offen`, 38 `gesendet`. Von den 80 haben **78 einen
  Thread im Postfach**, 11 davon haben geantwortet. Kevins Urteil: *„die gibt's
  gar nicht mehr, die hab ich alle rausgeschickt."* Er hat recht — die
  Nachrichten sind raus, nur der **Haken** fehlt. Der Status ist Handarbeit in
  einer Tabelle, während die Wahrheit im Postfach steht.
- **18.08. (BACKLOG):** 39 Threads standen nie in der Tabelle; „Erstnachricht
  offen", obwohl der Chat seit Monaten lief.
- Es gibt **kein Ereignis-Protokoll** — „wie oft habe ich den geschrieben" ist
  nur aus den letzten ~10 Nachrichten eines Threads (0064) rekonstruierbar.
- `snoozed_until` existiert **nur am Thread**. Wer keinen Thread hat (nie
  angenommen), kann keine Wiedervorlage bekommen.
- **Kein Tagesjournal:** ein Haken in der Arbeitsliste ist weg, sobald er
  gesetzt ist. Die Stempel existieren, aber keine Ansicht liest sie als „was
  ging heute raus".

**Daraus folgt eine Regel für diese Runde:** Ein Status, den die Realität schon
beweist, wird **abgeleitet, nicht gehakt**. Existiert ein Thread, ist die
Erstnachricht raus — der Handhaken entfällt (Zug Z3b).

### Was NICHT gebaut wird

- **Kein Parallel-CRM.** `contacts` bleibt Kunden/Deals (O2-Entscheidung
  06.08.), die Spiegel-Tabellen bleiben Spiegel, `linkedinFollowups.bucketOf`
  bleibt die einzige Fälligkeits-Wahrheit für Threads. Das Lead-System legt
  eine **Identitäts- und Protokoll-Schicht darunter**, keine zweite Logik.
- **Kein Auto-Versand.** Der Sync liest weiterhin nur; senden tut Kevin.
- **Keine Kontaktdaten-Beschaffung.** E-Mail, Anschrift und Telefonnummer
  werden als Felder angelegt und bleiben leer. Beschaffung (Apollo o. ä.) ist
  eine eigene spätere Runde — Kevins Wort: *„das machen wir nicht jetzt."*
- **Kein Multi-User-Ausbau.** „Mitarbeiter" heißt hier: eine saubere,
  exportierbare Namensliste je Station — keine Accounts, keine Rollen.

---

## Der Workflow

### Hauptweg (angenommen)

Unverändert gegenüber heute, nur mit Protokoll darunter:

Anfrage → angenommen → Erstnachricht → Follow-ups **3/7/14 Tage**
(`linkedinFollowups.ts`, Bestand) → Antwort.

Nach der Antwort drei Abzweigungen: **Ja** → Loom-Spur → Call/Angebot →
`contacts`-Pipeline · **Nein** → eine charmante Rückfrage (Skill-Regel 19.08.);
bleibt es Nein → disqualifiziert **mit Grund** · **„melde dich in X"** →
Wiedervorlage mit Datum, sticht alles andere.

### Stiller Zweig (nie angenommen) — neu nach Kevins Korrektur

Zeit läuft ab `eingeladen_at`, **unabhängig** davon, ob eine InMail lief:

| Nach | Kanal | Braucht |
|---|---|---|
| 30 Tagen ohne Annahme | **E-Mail** | E-Mail-Adresse (spätere Runde) |
| +7 Tagen | **handgeschriebene Postkarte** | Firmenanschrift |
| +7 Tagen | **Anruf** | Telefonnummer |
| danach ohne Reaktion | **Ruhe 6 Monate**, dann automatisch wieder oben | — |

### InMail — Nebenstrom, keine Station

Der InMail-Pool ist **jeder Lead im stillen Zweig, unabhängig von seiner
Station**. Kevin arbeitet ihn nach Credits ab, wann er will; die Kette oben
läuft davon unbeeindruckt weiter. Eine InMail ist ein Ereignis wie jedes
andere — sie hakt nichts ab und hält nichts auf.

**Selbst entschieden (Z4), damit niemand Doppelbeschuss bekommt:** Zwischen zwei
ausgehenden Kontakten liegen mindestens **7 Tage**. Ging gestern eine InMail
raus, wartet die fällige E-Mail eine Woche. Verworfene Alternative: InMail setzt
die 30-Tage-Uhr zurück — das hätte den Pool sichtbar leergelaufen wirken lassen,
obwohl niemand ausscheidet.

Antwortet jemand auf eine InMail, entsteht ein Thread — der Lead springt damit
in den Hauptweg (Station „Antwort erhalten"). Das ist die einzige Brücke
zwischen den Zweigen und fällt beim Sync von selbst an.

---

## Architektur-Entscheidung: eigene `leads`-Tabelle als Rückgrat

**Entschieden (code-determinierbar), Begründung geloggt:**

Verworfen wurde, `linkedin_netzwerk` selbst zum Lead zu machen (Spalten
anbauen). Zwei Gründe:

1. **Spiegel-Tabellen gehören dem Runner.** `netzwerkUpsert.mjs` upsertet auf
   `(brand_id, profil_key)`. Kevins Handarbeit (Wiedervorlage, Notiz,
   Disqualifikation) in einer Tabelle, die ein Sync-Lauf überschreibt, ist
   exakt die Sorte stiller Datenverlust, die dieses Repo schon zweimal
   repariert hat (0071, O1).
2. **Nicht jeder Lead steht im Netzwerk-Spiegel.** Leute, die Kevin
   angeschrieben *haben*, Alt-Threads vor dem Sync-Fenster, die ~12 vom
   Scraper verfehlten (647/659) — sie haben einen Thread, aber keine
   Netzwerk-Zeile. Deren `status`-Check (`offen`/`angenommen`) passt nicht.

**Migration 0076** legt an:

```
leads
  id uuid pk
  brand_id → brands
  profil_key text          -- LinkedIns stabile ID, wo bekannt
  profile_url text
  name text not null
  headline text
  lead_status text check in ('aktiv','wiedervorlage','ruht','disqualifiziert','kunde')
  wiedervorlage_am date, wiedervorlage_grund text
  disqualifiziert_grund text
  markiert boolean         -- Kevins „den ruf ich an"-Fähnchen
  notiz text
  email text, telefon text, anschrift text   -- leer; Beschaffung spätere Runde
  first_seen_at, updated_at
  unique (brand_id, profil_key) where profil_key <> ''

lead_ereignisse            -- append-only, das Gedächtnis
  id, brand_id, lead_id → leads
  typ text check in ('anfrage','angenommen','erstnachricht','followup',
                     'antwort_erhalten','loom_zugesagt','loom_gesendet',
                     'inmail','email','postkarte','anruf',
                     'wiedervorlage_gesetzt','disqualifiziert','reaktiviert','notiz')
  at timestamptz not null
  quelle text              -- 'sync' | 'ui' | 'backfill'
  details jsonb            -- z. B. followup_stage, Textauszug
```

Dazu **Verweis-Spalten an den Spiegeln** (nullable, vom Verheirater gefüllt):
`linkedin_netzwerk.lead_id`, `linkedin_threads.lead_id`,
`linkedin_erstnachrichten.lead_id`. Die Spiegel bleiben sonst unangetastet; der
Runner-Upsert fasst `lead_id` nie an (in Z3 explizit verifizieren).

**Identitäts-Regel des Verheiraters** (Z2, reine Funktion + verify-Skript):
1. `profile_url`-Normalform gleich → sicher verbunden.
2. sonst Name exakt gleich **und** nur ein Kandidat → verbunden.
3. sonst: Lead ohne Verknüpfung anlegen, in der UI als „unsicher" markieren —
   die bestehende `FunnelPerson.unsicher`-Haltung, nur persistent. Kevins Klick
   in der Lead-Akte („das ist derselbe") verbindet von Hand.

---

## Gesetze dieser Runde

1. **Zeilennummern/Dateinamen sind Wegweiser vom 20.08., nicht Wahrheit** — vor
   jedem Edit frisch lesen. Z0 (RECON) zuerst.
2. **Nach jedem Zug:** `cd app && npx tsc -b && npm run build` grün, danach ALLE
   `scripts/verify-*.ts` grün (Stand 20.08.: ~45 Skripte). Ein Commit je Zug auf
   `cockpit-rebuild`, deutsche Message mit Typ-Prefix. **Nicht auf `main`
   pushen** — Livegang ist Kevins Wort.
3. **Migration 0076 ausschließlich über `supabase db push`**, nie SQL-Editor
   (L2). Will der Trockenlauf mehr als genau `0076` einspielen → STOPP.
4. **Ereignisse sind append-only.** Kein Update, kein Delete an
   `lead_ereignisse` — Korrekturen sind neue Ereignisse.
5. **Eine Fälligkeits-Wahrheit.** `bucketOf` bleibt unangetastet; die
   Lead-Stationen davor/danach leben in **einer** neuen reinen Funktion
   `leadStation.ts` — nirgendwo sonst, kein Duplikat in UI-Komponenten.
6. **REST immer blättern** (PostgREST-Deckel 1000; `linkedin_netzwerk` hat 1686).
7. **Backfill ist idempotent.** Zweimal laufen erzeugt keine doppelten
   Ereignisse (Konflikt-Schlüssel: `(lead_id, typ, at)`).

---

## Züge

**Z0 — RECON (lesen, nichts ändern).** Frisch lesen: `funnelStufen.ts`,
`erstnachrichtenOffen.ts`, `netzwerkUpsert.mjs` (Update-Set!), `sync.mjs`
(liefert der Thread-Upsert `profile_url` zuverlässig?), `upsert.mjs`.
Messen an Prod (mit Blättern): Wie viele der 239 Threads haben eine nicht-leere
`profile_url`? Wie hoch ist die URL-Match-Quote Threads↔Netzwerk gegenüber dem
Namens-Match? → Zahlen ins Protokoll; sie entscheiden, wie viel Handarbeit
Regel 3 des Verheiraters erzeugt.
*Erwartung:* URL-Quote > 80 %. *Wenn deutlich darunter:* Verheirater trotzdem
bauen, aber Kevins Handverbinde-UI (Z5) im selben Zug priorisieren.

**Z1 — Migration 0076** (`leads`, `lead_ereignisse`, drei `lead_id`-Spalten, RLS
wie Nachbartabellen, Indizes: `leads (brand_id, lead_status, wiedervorlage_am)`,
`lead_ereignisse (brand_id, at desc)`, `lead_ereignisse (lead_id, at)`). Typen
nach `types/db.ts`.
*Wahrscheinlichster Fehler:* Teil-Unique auf `profil_key` kollidiert mit
Alt-Duplikaten → vorher per Abfrage prüfen, Duplikate im Backfill mergen.

**Z2 — Verheirater + Backfill** (`runner/leads/backfill.mjs` + reine Funktion
`app/src/cockpit/lib/leadIdentitaet.ts` mit verify-Skript: URL-Treffer,
Namens-Treffer eindeutig, Namens-Kollision, Person nur im Postfach). Der
Backfill speist historische Ereignisse aus vorhandenen Stempeln:
`eingeladen_at`→`anfrage`, `angenommen_at`→`angenommen`, `sent_at`→
`erstnachricht`, Thread-`verlauf` (0064)→`followup`/`antwort_erhalten`,
`loom_erledigt_at`→`loom_gesendet`. Quelle `backfill`.
*Erwartung nach Lauf:* Leads ≈ 1686 Netzwerk-Zeilen + Nur-Postfach-Personen;
die 78-offen-Anomalie ist per Abfrage erklärbar (Lead hat `erstnachricht`-
Ereignis UND Thread). *Abbruch:* Match-Regeln erzeugen > 5 %
Mehrfach-Verknüpfungen → STOPP, Regeln nachschärfen statt Daten fluten.

**Z3 — Ereignis-Schreiber im Laufenden.**
(a) Runner: `netzwerkUpsert` schreibt `anfrage`/`angenommen` beim
Status-Übergang; `upsert.mjs` schreibt `antwort_erhalten`, wenn `last_from` auf
`them` dreht. Verifizieren, dass beide `lead_id` an den Spiegeln **nicht**
überschreiben.
(b) **Der Haken entfällt.** `linkedin_erstnachrichten.status` wird abgeleitet:
existiert für den Lead ein `erstnachricht`- oder `antwort_erhalten`-Ereignis
(oder schlicht ein Thread), gilt sie als raus. Die 78 lösen sich damit auf,
ohne dass Kevin 78-mal klickt. Der Handhaken bleibt als Übersteuerung für den
Fall „vorbereitet, aber bewusst nie gesendet" (→ `uebersprungen`).
(c) App: Follow-up erledigt, Loom erledigt, InMail gebucht, E-Mail/Postkarte/
Anruf erledigt → je ein Ereignis, Quelle `ui`.
*Wahrscheinlichster Fehler:* Doppel-Ereignis, weil Sync UND UI denselben Vorgang
sehen → Schreiber prüft „jüngstes gleiches Ereignis < 24 h" und schweigt dann.

**Z4 — `leadStation.ts`:** reine Funktion (Lead + Ereignisse + Thread-Bucket) →
`{ station, naechsterSchritt, faelligAm }` gemäß Workflow oben. Konstanten an
EINER Stelle: `STILL_EMAIL_TAGE = 30`, `STILL_POSTKARTE_TAGE = 7`,
`STILL_ANRUF_TAGE = 7`, `RUHE_MONATE = 6`, `MIN_ABSTAND_TAGE = 7`.
Wiedervorlage sticht alles; disqualifiziert und Kunde sind Endstationen; InMail
ist ein Nebenstrom-Flag, keine Station. verify-Skript mit Fixtures je Kante,
inklusive Doppelbeschuss-Fall (InMail gestern, E-Mail heute fällig → verschoben).

**Z5 — Lead-Akte (UI).** Klick auf einen Namen — überall, wo Namen stehen
(Funnel-Listen, Arbeitslisten, Wochenkontrolle) — öffnet ein Fenster (UI-Gesetze:
Kachel→Fenster, kein Tab): Zeitstrahl der Ereignisse, Station, Knöpfe
*Wiedervorlage* (Datum + Grund), *Disqualifizieren* (Grund), *Markieren*,
*Notiz*, bei „unsicher" das Handverbinden.

**Z6 — Tagesjournal (UI).** Neue Ansicht „Heute raus": alle Ereignisse des Tages
(Typen erstnachricht/followup/inmail/email/postkarte/anruf/loom_gesendet),
gruppiert nach Typ, je Zeile Name + Textauszug + Sprung in die Lead-Akte.
Datums-Blättern für den Abend-Rückblick. Erfüllt Kevins „abends die zwanzig
nochmal durchgehen und einen extra markieren".

**Z7 — Pipeline-Sicht + Delegations-Export.** Die Funnel-Stufen-Ansicht wird auf
`leadStation` gehoben: Kopfzahl je Station, Namensliste ein Klick, Wiedervorlagen
des Tages oben, InMail-Pool als eigene Kachel mit Credit-Stand
(`inmailStand.ts`, Bestand). Export einer Station als CSV (Name, URL, Kontext) —
die „hier, tausend Leute"-Liste für einen Mitarbeiter.

---

## Beantwortete Vorschläge (Kevin, 20.08.)

- **V1 — Kadenz:** stiller Zweig 30 Tage → E-Mail, +7 → Postkarte, +7 → Anruf,
  danach Ruhe 6 Monate. InMail als Nebenstrom statt Station. Follow-ups bleiben
  3/7/14. ✅
- **V2 — Kontaktdaten:** Stationen jetzt bauen, Kandidaten sammeln, Felder leer
  lassen. Beschaffung später über Apollo o. ä. — eigene Runde. ✅
- **V3 — Altbestand:** errechnete Station, keine Pauschal-Ruhe. Die
  Nie-Annehmer werden damit **E-Mail-Kandidaten** (nicht InMail-Kandidaten) —
  genau Kevins Punkt, dass ein voller InMail-Stapel demotiviert, den er nie
  abarbeiten kann. ✅


---

## Was tatsächlich passiert ist (20.08.2026)

**Z0 · RECON — die Erwartung war falsch, und das hat den Entwurf gerettet.**
Die Blaupause rechnete mit einer URL-Match-Quote über 80 %. Gemessen: **0 %**.
LinkedIn gibt zwei Sorten IDs aus, die sich nicht überschneiden — die
Einladungsliste lesbare Slugs (`anton-bachhaeubl-45a96920b`), das Postfach
opake IDs (`ACoAACAUWC4B…`). Ein „erst URL, dann Name"-Verheirater wäre in der
Praxis immer beim Namen gelandet, nur mit dem falschen Gefühl von Sicherheit.
Der Name trägt: 230 von 239 Threads eindeutig, 2 mehrdeutig, 7 ohne Treffer.
Daraus die Konsequenz im Entwurf: **`li_urn` ist kein Suchschlüssel, sondern
ein Gedächtnis** — einmal zugeordnet, festgeschrieben, danach unabhängig vom
Namen.

**Z1 · Migration 0076** eingespielt über `db push`, genau eine Migration, wie
das Gesetz es verlangt. Historie 0001–0076 lückenlos.

**Z2 · Backfill.** 1693 Leads (1686 aus dem Netzwerk, 7 nur aus dem Postfach),
2036 verheiratete Spiegel-Zeilen, 230 festgeschriebene opake IDs, 1996
Ereignisse. **4 mehrdeutige Fälle** (0,2 %) bleiben bewusst unverbunden — weit
unter der Abbruchgrenze von 5 %. Kein einziger Lead hat mehr als einen Thread,
es wurde also nichts fälschlich verschmolzen.

**Zwei Fehler, die erst der zweite Lauf gezeigt hat** — beide behoben:
`PGRST102` (PostgREST verlangt bei Sammel-Inserts identische Schlüssel in allen
Objekten) und `23505` (ohne `on_conflict`-Ziel läuft `ignore-duplicates` ins
Leere, der zweite Lauf stirbt statt still nichts zu tun). Die Idempotenz ist
danach belegt: dritter Lauf legt 0 an, verheiratet 0, Ereignisse bleiben gleich.

**Z3 · Abweichung vom Plan, begründet.** Statt Ereignis-Schreiber in
`netzwerkUpsert.mjs` und `upsert.mjs` einzubauen (zwei Schreibwege, Gefahr von
Doppel-Ereignissen), läuft `scripts/leads-sync.ts` **alle 30 Minuten im
Runner**, vor dem Widerspruchs-Wächter. Ein Mechanismus, eine Wahrheit. `tsx`
ist dafür als devDependency ins Repo gekommen, damit der Kindprozess nicht am
npx-Cache hängt.

**Z3b · Kevins 78er-Ärgernis, aufgelöst.** Von 80 als „offen" geführten
Erstnachrichten waren 76 durch einen Thread beweisbar verschickt. Statt einer
dritten Leseregel wird die **Tabelle selbst wahr**: Runde 5 der Pflegeroutine
verbucht sie. Der Widerspruchs-Wächter meldet seitdem **2 statt 78**. Die
Ausnahme für InMail-Fälle (Einladung noch offen → die vorbereitete Nachricht
ist ungenutzt, nicht verschickt) bleibt bestehen.

**Z4 · Ein Denkfehler, den der Test gefunden hat.** Station und Fälligkeit
mussten getrennt werden: Ein Lead, dessen E-Mail durch den 7-Tage-
Mindestabstand verschoben wird, fiel sonst auf „Anfrage läuft" zurück — als
hoffte er noch auf eine Annahme, obwohl er die 30 Tage längst hinter sich hat.
28 Prüffälle, alle grün.

**Z5–Z7 · Oberfläche** wie geplant: Lead-Akte als Fenster (Vollbild nur mobil),
Tagesjournal mit Datums-Blättern, Pipeline mit CSV-Export je Station.

### Offene Punkte, die diese Runde nicht lösen konnte

1. **Die Vergangenheit ist dünn — „wie oft habe ich den geschrieben" beginnt
   heute.** `sync.mjs` fordert bis zu 10 Nachrichten je Thread an
   (`VERLAUF_MAX = 10`), aber Voyagers Konversationsliste liefert je Thread nur
   die **letzte**: an Prod gemessen haben alle 237 Threads mit Verlauf genau
   einen Eintrag. Historische Follow-ups sind damit nicht rekonstruierbar; ab
   jetzt wird jedes Ereignis mitgeschrieben. Wer das nachholen will, braucht
   einen Tiefenscan mit einer eigenen Nachrichten-Query je Thread — eine eigene
   Runde, ~239 Abfragen.
2. **Die Kanaldaten fehlen** (E-Mail, Anschrift, Telefon). Felder sind da und
   bleiben leer; Beschaffung über Apollo o. ä. ist Kevins ausdrücklich spätere
   Runde. Der stille Zweig sammelt bis dahin Kandidaten, die er nicht bedienen
   kann — das ist gewollt und sichtbar, nicht kaputt.
3. **4 mehrdeutige Namen** warten auf Kevins Handverbindung. Die Lead-Akte
   zeigt sie; die UI zum Verbinden zweier Leads ist noch nicht gebaut.
4. **`verify-postfach-tiefenscan` ist rot** — nicht durch diese Runde. Parallel
   hat jemand `runner/index.mjs` umgebaut (Zeitmarken auf Platte gegen
   Runner-Neustarts, datiert 20.08.); das Prüfskript sucht noch den alten
   Code-Pfad `if (tief) letzterTiefenscan = Date.now()`. Die Datei wurde
   deshalb in dieser Runde nicht committet.


---

## Sichtprüfung im Browser (20.08., nach Kevins Login)

Fünf Befunde, alle am laufenden Cockpit gesehen statt abgeleitet — und alle
behoben:

1. **Die „dran"-Badges waren unlesbar.** `--ck-accent-text` auf `--ck-accent`
   sind zwei fast identische Grüntöne (~1,1:1, im Browser gemessen). `Badge.tsx`
   hatte dieselbe Lehre schon notiert; jetzt gilt sie auch hier.
2. **„Erstnachricht fällig: 440"** — darunter 71 Recruiter, Consultants und
   Coaches. Die Pipeline wendet jetzt `icp.ts` an wie der Rest des Cockpits:
   **369** statt 440, die anderen zugeklappt unter „Nicht in der Zielgruppe".
3. **„Antwort da"** enthielt Post von vor der Makler-Akquise, ganz oben ein
   Recruiter vom Januar 2025, der Kevin anwarb. `AKQUISE_START` importiert
   statt nachgebaut: **11** statt 20.
4. **Norbert Reichentrog stand als frischer Lead da**, obwohl er Kunde ist —
   exakt der Befund vom 18.08. Runde 6 schreibt `lead_status: 'kunde'` jetzt am
   Lead fest, statt ihn nur beim Anzeigen wegzufiltern.
5. **Das Tagesjournal zeigte 76 Erstnachrichten „heute 14:36"** — ein
   Arbeitstag, den es nie gab. Der Backfill hatte `new Date()` als Versanddatum
   gesetzt. Jetzt gilt das Thread-Datum; ohne belastbares Datum wird
   übersprungen statt falsch gestempelt. Die 76 Altfälle sind repariert.

Dazu zwei Kleinigkeiten: `useLeads` blättert nach `id` statt nach `name` (bei 14
doppelten Namen kann eine nicht-eindeutige Sortierung über die Seitengrenze eine
Zeile doppelt und eine gar nicht liefern), und die Akte zeigt den nächsten
Schritt nicht mehr, wenn er wortgleich neben der Station steht.

**Die Lehre für die nächste Runde:** Jede Liste in diesem Cockpit braucht
dieselbe Filter-Kaskade — ICP, Akquise-Beginn, Kundenabgleich. Wer eine neue
Ansicht baut und sie vergisst, baut zuverlässig wieder einen Berg aus Rauschen.

---

## Nachtrag 25.08.2026 — die laute Kette (Migration 0078)

Die Runde vom 20.08. hat den **stillen** Zweig gebaut (nie angenommen: E-Mail →
Postkarte → Anruf) und den Hauptweg bei den Follow-ups belassen. Was dabei
niemandem auffiel: Der Hauptweg hat **kein Ende**. Nach der dritten
Follow-up-Stufe liefert `bucketOf` den Bucket `abschluss`, und `leadStation`
schob ihn in `wartet_auf_antwort` mit `faellig: false`. Ein Lead, der die
Anfrage angenommen und danach nie geantwortet hat, verschwand damit lautlos.

Das ist die falsche Menge zum Verlieren. Diese Leute haben schon Ja zum Kontakt
gesagt — ihre Ausbeute je Handgriff ist die höchste im ganzen Bestand, höher
als bei jedem Nie-Annehmer im stillen Zweig.

Kevins Kette dafür (Diktat 25.08., verdichtet):

| Nach | Kanal | Warum an dieser Stelle |
|---|---|---|
| +7 Tagen | **Instagram-DM** | Kanalwechsel schlägt die vierte LinkedIn-Nachricht. Derselbe Mensch an einem anderen Ort liest sich als Zufall, vier Anläufe im selben Postfach als Kampagne. **Nicht** parallel zur Erstnachricht — zwei gleichzeitige Kanäle wirken bedürftig. |
| +14 Tagen | **Analyse-PDF, ungefragt** | Material statt Nachfrage. Wer dreimal nicht geantwortet hat, reagiert eher auf etwas Fertiges als auf eine weitere Frage. |
| +21 Tagen | **handgeschriebene Postkarte** | Der teuerste Schritt, deshalb der späteste. Kevins Deckel: 5 pro Woche, nur die besten Leads. |
| +7 Tagen | **Anruf** | Die Karte ist der Aufhänger („ich hab Ihnen letzte Woche geschrieben"). Ohne sie wäre es ein Kaltanruf — deshalb steht sie davor, nicht danach. |
| danach | **Ruhe 4 Monate**, dann mit neuem Aufhänger | Von 6 auf 4 gesenkt: Mit sieben Berührungen über vier Kanäle ist der Lead eindeutig durch. |

### Zwei Entscheidungen, die im Code stehen

**Die Kette wird rückwärts gelesen.** `lauteKette` fragt zuerst nach dem
spätesten Ereignis (Anruf, dann Postkarte, dann PDF, dann Instagram) und leitet
daraus den nächsten Schritt ab. Eine übersprungene Stufe hält damit nichts an:
Hat Kevin die Postkarte geschrieben, ohne dass je eine PDF rausging, steht als
Nächstes der Anruf — nicht die nachgeholte PDF. Die Kadenz ist ein Vorschlag
mit Gedächtnis, kein Formular, das ausgefüllt werden muss.

**`zweig: 'still' | 'laut'` am Ergebnis.** Postkarte und Anruf sind jetzt
Stationen mit zwei Zuflüssen, und der Unterschied ist kein Detail: Wer nie
angenommen hat, kennt Kevin überhaupt nicht. Wer angenommen und nie geantwortet
hat, hat Erstnachricht, drei Follow-ups, eine Instagram-Nachricht und eine
fertige Analyse von ihm gesehen. Dieselbe Postkarte an beide zu schreiben, wäre
in einem der zwei Fälle falsch. Verworfen wurde, dafür vier getrennte Stationen
anzulegen — das hätte die Pipeline aufgebläht, ohne mehr zu sagen als ein Feld.

### Was diese Runde bewusst offen lässt

- **Keine eigene Tages-Flow-Stufe.** Sie hätte ein neues `daily_metrics`-Feld
  gebraucht; die Regel dagegen steht im HANDOFF. Inhaltlich ist die Kette ein
  Follow-up, und `FOLLOWUP_PORTION_TAG = 20` ist exakt die Zahl, die Kevin am
  25.08. unabhängig noch einmal genannt hat („so zwanzig am Tag").
- **Der Anfangsbestand ist ungemessen.** Wie viele Threads heute auf
  `followup_stage >= 3` stehen, entscheidet, ob die Kette in `followupPosten`
  einlaufen muss oder in der Pipeline richtig aufgehoben ist. Erst messen.
- **Instagram-Handles fehlen** — dieselbe Lücke wie E-Mail, Anschrift und
  Telefon. Die Station zeigt den fälligen Schritt, die Beschaffung ist eine
  eigene Runde.
