> ⚠️ **HISTORISCH (Mai 2026).** Prompts für die Texturen der abgerissenen 3D-Welt.
> Kein offener Punkt — Aufbewahrung nur zur Nachvollziehbarkeit der Assets.

# Higgsfield — Texture Prompts (Visual Polish)

Stand: `feat/visual-polish` · Assets unter `app/public/textures/`.

## MCP-Status bei Generierung

**2026-05-15:** Alle Assets via Higgsfield MCP (`nano_banana_2`, `aspect_ratio` 16:9 Planet/Mond, 1:1 Glow) generiert und nach `app/public/textures/` geladen.

| Asset | Job-ID |
|-------|--------|
| herrmann_surface.jpg | `cb2d487f-5ff1-4efb-8935-81ce8f6ddce5` |
| wertavio_surface.jpg | `241e0a85-6e7c-49ae-9d08-f1ac2bde418e` |
| culturefit_surface.jpg | `8316ba9b-eef9-451f-b621-06f76a5a7434` |
| homeflower_surface.jpg | `4d8a4e9d-4161-4044-b3eb-42358430ba95` |
| eversmell_surface.jpg | `0e6fb317-f9b8-4b76-85de-dd7619e20df5` |
| moon_surface.jpg | `746da119-e2b3-46d7-92f2-6decbc821596` |
| star_glow.png | `699c0a96-6e18-48af-87a3-6eebf7247c43` |

Glow: Higgsfield-PNG + radiale Alpha-Nachbearbeitung (PIL), falls kein natives Alpha.

**Fallback** (nur bei erneutem API-Ausfall): `python3 app/scripts/generate-fallback-textures.py`

Modell: `nano_banana_2` · Resolution Default `1k` · ~2 Credits/Bild.

---

## Planeten — Basis-Template

```
abstract planetary surface texture, monochromatic grayscale,
seamless tileable pattern, high detail terrain elevation map,
no logos, no text, no recognizable objects,
seamless edge transitions, equirectangular projection style,
detailed displacement information for 3D rendering,
[PATTERN]
```

| Brand | Datei | Pattern-Zusatz |
|-------|-------|----------------|
| Herrmann & Co. | `planets/herrmann_surface.jpg` | smooth flowing organic patterns, like calm ocean swells from above |
| Wertavio | `planets/wertavio_surface.jpg` | crystalline mineral structures, geometric fractal-like formations |
| CultureFit | `planets/culturefit_surface.jpg` | volcanic ridges and fault lines, dynamic flowing magma channels |
| Homeflower | `planets/homeflower_surface.jpg` | dense organic forest canopy from above, layered biome textures |
| Eversmell | `planets/eversmell_surface.jpg` | sharp angular geological strata, crystalline desert dune patterns |

### Vollständige Prompts (Beispiel Herrmann)

```
abstract planetary surface texture, monochromatic grayscale,
seamless tileable pattern, high detail terrain elevation map,
no logos, no text, no recognizable objects,
seamless edge transitions, equirectangular projection style,
detailed displacement information for 3D rendering,
smooth flowing organic patterns, like calm ocean swells from above
```

Retry-Hinweis bei farbigem/fotorealistischem Output:

```
grayscale only, displacement height map, no planet sphere in frame,
no color, seamless tileable bump map texture
```

Max. 2 Retries pro Brand, danach prozeduraler Fallback.

---

## Mond

**Datei:** `moon/moon_surface.jpg`

```
detailed lunar surface texture, monochromatic grayscale,
realistic crater field with varied sizes,
high detail elevation map, terrain displacement information,
seamless tileable pattern, no recognizable features or logos,
photographic moon surface, 2048x1024 equirectangular projection
```

---

## Stern-Glow

**Datei:** `glow/star_glow.png`

```
radial light glow effect, soft circular gradient,
center bright white core fading to fully transparent edges,
no background, transparent PNG,
isolated atmospheric halo, no color tint, pure white luminance,
1024x1024 square format with transparent background
```

Falls kein Alpha: radialer Canvas-Gradient (implementiert in `generate-fallback-textures.py` → `write_glow`).

---

## Three.js-Verwendung

Texturen werden **nicht** als `map` (Albedo) genutzt, sondern als `bumpMap` + `roughnessMap`. Brand-Primärfarbe bleibt `color` am `meshStandardMaterial`.

Siehe [`docs/visual-system.md`](visual-system.md).
