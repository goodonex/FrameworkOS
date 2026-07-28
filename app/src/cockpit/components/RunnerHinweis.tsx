import { isLocalOrigin } from '../lib/useRunnerStatus'

/**
 * Einheitliche Antwort auf „der Runner ist nicht erreichbar".
 *
 * Der Unterschied, den die Oberfläche bisher verschluckt hat: auf der
 * HTTPS-Live-Domain ist das KEIN Fehler, sondern Bauart. Der Browser blockt
 * jeden Aufruf an http://127.0.0.1:4711 als Mixed Content — der Status-Punkt
 * oben steht trotzdem auf grün, weil er den Heartbeat über Supabase liest
 * (Migration 0057). Ein rotes „Load failed" ist dort also irreführend.
 *
 * Lokal dagegen bedeutet dieselbe Meldung sehr wohl ein Problem: der Runner
 * läuft nicht. Dort bleibt die Warnfarbe samt Originalmeldung stehen.
 */
export function RunnerHinweis({
  error,
  was,
  hinweis,
}: {
  /** Originalmeldung des fehlgeschlagenen Aufrufs. */
  error: string
  /** Was hier nicht geht, in einem Halbsatz — z. B. „Die Ads-Auswertung". */
  was: string
  /** Optionaler Zusatz, der in beiden Fällen gilt. */
  hinweis?: string
}) {
  const lokal = isLocalOrigin()

  if (!lokal) {
    return (
      <div className="ck-panel" style={{ padding: '10px 14px', fontSize: 12.5, color: 'var(--ck-text-2)', maxWidth: 820 }}>
        {was} liest aus deinen lokalen Dateien und ist deshalb hier nicht verfügbar — der
        Browser lässt von dieser Domain aus keine Verbindung zum Runner zu. Öffne dafür{' '}
        <code style={{ color: 'var(--ck-accent)' }}>localhost:5173</code>.
        {hinweis ? (
          <div className="ck-label" style={{ marginTop: 4, color: 'var(--ck-text-3)' }}>{hinweis}</div>
        ) : null}
      </div>
    )
  }

  return (
    <div
      className="ck-panel"
      style={{ padding: '10px 14px', border: '1px solid var(--ck-warn)', color: 'var(--ck-warn)', fontSize: 12.5, maxWidth: 820 }}
    >
      Runner nicht erreichbar: {error}
      <div className="ck-label" style={{ marginTop: 4, color: 'var(--ck-text-3)' }}>
        Starte das Cockpit mit <code>npm run cockpit:full</code>.
        {hinweis ? ` ${hinweis}` : ''}
      </div>
    </div>
  )
}
