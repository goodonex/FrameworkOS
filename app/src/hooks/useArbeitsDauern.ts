import { useEffect, useState } from 'react'
import { medianeJeSpur, type Dauern } from '../cockpit/lib/tagesansage'
import { isMissingSupabaseTableError } from '../lib/supabaseErrors'
import { supabase } from '../lib/supabase'
import { useBrandId } from './useBrandId'

/**
 * Gemessene Arbeitsdauern (Migration 0061). Die Tabelle wird seit dem
 * Arbeitsmodus beschrieben und war bisher tot — hier wird sie zum ersten Mal
 * gelesen: Median je Spur über die letzten ~30 Tage, Grundlage der Tagesansage.
 *
 * Bewusst ohne Live-Aktualisierung: die Mediane ändern sich über Wochen, nicht
 * über Minuten. Einmal je Seitenaufruf laden reicht.
 */
const FENSTER_TAGE = 30

export interface UseArbeitsDauernResult extends Dauern {
  loading: boolean
  /** Tabelle fehlt (0061 nicht gepusht) → keine Ansage, kein Fehler. */
  tableMissing: boolean
}

export function useArbeitsDauern(brandSlug: string | undefined): UseArbeitsDauernResult {
  const brandId = useBrandId(brandSlug)
  const [state, setState] = useState<UseArbeitsDauernResult>({
    jeSpur: {},
    gesamt: null,
    messwerte: 0,
    loading: true,
    tableMissing: false,
  })

  useEffect(() => {
    let abgebrochen = false
    if (!supabase || !brandId) {
      setState((s) => ({ ...s, loading: false }))
      return
    }
    const seit = new Date(Date.now() - FENSTER_TAGE * 24 * 60 * 60 * 1000).toISOString()
    void supabase
      .from('arbeits_dauern')
      .select('spur,sekunden')
      .eq('brand_id', brandId)
      .gte('erledigt_at', seit)
      .then(({ data, error }) => {
        if (abgebrochen) return
        if (error) {
          setState({
            jeSpur: {},
            gesamt: null,
            messwerte: 0,
            loading: false,
            tableMissing: isMissingSupabaseTableError(error.message),
          })
          return
        }
        const dauern = medianeJeSpur((data ?? []) as { spur: string; sekunden: number }[])
        setState({ ...dauern, loading: false, tableMissing: false })
      })
    return () => {
      abgebrochen = true
    }
  }, [brandId])

  return state
}
