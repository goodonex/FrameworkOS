import { loadList, generateId } from './storage'
import { mergeWithCatalogDeliverables } from './deliverableCatalog'
import { isPitchProject } from './projectAreas'
import type {
  ClientDocumentLink,
  DeliverableArea,
  DeliverableItem,
  DeliverableType,
  DeliverProject,
  DeliverProjectStage,
  DeliverStageDurations,
} from '../types/db'
import { DEFAULT_STAGE_DURATIONS, DELIVER_STAGE_ORDER } from '../types/db'

const STORAGE_KEY = 'deliver-projects' as const

export function emptyTiptapDoc(): Record<string, unknown> {
  return { type: 'doc', content: [] }
}

function validStage(v: unknown): DeliverProjectStage {
  if (typeof v === 'string' && (DELIVER_STAGE_ORDER as readonly string[]).includes(v)) {
    return v as DeliverProjectStage
  }
  return 'onboarding'
}

function validDeliverableType(v: unknown): DeliverableType | undefined {
  const types: DeliverableType[] = [
    'brand_strategy',
    'logo',
    'brand_guidelines',
    'color_palette',
    'typography',
    'moodboard',
    'sitemap',
    'design_concept',
    'website_development',
    'website_live_url',
    'performance_score',
    'custom',
  ]
  if (typeof v === 'string' && types.includes(v as DeliverableType)) return v as DeliverableType
  return undefined
}

function validDeliverableArea(v: unknown): DeliverableArea | undefined {
  if (v === 'branding' || v === 'website' || v === 'leadgen') return v
  return undefined
}

function parseDeliverables(raw: unknown, websiteOnly = false): DeliverableItem[] {
  if (!Array.isArray(raw)) return mergeWithCatalogDeliverables([], websiteOnly)
  const out: DeliverableItem[] = []
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue
    const o = x as Record<string, unknown>
    const title = typeof o.title === 'string' ? o.title.trim() : ''
    if (!title) continue
    const st = o.status
    const status: DeliverableItem['status'] =
      st === 'fertig' || st === 'in_arbeit' || st === 'geplant' ? st : 'geplant'
    const type = validDeliverableType(o.type)
    const updated_at =
      typeof o.updated_at === 'string' && o.updated_at
        ? o.updated_at
        : new Date().toISOString()
    const id =
      typeof o.id === 'string' && o.id
        ? o.id
        : type && type !== 'custom'
          ? `dlv-${type}`
          : generateId()
    const url = typeof o.url === 'string' && o.url.trim() ? o.url.trim() : undefined
    const description =
      typeof o.description === 'string' && o.description.trim()
        ? o.description.trim()
        : undefined
    const added_at =
      typeof o.added_at === 'string' && o.added_at ? o.added_at : undefined
    const progress =
      typeof o.progress === 'number' && Number.isFinite(o.progress)
        ? Math.max(0, Math.min(100, Math.round(o.progress)))
        : undefined
    const area = validDeliverableArea(o.area)
    out.push({
      id,
      type,
      title,
      status,
      updated_at,
      ...(url ? { url } : {}),
      ...(description ? { description } : {}),
      ...(added_at ? { added_at } : {}),
      ...(progress !== undefined ? { progress } : {}),
      ...(area ? { area } : {}),
    })
  }
  return mergeWithCatalogDeliverables(out, websiteOnly)
}

function parseClientDocuments(raw: unknown): ClientDocumentLink[] {
  if (!Array.isArray(raw)) return []
  const out: ClientDocumentLink[] = []
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue
    const o = x as Record<string, unknown>
    const label = typeof o.label === 'string' ? o.label : ''
    const url = typeof o.url === 'string' ? o.url : ''
    const description =
      typeof o.description === 'string' && o.description.trim()
        ? o.description.trim()
        : undefined
    if (label || url)
      out.push({
        label: label || url || 'Link',
        url: url || '#',
        ...(description ? { description } : {}),
      })
  }
  return out
}

