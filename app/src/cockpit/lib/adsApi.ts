import { RUNNER_BASE_URL } from './useRunnerStatus'
import { leseSpiegel, runnerDirekt } from './runnerBridge'
import { bereiteDateienVor, gespiegelteDateiUrl } from './runnerFiles'

/**
 * Kunden-Ads (Cockpit /ads): Typen + Fetcher für das Dateisystem-Manifest.
 * Quelle der Wahrheit ist `<Kundenordner>/<adsDir>/ads.json` — gelesen und
 * geschrieben über den lokalen Runner (Register = Kunden/cockpit-kunden.json).
 */

export interface KundeWebsite {
  live?: string
  dev?: string
  project?: string
}

export interface Kunde {
  slug: string
  name: string
  folder: string
  adsDir?: string
  website?: KundeWebsite
}

export type AdStatus = 'draft' | 'review' | 'approved' | 'live' | 'archived'

export interface AdFileRef {
  path: string
  format: '1:1' | '9:16' | 'mockup'
  note?: string
}

export interface ChecklistItem {
  id: string
  label: string
  done: boolean
}

export interface AdNote {
  at: string
  text: string
}

/** Manuell (oder per Claude) gepflegte Meta-Zahlen, roh; CPL/CTR werden abgeleitet. */
export interface AdMetrics {
  updatedAt?: string
  spend?: number
  impressions?: number
  clicks?: number
  leads?: number
}

export interface AdVersion {
  v: number
  createdAt: string
  files: AdFileRef[]
  preview?: string
  copy?: { headline?: string; primary?: string; cta?: string }
  review?: { design: ChecklistItem[]; copy: ChecklistItem[] }
  notes?: AdNote[]
  metrics?: AdMetrics
}

export interface Ad {
  id: string
  title: string
  angle?: string
  status: AdStatus
  versions: AdVersion[]
}

export interface OverviewFile {
  label: string
  path: string
  kind: 'html' | 'png'
}

export interface AdManifest {
  schemaVersion: 1
  customer: string
  updatedAt: string | null
  overviewFiles: OverviewFile[]
  ads: Ad[]
}

export const AD_STATUS_LABEL: Record<AdStatus, string> = {
  draft: 'Entwurf',
  review: 'In Review',
  approved: 'Freigegeben',
  live: 'Live',
  archived: 'Archiv',
}

export const AD_STATUS_ORDER: AdStatus[] = ['draft', 'review', 'approved', 'live', 'archived']

/** Checklisten-Templates: werden pro Version beim ersten Öffnen geseedet. */
export const DESIGN_CHECKS: Array<{ id: string; label: string }> = [
  { id: 'hierarchy', label: 'Visuelle Hierarchie klar (1 Blickpfad)' },
  { id: 'brand', label: 'Brand-Farben & Fonts korrekt' },
  { id: 'mobile', label: 'Lesbarkeit auf Handy-Größe geprüft' },
  { id: 'contrast', label: 'Kontrast Text/CTA ausreichend' },
  { id: 'calm', label: 'Ruhe statt Effekt — nichts Unruhiges' },
  { id: 'formats', label: '1:1 und 9:16 vorhanden/konsistent' },
]

export const COPY_CHECKS: Array<{ id: string; label: string }> = [
  { id: 'hook', label: 'Hook stoppt den Scroll (erste 2 Zeilen)' },
  { id: 'benefit', label: 'Nutzenversprechen konkret, nicht generisch' },
  { id: 'spirit', label: 'Reichentrog-Spirit statt Standard-Makler' },
  { id: 'cta', label: 'CTA klar + konkreter nächster Schritt' },
  { id: 'one-idea', label: 'Ein Gedanke pro Ad' },
  { id: 'spelling', label: 'Rechtschreibung & Fakten geprüft' },
]

export function seedReview(): { design: ChecklistItem[]; copy: ChecklistItem[] } {
  return {
    design: DESIGN_CHECKS.map((c) => ({ ...c, done: false })),
    copy: COPY_CHECKS.map((c) => ({ ...c, done: false })),
  }
}

// ---------- Fetcher ----------
async function req<T>(path: string, init?: RequestInit): Promise<T> {
  // no-store: das Manifest darf nie aus dem Browser-HTTP-Cache kommen —
  // ein stale GET würde Checklisten-/Notiz-Stand zurückdrehen.
  const res = await fetch(`${RUNNER_BASE_URL}${path}`, { cache: 'no-store', ...init })
  const body = (await res.json()) as T & { error?: string }
  if (!res.ok) {
    const err = new Error(body.error ?? `Runner-Fehler ${res.status}`) as Error & {
      status?: number
      body?: unknown
    }
    err.status = res.status
    err.body = body
    throw err
  }
  return body
}

export async function fetchKunden(): Promise<Kunde[]> {
  const { kunden } = await req<{ kunden: Kunde[] }>('/ads/customers')
  return kunden
}

/** Kunde + sein Manifest in einem Rutsch (fürs kundenübergreifende Dashboard). */
export interface AdsOverviewEntry {
  kunde: Kunde
  manifest: AdManifest
}

