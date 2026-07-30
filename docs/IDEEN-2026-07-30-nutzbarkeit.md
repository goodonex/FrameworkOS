# Uriel — Ideen-Sammlung: nutzbarer · nützlicher · schöner · aufgeräumter

Stand 30.07.2026, Branch `cockpit-rebuild`. Entstanden aus zehn parallelen
Code-Lesern über alle Bereiche (Cockpit, Heute, Sales, LinkedIn, Projekte/Portal,
Ads/Content/E-Mail/Agenten, Tracking/Ziele, Design-System, Runner, Docs-Backlog).
Jede Idee hängt an realem Code mit Datei-Bezug. Aufwand: S/M/L · Wirkung: hoch/mittel/niedrig.

---

## Leitprinzip: Klick-Ökonomie (Kevin, 30.07.)

Nicht alle Klicks sind gleich. **Arbeits-Klicks** (Haken, Kopieren, Senden) sind
proportional zur Arbeit und in Ordnung. **Weg-Klicks** (Bereich wechseln, Tab
öffnen, nachsehen ob etwas da ist) sind Verschwendung und werden eliminiert:

1. **Ein Einstieg:** Uriel öffnen = die priorisierte Liste steht da (Heute-Deck
   v2 aus der Posten-Engine). Kein Abklappern von Home/Sales/Terminen/Freigaben.
2. **Aktion am Posten, nicht im Bereich:** Entwürfe, Skripte, Links kleben am
   Namen im Kachel-Fenster — null Bereichswechsel pro Arbeitseinheit.
3. **Nachts vorarbeiten:** Was ein Agent vorwegnehmen kann, ist kein Klick mehr
   (Morgenbrief als Routine, Antwort-Entwürfe für alle „Du bist dran"-Threads
   vorgenerieren).
4. **Weiterschalten:** Nach „Erledigt" klappt automatisch der nächste offene
   Posten auf (Desktop-Arbeitsliste; mobil tut der Arbeitsmodus das schon).
   Tasten: Enter = Haken, K = Kopieren.

**Tabs:** Warteschlange vorn, Nachschlagewerk hinten — keine *Arbeit* hinter
Tabs (Sales-/Heute-Subtabs lösen sich in Liste/Deck auf), aber Nachschlagen
(Bibliothek, Historie, Einstellungen) bleibt zu Recht dahinter. Nicht alles auf
eine Seite stapeln — das wäre wieder die Kachel-Wand.

Messlatte: von „Uriel öffnen" bis zur ersten erledigten Einheit ≤ 2
Interaktionen; Antwort-an-Lead-Flow von ~10 auf 3.

---

## Das große Bild — drei Erkenntnisse

1. **Das Phosphor-Cockpit ist gut. Es ist nur nicht allein.** Neben ~16.100 Zeilen
   Cockpit leben ~71.600 Zeilen Glass-Legacy (Brand-Ära, Eversmell-Promo, altes
   Sales) weiter im Bundle und lecken an sichtbaren Stellen rein (Cmd+K, Toasts,
   Fokus-Ring, Sales-Subtabs, ProjectPage). Der größte Schönheits- UND
   Aufgeräumt-Hebel ist **Abriss, nicht Neubau**.
2. **Es gibt zwei konkurrierende Antworten auf „was zuerst?"** — das HeuteDeck auf
   der Home (eigene Fälligkeits-Logik) und die Posten-Engine (`prioritaet.ts`)
   hinter dem Sales-Dashboard. Dazu zwei Follow-up-Systeme (contacts vs.
   linkedin_threads). Vereinheitlichen auf die Posten-Engine = ein Morgen-Einstieg.
3. **Die Runner-Brücke ist halb fertig.** Vom Handy kann Kevin Agenten *starten*,
   aber kein Ergebnis erreicht je das Handy: Runs, Loom-Skripte, Follow-up-PDFs,
   Kalender — alles hängt an `127.0.0.1`. **Ein Muster** (Runs + Dateien in den
   Supabase-Spiegel/Storage) heilt vier Oberflächen gleichzeitig (Freigaben,
   Agenten-Feed, Sales-Bibliothek, Kalender).

---

## Sofort — termin- oder risikokritisch

