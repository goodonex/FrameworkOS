import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { logActivity } from '../lib/activityLog'
import { useSaveStatus } from '../lib/saveStatusContext'
import {
  clearContactFollowUpRemote,
  shouldClearContactFollowUp,
} from '../lib/contactFollowUpSync'
import { readContactsLocal } from './useContacts'
import { generateId, loadList, saveList } from '../lib/storage'
import {
  isMissingSupabaseTableError,
  shouldFallbackToLocalSupabase,
} from '../lib/supabaseErrors'
import { supabase } from '../lib/supabase'
import type { Task, TaskPriority, TaskSource, TaskStatus } from '../types/db'
import { useBrandIdStatus } from './useBrandId'

const STORAGE_KEY = 'tasks' as const

export interface CreateTaskInput {
  title: string
  notes?: string
  due_at?: string | null
  contact_id?: string | null
  project_id?: string | null
  status?: TaskStatus
  priority?: TaskPriority
  source?: TaskSource
}

interface UseTasksResult {
  items: Task[]
  loading: boolean
  error: string | null
  create: (input: CreateTaskInput) => Task
  update: (id: string, patch: Partial<Omit<Task, 'id' | 'brand_id'>>) => void
  toggle: (id: string) => void
  remove: (id: string) => void
  reload: () => Promise<void>
}

function isTaskStatus(x: unknown): x is TaskStatus {
  return x === 'open' || x === 'in_progress' || x === 'done' || x === 'cancelled'
}
function isTaskPriority(x: unknown): x is TaskPriority {
  return x === 1 || x === 2 || x === 3
}
function isTaskSource(x: unknown): x is TaskSource {
  return (
    x === 'manual' ||
    x === 'follow_up' ||
    x === 'system' ||
    x === 'onboarding' ||
    x === 'brief_task'
  )
}

function rowToTask(row: Record<string, unknown>, fallbackBrand: string): Task {
  return {
    id: typeof row.id === 'string' ? row.id : generateId(),
    brand_id: typeof row.brand_id === 'string' ? row.brand_id : fallbackBrand,
    contact_id: typeof row.contact_id === 'string' ? row.contact_id : null,
    project_id: typeof row.project_id === 'string' ? row.project_id : null,
    title: typeof row.title === 'string' ? row.title : '',
    notes: typeof row.notes === 'string' ? row.notes : '',
    due_at: typeof row.due_at === 'string' ? row.due_at : null,
    status: isTaskStatus(row.status) ? row.status : 'open',
    priority: isTaskPriority(row.priority) ? row.priority : 2,
    source: isTaskSource(row.source) ? row.source : 'manual',
    completed_at: typeof row.completed_at === 'string' ? row.completed_at : null,
    created_at:
      typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
    updated_at:
      typeof row.updated_at === 'string' ? row.updated_at : new Date().toISOString(),
  }
}

function readLocal(brandSlug: string): Task[] {
  return loadList<unknown>([brandSlug, STORAGE_KEY])
    .map((x) => (x && typeof x === 'object' ? rowToTask(x as Record<string, unknown>, brandSlug) : null))
    .filter((x): x is Task => x !== null)
}

function persistLocal(brandSlug: string, items: Task[]): void {
  saveList([brandSlug, STORAGE_KEY], items)
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )
}

function taskToRemoteRow(task: Task, brandId: string, id = task.id): Record<string, unknown> {
  return {
    id,
    brand_id: brandId,
    title: task.title,
    notes: task.notes ?? '',
    due_at: task.due_at,
    status: task.status,
    priority: task.priority,
    source: task.source,
    completed_at: task.completed_at,
    contact_id: task.contact_id,
    project_id: task.project_id,
  }
}

