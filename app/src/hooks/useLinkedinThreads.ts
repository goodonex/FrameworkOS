import { useCallback, useEffect, useState } from 'react'
import { markDonePatch } from '../cockpit/lib/linkedinFollowups'
import { isMissingSupabaseTableError } from '../lib/supabaseErrors'
import { supabase } from '../lib/supabase'
import type { LinkedinThread } from '../types/db'
import { useBrandId } from './useBrandId'

interface UseLinkedinThreadsResult {
  items: LinkedinThread[]
  loading: boolean
  /** Tabelle existiert noch nicht (Migration 0058 nicht gepusht) → Leerzustand, kein Fehler. */
  tableMissing: boolean
  error: string | null
  reload: () => Promise<void>
  snooze: (id: string, untilIso: string) => Promise<void>
  /** Weg zurück aus dem Schlaf (D2): Snooze löschen, der Bucket rechnet sich neu. */
  wake: (id: string) => Promise<void>
  /**
   * „Erledigt" je nach Bucket: Antwort des Leads → Leiter zurück auf 0,
   * Break-up fällig → archiviert, sonst eine Stufe weiter (markDonePatch).
   */
  markDone: (thread: LinkedinThread) => Promise<void>
  /** Loom aufgenommen und verschickt (Migration 0061, Wargame-Arbeitsmodus Zug 4). */
  markLoomVerschickt: (id: string) => Promise<void>
}

/** Liest linkedin_threads für die aktive Brand (Wargame Zug 7, docs/wargames/linkedin-followups.md). */
export function useLinkedinThreads(brandSlug: string | undefined): UseLinkedinThreadsResult {
  const brandId = useBrandId(brandSlug)
  const [items, setItems] = useState<LinkedinThread[]>([])
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!supabase || !brandId) {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('linkedin_threads')
      .select('*')
      .eq('brand_id', brandId)
      .order('last_message_at', { ascending: true })

    if (err) {
      if (isMissingSupabaseTableError(err.message)) {
        setTableMissing(true)
        setItems([])
        setError(null)
      } else {
        setError(err.message)
      }
      setLoading(false)
      return
    }
    setTableMissing(false)
    setError(null)
    setItems((data ?? []) as LinkedinThread[])
    setLoading(false)
  }, [brandId])

  useEffect(() => {
    void reload()
  }, [reload])

  // Schreibfehler (z. B. RLS) dürfen nicht still verpuffen — sonst klickt Kevin
  // „Erledigt", nichts passiert, und die Stufe bleibt unbemerkt stehen.
  const applyPatch = useCallback(
    async (id: string, patch: Record<string, unknown>) => {
      if (!supabase) return
      let { error: err } = await supabase.from('linkedin_threads').update(patch).eq('id', id)
      // Solange 0065 nicht gepusht ist, kennt die Tabelle die Entwurfs-Spalten
      // nicht. „Erledigt" darf daran nicht scheitern — dann eben ohne sie.
      if (err && /entwurf/i.test(err.message)) {
        const { entwurf: _e, entwurf_at: _a, ...ohneEntwurf } = patch
        ;({ error: err } = await supabase.from('linkedin_threads').update(ohneEntwurf).eq('id', id))
      }
      if (err) {
        setError(err.message)
        return
      }
      setError(null)
      await reload()
    },
    [reload],
  )

  const snooze = useCallback(
    (id: string, untilIso: string) => applyPatch(id, { snoozed_until: untilIso }),
    [applyPatch],
  )

  const wake = useCallback((id: string) => applyPatch(id, { snoozed_until: null }), [applyPatch])

  const markDone = useCallback(
    async (thread: LinkedinThread) => {
      // Regel liegt in linkedinFollowups.markDonePatch (bucket-bewusst, per
      // scripts/verify-linkedin-followups.ts geprüft).
      const patch = markDonePatch(thread)
      if (!patch) return
      await applyPatch(thread.id, patch)
    },
    [applyPatch],
  )

  const markLoomVerschickt = useCallback(
    (id: string) => applyPatch(id, { loom_status: 'verschickt', loom_erledigt_at: new Date().toISOString() }),
    [applyPatch],
  )

  return { items, loading, tableMissing, error, reload, snooze, wake, markDone, markLoomVerschickt }
}
