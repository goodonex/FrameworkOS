> **Vollständig gültig — dies ist der Bauplan für Punkt O3 in
> [`../BACKLOG.md`](../BACKLOG.md).** Zwei Korrekturen vor dem Start: die
> Mobil-Grenze ist NICHT vereinheitlicht (`useViewport.ts:24` steht auf 768,
> nur die NavRail auf 900 — betrifft Zug 6 und 7), und Abbruchbedingung 2
> (Historie-Desync) ist bereits eingetreten — erst Backlog-L2, dann Zug 2.

# Wargame — Morgen-Workflow: Push aufs Handy, dann abarbeiten

**Erstellt:** 2026-08-06 · **Planer:** Fable 5 · **Executor:** Opus 5 (blind ausführbar)
**Branch:** `cockpit-rebuild` · **Repo:** `~/Kevin OS/02 Projekte/uriel`

---

## Mission Brief

Kevins Morgen sieht so aus: Er greift zuerst zum Handy, nicht zum Laptop. Dort will
er von Uriel geweckt werden — nicht mit einer App-Suche, sondern mit einer
Benachrichtigung. Seine Worte (06.08.):

> „Ich würde ganz gern eine Benachrichtigung von Uriel bekommen aufs Handy morgens
> früh, wo ich dann draufklicke und dann kriegst so 'ne Zusammenfassung, was so am
> Tag ansteht." · „Dann will ich so morgens früh die erste halbe Stunde nutzen am
> Handy und einfach die ganzen Chats, Follow-ups und so weiter abarbeiten — aber im
> Uriel am besten selber." · „Dann steh ich auf und geh an den Laptop, schick ich
> direkt die Vernetzungsanfragen. Dann ist mein Vertriebstag schon gelaufen, wenn
> ich gerade anfange zu arbeiten."

**Der Ziel-Ablauf in vier Stationen:**

1. **~7:00, Handy:** Push von Uriel → Tipp → Morgen-Ansicht (Zusammenfassung des Tages).
2. **Erste halbe Stunde, Handy:** „Loslegen" → Arbeitsmodus: Name → Nachricht →
   Kopieren → App-Wechsel → senden → Haken. (Existiert — wird nur angebunden.)
3. **Am Laptop:** Vernetzungsanfragen auf LinkedIn, Zähler in Uriel mitklicken.
   Der Posten „Vernetzungsanfragen: noch X von 30" erinnert daran in „Jetzt dran".
4. **Danach Looms:** Skript liegt da (Scraping/Agent lief), Loom aus Uriel heraus
   öffnen, aufnehmen, Link in LinkedIn einfügen, Haken.

**Nicht im Scope (v1):** native iOS-App · Telegram-Bot · Antworten direkt aus Uriel
senden (LinkedIn-API) · Loom-Video-Verwaltung in Uriel (Loom hostet selbst und legt
den Share-Link nach der Aufnahme in die Zwischenablage) · Wochenend-Pushes.

**Leitplanken (Kevins UI-Gesetze, unverändert gültig):**
- Vollbild ist ein Handy-Konzept, nie Desktop.
- Kopieren-Knopf nur, wo versandfertiger Text liegt.
- ≤ 2 Interaktionen bis zur ersten erledigten Einheit: Push-Tipp → „Loslegen" → erster Posten steht.
- Keine neuen Metrik-Felder. `METRIC_FIELDS` ist gesetzt.
- Service Worker macht NUR Push. Kein Offline-Caching, kein Asset-Cache — sonst
  sieht Kevin nach Deploys alte Builds (die teuerste Falle dieses Plans).

---

## Recon-Befunde (verifiziert 06.08.2026 am Live-Code — nicht raten)

