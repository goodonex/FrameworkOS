# Wargame — Das Pipeline-Board (Uriel)

> **STATUS: BLAUPAUSE. Noch nichts davon ist gebaut.** Dieses Dokument ist
> durchgespielt, nicht ausgeführt. Der Vorgänger — die senkrechte Kartenreihe —
> steht und ist in [`sales-canvas.md`](sales-canvas.md) beschrieben.

**Executor:** blind ausführbar · **Repo:** `~/Kevin OS/02 Projekte/uriel`
**Branch:** `main` · **Nicht pushen** — Livegang ist Kevins Wort.

---

## Context — was Kevin will und warum die Kartenreihe es nicht ist

Kevins Worte: *„ich möchte visuell das canvas. einmal die komplette pipeline
abbilden, die ich abarbeiten kann, infos rausziehen kann und kleine veränderungen
machen kann. mit so einem canvas könnte man dann auch die conversion mit im bild
sehen und sehen wo optimiert werden muss."*

Am 25.08. wurde `/sales` zur senkrechten Kartenreihe umgebaut. Sie kann das
Abarbeiten — aber sie zeigt **eine Kette**, und Kevins Pipeline ist keine Kette,
sondern ein **Baum**: Nach dem dritten Follow-up gabelt sie sich in den lauten
Zweig (angenommen, nie geantwortet → Instagram → PDF → Postkarte → Anruf) und den
stillen (nie angenommen → E-Mail → Postkarte → Anruf). In einer Liste
untereinander sieht das aus wie neun weitere Schritte derselben Reihe. Es sind
zwei getrennte Äste, und **genau diese Struktur will Kevin sehen**, weil sich
daran entscheidet, wo optimiert wird.

Dazu die Conversion **an den Kanten**, nicht an den Knoten: Nicht „hier stehen
368", sondern „von hier kommen 22 % dort an".

### Kevins vier Entscheidungen (abgefragt am 25.08.)

| Frage | Entscheidung |
|---|---|
| Anordnung | **Fest**, das Board legt an. Kein Drag-and-Drop. |
| Änderbar auf der Fläche | Leads **abarbeiten** · Wartezeiten **justieren** · Leads einzeln **umhängen** |
| Ausdrücklich NICHT änderbar | Nachrichtentexte — Quelle der Wahrheit bleibt der Vault |
| Conversion-Bezug | **Letzte 30 Tage, rollierend** |

---

## Recon — Stand 25.08.2026, an Code und Prod-Daten

**Zeilennummern sind Wegweiser, keine Wahrheit — vor jedem Edit frisch lesen.**

| Vorhanden | Wo | Kann bereits |
|---|---|---|
| **Stationen + Kadenz** | `lib/leadStation.ts` | 14 Stationen, `leadStation()` rechnet die Station aus den Ereignissen. Alle Wartezeiten als Konstanten. |
| **Fälligkeit im Postfach** | `lib/linkedinFollowups.ts` | `bucketOf`/`isDue`, `FOLLOWUP_THRESHOLDS_DAYS = [3,7,14]` |
| **Kartenschicht** | `lib/funnelKarten.ts` | `FUNNEL_BAUPLAN` (20 Karten), `funnelKarten()`, Invariante „ein Lead, eine Karte" |
| **Arbeiten am Knoten** | `components/Arbeitsliste.tsx`, `KachelFenster` in `SalesDashboard.tsx` | Namensliste, Kevins Handgriff, Haken über `erledigePosten` |
| **Einstellbare Werte** | `lib/uiSettings.ts` + `tagesFlow.ts` (`TAGES_FLOW_ZIELE`, `gueltigesZiel`) | **Das Muster für Zug 4 existiert schon** |
| **Lead-Schreibwege** | `hooks/useLeads.ts` | `protokolliere`, `setzeStatus`, `setzeWiedervorlage`, `disqualifiziere`, `reaktiviere` |
| **Bestehende Raten** | `lib/metricsAggregate.ts` → `channelRates()` | Kanal-Raten aus `daily_metrics` für `/tracking` |

### Drei Recon-Ergebnisse, die den Plan bestimmen

**1. Die Fälligkeitslogik lebt NUR im Frontend.** `bucketOf` wird an sechs
Stellen benutzt (`UrielDock`, `arbeitsmodusQuellen` ×3, `leadStation`,
`funnelStufen`, `LinkedinArea`) — **im Runner kein einziges Mal**. Eine
einstellbare Kadenz muss also nirgends zum Runner gespiegelt werden. Das nimmt
dem gefährlichsten Zug die halbe Gefahr.

**2. Die Prüfskripte rechnen MIT den Konstanten, nicht gegen feste Zahlen.**
`verify-lead-station.ts` schreibt `ereignis('anfrage', STILL_EMAIL_TAGE + 1)` —
nicht `ereignis('anfrage', 31)`. Werden die Konstanten zu Vorgabewerten,
bleiben die Tests gültig, solange die Vorgabe unverändert ist.

**3. DIE ERNSTE: Die Ereignis-Historie ist lückenhaft.** Gezählt in Prod:

