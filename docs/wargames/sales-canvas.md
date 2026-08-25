# Wargame — Sales-Canvas (Uriel)

**Executor:** Sonnet, blind ausführbar · **Repo:** `~/Kevin OS/02 Projekte/uriel`
**Branch:** `main` (Working Tree sauber, `cockpit-rebuild` liegt zurück — nicht wechseln)
**Ziel-Ablage nach Fertigstellung:** `docs/wargames/sales-canvas.md` + Eintrag in `docs/BACKLOG.md`

---

## Context — warum das gebaut wird

Kevins `/sales` ist heute eine senkrechte Kette aus sechs Flow-Zeilen. Sie
funktioniert, frisst aber die ganze Seitenhöhe für sechs Zahlen, und sie zeigt
nur das Tagespensum — nicht, wie viele Leute insgesamt in welcher Phase stecken.
Kevins Bild dafür existiert bereits als `Vertriebsprozess.canvas` im Obsidian-Vault:
Funnel von oben nach unten, Nachrichtentexte direkt in den Knoten, Kennzahlen daneben.

Er will genau das als lebendige Oberfläche: oben die Gesamtzahl (aufklappbar,
die Balken verschwinden), darunter der Funnel als Karten, je Karte „wie viele
stecken hier" plus „wie viele heute", Klick öffnet die Namensliste, Abhaken
lässt den Lead in die nächste Stufe rutschen. **Der Nachrichtentext steht einmal
in der Karte, nicht pro Lead** — das geht erst, seit die Follow-up-Texte fest
sind (Commit `c5a1d80`, 25.08.).

Am Ende soll Kevin das Canvas einmal täglich von oben nach unten abarbeiten,
mit Uriel links und LinkedIn rechts nebeneinander.

---

## Recon — was bereits existiert (nicht neu bauen)

Diese Recon ist am 25.08.2026 an Code und Prod-Daten gemacht worden. **Zeilennummern
sind Wegweiser, keine Wahrheit — vor jedem Edit die Datei frisch lesen.**

| Vorhanden | Datei | Kann bereits |
|---|---|---|
| **Stationen des Funnels** | `app/src/cockpit/lib/leadStation.ts` | `STATION_REIHENFOLGE`, `STATION_TITEL`, `leadStation()` → Station + fällig + Zweig. Enthält alle Kanäle inkl. Instagram, PDF, Postkarte, Anruf |
| **Pipeline-Ansicht** | `app/src/cockpit/components/linkedin/LeadPipeline.tsx` | Karten je Station, Kopfzahl, „n dran"-Badge, aufklappbare Namensliste, „nur was heute dran ist", CSV-Export, ICP-Filter |
| **Namensliste mit Kevins Handgriff** | `app/src/cockpit/components/Arbeitsliste.tsx` | **Klick auf Namen kopiert den Namen** (`nameGriff`), klappt Text auf, Kopieren-Knopf, Haken, LinkedIn-Profil-Link, mobil/Desktop |
| **Zwischenablage mit Fallback** | `app/src/cockpit/lib/zwischenablage.ts` | `inZwischenablage()` inkl. `execCommand`-Rückfallebene für Safari |
| **Tagespensum** | `app/src/cockpit/lib/tagesFlow.ts` | `stufenStaende()` → `{wert, soll, offenJetzt, erledigt}` je Stufe; `FOLLOWUP_PORTION_TAG = 20` |
| **Feste Follow-up-Texte** | `app/src/cockpit/lib/followupVorlagen.ts` | `FOLLOWUP_VORLAGEN[0..2]`, `followupVorlage(thread)`, `vornameAus()` |
| **Posten-Quellen** | `app/src/cockpit/lib/arbeitsmodusQuellen.ts` | `followupPosten`, `antwortPosten`, `loomPosten`, `erstnachrichtPosten` |
| **Heutiges Layout** | `app/src/cockpit/pages/SalesDashboard.tsx` (1086 Z.) | `FlowZeile` (die Balken), `KachelFenster`, `KachelCard` |
| **Jophiel-Server** | `~/Kevin OS/02 Projekte/jophiel/server/index.mjs` | `/api/projects` (mit `leadName` als Klammer zu Uriel!), `/api/shot/:slug/:name` (PNG), `/preview/:slug`, `/api/uriel/looms` |
| **Runner-Brücke** | `app/src/cockpit/lib/runnerBridge.ts` | lokal Runner, sonst Supabase-Spiegel |

**Das Canvas ist damit überwiegend ein Layout-Umbau mit Wiederverwendung, kein Neubau.**

---

## Gesetze dieser Runde (verletzen = Abbruch)

1. **Keine zweite Zähl-Wahrheit.** `stufenStaende` und `daily_metrics` bleiben die
   einzige Quelle für „heute erledigt". Das Canvas liest, es rechnet nicht nach.
