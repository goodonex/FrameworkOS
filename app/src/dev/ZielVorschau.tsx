import { GoalCard } from '../cockpit/components/GoalCard'
import { ActiveBrandProvider } from '../cockpit/lib/activeBrand'
import type { DailyMetricsRow } from '../cockpit/lib/useDailyMetrics'
import type { Contact } from '../types/db'

/**
 * Dev-Vorschau (nur import.meta.env.DEV, ohne Login): zeigt die Ziel-Karte mit
 * dem neuen Monatsziel-Editor gegen Fixture-Daten. Grund wie bei SalesVorschau:
 * /cockpit liegt hinter dem Supabase-Login und ist so nicht prüfbar.
 * Kein Produktions-Code-Pfad.
 */

function makeRow(datum: string, umsatz: number): DailyMetricsRow {
  return {
    datum,
    li_anfragen: 8,
    li_nachrichten: 4,
    inmails: 0,
    looms: 2,
    ig_anfragen: 2,
    ig_nachrichten: 1,
    cold_calls: 0,
    coldmails: 0,
    followups: 0,
    li_followups: 0,
    ig_followups: 0,
    call_followups: 0,
    antworten_li: 1,
    antworten_inmail: 0,
    antworten_ig: 0,
    antworten_cold: 0,
    quali_termine: 0,
    sales_calls: 0,
    termine_vereinbart: 0,
    termine_li: 1,
    termine_ig: 0,
    termine_call: 0,
    abschluesse: 0,
    umsatz,
  }
}

/** Laufender Monat mit ein paar Umsatz-Tagen — genug für Kurve und Fortschritt. */
const MONTH_ROWS: DailyMetricsRow[] = (() => {
  const now = new Date()
  const out: DailyMetricsRow[] = []
  for (let tag = 1; tag <= now.getDate(); tag++) {
    const d = new Date(now.getFullYear(), now.getMonth(), tag)
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(tag).padStart(2, '0')}`
    out.push(makeRow(iso, tag % 9 === 0 ? 3500 : 0))
  }
  return out
})()

const MONTH_REVENUE = MONTH_ROWS.reduce((a, r) => a + r.umsatz, 0)

export function ZielVorschau() {
  return (
    <ActiveBrandProvider>
      <div
        className="ck-root"
        style={{ minHeight: '100vh', background: 'var(--ck-bg)', padding: 24, pointerEvents: 'auto' }}
      >
        <div className="ck-label" style={{ marginBottom: 14 }}>
          Dev-Vorschau · Monatsziel-Editor (Fixtures) — „Ziel ändern" öffnet das Eingabefeld
        </div>
        <div style={{ maxWidth: 420 }}>
          <GoalCard monthRevenue={MONTH_REVENUE} monthRows={MONTH_ROWS} contacts={[] as Contact[]} />
        </div>
      </div>
    </ActiveBrandProvider>
  )
}
