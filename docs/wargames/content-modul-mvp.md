> **Phase 1 ist gebaut und committet.** Offen ist der geschlossene Kreis
> (Agent füllt `content.json`) — als O9 in [`../BACKLOG.md`](../BACKLOG.md).
> Gültig bleibt Randbedingung **R4**: Slide-Vorschau immer per `src`, nie `srcDoc`.

# Wargame: Content-Modul MVP (Phase 1)

Stand: 17.07.2026 · Durchgespielt von Opus (Denk-Session) · Executor: beliebiges Modell, blind ausführbar
Grundlage: `docs/CONTENT-MODUL-BRIEFING.md` (Idee) + Grounding-Ledger (18 Fakten am Live-Code verifiziert)

> **WARGAME-ORDER.** Diese Mission wird NICHT hier ausgeführt, sondern Zug für Zug durchgespielt.
> Ein Executor arbeitet die Blaupause unten ab. Jeder Zug nennt: erwartete Beobachtung (Erfolg/Fehlschlag),
> wahrscheinlichsten Fehler + Signal + Gegenzug, Trigger je Weggabelung. Am Ende: Verifikation, Red-Team,
> Abbruchbedingungen, LEDGER.

## Mission in einem Satz

Post-Ebene für `/content` nach dem `/ads`-Muster (Datei-Manifest + 409-Guard + Karten/Detail-Panel),
**additiv** zur bestehenden Wochen-Ansicht, **HERRMANN-only**, **lokal-only** (wie /ads), deploybar auf frameworkos.de.

## Entschiedene Weichen (von Kevin, 17.07.)

- **① Brand-Modell:** `content.json` keyt auf Supabase `brands` via `activeBrand.activeSlug`. Runner mappt Slug→Ordner über eine **feste Allowlist-Map** (MVP: nur `herrmann` → `SOCIAL_ROOT/content-engine/content.json`). Unbekannter/nicht-gemappter Slug → 400.
- **② UI:** View-Umschalter `Posts │ Wochen` in `SocialArea.tsx`. Wochen-Ansicht bleibt unangetastet (mobil/live über Supabase).

## Grundlegende Realitäts-Randbedingungen (aus Recon, gelten für ALLE Züge)

- **R1 — Runner ist lokal-only.** `RUNNER_BASE_URL = 'http://127.0.0.1:4711'` ist hart verdrahtet (`useRunnerStatus.ts:3`). Auf `https://frameworkos.de` blockt der Browser die HTTP-localhost-Fetches (Mixed Content / refused). **Konsequenz:** Die Posts-Ansicht funktioniert nur im lokal geöffneten Cockpit mit laufendem Runner — **exakt wie `/ads` heute**. Auf der Live-Domain zeigt sie denselben „Runner nicht erreichbar"-Zustand. Das ist **gewollte, konsistente Degradierung**, kein Bug. Die Wochen-Ansicht bleibt der Live-/Mobil-Kanal (Supabase). Nicht versuchen, die Posts-Ansicht live lauffähig zu machen — das ist Phase 3 (Supabase-Spiegel).
- **R2 — Runner wird NICHT deployt.** `netlify.toml`: `base="app"`, baut nur `app/`. `runner/index.mjs` läuft nur lokal (`npm run cockpit:full`). Runner-Änderungen brauchen **Runner-Neustart** (kein Hot-Reload, es ist ein nacktes `node`-Prozess).
- **R3 — `content.json` liegt außerhalb des Repos.** Pfad: `~/Kevin OS/02 Projekte/Herrmann & Co/Intern/04_social/content-engine/content.json`. Nicht im Git, nicht im Build. Existiert zu Beginn **nicht** → Runner muss leeres Manifest liefern.
- **R4 — Slide-Vorschau nur mit `src=`, nie `srcDoc`.** Die Post-HTMLs sind **nicht** self-contained: sie referenzieren `../../../../design/slides.css` + `../../../../design/assets/*.png` relativ. `04_social/design/` **existiert und liegt unter `SOCIAL_ROOT`** → wird über `/files/social/` (realpath-Guard, `.css`/`.png` in MIME-Allowlist) ausgeliefert. Damit die relativen Pfade auflösen, MUSS das iframe die **ausgelieferte URL** (`src={socialFileUrl(path)}`) laden — genau wie `AdPreview.tsx:47`. `srcDoc` würde die relativen Pfade brechen (grauer/unstilisierter Post).
- **R5 — ToastProvider ist vorhanden.** `App.tsx:157` umschließt alles → `useToast()` in `useContentManifest` funktioniert.

