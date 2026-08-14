# Uriel — Backlog (die eine Quelle der Wahrheit)

**Stand:** 2026-08-14 · Branch `cockpit-rebuild` · Repo `~/Kevin OS/02 Projekte/uriel`

## Runde vom 14.08. — **Die Erstnachrichten standen doppelt in der Liste** (Migration 0071 offen)

Kevins Befund: Die Kachel meldete „144 offen", und im Fenster stand fast jeder
Lead zweimal untereinander.

**Ursache — nicht die Oberfläche, sondern der Schlüssel.** `0060` identifiziert
einen Datensatz über `(brand_id, gruppe, name)`, und der Spiegel im Runner
schreibt mit genau diesem Konflikt-Ziel. Die `gruppe` ist aber keine Identität,
sondern eine Überschrift aus dem Vault. Am 12.08. hieß sie noch „Gruppe 1 —
Erste Charge · 27 Kontakte (raus am 13.07., nur Sabine Keulertz noch offen)", am
14.08. „… (raus 13./14.07.)". Kein bestehender Datensatz passte mehr auf den
Konflikt → der Lauf legte alle 27 Leads der Gruppe erneut an. **145 Zeilen für
118 Leads**, und Roland Wettstein — am 29.07. als gesendet abgehakt — stand als
frischer Lead wieder in der Liste. Die Datei selbst ist sauber (Parser: 118
Leads, 118 eindeutige Namen, 0 Doppel).

| Zug | Ergebnis | Datei |
|---|---|---|
| Schlüssel ohne Gruppe | Unique-Index auf `(brand_id, name)`, alter gruppen-abhängiger Constraint fliegt, Fortschritts-Rettung vorab; Wächter bricht ab, solange Doppel im Bestand liegen | `supabase/migrations/0071_erstnachrichten_schluessel_ohne_gruppe.sql` (neu, **noch nicht gepusht**) |
| Spiegel | `on_conflict=brand_id,name`; fehlt 0071 noch, weicht der Lauf auf das alte Ziel aus statt still auszufallen | `runner/index.mjs` |
| Entdopplung in der Oberfläche | Eine Person, eine Zeile — frischester Spiegel-Stand gewinnt den Inhalt, der weiteste Status wird darauf übertragen | `app/src/cockpit/lib/erstnachrichtenDedup.ts` (neu), `app/src/hooks/useErstnachrichten.ts` |
| Drift-Wache | 12 Fälle, u. a. „abgehakt darf nicht zurückfallen" und „ähnliche Namen bleiben getrennt" | `scripts/verify-erstnachrichten-dedup.ts` (neu) |

Der Hook ist der einzige Zulauf: Kachel, Fenster, Arbeitsmodus und die
Funnel-Stufen hängen alle an `useErstnachrichten().items`.

**Verifikation:** `tsc -b` + `build` grün · neue Drift-Wache 12/12,
`verify-funnel-stufen` weiter 38/38 · Entdopplung gegen die Prod-Zeilen
gerechnet: **145 → 118 Zeilen, 144 → 117 offen**, 0 doppelte Namen, Roland
Wettstein bleibt `gesendet` · Cockpit lokal: Kachel „ERSTNACHRICHTEN 117 offen",
Fenster ohne einen einzigen doppelten Namen.

**Offen — Bestandsdaten.** In der DB liegen weiterhin **27 überzählige Zeilen**
(je Person die ältere). Sie sind nicht gelöscht worden; das Statement liegt in
der Übergabe der Runde. Reihenfolge: erst Schritt 1 aus 0071 (Fortschritt
retten), dann die Bereinigung, dann 0071 erneut `db push` — der Wächter in der
Migration lässt den Schlüssel sonst nicht zu.

## Runde vom 13.08., abends — **Der Morgenbrief sieht jetzt auch nachts** (nur Runner, kein Livegang nötig)

Feinschliff-Audit vor dem Stresstest. Der Befund: Die Zeit-Routine startete den
Morgenbrief mit `{}` — der Skill erwartet aber CRM-/KPI-Daten, die bisher nur
der Cockpit-Knopf mitlieferte. Jeder 7-Uhr-Brief seit dem 31.07. sagte deshalb
„Blindflug, keine Vitals durchgereicht".

| Zug | Ergebnis | Datei |
|---|---|---|
| Input-Baukasten | `baueMorgenbriefInput()` liest contacts, `daily_metrics` (Woche + Monat) und `month_goals` per REST und baut denselben Input wie der Knopf-Pfad (`CockpitHome.tsx`, onRun `morgenbrief`). `sollKumuliert` bewusst weggelassen — die back-loaded Kurve bleibt in `goals.ts`, der Skill behandelt das Feld seit heute als optional | `runner/morgenbriefInput.mjs` (neu) |
| Routine-Anschluss | `maybeMorgenbrief` reicht den gebauten Input durch; scheitert der Bau, läuft der Brief wie bisher ohne Daten | `runner/index.mjs` |
| Drift-Wache | Ziel-Spiegel (`WOCHEN_ZIELE`/`MONATSZIELE`) gegen `goals.ts`, Vitals-Formeln gegen `metricsAggregate.ts`, Follow-up-Teilung gegen den Knopf-Pfad — 37 Fälle | `scripts/verify-morgenbrief-input.ts` (neu) |

**Verifikation:** 35 verify-Skripte grün (34 + neu) · Input live gegen die
Prod-DB gebaut (5 überfällige Follow-ups, Vitals 90/180 Anfragen — deckungsgleich
mit der O2-Messung) · E2E: `POST /run` mit gebautem Input → Brief `done` in 20 s,
mit Namen und Zahlen statt Blindflug (`2026-08-13-224350-morgenbrief.md`) ·
Runner per kickstart auf dem neuen Code.

**Geprüft und bewusst NICHT angefasst:** `ANFRAGEN_LIMIT_TAG = 30` vs.
Wochenziel 180 ist **kein** Widerspruch, sondern dokumentierte Entscheidung
(`goals.ts:26-29` — Kevin schickt in Blöcken, das Tageslimit ist eine andere
Größe als das Wochenziel).

## Runde vom 12.08., zweiter Teil — **Der Funnel-Trichter steht** (nicht live)

Kevins Auftrag: „herausfinden, wie viele Vernetzungsanfragen noch offen sind
(haben noch keine Erstnachricht), wer auf eine Antwort wartet, auf ein Loom,
wer nie angenommen hat und wem ich dann eine InMail schicken kann." Dazu die
Wochenziele, die nicht stimmten. Blaupause: `docs/wargames/funnel-stufen.md`
(Züge F0–F6, D1–D10), **sechs Commits**. `tsc -b` + `build` grün, **33
verify-Skripte grün** (31 vorher; neu `verify-netzwerk-parse` mit 57 Fällen und
`verify-funnel-stufen` mit 32).

### Was jetzt im LinkedIn-Bereich steht (echte Zahlen, 12.08.)

| Kachel | Zahl | Herkunft |
|---|---:|---|
| **Angenommen · ohne Nachricht** | 481 | Kontakt-Sync ⋈ Threads ⋈ Erstnachrichten |
| **Angeschrieben · keine Antwort** | 119 | Threads, getrennt nach schon nachgefasst |
| **Loom zugesagt** | 15 | Stern + `loom_status = 'offen'` |
| **Nie angenommen · InMail** | 876 | Einladungs-Sync, nur aus vollständigen Läufen |

Jede Kachel öffnet die Namensliste (Name, Headline, Alter, Profil-Link),
älteste zuerst. **Die Handerhebung vom 27.07. ist damit eine laufende Zahl
geworden** — sie sagte 880 offene Einladungen, gemessen sind es 876.

### Die Wochenziele (D1, Kevins Wort)

Anfragen **75 → 180**, Nachrichten **75 → 40**, Looms **25 → 10**. Die alten
Zahlen stammten aus dem Split einer Sammel-150 und hatten mit dem echten
Rhythmus nichts zu tun (Blöcke von 65–70 Einladungen an drei Tagen die Woche).
Weil `tagesFlow.ts` durch `ARBEITSTAGE_WOCHE` teilt, drehten die Tagesziele im
Zähler automatisch mit: Nachrichten 15 → **8**, Looms 5 → **2**.

### Vier Befunde, ohne die der Sync nicht liefe

1. **Es gibt keine GraphQL-Query zum Replayen.** Die beiden Netzwerk-Seiten
   feuern beim Nachladen **keinen einzigen** Request — sie rendern aus einem
   Store, den die Seite schon hält. Der Postfach-Sync replayt eine Query, hier
   ist der DOM die Schnittstelle. (RECON R2/R3 der Blaupause, damit beantwortet.)
2. **Chrome drosselt Hintergrund-Tabs.** Der `IntersectionObserver` am
   Listenende feuert dort nie: der Tab scrollte zwanzig Runden brav auf
   Position 476 von 1163 und blieb bei zehn Einträgen. `Page.bringToFront` löst es.
3. **Eine CDP-Verbindung je Aufruf reicht nicht** — zwischen den Runden schläft
   der Tab wieder ein (20 von 882). Eine durchgehend offene Sitzung hält ihn
   wach: **876 von 882 in 92 Runden, vier Minuten.**
4. **PostgREST deckelt bei 1.000 Zeilen.** Kevins Netzwerk hat 1.506. Die
   InMail-Kachel zeigte 370 statt 876 — plausibel und falsch. Der Hook blättert
   jetzt.

Dazu zwei kleinere: die Karte einer Person findet man über eindeutige
Profil-*Ziele*, nicht über Link-Elemente (eine Karte verlinkt dieselbe Person
zweimal — wer Elemente zählt, erntet 622 Namen und null Headlines); und der
Upsert scheiterte an „All object keys must match", weil eine Zeile ihr Datum
weglässt, wenn es nicht lesbar war.

### Die zwei Regeln, an denen die Verlässlichkeit hängt

- **Nur vollständige Läufe ziehen Abwesenheits-Schlüsse** (D4). Wer nicht mehr
  in der Einladungsliste steht, hat angenommen oder wurde zurückgezogen — aber
  das weiss man nur, wenn die Liste zu Ende gelesen wurde. Ein Teil-Lauf
  ergänzt und aktualisiert, er nimmt niemandem seinen Status. Ohne diese Regel
  hätte ein abgebrochener Sync Hunderte fälschlich als „wartet noch" geführt.
- **Mehrdeutige Namen verschwinden nicht still** (D5). Erstnachrichten haben
  keine Profil-URL (Migration 0060); über den Namen allein ist „hab ich dem
  schon geschrieben" nicht beweisbar. Solche Einträge stehen in der Liste, mit
  der Markierung „prüfen".

### Verifikation

Migration **0070** über `db push`, Trockenlauf wollte genau diese eine —
danach 0001–0070 lückenlos in Local und Remote. Netzwerk-Sync live gefahren:
876 offene Einladungen und 630 Kontakte in der Tabelle (per `count=exact`
gegengeprüft). Oberfläche bei 390×664 abgenommen, zwei Namenslisten geöffnet,
Gegenprobe „keine Person steht in zwei Listen" als Testfall.

### Offen aus dieser Runde

- ~~**Kein Sync-Knopf in der Oberfläche.**~~ ✅ **überholt — in derselben Runde
  noch gebaut, am 13.08. gegen den Code geprüft:** Knopf in der Kachel-Leiste
  (`FunnelStufen.tsx:99`, Desktop direkt mit 20-s-Poll; am Handy eine ehrliche
  Ansage statt eines Timeout-Knopfs), Endpunkt `POST /linkedin/netzwerk-sync`
  (`runner/index.mjs:1814`), Auftrags-Pfad `linkedin_netzwerk_sync` über
  `runner_jobs` (`:1370`) und statt des Huckepacks eine **Tages-Routine ab
  7:00** (`maybeNetzwerkSync`, `:2310` — bewusst nicht am Postfach-Sync: der
  läuft oft und eine Minute, dieser fünf).
- **`linkedin-inmail`-Skill** (Vault) zieht seine Namen weiter aus Chrome, nicht
  aus `linkedin_netzwerk` (D8, bewusst eigene Runde).
- **ICP-Feinfilter** bleibt Routine-Arbeit: der Sync speichert roh, „Angenommen
  · ohne Nachricht" heisst deshalb genau das und nicht „ICP offen" (D9).

## Runde vom 12.08. — **Ein Fehlschlag sagt jetzt, warum** (nicht live)

Ausgelöst durch Kevins Beobachtung am Handy: die Agenten-Liste war eine Wand
aus roten „FEHLER"-Zeilen. Sein Wunsch war, statt der Meldungen einfach
nachzuholen, wenn der Mac wieder auf ist.

**Das Nachholen gibt es längst** (O17, 07.08.): der 5-Minuten-Tick startet jede
Tages-Routine, solange heute kein erfolgreicher Lauf vorliegt — im Code steht
wörtlich „Läuft der Mac erst um 9 an, kommt der Brief eben um 9". Die roten
Zeilen waren deshalb **keine verpassten Läufe, sondern echte Fehlschläge**.

### Der eigentliche Befund: seit dem 11.08. lief kein einziger Agent

```
Failed to authenticate: OAuth session expired and could not be refreshed
```

Die Anmeldung der Claude-CLI auf dem Mac ist abgelaufen — direkt reproduziert
mit `claude -p`. Betroffen ist **jeder** Vault-Agent (Morgenbrief,
LinkedIn-Antwort-Entwürfe, dream-check). Die zwei Zeitstempel pro Tag sind die
zwei Versuche, die `MAX_VERSUCHE_PRO_TAG` erlaubt.

**Das kann nur Kevin beheben** (Browser-Login): `claude` starten, `/login`.
Danach läuft es ab dem nächsten Morgen von allein wieder; am selben Tag ist der
Versuchsdeckel bereits erreicht, da hilft der „Ausführen"-Knopf.

**Zweiter Befund, offen:** `linkedin-antwort-entwuerfe` läuft seit dem **04.08.
an jedem einzelnen Tag** ins 10-Minuten-Zeitlimit — 13 von 17 Fehlläufen der
letzten Woche. Der Agent hat also seit über einer Woche kein einziges Mal
geliefert, unabhängig vom Anmeldeproblem. Das ist eine eigene Runde: entweder
das Limit passt nicht zur Aufgabe, oder der Agent braucht einen engeren
Auftrag. **Nicht angefasst, weil es eine Entscheidung ist, keine Aufräumarbeit.**

### Was gebaut wurde

| Zug | Ergebnis | Datei |
|---|---|---|
| **A1** | `laufGrund()` liest den Abbruchgrund aus der Mitschrift und trennt „Kevin muss ran" (Anmeldung) von „erledigt sich selbst" (Netz, Kontingent, Zeitlimit). Beim Zeitlimit steht die Dauer dabei | `runner/laufGrund.mjs`, `scripts/verify-lauf-grund.ts` |
| **A2** | Der Runner liefert den Grund in `/runs` mit — auch in den Supabase-Spiegel, damit das Handy ihn sieht | `runner/index.mjs`, `cockpit/lib/runnerApi.ts` |
| **A3** | Die Liste zeigt den Grund statt „FEHLER"; darüber steht ein Hinweis, wenn Kevin selbst ran muss. Dieselbe Unterscheidung trägt die Warnzeile auf dem Homescreen | `pages/AgentsArea.tsx`, `cockpit/lib/agentenGesundheit.ts` |

**Der Grund wird beim Ausliefern gelesen, nicht beim Schreiben.** Deshalb
sprechen auch die Läufe, die längst im Vault liegen — keine Zeile Bestand
angefasst, keine Migration, kein neues Feld in der Frontmatter.

**Verifikation:** `tsc -b` + `build` grün, **31 verify-Skripte grün** (30
vorher, neu `verify-lauf-grund` mit 33 Fällen; `verify-agenten-kacheln` von 11
auf 19 gewachsen). Gegenprobe an **allen 17 echten Fehlläufen** im Vault: keiner
fällt durch (4× Anmeldung, 13× Zeitlimit). Ende-zu-Ende am laufenden Runner
geprüft — `/runs` liefert den Grund, die Oberfläche zeigt ihn, bei 390×664 ohne
Querscrollen.

## **LIVE seit 11.08.2026, ~22:30 — Mobiler Tages-Flow**

Fast-Forward `ad0a987 → 3d935df` auf `main` gepusht (Kevins Wort), Netlify hat
deployt. **9 Commits**, genau die Runde unten — zwischen `origin/main` und dem
Arbeitsbranch lag nichts Fremdes.

**Beleg am ausgelieferten Bundle** (`index-mmfmDw1y.js`, CSS
`index-DOPzdSz4.css`): elf Marken dieser Runde nachweisbar — „Stufe steht.",
„Der Tag steht.", „Alle fünf Stufen sind durch.", „Reaktivierung · InMails",
„Nie angenommene Anfragen", „Chats ohne Antwort", „Antworten und
Erstnachrichten", „Analysen aufnehmen und rausschicken", „Heute ist nichts
fällig", `ck-flow-punkt`, „Anfragen zählen"; im CSS zusätzlich `ck-ring-glas`
und `ck-zaehl-uebergang`. **Gegenprobe bestanden:** „noch keine Messwerte" und
`kachel=vernetzungsanfragen` sind aus dem Prod-Bundle verschwunden. Die Routen
`/`, `/cockpit`, `/tracking/zaehlen` und `/tracking/zaehlen/inmails` antworten
200.

**Noch nicht am Gerät gesehen.** Die Abnahme lief im Browser bei 390×664 mit
echter Session — die Zahlen sind also echt, das Gerät ist es nicht. Der
Daumen-Test am iPhone (Wischen durch die Kette, Auto-Advance) steht aus.

