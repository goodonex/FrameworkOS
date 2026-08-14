import type { CSSProperties } from 'react'

/**
 * Zähler für Vernetzungsanfragen — Kevins Tagesritual läuft direkt auf
 * LinkedIn, hier wird nur gezählt. Am Handy als Vollbild mit genau EINEM
 * großen Knopf (eine Hand, ein Daumen, kein Zielen); am Desktop als Inhalt
 * des Kachel-Fensters.
 */
interface AnfragenZaehlerProps {
  heute: number
  limit: number
  onPlus: () => void
  onMinus: () => void
  /** Vollbild-Variante fürs Handy */
  vollbild?: boolean
  onClose?: () => void
}

export function AnfragenZaehler({ heute, limit, onPlus, onMinus, vollbild, onClose }: AnfragenZaehlerProps) {
  const fertig = heute >= limit

  const zaehler = (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: vollbild ? 56 : 40, fontWeight: 700, color: fertig ? 'var(--ck-accent)' : 'var(--ck-text-1)' }}>
        {heute}
        <span style={{ fontSize: vollbild ? 24 : 18, fontWeight: 400, color: 'var(--ck-text-3)' }}> / {limit}</span>
      </div>
      {fertig ? (
        <div style={{ fontSize: 13, color: 'var(--ck-accent)', marginTop: 4 }}>Tageslimit erreicht</div>
      ) : null}
    </div>
  )

  const plusKnopf = (hoehe: CSSProperties['height']) => (
    <button
      type="button"
      className="ck-btn ck-btn--primary"
      onClick={onPlus}
      style={{
        height: hoehe,
        width: '100%',
        fontSize: 18,
        letterSpacing: '0.04em',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        /**
         * Im Vollbild NICHT die Pille. `.ck-btn` traegt --ck-radius-pille (999px);
         * bei 358x390 macht das aus dem Knopf eine Ellipse, und die runden Ecken
         * sind kein Zierrat: `elementFromPoint` liefert dort den Hintergrund, nicht
         * den Knopf. Rund ein Fuenftel der Flaeche war tot — auf genau der Flaeche,
         * die "nicht zielen, nur druecken" heissen soll. Als Karte ist der Knopf
         * flach und breit, dort bleibt die Pille richtig.
         */
        borderRadius: vollbild ? 'var(--ck-radius)' : undefined,
      }}
    >
      +1 Anfrage
    </button>
  )

  const minusKnopf = (
    <button
      type="button"
      className="ck-btn"
      onClick={onMinus}
      disabled={heute <= 0}
      aria-label="Eine Anfrage zurücknehmen"
      style={{ minHeight: 44, color: 'var(--ck-text-3)' }}
    >
      −1
    </button>
  )

  if (!vollbild) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {zaehler}
        {plusKnopf(96)}
        <div style={{ display: 'flex', justifyContent: 'center' }}>{minusKnopf}</div>
      </div>
    )
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Vernetzungsanfragen zählen"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        pointerEvents: 'auto',
        background: 'var(--ck-bg)',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        padding: '14px 16px',
        paddingTop: 'calc(env(safe-area-inset-top) + 14px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 14px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="ck-label">Vernetzungsanfragen</span>
        <button type="button" className="ck-btn" style={{ minHeight: 40 }} onClick={onClose}>
          Schließen
        </button>
      </div>
      <div style={{ flex: '0 0 auto', paddingTop: 24 }}>{zaehler}</div>
      {/* Der eine Knopf: füllt den Rest des Bildschirms — nicht zielen, nur drücken. */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>{plusKnopf('100%')}</div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>{minusKnopf}</div>
    </div>
  )
}
