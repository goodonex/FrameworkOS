import { useCallback, useEffect, useMemo, useState } from 'react'
import { isMissingSupabaseTableError } from '../lib/supabaseErrors'
import { supabase } from '../lib/supabase'
import { useBrandId } from './useBrandId'
import type { Lead, LeadEreignis, LeadEreignisTyp, LeadStatus } from '../types/db'

/**
 * Leads und ihre Ereignisse aus 0076.
 *
 * Anders als die LinkedIn-Spiegel wird hier **auch geschrieben** — das ist die
 * eine Tabelle, die Kevin selbst pflegt: Wiedervorlage, Aussortieren,
 * Markieren, Notiz. Der Runner fasst sie nur an, um fehlende Leads anzulegen
 * und Ereignisse fortzuschreiben (`scripts/leads-sync.ts`).
 *
 * **Ereignisse werden nie geändert, nur angehängt.** Eine Korrektur ist ein
 * neues Ereignis. Deshalb gibt es hier kein `updateEreignis` — mit Absicht.
 */
export interface UseLeadsResult {
  leads: Lead[]
  ereignisse: LeadEreignis[]
  /** Ereignisse je Lead, absteigend nach Zeit — der Zeitstrahl der Lead-Akte. */
  ereignisseJeLead: Map<string, LeadEreignis[]>
  loading: boolean
  tableMissing: boolean
  error: string | null
  reload: () => Promise<void>
  setzeStatus: (leadId: string, status: LeadStatus, extra?: Partial<Lead>) => Promise<void>
  setzeWiedervorlage: (leadId: string, datum: string, grund: string) => Promise<void>
  disqualifiziere: (leadId: string, grund: string) => Promise<void>
  reaktiviere: (leadId: string) => Promise<void>
  markiere: (leadId: string, markiert: boolean) => Promise<void>
  speichereNotiz: (leadId: string, notiz: string) => Promise<void>
  /** Einen erledigten Arbeitsschritt festhalten — der Kern des Tagesjournals. */
  protokolliere: (leadId: string, typ: LeadEreignisTyp, details?: Record<string, unknown>) => Promise<void>
}

const SEITE = 1000