---

## Züge

### Zug 1 — Runner: `GET/PUT /content/manifest?brand=<slug>`

**Aktion.** In `runner/index.mjs`:
1. Nach dem `SOCIAL_WEEKLY`-Block (~Zeile 68) eine **feste Brand→Pfad-Allowlist** anlegen:
   ```js
   // Content-Manifest pro Brand (Cockpit /content, Post-Ebene). Feste Allowlist —
   // der Brand-Slug wird NIE in einen Pfad interpoliert (kein Traversal).
   const CONTENT_MANIFESTS = {
     herrmann: join(SOCIAL_ROOT, 'content-engine', 'content.json'),
   }
   function contentManifestPath(brand) {
     return CONTENT_MANIFESTS[brand] ?? null
   }
   function emptyContentManifest(brand) {
     return { schemaVersion: 1, brand, updatedAt: null, posts: [] }
   }
   ```
2. Im HTTP-Handler, **neben** dem `/ads/manifest`-Block (nach Zeile 899, vor dem finalen `404`), einen Klon einsetzen — GET + PUT, mit 409-Guard, `readBodyCapped(MANIFEST_MAX_BYTES)`, Schema-Check `schemaVersion===1 && Array.isArray(manifest.posts)`.

**Erwartete Beobachtung — Erfolg.**
- `curl 'http://127.0.0.1:4711/content/manifest?brand=herrmann'` → `200` mit `{"schemaVersion":1,"brand":"herrmann","updatedAt":null,"posts":[]}` (Datei existiert noch nicht → leeres Manifest).
- PUT mit `{baseUpdatedAt:null, manifest:{schemaVersion:1,brand:"herrmann",posts:[]}}` → `200 {ok:true, updatedAt:"<ISO>"}`, Datei `content-engine/content.json` wird angelegt.
- Zweiter PUT mit falschem `baseUpdatedAt` → `409` mit `{error, current}`.

**Erwartete Beobachtung — Fehlschlag.** GET liefert `404 {"error":"not found"}`.

**Wahrscheinlichster Fehler.** Runner nicht neu gestartet → alte Route-Tabelle → 404 trotz Code (R2).
- **Signal:** GET `/content/manifest` = `404 not found`, obwohl der Code die Route enthält.
- **Gegenzug:** Runner-Prozess neu starten (`npm run cockpit:full` bzw. den `node runner/index.mjs` killen + neu). Erneut curlen.

**Zweit-wahrscheinlicher Fehler.** Brand nicht in `CONTENT_MANIFESTS` → `contentManifestPath` gibt `null` → 400.
- **Signal:** `400 {"error":"Unbekannter Brand: herrmann"}`.
- **Gegenzug:** Map-Key prüfen (`herrmann` kleingeschrieben, exakt = `activeSlug`-Default in `activeBrand.tsx:7`).

**Trigger.**
- GET = 404 „not found" → **R2-Route-Neustart**, dann weiter.
- GET/PUT = 400 „Unbekannter Brand" → Map-Key-Fix.
- PUT = 400 „Manifest mit schemaVersion 1 und posts[] erwartet" → Schema-Check nutzt fälschlich `ads` statt `posts` → korrigieren.

**Abbruch.** Wenn nach Runner-Neustart + korrekter Map GET weiter 404/500 liefert → **stoppen und Runner-Logs melden** (nicht raten).

---

### Zug 2 — `app/src/cockpit/lib/contentApi.ts` (Klon von `adsApi.ts`)

