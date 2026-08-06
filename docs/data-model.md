> **Gilt mit Einschränkungen:** drei Tabellen sind dokumentiert, aber nie migriert
> worden — sie tragen unten je einen Warnhinweis. Offene Punkte stehen in
> [`BACKLOG.md`](BACKLOG.md).

# Brand OS — Data Model

## Stack
- Database: Supabase (PostgreSQL)
- Auth: Supabase Auth
- Realtime: Supabase Realtime (für Live-Updates)
- Storage: Supabase Storage (nur für Uploads wie Logos)

---

## Core Tables

### brands
```sql
id            uuid PK
user_id       uuid FK (auth.users)
name          text
slug          text unique
color         text          -- hex, Modus-Akzentfarbe
created_at    timestamp
```

### foundation_icps
```sql
id            uuid PK
brand_id      uuid FK
name          text          -- "Urban Professional"
age_range     text          -- "28–42"
location      text
pain_points   text[]
word_clusters text[]        -- Referenz auf word_bank clusters
priority      int           -- 1=primary, 2=secondary, 3=tertiary
notes         text
```

### foundation_word_bank
```sql
id            uuid PK
brand_id      uuid FK
word          text
type          text          -- 'yes' | 'no'
cluster       text          -- Gruppenname z.B. "Ritual", "Qualität"
```

### foundation_positioning
```sql
id            uuid PK
brand_id      uuid FK
statement     text
tone_of_voice text
business_model jsonb        -- { who, what, how, for_whom, revenue }
updated_at    timestamp
```

### assets
```sql
id            uuid PK
brand_id      uuid FK
type          text          -- 'website' | 'instagram' | 'linkedin' | 'document' | 'lead_magnet'
name          text
url           text
embed_url     text          -- für iframe embed
api_connected boolean
api_config    jsonb         -- { platform, token, account_id }
created_at    timestamp
```

### sops
```sql
id            uuid PK
brand_id      uuid FK
title         text
content       text          -- Tiptap JSON
category      text          -- 'workflow' | 'template' | 'process'
```

---

## Promo Tables

### content_pieces
```sql
id            uuid PK
brand_id      uuid FK
title         text
body          text          -- Tiptap JSON
status        text          -- 'draft' | 'scheduled' | 'live' | 'archived'
format        text          -- 'post' | 'reel' | 'story' | 'email' | 'article' | 'ad'
channel       text          -- 'instagram' | 'linkedin' | 'email' | 'website'
goal          text          -- 'awareness' | 'lead' | 'sale' | 'nurture'
scheduled_at  timestamp
published_at  timestamp
campaign_id   uuid FK nullable

-- Tags (Intelligence-Grundlage, KRITISCH)
icp_ids       uuid[]        -- Welche ICPs angesprochen
word_clusters text[]        -- Welche Word-Bank-Cluster dominant
```

### content_performance
> ⚠️ **Geplant, nicht migriert** (geprüft 2026-08-06). Keine Migration in `supabase/migrations/` erstellt diese Tabelle. Performance-Daten laufen über `promo_performance` sowie `daily_metrics` (Migration 0046/0049). Vor Nutzung Migration schreiben oder Doku streichen.
```sql
id            uuid PK
content_id    uuid FK
source        text          -- 'manual' | 'instagram_api' | 'linkedin_api' | 'meta_api'
impressions   int
reach         int
clicks        int
saves         int
leads         int
conversions   int
revenue       numeric
notes         text
recorded_at   timestamp
```

### campaigns
```sql
id            uuid PK
brand_id      uuid FK
name          text
goal          text
start_date    date
end_date      date
status        text          -- 'planning' | 'active' | 'done'
```

---

## Sales Tables

### contacts (App / Supabase)
```sql
id                      uuid PK
brand_id                uuid FK brands
name, email             text
phone, website          text
instagram, linkedin     text
company                 text
source_content_piece_id uuid FK nullable
source_campaign_id      uuid FK nullable
source_funnel_id        uuid FK funnels nullable  -- Migration 0032
lead_quality            text default 'unqualified'  -- unqualified | good | bad
lead_value              numeric(10,2) nullable     -- geschätzter Deal-Wert EUR
pipeline_stage          text  -- first_contact | conversation | follow_up | proposal | deal | paused (follow_up: Migration 0047)
last_contact_at         timestamptz nullable
next_follow_up_at       timestamptz nullable
notes                   text
activity_log            jsonb  -- [{ id, text, at }]
updated_at              timestamptz
```

### deliver_projects (Deliver Modus)
```sql
id                   uuid PK
owner_brand_id       uuid FK brands
name                 text
client_name          text
client_contact_id    uuid FK contacts nullable
status               text  -- active | completed
internal_stage       text  -- onboarding … execute
client_stage         text
internal_notes_doc   jsonb  -- Tiptap
internal_file_links  text[]
team_notes           text
client_welcome_text  text
client_documents     jsonb  -- [{ label, url, description? }]
internal_notes       text   -- Legacy-Spalte aus 0008
client_area_notes    text   -- Legacy
updated_at           timestamptz
```
Migration `0010_deliver_projects.sql` ergänzt die erweiterten Spalten; UI sync über `useDeliverProjects`.

