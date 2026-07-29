# Wargame — Vom Nachschlagewerk zum Arbeitswerkzeug

**Erstellt:** 2026-07-29 · **Planer:** Opus 5 · **Executor:** Sonnet (blind ausführbar)
**Branch:** `cockpit-rebuild` · **Repo:** `~/Kevin OS/02 Projekte/uriel`

---

## Mission Brief

Kevins Cockpit zeigt Zustand, nimmt ihm aber keine Entscheidung ab. Seine Worte:
*„Es fühlt sich eher wie ein Nachschlagewerk an, nicht wie ein Tool, in dem ich
arbeite."* Und: *„Das Programm sagt mir nicht, was jetzt das Wichtigste ist."*

**Ziel:** Drei Dinge, die aus Anzeige Arbeit machen.

1. **Tagespensum** statt Lagerbestand — das System entscheidet die Portion.
2. **Arbeitsmodus** im Vollbild — ein Kontakt, ein Text, drei fette Knöpfe.
3. **Abhaken = Tracking** — was er wegklickt, zählt sich selbst.

Dazu das **Sales-Dashboard als Kacheln**: jede Kachel eine Kennzahl **plus eine
empfohlene Handlung**, Klick vergrößert sie zum Arbeitsfenster, Schließen ordnet
sie zurück ins Raster.

**Nicht im Scope (v1):** Kalender-gestützte Verteilung über die Woche. Graph-
Darstellung der LinkedIn-Leads. Offene Vernetzungsanfragen als Arbeitsliste
(Datenlage ungeklärt, siehe RECON-2). Content-Kachel.

**Leitplanken:**
- Keine neuen Metrik-Felder erfinden. `METRIC_FIELDS` ist gesetzt (siehe Recon).
- Der Vollbild-Modus muss **einhändig am Handy** bedienbar sein: Knöpfe ≥ 48 px,
  kein Lesen nötig, kein Zielen.
- Bestehende Seiten (Pipeline, Listen, Call-Mode) bleiben unangetastet.

---

## Recon-Befunde (verifiziert am 29.07.2026, nicht raten)

| Frage | Befund | Konsequenz |
|---|---|---|
| Wo liegen die Trichter-Quoten? | `app/src/cockpit/lib/goals.ts` → `CONVERSION_TARGETS`: `nachrichtLoom.min 0.1`, `loomQuali.min 0.1`, `qualiKunde.min 0.25` | Tagespensum rechnet **aus diesen Werten**, nicht aus neuen Konstanten. |
| Wo liegt das Monatsziel? | `goals.ts` → `MONTH_TARGETS['2026-07'].total = 30000`, Wochenkurve `JULY_2026_CURVE`, Helfer `currentSoll(curve, today)`; Überschreibung via `monthTotalOverride(monthKey)` | Ziel **nie hartkodieren** — immer über `monthTargetFor()` / `monthTotalOverride()`. |
| Wert je Kunde? | `LIFE_TARGET.cashProKunde = 5500` | Kunden = Monatsziel ÷ 5500. |
| Wo wird getrackt? | Tabelle `daily_metrics`, Hook `useDailyMetrics()` (`app/src/cockpit/lib/useDailyMetrics.ts`), Feldliste `METRIC_FIELDS` (23 Felder), Upsert bereits vorhanden | Abhaken schreibt **über diesen Hook**, kein eigener Schreibpfad. |
| Relevante Felder | `li_nachrichten`, `li_followups`, `looms`, `antworten_li`, `quali_termine`, `abschluesse` | Zuordnung siehe Zug 4. |
| Datenquellen der Listen | `linkedin_threads` (159 Zeilen, Buckets über `bucketOf`), `linkedin_erstnachrichten` (91 Zeilen, Status `offen`) | Beide live und befüllt. |
| Loom-Status | **Existiert nicht.** Stern (`starred`) sagt nur „hat zugesagt" | Neue Spalte nötig → Zug 2. |
| Kachel-Vorbild im Repo | `app/src/cockpit/pages/SalesDashboard.tsx` (aktuell Formulare + leere Panels) | Wird ersetzt, nicht ergänzt. |
| Runner-Brücke | `runnerBridge.ts` (`runnerDirekt`, `leseSpiegel`, `beauftrageRunner`) | Für alles, was den Runner braucht — nie direkt `fetch` auf 127.0.0.1. |

