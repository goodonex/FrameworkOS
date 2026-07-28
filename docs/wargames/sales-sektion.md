# Wargame: Sales-Sektion (CRM → Sales + Dashboard + Bibliothek + neue Agenten)

Stand: 24.07.2026 · Durchgespielt von Fable 5 (Denk-Session) · Executor: Sonnet, blind ausführbar
Grundlage: Recon am Live-Code (Branch `cockpit-rebuild`, Commit `53e3706` + uncommittete Heartbeat-Änderungen)

> **WARGAME-ORDER.** Diese Mission wird NICHT hier ausgeführt, sondern wurde Zug für Zug durchgespielt.
> Ein Executor arbeitet die Blaupause unten ab. Jeder Zug nennt: erwartete Beobachtung (Erfolg/Fehlschlag),
> wahrscheinlichsten Fehler + Signal + Gegenzug, Trigger je Weggabelung. Am Ende: Verifikation, Red-Team,
> Abbruchbedingungen, LEDGER.

## Mission in einem Satz

Die NavRail-Sektion **CRM wird zur Sales-Sektion** (`/sales`) mit einem **Sales-Dashboard** (Sales-Agenten
per Klick starten, Funnel-Quoten, LinkedIn-Leads-Status), einer **Bibliothek** (Erstnachrichten, Follow-ups,
Loom-Skripte aus Vault + Sales-Skripte-Ordner, ohne Finder/Vorschaufenster) und **zwei neuen Runner-Agenten**
(`loom-skript`, `followup-pdf`) — das bestehende CRM (Pipeline/Listen/Call-Mode/Kontakte) lebt als Sub-Tabs darin weiter.

## Entschiedene Weichen (von Fable entschieden, Kevin kann einzeln vetoen)

- **① Nav:** NavRail-Eintrag „CRM" → **„Sales"**, `to: '/sales'`, Icon `▤` bleibt. Nav-Anzahl unverändert
  (9 + Universe) → Mobile-Bottom-Bar bleibt intakt. *Verworfen:* zusätzlicher Nav-Eintrag (Mobile-Bar war bei 10 Tabs schon zu eng, siehe Nav-Gruppierung 20.07.).
- **② Routen:** `/sales` = Dashboard (NEU, Index), `/sales/pipeline` = bisheriges `/crm`-Index (SalesMode),
  bestehende Sub-Slugs bleiben wortgleich (`lists`, `lists/:listId`, `call-mode`, `new`, `:contactId`),
  NEU `/sales/bibliothek`. *Verworfen:* Sub-Slugs eindeutschen (`listen` …) — hätte nur die Redirect-Map aufgebläht.
- **③ Legacy-Redirect:** Route `/crm/*` bleibt bestehen und leitet um: `/crm` → `/sales/pipeline`,
  `/crm/<rest>` → `/sales/<rest>`. `LegacySalesRedirect` (Brand-Welt) zielt neu auf `/sales`.
  Grund: Bookmarks, UrielDock-Sprachbefehle, evtl. gemerkte Deep-Links.
