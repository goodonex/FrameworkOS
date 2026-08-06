> ⚠️ **HISTORISCH (Mai/Juni 2026, „Brand OS“).** Die Fragen betreffen die
> Three.js-Welt und die Denk-Modi, die im Rebuild Phase 6 gelöscht wurden.
> Was davon heute noch offen ist (Role Guards, RLS-Policy-Review), steht in
> [`BACKLOG.md`](BACKLOG.md); alles andere ist gegenstandslos.

# Brand OS — Offene Produkt-/Tech-Fragen

## 3D-Hintergrund / Canvas

- Auf allen Routen außer `/` hat das R3F-Canvas `pointer-events: none` — UI-Overlay hat Vorrang; Universe (`/`) bleibt klickbar für Brand-Tunnel.
- Ambient-Nodes (unten rechts) skalieren mit Viewport-Breite, Obergrenze ca. 20 % — Feintuning nach Feedback möglich.

## TypeScript / Build

- `tsc -b` und `npm run build` (App) sind aktuell fehlerfrei; es gibt keine gemeldeten offenen TS-Fehler in dieser Liste.

## Supabase Migrationen (manuell im Dashboard ausführen)

Im Supabase SQL Editor **der Reihe nach** ausführen:

| Datei | Tabellen / Änderungen |
|-------|------------------------|
| `0001_brands.sql` | `brands` |
| `0002_foundation.sql` | `foundation_icps`, `foundation_word_bank`, `foundation_positioning` |
| `0003_promo.sql` | `campaigns`, `content_pieces` |
| `0004_sales.sql` | `contacts` |
| `0005_building.sql` | `assets`, `sops`, `foundation_business_models` |
| `0006_discovery.sql` | `discovery_foundation`, `discovery_feed_items`, `discovery_settings` |
| `0007_auth.sql` | `user_roles` (Rollen `owner` / `client`, optional `client_slug` → `brands.slug`) |
| `0008_deliver.sql` | `deliver_projects` |
| `0009_rls.sql` | Row Level Security für alle App-Tabellen inkl. `deliver_projects` |
| `0010_deliver_projects.sql` | `deliver_projects`: Stages, Tiptap-Doc, Dateilinks, Kundeninhalt |
| `0011_contacts_extended.sql` | `contacts`: Profilfelder + `activity_log` |
| `0012_client_access.sql` | `user_roles.project_id`; RLS Client lesen eigenes `deliver_projects` + Brand |
| `0013_discovery_agent.sql` | `discovery_foundation.analysis_status`, `discovery_feed_items.archived_at` (Agent + Feed-Archiv) |

**Reihenfolge:** `0001` … `0008`, **`0010_deliver_projects.sql`**, **`0011_contacts_extended.sql`**, **`0012_client_access.sql`**, **`0013_discovery_agent.sql`**, danach **`0009_rls.sql`** ergänzen/aktualisieren (oder `0009` vor `0012` wenn Policies idempotent per `drop policy if exists` — empfohlen: **`0012` nach `0009` ausführen**, da neue Policies auf bestehendem RLS aufsetzen).

**Hinweis:** Nach `0012` / `0013` existieren zusätzliche Tabellen-Spalten; bei bestehendem `0009` die neuen Migrationen im SQL Editor ausführen.

Offen nach Umstellung auf Auth/RLS:

- Client-Einladung: Edge Function `invite-client` (Placeholder im Repo) — `admin.createUser` + Zeile in `user_roles`.
- `user_roles.client_slug` vs. spätere Zuordnung Brand↔Client (weiterhin optional).

### Sales / Pipeline

- Server-Kontakte mit leeren Namen/Feldern werden beim Merge mit **localStorage** angereichert (Demo-Daten bleiben sichtbar, bis echte Daten in Supabase gepflegt sind).
- **Schnell-Deal** (Drawer): Name, **Telefon** und **E-Mail** (getrennt), erste Notiz → Kontakt in **Erstkontakt** + Sprung zur Vollmaske.

## Deliver / Projektliste

- `DeliverMode`: leerer State mit zentralem CTA; bei Daten **2-Spalten-Grid** mit Glass-Cards; neues Projekt per **Drawer** (Name, Kontakt-Dropdown, Status).

## Kundenportal (`/portal/:projectId`)

