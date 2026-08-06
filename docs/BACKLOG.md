# Uriel — Backlog (die eine Quelle der Wahrheit)

**Stand:** 2026-08-06 · Branch `cockpit-rebuild` · Repo `~/Kevin OS/02 Projekte/uriel`

Dieses Dokument ersetzt das Nebeneinander von `IDEEN-2026-07-30-nutzbarkeit.md`,
`IDEAS-2026.md`, `AGENTIC-OS-PLAN.md`, `REBUILD-PLAN.md`, dem Masterplan im Vault
und den fünf Wargames. Jene Dokumente bleiben als **Begründung** stehen (warum
etwas so entschieden wurde); **was noch zu tun ist, steht ausschließlich hier.**

**Regeln dieses Dokuments**
- Jede Aussage ist am Code, an der Datenbank oder am Dateisystem geprüft. Beleg
  in Klammern: `Datei:Zeile` oder das Kommando.
- Was nicht belegbar war, steht als **ungeprüft** da — nicht als Vermutung.
- Ein Punkt steht genau einmal. Unter „Herkunft" steht, aus welchen Dokumenten er
  zusammengeführt wurde.
- Aufwand: **S** = unter einer Stunde · **M** = halber bis ganzer Tag ·
  **L** = mehrere Tage.

**Prüfstand der Verifikation (06.08.2026)**
`git log main..cockpit-rebuild` · `supabase migration list --linked` ·
REST-Abfragen mit `service_role` gegen die Prod-DB · Grep über `app/src`,
`runner/`, `supabase/` · `git status` im Worktree.
Nicht verifizierbar ohne Docker/SQL-Zugang: Sichtbarkeitsregeln (`security_invoker`)
und Policy-Details in der Prod-DB.

---

## 1 — Livegang

Alles hier steht zwischen dem heutigen Code und „läuft in Produktion".
**Etappen 1–4 sind seit dem 06.08. live**, fünf jüngere Commits noch nicht (L1).
`main` hat keinen eigenen Commit — der Livegang bleibt ein Fast-Forward, kein Merge.
Was in diesem Abschnitt abgehakt ist, ist wirklich in Produktion; die Edge Functions
(L4, L5) deployen unabhängig vom Frontend und sind es bereits.

### L1 · Fast-Forward — **Etappen 1–4 sind live, der Rest hängt** (Stand 06.08. abends)
`main` steht auf `b9fb090` (letzter Etappe-4-Commit) und ist gepusht — die vier
Etappen laufen auf frameworkos.de. Ausgeliefert wird `index-CvTize-3.js`.

**Noch nicht live: 5 Commits auf `cockpit-rebuild`** — `a79ddca` (Backlog + HANDOFF),
`2a71d59`, `d62d5eb` (Backlog-Nachträge), `77d157c` (send-email-Fix), `9eac2df`
(`log_metric`). Verbindlich ist immer `git log --oneline main..cockpit-rebuild`.

**⚠ Drift, solange das offen ist:** Edge Functions deployen aus dem
Arbeitsverzeichnis, nicht aus `main`. Die live laufende `send-email` **v20** enthält
den Deep-Link-Fix aus `77d157c`, obwohl der Commit nicht auf `main` ist. Ein
späterer `send-email`-Deploy **von `main` aus** würde den Fix stillschweigend
zurückdrehen. Der nächste Fast-Forward löst das auf.

**Vor dem nächsten Livegang:** einmal in der Netlify-UI prüfen, welcher Branch als
Production eingestellt ist — `netlify.toml` legt ihn nicht fest (**ungeprüft**).
*Herkunft: Session-Inventur, was-ansteht.html*

### L2 · ~~Migrations-Historie reparieren~~ ✅ **erledigt 06.08.2026**
`supabase migration repair --status applied 0059 … 0066` gelaufen, danach zeigt
`supabase migration list --linked` **0001–0066 lückenlos in Local *und* Remote**.
`db push` ist damit wieder benutzbar — Voraussetzung für 0067 (O3) ist erfüllt.
Nur die Buchführung wurde geschrieben, am Schema nichts geändert.

**Warum es kaputt war** (als Lehre, damit es nicht wiederkommt):
`supabase migration list --linked` zeigte **0059–0066 mit leerer Remote-Spalte**.
Die Objekte sind alle in der DB (per REST bestätigt: `month_goals` 200,
`linkedin_threads.verlauf`/`entwurf` vorhanden, `arbeits_dauern` gefüllt, Bucket
`runner-files` existiert, `daily_metrics.coldmails` ist weg) — sie wurden am
SQL-Editor vorbei eingespielt und nie als angewendet verbucht.

**Folge, hätte man es nicht bemerkt:** Das nächste `db push` hätte 0059–0066 erneut
ausgeführt — exakt Abbruchbedingung 2 des Morgen-Wargames, scharf, bevor 0067
überhaupt geschrieben war.

**Regel ab jetzt:** Migrationen ausschließlich über `db push`, nie im SQL-Editor.
Genau das war die Ursache — dieselbe Lehre stand schon nach dem 15.07. im Raum.
*Am 06.08. gefunden; stand in keinem Dokument.*

### L3 · `security_invoker` auf `site_content_published` — **NICHT ausführen**, verschoben nach O13
**Der Auftrag wäre ein Rückschritt gewesen — hier steht, warum.**

`0052_site_content.sql:108-112` setzt `with (security_invoker = off)` **ausdrücklich
und kommentiert**: „Öffentlicher Lesezugriff NUR auf Published-Werte über eine
Definer-View — die Basistabelle bleibt für anon unsichtbar (keine Drafts, keine
Labels)." Es ist also kein Versehen, sondern der Kern des Entwurfs.

Was passiert wäre:
1. Mit `security_invoker = on` läuft die View als Aufrufer. `site_content` hat
   Policies für Owner und Portal-Client, **keine für `anon`** (`:29-66`) und auch
   kein `grant`. Ergebnis: Für Website-Besucher liefert die View **nichts** —
   unbemerkt, weil die Tabelle 0 Zeilen hat.
