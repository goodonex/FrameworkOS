# Wargame — Phase 2 „Haptisch geil": neue Oberfläche auf sauberer Technik

**Erstellt:** 2026-08-10 · **Planer:** Fable 5 · **Executor:** Opus 5 auf `xhigh` (blind ausführbar)
**Branch:** `cockpit-rebuild` · **Repo:** `~/Kevin OS/02 Projekte/uriel`

---

## Mission Brief

Das Technik-Fundament ist seit dem 09.08. live (siehe BACKLOG, Runde
Technik-Fundament). Phase 2 gibt Uriel die entschiedene neue Optik — **warme
Waldgrün-Welt im Cockpit, Navy×Gold im Kundenportal** — und baut die zwei
festgezurrten Funktions-Brocken: **Sales-Neubau nach Close-Vorbild (O14)** und
**LinkedIn als eigener Content-Kanal (O16)**.

Einstieg in dieser Reihenfolge: (1) `HANDOFF.md`, (2) `docs/BACKLOG.md`
Abschnitte O14 und O16, (3) **`docs/phase2/DESIGN-TOKENS.md`** — das ist die
eingefrorene Ästhetik-Wahrheit, (4) die Mock-Dateien `docs/phase2/style-varianten*.html`
im Browser ansehen (V5 in Runde 2 = Ziel-Look Cockpit-Home; V6 in Runde 3 =
Ziel-Look Portal), (5) diese Blaupause komplett.

**Alle Geschmacksfragen sind entschieden** (D1–D12 unten plus Tokens-Doc).
Der Executor entscheidet NICHTS Ästhetisches neu.

**Die Gesetze dieses Plans:**

1. **Zeilennummern/Dateinamen hier sind Wegweiser vom 10.08., nicht Wahrheit.**
   Vor jedem Edit frisch lesen; Recon-Marker (RECON) zuerst prüfen.
2. **Nach jedem Zug:** `cd app && npx tsc -b && npm run build` grün, danach
   alle `scripts/verify-*.ts` grün (Stand 10.08.: 24 Skripte). Ein Commit je
   Zug auf `cockpit-rebuild`. **NICHT auf `main` pushen** — Livegang ist Kevins
   Fast-Forward, je Etappe einer.
3. **Phase 2 ist eine reine Frontend-Phase.** KEINE Migrationen, KEIN
   Runner-Umbau, KEINE neuen Tabellen. Braucht ein Zug scheinbar doch eins
   davon → STOPP und melden.
4. **Kernlogik ist tabu:** `lib/prioritaet.ts`, `hooks/usePosten.ts`,
   `lib/arbeitsmodusTracking.ts`, `lib/linkedinFollowups.ts`,
   `lib/runnerBridge.ts`, alle Daten-Hooks. Phase 2 ändert, WIE Dinge
   aussehen, nie WAS sie bedeuten. Bricht ein Kern-verify → STOPP.
5. **Ein Breakpoint, 900:** `MOBILE_MAX_WIDTH` importieren, nie abtippen —
   `verify-breakpoint.ts` wacht. Mobil bei **390×664** verifizieren (svh-Falle).
6. **Token-Disziplin:** jede Farbe/Radius/Schatten kommt aus den Tokens
   (DESIGN-TOKENS.md). Ein Hexwert im Komponenten-Code ist ein Fehler —
   Ausnahme: die Token-Definitionen selbst.
7. **Scrim-Pflicht:** Text über Foto trägt immer Schutzverlauf/`text-shadow`
   (Kevins Lesbarkeits-Regel).
8. **Parität vor Abriss:** Alt-Code (SalesMode-Welt) fliegt erst, wenn die
   Parity-Checkliste des Zuges abgehakt ist. Bis dahin bleiben alte Routen
   erreichbar.

---

## Recon-Befunde (Stand 10.08. — Executor prüft die RECON-Zeilen frisch)

