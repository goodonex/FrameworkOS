> **Offene Punkte stehen nicht mehr hier, sondern in [`BACKLOG.md`](BACKLOG.md).**
> Gültig bleiben das Postmortem (§2) und die Referenzprojekte am Ende; die
> Ideenliste §3 ist im Backlog dedupliziert und gegen den Code geprüft aufgelöst.

# Uriel — Ideen-Sammlung & Roadmap-Kandidaten (Stand 19.07.2026)

Anlass: Kevins Auftrag „einmal komplett schauen, was noch alles rein könnte" — als **letzte große Ideen-Sammlung dieses Jahr** in diese Richtung. Basis: vollständige Code-Analyse (Cockpit + Datenmodell + Runner), Vergleich mit ~25 Open-Source-Projekten (OpenClaw, Twenty, Khoj, n8n u. a.) und Trend-Recherche 2026/27 mit Primärquellen.

Wie zu lesen: §1–2 Befund + Postmortem, §3 die **komplette** Liste (nichts weggelassen), §4 die **Reduktion** auf das, was wirklich Impact hat. Künftige Bau-Sessions können einzelne §3-Einträge als Auftrag nehmen — Datei-Referenzen stehen dabei.

---

## 1. Befund — wo Uriel heute steht

Stark und real benutzbar: Tracking/KPI-Steuerung (`daily_metrics` mit Kanal-Attribution), CRM/Pipeline (44+ Kontakte, Call-Mode, Follow-up-Stage), Runner mit 5 Agenten + launchd-Autostart, Uriel-Assistant mit 8 UI-/Daten-Tools + ElevenLabs-Voice, OsNebula-Graph mit 3 Ansichten, Content-Batches, Ads-Review, Kunden-Portal.

Die zentrale Erkenntnis dieser Analyse: **Kevins Wunschliste (Aufgaben, Kalender, Routinen) ist zu ~70 % schon gebaut** — sie liegt nur in der abgehängten Legacy-Welt (`/brand/:slug`), die aus der Cockpit-Nav nicht erreichbar ist:

| Gewünscht | Existiert bereits | Wo eingesperrt |
|---|---|---|
| Aufgaben/To-dos | `foundation_tasks` + `useTasks` (Buckets: überfällig/heute/Woche) + `TasksSection`, `TaskRow`, `TasksModule` | Legacy-Dashboard |
| „Heute"-Ansicht | `TodaySection` (fällige Kontakte), `DailyWorkList` (priorisierte Call-Liste) | Legacy |
| Kalender | `PromoCalendar` (Content-Monatsgrid), `sales_bookings` + Booking-Page (public), `contacts.next_follow_up_at` + Termin-Typ | Legacy / verstreut |
| Routinen | `usePerformanceFocusTasks` (Auto-System-Tasks), `useMorningBrief`, `useWeeklyReview` + Drawer, `AGENT_CATALOG` im Runner | Legacy / nur `/agenten` |

Diese Features ins Cockpit zu heben ist **Portierung, kein Neubau** (dünne Wrapper um bestehende Hooks — Muster: CrmArea/EmailArea).

---

## 2. Postmortem — Lektionen aus 3 Monaten (Mai–Juli)

