import type { Ad, AdStatus, Kunde } from '../../lib/adsApi'
import { AD_STATUS_LABEL, kundenFileUrl } from '../../lib/adsApi'

const STATUS_COLOR: Record<AdStatus, string> = {
  draft: 'var(--ck-text-3)',
  review: 'var(--ck-warn)',
  approved: 'var(--ck-accent)',
  live: 'var(--ck-accent)',
  archived: 'var(--ck-text-3)',
}

/** Karte im Ad-Grid: PNG-Thumb (falls preview gesetzt), Status-Pill, Versions-Badge. */
export function AdCard({ kunde, ad, onOpen }: { kunde: Kunde; ad: Ad; onOpen: () => void }) {
  const latest = ad.versions[ad.versions.length - 1]
  const previewUrl = latest?.preview ? kundenFileUrl(kunde, latest.preview) : null
  const checks = latest?.review ? [...latest.review.design, ...latest.review.copy] : []
  const done = checks.filter((c) => c.done).length

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
      <div style={{ height: 130, background: 'var(--ck-medien-bg)', overflow: 'hidden', position: 'relative' }}>
        {previewUrl ? (
          <img
            src={previewUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block' }}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--ck-text-3)',
              fontSize: 12,
            }}
          >
            Keine Vorschau
          </div>
        )}
        <span
          className="ck-label"
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            padding: '2px 8px',
            borderRadius: 99,
            background: 'var(--ck-bg)',
            border: '1px solid var(--ck-border)',
          }}
        >
          v{latest?.v ?? 1}
        </span>
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
            {ad.title}
          </span>
          <span
            className="ck-label"
            style={{
              flexShrink: 0,
              padding: '2px 8px',
              borderRadius: 99,
              border: `1px solid ${STATUS_COLOR[ad.status]}`,
              color: STATUS_COLOR[ad.status],
            }}
          >
            {AD_STATUS_LABEL[ad.status]}
          </span>
        </div>
        {ad.angle ? (
          <span
            className="ck-label"
            style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {ad.angle}
          </span>
        ) : null}
        <span className="ck-label">
          {checks.length > 0 ? `${done}/${checks.length} Checks` : 'Review noch nicht gestartet'}
        </span>
      </div>
    </button>
  )
}