2. Der naheliegende Ausgleich (`grant select` + `anon`-Policy auf `site_content`)
   macht es **schlimmer**: eine RLS-Policy schränkt Zeilen ein, keine Spalten. Der
   anon-Key steht im ausgelieferten Frontend-Bundle — jeder könnte dann
   `value_draft`, `label`, `section` und `status` lesen. Genau das, was die
   Definer-View heute verhindert.

**Der echte Restpunkt** ist ein anderer und kleiner: Die Definer-View ist nicht nach
Projekt gezogen — wer den anon-Key hat, liest die veröffentlichten Werte **aller**
Projekte. Inhaltlich sind das Texte, die ohnehin öffentlich auf der Kundenwebsite
stehen; es leckt vor allem die Projekt-UUIDs. Saubere Lösung wäre eine
Security-Definer-**Funktion** mit `project_id`-Parameter statt einer offenen View —
das ändert aber auch `app/src/lib/siteContentService.ts` und gehört damit zur
CMS-Entscheidung, nicht in den Livegang.

**Kein Livegang-Blocker:** `site_content` hat 0 Zeilen, keine Kundenseite liest die
View. Der Punkt wandert zu O13 („Website-CMS schließen oder ausblenden").
*Herkunft: Session-Inventur — die Meldung „Sicherheitslücke" beruht auf dem
generischen Supabase-Linter-Hinweis zu Definer-Views, nicht auf diesem Fall.*

### L4 · ~~Deep-Link in `send-email`~~ ✅ **erledigt 06.08.2026**
`send-email/index.ts:157` zeigte auf `/brand/:slug/deliver/:id` — eine Route, die
Etappe 4 abgerissen hat. Jetzt `/projekte/${project.id}` (deckt sich mit
`legacyRouteMap.ts:20`). Function deployt (**Version 20**, 14:25 UTC).

**Korrektur am ursprünglichen Befund:** `PUBLIC_APP_URL` **war bereits gesetzt** —
per Digest-Abgleich verifiziert als `https://frameworkos.de`. Der genannte
Vercel-Default hat also nie gegriffen; er ist außerdem nicht tot (antwortet 200).
Beide Fallbacks (`PUBLIC_APP_URL`, `EMAIL_ASSETS_BASE_URL`) zeigen jetzt trotzdem
auf die Live-Domain, damit niemand mehr an einem fremden Deploy hängt.
**Nebenbefund mitgenommen:** Der Kommentar „frameworkos.de hat kein `/email/*`"
(`:220`) stimmt nicht mehr — `https://frameworkos.de/email/herrmann-logo.png`
liefert 200 `image/png`. Das Logo in Sales-Mails hängt damit nicht mehr an Vercel.
*Herkunft: Session-Inventur*

### L5 · ~~`invite-client` deployen~~ ✅ **erledigt 06.08.2026**
Die Function war tatsächlich **nie deployt** — `supabase functions list` kannte sie
nicht. Jetzt **Version 1**, 14:23 UTC. Alle vier benötigten Secrets sind gesetzt
(`RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME`, `PUBLIC_APP_URL`), die
Implementierung ist vollständig (326 Zeilen, `generateLink type: 'recovery'` →
`/portal/setup`). Damit funktioniert der Passwort-Login fürs Kundenportal.
Sie tut nichts von allein — sie feuert nur auf einen Owner-JWT-Aufruf hin.
*Neu — stand in keinem Plandokument, nur in einer Session vom 09.07.*

### L5b · Drei weitere Functions sind nicht deployt — **Entscheidung nötig**
Beim Prüfen von L5 aufgefallen: Von 15 Functions im Repo sind **11 live**. Es fehlen
neben `invite-client` (jetzt behoben) noch drei:

| Function | Wofür | Einschätzung |
|---|---|---|
| **`email-inbound`** | Lead-Eingang `leads+slug@frameworkos.de` — der Regex, den der Rebrand ausdrücklich nicht anfassen durfte | **Der wichtigste.** Ob ein Resend-Inbound-Webhook überhaupt darauf zeigt, ist von hier nicht prüfbar (**ungeprüft**). Wenn ja, fallen eingehende Lead-Mails ins Leere. |
| `discovery-agent` | Markt-/Wettbewerbs-Analyse der alten Discovery-Welt | Deren UI ist in Phase 6 gelöscht — vermutlich bewusst tot |
| `discovery-feed-refresh` | Cron für denselben Feed | dito |

Nicht mitdeployt, weil es über L5 hinausgeht und `email-inbound` am Lead-Eingang
hängt: erst klären, ob ein Webhook darauf zeigt, dann deployen oder streichen.

### L6 · `ANTHROPIC_API_KEY` — **gesetzt, letzte Bestätigung 19.07.**
`supabase secrets list`: `ANTHROPIC_API_KEY` ist gesetzt. `ANTHROPIC_MODEL` ist per
Digest-Abgleich als `claude-sonnet-5` verifiziert — also kein totes Modell mehr (der
Fehler vom 07.07. war `claude-sonnet-4-20250514`).
**Kette der Belege:** Der ungültige Key wurde am 07.07. per CLI neu gesetzt
(`rebuild-notes.md`), `brand-assistant` danach neu deployt (07.07. 10:43 UTC), und
am 19./20.07. hat Uriel im Dock live geantwortet — das geht nur mit gültigem Key.
**Grenze der Prüfung:** Ein Aufruf *heute* braucht ein User-JWT; `uriel` und
`brand-assistant` prüfen `auth.getUser()`, der Service-Role-Key hilft dort nicht.
Ohne Session bleibt es **ungeprüft für heute** — nicht geraten. Der belastbare Test
dauert zehn Sekunden: eingeloggt eine Frage ins Uriel-Dock tippen.

### L7 · RLS-Drift bei `project_messages` — **erst reproduzieren**, dann S
Die Session-Inventur meldet „Migrationsdatei und DB sind auseinandergelaufen,
`deleted_at` wird abgelehnt". Am Lesepfad ist das nicht reproduzierbar:
`select deleted_at from project_messages` liefert **200**, die Spalte existiert seit
`0038_deliver_messaging_portal.sql:47`. Welcher Pfad (Insert? Update? Policy?)
abgelehnt wurde, geht aus keinem Dokument hervor. **Ungeprüft — nicht raten.**
Fällt ohnehin erst auf, wenn das Löschen von Nachrichten verdrahtet wird.
*Herkunft: Session-Inventur*

### L8 · ~~Morgen-Workflow-Blaupause committen~~ ✅ **erledigt 06.08.2026**
`docs/wargames/morgen-workflow.md` war die einzige unversionierte Datei im Repo —
421 Zeilen Planungsarbeit, die nur lokal lagen. Jetzt versioniert.

**Nicht mehr offen, entgegen der Session-Inventur:** Das Content-Modul ist
committet (Working Tree sauber), `social_batches` hat **4 Zeilen**, `content.json`
existiert. Offen ist dort nur noch der überfällige Testpost — siehe **O9**.

---

## 2 — Fertig, aber nirgends abgehakt

Damit es niemand ein zweites Mal baut. Jede Zeile mit Beleg.

### Aus dem AGENTIC-OS-PLAN (Abnahmeliste: sechs leere Kästchen, sechsmal gebaut)
| Abnahmepunkt | Beleg |
|---|---|
| `/os/map` liefert Skills/Routinen/Apps/Memory | `runner/index.mjs:1510` |
| `/os/file` (read-only, Pfad-Guard) | `runner/index.mjs:1552` |
| OsNebula ersetzt ForceGraph, Nodes klickbar, Suche | `app/src/cockpit/graph/OsNebula.tsx`, `nebulaLayout.ts` |
| 4 neue Skills laden sauber | `~/.claude/skills/{wargame,os-audit,last30days,website-pipeline}` |
| `brain.mjs` beantwortet eine Vault-Frage | `~/.claude/brain/brain.mjs` (07.07.) |
| Build grün, Screenshot an Kevin | Etappen 1–4 jeweils protokolliert |

Dazu **eine vierte Graph-Ansicht „Agenten"** (Session „Uriel Dashboard links",
20.07.) — das ist `IDEAS-2026` **G2 „Workflows-Ansicht"**, dort unangehakt.

