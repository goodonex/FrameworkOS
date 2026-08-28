# Wargame — Sales-Canvas v2: Gesamt und Heute trennen

> **STATUS: BLAUPAUSE.** Durchgespielt, nicht ausgeführt.
> Der Vorgänger steht und ist in [`sales-canvas.md`](sales-canvas.md) beschrieben
> (Kartenreihe) bzw. [`pipeline-board.md`](pipeline-board.md) (Baum-Ansicht).
> **Diese Runde reisst nichts davon ab.** Kevins Wort am 28.08.: *„Von der
> Ästhetik her sehr, sehr schön, alles lesbar und mit den Karten hab ich mir
> genauso vorgestellt. […] das sind einfach noch Änderungen, die mir auffallen."*

**Repo:** `~/Kevin OS/02 Projekte/uriel` · **Branch:** `main`
**Nicht pushen** — Livegang ist Kevins Wort.

---

## Der eine Satz

Das Canvas mischt heute zwei Fragen in einer Karte — *„wie viele stecken hier"*
und *„wie viele sind heute dran"* — und beantwortet beide auf 760 px, während
rechts ein Viertel Bildschirm leer bleibt. Diese Runde **trennt die zwei
Fragen räumlich** (Bestand links, Tagesliste rechts), **nutzt die Fläche**, macht
**jede Karte klickbar**, und schliesst die zwei Löcher, die Kevin beim Arbeiten
auffallen: die fehlende Loom-Ja/Nein-Entscheidung und eine Tagesliste, die den
erledigten Tag nicht vergisst.

---

## AUFTRAG AN DEN EXECUTOR — vor dem ersten Edit lesen

**Reihenfolge:** Z0 → Z9, keine Sprünge. Z1 (Fläche) muss vor Z2 (Trennung)
stehen, sonst wird die Trennung in ein Layout gebaut, das gleich danach fällt.

**Nach JEDEM Zug, ohne Ausnahme:**
```bash
cd "$HOME/Kevin OS/02 Projekte/uriel/app" && npx tsc -b && npm run build
```
```bash
cd "$HOME/Kevin OS/02 Projekte/uriel" && for f in scripts/verify-*.ts; do npx tsx "$f" >/dev/null 2>&1 || echo "ROT $f"; done
```
Erwartung: keine Ausgabe (Baseline vom 28.08.: tsc sauber, 62/62 Skripte grün).
Dann **ein Commit je Zug**, deutsche Nachricht mit Typ-Prefix. **Niemals pushen.**

**Vor jedem Edit die Datei frisch lesen.** Zeilennummern hier sind Wegweiser,
keine Wahrheit.

### Die vier Sätze, die dich retten

1. **Keine erfundene Zahl.** Wo Daten fehlen, steht ein Satz — nie 0 %.
2. **Keine zweite Wahrheit.** Rechnest du etwas nach, das es schon gibt, ist der
   Zug falsch. Der 78-Erstnachrichten-Fehler vom 17.08. war genau das.
3. **Die Ästhetik bleibt.** Karten, Farben, Morph-Animation, Panel-Optik sind
   abgenommen. Wer hier neu gestaltet, hat den Auftrag nicht gelesen.
4. **Bei einer Abbruchbedingung: stoppen und melden.** Nicht improvisieren.

### Zwei Züge fassen die Zählwahrheit an

**Z5** (Antworten werden zählbar) und **Z6** (Loom Ja/Nein) ändern, was eine Zahl
im Cockpit *bedeutet*, und brauchen die einzige Migration dieser Runde. Ein
Fehler dort liefert eine plausible falsche Zahl, an der alle 62 Prüfskripte
vorbeilaufen. Beide bekommen ein eigenes Prüfskript, **bevor** die Oberfläche sie
anzeigt.

---

## RECON — was schon da ist (28.08.2026, gegen den laufenden Code geprüft)

| Frage | Antwort | Fundstelle |
|---|---|---|
| Wie breit ist die Sales-Seite? | `maxWidth: 760` auf dem äusseren Div | `pages/SalesDashboard.tsx:1311` |
| Wie breit ist die Nav-Rail? | fest `148px`, kein Einklapp-Zustand | `styles/cockpit.css:638` |
| Wo liegt die Sub-Nav? | `SalesSubNav()`, 8 Einträge, immer offen | `pages/SalesArea.tsx:12` |
| Was rechnet die Karten? | `funnelKarten()` — Bestand + heuteFällig + soll/erledigt | `lib/funnelKarten.ts` |
| Woher kommt das Tages-Soll? | `stufenStaende()` aus `tagesFlow.ts`, wird **gelesen, nie nachgerechnet** | `lib/tagesFlow.ts` |
| Springt die Tagesliste um Mitternacht zurück? | Nein. Tageswechsel ist **4 Uhr** (`METRIK_TAG_WECHSEL_STUNDE`) | `lib/metricsDates.ts:20` |
| Springt sie tagsüber zurück? | Nein, für 3 von 6 Stufen: `sales_tagesportionen` friert das Soll ein (0074), `erledigt_at` merkt den Moment (0075) | `lib/useTagesPortionen.ts` |
| Welche Stufen frieren ein? | nur `erstnachrichten`, `followups`, `looms` | `tagesFlow.ts` → `PORTION_STUFEN` |
| Warum hat „Antworten" kein Soll? | `art: 'frische'`, `feld: null` — es gibt **keine Spalte**, die zählt, wie viele Antworten Kevin heute erledigt hat | `tagesFlow.ts:130` |
| Welche Karten sind klickbar? | genau 6 von 20: die mit Posten-Quelle + 4 Alt-Kacheln | `SalesDashboard.tsx:1082` |
| Wie wird „Loom ja" gesetzt? | **gar nicht in Uriel.** `starred` kommt nur aus dem LinkedIn-Sync und wird nie zurückgeschrieben | `useLinkedinThreads.ts` (kein `starred:`-Write) |
| Gibt es „Loom nein"? | Nein — kein Ereignis-Typ, kein Knopf | `types/db.ts:1193` (`LeadEreignisTyp`) |
| Warum fehlt das Vorschaubild? | `jophielShotUrl()` gibt `null` zurück, sobald der Host nicht `localhost` ist — die Bilder liegen nur auf dem Runner | `lib/jophielApi.ts:41` |
| Gibt es schon einen Storage-Spiegel? | Ja: Bucket `runner-files` + `pushSnapshotKey` (0063) | `runner/index.mjs:1317 ff.` |
| Höchste Migration? | `0080_lead_uebersprungen.sql` — die neue ist **0081** | `supabase/migrations/` |

