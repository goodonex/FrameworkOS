> **Phasenprotokoll des Cockpit-Rebuilds (Juli 2026) — Geschichtsschreibung, keine
> Aufgabenliste.** Bleibt die belastbarste Quelle dafür, *warum* etwas so gebaut wurde.
> Was heute offen ist, steht in [`BACKLOG.md`](BACKLOG.md).

# Rebuild-Notes — Cockpit-Umbau

Protokoll je Phase gemäß [REBUILD-PLAN.md](REBUILD-PLAN.md).
Format: Was getan · Was entschieden · Was offen.

---

## Phase 0 — Branch, Cleanup, Baseline (2026-07-06)

**Getan:**
- Branch `cockpit-rebuild` von `main` erstellt.
- Duplikat-Ordner gelöscht: `app/src/three/regions 2`, `app/src/modules/intelligence 2`, `app/src/modules/promo 2` (Finder-Kopien, nicht importiert).
- Vorgefundene uncommittete Deploy-Configs von main mitgenommen: `app/vercel.json` (neu), `.vercel` in `.gitignore`, `engines.node: 22.x` in package.json.

**Entschieden:**
- Deploy-Configs werden als eigener Housekeeping-Commit übernommen (trivial, passt zur bestehenden Vercel-Deploy-Story aus HANDOFF.md).

**Offen:**
- —

---

## Phase 1 — Design-Tokens + Shell (2026-07-06)

**Getan:**
- `src/styles/cockpit.css`: Tokens (§4) gescoped unter `.ck-root` — kollidiert nicht mit alten Glas-Tokens. Utility-Klassen: ck-panel, ck-label, ck-dot (on/warn/pulse), ck-nav-item, ck-btn, ck-input, ck-select, ck-table.
- `src/cockpit/`: CockpitShell (fixed, volle Viewport, eigenes Scrolling), StatusBar (Wortmarke, CORE/SUPABASE/RUNNER-Status, Brand-Switcher, Uhr), NavRail (4 Bereiche + Universe-Rücklink bis Phase 6), 4 Platzhalter-Seiten.
- `src/cockpit/lib/activeBrand.tsx`: Brand-Kontext auf useBrands-Basis, localStorage-persistiert (Default: herrmann).
- `src/cockpit/lib/useRunnerStatus.ts`: pollt 127.0.0.1:4711/status (15s, 2.5s-Timeout) — zeigt ehrlich OFFLINE bis Phase 5.
- App.tsx: Cockpit-Routen unter OwnerWorkspaceShell (auth-geschützt), Canvas via `isCockpitPath()` auf Cockpit-Pfaden ausgeblendet.
- index.html: JetBrains Mono um 600/700 erweitert.

**Entschieden:**
- KEIN @fontsource-Paket nötig — JetBrains Mono war schon via Google Fonts geladen (nur Weights ergänzt). Eine Dependency gespart.
- Tokens gescoped statt global, damit alt+neu bis Phase 6 konfliktfrei koexistieren.

**Offen:**
- Visuelle Verifizierung der Shell im eingeloggten Zustand (Auth-Gate; Kevin loggt sich im Preview ein). Build grün, Routing verifiziert, Konsole sauber.

---

## Phase 2 — Cockpit-Home mit Daten-Graph (2026-07-06)

