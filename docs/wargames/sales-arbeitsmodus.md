# Wargame — Vom Nachschlagewerk zum Arbeitswerkzeug

**Erstellt:** 2026-07-29 · **Planer:** Opus 5 · **Executor:** Sonnet (blind ausführbar)
**Branch:** `cockpit-rebuild` · **Repo:** `~/Kevin OS/02 Projekte/uriel`

---

## Mission Brief

Kevins Cockpit zeigt Zustand, nimmt ihm aber keine Entscheidung ab. Seine Worte:
*„Es fühlt sich eher wie ein Nachschlagewerk an, nicht wie ein Tool, in dem ich
arbeite."*

**Was das System können muss — in Kevins Worten (29.07.):**

> „Die müssen nur von oben bis unten abgearbeitet werden." · „Ich kann morgen den
> kompletten Tag zwölf Stunden Sales machen." · „Das Wichtigste ist Kundenarbeit,
> dass die so schnell wie möglich fertig ist und beim Reviewen oder abgegeben ist.
> Und dann kommt Sales." · „Das Programm muss nur auf eine Weise laufen."

**Daraus die vier Gesetze dieses Plans:**

1. **Reihenfolge statt Portion.** Das System sagt, *was als Nächstes dran ist* —
   nicht, wie viel Kevin heute darf. Fertig ist fertig; hat er zwölf Stunden,
   arbeitet er alles ab.
2. **Kundenarbeit vor Sales.** Erst raus, was Kunden schulden. Danach Akquise.
3. **Limits nur, wo sie echt sind.** Siehe Recon: das ist fast nirgends.
4. **Eine Betriebsart.** Kein Sondermodus für den aktuellen Rückstau. Heute große
   Zahlen, in vier Wochen kleine — dieselbe Maschine. Überlauf über ein paar Tage
   ist ausdrücklich in Ordnung und wird **nicht** weggeplant.

**Nicht im Scope (v1):** Verteilung von Aufgaben über mehrere Tage. Kapazitäts-
oder Minutenrechnung. Kalender-gestützte Tagesplanung. Graph-Darstellung der
LinkedIn-Leads. Offene Vernetzungsanfragen als Arbeitsliste (siehe RECON-2).

**Leitplanken:**
- Keine neuen Metrik-Felder erfinden. `METRIC_FIELDS` ist gesetzt.
- Vollbild-Modus **einhändig am Handy** bedienbar: Knöpfe ≥ 48 px, kein Zielen.
- Bestehende Seiten (Pipeline, Listen, Call-Mode, Bibliothek) bleiben unangetastet.
- **Nichts über Zeit rationieren.** Wenn der Executor anfängt, Minuten zu rechnen,
  ist er falsch abgebogen.

---

## Recon-Befunde (verifiziert 29.07.2026, nicht raten)

| Frage | Befund | Konsequenz |
|---|---|---|
| Trichter-Quoten | `app/src/cockpit/lib/goals.ts` → `CONVERSION_TARGETS` (`nachrichtLoom` 0,10–0,20 · `loomQuali` 0,10–0,30 · `qualiKunde` 0,25–0,50) | Quoten-Anzeige rechnet aus diesen Werten. |
| Monatsziel | `MONTH_TARGETS['2026-07'].total = 30000`, Kurve `JULY_2026_CURVE`, Helfer `currentSoll()`, Überschreibung `monthTotalOverride()` | Nie hartkodieren — immer `monthTargetFor()`. |
| Wert je Kunde | `LIFE_TARGET.cashProKunde = 5500` | |
| Tracking | Tabelle `daily_metrics`, Hook `useDailyMetrics()`, 23 Felder in `METRIC_FIELDS`, Upsert vorhanden | Abhaken schreibt **über diesen Hook**. |
| Listen-Quellen | `linkedin_threads` (159 Zeilen, Buckets via `bucketOf`), `linkedin_erstnachrichten` (91 Zeilen) | Beide live befüllt. |
| Loom-Status | **Existiert nicht.** `starred` heißt nur „hat zugesagt" | Neue Spalte → Zug 2. |
| Kundenprojekte | `foundation_tasks` (mit `project_id`), `deliver_projects`, `contacts.stage_changed_at` | Quellen für Zug 6. |
| Dashboard heute | `app/src/cockpit/pages/SalesDashboard.tsx` — Formulare + leere Panels | Wird ersetzt. |
| Runner-Zugriff | `runnerBridge.ts` (`runnerDirekt`, `leseSpiegel`, `beauftrageRunner`) | Nie direkt auf 127.0.0.1. |