| Was | Warum jetzt | Wo | Aufwand |
|---|---|---|---|
| **Wochen-Vitals-Bug vor Samstag (01.08.)** | `weekRows` wird aus `monthRows` abgeleitet — am 1.8. verliert die Woche Mo–Fr, Vitals zeigen ~0/75 | `useDailyMetrics.ts:365-368`, `metricsAggregate.ts:80-108` | S |
| **Freigaben-Status persistieren** | sent/copied lebt nur im React-State — nach Reload steht alles wieder auf „pending" → **E-Mail-Doppelversand an Leads möglich** | `FreigabenArea.tsx` | S |
| **markDone-Ratsche im LinkedIn-Postfach** | „Erledigt" auf „Du bist dran" zählt stur `followup_stage+1`; ein Lead, der nach 3 Follow-ups **antwortet**, wird still archiviert | `useLinkedinThreads.ts:84-93`, `linkedinFollowups.ts:65` | S |
| **Monatsziel-UI vor 01.09.** | ab September zeigt die Home stillschweigend 40.000 €-Default; `setMonthTotalOverride` hat null Aufrufer, kein UI, localStorage würde Mac/Handy divergieren | `goals.ts:116/174`, `GoalCard.tsx` — Persistenz in Supabase | S–M |

---

## Top 7 — größter Hebel je Aufwand (Empfehlung)

1. **Runs- und Datei-Spiegel: Agent-Ergebnisse aufs Handy** *(M · hoch)*
   `fetchRuns/fetchRun` (`runnerApi.ts:66-73`) haben als einzige keinen
   Spiegel-Pfad → auf frameworkos.de sind „Letzte Runs", Dream-Zeile,
   RunWatcher-Toasts und die komplette Freigaben-Queue tot. Fix: Snapshot-Key
   `runs` in `mirrorAll` (`runner/index.mjs:634`) + Push direkt in
   `proc.on('close')`. Zweiter Schritt: Loom-HTML/PDFs/Galerien nach Supabase
   Storage spiegeln und `salesFileUrl/socialFileUrl/adFileUrl` bei
   `!runnerDirekt()` auf Storage-URLs umschalten — dann liest Kevin ein frisches
   Loom-Skript unterwegs, statt „Skript bereit — am Mac öffnen" zu sehen.
2. **Antwort-Entwürfe-Agent → direkt am Posten** *(M · hoch)*
   Der größte Funnel-Hebel: Es gibt Agenten für Follow-ups, aber keinen für
   **eingehende Antworten** — genau da verhungern Leads. Neuer readonly-Agent
   (herrmann-outreach-Stimme) über unbeantwortete Threads; Ergebnis inline im
   Kachel-Fenster am antwort/followup-Posten als versandfertiger Text **mit
   Kopieren** (dann gilt das Kopier-Gesetz) statt Drei-Bereiche-Umweg
   Sales → /linkedin → /freigaben. Voraussetzung mit Langfrist-Wert:
   Verlauf mitsyncen (`sync.mjs:313-315` wirft heute alle Messages bis auf die
   letzte weg — der Agent kennt das Gespräch sonst nicht).