| Ereignis | Anzahl |
|---|---|
| `anfrage` | 1.225 |
| `angenommen` | 685 |
| `erstnachricht` | 267 |
| **`followup`** | **0** |
| `antwort_erhalten` | 67 |
| `loom_zugesagt` | 28 |
| **`loom_gesendet`** | **0** |
| **`inmail`** | **0** |

Der Grund steht in `scripts/leads-sync.ts:327`: `followup` wird aus dem
**gespiegelten Thread-Verlauf** abgeleitet (zweite Nachricht von Kevin = Follow-up).
Die meisten Threads haben keinen Verlauf, weil der Chrome-Sync im Handbetrieb
läuft. Der Fallback in Zeile 336 kennt nur `erstnachricht`.

Dazu: **Das Abhaken im Cockpit schreibt gar kein Lead-Ereignis.**
`erledigePosten` (`lib/arbeitsmodusTracking.ts`) schreibt `daily_metrics`, den
Thread-Patch und `arbeits_dauern` — `protokolliere` wird nie gerufen.

**Konsequenz für Kevins Conversion-Wunsch:** Eine Rate aus `lead_ereignisse`
wäre für die Follow-up-Stufen **0 %** — und das sähe aus wie eine Katastrophe,
obwohl es „wir messen es nicht" heißt. Das ist die teuerste falsche Zahl, die
dieses Board zeigen könnte, denn sie führt zu genau der Optimierung am falschen
Ende, die das Board verhindern soll.

**4. DIE ERNSTERE: Die erste Rate ist strukturell nicht kohortenfähig.** Gemessen
in `linkedin_netzwerk`: 1.781 Zeilen · 1.096 `offen` · 685 `angenommen` · 1.092
mit `eingeladen_at` · 685 mit `angenommen_at`. Die beiden Mengen überschneiden
sich fast nicht — **wer annimmt, verliert sein Einladungsdatum**, weil LinkedIn
die Einladung aus der Gesendet-Liste nimmt, sobald sie angenommen wurde. Deshalb
fanden sich im Bestand nur **24** auswertbare Paare `anfrage → angenommen`
(Median 8,5 Tage, 80. Perzentil 27).

