import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useContacts } from '../../hooks/useContacts'
import { AgentsPanel } from '../components/AgentsPanel'
import { GoalCard } from '../components/GoalCard'
import { HeuteDeck } from '../components/HeuteDeck'
import { OsDetailPanel } from '../components/OsDetailPanel'
import { QuickTrack } from '../components/QuickTrack'
import { RunDrawer } from '../components/RunDrawer'
import { VitalsPanel } from '../components/VitalsPanel'
import { OsNebula } from '../graph/OsNebula'
import type { LeadContact, NebulaNode } from '../graph/nebulaLayout'
import { useActiveBrand } from '../lib/activeBrand'
import {
  LAYOUT_LIMITS,
  LAYOUT_PRESETS,
  loadCockpitLayout,
  saveCockpitLayout,
} from '../lib/cockpitLayoutStorage'
import type { CockpitLayout } from '../lib/cockpitLayoutStorage'
import { WEEK_TARGETS, currentSoll, monthKeyOf, monthTargetFor } from '../lib/goals'
import { useMonthGoal } from '../lib/useMonthGoal'
import { sumField, weekVitals } from '../lib/metricsAggregate'
import { postRun } from '../lib/runnerApi'
import { buildFollowupInput } from '../lib/approvalDrafts'
import { useDailyMetrics } from '../lib/useDailyMetrics'
import { useOsMap } from '../lib/useOsMap'
import { useRunnerData } from '../lib/useRunnerData'

/** Graph-Höhe: nur auf schmalen (Mobile) Viewports deckeln — am Desktop frei ziehbar. */
function useGraphHeight(desired: number): number {
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const check = () => setNarrow(window.innerWidth < 900)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return narrow ? Math.min(desired, 440) : desired
}

/** Ziehbarer Trenner zwischen Tracking-Spalte und Graph. */
function GridDivider({
  gridRef,
  onLive,
  onCommit,
}: {
  gridRef: React.RefObject<HTMLDivElement | null>
  onLive: (px: number) => void
  onCommit: () => void
}) {
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    if (!dragging) return
    const move = (e: MouseEvent) => {
      const rect = gridRef.current?.getBoundingClientRect()
      if (!rect) return
      const px = Math.round(
        Math.min(LAYOUT_LIMITS.sidebar.max, Math.max(LAYOUT_LIMITS.sidebar.min, e.clientX - rect.left)),
      )
      onLive(px)
    }
    const up = () => {
      setDragging(false)
      onCommit()
    }
    document.body.style.cursor = 'col-resize'
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => {
      document.body.style.cursor = ''
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
  }, [dragging, gridRef, onLive, onCommit])

  return (
    <div
      className="ck-col-divider"
      data-dragging={dragging}
      onMouseDown={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      role="separator"
      aria-orientation="vertical"
      aria-label="Spaltenbreite ziehen"
      title="Ziehen, um Tracking ⇄ Graph zu skalieren"
    >
      <span aria-hidden style={{ fontSize: 11, lineHeight: 1 }}>
        ⋮
      </span>
    </div>
  )
}