2. **Keine neuen `daily_metrics`-Felder.** Steht im HANDOFF. Die drei
   Follow-up-Karten zählen alle auf das eine Feld `li_followups`.
3. **Ersetzen, nicht danebenstellen.** Am Ende gibt es genau eine Sales-Ansicht.
   Ein Canvas neben dem alten Dashboard wäre ein dritter Ort für dieselbe Zahl.
4. **`Arbeitsliste.tsx` wird wiederverwendet, nicht nachgebaut.** Kevins Handgriff
   (Klick = Name kopiert) lebt dort und nirgends sonst.
5. **Eine Mobil-Grenze: 900** (`MOBILE_MAX_WIDTH` in `hooks/useViewport.ts`).
   Importieren, nie abtippen — `verify-breakpoint.ts` schlägt sonst an.
6. **Nach jedem Zug:** `cd app && npx tsc -b && npm run build` grün, danach **alle**
   `scripts/verify-*.ts` grün (Stand: 53). Ein Commit je Zug, deutsche Message.
   **Nicht pushen** — Livegang ist Kevins Wort.
7. **Jede Datei vor dem Edit frisch lesen.** Uncommittete Arbeit war in diesem Repo
   lange der Normalfall.

---

## Die Züge

### Z0 — RECON (nur lesen)

Frisch lesen: `SalesDashboard.tsx` (Aufbau von `SalesDashboard()` ab ~Z. 370, Render ab ~Z. 1033),
`LeadPipeline.tsx`, `Arbeitsliste.tsx`, `useTagesFlow.ts`, `leadStation.ts`.
Prüfen: Welche Props braucht `Arbeitsliste`, und woher kommen sie heute in `SalesDashboard`?

**Erwartete Beobachtung:** `Arbeitsliste` bekommt `posten: Posten[]` + `onErledigt` +
optional `loom`/`morgen`/`projektLink`. `SalesDashboard` hält alle diese Quellen bereits.
**Wenn stattdessen:** `Arbeitsliste` hängt an Zustand aus `SalesDashboard`, der sich nicht
lösen lässt → Route B: Canvas als neue Sektion **innerhalb** von `SalesDashboard.tsx`
rendern statt als eigene Seite. Kein Grund zum Stoppen.

---

### Z1 — `funnelKarten.ts`: die Rechenschicht

Neue reine Funktion `app/src/cockpit/lib/funnelKarten.ts`. Sie verheiratet die zwei
vorhandenen Ebenen zu einer Kartenliste:

- **Bestand je Station** aus `leadStation()` über alle Leads (wie `LeadPipeline` es tut).
- **Tagespensum** aus `stufenStaende()`, wo eine Flow-Stufe zur Station gehört.

```ts
export interface FunnelKarte {
  id: string                    // 'anfragen' | 'erstnachricht' | 'followup_0' | … | 'loom'
  titel: string
  bestand: number               // wie viele stecken hier insgesamt
  heuteFaellig: number          // wie viele sind heute dran
  soll: number | null           // Tages-Soll, null wenn die Karte keine Flow-Stufe hat
  erledigtHeute: number | null
  stufenId: StufenId | null     // Klammer zur EINEN Zähl-Wahrheit
  vorlage: string | null        // fertiger Textbaustein, [Vorname] noch drin
  zweig: 'still' | 'laut' | null
}
export function funnelKarten(eingabe: …): FunnelKarte[]
```

**Die drei Follow-up-Karten** entstehen hier: Threads im Bucket `faellig` werden nach
`followup_stage` (0/1/2) auf drei Karten verteilt, `vorlage` kommt aus
`FOLLOWUP_VORLAGEN[stage]`. Alle drei tragen `stufenId: 'followups'` — **eine Zähl-Wahrheit,
drei Anzeigen.**

**Erwartete Beobachtung:** `funnelKarten(...)` liefert bei Kevins Prod-Daten ~12 Karten;
die Summe der drei Follow-up-Bestände entspricht exakt `followupPosten(...).length`.
**Wahrscheinlichster Fehler:** Doppelzählung — ein Lead erscheint in „Erstnachricht fällig"
UND in „Follow-up 1", weil Station und Bucket verschiedene Fragen beantworten.
*Signal:* Summe aller Bestände > Zahl der Leads in der Zielgruppe.
**Gegenzug:** Jeder Lead gehört zu **genau einer** Karte. `leadStation()` liefert genau eine
Station — die entscheidet; die Follow-up-Aufteilung passiert nur *innerhalb* der Station
`wartet_auf_antwort`. Im Prüfskript als Invariante festhalten.