3. **Heute-Deck v2: EIN Morgen-Einstieg** *(M · hoch)*
   `HeuteDeck.tsx` von der alten Kontakt-Logik auf `ordnePosten` aus
   `prioritaet.ts` umstellen (gleiche Rangfolge wie „Jetzt dran"), darüber die
   heutigen Termine (eventsByDate aus TermineArea existiert), daneben „N Entwürfe
   warten" → /freigaben. Zeigt Top-5 und verlinkt in die Sales-Kachel-Fenster —
   baut KEINE eigene Abarbeitungs-UI. Dazu: Posten-Verdrahtung als gemeinsamer
   Hook `usePosten` (heute ~40 Zeilen in `SalesDashboard.tsx:234-275`).
4. **Tagesansage aus `arbeits_dauern`** *(M · hoch)*
   Die Tabelle wird seit gestern beschrieben und nirgends gelesen. Hook
   `useArbeitsDauern` (Median je Spur, ~30 Tage) × Liste `geordnet` →
   Unterzeile in „Jetzt dran": **„12 offen · ≈ 1 h 40 · um 13:25 durch"**.
   Kevins Morgen-Frage, aus eigenen Messdaten.
5. **Mobile Bottom-Bar 9 → 5 Tabs, E-Mail raus** *(M · hoch)*
   9 Tabs à ~41px mit 9px-Labels (`NavRail.tsx:4-16`, `cockpit.css:410-437`) auf
   Kevins Morgen-Gerät. Neu: Cockpit · Heute · Sales · Projekte · Mehr (Sheet).
   E-Mail-Area (52-Zeilen-Adapter um ~1.100 Zeilen Eversmell-Newsletter-Altbau,
   Gmail ist die Realität) aus Nav + Route streichen.
6. **Legacy-Abriss, Etappe 1** *(M–L · hoch für Ruhe & Ästhetik)* — siehe
   Abriss-Liste unten. Plus Anker-Docs entgiften: `HANDOFF.md` beschreibt die
   abgerissene Three.js-Welt (Migrationen 0001-0013, real: 0061) — genau die
   Datei, die neue Claude-Sessions als Kontext lesen. Neu schreiben,
   `world-roadmap.md`/`open-questions.md` mit Historisch-Banner, in
   `IDEAS-2026.md` Erledigtes abhaken (H1-H3, H7, A1, R1, G2).
7. **Die letzten Glass-Leaks schließen: Cmd+K, Toasts, Fokus-Ring** *(M · mittel-hoch)*
   CommandPalette ist volle Glass-Optik mit toten Brand-/ICP-Kommandos und kennt
   nur 4 von 10 Bereichen (`CommandPalette.tsx:150-155/272-284`); Toast liegt auf
   dem Chat-FAB bzw. über der Bottom-Bar und blendet Fehler nach 2,2 s aus
   (`Toast.tsx:26/34`); der globale Fokus-Ring ist Teal aus `tokens.css:223-230`.
   Alle drei auf ck-Tokens → das Cockpit wirkt wie EIN Produkt.

---

## Nutzbarer (Arbeitsfluss)

- **Anfragen-Ritual als synthetischer Posten in „Jetzt dran"** *(S · mittel)* —
  solange `tag.anfragenHeute < 30`: Posten „Vernetzungsanfragen: noch X von 30",
  Klick öffnet den Zähler. Erst dann heißt „Liste leer" wirklich Feierabend
  fürs Ritual. (`SalesDashboard.tsx:269-270` — Spuren anfrage/inmail sind heute
  hart leer, Rangplätze 7+8 tote Bahnen.)
- **Erstnachrichten: „Kopieren & Profil öffnen" als ein Griff** *(S · mittel)* —
  halbiert die Klicks im häufigsten Funnel-Schritt (20+ Leads je Runde),
  `Arbeitsliste.tsx`.
- **Loom-Status direkt am Stern-Thread setzen** *(S · mittel)* —
  `markLoomVerschickt` existiert, /linkedin nutzt es nirgends.
- **Morgenbrief als Zeit-Routine statt Knopf** *(S · mittel-hoch)* — Muster von
  `maybeDream` (`runner/index.mjs:1392`) auf `morgenbrief` kopieren: werktags
  ~7:00, Brief liegt fertig da, wenn Kevin sich setzt.
- **Kalender auf der Live-Domain** *(S · mittel)* — `fetchCalendar` hat keinen
  Spiegel-Pfad; der Runner holt die iCal ohnehin schon (`/calendar`-Proxy) →
  als Snapshot pushen.
- **Ads: Review-Durchgang** *(S · hoch für die anstehende Arbeit)* — 20
  Reichentrog-Ads stehen auf „review", aber `AdDetailPanel` hat kein
  Vor/Zurück: Pfeiltasten + „Ad 7/20, 3 freigegeben".
- **Agenten mit Pflicht-Input nicht blind startbar** *(S · mittel)* —
  `AgentsArea.tsx:74` startet loom-skript/followup-pdf ohne name/website →
  kaputte Runs; `needsInput`-Flag + Mini-Formular.
- **Tages-Agenda-Zeile über dem Monatsraster** *(S · mittel)* — TermineArea ist
  am Handy unlesbar; „Heute"-Zeile zuerst, Raster klappbar.
- **iCal-Wiederholungstermine expandieren** *(M · mittel)* — Serien-Termine
  verschwinden ab Woche 2 (steht als v1-Hinweis in der UI); RRULE WEEKLY/DAILY
  mit ~8 Wochen Horizont reicht.
- **Auto-getrackte Felder in TrackingArea kennzeichnen** *(S · mittel)* — seit
  dem Arbeitsmodus bumpen sich 5 Felder selbst; „auto"-Badge + zweite Reihe,
  sonst Doppelzähl-Falle. Gleiches Risiko bei QuickTrack auf der Home.

## Nützlicher (neue Hebel)

- **Kunden-Posteingang im Cockpit** *(M · hoch)* — das Portal verspricht „Antwort
  in 24h", aber Kevin sieht Kundennachrichten fast nie (`ProjectMessagesPanel`
  nur in einer Spezial-Phase, `MessagesInbox` nur in der Legacy-BrandPage).
  Ungelesen-Badge auf der ProjectCard + Karten-Block (Name → Text → Antworten →
  Haken). **Solange das fehlt, darf kein Kunde das Portal ernsthaft nutzen.**
