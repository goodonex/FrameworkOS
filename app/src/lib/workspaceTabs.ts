import {
  isDeliverProjectDetailPath,
  salesContactIdFromPath,
} from './horizontalPanels'

export type WorkspaceTabKind =
  | 'contact'
  | 'project'
  | 'ad-campaign'
  | 'sales-list'
  | 'section'
  | 'generic'

export interface WorkspaceTabMeta {
  kind: WorkspaceTabKind
  entityId?: string
  sectionLabel?: string
}

const SECTION_LABELS: Record<string, string> = {
  sales: 'Pipeline',
  promo: 'Promo',
  deliver: 'Deliver',
  intelligence: 'Intelligence',
  foundation: 'Foundation',
  discovery: 'Discovery',
}

function salesListIdFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/brand\/[^/]+\/sales\/lists\/([^/]+)/)
  return m?.[1] ?? null
}

export function deliverProjectIdFromPath(pathname: string): string | null {
  if (!isDeliverProjectDetailPath(pathname)) return null
  const m = pathname.match(/^\/brand\/[^/]+\/deliver\/([^/]+)/)
  return m?.[1] ?? null
}

export function adCampaignIdFromPath(pathname: string): string | null {
  try {
    const url = new URL(pathname, 'https://local.invalid')
    const fromQuery = url.searchParams.get('campaign') ?? url.searchParams.get('ad')
    if (fromQuery) return fromQuery
  } catch {
    /* ignore */
  }
  const m = pathname.match(/^\/brand\/[^/]+\/promo\/ads\/([^/]+)/)
  return m?.[1] ?? null
}

export function tabIdFromPath(path: string): string {
  return path
}

export function parseWorkspaceTabMeta(pathname: string): WorkspaceTabMeta {
  const contactId = salesContactIdFromPath(pathname)
  if (contactId) return { kind: 'contact', entityId: contactId }

  const projectId = deliverProjectIdFromPath(pathname)
  if (projectId) return { kind: 'project', entityId: projectId }

  const campaignId = adCampaignIdFromPath(pathname)
  if (campaignId) return { kind: 'ad-campaign', entityId: campaignId }

  const listId = salesListIdFromPath(pathname)
  if (listId) return { kind: 'sales-list', entityId: listId }

  const mode = pathname.match(/^\/brand\/[^/]+\/([^/]+)/)?.[1]
  if (mode && SECTION_LABELS[mode]) {
    return { kind: 'section', sectionLabel: SECTION_LABELS[mode] }
  }

  return { kind: 'generic' }
}

export function defaultTabTitle(pathname: string): string {
  const meta = parseWorkspaceTabMeta(pathname)
  switch (meta.kind) {
    case 'contact':
      return 'Kontakt'
    case 'project':
      return 'Projekt'
    case 'ad-campaign':
      return 'Ad'
    case 'sales-list':
      return 'Liste'
    case 'section':
      return meta.sectionLabel ?? 'Bereich'
    default:
      return 'Tab'
  }
}

export function isEntityDetailPath(pathname: string): boolean {
  return (
    Boolean(salesContactIdFromPath(pathname)) ||
    Boolean(deliverProjectIdFromPath(pathname)) ||
    Boolean(adCampaignIdFromPath(pathname)) ||
    Boolean(salesListIdFromPath(pathname))
  )
}

/** Only entity detail URLs may become workspace tabs (via explicit open). */
export function isTabTrackablePath(pathname: string): boolean {
  return isEntityDetailPath(pathname)
}

export function contactSalesPath(slug: string, contactId: string): string {
  return `/brand/${slug}/sales/${contactId}`
}

// adCampaignPath/deliverProjectPath sind mit der alten Brand-Oberfläche
// gefallen (Etappe 4/2): keine Aufrufer mehr, und ihre Ziele — /brand/:slug/
// promo/ads bzw. /brand/:slug/deliver/:id — gibt es nicht mehr.

/** @deprecated Tabs open via context menu only — kept for type compat in bulk APIs */
export function shouldOpenInNewTab(): boolean {
  return false
}