### Die Rechnung, die alles prägt (nachgerechnet, nicht geschätzt)

30.000 € ÷ 5.500 € = **5,5 Kunden** → ÷ 0,25 = **22 Quali-Calls** → ÷ 0,10 =
**219 Looms** → ÷ 0,10 = **2.182 Erstnachrichten** im Monat.

Bei 21 Arbeitstagen: **104 Erstnachrichten + 10,4 Looms pro Tag.**

**Kevins Tagesrahmen (4-4-4, bestätigt 29.07.):** 4 h Promo/Sales (inkl. Termine),
4 h Kundenarbeit, 4 h dritter Block — der fällt zuerst weg, wenn es eng wird.
Die Akquise-Kapazität ist also **240 Minuten**, aber **Termine liegen innerhalb
dieses Blocks** und wandern im Kalender.

**Dauern (von Kevin, nicht geschätzt):** Antwort **20 s** (Text ist vorgeschrieben,
nur kopieren), Erstnachricht 30 s, Follow-up 30 s, Vernetzungsanfrage ~10 s,
Loom **15 min**. Fixe Tagesgröße: **30 Vernetzungsanfragen**.

Damit geht die Rechnung bei 240 Minuten **punktgenau auf**:

```
30 Anfragen    5 min
38 Antworten  13 min
11 Looms     165 min
10 Follow-ups  5 min
104 Erstnachrichten 52 min
              = 240 min
```

**Korrektur 29.07. (Kevin): Das oben ist der RÜCKSTAU, nicht das Tagesgeschäft.**
Die 91 Erstnachrichten, 63 Follow-ups, 38 Antworten und 15 Looms haben sich
einmalig angesammelt. Ist der Berg abgetragen, ist der tägliche Zulauf klein.

**Dauerzustand, gerechnet aus Kevins eigenen Zielspannen (`CONVERSION_TARGETS`):**

| | Erstnachrichten/Tag | Looms/Tag | Zeit/Tag | nötige Anfragen/Tag |
|---|---|---|---|---|
| Untergrenze (0,10 / 0,10 / 0,25) | 104 | 10,4 | 213 min | **347** |
| Zielwert `great` (0,20 / 0,30 / 0,50) | 8,7 | 1,7 | **35 min** | **29** |

Kevin schickt **30 Vernetzungsanfragen/Tag**. Das trifft die Zielwert-Zeile auf
die Eins — und verfehlt die Untergrenze um Faktor 12. **Zwischen beiden Zeilen
liegt, ob sein Monatsziel erreichbar ist.**

**Die drei Erkenntnisse, die das Design bestimmen:**

1. **Bestand ≠ Fluss.** Das Dashboard muss **Zulauf heute** (klein, ~35 min) und
   **Rückstau** (einmalig, groß) getrennt zeigen. Wer beides vermischt, macht aus
   jedem Tag einen Notfall — und Kevin ignoriert das Pensum nach drei Tagen.
   Der Rückstau bekommt eine **Portion aus der Restkapazität**, nie den ganzen Berg.
2. **Looms sind der Flaschenhals, nicht die Nachrichten.** Selbst im Dauerzustand
   sind 1,7 Looms = 26 min gegenüber 4 min für alle Nachrichten zusammen. Im
   Rückstau-Modus (11 Looms = 165 min) frisst eine Stunde Termin sofort ~90
   Erstnachrichten. Regel: **Looms bekommen ihren Platz zuerst**; passen sie nicht,
   sagt die Oberfläche das, statt sie stillschweigend fallen zu lassen.
