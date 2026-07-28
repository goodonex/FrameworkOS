import { useEffect, useMemo, useState } from 'react'
import { fetchAgents, fetchOsFile, type AgentInfo, type RunSummary } from '../lib/runnerApi'
import { fetchSalesLibrary } from '../lib/salesLibraryApi'
import type { RunnerState } from '../lib/useRunnerStatus'

/**
 * Sales-Agenten-Panel (Dashboard der Sales-Sektion): Agenten-Buttons + Eingaben +
 * letzte Sales-Runs in EINEM Panel — Muster aus `AgentsPanel.tsx` 1:1 übernommen,
 * aber auf die Akquise-Agenten gefiltert.
 */

/** Agenten, die auf diesem Deck erscheinen (Reihenfolge = Anzeige-Reihenfolge). */
const SALES_AGENT_IDS = ['followup-entwuerfe', 'loom-skript', 'followup-pdf', 'lead-research']

const FALLBACK: AgentInfo[] = [
  { id: 'followup-entwuerfe', label: 'Follow-up-Entwürfe', description: 'Wartende Kontakte', kind: 'readonly', running: false },
  { id: 'loom-skript', label: 'Loom-Skript (Lead)', description: 'Individualisiertes Loom-Skript', kind: 'write', running: false },
  { id: 'followup-pdf', label: 'Follow-up-PDF (Lead)', description: 'Individuelle Follow-up-Analyse', kind: 'write', running: false },
]

function runDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })
}

