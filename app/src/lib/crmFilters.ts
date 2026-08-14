import type { Contact, ContactList, ContactStatus, LeadSource, PipelineStage } from '../types/db'
import { isCompany, personDisplayName, primaryPerson } from './crmContacts'

export type CrmFollowDueFilter = 'all' | 'today' | 'overdue' | 'week'

export type CrmActivityFilter = 'all' | 'today' | 'week' | 'month' | 'none'

export type CrmFilterState = {
  statuses: ContactStatus[]
  stages: PipelineStage[]
  listIds: string[]
  sources: LeadSource[]
  activity: CrmActivityFilter
  followDue: CrmFollowDueFilter
}

export const EMPTY_CRM_FILTERS: CrmFilterState = {
  statuses: [],
  stages: [],
  listIds: [],
  sources: [],
  activity: 'all',
  followDue: 'all',
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function startOfWeek(d: Date): Date {
  const x = new Date(d)
  const day = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - day)
  x.setHours(0, 0, 0, 0)
  return x
}

function matchesActivity(c: Contact, activity: CrmActivityFilter): boolean {
  if (activity === 'all') return true
  const raw = c.last_contact_at
  if (!raw) return activity === 'none'
  const t = new Date(raw).getTime()
  if (!Number.isFinite(t)) return activity === 'none'
  const now = new Date()
  const today = ymd(now)
  const day = ymd(new Date(t))
  if (activity === 'today') return day === today
  if (activity === 'week') return t >= startOfWeek(now).getTime()
  if (activity === 'month') {
    const m0 = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    return t >= m0
  }
  return false
}

function matchesFollowDue(c: Contact, followDue: CrmFollowDueFilter): boolean {
  if (followDue === 'all') return true
  const raw = c.next_follow_up_at
  if (!raw) return false
  const due = raw.slice(0, 10)
  const now = new Date()
  const today = ymd(now)
  if (followDue === 'today') return due === today
  if (followDue === 'overdue') return due < today
  if (followDue === 'week') {
    const end = new Date(startOfWeek(now))
    end.setDate(end.getDate() + 6)
    return due >= today && due <= ymd(end)
  }
  return true
}

export type CrmFilterContext = {
  memberListIdsByContact: Map<string, string[]>
}

/**
 * Wer in der Pipeline als eigene Karte zaehlt: Firmen und freistehende
 * Personen. Ansprechpartner (Person MIT `parent_company_id`) erscheinen bei
 * ihrer Firma, nicht daneben — sonst stuende jeder Kunde doppelt im Kanban.
 *
 * Ist bewusst exportiert: die Regel lag nur in `applyCrmFilters`, waehrend die
 * Kennzahl-Kacheln darueber auf der ungefilterten Liste rechneten. Ergebnis war
 * "Gesamt in Pipeline 44" ueber Spalten, die zusammen 37 ergaben — Kevins
 * sieben Ansprechpartner (5x Erstkontakt, 2x Deal).
 */
export function nurPipelineKontakte(items: Contact[]): Contact[] {
  return items.filter((c) => isCompany(c) || !c.parent_company_id)
}

export function applyCrmFilters(
  items: Contact[],
  filters: CrmFilterState,
  ctx?: CrmFilterContext,
): Contact[] {
  const pipelineOnly = nurPipelineKontakte(items)
  return pipelineOnly.filter((c) => {
    if (filters.statuses.length > 0 && !filters.statuses.includes(c.contact_status)) return false
    if (filters.stages.length > 0 && !filters.stages.includes(c.pipeline_stage)) return false
    if (filters.sources.length > 0 && !filters.sources.includes(c.lead_source)) return false
    if (!matchesActivity(c, filters.activity)) return false
    if (!matchesFollowDue(c, filters.followDue)) return false
    if (filters.listIds.length > 0 && ctx) {
      const ids = ctx.memberListIdsByContact.get(c.id) ?? []
      if (!filters.listIds.some((id) => ids.includes(id))) return false
    }
    return true
  })
}

export function applyListFilterJson(
  items: Contact[],
  list: ContactList,
  ctx?: CrmFilterContext,
): Contact[] {
  if (list.list_type !== 'dynamic' || !list.filter_json) return items
  return applyCrmFilters(items, list.filter_json as CrmFilterState, ctx)
}

export function contactRowSubtitle(c: Contact, all: Contact[]): string {
  if (isCompany(c)) {
    const p = primaryPerson(all, c.id)
    return p ? personDisplayName(p) : '—'
  }
  return (c.job_title ?? '').trim() || '—'
}