3. **Die wichtigste Kennzahl ist die erreichte Quote, nicht der Zähler.** Sie
   entscheidet, ob der Tag 35 Minuten oder unmöglich ist. Sie gehört als eigene
   Kachel nach vorn (Zug 5, Kachel 6) — mit Ist gegen Zielspanne, nicht nur Ist.

---

## Zug 1 — Tagespensum als reine Funktionen (`app/src/cockpit/lib/tagespensum.ts`)

**Aktion:** Neues Modul, keine Netzwerkaufrufe, per `tsx` prüfbar.

```
DAUER_MINUTEN = { anfrage: 10/60, antwort: 20/60, erstnachricht: 0.5, followup: 0.5, loom: 15 }
AKQUISE_BLOCK_MINUTEN = 240   // 4-4-4: erster Block
ANFRAGEN_PRO_TAG = 30         // feste Tagesgröße
```

Exporte:

- `berechneBedarf(monatsziel, quoten, cashProKunde)` → `{ kunden, quali, looms, nachrichten }`.
- `proArbeitstag(bedarf, arbeitstageRest)` → dieselben Felder als Tagesbedarf.
- `berechnePensum({ bedarf, zulauf, rueckstau, kapazitaetMinuten })` → Portion je Spur,
  **getrennt nach `zulauf` und `rueckstau`**.

**Zulauf** = was heute neu angefallen ist (neue Antworten, neu angenommene
Anfragen). **Rückstau** = alles Ältere. Die Trennung läuft über das Alter des
Eintrags; Schwelle: seit dem letzten abgeschlossenen Arbeitsdurchgang.

**Reihenfolge der Zuteilung ist festgelegt** (kein Ermessen):
1. `anfragen` — feste 30, ~5 min. Nicht verhandelbar, füttert den ganzen Trichter.
2. `antworten` (Zulauf **und** Rückstau) — **alle**, ungedeckelt. Wer geantwortet
   hat, wartet nicht.
3. `looms` — Tagesbedarf zuerst, dann Rückstau, solange Zeit bleibt.
4. `followups` — Zulauf, dann Rückstau.
5. `erstnachrichten` — Zulauf zuerst, dann füllt der Rückstau die **restliche**
   Kapazität auf.

Rückgabe zusätzlich: `{ minutenGeplant, minutenKapazitaet, minutenTermine,
bedarfNachrichtenProTag, luecke, rueckstauGesamt, rueckstauHeute }`.

**Termine gehen von der Kapazität ab.** `kapazitaetMinuten = AKQUISE_BLOCK_MINUTEN
− minutenTermine`. Die Termine kommen aus dem bestehenden Kalender-Proxy
(`fetchCalendar`, Runner-Endpoint `/calendar`) — nur die des heutigen Tages, nur
die, die in den Akquise-Block fallen. Ist der Kalender nicht erreichbar, gilt
`minutenTermine = 0` und die UI sagt „ohne Termine gerechnet".

**Erwartete Beobachtung bei Erfolg:** `npx tsx scripts/verify-tagespensum.ts` gibt
„N/N Fälle korrekt". Fixture mit Monatsziel 30000, Vorrat (91 Erstnachrichten,
63 Follow-ups, 38 Antworten, 15 Looms), Kapazität 90 → Summe der Minuten ≤ 90,
`antworten` = 38 (ungedeckelt), `luecke > 0`.
**Bei Fehlschlag:** Minutensumme > Kapazität, oder `antworten` gedeckelt.

**Wahrscheinlichster Fehler:** Der Executor deckelt die Antworten mit, weil sie
zeitlich am teuersten sind (38 × 3 min = 114 min > Kapazität). **Gegenzug:**
Antworten stehen **vor** der Kapazitätsrechnung. Übersteigen sie die Kapazität
allein, ist das Pensum = nur Antworten, alles andere 0, und `minutenGeplant`
liegt über `minutenKapazitaet`. Das ist gewollt und muss die UI zeigen dürfen.