1. **Der 3D-Welt-Umweg.** Mai–Juni: komplette Three.js-Welt gebaut (Planeten, Monde, Texturen, Kamera-Choreographie) — Anfang Juli in Phase 6 wieder abgerissen (Bundle −28 %). Die Lektion ist gezogen und dokumentiert („Lesbarkeit > Effekt", „Obsidian kann Denken besser") — aber als Muster festhalten: **Visualisierung erst bauen, wenn sie eine Frage beantwortet.** Der Abriss selbst war richtig und mutig; die Rebuild-Disziplin danach (Blaupause → Phasen → Build grün → Commit) war die beste Arbeitsphase des Projekts.
2. **Zwei Welten im Bundle.** Cockpit = ~10k Zeilen (17 % des UI-Codes), Legacy = ~48k Zeilen, wird weiter mit ausgeliefert. CRM/E-Mail sind nur Shells um Legacy-Code (okay als Muster), aber Tasks/Kalender/Reviews sind **verwaiste Feature-Inseln**. Die Entscheidung „Legacy endgültig abschneiden oder portieren" ist überfällig — jede Woche Aufschub macht sie teurer.
3. **„Erst Schmerz, dann bauen" hat funktioniert** (Google-Drive-Anbindung abgelehnt, Terminal verworfen, Dream-Karte klein gehalten). Die Gegenprobe: Alles, was ohne konkreten Workflow-Schmerz gebaut wurde (Foundation-Modi, 3D-Welt, Mock-Intelligence), wurde später gelöscht. Diese Regel ist Uriels wichtigstes Produktprinzip.
4. **Zeitbomben & Platzhalter:** Soll-Kurve fest verdrahtet nur für Juli/August 2026 (`goals.ts:27-45`) — **ab September zeigt die Home falsche Ziele**. NorthStar-Retainer-Zähler ist localStorage-Handarbeit statt CRM-Daten. Ads-Metriken sind manuell gepflegtes Manifest. `HANDOFF.md` beschreibt die tote 6-Modi-Welt von vor dem Rebuild.
5. **Runner = Single Point of Failure.** Ads, Agenten, Content-Posts und frischer OS-Graph existieren nur, wenn der Mac läuft. Die Live-Domain bekommt nur Snapshots. Das ist für v1 okay — aber der Grund, warum M3 (Hostinger) irgendwann echt werden muss.
6. **Tote Reste:** `mockIntelligence.ts`, `mockFocusEngine.ts`, `mockDiscoveryAgent.ts` (0 Importeure), `URIEL_VOICES`-Export, „Universe"-Link in der NavRail (führt auf einen Redirect zu sich selbst), doppelte Tracking-Eingabe (QuickTrack vs. TrackingArea mit unterschiedlichen Feld-Sets), CRM-Doppel-Datenhaltung `useContacts` (Supabase + localStorage mit Merge/Resurrect — bekanntes Risiko aus dem Review 07.07., weiter offen).

---

## 3. Die komplette Ideen-Liste

### 3.1 Home/Dashboard: Aufgaben, Heute, Kalender

