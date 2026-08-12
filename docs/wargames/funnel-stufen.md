# Wargame — Funnel-Stufen: der LinkedIn-Trichter wird ablesbar

**Erstellt:** 2026-08-12 · **Planer:** Fable 5 · **Executor:** Opus 5 auf `xhigh` (blind ausführbar)
**Branch:** `cockpit-rebuild` · **Repo:** `~/Kevin OS/02 Projekte/uriel`

---

## Mission Brief

Kevin trackt seit dem 11.08. seine Tages-Stufen (Tages-Flow, Runde vom 11.08.).
Was fehlt, sind die **Namenslisten hinter den Stufen** — wer genau steckt wo im
Trichter. Kevins Diktat (12.08.):

> „…dass herausgefunden wird, wie viele Vernetzungsanfragen meines ICPs sind
> noch offen (haben noch keine Erstnachricht), dann wer wartet auf eine Antwort,
> auf ein Loom, oder wer nahm an und antwortete nicht auf die Erstnachricht,
> oder auch wer hat die Vernetzungsanfrage nie angenommen und wem kann ich dann
> eine InMail schicken."

Dazu: die **Wochenziele in den Vitals stimmen nicht** (75 Anfragen — real sind
~180; 75 Nachrichten, 25 Looms — beides falsch).

Die fünf Zielzustände, jeweils als Zahl + Namensliste:

| # | Liste | Quelle | Stand heute |
|---|---|---|---|
| 1 | **Angenommen, noch keine Erstnachricht** | Kontakte-Sync ⋈ Threads ⋈ Erstnachrichten | fehlt (Datenlücke) |
| 2 | **Erstnachricht raus, keine Antwort** | Threads: `last_from='me'`, `followup_stage=0` | ableitbar |
| 3 | **Wartet auf Antwort (nachgefasst)** | Threads-Buckets `wartet`/`faellig`, Stufe ≥ 1 | existiert (Buckets) |
| 4 | **Wartet auf Loom** | Threads: `starred && loom_status='offen'` (`loomPosten`) | existiert |
| 5 | **Nie angenommen → InMail-Kandidaten** | Einladungs-Sync, Status `offen` | fehlt (Datenlücke) |

