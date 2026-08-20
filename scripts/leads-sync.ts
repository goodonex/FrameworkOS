/**
 * Die Pflegeroutine des Lead-Systems (0076) — Backfill und laufender Abgleich
 * in einem Skript.
 *
 * **Warum kein Einmal-Backfill.** Ein Skript, das die Vergangenheit einsammelt
 * und danach nie wieder läuft, hinterlässt eine Datenbank, die ab dem zweiten
 * Tag wieder auseinanderläuft: neue Einladungen, neue Threads, neue
 * Erstnachrichten. Diese Routine ist deshalb **idempotent** — sie darf beliebig
 * oft laufen, legt nur an, was fehlt, und schreibt nur Ereignisse, die es noch
 * nicht gibt (Teil-Unique `(lead_id, typ, at)` in 0076 ist der Gürtel dazu).
 *
 * **Warum TypeScript und nicht .mjs wie der Rest des Runners.** Die
 * Identitäts-Regeln liegen in `app/src/cockpit/lib/leadIdentitaet.ts`, weil die
 * Oberfläche sie fürs Handverbinden ebenfalls braucht. Eine zweite Fassung in
 * .mjs wäre eine zweite Wahrheit — genau das, was dieses Repo an anderer Stelle
 * schon teuer bezahlt hat. Also läuft die Routine über `tsx`.
 *
 * Start:
 *   npx tsx --env-file=runner/.env scripts/leads-sync.ts [--dry-run]
 */
import {
  baueIndex,
  findeLead,
  istOpakeId,
  normName,
  urlKern,
  type LeadKandidat,
} from '../app/src/cockpit/lib/leadIdentitaet'
import { verlaufVon } from '../app/src/cockpit/lib/linkedinVerlauf'

const SUPABASE_URL = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '')
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const BRAND_SLUG = process.env.LINKEDIN_BRAND_SLUG ?? 'herrmann'
const DRY = process.argv.includes('--dry-run')

if (!SUPABASE_URL || !KEY) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY fehlen — mit --env-file=runner/.env starten.')
  process.exit(1)
}

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

/**
 * PostgREST deckelt still bei 1000 Zeilen — `linkedin_netzwerk` hat 1686.
 * Ad-hoc-Abfragen ohne Blättern haben hier schon einmal 278 statt 498 gemeldet
 * (17.08.). Deshalb blättert jede Leseoperation, ausnahmslos.
 */
async function alle<T = Record<string, unknown>>(pfad: string): Promise<T[]> {
  const out: T[] = []
  let from = 0
  for (;;) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${pfad}`, {
      headers: { ...H, Range: `${from}-${from + 999}` },
    })
    if (!res.ok) throw new Error(`GET ${pfad} HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`)
    const zeilen = (await res.json()) as T[]
    out.push(...zeilen)
    if (zeilen.length < 1000) break
    from += 1000
  }
  return out
}

async function schreibe(pfad: string, koerper: unknown[], prefer: string) {
  if (!koerper.length) return
  for (let i = 0; i < koerper.length; i += 200) {
    const teil = koerper.slice(i, i + 200)
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${pfad}`, {
      method: 'POST',
      headers: { ...H, Prefer: prefer },
      body: JSON.stringify(teil),
    })
    if (!res.ok) throw new Error(`POST ${pfad} HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`)
  }
}

