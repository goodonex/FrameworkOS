/**
 * Der V5-Hero „Horizont" — der Kopf des mobilen Cockpit-Homes (Phase 2, D4).
 *
 * Foto-Ambiente, Begrüßung in Serifen, der Tages-Ring als Held, darunter die
 * Uriel-Pille. Das Foto gibt es NUR hier; Arbeitsflächen bleiben ruhige
 * Farbfläche (DESIGN-TOKENS.md, Haltung).
 *
 * **Der Hero rechnet nichts.** Grußformel, Datum, Ring-Zahl und Ring-Ziel
 * kommen als Props aus `UrielHome`, das die Hooks ohnehin ruft. Eine zweite
 * Zähl- oder Fälligkeitslogik entstünde sonst genau hier — und die Zahl im
 * Hero liefe der Zahl im Tracking davon.
 */

/** Radius und Umfang des Rings — r52 nach DESIGN-TOKENS.md. */
const RADIUS = 52
const UMFANG = 2 * Math.PI * RADIUS

export function HeroHorizont({
  gruss,
  datum,
  ringWert,
  ringZiel,
  ringLabel,
  onAsk,
}: {
  /** „Guten Morgen." — die Begrüßung, fertig formuliert. */
  gruss: string
  /** Die Zusammenfassung darunter (Tagesansage). */
  datum: string
  ringWert: number
  ringZiel: number
  ringLabel: string
  /** Öffnet das bestehende Uriel-Dock. Der Hero kennt Uriel nicht selbst. */
  onAsk: () => void
}) {
  const anteil = ringZiel > 0 ? Math.min(1, Math.max(0, ringWert / ringZiel)) : 0
  const rest = Math.max(0, ringZiel - ringWert)
  const unterzeile =
    ringZiel <= 0
      ? 'Kein Tagesziel gesetzt.'
      : rest === 0
        ? 'Tagesziel steht.'
        : `Noch ${rest} bis zum Tagesziel.`

  return (
    <header className="ck-hero">
      <div className="ck-hero-foto" aria-hidden />

      <div>
        <h1 className="ck-hero-gruss">{gruss}</h1>
        <p className="ck-hero-datum">{datum}</p>
      </div>

      <div className="ck-ring">
        <div className="ck-ring-feld">
          <svg viewBox="0 0 120 120" role="img" aria-label={`${ringLabel}: ${ringWert} von ${ringZiel}`}>
            {/* Glas-Mitte + Bahn */}
            <circle
              cx="60"
              cy="60"
              r={RADIUS}
              fill="rgba(8, 13, 9, 0.5)"
              stroke="var(--ck-card-border)"
              strokeWidth="5"
            />
            {/* Der gelaufene Teil. Start oben, im Uhrzeigersinn.
                Die Kappe ist nur rund, solange etwas gelaufen ist — bei 0
                malte eine runde Kappe sonst einen Punkt auf die Bahn, und der
                sähe aus wie „einer ist schon drin". */}
            <circle
              cx="60"
              cy="60"
              r={RADIUS}
              fill="none"
              stroke="var(--ck-accent)"
              strokeWidth="5"
              strokeLinecap={anteil > 0 ? 'round' : 'butt'}
              strokeDasharray={`${(UMFANG * anteil).toFixed(1)} ${UMFANG.toFixed(1)}`}
              transform="rotate(-90 60 60)"
            />
          </svg>
          <div className="ck-ring-mitte" aria-hidden>
            <span className="ck-ring-zahl">
              {ringWert}
              <i>/{ringZiel}</i>
            </span>
            <span className="ck-label">{ringLabel}</span>
          </div>
        </div>
        <p className="ck-ring-unter">{unterzeile}</p>
      </div>

      <button type="button" className="ck-ask" onClick={onAsk}>
        <span className="ck-ask-funke" aria-hidden>
          ✦
        </span>
        <span className="ck-ask-text">Frag Uriel — oder halt zum Sprechen.</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" aria-hidden>
          <path d="M12 3v10m0 0a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v4a3 3 0 0 0 3 3Zm-6-3a6 6 0 0 0 12 0M12 19v2" />
        </svg>
      </button>
    </header>
  )
}
