> ⚠️ **HISTORISCH (Mai/Juni 2026).** Beschreibt die schwebenden Glas-Module über
> der 3D-Welt — beides seit Phase 6 (07.07.2026) abgerissen, Glas ist im Cockpit
> verboten (REBUILD-PLAN §4). Aktueller Stand: [`BACKLOG.md`](BACKLOG.md).

# Module System — Floating Glass Windows

Anker-Dokument für den Umbau der Modus-Darstellung: von monolithischer Section-Maske zu autonomen, fest positionierten Glas-Modulen über der weiterhin sichtbaren und klickbaren 3D-Welt.

**Hinweis:** `docs/foundation-merge-plan.md` kann auf Branches mit ausführlicher Foundation-Planung existieren. Die **Foundation-URL** ist `/brand/:slug/foundation` (ehemals getrennte Building-/Discovery-Routen redirecten dorthin).

---

## Kernkonzept: Module

Ein **Modul** ist eine autonome UI-Einheit mit:

- eigenem Glass-Container (gleiche Sprache wie bisherige Section-Masken),
- fester **Slot-Position** auf dem Bildschirm (kein freies Drag-and-Drop in v1),
- eigenem Inhalt (Children / Registry-Komponente),
- eigenem Lifecycle (öffnen, schließen, Fokus / z-index).

Module schweben **über** der Welt; zwischen den Boxen bleibt Weltraum sichtbar. Sie blockieren die Welt nicht als Vollflächen-Layer — nur die Modul-Fläche hat `pointer-events: auto`.

---

## Modus = Module-Set

Jede Modus-Route entspricht einem **Module-Set**: welche Modul-**Typen** in welchen **Slots** geöffnet werden, optional mit `data` (z. B. Kontakt-ID).

Beispiel **Sales** (Default):

| Slot        | Modul-Typ     | Inhalt              |
|------------|---------------|----------------------|
| `main`     | `pipeline`  | Kanban / SalesMode   |
| `side-top` | `tasks`     | Fällige Follow-ups   |
| `side-bottom` | `quick-stats` | KPI-Kacheln    |

Beispiel **Sales** mit Kontakt:

| Slot           | Modul-Typ        | Inhalt        |
|----------------|------------------|---------------|
| `main`         | `pipeline`       | Kanban        |
| `overlay-right`| `contact-detail` | ContactPage   |

---

## Window Manager (Zustand)

Single Source of Truth: `app/src/store/moduleManager.ts` (Zustand).

- **`modules`**: Liste offener Module mit `id`, `type`, `slot`, optional `data`, `focusedAt`.
- **Slot-Regeln:**
  - `main`, `side-top`, `side-bottom`: höchstens ein Modul pro Slot — neues Modul im gleichen Slot **ersetzt** das alte.
  - `overlay-center`, `overlay-right`: **Stack** möglich (mehrere Instanzen), z-index aus Reihenfolge / Fokus.
- **API:** `open`, `close`, `focus`, `closeAll`, `closeAllExcept`.

---

## Slot-Layout (CSS, Desktop)

Definition in `app/src/modules/slots.ts`. Zwischen den Slots bleibt bewusst Freiraum für die Welt (mind. ca. 24px sichtbar zum linken Rand der Hauptfläche neben der Sidebar-Zone).

| Slot            | Position (Auszug) |
|-----------------|-------------------|
| `main`          | `top: 32px`, `left: BRAND_FLOAT_MAIN_LEFT_X` (Dock + expandierte Sidebar + Abstand), dynamische `width`/`maxWidth`: wenn mindestens ein Modul im Slot `overlay-right` offen ist, wird rechts zusätzlich **`OVERLAY_RIGHT_WIDTH_PX` (640px)** + Rand + **24px** Lücke bis zur Pipeline reserviert, damit Pipeline und Kontakt-Overlay auf **1440px** nicht kollidieren. Ohne Overlay: unverändert Platz für die **320px**-rechte Spalte + bisherigen Puffer (`+56px`). |
| `side-top`      | `top: 32px`, `right: 32px`, `width: 320px`, `height: 280px` |
| `side-bottom`   | `top: 332px`, `right: 32px`, `width: 320px`, `height: calc(100vh - 364px)` |
| `overlay-center`| zentriert, ca. `720×600`, höchster Basis-z-index |
| `overlay-right` | `top: 32px`, `right: 32px`, **`width: 640px`** (`OVERLAY_RIGHT_WIDTH_PX`), `maxWidth`: schrumpft auf schmalen Viewports unterhalb von 640px, begrenzt durch `calc(100vw - BRAND_FLOAT_MAIN_LEFT_X - 48px)` |