- **Produktion:** Nur **`role = client`** mit gesetztem **`user_roles.project_id`** (UUID des Deliver-Projekts). Daten aus **Supabase** (`deliver_projects`); RLS siehe `0012_client_access.sql`. Nach Login Redirect `/portal/{project_id}`.
- **Owner** wird vom Portal ausgeschlossen (Redirect `/`) — Vorschau nur mit **`?preview=true`** (localStorage-Scan, Entwicklung).
- UI: eigenes Layout (`--bg-base`), Fortschritt in **Teal**, Willkommen (`client_welcome_text`), **Dein Projektstatus** (Timeline), **Dokumente &amp; Links** (optional `description`). Kein `team_notes`-Block mehr im Portal.
- **Portal-Link:** `ProjectPage` kopiert `origin/portal/{id}`; Toast-Bestätigung.

## Context Export (`buildContextMarkdown`)

- Enthält optional **`SALES_SNAPSHOT`** (Kontakte gesamt, Anzahl pro Pipeline-Stage, überfällige Follow-ups) und **`DELIVER_SNAPSHOT`** (aktive Projekte, Stages-Verteilung, jüngstes Projekt inkl. Stage) wenn Daten aus `useContacts` / `useDeliverProjects` übergeben werden (Building-Modus „Copy for Claude“).

## APIs Promo (Instagram Graph, LinkedIn Analytics)

Echte OAuth-Flows und Token-Speicherung sind bewusst nicht Teil der aktuellen UI-Mocks. Offen:

- Wo liegen Refresh Tokens (Supabase Vault vs. Edge Function Secrets)?
- Welche Konten pro Brand (Business Manager / Org Pages)?
- Rate Limits und Batch-Sync-Intervalle?

## Mobile (&lt; 768px) — Basis

- `AppHeader`: Brand-Switcher in **horizontal scroll** (`flex-1` + `overflow-x-auto`), Buttons `w-max` / `nowrap`.
- `ModeNav`: **2 Spalten** bis `md`, dann 3 / 6.
- Sales-**Pipeline**: Spaltenbreite `min(200px, 100vw - 48px)`, Board mit Touch-Scroll / `overscroll-x-contain`.
- `App`-`main`: engere horizontale Padding-Klassen auf kleinen Screens.
- `Drawer`: Breite `min(380px, 100vw - 24px)` — keine Überlagerung am Rand.

## Discovery — Edge Functions & Secrets

Die Discovery-Pipeline **läuft erst produktiv**, wenn folgende Secrets im Supabase-Dashboard gesetzt sind: **Settings → Edge Functions → Secrets** (Projekt).

| Secret | Quelle | Verwendung |
|--------|--------|------------|
| `PERPLEXITY_API_KEY` | [perplexity.ai](https://www.perplexity.ai/) API | `discovery-agent` (Web-Research), `discovery-feed-refresh` (Signale) |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com/) | `discovery-agent` (JSON-Analyse / Claude) |
| `ANTHROPIC_MODEL` | optional | Standard im Code: `claude-sonnet-4-20250514` |
| `DISCOVERY_CRON_SECRET` | beliebig (z. B. UUID), nur für Cron | `discovery-feed-refresh`: Header `x-discovery-cron-secret` muss exakt matchen |

**Fehlende Keys:** Die Functions antworten mit **HTTP 500** und JSON `code: "MISSING_API_KEYS"` — die App zeigt eine konkrete Meldung mit Verweis auf diese Datei.

**Manueller Feed-Refresh (App):** `discovery-feed-refresh` mit User-JWT und Body `{ "brand_id": "<uuid>" }` (ohne Cron-Secret). Voraussetzung: `PERPLEXITY_API_KEY` gesetzt.

**Geplanter Refresh (7 Tage):** Supabase **Scheduled Functions** oder `pg_cron` + HTTP POST auf `discovery-feed-refresh` mit Header `x-discovery-cron-secret: <DISCOVERY_CRON_SECRET>`. Nach dem Lauf werden Feed-Einträge älter als **90 Tage** mit `archived_at` versehen (weiterhin in der DB, UI blendet sie aus).

## Discovery Cron (Supabase Edge Functions)

Scheduling, Retry und Benachrichtigung bei Feed-Fehlern — Cron-URL und Secret siehe Abschnitt **Discovery — Edge Functions & Secrets** oben.
