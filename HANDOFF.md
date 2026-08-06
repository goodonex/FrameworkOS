# Uriel — Handoff (Stand 2026-08-06, abends)

Kompakter Einstieg in den **realen** Stand nach Cockpit-Rebuild und den Etappen 1–4.

- **Was noch offen ist:** [`docs/BACKLOG.md`](docs/BACKLOG.md) — die eine Quelle der Wahrheit.
- **Warum etwas so gebaut ist:** [`docs/rebuild-notes.md`](docs/rebuild-notes.md) + `git log`.
- **Design-Regeln:** [`docs/REBUILD-PLAN.md`](docs/REBUILD-PLAN.md) §4 (Mission Control, verbindlich).

> Ein früherer Handoff beschrieb die Vor-Rebuild-App („Brand OS", sechs Denk-Modi,
> Three.js-Universe, Migrationen bis 0013). Das ist überholt.

---

## Der wichtigste Satz für eine neue Session

**Die Etappen 1–4 sind live** (`main` = `de60288`, ausgeliefert `index-BjbadBHB.js`).
Auf `cockpit-rebuild` liegt die **Aufräum-Runde vom Abend des 06.08.**, noch nicht
live. Wie viele Commits das sind, sagt `git log --oneline main..cockpit-rebuild` —
eine Zahl in diesem Dokument wäre ab dem nächsten Commit falsch.
Der Livegang ist ein Fast-Forward (`main` hat keinen eigenen Commit) und steht als
Abschnitt 1 im Backlog. **Kevin schaltet live, niemand sonst.**

Zur Migrations-Historie: `0001–0066` sind seit dem 06.08. lückenlos als angewendet
verbucht (Backlog L2). **Regel daraus:** Migrationen ausschließlich über `db push`,
nie im SQL-Editor — genau das hatte die Historie zerlegt.

---

## Was existiert

### Ein Repo, drei Teile

| Teil | Pfad | Inhalt |
|---|---|---|
| **Frontend** | `app/` | React 19, TypeScript, Vite, React Router 7, Tailwind, Supabase-Client, Zustand, framer-motion, react-markdown + remark-gfm, Tiptap, dnd-kit. Graph via **d3-force auf Canvas-2D**. **Kein Three.js** (Phase 6 abgerissen). |
| **Backend** | `supabase/` | Migrationen `0001`–`0066`, 15 Edge Functions, `config.toml` (JWT je Function). |
| **Runner** | `runner/` | Zero-Dependency Node-Server auf `127.0.0.1:4711`, spawnt Vault-Agenten, spiegelt nach Supabase. |

### Cockpit-Shell (`app/src/cockpit/**`)

`/` redirected auf `/cockpit`. Keine Modus-Navigation mehr.

| Route | Bereich | Seite |
|---|---|---|
| `/cockpit` | Home: Heute-Deck, Vitals, OS-Graph, Agenten, Ziel | `CockpitHome.tsx` |
| `/aufgaben` `/termine` `/freigaben` | „Heute" (Sub-Tabs `HeuteTabs`) | `AufgabenArea` · `TermineArea` · `FreigabenArea` |
| `/linkedin` | LinkedIn-Postfach: Buckets, Sterne, Entwürfe | `LinkedinArea.tsx` |
| `/sales` | Kachel-Dashboard „Jetzt dran" + Arbeitsmodus | `SalesDashboard.tsx` |
| `/sales/pipeline` `lists` `call-mode` `new` `:contactId` | Altes CRM, in der Shell | `pages/sales/*` (Glass-Ära) |
| `/sales/bibliothek` | Skripte, Vorlagen, PDFs | `SalesBibliothek.tsx` |
| `/projekte` | Deliver / Kundenprojekte + Posteingang | `ProjekteArea.tsx`, `ProjectPage.tsx` |
| `/ads` | Ads-Review über alle Kunden | `AdsArea.tsx` |
| `/content` | Wochen-Batches + Post-Ebene | `SocialArea.tsx` |
| `/agenten` | Agenten-Hub, Run-Drawer | `AgentsArea.tsx` |
| `/tracking` | Tages-KPIs, Wochen-/Monatskurve, Kanal-Raten | `TrackingArea.tsx` |