### Entscheidung: kein eigener Slot `detail-pane`

480px für Kontakt-Detail führte zu abgeschnittenen Labels und Inputs. **640px** für `overlay-right` plus **dynamische Verengung** des `main`-Slots bei geöffnetem rechten Overlay reicht für typische 1440px-Desktops. Ein zusätzlicher Slot-Typ **`detail-pane` (720px)** mit Verdrängung der Pipeline wäre nur nötig, falls später komplexe Formulare oder Side-by-Side-Vergleiche im Detail Modul landen — dann kann `docs/module-system.md` um diese Variante erweitert werden.

---

## Sidebar als schwebendes Modul

Die Brand-Sidebar ist **kein Flex-Layout-Block** mehr: sie sitzt als **fixed** Glas-Leiste (`left: 16px`, `top/bottom: 16px`), kollabiert **64px**, expandiert per **Hover** (Desktop) auf **240px** (Framer Motion, 200ms). Optional: Pin-Button hält die expandierte Breite bis zum Lösen. **Mobile:** weiterhin **Drawer** (`layout="drawer"`, volle Nav-Breite im Slide-over), kein kollabiertes Float — Tap-to-expand für Float kommt ggf. mit Phase 9.

Inhalt: Brand-Marker/Name, Modus-Liste, Deliver-Untermenü, Universe, Suche/Notifications — Glass wie `ModuleContainer` (Blur, Border, Radius 18px, rechter Schatten).

---

## Route ↔ Module Sync

Hook `useRouteModulesSync` (in `BrandPage` gemountet): liest `pathname` + `slug`, setzt das Modul-Set entsprechend (nach `closeAll` / gezieltem Ersetzen).

Die gerouteten Seiten-Komponenten für bereits migrierte Modi können **Platzhalter** sein (`null`), damit keine doppelte Mount-Logik neben den Modulen läuft.

---

## Welt-Interaktion (Phase 7)

- **Region auf dem Planeten:** Navigation zu `/brand/:slug/<mode>`; Module-Set wechselt; Kamera folgt weiterhin über `useWorldCamera` / Route.
- **Mond (Brand-System):** Klick navigiert zu `/brand/:slug/deliver`.
- **Leerer Weltraum:** keine Aktion; Module bleiben.
- **Universe Doppelklick / bestehende Brand-Tunnel:** unverändert.

Canvas: auf Brand-Workspace `pointer-events: auto` dort, wo kein UI fängt; Overlay-Root bleibt `pointer-events: none`, Module/Sidebar `pointer-events: auto`.

---

## Animation (Phase 8)

Framer Motion am `ModuleContainer`: Eintritt ~280ms ease-out aus slot-typischer Richtung; Exit ~200ms. Moduswechsel: alte Module fade-out ~200ms → Kamera-Tween (bestehend) → neue Module fade-in ~280ms. Hover: leichter Schatten; Klick auf Modul: `focus()` → höchster z-index unter den nicht-Overlay-Slots bzw. Stack-Update bei Overlays.

---

## Desktop Scroll-Flow (≥ 1024px)

Ab **1024px** ersetzt der **Scroll-Flow** das Multi-Modul-`ModuleRenderer`-Layout auf `BrandPage`. Statt schwebender Glas-Fenster mit Titel-Header gibt es einen **vertikalen Section-Scroll** mit Snap, Dot-Navigation und autonomen **`CardTile`**-Kacheln (Glass ohne Modul-Chrome).

| Bereich | Pfad / Verhalten |
|---------|------------------|
| Container | `app/src/components/BrandScrollFlow.tsx` |
| Sections | `app/src/components/sections/*` |
| Section-Order / Route-Mapping | `app/src/lib/scrollFlow.ts` |
| Aktive Section (IO) | `app/src/hooks/useScrollSection.ts` |
| Navigation API | `app/src/context/ScrollFlowContext.tsx` |
| Kacheln | `app/src/modules/CardTile.tsx` |
| Headless Module | `ModuleContainer` mit `headless` (kein Titel/Schließen) |

