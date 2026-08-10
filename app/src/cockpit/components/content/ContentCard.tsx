import type { ContentPost, ContentStatus } from '../../lib/contentApi'
import {
  CONTENT_CHANNEL_LABEL,
  CONTENT_DATE_FMT,
  CONTENT_FORMAT_LABEL,
  CONTENT_STATUS_LABEL,
} from '../../lib/contentApi'

const STATUS_COLOR: Record<ContentStatus, string> = {
  idea: 'var(--ck-text-3)',
  production: 'var(--ck-warn)',
  review: 'var(--ck-warn)',
  scheduled: 'var(--ck-accent)',
  posted: 'var(--ck-accent)',
}

/**
 * Karte im Post-Grid: Kopfzeile mit Kanal/Format + Status-Pill, Titel, Angle,
 * geplant-Datum und done-Indikator. Bewusst KEIN iframe-Thumb (bei vielen Karten
 * teuer) — die echte Slide-Vorschau kommt im Detail-Panel.
 */
export function ContentCard({ post, onOpen }: { post: ContentPost; onOpen: () => void }) {
  const planned = post.plannedFor ? new Date(post.plannedFor) : null

  return (
    <button
      onClick={onOpen}
      className="ck-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        padding: 0,
        textAlign: 'left',
        cursor: 'pointer',
        border: '1px solid var(--ck-border)',
        background: 'transparent',
        color: 'inherit',
        minWidth: 0,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: 92,
          background: 'var(--ck-medien-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          color: 'var(--ck-text-3)',
          fontSize: 12,
        }}
      >
        {post.slides.length > 0 ? `${post.slides.length} Slide${post.slides.length === 1 ? '' : 's'}` : 'Keine Slides'}
        <span
          className="ck-label"
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            padding: '2px 8px',
            borderRadius: 99,
            background: 'var(--ck-bg)',
            border: '1px solid var(--ck-border)',
          }}
        >
          {CONTENT_CHANNEL_LABEL[post.channel]} · {CONTENT_FORMAT_LABEL[post.format]}
        </span>
        {post.done ? (
          <span
            className="ck-label"
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              padding: '2px 8px',
              borderRadius: 99,
              background: 'var(--ck-bg)',
              border: '1px solid var(--ck-accent)',
              color: 'var(--ck-accent)',
            }}
          >
            ✓ erledigt
          </span>
        ) : null}
      </div>

      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
          <span
            style={{
              fontSize: 13.5,
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {post.title}
          </span>
          <span
            className="ck-label"
            style={{
              flexShrink: 0,
              padding: '2px 8px',
              borderRadius: 99,
              border: `1px solid ${STATUS_COLOR[post.status]}`,
              color: STATUS_COLOR[post.status],
            }}
          >
            {CONTENT_STATUS_LABEL[post.status]}
          </span>
        </div>
        {post.angle ? (
          <span className="ck-label" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {post.angle}
          </span>
        ) : null}
        <span className="ck-label">
          {planned ? `Geplant: ${CONTENT_DATE_FMT.format(planned)}` : 'Kein Datum'}
        </span>
      </div>
    </button>
  )
}
