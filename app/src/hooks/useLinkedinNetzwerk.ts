import { useCallback, useEffect, useState } from 'react'
import { isMissingSupabaseTableError } from '../lib/supabaseErrors'
import { supabase } from '../lib/supabase'
import { useBrandId } from './useBrandId'
import type { NetzwerkEintrag } from '../cockpit/lib/funnelStufen'

/**
 * Kevins LinkedIn-Netzwerk aus `linkedin_netzwerk` (Migration 0070).
 *
 * Gesendete Einladungen und angenommene Kontakte — die Grundlage für zwei der
 * fünf Funnel-Stufen. Geschrieben wird das ausschliesslich vom Runner
 * (`runner/linkedin/netzwerkUpsert.mjs`); die App liest nur.
 *
 * **`letzterVollerEinladungsLauf` ist das wichtigste Feld hier.** Es sagt, ob
 * die InMail-Kandidaten belastbar sind: nur wer im letzten vollständig
 * gelesenen Einladungs-Lauf noch zu sehen war, gilt als „hat nicht
 * angenommen". Abgeleitet wird es aus dem jüngsten `zuletzt_gesehen_at` der
 * offenen Einträge — ein vollständiger Lauf stempelt alle gleichzeitig, ein
 * abgebrochener lässt den Rest auf einem älteren Stand stehen. Liegt der
 * jüngste Stempel weit vor dem Rest, war der letzte Lauf unvollständig; genau
 * das drückt `unvollstaendig` aus.
 */
export interface UseLinkedinNetzwerkResult {
  items: NetzwerkEintrag[]
  loading: boolean
  tableMissing: boolean
  error: string | null
  /** ISO-Zeitpunkt des jüngsten Einladungs-Laufs, oder null. */
  letzterVollerEinladungsLauf: string | null
  /** Wie viele offene Einladungen diesen jüngsten Stempel tragen. */
  frischGesehen: number
  reload: () => Promise<void>
}

/**
 * Wie nah beieinander die Zeitstempel eines Laufs liegen dürfen.
 *
 * Ein Lauf schreibt alle seine Zeilen mit demselben Stempel — durch die
 * Stapel-Requests können ein paar Sekunden dazwischenliegen. Fünf Minuten
 * Toleranz fassen jeden realen Lauf (der längste dauerte vier) und trennen ihn
 * sauber vom vorherigen.
 */
const LAUF_FENSTER_MS = 5 * 60 * 1000

export function useLinkedinNetzwerk(brandSlug: string | undefined): UseLinkedinNetzwerkResult {
  const brandId = useBrandId(brandSlug)
  const [items, setItems] = useState<NetzwerkEintrag[]>([])
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

    /**
     * Seitenweise laden — sonst fehlt der halbe Trichter.
     *
     * PostgREST deckelt eine Antwort bei 1.000 Zeilen. Kevins Netzwerk hat
     * mehr (630 Kontakte + 876 offene Einladungen), und das Limit greift
     * still: die App bekam eine plausible Liste, in der schlicht 500 Leute
     * fehlten — am 12.08. gemessen, die InMail-Kachel zeigte 370 statt 876.
     */
    const alle: NetzwerkEintrag[] = []
    const SEITE = 1000
    for (let von = 0; ; von += SEITE) {
      const { data, error: err } = await supabase
        .from('linkedin_netzwerk')
        .select('*')
        .eq('brand_id', brandId)
        .order('profil_key', { ascending: true })
        .range(von, von + SEITE - 1)

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
      const stapel = (data ?? []) as NetzwerkEintrag[]
      alle.push(...stapel)
      if (stapel.length < SEITE) break
    }

    setTableMissing(false)
    setError(null)
    setItems(alle)
    setLoading(false)
  }, [brandId])

  useEffect(() => {
    void reload()
  }, [reload])

  const offene = items.filter((e) => e.status === 'offen')
  const juengster = offene.reduce<string | null>((max, e) => {
    const t = e.zuletzt_gesehen_at
    return !max || String(t) > max ? String(t) : max
  }, null)

  // Alles, was im selben Zeitfenster gestempelt wurde, gehört zu diesem Lauf.
  const grenze = juengster ? new Date(juengster).getTime() - LAUF_FENSTER_MS : 0
  const frischGesehen = juengster
    ? offene.filter((e) => new Date(e.zuletzt_gesehen_at).getTime() >= grenze).length
    : 0

  return {
    items,
    loading,
    tableMissing,
    error,
    // Der Stempel des Laufs ist sein ÄLTESTER Eintrag im Fenster — die Filter
    // in `inmailKandidaten` vergleichen mit `>=`, und der jüngste Stempel würde
    // die früh geschriebenen Stapel desselben Laufs ausschliessen.
    letzterVollerEinladungsLauf: juengster ? new Date(grenze).toISOString() : null,
    frischGesehen,
    reload,
  }
}
