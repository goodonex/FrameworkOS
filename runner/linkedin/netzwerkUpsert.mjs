/**
 * runner/linkedin/netzwerkUpsert.mjs — das geerntete Netzwerk nach Supabase.
 *
 * Schreibt in `linkedin_netzwerk` (Migration 0070) mit dem service_role-Key,
 * also an RLS vorbei — wie `upsert.mjs` für die Threads.
 *
 * **Die eine Regel, an der hier alles hängt** (D4 der Blaupause): Nur ein
 * VOLLSTÄNDIGER Lauf darf Abwesenheits-Schlüsse ziehen. Wer nicht mehr in der
 * Einladungsliste steht, hat entweder angenommen oder wurde zurückgezogen —
 * aber das weiss man nur, wenn die Liste wirklich zu Ende gelesen wurde. Ein
 * abgebrochener Lauf ergänzt und aktualisiert; er nimmt niemandem seinen Status.
 */
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

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

/** Wie viele Zeilen je Request. PostgREST verträgt mehr, aber 200 hält die URL kurz. */
const STAPEL = 200

function authHeaders() {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  }
}

async function hole(pfad) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pfad}`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`GET ${pfad} HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`)
  return res.json()
}

async function brandId() {
  const rows = await hole(`brands?slug=eq.${encodeURIComponent(BRAND_SLUG)}&select=id&limit=1`)
  if (!rows[0]?.id) throw new Error(`Kein Brand mit slug="${BRAND_SLUG}" gefunden`)
  return rows[0].id
}

/**
 * Schreibt eine geerntete Liste weg.
 *
 * `liste` ist das Ergebnis von `leseListe` — mit `status`, `eintraege` und
 * `vollstaendig`. Zurück kommt, was passiert ist, samt der Zahl, die den
 * Unterschied macht: wie viele Einträge als „nicht mehr in der Liste" erkannt
 * wurden (nur bei vollständigem Lauf > 0).
 */
export async function upsertNetzwerk(liste, { jetzt = new Date() } = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY fehlen (runner/.env)')
  }
  const bid = await brandId()
  const stempel = jetzt.toISOString()

  const zeilen = liste.eintraege.map((e) => ({
    brand_id: bid,
    profil_key: e.profilKey,
    name: e.name,
    headline: e.headline ?? '',
    profile_url: e.profileUrl ?? '',
    status: liste.status,
    // Nur setzen, was diese Liste weiss: die Einladungsliste kennt kein
    // Annahmedatum, die Kontaktliste kein Sendedatum. Ein `null` würde den
    // jeweils anderen Wert überschreiben, deshalb fliegt der Schlüssel raus.
    ...(e.eingeladenAt ? { eingeladen_at: e.eingeladenAt } : {}),
    ...(e.angenommenAt ? { angenommen_at: e.angenommenAt } : {}),
    zuletzt_gesehen_at: stempel,
    last_synced_at: stempel,
  }))

  /**
   * Nach Spalten-Signatur gruppieren, DANN stapeln.
   *
   * PostgREST besteht darauf, dass alle Objekte eines Requests dieselben
   * Schlüssel tragen („All object keys must match", PGRST102 — am 12.08. nach
   * 876 geernteten Einladungen genau daran gescheitert). Weil eine Zeile ihr
   * Datum weglässt, wenn es nicht lesbar war, entstehen zwangsläufig zwei
   * Formen. Sie in einen Topf zu zwingen hiesse, fehlende Daten als `null` zu
   * schicken — und ein `null` würde beim Merge einen früher erkannten Wert
   * überschreiben. Also lieber zwei Requests als ein verlorener Zeitstempel.
   */
  const nachForm = new Map()
  for (const z of zeilen) {
    const form = Object.keys(z).sort().join(',')
    if (!nachForm.has(form)) nachForm.set(form, [])
    nachForm.get(form).push(z)
  }

  let geschrieben = 0
  for (const gruppe of nachForm.values()) {
    for (let i = 0; i < gruppe.length; i += STAPEL) {
      const teil = gruppe.slice(i, i + STAPEL)
      const res = await fetch(`${SUPABASE_URL}/rest/v1/linkedin_netzwerk?on_conflict=brand_id,profil_key`, {
        method: 'POST',
        headers: { ...authHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(teil),
      })
      if (!res.ok) {
        throw new Error(`POST linkedin_netzwerk HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`)
      }
      geschrieben += teil.length
    }
  }

  /**
   * Der Abwesenheits-Schluss — und warum er an `vollstaendig` hängt.
   *
   * Wer in einem vollständig gelesenen Einladungs-Lauf NICHT mehr auftaucht,
   * steht nicht mehr auf der Liste: angenommen (dann korrigiert ihn der
   * Kontakt-Lauf auf 'angenommen') oder zurückgezogen. In beiden Fällen ist er
   * kein InMail-Kandidat mehr. Bei einem Teil-Lauf wäre derselbe Schluss ein
   * Massenirrtum — dann bleibt `zuletzt_gesehen_at` einfach alt stehen, und die
   * Auswertung filtert ihn ohnehin heraus.
   */
  let veraltet = 0
  if (liste.vollstaendig) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/linkedin_netzwerk?brand_id=eq.${bid}&status=eq.${liste.status}` +
        `&zuletzt_gesehen_at=lt.${encodeURIComponent(stempel)}&select=profil_key`,
      { headers: authHeaders() },
    )
    if (res.ok) veraltet = (await res.json()).length
  }

  return {
    seite: liste.seite,
    status: liste.status,
    geschrieben,
    vollstaendig: liste.vollstaendig,
    gesamtLautSeite: liste.gesamt,
    nichtMehrGesehen: veraltet,
  }
}

// --- Direktaufruf: node runner/linkedin/netzwerkUpsert.mjs [liste] ---------
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { leseListe } = await import('./netzwerk.mjs')
  const welche = process.argv.find((a) => a === 'einladungen' || a === 'kontakte')
  const listen = welche ? [welche] : ['einladungen', 'kontakte']
  for (const l of listen) {
    const gelesen = await leseListe(l, { log: (...a) => console.log(...a) })
    if (gelesen.loginWall) {
      console.log('LOGIN-WALL — im Sync-Chrome bei LinkedIn anmelden')
      break
    }
    console.log(
      `${l}: ${gelesen.eintraege.length} von ${gelesen.gesamt} · vollständig: ${gelesen.vollstaendig ? 'JA' : 'NEIN'}`,
    )
    console.log(JSON.stringify(await upsertNetzwerk(gelesen), null, 1))
  }
  process.exit(0)
}
