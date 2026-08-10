import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [checking, setChecking] = useState(true)
  const [hasSession, setHasSession] = useState(false)

  useEffect(() => {
    if (!supabase) {
      setChecking(false)
      return
    }
    let cancelled = false

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      setHasSession(!!session)
      setChecking(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return
      if (event === 'PASSWORD_RECOVERY' || session) {
        setHasSession(true)
        setChecking(false)
      }
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError('Passwort muss mindestens 6 Zeichen haben.')
      return
    }
    if (password !== confirm) {
      setError('Passwörter stimmen nicht überein.')
      return
    }
    if (!supabase) {
      setError('Supabase ist nicht konfiguriert.')
      return
    }
    setBusy(true)
    try {
      const { error: updErr } = await supabase.auth.updateUser({ password })
      if (updErr) throw updErr
      setDone(true)
      setTimeout(() => {
        navigate('/', { replace: true })
      }, 1400)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Passwort konnte nicht gesetzt werden.')
    } finally {
      setBusy(false)
    }
  }

  const field = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 12,
    background: 'var(--glass-1)',
    border: '1px solid var(--glass-border-1)',
    color: 'var(--text-primary)',
    fontSize: 14,
  } as const

  return (
    <div
      style={{
        pointerEvents: 'auto',
        minHeight: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        className="glass-2"
        style={{
          width: '100%',
          maxWidth: 380,
          borderRadius: 20,
          padding: '28px 26px',
          border: '1px solid var(--glass-border-1)',
          backdropFilter: 'var(--blur-md)',
          WebkitBackdropFilter: 'var(--blur-md)',
        }}
      >
        <div
          className="font-mono mb-2"
          style={{
            fontSize: 10,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            // D12: Wortmarke und Akzent kommen aus Welt 1, sonst bleibt die
            // Karte, wie sie ist.
            color: 'var(--ck-accent)',
          }}
        >
          Uriel
        </div>
        <h1
          className="font-display mb-6"
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: 'var(--text-primary)',
            letterSpacing: '-0.3px',
          }}
        >
          Neues Passwort setzen
        </h1>

        {checking ? (
          <p
            className="font-mono animate-pulse"
            style={{ fontSize: 12, color: 'var(--text-tertiary)' }}
          >
            Recovery-Session wird geprüft…
          </p>
        ) : !hasSession ? (
          <div className="flex flex-col gap-3">
            <p style={{ fontSize: 13, color: 'var(--accent-coral)', lineHeight: 1.5 }}>
              Keine gültige Recovery-Session erkannt. Bitte öffne den Link aus der Recovery-Email
              erneut.
            </p>
            <button
              type="button"
              onClick={() => navigate('/login', { replace: true })}
              className="font-mono"
              style={{
                padding: '10px 14px',
                borderRadius: 12,
                border: '1px solid var(--glass-border-2)',
                background: 'var(--glass-3)',
                color: 'var(--text-secondary)',
                fontSize: 13,
              }}
            >
              Zurück zum Login
            </button>
          </div>
        ) : done ? (
          <p
            className="font-mono"
            style={{ fontSize: 13, color: 'var(--accent-teal)', lineHeight: 1.5 }}
          >
            Passwort gesetzt. Du wirst weitergeleitet…
          </p>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div>
              <label
                className="font-mono mb-1 block"
                style={{ fontSize: 11, color: 'var(--text-tertiary)' }}
              >
                Neues Passwort
              </label>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                style={field}
              />
            </div>
            <div>
              <label
                className="font-mono mb-1 block"
                style={{ fontSize: 11, color: 'var(--text-tertiary)' }}
              >
                Passwort wiederholen
              </label>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={confirm}
                onChange={(ev) => setConfirm(ev.target.value)}
                style={field}
              />
            </div>

            {error ? (
              <p className="font-mono" style={{ fontSize: 12, color: 'var(--accent-coral)' }}>
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="font-mono"
              style={{
                marginTop: 4,
                padding: '12px 16px',
                borderRadius: 12,
                border: '1px solid var(--glass-border-2)',
                background: 'var(--glass-3)',
                color: 'var(--accent-blue)',
                fontSize: 13,
                opacity: busy ? 0.6 : 1,
              }}
            >
              {busy ? '…' : 'Passwort speichern'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
