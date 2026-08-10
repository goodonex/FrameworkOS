# Uriel · Phase 2 — Design-Tokens (eingefroren 2026-08-10)

Entschieden von Kevin nach drei Varianten-Runden (`style-varianten*.html` in
diesem Ordner). **Das hier ist die Wahrheit für alles Ästhetische in Phase 2** —
die Blaupause (`docs/wargames/phase2-haptik.md`) verweist hierher. Wer beim
Bauen von diesen Werten abweichen will, stoppt und fragt.

## Die Entscheidung in einem Satz

Zwei Welten, eine Geometrie: das **Cockpit** (Kevins tägliches Instrument) läuft
in der warmen Waldgrün-Welt **V5 „Horizont"**, das **Kundenportal** in der
HERRMANN-Marken-Welt **V6 „Navy × Gold"**. Beide teilen Radien, Karten,
Typografie-System und den goldenen Uriel-Funken ✦ als Klammer. Das
Stern-Ornament bleibt **bewusst außerhalb der App** (nur Wallpaper/Sperrbildschirm
— V7 wurde angesehen und verworfen, 10.08.).

## Welt 1 · Cockpit („Horizont", aus V5)

### Farben

| Token | Wert | Rolle |
|---|---|---|
| `--ck-bg` | `#0c130e` | Grundfläche (warmes Waldgrün-Schwarz — NIE reines Schwarz) |
| `--ck-bg-verlauf` | `linear-gradient(180deg, #131b16 0%, #0f1712 55%, #0c130e 100%)` | Seiten-Hintergrund |
| `--ck-ambient` | `radial-gradient(ellipse 90% 44% at 50% -6%, rgba(122,168,110,0.14), transparent 62%)` | Licht von oben, je Seite einmal |
| `--ck-text-1` | `#eaf0e6` | Primärtext |
| `--ck-text-2` | `#a7b3a2` | Sekundärtext |
| `--ck-text-3` | `#737d70` | Labels, Meta |
| `--ck-accent` | `#aecfa4` | DER eine Akzent (Salbei) — Aktiv-Zustände, Balken, Ringe |
| `--ck-accent-text` | `#c4dcba` | Akzent auf dunklem CTA-Grund |
| `--ck-warn` | `#d9ab52` | Warnungen in gedämpftem Gold — **nie Rot** für „liegt/überfällig" |
| `--ck-danger` | `#e5484d` | Nur echte Fehler (bestehender Wert bleibt) |
| `--ck-ok` | `#aecfa4` | Erfolg = Akzent (keine dritte Signalfarbe) |
| `--ck-gold` | `#d9bd7d` | NUR für den Uriel-Funken ✦ (Klammer zur Marke) |
| `--ck-card` | `rgba(30,40,33,0.55)` | Kartenfläche |
| `--ck-card-border` | `rgba(214,235,205,0.08)` | Kartenkante (Haarlinie) |
| `--ck-radius` | `24px` | Karten; Kacheln/Innenkarten `18px`; Pillen `999px` |

### Typografie

| Rolle | Schrift | Regeln |
|---|---|---|
| Fließtext, UI, Labels | **Inter** (400/500/600/700) | Labels: 10px, 700, `letter-spacing: 0.14–0.16em`, Versalien, `--ck-text-3` |
| Editorial-Momente | **Instrument Serif** (400) | NUR: Begrüßung, Ring-Zahl, KPI-Großzahlen. Nie im Fließtext, nie in Knöpfen |
| Zahlen in Tabellen | Inter mit `font-variant-numeric: tabular-nums` | JetBrains Mono entfällt |

Syne, DM Sans und JetBrains Mono werden ersetzt. Google-Fonts-Link in
`app/index.html` entsprechend tauschen (`display=swap`).

### Material & Komponenten (aus den Mocks, verbindlich)

- **Karten:** weiche Flächen, Haarlinien-Kante, kein Schlagschatten-Gewitter;
  Innenabstand großzügig (≥ 13–16px).
- **Uriel-Eingabe:** Pille mit Glow `0 0 30px rgba(174,207,164,0.13)`,
  Rand `rgba(174,207,164,0.24)`, Funke ✦ in `--ck-gold`.
- **Dock (mobil):** schwebende Pille statt durchgezogener Leiste —
  `backdrop-filter: blur(14px)`, Rand-Haarlinie, aktiver Tab: Icon in
  `--ck-accent` + 4px-Punkt darunter. Icons: Inline-SVG-Linien (stroke 1.7,
  round caps), keine Unicode-Geometrie mehr.
- **Tages-Ring (Cockpit-Home):** SVG-Kreis r52, Strich 5, `--ck-accent`,
  dunkle Glas-Mitte `rgba(8,13,9,0.5)`, Zahl in Serifen.
- **Foto-Ambiente:** NUR auf dem Cockpit-Home. Quelle: `app/public/ambient/`
  (selbst gehostet, nie hotlinken). Verlauf ins Grün wie im Mock:
  `linear-gradient(180deg, rgba(12,19,14,0.28) 0%, rgba(12,19,14,0.06) 34%, rgba(12,19,14,0.62) 72%, #0c130e 99%)`.
  Jeder Text über Foto trägt `text-shadow` (Scrim-Pflicht).
- **KPI-Kacheln:** Label klein oben, große Zahl (Serif auf Home, Inter tabular
  in Arbeitsflächen), 3px-Fortschrittsbalken in `--ck-accent`.

### Haltung

Nur Dunkel (Hell-Toggle entfällt in Phase 2, Hell-Modus ggf. später neu auf
Token-Basis). Bewegung: erst nach dem Aufbau, dann kurz und selten. Dichte:
Luft im Cockpit-Home, dicht in Listen/Tracking. Arbeitsflächen (Sales, Listen,
Tracking, Ads) bleiben ruhige Farbfläche — kein Foto, kein Ornament.

## Welt 2 · Kundenportal („Navy × Gold", aus V4/V6)

Gleiche Geometrie und Typo-Logik wie das Cockpit, nur die Palette klappt um.
Quelle der Markenwerte: `Herrmann & Co/Intern/02_branding/herrmann_co_brand_system-2.html`.

| Token | Wert |
|---|---|
| `--portal-bg` | `#0A1128` (Verlauf `#101a33 → #0A1128 → #060b1c`) |
| `--portal-text-1/2/3` | `#eef1f8` / `#a3adc4` / `#6b7590` |
| `--portal-accent` (Gold) | `#C5A059` · CTA-Text `#dfc48e` · Warn `#d9b36a` |
| Karten | `rgba(28,38,64,0.5)` mit Kante `rgba(197,160,89,0.13)` |
| Display-Schrift | Archivo (Markenschrift) — Serifen-Momente optional wie V6 |
| Cover-Foto (optional) | Alpenglühen (`style-varianten-runde3.html`), gleiche Scrim-Regeln |

Achtung: `--portal-accent` wird heute pro Projekt aus der Brand-Farbe gesetzt —
beim Umbau prüfen und die Projekt-Akzentfarbe als Detail-Akzent (z. B.
Deliverable-Status) erhalten, Gold als Rahmen-Akzent der HERRMANN-Hülle.

## Was ausdrücklich NICHT kommt

Ornament im App-Hintergrund (verworfen) · Hell-Modus (später) · neue
Signalfarben · Foto/Ambiente auf Arbeitsflächen · Animations-System (Phase 2b,
nach dem Aufbau).
