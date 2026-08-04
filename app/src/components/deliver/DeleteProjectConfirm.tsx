import { createPortal } from 'react-dom'
import {
  SALES_MODAL_BACKDROP,
  SALES_MODAL_GHOST_BTN,
  SALES_MODAL_PANEL,
} from '../sales/activity/salesModalUi'

export function DeleteProjectConfirm({
  open,
  projectName,
  busy = false,
  onCancel,
  onConfirm,
}: {
  open: boolean
  projectName: string
  busy?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  if (!open) return null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      style={SALES_MODAL_BACKDROP}
      onClick={() => !busy && onCancel()}
    >
      <div
        className="font-mono"
        style={{ ...SALES_MODAL_PANEL, width: 'min(400px, 100%)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          
          style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px', color: 'var(--ck-text-1)' }}
        >
          Projekt löschen?
        </h3>
        <p style={{ fontSize: 12, color: 'var(--ck-text-2)', margin: '0 0 16px', lineHeight: 1.5 }}>
          „{projectName}“ wird aus Deliver entfernt. Der Kunden-Portal-Link funktioniert danach nicht
          mehr. Verknüpfte Kontakte in Sales bleiben erhalten.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" disabled={busy} onClick={onCancel} style={SALES_MODAL_GHOST_BTN}>
            Abbrechen
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="font-mono"
            style={{
              ...SALES_MODAL_GHOST_BTN,
              border: '1px solid var(--ck-warn)',
              color: 'var(--ck-warn)',
              fontWeight: 600,
            }}
          >
            {busy ? 'Löscht …' : 'Projekt löschen'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
