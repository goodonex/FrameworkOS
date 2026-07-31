import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { isMissingSupabaseTableError } from '../../lib/supabaseErrors'
import { monthTotalOverride, setMonthTotalOverride } from './goals'

/**
 * Umsatz-Monatsziel je Brand aus `month_goals` (Migration 0062).
 *
 * Vorher gab es für das Ziel gar kein UI (`setMonthTotalOverride` hatte null
 * Aufrufer) — ab September 2026 hätte die Home stillschweigend den
 * 40.000-€-Planungs-Default angezeigt. localStorage bleibt Rückfallebene,
 * solange die Migration nicht eingespielt ist; sonst divergierten Mac und Handy.
 */
export interface UseMonthGoalResult {
  /** Gesetztes Ziel in € — null heißt „kein eigenes Ziel, Default gilt". */
  total: number | null
  loading: boolean
  /** Migration 0062 fehlt → localStorage-Rückfallebene ist aktiv. */
  tableMissing: boolean
  error: string | null
  /** Ziel setzen (oder mit null zurück auf den Default). */
  save: (total: number | null) => Promise<void>
}

export function useMonthGoal(
  brandIdRoh: string | undefined,
  monthKey: string,
): UseMonthGoalResult {
  // Die Fallback-Brand hat keine echte UUID — damit zu schreiben scheiterte
  // serverseitig (gleiche Regel wie in useDailyMetrics.mutate).
  const brandId = brandIdRoh?.startsWith('local-fallback-') ? undefined : brandIdRoh
  const [total, setTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase || !brandId) {
      // Ohne Session/Brand nur die lokale Rückfallebene — besser als gar nichts.
      setTotal(monthTotalOverride(monthKey))
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('month_goals')
      .select('total')
      .eq('brand_id', brandId)
      .eq('month_key', monthKey)
      .maybeSingle()

    if (err) {
      if (isMissingSupabaseTableError(err.message)) {
        setTableMissing(true)
        setTotal(monthTotalOverride(monthKey))
        setError(null)
      } else {
        setError(err.message)
        setTotal(monthTotalOverride(monthKey))
      }
      setLoading(false)
      return
    }
    setTableMissing(false)
    setError(null)
    const wert = data ? Number((data as { total: number }).total) : null
    setTotal(Number.isFinite(wert) && (wert ?? 0) > 0 ? wert : null)
    setLoading(false)
  }, [brandId, monthKey])

  useEffect(() => {
    void load()
  }, [load])

  const save = useCallback(
    async (naechstes: number | null) => {
      const wert = naechstes && naechstes > 0 ? Math.round(naechstes) : null
      // Optimistisch — ein Ziel zu setzen darf sich nicht nach Warten anfühlen.
      setTotal(wert)

      if (!supabase || !brandId || tableMissing) {
        setMonthTotalOverride(monthKey, wert)
        return
      }

      const { error: err } =
        wert == null
          ? await supabase.from('month_goals').delete().eq('brand_id', brandId).eq('month_key', monthKey)
          : await supabase
              .from('month_goals')
              .upsert({ brand_id: brandId, month_key: monthKey, total: wert }, { onConflict: 'brand_id,month_key' })

      if (err) {
        if (isMissingSupabaseTableError(err.message)) {
          setTableMissing(true)
          setMonthTotalOverride(monthKey, wert)
          return
        }
        setError(err.message)
        await load()
        return
      }
      setError(null)
    },
    [brandId, monthKey, tableMissing, load],
  )

  return { total, loading, tableMissing, error, save }
}
