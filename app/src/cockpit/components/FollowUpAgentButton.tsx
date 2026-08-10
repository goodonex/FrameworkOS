import { useState } from 'react'
import type { Contact } from '../../types/db'
import { postRun } from '../lib/runnerApi'
import { useRunnerStatus } from '../lib/useRunnerStatus'

/**
 * Follow-up-Entwurf direkt am Kontakt (Backlog #4): schickt GENAU diesen
 * Kontakt an den followup-entwuerfe-Agenten. Ergebnis erscheint im Cockpit
 * (Documents/Graph) und als Note im Vault — der RunWatcher toastet bei fertig.
 */
export function FollowUpAgentButton({ contact }: { contact: Contact }) {
  const runner = useRunnerStatus()
  const [state, setState] = useState<'idle' | 'starting' | 'started' | 'error'>('idle')

  if (runner.state !== 'online') return null

  const start = async () => {
    setState('starting')
    try {
      await postRun('followup-entwuerfe', {
        contacts: [
          {
            name: contact.name,
            company: contact.company,
            stage: contact.pipeline_stage,
            lastContact: contact.stage_changed_at ?? null,
            nextFollowUp: contact.next_follow_up_at,
            notes: contact.entscheider_name ? `Entscheider: ${contact.entscheider_name}` : null,
          },
        ],
      })
      setState('started')
      window.setTimeout(() => setState('idle'), 4000)
    } catch {
      setState('error')
      window.setTimeout(() => setState('idle'), 4000)
    }
  }

  return (
    <button
      type="button"
      className="font-mono"
      onClick={() => void start()}
      disabled={state === 'starting'}
      title="Agent entwirft eine Follow-up-Nachricht für genau diesen Kontakt"
      style={{
        fontSize: 12,
        color: state === 'error' ? 'var(--accent-amber)' : 'var(--accent-success)',
        padding: '8px 14px',
        borderRadius: 'var(--ck-radius-innen)',
        border: '1px solid var(--glass-border-2)',
        background: 'var(--glass-2)',
        cursor: state === 'starting' ? 'wait' : 'pointer',
      }}
    >
      {state === 'started'
        ? '✓ Agent läuft — Toast folgt'
        : state === 'error'
          ? '⚠ Runner-Fehler'
          : state === 'starting'
            ? '…'
            : '▶ Follow-up entwerfen'}
    </button>
  )
}
