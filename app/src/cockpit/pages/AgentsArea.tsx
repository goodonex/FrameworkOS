import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RunnerHinweis } from '../components/RunnerHinweis'
import { agentenBefund } from '../lib/agentenGesundheit'
import {
  fetchAgents,
  fetchRun,
  fetchRuns,
  postRun,
  RUNS_FENSTER,
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
  error: 'var(--ck-danger)',
}
const STATUS_LABEL: Record<RunSummary['status'], string> = {
  running: 'läuft…',
  done: 'fertig',
  error: 'Fehler',
}

/**
 * Agenten, die ohne Lead-Daten (name, website) gar nichts bauen können — ihr
 * Prompt im Runner-Katalog beginnt mit „für den Lead aus den Eingabedaten".
 * `postRun(agent.id)` schickte bisher keinen Input mit: der Start hier war ein
 * Leerlauf mit anschließendem Fehl-Run. Ids gegen `AGENT_CATALOG`
 * (runner/index.mjs) abgeglichen, nicht geraten.
 */
const BRAUCHT_POSTEN = new Set(['loom-skript', 'followup-pdf', 'lead-research'])
const POSTEN_HINWEIS = 'Braucht einen Posten — aus dem Arbeitsmodus starten.'

export function AgentsArea() {
  const [agents, setAgents] = useState<AgentInfo[] | null>(null)
  const [runs, setRuns] = useState<RunSummary[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [openRun, setOpenRun] = useState<RunDetail | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  /** Dieselbe Bewertung wie auf dem Homescreen — eine Quelle, zwei Orte. */
  const befund = useMemo(() => agentenBefund(runs), [runs])
  const timer = useRef<number | null>(null)

  const load = useCallback(async () => {
    try {
      // Dieselbe Menge wie `useRunnerData` (Homescreen/Morgen): mit 12 zeigte
      // diese Seite an vollen Tagen weniger Fehlschlaege als der Homescreen,
      // obwohl beide dieselbe `agentenBefund`-Bewertung fuettern.
      const [a, r] = await Promise.all([fetchAgents(), fetchRuns(RUNS_FENSTER)])
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
          const brauchtPosten = BRAUCHT_POSTEN.has(a.id)
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
                style={{ fontSize: 12, alignSelf: 'flex-start', opacity: brauchtPosten ? 0.45 : 1 }}
                disabled={isBusy || brauchtPosten}
                title={brauchtPosten ? POSTEN_HINWEIS : undefined}
                onClick={() => void run(a)}
              >
                {isBusy ? 'läuft…' : 'Ausführen'}
              </button>
              {brauchtPosten ? (
                <span className="ck-label" style={{ color: 'var(--ck-text-3)', lineHeight: 1.4 }}>
                  {POSTEN_HINWEIS}
                </span>
              ) : null}
            </div>
          )
        })}
      </div>

      {/* Was Kevin selbst beheben muss, steht ÜBER der Liste — nicht als
          zwölfte rote Zeile darin. Genau daran ist der 11.08. verlorengegangen:
          die Anmeldung war abgelaufen, und alles, was dort stand, war „Fehler". */}
      {befund.handlungsbedarf?.grund ? (
        <div
          className="ck-panel"
          role="status"
          style={{
            marginBottom: 10,
            padding: '11px 13px',
            borderColor: 'var(--ck-danger)',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ck-danger)' }}>
            {befund.handlungsbedarf.grund.kurz}
          </span>
          <span className="ck-label" style={{ color: 'var(--ck-text-2)', letterSpacing: 0, textTransform: 'none' }}>
            {befund.handlungsbedarf.grund.hinweis}
          </span>
        </div>
      ) : null}

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
              {/* Der Name oben, darunter was los ist. Zweizeilig, weil
                  „Anmeldung abgelaufen" neben dem Agentennamen bei 390 px
                  nicht mehr in eine Zeile passt — und abgeschnitten wäre die
                  Auskunft so wertlos wie das alte „Fehler". */}
              <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>{r.agent}</span>
                <span className="ck-label" style={{ color: STATUS_COLOR[r.status] }}>
                  {r.status === 'error' ? (r.grund?.kurz ?? STATUS_LABEL.error) : STATUS_LABEL[r.status]}
                </span>
              </span>
              <span className="ck-label" style={{ flexShrink: 0 }}>{fmt(r.started)}</span>
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
      style={{ position: 'fixed', inset: 0, background: 'var(--ck-backdrop)', zIndex: 60, display: 'flex', justifyContent: 'flex-end', pointerEvents: 'auto' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(680px, 92vw)', height: '100%', background: 'var(--ck-bg-1)', borderLeft: '1px solid var(--ck-border)', display: 'flex', flexDirection: 'column' }}
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
