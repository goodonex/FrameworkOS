> **Abgeschlossen (Phasen 0–7, Juli 2026) — offene Punkte stehen in
> [`BACKLOG.md`](BACKLOG.md).** Gültig bleiben das Design-System (§4, verbindlich)
> und die Regeln für ausführende Sessions (§11). Bestandsaufnahme (§2) und
> v2-Backlog (§12) sind überholt: real sind Migrationen bis 0066.

# REBUILD-PLAN — Uriel → Cockpit

**Stand:** 2026-07-06 · erarbeitet mit Claude (Session „KPI-Tracking → Agentic OS")
**Ausführung:** Claude Code, Session im Repo-Root starten, Phasen strikt in Reihenfolge.
**Play-Button:** `cd ~/Kevin OS/02 Projekte/uriel && claude` → „Lies docs/REBUILD-PLAN.md und starte mit Phase 0."

---

## 1. Warum dieser Umbau (Kontext für die ausführende Session)

Uriel wollte Gehirn UND Hände sein. Die Denk-Modi (Foundation, Building,
Discovery-UI, Intelligence) kann Obsidian besser — sie fühlen sich in der App leer an.
Die Planeten-/Three.js-UI hat massive Lesbarkeitsprobleme verursacht.

**Neue Arbeitsteilung:**
- **Obsidian (~/Second Brain)** = Denken. Strategie, Notizen, Wissen.
- **Diese App** = Tun. CRM, E-Mail, Sales-Tracking, Agenten-Buttons.
- **Claude Code** = verbindet beide (headless Runner, siehe §6).

**Visuelle Referenzen (3 YouTube-Videos, entschieden):**
- Chase AI „V.A.U.L.T." → Design-Sprache: Mission Control, Monospace, HUD.
- Zubair „Jarvis" → der zentrale Kern ist ein ECHTER klickbarer Daten-Graph, keine Deko.
- Jack „Claude OS" → „Dream"-Idee als kleiner Baustein (tägliche Selbst-Verbesserungs-Karte).
- **Keine Sprachsteuerung in v1** (bewusst entschieden, kommt evtl. in v2).

---

## 2. Bestandsaufnahme (verifiziert am 2026-07-06)

| Was | Detail |
|---|---|
| Repo | goodonex/uriel · lokal `~/Kevin OS/02 Projekte/uriel` |
| Frontend | `app/` — Vite 8, React 19, TypeScript, Tailwind 3, Zustand, React Router 7, Supabase-Client, Framer Motion, TipTap, dnd-kit |
| Backend | `supabase/` — Migrationen 0001–0013, 13 Edge Functions |
| Umfang | ~77.500 Zeilen TS/TSX gesamt; Three.js-Anteil nur ~2.600 Zeilen |
| Build | `cd app && npm run build` (= `tsc -b && vite build`) |
| Node | 22.x |
| Vault | `~/Second Brain` (goodonex/second-brain), PARA-Struktur, Obsidian Git |

**Edge Functions (bleiben ALLE unangetastet):** brand-assistant, discovery-agent,
discovery-feed-refresh, email-inbound, foundation-ai, icp-swarm, invite-client,
lead-intake, marketing-ai, process-sequences, send-email, track-click, track-open.

**Duplikat-Müll (in Phase 0 löschen):** `app/src/three/regions 2`,
`app/src/modules/intelligence 2`, `app/src/modules/promo 2`.

---

## 3. Ziel-Architektur

```
┌─────────────────────────────────────────────────────────┐
│  Browser / Obsidian-Web-Viewer-Tab (localhost)           │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Cockpit-App (Vite/React, neue Shell)              │  │
│  │  Cockpit · CRM · E-Mail · Tracking                 │  │
│  └───────┬──────────────────────────┬─────────────────┘  │
└──────────┼──────────────────────────┼────────────────────┘
           │                          │
   ┌───────▼────────┐        ┌────────▼─────────────────┐
   │ Supabase Cloud │        │ Lokaler Runner (Node)    │
   │ CRM, E-Mail,   │        │ 127.0.0.1:4711           │
   │ daily_metrics  │        │ spawnt `claude -p` mit   │
   │ (bestehend)    │        │ cwd = ~/Second Brain     │
   └────────────────┘        │ + Vault-Lese-API         │
                             └────────┬─────────────────┘
                                      │ liest/schreibt
                             ┌────────▼─────────────────┐
                             │ ~/Second Brain (Vault)   │
                             │ System/Queue/  (Intents) │
                             │ System/Runs/   (Outputs) │
                             │ .claude/skills/ (Agenten)│
                             └──────────────────────────┘
```

- **Lokal-first:** Kein Cloud-Deploy in v1. App + Runner laufen auf dem Mac.
  Hostinger-VPS ist v2 (Handy-Zugriff) — dann OHNE `claude -p` (API/Edge statt Max-Plan).
- **Wichtig:** Der Browser kann NICHT direkt ins Dateisystem. Alle Vault-Zugriffe
  (Runs lesen, Notizen listen) laufen über die Runner-HTTP-API.
- Runner bindet ausschließlich an 127.0.0.1. CORS nur für localhost-Origins.

---

## 4. Design-System („Mission Control")

**Verbindliche Regeln — jede Abweichung ist ein Bug:**
- Grund: `#050708` (App) / `#0b0e10` (Panels). Panels mit 1px-Border `#1a2023`,
  Radius 8px. **KEINE** Glas-/Blur-/Transparenz-Effekte. **KEIN** Three.js/WebGL.
- Schrift: JetBrains Mono (npm-Paket `@fontsource/jetbrains-mono`, lokal gebundelt).
  Micro-Labels: 10–11px, UPPERCASE, letter-spacing 0.08em, Farbe Text-Stufe 3.
- Text-Stufen: `#f2f4f5` (primär) / `#9aa4a8` (sekundär) / `#5c676c` (Labels).
  Kontrast immer ≥ 4.5:1 gegen den jeweiligen Grund — bei jedem Farbwert prüfen.
- Akzent: Phosphor-Grün `#34d399`. Zustände: idle = Blaugrau `#64748b`,
  running = Grün pulsierend, error = Amber `#f59e0b`. Nur diese Palette.
- Bewegung NUR an zwei Stellen: Graph-Physik im Kern + Puls laufender Agent-Jobs.
- Tabellen/Listen in CRM & E-Mail bleiben konventionell lesbar — HUD-Stil ist
  Rahmen/Chrome, niemals Hindernis. Zeilenhöhe ≥ 36px, keine Mono-Pflicht im Fließtext.

---

## 5. Informationsarchitektur — 4 Bereiche

### 5.1 ⚡ Cockpit (`/cockpit`, Startseite)
- **Top-Statusleiste:** Wortmarke links („URIEL"),
  Mitte Status-Wörter mit Punkt-Indikator: `CORE`, `SUPABASE`, `RUNNER` (alive-Check
  gegen Runner-API), rechts große Uhr + Datum.
- **Mitte — der Graph (Herzstück):** Force-Directed-Graph mit `d3-force`
  (einziges erlaubtes neues Paket neben der Font). Echte Knoten, klickbar:
  - CRM-Deals im Status offen/verhandelt (→ Klick öffnet Kontakt in /crm)
  - aktive + letzte 10 Agent-Runs (→ Klick öffnet Ergebnis-Panel)
  - letzte 15 geänderte Vault-Notizen via Runner-API (→ Klick öffnet Obsidian
    via `obsidian://open?vault=Second%20Brain&file=...`)
  - Farbcodierung: Deals = Grün-Töne, Runs = Akzent, Notizen = Blaugrau.
    Legende als Micro-Label-Zeile. Laufender Run pulsiert.
- **Links SYSTEM VITALS:** Looms Woche x/25, Anfragen Woche x/150, Termine x/5,
  Abschlüsse x/2 — je mit 14-Tage-Mini-Sparkline (SVG, kein Chart-Paket).
  Darunter DOCUMENTS: letzte 5 Runs als Liste.
- **Rechts COMMAND DECK:** Agenten-Buttons (§7). Darunter DREAM-Karte (§8).
- **Unten PRIMARY DIRECTIVE:** kumulierter Monatsumsatz groß + aktuelles Wochen-Soll.

### 5.2 👥 CRM (`/crm/...`)
Umzug der bestehenden Sales-Module: Pipeline, Kontakte, Listen, Call-Mode,
Kontakt-Detail (`src/modules/sales`, `src/components/sales`, `src/pages/sales`).
**Logik & Hooks NICHT neu schreiben** — nur in neue Shell + Design-System einkleiden.
Alte Routen `/brand/:slug/sales/*` → Redirects.

### 5.3 ✉️ E-Mail (`/email/...`)
Umzug aus Promo: Versand, Sequenzen/Flows, Open/Click-Auswertung
(`src/modules/promo`). Edge Functions (send-email, process-sequences, track-open,
track-click, email-inbound) unverändert weiternutzen. Redirects wie bei CRM.

### 5.4 📊 Tracking (`/tracking`)
Neu. Datenmodell + UI siehe §9.

### 5.5 Was mit dem Rest passiert
- **Löschen (Phase 6):** `src/three` komplett; Module/Routen/Komponenten von
  Foundation, Building, Discovery-UI, Intelligence; alle dadurch toten Imports;
  `three`, `@react-three/*`, `postprocessing` aus package.json.
- **Behalten, unangetastet:** Portal (`/portal/:projectId/*`), Booking
  (`/book/...`), Lead-Intake (`/leads/...`), Login/Reset/Onboarding.
- **Deliver:** NICHT in die neue Nav, NICHT neu einkleiden, NICHT löschen.
  Bleibt als Legacy-Route `/deliver` erreichbar (Portal hängt an Projekten).
  Entscheidung über Zukunft nach v1 — in rebuild-notes.md vermerken.

---

## 6. Der Runner (lokal, neu)

- Ordner `runner/` im Repo-Root. Eigenes kleines package.json (express o. hono),
  Start: `npm run cockpit` (startet Runner + Vite parallel, z.B. via concurrently).
- Konfig über `runner/.env`: `VAULT_PATH=/Users/kevinherrmann/Second Brain`,
  `PORT=4711`. `.env` in .gitignore.
- **API:**
  - `POST /run { agent: string, input?: object }` → legt Intent-JSON in
    `<Vault>/System/Queue/` ab, spawnt `claude -p "/<agent-skill> <input>"`
    mit `cwd=VAULT_PATH`, streamt Status.
  - `GET /status` → `{ alive: true, running: [...], queued: [...] }`
  - `GET /runs?limit=20` → Liste aus `<Vault>/System/Runs/` (Dateiname, Datum,
    Agent, erste Zeilen als Preview)
  - `GET /runs/:id` → voller Markdown-Inhalt
  - `GET /vault/recent?limit=15` → zuletzt geänderte .md im Vault (für den Graphen;
    `System/` und `.obsidian/` ausschließen)
- Output-Konvention: Jeder Agent schreibt nach
  `<Vault>/System/Runs/JJJJ-MM-TT-HHmm-<agent>.md` mit Frontmatter
  (`agent`, `status: done|error`, `started`, `finished`).
- **Headless-Permissions:** Im Vault `.claude/settings.json` so konfigurieren,
  dass die Agenten-Skills ohne interaktive Prompts laufen (Write auf Vault-Pfade
  erlauben, WebSearch erlauben, Supabase-REST via Bash/curl erlauben). Ohne das
  hängt `claude -p` still — zuerst mit einem Mini-Skill verifizieren.
- Fehlerfall: Non-Zero-Exit oder Timeout (10 min) → Run-Datei mit `status: error`
  + stderr-Auszug schreiben, UI zeigt Amber.

---

## 7. Die drei Agenten (Skills im Vault, `~/Second Brain/.claude/skills/`)

Deutsch, kompakt, Output immer als Markdown nach System/Runs/ (Konvention §6).
Supabase-Zugriff via REST (Service-Role-Key aus `.env` im Vault-Skill-Kontext
oder anon-Key + RLS-fähige Abfragen — beim Bauen entscheiden, in rebuild-notes
dokumentieren).

1. **`wochenrecap`** — liest daily_metrics der laufenden Woche (Supabase) +
   Daily Notes der Woche (`06 Daily Notes/`). Schreibt: Zahlen vs. Wochenziel
   (150/25/5/2 + Umsatz-Soll), was lief, was nicht, 3 Fokus-Punkte nächste Woche.
2. **`followup-entwuerfe`** — liest CRM-Kontakte mit Status „wartet auf Follow-up"
   (Supabase). Schreibt je Kontakt einen kurzen, persönlichen Follow-up-Entwurf
   (Kanal-passend: LinkedIn-DM kürzer, E-Mail etwas länger). Max 10 pro Run.
3. **`lead-research`** — Input: Name/Firma/URL (aus Button-Dialog). Web-Recherche,
   schreibt kompaktes Briefing: Firma, Rolle, Anknüpfungspunkte, 2 Personalisierungs-
   Hooks für die Erstnachricht, Loom-Aufhänger-Vorschlag.

Command Deck v1 = genau diese 3 Buttons + „Dream anzeigen". Nicht mehr.
Jeder weitere Button ist v2 (das Muster ist dann trivial erweiterbar).

---

## 8. Dream-Karte (klein, bewusst begrenzt)

- Beim Runner-Start (max. 1× pro Kalendertag) läuft ein vierter Skill
  **`dream-check`**: liest die letzten ~10 Claude-Code-Session-Zusammenfassungen
  (`~/.claude/projects/...` bzw. was lokal zugänglich ist) + Skill-Ordner des Vaults.
  Schreibt 1–2 Vorschläge („Handgriff X kam 3× vor → Skill draus machen?",
  „Skill Y seit 30 Tagen ungenutzt → archivieren?") nach System/Runs/.
- UI: EINE Karte im Command Deck („DREAM · heute"), aufklappbar, Dismiss-Button.
- Ausdrücklich KEIN eigenes Dashboard, KEINE sechs Pillars, KEINE Kosten-Analytik.

---

## 9. Tracking-Modul (Datenmodell + UI)

**Migration `0014_daily_metrics.sql`:**
```sql
create table daily_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  brand_id uuid not null,
  datum date not null,
  li_anfragen int not null default 0,
  inmails int not null default 0,
  ig_anfragen int not null default 0,
  coldmails int not null default 0,
  followups int not null default 0,
  looms int not null default 0,
  antworten int not null default 0,
  quali_termine int not null default 0,
  sales_calls int not null default 0,
  abschluesse int not null default 0,
  umsatz numeric not null default 0,
  note text,
  unique (user_id, brand_id, datum)
);
-- RLS analog zu bestehenden Tabellen (Muster aus 0009 übernehmen)
```

**Migration `0015_agent_runs.sql`** (nur falls Runs zusätzlich in Supabase
gespiegelt werden sollen — Standard ist Vault-only; beim Bauen entscheiden,
Default: WEGLASSEN, Vault reicht für v1).

**UI `/tracking`:**
1. **Heute-Eingabe:** +1-Stepper je Feld (für schnelles Zählen zwischendurch),
   Felder in Kanal-Reihenfolge: LinkedIn, InMail, Instagram, Cold-Mail, Follow-ups,
   Looms | Antworten, Quali-Termine, Sales-Calls, Abschlüsse, Umsatz (€-Input).
2. **Wochenansicht:** Progress-Bars gegen Ziele — Anfragen gesamt x/150,
   Looms x/25, Termine x/5, Abschlüsse x/2.
3. **Monatsansicht:** kumulierte Ist-Umsatz-Kurve gegen Soll-Kurve.
   **Juli-Soll (fest verdrahtet, später konfigurierbar):**
   KW28 → 3.000 € · KW29 → 11.000 € · KW30 → 20.000 € · KW31 → 30.000 €.
   August-Ziel: 50.000 € (Soll-Kurve analog back-loaded generieren).
4. **Antwortrate je Kanal** (Antworten ÷ Anfragen, sobald ≥ 2 Wochen Daten):
   Benchmarks als Referenzlinien — LinkedIn 15–25%, InMail 10–25%, IG 10–15%,
   Cold-Mail 4–8%. Loom→Termin 10–30%. Quali→Sales 75%, Sales→Close 75%.
5. Cockpit-VITALS (§5.1) ziehen aus denselben Hooks.

**Fachliche Logik (in UI-Texten berücksichtigen):** Umsatz ist nachlaufend
(~1–2 Wochen Sales-Lag). Frühindikator = Looms/Anfragen. Wenn Umsatz unter Soll,
aber Input voll → Hinweis „Ernte kommt, kein Alarm" statt Rot.

---

## 10. Phasen (nach JEDER Phase: Build grün + Commit)

Konvention: Branch `cockpit-rebuild` · Commits `phase(N): <was>` ·
Protokoll je Phase in `docs/rebuild-notes.md` (was getan, was entschieden, was offen).
Build-Check: `cd app && npx tsc -b && npm run build`.

| Phase | Inhalt | Fertig wenn |
|---|---|---|
| **0** | Branch, Duplikat-Ordner löschen, rebuild-notes.md anlegen | Build grün auf sauberem Branch |
| **1** | Design-Tokens (§4) + neue Shell: Statusleiste, Nav (4 Bereiche), Routing-Gerüst, Brand-Switcher; alte Routen funktionieren weiter | Shell klickbar, alte App erreichbar |
| **2** | Cockpit-Home: d3-force-Graph mit Mock-Daten, VITALS/DOCUMENTS/COMMAND-DECK-Placeholder, PRIMARY DIRECTIVE | Graph rendert, 60fps, klickbare Mock-Knoten |
| **3** | Tracking: Migration 0014 (manuell in Supabase ausführen!), Eingabe + Wochen-/Monatsansicht + Soll-Kurve; Cockpit-VITALS auf echte Daten | Eintrag heute → erscheint in Woche + Cockpit |
| **4** | CRM-Umzug nach /crm, E-Mail-Umzug nach /email, Redirects | Beide Bereiche voll nutzbar im neuen Look |
| **5** | Runner bauen (§6), 3 Skills anlegen (§7), Command Deck live, Runs als Graph-Knoten + DOCUMENTS | Button → Run läuft → Ergebnis-MD im Vault + UI |
| **6** | Abriss (§5.5): three + Denk-Modi raus, Deps bereinigen, Redirects final | tsc + Build grün, keine Konsolen-Fehler, Bundle deutlich kleiner |
| **7** | dream-check-Skill + Dream-Karte (§8) | Karte erscheint 1×/Tag mit echtem Vorschlag |

**Definition of Done (v1):**
1. `npm run cockpit` startet App + Runner; Statusleiste zeigt RUNNER alive.
2. Tracking-Eintrag von heute beeinflusst Cockpit-VITALS + Wochen-Progress.
3. Klick „Wochenrecap" → Markdown erscheint in `System/Runs/` UND in Obsidian
   UND als Knoten im Graph.
4. CRM + E-Mail voll funktionsfähig im neuen Design, alte URLs redirecten.
5. Kein Three.js, keine Denk-Modi, kein Glas-Panel mehr im Bundle.
6. App im Obsidian-Web-Viewer geöffnet = identisch nutzbar.

---

## 11. Regeln für die ausführende Session

1. Bestehende Hooks/Datenlogik wiederverwenden — nicht neu erfinden.
2. Neue Pakete NUR: `d3-force`, `@fontsource/jetbrains-mono`, Runner-Framework
   (express/hono), `concurrently`. Alles andere braucht Begründung in rebuild-notes.
3. Lesbarkeit > Effekt. Im Zweifel die langweiligere, kontrastreichere Variante.
4. Migrationen nie automatisch remote ausführen — SQL bereitstellen, Kevin führt
   sie im Supabase-Dashboard aus (bestehende Projekt-Konvention).
5. Nichts löschen vor Phase 6. Bis dahin koexistieren alt + neu.
6. Bei Unklarheit: Annahme treffen, in rebuild-notes.md dokumentieren, weiterbauen.

## 12. v2-Backlog (NICHT in diesem Umbau)

**Priorisiert nach Kevins Feedback vom 07.07.2026:**
1. **Chat-Blase unten rechts (LinkedIn-Style)** — mehrere Threads, je Thread optional an CRM-Kontakt gebunden; LinkedIn-Chat reinkopieren → on-brand-Antwortvorschlag. Threads in Supabase (chat_threads/chat_messages), Runner-Endpoint POST /chat mit Thread-Historie + Kontakt-Kontext. Löst das alte „Skill-Cockpit"-Konzept ein. DER nächste Hebel für die 3h-Akquise.
2. **Runner-Autostart (launchd)** + Fertig-Toast im Cockpit, wenn ein Run done ist — größter Seamless-Killer ist ein offline-Runner.
3. **Graph v2 „Obsidian-Feeling"**: Runner parst [[Wikilinks]] → echte Kanten zwischen Notizen (statt Hub-Stern), Drag/Zoom/Pan, mehr Knoten, Cluster-Farben nach Ordner.
4. ~~Follow-up-Button direkt am CRM-Kontakt~~ ✅ umgesetzt 07.07.
5. **CRM-Datenhaltung bereinigen (aus Review 07.07.):** useContacts hält Supabase + localStorage doppelt mit Merge/Resurrect/Enrich-Logik (Relikt der Vor-Migrations-Zeit). Risiken: Geister-Kontakte über Geräte hinweg, stille Divergenz im localOnly-Modus (aktuell nur per Warnung entschärft). Ziel: Supabase = einzige Wahrheit, localStorage nur Lese-Cache; resurrect/enrich/Tombstones entfernen. Eigener Arbeitsschritt (~0,5–1 Tag) mit manuellem Test der Pipeline-Flows — NICHT nebenbei machen.

**Unpriorisiert:**
- Sprachsteuerung (Wake-Word, Barge-in, ElevenLabs — Referenz: Jarvis-Video)
- VPS-Deploy für Handy-Zugriff (dann Agent-Runs via API statt `claude -p`)
- Weitere Buttons: Inbox-Brief, KPI-Rollup, Plan-Today, Content-Repurpose
- Google-Calendar-Sync (Time-Blocks „Sales 9–13" → DIRECTIVES im Cockpit)
- Google-Drive-Kundenanbindung — BEWUSST zurückgestellt: kein konkreter Workflow-Schmerz benannt; erst bauen, wenn ein echter Fall da ist (Foundation-Lektion)
- Claude-Code-Terminal im Cockpit — verworfen zugunsten der Chat-Blase (deckt den Use Case ohne PTY-Komplexität)
- agent_runs-Spiegelung nach Supabase, Runs-Historie/Analytics
- Deliver-Entscheidung (behalten/umbauen/entfernen)