**Navigation** (`NavRail.tsx`): vorne die Warteschlange — Cockpit · Heute · Sales ·
Projekte; hinten das Nachschlagewerk — Ads · Content · Agenten · Tracking. Mobil
sind es 5 Tabs (letzter = „Mehr"-Sheet). `/crm/*` redirected auf `/sales/*`,
`/brand/:slug/*` auf das Cockpit.

**Uriel selbst:** `UrielDock.tsx` + `UrielAura.tsx` — Chat mit Werkzeugen
(`lib/urielTools.ts`: navigieren, Graph steuern, CRM/KPIs lesen, `remember`),
Antwortmotor = Edge Function `uriel`. **Stimme:** ElevenLabs über `uriel-voice`;
**Push-to-talk** über Web Speech (`lib/useUrielVoice.ts`) — funktioniert in Chrome,
nicht in Safari/iOS (Backlog O12).

**Kernlogik, die man kennen muss, bevor man etwas anfasst:**
- `lib/prioritaet.ts` — die eine Rangfolge (`ordnePosten`). Feste Liste, kein Scoring.
- `hooks/usePosten.ts` — verdrahtet alle Quellen. Heute-Deck und Sales-Dashboard
  benutzen **denselben** Hook; keine zweite Fälligkeitslogik bauen.
- `lib/arbeitsmodusTracking.ts` — Abhaken zählt **genau ein** `daily_metrics`-Feld
  und misst die Dauer (`arbeits_dauern`). Keine neuen Metrikfelder.
- `lib/linkedinFollowups.ts` — Buckets und `markDonePatch`. Geprüft per
  `scripts/verify-linkedin-followups.ts`.
- `lib/runnerBridge.ts` — **nie direkt auf `127.0.0.1`**. Lokal Runner, sonst Spiegel.

### Legacy, noch gemountet

Kundenportal (`/portal/...`), Booking (`/book/...`), Lead-Intake (`/leads/...`),
Login/Reset/Onboarding. Die Sales-Altwelt lebt als Sub-Tabs unter `/sales`
(`SalesMode.tsx`, 2.504 Zeilen, noch Glass — Backlog O14). Die Brand-Welt und
Deliver-Altwelt sind in Etappe 4 abgerissen.

### Runner (`runner/index.mjs`)

Bindet ausschließlich `127.0.0.1:4711`. Autostart via launchd (`de.uriel.runner`,
`scripts/install-runner-autostart.sh`). Nach jeder **Code**-Änderung am Runner:

```bash
launchctl kickstart -k gui/$(id -u)/de.uriel.runner
```

Skill-Änderungen brauchen das nicht (`claude -p` liest `SKILL.md` frisch).

- **Endpoints:** `/status` `/run` `/runs` `/runs/:id` `/agents` `/vault/recent`
  `/vault/graph` `/os/map` `/os/file` `/calendar` `/ads/{overview,manifest,customers}`
  `/content/manifest` `/social/weeks` `/sales/library` `/linkedin/sync`
  `/files/{kunden,social,sales}/…`
- **Agenten:** `weekly-content` · `wochenrecap` · `morgenbrief` · `followup-entwuerfe` ·
  `linkedin-followup-entwuerfe` · `linkedin-antwort-entwuerfe` · `lead-research` ·
  `dream-check` · `loom-skript` · `followup-pdf`. Skills liegen im **Vault**
  (`~/Second Brain/.claude/skills/`), nicht in diesem Repo.
- **Zeit-Routinen:** `dream-check` (1×/Tag), `morgenbrief` (erster Werktags-Lauf),
  Antwort-Entwürfe (werktags ab 6:00). Alle laufen **nur, wenn der Mac wach ist** —
  das ist der Grund für den Selbstwecker (`pmset`) und den Heimserver-Plan.
- **Spiegel nach Supabase** (`runner_snapshots`, damit das Handy etwas sieht):
  `runs` · `files_index` · `calendar` · `agents` · `ads_overview` · `social_weeks` ·
  `sales_library` · `erstnachrichten_meta`. Aufträge vom Handy laufen über
  `runner_jobs` (Migration 0059), **nicht** über `System/Queue` — der Ordner ist nur
  noch Debug-Protokoll.
- **`runner/.env`** braucht `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (sonst fallen
  Graph, Heartbeat und alle Spiegel still aus) und `CALENDAR_ICAL_URL`.

### Datenbank (Auszug, Stand 06.08. live geprüft)

`daily_metrics` (Tracking, kanalgetrennt) · `linkedin_threads` (160 Zeilen, mit
`verlauf`, `entwurf`, `loom_status`, `starred`) · `linkedin_erstnachrichten` (91) ·
`contacts` (44) · `arbeits_dauern` · `month_goals` · `runner_jobs` ·
`runner_snapshots` · `os_map_snapshot` · `social_batches` (4) · `site_content` (0) ·
`deliver_projects` / `project_messages` · `foundation_tasks` · `chat_threads`.
Buckets: `project-files`, `site-assets`, `runner-files`.

### Edge Functions

`brand-assistant` · `discovery-agent` · `discovery-feed-refresh` ·
`foundation-ai` · `icp-swarm` · `invite-client` · `lead-intake` · `marketing-ai` ·
`process-sequences` · `send-email` · `track-click` · `track-open` · **`uriel`** ·
**`uriel-voice`**.

`email-inbound` ist am 06.08. **gestrichen** worden (Backlog L5b) — über den
Lead-Eingang `leads+slug@…` kam nachweislich nie etwas an. `discovery-agent` und
`discovery-feed-refresh` sind undeployt und bleiben es; ihre UI ist gelöscht.

---

## Build & Deploy

```bash
cd app && npx tsc -b && npm run build     # muss grün sein
```

- `npm run cockpit` — nur App · `npm run cockpit:full` — App + Runner · `npm run runner`
- **Deploy:** Netlify (`netlify.toml`: base `app`, publish `dist`, Node 22,
  SPA-Redirect). Env in der Netlify-UI: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
  Welcher Branch als Production eingestellt ist, steht **nicht** in `netlify.toml` —
  vor dem Livegang einmal in der UI nachsehen.
- **Release-Weg:** Arbeitsbranch `cockpit-rebuild` → Fast-Forward-Push auf `main`.
- **Migrationen:** nur noch `supabase db push` — **nicht** im SQL-Editor (das ist die
  Ursache des heutigen Historie-Desyncs, Backlog L2).

---

## Fallen, die schon Zeit gekostet haben

1. **`#app-ui-overlay` setzt global `pointer-events: none`** — jedes Vollbild-UI
   außerhalb der CockpitShell braucht explizit `pointerEvents: 'auto'`.
2. **`h-svh`-Falle:** mobil bei **390×664** prüfen, nicht im schmalen Desktop-Fenster.
   Sonst klemmt der Inhalt hinter der Nav.
3. **Eine Mobil-Grenze, und zwar 900:** `MOBILE_MAX_WIDTH` in `hooks/useViewport.ts`,
   importiert von NavRail und CockpitHome, gespiegelt in den `@media`-Blöcken von
   `cockpit.css`. Nicht abtippen — `scripts/verify-breakpoint.ts` schlägt sonst an.
   Das Kundenportal (`pages/portal/portal.css`) hat bewusst seine eigene bei 768.
4. **Slide-/Post-Vorschauen immer per `src`, nie `srcDoc`** — sonst brechen die
   relativen Pfade zu `slides.css`.
5. **Hooks-Order-Warnungen direkt nach einem Edit** sind HMR-Artefakte — erst nach
   vollem Reload bewerten.
6. **Uncommittete Arbeit im Working Tree** war bei diesem Repo lange der Normalfall:
   jede Datei vor dem Edit frisch lesen, nie `git checkout`/`stash` darüber. (Stand
   06.08. abends ist der Tree sauber — das ist die Ausnahme, nicht die Regel.)
7. **`ANTHROPIC_API_KEY` in den Supabase-Edge-Secrets** war am 07.07. ungültig (401).
   Bei KI-Fehlern zuerst dort nachsehen (Backlog L6).

---

## Nicht anfassen (bewusste Ausnahmen aus dem Rebrand)

| Stelle | Warum |
|---|---|
| localStorage-Namespace `brand-os` | Rename verwirft Theme, Layout, Notifications aller Nutzer |
| ~~`frameworkos.de` im Lead-Regex~~ | **Seit 06.08. gegenstandslos** (L5b): `email-inbound` und `ContactBccHint` sind gestrichen. In `send-email` bleibt die Domain als `PUBLIC_APP_URL` — das ist ein Umzug, kein Lead-Risiko. |
| CORS-Origins `frameworkos.de` im Runner | Die Live-Site heißt weiter so |
| Supabase-Ref, Edge-Function-Namen, Netlify-siteId | Interne Identifier, Bruchrisiko ohne Nutzen |
| Ablage-Wurzel `~/Kevin OS/` | Runner-Hardcodes, fünf Skills und CLAUDE.md hängen daran. Ablage ≠ Produkt |

Details: [`docs/wargames/rebrand-uriel.md`](docs/wargames/rebrand-uriel.md).

---

## Ordnerstruktur

```
uriel/
├── app/                    # Vite SPA
│   └── src/
│       ├── cockpit/        # Shell, Bereiche, Uriel, Graph, lib/, components/
│       ├── components/     # Legacy Sales/Portal/Deliver + shared
│       ├── hooks/  lib/  pages/  styles/  types/
│       └── App.tsx  main.tsx
├── runner/                 # index.mjs + linkedin/ (Voyager-Sync)
├── scripts/                # install-runner-autostart.sh + verify-*.ts
├── docs/                   # BACKLOG.md (Wahrheit) · rebuild-notes · wargames/ · data-model
├── supabase/               # migrations/ 0001–0066 · functions/
├── netlify.toml
└── HANDOFF.md              # diese Datei
```

---

*Bei Zweifeln schlagen `docs/BACKLOG.md`, der Code und `git log` dieses Dokument.*
