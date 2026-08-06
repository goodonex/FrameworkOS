> ⚠️ **HISTORISCH (Mai 2026, „Brand OS“).** Beschreibt die Vor-Rebuild-Architektur
> mit sechs Denk-Modi. Die heutige Arbeitsteilung ist: Vault = denken, Cockpit = tun.
> Aktueller Stand: [`../HANDOFF.md`](../HANDOFF.md) · [`BACKLOG.md`](BACKLOG.md).

# Brand OS — System Architecture

## Was ist Brand OS
Ein lernendes Betriebssystem für Personal Brands und kleine Multi-Brand-Setups.
Kein Projektmanagement-Tool. Kein Miro. Ein Raum in dem das Business lebt.

Drei Kernprinzipien:
1. Alles an einem Ort — kein Tab-Wechsel, keine verstreuten Tools
2. Strategie und Content hängen sichtbar zusammen
3. Das System lernt und optimiert sich selbst — von außen nach innen

---

## Der Fluss
Discovery → Building → Promo → Sales → Intelligence → (zurück zu Building)

Discovery informiert Building. Building informiert Promo. Promo informiert Sales.
Sales + Promo informieren Intelligence. Intelligence optimiert Foundation zurück.

---

## Die 6 Modi

### Focus (KI-Schicht, immer sichtbar)
- Zeigt täglich 3 nächste Moves mit höchstem Impact
- Kennt alle 4 Modi und deren Status
- Lernt aus Verhalten (was wird verschoben, was erledigt)
- Sendet Notifications wenn etwas stockt (später: Morning Brief)
- Schlägt Foundation-Anpassungen vor wenn Performance-Daten es rechtfertigen

### Discovery (Außenperspektive, automatisch aktualisiert)
Schaut aktiv nach außen. Zwei Parts:

**Discovery Foundation** — manuell gestartet (Button in der App).
- Du gibst Markt, Wettbewerber, Nische ein
- Edge Function **`discovery-agent`**: Web-Recherche (**Perplexity** `sonar`), strukturierte Analyse (**Claude**), Speicherung in `discovery_foundation` und neue Einträge in `discovery_feed_items`
- Ergebnis: ICP-Entwürfe, Word-Bank-Vorschläge (Ja/Nein), Positioning, Content-Formate, Wettbewerber-Insights, Tone of Voice — Übernahme in Building pro Sektion
- Secrets: siehe `docs/open-questions.md` (`PERPLEXITY_API_KEY`, `ANTHROPIC_API_KEY`, …)

**Discovery Feed** — automatisch per Cron empfohlen (7 Tage), manuell aus der App auslösbar.
- Edge Function **`discovery-feed-refresh`**: aktuelle Trends, Wettbewerber-Signale, Content-Formate (**Perplexity**); Einträge älter als 90 Tage werden archiviert (`archived_at`)

Discovery füttert Intelligence. Discovery-Signale + Performance-Daten = vollständiger Loop.

### Building
Infrastruktur und Fundament. Was die Brand ist und wie sie läuft.

**Foundation:**
- Business Model (Wer, Was, Wie, Für wen, Womit)
- ICP (mehrere Profile, mit Schmerzpunkten, Kontext, Word-Bank-Zuordnung)
- Word Bank (✓ Ja-Wörter, ✗ Nein-Wörter, Cluster)
- Positioning Statement
- Tone of Voice

**Assets:**
- Website (embedded iframe + Tracking-Verbindung)
- Social-Media-Kanäle (embedded Feed + API-Performance-Daten)
- Dokumente / Lead Magnets

**SOPs:**
- Prozess-Templates
- Workflows
- Vorlagen für wiederkehrende Aufgaben

### Promo
Was rausgeht. Content aus der Foundation heraus.

- Content-Planung (Kalender-View, kein Fullscreen-Kalender)
- Einzelne Posts / Pieces
- Kampagnen (mehrere Pieces als Gruppe)
- Lead Magnets
- E-Mail-Sequenzen

Jedes Content-Piece bekommt beim Erstellen automatisch Tags:
- Brand, ICP-Referenz, Word-Bank-Cluster, Format, Kanal, Ziel
- Performance-Feld: manuell oder via API (Instagram, LinkedIn, Meta Ads)

### Sales
Von Aufmerksamkeit zu Geld.

- Kontakte (Name, Brand-Zuordnung, Quelle — welche Kampagne)
- Pipeline-Stages: Erstkontakt → Gespräch → Angebot → Deal → Pause
- Letzter Kontakt + Nächster Schritt
- Verbindung zu Promo: welcher Content hat diesen Kontakt gebracht

### Intelligence (Lernschicht, läuft im Hintergrund)
- Pattern Recognition: was performt, was nicht
- Strategic Inference: übergreifende Schlüsse (ICP-Drift, Kanal-Stärken)
- System Optimization: schlägt Foundation-Änderungen vor
- Entscheidungen werden gespeichert und fließen ins weitere Lernen

---

## Second Brain — Context Export
Jede Brand hat einen automatisch generierten Context-Block.
Einmal klicken → in Zwischenablage → in Claude / GPT / andere KI pasten.

Enthält: Positioning, ICPs, Word Bank, Tone, aktuelle Assets, laufende Fokus-Themen.
Format: strukturiertes Markdown, maschinenlesbar.

---

## Embed-Prinzip
Assets werden nicht als Links gespeichert — sie werden embedded.
Website, Instagram-Feed, LinkedIn: live sichtbar im Asset-Node.
Performance-Zahlen direkt daneben. Post und Wirkung = ein Objekt.

---

## Tracking-Schema
Drei Ebenen:
1. Manuell: Ergebnis-Feld pro Content-Piece (Leads, Antworten, Deals)
2. API: Instagram Graph, LinkedIn Analytics, Google Analytics, Meta Ads
3. Intelligence: aggregiert, Muster erkennen, Empfehlungen ableiten

---

## Kundenportal (Deliver)
- Öffentliche Route `/portal/:projectId` — eigenes Layout (`--bg-base`), ohne 3D-Canvas / AppHeader / ModeNav.
- **Client:** Supabase User mit `user_roles.role = 'client'` und gesetztem `project_id` → Login-Redirect ins Portal; RLS erlaubt nur dieses `deliver_projects`-Row (+ zugehörige Brand lesen).
- **Owner:** In `ProjectPage` Kundenbereich befüllen; „Portal-Link kopieren“ gibt die volle URL aus.
- **Dev-Vorschau:** `?preview=true` lädt das Projekt aus **localStorage** ohne Auth (kein Ersatz für Produktion).

---

## Notification-System (Phase 3)
- Push oder täglicher Morning Brief
- Triggers: Follow-up überfällig, Content-Pause zu lang, Muster erkannt
- Ziel: System kommt zu dir, nicht umgekehrt

---

## Collaboration Light (Fundament, Phase 4)
- Kommentare pro Node
- Zuweisung (an VA, Designer, Texter)
- Status: Draft → In Review → Live
- Kein vollständiges Projektmanagement — nur das Minimum

---

## Was bewusst NICHT gebaut wird
- Buchhaltung (→ Lexoffice)
- Dateiablage / Cloud Storage (→ Google Drive, verlinkt)
- Vollständiger Kalender (→ Google Calendar)
- CRM mit vollem Funktionsumfang (→ HubSpot, wenn es so weit ist)
