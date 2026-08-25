# Uriel — Backlog (die eine Quelle der Wahrheit)

**Stand:** 2026-08-25 · Branch `main` (cockpit-rebuild liegt zurück) · Repo `~/Kevin OS/02 Projekte/uriel`

## **GEBAUT 25.08.2026 — Das Pipeline-Board: der Funnel als Fläche, mit Conversion**

Kevins Wunsch, nachdem die Kartenreihe stand: *„ich möchte visuell das canvas.
einmal die komplette pipeline abbilden, die ich abarbeiten kann, infos
rausziehen kann und kleine veränderungen machen kann. mit so einem canvas
könnte man dann auch die conversion mit im bild sehen und sehen wo optimiert
werden muss."*

Seine Pipeline ist kein Strang, sondern ein **Baum**: nach der Anfrage gabelt
sie sich in „nie angenommen" und „angenommen", plus den Abzweig „hat
geantwortet". Untereinander gelistet sah das aus wie neun weitere Schritte
derselben Reihe.

**Was gebaut ist** (`docs/wargames/pipeline-board.md`, Züge 1–8, **nicht
gepusht**):

- **`lib/funnelRaten.ts`** — die Conversion an den Kanten, in zwei Sorten
  (Zeitreihe / Kohorte) mit Reifezeit gegen die Kohortenfalle.
- **`components/sales/PipelineBoard.tsx`** — SVG-Baum, feste Anordnung,
  Umschalter Liste/Board. Mobil bleibt die Kartenreihe.
- **`lib/kadenz.ts` + `KadenzPanel`** — alle Wartezeiten justierbar, mit
  **Vorschau vor dem Speichern**.
- **`uebersprungen`** (Migration 0080) — Leads von Hand umhängen, ohne die
  Historie zu fälschen.
- **Der Haken protokolliert das Lead-Ereignis** (Zug 1) — vorher stand
  `followup` bei 0 Zeilen, obwohl täglich abgehakt wurde.
- **Vier Prüfskripte** (173 Prüfungen), Stand jetzt **60**.

**Die drei Zahlen-Entscheidungen, die den Unterschied machen:**

1. **Nie 0 % für „nicht gemessen".** Vier unterscheidbare Gründe statt einer
   Null — und jeder sagt Kevin etwas anderes darüber, was zu tun ist.
2. **`paarung_fehlt`** — an echten Daten entdeckt, nachdem alle 42 Prüfungen
   gegen Fixtures grün waren. `erstnachricht` 267 Zeilen, `antwort_erhalten` 67,
   aber nur **9** Leads mit beidem in der richtigen Reihenfolge:
   `leads-sync` schreibt für Threads ohne Verlauf entweder das eine oder das
   andere. Ohne die Prüfung stand dort „0,0 %".
3. **Die Kadenz-Vorschau** ist der eigentliche Schutz, nicht die Validierung:
   „1157 → 1177 (+20)", bevor gespeichert wird.

**OFFEN — braucht Kevins Entscheidung:**

- **Migration 0080 ist angelegt, aber NICHT angewendet.**
  `supabase migration list` zeigt `0079_loom_ereignisse` als lokal vorhanden und
  remote fehlend — uncommittete Arbeit aus dem Jophiel-Projekt (samt
  `supabase/functions/loom-ping/`). Ein `db push` würde sie mitanwenden. Bis zur
  Klärung schlägt das Umhängen am CHECK-Constraint fehl.
- **Chrome-Sync muss Verläufe spiegeln,** sonst bleiben zwei Kanten dauerhaft
  ohne Zahl.
- **Benchmarks für die Kantenfärbung** — `channelRates` misst eine andere Kante.

## **GEBAUT 25.08.2026 — Das Sales-Canvas: der Funnel als Arbeitsfläche**

Kevins `/sales` war eine senkrechte Kette aus sechs Flow-Zeilen. Sie
funktionierte, frass aber die ganze Seitenhöhe für sechs Zahlen — und zeigte nur
das Tagespensum, nie, **wie viele Leute insgesamt in welcher Phase stecken**.
Sein Bild dafür lag längst als `Vertriebsprozess.canvas` im Vault.

Jetzt steht es als Oberfläche da: oben eine Zeile (1.788 Leads im Kosmos, Tag 1
von 6), darunter der Funnel als Karten. Je Karte der **Bestand** gross und das
**Tagespensum** klein — zwei Zahlen, die Verschiedenes bedeuten. Klick öffnet
das Fenster: der Textbaustein der Stufe **einmal oben**, darunter die Namen.
Die alten Balken sind eine Rücklage hinter einem Klick, standardmässig zu.

**Der Nachrichtentext steht einmal in der Karte, nicht pro Lead** — das geht
erst, seit die Follow-up-Texte fest sind (`c5a1d80`).

**Die eine Invariante, an der alles hängt:** Jeder Lead liegt auf **genau einer**
Karte. `leadStation()` entscheidet zuerst, der Follow-up-Bucket verfeinert nur
noch *innerhalb* von `wartet_auf_antwort`. Wer beide nebeneinander abfragt,
bekommt denselben Menschen zweimal, und dann ist keine Zahl der Seite mehr etwas
wert. Festgehalten in `verify-funnel-karten.ts`.

**Was gebaut ist:**

- **`lib/funnelKarten.ts`** — die Rechenschicht. Verheiratet Bestand
  (`leadStation`) und Tagespensum (`stufenStaende`), rechnet nichts nach.
  `funnelGruppen` hält fest, welche Karten sich EIN Pensum teilen.
- **`components/sales/FunnelCanvas.tsx`** + `VorlagenKopf` + `GebauteSeiten`.
- **`runner/jophiel.mjs`** — `GET /jophiel/projekte` und `GET /jophiel/shot/:slug/:name`.
  Vorschaubilder über `sips` von 1–4 MB auf 50–75 kB. Spiegel `jophiel_projekte`.
- **Drei Prüfskripte** (80 Prüfungen), Stand jetzt **56**.

**Drei Entscheidungen, die dem naiven Bau widersprechen:**

1. **Die drei Follow-up-Karten teilen sich eine Kopfzeile.** Sie zählen alle auf
   `li_followups`; stünde „heute 5 von 13" auf jeder, läse Kevin 39.
2. **Das „n dran"-Badge ist nur grün, wo es ein Klickziel gibt.** „E-Mail fällig ·
   603 dran" war der lauteste Punkt der Seite, und dahinter lag nichts — für den
   stillen Zweig sind keine Adressen beschafft. Ein Alarm ohne Knopf entwertet
   auch die Alarme, hinter denen Arbeit liegt.
3. **Gebaute Seiten stehen NICHT im Funnel.** Ein Jophiel-Projekt ist ein
   Artefakt, kein Mensch — als Karte würde es den Lead doppelt zählen.

**Nicht gepusht.** Vollständig: [`docs/wargames/sales-canvas.md`](wargames/sales-canvas.md).

**Offen:** Der Abhak-Test hat echte Daten angefasst (Christelle Franz, Stufe 0→1,
`li_followups` des 25.08. auf 1) · „Erstnachricht fällig: 368 · heute 0 von 0" —
368 Angenommene warten, aber kein Text liegt für sie bereit · die 0078-Stationen
(Instagram, PDF, Postkarte, Anruf) sind noch nicht klickbar, weil sie keine
Posten-Quelle haben.

## **GEBAUT 25.08.2026 — Der Sortier-Agent: keiner fällt weg, aber nicht lasch**

Kevins Auftrag, wörtlich: *„Den Agenten, der vorsortiert, mach den auf jeden
Fall. Den werden wir brauchen. Und der muss gut sein. Da darf keiner wegfallen.
Lieber einer zu viel als einer zu wenig, aber auch nicht zu lasch."*

Zwei Anforderungen, die sich widersprechen. Aufgelöst über **Begründungspflicht**
statt über eine Schwelle: Jedes Urteil braucht einen Halbsatz, und bei `akquise`
muss er benennen, **was** die Person verkauft. „Passt nicht" ist kein Grund,
sondern eine Wiederholung des Urteils — wer es nicht benennen kann, urteilt
`lead`. Ein Urteil, das man begründen muss, fällt vorsichtiger aus als eines,
das man ankreuzt.

