import { formatEuro, monthKeyOf, monthTargetFor } from '../lib/goals'
import type { DailyMetricsRow } from '../lib/useDailyMetrics'
import { cumulativeRevenue } from '../lib/metricsAggregate'

const W = 640
const H = 220
const PAD = { left: 52, right: 16, top: 14, bottom: 26 }

/**
 * Monatsansicht: kumulierte Ist-Umsatz-Kurve gegen die back-loaded Soll-Kurve
 * (REBUILD-PLAN §9). Reines SVG, kein Chart-Paket.
 */
export function MonthCurve({
  monthRows,
  overrideTotal,
}: {
  monthRows: DailyMetricsRow[]
  /** Gesetztes Monatsziel (month_goals) — von GoalCard durchgereicht, damit
   *  Kurve und Zahl darüber nie auseinanderlaufen. */
  overrideTotal?: number | null
}) {
  const now = new Date()
  const monthKey = monthKeyOf(now)
  const month = monthTargetFor(monthKey, overrideTotal)

  if (!month) {
    return (
      <p style={{ color: 'var(--ck-text-3)', fontSize: 12, padding: '8px 12px' }}>
        Für {monthKey} ist keine Soll-Kurve hinterlegt (goals.ts erweitern).
      </p>
    )
  }

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const maxY = Math.max(month.total, ...cumulativeRevenue(monthRows).map((p) => p.kumuliert), 1)

  const x = (day: number) => PAD.left + ((day - 1) / (daysInMonth - 1)) * (W - PAD.left - PAD.right)
  const y = (val: number) => H - PAD.bottom - (val / maxY) * (H - PAD.top - PAD.bottom)

  // Soll-Kurve: Punkte am Ende jeder KW (Sonntag) + Start bei 0
  const sollPoints: Array<[number, number]> = [[x(1), y(0)]]
  for (const w of month.curve) {
    const end = new Date(`${w.weekStart}T00:00:00`)
    end.setDate(end.getDate() + 6)
    const day = end.getMonth() === now.getMonth() ? end.getDate() : daysInMonth
    sollPoints.push([x(day), y(w.sollKumuliert)])
  }

  // Ist-Kurve
  const ist = cumulativeRevenue(monthRows)
  const istPoints: Array<[number, number]> = [[x(1), y(0)]]
  for (const p of ist) {
    const day = Number(p.datum.slice(8, 10))
    istPoints.push([x(day), y(p.kumuliert)])
  }
  const istTotal = ist.length > 0 ? ist[ist.length - 1].kumuliert : 0

  const toPath = (pts: Array<[number, number]>) =>
    pts.map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ')

  // Y-Achsen-Marken: 0, 50%, 100% vom Monatsziel
  const yTicks = [0, month.total / 2, month.total]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 4px 6px' }}>
        <span className="ck-label">Soll-Kurve · {month.label}</span>
        <span style={{ fontSize: 12, color: 'var(--ck-text-2)' }}>
          Ist <strong style={{ color: 'var(--ck-text-1)' }}>{formatEuro(istTotal)}</strong>
          <span style={{ color: 'var(--ck-text-2)' }}> / Ziel {formatEuro(month.total)}</span>
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        role="img"
        aria-label={`Kumulierter Umsatz gegen Soll-Kurve ${month.label}`}
      >
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--ck-border)" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t) + 3} textAnchor="end" fontSize={9} fill="var(--ck-text-3)" fontFamily="var(--ck-font)">
              {Math.round(t / 1000)}k
            </text>
          </g>
        ))}

        {/* KW-Marker */}
        {month.curve.map((w) => {
          const end = new Date(`${w.weekStart}T00:00:00`)
          end.setDate(end.getDate() + 6)
          const day = end.getMonth() === now.getMonth() ? end.getDate() : daysInMonth
          return (
            <text key={w.kw} x={x(day)} y={H - 8} textAnchor="middle" fontSize={9} fill="var(--ck-text-3)" fontFamily="var(--ck-font)">
              KW{w.kw}
            </text>
          )
        })}

        {/* Soll (gestrichelt, idle-grau) */}
        <path d={toPath(sollPoints)} fill="none" stroke="var(--ck-idle)" strokeWidth={1.5} strokeDasharray="5 4" />
        {sollPoints.slice(1).map(([px, py], i) => (
          <circle key={i} cx={px} cy={py} r={2.5} fill="var(--ck-idle)" />
        ))}

        {/* Ist (Akzent) */}
        <path d={toPath(istPoints)} fill="none" stroke="var(--ck-accent)" strokeWidth={2} />
        {istPoints.length > 1 ? (
          <circle
            cx={istPoints[istPoints.length - 1][0]}
            cy={istPoints[istPoints.length - 1][1]}
            r={3.5}
            fill="var(--ck-accent)"
          />
        ) : null}
      </svg>
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', paddingTop: 2 }}>
        <span className="ck-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, borderTop: '2px solid var(--ck-accent)', display: 'inline-block' }} /> Ist kumuliert
        </span>
        <span className="ck-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, borderTop: '2px dashed var(--ck-idle)', display: 'inline-block' }} /> Soll (back-loaded)
        </span>
      </div>
    </div>
  )
}