| Frage | Befund | Konsequenz |
|---|---|---|
| Abarbeitungs-UI mobil | `Arbeitsmodus.tsx` (Ein-Posten-Vollbild, Kopieren = `entwurf?.text ?? text`, Auto-Weiterschalten) | Existiert. Nur Einstieg verkürzen (Zug 7). |
| Tracking beim Abhaken | `arbeitsmodusTracking.ts` → Status-Übergang + `bump(metrikFeld)` + `arbeits_dauern` | Existiert. NICHTS doppelt bauen. |
| Anfragen-Zähler | `AnfragenZaehler.tsx` — mobil Vollbild-Ein-Knopf, Desktop Kachel-Fenster; bumpt `li_anfragen` (`SalesDashboard.tsx:484/576`) | Existiert. Fehlt nur als Posten in „Jetzt dran" (Zug 8). |
| Spur `anfrage` | In `prioritaet.ts:19/30` definiert, aber `arbeitsmodusQuellen.ts` liefert keine Posten — tote Bahn | Zug 8 füllt sie synthetisch. |
| Entwürfe morgens fertig | Antwort-Entwürfe-Agent als Runner-Routine werktags ab 6:00, `entwurf`-Spalte (0065), inline mit „Nachricht kopieren" | Existiert — Push muss nur darauf zeigen. |
| Morgenbrief | Runner-Routine, erster Werktags-Lauf (`runner/index.mjs:1774-1781`) — läuft NUR wenn der Mac wach ist | Deshalb Versand NICHT über den Runner (D2). |
| PWA-Stand | `site.webmanifest` verlinkt (`index.html:23`), `display: standalone`, Icons 192/512/180 ✓. KEIN Service Worker, KEIN Push-Code im Repo | Installierbar ja, Push = Neubau. |
| Netlify | SPA-Redirect `/* → /index.html` (`app/public/_redirects` + netlify.toml). Dateien aus `app/public/` werden VOR Redirects bedient | `/sw.js` aus public/ wird korrekt ausgeliefert. |
| Edge Functions | 15 Stück deployt, `verify_jwt` je Function in `supabase/config.toml`; Edge Functions bekommen `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` automatisch als env | `morgen-push` liest DB ohne neues Secret. |
| Cron | pg_cron/pg_net nirgends in `supabase/migrations/` | Zug 2 legt sie an. Migrationen NUR via `db push` (Historie-Desync-Lehre 15.07.). |
| Posten-Engine | `app/src/hooks/usePosten.ts` (`usePosten(slug)`, `entwuerfeOffen(geordnet)`), Tagesansage `cockpit/lib/tagesansage.ts` + `useArbeitsDauern` | /morgen (Zug 6) nutzt exakt diese Hooks — keine eigene Logik. |
| Deep-Link-Muster | `/sales?kachel=<id>` öffnet Kachel-Fenster, Param wird danach entfernt (`SalesDashboard.tsx:527-538`) | Zug 7 erweitert um `modus=arbeit`. |
| Mobil-Grenze | `isMobile` via `useViewport`, Grenze 900px vereinheitlicht (Etappe 2) | /morgen prüft dieselbe Grenze. |
| Loom am Posten | `Arbeitsliste.tsx`: „Skript öffnen/generieren" (Agent `loom-skript`), `loomVerschickt` + `looms`-Bump beim Haken | Fehlt nur „Loom aufnehmen"-Link (Zug 9). |
| Dev-Vorschau-Muster | `/dev/sales-vorschau` u. a., DEV-only mit Fixtures | Zug 6 bekommt `/dev/morgen-vorschau`. |

---

## Entscheidungen (getroffen, mit verworfenen Alternativen)

**D1 — Kanal = Web Push in der installierten PWA.** Uriel selbst schickt die
Benachrichtigung, der Tipp öffnet Uriel — kein Drittanbieter im Morgenritual.
*Verworfen:* ntfy (zweite App, kein Uriel-Erlebnis — bleibt Fallback, siehe
Abbruch), Telegram-Bot (dritte Plattform; die Backlog-Idee „Telegram-Freigaben"
bleibt davon unberührt), E-Mail (kein Push-Gefühl). *Preis:* Kevin muss Uriel
einmal zum Home-Bildschirm hinzufügen (iOS 16.4+, Voraussetzungen sind da).

**D2 — Versender = Supabase Edge Function `morgen-push`, getaktet von pg_cron.**
Alles Nötige (Threads, Entwürfe, Termine-Spiegel, Metriken) liegt in Supabase;
Edge Functions haben den Service-Role-Key automatisch. *Verworfen:* Runner (der
Mac schläft um 7:00 — exakt der Fehlermodus, den Kevin loswerden will), Netlify
Scheduled Functions (zweite Secret-Welt; bleibt Route B, Trigger in Zug 4).