**Die Entscheidung, die den Agenten von allen bisherigen Filtern unterscheidet:
er sieht auch die, die der Wortfilter schon aussortiert hat.** `icpUrteil` liest
nur die Headline und irrt in beide Richtungen — er lässt „Als Unternehmer
5-10KG Fett in 90 Tagen" durch und wirft Makler raus, die sich ungewöhnlich
beschreiben („Addicted to selling Houses and deep Housemusic", „Do what you
love"). Ein Agent, der nur die Durchgelassenen prüft, kann den zweiten Fehler
nie korrigieren — und genau der ist der teure. Er bekommt deshalb den ganzen
Stapel, mit dem Wortlisten-Urteil als **Hinweis, dem er widersprechen soll**.

**Was gebaut ist:**

- **`runner/linkedin/sortierThreads.mjs`** — `brauchtUrteil` (genau einmal je
  Thread, ein Urteil gilt dauerhaft) und `baueSortierInput`. Reihenfolge:
  `unklar` → `off` → `rand` → `kern`, also die Zweifelsfälle zuerst. Deckel
  `SORTIER_MAX = 60`: Urteilen ohne Formulieren ist ein Bruchteil des Aufwands
  eines Entwurfs, deshalb passen sechzig statt zwanzig in einen Lauf.
- **Skill `linkedin-sortierer`** im Vault. Drei Urteile (`lead`/`kontakt`/
  `akquise`), Kevins echte Bestandsbeispiele in beide Richtungen, eine
  Grenzfall-Tabelle (Home Staging → `lead`, PropTech-Vertrieb → `akquise`,
  Bankberater → `lead`, Versicherung → `akquise`) und die heimtückischste
  Gruppe explizit: **Makler-Coaches als Wettbewerb**, namentlich Marvin Jeske
  und Daniela Hargarten aus dem Vault. Regel: **der Verlauf schlägt die
  Headline** — die Selbstbeschreibung ist Werbung, die Nachricht ist Verhalten.
- **`maybeSortierer`** im Runner: werktags, zwei Stunden nach den
  Antwort-Entwürfen (Standard 8:00). Der Sortierer ist der unwichtigste der
  drei Läufe — sein Ergebnis wirkt erst auf die Listen von morgen, während eine
  unbeantwortete Nachricht heute wartet. Nie zwei CLI-Läufe gleichzeitig.
- **`urteileAnThreads`** als eigener Rückschreiber neben `entwuerfeAnThreads`.
  Bewusst getrennt: Der Sortierer liefert keine Entwürfe, ein gemeinsamer Pfad
  würde bei ihm dauerhaft „kein verwertbarer json-Block" loggen.
- **`verify-sortierer`, 24 Prüfungen** — vor allem darauf, dass **nichts**
  weggefiltert wird, bevor der Agent es gesehen hat. Der teuerste Fehler dieses
  Moduls wäre ein stiller: Wer nicht vorgelegt wird, bekommt nie ein Urteil.
- Der Agent läuft ohne `WebFetch`/`WebSearch`, mit Absicht: Geurteilt wird über
  Headline und Verlauf. Sechzig Threads mal Website-Recherche wären ein
  garantiertes Zeitlimit.

**Erster echter Lauf (25.08., 20 Threads, alle vom Wortfilter als `unklar`
eingestuft — also genau die Fälle, bei denen er passt):**

| Urteil | Anzahl |
|---|---|
| `lead` (bleiben drin) | 7 |
| `kontakt` | 2 |
| `akquise` (aussortiert) | 11 |

Alle 20 beurteilt, alle 20 in der Datenbank. Die Qualität stimmt an genau den
Stellen, an denen es zählt:

- **Quentin Schäfer** („Alte Werte wahren - neue Chancen nutzen") wäre nach der
  Headline ein Kandidat zum Aussortieren gewesen. Der Agent las den Verlauf —
  Objekte, Käufer-Leads, Vermarktung — und ließ ihn drin.
- **Nick Gundoroff** (`--`) und **Christian Bartelheimer** („Hamburg") bleiben
  drin: ohne Information fällt niemand raus.
- **Dario Scafaro Gücük** bekam `kontakt` statt `akquise`, obwohl die Headline
  ein Bildungsträger-Pitch ist — im Verlauf steht „du hast doch meine
  WhatsApp". Ein persönlicher Bekannter wird nicht dauerhaft aussortiert.
- **Dennis Janko** (designside.de) wurde als **Wettbewerb** erkannt, nicht nur
  als Off-ICP.

**Stand:** 33 `lead`, 7 `kontakt`, 19 `akquise` verbucht; **180 warten noch**.
Bei 60 pro Lauf ist der Bestand in drei Werktagen durch, danach laufen nur noch
die paar neuen Threads pro Tag mit.

---


## **GEBAUT 25.08.2026 — Der Nachfass-Trichter war trockengelegt, jetzt läuft er**

Der eigentliche Fund des Tages, gefunden beim Messen für die laute Kette und
gravierender als sie: **Kevin fasst nicht nach — nicht aus Disziplin, sondern
weil im Cockpit nichts zum Kopieren stand.**

An Prod gemessen (25.08.):

| Messung | Ergebnis |
|---|---|
| Fällige Follow-ups | **177** |
| davon mit einem Entwurf | **0** |
| Aktive Threads auf `followup_stage: 0` | **239 von 239** |
| `daily_metrics.li_followups`, letzte 21 Tage | **0 an jedem Tag** |
| zum Vergleich, selber Zeitraum | `li_anfragen` 30/Tag, `li_nachrichten` 72 |

Der Trichter füllte sich oben und lief unten nicht ab. Kevins Arbeitsweise ist
Cockpit öffnen, Text kopieren, in LinkedIn einfügen — steht kein Text da,
passiert nichts.

### Die Lösung ist keine Automatik, sondern drei feste Texte

Der erste Anlauf war eine nächtliche Agenten-Routine, die zwanzig Entwürfe pro
Tag schreibt. Kevins Einwand kippte den Ansatz, und er hatte recht:

> *„So ein kurzer Follow-up muss doch nicht individuell gemacht werden. Reicht
> da nicht immer derselbe Satz?"*

**Bei diesen Leuten gibt es nichts zu individualisieren.** Sie haben auf die
Erstnachricht nie geantwortet — es existiert kein Gesprächsverlauf, auf den ein
Agent eingehen könnte, und der Website-Aufhänger ist in der Erstnachricht
bereits verbraucht. Ein Agent hätte hier Pseudo-Individualität produziert und
dafür Zeit und Token gekostet.

| | Agenten-Routine | feste Vorlagen |
|---|---|---|
| verfügbar | 20/Tag | **alle 177 sofort** |
| Latenz | ein CLI-Lauf | keine |
| Token | je Nachricht | keine |
| Ausfallrisiko | Zeitlimit, API-Fehler | keins |

**Was gebaut ist:**

- **`app/src/cockpit/lib/followupVorlagen.ts`** — drei Texte, einer je Stufe
  (3 / 7 / 14 Tage). Stufe 0 ist der harmlose Anstupser, Stufe 1 ein Befund,
  der für praktisch jede Maklerseite stimmt (fühlt sich individuell an, ohne es
  zu sein), Stufe 2 nur noch eine qualifizierende Frage. **Kein Break-up** in
  Stufe 2, obwohl es die letzte LinkedIn-Nachricht ist: Danach folgt der
  Kanalwechsel, ein Abschiedssatz wäre gelogen.
- **`followupPosten` nutzt sie als Fallback:** `entwurfVon(t) ?? followupVorlage(t)`.
  Ein echter Agent-Entwurf schlägt die Vorlage weiterhin. Nichts wird in die
  Datenbank geschrieben — der Text entsteht beim Anzeigen und gilt damit sofort
  auch für jeden neuen Thread.
- **`vornameAus`** löst den Vornamen (Titel weg, Mehrfach-Leerzeichen, `Sven-Oliver`
  bleibt ganz). Bei unbrauchbaren Namen (`--`, leer) gibt es **keinen** Entwurf:
  „Moin --," ist schlimmer als gar kein Text, weil Kevin ihn womöglich
  abschickt, ohne hinzusehen.
- **`verify-followup-vorlagen`, 70 Prüfungen** — auf Emojis, Höflichkeitsanrede,
  Rückzugsfloskeln aus der Verbotstabelle vom 19.08., Satzlänge, Frage am Ende
  und darauf, dass die drei Stufen wirklich drei verschiedene Nachrichten sind.
- **Die Quelle der Wahrheit im Vault** (`Outbound-Skripte 1b`) hat die drei
  Texte als eigenen Abschnitt „Kaskade nach der Erstnachricht" bekommen, mit
  dem Hinweis, dass Wortlaut-Änderungen dort **und** im Code passieren müssen.
- **`entwuerfeAnThreads` gilt jetzt für beide Entwurfs-Agenten.** Das bleibt aus
  dem verworfenen Ansatz erhalten und verbessert den manuellen Knopf auf
  `/linkedin`: Ein dort erzeugter Entwurf landet am Posten statt nur in der
  Run-Datei.

**Wieder entfernt:** `runner/linkedin/followupThreads.mjs`, die Zeit-Routine
`maybeFollowupEntwuerfe` und `verify-followup-entwuerfe`. Der manuelle Knopf
baut seinen Input in der App (`approvalDrafts.ts`), das Runner-Modul wäre ohne
die Automatik toter Code gewesen. Der Agent-Skill im Vault bleibt für den
Ausnahmefall bestehen — mit den Verbesserungen vom selben Tag (`thread_key` ist
Pflicht, Urteils-Block, kein Break-up-Ton mehr).

**An echten Daten belegt:** `followupPosten` liefert für alle **177 von 177**
fälligen Threads einen fertigen Text; keiner fällt wegen eines unbrauchbaren
Namens aus.

**Was das für die laute Kette bedeutet:** Sie bekommt jetzt überhaupt erst
Zufluss. Ein Thread braucht drei Haken (3/7/14 Tage), um auf Stufe 3 zu
kommen — die ersten Leads erreichen die Instagram-Stufe also frühestens in gut
drei Wochen. Bis dahin ist ihr Bestand 0, und das ist richtig so.

**Offen:** Das ICP-Rauschen bleibt sichtbar. Der Wortlisten-Filter erwischt nur
12 von 177; „5-10KG Fett in 90 Tagen" und „Fördergelder für Superchat" stehen
weiter in der Liste und werden von Hand übersprungen (ein Klick über
`disqualifiziere` in der Lead-Akte). Wenn das stört, wäre der nächste Schritt
ein Agent, der **nur urteilt** und keine Texte schreibt — deutlich billiger als
der verworfene Entwurfs-Agent.

---


## **GEBAUT 25.08.2026, MIGRATION OFFEN — Die Kette hört nach dem dritten Follow-up nicht mehr auf**

Anlass: Kevins Diktat vom 25.08. Der Hauptweg endete im Nichts. Nach drei
LinkedIn-Follow-ups (3/7/14 Tage) steht ein Thread im Bucket `abschluss`,
`leadStation` schob ihn nach `wartet_auf_antwort` mit `faellig: false` — und
dort lag er für immer. Das war der teuerste tote Punkt im Ablauf: Diese Leute
haben die Anfrage **angenommen**. Der Zugang ist bezahlt, nur die Antwort fehlt.

**Die laute Kette** (neu, `leadStation.lauteKette`), Zeiten ab dem letzten
Follow-up: **+7 Instagram-DM · +14 Analyse-PDF ungefragt · +21 handgeschriebene
Postkarte · +7 Anruf · dann Ruhe.** Danach kommt der Lead von selbst wieder.

Kevins Begründungen, die den Zuschnitt bestimmen:

- **Instagram steht vor der PDF, nicht parallel zur Erstnachricht.** Zwei
  Kanäle gleichzeitig lesen sich als bedürftig; derselbe Mensch an einem
  anderen Ort liest sich als Zufall. Der Kanalwechsel schlägt die vierte
  LinkedIn-Nachricht.
- **Die Postkarte steht vor dem Anruf.** Sie macht den Anruf warm — „ich hab
  Ihnen letzte Woche eine Karte geschrieben" ist ein Aufhänger, ohne sie wäre
  es ein Kaltanruf.
- **`RUHE_MONATE` von 6 auf 4.** Sechs Monate waren die vorsichtige Zahl, als
  die Kette nach dem dritten Follow-up endete. Jetzt hat ein Lead bis zur Ruhe
  sieben Berührungen über vier Kanäle hinter sich und ist eindeutig durch.
  Vier Monate heißt drei Zyklen im Jahr statt zwei.

**Was gebaut ist:**

- **Migration `0078`** erweitert `lead_ereignisse.typ` um `instagram` und
  `pdf`. Rein additiv, der CHECK wird nur weiter. Die Wartezeiten stehen
  bewusst **nicht** in der Datenbank, sondern an einer Stelle im Code —
  sie sind Kevins Einstellung, kein Schema.
- **`leadStation.ts`**: fünf neue Konstanten (`LAUT_*`), zwei neue Stationen
  (`instagram_faellig`, `pdf_faellig`), und `StationErgebnis.zweig`
  (`'still' | 'laut'`). Postkarte und Anruf kommen jetzt aus **beiden** Ästen,
  und der Unterschied bestimmt den Text: Wer nie angenommen hat, kennt Kevin
  überhaupt nicht; wer angenommen und nie geantwortet hat, hat Erstnachricht,
  Follow-ups, eine Instagram-Nachricht und eine fertige Analyse gesehen.
- Die Kette wird **rückwärts gelesen**: Was zuletzt raus ist, bestimmt den
  nächsten Schritt. Eine übersprungene Stufe hält damit nichts an — Postkarte
  ohne PDF führt zum Anruf, nicht zur nachgeholten PDF.
- `MIN_ABSTAND_TAGE = 7` gilt auch hier, und der neue Schritt **sagt es auch**,
  statt still zu warten (die Lehre vom 20.08.: Station und Fälligkeit sind
  zwei Dinge).
- Lead-Akte: Knöpfe „Instagram raus" und „Analyse-PDF raus", in
  Kadenz-Reihenfolge; InMail rutscht ans Ende, weil sie Nebenstrom ist.
  Die Kontakt-Zählung („wie oft habe ich den geschrieben") zählt beide mit.
- Pipeline und Tagesjournal übernehmen die neuen Stationen von selbst
  (`STATION_REIHENFOLGE`/`STATION_TITEL`); der laute Zweig steht vor dem
  stillen, weil seine Ausbeute je Handgriff die höchste im Bestand ist.
- Geprüft: `verify-lead-station` **47 ok** (vorher 28, 19 neue Prüffälle
  inklusive Doppelbeschuss, übersprungener Stufe und Zweig-Unterscheidung),
  alle **51** `verify-*`-Skripte grün, `tsc -b` und `npm run build` sauber.

**Bewusst NICHT gebaut — und warum:**

Die neue Kette bekommt **keine eigene Tages-Flow-Stufe.** Das hätte ein neues
`daily_metrics`-Feld gebraucht, und die Regel dagegen steht seit dem Rebuild im
HANDOFF („Keine neuen Metrikfelder"). Sie ist außerdem inhaltlich ein
Follow-up — Kevins Deckel von **20 am Tag** (`FOLLOWUP_PORTION_TAG`) ist genau
die Zahl, die er am 25.08. unabhängig noch einmal genannt hat. Die fälligen
Schritte stehen in der Pipeline unter „nur was heute dran ist"; ob sie
zusätzlich in `followupPosten` einlaufen sollen, ist erst nach einer Messung
zu entscheiden (siehe „Offen").

**Zwei Funde beim Messen an Prod (25.08.), beide gravierender als der Bau selbst:**

**1 · Die Archivierung kappte die neue Kette in dem Moment, in dem sie beginnt.**
`markDonePatch` archivierte einen Thread beim dritten Haken
(`followup_stage >= 3` → `status: 'archived'`). Ein archivierter Thread ist
`isTerminal`, `bucketOf` liefert `ruht` statt `abschluss` — die laute Kette
wäre nie erreichbar gewesen. Die Regel stammt aus der Zeit, als nach dem
dritten Follow-up tatsächlich nichts mehr kam. Der Thread bleibt jetzt **aktiv
auf Stufe 3** stehen und behält seinen Zeitstempel (er ist der Anker der
Kette: Instagram ist sieben Tage nach der letzten LinkedIn-Nachricht dran).
Ein Rückstau entsteht nicht, weil `isDue` ab Stufe 3 false liefert und
`followupPosten` nur `faellig` zeigt. Wer einen Thread wirklich schließen will,
setzt weiterhin von Hand `won`/`lost`/`archived` — das ist eine Aussage über
den Lead, kein Nebeneffekt des dritten Hakens. Prüffall 13h umgeschrieben,
`verify-linkedin-followups` **78/78**.

**2 · Die Follow-up-Ratsche läuft leer — und zwar vollständig.** An Prod
gemessen:

- **Alle 239 aktiven Threads stehen auf `followup_stage: 0`.** Kein einziger
  wurde je eine Stufe weitergeschaltet. Der Sync fasst die Spalte nicht an
  (`upsert.mjs` lässt sie bewusst aus dem Payload) — sie kann also nur durch
  Kevins Haken steigen.
- **`daily_metrics.li_followups` ist an jedem der letzten 21 Tage 0.**
  Zum Vergleich derselbe Zeitraum: `li_anfragen` konstant 30/Tag,
  `li_nachrichten` 72 gesamt. `inmails` und `looms` ebenfalls durchgehend 0.

Anfragen und Erstnachrichten laufen also, die gesamte Nachfass-Stufe nicht.
**Damit hängt die neue Kette hinter einem Schritt, der heute nicht stattfindet
— und dieselbe Diagnose trifft die 3/7/14-Follow-ups, die es seit Wochen
gibt.** Der Engpass sitzt eine Stufe früher als der Auftrag vom 25.08. annahm.
Das ist die nächste Runde, nicht diese: erst klären, warum der Haken nicht
gesetzt wird (Weg zu umständlich? falscher Ort? wird außerhalb des Cockpits
nachgefasst?), dann die Kette verdrahten.

**Offen:**

1. ~~Migration 0078 anwenden~~ — **erledigt 25.08.**, zusammen mit 0077 über
   `supabase db push`. Historie 0001–0078 lückenlos.
2. **Die Ratsche zum Laufen bringen** (Fund 2). Bis dahin ist der
   Anfangsbestand der lauten Kette **0** — sie ist gebaut und geprüft, aber
   ohne Zufluss.
3. **Instagram-Handles fehlen** — dieselbe Lücke wie bei E-Mail, Anschrift und
   Telefon im stillen Zweig. Die Station zeigt den fälligen Schritt, die
   Beschaffung ist eine eigene Runde.

---


## **GEBAUT 24.08.2026, MIGRATION OFFEN — Zuständigkeits-Stufe vor dem Loom**

Anlass: Ludwig Cords sagte „moin! klar!" zur Analyse. Er ist Senior
Investmentmakler beim Zinshausteam & Kenbo, einem Haus mit rund zehn
geschäftsführenden Gesellschaftern. Kevins Einwand: *„Wenn ich dem das jetzt
schicke, packt er es in seinen Ordner und geht damit zur Geschäftsführung. Und
ich werde nie wieder was von denen hören."* Der ICP ist ausdrücklich GF/Inhaber.

Ein „ja, schick rüber" von einem Angestellten ist damit kein Auftrag zum
Schicken mehr, sondern der Anlass für genau eine Rückfrage: wer entscheidet.

**Was gebaut ist:**

- **Migration `0077`** erweitert `loom_status` um den Wert `zustaendigkeit`.
  Der Stern bleibt unangetastet, er heißt weiter „hat zugesagt".
- Alle bestehenden Filter fragen auf `loom_status = 'offen'` ab. Ein Lead auf
  `zustaendigkeit` fällt dadurch **automatisch** aus der Loom-Spur, aus
  `arbeitsmodusQuellen.loomPosten`, aus `leadStation` und aus **Jophiels**
  Bauliste (`server/uriel.mjs` fragt dieselbe Bedingung ab). Kein zweiter
  Wahrheitsort.
- `funnelStufen.zustaendigkeitOffen` als eigene Stufe, im Trichter als fünfte
  Kachel „Zugesagt · Entscheider offen".
- Zwei Knöpfe an der Thread-Karte: **Entscheider offen** (nimmt ihn aus der
  Bauliste) und **Zuständigkeit geklärt** (gibt ihn frei).
- Geprüft: `verify-funnel-stufen` 38 ok, `verify-arbeitsmodus-quellen` 21/21,
  `verify-linkedin-followups` 75/75, `verify-wochenkontrolle` 14 ok, `tsc` sauber.

**Was die Zahlen tun werden:** Die Loom-Zahl sinkt, die Antwortzahl steigt.
Beides ist gewollt und kein Einbruch. Eine Analyse an einen Nicht-Entscheider
ist verschenkte Arbeit; eine Zuständigkeitsfrage erzeugt eine Antwort und
führt zur richtigen Person.

**Offen:** Migration 0077 ist noch nicht auf Supabase angewendet. Solange sie
fehlt, weist der CHECK-Constraint den neuen Wert ab und die Knöpfe laufen ins
Leere. Danach: Ludwig Cords und Jan Pieter Brünjes auf `zustaendigkeit` setzen.

---


## **FERTIG 19.08.2026 — Die Antworten-Spur zeigte die falschen Leute UND schrieb den falschen Ton**

Kevin ist die Spur einmal komplett durchgegangen. Fünf Befunde, alle an
Prod-Daten belegt, alle behoben (Migration **0075**):

**1 · Die Streak riss, obwohl der Tag stand.** Am 18.08. standen 37 von 39
Erstnachrichten im Zähler, weil Kevin zwei verworfen statt gesendet hat. Die
Zeile war grün („Liste leer"), die Serie zählte nur „Zähler ≥ Soll" und brach.
`sales_tagesportionen.erledigt_at` hält jetzt den Moment fest, in dem eine
Stufe steht; `stufeGruenAnTag` liest ihn und sticht damit den Zähler. Der
18.08. wurde von Hand nachgetragen. **0 von 0 zählte bereits korrekt** — die
Portion wird mit `soll: 0` eingefroren, und eine leere Pflicht ist erfüllt.

**2 · Der ICP-Filter liest die Headline, und die lügt.** „90 Tage: Leben,
Business und Energie im Einklang" (Coach) bekam einen Entwurf, „Lizenzpartner
Evernest" nicht. Wer da schreibt, steht nur in der **Nachricht** — und die
liest allein der Agent. Er vergibt jetzt je Thread ein `agent_urteil`
(`lead` / `kontakt` / `akquise`), das an den Thread geschrieben wird.
`akquise` fliegt dauerhaft aus der Spur (Anzeige **und** nächster Lauf) und
steht aufklappbar darunter. Die Wortlisten bleiben als Vorfilter.

**3 · Fünf echte Makler hatten nie einen Entwurf.** Cäcilia Page, Janis
Stomeo, Natalie Kloppe, Silvio Tantulli (35–22 Tage). `ANTWORT_MAX` von 10 auf
**18** — der Lauf vom 19.08. brauchte für zehn Entwürfe 2:21 Min, das passt.

**4 · Der Ton war der eines Bittstellers.** 14 von 31 Altentwürfen enthielten
eine verbotene Floskel. Kevins Urteil zu „dann lass ich dich in Ruhe": *„Das
zeigt schon, dass ich das Gefühl habe, jemand zu sein, der stört."* Zu „Sie
wissen, wo Sie mich finden": *„Die wird sich niemals bei mir melden, niemals.
In der Zeit haben schon fünfzehn Leute zwischenzeitlich bei der angerufen."*
Der Skill `linkedin-antwort-entwuerfe` hat jetzt eine Verbotstabelle
(Entschuldigung für Verspätung, Rückzugsfloskel, Empfehlungsbitte,
konstruierter Lebenslauf-Bezug) und eine Haltung zur Absage: **eine** charmante,
leicht ungläubige Rückfrage statt Rückzug — *„nur weil jemand einmal sagt, hab
ich keinen Bock drauf, heißt das noch lange nicht, dass er es nicht braucht."*

**5 · „älteste 219 Tage" nannte keinen Namen.** Kevins Frage: *„Welcher von
denen ist jetzt 219 Tage alt?"* Die Zeile nennt jetzt die Person.

### Neu: die Wochenkontrolle (`wochenkontrolle.ts`, Zeile „Neben dem Ritual")

Kevins Bauchschmerz: *„Wir entwickeln viele Regeln, die die falschen Leute
raushalten. Aber ich bin mir nicht sicher, ob die Leute, die rein müssen, auch
wirklich reingekommen sind."* Jede andere Ansicht zeigt, wer **drin** ist —
diese zeigt für sieben Tage, wer angenommen hat und **nicht** angeschrieben
wurde, getrennt nach *aussortiert* (die einzige Liste, in der ein Fehler
stecken kann — mit Headline und auslösendem Filterwort), *noch offen* und
*angeschrieben*. Keine zweite Wahrheit: die Zuordnung kommt aus
`angenommenOhneErstnachricht`, das Urteil aus `icp.ts`.

**Prüfbar:** `verify-wochenkontrolle` (14), `verify-sales-streak` (29, drei
neue Fälle), dazu unverändert grün: `verify-antwort-entwuerfe`,
`verify-entwuerfe`, `verify-icp`, `verify-tages-flow`.

**Offen:** Die 31 Altentwürfe im alten Ton hängen noch an den Threads — der
Agent überspringt sie, weil sie „frisch" sind. Sie müssen einmal geleert
werden, damit der neue Skill sie ersetzt. Sicherung liegt im Scratchpad.

## **FERTIG 18.08.2026, ~18:30 — Die Antworten-Spur zeigte 29, gearbeitet wird an 11**

Kevins Befund am Fenster „Antworten · 29 warten · älteste 492 Tage": *„Erst mal
dieses älteste 492 Tage — ich hab erst seit Januar diese Zielgruppe. Dann:
erster, zweiter, dritter, vierter sind schon mal alles keine ICPs. Zusätzlich
ist da die Nachricht drin, die die mir geschickt haben und nicht ich an die.
Und die Leute, die gesagt haben, jawoll, schick mir 'n Loom rüber — den muss
ich ja nicht antworten, also müssen die auch da raus."*

Alle vier Punkte trafen zu. An den Prod-Daten nachgemessen waren es **drei
unabhängige Ursachen** in einer Liste:

| Ursache | Menge | Regel jetzt |
|---|---|---|
| Loom zugesagt → stand in **beiden** Spuren | 13 | Stern + `loom_status: 'offen'` gehört in die Loom-Spur, nicht in Antworten |
| Post von vor der Makler-Akquise (April/Mai 2025) | 4 | `AKQUISE_START = 2026-01-01` — davor ist Kaltakquise **an** Kevin |
| Kunde als Lead behandelt (Norbert, Oliver) | 2 | Namensabgleich gegen `contacts` (`won_at` oder `pipeline_stage: 'deal'`) |

**29 → 11.** Die älteste Zeile ist statt 492 nun 218 Tage alt und gehört Kevin
wirklich. Nichts verschwindet still: Off-ICP und Vor-Akquise stehen aufklappbar
unter der Liste, zugesagte Looms eine Zeile tiefer im Tages-Flow.

Die Loom-Doppelung hing an einer Lücke zwischen zwei Filtern: `loomPosten`
prüfte `starred && loom_status === 'offen'`, `antwortPosten` prüfte den Stern
gar nicht. Bewusst an `loom_status` geknüpft und nicht am Stern allein —
schreibt jemand **nach** dem verschickten Loom erneut, wartet er wieder auf
eine Antwort und gehört zurück in die Spur.

### Zerschossene Umlaute brachen den Namensabgleich

Kevin: *„Jetzt finde ich Maurice Jüngling nicht, weil er Maurice Jnglin heißt…
und außerdem hat er schon eine Nachricht."* LinkedIn liefert ihn in Postfach
**und** Netzwerk ohne das ü — der Schlüssel wirft Akzente ab (ü → u), gegen ein
**fehlendes** Zeichen hilft das nicht: `junglin` ≠ `jnglin`.

Der Abgleich hat jetzt einen zweiten, engen Versuch: gleicher Vornamen-Anfang,
Nachname ≥ 5 Zeichen, genau ein abweichendes Zeichen, und **mehrdeutige Fälle
zählen nicht**. An Kevins Bestand gemessen (118 Leads, 198 Threads): **ein**
zusätzlicher Treffer, **null** Kollisionen. Wer die Schwellen ändert, misst neu.

Dazu die eigentliche Abhilfe gegen „ich finde ihn nicht": Erstnachrichten
tragen jetzt einen **LinkedIn-Profil-Link** (aus `linkedin_netzwerk`, das eine
`profile_url` führt — `linkedin_erstnachrichten` hat keine). Kein Suchen nach
einem Namen mehr, der anders geschrieben ist, als LinkedIn ihn kennt.

### ICP-Regeln: englische Makler-Formulierungen ergänzt

`broker`, `realty`, `property`, `sotheby`, `estate agent`, `selling houses` —
sieben Threads waren als `unklar` einsortiert, obwohl es Makler sind (Sandra
Furrer/Sotheby's, Diego Büchel, Claudia Scheer, Fabian Wohlleben …). Kern
108 → 113, unklar 50 → 45.

### Offen

- **13 Alt-Entwürfe auf Off-ICP-Threads** (vor dem Gate vom 18.08. erzeugt) —
  die Threads sind ausgeblendet, die Entwürfe stehen noch in der Spalte.
  Einmalig leeren, wenn Kevin es sagt.
- **Die 45 „unklar"** trennt kein Wortfilter mehr sauber: dort stehen Makler
  mit kreativen Headlines neben Coaches ohne Off-Wort. Nächster Schritt wäre
  ein einmaliger Klassifizierungs-Lauf, der das Urteil an die Zeile schreibt.

## **LIVE seit 18.08.2026, ~16:15 — Warum Leads faelschlich als „offen" galten**

Kevins Befund an der frisch gebauten Erstnachrichten-Zeile: „Bernd Herfurth und
Célie-Helén Helinurm haben doch schon eine Nachricht gehabt? Jonas Jacobi
auch... woran haben wir die letzten Wochen gearbeitet?" — und die Nachfrage,
die den Unterschied machte: **„ich will nicht, dass du das nur bei denen
fixt."** Zu Recht: an den Prod-Daten nachgemessen waren es **zwei unabhängige
Ursachen**, und die größere hatte mit den drei Namen nichts zu tun.

### 1. Die Postfach-Abdeckung — die eigentliche Ursache

Der Alltags-Sync blättert 30 Tage zurück. Die Begründung stand als Tatsache im
Code: *„der einmalige Tiefenscan ist gelaufen, ältere Threads liegen bereits in
der DB."* Sie war falsch. **39 Threads aus Kevins Postfach standen nie in der
Tabelle**, teils aus 2025 — der Scan vom 28.07. hatte sie übersehen, und ein
Fenster, das nur vorwärts schaut, holt sie nie ein. Bernds Chat ist vom 12.01.:
für das System existierte er nicht.

Ein Zeitfresser kam dazu: `node runner/linkedin/sync.mjs` **schreibt nie in die
Datenbank**, auch ohne `--dry-run`. Ein Tiefenscan von Hand sah aus, als hätte
er nachgetragen — er tat es nicht. Steht jetzt am Code.

| Zug | Ergebnis | Datei |
|---|---|---|
| Fenster je Aufruf | `syncThreads({ scanTage })` statt einer Modul-Konstante; unbrauchbare Werte fallen auf den Standard zurück | `runner/linkedin/sync.mjs` |
| Wöchentlicher Tiefenscan | Der Runner fährt `TIEFENSCAN_TAGE = 400` beim ersten Sync nach dem Start und danach wöchentlich (~12 s, 10 Seitenaufrufe) | `runner/index.mjs` (`maybePostfachSync`) |
| Sichtbar im Log | `postfach-sync (Tiefenscan): … · N neu` statt eines stillen Laufs | `runner/index.mjs` |
| Lücke geschlossen | 38 fehlende Threads nachgetragen: **DB 160 → 198** (= alles im Postfach) | einmaliger Lauf |

### 2. Der Namensabgleich — der sichtbare Teil

Der exakte Vergleich verlor zwei echte Treffer, deren Threads längst in der DB
lagen: `Célie-Hélène` vs. `Célie-Helén` (LinkedIn schreibt denselben Menschen
je nach Quelle anders) und `Jonas Jacobi & Moritz Wagner` vs. `Jonas Jacobi`
(die Lead-Liste führt Bürogemeinschaften als Doppelnamen).

`personenSchluessel` vergleicht jetzt **Nachname + die ersten vier Zeichen des
Vornamens**, akzentfrei und ohne Zweitnamen. An Kevins Daten gemessen (198
Threads, 118 Leads): **null Kollisionen, zwei zusätzliche Treffer.** Die
Gegenrichtung ist als Test festgehalten — Michael und Martina Schmidt bleiben
getrennt, denn ein verlorener offener Lead ist teurer als einer, der einmal zu
viel dasteht.

### Wirkung

Von **113** als „offen" verbuchten Erstnachrichten sind **33 wirklich offen**.
80 haben längst einen Chat, **16 davon haben geantwortet** — die gehören in die
Antworten-Zeile, nicht in die Erstnachrichten.

**Neu:** `verify-postfach-tiefenscan` (13 Fälle) hält die widerlegte Annahme
draußen; `verify-erstnachrichten-offen` von 8 auf 14 Fälle, **Kevins drei Namen
stehen namentlich drin** — eine Zahl mit Datum überlebt den nächsten Umbau, eine
allgemeine Warnung nicht. 47 verify-Skripte grün, Build grün. Der Runner wurde
neu gestartet (launchd, `KeepAlive`), damit der Tiefenscan greift.

---

## **LIVE seit 18.08.2026, ~15:15 — Der Name ist jetzt ein Kopier-Griff**

Kevins Nachtrag: „Ich muss den Namen anklicken können, um diesen zu kopieren.
Ich muss auf LinkedIn erst nach dem Namen suchen und dann die Nachricht
kopieren und einfügen."

Der Name war bisher nur der Aufklapp-Schalter — markieren musste er von Hand,
was am Handy am zuverlässigsten scheitert. Jetzt tut **ein** Tipp beides: Name
in die Zwischenablage, Nachricht klappt darunter auf. Die Reihenfolge trägt
das — Name (suchen) kommt vor Text (einfügen), und „Kopieren" überschreibt
danach bewusst, nie andersherum. Rückmeldung am Desktop neben dem Namen, am
Handy als erstes Meta-Element (dort ist neben dem Titel kein Platz).

**Dazu eine Rückfallebene für BEIDE Kopier-Wege.** `navigator.clipboard`
scheiterte im Vorschau-Browser reproduzierbar mit `NotAllowedError` (Safari ist
hier historisch eigen); dann greift `execCommand` über ein unsichtbares
Textfeld. Veraltet, aber es funktioniert genau dort, wo die moderne API
aussteigt — und ein „Zwischenablage gesperrt" bei jedem zweiten Namen wäre in
Kevins LinkedIn-Runde teurer als eine veraltete Zeile Code.

**Am laufenden Cockpit belegt** (echter Klick, nicht synthetisch): die
Zwischenablage ändert sich wirklich, „Name kopiert" erscheint (per
MutationObserver nachgewiesen, die Anzeige steht nur 2 s), der Text klappt auf,
und der Sperr-Hinweis bleibt weg — vor dem Fallback stand er da.

---

## **LIVE seit 18.08.2026, ~14:40 — /sales wird der Tages-Flow** (Kevin: „von oben nach unten abarbeitbar")

**LIVE auf Kevins Wort** („bitte alles zusammen live bringen“):
Fast-Forward `81a6b0f → e2fb366` auf `main`, Netlify hat deployt. Migration
**0074 ist eingespielt** (`db push`); `migration list` meldet 74 von 74, keine
offen.

**Beleg am ausgelieferten Bundle** (`index-BAEGf90O.js` — der Hash weicht vom
lokalen ab, weil Netlify mit eigenen Env-Variablen baut): neun Marken dieser
Runde nachweisbar — „Neben dem Ritual“, „Portion für heute“, „Reaktionszeit
zählt“, „Liegt still“, „seither gebucht“, „Postfach-Stand“, „Wer angenommen
hat“, „Zugesagte Analysen“, „Nie angenommene Anfragen“. **Gegenprobe
bestanden:** „Kundenarbeit“ und „Werkzeuge bereit“ sind aus dem Prod-Bundle
verschwunden. („Jetzt dran“ steht weiter drin — das ist das Home-Widget
`JetztDran.tsx`, nicht die gefallene Sales-Kachel.) `/`, `/cockpit`, `/sales`
und `/portal` antworten 200.

Im selben Fast-Forward ging die parallele Runde des Tages mit live (Commit
`e2fb366`): Agenten-Schleuse, die echte Erstnachrichten-Zahl und die
Widerspruchs-Meldung. Die Schleuse ist Runner-Code und steht deshalb nicht im
Browser-Bundle; `widersprueche` ist dort nachweisbar.

**Nicht im Repo** (18.08., `.gitignore`): `identity-os-bilder/` (127 MB) und
die großen HTML-Arbeitsstände `visionmap-2.0.html` / `lebensstil.html`. Sie
gehen ohnehin nicht live — Netlify baut nur `app/` — und hätten die History
dauerhaft aufgebläht.

Kevins Befund am Kachel-Raster: elf gleich aussehende Karten, „219 offen" als
Angst-Zahl obenauf („die erschlagen mich, und die hat auch einfach keine
richtige Funktion"), 30/30 Anfragen sehen aus wie eine offene Aufgabe,
„Kundenarbeit" heißt komisch und ist zu präsent, obwohl er dort auf den
Kollegen wartet, und den Zahlen traut er nicht („bei den Looms bin ich mir
nicht sicher, ob die Zahl korrekt ist", „150 Credits — ist das getrackt oder
einfach eine Zahl?").

### Der Umbau

| Zug | Ergebnis | Datei |
|---|---|---|
| **Reihenfolge neu diktiert** | Sechs Stufen statt fünf: Anfragen → **Erstnachrichten** → **Antworten** → Follow-ups → InMails → Looms. Erstnachrichten und Antworten waren vorher EINE Stufe („nachrichten") — für Kevin sind es zwei Stationen | `lib/tagesFlow.ts` |
| **Zwei Stufen-Arten** | `zaehler` (Soll erreicht = grün) und **`frische`** (Antworten: grün, solange keiner > 24 h wartet). 43 dürfen warten, solange keiner von vorgestern ist — bei Antworten zählt Reaktionszeit, nicht Vollständigkeit | `lib/tagesFlow.ts` |
| **Follow-up-Drossel** | Statt 200 fälliger Threads zieht die Stufe eine Tagesportion (20). Eine Zeile, die nie grün wird, ist keine Routine, sondern ein Vorwurf. Der Rückstand steht als eine ruhige Zahl in der Unterzeile | `lib/tagesFlow.ts` (`FOLLOWUP_PORTION_TAG`) |
| **Portionen einfrieren** | Neue Tabelle `sales_tagesportionen`: beim ersten Öffnen des Tages wird das Soll festgeschrieben. Ohne das ist „20/20" ein bewegliches Ziel — um 14 Uhr sind es 23, weil neue Fälle nachrutschten, und die Stufe wird nie grün. Zugleich das Gedächtnis für die Streak | `0074_sales_tagesportionen.sql`, `lib/useTagesPortionen.ts` |
| **Soll schrumpft nicht unterm Haken** | Aus-den-Daten-Solls rechnen `offen + heute erledigt` — sonst fiele „7/7" beim Abhaken auf „4/4" zurück | `lib/tagesFlow.ts` (`sollFuer`) |
| **Leere Pflicht = erfüllt** | Ist die Quelle leer (Erstnachricht verworfen statt gesendet), gilt die Stufe als erledigt statt für immer rot zu bleiben | `lib/tagesFlow.ts` |
| **Streak je Zeile** | Werktage, ein Freeze pro Woche (auch am Serien-Kopf: Freitag beim Kunden, Montag früh geöffnet → Serie lebt), laufender Tag bricht nichts. Ein Tag ohne eingefrorene Portion ist KEIN Urteil — die Serie beginnt sauber bei der Einführung | `lib/salesStreak.ts` |
| **4-Uhr-Tagesgrenze** | Der Metrik-Tag wechselt um 4 Uhr, nicht um Mitternacht. Ein Loom um 0:30 gehört zu Kevins „gestern" (Commits um 01:25 sind im Log) | `lib/metricsDates.ts` (`heutigesMetrikDatum`) |
| **InMail-Stand wird ehrlich** | Kevins Frage „getrackt oder einfach eine Zahl?" hatte die Antwort „Zahl". Jetzt: Stand mit Datums-Stempel, Anzeige zieht seither gebuchte InMails ab, Tagesration (0 von 5) vorne, Pool + Reichweite dahinter | `lib/inmailStand.ts`, `components/InmailPanel.tsx` |
| **Daten-Frische sichtbar** | „Postfach-Stand: vor 2 h" aus `last_synced_at`. Die 18 Looms sind vielleicht nicht falsch, sondern alt — ohne den Hinweis liest sich eine alte Zahl wie eine falsche | `pages/SalesDashboard.tsx` |
| **Projekte statt „Kundenarbeit"** | Umbenannt, unter das Ritual verschoben, ohne Alarm-Optik („Liegt still" statt „Liegt zu lange > 14 Tage" in Warnfarbe). Blockiert ≠ überfällig | `pages/SalesDashboard.tsx` |
| **Gefallen** | „Jetzt dran" (die 219 — der Flow ersetzt sie; alte `?kachel=jetzt-dran`-Links öffnen jetzt die erste offene Zeile), „Quoten" (Wochen-Thema, wohnt in `/tracking`), „Werkzeuge" (wohnt in `/agenten`) | `pages/SalesDashboard.tsx` |

**Eine Abfrage, eine Zahl.** Die Zahl auf einer Zeile ist buchstäblich die
Länge der Liste, die sich hinter ihr öffnet (`flowQuellen`) — nie ein zweiter
Rechenweg. Genau das war der 78-Erstnachrichten-Fehler vom 17.08.

**Belegt:** `tsc -b` grün · `npm run build` grün (3,1 s) · **46 verify-Skripte
grün**, darunter neu `verify-sales-streak` (26 Fälle) und
`verify-inmail-stand` (7); `verify-tages-flow` von 61 auf **101 Fälle**
gewachsen, `verify-zaehl-modus` auf 48, `verify-ladezustand` auf 46. Optik in
`/dev/sales-vorschau` gegengesehen (Screenshot an Kevin), Konsole fehlerfrei.

**Offen für Kevin:** Zahlen-Prüfung an den echten Daten (Looms 18, InMail-Pool)
— dafür muss er eingeloggt draufschauen; die Dev-Vorschau läuft auf Fixtures.

---

## **LIVE seit 18.08.2026, ~12:30 — Prüfung der ganzen Kette** (Kevin: „prüfe alles")

Anlass war Kevins Satz: „Jedes Mal, wenn ich anfangen möchte, komm ich an
irgendwas, was wieder nicht funktioniert." Geprüft wurde die Kette in der
Reihenfolge, in der ein Fehler alles Nachfolgende entwertet: Scraping →
ICP-Filter → Leads → Entwürfe → Tracking.

### Der Fund: das Postfach hatte gar keine Routine

`syncThreads` wurde an genau zwei Stellen gerufen — **beide sind
HTTP-Endpunkte.** Morgenbrief, Antwort-Entwürfe, Netzwerk-Sync und Wächter
liefen von selbst; ausgerechnet die Quelle, aus der Antworten, Entwürfe und
Follow-up-Stufen stammen, lief nur auf Knopfdruck. Am 18.08. um 12:20 war der
jüngste Postfach-Stempel der **17.08., 13:52** — 22 Stunden alt. Der Wächter
schwieg, weil sein Schwellwert bei 48 Stunden liegt.

Damit schrieb der Entwurfs-Agent um 6:00 Antworten auf dem Stand von gestern
Mittag.

| Zug | Ergebnis | Datei |
|---|---|---|
| Postfach als Routine | Zwei Stunden Takt, 6–20 Uhr, auch am Wochenende (Antworten kommen nicht nur werktags). Mit derselben Vorprüfung wie jede andere Routine — Mac wach, Netz, Sync-Chrome | `runner/index.mjs` (`maybePostfachSync`) |
| Reihenfolge erzwungen | Die Antwort-Entwürfe warten jetzt, bis das Postfach in den letzten sechs Stunden gesynct wurde, und stoßen den Sync selbst an, falls nicht | `runner/index.mjs` (`postfachFrisch`) |
| Beim Aufwachen zuerst | Der Nachfass-Check nach dem Aufklappen zieht das Postfach mit — vorher wartete es auf den nächsten Fünf-Minuten-Tick, während die Entwürfe schon liefen | `runner/index.mjs` (`planeNachDemAufwachen`) |
| Live belegt | `[12:23:17] postfach-sync: 38 Threads` · Stempel jetzt von heute statt von gestern | — |

### Was geprüft wurde und in Ordnung ist

- **ICP-Filter:** Kein Code, sondern eine Regel im Skill `linkedin-leads`. Gegen
  das Ergebnis geprüft: **0 Off-ICP-Treffer** unter allen 118 Erstnachrichten,
  alle 118 mit zugeordneter Firma, 6 ohne Website (dort ausdrücklich vermerkt).
- **Antwort-Entwürfe:** 30 Stück, stichprobenhaft zehn gelesen. Kevins Ton,
  jeder greift die konkrete letzte Nachricht auf, Off-ICP-Kontakte (Recruiter,
  Personal-Brander, Agenturen) werden höflich abmoderiert statt bearbeitet.
- **Postfach-Sync selbst:** Dry-Run `partial: false`, sauber bis zur
  30-Tage-Grenze, zwei Seiten geholt.
- **Funnel- und Follow-up-Logik:** 38 + 75 + 21 Prüffälle grün.

### Was nicht in Ordnung ist — und was das heißt

**Das KPI-Tracking ist faktisch leer.** Von 21 Feldern in `daily_metrics` werden
**zwei** benutzt: `li_anfragen` (21 von 23 Tagen) und `li_nachrichten` (5 Tage).
Antworten, Termine, Looms, InMails, Abschlüsse, Umsatz — durchgehend null.

Das ist kein technischer Defekt: Die Tabelle steht, das Schreiben funktioniert.
Es füllt nur niemand. Und die Rohdaten liegen im System: 43 Threads mit
`last_from = 'them'` sind Antworten, `loom_status` trägt die Looms, die
Erstnachrichten tragen ihren Versandstatus. Solange daraus nichts abgeleitet
wird, ist keine Funnel-Quote rechenbar — genau die Zahl, um die es beim
Sales-KPI-System ging. **Eigene Entscheidung, eigene Runde.**

**Migration 0071 fehlt weiterhin in der Prod-Datenbank.** Der Spiegel weicht auf
das alte Konflikt-Ziel aus und funktioniert (118 Zeilen, 0 Doppel, zuletzt
gespiegelt 12:22). Aber die Schwäche bleibt: Formuliert Kevin eine
Gruppen-Überschrift im Vault um, legt der Spiegel die Gruppe ein zweites Mal an
— am 14.08. waren das 145 Zeilen für 118 Leads. Ohne DB-Passwort ist die
Migration von hier aus nicht anwendbar.

| Zug | Ergebnis | Datei |
|---|---|---|
| Wächter gegen die Doppelung | Solange 0071 fehlt: Stehen mehr Zeilen in der Tabelle als Leads in der Quelldatei, ist das ein dringender Befund mit Handgriff | `runner/widersprueche.mjs` (Satz 3b) |
| Poll-Rauschen abgestellt | „Auftrags-Abfrage fehlgeschlagen" erst nach **drei** Fehlschlägen in Folge (~12 Sekunden ohne Draht). Ein einzelner Aussetzer bei einem 4-Sekunden-Takt heilt sich selbst; täglich geloggt gewöhnt man sich daran und übersieht die echte Serie | `runner/index.mjs` (`pollJobs`) |

**Verifikation:** 9 Drift-Wachen grün (32 · 31 · 25 · 33 · 38 · 17 · 38 · 21 ·
75 Fälle). Widerspruchsband live bei **einem** Befund, und der ist Kevins Klick.

## **LIVE seit 18.08.2026, ~12:00 — Der Wächter meldete zwölf und übersah neunhundert**

Kevin: „widersprüche sind noch da". Vier Befunde standen im Band. Am Ende war
**einer** davon echt — und der größte Ausfall des Tages stand in keinem.

### Der Fund: Chrome fror die Seite ein, der Scraper hielt das für das Listenende

| Zeitpunkt | Geerntet |
|---|---|
| 17.08., 17:46 | 953 von 959 Einladungen |
| 18.08., 07:05 | **10** von 958 |
| 18.08., 11:38 | **40** von 957 |

Am Tab gemessen: `document.visibilityState` = **hidden**, Seitenhöhe 739 px. Das
Sync-Chrome-Fenster liegt im Alltag hinter Kevins Arbeit, und Chrome drosselt
unsichtbare Seiten bis zum Stillstand — LinkedIns Nachladen hängt an
IntersectionObserver und rAF, also genau daran. Nach fünf Runden ohne Zuwachs
bricht die Schleife ab; sie hielt die Drosselung für das Ende der Liste.

`Page.bringToFront` (seit dem 12.08. im Code) half nicht: Es holt den Tab
INNERHALB seines Fensters nach vorn. Liegt das Fenster hinter anderen, bleibt
die Seite `hidden`.

| Zug | Ergebnis | Datei |
|---|---|---|
| Sichtbarkeit vorspielen | `Emulation.setFocusEmulationEnabled` + `Page.setWebLifecycleState('active')` — reine Renderer-Emulation, es springt kein Fenster vor den Bildschirm. An **drei** Stellen verankert: beim Verbinden, nach der Navigation (anderer Renderer) und nach jeder Sitzungs-Erneuerung | `runner/linkedin/netzwerk.mjs` |
| Gegenprobe | 15 Runden auf der Einladungsliste: **40 → 160**. Danach voller Lauf: **950/957 und 648/660, beide `vollstaendig: true`** | — |
| Auch im Postfach-Sync | Dort holt `fetch` die Threads, das ist unbetroffen — aber der eine DOM-abhängige Schritt (`listeAnstossen`, der LinkedIn dazu bringt, seine Blätter-Query abzufeuern) klemmt genauso. Klemmt er, syncht der Lauf still nur die erste Seite, und es gibt keine Gesamtzahl, an der das auffiele. **Eingebaut, aber nicht separat verifiziert** — das zeigt der nächste reguläre Lauf | `runner/linkedin/sync.mjs` |

### Der blinde Fleck: ein abgebrochener Lauf hinterließ keine Spur

`schreibeMeta` läuft nur bei vollständigen Läufen (zu Recht — am 12.08. kippten
50 von 882 Einträgen die InMail-Kachel auf 50). Damit war ein Teil-Lauf in der
Meta **unsichtbar**: Der Wächter las die Zahlen von gestern und meldete „12
fehlen", während dreimal hintereinander neunhundert fehlten.

| Zug | Ergebnis | Datei |
|---|---|---|
| Abbruch-Vermerk | Eigenes Feld `letzterAbbruch` neben den Vollständigkeits-Zahlen, die es weiterhin nicht anfassen darf. Der nächste vollständige Lauf räumt es ab | `runner/linkedin/netzwerkUpsert.mjs` |
| Neue Regel | Nicht mehr „geerntet vs. Kopfzahl", sondern „ist der letzte Lauf durchgelaufen oder abgebrochen". Unter einem Viertel der Liste: **hoch** statt mittel | `runner/widersprueche.mjs` (Satz 3) |

### Zwei Fehlalarme, beide mit Beleg abgeräumt

**„12 fehlen" war nie behebbar.** Nach dem vollständigen Lauf standen 648
Kontakte in der Datenbank — und im DOM der Seite exakt dieselben 648 eindeutigen
Profile, bei „660 Kontakte" im Kopf. LinkedIn zählt dort mit, was keine
anklickbare Karte hat (gelöschte und gesperrte Konten, Einladungen an blanke
E-Mail-Adressen). Der Scraper hatte alles.

**„8 Kontakte gelten als Einladung offen"** ist Kevins InMail-Welle: Alle acht
standen am 18.08. nachweislich noch auf der Einladungsliste, zwei haben sogar
geantwortet, ohne anzunehmen. Die Regel „wer schreibt, hat angenommen" stimmt
nicht mehr, seit gezielt Leute mit OFFENER Anfrage angeschrieben werden. Sie
greift jetzt nur noch, wenn der Eintrag beim letzten vollständigen Lauf **nicht
mehr gesehen** wurde — dann ist „offen" ein Datenrest.

**Zwei eigene Fehler auf dem Weg dorthin, beide erst an den Echtdaten
aufgefallen** — die Attrappen im Verify waren grün:

1. Verglichen wurde gegen die zuletzt gelaufene Liste statt gegen die eigene.
   Einladungen waren 11:48 fertig, Kontakte 11:51 — schon erklärte das jeden
   Einladungs-Eintrag für veraltet.
2. Der Stempel-Vergleich lief über Zeichenketten. Postgres liefert
   `…281+00:00`, `toISOString()` schreibt `…281Z` — derselbe Moment, aber `+`
   sortiert vor `Z`. Damit galten alle 950 frisch gesehenen Einladungen als
   veraltet, und die Regel meldete exakt dieselben acht Fehlalarme wie vorher.

Beide Fallen stehen jetzt als Fälle in der Drift-Wache — der Format-Fall
wortgleich mit den echten Stempeln.

**Ergebnis:** 4 Befunde → **1**, und der ist echt: die 78 Erstnachrichten, die
laut Postfach längst raus sind. Ein Klick auf „Als verschickt verbuchen" im
LinkedIn-Bereich. Live gegengemessen, Runner-Log 11:59: `wächter: 1
Widersprüche (1 dringend)`. Drift-Wachen grün: `verify-widersprueche` 26/26 ·
`verify-agenten-gesundheit` 17/17 · `verify-schleuse` 31/31 ·
`verify-start-bereit` 25/25 · `verify-lauf-grund` 33/33 ·
`verify-routine-guard` 38/38.

## **LIVE seit 18.08.2026, ~10:50 — „Es wird doch immer noch als fehlerhaft angezeigt"** (Nachschlag, deployt)

Kevins Screenshot um 10:44, Handy, `frameworkos.de`:

    ⚠ 2 Agenten sind heute gescheitert: linkedin-antwort-entwuerfe,
      morgenbrief — Nicht angelaufen — ansehen

Die neue Einordnung war also schon durchgereicht („Nicht angelaufen" statt
„Zeitlimit erreicht") — aber die Oberfläche wertete sie weiter als Fehlschlag.
Und das, obwohl **beide Agenten um 10:07 sauber durchgelaufen waren.**

Zwei Lücken in `agentenBefund`, beide in derselben Funktion:

| Lücke | Was falsch war | Regel jetzt |
|---|---|---|
| Erfolg räumt nicht auf | Die Regel „ein Erfolg danach hebt den Befund auf" galt seit dem 17.08. nur für den **Sperrbalken** (`handlungsbedarf`), nicht für die rote Zeile darunter. Die zählte stur alle `error`-Läufe des Tages | Ein Fehlschlag, auf den ein erfolgreicher Lauf **desselben Agenten** folgt, ist erledigt. Der Erfolg eines anderen räumt nichts ab — sonst deckt ein gelungener Dream-Check den fehlenden Morgenbrief zu |
| Fehlstart galt als Scheitern | Ein Lauf, den der schlafende Mac verschluckt hat, stand rot in der Liste — und ließ den Agenten zugleich als „hat heute stattgefunden" gelten | `fehlstart` ist kein Fehlschlag, sondern ein Nicht-Ereignis: keine rote Meldung, aber der Agent bleibt **ausstehend**. Genau das soll dort stehen, wenn der Mac einen Vormittag durchschläft |

| Zug | Datei |
|---|---|
| Beide Regeln, mit Begründung am Code | `app/src/cockpit/lib/agentenGesundheit.ts` |
| `fehlstart` im Typ ergänzt (der Runner schickt ihn seit heute) | `app/src/cockpit/lib/runnerApi.ts` |
| Drift-Wache, 17 Fälle — der Kern ist der Screenshot von 10:44 als Testfall | `scripts/verify-agenten-gesundheit.ts` (neu; im Dateikopf seit dem 07.08. erwähnt, aber nie angelegt) |

**Verifikation.** `tsc --noEmit` grün · `verify-agenten-gesundheit` 17/17 · Build
**CSS hash-identisch** mit dem live stehenden Stand (`index-DCeg9aTh.css`) —
der Beleg, dass der Deploy keinen fremden Zwischenstand mitschleppt. Vor dem
Deploy im ausgelieferten Bundle nachgemessen, dass der uncommittete
App-Arbeitsstand vom 17.08. **bereits live war** (Marker „zwei Quellen nicht
übereinstimmen" im alten Bundle) — sonst wäre dieser Deploy eine ungeprüfte
Live-Schaltung gewesen. Nach dem Deploy im Browser gegengemessen:
`index-YBPJMzgV.js`, Fix drin, Widerspruchsband unverändert drin.

## **LIVE seit 18.08.2026, ~10:25 — Die Schleuse: einmal vorne prüfen statt hinten viermal scheitern** (Nachschlag)

Kevins Einwand direkt nach dem Umbau oben: „Auch dass die Agenten immer einzeln
scheitern — können wir nicht einen vorab checken lassen, ob wir angemeldet sind
und überall reinkommen, und erst dann die anderen loslegen?"

Genau das war das Bild vom 12./13. und 17.08.: Die Anmeldung der Claude-CLI
lief ab, und **jeder Agent stellte das für sich selbst fest** — eigene
Run-Datei, eigene rote Zeile, eigener Verbrauch am Tagesdeckel. Vier Zeilen für
einen einzigen Umstand, und die Ursache stand nur in der Mitschrift, nicht in
der Liste.

| Zug | Ergebnis | Datei |
|---|---|---|
| Vier Prüfungen, einmal | Vault beschreibbar (iCloud) · `claude auth status --json` · Supabase antwortet · dazu der echte CLI-Probelauf. Gemessen: 1,5 s für die drei schnellen, 7 s für den Probelauf | `runner/schleuse.mjs` (neu) |
| Der Probelauf | `auth status` liest nur lokalen Zustand — eine Sitzung, die erst beim Zugriff als abgelaufen auffällt, sieht dort gültig aus (genau die Form vom 12.08.). Ein Ein-Wort-Prompt klärt das. Bewusst **einmal pro Tag**, und gar nicht, solange heute schon ein Agent durchgelaufen ist: Der gelungene Lauf ist der bessere Beweis | `runner/schleuse.mjs` (`pruefeDurchgang`) |
| Ein Tor für alle | Urteil gecacht: grün eine halbe Stunde, **rot nur eine Minute** — ein repariertes Login soll sofort greifen, kein Agent auf die nächste halbe Stunde warten | `runner/index.mjs` (`schleuseOffen`) |
| Eine Meldung statt vier | Ist die Schleuse zu, entsteht **keine Run-Datei** — der Tagesdeckel bleibt unangetastet. Was Kevin selbst beheben muss, steht vorn: „Anmeldung" schlägt „Datenbank nicht erreichbar", sonst liest er morgens den Nebenschauplatz | `runner/schleuse.mjs` (`bewerteSchleuse`) |
| Sichtbar ohne App-Änderung | Eine geschlossene Schleuse wird dem Widerspruchs-Wächter vorangestellt und erscheint damit im Band auf dem Homescreen. „Nichts in der Liste" ist der Zustand, den man am leichtesten übersieht — jetzt steht dort ein Satz mit Handgriff | `runner/index.mjs` (`maybeWaechter`), `/status` |
| Ein PATH für beide | `CLI_PATH` einmal berechnet, von Agentenstart UND Schleuse benutzt. Prüfte die Schleuse mit einem anderen PATH als der Lauf, bestätigte sie eine Anmeldung, an die der Agent nie herankommt | `runner/index.mjs` |
| Drift-Wache | 31 Fälle. Die CLI-Prüfungen nehmen ihren Prozessstarter als Parameter — so sind „abgemeldet", „OAuth abgelaufen", „Kontingent erschöpft" und „CLI antwortet nicht" echt geprüft, ohne Kevins Anmeldung anzufassen | `scripts/verify-schleuse.ts` (neu) |

**Was sie bewusst NICHT prüft.** Ob LinkedIn im Sync-Chrome noch angemeldet
ist, ließe sich nur durch einen echten Seitenaufruf feststellen — ein
zusätzlicher Zugriff auf Kevins Konto bei **jeder** Prüfung. Am 17.08. gingen
schon einmal vier Sieben-Minuten-Durchläufe in einer Viertelstunde durch sein
Postfach; das ist ein Muster, für das LinkedIn Konten sperrt. Die Login-Wall
meldet weiterhin der Lauf, der sie tatsächlich trifft (`linkedin/sync.mjs`).

**Verifikation, beide Richtungen gefahren.** Integrationstest mit eigenem
Test-Vault, eigenem Port und einer Attrappen-CLI — echte Runner-Kette, kein
echter Agent, keine Kosten:

    Schleuse offen:  [10:22:29] morgenbrief wartet — Mac gerade erst aufgewacht
                     [10:22:50] Schleuse offen — Agenten dürfen laufen
                     [10:22:50] morgenbrief startet …            → Run-Datei da
    Schleuse zu:     [10:23:45] Schleuse ZU — Claude-CLI ist abgemeldet
                                · Im Terminal `claude` neu anmelden
                     [10:23:45] morgenbrief wartet — Claude-CLI ist abgemeldet
                                                                 → Runs-Ordner LEER

Das ist der ganze Punkt: **eine** Zeile mit Handgriff statt vier roter, und
kein einziger verbrauchter Versuch. Drift-Wachen grün: `verify-schleuse` 31/31
(neu) · `verify-start-bereit` 25/25 · `verify-lauf-grund` 33/33 ·
`verify-routine-guard` 38/38.

## **LIVE seit 18.08.2026, ~10:05 — Der Runner rennt nicht mehr in einen schlafenden Mac**

**Der Befund.** Vier rote Zeilen am Morgen des 18.08.: Morgenbrief und
Antwort-Entwürfe, je 06:16 und 06:48, „Zeitlimit erreicht (10 Min.)". In allen
vier Run-Dateien steht dasselbe: **0 Ereignisse · 0 Werkzeug-Aufrufe.** Kein
gescheiterter Lauf also, sondern gar keiner. Der Mac lag im DarkWake — wach
genug, dass die Timer feuerten, ohne Netz (`Auftrags-Abfrage fehlgeschlagen:
fetch failed`, sekundengleich um 06:16:43), und Sekunden später wieder im
Schlaf. Der 07.08. hatte dasselbe Muster; `caffeinate` hält den Mac aber nur am
Netzteil wach, nachts im Clamshell auf Batterie nicht.

Teuer war nicht der Fehlversuch, sondern seine **Buchung**: zwei davon erreichen
`MAX_VERSUCHE_PRO_TAG`, und beide Agenten waren bis Mitternacht gesperrt —
obwohl Kevin ab 9:00 mit wachem Rechner davorsaß. Genau deshalb sah er dieselbe
Liste seit dem 17.08. jeden Morgen rot.

**Die Antwort ist nicht „mehr Versuche", sondern erst prüfen, dann starten.**

| Zug | Ergebnis | Datei |
|---|---|---|
| Wach-Uhr | Eigener 60-Sekunden-Tick als Schlaf-Detektor: `setInterval` steht im Schlaf still, eine Lücke über dem 1,6-fachen Abstand kann nur Schlaf sein. Danach **3 Minuten Karenz** — länger als jeder DarkWake, kurz genug, dass Kevin das Aufklappen nicht als Wartezeit erlebt | `runner/startBereit.mjs` (neu), `runner/index.mjs` (`wachTick`) |
| Startfreigabe | Vor jedem Routine-Start: Mac stabil wach · Netz antwortet (`api.anthropic.com`, 4s Deckel) · für Chrome-Agenten CDP auf 9222. Ein „nein" erzeugt **keine Run-Datei und keinen Fehlversuch** — der nächste Tick fragt erneut, notfalls stundenlang | `runner/index.mjs` (`warteAufRechner`) |
| Nachfassen | Nach erkanntem Aufwachen ein einmaliger Nachfass-Check, sobald die Karenz durch ist. Ohne ihn entschiede der Zufall des 5-Minuten-Ticks, ob der Brief drei oder acht Minuten nach dem Aufklappen kommt | `runner/index.mjs` (`planeNachDemAufwachen`) |
| Eigener Abbruchgrund | „Zeitlimit **und 0 Werkzeug-Aufrufe**" heißt jetzt **„Nicht angelaufen"** statt „Zeitlimit erreicht" — rückwirkend auch für die Läufe, die schon im Vault liegen (`laufGrund` liest beim Ausliefern). Der Werkzeug-Zähler ist der Beleg, nicht der Ereignis-Zähler: Der 06:48-Lauf hatte zwei Ereignisse, beide mit Zeitstempel `[+17:13]` — die CLI eröffnete beim nächsten Aufwacher gerade noch ihre Sitzung. Gegenprobe an allen 15 Zeitlimit-Läufen im Vault: **12 ohne einen einzigen Werkzeug-Aufruf, 3 mit** — nur die drei waren je echte Zeitlimits | `runner/laufGrund.mjs` |
| Chrome selbst starten | Fehlt nur noch der Sync-Chrome, macht der Runner ihn selbst auf — derselbe Befehl wie Kevins Alias `chrome-sync`. Eingezäunt: höchstens einmal pro Stunde, nur 6–20 Uhr, `CHROME_AUTOSTART=0` schaltet es ab. Ein ausgeloggtes LinkedIn heilt das NICHT — dafür bleibt die Meldung aus `sync.mjs` | `runner/index.mjs` (`starteSyncChrome`) |
| Eigener Deckel | Fehlstarts zählen getrennt vom echten Kontingent, sechs statt zwei — sie kosten keinen Token und sagen nichts über den Agenten. Muster von den Anmelde-Fehlern (13.08.). Der Deckel bleibt als Gurt für den Fall, dass der Mac MITTEN im Lauf einschläft | `runner/routineGuard.mjs` |
| Drift-Wache | 23 Fälle: die echte Mitschrift vom 18.08., die Abgrenzung zum echten Zeitlimit (Lauf MIT Zügen), beide Deckel, DarkWake gegen trägen Tick, Karenz-Grenze auf die Sekunde | `scripts/verify-start-bereit.ts` (neu) |

**Verifikation, live gemessen.** Runner um 10:04 neu geladen; im Log steht
exakt der geplante Ablauf:

    [10:04:27] morgenbrief wartet — Mac gerade erst aufgewacht
    [10:07:28] morgenbrief startet (kein erfolgreicher Lauf heute)…
    → status: done nach 21 Sekunden

Also: erst die Karenz, dann der Nachfass-Check auf die Sekunde genau, dann ein
Brief, der wach 21 statt „10 Minuten" braucht — **an einem Tag, an dem beide
Agenten nach altem Stand bis Mitternacht gesperrt gewesen wären.** Drift-Wachen
grün: `verify-start-bereit` 25/25 (neu) · `verify-lauf-grund` 33/33 ·
`verify-routine-guard` 38/38.

Zwei Nachbesserungen aus genau diesem Live-Lauf: Die Warte-Meldung sagte
zunächst „… · kein Netz", obwohl das WLAN lief — der Netz-Check wird während
der Karenz gar nicht erst ausgeführt, also darf sein Ergebnis auch nicht
gemeldet werden (Kaskade statt Sammelliste). Und der Dream-Check bekam
denselben Vorab-Check: Er startet fünf Sekunden nach dem Runner, und der
startet oft genau dann, wenn der Mac eben erst aufgewacht ist.

**Was Kevin davon merkt:** Der Laptop kann nachts zu bleiben. Läuft der Morgen
ins Leere, steht in der Liste nicht mehr „Zeitlimit erreicht", sondern „Nicht
angelaufen" — und der Agent hat seinen Versuch noch. Wer aufklappt, bekommt
seinen Brief rund drei Minuten später, ohne einen Knopf zu drücken.

## **LIVE seit 17.08.2026, ~01:25 — Morgenlese-Serie + Vorlesen** (Nachschlag)

**Nachtrag ~01:45 — Umbenennung, live:** „Morgenlese" heißt überall sichtbar
jetzt **„Sunrise Success Formel"** (Kevins Wort) — Hero, Homescreen-Zeile,
`/morgen`-Knopf, Serien-Kachel, Regeln-Texte, und die Visionmap im Vault ist
nachgezogen (6 Vorkommen), damit Quelle und App nicht auseinanderlaufen.
Interne Bezeichner (DB-Spalte `morgenlese`, CSS-Klassen) bleiben — eine
Migration nur fürs Umbenennen wäre Risiko ohne Nutzen. Die Palette findet
beide Begriffe. Beleg: 7 Vorkommen im ausgelieferten Bundle.

Kevins drei Wünsche direkt nach dem Livegang, gebaut und im selben Zug
ausgeliefert (wieder `netlify deploy --prod`, CSS hash-identisch mit dem
lokal abgenommenen Build; Migration **0073 in der Prod-DB**):

- **Serie „Morgenlese komplett gelesen":** Der Haken sitzt am Ende der
  Lese-Sektion — dort, wo das Lesen endet — und schreibt in dieselbe
  Tageszeile (`identity_checkins.morgenlese`, 0073). Die dritte
  Serien-Kachel zählt **jeden Kalendertag** (Regel 1: „Jeden Morgen", nicht
  „jeden Werktag"); mobil liegt sie über beide Spalten.
- **Visionstext vorlesen:** Knopf am Visionstext, Web Speech API mit
  deutscher Systemstimme, je Absatz eine Utterance (lange Einzel-Utterances
  brechen in manchen Browsern still ab). Die Sprach-AUSGABE funktioniert
  auch auf iOS — anders als die Eingabe (O12).
- **Eigene Aufnahme (Kevins Endzustand):** hat automatisch Vorrang. Aufnahme
  in Sprachmemos, Datei nach `app/public/identity/visionstext.m4a` (oder
  `.mp3`), deployen — der Knopf wechselt ohne Code-Änderung. SPA-Falle
  bedacht: Netlify beantwortet unbekannte URLs mit `200 text/html`, als
  Fund zählt deshalb nur `content-type: audio/*`.

Funktional abgenommen: Gelesen-Toggle zieht die Serie live mit (5 → 4
„Heute noch offen" → 5), Sprachausgabe startet echt und stoppt sauber.
`verify-identitaet` 99 → **111 Fälle**, 39/39 Skripte grün.

## **LIVE seit 17.08.2026, ~00:50 — Identity-OS**

`main` = `7eebb8f` (Kevins Push, sein Wort: „bitte live bringen"), Migration
**0072 in der Prod-DB** (Historie lückenlos 0001–0072, Trockenlauf wollte
genau diese eine — sonst war nichts offen). Mit live gingen nur die elf
Identity-Commits plus zwei Doku-Commits; `origin/main` war vorher schon auf
dem Stand vom 16.08.

**Der Deploy-Weg war diesmal nicht der normale.** Netlify wies den Build ab:
*„Skipped due to account credit usage exceeded"* — auch der manuelle Upload
kam zunächst mit „Forbidden" zurück. Nachdem Kevin das Konto freigeschaltet
hatte („geht wieder"), stieß der fehlgeschlagene Deploy sich **nicht von
selbst** neu an; ausgeliefert wurde per `netlify deploy --prod --dir app/dist`
(lokal gebautes Bundle, Env gegen die Prod-Supabase geprüft). Der nächste
normale Git-Push baut wieder über Netlify und überholt diesen Stand einfach.

**Beleg am ausgelieferten Bundle** (`index-BS_SetWn.js`, CSS
`index-rjB1H1h6.css` — das CSS ist **hash-identisch mit dem lokal
abgenommenen Build**): im JS nachweisbar „Morgenlese", `identity_checkins`,
`vertriebsblock`, `dankbar_1`, „Yacht-Master", „Clean geblieben", „dann der
Block"; im CSS `ck-ident-hero`, `ck-morgenlese-zeile`, `ck-ident-streak`,
`ck-ident-banner`, `ck-ident-regeln`. Assets antworten 200 als `image/jpeg`
(`/identity/hero-marmor.jpg`, `uhr-rm88-smiley.jpg`, `kapitel-regeln.jpg`),
Routen `/identitaet`, `/cockpit`, `/morgen` antworten 200.

**Noch nicht am Gerät gesehen:** Die erste eingeloggte Session am iPhone —
morgens Homescreen → „Morgenlese"-Zeile → lesen, Haken setzen — ist die
eigentliche Abnahme. Ab jetzt speichert der Check-in echt (0072 ist drin);
die Clean-Serie startet bei 0 und zählt ab dem ersten Haken.

## Runde vom 16.08., nachts — **Identity-OS nach Kevins Design-Vorlage umgebaut**

Kevins Befund am ersten Stand: „visuell find ich's noch sehr textlastig" —
dazu der Auftrag, den Visionstext zwischen Check-in und Board zu setzen. In
der Zwischenzeit war `visionmap-2.0.html` entstanden (16.08., 21:04), deren
Fußzeile wörtlich sagt: **„Diese Seite ist die Design-Vorlage für das Identity
OS in Uriel."** Damit ist sie für Aufbau und Wortlaut maßgeblich, und die
Runde richtet die Seite daran aus.

| Zug | Ergebnis |
|---|---|
| **Bilder statt Textwand** | Bild-Hero (Marmorkopf), vier Kapitel-Banner mit Bild (Identität · Traumleben · Anti-Vision · Regeln & Lehren), Porträt neben dem Visionstext. Sechs Bilder aus der Vorlage extrahiert — genau die Statuen-Motive, die im Board noch als offene Plätze standen |
| **Visionstext** | steht wie gewünscht zwischen Check-in und Board, mit Porträt. Erste zwei Absätze offen, die restlichen sieben hinter „Den ganzen Visionstext lesen" |
| **Neue Inhalte** | Traumleben-Stufen als Kacheln, Menschen & Erleben, Business & Wirkung, die neun Regeln durchnummeriert (Vertriebsregel im Akzent), acht Schritte als Pillen, Hero Story, Theater of the Mind, fünf Lehren-Blöcke |
| **Board** | Yachten und Orte zu einer Reihe zusammengefasst, Uhren vollständig statt beschnitten (quadratisch, `contain`), zweiter Urus raus — die Vorlage zeigt vier Autos |
| **Struktur** | `IdentitaetAnsicht` in Bausteine zerlegt (`Bausteine.tsx`: Hero, Banner, Spalte, Liste); acht Aufklapper tragen das Nachschlagewerk |

**Übernommen sind Aufbau und Bildsprache, nicht die Palette.** Gold auf
Schwarz und Monospace-Versalien gehören der Vorlage; im Cockpit tragen
`--ck-accent` und die Serifen-Display-Schrift dieselbe Rolle. Die
eingefrorenen Tokens bleiben unangetastet. **Eine bewusste Abweichung:** die
„Nie mehr"-Spalte trägt Warn-Gold statt Rot — Rot ist laut DESIGN-TOKENS
echten Fehlern vorbehalten, und eine Anti-Liste ist eine Abgrenzung, kein
Systemfehler. Eine Zeile in `cockpit.css`, wenn du Rot willst.

### Zwei echte Fehler, die die Abnahme gefunden hat

1. **Negative z-index machten Hero- und Bannerbild unsichtbar.** Die Bilder
   waren geladen (1400×791, `complete: true`) und trotzdem schwarz: `z-index:
   -2` rutscht hinter den Hintergrund des nächsten Stacking-Contexts, und
   `.ck-root` bildet als `position: fixed` genau so einen. Jetzt 0/1/2 statt
   −2/−1/auto — als Testfall festgehalten, damit es nicht zurückkommt.
2. **Der Visionstext war am Handy drei Bildschirme Textwand.** Genau Kevins
   Befund, an der längsten Stelle. Aufgelöst über den Aufklapper.

**Verifikation:** `tsc -b` + `build` grün · **39 verify-Skripte grün**,
`verify-identitaet` von 78 auf **91 Fälle** gewachsen (neu: Kapitelbilder in
beiden Richtungen, Scrim- und Textschatten-Pflicht, Verbot negativer z-index,
Vollständigkeit von Visionstext und Regeln) · bei **390×664** abgenommen: kein
Querscrollen (390 == 390), **19 Bilder** geladen und keins kaputt, alle 15
Touch-Ziele ≥ 44 px, Konsole in einem frischen Tab ohne einen einzigen Fehler
· Desktop 1280 mit dreispaltigem Board geprüft.

### Zweiter Rundflug (17.08., nach Mitternacht) — „läuft das zuverlässig, auch mobil? Ein Klick morgens?"

Kevins drei Fragen, und was der Rundflug gefunden hat:

**Drei echte Funde, alle behoben:**

1. **Die Tages-Uhr lief auf UTC.** `isoTag(new Date())` rechnet in UTC,
   `daily_metrics` (`toIsoDate`) lokal — zwischen Mitternacht und 2 Uhr
   deutscher Zeit wäre der Abend-Check-in (Dankbarkeit!) auf dem **Vortag**
   gelandet, neben einer daily_metrics-Zeile, die längst auf dem neuen Tag
   steht. Aufgefallen, weil die Vorschau um kurz nach Mitternacht „Sonntag,
   16. August" zeigte. Der Hook nimmt jetzt `toIsoDate` — dieselbe lokale Uhr
   wie das ganze Tracking. Die UTC-Arithmetik in `identityStreak` bleibt: sie
   rechnet bewusst auf UTC-Mittag und ist DST-sicher.
2. **Das Randlos-Margin war am Desktop zu kurz.** `.ck-main` hat 18px
   Innenabstand am Desktop (mobil 12) — mit `-12px` stand ein 6px-Streifen
   Seitenverlauf um Hero und Banner. Jetzt `-18px` im 901er-Block.
3. **Die Dev-Vorschau prüfte die falsche Umgebung.** Sie rendert jetzt in der
   **echten Shell-Geometrie** (StatusBar, echte NavRail/Dock, echtes
   `.ck-main` — strukturgleich mit `CockpitShell.tsx`). Damit ist belegt, was
   vorher nur behauptet war: kein Querscrollen bei 390×664, alle 19 Bilder,
   und nach vollem Scrollen steht der letzte Inhalt (480) klar über der
   Dock-Oberkante (596).

**Der Ein-Klick-Weg morgens (Kevins dritte Frage) — jetzt dreifach:**

- **Homescreen-Zeile** (neu): vor 11 Uhr steht direkt unter dem Hero eine
  Zeile „Morgenlese · 2 Minuten — dann der Block" → ein Tipp öffnet
  `/identitaet`. Rein zeitgebunden, kein neuer Ladelauf (Gesetz 4), und sie
  hängt **nicht** an der Kachel-Reihenfolge — sie bleibt also auch, wenn die
  eigene Kachel-Anordnung die Tageszeit-Sortierung überstimmt.
- **`/morgen`** (Ziel des Morgen-Push) trägt jetzt den Knopf „Morgenlese ·
  2 Minuten" **über** dem Loslegen-Knopf — Reihenfolge der Visionmap: erst
  lesen, dann der Block. Damit ist der Backlog-Punkt „kein Weg vom
  Morgen-Push zur Morgenlese" geschlossen.
- **Kachel** morgens vorn (`kontextReihenfolge`), solange keine eigene
  Anordnung gespeichert ist; sonst hängt sie hinten an, fällt aber nie raus
  (`ordneNach` belegt das im Test).

**Verifikation:** `tsc -b` + `build` grün · 39 verify-Skripte grün,
`verify-identitaet` von 91 auf **99 Fälle** (neu: lokale Uhr statt UTC,
beide Randlos-Margins, die drei Morgen-Wege) · in der Shell-Vorschau bei
390×664: Dock liegt über der Seite ohne etwas zu verdecken, Morgenlese-Zeile
als Stil-Probe 57px hoch abgenommen · Desktop 1280: Hero bündig mit der
`.ck-main`-Kante (die 8px rechts sind die Scrollbar).

**Was „zuverlässig" noch NICHT einschließt:** Migration 0072 ist weiterhin
nicht eingespielt — bis dahin speichert der Check-in nicht (die Seite sagt
das sichtbar). Und die erste eingeloggte Session auf dem echten iPhone bleibt
die eigentliche Abnahme — die Shell-Vorschau ist die beste Annäherung ohne
Session, nicht das Gerät.

### Nachtrag aus Kevins Review

Vier Punkte, alle erledigt: **Preise** korrigiert (Yacht-Master 10.500 €,
Day-Date 55.000 €) · **die zwei Statuen** standen unmittelbar hintereinander
(Kapitel-Banner, dann Porträt) — jetzt liegen die beiden Spalten dazwischen,
dieselbe Folge wie in der Vorlage, und der Visionstext bleibt zwischen
Check-in und Board · **die weißen Kästen** bei Yacht-Master und RM 88 sind weg
· und ja, die Seite ist von Anfang an mobil gebaut (jede Messung lief bei
390×664, Desktop kam als Aufsatz dazu).

**Zum Freistellen der zwei Uhren**, weil der Weg ungewöhnlich ist: Beide kamen
als Pressefotos auf weißem Studio-Grund. Auf diesem Mac gibt es weder
ImageMagick noch PIL — der einzige Bild-Decoder im Haus ist der Browser.
Gerechnet wurde deshalb im Canvas: Flood-Fill **nur von den Bildrändern**, damit
das weiße RM-Keramikgehäuse verschont bleibt. Beim ersten Versuch (Schwelle
232) fraß der Fill Löcher ins Gehäuse; mit 252 und einer Lochprüfung als
Abbruchbedingung sitzt es. Bei der Yacht-Master ist zusätzlich der
Bodenschatten abgeschnitten. Sie ist damit JPEG statt PNG — freigestellt
braucht sie kein Alpha mehr.

## Runde vom 16.08., abends — **Das Identity-OS steht** (gebaut, nicht live · Migration 0072 offen)

Der Punkt aus §4 ist gebaut: `/identitaet` trägt die ☀️ Morgenlese aus
`Visionmap 2.0`, den täglichen Check-in, die Serien und das Visionboard.
**Nicht live** — der Fast-Forward bleibt Kevins Wort. Anzusehen unter
`/identitaet` (mit Sitzung) oder ohne Login unter
`/dev/identitaet-vorschau` (`npm run cockpit`).

| Zug | Ergebnis | Datei |
|---|---|---|
| Inhalte | Morgenlese, Verhaltens-Identität, Anti-Vision, Warum und die drei Stufen als Konstanten — im Wortlaut aus dem Vault. Der Vault wird nicht mitdeployt; eine Morgenlese, die vom eingeschalteten Mac abhängt, wäre an genau den Morgen kaputt, an denen sie zählt | `cockpit/lib/identityInhalte.ts` (neu) |
| Board | 14 Bilder in vier Gruppen, Uhren aufsteigend nach Preis — Titel, Notizen und Reihenfolge aus `identity-os-bilder/board-final.html` | `cockpit/lib/visionboard.ts` (neu), `app/public/identity/` |
| Check-in | Drei Haken (Vertriebsblock · Clean · Sport), Energie-Regler 1–10, drei Dankbarkeitszeilen. Ganze Zeile = Knopf, kein Speichern-Knopf | `components/identitaet/CheckinKarte.tsx` (neu) |
| Serien | Clean-Tage und Vertriebsblock-Werktage, je mit Rekord und Sieben-Tage-Punktreihe | `cockpit/lib/identityStreak.ts`, `components/identitaet/StreakBand.tsx` (neu) |
| Daten | Eigene Tabelle statt neuer `daily_metrics`-Spalten — Begründung im Migrations-Kopf. Gleiche Tages-Achse, gleicher Schlüssel `(user_id, brand_id, datum)`, gleiches RLS-Muster wie 0049 | `supabase/migrations/0072_identity_checkins.sql` (neu, **noch nicht gepusht**) |
| Weg dorthin | Registry-Eintrag `/identitaet`, neues Zeichen „Horizont", Desktop-Rail unter Nachschlagen. **Morgens steht die Kachel auf dem Homescreen vorn** (`kontextReihenfolge`) — ein Tipp zur Seite, der zweite setzt den ersten Haken | `lib/bereiche.ts`, `components/BereichIcon.tsx`, `lib/kachelReihenfolge.ts`, `components/NavRail.tsx` |
| Drift-Wache | 78 Fälle: Serien-Regeln, Board gegen den Bilder-Ordner in **beiden** Richtungen, Check-in-Felder gegen die Migration, Touch-Ziele, Verdrahtung | `scripts/verify-identitaet.ts` (neu) |

### Die zwei Fachregeln, an denen die Serien hängen

1. **Der laufende Tag bricht nichts.** Eine Serie darf heute ODER gestern
   enden. Zählte sie nur bis „heute abgehakt", stünde jeden Morgen eine 0 auf
   dem Bildschirm — die Zahl wäre genau dann am kleinsten, wenn sie tragen
   soll. Erst wenn gestern fehlt, ist sie gerissen.
2. **Der Vertriebsblock kennt Werktage, Clean kennt jeden Tag.** Ein Samstag
   ohne Block ist kein Rückschlag, sondern Samstag — Wochenenden werden
   übersprungen, nicht gewertet. „Clean" gilt lückenlos an jedem Kalendertag.

**Clean-Streak startet bei 0** (Baseline 16.08.: täglich ab mittags 3–7
Joints). Die Anzeige sagt bis zum ersten Haken „Noch keine Serie — der erste
Haken startet sie."

### Zwei Befunde aus dieser Runde

1. **Die Bilder waren so nicht ausspielbar.** Die 14 Originale wiegen zusammen
   **51 MB** (3–5 MB je Auto/Yacht) — ein Vielfaches des ganzen App-Bundles.
   Verkleinert auf 1.100 px lange Kante bei Qualität 72 sind es **2,1 MB**, und
   sie laden `lazy`. Die Yacht-Master ist freigestellt und bleibt PNG, sonst
   wird ihr transparenter Grund schwarz.
2. **Der Energie-Regler war das einzige Touch-Ziel unter 44 px** (34 px, im
   laufenden Cockpit gemessen). Behoben und als Testfall festgenagelt.

**Der Bilder-Ordner war beim Bauen in Bewegung:** um 20:01 lagen dort 19
Dateien, um 20:08 waren es 14 (je Auto nur noch eine Variante, neu das GLE
Coupé). Gebaut ist gegen den Stand von 20:08. `board-final.html` nennt sich
selbst „Final-Entwurf" und führt **offene Plätze**: Patek Nautilus 5712G,
Blackout-Nautilus 5726 und die Statuen-/Deko-Bilder aus Notion. Nachtragen ist
eine Zeile in `visionboard.ts` plus die verkleinerte Datei — die Drift-Wache
zeigt sofort an, wenn eins von beidem fehlt.

**Verifikation:** `tsc -b` + `build` grün · **39 verify-Skripte grün** (38
vorher, neu `verify-identitaet` mit 78 Fällen; `verify-kachel-reihenfolge` von
31 auf 33 gewachsen, weil morgens jetzt die Morgenlese vorn steht) · im
laufenden Cockpit bei **390×664** abgenommen: kein Querscrollen (390 == 390),
alle 14 Bilder geladen (7 davon erst beim Scrollen), Konsole beim Laden sauber,
alle Touch-Ziele ≥ 44 px · Desktop 1280 mit zweispaltigem Board geprüft.

**Ehrlich dazu:** Der Check-in ist **noch nie gegen die echte Datenbank
gelaufen** — Migration 0072 ist geschrieben und der Trockenlauf will genau
diese eine, der `db push` selbst wurde in dieser Session blockiert. Bis er
läuft, zeigt die Seite einen Hinweis statt still zu schlucken: lesen geht,
Haken bleiben nicht erhalten. Die Abnahme lief deshalb über die Dev-Vorschau
mit erfundenen Serien-Zahlen.

**Offen aus dieser Runde:**

- **Migration 0072 einspielen** — `supabase db push` (Trockenlauf sagt: genau
  diese eine). Danach den Check-in einmal echt durchklicken.
- **Board vervollständigen**, sobald die drei offenen Plätze entschieden sind.
- **Kein Weg vom Morgen-Push zur Morgenlese.** `/morgen` (O3) führt heute nur
  in den Arbeitsmodus. Ob der Push morgens zuerst die Morgenlese anbieten soll,
  ist eine Entscheidung, keine Aufräumarbeit.

## Runde vom 16.08. — **Marken-Kompass geplant** (Planung, kein App-Code)

Kevins Auftrag: Der Discovery-/Klarheitsprozess (KLAR-Kennenlernen) soll ein
Selbsttest im Kundenportal werden — Myers-Briggs-artig, Bildpaare klicken,
damit der erste Website-Entwurf mit hoher Trefferquote sitzt. **Blaupause für
die Umsetzung:** `docs/wargames/marken-kompass.md` (Züge K0–K8, D1–D12, blind
ausführbar für Opus auf `xhigh`). Kern: Stil-Duelle als selbst gerenderte
Kacheln (fünf Achsen, je ein Parameter kippt), sechs Selbstbild-Regler,
Anti-Auswahl, die sechs KLAR-Kernfragen; Auswertung deterministisch
(`verify-kompass`), genau EINE Claude-Synthese am Abschluss (Edge Function
`kompass-synthese`, Ergebnis in `kunde`/`intern` getrennt — Spannungen und
Call-Fragen sieht nur Kevin). Neue Tabelle `kompass_laeufe` (Migration
**0072**; 0071 ist angewandt — am 16.08. gegen die Prod-DB verifiziert, die
STOPP-Regel R1/K3 der Blaupause ist damit erledigt). Offen im LEDGER: Anzeigename
(Kevins Geschmack), Test-Kunden-Login.

## Runde vom 14.08. — **Die Erstnachrichten standen doppelt in der Liste** (Migration 0071 gepusht)

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
| Schlüssel ohne Gruppe | Unique-Index auf `(brand_id, name)`, alter gruppen-abhängiger Constraint fliegt, Fortschritts-Rettung vorab; Wächter bricht ab, solange Doppel im Bestand liegen | `supabase/migrations/0071_erstnachrichten_schluessel_ohne_gruppe.sql` (**angewandt**) |
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

**Erledigt — Bestandsdaten (Stand 16.08.).** Die 27 überzähligen Zeilen sind
weg und 0071 ist durchgelaufen. Gegen die Prod-DB nachgemessen: **118 Zeilen,
118 eindeutige Namen, 117 offen**, Roland Wettstein steht auf `gesendet`. Der
Unique-Index `(brand_id, name)` greift (Upsert mit diesem Konflikt-Ziel
antwortet 200), der alte Schlüssel `(brand_id, gruppe, name)` ist weg (400).
Der 42P10-Rückfallpfad in `runner/index.mjs` (Zeile ~1368) ist damit toter
Code — schadet nicht, kann bei der nächsten Runner-Runde raus.

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
| ~~**Identity-OS-Modul im Cockpit**~~ (Visionmap-2.0-Morgenlese als schöne Ansicht mit Bildern + Daily-Check-in: Vertriebsblock ✓, Clean-Streak, Sport, Energielevel 1–10, Dankbarkeitstagebuch; Streak-/Wochenblick, andockend an `daily_metrics`; Quelle der Inhalte: Vault `00 Kontext/Visionmap 2.0.md`) | Von Kevin gewünscht (16.08.), aber laut Blocker-Diagnose exakt die Sorte verführerisches Bau-Projekt, die den Vertrieb verdrängt. Deshalb: Claude baut, Kevin reviewt nur — und erst nach Belohnungs-Logik (Grundsatz 3: erst zahlen, dann Belohnung). | ✅ **gebaut am 16.08. abends** — `/identitaet`, Runde ganz oben. Nicht live, Migration 0072 noch nicht eingespielt. Statt neuer `daily_metrics`-Spalten eine eigene Tabelle mit derselben Tages-Achse (Begründung im Migrations-Kopf) |

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
