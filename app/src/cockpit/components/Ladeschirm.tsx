import { useEffect, useState } from 'react'
import type { Etappe, RundeStand } from '../lib/rundeApi'

/**
 * Der Ladeschirm (31.08.2026) — was Kevin sieht, während Uriel sich holt, was
 * es braucht.
 *
 * **Warum hier ein Vollbild steht, obwohl Vollbild sonst nur am Handy gilt.**
 * Kevin hat es für genau diesen Fall selbst verlangt: *„dann kann ja sein, dass
 * das dann so ein Fullscreen ist, wo drinne steht, so Routinen laufen grade
 * durch […] und dann komm ich an 'n Schreibtisch und seh, ah, okay, der ist zu
 * siebzig Prozent durch."* Der Schirm ist die Antwort auf ein Ärgernis, das
 * genau darin bestand, dass die Arbeit unsichtbar war.
 *
 * **Er sperrt trotzdem nichts.** Ein Lauf dauert bis zu zwanzig Minuten; ein
 * Cockpit, das so lange nicht bedienbar ist, wäre der nächste Ärger. „Im
 * Hintergrund weiterlaufen" legt ihn weg, die Statusleiste trägt den Fortschritt
 * weiter, ein Klick dort holt ihn zurück.
 *
 * **Keine Bewegung ohne Aussage.** Kein Spinner, kein Pulsieren, keine
 * Schimmer-Animation: Der Balken bewegt sich, wenn etwas passiert, und steht
 * still, wenn nichts passiert. Genau das ist die Information.
 */

const STATUS_ZEICHEN: Record<Etappe['status'], string> = {
  wartet: '·',
  laeuft: '▸',
  fertig: '✓',
  fehler: '!',
  uebersprungen: '–',
}

function farbe(status: Etappe['status']): string {
  if (status === 'fertig') return 'var(--ck-accent)'
  if (status === 'laeuft') return 'var(--ck-text-1)'
  if (status === 'fehler') return 'var(--ck-warn)'
  return 'var(--ck-text-3)'
}

function EtappenZeile({ e }: { e: Etappe }) {
  const laeuft = e.status === 'laeuft'
  return (
    <li
      style={{
        display: 'grid',
        gridTemplateColumns: '1.2rem 1fr auto',
        gap: '0.75rem',
        alignItems: 'baseline',
        padding: '0.5rem 0',
        borderBottom: '1px solid var(--ck-border)',
        color: farbe(e.status),
      }}
    >
      <span aria-hidden style={{ fontFamily: 'var(--ck-mono, ui-monospace, monospace)', opacity: laeuft ? 1 : 0.7 }}>
        {STATUS_ZEICHEN[e.status]}
      </span>
      <span>
        <span style={{ fontWeight: laeuft ? 600 : 400 }}>{e.titel}</span>
        {e.text ? (
          <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--ck-text-3)', marginTop: '0.15rem' }}>{e.text}</span>
        ) : null}
      </span>
      <span style={{ fontSize: '0.78rem', color: 'var(--ck-text-3)', whiteSpace: 'nowrap' }}>
        {e.status === 'wartet' ? e.wieLange : null}
      </span>
    </li>
  )
}

function Balken({ prozent }: { prozent: number }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={prozent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Fortschritt"
      style={{
        height: 6,
        borderRadius: 3,
        background: 'var(--ck-panel-2)',
        overflow: 'hidden',
        border: '1px solid var(--ck-border)',
      }}
    >
      <div
        style={{
          width: `${Math.min(100, Math.max(0, prozent))}%`,
          height: '100%',
          background: 'var(--ck-accent)',
          // Ruhig, nicht federnd: Der Balken zeigt Fortschritt, er feiert ihn nicht.
          transition: 'width 600ms linear',
        }}
      />
    </div>
  )
}

