import { laengsteSerie, laufendeSerie, letzteTage, type StreakFeld, type StreakTag } from '../../lib/identityStreak'

/**
 * Die Serien-Anzeige: Clean-Tage und Vertriebsblock-Tage.
 *
 * Zwei Kacheln, je eine große Zahl und sieben Punkte darunter (die letzten
 * sieben zählenden Tage, neuester rechts). Die Punktreihe ist die eigentliche
 * Botschaft — „never miss twice" ist an einer Zahl allein nicht ablesbar.
 *
 * Die Zahl steht in Serifen wie jede andere Kennzahl des Cockpits
 * (DESIGN-TOKENS: Editorial-Momente = Ring-Zahl, KPI-Großzahlen).
 */

interface Props {
  zeilen: StreakTag[]
  heute: string
  laedt?: boolean
}

interface KachelProps {
  feld: StreakFeld
  titel: string
  /** Was ein Tag in dieser Serie bedeutet — steht klein unter der Zahl. */
  einheit: string
  zeilen: StreakTag[]
  heute: string
  laedt: boolean
  /** Mobil über beide Spalten (die dritte Kachel im Zweier-Grid). */
  breit?: boolean
}

function SerienKachel({ feld, titel, einheit, zeilen, heute, laedt, breit }: KachelProps) {
  const serie = laufendeSerie(zeilen, feld, heute)
  const rekord = laengsteSerie(zeilen, feld)
  const tage = letzteTage(zeilen, feld, heute, 7)

  return (
    <div className={`ck-ident-streak${breit ? ' ck-ident-streak--breit' : ''}`}>
      <span className="ck-label">{titel}</span>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
        <span className="ck-serif ck-zahl" style={{ fontSize: 38, lineHeight: 1, color: 'var(--ck-text-1)' }}>
          {laedt ? '–' : serie.laenge}
        </span>
        <span style={{ fontSize: 12, color: 'var(--ck-text-2)' }}>{einheit}</span>
      </div>

      {/* Die sieben letzten zählenden Tage. Gefüllt = gesetzt, Ring = heute. */}
      <div className="ck-ident-punkte" aria-hidden>
        {tage.map((t) => (
          <span
            key={t.datum}
            className={[
              'ck-ident-punkt',
              t.gesetzt ? 'ck-ident-punkt--voll' : '',
              t.heute ? 'ck-ident-punkt--heute' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          />
        ))}
      </div>

      <p className="ck-ident-streak-fuss">
        {serie.laenge === 0
          ? 'Noch keine Serie — der erste Haken startet sie.'
          : serie.heuteOffen
            ? `Heute noch offen · Rekord ${rekord}`
            : `Rekord ${rekord}`}
      </p>
    </div>
  )
}

export function StreakBand({ zeilen, heute, laedt = false }: Props) {
  return (
    <div className="ck-ident-streak-band">
      {/*
        Clean steht vorn. Es ist die Serie, die am 16.08.2026 bei null anfängt
        (Baseline: täglich ab mittags 3–7 Joints) — und die einzige, bei der
        ein einziger Tag die Zahl auf null setzt.
      */}
      <SerienKachel
        feld="clean"
        titel="Clean"
        einheit="Tage am Stück"
        zeilen={zeilen}
        heute={heute}
        laedt={laedt}
      />
      <SerienKachel
        feld="vertriebsblock"
        titel="Vertriebsblock"
        einheit="Werktage am Stück"
        zeilen={zeilen}
        heute={heute}
        laedt={laedt}
      />
      {/* Die Morgenlese-Serie (0073) — Regel 1 gilt jeden Tag, also zählt
          sie wie Clean den lückenlosen Kalender. Mobil über beide Spalten:
          die Basis-Zeile unter den zwei harten Serien. */}
      <SerienKachel
        feld="morgenlese"
        titel="Sunrise Success Formel"
        einheit="Tage am Stück"
        zeilen={zeilen}
        heute={heute}
        laedt={laedt}
        breit
      />
    </div>
  )
}
