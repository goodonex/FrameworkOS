import type { MetricField } from '../../lib/metrikFelder'
import type { StufenStand } from '../../lib/tagesFlow'
import { TagesFlowStack } from './TagesFlowStack'

/**
 * Der V5-Hero „Horizont" — der Kopf des mobilen Cockpit-Homes (Phase 2, D4).
 *
 * Foto-Ambiente, Begrüßung in Serifen, der Tages-Flow als Held, darunter die
 * Uriel-Pille. Das Foto gibt es NUR hier; Arbeitsflächen bleiben ruhige
 * Farbfläche (DESIGN-TOKENS.md, Haltung).
 *
 * Seit dem 11.08. steht dort nicht mehr EIN Ring, sondern die wischbare Kette
 * der fünf Tagesstufen (`TagesFlowStack`). Der Aufbau bleibt derselbe: eine
 * Zahl, die man ohne Hinsehen trifft, und ein Tipp bis zum Zähler.
 *
 * **Der Hero rechnet nichts.** Grußformel, Datum und die Stufen-Stände kommen
 * als Props aus `UrielHome`, das die Hooks ohnehin ruft. Eine zweite Zähl-
 * oder Fälligkeitslogik entstünde sonst genau hier — und die Zahl im Hero
 * liefe der Zahl im Tracking davon.
 */
export function HeroHorizont({
  gruss,
  datum,
  stufen,
  stufenLaden,
  onAsk,
  onStufe,
}: {
  /** „Guten Morgen." — die Begrüßung, fertig formuliert. */
  gruss: string
  /** Die Zusammenfassung darunter (Tagesansage). */
  datum: string
  /** Die fünf Stufen des Tages, fertig gerechnet. */
  stufen: StufenStand[]
  /** Solange true, steht noch nicht fest, welche Stufe offen ist. */
  stufenLaden: boolean
  /** Öffnet das bestehende Uriel-Dock. Der Hero kennt Uriel nicht selbst. */
  onAsk: () => void
  /** Der Ring ist der kürzeste Weg in den Zähl-Modus (11.08.). */
  onStufe: (feld: MetricField) => void
}) {
  return (
    <header className="ck-hero">
      <div className="ck-hero-foto" aria-hidden />

      <div>
        <h1 className="ck-hero-gruss">{gruss}</h1>
        <p className="ck-hero-datum">{datum}</p>
      </div>

      {/* Die fünf Stufen des Tages. Ein Tipp auf einen Ring öffnet den
          Zähl-Modus für genau diese Stufe — kürzer kommt Kevin morgens nicht
          an den Daumen-Zähler. */}
      <TagesFlowStack staende={stufen} laedt={stufenLaden} onStufe={onStufe} />

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