**Prüfskript `scripts/verify-funnel-karten.ts`** (neu): Jeder Lead landet auf genau einer
Karte · Summe der Bestände = Zahl der Leads · drei Follow-up-Karten tragen dieselbe
`stufenId` · jede Karte mit `vorlage` hat auch `[Vorname]` darin · leere Eingabe stürzt nicht ab.

---

### Z2 — `FunnelCanvas.tsx`: das Layout

Neue Datei `app/src/cockpit/components/sales/FunnelCanvas.tsx`. Senkrechte Kartenreihe,
oben nach unten in Funnel-Reihenfolge. Je Karte: Titel, **Bestand groß**, darunter
„heute X von Y" wenn `soll != null`, „n dran"-Badge wenn `heuteFaellig > 0`.

Styling strikt aus `docs/phase2/DESIGN-TOKENS.md` (Cockpit = „Horizont").
Badge-Kontrast: **dunkler Text auf `--ck-accent`** (`color: var(--ck-bg)`) — `--ck-accent-text`
darauf kam am 20.08. auf ~1,1:1. Die Lehre steht in `Badge.tsx` und in `LeadPipeline.tsx`.

**Erwartete Beobachtung:** `/sales` zeigt die Kartenreihe, Zahlen stimmen mit
`LeadPipeline` unter `/linkedin` überein.
**Wahrscheinlichster Fehler:** Die Karten sind unlesbar oder zu hoch — zwölf Karten à
100 px sind 1200 px Scrollstrecke, also nicht besser als die Balken vorher.
*Signal:* Screenshot zeigt weniger als vier Karten ohne Scrollen.
**Gegenzug:** Karten mit `bestand === 0 && heuteFaellig === 0` werden **zusammengeklappt**
in eine Zeile „5 Stufen ohne Bestand" am Ende. Zielhöhe: alles Aktive ohne Scrollen sichtbar.

**Trigger:** Beobachtest du mobil (390 × 664) Inhalt hinter der Nav-Dock-Pille →
`h-svh`-Falle, siehe HANDOFF Falle 2. Prüfe bei **390 × 664**, nicht im schmalen
Desktop-Fenster.

---

### Z3 — Klick auf Karte → Fenster mit Arbeitsliste

Klick öffnet `KachelFenster` (Bestand aus `SalesDashboard.tsx`, `layoutId`-Morph) mit:

1. **Oben der Textbaustein der Stufe**, einmal, mit „Text kopieren"-Knopf
   (`inZwischenablage`). `[Vorname]` bleibt sichtbar stehen — Kevin ersetzt beim
   Einfügen, oder die Namensliste liefert den Namen separat.
2. **Darunter `<Arbeitsliste posten={…} onErledigt={…} />`** — unverändert
   wiederverwendet. Sie bringt Kevins Handgriff mit: Klick auf Namen kopiert den
   Namen, darunter der LinkedIn-Profil-Link, rechts der Haken.

**Erwartete Beobachtung:** Klick auf „Follow-up 1" öffnet ein Fenster; oben steht
„Moin [Vorname], falls das untergegangen ist…"; darunter die Namen; Klick auf einen
Namen zeigt kurz „✓ Name kopiert"; der Haken zählt `li_followups` hoch.
**Wahrscheinlichster Fehler:** Der Haken zählt doppelt oder gar nicht, weil das Canvas
einen eigenen Erledigt-Pfad baut. *Signal:* `daily_metrics.li_followups` springt um 2
statt 1, oder bleibt stehen.
**Gegenzug:** `onErledigt` **muss** durch denselben Pfad wie heute laufen —
`arbeitsmodusTracking` + `useDailyMetrics().bump()`. Nie ein zweiter Schreibweg.
`scripts/verify-arbeitsmodus-tracking.ts` muss grün bleiben.

**Trigger:** Öffnet sich das Fenster, aber Klicks darin tun nichts → `#app-ui-overlay`
setzt global `pointer-events: none` (HANDOFF Falle 1). Vollbild-UI außerhalb der
CockpitShell braucht explizit `pointerEvents: 'auto'`.

---

### Z4 — Kopfzeile und die alten Balken einklappen

Über den Karten eine Zeile: **Gesamtzahl Leads im Kosmos** (heute 1.756) plus
Tagesfortschritt (`flowFortschritt`). Die bisherigen `FlowZeile`-Balken wandern in
einen aufklappbaren Bereich darunter, standardmäßig **zu**.

Zustand in `ui_settings` (Migration 0068) speichern, Schlüssel `salesBalkenOffen` —
`uiSettings.ts` hat das Muster.

**Erwartete Beobachtung:** `/sales` beginnt mit einer Zeile, darunter direkt die Karten.
Ein Klick auf „Tagespensum" klappt die alten Balken auf; nach Reload bleibt der Zustand.
**Wahrscheinlichster Fehler:** Ein kaputter `ui_settings`-Wert macht die Seite leer.
*Signal:* weiße Seite, Konsole zeigt `undefined is not iterable`.
**Gegenzug:** `uiSettings` gibt bei unbrauchbaren Werten den Standard zurück (Muster
aus `gueltigesZiel` in `tagesFlow.ts`). Nie ungeprüft destrukturieren.

---

### Z5 — Alte Sales-Ansicht ersetzen (Gesetz 3)

Der Kachel-/Flow-Block in `SalesDashboard.tsx` (Render ab ~Z. 1033) wird durch
`<FunnelCanvas />` ersetzt. `Arbeitsmodus`, `KachelFenster` und die Quellen-Hooks
bleiben. `LeadPipeline` unter `/linkedin` bleibt vorerst stehen (zweite Sicht auf
dieselben Daten, aber ohne Tagesbezug) — Abriss erst, wenn Kevin das Canvas eine
Woche benutzt hat.

**Erwartete Beobachtung:** `/sales` zeigt nur noch das Canvas. `npm run build` grün,
alle verify grün.
**Wahrscheinlichster Fehler:** Verwaiste Importe und tote Hilfsfunktionen in
`SalesDashboard.tsx` → `tsc` meldet `is declared but its value is never read`.
**Gegenzug:** Ungenutzte Exporte entfernen, aber `KachelCard`/`FlowZeile` behalten,
solange die Balken aus Z4 sie brauchen.

---

### Z6 — Jophiel-Brücke im Runner

Neuer Endpoint im Uriel-Runner: `GET /jophiel/projekte`. Er ruft Jophiels
`/api/projects` (Port aus `~/Kevin OS/02 Projekte/jophiel/config.json`, `ports.api`),
reicht die Liste durch und spiegelt sie nach `runner_snapshots` (Schlüssel
`jophiel_projekte`) — damit das Handy etwas sieht. Muster: die bestehenden Spiegel
in `runner/index.mjs` (`ads_overview`, `social_weeks`).

Zweiter Endpoint `GET /jophiel/shot/:slug/:name` proxt das PNG. **Uriel darf nie direkt
auf `127.0.0.1`** — `runnerBridge.ts` ist der einzige Weg.

**Erwartete Beobachtung:** `curl 127.0.0.1:4711/jophiel/projekte` liefert ein
JSON-Array mit `slug`, `name`, `leadName`, `status`, `createdAt`.
**Wahrscheinlichster Fehler:** Jophiel läuft nicht → `ECONNREFUSED`, und der
Runner-Endpoint wirft 500. *Signal:* Uriel zeigt eine rote Fehlerzeile im Sales-Canvas.
**Gegenzug:** Bei `ECONNREFUSED` **leeres Array plus `{jophielErreichbar: false}`**
zurückgeben, nie 500. Das Canvas zeigt dann „Jophiel läuft nicht" als stille Zeile,
keinen Fehler. Ein nicht laufender Nebendienst darf Kevins Sales-Seite nicht kaputt machen.

**RECON NEEDED:** Wie heißen die Screenshot-Dateien im Projektordner?
*Check:* `ls ~/Kevin\ OS/02\ Projekte/jophiel/projects/*/shots/` — bekannt ist
`alt-desktop.png` (aus `/api/projects/:slug/vorher`). Der Name des **neuen** Shots
muss vor Z7 feststehen; ohne ihn keine Preview-Karte.

---

### Z7 — Loom-Karten mit Preview

Zwei Kartensorten, klar getrennt (Kevins Unterscheidung vom 25.08.):

| Karte | Bedingung | Aussehen |
|---|---|---|
| **Loom offen** | `starred && loom_status === 'offen'` | schlicht, **kein Bild** — es gibt noch nichts zu zeigen |
| **Website gebaut** | Jophiel-Projekt mit passendem `leadName` und vorhandenem Shot | Browser-Rahmen mit Thumbnail, wie auf herrmannundco.de |

Klick auf eine Preview-Karte → `window.open` auf Jophiels UI für den Slug.

**Erwartete Beobachtung:** Für jedes gebaute Jophiel-Projekt eine Karte mit Bild;
Klick öffnet Jophiel.
**Wahrscheinlichster Fehler:** Die Sales-Seite wird bleischwer, weil Vollbild-PNGs
geladen werden. *Signal:* Netzwerk-Tab zeigt mehrere MB, Seite ruckelt.
**Gegenzug:** Thumbnails erzwingen — `width: 320` im Proxy oder `loading="lazy"` plus
`max-width` im CSS. Zielwert: **unter 150 kB je Karte**. Bei mehr: Shot im Runner
verkleinern (`sharp` ist nicht im Repo → stattdessen `chrome-headless-shell` mit
kleinerem Viewport beim Erzeugen, oder schlicht `loading="lazy"` + CSS-Skalierung).
**Zweiter Fehler:** `leadName` in Jophiel passt zu keinem Uriel-Lead (Namensabgleich,
siehe die Lehre aus 0076 — zwei LinkedIn-ID-Sorten). *Gegenzug:* Namensabgleich
normalisiert (trim, Mehrfach-Leerzeichen, Kleinschreibung); kein Treffer heißt Karte
ohne Lead-Verknüpfung, nicht Karte weglassen.

---

### Z8 — Dokumentation

`docs/wargames/sales-canvas.md` (dieses Dokument plus „Was tatsächlich passiert ist"),
Eintrag in `docs/BACKLOG.md` ganz oben, `HANDOFF.md` nur anfassen, wenn sich eine
Route ändert.

---

## Abbruchbedingungen — stoppen und melden statt improvisieren

1. Ein neues `daily_metrics`-Feld scheint nötig → **STOPP**. Die Regel steht im HANDOFF.
2. `stufenStaende` oder `sollFuer` müssten geändert werden → **STOPP**. Das ist die
   Zähl-Wahrheit; sie zu ändern ist eine eigene Entscheidung, kein Nebeneffekt.
3. Ein `verify-*.ts` wird rot und der Grund ist nicht in einem Satz erklärbar → **STOPP**.
4. Die Summe der Kartenbestände weicht von der Lead-Zahl ab und der Grund ist unklar
   → **STOPP** (Doppelzählung, siehe Z1).
5. Mehr als eine Migration wäre nötig → **STOPP**. Dieses Vorhaben braucht **keine**.

---

## Verifikation

**Nach jedem Zug:**
```bash
cd app && npx tsc -b && npm run build
```
Danach alle Prüfskripte:
```bash
cd ~/Kevin\ OS/02\ Projekte/uriel && for f in scripts/verify-*.ts; do npx tsx "$f" >/dev/null 2>&1 || echo "ROT $f"; done
```
Erwartung: keine Ausgabe (aktuell 53 Skripte, nach Z1 sind es 54).

**Am Ende, am laufenden Cockpit — nicht abgeleitet, sondern gesehen:**

1. `npm run cockpit:full`, `/sales` öffnen.
2. **Desktop:** Sind alle Karten mit Bestand ohne Scrollen sichtbar? Screenshot.
3. **Mobil 390 × 664** (nicht schmales Desktop-Fenster): klemmt nichts hinter der
   Nav-Dock-Pille?
4. Klick auf „Follow-up 1" → Fenster öffnet, Text oben, Namen darunter.
5. Klick auf einen Namen → „✓ Name kopiert"; in ein Textfeld einfügen und prüfen,
   dass wirklich der Name drinsteht.
6. Einen Posten abhaken → `daily_metrics.li_followups` steigt um **genau 1**
   (gegen Supabase prüfen, nicht gegen die Anzeige).
7. Jophiel stoppen und `/sales` neu laden → stille Zeile „Jophiel läuft nicht",
   **keine** rote Fehlermeldung, Rest der Seite funktioniert.
8. Screenshot an Kevin, nicht ihn testen lassen.

---

## LEDGER — geklärt in Z0 (25.08.2026, an Code und laufendem Dienst)

| Wert | Ergebnis | Beleg |
|---|---|---|
| `{{jophiel_port}}` | **4100** (API). Die UI läuft auf 4101 und war beim Recon **aus** — die API antwortete auf `/api/health` mit `{"ok":true}`. | `jophiel/config.json` → `ports.api` |
| `{{jophiel_shot_name}}` | **`desktop`** → Datei `desktop.png`, Endpoint `/api/shot/:slug/desktop`. Der Mobil-Shot heisst `mobile` (390 × 664, exakt Kevins Prüfmass). Vollbild-Varianten tragen `-full`. Die alte Seite ist `alt-desktop` / `alt-mobile`. | `jophiel/config.json` → `screenshots` (nur `desktop` und `mobile`), `server/shots.mjs` schreibt `${name}.png`, `pipeline.mjs` meldet `/api/shot/${slug}/desktop` |
| `{{jophiel_ui_route}}` | **Es gibt keinen Deep-Link.** `ui/App.jsx` hat keinen Router — welches Projekt offen ist, steht in React-State (`active`), ohne Hash und ohne Query. Die einzige slug-adressierbare URL ist die Vorschau am API-Server: **`http://127.0.0.1:4100/preview/<slug>`** (leitet auf `/preview/<slug>/index.html`). Das wird das Klickziel der Preview-Karte in Z7. | `ui/App.jsx`, `server/index.mjs` `/preview/:slug` |

**Nebenfund zu Z7 (Gewicht):** Die `desktop.png` im Bestand sind **1,0–4,5 MB**,
`mobile.png` immer noch 176–726 kB. Das Ziel „unter 150 kB je Karte" ist mit dem
Original **nicht** erreichbar; `loading="lazy"` allein verschiebt das Problem nur.
`sharp` ist nicht im Repo — aber **`/usr/bin/sips` liegt auf jedem Mac** und ist
ein Prozessaufruf, kein Paket. Der Runner darf also beim Proxen einen verkleinerten
Shot erzeugen und zwischenspeichern, ohne die Zero-Dependency-Regel zu brechen.

**Nebenfund zu `neu-desktop.png`:** In `staffel-immobilien/shots/` liegen zusätzlich
`neu-*.png` vom 24.08. Das ist ein Rest aus einer früheren Benennung, **nicht** die
Konvention — `config.json` kennt nur `desktop` und `mobile`, und die aktuelleren
`desktop.png` (25.08., 12:11) stehen daneben. Nicht darauf bauen.

### Was Z0 sonst noch ergeben hat

**Route A gilt.** `Arbeitsliste` nimmt `posten` + `onErledigt` und optional
`onZaehler` / `morgen` / `loom` / `projektLink` / `onNavigiere`. `SalesDashboard`
hält alle sechs bereits in der Hilfsfunktion `liste(posten)` — das Canvas kann sie
unverändert weiterreichen. Kein Grund für Route B.

**Der Bestand kommt aus `useLeads(slug)`**, nicht aus `usePosten`: `leads`,
`ereignisseJeLead` und — aus `useLinkedinThreads` — eine `Map<lead_id, Thread>`
(`threadsJeLead`, gebaut in `LinkedinArea.tsx`). Genau diese drei braucht
`leadStation()`. Das Canvas muss sie in `SalesDashboard` neu beschaffen; dort
hängt heute nur `usePosten`.

**Der ICP-Filter gehört ins Canvas, nicht in die Rechenschicht.** `LeadPipeline`
filtert vor dem Zählen mit `istArbeitsVorrat(icpUrteil(...))` **und** wirft
Threads vor `AKQUISE_START` raus. Ohne beides stünde im Canvas „Erstnachricht
fällig: 440" mit 71 Recruitern darin. Dieselbe Regel importieren, nicht nachbauen.

**Namensähnlichkeit, keine Kollision:** `app/src/hooks/useFunnelCanvas.ts` existiert
bereits — das ist der Knoten-Editor der Ads-Welt und hat mit dieser Runde nichts zu
tun. Der neue Bau liegt unter `cockpit/components/sales/` und kreuzt ihn nicht.

### Zustand beim Start — zwei Abweichungen von der Auftragslage

1. **Der Working Tree war nicht sauber und der Build war ROT.** Uncommittet lagen
   die Herauslösung von `lib/zwischenablage.ts` (Vorarbeit für genau dieses Canvas)
   und der passende Umbau in `Arbeitsliste.tsx`. Der Import stand als
   `inZwischenablage as kopiere` da und wurde von der lokalen Funktion `kopiere(p: Posten)`
   verdeckt — vier `tsc`-Fehler. Behoben durch Umbenennen des Imports auf
   `textInDieAblage`, mit Kommentar, damit es niemand „vereinfacht" zurückbaut.
2. **`verify-widersprueche.ts` war ebenfalls schon rot** (31 ok, 1 fehlt). Grund in
   einem Satz: Die Postfach-Schwelle wurde am 25.08. von 48 auf 18 Stunden
   verschärft, die Testvorgabe „30 Stunden sind in Ordnung" ist nicht mitgezogen
   worden. Test auf 14 Stunden (die normale Nachtlücke) nachgezogen.

Beides ist **vor** Z1 als eigener Vorlauf-Commit verbucht, damit die Zug-Commits
sauber bleiben und ein späteres Rot eindeutig meins ist.

---

# Was tatsächlich passiert ist (25.08.2026)

Gebaut in einem Durchgang, Z0 bis Z8, auf `main`. **Nicht gepusht** — Livegang
ist Kevins Wort. Commits: `e06f393` (Vorlauf) · `54f8ae1` (Z1) · `d6f76f8` (Z2)
· `4cf5f2c` (Z3) · `60eae42` (Z4) · `a9d0e55` (Z5) · `5e6ac0c` (Z6) · `62ee2b1`
(Z7).

## Der Start war nicht sauber

Die Auftragslage sagte „Working Tree sauber". Er war es nicht, und der Build war
**rot**: Die uncommittete Herauslösung von `lib/zwischenablage.ts` importierte
`inZwischenablage as kopiere` — verdeckt von einer lokalen Funktion `kopiere(p: Posten)`
in derselben Komponente. Vier `tsc`-Fehler an einer Zeile, die richtig aussah.
Dazu war `verify-widersprueche.ts` schon rot: Die Postfach-Schwelle war am 25.08.
von 48 auf 18 Stunden verschärft worden, der Test „30 Stunden sind in Ordnung"
nicht mitgezogen.

Beides in einem Vorlauf-Commit repariert, **vor** Z1 — sonst wäre bei jedem
späteren Rot unklar gewesen, ob es meins ist. Das ist die Lehre: Wer eine
Blaupause abarbeitet, misst zuerst den Ausgangszustand, statt ihm zu glauben.

## Was der Plan richtig vorhergesagt hat

- **Route A hielt.** `Arbeitsliste` hängt an nichts, was sich nicht lösen liess.
- **Die Doppelzählung** war die richtige Sorge. Sie ist nie eingetreten, weil die
  Station zuerst entscheidet und der Follow-up-Bucket nur *innerhalb* von
  `wartet_auf_antwort` verfeinert — als Invariante im Prüfskript festgehalten.
- **Der `ECONNREFUSED`-Fall** trat schon beim Bauen ein, weil Jophiel zwischendurch
  aus war. Der Gegenzug (leeres Array plus Flag, nie 500) war damit unfreiwillig
  an echten Bedingungen geprüft.
- **Das Bildgewicht** war real: 1,0–4,5 MB je Aufnahme.

## Was der Plan nicht wusste

**1. Jophiels UI hat keinen Deep-Link.** `ui/App.jsx` hält das offene Projekt in
React-State, ohne Hash und ohne Query. Die einzige slug-adressierbare URL ist
`http://127.0.0.1:4100/preview/<slug>` am API-Server — die ist jetzt das
Klickziel der Vorschau-Karte.

**2. `sips` löst das Bildgewicht ohne Paket.** Der Plan schlug „Viewport beim
Erzeugen verkleinern oder CSS-Skalierung" vor. Beides hätte das Problem
verschoben statt gelöst. `/usr/bin/sips` liegt auf jedem Mac und ist ein
Prozessaufruf — die Zero-Dependency-Regel bleibt heil. Gemessen: 1.475.863 →
72.667 B · 1.054.854 → 51.173 B · 1.622.955 → 72.524 B. Ziel waren 150 kB.

**3. Drei Karten, ein Pensum — die 39-statt-13-Falle.** Die drei Follow-up-Karten
zählen alle auf `li_followups`. Stünde „heute 5 von 13" auf jeder, läse Kevin 39.
Die Karten stehen deshalb unter EINER Kopfzeile, und die Gruppierung
(`funnelGruppen`) liegt in der Rechenschicht statt im Markup: geprüft wird, dass
keine Zähl-Stufe in zwei Gruppen vorkommt.

**4. „E-Mail fällig · 603 dran" war der lauteste Punkt der Seite — und dahinter
lag nichts.** Für den stillen Zweig sind noch keine Adressen beschafft
(`Lead.email` ist leer, ausdrücklich so in `types/db.ts`). Ein Akzent-Badge, das
zu nichts führt, ist ein Alarm ohne Knopf; nach drei Tagen glaubt man auch dem
grünen Badge nicht mehr, hinter dem wirklich Arbeit liegt. Das Badge ist jetzt
nur dort grün, wo es ein Klickziel gibt. Die Zahl bleibt sichtbar, sie hört nur
auf zu rufen.

**5. Karte und Balken trugen dieselbe `layoutId`.** Sichtbar erst, als die Balken
aus Z4 aufgeklappt waren: framer-motion versuchte zwischen beiden zu morphen und
sie geisterten ineinander. Die Karten haben jetzt einen eigenen Namensraum
(`canvas-…`), und `KachelFenster` bekommt die Kennung des Auslösers gesagt,
statt sie zu erraten.

**6. Die Spur-Listen waren `quellen.x ?? []`** — ein neues Array je Render. Harmlos,
solange sie nur angezeigt wurden; mit dem Canvas hängt daran eine Rechnung über
1.788 Leads. Jetzt `useMemo`, damit die Kette darüber wirklich hält.

**7. Ein mitkopierter Zeilenumbruch hätte den Namensabgleich gekippt.**
`leadIdentitaet.normName` wirft alles ausser Buchstaben und Leerzeichen raus —
aus `Hartmut\nSchneider` wird dabei `hartmutschneider`. Der Leerraum wird
deshalb **in `jophielProjekte.ts`** vorher geglättet, nicht in der geteilten
Funktion: Die anzufassen hiesse, den Lead-Abgleich im ganzen System zu ändern,
um ein Problem an einer einzigen Handeingabe zu lösen.

## Bewusst nicht gebaut

- **Die Stationen aus 0078 (Instagram, PDF, Postkarte, Anruf) sind nicht
  klickbar.** Sie haben keine Posten-Quelle — es gibt keine Liste, die sich
  öffnen liesse. Sie zeigen ihren Bestand; wer die Namen will, findet sie mit
  CSV-Export in der Pipeline unter `/linkedin`. Eine Karte, die auf Klick nichts
  zeigt, wäre schlimmer als eine, die gar nicht klickbar aussieht.
- **Die InMail-Welle hat keine Karte.** Sie ist ein Nebenstrom, keine Station
  (Kevins Korrektur vom 20.08.). Ein Lead im InMail-Pool steckt gleichzeitig in
  `anfrage_offen` — eine eigene Karte würde ihn doppelt zählen. Sie wohnt
  weiterhin in den Balken.
- **Vorschaubilder werden nicht nach Supabase gespiegelt.** Das wären Dutzende
  Megabyte für eine Vorschau. Am Handy zeigt die Karte den Namen ohne Bild —
  ehrlicher als ein toter Bildrahmen.
- **`LeadPipeline` unter `/linkedin` steht weiter.** Abriss erst, wenn Kevin das
  Canvas eine Woche benutzt hat.

## Was am laufenden Cockpit gesehen wurde

Mit Kevins Prod-Daten, nicht abgeleitet:

1. **Desktop:** Alle acht Karten mit Bestand plus die eingeklappte Zeile und die
   Aussortierten passen ohne Scrollen ins Bild (`scrollHeight === clientHeight`).
2. **Mobil 390 × 664** (nicht schmales Desktop-Fenster): Am Ende der Seite endet
   das letzte Element bei 551 px, die Nav-Dock-Pille beginnt bei 596. Nichts klemmt.
3. **Klick auf „Follow-up 1"** öffnet das Fenster: oben „Moin [Vorname], falls das
   untergegangen ist…", darunter die zwanzig Namen der Tagesportion.
4. **Klick auf einen Namen** legt exakt `Christelle Franz` in die Zwischenablage —
   und zwar über die `execCommand`-Rückfallebene, weil `navigator.clipboard`
   abwies. Genau der Fall, für den `zwischenablage.ts` existiert.
5. **Ein Posten abgehakt, gegen Supabase geprüft:** `daily_metrics.li_followups`
   0 → **1**. Nicht 2, nicht 0. Am Thread `followup_stage` 0 → 1 (`markDonePatch`).
   Auf der Karte gleichzeitig: „heute 1 von 20", Badge 20 → 19, Bestand 163 → 162
   — drei Anzeigen aus einem Schreibvorgang.
6. **Ein kaputter `ui_settings`-Wert** (`{"kaputt":[1,2]}` eingeschleust): Seite
   steht, Karten da, Standard greift, keine Konsolen-Fehler.
7. **Jophiel gestoppt, `/sales` neu geladen:** Runner antwortet HTTP 200 mit
   leerer Liste, die Seite zeigt die stille Zeile „Jophiel läuft nicht — gebaute
   Seiten sind gerade nicht abrufbar." Kein roter Fehler, keine Konsolen-Meldung,
   Rest der Seite arbeitet weiter.
8. **Pfad-Sicherheit am laufenden Runner:** `..%2F..%2F..%2Fetc` → 404,
   unbekannter Aufnahme-Name → 404, die gesperrten `-full`-Fassungen → 404.

## Stand der Prüfskripte

53 vorher, **56 jetzt** — `verify-funnel-karten.ts` (38), `verify-jophiel-bruecke.ts`
(41), `verify-jophiel-projekte.ts` (21). Alle grün, `npx tsc -b` und
`npm run build` ebenfalls.

ESLint auf `SalesDashboard.tsx`: 3 Fehler, 0 Warnungen — exakt die drei, die auch
in `5e5b68f` schon standen (gegengeprüft, indem die alte Fassung derselben Datei
noch einmal gelintet wurde). Vorher waren es kurzzeitig 6 und 7.

## Offen für Kevin

- **Der Abhak-Test hat echte Daten angefasst.** `Christelle Franz`
  (Thread `90a25a2d-f025-4942-8d24-e67def483785`) steht jetzt auf
  `followup_stage: 1` statt 0, und `li_followups` des 25.08. steht auf 1.
  Zurückdrehen, falls unerwünscht: Stufe auf 0 und den Zähler auf 0 setzen.
- **„Erstnachricht fällig: 368 · heute 0 von 0"** liest sich schief. Der Bestand
  kommt aus `leads` (angenommen, nie geschrieben), das Pensum aus
  `linkedin_erstnachrichten` (versandfertige Texte). Beides stimmt, aber die
  Lücke dazwischen ist eine eigene Frage: 368 Leute warten, und es liegt kein
  Text für sie bereit.
- **Sollen die 0078-Stationen klickbar werden?** Dafür bräuchten sie je eine
  Posten-Quelle in `arbeitsmodusQuellen.ts` — eine eigene Runde.