export async function fetchAdsOverview(): Promise<AdsOverviewEntry[]> {
  // Ohne direkten Draht zum Runner (HTTPS-Domain) den Spiegel lesen — Migration 0059.
  if (!runnerDirekt()) {
    const spiegel = await leseSpiegel<{ entries: AdsOverviewEntry[] }>('ads_overview')
    if (!spiegel) throw new Error('Noch kein Spiegel vorhanden — Runner einmal laufen lassen.')
    // Vorschau-Bilder und Creatives kommen aus dem Storage-Spiegel — signieren,
    // solange die Liste noch geladen wird (kundenFileUrl liest danach synchron).
    await bereiteDateienVor(
      'kunden',
      spiegel.data.entries.flatMap(({ kunde, manifest }) => {
        const basis = `${kunde.folder}/${kunde.adsDir ?? '05_leadgen'}`
        const rels = new Set<string>()
        for (const o of manifest.overviewFiles ?? []) if (o?.path) rels.add(o.path)
        for (const a of manifest.ads ?? []) {
          for (const v of a.versions ?? []) {
            for (const f of v.files ?? []) if (f?.path) rels.add(f.path)
            if (v.preview) rels.add(v.preview)
          }
        }
        return [...rels].map((r) => `${basis}/${r}`)
      }),
    )
    return spiegel.data.entries
  }
  const { entries } = await req<{ entries: AdsOverviewEntry[] }>('/ads/overview')
  return entries
}

/** Abgeleitete Kennzahlen aus rohen Metriken (CPL, CTR). */
export interface DerivedMetrics {
  spend: number
  impressions: number
  clicks: number
  leads: number
  cpl: number | null
  ctr: number | null
  hasData: boolean
}

export function deriveMetrics(m?: AdMetrics): DerivedMetrics {
  const spend = m?.spend ?? 0
  const impressions = m?.impressions ?? 0
  const clicks = m?.clicks ?? 0
  const leads = m?.leads ?? 0
  const hasData = Boolean(m && (m.spend != null || m.leads != null || m.impressions != null || m.clicks != null))
  return {
    spend,
    impressions,
    clicks,
    leads,
    cpl: leads > 0 ? spend / leads : null,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
    hasData,
  }
}

export function sumMetrics(list: DerivedMetrics[]): DerivedMetrics {
  const acc = list.reduce(
    (a, d) => ({
      spend: a.spend + d.spend,
      impressions: a.impressions + d.impressions,
      clicks: a.clicks + d.clicks,
      leads: a.leads + d.leads,
    }),
    { spend: 0, impressions: 0, clicks: 0, leads: 0 },
  )
  return {
    ...acc,
    cpl: acc.leads > 0 ? acc.spend / acc.leads : null,
    ctr: acc.impressions > 0 ? (acc.clicks / acc.impressions) * 100 : null,
    hasData: list.some((d) => d.hasData),
  }
}

/**
 * Neueste Version einer Ad (Reviews/Metriken hängen an der höchsten v).
 *
 * Wirklich die höchste `v`, nicht das letzte Array-Element: `ads.json` wird
 * von Hand bzw. von Claude geschrieben, und eine nachgetragene ältere Version
 * am Ende der Liste hätte sonst Vorschau, Checkliste UND Spend/CPL im
 * Dashboard auf den falschen Stand gezogen.
 */
export function latestVersion(ad: Ad): AdVersion | undefined {
  if (ad.versions.length === 0) return undefined
  return ad.versions.reduce((hoechste, kandidat) => (kandidat.v > hoechste.v ? kandidat : hoechste))
}

export const ACTIVE_STATUSES: AdStatus[] = ['live', 'approved']

export const EUR = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
export const EUR2 = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })
export const NUM = new Intl.NumberFormat('de-DE')

export function fetchAdManifest(slug: string): Promise<AdManifest> {
  return req<AdManifest>(`/ads/manifest?kunde=${encodeURIComponent(slug)}`)
}

/** Wirft bei 409 einen Error mit `.status === 409` und `.body.current` (Disk-Stand). */
export function putAdManifest(
  slug: string,
  manifest: AdManifest,
  baseUpdatedAt: string | null,
): Promise<{ ok: true; updatedAt: string }> {
  return req(`/ads/manifest?kunde=${encodeURIComponent(slug)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ baseUpdatedAt, manifest }),
  })
}

/**
 * URL für eine Datei aus dem Ads-Ordner des Kunden (relativ zu adsDir).
 * Lokal über den Runner — segmentweise encoden, der Ordnername enthält
 * Leerzeichen ("KP - Reichentrog"), die Slashes müssen Pfadtrenner bleiben.
 * Sonst die signierte Storage-URL; null = (noch) nicht gespiegelt.
 */
export function kundenFileUrl(kunde: Kunde, relPath: string): string | null {
  const full = `${kunde.folder}/${kunde.adsDir ?? '05_leadgen'}/${relPath}`
  if (!runnerDirekt()) return gespiegelteDateiUrl('kunden', full)
  const encoded = full.split('/').map(encodeURIComponent).join('/')
  return `${RUNNER_BASE_URL}/files/kunden/${encoded}`
}