**Aktion.** Neue Datei. Typen + Fetcher, **Post-Ebene statt Ad/Version-Ebene** (Posts sind flach, keine `versions[]`):
```ts
export type ContentStatus = 'idea' | 'production' | 'review' | 'scheduled' | 'posted'
export type ContentChannel = 'instagram' | 'linkedin' | 'tiktok' | 'youtube'
export type ContentFormat = 'carousel' | 'reel' | 'story' | 'single'
export interface SlideRef { path: string; note?: string }   // rel zu SOCIAL_ROOT
export interface ContentNote { at: string; text: string }
export interface ContentPost {
  id: string; title: string; angle?: string
  status: ContentStatus; channel: ContentChannel; format: ContentFormat
  plannedFor?: string; caption?: string
  slides: SlideRef[]; week?: string; done: boolean; notes?: ContentNote[]
}
export interface ContentManifest {
  schemaVersion: 1; brand: string; updatedAt: string | null; posts: ContentPost[]
}
export const CONTENT_STATUS_LABEL: Record<ContentStatus, string> = {
  idea: 'Idee', production: 'In Produktion', review: 'Review', scheduled: 'Geplant', posted: 'Gepostet',
}
export const CONTENT_STATUS_ORDER: ContentStatus[] = ['idea','production','review','scheduled','posted']
```
- `fetchContentManifest(brand)` → GET `/content/manifest?brand=<slug>`.
- `putContentManifest(brand, manifest, baseUpdatedAt)` → PUT, gleiche 409-Semantik wie `putAdManifest` (Error mit `.status===409`, `.body.current`).
- `req<T>`-Helper 1:1 aus `adsApi.ts` (inkl. `cache:'no-store'` + Error-mit-status).
- **Slide-URL NICHT neu bauen:** `socialFileUrl` aus `socialApi.ts` importieren (Slides liegen unter `SOCIAL_ROOT`, werden über `/files/social/` serviert). `kundenFileUrl` NICHT verwenden (falscher Root).

**Erwartete Beobachtung — Erfolg.** `npm run build --prefix app` (bzw. `tsc`) ohne Fehler; kein Import unbenutzt.

**Wahrscheinlichster Fehler.** Übernommene Ad-spezifische Exports (`deriveMetrics`, `AdVersion`, `seedReview`) bleiben stehen und referenzieren nicht-existente Felder.
- **Signal:** `tsc`-Fehler „Property 'versions'/'metrics' does not exist on ContentPost".
- **Gegenzug:** Alle Version/Metrics/Review-Konstrukte streichen — Content-MVP hat weder Versionen noch CPL/CTR noch Design/Copy-Checklisten. Nur Post-Flach-Modell + Notizen behalten.

**Trigger.** `tsc`-Fehler auf `versions`/`metrics`/`seedReview` → Ad-Reste löschen. Kein Fehler → Zug 3.

---

### Zug 3 — `app/src/cockpit/lib/useContentManifest.ts` (Klon von `useAdManifest.ts`)

**Aktion.** 1:1-Klon der Konfliktlösungs-Maschinerie (der wertvolle Teil), Mutatoren auf Post-Ebene:
- Übernehmen **unverändert:** `PUT_DEBOUNCE_MS=600`, `baseUpdatedAt`-Ref, `pending`/`inFlight`-Guards, `adopt`, `reload` (mit `pending||inFlight`-Schutz, `useAdManifest.ts:37`), `flush` (409→`adopt(current)`+Toast), Focus-Refetch (`:98-102`), `beforeunload`-Flush (`:105-113`), `mutate` (optimistisch + debounced).
- **Ersetzen:** `toggleCheck`/`addNote(ad,v,...)`/`setStatus(ad,...)` durch Post-Mutatoren:
  ```ts
  setStatus(postId, status)      // m.posts.map(p => p.id===postId ? {...p, status} : p)
  toggleDone(postId)             // {...p, done: !p.done}
  setPlannedFor(postId, iso|undefined)
  setChannel(postId, channel) / setFormat(postId, format)   // optional MVP
  addNote(postId, text)          // notes: [...(p.notes??[]), {at:new Date().toISOString(), text}]
  ```