export function Ladeschirm({
  stand,
  onStarten,
  onAbbrechen,
  onWeglegen,
  onSpaeter,
}: {
  stand: RundeStand
  onStarten: () => void
  onAbbrechen: () => void
  onWeglegen: () => void
  onSpaeter: () => void
}) {
  const laeuft = stand.laeuft
  const fertig = !laeuft && !!stand.runde?.status && stand.runde.status !== 'laeuft'
  const [gestartet, setGestartet] = useState(false)

  /**
   * Nach dem Lauf das ERGEBNIS zeigen, nicht wieder die Frage (31.08., beim
   * Durchklicken der Zustände gefunden).
   *
   * Der Fall ist genau der, für den der Schirm gebaut ist: Kevin legt ihn weg,
   * macht Kaffee, kommt zurück und klickt auf den Knopf in der Statusleiste.
   * Steht dort dann „Neuesten Stand laden?", hat er keine Ahnung, ob der Lauf
   * durchlief oder wo er hängen blieb. Zehn Minuten lang gehört das Ergebnis
   * auf den Schirm; danach ist es Geschichte und die Frage wieder richtig.
   */
  const ERGEBNIS_GILT_MS = 10 * 60 * 1000
  const frischFertig =
    fertig &&
    !!stand.runde?.beendet &&
    Date.now() - new Date(stand.runde.beendet).getTime() < ERGEBNIS_GILT_MS
  const zeigeFrage = !laeuft && !gestartet && !frischFertig

  // Esc legt den Schirm weg — nicht abbrechen. Ein versehentlich abgebrochener
  // Lauf kostet zwanzig Minuten, ein versehentlich weggelegter gar nichts.
  useEffect(() => {
    const auf = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return
      if (laeuft) onWeglegen()
      else onSpaeter()
    }
    window.addEventListener('keydown', auf)
    return () => window.removeEventListener('keydown', auf)
  }, [laeuft, onWeglegen, onSpaeter])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={laeuft ? 'Uriel lädt den neuesten Stand' : 'Neuesten Stand laden?'}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'grid',
        placeItems: 'center',
        padding: '1.5rem',
        background: 'rgba(8, 13, 9, 0.88)',
        backdropFilter: 'blur(6px)',
        /**
         * `#app-ui-overlay` in App.tsx legt über die GANZE App
         * `pointer-events: none` — jedes Vollbild-UI außerhalb des
         * `.ck-root`-Divs muss sich einzeln zurückmelden (dokumentierte
         * Uriel-Falle, zuletzt beim Nebula-Vollbild). Ohne diese Zeile war der
         * Schirm am 01.09. sichtbar, aber KEIN Knopf klickbar — „Ja, laden"
         * und „Später" taten schlicht nichts. In der Dev-Vorschau fiel das
         * nicht auf, weil der Schirm dort INNERHALB eines ck-root mit
         * `pointerEvents: 'auto'` steht.
         */
        pointerEvents: 'auto',
      }}
    >
      <div
        className="ck-card"
        style={{
          width: 'min(560px, 100%)',
          maxHeight: '86vh',
          overflowY: 'auto',
          background: 'var(--ck-panel)',
          border: '1px solid var(--ck-border-strong)',
          borderRadius: 14,
          padding: '1.5rem',
          boxShadow: 'var(--ck-schatten-schwebend)',
        }}
      >
        {zeigeFrage ? (
          <>
            <h2 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--ck-text-1)' }}>Neuesten Stand laden?</h2>
            <p style={{ margin: '0.6rem 0 0', color: 'var(--ck-text-2)', lineHeight: 1.55 }}>
              Letzter vollständiger Lauf: <strong style={{ color: 'var(--ck-text-1)' }}>{stand.letzterStandText}</strong>.
              {' '}Uriel holt Postfach, Verläufe, Einladungen und Kontakte, verbucht die Leads und schreibt die Entwürfe —
              rund zwanzig Minuten. Du kannst dabei weiterarbeiten.
            </p>
            {!stand.chrome ? (
              <p
                style={{
                  margin: '0.9rem 0 0',
                  padding: '0.7rem 0.85rem',
                  borderRadius: 8,
                  background: 'var(--ck-warn-dim)',
                  color: 'var(--ck-text-2)',
                  fontSize: '0.88rem',
                  lineHeight: 1.5,
                }}
              >
                Das Sync-Chrome läuft nicht. Ohne es bleiben LinkedIn-Postfach, Verläufe und die beiden Listen außen vor
                — Leads, Wächter und Entwürfe laufen trotzdem. Im Terminal <code>chrome-sync</code> starten und das
                Fenster offen lassen, dann ist alles dabei.
              </p>
            ) : null}
            <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.3rem', flexWrap: 'wrap' }}>
              <button
                className="ck-btn"
                onClick={() => {
                  setGestartet(true)
                  onStarten()
                }}
                style={{ background: 'var(--ck-accent-dim)', color: 'var(--ck-accent-text)', borderColor: 'var(--ck-accent)' }}
              >
                Ja, laden
              </button>
              <button className="ck-btn" onClick={onSpaeter}>
                Später
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--ck-text-1)' }}>{stand.kopf}</h2>
              <span
                style={{
                  fontFamily: 'var(--ck-mono, ui-monospace, monospace)',
                  fontSize: '1.35rem',
                  color: 'var(--ck-accent)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {stand.prozent}%
              </span>
            </div>
            <div style={{ marginTop: '0.85rem' }}>
              <Balken prozent={stand.prozent} />
            </div>
            {stand.rest ? (
              <p style={{ margin: '0.55rem 0 0', fontSize: '0.85rem', color: 'var(--ck-text-3)' }}>{stand.rest}</p>
            ) : null}

            <ul style={{ listStyle: 'none', margin: '1.2rem 0 0', padding: 0 }}>
              {(stand.runde?.etappen ?? []).map((e) => (
                <EtappenZeile key={e.schluessel} e={e} />
              ))}
            </ul>

            <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.3rem', flexWrap: 'wrap' }}>
              {laeuft ? (
                <>
                  <button
                    className="ck-btn"
                    onClick={onWeglegen}
                    style={{ background: 'var(--ck-accent-dim)', color: 'var(--ck-accent-text)', borderColor: 'var(--ck-accent)' }}
                  >
                    Im Hintergrund weiterlaufen
                  </button>
                  <button className="ck-btn" onClick={onAbbrechen}>
                    Abbrechen
                  </button>
                </>
              ) : (
                <button
                  className="ck-btn"
                  onClick={onWeglegen}
                  style={{ background: 'var(--ck-accent-dim)', color: 'var(--ck-accent-text)', borderColor: 'var(--ck-accent)' }}
                >
                  {fertig ? 'Weiter' : 'Schließen'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
