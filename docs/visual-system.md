> ⚠️ **HISTORISCH (Mai 2026).** Referenz für die 3D-Welt unter `app/src/three/` —
> diesen Ordner gibt es nicht mehr (Phase 6, 07.07.2026). Nur noch Beleg dafür, woher
> die Texturen in `app/public/textures/` stammen.

# Visual System — 3D-Welt (Texturen & Licht)

Referenz für Iterationen an der Framework-OS-Welt (`app/src/three/`).

## Texture-Pfade

Registry: [`app/src/three/textureRegistry.ts`](../app/src/three/textureRegistry.ts)

| Asset | Pfad |
|-------|------|
| Planet (pro Brand-Slug) | `/textures/planets/{slug}_surface.jpg` |
| Mond | `/textures/moon/moon_surface.jpg` |
| Planet-Glow | `/textures/glow/star_glow.png` |

Dateien liegen unter `app/public/textures/`.

## Material-Prinzip

- **Albedo:** `color` = Brand-Primärfarbe (DB / `getBrandWorldColor`)
- **Struktur:** `bumpMap` + `roughnessMap` = gleiche Graustufen-Texture
- **`map`**: nur die **kontrast-verstärkte Graustufen-Texture** — multipliziert mit `color` (Brand-Farbe bleibt der Farbton, Struktur wird sichtbar). Kein farbiges Higgsfield-Albedo.

Planet (Universe / Brand-System / Planet-Surface):

```tsx
<meshStandardMaterial
  color={brandColor}
  map={surfaceTexture}
  bumpMap={surfaceTexture}
  bumpScale={0.55}
  roughnessMap={surfaceTexture}
  aoMap={surfaceTexture}
  aoMapIntensity={0.5}
  roughness={0.75}
  metalness={0.1}
  emissive={brandColor}
  emissiveIntensity={0.08}
/>
```

Mond (`MoonMesh`):

```tsx
<meshStandardMaterial
  color="#8a8276"
  bumpMap={moonTexture}
  bumpScale={0.55}
  roughnessMap={moonTexture}
  roughness={0.9}
  metalness={0}
/>
```

## Komponenten

| Komponente | Rolle |
|------------|--------|
| `BrandPlanetMesh` | Planet mit optionalem Texture-Loader (Suspense) |
| `BrandPlanetGlow` | Additive Sprite, Scale `1.6 ×` Planet-Radius |
| `MoonMesh` | Mond-Oberfläche mit Texture |
| `useConfiguredTexture` | `TextureLoader` + Mipmaps / Repeat |

## Mobile

`shouldLoadTextures()` → `window.innerWidth >= 1024`

Unter 1024 px: kein Texture-Load; Material nur mit `color`. Canvas ist auf Mobile ohnehin ausgeblendet (`App.tsx`).

## Lighting-Matrix

| Stage | Setup |
|-------|--------|
| Universe / Brand-System | `ambientLight` 0.25 (global in `World.tsx`) + pro System: brand `pointLight` [2,3,2] 1.8 + white fill [-3,-2,-2] 0.4 |
| Planet-Surface | `ambientLight` 0.4 + top `pointLight` [0,12,0] 2.2 white |
| Moon-Surface | `ambientLight` 0.3 + warm `pointLight` [5,8,5] 1.8 `#fefcf5` |

## Atmosphäre

- **Stars** (`@react-three/drei`): nur `universe` + `brand-system` — `count={3500}`, `speed={0.5}`
- **Fog**: nur `universe` — `#080810`, near 60, far 120
- **Glow**: `AdditiveBlending`, `opacity` 0.45 (0.55 bei Hover)

## Performance

- Texturen: `generateMipmaps`, `LinearMipmapLinearFilter`
- Bei FPS-Problemen: kleinere JPGs oder `minFilter = LinearFilter`
- Regenerierung: [`docs/higgsfield-prompts.md`](higgsfield-prompts.md) · Fallback: `python3 app/scripts/generate-fallback-textures.py`

## Kamera

`WorldCameraController`: `easeOutCubic`, 1200 ms Stage-Wechsel, 800 ms Region-Pan, 1500 ms Mond-Schwung.
