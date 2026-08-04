import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useBrandId } from './useBrandId'

/**
 * Kundennachrichten über ALLE Projekte einer Marke — die Owner-Seite von
 * `project_messages`.
 *
 * Lag seit dem Abriss der alten Brand-Oberfläche ohne Oberfläche da; seit
 * Etappe 4/3 trägt der Hook den Kunden-Posteingang in /freigaben, den Zähler
 * auf der ProjectCard und die Zeile im Heute-Deck.
 *
 * `read_at` IST das Erledigt-Flag: Es gibt kein zweites Statusfeld, und dieselbe
 * Bedingung (sender_role='client' AND read_at IS NULL) definiert überall
 * „liegt noch an". Deshalb wird hier NICHT beim Laden gelesen-markiert — das
 * würde die Warteschlange beim Öffnen von /freigaben leeren.
 */

export interface GlobalMessageRow {
  id: string
  project_id: string
  project_name: string
  sender_name: string | null
  body: string
  created_at: string
  read_at: string | null
}

export interface ProjektKurz {
  id: string
  name: string
}

const LIMIT = 60

export function useGlobalMessages(brandSlug: string | undefined) {
  const brandId = useBrandId(brandSlug)
  const [messages, setMessages] = useState<GlobalMessageRow[]>([])
  const [projekte, setProjekte] = useState<ProjektKurz[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!brandId || !supabase) {
      setMessages([])
      setProjekte([])
      setLoading(false)
      return
    }

    setLoading(true)

    const { data: projectRows, error: projErr } = await supabase
      .from('deliver_projects')
      .select('id, name')
      .eq('owner_brand_id', brandId)
      .is('deleted_at', null)

    if (projErr) {
      setError(projErr.message)
      setMessages([])
      setProjekte([])
      setLoading(false)
      return
    }

    const liste: ProjektKurz[] = (projectRows ?? []).map((p) => ({
      id: String(p.id),
      name: String(p.name ?? 'Projekt'),
    }))
    setProjekte(liste)

    if (liste.length === 0) {
      setMessages([])
      setError(null)
      setLoading(false)
      return
    }

    const nameById = new Map(liste.map((p) => [p.id, p.name]))

    const { data, error: err } = await supabase
      .from('project_messages')
      .select('id, project_id, sender_name, body, created_at, read_at')
      .in('project_id', liste.map((p) => p.id))
      .eq('sender_role', 'client')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(LIMIT)

    if (err) {
      setError(err.message)
      setMessages([])
    } else {
      setError(null)
      setMessages(
        (data ?? []).map((r) => ({
          id: String(r.id),
          project_id: String(r.project_id),
          project_name: nameById.get(String(r.project_id)) ?? 'Projekt',
          sender_name: typeof r.sender_name === 'string' ? r.sender_name : null,
          body: String(r.body ?? ''),
          created_at: String(r.created_at ?? ''),
          read_at: typeof r.read_at === 'string' ? r.read_at : null,
        })),
      )
    }
    setLoading(false)
  }, [brandId])

  useEffect(() => {
    void reload()
    const interval = window.setInterval(() => void reload(), 60_000)
    return () => window.clearInterval(interval)
  }, [reload])

  /** Eine Nachricht abhaken. Der bewusste Klick, nicht das Öffnen der Seite. */
  const markRead = useCallback(async (messageId: string) => {
    if (!supabase) return
    const now = new Date().toISOString()
    // Optimistisch: der Haken soll sofort sitzen, auch bei träger Verbindung.
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, read_at: now } : m)))
    const { error: err } = await supabase
      .from('project_messages')
      .update({ read_at: now })
      .eq('id', messageId)
      .is('read_at', null)
    if (err) {
      setError(err.message)
      await reload()
    }
  }, [reload])

  /** Ganzen Projekt-Thread abhaken (Projekt-Detail: Kevin hat den Verlauf gelesen). */
  const markProjectRead = useCallback(
    async (projectId: string) => {
      if (!supabase) return
      const now = new Date().toISOString()
      setMessages((prev) =>
        prev.map((m) => (m.project_id === projectId && !m.read_at ? { ...m, read_at: now } : m)),
      )
      const { error: err } = await supabase
        .from('project_messages')
        .update({ read_at: now })
        .eq('project_id', projectId)
        .eq('sender_role', 'client')
        .is('read_at', null)
        .is('deleted_at', null)
      if (err) {
        setError(err.message)
        await reload()
      }
    },
    [reload],
  )

  const ungelesen = useMemo(() => messages.filter((m) => !m.read_at), [messages])

  return {
    messages,
    ungelesen,
    projekte,
    unreadCount: ungelesen.length,
    loading,
    error,
    reload,
    markRead,
    markProjectRead,
  }
}