| Behauptung | Stand | Konsequenz |
|---|---|---|
| Tokens leben in `app/src/styles/cockpit.css` als `--ck-*`; Hell-Modus über `plain-light`-Klasse, Toggle ☀ in `StatusBar.tsx` | bekannt | Zug A1/A2 |
| Fonts via Google-Link in `app/index.html` (Syne, DM Sans, JetBrains Mono) | RECON: Link-Zeile prüfen | Zug A1 |
| Mobile-Home = `UrielHome.tsx` (Kachel-Grid, O18 v2, `ui_settings`-Reihenfolge); Desktop-Home = `CockpitHome.tsx` (Heute-Deck, Vitals, Graph) | bekannt | Zug A4 |
| Tagesansage-Logik existiert (`verify-tagesansage.ts` grün) — Begrüßung + Zusammenfassung nicht neu erfinden | bekannt | Zug A4 |
| Ring-Daten existieren: `li_anfragen` aus `useDailyMetrics`, Limit `ANFRAGEN_LIMIT_TAG = 30` aus `prioritaet.ts` | bekannt | Zug A4 |
| NavRail: mobil 5 Tabs + „Mehr"-Sheet, Icons Unicode + U+FE0E | bekannt | Zug A3 |
| Marken-Umschalter ist bereits entfernt (10.08.), `activeSlug` fest `herrmann` | erledigt | nicht bauen |
| Sales-Altwelt: `pages/sales/SalesMode.tsx` (~2.480 Zeilen nach 11f) + Glass-Komponenten; Sub-Tabs unter `/sales/*` | bekannt | Etappe B |
| Call-Mode: Sub-Tab in `SalesArea.tsx` (RECON: `:18/:58`), eigene Seite unter `pages/sales/` | RECON | Zug B5 (Insel) |
| Close-Vorbild-PDF: `~/Downloads/screencapture-saasui-design-application-close-crm-*.pdf` + Kevins Worte: Lead-Detail mit Aktivitäts-Timeline mittig, Aktionen/Stammdaten seitlich, Listen mit Inline-Filtern | bekannt | Zug B2/B3 |
| Bibliothek: `SalesBibliothek.tsx`, Daten vom Runner (`/sales/library` bzw. Spiegel `sales_library`) | bekannt | Zug B4 |
| Import: `SalesImportDrawer` (aus SalesMode heraus; RECON: Aufrufer) | RECON | Zug B6 |
| Content-Manifest kennt `channel: 'linkedin'` bereits (`ContentChannel` in `contentApi.ts:16`); UI rendert Kanal-Label | bekannt | Etappe C ohne Schema-Arbeit |
| „Als gepostet markieren" (`POST /content/posted`) existiert seit Technik-Fundament | bekannt | Zug C1 nutzt ihn |
| Portal: eigenes CSS `pages/portal/portal.css`, eigener Breakpoint 768 (bewusst), `--portal-accent` heute = Projekt-Brand-Farbe (RECON: wo gesetzt) | RECON | Zug C3 |
| Graph `OsNebula.tsx`: Canvas-Farben teils hart kodiert | RECON | Zug A6 |
| PWA: `manifest`/`theme_color` (RECON: `app/index.html` / `public/manifest*`) | RECON | Zug A7 |

---

## Entscheidungen (getroffen — nichts davon neu verhandeln)

**D1 — Zwei Welten, eine Geometrie.** Cockpit = V5 „Horizont", Portal =
Navy×Gold. Alle Werte: `docs/phase2/DESIGN-TOKENS.md`. Ornament kommt NICHT
in die App (V7 verworfen).

**D2 — Token-Swap statt Seiten-Einzelumbau.** Die neue Farbwelt kommt zuerst
global über die `--ck-*`-Tokens; damit drehen ALLE Flächen (auch Desktop) in
einem Zug auf die neue Palette. Danach werden Komponenten gezielt veredelt.
Nicht seitenweise Farben pflegen.

**D3 — Hell-Toggle raus.** Nur Dunkel in Phase 2. Der ☀-Knopf verschwindet,
die `plain-light`-Styles bleiben als tote Klasse liegen (kein Abriss, kein
Pflegeversprechen). Hell-Modus ggf. später neu auf Token-Basis.

**D4 — Das mobile Cockpit-Home wird der V5-Hero.** `UrielHome` bekommt:
Begrüßung (bestehende Tagesansage-Logik) → Tages-Ring (Anfragen `li_anfragen`
/ `ANFRAGEN_LIMIT_TAG`) → Uriel-Eingabe-Pille (öffnet bestehendes Dock) →
HEUTE (Kalender) → JETZT DRAN (Top-3 aus `usePosten`-Rangfolge) → Agent-Zeile
→ Dock. Foto-Ambiente nur hier. Die Kachel-Reihenfolge-Funktion (O18,
`ui_settings`) bleibt für den App-Bereich darunter erhalten oder wandert ins
„Mehr"-Sheet — RECON, kleinste ehrliche Lösung, nichts löschen was Daten hält.

