> **Gebaut und im Betrieb** (160 Threads, 91 Erstnachrichten in der DB) — offene
> Restpunkte stehen in [`../BACKLOG.md`](../BACKLOG.md) (O4, O6, O13).
> Gültig bleibt der Voyager-Abschnitt: Feldkarte, Blätter-Query und die drei
> Fallen sind die Wartungsanleitung, wenn LinkedIn die API umbaut.

# Wargame — LinkedIn-Follow-up-System (Uriel-Modul)

**Erstellt:** 2026-07-27 · **Planer:** Opus 5 · **Executor:** Sonnet (blind ausführbar)
**Branch:** `cockpit-rebuild` · **Repo:** `~/Kevin OS/02 Projekte/uriel`

---

## Mission Brief

Kevin hat ~60 offene LinkedIn-Chats und verliert den Überblick, wem er wann zuletzt
geschrieben hat. Screenshots pro Chat an Claude zu schicken frisst Tokens und skaliert
nicht.

**Ziel:** Ein Uriel-Modul, das
1. Kevins LinkedIn-Postfach **lesend** ausliest (Code, kein Modell → 0 Token),
2. daraus **fällige Follow-ups** und einen **Abdeckungs-Report** rechnet,
3. für die fälligen Threads **Entwürfe** über die bestehende Freigaben-Queue liefert.

**Nicht im Scope (v1):** Senden. Threads öffnen/anklicken. Kontakte automatisch anlegen.
Cloud-Betrieb ohne Kevins Chrome.

**Leitplanken:**
- Chrome läuft, Kevin ist eingeloggt. Ohne Chrome: Sync schlägt *weich* fehl, letzter
  Stand bleibt sichtbar und wird als veraltet markiert — niemals stiller Alt-Stand.
- Lesend, ein Durchlauf pro Auslösung, menschliches Scroll-Tempo. Kein Klick, kein
  Senden, keine Navigation weg vom Postfach.
- Senden bleibt zu 100 % manuell bei Kevin.

---

## Recon-Befunde (verifiziert am 27.07.2026, nicht raten)

| Frage | Befund | Konsequenz |
|---|---|---|
| Node-Version | `v22.21.1` | Globales `WebSocket` vorhanden → **CDP zero-dependency**, keine Playwright/Puppeteer-Abhängigkeit. Runner-Doktrin bleibt intakt. |
| Runner | `runner/index.mjs`, 1201 Zeilen, `node:http`, bindet nur `127.0.0.1:4711`, eigener `.env`-Loader, `runner/.env` existiert | Neue Endpoints im gleichen `if (req.method === … && url.pathname === …)`-Muster ergänzen (siehe Zeilen 867–1109). |
| Letzte Migration | `0057_runner_heartbeat.sql` | Neue Migration heißt **`0058_linkedin_threads.sql`**. |
| `contacts`-Spalten | `name, email, phone, website, instagram, **linkedin**, **company**, pipeline_stage, last_contact_at, **next_follow_up_at**, notes, activity_log, tags[], pipeline_id, stage_changed_at, won_at, lost_at, lost_reason, brand_id` | **Kein Umbau nötig.** Zuordnung Thread→Kontakt über `contacts.linkedin`. |
| Entwurfs-Kette | `app/src/cockpit/lib/approvalDrafts.ts` exportiert `parseDrafts`, `dueFollowupContacts`, `buildFollowupInput`; `DraftChannel` enthält bereits `'linkedin'` | Freigaben-Queue kann DM-Entwürfe schon. Nur eine neue Input-Funktion + Vault-Skill nötig. |
| Chrome Debug-Port 9222 | **NICHT offen** | Blocker → LEDGER-1. |
| Arbeitsstand | `cockpit-rebuild` mit **uncommitteten Änderungen** in u. a. `FreigabenArea.tsx`, `runner/index.mjs`; `CrmArea.tsx` → `SalesArea.tsx` umbenannt (uncommittet) | **Jede Datei vor dem Edit frisch lesen.** Nicht gegen den committeten Stand arbeiten. Modul bewusst *nicht* in SalesArea einhängen (Umbenennung in flight → Konfliktgefahr). |

---

## Zug 1 — Chrome-Debug-Zugang herstellen

**Aktion:** Prüfen, ob CDP erreichbar ist:
```bash
curl -s --max-time 2 http://127.0.0.1:9222/json/version
```

**Erwartete Beobachtung bei Erfolg:** JSON mit `Browser: "Chrome/1xx…"` und
`webSocketDebuggerUrl`.
**Bei Fehlschlag:** leere Antwort oder `Connection refused`.

**Wahrscheinlichster Fehler:** Chrome läuft ohne den Flag. Der Flag lässt sich **nicht**
nachträglich setzen — Chrome muss vollständig beendet und neu gestartet werden (nicht
nur Fenster schließen: `Cmd+Q` bzw. `pkill -x "Google Chrome"`).

**Zweiter, wahrscheinlicher Fehler (Trigger für Route B):** Aktuelle Chrome-Versionen
verweigern Remote-Debugging auf dem **Standard-Profil** als Sicherheitsmaßnahme. Symptom:
Chrome startet normal, aber Port 9222 bleibt trotz Flag geschlossen.

**Gegenzug / Weggabelung:**
- **Route A** — Port antwortet nach Neustart mit Flag → weiter mit Zug 2.
  ```bash
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1
  ```
- **Route B** — Port bleibt zu → dediziertes Profil verwenden:
  ```bash
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1 \
    --user-data-dir="$HOME/.uriel-chrome"
  ```
  Kevin muss sich in diesem Profil **einmal** bei LinkedIn anmelden. Danach ist es das
  Sync-Profil. Trigger für Route B ist ausschließlich: *curl auf 9222 schlägt nach einem
  sauberen Neustart mit Flag fehl.*

### ENTSCHIEDEN 27.07.2026 — Route B, live verifiziert

Chrome 150.0.7871.182 lief mit `--remote-debugging-port=9222` (12 Prozesse trugen den
Flag), **aber nichts lauschte auf 9222** (`lsof -iTCP:9222` leer, curl-Exit 7). Die
Sperre für Remote-Debugging auf dem Standardprofil ist damit bestätigt — Route A ist auf
dieser Chrome-Version tot, nicht nur unwahrscheinlich.