- **H1 — „Heute"-Deck auf der Cockpit-Home** (der große fehlende Baustein): eine Leiste/Spalte, die aggregiert: heutige + überfällige Tasks (`useTaskBuckets`), fällige Follow-ups (`useDailyWorkList`), heutige Termine (`sales_bookings` + `contacts.next_follow_up_at`), heute geplanter Content (`content_pieces.scheduled_at`). Abhaken direkt in der Karte. Vorbild: „Respondables"-Karte (eleanorkonik-Gist) — *eine* Antwort auf „was muss ich heute tun?".
- **H2 — Globale Task-Ansicht** `/aufgaben` (oder Tab im Heute-Deck): `TasksSection` portieren, Quick-Add mit natürlicher Sprache („Reichentrog Feedback Freitag" → Task mit Datum; Vorbild Vikunja Quick Add Magic). Wiederkehrende Tasks ergänzen (Feld `recurrence` in `foundation_tasks`).
- **H3 — Kalender-Ansicht** `/termine`: Wochen-/Monatsansicht, aggregiert aus den drei existierenden Termin-Quellen (Bookings, Kontakt-Termine, Content-Slots). Farbcodiert nach Typ (Setting/Closing/Content/Privat). Erst eigene Daten, dann Google-Calendar-Sync via MCP/Connector (steht seit v1 im Backlog).
- **H4 — Morning Brief im Cockpit**: `useMorningBrief` existiert — als Uriel-generierte Karte auf die Home („Guten Morgen — 3 Follow-ups fällig, Termin 14 Uhr Solmaz, Content-Batch wartet auf Review"). Alternativ/zusätzlich als täglicher Scheduled Task mit Zustellung (siehe A6).
- **H5 — Weekly Review in den Alltag holen**: `WeeklyReviewDrawer` portieren; der `wochenrecap`-Agent schreibt heute schon Markdown — beide zusammenführen (Agent füllt Draft, Kevin bestätigt im Drawer, Ergebnis in `weekly_reviews`).
- **H6 — MonthCurve auf die Home** (liegt fertig da, wird nur in Tracking gerendert).
- **H7 — NorthStar echt machen**: Retainer-Zähler aus `opportunities`/`deliver_projects` ableiten statt localStorage-Buttons.
- **H8 — Soll-Kurven konfigurierbar**: `business_targets`-Tabelle existiert (0046) — `goals.ts` daraus speisen statt hartverdrahtet. **Vor dem 1. September nötig.**

### 3.2 Routinen & Command Deck

- **R1 — Command Deck v2 = dynamisches Routinen-Board**: Buttons aus `GET /agents` (AGENT_CATALOG) statt 2 hartverdrahteter Buttons — die `/agenten`-Logik auf die Home. Jeder neue Runner-Agent erscheint automatisch als Button.
- **R2 — Neue Routine-Agenten** (je 1 Skill im Vault, Muster existiert): `morgenbrief` (H4 als Agent), `plan-today` (aus Pipeline + Tasks einen Tagesplan bauen), `inbox-triage` (E-Mail-Eingang zusammenfassen, Antwort-Entwürfe), `kpi-rollup` (Wochen-/Monatszahlen als Deliverable), `content-repurpose` (1 Post → 3 Formate), `kunden-status` (je aktivem Deliver-Projekt: was steht aus, was stockt).
- **R3 — Closed-Loop-Prinzip als Regel** (wichtigster Trend-Befund): Agenten liefern **fertige Arbeitsergebnisse, keine Zusammenfassungen** — der Follow-up-Agent endet nicht beim Entwurf, sondern beim „bereit zum Senden, hier klicken" (→ A1 Approval-Queue). Reine Briefing-Agenten erzeugen nur Lesestoff.
- **R4 — Routine-Checkliste auf der Home**: `usePerformanceFocusTasks` erzeugt heute schon Auto-Tasks („noch X Wählversuche", „Wochen-Review fällig") — sichtbar machen statt Legacy-einsperren. Das IST der „Routine-Buttons"-Wunsch in datengetriebener Form.
- **R5 — Zeit-Trigger im Runner**: `dream-check` läuft schon täglich automatisch — dasselbe Muster für `morgenbrief` (werktags 7:00) und `wochenrecap` (Fr 16:00). Alternativ für Cloud-Unabhängigkeit: Claude Scheduled Tasks (A6).

### 3.3 Graph (OsNebula)

- **G1 — „Fluss"-Ansicht (4. Modus)**: der Funnel als Fluss statt Ringe — Kanal → Anfrage → Antwort → Termin → Deal als Sankey-artige Ströme aus `daily_metrics` + Pipeline-Stages. Beantwortet die Steuerungsfrage („wo versickert es?") statt nur Struktur zu zeigen.
- **G2 — „Workflows"-Ansicht**: Routinen + ihre letzten Runs als Zeitleiste/Orbit — welcher Agent lief wann, was kam raus, was schlug fehl. Klick → RunDrawer. (Kevin fragte explizit nach mehr Ansichten; Leads existiert, Workflows fehlt.)
- **G3 — Graph-Intelligenz statt Deko** (Vorbild InfraNodus): Zentralitäts-Ranking (welche Notiz/welcher Kontakt ist Hub?), Community-Clustering, **Gap-Detection** („zwischen Content-Cluster und Pipeline-Cluster gibt es keine Verbindung"). Der Graph sagt etwas, statt nur zu leuchten.
- **G4 — Standard-Features nachrüsten** (Vorbild Obsidian 3D Graph New): Filter nach Typ, Search-and-Focus (existiert), Mehrfachauswahl, Label-Fade nach Distanz (teils da), Gruppen-Färbung konfigurierbar.
- **G5 — Semantische Kanten** (Vorbild Reor): Kanten nicht nur aus [[Wikilinks]], sondern aus Ähnlichkeit — bewusst zurückgestellt solange Keyword-Scoring reicht (AGENTIC-OS-PLAN-Entscheidung bleibt).
- **G6 — Uriel als Graph-Erzähler**: „Uriel, was fällt dir am Graph auf?" → Tool `analyze_graph` liefert die G3-Metriken als Text. Kombiniert Assistant + Graph zu einem echten HUD.

### 3.4 Agent-Infrastruktur (der strukturelle Vorsprung)

Quervergleich OpenClaw/n8n/Twenty — Uriels 5 größte strukturelle Lücken:

- **A1 — Approval-Queue (Human-in-the-Loop)** — die wichtigste: Agent bereitet vor, Kevin signiert, System führt aus. Konkret: `followup-entwuerfe` schreibt in eine `pending_actions`-Tabelle, Cockpit zeigt Karten mit Approve/Edit/Deny, Approve ruft `send-email` (existiert!). Verwandelt „Agent traue ich nicht" in „Agent arbeitet, ich signiere". Gilt später für alles: Posts, CRM-Änderungen, Angebote.
- **A2 — Messenger als Zweit-Interface**: Uriel per WhatsApp/Telegram — Status fragen, Runs starten, Approvals erteilen (A1 mobil!). Das ersetzt die „Mobile App" komplett. Vorsicht WhatsApp-MCP (inoffiziell, Account-Risiko) — Telegram-Bot ist der sichere Start.
- **A3 — Event-Trigger statt nur Cron**: `email-inbound` existiert als Webhook — daran Runner-Reaktionen hängen („neue Lead-Mail → lead-research läuft automatisch → Briefing liegt bereit, bevor Kevin die Mail liest").
- **A4 — Runner-Observability**: Live-Feed der Runs mit Dauer, Kosten, Sub-Schritten, Fehlerrate (Vorbild Agents Observe / Dify LLMOps). Plus Lehre: Erfolg separat verifizieren — Agenten melden gern „done".
- **A5 — Uriel-MCP-Server**: Cockpit-Daten (CRM, Pipeline, KPIs, Tasks) als MCP-Server exposen (Vorbild Twenty) — dann kann jede Claude-Code-Session und Claude Desktop direkt lesen/schreiben, ohne Doppel-API. Verbindet CLI-Welt und Cockpit sauber.
- **A6 — Claude Scheduled Tasks nutzen** (nativ, im Max-Plan enthalten, läuft remote auch bei zugeklapptem Mac): Morning Brief und Wochen-Jobs dorthin verlagern, wo der lokale Runner nicht laufen muss. Günstigster Schritt Richtung „24/7", **bevor** M3/Hostinger gebaut wird.
- **A7 — Skills-Registry-Gedanke**: Runner-Agenten als SKILL.md-Pakete mit Metadaten (Beschreibung, Inputs, Gefährlichkeit) statt hartkodiertem Katalog — macht R1 trivial und ist OpenClaw-kompatibles Denken.
- **A8 — Robustheits-Patterns** (eleanorkonig): pro Dashboard-Karte eigener Refresh-Endpoint mit Job-Log gegen Doppel-Läufe; Datenregel „never overwrite non-zero with zero" (kaputter Sync darf KPIs nie nullen).

### 3.5 Bereiche im Einzelnen

- **CRM: Beziehungs-Reminder** (Vorbild Monica): „12 Tage kein Kontakt zu Solmaz", Geburtstage, „Kunde seit 6 Monaten still" — Follow-up ist bei Solo-Vertrieb das häufigste Umsatz-Leck. Daten liegen in `last_contact_at`.
- **CRM: Datenhaltung bereinigen** (bekannt, Review 07.07.): Supabase als einzige Wahrheit, localStorage nur Cache; resurrect/enrich/Tombstones raus. Eigener 0,5–1-Tage-Schritt, nicht nebenbei.
- **E-Mail: Respondables** — ungelesene/unbeantwortete Eingänge als Karte im Heute-Deck (H1), gespeist aus `email-inbound`.
- **Content: Kalender + Batch verschmelzen** — `PromoCalendar` portieren und Wochen-Batches (social_batches) als Einträge zeigen; „Neue Beiträge bauen" bleibt der Knopf daneben. Multi-Brand-Allowlist im Runner öffnen (`index.mjs:73`), sobald ein zweiter Kanal real ist.
- **Ads: Meta-API statt Manifest** — erst wenn echte Kampagnen laufen (Schmerz-Regel). Bis dahin Manifest okay.
- **Tracking: Eingabe vereinheitlichen** — QuickTrack und TrackingArea auf ein gemeinsames Feld-Set/Komponente ziehen (Drift-Risiko).
- **Booking: Anzahlung im Flow** (Vorbild Cal.diy + Stripe) — Erstgespräch mit optionaler Anzahlung; erst relevant, wenn No-Shows wirklich schmerzen.
- **Projekte: Kunden-Status-Routine** — siehe R2 `kunden-status`; Deliver-Zukunft (Legacy-Entscheidung) gehört in den Hygiene-Batch.

### 3.6 Fundament & Hygiene (der „Postmortem-Batch")

1. Legacy-Entscheidung treffen: portieren (H1–H5) und danach `/brand/:slug`-Welt abschneiden — Ziel: eine Welt, ein Design-System.
2. `HANDOFF.md` neu schreiben (beschreibt die Vor-Rebuild-App), `docs/data-model.md` mit realem Schema abgleichen (Geister-Tabellen drin).
3. Tote Dateien: 3 `mock*`-Dateien, `URIEL_VOICES`, „Universe"-NavRail-Link.
4. H7 (NorthStar echt) + H8 (Soll-Kurve ab September!).
5. CRM-Datenhaltung (siehe 3.5).

### 3.7 Zukunft 2027/28 — nur beobachten, nichts bauen

- **MCP Apps** (Tools liefern UI in den Chat, offizielle Extension seit Jan 2026): könnte mittelfristig Cockpit-Module „in den Chat" bringen — beobachten, Spec-Finalisierung 28.07.2026.
- **Agent-Payments** (ACP/AP2/x402 live, aber Solo-Nutzen 2026 ≈ null) und **A2A**: Enterprise-Thema, nicht anfassen.
- **Voice-Satelliten** (M4): Home Assistant Voice PE bleibt der richtige Plan, aber Latenz/Robustheit noch unter Alexa-Niveau — M4 nicht vorziehen.
- **Nüchterner Rahmen**: >40 % der Agentic-Projekte scheitern laut Gartner bis Ende 2027 — die Gewinner sind eng geschnittene, überwachte Agenten mit klarem Deliverable. Genau Uriels Bauweise; kein General-Jarvis-Umbau nötig.
- Grundsatz: auf Protokolle setzen (MCP, offene Connectors), nichts auf proprietäre Agent-Marktplätze wetten.

---

## 4. Reduktion — was wirklich Impact hat

Bewertung nach: bewegt es die 30k/50k-Ziele, spart es tägliche Minuten, und wie viel existiert schon.

### Die Top 3 (je ~eine Bau-Session, Reihenfolge = Empfehlung)

1. **Das „Heute"-Deck (H1+H2+H4+R4)** — Aufgaben, fällige Follow-ups, Termine, Morning Brief in einer Home-Leiste, plus globale Task-Ansicht. Beantwortet jeden Morgen „was tue ich zuerst?" und hebt vier fertige Legacy-Features ins Cockpit. Höchster Alltagsnutzen pro Aufwand im ganzen Backlog.
2. **Approval-Queue (A1) + Command Deck v2 (R1/R2)** — Agenten enden nicht mehr bei Markdown, sondern bei „bereit zum Senden"; Kevin signiert im Cockpit (später per Telegram, A2). Der strukturelle Sprung von „Berichts-Agenten" zu „Arbeits-Agenten" — das, was die besten Projekte da draußen (OpenClaw, n8n) von Uriel unterscheiden.
3. **Kalender `/termine` (H3)** — die drei existierenden Termin-Quellen in einer Wochenansicht; Google-Calendar-Sync als Folgeschritt. Danach hat das Cockpit alles, was Kevin explizit vermisst hat.

### Direkt danach (klein, aber fällig)

4. **Hygiene-Batch (3.6)** — insbesondere **H8 vor dem 1. September** (Soll-Kurve), sonst steuert die Home ab Herbst ins Leere. Plus Legacy-Abschnitt nach Abschluss der Portierungen.
5. **Graph: Fluss-Ansicht (G1) oder Workflows (G2)** — eine von beiden, nicht beide; G1 wenn Steuerung wichtiger ist, G2 wenn Agenten-Transparenz. G3 (Gap-Detection) als Kür danach.
6. **Scheduled Tasks (A6)** — Morning Brief remote laufen lassen; verschiebt M3/Hostinger nach hinten, ohne Funktionalität zu verlieren.

### Bewusst NICHT (bestätigte Entscheidungen)

- Voice-Hardware vorziehen (M4 bleibt hinten), semantische Embeddings (G5), Meta-Ads-API vor echten Kampagnen, WhatsApp-MCP auf dem Haupt-Account, Agent-Payments, eigener Mobile-App-Build (A2 Messenger ersetzt ihn), General-Jarvis-Autonomie ohne Aufsicht.

---

## Referenzprojekte (zum Abgucken)

- **OpenClaw** (openclaw.ai) — Pattern-Katalog: Messenger-Kanäle, Cron+Webhooks, Skills-Registry, Approval-Pairing
- **Twenty** (twentyhq/twenty) — CRM mit nativem MCP-Server je Workspace (Vorbild für A5)
- **n8n / Activepieces** — Human-in-the-Loop pro Tool-Call (Vorbild für A1), Agent-Evaluations
- **Khoj** (khoj-ai/khoj) — geplante persönliche Newsletter/Briefs (Vorbild für H4/A6)
- **Suna** (kortix-ai/suna) — Referenzarchitektur mit identischem Stack (React + Supabase + Agent-Sandbox)
- **Agents Observe** (simple10/agents-observe) — Runner-Observability über Claude-Code-Hooks (Vorbild für A4)
- **InfraNodus** (infranodus.com) — Graph-Analyse statt Graph-Deko (Vorbild für G3)
- **Monica** (monicahq/monica) — Beziehungs-Reminder (Vorbild für CRM-Wiedervorlage)
- **Vikunja** (vikunja.io) — NLP-Quick-Add, wiederkehrende Tasks (Vorbild für H2)
- **eleanorkonik-Gist** — Respondables-Karte, Async-Refresh-Patterns, „never overwrite non-zero with zero"