**D3 — DST-fest statt schlau:** Cron feuert werktags **5:00 UTC UND 6:00 UTC**;
die Function sendet nur, wenn (a) Europe-Berlin-Stunde == 7, (b) `push_log` für
heute leer ist. Genau ein Push/Werktag, Sommer wie Winter, ohne Cron-Anfassen.

**D4 — Tipp-Ziel = neue Route `/morgen`** (mobil Vollbild-Zusammenfassung mit
„Loslegen"; Desktop leitet auf `/cockpit` um — Vollbild ist ein Handy-Konzept).

**D5 — Push-Inhalt sind Zahlen, keine Namen — und der Text ist zweistufig.**
Die Function zählt server-seitig (Näherung reicht); die exakte, priorisierte
Liste baut die App beim Öffnen über `usePosten`. Keine Duplikation der
prioritaet-Logik in Deno — sonst Drift. Kevins Regel (06.08.): „0 Entwürfe
fertig" darf NIE im Push stehen. Lief die Nacht-Analyse (Kriterium:
`max(entwurf_at) >= heute 00:00` Europe/Berlin), meldet der Push „Analyse
abgeschlossen — …"; lief sie nicht, sagt er stattdessen „N Posten warten —
MacBook aufklappen, dann bereitet Uriel die Entwürfe vor." Flankierend weckt
sich der Mac werktags selbst (Aktivierung Schritt 5), damit der zweite Fall die
Ausnahme ist.

**D6 — Anfragen-Posten nur am Desktop.** Kevin: „Vernetzungsanfragen machen nur
am Laptop Sinn." Mobil taucht die Spur nirgends auf.

**D7 — Zeit: 7:00, werktags** (Kevin sagte „um acht Uhr oder um sieben Uhr" —
Default 7:00, kohärent mit Morgenbrief/Entwürfe-Agent; Änderung = ein
Cron-Eintrag, siehe LEDGER).

---

## Etappe A — Die Push-Kette (der Neubau)

### Zug 1 — Service Worker, nur Push

**Aktion:** `app/public/sw.js` neu: `push`-Handler (`event.data.json()` →
`showNotification(title, { body, data: { url }, icon: '/icon-192.png', badge })`),
`notificationclick`-Handler (`notification.data.url ?? '/morgen'` →
`clients.matchAll` → vorhandenes Fenster fokussieren + navigieren, sonst
`clients.openWindow`). `install` → `skipWaiting()`, `activate` →
`clients.claim()`. **Kein** `fetch`-Handler, **kein** Cache-API-Aufruf.
Registrierung in `app/src/main.tsx`: `if ('serviceWorker' in navigator)
navigator.serviceWorker.register('/sw.js')` — fehlertolerant (catch → console.warn).

**Erwartete Beobachtung:** Dev-Server → DevTools → Application → Service Workers:
`sw.js` „activated". Cache Storage bleibt leer. App lädt nach Hard-Reload
unverändert frisch.

**Wahrscheinlichster Fehler:** Vite bedient `/sw.js` im Dev-Modus, aber ein
später hinzugefügter Bundler-Schritt (z. B. vite-plugin-pwa-Reflex) injiziert
Workbox-Caching. **Signal:** Cache-Storage-Einträge tauchen auf. **Gegenzug:**
kein PWA-Plugin verwenden — die Datei bleibt handgeschrieben in `public/`.

**Trigger:** Liefert `curl -sI localhost:<port>/sw.js` HTML statt JS (SPA-Fallback
greift) → Datei liegt falsch (nicht in `app/public/`) — Pfad korrigieren, nicht
am Redirect schrauben.

### Zug 2 — Migration 0067: Subscriptions, Log, Cron

**Aktion:** `supabase/migrations/0067_push_morgen.sql`:
- `push_subscriptions` (id uuid pk default, user_id uuid not null default auth.uid(),
  endpoint text unique not null, p256dh text not null, auth text not null,
  created_at, last_seen_at). RLS an: Owner-Policies (select/insert/update/delete
  auf `auth.uid() = user_id`).
- `push_log` (datum date pk, sent_at timestamptz, empfaenger int, payload jsonb).
  RLS an, nur select für eingeloggte (Service-Role schreibt daran vorbei).