Funktionierender Startbefehl (Port war nach 2 s offen):

```bash
open -na "Google Chrome" --args \
  --user-data-dir="$HOME/.uriel-chrome" \
  --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1 \
  --no-first-run --no-default-browser-check
```

Zwei Eigenschaften, die das zur besseren Lösung machen: Kevins Haupt-Chrome läuft
unangetastet parallel weiter, und `open -na` blockiert das Terminal nicht. Der Befehl
kommt als Alias `chrome-sync` in `~/.zshrc`.

Bestätigt hat sich außerdem der `PUT`-Gotcha: `PUT /json/new?<url>` öffnet den Tab
sauber. Das frische Profil ist erwartungsgemäß ausgeloggt — einmaliger Login durch Kevin,
danach persistent.

**Sicherheitsnotiz (in die Doku aufnehmen):** Ein offener Debug-Port erlaubt jedem lokalen
Prozess, den eingeloggten Browser zu steuern. `--remote-debugging-address=127.0.0.1` ist
Pflicht, damit nichts aus dem Netz drankommt.

---

## ENTSCHEIDUNG 27.07.2026 — Voyager-API statt DOM (Züge 2+3 ersetzt)

Kevin hat nach Vorlage der Weggabelung die API-Route gewählt. **Züge 2 und 3 unten sind
historisch** — sie dokumentieren, warum die DOM-Route verworfen wurde. Gebaut wird gegen
die interne API.

### Warum die DOM-Route gestorben ist (live gemessen)