**Regel aus dem Backlog (L2), gilt hier:** Migrationen ausschliesslich über
`supabase db push`, **nie** im SQL-Editor. Genau das hatte die Historie zerlegt.

---

## Z0 — Baseline festnageln

**Aktion.** `git status` muss sauber sein. Build + 62 Prüfskripte laufen (siehe
oben). Ergebnis notieren.

**Erwartete Beobachtung.** Keine Ausgabe von tsc, keine `ROT`-Zeile.
Am 28.08. war genau das der Fall.

**Wahrscheinlichster Fehler.** Uncommittete Arbeit aus einer parallelen Session
im Baum. **Signal:** `git status` zeigt geänderte Dateien unter `app/src`.
**Gegenzug:** STOPP. Nicht stashen, nicht committen — melden. Es könnte die
Session sein, die gerade an derselben Datei arbeitet.

**Abbruch.** Baseline rot → nichts bauen. Erst die Baseline reparieren, sonst ist
nach Z3 nicht mehr unterscheidbar, wer den Fehler gebaut hat.

---

## Z1 — Die Fläche: das leere rechte Viertel bekommt einen Auftrag

**Kevins Beobachtung.** *„Beim Vollbildschirm hat man so das rechte Viertel ist
einfach leer, ob man das auch einfach noch mitnutzt."* — und dasselbe bei den
gebauten Seiten.

**Die Entscheidung, und warum sie so fällt.** Das leere Viertel wird **nicht mit
mehr Funnel gefüllt**, sondern mit der zweiten Ansicht, die Kevin ohnehin
verlangt. Damit löst ein Zug zwei Beschwerden: Die Fläche wird genutzt, *und*
Bestand und Tagespensum stehen nicht mehr in derselben Karte übereinander.
Verworfene Alternative: ein Umschalter „Gesamt | Heute". Ein Umschalter macht
aus zwei Blicken zwei Klicks und lässt das Viertel weiter leer.

**Aktion.** In `pages/SalesDashboard.tsx` das äussere `maxWidth: 760` durch ein
Raster ersetzen:

```
display: grid
gridTemplateColumns: minmax(0, 1fr) 340px   /* ab 1180px Fensterbreite */
gap: 18
alignItems: start
```
- **Links (Spalte 1):** Kopfzeile, Umschalter Liste/Board, Funnel-Canvas bzw.
  Board, Wartezeiten-Knopf, gebaute Seiten, Tagespensum-Balken, „Neben dem Ritual".
  Die linke Spalte behält für den reinen Kartenstapel `maxWidth: 760` —
  eine 900 px breite Karte mit einer Zahl rechts sieht leer aus, nicht grosszügig.
  **Die gebauten Seiten bekommen die Breite dagegen ganz** (`maxWidth: none`):
  das Grid ist `repeat(auto-fill, minmax(210px, 1fr))` und füllt jede Breite von
  selbst — dort sind mehr Spalten ein echter Gewinn.
- **Rechts (Spalte 2):** die Tagesliste aus Z2, `position: sticky; top: 0`.

Unter 1180 px: eine Spalte, die Tagesliste **oben** (sie ist der Einstieg),
Funnel darunter. Mobil unverändert.

**Wo die Grenze herkommt.** 148 (Rail) + 36 (Padding) + 760 (Karten) + 18 (Gap)
+ 340 (Tagesliste) = 1302. Unter ~1180 wird die linke Spalte schmaler als die
Karten brauchen — dort wird gestapelt. Die Zahl kommt in eine Konstante mit
Kommentar, nicht dreimal ins Markup.

**Erwartete Beobachtung.** Auf 1440×900 stehen Funnel und Tagesliste
nebeneinander, rechts bleibt kein Streifen leer. Beim Verkleinern auf 1100
rutscht die Tagesliste über den Funnel, ohne dass etwas überlappt oder
horizontal scrollt.

**Wahrscheinlichster Fehler.** `position: sticky` klebt nicht.
**Ursache:** Der Scroll-Container ist `.ck-main` (`overflow-y: auto`,
`CockpitShell.tsx:56`), nicht das Fenster — und ein Grid-Item mit
`align-items: stretch` ist so hoch wie die Zeile und hat nichts zum Kleben.
**Signal:** Die rechte Spalte scrollt mit weg. **Gegenzug:** `alignItems: start`
auf dem Grid (steht oben schon) und `top: 0` relativ zu `.ck-main` prüfen.

**Zweiter wahrscheinlicher Fehler.** Die `KachelFenster`-Morph-Animation
(`layoutId`) springt, weil die Karte jetzt in einer schmaleren Spalte sitzt.
**Signal:** Das Fenster wächst aus der falschen Ecke. **Gegenzug:** Nichts tun —
`framer-motion` misst zur Laufzeit. Nur wenn es sichtbar zuckt: `layout="position"`
am Fenster.

**Trigger.** Beobachtest du, dass die rechte Spalte auf 1440 px **kürzer** ist
als 300 px Inhalt (also fast leer wirkt), dann steht dort zu wenig → nimm Route
B: Tagesliste **plus** Anfragen-Zähler und InMail-Welle in die rechte Spalte
(beide wohnen heute in den eingeklappten Balken und gehören zum Tag).

**Abbruch.** Wenn das Grid die Board-Ansicht (`PipelineBoard`, SVG mit fester
Geometrie) zerschiesst und sich das nicht in zwei Edits lösen lässt: linke Spalte
in der Board-Ansicht auf volle Breite, Tagesliste darunter. Melden, nicht raten.

---

## Z2 — Die Trennung: eine Karte beantwortet ab jetzt EINE Frage

