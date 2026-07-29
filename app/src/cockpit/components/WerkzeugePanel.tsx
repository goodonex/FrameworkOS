import { useState } from 'react'
import { postRun } from '../lib/runnerApi'
import type { RunnerState } from '../lib/useRunnerStatus'

/**
 * Die drei Agenten-Eingaben aus dem alten Sales-Dashboard (Stufe 2/3 von
 * Kevins Funnel) — beim Ersetzen durch die Kacheln (Wargame
 * docs/wargames/sales-arbeitsmodus.md, Zug 5) unverändert übernommen, nur als
 * Inhalt der Kachel „Werkzeuge" statt als eigenes Panel.
 */
export function WerkzeugePanel({
  runnerState,
  activeAgents,
  onRan,
}: {
  runnerState: RunnerState
  activeAgents: string[]
  onRan: () => void
}) {
  const offline = runnerState !== 'online'
  const [loomName, setLoomName] = useState('')
  const [loomWebsite, setLoomWebsite] = useState('')
  const [pdfName, setPdfName] = useState('')
  const [pdfWebsite, setPdfWebsite] = useState('')
  const [leadQuery, setLeadQuery] = useState('')
  const [error, setError] = useState<string | null>(null)

  const trigger = async (agentId: string, input?: Record<string, unknown>) => {
    setError(null)
    try {
      await postRun(agentId, input)
      onRan()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="ck-label">Loom-Skript (Lead)</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <input
            className="ck-input"
            style={{ flex: '1 1 140px' }}
            placeholder="Name…"
            value={loomName}
            disabled={offline}
            onChange={(e) => setLoomName(e.target.value)}
            aria-label="Loom-Skript: Lead-Name"
          />
          <input
            className="ck-input"
            style={{ flex: '1 1 140px' }}
            placeholder="Website (optional)…"
            value={loomWebsite}
            disabled={offline}
            onChange={(e) => setLoomWebsite(e.target.value)}
            aria-label="Loom-Skript: Website-URL"
          />
          <button
            type="button"
            className="ck-btn ck-btn--primary"
            style={{ minHeight: 40 }}
            disabled={offline || !loomName.trim() || activeAgents.includes('loom-skript')}
            onClick={() => {
              void trigger('loom-skript', { name: loomName.trim(), website: loomWebsite.trim() || undefined })
              setLoomName('')
              setLoomWebsite('')
            }}
          >
            {activeAgents.includes('loom-skript') ? '…' : 'Starten'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="ck-label">Follow-up-PDF (Lead)</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <input
            className="ck-input"
            style={{ flex: '1 1 140px' }}
            placeholder="Name…"
            value={pdfName}
            disabled={offline}
            onChange={(e) => setPdfName(e.target.value)}
            aria-label="Follow-up-PDF: Lead-Name"
          />
          <input
            className="ck-input"
            style={{ flex: '1 1 140px' }}
            placeholder="Website…"
            value={pdfWebsite}
            disabled={offline}
            onChange={(e) => setPdfWebsite(e.target.value)}
            aria-label="Follow-up-PDF: Website-URL"
          />
          <button
            type="button"
            className="ck-btn ck-btn--primary"
            style={{ minHeight: 40 }}
            disabled={offline || !pdfName.trim() || !pdfWebsite.trim() || activeAgents.includes('followup-pdf')}
            onClick={() => {
              void trigger('followup-pdf', { name: pdfName.trim(), website: pdfWebsite.trim() })
              setPdfName('')
              setPdfWebsite('')
            }}
          >
            {activeAgents.includes('followup-pdf') ? '…' : 'Starten'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="ck-label">Lead-Research</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <input
            className="ck-input"
            style={{ flex: '1 1 200px' }}
            placeholder="Name, Firma oder URL…"
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
            type="button"
            className="ck-btn ck-btn--primary"
            style={{ minHeight: 40 }}
            disabled={offline || !leadQuery.trim() || activeAgents.includes('lead-research')}
            onClick={() => {
              void trigger('lead-research', { query: leadQuery.trim() })
              setLeadQuery('')
            }}
          >
            {activeAgents.includes('lead-research') ? '…' : 'Starten'}
          </button>
        </div>
      </div>

      {error ? (
        <p className="ck-label" style={{ margin: 0, color: 'var(--ck-warn)' }}>
          {error}
        </p>
      ) : null}
      {offline ? (
        <p className="ck-label" style={{ margin: 0, color: 'var(--ck-text-3)' }}>
          Runner offline · starte `npm run cockpit` im Repo-Root
        </p>
      ) : null}
    </div>
  )
}
