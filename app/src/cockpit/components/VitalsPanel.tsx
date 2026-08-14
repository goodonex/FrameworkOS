import { Sparkline } from './Sparkline'

export interface Vital {
  key: string
  label: string
  current: number
  target: number
  /** letzte 14 Tage für Sparkline */
  history: number[]
}

function VitalRow({ vital }: { vital: Vital }) {
  // Ohne Ziel gibt es keinen Fortschritt — `0 / 0` ergaebe sonst `width: NaN%`.
  const pct = vital.target > 0 ? Math.min(1, vital.current / vital.target) : 0
  const done = vital.current >= vital.target
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '10px 12px', borderBottom: '1px solid var(--ck-border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="ck-label">{vital.label}</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: done ? 'var(--ck-accent)' : 'var(--ck-text-1)' }}>
          {vital.current}
          <span style={{ color: 'var(--ck-text-3)', fontWeight: 400 }}> / {vital.target}</span>
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, height: 4, background: 'var(--ck-border)', borderRadius: 2, overflow: 'hidden' }}>
          <div
            style={{
              width: `${pct * 100}%`,
              height: '100%',
              background: done ? 'var(--ck-accent)' : 'var(--ck-idle)',
              transition: 'width 300ms ease',
            }}
          />
        </div>
        <Sparkline values={vital.history} color={done ? 'var(--ck-accent)' : 'var(--ck-idle)'} />
      </div>
    </div>
  )
}

export function VitalsPanel({ vitals }: { vitals: Vital[] }) {
  return (
    <section className="ck-panel" aria-label="Wochenziele">
      <div className="ck-label" style={{ padding: '10px 12px 4px' }}>
        System Vitals · Woche
      </div>
      {vitals.map((v) => (
        <VitalRow key={v.key} vital={v} />
      ))}
    </section>
  )
}
