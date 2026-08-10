import type { MouseEvent } from 'react'
import type { Contact, PipelineStage } from '../../types/db'
import { contactCardTitle } from '../../lib/pipelineContactSort'
import { STAGE_LABEL } from '../../lib/salesPipelineFilters'

const STAGE_ACCENT: Record<PipelineStage, string> = {
  first_contact: 'var(--mode-sales)',
  conversation: 'var(--accent-blue)',
  follow_up: 'var(--accent-amber)',
  proposal: 'var(--accent-teal)',
  deal: 'var(--accent-success)',
  paused: 'var(--text-tertiary)',
}

function isFollowUpOverdue(contact: Contact): boolean {
  if (!contact.next_follow_up_at) return false
  if (contact.pipeline_stage === 'deal' || contact.pipeline_stage === 'paused') return false
  const ymd = contact.next_follow_up_at.slice(0, 10)
  const t = new Date()
  const today = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
  return ymd <= today
}

function formatFollowUp(iso: string | null): string {
  if (!iso) return 'Kein Follow-up'
  const d = iso.slice(0, 10).split('-')
  if (d.length !== 3) return iso.slice(0, 10)
  return `Follow-up ${d[2]}.${d[1]}.${d[0]}`
}

export function PipelineCarouselView({
  contacts,
  onOpen,
  onContextOpen,
}: {
  contacts: Contact[]
  onOpen: (id: string) => void
  onContextOpen?: (id: string, event: MouseEvent) => void
}) {
  if (contacts.length === 0) {
    return (
      <p className="font-mono py-8 text-center" style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
        Keine Leads für die aktuelle Filterung.
      </p>
    )
  }

  return (
    <div
      className="pipeline-carousel-track sales-scroll-kanban -mx-1 px-1 pb-2"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {contacts.map((c) => {
        const overdue = isFollowUpOverdue(c)
        const stageColor = STAGE_ACCENT[c.pipeline_stage]
        const company = c.company?.trim()
        const meta =
          company ||
          c.email?.trim() ||
          c.phone?.trim() ||
          '—'
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onOpen(c.id)}
            onContextMenu={(e) => onContextOpen?.(c.id, e)}
            className="pipeline-carousel-card glass-2 font-mono shrink-0 text-left"
            style={{
              border: overdue
                ? '1px solid var(--accent-coral)'
                : '1px solid var(--glass-border-1)',
              borderLeft: `5px solid ${stageColor}`,
              cursor: 'pointer',
              minHeight: 200,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: 18,
            }}
          >
            <div>
              {overdue ? (
                <span
                  style={{
                    display: 'inline-block',
                    fontSize: 9,
                    marginBottom: 10,
                    padding: '4px 8px',
                    borderRadius: 999,
                    background: 'var(--accent-coral)',
                    color: '#fff',
                  }}
                >
                  Überfällig
                </span>
              ) : (
                <span
                  style={{
                    display: 'inline-block',
                    fontSize: 9,
                    marginBottom: 10,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: stageColor,
                  }}
                >
                  {STAGE_LABEL[c.pipeline_stage]}
                </span>
              )}
              <div
                className="font-display"
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  lineHeight: 1.15,
                  marginBottom: 8,
                }}
              >
                {contactCardTitle(c)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{meta}</div>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 16 }}>
              {formatFollowUp(c.next_follow_up_at)}
            </div>
          </button>
        )
      })}
    </div>
  )
}