- `create extension if not exists pg_cron; create extension if not exists pg_net;`
- Zwei Jobs via `cron.schedule('morgen-push-sommer', '0 5 * * 1-5', $$ ... $$)`
  und `'morgen-push-winter', '0 6 * * 1-5'`: `select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/morgen-push',
  headers := jsonb_build_object('Content-Type','application/json','x-cron-key',
  (select decrypted_secret from vault.decrypted_secrets where name = 'cron_key')),
  body := '{}'::jsonb )`.

**Erwartete Beobachtung:** `supabase db push` läuft durch; danach
`select jobname, schedule from cron.job;` (SQL-Editor oder `psql`) zeigt beide Jobs.

**Wahrscheinlichster Fehler:** Vault-Secrets existieren zum Migrationszeitpunkt
noch nicht → die Job-SQL schlägt erst zur LAUFZEIT fehl, nicht beim Push (Cron
speichert den Text). **Signal:** `cron.job_run_details` zeigt failed runs.
**Gegenzug:** Zug 3 legt die Vault-Secrets VOR dem ersten Feuern an; Reihenfolge
in der Aktivierungs-Checkliste festgehalten.

**Zweiter Fehler:** `db push` scheitert (Historie-Desync-Rückfall). **Signal:**
CLI meldet nicht angewendete Alt-Versionen. **Gegenzug:** STOPP — nicht in den
SQL-Editor ausweichen (Lehre vom 15.07.), sondern melden (Abbruchbedingung 2).

### Zug 3 — Schlüssel erzeugen und setzen (Executor, ohne Kevin-Eingaben)

**Aktion:** VAPID-Keypair generieren (`npx web-push generate-vapid-keys`).
Zufälligen `cron_key` erzeugen (`openssl rand -hex 32`). Dann:
- `supabase secrets set VAPID_PUBLIC_KEY=… VAPID_PRIVATE_KEY=… VAPID_SUBJECT=mailto:kevin.herrmann94@gmail.com CRON_KEY=…`
- Vault (SQL, einmalig, NICHT in eine Migrationsdatei): `select vault.create_secret('<https://….supabase.co>', 'project_url'); select vault.create_secret('<cron_key>', 'cron_key');`
- `netlify env:set VITE_VAPID_PUBLIC_KEY <public>` (CLI ist eingeloggt) und
  `app/.env.local` für lokal.

**Erwartete Beobachtung:** `supabase secrets list` zeigt die vier Namen;
`select name from vault.secrets;` zeigt `project_url`, `cron_key`.

**Wahrscheinlichster Fehler:** Public Key erreicht den Client-Build nicht (env
nur in Netlify, lokal vergessen oder umgekehrt). **Signal:** `subscribe` wirft
`InvalidAccessError`/leerer `applicationServerKey`. **Gegenzug:** Client zeigt
bei fehlendem `import.meta.env.VITE_VAPID_PUBLIC_KEY` einen klaren
Konfig-Hinweis statt eines toten Knopfs.

### Zug 4 — Edge Function `morgen-push`