**D5 — Sales wird NEU gebaut, nicht restyled (O14).** Neue Komponenten in der
Cockpit-Welt nach Close-Aufbau: Listen-Ansicht mit Inline-Filtern und Smart
Views, Lead-Detail mit Aktivitäts-Timeline mittig und Stammdaten/Aktionen
seitlich (mobil: Timeline zuerst, Stammdaten als Sektion darunter). Die
Glass-Ära (`SalesMode.tsx` + zugehörige Komponenten) fällt nach Parität.

**D6 — Call-Mode ist eine geparkte Insel.** Bleibt erreichbar, wird NICHT neu
gebaut und NICHT restyled. Er bekommt ein schmales Hinweis-Banner „Wird mit
dem Ads-Start auf den echten Funnel gestellt". Grund (Kevin, 10.08.): gebraucht
erst, wenn Ads laufen — aber dann sofort.

**D7 — Pipeline bleibt, als Close-artige Ansicht.** Kein Kanban-Zwang: Liste
mit Stage-Spalte/Filter reicht als v1, wenn das Board mehr als einen Zug
kosten würde — Kevins Kernwunsch ist der AUFBAU von Close (Übersichtlichkeit),
nicht das Brett.

**D8 — Bibliothek wird „Ressourcen", zweifach erreichbar.** Eigener Bereich
(bestehende Runner-Quelle) UND Kontext-Panel in der Lead-Maske (gleiche Quelle,
gefiltert; z. B. Quali-Skript direkt am Lead). Keine neue Datenhaltung.