/** Zählt `### `-Headings in der neuesten LinkedIn-Erstnachrichten-Datei (= Lead-Anzahl der Runde). */
function useLinkedInStatus(runnerState: RunnerState) {
  const [status, setStatus] = useState<{ label: string; count: number } | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (runnerState !== 'online') return
    let cancelled = false
    setLoading(true)
    void fetchSalesLibrary()
      .then(async (lib) => {
        const latest = lib.vault
          .filter((f) => f.name.startsWith('LinkedIn-Leads Erstnachrichten'))
          .sort((a, b) => (a.mtime < b.mtime ? 1 : -1))[0]
        if (!latest || cancelled) return
        const file = await fetchOsFile(latest.path)
        if (cancelled) return
        const count = (file.content.match(/^### /gm) ?? []).length
        setStatus({ label: latest.name, count })
      })
      .catch(() => {
        /* Runner kurz weg oder noch keine Datei — Karte bleibt leer */
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [runnerState])

  return { status, loading }
}

export function SalesAgentsPanel({
  runnerState,
  activeAgents,
  runs,
  onRun,
  onOpenRun,
  onOpenBibliothek,
}: {
  runnerState: RunnerState
  /** Agenten, die gerade laufen (agent-ids) */
  activeAgents: string[]
  runs: RunSummary[]
  onRun: (agentId: string, input?: Record<string, unknown>) => Promise<void>
  onOpenRun: (runId: string) => void
  onOpenBibliothek: () => void
}) {
  const offline = runnerState !== 'online'
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [error, setError] = useState<string | null>(null)
  const [leadQuery, setLeadQuery] = useState('')
  const [loomName, setLoomName] = useState('')
  const [loomWebsite, setLoomWebsite] = useState('')
  const [pdfName, setPdfName] = useState('')
  const [pdfWebsite, setPdfWebsite] = useState('')
  const { status: linkedinStatus } = useLinkedInStatus(runnerState)

  useEffect(() => {
    if (runnerState !== 'online') return
    let cancelled = false
    void fetchAgents()
      .then((list) => {
        if (!cancelled) setAgents(list)
      })
      .catch(() => {
        /* offline/Fehler → Fallback greift */
      })
    return () => {
      cancelled = true
    }
  }, [runnerState])

  const source = agents.length ? agents : FALLBACK
  const byId = useMemo(() => new Map(source.map((a) => [a.id, a])), [source])
  const followupEntwuerfe = byId.get('followup-entwuerfe')
  const hasLeadResearch = source.some((a) => a.id === 'lead-research') || agents.length === 0

  const salesRuns = useMemo(
    () => runs.filter((r) => SALES_AGENT_IDS.includes(r.agent)).slice(0, 6),
    [runs],
  )

  const trigger = async (agentId: string, input?: Record<string, unknown>) => {
    setError(null)
    try {
      await onRun(agentId, input)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <section className="ck-panel" aria-label="Sales-Agenten — starten und letzte Runs">
      <div className="ck-label" style={{ padding: '10px 12px 6px' }}>
        Sales-Agenten
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 12px 12px' }}>
        {followupEntwuerfe ? (
          <button
            className="ck-btn"
            disabled={offline || activeAgents.includes('followup-entwuerfe')}
            onClick={() => void trigger('followup-entwuerfe')}
            title={offline ? 'Runner offline' : followupEntwuerfe.description}
            style={{ justifyContent: 'space-between' }}
          >
            <span>
              {activeAgents.includes('followup-entwuerfe') ? (
                <span className="ck-dot ck-dot--pulse" style={{ marginRight: 8 }} />
              ) : (
                '▶ '
              )}
              {followupEntwuerfe.label}
            </span>
            <span className="ck-label">
              {activeAgents.includes('followup-entwuerfe') ? 'läuft…' : followupEntwuerfe.description}
            </span>
          </button>
        ) : null}

        {/* Loom-Skript: Name + Website */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              className="ck-input"
              style={{ flex: 1, minWidth: 0 }}
              placeholder="Name…"
              value={loomName}
              disabled={offline}
              onChange={(e) => setLoomName(e.target.value)}
              aria-label="Loom-Skript: Lead-Name"
            />
            <input
              className="ck-input"
              style={{ flex: 1, minWidth: 0 }}
              placeholder="Website (optional)…"
              value={loomWebsite}
              disabled={offline}
              onChange={(e) => setLoomWebsite(e.target.value)}
              aria-label="Loom-Skript: Website-URL"
            />
            <button
              className="ck-btn"
              disabled={offline || !loomName.trim() || activeAgents.includes('loom-skript')}
              onClick={() => {
                void trigger('loom-skript', { name: loomName.trim(), website: loomWebsite.trim() || undefined })
                setLoomName('')
                setLoomWebsite('')
              }}
              title="Loom-Skript (Lead)"
            >
              {activeAgents.includes('loom-skript') ? '…' : '▶'}
            </button>
          </div>
        </div>

        {/* Follow-up-PDF: Name + Website (Pflicht) */}
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            className="ck-input"
            style={{ flex: 1, minWidth: 0 }}
            placeholder="Name…"
            value={pdfName}
            disabled={offline}
            onChange={(e) => setPdfName(e.target.value)}
            aria-label="Follow-up-PDF: Lead-Name"
          />
          <input
            className="ck-input"
            style={{ flex: 1, minWidth: 0 }}
            placeholder="Website…"
            value={pdfWebsite}
            disabled={offline}
            onChange={(e) => setPdfWebsite(e.target.value)}
            aria-label="Follow-up-PDF: Website-URL"
          />
          <button
            className="ck-btn"
            disabled={offline || !pdfName.trim() || !pdfWebsite.trim() || activeAgents.includes('followup-pdf')}
            onClick={() => {
              void trigger('followup-pdf', { name: pdfName.trim(), website: pdfWebsite.trim() })
              setPdfName('')
              setPdfWebsite('')
            }}
            title="Follow-up-PDF (Lead)"
          >
            {activeAgents.includes('followup-pdf') ? '…' : '▶'}
          </button>
        </div>

        {/* Lead-Research mit Eingabe */}
        {hasLeadResearch ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              className="ck-input"
              style={{ flex: 1, minWidth: 0 }}
              placeholder="Lead-Research: Name, Firma oder URL…"
              value={leadQuery}
              disabled={offline}
              onChange={(e) => setLeadQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && leadQuery.trim()) {
                  void trigger('lead-research', { query: leadQuery.trim() })
                  setLeadQuery('')
                }
              }}
              aria-label="Lead-Research Eingabe"
            />
            <button
              className="ck-btn"
              disabled={offline || !leadQuery.trim() || activeAgents.includes('lead-research')}
              onClick={() => {
                void trigger('lead-research', { query: leadQuery.trim() })
                setLeadQuery('')
              }}
            >
              {activeAgents.includes('lead-research') ? '…' : '▶'}
            </button>
          </div>
        ) : null}

        {error ? (
          <p className="ck-label" style={{ margin: 0, color: 'var(--ck-warn)' }}>{error}</p>
        ) : null}
        {offline ? (
          <p className="ck-label" style={{ margin: '2px 0 0', color: 'var(--ck-text-3)' }}>
            Runner offline · starte `npm run cockpit` im Repo-Root
          </p>
        ) : null}
      </div>

      {/* LinkedIn-Leads: Status statt Button (headless nicht ausführbar, braucht echtes Chrome) */}
      <div style={{ borderTop: '1px solid var(--ck-border)', padding: '8px 12px 10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span className="ck-label">LinkedIn-Leads</span>
          <button
            onClick={onOpenBibliothek}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              color: 'var(--ck-accent)',
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Öffnen →
          </button>
        </div>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--ck-text-2)', lineHeight: 1.5 }}>
          {linkedinStatus
            ? `Letzte Runde: ${linkedinStatus.label} · ${linkedinStatus.count} Leads`
            : 'Noch keine Runde erfasst.'}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--ck-text-3)' }}>
          Runde läuft in der Desktop-Session (braucht dein Chrome) — kein Auto-Button hier.
        </p>
      </div>

      {/* Letzte Sales-Runs */}
      <div style={{ borderTop: '1px solid var(--ck-border)' }}>
        <div className="ck-label" style={{ padding: '8px 12px 2px' }}>
          Letzte Runs
        </div>
        {salesRuns.length === 0 ? (
          <p style={{ padding: '6px 12px 10px', margin: 0, color: 'var(--ck-text-3)', fontSize: 12 }}>
            Noch keine Runs.
          </p>
        ) : (
          salesRuns.map((r, i) => (
            <button
              key={r.id}
              onClick={() => onOpenRun(r.id)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '8px 12px',
                background: 'none',
                border: 'none',
                borderBottom: i === salesRuns.length - 1 ? 'none' : '1px solid var(--ck-border)',
                color: 'var(--ck-text-1)',
                fontFamily: 'var(--ck-font)',
                fontSize: 12,
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span className={r.status === 'running' ? 'ck-dot ck-dot--pulse' : 'ck-dot ck-dot--on'} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.status === 'error' ? `⚠ ${r.agent}` : r.agent}
                </span>
              </span>
              <span className="ck-label" style={{ flexShrink: 0 }}>
                {r.status === 'running' ? 'läuft…' : runDate(r.finished || r.started)}
              </span>
            </button>
          ))
        )}
      </div>
    </section>
  )
}