### Aus `IDEEN-2026-07-30-nutzbarkeit.md`
| Punkt | Stand | Beleg |
|---|---|---|
| Wochen-Vitals-Bug (`weekRows` aus `monthRows`) | behoben | `useDailyMetrics.ts:354-358` — `weekRowsOf(allRows, …)` mit Kommentar |
| Freigaben-Status persistieren | gebaut | `cockpit/lib/approvalStatus.ts` |
| markDone-Ratsche im LinkedIn-Postfach | behoben | `useLinkedinThreads.ts:94` → `markDonePatch()`, Testskript `scripts/verify-linkedin-followups.ts` |
| Monatsziel-UI vor 01.09. | gebaut **und in der DB** | Migration 0062, `cockpit/lib/useMonthGoal.ts`; Tabelle `month_goals` antwortet 200 |
| Runs-, Datei- und Kalender-Spiegel | gebaut **und live** | Migration 0063; Snapshot-Keys `runs` (06.08.), `files_index` (05.08.), `calendar` (06.08.) in `runner_snapshots` |
| Antwort-Entwürfe am Posten + Verlauf syncen | gebaut | Migrationen 0064/0065, beide in der DB; `runner/index.mjs:400-404` |
| Heute-Deck v2 auf `ordnePosten` | gebaut | `HeuteDeck.tsx:39` (`usePosten`), `:22-23` mit Begründung |
| Tagesansage aus `arbeits_dauern` | gebaut | `cockpit/lib/tagesansage.ts`, `hooks/useArbeitsDauern.ts`, `SalesDashboard.tsx:418` |
| Bottom-Bar 9 → 5 Tabs | gebaut | `NavRail.tsx:18-30` (ARBEIT/NACHSCHLAGEN) |
| E-Mail-Bereich raus | gebaut | keine `EmailArea.tsx` mehr unter `cockpit/pages/` |
| Morgenbrief als Zeit-Routine | gebaut | `runner/index.mjs:1759-1781` (`maybeMorgenbrief`) |
| Glass-Leaks: Cmd+K, Toast, Fokus-Ring | geschlossen | `CommandPalette.tsx:260-364` (ck-Tokens, ICP-Einträge raus), `Toast.tsx:30-33` (Fehler 5.000 ms statt 2.200) |
| Kontrast `--ck-text-3` | behoben | `cockpit.css:21` = `#8a9599` (6,57:1, war 3,47:1) |
| ProjectPage in die ck-Welt | portiert | `pages/deliver/ProjectPage.tsx` — 1.003 Zeilen, **0** Glass-Treffer |
| Kunden-Posteingang im Cockpit | gebaut | `cockpit/lib/useKundenPosteingang.ts`, `components/KundenPosteingang.tsx` |
| Legacy-Metrikfelder raus | gebaut **und in der DB** | Migration 0066; `select coldmails` → `42703 column does not exist` |
| Alte Brand-Sales- und Deliver-Welt | abgerissen | Commit `fa8e295` |
| Abriss-Liste „sofort löschbar" | erledigt | alle `mock*`-Dateien, Portal-Leichen, `BrandDashboardPage`, Universe-Link weg; `ck-nav-spacer`/`ck-nav-back` auch aus dem CSS |

**Zwei Punkte der Abriss-Liste sind keine Leichen mehr** (nicht löschen):
`cockpit/lib/urielVoiceSettings.ts` wird von `useUrielVoice.ts:3` importiert — der
beanstandete Export `URIEL_VOICES` ist bereits entfernt (`urielVoiceSettings.ts:45`).
`components/Background.tsx` rendert schon jetzt nur außerhalb des Cockpits
(`App.tsx:169`: `{isCockpit ? null : <Background />}`) — die GPU-Kosten im Cockpit
sind weg.

### Uriel schreibt Tracking — `log_metric` (06.08.2026)
Bis dahin schrieb von zehn Werkzeugen nur `remember`; auf „trag 30
Vernetzungsanfragen ein" antwortete Uriel, er könne das nicht — obwohl Feld und
Upsert längst existierten.

