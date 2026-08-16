import { useState } from 'react'
import { NavRail } from '../cockpit/components/NavRail'
import { IdentitaetAnsicht } from '../cockpit/components/identitaet/IdentitaetAnsicht'
import { ActiveBrandProvider } from '../cockpit/lib/activeBrand'
import { tagDavor, istWochenende } from '../cockpit/lib/identityStreak'
import type { StreakTag } from '../cockpit/lib/identityStreak'
import { toIsoDate } from '../cockpit/lib/metricsDates'
import type { CheckinRow } from '../cockpit/lib/useIdentityCheckin'
import '../styles/cockpit.css'

/**
 * Dev-Vorschau (nur `import.meta.env.DEV`, ohne Login): zeigt `/identitaet`
 * gegen Fixture-Daten — **in der Geometrie der echten Shell**. Der Rahmen ist
 * strukturgleich mit `CockpitShell.tsx` (StatusBar-Zeile, echte `NavRail`,
 * `main.ck-main` mit denselben Inline-Styles): damit prüft die Vorschau auch
 * das Randlos-Margin gegen den echten `.ck-main`-Innenabstand (12px mobil,
 * 18px Desktop) und ob das Dock den letzten Inhalt verdeckt — genau die zwei
 * Dinge, die eine freistehende Vorschau nie zeigen würde.
 *
 * **Die Zahlen sind erfunden**, damit Serien, Haken und Regler einen Zustand
 * zeigen. Kevins echte Clean-Serie startet am 16.08.2026 bei null. Kein
 * Produktions-Code-Pfad: die Haken schreiben in lokalen State, nicht nach
 * Supabase.
 */

// Dieselbe lokale Uhr wie der echte Hook — nicht isoTag (UTC).
const HEUTE = toIsoDate(new Date())

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
    <ActiveBrandProvider>
      <div
        className="ck-root"
        style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', pointerEvents: 'auto', zIndex: 2 }}
      >
        <div className="ck-statusbar" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="ck-wordmark">URIEL</span>
        </div>
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <NavRail />
          <main className="ck-main" style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
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
          </main>
        </div>
      </div>
    </ActiveBrandProvider>
  )
}