`client_documents` (JSONB): Array von `{ label, url, description? }` für das Kundenportal.

### activity_entries (Sales CRM Timeline, Migration 0040 + 0041)
```sql
id              uuid PK
brand_id        uuid FK brands
contact_id      uuid FK contacts
activity_type   text   -- presetting | setting | closing | … | notiz | call
performed_by    uuid FK auth.users nullable
data            jsonb  -- typ-spezifisch
created_at      timestamptz
```

**`activity_type = 'call'`** (Call Sequencer, Migration 0041):
```json
{
  "outcome": "not_reached | voicemail | no_interest | later | follow_up | meeting | direct_yes",
  "note": "optional",
  "next_action": {
    "type": "call | brief_task | task | reminder | blocklist",
    "due_at": "ISO-8601 optional",
    "title": "optional",
    "pipeline_stage": "first_contact | conversation | proposal | deal | paused",
    "open_calendar": false,
    "include_brief": false
  }
}
```

Firma und Person sind beide Zeilen in `contacts` (`contact_type`, `parent_company_id`, Migration 0036).

### foundation_tasks — `source: brief_task` (Migration 0042)
Zusätzlicher Task-Typ für Brief-Vorbereitung (Call Sequencer). UI: Briefumschlag-Icon + JSON-Export für DirectMailing.ai (`name`, `company`, `website`, `address`).

### user_roles (Auth / Rollen)
```sql
user_id      uuid PK FK auth.users
role         text  -- 'owner' | 'client'
client_slug  text FK brands.slug nullable  -- optional Reporting / Deep-Link
project_id   uuid FK deliver_projects.id nullable  -- für role=client: exakt ein sichtbares Projekt
```

Migration **`0012_client_access.sql`**: `project_id`, RLS `deliver_projects_client_read_own`, `brands_client_read_via_project`.

---

## Intelligence Tables

### intelligence_patterns
> ⚠️ **Geplant, nicht migriert** (geprüft 2026-08-06). Keine Migration erstellt diese Tabelle; das Intelligence-Modul wurde beim Cockpit-Rebuild (Phase 6) entfernt. Nur als Vision behalten oder streichen.
```sql
id            uuid PK
brand_id      uuid FK
type          text          -- 'content_format' | 'icp_drift' | 'channel_strength' | 'pipeline_block'
insight       text          -- Lesbare Zusammenfassung
data          jsonb         -- Rohdaten die zum Schluss geführt haben
confidence    float         -- 0–1
suggested_action text
status        text          -- 'new' | 'accepted' | 'rejected' | 'deferred'
created_at    timestamp
```

### focus_tasks
> ⚠️ **Geplant, nicht migriert** (geprüft 2026-08-06). Keine Migration erstellt diese Tabelle. Task-Haltung läuft real über `foundation_tasks` (inkl. `source: brief_task`, Migration 0042). `CURRENT_FOCUS` im Context-Export unten wird derzeit nicht befüllt.
```sql
id            uuid PK
brand_id      uuid FK
text          text
reason        text
impact        text          -- 'high' | 'medium' | 'low'
mode          text          -- 'building' | 'promo' | 'sales' | 'intelligence'
target_id     uuid nullable -- ID des betroffenen Objekts
target_type   text nullable -- 'icp' | 'content' | 'contact' | 'asset'
completed_at  timestamp nullable
deferred_at   timestamp nullable
created_at    timestamp
```

### swarm_predictions (Migration 0033)
```sql
id              uuid PK
brand_id        uuid FK brands
mode            text          -- 'content' | 'funnel'
subject_ref     text          -- content-hash oder funnel_id:graph-hash
funnel_id       uuid FK funnels nullable
prediction      jsonb         -- ICP-Schwarm JSON
actual_outcome  jsonb         -- Ist-Werte nach Kalibrierung
created_at      timestamptz
```

### assistant_conversations (Migration 0034)
```sql
id          uuid PK
brand_id    uuid FK brands (unique pro Brand)
messages    jsonb   -- [{ role, content, createdAt }]
updated_at  timestamptz
```

---

## Context Export (generiert, nicht gespeichert)
Wird on-demand aus den Foundation-Tabellen zusammengebaut.
Format: strukturiertes Markdown.

```
BRAND: {name}
POSITIONING: {statement}
TONE: {tone_of_voice}
BUSINESS_MODEL: {business_model.summary}
ICP_PRIMARY: {icp[0].name} · {icp[0].age_range} · {icp[0].location}
ICP_PRIMARY_PAIN: {icp[0].pain_points.join(', ')}
ICP_SECONDARY: {icp[1].name} ...
WORD_BANK_YES: {word_bank.filter(yes).map(w => w.word).join(' · ')}
WORD_BANK_NO: {word_bank.filter(no).map(w => w.word).join(' · ')}
ACTIVE_CHANNELS: {assets.filter(api_connected).map(a => a.type).join(', ')}
CURRENT_FOCUS: {focus_tasks.filter(high_impact).map(t => t.text).join(' · ')}
```