- **Deliverable-Abnahme im Portal** *(M · hoch)* — „Freigeben / Änderungswunsch"
  pro Deliverable ersetzt die WhatsApp-Schleife und gibt Solmaz/Reichentrog
  einen Grund, sich einzuloggen. Zusammen mit dem Posteingang die kürzeste
  Strecke zu „Kunden benutzen es echt".
- **Website-CMS-Schleife schließen oder ausblenden** *(M · mittel)* — der
  Freigabe-Flow existiert komplett, aber keine reale Kundenseite liest
  `site_content_published`. Entweder Snippet in colective.de (i18n.js) — oder
  CMS-Sektionen im Portal verstecken. Aktuell ist es ein Vertrauensrisiko.
- **Beziehungs-Reminder „Still geworden"** *(M · mittel)* — Karte im Heute-Deck:
  Kontakte ohne Aktivität > X Tage (`contacts.last_contact_at`), das häufigste
  Umsatz-Leck im Solo-Vertrieb.
- **LinkedIn-Antworten aus dem Sync ableiten** *(M · mittel)* — erst
  „erkannt: N" neben dem Hand-Stepper (Drift sichtbar), später Auto-Schreiben
  je Thread/Tag. Entlastet genau die Kennzahl mit dem größten Feedback-Wert.
- **Content: Batch füllt das Manifest** *(M · hoch)* — der weekly-content-Agent
  baut Wochen-HTMLs, schreibt aber nie ins `content.json` → der Default-Tab
  „Posts" zeigt einen überfälligen Testpost vom 17.07. Batch appendet seine
  3 Posts (Caption/Slides) → die fertige Pipeline wird zum Posting-Cockpit.
  Dazu: „Als gepostet markieren"-Haken (Flag wird gerendert, hat keinen
  Schreiber) + „Posting fällig"-Karte im Heute-Deck.
- **Telegram-Freigaben (A2 aus IDEAS-2026)** *(M · hoch, nach Runs-Spiegel)* —
  Entwürfe als Telegram-Nachricht mit Approve-Knopf; ersetzt die Mobile-App-Idee.
- **Call-Mode auf den echten Funnel stellen oder streichen** *(M · mittel)* —
  heute baut er eine Telefon-Kaltakquise-Queue aus allen Kontakten mit Nummer;
  Kevins Quali-Calls entstehen aus Threads. Umstellen auf „Loom verschickt /
  Termin vereinbart" — oder Tab raus.

## Schöner (Ästhetik, Ruhe, Lesbarkeit)

- **ProjectPage in die ck-Welt portieren** *(M · hoch)* — der wichtigste
  Arbeitsbildschirm (1.113 Zeilen) ist noch komplett Glass-Ära und wirkt wie
  eine fremde App; dazu doppelte Zurück-Buttons und Links in die Legacy-Welt
  (`ProjectPage.tsx:574/227`, `SalesDashboard.tsx:430`).
- **Sales-Subtabs (Pipeline/Listen/Call-Mode/Kontakt) restylen — nach der
  Entscheidung, was bleibt** *(L · mittel)* — `SalesMode.tsx` allein hat 2.504
  Zeilen mit 117 Glass-Treffern.
- **Thread-Karten in /linkedin als aufklappbare Namensliste** *(M · mittel)* —
  statt Karten-Wand mit drei permanenten 10px-Knöpfen; das Muster liegt fertig
  in `Arbeitsliste.tsx`.
- **Uppercase-Diät + Grauton-Klärung** *(M · mittel)* — fast alles ist
  uppercase-gesperrt, Hierarchie entsteht nur über Größe; `--ck-text-2` und
  `--ck-text-3` sind visuell nicht unterscheidbar.
- **Nav-Icons emoji-fest machen** *(S · mittel)* — ☑ ⚙ ✉ rendern auf iOS als
  bunte Emoji in der Bottom-Bar; Variation Selector-15 oder Inline-SVGs.
- **Run-Drawer weiß-auf-dunkel-Bug** *(S · niedrig)* — `--ck-bg-1` und
  `--ck-danger` existieren nicht in cockpit.css, Drawer fällt auf Weiß zurück
  (`AgentsArea.tsx:200/34`).
- **Ads-Dashboard: Review-Stand statt vier leerer KPI-Kacheln** *(S · mittel)* —
  Spend/Leads/CPL/CTR sind alle „—"; solange keine Daten: Checklisten-Fortschritt
  zeigen, Performance-Schicht erst mit echten Zahlen.