**Zweiter Fehler:** Division durch null, wenn eine Quote 0 ist oder der Monat
kein Ziel hat. **Gegenzug:** Quote ≤ 0 → Bedarf `Infinity` vermeiden, stattdessen
`null` zurückgeben und die UI zeigt „Ziel/Quoten unvollständig".

**Trigger:** Liefert `monthTargetFor(monatsKey)` `null` → kein Pensum berechnen,
Kachel zeigt „Monatsziel fehlt" mit Link auf `/tracking`. Kein Ersatzwert erfinden.

**Abbruchbedingung:** Keine neuen Zielwerte in dieses Modul schreiben. Alles kommt
aus `goals.ts`.

---

## Zug 2 — Migration `0061_loom_status.sql`

**Aktion:** Loom-Spur auf `linkedin_threads` ergänzen (die Sterne sind dort):

```sql
alter table linkedin_threads
  add column if not exists loom_status text not null default 'offen'
    check (loom_status in ('offen', 'aufgenommen', 'verschickt', 'entfaellt')),
  add column if not exists loom_erledigt_at timestamptz;

create index if not exists linkedin_threads_loom_idx
  on linkedin_threads (brand_id, loom_status) where starred;
```

**Erwartete Beobachtung bei Erfolg:** `select count(*) from linkedin_threads where
loom_status = 'offen' and starred` gibt **15**.
**Bei Fehlschlag:** Spalte fehlt → PGRST-Fehler in der App.

**Wahrscheinlichster Fehler:** Der Executor pusht selbst. **Verboten** — Kevins
Migrations-Historie desynchronisiert. **Gegenzug:** Migration nur schreiben, dann
stoppen und Kevin den SQL-Block zum Einfügen in den Supabase-SQL-Editor geben
(so lief es bei 0058/0059/0060). Bis dahin muss die App einen sauberen
Leerzustand zeigen — `isMissingSupabaseTableError`-Muster analog nutzen.

**Trigger:** Fehlt die Spalte zur Laufzeit → Loom-Kachel zeigt „Migration 0061
ausstehend", alle anderen Kacheln arbeiten normal weiter.

---

## Zug 3 — Arbeitsmodus (`app/src/cockpit/components/Arbeitsmodus.tsx`)

**Aktion:** Vollbild-Overlay, **ein** Eintrag gleichzeitig.

Aufbau von oben:
1. Fortschritt „3 / 12" + dünner Balken. Kein weiterer Text.
2. **Name** (groß). Dahinter **grau** die Firma. Darunter **grün** die Website als Link.
3. Der Text (Nachricht bzw. Loom-Skript) in einem ruhigen Block, `white-space: pre-wrap`.
4. Drei Knöpfe, jeder **≥ 48 px hoch**, volle Breite auf Handy:
   `Kopieren` (primär) · `Erledigt` · `Überspringen`.
5. `Esc` / „Schließen" bricht ab — Fortschritt bleibt erhalten.

Nach `Erledigt` **automatisch zum nächsten Eintrag**. Nach dem letzten: Abschluss-
Bild — „12 raus." plus die aktualisierten Tageszahlen.

**Erwartete Beobachtung bei Erfolg:** Screenshot bei 390×664 zeigt Name, Text und
drei Knöpfe **ohne Scrollen**; `document.documentElement.scrollWidth === clientWidth`.
**Bei Fehlschlag:** Knöpfe unterhalb der Falz, horizontaler Überlauf.

**Wahrscheinlichster Fehler:** Die bekannte Falle aus `App.tsx` — `#app-ui-overlay`
setzt global `pointer-events: none`. Ein Vollbild außerhalb der CockpitShell ist
dann tot. **Gegenzug:** Overlay explizit mit `pointerEvents: 'auto'` rendern und
**innerhalb** der Shell montieren. Signal: Knöpfe reagieren nicht auf Klicks.

