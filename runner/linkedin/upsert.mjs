/**
 * runner/linkedin/upsert.mjs — Wargame Zug 5 (docs/wargames/linkedin-followups.md)
 *
 * Schreibt das Ergebnis von sync.mjs nach Supabase (service_role, umgeht RLS).
 *
 * `followup_stage`, `snoozed_until`, `status` und `first_seen_at` sind Kevins
 * Steuerung und werden hier NIE geschrieben — die Spalten fehlen bewusst im
 * Payload, PostgREST fasst bei merge-duplicates nur die mitgeschickten Spalten an.
 *
 * `status` stand hier früher drin (Übergänge active ↔ waiting_reply). Das ist
 * entfallen: die Buckets in linkedinFollowups.ts entscheiden ohnehin über
 * `last_from`, und ein aus dem SELECT-Snapshot zurückgeschriebener Status hätte
 * eine parallele Änderung Kevins (won/lost/archived) überschrieben.
 */
import { readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { pathToFileURL } from 'node:url'

// ---------- Lokale .env (runner/.env, ein Verzeichnis über diesem Modul) ----------
function loadLocalEnv() {
  try {
    const raw = readFileSync(new URL('../.env', import.meta.url), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
      if (!m) continue
      const key = m[1]
      if (process.env[key] != null) continue
      let val = m[2].trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      process.env[key] = val
    }
  } catch {
    /* keine .env → Aufruf schlägt unten mit klarer Meldung fehl */
  }
}
loadLocalEnv()

const SUPABASE_URL = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '')
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const BRAND_SLUG = process.env.LINKEDIN_BRAND_SLUG ?? 'herrmann'

function authHeaders() {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  }
}

function normalizeLinkedinUrl(u) {
  return String(u ?? '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '')
}

function normalizeName(n) {
  return String(n ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Ein kaputter Zeitstempel darf nicht den ganzen Lauf mit RangeError killen. */
function toIsoOrNull(v) {
  if (v == null) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

async function fetchAll(pathAndQuery) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, { headers: authHeaders() })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`GET ${pathAndQuery} HTTP ${res.status}: ${txt.slice(0, 200)}`)
  }
  return res.json()
}

async function resolveBrandId() {
  const rows = await fetchAll(`brands?slug=eq.${encodeURIComponent(BRAND_SLUG)}&select=id&limit=1`)
  if (!rows[0]?.id) throw new Error(`Kein Brand mit slug="${BRAND_SLUG}" gefunden`)
  return rows[0].id
}

/**
 * Schreibt Threads nach linkedin_threads. Wirft bei fehlendem Service-Role-Key
 * und bei > 30 % geänderten Kontakt-Zuordnungen (Schutz gegen DOM-/API-Umbau,
 * der plötzlich Müll liefert).
 */
export async function upsertThreads(threads, { dryRun = false } = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('ABBRUCH: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY fehlt in runner/.env')
  }

  const brandId = await resolveBrandId()
  const [contacts, existing] = await Promise.all([
    fetchAll(`contacts?brand_id=eq.${brandId}&select=id,name,linkedin`),
    fetchAll(`linkedin_threads?brand_id=eq.${brandId}&select=thread_key,contact_id,status`),
  ])

  const existingByKey = new Map(existing.map((r) => [r.thread_key, r]))

  const byLinkedin = new Map()
  const byName = new Map()
  for (const c of contacts) {
    const url = normalizeLinkedinUrl(c.linkedin)
    if (url) byLinkedin.set(url, c.id)
    const name = normalizeName(c.name)
    if (!name) continue
    if (!byName.has(name)) byName.set(name, [])
    byName.get(name).push(c.id)
  }

  function matchContact(thread) {
    const byUrl = byLinkedin.get(normalizeLinkedinUrl(thread.profile_url))
    if (byUrl) return byUrl
    const candidates = byName.get(normalizeName(thread.name))
    if (candidates && candidates.length === 1) return candidates[0]
    return null
  }

  let inserted = 0
  let updated = 0
  let unmatched = 0
  let contactChanges = 0
  const now = new Date().toISOString()
  const rows = []

  for (const t of threads) {
    const contactId = matchContact(t)
    if (!contactId) unmatched++

    const prior = existingByKey.get(t.thread_key)
    if (prior) {
      updated++
      // Nur echte Umhängungen zählen. Eine erstmalige Zuordnung (null → id) ist
      // erwünscht und darf den Schutzschalter unten nicht auslösen.
      if (prior.contact_id && prior.contact_id !== contactId) contactChanges++
    } else {
      inserted++
    }

    rows.push({
      brand_id: brandId,
      thread_key: t.thread_key,
      contact_id: contactId,
      name: t.name,
      company: t.company,
      profile_url: t.profile_url,
      preview: t.preview,
      last_message_at: toIsoOrNull(t.last_message_at),
      last_from: t.last_from,
      unread: t.unread,
      starred: t.starred,
      last_synced_at: now,
    })
  }

  // Nenner ist bewusst `updated` (die in DIESEM Lauf wiedergefundenen Zeilen),
  // nicht die Gesamtzahl der Tabelle: sonst verwässert der Schutzschalter, sobald
  // die Tabelle über die ~20 gesyncten Threads hinauswächst, und schweigt
  // irgendwann auch bei einem zu 100 % kaputten Lauf.
  if (updated > 0 && contactChanges / updated > 0.3) {
    throw new Error(
      `ABBRUCH: ${contactChanges}/${updated} bestehende Kontakt-Zuordnungen würden sich ändern (> 30 %). Nicht geschrieben — vermutlich fehlerhafte Sync-Daten.`,
    )
  }

  // Tripwire gegen einen Formatwechsel des thread_key: dann wären schlagartig
  // ALLE Threads „neu", die Tabelle verdoppelte sich lautlos und keiner der
  // Prozent-Guards oben würde anschlagen (sie messen nur bestehende Zeilen).
  if (existing.length > 0 && updated === 0 && inserted > 0) {
    throw new Error(
      `ABBRUCH: ${inserted} Threads, aber kein einziger trifft eine der ${existing.length} bestehenden Zeilen. Das thread_key-Format hat sich vermutlich geändert — nicht geschrieben.`,
    )
  }

  if (dryRun) {
    return { inserted, updated, unmatched, contactChanges, wouldWrite: rows.length, dryRun: true }
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/linkedin_threads?on_conflict=brand_id,thread_key`, {
    method: 'POST',
    headers: { ...authHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`ABBRUCH: Upsert HTTP ${res.status}: ${txt.slice(0, 300)}`)
  }

  return { inserted, updated, unmatched, contactChanges }
}

// CLI: `node runner/linkedin/upsert.mjs [--dry-run]` — synct live und schreibt (außer --dry-run).
if (process.argv[1] && import.meta.url === pathToFileURL(resolvePath(process.argv[1])).href) {
  const dryRun = process.argv.includes('--dry-run')
  const { syncThreads } = await import('./sync.mjs')
  syncThreads({})
    .then((s) => upsertThreads(s.threads, { dryRun }))
    .then((r) => console.log(JSON.stringify(r, null, 2)))
    .catch((e) => {
      console.error(e.message)
      process.exit(1)
    })
}
