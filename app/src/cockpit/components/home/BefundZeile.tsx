/**
 * Die Warnzeile über dem Morgen: „morgenbrief ist heute gescheitert — ansehen".
 *
 * Wörtlich die Zeile aus `MorgenArea` (O17) — dieselbe Optik, dasselbe
 * Verhalten, jetzt an zwei Orten (Morgen-Seite und Homescreen). Sie rechnet
 * nichts: `agentenBefund(runs, jetzt)` läuft im Eltern-Container, der die Runs
 * ohnehin lädt (Gesetz 4: keine neuen Datenquellen).
 */
export function BefundZeile({ meldung, onOeffnen }: { meldung: string | null; onOeffnen: () => void }) {
  if (!meldung) return null
  return (
    <button
      type="button"
      onClick={onOeffnen}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '9px 11px',
        borderRadius: 'var(--ck-radius)',
        border: '1px solid var(--ck-danger)',
        background: 'transparent',
        color: 'var(--ck-danger)',
        fontSize: 12,
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      <span aria-hidden>⚠</span>
      <span>{meldung} — ansehen</span>
    </button>
  )
}
