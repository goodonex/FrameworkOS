> **Umgesetzt als Phase 1** (siehe [`wargames/content-modul-mvp.md`](wargames/content-modul-mvp.md)).
> Vom Briefing offen ist nur der geschlossene Kreis — als O9 in [`BACKLOG.md`](BACKLOG.md).
> Gültig bleibt der Ideen-Vorrat für spätere Ausbaustufen.

# Briefing: Content-Modul fürs Uriel-Cockpit

Stand: 17.07.2026 · Autor: Fable (Denk-Session) · Zweck: Grundlage, aus der eine frische Session den **genauen** Umsetzungsplan baut. Das hier ist die **Idee + Anforderung**, nicht der Plan.

> **An die ausführende Session:** Die Codebase-Fakten unten stammen aus einer Explore-Sondierung, nicht aus erster Hand — **verifiziere sie selbst am Code, bevor du planst** (`ground`-Skill). Baue dann den genauen Plan (Phasen, Schema, Dateien). Nicht sofort drauflosbauen: erst grounden, Plan zeigen, Freigabe holen (frameworkos.de ist live).

---

## 1. Warum das Ganze — der Kern in drei Sätzen

Kevin managed Content — erst seinen eigenen HERRMANN-Kanal, bald auch Kunden-Kanäle. Heute passiert das in verstreuten MD-Dateien, HTML-Exports und einer Wegwerf-HTML (`04_social/launch-3-posts.html`) — zum Bedienen unhandlich. **Das Content-Modul macht aus diesem Chaos eine bedienbare Kommandozentrale im Cockpit** — nach demselben Muster, das der `/ads`-Bereich für Werbeanzeigen schon liefert.

Leitprinzip: **Nicht neu erfinden — das `/ads`-Muster spiegeln.** Was dort für Ads existiert (Manifest-JSON pro Kunde, Runner mit Schreib-Guard, Karten-Grid, Detail-Panel, Copy/Checklist/Status, Skill-Trigger), gibt es für Content fast 1:1 wiederzuverwenden.

## 2. Was schon da ist (laut Sondierung — verifizieren!)

- **Stack:** React 19 + Vite + TypeScript, Router v7, Deploy über **Netlify** (`frameworkos.de`), Daten in **Supabase** + lokalem **Runner** (`127.0.0.1:4711`, Datei-Zugriff).
- **`/content`-Gerüst existiert** bereits als `SocialArea.tsx` — zeigt aber nur die ganze Woche als groben HTML-Block, **keine einzelnen Posts zum Bedienen**. Route + Nav-Eintrag sind verkabelt.
- **Das `/ads`-Muster als Blaupause:** `ads.json`-Manifest im Kundenordner · Runner-Endpoints `GET/PUT /ads/manifest` mit **Optimistic-Concurrency-Guard (409)** — d.h. „Claude baut + Kevin bedient gleichzeitig" ist schon gelöst · UI-Bausteine `AdCard`, `AdDetailPanel`, Copy-to-Clipboard, `ChecklistSection`, `StatusPill`, `AdPreview` (Datei-Tabs, iframe/img) · Asset-Serving über `/files/…`.
- **Skill-Trigger existiert:** Runner-Endpoint `POST /run` startet headless `claude -p`; es gibt bereits einen **`weekly-content`-Agenten**, der Posts + Captions + Galerie baut (`content-engine/WEEKLY.md`). Kein Auto-Posting.
- **Supabase-Spiegel:** Tabelle `social_batches` (u.a. Spalte `posted`) — damit `frameworkos.de` Content auch ohne laufenden Runner mobil zeigt.

**Aufwand-Einschätzung MVP: klein–mittel**, weil fast alles wiederverwendbar ist. Was fehlt, ist die **granulare Post-Ebene** + das `content.json`-Manifest.

## 3. Der eigentliche Denk-Sprung: Content ist eine Pipeline, keine Liste

Ein Post ist nicht „da oder nicht da" — er durchläuft **Zustände**. Das Modul soll diese Pipeline sichtbar und bedienbar machen (Kanban- oder Status-getrieben):

```
Idee/Angle → in Produktion → Review/Freigabe → geplant (Datum) → gepostet → Rückkopplung
```

Jede Stufe hat heute schon ein Pendant (Backlog, weekly-content-Agent, Google-Drive-Review, Meta Business Suite, Kevins Abhaken). Das Modul führt sie an einem Ort zusammen. **Das ist der Unterschied zwischen „schönerer Datei" und „Betriebssystem für Content".**

## 4. Anforderungen — MVP (Phase 1)

Das MVP ersetzt die Wegwerf-HTML dauerhaft und deckt Kevins Sofort-Bedarf:

- **`content.json`-Manifest** (analog `ads.json`), das jeden Post kennt: `id, titel, angle, status, plannedFor, caption, slides[], format (carousel/reel/story), channel, done`.
- **Post-Grid + Detail-Panel:** Slide-Vorschau, **Caption 1-Klick-kopieren**, **Slides/Assets herunterladen**, **abhaken** (offen/geplant/erledigt), **Vorplan-Datum** sichtbar.
- **Runner-Endpoints** `GET/PUT /content/manifest` mit demselben 409-Guard → Kevin bedient + Agenten schreiben konfliktfrei dieselbe Datei.
- **„Neue Beiträge bauen"-Knopf** = `postRun('weekly-content')`. Der Agent schreibt künftig das `content.json` gleich mit → geschlossener Kreis.
- **Multi-Brand von Tag 1 angelegt** (auch wenn erst HERRMANN drin ist): Struktur wie `/ads` pro Kunde/Brand. Siehe §5.
- **Additiv, nicht ersetzend:** die bestehende Wochen-/Supabase-Ansicht bleibt (mobile Sicht), die Post-Ebene kommt darüber.

