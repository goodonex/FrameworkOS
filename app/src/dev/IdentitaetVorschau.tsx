import { useState } from 'react'
import { IdentitaetAnsicht } from '../cockpit/components/identitaet/IdentitaetAnsicht'
import { isoTag, tagDavor, istWochenende } from '../cockpit/lib/identityStreak'
import type { StreakTag } from '../cockpit/lib/identityStreak'
import type { CheckinRow } from '../cockpit/lib/useIdentityCheckin'
import '../styles/cockpit.css'

/**
 * Dev-Vorschau (nur `import.meta.env.DEV`, ohne Login): zeigt `/identitaet`
 * gegen Fixture-Daten. Grund wie bei `ZielVorschau` — die echte Route liegt
 * hinter dem Supabase-Login und ist so nicht abnehmbar.
 *
 * **Die Zahlen hier sind erfunden**, damit Serien, Haken und Regler überhaupt
 * einen Zustand zeigen. Kevins echte Clean-Serie startet am 16.08.2026 bei
 * null. Kein Produktions-Code-Pfad: die Haken schreiben in lokalen State,
 * nicht nach Supabase.
 */

const HEUTE = isoTag(new Date())

/** Die letzten 14 Tage: Clean seit drei Tagen, Vertriebsblock an vier Werktagen. */
const FIXTURES: StreakTag[] = (() => {
  const raus: StreakTag[] = []
  let tag = HEUTE
  for (let i = 0; i < 14; i++) {
    raus.push({
      datum: tag,
      clean: i < 3,
      vertriebsblock: !istWochenende(tag) && i < 6,
      sport: i === 1 || i === 4,
    })
    tag = tagDavor(tag)
  }
  return raus.reverse()
})()

export function IdentitaetVorschau() {
  const [heute, setHeute] = useState<CheckinRow>({
    datum: HEUTE,
    vertriebsblock: true,
    clean: true,
    sport: false,
    energie: 7,
    dankbar_1: 'Der Block lief, bevor ich das System aufgemacht habe.',
    dankbar_2: 'Lisa hat gekocht.',
    dankbar_3: null,
  })

  // Die Fixture-Serien ziehen mit, wenn man in der Vorschau einen Haken umlegt.
  const streakZeilen: StreakTag[] = [
    ...FIXTURES.filter((z) => z.datum !== HEUTE),
    { datum: HEUTE, clean: heute.clean, vertriebsblock: heute.vertriebsblock, sport: heute.sport },
  ]

  return (
    <div
      className="ck-root"
      style={{
        // Wie in der echten Shell: fest über der ganzen Fläche, eigenes
        // Scrolling. Ohne das scheint der App-Hintergrund am Rand durch und
        // die Abnahme-Bilder zeigen eine Farbe, die die Seite gar nicht hat.
        position: 'fixed',
        inset: 0,
        overflowY: 'auto',
        background: 'var(--ck-bg-verlauf)',
        padding: 12,
      }}
    >
      <IdentitaetAnsicht
        heute={heute}
        streakZeilen={streakZeilen}
        heuteIso={HEUTE}
        laedt={false}
        tabelleFehlt={false}
        fehler={null}
        umschalten={(feld) => setHeute((z) => ({ ...z, [feld]: !z[feld] }))}
        setzen={(patch) => setHeute((z) => ({ ...z, ...patch }))}
      />
    </div>
  )
}
