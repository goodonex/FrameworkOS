import type { Vital } from '../VitalsPanel'

/**
 * Die Wochen-Vitals als Handy-Widget (O18, Zug 2).
 *
 * Dieselben Werte wie `VitalsPanel` am Desktop (`weekVitals` aus
 * `metricsAggregate`), nur ohne Sparkline: auf 390 px trägt die Kurve keine
 * Information mehr, die der Balken nicht schon zeigt — und Ruhe schlägt Effekt.
 * Ein Tipp öffnet `/tracking`, wo eingetragen und ausgewertet wird.
 */
export function VitalsWidget({ vitals, onOeffnen }: { vitals: Vital[]; onOeffnen: () => void }) {
  return (
    <button
      type="button"
      className="ck-panel"
      onClick={onOeffnen}
      aria-label="Wochenziele — Tracking öffnen"
      style={{
        width: '100%',
        padding: '11px 14px 13px',
        display: 'flex',
        flexDirection: 'column',
        gap: 9,
        textAlign: 'left',
        cursor: 'pointer',
        font: 'inherit',
        color: 'var(--ck-text-1)',
      }}
    >
      <span className="ck-label">Woche</span>
      {vitals.map((v) => {
        const geschafft = v.current >= v.target
        const pct = v.target > 0 ? Math.min(1, v.current / v.target) : 0
        return (
          <span key={v.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
              <span className="ck-label" style={{ color: 'var(--ck-text-2)' }}>
                {v.label}
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontVariantNumeric: 'tabular-nums',
                  color: geschafft ? 'var(--ck-accent)' : 'var(--ck-text-1)',
                }}
              >
                {v.current}
                <span style={{ color: 'var(--ck-text-3)' }}> / {v.target}</span>
              </span>
            </span>
            <span
              aria-hidden
              style={{ height: 4, borderRadius: 2, background: 'var(--ck-border)', overflow: 'hidden' }}
            >
              <span
                style={{
                  display: 'block',
                  width: `${pct * 100}%`,
                  height: '100%',
                  background: geschafft ? 'var(--ck-accent)' : 'var(--ck-idle)',
                }}
              />
            </span>
          </span>
        )
      })}
    </button>
  )
}
