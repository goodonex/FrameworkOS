import { useState } from 'react'
import {
  DELIVERABLE_STATUS_LABEL,
  type DeliverableItem,
  type DeliverProjectStage,
} from '../../types/db'
import { placeholderHint } from '../../lib/deliverableCatalog'
import type { AbnahmeArt } from '../../lib/abnahme'

interface PortalDeliverableCardProps {
  item: DeliverableItem
  clientStage: DeliverProjectStage
  accentColor: string
  dimmed?: boolean
  /**
   * O11: nur im Kundenportal gesetzt. Der Kunde meldet Freigabe oder
   * Änderungswunsch als Nachricht — den Deliverable-Status setzt weiterhin
   * ausschließlich der Owner.
   */
  onAbnahme?: (art: AbnahmeArt, text: string) => Promise<boolean>
}

export function PortalDeliverableCard({
  item,
  clientStage,
  accentColor,
  dimmed = false,
  onAbnahme,
}: PortalDeliverableCardProps) {
  const [wunschOffen, setWunschOffen] = useState(false)
  const [wunschText, setWunschText] = useState('')
  const [sendet, setSendet] = useState(false)
  const [gemeldet, setGemeldet] = useState<AbnahmeArt | null>(null)

  const melde = async (art: AbnahmeArt, text: string) => {
    if (!onAbnahme || sendet) return
    setSendet(true)
    const ok = await onAbnahme(art, text)
    setSendet(false)
    if (!ok) return
    setGemeldet(art)
    setWunschOffen(false)
    setWunschText('')
  }

  const ready = item.status === 'fertig'
  const inProgress = item.status === 'in_arbeit'
  const opacity = dimmed ? 0.55 : ready ? 1 : inProgress ? 0.92 : 0.72

  return (
    <div
      className="portal-deliverable-card"
      style={{
        opacity,
        borderColor: ready
          ? `color-mix(in srgb, ${accentColor} 35%, var(--portal-border))`
          : undefined,
      }}
    >
      <div className="portal-deliverable-card__head">
        <h3 className="portal-deliverable-card__title">{item.title}</h3>
        <span
          className={`portal-deliverable-badge portal-deliverable-badge--${item.status}`}
          style={
            ready
              ? { background: `color-mix(in srgb, ${accentColor} 12%, var(--portal-surface))`, color: accentColor }
              : undefined
          }
        >
          {ready ? '✓ ' : ''}
          {DELIVERABLE_STATUS_LABEL[item.status]}
        </span>
      </div>

      {item.description ? (
        <p className="portal-deliverable-card__desc">{item.description}</p>
      ) : null}

      {item.type === 'website_development' ? (
        <div className="portal-deliverable-progress">
          <div
            className="portal-deliverable-progress__bar"
            style={{
              width: `${item.progress ?? 0}%`,
              background: accentColor,
            }}
          />
        </div>
      ) : null}

      {item.type === 'color_palette' && ready && item.url ? (
        <div className="portal-color-swatches">
          {item.url.split(/[,;\s]+/).filter((c) => /^#?[0-9a-f]{3,8}$/i.test(c)).slice(0, 8).map((c) => {
            const hex = c.startsWith('#') ? c : `#${c}`
            return (
              <span
                key={hex}
                className="portal-color-swatch"
                style={{ background: hex }}
                title={hex}
              />
            )
          })}
        </div>
      ) : null}

      {ready && item.url && item.type !== 'color_palette' ? (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="portal-deliverable-link"
          style={{ color: accentColor }}
        >
          {item.type === 'website_live_url' ? 'Website öffnen →' : 'Ansehen / Download →'}
        </a>
      ) : null}

      {!ready ? (
        <div className="portal-deliverable-placeholder">
          <span aria-hidden>◇</span>
          {placeholderHint(item.type, clientStage)}
        </div>
      ) : null}

      {ready && item.added_at ? (
        <div className="portal-deliverable-added">
          Hinzugefügt am {new Date(item.added_at).toLocaleDateString('de-DE')}
        </div>
      ) : null}

      {ready && onAbnahme ? (
        <div className="portal-deliverable-abnahme">
          {gemeldet ? (
            <p className="portal-deliverable-abnahme__ok" style={{ color: accentColor }}>
              {gemeldet === 'freigabe'
                ? '✓ Freigabe ist raus — danke!'
                : '✎ Dein Änderungswunsch ist raus.'}
            </p>
          ) : wunschOffen ? (
            <>
              <textarea
                className="portal-deliverable-abnahme__input"
                value={wunschText}
                onChange={(e) => setWunschText(e.target.value)}
                rows={3}
                autoFocus
                placeholder="Was sollen wir ändern?"
              />
              <div className="portal-deliverable-abnahme__row">
                <button
                  type="button"
                  className="portal-btn portal-btn-primary"
                  style={{ background: accentColor }}
                  disabled={sendet || !wunschText.trim()}
                  onClick={() => void melde('aenderung', wunschText)}
                >
                  {sendet ? 'Sende…' : 'Wunsch senden'}
                </button>
                <button
                  type="button"
                  className="portal-btn portal-btn-ghost"
                  onClick={() => setWunschOffen(false)}
                >
                  Abbrechen
                </button>
              </div>
            </>
          ) : (
            <div className="portal-deliverable-abnahme__row">
              <button
                type="button"
                className="portal-btn portal-btn-primary"
                style={{ background: accentColor }}
                disabled={sendet}
                onClick={() => void melde('freigabe', '')}
              >
                {sendet ? 'Sende…' : 'Freigeben'}
              </button>
              <button
                type="button"
                className="portal-btn portal-btn-ghost"
                style={{ borderColor: accentColor, color: accentColor }}
                onClick={() => setWunschOffen(true)}
              >
                Änderung wünschen
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