/** Update; wenn Zeile fehlt (nur lokal angelegt) → Upsert. */
async function writeTaskToSupabase(
  brandId: string,
  task: Task,
  taskId: string,
): Promise<{ ok: true } | { ok: false; message: string; fallbackLocal: boolean }> {
  const client = supabase
  if (!client) return { ok: false, message: 'Kein Supabase', fallbackLocal: true }

  const write = (payload: Record<string, unknown>) =>
    client
      .from('foundation_tasks')
      .update(payload)
      .eq('id', payload.id as string)
      .select('id')
      .maybeSingle()
      .then(async (upd) => {
        if (upd.error) return upd
        if (upd.data) return upd
        return client
          .from('foundation_tasks')
          .upsert(payload, { onConflict: 'id' })
          .select('id')
          .maybeSingle()
      })

  let payload = taskToRemoteRow(task, brandId, taskId)
  let res = await write(payload)

  if (!res.error && res.data) return { ok: true }

  const msg = res.error?.message ?? ''
  if (msg && shouldFallbackToLocalSupabase(msg)) {
    if (payload.contact_id) {
      payload = { ...payload, contact_id: null }
      res = await write(payload)
      if (!res.error && res.data) return { ok: true }
      if (res.error && shouldFallbackToLocalSupabase(res.error.message)) {
        return { ok: false, message: res.error.message, fallbackLocal: true }
      }
    } else {
      return { ok: false, message: msg, fallbackLocal: true }
    }
  }

  if (isMissingSupabaseTableError(msg)) {
    return { ok: false, message: msg, fallbackLocal: true }
  }

  return {
    ok: false,
    message: res.error?.message ?? 'Task konnte nicht gespeichert werden',
    fallbackLocal: false,
  }
}

function sortTasks(list: Task[]): Task[] {
  const order: Record<TaskStatus, number> = { open: 0, in_progress: 0, cancelled: 2, done: 3 }
  return [...list].sort((a, b) => {
    const sa = order[a.status]
    const sb = order[b.status]
    if (sa !== sb) return sa - sb
    const da = a.due_at ? new Date(a.due_at).getTime() : Number.POSITIVE_INFINITY
    const db = b.due_at ? new Date(b.due_at).getTime() : Number.POSITIVE_INFINITY
    if (da !== db) return da - db
    if (a.priority !== b.priority) return a.priority - b.priority
    return b.created_at.localeCompare(a.created_at)
  })
}

