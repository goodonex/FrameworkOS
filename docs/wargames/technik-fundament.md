# Wargame — Technik-Fundament: die App auf sauberen Stand (Phase 1 vor dem Ästhetik-Pass)

**Erstellt:** 2026-08-09 · **Planer:** Fable 5 · **Executor:** Opus 5 oder Sonnet (blind ausführbar)
**Branch:** `cockpit-rebuild` · **Repo:** `~/Kevin OS/02 Projekte/uriel`

---

## Mission Brief

Kevin will Uriel optisch neu machen („haptisch geil", Apple-Gefühl) — **aber erst,
wenn die Technik sauber ist.** Diese Blaupause ist das Saubermachen: die offenen
Backlog-Punkte O8, O9, O11, L3/L6/L7 und der belegte O13-Kleinkram. **Nicht**
enthalten: O14 (Sales-Subtabs) und alles Ästhetische — die wandern bewusst in
Phase 2, sonst werden 2.500 Zeilen zweimal gebaut.

Einstieg in dieser Reihenfolge: (1) `HANDOFF.md` (realer Stand + die sieben
Fallen), (2) `docs/BACKLOG.md` Abschnitte O8, O9, O11, O13, L3, L6, L7,
(3) diese Blaupause komplett.

**Die Gesetze dieses Plans:**

1. **Zeilennummern in diesem Doc sind vom 09.08.** Vor jedem Edit die Datei
   frisch lesen — die Nummer ist Wegweiser, nicht Wahrheit.
2. **Nach jedem Zug:** `cd app && npx tsc -b && npm run build` grün. Am Ende
   zusätzlich alle `scripts/verify-*.ts` grün (Stand 09.08.: 22 Skripte).
3. **Migrationen ausschließlich über `supabase db push`** — nie SQL-Editor
   (die Lehre aus L2). Nur additive Migrationen; jede destruktive → Abbruch.
4. **Keine neue Status- oder Aufgaben-Wahrheit.** Jede neue Anzeige speist sich
   aus bestehenden Tabellen/Pfaden; jedes neue Schreiben ruft bestehende
   Update-Pfade. Ein Metrikfeld pro Abhaken bleibt Gesetz.
5. **Runner-Code geändert → `launchctl kickstart -k gui/$(id -u)/de.uriel.runner`**
   (HANDOFF). Skill-/Prompt-Texte brauchen das nicht.
6. **Commits je Zug auf `cockpit-rebuild`** (steht beim Start auf `main`-Stand
   `63c2177`; `git checkout cockpit-rebuild` als allererstes). **NICHT auf
   `main` pushen** — der Livegang ist Kevins Fast-Forward.
7. **Entscheidungen, die Geschmack oder Geld sind, werden GESAMMELT** (Zug 12),
   nicht geraten und nicht zwischendurch gefragt.

---

## Recon-Befunde (verifiziert 2026-08-09 am Live-Code — nicht raten)

| Behauptung | Befund | Konsequenz |
|---|---|---|
| „Seit Infinity Tagen" | `kundenarbeit.ts:19-22`: `ageDays(null)` → `Infinity`; `:90` nimmt `Math.min` der beiden Alter; das Gate `> 14` lässt Infinity durch; `:111` druckt es in den Text | Zug 1 |
| Snooze ohne Rückweg | `linkedinFollowups.ts:57-62`: Bucket `ruht` = terminal ODER gesnoozt; `LinkedinArea.tsx:509` zeigt nur den Zähler `Ruht: n`, keine Liste, kein Aufwecken; `:346` setzt Snooze | Zug 2 |
| `unread` nie angezeigt | Spalte seit 0058 gesynct; **kein Treffer** in `app/src/cockpit/` | Zug 3 |
| Loom-Haken fehlt auf `/linkedin` | `markLoomVerschickt` existiert im Hook (`useLinkedinThreads.ts:105`), einziger Aufrufer ist `SalesDashboard.tsx` | Zug 4 |
| Erstnachricht = zwei Griffe | `ErstnachrichtenListe.tsx:73` Kopieren-Knopf, `:47` Website-Link — getrennt | Zug 5 |
| O8: kein Blättern | `AdDetailPanel.tsx:16`: Props ohne `onPrev`/`onNext` | Zug 6 |
| Ads-KPIs leer | `AdsArea.tsx:121-126`: vier Kacheln zeigen `—`, solange `totals.hasData` false | Zug 7 |
| O9: Manifest tot | `runner/index.mjs:197`: weekly-Prompt nennt WEEKLY.md/backlog/log, **nicht** `content.json` (`:170`); `/content/manifest` (`:1906`) ist read-only; `SocialArea.tsx:148` rendert nur den `posted`-Badge — **es gibt keinen Schreiber und keinen Markieren-Knopf** | Zug 8 |
| O11: keine Abnahme | `PortalDeliverableCard.tsx` zeigt Karten mit Status aus `project.deliverables` (`deliverableCatalog`), keine Aktion; `project_messages` (0038) hat RLS für owner+client | Zug 9 |
| L7: `deleted_at` | 0038 **definiert** die Spalte (`:47`) und Policies filtern darauf; `useProjectMessages.ts:27/59/110` benutzt sie. Wenn die Live-DB sie ablehnt, fehlt sie dort (Alt-Desync) — erst reproduzieren | Zug 10 |
| L3: offene View | `0052_site_content.sql:108-114`: `security_invoker = off`, grant an `anon`; `site_content` hat 0 Zeilen, keine Kundenseite liest die View | Zug 10 |
| L6: API-Key | Letzte Bestätigung 19.07.; Test = eine Uriel-Nachricht im eingeloggten Preview | Zug 10 |
| useBrands-Warnung | Am 09.08. live reproduziert: `duplicate key … brands_slug_key` bei **jedem** Load, obwohl 5 Brands existieren (`useBrands.ts:314-348`, Seed-Effekt) | Zug 11a |
| InMail-Credits hart | `prioritaet.ts:108` Konstante, `:123` bereits als Parameter durchgereicht | Zug 11b |
| `entwurfMoeglich` hart | `LinkedinArea.tsx:459/470/482/493` — viermal `true`; die UI kennt sogar schon den Tooltip „braucht den Runner" (`:104-106`) | Zug 11c |
| Agenten blind startbar | `AgentsArea.tsx:74`: `postRun(agent.id)` ohne Input | Zug 11d |
| Vault-Queue wächst | `runner/index.mjs`: `QUEUE_DIR` wird beschrieben, nie geleert | Zug 11e |
| Doppelte Zielverwaltung | `SalesMode.tsx` (~`:2470`) öffnet `SalesGoalsDrawer`, konkurriert mit `month_goals` | Zug 11f |
| `?preview=true` in Prod | `PortalRoute.tsx:76-80`: Param lädt localStorage-Projekt, ungeschützt | Zug 11g |
| Kein Auto-Badge | `TrackingArea.tsx`: kein „auto"-Kennzeichen an Feldern, die der Arbeitsmodus schreibt | Zug 11h |
| iCal ohne Serien | `icalParse.ts:4`: „Bewusst NICHT unterstützt in v1: RRULE" — Serientermine verschwinden ab Woche 2 | Zug 11i |
| Schon erledigt (nicht bauen!) | „Loom aufnehmen"-Link am Posten (O3 Zug 9), `.ck-heute-grid`, Run-Drawer-Farben, Nav-Emoji U+FE0E, `--ck-danger` | O13-Tabelle in Zug 12 ehrlich nachführen |

---

## Entscheidungen (getroffen — der Executor entscheidet NICHTS davon neu)

**D1 — Infinity-Fallback ist `created_at`, nicht `updated_at`.** Wenn weder
Stufenwechsel noch erledigte Aufgabe je ein Datum hatten, zählt das Projektalter
seit Anlage. `updated_at` wäre falsch: das fasst auch der Spiegel an, und „liegt"
würde grundlos zurückspringen.

**D2 — „Ruht" zeigt nur Gesnoozte, nie Terminale.** Archivierte/abgeschlossene
Threads gehören nicht in eine Weck-Liste. Aufwecken = `snoozed_until: null`
über den bestehenden Patch-Pfad.

**D3 — `unread` wird NUR angezeigt, nie zurückgeschrieben.** Der Voyager-Sync
ist der Besitzer der Spalte. Ein Zurückschreiben aus der UI würde beim nächsten
Sync überschrieben oder — schlimmer — den Sync-Stand verfälschen. Anzeige ist
ehrlich; Lese-Status v2 nur, falls Kevin ihn vermisst.

**D4 — Erstnachricht: EIN Element für beides.** Ein `<a>` (Ziel: LinkedIn-Profil
falls im Datensatz, sonst Website), dessen `onClick` das Kopieren anstößt, ohne
vor der Navigation zu `await`en. Grund: `window.open` nach `await` schluckt der
Popup-Blocker (Lehre aus O3 Zug 9 — im Code an der Loom-Stelle dokumentiert).

**D5 — O9-Schreiber ist der Runner, nicht die App.** `content.json` liegt im
Vault; nur der Runner darf Vault-Dateien schreiben. Die App bekommt einen
Knopf, der nur bei erreichbarem Runner aktiv ist („am Rechner markieren" als
Titel im Spiegel-Fall). Kein Schreiben über Supabase — das wäre die zweite
Manifest-Wahrheit.

**D6 — O11 ohne neue Tabelle.** Freigabe/Änderungswunsch sind strukturierte
`project_messages` (`sender_role='client'`, Body-Präfix `[freigabe:<id>]` bzw.
`[aenderung:<id>] <Text>`). Der Owner sieht sie im bestehenden Posteingang, mit
Badge gerendert. Den Deliverable-**Status** ändert weiterhin nur der Owner —
der Kunde erzeugt ein Ereignis, keinen Zustand.

**D7 — L3 wird geschlossen, nicht umgebaut.** `security_invoker = on` per
Migration. Die View verliert damit ihren anon-Nutzen — das ist okay, sie hat
0 Zeilen und null Leser. Ob ein CMS mit scoped Funktion kommt, ist Kevins
Entscheidung (Zug 12), nicht Voraussetzung fürs Schließen der Lücke.

**D8 — InMail-Credits leben in `ui_settings`** (Tabelle aus 0068, Key
`sales.inmailCredits`, Fallback 150). Editierbar im InMail-Kachel-Fenster.
Kein neues Feld, keine neue Tabelle.

**D9 — RRULE v1 deckt den Alltag, nicht den RFC.** `FREQ=DAILY|WEEKLY|MONTHLY`,
`INTERVAL`, `BYDAY` (nur Wochentagsliste), `COUNT`, `UNTIL`, `EXDATE`. Harte
Kappe 300 Instanzen je Event, Expansion nur im geladenen Fenster. Alles andere
(BYSETPOS, YEARLY, TZ-Wechselspiele) fällt bewusst raus — lieber 95 % korrekt
als 100 % versucht.

**D10 — `?preview=true` wird DEV-only** (`import.meta.env.DEV`). Es ist ein
Entwicklungswerkzeug; in Prod ist ein Auth-Bypass über localStorage nichts wert
außer Risiko.

---

## Züge

### Zug 0 — Kassensturz

**Aktion:** `git checkout cockpit-rebuild` (muss auf `63c2177` == `main` stehen,
sonst STOPP und melden). `cd app && npx tsc -b && npm run build`. Danach alle
verify-Skripte: `for f in scripts/verify-*.ts; do npx tsx "$f"; done`.

**Erwartung:** Build grün, 22 Skripte grün. Das ist die Basislinie — jeder
spätere Rot-Fall ist dann nachweislich selbst verursacht.

### Zug 1 — Infinity-Tage (D1)

**Aktion:** In `kundenarbeit.ts` eine Hilfsfunktion `liegtSeitTagen(stageAlter,
aufgabeAlter, projektAlter)`: nimm das Minimum der **endlichen** Werte; sind
beide primären unendlich, nimm `ageDays(projekt.created_at)`; ist auch das
nicht endlich (kein created_at — sollte nie passieren), lass das Projekt aus
der Liste. Anwenden in `liegendeProjekte` (`:90`) und überall, wo der Text
„Seit X Tagen" entsteht (`:111`, plus `kundeLiegtPosten` prüfen).
`scripts/verify-kundenarbeit.ts` um 3 Fälle erweitern: beide Anker fehlen →
created_at zählt; nur einer fehlt → der andere zählt; Text enthält nie
„Infinity".

**Erwartung:** verify-kundenarbeit 16/16. **Fehler:** Fallback frisst den echten
Wert (min über alles inkl. created_at würde junge Projekte „liegend" machen).
**Signal:** Fall „nur einer fehlt" schlägt fehl. **Gegenzug:** created_at
NUR als letzte Stufe, nie ins Minimum mischen.

### Zug 2 — Ruht-Liste mit Wecker (D2)

**Aktion:** `useLinkedinThreads` um `wake(id)` ergänzen
(`applyPatch(id, { snoozed_until: null })`). In `LinkedinArea` unter den
Buckets eine einklappbare Liste „Ruht (n)": Threads mit `isSnoozed(t, now)`
**und nicht** `isTerminal(t.status)`, je Zeile Name · „bis DD.MM." · Knopf
„Aufwecken". Mobil-tauglich (Zeilenhöhe ≥ 44 px).

**Erwartung:** Aufwecken lässt den Thread sofort in seinem echten Bucket
auftauchen (bucketOf rechnet neu). **Fehler:** Terminale in der Liste.
**Signal:** archivierter Thread mit Weck-Knopf. **Gegenzug:** Filter exakt
`isSnoozed && !isTerminal` — `bucketOf === 'ruht'` allein reicht NICHT.

### Zug 3 — Ungelesen-Punkt (D3)

**Aktion:** RECON: Feldname im Thread-Typ prüfen (`types` / `useLinkedinThreads`
— Spalte aus Migration 0058). Dann in der Thread-Zeile von `LinkedinArea` ein
Punkt (Muster: SocialArea `isNew`-Punkt, `:138-146`) wenn `unread`. KEIN
Zurückschreiben.

**Erwartung:** Punkte an ungelesenen Threads; nach Voyager-Sync ändern sie
sich mit dem Sync-Stand. **Fehler:** Feld heißt anders/fehlt im Select.
**Signal:** überall false. **Gegenzug:** Select-Spaltenliste im Hook ergänzen.

### Zug 4 — Loom-Haken auf `/linkedin`

**Aktion:** In der Stern-/Loom-Ansicht von `LinkedinArea` (RECON: wo gestirnte
Threads gerendert werden) einen Knopf „Loom verschickt ✓" →
`threadsQuery.markLoomVerschickt(id)`. Nur zeigen, wenn `loom_status` nicht
schon `verschickt` ist (Feldwerte im Hook nachlesen).

**Erwartung:** Haken setzt den Status; der Posten verschwindet aus der
Loom-Spur im Sales-Dashboard (gleiche Quelle). **Fehler:** doppelte
Metrik-Zählung. **Signal:** `verify-arbeitsmodus-tracking` rot oder
`daily_metrics` bewegt sich beim Klick. **Gegenzug:** `markLoomVerschickt`
schreibt NUR den Thread-Status — kein `erledigePosten`, kein Metrikfeld
(Gesetz 4).

### Zug 5 — Erstnachricht: ein Griff (D4)

**Aktion:** In `ErstnachrichtenListe` den Kopieren-Knopf durch ein `<a
className="ck-btn ck-btn--primary" target="_blank" rel="noreferrer">` ersetzen:
`href` = LinkedIn-Profil-Feld falls vorhanden (RECON im Lead-Typ), sonst
Website (`:47`-Logik); `onClick` ruft die bestehende `kopieren()` OHNE await
vor der Navigation. Beschriftung „Kopieren + Profil ↗", Kopiert-Feedback
bleibt. Der bisherige separate Website-Link entfällt in der Zeile.

**Erwartung:** Ein Tipp → Text in Zwischenablage UND neuer Tab. **Fehler:**
Clipboard leer, weil Navigation die Promise abbricht. **Signal:** Einfügen
liefert alten Inhalt. **Gegenzug:** `navigator.clipboard.writeText` VOR der
Navigation feuern (synchroner Aufruf im selben Handler genügt, kein await) —
wenn es in einem Browser trotzdem klemmt: `e.preventDefault()`, kopieren,
dann `window.open` im selben Tick.

### Zug 6 — O8: Blättern im Ads-Review

**Aktion:** `AdDetailPanel` bekommt optionale Props `onPrev`, `onNext`,
`position` (`{ index, gesamt, freigegeben }`). Kopfzeile: „Ad 7/20 ·
3 freigegeben", Knöpfe ‹ ›, Tastatur ← → (Handler ignoriert Events aus
`input`/`textarea` — sonst springt das Tippen einer Notiz die Ads um).
`AdsArea` hält die gefilterte Liste + Index und reicht durch; am Listenende
sind die Knöpfe disabled (kein Wrap-Around — Review hat ein Ende).

**Erwartung:** 20 Ads in einem Fluss durchgehbar, Zähler stimmt mit
Freigabe-Stand. **Fehler:** Panel-State (Notiz-Entwurf) überlebt den Wechsel
und landet an der falschen Ad. **Signal:** Notiz von Ad 7 taucht an Ad 8 auf.
**Gegenzug:** `key={ad.id}` am Panel-Inhalt, State resettet per Remount.

### Zug 7 — Ads-KPIs zeigen den Review-Stand

**Aktion:** In `AdsArea` (`:121-126`): wenn `totals.hasData` false, statt der
vier `—`-Kacheln vier echte: „Ads gesamt", „Freigegeben", „In Review",
„Kunden" — aus den Manifest-Zeilen (RECON: Statuswerte in `useAdManifest`).
`hasData`-Fall bleibt byte-gleich.

**Erwartung:** Kacheln zeigen `20 · 3 · 17 · 1`-artige Stände, konsistent zur
Tabelle darunter. **Fehler:** Statuswerte geraten (z. B. `approved` vs
`freigegeben`). **Signal:** Summen ≠ Tabellenzeilen. **Gegenzug:** Werte aus
dem Manifest-Typ ablesen, nicht raten; Gegenprobe gegen die Tabelle in die
Verifikation.

### Zug 8 — O9: Content-Manifest schließen (D5)

**Aktion, drei Teile:**
(a) **Prompt** des `weekly-content`-Agenten (`runner/index.mjs:197`-Region)
ergänzen: nach dem Bauen der Woche `content.json` (`:170`) aktualisieren —
je Post `{ id, title, week, status: 'scheduled' }`, bestehende Einträge
unangetastet. Nur Prompt-Text, kein Runner-Neustart nötig.
(b) **Endpoint** `POST /content/posted` `{ week, postId }` im Runner: liest
`content.json`, validiert JSON, schreibt `.bak`, setzt `status:'posted'` +
`postedAt`, schreibt atomisch (temp + rename). Danach **kickstart** (Gesetz 5).
(c) **Knopf** in `SocialArea` an Wochen/Posts, die nicht `posted` sind:
„Als gepostet markieren" — nur aktiv, wenn `runnerDirekt()`; im Spiegel-Fall
disabled mit Titel „am Rechner markieren". Nach Erfolg Manifest neu laden.

**Erwartung:** Markieren am Desktop setzt den Badge sofort; `content.json`
zeigt den Eintrag; Handy zeigt den disabled-Zustand. **Fehler:** kaputtes
JSON durch parallelen Agent-Lauf. **Signal:** `/content/manifest` wirft
Parse-Fehler. **Gegenzug:** Validierung vor dem Schreiben + `.bak`; wenn der
Agent gerade läuft (`/runs` running), Schreiben mit 409 ablehnen.
**Trigger:** Falls `content.json` für die Brand noch fehlt → Endpoint legt
`{ posts: [] }` an, statt 500 zu werfen.

### Zug 9 — O11: Abnahme im Portal (D6)

**Aktion:** RECON zuerst: wie sendet das Kundenportal heute Nachrichten
(`useProjectMessages` / ClientPortal-Sendepfad), exakte Spalten von
`project_messages` (0038: `sender_role`, `sender_name`, `body`, `deleted_at`).
Dann: auf `PortalDeliverableCard` bei Status `fertig` zwei Aktionen —
„Freigeben" (sendet `[freigabe:<deliverableId>]`) und „Änderung wünschen"
(Textfeld auf, sendet `[aenderung:<deliverableId>] <Text>`), beide über den
BESTEHENDEN Sendepfad als `client`. Owner-Seite: im Kunden-Posteingang
(`posteingang.ts` / `KundenPosteingang.tsx`) und in der ProjectPage-
Nachrichtenliste die Präfixe erkennen und als Badge rendern („✓ Freigabe:
<Deliverable-Titel>" grün / „✎ Änderungswunsch: …" amber, Titel via
`deliverableCatalog`), Präfix aus dem Fließtext entfernen.

**Erwartung:** Kunde tippt Freigeben → Owner sieht die Freigabe im
Posteingang mit Deliverable-Namen. Kein neues Schema, keine neue Tabelle.
**Fehler:** RLS blockt den Client-Insert. **Signal:** 403/RLS-Fehler beim
Senden im Portal-Preview. **Gegenzug:** 0038-Policies lesen; wenn wirklich
eine Policy fehlt, additive Migration (nächste freie Nummer) mit exakt der
fehlenden Policy — via db push, nie Editor. **Abbruch**, wenn es ohne
Policy-Änderung an bestehenden Policies (alter/drop) nicht geht.

### Zug 10 — Datenbank-Runde (L7, L3, L6)

**Aktion L7:** Im eingeloggten Preview (Browser-Konsole):
`supabase.from('project_messages').select('id,deleted_at').limit(1)`.
Kommt `column … does not exist` → additive Migration (nächste freie Nummer):
`alter table project_messages add column if not exists deleted_at timestamptz;`
plus den partiellen Index aus 0038:53, falls er fehlt — `db push`, Probe
wiederholen. Kommt die Spalte zurück → **L7 ist ein Fehlalarm**, im Backlog
genau so schließen (mit dem Select als Beleg).
**Aktion L3:** Migration: `alter view public.site_content_published set
(security_invoker = on);` — db push. Danach `curl -s -o /dev/null -w '%{http_code}'`
auf `https://frameworkos.de/` (erwartet 200) und das Kundenportal-Login
(erwartet 200). Beide lesen die View nicht — Zahlen als Beleg notieren.
**Aktion L6:** Im Preview Uriel-Dock öffnen, „Was steht heute an?" senden.
Antwort kommt → L6 im Backlog schließen (Datum). 401/Fehler → NICHT selbst
an Secrets — in den Abschlussbericht: „L6 rot, Kevin muss den Key setzen."

**Erwartung:** Drei Backlog-Zeilen mit Beleg zu. **Fehler:** db push will
fremde Migrationen mitfahren. **Signal:** Liste im Push-Prompt enthält mehr
als die neuen Nummern. **Gegenzug:** STOPP, `supabase migration list --linked`
anschauen, melden — nicht bestätigen.

### Zug 11 — Kleinkram, je ein eigener Commit

**a) useBrands-Seed:** Ursache: der Seed-Effekt (`useBrands.ts:314-348`)
feuert, wenn `brands.length === 0 && !loading` — auch wenn der Load die Brands
gleich liefert oder ein transienter Fehler vorlag. Fix: im Erfolgspfad von
`reload()` ein `ladErfolgRef.current = true` setzen und den Seed zusätzlich
daran und an `error === null` binden. **Erwartung:** Console beim Reload ohne
`duplicate key`-Warnung (vorher/nachher im Preview belegen).