- **④ Dashboard-Inhalt (aufgeräumt nach der Home-Refactor-Lektion „ein Thema, ein Ort", Commit `53e3706`):**
  genau DREI Panels — (a) **SalesAgentsPanel** (Buttons + Eingaben + letzte Sales-Runs in EINEM Panel,
  1:1 nach dem `AgentsPanel.tsx`-Muster), (b) **ConversionPanel** (bestehende Komponente wiederverwendet,
  Funnel vs. Coach-Ziele), (c) **BibliothekQuickPanel** (3–4 Karten → springen nach `/sales/bibliothek`).
  Tracking bleibt unangetastet (ConversionPanel darf dort weiterleben — Tracking = Eingabe-Welt, Sales = Steuerungs-Welt).
  *Verworfen:* VitalsPanel/HeuteDeck aufs Sales-Dashboard doppeln — exakt die Doppelung, die der Home-Refactor entfernt hat.
- **⑤ Neue Agenten:** `loom-skript` + `followup-pdf` als **write-Agenten** (Muster `weekly-content`:
  scoped cwd + eigene `.claude/settings.json`, `--permission-mode acceptEdits`, KEIN Blanket-Bypass).
  cwd = neuer `SALES_ROOT` (Sales-Skripte-Ordner). Die Fach-Logik (5-Akt-Loom, V2-Rubrik) lebt im Prompt
  im `AGENT_CATALOG`, NICHT in neuen Vault-Skills — ein Ort weniger, der driften kann.
- **⑥ LinkedIn-Leads:** headless vermutlich NICHT ausführbar (Skill braucht Kevins echtes Chrome via
  claude-in-chrome). Deshalb: **Status-Karte immer** (letzte Runde + Anzahl Leads aus dem Vault),
  **Ausführen-Button nur, wenn RECON-Zug 6 besteht**. Kein „Button der still kaputte Runs produziert".
- **⑦ UrielDock:** `navigate`-Enum bekommt `sales`; `crm` bleibt als **Alias** im Enum (mappt auf `/sales`) —
  Sprachbefehl „öffne CRM" funktioniert weiter.

## Grundlegende Realitäts-Randbedingungen (aus Recon, gelten für ALLE Züge)

- **R1 — Arbeitsstand ist heiß.** Working Tree auf `cockpit-rebuild` enthält UNCOMMITTETE Heartbeat-Arbeit:
  `runner/index.mjs` (M), `app/src/cockpit/lib/useRunnerStatus.ts` (M), `app/src/hooks/useBrands.ts` (M),
  `app/src/lib/supabaseErrors.ts` (M), `supabase/migrations/0057_runner_heartbeat.sql` (??).
  **Niemals `git checkout`/`git stash`/`git restore` auf diese Dateien. Alle Edits additiv auf dem
  aktuellen Working-Tree-Stand.** Kein Commit ohne Kevins ausdrückliches Wort.
- **R2 — Runner ist lokal-only + braucht Neustart.** `RUNNER_BASE_URL = 'http://127.0.0.1:4711'` hart
  verdrahtet. Neue Runner-Endpoints/Katalog-Einträge greifen erst nach
  `launchctl kickstart -k gui/$(id -u)/de.uriel.runner` (kein Hot-Reload). Zum Testen ohne launchd:
  `PORT=4790 node runner/index.mjs` als Zweitinstanz.
- **R3 — Pfade mit Sonderzeichen.** `SALES_ROOT` = `~/Kevin OS/02 Projekte/Herrmann & Co/2. SOP's & Skripte/Sales Skripte`
  enthält Leerzeichen, `&` und einen **Apostroph** (`SOP's`). In JS via `join(...)`-Segmente kein Problem;
  in JEDEM Bash/curl-Kommando den Pfad in **doppelte** Anführungszeichen setzen (einfache Quotes bricht der Apostroph).
- **R4 — Deploy-Mechanik.** Live geht nur über `main`-FF + Push (Kevin bestätigt Live-Schaltung explizit).
  Auf frameworkos.de degradiert alles Runner-Basierte konsistent zu „Runner offline" — gewollt, wie /ads und /content-Posts.
- **R5 — Design-System ist gesetzt.** Nur `--ck-*`-Tokens, `.ck-panel`/`.ck-btn`/`.ck-label`/`.ck-input`,
  Muster aus `AgentsPanel.tsx`/`GoalCard.tsx`/`HeuteTabs.tsx`. KEINE neuen Farben, kein Glas, keine neue
  Design-Sprache. Leerzustände immer sauber texten („Noch keine Runs.", „Runner offline · …").
- **R6 — Referenz-Assets (alle existieren, per `ls` verifiziert 24.07.):**
  - Vault Outreach: `~/Second Brain/03 Bereiche/Vertrieb & Outreach/` — `LinkedIn-Leads Erstnachrichten (Juli 2026).md`,
    `Loom-Skript (vollständige Sprechfassung).md`, `Outbound-Skripte 1/2/2b`, `Content-Strategie …`.
  - Sales-Skripte: s. R3 — `Loom-Batch 2026-07-23 (6 Leads).html`, `follow-up-analyse-template-v2.html`,
    `follow-up-analyse-rubrik.md`, `Follow-up-Analyse V2 (Template).pdf`, `Vertriebszentrale.html`, diverse PDFs.
- **R7 — Loom-Fachregeln (verbindlich für den `loom-skript`-Prompt):** 5-Akt-Struktur, individualisiert wird NUR
  Akt 2 + Spickzettel + Begleit-DM; Fehler zeigen = Mehrwert, WAS+WARUM nie WIE; kein Sales-Angebot im CTA;
  keine Emojis. **JS-Fallgrube:** deutsche Anführungszeichen in JS-Datenstrings nie als `„…"` mit ASCII-Schließquote —
  Helper `const G=s=>'„'+s+'“'` verwenden und `<script>`-Teil mit `node --check` validieren.
- **R8 — Follow-up-PDF-Fachregeln (verbindlich für den `followup-pdf`-Prompt):** V2-Template + Rubrik nutzen;
  3er-Screenshot-Galerie (Hero / Bewertung→Formular / Kontakt), Eigentümer-Score /100 + 6 Kriterien /10,
  Mini-Technik-Check; keine Preise, CTA nur Quali-Call; PDF via Chrome headless `--print-to-pdf`, 3 Seiten.

---

## Züge

### Zug 0 — Recon bestätigen (nur lesen)

**Aktion.** Im Repo `~/Kevin OS/02 Projekte/uriel`:
1. `git status --short` — erwarte exakt die R1-Dateien (M/??). Zusätzliche Änderungen → notieren, nicht anfassen.
2. `grep -n "AGENT_CATALOG" runner/index.mjs` (~Z. 92), `grep -n "files/social" runner/index.mjs` (~Z. 895),
   `grep -n "KUNDEN_MIME" runner/index.mjs` (~Z. 600) — Anker für Zug 1/2.
3. `ls "$HOME/Kevin OS/02 Projekte/Herrmann & Co/2. SOP's & Skripte/Sales Skripte/"` — R6-Dateien da.
4. `grep -n "ConversionPanel" app/src/cockpit/pages/TrackingArea.tsx` — exakte Props ablesen (aktuell `kpis={funnel}` ~Z. 361; die Herkunft von `funnel` im selben File nachschlagen und fürs Dashboard identisch aufbauen).

**Erfolg:** alle vier Checks liefern die erwarteten Treffer. **Fehlschlag:** ein Anker fehlt →
wahrscheinlich hat sich der Code seit 24.07. bewegt → per `grep` neu lokalisieren, Abweichung im Abschlussbericht nennen.

### Zug 1 — Runner: `SALES_ROOT` + `GET /sales/library` + `GET /files/sales/<rel>`

**Aktion.** In `runner/index.mjs` (additiv, R1!):
1. Bei den Root-Konstanten (~Z. 59–66):
   ```js
   // Sales-Bibliothek (Cockpit /sales): Skripte-Ordner der Akquise. Env-überschreibbar.
   const SALES_ROOT = resolve(
     process.env.SALES_ROOT ??
       join(homedir(), 'Kevin OS', '02 Projekte', 'Herrmann & Co', "2. SOP's & Skripte", 'Sales Skripte'),
   )
   const SALES_VAULT_DIR = join(VAULT, '03 Bereiche', 'Vertrieb & Outreach')
   ```
2. `salesRootReal()`-Helper als Klon von `socialRootReal()` (~Z. 624) anlegen.
3. `KUNDEN_MIME` prüfen: fehlt `.pdf` → `'.pdf': 'application/pdf'` ergänzen (sonst lädt der iframe die PDF als Download statt Vorschau). `.md`/`.canvas` NICHT in die MIME-Map — Markdown läuft über `/os/file` (Zug 3).
4. Endpoint `GET /files/sales/<rel>` als Klon des `/files/social/`-Blocks (~Z. 895): realpath-Guard gegen `SALES_ROOT`, MIME-Allowlist, `Cache-Control: no-store` wie beim Vorbild.
5. Endpoint `GET /sales/library` (vor dem finalen 404): liefert zwei Gruppen als JSON:
   ```json
   { "vault":  [{ "name": "LinkedIn-Leads Erstnachrichten (Juli 2026).md", "path": "03 Bereiche/Vertrieb & Outreach/…", "kind": "md", "mtime": "…" }],
     "skripte": [{ "name": "Loom-Batch 2026-07-23 (6 Leads).html", "rel": "Loom-Batch 2026-07-23 (6 Leads).html", "kind": "html", "mtime": "…" }] }
   ```
   Implementierung: `readdir` + `stat` auf `SALES_VAULT_DIR` (nur `.md`) und `SALES_ROOT` (nur `.pdf`/`.html`/`.md`),
   sortiert mtime absteigend, Unterordner überspringen. `kind` aus der Extension.
6. Runner-Zweitinstanz starten: `PORT=4790 node runner/index.mjs`.

**Erwartete Beobachtung — Erfolg.**
- `curl -s 'http://127.0.0.1:4790/sales/library' | head -c 400` → 200, beide Gruppen nicht leer,
  Erstnachrichten-Datei in `vault`, Loom-Batch in `skripte`.
- `curl -s -o /dev/null -w '%{http_code} %{content_type}\n' 'http://127.0.0.1:4790/files/sales/Loom-Batch%202026-07-23%20(6%20Leads).html'` → `200 text/html`.
- PDF-Variante → `200 application/pdf`. Traversal `…/files/sales/../../secret` → 403/404.

**Wahrscheinlichster Fehler.** ENOENT auf `SALES_ROOT`, weil der Apostroph-Pfad falsch getippt wurde.
- **Signal:** `/sales/library` → 500 oder leere `skripte`-Gruppe, obwohl `ls` (Zug 0.3) Dateien zeigte.
- **Gegenzug:** Pfad NICHT raten — `ls "$HOME/Kevin OS/02 Projekte/Herrmann & Co/"` Ebene für Ebene absteigen
  und die join()-Segmente exakt daraus übernehmen (`"2. SOP's & Skripte"` mit Apostroph, doppelt gequotet).

**Trigger:** URL-Encoding-Probleme mit Klammern/Umlauten in Dateinamen (curl 404 trotz existierender Datei) →
im Frontend konsequent `encodeURIComponent` je Pfadsegment (Muster `socialFileUrl`), im curl-Test `--data-urlencode`-freie, manuell encodierte URL verwenden.

### Zug 2 — Runner: neue `AGENT_CATALOG`-Einträge + Settings für den Sales-Ordner

**Aktion.**
1. Datei `"$SALES_ROOT/.claude/settings.json"` anlegen — Klon von `04_social/.claude/settings.json`, erweitert:
   ```json
   {
     "permissions": {
       "allow": [
         "Read", "Write", "Edit", "Glob", "Grep", "WebFetch", "WebSearch",
         "Bash(node:*)", "Bash(mkdir:*)", "Bash(date:*)", "Bash(ls:*)", "Bash(cat:*)",
         "Bash(/Applications/Google Chrome.app/Contents/MacOS/Google Chrome:*)"
       ],
       "deny": ["Bash(rm:*)", "Bash(git push:*)", "Bash(curl:*)", "Bash(npm publish:*)"]
     }
   }
   ```
2. In `AGENT_CATALOG` (~Z. 92) zwei write-Einträge nach dem `weekly-content`-Muster:
   - `id: 'loom-skript'`, `label: 'Loom-Skript (Lead)'`, `kind: 'write'`, `cwd: SALES_ROOT`. Prompt (sinngemäß, R7 vollständig einbauen):
     „Baue für den Lead aus den Eingabedaten (name, website) ein individualisiertes Loom-Skript.
     Standard-Akte 1/3/4/5 aus `Loom-Skript & LinkedIn-Erstnachrichten.pdf` bzw. der Sprechfassung im Vault
     (`03 Bereiche/Vertrieb & Outreach/Loom-Skript (vollständige Sprechfassung).md` via Read) übernehmen —
     NUR Akt 2 (IST-Analyse: erst Positiv, dann 3 Optimierungspunkte), Spickzettel und Begleit-DM individualisieren.
     Website per WebFetch analysieren (Eigentümer-Seite? Bewertungstool? käufer- vs. eigentümerlastig? modern?).
     Ausgabe: EINE selbst-enthaltene HTML-Datei `Loom-Skript <YYYY-MM-DD> (<Name>).html` im Stil von
     `Loom-Batch 2026-07-23 (6 Leads).html` in DIESEM Ordner. Regeln: Fehler zeigen = Mehrwert, WAS+WARUM nie WIE,
     kein Sales-Angebot im CTA, keine Emojis. JS-Strings: deutsche Anführungszeichen nur über Helper `const G=s=>'„'+s+'“'`;
     vor Abschluss `<script>`-Teil mit node --check validieren."
   - `id: 'followup-pdf'`, `label: 'Follow-up-PDF (Lead)'`, `kind: 'write'`, `cwd: SALES_ROOT`. Prompt (R8 vollständig):
     „Baue für den Lead aus den Eingabedaten (name, website) die individuelle Follow-up-Analyse:
     `follow-up-analyse-template-v2.html` kopieren nach `Follow-up-Analyse <Name>.html`, anhand
     `follow-up-analyse-rubrik.md` und einer WebFetch-Analyse der Website befüllen (Eigentümer-Score /100,
     6 Kriterien je /10, Mini-Technik-Check). Screenshots: 3 Aufnahmen (Startseite, Bewertungs-/Formularseite, Kontakt) via
     `\"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome\" --headless --disable-gpu --screenshot=<datei>.png --window-size=1280,800 <url>`;
     schlägt ein Screenshot fehl → graues Platzhalter-Panel mit Seitentitel einsetzen und im Abschlussbericht WARN melden, NICHT abbrechen.
     Danach PDF: `… --headless --print-to-pdf=\"Follow-up-Analyse <Name>.pdf\" <html-datei>`; 3 Seiten via `.page.mt`-Umbrüche.
     Keine Preise, CTA nur Quali-Call."
   Beide Agenten erhalten die Eingabedaten automatisch als JSON-Block (Mechanik `startRun`/`inputBlock`, ~Z. „Eingabedaten (JSON)") — nichts extra bauen.
3. `agentConfig` (~Z. 141) unverändert lassen — der `kind:'write'`-Zweig deckt beide ab (cwd + acceptEdits kommen aus dem Katalog-Eintrag). **Achtung:** der write-Zweig nutzt `a.prompt` — beide Einträge brauchen also zwingend ein `prompt`-Feld (wie `weekly-content`), sonst `undefined` im Prompt.

**Erwartete Beobachtung — Erfolg.** `curl -s http://127.0.0.1:4790/agents` listet 8 Agenten, beide neuen mit `kind:"write"`.
`POST /run` mit unbekanntem Agent → weiterhin 400.

**Wahrscheinlichster Fehler.** Echter Testlauf der Agenten scheitert an Permissions (Chrome-Kommando nicht von der Allowlist gedeckt, weil der Pfad mit Leerzeichen anders gequotet wird als im settings-Pattern).
- **Signal:** Run-Markdown endet mit Permission-Verweigerung für das Chrome-Kommando.
- **Gegenzug:** Allowlist-Pattern exakt auf den Binary-Pfad stellen (wie oben, inkl. Leerzeichen im Pattern); alternativ RECON-Zug 6.2-Ergebnis nutzen.

**Kosten-Gate:** Die beiden Agenten-Prompts werden in dieser Mission NICHT E2E ausgeführt (echte Claude-Runs kosten;
Muster wie beim Content-Agenten: „Kevins Real-Test"). Verifiziert wird nur Katalog + Permissions-Datei + Mechanik.

### Zug 3 — Frontend: Routen + Nav + Redirects (`/crm` → `/sales`)

**Aktion.**
1. `app/src/cockpit/pages/CrmArea.tsx` → umbauen zu `SalesArea.tsx` (Datei umbenennen via `git mv`):
   - SubNav (HeuteTabs-Optik ODER bestehende `ck-nav-item`-Pills beibehalten — bestehende Pills behalten, weniger Diff):
     `Dashboard (/sales, end)` · `Pipeline (/sales/pipeline)` · `Listen (/sales/lists)` · `Call-Mode (/sales/call-mode)` · `Neuer Lead (/sales/new)` · `Bibliothek (/sales/bibliothek)`.
     Der Tab-Container bekommt `overflowX: 'auto'` + `flexWrap: 'nowrap'` (6 Tabs, Mobile 390px).
   - Routes: `index → SalesDashboard` (Zug 4), `pipeline → <SalesMode panel="full" scrollEmbed />`,
     `lists`, `lists/:listId`, `call-mode`, `new`, `bibliothek → SalesBibliothek` (Zug 5), `:contactId → ContactPage`.
     Alles in EINEM `<Routes>`-Block lassen — React Router v6 rankt statische Segmente über `:contactId`, dadurch
     schluckt der Kontakt-Catch-all `bibliothek`/`pipeline` NICHT.
2. `App.tsx`: `<Route path="/sales/*" element={<SalesArea />} />`; alte `/crm/*`-Route ersetzen durch
   Mini-Redirect-Komponente (im selben File oder `lib/`):
   ```tsx
   function CrmRedirect() {
     const location = useLocation()
     const rest = location.pathname.replace(/^\/crm/, '')
     return <Navigate to={`/sales${rest === '' || rest === '/' ? '/pipeline' : rest}${location.search}`} replace />
   }
   ```
3. `LegacySalesRedirect.tsx`: Ziel-String `/crm` → `/sales` (Kommentar mitziehen).
4. `NavRail.tsx` Z. 9: `{ to: '/sales', label: 'Sales', icon: '▤' }`.
5. Alle internen `/crm`-Verweise umziehen (Liste aus Recon, per `grep -rn "'/crm\|\"/crm\|/crm/" app/src` verifizieren):
   `HeuteDeck.tsx`, `AufgabenArea.tsx`, `TermineArea.tsx`, `FreigabenArea.tsx`, `CommandPalette.tsx`,
   `graph/nebulaLayout.ts` (Kontakt-Klickziel), `UrielDock.tsx` (Zug 7 separat). Ausgenommen: die neue `CrmRedirect`-Route selbst.

**Erwartete Beobachtung — Erfolg.** `npx tsc -b` grün; im Dev-Server: NavRail zeigt „Sales", `/sales` rendert Dashboard-Platzhalter,
`/sales/pipeline` die Pipeline, `/crm` landet auf `/sales/pipeline`, `/crm/lists` auf `/sales/lists`, Kontakt-Klick im Graph auf `/sales/<id>`.

**Wahrscheinlichster Fehler.** Ein vergessener `/crm`-Link (z. B. in FreigabenArea-Kontaktkarten) führt auf die Redirect-Route →
funktioniert zwar, aber mit doppeltem Redirect-Hop.
- **Signal:** `grep -rn "/crm" app/src --include="*.tsx" --include="*.ts"` liefert nach dem Umbau noch Treffer außerhalb von `CrmRedirect` + Kommentaren.
- **Gegenzug:** jeden Treffer einzeln umstellen, grep erneut, bis nur Redirect + Kommentare übrig sind.

### Zug 4 — Frontend: SalesDashboard (`/sales`)

**Aktion.** Neue Datei `app/src/cockpit/pages/SalesDashboard.tsx` (bzw. Komponentenordner-konform unter `pages/`), Aufbau
2-spaltig ≥900px, 1-spaltig darunter (einfaches CSS-Grid mit vorhandenen Tokens):
1. **SalesAgentsPanel** (neue Komponente `components/SalesAgentsPanel.tsx`, 1:1 nach `AgentsPanel.tsx`-Muster):
   - Datenquellen: `useRunnerData()` (runs, runnerState, activeAgents — Signatur in `CockpitHome.tsx` ~Z. 354 ablesen und identisch verwenden), `fetchAgents()`.
   - Deck-Filter: NUR `SALES_AGENT_IDS = ['followup-entwuerfe', 'loom-skript', 'followup-pdf', 'lead-research', 'linkedin-leads']`.
   - `followup-entwuerfe` als einfacher Button (Input-Mechanik `buildFollowupInput` wie in `CockpitHome.onRun` — nachschlagen und identisch übernehmen).
   - `loom-skript` + `followup-pdf`: je eine Zeile mit ZWEI `ck-input`-Feldern (`Name`, `Website-URL`) + ▶-Button →
     `postRun(id, { name, website })`. Ohne Name disabled; Website optional bei `loom-skript` (ohne Website recherchiert der Agent selbst), Pflicht bei `followup-pdf`.
   - `lead-research` mit Eingabefeld (Muster aus `AgentsPanel` kopieren).
   - „Letzte Runs": `runs.filter(r => SALES_AGENT_IDS.includes(r.agent))`, max 6, Klick → `RunDrawer` (Muster `CockpitHome`: `openRunId`-State + `<RunDrawer/>`).
   - Offline-Zustand: Buttons disabled + Hinweiszeile (wortgleich AgentsPanel).
2. **ConversionPanel**: Wiederverwendung `components/ConversionPanel.tsx` mit exakt den Props/Datenfluss aus `TrackingArea.tsx` (~Z. 361, Zug 0.4). Kein Fork der Komponente.
3. **LinkedIn-Leads-Statuskarte** (Teil des SalesAgentsPanel, hervorgehobene Zeile im Dream-Stil):
   - Runner-seitig NICHTS Neues nötig: `GET /sales/library` (Zug 1) liefert die Erstnachrichten-Dateien mit mtime;
     Frontend nimmt die neueste `LinkedIn-Leads Erstnachrichten*`-Datei, lädt sie via `fetchOsFile(path)` und zählt `### `-Headings.
   - Anzeige: „Letzte Runde: <Datum aus Dateiname/mtime> · <n> Leads" + Link „Öffnen" → `/sales/bibliothek` (Datei vorausgewählt).
   - **Trigger (aus RECON-Zug 6):** Chrome-MCP headless verfügbar → zusätzlich ▶-Button (`postRun('linkedin-leads')` + Katalog-Eintrag
     `{ id: 'linkedin-leads', label: 'LinkedIn-Leads (Runde)', kind: 'readonly' }` — readonly-Zweig baut `/linkedin-leads` als Slash-Prompt im Vault-cwd).
     Nicht verfügbar → KEIN Button; Hinweis „Runde läuft in der Desktop-Session (braucht Chrome)".
4. **BibliothekQuickPanel**: `ck-panel` mit den 4 neuesten Einträgen aus `/sales/library` (beide Gruppen gemischt, mtime-sortiert),
   je Zeile Name + Gruppe + „Öffnen →" (`/sales/bibliothek?f=<encoded>`), darunter „Alle anzeigen →".

**Erwartete Beobachtung — Erfolg.** `/sales` zeigt 3 Panels im ck-Design; Runner an: Buttons aktiv, Statuskarte zeigt
„Juli 2026"-Datei mit plausibler Lead-Zahl (> 0); Runner aus: Panels degradieren sauber (disabled + Hinweis, Bibliothek-Panel „Runner offline").

**Wahrscheinlichster Fehler.** `useRunnerData`/`RunDrawer`-Verdrahtung aus dem Kopf statt aus `CockpitHome.tsx` abgeschrieben →
Props passen nicht (tsc-Fehler) oder Runs pollen doppelt.
- **Signal:** tsc-Fehler an SalesDashboard oder zwei parallele `/runs`-Polls im Netzwerk-Tab.
- **Gegenzug:** exakte Verwendung in `CockpitHome.tsx` aufschlagen (Zug 0/4-Anker) und Signatur 1:1 übernehmen; der Hook ist für Mehrfachnutzung gebaut — falls nicht (doppelte Poll-Last sichtbar), Runs via Props von der Area-Ebene reichen.

### Zug 5 — Frontend: SalesBibliothek (`/sales/bibliothek`)

**Aktion.** Neue Datei `pages/SalesBibliothek.tsx` + `lib/salesLibraryApi.ts` (`fetchSalesLibrary()`, `salesFileUrl(rel)` mit `encodeURIComponent` je Segment, Muster `socialFileUrl`):
1. Layout: links schmale Liste (2 Gruppen: „Nachrichten & Skripte (Vault)", „Vorlagen & PDFs"), rechts Vorschau-Pane. Mobile: Liste oben, Vorschau darunter.
2. Vorschau je `kind`:
   - `pdf`/`html` → `<iframe src={salesFileUrl(rel)} …>` (HTML sandboxed: `sandbox="allow-scripts"`, wie SocialArea srcdoc-Galerie — hier reicht src, da self-contained Dateien; Loom-Batch + Vertriebszentrale sind self-contained).
   - `md` (Vault) → `fetchOsFile(path)` + einfacher Abschnitts-Renderer: Split an `^### `-Headings; je Abschnitt Card mit
     Name (Heading) + Text (als `<pre>`/whitespace-pre-wrap, KEIN Markdown-Parser nötig) + **„Nachricht kopieren"-Button**
     (`navigator.clipboard.writeText(abschnittstext)` + kurzes „Kopiert ✓"-Feedback). Prolog vor dem ersten `###` als Intro-Card.
   - Fallback unbekannt → „Im Finder öffnen"-Hinweis (kein toter Viewer).
3. Query-Param `?f=` (aus Dashboard) → Eintrag vorselektieren; ohne Param neuesten Eintrag öffnen.
4. `openInObsidian(notePath)` (existiert in `runnerApi.ts`) als Sekundär-Aktion bei Vault-MDs.

**Erwartete Beobachtung — Erfolg.** Erstnachrichten-MD rendert als kopierbare Karten (Anzahl Karten = Anzahl `### ` im File);
Loom-Batch-HTML rendert interaktiv im iframe; V2-Template-PDF zeigt Inline-Vorschau (kein Download-Dialog); Klick „kopieren" → Clipboard enthält die Nachricht.

**Wahrscheinlichster Fehler.** PDF öffnet als Download statt Inline-Vorschau.
- **Signal:** iframe bleibt leer/Browser lädt Datei herunter.
- **Gegenzug:** Content-Type prüfen (`curl -sI`): kommt `application/octet-stream`, fehlt der MIME-Eintrag aus Zug 1.3 → nachziehen + Runner-Neustart (R2).

**Zweiter wahrscheinlicher Fehler.** Clipboard-API schlägt im unsicheren Kontext fehl (http://localhost ist secure — aber Safari-Eigenheiten).
- **Signal:** Klick kopiert nichts, Konsole `NotAllowedError`.
- **Gegenzug:** Fallback `document.execCommand('copy')` über verstecktes Textarea; Feedback-Text „Kopieren fehlgeschlagen — Text markieren" statt stiller Fehler.

### Zug 6 — RECON: Kann der Runner die LinkedIn-Runde headless fahren?

**Aktion (genau dieser Check, nichts anderes):**
```bash
cd "$HOME/Second Brain" && claude -p 'Antworte NUR mit der kommagetrennten Liste der dir verfügbaren MCP-Server-Namen, sonst nichts.' --output-format text
```
**Trigger:**
- Ausgabe enthält `claude-in-chrome` (und Kevins Chrome läuft) → LinkedIn-Button-Route aus Zug 4.3 bauen
  (Katalog-Eintrag readonly; der bestehende readonly-Zweig in `agentConfig` baut `/linkedin-leads` automatisch als Slash-Kommando).
- Ausgabe enthält es NICHT (erwarteter Fall) → nur Statuskarte, kein Button, Hinweistext wie in Zug 4.3. Ergebnis im Abschlussbericht dokumentieren.

**Wahrscheinlichster Fehler.** Der Check selbst hängt (Vault-cwd lädt viel Kontext).
- **Signal:** > 3 Minuten keine Ausgabe. **Gegenzug:** abbrechen, als „nicht verfügbar" werten (konservative Route), im Bericht vermerken.

### Zug 7 — UrielDock + Graph: Sprachsteuerung & Klickziele nachziehen

**Aktion.**
1. `lib/urielTools.ts` (~Z. 56–64): `navigate`-Beschreibung + Enum: `crm` → `sales` umbenennen, `crm` als Alias im Enum BEHALTEN.
2. `components/UrielDock.tsx`: `AREA_PATHS` (~Z. 41) → `sales: '/sales'`, `crm: '/sales'` (Alias); `open_contact` (~Z. 206) → `/sales/${id}`.
3. `graph/nebulaLayout.ts` + `OsNebula`-Klickpfade: Kontakt-Klick → `/sales/:id` (Treffer aus Zug 3.5-grep).

**Erwartete Beobachtung — Erfolg.** tsc grün; Uriel-Sprachbefehl „öffne CRM" und „öffne Sales" landen beide auf `/sales` (manuell im Dock testbar, wenn Kevin eingeloggt ist — sonst Code-Review der Mapping-Tabelle reicht).

**Wahrscheinlichster Fehler.** Enum geändert, aber Edge Function `uriel` cached/validiert das alte Schema.
- **Signal:** keiner — die Tools werden client-seitig definiert und pro Request mitgeschickt (Persona ist server-seitig, Tool-Schema kommt aus `urielTools.ts`). Kein Deploy der Edge Function nötig. Falls doch ein 400 vom Tool-Use auftaucht: Request-Payload im Netzwerk-Tab prüfen, ob das neue Enum mitgeht.

### Zug 8 — Verifikation (komplett, in dieser Reihenfolge)

1. `cd app && npx tsc -b` → 0 Fehler. `npm run build` (vite) → grün.
2. Runner-Zweitinstanz (Port 4790): die drei curl-Checks aus Zug 1 + `/agents` aus Zug 2 → alle 200/erwartete Bodies; Traversal-Check 403/404.
3. Dev-Server + Browser (Preview-Tools): `/sales` (Dashboard, 3 Panels), `/sales/pipeline` (Pipeline unverändert),
   `/sales/bibliothek` (MD-Copy-Karten + PDF-iframe + HTML-iframe), `/crm` + `/crm/lists` (Redirects), Kontakt öffnen `/sales/:id`.
4. Konsole: 0 neue Fehler auf allen besuchten Routen.
5. Mobile 390×664 (svh-Falle!): Bottom-Bar intakt (9 Tabs + kein Overflow), Sub-Tab-Zeile horizontal scrollbar, Dashboard 1-spaltig, Bibliothek gestapelt. Screenshot anfertigen.
6. Desktop-Screenshot `/sales` für Kevins Review.
7. Abschluss-grep: `grep -rn "/crm" app/src` → nur Redirect + Kommentare.
8. NICHT ausführen: echte `loom-skript`-/`followup-pdf`-Runs (Kosten-Gate Zug 2), launchd-Neustart (macht Kevin), Commit/Push (nur auf Kevins Wort).

### Zug 9 — Übergabe

Abschlussbericht an Kevin, ergebnis-zuerst: was live testbar ist (lokal), die zwei Kevin-Aktionen
(`launchctl kickstart -k gui/$(id -u)/de.uriel.runner` für die neuen Endpoints; erster Real-Run der zwei neuen Agenten),
RECON-Ergebnis Zug 6, Screenshot Desktop + Mobile, Liste aller geänderten Dateien. Kein „fertig" ohne Zug 8 komplett grün.

---

## Red-Team (gegen SUCCESS-Kriterien gefahren)

- **Angriff „`:contactId` schluckt `bibliothek`":** abgewehrt — React Router v6 rankt statische Segmente über Params,
  solange alle Routen im selben `<Routes>`-Block stehen. Patch in Zug 3.1 festgeschrieben (ein Block, keine verschachtelten Routes-Container).
- **Angriff „Apostroph-Pfad":** kam durch (erster Entwurf hätte `'…SOP's…'` in Single-Quotes gebasht) → Patch: R3 + Zug-1-Gegenzug (doppelte Quotes, Ebene-für-Ebene-ls).
- **Angriff „PDF-MIME fehlt":** kam durch → Patch: Zug 1.3 explizit + Zug-5-Gegenzug mit `curl -sI`-Diagnose.
- **Angriff „Executor überschreibt Heartbeat-Arbeit":** kam durch (naives `git checkout runner/index.mjs` nach Fehlversuch wäre plausibel) → Patch: R1 mit hartem Verbot.
- **Angriff „LinkedIn-Button produziert stille Müll-Runs":** abgewehrt durch Weiche ⑥ + RECON-Zug 6 mit konservativem Default.
- **Angriff „AgentsPanel-Doppelung auf Home":** Home behält sein AgentsPanel (alle readonly-Agenten inkl. Follow-up-Entwürfe). Bewusst akzeptierte Überschneidung bei `followup-entwuerfe`/`lead-research` (Home = Alltag, Sales = Kontext) — KEINE Änderung an `AgentsPanel.tsx`/Home in dieser Mission (Scope-Grenze; wenn Kevin die Doppelung stört, eigener Folgeschritt: HIDDEN_ON_DECK erweitern).

## Abbruchbedingungen (stoppen + melden statt improvisieren)

1. `git status` zeigt VOR Beginn andere/mehr Änderungen als R1 → stoppen, Kevin fragen.
2. `SalesMode`/`ContactPage` brechen durch die Routen-Umhängung (tsc-Fehler in `pages/sales/*`-Altwelt) → stoppen; Altwelt-Dateien werden in dieser Mission nicht angefasst.
3. Runner-Zweitinstanz startet nicht (Port-Konflikt/Syntaxfehler in index.mjs) und der Fehler liegt NICHT in den neuen Blöcken → stoppen (Heartbeat-Arbeitsstand nicht debuggen/anfassen).
4. Ein Verifikationspunkt aus Zug 8 bleibt nach 2 Gegenzug-Versuchen rot → stoppen, Zustand + Signal berichten.
5. Jede Versuchung, `db push`, Commit, main-FF, Deploy oder launchd-Restart selbst auszuführen → nicht tun, melden.

## LEDGER

- `{{linkedin_headless}}` — Ergebnis RECON-Zug 6 (erwartet: nicht verfügbar → Statuskarte ohne Button). Kein Kevin-Input nötig, Executor löst selbst auf.
- `{{followup_pdf_realtest}}` — erster echter `followup-pdf`-Run mit realem Lead: Kevin nach Übergabe (Kosten-Gate).
- `{{loom_skript_realtest}}` — dito für `loom-skript`.
- Kein weiterer offener Input. Blaupause ist ausführbereit.
