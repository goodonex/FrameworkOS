# Wallpaper aus einem Guss — iPhone · MacBook · Uriel

**Status: umgesetzt 2026-08-13.**

## Ergebnis

| Fläche | Asset | Maße |
|---|---|---|
| iPhone | `~/Downloads/uriel-wallpaper-foto.png` | 1170×2532 — **unverändert** |
| MacBook | `~/Kevin OS/03 Bereiche/Privat/Bilder/uriel-wallpaper-macbook.png` | 3456×2234, gesetzt |
| Uriel mobil (Hero) | `app/public/ambient/horizont-hero.jpg` | 1400×1687 (hoch), 267 KB |
| Uriel Desktop (Schleier) | `app/public/ambient/horizont-desktop.jpg` | 2560×1600, 335 KB |
| Master | `~/Kevin OS/03 Bereiche/Privat/Bilder/uriel-wallpaper-master-5056.png` | 5056×3392 |

Alle zeigen dieselbe Szene: den Quiraing-Grat (Isle of Skye) im Sonnenaufgang —
Felskante links, Straße rechts unten, Nebelwalze über dem Grat, Sonnendurchbruch rechts.

## Wie das Master-Asset entstand

Route A (freies Original finden) **gescheitert**: Unsplash führt Quiraing-Fotos
(`IGnidUrN7oo`, `IZP8SqD3CqU`), aber keines mit diesem Licht und dieser Perspektive.
Wallpaper-Aggregatoren schieden wegen unklarer Lizenz aus.

Route B: **Nano Banana 2** (`nano_banana_flash`) über die Higgsfield-CLI, mit beiden
vorhandenen Fassungen als Referenz — dem Szenen-Crop des Handy-Bilds (1170×1400; darunter
ist das PNG schwarz) und `horizont.jpg`. Ergebnis 5056×3392, kein Upscaling nötig.

Für den nächsten Lauf gemerkt:
- `nano_banana_pro` verlangt Pro/Ultimate — Kevins Konto ist Starter. `nano_banana_flash` liefert.
- `aspect_ratio` kennt **kein 16:10**. Erlaubt: 1:1, 3:2, 2:3, 4:3, 3:4, 4:5, 5:4, 9:16, 16:9, 21:9.

## MacBook

3456×2234 (16"-nativ). Weicher Verlauf nach `#0c130e`: oben 8 % der Höhe bei 22 % Deckkraft
für die Menüleiste, unten ab 74 % auf 58 % für das Dock, beides smoothstep. Bewusst **nicht**
die Zwei-Drittel-Schwärzung des Lockscreens — der Desktop soll die Szene zeigen.
Gesetzt per `osascript`, Pfad zurückgelesen.

## Uriel — der Irrweg und was richtig ist

**Zuerst falsch gebaut:** eine Media-Query `min-width: 901px`, die eine große Querformat-Fassung
am Desktop einschalten sollte. Wirkungslos, aus zwei Gründen zugleich:

```js
// CockpitHome.tsx:172
return isMobile ? <UrielHome /> : <CockpitHomeDesktop />
```

`HeroHorizont` — die einzige Stelle mit `.ck-hero-foto` — steckt in `UrielHome`, und das ist
die **mobile** Ansicht. Am Desktop rendert `CockpitHomeDesktop` (Graph + Panels) ganz ohne
Foto-Fläche. Die Regel schaltete das Bild also dort ein, wo nie eines steht, und ließ am
Handy das alte 780er stehen.

**Zweiter Fund:** `.ck-hero-foto` ist volle Breite auf 470px Höhe — am 390er Handy ein
**Hochformat** (0,83). Ein Querformat-Asset verliert dort per `cover` 56 % seiner Breite.
Die Form war also falsch, nicht nur die Auflösung.

### Jetzt eingebaut

**Mobil:** `--ck-foto` zeigt ohne Media-Query auf `horizont-hero.jpg` (1400×1687, hochformatig
aus dem Master geschnitten, rechter Bildteil — der einzige Ausschnitt, der Felskante, Grat,
Straße *und* Sonnendurchbruch zeigt, wie das Handy-Wallpaper). 1400px Breite deckt 3×-Retina
auf 390–430pt.

**Desktop:** ein Schleier in `.ck-root` unter `@media (min-width: 901px)` — dieselbe Szene
liegt über dem deckenden `--ck-bg-verlauf` und unter einem Schutzverlauf
(`rgba(12,19,14,.74)` → `.86`). Die Karten sind mit `--ck-card` (0,55) durchscheinend und
tragen sie weiter. Werte am laufenden Cockpit durchprobiert: 0,88/0,94 war fast unsichtbar,
0,74/0,86 zeigt Wolken und Grat und lässt jeden Text lesbar. Zurückdrehen = den Block löschen.

Am Handy greift der Schleier nicht — dort trägt der Hero das Foto schon, zwei wären zu viel.

## Verifikation

- Dev-Server 5173: beide Assets 200; `getComputedStyle('.ck-root')` zeigt bei 1440px vier
  Schichten, `cover`, `center 34%` — bei 426px korrekt keine.
- Desktop-Schleier im laufenden Cockpit per Screenshot abgenommen.
- Mobiler Hero mit den echten Token-Werten (390×470, `padding-top: 56px`, Scrim, beide
  `text-shadow`) nachgebaut und vorher/nachher verglichen.

**Verworfener Befund:** Eine erste Messung ergab für `.ck-hero-datum` 2,76:1 und damit einen
Verstoß gegen die 4,5:1 im Kopf der Datei. Die Messung war falsch — sie ließ den `text-shadow`
außer Acht, den Zug D8 genau für diese Zeile eingeführt hat (zweilagig, siehe Kommentar an
`.ck-hero-datum`). Kein offener Punkt.

## Offen

Nichts committet, nichts deployt — Livegang schaltet Kevin.
`horizont.jpg` (780×465) liegt noch da und wird von nichts mehr referenziert.
