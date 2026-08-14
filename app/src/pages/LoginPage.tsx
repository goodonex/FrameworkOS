import type { FormEvent } from 'react'
import { useMemo, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

export function LoginPage() {
  const { user, role, clientProjectId, loading, signIn } = useAuth()
  const location = useLocation()
  const from = useMemo(() => {
    const st = location.state as { from?: string } | undefined
    const raw = st?.from
    if (!raw || raw === '/login') return '/'
    return raw
  }, [location.state])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!supabase || !isSupabaseConfigured) {
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
        <p className="font-mono" style={{ fontSize: 13, color: 'var(--accent-coral)' }}>
          Supabase-Umgebungsvariablen fehlen.
        </p>
      </div>
    )
  }

  if (loading && !user) {
    return (
      <div
        className="font-mono animate-pulse"
        style={{
          pointerEvents: 'auto',
          padding: 32,
          color: 'var(--text-tertiary)',
          fontSize: 12,
        }}
      >
        Session wird geladen…
      </div>
    )
  }

  if (!loading && user) {
    if (role === 'client') {
      if (!clientProjectId) {
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
              className="glass-2 font-mono"
              style={{
                maxWidth: 400,
                borderRadius: 16,
                padding: 24,
                border: '1px solid var(--glass-border-1)',
                fontSize: 13,
                color: 'var(--accent-coral)',
              }}
            >
              Deinem Konto ist kein Deliver-Projekt zugeordnet. Bitte den Anbieter kontaktieren —
              in Supabase braucht dein User in <code>user_roles</code> ein gesetztes{' '}
              <code>project_id</code>.
            </div>
          </div>
        )
      }
      return <Navigate to={`/portal/${clientProjectId}`} replace />
    }
    return <Navigate to={from} replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setBusy(true)
    try {
      await signIn(email.trim(), password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login fehlgeschlagen')
    } finally {
      setBusy(false)
    }
  }

  async function handleMagicLink() {
    if (!supabase) return
    const addr = email.trim()
    if (!addr) {
      setError('Bitte zuerst die E-Mail-Adresse eingeben.')
      return
    }
    setError(null)
    setInfo(null)
    setBusy(true)
    try {
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email: addr,
        options: { emailRedirectTo: window.location.origin },
      })
      if (otpErr) throw otpErr
      setInfo('Magic Link gesendet. Prüf dein E-Mail-Postfach.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Magic Link konnte nicht gesendet werden.')
    } finally {
      setBusy(false)
    }
  }

  async function handleForgotPassword() {
    if (!supabase) return
    const addr = email.trim()
    if (!addr) {
      setError('Bitte zuerst die E-Mail-Adresse eingeben.')
      return
    }
    setError(null)
    setInfo(null)
    setBusy(true)
    try {
      const { error: resErr } = await supabase.auth.resetPasswordForEmail(addr, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (resErr) throw resErr
      setInfo('Recovery-E-Mail gesendet. Folge dem Link, um ein neues Passwort zu setzen.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recovery konnte nicht gesendet werden.')
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
          Anmelden
        </h1>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div>
            <label
              className="font-mono mb-1 block"
              style={{ fontSize: 11, color: 'var(--text-tertiary)' }}
            >
              E-Mail
            </label>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              style={field}
            />
          </div>
          <div>
            <label
              className="font-mono mb-1 block"
              style={{ fontSize: 11, color: 'var(--text-tertiary)' }}
            >
              Passwort
            </label>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              style={field}
            />
          </div>

          {error ? (
            <p className="font-mono" style={{ fontSize: 12, color: 'var(--accent-coral)' }}>
              {error}
            </p>
          ) : null}

          {info ? (
            <p className="font-mono" style={{ fontSize: 12, color: 'var(--accent-teal)' }}>
              {info}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy || loading}
            className="font-mono"
            style={{
              marginTop: 4,
              padding: '12px 16px',
              borderRadius: 12,
              border: '1px solid var(--glass-border-2)',
              background: 'var(--glass-3)',
              /**
               * Nicht `--accent-blue` (#4f7fff): auf dieser Fläche ergibt das
               * 3,69 : 1 und damit weniger als die 4,5 : 1, die AA bei 13 px
               * verlangt — der Knopf las sich wie deaktiviert. Derselbe Blauton,
               * nur hell genug: 6,1 : 1. Lokal, weil `--accent-blue` an anderen
               * Stellen auf anderen Hintergründen sitzt; ob der Anmelde-Knopf
               * überhaupt blau bleibt oder ins Cockpit-Grün wandert, ist eine
               * offene Farbentscheidung und keine Frage der Lesbarkeit.
               */
              color: '#8ab0ff',
              fontSize: 13,
              opacity: busy || loading ? 0.6 : 1,
            }}
          >
            {busy ? '…' : 'Einloggen'}
          </button>

          <div
            className="flex items-center gap-3"
            style={{
              marginTop: 4,
              fontSize: 10,
              color: 'var(--text-tertiary)',
            }}
          >
            <span style={{ flex: 1, height: 1, background: 'var(--glass-border-1)' }} />
            <span className="font-mono" style={{ letterSpacing: '0.12em' }}>
              ODER
            </span>
            <span style={{ flex: 1, height: 1, background: 'var(--glass-border-1)' }} />
          </div>

          <button
            type="button"
            onClick={() => void handleMagicLink()}
            disabled={busy || loading}
            className="font-mono"
            style={{
              padding: '12px 16px',
              borderRadius: 12,
              border: '1px solid var(--glass-border-1)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 13,
              opacity: busy || loading ? 0.6 : 1,
            }}
          >
            Magic Link per E-Mail senden
          </button>

          <button
            type="button"
            onClick={() => void handleForgotPassword()}
            disabled={busy || loading}
            className="font-mono"
            style={{
              alignSelf: 'center',
              padding: '6px 8px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-tertiary)',
              fontSize: 11,
              textDecoration: 'underline',
              cursor: 'pointer',
              opacity: busy || loading ? 0.6 : 1,
            }}
          >
            Passwort vergessen?
          </button>
        </form>
      </div>
    </div>
  )
}
