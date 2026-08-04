import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { gibSiteContentFrei, verwirfSiteContentEntwurf } from '../lib/siteContentService'

/**
 * Website-CMS (Migration 0052): feste Text-/Bild-Felder je Projekt.
 * Kunde speichert Entwürfe (value_draft, Trigger setzt status=pending),
 * Owner gibt frei (draft → published). RLS regelt beide Seiten.
 */

export interface SiteContentField {
  id: string
  project_id: string
  field_key: string
  section: string
  label: string
  field_type: 'text' | 'textarea' | 'image'
  value_published: string | null
  value_draft: string | null
  status: 'published' | 'pending'
  sort_order: number
  draft_updated_at: string | null
  published_at: string | null
}

export interface SiteContentFieldDef {
  field_key: string
  section: string
  label: string
  field_type: SiteContentField['field_type']
  sort_order?: number
  value_published?: string
}

interface UseSiteContentResult {
  fields: SiteContentField[]
  /** nach section gruppiert, sortiert */
  sections: Array<{ section: string; fields: SiteContentField[] }>
  pending: SiteContentField[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  /** Kunde/Owner: Entwurf speichern */
  saveDraft: (fieldId: string, value: string) => Promise<void>
  /** Owner: Entwurf freigeben (draft → published) */
  approve: (fieldIds: string[]) => Promise<void>
  /** Owner: Entwurf verwerfen (draft ← published) */
  discardDraft: (fieldId: string) => Promise<void>
  /** Owner: neue Felder anlegen */
  seedFields: (defs: SiteContentFieldDef[]) => Promise<void>
  /** Owner: Feld löschen */
  removeField: (fieldId: string) => Promise<void>
}

export function useSiteContent(projectId: string | undefined): UseSiteContentResult {
  const [fields, setFields] = useState<SiteContentField[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!projectId || !supabase) {
      setFields([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('site_content')
      .select('*')
      .eq('project_id', projectId)
      .order('section', { ascending: true })
      .order('sort_order', { ascending: true })
    if (err) {
      // Tabelle fehlt (Migration 0052 nicht ausgeführt) → leer, kein Crash
      if (!/relation .* does not exist/i.test(err.message)) setError(err.message)
      setFields([])
    } else {
      setFields((data ?? []) as SiteContentField[])
      setError(null)
    }
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    void reload()
  }, [reload])

  const saveDraft = useCallback(
    async (fieldId: string, value: string) => {
      if (!supabase) return
      // Optimistisch; Status setzt DB-seitig der Trigger (Client) bzw. bleibt
      // owner-seitig konsistent, weil wir ihn hier mitschreiben.
      setFields((cur) =>
        cur.map((f) =>
          f.id === fieldId
            ? {
                ...f,
                value_draft: value,
                status: value !== (f.value_published ?? '') ? 'pending' : 'published',
              }
            : f,
        ),
      )
      const { error: err } = await supabase
        .from('site_content')
        .update({ value_draft: value })
        .eq('id', fieldId)
      if (err) {
        setError(err.message)
        await reload()
      }
    },
    [reload],
  )

  const approve = useCallback(
    async (fieldIds: string[]) => {
      if (fieldIds.length === 0) return
      for (const id of fieldIds) {
        const f = fields.find((x) => x.id === id)
        if (!f) continue
        // Gemeinsamer Pfad mit dem Kunden-Posteingang (siteContentService).
        const res = await gibSiteContentFrei(id, f.value_draft)
        if (!res.ok) setError(res.error)
      }
      await reload()
    },
    [fields, reload],
  )

  const discardDraft = useCallback(
    async (fieldId: string) => {
      const f = fields.find((x) => x.id === fieldId)
      if (!f) return
      const res = await verwirfSiteContentEntwurf(fieldId, f.value_published)
      if (!res.ok) setError(res.error)
      await reload()
    },
    [fields, reload],
  )

  const seedFields = useCallback(
    async (defs: SiteContentFieldDef[]) => {
      if (!supabase || !projectId || defs.length === 0) return
      const rows = defs.map((d, i) => ({
        project_id: projectId,
        field_key: d.field_key,
        section: d.section,
        label: d.label,
        field_type: d.field_type,
        sort_order: d.sort_order ?? i,
        value_published: d.value_published ?? null,
        value_draft: d.value_published ?? null,
      }))
      const { error: err } = await supabase
        .from('site_content')
        .upsert(rows, { onConflict: 'project_id,field_key', ignoreDuplicates: true })
      if (err) setError(err.message)
      await reload()
    },
    [projectId, reload],
  )

  const removeField = useCallback(
    async (fieldId: string) => {
      if (!supabase) return
      const { error: err } = await supabase.from('site_content').delete().eq('id', fieldId)
      if (err) setError(err.message)
      await reload()
    },
    [reload],
  )

  const sections = useMemo(() => {
    const map = new Map<string, SiteContentField[]>()
    for (const f of fields) {
      if (!map.has(f.section)) map.set(f.section, [])
      map.get(f.section)!.push(f)
    }
    return [...map.entries()].map(([section, sectionFields]) => ({ section, fields: sectionFields }))
  }, [fields])

  const pending = useMemo(() => fields.filter((f) => f.status === 'pending'), [fields])

  return {
    fields,
    sections,
    pending,
    loading,
    error,
    reload,
    saveDraft,
    approve,
    discardDraft,
    seedFields,
    removeField,
  }
}