export function useTasks(brandSlug: string | undefined): UseTasksResult {
  const { brandId, pending: brandPending } = useBrandIdStatus(brandSlug)
  const [items, setItems] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const itemsRef = useRef<Task[]>([])
  itemsRef.current = items
  const localOnlyRef = useRef(false)
  const saveStatus = useSaveStatus()

  const reload = useCallback(async () => {
    // Brand noch nicht aufgelöst: warten. Würde hier `localOnlyRef` gesetzt,
    // liefe der erste Klick nach dem Laden ins localStorage statt in die DB.
    if (brandPending) {
      setLoading(true)
      return
    }
    if (!brandSlug) {
      setItems([])
      setLoading(false)
      setError(null)
      return
    }
    if (!supabase || !brandId) {
      localOnlyRef.current = true
      setItems(sortTasks(readLocal(brandSlug)))
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)

    // Seitenweise statt `.limit(500)`: gekappt würde ausgerechnet das
    // am längsten Liegengebliebene (Sortierung nach `updated_at` absteigend) —
    // also genau das, was „Kundenarbeit" und „liegt zu lange" finden sollen.
    const rows: Record<string, unknown>[] = []
    const SEITE = 1000
    let ladeFehler: { message: string } | null = null
    for (let von = 0; ; von += SEITE) {
      const { data, error: err } = await supabase
        .from('foundation_tasks')
        .select('*')
        .eq('brand_id', brandId)
        .order('updated_at', { ascending: false })
        .range(von, von + SEITE - 1)
      if (err) {
        ladeFehler = err
        break
      }
      const stapel = (data ?? []) as Record<string, unknown>[]
      rows.push(...stapel)
      if (stapel.length < SEITE) break
    }
    const err = ladeFehler

    if (err && isMissingSupabaseTableError(err.message)) {
      localOnlyRef.current = true
      setItems(sortTasks(readLocal(brandSlug)))
      setLoading(false)
      return
    }
    if (err) {
      setError(err.message)
      setItems(sortTasks(readLocal(brandSlug)))
      setLoading(false)
      return
    }
    localOnlyRef.current = false
    const serverRows = rows.map((r) => rowToTask(r, brandId))
    const localRows = readLocal(brandSlug)
    const byId = new Map<string, Task>()
    for (const r of serverRows) byId.set(r.id, r)
    // Lokal-only oder neuer als Server-Stand (z. B. Toggle noch nicht repliziert)
    for (const l of localRows) {
      const existing = byId.get(l.id)
      if (!existing) {
        byId.set(l.id, l)
        continue
      }
      const lu = new Date(l.updated_at).getTime()
      const su = new Date(existing.updated_at).getTime()
      if (!Number.isNaN(lu) && (Number.isNaN(su) || lu > su)) byId.set(l.id, l)
    }
    persistLocal(brandSlug, Array.from(byId.values()))
    setItems(sortTasks(Array.from(byId.values())))
    setLoading(false)
    setError(null)
  }, [brandId, brandSlug, brandPending])

  useEffect(() => {
    void reload()
  }, [reload])

  const create = useCallback(
    (input: CreateTaskInput): Task => {
      if (!brandSlug) throw new Error('Kein Brand-Slug')
      const now = new Date().toISOString()
      const task: Task = {
        id: generateId(),
        brand_id: localOnlyRef.current ? brandSlug : (brandId ?? brandSlug),
        contact_id: input.contact_id ?? null,
        project_id: input.project_id ?? null,
        title: input.title.trim() || 'Unbenannte Aufgabe',
        notes: input.notes ?? '',
        due_at: input.due_at ?? null,
        status: input.status ?? 'open',
        priority: input.priority ?? 2,
        source: input.source ?? 'manual',
        completed_at: null,
        created_at: now,
        updated_at: now,
      }
      const next = sortTasks([...itemsRef.current, task])
      setItems(next)

      if (localOnlyRef.current || !supabase || !brandId) {
        persistLocal(brandSlug, next)
        saveStatus.markSaved()
        return task
      }

      const endSave = saveStatus.begin()
      void writeTaskToSupabase(brandId, task, task.id).then((result) => {
        if (result.ok) {
          persistLocal(brandSlug, next)
          endSave(true)
          return
        }
        if (result.fallbackLocal) {
          localOnlyRef.current = true
          persistLocal(brandSlug, next)
          endSave(true)
          return
        }
        setError(result.message)
        endSave(false, result.message)
        setItems((cur) => cur.filter((t) => t.id !== task.id))
        persistLocal(
          brandSlug,
          itemsRef.current.filter((t) => t.id !== task.id),
        )
      })
      logActivity({
        brand_id: brandId,
        entity_type: 'task',
        entity_id: task.id,
        action: 'created',
        summary: `Neue Aufgabe: ${task.title}`,
        metadata: {
          contact_id: task.contact_id,
          project_id: task.project_id,
          due_at: task.due_at,
        },
      })
      return task
    },
    [brandId, brandSlug, reload, saveStatus],
  )

  const update = useCallback(
    (id: string, patch: Partial<Omit<Task, 'id' | 'brand_id'>>) => {
      if (!brandSlug) return
      const prev = itemsRef.current.find((t) => t.id === id)
      if (!prev) return
      const now = new Date().toISOString()
      const nextStatus: TaskStatus = patch.status ?? prev.status
      const merged: Task = {
        ...prev,
        ...patch,
        updated_at: now,
        completed_at:
          nextStatus === 'done'
            ? prev.completed_at ?? now
            : patch.status
            ? null
            : prev.completed_at,
      }
      const next = sortTasks(itemsRef.current.map((t) => (t.id === id ? merged : t)))
      setItems(next)
      if (localOnlyRef.current || !supabase || !brandId) {
        if (nextStatus === 'done' && prev.contact_id && brandSlug) {
          const openSiblings = next.filter(
            (t) =>
              t.contact_id === prev.contact_id &&
              t.id !== id &&
              t.status !== 'done' &&
              t.status !== 'cancelled',
          )
          const contactId = prev.contact_id
          const contact = contactId
            ? readContactsLocal(brandSlug).find((c) => c.id === contactId)
            : undefined
          if (contact && contactId && brandId && shouldClearContactFollowUp(contact, prev, openSiblings)) {
            void clearContactFollowUpRemote(brandId, brandSlug, contactId)
          }
        }
        persistLocal(brandSlug, next)
        saveStatus.markSaved()
        return
      }
      const remoteId = isUuid(id) ? id : generateId()
      const mergedForRemote = { ...merged, id: remoteId, brand_id: brandId }
      let nextItems = next
      if (remoteId !== id) {
        nextItems = sortTasks(next.map((t) => (t.id === id ? mergedForRemote : t)))
        setItems(nextItems)
      }
      const openSiblingsAfterDone =
        nextStatus === 'done' && prev.contact_id
          ? nextItems.filter(
              (t) =>
                t.contact_id === prev.contact_id &&
                t.id !== remoteId &&
                t.status !== 'done' &&
                t.status !== 'cancelled',
            )
          : []
      persistLocal(brandSlug, nextItems)
      const endSave = saveStatus.begin()
      void writeTaskToSupabase(brandId, mergedForRemote, remoteId).then((result) => {
        if (result.ok) {
          if (nextStatus === 'done' && prev.contact_id && brandSlug) {
            const doneContactId = prev.contact_id
            const contact = readContactsLocal(brandSlug).find((c) => c.id === doneContactId)
            if (contact && brandId && shouldClearContactFollowUp(contact, prev, openSiblingsAfterDone)) {
              void clearContactFollowUpRemote(brandId, brandSlug, doneContactId)
            }
          }
          endSave(true)
          return
        }
        if (result.fallbackLocal) {
          localOnlyRef.current = true
          endSave(true)
          return
        }
        setError(result.message)
        endSave(false, result.message)
      })

      if (patch.status === 'done' && prev.status !== 'done' && brandId) {
        logActivity({
          brand_id: brandId,
          entity_type: 'task',
          entity_id: id,
          action: 'completed',
          summary: `Aufgabe erledigt: ${prev.title}`,
          metadata: { contact_id: prev.contact_id, project_id: prev.project_id },
        })
      } else if (
        patch.status &&
        patch.status !== 'done' &&
        prev.status === 'done' &&
        brandId
      ) {
        logActivity({
          brand_id: brandId,
          entity_type: 'task',
          entity_id: id,
          action: 'reopened',
          summary: `Aufgabe wieder geöffnet: ${prev.title}`,
        })
      }
    },
    [brandId, brandSlug, reload, saveStatus],
  )

  const toggle = useCallback(
    (id: string) => {
      const prev = itemsRef.current.find((t) => t.id === id)
      if (!prev) return
      update(id, { status: prev.status === 'done' ? 'open' : 'done' })
    },
    [update],
  )

  const remove = useCallback(
    (id: string) => {
      if (!brandSlug) return
      const next = itemsRef.current.filter((t) => t.id !== id)
      setItems(next)
      if (localOnlyRef.current || !supabase || !brandId) {
        persistLocal(brandSlug, next)
        saveStatus.markSaved()
        return
      }
      const endSave = saveStatus.begin()
      void supabase
        .from('foundation_tasks')
        .delete()
        .eq('id', id)
        .eq('brand_id', brandId)
        .then(({ error: delErr }) => {
          if (delErr) {
            if (isMissingSupabaseTableError(delErr.message)) {
              localOnlyRef.current = true
              persistLocal(brandSlug, next)
              endSave(true)
            } else if (shouldFallbackToLocalSupabase(delErr.message)) {
              persistLocal(brandSlug, next)
              endSave(true)
            } else {
              setError(delErr.message)
              endSave(false, delErr.message)
              void reload()
            }
          } else {
            endSave(true)
          }
        })
    },
    [brandId, brandSlug, reload, saveStatus],
  )

  return { items, loading, error, create, update, toggle, remove, reload }
}