Das ist kein Datenloch, das sich füllen lässt: Die Information entsteht nie. Eine
kohortengenaue Annahme-Rate („von den Anfragen vom 1. August haben X % angenommen")
ist damit **dauerhaft unmöglich**, egal wie lange gesammelt wird.

**Was stattdessen geht — und es ist gut genug:** eine **Zeitreihen-Rate**.
`daily_metrics.li_anfragen` sagt, wie viele Anfragen an einem Tag rausgingen;
`linkedin_netzwerk.angenommen_at` sagt, wie viele an einem Tag angenommen wurden.
Über 30 Tage: „300 raus, 40 angenommen → 13 %". Die Annahmen gehören zu älteren
Anfragen als dem Nenner, aber solange Kevins Volumen halbwegs gleichmäßig läuft,
misst das genau, was er wissen will: *wirkt meine Anfrage-Strategie gerade?*
**Und `channelRates()` in `lib/metricsAggregate.ts` rechnet bereits so** — Gesetz 2
verlangt, sie zu benutzen statt danebenzurechnen.

---

## Gesetze dieser Runde (verletzen = Abbruch)

1. **Keine zweite Fälligkeitslogik.** `bucketOf` und `leadStation` bleiben die
   einzigen. Das Board liest sie, es rechnet nicht daneben.
2. **Keine zweite Zähl-Wahrheit.** `stufenStaende` und `daily_metrics` bleiben
   die Quelle für „heute erledigt". Keine neuen `daily_metrics`-Felder.
3. **Die Ereignis-Historie wird nie umgeschrieben.** `lead_ereignisse` ist
   append-only, mit Absicht (`useLeads` hat kein `updateEreignis`). Eine
   Korrektur ist ein neues Ereignis — und sie sagt, dass sie eine Korrektur ist.
4. **Keine erfundene Zahl.** Wo die Datenlage keine Rate hergibt, steht „noch
   keine Daten" — nie 0 %.
5. **Genau EINE Migration** (Zug 5, neuer Ereignis-Typ). Wäre eine zweite nötig
   → STOPP.
6. **Eine Mobil-Grenze: 900** (`MOBILE_MAX_WIDTH`). Importieren, nie abtippen.
7. **Nach jedem Zug:** `cd app && npx tsc -b && npm run build` grün, danach alle
   `scripts/verify-*.ts` grün (Stand: 56). Ein Commit je Zug, deutsche Message.
   **Nicht pushen.**
8. **Jede Datei vor dem Edit frisch lesen.**

---

## Die Züge

### Z0 — RECON (nur lesen)

Frisch lesen: `leadStation.ts`, `linkedinFollowups.ts`, `funnelKarten.ts`,
`SalesDashboard.tsx` (Render), `useLeads.ts`, `scripts/leads-sync.ts` (ab Z. 280),
`arbeitsmodusTracking.ts`.

**Erwartete Beobachtung:** `erledigePosten` ruft kein `protokolliere`; die
Ereignis-Zahlen aus der Recon-Tabelle stimmen noch ungefähr.
**Wenn stattdessen** `followup` inzwischen > 0 ist (jemand hat den Verlauf
nachgespiegelt) → gut, Zug 2 wird kürzer; die Kohorten-Regel gilt trotzdem.

---

### Z1 — Die Ereignis-Lücke schließen, BEVOR gemessen wird

Ohne diesen Zug misst das Board Luft. `erledigePosten` bekommt einen weiteren
Schreibweg: **jeder Haken protokolliert auch das Lead-Ereignis.**

- `followup` beim Abhaken eines Follow-up-Postens
- `erstnachricht` bei einer Erstnachricht
- `loom_gesendet` bei einem Loom
- `inmail` beim Buchen einer InMail

**Der Weg muss derselbe bleiben.** `erledigePosten` nimmt seine Schreibfunktionen
schon als Abhängigkeiten entgegen (`bump`, `followupErledigt`, …). Hier kommt
genau eine dazu: `protokolliereEreignis(leadId, typ)`. Kein zweiter Pfad, keine
eigene Hook-Instanz.

**Die Klammer Thread → Lead:** `linkedin_threads.lead_id`. Fehlt sie, wird nichts
protokolliert — **stillschweigend, ohne Fehler**. Ein Lead ohne Verknüpfung ist
kein Grund, den Haken scheitern zu lassen.

**Erwartete Beobachtung:** Ein abgehakter Follow-up erzeugt eine neue Zeile in
`lead_ereignisse` mit `typ: 'followup'`, `quelle: 'ui'`. Gegen Supabase prüfen,
nicht gegen die Anzeige.
**Wahrscheinlichster Fehler:** Doppelte Ereignisse — `leads-sync.ts` leitet
dasselbe Follow-up später noch einmal aus dem Verlauf ab. *Signal:* zwei
`followup`-Zeilen desselben Leads mit fast gleichem `at`.
**Gegenzug:** `leads-sync.ts` dedupliziert bereits über `merke(...)`; prüfen, ob
der Schlüssel `lead_id + typ + at` ist. Wenn ja: der Zeitstempel unterscheidet
sich um Sekunden und die Deduplizierung greift NICHT. Dann in `merke` auf
Tagesgenauigkeit runden — **oder** UI-Ereignisse an `quelle: 'ui'` erkennen und
beim Ableiten überspringen. Zweiteres ist ehrlicher und wird bevorzugt.

**Trigger:** Ergibt die Prüfung, dass `merke` gar nicht dedupliziert →
**Route B:** Zug 1 schreibt vorerst nur `loom_gesendet` und `inmail` (dort gibt
es keine Ableitung aus dem Verlauf, also keine Kollision), und `followup` bleibt
Sache von `leads-sync`. Zug 2 rechnet die Follow-up-Rate dann aus
`linkedin_threads.followup_stage` statt aus Ereignissen.

**Prüfskript `verify-ereignis-schreibung.ts`** (neu): Jede Spur, die ein
Metrikfeld hat, hat auch einen Ereignis-Typ · kein Posten schreibt zwei
Ereignisse · ein Posten ohne `lead_id` schreibt keins und wirft nicht.

---

### Z2 — `funnelRaten.ts`: die Conversion, in drei Sorten

Nach der Recon ist klar: **Eine Rechenart reicht nicht.** Die Datenlage ist je
Kante verschieden, und so zu tun, als wäre sie überall gleich, wäre die Lüge, die
dieses Board wertlos macht. Also drei ausgewiesene Sorten — und die Sorte steht
auf der Fläche mit dabei.

```ts
export type RatenArt =
  /** Zeitreihe: was ging raus / was kam an, je 30 Tage. Nicht kohortengenau. */
  | 'zeitreihe'
  /** Bestand: wie viele von allen sind je durchgekommen. Träge, aber hart. */
  | 'bestand'
  /** Kohorte: dieselben Leads, vorher und nachher. Die beste Sorte. */
  | 'kohorte'

export interface KantenRate {
  von: FunnelKartenId
  nach: FunnelKartenId
  art: RatenArt
  grundgesamtheit: number
  angekommen: number
  /** null heisst NICHT 0 % — es heisst „dafür fehlen die Daten". */
  rate: number | null
  grund: 'zu_wenig_daten' | 'nicht_erfasst' | 'sammelt_noch' | null
}
```

**Welche Sorte wo:**

| Kante | Sorte | Quelle | Warum nicht besser |
|---|---|---|---|
| Anfrage → Annahme | `zeitreihe` | `daily_metrics.li_anfragen` + `linkedin_netzwerk.angenommen_at` | Kohorte **dauerhaft unmöglich**: `eingeladen_at` verschwindet beim Annehmen (Recon 4) |
| Annahme → Erstnachricht | `kohorte` | `lead_ereignisse` | 685 zu 267 — belastbar |
| Erstnachricht → Antwort | `kohorte` | `lead_ereignisse` | 267 zu 67 — belastbar |
| Follow-up-Stufen | `sammelt_noch` | erst nach Zug 1 | heute 0 Ereignisse |
| Antwort → Loom zugesagt | `kohorte` | `lead_ereignisse` | 67 zu 28 — knapp über der Untergrenze |
| Loom zugesagt → gesendet | `sammelt_noch` | erst nach Zug 1 | heute 0 Ereignisse |
| Stiller Zweig (E-Mail/Postkarte/Anruf) | `nicht_erfasst` | — | Kanaldaten sind bewusst leer (`types/db.ts`) |

**Die Kohorten-Falle und ihr Gegenzug.** Wer gestern `angenommen` wurde, kann
heute noch keine Erstnachricht haben. Nimmt man alle 30 Tage als Nenner, sinkt die
Rate, sobald Kevin mehr anfragt — sie misst dann sein Volumen, nicht seine
Qualität. **Deshalb bei `art: 'kohorte'`: Reifezeit abziehen.** In den Nenner
kommen nur Leads, deren Ausgangsereignis mindestens `reifeTage` her ist.

**Reifezeit ist gemessen, nicht geraten:** Median 8,5 Tage, 80. Perzentil 27
(aus den 24 vorhandenen Paaren). Vorgabe **14 Tage** — dazwischen, und identisch
mit der dritten Follow-up-Schwelle. Der Wert steht als Konstante mit diesem
Kommentar an einer Stelle.

**Wo keine Daten sind, steht keine Zahl.** `'sammelt_noch'` für alles, was Zug 1
erst ab jetzt erfasst — auf der Fläche als *„sammelt seit 25.08."*, nicht als
0 %. `'nicht_erfasst'` für den stillen Zweig, wo es nie Daten geben wird, solange
keine Adressen beschafft sind.

**Untergrenze:** Unter **20** in der Grundgesamtheit keine Rate. Bei 3 von 4
stünde sonst „75 %" am Knoten, und die nächste Absage macht daraus 60 %. Eine
Zahl, die bei einem einzelnen Lead um 15 Punkte springt, ist Rauschen mit
Prozentzeichen. (Die Kante Antwort → Loom liegt mit 28 knapp darüber — sie wird
die erste sein, die bei schwacher Woche verschwindet. Das ist richtig so.)

**Erwartete Beobachtung:** Anfrage → Annahme liefert eine Rate um die 10–15 %
(Kevins Erfahrungswert: ~3 Annahmen auf ~30 Anfragen). Annahme → Erstnachricht
und Erstnachricht → Antwort liefern Kohorten-Raten. Alle Follow-up-Kanten liefern
`rate: null, grund: 'sammelt_noch'`. Der stille Zweig `'nicht_erfasst'`.
**Wahrscheinlichster Fehler:** Die Rate übersteigt 100 %, weil ein Lead das
Zielereignis hat, das Ausgangsereignis aber ausserhalb des Fensters liegt.
*Signal:* `angekommen > grundgesamtheit`.
**Gegenzug:** Bei `'kohorte'` kommen Zähler und Nenner aus **derselben
Lead-Menge** — erst die Kohorte bilden, dann darin zählen. Nie zwei getrennte
Abfragen vergleichen. Bei `'zeitreihe'` ist >100 % dagegen **legitim** (an einem
Tag können mehr Annahmen eintreffen als Anfragen rausgingen) — dort wird
gedeckelt angezeigt, nicht abgebrochen. Der Unterschied gehört ins Prüfskript,
sonst schlägt Abbruchbedingung 5 bei gesunden Daten an.

**Trigger:** Liefert `channelRates()` die Annahme-Rate bereits in brauchbarer
Form → **sie benutzen**, nicht nachbauen (Gesetz 2). Nur wenn ihr Zuschnitt nicht
passt (z. B. keine 30-Tage-Fenster), eine eigene Funktion — dann aber mit einem
Kommentar, der sagt, warum die vorhandene nicht reichte.

**Prüfskript `verify-funnel-raten.ts`** (neu): Bei `'kohorte'` gilt
`angekommen <= grundgesamtheit` immer · bei `'zeitreihe'` ist >100 % erlaubt und
wird gedeckelt · Rate zwischen 0 und 1 oder null · unter der Untergrenze null ·
ein Ereignis-Typ ohne Zeilen ergibt `'sammelt_noch'` oder `'nicht_erfasst'`,
**nie** 0 · die Reifezeit greift (Lead mit Annahme von gestern zählt nicht in den
Nenner) · leere Eingabe stürzt nicht ab · **jede Kante des Bauplans hat genau
eine Sorte zugewiesen**.

---

### Z3 — `PipelineBoard.tsx`: die Fläche

Neue Datei `components/sales/PipelineBoard.tsx`. **SVG, keine Bibliothek.** Der
OS-Graph nutzt d3-force auf Canvas-2D, aber das ist für *unbekannte* Strukturen —
hier ist die Struktur bekannt und fest. Ein Kraft-Layout würde eine feste Ordnung
jedes Mal neu auswürfeln, und Kevin hat „fest angeordnet" gewählt.

**Der Bauplan des Baums** ist eine Konstante neben `FUNNEL_BAUPLAN`: je Knoten
Spalte und Zeile, je Kante Start und Ziel. Gerechnete Pixel, kein Handwerk:

```
                  [Anfrage läuft]
                        │
              ┌─────────┴─────────┐
     (nie angenommen)        (angenommen)
              │                   │
      [E-Mail fällig]     [Erstnachricht fällig]
              │                   │
     [Postkarte still]    [Wartet auf Antwort] ──→ [Antwort da] ──→ [Loom offen]
              │                   │
      [Anruf still]        [Follow-up 1→2→3]
                                  │
                          [Instagram fällig]
                                  │
                            [PDF fällig]
                                  │
                         [Postkarte laut]
                                  │
                           [Anruf laut]
```

Je Knoten: Titel, **Bestand groß**, „n dran"-Badge. Je Kante: die Rate aus Zug 2,
oder der Satz aus `grund`.

Styling strikt aus `docs/phase2/DESIGN-TOKENS.md`. Badge-Kontrast: **dunkler Text
auf `--ck-accent`** (`color: var(--ck-bg)`) — `--ck-accent-text` darauf kam am
20.08. auf ~1,1:1.

**Erwartete Beobachtung:** Der Baum steht, die Gabelung ist als Gabelung sichtbar,
die Zahlen stimmen mit der Kartenreihe überein.
**Wahrscheinlichster Fehler:** Auf 390 px Breite wird der Baum zur Briefmarke.
*Signal:* Text unter 11 px oder waagerechtes Scrollen der ganzen Seite.
**Gegenzug:** **Unter `MOBILE_MAX_WIDTH` rendert das Board gar nicht** — dort
bleibt die Kartenreihe aus `sales-canvas.md` stehen. Ein Baum mit zwei Ästen ist
eine Desktop-Ansicht; ihn aufs Handy zu quetschen macht beides schlechter. Die
Kartenreihe ist kein Notbehelf, sie ist die mobile Fassung.

**Trigger:** Passt der Baum auch auf dem Desktop nicht ohne Scrollen (mehr als
~700 px hoch) → die beiden Endstufen jedes Astes (Postkarte, Anruf) zu einem
Knoten „Postkarte + Anruf" zusammenfassen und erst im Fenster trennen.

**Zweiter Fehler:** Die Kanten-Beschriftungen überlappen die Knoten. *Signal:*
Screenshot zeigt Text auf Text. *Gegenzug:* Beschriftung mittig auf der Kante mit
deckendem `--ck-panel` als Hintergrundplättchen, nicht danebengesetzt.

---

### Z4 — Klick auf einen Knoten (Wiederverwendung, kein Neubau)

Klick öffnet **dasselbe `KachelFenster`** wie die Kartenreihe, mit derselben
`Arbeitsliste`. Der Weg ist in `sales-canvas.md` Zug 3 beschrieben und ist
gebaut — hier wird nur ein zweiter Auslöser angeschlossen.

**Achtung `layoutId`:** Das Board und die Kartenreihe zeigen dieselben Stationen.
Trügen beide `canvas-<id>`, geistern sie ineinander (HANDOFF Falle 9, am 25.08.
genau so passiert). Das Board bekommt `board-<id>`.

**Erwartete Beobachtung:** Klick auf „Follow-up 1" öffnet Text + Namensliste,
Haken zählt `li_followups` um genau 1 hoch — und schreibt nach Zug 1 zusätzlich
das Ereignis.
**Wahrscheinlichster Fehler:** Der Haken zählt doppelt, weil Board und Karte
beide gerendert sind und beide ein Fenster öffnen. *Signal:* `li_followups`
springt um 2.
**Gegenzug:** Board und Kartenreihe sind **nie gleichzeitig sichtbar** (Zug 6).
`scripts/verify-arbeitsmodus-tracking.ts` muss grün bleiben.

---

### Z5 — Wartezeiten justieren (der gefährlichste Zug)

Die Kadenz-Konstanten werden zu **Vorgabewerten**, überschreibbar über
`ui_settings` (Schlüssel `kadenz`). Muster: `TAGES_FLOW_ZIELE` in `tagesFlow.ts`,
inklusive `gueltigesZiel`.

```ts
export interface Kadenz {
  followupTage: [number, number, number]   // heute [3, 7, 14]
  stillEmailTage: number                   // 30
  stillPostkarteTage: number               // 7
  stillAnrufTage: number                   // 7
  lautInstagramTage: number                // 7
  lautPdfTage: number                      // 14
  lautPostkarteTage: number                // 21
  lautAnrufTage: number                    // 7
  mindestabstandTage: number               // 7
  ruheMonate: number                       // 4
}
export const KADENZ_STANDARD: Kadenz = { … }   // exakt die heutigen Werte
```

`leadStation(eingabe, jetzt, kadenz = KADENZ_STANDARD)` und
`bucketOf(thread, now, schwellen = FOLLOWUP_THRESHOLDS_DAYS)`. **Vorgabewert
gleich heutiges Verhalten** — deshalb bleiben alle sechs Aufrufstellen und beide
Prüfskripte unverändert gültig.

**Drei Sicherungen, und die dritte ist die eigentliche:**

1. **Grenzen.** Jeder Wert ganzzahlig, 1–365 (`ruheMonate` 1–24). Ausserhalb →
   Vorgabewert. Ein kaputter Wert aus der Key-Value-Tabelle darf die Fälligkeit
   nicht auf `NaN` stellen.
2. **Monotonie.** `followupTage` muss aufsteigend sein. `[14, 7, 3]` würde die
   Stufen gegeneinander laufen lassen. Nicht aufsteigend → Vorgabewert.
3. **Vorschau vor dem Speichern.** Der Schieber zeigt **vorher**, was die
   Änderung bewirkt: *„Heute fällig: 163 → 412 (+249)."* Gerechnet wird sie mit
   `funnelKarten()` gegen die probeweise Kadenz, ohne zu speichern. Das ist der
   Gegenzug gegen „600 Leute auf einen Schlag": Kevin sieht die Zahl, bevor sie
   Wirklichkeit wird, nicht danach.

**Erwartete Beobachtung:** Schieber von 3 auf 5 Tage → die Vorschau nennt eine
kleinere Zahl fälliger Follow-ups; nach dem Speichern stimmen Board und
Kartenreihe überein; nach Reload bleibt der Wert.
**Wahrscheinlichster Fehler:** Ein Aufrufer wird vergessen und rechnet weiter mit
der Vorgabe. *Signal:* Board zeigt 412, die Kartenreihe darunter 163.
**Gegenzug:** Die Kadenz kommt aus **einem** Hook (`useKadenz()`), und alle sechs
`bucketOf`-Stellen beziehen sie daraus. Ein Prüfskript grept den Quelltext:
`bucketOf(` ohne dritten Parameter ist ein Fehlschlag — dieselbe Technik, mit der
`verify-breakpoint.ts` die Mobil-Grenze bewacht.

**Trigger:** Zeigt sich beim Bauen, dass eine Aufrufstelle die Kadenz nicht
erreichen kann (z. B. eine reine Funktion tief in `arbeitsmodusQuellen` ohne
Zugang zum Hook) → **Route B:** Die Kadenz wird beim Laden **einmal** in ein
Modul-Singleton geschrieben (`setzeKadenz()` beim App-Start, wie ein
Konfigurations-Modul), statt sie durch sechs Signaturen zu fädeln. Weniger rein,
aber besser als zwei Wahrheiten.

**Prüfskript `verify-kadenz.ts`** (neu): Ohne Überschreibung liefert
`leadStation` **exakt** dasselbe wie vorher (Fixtures aus `verify-lead-station.ts`
gegengerechnet) · kaputte Werte fallen auf die Vorgabe · nicht aufsteigende
Follow-up-Tage fallen auf die Vorgabe · kein `bucketOf`-Aufruf ohne Schwellen.

---

### Z6 — Lead umhängen, ohne die Historie zu fälschen

**Das Problem:** Die Station wird berechnet, nicht gespeichert. Kevin kann sie
also nicht setzen. Ein nachgetragenes `pdf`-Ereignis würde die Station
verschieben — und behaupten, eine Analyse sei rausgegangen. In sechs Wochen liest
niemand mehr, dass das eine Handkorrektur war. Die Historie wäre unbrauchbar.

**Die Lösung:** Ein eigener Ereignis-Typ, der die Wahrheit sagt.

```
uebersprungen   details: { von: <station>, nach: <station>, grund: <text> }
```

Er behauptet nichts über einen Kanal. Er sagt: *Kevin hat entschieden, diese
Stufe zu überspringen.* `leadStation()` liest ihn und beginnt die Kette ab der
Zielstufe. Die Historie bleibt append-only und ehrlich; `quelle: 'ui'`
unterscheidet ihn ohnehin von allem, was der Sync ableitet.

**Migration 0079** erweitert den CHECK-Constraint um `uebersprungen`. Das ist die
**eine** Migration dieser Runde (Gesetz 5). Über `supabase db push`, **nie** im
SQL-Editor — genau das hatte die Historie schon einmal zerlegt (Backlog L2).

**Erwartete Beobachtung:** Lead per Knopf von „E-Mail fällig" nach „Anruf fällig"
gehängt → neue Zeile in `lead_ereignisse` mit `typ: 'uebersprungen'`; der Lead
steht sofort am neuen Knoten; die Lead-Akte zeigt „übersprungen: E-Mail → Anruf".
**Wahrscheinlichster Fehler:** `leadStation` gerät in eine Schleife oder ignoriert
das Ereignis, weil die Kette rückwärts gelesen wird (`lauteKette` liest von hinten).
*Signal:* Lead steht nach dem Umhängen unverändert da, oder auf einer dritten Station.
**Gegenzug:** `uebersprungen` wird **ganz vorn** ausgewertet, zusammen mit den
Endstationen (`kunde`, `disqualifiziert`, `wiedervorlage`) — vor jeder
Kettenrechnung. Das jüngste `uebersprungen` gewinnt. Als Fall ins Prüfskript.

**Zweiter Fehler:** Kevin hängt rückwärts um (von „Anruf" zurück auf
„Erstnachricht"), und die Kette schiebt ihn sofort wieder nach vorn, weil die
alten Ereignisse noch da sind. *Signal:* Der Lead springt beim nächsten Laden
zurück. *Gegenzug:* Das `uebersprungen`-Ereignis trägt seinen Zeitstempel; die
Kette wertet nur Ereignisse **danach**. Rückwärts umhängen heisst damit „ab jetzt
zählt die Kette neu ab Stufe X" — was genau das ist, was Kevin meint.

**Abbruchbedingung:** Bräuchte es einen zweiten neuen Ereignis-Typ → **STOPP**.
Dann ist der Zuschnitt falsch und gehört besprochen.

---

### Z7 — Umschalten Liste ↔ Board (Gesetz: nie beide gleichzeitig)

Über der Fläche ein Umschalter „Liste · Board", Zustand in `ui_settings`
(`salesAnsicht`). Am Handy fehlt er — dort gibt es nur die Liste (Zug 3).

**Erwartete Beobachtung:** Umschalten wechselt die Ansicht, der Zustand überlebt
den Reload, es ist immer genau eine sichtbar.
**Wahrscheinlichster Fehler:** Ein kaputter `ui_settings`-Wert macht die Seite
leer. *Signal:* weiße Seite.
**Gegenzug:** `wert === 'board' ? 'board' : 'liste'` — nie ungeprüft
destrukturieren, alles Unbekannte ist „Liste".

---

### Z8 — Dokumentation

Dieses Dokument um „Was tatsächlich passiert ist" ergänzen, Eintrag in
`docs/BACKLOG.md` ganz oben, `HANDOFF.md` nur bei Routen-Änderung.

---

## Abbruchbedingungen — stoppen und melden statt improvisieren

1. Ein neues `daily_metrics`-Feld scheint nötig → **STOPP**.
2. Mehr als eine Migration wäre nötig → **STOPP**.
3. Ein zweiter neuer Ereignis-Typ neben `uebersprungen` → **STOPP**.
4. `stufenStaende` oder `sollFuer` müssten geändert werden → **STOPP**.
5. Eine Conversion-Rate der Sorte **`kohorte`** über 100 % oder unter 0 % →
   **STOPP** (Kohorten-Fehler, siehe Zug 2). Bei `zeitreihe` ist über 100 %
   **legitim** — an einem Tag können mehr Annahmen eintreffen als Anfragen
   rausgingen; dort wird gedeckelt angezeigt, nicht abgebrochen.
6. Nach Zug 5 weichen Board und Kartenreihe in einer Zahl voneinander ab →
   **STOPP**. Zwei Wahrheiten sind schlimmer als kein Board.
7. Ein `verify-*.ts` wird rot und der Grund ist nicht in einem Satz erklärbar →
   **STOPP**.

---

## Verifikation

**Nach jedem Zug:**
```bash
cd app && npx tsc -b && npm run build
```
```bash
cd ~/Kevin\ OS/02\ Projekte/uriel && for f in scripts/verify-*.ts; do npx tsx "$f" >/dev/null 2>&1 || echo "ROT $f"; done
```
Erwartung: keine Ausgabe. 56 vorher, nach Zug 6 sind es 60.

**Am Ende, am laufenden Cockpit — gesehen, nicht abgeleitet:**

1. `npm run cockpit:full`, `/sales` öffnen, auf „Board" schalten.
2. **Desktop:** Steht der Baum ohne Scrollen? Ist die Gabelung als Gabelung
   erkennbar? Screenshot.
3. **Zahlen-Gegenprobe:** Jeder Knoten trägt dieselbe Zahl wie die Karte in der
   Listenansicht. Eine Abweichung ist Abbruchbedingung 6.
4. **Kanten:** Wo eine Rate steht, ist sie plausibel; wo keine steht, steht ein
   Satz — nirgends „0 %".
5. **Mobil 390 × 664:** Es erscheint die Kartenreihe, kein gequetschter Baum.
6. **Einen Posten abhaken:** `daily_metrics.li_followups` +1 **und** eine neue
   Zeile in `lead_ereignisse` (`typ: 'followup'`, `quelle: 'ui'`). Beides gegen
   Supabase, nicht gegen die Anzeige.
7. **Kadenz:** Follow-up-Schwelle 3 → 5 Tage. Vorschau nennt die neue Zahl,
   bevor gespeichert wird. Nach dem Speichern stimmen Board und Liste überein.
   **Danach zurückstellen.**
8. **Umhängen:** Einen Lead von „E-Mail fällig" nach „Anruf fällig". Neue Zeile
   `typ: 'uebersprungen'` mit `von`/`nach` in `details`. Der Lead steht am neuen
   Knoten und bleibt dort nach dem Reload.
9. Screenshot an Kevin, nicht ihn testen lassen.

---

## Red-Team-Durchgang

**Angriff 1: „Der Baum ist nur ein hübscheres Layout — den Nutzen bringt die
Conversion, und die Daten dafür gibt es nicht."**
*Traf, und härter als zuerst gedacht.* Erst schien es eine Lücke zu sein, die
Zug 1 schliesst. Die Messung an den Prod-Daten zeigte dann, dass die **erste**
Kante gar nicht schliessbar ist: `eingeladen_at` verschwindet beim Annehmen
(Recon 4). Patch: drei ausgewiesene Ratensorten statt einer, die Sorte steht auf
der Fläche mit dabei, und `'sammelt_noch'` sagt „die Uhr läuft" statt „0 %".
**Ehrlicher Rest-Einwand:** Am ersten Tag zeigt das Board an sechs von neun
Kanten keine Zahl. Wer nur wegen der Conversion baut, baut zu früh — der
Sofort-Nutzen ist die sichtbare Gabelung, die Raten kommen nach.

**Angriff 2: „Kadenz-Schieber sind ein Fußgeschoss. Kevin stellt an einem
Sonntagabend 3 auf 1 und hat Montag 600 fällige Follow-ups."**
*Traf.* Patch: die Vorschau vor dem Speichern (Zug 5, Sicherung 3). Sie ist
nicht Komfort, sondern der eigentliche Schutz — sie macht die Folge sichtbar,
solange sie noch reversibel ist.

**Angriff 3: „Umhängen zerstört die Historie, und in sechs Wochen weiß niemand
mehr, welche Ereignisse echt waren."**
*Traf.* Patch: eigener Typ `uebersprungen` statt eines nachgetragenen
Kanal-Ereignisses. Er behauptet nichts über einen Kanal.

**Angriff 4: „Zwei Ansichten für dieselben Zahlen sind zwei Wahrheiten — genau
das, was Gesetz 3 im letzten Wargame verboten hat."**
*Abgewehrt.* Beide lesen dieselbe `funnelKarten()`-Ausgabe; keine rechnet nach.
Und sie sind nie gleichzeitig sichtbar (Zug 7). Zusätzlich als
Abbruchbedingung 6 verankert.

**Angriff 5: „Das Board rendert 1.788 Leads durch `leadStation` bei jedem
Render."**
*Abgewehrt, aber knapp.* `funnelKarten()` läuft schon heute einmal je Minute
(`jetzt` tickt im Minutentakt), nicht je Render — das wurde am 25.08. beim Bau
der Kartenreihe repariert. Das Board hängt an derselben Ausgabe. **Patch:** Die
Vorschau in Zug 5 rechnet eine ZWEITE Runde über alle Leads, bei jedem
Schieber-Zug. Sie muss entprellt werden (`useDebouncedCallback` liegt im Repo),
sonst friert die Fläche beim Ziehen.

**Angriff 6: „Nach Zug 5 sind die Konstanten Vorgabewerte — die Prüfskripte
rechnen mit ihnen und würden eine falsche Vorgabe mitfeiern."**
*Traf.* Ein Test, der `STILL_EMAIL_TAGE + 1` rechnet, bleibt grün, auch wenn
jemand die Konstante von 30 auf 3 setzt. Patch: `verify-kadenz.ts` prüft die
Vorgabewerte **gegen feste Zahlen** — genau einmal, an einer Stelle, mit dem
Kommentar, warum hier abgetippt wird und sonst nirgends.

---

## LEDGER — offen, bevor der Executor loslegt

| Offen | Wie klären | Blockiert |
|---|---|---|
| ~~Dedupliziert `merke()`?~~ | **Geklärt:** ja, über den Unique-Index `lead_ereignisse_uidx (lead_id, typ, at)` und `on_conflict=…&resolution=ignore-duplicates`. **Aber nur bei identischem `at`** — ein UI-Ereignis mit der Klick-Zeit und ein abgeleitetes mit der Nachrichten-Zeit sind zwei Zeilen. **Route B in Zug 1 gilt: `leads-sync` überspringt beim Ableiten, was `quelle: 'ui'` trägt.** (Der Sync selbst schreibt `quelle: 'backfill'`.) | — |
| ~~Trägt `linkedin_threads` verlässlich `lead_id`?~~ | **Geklärt:** 261 Threads, davon **2** ohne `lead_id` (0,8 %). Die stille Auslassung in Zug 1 ist vertretbar. | — |
| ~~Reifezeit je Kante~~ | **Geklärt:** Median 8,5 Tage, 80. Perzentil 27 (24 Paare). Vorgabe 14 Tage. | — |
| Wie hoch ist der Baum in Pixeln bei 14 Knoten? | Erst nach Zug 3 messbar | Trigger in Zug 3 |
| ~~Liefert `channelRates()` ein 30-Tage-Fenster?~~ | **Geklärt:** Es nimmt beliebige `rows` entgegen, also auch 30 Tage. Aber es misst **Anfrage → Antwort**, nicht Anfrage → Annahme — ein `angenommen`-Feld gibt es in `daily_metrics` nicht, und Gesetz 2 verbietet, eins anzulegen. **Also nicht wiederverwendbar für diese Kante, wohl aber sein Muster** (`rate: null` bei 0 Anfragen) und seine Benchmarks. | — |

**Der Ledger ist sauber. Die Blaupause ist ausführbereit.**

### Nebenfund mit Wert: `channelRates` trägt Benchmarks

`benchMin`/`benchMax` je Kanal — LinkedIn 15–25 %, InMail 10–25 %, Instagram
10–15 %. Das ist genau Kevins *„sehen, wo optimiert werden muss"*: Eine Kante
unter ihrem Benchmark ist der Optimierungspunkt, und die Zahl dafür steht schon
im Repo. **Zug 3 färbt die Kanten danach** — unter Benchmark in `--ck-warn`
(gedämpftes Gold, nie Rot: DESIGN-TOKENS sagt ausdrücklich „nie Rot für
liegt/überfällig"), im Band neutral, darüber in `--ck-accent`. Wo keine
Benchmark-Zahl existiert, bleibt die Kante neutral — **kein erfundener
Richtwert.**