- Signatur: `useContentManifest(brand: string | undefined)`.

**Erwartete Beobachtung — Erfolg.** `tsc` grün; Hook exportiert `{ manifest, loading, error, reload, setStatus, toggleDone, setPlannedFor, addNote }`.

**Wahrscheinlichster Fehler.** `reload`/`flush` referenzieren noch `slugRef`/`fetchAdManifest`/`putAdManifest`.
- **Signal:** „Cannot find name 'fetchAdManifest'".
- **Gegenzug:** Auf `fetchContentManifest`/`putContentManifest` + `brandRef` umbenennen.

**Dritt-Ordnung-Falle (WICHTIG).** Der Focus-Refetch (`reload` bei `window.focus`) ist der Mechanismus, über den **Claude-Edits an `content.json` im UI sichtbar** werden. Er ist durch `pending.current || inFlight.current` geschützt — **diesen Guard NICHT entfernen**, sonst überschreibt ein Refetch ungespeicherte optimistische Änderungen mit altem Disk-Stand (dokumentierter Bug-Grund in `useAdManifest.ts:34-37`).

**Trigger.** `tsc`-Fehler auf Ad-Fetcher → Content-Fetcher einsetzen. Kein Fehler → Zug 4.

---

### Zug 4 — `app/src/cockpit/components/content/` (Klon der Ads-Komponenten)

**Aktion.** Drei Dateien, angelehnt an `components/ads/`:

**`ContentPreview.tsx`** (angelehnt an `AdPreview.tsx`):
- Props `{ post: ContentPost }`. Tab je Slide (`post.slides`), `src={socialFileUrl(slide.path)}` im iframe (HTML → iframe; **immer `src`, nie `srcDoc`** — R4). Fallback wenn `slides.length===0`: „Keine Slides".
- Sandbox: `sandbox="allow-same-origin allow-scripts"` genügt (self-generierter Content, konsistent mit SocialArea-Iframe).

**`ContentCard.tsx`** (angelehnt an `AdCard.tsx`):
- Props `{ post, onOpen }`. Zeigt Titel, `angle`, `StatusPill` (Content-Variante), `plannedFor` (falls gesetzt, `de-DE`-Datum), `done`-Häkchen-Indikator, Slide-Anzahl. Thumb: erstes Slide klein als iframe **oder** schlichter Platzhalter (iframe-Thumbs sind teuer bei vielen Karten → MVP: Platzhalter + Slide-Zahl, echte Vorschau erst im Detail-Panel).