| Problem | Befund im echten DOM |
|---|---|
| Kein stabiler Schlüssel | Alle IDs sind Ember-generiert (`li#ember48`, `div#conversation-card-ember49`) und wechseln bei jedem Reload. Kein `href`, keine URN, kein `data-*` mit Konversations-ID. |
| Zeitstempel nicht maschinenlesbar | `<time>` **ohne** `datetime`-Attribut, nur Anzeigetext: `13:51`, `26. Juli`, `23. Juli`. |
| Absender nur per Textpräfix | Vorschau lautet `"Silvio Tantulli: Hi Kevin, …"` — Sender steckt als Namenspräfix im Text. |
| Anzeigen in der Liste | Gesponserte Einträge (z. B. „Salesforce / Gesponsert") stehen als normale Listeneinträge mit drin. |
| Virtualisierung bestätigt | Nur 20 `li.msg-conversation-listitem` gleichzeitig im DOM. |

### Die API — verifiziert am 27.07.2026

**Endpoint** (aus dem Seitenkontext, Cookies laufen automatisch mit):
```
/voyager/api/voyagerMessagingGraphQL/graphql?queryId=<ID>&variables=(mailboxUrn:<URN>)
```
Header: `csrf-token: <Wert des JSESSIONID-Cookies, ohne Anführungszeichen>` und
`accept: application/vnd.linkedin.normalized+json+2.1`. Ergebnis war HTTP 200, ~165 KB.

**`queryId` und `mailboxUrn` NIEMALS hartkodieren.** Beide zur Laufzeit aus den eigenen
Requests der Seite ableiten — die queryId enthält einen Release-Hash und wechselt:
```js
const entries = performance.getEntriesByType('resource').map(e => e.name)
const convUrl = entries.find(u => /messengerConversations\./.test(u))
const queryId = (convUrl.match(/queryId=([^&]+)/) || [])[1]
const mailbox = decodeURIComponent((convUrl.match(/mailboxUrn:([^),]+)/) || [])[1])
```
Findet sich kein solcher Request, ist die Seite noch nicht fertig geladen → bis zu 8×
je 1 s warten, dann abbrechen. Der veraltete REST-Pfad
`/voyager/api/messaging/conversations` antwortet mit **500** und ist tot.

**Antwortform:** normalisiert, `{ data, included }`. Die Nutzdaten stecken in `included`,
gefiltert über `$type`:

| `$type` | Anzahl im Test | Rolle |
|---|---|---|
| `com.linkedin.messenger.Conversation` | 20 | die Threads |
| `com.linkedin.messenger.Message` | 20 | jeweils letzte Nachricht |
| `com.linkedin.messenger.MessagingParticipant` | 21 | Personen |
| `com.linkedin.messenger.SponsoredMessageOption` | 2 | **Anzeigen — rausfiltern** |

**Feldkarte (verifiziert, nicht geraten):**

| Zielfeld | Quelle |
|---|---|
| `thread_key` | `Conversation.backendUrn` → `urn:li:messagingThread:2-Mzgw…` (stabil, deckt sich mit der Thread-URL) |
| Zweitschlüssel | `Conversation.entityUrn` → `urn:li:msg_conversation:(…)` |
| Thread-Link | `Conversation.conversationUrl` |
| `last_message_at` | `Conversation.lastActivityAt` — **Epoch-Millisekunden**, kein Parsing |
| gelesen / ungelesen | `Conversation.read`, `Conversation.unreadCount`, `Conversation.lastReadAt` |
| Gruppenchat | `Conversation.groupChat` (v1: Gruppen überspringen) |
| Kategorien | `Conversation.categories` → `INBOX`, `PRIMARY_INBOX`, `STARRED`, `INMAIL` |
| letzte Nachricht Absender | `Message.*sender` → Teilnehmer-URN |
| Zeitpunkt Nachricht | `Message.deliveredAt` (Epoch-ms) |
| `name` | `MessagingParticipant.participantType.member.firstName` + `.lastName` |
| `profile_url` | `…member.profileUrl` |
| `company` (Ersatz) | `…member.headline` |
| Personen-ID | `MessagingParticipant.hostIdentityUrn` → `urn:li:fsd_profile:…` (stabil) |

**`last_from` ist damit deterministisch** — kein Präfix-Raten mehr:
```
last_from = Message.*sender enthält KEVIN_URN ? 'me' : 'them'
```
Kevins Mailbox-/Profil-URN (identisch): `urn:li:fsd_profile:ACoAAD0buecBJVQJuwh9y5bAvM5BX7tuzTSw91g`
— trotzdem **zur Laufzeit** aus `mailboxUrn` lesen, nicht hartkodieren.

**Anzeigen-Filter:** Konversation verwerfen, wenn eine `SponsoredMessageOption` auf sie
zeigt oder `categories` kein `INBOX`/`PRIMARY_INBOX` enthält.

**Kevins Stern-Konvention bleibt nutzbar:** `categories` enthält `STARRED` (4 Treffer im
Test) — das ist laut Memory `loom_anbahnung` sein Marker „Lead hat Ja zur Loom-Analyse
gesagt". Als eigenes Feld `starred boolean` in `linkedin_threads` mitführen und in `/linkedin`
als eigener Bucket zeigen.

### GELÖST 28.07.2026 — RECON-1: Blättern funktioniert

Die Basis-Abfrage (`messengerConversationsBySyncToken`) kann grundsätzlich nicht
blättern — sie hat gar keinen Cursor. Die Seite benutzt dafür eine **dritte,
andere** Query, die erst beim Scrollen feuert:

```
queryId=messengerConversations.<hash>          → messengerConversationsByCategoryQuery
variables=(query:(predicateUnions:List((conversationCategoryPredicate:(category:INBOX)))),
           count:20, mailboxUrn:<URN>, nextCursor:<cursor>)
```

Der nächste Cursor steht in `data.data.messengerConversationsByCategoryQuery.metadata.nextCursor`
(`ConversationCursorMetadata`). Die Antwortform ist identisch zur Basis-Abfrage —
Conversation, Message, MessagingParticipant im `included`-Block, dieselbe Feldkarte.
`count` über 20 liefert **0** Treffer, die Seitengröße ist also fix.

**Ergebnis am ersten Lauf:** 159 Threads statt 19, über 8 Seiten, 16 Sekunden.
Statt 4 Stern-Leads wurden 15 sichtbar.

**Drei Fallen, die dabei aufgefallen sind:**

1. **Der Performance-Buffer taugt nicht zur Entdeckung.** Er fasst ~250 Einträge
   und nimmt danach *nichts* mehr auf — auf einer lange offenen Messaging-Seite
   erscheint ein neuer Request dort nie. Deshalb legt der Sync zusätzlich einen
   eigenen Mitschnitt auf `window.fetch`.
2. **Scrollen als Entdeckungsweg ist unzuverlässig.** Ist die Liste bereits bis
   ans Ende geladen, feuert kein Nachlade-Request mehr — die queryId bleibt
   unsichtbar. Deshalb wird die zuletzt tragende ID in
   `runner/linkedin/.paging-queryid.json` gemerkt und **bei jedem Lauf validiert**
   (ein Aufruf, Wurzelname + Cursor prüfen). Kein Hash im Quelltext, und bei
   Rotation heilt sich der Sync über die Neuentdeckung selbst.
3. **Grenzen statt Endlosschleife.** Maximal 25 Seiten, Abbruch sobald eine Seite
   älter als das Scan-Fenster wird, 450 ms Pause zwischen den Seiten. `partial` ist jetzt
   nur noch wahr, wenn *wir* gedeckelt haben oder gar nicht blättern konnten —
   nicht mehr bei jeder vollen Seite. Der Abbruchgrund wird mitgeliefert.

### Scan-Fenster: einmal tief, danach 30 Tage

Der Tiefenscan ist eine einmalige Sache und am 28.07.2026 gelaufen (159 Threads,
zurück bis Januar). Im Alltag steht das Fenster auf **30 Tagen** — der Sync
brauchte damit 4 statt 8 Seiten und 7 statt 16 Sekunden, und die 159 Zeilen samt
aller 15 Sterne blieben unverändert erhalten.

Das ist nicht nur schneller, sondern verliert auch nichts: der Sync löscht nie,
und weil LinkedIn absteigend nach letzter Aktivität sortiert, rutscht ein alter
Thread, in dem wieder etwas passiert, automatisch auf Seite 1. Ein kurzes Fenster
übersieht also keine neue Aktivität — es spart nur Seitenaufrufe.

Erneuter Tiefenscan, falls je nötig:

```bash
LINKEDIN_SCAN_TAGE=365 node runner/linkedin/sync.mjs --dry-run
```

Für den schreibenden Lauf dieselbe Variable in `runner/.env` setzen und den
Runner neu starten.

**Folge für die Buckets:** Mit 159 statt 19 Threads wären 121 Threads gleichzeitig
„fällig" gewesen — als Tagesliste unbrauchbar. Deshalb ist `verwaist` jetzt ein
echter Bucket (selbst geschrieben, > 30 Tage her, nie nachgefasst) statt nur ein
Zähler: 63 fällig, 38 „du bist dran", 58 Altlasten. Lange Abschnitte zeigen die
ersten 15 Karten mit „N weitere anzeigen"; die Gesamtzahl steht immer in der
Überschrift.

### Historisch — was vorher versucht wurde und scheiterte

Die Basis-Abfrage liefert exakt **20** Konversationen (Standard-Seitengröße), alle
`PRIMARY_INBOX`. Zwei Versuche schlugen fehl und sind damit ausgeschlossen:
`variables=(…,lastUpdatedBefore:<epoch>,count:20)` liefert **identisch dieselben 20**
(Parameter wird ignoriert), und `ul.scrollTop = scrollHeight` löste **kein** Nachladen aus
(0 neue Requests, weiterhin 20 Einträge).

Reihenfolge für den Executor, Abbruch beim ersten Erfolg:
1. **Zweite queryId probieren.** Die Seite kennt zwei: `messengerConversations.0d5e6781bbee71c3e51c8843c6519f48`
   (die genutzte) und `messengerConversations.74c17e85611b60b7ba2700481151a316`. Die zweite ist
   der wahrscheinlichste „Mehr laden"-Aufruf. Beide zur Laufzeit einsammeln, nicht hartkodieren.
2. **Echtes Mausrad statt `scrollTop`.** Virtualisierte Listen hängen oft an
   `IntersectionObserver`/Wheel-Events, die eine Zuweisung auf `scrollTop` nicht auslöst.
   Über CDP `Input.dispatchMouseEvent` mit `type: 'mouseWheel'` auf die Listenkoordinaten
   scrollen, danach `performance.getEntriesByType('resource')` erneut diffen und den neuen
   Request auslesen.
3. **Kategorie-Abfrage.** `messengerMailboxCounts.<hash>` gibt die echte Gesamtzahl je
   Kategorie — damit lässt sich prüfen, ob 20 die Wahrheit oder nur die erste Seite ist.

**Trigger:** Ergibt Schritt 3, dass Kevin tatsächlich nur ~20 aktive Threads im
Primär-Postfach hat, ist RECON-1 **erledigt statt gelöst** — dann reicht ein Aufruf und
Blättern wird erst nötig, wenn die Zahl wächst. Sicherung dagegen: Liefert ein Lauf exakt
20 Treffer, wird `partial: true` gesetzt und in der UI als „möglicherweise unvollständig"
angezeigt, statt stillschweigend 20 als Gesamtzahl zu behaupten.

**Abbruchbedingung:** Kein Schreiben von Konversationen, solange nicht feststeht, ob 20
die Gesamtmenge ist. Sonst archiviert der erste Lauf alles, was auf Seite 2 steht.

---

## Zug 2 — ~~Selektor-Sonde~~ ÜBERHOLT, siehe Voyager-Abschnitt oben (historisch)

**Warum eigener Zug:** LinkedIns DOM-Klassen ändern sich und sind von hier aus nicht
bekannt. Weder Planer noch Executor dürfen Selektoren raten — sie werden **live
ermittelt** und dann festgeschrieben.

**Aktion:** Skript `runner/linkedin/probe.mjs` schreiben, das
1. `GET http://127.0.0.1:9222/json` holt und das Target findet, dessen `url` mit
   `https://www.linkedin.com/messaging` beginnt,
2. sich per globalem `WebSocket` mit dessen `webSocketDebuggerUrl` verbindet,
3. `Runtime.evaluate` mit `{ returnByValue: true, awaitPromise: true }` schickt und im
   Seitenkontext auswertet:
   - alle `li`-Elemente mit einem `a[href*="/messaging/thread/"]` darin zählen,
   - für das erste Treffer-Element `outerHTML` (auf 4000 Zeichen gekürzt) zurückgeben,
   - die Klassenliste des scrollbaren Containers zurückgeben (das nächste Elternelement
     mit `scrollHeight > clientHeight + 50`).

**Erwartete Beobachtung bei Erfolg:** Anzahl ≥ 10 und ein `outerHTML`, in dem Name,
Firma/Untertitel, Vorschautext und ein Zeit-Badge erkennbar sind.
**Bei Fehlschlag:** Anzahl 0, oder HTML enthält ein Login-Formular.

**Wahrscheinlichster Fehler:** Kein Messaging-Tab offen → `/json` enthält kein passendes
Target. **Gegenzug:** Tab per `PUT http://127.0.0.1:9222/json/new?https://www.linkedin.com/messaging/`
öffnen — **`PUT`, nicht `GET`**; neuere Chrome-Versionen antworten auf `GET /json/new` mit
405. Danach 3 s warten und erneut listen.

**Zweiter Fehler:** Anzahl ist 0, obwohl der Tab offen ist → Liste ist noch nicht
gerendert. **Gegenzug:** bis zu 5× im Abstand von 1 s neu auswerten, dann abbrechen.

**Trigger:** Enthält das zurückgegebene HTML `type="password"` oder den String
`/uas/login` → **ABBRUCH**, Meldung „LinkedIn ist ausgeloggt". Nichts schreiben.

**Ergebnis festhalten:** Die ermittelten Selektoren kommen als **ein einziger
`SELECTORS`-Konstantenblock** an den Kopf von `runner/linkedin/sync.mjs`, mit
Kommentar `// Ermittelt am <Datum> per probe.mjs — bei DOM-Änderung hier nachziehen.`
Genau eine Stelle zum Reparieren, wenn LinkedIn umbaut.

---

## Zug 3 — Sync-Reader `runner/linkedin/sync.mjs` (auf API umgestellt)

> **Umgestellt am 27.07.:** Die Extraktion kommt aus der Voyager-Antwort (Feldkarte oben),
> nicht mehr aus dem DOM. Damit entfallen ersatzlos: Scroll-Akkumulation, Selektor-Block,
> deutsches Datums-Parsing und die `Du:`-Präfix-Erkennung. Der CDP-Rahmen bleibt: Target
> finden → WebSocket → `Runtime.evaluate` mit `awaitPromise: true`. Was bleibt: harte
> Laufzeitgrenze 90 s, Login-Wand-Abbruch, Gruppenchats überspringen, Anzeigen filtern,
> `partial: true` bei genau 20 Treffern (RECON-1). Der historische DOM-Ablauf steht unten
> als Rückfallebene, falls LinkedIn die API dichtmacht.

### Historischer DOM-Ablauf (Rückfallebene)

**Aktion:** Zero-dep Modul, exportiert `syncThreads({ dryRun })`. Ablauf im Seitenkontext
(ein `Runtime.evaluate`-Aufruf mit `awaitPromise`):

```
akku = new Map()            // key = threadKey, gewinnt: erster Fund
für i von 0 bis 14:
  alle sichtbaren Listenelemente einsammeln → in akku (nur neue Keys)
  container.scrollTop += container.clientHeight * 0.8
  400 ms warten
  wenn scrollTop sich nicht mehr ändert → Schleife verlassen
return [...akku.values()]
```

Pro Thread wird extrahiert:

| Feld | Quelle | Fallback |
|---|---|---|
| `thread_key` | Conversation-ID aus `href` (`/messaging/thread/<id>/`) | normalisierte `profile_url` |
| `name` | Titelzeile des Listenelements | — |
| `company` | Untertitel-Zeile | `''` |
| `profile_url` | `href` des Profil-Links, falls vorhanden | `''` |
| `preview` | Vorschautext | `''` |
| `time_raw` | Text des Zeit-Badges, **roh** | `''` |
| `last_from` | `'me'` wenn Vorschau mit `Du:` / `Sie:` / `You:` beginnt, sonst `'them'` | `'unknown'` |
| `unread` | Ungelesen-Marker vorhanden | `false` |

**Erwartete Beobachtung bei Erfolg:** Rückgabe-Array mit ≥ 40 Einträgen (Kevin nennt ~60),
jeder mit nicht-leerem `thread_key` und `name`, keine doppelten `thread_key`.
**Bei Fehlschlag:** < 40 Einträge, oder doppelte Keys, oder `thread_key` leer.

**Wahrscheinlichster Fehler — Virtualisierung:** Die Liste hängt alte Einträge beim
Scrollen aus dem DOM aus. Wer erst scrollt und dann einmal ausliest, bekommt nur das
letzte Fenster. **Gegenzug:** Wie oben — **in jeder Iteration einsammeln**, Akkumulation
in einer Map, nicht am Ende einmal lesen. Das ist der Fehler, der diesen Sync sonst
lautlos halbiert.

**Zweiter Fehler:** `thread_key` leer, weil der Link anders aufgebaut ist. **Gegenzug:**
Fallback auf normalisierte `profile_url` (lowercase, ohne Query, ohne Trailing-Slash).
**Trigger:** Wenn *beide* leer sind → Eintrag verwerfen und zählen; sind > 10 % verworfen
→ **ABBRUCH**, Selektoren neu sondieren (Zug 2).

**Dritter Fehler:** Endlos-Scroll lädt ältere Konversationen nach und der Lauf wird lang.
**Gegenzug:** Harte Grenzen — max. 15 Iterationen, max. 90 s Gesamtlaufzeit, danach mit
dem sauber ab, was da ist, und `partial: true` melden.

**Zeitstempel-Regel:** `time_raw` wird **immer** roh gespeichert. Die Umrechnung in
`last_message_at` macht eine reine Funktion (nächster Zug) für deutsche Formate:
`"12 Min."`, `"3 Std."`, `"Gestern"`, `"Mo"`, `"12. Juli"`, `"14.03.2026"`. Was nicht
parst → `last_message_at = null` **und** `last_from = 'unknown'`. Kein Rateversuch, denn
ein falscher Zeitstempel erzeugt ein Follow-up zur falschen Zeit.

**Verifikation:** `node runner/linkedin/sync.mjs --dry-run` gibt die Liste als JSON auf
stdout aus und schreibt **nichts**. Bestanden = ≥ 40 Einträge, keine Dubletten, jeder
Eintrag hat `thread_key` und `name`.

---

## NACHTRAG 28.07.2026 — Review-Runde nach dem Bau (Züge 3–9 gebaut)

Sechs Abweichungen von der ursprünglichen Blaupause, alle gegen echte Daten geprüft:

| # | Befund | Konsequenz |
|---|---|---|
| 1 | **`du_bist_dran` war dauerhaft leer.** `upsert` setzte bei Lead-Antwort `status='waiting_reply'`, `bucketOf` warf aber alles mit `status !== 'active'` nach `ruht`. Der wichtigste Zähler hätte immer 0 gezeigt. | `ruht` gilt jetzt nur für `archived/won/lost` + snoozed. `last_from='them'` wird **zuerst** geprüft — eine Antwort schlägt auch Stufe 3, denn auf eine Antwort folgt nie ein Break-up. Regressionstests 10i–10l. |
| 2 | **`status` wird vom Sync gar nicht mehr geschrieben.** Er stammte aus einem SELECT-Snapshot und hätte eine parallele Änderung Kevins (won/lost/archived) überschrieben. | Buckets entscheiden ohnehin über `last_from`. `status` gehört jetzt allein Kevin. `waiting_reply` bleibt als Wert erlaubt, wird aber nicht mehr gesetzt. |
| 3 | **`starred` wurde berechnet und weggeworfen.** Der Wargame verlangte die Spalte, sie fehlte in Migration, Typ und UI — Kevins wertvollstes Signal (Ja zur Loom-Analyse, 4 Threads live). | Spalte `starred boolean` in 0058, wird gesynct, in der UI als ★ am Namen plus eigener Zähler. |
| 4 | **`time_raw` war tot.** Mit der API-Route entfällt jedes Datums-Parsing; die Spalte hätte permanent `''` enthalten. | Ersatzlos aus Migration, Typ, Upsert und Fixtures entfernt. |
| 5 | **Der 30-%-Schutzschalter wäre verwässert.** Nenner war die ganze Tabelle, Zähler nur die ≤20 gesyncten Threads — ab ~67 Zeilen hätte auch ein zu 100 % kaputter Lauf nicht mehr ausgelöst. | Nenner ist jetzt `updated` (in diesem Lauf wiedergefundene Zeilen). Erstzuordnungen `null → id` zählen nicht mehr als Umhängung. Neu dazu: Tripwire, wenn **kein einziger** Thread eine bestehende Zeile trifft (= `thread_key`-Formatwechsel, sonst lautlose Verdopplung). |
| 6 | **Kontakt-Zuordnung über `contacts.linkedin` greift praktisch nie.** Voyager liefert opake Profil-IDs (`/in/ACoAA…`), Kevins Kontakte enthalten Vanity-URLs — live: 44 Kontakte, nur 2 mit LinkedIn-URL, davon 0 im matchbaren Format. | Regel 1 des Matchings ist faktisch tot; die Arbeit macht der eindeutige Namensabgleich. „Ohne Kontakt" wird deshalb hoch sein — das ist erwartet, kein Fehler. Normalisierung zieht jetzt zusätzlich `www.` und `#`-Fragmente ab. |

Zusätzlich gehärtet (alles gegen die Live-Antwort geprüft, heute kein Auslöser):
Gegenüber wird über `hostIdentityUrn` statt String-Enthaltensein aufgelöst; fehlender
Absender ⇒ `last_from='unknown'` statt `'them'`; neueste statt erster Nachricht je Thread;
zweiter Abbruch-Guard bei > 10 % Threads **ohne Namen**; `unread` nur bei `read === false`;
Tab ohne `webSocketDebuggerUrl` wird nicht mehr benutzt.

**Offen geblieben (bewusst):** Archivieren verschwundener Threads — solange RECON-1
ungeklärt ist, würde der erste Lauf alles archivieren, was auf Seite 2 steht. Die UI
weist stattdessen dauerhaft darauf hin, wenn exakt 20 Threads geladen sind.

---

## Zug 4 — Migration `0058_linkedin_threads.sql`

**Aktion:** Neue Tabelle. Spalten:

```
id uuid pk default gen_random_uuid()
brand_id uuid not null references brands(id) on delete cascade
thread_key text not null
contact_id uuid references contacts(id) on delete set null
name text not null default ''
company text not null default ''
profile_url text not null default ''
preview text not null default ''
time_raw text not null default ''
last_message_at timestamptz
last_from text not null default 'unknown' check (last_from in ('me','them','unknown'))
unread boolean not null default false
followup_stage int not null default 0
snoozed_until timestamptz
status text not null default 'active'
  check (status in ('active','waiting_reply','won','lost','archived'))
first_seen_at timestamptz not null default now()
last_synced_at timestamptz not null default now()
unique (brand_id, thread_key)
```
Plus Indizes auf `(brand_id, status)` und `(contact_id)`.

**RLS:** **Nicht neu erfinden.** Das Muster aus `supabase/migrations/0009_rls.sql` für
`contacts` lesen und eins zu eins übernehmen (authenticated-only, brand-scoped).

**Erwartete Beobachtung bei Erfolg:** `supabase db push` läuft durch; `select count(*)
from linkedin_threads` gibt 0 zurück.
**Bei Fehlschlag:** Constraint- oder Referenzfehler.

**Wahrscheinlichster Fehler:** Migration wird von Sonnet direkt gepusht. **Das ist
verboten** — Kevins Migrations-Historie desynchronisiert dabei. **Gegenzug:** Migration
nur *schreiben*, dann stoppen und Kevin um `supabase db push` bitten. Die App muss bis
dahin einen sauberen Leerzustand zeigen (Muster wie bei 0054: fehlende Tabelle → stiller
Fallback, kein roter Fehler).

**Abbruchbedingung:** Kein `db push` durch den Executor. Punkt.

---

## Zug 5 — Upsert + Zuordnung `runner/linkedin/upsert.mjs`

**Aktion:** Ergebnis aus Zug 3 nach Supabase schreiben (Service-Role-Key aus
`runner/.env`, dort liegt er bereits — siehe `uriel_runner_heartbeat`-Memory).

Zuordnung Thread → Kontakt, in dieser Reihenfolge:
1. `profile_url` normalisiert == `contacts.linkedin` normalisiert → treffer
2. sonst `name` exakt (getrimmt, case-insensitiv) und **eindeutig** in `contacts` → treffer
3. sonst `contact_id = null`

**Upsert-Regel:** `on conflict (brand_id, thread_key)` → aktualisiert werden
`name, company, profile_url, preview, time_raw, last_message_at, last_from, unread,
last_synced_at`. **Nicht angefasst** werden `followup_stage`, `snoozed_until`, `status`,
`first_seen_at` — das ist Kevins Steuerung, die darf ein Sync nie überschreiben.

**Statuslogik beim Upsert:**
- `last_from = 'them'` und Status war `active` → Status wird `waiting_reply`
- `last_from = 'me'` und Status war `waiting_reply` → Status wird `active`,
  `followup_stage` bleibt

**Erwartete Beobachtung bei Erfolg:** Rückgabe `{ inserted: n, updated: m, unmatched: k }`,
Summe == Anzahl aus Zug 3.
**Bei Fehlschlag:** HTTP 401/403 (Key), oder Summe passt nicht.

**Wahrscheinlichster Fehler:** Fehlender/falscher Service-Role-Key in `runner/.env` — das
ist bei Uriel schon einmal passiert (Graph + Status fielen still aus). **Gegenzug:** Beim
Start prüfen, ob der Key gesetzt ist; wenn nicht, **laut** abbrechen mit klarer Meldung,
nicht still weiterlaufen.

**Zweiter Fehler:** Namensmatch trifft zwei Kontakte („Michael Schmidt" doppelt) →
falscher Kontakt verknüpft. **Gegenzug:** Namensmatch nur bei **Eindeutigkeit**, sonst
`null`. Lieber nicht zugeordnet als falsch zugeordnet.

**Abbruchbedingung:** Würde ein Lauf mehr als **30 %** der bestehenden Zeilen auf
`archived` setzen oder mehr als 30 % der `contact_id`-Verknüpfungen ändern → abbrechen und
melden. Das fängt den Fall ab, dass ein DOM-Umbau plötzlich Müll liefert.

---

## Zug 6 — Fälligkeitsregeln `app/src/cockpit/lib/linkedinFollowups.ts`

**Aktion:** Reine Funktionen, keine Netzwerk-Aufrufe, damit per `tsx` prüfbar.

```
SCHWELLEN = [3, 7, 14]   // Tage je followup_stage 0,1,2
```

`isDue(thread, now)` → true nur wenn **alle** gelten:
- `status === 'active'`
- `last_from === 'me'`
- `last_message_at !== null`
- `now - last_message_at >= SCHWELLEN[followup_stage] Tage`
- `snoozed_until` leer oder vergangen
- `followup_stage <= 2`

`bucketOf(thread, now)` → einer von:
- `'faellig'` — isDue
- `'du_bist_dran'` — `last_from === 'them'`
- `'wartet'` — `last_from === 'me'`, noch nicht fällig
- `'pruefen'` — `last_from === 'unknown'` oder `last_message_at === null`
- `'abschluss'` — `followup_stage === 3` → Break-up fällig, danach `archived`
- `'ruht'` — snoozed / archived / won / lost

`coverage(threads, contacts)` → Zähler für den Abdeckungs-Report:
`nie_angeschrieben` (Kontakte im ICP ohne Thread), `ohne_kontakt` (Thread ohne
`contact_id`), plus die Bucket-Zähler, plus `verwaist` (Status `active`, letzte Nachricht
> 30 Tage her, `followup_stage` unverändert).

**Erwartete Beobachtung bei Erfolg:** `npx tsx` gegen einen Fixture-Satz von ~12
konstruierten Threads liefert exakt die von Hand erwarteten Bucket-Zahlen.
**Bei Fehlschlag:** Abweichung in irgendeinem Bucket.

**Wahrscheinlichster Fehler:** Zeitzonen — `last_message_at` ist UTC, Kevin denkt in
lokaler Zeit; ein Follow-up wirkt einen Tag zu früh. **Gegenzug:** Vergleich läuft
ausschließlich über Millisekunden-Differenzen (`now - last_message_at`), **nie** über
Kalendertage. Bei Schwellen ab 3 Tagen ist eine Stundenabweichung folgenlos.

**Zweiter Fehler:** `unknown` rutscht versehentlich in `faellig`. **Gegenzug:** Der
`isDue`-Test verlangt `last_from === 'me'` explizit — `unknown` kann nie durchfallen.
Fixture muss genau diesen Fall enthalten.

**Verifikation:** `npx tsx scripts/verify-linkedin-followups.ts` — Skript existiert nach
diesem Zug und gibt „12/12 Fälle korrekt" oder die Abweichung aus.

---

## Zug 7 — UI: `/linkedin` als vierter „Heute"-Tab

**Aktion:** Neue Seite `app/src/cockpit/pages/LinkedinArea.tsx`, Route `/linkedin`, als
vierter Eintrag im bestehenden `HeuteTabs`-Streifen (neben `/aufgaben`, `/termine`,
`/freigaben`).

**Warum dort und nicht in SalesArea:** `CrmArea.tsx → SalesArea.tsx` ist gerade
uncommittet in Umbenennung. Ein Eingriff dort erzeugt Merge-Konflikte. „Heute" ist
außerdem inhaltlich richtig — das ist Kevins tägliche Abarbeitungs-Oberfläche.

Aufbau der Seite, von oben:
1. **Kopfzeile:** „Zuletzt synchronisiert vor X" + Button „Jetzt synchronisieren".
   Älter als 24 h → Badge wird amber; Runner offline → Badge rot mit Text
   „Chrome/Runner offline — Stand vom …".
2. **Fällig heute** — Karten mit Name, Firma, letzter Nachricht, Tagen seit dem letzten
   Kontakt, Follow-up-Stufe. Aktionen je Karte: „Entwurf erzeugen", „→ morgen"
   (`snoozed_until = +1 Tag`), „Erledigt" (`followup_stage++`, `last_from` bleibt).
3. **Du bist dran** — Threads mit Antwort. Diese Liste steht **über** allem anderen im
   Kopf als Zähler, weil sie die teuerste ist, wenn man sie übersieht.
4. **Abdeckung** — die Zähler aus `coverage()`, inkl. „nie angeschrieben" und „verwaist".
5. **Prüfen** — die `unknown`-Fälle, mit Direktlink ins LinkedIn-Postfach.

**Erwartete Beobachtung bei Erfolg:** `npx tsc -b` grün, `npm run build` grün, Seite
rendert mit Leerzustand, wenn die Tabelle noch nicht existiert (kein roter Fehler).
**Bei Fehlschlag:** TS-Fehler oder weißer Screen.

**Wahrscheinlichster Fehler:** Mobile Bottom-Bar. Die Nav hatte schon einmal zu viele
Tabs auf 375 px; deshalb wurde „Heute" überhaupt gruppiert. **Gegenzug:** `/linkedin`
kommt **in** den HeuteTabs-Streifen, **nicht** als eigener NavRail-Eintrag. Die Anzahl der
Nav-Bereiche bleibt bei 9.

**Zweiter Fehler:** Bekannte Falle aus `App.tsx` — `#app-ui-overlay` setzt global
`pointer-events: none`. Jedes Vollbild-UI außerhalb der CockpitShell braucht explizit
`pointerEvents: 'auto'`. Gilt hier nur, falls ein Overlay/Drawer gebaut wird.

**Verifikation:** Screenshot bei 1280×800 **und** 390×664 (Kevins echte Handy-Höhe — die
`h-svh`-Falle aus der Memory). Beides an Kevin, nicht ihn selbst testen lassen.

---

## Zug 8 — Entwürfe über die bestehende Freigaben-Queue

**Aktion:**
1. `buildLinkedinFollowupInput(threads)` in `approvalDrafts.ts` ergänzen — liefert je
   fälligem Thread `{ thread_key, contact_id, name, company, profile_url, preview,
   tage_seit_kontakt, followup_stage }`.
2. Vault-Skill `~/Second Brain/.claude/skills/linkedin-followup-entwuerfe/SKILL.md`
   anlegen. Er schreibt in Kevins Stimme (Regeln aus dem Skill `herrmann-outreach`:
   „Moin", Du, kurze Sätze, keine Emojis, CTA als letzter Satz) und hängt ans Markdown
   denselben ```json-Block an, den `parseDrafts` schon versteht — mit
   `"channel": "linkedin"`.
3. Runner-`AGENT_CATALOG`-Eintrag ergänzen, damit der Agent im Command Deck erscheint
   (dieses wird seit Schub 3 dynamisch aus `/agents` gerendert — kein UI-Edit nötig).

**Erwartete Beobachtung bei Erfolg:** Nach „Entwürfe erzeugen" erscheinen die Karten in
`/freigaben` mit „Kopieren" / „Erledigt".
**Bei Fehlschlag:** `parseDrafts` liefert 0 (kaputter JSON-Block) oder der Agent taucht
nicht auf.

**Wahrscheinlichster Fehler:** Der Runner läuft mit altem Code und kennt den neuen
Katalog-Eintrag nicht. **Gegenzug:** Nach jeder Runner-*Code*-Änderung ist ein Neustart
nötig:
```bash
launchctl kickstart -k gui/$(id -u)/de.uriel.runner
```
Skill-Änderungen brauchen das **nicht** (`claude -p` liest `SKILL.md` frisch).

**Zweiter Fehler:** `FreigabenArea.tsx` ist uncommittet verändert. **Gegenzug:** Datei vor
dem Edit frisch lesen; nicht gegen den Git-Stand patchen.

---

## Zug 9 — Auslösung

**v1: manuell.** Button in `/linkedin` → `POST /linkedin/sync` am Runner.

Kein launchd-Job in v1. Grund: Ein Zeitplan, der auf ein geschlossenes Chrome trifft,
erzeugt Fehlerrauschen und verleitet dazu, Fehlschläge zu ignorieren. Erst wenn der Sync
zwei Wochen stabil manuell läuft, kommt ein Job dazu — dann mit derselben
Heartbeat-Mechanik wie `0057`.

**Erwartete Beobachtung bei Erfolg:** Klick → innerhalb ~30 s aktualisierte Zähler.

---

## Red-Team-Durchgang

| Angriff | Ergebnis | Patch |
|---|---|---|
| „LinkedIn erkennt Automatisierung und flaggt den Account." | **Abgewehrt.** Rein lesend, ein Durchlauf, 400 ms Scroll-Takt, kein Klick, kein Senden, echtes Nutzerprofil. Restrisiko bleibt und steht in der Doku. | — |
| „Chrome ist zu, wenn der Sync läuft — Kevin sieht alte Daten für frische an." | **Traf.** | `last_synced_at` steht in der Kopfzeile, > 24 h wird amber, Runner offline wird rot. Alt-Stand wird nie als aktuell dargestellt. |
| „`thread_key` ändert sich zwischen Läufen → Liste verdoppelt sich." | **Abgewehrt.** | Key = Conversation-ID aus dem href, Fallback normalisierte Profil-URL; sind beide leer, wird der Eintrag verworfen und gezählt, > 10 % Verwurf bricht ab. |
| „Deutsches Relativdatum parst falsch, Follow-up feuert einen Tag zu früh." | **Abgewehrt.** | `time_raw` bleibt roh gespeichert; Parse-Fehler → `unknown` → nie fällig. Schwellen ab 3 Tagen machen Stundenfehler folgenlos. |
| „Kevin antwortet vom Handy, Thread wird nie abgeschlossen — 'active' wächst ewig." | **Traf.** Genau Kevins Ausgangsproblem in neuer Form. | Zwei Gegenmaßnahmen: `followup_stage 3` ist die Break-up-Nachricht, danach automatisch `archived`. Plus Bucket **`verwaist`** im Abdeckungs-Report (aktiv, > 30 Tage, Stufe unverändert), der eine Handentscheidung erzwingt. |
| „Sonnet pusht die Migration selbst und zerlegt die Historie." | **Traf.** | Harte Abbruchbedingung in Zug 4: Migration nur schreiben, `db push` macht ausschließlich Kevin. |

---

## Abbruchbedingungen (stoppen und melden, nicht improvisieren)

1. Selektor-Sonde findet < 10 Threads, obwohl ~60 erwartet werden.
2. Antwort aus dem Seitenkontext enthält `type="password"` oder `/uas/login` → ausgeloggt.
3. Ein Lauf würde > 30 % der Zeilen archivieren oder > 30 % der Kontakt-Zuordnungen ändern.
4. Service-Role-Key fehlt in `runner/.env`.
5. > 10 % der Threads ohne verwertbaren `thread_key`.
6. Zwei Sync-Läufe in Folge fehlgeschlagen → Status auf „degraded", keine weiteren
   automatischen Versuche.
7. Jede Situation, in der ein Klick, ein Senden oder eine Navigation nötig schiene → nicht
   tun, melden.

---

## LEDGER — was Kevin liefern muss, bevor der Executor loslegt

| # | Blocker | Was gebraucht wird | Blockiert |
|---|---|---|---|
| **L-1** | ~~Chrome-Debug-Port zu~~ → **Route B läuft** (27.07.). Rest-Aufgabe: **einmaliger LinkedIn-Login im Profil `~/.uriel-chrome`.** | Kevin meldet sich im Sync-Fenster einmal an; danach persistent. Sync-Instanz muss beim Sync laufen (`chrome-sync`). | Züge 2, 3, 5, 9 |
| **L-2** | Migration nicht ausgeführt | `supabase db push` für `0058_linkedin_threads.sql` nach Zug 4 | Züge 5–8 |
| **L-3** | Runner läuft mit altem Code | `launchctl kickstart -k gui/$(id -u)/de.uriel.runner` nach Zug 8 | Zug 8, 9 |
| **R-1** | Blättern über 20 Threads hinaus ungeklärt | Kein Kevin-Input nötig — Executor arbeitet die drei Schritte im Voyager-Abschnitt ab (zweite queryId → echtes Mausrad → Mailbox-Counts). Bis geklärt: `partial: true`, kein Archivieren. | Zug 3, Zug 5 (nur Archiv-Logik) |
| **L-4** | `{{icp_definition}}` | Für „nie angeschrieben" im Abdeckungs-Report: Welche Kontakte zählen als ICP? Vorschlag = `pipeline_stage != 'paused'` und `linkedin != ''`. Bestätigen oder korrigieren. | Zug 6 (nur dieser Zähler) |

L-4 blockiert nur eine Kennzahl — die Züge 1–5 und 7–9 laufen ohne Antwort durch.

---

## SUCCESS-Check (die acht Kriterien)

1. ✅ Jeder Zug nennt die erwartete Beobachtung bei Erfolg **und** bei Fehlschlag.
2. ✅ Jeder Zug trägt wahrscheinlichsten Fehler, Signal und Gegenzug.
3. ✅ Weggabelungen haben Trigger — Zug 1 (Route A/B), Zug 2 (Login-Wall), Zug 5
   (30-%-Schwelle), Zug 3 (10-%-Verwurf).
4. ✅ Ungeklärtes ist markiert: Zug 2 ist als RECON-Zug ausgeführt statt geraten;
   `{{icp_definition}}` steht im Ledger.
5. ✅ Abbruchbedingungen sind eigener Abschnitt, sieben Stück.
6. ✅ Verifikation ausbuchstabiert: `--dry-run` (Zug 3), `tsx`-Fixtures (Zug 6),
   `tsc -b` + Screenshots bei 1280×800 und 390×664 (Zug 7).
7. ✅ Red-Team gelaufen: drei Angriffe trafen, alle drei gepatcht (Staleness-Badge,
   Verwaist-Bucket + Break-up-Stufe, Migrations-Abbruch).
8. ✅ Blind ausführbar bis auf die vier Ledger-Punkte, die Kevins Hand brauchen.

---

## Reihenfolge für den Executor

```
L-1 (Kevin) → Zug 2 → Zug 3 → Zug 4 → L-2 (Kevin) → Zug 5 → Zug 6 → Zug 7 → Zug 8 → L-3 (Kevin) → Zug 9
```

Züge 3, 6 und 7 sind unabhängig genug, um parallel gebaut zu werden, sobald die Selektoren
aus Zug 2 stehen. Kein Commit ohne Kevins Wort; Deploy weiterhin über `main`-Fast-Forward.
