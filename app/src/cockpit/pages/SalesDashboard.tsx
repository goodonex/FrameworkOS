import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useContacts } from '../../hooks/useContacts'
import { BibliothekQuickPanel } from '../components/BibliothekQuickPanel'
import { ConversionPanel } from '../components/ConversionPanel'
import { RunDrawer } from '../components/RunDrawer'
import { SalesAgentsPanel } from '../components/SalesAgentsPanel'
import { useActiveBrand } from '../lib/activeBrand'
import { buildFollowupInput } from '../lib/approvalDrafts'
import { funnelKpis, sumField } from '../lib/metricsAggregate'
import { postRun } from '../lib/runnerApi'
import { useDailyMetrics } from '../lib/useDailyMetrics'
import { useRunnerData } from '../lib/useRunnerData'

/**
 * Sales-Dashboard (/sales, Index-Route): EIN Ort für Akquise-Steuerung —
 * Sales-Agenten starten, Funnel gegen die Coach-Ziele, Bibliothek-Schnellzugriff.
 * Bewusst KEIN VitalsPanel/HeuteDeck-Doppel (das lebt auf der Home, Sales-Dashboard
 * ist die Steuerungs-Welt, nicht die Tages-Eingabe-Welt).
 */
export function SalesDashboard() {
  const navigate = useNavigate()
  const { activeBrand } = useActiveBrand()
  const metrics = useDailyMetrics()
  const { runner, runs, refresh } = useRunnerData()
  const contacts = useContacts(activeBrand?.slug)
  const [openRunId, setOpenRunId] = useState<string | null>(null)

  const monthRevenue = useMemo(() => sumField(metrics.monthRows, 'umsatz'), [metrics.monthRows])
  const funnel = useMemo(() => funnelKpis(metrics.monthRows, monthRevenue), [metrics.monthRows, monthRevenue])

  const activeAgents = useMemo(
    () => runs.filter((r) => r.status === 'running').map((r) => r.agent),
    [runs],
  )

  const onRun = useCallback(
    async (agentId: string, extra?: Record<string, unknown>) => {
      let input: Record<string, unknown> = { ...extra }
      if (agentId === 'followup-entwuerfe') {
        input = buildFollowupInput(contacts.items)
      }
      await postRun(agentId, input)
      await refresh()
    },
    [contacts.items, refresh],
  )

  const openBibliothek = useCallback(
    (key?: string) => navigate(key ? `/sales/bibliothek?f=${encodeURIComponent(key)}` : '/sales/bibliothek'),
    [navigate],
  )

  return (
    <div className="ck-sales-dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
        <SalesAgentsPanel
          runnerState={runner.state}
          activeAgents={activeAgents}
          runs={runs}
          onRun={onRun}
          onOpenRun={setOpenRunId}
          onOpenBibliothek={() => openBibliothek()}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
        <ConversionPanel kpis={funnel} />
        <BibliothekQuickPanel runnerState={runner.state} onOpen={(key) => openBibliothek(key || undefined)} />
      </div>
      {openRunId ? <RunDrawer runId={openRunId} onClose={() => setOpenRunId(null)} /> : null}
    </div>
  )
}
