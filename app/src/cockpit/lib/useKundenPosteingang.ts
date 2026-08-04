import { useCallback, useEffect, useMemo, useState } from 'react'
import { useGlobalMessages } from '../../hooks/useGlobalMessages'
import { supabase } from '../../lib/supabase'
import { sendeProjektNachricht } from '../../lib/projectMessageService'
import { gibSiteContentFrei, verwirfSiteContentEntwurf } from '../../lib/siteContentService'
import { ordnePosteingang, zaehleJeProjekt, zaehleNachrichten, type PosteingangEintrag } from './posteingang'

/**
 * Der Kunden-Posteingang: alles, was von Kundenseite auf Kevin wartet, in EINER
 * Warteschlange (Etappe 4, Schritt 3).
 *
 * Setzt auf `useGlobalMessages` auf (Nachrichten über alle Projekte) und ergänzt
 * nur, was dort fehlte: die eingereichten Website-Änderungen aus `site_content`
 * (status='pending'). Beides zusammen, nach Wartezeit sortiert.
 *
 * Kein Schreibpfad wohnt hier: Antworten geht über `projectMessageService`,
 * Freigeben über `siteContentService` — dieselben Funktionen, die auch das
 * Portal bzw. der Projekt-Editor benutzen.
 */

interface SiteContentPendingRow {
  id: string
  project_id: string
  label: string
  section: string
  value_published: string | null
  value_draft: string | null
  draft_updated_at: string | null
}

export function useKundenPosteingang(brandSlug: string | undefined) {
  const nachrichten = useGlobalMessages(brandSlug)
  const { projekte, reload: reloadNachrichten } = nachrichten

  const [website, setWebsite] = useState<SiteContentPendingRow[]>([])
  const [websiteFehler, setWebsiteFehler] = useState<string | null>(null)

  // Stabiler Schlüssel — sonst feuert der Effekt bei jedem Render neu, weil
  // `projekte` ein frisches Array ist.
  const projektIds = useMemo(() => projekte.map((p) => p.id).sort().join(','), [projekte])

  const reloadWebsite = useCallback(async () => {
    const ids = projektIds ? projektIds.split(',') : []
    if (!supabase || ids.length === 0) {
      setWebsite([])
      return
    }
    const { data, error } = await supabase
      .from('site_content')
      .select('id, project_id, label, section, value_published, value_draft, draft_updated_at')
      .in('project_id', ids)
      .eq('status', 'pending')
      .order('draft_updated_at', { ascending: true })

    if (error) {
      // Tabelle fehlt (Migration 0052 nicht gelaufen) → leer statt Fehlerbanner,
      // gleiche Nachsicht wie in useSiteContent.
      if (!/relation .* does not exist/i.test(error.message)) setWebsiteFehler(error.message)
      setWebsite([])
      return
    }
    setWebsiteFehler(null)
    setWebsite((data ?? []) as SiteContentPendingRow[])
  }, [projektIds])

  useEffect(() => {
    void reloadWebsite()
  }, [reloadWebsite])

  const projektName = useCallback(
    (id: string) => projekte.find((p) => p.id === id)?.name ?? 'Projekt',
    [projekte],
  )

  const eintraege = useMemo<PosteingangEintrag[]>(() => {
    const ausNachrichten: PosteingangEintrag[] = nachrichten.ungelesen.map((m) => ({
      id: m.id,
      art: 'nachricht',
      projektId: m.project_id,
      projektName: m.project_name,
      titel: m.sender_name?.trim() || m.project_name,
      seit: m.created_at,
      text: m.body,
      alt: null,
      neu: null,
      bereich: null,
    }))

    const ausWebsite: PosteingangEintrag[] = website.map((f) => ({
      id: f.id,
      art: 'website',
      projektId: f.project_id,
      projektName: projektName(f.project_id),
      titel: f.label,
      seit: f.draft_updated_at ?? '',
      text: null,
      alt: f.value_published,
      neu: f.value_draft,
      bereich: f.section,
    }))

    return ordnePosteingang([...ausNachrichten, ...ausWebsite])
  }, [nachrichten.ungelesen, website, projektName])

  const jeProjekt = useMemo(() => zaehleJeProjekt(eintraege), [eintraege])
  const nachrichtenAnzahl = useMemo(() => zaehleNachrichten(eintraege), [eintraege])

  /** Antwort an den Kunden — landet im Portal und löst die Benachrichtigung aus. */
  const antworte = useCallback(
    async (projektId: string, text: string, senderName: string) => {
      const res = await sendeProjektNachricht({
        projectId: projektId,
        senderRole: 'owner',
        senderName,
        body: text,
      })
      return res
    },
    [],
  )

  const hakeNachrichtAb = useCallback(
    (messageId: string) => nachrichten.markRead(messageId),
    [nachrichten],
  )

  const gibWebsiteFrei = useCallback(
    async (eintrag: PosteingangEintrag) => {
      const res = await gibSiteContentFrei(eintrag.id, eintrag.neu)
      await reloadWebsite()
      return res
    },
    [reloadWebsite],
  )

  const verwirfWebsite = useCallback(
    async (eintrag: PosteingangEintrag) => {
      const res = await verwirfSiteContentEntwurf(eintrag.id, eintrag.alt)
      await reloadWebsite()
      return res
    },
    [reloadWebsite],
  )

  const reload = useCallback(async () => {
    await Promise.all([reloadNachrichten(), reloadWebsite()])
  }, [reloadNachrichten, reloadWebsite])

  return {
    eintraege,
    jeProjekt,
    nachrichtenAnzahl,
    loading: nachrichten.loading,
    error: nachrichten.error ?? websiteFehler,
    reload,
    antworte,
    hakeNachrichtAb,
    gibWebsiteFrei,
    verwirfWebsite,
  }
}
