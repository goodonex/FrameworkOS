import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Der Befund des Widerspruchs-Wächters (`runner/widersprueche.mjs`, 17.08.2026).
 *
 * Das Cockpit prüft hier NICHTS selbst — es liest nur, was der Runner
 * geschrieben hat. Genau darum geht es beim Wächter: eine Frage, ein Ort, eine
 * Antwort. Eine zweite Fassung derselben Sätze in der Oberfläche wäre der
 * Fehler, gegen den er gebaut ist.
 */
export interface Widerspruch {
  schluessel: string
  schwere: 'hoch' | 'mittel'
  /** Was nicht zusammenpasst — mit Zahl, nicht „irgendwas stimmt nicht". */
  text: string
  zahl: number
  /** Der Handgriff, der es behebt. */
  tun: string
}

export interface WiderspruchStand {
  stand: string
  anzahl: number
  hoch: number
  befunde: Widerspruch[]
  /** Wann der Wächter zuletzt geschrieben hat — alt heißt: der Runner steht. */
  aktualisiert: string | null
}

export function useWidersprueche(): {
  stand: WiderspruchStand | null
  loading: boolean
  reload: () => Promise<void>
} {
  const [stand, setStand] = useState<WiderspruchStand | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!supabase) {
      setLoading(false)
      return
    }
    const { data, error } = await supabase
      .from('runner_snapshots')
      .select('data,updated_at')
      .eq('key', 'widersprueche')
      .maybeSingle()

    // Kein Befund ist kein Fehler: Solange der Wächter nie lief, gibt es
    // schlicht nichts zu zeigen — dann schweigt die Oberfläche.
    if (error || !data?.data) {
      setStand(null)
      setLoading(false)
      return
    }
    const roh = data.data as Omit<WiderspruchStand, 'aktualisiert'>
    setStand({ ...roh, aktualisiert: data.updated_at ?? null })
    setLoading(false)
  }, [])

  useEffect(() => {
    void reload()
    // Der Wächter schreibt alle 15 Minuten; halb so oft nachsehen genügt.
    const id = window.setInterval(() => void reload(), 5 * 60 * 1000)
    return () => window.clearInterval(id)
  }, [reload])

  return { stand, loading, reload }
}
