import { useCallback, useEffect, useState } from 'react'
import { useToast } from '../../components/Toast'
import { aktiviere, deaktiviere, probePush, pushStatus, statusText, type PushStatus } from '../lib/pushClient'

/**
 * Der Benachrichtigungs-Schalter (O3, Zug 5). Steht an zwei Stellen: auf
 * `/morgen` und im Mehr-Sheet.
 *
 * `aktiviere()` hängt ausschließlich am onClick — aus einem Effect heraus lehnt
 * iOS die Berechtigung still ab, und niemand sieht, warum nichts passiert.
 */
export function Benachrichtigungen({ kompakt = false }: { kompakt?: boolean }) {
  const [status, setStatus] = useState<PushStatus>('aus')
  const [laeuft, setLaeuft] = useState(false)
  const { show } = useToast()

  const lade = useCallback(() => {
    void pushStatus().then(setStatus)
  }, [])
  useEffect(lade, [lade])

  const anschalten = async () => {
    setLaeuft(true)
    const r = await aktiviere()
    setStatus(r.status)
    setLaeuft(false)
    if (!r.ok) show(r.fehler ?? statusText(r.status), 'error')
    else show('Benachrichtigungen aktiviert', 'success')
  }

  const ausschalten = async () => {
    setLaeuft(true)
    await deaktiviere()
    setLaeuft(false)
    lade()
    show('Benachrichtigungen aus', 'info')
  }

  const probe = async () => {
    setLaeuft(true)
    const r = await probePush()
    setLaeuft(false)
    show(r.meldung, r.ok ? 'success' : 'error')
  }

  const kannSchalten = status === 'an' || status === 'aus'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span className="ck-label">Benachrichtigungen</span>
        <span
          aria-hidden
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: status === 'an' ? 'var(--ck-accent)' : 'var(--ck-idle)',
          }}
        />
        {kannSchalten ? (
          <>
            <button
              type="button"
              className={status === 'an' ? 'ck-btn' : 'ck-btn ck-btn--primary'}
              disabled={laeuft}
              onClick={() => void (status === 'an' ? ausschalten() : anschalten())}
              style={{ fontSize: 12, minHeight: kompakt ? 32 : 40 }}
            >
              {status === 'an' ? 'Ausschalten' : 'Aktivieren'}
            </button>
            {status === 'an' ? (
              <button
                type="button"
                className="ck-btn"
                disabled={laeuft}
                onClick={() => void probe()}
                style={{ fontSize: 12, minHeight: kompakt ? 32 : 40 }}
              >
                Probe-Push
              </button>
            ) : null}
          </>
        ) : null}
      </div>
      {/* Immer den Grund nennen — ein fehlender Knopf ohne Erklärung ist die
          Stelle, an der Kevin am Handy raten müsste. */}
      <p style={{ margin: 0, fontSize: 11.5, color: 'var(--ck-text-3)', lineHeight: 1.5 }}>
        {statusText(status)}
      </p>
    </div>
  )
}
