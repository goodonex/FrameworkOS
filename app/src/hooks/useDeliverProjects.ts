import { useCallback, useEffect, useRef, useState } from 'react'
import { logActivity } from '../lib/activityLog'
import {
  deliverProjectToInsertRow,
  deliverProjectToUpdateRow,
  emptyTiptapDoc,
  normalizeDeliverProject,
  rowRecordToDeliverProject,
} from '../lib/deliverProjectCoercion'
import { generateId } from '../lib/storage'
import { supabase } from '../lib/supabase'
import type { DeliverProject } from '../types/db'
import { useBrandIdStatus } from './useBrandId'

interface UseDeliverProjectsResult {
  items: DeliverProject[]
  loading: boolean
  error: string | null
  create: (
    partial?: Partial<Omit<DeliverProject, 'id' | 'brand_id' | 'updated_at'>>,
  ) => Promise<DeliverProject>
  update: (
    id: string,
    patch: Partial<Omit<DeliverProject, 'id' | 'brand_id'>>,
  ) => Promise<void>
  remove: (id: string) => Promise<void>
  reload: () => Promise<void>
}

export function useDeliverProjects(brandSlug: string | undefined): UseDeliverProjectsResult {
  const { brandId, pending: brandPending } = useBrandIdStatus(brandSlug)
  const [items, setItems] = useState<DeliverProject[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const itemsRef = useRef<DeliverProject[]>([])
  itemsRef.current = items

  const reload = useCallback(async () => {
    if (!brandSlug) {
      setItems([])
      // Solange die Brands laden, ist „keine Projekte" eine Lüge.
      setLoading(brandPending)
      setError(null)
      return
    }
    if (!supabase || !brandId) {
      setItems([])
      setLoading(brandPending)
      setError(brandPending ? null : 'Supabase nicht konfiguriert')
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('deliver_projects')
      .select('*')
      .eq('owner_brand_id', brandId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })

    if (err) {
      setError(err.message)
      setItems([])
      setLoading(false)
      return
    }
    setError(null)
    setItems(
      (data ?? []).map((r) => rowRecordToDeliverProject(r as Record<string, unknown>)),
    )
    setLoading(false)
  }, [brandId, brandSlug, brandPending])

  useEffect(() => {
    void reload()
  }, [reload])

  const create = useCallback(
    async (
      partial?: Partial<Omit<DeliverProject, 'id' | 'brand_id' | 'updated_at'>>,
    ): Promise<DeliverProject> => {
      if (!brandSlug || !brandId || !supabase) throw new Error('Supabase nicht konfiguriert')
      const now = new Date().toISOString()
      const item = normalizeDeliverProject(
        {
          id: generateId(),
          name: partial?.name ?? 'Neues Projekt',
          client_name: partial?.client_name ?? '',
          client_email: partial?.client_email ?? '',
          client_contact_id: partial?.client_contact_id ?? null,
          status: partial?.status ?? 'active',
          internal_stage: partial?.internal_stage,
          client_stage: partial?.client_stage,
          internal_notes_doc: partial?.internal_notes_doc ?? emptyTiptapDoc(),
          internal_file_links: partial?.internal_file_links,
          team_notes: partial?.team_notes ?? '',
          client_welcome_text: partial?.client_welcome_text ?? '',
          client_documents: partial?.client_documents,
          deliverables: partial?.deliverables,
          booking_url: partial?.booking_url,
          updated_at: now,
        },
        brandId,
      )

      const row = deliverProjectToInsertRow(item, brandId)
      const { error: insErr } = await supabase.from('deliver_projects').insert(row)
      if (insErr) {
        setError(insErr.message)
        throw new Error(insErr.message)
      }

      setItems((prev) => [item, ...prev])
      if (item.client_contact_id) {
        await supabase
          .from('contacts')
          .update({ deliver_project_id: item.id, updated_at: now })
          .eq('id', item.client_contact_id)
      }
      logActivity({
        brand_id: brandId,
        entity_type: 'project',
        entity_id: item.id,
        action: 'created',
        summary: `Neues Projekt: ${item.name}${item.client_name ? ' · ' + item.client_name : ''}`,
        metadata: { stage: item.internal_stage },
      })
      return item
    },
    [brandId, brandSlug],
  )

  const update = useCallback(
    async (id: string, patch: Partial<Omit<DeliverProject, 'id' | 'brand_id'>>) => {
      if (!brandSlug || !brandId || !supabase) return

      const { data: currentRow, error: fetchErr } = await supabase
        .from('deliver_projects')
        .select('*')
        .eq('id', id)
        .eq('owner_brand_id', brandId)
        .is('deleted_at', null)
        .maybeSingle()

      if (fetchErr || !currentRow) {
        setError(fetchErr?.message ?? 'Projekt nicht gefunden')
        return
      }

      const prev = rowRecordToDeliverProject(currentRow as Record<string, unknown>)
      const now = new Date().toISOString()
      const merged = normalizeDeliverProject({ ...prev, ...patch, updated_at: now }, prev.brand_id)
      const row = deliverProjectToUpdateRow(patch, now)

      const { error: updErr } = await supabase
        .from('deliver_projects')
        .update(row)
        .eq('id', id)
        .eq('owner_brand_id', brandId)
        .is('deleted_at', null)

      if (updErr) {
        setError(updErr.message)
        await reload()
        return
      }

      setItems((prevItems) => prevItems.map((p) => (p.id === id ? merged : p)))

      if (patch.internal_stage && patch.internal_stage !== prev.internal_stage) {
        logActivity({
          brand_id: brandId,
          entity_type: 'project',
          entity_id: id,
          action: 'stage_changed',
          summary: `${prev.name}: ${prev.internal_stage.replace(/_/g, ' ')} → ${patch.internal_stage.replace(/_/g, ' ')}`,
          metadata: { from: prev.internal_stage, to: patch.internal_stage },
        })
      }
      if (patch.status && patch.status !== prev.status) {
        logActivity({
          brand_id: brandId,
          entity_type: 'project',
          entity_id: id,
          action: patch.status === 'completed' ? 'completed' : 'updated',
          summary: `${prev.name} ${patch.status === 'completed' ? 'abgeschlossen' : 'reaktiviert'}`,
        })
      }
    },
    [brandId, brandSlug, reload],
  )

  const remove = useCallback(
    async (id: string) => {
      if (!brandSlug || !brandId || !supabase) return
      const prev = itemsRef.current.find((p) => p.id === id)
      const now = new Date().toISOString()
      const { error: delErr } = await supabase
        .from('deliver_projects')
        .update({ deleted_at: now, updated_at: now })
        .eq('id', id)
        .eq('owner_brand_id', brandId)
        .is('deleted_at', null)

      if (delErr) {
        setError(delErr.message)
        throw new Error(delErr.message)
      }

      await supabase
        .from('contacts')
        .update({ deliver_project_id: null, updated_at: now })
        .eq('deliver_project_id', id)
        .eq('brand_id', brandId)

      setItems((prev) => prev.filter((p) => p.id !== id))
      if (prev) {
        logActivity({
          brand_id: brandId,
          entity_type: 'project',
          entity_id: id,
          action: 'archived',
          summary: `Projekt gelöscht: ${prev.name}`,
        })
      }
    },
    [brandId, brandSlug],
  )

  return { items, loading, error, create, update, remove, reload }
}

/** @deprecated Preview-only — Supabase ist Single Source of Truth */
export function readDeliverProjectsLocal(_brandSlug: string): DeliverProject[] {
  return []
}