**Zweiter Fehler:** `navigator.clipboard` wirft in unsicherem Kontext oder ohne
Nutzergeste. **Gegenzug:** `try/catch`; scheitert es, den Text markierbar lassen
und „Text markieren und kopieren" einblenden — nie stumm scheitern.

**Dritter Fehler:** Die `h-svh`-Falle aus der Memory — auf echtem Handy klemmt der
Inhalt hinter der Nav. **Gegenzug:** Bei 390×664 prüfen, nicht nur im Desktop-
Schmalfenster.

**Trigger:** Ist die Liste beim Start leer → Arbeitsmodus gar nicht öffnen,
stattdessen „nichts offen" an der Kachel.

---

## Zug 4 — Abhaken schreibt `daily_metrics`

**Aktion:** Jedes `Erledigt` erhöht **genau ein** Feld über `useDailyMetrics()`:

| Spur | Feld | Begründung |
|---|---|---|
| Erstnachricht | `li_nachrichten` | +1 je verschickter Erstnachricht |
| Follow-up | `li_followups` | +1 je Follow-up |
| Loom | `looms` | +1, zusätzlich `loom_status = 'verschickt'` |
| **Antwort** | **keins** | `antworten_li` zählt **erhaltene** Antworten (Trichter-Eingang). Eine eigene Antwort ist keine neue Antwort. |

**Das ist die gefährlichste Stelle des ganzen Plans.** Ein falsch gezähltes Feld
verfälscht Kevins Trichter dauerhaft und fällt erst Wochen später auf.

**Erwartete Beobachtung bei Erfolg:** Vor/Nach-Vergleich der Zeile in
`daily_metrics` für das heutige Datum: genau das erwartete Feld +1, alle anderen
unverändert.
**Bei Fehlschlag:** zwei Felder verändert, oder `antworten_li` hochgezählt.

**Wahrscheinlichster Fehler:** Der Executor hält `antworten_li` für „Antworten,
die ich schreibe" und zählt hoch. **Gegenzug:** Die Antwort-Spur erhöht
**nichts**. Steht so im Code-Kommentar, damit es nicht später „repariert" wird.

**Zweiter Fehler:** Doppelzählung bei Doppelklick oder erneutem Öffnen.
**Gegenzug:** Der Status-Wechsel ist die Quelle der Wahrheit — nur erhöhen, wenn
der Eintrag **von** `offen` **auf** erledigt wechselt. Ist er schon erledigt,
passiert nichts.

**Abbruchbedingung:** Kein neues Feld zu `METRIC_FIELDS` hinzufügen. Passt eine
Spur auf kein Feld, zählt sie nicht — und das wird in der UI gesagt.

---

## Zug 5 — Sales-Dashboard als Kacheln (`SalesDashboard.tsx` ersetzen)

**Aktion:** Raster aus Kacheln (`repeat(auto-fit, minmax(260px, 1fr))`). Jede
Kachel: **Titel · eine Kennzahl · eine empfohlene Handlung**. Klick vergrößert sie
zum Arbeitsfenster (Overlay), Schließen ordnet sie zurück.

Kacheln in dieser Reihenfolge — die Reihenfolge ist die Priorität:

| # | Kachel | Kennzahl | Handlung |
|---|---|---|---|
| 1 | **Heute** | „0 von 14 · 38 Min. · 1 Termin abgezogen" | „Arbeitsmodus starten" (alle Spuren nacheinander) |
| 2 | **Vernetzungsanfragen** | **0 von 30** | Arbeitsmodus (Spur `anfrage`) — Kevins Tagesritual, füttert den Trichter |
| 3 | **Antworten** | 38 warten · 12 mit Stern | Arbeitsmodus (Spur `antwort`) |
| 4 | **Looms** | 0 von 2 heute · 15 im Rückstau | Arbeitsmodus (Spur `loom`) |
| 5 | **Erstnachrichten** | 9 heute · 91 im Rückstau | Arbeitsmodus (Spur `erstnachricht`) |
| 6 | **Quoten** | Ist gegen Zielspanne, je Stufe | Link `/tracking` |
| 7 | **Follow-ups** | 63 fällig · 58 Altlasten | Arbeitsmodus (Spur `followup`) |
| 8 | **Ziel** | Ist/Soll + Lücke | Link `/tracking` |

**Kachel 6 ist die wichtigste und darf nicht nach hinten rutschen.** Sie zeigt je
Trichterstufe Ist gegen die Spanne aus `CONVERSION_TARGETS` — denn zwischen
Untergrenze und Zielwert liegt Faktor 12 im Tagesaufwand. Farbe: unterhalb `min`
warnend, zwischen `min` und `great` neutral, ab `great` positiv.