**b) InMail-Credits (D8):** `useUiSetting<number>('sales.inmailCredits', 150)`
im Sales-Dashboard; Wert an `ordnePosten`/Kachel durchreichen (`prioritaet.ts:123`
nimmt ihn schon als Parameter). Im InMail-Kachel-Fenster ein kleines
Zahlen-Input „Credits-Stand" mit Speichern. Konstante `:108` bleibt als
Fallback-Default.

**c) `entwurfMoeglich`:** an allen vier Stellen (`LinkedinArea.tsx:459/470/482/493`)
durch den echten Runner-Zustand ersetzen (RECON: was der Entwurf-Knopf
tatsächlich braucht — `runnerDirekt()` bzw. `useRunnerStatus().state === 'online'`;
die Seite lädt Runner-Daten schon). Der vorhandene Tooltip `:106` wird damit
zum ersten Mal wahr.

**d) Pflicht-Input-Agenten:** In `AgentsArea` für die Agenten-Ids
`loom-skript`, `followup-pdf`, `lead-research` den Direkt-Start disablen,
Hinweis „braucht einen Posten — aus dem Arbeitsmodus starten". RECON: Woher
die Agentenliste kommt (`/agents`); Ids exakt abgleichen, nicht raten.

**e) Queue-Deckel:** Beim Runner-Boot Dateien in `QUEUE_DIR` älter als
14 Tage löschen (nur Dateien, keine Ordner), eine Log-Zeile mit Anzahl.
Danach kickstart. `queued: []` bleibt hart — mit ehrlichem Kommentar, dass
die Queue nur Debug-Protokoll ist (HANDOFF sagt das bereits).