### L1 · Production-Branch — ✅ **geprüft 11.08.2026, nicht mehr ungeprüft**
`netlify api getSite` sagt: `repo_branch = main`, `stop_builds = false`, Repo
`github.com/goodonex/uriel`, Base `app`, Publish `dist`, Command
`npm run build`. Damit ist der Vorbehalt aus dem Livegang-Abschnitt („steht
nicht in `netlify.toml`, **ungeprüft**") erledigt: ein Push auf `main` löst den
Produktions-Build aus, und genau das ist hier passiert.

## Runde vom 11.08. — **Mobiler Tages-Flow gebaut**

Aus dem einen Ring auf dem Homescreen sind **fünf Stufen in fester
Reihenfolge** geworden: Anfragen → Nachrichten → Looms → Follow-ups (Riege 1) →
Reaktivierung (Riege 2, InMail-Welle). Wischbare Kette im Hero, ein Tipp öffnet
den Zähl-Modus für genau diese Stufe, und steht eine Stufe, schiebt der Zähler
selbst weiter. Züge Z0–Z7 der Blaupause
(`~/.claude/plans/twinkly-baking-locket.md`), **sieben Commits** auf
`cockpit-rebuild`. `npx tsc -b` + `npm run build` grün, **30 verify-Skripte
grün** (29 vorher, neu `verify-tages-flow` mit 75 Fällen; `verify-zaehl-modus`
von 28 auf 46 Fälle gewachsen). **Seit dem Abend live** — siehe oben.

| Zug | Ergebnis | Datei |
|---|---|---|
| **Z1** | `lib/tagesFlow.ts`: die fünf Stufen, ihre Ziele, das dynamische Soll. Reine Funktionen, keine React-Importe, kein Schreibweg | `cockpit/lib/tagesFlow.ts`, `scripts/verify-tages-flow.ts` |
| **Z2** | Die Zähl-Liste beginnt mit dem Flow in seiner Reihenfolge; `inmails` ist als fünfte Stufe **erstmals zählbar**. Ziele und lange Namen kommen aus `tagesFlow`, nicht aus einer zweiten Zahlenreihe | `cockpit/lib/zaehlFelder.ts` |
| **Z3** | Auto-Advance im Vollbild (D5): „Stufe steht." mit Ansage → nach 0,8 s die nächste offene Stufe; nach der letzten bleibt „Der Tag steht." stehen. Die Follow-up-Stufe zeigt ihr echtes Soll | `cockpit/pages/ZaehlModus.tsx`, `cockpit/lib/useTagesFlow.ts` |
| **Z4** | Die Kette im Hero: ein Ring je Stufe auf der `.ck-widget-stack`-Bahn, die seit O18 ungenutzt herumlag; Punkte darunter zeigen den Tagesstand ohne Wischen | `components/home/TagesFlowStack.tsx`, `HeroHorizont.tsx`, `pages/UrielHome.tsx` |
| **Z5** | Das Halten auf der Sales-Kachel führte mobil noch in den alten `AnfragenZaehler` — jetzt in den Zähl-Modus. Desktop-`/sales` unangetastet | `pages/UrielHome.tsx` |
| **Z6** | „209 offen · noch keine Messwerte" heisst nur noch „209 offen" (D8), dazu der Scrim-Fix der Zeile über dem Foto | `cockpit/lib/tagesansage.ts`, `styles/cockpit.css` |

**Die Zählwahrheit ist unangetastet.** Jeder Tipp geht weiter durch
`useDailyMetrics().bump()`; der Flow liest nur. Und er erfindet keine
Fälligkeit: wie viele Follow-ups heute dran sind, sagt weiterhin
`linkedinFollowups.bucketOf` über `arbeitsmodusQuellen.followupPosten` — die
Home reicht dafür `quellen.followup` durch, das `usePosten` ohnehin hält. Kein
zweiter Ladelauf, keine Migration, kein Runner-Umbau.

**Die Tagesziele werden abgeleitet, nicht abgetippt:** 15 Nachrichten und
5 Looms sind `WEEK_TARGETS` geteilt durch die fünf Arbeitstage, die 30 Anfragen
weiterhin `ANFRAGEN_LIMIT_TAG`. Die Reaktivierung hat kein Wochenziel im Code
und steht als benannte Konstante (5) — überschreibbar über `ui_settings`
(Schlüssel `tagesFlowZiele`), ohne Migration. Ein kaputter Wert dort fällt auf
den Standard zurück, statt eine Stufe für immer offen zu halten.

### Vier echte Fehler, die diese Runde gefunden hat

1. **Die Kette blieb auf einer längst erledigten Stufe stehen.** Der
   Einstiegs-Sprung verbrauchte seinen einen Schuss im Ladezustand — da stehen
   alle Zähler auf 0, also galt Stufe 1 als offen. Dazu flackert der
   Ladezustand (mehrere Quellen werden nacheinander fertig), und bei jedem
   Wechsel zieht das Scroll-Snap die Bahn auf die erste Seite zurück.
2. **Der Frame-Weg dagegen war messbar wirkungslos.** Weil die Stände bei jedem
   Render eine neue Referenz bekommen, räumte der Effekt seinen eigenen
   `requestAnimationFrame` jedes Mal weg — **null Ausführungen** im laufenden
   Cockpit gemessen. Jetzt `useLayoutEffect` ohne Frame, mit „sitzt schon"-Prüfung.
3. **QuickTrack hätte die InMails zweimal gezeigt** — einmal vorne über die
   geteilte Liste, einmal hinter „alle anzeigen". Zwei Knöpfe auf dasselbe
   `daily_metrics`-Feld; die Liste filtert das jetzt selbst weg.
4. **Die Punkte unter der Kette waren nicht zu lesen.** Die Farbe trug „steht"
   und „hier" zugleich. Jetzt sagt die Farbe, ob die Stufe steht, und ein Ring
   sagt, wo man ist.

### Verifikation (am laufenden System, eingeloggt, 390×664)

Alle fünf Stufen mit Kevins echten Zahlen durchgewischt: Anfragen 30/30
(„Steht."), Nachrichten 0/15, Looms 0/5, **Follow-ups 0/61** — das dynamische
Soll, also die tatsächlich heute fälligen Threads —, Reaktivierung 0/5. Der
Einstieg rückt zuverlässig auf die erste offene Stufe (zehn Messungen in Folge
Seite 2), und nach der ersten Berührung bleibt die Bahn, wo der Daumen sie
hinlegt (acht Messungen in Folge Seite 5). Auto-Advance am echten Zähler
belegt: „Stufe steht. / Weiter zu Nachrichten", danach steht der Zähler auf
„Stufe 2 von 5 · Nachrichten" — der Sprung sucht also nach der letzten Stufe
von vorn weiter. Kein Querscrollen (390 == 390), alle Touch-Ziele 44×44, ein
voller Durchlauf durch alle fünf Stufen ohne eine einzige Warnung in der
Konsole.

**Ehrlich zum Test-Eingriff:** Für den Auto-Advance musste einmal echt gezählt
werden. Dafür lag kurzzeitig ein Ziel von 1 bzw. 2 für die Reaktivierungs-Stufe
im localStorage; die zwei gebuchten InMails sind über `/tracking` wieder
abgezogen worden, `inmails` steht wie vorher auf **0**, und die
Ziel-Überschreibung ist gelöscht. In `ui_settings` (Supabase) wurde dabei nichts
geschrieben.

**Ehrlich zu den Screenshots:** Die Abnahme-Bilder liegen in Kevins Sitzung, nicht
als Datei im Repo. Ein Datei-Export der eingeloggten Ansicht hätte bedeutet,
das Supabase-Session-Token aus dem Browser in ein Skript zu reichen — das ist
bewusst unterblieben. Ohne Session zeigt ein Skript-Screenshot nur die
Anmeldeseite und wäre als Beleg wertlos.

### Was diese Runde bewusst NICHT angefasst hat

- **Per-Person-Tracking gesendeter Vernetzungsanfragen** („angenommen ja/nein")
  gibt es nirgends (dokumentiert an `urielTools.ts:189`). Riege 2 läuft deshalb
  als reine Zähl-Stufe über `inmails`; die Namensliste bleibt LinkedIn/Sales
  Navigator. Das ist ein eigener Brocken, kein Nebenbei.
- **Der `AnfragenZaehler` lebt weiter** — über `/sales` mit
  `?kachel=vernetzungsanfragen` (mobil als Vollbild, `SalesDashboard.tsx:650`).
  Nur der Weg vom Homescreen führt nicht mehr dorthin. Ob die Kachel selbst auf
  den Zähl-Modus zeigen soll, ist eine Entscheidung, keine Aufräumarbeit.
- **`li_nachrichten` zählt den LinkedIn-Anteil**, das abgeleitete Wochenziel
  (75) deckt LI und IG zusammen ab. 15 am Tag ist damit die strengere Lesart —
  wenn das falsch gerechnet ist, ist `ARBEITSTAGE_WOCHE` bzw. das Ziel in
  `tagesFlow.ts` die eine Stelle dafür.

## **LIVE seit 10.08.2026, ~19:10 — Phase 2 komplett**

Fast-Forward `fc6f1b5 → fff3118` auf `main` gepusht (Kevins Wort), Netlify hat
deployt. **24 Commits**, 83 Dateien.

**Beleg am ausgelieferten Bundle** (`index-UUyMJUxE.js`, CSS
`index-LnM_7L1j.css`): `<title>Uriel — Cockpit</title>` und
`theme-color #0c130e` stehen im HTML; im JS nachweisbar „Frag Uriel — oder halt
zum Sprechen.", „Pipeline (klassisch)", „Die alte Pipeline.", „Geparkt: wird
mit dem Ads-Start", „Überfällig seit", „klappt LinkedIn zusammen",
„Ressourcen"; im CSS `#0c130e`, `ck-hero-foto`, `ck-nur-vorlesen`,
`ck-zeile-karte`, `ck-karten-titel`, `portal-gold`, `Instrument Serif`.
**Gegenprobe bestanden:** „JetBrains Mono" ist aus dem Bundle verschwunden.
Routen `/`, `/cockpit`, `/sales/leads`, `/content`, `/portal/login` antworten
200; die neuen Assets ebenfalls (`/ambient/horizont.jpg` 55 KB,
`/icon-512.png`, `/favicon.svg`, `/site.webmanifest`).

**Zwei Treffer in der Gegenprobe, die bewusst stehen bleiben:** „Brand OS"
kommt genau einmal vor — in `OnboardingPublicPage` (Entscheidungspunkt 9,
ausserhalb von D12). Und `#34d399` steht in `lib/coachPipelines.ts`, den
Stufen-Farben der Glass-Pipeline, die nach dem Paritäts-Entscheid ohnehin zur
Debatte steht (Entscheidungspunkt 7).

**Noch nicht mit echten Daten gesehen.** Alle Screenshots und Prüfungen liefen
ohne Supabase-Session gegen Leer- bzw. Demo-Zustände. Die erste eingeloggte
Session ist die eigentliche Abnahme — vor allem Lead-Liste, Lead-Detail und
das Portal mit echtem Projekt.

## Runde vom 10.08., dritter Teil — Phase 2, **Etappen B und C gebaut**

Damit ist die Blaupause `docs/wargames/phase2-haptik.md` **komplett gefahren**:
Etappen A, B und C, zusammen **22 Commits** auf `cockpit-rebuild`, 83 Dateien.
`npx tsc -b` + `npm run build` grün, **25 verify-Skripte grün** (24 vorher, neu
`verify-linkedin-content`). **Der Fast-Forward auf `main` bleibt Kevins Wort.**

### Etappe B — Sales nach Close-Vorbild (O14)

| Zug | Ergebnis |
|---|---|
| **B0** | Paritäts-Karte der Altwelt: `docs/phase2/sales-paritaet.md`, 24 Funktionen kartiert |
| **B1/B3** | Neue Lead-Liste `/sales/leads`: Smart Views (Heute fällig · Überfällig · Diese Woche · Ohne Follow-up · Im Deal), Inline-Filter, dichte Zeilen, „Nach Stufe" gruppiert (D7 — kein Kanban-Zwang) |
| **B2** | Lead-Detail in Close-Anordnung: Timeline mittig, Stammdaten in der Seitenspalte rechts, Kopf in Cockpit-Grammatik |
| **B4** | „Bibliothek" heisst „Ressourcen" und liegt zweifach: als Bereich und als Panel am Lead (D8) |
| **B5** | Call-Mode trägt das Insel-Banner (D6), sonst unangetastet |
| **B6** | Listen-Import hängt auch an der neuen Liste — derselbe Drawer (D9) |
| **B7** | **Abbruch statt Abriss** — siehe unten |

**B7 ist bewusst nicht ausgeführt worden.** Neun Funktionen der Altwelt haben
im Neubau keinen Ersatz: Kanban zum Ziehen, die fünf Ansichts-Modi,
Mehrfachauswahl mit Bulk-Aktionen, Schnell-Erfassung, E-Mail-Vorlagen,
Meeting-Links, der Pipeline-Umschalter, das Kontextmenü und die Kontaktlisten.
Die Paritäts-Bedingung aus der Blaupause ist damit nicht erfüllt, also fliegt
nichts. „Pipeline (klassisch)" bleibt erreichbar und trägt ein Schild, das
sagt, was nur dort liegt.

**Ehrlich zur Bauart von B2:** der Rahmen ist neu (Kopf, Anordnung,
Ressourcen-Panel, Cockpit-Optik über `.ck-lead`) — die Maschine darunter ist es
nicht. Feld-Speicherung mit Entprellung, Aktivitäts-Modale, Anruf-Protokoll,
Opportunities und Feld-Konfiguration hängen in `ContactPage` zusammen; sie
nachzubauen hiesse Kernlogik zu duplizieren (Gesetz 4) und die Parität aufs
Spiel zu setzen. `ContactPage` bekam genau zwei rein darstellende Schalter
(`ohneKopf`, `seitenspalte`). Wer „neu gebaut" im Wortsinn will, ist das eine
eigene Runde — mit dem Risiko, das B7 gerade vermieden hat.

### Etappe C — LinkedIn-Kanal, Portal, Desktop

| Zug | Ergebnis |
|---|---|
| **C1** | `/content` hat Kanal-Tabs (D10). LinkedIn ist text-first: Textvorschau statt Slide-Vignette, Editor mit Zeichenzähler (1.300 sichtbar / 3.000 hart), Kopier-Griff, „Als gepostet markieren" über den bestehenden Endpunkt, Ordner-Hinweis bei Bild-Beiträgen. Instagram unverändert daneben. Kein neuer Agent |
| **C2** | `scripts/verify-linkedin-content.ts`, 28 Fälle — hat sofort einen echten Fehler gefunden (`slidesOrdner(['1.png'])` lief in `lastIndexOf === -1` und lieferte „1.pn") |
| **C3** | Kundenportal auf **Navy × Gold** (D11): war hell, ist jetzt Welt 2, Archivo als Markenschrift |
| **C4** | Desktop: Karten-Titel in Satzschreibung statt umbrechender Versalien, Monatsziel in Instrument Serif |

**Zwei echte Fehler in C3**, beide über die Kontrast-Stichprobe gefunden: die
Ersatzfarbe der Projekt-Akzentfarbe war `#111827` — ein Fast-Schwarz, das auf
der alten WEISSEN Portal-Fläche funktionierte und auf Navy bei **1,05:1**
landete; „Nachricht schreiben" und die Hinweiszeilen unter den Kennzahlen
waren praktisch unsichtbar. Dazu: das Tokens-Doc nennt das Gold
`--portal-accent`, im Code heisst so die Projekt-Farbe — aufgelöst als
`--portal-gold` (Rahmen) neben `--portal-accent` (Detail), dokumentiert über
dem Token-Block.

### Verifikation (Stand nach C5)

`tsc -b` + `build` grün · **25/25 verify** · elf Bereiche bei 390×664 geprüft:
kein Querscrollen, Inhalt bleibt nach vollem Scrollen über der Dock-Kante,
**alle Touch-Ziele ≥ 44px**, Konsole beim Laden sauber · Desktop 1280 ohne
Umbrüche · Portal in der Kunden-Ansicht bei 1280 und 390 geprüft.

Was in der Kontrast-Stichprobe übrig bleibt, sind Mikro-Labels bei 3,95–4,39:1
(eingefrorener Token, Punkt 1 im Entscheidungsblock) und im Portal dieselbe
Lage bei `--portal-text-tertiary` (#6b7590, 3,55–3,82:1).

### Neue Entscheidungspunkte aus B und C

7. **Sales-Abriss.** Welche der neun Alt-Funktionen kommen mit? Ohne diese
   Antwort bleibt die Glass-Pipeline stehen. **Vorschlag:** Bulk-Aktionen und
   Schnell-Erfassung in den Neubau, den Rest streichen — dann ist der Abriss
   eine kurze Runde.
8. **Portal-Cover.** Das Alpenglühen-Foto aus dem V6-Mock ist im Tokens-Doc
   „optional" und **nicht** gebaut. Sag Bescheid, wenn es rein soll.
9. **Onboarding-Karte** sagt weiter „Brand OS" (`OnboardingPublicPage`) und ist
   innen Glas-Ära. Kundenseitig, aber ausserhalb von D11/D12 — eigene Runde.

## Runde vom 10.08., zweiter Teil — Phase 2, **Etappe A gebaut** (nicht live)

Die neue Optik steht: acht Commits auf `cockpit-rebuild`, Züge **A1–A7** der
Blaupause (`docs/wargames/phase2-haptik.md`) plus ein Commit mit den Befunden
der Etappen-Verifikation. **Der Fast-Forward auf `main` bleibt Kevins Wort.**

| Zug | Was jetzt anders ist | Datei |
|---|---|---|
| **A1** | Syne/DM Sans/JetBrains Mono raus, **Inter** trägt alles; Instrument Serif liegt als `--ck-font-display` bereit und wird nur an den drei editorialen Momenten gerufen. Zahlen richten sich über `tabular-nums` aus, nicht über eine zweite Familie. Der Graph-Canvas kennt keine CSS-Variablen — seine fünf Font-Literale sind eine Konstante geworden | `app/index.html`, `styles/tokens.css`, `styles/cockpit.css`, `graph/OsNebula.tsx` |
| **A2** | **Farb-Token-Swap auf Welt 1**: die ganze App dreht in einem Zug. Neu als Token: `--ck-bg-verlauf`, `--ck-ambient`, `--ck-card`/`--ck-card-border`, `--ck-accent-text`, `--ck-gold`, `--ck-medien-bg`, drei Radien (24/18/999). `--ck-panel` bleibt als **deckende** Entsprechung der Karte, weil Toast, Palette und Drawer über Canvas und Backdrop liegen | `styles/cockpit.css` |
| **A2 (D3)** | Hell-Modus raus. Mehr als der ☀-Knopf: `loadUiTheme()` liefert hart `'dark'` und der Pre-Paint-Schalter in `index.html` ist weg — wer zuletzt auf hell stand, säße sonst dauerhaft im ungepflegten `plain-light`-Block fest. Die Klasse bleibt liegen | `lib/uiThemeStorage.ts`, `components/StatusBar.tsx` |
| **A3** | Mobil ist aus der Bottom-Bar das **Dock** geworden: schwebende Pille, `blur(14px)`, aktiv = Zeichen im Akzent + 4px-Punkt. Die Unicode-Zeichen sind ein **Inline-SVG-Satz** — damit ist die O13-Emoji-Falle ersatzlos erledigt. `bereiche.ts` bleibt die eine Registry und trägt jetzt Schlüssel statt Zeichen | `components/BereichIcon.tsx`, `lib/bereiche.ts`, `styles/cockpit.css` |
| **A4** | **Cockpit-Home = V5-Hero** (D4): Foto-Ambiente, Begrüßung in Serifen, Tages-Ring, Uriel-Pille, dann HEUTE · JETZT DRAN · Apps · Agenten-Zeile. Der Hero rechnet nichts — Ring = `li_anfragen` gegen `ANFRAGEN_LIMIT_TAG`, Liste = `geordnet` abgeschnitten | `components/home/HeroHorizont.tsx`, `components/home/JetztDran.tsx`, `pages/UrielHome.tsx` |
| **A5** | Labels stehen nach Tokens-Doc (10px/700/0,15em), Knöpfe haben die Versalien abgelegt (Satzschreibung wie im Mock). 19 Radius-Literale, zwei `#fff`-Rahmen, Schatten und Abdunkelung sind tokenisiert | `styles/cockpit.css` + 15 Komponenten |
| **A6** | Der Graph ist aus dem Deep-Space-Neon in die Horizont-Tonart gerückt; die vier Zustände holen sich die echten Signal-Farben | `graph/nebulaLayout.ts`, `graph/OsNebula.tsx` |
| **A7** | PWA-Rahmen: ✦ in Gold auf `#0c130e` als Icon (SVG + 192/512/180/256), `theme_color`, Manifest, Fenstertitel. Anmeldekarte sagt **URIEL** (D12) | `app/public/*`, `app/index.html`, `pages/LoginPage.tsx` |

**Zwei echte Fehler, die der Token-Swap ans Licht gebracht hat** — beide gefixt:
der Badge malte **weiße Ziffern auf den Akzent** (in der alten Welt war der
Akzent Phosphor-Grün, in Welt 1 heller Salbei → 1,6:1), und
`tailwind.config.js` nannte Syne/DM Sans/JetBrains **hart**. Weil Tailwinds
Utilities nach `tokens.css` laden, gewann diese Liste — Anmelde- und
Portal-Flächen liefen seit A1 auf System-Ersatzschriften statt auf Inter.

**Verifikation gefahren** (die neun Punkte der Blaupause): `npx tsc -b` +
`npm run build` grün, **24/24 verify-Skripte** grün. Kontrast-Stichprobe mit
echten `computed styles` über zehn Bereiche — zwölf Fließtext-Stellen standen
auf `--ck-text-3` (3,95:1) und sind auf `--ck-text-2` (8,0:1) gehoben. Bei
390×664: kein Querscrollen, der letzte Inhalt bleibt nach vollem Scrollen über
der Dock-Kante, Touch-Ziele ≥ 44px, Konsole beim Laden sauber. Desktop 1280:
`/cockpit` und `/sales` ohne Layout-Brüche. Zahlen-Konsistenz belegt:
Hero-Ring == Tracking, JETZT DRAN == Arbeitsmodus-Reihenfolge (der
Erinnerungs-Posten des Sales-Dashboards ist mobil ohnehin `null`).

**Ehrlich dazu:** die Screenshots entstehen ohne Supabase-Session — der
Prüf-Lauf legt eine Schein-Sitzung an und beantwortet alle Supabase-Aufrufe mit
leeren Listen. Die Oberflächen sind also echt, die Zahlen darin sind
Leer-Zustände.

### Entscheidungsblock Phase 2 (offen, Stand 10.08.)

1. **`--ck-text-3` und die 4,5:1-Grenze.** Der eingefrorene Wert `#737d70`
   kommt auf der Kartenfläche auf **3,95:1**, als `.ck-label` auf 4,39:1 —
   unter AA für kleinen Text. Fließtext ist überall gehoben; was übrig bleibt,
   sind echte Mikro-Labels. **Vorschlag:** `#7d8879` (≈ 4,5:1), sonst bleibt es
   wie eingefroren. Nicht im Alleingang geändert.
2. **Kalender-Punkt.** Der Fremdkalender war Violett `#a78bfa` — dafür lässt
   das Tokens-Doc keine dritte Signalfarbe zu, er ist jetzt neutral
   (`--ck-text-3`). Damit liegt er nah an „Content" (`--ck-idle`). **Wenn du
   die beiden unterscheidbar willst, wird daraus ein eigener Token.**
3. **Graph-Kategoriefarben.** Ein Graph braucht unterscheidbare Kategorien —
   das Tokens-Doc deckt sie nicht ab. Die 13 Töne liegen jetzt in der
   Horizont-Tonart, die vier Zustände auf den echten Signalen. **Ansehen und
   sagen, ob es passt.**
4. **Dock ohne Text-Label.** Mock und Tokens-Doc beschreiben das Dock als
   Zeichen + Punkt, ohne Beschriftung — so ist es gebaut. Die Namen sind für
   Vorleseprogramme erhalten. **Sag Bescheid, wenn du die Label zurückwillst.**
5. **Zwei Uriel-Einstiege auf dem Home.** Die neue Ask-Pille und der
   schwebende ✦-Knopf öffnen dasselbe Dock, und der Knopf legt sich beim
   Scrollen über Karten. **Vorschlag:** auf dem Home den FAB ausblenden, die
   Pille ist dort der Weg. Auf allen anderen Flächen bleibt er.
6. **Foto-Auflösung.** Das Ambiente ist das eingebettete Bild aus dem Mock
   (780×465, 54 KB) — auf einem 3×-Display sichtbar weich. Der Blaupause nach
   wäre der Ersatz das Unsplash-Original (`photo-1470071459604-3b5ec3a7fe05`),
   selbst gehostet. **Das ist ein Download — sag einmal Ja, dann hole ich es.**

**Für Etappe C vorgemerkt** (kein Handlungsbedarf jetzt): die Anmelde- und
Onboarding-Karten sind innen noch Glas-Ära (`OnboardingPublicPage` sagt weiter
„Brand OS"), und in der schmalen Desktop-Sidebar brechen ein paar lange
Versal-Labels seit A5 auf zwei Zeilen um — beides gehört in C3/C4.

---

**Runde vom 10.08., erster Teil** (Phase-2-Planung, kein App-Code): Design entschieden und
eingefroren nach vier Varianten-Runden mit Kevin — **Cockpit = V5 „Horizont"
(Waldgrün/Salbei, Serifen-Momente, Foto-Ambiente nur im Home), Kundenportal =
Navy×Gold (Markenfarben)**; Stern-Ornament bleibt Wallpaper, nicht App (V7
angesehen und verworfen). Wahrheit: `docs/phase2/DESIGN-TOKENS.md` + Mocks
`docs/phase2/style-varianten*.html`. **Blaupause für die Umsetzung:**
`docs/wargames/phase2-haptik.md` (Etappen A/B/C, D1–D12, blind ausführbar für
Opus auf xhigh; deckt O14-Neubau nach Close-Vorbild und O16 LinkedIn-Kanal).
Nebenbei erledigt und live: Marken-Umschalter entfernt — es gibt nur noch
HERRMANN & CO.

**LIVE seit 09.08.2026, ~23:20** — Fast-Forward `63c2177 → 179702f` auf `main`
gepusht (Kevins Wort), Netlify hat deployt. **Beleg am ausgelieferten Bundle**
(`index-B2bblpN_.js`, der Hash weicht vom lokalen Build ab, weil Netlify mit
eigenen Env-Variablen baut — die CSS-Hash `index-BxCwQSrj.css` ist identisch):
14 Marken dieser Runde nachweisbar („Aufwecken", „Loom verschickt",
„Kopieren + Website", „Als gepostet markieren", „Änderung wünschen",
„Freigabe ist raus", „Braucht einen Posten", „zählt beim Abhaken",
„Credits-Stand", „Monatsziel: Cockpit-Startseite", „Ungelesen im
LinkedIn-Postfach", „schlafen gelegt, kommen von allein zurück", „Der Runner ist
offline", „freigegeben"). Gegenprobe bestanden: **„Nur lokal möglich" und
`preview=true` sind aus dem Prod-Bundle verschwunden.** frameworkos.de,
`/portal` und `/cockpit` antworten 200. Migration 0069 war schon vorher
eingespielt.

**Abnahme am selben Abend, eingeloggt** (09.08., ~23:00): Zug 1–9 und 11 in
Kevins Session durchgeprüft. Belegt: kein „Infinity" mehr in der Oberfläche ·
kein `duplicate key` beim Laden · Ruht-Rundlauf (schlafen legen → Weck-Liste →
aufwecken → `snoozed_until` wieder überall `null`) · Erstnachricht = ein Klick,
538 Zeichen in der Zwischenablage und Ziel im neuen Tab · Ads-Kacheln
20/0/20/1 deckungsgleich mit 20 Tabellenzeilen · Blättern per Pfeiltasten, und
Tippen in der Notiz blättert NICHT · Notiz-Entwurf wandert beim Ad-Wechsel
nicht mit · „Als gepostet markieren" schreibt einen Post bzw. eine ganze Woche
in `content.json` (mit Wegwerf-Daten, Original danach byte-gleich zurück) ·
Uriel antwortet (L6). Zwei Fehler, die dabei auffielen, sind gefixt: „bis
10.08.**.**" in der Ruht-Zeile und die Ads-Kopfzeile, die bei 390 px aus dem
Panel lief. Desktop 1280 gemessen: kein Querscrollen auf `/cockpit` und
`/sales`.

**Runde vom 09.08., dritter Teil** (Umsetzung Technik-Fundament): Die
Phase-1-Blaupause ist gefahren — Züge 0–12, **21 Code-/Doku-Commits** auf `cockpit-rebuild`,
**nicht live** (der Fast-Forward bleibt Kevins Wort). `npx tsc -b` +
`npm run build` grün, **24 verify-Skripte grün** (22 vorher; neu
`verify-abnahme` und `verify-ical-rrule`, dazu `verify-kundenarbeit` 13 → 22
Fälle und `verify-linkedin-followups` 59 → 73). Migration **0069** ist gepusht;
der Trockenlauf wollte genau diese eine Nummer. Erledigt: **O8, O9, O11, L3,
L6, L7** und neun O13-Zeilen — in Kevins eingeloggter Session am selben Abend
komplett gegengeprüft (Details bei den Punkten). Vier Recon-Korrekturen und ein
neuer Befund stehen jeweils bei ihrem Punkt.

**Runde vom 09.08., zweiter Teil** (Planung, kein Code): Phase-1-Blaupause
**Technik-Fundament** fertig — `docs/wargames/technik-fundament.md` (Züge 0–12,
D1–D10, blind ausführbar; deckt O8, O9, O11, L3/L6/L7 und den belegten
O13-Kleinkram; O14 wandert bewusst in die Ästhetik-Phase). Danach folgt Phase 2
„haptisch geil" mit eigenem Wargame.

**Runde vom 09.08.** (Umsetzung): Der **Mobile Homescreen steht und ist live** —
Züge 0–7 der Blaupause gebaut (zehn Code-Commits, dazu die Doku), alle 20
verify-Skripte grün, Desktop nachweislich unverändert, Fast-Forward erfolgt
(L1). Drei Abweichungen von der Blaupause und zwei ältere Fehler, die dabei
auffielen, stehen bei **O18** — dort ist nichts mehr offen, die Notch-Abnahme
am Geraet hat Kevin gegeben. Erledigt: O18.

**Runde vom 07.08.** (O17 + O3): Die Morgen-Agenten laufen wieder — die Ursache
war der schlafende Mac, nicht der Timeout. Darauf aufbauend der Morgen-Push:
Etappen A und B des Wargames sind gebaut, Migration 0067 ist eingespielt, die
Edge Function deployt. **Nicht live** — der Fast-Forward und die iPhone-Schritte
stehen aus (siehe O3). Erledigt: O17, O3, O7.

**Runde vom 08.08.** (Planung, kein Code): Mobile Homescreen geplant — **O18**,
Blaupause `docs/wargames/mobile-homescreen.md` (Widget-first, blind ausführbar).

**Runde vom Abend des 06.08.** (Vorbereitung der Mobile-Session): O1, O2, O4, O5,
O6, O10, O13 (drei Punkte), O15 erledigt · L5b, O9 (erste Handlung) und O12
entschieden. Alles committet, nichts davon live. Nicht angefasst und weiter offen:
O3, O7, O8, O11, O14, O16 und der Rest von O9/O13.

Dieses Dokument ersetzt das Nebeneinander von `IDEEN-2026-07-30-nutzbarkeit.md`,
`IDEAS-2026.md`, `AGENTIC-OS-PLAN.md`, `REBUILD-PLAN.md`, dem Masterplan im Vault
und den fünf Wargames. Jene Dokumente bleiben als **Begründung** stehen (warum
etwas so entschieden wurde); **was noch zu tun ist, steht ausschließlich hier.**

**Regeln dieses Dokuments**
- Jede Aussage ist am Code, an der Datenbank oder am Dateisystem geprüft. Beleg
  in Klammern: `Datei:Zeile` oder das Kommando.
- Was nicht belegbar war, steht als **ungeprüft** da — nicht als Vermutung.
- Ein Punkt steht genau einmal. Unter „Herkunft" steht, aus welchen Dokumenten er
  zusammengeführt wurde.
- Aufwand: **S** = unter einer Stunde · **M** = halber bis ganzer Tag ·
  **L** = mehrere Tage.

**Prüfstand der Verifikation (06.08.2026)**
`git log main..cockpit-rebuild` · `supabase migration list --linked` ·
REST-Abfragen mit `service_role` gegen die Prod-DB · Grep über `app/src`,
`runner/`, `supabase/` · `git status` im Worktree.
**Abends dazugekommen:** `npm run build` (tsc + Vite) und **18 verify-Skripte** nach
jedem Schritt · `curl https://frameworkos.de/` für das ausgelieferte Bundle ·
localStorage-Abgleich im laufenden Chrome · gemessene CSS-Tokens im laufenden Build.
Nicht verifizierbar ohne Docker/SQL-Zugang: Sichtbarkeitsregeln (`security_invoker`)
und Policy-Details in der Prod-DB.
**07.08. nachgeholt:** Kevin hat eingeloggt, das Cockpit lief am Dev-Server. Damit
sind O1 (Cache = 44 = Server, kein Tombstone-Key, keine Nur-Lese-Meldung), O2/O5
(Queue über mehrere Läufe, 25 → 24 Karten), O10 (880 px = Bottom-Bar + Arbeitsmodus,
920 px = Rail, ohne Arbeitsmodus), O12 (Knopf abgeschaltet mit Erklärung, nachdem
Web Speech entfernt wurde) und O13 (Drawer `rgb(11,14,16)`, Fehler `rgb(229,72,77)`)
**am laufenden System** geprüft. Dabei fielen das Grenz-Loch in O2 und O17 auf.
*Test-Artefakt, kein Befund:* Bei einer Größenänderung im Hintergrund-Tab folgt
`useViewport` nicht — `document.visibilityState` ist dort `hidden` und
`requestAnimationFrame` feuert nicht. Im sichtbaren Fenster greift es.

---

## 1 — Livegang

Alles hier steht zwischen dem heutigen Code und „läuft in Produktion".
**Etappen 1–4 sind seit dem 06.08. live, der Mobile Homescreen seit dem 09.08.** (L1).
`main` hat keinen eigenen Commit — der Livegang bleibt ein Fast-Forward, kein Merge.
Was in diesem Abschnitt abgehakt ist, ist wirklich in Produktion; die Edge Functions
(L4, L5) deployen unabhängig vom Frontend und sind es bereits.

### L1 · ~~Fast-Forward~~ ✅ **alles live — zuletzt das Technik-Fundament (09.08., 23:20)**
`git log --oneline origin/main..main` = leer. Netlify liefert
`index-DXkj1tps.js`; im ausgelieferten Bundle sind alle sieben v2-Marken
nachweisbar („Nacht-Routinen", `ck-widget-stack`, „Anordnen", „→ morgen",
„Schnell-Aktionen", `ui_settings`, `kachelReihenfolge`) — es ist wirklich der
neue Code, nicht nur ein neuer Hash. Migration 0068 war schon vorher
eingespielt, die Tabelle wird jetzt auch benutzt.

### ~~Fast-Forward Homescreen~~ ✅ **live seit 09.08.**
Kevin hat fast-forwarded: `main` == `cockpit-rebuild` == `bf4d50d`,
`git rev-list --count origin/main..cockpit-rebuild` = 0. Netlify liefert
`index-DjbHPMcW.js`; der Bundle enthaelt nachweislich den neuen Code (per
`curl` auf die Datei gegen die Zeichenketten "Suchen und springen",
"Bibliothek", "Termine heute — Kalender oeffnen" geprueft, je 1 Treffer).
Der Hash weicht von einem lokalen `npm run build` ab — normal, Netlify inlined
seine eigenen `VITE_*`-Werte.
Was jetzt live ist: Zuege 0–7 aus O18 **plus** der Morgen-Push aus O3, der seit
dem 07.08. mitfuhr. Der Text darunter beschreibt den Zwischenstand vom 06.08.
und bleibt als Historie stehen.
`main` steht auf `de60288` und ist gepusht — der Fast-Forward aus dem
vorherigen Stand dieses Dokuments **ist erfolgt**. Netlify hat neu gebaut:
ausgeliefert wird `index-BjbadBHB.js` (vorher `index-CvTize-3.js`, geprueft per
`curl https://frameworkos.de/`). Damit ist auch der `send-email`-Deep-Link-Fix
regulaer auf `main`, die dokumentierte Drift ist aufgeloest.

**Noch nicht live: die Aufraeum-Runde vom Abend des 06.08.** — `6a8d605` (O2),
`22d454a` (O1), `bc07a63` (O10), `57663f2` (O6), `6b8e4a5` (O4/O5), `e1ce382` (O13),
`74ad91f` (O15) und die Entscheidungs-Commits danach. **Eine Anzahl steht hier
bewusst nicht**: sie waere ab dem naechsten Commit falsch. Verbindlich ist
`git log --oneline main..cockpit-rebuild`.

**Vor dem naechsten Livegang:** einmal in der Netlify-UI pruefen, welcher Branch als
Production eingestellt ist — `netlify.toml` legt ihn nicht fest. Der Rebuild auf
`de60288` ist ein starkes Indiz fuer `main`, aber kein Beleg (**ungeprueft**).
*Herkunft: Session-Inventur, was-ansteht.html*

### L2 · ~~Migrations-Historie reparieren~~ ✅ **erledigt 06.08.2026**
`supabase migration repair --status applied 0059 … 0066` gelaufen, danach zeigt
`supabase migration list --linked` **0001–0066 lückenlos in Local *und* Remote**.
`db push` ist damit wieder benutzbar — Voraussetzung für 0067 (O3) ist erfüllt.
Nur die Buchführung wurde geschrieben, am Schema nichts geändert.

**Warum es kaputt war** (als Lehre, damit es nicht wiederkommt):
`supabase migration list --linked` zeigte **0059–0066 mit leerer Remote-Spalte**.
Die Objekte sind alle in der DB (per REST bestätigt: `month_goals` 200,
`linkedin_threads.verlauf`/`entwurf` vorhanden, `arbeits_dauern` gefüllt, Bucket
`runner-files` existiert, `daily_metrics.coldmails` ist weg) — sie wurden am
SQL-Editor vorbei eingespielt und nie als angewendet verbucht.

**Folge, hätte man es nicht bemerkt:** Das nächste `db push` hätte 0059–0066 erneut
ausgeführt — exakt Abbruchbedingung 2 des Morgen-Wargames, scharf, bevor 0067
überhaupt geschrieben war.

**Regel ab jetzt:** Migrationen ausschließlich über `db push`, nie im SQL-Editor.
Genau das war die Ursache — dieselbe Lehre stand schon nach dem 15.07. im Raum.
*Am 06.08. gefunden; stand in keinem Dokument.*

### L3 · ~~`security_invoker` auf `site_content_published`~~ ✅ **geschlossen 09.08.2026 (Migration 0069)**

**Entscheidung D7 der Phase-1-Blaupause: die Lücke wird zugemacht, nicht umgebaut.**
`supabase/migrations/0069_site_content_published_invoker.sql` setzt
`security_invoker = on`. Gepusht per `db push`; der Trockenlauf zeigte
ausschließlich 0069, `supabase migration list --linked` danach `0069 | 0069 | 0069`.

Die View verliert damit ihren anon-Nutzen — das ist hier folgenlos und wurde vor
dem Push geprüft: `site_content` hat 0 Zeilen, keine Kundenseite liest die View,
`frameworkos.de` antwortet 200 und `/portal` ebenfalls 200. Mit dem anon-Key
liefert die View vorher wie nachher eine leere Liste.

**Was NICHT gelöst ist** (unverändert Kevins Entscheidung, Zug 12): die
Projekt-Scopierung. Ein öffentlicher Lesezugriff bräuchte eine
Security-Definer-**Funktion** mit `project_id`-Parameter statt einer offenen
View — das ändert auch `lib/siteContentService.ts` und gehört zur
CMS-Entscheidung.

<details><summary>Der ursprüngliche Befund (warum der Auftrag zunächst gestoppt wurde)</summary>

**Der Auftrag wäre ein Rückschritt gewesen — hier steht, warum.**

`0052_site_content.sql:108-112` setzt `with (security_invoker = off)` **ausdrücklich
und kommentiert**: „Öffentlicher Lesezugriff NUR auf Published-Werte über eine
Definer-View — die Basistabelle bleibt für anon unsichtbar (keine Drafts, keine
Labels)." Es ist also kein Versehen, sondern der Kern des Entwurfs.

Was passiert wäre:
1. Mit `security_invoker = on` läuft die View als Aufrufer. `site_content` hat
   Policies für Owner und Portal-Client, **keine für `anon`** (`:29-66`) und auch
   kein `grant`. Ergebnis: Für Website-Besucher liefert die View **nichts** —
   unbemerkt, weil die Tabelle 0 Zeilen hat.
2. Der naheliegende Ausgleich (`grant select` + `anon`-Policy auf `site_content`)
   macht es **schlimmer**: eine RLS-Policy schränkt Zeilen ein, keine Spalten. Der
   anon-Key steht im ausgelieferten Frontend-Bundle — jeder könnte dann
   `value_draft`, `label`, `section` und `status` lesen. Genau das, was die
   Definer-View heute verhindert.

**Der echte Restpunkt** ist ein anderer und kleiner: Die Definer-View ist nicht nach
Projekt gezogen — wer den anon-Key hat, liest die veröffentlichten Werte **aller**
Projekte. Inhaltlich sind das Texte, die ohnehin öffentlich auf der Kundenwebsite
stehen; es leckt vor allem die Projekt-UUIDs. Saubere Lösung wäre eine
Security-Definer-**Funktion** mit `project_id`-Parameter statt einer offenen View —
das ändert aber auch `app/src/lib/siteContentService.ts` und gehört damit zur
CMS-Entscheidung, nicht in den Livegang.

**Kein Livegang-Blocker:** `site_content` hat 0 Zeilen, keine Kundenseite liest die
View. Der Punkt wandert zu O13 („Website-CMS schließen oder ausblenden").
*Herkunft: Session-Inventur — die Meldung „Sicherheitslücke" beruht auf dem
generischen Supabase-Linter-Hinweis zu Definer-Views, nicht auf diesem Fall.*
</details>

### L4 · ~~Deep-Link in `send-email`~~ ✅ **erledigt 06.08.2026**
`send-email/index.ts:157` zeigte auf `/brand/:slug/deliver/:id` — eine Route, die
Etappe 4 abgerissen hat. Jetzt `/projekte/${project.id}` (deckt sich mit
`legacyRouteMap.ts:20`). Function deployt (**Version 20**, 14:25 UTC).

**Korrektur am ursprünglichen Befund:** `PUBLIC_APP_URL` **war bereits gesetzt** —
per Digest-Abgleich verifiziert als `https://frameworkos.de`. Der genannte
Vercel-Default hat also nie gegriffen; er ist außerdem nicht tot (antwortet 200).
Beide Fallbacks (`PUBLIC_APP_URL`, `EMAIL_ASSETS_BASE_URL`) zeigen jetzt trotzdem
auf die Live-Domain, damit niemand mehr an einem fremden Deploy hängt.
**Nebenbefund mitgenommen:** Der Kommentar „frameworkos.de hat kein `/email/*`"
(`:220`) stimmt nicht mehr — `https://frameworkos.de/email/herrmann-logo.png`
liefert 200 `image/png`. Das Logo in Sales-Mails hängt damit nicht mehr an Vercel.
*Herkunft: Session-Inventur*

### L5 · ~~`invite-client` deployen~~ ✅ **erledigt 06.08.2026**
Die Function war tatsächlich **nie deployt** — `supabase functions list` kannte sie
nicht. Jetzt **Version 1**, 14:23 UTC. Alle vier benötigten Secrets sind gesetzt
(`RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME`, `PUBLIC_APP_URL`), die
Implementierung ist vollständig (326 Zeilen, `generateLink type: 'recovery'` →
`/portal/setup`). Damit funktioniert der Passwort-Login fürs Kundenportal.
Sie tut nichts von allein — sie feuert nur auf einen Owner-JWT-Aufruf hin.
*Neu — stand in keinem Plandokument, nur in einer Session vom 09.07.*

### L5b · ~~Drei weitere Functions sind nicht deployt~~ ✅ **entschieden 06.08.2026**
Von 15 Functions im Repo waren 11 live. Nach `invite-client` (L5) blieben drei —
**alle drei werden nicht deployt, sondern gestrichen bzw. bleiben tot.**

| Function | Entscheidung |
|---|---|
| **`email-inbound`** | **Gestrichen (Kevin, 06.08.).** Der Outreach laeuft ueber LinkedIn; die Adresse tauchte nur als BCC-Hinweis auf der Kontaktseite auf. **Beleg:** `sales_email_logs` hat 7 Zeilen, **alle `outbound`, keine einzige `inbound`** — ueber diesen Weg ist nie etwas angekommen. Entfernt wurden `supabase/functions/email-inbound/` und `components/sales/ContactBccHint.tsx` samt Einbindung in `ContactPage`. Beides zusammen, sonst verspraeche der Hinweis eine Protokollierung, die es nicht mehr gibt. |
| `discovery-agent` | bleibt undeployt — die zugehoerige UI ist in Phase 6 geloescht |
| `discovery-feed-refresh` | dito |

**Nebenwirkung, die zaehlt:** Der Warnhinweis aus `wargames/rebrand-uriel.md`
(„`frameworkos.de` im Lead-Regex nicht anfassen") ist damit gegenstandslos. Der
Domain-Umzug auf `uriel-os.de` haengt nicht mehr an einem funktionalen
Lead-Eingang — die Zurueckstellung in Abschnitt 4 ist entsprechend entschaerft.

**Nicht von hier geprueft:** ob in Resend ueberhaupt ein Inbound-Webhook auf die
Adresse zeigt. Falls ja, fielen die Mails schon vorher ins Leere (die Function war
nie deployt) — das Streichen verliert also nichts. Wer das sauber abschliessen
will, loescht den Webhook im Resend-Dashboard.

### L6 · ~~`ANTHROPIC_API_KEY`~~ ✅ **bestätigt 09.08.2026, eingeloggt getestet**

Der Zehn-Sekunden-Test ist gelaufen: im Uriel-Dock ein neuer Chat („Ohne Kontakt
starten"), Frage „Was steht heute an?" — Uriel hat inhaltlich geantwortet
(Hinweis auf fehlenden Kalender-Zugriff, danach drei konkrete Hebel aus dem
Geschäftsmodell). Das geht nur mit gültigem Key. `supabase secrets list` zeigt
`ANTHROPIC_API_KEY` und `ANTHROPIC_MODEL` weiterhin als gesetzt.
**Damit ist L6 zu** — der Punkt lief seit dem 07.07. als „vermutlich gültig" mit.

<details><summary>Beleglage von 06.08. (unverändert gültig)</summary>

`supabase secrets list`: `ANTHROPIC_API_KEY` ist gesetzt. `ANTHROPIC_MODEL` ist per
Digest-Abgleich als `claude-sonnet-5` verifiziert — also kein totes Modell mehr (der
Fehler vom 07.07. war `claude-sonnet-4-20250514`).
**Kette der Belege:** Der ungültige Key wurde am 07.07. per CLI neu gesetzt
(`rebuild-notes.md`), `brand-assistant` danach neu deployt (07.07. 10:43 UTC), und
am 19./20.07. hat Uriel im Dock live geantwortet — das geht nur mit gültigem Key.
**Grenze der Prüfung:** Ein Aufruf *heute* braucht ein User-JWT; `uriel` und
`brand-assistant` prüfen `auth.getUser()`, der Service-Role-Key hilft dort nicht.
Ohne Session bleibt es **ungeprüft für heute** — nicht geraten. Der belastbare Test
dauert zehn Sekunden: eingeloggt eine Frage ins Uriel-Dock tippen.
</details>

### L7 · ~~RLS-Drift bei `project_messages`~~ ✅ **Fehlalarm, geschlossen 09.08.2026**

Am 09.08. gegen die Live-DB geprüft, **beide** Pfade — nicht nur der Lesepfad,
an dem die Meldung schon vorher nicht reproduzierbar war:

| Probe | Ergebnis |
|---|---|
| `GET /rest/v1/project_messages?select=id,deleted_at&limit=1` | HTTP 200, `[{"id":"ebfd8e78-…","deleted_at":null}]` |
| `PATCH /rest/v1/project_messages?id=eq.00000000-0000-0000-0000-000000000000` mit `{"deleted_at":null}` | HTTP 200, `[]` |

Der Filter der zweiten Probe trifft absichtlich keine Zeile: sie beweist, dass
die Spalte auch **schreibend** akzeptiert wird, ohne Daten anzufassen. Die
Spalte existiert wie in `0038_deliver_messaging_portal.sql:47` definiert. Keine
Migration nötig. Welcher Pfad damals abgelehnt haben soll, geht aus keinem
Dokument hervor — der Punkt wird als unbelegt geschlossen, nicht als behoben.
*Herkunft: Session-Inventur*

### L8 · ~~Morgen-Workflow-Blaupause committen~~ ✅ **erledigt 06.08.2026**
`docs/wargames/morgen-workflow.md` war die einzige unversionierte Datei im Repo —
421 Zeilen Planungsarbeit, die nur lokal lagen. Jetzt versioniert.

**Nicht mehr offen, entgegen der Session-Inventur:** Das Content-Modul ist
committet (Working Tree sauber), `social_batches` hat **4 Zeilen**, `content.json`
existiert. Offen ist dort nur noch der überfällige Testpost — siehe **O9**.

---

## 2 — Fertig, aber nirgends abgehakt

Damit es niemand ein zweites Mal baut. Jede Zeile mit Beleg.

### Aus dem AGENTIC-OS-PLAN (Abnahmeliste: sechs leere Kästchen, sechsmal gebaut)
| Abnahmepunkt | Beleg |
|---|---|
| `/os/map` liefert Skills/Routinen/Apps/Memory | `runner/index.mjs:1510` |
| `/os/file` (read-only, Pfad-Guard) | `runner/index.mjs:1552` |
| OsNebula ersetzt ForceGraph, Nodes klickbar, Suche | `app/src/cockpit/graph/OsNebula.tsx`, `nebulaLayout.ts` |
| 4 neue Skills laden sauber | `~/.claude/skills/{wargame,os-audit,last30days,website-pipeline}` |
| `brain.mjs` beantwortet eine Vault-Frage | `~/.claude/brain/brain.mjs` (07.07.) |
| Build grün, Screenshot an Kevin | Etappen 1–4 jeweils protokolliert |

Dazu **eine vierte Graph-Ansicht „Agenten"** (Session „Uriel Dashboard links",
20.07.) — das ist `IDEAS-2026` **G2 „Workflows-Ansicht"**, dort unangehakt.

### Aus `IDEEN-2026-07-30-nutzbarkeit.md`
| Punkt | Stand | Beleg |
|---|---|---|
| Wochen-Vitals-Bug (`weekRows` aus `monthRows`) | behoben | `useDailyMetrics.ts:354-358` — `weekRowsOf(allRows, …)` mit Kommentar |
| Freigaben-Status persistieren | gebaut | `cockpit/lib/approvalStatus.ts` |
| markDone-Ratsche im LinkedIn-Postfach | behoben | `useLinkedinThreads.ts:94` → `markDonePatch()`, Testskript `scripts/verify-linkedin-followups.ts` |
| Monatsziel-UI vor 01.09. | gebaut **und in der DB** | Migration 0062, `cockpit/lib/useMonthGoal.ts`; Tabelle `month_goals` antwortet 200 |
| Runs-, Datei- und Kalender-Spiegel | gebaut **und live** | Migration 0063; Snapshot-Keys `runs` (06.08.), `files_index` (05.08.), `calendar` (06.08.) in `runner_snapshots` |
| Antwort-Entwürfe am Posten + Verlauf syncen | gebaut | Migrationen 0064/0065, beide in der DB; `runner/index.mjs:400-404` |
| Heute-Deck v2 auf `ordnePosten` | gebaut | `HeuteDeck.tsx:39` (`usePosten`), `:22-23` mit Begründung |
| Tagesansage aus `arbeits_dauern` | gebaut | `cockpit/lib/tagesansage.ts`, `hooks/useArbeitsDauern.ts`, `SalesDashboard.tsx:418` |
| Bottom-Bar 9 → 5 Tabs | gebaut | `NavRail.tsx:18-30` (ARBEIT/NACHSCHLAGEN) |
| E-Mail-Bereich raus | gebaut | keine `EmailArea.tsx` mehr unter `cockpit/pages/` |
| Morgenbrief als Zeit-Routine | gebaut | `runner/index.mjs:1759-1781` (`maybeMorgenbrief`) |
| Glass-Leaks: Cmd+K, Toast, Fokus-Ring | geschlossen | `CommandPalette.tsx:260-364` (ck-Tokens, ICP-Einträge raus), `Toast.tsx:30-33` (Fehler 5.000 ms statt 2.200) |
| Kontrast `--ck-text-3` | behoben | `cockpit.css:21` = `#8a9599` (6,57:1, war 3,47:1) |
| ProjectPage in die ck-Welt | portiert | `pages/deliver/ProjectPage.tsx` — 1.003 Zeilen, **0** Glass-Treffer |
| Kunden-Posteingang im Cockpit | gebaut | `cockpit/lib/useKundenPosteingang.ts`, `components/KundenPosteingang.tsx` |
| Legacy-Metrikfelder raus | gebaut **und in der DB** | Migration 0066; `select coldmails` → `42703 column does not exist` |
| Alte Brand-Sales- und Deliver-Welt | abgerissen | Commit `fa8e295` |
| Abriss-Liste „sofort löschbar" | erledigt | alle `mock*`-Dateien, Portal-Leichen, `BrandDashboardPage`, Universe-Link weg; `ck-nav-spacer`/`ck-nav-back` auch aus dem CSS |

**Zwei Punkte der Abriss-Liste sind keine Leichen mehr** (nicht löschen):
`cockpit/lib/urielVoiceSettings.ts` wird von `useUrielVoice.ts:3` importiert — der
beanstandete Export `URIEL_VOICES` ist bereits entfernt (`urielVoiceSettings.ts:45`).
`components/Background.tsx` rendert schon jetzt nur außerhalb des Cockpits
(`App.tsx:169`: `{isCockpit ? null : <Background />}`) — die GPU-Kosten im Cockpit
sind weg.

### Uriel schreibt Tracking — `log_metric` (06.08.2026)
Bis dahin schrieb von zehn Werkzeugen nur `remember`; auf „trag 30
Vernetzungsanfragen ein" antwortete Uriel, er könne das nicht — obwohl Feld und
Upsert längst existierten.

| Baustein | Beleg |
|---|---|
| Feldkarte als Blatt-Modul (19 Felder + eindeutige Labels, ohne React) | `cockpit/lib/metrikFelder.ts` |
| Werkzeug-Schema, Enum direkt aus `METRIC_FIELDS` | `cockpit/lib/urielTools.ts` |
| Ausführung analog zu `remember`, über `bumpOn` | `cockpit/components/UrielDock.tsx`, `case 'log_metric'` |
| Reine Prüf-/Rechenlogik | `metrikFelder.ts` → `pruefeBuchung`, `berechneStand` |
| 25 Fälle grün | `scripts/verify-log-metric.ts` |

**Verhalten:** addiert statt zu überschreiben · negativer Wert korrigiert ·
optionales `datum` (nur Vergangenheit, max. 45 Tage zurück = Ladefenster) ·
Antwort nennt Tages- **und** Wochenstand („Vernetzungsanfragen (LinkedIn): heute
30, Woche 84"), damit ein Vertipper sofort auffällt.

**Zwei Fallen, die dabei entschärft wurden:**
- Der neue Stand wird in `berechneStand` gerechnet, **nicht** aus dem Hook gelesen.
  `bumpOn` schreibt optimistisch und gebündelt — der React-State im Executor-Closure
  ist noch der alte, Uriel hätte den Stand von *vorher* zurückgemeldet. Genau die
  Zahl, die den Vertipper aufdecken soll.
- Die Null-Klammer aus `bumpOn` (`Math.max(0, …)`) ist gespiegelt, sonst meldet
  Uriel bei einer Überkorrektur eine negative Zahl, die nie in der DB landet. Der
  Wochenstand zieht deshalb nur die *echte* Änderung ab.

**`METRIC_FIELDS` gegen die Prod-DB geprüft (06.08.):** alle 19 Felder existieren
als Spalte, und `daily_metrics` hat keine zählbare Spalte ohne Eintrag in
`METRIC_FIELDS`. Die vier Legacy-Sammelfelder sind mit 0066 gefallen — Code und
Schema sind deckungsgleich.

**Bewusst ausgelassen:** `umsatz`. Er wird gesetzt, nicht hochgezählt
(`setUmsatz`), ein „+500" wäre bei Geld mehrdeutig. Uriel verweist dafür auf
`/tracking` — siehe O13.

### Aus dem Masterplan
| Meilenstein | Stand | Beleg |
|---|---|---|
| M0 Rebrand | fertig | launchd `de.uriel.runner`, `URIEL` im Nebula-Kern |
| M1 Uriel-Modus + Command-Bus | fertig | `cockpit/lib/urielTools.ts`, `urielAgent.ts`, `UrielDock.tsx` |
| **M2 Push-to-talk** | **am Desktop gebaut** — siehe unten | `useUrielVoice.ts:123-172`, `UrielDock.tsx:625-633` |

**Korrektur zu M2.** Die bisherige Auswertung sagt „nicht gebaut — kein
Mikrofon-Zugriff, kein Recorder, keine Spracherkennung im Code". Das ist falsch:
`useUrielVoice.ts` implementiert Push-to-talk vollständig — Web Speech API,
`lang = 'de-DE'`, `interimResults`, `continuous`, 2,2-Sekunden-Silence-Timer,
`onInterim`/`onFinal` (`:123-172`); das Dock rendert den 🎤-Knopf, sobald
`sttSupported` wahr ist (`:625-633`); `startListening` läuft ausschließlich im
onClick-Pfad (`:319-324`).
**Was wirklich fehlt:** Web Speech braucht Chrome — in Safari und auf dem iPhone
bleibt `sttSupported` false. Die *Whisper*-Variante aus dem Masterplan existiert
nicht. Der offene Rest steht als **O12**.

### Sonstiges, nirgends notiert
- **Uriel-Gedächtnis** (`remember`-Werkzeug, 🧠-Menü, localStorage) — gebaut am
  20.07., `urielTools.ts:21`, `UrielDock.tsx:168/486`, `cockpit/lib/urielMemory.ts`.
  Steht in keinem Plandokument.
- **Kontrast-, Kachel- und Arbeitsmodus-Arbeit** aus `sales-arbeitsmodus.md`
  (Züge 1–8) ist komplett gebaut: `prioritaet.ts`, `Arbeitsmodus.tsx`,
  `arbeitsmodusTracking.ts`, `kundenarbeit.ts`, Migration 0061 (in der DB).
- **`linkedin-followups.md`** (Züge 1–9) ist komplett gebaut und im Betrieb:
  160 Zeilen in `linkedin_threads`, 91 in `linkedin_erstnachrichten`.

---

## 3 — Offen, nach Wirkung sortiert

### O1 · ~~`useContacts` hält Kontakte doppelt~~ ✅ **entdoppelt 06.08.2026**
Supabase ist die einzige Wahrheit, localStorage nur noch Lese-Cache.

**Die Zahl, die vorher fehlte — 0.** Vor dem Umbau geprüft (Kevins Chrome,
`brand-os:herrmann:contacts` gegen die Prod-DB): **44 im localStorage, 44 in
Supabase, dieselben 44 IDs**, kein Eintrag nur auf einer Seite. Den
Tombstone-Schlüssel `contacts-deleted-ids` gab es gar nicht. Damit war es
Aufräumen, keine Migration — hätte auch nur ein Lead ausschließlich lokal
gelegen, wäre der Umbau erst nach einer Übernahme erlaubt gewesen.
*Grenze der Prüfung:* geprüft ist der Browser, in dem das Cockpit benutzt wird.
Ein abweichender Stand auf einem anderen Gerät wird beim nächsten Laden dort
verworfen — genau der Geister-Mechanismus, den der Umbau abstellt.

**Was gefallen ist**
| Baustein | vorher | jetzt |
|---|---|---|
| `enrichContactFromLocal` (Feld-für-Feld-Merge) | 46 Zeilen | weg |
| Resurrect: lokale Zeile ohne Server-Gegenstück wandert in die Liste | `reload` | weg — `setItems(serverRows)` |
| Tombstones `contacts-deleted-ids` + drei Helfer | nötig gegen Resurrect | weg |
| `localOnlyRef` („ab jetzt ist der Browser die Wahrheit") | schrieb still ins localStorage | ersetzt durch `readOnly` = „Server antwortet nicht, nur gucken" |
| `create` schrieb optimistisch, Insert-Fehler ließ den Geist stehen | ja | erst Insert, dann anzeigen; Fehler → `{ ok: false, error }` |
| `remove` löschte lokal + Tombstone | ja | erst Server, dann Liste; scheitert sichtbar |

**Neu im Hook-Ergebnis:** `readOnly`. Solange es true ist, lehnen create/update/
remove ab und setzen eine Meldung, statt eine zweite Wahrheit aufzubauen.
`CreateContactResult` hat dafür eine dritte Variante `{ ok: false, error }` —
`syncWarning` ist weg, weil „lokal gespeichert, Sync später" nicht mehr existiert.

**Drift-Wache:** `scripts/verify-contacts-quelle.ts`, 14 Prüfungen — schlägt an,
sobald einer der Bausteine zurückkommt.

**Offen für Kevin (nicht von hier prüfbar):** ein manueller Durchlauf der
Pipeline-Flows (Lead anlegen, Stage ziehen, löschen) mit Session im Browser.
*Herkunft: REBUILD-PLAN §12.5 (07.07.) · IDEAS-2026 §2.6 + §3.5 · IDEEN Abriss-Liste ·
Session-Inventur. Vier Dokumente, ein Punkt, offen seit dem 07.07.*

### O2 · ~~Follow-up-Doppelwelt festschreiben~~ ✅ **entschieden und gebaut 06.08.2026**
**Die Grenze, ab jetzt verbindlich:** `linkedin_threads` ist die einzige Wahrheit für
den **LinkedIn-Funnel** (`followup_stage` gegen `last_message_at`).
`contacts.next_follow_up_at` trägt **Kunden- und Deal-Follow-ups**. Kevin hat den
Vorschlag am 06.08. bestätigt und die härtere Variante gewählt: nicht nur
dokumentieren, sondern im Code durchsetzen.

**Was der Befund vorher korrigiert hat:** Es ist **keine Dublettenwelt**. Namentlich
überschneiden sich die 44 `contacts` und die 160 `linkedin_threads` in **2 Zeilen**.
Die Zusammensetzung der 44 (Stand 06.08., alle Zeilen zuletzt am 10.06. angefasst):
36 × `first_contact` / 40 × `not_contacted` — eine Hamburger Makler-Recherche-Liste,
nie kontaktiert, `lead_source` bei 43 leer; daneben 3 × `deal`, 1 × `proposal`,
4 × `conversation` und ein Testeintrag. Die 36 Recherche-Leads existieren **nur** in
`contacts` — in der neuen Lesart sind sie heimatlos.

**Was gebaut wurde**
| Baustein | Beleg |
|---|---|
| `FOLLOWUP_STAGES` = conversation · follow_up · proposal · deal; `first_contact` fehlt bewusst | `cockpit/lib/approvalDrafts.ts` |
| Kommentar an Quelle 1 (Kunden/Deals) | `types/db.ts` → `Contact.next_follow_up_at` |
| Kommentar an Quelle 2 (Funnel) | `types/db.ts` → `interface LinkedinThread` |
| Drift-Wache, 5 Fälle | `scripts/verify-entwuerfe.ts` Abschnitt 8 |

**Wirkung auf die Freigaben-Queue:** `dueFollowupContacts` traf vorher 5 Kontakte
(alle überfällig, 25.05.–01.07.), jetzt 4. Draußen ist „Franz & Köhler Immobilien" —
der einzige `first_contact` mit E-Mail-Adresse und damit der einzige, an den die
Queue tatsächlich eine kalte Mail hätte schicken können.

**⚠ Nachtrag 07.08., am eingeloggten Cockpit gefunden — die Grenze hatte ein Loch.**
`dueFollowupContacts` filtert nur, **was der Agent als Eingabe sieht**. Die Karten in
der Queue kommen aber aus dem Run-Markdown, und seit O5 aus den letzten fünf Läufen.
Ein Entwurf, den der Agent **vor** der Entscheidung für Franz & Köhler gebaut hatte,
stand damit wieder da — inklusive „Freigeben & senden". O5 hatte die Lücke sogar
vergrößert, weil ältere Läufe jetzt mitgelesen werden.
**Fix:** dieselbe Grenze ein zweites Mal beim **Anzeigen** — `darfFollowupErhalten`
(`approvalDrafts.ts`), angewendet in `FreigabenArea` auf jede Karte mit CRM-Kontakt.
Entwürfe ohne `contact_id` sind LinkedIn-Threads und bleiben unangetastet.
**Gemessen im laufenden Cockpit:** 25 Karten vorher, 24 nachher; Franz & Köhler weg,
die vier Kunden/Deal-Karten (Detti, Bestgen, Hinsch, Develo) stehen.
**Lehre:** Eine Regel, die nur an der Erzeugung hängt, gilt nicht für Daten, die
vor ihr entstanden sind. Wo Historie mitgelesen wird, muss die Regel auch beim Lesen
greifen.

**Bewusst nicht gemacht:** Die 36 Recherche-Leads bleiben unverändert in `contacts`
liegen (Kevins Entscheidung 06.08.). Sie stören die Pipeline-Optik, nicht die Queue.
Aufräumen wäre ein eigener Schritt mit Blick auf die Namen — kein Nebenbei-Löschen.
*Herkunft: IDEEN „Das große Bild #2" + Abriss-Liste · Session-Inventur*

### O3 · ~~Morgen-Push aufs Handy~~ ✅ **gebaut 07.08. · live + eingerichtet 08.08.2026**
Etappen A und B des Wargames (Züge 1–9) sind gebaut und geprüft. Der Push kann
erst ankommen, wenn der Code live ist und Kevin sein iPhone einmal einrichtet —
siehe „Was noch fehlt".

| Zug | Was | Beleg |
|---|---|---|
| 1 | Service Worker `app/public/sw.js` — **nur Push, kein Cache** (kein `fetch`-Handler, kein Cache-API-Aufruf, bewusst kein vite-plugin-pwa) | Im Browser: eine Registrierung, Zustand `activated`, **Cache Storage leer** |
| 2 | Migration 0067: `push_subscriptions` (unique `endpoint`), `push_log` (`datum` als PK = die Sperre gegen den zweiten Push), zwei Cron-Zeilen 5:00/6:00 UTC | `migration list` 0067 in Local *und* Remote; `cron.job` zeigt beide, aktiv |
| 3 | VAPID-Paar + `CRON_KEY` als Supabase-Secrets, `project_url`/`cron_key` im Vault, `VITE_VAPID_PUBLIC_KEY` in Netlify und `.env.local` | `supabase secrets list`, `select name from vault.secrets` |
| 4 | Edge Function `morgen-push` (`verify_jwt = false`, Zugang per `x-cron-key` oder User-JWT + `test:true`) | deployt; ohne Key **401**, mit Key außerhalb der Stunde `{"skipped":"falsche-stunde"}`, mit `test:true` voller Durchlauf |
| 5 | `pushClient.ts` + `Benachrichtigungen.tsx` auf `/morgen` und im Mehr-Sheet | `requestPermission` nur im onClick-Pfad; im iPhone-Safari statt eines toten Knopfes der Satz „Teilen → Zum Home-Bildschirm" |
| 6 | Route `/morgen` — Vollbild am Handy, Desktop leitet auf `/cockpit` um | bei 390×664 vollständig sichtbar, „Loslegen" tippbar; bei 1280 px Umleitung |
| 7 | `?modus=arbeit` öffnet am Handy direkt den Arbeitsmodus | Klick auf „Loslegen" → Dialog „Arbeitsmodus", Posten 1/2 |
| 8 | Anfragen-Posten (= **O7**), nur Desktop, genau eine Aktion | siehe O7 |
| 9 | „Loom aufnehmen" am Loom-Posten, echter Link statt `window.open` | im Aktionsblock |

**RECON-1 vorab entschieden:** `jsr:@negrel/webpush` läuft in Deno — lokal gegen
einen Fake-Push-Dienst geprüft, die Anfrage trägt `Authorization: vapid t=<ES256-JWT>`
und `Content-Encoding: aes128gcm`. **Route B (Netlify Scheduled Function) wird
nicht gebraucht.**

**D5 in freier Wildbahn:** Der Probe-Push wählte am 07.08. von selbst die
Variante „N Posten warten — MacBook aufklappen", weil die Nacht-Analyse
tatsächlich ausgefallen war (O17). Genau dafür wurde die zweite Stufe gebaut.

**Bewusst nicht gebaut:** `/dev/morgen-vorschau`. Der Zweck der Dev-Vorschau ist,
die Seite ohne Session sehen zu können — mit Kevins Login war die echte Seite
prüfbar, und eine zweite Fassung mit Fixtures wäre ab dem ersten Umbau falsch.

**✅ Aktivierung komplett — 08.08. abends gegen das laufende System verifiziert:**
1. **Live:** `git log origin/main..HEAD` = 0 (main == cockpit-rebuild), Netlify
   liefert `index-DAnoKYfk.js`; `/sw.js` kommt als `application/javascript` mit
   dem Push-only-Worker (per `curl` gegen frameworkos.de geprüft).
2. **Push-Abo:** genau 1 Zeile in `push_subscriptions` (angelegt 08.08.
   20:47 UTC). `push_log` ist leer — planmäßig: seit dem Abo gab es noch keinen
   7-Uhr-Werktags-Lauf.
3. **Selbstwecker steht:** `pmset -g sched` → „wakepoweron at 5:58AM weekdays
   only" (5:58 statt 5:50 — reicht, liegt vor den 6:00-Routinen).
4. **Runner läuft mit neuem Code:** Prozessstart 07.08. 17:30, der
   caffeinate-Commit `f1d270a` war 15:20 — Kickstart ist erfolgt.

**Erster echter Push: Montag ~7:00** (Cron Mo–Fr + Wecker werktags — dass am
Wochenende nichts kommt, ist kein Fehler). Kommt Montag keiner:
`select * from cron.job_run_details order by start_time desc limit 5` und
`select * from push_log` sagen, welche Stufe geschwiegen hat. Sollte das eine
Abo vom Mac-Test stammen statt vom iPhone: am iPhone `/morgen` →
„Benachrichtigungen aktivieren" (Upsert auf `endpoint`, zweites Gerät ist ok).
*Herkunft: morgen-workflow.md · IDEAS-2026 A2 (Telegram — verworfen, siehe §5)*

### O4 · ~~`last_message_at` wandert beim „Erledigt" nicht~~ ✅ **erledigt 06.08.2026**
`markDonePatch` (`cockpit/lib/linkedinFollowups.ts`) setzt im Stufen-Zweig jetzt
`last_message_at` auf jetzt und `last_from` auf `me`.

**Warum das ein echter Fehler war, kein Schönheitsfehler:** `isDue` rechnet die
Frist der nächsten Stufe ab `last_message_at`. Blieb der auf der alten Nachricht
stehen, zählten die bereits verstrichenen Tage doppelt — ein Thread mit 5 Tage
alter Nachricht ging auf Stufe 1 (Schwelle 7 Tage) und war nach 2 weiteren Tagen
wieder fällig statt nach 7. Der Antwort-Zweig machte es längst richtig (`:121`),
nur der Stufen-Zweig nicht.

`last_from` wird mitgesetzt, weil dieser Zweig auch `unknown` erwischt (Bucket
„prüfen") — nach dem Haken hat Kevin geschrieben, das ist keine offene Frage mehr.

**Neu geprüft:** `scripts/verify-linkedin-followups.ts` Abschnitt 14 —
62 Fälle grün, darunter „nach 3 Tagen noch nicht fällig, nach 8 wieder".
*Herkunft: Session-Inventur*

### O5 · ~~Entwürfe überleben den nächsten Run nicht~~ ✅ **erledigt 06.08.2026**
`FreigabenArea` liest nicht mehr nur den jüngsten Lauf, sondern die **letzten
fünf** Entwurfs-Runs über den Runs-Spiegel (der hält Liste *und* Inhalt der
letzten 20 Läufe vor — `runner/index.mjs` → `pushRunsSnapshot`, gelesen über
`runnerApi.fetchRun`, das auf der HTTPS-Domain ohnehin den Spiegel nimmt).

**Was das löst:** Ein Entwurf, den Kevin nicht bearbeitet hat, verschwand, sobald
der Agent erneut lief — er stand danach nirgends mehr, obwohl das Follow-up offen
war. Jetzt bleibt er stehen, bis er abgehakt ist.

**Die Falle dabei — Dubletten.** Der Agent baut den Entwurf für denselben Lead in
jedem Lauf neu. Ohne Zusammenführung stünde derselbe Mensch fünfmal in der Liste.
`draftIdentitaet` (`approvalDrafts.ts`) fasst zusammen über `thread_key` →
`contact_id` → Name, **nicht** über den Nachrichtentext: der ändert sich bei jedem
Lauf. Gelesen wird von neu nach alt, der jüngere Text gewinnt.

| Detail | Regel |
|---|---|
| Abgeschlossene Karten älterer Läufe | fallen weg; nur der jüngste Lauf zeigt auch Erledigtes als Beleg |
| Status-Persistenz | an den Run **der Karte** (`card.runId`), nicht an den jüngsten |
| `sales_email_logs`-Abgleich | Fenster beginnt beim ältesten geladenen Run statt beim jüngsten |
| `KEEP_RUNS` in `approvalStatus.ts` | 5 → 10, damit ein „erledigt" auf einem älteren Lauf keinen jüngeren aus dem Speicher drängt |

**Bewusst nicht gemacht:** der Status wandert **nicht** in den Spiegel. Den
schreibt der Runner und überschreibt ihn bei jedem Lauf — ein „erledigt" aus dem
Browser wäre beim nächsten Push weg. Eine eigene Tabelle wäre richtig, kostet aber
eine Migration und kollidiert mit der für O3 vorgesehenen 0067. Das gehört in
dieselbe Runde wie der Morgen-Push, nicht davor.

**Neu geprüft:** `scripts/verify-entwuerfe.ts` Abschnitt 9 (8 Fälle, u. a. „Cem
überlebt den nächsten Run" und „Anna steht genau einmal da").
*Herkunft: IDEEN „Konsistenz-Funde" · Session-Inventur*

### O6 · ~~`linkedin_sync` umgeht den Doppellauf-Guard~~ ✅ **geschlossen 06.08.2026**
Der Job-Pfad in `fuehreJobAus` (`runner/index.mjs`) prüft jetzt dasselbe Flag
`linkedinSyncRunning` wie der HTTP-Pfad, setzt es und gibt es im `finally` wieder
frei. Ein Auftrag aus `runner_jobs` und ein Klick im Cockpit können nicht mehr
gleichzeitig durch die Voyager-API laufen.

`finally` ist dabei kein Stil, sondern Pflicht: bliebe das Flag nach einem
Abbruch stehen, wäre der Sync bis zum Neustart des Runners tot — ein stiller
Ausfall des wichtigsten Vertriebskanals wäre schlimmer als der Doppellauf.

**Drift-Wache:** `scripts/verify-runner-guards.ts`, 8 Prüfungen (u. a. dass der
Guard *vor* `syncThreads` steht und beide Pfade dasselbe Flag benutzen).
Strukturell, nicht laufend — der Runner startet beim Import einen Server und
pollt Supabase, ein echter Aufruf von `fuehreJobAus` ist von außen nicht ohne
Seiteneffekte möglich.
*Herkunft: IDEEN Abriss-Liste („Runner")*

### O7 · ~~Vernetzungsanfragen als Posten in „Jetzt dran"~~ ✅ **gebaut 07.08.2026**
Der Posten entsteht **synthetisch im Dashboard**, nicht in `arbeitsmodusQuellen`
— seine Quelle ist `daily_metrics.li_anfragen`, es gibt keine Zeile zum
Abhaken. Sichtbar nur am Desktop (D6) und nur, solange das Tagesziel offen ist;
er verschwindet von selbst, wenn der Zähler es sagt.

**Die gefährlichste Stelle, mit drei Sperren statt einer.** `metrikFeldFuer('anfrage')`
ist `li_anfragen` — liefe der Posten durch `erledigePosten`, zählte `bump()` oben
auf den Zähler, und seit dem 06.08. schreibt `log_metric` auf dieselbe Spalte.
Deshalb:
1. `Posten.nurZaehler` als Marker,
2. `erledigePosten` bricht bei diesem Marker **vor allem anderen** ab — kein
   `bump`, keine Dauer; als erste Zeile, nicht als Sonderfall im `switch`,
3. `oeffneArbeitsmodus` filtert solche Posten heraus, damit **kein Aufrufer** es
   vergessen kann (im Vollbild gibt es nur „Erledigt").

In der Liste hat er genau eine Aktion: **Zähler öffnen**.

**Geprüft:** `scripts/verify-arbeitsmodus-tracking.ts` 23/23 — inklusive
Gegenprobe, dass derselbe Posten *ohne* Marker sehr wohl zählen würde (sonst
bewiese der Test nur, dass gerade nichts passiert). Im laufenden Cockpit bei
1280 px: „Vernetzungsanfragen: noch 30 von 30", aufgeklappt ein einziger Knopf.
*Herkunft: IDEEN „Anfragen-Ritual" · morgen-workflow Zug 8*

### O8 · ~~Ads-Review-Durchgang~~ ✅ **gebaut 09.08.2026**
`AdDetailPanel.tsx:20-31` (neue Props `onPrev`/`onNext`/`position`), Kopfzeile
mit „Ad 7/20 · 3 freigegeben" und den Knöpfen ‹ › ab `:100`; Pfeiltasten in
`:57-76`. Verdrahtet in `AdsArea.tsx:238-245` (Index + `springe`), Panel mit
`key={openAd.id}` bei `:388`.

Zwei Fallen bewusst zugemacht: der Tastatur-Handler ignoriert Events aus
`input`/`textarea`/`select`/contenteditable (`AdDetailPanel.tsx:33-38`), sonst
blättert das Tippen einer Anmerkung die Ads um; das `key` erzwingt einen
Remount, sonst landet der Notiz-Entwurf von Ad 7 an Ad 8. Kein Wrap-Around —
am Listenende sind die Knöpfe aus.

„Freigegeben" = `approved` **oder** `live`, aus `AdStatus` (`adsApi.ts:25`)
abgelesen. **Am Bildschirm noch nicht gegengeprüft** — `/ads` liegt hinter dem
Login (siehe Kopf der Runde).
*Herkunft: IDEEN „Nutzbarer"*

### O8b · ~~Ads-KPI-Kacheln waren leer~~ ✅ **gebaut 09.08.2026**
Solange keine Meta-Zahlen da sind, zeigen die vier Kacheln jetzt den
Review-Stand statt vier Striche: „Ads gesamt", „Freigegeben", „In Review",
„Kunden" (`AdsArea.tsx:96-110` + `:135-149`). Gezählt wird aus **denselben**
Zeilen wie die Tabelle darunter (`rows`, nicht `allRows`) — sonst gehen Kachel
und Tabelle auseinander, sobald der „Nur aktive"-Filter greift. Der
`hasData`-Fall ist unverändert.

### O9 · ~~Content-Manifest schliessen~~ ✅ **fertig 09.08.2026**
Der `weekly-content`-Agent baut Wochen-HTMLs, schreibt aber nie ins Manifest — sein
Prompt nennt nur `WEEKLY.md`, `backlog.md`, `log.md` (`runner/index.mjs:127-130`).
Dazu: „Als gepostet markieren" wird gerendert, hat aber keinen Schreiber.

**✅ Erste Handlung erledigt (06.08.2026):** Der Testpost `w29-5s-test`
(„Der 5-Sekunden-Test", `scheduled`, geplant fuer den 21.07., seit sechs Wochen
ueberfaellig im Default-Tab) ist **geloescht** — Kevins Entscheidung, weil der Post
nie auf Instagram stand. Ihn auf `posted` zu setzen haette eine Falschmeldung in die
Content-Historie geschrieben. `content.json` hat jetzt `posts: []`; die Slide-Datei
`weekly/2026-W29/posts/post-01-fuenf-sekunden-test.html` bleibt liegen.

**✅ Rest gebaut 09.08.2026** (D5: schreiben darf nur der Runner, `content.json`
liegt im Vault):

| Teil | Beleg |
|---|---|
| Der Batch hängt seine Posts an | Prompt des `weekly-content`-Agenten, `runner/index.mjs:195-206` — je Post `{id,title,status:'scheduled',channel,format,week,slides,caption,done}`, bestehende Einträge ausdrücklich unangetastet |
| Schreiber für „Als gepostet markieren" | neuer Endpoint `POST /content/posted` `{brand, postId\|week}`, `runner/index.mjs:1977-2043` |
| Knopf in der App | Post-Ebene `ContentDetailPanel.tsx:104-121`, Wochen-Ebene `SocialArea.tsx:229-246`; nur aktiv bei `runnerDirekt()`, sonst disabled mit „am Rechner markieren" |
| Client-Seite | `contentApi.markiereGepostet` (`contentApi.ts:130-140`), `useContentManifest.markierePostGepostet` |

Der Endpoint ist bewusst eigen und winzig statt des PUT-Wegs: die App schickt
nie ein ganzes Manifest und kann den Rest der Datei damit gar nicht
überschreiben. Er validiert die Form, schreibt `.bak`, dann temp + `rename`
(nie eine halbe Datei), lehnt mit **409** ab, solange `weekly-content` läuft,
und legt bei fehlender Datei ein leeres Manifest an, statt 500 zu werfen.

**Am laufenden Runner geprüft** (mit Wegwerf-Daten, Original danach
byte-gleich wiederhergestellt): Einzelpost → `getroffen:1`, ganze Woche →
`getroffen:1`, zweiter Aufruf → `getroffen:0`, eine fremde Woche unberührt,
`.bak` angelegt. Fehlerfälle: unbekannte Brand → 400, weder `week` noch
`postId` → 400.

**Zwei Recon-Korrekturen zur Blaupause:**
1. `/content/manifest` war **nicht** read-only — das PUT mit 409-Guard gab es
   schon (`runner/index.mjs:1925-1945`).
2. **Neuer Befund:** Das Wochen-Badge „gepostet" hing an
   `social_batches.posted`, und diese Spalte hat **keinen Schreiber** —
   `saveSocialBatch` setzt sie nie, sonst niemand. Das Badge konnte also nie
   wahr werden. Es liest jetzt den `content.json`-Stand (Woche gepostet = alle
   ihre Posts gepostet, `SocialArea.tsx:30-46`), also die vorhandene Wahrheit
   statt einer zweiten. Die Spalte bleibt unbeschrieben liegen.

*Herkunft: IDEEN „Nuetzlicher" · content-modul-mvp.md „Phase 2" · Session-Inventur*

### O10 · ~~Ein Mobile-Breakpoint~~ ✅ **vereinheitlicht 06.08.2026**
`MOBILE_MAX_WIDTH = 900` und `MOBILE_MEDIA_QUERY` stehen jetzt in
`hooks/useViewport.ts` und werden importiert, statt abgetippt. Inklusiv wie in
CSS: `isMobile` ist `w <= 900`, deckungsgleich mit `@media (max-width: 900px)`.

| Stelle | vorher | jetzt |
|---|---|---|
| `useViewport.ts` | `w < 768`, `isTablet` ab 768 | `w <= MOBILE_MAX_WIDTH`, `isTablet` ab 901 |
| `NavRail.tsx` | `matchMedia('(max-width: 900px)')` zweimal abgetippt | `MOBILE_MEDIA_QUERY` |
| `CockpitHome.tsx` (Graph-Höhe) | `innerWidth < 900` | `<= MOBILE_MAX_WIDTH` |
| `cockpit.css` | 3 × `max-width: 900px` | unverändert — der einzige Ort, der nicht importieren kann |

**Konsumenten geprüft:** `App.tsx:157` hält nur den Listener (keine Wirkung).
`SalesDashboard.tsx` zeigt zwischen 768 und 900 jetzt ebenfalls „Arbeitsmodus
starten" im Fenster-Fuß und den Anfragen-Zähler als Vollbild — dieselbe Breite,
in der die Bottom-Bar schon steht. `ContactPage.tsx` und `ContactOverviewPanel.tsx`
gehen dort auf eine Spalte statt auf `380px + Rest`, was bei ~850 px eng war.
`isTablet`/`isDesktop` sind nirgends in Gebrauch (geprüft).

**Bewusst nicht angefasst:** `pages/portal/portal.css` schaltet bei 768. Das
Kundenportal ist eine eigene Oberfläche mit eigenem Layout — die Cockpit-Grenze
gilt dort nicht. Die Drift-Wache klammert es ausdrücklich aus.

**Drift-Wache:** `scripts/verify-breakpoint.ts`, 8 Prüfungen — schlägt an, sobald
irgendwo in `app/src` wieder eine Pixelzahl abgetippt wird.
*Herkunft: IDEEN „Schöner"*

### O11 · ~~Deliverable-Abnahme im Portal~~ ✅ **gebaut 09.08.2026** (D6)

Freigabe und Änderungswunsch sind strukturierte `project_messages` mit
`sender_role='client'` und einem Präfix im Body — **kein neues Schema, keine
neue Tabelle, keine zweite Statuswahrheit.** Der Kunde erzeugt ein Ereignis;
den Deliverable-Status ändert weiterhin nur der Owner.

| Teil | Beleg |
|---|---|
| Präfix bauen/lesen, Titel auflösen | `app/src/lib/abnahme.ts` (neu) — `[freigabe:<id>]`, `[aenderung:<id>] <Text>` |
| Kunden-Aktionen an fertigen Karten | `PortalDeliverableCard.tsx:120-186`, Kette `PortalShell.tsx:41-55` → `PortalPhaseContent` → Branding-/Website-View |
| Sendepfad | der **bestehende** `useProjectMessages.send` als `client` — im Vorschau-Modus wird bewusst nichts verschickt |
| Owner sieht es als Badge | `KundenPosteingang.tsx:171-174` + `:229-247`, `ProjectMessagesPanel.tsx:66-69` + `:92-108`; Präfix wird aus dem Fließtext genommen |
| Prüfung | `scripts/verify-abnahme.ts`, 19 Fälle — u. a. fremde Präfixe und Text mit eckigen Klammern bleiben normale Nachrichten |

**RLS: keine Migration nötig.** `0038_deliver_messaging_portal.sql:128-140`
hat `project_messages_client_insert` mit `sender_role='client'` für das dem
Kunden zugeordnete Projekt — genau der Pfad, den die Abnahme benutzt. Die
Abbruchbedingung „bestehende Policies müssten geändert werden" ist nie
eingetreten.

Titel kommen aus der stabilen Katalog-Id `dlv-<type>`, damit sie auch im
Posteingang über alle Projekte auflösbar sind, wo das Projekt gar nicht geladen
ist. Eigene Positionen (zufällige Id) heißen dort schlicht „Position".

**Am Bildschirm belegt** (DEV-Portal-Preview, 390×664 und 1280): beide Aktionen,
der Textfeld-Zweig und die Quittung „✓ Freigabe ist raus". Dabei aufgefallen und
gefixt: im zweispaltigen Karten-Grid am Handy passten die Knöpfe nicht
nebeneinander — unter 520 px stehen sie jetzt untereinander (`portal.css`).
**Nicht belegt:** die erzeugte `project_messages`-Zeile in der echten DB — dafür
braucht es eine eingeloggte Kunden-Session.

**Randbedingung unverändert:** CoLective und Reichentrog ruhen — der Nutzen
fällt erst mit dem nächsten Kunden an.
*Herkunft: IDEEN „Nützlicher"*

### O12 · ~~M2 zu Ende bringen: Sprache auch am Handy~~ ✅ **entschieden 06.08.2026**
**Entscheidung Kevin: „Sprache ist Desktop."** Push-to-talk laeuft ueber Web Speech
(`useUrielVoice.ts:43-49`) und damit nur in Chrome. Die Whisper-Variante aus dem
Masterplan wird **nicht** gebaut.

**Was stattdessen gebaut wurde (S):** Der 🎤-Knopf verschwand am iPhone und in Safari
kommentarlos (`UrielDock.tsx`, `sttSupported ? … : null`) — man sah, dass etwas fehlt,
aber nicht warum. Jetzt steht er dort abgeschaltet und erklaert sich im `title`:
„Sprache laeuft ueber die Web-Speech-Schnittstelle und gibt es nur in Chrome am
Rechner. Am iPhone und in Safari tippen."

**Wacht wieder auf, wenn:** der Morgen-Push (O3) steht und Kevin morgens
tatsaechlich ins Handy sprechen will. Vorher gibt es am Handy gar keinen
Morgen-Flow, in den die Sprache hineingehoerte. Der Bauweg bleibt der aus dem
Masterplan: Recorder → Edge Function → Text.
*Herkunft: Masterplan M2 (Formulierung dort war falsch, siehe §2)*

### O13 · Kleinkram — **am 09.08. abgeräumt bis auf fünf Entscheidungen**
Jeder Punkt einzeln bestätigt, keiner dringend, jeder kommt sonst zurück.

**Stand nach der Technik-Fundament-Runde:** Von 24 Zeilen sind **19 erledigt**
(vier davon schon vor dem 09.08.). Was offen bleibt, ist kein Bauauftrag mehr,
sondern eine Entscheidung von Kevin: Pitch-Modus, Beziehungs-Reminder,
`set_revenue`, Call-Mode, Website-CMS. Sie stehen am Ende dieser Runde als
Entscheidungsblock.

| Was | Beleg |
|---|---|
| ~~Doppelte Zielverwaltung: `SalesGoalsDrawer` konkurriert mit dem Monatsziel~~ ✅ 09.08. — Knopf „◎ Ziele", State, Mount und Import raus; an der Stelle steht der Hinweis „Monatsziel: Cockpit-Startseite". Sonst nichts an der Datei angefasst (fällt in Phase 2 / O14). Die Drawer-Komponente bleibt liegen | `SalesMode.tsx:2065-2076` |
| ~~InMail-Credits hart im Code~~ ✅ 09.08. (D8) — Wert lebt in `ui_settings` (0068, Schlüssel `sales.inmailCredits`), editierbar im Kachel-Fenster; `INMAIL_CREDITS_STAND` bleibt Standard, `tagesstand()` nahm ihn ohnehin als Parameter | `components/InmailPanel.tsx` (neu), `SalesDashboard.tsx:238-244` |
| ~~`useBrands`-Seed schreibt bei jedem Aufruf~~ ✅ 09.08. — **Ursache gefunden:** „keine Brands" und „nicht nachgesehen" sahen im State gleich aus (`brands.length === 0` bei `loading === false`). Genau dort landet `reload()` nach einem transienten Auth-Lock-Fehler (viele Tabs) und nach jedem anderen Lesefehler; der Seed hielt das für eine leere DB. `ladErfolgRef` + `error === null` als zusätzliche Bedingung. **Live-Gegenprobe der Konsole steht aus** (Login) | `hooks/useBrands.ts:231`, `:274`, `:296`, `:328` |
| ~~`.ck-heute-grid` ohne `display: grid`~~ ✅ 06.08. — `display: grid` + `gap` ergänzt. Befund präzisiert: die Klasse wird von **keiner** Komponente benutzt (HeuteDeck v2 rendert eine Liste), sie war also nicht „inline nachgepatcht", sondern eine stille Nulloperation. Bleibt korrekt stehen für den Mobile-Umbau | `styles/cockpit.css` |
| ~~`entwurfMoeglich` hart auf `true`~~ ✅ 09.08. — an allen vier Stellen `!isOffline`. **Abweichung von der Blaupause:** gegatet wird auf ONLINE, nicht auf `runnerDirekt()` — beide Wege brauchen einen lebenden Runner, aber der Auftrags-Weg über `runner_jobs` (0059) ist der bewusst gebaute Handy-Pfad und darf nicht gesperrt werden. Der Tooltip sagt jetzt „Der Runner ist offline" statt „Nur lokal möglich" | `LinkedinArea.tsx:599/611/624/636`, Tooltip `:129-133` |
| ~~Run-Drawer fällt auf Weiß zurück~~ ✅ 06.08. — `--ck-bg-1` (Alias auf `--ck-panel`, zieht im Hell-Modus automatisch mit) und `--ck-danger` (#e5484d dunkel / #b42318 hell) definiert, die `var(--x, fallback)`-Krücken in AgentsArea entfernt. **Im laufenden Build gemessen:** Drawer `rgb(11,14,16)` statt Weiß, Fehlerfarbe `rgb(229,72,77)`; im Hell-Modus `#ffffff` / `#b42318` | `styles/cockpit.css`, `cockpit/pages/AgentsArea.tsx` |
| ~~Agenten mit Pflicht-Input blind startbar~~ ✅ 09.08. — `loom-skript`, `followup-pdf`, `lead-research` sind deaktiviert, mit Hinweis „Braucht einen Posten — aus dem Arbeitsmodus starten" an Karte und Tooltip. Ids gegen `AGENT_CATALOG` abgeglichen | `AgentsArea.tsx:42-51`, `:150-163` |
| ~~Vault-Queue wächst unbegrenzt~~ ✅ 09.08. — beim Runner-Boot fliegt raus, was älter als 14 Tage ist (nur Dateien), mit Log-Zeile. **Gemessen nach kickstart: 66 → 28 Dateien**, älteste verbliebene vom 28.07. `queued: []` bleibt hart, jetzt mit ehrlichem Kommentar an beiden Stellen: eine echte Warteschlange gibt es nicht, Aufträge laufen über `runner_jobs` (0059) | `runner/index.mjs:2039-2067` |
| Pitch-Modus hängt am Namens-Suffix | `lib/projectAreas.ts` → `isPitchProject`, `components/portal/PortalShell.tsx:33` |
| ~~`?preview=true` lädt Projekte aus localStorage~~ ✅ 09.08. (D10) — nur noch im Dev-Build. **Belegt:** die Zeichenkette `preview=true` kommt im Produktions-Bundle nicht mehr vor (`grep -c` auf `dist/assets/*.js` = 0), der Bypass ist wegoptimiert | `pages/portal/PortalRoute.tsx:80` |
| ~~`unread` wird gesynct, aber nie angezeigt~~ ✅ 09.08. (D3) — Punkt an der Thread-Zeile und in der Prüfen-Liste, Muster wie der `isNew`-Punkt in SocialArea. Bewusst **nur Anzeige, kein Zurückschreiben**: die Spalte gehört dem Voyager-Sync | `LinkedinArea.tsx:66-82`, `:648-654` |
| ~~Snooze ohne Weg zurück~~ ✅ 09.08. (D2) — einklappbare Liste „Ruht (n)" mit Knopf „Aufwecken" (Zeilen ≥ 44 px). Filter ist `istWeckbar` = gesnoozt **und nicht** terminal, NICHT `bucketOf === 'ruht'` — dort liegen auch archivierte/gewonnene/verlorene Threads. `wake(id)` geht über den bestehenden `applyPatch` | `linkedinFollowups.ts:57-66`, `useLinkedinThreads.ts:107`, `LinkedinArea.tsx:167-256` |
| ~~Erstnachrichten: ein Griff~~ ✅ 09.08. (D4) — ein `<a>`, das beim Klick kopiert **und** die Seite im neuen Tab öffnet; kopiert wird ohne `await` vor der Navigation (sonst schluckt der Popup-Blocker den Tab, Lehre aus O3 Zug 9). **Abweichung von D4:** `linkedin_erstnachrichten` (0060) führt gar kein Profil-Feld, nur `website` — Ziel und Beschriftung sagen deshalb „Website", nicht „Profil" | `ErstnachrichtenListe.tsx:25-50`, `:73-99` |
| ~~„Loom aufnehmen"-Link am Loom-Posten~~ ✅ **war schon gebaut** (O3 Zug 9) — am 09.08. nachgeprüft: `href="https://www.loom.com/record"`, Beschriftung „Loom aufnehmen ↗". Der Backlog-Eintrag war veraltet, nicht der Code | `Arbeitsliste.tsx:396-400` |
| ~~`markLoomVerschickt` wird von `/linkedin` nicht genutzt~~ ✅ 09.08. — Knopf „Loom verschickt ✓" an jeder Thread-Zeile mit Stern, solange `loom_status` weder `verschickt` noch `entfaellt` ist. Schreibt **nur** den Thread-Status, kein Metrikfeld (Gesetz 4) | `LinkedinArea.tsx:58-61`, `:134-144` |
| ~~iCal-Serientermine verschwinden ab Woche 2~~ ✅ 09.08. (D9) — `expandRRule` deckt `FREQ=DAILY\|WEEKLY\|MONTHLY`, `INTERVAL`, `BYDAY`, `COUNT`, `UNTIL`, `EXDATE`. Unbekannte Regel-Teile lassen die **ganze** Regel durchfallen (der Termin bleibt sichtbar einzeln), statt still falsch zu rechnen. Kappe 300 Instanzen, Fenster −31/+366 Tage, Rechnung in Ortszeit auf Tagesbasis. **Zwei echte Fehler fanden die neuen Tests:** der 31. rutschte auf den 3. März, und `BYSETPOS` wurde ignoriert statt abgelehnt | `icalParse.ts:66-283`, `scripts/verify-ical-rrule.ts` (27 Fälle) |
| ~~Auto-getrackte Felder nicht gekennzeichnet~~ ✅ 09.08. — „auto"-Chip mit Titel „zählt beim Abhaken im Arbeitsmodus mit". `AUTO_METRIK_FELDER` wird aus `metrikFeldFuer` **abgeleitet**, nicht abgetippt — ein neues Spur/Feld-Paar landet von allein im Set | `arbeitsmodusTracking.ts:36-57`, `TrackingArea.tsx:57-110` |
| ~~Ads-Dashboard zeigt vier leere KPI-Kacheln~~ ✅ 09.08. — siehe **O8b** |
| ~~Nav-Icons ☑ ⚙ rendern auf iOS als bunte Emoji~~ ✅ 06.08. — beide tragen jetzt U+FE0E (Variation Selector-15, Text-Variante), dazu `font-variant-emoji: text` auf `.ck-nav-icon`. Bewusst kein Zeichentausch: alle anderen Icons sind Geometric Shapes, ein fremdes Zeichen hätte Tofu riskiert. **Nicht von hier prüfbar** — braucht einen Blick auf echtem iOS | `NavRail.tsx`, `styles/cockpit.css` |
| Beziehungs-Reminder „Still geworden" | kein `last_contact_at` in `cockpit/` |
| ~~„Seit **Infinity** Tagen keine Bewegung"~~ ✅ 09.08. (D1) — `liegtSeitTagen()` staffelt: Minimum der **endlichen** Anker, sonst Projektalter, sonst gar keine Zahl (dann fällt das Projekt aus der Liste). `created_at` wird nie ins Minimum gemischt. **Neuer Befund mit Folge:** `deliver_projects` (0008) hat **keine** `created_at`-Spalte — Stufe 2 greift heute nie, Projekte ohne beide Anker verschwinden aus „liegt" statt eine Zahl zu zeigen. Siehe Entscheidungsblock | `kundenarbeit.ts:36-57`, `:105-119`; `verify-kundenarbeit.ts` 13 → 22 Fälle |
| Umsatz per Uriel eintragen — `log_metric` kann nur zählen, nicht setzen; braucht ein eigenes `set_revenue` mit Setz-Semantik | `metrikFelder.ts` (umsatz bewusst ausgelassen), `useDailyMetrics.setUmsatzOn` |
| Call-Mode auf den echten Funnel stellen oder streichen | `SalesArea.tsx:18/58` — Sub-Tab existiert weiter |
| **Offen (Entscheidung):** Website-CMS — keine Kundenseite liest `site_content_published`, `site_content` = **0 Zeilen**. Die Lücke selbst ist seit 09.08. zu (L3 / Migration 0069); offen bleibt, ob das CMS belebt wird (dann Security-Definer-**Funktion** mit `project_id` statt offener View) oder Tabelle + View in Phase 2 fallen | `0069_site_content_published_invoker.sql`, `lib/siteContentService.ts` |

### O13b · Entscheidungsblock — **wartet auf Kevin, nichts davon gebaut**

Aus der Technik-Fundament-Runde (09.08.). Alles bewusst liegen gelassen: das
sind Geschmacks- und Geld-Fragen, keine Bau-Aufträge. Je eine Empfehlung, damit
die Antwort ein Satz sein kann.

| Frage | Empfehlung |
|---|---|
| **Call-Mode** auf den echten Funnel stellen oder streichen? | **Streichen.** Der Arbeitsmodus deckt den Fall; der Sub-Tab ist ein zweiter Ort für dieselbe Arbeit. |
| **Website-CMS**: `site_content` beleben (scoped Security-Definer-Funktion statt offener View) oder Tabelle + View in Phase 2 abreißen? | **Abreißen**, solange keine Kundenseite Inhalte von dort zieht. 0 Zeilen, null Leser — beleben lohnt erst mit dem ersten Kunden, der es wirklich will. |
| **Umsatz per Uriel**: eigenes `set_revenue`-Werkzeug mit Setz-Semantik bauen? | **Ja, aber klein.** `log_metric` kann nur zählen; Umsatz ist ein Stand, kein Zähler. Ein eigenes Werkzeug ist ehrlicher, als `umsatz` in die Zähl-Logik zu zwingen. |
| **Pitch-Modus**: weiter am Namens-Suffix „— Pitch" oder eigenes Feld? | **Eigenes Feld**, sobald der Pitch-Modus bleibt. Ein Suffix im Kundennamen ist eine Statuswahrheit im Anzeigetext — der nächste Tippfehler kippt den Modus. |
| **Beziehungs-Reminder „still geworden"**: überhaupt bauen? | **Nein, nicht jetzt.** Er bräuchte `last_contact_at` als neue Wahrheit neben der Follow-up-Leiter, die genau diesen Zweck schon erfüllt. |

**Nachtrag aus Zug 1 — Entwarnung nach der Messung in der Live-Session:**
`deliver_projects` hat **keine** `created_at`-Spalte, D1-Stufe 2 kann also nie
greifen. Die Sorge, dass deshalb Posten verschwinden, hat sich **nicht**
bestätigt: beide aktuell liegenden Projekte haben einen endlichen Anker
(Reichentrog 82 Tage seit `stage_changed_at` 2026-05-18, Develo 68 Tage seit
2026-06-01). Die Notfall-Stufe greift bei keinem Projekt, „Infinity" kommt in
der ganzen Oberfläche nicht mehr vor (Grep über /cockpit, /sales, /linkedin).
Die fehlende Spalte bleibt eine **latente** Lücke: sie schlägt erst zu, wenn
ein Projekt ohne Stufenwechsel und ohne erledigte Aufgabe auftaucht. Eine
Migration mit `default now()` wäre keine Lösung — Bestandszeilen bekämen
„heute" und damit „Seit 0 Tagen keine Bewegung". Ehrlich wäre nur ein Backfill
aus einer echten Quelle.

### O17 · ~~Die Morgen-Agenten laufen ins Timeout~~ ✅ **behoben 07.08.2026**
**Der Befund war ein anderer als der Verdacht.** Nicht der Agent, nicht die
Denktiefe, nicht der Timeout: **der Mac schlief zwei Sekunden nach dem Start
wieder ein.** `pmset -g log`, neben die Run-Zeiten gelegt (04.08.):

| Uhrzeit | Ereignis |
|---|---|
| 06:09:36 | DarkWake aus Deep Idle |
| **06:09:38** | Run `linkedin-antwort-entwuerfe` startet — und im selben Moment `Entering Sleep` |
| 06:26:06 | nächster DarkWake |
| **06:26:07** | Run wird als fehlgeschlagen verbucht |

Alle neun Fehl-Läufe zwischen dem 03. und 07.08. liegen so: Start auf einem
DarkWake, „Ende" auf dem nächsten. Der Mac fährt nachts einen Zyklus
„DarkWake für zwei Sekunden, dann zurück in den Schlaf", etwa alle 16 Minuten.
Der Agent bekam rund **zwei Sekunden Rechenzeit je Zyklus**; die Timeout-Wanduhr
lief im Schlaf weiter, SIGTERM und `close` wurden erst beim nächsten DarkWake
abgearbeitet. **Die 10,9 bis 17,8 Minuten sind keine Laufzeiten, sondern
Abstände zwischen zwei Aufwachern.**
*Gegenprobe:* derselbe `dream-check` am 07.08. mittags bei wachem Mac —
**23 Sekunden**. Morgenbrief am 31.07. abends — **33 Sekunden**. Der Skill ist
54 Zeilen und liest eine Datei.

**Vier Schritte, in dieser Reihenfolge gebaut**

| # | Was | Beleg |
|---|---|---|
| 1 | **Teilausgabe.** `--output-format text` schweigt bis zum Schluss — ein Abbruch hinterließ „kein Output". Jetzt `stream-json --verbose`, `runner/agentStream.mjs` baut ein Protokoll mit Zeitmarken (Werkzeuge samt Argument, gedachte Zeichen, Kennzahlen). Erfolgreiche Läufe sehen unverändert aus (nur der Endtext aus dem `result`-Ereignis — die Freigaben-Queue liest den ```json-Block daraus). | `scripts/verify-agent-stream.ts`, 39 Fälle |
| 2 | **Wachhalten.** Lauf startet unter `caffeinate -i -s`; die Zusicherung endet mit dem Prozess. **Timeout bleibt bei zehn Minuten** (Entscheidung Kevin 07.08.) — eine größere Zahl hätte den Fehlschlag nur später kommen lassen. | `CAFFEINATE_BIN` in `runner/index.mjs` |
| 3 | **Prozessbaum.** `proc.kill()` traf nur das direkte Kind, während ein Enkel die stdout-Pipe offen hielt — deshalb kam `close` Minuten zu spät. Jetzt `detached: true` (eigene Prozessgruppe) und `beendeBaum()`: SIGTERM an die Gruppe, nach 15 s Karenz SIGKILL. | im Test: Run-Datei exakt zum Limit statt 75 s später |
| 4 | **Guard + Sichtbarkeit.** Der Tages-Guard prüfte nur den Dateinamen — ein Fehlschlag galt als „heute schon gelaufen" und deckte sich selbst zu. Jetzt entscheidet der **Status**, mit zwei Versuchen je Tag als Deckel. Dazu eine Zeile im Heute-Deck: gescheiterte Routinen von heute stehen sichtbar da (der `RunWatcher` toastet nur, was er live umkippen sieht). | `runner/routineGuard.mjs`, `cockpit/lib/agentenGesundheit.ts`, `scripts/verify-routine-guard.ts`, 30 Fälle |

**Offen für Kevin — sonst greift Punkt 2 ins Leere:**
1. **Runner neu starten**, damit der Dienst den neuen Code lädt:
   `launchctl kickstart -k gui/$(id -u)/de.uriel.runner`
2. **Selbstwecker setzen** (braucht das Passwort, deshalb nicht von hier):
   `sudo pmset repeat wakeorpoweron MTWRF 05:50:00`
   Ohne ihn wacht der Mac werktags nicht von selbst auf — `caffeinate` hält ihn
   nur wach, sobald ein Lauf begonnen hat. `pmset -g sched` zeigt den Stand
   vorher; `pmset repeat` überschreibt bestehende Wiederhol-Zeitpläne.
*Gefunden am 07.08. gegen das laufende System; in keinem Plandokument.*

### O14 · Sales-Subtabs restylen — **L** · nach der Call-Mode-Entscheidung
`pages/sales/SalesMode.tsx`: 2.504 Zeilen, **55** Glass-Treffer — die letzte große
Fläche der alten Optik. Sinnvoll erst, wenn entschieden ist, was von
Pipeline/Listen/Call-Mode/Kontakt überhaupt bleibt (O13, letzte Zeile).
*Herkunft: IDEEN „Schöner"*

### O15 · ~~Hygiene~~ ✅ **erledigt 06.08.2026**
- ~~Worktree `sharp-lehmann-9787a0` aufloesen~~ ✅ (frueher am 06.08.). Der zurueckgebliebene
  leere Ordner `.claude/worktrees/` ist jetzt ebenfalls weg.
- ~~**Duplikat-Ordner `cursor/` neben `.cursor/`**~~ ✅ `cursor/rules.md` entfernt.
  Beide waren **versioniert und inhaltsgleich** (`diff -rq` ohne Ausgabe); geblieben
  ist `.cursor/`, weil Cursor genau dort liest.
- ~~**Vault:** `02 Projekte/Uriel.md` ist ein Stub vom 09.06.~~ ✅ **Befund war
  ueberholt:** die Notiz war bereits am 06.08. ueberarbeitet worden, stand aber auf
  „Etappen gebaut, noch nicht live“ und „12 Commits hinterher“. Jetzt auf dem echten
  Stand: `main` = `de60288` live, 6 Commits offen, die Entscheidungen dieser Runde
  in drei Zeilen.
- ~~**Dangling Link `[[ai-os-setup]]`**~~ ✅ alle drei Vorkommen im Masterplan
  aufgeloest. Die Notiz gab es im Vault **nie**; die Verweise galten der fruehen
  Hostinger-Planung, die inzwischen verworfen ist. Bewusst **kein** nachtraeglich
  erfundenes Dokument — stattdessen zeigen die Stellen jetzt auf die Begruendung in
  Phase 2 bzw. Backlog Abschnitt 5, mit einer Fussnote, warum der Link verschwand.

### O16 · Zwei Vorhaben aus Sessions, die nie in einem Doc landeten
- **LinkedIn als Kanal im Content-Bereich** (Session 21.07., „TODO 1"): Kanal
  `linkedin` + Editor + „Auf LinkedIn öffnen". Schätzung damals ~½ Tag. **M**
- **Morgen-Routine „neue LinkedIn-Kontakte → Erstnachricht"** (Session 21.07.,
  „TODO 2"): offene Entscheidung Variante A (halbautomatisch über Chrome) vs. B
  (täglicher Export). Weitgehend überholt durch `linkedin_erstnachrichten` (91
  Zeilen) und den Skill `linkedin-leads` — **vor dem Bauen prüfen, ob überhaupt
  noch etwas fehlt.** **S** für die Prüfung.

### O18 · ~~Mobile Homescreen + v2-Ausbau~~ ✅ **fertig, live und abgenommen (09.08.2026)**
Züge 0–7 der Blaupause (`docs/wargames/mobile-homescreen.md`) sind umgesetzt und
seit dem 09.08. live (L1). Kevins erster Eindruck am Geraet: „scheint zu
funktionieren".

**Was steht:**
- **Zug 0 · Notch-Fix** (eigener Commit, unabhängig vom Rest):
  `padding-top: env(safe-area-inset-top)` an `.ck-statusbar` im Mobil-Block
  (`app/src/styles/cockpit.css:591`). Die Statusleiste ist der oberste
  gerenderte Rand der Shell (`CockpitShell.tsx:31`), alle Bereiche erben.
  Am Desktop gemessen: `env()` = 0, Padding bleibt 8 px.
- **Zug 1 · Icons zentral:** Feld `icon` je Bereich in
  `cockpit/lib/bereiche.ts:39-53` + `bereichIcon(path)`; `NavRail.tsx:29-46`
  zieht daraus. Neu vergeben: `/termine` ◷, `/freigaben` ◫, `/linkedin` ▣.
  Codepoints per Skript geprüft (☑/⚙ tragen U+FE0E, Rest Geometric Shapes).
- **Zug 2 · Widgets:** `cockpit/components/home/` mit `HeuteWidget`,
  `TermineWidget`, `VitalsWidget`, `BefundZeile`. Ohne eigene Hooks — Props
  vom Eltern-Container. `MorgenArea.tsx:135` nutzt jetzt `BefundZeile`.
- **Zug 3 · UrielHome** (`cockpit/pages/UrielHome.tsx`); `CockpitHome.tsx:170-173`
  ist nur noch die Weiche, der bisherige Rumpf heißt `CockpitHomeDesktop`.
- **Zug 4 · App-Grid** (`components/home/AppGrid.tsx`), 10 Kacheln, LinkedIn
  erstmals ohne Umweg erreichbar. `Badge` aus NavRail nach
  `components/Badge.tsx` gezogen. `useSocialUnread` (`lib/socialApi.ts:117-180`)
  hat jetzt EINEN Kanal je Brand für alle Aufrufer.
- **Zug 5 · Bibliothek:** `MehrSheet` zeigt alle 11 Bereiche als Grid
  (`NavRail.tsx:110-161`), Benachrichtigungs-Schalter bleibt darunter.
- **Zug 6 · Suche:** ⌕ im Kopf öffnet die CommandPalette;
  `.ck-cmdk-input` mobil 16 px gegen iOS-Auto-Zoom (`cockpit.css:706`).
- **Zug 7 · Erinnerungen-Grammatik** (`components/home/ListenZeile.tsx`),
  mobil in `Arbeitsliste.tsx:131` und `AufgabenArea.tsx:55`. Der Kreis ruft
  ausschließlich die bestehenden Erledigt-Pfade.

**Verifikation 1–8 der Blaupause, gefahren:** `npx tsc -b` + `npm run build`
grün · **alle 20 verify-Skripte** grün (u. a. `verify-breakpoint` 8/8,
`verify-arbeitsmodus-tracking` 23/23) · Screenshots 390×664 (Homescreen, Apps,
Bibliothek, Palette, Arbeitsmodus, Aufgaben, `/morgen`) und 1280 px · Desktop
vorher/nachher deckungsgleich · Klick-Messung: Öffnen → „Loslegen" →
Arbeitsmodus „1 / 209" = 2 Interaktionen · Netzwerk-Zählung gemessen: mobil
113 Anfragen, Desktop 153, mobil KEINE Tabelle, die der Desktop nicht auch
liest (es fehlen `month_goals`, `os_map_snapshot`, `project_messages`,
`site_content`, `runner:/agents`, `runner:/os/map`).

**Drei Abweichungen von der Blaupause — mit Grund:**
1. **Kein `/freigaben`-Badge** (D5 sah einen vor). Gegenprobe fiel durch: das
   Icon zeigte 20 (`entwuerfeOffen(geordnet)`), die Seite „24 offen"
   (`FreigabenArea.tsx:297`, offene Karten der Agenten-Warteschlange). Zwei
   verschiedene Mengen; gleichziehen ginge nur mit einem neuen Ladepfad auf der
   Home (Gesetz 4). Der Content-Badge bleibt.
2. **`useViewport` hörte nur auf `resize`/`orientationchange`** — beim
   Umschalten der Breite feuerte die MediaQuery, aber kein resize, und die Home
   blieb auf dem Desktop-Zweig, während die Bottom-Bar schon mobil war. Jetzt
   zusätzlich matchMedia-Listener (`hooks/useViewport.ts:60-61`), wie NavRail
   ihn seit O10 hat.
3. **`?modus=arbeit` startete zu früh:** der Effekt in `SalesDashboard.tsx:601`
   wartete nur auf „`geordnet` nicht leer". Die fünf Quellen kommen nacheinander
   an — der Arbeitsmodus öffnete mit „1 / 2" statt „1 / 209". Er wartet jetzt
   auch auf „nichts lädt mehr". Der Fehler war älter als O18 (der Knopf auf
   `/morgen` ruft dieselbe URL).

**Nichts offen.** Die letzte Abnahme, die nur am Gerät möglich war, hat Kevin
am 09.08. gegeben: die Kopfzeile sitzt in der installierten App unter der
Aussparung (Zug 0). Damit ist auch der einzige Punkt erledigt, den kein
Desktop-Browser prüfen kann — `env(safe-area-inset-top)` ist dort immer 0.

**v2 komplett nachgezogen (09.08., Kevins Freigabe „nacheinander, f als letztes"):**
- **(a) Schnell-Aktionen** — Halten auf einer Kachel öffnet ein Blatt.
  Sales: Arbeitsmodus / Antworten / Anfragen-Zähler, alle über bestehende
  `?kachel=…`-Routen (`components/home/AppGrid.tsx`). Bewusst nur Sales: ein
  Halte-Menü, das nur „Bereich öffnen" anbietet, ist ein leerer Umweg.
- **(b) Agenten-Kacheln** — Morgenbrief / Entwürfe / Dream mit ihrem Zustand
  von heute (`components/home/AgentenKacheln.tsx`), aus `runs` + `agentenBefund`,
  die die Home ohnehin hält. „ruht" am Wochenende, weil zwei der drei Routinen
  werktags laufen. `scripts/verify-agenten-kacheln.ts`, 11 Fälle.
- **(c) Widget-Stack** — Heute / Termine / Woche nebeneinander statt gestapelt
  (`components/home/WidgetStack.tsx`, `.ck-widget-stack` in cockpit.css).
  Heute bleibt Seite 1, sonst läge „Loslegen" hinter einem Wisch. Seither
  stehen Widgets **und** Icons ohne Scrollen im Bild.
- **(d) Eigene Reihenfolge** — „Anordnen": Kachel antippen, Ziel antippen.
  **Migration 0068** legt `ui_settings` an (Schlüssel/Wert je Nutzer, RLS auf
  `auth.uid()`), auf Kevins Entscheidung Supabase statt localStorage: die PWA
  löschen und neu hinzufügen ist hier ein dokumentierter Schritt (O3), rein
  lokal wäre die Anordnung dabei jedes Mal weg.
- **(e) Reihenfolge nach Tageszeit** — morgens Freigaben/Sales/LinkedIn,
  tagsüber Sales/Termine/Projekte, abends Tracking/Content/Projekte
  (`lib/kachelReihenfolge.ts`). Greift **nur, solange nichts selbst angeordnet
  ist**; ein einziges „Anordnen" friert sie für immer ein. Ein Grid, das sich
  unter der eigenen Hand weiterbewegt, kostet mehr, als die Sortierung bringt.
  `scripts/verify-kachel-reihenfolge.ts`, 32 Fälle — die Drift-Robustheit ist
  der Punkt: ein neuer Bereich muss hinten landen statt zu fehlen.
- **(f) Wischen auf den Zeilen** — links „→ morgen", rechts „Erledigt"
  (`components/home/ListenZeile.tsx`, `.ck-zeile-wisch`). Nativ mit
  scroll-snap, `overscroll-behavior-x: contain` gegen die iOS-Zurück-Geste.
  **Abweichung:** die Blaupause wollte das Wischen selbst als Aktion; hier legt
  es die Aktion frei und der Tipp führt sie aus — „→ morgen" verschiebt einen
  Lead ohne Zurück, ein Fehlwisch wäre still und teuer. Verschoben wird über
  bestehende Pfade: `snooze` bei LinkedIn-Posten, `due_at` bei Aufgaben; wo es
  keinen gibt, erscheint die Aktion nicht.

Desktop nach der ganzen Runde erneut gegengeprüft: `/cockpit` mit Graph und
Heute-Deck, `/aufgaben` als Tabellenzeile, keine Wisch-Bahn, kein Widget-Stack.
Alle 22 verify-Skripte grün.

**Offen aus dem Ausbau:** echte iOS-Homescreen-Widgets (brauchen einen nativen
Wrapper — verworfen, §5) und der Edge-Swipe-Pager (verworfen in D3).
*Herkunft: Session 08.08. (Kevins OS-Idee) · IDEEN Leitprinzip Klick-Ökonomie*

---

## 4 — Zurückgestellt

Nicht verworfen. Je mit der Bedingung, unter der es wieder aufwacht.

| Was | Grund | Wacht wieder auf, wenn |
|---|---|---|
| **Uriel-Core 24/7 auf eigenem Heimserver** (Masterplan M3, „Jarvis Phase D") | Kostet Geld, Zeitrahmen Wochen bis Monate. **Kein Hostinger:** Der LinkedIn-Sync läuft mit Session-Cookies — eine Rechenzentrums-IP erhöht das Sperr-Risiko für den wichtigsten Vertriebskanal. Ein Heimserver behält die vertraute IP. Bis dahin decken Selbstwecker (`pmset`) und `caffeinate` rund 95 % der Morgen ab. | Kevin die Hardware anschafft — oder der Selbstwecker sich im Alltag als unzuverlässig erweist |
| **Sprach-Satelliten + Wake-Word** (M4) und **Alexas abklemmen** (M5) | Kevin, 06.08.: „Das können wir erst mal vergessen, das ist nicht wichtig." ~250 € einmalig. | Nach dem Heimserver, frühestens |
| **Domain `uriel-os.de`** (~15 €/Jahr) | Entscheidung offen seit 19.07. **Seit 06.08. deutlich billiger:** mit dem Streichen von `email-inbound` (L5b) hängt kein funktionaler Lead-Eingang mehr an `frameworkos.de`. Was bleibt, ist der `PUBLIC_APP_URL`-Umzug und die Netlify-Domain. | Kevin die Domain sichert; der Umzug bleibt davon getrennt |
| **Graph-Intelligenz** (IDEAS G1 Fluss-Ansicht, G3 Zentralität/Gap-Detection, G6 Graph-Erzähler) | Der Graph beantwortet heute „was ist angeschlossen". Die Steuerungsfragen beantwortet inzwischen das Sales-Dashboard besser. | Der Graph eine Frage beantworten soll, die keine Liste beantwortet |
| **Meta-Ads-API statt Manifest** | Schmerz-Regel: erst wenn echte Kampagnen laufen. 20 Ads stehen auf „review", keine läuft. | Die erste Kampagne live geht |
| **Uriel-MCP-Server** (IDEAS A5), **Event-Trigger** (A3), **Runner-Observability** (A4), **Skills-Registry** (A7) | Strukturell richtig, aber kein benannter Alltagsschmerz. | Ein konkreter Fall auftaucht — nicht vorher bauen (Foundation-Lektion) |
| **Booking-Anzahlung**, **Google-Calendar-Sync über iCal hinaus**, **wiederkehrende Tasks** | Kein Schmerz benannt; der iCal-Spiegel deckt den Kalender heute ab | No-Shows wirklich wehtun bzw. der iCal-Weg nicht mehr reicht |
| **MCP Apps, Agent-Payments, A2A** (IDEAS §3.7) | Beobachten, nichts bauen | — |

---

## 5 — Verworfen

Damit es nicht in drei Wochen als neue Idee zurückkommt.

| Was | Warum verworfen | Wann |
|---|---|---|
| **Hostinger-VPS als Uriel-Zuhause** | LinkedIn-Sync läuft mit Session-Cookies; Rechenzentrums-IP = Sperr-Risiko für den wichtigsten Vertriebskanal. Ersetzt durch Heimserver (§4). | 06.08.2026 |
| **Telegram-Bot / ntfy als Morgen-Kanal** | Dritte Plattform, kein Uriel-Erlebnis. Kanal ist Web Push in der installierten PWA (D1). ntfy bleibt nur Notfall-Rückfallebene, falls Web Push **und** Netlify Scheduled Functions scheitern. | 06.08.2026 |
| **Eigener Mobile-App-Build (nativ)** | Die PWA plus Push deckt den Fall. | 19.07. / bestätigt 06.08. |
| **Die alte Brand-Welt / 3D-Universe** | In Phase 6 abgerissen (Bundle −28 %), Etappe 4 hat den Rest entfernt. Kommt nicht zurück. Die Lektion steht in `IDEAS-2026.md:28`. | 07.07. / 04.08. |
| **Denk-Modi (Foundation, Building, Discovery-UI, Intelligence)** | Obsidian kann Denken besser. Arbeitsteilung: Vault = denken, Cockpit = tun. | 06.07. |
| **Semantische Embeddings im Graph** (IDEAS G5) | Overkill für ~100 aktive Notizen; Keyword-Scoring reicht und kostet nichts. | 07.07. |
| **Claude-Code-Terminal im Cockpit** | Die Chat-Blase deckt den Use Case ohne PTY-Komplexität. | 07.07. |
| **Google-Drive-Kundenanbindung** | Kein konkreter Workflow-Schmerz benannt (Foundation-Lektion). | 07.07. |
| **WhatsApp-MCP auf dem Haupt-Account** | Inoffiziell, Account-Risiko. | 19.07. |
| **Cold-Mail als Kanal** | Aus Tracking, Kanal-Antwortraten und Aggregaten entfernt (0055/0066). | 14.07. |
| **Kapazitäts-/Minutenrechnung im Sales-System** | Reihenfolge statt Portion — das System sagt, was als Nächstes dran ist, nicht wie viel Kevin heute darf. Abbruchbedingung 1 in `sales-arbeitsmodus.md`. | 29.07. |
| **NorthStar-Retainer-Zähler echt machen** (IDEAS H7) | Gegenstandslos: die NorthStarCard wurde beim Home-Refactor am 21.07. durch die `GoalCard` ersetzt. | 21.07. |
| **Sechs-Säulen-Meta-Systeme / Dream-Ausbau** | DreamCard bleibt klein und tut, was sie soll. | 07.07. |
| **Vault-Queue-Konzept** (`System/Queue` als Auftragsweg) | Der Ordner ist heute reines Debug-Protokoll; die echten Aufträge laufen über `runner_jobs` (0059). Aufräumen steht in O13. | 30.07. |

---

## Anhang — was aus den alten Dokumenten noch gilt

| Dokument | Was davon gilt |
|---|---|
| `IDEEN-2026-07-30-nutzbarkeit.md` | Das **Leitprinzip Klick-Ökonomie** (Arbeits- vs. Weg-Klicks, ≤ 2 Interaktionen bis zur ersten erledigten Einheit). Die Etappenliste ist abgearbeitet. |
| `IDEAS-2026.md` | Das **Postmortem §2** (fünf Lektionen) und die **Referenzprojekte**. Die Ideenliste §3 ist hier aufgelöst. |
| `AGENTIC-OS-PLAN.md` | Die **OsNebula-Regeln** (jeder Node klickbar, Graph beantwortet zwei Fragen) und „bewusst NICHT übernommen". Abnahme ist erfüllt. |
| `REBUILD-PLAN.md` | Das **Design-System §4** (Mission Control, verbindlich) und die **Regeln §11**. Bestandsaufnahme und Phasen sind Geschichte. |
| `wargames/morgen-workflow.md` | **Vollständig gültig** als Bauplan für O3 — mit den zwei Korrekturen aus O3. |
| `wargames/sales-arbeitsmodus.md` | Die **vier Gesetze**, das **Zielbild** (Stufen 2–5) und die Abbruchbedingungen. Züge 1–8 sind gebaut. |
| `wargames/linkedin-followups.md` | Die **Voyager-Feldkarte** und die drei Blätter-Fallen — das ist die Wartungsanleitung, wenn LinkedIn umbaut. |
| `wargames/sales-sektion.md` | Die **Fachregeln R7/R8** (5-Akt-Loom, Follow-up-PDF-Rubrik) als Prompt-Grundlage der beiden Agenten. |
| `wargames/content-modul-mvp.md` | Die **Randbedingung R4** (Slides nur per `src`, nie `srcDoc`) und die Phasen-Grenzen. |
| `wargames/rebrand-uriel.md` | Die **Ausnahmen-Tabelle** („explizit NICHT anfassen") — localStorage-Namespace `brand-os`, `frameworkos.de` im Lead-Eingang, Supabase-Ref. Weiter bindend. |
| `world-roadmap.md`, `phases.md` | **Historisch.** Beschreiben die Three.js-Welt vor dem Rebuild. |
| `data-model.md` | Gilt mit den vier Warnhinweisen, die mit diesem Stand übernommen wurden. |
| Vault: `Uriel – Masterplan.md` | Der **große Bogen** und die Begründungen (Privacy, Wake-Word-Architektur). Der Meilenstein-Stand steht hier. |