/** Waagerechter Ziehbalken unter dem Graphen — Höhe live anpassen. */
function RowDivider({
  value,
  min,
  max,
  onLive,
  onCommit,
}: {
  value: number
  min: number
  max: number
  onLive: (px: number) => void
  onCommit: () => void
}) {
  const [dragging, setDragging] = useState(false)
  const start = useRef({ y: 0, v: 0 })

  useEffect(() => {
    if (!dragging) return
    const move = (e: MouseEvent) => {
      const px = Math.round(Math.min(max, Math.max(min, start.current.v + (e.clientY - start.current.y))))
      onLive(px)
    }
    const up = () => {
      setDragging(false)
      onCommit()
    }
    document.body.style.cursor = 'row-resize'
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => {
      document.body.style.cursor = ''
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
  }, [dragging, min, max, onLive, onCommit])

  return (
    <div
      className="ck-row-divider"
      data-dragging={dragging}
      onMouseDown={(e) => {
        e.preventDefault()
        start.current = { y: e.clientY, v: value }
        setDragging(true)
      }}
      role="separator"
      aria-orientation="horizontal"
      aria-label="Graph-Höhe ziehen"
      title="Ziehen, um den Graphen größer/kleiner zu machen"
    >
      <span aria-hidden style={{ fontSize: 12, lineHeight: 1, letterSpacing: 2 }}>
        ⋯
      </span>
    </div>
  )
}

/**
 * Cockpit-Home (vereinfacht Juli 2026) — Hauptfläche ist der Agentic-OS-Graph
 * (OsNebula). Links schlanke Spalte: Ziel-Karte, Quick-Track, Vitals.
 * Unter dem Graph das Agenten-Panel (Deck + Dream + letzte Runs).
 */
export function CockpitHome() {
  const navigate = useNavigate()
  const { activeBrand, error: brandError, loading: brandLoading } = useActiveBrand()
  const metrics = useDailyMetrics()
  const { runner, runs, refresh } = useRunnerData()
  const { osMap, refresh: refreshOsMap } = useOsMap(runner.state)
  const contacts = useContacts(activeBrand?.slug)
  // Gesetztes Monatsziel für die Agenten-Inputs (Wochenrecap/Morgenbrief) —
  // sonst berichten sie ab September gegen den 40.000-€-Default.
  const monatsziel = useMonthGoal(activeBrand?.id, monthKeyOf())
  const [openRunId, setOpenRunId] = useState<string | null>(null)
  const [selNode, setSelNode] = useState<NebulaNode | null>(null)
  const [layout, setLayout] = useState<CockpitLayout>(loadCockpitLayout)
  const graphHeight = useGraphHeight(layout.graphHeight)
  const gridRef = useRef<HTMLDivElement | null>(null)
  const layoutRef = useRef(layout)
  layoutRef.current = layout

  // Divider zieht die Sidebar-Breite live; gespeichert wird erst beim Loslassen.
  const resizeSidebar = useCallback((px: number) => {
    setLayout((l) => ({ ...l, sidebarPx: px }))
  }, [])
  const commitLayout = useCallback(() => saveCockpitLayout(layoutRef.current), [])

  // Fokus-Umschalter im Graphen: setzt Sidebar-Breite + Graph-Höhe per Preset.
  const setFocus = useCallback((f: 'tracking' | 'graph') => {
    const next = LAYOUT_PRESETS[f]
    setLayout(next)
    saveCockpitLayout(next)
  }, [])

  const vitals = useMemo(
    () => weekVitals(metrics.weekRows, metrics.windowRows),
    [metrics.weekRows, metrics.windowRows],
  )
  const monthRevenue = useMemo(() => sumField(metrics.monthRows, 'umsatz'), [metrics.monthRows])

  /** Schlanker Kontakt-Auszug für die Leads-Ansicht des Graphen. */
  const leadContacts: LeadContact[] = useMemo(
    () =>
      contacts.items.map((c) => ({
        id: c.id,
        name: c.name,
        company: c.company,
        pipeline_stage: c.pipeline_stage,
        lead_value: c.lead_value,
        lead_source: c.lead_source,
      })),
    [contacts.items],
  )

  const onNodeClick = useCallback(
    (node: NebulaNode) => {
      if (node.kind === 'core') return
      if (node.kind === 'contact' && node.href) {
        navigate(node.href)
        return
      }
      if (node.kind === 'run' && node.path) {
        setOpenRunId(node.path)
        return
      }
      setSelNode(node)
    },
    [navigate],
  )

  const activeAgents = useMemo(
    () => runs.filter((r) => r.status === 'running').map((r) => r.agent),
    [runs],
  )

  /** Input-Baukasten je Agent — die App liefert ihre Daten selbst mit (§7). */
  const onRun = useCallback(
    async (agentId: string, extra?: Record<string, unknown>) => {
      let input: Record<string, unknown> = { ...extra }
      if (agentId === 'wochenrecap') {
        const month = monthTargetFor(monthKeyOf(), monatsziel.total)
        input = {
          weekRows: metrics.weekRows,
          targets: WEEK_TARGETS,
          monthRevenue,
          sollKumuliert: month ? currentSoll(month.curve) : 0,
          monatsziel: month?.total ?? null,
        }
      } else if (agentId === 'followup-entwuerfe') {
        input = buildFollowupInput(contacts.items)
      } else if (agentId === 'morgenbrief') {
        const now = new Date()
        const startToday = new Date(now)
        startToday.setHours(0, 0, 0, 0)
        const endToday = new Date(now)
        endToday.setHours(23, 59, 59, 999)
        const mapC = (c: (typeof contacts.items)[number]) => ({
          name: c.name,
          company: c.company,
          stage: c.pipeline_stage,
          nextFollowUp: c.next_follow_up_at,
        })
        const withFu = contacts.items.filter(
          (c) => c.next_follow_up_at && c.pipeline_stage !== 'paused',
        )
        const month = monthTargetFor(monthKeyOf(now), monatsziel.total)
        input = {
          weekday: now.toLocaleDateString('de-DE', { weekday: 'long' }),
          date: now.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }),
          overdueFollowUps: withFu
            .filter((c) => new Date(c.next_follow_up_at as string).getTime() < startToday.getTime())
            .map(mapC),
          todayFollowUps: withFu
            .filter((c) => {
              const t = new Date(c.next_follow_up_at as string).getTime()
              return t >= startToday.getTime() && t <= endToday.getTime()
            })
            .map(mapC),
          weekVitals: vitals.map((v) => ({ label: v.label, current: v.current, target: v.target })),
          monthRevenue,
          sollKumuliert: month ? currentSoll(month.curve) : 0,
          monatsziel: month?.total ?? null,
        }
      }
      await postRun(agentId, input)
      await refresh()
    },
    [metrics.weekRows, monthRevenue, contacts.items, vitals, refresh, monatsziel.total],
  )

  return (
    <>
    {/* Nur bei ECHTEM Problem warnen — nicht während des Ladens (sonst Flackern). */}
    {((!brandLoading && (!activeBrand || activeBrand.id.startsWith('local-fallback-'))) || metrics.error || metrics.tableMissing) ? (
      <div
        className="ck-panel"
        style={{
          padding: '10px 14px',
          marginBottom: 12,
          border: '1px solid var(--ck-warn)',
          color: 'var(--ck-warn)',
          fontSize: 12.5,
          lineHeight: 1.5,
        }}
      >
        {!brandLoading && (!activeBrand || activeBrand.id.startsWith('local-fallback-'))
          ? `⚠ Keine echte Brand verbunden — die brands-Tabelle lädt nicht aus Supabase. Solange das so ist, wird getracktes NICHT gespeichert und Projekte/E-Mail funktionieren nicht.${brandError ? ` Fehler: ${brandError}` : ' (Kein Fehler gemeldet → Brand-Liste ist leer; ggf. eingeloggter User hat keine brands-Zeilen.)'}`
          : metrics.tableMissing
            ? '⚠ Tabelle daily_metrics fehlt — Migration 0049 ist auf dieser DB nicht ausgeführt.'
            : `⚠ Tracking-Schreibfehler: ${metrics.error}`}
      </div>
    ) : null}
    <div style={{ marginBottom: 12 }}>
      <HeuteDeck slug={activeBrand?.slug} contacts={contacts} />
    </div>
    <div
      ref={gridRef}
      className="ck-home-grid"
      style={{ ['--ck-sidebar-w' as string]: `${layout.sidebarPx}px` } as React.CSSProperties}
    >
      {/* Links (schmal): Ziel-Karte → Quick-Track → Vitals */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <GoalCard
          monthRevenue={monthRevenue}
          monthRows={metrics.monthRows}
          contacts={contacts.items}
        />
        <QuickTrack
          today={metrics.today}
          onBump={(f, d) => void metrics.bump(f, d)}
          onAddUmsatz={(amount) => void metrics.setUmsatz(metrics.today.umsatz + amount)}
        />
        <VitalsPanel vitals={vitals} />
      </div>

      <GridDivider gridRef={gridRef} onLive={resizeSidebar} onCommit={commitLayout} />

      {/* Haupt (breit): großer OS-Graph, darunter das Agenten-Panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
        <div className="ck-panel" style={{ padding: 0, overflow: 'hidden' }}>
          <OsNebula
            map={osMap}
            contacts={leadContacts}
            runs={runs}
            onNodeClick={onNodeClick}
            onRefresh={() => refreshOsMap(true)}
            height={graphHeight}
            focus={layout.preset}
            onFocus={setFocus}
          />
        </div>
        <RowDivider
          value={layout.graphHeight}
          min={LAYOUT_LIMITS.graph.min}
          max={LAYOUT_LIMITS.graph.max}
          onLive={(px) => setLayout((l) => ({ ...l, graphHeight: px }))}
          onCommit={commitLayout}
        />
        <AgentsPanel
          runnerState={runner.state}
          activeAgents={activeAgents}
          runs={runs}
          onRun={onRun}
          onOpenRun={setOpenRunId}
        />
      </div>

      {selNode ? <OsDetailPanel node={selNode} onClose={() => setSelNode(null)} /> : null}
      {openRunId ? <RunDrawer runId={openRunId} onClose={() => setOpenRunId(null)} /> : null}
    </div>
    </>
  )
}