Die Datenlücke ist dokumentiert (`urielTools.ts`, Werkzeug-Beschreibung: „wer
eine OFFENE Vernetzungsanfrage angenommen hat, steht hier gar nicht — das
spiegelt der Sync nicht") und im Vault einmal von Hand erhoben worden:
`~/Second Brain/03 Bereiche/Vertrieb & Outreach/LinkedIn-Funnel Baseline (Juli 2026).md`
— Stand 27.07.: **880 offene Einladungen, 77 angeschrieben ohne Antwort, 7 Loom
zugesagt/nie geschickt**. Diese Runde macht aus der Einmal-Erhebung eine
laufende.

Einstieg in dieser Reihenfolge: (1) `HANDOFF.md`, (2) `docs/BACKLOG.md` (Runden
vom 11./12.08.), (3) `docs/wargames/linkedin-followups.md` (der bestehende
Postfach-Sync — dieselbe Mechanik wird erweitert), (4) diese Blaupause komplett.

---

## Gesetze dieser Runde

1. **Zeilennummern/Dateinamen hier sind Wegweiser vom 12.08., nicht Wahrheit.**
   Vor jedem Edit frisch lesen. Zug F0 (RECON) zuerst.
2. **Nach jedem Zug:** `cd app && npx tsc -b && npm run build` grün, danach
   ALLE `scripts/verify-*.ts` grün (Stand 12.08.: 31 Skripte). Ein Commit je
   Zug auf `cockpit-rebuild`, deutsche Commit-Message mit Typ-Prefix.
   **NICHT auf `main` pushen** — Livegang ist Kevins Wort.
3. **Migration 0070 ist ausdrücklich erlaubt** (D2) — aber ausschließlich über
   `supabase db push`, NIE im SQL-Editor (Lehre L2). Will der Trockenlauf mehr
   als genau `0070` einspielen → **STOPP und melden.**
4. **Runner-Erweiterung ist ausdrücklich erlaubt** (das ist die Mission). Nach
   jeder Code-Änderung am Runner: `launchctl kickstart -k gui/$(id -u)/de.uriel.runner`.
5. **Der Sync liest nur.** Kein Klick, kein Senden, kein Zurückziehen von
   Einladungen, keine Navigation über das Nötigste hinaus — exakt die Haltung
   von `runner/linkedin/sync.mjs`.
6. **Tabu (nur lesen, nie ändern):** `lib/prioritaet.ts`, `hooks/usePosten.ts`,
   `lib/arbeitsmodusTracking.ts`, `lib/linkedinFollowups.ts`,
   `lib/runnerBridge.ts`. Es gibt genau eine Zählwahrheit:
   `useDailyMetrics().bump()`. Die Funnel-Listen LESEN Buckets und Posten,
   sie definieren keine zweite Fälligkeit.
7. **Ein Breakpoint, 900** — `MOBILE_MAX_WIDTH` importieren, nie abtippen.
   Mobil bei 390×664 verifizieren. Token-Disziplin: jede Farbe aus `--ck-*`.

---

## Recon-Befunde (Stand 12.08., von der Planung am Code verifiziert)

| Befund | Beleg | Konsequenz |
|---|---|---|
| Postfach-Sync läuft via CDP gegen ein eigenes Sync-Chrome (`~/.uriel-chrome`, Alias `chrome-sync`, Port 9222); queryIds werden je Lauf aus den Requests der Seite abgeleitet, nie hartkodiert | `runner/linkedin/sync.mjs:1-36` | F3 nutzt exakt dieselbe Mechanik |
| Sicherheitsnetz des Postfach-Syncs: exakt 20 Treffer → `partial: true`, und auf dieser Basis wird nie archiviert | `sync.mjs:11-18` | F3 übernimmt das Muster (D4) |
| `probe.mjs` existiert als Diagnose (loginWall, queryId, Mailbox) | `runner/linkedin/probe.mjs` | F0 fährt sie als Vorbedingung |
| Namens-/URL-Normalisierung existiert: `normalizeName`, `normalizeLinkedinUrl` | `runner/linkedin/upsert.mjs:52-63` | F4 importiert, baut nichts Zweites |
| `linkedin_erstnachrichten`: `unique(brand_id, gruppe, name)`, Status `offen/gesendet/uebersprungen` | `supabase/migrations/0060:11-27` | Liste 1 prüft gegen `gesendet` |
| `LoomStatus = 'offen'\|'aufgenommen'\|'verschickt'\|'entfaellt'`; `loomPosten = starred && loom_status='offen'` | `types/db.ts:387`, `arbeitsmodusQuellen.ts:63-69` | Liste 4 = `loomPosten`, fertig |
| Buckets (`wartet`, `faellig`, `du_bist_dran`, …) + `followup_stage` tragen Listen 2+3 | `lib/linkedinFollowups.ts` (Tabu, nur lesen) | keine neue Fälligkeitslogik |
| Vitals: `anfragenSum = li+ig`, `nachrichtenSum = li+ig`, Ziele aus `WEEK_TARGETS` | `metricsAggregate.ts:80-121` | F1 ändert nur `goals.ts` |
| Tages-Flow-Ziele hängen an `WEEK_TARGETS ÷ ARBEITSTAGE_WOCHE` — **und `verify-tages-flow.ts` prüft die Ergebnisse hart als 15 und 5** | `tagesFlow.ts:85,93`, `verify-tages-flow.ts` („ist damit 15"/„ist damit 5") | F1 zieht BEIDE Checks mit, sonst bricht die Suite |
| Letzte Migration: `0069` | `supabase/migrations/` | die neue heisst `0070` |
| App liest LinkedIn-Tabellen direkt über Supabase (RLS via `brands`) | `hooks/useLinkedinThreads.ts` | D3: kein Snapshot-Spiegel für die Listen nötig |
| ICP-Wahrheit ist der **Website-Zustand**, nicht die Headline; angefragt wird per Sales Navigator, „da ist nicht jeder exakt ICP" | Baseline-Doc, Abschnitt „ICP-Kriterium" | D9: der Sync speichert roh, ICP-Feinfilter bleibt Routine-Arbeit |

---

## Entscheidungen (getroffen — nichts davon neu verhandeln)

- **D1 — Wochenziele (Kevins Wort, 12.08.):** Anfragen **180**, Nachrichten
  **40**, Looms **10**. Termine (5) und Abschlüsse (2) unverändert. Die
  Tagesziele im Zähl-Modus folgen automatisch der bestehenden Kopplung:
  Nachrichten 15 → **8**, Looms 5 → **2** (`Math.round(WEEK/5)`). Das
  Anfragen-Tagesziel bleibt `ANFRAGEN_LIMIT_TAG = 30` — Kevins realer Rhythmus
  sind Blöcke von ~65–70 an ~3 Tagen (Baseline), das Tageslimit ist bewusst
  eine andere Größe als das Wochenziel.
- **D2 — Netzwerk-Sync im Runner** via CDP/Voyager (dasselbe Sync-Chrome wie
  das Postfach), **Migration 0070**, neue Tabelle `linkedin_netzwerk`.
- **D3 — Die App liest `linkedin_netzwerk` direkt** (RLS wie 0060). Kein
  Snapshot-Spiegel für die Listen; in `runner_snapshots` landet nur eine
  kleine Meta-Zeile (`linkedin_netzwerk_meta`: letzter voller Lauf je Teil,
  partial-Flag, Zählstände) für Frische-Anzeige am Handy.
- **D4 — InMail-Kandidaten nur aus vollständigen Läufen.** Ein partieller
  Einladungs-Sync verändert den Kandidaten-Stand NICHT (er darf Einträge
  hinzufügen/aktualisieren, aber keine Abwesenheits-Schlüsse ziehen). Die UI
  zeigt den Stand des letzten vollen Laufs samt Zeitstempel.
- **D5 — Matching konservativ.** Schlüssel ist der öffentliche
  Profil-Identifier aus der URL (`profil_key`). Zuordnung Netzwerk ⋈ Threads /
  Erstnachrichten läuft über `normalizeLinkedinUrl`, dann `normalizeName`;
  ist ein Name mehrdeutig (mehrere Kandidaten), wandert der Eintrag in einen
  „prüfen"-Zustand statt still zugeordnet zu werden.
- **D6 — Die Listen leben im LinkedIn-Bereich** (`LinkedinArea`), wo die
  Bucket-Zahlen schon stehen: eine Funnel-Zeile mit vier Kacheln (Liste 1, 2+3,
  4, 5), Tap → Namensliste im bekannten Muster (Kachel → Fenster → Namensliste;
  je Zeile Name, Firma/Headline, Alter, Profil-Link). Kopier-Knöpfe nur, wo
  versandfertiger Text existiert — hier also keine.
- **D7 — Das Stufe-5-Soll im Tages-Flow bleibt die Tagesration (5)**, nicht der
  Rückstau. 880 als Tagesziel wäre eine Zahl, die nur demotiviert.
- **D8 — Der `linkedin-inmail`-Skill bleibt unangetastet** (lebt im Vault,
  eigene Runde). Die neue Kandidaten-Liste ist ihm künftig Zulieferung; das
  wird im BACKLOG als Folgepunkt notiert, nicht hier gebaut.
- **D9 — ICP-Feinfilter (Website-Zustand) bleibt Agenten-/Routine-Arbeit.**
  Der Sync speichert das Netzwerk roh (Name, Headline, URL, Daten). Liste 1
  heisst in der UI ehrlich „Angenommen · noch keine Erstnachricht", nicht
  „ICP offen" — die ICP-Entscheidung fällt weiter beim Draften
  (linkedin-leads-Routine).
- **D10 — Auslöser des Netzwerk-Syncs:** Knopf in der UI (Desktop direkt,
  Handy über `runner_jobs`) + huckepack nach jedem erfolgreichen
  Postfach-Sync (ein Codepfad, kein eigener Timer in dieser Runde).

---

## Züge

### F0 — RECON: Startzustand und Sync-Chrome

**Aktion:** `git pull` · `cd app && npx tsc -b && npm run build` · alle 31
verify-Skripte · dann `node runner/linkedin/probe.mjs`.

**Erwartete Beobachtung:** Build grün, 31/31 grün. Probe meldet
`loginWall: false` und eine gefundene queryId.

**Wahrscheinlichster Fehler:** CDP nicht erreichbar („CDP nicht erreichbar auf
9222") — das Sync-Chrome läuft nicht. **Gegenzug:** Kevin bitten, `chrome-sync`
zu starten (Alias in `~/.zshrc`). Zweiter Fehler: `loginWall: true` — die
LinkedIn-Session im Sync-Profil ist abgelaufen. **Gegenzug:** Kevin loggt sich
im Sync-Chrome einmal ein. **Trigger:** Ist keins von beidem binnen der Session
zu beschaffen → Züge F1, F4a, F5a trotzdem fahren (alles ohne Netzwerk-Daten),
F2/F3 melden und stoppen.

**Hinweis:** Die Claude-CLI-Anmeldung (Backlog 12.08.) ist davon unabhängig —
Voyager braucht den LinkedIn-Login, nicht die Claude-Session. Nicht verwechseln.

### F1 — Wochenziele: `goals.ts` + die zwei harten Checks

**Aktion:** In `app/src/cockpit/lib/goals.ts` `WEEK_TARGETS` auf
`anfragen: 180, nachrichten: 40, looms: 10` setzen (Termine/Abschlüsse
unverändert), Kommentar: Herkunft „Kevins Diktat 12.08." + Baseline-Rechnung
(180 Anfragen → ~30 Kontakte → ~20 ICP-Erstnachrichten + Antworten).
**Gleichzeitig** in `scripts/verify-tages-flow.ts` die zwei Erwartungen
nachziehen: „das Nachrichten-Ziel ist damit 15" → **8**, „das Loom-Ziel ist
damit 5" → **2**.

**Erwartete Beobachtung:** Ohne die Check-Anpassung schlägt `verify-tages-flow`
mit genau diesen zwei Fällen fehl — das ist die Absicherung, dass die Kopplung
lebt. Mit Anpassung: 31/31 grün. In der App (Dev-Server): Vitals zeigen
`60/180`, `x/40`, `x/10`; der Zähl-Modus zeigt Nachrichten-Ziel 8, Loom-Ziel 2;
der Hero-Ring der Stufe 2 sagt „Noch 8 · …".

**Wahrscheinlichster Fehler:** Nur `goals.ts` geändert, Suite rot, und der
Executor „repariert" durch Zurückdrehen der Ziele. **Gegenzug:** Die
Check-Anpassung ist Teil DIESES Zuges, nicht eines späteren.

### F2 — Migration 0070: `linkedin_netzwerk`

**Aktion:** `supabase/migrations/0070_linkedin_netzwerk.sql`:

```sql
create table if not exists linkedin_netzwerk (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  -- öffentlicher Profil-Identifier aus der URL, z. B. "kevin-herrmann-b2b"
  profil_key text not null,
  name text not null,
  headline text not null default '',
  profile_url text not null default '',
  -- offen = Einladung raus, nicht angenommen · angenommen = ist Kontakt
  status text not null check (status in ('offen', 'angenommen')),
  eingeladen_at timestamptz,
  angenommen_at timestamptz,
  -- war der Eintrag im letzten Lauf seiner Liste noch da? (D4)
  zuletzt_gesehen_at timestamptz not null default now(),
  first_seen_at timestamptz not null default now(),
  last_synced_at timestamptz not null default now(),
  unique (brand_id, profil_key)
);
```

RLS exakt nach dem Muster von `0060` (Policy via `brands.user_id = auth.uid()`),
Index auf `(brand_id, status, zuletzt_gesehen_at)`. Dann `supabase db push`.

**Erwartete Beobachtung:** Der Trockenlauf nennt **genau `0070`**, danach
`supabase migration list --linked` zeigt 0070 in Local und Remote.

**Wahrscheinlichster Fehler:** Der Trockenlauf will alte Migrationen erneut
einspielen (Historie-Desync wie im Juli). **Gegenzug:** NICHT pushen — das ist
**Abbruchbedingung 2**, stoppen und melden.

### F3 — Runner: `runner/linkedin/netzwerk.mjs` (zwei Lese-Läufe)

**Aktion:** Neues Modul nach dem Vorbild von `sync.mjs` (CDP, Tab öffnen,
queryId aus dem Netzwerk-Traffic der Seite ableiten, GraphQL replayen):

- **Teil A — gesendete Einladungen:** Seite
  `linkedin.com/mynetwork/invitation-manager/sent/` → alle Einträge
  durchblättern (~880, Stand 27.07.). Je Eintrag: Name, Headline, Profil-URL,
  (falls geliefert) Sendedatum. → `status 'offen'`.
- **Teil B — Kontakte:** Seite
  `linkedin.com/mynetwork/invite-connect/connections/` (sortiert „recently
  added") → Einträge mit `connectedAt`. → `status 'angenommen'`.
  **Inkrementell nach dem ersten Tiefenscan:** blättern nur bis zum ältesten
  bereits bekannten `angenommen_at` — LinkedIn sortiert absteigend, ein
  kurzes Fenster übersieht keinen Neuzugang.

Upsert in `linkedin_netzwerk` (Schlüssel `brand_id + profil_key`):
Ein Eintrag, der in Teil B auftaucht, wird `angenommen` (auch wenn er vorher
`offen` war — das IST die Annahme). `zuletzt_gesehen_at` aktualisiert nur der
Lauf des jeweils eigenen Teils. **Bei `partial` (Timeout/Abbruch mitten im
Blättern): nur hinzufügen/aktualisieren, keine Abwesenheits-Schlüsse** (D4).
Meta-Zeile nach `runner_snapshots` (`linkedin_netzwerk_meta`). Endpoint
`POST /linkedin/netzwerk-sync` mit demselben Guard-Muster wie
`linkedinSyncRunning` + `runner_jobs`-Abwicklung fürs Handy + Huckepack-Aufruf
nach erfolgreichem Postfach-Sync (D10). `--dry-run` wie beim Postfach-Sync.

**Erwartete Beobachtung (Dry-Run zuerst):**
`LINKEDIN_SCAN_TAGE=… node runner/linkedin/netzwerk.mjs --dry-run` druckt
Zählstände in der Größenordnung der Baseline (mehrere hundert offene, einige
hundert Kontakte) und `partial: false`. Danach echter Lauf: Tabelle gefüllt,
`select count(*) … status='offen'` grob ~800–900.

**Wahrscheinlichster Fehler:** Die Voyager-Antwortform der beiden Seiten weicht
vom Postfach-Muster ab (andere GraphQL-Struktur, Pagination-Token statt
Offset). **Signal:** abgeleitete queryId liefert 200, aber die erwarteten
Felder fehlen. **Gegenzug (RECON NEEDED R2/R3, in dieser Reihenfolge):**
(1) im Sync-Chrome die Seite von Hand laden und ALLE GraphQL-Requests der Seite
mitschneiden — die Seite verrät ihr eigenes Format; (2) wenn Voyager sich
sperrt: DOM-Weg — die gerenderte Liste über CDP auslesen und blättern (langsamer,
aber dieselben Daten). (3) Liefern beide Wege nichts → **Abbruchbedingung 3**.

**Zweiter wahrscheinlicher Fehler:** Timeout beim 880er-Blättern.
**Signal:** Lauf bricht bei Teilmenge ab. **Gegenzug:** `partial: true` setzen
(Sicherheitsnetz greift), Blätter-Fenster verkleinern, Lauf wiederholen —
der Upsert ist idempotent, mehrere Teilläufe addieren sich.

### F4 — `lib/funnelStufen.ts`: die fünf Listen als reine Funktionen

**Aktion:** Neues Modul `app/src/cockpit/lib/funnelStufen.ts` — reine
Funktionen, keine React-Importe (Muster `tagesFlow.ts`):

- `angenommenOhneErstnachricht(netzwerk, threads, erstnachrichten)` — Liste 1:
  `status='angenommen'`, kein Thread-Match (erst URL, dann Name), keine
  Erstnachricht mit Status `gesendet` gleichen Namens. Mehrdeutige Namen →
  eigener Zustand `pruefen` (D5), nie still zuordnen. Sortiert nach
  `angenommen_at` absteigend.
- `erstnachrichtOhneAntwort(threads, jetzt)` — Liste 2: `last_from='me'`,
  `followup_stage === 0`, Bucket `wartet` oder `faellig` (via `bucketOf`,
  nur lesen).
- `nachgefasstOhneAntwort(threads, jetzt)` — Liste 3: wie 2, aber
  `followup_stage >= 1`.
- Liste 4 ist `loomPosten(threads)` — **nicht neu bauen**, re-exportieren
  oder direkt konsumieren.
- `inmailKandidaten(netzwerk, meta, jetzt)` — Liste 5: `status='offen'` UND
  `zuletzt_gesehen_at >= meta.letzterVollerEinladungsLauf` (D4). Sortiert
  älteste zuerst (die warten am längsten).

**Zwingend:** `scripts/verify-funnel-stufen.ts` mit Fixtures — u. a.: Annahme
wandert korrekt (offen→angenommen verschwindet aus Liste 5, taucht in Liste 1
auf, bis Erstnachricht `gesendet`); Namenskollision landet in `pruefen`;
partieller Lauf verändert Liste 5 nicht; leere Tabelle bricht nichts.

**Erwartete Beobachtung:** Verify grün; mit den echten Daten aus F3 liegen die
Größenordnungen bei der Baseline (Liste 5 ~mehrere hundert, Liste 2 ~50–100).

**Wahrscheinlichster Fehler:** Doppelzählung zwischen Liste 1 und 2 (jemand hat
einen Thread, aber die Erstnachricht kam von IHM — `last_from='them'` ohne
Kevins Nachricht). **Gegenzug:** Liste 1 schließt jeden aus, der IRGENDEINEN
Thread-Match hat; wer schrieb, steckt im Bucket-System, nicht im „noch nie
angeschrieben"-Topf. Der Fixture-Fall gehört ins Verify.

*(F4a — falls F0-Trigger „ohne Netzwerk" gezogen hat: nur Listen 2–4 bauen,
Signaturen für 1 und 5 mit leerer Eingabe vorbereiten.)*

### F5 — UI: Funnel-Zeile im LinkedIn-Bereich

**Aktion:** In `LinkedinArea` (dort stehen die Bucket-Zahlen) eine
Funnel-Sektion nach D6: vier Kacheln — „Angenommen · ohne Erstnachricht (n)",
„Ohne Antwort (n₂ + n₃, aufgeklappt getrennt)", „Wartet auf Loom (n)",
„Nie angenommen (n · InMail)". Tap → Fenster mit Namensliste (Name,
Firma/Headline, Alter in Tagen, Profil-Link öffnet neuen Tab). Kopfzeile der
Sektion: Frische („Netzwerk: Stand vor 2 h") + Sync-Knopf
(`POST /linkedin/netzwerk-sync`, am Handy via `runner_jobs`; Guard-Antwort 409
→ „läuft schon" zeigen, nicht erneut feuern). Bei `partial` oder fehlendem
Meta: ehrlicher Zustand „Noch kein vollständiger Netzwerk-Sync" statt einer
falschen Null.

**Erwartete Beobachtung:** 390×664 — Kacheln ohne Querscrollen, Touch-Ziele
≥ 44 px, Listen scrollen im Fenster; Desktop 1280 ohne Umbrüche. Zahlen decken
sich mit F4-Ableitung (Stichprobe: dieselbe Person in genau einer Liste).

**Wahrscheinlichster Fehler:** `LinkedinArea` ist groß — ein Umbau reißt
bestehende Buckets um. **Gegenzug:** Funnel-Sektion als EIGENE Komponente
(`components/linkedin/FunnelStufen.tsx` o. ä.), in `LinkedinArea` nur montiert;
bestehende Bucket-UI unangetastet.

*(F5a — ohne Netzwerk-Daten: Kacheln 1 und 5 zeigen den „Sync ausstehend"-
Zustand, 2–4 sind voll funktional.)*

### F6 — Abschluss

**Aktion:** Voller Gate-Lauf (`tsc -b`, `build`, alle verify — jetzt 32).
Runner-Neustart (Gesetz 4). Mobile Abnahme 390×664 mit echten Daten:
alle vier Kacheln geöffnet, Screenshot. BACKLOG-Runde nach Konvention —
inklusive: Folgepunkt „linkedin-inmail-Skill auf `linkedin_netzwerk`
umstellen" (D8) und Vitals-Beleg (60/180 statt 60/75). Kein Push auf `main`.

---

## RECON NEEDED (der Executor klärt, die Blaupause nennt den Check)

- **R1** Sync-Chrome bereit? → `node runner/linkedin/probe.mjs` (F0).
- **R2** Voyager-Format der Sent-Invitations-Seite → GraphQL-Requests der
  Seite im Sync-Chrome mitschneiden (F3-Gegenzug); Fallback DOM.
- **R3** dito Connections-Seite; liefert sie `connectedAt` maschinenlesbar?
- **R4** Enthält die Einladungs-Antwort ein Sendedatum? Falls nein:
  `eingeladen_at` bleibt `null`, das Alter läuft über `first_seen_at`
  (ehrlich dokumentieren, nicht erfinden).
- **R5** Wo genau der Huckepack-Aufruf nach dem Postfach-Sync hängt
  (`runner/index.mjs`, beide Sync-Pfade — HTTP und runner_jobs).

## Abbruchbedingungen

1. **LinkedIn-Login im Sync-Chrome nicht zu beschaffen** → F1/F4a/F5a fertig
   bauen, F2/F3 melden, Runde sauber beenden.
2. **`db push`-Trockenlauf will mehr als 0070** → nichts pushen, melden
   (Historie-Desync, Lehre L2).
3. **Weder Voyager noch DOM liefern die Einladungs-/Kontaktlisten** → wie 1
   verfahren, Befund mit Mitschnitt der Versuche ins BACKLOG.
4. **Ein Kern-Verify (prioritaet, linkedin-followups, arbeitsmodus) bricht**
   → letzter Commit zurück, melden. Diese Runde darf dort nichts bewegen.

## Red-Team-Protokoll (Angriffe gegen den Entwurf, vor dem Festschreiben)

| Angriff | Ergebnis | Patch |
|---|---|---|
| Partieller 880er-Lauf halbiert die InMail-Liste; die Welle schreibt Leute an, die längst angenommen haben | **durchgekommen** | D4 + F3-Sicherheitsnetz: Abwesenheits-Schlüsse nur aus vollen Läufen; Liste 5 filtert auf `zuletzt_gesehen_at >= letzter voller Lauf` |
| Namenskollision ordnet den falschen „Michael Müller" zu — jemand fällt aus Liste 1, obwohl nie angeschrieben | **durchgekommen** | D5: URL-Schlüssel zuerst, mehrdeutige Namen → `pruefen`-Zustand, Fixture-Fall im Verify |
| Ziele ändern bricht `verify-tages-flow` (hartkodierte 15/5), Executor dreht die Ziele zurück statt die Checks nachzuziehen | **durchgekommen** | F1 nennt beide Checks als Bestandteil des Zuges |
| Zurückgezogene/abgelaufene Einladungen bleiben ewig `offen` und müllen Liste 5 zu | **gescheitert** (D4-Filter fängt es: wer im letzten vollen Lauf fehlt, fällt aus der Kandidaten-Menge) | — |
| Huckepack-Sync verdoppelt Läufe, wenn Postfach-Sync und Knopf gleichzeitig feuern | **gescheitert** (Guard-Muster `…Running` deckt beide Pfade, F3 übernimmt es) | — |

## Verifikation (durch den Executor, je Zug + am Ende)

`cd app && npx tsc -b && npm run build` und die komplette
`scripts/verify-*.ts`-Suite nach jedem Zug; neu: `verify-funnel-stufen.ts`.
Am Ende zusätzlich: Dry-Run-Zählstände des Netzwerk-Syncs gegen die
Baseline-Größenordnungen (Faktor <2 Abweichung, sonst Befund notieren);
Stichprobe „eine Person, genau eine Liste"; Vitals-Screenshot mit `x/180`;
mobile Abnahme 390×664.

---

## Kickoff-Prompt (für die neue Session, Opus 5 · Empfehlung `/effort xhigh`)

> Du arbeitest an Uriel: `~/Kevin OS/02 Projekte/uriel`, Branch `cockpit-rebuild`.
> Aufgabe: die Funnel-Stufen-Runde nach der Blaupause
> `docs/wargames/funnel-stufen.md` — vollständig lesen, dann Züge F0–F6 der
> Reihe nach. Einlesen: (1) die Blaupause, (2) `HANDOFF.md`, (3) `docs/BACKLOG.md`
> (Runden 11./12.08.), (4) `docs/wargames/linkedin-followups.md` als Vorbild für
> die Sync-Mechanik. Alle Entscheidungen sind gefallen (D1–D10); Zahlen sind
> Kevins Wort. Gesetze der Blaupause gelten wörtlich — insbesondere: Migration
> nur `db push` (exakt 0070), Sync liest nur, ein Commit je Zug, kein Push auf
> `main`. Bei Abbruchbedingung: stoppen und melden, nicht improvisieren.