**Aktion:** `supabase/functions/morgen-push/index.ts`, `verify_jwt = false` in
`config.toml` (Cron hat kein User-JWT). Zugangs-Weiche im Code:
`x-cron-key === Deno.env.get('CRON_KEY')` **oder** gültiges User-JWT
(`supabase.auth.getUser(bearer)`) mit `{ test: true }` im Body — alles andere 401.
Ablauf: (1) Guards — Werktag? Berlin-Stunde == 7? `push_log` heute leer? (bei
`test: true` alle drei überspringen); (2) Zählen per Service-Role-Client:
fällige Follow-ups + wartende Antworten (`linkedin_threads`, vereinfachte
Bucket-Näherung), fertige Entwürfe (`entwurf is not null`), offene
Erstnachrichten (`linkedin_erstnachrichten`), Termine heute (Kalender-Spiegel-
Snapshot), `li_anfragen` heute aus `daily_metrics`; (3) Payload nach D5
zweistufig — Analyse frisch: `{ title: 'Analyse abgeschlossen — N Posten bereit',
body: 'X Entwürfe fertig · Y Termine · Anfragen 0/30', url: '/morgen' }`;
Analyse nicht gelaufen: `{ title: 'N Posten warten', body: 'MacBook aufklappen —
dann bereitet Uriel die Entwürfe vor · Y Termine', url: '/morgen' }` (das Wort
„Entwürfe" mit Zahl kommt NUR in der Frisch-Variante vor);
(4) an alle `push_subscriptions` signiert senden (RECON-1-Lib); Antworten
404/410 → Subscription löschen; (5) `push_log` upsert (heute, Anzahl, Payload).

**Erwartete Beobachtung:** `supabase functions deploy morgen-push`, dann
`curl -X POST …/functions/v1/morgen-push -H "x-cron-key: …" -d '{"test":true}'`
→ `200 { sent: N }`; ohne Key → 401.

**Wahrscheinlichster Fehler:** Web-Push-Signierung (VAPID/aes128gcm) läuft nicht
in der Deno-Edge-Runtime. **Signal:** Import-/Crypto-Fehler beim Deploy oder
Senden. **Gegenzug = Trigger Route B:** Wenn RECON-1 nach zwei Lib-Versuchen
(`jsr:@negrel/webpush`, dann `npm:web-push`) scheitert → Versand als **Netlify
Scheduled Function** (Node, `web-push` läuft dort sicher; Cron in `netlify.toml`,
gleiche Guards, Secrets via `netlify env:set`). pg_cron-Jobs aus Zug 2 dann per
`cron.unschedule` entfernen. Die restlichen Züge ändern sich NICHT.

**RECON-1 (vor dem Bauen klären):** Minimal-Function mit `jsr:@negrel/webpush`
deployen und gegen eine Desktop-Chrome-Subscription senden. Erfolg = Notification
erscheint. Erst dann den vollen Zug bauen.

### Zug 5 — Client: Benachrichtigungen aktivieren

**Aktion:** Neues Modul `cockpit/lib/pushClient.ts`: `aktiviere()` (Permission
via Nutzer-Geste → `pushManager.subscribe({ userVisibleOnly: true,
applicationServerKey })` → Upsert in `push_subscriptions`), `status()`
(unsupported / nicht-standalone-iOS / aus / an), `probePush()` (ruft
`morgen-push` mit `{ test: true }` und User-JWT). UI an zwei Stellen: auf
`/morgen` (Zug 6) und im Mehr-Sheet (`NavRail.tsx:126`) als Zeile
„Benachrichtigungen". iOS-Weiche: Safari-Tab (kein
`navigator.standalone`/`display-mode: standalone`) → statt Knopf die
Zwei-Schritt-Anleitung „Teilen → Zum Home-Bildschirm".

**Erwartete Beobachtung:** Desktop-Chrome (localhost = secure context):
Klick → Browser-Permission-Dialog → `push_subscriptions` hat eine Zeile →
„Probe-Push" → Notification erscheint → Klick öffnet `/morgen`.

**Wahrscheinlichster Fehler:** `Notification.requestPermission()` ohne direkte
Nutzer-Geste aufgerufen (z. B. in useEffect) → iOS lehnt still ab. **Signal:**
Permission bleibt `default` ohne Dialog. **Gegenzug:** Aufruf ausschließlich im
onClick-Pfad, nie automatisch.

**Zweiter Fehler:** iPhone-Neuinstallation der PWA invalidiert die alte
Subscription. **Signal:** 410 beim Senden. **Gegenzug:** ist Zug 4 (Cleanup) +
`aktiviere()` upsertet auf `endpoint` — Neuaktivieren heilt.

### Zug 6 — Route `/morgen`: die Zusammenfassung

**Aktion:** `cockpit/pages/MorgenArea.tsx`, Route in `App.tsx` innerhalb
`CockpitShell` (`/morgen`). Desktop (`!isMobile`): `<Navigate to="/cockpit" />`.
Mobil: Vollbild-Aufbau (Muster `AnfragenZaehler` vollbild, safe-area-insets):
Begrüßung + Datum; Tagesansage-Zeile (`tagesansage(geordnet, dauern, jetzt)` aus
`usePosten` + `useArbeitsDauern` — exakt die SalesDashboard-Bausteine);
drei Kennzahl-Zeilen (Posten offen · Entwürfe fertig (`entwuerfeOffen`) ·
Termine heute mit Uhrzeit); Hinweis-Zeile „Vernetzungsanfragen X/30 — am
Laptop"; falls der Runs-Spiegel einen heutigen `morgenbrief`-Run hat: aufklappbar
dessen Markdown (nice-to-have, fehlt er, fehlt nichts); unten EIN großer Knopf
**„Loslegen"** → `navigate('/sales?kachel=jetzt-dran&modus=arbeit')`; darunter
klein der Benachrichtigungs-Status aus Zug 5. Dazu `/dev/morgen-vorschau`
(DEV-only, Fixtures, Muster SalesVorschau).

