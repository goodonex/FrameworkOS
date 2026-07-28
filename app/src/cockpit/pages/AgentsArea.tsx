import { useCallback, useEffect, useRef, useState } from 'react'
import { RunnerHinweis } from '../components/RunnerHinweis'
import {
  fetchAgents,
  fetchRun,
  fetchRuns,
  postRun,
  type AgentInfo,
  type RunDetail,
  type RunSummary,
} from '../lib/runnerApi'

/**
 * Agenten-Area (Cockpit /agenten): zeigt die Coworking-Agenten (Vault-Skills +
 * autonome Bau-Agenten wie den Content-Batch) und startet sie manuell über den
 * lokalen Runner (POST /run). Laufende + letzte Runs mit Status, Klick öffnet den
 * Output. Lokal-first: braucht den laufenden Runner (npm run cockpit:full).
 */
const TIME_FMT = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

function fmt(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : TIME_FMT.format(d)
}

const STATUS_COLOR: Record<RunSummary['status'], string> = {
  running: 'var(--ck-warn)',
  done: 'var(--ck-accent)',
  error: 'var(--ck-danger, #e5484d)',
}
const STATUS_LABEL: Record<RunSummary['status'], string> = {
  running: 'läuft…',
  done: 'fertig',
  error: 'Fehler',
}

export function AgentsArea() {
  const [agents, setAgents] = useState<AgentInfo[] | null>(null)
  const [runs, setRuns] = useState<RunSummary[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [openRun, setOpenRun] = useState<RunDetail | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const timer = useRef<number | null>(null)

  const load = useCallback(async () => {
    try {
      const [a, r] = await Promise.all([fetchAgents(), fetchRuns(12)])
      setAgents(a)
      setRuns(r)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    void load()
    timer.current = window.setInterval(() => void load(), 4000)
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [load])

  const run = async (agent: AgentInfo) => {
    setBusy((s) => new Set(s).add(agent.id))
    setNotice(null)
    try {
      await postRun(agent.id)
      setNotice(`„${agent.label}" gestartet — Fortschritt unten bei „Läuft & zuletzt".`)
      await load()
    } catch (e) {
      setNotice(`Start fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy((s) => {
        const n = new Set(s)
        n.delete(agent.id)
        return n
      })
    }
  }

  const anyRunning = runs.some((r) => r.status === 'running') || (agents?.some((a) => a.running) ?? false)

  if (error && !agents) {
    return (
      <div style={{ maxWidth: 820 }}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Agenten</div>
        <RunnerHinweis error={error} was="Die Agenten" />
      </div>
    )
  }
  if (!agents) return <p className="ck-label">Lade…</p>

  return (
    <div style={{ maxWidth: 1000 }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>Agenten</div>
        <div className="ck-label" style={{ marginTop: 2 }}>
          Coworking-Agenten manuell ausführen · {agents.length} verfügbar
          {anyRunning ? ' · ein Agent läuft…' : ''}
        </div>
      </div>

      {notice ? (
        <div className="ck-panel" style={{ padding: '9px 13px', marginBottom: 12, fontSize: 12.5 }}>
          {notice}
        </div>
      ) : null}

      {/* Agenten-Karten */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, marginBottom: 20 }}>
        {agents.map((a) => {
          const isBusy = busy.has(a.id) || a.running
          return (
            <div key={a.id} className="ck-panel" style={{ padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{a.label}</span>
                <span
                  className="ck-label"
                  style={{
                    marginLeft: 'auto',
                    fontSize: 9.5,
                    padding: '1px 7px',
                    borderRadius: 99,
                    border: `1px solid ${a.kind === 'write' ? 'var(--ck-accent)' : 'var(--ck-border)'}`,
                    color: a.kind === 'write' ? 'var(--ck-accent)' : 'var(--ck-text-3)',
                  }}
                  title={a.kind === 'write' ? 'Baut selbst Dateien (Schreibrechte im Zielordner)' : 'Liest nur, liefert Text'}
                >
                  {a.kind === 'write' ? 'baut' : 'liest'}
                </span>
              </div>
              <p className="ck-label" style={{ margin: 0, lineHeight: 1.45, minHeight: 34 }}>{a.description}</p>
              <button
                className="ck-btn ck-btn--primary"
                style={{ fontSize: 12, alignSelf: 'flex-start' }}
                disabled={isBusy}
                onClick={() => void run(a)}
              >
                {isBusy ? 'läuft…' : 'Ausführen'}
              </button>
            </div>
          )
        })}
      </div>

      {/* Läuft & zuletzt */}
      <div className="ck-label" style={{ marginBottom: 8 }}>Läuft &amp; zuletzt</div>
      <div className="ck-panel" style={{ padding: 0, overflow: 'hidden' }}>
        {runs.length === 0 ? (
          <p className="ck-label" style={{ padding: 14 }}>Noch keine Runs.</p>
        ) : (
          runs.map((r) => (
            <button
              key={r.id}
              onClick={() => void fetchRun(r.id).then(setOpenRun).catch(() => {})}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                textAlign: 'left',
                padding: '10px 13px',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid var(--ck-border)',
                cursor: 'pointer',
              }}
            >
              <span aria-hidden style={{ width: 8, height: 8, borderRadius: 99, background: STATUS_COLOR[r.status], flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, fontWeight: 600, minWidth: 130 }}>{r.agent}</span>
              <span className="ck-label" style={{ color: STATUS_COLOR[r.status] }}>{STATUS_LABEL[r.status]}</span>
              <span className="ck-label" style={{ marginLeft: 'auto' }}>{fmt(r.started)}</span>
            </button>
          ))
        )}
      </div>

      {openRun ? <RunDetailDrawer run={openRun} onClose={() => setOpenRun(null)} /> : null}
    </div>
  )
}

function RunDetailDrawer({ run, onClose }: { run: RunDetail; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-label={`Run ${run.agent}`}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 60, display: 'flex', justifyContent: 'flex-end', pointerEvents: 'auto' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(680px, 92vw)', height: '100%', background: 'var(--ck-bg-1, #fff)', borderLeft: '1px solid var(--ck-border)', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderBottom: '1px solid var(--ck-border)' }}>
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>{run.agent}</span>
          <span className="ck-label" style={{ color: STATUS_COLOR[run.status] }}>{STATUS_LABEL[run.status]}</span>
          <button className="ck-btn" style={{ marginLeft: 'auto', fontSize: 12 }} onClick={onClose}>Schließen</button>
        </div>
        <pre
          style={{
            margin: 0,
            padding: 16,
            overflow: 'auto',
            fontSize: 12,
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: 'var(--ck-mono, ui-monospace, monospace)',
          }}
        >
          {run.content || '(kein Output)'}
        </pre>
      </div>
    </div>
  )
}
