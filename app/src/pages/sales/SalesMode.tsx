import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { motion, type Variants } from 'framer-motion'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useCurrentBrandSlug } from '../../hooks/useCurrentBrandSlug'
import { CARD_TILE_TAP } from '../../modules/CardTile'
import { useSalesPipelines } from '../../hooks/useSalesPro'
import { EmailTemplatesDrawer } from '../../components/sales/EmailTemplatesDrawer'
import { PipelineSwitcher } from '../../components/sales/PipelineSwitcher'
import { SalesGoalsDrawer } from '../../components/sales/SalesGoalsDrawer'
import { SalesImportDrawer } from '../../components/sales/SalesImportDrawer'
import { SalesMeetingLinkDrawer } from '../../components/sales/SalesMeetingLinkDrawer'
import { SectionLabel } from '../../components/SectionLabel'
import { useToast } from '../../components/Toast'
import { findDeliverProjectForContact } from '../../components/sales/ContactDeliverCard'
import { useContacts } from '../../hooks/useContacts'
import { useDeliverProjects } from '../../hooks/useDeliverProjects'
import { useOpportunities } from '../../hooks/useOpportunities'
import type { Contact, DeliverProject, PipelineStage } from '../../types/db'
import { contactSalesPath, openContactsInTabs } from '../../lib/openContactTabs'
import { useBrandNavigate } from '../../hooks/useBrandNavigate'
import {
  useWorkspaceContextMenu,
  WorkspaceContextMenu,
} from '../../components/workspace/WorkspaceContextMenu'
import {
  filterPipelineContacts,
  formatEuroDe,
  pipelineValueEuro,
  potenzialKanbanLabel,
  type FollowFilter,
  type PotenzialFilter,
  type StageFilter,
} from '../../lib/salesPipelineFilters'
import { followUpIsoDaysFromNow } from '../../lib/callContactPatch'
import { generateId } from '../../lib/storage'
import { useSalesQuickLead } from '../../components/sales/SalesLeadCapture'
import { CrmToolbar } from '../../components/sales/CrmToolbar'
import { CrmFilterPanel } from '../../components/sales/CrmFilterPanel'
import { PipelineCarouselView } from '../../components/sales/PipelineCarouselView'
import { PipelineListView } from '../../components/sales/PipelineListView'
import { PipelineTableView } from '../../components/sales/PipelineTableView'
import { applyCrmFilters, EMPTY_CRM_FILTERS, type CrmFilterState } from '../../lib/crmFilters'
import {
  loadCrmFilters,
  loadKanbanColumnSort,
  loadPipelineView,
  PIPELINE_VIEW_LABEL,
  PIPELINE_VIEW_MODES,
  saveCrmFilters,
  saveKanbanColumnSort,
  savePipelineView,
  type KanbanColumnSort,
  type PipelineViewMode,
} from '../../lib/crmViewStorage'
import {
  contactCardTitle,
  KANBAN_SORT_LABEL,
  sortPipelineContacts,
} from '../../lib/pipelineContactSort'
import { useContactLists } from '../../hooks/useContactLists'
import { ContactListsContent } from './ContactListsContent'

const STAGES: PipelineStage[] = [
  'first_contact',
  'conversation',
  'follow_up',
  'proposal',
  'deal',
  'paused',
]

const STAGE_LABEL: Record<PipelineStage, string> = {
  first_contact: 'Erstkontakt',
  conversation: 'Gespräch',
  follow_up: 'Follow up',
  proposal: 'Pitch',
  deal: 'Deal',
  paused: 'Pause',
}

/** Linker Rand der Pipeline-Card = Stage-Farbe */
const STAGE_ACCENT: Record<PipelineStage, string> = {
  first_contact: 'var(--mode-sales)',
  conversation: 'var(--accent-blue)',
  follow_up: 'var(--accent-amber)',
  proposal: 'var(--accent-teal)',
  deal: 'var(--accent-success)',
  paused: 'var(--text-tertiary)',
}

const KANBAN_WRAP_VARIANTS: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06 },
  },
}

const KANBAN_COLUMN_VARIANTS: Variants = {
  hidden: { opacity: 0, x: -14 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring', stiffness: 260, damping: 22 },
  },
}

/** Scroll-Embed: keine Opacity-0-Spalten (sonst leere Pipeline nach Navigation). */
const KANBAN_EMBED_VARIANTS: Variants = {
  hidden: { opacity: 1 },
  visible: { opacity: 1, transition: { staggerChildren: 0 } },
}

const KANBAN_EMBED_COLUMN_VARIANTS: Variants = {
  hidden: { opacity: 1, x: 0 },
  visible: { opacity: 1, x: 0 },
}

function ymdToday(): string {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

function startOfWeekMondayMs(): number {
  const x = new Date()
  const day = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - day)
  x.setHours(0, 0, 0, 0)
  return x.getTime()
}

function isFollowUpDueTodayOrBefore(nextFollowUpAt: string | null): boolean {
  if (!nextFollowUpAt) return false
  return nextFollowUpAt.slice(0, 10) <= ymdToday()
}

/** Stage-Spalten zuerst treffen — leere Spalten und Rückwärts-Moves zuverlässig. */
const kanbanCollisionDetection: CollisionDetection = (args) => {
  const stageContainers = args.droppableContainers.filter((c) =>
    (STAGES as readonly string[]).includes(String(c.id)),
  )
  const pointerHits = pointerWithin({
    ...args,
    droppableContainers: stageContainers,
  })
  if (pointerHits.length > 0) return pointerHits
  const intersections = rectIntersection({
    ...args,
    droppableContainers: stageContainers,
  })
  if (intersections.length > 0) return intersections
  return closestCorners(args)
}


const cardQuickBtn: CSSProperties = {
  fontSize: 10,
  padding: '4px 8px',
  borderRadius: 999,
  border: '1px solid var(--glass-border-2)',
  background: 'var(--glass-2)',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  textDecoration: 'none',
  lineHeight: 1.2,
}

/** Vergleicht Kalendertag (YYYY-MM-DD) mit heute — Follow-up heute oder früher = überfällig. */
function isFollowUpOverdue(contact: Contact): boolean {
  if (!contact.next_follow_up_at) return false
  if (contact.pipeline_stage === 'deal' || contact.pipeline_stage === 'paused') return false
  const ymd = contact.next_follow_up_at.slice(0, 10)
  const t = new Date()
  const today = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
  return ymd <= today
}

function QuickNotePopover({
  onSave,
  onClose,
}: {
  onSave: (text: string) => void
  onClose: () => void
}) {
  const [text, setText] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      const el = ref.current?.closest('[data-quicknote-root]')
      if (el && !el.contains(t)) onClose()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [onClose])

  return (
    <div
      data-quicknote-root
      className="glass-2"
      style={{
        position: 'absolute',
        top: 32,
        right: 4,
        zIndex: 40,
        width: 'calc(100% - 8px)',
        maxWidth: 220,
        padding: 10,
        borderRadius: 10,
        border: '1px solid var(--glass-border-2)',
        boxShadow: 'var(--shadow-md)',
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            onClose()
          } else if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            const t = text.trim()
            if (t) onSave(t)
            onClose()
          }
        }}
        rows={3}
        placeholder="Schnelle Notiz..."
        className="font-mono"
        style={{
          width: '100%',
          fontSize: 12,
          padding: 8,
          borderRadius: 8,
          border: '1px solid var(--glass-border-1)',
          background: 'var(--glass-1)',
          color: 'var(--text-primary)',
          resize: 'none' as const,
        }}
      />
    </div>
  )
}

type ProductFilter = 'all' | 'herrmann' | 'wertavio' | 'culturefit'

