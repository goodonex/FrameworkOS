import { useCallback, useEffect, useState } from 'react'
import { entdoppleErstnachrichten } from '../cockpit/lib/erstnachrichtenDedup'
import { isMissingSupabaseTableError } from '../lib/supabaseErrors'
import { supabase } from '../lib/supabase'
import { useBrandIdStatus } from './useBrandId'

export interface Erstnachricht {
  id: string
  gruppe: string
  name: string
  firma: string
  website: string
  nachricht: string
  sort_index: number
  status: 'offen' | 'gesendet' | 'uebersprungen'
  sent_at: string | null
  /** Wann der Runner die Zeile zuletzt aus dem Vault gespiegelt hat (0060). */
  last_synced_at?: string | null
}

interface Result {
  items: Erstnachricht[]
  loading: boolean
  tableMissing: boolean
  error: string | null
  reload: () => Promise<void>
  setzeStatus: (id: string, status: Erstnachricht['status']) => Promise<void>
  /** Alles vor dieser Position als erledigt abhaken — für den einmaligen Einstieg. */
  alleDavorErledigen: (sortIndex: number) => Promise<void>
  /** Mehrere Zeilen auf einmal als verschickt verbuchen (Postfach-Abgleich, 17.08.). */
  erledigeViele: (ids: string[]) => Promise<void>
}

/** Versandfertige LinkedIn-Erstnachrichten aus dem Vault (Migration 0060). */
export function useErstnachrichten(brandSlug: string | undefined): Result {
  const { brandId, pending: brandPending } = useBrandIdStatus(brandSlug)
  const [items, setItems] = useState<Erstnachricht[]>([])
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!supabase || !brandId) {
      setItems([])
      // Solange die Brand noch gesucht wird, ist die Liste nicht leer, sondern
      // unbekannt — sonst blitzt „Noch keine Erstnachrichten gespiegelt" auf.
      setLoading(brandPending)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('linkedin_erstnachrichten')
      .select('*')
      .eq('brand_id', brandId)
      .order('sort_index', { ascending: true })

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
    /**
     * Eine Person, eine Zeile. Vor 0071 lag der Schlüssel auf
     * `(brand_id, gruppe, name)` — eine umformulierte Gruppen-Überschrift im
     * Vault ließ den Spiegel die ganze Gruppe erneut anlegen (145 Zeilen für
     * 118 Leads, "144 offen"). Die Entdopplung hier hält die Liste auch mit
     * Altbestand ehrlich; die Regel ist dieselbe wie in der Migration.
     */
    setItems(entdoppleErstnachrichten((data ?? []) as Erstnachricht[]))
    setLoading(false)
  }, [brandId, brandPending])

  useEffect(() => {
    void reload()
  }, [reload])

  const setzeStatus = useCallback(
    async (id: string, status: Erstnachricht['status']) => {
      if (!supabase) return
      // Optimistisch: der Klick soll sich sofort anfühlen, auch übers Handy.
      setItems((cur) =>
        cur.map((i) =>
          i.id === id ? { ...i, status, sent_at: status === 'gesendet' ? new Date().toISOString() : null } : i,
        ),
      )
      const { error: err } = await supabase
        .from('linkedin_erstnachrichten')
        .update({ status, sent_at: status === 'gesendet' ? new Date().toISOString() : null })
        .eq('id', id)
      if (err) {
        setError(err.message)
        await reload()
      }
    },
    [reload],
  )

  const alleDavorErledigen = useCallback(
    async (sortIndex: number) => {
      if (!supabase || !brandId) return
      const { error: err } = await supabase
        .from('linkedin_erstnachrichten')
        .update({ status: 'gesendet', sent_at: new Date().toISOString() })
        .eq('brand_id', brandId)
        .lt('sort_index', sortIndex)
        .eq('status', 'offen')
      if (err) setError(err.message)
      await reload()
    },
    [brandId, reload],
  )

  /**
   * Der Postfach-Abgleich schreibt in einem Rutsch zurück: Wer nachweislich
   * einen Thread hat, ist verschickt. Kevin löst das per Klick aus — automatisch
   * geschriebene Statuszeilen wären nicht mehr zu unterscheiden von seinen.
   */
  const erledigeViele = useCallback(
    async (ids: string[]) => {
      if (!supabase || ids.length === 0) return
      const jetzt = new Date().toISOString()
      setItems((cur) =>
        cur.map((i) => (ids.includes(i.id) ? { ...i, status: 'gesendet' as const, sent_at: jetzt } : i)),
      )
      const { error: err } = await supabase
        .from('linkedin_erstnachrichten')
        .update({ status: 'gesendet', sent_at: jetzt })
        .in('id', ids)
      if (err) setError(err.message)
      await reload()
    },
    [reload],
  )

  return { items, loading, tableMissing, error, reload, setzeStatus, alleDavorErledigen, erledigeViele }
}