**Jede Kachel mit Rückstau zeigt beides getrennt** („9 heute · 91 im Rückstau").
Nie die Summe — sonst sieht jeder Tag nach Notstand aus.

**Der Tagesrahmen 4-4-4 ist die Klammer:** Das Dashboard zeigt oben, in welchem
Block Kevin gerade ist (Akquise / Kundenarbeit / dritter Block) und wie viel Zeit
darin noch übrig ist. Der zweite Block bekommt seine eigene Kachelgruppe (Zug 7).

**Erwartete Beobachtung bei Erfolg:** `npx tsc -b` grün, `npm run build` grün,
Kacheln bei 1280×800 dreispaltig, bei 390×664 einspaltig ohne horizontalen
Überlauf. Jede Kachel zeigt eine Zahl **und** einen Knopf.
**Bei Fehlschlag:** Kachel ohne Handlung (dann ist es wieder ein Nachschlagewerk).

**Wahrscheinlichster Fehler:** Der Executor baut Reiter statt Kacheln, weil das
im Repo häufiger vorkommt. **Gegenzug:** Kevin hat Kacheln ausdrücklich verlangt
(„keine Tabs, sondern Kartenfenster, das größer wird"). Reiter sind hier falsch.

**Zweiter Fehler:** Die Vergrößerung wird als Route gebaut → Zurück-Taste und
Zustand brechen. **Gegenzug:** Lokaler State im Dashboard, kein Routing.

**Trigger:** Fehlt eine Datenquelle (Tabelle noch nicht migriert), zeigt **nur
diese** Kachel ihren Leerzustand. Nie die ganze Seite abbrechen.

---

## Zug 7 — Kundenarbeit als zweiter Block (Kachelgruppe „Liefern")

**Aktion:** Zweite Kachelgruppe unter der Akquise, für Kevins zweiten 4-h-Block.
Sie beantwortet: *„Was schulde ich Kunden, und was liegt zu lange?"*

Quellen (alle vorhanden, nichts Neues erfinden):
- `foundation_tasks` — offene Aufgaben mit `project_id`.
- `deliver_projects` / `contacts.deliver_project_id` — laufende Kundenprojekte.
- `contacts.stage_changed_at` — wie lange der Zustand schon steht.

Kacheln:

| Kachel | Kennzahl | Handlung |
|---|---|---|
| **Offene Kundenaufgaben** | Anzahl je Projekt | Link ins Projekt |
| **Liegt zu lange** | Projekte ohne Bewegung seit > 14 Tagen | „Follow-up entwerfen" |

**Die „liegt zu lange"-Regel ist Kevins ausdrücklicher Wunsch** (*„die ist seit
zwei Wochen im Review, mach da mal ein Follow-up"*). Schwelle: **14 Tage ohne
Änderung an `stage_changed_at` bzw. ohne erledigte Aufgabe im Projekt.**

**Erwartete Beobachtung bei Erfolg:** Kachelgruppe rendert; bei Kevins aktuellem
Stand erscheint mindestens ein Projekt (CoLective oder Reichentrog) mit Alter in
Tagen.
**Bei Fehlschlag:** leere Gruppe trotz laufender Projekte → falsche Quelle gewählt.

**Wahrscheinlichster Fehler:** Der Executor erfindet eine neue Projekt-Tabelle,
weil die Zuordnung Kunde↔Projekt verstreut ist. **Gegenzug:** Ausschließlich die
drei Quellen oben. Reicht das nicht, ist das ein **RECON-3**-Fall — melden, nicht
modellieren.

**Abbruchbedingung:** Keine Migration für diesen Zug. Findet sich die nötige
Information nicht in den drei Quellen, bleibt die Kachel mit ehrlichem Leertext
stehen.

---

## Zug 6 — Verifikation

1. `npx tsx scripts/verify-tagespensum.ts` → „N/N Fälle korrekt".
2. `npx tsc -b` und `npm run build --prefix app` → grün.
3. Screenshots **1280×800 und 390×664** von: Dashboard-Raster, geöffneter Kachel,
   Arbeitsmodus, Abschlussbild.
4. Metrik-Beweis: Zeile aus `daily_metrics` für heute **vor** und **nach** einem
   `Erledigt` ausgeben — genau ein Feld +1.
5. Konsole auf Fehler prüfen. **Hinweis:** Hooks-Order-Warnungen nach einem Edit
   sind HMR-Artefakte; erst nach vollem Reload bewerten (das kostete am 28.07.
   unnötig Zeit).

---

## Red-Team-Durchgang

| Angriff | Ergebnis | Patch |
|---|---|---|
| „Das Tagespensum ist 104 Nachrichten — Kevin ignoriert es ab Tag 3." | **Traf.** | Das waren Rückstauzahlen. Zulauf und Rückstau werden getrennt gezeigt; der Rückstau bekommt nur eine Portion aus der Restzeit. |
| „Jeder Tag sieht nach Notstand aus, weil Bestand und Fluss addiert werden." | **Traf.** | Keine Kachel zeigt je die Summe — immer „X heute · Y im Rückstau". |
| „Termine wandern, das Pensum rechnet trotzdem mit 240 Minuten." | **Traf.** | Kapazität = 240 − Termine des Tages im Akquise-Block, aus dem Kalender-Proxy. Kalender weg → „ohne Termine gerechnet". |
| „Die Quoten-Kachel rutscht beim Bauen nach unten, weil sie 'nur' eine Zahl ist." | **Traf.** | Ausdrücklich als wichtigste Kachel markiert: zwischen Untergrenze und Zielwert liegt Faktor 12 im Tagesaufwand. |
| „Antwort-Spur zählt `antworten_li` hoch und verfälscht den Trichter." | **Traf.** | Zug 4: Antwort-Spur zählt nichts, mit Begründung im Code. |
| „Abhaken zählt doppelt bei Doppelklick." | **Traf.** | Nur beim Übergang `offen` → erledigt zählen. |
| „Vollbild reagiert nicht auf Klicks." | **Abgewehrt.** | `pointerEvents: 'auto'` + Montage in der Shell, Falle aus `App.tsx` bekannt. |
| „Executor baut Reiter statt Kacheln." | **Traf.** | Ausdrücklicher Hinweis in Zug 5 samt Kevins Formulierung. |
| „Ziel fehlt für den Monat → Division durch null, weiße Seite." | **Abgewehrt.** | `monthTargetFor()` null → Kachel meldet „Monatsziel fehlt". |
| „Loom-Kachel bricht die Seite, weil 0061 noch nicht gepusht ist." | **Traf.** | Leerzustand pro Kachel, nie global. |

---

## Abbruchbedingungen (stoppen und melden, nicht improvisieren)

1. Ein Metrik-Feld passt auf keine Spur → nicht zählen, nicht erfinden.
2. `db push` durch den Executor — verboten. SQL an Kevin geben.
3. Bestehende Seiten (Pipeline, Listen, Call-Mode, Bibliothek) müssten geändert
   werden → stoppen, das ist nicht im Auftrag.
4. Der Arbeitsmodus bräuchte einen Schreibpfad am `useDailyMetrics`-Hook vorbei.
5. Mehr als eine Kachel zeigt gleichzeitig einen Leerzustand → Datenlage prüfen
   lassen, nicht weiterbauen.

---

## LEDGER — was Kevin liefern muss

| # | Blocker | Was gebraucht wird | Blockiert |
|---|---|---|---|
| **L-1** | Migration 0061 | SQL-Block aus Zug 2 im Supabase-SQL-Editor ausführen | Loom-Kachel |
| **L-2** | ~~Kapazität~~ **geklärt 29.07.** | 4-4-4: 240 Min. Akquise-Block, minus Termine des Tages | — |
| **L-3** | ~~Dauer Antwort~~ **geklärt 29.07.** | 20 s (Text ist vorgeschrieben) | — |
| **L-4** | `{{annahmequote}}` | Wie viel Prozent der 30 Vernetzungsanfragen werden angenommen? Für die Zulauf-Prognose. Ohne Antwort rechnet der Plan mit dem **Ist aus `daily_metrics`** statt mit einer Annahme | Zug 1 (nur die Vorschau „morgen kommen ~N dazu") |
| **R-2** | Offene Vernetzungsanfragen als Liste | Kein Kevin-Input nötig. Recon 28.07.: Seite ist serverseitig gerendert, Klassennamen verwürfelt, virtualisierte Liste — 10 von 867 lesbar. ICP-Einstufung existiert nirgends. **Bis geklärt: nur Zahl + Hinweis auf `linkedin-inmail`** | Kachel 7 |

L-4 blockiert nichts — ohne Antwort wird die Annahmequote aus den echten Zahlen in
`daily_metrics` abgeleitet statt geschätzt. Alle Konstanten stehen benannt oben in
`tagespensum.ts`, damit Kevin sie an einer Stelle ändern kann.

---

## SUCCESS-Check (die acht Kriterien)

1. ✅ Jeder Zug nennt die erwartete Beobachtung bei Erfolg **und** Fehlschlag.
2. ✅ Jeder Zug trägt wahrscheinlichsten Fehler, Signal und Gegenzug.
3. ✅ Weggabelungen haben Trigger — Zug 1 (Ziel fehlt), 2 (Spalte fehlt), 3 (leere
   Liste), 5 (fehlende Datenquelle).
4. ✅ Ungeklärtes markiert: R-2 im Ledger, `{{kapazitaet_minuten}}`, `{{dauer_antwort}}`.
5. ✅ Abbruchbedingungen als eigener Abschnitt, fünf Stück.
6. ✅ Verifikation ausbuchstabiert: Fixtures, `tsc`/Build, Screenshots bei zwei
   Größen, Vorher/Nachher-Beweis an `daily_metrics`.
7. ✅ Red-Team gelaufen: fünf Angriffe trafen, alle gepatcht.
8. ✅ Blind ausführbar bis auf L-1 (Kevins Hand am SQL-Editor).

---

## Reihenfolge für den Executor

```
Zug 1 (Pensum + Test) → Zug 2 (Migration schreiben) → L-1 (Kevin) →
Zug 3 (Arbeitsmodus) → Zug 4 (Tracking) → Zug 5 (Kacheln Akquise) →
Zug 7 (Kacheln Liefern) → Zug 6 (Verifikation)
```

Züge 1 und 3 sind unabhängig und können parallel gebaut werden. Kein Commit ohne
Kevins Wort; Deploy weiter über `main`-Fast-Forward.