**Erwartete Beobachtung:** `/dev/morgen-vorschau` auf 390×664 (echte
Handy-Höhe — svh-Falle!): alles sichtbar ohne Scroll-Klemmer, „Loslegen" voll
tippbar über der Bottom-Bar.

**Wahrscheinlichster Fehler:** Vollbild-Overlay unter `#app-ui-overlay` mit
`pointer-events: none` (bekannte Falle) oder hinter der Bottom-Bar. **Signal:**
Knopf reagiert nicht / halb verdeckt. **Gegenzug:** `pointerEvents: 'auto'` +
z-Index über der Nav (Muster AnfragenZaehler:84).

### Zug 7 — `modus=arbeit`: vom Tipp in den Arbeitsmodus

**Aktion:** In `SalesDashboard.tsx` den bestehenden `kachel`-Param-Effekt
(527-538) erweitern: steht zusätzlich `modus=arbeit` und `isMobile`, dann statt
Fenster direkt `oeffneArbeitsmodus('alle', geordnet)` (Snapshot beim Öffnen —
Lehre vom 30.07. respektieren, den bestehenden Pfad nutzen, keinen neuen bauen).
Param wie `kachel` sofort entfernen. Desktop ignoriert `modus` (Fenster reicht).

**Erwartete Beobachtung:** Mobil `/sales?kachel=jetzt-dran&modus=arbeit` →
Arbeitsmodus steht mit Posten 1; Haken → Posten 2 (Auto-Weiterschalten);
Reload danach → kein erneutes Aufspringen.

**Wahrscheinlichster Fehler:** Effekt feuert, bevor `geordnet` geladen ist →
Arbeitsmodus mit leerer Liste. **Signal:** „Alles abgearbeitet" trotz offener
Posten. **Gegenzug:** Effekt wartet bis Quellen geladen (`!loading` der
beteiligten Hooks) und `geordnet.length > 0`, sonst Param verwerfen und nur das
Fenster öffnen.

---

## Etappe B — Ritual-Lücken (klein, nach Etappe A)

### Zug 8 — Synthetischer Anfragen-Posten (nur Desktop)

**Aktion:** In `SalesDashboard.tsx` (nicht in `arbeitsmodusQuellen.ts` — die
Quelle ist `daily_metrics`, kein Zeilen-Objekt): solange
`tag.anfragenHeute < tag.anfragenLimit` und `!isMobile` einen Posten
„Vernetzungsanfragen: noch X von 30" (Spur `anfrage`, Rang gemäß
`prioritaet.ts`) in `geordnet` einspeisen. In der `Arbeitsliste` bekommt er
GENAU EINE Aktion: „Zähler öffnen" (öffnet die Kachel `vernetzungsanfragen`) —
**kein Haken, kein Kopieren** (er verschwindet von selbst, wenn das Limit
erreicht ist; die Wahrheit ist der Zähler). Er läuft NIE durch `erledigePosten`
(sonst Doppelzählung auf `li_anfragen` — das ist die gefährlichste Stelle dieser
Etappe) und NIE in den mobilen Arbeitsmodus (D6-Filter an beiden
`oeffneArbeitsmodus`-Einspeisungen).

**Erwartete Beobachtung:** Desktop, 0/30: „Jetzt dran" zeigt den Posten; Klick →
Zähler-Fenster; +1 → Posten zeigt „noch 29"; bei 30/30 verschwindet er. Mobil:
nirgends zu sehen. `daily_metrics.li_anfragen` steigt NUR über den Zähler.

**Wahrscheinlichster Fehler:** Der Posten rutscht in die Tagesansage-Dauerrechnung
(`arbeits_dauern` hat keine `anfrage`-Mediane) → „≈ ?"-Anzeige. **Signal:**
Tagesansage ohne Zeit. **Gegenzug:** `tagesansage` behandelt Spuren ohne
Messwerte bereits mit Mindestschwellen — verifizieren, sonst Spur von der
Dauer-Summe ausnehmen.

