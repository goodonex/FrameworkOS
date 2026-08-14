import { useEffect, useMemo, useState } from 'react'
import { tagesStempel } from '../lib/agentenGesundheit'
import { fetchAgents, type AgentInfo, type RunSummary } from '../lib/runnerApi'
import type { RunnerState } from '../lib/useRunnerStatus'

/**
 * Agenten-Panel (Dashboard-Vereinfachung Juli 2026): fasst Command Deck,
 * Documents/Runs und die Dream-Karte in EINEM Panel zusammen — ein Thema,
 * ein Ort. Aufbau: Agent-Buttons + Lead-Research oben, Dream-Vorschlag als
 * hervorgehobene Zeile, darunter die letzten Runs.
 */

/**
 * Agenten, die NICHT als generischer Deck-Button erscheinen:
 * - dream-check läuft automatisch 1×/Tag,
 * - lead-research hat ein eigenes Eingabefeld,
 * - write-Agenten (kind:'write') leben auf /agenten — das Deck ist für
 *   schnelle tägliche Routinen.
 */
const HIDDEN_ON_DECK = new Set(['dream-check', 'lead-research'])

/** Fallback, solange /agents noch nicht geladen ist — Deck nie leer, wenn online. */
const FALLBACK: AgentInfo[] = [
  { id: 'morgenbrief', label: 'Morgen-Brief', description: 'Tagesstart', kind: 'readonly', running: false },
  { id: 'wochenrecap', label: 'Wochenrecap', description: 'Zahlen vs. Ziel', kind: 'readonly', running: false },
  { id: 'followup-entwuerfe', label: 'Follow-up-Entwürfe', description: 'Wartende Kontakte', kind: 'readonly', running: false },
]

const DREAM_DISMISS_KEY = 'cockpit.dreamDismissed'

function runDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })
}

export function AgentsPanel({
  runnerState,
  activeAgents,
  runs,
  onRun,
  onOpenRun,
}: {
  runnerState: RunnerState
  /** Agenten, die gerade laufen (agent-ids) */
  activeAgents: string[]
  runs: RunSummary[]
  onRun: (agentId: string, input?: Record<string, unknown>) => Promise<void>
  onOpenRun: (runId: string) => void
}) {
  const offline = runnerState !== 'online'
  const [leadQuery, setLeadQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [dreamDismissedId, setDreamDismissedId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(DREAM_DISMISS_KEY)
    } catch {
      return null
    }
  })

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
  const deckAgents = source.filter((a) => a.kind === 'readonly' && !HIDDEN_ON_DECK.has(a.id))
  const hasLeadResearch = source.some((a) => a.id === 'lead-research') || agents.length === 0

  // Dream-Vorschlag des Tages (ehem. DreamCard) — dismissbar, merkt sich die Run-Id.
  //
  // `toISOString()` waere hier falsch: die Run-Id traegt die LOKALE Zeit
  // (runner/index.mjs, nowStamp). In DE laege der Prefix abends ab 22:00/23:00
  // schon auf morgen und morgens vor 02:00 noch auf gestern — der Vorschlag
  // fehlte dann kommentarlos. `tagesStempel` ist genau dafuer da.
  const todayPrefix = tagesStempel(new Date())
  const dream = useMemo(
    () =>
      runs.find(
        (r) => r.agent === 'dream-check' && r.id.startsWith(todayPrefix) && r.status === 'done',
      ) ?? null,
    [runs, todayPrefix],
  )
  const showDream = dream != null && dream.id !== dreamDismissedId
  const dismissDream = () => {
    if (!dream) return
    setDreamDismissedId(dream.id)
    try {
      localStorage.setItem(DREAM_DISMISS_KEY, dream.id)
    } catch {
      /* ohne localStorage nur für diese Session */
    }
  }

  const lastRuns = runs.slice(0, 6)

  const trigger = async (agentId: string, input?: Record<string, unknown>) => {
    setError(null)
    try {
      await onRun(agentId, input)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <section className="ck-panel" aria-label="Agenten — starten und letzte Runs">
      <div className="ck-label" style={{ padding: '10px 12px 6px' }}>
        Agenten
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 12px 12px' }}>
        {deckAgents.map((a) => {
          const isRunning = activeAgents.includes(a.id) || a.running
          return (
            <button
              key={a.id}
              className="ck-btn"
              disabled={offline || isRunning}
              onClick={() => void trigger(a.id)}
              title={offline ? 'Runner offline' : a.description}
              style={{ justifyContent: 'space-between' }}
            >
              <span>
                {isRunning ? <span className="ck-dot ck-dot--pulse" style={{ marginRight: 8 }} /> : '▶ '}
                {a.label}
              </span>
              <span className="ck-label">{isRunning ? 'läuft…' : a.description}</span>
            </button>
          )
        })}

        {/* Lead-Research mit Eingabe */}
        {hasLeadResearch ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              className="ck-input"
              style={{ flex: 1, minWidth: 0 }}
              placeholder="Lead: Name, Firma oder URL…"
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

      {/* Dream des Tages — hervorgehobene Zeile statt eigener Karte */}
      {showDream && dream ? (
        <div
          style={{
            borderTop: '1px solid color-mix(in srgb, var(--ck-accent) 35%, transparent)',
            padding: '8px 12px 10px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="ck-label" style={{ color: 'var(--ck-accent)' }}>☾ Dream · heute</span>
            <button
              onClick={dismissDream}
              aria-label="Dream-Vorschlag ausblenden"
              style={{ background: 'none', border: 'none', color: 'var(--ck-text-3)', cursor: 'pointer', fontSize: 12 }}
            >
              ✕
            </button>
          </div>
          <button
            onClick={() => onOpenRun(dream.id)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              background: 'none',
              border: 'none',
              padding: '4px 0 0',
              cursor: 'pointer',
              color: 'var(--ck-text-2)',
              fontFamily: 'var(--ck-font)',
              fontSize: 12,
              lineHeight: 1.55,
            }}
          >
            {dream.preview || 'Vorschlag ansehen…'}
            <span style={{ display: 'block', marginTop: 4, color: 'var(--ck-accent)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Öffnen →
            </span>
          </button>
        </div>
      ) : null}

      {/* Letzte Runs (ehem. Documents-Panel) */}
      <div style={{ borderTop: '1px solid var(--ck-border)' }}>
        <div className="ck-label" style={{ padding: '8px 12px 2px' }}>
          Letzte Runs
        </div>
        {lastRuns.length === 0 ? (
          <p style={{ padding: '6px 12px 10px', margin: 0, color: 'var(--ck-text-3)', fontSize: 12 }}>
            Noch keine Runs.
          </p>
        ) : (
          lastRuns.map((r, i) => (
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
                borderBottom: i === lastRuns.length - 1 ? 'none' : '1px solid var(--ck-border)',
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
