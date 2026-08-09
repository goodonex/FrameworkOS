# Uriel — Backlog (die eine Quelle der Wahrheit)

**Stand:** 2026-08-09 · Branch `cockpit-rebuild` · Repo `~/Kevin OS/02 Projekte/uriel`

**Runde vom 09.08., zweiter Teil** (Planung, kein Code): Phase-1-Blaupause
**Technik-Fundament** fertig — `docs/wargames/technik-fundament.md` (Züge 0–12,
D1–D10, blind ausführbar; deckt O8, O9, O11, L3/L6/L7 und den belegten
O13-Kleinkram; O14 wandert bewusst in die Ästhetik-Phase). Danach folgt Phase 2
„haptisch geil" mit eigenem Wargame.

**Runde vom 09.08.** (Umsetzung): Der **Mobile Homescreen steht und ist live** —
Züge 0–7 der Blaupause gebaut (zehn Code-Commits, dazu die Doku), alle 20
verify-Skripte grün, Desktop nachweislich unverändert, Fast-Forward erfolgt
(L1). Drei Abweichungen von der Blaupause und zwei ältere Fehler, die dabei
auffielen, stehen bei **O18** — dort ist nichts mehr offen, die Notch-Abnahme
am Geraet hat Kevin gegeben. Erledigt: O18.

**Runde vom 07.08.** (O17 + O3): Die Morgen-Agenten laufen wieder — die Ursache
war der schlafende Mac, nicht der Timeout. Darauf aufbauend der Morgen-Push:
Etappen A und B des Wargames sind gebaut, Migration 0067 ist eingespielt, die
Edge Function deployt. **Nicht live** — der Fast-Forward und die iPhone-Schritte
stehen aus (siehe O3). Erledigt: O17, O3, O7.

**Runde vom 08.08.** (Planung, kein Code): Mobile Homescreen geplant — **O18**,
Blaupause `docs/wargames/mobile-homescreen.md` (Widget-first, blind ausführbar).

**Runde vom Abend des 06.08.** (Vorbereitung der Mobile-Session): O1, O2, O4, O5,
O6, O10, O13 (drei Punkte), O15 erledigt · L5b, O9 (erste Handlung) und O12
entschieden. Alles committet, nichts davon live. Nicht angefasst und weiter offen:
O3, O7, O8, O11, O14, O16 und der Rest von O9/O13.

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
**Abends dazugekommen:** `npm run build` (tsc + Vite) und **18 verify-Skripte** nach
jedem Schritt · `curl https://frameworkos.de/` für das ausgelieferte Bundle ·
localStorage-Abgleich im laufenden Chrome · gemessene CSS-Tokens im laufenden Build.
Nicht verifizierbar ohne Docker/SQL-Zugang: Sichtbarkeitsregeln (`security_invoker`)
und Policy-Details in der Prod-DB.
**07.08. nachgeholt:** Kevin hat eingeloggt, das Cockpit lief am Dev-Server. Damit
sind O1 (Cache = 44 = Server, kein Tombstone-Key, keine Nur-Lese-Meldung), O2/O5
(Queue über mehrere Läufe, 25 → 24 Karten), O10 (880 px = Bottom-Bar + Arbeitsmodus,
920 px = Rail, ohne Arbeitsmodus), O12 (Knopf abgeschaltet mit Erklärung, nachdem
Web Speech entfernt wurde) und O13 (Drawer `rgb(11,14,16)`, Fehler `rgb(229,72,77)`)
**am laufenden System** geprüft. Dabei fielen das Grenz-Loch in O2 und O17 auf.
*Test-Artefakt, kein Befund:* Bei einer Größenänderung im Hintergrund-Tab folgt
`useViewport` nicht — `document.visibilityState` ist dort `hidden` und
`requestAnimationFrame` feuert nicht. Im sichtbaren Fenster greift es.

---

## 1 — Livegang

Alles hier steht zwischen dem heutigen Code und „läuft in Produktion".
**Etappen 1–4 sind seit dem 06.08. live, der Mobile Homescreen seit dem 09.08.** (L1).
`main` hat keinen eigenen Commit — der Livegang bleibt ein Fast-Forward, kein Merge.
Was in diesem Abschnitt abgehakt ist, ist wirklich in Produktion; die Edge Functions
(L4, L5) deployen unabhängig vom Frontend und sind es bereits.