export function useLeads(brandSlug: string | undefined): UseLeadsResult {
  const brandId = useBrandId(brandSlug)
  const [leads, setLeads] = useState<Lead[]>([])
  const [ereignisse, setEreignisse] = useState<LeadEreignis[]>([])
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Seitenweise laden, ausnahmslos. PostgREST deckelt bei 1.000 Zeilen, und
   * Kevin hat 1.693 Leads und über 2.000 Ereignisse — ohne Blättern fehlt
   * schlicht die Hälfte, ohne dass irgendwo ein Fehler auftaucht.
   */
  const ladeAlle = useCallback(
    async <T,>(tabelle: string, sortSpalte: string): Promise<T[] | 'fehlt' | null> => {
      if (!supabase || !brandId) return []
      const alle: T[] = []
      for (let von = 0; ; von += SEITE) {
        const { data, error: err } = await supabase
          .from(tabelle)
          .select('*')
          .eq('brand_id', brandId)
          .order(sortSpalte, { ascending: true })
          .range(von, von + SEITE - 1)
        if (err) {
          if (isMissingSupabaseTableError(err.message)) return 'fehlt'
          setError(err.message)
          return null
        }
        const stapel = (data ?? []) as T[]
        alle.push(...stapel)
        if (stapel.length < SEITE) break
      }
      return alle
    },
    [brandId],
  )

  const reload = useCallback(async () => {
    if (!supabase || !brandId) {
      setLeads([])
      setEreignisse([])
      setLoading(false)
      return
    }
    setLoading(true)

    const geladeneLeads = await ladeAlle<Lead>('leads', 'name')
    if (geladeneLeads === 'fehlt') {
      setTableMissing(true)
      setLeads([])
      setEreignisse([])
      setError(null)
      setLoading(false)
      return
    }
    if (geladeneLeads === null) {
      setLoading(false)
      return
    }

    const geladeneEreignisse = await ladeAlle<LeadEreignis>('lead_ereignisse', 'at')
    setTableMissing(false)
    setError(null)
    setLeads(geladeneLeads)
    setEreignisse(Array.isArray(geladeneEreignisse) ? geladeneEreignisse : [])
    setLoading(false)
  }, [brandId, ladeAlle])

  useEffect(() => {
    void reload()
  }, [reload])

  const ereignisseJeLead = useMemo(() => {
    const karte = new Map<string, LeadEreignis[]>()
    for (const e of ereignisse) {
      const liste = karte.get(e.lead_id)
      if (liste) liste.push(e)
      else karte.set(e.lead_id, [e])
    }
    for (const liste of karte.values()) {
      liste.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    }
    return karte
  }, [ereignisse])

  /** Ein Ereignis anhängen — lokal sofort sichtbar, damit die Liste nicht ruckelt. */
  const protokolliere = useCallback(
    async (leadId: string, typ: LeadEreignisTyp, details: Record<string, unknown> = {}) => {
      if (!supabase || !brandId) return
      const at = new Date().toISOString()
      const { data, error: err } = await supabase
        .from('lead_ereignisse')
        .insert({ brand_id: brandId, lead_id: leadId, typ, at, quelle: 'ui', details })
        .select()
        .maybeSingle()
      if (err) {
        setError(err.message)
        return
      }
      if (data) setEreignisse((alt) => [...alt, data as LeadEreignis])
    },
    [brandId],
  )

  const aendere = useCallback(
    async (leadId: string, felder: Partial<Lead>) => {
      if (!supabase) return
      const mitStempel = { ...felder, updated_at: new Date().toISOString() }
      const { error: err } = await supabase.from('leads').update(mitStempel).eq('id', leadId)
      if (err) {
        setError(err.message)
        return
      }
      setLeads((alt) => alt.map((l) => (l.id === leadId ? { ...l, ...mitStempel } : l)))
    },
    [],
  )

  const setzeStatus = useCallback(
    async (leadId: string, status: LeadStatus, extra: Partial<Lead> = {}) => {
      await aendere(leadId, { lead_status: status, ...extra })
    },
    [aendere],
  )

  const setzeWiedervorlage = useCallback(
    async (leadId: string, datum: string, grund: string) => {
      await aendere(leadId, { lead_status: 'wiedervorlage', wiedervorlage_am: datum, wiedervorlage_grund: grund })
      await protokolliere(leadId, 'wiedervorlage_gesetzt', { datum, grund })
    },
    [aendere, protokolliere],
  )

  const disqualifiziere = useCallback(
    async (leadId: string, grund: string) => {
      await aendere(leadId, { lead_status: 'disqualifiziert', disqualifiziert_grund: grund })
      await protokolliere(leadId, 'disqualifiziert', { grund })
    },
    [aendere, protokolliere],
  )

  const reaktiviere = useCallback(
    async (leadId: string) => {
      await aendere(leadId, {
        lead_status: 'aktiv',
        wiedervorlage_am: null,
        wiedervorlage_grund: '',
        disqualifiziert_grund: '',
      })
      await protokolliere(leadId, 'reaktiviert')
    },
    [aendere, protokolliere],
  )

  const markiere = useCallback(
    async (leadId: string, markiert: boolean) => aendere(leadId, { markiert }),
    [aendere],
  )

  const speichereNotiz = useCallback(
    async (leadId: string, notiz: string) => {
      await aendere(leadId, { notiz })
      if (notiz.trim()) await protokolliere(leadId, 'notiz', { auszug: notiz.slice(0, 200) })
    },
    [aendere, protokolliere],
  )

  return {
    leads,
    ereignisse,
    ereignisseJeLead,
    loading,
    tableMissing,
    error,
    reload,
    setzeStatus,
    setzeWiedervorlage,
    disqualifiziere,
    reaktiviere,
    markiere,
    speichereNotiz,
    protokolliere,
  }
}
