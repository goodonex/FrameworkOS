import { useEffect, useState } from 'react'
import { RUNNER_BASE_URL } from './useRunnerStatus'
import { leseSpiegel, runnerDirekt } from './runnerBridge'
import { bereiteDateienVor, gespiegelteDateiUrl } from './runnerFiles'
import { useActiveBrandOptional } from './activeBrand'
import { loadSocialBatchList, saveSocialBatch } from './socialBatchStore'

/**
 * Social-Content (Cockpit /content): die wöchentlichen Content-Batches der
 * Content-Engine (Montags-Lauf). Quelle = 04_social/content-engine/weekly/<KW>/
 * woche-<KW>.html (self-contained), gelesen über den lokalen Runner.
 */
export interface SocialWeek {
  week: string // "2026-W29"
  title: string
  htmlPath: string // rel zu SOCIAL_ROOT (für /files/social/)
  mtime: number
  postsCount: number
}

async function req<T>(path: string): Promise<T> {
  const res = await fetch(`${RUNNER_BASE_URL}${path}`, { cache: 'no-store' })
  const body = (await res.json()) as T & { error?: string }
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Runner-Fehler ${res.status}`)
  return body
}

export async function fetchSocialWeeks(): Promise<SocialWeek[]> {
  if (!runnerDirekt()) {
    const spiegel = await leseSpiegel<{ weeks: SocialWeek[] }>('social_weeks')
    if (!spiegel) throw new Error('Noch kein Spiegel vorhanden — Runner einmal laufen lassen.')
    await bereiteDateienVor('social', spiegel.data.weeks.map((w) => w.htmlPath))
    return spiegel.data.weeks
  }
  const { weeks } = await req<{ weeks: SocialWeek[] }>('/social/weeks')
  return weeks
}

/**
 * URL der self-contained Wochen-HTML: lokal über den Runner, sonst signiert aus
 * dem Storage-Spiegel. Null = nicht gespiegelt (z.B. Slide-HTMLs einzelner Posts,
 * die relative Asset-Pfade haben und deshalb nur lokal funktionieren).
 */
export function socialFileUrl(htmlPath: string): string | null {
  if (!runnerDirekt()) return gespiegelteDateiUrl('social', htmlPath)
  const encoded = htmlPath.split('/').map(encodeURIComponent).join('/')
  return `${RUNNER_BASE_URL}/files/social/${encoded}`
}

// ---------- „Gesehen"-Status (neu-Badge + Nav-Punkt), lokal ----------
const SEEN_KEY = 'cockpit.socialSeenWeeks'
const SEEN_EVENT = 'social-seen-changed'

export function getSeenWeeks(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

export function markWeekSeen(week: string): void {
  try {
    const seen = getSeenWeeks()
    if (seen.has(week)) return
    seen.add(week)
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]))
    window.dispatchEvent(new Event(SEEN_EVENT))
  } catch {
    /* ohne localStorage kein Persist — unkritisch */
  }
}

/**
 * Spiegelt neue/aktualisierte Wochen vom Runner nach Supabase (nur lokal, wo der
 * Runner erreichbar ist). Vergleicht per mtime — schon aktuelle Wochen werden
 * übersprungen (kein unnötiger HTML-Transfer). Gibt die Zahl gespiegelter Wochen
 * zurück. Runner offline → 0, kein Fehler.
 */
export async function syncSocialBatchesFromRunner(brandSlug: string): Promise<number> {
  let weeks: SocialWeek[]
  try {
    weeks = await fetchSocialWeeks()
  } catch {
    return 0 // Runner nicht erreichbar (z.B. Live-Domain/Handy) → nichts zu spiegeln
  }
  const known = new Map(
    (await loadSocialBatchList(brandSlug)).map((b) => [b.week, b.sourceMtime ?? 0]),
  )
  let synced = 0
  for (const w of weeks) {
    const have = known.get(w.week)
    if (have != null && have >= w.mtime) continue // schon aktuell
    try {
      const url = socialFileUrl(w.htmlPath)
      if (!url) continue
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) continue
      const html = await res.text()
      await saveSocialBatch(brandSlug, {
        week: w.week,
        title: w.title,
        html,
        postsCount: w.postsCount,
        sourceMtime: w.mtime,
      })
      synced++
    } catch {
      /* einzelne Woche überspringen, Rest weiter */
    }
  }
  return synced
}

/**
 * Ein Ladelauf je Brand, egal wie viele Stellen die Zahl anzeigen (O18, Zug 4).
 *
 * Der Hook holte pro Aufrufer alle 60 Sekunden Runner-Spiegel und Supabase-Liste.
 * Solange nur die NavRail ihn rief, war das eine Abfrage — mit dem App-Grid des
 * Homescreens wären es zwei parallele geworden, und der Homescreen hätte genau
 * die Nachlade-Signatur bekommen, die Gesetz 4 der Blaupause verbietet. Deshalb
 * teilen sich jetzt alle Aufrufer einen Kanal; der letzte, der geht, räumt auf.
 */
interface UnreadKanal {
  count: number
  hoerer: Set<(n: number) => void>
  stop: () => void
}

const unreadKanaele = new Map<string, UnreadKanal>()

function unreadKanal(brandSlug: string): UnreadKanal {
  const vorhanden = unreadKanaele.get(brandSlug)
  if (vorhanden) return vorhanden

  const kanal: UnreadKanal = { count: 0, hoerer: new Set(), stop: () => {} }
  const setze = (n: number) => {
    kanal.count = n
    for (const h of kanal.hoerer) h(n)
  }
  const load = async () => {
    await syncSocialBatchesFromRunner(brandSlug) // no-op wenn Runner offline
    const list = await loadSocialBatchList(brandSlug)
    const seen = getSeenWeeks()
    setze(list.filter((w) => !seen.has(w.week)).length)
  }
  void load().catch(() => setze(0))
  const onSeen = () => void load().catch(() => {})
  window.addEventListener(SEEN_EVENT, onSeen)
  const iv = window.setInterval(() => void load().catch(() => {}), 60_000)
  kanal.stop = () => {
    window.removeEventListener(SEEN_EVENT, onSeen)
    window.clearInterval(iv)
    unreadKanaele.delete(brandSlug)
  }
  unreadKanaele.set(brandSlug, kanal)
  return kanal
}

/**
 * Anzahl noch nicht gesichteter Wochen — für den Nav-Badge („Meldung oben").
 * Quelle ist Supabase (funktioniert live/mobil); ist der Runner lokal erreichbar,
 * wird vorher gespiegelt, sodass neue Batches sofort auftauchen.
 */
export function useSocialUnread(): number {
  const brand = useActiveBrandOptional()
  const brandSlug = brand?.activeSlug ?? 'herrmann'
  const [count, setCount] = useState(() => unreadKanaele.get(brandSlug)?.count ?? 0)
  useEffect(() => {
    const kanal = unreadKanal(brandSlug)
    setCount(kanal.count)
    kanal.hoerer.add(setCount)
    return () => {
      kanal.hoerer.delete(setCount)
      if (kanal.hoerer.size === 0) kanal.stop()
    }
  }, [brandSlug])
  return count
}