### Zug 9 — „Loom aufnehmen" am Loom-Posten

**Aktion:** In `Arbeitsliste.tsx` (und im `Arbeitsmodus` für Loom-Posten) neben
„Skript öffnen" ein Link-Knopf „Loom aufnehmen" → `https://www.loom.com/record`
in neuem Tab (die Loom-Desktop-App fängt das selbst ab, wenn installiert; kein
`loom://`-Gefrickel — nicht verlässlich). Kein Upload-Handling: Loom legt den
Share-Link nach der Aufnahme selbst in die Zwischenablage; Kevin fügt ihn in die
LinkedIn-DM ein (DM-Text liegt als Entwurf/Vorlage hinter dem bestehenden
Kopieren-Knopf). Haken danach = bestehende Kette (`loomVerschickt` +
`looms`-Bump).

**Erwartete Beobachtung:** Loom-Posten zeigt drei Aktionen: Skript öffnen ·
Loom aufnehmen · Haken. Klick öffnet loom.com/record, Uriel-Tab bleibt erhalten.

**Wahrscheinlichster Fehler:** Popup-Blocker schluckt `window.open` aus
async-Kontext. **Signal:** nichts öffnet sich. **Gegenzug:** echter `<a
href target="_blank" rel="noopener">` statt JS-open.

---

## Verifikation (Executor fährt selbst, vor der Übergabe)

1. `tsc -b` + `vite build` grün (bestehender Standard).
2. **Push-Kette E2E am Desktop-Chrome (localhost):** aktivieren → Zeile in
   `push_subscriptions` → Probe-Push → Notification → Klick landet auf `/morgen`.
   Das ist ohne iPhone vollständig testbar — Web Push läuft in Desktop-Chrome.
3. `curl` gegen `morgen-push`: mit `x-cron-key` 200 + `push_log`-Zeile; zweiter
   Aufruf am selben Tag → 200 mit `skipped: 'already-sent'`; ohne Key → 401.
4. SQL: `select jobname, schedule from cron.job;` → beide Jobs;
   nach dem ersten echten Morgen `cron.job_run_details` ohne Fehler.
5. Screenshots: `/dev/morgen-vorschau` auf 390×664 UND Desktop-Redirect-Nachweis.
6. Zug-8-Doppelzähl-Probe: Zähler +3 am Desktop → `daily_metrics.li_anfragen`
   exakt +3 (nicht +4 durch einen versehentlichen erledigePosten-Pfad).
7. KEINE E2E-Agent-Runs, kein echter 7:00-Warte-Test — der erste echte Morgen ist
   Kevins Abnahme (siehe Aktivierung).

---

## Aktivierung durch Kevin (einmalig, in dieser Reihenfolge)

1. **Freigabe Migration:** Executor führt `supabase db push` (0067) — Kevins Go
   genügt, kein SQL-Editor.