function todayMidnight(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function endOfTodayMs(): number {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d.getTime()
}

function endOfWeekMs(): number {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  d.setDate(d.getDate() + 7)
  return d.getTime()
}

export interface TaskBuckets {
  overdue: Task[]
  today: Task[]
  week: Task[]
  later: Task[]
  done: Task[]
}

export function bucketTasks(tasks: Task[]): TaskBuckets {
  const t0 = todayMidnight()
  const t1 = endOfTodayMs()
  const t7 = endOfWeekMs()
  const buckets: TaskBuckets = { overdue: [], today: [], week: [], later: [], done: [] }
  for (const task of tasks) {
    if (task.status === 'done' || task.status === 'cancelled') {
      buckets.done.push(task)
      continue
    }
    if (!task.due_at) {
      buckets.later.push(task)
      continue
    }
    const due = new Date(task.due_at).getTime()
    if (Number.isNaN(due)) {
      buckets.later.push(task)
      continue
    }
    if (due < t0) buckets.overdue.push(task)
    else if (due <= t1) buckets.today.push(task)
    else if (due <= t7) buckets.week.push(task)
    else buckets.later.push(task)
  }
  return buckets
}

export function useTaskBuckets(tasks: Task[]): TaskBuckets {
  return useMemo(() => bucketTasks(tasks), [tasks])
}