**Kevins Beobachtung.** *„Anfrage läuft und dann steht da 337. Vielleicht sollte
man da zwei Ansichten machen, einmal gesamt und dann einmal, was ist jetzt zu
tun? […] hier werden, glaub ich, die zwei versucht zu vermischen und das ist mir
zu viel."*

**Was heute in EINER Karte steht** (`components/sales/FunnelCanvas.tsx`):
Titel · „heute 3 von 20" · Badge „18 dran" · grosse Zahl 182. Vier Zahlen, drei
Bedeutungen, eine Zeile.

**Was danach dort steht.**

*Links, Funnel-Karte — nur Bestand:*
```
Anfrage läuft                                    337
Wartet auf Antwort                               182
```
Kein „dran"-Badge, kein Pensum-Halbsatz, keine gemeinsame Kopfzeile mehr. Die
Karte beantwortet: **wie gross ist dieser Topf.** Klick öffnet die Namensliste
(Z4). Das ist Kevins *„wie viele Leute können wir auf diesem Weg gerade
überhaupt angehen"*.

*Rechts, Tagesliste — nur heute:*
```
HEUTE                                     2 von 6 Stufen

Anfragen              ○   0 von 30
Erstnachrichten       ●   12 von 12
Antworten             ○   0 von 5
Follow-ups            ○   3 von 20
InMails               ○   0 von 5
Looms                 ○   0 von 11
```
Sechs Zeilen, je eine Stufe des Rituals in Kevins fester Reihenfolge
(`TAGES_FLOW`, sein Diktat vom 18.08. — **nicht umsortieren**). Klick auf eine
Zeile öffnet dieselbe Arbeitsliste wie heute die Karte. Das ist Kevins *„null von
vierzig und null von fünf Antworten und null von elf Looms […] am Ende des Tages
elf von elf"*.

**Aktion.**
1. Neue Komponente `components/sales/TagesListe.tsx`. Sie bekommt
   `staende: StufenStand[]` und `onOeffnen(stufeId)` — **sie rechnet nichts.**
   Der Halbsatz „n von m" kommt aus `stand.wert` / `stand.soll`, dieselben
   Felder, die die Karten heute lesen.
2. In `FunnelCanvas.tsx`: `DranBadge` und `pensumText` entfernen, ebenso die
   Gruppen-Kopfzeile „ein Pensum, 3 Texte" (sie existiert nur, weil sich drei
   Karten ein Pensum teilen — das Problem verschwindet mit dem Umzug).
   `funnelGruppen()` in `funnelKarten.ts` wird damit unbenutzt: **stehen lassen**,
   das Prüfskript `verify-funnel-karten.ts` prüft sie, und ein Export weniger ist
   kein Gewinn. Einen Satz in den Kopfkommentar, dass die Oberfläche sie nicht
   mehr braucht.
3. Die drei Follow-up-Karten bleiben als **drei Karten** (drei Texte, Kevins
   Trennung) — aber ohne Pensum-Zahl. In der Tagesliste ist „Follow-ups" **eine**
   Zeile; das Fenster dahinter zeigt die drei Vorlagen wie bisher.