**`ContentDetailPanel.tsx`** (angelehnt an `AdDetailPanel.tsx`, overlay-right):
- Props `{ post, onClose, onSetStatus, onToggleDone, onSetPlannedFor, onAddNote }`.
- Inhalt: `ContentPreview`; **Caption-Block mit 1-Klick-Copy** (`<button onClick={() => navigator.clipboard.writeText(post.caption ?? '')}>` + Toast „Caption kopiert" — Muster wie `RunDrawer.tsx:31`); Status-`<select>` (`CONTENT_STATUS_ORDER`); `plannedFor` als `<input type="date">`; `done`-Checkbox; Notizen-Liste + Eingabe (aus `AdDetailPanel` übernehmen); **Slides-Download**: pro Slide „Groß öffnen ↗" (Link auf `socialFileUrl(path)`, `target=_blank`) — echtes Asset-Bundle-ZIP ist Phase 2.
- ESC schließt (`useEffect`-Keydown aus `AdDetailPanel.tsx:25-31`).
- `StatusPill` als lokale Inline-Komponente (wie in `AdsArea`), Farbe: `posted`/`scheduled` → accent, `review` → warn, sonst text-3.

**Erwartete Beobachtung — Erfolg.** `tsc` grün. Im Browser (nach Zug 5): Karte klickbar → Panel öffnet → Slide rendert **stilisiert** (slides.css geladen), Caption-Copy schreibt in die Zwischenablage (Toast erscheint).

**Wahrscheinlichster Fehler.** Slide-Preview grau/unstilisiert.
- **Signal:** iframe zeigt Text ohne Layout; Netzwerk-Tab: `GET /files/social/design/slides.css` = 403 oder 404.
- **Gegenzug:** (a) `srcDoc` statt `src` verwendet → auf `src` umstellen (R4). (b) 403 „Dateityp nicht erlaubt" → `.css` fehlt in `KUNDEN_MIME` — ist vorhanden (`runner/index.mjs:552`), also eher (a). (c) 404 → `04_social/design/` fehlt/verschoben → Pfad der Slide im Manifest prüfen (`slides[].path` muss `content-engine/weekly/<KW>/posts/post-*.html` sein, rel zu `SOCIAL_ROOT`).

**Trigger.** iframe unstilisiert → erst `src`-vs-`srcDoc` prüfen (häufigste Ursache), dann Netzwerk-Status der `.css`.

---

### Zug 5 — `SocialArea.tsx`: additiver `Posts │ Wochen`-Umschalter

**Aktion.** In `SocialArea.tsx`:
- Neuer State `const [view, setView] = useState<'posts' | 'weeks'>('posts')`.
- Ganz oben ein Umschalter (zwei `ck-btn`, aktiver = `ck-btn--primary`). Titelzeile bleibt.
- `view==='weeks'` → **exakt der bestehende Code** (Liste + srcdoc-iframe) — unangetastet lassen, nur in einen Branch hängen.
- `view==='posts'` → neue `<ContentPostsView brand={activeSlug} />` (kann als lokale Komponente in derselben Datei oder separat liegen):
  - `const { manifest, loading, error, setStatus, toggleDone, setPlannedFor, addNote } = useContentManifest(brand)`.
  - **Runner-offline / Fehler** → Banner „Runner nicht erreichbar: …" (Muster `AdsArea.tsx:97-103`) — **kein Crash** (R1). Das ist der Live-Domain-Normalfall.
  - `manifest.posts.length===0` → Leerzustand „Noch keine Posts im Manifest — leg content.json an oder klick ‚Neue Beiträge bauen'".
  - Posts-Grid (`ContentCard`) + `ContentDetailPanel` für den offenen Post (Panel-Steuerung über lokalen State `openId`, nicht über Route — SocialArea hat keine Sub-Routen wie AdsArea).
  - **„Neue Beiträge bauen"-Button** → `postRun('weekly-content')` (aus `runnerApi.ts:43`). Nach Klick: Button disabled + Toast „Batch gestartet — Ergebnis erscheint unter /agenten". Fehler-Fälle unten.

**Erwartete Beobachtung — Erfolg.**
- Umschalter sichtbar; `Wochen` zeigt unverändert die alten Wochen-Batches; `Posts` zeigt Karten aus `content.json`.
- „Neue Beiträge bauen" → `202`-Antwort, Toast; unter `/agenten` taucht ein laufender `weekly-content`-Run auf.
- Auf frameworkos.de (ohne Runner): `Posts` zeigt das „Runner nicht erreichbar"-Banner, `Wochen` funktioniert weiter über Supabase.

**Wahrscheinlichster Fehler.** „Neue Beiträge bauen" auf Live-Domain oder ohne Runner → Fetch schlägt fehl.
- **Signal:** Netzwerk-Fehler / `TypeError: Failed to fetch` an `127.0.0.1:4711/run`.
- **Gegenzug:** `postRun` in try/catch, Fehler → Toast „Runner nicht erreichbar — Batch nur lokal startbar (npm run cockpit:full)". Button so lassen (kein Crash).

**Zweit-Fehler.** Agent läuft schon → Runner antwortet `409 {error:"weekly-content läuft bereits"}`.
- **Signal:** `409` von `/run`.
- **Gegenzug:** Toast mit der Runner-Fehlermeldung; Button während `a.running` disabled (Status über `fetchAgents()` oder schlicht nach Klick lokal disabled halten).

**Dritt-Fehler (Brand-Wechsel).** Kevin schaltet `activeBrand` auf z.B. `culturefit` → `useContentManifest('culturefit')` → Runner 400 „Unbekannter Brand".
- **Signal:** Posts-Ansicht zeigt Fehlerbanner mit „Unbekannter Brand: culturefit".
- **Gegenzug (gewollt):** Banner-Text abfangen → freundlicher Leerzustand „Für **{Brand}** ist noch kein Content-Ordner angelegt (kommt in Phase 3)". Kein Crash. HERRMANN bleibt der einzige funktionierende Brand im MVP.

**Trigger.**
- Fetch-Fehler an `/run` → Offline-Toast, weiter.
- `409` an `/run` → „läuft bereits"-Toast.
- Manifest-Fehler „Unbekannter Brand" → Phase-3-Leerzustand statt Fehlerbanner.
- Wochen-Ansicht verändert sich sichtbar → **sofort revert**, der Branch darf den Alt-Code nicht berühren (Abbruch, s.u.).

**Abbruch.** Wenn die **Wochen-Ansicht** nach dem Umbau anders rendert als vorher (Regression an bestehendem, live genutztem Code) → stoppen, Diff auf den Wochen-Branch prüfen, erst weiter wenn die Wochen-Ansicht bit-identisch ist.

---

## Verifikation (welche Checks der Executor fährt, und was „bestanden" heißt)

1. **Typecheck/Build:** `npm run build --prefix app` → **0 Fehler**. (Netlify baut identisch — grün hier = grün im Deploy.)
2. **Runner-Endpoint (curl, lokal):**
   - `GET /content/manifest?brand=herrmann` = 200, leeres Manifest bei fehlender Datei.
   - `GET /content/manifest?brand=xxx` = 400.
   - PUT gültig = 200 + Datei geschrieben; PUT mit falschem `baseUpdatedAt` = 409 + `current`.
3. **Browser lokal (`npm run cockpit:full`), Verifikations-Workflow über Preview-Tools:**
   - `/content` öffnen → Umschalter da; `Wochen` unverändert.
   - `content.json` mit **1 Test-Post** (verweist auf `content-engine/weekly/2026-W29/posts/post-01-fuenf-sekunden-test.html`) manuell anlegen → `Posts` zeigt 1 Karte.
   - Karte klicken → Panel; Slide rendert **stilisiert** (Netzwerk-Tab: `slides.css` = 200); Caption-Copy → Toast + Zwischenablage.
   - Status ändern / done haken / plannedFor setzen → nach 600 ms PUT (Netzwerk-Tab 200); Datei auf Disk aktualisiert.
   - **409-Pfad:** während offenem Panel `content.json` extern editieren (anderes Tool) → Tab-Fokus zurück → Toast „extern geändert, neu geladen".
   - „Neue Beiträge bauen" → Toast; `/agenten` zeigt laufenden Run.
   - `read_console_messages` → **keine roten Fehler**.
4. **Degradierungs-Check:** Runner stoppen → `/content` `Posts` zeigt Fehlerbanner (kein weißer Screen), `Wochen` lädt weiter aus Supabase.
5. **Screenshot** der Posts-Ansicht + Detail-Panel als Abnahme-Beleg an Kevin.

**Bestanden** = 1–5 alle grün. Erst dann Deploy-Vorschlag an Kevin (Netlify zieht `main`/`cockpit-rebuild` automatisch — Deploy-Branch mit Kevin klären, s. LEDGER).

---

## Red-Team-Durchgang (Angriff → hielt/patch)

- **Angriff A: Path-Traversal über `?brand=../../etc`.** → **Hielt.** `contentManifestPath` schlägt jeden Slug nach, der nicht Key der festen Map ist → `null` → 400. Der Slug wird nie in einen Pfad interpoliert. (Bewusst KEIN `join(SOCIAL_ROOT, brand)`.)
- **Angriff B: Riesiges `content.json` per PUT (Speicher-DoS).** → **Hielt.** `readBodyCapped(MANIFEST_MAX_BYTES=2MB)` → 413. Aus `/ads` geerbt.
- **Angriff C: Zwei parallele Writer (Kevin im UI + `weekly-content`-Agent).** → **Hielt** durch 409-Guard — ABER der Agent schreibt in Phase 1 **noch kein** `content.json` (er baut nur Posts+Galerie, `WEEKLY.md`). Also im MVP kein realer Parallel-Write. **Patch der Erwartung:** Der „geschlossene Kreis" (Agent merged Manifest) ist **Phase 2**; im MVP wird `content.json` manuell/durch eine separate Claude-Session gepflegt. Der 409-Guard schützt trotzdem den Fall „Kevin im UI + Claude-Session editiert die Datei".
- **Angriff D: `srcDoc`-Reflex.** Der Executor kennt die self-contained Wochen-HTML (SocialArea nutzt `srcDoc`) und überträgt das reflexartig auf Post-Slides. → **Wäre durchgekommen** (grauer Post). **Patch:** R4 explizit als Randbedingung + in Zug 4 als wahrscheinlichster Fehler mit Signal (`slides.css` 403/404) verdrahtet.
- **Angriff E: Panel-State über Route.** Executor kopiert `AdsArea`s Routen-Panel (`/content/:id`) — aber `/content/*` mountet `SocialArea` ohne Sub-Routen-Setup. → **Wäre 404/Blank.** **Patch:** Zug 5 schreibt lokalen `openId`-State vor, keine Sub-Route.
- **Angriff F: Wochen-Regression.** Umbau fasst den Alt-Code an. → **Patch:** Abbruchbedingung in Zug 5 + Verifikations-Schritt „Wochen unverändert".

---

## Abbruchbedingungen (stoppen & melden statt improvisieren)

1. Runner-Endpoint liefert nach Neustart + korrekter Map weiter 404/500 → Runner-Logs melden.
2. Slide-Preview bleibt nach `src`-Fix + 200 auf `slides.css` unstilisiert → melden (unerwartete CSS-Struktur).
3. Wochen-Ansicht rendert nach dem Umbau anders → sofort revert, nicht weiterbauen.
4. `npm run build` bleibt nach Ad-Rest-Bereinigung rot → Fehler-Log melden.
5. Irgendein Schritt verlangt, `content.json` in einen Pfad außerhalb `SOCIAL_ROOT` zu schreiben → **niemals** tun, melden.

---

## LEDGER — offene Variablen / Inputs vor Ausführung

- `{{deploy_branch}}` — **Klären mit Kevin:** Zieht Netlify von `main` oder `cockpit-rebuild`? Memory sagt „main==cockpit-rebuild". Vor dem ersten `git push` bestätigen, dass Netlify den richtigen Branch baut. **Blocker für Deploy, nicht für Build/lokale Verifikation.**
- `{{test_post_seed}}` — Für die lokale Verifikation braucht es 1 realen Post im Manifest. Kann der Executor selbst anlegen (verweist auf die existierende `2026-W29/posts/post-01-*.html`). Kein externer Input nötig.
- **Kein Blocker:** Schema, Pfade, Endpoints, Komponenten-Vorlagen, Degradierungsverhalten — alles am Code verifiziert.

## Was dieses Wargame bewusst NICHT abdeckt (Scope-Grenzen)

- Agent schreibt `content.json` mit (geschlossener Kreis) → **Phase 2**.
- Multi-Brand-Dateiunterbau (CoLective etc.) → **Phase 3** (feste Map wird zum Register).
- Live/mobil-Sicht der Posts (Supabase-Spiegel wie `social_batches`) → **Phase 3**.
- Kanban/Kalender (`@dnd-kit`), Repurposing-Modell, Scheduling-API, KPI-Rückkopplung → **§5 Briefing, später**.
- Asset-Bundle-Download (ZIP) → **Phase 2** (MVP: „Groß öffnen ↗" pro Slide).