### L1 · ~~Fast-Forward~~ ✅ **alles live, auch der v2-Ausbau (09.08.)**
`git log --oneline origin/main..main` = leer. Netlify liefert
`index-DXkj1tps.js`; im ausgelieferten Bundle sind alle sieben v2-Marken
nachweisbar („Nacht-Routinen", `ck-widget-stack`, „Anordnen", „→ morgen",
„Schnell-Aktionen", `ui_settings`, `kachelReihenfolge`) — es ist wirklich der
neue Code, nicht nur ein neuer Hash. Migration 0068 war schon vorher
eingespielt, die Tabelle wird jetzt auch benutzt.

### ~~Fast-Forward Homescreen~~ ✅ **live seit 09.08.**
Kevin hat fast-forwarded: `main` == `cockpit-rebuild` == `bf4d50d`,
`git rev-list --count origin/main..cockpit-rebuild` = 0. Netlify liefert
`index-DjbHPMcW.js`; der Bundle enthaelt nachweislich den neuen Code (per
`curl` auf die Datei gegen die Zeichenketten "Suchen und springen",
"Bibliothek", "Termine heute — Kalender oeffnen" geprueft, je 1 Treffer).
Der Hash weicht von einem lokalen `npm run build` ab — normal, Netlify inlined
seine eigenen `VITE_*`-Werte.
Was jetzt live ist: Zuege 0–7 aus O18 **plus** der Morgen-Push aus O3, der seit
dem 07.08. mitfuhr. Der Text darunter beschreibt den Zwischenstand vom 06.08.
und bleibt als Historie stehen.
`main` steht auf `de60288` und ist gepusht — der Fast-Forward aus dem
vorherigen Stand dieses Dokuments **ist erfolgt**. Netlify hat neu gebaut:
ausgeliefert wird `index-BjbadBHB.js` (vorher `index-CvTize-3.js`, geprueft per
`curl https://frameworkos.de/`). Damit ist auch der `send-email`-Deep-Link-Fix
regulaer auf `main`, die dokumentierte Drift ist aufgeloest.

**Noch nicht live: die Aufraeum-Runde vom Abend des 06.08.** — `6a8d605` (O2),
`22d454a` (O1), `bc07a63` (O10), `57663f2` (O6), `6b8e4a5` (O4/O5), `e1ce382` (O13),
`74ad91f` (O15) und die Entscheidungs-Commits danach. **Eine Anzahl steht hier
bewusst nicht**: sie waere ab dem naechsten Commit falsch. Verbindlich ist
`git log --oneline main..cockpit-rebuild`.

**Vor dem naechsten Livegang:** einmal in der Netlify-UI pruefen, welcher Branch als
Production eingestellt ist — `netlify.toml` legt ihn nicht fest. Der Rebuild auf
`de60288` ist ein starkes Indiz fuer `main`, aber kein Beleg (**ungeprueft**).
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

### L5b · ~~Drei weitere Functions sind nicht deployt~~ ✅ **entschieden 06.08.2026**
Von 15 Functions im Repo waren 11 live. Nach `invite-client` (L5) blieben drei —
**alle drei werden nicht deployt, sondern gestrichen bzw. bleiben tot.**

| Function | Entscheidung |
|---|---|
| **`email-inbound`** | **Gestrichen (Kevin, 06.08.).** Der Outreach laeuft ueber LinkedIn; die Adresse tauchte nur als BCC-Hinweis auf der Kontaktseite auf. **Beleg:** `sales_email_logs` hat 7 Zeilen, **alle `outbound`, keine einzige `inbound`** — ueber diesen Weg ist nie etwas angekommen. Entfernt wurden `supabase/functions/email-inbound/` und `components/sales/ContactBccHint.tsx` samt Einbindung in `ContactPage`. Beides zusammen, sonst verspraeche der Hinweis eine Protokollierung, die es nicht mehr gibt. |
| `discovery-agent` | bleibt undeployt — die zugehoerige UI ist in Phase 6 geloescht |
| `discovery-feed-refresh` | dito |

**Nebenwirkung, die zaehlt:** Der Warnhinweis aus `wargames/rebrand-uriel.md`
(„`frameworkos.de` im Lead-Regex nicht anfassen") ist damit gegenstandslos. Der
Domain-Umzug auf `uriel-os.de` haengt nicht mehr an einem funktionalen
Lead-Eingang — die Zurueckstellung in Abschnitt 4 ist entsprechend entschaerft.

**Nicht von hier geprueft:** ob in Resend ueberhaupt ein Inbound-Webhook auf die
Adresse zeigt. Falls ja, fielen die Mails schon vorher ins Leere (die Function war
nie deployt) — das Streichen verliert also nichts. Wer das sauber abschliessen
will, loescht den Webhook im Resend-Dashboard.

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

### O1 · ~~`useContacts` hält Kontakte doppelt~~ ✅ **entdoppelt 06.08.2026**
Supabase ist die einzige Wahrheit, localStorage nur noch Lese-Cache.

**Die Zahl, die vorher fehlte — 0.** Vor dem Umbau geprüft (Kevins Chrome,
`brand-os:herrmann:contacts` gegen die Prod-DB): **44 im localStorage, 44 in
Supabase, dieselben 44 IDs**, kein Eintrag nur auf einer Seite. Den
Tombstone-Schlüssel `contacts-deleted-ids` gab es gar nicht. Damit war es
Aufräumen, keine Migration — hätte auch nur ein Lead ausschließlich lokal
gelegen, wäre der Umbau erst nach einer Übernahme erlaubt gewesen.
*Grenze der Prüfung:* geprüft ist der Browser, in dem das Cockpit benutzt wird.
Ein abweichender Stand auf einem anderen Gerät wird beim nächsten Laden dort
verworfen — genau der Geister-Mechanismus, den der Umbau abstellt.

**Was gefallen ist**
| Baustein | vorher | jetzt |
|---|---|---|
| `enrichContactFromLocal` (Feld-für-Feld-Merge) | 46 Zeilen | weg |
| Resurrect: lokale Zeile ohne Server-Gegenstück wandert in die Liste | `reload` | weg — `setItems(serverRows)` |
| Tombstones `contacts-deleted-ids` + drei Helfer | nötig gegen Resurrect | weg |
| `localOnlyRef` („ab jetzt ist der Browser die Wahrheit") | schrieb still ins localStorage | ersetzt durch `readOnly` = „Server antwortet nicht, nur gucken" |
| `create` schrieb optimistisch, Insert-Fehler ließ den Geist stehen | ja | erst Insert, dann anzeigen; Fehler → `{ ok: false, error }` |
| `remove` löschte lokal + Tombstone | ja | erst Server, dann Liste; scheitert sichtbar |

**Neu im Hook-Ergebnis:** `readOnly`. Solange es true ist, lehnen create/update/
remove ab und setzen eine Meldung, statt eine zweite Wahrheit aufzubauen.
`CreateContactResult` hat dafür eine dritte Variante `{ ok: false, error }` —
`syncWarning` ist weg, weil „lokal gespeichert, Sync später" nicht mehr existiert.

**Drift-Wache:** `scripts/verify-contacts-quelle.ts`, 14 Prüfungen — schlägt an,
sobald einer der Bausteine zurückkommt.

**Offen für Kevin (nicht von hier prüfbar):** ein manueller Durchlauf der
Pipeline-Flows (Lead anlegen, Stage ziehen, löschen) mit Session im Browser.
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

**⚠ Nachtrag 07.08., am eingeloggten Cockpit gefunden — die Grenze hatte ein Loch.**
`dueFollowupContacts` filtert nur, **was der Agent als Eingabe sieht**. Die Karten in
der Queue kommen aber aus dem Run-Markdown, und seit O5 aus den letzten fünf Läufen.
Ein Entwurf, den der Agent **vor** der Entscheidung für Franz & Köhler gebaut hatte,
stand damit wieder da — inklusive „Freigeben & senden". O5 hatte die Lücke sogar
vergrößert, weil ältere Läufe jetzt mitgelesen werden.
**Fix:** dieselbe Grenze ein zweites Mal beim **Anzeigen** — `darfFollowupErhalten`
(`approvalDrafts.ts`), angewendet in `FreigabenArea` auf jede Karte mit CRM-Kontakt.
Entwürfe ohne `contact_id` sind LinkedIn-Threads und bleiben unangetastet.
**Gemessen im laufenden Cockpit:** 25 Karten vorher, 24 nachher; Franz & Köhler weg,
die vier Kunden/Deal-Karten (Detti, Bestgen, Hinsch, Develo) stehen.
**Lehre:** Eine Regel, die nur an der Erzeugung hängt, gilt nicht für Daten, die
vor ihr entstanden sind. Wo Historie mitgelesen wird, muss die Regel auch beim Lesen
greifen.

**Bewusst nicht gemacht:** Die 36 Recherche-Leads bleiben unverändert in `contacts`
liegen (Kevins Entscheidung 06.08.). Sie stören die Pipeline-Optik, nicht die Queue.
Aufräumen wäre ein eigener Schritt mit Blick auf die Namen — kein Nebenbei-Löschen.
*Herkunft: IDEEN „Das große Bild #2" + Abriss-Liste · Session-Inventur*

### O3 · ~~Morgen-Push aufs Handy~~ ✅ **gebaut 07.08. · live + eingerichtet 08.08.2026**
Etappen A und B des Wargames (Züge 1–9) sind gebaut und geprüft. Der Push kann
erst ankommen, wenn der Code live ist und Kevin sein iPhone einmal einrichtet —
siehe „Was noch fehlt".

| Zug | Was | Beleg |
|---|---|---|
| 1 | Service Worker `app/public/sw.js` — **nur Push, kein Cache** (kein `fetch`-Handler, kein Cache-API-Aufruf, bewusst kein vite-plugin-pwa) | Im Browser: eine Registrierung, Zustand `activated`, **Cache Storage leer** |
| 2 | Migration 0067: `push_subscriptions` (unique `endpoint`), `push_log` (`datum` als PK = die Sperre gegen den zweiten Push), zwei Cron-Zeilen 5:00/6:00 UTC | `migration list` 0067 in Local *und* Remote; `cron.job` zeigt beide, aktiv |
| 3 | VAPID-Paar + `CRON_KEY` als Supabase-Secrets, `project_url`/`cron_key` im Vault, `VITE_VAPID_PUBLIC_KEY` in Netlify und `.env.local` | `supabase secrets list`, `select name from vault.secrets` |
| 4 | Edge Function `morgen-push` (`verify_jwt = false`, Zugang per `x-cron-key` oder User-JWT + `test:true`) | deployt; ohne Key **401**, mit Key außerhalb der Stunde `{"skipped":"falsche-stunde"}`, mit `test:true` voller Durchlauf |
| 5 | `pushClient.ts` + `Benachrichtigungen.tsx` auf `/morgen` und im Mehr-Sheet | `requestPermission` nur im onClick-Pfad; im iPhone-Safari statt eines toten Knopfes der Satz „Teilen → Zum Home-Bildschirm" |
| 6 | Route `/morgen` — Vollbild am Handy, Desktop leitet auf `/cockpit` um | bei 390×664 vollständig sichtbar, „Loslegen" tippbar; bei 1280 px Umleitung |
| 7 | `?modus=arbeit` öffnet am Handy direkt den Arbeitsmodus | Klick auf „Loslegen" → Dialog „Arbeitsmodus", Posten 1/2 |
| 8 | Anfragen-Posten (= **O7**), nur Desktop, genau eine Aktion | siehe O7 |
| 9 | „Loom aufnehmen" am Loom-Posten, echter Link statt `window.open` | im Aktionsblock |

**RECON-1 vorab entschieden:** `jsr:@negrel/webpush` läuft in Deno — lokal gegen
einen Fake-Push-Dienst geprüft, die Anfrage trägt `Authorization: vapid t=<ES256-JWT>`
und `Content-Encoding: aes128gcm`. **Route B (Netlify Scheduled Function) wird
nicht gebraucht.**

**D5 in freier Wildbahn:** Der Probe-Push wählte am 07.08. von selbst die
Variante „N Posten warten — MacBook aufklappen", weil die Nacht-Analyse
tatsächlich ausgefallen war (O17). Genau dafür wurde die zweite Stufe gebaut.

**Bewusst nicht gebaut:** `/dev/morgen-vorschau`. Der Zweck der Dev-Vorschau ist,
die Seite ohne Session sehen zu können — mit Kevins Login war die echte Seite
prüfbar, und eine zweite Fassung mit Fixtures wäre ab dem ersten Umbau falsch.

**✅ Aktivierung komplett — 08.08. abends gegen das laufende System verifiziert:**
1. **Live:** `git log origin/main..HEAD` = 0 (main == cockpit-rebuild), Netlify
   liefert `index-DAnoKYfk.js`; `/sw.js` kommt als `application/javascript` mit
   dem Push-only-Worker (per `curl` gegen frameworkos.de geprüft).
2. **Push-Abo:** genau 1 Zeile in `push_subscriptions` (angelegt 08.08.
   20:47 UTC). `push_log` ist leer — planmäßig: seit dem Abo gab es noch keinen
   7-Uhr-Werktags-Lauf.
3. **Selbstwecker steht:** `pmset -g sched` → „wakepoweron at 5:58AM weekdays
   only" (5:58 statt 5:50 — reicht, liegt vor den 6:00-Routinen).
4. **Runner läuft mit neuem Code:** Prozessstart 07.08. 17:30, der
   caffeinate-Commit `f1d270a` war 15:20 — Kickstart ist erfolgt.

**Erster echter Push: Montag ~7:00** (Cron Mo–Fr + Wecker werktags — dass am
Wochenende nichts kommt, ist kein Fehler). Kommt Montag keiner:
`select * from cron.job_run_details order by start_time desc limit 5` und
`select * from push_log` sagen, welche Stufe geschwiegen hat. Sollte das eine
Abo vom Mac-Test stammen statt vom iPhone: am iPhone `/morgen` →
„Benachrichtigungen aktivieren" (Upsert auf `endpoint`, zweites Gerät ist ok).
*Herkunft: morgen-workflow.md · IDEAS-2026 A2 (Telegram — verworfen, siehe §5)*

### O4 · ~~`last_message_at` wandert beim „Erledigt" nicht~~ ✅ **erledigt 06.08.2026**
`markDonePatch` (`cockpit/lib/linkedinFollowups.ts`) setzt im Stufen-Zweig jetzt
`last_message_at` auf jetzt und `last_from` auf `me`.

**Warum das ein echter Fehler war, kein Schönheitsfehler:** `isDue` rechnet die
Frist der nächsten Stufe ab `last_message_at`. Blieb der auf der alten Nachricht
stehen, zählten die bereits verstrichenen Tage doppelt — ein Thread mit 5 Tage
alter Nachricht ging auf Stufe 1 (Schwelle 7 Tage) und war nach 2 weiteren Tagen
wieder fällig statt nach 7. Der Antwort-Zweig machte es längst richtig (`:121`),
nur der Stufen-Zweig nicht.

`last_from` wird mitgesetzt, weil dieser Zweig auch `unknown` erwischt (Bucket
„prüfen") — nach dem Haken hat Kevin geschrieben, das ist keine offene Frage mehr.

**Neu geprüft:** `scripts/verify-linkedin-followups.ts` Abschnitt 14 —
62 Fälle grün, darunter „nach 3 Tagen noch nicht fällig, nach 8 wieder".
*Herkunft: Session-Inventur*

### O5 · ~~Entwürfe überleben den nächsten Run nicht~~ ✅ **erledigt 06.08.2026**
`FreigabenArea` liest nicht mehr nur den jüngsten Lauf, sondern die **letzten
fünf** Entwurfs-Runs über den Runs-Spiegel (der hält Liste *und* Inhalt der
letzten 20 Läufe vor — `runner/index.mjs` → `pushRunsSnapshot`, gelesen über
`runnerApi.fetchRun`, das auf der HTTPS-Domain ohnehin den Spiegel nimmt).

**Was das löst:** Ein Entwurf, den Kevin nicht bearbeitet hat, verschwand, sobald
der Agent erneut lief — er stand danach nirgends mehr, obwohl das Follow-up offen
war. Jetzt bleibt er stehen, bis er abgehakt ist.

**Die Falle dabei — Dubletten.** Der Agent baut den Entwurf für denselben Lead in
jedem Lauf neu. Ohne Zusammenführung stünde derselbe Mensch fünfmal in der Liste.
`draftIdentitaet` (`approvalDrafts.ts`) fasst zusammen über `thread_key` →
`contact_id` → Name, **nicht** über den Nachrichtentext: der ändert sich bei jedem
Lauf. Gelesen wird von neu nach alt, der jüngere Text gewinnt.

| Detail | Regel |
|---|---|
| Abgeschlossene Karten älterer Läufe | fallen weg; nur der jüngste Lauf zeigt auch Erledigtes als Beleg |
| Status-Persistenz | an den Run **der Karte** (`card.runId`), nicht an den jüngsten |
| `sales_email_logs`-Abgleich | Fenster beginnt beim ältesten geladenen Run statt beim jüngsten |
| `KEEP_RUNS` in `approvalStatus.ts` | 5 → 10, damit ein „erledigt" auf einem älteren Lauf keinen jüngeren aus dem Speicher drängt |

**Bewusst nicht gemacht:** der Status wandert **nicht** in den Spiegel. Den
schreibt der Runner und überschreibt ihn bei jedem Lauf — ein „erledigt" aus dem
Browser wäre beim nächsten Push weg. Eine eigene Tabelle wäre richtig, kostet aber
eine Migration und kollidiert mit der für O3 vorgesehenen 0067. Das gehört in
dieselbe Runde wie der Morgen-Push, nicht davor.

**Neu geprüft:** `scripts/verify-entwuerfe.ts` Abschnitt 9 (8 Fälle, u. a. „Cem
überlebt den nächsten Run" und „Anna steht genau einmal da").
*Herkunft: IDEEN „Konsistenz-Funde" · Session-Inventur*

### O6 · ~~`linkedin_sync` umgeht den Doppellauf-Guard~~ ✅ **geschlossen 06.08.2026**
Der Job-Pfad in `fuehreJobAus` (`runner/index.mjs`) prüft jetzt dasselbe Flag
`linkedinSyncRunning` wie der HTTP-Pfad, setzt es und gibt es im `finally` wieder
frei. Ein Auftrag aus `runner_jobs` und ein Klick im Cockpit können nicht mehr
gleichzeitig durch die Voyager-API laufen.

`finally` ist dabei kein Stil, sondern Pflicht: bliebe das Flag nach einem
Abbruch stehen, wäre der Sync bis zum Neustart des Runners tot — ein stiller
Ausfall des wichtigsten Vertriebskanals wäre schlimmer als der Doppellauf.

**Drift-Wache:** `scripts/verify-runner-guards.ts`, 8 Prüfungen (u. a. dass der
Guard *vor* `syncThreads` steht und beide Pfade dasselbe Flag benutzen).
Strukturell, nicht laufend — der Runner startet beim Import einen Server und
pollt Supabase, ein echter Aufruf von `fuehreJobAus` ist von außen nicht ohne
Seiteneffekte möglich.
*Herkunft: IDEEN Abriss-Liste („Runner")*

### O7 · ~~Vernetzungsanfragen als Posten in „Jetzt dran"~~ ✅ **gebaut 07.08.2026**
Der Posten entsteht **synthetisch im Dashboard**, nicht in `arbeitsmodusQuellen`
— seine Quelle ist `daily_metrics.li_anfragen`, es gibt keine Zeile zum
Abhaken. Sichtbar nur am Desktop (D6) und nur, solange das Tagesziel offen ist;
er verschwindet von selbst, wenn der Zähler es sagt.

**Die gefährlichste Stelle, mit drei Sperren statt einer.** `metrikFeldFuer('anfrage')`
ist `li_anfragen` — liefe der Posten durch `erledigePosten`, zählte `bump()` oben
auf den Zähler, und seit dem 06.08. schreibt `log_metric` auf dieselbe Spalte.
Deshalb:
1. `Posten.nurZaehler` als Marker,
2. `erledigePosten` bricht bei diesem Marker **vor allem anderen** ab — kein
   `bump`, keine Dauer; als erste Zeile, nicht als Sonderfall im `switch`,
3. `oeffneArbeitsmodus` filtert solche Posten heraus, damit **kein Aufrufer** es
   vergessen kann (im Vollbild gibt es nur „Erledigt").

In der Liste hat er genau eine Aktion: **Zähler öffnen**.

**Geprüft:** `scripts/verify-arbeitsmodus-tracking.ts` 23/23 — inklusive
Gegenprobe, dass derselbe Posten *ohne* Marker sehr wohl zählen würde (sonst
bewiese der Test nur, dass gerade nichts passiert). Im laufenden Cockpit bei
1280 px: „Vernetzungsanfragen: noch 30 von 30", aufgeklappt ein einziger Knopf.
*Herkunft: IDEEN „Anfragen-Ritual" · morgen-workflow Zug 8*

### O8 · Ads-Review-Durchgang — **S** · hoch für die anstehende Arbeit
20 Reichentrog-Ads stehen auf „review", `cockpit/components/ads/AdDetailPanel.tsx`
hat kein Vor/Zurück (kein `onPrev`/`onNext` im File). Nötig: Pfeiltasten +
„Ad 7/20, 3 freigegeben".
*Herkunft: IDEEN „Nutzbarer"*

### O9 · Content-Manifest schliessen — **M** · *Testpost erledigt, Rest offen*
Der `weekly-content`-Agent baut Wochen-HTMLs, schreibt aber nie ins Manifest — sein
Prompt nennt nur `WEEKLY.md`, `backlog.md`, `log.md` (`runner/index.mjs:127-130`).
Dazu: „Als gepostet markieren" wird gerendert, hat aber keinen Schreiber.

**✅ Erste Handlung erledigt (06.08.2026):** Der Testpost `w29-5s-test`
(„Der 5-Sekunden-Test", `scheduled`, geplant fuer den 21.07., seit sechs Wochen
ueberfaellig im Default-Tab) ist **geloescht** — Kevins Entscheidung, weil der Post
nie auf Instagram stand. Ihn auf `posted` zu setzen haette eine Falschmeldung in die
Content-Historie geschrieben. `content.json` hat jetzt `posts: []`; die Slide-Datei
`weekly/2026-W29/posts/post-01-fuenf-sekunden-test.html` bleibt liegen.

**Offen (M):** Der Batch muss seine 3 Posts anhaengen, und „Als gepostet markieren"
braucht einen Schreiber. Bis dahin ist das Manifest leer — was ehrlicher ist als ein
einzelner ueberfaelliger Testeintrag, aber noch kein Content-Modul.
*Herkunft: IDEEN „Nuetzlicher" · content-modul-mvp.md „Phase 2" · Session-Inventur*

### O10 · ~~Ein Mobile-Breakpoint~~ ✅ **vereinheitlicht 06.08.2026**
`MOBILE_MAX_WIDTH = 900` und `MOBILE_MEDIA_QUERY` stehen jetzt in
`hooks/useViewport.ts` und werden importiert, statt abgetippt. Inklusiv wie in
CSS: `isMobile` ist `w <= 900`, deckungsgleich mit `@media (max-width: 900px)`.

| Stelle | vorher | jetzt |
|---|---|---|
| `useViewport.ts` | `w < 768`, `isTablet` ab 768 | `w <= MOBILE_MAX_WIDTH`, `isTablet` ab 901 |
| `NavRail.tsx` | `matchMedia('(max-width: 900px)')` zweimal abgetippt | `MOBILE_MEDIA_QUERY` |
| `CockpitHome.tsx` (Graph-Höhe) | `innerWidth < 900` | `<= MOBILE_MAX_WIDTH` |
| `cockpit.css` | 3 × `max-width: 900px` | unverändert — der einzige Ort, der nicht importieren kann |

**Konsumenten geprüft:** `App.tsx:157` hält nur den Listener (keine Wirkung).
`SalesDashboard.tsx` zeigt zwischen 768 und 900 jetzt ebenfalls „Arbeitsmodus
starten" im Fenster-Fuß und den Anfragen-Zähler als Vollbild — dieselbe Breite,
in der die Bottom-Bar schon steht. `ContactPage.tsx` und `ContactOverviewPanel.tsx`
gehen dort auf eine Spalte statt auf `380px + Rest`, was bei ~850 px eng war.
`isTablet`/`isDesktop` sind nirgends in Gebrauch (geprüft).

**Bewusst nicht angefasst:** `pages/portal/portal.css` schaltet bei 768. Das
Kundenportal ist eine eigene Oberfläche mit eigenem Layout — die Cockpit-Grenze
gilt dort nicht. Die Drift-Wache klammert es ausdrücklich aus.

**Drift-Wache:** `scripts/verify-breakpoint.ts`, 8 Prüfungen — schlägt an, sobald
irgendwo in `app/src` wieder eine Pixelzahl abgetippt wird.
*Herkunft: IDEEN „Schöner"*

### O11 · Deliverable-Abnahme im Portal — **M**
„Freigeben / Änderungswunsch" pro Deliverable existiert nicht (kein Treffer in
`components/portal/`, `pages/portal/`). Zusammen mit dem bereits gebauten
Posteingang ist das die kürzeste Strecke zu „Kunden benutzen das Portal echt".
**Randbedingung:** CoLective und Reichentrog ruhen — der Nutzen fällt erst mit dem
nächsten Kunden an. Deshalb hier und nicht weiter oben.
*Herkunft: IDEEN „Nützlicher"*

### O12 · ~~M2 zu Ende bringen: Sprache auch am Handy~~ ✅ **entschieden 06.08.2026**
**Entscheidung Kevin: „Sprache ist Desktop."** Push-to-talk laeuft ueber Web Speech
(`useUrielVoice.ts:43-49`) und damit nur in Chrome. Die Whisper-Variante aus dem
Masterplan wird **nicht** gebaut.

**Was stattdessen gebaut wurde (S):** Der 🎤-Knopf verschwand am iPhone und in Safari
kommentarlos (`UrielDock.tsx`, `sttSupported ? … : null`) — man sah, dass etwas fehlt,
aber nicht warum. Jetzt steht er dort abgeschaltet und erklaert sich im `title`:
„Sprache laeuft ueber die Web-Speech-Schnittstelle und gibt es nur in Chrome am
Rechner. Am iPhone und in Safari tippen."

**Wacht wieder auf, wenn:** der Morgen-Push (O3) steht und Kevin morgens
tatsaechlich ins Handy sprechen will. Vorher gibt es am Handy gar keinen
Morgen-Flow, in den die Sprache hineingehoerte. Der Bauweg bleibt der aus dem
Masterplan: Recorder → Edge Function → Text.
*Herkunft: Masterplan M2 (Formulierung dort war falsch, siehe §2)*

### O13 · Kleinkram, gegen den Code geprüft — je **S**
Jeder Punkt einzeln bestätigt, keiner dringend, jeder kommt sonst zurück.

| Was | Beleg |
|---|---|
| Doppelte Zielverwaltung: `SalesGoalsDrawer` konkurriert mit dem neuen Monatsziel | `SalesMode.tsx:2470`, `hooks/useSalesPro.ts:747` |
| InMail-Credits hart im Code | `cockpit/lib/prioritaet.ts:99` (`INMAIL_CREDITS_STAND = 150`) |
| `useBrands`-Seed schreibt bei jedem Aufruf | `hooks/useBrands.ts:171/187/226/237` |
| ~~`.ck-heute-grid` ohne `display: grid`~~ ✅ 06.08. — `display: grid` + `gap` ergänzt. Befund präzisiert: die Klasse wird von **keiner** Komponente benutzt (HeuteDeck v2 rendert eine Liste), sie war also nicht „inline nachgepatcht", sondern eine stille Nulloperation. Bleibt korrekt stehen für den Mobile-Umbau | `styles/cockpit.css` |
| `entwurfMoeglich` hart auf `true` | `cockpit/pages/LinkedinArea.tsx:459` und `:470` |
| ~~Run-Drawer fällt auf Weiß zurück~~ ✅ 06.08. — `--ck-bg-1` (Alias auf `--ck-panel`, zieht im Hell-Modus automatisch mit) und `--ck-danger` (#e5484d dunkel / #b42318 hell) definiert, die `var(--x, fallback)`-Krücken in AgentsArea entfernt. **Im laufenden Build gemessen:** Drawer `rgb(11,14,16)` statt Weiß, Fehlerfarbe `rgb(229,72,77)`; im Hell-Modus `#ffffff` / `#b42318` | `styles/cockpit.css`, `cockpit/pages/AgentsArea.tsx` |
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
| ~~Nav-Icons ☑ ⚙ rendern auf iOS als bunte Emoji~~ ✅ 06.08. — beide tragen jetzt U+FE0E (Variation Selector-15, Text-Variante), dazu `font-variant-emoji: text` auf `.ck-nav-icon`. Bewusst kein Zeichentausch: alle anderen Icons sind Geometric Shapes, ein fremdes Zeichen hätte Tofu riskiert. **Nicht von hier prüfbar** — braucht einen Blick auf echtem iOS | `NavRail.tsx`, `styles/cockpit.css` |
| Beziehungs-Reminder „Still geworden" | kein `last_contact_at` in `cockpit/` |
| **Neu 07.08.:** Kundenarbeit-Posten zeigen „Seit **Infinity** Tagen keine Bewegung" — eine Division ohne Datum. Im Arbeitsmodus gesehen, Posten „Reichentrog & Kollegen GmbH" | `cockpit/lib/kundenarbeit.ts` (Tage-Berechnung ohne Fallback) |
| Umsatz per Uriel eintragen — `log_metric` kann nur zählen, nicht setzen; braucht ein eigenes `set_revenue` mit Setz-Semantik | `metrikFelder.ts` (umsatz bewusst ausgelassen), `useDailyMetrics.setUmsatzOn` |
| Call-Mode auf den echten Funnel stellen oder streichen | `SalesArea.tsx:18/58` — Sub-Tab existiert weiter |
| Website-CMS entscheiden: keine Kundenseite liest `site_content_published`, `site_content` = **0 Zeilen** — dabei auch die Projekt-Scopierung der Definer-View lösen (Funktion mit `project_id` statt offener View, siehe L3) | `0052_site_content.sql:108-112`, `lib/siteContentService.ts` |

### O17 · ~~Die Morgen-Agenten laufen ins Timeout~~ ✅ **behoben 07.08.2026**
**Der Befund war ein anderer als der Verdacht.** Nicht der Agent, nicht die
Denktiefe, nicht der Timeout: **der Mac schlief zwei Sekunden nach dem Start
wieder ein.** `pmset -g log`, neben die Run-Zeiten gelegt (04.08.):

| Uhrzeit | Ereignis |
|---|---|
| 06:09:36 | DarkWake aus Deep Idle |
| **06:09:38** | Run `linkedin-antwort-entwuerfe` startet — und im selben Moment `Entering Sleep` |
| 06:26:06 | nächster DarkWake |
| **06:26:07** | Run wird als fehlgeschlagen verbucht |

Alle neun Fehl-Läufe zwischen dem 03. und 07.08. liegen so: Start auf einem
DarkWake, „Ende" auf dem nächsten. Der Mac fährt nachts einen Zyklus
„DarkWake für zwei Sekunden, dann zurück in den Schlaf", etwa alle 16 Minuten.
Der Agent bekam rund **zwei Sekunden Rechenzeit je Zyklus**; die Timeout-Wanduhr
lief im Schlaf weiter, SIGTERM und `close` wurden erst beim nächsten DarkWake
abgearbeitet. **Die 10,9 bis 17,8 Minuten sind keine Laufzeiten, sondern
Abstände zwischen zwei Aufwachern.**
*Gegenprobe:* derselbe `dream-check` am 07.08. mittags bei wachem Mac —
**23 Sekunden**. Morgenbrief am 31.07. abends — **33 Sekunden**. Der Skill ist
54 Zeilen und liest eine Datei.

**Vier Schritte, in dieser Reihenfolge gebaut**

| # | Was | Beleg |
|---|---|---|
| 1 | **Teilausgabe.** `--output-format text` schweigt bis zum Schluss — ein Abbruch hinterließ „kein Output". Jetzt `stream-json --verbose`, `runner/agentStream.mjs` baut ein Protokoll mit Zeitmarken (Werkzeuge samt Argument, gedachte Zeichen, Kennzahlen). Erfolgreiche Läufe sehen unverändert aus (nur der Endtext aus dem `result`-Ereignis — die Freigaben-Queue liest den ```json-Block daraus). | `scripts/verify-agent-stream.ts`, 39 Fälle |
| 2 | **Wachhalten.** Lauf startet unter `caffeinate -i -s`; die Zusicherung endet mit dem Prozess. **Timeout bleibt bei zehn Minuten** (Entscheidung Kevin 07.08.) — eine größere Zahl hätte den Fehlschlag nur später kommen lassen. | `CAFFEINATE_BIN` in `runner/index.mjs` |
| 3 | **Prozessbaum.** `proc.kill()` traf nur das direkte Kind, während ein Enkel die stdout-Pipe offen hielt — deshalb kam `close` Minuten zu spät. Jetzt `detached: true` (eigene Prozessgruppe) und `beendeBaum()`: SIGTERM an die Gruppe, nach 15 s Karenz SIGKILL. | im Test: Run-Datei exakt zum Limit statt 75 s später |
| 4 | **Guard + Sichtbarkeit.** Der Tages-Guard prüfte nur den Dateinamen — ein Fehlschlag galt als „heute schon gelaufen" und deckte sich selbst zu. Jetzt entscheidet der **Status**, mit zwei Versuchen je Tag als Deckel. Dazu eine Zeile im Heute-Deck: gescheiterte Routinen von heute stehen sichtbar da (der `RunWatcher` toastet nur, was er live umkippen sieht). | `runner/routineGuard.mjs`, `cockpit/lib/agentenGesundheit.ts`, `scripts/verify-routine-guard.ts`, 30 Fälle |

**Offen für Kevin — sonst greift Punkt 2 ins Leere:**
1. **Runner neu starten**, damit der Dienst den neuen Code lädt:
   `launchctl kickstart -k gui/$(id -u)/de.uriel.runner`
2. **Selbstwecker setzen** (braucht das Passwort, deshalb nicht von hier):
   `sudo pmset repeat wakeorpoweron MTWRF 05:50:00`
   Ohne ihn wacht der Mac werktags nicht von selbst auf — `caffeinate` hält ihn
   nur wach, sobald ein Lauf begonnen hat. `pmset -g sched` zeigt den Stand
   vorher; `pmset repeat` überschreibt bestehende Wiederhol-Zeitpläne.
*Gefunden am 07.08. gegen das laufende System; in keinem Plandokument.*

### O14 · Sales-Subtabs restylen — **L** · nach der Call-Mode-Entscheidung
`pages/sales/SalesMode.tsx`: 2.504 Zeilen, **55** Glass-Treffer — die letzte große
Fläche der alten Optik. Sinnvoll erst, wenn entschieden ist, was von
Pipeline/Listen/Call-Mode/Kontakt überhaupt bleibt (O13, letzte Zeile).
*Herkunft: IDEEN „Schöner"*

### O15 · ~~Hygiene~~ ✅ **erledigt 06.08.2026**
- ~~Worktree `sharp-lehmann-9787a0` aufloesen~~ ✅ (frueher am 06.08.). Der zurueckgebliebene
  leere Ordner `.claude/worktrees/` ist jetzt ebenfalls weg.
- ~~**Duplikat-Ordner `cursor/` neben `.cursor/`**~~ ✅ `cursor/rules.md` entfernt.
  Beide waren **versioniert und inhaltsgleich** (`diff -rq` ohne Ausgabe); geblieben
  ist `.cursor/`, weil Cursor genau dort liest.
- ~~**Vault:** `02 Projekte/Uriel.md` ist ein Stub vom 09.06.~~ ✅ **Befund war
  ueberholt:** die Notiz war bereits am 06.08. ueberarbeitet worden, stand aber auf
  „Etappen gebaut, noch nicht live“ und „12 Commits hinterher“. Jetzt auf dem echten
  Stand: `main` = `de60288` live, 6 Commits offen, die Entscheidungen dieser Runde
  in drei Zeilen.
- ~~**Dangling Link `[[ai-os-setup]]`**~~ ✅ alle drei Vorkommen im Masterplan
  aufgeloest. Die Notiz gab es im Vault **nie**; die Verweise galten der fruehen
  Hostinger-Planung, die inzwischen verworfen ist. Bewusst **kein** nachtraeglich
  erfundenes Dokument — stattdessen zeigen die Stellen jetzt auf die Begruendung in
  Phase 2 bzw. Backlog Abschnitt 5, mit einer Fussnote, warum der Link verschwand.

### O16 · Zwei Vorhaben aus Sessions, die nie in einem Doc landeten
- **LinkedIn als Kanal im Content-Bereich** (Session 21.07., „TODO 1"): Kanal
  `linkedin` + Editor + „Auf LinkedIn öffnen". Schätzung damals ~½ Tag. **M**
- **Morgen-Routine „neue LinkedIn-Kontakte → Erstnachricht"** (Session 21.07.,
  „TODO 2"): offene Entscheidung Variante A (halbautomatisch über Chrome) vs. B
  (täglicher Export). Weitgehend überholt durch `linkedin_erstnachrichten` (91
  Zeilen) und den Skill `linkedin-leads` — **vor dem Bauen prüfen, ob überhaupt
  noch etwas fehlt.** **S** für die Prüfung.

### O18 · ~~Mobile Homescreen + v2-Ausbau~~ ✅ **fertig, live und abgenommen (09.08.2026)**
Züge 0–7 der Blaupause (`docs/wargames/mobile-homescreen.md`) sind umgesetzt und
seit dem 09.08. live (L1). Kevins erster Eindruck am Geraet: „scheint zu
funktionieren".

**Was steht:**
- **Zug 0 · Notch-Fix** (eigener Commit, unabhängig vom Rest):
  `padding-top: env(safe-area-inset-top)` an `.ck-statusbar` im Mobil-Block
  (`app/src/styles/cockpit.css:591`). Die Statusleiste ist der oberste
  gerenderte Rand der Shell (`CockpitShell.tsx:31`), alle Bereiche erben.
  Am Desktop gemessen: `env()` = 0, Padding bleibt 8 px.
- **Zug 1 · Icons zentral:** Feld `icon` je Bereich in
  `cockpit/lib/bereiche.ts:39-53` + `bereichIcon(path)`; `NavRail.tsx:29-46`
  zieht daraus. Neu vergeben: `/termine` ◷, `/freigaben` ◫, `/linkedin` ▣.
  Codepoints per Skript geprüft (☑/⚙ tragen U+FE0E, Rest Geometric Shapes).
- **Zug 2 · Widgets:** `cockpit/components/home/` mit `HeuteWidget`,
  `TermineWidget`, `VitalsWidget`, `BefundZeile`. Ohne eigene Hooks — Props
  vom Eltern-Container. `MorgenArea.tsx:135` nutzt jetzt `BefundZeile`.
- **Zug 3 · UrielHome** (`cockpit/pages/UrielHome.tsx`); `CockpitHome.tsx:170-173`
  ist nur noch die Weiche, der bisherige Rumpf heißt `CockpitHomeDesktop`.
- **Zug 4 · App-Grid** (`components/home/AppGrid.tsx`), 10 Kacheln, LinkedIn
  erstmals ohne Umweg erreichbar. `Badge` aus NavRail nach
  `components/Badge.tsx` gezogen. `useSocialUnread` (`lib/socialApi.ts:117-180`)
  hat jetzt EINEN Kanal je Brand für alle Aufrufer.
- **Zug 5 · Bibliothek:** `MehrSheet` zeigt alle 11 Bereiche als Grid
  (`NavRail.tsx:110-161`), Benachrichtigungs-Schalter bleibt darunter.
- **Zug 6 · Suche:** ⌕ im Kopf öffnet die CommandPalette;
  `.ck-cmdk-input` mobil 16 px gegen iOS-Auto-Zoom (`cockpit.css:706`).
- **Zug 7 · Erinnerungen-Grammatik** (`components/home/ListenZeile.tsx`),
  mobil in `Arbeitsliste.tsx:131` und `AufgabenArea.tsx:55`. Der Kreis ruft
  ausschließlich die bestehenden Erledigt-Pfade.

**Verifikation 1–8 der Blaupause, gefahren:** `npx tsc -b` + `npm run build`
grün · **alle 20 verify-Skripte** grün (u. a. `verify-breakpoint` 8/8,
`verify-arbeitsmodus-tracking` 23/23) · Screenshots 390×664 (Homescreen, Apps,
Bibliothek, Palette, Arbeitsmodus, Aufgaben, `/morgen`) und 1280 px · Desktop
vorher/nachher deckungsgleich · Klick-Messung: Öffnen → „Loslegen" →
Arbeitsmodus „1 / 209" = 2 Interaktionen · Netzwerk-Zählung gemessen: mobil
113 Anfragen, Desktop 153, mobil KEINE Tabelle, die der Desktop nicht auch
liest (es fehlen `month_goals`, `os_map_snapshot`, `project_messages`,
`site_content`, `runner:/agents`, `runner:/os/map`).

**Drei Abweichungen von der Blaupause — mit Grund:**
1. **Kein `/freigaben`-Badge** (D5 sah einen vor). Gegenprobe fiel durch: das
   Icon zeigte 20 (`entwuerfeOffen(geordnet)`), die Seite „24 offen"
   (`FreigabenArea.tsx:297`, offene Karten der Agenten-Warteschlange). Zwei
   verschiedene Mengen; gleichziehen ginge nur mit einem neuen Ladepfad auf der
   Home (Gesetz 4). Der Content-Badge bleibt.
2. **`useViewport` hörte nur auf `resize`/`orientationchange`** — beim
   Umschalten der Breite feuerte die MediaQuery, aber kein resize, und die Home
   blieb auf dem Desktop-Zweig, während die Bottom-Bar schon mobil war. Jetzt
   zusätzlich matchMedia-Listener (`hooks/useViewport.ts:60-61`), wie NavRail
   ihn seit O10 hat.
3. **`?modus=arbeit` startete zu früh:** der Effekt in `SalesDashboard.tsx:601`
   wartete nur auf „`geordnet` nicht leer". Die fünf Quellen kommen nacheinander
   an — der Arbeitsmodus öffnete mit „1 / 2" statt „1 / 209". Er wartet jetzt
   auch auf „nichts lädt mehr". Der Fehler war älter als O18 (der Knopf auf
   `/morgen` ruft dieselbe URL).

**Nichts offen.** Die letzte Abnahme, die nur am Gerät möglich war, hat Kevin
am 09.08. gegeben: die Kopfzeile sitzt in der installierten App unter der
Aussparung (Zug 0). Damit ist auch der einzige Punkt erledigt, den kein
Desktop-Browser prüfen kann — `env(safe-area-inset-top)` ist dort immer 0.

**v2 komplett nachgezogen (09.08., Kevins Freigabe „nacheinander, f als letztes"):**
- **(a) Schnell-Aktionen** — Halten auf einer Kachel öffnet ein Blatt.
  Sales: Arbeitsmodus / Antworten / Anfragen-Zähler, alle über bestehende
  `?kachel=…`-Routen (`components/home/AppGrid.tsx`). Bewusst nur Sales: ein
  Halte-Menü, das nur „Bereich öffnen" anbietet, ist ein leerer Umweg.
- **(b) Agenten-Kacheln** — Morgenbrief / Entwürfe / Dream mit ihrem Zustand
  von heute (`components/home/AgentenKacheln.tsx`), aus `runs` + `agentenBefund`,
  die die Home ohnehin hält. „ruht" am Wochenende, weil zwei der drei Routinen
  werktags laufen. `scripts/verify-agenten-kacheln.ts`, 11 Fälle.
- **(c) Widget-Stack** — Heute / Termine / Woche nebeneinander statt gestapelt
  (`components/home/WidgetStack.tsx`, `.ck-widget-stack` in cockpit.css).
  Heute bleibt Seite 1, sonst läge „Loslegen" hinter einem Wisch. Seither
  stehen Widgets **und** Icons ohne Scrollen im Bild.
- **(d) Eigene Reihenfolge** — „Anordnen": Kachel antippen, Ziel antippen.
  **Migration 0068** legt `ui_settings` an (Schlüssel/Wert je Nutzer, RLS auf
  `auth.uid()`), auf Kevins Entscheidung Supabase statt localStorage: die PWA
  löschen und neu hinzufügen ist hier ein dokumentierter Schritt (O3), rein
  lokal wäre die Anordnung dabei jedes Mal weg.
- **(e) Reihenfolge nach Tageszeit** — morgens Freigaben/Sales/LinkedIn,
  tagsüber Sales/Termine/Projekte, abends Tracking/Content/Projekte
  (`lib/kachelReihenfolge.ts`). Greift **nur, solange nichts selbst angeordnet
  ist**; ein einziges „Anordnen" friert sie für immer ein. Ein Grid, das sich
  unter der eigenen Hand weiterbewegt, kostet mehr, als die Sortierung bringt.
  `scripts/verify-kachel-reihenfolge.ts`, 32 Fälle — die Drift-Robustheit ist
  der Punkt: ein neuer Bereich muss hinten landen statt zu fehlen.
- **(f) Wischen auf den Zeilen** — links „→ morgen", rechts „Erledigt"
  (`components/home/ListenZeile.tsx`, `.ck-zeile-wisch`). Nativ mit
  scroll-snap, `overscroll-behavior-x: contain` gegen die iOS-Zurück-Geste.
  **Abweichung:** die Blaupause wollte das Wischen selbst als Aktion; hier legt
  es die Aktion frei und der Tipp führt sie aus — „→ morgen" verschiebt einen
  Lead ohne Zurück, ein Fehlwisch wäre still und teuer. Verschoben wird über
  bestehende Pfade: `snooze` bei LinkedIn-Posten, `due_at` bei Aufgaben; wo es
  keinen gibt, erscheint die Aktion nicht.

Desktop nach der ganzen Runde erneut gegengeprüft: `/cockpit` mit Graph und
Heute-Deck, `/aufgaben` als Tabellenzeile, keine Wisch-Bahn, kein Widget-Stack.
Alle 22 verify-Skripte grün.

**Offen aus dem Ausbau:** echte iOS-Homescreen-Widgets (brauchen einen nativen
Wrapper — verworfen, §5) und der Edge-Swipe-Pager (verworfen in D3).
*Herkunft: Session 08.08. (Kevins OS-Idee) · IDEEN Leitprinzip Klick-Ökonomie*

---

## 4 — Zurückgestellt

Nicht verworfen. Je mit der Bedingung, unter der es wieder aufwacht.

| Was | Grund | Wacht wieder auf, wenn |
|---|---|---|
| **Uriel-Core 24/7 auf eigenem Heimserver** (Masterplan M3, „Jarvis Phase D") | Kostet Geld, Zeitrahmen Wochen bis Monate. **Kein Hostinger:** Der LinkedIn-Sync läuft mit Session-Cookies — eine Rechenzentrums-IP erhöht das Sperr-Risiko für den wichtigsten Vertriebskanal. Ein Heimserver behält die vertraute IP. Bis dahin decken Selbstwecker (`pmset`) und `caffeinate` rund 95 % der Morgen ab. | Kevin die Hardware anschafft — oder der Selbstwecker sich im Alltag als unzuverlässig erweist |
| **Sprach-Satelliten + Wake-Word** (M4) und **Alexas abklemmen** (M5) | Kevin, 06.08.: „Das können wir erst mal vergessen, das ist nicht wichtig." ~250 € einmalig. | Nach dem Heimserver, frühestens |
| **Domain `uriel-os.de`** (~15 €/Jahr) | Entscheidung offen seit 19.07. **Seit 06.08. deutlich billiger:** mit dem Streichen von `email-inbound` (L5b) hängt kein funktionaler Lead-Eingang mehr an `frameworkos.de`. Was bleibt, ist der `PUBLIC_APP_URL`-Umzug und die Netlify-Domain. | Kevin die Domain sichert; der Umzug bleibt davon getrennt |
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