function isDocJson(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function parseStageDurations(raw: unknown): DeliverStageDurations {
  const base = { ...DEFAULT_STAGE_DURATIONS }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base
  const o = raw as Record<string, unknown>
  for (const stage of DELIVER_STAGE_ORDER) {
    const v = o[stage]
    if (typeof v === 'string' && v.trim()) base[stage] = v.trim()
  }
  return base
}

/** Normalisiert gespeicherte Projekte (neu oder Legacy localStorage). */
export function normalizeDeliverProject(
  input: Partial<DeliverProject> & { id: string },
  brandKey: string,
): DeliverProject {
  const now = new Date().toISOString()
  const doc = isDocJson(input.internal_notes_doc)
    ? input.internal_notes_doc
    : emptyTiptapDoc()
  const pitch = isPitchProject({ name: input.name ?? '' })
  const stage = pitch ? 'inner_world' : validStage(input.internal_stage)
  const clientStage = pitch ? 'inner_world' : validStage(input.client_stage)
  return {
    id: input.id,
    brand_id: input.brand_id ?? brandKey,
    name: input.name ?? 'Projekt',
    client_name: input.client_name ?? '',
    client_email: input.client_email ?? '',
    client_contact_id: input.client_contact_id ?? null,
    status: input.status === 'completed' ? 'completed' : 'active',
    internal_stage: stage,
    client_stage: clientStage,
    internal_notes_doc: doc,
    internal_file_links: Array.isArray(input.internal_file_links)
      ? input.internal_file_links.filter((x): x is string => typeof x === 'string')
      : [],
    team_notes: input.team_notes ?? '',
    client_welcome_text: input.client_welcome_text ?? '',
    client_documents: parseClientDocuments(input.client_documents),
    deliverables: parseDeliverables(
      input.deliverables,
      isPitchProject({ name: input.name ?? '' }),
    ),
    booking_url: input.booking_url ?? '',
    stage_durations: parseStageDurations(input.stage_durations),
    deleted_at:
      typeof input.deleted_at === 'string' && input.deleted_at ? input.deleted_at : null,
    created_at:
      typeof input.created_at === 'string' && input.created_at ? input.created_at : null,
    updated_at: input.updated_at ?? now,
  }
}

export function coerceStoredDeliverItem(
  item: unknown,
  brandSlug: string,
): DeliverProject | null {
  if (!item || typeof item !== 'object') return null
  const o = item as Record<string, unknown>
  if (typeof o.id !== 'string') return null

  if ('internal_notes_doc' in o && o.internal_notes_doc !== undefined) {
    return normalizeDeliverProject(
      {
        id: o.id,
        brand_id: typeof o.brand_id === 'string' ? o.brand_id : brandSlug,
        name: typeof o.name === 'string' ? o.name : 'Projekt',
        client_name: typeof o.client_name === 'string' ? o.client_name : '',
        client_email: typeof o.client_email === 'string' ? o.client_email : '',
        client_contact_id:
          o.client_contact_id === null || typeof o.client_contact_id === 'string'
            ? (o.client_contact_id as string | null)
            : null,
        status: o.status === 'completed' ? 'completed' : 'active',
        internal_stage: validStage(o.internal_stage),
        client_stage: validStage(o.client_stage),
        internal_notes_doc: o.internal_notes_doc as Record<string, unknown>,
        internal_file_links: o.internal_file_links as string[] | undefined,
        team_notes: typeof o.team_notes === 'string' ? o.team_notes : '',
        client_welcome_text:
          typeof o.client_welcome_text === 'string' ? o.client_welcome_text : '',
        client_documents: o.client_documents as ClientDocumentLink[] | undefined,
        deliverables: parseDeliverables(o.deliverables),
        booking_url: typeof o.booking_url === 'string' ? o.booking_url : '',
        updated_at: typeof o.updated_at === 'string' ? o.updated_at : undefined,
      },
      brandSlug,
    )
  }

  const internal = typeof o.internal_notes === 'string' ? o.internal_notes : ''
  const clientArea = typeof o.client_area_notes === 'string' ? o.client_area_notes : ''
  const doc =
    internal.trim() !== ''
      ? {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: internal }],
            },
          ],
        }
      : emptyTiptapDoc()

  return normalizeDeliverProject(
    {
      id: o.id,
      name: typeof o.name === 'string' ? o.name : 'Projekt',
      client_email: typeof o.client_email === 'string' ? o.client_email : '',
      client_contact_id:
        o.client_contact_id === null || typeof o.client_contact_id === 'string'
          ? (o.client_contact_id as string | null)
          : null,
      status: o.status === 'completed' ? 'completed' : 'active',
      internal_notes_doc: doc,
      client_welcome_text: clientArea,
      deliverables: parseDeliverables(o.deliverables),
      booking_url: typeof o.booking_url === 'string' ? o.booking_url : '',
    },
    brandSlug,
  )
}

