# Wargame — Lead-System: jeder LinkedIn-Kontakt wird ein Lead mit Geschichte

**Erstellt:** 2026-08-20 · **Planer:** Fable 5 · **Überarbeitet nach Kevins Korrekturen:** Opus 5
**Executor:** Opus 5 auf `xhigh` (blind ausführbar) · **Branch:** `cockpit-rebuild`
**Repo:** `~/Kevin OS/02 Projekte/uriel` · **Status:** FREIGEGEBEN in der Sache (V1–V3 beantwortet), Umsetzung auf Kevins Startwort.

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