### Die einzigen echten Limits (Kevin, 29.07.)

| Spur | Limit | Art |
|---|---|---|
| Vernetzungsanfragen | **30 / Tag** | Kevins eigenes Tagespensum, sein Ritual |
| InMails | **150 Credits** | **Vorrat**, kein Tagesrhythmus — verbraucht sich |
| InMails an offene Profile | **unbegrenzt** | kostet keinen Credit |
| Erstnachrichten, Follow-ups, Antworten | **kein Limit** | gehen an bestehende Kontakte |

**Konsequenz:** Es gibt im ganzen System genau **eine** Rationierungsentscheidung —
wofür die 150 Credits ausgegeben werden. Alles andere wird abgearbeitet, bis es
leer ist. Jede Zeit- oder Kapazitätsrechnung im Plan wäre erfunden.

**RECON-1 (offen, blockiert nicht):** Kevin ist unsicher, ob die 150 Credits ein
Gesamtstand oder ein Monatskontingent sind. Der Executor **rät nicht** — die
Zahl wird als Bestand geführt und die Kachel beschriftet sie neutral („150
Credits übrig"). Klärung: Kevin liest den Stand in LinkedIn nach.

### Die Rechnung — als Anzeige, nicht als Steuerung

30.000 € ÷ 5.500 € = 5,5 Kunden. Rückwärts durch den Trichter, an beiden Enden
von Kevins eigener Zielspanne:

| | Erstnachrichten/Monat | Looms/Monat | nötige Anfragen/Tag |
|---|---|---|---|
| Untergrenze (0,10 / 0,10 / 0,25) | 2.182 | 219 | **347** |
| Zielwert (0,20 / 0,30 / 0,50) | 182 | 37 | **29** |

Kevin schickt **30 Anfragen/Tag**. Das trifft die Zielwert-Zeile punktgenau und
verfehlt die Untergrenze um Faktor 12.

**Das ist die wichtigste Kennzahl im ganzen Cockpit** — sie entscheidet, ob das
Monatsziel erreichbar ist. Sie wird **angezeigt** (Zug 5, Kachel „Quoten"), aber
sie steuert **nichts**. Sie teilt Kevin keinen Tag zu.

---

## Zug 1 — Prioritätenliste (`app/src/cockpit/lib/prioritaet.ts`)

**Aktion:** Reine Funktionen, keine Netzwerkaufrufe, per `tsx` prüfbar. Das Modul
beantwortet **eine** Frage: *In welcher Reihenfolge?*

```
export type Spur =
  | 'kundenaufgabe' | 'kunde_liegt' | 'antwort' | 'loom'
  | 'erstnachricht' | 'followup' | 'anfrage' | 'inmail'
```

`ordnePosten(quellen, heute)` → `Posten[]`, absteigend nach Dringlichkeit.
Die Reihenfolge ist **fest verdrahtet**, kein Ermessen für den Executor:

| Rang | Spur | Begründung |
|---|---|---|
| 1 | `kundenaufgabe` | Kevins Gesetz: erst raus, was Kunden schulden |
| 2 | `kunde_liegt` | Projekt > 14 Tage ohne Bewegung → Follow-up |
| 3 | `antwort` | Jemand wartet auf Kevin. Kühlt am schnellsten ab |
| 4 | `loom` | Lead hat zugesagt — verbindlichster nächster Schritt |
| 5 | `erstnachricht` | Frisch angenommen, solange warm |
| 6 | `followup` | Kühlende Leads |
| 7 | `anfrage` | Tagesritual, füttert den Trichter (30) |
| 8 | `inmail` | Reaktivierung, credit-begrenzt |

**Innerhalb einer Spur:** ältestes zuerst; bei LinkedIn-Threads Sterne vor
Nicht-Sternen (bestehende Sortierung aus `LinkedinArea` übernehmen).

Zusätzlich `tagesstand(metrikZeile)` → `{ anfragenHeute, anfragenLimit: 30,
inmailCredits }` — nur zum **Anzeigen** der Zähler, nicht zum Abschneiden von
Listen.

**Erwartete Beobachtung bei Erfolg:** `npx tsx scripts/verify-prioritaet.ts` gibt
„N/N Fälle korrekt". Fixture prüft mindestens: eine Kundenaufgabe steht über
jeder Antwort; eine Antwort steht über jedem Loom; innerhalb der Antworten steht
die älteste oben; ein Stern-Thread steht über einem gleich alten ohne Stern.
**Bei Fehlschlag:** Reihenfolge weicht ab.

**Wahrscheinlichster Fehler:** Der Executor baut eine Gewichtung oder ein
Punktesystem, weil das „intelligenter" wirkt. **Gegenzug:** Die Rangfolge ist eine
feste Liste. Ein Punktesystem macht die Reihenfolge unerklärbar und ist explizit
nicht gewünscht.

**Zweiter Fehler:** Listen werden auf ein Tagespensum gekürzt. **Gegenzug:** Es
gibt kein Tagespensum. `ordnePosten` gibt **alles** zurück; die Oberfläche zeigt
zunächst die ersten N mit „weitere anzeigen".

**Trigger:** Fehlt eine Quelle (Tabelle nicht migriert), fehlt nur **deren** Spur.
Nie die ganze Liste abbrechen.

**Abbruchbedingung:** Keine Minuten, keine Kapazität, keine Verteilung auf Tage.
Taucht so etwas im Code auf, ist der Zug falsch umgesetzt.

---

## Zug 2 — Migration `0061_loom_status.sql`

**Aktion:**

```sql
alter table linkedin_threads
  add column if not exists loom_status text not null default 'offen'
    check (loom_status in ('offen', 'aufgenommen', 'verschickt', 'entfaellt')),
  add column if not exists loom_erledigt_at timestamptz;

create index if not exists linkedin_threads_loom_idx
  on linkedin_threads (brand_id, loom_status) where starred;
```

**Erwartete Beobachtung bei Erfolg:** `select count(*) from linkedin_threads
where loom_status = 'offen' and starred` gibt **15**.
**Bei Fehlschlag:** PGRST-Fehler „column does not exist".

**Wahrscheinlichster Fehler:** Der Executor pusht selbst. **Verboten** — das
desynchronisiert Kevins Migrations-Historie. **Gegenzug:** Migration nur
schreiben, dann stoppen und Kevin den SQL-Block zum Einfügen in den
Supabase-SQL-Editor geben (so lief es bei 0058/0059/0060).

**Trigger:** Fehlt die Spalte zur Laufzeit → Loom-Kachel zeigt „Migration 0061
ausstehend", alle anderen Kacheln arbeiten normal weiter.

---

## Zug 3 — Arbeitsmodus (`app/src/cockpit/components/Arbeitsmodus.tsx`)

**Aktion:** Vollbild-Overlay, **ein** Posten gleichzeitig, arbeitet die Liste aus
Zug 1 von oben nach unten ab — spurübergreifend, wenn Kevin „alles" startet.

Aufbau von oben:
1. Fortschritt „3 / 47" + dünner Balken. Sonst kein Text.
2. **Name** groß · dahinter **grau** die Firma · darunter **grün** die Website als Link.
3. Der Text (Nachricht, Loom-Skript oder Aufgabenbeschreibung), `white-space: pre-wrap`.
4. Drei Knöpfe, **≥ 48 px**, auf Handy volle Breite:
   `Kopieren` (primär) · `Erledigt` · `Überspringen`.
5. `Esc` / „Schließen" bricht ab, Fortschritt bleibt erhalten.

Nach `Erledigt` automatisch zum nächsten. Nach dem letzten ein Abschlussbild:
was geschafft wurde, plus die aktualisierten Tageszähler.

**Erwartete Beobachtung bei Erfolg:** Screenshot bei 390×664 zeigt Name, Text und
alle drei Knöpfe **ohne Scrollen**; `document.documentElement.scrollWidth ===
clientWidth`.
**Bei Fehlschlag:** Knöpfe unter der Falz oder horizontaler Überlauf.

**Wahrscheinlichster Fehler:** Bekannte Falle aus `App.tsx` — `#app-ui-overlay`
setzt global `pointer-events: none`; ein Vollbild außerhalb der CockpitShell ist
dann tot. **Signal:** Knöpfe reagieren nicht. **Gegenzug:** Overlay mit
`pointerEvents: 'auto'` rendern und **innerhalb** der Shell montieren.

**Zweiter Fehler:** `navigator.clipboard` wirft ohne sicheren Kontext oder ohne
Nutzergeste. **Gegenzug:** `try/catch`; scheitert es, Text markierbar lassen und
„Text markieren und kopieren" einblenden — nie stumm scheitern.

**Dritter Fehler:** `h-svh`-Falle aus der Memory — auf echtem Handy klemmt der
Inhalt hinter der Nav. **Gegenzug:** bei 390×664 prüfen, nicht nur im schmalen
Desktop-Fenster.

**Trigger:** Ist die Liste beim Start leer → Modus gar nicht öffnen, stattdessen
„nichts offen" an der Kachel.

---

## Zug 4 — Abhaken schreibt `daily_metrics`

**Aktion:** Jedes `Erledigt` erhöht **genau ein** Feld über `useDailyMetrics()`:

| Spur | Feld |
|---|---|
| `erstnachricht` | `li_nachrichten` |
| `followup` | `li_followups` |
| `loom` | `looms` (zusätzlich `loom_status = 'verschickt'`) |
| `anfrage` | `li_anfragen` |
| `inmail` | `inmails` |
| **`antwort`** | **keins** |
| `kundenaufgabe`, `kunde_liegt` | keins (kein passendes Feld) |

**Das ist die gefährlichste Stelle des Plans.** Ein falsch gezähltes Feld
verfälscht Kevins Trichter dauerhaft und fällt erst Wochen später auf.

**`antworten_li` zählt die Antworten, die Kevin BEKOMMT** (Trichter-Eingang).
Eine Antwort, die er selbst schreibt, ist keine neue Antwort. Diese Begründung
gehört als Kommentar in den Code, damit sie nicht später „repariert" wird.

**Erwartete Beobachtung bei Erfolg:** Zeile aus `daily_metrics` für heute vor und
nach einem `Erledigt` — genau das erwartete Feld +1, alle anderen unverändert.
**Bei Fehlschlag:** zwei Felder verändert oder `antworten_li` hochgezählt.

**Zweiter Fehler:** Doppelzählung bei Doppelklick oder erneutem Öffnen.
**Gegenzug:** Nur zählen beim Übergang **von** `offen` **auf** erledigt. Ist der
Posten schon erledigt, passiert nichts.

**Abbruchbedingung:** Kein neues Feld in `METRIC_FIELDS`. Passt eine Spur auf kein
Feld, zählt sie nicht — und die UI sagt das.

---

## Zug 5 — Sales-Dashboard als Kacheln (`SalesDashboard.tsx` ersetzen)

**Aktion:** Raster (`repeat(auto-fit, minmax(260px, 1fr))`). Jede Kachel:
**Titel · eine Kennzahl · eine empfohlene Handlung.** Klick vergrößert sie zum
Arbeitsfenster (Overlay), Schließen ordnet sie zurück ins Raster.

**Kacheln — die Reihenfolge ist die Priorität aus Zug 1:**

| # | Kachel | Kennzahl | Handlung |
|---|---|---|---|
| 1 | **Jetzt dran** | „47 offen · zuerst: Kundenaufgabe CoLective" | „Arbeitsmodus starten" (alle Spuren, von oben) |
| 2 | **Kundenarbeit** | offene Aufgaben je Projekt | Link ins Projekt |
| 3 | **Liegt zu lange** | Projekte > 14 Tage ohne Bewegung | „Follow-up entwerfen" |
| 4 | **Antworten** | 38 warten · 12 mit Stern | Arbeitsmodus (`antwort`) |
| 5 | **Looms** | 0 von 15 | Arbeitsmodus (`loom`) |
| 6 | **Erstnachrichten** | 91 offen | Arbeitsmodus (`erstnachricht`) |
| 7 | **Follow-ups** | 63 fällig · 58 Altlasten | Arbeitsmodus (`followup`) |
| 8 | **Vernetzungsanfragen** | **0 von 30** | Arbeitsmodus (`anfrage`) |
| 9 | **Quoten** | Ist gegen Zielspanne je Stufe | Link `/tracking` |
| 10 | **InMails** | 150 Credits · 867 offene Anfragen | Hinweis auf Skill `linkedin-inmail` (RECON-2) |

**Kachel 9 darf beim Bauen nicht nach hinten rutschen** — zwischen Unter- und
Obergrenze der Quoten liegt Faktor 12 in der nötigen Menge. Farbe: unter `min`
warnend, zwischen `min` und `great` neutral, ab `great` positiv.

**Zähler-Regel:** Wo es ein echtes Tageslimit gibt, zeigt die Kachel „X von Y"
(nur Vernetzungsanfragen: 0 von 30). Überall sonst nur die offene Menge — **kein
erfundenes Tagesziel.**

**Erwartete Beobachtung bei Erfolg:** `npx tsc -b` und `npm run build` grün;
Kacheln bei 1280×800 mehrspaltig, bei 390×664 einspaltig ohne horizontalen
Überlauf; **jede** Kachel hat eine Zahl **und** einen Knopf.
**Bei Fehlschlag:** eine Kachel ohne Handlung — dann ist es wieder ein
Nachschlagewerk.

**Wahrscheinlichster Fehler:** Der Executor baut Reiter statt Kacheln, weil das im
Repo häufiger vorkommt. **Gegenzug:** Kevin hat Kacheln ausdrücklich verlangt
(„keine Tabs, sondern Kartenfenster, das größer wird"). Reiter sind hier falsch.

**Zweiter Fehler:** Die Vergrößerung wird als Route gebaut → Zurück-Taste und
Zustand brechen. **Gegenzug:** lokaler State im Dashboard, kein Routing.

**Trigger:** Fehlt eine Datenquelle, zeigt **nur diese** Kachel ihren Leerzustand.

---

## Zug 6 — Kundenarbeit als Quelle (`app/src/cockpit/lib/kundenarbeit.ts`)

**Aktion:** Liefert die Posten für Rang 1 und 2 der Prioritätenliste.

Quellen (alle vorhanden, **nichts Neues modellieren**):
- `foundation_tasks` — offene Aufgaben mit `project_id`
- `deliver_projects` / `contacts.deliver_project_id` — laufende Projekte
- `contacts.stage_changed_at` — wie lange der Zustand steht

**Regel „liegt zu lange"** (Kevins Formulierung: *„die ist seit zwei Wochen im
Review, mach da mal ein Follow-up"*): Projekt ohne Änderung an
`stage_changed_at` **und** ohne erledigte Aufgabe seit **> 14 Tagen**.

**Erwartete Beobachtung bei Erfolg:** Mindestens ein Projekt erscheint mit Alter
in Tagen (CoLective oder Reichentrog).
**Bei Fehlschlag:** leere Liste trotz laufender Projekte → falsche Quelle.

**Wahrscheinlichster Fehler:** Der Executor legt eine neue Projekt-Tabelle an,
weil die Zuordnung Kunde↔Projekt verstreut ist. **Gegenzug:** ausschließlich die
drei Quellen oben. Reicht das nicht, ist es **RECON-3** — melden, nicht
modellieren.

**Abbruchbedingung:** Keine Migration für diesen Zug.

---

## Zug 7 — Verifikation

1. `npx tsx scripts/verify-prioritaet.ts` → „N/N Fälle korrekt".
2. `npx tsc -b` und `npm run build --prefix app` → grün.
3. Screenshots bei **1280×800 und 390×664**: Kachelraster, geöffnete Kachel,
   Arbeitsmodus, Abschlussbild.
4. Metrik-Beweis: `daily_metrics`-Zeile für heute vor und nach einem `Erledigt`
   ausgeben — genau ein Feld +1.
5. Konsole prüfen. **Hinweis:** Hooks-Order-Warnungen direkt nach einem Edit sind
   HMR-Artefakte; erst nach vollem Reload bewerten (kostete am 28.07. Zeit).

---

## Red-Team-Durchgang

| Angriff | Ergebnis | Patch |
|---|---|---|
| „Der Executor baut wieder eine Minuten-/Kapazitätsrechnung, weil das klug wirkt." | **Traf.** | Ausdrückliches Verbot in Leitplanken und Zug 1, plus Abbruchbedingung. |
| „Listen werden auf ein Tagespensum gekürzt, Kevin kann nicht durcharbeiten." | **Traf.** | `ordnePosten` gibt alles zurück; UI zeigt N mit „weitere anzeigen". |
| „Antwort-Spur zählt `antworten_li` hoch und verfälscht den Trichter." | **Traf.** | Zug 4: Antwort zählt nichts, Begründung im Code. |
| „Doppelklick zählt doppelt." | **Traf.** | Nur beim Übergang `offen` → erledigt zählen. |
| „Executor baut Reiter statt Kacheln." | **Traf.** | Kevins Formulierung wörtlich im Plan. |
| „Punktesystem statt fester Rangfolge — Reihenfolge wird unerklärbar." | **Traf.** | Rangfolge ist eine feste Liste, kein Scoring. |
| „Vollbild reagiert nicht auf Klicks." | **Abgewehrt.** | `pointerEvents: 'auto'`, Falle aus `App.tsx` bekannt. |
| „Loom-Kachel bricht die Seite, weil 0061 fehlt." | **Abgewehrt.** | Leerzustand pro Kachel, nie global. |
| „150 InMail-Credits werden als Tageslimit interpretiert." | **Traf.** | Als Bestand geführt, neutral beschriftet, RECON-1 offen. |

---

## Abbruchbedingungen (stoppen und melden, nicht improvisieren)

1. Der Plan verlangt irgendwo eine Zeit-, Minuten- oder Kapazitätsrechnung →
   falsch abgebogen, stoppen.
2. Ein Metrik-Feld passt auf keine Spur → nicht zählen, nicht erfinden.
3. `db push` durch den Executor — verboten. SQL an Kevin geben.
4. Bestehende Seiten (Pipeline, Listen, Call-Mode, Bibliothek) müssten geändert
   werden → nicht im Auftrag.
5. Der Arbeitsmodus bräuchte einen Schreibpfad am `useDailyMetrics`-Hook vorbei.
6. Mehr als eine Kachel zeigt gleichzeitig einen Leerzustand → Datenlage prüfen
   lassen, nicht weiterbauen.

---

## LEDGER — was Kevin liefern muss

| # | Blocker | Was gebraucht wird | Blockiert |
|---|---|---|---|
| **L-1** | Migration 0061 | SQL-Block aus Zug 2 im Supabase-SQL-Editor ausführen | Loom-Kachel |
| **RECON-1** | InMail-Credits | Sind die 150 ein Gesamtstand oder monatlich? Kevin liest den Stand in LinkedIn nach. Bis dahin neutral als Bestand anzeigen | nur die Beschriftung von Kachel 10 |
| **RECON-2** | Offene Vernetzungsanfragen als Liste | Kein Input nötig. Recon 28.07.: Seite serverseitig gerendert, Klassennamen verwürfelt, virtualisiert — 10 von 867 lesbar; ICP-Einstufung existiert nirgends. **Bis geklärt: nur Zahl + Verweis auf `linkedin-inmail`** | Kachel 10 |
| **RECON-3** | Kunde↔Projekt-Zuordnung | Nur falls die drei Quellen in Zug 6 nicht reichen — dann melden statt modellieren | Zug 6 |

---

## SUCCESS-Check (die acht Kriterien)

1. ✅ Jeder Zug nennt die erwartete Beobachtung bei Erfolg **und** Fehlschlag.
2. ✅ Jeder Zug trägt wahrscheinlichsten Fehler, Signal und Gegenzug.
3. ✅ Weggabelungen haben Trigger — Zug 1 (fehlende Quelle), 2 (Spalte fehlt),
   3 (leere Liste), 5 (fehlende Datenquelle).
4. ✅ Ungeklärtes markiert: RECON-1, RECON-2, RECON-3.
5. ✅ Abbruchbedingungen als eigener Abschnitt, sechs Stück — die erste schützt
   ausdrücklich vor der Rückkehr der Kapazitätsrechnung.
6. ✅ Verifikation ausbuchstabiert: Fixtures, `tsc`/Build, Screenshots bei zwei
   Größen, Vorher/Nachher-Beweis an `daily_metrics`.
7. ✅ Red-Team gelaufen: sieben Angriffe trafen, alle gepatcht.
8. ✅ Blind ausführbar bis auf L-1 (Kevins Hand am SQL-Editor).

---

## Reihenfolge für den Executor

```
Zug 1 (Prioritätenliste + Test) → Zug 6 (Kundenarbeit als Quelle) →
Zug 2 (Migration schreiben) → L-1 (Kevin) → Zug 3 (Arbeitsmodus) →
Zug 4 (Tracking) → Zug 5 (Kacheln) → Zug 7 (Verifikation)
```

Züge 1 und 3 sind unabhängig und können parallel gebaut werden. Kein Commit ohne
Kevins Wort; Deploy weiter über `main`-Fast-Forward.
