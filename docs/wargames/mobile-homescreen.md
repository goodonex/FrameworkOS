# Wargame — Mobile Homescreen: Uriel am Handy wie ein OS

**Erstellt:** 2026-08-08 · **Planer:** Fable 5 · **Executor:** Opus 5 (blind ausführbar)
**Branch:** `cockpit-rebuild` · **Repo:** `~/Kevin OS/02 Projekte/uriel`

---

## Mission Brief

Kevins Idee (08.08.): Uriel mobil so aufbauen wie iOS/Android — „App-Icons, in
die ich reinklicke, Widgets, und wenn man wischt, die Bibliothek mit allem, was
man machen kann. Zum Beispiel eine LinkedIn-App in Uriel." Die gemeinsam
geschärfte Ausprägung: **Widgets zuerst, Icons darunter — der Homescreen ist
Arbeitsfläche, nicht Menü.** Ein reines Icon-Grid als Einstieg wäre ein
Rückschritt (Weg-Klicks), die Metapher gewinnt nur, wenn die Arbeit oben liegt.

**Die vier Gesetze dieses Plans:**

1. **Widget = Arbeit, Icon = Absprung.** Der erste Bildschirm trägt die
   Tagesansage und den Loslegen-Knopf, nicht eine Icon-Wand.
2. **Klick-Ökonomie bleibt die Messlatte:** Uriel öffnen → Loslegen → erster
   Posten steht. ≤ 2 Interaktionen, gemessen, nicht behauptet.
3. **Die Metapher ist ein Handy-Konzept.** Desktop (`> 900px`) bleibt exakt, wie
   er ist — Kacheln, Rail, Graph. Kein geteilter Zustand, der ihn mitverändert.
4. **Keine neuen Datenquellen.** Alle Widgets und Badges speisen sich aus Hooks,
   die die Home heute schon lädt. Ein Homescreen, der erst nachladen muss, ist
   keiner.