**Getan:**
- `d3-force` + `@types/d3-force` installiert (einzige neue Runtime-Dependency).
- `graph/ForceGraph.tsx`: Canvas-2D-Force-Graph (kein WebGL). Physik: manyBody, link, center, collide. Hub (aktive Brand) in der Mitte fixiert. Hover-Ring + Label, Klick-Hit-Testing, Puls-Ring für laufende Runs, ResizeObserver.
- `lib/graphData.ts`: Datenmodell (hub/deal/run/note) + Mock-Graph in exakt der Form, die Phase 3/5 liefern. Farbcodierung: Deals Grün, Runs helles Akzent-Grün, Notizen Blaugrau + Legende.
- `lib/goals.ts`: WEEK_TARGETS (150/25/5/2), Juli-Soll-Kurve (3k/11k/20k/30k), August-Kurve (50k back-loaded), CHANNEL_BENCHMARKS, currentSoll(). Wird von Phase 3 wiederverwendet.
- Panels: VitalsPanel (Progress + 14-Tage-Sparkline als inline-SVG), DocumentsPanel (Runs-Liste), CommandDeck (3 Buttons, disabled solange Runner offline), PrimaryDirective (Monatsumsatz vs. Soll, „Ernte folgt dem Lag"-Hinweis statt Alarm).
- CockpitHome: 3-Spalten-Grid (Vitals+Docs | Graph+Directive | Command Deck).

**Entschieden:**
- Klick-Verhalten: Deals → /crm, Notizen → obsidian://-URL, Runs → Panel folgt in Phase 5.
- Mock-Hooks (`useVitalsMock`) haben exakt die Ziel-Form, damit Phase 3 nur die Datenquelle tauscht.

**Offen:**
- Visuelle Verifizierung hinter Auth (wie Phase 1) — Kevin-Login im Preview ausstehend.

---

## Phase 3 — Tracking-Modul + daily_metrics (2026-07-06)

**Getan:**
- Migration `supabase/migrations/0049_daily_metrics.sql` (Owner-RLS nach 0009-Muster, unique (user,brand,datum), updated_at-Trigger). **Kevin muss sie manuell im Supabase-SQL-Editor ausführen.**
- `lib/useDailyMetrics.ts`: lädt laufenden Monat, optimistische Upserts (bump/setUmsatz), erkennt fehlende Tabelle (42P01) → UI zeigt Migrations-Hinweis statt Fehler.
- `lib/metricsAggregate.ts`: weekVitals, channelRates (mit Benchmarks), historySeries (14-Tage-Sparklines), cumulativeRevenue.
- `/tracking`: Heute-Eingabe mit +1-Steppern (Input/Ergebnis getrennt beschriftet: „Frühindikator" vs. „nachlaufend"), Umsatz-€-Feld, Wochen-Progress, `MonthCurve` (SVG: Ist kumuliert vs. Soll gestrichelt, KW-Marker), Kanal-Raten-Tabelle (grün ≥ Benchmark, amber darunter).
- CockpitHome: Vitals + Monatsumsatz jetzt aus echten daily_metrics; `useVitalsMock` gelöscht.

**Entschieden (Abweichungen vom Plan):**
1. **Migration heißt 0049, nicht 0014** — HANDOFF.md war veraltet, es existieren bereits 48 Migrationen (0014 ist vergeben: fix_discovery_feed).
2. **`antworten` je Kanal gesplittet** (antworten_li/inmail/ig/cold) statt ein Summenfeld — sonst wäre die Kanal-Antwortrate (der zentrale Steuerungshebel aus Kevins KPI-System) nicht berechenbar. 4 Stepper mehr, dafür echte Steuerbarkeit.

**Offen:**
- ~~Migration 0049 ausführen~~ ✅ 2026-07-06 von Kevin ausgeführt.
- ~~End-to-End-Test~~ ✅ verifiziert: Stepper-Klick → Supabase-Upsert → Reload → Wochen-Progress (Looms 1/25, Anfragen 1/150). Testwerte danach auf 0 zurückgesetzt.
- Nachtrag: Migrations-Erkennung brauchte zusätzlich PGRST205 (PostgREST-Schema-Cache), Fix committet (35df724). Responsive: Grids stapeln jetzt unter 1180/900px.

---

## Phase 4 — CRM- + E-Mail-Umzug (2026-07-07)

**Getan:**
- `hooks/useCurrentBrandSlug.ts`: Slug-Brücke (URL-Param → ActiveBrand-Context → localStorage). Sales-Seiten laufen damit unverändert in beiden Shells.
- 5 Sales-Seiten auf die Brücke umgestellt (SalesMode, ContactPage, ContactListsPage, CallModePage, SalesNewLeadPage) — je 1-2 Zeilen, Logik unangetastet.
- `/crm`: CrmArea mit Sub-Nav (Pipeline/Listen/Call-Mode/Neuer Lead) + Routen; Pipeline = `<SalesMode panel="full" scrollEmbed />`.
- `/email`: EmailArea mit Sub-Nav (Versand/Flows/Sequenzen) — Promo-Panels nehmen slug als Prop, **Promo-Code 0 Zeilen geändert**.
- `LegacySalesRedirect`: `/brand/:slug/sales/*` → `/crm/*` (übernimmt Slug als aktive Brand, /pipeline & /heute normalisiert auf Pipeline-Home). Interne Alt-Links in SalesMode bouncen damit korrekt.

**Entschieden:**
- Alte SalesMode-Optik (Glas-Stil) wird in Phase 4 NICHT re-skinned — nur in die Shell geholt. Tiefes Token-Angleichen wäre 2.500+ Zeilen Risiko; kommt ggf. nach v1.
- Promo-Routen (Ads, Content, Recruiting) bleiben unangetastet in der alten Welt — nur E-Mail ist umgezogen. Zukunft von Rest-Promo = Entscheidung nach v1 (wie Deliver).

**Verifiziert (eingeloggt, Preview):**
- /crm zeigt echte Pipeline (44 Kontakte, 3.800 € Pipeline-Wert, Kanban), /email echte Sequenzen/Vorlagen, Legacy-URL /brand/herrmann/sales/lists → /crm/lists. Konsole fehlerfrei.

---

## Phase 5 — Runner + Agenten-Buttons (2026-07-07)

**Getan:**
- `runner/index.mjs`: zero-dependency Node-Server (127.0.0.1:4711). POST /run (Agent-Whitelist, 409 bei Doppel-Start), GET /status, /runs (+laufende vorangestellt), /runs/:id, /vault/recent (exkl. System/.obsidian/.claude/Anhänge). Spawnt `claude -p "/<skill> + Input-JSON"` mit cwd=Vault, 10-min-Timeout, schreibt Ergebnis mit Frontmatter nach System/Runs/, Fehler-Runs mit stderr-Auszug.
- Root-package.json: `npm run cockpit` = concurrently(app dev + runner). Einzige neue Dev-Dependency: concurrently.
- **Design-Entscheidung: Runner captured stdout statt Skill-Writes.** Skills antworten NUR mit dem fertigen Markdown; der Runner persistiert. Dadurch brauchen Headless-Runs keine Write-Permission → Vault-settings.json: allow Read/Glob/Grep/WebSearch/WebFetch, deny Bash/Write/Edit. Sicher by default.
- **Design-Entscheidung: App liefert Daten als Input mit.** Wochenrecap bekommt weekRows+Ziele+Soll, Follow-ups bekommt wartende Kontakte (Stage follow_up oder next_follow_up_at fällig, max 10) — keine Supabase-Credentials im Vault nötig, RLS bleibt sauber.
- 3 Skills im Vault (`~/Second Brain/.claude/skills/`): wochenrecap, followup-entwuerfe, lead-research (mit WebSearch + Loom-Aufhänger). Deutsch, Output = 1:1 speicherbare Note.
- UI: runnerApi.ts, useRunnerData (Poll 20s, 5s bei aktiven Runs), CommandDeck live (Puls bei laufendem Agent, Lead-Research-Eingabefeld), RunDrawer (Markdown + Copy, Esc), Graph jetzt echt: Deals = CRM-Kontakte in conversation/follow_up/proposal (Klick → /crm/:id), Runs (Klick → Drawer), Notizen (Klick → obsidian://). Mock nur noch als Offline-Fallback.

**Verifiziert (E2E, Definition-of-Done Punkt 3):**
- Wochenrecap-Button geklickt → Run „läuft…" in Documents → nach 54s fertiges Recap in `System/Runs/2026-07-07-101023-wochenrecap.md` (Frontmatter korrekt, Inhalt stark: ehrliche Null-Analyse, Aufhol-Rechnung 38 Anfragen/Tag) → in Documents klickbar → RunDrawer rendert Markdown inkl. GFM-Tabelle (remark-gfm nachinstalliert).
- Hinweis: Skills + settings.json liegen im Vault (~/Second Brain/.claude/) — werden dort von Obsidian Git versioniert, nicht in diesem Repo.

**Offen:**
- followup-entwuerfe + lead-research Buttons noch nicht E2E getestet (gleicher Mechanismus; Kevin testet im Alltag).

---

## Phase 6 — Abriss Three.js + Denk-Modi (2026-07-07)

**Gelöscht:**
- `src/three/` komplett, `pages/UniversePage`, `pages/building/` (11 Dateien), `pages/discovery/`, `pages/intelligence/`, `modules/intelligence/`, `components/sections/{Foundation,Intelligence}Section`, `store/worldCamera`.
- Dependencies: three, @react-three/fiber, @react-three/drei, @react-three/postprocessing, postprocessing, @types/three.

**Umgebaut:**
- App.tsx: Canvas/World/worldCamera raus — reines DOM-Layout. `/` → Redirect /cockpit. foundation/building/discovery/intelligence-Routen → Redirect /cockpit. g-Shortcuts: g c/s/e/t → Cockpit-Bereiche, g p → Deliver.
- BrandScrollFlow: Foundation/Intelligence-Sections entfernt (Dashboard/Promo/Sales/Deliver bleiben).
- CommandPalette: Denk-Modi-Einträge raus, Cockpit/CRM/E-Mail/Tracking-Einträge rein, Universe-Eintrag ersetzt.
- registry.tsx: Intelligence-Module deregistriert.

**Behalten (wie geplant):** Portal, Booking, Lead-Intake, Login/Onboarding, Deliver (Legacy über /brand/:slug/deliver), Rest-Promo (Legacy).

**Ergebnis:**
- Bundle: **4.174 kB → 3.022 kB** (gzip 1.178 → 834 kB), −28%.
- Verifiziert: / → /cockpit, Deliver-Legacy zeigt echte Projekte, frischer Dev-Server ohne Konsolen-Fehler, tsc + Build grün.

---

## Phase 7 — Dream-Karte (2026-07-07)

**Getan:**
- Skill `dream-check` im Vault: analysiert Agenten-Nutzung (recentRuns als Input), Skill-Bestand + Daily-Note-Hygiene; max. 2 Vorschläge, unter 200 Wörter, „Heute nichts — System läuft." erlaubt (kein Vorschlags-Zwang).
- Runner: `maybeDream()` beim Start (5s verzögert), prüft ob heute schon ein dream-check-Run existiert → max. 1×/Kalendertag.
- `DreamCard`: EINE Karte unterm Command Deck, nur bei heutigem done-Run, Klick → RunDrawer, Dismiss merkt Run-Id in localStorage. Bewusst kein eigenes Dashboard (Plan §8).

**Verifiziert (E2E):** Runner-Neustart → dream-check lief automatisch (33s) → Vorschläge sind ECHT verifizierbar (ungenutzte Buttons korrekt erkannt; Daily Notes seit 2026-06-09 leer — stimmt). Karte erscheint im Cockpit unter dem Command Deck, Klick öffnet Drawer, Dismiss funktioniert per localStorage.

---

## v1.1 — Kevins Feedback-Runde (2026-07-07)

**Getan:**
- UX-Fixes: Umsatz-Ziel in die linke Zielspalte (kompakt + Progress), QuickTrack (6 Input-Zähler) im Cockpit, Obsidian-Klick via Anchor (kein App-Hänger mehr).
- **Chat-Blase** (Backlog #1): Migration 0050 (chat_threads mit optionaler contact_id + chat_messages), useChatThreads, ChatBubble unten rechts in der ganzen Shell. Antwort-Motor = bestehende brand-assistant Edge Function (Brand-DNA-Stimme, kein Deploy nötig); Kontakt-Kontext (Stage/Entscheider/Follow-up) als Präambel. Cmd+Enter senden, Threads archivierbar.
- **RunWatcher**: Toast in der ganzen Shell, wenn ein Agent-Run fertig/fehlgeschlagen ist.
- **Runner-Autostart**: `scripts/install-runner-autostart.sh` → launchd-Agent `de.uriel.runner` (RunAtLoad + KeepAlive, Logs unter ~/Library/Logs/kevin-os/). Installiert + verifiziert. Hinweis: `npm run cockpit` startet dann einen zweiten Runner, der am belegten Port scheitert — harmlos, App nutzt den launchd-Runner.

**Offen:**
- ~~Migration 0050~~ ✅ ausgeführt. Blase E2E getestet: ganze Kette funktioniert (Thread anlegen, Nachricht senden, Persistenz), ABER **brand-assistant liefert Anthropic 401 „invalid x-api-key"** — der ANTHROPIC_API_KEY in den Supabase-Edge-Secrets ist ungültig/rotiert. Betrifft ALLE KI-Edge-Functions (auch discovery-agent), bestand schon vor dem Umbau. **Kevin: neuen Key setzen** (Dashboard → Edge Functions → Secrets, oder `supabase secrets set ANTHROPIC_API_KEY=sk-ant-…`), dann Blase erneut testen.
- Entschieden gegen: Terminal (Blase deckt Use Case), Google Drive (kein konkreter Schmerz — Foundation-Lektion).

---

## Graph v2 — Obsidian-Gefühl (2026-07-07)

**Getan:**
- Runner: `GET /vault/graph` — liest die 100 zuletzt geänderten Notizen, parst `[[Wikilinks]]` (inkl. Alias/Abschnitt-Syntax), 60s-Cache. Ergebnis real: 92 Notizen, 84 echte Kanten (Top-Hub: ClientOS-Workflow mit 18 Links).
- ForceGraph v2: **Zoom** (Wheel, zum Cursor), **Pan** (Hintergrund ziehen), **Node-Drag** (Physik übernimmt beim Loslassen), Klick-vs-Drag-Unterscheidung, Labels stufig (Hub immer, Hover immer, gut vernetzte ab Zoom 1.15), Kanten-/Linienstärken zoom-kompensiert.
- buildGraph: Notizen OHNE künstliche Hub-Kante — Cluster entstehen aus echten Links wie in Obsidian; Gewicht nach Vernetzungsgrad. Deals/Runs bleiben am Brand-Hub.
- **Bugfix:** useRunnerData wechselt State-Referenzen nur bei echten Änderungen — vorher baute der 20s-Poll den Graphen neu auf und warf Zoom/Pan/Layout weg.

**Verifiziert:** /vault/graph liefert echte Struktur, Zoom hält jetzt über Polls, Konsole sauber, Build grün.

---

## Definition of Done (v1) — Abnahme 2026-07-07

1. ✅ `npm run cockpit` startet App + Runner; Statusleiste zeigt RUNNER alive (grüner Punkt).
2. ✅ Tracking-Eintrag beeinflusst Cockpit-VITALS + Wochen-Progress (E2E Phase 3).
3. ✅ Klick „Wochenrecap" → Markdown in System/Runs/ + Obsidian + klickbar im Cockpit (Graph + Documents + Drawer).
4. ✅ CRM + E-Mail voll funktionsfähig in der neuen Shell, alte URLs redirecten.
5. ✅ Kein Three.js, keine Denk-Modi mehr im Bundle (−28%, keine Glas-Panels im Cockpit).
6. ⏳ Obsidian-Web-Viewer-Test: macht Kevin (localhost:5173 im Obsidian-Tab öffnen — technisch identisch zum Browser).