**D9 — Listen-Import bleibt funktional erhalten**, bekommt nur die neue Hülle.
Selten gebraucht, aber vorhanden (Kevin: „wenn ich sie brauche, brauch ich sie").

**D10 — LinkedIn-Content (O16) = eigener Text-first-Bereich.** `/content`
bekommt Kanal-Tabs **LinkedIn | Instagram**. Instagram bleibt Slide-first wie
heute. LinkedIn: Posts aus dem bestehenden Manifest (`channel: 'linkedin'`),
Detail = Text-Editor mit Zeichenzähler (Marke bei 1.300 sichtbaren + 3.000 max),
Kopier-Griff nach Erstnachrichten-Muster (ein Klick → Text in Zwischenablage),
„Als gepostet markieren" über den bestehenden Endpoint. Bild-Posts zeigen einen
Ablage-Hinweis mit dem Ordnerpfad der Slides (Kevins Copy-Workflow). KEIN
neuer Agent in Phase 2 — Posts entstehen manuell/per Uriel; Agent ist Phase 3.

**D11 — Portal-Umbau ist Tokens + Geometrie, kein Funktionsumbau.**
`portal.css` auf Navy×Gold (DESIGN-TOKENS Welt 2), Radien/Karten angleichen,
optional Alpenglühen-Cover mit Scrim. Die Projekt-Akzentfarbe bleibt als
Detail-Akzent erhalten (RECON, wo sie herkommt). Abnahme-Flow (O11) unangetastet.

**D12 — Login sagt URIEL.** Die Anmelde-Karte trägt noch „BRAND OS" — Titel
auf URIEL, neue Tokens, sonst nichts.

---

## Züge

### Etappe A — Fundament der neuen Optik (global + Cockpit-Home)

**Zug A0 — Kassensturz.** `git checkout cockpit-rebuild`, muss `origin/main`
enthalten (Stand 10.08.: identisch). Build + alle verify-Skripte grün =
Basislinie. Mocks im Browser ansehen (Runde 2 V5, Runde 3 V6, Tokens-Doc).

**Zug A1 — Fonts.** Google-Link in `app/index.html` auf Inter +
Instrument Serif (+ `display=swap`); Font-Stacks in `cockpit.css` umstellen;
Mono nur noch via `font-variant-numeric: tabular-nums`.
**Erwartung:** App läuft komplett in Inter, nichts bricht.
**Fehler:** versteckte `font-family`-Härten in Komponenten. **Signal:** Reste
von Syne/Mono im gerenderten DOM. **Gegenzug:** projektweiter Grep auf
`Syne|DM Sans|JetBrains|font-family`, Härten auf Token umstellen.

**Zug A2 — Farb-Token-Swap (das Herzstück).** `--ck-*`-Werte in `cockpit.css`
auf Welt 1 (Tokens-Doc) umstellen; `--ck-bg-verlauf`/`--ck-ambient` ergänzen;
`--ck-gold` einführen; ☀-Toggle aus `StatusBar` entfernen (D3).
Danach ein Sichtlauf über ALLE Bereiche (mobil 390×664 + Desktop 1280):
Kontrast-Härten notieren und in diesem Zug fixen (nur Farben, keine Layouts).
**Fehler:** hart kodierte Hexwerte umgehen die Tokens. **Signal:** Flächen
bleiben schwarz/alt-grün. **Gegenzug:** Grep `#0-9a-fA-F]{6}` über
`app/src/cockpit` + `styles`, Treffer tokenisieren.

**Zug A3 — Dock & Icons.** NavRail mobil → schwebende Pille (Mock-Werte);
Icon-Satz als Inline-SVG (auch Desktop-Rail); aktive Zustände per
`--ck-accent` + Punkt. Routen/Logik unangetastet.
**Erwartung:** `verify-legacy-redirects` + `verify-breakpoint` grün; 5 Tabs +
„Mehr" funktionieren wie vorher.

**Zug A4 — Cockpit-Home = V5-Hero (D4).** `UrielHome` umbauen: Foto-Ambiente
(Asset nach `app/public/ambient/`, aus `docs/phase2`-Mock extrahieren oder
Original in `~/Downloads`/Scratch — RECON; notfalls neu von Unsplash-ID
`photo-1470071459604-3b5ec3a7fe05`, selbst gehostet), Begrüßung aus
Tagesansage, Ring, Ask-Pille → UrielDock, HEUTE, JETZT DRAN (Top-3
`usePosten`), Agent-Zeile. Kachel-Grid gemäß D4 einordnen.
**Fehler:** zweite Fälligkeits-/Zähl-Logik entsteht. **Signal:** Zahlen im
Hero ≠ Zahlen in den Bereichen. **Gegenzug:** ausschließlich bestehende Hooks
konsumieren; `verify-tagesansage`, `verify-prioritaet`,
`verify-kachel-reihenfolge` grün halten (Skripte ggf. ehrlich anpassen, wenn
sich NUR die Darstellungsform ändert — nie die Logik).

**Zug A5 — Arbeitsflächen-Feinschliff mobil.** HeuteTabs, LinkedIn,
Freigaben, Agenten, Tracking, Ads, Content: Karten/Labels/Knöpfe auf die neuen
Komponenten-Regeln heben (nur Hülle). Ruhige Farbfläche, kein Foto (Tokens-Doc).

**Zug A6 — Graph einfärben.** `OsNebula`-Canvas-Farben auf die neue Palette
(RECON: harte Farben). Kein Verhalten ändern.

**Zug A7 — PWA-Rahmen.** `theme_color`/Statusbar auf `#0c130e`; App-Icon:
✦ in `--ck-gold` auf `#0c130e` (einfaches SVG/PNG-Set) — schließt Kevins
Homescreen-Kreis (Wallpaper → Icon → App). Login-Karte: URIEL statt BRAND OS
(D12).

**Etappen-Abschluss A:** voller Lauf (Gesetz 2), Screenshots 390×664
(`/cockpit`, `/linkedin`, `/sales`, `/tracking`) + 1280 (`/cockpit`, `/sales`),
BACKLOG-Notiz. **Livegang-Kandidat — Kevin entscheidet.**

### Etappe B — Sales-Neubau nach Close (O14)

**Zug B0 — Struktur-Recon.** SalesArea-Subtabs, SalesMode-Verantwortungen,
Datenhooks (`useSalesPro`, `useContacts`, …) kartieren. Ergebnis als kurze
Tabelle in den Zug-Commit (welche Funktion → wohin im Neubau / bleibt / fällt).

**Zug B1 — Listen-Ansicht neu** (Close: Inline-Filter, Smart Views, dichte
Zeilen mit klarer Hierarchie). Bestehende Kontakt-Daten/Filters-Hooks nutzen.

**Zug B2 — Lead-Detail neu** (Close: Timeline mittig aus `activity_log` +
Nachrichten/Notizen; Stammdaten + Aktionen seitlich; mobil gestapelt).
Alle Schreibwege = bestehende Hooks.

**Zug B3 — Pipeline-Ansicht** (D7): Stage-Filter/Gruppierung auf der neuen
Liste; Kanban nur, wenn es in den Zug passt.

**Zug B4 — Ressourcen** (D8): Bereich umbenennen + Kontext-Panel im
Lead-Detail (gleiche Runner-Quelle, gefiltert).

**Zug B5 — Call-Mode-Insel** (D6): Banner drauf, sonst nicht anfassen.

**Zug B6 — Import** (D9): Drawer in neuer Hülle, Funktion identisch.

**Zug B7 — Abriss nach Parität.** Checkliste: jede in B0 kartierte Funktion
ist im Neubau erreichbar oder bewusst als „fällt" dokumentiert → dann
SalesMode + tote Glass-Komponenten löschen, Redirects prüfen
(`verify-legacy-redirects`). **Abbruch statt Abriss**, wenn Parität unklar.

**Etappen-Abschluss B:** wie A (voller Lauf, Screenshots, BACKLOG,
Livegang-Kandidat).

### Etappe C — LinkedIn-Content, Portal, Desktop-Feinschliff

**Zug C1 — Kanal-Tabs in `/content`** (D10): LinkedIn | Instagram.
LinkedIn-Liste (Text-Vorschau statt Slide-Thumb), Detail mit Editor +
Zeichenzähler + Kopier-Griff + „Als gepostet markieren"; Slides-Ordner-Hinweis
bei Bild-Posts. Instagram-Ansicht unverändert dahinter.

**Zug C2 — verify für die Kopier-/Zähl-Logik.** Kleines
`scripts/verify-linkedin-content.ts` (Zeichenzählung, Kanal-Filter,
Payload des posted-Aufrufs) — reine Funktionen.

**Zug C3 — Portal auf Navy×Gold** (D11): `portal.css`-Tokens, Geometrie,
optional Cover mit Scrim; Projekt-Akzent als Detail behalten; Abnahme-Flow
(O11) durchklicken (DEV-Preview reicht als Beleg wie am 09.08.).

**Zug C4 — Desktop-Feinschliff.** Nach dem Token-Swap gezielt: CockpitHome
(Desktop) auf die neuen Karten heben, Panels/Drawer (AdDetail, Run-Drawer,
UrielDock) veredeln. Keine neuen Features.

**Zug C5 — Abschluss:** voller Lauf, Screenshot-Satz mobil + Desktop über
alle Bereiche, BACKLOG auf echten Stand (O14 ✅, O16 ✅ mit Datei:Zeile,
Abweichungen ehrlich), offene Entscheidungsfragen sammeln (erwartet: keine —
was auftaucht, wird gesammelt, nicht geraten).

---

## Verifikation (je Etappe, vor Übergabe)

1. `npx tsc -b` + `npm run build` grün; alle verify-Skripte grün (nach C2: 25).
2. Kein Hexwert außerhalb der Token-Definitionen in geänderten Dateien (Grep).
3. Mobil 390×664: kein Querscrollen, Inhalt nicht hinter Nav/Dock (svh-Falle),
   Touch-Ziele ≥ 44px in neuen Komponenten.
4. Kontrast-Stichprobe: Fließtext ≥ 4.5:1 auf Karten, Text über Foto nur mit
   Scrim (visuell + `getComputedStyle`-Stichprobe).
5. Zahlen-Konsistenz: Hero-Ring == Tracking (`li_anfragen`), JETZT DRAN ==
   Arbeitsmodus-Reihenfolge (`usePosten`), keine Doppel-Logik.
6. Sales-Parität (Etappe B): Checkliste aus B0 vollständig abgehakt.
7. LinkedIn-Content (Etappe C): Kopier-Griff füllt Zwischenablage (Preview-
   Beleg), posted-Flow setzt `content.json` (Runner lokal), Instagram-Pfad
   unverändert.
8. Desktop 1280: `/cockpit` und `/sales` ohne Layout-Brüche (Screenshot).
9. Console ohne neue Fehler/Warnungen beim Load der Hauptbereiche.

## Abbruchbedingungen — stoppen und melden statt improvisieren

1. Ein Zug scheint eine Migration, neue Tabelle oder Runner-Code zu brauchen
   (Gesetz 3).
2. Ein Kern-verify bricht und der Fix läge in der Kernlogik (Gesetz 4).
3. Sales-Parität (B7) ist ohne Funktionsverlust nicht erreichbar.
4. Eine Ästhetik-Frage ist durch Tokens-Doc + Mocks nicht gedeckt → notieren,
   mit Vorschlag sammeln, weiterbauen wo möglich — nicht raten, nicht blocken.
5. Alles, was Geld, Secrets, Löschen von Kundendaten oder Livegang berührt →
   Kevin. Livegang bleibt Fast-Forward auf Kevins Wort, je Etappe.

## Nicht im Scope (bewusst)

Hell-Modus · Animations-/Motion-System (eigene Runde nach dem Aufbau) ·
Ornament in der App · neuer Content-Agent für LinkedIn (Phase 3) · Call-Mode-
Neubau (mit Ads-Start) · echte iOS-App/Widgets · Meta-Ads-API · alles aus
BACKLOG „Zurückgestellt".
