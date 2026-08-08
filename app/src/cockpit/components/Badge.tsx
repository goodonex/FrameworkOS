/**
 * Der Zähl-Punkt an einem Nav-Eintrag oder einer App-Kachel.
 *
 * Stand bis O18 in `NavRail.tsx`. Seit Zug 4 braucht ihn auch das App-Grid des
 * Homescreens — kopiert wäre er zweimal zu pflegen, also liegt er jetzt hier.
 * Optik unverändert (gleiche Maße, gleiche Farben).
 */
export function Badge({ anzahl }: { anzahl: number }) {
  if (anzahl <= 0) return null
  return (
    <span
      aria-hidden
      style={{
        position: 'absolute',
        top: -3,
        right: -6,
        minWidth: 14,
        height: 14,
        padding: '0 3px',
        borderRadius: 99,
        background: 'var(--ck-accent)',
        color: '#fff',
        fontSize: 9,
        fontWeight: 700,
        lineHeight: '14px',
        textAlign: 'center',
      }}
    >
      {anzahl}
    </span>
  )
}

/** Nur fürs Vorlese-Programm — der Badge selbst ist aria-hidden. */
export function BadgeText({ anzahl }: { anzahl: number }) {
  if (anzahl <= 0) return null
  return (
    <span
      style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}
    >
      {' '}
      ({anzahl} neu)
    </span>
  )
}