function PipelineFilterBar({
  q,
  setQ,
  stage,
  setStage,
  follow,
  setFollow,
  potenzial,
  setPotenzial,
  productFilter,
  setProductFilter,
  onReset,
  filtersActive,
  kanbanColumnSort,
  onKanbanColumnSortChange,
  viewMode,
  onViewModeChange,
  onOpenBatchTabs,
  callableCount,
}: {
  q: string
  setQ: (s: string) => void
  stage: StageFilter
  setStage: (s: StageFilter) => void
  follow: FollowFilter
  setFollow: (f: FollowFilter) => void
  potenzial: PotenzialFilter
  setPotenzial: (p: PotenzialFilter) => void
  productFilter: ProductFilter
  setProductFilter: (p: ProductFilter) => void
  onReset: () => void
  filtersActive: boolean
  kanbanColumnSort: KanbanColumnSort
  onKanbanColumnSortChange: (sort: KanbanColumnSort) => void
  viewMode: PipelineViewMode
  onViewModeChange: (mode: PipelineViewMode) => void
  onOpenBatchTabs?: (count: number) => void
  callableCount?: number
}) {
  const pill = (on: boolean) => ({
    fontSize: 10,
    letterSpacing: '0.06em',
    padding: '6px 10px',
    borderRadius: 999,
    border: on ? '1px solid var(--mode-sales)' : '1px solid var(--glass-border-2)',
    background: on
      ? 'color-mix(in srgb, var(--mode-sales) 14%, transparent)'
      : 'var(--glass-2)',
    color: on ? 'var(--mode-sales)' : 'var(--text-tertiary)',
    cursor: 'pointer' as const,
  })

  // Anzahl gesetzter Filter
  const activeCount =
    (stage !== 'all' ? 1 : 0) +
    (follow !== 'all' ? 1 : 0) +
    (potenzial !== 'all' ? 1 : 0)
  const [open, setOpen] = useState(activeCount > 0)
  const [sortOpen, setSortOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const sortAnchorRef = useRef<HTMLDivElement>(null)
  const sortPortalRef = useRef<HTMLDivElement>(null)
  const viewAnchorRef = useRef<HTMLDivElement>(null)
  const viewPortalRef = useRef<HTMLDivElement>(null)
  const [sortMenuPos, setSortMenuPos] = useState<{ top: number; left: number } | null>(null)
  const [viewMenuPos, setViewMenuPos] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    if (activeCount > 0) setOpen(true)
  }, [activeCount])

  useLayoutEffect(() => {
    if (!sortOpen) {
      setSortMenuPos(null)
      return
    }
    const anchor = sortAnchorRef.current
    if (!anchor) return
    const update = () => {
      const r = anchor.getBoundingClientRect()
      setSortMenuPos({ top: r.bottom + 6, left: r.left })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [sortOpen])

  useLayoutEffect(() => {
    if (!viewOpen) {
      setViewMenuPos(null)
      return
    }
    const anchor = viewAnchorRef.current
    if (!anchor) return
    const update = () => {
      const r = anchor.getBoundingClientRect()
      setViewMenuPos({ top: r.bottom + 6, left: r.left })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [viewOpen])

  useEffect(() => {
    if (!sortOpen) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (sortAnchorRef.current?.contains(t)) return
      if (sortPortalRef.current?.contains(t)) return
      setSortOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [sortOpen])

  useEffect(() => {
    if (!viewOpen) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (viewAnchorRef.current?.contains(t)) return
      if (viewPortalRef.current?.contains(t)) return
      setViewOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [viewOpen])

  return (
    <div
      className="glass-2 mb-3 flex flex-col gap-2 rounded-2xl p-3"
      style={{ border: '1px solid var(--glass-border-1)' }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {(
            [
              ['all', 'Alle'],
              ['herrmann', 'Herrmann & Co'],
              ['wertavio', 'Wertavio'],
              ['culturefit', 'CultureFit'],
            ] as const
          ).map(([key, label]) => {
            const on = productFilter === key
            return (
              <button
                key={key}
                type="button"
                className="font-mono whitespace-nowrap"
                onClick={() => setProductFilter(key)}
                style={pill(on)}
              >
                {label}
              </button>
            )
          })}
        </div>
        <div
          aria-hidden
          className="shrink-0"
          style={{
            width: 1,
            height: 22,
            margin: '0 6px',
            background: 'color-mix(in srgb, var(--glass-border-2) 85%, transparent)',
            alignSelf: 'center',
          }}
        />
        <div className="flex shrink-0 flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="font-mono inline-flex shrink-0 items-center gap-1.5"
          style={{
            ...pill(activeCount > 0),
            padding: '6px 10px',
            gap: 6,
          }}
        >
          <svg width={11} height={11} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M2 4 L14 4 L10 9 L10 14 L6 12 L6 9 Z" />
          </svg>
          Filter
          {activeCount > 0 ? (
            <span
              style={{
                marginLeft: 2,
                padding: '0 6px',
                borderRadius: 999,
                background: 'var(--mode-sales)',
                color: 'var(--chip-text-on-accent)',
                fontSize: 9,
                fontWeight: 700,
                lineHeight: 1.6,
              }}
            >
              {activeCount}
            </span>
          ) : null}
          <span style={{ fontSize: 8, marginLeft: 2, opacity: 0.65 }}>
            {open ? '▲' : '▼'}
          </span>
        </button>
          <div ref={sortAnchorRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setSortOpen((o) => !o)}
              className="font-mono inline-flex shrink-0 items-center gap-1.5"
              style={{
                ...pill(kanbanColumnSort !== 'follow_up' || sortOpen),
                padding: '6px 10px',
                gap: 6,
              }}
              aria-expanded={sortOpen}
              aria-haspopup="listbox"
            >
              <svg
                width={11}
                height={11}
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path d="M4 6 L8 2 L12 6" />
                <path d="M4 10 L8 14 L12 10" />
              </svg>
              Sortieren
              <span style={{ fontSize: 8, marginLeft: 2, opacity: 0.65 }}>
                {sortOpen ? '▲' : '▼'}
              </span>
            </button>
            {sortOpen && sortMenuPos
              ? createPortal(
                  <div
                    ref={sortPortalRef}
                    className="glass-2 font-mono flex flex-col gap-2 rounded-xl p-2.5"
                    style={{
                      position: 'fixed',
                      top: sortMenuPos.top,
                      left: sortMenuPos.left,
                      zIndex: 200,
                      minWidth: 200,
                      border: '1px solid var(--glass-border-1)',
                      boxShadow: 'var(--shadow-md)',
                      pointerEvents: 'auto',
                    }}
                    role="listbox"
                    aria-label="Sortierung der Kontakte in Kanban-Spalten"
                  >
                    <div
                      style={{
                        fontSize: 9,
                        color: 'var(--text-tertiary)',
                        letterSpacing: '0.06em',
                      }}
                    >
                      Aktuell: {KANBAN_SORT_LABEL[kanbanColumnSort]}
                    </div>
                    <div className="flex flex-col gap-1">
                      {(Object.keys(KANBAN_SORT_LABEL) as KanbanColumnSort[]).map((key) => {
                        const on = kanbanColumnSort === key
                        return (
                          <button
                            key={key}
                            type="button"
                            role="option"
                            aria-selected={on}
                            className="font-mono text-left whitespace-nowrap"
                            style={{
                              ...pill(on),
                              width: '100%',
                              padding: '6px 10px',
                              borderRadius: 8,
                            }}
                            onClick={() => {
                              onKanbanColumnSortChange(key)
                              setSortOpen(false)
                            }}
                          >
                            {KANBAN_SORT_LABEL[key]}
                          </button>
                        )
                      })}
                    </div>
                  </div>,
                  document.body,
                )
              : null}
          </div>
        <div ref={viewAnchorRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setViewOpen((o) => !o)}
              className="font-mono inline-flex shrink-0 items-center gap-1.5"
              style={{
                ...pill(viewMode !== 'cards' || viewOpen),
                padding: '6px 10px',
                gap: 6,
              }}
              aria-expanded={viewOpen}
              aria-haspopup="listbox"
            >
              <svg
                width={11}
                height={11}
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <rect x="2" y="3" width="5" height="4" rx="1" />
                <rect x="9" y="3" width="5" height="4" rx="1" />
                <rect x="2" y="9" width="12" height="4" rx="1" />
              </svg>
              Ansicht
              <span style={{ fontSize: 8, marginLeft: 2, opacity: 0.65 }}>
                {viewOpen ? '▲' : '▼'}
              </span>
            </button>
            {viewOpen && viewMenuPos
              ? createPortal(
                  <div
                    ref={viewPortalRef}
                    className="glass-2 font-mono flex flex-col gap-2 rounded-xl p-2.5"
                    style={{
                      position: 'fixed',
                      top: viewMenuPos.top,
                      left: viewMenuPos.left,
                      zIndex: 200,
                      minWidth: 180,
                      border: '1px solid var(--glass-border-1)',
                      boxShadow: 'var(--shadow-md)',
                      pointerEvents: 'auto',
                    }}
                    role="listbox"
                    aria-label="Pipeline-Ansicht"
                  >
                    <div
                      style={{
                        fontSize: 9,
                        color: 'var(--text-tertiary)',
                        letterSpacing: '0.06em',
                      }}
                    >
                      Aktuell: {PIPELINE_VIEW_LABEL[viewMode]}
                    </div>
                    <div className="flex flex-col gap-1">
                      {PIPELINE_VIEW_MODES.map((key) => {
                        const on = viewMode === key
                        return (
                          <button
                            key={key}
                            type="button"
                            role="option"
                            aria-selected={on}
                            className="font-mono text-left whitespace-nowrap"
                            style={{
                              ...pill(on),
                              width: '100%',
                              padding: '6px 10px',
                              borderRadius: 8,
                            }}
                            onClick={() => {
                              onViewModeChange(key)
                              setViewOpen(false)
                            }}
                          >
                            {PIPELINE_VIEW_LABEL[key]}
                          </button>
                        )
                      })}
                    </div>
                  </div>,
                  document.body,
                )
              : null}
          </div>
        {onOpenBatchTabs ? (
          <>
            <div
              aria-hidden
              className="shrink-0"
              style={{
                width: 1,
                height: 22,
                margin: '0 4px',
                background: 'color-mix(in srgb, var(--glass-border-2) 85%, transparent)',
                alignSelf: 'center',
              }}
            />
            {([10, 20] as const).map((n) => (
              <button
                key={n}
                type="button"
                className="font-mono shrink-0 whitespace-nowrap"
                title={`Erste ${n} Leads mit Telefon in neuen Tabs öffnen`}
                disabled={(callableCount ?? 0) === 0}
                onClick={() => onOpenBatchTabs(n)}
                style={{
                  ...pill(false),
                  opacity: (callableCount ?? 0) >= n || (callableCount ?? 0) > 0 ? 1 : 0.45,
                  cursor: (callableCount ?? 0) > 0 ? 'pointer' : 'not-allowed',
                }}
              >
                {n}↗
              </button>
            ))}
          </>
        ) : null}
        {filtersActive ? (
          <button
            type="button"
            className="font-mono shrink-0 whitespace-nowrap"
            onClick={onReset}
            style={pill(false)}
          >
            Zurücksetzen
          </button>
        ) : null}
        </div>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Suche: Name, Firma, E-Mail …"
          className="font-mono min-w-[160px] flex-1 rounded-lg px-3 py-2"
          style={{
            fontSize: 12,
            border: '1px solid var(--glass-border-2)',
            background: 'var(--glass-1)',
            color: 'var(--text-primary)',
          }}
        />
      </div>
      {open ? (
      <>
      <div>
        <div className="font-mono mb-1.5" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
          STAGE
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['all', 'Alle'],
              ['first_contact', 'Erstkontakt'],
              ['conversation', 'Gespräch'],
              ['proposal', 'Pitch'],
              ['deal', 'Deal'],
              ['paused', 'Pause'],
            ] as const
          ).map(([key, label]) => {
            const on = stage === key
            return (
              <button
                key={key}
                type="button"
                className="font-mono"
                style={pill(on)}
                onClick={() => setStage(key as StageFilter)}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>
      <div>
        <div className="font-mono mb-1.5" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
          FOLLOW-UP
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['all', 'Alle'],
              ['today', 'Heute fällig'],
              ['week', 'Diese Woche'],
              ['none', 'Ohne Datum'],
            ] as const
          ).map(([key, label]) => {
            const on = follow === key
            return (
              <button
                key={key}
                type="button"
                className="font-mono"
                style={pill(on)}
                onClick={() => setFollow(key as FollowFilter)}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>
      <div>
        <div className="font-mono mb-1.5" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
          POTENZIAL
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['all', 'Alle'],
              ['lt1k', '< 1k'],
              ['1k5k', '1k–5k'],
              ['5k10k', '5k–10k'],
              ['gt10k', '> 10k'],
            ] as const
          ).map(([key, label]) => {
            const on = potenzial === key
            return (
              <button
                key={key}
                type="button"
                className="font-mono"
                style={pill(on)}
                onClick={() => setPotenzial(key as PotenzialFilter)}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>
      </>
      ) : null}
    </div>
  )
}

function DroppableStageColumn({
  stage,
  children,
  onStageHover,
  scrollEmbed = false,
  columnMotionVariants,
  isDragActive,
  isDropTarget,
  cardCount,
}: {
  stage: PipelineStage
  children: ReactNode
  onStageHover?: (stage: PipelineStage | null) => void
  scrollEmbed?: boolean
  columnMotionVariants?: Variants
  isDragActive?: boolean
  isDropTarget?: boolean
  cardCount?: number
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })
  const highlighted = isOver || isDropTarget
  const emptyWhileDragging = isDragActive && (cardCount ?? 0) === 0
  const columnStyle: CSSProperties = {
    flex: scrollEmbed ? '1 1 160px' : undefined,
    width: scrollEmbed ? undefined : 'min(200px, calc(100vw - 48px))',
    minWidth: scrollEmbed ? 160 : 'min(200px, calc(100vw - 48px))',
    borderRadius: 14,
    padding: 10,
    border: highlighted
      ? '2px solid var(--mode-sales)'
      : '1px solid var(--glass-border-1)',
    background: scrollEmbed
      ? highlighted
        ? 'var(--surface-card-strong)'
        : 'var(--glass-2)'
      : highlighted
        ? 'color-mix(in srgb, var(--mode-sales) 8%, var(--glass-2))'
        : undefined,
    backdropFilter: scrollEmbed ? 'blur(14px)' : 'var(--blur-md)',
    WebkitBackdropFilter: scrollEmbed ? 'blur(14px)' : 'var(--blur-md)',
    minHeight: isDragActive ? (emptyWhileDragging ? 220 : 160) : 120,
    transform: highlighted ? 'translateY(-10px)' : undefined,
    boxShadow: highlighted
      ? 'var(--shadow-lg), 0 0 0 1px color-mix(in srgb, var(--mode-sales) 35%, transparent)'
      : isDragActive
        ? 'var(--shadow-md)'
        : undefined,
    zIndex: highlighted ? 30 : isDragActive ? 2 : 1,
    transition:
      'transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease, min-height 140ms ease',
    position: 'relative',
  }
  const columnClass = scrollEmbed ? 'shrink-0' : 'glass-2 shrink-0'
  const columnBody = (
    <>
      <div
        className="font-mono mb-2 flex items-center justify-between gap-2"
        style={{
          fontSize: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: highlighted ? 'var(--mode-sales)' : 'var(--text-tertiary)',
        }}
      >
        <span>{STAGE_LABEL[stage]}</span>
        {cardCount != null ? (
          <span
            style={{
              fontSize: 9,
              padding: '2px 6px',
              borderRadius: 999,
              background: 'var(--glass-1)',
              color: 'var(--text-secondary)',
            }}
          >
            {cardCount}
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-2 min-h-0 flex-1">
        {children}
        {emptyWhileDragging ? (
          <div
            className="font-mono flex flex-1 items-center justify-center rounded-lg border border-dashed"
            style={{
              minHeight: 120,
              marginTop: 4,
              fontSize: 10,
              color: 'var(--mode-sales)',
              borderColor: 'color-mix(in srgb, var(--mode-sales) 45%, var(--glass-border-2))',
              background: 'color-mix(in srgb, var(--mode-sales) 6%, transparent)',
            }}
          >
            Hier ablegen
          </div>
        ) : null}
      </div>
    </>
  )

  if (scrollEmbed) {
    return (
      <div
        ref={setNodeRef}
        className={columnClass}
        onPointerEnter={() => onStageHover?.(stage)}
        style={columnStyle}
      >
        {columnBody}
      </div>
    )
  }

  return (
    <motion.div
      ref={setNodeRef}
      variants={columnMotionVariants}
      className={columnClass}
      onPointerEnter={() => onStageHover?.(stage)}
      style={columnStyle}
    >
      {columnBody}
    </motion.div>
  )
}

function DraggableContactCard({
  contact,
  slug,
  onSelect,
  onCreateDeliverProject,
  onOpenDeliverProject,
  deliverProjectId,
  onAppendActivity,
  quickNoteOpen,
  setQuickNoteOpen,
  selected,
  onToggleSelected,
  bulkActive,
  scrollEmbed = false,
  onSetFollowUpDays,
  onContextOpen,
}: {
  contact: Contact
  slug: string
  onSelect: () => void
  onContextOpen?: (event: ReactMouseEvent) => void
  onCreateDeliverProject: () => void
  onOpenDeliverProject?: () => void
  deliverProjectId?: string | null
  onAppendActivity: (contactId: string, text: string) => void
  quickNoteOpen: boolean
  setQuickNoteOpen: (open: boolean) => void
  selected: boolean
  onToggleSelected: () => void
  bulkActive: boolean
  scrollEmbed?: boolean
  onSetFollowUpDays: (contactId: string, daysFromNow: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: contact.id,
  })

  const overdue = isFollowUpOverdue(contact)
  const stageColor = STAGE_ACCENT[contact.pipeline_stage]
  const title = contactCardTitle(contact)
  const subtitle =
    contact.email?.trim() ||
    contact.phone?.trim() ||
    '—'

  const [hover, setHover] = useState(false)
  const swipeRef = useRef({ x: 0, swiped: false })
  const showChk = bulkActive || hover
  const potLabel = potenzialKanbanLabel(contact)
  const phone = contact.phone?.trim()
  const email = contact.email?.trim()
  const showQuickRow = (hover || quickNoteOpen) && (phone || email || contact.pipeline_stage !== 'deal')
  const linkRight = overdue ? 64 : 6
  const noteRight = overdue ? 110 : 52

  const style = {
    transform: isDragging ? undefined : CSS.Translate.toString(transform),
    transition: isDragging ? 'opacity 120ms ease' : undefined,
    opacity: isDragging ? 0.28 : 1,
    padding: scrollEmbed ? 12 : 10,
    paddingLeft: scrollEmbed ? 14 : 12,
    minHeight: scrollEmbed ? 72 : undefined,
    borderRadius: 10,
    background: isDragging ? 'var(--glass-3)' : 'var(--glass-1)',
    border: overdue
      ? '1px solid var(--accent-coral)'
      : selected
        ? '1px solid var(--accent-teal)'
        : isDragging
          ? '1px solid var(--glass-border-3)'
          : '1px solid var(--glass-border-2)',
    borderLeft: `4px solid ${stageColor}`,
    position: 'relative' as const,
    width: '100%',
    textAlign: 'left' as const,
    cursor: isDragging ? 'grabbing' : 'grab',
    touchAction: 'none' as const,
    boxShadow: isDragging
      ? 'var(--shadow-lg)'
      : undefined,
    zIndex: isDragging ? 50 : undefined,
  }

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...CARD_TILE_TAP}
      {...listeners}
      {...attributes}
      role="button"
      tabIndex={0}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      onTouchStart={(e) => {
        swipeRef.current.x = e.touches[0]?.clientX ?? 0
        swipeRef.current.swiped = false
      }}
      onTouchEnd={(e) => {
        if (!deliverProjectId || !onOpenDeliverProject) return
        const dx = (e.changedTouches[0]?.clientX ?? 0) - swipeRef.current.x
        if (dx > 80) {
          swipeRef.current.swiped = true
          onOpenDeliverProject()
        }
      }}
      onClick={() => {
        if (swipeRef.current.swiped) {
          swipeRef.current.swiped = false
          return
        }
        onSelect()
      }}
      onContextMenu={onContextOpen}
    >
      {showChk ? (
        <label
          className="absolute left-1 top-2 flex cursor-pointer items-center"
          style={{ zIndex: 4 }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelected}
            style={{ width: 14, height: 14, accentColor: 'var(--mode-sales)' }}
          />
        </label>
      ) : null}
      {overdue ? (
        <span
          className="font-mono"
          style={{
            position: 'absolute',
            top: 6,
            right: deliverProjectId ? 34 : 6,
            fontSize: 8,
            letterSpacing: '0.04em',
            padding: '3px 7px',
            borderRadius: 6,
            background: 'var(--accent-coral)',
            color: '#fff',
          }}
        >
          Überfällig
        </span>
      ) : null}
      {deliverProjectId && onOpenDeliverProject ? (
        <button
          type="button"
          title="Zum Projekt"
          className="font-mono"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            onOpenDeliverProject()
          }}
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            fontSize: 13,
            lineHeight: 1,
            width: 24,
            height: 24,
            borderRadius: 8,
            border: '1px solid color-mix(in srgb, var(--accent-teal) 45%, var(--glass-border-2))',
            background: 'color-mix(in srgb, var(--accent-teal) 12%, var(--glass-2))',
            color: 'var(--accent-teal)',
            cursor: 'pointer',
            zIndex: 4,
          }}
        >
          ◈
        </button>
      ) : null}
      <button
        type="button"
        title="Schnelle Notiz"
        className="font-mono"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseEnter={() => setHover(true)}
        onClick={(e) => {
          e.stopPropagation()
          setQuickNoteOpen(true)
        }}
        style={{
          position: 'absolute',
          top: 6,
          right: noteRight,
          fontSize: 14,
          lineHeight: 1,
          padding: 2,
          border: 'none',
          background: 'transparent',
          color: 'var(--text-tertiary)',
          cursor: 'pointer',
          zIndex: 3,
          opacity: hover || quickNoteOpen ? 1 : 0,
          transition: 'opacity 0.15s',
        }}
      >
        ✎
      </button>
      <Link
        to={`/brand/${slug}/sales/${contact.id}`}
        className="font-mono"
        title="Vollmaske"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          top: 6,
          right: linkRight,
          fontSize: 11,
          lineHeight: 1,
          color: 'var(--accent-blue)',
          textDecoration: 'none',
          zIndex: 2,
          opacity: 0.85,
        }}
      >
        ↗
      </Link>
      {quickNoteOpen ? (
        <QuickNotePopover
          onClose={() => setQuickNoteOpen(false)}
          onSave={(txt) => onAppendActivity(contact.id, `📝 ${txt}`)}
        />
      ) : null}
      <div
        className="font-display"
        style={{
          fontSize: scrollEmbed ? 13 : 14,
          fontWeight: 700,
          color: 'var(--text-primary)',
          paddingRight: 28,
          paddingTop: 2,
          marginLeft: showChk ? 18 : 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: scrollEmbed ? 'nowrap' : undefined,
        }}
      >
        {title}
      </div>
      <div
        className="font-mono mt-1"
        style={{
          fontSize: 10,
          color: 'var(--text-secondary)',
          wordBreak: scrollEmbed ? 'normal' : 'break-all',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: scrollEmbed ? 'nowrap' : undefined,
        }}
      >
        {subtitle}
      </div>
      {contact.next_follow_up_at ? (
        <div
          className="font-mono mt-1"
          style={{
            fontSize: 9,
            color: overdue ? 'var(--accent-coral)' : 'var(--text-tertiary)',
            fontWeight: overdue ? 600 : 400,
          }}
        >
          FU: {contact.next_follow_up_at.slice(0, 10)}
        </div>
      ) : null}
      {showQuickRow ? (
        <div
          className="mt-2 flex flex-wrap gap-1"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {phone ? (
            <a href={`tel:${phone.replace(/\s/g, '')}`} className="font-mono" style={cardQuickBtn}>
              ☎
            </a>
          ) : null}
          {email ? (
            <a href={`mailto:${email}`} className="font-mono" style={cardQuickBtn}>
              ✉
            </a>
          ) : null}
          {contact.pipeline_stage !== 'deal' ? (
            <>
              <button
                type="button"
                className="font-mono"
                style={cardQuickBtn}
                title="Follow-up morgen"
                onClick={() => onSetFollowUpDays(contact.id, 1)}
              >
                FU +1T
              </button>
              <button
                type="button"
                className="font-mono"
                style={cardQuickBtn}
                title="Follow-up in 3 Tagen"
                onClick={() => onSetFollowUpDays(contact.id, 3)}
              >
                +3T
              </button>
            </>
          ) : null}
        </div>
      ) : null}
      {potLabel ? (
        <div
          className="font-mono mt-2 inline-block rounded-md px-2 py-0.5"
          style={{
            fontSize: 9,
            color: 'var(--accent-teal)',
            background: 'color-mix(in srgb, var(--accent-teal) 12%, transparent)',
            border: '1px solid color-mix(in srgb, var(--accent-teal) 40%, transparent)',
          }}
        >
          {potLabel}
        </div>
      ) : null}
      {contact.pipeline_stage === 'deal' ? (
        deliverProjectId && onOpenDeliverProject ? (
          <button
            type="button"
            className="font-mono mt-2"
            style={{
              fontSize: 10,
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid var(--accent-teal)',
              color: 'var(--accent-teal)',
              background: 'var(--glass-2)',
              width: '100%',
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              onOpenDeliverProject()
            }}
          >
            → Zum Projekt
          </button>
        ) : (
          <button
            type="button"
            className="font-mono mt-2"
            style={{
              fontSize: 10,
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid var(--accent-teal)',
              color: 'var(--accent-teal)',
              background: 'var(--glass-2)',
              width: '100%',
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              onCreateDeliverProject()
            }}
          >
            Projekt anlegen
          </button>
        )
      ) : null}
    </motion.div>
  )
}

const KANBAN_COLUMN_CAP = 50

function PipelineBoard({
  contacts,
  slug,
  deliverProjects,
  onMoveToStage,
  onSelectContact,
  onCreateDeliverProject,
  onAppendActivity,
  quickNoteId,
  setQuickNoteId,
  selectedIds,
  onToggleSelected,
  bulkActive,
  onColumnHover,
  scrollEmbed = false,
  onSetFollowUpDays,
  columnSort,
  onContactContextMenu,
}: {
  contacts: Contact[]
  slug: string
  deliverProjects: DeliverProject[]
  onMoveToStage: (contactId: string, stage: PipelineStage) => void
  onSelectContact: (id: string) => void
  onContactContextMenu?: (id: string, event: React.MouseEvent) => void
  onCreateDeliverProject: (contact: Contact) => void
  onSetFollowUpDays: (contactId: string, daysFromNow: number) => void
  onAppendActivity: (contactId: string, text: string) => void
  quickNoteId: string | null
  setQuickNoteId: (id: string | null) => void
  selectedIds: Set<string>
  onToggleSelected: (id: string) => void
  bulkActive: boolean
  onColumnHover?: (stage: PipelineStage | null) => void
  scrollEmbed?: boolean
  columnSort: KanbanColumnSort
}) {
  const navigate = useNavigate()
  const skipClickRef = useRef(false)
  const markSkipClick = useCallback(() => {
    skipClickRef.current = true
    window.setTimeout(() => {
      skipClickRef.current = false
    }, 220)
  }, [])

  const [activeDrag, setActiveDrag] = useState<Contact | null>(null)
  const [dragOverStage, setDragOverStage] = useState<PipelineStage | null>(null)
  const lastOverStageRef = useRef<PipelineStage | null>(null)
  const [expandedStages, setExpandedStages] = useState<Set<PipelineStage>>(() => new Set())

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 10 },
    }),
  )

  const resolveTargetStage = useCallback(
    (overId: string | number | null | undefined): PipelineStage | null => {
      if (overId == null) return null
      const oid = String(overId)
      if ((STAGES as readonly string[]).includes(oid))
        return oid as PipelineStage
      const overContact = contacts.find((c) => c.id === oid)
      return overContact ? overContact.pipeline_stage : null
    },
    [contacts],
  )

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const stage = resolveTargetStage(event.over?.id)
      lastOverStageRef.current = stage
      setDragOverStage(stage)
    },
    [resolveTargetStage],
  )

  const handleDragEnd = (event: DragEndEvent) => {
    markSkipClick()
    setActiveDrag(null)
    setDragOverStage(null)
    const { active, over } = event
    const target =
      resolveTargetStage(over?.id) ?? lastOverStageRef.current
    lastOverStageRef.current = null
    if (!target) return
    const activeId = String(active.id)
    const contact = contacts.find((c) => c.id === activeId)
    if (!contact || contact.pipeline_stage === target) return
    onMoveToStage(activeId, target)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={kanbanCollisionDetection}
      onDragStart={({ active }: DragStartEvent) => {
        setActiveDrag(
          contacts.find((c) => c.id === String(active.id)) ?? null,
        )
      }}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        markSkipClick()
        setActiveDrag(null)
        setDragOverStage(null)
        lastOverStageRef.current = null
      }}
    >
      <motion.div
        className="flex overflow-x-auto pb-2 overscroll-x-contain sales-scroll-kanban"
        style={{ WebkitOverflowScrolling: 'touch', gap: 12 }}
        variants={scrollEmbed ? KANBAN_EMBED_VARIANTS : KANBAN_WRAP_VARIANTS}
        initial="hidden"
        animate="visible"
        onPointerLeave={() => onColumnHover?.(null)}
      >
        {STAGES.map((stage) => {
          const list = sortPipelineContacts(
            contacts.filter((c) => c.pipeline_stage === stage),
            columnSort,
          )
          const expanded = expandedStages.has(stage)
          const capped = !expanded && list.length > KANBAN_COLUMN_CAP
          const visible = capped ? list.slice(0, KANBAN_COLUMN_CAP) : list
          const hiddenCount = capped ? list.length - KANBAN_COLUMN_CAP : 0
          return (
            <DroppableStageColumn
              key={stage}
              stage={stage}
              onStageHover={onColumnHover}
              scrollEmbed={scrollEmbed}
              cardCount={list.length}
              isDragActive={!!activeDrag}
              isDropTarget={dragOverStage === stage}
              columnMotionVariants={
                scrollEmbed ? KANBAN_EMBED_COLUMN_VARIANTS : KANBAN_COLUMN_VARIANTS
              }
            >
                {visible.map((c) => {
                  const linkedProject = findDeliverProjectForContact(deliverProjects, c)
                  const deliverProjectId = linkedProject?.id ?? c.deliver_project_id ?? null
                  return (
                  <DraggableContactCard
                    key={c.id}
                    contact={c}
                    slug={slug}
                    scrollEmbed={scrollEmbed}
                    deliverProjectId={deliverProjectId}
                    onOpenDeliverProject={
                      deliverProjectId
                        ? () => navigate(`/projekte/${deliverProjectId}`)
                        : undefined
                    }
                    onSelect={() => {
                      if (skipClickRef.current) return
                      onSelectContact(c.id)
                    }}
                    onContextOpen={(e) => onContactContextMenu?.(c.id, e)}
                    onCreateDeliverProject={() => onCreateDeliverProject(c)}
                    onAppendActivity={onAppendActivity}
                    quickNoteOpen={quickNoteId === c.id}
                    setQuickNoteOpen={(open) => setQuickNoteId(open ? c.id : null)}
                    selected={selectedIds.has(c.id)}
                    onToggleSelected={() => onToggleSelected(c.id)}
                    bulkActive={bulkActive}
                    onSetFollowUpDays={onSetFollowUpDays}
                  />
                  )
                })}
              {hiddenCount > 0 ? (
                <button
                  type="button"
                  onClick={() =>
                    setExpandedStages((prev) => new Set([...prev, stage]))
                  }
                  style={{
                    marginTop: 8,
                    width: '100%',
                    fontSize: 11,
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px dashed var(--glass-border-2)',
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  +{hiddenCount} weitere anzeigen
                </button>
              ) : expanded && list.length > KANBAN_COLUMN_CAP ? (
                <button
                  type="button"
                  onClick={() =>
                    setExpandedStages((prev) => {
                      const next = new Set(prev)
                      next.delete(stage)
                      return next
                    })
                  }
                  style={{
                    marginTop: 8,
                    width: '100%',
                    fontSize: 11,
                    padding: '6px 10px',
                    borderRadius: 8,
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-tertiary)',
                    cursor: 'pointer',
                  }}
                >
                  Weniger anzeigen
                </button>
              ) : null}
            </DroppableStageColumn>
          )
        })}
      </motion.div>
      <DragOverlay dropAnimation={null}>
        {activeDrag ? (
          <div
            style={{
              padding: 10,
              paddingLeft: 12,
              borderRadius: 10,
              background: 'var(--glass-3)',
              border: '1px solid var(--mode-sales)',
              borderLeft: `4px solid ${STAGE_ACCENT[activeDrag.pipeline_stage]}`,
              boxShadow: 'var(--shadow-lg)',
              minWidth: 168,
              cursor: 'grabbing',
            }}
          >
            <div
              className="font-display"
              style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}
            >
              {contactCardTitle(activeDrag)}
            </div>
            <div
              className="font-mono"
              style={{ fontSize: 9, marginTop: 4, color: 'var(--text-tertiary)' }}
            >
              → {dragOverStage ? STAGE_LABEL[dragOverStage] : 'Spalte wählen'}
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

export function SalesMode({
  panel = 'full',
  scrollEmbed = false,
  headerActionsRef,
  headerActionsReady = false,
}: {
  panel?: 'full' | 'pipeline'
  scrollEmbed?: boolean
  headerActionsRef?: RefObject<HTMLDivElement | null>
  headerActionsReady?: boolean
} = {}) {
  const slug = useCurrentBrandSlug()
  const navigate = useNavigate()
  // brandId wird in den Hooks (useBrandId) intern verwendet; hier nicht mehr direkt nötig.
  const { show: showToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const salesTab: 'pipeline' | 'listen' =
    searchParams.get('tab') === 'listen' ? 'listen' : 'pipeline'

  const setSalesTab = useCallback(
    (t: 'pipeline' | 'listen') => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (t === 'listen') next.set('tab', 'listen')
          else next.delete('tab')
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const contacts = useContacts(slug)
  const deliver = useDeliverProjects(slug)
  const opportunities = useOpportunities()
  const contactLists = useContactLists(slug)

  const [viewMode, setViewMode] = useState<PipelineViewMode>(() => (slug ? loadPipelineView(slug) : 'cards'))
  const [kanbanColumnSort, setKanbanColumnSort] = useState<KanbanColumnSort>(() =>
    slug ? loadKanbanColumnSort(slug) : 'follow_up',
  )
  const [crmFilters, setCrmFilters] = useState<CrmFilterState>(() => (slug ? loadCrmFilters(slug) : EMPTY_CRM_FILTERS))
  const [filterOpen, setFilterOpen] = useState(false)

  useEffect(() => {
    if (slug) savePipelineView(slug, viewMode)
  }, [slug, viewMode])

  useEffect(() => {
    if (slug) saveKanbanColumnSort(slug, kanbanColumnSort)
  }, [slug, kanbanColumnSort])

  useEffect(() => {
    if (slug) saveCrmFilters(slug, crmFilters)
  }, [slug, crmFilters])

  const [pipeQ, setPipeQ] = useState('')
  const [pipeStage, setPipeStage] = useState<StageFilter>('all')
  const [pipeFollow, setPipeFollow] = useState<FollowFilter>('all')
  const [pipePotenzial, setPipePotenzial] = useState<PotenzialFilter>('all')
  const [productFilter, setProductFilter] = useState<'all' | 'herrmann' | 'wertavio' | 'culturefit'>('all')

  useEffect(() => {
    const ids = contacts.items.map((c) => c.id)
    if (ids.length === 0) {
      void opportunities.loadForContacts([])
      return
    }
    void opportunities.loadForContacts(ids)
  }, [contacts.items, opportunities.loadForContacts])

  const filteredPipeline = useMemo(() => {
    const base = filterPipelineContacts(contacts.items, {
      q: pipeQ,
      stage: pipeStage,
      follow: pipeFollow,
      potenzial: pipePotenzial,
    })
    const crmFiltered = applyCrmFilters(base, crmFilters)
    if (productFilter === 'all') return crmFiltered
    const contactIds = new Set(
      opportunities.items
        .filter((o) => o.product === productFilter)
        .map((o) => o.contact_id),
    )
    return crmFiltered.filter((c) => contactIds.has(c.id))
  }, [contacts.items, crmFilters, opportunities.items, pipeFollow, pipePotenzial, pipeQ, pipeStage, productFilter])

  const sortedPipeline = useMemo(
    () => sortPipelineContacts(filteredPipeline, kanbanColumnSort),
    [filteredPipeline, kanbanColumnSort],
  )

  const crmFiltersActive = useMemo(() => {
    return (
      crmFilters.statuses.length > 0 ||
      crmFilters.stages.length > 0 ||
      crmFilters.listIds.length > 0 ||
      crmFilters.sources.length > 0 ||
      crmFilters.activity !== 'all' ||
      crmFilters.followDue !== 'all'
    )
  }, [crmFilters])

  const pipelineValue = useMemo(
    () => pipelineValueEuro(contacts.items),
    [contacts.items],
  )

  const filtersActive = useMemo(() => {
    return (
      pipeQ.trim().length > 0 ||
      pipeStage !== 'all' ||
      pipeFollow !== 'all' ||
      pipePotenzial !== 'all'
    )
  }, [pipeFollow, pipePotenzial, pipeQ, pipeStage])

  const resetFilters = useCallback(() => {
    setPipeQ('')
    setPipeStage('all')
    setPipeFollow('all')
    setPipePotenzial('all')
  }, [])

  const [quickNoteId, setQuickNoteId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const bulkActive = selectedIds.size > 0

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const [bulkStagePick, setBulkStagePick] = useState<PipelineStage>('first_contact')
  const [bulkFollowYmd, setBulkFollowYmd] = useState('')
  const [columnHover, setColumnHover] = useState<PipelineStage | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (salesTab !== 'pipeline' || contacts.loading) return
      const t = e.target as HTMLElement
      if (t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA' || t?.tagName === 'SELECT')
        return
      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault()
        const pick = filteredPipeline.filter((c) =>
          columnHover ? c.pipeline_stage === columnHover : true,
        )
        setSelectedIds(new Set(pick.map((c) => c.id)))
      }
      if (e.key === 'Escape') {
        setSelectedIds(new Set())
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [columnHover, contacts.loading, filteredPipeline, salesTab])

  const appendActivity = useCallback(
    (contactId: string, text: string) => {
      const c = contacts.items.find((x) => x.id === contactId)
      if (!c) return
      const entry = { id: generateId(), text, at: new Date().toISOString() }
      contacts.update(contactId, { activity_log: [...c.activity_log, entry] })
      setQuickNoteId(null)
    },
    [contacts],
  )

  const handleSetFollowUpDays = useCallback(
    (contactId: string, daysFromNow: number) => {
      const iso = followUpIsoDaysFromNow(daysFromNow, 9)
      contacts.update(contactId, {
        next_follow_up_at: iso,
        follow_up_type: 'call',
      })
      showToast(
        daysFromNow === 1 ? 'Follow-up: morgen' : `Follow-up: +${daysFromNow} Tage`,
        'success',
      )
    },
    [contacts, showToast],
  )

  const callModeSearch = useMemo(() => {
    const p = new URLSearchParams()
    p.set('source', 'pipeline')
    if (pipeQ.trim()) p.set('pipeQ', pipeQ.trim())
    if (pipeStage !== 'all') p.set('pipeStage', pipeStage)
    if (pipeFollow !== 'all') p.set('pipeFollow', pipeFollow)
    if (pipePotenzial !== 'all') p.set('pipePotenzial', pipePotenzial)
    return p.toString()
  }, [pipeFollow, pipePotenzial, pipeQ, pipeStage])

  const quickLead = useSalesQuickLead(slug ?? '', callModeSearch)

  const pipelineStats = useMemo(() => {
    const items = contacts.items
    const active = items.filter((c) => c.pipeline_stage !== 'paused')
    const dueToday = active.filter((c) => isFollowUpDueTodayOrBefore(c.next_follow_up_at))
    const wk0 = startOfWeekMondayMs()
    const weekDeals = items.filter(
      (c) => c.pipeline_stage === 'deal' && new Date(c.updated_at).getTime() >= wk0,
    )
    return {
      totalInPipeline: active.length,
      dueTodayCount: dueToday.length,
      weekClosedCount: weekDeals.length,
      dueTodayList: dueToday,
    }
  }, [contacts.items])

  // Sales-Pro Drawer
  // Auto-seed default pipeline (Hook initialisiert sie selbst, wenn keine existiert)
  useSalesPipelines(slug)
  const [activePipelineSlug, setActivePipelineSlug] = useState<string | null>(null)
  const [tplDrawerOpen, setTplDrawerOpen] = useState(false)

  useEffect(() => {
    if (searchParams.get('drawer') !== 'email-templates') return
    setTplDrawerOpen(true)
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('drawer')
        return next
      },
      { replace: true },
    )
  }, [searchParams, setSearchParams])
  const [goalsDrawerOpen, setGoalsDrawerOpen] = useState(false)
  const [importDrawerOpen, setImportDrawerOpen] = useState(false)
  const [meetingDrawerOpen, setMeetingDrawerOpen] = useState(false)
  const [bulkTagInput, setBulkTagInput] = useState('')

  const handleCreateDeliverFromContact = useCallback(
    (contact: Contact) => {
      if (!slug) return
      void deliver
        .create({
          name: `${contact.name || 'Kontakt'} — Projekt`,
          client_name: contact.name ?? '',
          client_email: contact.email?.trim() ?? '',
          client_contact_id: contact.id,
          internal_stage: 'onboarding',
          client_stage: 'onboarding',
          status: 'active',
        })
        .then((proj) => navigate(`/projekte/${proj.id}`))
    },
    [deliver, navigate, slug],
  )

  const selectedContactList = useMemo(
    () => contacts.items.filter((c) => selectedIds.has(c.id)),
    [contacts.items, selectedIds],
  )

  const callablePipeline = useMemo(
    () => sortedPipeline.filter((c) => c.phone?.trim()),
    [sortedPipeline],
  )

  const notifyTabsResult = useCallback(
    (result: { opened: number; blocked: number }) => {
      if (result.opened === 0) {
        showToast('Keine Tabs geöffnet — Popup-Blocker prüfen', 'info')
        return
      }
      if (result.blocked > 0) {
        showToast(`${result.opened} Tabs geöffnet · ${result.blocked} blockiert`, 'info')
      } else {
        showToast(`${result.opened} Tab${result.opened === 1 ? '' : 's'} geöffnet`, 'success')
      }
    },
    [showToast],
  )

  const { go: goBrand, openNewTab } = useBrandNavigate(slug ?? '')
  const { state: ctxMenu, close: closeCtx, openAt: openCtxAt, runAction: runCtxAction } =
    useWorkspaceContextMenu()

  const openContact = useCallback(
    (id: string) => {
      if (!slug) return
      goBrand(contactSalesPath(slug, id))
    },
    [goBrand, slug],
  )

  const onContactContextMenu = useCallback(
    (id: string, event: React.MouseEvent) => {
      if (!slug) return
      openCtxAt(event, () => openNewTab(contactSalesPath(slug, id)))
    },
    [openCtxAt, openNewTab, slug],
  )

  const openFilteredBatchTabs = useCallback(
    (count: number) => {
      if (!slug) return
      const ids = callablePipeline.slice(0, count).map((c) => c.id)
      const result = openContactsInTabs(slug, ids)
      notifyTabsResult(result)
      if (ids[0]) goBrand(contactSalesPath(slug, ids[0]))
    },
    [callablePipeline, goBrand, notifyTabsResult, slug],
  )

  const applyBulkOpenTabs = useCallback(() => {
    if (!slug) return
    const ids = sortedPipeline.filter((c) => selectedIds.has(c.id)).map((c) => c.id)
    const result = openContactsInTabs(slug, ids)
    notifyTabsResult(result)
    if (ids[0]) goBrand(contactSalesPath(slug, ids[0]))
  }, [goBrand, notifyTabsResult, selectedIds, slug, sortedPipeline])

  const applyBulkStage = useCallback(() => {
    for (const c of selectedContactList) {
      contacts.update(c.id, { pipeline_stage: bulkStagePick })
    }
    setSelectedIds(new Set())
  }, [bulkStagePick, contacts, selectedContactList])

  const applyBulkFollow = useCallback(() => {
    const iso =
      bulkFollowYmd.trim() === ''
        ? null
        : new Date(bulkFollowYmd + 'T12:00:00').toISOString()
    for (const c of selectedContactList) {
      contacts.update(c.id, { next_follow_up_at: iso })
    }
    setSelectedIds(new Set())
    setBulkFollowYmd('')
  }, [bulkFollowYmd, contacts, selectedContactList])

  const applyBulkDelete = useCallback(() => {
    const n = selectedContactList.length
    if (
      n === 0 ||
      !window.confirm(`${n} Kontakt${n === 1 ? '' : 'e'} wirklich löschen?`)
    )
      return
    void (async () => {
      contacts.clearError()
      let failed = 0
      for (const c of selectedContactList) {
        const ok = await contacts.remove(c.id)
        if (!ok) failed++
      }
      void contacts.reload()
      setSelectedIds(new Set())
      if (failed > 0) {
        showToast(
          `${failed} Kontakt${failed === 1 ? '' : 'e'} konnte${failed === 1 ? '' : 'n'} nicht gelöscht werden`,
          'error',
        )
      } else if (n > 0) {
        showToast(`${n} Kontakt${n === 1 ? '' : 'e'} gelöscht`, 'success')
      }
    })()
  }, [contacts, selectedContactList, showToast])

  const applyBulkTag = useCallback(() => {
    const tag = bulkTagInput.trim()
    if (!tag) return
    for (const c of selectedContactList) {
      const existing = Array.isArray(c.tags) ? c.tags : []
      if (existing.includes(tag)) continue
      contacts.update(c.id, { tags: [...existing, tag] })
    }
    setBulkTagInput('')
    showToast(`Tag "${tag}" gesetzt`, 'success')
  }, [bulkTagInput, contacts, selectedContactList, showToast])

  const pipelineTotal = contacts.items.length
  const pipelineFilteredCount = filteredPipeline.length

  if (!slug) {
    return null
  }

  return (
    <motion.div
      key={slug}
      initial={scrollEmbed ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: scrollEmbed ? 0 : 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={{ background: 'transparent', pointerEvents: 'auto', height: scrollEmbed ? '100%' : undefined }}
    >
      {!scrollEmbed ? (
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div
            className="font-mono"
            style={{
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--mode-sales)',
              marginBottom: 6,
            }}
          >
            Sales Mode
          </div>
          <h2
            className="font-display"
            style={{
              fontSize: 22,
              fontWeight: 600,
              color: 'var(--text-primary)',
              letterSpacing: '-0.3px',
            }}
          >
            Pipeline &amp; Kontakte ({pipelineFilteredCount} von {pipelineTotal})
          </h2>
          {slug ? (
            <div className="mt-3">
              <PipelineSwitcher
                brandSlug={slug}
                selectedSlug={activePipelineSlug}
                onChange={setActivePipelineSlug}
              />
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {(['pipeline', 'listen'] as const).map((t) => {
              const on = salesTab === t
              return (
                <button
                  key={t}
                  type="button"
                  className="font-mono"
                  onClick={() => setSalesTab(t)}
                  style={{
                    fontSize: 11,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    padding: '8px 14px',
                    borderRadius: 10,
                    border: on ? '1px solid var(--mode-sales)' : '1px solid var(--glass-border-2)',
                    background: on
                      ? 'color-mix(in srgb, var(--mode-sales) 16%, transparent)'
                      : 'var(--glass-2)',
                    color: on ? 'var(--mode-sales)' : 'var(--text-tertiary)',
                    cursor: 'pointer',
                  }}
                >
                  {t === 'pipeline' ? 'Pipeline' : 'Listen'}
                </button>
              )
            })}
          </div>
        </div>
        {!contacts.loading && !contacts.error ? (
          <div className="flex flex-wrap items-center gap-2" style={{ position: 'relative' }}>
            <CrmToolbar
              onNewLead={() => quickLead.openQuickLead()}
              onToggleFilter={() => setFilterOpen((v) => !v)}
              filterActive={crmFiltersActive}
            />
            <CrmFilterPanel
              open={filterOpen}
              filters={crmFilters}
              lists={contactLists.lists}
              onChange={setCrmFilters}
              onClose={() => setFilterOpen(false)}
            />
            <button
              type="button"
              onClick={() => setTplDrawerOpen(true)}
              className="font-mono"
              style={proSettingsBtn}
              title="E-Mail-Templates verwalten"
            >
              ✉ Templates
            </button>
            <button
              type="button"
              onClick={() => setGoalsDrawerOpen(true)}
              className="font-mono"
              style={proSettingsBtn}
              title="Wochenziele setzen"
            >
              ◎ Ziele
            </button>
            <button
              type="button"
              onClick={() => setImportDrawerOpen(true)}
              className="font-mono"
              style={proSettingsBtn}
              title="CSV-Import"
            >
              ⇪ Import
            </button>
            <button
              type="button"
              onClick={() => setMeetingDrawerOpen(true)}
              className="font-mono"
              style={proSettingsBtn}
              title="Buchungslink konfigurieren"
            >
              📅 Buchungslink
            </button>
          </div>
        ) : null}
      </div>
      ) : null}

      {salesTab === 'listen' && !scrollEmbed ? (
        <ContactListsContent slug={slug} embedded />
      ) : (
        <>
          {scrollEmbed && headerActionsRef && headerActionsReady ? (
            <quickLead.ActionBar compact mountRef={headerActionsRef} />
          ) : scrollEmbed && !headerActionsRef ? (
            <div className="shrink-0" style={{ padding: '4px 4px 10px' }}>
              <quickLead.ActionBar compact />
            </div>
          ) : null}

          {contacts.loading ? (
            <div
              className="animate-pulse"
              style={{
                minHeight: 220,
                borderRadius: 16,
                background: 'var(--glass-1)',
                border: '1px solid var(--glass-border-1)',
              }}
            />
          ) : null}

          {contacts.error ? (
            <div
              className="font-mono"
              style={{ fontSize: 12, color: 'var(--accent-coral)' }}
            >
              Kontakte konnten nicht geladen werden: {contacts.error}
            </div>
          ) : null}

          {!contacts.loading && !contacts.error && panel === 'full' ? (
            <div
              className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
            >
              {(
                [
                  {
                    k: 'Gesamt in Pipeline',
                    v: String(pipelineStats.totalInPipeline),
                    active:
                      pipeFollow === 'all' &&
                      pipeStage === 'all' &&
                      pipePotenzial === 'all' &&
                      !pipeQ.trim() &&
                      productFilter === 'all',
                    onClick: () => resetFilters(),
                  },
                  {
                    k: 'Heute fällig',
                    v: String(pipelineStats.dueTodayCount),
                    active: pipeFollow === 'today',
                    onClick: () =>
                      setPipeFollow((f) => (f === 'today' ? 'all' : 'today')),
                  },
                  {
                    k: 'Diese Woche abgeschlossen',
                    v: String(pipelineStats.weekClosedCount),
                    active: false,
                    onClick: undefined,
                  },
                  {
                    k: 'Pipeline-Wert',
                    v: formatEuroDe(pipelineValue),
                    active: false,
                    onClick: undefined,
                  },
                ] as const
              ).map((s) => (
                <button
                  key={s.k}
                  type="button"
                  className="glass-2 rounded-xl px-4 py-3"
                  onClick={s.onClick}
                  title={
                    s.k === 'Heute fällig'
                      ? 'Kanban auf heute fällige Follow-ups filtern (erneut klicken = alle)'
                      : s.k === 'Gesamt in Pipeline'
                        ? 'Alle Filter zurücksetzen'
                        : undefined
                  }
                  style={{
                    border: s.active
                      ? '1px solid var(--mode-sales)'
                      : '1px solid var(--glass-border-1)',
                    textAlign: 'left',
                    cursor: s.onClick ? 'pointer' : 'default',
                    background: s.active
                      ? 'color-mix(in srgb, var(--mode-sales) 10%, var(--glass-2))'
                      : 'var(--glass-2)',
                    width: '100%',
                  }}
                >
                  <div
                    className="font-mono"
                    style={{ fontSize: 9, color: 'var(--text-tertiary)', marginBottom: 6 }}
                  >
                    {s.k}
                  </div>
                  <div
                    className="font-display"
                    style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}
                  >
                    {s.v}
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          {!contacts.loading && !contacts.error ? (
            <div className="mb-5">
              <PipelineFilterBar
                q={pipeQ}
                setQ={setPipeQ}
                stage={pipeStage}
                setStage={setPipeStage}
                follow={pipeFollow}
                setFollow={setPipeFollow}
                potenzial={pipePotenzial}
                setPotenzial={setPipePotenzial}
                productFilter={productFilter}
                setProductFilter={setProductFilter}
                onReset={resetFilters}
                filtersActive={filtersActive}
                kanbanColumnSort={kanbanColumnSort}
                onKanbanColumnSortChange={setKanbanColumnSort}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                onOpenBatchTabs={openFilteredBatchTabs}
                callableCount={callablePipeline.length}
              />
            </div>
          ) : null}

          {!scrollEmbed ? (
            <SectionLabel accent="var(--mode-sales)" tight>
              Pipeline
            </SectionLabel>
          ) : null}

          {!contacts.loading && !contacts.error ? (
            viewMode === 'table' ? (
              <PipelineTableView
                contacts={sortedPipeline}
                allContacts={contacts.items}
                onOpen={openContact}
                onContextOpen={onContactContextMenu}
              />
            ) : viewMode === 'list' ? (
              <PipelineListView
                contacts={sortedPipeline}
                onOpen={openContact}
                onContextOpen={onContactContextMenu}
              />
            ) : viewMode === 'carousel' ? (
              <PipelineCarouselView
                contacts={sortedPipeline}
                onOpen={openContact}
                onContextOpen={onContactContextMenu}
              />
            ) : (
              <PipelineBoard
                contacts={filteredPipeline}
                slug={slug}
                deliverProjects={deliver.items}
                scrollEmbed={scrollEmbed}
                columnSort={kanbanColumnSort}
                onMoveToStage={(id, stage) =>
                  contacts.update(id, { pipeline_stage: stage })
                }
                onSelectContact={openContact}
                onContactContextMenu={onContactContextMenu}
                onCreateDeliverProject={handleCreateDeliverFromContact}
                onAppendActivity={appendActivity}
                quickNoteId={quickNoteId}
                setQuickNoteId={setQuickNoteId}
                selectedIds={selectedIds}
                onToggleSelected={toggleSelect}
                bulkActive={bulkActive}
                onColumnHover={setColumnHover}
                onSetFollowUpDays={handleSetFollowUpDays}
              />
            )
          ) : null}

          {!contacts.loading && !contacts.error && bulkActive ? (
            <div
              className="glass-2 font-mono"
              style={{
                position: 'fixed',
                bottom: 20,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 60,
                width: 'min(640px, calc(100vw - 32px))',
                padding: '14px 16px',
                borderRadius: 14,
                border: '1px solid var(--glass-border-1)',
                boxShadow: 'var(--shadow-lg)',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 10,
                pointerEvents: 'auto',
                fontSize: 11,
                color: 'var(--text-primary)',
              }}
            >
              <span style={{ fontWeight: 600 }}>
                {selectedIds.size} Kontakt{selectedIds.size === 1 ? '' : 'e'} ausgewählt
              </span>
              <button
                type="button"
                onClick={applyBulkOpenTabs}
                title="Ausgewählte Leads in neuen Tabs öffnen (⌘/Strg+Klick auf Karte)"
                style={{
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--mode-sales)',
                  background: 'color-mix(in srgb, var(--mode-sales) 12%, transparent)',
                  color: 'var(--mode-sales)',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                ↗ Tabs öffnen
              </button>
              <select
                value={bulkStagePick}
                onChange={(e) => setBulkStagePick(e.target.value as PipelineStage)}
                style={{
                  fontSize: 11,
                  padding: '6px 8px',
                  borderRadius: 8,
                  border: '1px solid var(--glass-border-2)',
                  background: 'var(--glass-1)',
                  color: 'var(--text-primary)',
                }}
              >
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {STAGE_LABEL[s]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={applyBulkStage}
                style={{
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--mode-sales)',
                  background: 'color-mix(in srgb, var(--mode-sales) 12%, transparent)',
                  color: 'var(--mode-sales)',
                  cursor: 'pointer',
                }}
              >
                Stage ändern
              </button>
              <input
                type="date"
                value={bulkFollowYmd}
                onChange={(e) => setBulkFollowYmd(e.target.value)}
                style={{
                  fontSize: 11,
                  padding: '6px 8px',
                  borderRadius: 8,
                  border: '1px solid var(--glass-border-2)',
                  background: 'var(--glass-1)',
                  color: 'var(--text-primary)',
                }}
              />
              <button
                type="button"
                onClick={applyBulkFollow}
                style={{
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--accent-teal)',
                  background: 'color-mix(in srgb, var(--accent-teal) 12%, transparent)',
                  color: 'var(--accent-teal)',
                  cursor: 'pointer',
                }}
              >
                Follow-up setzen
              </button>
              <input
                type="text"
                value={bulkTagInput}
                onChange={(e) => setBulkTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    applyBulkTag()
                  }
                }}
                placeholder="Tag …"
                style={{
                  fontSize: 11,
                  padding: '6px 8px',
                  width: 90,
                  borderRadius: 8,
                  border: '1px solid var(--glass-border-2)',
                  background: 'var(--glass-1)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={applyBulkTag}
                disabled={!bulkTagInput.trim()}
                style={{
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--glass-border-2)',
                  background: 'var(--glass-1)',
                  color: 'var(--text-secondary)',
                  cursor: bulkTagInput.trim() ? 'pointer' : 'not-allowed',
                  opacity: bulkTagInput.trim() ? 1 : 0.5,
                }}
              >
                + Tag
              </button>
              <button
                type="button"
                onClick={applyBulkDelete}
                style={{
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--accent-coral)',
                  color: 'var(--accent-coral)',
                  background: 'transparent',
                  cursor: 'pointer',
                }}
              >
                Löschen
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                style={{
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--glass-border-2)',
                  background: 'var(--glass-3)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  marginLeft: 'auto',
                }}
              >
                Abwählen
              </button>
            </div>
          ) : null}


        </>
      )}

      <quickLead.DrawerEl />
      <quickLead.DupModalEl />

      <EmailTemplatesDrawer
        open={tplDrawerOpen}
        onClose={() => setTplDrawerOpen(false)}
        brandSlug={slug}
      />
      <SalesGoalsDrawer
        open={goalsDrawerOpen}
        onClose={() => setGoalsDrawerOpen(false)}
        brandSlug={slug}
      />
      <SalesImportDrawer
        open={importDrawerOpen}
        onClose={() => setImportDrawerOpen(false)}
        brandSlug={slug}
      />
      <SalesMeetingLinkDrawer
        open={meetingDrawerOpen}
        onClose={() => setMeetingDrawerOpen(false)}
        brandSlug={slug}
      />
      <WorkspaceContextMenu
        open={ctxMenu.open}
        x={ctxMenu.x}
        y={ctxMenu.y}
        onOpenInNewTab={runCtxAction}
        onClose={closeCtx}
      />
    </motion.div>
  )
}

const proSettingsBtn: React.CSSProperties = {
  fontSize: 11,
  padding: '8px 12px',
  borderRadius: 10,
  border: '1px solid var(--glass-border-2)',
  background: 'var(--glass-2)',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
}