**Nicht im Scope (v1):** echte iOS-Homescreen-Widgets (brauchen native App —
bewusst verworfen, PWA + Push decken den Fall, Backlog §5) · Jiggle-Mode /
personalisierbare Anordnung · Seiten-Pager mit Edge-Swipes · Kontext-Logik nach
Uhrzeit · Sprache am Handy (O12: „Sprache ist Desktop") · Agenten als eigene
App-Icons (v2, siehe Ausbau).

---

## Recon-Befunde (verifiziert 08.08.2026 am Live-Code — nicht raten)

| Frage | Befund | Konsequenz |
|---|---|---|
| Mobile Home heute | `CockpitHome.tsx` hat **keine** isMobile-Verzweigung — das Handy bekommt den Desktop-Stapel untereinander (HeuteDeck `:312` → GoalCard/QuickTrack/Vitals `:319-331` → OsNebula `:339`) | Genau das ersetzt der Homescreen. |
| Bereichs-Registry | `cockpit/lib/bereiche.ts` — die EINE Liste (11 Bereiche + `nurRoute`), Palette + Background ziehen daraus; **kein Icon-Feld** | Zug 1 ergänzt Icons dort, nirgendwo sonst. |
| Navigation mobil | `NavRail.tsx`: ARBEIT (4) als Bottom-Bar + „Mehr"-Sheet mit NACHSCHLAGEN (4) und `Benachrichtigungen kompakt` (`:185-190`); `badgeFuer` kennt nur `/content` (`:206`) | Bar bleibt (D3); Sheet wird zur Bibliothek (Zug 5). |
| LinkedIn-Bereich | `/linkedin` existiert als volle Area (`App.tsx:225`), steht aber in **keiner** Nav-Liste — nur Palette/Umwege | Bekommt ein App-Icon (D6, Kevins Wunsch). |
| Morgen-Bausteine | `MorgenArea.tsx`: Gruß, `tagesansage`, `entwuerfeOffen`, Termine via `termineEvents`, `agentenBefund`-Warnzeile, Loslegen → `/sales?kachel=jetzt-dran&modus=arbeit` | Alle Widget-Zutaten existieren — zerlegen, nicht neu bauen. |
| Palette | `CommandPalette` global in `App.tsx:140` hinter `CommandPaletteContext` — programmatisch öffenbar | Zug 6 braucht nur einen Knopf, keine neue Palette. |
| Mobil-Grenze | `MOBILE_MAX_WIDTH = 900` in `hooks/useViewport.ts`, Drift-Wache `scripts/verify-breakpoint.ts` (8 Prüfungen) | Importieren, nie abtippen. |
| Icon-Falle iOS | ☑/⚙ rendern ohne U+FE0E als Emoji (O13, behoben in NavRail) | Jedes neue Icon: Geometric Shapes, sonst VS-15. |
| Bekannte Fallen | `#app-ui-overlay` → `pointerEvents: 'auto'` nötig; svh bei **390×664** prüfen (HANDOFF „Fallen" 1/2) | In jedem UI-Zug als Beobachtung. |
| CSS-Rest | `.ck-heute-grid` ist definiert, wird von niemandem benutzt — „bleibt stehen für den Mobile-Umbau" (Backlog O13) | Darf der Homescreen nutzen oder ersetzen; kein Neuanfang nötig. |

---

## Entscheidungen (getroffen, mit verworfenen Alternativen)

**D1 — Der Homescreen ist der mobile Inhalt von `/cockpit`.** Kein neuer Pfad.
*Verworfen:* eigene Route `/home` (zweite Heimat für dieselben Zahlen,
Redirect-Gestrüpp, `/` zeigt schon auf `/cockpit`).

**D2 — Widgets zuerst, Icons darunter.** Reihenfolge: Befund-Warnzeile (nur bei
Meldung) → Heute-Widget (groß, mit Loslegen) → Termine-Widget → Vitals-Widget →
Icon-Grid. *Verworfen:* Icon-Grid als Einstieg (Weg-Klicks — bricht Gesetz 2).

**D3 — Die Bottom-Bar bleibt und IST das Dock.** Kein Springboard-Umbau, keine
Wisch-Seiten. Das „Mehr"-Sheet wird zur **Bibliothek** (alle Bereiche im Grid).
*Verworfen:* Edge-Swipe-Pager wie am echten iPhone — kollidiert im Standalone-
Modus mit der iOS-Back-Geste und vertikalem Scroll, und gewinnt keine einzige
Interaktion; die Bar hat sich seit dem 9→5-Umbau bewährt.

**D4 — `/morgen` bleibt die Push-Landung.** Der Push führt in die fokussierte
Morgen-Seite (Arbeit), nicht auf einen Homescreen (Menü). Beide teilen sich die
Bausteine aus Zug 2 — dieselben Zahlen, eine Quelle. *Verworfen:* `/morgen` in
den Homescreen auflösen.

**D5 — Badges nur aus schon geladenen Quellen:** `/content` = socialUnread
(existiert), `/freigaben` = `entwuerfeOffen(geordnet)` (Hook lädt fürs
Heute-Widget ohnehin). **Kein neuer Fetch pro Icon** — ein Badge, das eine
eigene Abfrage kostet, fliegt raus. *Verworfen:* Kundenpost-/Termine-Badges in
v1 (bräuchten neue Ladepfade auf der Home).

**D6 — LinkedIn bekommt ein App-Icon** im Grid und in der Bibliothek. Der
Bereich existiert, ist mobil heute aber praktisch unerreichbar.

**D7 — Erinnerungen-Grammatik: Optik ÜBER der Posten-Engine, nie statt ihr**
(Kevin, 08.08.). Die mobilen Listen übernehmen die Zeilen-Grammatik der
iOS-Erinnerungen-App: Kreis-Haken links, ruhige Zeile, Meta klein, Zähler am
Abschnitts-Kopf. Das Datenmodell bleibt unangetastet — Leads werden KEINE
To-dos: Stufen, Fristen ab letzter Nachricht, Entwürfe am Posten und die EINE
Aktion je Zeile (Kopier-Gesetz!) sind Uriels Vorsprung gegenüber jeder
Erinnerungen-App. *Verworfen:* ein eigenes Erinnerungen-artiges Listen-Modul
(wäre die dritte Aufgaben-Wahrheit — exakt die Doppelwelt, die O2 zugenäht
hat) · Wisch-Gesten in v1 (Scroll-Konflikt-Risiko, der Haken ist schon ein
Tipp — Ausbau f).

---

## Züge

### Zug 0 — Notch-Fix: Kopfzeile unter der Aussparung (Sofort-Fix, eigener Commit)

**Befund (08.08., verifiziert):** `app/index.html:5` setzt
`viewport-fit=cover`, `:27` `black-translucent` — die installierte App zeichnet
bis unter die Notch. `safe-area-inset-bottom/left/right` sind versorgt
(`cockpit.css:604-668`: Bottom-Bar, FABs, Sheets), **`-top` fehlt an der Shell
komplett** — nur die zwei Vollbild-Overlays (AnfragenZaehler `:91`,
Arbeitsmodus `:99`) haben es. Deshalb liegt die Kopfzeile (StatusBar, „URIEL")
unter Uhr/Notch und ist unlesbar.

**Aktion:** `padding-top: env(safe-area-inset-top)` an der OBERSTEN
Shell-Container-Ebene im Mobil-Block von `cockpit.css` (ein Ort, alle Bereiche
erben — nicht Seite für Seite flicken). Vorher per Read klären, ob StatusBar
oder `.ck-main` der oberste gerenderte Rand ist.

**Erwartete Beobachtung:** Standalone auf dem iPhone: Uhr/Notch liegen auf
dunklem Hintergrund, darunter beginnt lesbar die Kopfzeile. Desktop und
Safari-Tab: `env()` = 0 → pixelgleich wie vorher.

**Wahrscheinlichster Fehler:** Doppeltes Padding in den Vollbild-Overlays
(die haben ihr eigenes safe-area-top). **Signal:** zu viel Luft oben im
Arbeitsmodus/Zähler. **Gegenzug:** keiner nötig, wenn der Fix an der Shell
sitzt — die Overlays liegen mit `position: fixed` außerhalb des Shell-Flusses;
genau das am 390er einmal gegenprüfen, nicht annehmen.

**Hinweis:** Der echte Notch-Beweis geht nur am Gerät — Desktop-DevTools
liefern für `env()` null. Kevins iPhone-Screenshot ist die Abnahme. Dieser Zug
ist unabhängig vom Rest und darf als erster Commit sofort in den nächsten
Livegang.

### Zug 1 — Icons in die Bereichs-Registry

**Aktion:** `bereiche.ts`: Feld `icon: string` je Bereich (Geometric Shapes;
wo ein Zeichen Emoji-Default hat, `︎` anhängen — Lehre O13). `NavRail.tsx`
bezieht seine Icons aus der Registry statt aus den eigenen Literalen (ARBEIT/
NACHSCHLAGEN bleiben als *Auswahl+Reihenfolge*, nur das Icon kommt zentral).
`/linkedin` bekommt ein Icon (z. B. `▣`), `nurRoute`-Einträge keins.

**Erwartete Beobachtung:** Bottom-Bar und Rail sehen pixelgleich aus wie vorher
(gleiche Zeichen); `verify-breakpoint.ts` und `tsc` grün.

**Wahrscheinlichster Fehler:** Ein neues Icon rendert auf iOS als buntes Emoji.
**Signal:** Screenshot iOS/Safari zeigt Farbe in der Leiste. **Gegenzug:** VS-15
anhängen oder Zeichen aus Geometric Shapes wählen — nie per CSS „reparieren".

### Zug 2 — Widget-Bausteine aus den Morgen-Zutaten

**Aktion:** Neue Komponenten unter `cockpit/components/home/`:
`HeuteWidget` (Tagesansage-Zeile, Zahlen Posten offen / Entwürfe fertig, großer
Loslegen-Knopf → `/sales?kachel=jetzt-dran&modus=arbeit`, disabled bei 0 wie in
MorgenArea), `TermineWidget` (heutige Termine, Tipp → `/termine`),
`VitalsWidget` (die Wochen-Vitals aus `weekVitals`, Tipp → `/tracking`),
`BefundZeile` (aus `agentenBefund`, nur bei Meldung, Tipp → `/agenten` —
Optik/Verhalten aus `MorgenArea.tsx:132-153` übernehmen). `MorgenArea` stellt
auf dieselben Bausteine um, wo es wörtlich dieselbe Anzeige ist — **keine
Formatier-Abstraktion erzwingen**, wo die Seiten sich unterscheiden.

**Erwartete Beobachtung:** `/morgen` sieht am 390×664 unverändert aus
(Screenshot-Vergleich vorher/nachher); die Widgets rendern einzeln in einer
Probe-Einbindung.

**Wahrscheinlichster Fehler:** Beim Zerlegen wandert Hook-Aufruf-Logik in die
Widgets und jedes Widget öffnet eigene Subscriptions. **Signal:** mehrfache
identische Requests im Netzwerk-Tab. **Gegenzug:** Widgets bekommen Daten als
Props; die Hooks ruft genau EIN Eltern-Container (UrielHome bzw. MorgenArea) —
dasselbe Muster wie `arbeitsmodusTracking` (Deps injizieren, keine zweiten
Subscriptions).

### Zug 3 — UrielHome: der mobile Zweig von `/cockpit`

**Aktion:** `cockpit/pages/UrielHome.tsx`; in `CockpitHome` als früher Zweig:
`if (isMobile) return <UrielHome …/>` (Grenze via `useIsMobile`, nicht
abgetippt). Aufbau: Kopf (Gruß + Datum + Such-Knopf ⌕) → BefundZeile →
HeuteWidget → TermineWidget → VitalsWidget → Icon-Grid (Zug 4).
`pointerEvents: 'auto'`, Padding unten wie MorgenArea (Uriel-Blase + Bar).
**Mobil entfallen:** GoalCard, QuickTrack, OsNebula, CommandDeck — der Graph
war am Handy ein geclampter Notbehelf; Tracking-Eingabe lebt in `/tracking`
und im Zähler.

**Erwartete Beobachtung:** 390×664: ein Screen ohne Quer-Scroll, „Loslegen"
voll tippbar; Desktop 1280: `CockpitHome` byte-identisch im Verhalten
(Screenshot-Diff). Uriel öffnen → Loslegen → Posten 1 = **2 Interaktionen**.

**Wahrscheinlichster Fehler:** Ladeflackern — `geordnet` ist beim ersten Frame
leer, das Heute-Widget zeigt kurz „Nichts offen". **Signal:** Aufblitzen beim
Öffnen. **Gegenzug:** Ladezustand der Quellen-Hooks respektieren (Skeleton-
Zeile statt „Nichts offen", solange `loading`); dasselbe Muster wie Zug 7 des
Morgen-Wargames (Param verwerfen statt leer öffnen).

**Trigger:** Meldet das Uriel-Dock-Werkzeug `set_graph_view` am Handy einen
Sprung auf den Graphen (den es mobil nicht mehr gibt) → Werkzeug antwortet mit
einem Satz („Graph gibt es am Rechner"), navigiert NICHT ins Leere. Nur wenn
der Fall real auftritt — nicht vorsorglich umbauen.

### Zug 4 — Icon-Grid mit Badges

**Aktion:** Grid unter den Widgets: alle Bereiche aus `PALETTEN_BEREICHE` außer
`/cockpit` (man ist schon da), Reihenfolge = Registry-Reihenfolge
(Warteschlange vorn). Kachel: Icon + Label, Touch-Ziel ≥ 48 px, 4 Spalten bei
390 px. Badges nach D5: `/content` socialUnread, `/freigaben`
`entwuerfeOffen(geordnet)` — Badge-Optik aus `NavRail.tsx:71-95`
wiederverwenden (Komponente exportieren statt kopieren).

**Erwartete Beobachtung:** 10 Kacheln, LinkedIn dabei; Badge-Zahlen stimmen mit
`/freigaben`- und Content-Stand überein; kein zusätzlicher Request gegenüber
Zug 3 (Netzwerk-Tab).

**Wahrscheinlichster Fehler:** Doppelte Badge-Wahrheit — NavRail rechnet
socialUnread selbst, das Grid noch einmal, beide subscriben getrennt.
**Signal:** zwei `social_batches`-Reads. **Gegenzug:** `useSocialUnread` wird
einmal in UrielHome gerufen und an Grid UND (falls nötig) Bar durchgereicht —
oder bewusst zwei Aufrufe desselben gecachten Hooks, wenn er intern dedupliziert
(prüfen, dann entscheiden und im Commit begründen).

### Zug 5 — Mehr-Sheet wird Bibliothek

**Aktion:** `MehrSheet` in NavRail: statt der 4-Zeilen-Liste dasselbe
Kachel-Grid wie Zug 4, aber **vollständig** (alle Bereiche inkl. ARBEIT — die
Bibliothek ist der Ort für „alles, was man machen kann"). Titel „Bibliothek".
Der `Benachrichtigungen kompakt`-Block bleibt unten (Begründung steht im Code,
`NavRail.tsx:185-187` — nicht entfernen).

**Erwartete Beobachtung:** Tipp auf „Mehr" → Grid mit 10-11 Kacheln + Schalter;
ein Tipp navigiert und schließt; Escape schließt (bestehender Handler).

**Wahrscheinlichster Fehler:** Das Sheet wird höher als der Viewport (Grid +
Schalter) und der untere Teil liegt unter der Home-Indicator-Zone. **Signal:**
Benachrichtigungs-Schalter am 390×664 nicht tippbar. **Gegenzug:**
`max-height` + inneres Scrollen fürs Grid, safe-area-inset unten (Muster
AnfragenZaehler).

### Zug 6 — Suche am Handy

**Aktion:** Der ⌕-Knopf im UrielHome-Kopf öffnet die bestehende CommandPalette
über `CommandPaletteContext`. Eingabefeld: `font-size ≥ 16px` (iOS-Auto-Zoom).

**Erwartete Beobachtung:** Tipp → Palette mit Fokus im Feld, Bereichs-Sprünge
funktionieren, kein Seiten-Zoom beim Fokussieren.

**Wahrscheinlichster Fehler:** Die Palette war nur für Desktop gestylt und
liegt mobil hinter/unter der Bottom-Bar oder dem Overlay. **Signal:** Palette
öffnet, ist aber abgeschnitten/nicht tippbar. **Gegenzug:** z-Index über die
Bar (Muster MehrSheet-Backdrop), `pointerEvents: 'auto'`; NICHT die
Desktop-Optik anfassen.

### Zug 7 — Listen-Grammatik nach Erinnerungen-Vorbild (D7)

**Aktion:** Gemeinsamer Zeilen-Baustein `cockpit/components/home/ListenZeile.tsx`:
Kreis-Haken links (Tipp = exakt der bestehende Erledigt-Pfad), Titel,
Meta-Zeile klein, rechts die EINE Aktion des Postens; Abschnitts-Kopf mit
Zähler. Mobil angewendet auf die **Arbeitsliste** (im Kachel-Fenster) und die
**AufgabenArea-Buckets**. Der Kreis ruft die vorhandenen Pfade
(`onErledigt`/`erledigePosten`, `taskErledigt`) — **null neue Logik, null neue
Felder**. Desktop-Arbeitsliste bleibt unverändert (Gesetz 3): geteilte
Komponente nur mit Breakpoint-Weiche, sonst getrennt lassen.

**Erwartete Beobachtung:** Mobil lesen sich Arbeitsliste und Aufgaben wie
Erinnerungen-Listen; der Haken zählt weiter genau ein Metrik-Feld
(`scripts/verify-arbeitsmodus-tracking.ts` grün); Kopieren/Skript/LinkedIn
kleben weiter an der Zeile.

**Wahrscheinlichster Fehler:** Die Vereinheitlichung schleift im Namen des
„cleanen Looks" Aktions-Knöpfe ab — Bruch des Kopier-Gesetzes. **Signal:** eine
Zeile ohne ihre Aktion. **Gegenzug:** Abnahme-Tabelle je Spur im Commit-Text
(erstnachricht = Kopieren + Profil · followup/antwort = Entwurf kopieren ·
loom = Skript + Loom aufnehmen + Haken · kundenaufgabe = Haken) — jede Zelle
abgehakt, bevor der Zug als fertig gilt.

---

## Verifikation (Executor, vor der Übergabe)

1. `npx tsc -b` + `npm run build` grün; `scripts/verify-breakpoint.ts` grün.
2. Screenshots 390×664: Homescreen, Bibliothek offen, Palette offen, `/morgen`
   (unverändert). Screenshot 1280: `/cockpit` unverändert (Vergleich vorher).
3. Klick-Messung dokumentiert: Öffnen → Loslegen → Arbeitsmodus Posten 1 =
   2 Interaktionen.
4. Netzwerk-Probe: UrielHome löst KEINE Requests aus, die CockpitHome vorher
   nicht auslöste (Graph-/OsMap-Reads dürfen mobil wegfallen).
5. Badge-Gegenprobe: Zahl am `/freigaben`-Icon == Karten in `/freigaben`.
6. Kein Screenshot-Diff am Desktop = das wichtigste Einzelkriterium (Gesetz 3).
7. Zug 0: Kopfzeile unter der Notch lesbar — **Abnahme ist Kevins
   iPhone-Screenshot** (Desktop-DevTools können `env()` nicht zeigen);
   Gegenprobe: Arbeitsmodus/Zähler haben oben NICHT doppelt Luft.
8. Zug 7: `verify-arbeitsmodus-tracking.ts` grün + Aktions-Tabelle je Spur im
   Commit abgehakt (keine Zeile ohne ihre Aktion).

---

## Abbruchbedingungen — stoppen und melden statt improvisieren

1. Das Ladeflacker-Problem (Zug 3) ist nur mit neuen Fetch-Pfaden oder einem
   eigenen Cache lösbar → stopp, Befund melden (Gesetz 4 wäre verletzt).
2. Der Desktop lässt sich nicht unangetastet halten (geteilte Komponente zwingt
   zu Verhaltensänderung > kosmetisch) → stopp.
3. Jede Frage, deren Antwort Geld, Löschen oder Live-Schaltung ist → Kevin.
   Livegang bleibt Fast-Forward auf Kevins Wort.

---

## Ausbau (v2 — bewusst NICHT in v1, damit v1 klein bleibt)

Reihenfolge nach erwartetem Nutzen, jeweils erst bauen, wenn v1 im Alltag lief:
**(a)** Long-Press Quick Actions auf Icons (Sales halten → Arbeitsmodus/Zähler),
**(b)** Agenten als App-Icons mit Lauf-/Fertig-Badge (Daten: `runs`-Spiegel),
**(c)** Widget-Stack (Heute ↔ Termine ↔ Vitals durchwischen statt stapeln),
**(d)** Personalisierung/Jiggle (Layout in Supabase, Revolut-Lektion),
**(e)** Kontext-Reihenfolge nach Tageszeit,
**(f)** Wisch-Gesten auf den Erinnerungen-Zeilen (rechts = Haken, links =
„→ morgen") — erst wenn die Grammatik aus Zug 7 im Alltag lief und der
Scroll-Konflikt sauber gelöst ist. Echte iOS-Homescreen-Widgets nur, falls je
ein nativer Wrapper kommt (heute verworfen, Backlog §5).

---

## Red-Team-Protokoll

- **„Das Icon-Grid macht den Morgen langsamer"** — der Angriff, der beim ersten
  Entwurf DURCHKAM (Icon-Grid stand über den Widgets, Loslegen erst nach
  Scroll). Patch: D2-Reihenfolge fest, Klick-Messung als Pflicht-Verifikation 3.
- **„Zweite Bereichs-Wahrheit"** (NavRail-Literale vs. Registry) — abgewehrt
  durch Zug 1 (Icons zentral, Nav behält nur Auswahl/Reihenfolge).
- **„Homescreen lädt neu → fühlt sich wie eine Webseite an"** — abgewehrt durch
  Gesetz 4 + Verifikation 4 (keine neuen Requests).
- **„Edge-Swipes wie echtes iOS"** — verworfen in D3 (iOS-Back-Geste im
  Standalone, Scroll-Konflikte, null Interaktions-Gewinn).
- **„Desktop erbt mobile Abstriche"** — abgewehrt durch frühen isMobile-Zweig
  (Zug 3) + Screenshot-Diff als Kriterium 6.
- **„Die Erinnerungen-Optik wird schleichend zum Erinnerungen-Datenmodell"**
  (Leads als abhakbare To-dos, Aktionen wegrasiert) — abgewehrt durch D7 +
  Zug-7-Abnahme-Tabelle: jede Zeile behält ihre EINE Aktion, der Haken ruft nur
  bestehende Pfade, kein neues Listen-Modul.