`useRouteModulesSync` erhält `scrollFlowDesktop: true` → **`closeAll()`**, kein automatisches Öffnen von Modul-Sets. Die **URL** bleibt führend; Section-Wechsel synchronisiert `navigate()` → Kamera über bestehendes `useWorldCameraSyncFromRoute`. Mobile (&lt; 1024px) unverändert: `ModuleRenderer` bzw. `BrandSystemDashboard`.

---

## Mobile (Phase 9)

Ab **Viewport-Breite &lt; 1024px** (für diesen Block): kein Multi-Modul-Desktop-Layout; **ein dominantes Vollbild-Modul** pro Modus-Set, rest über Tabs/Bottom-Sheet (minimal, ohne vollständiges Polish). Welt ausgeblendet wie im World-Rebuild für schmale Viewports. Sidebar: Bottom-Bar / Drawer-Pattern beibehalten.

---

## Bewusst nicht in dieser Phase

- Freies Drag-and-Drop der Module  
- Persistente Layouts pro User  
- Resize per Maus an Modulkanten  
- Multi-Monitor / Fenster-Metaphern  
- Modul-Snapshots / Session-Wiederherstellung  

Diese Punkte sind **Roadmap** für spätere Iterationen und können in `docs/world-roadmap.md` oder hier ergänzt werden.

---

## Technische Anker-Dateien

| Bereich        | Pfad |
|----------------|------|
| Slot-Geometrie | `app/src/modules/slots.ts` |
| Store          | `app/src/store/moduleManager.ts` |
| Container      | `app/src/modules/ModuleContainer.tsx` |
| Registry       | `app/src/modules/registry.tsx` + `app/src/components/ModuleRenderer.tsx` |
| Route-Sync     | `app/src/hooks/useRouteModulesSync.ts` |
| Scroll-Flow    | `app/src/components/BrandScrollFlow.tsx`, `app/src/lib/scrollFlow.ts`, `app/src/modules/CardTile.tsx` |
| Modul-Inhalte  | `app/src/modules/<bereich>/*.tsx` |

---

## Done

Implementiert (Phasen 1–10 dieses Blocks):

- **Architektur & Store:** `docs/module-system.md`, `moduleManager.ts`, `slots.ts`, `ModuleContainer` / `ModuleRenderer`, `useRouteModulesSync`, `registry.tsx`, `workspace-outlet`.
- **Sidebar:** schwebend, vertikal zentriert, kompakte Höhe; `BRAND_FLOAT_SIDEBAR_CLEARANCE_X` + `paddingLeft` am Brand-Hauptbereich.
- **Sales:** Desktop-Dreiteiler + Kontakt-Overlay; Mobile-Gates; `ContactPage variant="module"`.
- **Intelligence:** Desktop-Dreiteiler (`intelligence-morning-brief`, `intelligence-pipeline-forecast`, `intelligence-win-loss`); `IntelligenceFocusTasksBlock`; Mobile `IntelligenceDefaultRouteGate`.
- **Promo:** Desktop ein `promo-workspace`-Modul (main); Mobile `PromoDefaultRouteGate`. Dreiteiler Kalender/Pieces/Campaigns bewusst **nicht** gesplittet (Roadmap).
- **Building / Discovery / Deliver:** Deliver über Modul + Routen; **Foundation** unter `/brand/:slug/foundation` (Building+Discovery in einer Seite); Legacy `/building` und `/discovery` leiten nach `foundation` um.
- **Welt:** `RegionPatch`/`RegionLabel` unverändert; **Mond** in `BrandSystemScene` klickbar → `/brand/:slug/deliver`. UI-Overlay `pointer-events: none`, Module `auto` (bestehend).
- **Animation:** Modul-Ein-/Ausstieg ~280ms / ~200ms pro Slot in `ModuleContainer`-Variants.
- **Mobile:** `<1024` Welt aus, `workspace-outlet` + Gates (Sales, Intelligence, Promo); kein zusätzliches Multi-Modul-Polish.
- **Aufräumen:** `SectionMask.tsx` entfernt.

### Implementierungsstand (Archiv)

Siehe Liste oben unter **Done**.