export function findDeliverProjectInStorage(
  projectId: string,
  brandSlugs: string[],
): { slug: string; project: DeliverProject } | null {
  for (const slug of brandSlugs) {
    const raw = loadList<unknown>([slug, STORAGE_KEY])
    for (const item of raw) {
      const p = coerceStoredDeliverItem(item, slug)
      if (p && p.id === projectId) return { slug, project: p }
    }
  }
  return null
}

const LS_PREFIX = 'brand-os:'
const LS_SUFFIX = ':deliver-projects'

/** Alle Brand-Slugs, für die es lokale Deliver-Listen gibt (Preview ohne Login). */
export function listDeliverStorageSlugsFromLocalStorage(): string[] {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return []
  }
  const slugs = new Set<string>()
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i)
    if (!key?.startsWith(LS_PREFIX) || !key.endsWith(LS_SUFFIX)) continue
    const mid = key.slice(LS_PREFIX.length, key.length - LS_SUFFIX.length)
    if (!mid || mid.includes(':')) continue
    slugs.add(mid)
  }
  return [...slugs]
}

export function findDeliverProjectAcrossLocalStorage(
  projectId: string,
): { slug: string; project: DeliverProject } | null {
  return findDeliverProjectInStorage(
    projectId,
    listDeliverStorageSlugsFromLocalStorage(),
  )
}

export function findDeliverProjectForPortal(
  projectId: string,
  brandSlugs: string[],
): DeliverProject | null {
  return findDeliverProjectInStorage(projectId, brandSlugs)?.project ?? null
}

export function rowRecordToDeliverProject(
  row: Record<string, unknown>,
): DeliverProject {
  const owner = row.owner_brand_id as string
  return normalizeDeliverProject(
    {
      id: row.id as string,
      brand_id: owner,
      name: (row.name as string) ?? '',
      client_name: (row.client_name as string) ?? '',
      client_email: (row.client_email as string) ?? '',
      client_contact_id: (row.client_contact_id as string | null) ?? null,
      status: row.status === 'completed' ? 'completed' : 'active',
      internal_stage: validStage(row.internal_stage),
      client_stage: validStage(row.client_stage),
      internal_notes_doc: isDocJson(row.internal_notes_doc)
        ? row.internal_notes_doc
        : emptyTiptapDoc(),
      internal_file_links: Array.isArray(row.internal_file_links)
        ? (row.internal_file_links as string[])
        : [],
      team_notes: (row.team_notes as string) ?? '',
      client_welcome_text: (row.client_welcome_text as string) ?? '',
      client_documents: parseClientDocuments(row.client_documents),
      deliverables: parseDeliverables(row.deliverables),
      booking_url: (row.booking_url as string) ?? '',
      stage_durations: parseStageDurations(row.stage_durations),
      deleted_at:
        typeof row.deleted_at === 'string' && row.deleted_at ? row.deleted_at : null,
      created_at:
        typeof row.created_at === 'string' && row.created_at ? row.created_at : null,
      updated_at: (row.updated_at as string) ?? new Date().toISOString(),
    },
    owner,
  )
}

export function deliverProjectToInsertRow(
  p: DeliverProject,
  brandUuid: string,
): Record<string, unknown> {
  return {
    id: p.id,
    owner_brand_id: brandUuid,
    name: p.name,
    client_contact_id: p.client_contact_id,
    status: p.status,
    internal_notes: '',
    client_area_notes: '',
    client_name: p.client_name,
    client_email: p.client_email,
    internal_stage: p.internal_stage,
    client_stage: p.client_stage,
    internal_notes_doc: p.internal_notes_doc,
    internal_file_links: p.internal_file_links,
    team_notes: p.team_notes,
    client_welcome_text: p.client_welcome_text,
    client_documents: p.client_documents,
    deliverables: p.deliverables,
    booking_url: p.booking_url,
    stage_durations: p.stage_durations,
    updated_at: p.updated_at,
  }
}

export function deliverProjectToUpdateRow(
  patch: Partial<Omit<DeliverProject, 'id' | 'brand_id'>>,
  updatedAt: string,
): Record<string, unknown> {
  const out: Record<string, unknown> = { updated_at: updatedAt }
  const keys = [
    'name',
    'client_name',
    'client_email',
    'client_contact_id',
    'status',
    'internal_stage',
    'client_stage',
    'internal_notes_doc',
    'internal_file_links',
    'team_notes',
    'client_welcome_text',
    'client_documents',
    'deliverables',
    'booking_url',
    'stage_durations',
  ] as const
  for (const k of keys) {
    if (patch[k] !== undefined) out[k] = patch[k]
  }
  return out
}