**f) SalesGoalsDrawer stilllegen:** Trigger in `SalesMode.tsx` (~`:2470`)
entfernen, an der Stelle ein Hinweis-Text „Monatsziel: Cockpit-Startseite".
KEIN Restyle, keine weiteren Änderungen in der Datei — die fällt in Phase 2.

**g) `?preview=true` DEV-only (D10):** `PortalRoute.tsx:76-80` — Param nur
respektieren, wenn `import.meta.env.DEV`.

**h) Auto-Badge im Tracking:** Die Felder, die der Arbeitsmodus schreibt,
stehen im Spur→Feld-Mapping (`arbeitsmodusTracking.ts`, RECON Exportname).
Daraus ein `Set` exportieren; `TrackingArea` zeigt an diesen Feldern einen
kleinen „auto"-Chip mit Titel „zählt beim Abhaken im Arbeitsmodus mit".

**i) RRULE v1 (D9):** In `icalParse.ts` eine reine Funktion
`expandRRule(event, fensterStart, fensterEnde)` nach D9-Umfang; Aufruf dort,
wo Events ins Fenster gemappt werden. Neues `scripts/verify-ical-rrule.ts`
mit mindestens: wöchentlich MO+DO über 3 Wochen · INTERVAL=2 · COUNT=5 ·
UNTIL mittendrin · EXDATE fällt raus · MONTHLY am 15. · kaputte Rule →
Einzeltermin bleibt, keine Endlosschleife (Kappe 300 greift).
**Fehler:** Zeitzonen verschieben ganztägige Termine. **Signal:**
verify-Fall „ganztägig bleibt am selben Tag" rot. **Gegenzug:** Expansion in
Ortszeit auf Tagesbasis rechnen, exakt wie die bestehende Einzeltermin-Logik
(`ical-mehrere`-Skript als Vorbild).

