import { RUNNER_BASE_URL } from './useRunnerStatus'

/**
 * Content-Posts (Cockpit /content, Post-Ebene): Typen + Fetcher für das
 * Dateisystem-Manifest. Quelle der Wahrheit ist `content-engine/content.json`
 * im Social-Ordner der Brand — gelesen und geschrieben über den lokalen Runner
 * (`/content/manifest?brand=<slug>`). Spiegelt bewusst das /ads-Muster (adsApi.ts):
 * Optimistic-Concurrency über updatedAt, damit Kevin im UI + eine Claude-Session
 * konfliktfrei dieselbe Datei pflegen.
 *
 * Post-Ebene ist bewusst FLACH (keine Versionen wie bei Ads): ein Post ist ein
 * Angle in einem Kanal, mit Slides + Caption + Pipeline-Status.
 */

export type ContentStatus = 'idea' | 'production' | 'review' | 'scheduled' | 'posted'
export type ContentChannel = 'instagram' | 'linkedin' | 'tiktok' | 'youtube'
export type ContentFormat = 'carousel' | 'reel' | 'story' | 'single'

/** Verweis auf eine Slide-Datei, relativ zu SOCIAL_ROOT (via /files/social/ serviert). */
export interface SlideRef {
  path: string
  note?: string
}

export interface ContentNote {
  at: string
  text: string
}

export interface ContentPost {
  id: string
  title: string
  angle?: string
  status: ContentStatus
  channel: ContentChannel
  format: ContentFormat
  /** ISO-Datum (YYYY-MM-DD) — Meta Business Suite plant, das Modul zeigt den Plan. */
  plannedFor?: string
  caption?: string
  slides: SlideRef[]
  /** Rücklink zur Wochen-Batch-Herkunft, z.B. "2026-W29". */
  week?: string
  done: boolean
  notes?: ContentNote[]
  /** Wann „Als gepostet markieren" gedrückt wurde (schreibt nur der Runner, O9). */
  postedAt?: string
}

export interface ContentManifest {
  schemaVersion: 1
  brand: string
  updatedAt: string | null
  posts: ContentPost[]
}

export const CONTENT_STATUS_LABEL: Record<ContentStatus, string> = {
  idea: 'Idee',
  production: 'In Produktion',
  review: 'Review',
  scheduled: 'Geplant',
  posted: 'Gepostet',
}

export const CONTENT_STATUS_ORDER: ContentStatus[] = [
  'idea',
  'production',
  'review',
  'scheduled',
  'posted',
]

export const CONTENT_CHANNEL_LABEL: Record<ContentChannel, string> = {
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  youtube: 'YouTube',
}

export const CONTENT_CHANNEL_ORDER: ContentChannel[] = ['instagram', 'linkedin', 'tiktok', 'youtube']

export const CONTENT_FORMAT_LABEL: Record<ContentFormat, string> = {
  carousel: 'Carousel',
  reel: 'Reel',
  story: 'Story',
  single: 'Single',
}

export const CONTENT_FORMAT_ORDER: ContentFormat[] = ['carousel', 'reel', 'story', 'single']

// ---------- Fetcher ----------
async function req<T>(path: string, init?: RequestInit): Promise<T> {
  // no-store: das Manifest darf nie aus dem Browser-HTTP-Cache kommen —
  // ein stale GET würde Status-/Notiz-Stand zurückdrehen.
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

export function fetchContentManifest(brand: string): Promise<ContentManifest> {
  return req<ContentManifest>(`/content/manifest?brand=${encodeURIComponent(brand)}`)
}

/** Wirft bei 409 einen Error mit `.status === 409` und `.body.current` (Disk-Stand). */
export function putContentManifest(
  brand: string,
  manifest: ContentManifest,
  baseUpdatedAt: string | null,
): Promise<{ ok: true; updatedAt: string }> {
  return req(`/content/manifest?brand=${encodeURIComponent(brand)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ baseUpdatedAt, manifest }),
  })
}

/**
 * „Als gepostet markieren" (O9 / D5). Schreibt NICHT das ganze Manifest, sondern
 * schickt nur, was sich ändert — der Runner setzt `status: 'posted'` in
 * `content.json`. Entweder ein einzelner Post (`postId`) oder eine ganze Woche
 * (`week`). Braucht den Runner direkt; im Spiegel-Fall gibt es keinen Weg dorthin.
 */
export function markiereGepostet(
  brand: string,
  ziel: { postId: string } | { week: string },
): Promise<{ ok: true; getroffen: number; updatedAt: string | null }> {
  return req('/content/posted', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brand, ...ziel }),
  })
}

export const CONTENT_DATE_FMT = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})
