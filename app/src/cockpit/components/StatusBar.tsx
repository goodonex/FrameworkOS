import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useUrielBus } from '../../store/urielBus'
import { useRunnerStatus } from '../lib/useRunnerStatus'

function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(t)
  }, [])

  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  const date = now
    .toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short' })
    .toUpperCase()

  return (
    <div style={{ textAlign: 'right', lineHeight: 1.2 }}>
      <div className="ck-clock-time">
        {hh}:{mm}
        <span className="ck-clock-seconds" style={{ color: 'var(--ck-text-3)', fontSize: 13 }}>:{ss}</span>
      </div>
      <div className="ck-label">{date}</div>
    </div>
  )
}

/**
 * Startrampe (Dashboard-Vereinfachung Juli 2026): externe Sprungmarken als
 * Icon-Links in der Statusbar — auf jeder Seite erreichbar (auch im CRM beim
 * Outreach), kostet null Dashboardfläche. Neue Ziele hier ergänzen.
 */
const LAUNCH_LINKS: Array<{ label: string; href: string; mark: string }> = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com/feed/', mark: 'in' },
  { label: 'Sales Navigator', href: 'https://www.linkedin.com/sales/home', mark: '◎' },
  { label: 'Mail', href: 'https://mail.google.com/mail/u/0/', mark: '✉' },
  { label: 'YouTube', href: 'https://www.youtube.com/', mark: '▶' },
]

function StatusWord({ label, state }: { label: string; state: 'on' | 'off' | 'pulse' }) {
  const dotClass =
    state === 'on' ? 'ck-dot ck-dot--on' : state === 'pulse' ? 'ck-dot ck-dot--pulse' : 'ck-dot'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span className={dotClass} />
      <span className="ck-label" style={{ color: state === 'off' ? 'var(--ck-text-3)' : 'var(--ck-text-2)' }}>
        {label}
        {state === 'off' ? ' · OFFLINE' : ''}
      </span>
    </span>
  )
}

/**
 * Phase 2, D3: Der ☀-Umschalter ist hier raus — das Cockpit ist nur noch
 * dunkel. Die `plain-light`-Styles bleiben als tote Klasse liegen (kein
 * Abriss, kein Pflegeversprechen); ein Hell-Modus käme später neu auf
 * Token-Basis. `useUiTheme` lebt weiter, Graph und Palette lesen es.
 */
export function StatusBar() {
  const { user } = useAuth()
  const runner = useRunnerStatus()
  const urielOpen = useUrielBus((s) => s.open)
  const toggleUriel = useUrielBus((s) => s.toggleOpen)

  return (
    <header className="ck-statusbar">
      {/* Wortmarke = Uriel-Trigger */}
      <button
        type="button"
        className={`ck-status-brand ck-uriel-trigger${urielOpen ? ' is-active' : ''}`}
        onClick={toggleUriel}
        aria-pressed={urielOpen}
        aria-label={urielOpen ? 'Uriel schließen' : 'Uriel aktivieren'}
        title={urielOpen ? 'Uriel schließen' : 'Uriel aktivieren'}
      >
        <span className="ck-wordmark">U R I E L</span>
        <span className="ck-label ck-status-brand-tag" style={{ marginTop: 2 }}>Cockpit</span>
      </button>

      {/* Status-Wörter — auf Mobile ausgeblendet (Platz für Nav+Tracking) */}
      <div className="ck-status-words">
        <StatusWord label="CORE" state="on" />
        <StatusWord label="SUPABASE" state={user ? 'on' : 'off'} />
        <StatusWord
          label="RUNNER"
          state={
            runner.state === 'online' ? (runner.runningCount > 0 ? 'pulse' : 'on') : 'off'
          }
        />
      </div>

      {/* Externe Tools + Uhr. Der Brand-Umschalter ist am 09.08.2026 entfallen —
          es gibt nur noch HERRMANN & CO. (siehe activeBrand.tsx). */}
      <div className="ck-status-right">
        <span className="ck-status-links" aria-label="Externe Tools">
          {LAUNCH_LINKS.map((l) => (
            <a
              key={l.label}
              className="ck-status-link"
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              title={`${l.label} in neuem Tab öffnen`}
              aria-label={l.label}
            >
              {l.mark}
            </a>
          ))}
        </span>
        <Clock />
      </div>
    </header>
  )
}