## 5. Zukunft — worauf wir hinbauen (Datenmodell jetzt nicht verbauen)

Nicht alles jetzt bauen — aber das MVP so anlegen, dass es diese Richtungen nicht blockiert:

1. **Multi-Brand als Agentur-Produkt.** Kevin managed bald HERRMANN **+ Kunden-Kanäle** (CoLective/Solmaz zuerst). Genau wie `/ads` pro Kunde läuft, läuft `/content` pro Brand. Das macht das Modul potenziell zu einem **bezahlten Service-Layer** (Content-Retainer), nicht nur zu Kevins Privat-Tool. → Brand/Kunde ist eine erste Klasse im Datenmodell, nicht ein Hardcode „HERRMANN".

2. **1 Kernstück → viele Kanäle (Repurposing).** Kevins eigene Content-Strategie sagt es wörtlich: ein Kernstück (z.B. Website-Teardown) wird zu Reel + Carousel + LinkedIn + Story. Also: **Content-Item ≠ einzelner Post.** Ein Item speist mehrere Kanal-Ableitungen. Modell sollte „ein Angle, mehrere Ausspielungen" abbilden können.

3. **Multi-Channel.** Nicht nur Instagram: LinkedIn (Kevins Akquise-Kanal!), TikTok, YouTube Shorts. `channel` als Feld, Kanäle erweiterbar.

4. **Echtes Scheduling & Auto-Posting — der ehrliche Blick.** Der saubere Weg ist die **offizielle Instagram/Facebook Graph Content Publishing API** (nicht Browser-Automation — die riskiert Sperren). Realität: erfordert Facebook-App + `instagram_content_publish` + **App Review**, Rate-Limit ~50/Tag, und **die API selbst plant nicht vor** — ein eigener Scheduler (Cron/Runner) müsste zum Zeitpunkt posten. Deshalb: **Phase 3, nicht MVP.** Bis dahin bleibt **Meta Business Suite** (nativ, kostenlos, 75 Tage vor) das Vorplan-Werkzeug — das Modul zeigt den Plan, Meta führt aus. Datenmodell aber jetzt schon dafür rüsten: `plannedFor`, `channel`, später `externalPostId`/`publishState`.

5. **Agentic-Kern: ein wachsender Content-Agenten-Katalog.** Der `weekly-content`-Agent ist der Anfang. Das Modul wird die **Startrampe für Content-Agenten**: „Reel aus Demo-Seite bauen", „LinkedIn-Version dieses Posts schreiben", „5 Story-Ideen aus dem Backlog", „Top-Post von vor 3 Monaten repurposen", „analysiere, welche Angles Rückfolger brachten, und schlag die nächsten vor". Das ist die eigentliche **Agentic-OS-Vision**: Kevin dirigiert, Agenten produzieren.

6. **KPI-Rückkopplung — Content an den Funnel andocken.** Kevins Content-KPI ist ausdrücklich **nicht Likes**, sondern **Rückfolger → LinkedIn-Gespräche → Deals**. Es gibt bereits ein Sales-KPI-Modul. Zukunft: Performance/Rückfolger-Daten fließen ins Content-Modul zurück und **steuern die Ideation** (welcher Angle zog, davon mehr). Content-Modul und Sales-Cockpit sind zwei Enden desselben Funnels.

7. **Kalender-/Kanban-Ansicht + Ideen-Eingang.** Zum Vorplanen eine Kalender-/Board-Sicht (die `@dnd-kit`-Dependency ist schon da → Drag&Drop-Umplanen). Und ein niedrigschwelliger **Ideen-Eingang** (Kevin wirft per Text/Sprache eine Idee rein → Agent macht einen Post-Entwurf draus; Quelle u.a. die wöchentlichen Loom-Insights).

## 6. Architektur-Leitplanken (für die Plan-Session)

- **Spiegle `/ads`** — `contentApi.ts` als Klon von `adsApi.ts`, `useContentManifest.ts` als Klon von `useAdManifest.ts` (409/Focus-Refetch/Debounce willst du 1:1). Erfinde die Konfliktlösung nicht neu.
- **Lokal-first + Supabase-Spiegel** beibehalten (Runner schreibt Files, Cockpit spiegelt nach Supabase für mobil/live).
- **Kein node_modules-/iCloud-Fallstrick** beim Content selbst (die Slides liegen in `04_social`, nicht im Repo).
- **Phasieren, nicht alles auf einmal:** MVP (§4) zuerst und deploybar, dann §5 in Stufen. Jede Phase einzeln live-fähig.
- **Verifiziere jede Codebase-Annahme selbst** — dieses Briefing ist Sekundärquelle.

## 7. Auftrag an die Plan-Session

1. Ground die Codebase-Fakten aus §2 am echten Code (`ground`-Skill).
2. Bau daraus den **genauen Umsetzungsplan**: Phasen, `content.json`-Schema, konkrete Dateien (neu/geändert), Runner-Endpoints, UI-Komponenten, Migrationsschritt für `weekly-content` (Manifest mitschreiben).
3. Zeig mir den Plan **vor** dem Bauen (Live-System). Für den Build selbst: `wargame`, weil Runner-Änderung + Netlify-Deploy Realitäts-Ohrfeigen bergen.
4. MVP zuerst bauen, lokal verifizieren (Cockpit im Browser), dann Deploy nach meiner Freigabe.