async function patch(pfad: string, koerper: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pfad}`, {
    method: 'PATCH',
    headers: { ...H, Prefer: 'return=minimal' },
    body: JSON.stringify(koerper),
  })
  if (!res.ok) throw new Error(`PATCH ${pfad} HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`)
}

interface NetzZeile {
  id: string
  name: string
  profil_key: string
  profile_url: string
  status: 'offen' | 'angenommen'
  headline: string
  eingeladen_at: string | null
  angenommen_at: string | null
  lead_id: string | null
}
interface ThreadZeile {
  id: string
  name: string
  company: string
  profile_url: string
  last_from: string
  last_message_at: string | null
  first_seen_at: string
  starred: boolean
  loom_status: string | null
  loom_erledigt_at: string | null
  followup_stage: number
  /** JSONB aus 0064 — nie direkt lesen, immer über `verlaufVon()`. */
  verlauf: unknown
  lead_id: string | null
}
interface ErstZeile {
  id: string
  name: string
  firma: string
  status: 'offen' | 'gesendet' | 'uebersprungen'
  sent_at: string | null
  lead_id: string | null
}

const brands = await alle<{ id: string }>(`brands?slug=eq.${encodeURIComponent(BRAND_SLUG)}&select=id&limit=1`)
const bid = brands[0]?.id
if (!bid) throw new Error(`Kein Brand mit slug="${BRAND_SLUG}"`)

const [netz, threads, erst, bestand] = await Promise.all([
  alle<NetzZeile>(
    `linkedin_netzwerk?brand_id=eq.${bid}&select=id,name,profil_key,profile_url,status,headline,eingeladen_at,angenommen_at,lead_id&order=id`,
  ),
  alle<ThreadZeile>(
    `linkedin_threads?brand_id=eq.${bid}&select=id,name,company,profile_url,last_from,last_message_at,first_seen_at,starred,loom_status,loom_erledigt_at,followup_stage,verlauf,lead_id&order=id`,
  ),
  alle<ErstZeile>(`linkedin_erstnachrichten?brand_id=eq.${bid}&select=id,name,firma,status,sent_at,lead_id&order=id`),
  alle<LeadKandidat>(`leads?brand_id=eq.${bid}&select=id,name,profil_key,li_urn&order=id`),
])

console.log(
  `Gelesen: ${netz.length} Netzwerk · ${threads.length} Threads · ${erst.length} Erstnachrichten · ${bestand.length} Leads im Bestand`,
)

/* ── Runde 1: Leads aus dem Netzwerk ───────────────────────────────────────
 * Das Netzwerk ist die verlässlichste Quelle: `profil_key` ist eindeutig
 * (an Prod geprüft: 0 Dubletten unter 1686 Zeilen) und trägt ein Einladungs-
 * datum. Wer hier steht, bekommt einen Lead. */

const leads: LeadKandidat[] = [...bestand]
let index = baueIndex(leads)
const neueLeads: Record<string, unknown>[] = []
const vorgemerkt = new Map<string, string>() // profil_key -> temporäre Kennung

for (const n of netz) {
  const treffer = findeLead(index, { name: n.name, profilKey: n.profil_key, profileUrl: n.profile_url })
  if (treffer.leadId) continue
  if (vorgemerkt.has(n.profil_key)) continue
  vorgemerkt.set(n.profil_key, n.profil_key)
  // `li_urn` steht hier bewusst mit drin, obwohl es leer ist: PostgREST
  // verlangt bei einem Sammel-Insert, dass ALLE Objekte dieselben Schlüssel
  // tragen (PGRST102 „All object keys must match"), und die Postfach-Leads
  // weiter unten bringen eine gefüllte `li_urn` mit.
  neueLeads.push({
    brand_id: bid,
    profil_key: n.profil_key,
    li_urn: '',
    profile_url: n.profile_url,
    name: n.name,
    headline: n.headline ?? '',
    first_seen_at: n.eingeladen_at ?? new Date().toISOString(),
  })
}
console.log(`Neue Leads aus dem Netzwerk: ${neueLeads.length}`)

/* ── Runde 2: Leads nur aus dem Postfach ───────────────────────────────────
 * Wer Kevin von sich aus geschrieben hat, steht in keiner Einladungsliste.
 * Diese Leute bekommen einen Lead ohne `profil_key`. Ihre opake ID landet
 * direkt in `li_urn` — ab dann trifft die Identität ohne Namensraten. */

const nachNetzIndex = baueIndex([
  ...leads,
  ...neueLeads.map((l, i) => ({
    id: `neu-${i}`,
    name: String(l.name),
    profil_key: String(l.profil_key ?? ''),
    li_urn: '',
  })),
])
const nurPostfach: Record<string, unknown>[] = []
const gesehenUrn = new Set<string>()

for (const t of threads) {
  const treffer = findeLead(nachNetzIndex, { name: t.name, profileUrl: t.profile_url })
  if (treffer.leadId || treffer.grund === 'mehrdeutig') continue
  const kern = urlKern(t.profile_url)
  const urn = kern && istOpakeId(kern) ? kern : ''
  const schluessel = urn || `name:${normName(t.name)}`
  if (!schluessel || gesehenUrn.has(schluessel)) continue
  gesehenUrn.add(schluessel)
  nurPostfach.push({
    brand_id: bid,
    profil_key: '',
    li_urn: urn,
    profile_url: t.profile_url ?? '',
    name: t.name,
    headline: t.company ?? '',
    first_seen_at: t.first_seen_at,
  })
}
console.log(`Neue Leads nur aus dem Postfach: ${nurPostfach.length}`)

if (DRY) {
  console.log('\n--dry-run: nichts geschrieben. Beispiele:')
  console.log('  Netzwerk:', neueLeads.slice(0, 3).map((l) => l.name))
  console.log('  Postfach:', nurPostfach.slice(0, 3).map((l) => l.name))
  process.exit(0)
}

await schreibe('leads', [...neueLeads, ...nurPostfach], 'return=minimal')

/* Neu einlesen: jetzt haben alle ihre echten ids. */
const alleLeads = await alle<LeadKandidat>(`leads?brand_id=eq.${bid}&select=id,name,profil_key,li_urn&order=id`)
index = baueIndex(alleLeads)
console.log(`Leads gesamt nach dem Anlegen: ${alleLeads.length}`)

/* ── Runde 3: Spiegel verheiraten ──────────────────────────────────────────
 * Jede Spiegel-Zeile bekommt ihren `lead_id`. Der Sync fasst diese Spalte nie
 * an (PostgREST rührt bei merge-duplicates nur mitgeschickte Spalten an), die
 * Verbindung überlebt also jeden weiteren Lauf. */

let verheiratet = 0
let mehrdeutig = 0
const urnNachtrag: { id: string; li_urn: string }[] = []

for (const n of netz) {
  if (n.lead_id) continue
  const t = findeLead(index, { name: n.name, profilKey: n.profil_key, profileUrl: n.profile_url })
  if (!t.leadId) {
    if (t.grund === 'mehrdeutig') mehrdeutig++
    continue
  }
  await patch(`linkedin_netzwerk?id=eq.${n.id}`, { lead_id: t.leadId })
  verheiratet++
}

for (const t of threads) {
  if (t.lead_id) continue
  const treffer = findeLead(index, { name: t.name, profileUrl: t.profile_url })
  if (!treffer.leadId) {
    if (treffer.grund === 'mehrdeutig') mehrdeutig++
    continue
  }
  await patch(`linkedin_threads?id=eq.${t.id}`, { lead_id: treffer.leadId })
  verheiratet++
  // Die opake ID am Lead festschreiben, wenn sie dort noch fehlt — das ist der
  // Schritt, der künftiges Namensraten überflüssig macht.
  const kern = urlKern(t.profile_url)
  if (kern && istOpakeId(kern)) {
    const lead = alleLeads.find((l) => l.id === treffer.leadId)
    if (lead && !lead.li_urn) {
      urnNachtrag.push({ id: lead.id, li_urn: kern })
      lead.li_urn = kern
    }
  }
}

for (const e of erst) {
  if (e.lead_id) continue
  const treffer = findeLead(index, { name: e.name })
  if (!treffer.leadId) {
    if (treffer.grund === 'mehrdeutig') mehrdeutig++
    continue
  }
  await patch(`linkedin_erstnachrichten?id=eq.${e.id}`, { lead_id: treffer.leadId })
  verheiratet++
}

for (const u of urnNachtrag) await patch(`leads?id=eq.${u.id}`, { li_urn: u.li_urn })
console.log(`Verheiratet: ${verheiratet} Spiegel-Zeilen · ${urnNachtrag.length} opake IDs festgeschrieben · ${mehrdeutig} mehrdeutig (bleiben offen)`)

/* ── Runde 4: Ereignisse aus vorhandenen Stempeln ──────────────────────────
 * Jeder Zeitstempel, den die Spiegel schon tragen, wird zu einem Ereignis.
 * Das ist die Historie, die Kevin bisher fehlte — „wie oft habe ich den
 * geschrieben" wird damit zu einer Zählung. */

interface Ereignis {
  brand_id: string
  lead_id: string
  typ: string
  at: string
  quelle: string
  details: Record<string, unknown>
}
const ereignisse: Ereignis[] = []
const gesehen = new Set<string>()
function merke(lead_id: string | null, typ: string, at: string | null, details: Record<string, unknown> = {}) {
  if (!lead_id || !at) return
  const schluessel = `${lead_id}|${typ}|${at}`
  if (gesehen.has(schluessel)) return
  gesehen.add(schluessel)
  ereignisse.push({ brand_id: bid, lead_id, typ, at, quelle: 'backfill', details })
}

const netzFrisch = await alle<NetzZeile>(
  `linkedin_netzwerk?brand_id=eq.${bid}&select=id,name,profil_key,profile_url,status,headline,eingeladen_at,angenommen_at,lead_id&order=id`,
)
const threadsFrisch = await alle<ThreadZeile>(
  `linkedin_threads?brand_id=eq.${bid}&select=id,name,company,profile_url,last_from,last_message_at,first_seen_at,starred,loom_status,loom_erledigt_at,followup_stage,verlauf,lead_id&order=id`,
)
const erstFrisch = await alle<ErstZeile>(
  `linkedin_erstnachrichten?brand_id=eq.${bid}&select=id,name,firma,status,sent_at,lead_id&order=id`,
)

for (const n of netzFrisch) {
  merke(n.lead_id, 'anfrage', n.eingeladen_at)
  merke(n.lead_id, 'angenommen', n.angenommen_at)
}

for (const t of threadsFrisch) {
  // Der Verlauf (0064) hält die letzten ~10 Nachrichten — daraus wird
  // rekonstruiert, wer wann geschrieben hat. Die erste Nachricht von Kevin
  // ist die Erstnachricht, jede weitere ein Follow-up.
  const verlauf = verlaufVon({ verlauf: t.verlauf as never })
  let vonKevin = 0
  for (const nachricht of verlauf) {
    if (!nachricht.ts) continue
    if (nachricht.sender === 'me') {
      vonKevin++
      merke(t.lead_id, vonKevin === 1 ? 'erstnachricht' : 'followup', nachricht.ts, {
        auszug: nachricht.text.slice(0, 200),
      })
    } else if (nachricht.sender === 'them') {
      merke(t.lead_id, 'antwort_erhalten', nachricht.ts, { auszug: nachricht.text.slice(0, 200) })
    }
  }
  // Kein Verlauf, aber eine letzte Nachricht: wenigstens diese festhalten.
  if (!verlauf.length && t.last_message_at) {
    merke(t.lead_id, t.last_from === 'them' ? 'antwort_erhalten' : 'erstnachricht', t.last_message_at)
  }
  if (t.starred && t.last_message_at) merke(t.lead_id, 'loom_zugesagt', t.last_message_at)
  merke(t.lead_id, 'loom_gesendet', t.loom_erledigt_at)
}

for (const e of erstFrisch) {
  if (e.status === 'gesendet') merke(e.lead_id, 'erstnachricht', e.sent_at)
}

console.log(`Ereignisse vorbereitet: ${ereignisse.length}`)
// Das `on_conflict`-Ziel ist Pflicht, nicht Kosmetik: ohne es kennt PostgREST
// den Teil-Unique-Index nicht und `ignore-duplicates` läuft ins Leere — der
// zweite Lauf stirbt dann an 23505 statt still nichts zu tun.
await schreibe(
  'lead_ereignisse?on_conflict=lead_id,typ,at',
  ereignisse,
  'resolution=ignore-duplicates,return=minimal',
)

const anzahl = await alle<{ id: string }>(`lead_ereignisse?brand_id=eq.${bid}&select=id`)
console.log(`Ereignisse in der Datenbank: ${anzahl.length}`)
console.log('\nleads-sync: fertig.')