| Baustein | Beleg |
|---|---|
| Feldkarte als Blatt-Modul (19 Felder + eindeutige Labels, ohne React) | `cockpit/lib/metrikFelder.ts` |
| Werkzeug-Schema, Enum direkt aus `METRIC_FIELDS` | `cockpit/lib/urielTools.ts` |
| Ausführung analog zu `remember`, über `bumpOn` | `cockpit/components/UrielDock.tsx`, `case 'log_metric'` |
| Reine Prüf-/Rechenlogik | `metrikFelder.ts` → `pruefeBuchung`, `berechneStand` |
| 25 Fälle grün | `scripts/verify-log-metric.ts` |

**Verhalten:** addiert statt zu überschreiben · negativer Wert korrigiert ·
optionales `datum` (nur Vergangenheit, max. 45 Tage zurück = Ladefenster) ·
Antwort nennt Tages- **und** Wochenstand („Vernetzungsanfragen (LinkedIn): heute
30, Woche 84"), damit ein Vertipper sofort auffällt.

**Zwei Fallen, die dabei entschärft wurden:**
- Der neue Stand wird in `berechneStand` gerechnet, **nicht** aus dem Hook gelesen.
  `bumpOn` schreibt optimistisch und gebündelt — der React-State im Executor-Closure
  ist noch der alte, Uriel hätte den Stand von *vorher* zurückgemeldet. Genau die
  Zahl, die den Vertipper aufdecken soll.
- Die Null-Klammer aus `bumpOn` (`Math.max(0, …)`) ist gespiegelt, sonst meldet
  Uriel bei einer Überkorrektur eine negative Zahl, die nie in der DB landet. Der
  Wochenstand zieht deshalb nur die *echte* Änderung ab.

**`METRIC_FIELDS` gegen die Prod-DB geprüft (06.08.):** alle 19 Felder existieren
als Spalte, und `daily_metrics` hat keine zählbare Spalte ohne Eintrag in
`METRIC_FIELDS`. Die vier Legacy-Sammelfelder sind mit 0066 gefallen — Code und
Schema sind deckungsgleich.

**Bewusst ausgelassen:** `umsatz`. Er wird gesetzt, nicht hochgezählt
(`setUmsatz`), ein „+500" wäre bei Geld mehrdeutig. Uriel verweist dafür auf
`/tracking` — siehe O13.

### Aus dem Masterplan
| Meilenstein | Stand | Beleg |
|---|---|---|
| M0 Rebrand | fertig | launchd `de.uriel.runner`, `URIEL` im Nebula-Kern |
| M1 Uriel-Modus + Command-Bus | fertig | `cockpit/lib/urielTools.ts`, `urielAgent.ts`, `UrielDock.tsx` |
| **M2 Push-to-talk** | **am Desktop gebaut** — siehe unten | `useUrielVoice.ts:123-172`, `UrielDock.tsx:625-633` |

**Korrektur zu M2.** Die bisherige Auswertung sagt „nicht gebaut — kein
Mikrofon-Zugriff, kein Recorder, keine Spracherkennung im Code". Das ist falsch:
`useUrielVoice.ts` implementiert Push-to-talk vollständig — Web Speech API,
`lang = 'de-DE'`, `interimResults`, `continuous`, 2,2-Sekunden-Silence-Timer,
`onInterim`/`onFinal` (`:123-172`); das Dock rendert den 🎤-Knopf, sobald
`sttSupported` wahr ist (`:625-633`); `startListening` läuft ausschließlich im
onClick-Pfad (`:319-324`).
**Was wirklich fehlt:** Web Speech braucht Chrome — in Safari und auf dem iPhone
bleibt `sttSupported` false. Die *Whisper*-Variante aus dem Masterplan existiert
nicht. Der offene Rest steht als **O12**.

### Sonstiges, nirgends notiert
- **Uriel-Gedächtnis** (`remember`-Werkzeug, 🧠-Menü, localStorage) — gebaut am
  20.07., `urielTools.ts:21`, `UrielDock.tsx:168/486`, `cockpit/lib/urielMemory.ts`.
  Steht in keinem Plandokument.
- **Kontrast-, Kachel- und Arbeitsmodus-Arbeit** aus `sales-arbeitsmodus.md`
  (Züge 1–8) ist komplett gebaut: `prioritaet.ts`, `Arbeitsmodus.tsx`,
  `arbeitsmodusTracking.ts`, `kundenarbeit.ts`, Migration 0061 (in der DB).
- **`linkedin-followups.md`** (Züge 1–9) ist komplett gebaut und im Betrieb:
  160 Zeilen in `linkedin_threads`, 91 in `linkedin_erstnachrichten`.

---

## 3 — Offen, nach Wirkung sortiert

### O1 · `useContacts` hält Kontakte doppelt — **M** · *der größte Posten*
Supabase **und** localStorage mit Merge/Resurrect (`hooks/useContacts.ts`, 711
Zeilen; `enrichContactFromLocal` `:262`, Fallbacks `:463/473/487/505`). Ergebnis:
Geister-Kontakte über Geräte hinweg — und die Freigaben-Queue verschickt
inzwischen echte E-Mails auf dieser Basis. 44 Kontakte in der DB.
**Ziel:** Supabase ist die einzige Wahrheit, localStorage nur Lese-Cache;
resurrect/enrich/Tombstones raus.
**Abhängigkeiten:** keine. Braucht einen manuellen Durchlauf der Pipeline-Flows.
*Herkunft: REBUILD-PLAN §12.5 (07.07.) · IDEAS-2026 §2.6 + §3.5 · IDEEN Abriss-Liste ·
Session-Inventur. Vier Dokumente, ein Punkt, offen seit dem 07.07.*

### O2 · ~~Follow-up-Doppelwelt festschreiben~~ ✅ **entschieden und gebaut 06.08.2026**
**Die Grenze, ab jetzt verbindlich:** `linkedin_threads` ist die einzige Wahrheit für
den **LinkedIn-Funnel** (`followup_stage` gegen `last_message_at`).
`contacts.next_follow_up_at` trägt **Kunden- und Deal-Follow-ups**. Kevin hat den
Vorschlag am 06.08. bestätigt und die härtere Variante gewählt: nicht nur
dokumentieren, sondern im Code durchsetzen.

**Was der Befund vorher korrigiert hat:** Es ist **keine Dublettenwelt**. Namentlich
überschneiden sich die 44 `contacts` und die 160 `linkedin_threads` in **2 Zeilen**.
Die Zusammensetzung der 44 (Stand 06.08., alle Zeilen zuletzt am 10.06. angefasst):
36 × `first_contact` / 40 × `not_contacted` — eine Hamburger Makler-Recherche-Liste,
nie kontaktiert, `lead_source` bei 43 leer; daneben 3 × `deal`, 1 × `proposal`,
4 × `conversation` und ein Testeintrag. Die 36 Recherche-Leads existieren **nur** in
`contacts` — in der neuen Lesart sind sie heimatlos.

**Was gebaut wurde**
| Baustein | Beleg |
|---|---|
| `FOLLOWUP_STAGES` = conversation · follow_up · proposal · deal; `first_contact` fehlt bewusst | `cockpit/lib/approvalDrafts.ts` |
| Kommentar an Quelle 1 (Kunden/Deals) | `types/db.ts` → `Contact.next_follow_up_at` |
| Kommentar an Quelle 2 (Funnel) | `types/db.ts` → `interface LinkedinThread` |
| Drift-Wache, 5 Fälle | `scripts/verify-entwuerfe.ts` Abschnitt 8 |

**Wirkung auf die Freigaben-Queue:** `dueFollowupContacts` traf vorher 5 Kontakte
(alle überfällig, 25.05.–01.07.), jetzt 4. Draußen ist „Franz & Köhler Immobilien" —
der einzige `first_contact` mit E-Mail-Adresse und damit der einzige, an den die
Queue tatsächlich eine kalte Mail hätte schicken können.

**Bewusst nicht gemacht:** Die 36 Recherche-Leads bleiben unverändert in `contacts`
liegen (Kevins Entscheidung 06.08.). Sie stören die Pipeline-Optik, nicht die Queue.
Aufräumen wäre ein eigener Schritt mit Blick auf die Namen — kein Nebenbei-Löschen.
*Herkunft: IDEEN „Das große Bild #2" + Abriss-Liste · Session-Inventur*

### O3 · Morgen-Push aufs Handy (Etappe A des Wargames) — **L**
Neun Züge, blind ausführbar: Service Worker (nur Push, kein Cache), Migration 0067
(`push_subscriptions`, `push_log`, pg_cron), Edge Function `morgen-push`,
Client-Aktivierung, Route `/morgen`, `modus=arbeit`.
**Verifizierter Stand:** `push_subscriptions` und `push_log` existieren **nicht**
(PGRST205), kein Service Worker im Repo, kein Push-Code. `site.webmanifest` und
Icons sind da — installierbar ja, Push ist Neubau.
**Abhängigkeiten:** **L2 zwingend zuerst** (sonst fährt `db push` acht Altmigrationen
erneut). Danach L1 (live), dann Kevins iPhone-Schritte.
**Zwei Korrekturen an der Blaupause:**
- Der Recon-Befund „Mobil-Grenze 900px vereinheitlicht (Etappe 2)" stimmt nur für
  die NavRail (`NavRail.tsx:36-39`). `hooks/useViewport.ts:24` steht weiter auf
  `w < 768` und speist `App.tsx`, `SalesDashboard.tsx`, `ContactPage.tsx`. Zug 6
  (Desktop-Redirect) und Zug 7 (`isMobile`-Weiche) hängen an **768** — siehe O10.
- Abbruchbedingung 2 („`db push` meldet Historie-Desync") ist **bereits eingetreten**.
*Herkunft: morgen-workflow.md · IDEAS-2026 A2 (Telegram — verworfene Alternative, siehe §5)*

### O4 · `last_message_at` wandert beim „Erledigt" nicht — **S**
Ein Haken auf ein fälliges Follow-up erhöht `followup_stage`, verschiebt aber den
Zeitstempel nicht (`useLinkedinThreads.ts:94` → `markDonePatch`). Die nächste Stufe
feuert dadurch zu früh, bis der Sync die echte Nachricht nachzieht.
**Abhängigkeit:** keine. Testskript `scripts/verify-linkedin-followups.ts` erweitern.
*Herkunft: Session-Inventur*

### O5 · Entwürfe überleben den nächsten Run nicht — **S**
`approvalDrafts.ts` bindet Entwürfe an einen lokalen Run; `approvalStatus.ts:9-14`
hält das selbst fest und verweist auf den Runs-Spiegel als Nachfolgeschritt.
**Der Runs-Spiegel ist inzwischen da** (Snapshot `runs`, 06.08.) — die Voraussetzung
für die Persistenz ist damit erfüllt.
**Abhängigkeit:** keine mehr.
*Herkunft: IDEEN „Konsistenz-Funde" · Session-Inventur*

### O6 · `linkedin_sync` umgeht den Doppellauf-Guard — **S** · Account-Risiko
`fuehreJobAus` (`runner/index.mjs:1108`) prüft nur bei `kind === 'agent_run'`, ob
schon etwas läuft (`:1123`). Der HTTP-Pfad hat den Guard (`:1531`), der Job-Pfad
nicht. Zwei parallele Voyager-Läufe auf Kevins Konto sind der teuerste denkbare
Fehler dieses Systems.
**Abhängigkeit:** keine. Drei Zeilen.
*Herkunft: IDEEN Abriss-Liste („Runner")*

### O7 · Vernetzungsanfragen als Posten in „Jetzt dran" — **S** (nur Desktop)
Die Spur `anfrage` ist in `prioritaet.ts` definiert (Rang 7), aber
`arbeitsmodusQuellen.ts` liefert keine Posten — tote Bahn. Der Zähler existiert als
Kachel (`SalesDashboard.tsx:476-486`), nicht als Posten.
**Gefährlichste Stelle:** Der Posten darf **nie** durch `erledigePosten` laufen,
sonst zählt `li_anfragen` doppelt. Er hat genau eine Aktion („Zähler öffnen").
**Abhängigkeit:** keine. Sinnvoll gemeinsam mit O3 (Etappe B des Wargames).
*Herkunft: IDEEN „Anfragen-Ritual" · morgen-workflow Zug 8. Identisch.*

### O8 · Ads-Review-Durchgang — **S** · hoch für die anstehende Arbeit
20 Reichentrog-Ads stehen auf „review", `cockpit/components/ads/AdDetailPanel.tsx`
hat kein Vor/Zurück (kein `onPrev`/`onNext` im File). Nötig: Pfeiltasten +
„Ad 7/20, 3 freigegeben".
*Herkunft: IDEEN „Nutzbarer"*

### O9 · Content-Manifest schließen — **M**
Der `weekly-content`-Agent baut Wochen-HTMLs, schreibt aber nie ins Manifest — sein
Prompt nennt nur `WEEKLY.md`, `backlog.md`, `log.md` (`runner/index.mjs:127-130`).
`content.json` enthält deshalb bis heute **genau einen** Post: `w29-5s-test`,
`plannedFor: 2026-07-21`, `status: scheduled` — seit sechs Wochen überfällig im
Default-Tab. Dazu: „Als gepostet markieren" wird gerendert, hat aber keinen
Schreiber.
**Erste Handlung (S):** Testpost entscheiden — löschen oder auf `posted` setzen.
**Danach (M):** Batch appendet seine 3 Posts.
*Herkunft: IDEEN „Nützlicher" · content-modul-mvp.md „Phase 2" · Session-Inventur*

### O10 · Ein Mobile-Breakpoint — **S**
`hooks/useViewport.ts:24` = `w < 768`, `NavRail.tsx:36-39` und `cockpit.css` = 900.
Dazwischen liegen zwei halbe Welten. Die NavRail wurde in Etappe 2 bewusst auf 900
gezogen, `useViewport` nicht.
**Abhängigkeit:** **vor O3** erledigen — Zug 6 und 7 des Morgen-Wargames verlassen
sich auf `isMobile`.
*Herkunft: IDEEN „Schöner"*

### O11 · Deliverable-Abnahme im Portal — **M**
„Freigeben / Änderungswunsch" pro Deliverable existiert nicht (kein Treffer in
`components/portal/`, `pages/portal/`). Zusammen mit dem bereits gebauten
Posteingang ist das die kürzeste Strecke zu „Kunden benutzen das Portal echt".
**Randbedingung:** CoLective und Reichentrog ruhen — der Nutzen fällt erst mit dem
nächsten Kunden an. Deshalb hier und nicht weiter oben.
*Herkunft: IDEEN „Nützlicher"*

### O12 · M2 zu Ende bringen: Sprache auch am Handy — **M**
Push-to-talk läuft über Web Speech (`useUrielVoice.ts:43-49`) und damit nur in
Chrome. Auf dem iPhone — Kevins Morgengerät — ist `sttSupported` false und der
🎤-Knopf unsichtbar (`UrielDock.tsx:625`).
**Zwei Wege:** entweder die Whisper-Variante aus dem Masterplan (Recorder →
Edge Function → Text), oder bewusst „Sprache ist Desktop" festschreiben und den
Knopf am Handy sauber erklären statt verschwinden zu lassen.
**Abhängigkeit:** keine. Entscheidung vor Bau.
*Herkunft: Masterplan M2 (Formulierung dort war falsch, siehe §2)*

### O13 · Kleinkram, gegen den Code geprüft — je **S**
Jeder Punkt einzeln bestätigt, keiner dringend, jeder kommt sonst zurück.

| Was | Beleg |
|---|---|
| Doppelte Zielverwaltung: `SalesGoalsDrawer` konkurriert mit dem neuen Monatsziel | `SalesMode.tsx:2470`, `hooks/useSalesPro.ts:747` |
| InMail-Credits hart im Code | `cockpit/lib/prioritaet.ts:99` (`INMAIL_CREDITS_STAND = 150`) |
| `useBrands`-Seed schreibt bei jedem Aufruf | `hooks/useBrands.ts:171/187/226/237` |
| `.ck-heute-grid` ohne `display: grid` (wird inline nachgepatcht) | `styles/cockpit.css:497-499` |
| `entwurfMoeglich` hart auf `true` | `cockpit/pages/LinkedinArea.tsx:459` und `:470` |
| Run-Drawer fällt auf Weiß zurück — `--ck-bg-1` und `--ck-danger` existieren nicht | `cockpit/pages/AgentsArea.tsx:200` und `:34`, keine Definition in `cockpit.css` |
| Agenten mit Pflicht-Input blind startbar (`loom-skript`, `followup-pdf` ohne Name/Website) | `cockpit/pages/AgentsArea.tsx:74` (`postRun(agent.id)` ohne Input) |
| Vault-Queue wächst unbegrenzt, `queued: []` hart | `runner/index.mjs:50`, `:407-412`, `:1755`; `:1191`, `:1460` |
| Pitch-Modus hängt am Namens-Suffix | `lib/projectAreas.ts` → `isPitchProject`, `components/portal/PortalShell.tsx:33` |
| `?preview=true` lädt Projekte aus localStorage | `pages/portal/PortalRoute.tsx:71-76` |
| `unread` wird für Threads gesynct, aber nie angezeigt | Spalte in 0058; kein Treffer in `cockpit/` |
| Snooze ohne Weg zurück — der `ruht`-Bucket ist unsichtbar | `linkedinFollowups.ts:61-62`, `LinkedinArea.tsx:346` (nur setzen) |
| Erstnachrichten: „Kopieren & Profil öffnen" als **ein** Griff | `components/ErstnachrichtenListe.tsx` — nur Website-Link (`:47`) |
| „Loom aufnehmen"-Link am Loom-Posten | `Arbeitsliste.tsx` — nur „Skript öffnen/generieren" (`:289-308`) |
| `markLoomVerschickt` wird von `/linkedin` nicht genutzt | nur `SalesDashboard.tsx:259` |
| iCal-Serientermine verschwinden ab Woche 2 (kein RRULE) | kein `RRULE` in `cockpit/lib/icalParse.ts` |
| Auto-getrackte Felder nicht als „auto" gekennzeichnet | kein Badge in `TrackingArea.tsx` |
| Ads-Dashboard zeigt vier leere KPI-Kacheln statt Review-Fortschritt | `AdsArea.tsx:123-126` (alle „—") |
| Nav-Icons ☑ ⚙ rendern auf iOS als bunte Emoji | `NavRail.tsx:20/29` |
| Beziehungs-Reminder „Still geworden" | kein `last_contact_at` in `cockpit/` |
| Umsatz per Uriel eintragen — `log_metric` kann nur zählen, nicht setzen; braucht ein eigenes `set_revenue` mit Setz-Semantik | `metrikFelder.ts` (umsatz bewusst ausgelassen), `useDailyMetrics.setUmsatzOn` |
| Call-Mode auf den echten Funnel stellen oder streichen | `SalesArea.tsx:18/58` — Sub-Tab existiert weiter |
| Website-CMS entscheiden: keine Kundenseite liest `site_content_published`, `site_content` = **0 Zeilen** — dabei auch die Projekt-Scopierung der Definer-View lösen (Funktion mit `project_id` statt offener View, siehe L3) | `0052_site_content.sql:108-112`, `lib/siteContentService.ts` |

### O14 · Sales-Subtabs restylen — **L** · nach der Call-Mode-Entscheidung
`pages/sales/SalesMode.tsx`: 2.504 Zeilen, **55** Glass-Treffer — die letzte große
Fläche der alten Optik. Sinnvoll erst, wenn entschieden ist, was von
Pipeline/Listen/Call-Mode/Kontakt überhaupt bleibt (O13, letzte Zeile).
*Herkunft: IDEEN „Schöner"*

### O15 · Hygiene — **S**
- ~~Worktree `sharp-lehmann-9787a0` auflösen~~ ✅ **erledigt 06.08.2026.** Von den acht
  uncommitteten Änderungen hatte Etappe 1 sechs identisch gemacht; die zwei mit
  eigenem Wert (`HANDOFF.md`, vier Warnhinweise in `docs/data-model.md`) sind mit
  diesem Backlog übernommen. Worktree und Branch `claude/sharp-lehmann-9787a0` sind
  entfernt. *Rest: der leere Ordner `.claude/worktrees/` kann weg.*
- **Duplikat-Ordner `cursor/` neben `.cursor/`** im Repo-Root — identischer Inhalt.
- **Vault:** `02 Projekte/Uriel.md` ist ein Stub vom 09.06. („Aktuell bei Migration
  0039–0043"). `[[ai-os-setup]]` wird im Masterplan zweimal verlinkt, existiert aber
  nicht — Dangling Link.

### O16 · Zwei Vorhaben aus Sessions, die nie in einem Doc landeten
- **LinkedIn als Kanal im Content-Bereich** (Session 21.07., „TODO 1"): Kanal
  `linkedin` + Editor + „Auf LinkedIn öffnen". Schätzung damals ~½ Tag. **M**
- **Morgen-Routine „neue LinkedIn-Kontakte → Erstnachricht"** (Session 21.07.,
  „TODO 2"): offene Entscheidung Variante A (halbautomatisch über Chrome) vs. B
  (täglicher Export). Weitgehend überholt durch `linkedin_erstnachrichten` (91
  Zeilen) und den Skill `linkedin-leads` — **vor dem Bauen prüfen, ob überhaupt
  noch etwas fehlt.** **S** für die Prüfung.

---

## 4 — Zurückgestellt

Nicht verworfen. Je mit der Bedingung, unter der es wieder aufwacht.

| Was | Grund | Wacht wieder auf, wenn |
|---|---|---|
| **Uriel-Core 24/7 auf eigenem Heimserver** (Masterplan M3, „Jarvis Phase D") | Kostet Geld, Zeitrahmen Wochen bis Monate. **Kein Hostinger:** Der LinkedIn-Sync läuft mit Session-Cookies — eine Rechenzentrums-IP erhöht das Sperr-Risiko für den wichtigsten Vertriebskanal. Ein Heimserver behält die vertraute IP. Bis dahin decken Selbstwecker (`pmset`) und `caffeinate` rund 95 % der Morgen ab. | Kevin die Hardware anschafft — oder der Selbstwecker sich im Alltag als unzuverlässig erweist |
| **Sprach-Satelliten + Wake-Word** (M4) und **Alexas abklemmen** (M5) | Kevin, 06.08.: „Das können wir erst mal vergessen, das ist nicht wichtig." ~250 € einmalig. | Nach dem Heimserver, frühestens |
| **Domain `uriel-os.de`** (~15 €/Jahr) | Entscheidung offen seit 19.07. Der Umzug ist eine eigene Mission — `leads+slug@frameworkos.de` hängt funktional an der alten Domain (`email-inbound`-Regex). | Kevin die Domain sichert; der Umzug bleibt davon getrennt |
| **Graph-Intelligenz** (IDEAS G1 Fluss-Ansicht, G3 Zentralität/Gap-Detection, G6 Graph-Erzähler) | Der Graph beantwortet heute „was ist angeschlossen". Die Steuerungsfragen beantwortet inzwischen das Sales-Dashboard besser. | Der Graph eine Frage beantworten soll, die keine Liste beantwortet |
| **Meta-Ads-API statt Manifest** | Schmerz-Regel: erst wenn echte Kampagnen laufen. 20 Ads stehen auf „review", keine läuft. | Die erste Kampagne live geht |
| **Uriel-MCP-Server** (IDEAS A5), **Event-Trigger** (A3), **Runner-Observability** (A4), **Skills-Registry** (A7) | Strukturell richtig, aber kein benannter Alltagsschmerz. | Ein konkreter Fall auftaucht — nicht vorher bauen (Foundation-Lektion) |
| **Booking-Anzahlung**, **Google-Calendar-Sync über iCal hinaus**, **wiederkehrende Tasks** | Kein Schmerz benannt; der iCal-Spiegel deckt den Kalender heute ab | No-Shows wirklich wehtun bzw. der iCal-Weg nicht mehr reicht |
| **MCP Apps, Agent-Payments, A2A** (IDEAS §3.7) | Beobachten, nichts bauen | — |

---

## 5 — Verworfen

Damit es nicht in drei Wochen als neue Idee zurückkommt.

| Was | Warum verworfen | Wann |
|---|---|---|
| **Hostinger-VPS als Uriel-Zuhause** | LinkedIn-Sync läuft mit Session-Cookies; Rechenzentrums-IP = Sperr-Risiko für den wichtigsten Vertriebskanal. Ersetzt durch Heimserver (§4). | 06.08.2026 |
| **Telegram-Bot / ntfy als Morgen-Kanal** | Dritte Plattform, kein Uriel-Erlebnis. Kanal ist Web Push in der installierten PWA (D1). ntfy bleibt nur Notfall-Rückfallebene, falls Web Push **und** Netlify Scheduled Functions scheitern. | 06.08.2026 |
| **Eigener Mobile-App-Build (nativ)** | Die PWA plus Push deckt den Fall. | 19.07. / bestätigt 06.08. |
| **Die alte Brand-Welt / 3D-Universe** | In Phase 6 abgerissen (Bundle −28 %), Etappe 4 hat den Rest entfernt. Kommt nicht zurück. Die Lektion steht in `IDEAS-2026.md:28`. | 07.07. / 04.08. |
| **Denk-Modi (Foundation, Building, Discovery-UI, Intelligence)** | Obsidian kann Denken besser. Arbeitsteilung: Vault = denken, Cockpit = tun. | 06.07. |
| **Semantische Embeddings im Graph** (IDEAS G5) | Overkill für ~100 aktive Notizen; Keyword-Scoring reicht und kostet nichts. | 07.07. |
| **Claude-Code-Terminal im Cockpit** | Die Chat-Blase deckt den Use Case ohne PTY-Komplexität. | 07.07. |
| **Google-Drive-Kundenanbindung** | Kein konkreter Workflow-Schmerz benannt (Foundation-Lektion). | 07.07. |
| **WhatsApp-MCP auf dem Haupt-Account** | Inoffiziell, Account-Risiko. | 19.07. |
| **Cold-Mail als Kanal** | Aus Tracking, Kanal-Antwortraten und Aggregaten entfernt (0055/0066). | 14.07. |
| **Kapazitäts-/Minutenrechnung im Sales-System** | Reihenfolge statt Portion — das System sagt, was als Nächstes dran ist, nicht wie viel Kevin heute darf. Abbruchbedingung 1 in `sales-arbeitsmodus.md`. | 29.07. |
| **NorthStar-Retainer-Zähler echt machen** (IDEAS H7) | Gegenstandslos: die NorthStarCard wurde beim Home-Refactor am 21.07. durch die `GoalCard` ersetzt. | 21.07. |
| **Sechs-Säulen-Meta-Systeme / Dream-Ausbau** | DreamCard bleibt klein und tut, was sie soll. | 07.07. |
| **Vault-Queue-Konzept** (`System/Queue` als Auftragsweg) | Der Ordner ist heute reines Debug-Protokoll; die echten Aufträge laufen über `runner_jobs` (0059). Aufräumen steht in O13. | 30.07. |

---

## Anhang — was aus den alten Dokumenten noch gilt

| Dokument | Was davon gilt |
|---|---|
| `IDEEN-2026-07-30-nutzbarkeit.md` | Das **Leitprinzip Klick-Ökonomie** (Arbeits- vs. Weg-Klicks, ≤ 2 Interaktionen bis zur ersten erledigten Einheit). Die Etappenliste ist abgearbeitet. |
| `IDEAS-2026.md` | Das **Postmortem §2** (fünf Lektionen) und die **Referenzprojekte**. Die Ideenliste §3 ist hier aufgelöst. |
| `AGENTIC-OS-PLAN.md` | Die **OsNebula-Regeln** (jeder Node klickbar, Graph beantwortet zwei Fragen) und „bewusst NICHT übernommen". Abnahme ist erfüllt. |
| `REBUILD-PLAN.md` | Das **Design-System §4** (Mission Control, verbindlich) und die **Regeln §11**. Bestandsaufnahme und Phasen sind Geschichte. |
| `wargames/morgen-workflow.md` | **Vollständig gültig** als Bauplan für O3 — mit den zwei Korrekturen aus O3. |
| `wargames/sales-arbeitsmodus.md` | Die **vier Gesetze**, das **Zielbild** (Stufen 2–5) und die Abbruchbedingungen. Züge 1–8 sind gebaut. |
| `wargames/linkedin-followups.md` | Die **Voyager-Feldkarte** und die drei Blätter-Fallen — das ist die Wartungsanleitung, wenn LinkedIn umbaut. |
| `wargames/sales-sektion.md` | Die **Fachregeln R7/R8** (5-Akt-Loom, Follow-up-PDF-Rubrik) als Prompt-Grundlage der beiden Agenten. |
| `wargames/content-modul-mvp.md` | Die **Randbedingung R4** (Slides nur per `src`, nie `srcDoc`) und die Phasen-Grenzen. |
| `wargames/rebrand-uriel.md` | Die **Ausnahmen-Tabelle** („explizit NICHT anfassen") — localStorage-Namespace `brand-os`, `frameworkos.de` im Lead-Eingang, Supabase-Ref. Weiter bindend. |
| `world-roadmap.md`, `phases.md` | **Historisch.** Beschreiben die Three.js-Welt vor dem Rebuild. |
| `data-model.md` | Gilt mit den vier Warnhinweisen, die mit diesem Stand übernommen wurden. |
| Vault: `Uriel – Masterplan.md` | Der **große Bogen** und die Begründungen (Privacy, Wake-Word-Architektur). Der Meilenstein-Stand steht hier. |
