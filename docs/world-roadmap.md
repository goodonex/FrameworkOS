> ⚠️ **HISTORISCH (Mai 2026, „Brand OS").** Beschreibt die dreischichtige
> Three.js-Welt, die im Rebuild Phase 6 (07.07.2026) abgerissen wurde und nicht
> zurückkommt. Nichts hier ist ein offener Punkt.
> Aktueller Stand: [`BACKLOG.md`](BACKLOG.md) · [`../HANDOFF.md`](../HANDOFF.md).

# Brand OS — World Rebuild Roadmap

Anker-Dokument für den visuellen Rebuild der App zur dreischichtigen Welt mit Kamera-Navigation. Wird bei jeder weiteren Iteration als Referenz gelesen, bevor neue Welt-Features dazukommen.

---

## In diesem Block (Phase 1 – 7)

Funktional bleibt alles erhalten — CRM, Pipeline, Building, Promo, Discovery, Intelligence, Deliver, Kontakt-Detail, Call Mode, Kundenportal. Die visuelle Hülle wird komplett umgebaut.

### Phase 1 — Drei Zoom-Ebenen als Architektur
- Zentraler State (`useWorldCamera`, Zustand-Store) als Single Source of Truth.
- Vier Stages: `universe`, `brand-system`, `planet-surface`, `moon-surface`.
- Route → Stage Mapping über einen Hook (`/`, `/brand/:slug`, `/brand/:slug/:mode`, `/brand/:slug/deliver`).
- Sidebar- und Welt-Klicks navigieren über Routen, die Kamera folgt automatisch.

### Phase 2 — Kamera-Choreographie
- Eigene Tween-Logik auf `PerspectiveCamera` via `useFrame` + Refs.
- Ease-Out, ~1.2 s für Ebenen-Wechsel, ~0.8 s für Region-Pan innerhalb Planet-Surface, ~1.5 s für den Mond-Schwung.
- `OrbitControls` nur auf `universe` und `brand-system` aktiv, während Tweens komplett deaktiviert.

### Phase 3 — Universe-Ebene
- 5 Brand-Sonnensysteme im All (Planet + Deliver-Mond + Orbit + Label + Glow).
- Brand-Primärfarben in DB synchronisiert: Herrmann & Co. `#3B6FE8` · Wertavio `#B8902A` · CultureFit `#DC4628` · Homeflower `#2D7A4F` · Eversmell `#D4A843`.
- Organisch in Tiefe/Höhe gestaffelt, langsame Eigenrotation, ruhige Komposition.
- Hover verstärkt Glow, Klick navigiert in die Brand. Kein Dashboard mehr auf `/`.

### Phase 4 — Brand-System-Ebene
- Schlankes Dashboard am Rand (`Heute fällig`, `Neueste Signale`, Brand-Name + Datum).
- Toggle `Mehr anzeigen` öffnet das bestehende ausführliche Dashboard. Standardmäßig eingeklappt.
- Sidebar bleibt links, drängt sich nicht in die Mitte.

### Phase 5 — Planet-Surface-Ebene
- 5 Regionen (Building, Discovery, Promo, Sales, Intelligence) als organisch verteilte Patches auf der Kugel.
- Labels am Bildrand mit feiner Verbindungslinie zur Region.
- Bauwerke werden aus echten Daten generiert:
  - **Building** — Pyramide, Höhe & Helligkeit aus Foundation-Health.
  - **Discovery** — Leuchtturm mit Umgebungs-Lichtern (Anzahl Signale).
  - **Promo** — Lichterfeld, Helligkeit je nach Content-Status.
  - **Sales** — Türme pro Kontakt, Höhe = Feld-Vollständigkeit, Stage = Helligkeit, `deal` schießt Lichtsäule Richtung Mond.
  - **Intelligence** — Anhöhe mit zentralem Licht, sammelt Linien aus den anderen Regionen.
- Neue Datensätze wachsen mit Framer-Spring (~800 ms) aus dem Boden.

### Phase 6 — Section-Masken *(historisch; ersetzt durch Module-System — siehe Ergänzung unten)*
- Glass-Maske über der Welt (≈ 70 – 80 % Viewport), Welt am Rand sichtbar.
- Bestehende Mode-Komponenten unverändert reingesetzt — kein AppHeader, kein ModeNav, Sidebar übernimmt die Navigation.
- ESC oder `Welt`-Button im Maske-Header → Maske schließt, Kamera zoomt zur Brand-System-Ebene zurück.
- Fließender Übergang: Maske fade-out 200 ms → Kamera 800 ms → neue Maske fade-in 200 ms.

### Phase 7 — Moon-Surface-Ebene (Deliver)
- Kamera fliegt vom Planet zum Mond.
- Krater = abgeschlossene Projekte (dunkel). Aktive Projekte glühen je nach Stage (`onboarding` schwach → `execute` hell + pulsierend).
- Deliver-Maske öffnet automatisch über der Mondoberfläche.

### Phase 8 — Aufräumen
- Altes Dashboard auf `/` weg, Brand-Dashboard durch schlanke Variante ersetzt.
- Alter Node-Graph (`three/NodeGraph.tsx`, `BrandNode.tsx`, `CameraRig.tsx`, `Connections.tsx`) entfernt.
- Nicht mehr referenzierter `AppHeader` und `ModeNav` entfernt.
- `/brand/:slug/dashboard` redirected nach `/brand/:slug`.
- Mobile (`< 1024 px`): Welt deaktiviert, Brand-Liste statt Universe; Brand-Workspace mit Outlet/Gates (Module-System, vollflächige Inhalte auf schmalen Viewports).

### Ergänzung — Module-System (nach Section-Masken-Rebuild)

- Section-Masken (`SectionMask.tsx`) durch **schwebende Glas-Module** (`ModuleContainer` + `ModuleRenderer`) ersetzt; Modus-Inhalte in Slots / Overlays.
- **Planet-Regionen** navigieren weiter per Route (`RegionPatch`); **Deliver-Mond** in der Brand-System-3D-Szene (`BrandSystemScene`) löst Navigation zu `/brand/:slug/deliver` aus.
- Multi-Modul-Sets für **Sales** und **Intelligence** (Desktop); **Promo** zunächst ein Hauptmodul; Building/Discovery/Deliver über Outlet im Haupt-Slot.

---

## Erledigt — Visual Polish (`feat/visual-polish`)

- [x] Texture-Architektur (`public/textures/`, `textureRegistry.ts`)
- [x] Planeten/Mond/Glow als Bump+Roughness (Brand-`color` bleibt Albedo)
- [x] Stars + Universe-Fog, vereinheitlichtes Lighting
- [x] Region-Labels lesbarer, Bauwerke 2.5× Skala
- [x] Kamera `easeOutCubic` (1200 / 800 ms)
- [x] Mobile: keine Texture-Loads unter 1024 px

---

## Bewusst NICHT in diesem Block (kommt später)

Diese Items sind absichtlich raus, um den Rebuild handhabbar zu halten. Beim nächsten World-Iterations-Block werden sie hier gepickt.

- **Hover und Klick auf einzelne Gebäude** auf der Planeten-Oberfläche — z. B. ein konkreter Kontakt-Turm öffnet die Kontakt-Detailseite direkt aus der 3D-Welt.
- **Detaillierte GLTF-Modelle** — weiterhin offen. **Higgsfield Surface-Texturen** (Bump/Roughness, kein GLTF) sind in `feat/visual-polish` umgesetzt; siehe [`docs/visual-system.md`](visual-system.md) und [`docs/higgsfield-prompts.md`](higgsfield-prompts.md).
- **Weitere Subplaneten und Monde pro Brand** — z. B. ein eigener Mond pro Asset-Kanal, oder ein Subplanet für Lead-Magnets / Funnels.
- **Dynamische Leuchtlinien zwischen Regionen** für Datenflüsse (Discovery → Building, Sales → Intelligence, Promo → Sales). Heute nur statische Intelligence-Linien wenn Daten vorhanden, später animierte Partikel-Spuren.
- **Mobile 3D** — bewusst nicht gebaut (Performance). Mobile bleibt 2D mit Section-Masken vollflächig.
- **Welt-übergreifende Übersicht** — Cross-Brand-Sichten (z. B. alle Sales-Türme aller Brands gleichzeitig im All), Brand-Vergleiche, Multi-Planet-Kamera-Schwenks.
- **Kamera-Cinematics** — programmierbare Sequenzen (Intro-Flyover, "Tour"-Modus durch alle Regionen).
- **Welt-Sound** — ambient Audio-Layer pro Ebene (Universe-Drone, Planet-Surface-Wind, Moon-Echoes).

---

## Konventionen für spätere Iterationen

- Neue Welt-Bauwerke kommen als Komponenten unter `app/src/three/regions/` oder `app/src/three/moons/`.
- Daten-getriebene Strukturen sind **immer** memoisiert (kein Re-Mount in der 3D-Szene bei jedem React-Re-Render).
- Camera-Tweens immer über `useWorldCamera` triggern, nie direkt auf `camera.position` schreiben.
- Section-Masken bleiben Glass + `backdrop-filter: blur(20px)`, Tokens aus `/design/tokens.css`.
- Keine GLTF / `useGLTF`-Loader — Higgsfield-JPG/PNG-Texturen (Bump/Roughness) sind erlaubt und dokumentiert in `docs/visual-system.md`.
- Keine neuen npm-Pakete ohne Rückfrage.