2. **Live schalten** (main-FF + Netlify-Deploy — der Classifier verlangt Kevins
   explizites „live schalten").
3. **iPhone:** Safari → frameworkos.de → Teilen → **Zum Home-Bildschirm** (falls
   Uriel dort schon liegt: einmal löschen und neu hinzufügen, damit der neue
   Service Worker sicher drin ist) → App öffnen → einloggen → `/morgen` →
   „Benachrichtigungen aktivieren" → Erlauben → **Probe-Push** antippen.
4. Ab dem nächsten Werktag um 7:00: der echte Push. Kommt keiner →
   `cron.job_run_details` + `push_log` sagen, welche Stufe schwieg.
5. **Mac-Selbstwecker (empfohlen, macht „Analyse abgeschlossen" zum Normalfall):**
   im Terminal `sudo pmset repeat wakeorpoweron MTWRF 05:50:00` — der Mac weckt
   sich werktags um 5:50, der launchd-Runner läuft an, Entwürfe-Agent (ab 6:00)
   und Morgenbrief sind vor dem Push durch, danach schläft er wieder ein.
   Bedingungen: MacBook nicht heruntergefahren (zugeklappt ist ok — der Mac
   wacht „dunkel" auf, Display bleibt aus, Prozesse laufen), idealerweise am
   Netzteil; bei sehr niedrigem Akku überspringt macOS Weck-Termine.
   Achtung: `pmset repeat` überschreibt vorhandene Wiederhol-Zeitpläne
   (`pmset -g sched` zeigt den Stand vorher).
   **Voraussetzung im Code (Executor, Teil von Etappe A):** Der Runner muss den
   Mac während eines Agenten-Laufs wachhalten, sonst schläft er im Dark Wake
   nach ~1–2 Minuten wieder ein, bevor die Analyse fertig ist. Kleinster
   Eingriff: In `startRun` (`runner/index.mjs`) den `claude`-Spawn in
   `caffeinate -i <cmd>` wickeln (oder parallel `caffeinate -i -w <pid>`
   starten) — die Wach-Assertion endet automatisch mit dem Prozess.
   Verifikation: `pmset -g assertions` zeigt während eines Laufs
   `PreventUserIdleSystemSleep` durch caffeinate.

---

## LEDGER — offene Variablen

| Variable | Default | Änderung |
|---|---|---|
| `{{PUSH_ZEIT}}` | 7:00 Europe/Berlin, werktags | Kevin sagte „7 oder 8" — bei 8:00: Berlin-Stunden-Guard auf 8 + Cron auf `0 6/7 * * 1-5` |
| `{{WOCHENENDE}}` | aus | zweites Cron-Paar `* * 6,0` + Guard-Anpassung |
| `{{PUSH_TEXT}}` | zweistufig nach D5 („Analyse abgeschlossen …" / „MacBook aufklappen …") | reine Textsache in `morgen-push` |
| `{{WECK_ZEIT}}` | 5:50 werktags (`pmset`) | vor dem Entwürfe-Agent (6:00) halten |

**RECON NEEDED (vor Zug 4):** RECON-1 Web-Push-Signierung in Deno-Edge —
Check steht in Zug 4. Alles andere ist am Code verifiziert.

---

## Abbruchbedingungen — stoppen und melden statt improvisieren

1. **RECON-1 scheitert UND Route B (Netlify) scheitert** → stopp. Dann ist die
   Frage an Kevin: ntfy als Kanal akzeptieren (App-Installation) oder warten.
2. **`supabase db push` meldet Historie-Desync** → stopp, nichts in den
   SQL-Editor tippen (Lehre 15.07.), Befund melden.
3. **iOS zeigt nach Installation + Erlauben + Probe-Push nichts** (bekannt
   launische Stelle) → Desktop-Nachweis dokumentieren, Befund + ntfy-Frage an
   Kevin — NICHT stundenlang am Service Worker raten.
4. **Jede Frage, deren Antwort Geld, Löschen oder Live-Schaltung ist** → Kevin.

---

## Red-Team-Protokoll (Angriffe gegen den Plan, vor der Übergabe gefahren)

- **„Der SW cached die App und Kevin sieht nach Deploys alte Builds"** — der
  Angriff, der beim ersten Entwurf DURCHKAM (ein `fetch`-Handler mit
  Cache-First-Reflex stand drin). Patch: Zug 1 verbietet fetch/Cache explizit,
  Beobachtung prüft leeren Cache Storage. 
- **„DST verschiebt den Push auf 6:00 oder 8:00"** — abgewehrt durch D3
  (Doppel-Cron + Stunden-Guard + Tages-Log).
- **„Synthetischer Posten doppelzählt li_anfragen"** — abgewehrt durch Zug 8
  (nie durch `erledigePosten`) + Verifikation 6.
- **„Push um 7:00, aber Entwürfe-Agent (ab 6:00, Mac-abhängig) lief nicht →
  Push verspricht Entwürfe, die fehlen"** — erster Patch („ehrlich 0 Entwürfe
  melden") von Kevin KASSIERT (06.08.): eine Zahl 0 ist kein Morgen-Erlebnis.
  Neuer Patch = D5 zweistufig („MacBook aufklappen"-Variante) + Selbstwecker
  (Aktivierung 5), damit die Variante selten bleibt. Endgültige Lösung ist der
  Umzug der Agenten auf den Hostinger-Server (Jarvis Phase D, eigenes Vorhaben —
  nicht Teil dieses Wargames).
- **„Permission-Request ohne Geste"** — abgewehrt in Zug 5.
- **„Subscription-Leichen nach PWA-Neuinstallation"** — abgewehrt in Zug 4/5
  (410-Cleanup + endpoint-Upsert).