### Zug 12 — Abschluss: Beweis + Backlog + Entscheidungsblock

**Aktion:** (1) Voller Lauf: tsc, build, ALLE verify-Skripte (jetzt 23+).
(2) Screenshots 390×664: `/linkedin` (Ruht-Liste + Punkte), Sales-Kachel
Erstnachrichten, `/ads` (Zähler + Blättern), `/content` (Markieren-Knopf),
Portal-Karte mit den zwei Aktionen. Screenshot 1280: `/cockpit` unverändert.
(3) `docs/BACKLOG.md`: O8/O9/O11 abhaken mit Datei:Zeile, L3/L6/L7 mit Beleg,
O13-Tabelle Zeile für Zeile auf den echten Stand (inklusive der „schon
erledigt"-Funde aus dem Recon). Kopfzeile „Runde vom <Datum>" ergänzen.
(4) **Entscheidungsblock für Kevin** ans Ende des Berichts — GENAU diese fünf,
je mit Ein-Satz-Empfehlung, nichts davon bauen:
- Call-Mode: auf echten Funnel stellen oder streichen? (Empfehlung: streichen,
  Arbeitsmodus deckt den Fall)
- Website-CMS: `site_content` beleben (scoped Funktion statt View) oder
  Tabelle + View in Phase 2 abreißen?
- Umsatz per Uriel: eigenes `set_revenue`-Werkzeug mit Setz-Semantik bauen?
- Pitch-Modus: weiter am Namens-Suffix „— Pitch" oder eigenes Feld?
- Beziehungs-Reminder „still geworden": überhaupt bauen?

---

## Verifikation (vor der Übergabe, komplett)

1. `npx tsc -b` + `npm run build` grün; **alle** verify-Skripte grün, inkl.
   der zwei neuen/erweiterten (kundenarbeit 16, ical-rrule).
2. Kein „Infinity" mehr erzeugbar: verify-Fall + Grep über die UI-Texte.
3. Ruht-Liste: Aufwecken bringt den Thread zurück in seinen Bucket (Preview).
4. Erstnachricht: ein Tipp → Clipboard gefüllt UND Tab offen (Preview, beides
   belegen).
5. Ads: Zähler == Tabelle; Pfeiltasten blättern; Tippen in der Notiz blättert
   NICHT.
6. Content: Markieren setzt Badge + `content.json`-Eintrag; Handy-Fall
   disabled.
7. Portal: Freigabe-Klick erzeugt die project_messages-Zeile (Select als
   Beleg) und erscheint im Owner-Posteingang mit Badge.
8. DB: L7-Select, L3-Statuscodes, L6-Antwort — je als Ausgabe im Bericht.
9. Console ohne `duplicate key`-Warnung beim Load.
10. Desktop 1280 `/cockpit` und `/sales` unverändert (Screenshot-Vergleich) —
    dieser Plan fasst den Desktop nur in AdsArea/LinkedinArea an, beides
    dort gezielt nachsehen.

## Abbruchbedingungen — stoppen und melden statt improvisieren

1. Eine nötige Migration wäre destruktiv (drop/alter type) → stopp.
2. `db push` will mehr fahren als die neuen Nummern → stopp (L2-Narbe).
3. Portal-RLS ist ohne Ändern BESTEHENDER Policies nicht lösbar → stopp.
4. Ein Kern-verify (prioritaet, arbeitsmodus-tracking, linkedin-followups)
   bricht und der Fix läge in der Kernlogik → stopp.
5. Runner-Routinen (`routineFaellig`, Zeitpläne) müssten angefasst werden →
   stopp. Zug 8/11e ändern nur Prompt, einen neuen Endpoint und den Boot.
6. Alles, was Geld, Secrets, Löschen von Kundendaten oder Livegang berührt →
   Kevin. Livegang bleibt Fast-Forward auf Kevins Wort.

## Nicht im Scope (bewusst)

O14 Sales-Subtabs-Restyle · jede Farbe/Typo/Animation (Phase 2 „haptisch
geil", eigenes Wargame) · O16-Prüfung · Beziehungs-Reminder · `set_revenue` ·
Website-CMS-Umbau · echte iOS-Widgets. Wer beim Bauen einen Ästhetik-Juckreiz
spürt: notieren, nicht kratzen — Phase 2 hat dafür ein eigenes Design-System.