- **Ein Mobile-Breakpoint** *(S · mittel)* — JS sagt 768, CSS schaltet bei 900;
  dazwischen zwei halbe Welten (`useViewport.ts:24` vs. `cockpit.css:337/395`).

## Aufgeräumter (Abriss-Liste)

**Sofort löschbar (null Importeure / nachweislich tot):**
- `components/sales/`: ContactActivityTab, ContactEmailsTab, ContactCallsTab, OpportunityCard, ContactPresenceEmbeds
- `components/portal/`: PortalCommandCenter (238 Z.), PortalChatDock (170), PortalMessages (108), PortalTimeline (90), PortalProgressiveDelivery (135), PortalFunnelVisual + `pages/BrandDashboardPage.tsx` + ~18 verwaiste portal.css-Blöcke (~900 Zeilen gesamt)
- `lib/mockIntelligence.ts`, `mockFocusEngine.ts`, `mockDiscoveryAgent.ts` (seit 19.07. bekannt)
- `cockpit/lib/urielVoiceSettings.ts` (URIEL_VOICES ohne Importeur)
- `goals.ts`: `RETAINER_KUNDEN_KEY`, `CHANNEL_BENCHMARKS` (Benchmarks leben doppelt in `metricsAggregate.ts:177-179`!); `metricsAggregate.ts`: `antwortenTotal`
- NavRail „Universe"-Link (Selbst-Redirect auf /cockpit)
- `Background.tsx` von allen Cockpit-Routen (drei blur(80px)-Blobs compositen unsichtbar unter der opaken Shell — GPU umsonst)

**Entscheiden, dann abreißen:**
- Alte Brand-Sales-Welt: `SalesSection` → SalesHomeDashboard + DailyWorkList + useDailyWorkList + salesNextCalls + modules/sales/* (Routen leiten längst ins Cockpit um)
- `/brand/:slug/deliver`-Kette (DeliverMode 323 Z. + DeliverWorkspaceModule + Gate) — dupliziert /projekte; Redirect setzen, dann löschen; danach BrandPage-Frage (Promo als letzter Mieter?)
- Alte Tracking-Welt: PerformanceTrackingSection, GoalsCard, SalesGoalsDrawer/useSalesGoals (konkurrierende `sales_goals`-Zielverwaltung)
- Legacy-Metrikfelder `coldmails`, `followups`, `termine_vereinbart`, `antworten_cold` aus Typ/emptyRow/Upsert
- InMails-Kachel: Stub fertig bauen (Credits per +/- pflegbar, `INMAIL_CREDITS_STAND=150` hartkodiert) oder raus
- Runner: `Vault/System/Queue` ist write-only und wächst unbegrenzt; `queued:[]` hartkodiert — Konzept streichen. `linkedin_sync`-Job umgeht den Doppellauf-Guard (`runner/index.mjs:724` vs. `1164`) — 3 Zeilen, Account-Risiko.
- Follow-up-Doppelwelt festschreiben: Threads = LinkedIn-Funnel, contacts = Kunden-/Deal-Follow-ups
- CRM-Doppeldatenhaltung Supabase+localStorage in `useContacts.ts` (Geister-Kontakte; Freigaben-Queue versendet inzwischen E-Mails auf dieser Basis) — eigener 0,5-1-Tages-Schritt

**Kleinere Konsistenz-Funde:** `.ck-heute-grid` ohne display:grid (wird inline nachgepatcht) · `entwurfMoeglich`-Prop hart auf true · `unread` gesynct aber nie angezeigt · Snooze ohne Weg zurück („ruht"-Bucket unsichtbar) · Pitch-Modus hängt am Namens-Suffix „— Pitch" · `?preview=true` lädt Projekte aus localStorage · NavRail-„Heute" leuchtet auf /linkedin nicht · Entwürfe bewusst flüchtig (weg beim nächsten Run) — braucht mit Inline-Entwürfen Persistenz.

---

## Vorgeschlagene Etappen

1. **Diese Woche (alles S):** Vitals-Bug (vor Sa!), Freigaben-Persistenz,
   markDone-Fix, Monatsziel-UI, Sofort-löschbar-Liste, Toast/Fokus-Ring.
2. **Nächster Block (Handy vollwertig):** Runs- + Datei-Spiegel, Kalender-Spiegel,
   Bottom-Bar 9→5, E-Mail raus, Morgenbrief-Routine.
3. **Danach (der Funnel-Hebel):** Verlauf syncen → Antwort-Entwürfe am Posten →
   Heute-Deck v2 → Tagesansage aus arbeits_dauern.
4. **Laufend:** Legacy-Abriss etappenweise, ProjectPage-Portierung, Portal-Posteingang.