**Erwartete Beobachtung.** Auf einer Funnel-Karte steht **genau eine Zahl**. In
der Tagesliste steht jede Stufe genau einmal. Die Summe der Bestände über alle
Karten (inkl. „Nicht in der Zielgruppe") == `leadZahl` — die Invariante aus
`funnelKarten.ts` gilt unverändert, weil an der Rechnung nichts geändert wurde.

**Wahrscheinlichster Fehler.** Nach dem Entfernen des Badges ist nicht mehr
sichtbar, **welche** Karte heute Arbeit trägt — der Funnel wird zu einer stummen
Bestandsliste, und Kevin verliert den Einstieg, den er hatte.
**Signal:** Beim Draufschauen ist nicht erkennbar, wo man anfängt.
**Gegenzug:** Die Karte behält **einen** Hinweis: Rahmenfarbe `--ck-accent`, wenn
`heuteFaellig > 0` (das gibt es heute schon, Zeile ~200). Eine Farbe ist keine
zweite Zahl.

**Zweiter wahrscheinlicher Fehler.** Die Tagesliste zeigt „0 von 0" für
Stufen ohne Soll und sieht damit erledigt aus, obwohl nichts geprüft wurde.
**Signal:** Alle sechs Ringe grün, obwohl der Tag nicht angefangen hat.
**Gegenzug:** Solange `flow.laedt`, steht `…` statt einer Zahl (dieselbe Regel
wie `zahl()` in `SalesDashboard.tsx:772`). Und `soll === 0` bei einer
Zähler-Stufe heisst **„nichts fällig"**, nicht „0 von 0" — als Wort, nicht als
Bruch.

**Trigger.** Beobachtest du, dass die Antworten-Zeile weiter kein Soll hat
(„nichts fällig", obwohl Antworten warten): das ist erwartet bis Z5. Nicht
reparieren, weitergehen.

---

## Z3 — Einklappen: Nav-Rail und Sales-Sub-Nav

**Kevins Beobachtung.** *„Die Seitenleiste sollte einklappbar sein links."* ·
*„Mach mal bitte dieses ganze LinkedIn, Leads, Listen, Call-Mode, neuer Lead,
Ressourcen, Pipeline — kannst du das einklappbar machen?"*

**Aktion, Teil A — Nav-Rail.**
- `useUiSetting<boolean>('navRailEingeklappt', false)` in `NavRail.tsx`.
  **`=== true` statt Truthiness** — der Wert kommt aus einer Key-Value-Tabelle
  und war dort schon alles Mögliche (die Regel steht wörtlich bei
  `salesBalkenOffen`, `SalesDashboard.tsx:1117`).
- Eingeklappt: `.ck-nav-rail` bekommt `width: 52px`, die Labels gehen auf
  `.ck-nur-vorlesen` (die Klasse existiert, `cockpit.css:659`) — **nicht**
  `display: none`, sonst verliert der Screenreader die Bereichsnamen.
- Der Umschalter sitzt unten in der Rail, mit `aria-expanded` und
  `title="Seitenleiste ein-/ausklappen"`. Mindestens 44 px hoch.
- **Nur am Desktop.** Mobil ist die Rail ein Dock mit fünf Zeichen; ein
  Einklapp-Knopf dort wäre ein sechster Eintrag und drängt Sales aus dem
  Daumenbereich (dieselbe Begründung wie bei `NACHSCHLAGEN`, `NavRail.tsx:38`).

**Aktion, Teil B — Sub-Nav.**
- `SalesSubNav` in `pages/SalesArea.tsx` klappt zu einer Zeile zusammen:
  der **aktive** Eintrag bleibt sichtbar, davor ein `▸`-Knopf.
  Zustand in `useUiSetting<boolean>('salesSubNavOffen', false)`.
- Aufgeklappt: die acht Einträge wie heute.
- **Zugeklappt und man ist auf `/sales`** (dem Dashboard): dann steht dort nur
  „Dashboard ▸" — richtig so. Kevin arbeitet 90 % der Zeit auf dem Dashboard;
  die sieben anderen sind Nachschlagewerk.

**Erwartete Beobachtung.** Eingeklappt springt der Inhalt um ~96 px nach links
und das Grid aus Z1 wird breiter — die Tagesliste bleibt 340, der Funnel
gewinnt. Nach einem Reload steht beides noch so.

**Wahrscheinlichster Fehler.** Die Einstellung überlebt den Reload nicht.
**Ursache:** `useUiSetting` schreibt nach Supabase *und* localStorage; ohne
Login gibt es nur localStorage — und die Prüfung lief in einem Tab ohne Session.
**Signal:** Klappt beim Reload wieder auf. **Gegenzug:** Erst prüfen, ob
eingeloggt. Kein Bug, wenn nicht.

**Zweiter wahrscheinlicher Fehler.** Der Inhalt springt beim Umschalten hart.
**Signal:** Ruckeln, das gegen Kevins „Ruhe schlägt Effekt" geht.
**Gegenzug:** `transition: width 180ms ease` auf `.ck-nav-rail`. Kein
Motion-Wrapper — eine CSS-Transition auf einer Breite ist billiger und ruhiger.

---

## Z4 — Jede Karte klickbar

**Kevins Beobachtung.** *„Mach auf jeden Fall noch mal einen Zug am Ende, wo du
über alles rübergehst und guckst wirklich, jede Station ist alles klickbar."*

**Der Ist-Stand ist ehrlich dokumentiert und trotzdem unbefriedigend**
(`SalesDashboard.tsx:1077`): 6 von 20 Karten öffnen etwas. Die 14 anderen —
Wartet auf Antwort, Instagram, PDF, Postkarte ×2, Anruf ×2, E-Mail,
Wiedervorlage, Ruht, Kunde, Aussortiert, Nicht in der Zielgruppe — zeigen eine
Zahl und tun auf Klick nichts.

**Die Entscheidung.** Sie bekommen **keine erfundene Arbeitsliste** (es gibt für
die stillen Kanäle nicht mal E-Mail-Adressen — `Lead.email` ist leer, das steht
im `DranBadge`-Kommentar). Sie bekommen eine **Namensliste**: wer steckt hier,
mit Headline, Wartezeit und Link auf die Lead-Akte (`/sales/:contactId`, existiert).
Das ist die ehrliche Antwort auf „was steckt hinter der 337" und kostet keine
neue Datenquelle: `funnelLeads` liegt bereits im State.

**Aktion.**
1. Neue Komponente `components/sales/KartenNamen.tsx`: Liste aus
   `{ id, name, headline, faelligAm }`, sortiert nach Wartezeit absteigend,
   virtualisiert ab 200 Zeilen (337 Anfragen sind ein realistischer Fall —
   337 DOM-Knoten in einem Morph-Fenster ruckeln).
2. In `SalesDashboard.tsx`: `zuordnung()` aus `funnelKarten.ts` liefert bereits
   pro Lead genau eine Karten-Id. Eine `Map<FunnelKartenId, FunnelLead[]>` aus
   **demselben Durchlauf** bauen — nicht in einer zweiten Schleife, sonst gibt es
   zwei Wege zur selben Zuordnung. Dafür bekommt `funnelKarten()` einen zweiten
   Rückgabewert, oder — sauberer — eine Schwesterfunktion `funnelLeadsJeKarte()`
   in derselben Datei, die `zuordnung()` teilt.
3. `oeffenbar` fällt weg: jede Karte mit `bestand > 0` ist klickbar. Karten mit
   Arbeitsliste öffnen weiter die Arbeitsliste (Vorrang), alle anderen die Namen.

**Erwartete Beobachtung.** Klick auf „Anfrage läuft · 337" öffnet ein Fenster mit
337 Namen. Die Anzahl im Fenster == die Zahl auf der Karte, **immer** — das ist
die „eine Abfrage, eine Zahl"-Regel, und hier ist sie buchstäblich dieselbe Liste.

**Wahrscheinlichster Fehler.** Die Zahl im Fenster weicht von der Karte ab.
**Ursache:** Die Karte zeigt `bestand`, die Liste wurde aber gegen eine andere
Kadenz oder ein anderes `jetzt` gebaut. **Signal:** „337" auf der Karte, 334 im
Fenster. **Gegenzug:** `jetzt` und `kadenz` als dieselbe Referenz durchreichen;
`funnelLeadsJeKarte()` bekommt **dasselbe** `FunnelEingabe`-Objekt wie
`funnelKarten()`. Ein Prüfskript `verify-funnel-namen.ts` hält fest:
`Summe(Listenlängen) === Summe(Bestände) === leads.length`.

**Zweiter wahrscheinlicher Fehler.** Das Fenster braucht 2–3 s zum Öffnen.
**Signal:** Sichtbare Verzögerung nach dem Klick bei „Anfrage läuft".
**Gegenzug:** Die Map wird in `useMemo` gebaut, nicht beim Klick. Erst wenn das
nicht reicht: Liste auf die ersten 100 kürzen **mit sichtbarer Zeile** „337
insgesamt — die ältesten 100". Ein stiller Deckel ist verboten.

**Abbruch.** Wenn eine Karte auch mit Namensliste nichts Sinnvolles zeigen kann
(denkbar bei `ausserhalb`, wo die Namen nur belegen, dass der Filter greift):
sie darf unklickbar bleiben — aber dann **sichtbar** als Zeile ohne Karten-Optik,
wie heute schon die „Stufen ohne Bestand". Melden, welche das war.

---

## Z5 — Die Tagesliste bekommt ein Gedächtnis für Antworten

**Kevins Beobachtung.** *„Ich will einfach eine Tagesliste haben, dass ich sehe:
null von vierzig und null von fünf Antworten und null von elf Looms, dass ich das
abarbeiten kann und am Ende des Tages seh: elf von elf — und nicht, dass das
wieder neu auf null springt. Das kannst du ja nach zwölf Uhr machen."*

**Was schon stimmt — und Kevin gesagt werden muss.** Der Tag springt **nicht**
um Mitternacht: `METRIK_TAG_WECHSEL_STUNDE = 4`, weil Kevin nachweislich nach
Mitternacht arbeitet (`metricsDates.ts:20`). Und das Soll wird beim ersten
Öffnen **eingefroren** (0074), der Erledigt-Moment festgehalten (0075) — für
`erstnachrichten`, `followups`, `looms`. Fünf von Kevins sechs Zeilen tun also
bereits, was er will.

**Was fehlt: die Antworten-Zeile.** `antworten` ist eine Frische-Stufe
(`art: 'frische'`, `feld: null`): sie fragt *„wartet jemand länger als 24 h"*,
nicht *„wie viele habe ich heute erledigt"*. Es gibt **keine Spalte**, die
Kevins abgearbeitete Antworten zählt (`metrikFeldFuer('antwort') → null`,
bewusst so, `arbeitsmodusTracking.ts:30`). „0 von 5 Antworten" ist damit heute
nicht darstellbar.

**Aktion.**
1. **Migration `0081`** (zusammen mit Z6, eine Migration für die Runde):
   `alter table daily_metrics add column antworten_erledigt integer not null default 0;`
   plus `comment on column`. Kein neues Legacy-Sammelfeld — der Name sagt, was
   drin steht: **von Kevin erledigte** Antworten, nicht erhaltene. Die
   existierende Spalte `antworten_li` bedeutet das Gegenteil (Antworten
   *erhalten*, Kanal-KPI im Tracking) und wird **nicht** umgedeutet.
2. `metrikFelder.ts`: Feld + Label („Antworten abgearbeitet") ergänzen.
   `METRIC_FIELDS` ist die Wahrheit für `urielTools`, Tracking und Prüfskripte —
   eine Stelle.
3. `arbeitsmodusTracking.metrikFeldFuer('antwort')` → `'antworten_erledigt'`.
   Der Kommentar dort („kein neues Feld erfinden, wenn eine Spur auf keins
   passt") wird ersetzt durch die Begründung, warum jetzt eines existiert.
4. `tagesFlow.ts`: `antworten` wird `art: 'zaehler'`, `feld: 'antworten_erledigt'`,
   `standardZiel: null`; `sollFuer()` bekommt den Fall
   `case 'antworten': return anzahl(eingabe.antworten?.warten) + wert`
   (dieselbe „offen + heute erledigt"-Formel wie `erstnachrichten`, damit das
   Soll beim Abhaken **stehen bleibt**). `PORTION_STUFEN` wird um `'antworten'`
   erweitert → das Soll friert ein wie die anderen drei.
5. `verify-tages-flow.ts` um Fixtures für den neuen Fall erweitern.

**Was dabei verloren geht — und warum das richtig ist.** Die Frische-Prüfung
(„keiner wartet länger als 24 h") verschwindet als *Erledigt*-Kriterium. Sie war
klug, aber sie beantwortet nicht Kevins Frage. Der Frische-Hinweis bleibt
erhalten als **Zusatz** an der Zeile: „älteste wartet 31 h" in Akzentfarbe.
`ANTWORT_FRISCHE_STUNDEN` bleibt in Gebrauch, nur nicht mehr als Gate.

**Erwartete Beobachtung.** Rechts steht „Antworten · 0 von 5". Nach einer
abgehakten Antwort: „1 von 5". Nach Reload: unverändert „1 von 5". Kommt um
14 Uhr eine sechste Antwort rein, bleibt das Soll bei 5 (eingefroren) — die
sechste ist Ware für morgen. Um 4:00 Uhr am Folgetag: „0 von n".

**Wahrscheinlichster Fehler.** Die Zahl springt beim Abhaken auf „1 von 4".
**Ursache:** Das Soll wird live nachgerechnet (offen sinkt beim Abhaken um 1),
weil das Einfrieren nicht griff — `sales_tagesportionen` fehlt, oder
`PORTION_STUFEN` wurde erweitert, aber `einzufrierendePortionen()` läuft nur über
`PORTION_STUFEN` und wurde am selben Tag schon ohne `antworten` geschrieben
(`ignoreDuplicates: true` → der erste Stand gewinnt, die neue Stufe fehlt für
heute). **Signal:** genau am Umbautag, danach nie wieder.
**Gegenzug:** Das ist erwartet und harmlos. `sollFuer` fängt es mit
„offen + heute erledigt" ab, die Zeile bleibt trotzdem stabil. **Nicht** die
Zeile von heute löschen, um „sauber" neu einzufrieren.

**Zweiter wahrscheinlicher Fehler.** Migration lokal grün, remote nicht drin.
**Signal:** Auf frameworkos.de steht „nichts fällig" bei den Antworten, lokal
nicht. **Gegenzug:** `supabase migration list` vergleicht lokal/remote —
das ist der Check aus Backlog L2. **Nie** im SQL-Editor nachziehen.

**Abbruch.** Wenn `supabase db push` die Migration nicht annimmt (Verbindung,
Rechte): Z5 zurückrollen, Z6 überspringen, mit Z7 weitermachen und **melden**.
Halb angewendete Migrationen sind genau die Drift, die dieses Projekt schon
zweimal Sessions gekostet hat.

---

## Z6 — Loom: die Ja/Nein-Frage, die es nicht gibt

**Kevins Beobachtung.** *„Dann Antworten — haben wir mehr als dreizehn, nur
Loom-Zusagen haben wir dreizehn. Das heisst, da müsstest du noch mal rüber, da
gibt es die Ja/Nein-Frage irgendwie gar nicht. So: Loom ja oder Loom nein."*

**Was der Code sagt.** `starred` wird in Uriel **nie geschrieben** — es kommt
ausschliesslich aus dem LinkedIn-Sync (`useLinkedinThreads.ts` hat kein
`starred:`-Update; `scripts/leads-sync.ts:391` leitet daraus `loom_zugesagt` ab).
Kevins einziger Weg, „Loom ja" zu sagen, ist: **zu LinkedIn wechseln und den
Stern setzen.** „Loom nein" existiert überhaupt nicht — weder als Knopf noch als
Ereignis-Typ. Eine Antwort, die absagt, bleibt unter „Antwort da", bis Kevin sie
auf „Erledigt" setzt, und ist danach von einer unbeantworteten nicht mehr zu
unterscheiden.

**Warum das die Zahl kostet, die Kevin auffällt.** `leadStation` prüft
`starred && loom_status === 'offen'` **vor** `last_from === 'them'`
(`leadStation.ts:417`). Wer zugesagt hat, steht unter „Loom offen", nicht unter
„Antwort da" — die Trennung stimmt also. Was fehlt, ist der **dritte** Zustand:
geantwortet, entschieden, **nein**. Der fehlt in beiden Zahlen.

**Aktion.**
1. **Migration `0081`** (dieselbe wie Z5): `loom_abgelehnt` in den
   CHECK-Constraint von `lead_ereignisse.typ` aufnehmen. Vorlage ist
   `0080_lead_uebersprungen.sql` — dort steht das Muster, inklusive
   aktualisiertem `comment on column`.
2. `types/db.ts`: `LeadEreignisTyp` um `'loom_abgelehnt'`; `LeadAkte.tsx`
   um das Label („Loom abgelehnt").
3. `leadStation.ts`, im Thread-Zweig **vor** der `starred`-Prüfung:
   Liegt ein `loom_zugesagt` **von Hand** (Ereignis, nicht Stern) nach dem
   letzten `loom_abgelehnt` vor → `loom_offen`. Liegt ein `loom_abgelehnt` nach
   der letzten eingehenden Nachricht → die laute Kette übernimmt
   (`wartet_auf_antwort` bzw. `lauteKette`), **nicht** „Antwort da".
   Das ist dieselbe „jüngstes Ereignis gewinnt"-Logik wie bei `juengsterSprung`
   (`leadStation.ts`, Handkorrektur 0080) — Muster übernehmen, nicht neu erfinden.
4. `components/Arbeitsliste.tsx`: Antwort-Posten bekommen zwei Knöpfe —
   **„Loom ja"** (schreibt `loom_zugesagt`) und **„Loom nein"** (schreibt
   `loom_abgelehnt`). Beide über `leadsQuery.protokolliere()`, das existiert.
   Der bestehende „Erledigt"-Knopf bleibt für Antworten ohne Loom-Bezug.
5. `verify-lead-station.ts` um vier Fixtures: Zusage per Stern · Zusage per
   Hand · Absage · Absage, danach neue Nachricht (→ wieder „Antwort da").

**Erwartete Beobachtung.** Im Antworten-Fenster stehen an jedem Posten drei
Knöpfe. Nach „Loom ja" wandert der Lead beim nächsten Render von „Antwort da"
nach „Loom offen"; beide Zahlen ändern sich um 1, die Summe bleibt gleich. Nach
„Loom nein" verschwindet er aus „Antwort da" und taucht in „Wartet auf Antwort"
auf.

**Wahrscheinlichster Fehler.** Der Stern-Weg und der Hand-Weg widersprechen sich:
Kevin sagt in Uriel „Loom nein", der nächste LinkedIn-Sync sieht den Stern noch
und schreibt erneut `loom_zugesagt` — der Lead springt zurück.
**Signal:** Ein Lead pendelt zwischen „Antwort da" und „Loom offen".
**Gegenzug:** Die Reihenfolge entscheidet, nicht die Quelle: **das jüngste
Ereignis gewinnt.** `leads-sync.ts:391` schreibt `loom_zugesagt` mit dem
Zeitstempel `t.last_message_at` — der ist **älter** als Kevins Absage von eben.
Damit gewinnt die Absage von selbst. **Das muss ein Fixture abdecken**, sonst
ist es Hoffnung statt Logik.

**Zweiter wahrscheinlicher Fehler.** `loom_abgelehnt` wird von der Migration
akzeptiert, aber `scripts/leads-sync.ts` kennt den Typ nicht und wirft beim
nächsten Lauf. **Signal:** Der nächtliche Sync bricht ab.
**Gegenzug:** Der Sync **schreibt** den Typ nicht, er liest nur — prüfen, ob er
irgendwo eine erschöpfende `switch` über `LeadEreignisTyp` hat. Falls ja: Fall
ergänzen, sonst fällt es erst nachts auf.

**Trigger.** Beobachtest du, dass `lead_ereignisse` gar keinen CHECK-Constraint
mehr hat (weil eine frühere Migration ihn ersetzt hat): dann braucht es keinen
Migrations-Teil für Z6 — nur die Typen im Code. `\d lead_ereignisse` klärt das
in einem Befehl.

---

## Z7 — Vorschaubilder auch dort, wo Kevin arbeitet

**Kevins Beobachtung.** *„Bei den gebauten Seiten steht ‚Vorschaubild nur am
Rechner', aber ich bin ja am Rechner. Also sollte ich das auch irgendwo hier
haben."*

**Was wirklich los ist.** Der Satz ist irreführend. `jophielShotUrl()` gibt
`null` zurück, sobald der Host **nicht** `localhost`/`127.0.0.1` ist
(`jophielApi.ts:41`). Kevin schaut auf **frameworkos.de** — dort verbietet der
Browser den Zugriff auf `http://127.0.0.1:4711` als Mixed Content. Es liegt
nicht am Gerät, sondern an der Adresse. Der Kommentar dort begründet das mit
„Dutzende Megabyte" — das stimmt für die Originale, aber der Runner liefert
bereits **verkleinerte JPEGs (~50–75 kB)**, das steht drei Zeilen weiter in
`GebauteSeiten.tsx`.

**Aktion.**
1. `runner/jophiel.mjs` / `runner/index.mjs`: Beim Spiegeln von
   `jophiel_projekte` jedes verkleinerte Desktop-JPEG in den **bestehenden**
   Bucket `runner-files` (0063) legen — Pfad `jophiel/shot/<slug>-desktop.jpg`,
   `upsert: true`. Das Muster liegt in `index.mjs:1317 ff.` fertig da; nicht neu
   bauen.
2. Der gespiegelte `JophielProjekt`-Datensatz bekommt `shotUrl: string | null`
   (die öffentliche Storage-URL). Nur setzen, wenn der Upload geklappt hat —
   eine URL auf ein fehlendes Objekt ist ein toter Bildrahmen, also genau das,
   was der alte Kommentar zu Recht vermeiden wollte.
3. `jophielApi.jophielShotUrl(projekt)` nimmt ab jetzt das **Projekt**, nicht
   den Slug: lokal weiter der Runner-Pfad (schneller, kein Storage-Umweg), sonst
   `projekt.shotUrl`. Fällt beides aus → `null`, und der Ersatztext wird ehrlich:
   **„Noch nicht gespiegelt"** statt „nur am Rechner".
4. Nur Signatur-Änderungen spiegeln (der `pushSnapshotKey`-Vergleich existiert),
   sonst werden zwölf JPEGs im Minutentakt hochgeladen.

**Erwartete Beobachtung.** Auf `localhost:5173` unverändert Bilder. Auf
frameworkos.de erscheinen dieselben Bilder, sobald der Runner einmal gelaufen
ist. Im Netzwerk-Tab: `…supabase.co/storage/v1/object/public/runner-files/jophiel/shot/…`,
Status 200, ~50–75 kB.

**Wahrscheinlichster Fehler.** 400/403 beim Upload.
**Ursache:** Der Runner braucht den `service_role`-Key in `runner/.env` — ohne
ihn sind Graph **und** Status still aus (bekannter Fallstrick dieses Projekts).
**Signal:** Runner-Log zeigt `Storage-Push HTTP 401/403`.
**Gegenzug:** `runner/.env` prüfen. Fehlt der Schlüssel: **melden**, nicht den
anon-Key einsetzen — das wäre ein öffentlich schreibbarer Bucket.

**Zweiter wahrscheinlicher Fehler.** Der Bucket ist nicht öffentlich lesbar, das
Bild lädt nur eingeloggt. **Signal:** 200 lokal, 400 im Inkognito-Tab.
**Gegenzug:** `runner-files` ist laut 0063 bereits so eingerichtet, wie die
App-Dateien es brauchen — den Policy-Stand in 0063 lesen, **bevor** eine neue
Policy geschrieben wird.

**Abbruch.** Wenn der Runner nicht läuft und nicht gestartet werden kann: Z7 ist
nicht verifizierbar. Code committen, **als ungeprüft melden**, weitergehen.
Nicht „müsste gehen" schreiben.

---

## Z8 — Der Durchgang: jede Station wird geklickt

**Kevins Auftrag, wörtlich.** *„Mach auf jeden Fall noch mal einen Zug am Ende,
wo du über alles rübergehst und guckst wirklich: jede Station, ist alles
klickbar, funktioniert alles, macht das alles Sinn — weil wenn ich wieder
zurückkomme, will ich direkt diese Looms rausschicken. Ich hab gar keinen Bock,
mich danach dranzusetzen und zu sehen: ah, das funktioniert noch nicht."*

**Das ist kein Häkchen-Zug, sondern die Abnahme.** Er wird **im Browser
geklickt**, nicht im Code gelesen.

**Voraussetzung.** Kevin muss einmal auf `localhost:5173` eingeloggt sein —
ohne Session lädt keine einzige Zahl. Das ist ein **Blocker**, kein Detail
(siehe LEDGER).

**Die Liste, Punkt für Punkt:**

| # | Station / Element | Erwartung |
|---|---|---|
| 1 | Nav-Rail ein-/ausklappen | Breite ändert sich, Inhalt rutscht, überlebt Reload |
| 2 | Sub-Nav ein-/ausklappen | dito; alle 8 Ziele aufgeklappt erreichbar |
| 3 | Tagesliste, alle 6 Zeilen | jede öffnet ihre Arbeitsliste; Anzahl im Fenster == Zahl in der Zeile |
| 4 | Funnel-Karten, **alle mit Bestand > 0** | jede öffnet Arbeitsliste **oder** Namensliste; Anzahl == Karten-Zahl |
| 5 | „Stufen ohne Bestand" | klappt auf/zu, listet die leeren |
| 6 | „Nicht in der Zielgruppe" | öffnet die Namensliste (Gegenprobe zum ICP-Filter) |
| 7 | Umschalter Liste/Board | Board zeigt dieselben Zahlen wie die Liste |
| 8 | Wartezeiten (Kadenz) | Vorschau rechnet, Speichern ändert die Karten |
| 9 | Antwort-Posten: **Loom ja** | Lead wandert nach „Loom offen", beide Zahlen ±1 |
| 10 | Antwort-Posten: **Loom nein** | Lead verlässt „Antwort da", taucht in „Wartet auf Antwort" auf |
| 11 | Gebaute Seiten | Bild sichtbar; Klick öffnet die Vorschau in neuem Tab |
| 12 | Tagespensum-Balken | klappt auf; Anfragen-Zähler +/− bucht; InMail-Welle öffnet |
| 13 | „Neben dem Ritual" | Projekt-Zeilen öffnen ihr Fenster |
| 14 | Reload auf `/sales` | Tageszahlen unverändert, Einklapp-Zustände unverändert |
| 15 | Fensterbreite 1440 → 1100 → 900 | Umbruch ohne Überlappung, **kein** horizontaler Scroll |

**Ergebnis.** Eine Tabelle mit 15 Zeilen und je einem Wort: `ok` oder was genau
nicht ging. Plus **ein Screenshot** von `/sales` auf 1440 px. Kevins Regel:
„Fertig heisst gesehen."

**Wahrscheinlichster Fehler.** Ein Fenster öffnet leer, obwohl die Karte eine
Zahl trägt. **Ursache:** Karte zeigt `bestand`, Fenster zeigt die Tagesportion
(gedrosselt auf 20). **Signal:** „182" auf der Karte, 20 im Fenster.
**Gegenzug:** Das ist bei Follow-ups **richtig** — dann muss es im Fenster
**stehen**: „20 von 182 — heutige Portion". Ein stiller Unterschied ist der
Fehler, nicht die Drosselung.

**Abbruch.** Findet der Durchgang mehr als drei kaputte Punkte, ist ein früherer
Zug halb fertig. Dann **nicht** einzeln flicken — melden, welcher Zug es ist.

---

## Z9 — Doku nachziehen

`docs/BACKLOG.md` bekommt den Abschnitt „LIVE seit 28.08.2026 — Canvas v2".
`HANDOFF.md`: die `/sales`-Zeile in der Routen-Tabelle. Dieses Dokument bekommt
oben `STATUS: GEBAUT` mit Datum. Migration `0081` in die Historien-Notiz.

**Der Satz, der da hin muss** — damit die nächste Session nicht dieselbe Runde
dreht: *„Der Tag wechselt um 4 Uhr, nicht um Mitternacht. Das Soll wird beim
ersten Öffnen eingefroren. Wer meint, die Tageszahl springe zurück, prüft zuerst
`sales_tagesportionen` für heute."*

---

## LEDGER — was Kevin liefern muss

| Platzhalter | Was fehlt | Ohne das … |
|---|---|---|
| `{{login}}` | Kevin muss sich einmal auf `localhost:5173` einloggen | **Z8 ist nicht durchführbar.** Ohne Session lädt keine Zahl — der Durchgang wäre eine Behauptung. **Der einzige harte Blocker.** |
| `{{runner}}` | Runner läuft (`npm run runner`), `service_role`-Key in `runner/.env` | Z7 baubar, aber nicht verifizierbar |
| `{{supabase}}` | `supabase db push` erreichbar | Z5+Z6 fallen aus; Rest läuft |

**Kein Blocker:** Z1–Z4 laufen ohne all das. Sie sind auch die Züge, die Kevins
Beschwerden am direktesten treffen.

---

## RECON NEEDED

| # | Offene Annahme | Der exakte Check |
|---|---|---|
| R1 | Schaut Kevin auf frameworkos.de oder auf localhost? Z7 ist nur relevant, wenn Erstes. | Ihn fragen. Ist es localhost und trotzdem kein Bild, ist die Ursache eine andere: Runner aus, oder `hatShot === false`. |
| R2 | Hat `lead_ereignisse.typ` noch einen CHECK-Constraint? | `\d lead_ereignisse` — entscheidet, ob Z6 einen Migrations-Teil braucht |
| R3 | Kevins „mehr als dreizehn Antworten" — steht das wirklich falsch, oder sind es 13 Loom-Zusagen **und** getrennt davon n Antworten? | In Z8 Punkt 3+4 gegen die echten Listen zählen. `leadStation` trennt beides sauber; sollte die Zahl trotzdem klemmen, ist es ein Datenproblem (Stern ohne `loom_status`), kein Logikfehler. |
| R4 | Ist `runner-files` öffentlich lesbar? | `0063_runner_files_storage.sql` lesen, bevor eine Policy geschrieben wird |

---

## Abbruchbedingungen (gelten über alle Züge)

1. **Baseline rot** → nichts bauen.
2. **`git status` zeigt fremde Änderungen** → stoppen, melden. Eine andere
   Session könnte an derselben Datei arbeiten.
3. **Eine Zahl auf der Seite hat zwei Rechenwege** → der Zug ist falsch gebaut.
   Zurück, die vorhandene Funktion suchen.
4. **`supabase db push` schlägt fehl** → Z5/Z6 zurückrollen, nicht im
   SQL-Editor nachziehen.
5. **Mehr als drei kaputte Punkte in Z8** → ein früherer Zug ist halb fertig.
6. **Push** → nie. Livegang ist Kevins Wort.

---

## Red-Team — der Angriff auf diese Blaupause

**Angriff 1: „Z2 nimmt Kevin den Einstieg."** Ohne „dran"-Badge ist der Funnel
eine stumme Bestandsliste. — **Durchgekommen.** Patch: Die Akzent-Rahmenfarbe
bleibt als einziger Tageshinweis auf der Karte (in Z2 eingearbeitet).

**Angriff 2: „Z5 zerstört die Frische-Logik."** Die 24-h-Regel war klug. —
**Durchgekommen, aber gewollt.** Sie beantwortet Kevins Frage nicht. Patch: Sie
bleibt als Hinweistext an der Zeile, nur nicht mehr als Erledigt-Gate.

**Angriff 3: „Z6 pendelt gegen den Sync."** — **Gescheitert.** Der Sync stempelt
`loom_zugesagt` mit `last_message_at`, das ist älter als eine Absage von eben.
Jüngstes Ereignis gewinnt. Aber: als Fixture erzwungen, nicht als Hoffnung.

**Angriff 4: „Z4 macht das Fenster mit 337 Namen unbenutzbar."** —
**Durchgekommen.** Patch: `useMemo` + Virtualisierung ab 200 Zeilen, und wenn
gedeckelt wird, dann sichtbar.

**Angriff 5: „Z1 zerschiesst das Board."** Das `PipelineBoard` ist SVG mit
fester Geometrie. — **Durchgekommen.** Patch: eigener Trigger + Abbruch in Z1.

**Angriff 6: „Alles gebaut, nichts geprüft — Kevin sitzt Montag vor einer
kaputten Seite."** — **Gescheitert**, aber nur weil Z8 existiert und `{{login}}`
als harter Blocker im Ledger steht. Ohne beides wäre der Angriff durch.
