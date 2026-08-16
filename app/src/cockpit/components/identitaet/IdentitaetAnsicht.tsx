import { MORGENLESE, VISIONMAP_QUELLE } from '../../lib/identityInhalte'
import type { StreakTag } from '../../lib/identityStreak'
import type { CheckinRow } from '../../lib/useIdentityCheckin'
import { CheckinKarte } from './CheckinKarte'
import { IdentitaetSektionen } from './Sektionen'
import { StreakBand } from './StreakBand'
import { Visionboard } from './Visionboard'

/**
 * Die Darstellung des Identity-OS — **ohne einen einzigen Datenpfad**.
 *
 * Getrennt vom Container (`pages/IdentitaetArea.tsx`) nach demselben Muster
 * wie der Homescreen: „Dieser Container ruft die Hooks, die Widgets bekommen
 * Props." Der zweite Grund ist die Abnahme — `/identitaet` liegt hinter dem
 * Supabase-Login und wäre sonst nur mit echter Sitzung anzusehen. So kann die
 * Dev-Vorschau (`dev/IdentitaetVorschau.tsx`) dieselbe Ansicht zeigen, statt
 * das Markup ein zweites Mal nachzubauen und damit auseinanderlaufen zu lassen.
 *
 * Die Reihenfolge ist die Botschaft: Morgenlese → Check-in → Board →
 * Nachschlagewerk. Erst wer ich bin, dann was ich heute tue, dann wohin das
 * führt — die „Sein → Tun → Haben"-Ordnung der Map selbst.
 */

export interface IdentitaetAnsichtProps {
  heute: CheckinRow
  streakZeilen: StreakTag[]
  heuteIso: string
  laedt: boolean
  tabelleFehlt: boolean
  fehler: string | null
  umschalten: (feld: 'vertriebsblock' | 'clean' | 'sport') => void
  setzen: (patch: Partial<Omit<CheckinRow, 'datum'>>) => void
}

function datumLang(d: Date): string {
  return d.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })
}

export function IdentitaetAnsicht({
  heute,
  streakZeilen,
  heuteIso,
  laedt,
  tabelleFehlt,
  fehler,
  umschalten,
  setzen,
}: IdentitaetAnsichtProps) {
  return (
    <div className="ck-ident">
      <header className="ck-ident-kopf">
        <span className="ck-label">Morgenlese · 2 Minuten</span>
        <p className="ck-ident-datum">{datumLang(new Date(`${heuteIso}T12:00:00`))}</p>
      </header>

      {/* --- Die Morgenlese ------------------------------------------------ */}
      <section className="ck-ident-lese" aria-label="Morgenlese">
        <p className="ck-serif ck-ident-leitsatz">{MORGENLESE.leitsatz}</p>
        <p className="ck-ident-leitsatz-folge">{MORGENLESE.leitsatzFolge}</p>

        <div className="ck-ident-saetze">
          {MORGENLESE.saetze.map((s) => (
            <p key={s}>{s}</p>
          ))}
        </div>

        <div className="ck-panel ck-ident-routine">
          <span className="ck-label">{MORGENLESE.routine.titel}</span>
          <p className="ck-ident-routine-kern">{MORGENLESE.routine.kern}</p>
          <p className="ck-ident-routine-zusatz">{MORGENLESE.routine.zusatz}</p>
        </div>

        <div className="ck-ident-standards">
          <span className="ck-label">Nicht verhandelbar</span>
          <div className="ck-ident-pillen">
            {MORGENLESE.standards.map((s) => (
              <span key={s} className="ck-ident-pille">
                {s}
              </span>
            ))}
          </div>
        </div>

        <p className="ck-ident-warum-satz">{MORGENLESE.warum}</p>

        <div className="ck-ident-afform">
          {MORGENLESE.afformationen.map((a) => (
            <p key={a}>{a}</p>
          ))}
        </div>
      </section>

      {/* --- Serien + Check-in --------------------------------------------- */}
      <StreakBand zeilen={streakZeilen} heute={heuteIso} laedt={laedt} />

      {tabelleFehlt ? (
        <p className="ck-ident-hinweis">
          Der Check-in kann noch nicht speichern — die Tabelle fehlt in der Datenbank. Migration 0072
          (<code>identity_checkins</code>) muss noch per <code>supabase db push</code> eingespielt werden.
          Lesen funktioniert, Haken bleiben nur nicht erhalten.
        </p>
      ) : null}
      {fehler ? <p className="ck-ident-hinweis">{fehler}</p> : null}

      <CheckinKarte heute={heute} laedt={laedt} umschalten={umschalten} setzen={setzen} />

      {/* --- Das Board ------------------------------------------------------ */}
      <div className="ck-ident-board-kopfzeile">
        <span className="ck-label">Visionboard</span>
        <span className="ck-ident-board-hinweis">wohin das führt</span>
      </div>
      <Visionboard />

      {/* --- Nachschlagewerk ------------------------------------------------ */}
      <IdentitaetSektionen />

      <p className="ck-ident-quelle">Quelle: {VISIONMAP_QUELLE}</p>
    </div>
  )
}
